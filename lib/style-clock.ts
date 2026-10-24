/**
 * Shared visual timing system (POST_MVP_VISUAL_TIMING_SYSTEM_PHASE_1).
 *
 * WHY THIS EXISTS. Texture, dither and ASCII each grew their own clock logic
 * while they were being built, with slightly different multipliers, different
 * reveal handling, and no concept of delay or loop. That is three
 * near-duplicate implementations that would drift apart, and it makes
 * "everything pulses together on completion" impossible to express. This module
 * is the single place a layer's animation phase is computed.
 *
 * THE MODEL. Every animated layer asks the same question — "what is my phase
 * right now?" — and the answer depends on:
 *
 *   the CLOCK        one shared, monotonically advancing time for the scene
 *   the SYNC MODE    which clock this layer actually rides
 *   the LAYER CONFIG speed, phase offset, delay, loop length
 *   the REVEAL       draw-in progress, and whether it just completed
 *
 * Sync modes, and what each is for:
 *
 *   independent        free-running scene time. The layer animates on its own.
 *   revealSynced       phase IS draw-in progress. The effect travels with the
 *                      stroke as it is written, and freezes when drawing stops.
 *   strokeTimeSynced   like revealSynced but scaled by the stroke's real
 *                      duration, so a slowly-drawn stroke gets slow style
 *                      motion — the gesture's own tempo, not the playhead's.
 *   delayedAfterReveal free-running, but the clock does not start until the
 *                      draw-in has finished. Lets style land AFTER the form.
 *   completionPulse    a one-shot swell above the resting look, triggered when
 *                      the reveal completes (or when the mode is selected on an
 *                      already-finished stroke). Rests at normal otherwise.
 *   loopSynced         free-running time wrapped to a fixed loop length, so
 *                      several layers on the same loop stay in lockstep and the
 *                      whole stack can repeat seamlessly.
 *
 * NOTHING HERE TOUCHES GEOMETRY. This computes numbers that become shader
 * uniforms. It never reads or writes geometry, the reveal playhead, or export.
 */
import type { StyleSyncMode } from "./style-system"

/** Scene-level clock state, advanced once per frame and shared by all layers. */
export interface StyleClock {
  /** Free-running seconds since the scene started. */
  elapsed: number
  /** Draw-in progress, 0..1. */
  reveal: number
  /**
   * Seconds since the reveal last reached 1. `Infinity` when it never has —
   * a SENTINEL for "no completion has happened", not a large number.
   *
   * This grows without bound while the playhead rests at 1, and that is
   * correct: it answers exactly the question it is named for. What it cannot
   * answer alone is "should this behaviour be playing right now", because a
   * user arming a completion-keyed effect on a long-finished stroke would find
   * every envelope already spent. Consumers pair it with their own arming time
   * through `completionTrigger`.
   */
  sinceCompletion: number
  /** Total duration of the drawn stroke in ms (for strokeTimeSynced). */
  strokeDurationMs: number
}

export function createStyleClock(): StyleClock {
  return { elapsed: 0, reveal: 0, sinceCompletion: Infinity, strokeDurationMs: 0 }
}

/**
 * Advances the shared clock. Call once per frame, before evaluating layers.
 * Detects reveal completion by watching for the 0..1 boundary crossing rather
 * than testing `reveal >= 1` every frame, so `sinceCompletion` measures from
 * the moment it finished and a paused-at-1 playhead does not retrigger.
 */
export function advanceStyleClock(
  clock: StyleClock,
  delta: number,
  reveal: number,
  strokeDurationMs: number,
): void {
  /* THE CLOCK CANNOT BE ALLOWED TO GO NaN, BECAUSE IT NEVER COMES BACK.
   *
   * `clock.elapsed` is a running accumulator, so a single non-finite `delta`
   * poisons it for the rest of the session: every later frame adds to NaN,
   * `armedFor` returns NaN into every layer, and every phase, envelope and
   * offset downstream is NaN. There is no recovery path anywhere — the only
   * cure is a reload, and the symptom is "all the style layers stopped", which
   * reads as a broken renderer rather than as one bad frame.
   *
   * A negative delta is rejected for the same reason in the other direction: it
   * runs the shared clock backwards under layers whose `sinceArmed` is a
   * difference against it, which makes a one-shot re-fire.
   *
   * This is cheap insurance rather than a fix for an observed crash — R3F's
   * delta is well behaved — but the failure it prevents is unrecoverable and
   * silent, which is the combination worth a branch. */
  const dt = Number.isFinite(delta) && delta > 0 ? delta : 0
  clock.elapsed += dt
  const wasComplete = clock.reveal >= 1
  const isComplete = reveal >= 1
  if (isComplete && !wasComplete) {
    clock.sinceCompletion = 0
  } else if (isComplete) {
    clock.sinceCompletion += dt
  } else {
    // Scrubbing backwards / replaying re-arms the completion trigger.
    clock.sinceCompletion = Infinity
  }
  clock.reveal = reveal
  clock.strokeDurationMs = strokeDurationMs
}

/** Per-layer timing configuration. */
export interface LayerTiming {
  /** Master switch — false means the layer is static. */
  animated: boolean
  syncMode: StyleSyncMode
  speed: number
  /** Constant offset added to the final phase. Staggers otherwise-identical layers. */
  phase?: number
  /** Seconds to wait before this layer starts moving. */
  delay?: number
  /** Loop length in seconds for `loopSynced`. */
  loopSeconds?: number
  /** Scales how far reveal-driven modes travel over the full draw-in. */
  revealScale?: number
  /**
   * Seconds since THIS layer's animation identity was last changed — the layer
   * equivalent of the `sinceArmed` that `evaluateStackAnimation` has always
   * taken. Every free-running and completion-driven mode measures from here
   * rather than from scene start.
   *
   * Scene start is almost never the right origin. `delay` measured from it is
   * not a delay: by the time a user drags the Delay dial, scene time is already
   * minutes past whatever they set, so the wait had "always already happened".
   * `loopSynced` measured from it drops the user into an arbitrary point of the
   * cycle instead of its beginning.
   *
   * Omitted falls back to `clock.elapsed`, i.e. the old scene-start behaviour,
   * so a caller that has no arming bookkeeping still gets continuous motion.
   */
  sinceArmed?: number
}

export interface LayerTime {
  /** The phase a shader should use. Always meaningful — a resting layer
   *  reports its own `phase`, never 0, so nothing jumps when motion stops. */
  time: number
  /**
   * The multiplier the caller applies to this layer's strength — ALWAYS, in
   * every branch, with no conditional.
   *
   *   1   resting: the layer renders exactly as its own controls say
   *   0   silent: the layer contributes nothing (a deferred mode, pre-arrival)
   *   >1  overdriven: a one-shot swelling ABOVE the resting look
   *
   * THE BUG THIS REPLACES. `amount` used to be 0 in the not-animating case and
   * callers compensated with `active && amount < 1 ? base * amount : base` —
   * i.e. they read "not active" as FULL strength. That inverted every one-shot:
   * completionPulse rendered full, decayed to the 4% cutoff, then SNAPPED BACK
   * to full the instant the envelope expired, because expiry returned the
   * not-active sentinel and the caller read the sentinel as a legitimate 1.
   * A sentinel meaning "not applicable" must never be handed to a consumer that
   * will treat it as a value. Now the two states are distinct objects
   * (`resting()` vs `SILENT`) and the caller just multiplies.
   */
  amount: number
  /** True when `time` is advancing this frame. Callers use it for diagnostics
   *  and freeze handling — NOT to decide whether `amount` applies. */
  active: boolean
}

/** A layer that is not animating: present at full strength, phase parked. */
function resting(phase: number): LayerTime {
  return { time: phase, amount: 1, active: false }
}
/** A layer whose deferred envelope has not opened yet: contributes nothing. */
const SILENT: LayerTime = { time: 0, amount: 0, active: false }

/**
 * completionPulse envelope.
 *
 * A one-shot has to actually END. With a slow decay and a tiny cutoff the pulse
 * keeps creeping at ~10% strength for many seconds — measurably still moving,
 * which defeats the whole point of a one-shot (verified: consecutive-frame
 * change was 1.14 long after the burst, versus 0.00 for a genuinely still
 * layer). A faster decay plus a cutoff well above the visible floor gives the
 * pulse a definite lifetime, after which the layer is exactly static.
 *
 * THE ATTACK IS NOT DECORATION. A bare `exp(-t/τ)` peaks on the frame the
 * trigger fires, so the peak occupies ONE frame and everything the eye actually
 * catches is the tail — which is why the mode read as "something faded for no
 * reason" rather than as an event. A short linear attack puts a visible rise in
 * front of the settle: fast in, slow out, the struck-bell envelope the
 * 12-principles / timing-mastery material calls for on an impact accent. 90 ms
 * is ~5 frames at 60 Hz — enough to be seen, short enough to still read as a
 * hit rather than a fade-in.
 *
 * Durations here sit far above the 300 ms UI ceiling in `review-animations`
 * deliberately: this is decorative canvas motion on the artwork itself, the
 * framework's "can be longer" tier, not UI feedback the user is waiting on.
 */
export const PULSE_ATTACK_SECONDS = 0.09
const PULSE_DECAY_SECONDS = 0.55
export const PULSE_CUTOFF = 0.04
/** When the envelope is spent. Phase freezes here so nothing jumps at expiry. */
export const PULSE_LIFETIME =
  PULSE_ATTACK_SECONDS + PULSE_DECAY_SECONDS * Math.log(1 / PULSE_CUTOFF)

/**
 * 0 → 1 → 0 impact envelope, `t` measured from the trigger.
 *
 * ⚠ THIS IS THE ONLY IMPLEMENTATION, AND IT IS EXPORTED FOR THAT REASON.
 *
 * It used to be private, and `lib/style-stack.ts` carried a second copy for the
 * GROUP-scale pulse with a comment reading "Deliberately the same shape and
 * constants as the per-layer pulse in lib/style-clock.ts" — while this file
 * carried the mirror claim, "Matches `evaluateStackAnimation`'s
 * `completionPulse` exactly". Both claims were false. The copy's decay was 0.5
 * against this one's 0.55, so the group's swell died 162 ms before the layers'
 * (measured: settled by 1.70 s vs 1.86 s, differing on 9 of 15 sampled moments)
 * and one named event finished twice, at two different times.
 *
 * Nothing rendered wrong on the day it drifted, which is the whole problem: two
 * copies of one idea are correct exactly until someone tunes one of them, and
 * the comment asserting they match is what makes the drift invisible to review.
 * `scripts/verify/assert-style-contracts.mjs` §1 now compares the two scales'
 * output directly, so the claim is checked rather than written down.
 */
export function pulseEnvelope(t: number): number {
  if (t <= 0) return 0
  if (t < PULSE_ATTACK_SECONDS) return t / PULSE_ATTACK_SECONDS
  return Math.exp(-(t - PULSE_ATTACK_SECONDS) / PULSE_DECAY_SECONDS)
}

/**
 * How much the completionPulse swells ABOVE the resting look at its peak.
 * Shared with `evaluateStackAnimation`'s `completionPulse` (lib/style-stack.ts),
 * which imports it — the same named behaviour at two scales is one idea, so it
 * is one number in one place.
 */
export const PULSE_SWELL = 0.6

/**
 * How far a reveal-driven layer travels over a full draw-in, when the caller
 * does not say. Exported because `evaluateStackAnimation`'s `revealSynced`
 * needs the same distance for the GROUP — a reveal-synced group and a
 * reveal-synced layer must cover the same ground or the two read as two
 * unrelated effects. It was a bare `4` there, under a comment promising it
 * matched this default.
 *
 * Note that the live layers deliberately override it per layer (texture 4,
 * dither 6, ASCII 8 — components/viewport-3d.tsx), so this is the DEFAULT, not
 * the app's only reveal scale.
 */
export const DEFAULT_REVEAL_SCALE = 4

/**
 * THE LOOP OFFSET, AND IT IS ONE LAW WITH TWO CALLERS.
 *
 * Maps elapsed seconds onto a there-and-back ramp `0 -> loop/2 -> 0`, so an
 * offset consumed as a TRANSLATION returns home continuously instead of
 * snapping. `evaluateLayerTime`'s `loopSynced` and `evaluateStackAnimation`'s
 * `loop` both call it.
 *
 * ── WHY IT IS A FUNCTION AND NOT TWO LOCAL EXPRESSIONS ────────────────────
 * It was two local expressions, and they had drifted into two different
 * behaviours: the stack ping-ponged and the layer sawtoothed. That is the
 * repo's most expensive recurring defect — one idea, two implementations, one
 * of them still carrying the bug the other had already been fixed for. A shared
 * function is the only version of this that cannot drift again.
 *
 * `t` is clamped at 0 and the modulo is taken twice so a negative `t` (a caller
 * subtracting a delay it has not reached) wraps forward rather than returning a
 * negative offset.
 */
export function pingPongPhase(t: number, loopSeconds: number): number {
  const loop = Math.max(loopSeconds, 0.1)
  const w = (((t % loop) + loop) % loop)
  return w < loop / 2 ? w : loop - w
}

/**
 * When a completion-driven behaviour should consider itself triggered.
 *
 * THE RULE. A behaviour keyed to "the draw finished" has two honest origins:
 * the completion itself, and the moment the user ARMED the behaviour. Take
 * whichever happened more recently — the smaller elapsed time — but only once a
 * completion has actually happened.
 *
 * WHY BOTH. After any stroke is drawn the playhead rests at 1 forever, so
 * `sinceCompletion` grows without bound. By the time a user finds "Completion
 * Flash" in a panel it is tens of seconds stale and every completion-keyed
 * envelope is long spent — the option is unreachable by hand, and reads as an
 * option that does nothing. Arming is the second origin that makes it reachable.
 *
 * WHY THE SENTINEL MUST SURVIVE. `sinceCompletion` is `Infinity` while the
 * stroke is still drawing or has been scrubbed back. That is a sentinel meaning
 * "not applicable", not a large number. This was written in three places as
 *
 *   Math.min(since === Infinity ? Infinity : since, sinceArmed)
 *
 * which is a tautology: the ternary returns `since` unchanged, and
 * `Math.min(Infinity, x)` is `x`. The sentinel was discarded, so the branch
 * handling "still drawing" became unreachable — `scanlineBalloon`'s reveal-
 * following branch is dead code for exactly this reason. The ternary has to be
 * OUTSIDE the `min`.
 */
export function completionTrigger(sinceCompletion: number, sinceArmed: number): number {
  if (!Number.isFinite(sinceCompletion)) return Infinity
  return Math.min(sinceCompletion, sinceArmed)
}

/**
 * Computes a layer's phase for this frame.
 *
 * Returning an `amount` alongside `time` is what lets one-shot behaviours
 * (completionPulse) and deferred behaviours (delayedAfterReveal) share the same
 * interface as continuous ones: the caller multiplies its effect strength by
 * `amount` and does not need to know which mode is active.
 */
export function evaluateLayerTime(clock: StyleClock, cfg: LayerTiming): LayerTime {
  const phase = cfg.phase ?? 0
  if (!cfg.animated) return resting(phase)

  const speed = cfg.speed
  const delay = cfg.delay ?? 0
  const revealScale = cfg.revealScale ?? DEFAULT_REVEAL_SCALE
  const armed = cfg.sinceArmed ?? clock.elapsed

  switch (cfg.syncMode) {
    case "revealSynced":
      return {
        time: clock.reveal * revealScale * speed + phase,
        amount: 1,
        active: true,
      }

    case "strokeTimeSynced": {
      // The gesture's own tempo: a stroke drawn over 4s animates 4x slower
      // than the same stroke drawn over 1s. Falls back to reveal-synced when
      // no duration is known.
      const seconds = clock.strokeDurationMs > 0 ? clock.strokeDurationMs / 1000 : 1
      return {
        time: clock.reveal * seconds * speed + phase,
        amount: 1,
        active: true,
      }
    }

    case "delayedAfterReveal": {
      // The whole point of this mode is that style lands AFTER the form, so
      // before it opens the layer is genuinely SILENT — not "resting at full
      // strength, which is what the old not-active sentinel produced and what
      // made the mode look like it fired backwards.
      const s = completionTrigger(clock.sinceCompletion, armed)
      if (s === Infinity) return SILENT
      const t = s - delay
      if (t <= 0) return SILENT
      // Ease in over the first half second so the layer arrives rather than snaps.
      return { time: t * speed + phase, amount: Math.min(1, t / 0.5), active: true }
    }

    case "completionPulse": {
      // A SWELL ABOVE THE RESTING LOOK, not a burst out of nothing. This used
      // to rest at 0 and peak at 1, which meant an enabled layer was invisible
      // whenever the pulse was not firing — indistinguishable from a broken
      // layer. Its sibling `evaluateStackAnimation`'s `completionPulse` already
      // rested at 1 and swelled to 1.6; matching it makes one named behaviour
      // read as one idea at both scales, and guarantees the option can never
      // leave the user with a blank layer.
      const s = completionTrigger(clock.sinceCompletion, armed)
      if (s === Infinity) return resting(phase)
      const t = s - delay
      if (t <= 0) return resting(phase)
      const env = pulseEnvelope(t)
      if (env < PULSE_CUTOFF) {
        // Spent. Park the phase where the envelope ended rather than at 0:
        // returning to phase 0 here snapped the pattern sideways at the exact
        // moment the pulse was supposed to have quietly finished.
        return { time: PULSE_LIFETIME * speed + phase, amount: 1, active: false }
      }
      // `time` still advances so the effect moves while it swells and settles.
      return { time: t * speed + phase, amount: 1 + env * PULSE_SWELL, active: true }
    }

    case "loopSynced": {
      const loop = Math.max(cfg.loopSeconds ?? 4, 0.1)
      const t = Math.max(0, armed - delay)
      /* PING-PONG, NOT A SAWTOOTH — and the sibling had already been fixed.
       *
       * This used to be `(t % loop) * speed + phase`. `time` is consumed as a
       * TRANSLATION: `fsDCo += vec2(dirX, dirY) * uFsDitTime`
       * (lib/dither-shader.ts:236) and the texture and ASCII paths do the same.
       * So at the wrap the offset does not "return to the same phase" as the old
       * comment claimed — it jumps back `loop * speed` units in one frame, which
       * is seamless only for a pattern that happens to be periodic in the offset.
       * Grain, blue noise and the ASCII grid are not.
       *
       * Measured at 120 Hz over 10 s, speed 1.2, loop 4 s: max consecutive-frame
       * Δphase 4.7900 against a typical 0.0100 — a 479x snap, once per cycle.
       *
       * `evaluateStackAnimation`'s `loop` (lib/style-stack.ts) hit this exact
       * defect and was fixed to a there-and-back cycle, with its reasoning
       * written out: *"AT the wrap the offset snapped N units back, which is only
       * seamless for patterns that happen to be periodic in the offset."* That
       * fix never reached the per-LAYER loop, so one idea shipped in two places
       * with one of them still carrying the bug — this repo's most expensive
       * recurring defect, in its exact canonical shape.
       *
       * `pingPongPhase` is now the single home for the law and BOTH callers use
       * it, so they cannot drift apart again.
       *
       * THE TRADE, stated rather than hidden: a there-and-back cycle covers half
       * the travel a sawtooth did in the same period, so a `loopSynced` layer
       * now reads as a repeating figure rather than a one-way crawl that resets.
       * That is the same trade the stack took deliberately. */
      return { time: pingPongPhase(t, loop) * speed + phase, amount: 1, active: true }
    }

    case "independent":
    default: {
      const t = armed - delay
      // During the delay the layer is PRESENT and still — a delay defers
      // motion, it does not remove the layer. (Contrast delayedAfterReveal,
      // where absence is the point.)
      if (t <= 0) return resting(phase)
      return { time: t * speed + phase, amount: 1, active: true }
    }
  }
}

/**
 * A KEYED SPEED, AS A RUNNING SUM (K2, his ruling of 2026-09-26: "keys drive a
 * loop's speed, never its phase").
 *
 * `evaluateLayerTime` computes a layer's phase as speed times the layer's own
 * time: `t * speed` running free, `pingPong(t) * speed` looping, `reveal *
 * scale * speed` reveal-synced. With a constant speed that is the same as
 * summing speed over time. With a KEYED speed it is not: a step from 1 to 3 at
 * 2 s would move the phase from 2 to 6 in one frame, a jump of 4 units, where
 * the loop should simply start going faster.
 *
 * So a keyed layer keeps a running sum instead. Each frame the layer's time is
 * evaluated at speed 1 and phase 0, which is the mode's own base (t, the ping-
 * pong position, the scaled reveal), and the phase advances by this frame's
 * speed times the base's change. A speed change bends the motion and never
 * jumps it. The sum restarts when the layer re-arms (its armed time goes back)
 * or the clock is re-based (an export zeroing it).
 *
 * Only layers whose speed is keyed use this; an unkeyed layer keeps
 * `evaluateLayerTime` itself, so nothing that is not keyed moves by a bit.
 */
export interface RunningPhase {
  /** The mode's base (time at speed 1) on the last frame. */
  base: number
  /** The layer's armed time on the last frame; a drop means it re-armed. */
  armed: number
  /** The running sum of speed over the base. */
  travel: number
}

export function createRunningPhase(): RunningPhase {
  return { base: Number.NaN, armed: Number.NaN, travel: 0 }
}

export function runningLayerTime(clock: StyleClock, cfg: LayerTiming, acc: RunningPhase): LayerTime {
  if (!cfg.animated) {
    // A still layer rests at its phase; the next time it moves, the sum starts over.
    acc.base = Number.NaN
    return evaluateLayerTime(clock, cfg)
  }
  const unit = evaluateLayerTime(clock, { ...cfg, speed: 1, phase: 0 })
  const phase = cfg.phase ?? 0
  const armed = cfg.sinceArmed ?? clock.elapsed
  const base = unit.time
  if (!Number.isFinite(acc.base) || armed < acc.armed) {
    // First frame, or the layer re-armed: start the sum where a constant speed would be.
    acc.travel = cfg.speed * base
  } else {
    acc.travel += cfg.speed * (base - acc.base)
  }
  acc.base = base
  acc.armed = armed
  return { ...unit, time: acc.travel + phase }
}

/**
 * The same running sum for a loop that is not one of the three shader layers
 * (the material's): `base` is its time at speed 1, which only goes forward
 * while it runs. A base that goes back (an export re-basing the clock, a
 * scrub back under "sync to draw") starts the sum again where a constant speed
 * would be, as a re-arm does above.
 */
export function runningSum(acc: RunningPhase, base: number, speed: number): number {
  if (!Number.isFinite(acc.base) || base < acc.base) acc.travel = speed * base
  else acc.travel += speed * (base - acc.base)
  acc.base = base
  return acc.travel
}

/**
 * Arming bookkeeping, shared by every caller so the rule lives in one place.
 *
 * `key` is the behaviour's IDENTITY — enough to notice "the user chose a
 * different thing", and deliberately NOT enough to notice "the user nudged a
 * speed dial". Re-arming resets phase to 0, so a key that includes continuous
 * parameters would restart the animation on every drag.
 */
export interface ArmState {
  key: string
  at: number
}

export function createArmState(): ArmState {
  return { key: "", at: 0 }
}

/** Re-arms when `key` changes; returns seconds since the current arming. */
export function armedFor(arm: ArmState, key: string, elapsed: number): number {
  if (arm.key !== key) {
    arm.key = key
    arm.at = elapsed
  }
  return elapsed - arm.at
}

/**
 * Maps the coarse user-facing MotionMode onto a StyleSyncMode. `motionMode` is
 * the single control shown in the UI today; per-layer sync modes are the finer
 * grain underneath. Keeping the mapping here means the renderers never branch
 * on motionMode themselves.
 */
export function resolveSyncMode(
  motionMode: "off" | "independent" | "syncToDraw",
  layerSyncMode: StyleSyncMode,
): { animated: boolean; syncMode: StyleSyncMode } {
  if (motionMode === "off") return { animated: false, syncMode: layerSyncMode }
  if (motionMode === "syncToDraw") {
    // "Sync to Draw" means reveal-driven, unless the layer has explicitly opted
    // into a more specific reveal-related behaviour.
    const revealAware =
      layerSyncMode === "completionPulse" ||
      layerSyncMode === "delayedAfterReveal" ||
      layerSyncMode === "strokeTimeSynced"
    return { animated: true, syncMode: revealAware ? layerSyncMode : "revealSynced" }
  }
  // Independent: honour loop/pulse/delay choices, otherwise free-run.
  const freeRunning =
    layerSyncMode === "loopSynced" ||
    layerSyncMode === "completionPulse" ||
    layerSyncMode === "delayedAfterReveal"
  return { animated: true, syncMode: freeRunning ? layerSyncMode : "independent" }
}
