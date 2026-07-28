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
  type TextureUniforms,
} from "./texture-shader"
import { DITHER_COMMON_GLSL, DITHER_FRAGMENT_GLSL, type DitherUniforms } from "./dither-shader"
import { ASCII_COMMON_GLSL, ASCII_FRAGMENT_GLSL, type AsciiUniforms } from "./ascii-shader"

export interface StyleShaderUniforms {
  texture: TextureUniforms
  dither: DitherUniforms
  ascii: AsciiUniforms
}

/**
 * Installs every style layer on one material. Uniform objects are shared by
 * reference, so per-frame updates write straight through — no recompiles, no
 * material swaps, no geometry rebuilds.
 */
export function applyStyleShader(material: THREE.Material, u: StyleShaderUniforms): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u.texture, u.dither, u.ascii)

    // Object-space position varying, shared by every layer that can be
    // object-locked. `position` is the raw vertex attribute before any matrix
    // transform, so patterns stay glued to the geometry under camera orbit.
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vFsObjPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvFsObjPos = position;")

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying vec3 vFsObjPos;\n${TEXTURE_COMMON_GLSL}\n${DITHER_COMMON_GLSL}\n${ASCII_COMMON_GLSL}`,
      )
      .replace("#include <map_fragment>", `#include <map_fragment>\n${TEXTURE_MAP_GLSL}`)
      .replace(
        "#include <lights_physical_fragment>",
        `#include <lights_physical_fragment>\n${TEXTURE_LIGHTS_GLSL}`,
      )
      // ASCII runs AFTER dither: dither reduces the tone, ASCII then renders
      // that tone as characters. Reversing them would dither the glyph edges
      // into mush instead of quantizing the surface the glyphs represent.
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>\n${DITHER_FRAGMENT_GLSL}\n${ASCII_FRAGMENT_GLSL}`,
      )
  }
  // One shared compiled program for every material carrying the style layers.
  material.customProgramCacheKey = () => "freestroke-style-v3"
}
