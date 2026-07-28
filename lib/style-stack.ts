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


/* ------------------------- stack-level animation ------------------------- */
/**
 * Stack animation animates the WHOLE GROUP as one container, while the layers
 * inside stay independently editable — the Photoshop layer-group / After
 * Effects precomp idea from the PRD.
 *
 * This is a different thing from both of its neighbours:
 *   per-layer animation  each layer moves on its own (already built)
 *   STACK animation      the group moves together (this)
 *   fusion animation     layers influence EACH OTHER (a later phase)
 *
 * It works by producing two group-level values that every layer then respects:
 *   `amount`      multiplies each layer's contribution -> fades and pulses
 *   `timeOffset`  adds to each layer's phase -> the whole stack drifts together
 * Because both apply uniformly, the layers keep their relative balance: a
 * preset tuned to "ASCII dominant, others supporting" stays that way while the
 * group fades in.
 */
export type StackAnimationBehaviour =
  | "none"
  | "fadeIn"
  | "pulse"
  | "drift"
  | "delayAfterReveal"
  | "completionPulse"
  | "freezeOnComplete"
  | "loop"

export interface StackAnimationState {
  /** Group opacity multiplier, 0..1. */
  amount: number
  /** Phase added to every layer's own time. */
  timeOffset: number
  /** When true, layers should hold their current phase instead of advancing. */
  frozen: boolean
}

export const STACK_ANIM_NEUTRAL: StackAnimationState = { amount: 1, timeOffset: 0, frozen: false }

/**
 * Evaluates the group-level animation for this frame.
 *
 * `elapsed`, `reveal` and `sinceCompletion` come from the shared style clock —
 * the same clock the individual layers use, which is what keeps group motion and
 * layer motion coherent instead of drifting apart.
 */
export function evaluateStackAnimation(opts: {
  enabled: boolean
  behaviour: StackAnimationBehaviour
  speed: number
  phase: number
  /**
   * Seconds since this behaviour was ARMED, not since the scene started.
   *
   * This distinction is load-bearing. `fadeIn` measured from scene start is
   * invisible: by the time a user enables it, scene time is already far past
   * the fade duration, so the group is at full strength before the first frame
   * renders and nothing appears to happen. Measuring from the moment the
   * behaviour was switched on makes "fade in" mean what it says, and makes
   * drift and loop start from a sensible phase instead of an arbitrary one.
   */
  sinceArmed: number
  reveal: number
  sinceCompletion: number
  loopSeconds: number
}): StackAnimationState {
  const { enabled, behaviour, speed, phase, sinceArmed, reveal, sinceCompletion, loopSeconds } = opts
  const elapsed = sinceArmed
  if (!enabled || behaviour === "none") return STACK_ANIM_NEUTRAL

  switch (behaviour) {
    case "fadeIn": {
      // The stack arrives over ~1.2s of scene time, then stays.
      const t = elapsed * speed
      return { amount: Math.min(1, t / 1.2), timeOffset: 0, frozen: false }
    }

    case "pulse": {
      // Every layer breathes together. Bottoms out at 0.45 rather than 0 so the
      // composition never fully disappears.
      const v = 0.5 + 0.5 * Math.sin(elapsed * speed * 2.2 + phase)
      return { amount: 0.45 + v * 0.55, timeOffset: 0, frozen: false }
    }

    case "drift":
      // One shared phase offset added to every layer -> the whole stack slides.
      return { amount: 1, timeOffset: elapsed * speed * 0.6 + phase, frozen: false }

    case "delayAfterReveal": {
      // The style stack lands AFTER the form is drawn.
      if (sinceCompletion === Infinity) return { amount: 0, timeOffset: 0, frozen: false }
      return { amount: Math.min(1, (sinceCompletion * speed) / 0.6), timeOffset: 0, frozen: false }
    }

    case "completionPulse": {
      // One-shot swell when the drawing finishes, then back to the normal look.
      if (sinceCompletion === Infinity) return { amount: 1, timeOffset: 0, frozen: false }
      const decay = Math.exp(-(sinceCompletion * speed) / 0.5)
      if (decay < 0.04) return STACK_ANIM_NEUTRAL
      // Swell ABOVE the resting value, then settle back to exactly 1.
      return { amount: 1 + decay * 0.6, timeOffset: 0, frozen: false }
    }

    case "freezeOnComplete":
      // Animated layers run during the draw, then hold their final frame — so a
      // still export matches what the viewer last saw moving.
      return { amount: 1, timeOffset: 0, frozen: reveal >= 1 }

    case "loop": {
      // Wrapped shared offset: the whole stack repeats seamlessly.
      const loop = Math.max(loopSeconds, 0.1)
      return { amount: 1, timeOffset: ((elapsed * speed) % loop) + phase, frozen: false }
    }

    default:
      return STACK_ANIM_NEUTRAL
  }
}
