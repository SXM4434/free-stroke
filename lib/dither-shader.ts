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
  // lines: threshold ramps across the cell -> marks grow as thickening lines.
  return fract(co.y);
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

  // Coordinate for the threshold tile.
  vec2 fsDCo = uFsDitLockScreen > 0.5
    ? gl_FragCoord.xy / max(uFsDitScale, 0.05)
    : vFsObjPos.xy * (26.0 / max(uFsDitScale, 0.05));
  fsDCo += vec2(uFsDitDirX, uFsDitDirY) * uFsDitTime;

  float fsThr = fsDitherThreshold(fsDCo, uFsDitType);

  // Perceived brightness (Rec. 709 luma weights: the eye is far more
  // sensitive to green than to blue).
  float fsLum = dot(fsCol, vec3(0.2126, 0.7152, 0.0722));

  // Contrast about mid-grey, then the user's threshold bias.
  fsLum = clamp((fsLum - 0.5) * (0.5 + uFsDitContrast * 3.0) + 0.5, 0.0, 1.0);
  fsLum += (uFsDitThreshold - 0.5);

  // THE DITHER STEP: offset by the centred threshold, then quantize.
  float fsLevels = max(uFsDitLevels - 1.0, 1.0);
  float fsQ = floor(clamp(fsLum + (fsThr - 0.5), 0.0, 1.0) * fsLevels + 0.5) / fsLevels;

  // Rebuild colour: keep the surface's hue, drive its value from the
  // quantized tone. Fully desaturating would make every material identical.
  float fsSrcLum = dot(fsCol, vec3(0.2126, 0.7152, 0.0722));
  vec3 fsTint = fsSrcLum > 0.001 ? fsCol / max(fsSrcLum, 0.001) : vec3(1.0);
  vec3 fsDithered = clamp(fsTint * fsQ, 0.0, 1.0);

  return fsStackBlend(fsCol, fsDithered, uFsDitBlend, uFsDitIntensity);
}
`

export const DITHER_COMMON_GLSL = DITHER_GLSL
