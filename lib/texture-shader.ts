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
  /** Texture Animation type: 0 travel, 1 pulse, 2 sheen, 3 boil (TEXTURE_ANIMATION_TYPES order). */
  uFsTexAnimType: { value: number }
  /**
   * DARK-BODY BOOST — 1 = shipping, 0 = the behaviour parked on 2026-08-01.
   *
   * Every term it scales is additive, so 0 restores the prior render EXACTLY
   * rather than approximately; that is what makes it a park and not a tuning
   * knob. See the DARK-BODY block in TEXTURE_MAP_GLSL for what it buys and the
   * measurement that made it necessary.
   */
  uFsTexDarkBoost: { value: number }
  /**
   * RIPPLE, PARKED — 1 = the behaviour before 2026-08-01, 0 = shipping.
   *
   * Ripple's two ring families used to radiate in the SAME sense, and that is
   * what made one travel direction able to freeze it. See the counter-rotation
   * note in fsTexPattern's ripple branch for the arithmetic.
   */
  uFsTexRipplePrior: { value: number }
  /**
   * GRAIN LATTICE, PARKED — 1 = the fixed 26-cells-per-unit lattice from before
   * 2026-08-01, 0 = shipping (the lattice is chosen from the pixel footprint).
   * See the lattice note in fsTexPattern's grain branch.
   */
  uFsTexGrainLodPrior: { value: number }
  /**
   * SURFACE RELIEF — the pattern perturbs the shading normal, so the specular
   * lobe is BENT by the pattern instead of only being dimmed by it.
   *
   * 0 is the parked prior and restores the pre-2026-08-01 render EXACTLY: every
   * term this scales is a perturbation added to a normal, and at 0 the normal is
   * returned unchanged rather than approximately unchanged. See the RELIEF block
   * in TEXTURE_LIGHTS_GLSL for the mechanism and the measurement.
   */
  uFsTexBump: { value: number }
}

/* Every live uniform set, so a dev harness can drive `uFsTexDarkBoost` across
 * all of them at once. `viewport-3d` creates exactly one per mount and shares it
 * by reference into `shader.uniforms`, so writing here reaches the GPU on the
 * next frame with no recompile — the same no-rebuild contract the rest of this
 * file keeps. WeakRefs are not used deliberately: the set is tiny (one entry per
 * viewport) and a stale entry is a dead object nobody reads. */
const LIVE_TEXTURE_UNIFORMS = new Set<TextureUniforms>()

export function createTextureUniforms(): TextureUniforms {
  const u: TextureUniforms = {
    uFsTexType: { value: 0 },
    uFsTexScale: { value: 1 },
    uFsTexIntensity: { value: 0.5 },
    uFsTexContrast: { value: 0.5 },
    uFsTexTime: { value: 0 },
    uFsTexDirX: { value: 1 },
    uFsTexDirY: { value: 0 },
    uFsTexLockScreen: { value: 0 },
    uFsTexAnimType: { value: 0 },
    uFsTexDarkBoost: { value: 1 },
    uFsTexRipplePrior: { value: 0 },
    uFsTexGrainLodPrior: { value: 0 },
    /* CHOSEN FROM A SWEEP, NOT GUESSED, and 0 is the parked prior. The real
     * capture was shot at 0 / 0.3 / 0.6 / 1.0
     * (docs/verification/screen-layers/lane14-park, -b0.3, -b0.6, -b1.0) and the
     * macro crops composed at 3x for the eye
     * (docs/verification/texture-relief/pick/). 0.6 is where Rod's rail clears
     * the "reads" line with the returns already flattening — 1.0 buys 0.2-0.9
     * more dOff on most presets — and where the patterns still read as
     * THEMSELVES rather than as generic roughness. The amplitude is Sebs's call;
     * the sheet is there so it can be his. */
    uFsTexBump: { value: 0.6 },
  }
  LIVE_TEXTURE_UNIFORMS.add(u)
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    /* THE PARK, REACHABLE. A shader constant with no control is not parked, it
     * is deleted — so the prior behaviour is one call away and a verification
     * script can measure BOTH arms in one run. Returns the previous value. */
    ;(window as unknown as Record<string, unknown>).__textureShaderHarness = {
      setDarkBoost: (v: number) => {
        let was = 1
        for (const s of LIVE_TEXTURE_UNIFORMS) {
          was = s.uFsTexDarkBoost.value
          s.uFsTexDarkBoost.value = v
        }
        return was
      },
      getDarkBoost: () => [...LIVE_TEXTURE_UNIFORMS].map((s) => s.uFsTexDarkBoost.value),
      /** Generic: park/unpark any of this file's arms by uniform name. */
      set: (name: string, v: number) => {
        let was = null
        for (const s of LIVE_TEXTURE_UNIFORMS) {
          const slot = (s as unknown as Record<string, { value: number }>)[name]
          if (!slot) return null
          was = slot.value
          slot.value = v
        }
        return was
      },
      get: (name: string) =>
        [...LIVE_TEXTURE_UNIFORMS].map(
          (s) => (s as unknown as Record<string, { value: number }>)[name]?.value ?? null,
        ),
    }
  }
  return u
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
uniform float uFsTexAnimType;
/* TREE REPAIR, NOT THIS LANE'S FEATURE - added 2026-08-01 by the hero-beat lane,
 * which does not own this file. Read this before re-adding the line.
 *
 * The uFsTexDarkBoost work (213 lines, in flight at 01:43) had landed the
 * uniform in TextureUniforms, in the uniforms object, in the dev harness
 * setter/getter and TWICE in the GLSL body - but not this DECLARATION. Without
 * it the fragment shader does not compile: VALIDATE_STATUS false, Material Type
 * MeshPhysicalMaterial, "uFsTexDarkBoost : undeclared identifier".
 *
 * The material then fails and the hero word renders NOTHING - measured ink 0 on
 * every frame while "no page errors" was reported, because a shader link failure
 * is a console error and not a page error. That state took out SEVEN browser
 * asserts plus verify-gates.mjs at once, all of them looking like regressions in
 * a completely unrelated lane.
 *
 * Placed to match the order of the uniforms object above (it is the entry after
 * uFsTexLockScreen there too). If the owning lane returns: this line is already
 * present - do not add a second one, that is also a compile error.
 *
 * NO BACKTICKS ANYWHERE IN THIS COMMENT. It sits inside TEXTURE_COMMON_GLSL,
 * which is a template literal; a backtick here terminates the string and breaks
 * the whole module. That is documented as having broken this app four times and
 * it broke it a fifth time while this very comment was being written. */
uniform float uFsTexDarkBoost;
uniform float uFsTexRipplePrior;
uniform float uFsTexGrainLodPrior;
uniform float uFsTexBump;

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

/**
 * FEATURE PERIOD PER PATTERN, in the same 'co' units fsTexPattern receives.
 *
 * WHY THIS EXISTS — the texture rail's version of the defect that broke the
 * dither rail, arriving from the opposite direction.
 *
 * (NB: no backticks anywhere in this comment — it lives inside a GLSL template
 * literal, so one backtick would terminate the string and break the build.)
 *
 * Animation offsets co by dir * uFsTexTime, and uFsTexTime is
 * textureSpeed * 1.2 * t — ONE global travel rate in co units per second,
 * shared by twelve patterns whose feature periods span 0.031 (contour lines) to
 * 0.419 (bands). A 14x range. So a single speed value cannot mean the same tempo
 * on two different patterns, and nothing in the rail was normalising it.
 *
 * Measured live at 120 Hz over a native-resolution crop of the densest ink
 * (docs/verification/layer-flicker/texpass-before/), with the eye check on
 * ADJACENT frames rather than a 0.2s strip:
 *
 *   preset            per-frame Δ   travelRat   what the frames show
 *   Contour Flow            29.7        1.63    a DIFFERENT field every frame
 *   Scanline Scroll         23.5        4.49    stripes jump ~1/3 period/frame
 *   Ripple Radiate          14.7        5.64    shimmer
 *   Dot Stream              13.7        3.62    shimmer
 *   Cell Flow                9.8        4.86    shimmer
 *   -- for scale, the dither rail AFTER its pass --
 *   Dither Crawl             3.3       23.03    a slow, trackable drift
 *
 * travelRat is span/jumpD: how far the effect gets, in units of one frame's
 * change. At 1.63 the pattern changes almost as much between two consecutive
 * frames as it EVER gets from where it started — that is a re-roll, not travel,
 * and it is the same "no speed makes this smooth" wall the ordered dither hit.
 * Contour Flow was translating 52% of a contour-line period per frame, i.e. past
 * the temporal Nyquist limit, so its direction of travel is not even defined.
 *
 * THE FIX IS NOT NINE HAND-TUNED SPEED NUMBERS. It is to make the control mean
 * something: travel is scaled by the pattern's own feature period, so
 * uFsTexTime counts FEATURE PERIODS rather than co units and textureSpeed
 * means the same tempo on every pattern. A future pattern added to this family
 * then cannot silently ship at 90x the rail's tempo, which is what happened here.
 *
 * THE TARGET TEMPO IS BORROWED, NOT INVENTED. Dither Crawl (1.5 lattice
 * periods/s) and Diagonal Screen Drift (1.8 hatch periods/s) were tuned by eye
 * in a headed window during the dither pass and both measure travelRat ~23. So
 * 1.2-2.0 feature-periods per second is a tempo this project has already
 * accepted by looking at it, and after normalisation textureSpeed 1.0-1.7 lands
 * there for every pattern in the family.
 *
 * The periods below are read straight off fsTexPattern:
 *   sin(co.y * k)  -> 2*pi/k        fract-of-cell at k cells/unit -> 1/k
 * contour is the one that needs deriving: its lines are level sets of
 * valueNoise(co*3.6) at 9 levels, so the line spacing is (1/9) / |df/dco| and
 * |df/dco| ~ 3.6 for unit-amplitude value noise at that cell size, giving 0.031.
 */
/* THE GRAIN LATTICE, IN ONE PLACE.
 *
 * Extracted verbatim from fsTexPattern's grain branch (arithmetic unchanged, and
 * the extraction is asserted against the parked prior) so the RELIEF block can
 * ask the same question the pattern answered: at this pixel footprint, which
 * lattice did grain actually draw? The relief normalises by the pattern's own
 * feature period, and grain is the one pattern whose period is NOT the authored
 * constant — the LOD picks it from the footprint. Two copies of that arithmetic
 * would drift the first time either moved. */
/* THE 0.5 IS TWO DEVICE PIXELS PER CELL, and it was TESTED AS A SUSPECT AND
 * CLEARED — recorded here so the next lane does not spend the afternoon this one
 * did.
 *
 * Fine Grain is the weakest cell on the whole board (Rod, dOff 1.48 against a
 * 2.0 floor), and "two pixels is Nyquist, not legibility" is a good theory: this
 * repo settled the same question on the glyph layer, where
 * docs/explainers/15-screen-layer-quality.md §2 derives "a 1-bit stroke needs an
 * on-off-on triple to survive, so ~3 device pixels per glyph pixel". A speckle is
 * a 1-bit mark by the same argument.
 *
 * MEASURED ANYWAY, because a good theory is not a result. The floor was made a
 * uniform and swept 2 / 4 / 6 / 9 device pixels through the real capture
 * (docs/verification/screen-layers/lane14-px{4,6,9}, relief held at 0.6): Rod
 * Fine Grain read 2.29 / 2.18 / 2.11 / 2.22. It does not move, and at 9 px the
 * 3x crop reads as blotchy dirt rather than grain. The floor is not the lever,
 * so the uniform was removed rather than shipped as a dial that does nothing.
 *
 * What DID move it was relief (1.48 -> 2.29 at the same setting), and what is
 * still true is that Fine Grain clears the perceptual floor and does not reach
 * the 5.0 "reads" line the other eleven presets now clear. */
float fsGrainCell(float foot) {
  float base = 26.0;
  float f = max(foot, 1e-5);
  float steps = max(0.0, ceil(log2(max(1.0, f * base / 0.5))));
  return max(mix(base / exp2(steps), base, uFsTexGrainLodPrior), 3.0);
}

float fsTexPeriod(float type) {
  if (type < 1.5) return 0.0385;       // grain: 26 cells/unit
  if (type < 2.5) return 0.2;          // noise: base octave 5
  if (type < 3.5) return 0.2244;       // scanlines: 2pi/28
  if (type < 4.5) return 0.4189;       // bands: 2pi/15
  if (type < 5.5) return 0.031;        // contour: 9 levels of a 3.6 field
  if (type < 6.5) return 0.2467;       // crosshatch: 2pi/18 across the 45deg weave
  if (type < 7.5) return 0.1667;       // dots: 6 cells/unit
  if (type < 8.5) return 0.30;         // woodgrain: one growth ring per 0.30 co
                                       // units (the re-author, 2026-08-04 — the
                                       // old 0.2856 was 2pi/22 and described a
                                       // sine that no longer exists)
  if (type < 9.5) return 0.2222;       // cellular: 4.5 cells/unit
  if (type < 10.5) return 0.0385;      // brushed: dominant y octave 26
  if (type < 11.5) return 0.3846;      // craquelure: 2.6 cells/unit
  return 0.1848;                       // ripple: 2pi/34
}

/**
 * THE PERIOD THE PATTERN IS ACTUALLY DRAWING AT THIS PIXEL, which is not always
 * the authored one.
 *
 * fsTexPeriod is the AUTHORED period and it normalises TRAVEL, so it must not
 * move — changing it changes every animated preset's tempo. But grain chooses
 * its lattice from the pixel footprint (see the LATTICE note in the grain
 * branch), so on a form small enough to trigger the LOD its real period is
 * coarser than 1/26 by a power of two. The relief scales by feature period, so
 * handing it the authored number would understate grain's relief by exactly that
 * factor — on Rod, the mode where grain is already the weakest preset on the
 * rail. Every other pattern's period is a constant and passes straight through.
 */
float fsTexPeriodLocal(float type, float foot) {
  if (type < 1.5) return 1.0 / fsGrainCell(foot);
  return fsTexPeriod(type);
}

/**
 * HOW FAR THE RELIEF LOOKS TO FIND A SLOPE, as a fraction of the feature period.
 *
 * This is the relief's smoothing radius, and it is one number per pattern for a
 * reason that is visible in the render rather than aesthetic.
 *
 * MOST of these patterns are continuous or have anti-aliased edges a pixel or
 * two wide, so a step of 0.3 of a period lands on the slope of a feature most of
 * the time and returns a real gradient. Grain does not: it is
 * PIECEWISE CONSTANT — one hash value per lattice cell, with a zero-width wall
 * between cells. A step shorter than a cell lands in the SAME cell and returns
 * exactly zero, so the relief fires only on the few fragments whose step happens
 * to straddle a wall.
 *
 * MEASURED, at 0.3 for everything: on Rod, Fine Grain went 1.40 -> 2.21 across a
 * relief sweep from 0 to 1 while every other preset roughly doubled
 * (docs/verification/texture-relief/sweep.json). At the preset's own scale a
 * grain cell is about 5 device pixels and 0.3 of a period is 0.7 of one, so
 * roughly 86% of fragments were measuring the slope of a flat plateau. The few
 * that were not got a near-maximum tilt, which is salt-and-pepper, not relief.
 *
 * For a piecewise-constant field the meaningful slope is the height difference
 * to the NEIGHBOURING cell, so grain steps a full period. That gives every cell
 * its own facet orientation — a sandblasted surface, which is what a grain
 * relief on a glossy body should be.
 */
float fsTexReliefStep(float type) {
  if (type < 1.5) return 1.0;    // grain: one whole cell — see above
  return 0.3;
}

/**
 * FEATURE SIZE vs SUBJECT SIZE — the reason six of these twelve patterns read
 * as "a tonal gradient" rather than as a pattern.
 *
 * The subject is not a wall, it is a RIBBON. Measured on the live preview
 * (docs/verification/style-craft), the stroke is about 1.3 units wide in the
 * 'co' space these functions receive. Any pattern whose feature size is a
 * sizeable fraction of that has fewer than two features across the form, and
 * two features is not a pattern — it is a gradient. That single number
 * explains the whole weak half of the family at once: noise (feature 0.50),
 * bands (0.90), contour (~0.7), woodgrain (0.70), cellular (0.33) and ripple
 * (0.39) were all at or above a third of the ribbon's width, and every one of
 * them rendered as soft blobs or one broad tonal step. The strong half —
 * scanlines (0.22), crosshatch (0.35 at 45°, so ~0.25 across), dots (0.17),
 * grain (0.07), brushed (0.10), craquelure (thin lines, size-independent) —
 * were all below it.
 *
 * Target adopted here: 4–8 features across the ribbon, i.e. feature size
 * 0.16–0.33 co units. The retuned frequencies below all land in that band.
 *
 * ANTI-ALIASING. None of these were filtered. A procedural pattern has no
 * mipmaps, so once a feature is smaller than a pixel it aliases and, under
 * motion, crawls. The standard fix is to widen every smoothstep edge by the
 * pixel footprint of the value being thresholded, fwidth(x), and to fade an
 * octave out entirely once its period drops below a pixel (Ben Golus, "The
 * Best Darn Grid Shader (Yet)"; OpenGL Orange Book §17.4, antialiased stripes).
 */
float fsAAStep(float lo, float hi, float x) {
  // smoothstep whose edge is never narrower than one pixel of x.
  float w = fwidth(x);
  return smoothstep(lo - w, hi + w, x);
}

float fsTexPattern(vec2 co, float type) {
  if (type < 1.5) {
    // grain: independent random value per tiny cell (film-grain speckle).
    // The extra floor(time)-seeded term re-rolls every cell a few times a
    // second when animated: real film grain re-randomizes rather than
    // sliding, and pure translation of speckle this fine reads as static.
    // 14 -> 26: at 14 the cells rendered as chunky digital blocks rather than
    // grain (docs/verification/style-craft/sheets/solid_texture_macro.png).
    // Below one cell per pixel the speckle is pure aliasing, so fade it toward
    // flat as the footprint closes on the cell.
    // THE RE-ROLL TICK IS PER CELL, NOT PER FRAME.
    //
    // This used to be floor(uFsTexTime * 5.0) — ONE global tick, so every cell in
    // the field re-rolled on the same frame. At the preset's own speed (1.2, so
    // uFsTexTime advances 1.44/s) that is a 7.2 Hz whole-field re-randomisation:
    // dead centre of the 4-20 Hz band the eye reads as flicker rather than
    // motion, and structurally the same defect characterCycle was fixed for
    // (every cell passing through the ramp's blank glyph on the same frame, i.e.
    // a full-frame flash). Measured before the fix: mean per-frame Δ 7.9 with a
    // max of 19.6 — the max is the tick, the mean is everything else.
    //
    // Offsetting the tick by a per-cell hash keeps the average boil rate and the
    // per-cell look identical while spreading the re-rolls across all frames, so
    // the FIELD never changes all at once. And 5 -> 16 puts a single cell's own
    // re-roll at ~23 Hz at default speed, which is film's own boil rate (24 fps)
    // rather than a sixth of it — the rate is the whole reason a projected grain
    // field reads as texture instead of as strobing.
    /* THE LATTICE IS CHOSEN, NOT FIXED — and this is why Fine Grain measured
     * 0.93 on Rod against 10.9 on Solid.
     *
     * The 26-cells-per-unit lattice is sized for a form that fills the frame.
     * Rod is a TUBE: at the same preset scale it occupies a fraction of the
     * screen the Solid mask does, so fwidth(co.x) is several times larger, the
     * fade below drives straight to 0 and fsTexPattern returns exactly 0.5 —
     * flat, no modulation, nothing to see. The guard was doing its job; a
     * sub-pixel speckle IS pure aliasing and must not be drawn. But "the
     * pattern is unresolvable at this size" and "the pattern is absent" are
     * different answers, and only one of them is what Fine Grain promises.
     *
     * So pick the LATTICE the way a mip chain picks a level: the finest one
     * that still lands at least two pixels per cell, in POWER-OF-TWO steps down
     * from 26 so the choice is stable across a surface instead of sliding
     * per-fragment (a continuously varying cell size swims under camera motion,
     * which is the defect the fade exists to avoid, wearing different clothes).
     * On a form large enough to resolve 26/unit this is exactly 26 and the
     * render is unchanged; on Rod it drops to the next rung and the speckle
     * becomes coarse-but-present rather than absent.
     *
     * Ben Golus, "The Best Darn Grid Shader (Yet)" — the same source the fade
     * itself is credited to — makes the same move for the same reason: fade the
     * octave you cannot resolve, and draw the one you can.
     *
     * uFsTexGrainLodPrior = 1 pins the lattice at 26 verbatim.
     *
     * The arithmetic moved into fsGrainCell (same expression, same order) so the
     * relief block can ask which lattice was chosen; the floor of 3 cells/unit
     * lives there too — below that the speckle stops being grain and becomes a
     * checkerboard, and at that point flat is honest. */
    float fsGCell = fsGrainCell(fwidth(co.x));
    float fsGFade = 1.0 - smoothstep(0.5, 1.2, fwidth(co.x) * fsGCell);
    vec2 fsGC = floor(co * fsGCell);
    float fsGTick = floor(uFsTexTime * 16.0 + fsHash(fsGC + 3.7) * 8.0);
    float g = fsHash(fsGC + fsGTick * 7.31);
    return mix(0.5, g, fsGFade);
  } else if (type < 2.5) {
    // noise: value noise, three octaves, re-expanded around mid-gray.
    // Summed value noise crowds into ~0.3..0.7 — visually "flat gray" — so
    // the 1.9x expansion restores a full-range field before contrast runs.
    // Base octave 2.0 -> 5.0: at 2.0 one blob was half the ribbon's width, so
    // the pattern read as a soft tonal wash indistinguishable from cellular
    // and ripple. At 5.0 there are ~6 blobs across the form.
    float n = 0.55 * fsValueNoise(co * 5.0)
            + 0.30 * fsValueNoise(co * 12.0)
            + 0.15 * fsValueNoise(co * 26.0);
    return clamp((n - 0.5) * 1.9 + 0.5, 0.0, 1.0);
  } else if (type < 3.5) {
    // scanlines: thin dark lines perpendicular to the travel direction
    float s = 0.5 + 0.5 * sin(co.y * 28.0);
    return fsAAStep(0.35, 0.75, s);
  } else if (type < 4.5) {
    /* ── BANDS, RE-AUTHORED 2026-08-04 — SEE THE WOODGRAIN BLOCK BELOW FIRST ──
     *
     * The parked prior, verbatim:
     *
     *     float b = 0.5 + 0.5 * sin(co.y * 15.0);
     *     return fsAAStep(0.30, 0.70, b);
     *
     * Read that beside scanlines two branches up:
     *
     *     float s = 0.5 + 0.5 * sin(co.y * 28.0);
     *     return fsAAStep(0.35, 0.75, s);
     *
     * SAME SINE, SAME AXIS, SAME SYMMETRIC ~50/50 HARD STEP, ONE FREQUENCY
     * APART. Two presets differing only in a number is one look at two sizes,
     * and on Rod — where the ribbon is thin enough that neither shows more than
     * two or three periods — the size stops being a difference at all: Contour
     * Bands sat 5.001 from Scanlines, under the gate's 6.0 line, on the SAME
     * rail. This pair was NOT in the brief; it surfaced the moment woodgrain
     * moved out of the way, which is what "one look under two names" looks like
     * when three presets are in the pile.
     *
     * THE NAMES SAY WHAT THE DIFFERENCE SHOULD HAVE BEEN. "Scanlines" is a
     * RASTER — hard, even, mechanical, and it is the stronger read of the two,
     * so it is untouched. "Contour Bands" says "broad stripes WRAPPING THE
     * VOLUME", and a wrap is not a low-frequency raster: it is a rounded ribbon
     * lying over a form, which means a SOFT tonal body with a bright shoulder
     * where it turns away. That is a difference in PROFILE, not in frequency —
     * so the frequency is deliberately left at 15.0 and fsTexPeriod does not
     * move, because a period change would retune bandCrawl's tempo for a reason
     * that has nothing to do with tempo.
     *
     * Three things, all profile:
     *   · a wide soft BODY (smoothstep over most of the period) instead of a
     *     hard step, so the band has a gradient across it and reads as curved;
     *   · a narrow bright LIP at a fixed phase on the band's trailing shoulder,
     *     which is the highlight a raised wrap catches and a printed line
     *     cannot have;
     *   · a slow phase wander along the OTHER axis, so consecutive bands are
     *     not in lockstep — a raster is in lockstep, a wrap follows the form. */
    float bdPhase = co.y * 15.0 + (fsValueNoise(vec2(co.x * 0.45, 6.30)) - 0.5) * 1.9;
    float bd = 0.5 + 0.5 * sin(bdPhase);
    float bdBody = smoothstep(0.08, 0.66, bd);
    float bdLip = 1.0 - fsAAStep(0.015, 0.075, abs(bd - 0.80));
    return clamp(bdBody * 0.84 + bdLip * 0.34, 0.0, 1.0);
  } else if (type < 5.5) {
    // contour: thin lines where a smooth noise field crosses evenly spaced
    // levels — like elevation contours on a topo map. min(fr, 1-fr) is the
    // distance to the nearest level; smoothstep turns a thin distance band
    // into a line. Field 1.4 -> 3.6 and 5 -> 9 levels: the old settings put
    // one or two lines on the whole stroke, which reads as a scratch, not as
    // contours.
    float f = fsValueNoise(co * 3.6);
    float fr = fract(f * 9.0);
    return 1.0 - fsAAStep(0.03, 0.18, min(fr, 1.0 - fr));
  } else if (type < 6.5) {
    // crosshatch: two crossing diagonal line families, like pen shading.
    // Distinct from scanlines (one family, axis-aligned): the ±45° cross
    // weave reads as hand-hatched ink.
    float a = 0.5 + 0.5 * sin((co.x + co.y) * 18.0);
    float b = 0.5 + 0.5 * sin((co.x - co.y) * 18.0);
    float ha = fsAAStep(0.55, 0.85, a);
    float hb = fsAAStep(0.55, 0.85, b);
    return 1.0 - max(ha, hb);
  } else if (type < 7.5) {
    // dots: a fixed grid of soft ink dots with per-cell size jitter. This is
    // TEXTURE (a printed dot pattern on the surface), not dither — dot size
    // never encodes tone, and it never thresholds the shaded result.
    vec2 cell = floor(co * 6.0);
    vec2 g = fract(co * 6.0) - 0.5;
    float jr = 0.16 + fsHash(cell) * 0.12;
    float d = length(g);
    return 1.0 - fsAAStep(jr, jr + 0.14, d);
  } else if (type < 8.5) {
    /* ── WOODGRAIN, RE-AUTHORED 2026-08-04 ──────────────────────────────────
     *
     * (NB: no backticks anywhere in this comment — it lives inside a GLSL
     * template literal, so one backtick would terminate the string and break
     * the build. The file says this once already, 300 lines up. It is said
     * again here because this lane broke the build on it.)
     *
     * THE DEFECT: it was scanlines with a wiggle, and assert-screen-layers said
     * so — on Rod the two presets sat 4.801 apart on the SAME rail, i.e. one
     * look under two names, which is the DISPATCH 2.7 defect ("a dial whose
     * label does not describe what renders"). The parked prior, verbatim:
     *
     *     float warp = fsValueNoise(vec2(co.x * 1.3, co.y * 3.2)) * 6.0;
     *     float rings = 0.5 + 0.5 * sin(co.y * 22.0 + warp);
     *     return fsAAStep(0.25, 0.8, rings);
     *
     * Two things made it scanlines. First, fsAAStep(0.25, 0.8, sin) is a
     * SYMMETRIC ~50/50 duty cycle — dark stripe, light stripe, same width.
     * Timber is nothing like that. Second, the warp field varied at 3.2 ACROSS
     * the rings and only 1.3 ALONG them, so it smeared each line sideways
     * instead of bending the whole family; on a Rod-width ribbon that reads as
     * noise on a raster.
     *
     * WHAT MAKES SAWN TIMBER READ AS TIMBER — four things, each authored here:
     *
     *  1 · CATHEDRAL FIGURE. The single most recognisable signature of a
     *      flat-sawn board: nested arches, because the blade cuts obliquely
     *      through the cone of each growth year. It is a displacement of the
     *      ring coordinate that varies ALONG the grain, which is exactly the
     *      axis the old warp did not use. The arch is one slow octave in x
     *      only, so a whole ring family bends together instead of each line
     *      wobbling independently.
     *  2 · UNEVEN RING SPACING. Growth years are not a metronome. The ring
     *      coordinate is perturbed by a slow function of ITSELF, so rings crowd
     *      and spread across the board — a constant frequency is what makes a
     *      line family read as a manufactured raster.
     *  3 · AN ASYMMETRIC PROFILE. This is the one that kills the collapse.
     *      Latewood is a narrow, hard, dark band; earlywood is a wide pale
     *      field that darkens gradually into it. So the dark feature is under a
     *      fifth of the ring instead of half, and the light part is a RAMP, not
     *      a plateau. fract() per ring, then a band around 0.86.
     *  4 · FIBRE. Fine streaking along the grain gives the pale field tooth,
     *      and it is faded out by its own pixel footprint (the file's standing
     *      anti-alias rule) so it does not crawl when it cannot be resolved.
     *
     * FREQUENCY: one ring per 0.30 co units, i.e. ~4.5 across the 1.3-unit
     * ribbon — inside this file's own stated 4-8 target, and coarser than
     * scanlines' 0.2244 so the two do not even share a rhythm. fsTexPeriod is
     * updated to 0.30 in the same edit; leaving it at the old 2pi/22 is the
     * exact staleness class this file's period block was written about. */
    float wgAlong = co.x;
    float wgAcross = co.y;
    // 1 · the arch: slow, and a function of the along-grain axis ONLY. ONE
    //     octave — a second one at 1.9 was tried and it kinked the arches into
    //     chevrons (docs/verification/preset-pairs/iter1_solid_texture_
    //     scanlines-vs-woodgrain.png); cathedral figure is round, not folded.
    float wgArch = (fsValueNoise(vec2(wgAlong * 0.58, 4.10)) - 0.5) * 2.30;
    float wgRing = wgAcross + wgArch;
    // 2 · uneven spacing: rings crowd and spread along their own axis.
    float wgU = wgRing * 3.3333 + sin(wgRing * 2.10) * 0.42;
    float wgF = fract(wgU);
    // 3 · the asymmetric profile: a hard, WEIGHTY latewood band inside a wide
    //     earlywood field that ramps darker as it approaches it. The band is
    //     wide enough to carry ink at Rod's ribbon width — at 0.055/0.095 it
    //     thinned to a hairline there and sat 5.18 from craquelure, which is a
    //     web of hairlines; timber's dark band is the heaviest thing on the
    //     board, so widening it is the look, not a distance nudge.
    float wgD = abs(wgF - 0.86);
    float wgLate = 1.0 - fsAAStep(0.075, 0.125, wgD);
    float wgEarly = 0.95 - 0.40 * wgF;
    float wgWood = mix(wgEarly, 0.04, wgLate);
    // 4 · fibre, faded out once a streak is finer than a pixel.
    float wgFib = fsValueNoise(vec2(wgAlong * 30.0, wgAcross * 3.0));
    float wgFibK = 1.0 - smoothstep(0.45, 1.0, fwidth(wgAlong) * 30.0);
    return clamp(wgWood + (wgFib - 0.5) * 0.20 * wgFibK, 0.0, 1.0);
  } else if (type < 9.5) {
    // cellular: Worley cells. F1 alone gave smooth blobs with no boundary,
    // which is why it collapsed onto noise and ripple in review — three
    // options, one look. What makes a cell read as a CELL is its wall, so the
    // wall is drawn explicitly from F2-F1 (small exactly on a border) and cut
    // into the interior gradient. 3.0 -> 4.5 for ~6 cells across the ribbon.
    vec2 v = fsVoronoi(co * 4.5);
    float body = clamp(v.x * 1.45, 0.0, 1.0);
    float wall = 1.0 - fsAAStep(0.0, 0.085, v.y - v.x);
    return clamp(body * (1.0 - wall) + wall * 0.06, 0.0, 1.0);
  } else if (type < 10.5) {
    // brushed: anisotropic streaks — fast variation across the streak axis,
    // almost none along it, like brushed metal. Two octaves so the streaks
    // have both body and fine tooth. The fine octave at 60 was below a pixel
    // at normal viewing size and produced the moiré visible along the top of
    // the ribbon; it is now faded out by its own footprint rather than
    // removed, so the tooth survives in close-up and vanishes when it cannot
    // be resolved.
    float fine = fsValueNoise(vec2(co.x * 2.2, co.y * 60.0));
    float fineK = 1.0 - smoothstep(0.4, 1.0, fwidth(co.y) * 60.0);
    float s = 0.6 * fsValueNoise(vec2(co.x * 0.9, co.y * 26.0))
            + 0.4 * mix(0.5, fine, fineK);
    return clamp((s - 0.5) * 2.2 + 0.5, 0.0, 1.0);
  } else if (type < 11.5) {
    // craquelure: Worley F2-F1 is ~0 exactly on cell borders, drawing a
    // connected web of thin cracks — old varnish / dried glaze. Unlike
    // contour (level lines of one noise field) the cracks form closed
    // polygons that meet at junctions.
    vec2 v = fsVoronoi(co * 2.6);
    return fsAAStep(0.0, 0.10, v.y - v.x);
  }
  // ripple: two radial wave sources interfering. Reads as water rings /
  // moiré — no other pattern is radial. uFsTexTime also drives the radial
  // phase directly, so animation makes rings RADIATE outward from the
  // sources instead of the whole sheet merely sliding.
  // 16 -> 34: at 16 the ring spacing was a third of the ribbon's width, so a
  // ring crossing the stroke looked like a blob and the pattern was
  // indistinguishable from cellular. The raw sine sum was also a shapeless
  // gradient; shaping the crest gives the rings an edge to be seen as rings.
  // Radial phase rate 2.4 -> 6.0 rad per unit of uFsTexTime. uFsTexTime now
  // counts feature periods (see fsTexPeriod), so 6.0 rad is 0.96 of a ring per
  // period of travel: the rings RADIATE at about the same rate the sheet slides,
  // which is what "Ripple Radiate" claims. At 2.4 the radial term ran at 0.38 of
  // a ring per period of travel, so translation outran the radiation 2.6:1 and
  // the preset read as a sliding pattern that happened to be round.
  float r1 = length(co - vec2(1.8, 0.6));
  float r2 = length(co + vec2(1.4, 1.0));
  /* COUNTER-ROTATION — the second family radiates INWARD, and it is the fix for
   * a direction that could freeze this preset.
   *
   * MEASURED (assert-texture-motion.mjs, mean consecutive-frame change over ink,
   * solid/matteClay): horizontal 14.85, vertical 8.92, DIAGONAL 2.97 — "hard to
   * notice", the one red row in a 36-cell matrix. Ripple was the only pattern
   * with a spread like that.
   *
   * THE ARITHMETIC, and it is a coincidence of two authored numbers rather than
   * a bug in either. Travel advances 'co' by fsTexPeriod(ripple) = 0.1848 units
   * per unit of uFsTexTime, so translation moves the radial argument at
   * 34 * 0.1848 * (dir . rhat) = 6.283 * (dir . rhat) rad. The explicit radial
   * term runs at 6.0 rad. Those are the same number to within 5 %, BY DESIGN —
   * the note above says so: "the rings RADIATE at about the same rate the sheet
   * slides". So wherever the travel direction sits within about 17 degrees of the
   * outward radial direction, the two terms cancel and the rings stand still
   * relative to the surface. That is a travelling wave being followed at its own
   * speed, and it is exactly the "invariant axis" failure the DIRECTIONS sweep in
   * assert-texture-motion.mjs was written to catch, one level subtler: the axis
   * is not the pattern's geometry, it is its phase velocity.
   *
   * Flipping the SIGN on the second family makes the cancellation impossible to
   * satisfy for both at once: a direction that freezes the outward family
   * DOUBLES the inward one. It costs nothing at rest (uFsTexTime = 0 is
   * identical), keeps both families at the authored 6.0 rate, and leaves every
   * other pattern untouched.
   *
   * uFsTexRipplePrior = 1 restores the same-sense pair verbatim. */
  float rippleSense = mix(1.0, -1.0, uFsTexRipplePrior);
  float w = sin(r1 * 34.0 - uFsTexTime * 6.0)
          + sin(r2 * 34.0 + rippleSense * uFsTexTime * 6.0);
  return fsAAStep(-0.55, 0.75, w);
}

/**
 * TRIPLANAR PROJECTION.
 *
 * The pattern used to be evaluated at objPos.xy — a single planar projection
 * down Z. That is correct only for surfaces facing the camera. Every surface
 * whose normal points sideways gets the pattern SMEARED along the axis the
 * projection dropped: on the Extrude ribbon's side walls a dot grid rendered as
 * long bars (docs/verification/style-craft/diag/proj_az35.png, proj_az60.png),
 * and it got worse the further the camera orbited.
 *
 * Standard fix for geometry with no UVs: evaluate the pattern once per axis
 * plane and blend the three by the surface normal, weights abs(n)^k
 * normalized to sum to 1 (Unity ShaderGraph Triplanar node; Ronja / Catlike
 * Coding triplanar tutorials; bgolus on triplanar normal blending). k = 6 keeps
 * the blend band narrow so flat faces stay crisp and only the corner rounds
 * cross-fade — a low exponent visibly washes the pattern out at 45°.
 *
 * All three planes are evaluated unconditionally even though two of them are
 * usually near-zero weight. Skipping them would be cheaper, but the patterns
 * now call fwidth() for anti-aliasing, and a derivative taken inside divergent
 * control flow is undefined — neighbouring fragments in the same quad can take
 * different branches at exactly the silhouettes and creases where the blend
 * matters most. Three evaluations of one stroke is the cheap side of that
 * trade.
 */
float fsTexTriplanar(vec3 p, vec3 n, float type) {
  vec3 w = pow(abs(normalize(n)), vec3(6.0));
  w /= max(w.x + w.y + w.z, 1e-4);
  return w.z * fsTexPattern(p.xy, type)
       + w.x * fsTexPattern(p.zy, type)
       + w.y * fsTexPattern(p.xz, type);
}
`

/** Fragment injection A: pattern value + albedo modulation (needs diffuseColor). */
export const TEXTURE_MAP_GLSL = /* glsl */ `
float fsPat = 0.0;
/* How dark the body is, sampled BEFORE the pattern touches it. Read by the
 * specular injection further down, which runs after several chunks that can
 * move diffuseColor. See the DARK-BODY block below. */
float fsTexLum = 0.0;
/* WHAT THE RELIEF CHANNEL NEEDS FROM HERE — the pattern coordinate it was
 * sampled at, and the pattern value BEFORE the contrast expansion.
 *
 * fsTexFoot is the pixel footprint in 'co' units, kept only so the relief can
 * ask the grain LOD which lattice it drew (fsTexPeriodLocal). It is NOT used to
 * scale the relief: see the RELIEF block in TEXTURE_LIGHTS_GLSL for why every
 * footprint-derived quantity had to come out of that arithmetic. */
vec3 fsTexP3 = vec3(0.0);
float fsTexRaw = 0.0;
float fsTexFoot = 0.0;
if (uFsTexType > 0.5) {
  // Guaranteed to have a component across the pattern's varying axis, so no
  // direction choice can silently produce zero motion (see fsTravelDir).
  vec2 fsDir = fsTravelDir(vec2(uFsTexDirX, uFsTexDirY), uFsTexType);
  // TRAVEL IS IN FEATURE PERIODS, NOT CO UNITS — see fsTexPeriod. One period per
  // unit of uFsTexTime, so textureSpeed means the same tempo on a 0.42-unit band
  // as on a 0.031-unit contour line. Before this, speed 1.6 was 1.9 periods/s on
  // dots and 64 periods/s on contour, and only the second one aliased.
  float fsTravel = uFsTexTime * fsTexPeriod(uFsTexType);
  /* THE ANIMATION TYPE (TEXTURE-ANIM, 2026-09-26). Travel (0) is the offset above,
   * unchanged. Pulse (1) and Sheen (2) hold the pattern still and move its contrast
   * instead, further down. Boil (3) is hand-drawn line boil: the same drawing
   * traced three times, each trace a little off, looped A B C. The pattern steps
   * between three fixed offsets about a quarter of a feature period apart, 7 steps
   * per unit of uFsTexTime, 8.4 a second at speed 1. TEXTURE-ANIM-3 replaced a
   * re-roll to a random offset anywhere in one period, which changed 75 to 85% of
   * the ink each step and read as flicker. Three poses, not four: four at 7 a
   * second loop every 0.56 s, so frames 0.5 s apart mostly land on the same pose
   * and look still; three at 8.4 a second differ at any gap from 0.48 to 0.71 s.
   * The poses average to zero, so the pattern boils in place around its rest
   * position, and no two steps go the same way. Off renders
   * with uFsTexTime at the phase and the type forced to 0, so every offset here is
   * exactly zero and the frame is the one main drew. */
  vec2 fsMove = fsDir * fsTravel;
  if (uFsTexAnimType > 0.5) {
    if (uFsTexAnimType > 2.5) {
      float fsPose = mod(floor(uFsTexTime * 7.0), 3.0);
      vec2 fsJit = fsPose < 0.5 ? vec2(0.13, 0.04) : (fsPose < 1.5 ? vec2(-0.09, 0.11) : vec2(-0.04, -0.15));
      fsMove = fsJit * fsTexPeriod(uFsTexType);
    } else {
      fsMove = vec2(0.0);
    }
  }
  float fsSheen = 0.0;
  if (uFsTexLockScreen > 0.5) {
    // Screen lock is a graphic OVERLAY: one plane, the viewport's, by
    // definition. Nothing to project.
    vec2 fsCo = gl_FragCoord.xy * 0.012 * uFsTexScale + fsMove;
    fsPat = fsTexPattern(fsCo, uFsTexType);
  } else {
    // Object lock is a SURFACE treatment, so it has to follow the surface.
    // Travel is applied in 3D before projection, so each plane picks up the
    // components of the direction that actually lie in it — offsetting after
    // projection would slide the XY plane and leave the side walls static.
    vec3 fsP = vFsObjPos * 4.0 * uFsTexScale + vec3(fsMove, fsMove.x);
    fsPat = fsTexTriplanar(fsP, vFsObjNrm, uFsTexType);
    fsTexP3 = fsP;
    // The largest per-component fwidth, which is the same quantity the grain
    // branch keys its lattice off (fwidth(co.x) of whichever projected plane
    // won the triplanar blend). Read ONLY by fsTexPeriodLocal, so that the
    // relief asks the grain LOD the question it actually answered.
    fsTexFoot = max(max(fwidth(fsP.x), fwidth(fsP.y)), fwidth(fsP.z));
  }
  fsTexRaw = fsPat;
  // Contrast: expand/compress the pattern around mid-gray.
  fsPat = clamp((fsPat - 0.5) * (0.4 + uFsTexContrast * 2.6) + 0.5, 0.0, 1.0);
  /* PULSE AND SHEEN change what the eye catches first, contrast, instead of
   * position. A translating texture on a stroke ten pixels wide reads as the same
   * camo reshuffling (measured: 80% of ink pixels change per 0.5 s and it still
   * looks still). Pulse breathes the whole pattern from flat (x0.05) to
   * three times its contrast, one breath per 2 units of uFsTexTime, 1.7 s at speed 1.
   * Sheen sweeps a soft band 245 px wide across the view every 1.4 s at speed 1,
   * in the Direction the panel sets; the pattern is muted to x0.55 outside it and
   * lifted to x2.45 inside it, and the band adds light where the pattern is light.
   * It is screen space on purpose: a sheen is light passing, and light is a view
   * effect, like the specular it rides with. */
  if (uFsTexAnimType > 0.5 && uFsTexAnimType < 2.5) {
    float fsGain = 0.05 + 2.95 * (0.5 - 0.5 * cos(uFsTexTime * 3.14159265));
    if (uFsTexAnimType > 1.5) {
      vec2 fsSd = normalize(vec2(uFsTexDirX, uFsTexDirY) + vec2(1e-4, 0.0));
      float fsU = dot(gl_FragCoord.xy, fsSd) / 720.0 - uFsTexTime * 0.6;
      fsSheen = 1.0 - smoothstep(0.0, 0.17, abs(fract(fsU) - 0.5));
      fsGain = 0.55 + 1.9 * fsSheen;
    }
    fsPat = clamp((fsPat - 0.5) * fsGain + 0.5, 0.0, 1.0);
  }
  // BIDIRECTIONAL albedo modulation (lift AND darken around the base).
  // Darken-only was invisible on the near-black presets: multiplying an
  // almost-black albedo by <1 stays almost-black. Allowing the pattern to
  // lift as well gives marks somewhere to go on dark ink.
  // Gain raised 1.6 → 2.4 after live judging: at 1.6 every preset needed
  // intensity near 1.0 just to be seen at viewport stroke sizes.
  diffuseColor.rgb *= clamp(1.0 + uFsTexIntensity * (fsPat - 0.5) * 2.4, 0.0, 3.0);

  /* ── DARK-BODY LIFT ────────────────────────────────────────────────────
   *
   * THE MEASUREMENT THAT MADE THIS NECESSARY. Rod ships the 'ink' material
   * (albedo #26262b, clearcoat 0.9, clearcoatRoughness 0.1). Across all twelve
   * texture presets its 'dOff' — the mean distance from the same frame with the
   * rail off — measures **0.93 to 4.08**, against the repo's own stated
   * perceptual floor of 2 ('scripts/verify/diff-frames.mjs': "meanΔ < 2 on an
   * 0-255 scale is below the perceptual floor on a dark surface"), and its
   * "reads" line at 5. Fine Grain sits at 0.93. So on Rod the rail is faint at
   * best and invisible at worst, while the SAME presets on Solid measure 10.9
   * to 32.4. Re-measured on this tree 2026-08-01
   * (docs/verification/screen-layers/lane7-rod/), not taken from the docs.
   *
   * WHY THE TWO CHANNELS ABOVE CANNOT REACH IT, and neither is broken:
   *   · the albedo line is MULTIPLICATIVE, and explainer 01 §5 already made it
   *     bidirectional for exactly this reason. But a multiplier has no headroom
   *     on a base that is already ~0.018 in linear light: 1.72x of nearly
   *     nothing is nearly nothing.
   *   · the roughness line lands UNDER a clearcoat sitting at 0.1 roughness,
   *     i.e. a near-mirror. 'docs/research/screen-space-layer-quality.md' names
   *     both: "Modulating a near-black albedo in either direction stays near
   *     black, and the roughness swing is applied *under* a clearcoat that is
   *     itself near-mirror", and it names the lever — "the next lever to try is
   *     the clearcoat layer itself rather than the base roughness."
   *
   * SO: an ADDITIVE term, scaled by the headroom the body actually has. No
   * threshold and no material name anywhere in it — '(1.0 - fsTexLum)' is ~1 on
   * ink and collapses to ~0 on a light body, so Solid and the light presets are
   * untouched BY CONSTRUCTION rather than by a tuned cutoff. (A hand-picked
   * "is this material dark" constant is the thing that goes stale the first time
   * a preset's albedo moves.)
   *
   * 0.055 is the swing at full intensity and full contrast: on ink it takes the
   * body from 0 to ~0.073 linear, which is ~0.30 sRGB — a pattern that reads,
   * against a base that is 0.15 sRGB. On a body already at 0.5 linear it is
   * worth half that and lands inside the multiplicative term's own range.
   *
   * 'uFsTexDarkBoost' is 0 for the parked prior, and every term it scales is
   * additive, so 0 reproduces the old render exactly. */
  fsTexLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  diffuseColor.rgb += vec3(
    uFsTexDarkBoost * uFsTexIntensity * (fsPat - 0.5) * 2.0 * 0.055 * (1.0 - clamp(fsTexLum, 0.0, 1.0))
  );
  // Guarded, not added as zero: Off and Travel must compile to main's arithmetic,
  // and an unconditional add of zero moved one Inflate woodgrain Off frame off main's
  // bytes (TEXTURE-ANIM-2, assert-texture-anim OFF row).
  if (fsSheen > 0.0) diffuseColor.rgb += vec3(fsSheen * fsPat * 0.3 * (0.35 + uFsTexIntensity));
  diffuseColor.rgb = max(diffuseColor.rgb, vec3(0.0));
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
    /* THE CLEARCOAT LAYER ITSELF, which is the lever
     * docs/research/screen-space-layer-quality.md names and nothing had pulled:
     * "the next lever to try is the clearcoat layer itself rather than the base
     * roughness."
     *
     * On Rod's 'ink' the coat is at strength 0.9 and roughness 0.1 — a near
     * mirror — so almost every photon the eye gets off that body is the coat's
     * reflection of the environment, and a pattern that only edits what is
     * UNDER the coat is editing something the coat is hiding. Modulating the
     * coat's STRENGTH changes how much environment is mirrored, which is a real
     * luminance swing on a body that has no diffuse range to give.
     *
     * Weighted by the SAME headroom term as the albedo lift, for the same
     * reason: a light body's texture already reads (Solid measures 10.9-32.4),
     * so it must not be touched. No material names, no thresholds.
     *
     * 0.45 at full intensity moves a 0.9 coat across 0.68-1.0 — enough to see,
     * never enough to strip the coat off and change what the preset IS. */
    material.clearcoat = clamp(
      material.clearcoat
        + (fsPat - 0.5) * 2.0 * uFsTexIntensity * 0.45 * uFsTexDarkBoost
          * (1.0 - clamp(fsTexLum, 0.0, 1.0)),
      0.0, 1.0
    );
  #endif

  /* == RELIEF ==============================================================
   *
   * WHY A FOURTH CHANNEL, WHEN THREE ALREADY EXIST. Albedo (bidirectional),
   * albedo (additive, dark-body) and roughness/clearcoat-strength are all
   * LEVEL controls: each of them makes the surface reflect MORE or LESS light
   * at the pixel it is at. On Rod's shipping 'ink' (albedo #26262b linear
   * ~0.018, clearcoat 0.9 at roughness 0.1, env 1.1) almost every photon that
   * reaches the eye is the coat mirroring the environment, and the range a
   * level control has on that body is small in every direction at once. That is
   * why three channels stacked still left the whole rail at dOff 3.4-4.7
   * against the repo's own 5.0 'reads' line, and why more gain is not the
   * answer: measured live at 8x the shipping dark-body gain, Fine Grain on Rod
   * moved 1.48 -> (see docs/verification/texture-relief/) and the preset stopped
   * looking like grain long before it started reading.
   *
   * A mirror does not show a pattern by being dimmer. It shows one by being
   * BENT. Perturbing the shading normal changes WHICH PART of the environment
   * each pixel reflects, so the pattern is carried by the structure already in
   * the env rig — its bright slats and its dark room — instead of by whatever
   * headroom the albedo has left. That is a mechanism with authority on exactly
   * the material the level controls have none on, and it is the standard answer
   * for surface pattern on a glossy body (orange peel, brushed metal, hammered
   * finish: all normal, none albedo).
   *
   * THE METHOD, and why this one. There are no UVs and no tangents on this
   * geometry (see the file header), so a tangent-space normal map is not
   * available even in principle. Morten S. Mikkelsen, "Bump Mapping
   * Unparametrized Surfaces on the GPU" (2010) derives the surface gradient
   * from the height function and the SCREEN-SPACE DERIVATIVES of the surface
   * position, which needs neither. three.js ships the same construction as
   * perturbNormalArb() in <bumpmap_pars_fragment>, compiled in only when a
   * bumpMap texture is bound — which we cannot bind, because the height here is
   * procedural. So the construction is inlined:
   *
   *     R1 = dPdy x N,  R2 = N x dPdx,  det = dPdx . R1
   *     N' = normalize(|det| N - sign(det) (dHdx R1 + dHdy R2))
   *
   * ── WHY THE HEIGHT GRADIENT IS **NOT** dFdx(fsPat), WHICH IS WHAT EVERY
   *    OBVIOUS VERSION OF THIS DOES, AND WHAT THE FIRST TWO BUILDS DID ───────
   *
   * MEASURED FIRST, then explained. With the relief driven by dFdx(fsPat), all
   * twelve presets on Rod rendered the same fine woven mesh laid over their own
   * pattern. docs/verification/texture-relief/sheets/origin_contourBands_b0.25.png
   * sweeps textureScale over 14.7x on ONE preset: the bands change frequency
   * exactly as they must, and the weave does not move at all. A structure whose
   * frequency is independent of the pattern's frequency is not the pattern.
   *
   * It is the MESH. Every pattern in this file is anti-aliased through fsAAStep,
   * whose edge width is fwidth() of its own argument, and grain additionally
   * picks its LATTICE from fwidth. Screen-space derivatives are constant across
   * a triangle and jump at every triangle boundary, so the pattern VALUE carries
   * a small step at each mesh edge — invisible in the value, and enormous once
   * you differentiate it. The anti-aliasing that makes the pattern quiet is
   * precisely what makes its screen derivative loud.
   *
   * Two earlier attempts at this failed and are worth naming so nobody re-tries
   * them: blending the three triplanar planes' derivatives instead of
   * differentiating the blend (real bug, fixed, weave unchanged — spread 25.79
   * -> 25.77), and splitting the footprint per axis instead of one L-infinity
   * max (real bug, fixed, weave unchanged — 25.77 -> 25.78).
   *
   * So the height gradient is taken in the PATTERN'S OWN COORDINATE SPACE by
   * re-sampling: one extra evaluation along each screen axis, stepped by a fixed
   * fraction of the feature period. Both samples are evaluated at the same
   * fragment, so they see the same fwidth and the mesh step cancels exactly
   * instead of being amplified. It also gives the relief a real, chosen SMOOTHING
   * radius (0.3 of a feature) — the difference between an engraved pattern and a
   * field of one-pixel walls, which is the other thing the derivative version got
   * wrong.
   *
   * ── AND WHY THE RESULT HAS NO FOOTPRINT IN IT ──────────────────────────────
   *
   * Let the physical relief depth be A = bump * (feature size in object units),
   * i.e. self-similar: fine grain shallow, broad bands deep, same steepness.
   * Feature size in object units is period / (4 * uFsTexScale), because 'co' is
   * objPos * 4 * scale. Then
   *
   *   tilt = (dH/dx_screen) / |dP_view/dx_screen|
   *        = A * g_co * |dco/dx| / (s * |dP_obj/dx|)          [s = model scale]
   *        = [bump * period / (4 scale)] * g_co * 4 scale     = bump * period * g_co
   *
   * every footprint, the model scale and the camera distance all cancel. That is
   * not a convenience — it is the property the first build lacked, and lacking it
   * is what let the tessellation into the picture. g_co is the pattern change per
   * unit of 'co', which is exactly what the finite difference below returns.
   *
   * SCREEN LOCK IS EXCLUDED, and that is a definition, not an omission. The
   * explainer calls screen lock 'a graphic overlay printed on glass'; giving an
   * overlay physical relief would make it a surface treatment, which is the other
   * lock mode. All twelve texture rail presets are object-locked.
   *
   * uFsTexBump = 0 returns the normal unchanged, which is the parked prior. */
  if (uFsTexBump > 0.0001 && uFsTexLockScreen < 0.5) {
    vec3 fsRelP = -vViewPosition;
    vec3 fsRelDx = dFdx(fsRelP);
    vec3 fsRelDy = dFdy(fsRelP);
    float fsRelPer = fsTexPeriodLocal(uFsTexType, fsTexFoot);
    // The two screen axes, expressed as directions in the pattern's coordinate
    // space, each stepped by 0.3 of a feature period.
    float fsRelStep = fsRelPer * fsTexReliefStep(uFsTexType);
    vec3 fsRelCx = dFdx(fsTexP3);
    vec3 fsRelCy = dFdy(fsTexP3);
    vec3 fsRelUx = fsRelCx * (fsRelStep / max(length(fsRelCx), 1e-9));
    vec3 fsRelUy = fsRelCy * (fsRelStep / max(length(fsRelCy), 1e-9));
    // Same contrast expansion the visible pattern got, applied to all three
    // samples — including its clamp, so a pattern pinned at 0 or 1 is a FLAT
    // region of the height field rather than a wall the relief invents.
    float fsRelGain = 0.4 + uFsTexContrast * 2.6;
    float fsRelH0 = clamp((fsTexRaw - 0.5) * fsRelGain + 0.5, 0.0, 1.0);
    float fsRelHx = clamp((fsTexTriplanar(fsTexP3 + fsRelUx, vFsObjNrm, uFsTexType) - 0.5) * fsRelGain + 0.5, 0.0, 1.0);
    float fsRelHy = clamp((fsTexTriplanar(fsTexP3 + fsRelUy, vFsObjNrm, uFsTexType) - 0.5) * fsRelGain + 0.5, 0.0, 1.0);
    vec2 fsRelG = vec2(fsRelHx - fsRelH0, fsRelHy - fsRelH0) / max(fsRelStep, 1e-9);
    // tilt = bump * intensity * period * (pattern change per co unit).
    // The 1.5 bound is the last guard, not the dial: it only bites on grain,
    // whose cells are hard steps, and it stops a cell wall throwing the normal
    // past the silhouette.
    vec2 fsRelTilt = clamp(fsRelG * (uFsTexBump * uFsTexIntensity * fsRelPer), -1.5, 1.5);
    vec2 fsRelH = vec2(fsRelTilt.x * length(fsRelDx), fsRelTilt.y * length(fsRelDy));
    // Both normals get the SAME relief. Perturbing only the base normal would
    // leave the coat — the layer doing most of the work on ink — mirroring a
    // perfectly smooth surface, which is the shape of the defect this whole
    // channel exists to fix, one layer up.
    vec3 fsRelR1 = cross(fsRelDy, normal);
    vec3 fsRelR2 = cross(normal, fsRelDx);
    float fsRelDet = dot(fsRelDx, fsRelR1);
    /* Mikkelsen's N' = normalize(|det| N - sign(det) G), divided through by
     * |det|. Two things that buys, both of which matter here:
     *   · the subtracted vector IS the tilt, so it can be bounded directly and
     *     the bound is in degrees rather than in an arbitrary product of two
     *     view-space derivatives;
     *   · a degenerate derivative frame (det -> 0 at a silhouette pixel, where
     *     a quad straddles the edge) cannot produce normalize(vec3(0)) and a
     *     NaN normal. R1 and R2 are both cross products WITH the normal, so the
     *     tilt is perpendicular to it by construction and |N - T| >= 1 always. */
    vec3 fsRelT = sign(fsRelDet) * (fsRelH.x * fsRelR1 + fsRelH.y * fsRelR2)
                / max(abs(fsRelDet), 1e-12);
    if (length(fsRelT) > 1.2) fsRelT = normalize(fsRelT) * 1.2;
    normal = normalize(normal - fsRelT);
    #ifdef USE_CLEARCOAT
      vec3 fsRelC1 = cross(fsRelDy, clearcoatNormal);
      vec3 fsRelC2 = cross(clearcoatNormal, fsRelDx);
      float fsRelCDet = dot(fsRelDx, fsRelC1);
      vec3 fsRelCT = sign(fsRelCDet) * (fsRelH.x * fsRelC1 + fsRelH.y * fsRelC2)
                   / max(abs(fsRelCDet), 1e-12);
      if (length(fsRelCT) > 1.2) fsRelCT = normalize(fsRelCT) * 1.2;
      clearcoatNormal = normalize(clearcoatNormal - fsRelCT);
    #endif
  }
}
`
