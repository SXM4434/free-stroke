/**
 * Layer stack (POST_MVP_LAYER_STACK_PHASE_1).
 *
 * The stack is what turns three independent effects into a composition: which
 * layers are on, how strongly each one lands, how each one combines with what
 * is underneath, and in what order.
 *
 * WHAT CAN AND CANNOT BE REORDERED — an honest architectural constraint.
 * Texture is not a post-effect. It modulates albedo and roughness *before and
 * during* lighting, because that is what makes it read as a property of the
 * material rather than a sticker on top. Dither and ASCII both operate on the
 * final shaded tone, after lighting. So:
 *
 *   texture  ALWAYS first  (it is part of the surface, not a layer over it)
 *   dither <-> ascii       genuinely reorderable, both post-lighting
 *
 * Pretending texture could sit "above" ASCII would require rendering the whole
 * material twice. The UI therefore shows texture as the base layer rather than
 * offering an order control that silently does nothing.
 *
 * WHY ORDER MATTERS between dither and ASCII:
 *   dither -> ascii   tone is quantized first, so characters are chosen from
 *                     already-reduced tone. Fewer distinct characters, crisper,
 *                     more "printed".
 *   ascii -> dither   glyphs are drawn first and THEN thresholded, so the
 *                     dither breaks up the character shapes themselves. Grittier,
 *                     more degraded-terminal.
 */
import type { StyleState } from "./style-system"

/** Blend modes available to stack layers. Kept deliberately small for v1. */
export type StackBlendMode = "normal" | "multiply" | "screen"

export const STACK_BLEND_INDEX: Record<StackBlendMode, number> = {
  normal: 0,
  multiply: 1,
  screen: 2,
}

/** Which post-lighting layer runs first. */
export type StackOrder = "ditherFirst" | "asciiFirst"

export const STACK_ORDER_INDEX: Record<StackOrder, number> = {
  ditherFirst: 0,
  asciiFirst: 1,
}

/**
 * Shared GLSL blend helper. Every layer routes its result through this, so the
 * stack behaves consistently and a new blend mode only has to be added once.
 *
 * `multiply` darkens (it can only ever reduce), `screen` lightens (it can only
 * ever add) — the two classic complements. `amount` then mixes the blended
 * result back toward the untouched input, which is what makes a layer's
 * contribution dialable rather than all-or-nothing.
 */
export const STACK_BLEND_GLSL = /* glsl */ `
vec3 fsStackBlend(vec3 base, vec3 layer, float mode, float amount) {
  vec3 mixed = layer;
  if (mode > 0.5 && mode < 1.5) {
    mixed = base * layer;                       // multiply: darken only
  } else if (mode > 1.5) {
    mixed = 1.0 - (1.0 - base) * (1.0 - layer); // screen: lighten only
  }
  return mix(base, mixed, clamp(amount, 0.0, 1.0));
}
`

/**
 * Resolved per-layer stack settings. When the stack is DISABLED each layer
 * still renders with its own controls (the systems remain independently
 * usable); the stack simply stops scaling them.
 */
export interface ResolvedStack {
  textureAmount: number
  ditherAmount: number
  ditherBlend: number
  asciiAmount: number
  asciiBlend: number
  order: number
}

/**
 * Combines each layer's own intensity with its stack opacity.
 *
 * Multiplying rather than overriding is deliberate: a layer's own control still
 * means what it meant before, and the stack opacity is a second, composition-
 * level dial on top. Turning the stack off leaves every layer exactly as it was.
 */
export function resolveStack(s: StyleState): ResolvedStack {
  const on = s.layerStackEnabled
  return {
    textureAmount: on ? s.textureIntensity * s.stackTextureOpacity : s.textureIntensity,
    ditherAmount: on ? s.ditherIntensity * s.stackDitherOpacity : s.ditherIntensity,
    ditherBlend: STACK_BLEND_INDEX[on ? s.stackDitherBlend : "normal"],
    asciiAmount: on ? s.stackAsciiOpacity : 1,
    asciiBlend: STACK_BLEND_INDEX[on ? s.stackAsciiBlend : "normal"],
    order: STACK_ORDER_INDEX[on ? s.stackOrder : "ditherFirst"],
  }
}
