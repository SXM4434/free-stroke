/**
 * Dither v1 — threshold-based tonal reduction
 * (POST_MVP_DITHER_AND_ANIMATED_DITHER_PHASE_1).
 *
 * DITHER IS NOT TEXTURE. Texture adds a PATTERN to the surface (it modulates
 * albedo + roughness BEFORE/DURING lighting). Dither takes the FINAL SHADED
 * TONE and reduces it to a small number of levels, using a per-pixel threshold
 * so that the spatial arrangement of kept/dropped pixels fakes the missing
 * in-between shades. That is why it injects at the very END of the fragment
 * shader, after lighting, tone mapping, and color space conversion: dithering
 * is a display-space operation on the tone you actually see.
 *
 * THE CORE IDEA (ordered dithering):
 *   quantize(luminance + (threshold(x,y) - 0.5) * amount)
 * Without the threshold term, quantizing to N levels gives flat banding. The
 * threshold map varies per pixel, so pixels whose tone sits between two levels
 * get pushed up or down depending on their position in the tile — producing a
 * stable, structured pattern whose LOCAL AVERAGE still equals the original
 * tone. Subtracting 0.5 centres the offset so average brightness is preserved
 * (Wikipedia, "Ordered dithering" — without it the image brightens).
 *
 * Threshold sources implemented:
 *   bayer4 / bayer8 — classic recursive Bayer index matrices (the ordered,
 *     computational look). Generated in GLSL from the recurrence rather than
 *     stored as a lookup table, see `fsBayer`.
 *   blueNoise      — interleaved gradient noise (IGN). NOT a true blue-noise
 *     texture (that needs void-and-cluster precomputation); IGN is the standard
 *     cheap approximation with far better spectral distribution than white
 *     noise, so it reads as soft/organic dither instead of TV static.
 *   halftone       — distance from the centre of each cell, so dots GROW with
 *     tone like print halftone.
 *   lines          — threshold ramps along one axis, so marks grow as lines.
 *
 * Research: docs/research/dither-phase.md. Explainer: docs/explainers/02-dither.md
 */
import type * as THREE from "three"
import type { DitherType, DitherDirection } from "./style-system"

export const DITHER_TYPE_INDEX: Record<DitherType, number> = {
  bayer4: 1,
  bayer8: 2,
  blueNoise: 3,
  halftone: 4,
  lines: 5,
  dotScreen: 6,
  hatch: 7,
  crosshatch: 8,
  diamond: 9,
  newsprint: 10,
}

export const DITHER_DIRECTION_VEC: Record<DitherDirection, [number, number]> = {
  static: [0, 0],
  horizontal: [1, 0],
  vertical: [0, 1],
  diagonal: [0.7071, 0.7071],
}

export interface DitherUniforms {
  uFsDitType: { value: number }
  /** Cell size in pixels (screen lock) or object units (object lock). */
  uFsDitScale: { value: number }
  /** Bias added to the threshold — pushes the whole image lighter/darker. */
  uFsDitThreshold: { value: number }
  /** Tone contrast applied BEFORE quantization. */
  uFsDitContrast: { value: number }
  /** How strongly the dithered result replaces the smooth original. */
  uFsDitIntensity: { value: number }
  /** Number of output tone levels (2 = pure black/white). */
  uFsDitLevels: { value: number }
  /** Tone exposure applied BEFORE contrast/quantization (see style-system). */
  uFsDitExposure: { value: number }
  /** Screen angle in RADIANS for the print-style maps (types 6..10). */
  uFsDitAngle: { value: number }
  uFsDitTime: { value: number }
  uFsDitDirX: { value: number }
  uFsDitDirY: { value: number }
  uFsDitLockScreen: { value: number }
  /** Stack blend mode (see STACK_BLEND_INDEX). */
  uFsDitBlend: { value: number }
}

export function createDitherUniforms(): DitherUniforms {
  return {
    uFsDitType: { value: 0 },
    uFsDitScale: { value: 1 },
    uFsDitThreshold: { value: 0.5 },
    uFsDitContrast: { value: 0.5 },
    uFsDitIntensity: { value: 1 },
    uFsDitLevels: { value: 2 },
    uFsDitExposure: { value: 0.5 },
    uFsDitAngle: { value: Math.PI / 4 },
    uFsDitTime: { value: 0 },
    uFsDitDirX: { value: 0 },
    uFsDitDirY: { value: 0 },
    uFsDitLockScreen: { value: 1 },
    uFsDitBlend: { value: 0 },
  }
}

/**
 * GLSL injected into <common>.
 *
 * fsBayer(x, y, levels): the recursive Bayer index matrix evaluated without a
 * lookup table. The recurrence
 *     M_{2n} = [ 4M_n      4M_n + 2 ]
 *              [ 4M_n + 3  4M_n + 1 ]
 * says: at each level of refinement, the cell is split into 4 quadrants which
 * are visited in the order top-left, bottom-right, top-right, bottom-left
 * (offsets 0,1,2,3). Working from the COARSEST bit down to the finest and
 * accumulating base-4 digits reproduces the same matrix iteratively. Each
 * iteration reads one bit of x and y; `levels` = 2 gives 4x4, 3 gives 8x8.
 */
const DITHER_GLSL = /* glsl */ `
uniform float uFsDitType;
uniform float uFsDitScale;
uniform float uFsDitThreshold;
uniform float uFsDitContrast;
uniform float uFsDitIntensity;
uniform float uFsDitLevels;
uniform float uFsDitExposure;
uniform float uFsDitAngle;
uniform float uFsDitTime;
uniform float uFsDitDirX;
uniform float uFsDitDirY;
uniform float uFsDitLockScreen;
uniform float uFsDitBlend;

float fsBayer(vec2 c, int levels) {
  float result = 0.0;
  float divisor = 1.0;
  vec2 p = floor(c);
  for (int i = 0; i < 3; i++) {
    if (i >= levels) break;
    // Read the bit at position (levels-1-i): coarsest quadrant decision first.
    float shift = pow(2.0, float(levels - 1 - i));
    float bx = mod(floor(p.x / shift), 2.0);
    float by = mod(floor(p.y / shift), 2.0);
    // Quadrant order 0,2,3,1 -> value = 2*bx + 3*by - 4*bx*by  gives
    // (0,0)=0  (1,0)=2  (0,1)=3  (1,1)=1  which is the Bayer recurrence.
    float q = 2.0 * bx + 3.0 * by - 4.0 * bx * by;
    divisor *= 4.0;
    result += q / divisor;
  }
  return result;
}

// Interleaved gradient noise — cheap, well-distributed per-pixel threshold.
float fsIGN(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// Triangle wave: 0 at the cell centre-line, 1 at the cell edge. Marks grow
// symmetrically from a centre spine, unlike fract()'s one-sided sawtooth.
float fsTri(float x) {
  return abs(fract(x) - 0.5) * 2.0;
}

float fsDitherThreshold(vec2 co, float type) {
  if (type < 1.5) return fsBayer(co, 2);         // 4x4
  if (type < 2.5) return fsBayer(co, 3);         // 8x8
  if (type < 3.5) return fsIGN(floor(co));       // noise threshold (IGN)
  if (type < 4.5) {
    // halftone: distance from cell centre, normalised. Low in the middle so
    // the centre crosses the threshold first and the dot grows outward.
    vec2 f = fract(co) - 0.5;
    return clamp(length(f) * 2.0, 0.0, 1.0);
  }
  if (type < 5.5) {
    // lines: threshold ramps across the cell -> marks grow as thickening lines.
    return fract(co.y);
  }

  // ---- Print-style screens (types 6..10) rotate the whole tile by the
  // screen angle first — the defining trait of a press screen is that its
  // lattice sits at an angle to the pixel grid (classic single-ink print
  // uses 45 deg, where the eye is least sensitive to the rosette).
  float fsCA = cos(uFsDitAngle);
  float fsSA = sin(uFsDitAngle);
  vec2 c2 = vec2(co.x * fsCA - co.y * fsSA, co.x * fsSA + co.y * fsCA);

  if (type < 6.5) {
    // dot screen: CLUSTERED round dot on the angled lattice. x1.45 (vs
    // halftone's x2.0) lets dots merge into a checker past ~55% ink, the
    // clustered-dot behaviour that makes print midtones read as a weave.
    vec2 f = fract(c2) - 0.5;
    return clamp(length(f) * 1.45, 0.0, 1.0);
  }
  if (type < 7.5) {
    // hatch: angled line screen with a symmetric triangle profile — strokes
    // thicken about their own spine like a drawn hatch line.
    return fsTri(c2.y);
  }
  if (type < 8.5) {
    // crosshatch: two line screens at right angles. min() means a tone only
    // has to beat ONE of the screens to mark, so shadows ink BOTH directions
    // (the woven engraving look) while midtones keep a single hatch.
    return min(fsTri(c2.x), fsTri(c2.y));
  }
  if (type < 9.5) {
    // diamond: L1 distance from the cell centre — dots grow as diamonds whose
    // POINTS touch first, giving a faceted screen unlike any round dot.
    vec2 f = abs(fract(c2) - 0.5);
    return clamp((f.x + f.y) * 1.5, 0.0, 1.0);
  }
  // newsprint: the angled clustered dot with per-cell grain jitter. Real
  // newsprint dots are ragged because ink spreads unevenly into cheap paper;
  // jittering the threshold per PIXEL (not per cell) frays the dot edges.
  vec2 f = fract(c2) - 0.5;
  float dotThr = clamp(length(f) * 1.45, 0.0, 1.0);
  return clamp(dotThr + (fsIGN(floor(co * 3.0)) - 0.5) * 0.5, 0.0, 1.0);
}
`

/**
 * Dither as a COMPOSABLE FUNCTION rather than an inline tail.
 *
 * Making it `vec3 -> vec3` is what lets the layer stack reorder it against
 * ASCII and blend its result: an inline block that mutates gl_FragColor can
 * only ever run in the position it was pasted. Blend + amount are applied here
 * so every layer honours the stack the same way.
 */
export const DITHER_APPLY_GLSL = /* glsl */ `
vec3 fsApplyDither(vec3 fsCol) {
  if (uFsDitType < 0.5) return fsCol;

  // Cell-based screens (halftone onward) need room for a MARK to grow inside
  // the cell — a 3px halftone dot cannot read as a dot. Bayer / noise
  // thresholds work per pixel, so they stay at the raw scale.
  float fsCellF = uFsDitType > 3.5 ? 2.4 : 1.0;

  // Coordinate for the threshold tile.
  vec2 fsDCo = uFsDitLockScreen > 0.5
    ? gl_FragCoord.xy / max(uFsDitScale * fsCellF, 0.05)
    : vFsObjPos.xy * (26.0 / max(uFsDitScale * fsCellF, 0.05));
  fsDCo += vec2(uFsDitDirX, uFsDitDirY) * uFsDitTime;

  float fsThr = fsDitherThreshold(fsDCo, uFsDitType);

  // Perceived brightness (Rec. 709 luma weights: the eye is far more
  // sensitive to green than to blue).
  float fsRawLum = dot(fsCol, vec3(0.2126, 0.7152, 0.0722));

  // EXPOSURE. The subject never spans the full 0..1 range (the live default
  // material sits at ~0.30..0.62; ink materials sit near black), so raw
  // luminance parks the whole form on one side of every threshold and the
  // pattern is UNIFORM — no tonal modelling, which is exactly the mush the
  // pre-craft version produced. Dividing by a reference rescales the
  // subject's real range across the ramp; the dial picks the reference.
  // mix(1.9, .16): the default (0.5) lands the live default material's body
  // tone (~0.54) at mid-ramp, so the pattern is present across the WHOLE
  // form — at ref 0.8 the body sat 84% open and the stroke read pale/weak.
  float fsRef = mix(1.9, 0.16, clamp(uFsDitExposure, 0.0, 1.0));
  float fsLum = clamp(fsRawLum / max(fsRef, 0.02), 0.0, 1.0);

  // Contrast about mid-grey, then the user's threshold bias.
  fsLum = clamp((fsLum - 0.5) * (0.5 + uFsDitContrast * 3.0) + 0.5, 0.0, 1.0);

  // PATTERN FLOOR. On a glossy-black subject (rod / extrude materials sit at
  // raw ~0.04) the contrast expansion clamps tone to 0 and NO pattern
  // renders at any dial setting — the layer silently no-ops. The floor is
  // anchored to raw luminance through a soft gamma, so an ink-dark subject
  // still keeps ~10-15% of its threshold structure (sparse paper pores /
  // checker sparkle), while the default material's shadows (raw ~0.34) are
  // already above it and see no change.
  fsLum = max(fsLum, pow(clamp(fsRawLum / max(fsRef, 0.02), 0.0, 1.0), 0.4) * 0.42);
  fsLum += (uFsDitThreshold - 0.5);

  // THE DITHER STEP: offset by the centred threshold, then quantize.
  float fsLevels = max(uFsDitLevels - 1.0, 1.0);
  float fsQ = floor(clamp(fsLum + (fsThr - 0.5), 0.0, 1.0) * fsLevels + 0.5) / fsLevels;

  // Rebuild as an INK / PAPER duotone in the surface's own hue. The old
  // tint * q rebuild sent lit cells to luminance 1.0 — on the paper-white
  // canvas those cells matched the background and the form dissolved
  // (the "lines" map rendered a nearly invisible cream stroke). Capping the
  // light end at 0.9 keeps every mark attached to the form.
  float fsSrcLum = dot(fsCol, vec3(0.2126, 0.7152, 0.0722));
  vec3 fsTint = fsSrcLum > 0.001 ? fsCol / max(fsSrcLum, 0.001) : vec3(1.0);
  vec3 fsDithered = clamp(mix(fsTint * 0.045, fsTint * 0.9, fsQ), 0.0, 1.0);

  return fsStackBlend(fsCol, fsDithered, uFsDitBlend, uFsDitIntensity);
}
`

export const DITHER_COMMON_GLSL = DITHER_GLSL
