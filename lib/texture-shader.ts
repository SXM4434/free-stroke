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

/** Pattern index for the shader switch. 0 = off. */
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

float fsTexPattern(vec2 co, float type) {
  if (type < 1.5) {
    // grain: independent random value per tiny cell (film-grain speckle)
    return fsHash(floor(co * 14.0));
  } else if (type < 2.5) {
    // noise: smooth value noise, two octaves for a little character
    return 0.65 * fsValueNoise(co * 2.0) + 0.35 * fsValueNoise(co * 5.3);
  } else if (type < 3.5) {
    // scanlines: thin dark lines perpendicular to the travel direction
    float s = 0.5 + 0.5 * sin(co.y * 28.0);
    return smoothstep(0.35, 0.75, s);
  } else if (type < 4.5) {
    // bands: broad soft stripes
    return 0.5 + 0.5 * sin(co.y * 7.0);
  }
  // contour: thin lines where a smooth noise field crosses evenly spaced
  // levels — like elevation contours on a topo map. min(fr, 1-fr) is the
  // distance to the nearest level; smoothstep turns a thin distance band
  // into a line.
  float f = fsValueNoise(co * 1.4);
  float fr = fract(f * 5.0);
  return 1.0 - smoothstep(0.02, 0.14, min(fr, 1.0 - fr));
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
  diffuseColor.rgb *= clamp(1.0 + uFsTexIntensity * (fsPat - 0.5) * 1.6, 0.0, 2.5);
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
  float fsRough = (fsPat - 0.5) * uFsTexIntensity * 0.85;
  material.roughness = clamp(material.roughness + fsRough, 0.035, 1.0);
  #ifdef USE_CLEARCOAT
    material.clearcoatRoughness = clamp(material.clearcoatRoughness + fsRough, 0.035, 1.0);
  #endif
}
`
