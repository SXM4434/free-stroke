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
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFsObjPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFsObjPos = position;")

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        [
          "#include <common>",
          "varying vec3 vFsObjPos;",
          "uniform float uFsStackOrder;",
          TEXTURE_COMMON_GLSL,
          SWEEP_COMMON_GLSL,
          DITHER_COMMON_GLSL,
          ASCII_COMMON_GLSL,
          // The blend helper must be declared before the apply functions use it.
          STACK_BLEND_GLSL,
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
          "vec3 fsStackCol = gl_FragColor.rgb;",
          "if (uFsStackOrder < 0.5) {",
          "  fsStackCol = fsApplyDither(fsStackCol);",
          "  fsStackCol = fsApplyAscii(fsStackCol);",
          "} else {",
          "  fsStackCol = fsApplyAscii(fsStackCol);",
          "  fsStackCol = fsApplyDither(fsStackCol);",
          "}",
          "gl_FragColor.rgb = fsStackCol;",
        ].join("\n"),
      )
  }
  // One shared compiled program for every material carrying the style layers.
  material.customProgramCacheKey = () => "freestroke-style-v5"
}
