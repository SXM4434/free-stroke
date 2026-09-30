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
import {
  completionTrigger,
  pulseEnvelope,
  pingPongPhase,
  DEFAULT_REVEAL_SCALE,
  PULSE_CUTOFF,
  PULSE_SWELL,
} from "./style-clock"

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
 *
 * OVERDRIVE HEADROOM (stack craft pass): `amount` clamps at 1.6, not 1.0.
 * Only the group animation can push above 1 (completionPulse's swell). With a
 * hard 1.0 clamp the swell was ARCHITECTURALLY INVISIBLE on any preset whose
 * stack opacity already sat near 1 — amount went 1.0 → 1.6 → 1.0 and every
 * frame rendered identically (measured: settled-vs-peak Δ ≈ 0 on Terminal
 * Stack). Extrapolating the mix past 1 briefly EXAGGERATES the layer beyond
 * its resting look, which is what a completion swell is; the final clamp
 * keeps the result displayable.
 */
export const STACK_BLEND_GLSL = /* glsl */ `
vec3 fsStackBlend(vec3 base, vec3 layer, float mode, float amount) {
  vec3 mixed = layer;
  if (mode > 0.5 && mode < 1.5) {
    mixed = base * layer;                       // multiply: darken only
  } else if (mode > 1.5) {
    mixed = 1.0 - (1.0 - base) * (1.0 - layer); // screen: lighten only
  }
  return clamp(mix(base, mixed, clamp(amount, 0.0, 1.6)), 0.0, 1.0);
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
  /* GROUP OPACITY — the container's own level, multiplied into every layer at
   * once (PRD §4's "opacity"). It is resolved HERE and not in
   * `evaluateStackAnimation` on purpose: it is not motion. A group can sit at
   * 40% with nothing animating, and folding it into the animation would have
   * made it disappear the moment the animation was switched off — a dial whose
   * value silently stops applying is worse than one that is missing.
   *
   * Gated on `layerStackEnabled` alone, because until the stack is on there is
   * no container whose opacity this could be, and the individual layers are
   * still each user-controlled. Defaults to 1, so every existing composition
   * resolves byte-identically. */
  const g = on ? s.stackAnimationOpacity : 1
  return {
    textureAmount: on ? s.textureIntensity * s.stackTextureOpacity * g : s.textureIntensity,
    ditherAmount: on ? s.ditherIntensity * s.stackDitherOpacity * g : s.ditherIntensity,
    ditherBlend: STACK_BLEND_INDEX[on ? s.stackDitherBlend : "normal"],
    asciiAmount: on ? s.stackAsciiOpacity * g : 1,
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
  /** The group rides the draw-in playhead. See `StackAnimationType` in
   *  lib/style-system.ts for why it was added and what its honest limit is. */
  | "revealSynced"

export interface StackAnimationState {
  /** Group opacity multiplier, 0..1. */
  amount: number
  /** Phase added to every layer's own time. */
  timeOffset: number
  /** When true, layers should hold their current phase instead of advancing. */
  frozen: boolean
}

export const STACK_ANIM_NEUTRAL: StackAnimationState = { amount: 1, timeOffset: 0, frozen: false }

/* THE STRUCK-BELL ENVELOPE IS IMPORTED, NOT RE-STATED.
 *
 * This file used to carry its own copy — `STACK_PULSE_ATTACK = 0.09`,
 * `STACK_PULSE_DECAY = 0.5` — under a comment reading "Deliberately the same
 * shape and constants as the per-layer pulse in lib/style-clock.ts". The decay
 * was 0.5 and the per-layer one was 0.55, so the two had NOT been the same for
 * however long it took someone to tune one of them: the group's swell settled
 * at 1.70 s and the layers' at 1.86 s, and on a preset that fires both, the
 * container finished its event 162 ms before its contents finished theirs.
 *
 * That is what a duplicate costs here. Nothing renders wrong the day the copy
 * is made; the copy is what makes the later divergence invisible, and the
 * comment claiming they match is what makes it survive review. One idea, one
 * implementation — and `scripts/verify/assert-style-contracts.mjs` §1 now
 * measures the two scales against each other instead of trusting a sentence. */

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

  /* SPEED IS SIGNED, AND THE SIGN IS PRD §4's "DIRECTION".
   *
   * Splitting rate and direction into two state fields would have been two
   * dials multiplying into one scalar — the shape this repo already had to
   * unpick once when `fusionIntensity` turned out to be a coupling depth and a
   * motion switch at the same time. One signed number is the honest model for
   * a scalar phase offset.
   *
   * But the sign is only MEANINGFUL where the behaviour produces an offset.
   * `drift`, `loop` AND `revealSynced` slide the whole stack, and running them
   * backwards is a genuinely different read. Every other behaviour here is an
   * AMPLITUDE over time — a fade that arrives, an envelope that decays — and a
   * negative amplitude clock is not a direction, it is a fade that never
   * arrives and an envelope that is spent before it starts. (Verified by
   * reading each branch: with a raw negative `speed`, `fadeIn` returns
   * `min(1, negative/1.2)` → clamped at 0 forever, i.e. an invisible stack that
   * looks like a broken preset.) So those branches take `mag`.
   *
   * ⚠ THIS LIST USED TO PUT `revealSynced` ON THE WRONG SIDE, naming it as an
   * amplitude behaviour that "takes `mag`". Read the branch: it returns
   * `r * DEFAULT_REVEAL_SCALE * mag * dir + phase` — it honours the sign AND
   * the phase offset, and always has. The PANEL had it right all along (its
   * `dirLive` and `phaseLive` sets both include `revealSynced`), so the only
   * thing wrong was the prose, in the two files a reader would trust most.
   * `lib/style-system.ts`'s `stackAnimationSpeed` and `stackAnimationPhase`
   * docs carried the same error and are corrected too.
   *
   * The panel therefore disables the Direction control on every behaviour that
   * ignores it, rather than leaving a control on screen that does nothing —
   * the same rule the Inflate strip already follows for Blend/Resolution under
   * the loft strategy. */
  const mag = Math.abs(speed)
  const dir = speed < 0 ? -1 : 1

  switch (behaviour) {
    case "fadeIn": {
      // The stack arrives over ~1.2s of scene time, then stays.
      const t = elapsed * mag
      return { amount: Math.min(1, t / 1.2), timeOffset: 0, frozen: false }
    }

    case "pulse": {
      // Every layer breathes together. Bottoms out at 0.45 rather than 0 so the
      // composition never fully disappears.
      const v = 0.5 + 0.5 * Math.sin(elapsed * mag * 2.2 + phase)
      return { amount: 0.45 + v * 0.55, timeOffset: 0, frozen: false }
    }

    case "drift":
      // One shared phase offset added to every layer -> the whole stack slides.
      // Rate 0.6 -> 1.1 (stack craft pass): at 0.6 x the default preset speed
      // the ASCII grid moved ~0.2 cell/s, which read as STATIC in live
      // viewing. Decorative canvas motion is allowed to be present.
      return { amount: 1, timeOffset: elapsed * mag * 1.1 * dir + phase, frozen: false }

    case "revealSynced": {
      // THE GROUP IS THE PLAYHEAD. Strength tracks draw progress, and the
      // shared offset is driven by the same 0..1 rather than by wall clock, so
      // scrubbing the reveal backwards genuinely un-builds the stack instead of
      // continuing to advance it.
      //
      // `DEFAULT_REVEAL_SCALE` is `evaluateLayerTime`'s own default, IMPORTED
      // rather than re-typed as a bare `4` under a comment promising it
      // matched. A reveal-synced GROUP must travel the same distance over a
      // full draw as a default reveal-synced LAYER — one named idea, one
      // number, at both scales. (The live layers deliberately override the
      // default per layer; see the constant's own note.)
      const r = reveal < 0 ? 0 : reveal > 1 ? 1 : reveal
      return { amount: r, timeOffset: r * DEFAULT_REVEAL_SCALE * mag * dir + phase, frozen: false }
    }

    case "delayAfterReveal": {
      // The style stack lands AFTER the form is drawn.
      //
      // ARMING. `sinceCompletion` alone made this unreachable by hand: the
      // playhead rests at 1 after any draw, so by the time the user picked
      // this behaviour the "delay" had elapsed tens of seconds ago and the
      // stack was already at full strength on the first rendered frame — the
      // exact scene-start-fade trap this function's own `sinceArmed` doc
      // warns about, arriving through the other input. `completionTrigger`
      // takes whichever of completion / arming happened more recently, and
      // preserves the Infinity sentinel so "still drawing" stays silent.
      const s = completionTrigger(sinceCompletion, sinceArmed)
      if (s === Infinity) return { amount: 0, timeOffset: 0, frozen: false }
      return { amount: Math.min(1, (s * mag) / 0.6), timeOffset: 0, frozen: false }
    }

    case "completionPulse": {
      // One-shot swell when the drawing finishes, then back to the normal look.
      const s = completionTrigger(sinceCompletion, sinceArmed)
      if (s === Infinity) return { amount: 1, timeOffset: 0, frozen: false }
      // Same struck-bell envelope as the per-layer sibling (lib/style-clock.ts):
      // a short attack so the peak is actually SEEN, then the settle. A bare
      // decay peaks on frame one and the eye only ever catches the tail.
      const env = pulseEnvelope(s * mag)
      if (env < PULSE_CUTOFF) return STACK_ANIM_NEUTRAL
      // Swell ABOVE the resting value, then settle back to exactly 1.
      return { amount: 1 + env * PULSE_SWELL, timeOffset: 0, frozen: false }
    }

    case "freezeOnComplete":
      // Animated layers run during the draw, then hold their final frame — so a
      // still export matches what the viewer last saw moving.
      return { amount: 1, timeOffset: 0, frozen: reveal >= 1 }

    case "loop": {
      // Shared PING-PONG offset on the loop clock: the stack slides out and
      // returns home once per cycle.
      //
      // Why not a plain wrapped offset (the v1 behaviour): between wraps a
      // wrap is indistinguishable from `drift` (judged live — same slide,
      // same look), and AT the wrap the offset snapped N units back, which
      // is only seamless for patterns that happen to be periodic in the
      // offset. A there-and-back cycle is visibly a REPEATING figure, never
      // jumps, and stays honest about riding the shared loop clock.
      // `pingPongPhase` (lib/style-clock.ts) is now the single home for this
      // law. It was written out here AND, differently, in `evaluateLayerTime`'s
      // `loopSynced`, which still sawtoothed — see that case for the 479x snap
      // that cost. Two callers, one function, so they cannot drift again.
      return { amount: 1, timeOffset: pingPongPhase(elapsed * mag, loopSeconds) * dir + phase, frozen: false }
    }

    default:
      return STACK_ANIM_NEUTRAL
  }
}
