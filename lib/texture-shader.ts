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

/* ====================================================================== */
/* SHINE SWEEP — a positional travelling highlight band.                   */
/* ---------------------------------------------------------------------- */
/* The "Shine Sweep" animated material used to be a GLOBAL gloss wave      */
/* (every material param oscillating together), which reads as the whole   */
/* surface breathing, not as a shine PASSING OVER it. A real sweep is a    */
/* soft-edged band of highlight that TRAVELS across the form — that needs  */
/* per-fragment position, i.e. shader work, so it lives here next to the   */
/* texture injection and rides the same onBeforeCompile composer.          */
/*                                                                          */
/* Mechanism (two halves, both inside the band):                           */
/*   1. roughness/clearcoatRoughness are pulled toward mirror, so the band */
/*      is a region of REAL specular response — the studio rig and the     */
/*      analytic lights appear inside it and nowhere else.                 */
/*   2. a soft additive glow guarantees the band also reads on bone-matte  */
/*      presets (chalk/clay) whose env intensity is near zero.             */
/* The band position is a plain uniform animated by the CPU clock in       */
/* viewport-3d.tsx — same no-recompile / no-rebuild contract as texture.   */
/* ====================================================================== */

export interface SweepUniforms {
  /** Band strength 0..1 (0 = sweep off; already intensity-scaled by caller). */
  uFsSweepAmt: { value: number }
  /** Band center along the sweep axis, in NORMALIZED units (see below). */
  uFsSweepPos: { value: number }
  /** Band half-width (normalized units). */
  uFsSweepWidth: { value: number }
  /** Unit direction of travel in object-space XY. */
  uFsSweepDirX: { value: number }
  uFsSweepDirY: { value: number }
  /** Stroke bounds (object space) so the band position can be expressed in
   *  size-independent units: -1..1 spans the stroke regardless of how large
   *  the user drew. Without this the travel range is a guess that breaks on
   *  small or huge strokes. */
  uFsSweepCx: { value: number }
  uFsSweepCy: { value: number }
  uFsSweepR: { value: number }
}

export function createSweepUniforms(): SweepUniforms {
  return {
    uFsSweepAmt: { value: 0 },
    uFsSweepPos: { value: -10 },
    uFsSweepWidth: { value: 0.3 },
    uFsSweepDirX: { value: 0.87 },
    uFsSweepDirY: { value: 0.5 },
    uFsSweepCx: { value: 0 },
    uFsSweepCy: { value: 0 },
    uFsSweepR: { value: 1 },
  }
}

export const SWEEP_COMMON_GLSL = /* glsl */ `
uniform float uFsSweepAmt;
uniform float uFsSweepPos;
uniform float uFsSweepWidth;
uniform float uFsSweepDirX;
uniform float uFsSweepDirY;
uniform float uFsSweepCx;
uniform float uFsSweepCy;
uniform float uFsSweepR;

// Soft-edged band with a selectable half-width: 1 at the center line,
// feathering to 0 one half-width out. smoothstep has zero slope at both ends,
// so the band has no hard edge and no visible crease at its peak. Position is
// normalized by the stroke's bounding radius, so -1..1 always spans the
// drawing. Parameterized width so the caller can evaluate the band TWICE:
// once at full width (the broad glaze halo) and once tight (the hot core) —
// a real light pass has both, and the two-lobe profile is what finally made
// the sweep read at a glance instead of "detectable by diffing".
float fsSweepBandW(vec3 objPos, float w) {
  if (uFsSweepAmt <= 0.001) return 0.0;
  vec2 n = (objPos.xy - vec2(uFsSweepCx, uFsSweepCy)) / max(uFsSweepR, 0.0001);
  float along = dot(n, vec2(uFsSweepDirX, uFsSweepDirY));
  float d = abs(along - uFsSweepPos);
  return (1.0 - smoothstep(0.0, w, d)) * uFsSweepAmt;
}
`

/**
 * Injection point A (after <emissivemap_fragment>, BEFORE lighting): computes
 * the band once into `fsSweepB` for reuse, and adds the glow floor. Additive
 * light is what lets the sweep read on fully matte presets — a roughness dip
 * alone has nothing to mirror when envMapIntensity is ~0.05 (chalk).
 * The glow is deliberately modest: the specular half below carries the
 * "expensive" read on every glossy/metal preset.
 */
export const SWEEP_EMISSIVE_GLSL = /* glsl */ `
float fsSweepB = fsSweepBandW(vFsObjPos, uFsSweepWidth);
float fsSweepCore = fsSweepBandW(vFsObjPos, uFsSweepWidth * 0.38);
if (fsSweepB > 0.001) {
  float fsSweepLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  // Two-lobe glow. The HOT CORE is a genuinely bright streak on every body —
  // it clips toward paper-white on light presets (against the darkened glaze
  // halo from the lights-block diffuse eat) and blazes on dark ones. The old
  // single-lobe glow scaled down to ~0.17 on ceramic (0.10 + 0.55*(1-lum)),
  // which is why the sweep read as a faint warm tint instead of a light pass:
  // measured live, 10 frames across a cycle produced only 4 distinct images.
  // The core is luminance-INDEPENDENT at full strength: light bodies (ceramic
  // lum ~0.78) need MORE added light than dark ones to clip visibly above
  // their own near-white tone — a lum-scaled core measured near-invisible on
  // ceramic (peak frame diff 9.5 vs 46+ after). Only the soft halo keeps a
  // small dark-body bonus so ink's flanks glow without washing out.
  // Light bodies get an EXTRA core boost: their rendered tone sits on the
  // tonemapper's shoulder (~0.87 sRGB), so the core must push total radiance
  // past ~4 to clip visibly to paper-white. Measured on ceramic: core*1.7
  // still read as nothing (frame diff ~5) because the shoulder compressed it.
  totalEmissiveRadiance +=
    vec3(1.0, 0.99, 0.95) *
    (fsSweepCore * (1.7 + 2.6 * smoothstep(0.45, 0.85, fsSweepLum)) +
     fsSweepB * (0.08 + 0.30 * (1.0 - min(fsSweepLum, 1.0))));
}
`

/**
 * Injection point B (after <lights_physical_fragment>, where the material
 * struct's roughness values are finalized — same reasoning as the texture
 * roughness injection): inside the band the surface becomes near-mirror, so
 * the highlight is a real specular event with structure (the env rig, the key
 * light), not a flat painted stripe.
 */
export const SWEEP_LIGHTS_GLSL = /* glsl */ `
if (fsSweepB > 0.001) {
  float fsSweepK = min(fsSweepB * 1.4, 1.0);
  material.roughness = mix(material.roughness, 0.03, fsSweepK);
  // The band's F0 is pushed to full mirror. This is the contrast lever on
  // LIGHT bodies (gel/ceramic/chalk): an additive white glow vanishes on a
  // pale surface, but a mirror band reflects the env's bright slats AND its
  // dark room — structure with contrast in both directions.
  material.specularColor = mix(material.specularColor, vec3(1.0), fsSweepK);
  // Energy conservation, and the contrast lever on WHITE bodies: a mirror
  // reflects instead of scattering, so the band eats diffuse. On ceramic and
  // chalk this is what makes the band exist at all — their diffuse is so
  // bright that any additive term disappears into it, and their output sits
  // on the tonemapper's shoulder where a mild linear darkening compresses to
  // nothing (measured live: a 0.5 eat read as ~nothing on ceramic). The eat
  // therefore SCALES WITH BODY LUMINANCE: dark bodies keep their glow-driven
  // band, light bodies get a real glassy stripe gliding over the glaze.
  float fsSwLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  material.diffuseColor *=
    (1.0 - fsSweepK * mix(0.4, 0.9, smoothstep(0.2, 0.8, fsSwLum)));
  // LIGHT bodies are mirror-dominated (ceramic: env 1.8 at roughness 0.12), so
  // eating diffuse alone gets refilled by the env reflection — measured live,
  // the halo barely darkened (peak column diff ~30/255). The halo FLANKS
  // (band minus core) therefore also pull specular down on light bodies, so
  // the dark glaze dip really lands; the core keeps its mirror + emissive
  // clip, giving "dark wet flanks around a white-hot streak".
  float fsSwLight = smoothstep(0.45, 0.8, fsSwLum);
  float fsSwFlank = clamp(fsSweepK - fsSweepCore * 1.2, 0.0, 1.0);
  material.specularColor *= (1.0 - fsSwFlank * fsSwLight * 0.85);
  #ifdef USE_SHEEN
    // A wet shine kills the velvet locally: the sheen veil sits ON TOP of the
    // specular and was measured (live, softGel) to wash the band to nothing.
    material.sheenColor *= (1.0 - fsSweepK * 0.9);
  #endif
  #ifdef USE_CLEARCOAT
    material.clearcoat = max(material.clearcoat, min(fsSweepB * 1.2, 1.0));
    material.clearcoatRoughness = mix(material.clearcoatRoughness, 0.03, fsSweepK);
    // Flank damp AFTER the max() push, or the push would undo it.
    material.clearcoat *= (1.0 - fsSwFlank * fsSwLight * 0.7);
  #endif
}
`

/**
 * Iridescence thickness swirl (injected with the lights block; compiled only
 * for presets with iridescence > 0 via USE_IRIDESCENCE). Without a thickness
 * MAP three.js uses one uniform thickness for the whole surface, so the film
 * shows ONE hue head-on and only shifts on orbit — which is why the preset
 * read as "dark tube with a copper stripe". A real oil slick has uneven film
 * thickness, and every thickness is a different interference color. Two
 * octaves of the existing value noise swirl the thickness across the
 * min..max range, so several distinct hues band across the form at ONCE, at
 * stroke scale, from any angle. `material.iridescenceThickness` is finalized
 * in <lights_physical_fragment> and only READ in <lights_fragment_begin>
 * (evalIridescence), so overriding it here is safe and per-fragment.
 */
export const IRIDESCENCE_SWIRL_GLSL = /* glsl */ `
#ifdef USE_IRIDESCENCE
{
  float fsIriN = fsValueNoise(vFsObjPos.xy * 4.0) * 0.7
               + fsValueNoise(vFsObjPos.xy * 11.0) * 0.3;
  material.iridescenceThickness =
    mix(iridescenceThicknessMinimum, iridescenceThicknessMaximum, fsIriN);
}
#endif
`

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

/**
 * Some patterns vary along ONE axis only: scanlines and bands are functions of
 * co.y alone, and woodgrain and brushed are strongly y-dominant. Sliding such a
 * pattern along its INVARIANT axis produces literally zero visible motion — the
 * user picks "horizontal", the coordinate really does move, and the image does
 * not change by a single pixel. That is the worst kind of control: one that
 * responds to nothing.
 *
 * Rather than silently ignoring the choice, guarantee a component ACROSS the
 * varying axis while keeping the user's intended sense. "Horizontal" on
 * scanlines becomes a shallow diagonal: still reads as travelling sideways, but
 * the lines actually sweep.
 */
vec2 fsTravelDir(vec2 d, float type) {
  bool yVarying =
    (type > 2.5 && type < 4.5) ||   // scanlines, bands
    (type > 7.5 && type < 8.5) ||   // woodgrain
    (type > 9.5 && type < 10.5);    // brushed
  if (yVarying && abs(d.y) < 0.35) {
    float sx = d.x >= 0.0 ? 1.0 : -1.0;
    return normalize(vec2(d.x, 0.6 * sx));
  }
  return d;
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
  // Guaranteed to have a component across the pattern's varying axis, so no
  // direction choice can silently produce zero motion (see fsTravelDir).
  vec2 fsDir = fsTravelDir(vec2(uFsTexDirX, uFsTexDirY), uFsTexType);
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
