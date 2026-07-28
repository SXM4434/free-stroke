/**
 * Procedural texture v1 — shader-level surface patterning for the shared
 * preview material (POST_MVP_TEXTURE_AND_ANIMATED_TEXTURE_PHASE_1).
 *
 * WHY SHADER INJECTION (onBeforeCompile) AND NOT IMAGE/UV TEXTURES:
 * Solid and Inflate geometry is generated from raster masks and lofts and has
 * no meaningful UV parameterization; a `material.map` would smear or fail on
 * those modes. Injecting pattern math into the built-in MeshPhysicalMaterial
 * fragment shader lets patterns be computed from OBJECT-SPACE POSITION (sticks
 * to the geometry, works with zero UVs, stable under camera orbit) or from
 * SCREEN SPACE (gl_FragCoord — a graphic overlay feel), matching
 * `textureLockMode: "object" | "screen"`.
 *
 * WHY ONE SHADER WITH A TYPE UNIFORM (not one shader per type):
 * All five patterns live behind `uFsTexType` (a float uniform used as an
 * integer switch). Changing pattern type / scale / intensity / animation only
 * writes uniform values — the GLSL program never recompiles, the material is
 * never replaced, and geometry is never rebuilt. This satisfies the phase gate
 * "changing style state updates preview without rebuilding geometry".
 *
 * Technique references (documented in docs/research/texture-phase.md):
 * - onBeforeCompile chunk replacement + userData uniforms (pailhead/Dusan
 *   Bosnjak, "Extending three.js materials with GLSL")
 * - hash/value-noise one-liners (patriciogonzalezvivo GLSL noise gist,
 *   The Book of Shaders ch. 11)
 */
import type * as THREE from "three"
import type { TextureMode } from "./style-system"

/** Pattern index for the shader switch. 0 = off.
 * HARD RULE: indices are append-only — saved states store these numbers, so an
 * existing pattern's index must never change meaning. New patterns go on the
 * end. */
export const TEXTURE_TYPE_INDEX: Record<TextureMode, number> = {
  none: 0,
  grain: 1,
  // "procedural" is the legacy umbrella entry in TextureMode; render it as
  // smooth value noise, the most generic procedural pattern.
  procedural: 2,
  noise: 2,
  scanlines: 3,
  bands: 4,
  contour: 5,
  crosshatch: 6,
  dots: 7,
  woodgrain: 8,
  cellular: 9,
  brushed: 10,
  craquelure: 11,
  ripple: 12,
}

export interface TextureUniforms {
  uFsTexType: { value: number }
  uFsTexScale: { value: number }
  uFsTexIntensity: { value: number }
  uFsTexContrast: { value: number }
  /** Accumulated animation phase (already speed-scaled by the caller). */
  uFsTexTime: { value: number }
  /** Unit direction the animated pattern travels along. */
  uFsTexDirX: { value: number }
  uFsTexDirY: { value: number }
  /** 1 = screen-space (gl_FragCoord), 0 = object-space (position varying). */
  uFsTexLockScreen: { value: number }
}

export function createTextureUniforms(): TextureUniforms {
  return {
    uFsTexType: { value: 0 },
    uFsTexScale: { value: 1 },
    uFsTexIntensity: { value: 0.5 },
    uFsTexContrast: { value: 0.5 },
    uFsTexTime: { value: 0 },
    uFsTexDirX: { value: 1 },
    uFsTexDirY: { value: 0 },
    uFsTexLockScreen: { value: 0 },
  }
}

/**
 * GLSL pattern library injected into <common>. All functions return a pattern
 * value in [0,1].
 *
 * fsHash — "random" from a 2D coordinate: sin/dot spreads the input across a
 * huge range, fract keeps only the fast-wrapping fractional part, which looks
 * uncorrelated (classic GPU hash; not statistically perfect, visually fine).
 *
 * fsValueNoise — value noise: hash the four integer grid corners around the
 * point, then blend with a smoothstep-eased bilinear mix so cells flow into
 * each other instead of showing hard squares.
 */
export const TEXTURE_COMMON_GLSL = /* glsl */ `
uniform float uFsTexType;
uniform float uFsTexScale;
uniform float uFsTexIntensity;
uniform float uFsTexContrast;
uniform float uFsTexTime;
uniform float uFsTexDirX;
uniform float uFsTexDirY;
uniform float uFsTexLockScreen;

float fsHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float fsValueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f); // smoothstep easing per axis
  float a = fsHash(i);
  float b = fsHash(i + vec2(1.0, 0.0));
  float c = fsHash(i + vec2(0.0, 1.0));
  float d = fsHash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

// Worley/Voronoi: distance to the nearest (x) and second-nearest (y) of a set
// of jittered feature points. F1 alone gives organic cells; F2-F1 is small
// exactly on the border between two cells, which draws a connected crack web.
vec2 fsVoronoi(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = vec2(fsHash(i + g), fsHash(i + g + vec2(19.7, 7.3)));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1) { f2 = f1; f1 = d; }
      else if (d < f2) { f2 = d; }
    }
  }
  return vec2(sqrt(f1), sqrt(f2));
}

float fsTexPattern(vec2 co, float type) {
  if (type < 1.5) {
    // grain: independent random value per tiny cell (film-grain speckle).
    // The extra floor(time)-seeded term re-rolls every cell a few times a
    // second when animated: real film grain re-randomizes rather than
    // sliding, and pure translation of speckle this fine reads as static.
    return fsHash(floor(co * 14.0) + floor(uFsTexTime * 5.0) * 7.31);
  } else if (type < 2.5) {
    // noise: value noise, three octaves, re-expanded around mid-gray.
    // Summed value noise crowds into ~0.3..0.7 — visually "flat gray" — so
    // the 1.9x expansion restores a full-range field before contrast runs.
    float n = 0.55 * fsValueNoise(co * 2.0)
            + 0.30 * fsValueNoise(co * 5.3)
            + 0.15 * fsValueNoise(co * 11.7);
    return clamp((n - 0.5) * 1.9 + 0.5, 0.0, 1.0);
  } else if (type < 3.5) {
    // scanlines: thin dark lines perpendicular to the travel direction
    float s = 0.5 + 0.5 * sin(co.y * 28.0);
    return smoothstep(0.35, 0.75, s);
  } else if (type < 4.5) {
    // bands: broad stripes with a defined edge. The raw sine was a shapeless
    // gray gradient; shaping it keeps the stripe WIDE but gives it a real
    // boundary to see (and to watch move).
    float b = 0.5 + 0.5 * sin(co.y * 7.0);
    return smoothstep(0.30, 0.70, b);
  } else if (type < 5.5) {
    // contour: thin lines where a smooth noise field crosses evenly spaced
    // levels — like elevation contours on a topo map. min(fr, 1-fr) is the
    // distance to the nearest level; smoothstep turns a thin distance band
    // into a line.
    float f = fsValueNoise(co * 1.4);
    float fr = fract(f * 5.0);
    return 1.0 - smoothstep(0.03, 0.18, min(fr, 1.0 - fr));
  } else if (type < 6.5) {
    // crosshatch: two crossing diagonal line families, like pen shading.
    // Distinct from scanlines (one family, axis-aligned): the ±45° cross
    // weave reads as hand-hatched ink.
    float a = 0.5 + 0.5 * sin((co.x + co.y) * 18.0);
    float b = 0.5 + 0.5 * sin((co.x - co.y) * 18.0);
    float ha = smoothstep(0.55, 0.85, a);
    float hb = smoothstep(0.55, 0.85, b);
    return 1.0 - max(ha, hb);
  } else if (type < 7.5) {
    // dots: a fixed grid of soft ink dots with per-cell size jitter. This is
    // TEXTURE (a printed dot pattern on the surface), not dither — dot size
    // never encodes tone, and it never thresholds the shaded result.
    vec2 cell = floor(co * 6.0);
    vec2 g = fract(co * 6.0) - 0.5;
    float jr = 0.16 + fsHash(cell) * 0.12;
    return 1.0 - smoothstep(jr, jr + 0.14, length(g));
  } else if (type < 8.5) {
    // woodgrain: long parallel grain lines warped by low-frequency noise so
    // they wander and pinch like cut timber. The warp is what separates this
    // from bands/scanlines — the lines are organic, not straight.
    float warp = fsValueNoise(vec2(co.x * 0.5, co.y * 1.3)) * 6.0;
    float rings = 0.5 + 0.5 * sin(co.y * 9.0 + warp);
    return smoothstep(0.25, 0.8, rings);
  } else if (type < 9.5) {
    // cellular: Worley F1 — organic cell interiors with soft bright walls.
    // Distinct from value noise (blobs with no structure): these are packed
    // cells with visible boundaries, like foam or skin.
    return clamp(fsVoronoi(co * 3.0).x * 1.25, 0.0, 1.0);
  } else if (type < 10.5) {
    // brushed: anisotropic streaks — fast variation across the streak axis,
    // almost none along it, like brushed metal. Two octaves so the streaks
    // have both body and fine tooth.
    float s = 0.6 * fsValueNoise(vec2(co.x * 0.9, co.y * 26.0))
            + 0.4 * fsValueNoise(vec2(co.x * 2.2, co.y * 60.0));
    return clamp((s - 0.5) * 2.2 + 0.5, 0.0, 1.0);
  } else if (type < 11.5) {
    // craquelure: Worley F2-F1 is ~0 exactly on cell borders, drawing a
    // connected web of thin cracks — old varnish / dried glaze. Unlike
    // contour (level lines of one noise field) the cracks form closed
    // polygons that meet at junctions.
    vec2 v = fsVoronoi(co * 2.6);
    return smoothstep(0.0, 0.10, v.y - v.x);
  }
  // ripple: two radial wave sources interfering. Reads as water rings /
  // moiré — no other pattern is radial. uFsTexTime also drives the radial
  // phase directly, so animation makes rings RADIATE outward from the
  // sources instead of the whole sheet merely sliding.
  float r1 = length(co - vec2(1.8, 0.6));
  float r2 = length(co + vec2(1.4, 1.0));
  float w = sin(r1 * 16.0 - uFsTexTime * 2.4) + sin(r2 * 16.0 - uFsTexTime * 2.4);
  return 0.5 + 0.35 * w * 0.5;
}
`

/** Fragment injection A: pattern value + albedo modulation (needs diffuseColor). */
export const TEXTURE_MAP_GLSL = /* glsl */ `
float fsPat = 0.0;
if (uFsTexType > 0.5) {
  // Coordinate: object-space (world-ish units, word spans ~3) or screen px.
  vec2 fsCo = uFsTexLockScreen > 0.5
    ? gl_FragCoord.xy * 0.012
    : vFsObjPos.xy * 4.0;
  vec2 fsDir = vec2(uFsTexDirX, uFsTexDirY);
  fsCo = fsCo * uFsTexScale + fsDir * uFsTexTime;
  fsPat = fsTexPattern(fsCo, uFsTexType);
  // Contrast: expand/compress the pattern around mid-gray.
  fsPat = clamp((fsPat - 0.5) * (0.4 + uFsTexContrast * 2.6) + 0.5, 0.0, 1.0);
  // BIDIRECTIONAL albedo modulation (lift AND darken around the base).
  // Darken-only was invisible on the near-black presets: multiplying an
  // almost-black albedo by <1 stays almost-black. Allowing the pattern to
  // lift as well gives marks somewhere to go on dark ink.
  // Gain raised 1.6 → 2.4 after live judging: at 1.6 every preset needed
  // intensity near 1.0 just to be seen at viewport stroke sizes.
  diffuseColor.rgb *= clamp(1.0 + uFsTexIntensity * (fsPat - 0.5) * 2.4, 0.0, 3.0);
}
`

/**
 * Fragment injection B: specular response.
 * The pattern must also break up the SPECULAR response, not just albedo. On
 * glossy near-black presets (Extrude's default) almost all visible light is the
 * specular/clearcoat lobe — an albedo-only pattern reads as nothing there.
 * `lights_physical_fragment` is where `material.roughness` and
 * `material.clearcoatRoughness` are finalized, so modulating them right after
 * it makes the highlight itself carry the pattern.
 */
export const TEXTURE_LIGHTS_GLSL = /* glsl */ `
if (uFsTexType > 0.5) {
  // Swing raised 0.85 → 1.3 after live judging: on presets that are already
  // rough (clay ~1.0) a positive-only swing has nowhere to go, and ±0.42 was
  // too small to pull a glossy highlight out of a matte base. At 1.3 the
  // pattern can carry a matte surface all the way to a visible highlight.
  float fsRough = (fsPat - 0.5) * uFsTexIntensity * 1.3;
  material.roughness = clamp(material.roughness + fsRough, 0.035, 1.0);
  #ifdef USE_CLEARCOAT
    material.clearcoatRoughness = clamp(material.clearcoatRoughness + fsRough, 0.035, 1.0);
  #endif
}
`
