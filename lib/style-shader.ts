/**
 * Style shader composer.
 *
 * A three.js material has exactly ONE `onBeforeCompile` hook, but Free Stroke's
 * visual layers are deliberately separate systems (texture ≠ dither ≠ ASCII).
 * This module is the single injection point that stitches each system's GLSL
 * into the shared MeshPhysicalMaterial, while each system keeps its own module,
 * its own uniforms, and its own state — matching the PRD's separation rule.
 *
 * WHERE EACH SYSTEM INJECTS, AND WHY IT MATTERS:
 *
 *   texture  → <map_fragment>              (modulates albedo; needs diffuseColor)
 *            → <lights_physical_fragment>  (modulates roughness/clearcoat so the
 *                                           HIGHLIGHT carries the pattern too)
 *   dither   → <dithering_fragment>        (the very END of the shader, after
 *                                           lighting + tonemapping + color space)
 *   ascii    → <dithering_fragment>, after dither (glyphs represent the tone
 *                                           dither produced)
 *
 * That ordering is the whole reason the two read as different systems rather
 * than two flavours of noise: texture changes what the SURFACE IS before light
 * hits it, dither reduces the FINAL TONE after all shading is done. Stacking
 * both gives "a patterned surface, then rendered in limited tone", which is the
 * correct composition — not two patterns fighting.
 */
import type * as THREE from "three"
import {
  TEXTURE_COMMON_GLSL,
  TEXTURE_MAP_GLSL,
  TEXTURE_LIGHTS_GLSL,
  SWEEP_COMMON_GLSL,
  SWEEP_EMISSIVE_GLSL,
  SWEEP_LIGHTS_GLSL,
  IRIDESCENCE_SWIRL_GLSL,
  type TextureUniforms,
  type SweepUniforms,
} from "./texture-shader"
import { DITHER_COMMON_GLSL, DITHER_APPLY_GLSL, type DitherUniforms } from "./dither-shader"
import { ASCII_COMMON_GLSL, ASCII_APPLY_GLSL, type AsciiUniforms } from "./ascii-shader"
import { STACK_BLEND_GLSL } from "./style-stack"

/* ======================================================================== */
/* SHARED TONE MAPPING for the post-lighting screens (dither + ASCII).      */
/* ------------------------------------------------------------------------ */
/* Both layers take a display-space luminance and must land the subject      */
/* across a 0..1 ramp before quantizing it. They each grew their OWN copy of  */
/* the same idea — `mix(1.9, 0.16, dial)` as a divisor, then a contrast       */
/* expansion about 0.5 — which is duplicated logic AND, measured, the reason  */
/* every threshold map rendered as uniform wallpaper.                         */
/*                                                                            */
/* WHY A DIVISOR CANNOT WORK HERE. Measured over the ink region of a real     */
/* frame (docs/verification/style-craft/diag), the rendered stroke's          */
/* luminance distribution is:                                                 */
/*                                                                            */
/*   solid    p10 0.352  p25 0.538  p50 0.538  p75 0.538  p90 0.651          */
/*   extrude  p10 0.157  p25 0.357  p50 0.357  p75 0.357  p90 0.847          */
/*   rod      p10 0.168  p25 0.225  p50 0.335  p75 0.601  p90 0.847          */
/*   inflate  p10 0.396  p25 0.462  p50 0.510  p75 0.634  p90 0.800          */
/*                                                                            */
/* On Solid and Extrude the 25th, 50th and 75th percentiles are the SAME      */
/* NUMBER: more than half the ink is one single tone. A divisor scales that   */
/* plateau, it cannot spread it, and a contrast expansion afterwards pushes   */
/* it against a clamp — which is precisely why halftone dots came out all the */
/* same size and every ASCII charset resolved to one character.               */
/* ======================================================================== */
export const TONE_WINDOW_GLSL = /* glsl */ `
// Explicit black/white WINDOW instead of a divide. Exposure slides the
// window's centre, contrast narrows its width. Every dial position leaves a
// live window, so neither layer can silently no-op at the ends of its range
// (the old exposure dial rendered NOTHING above ~0.65 — verified in
// docs/verification/style-craft/sheets/sweep_ditherExposure.png).
float fsToneWindow(float lum, float exposure, float contrast) {
  float centre = mix(0.90, 0.12, clamp(exposure, 0.0, 1.0));
  // WIDTH RANGE 0.48..0.05, NOT 0.62..0.07.
  //
  // ⚠ The headline said 0.34..0.02 while the code below has said 0.48..0.05
  // since the overshoot was walked back — and the walk-back is written out in
  // this same block, thirty lines down ("0.34..0.02 blew Extrude out"). So the
  // title contradicted its own correction, and at the default contrast 0.5 the
  // shipped half-width is 0.2650 against the 0.1800 the headline promised —
  // 1.47x wider than the number a reader would have taken away. The two derived
  // figures further down (0.345 at dial 0.5, 0.18 at contrast 0.8) are both
  // computed under the OLD 0.62..0.07 and are correct as history; only this
  // line was claiming to describe the shipped code and getting it wrong.
  //
  // The window has to be about as wide as the SUBJECT'S TONAL SPREAD, and it
  // was four to five times wider than that. Measured over the ink region of a
  // real frame with every layer off, on each engine's own default material
  // (docs/verification/screen-layers/before/report.json):
  //
  //     solid / matteClay     sigma 0.071      extrude / glossyPlastic 0.152
  //     inflate / softGel     sigma 0.131      rod / ink               0.257
  //
  // The old range put the DEFAULT dial position (0.5) at a half-width of
  // 0.345 — 4.9x the solid engine's sigma. A quantiser whose window is five
  // times the range of what it is quantising spends its whole ramp on tones
  // the subject does not have, so every cell lands on the same level: the
  // halftone dots all come out the same size and every ASCII charset renders
  // as one repeated character. That is the "it goes flat" complaint, and it is
  // a width problem, not a centre problem — the centre was already within 0.11
  // of all four materials.
  //
  // Picked from frames, not arithmetic: docs/verification/screen-layers/sweep/
  // sheets/sweep_solid_dotMatrix.png sweeps exposure x contrast on a halftone.
  // Dot size only starts VARYING ACROSS THE FORM at contrast 0.8 under the old
  // mapping (half-width 0.18); everything at 0.2-0.5 is uniform wallpaper.
  //
  // AND THERE IS A FLOOR, found by overshooting it. A first pass took the range
  // to 0.34..0.02, which is the width the SOLID engine's sigma asks for. On
  // Extrude — same dial, lighter material, body tone 0.62 against a window
  // topping out at 0.56 — three of the five rail presets went ENTIRELY to
  // paper: docs/verification/screen-layers/after (first capture) has Dot
  // Matrix, Hard Threshold and Pixel Signal as blank white ribbons, and the
  // nearest-sibling distance on that rail collapsed from 21.1 to 8.0 because
  // every screen converges to the same blown-out silhouette. Too wide flattens;
  // too narrow clips. Both are the same underlying fault — the window is
  // positioned in ABSOLUTE display luminance while the subject's luminance is
  // decided by a material chosen somewhere else entirely.
  //
  // 0.48..0.05 is the widest setting that still shows dot-size variation on
  // Solid while keeping Extrude's body inside the window. It is a compromise
  // across four materials, and it is a compromise BECAUSE a constant cannot be
  // anything else here. The fix that removes the compromise is auto-exposure
  // against a measured per-material reference tone — see
  // docs/research/screen-space-layer-quality.md.
  float halfW = mix(0.48, 0.05, clamp(contrast, 0.0, 1.0));
  return clamp((lum - (centre - halfW)) / max(2.0 * halfW, 1e-3), 0.0, 1.0);
}

// FORM TONE. A screen driven only by the composited pixel is mathematically
// forced to be uniform wherever the pixel is uniform — and on a flat-lit
// stroke that is most of the surface (see the percentiles above). The standard
// NPR-halftone answer is to drive the screen from a SHADING term rather than
// from the final pixel (Freudenberg et al., "Real-Time Halftoning: A Primitive
// for Non-Photorealistic Shading", EGSR 2002). The term the geometry always
// has, even when the lighting has flattened, is the facing ratio N.V: 1
// head-on, 0 at the silhouette, smooth in between, and it follows the form's
// curvature exactly. Folding it in is what makes a dot screen model a tube
// instead of wallpapering a silhouette.
//
// N.V is passed IN rather than read here: three.js declares view-space
// 'normal' and 'vViewPosition' as locals inside main(), so a file-scope
// function cannot see them. The composer computes the ratio at the injection
// site and hands it to both layers, which also guarantees the two screens
// agree about the form.
float fsFormTone(float lum, float ndv) {
  // Shade toward the silhouette but never to black: the screen still has to
  // respect the material's own tone, this only restores the modelling the
  // flat-lit render threw away.
  return clamp(lum * mix(1.0, 0.42 + 0.58 * clamp(ndv, 0.0, 1.0), 0.8), 0.0, 1.0);
}
`

export interface StackUniforms {
  /** 0 = dither then ascii, 1 = ascii then dither. */
  uFsStackOrder: { value: number }
}

export function createStackUniforms(): StackUniforms {
  return { uFsStackOrder: { value: 0 } }
}

export interface StyleShaderUniforms {
  texture: TextureUniforms
  /** Travelling shine-sweep band (animated material "shineSweep"). */
  sweep: SweepUniforms
  dither: DitherUniforms
  ascii: AsciiUniforms
  stack: StackUniforms
}

/**
 * Installs every style layer on one material. Uniform objects are shared by
 * reference, so per-frame updates write straight through — no recompiles, no
 * material swaps, no geometry rebuilds.
 */
export function applyStyleShader(material: THREE.Material, u: StyleShaderUniforms): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u.texture, u.sweep, u.dither, u.ascii, u.stack)

    // Object-space position varying, shared by every layer that can be
    // object-locked. `position` is the raw vertex attribute before any matrix
    // transform, so patterns stay glued to the geometry under camera orbit.
    // vFsObjNrm: the OBJECT-space normal, alongside the object-space position.
    // Needed for two things the layers could not do without it:
    //   1. triplanar texture projection — the pattern was projected down XY
    //      only, so every surface whose normal is not ±Z had the pattern
    //      smeared along the missing axis (visibly: the extrude side walls
    //      turned a dot grid into long bars, docs/verification/style-craft/
    //      diag/proj_az35.png).
    //   2. nothing else reads it yet; the post-lighting screens use three's own
    //      view-space `normal`, which is closer to what a facing ratio wants.
    // `objectNormal` is used rather than the raw `normal` attribute so morph /
    // skinning stay accounted for; <beginnormal_vertex> runs before
    // <begin_vertex>, so it is already assigned here.
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec3 vFsObjPos;\nvarying vec3 vFsObjNrm;",
      )
      .replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvFsObjPos = position;\nvFsObjNrm = objectNormal;",
      )

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          "varying vec3 vFsObjPos;",
          "varying vec3 vFsObjNrm;",
          "uniform float uFsStackOrder;",
          TEXTURE_COMMON_GLSL,
          SWEEP_COMMON_GLSL,
          DITHER_COMMON_GLSL,
          ASCII_COMMON_GLSL,
          // The blend helper and the shared tone mapping must both be declared
          // before the apply functions use them.
          STACK_BLEND_GLSL,
          TONE_WINDOW_GLSL,
          DITHER_APPLY_GLSL,
          ASCII_APPLY_GLSL,
        ].join("\n"),
      )
      .replace("#include <map_fragment>", `#include <map_fragment>\n${TEXTURE_MAP_GLSL}`)
      // Shine sweep half A: band value + additive glow. <emissivemap_fragment>
      // runs BEFORE the lighting chunks, so `fsSweepB` computed here is in
      // scope for the roughness modulation in half B below.
      .replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>\n${SWEEP_EMISSIVE_GLSL}`,
      )
      // Texture roughness first, then sweep half B: where the band passes it
      // OVERRIDES the pattern's roughness toward mirror — a shine rolling over
      // a textured surface momentarily "wets" the texture, which is exactly
      // how a real gloss pass behaves.
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>\n${TEXTURE_LIGHTS_GLSL}\n${SWEEP_LIGHTS_GLSL}\n${IRIDESCENCE_SWIRL_GLSL}`,
      )
      // Post-lighting layers run in the stack's chosen order. Both are pure
      // vec3 -> vec3 functions, so swapping them is a genuine reorder rather
      // than two hardcoded pastes.
      //   dither -> ascii : characters are chosen from already-quantized tone
      //                     (crisper, more "printed")
      //   ascii -> dither : glyphs get thresholded, so the dither breaks up the
      //                     character shapes (grittier, degraded-terminal)
      .replace(
        "#include <dithering_fragment>",
        [
          "#include <dithering_fragment>",
          // Facing ratio, computed once and shared: three's view-space normal
          // and `vViewPosition` are locals of main(), so this is the only place
          // either screen can read them. See fsFormTone.
          //
          // `nonPerturbedNormal`, NOT `normal` — and today the two are the same
          // vector, so this line is byte-identical to what it replaced. It is
          // the guard on a coupling the texture layer's RELIEF channel would
          // otherwise open (lib/texture-shader.ts, added 2026-08-01): relief
          // perturbs `normal` so the specular lobe carries the pattern, and the
          // facing ratio below is the DITHER and ASCII form term. Reading the
          // perturbed vector here would let a texture preset move the dither's
          // threshold input, which is exactly the separation PRD §4 draws
          // ("Material ... must NOT control ASCII characters, dither
          // threshold"). Three's own chunk keeps the unperturbed copy for
          // precisely this class of question; use it.
          "float fsNdV = clamp(dot(normalize(nonPerturbedNormal), normalize(vViewPosition)), 0.0, 1.0);",
          "vec3 fsStackCol = gl_FragColor.rgb;",
          "if (uFsStackOrder < 0.5) {",
          "  fsStackCol = fsApplyDither(fsStackCol, fsNdV);",
          "  fsStackCol = fsApplyAscii(fsStackCol, fsNdV);",
          "} else {",
          "  fsStackCol = fsApplyAscii(fsStackCol, fsNdV);",
          "  fsStackCol = fsApplyDither(fsStackCol, fsNdV);",
          "}",
          "gl_FragColor.rgb = fsStackCol;",
        ].join("\n"),
      )
  }
  // One shared compiled program for every material carrying the style layers.
  // v6: adds the vFsObjNrm varying (triplanar texture) and the shared tone
  //     window / form-tone helpers used by both post-lighting screens.
  // v7: texture RELIEF perturbs `normal` / `clearcoatNormal` after
  //     <lights_physical_fragment>, and the screens' facing ratio moves to
  //     `nonPerturbedNormal`. The key has to move with the TEXT: three caches
  //     compiled programs on this key for the renderer's lifetime, so leaving it
  //     alone lets a live renderer keep serving the previous program — which is
  //     a change that measures as having no effect, the most expensive kind of
  //     wrong answer here.
  material.customProgramCacheKey = () => "freestroke-style-v7"
}
