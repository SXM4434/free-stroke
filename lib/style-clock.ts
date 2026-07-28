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
 *   completionPulse    a one-shot decaying burst triggered when the reveal
 *                      completes. Silent otherwise.
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
  /** Seconds since the reveal last reached 1 (Infinity if it never has). */
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
  clock.elapsed += delta
  const wasComplete = clock.reveal >= 1
  const isComplete = reveal >= 1
  if (isComplete && !wasComplete) {
    clock.sinceCompletion = 0
  } else if (isComplete) {
    clock.sinceCompletion += delta
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
}

export interface LayerTime {
  /** The phase a shader should use. */
  time: number
  /** 0..1 envelope. 1 = fully active. Drives one-shot and delayed modes. */
  amount: number
  /** True when this layer should be treated as animating right now. */
  active: boolean
}

const STATIC: LayerTime = { time: 0, amount: 0, active: false }

/**
 * completionPulse decay.
 *
 * A one-shot has to actually END. With a slow decay and a tiny cutoff the pulse
 * keeps creeping at ~10% strength for many seconds — measurably still moving,
 * which defeats the whole point of a one-shot (verified: consecutive-frame
 * change was 1.14 long after the burst, versus 0.00 for a genuinely still
 * layer). A faster decay plus a cutoff well above the visible floor gives the
 * pulse a definite lifetime of about 1.8s, after which the layer is exactly
 * static.
 */
const PULSE_DECAY_SECONDS = 0.55
const PULSE_CUTOFF = 0.04

/**
 * Computes a layer's phase for this frame.
 *
 * Returning an `amount` alongside `time` is what lets one-shot behaviours
 * (completionPulse) and deferred behaviours (delayedAfterReveal) share the same
 * interface as continuous ones: the caller multiplies its effect strength by
 * `amount` and does not need to know which mode is active.
 */
export function evaluateLayerTime(clock: StyleClock, cfg: LayerTiming): LayerTime {
  if (!cfg.animated) return STATIC

  const speed = cfg.speed
  const phase = cfg.phase ?? 0
  const delay = cfg.delay ?? 0
  const revealScale = cfg.revealScale ?? 4

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
      if (clock.sinceCompletion === Infinity) return STATIC
      const t = clock.sinceCompletion - delay
      if (t <= 0) return STATIC
      // Ease in over the first half second so the layer arrives rather than snaps.
      return { time: t * speed + phase, amount: Math.min(1, t / 0.5), active: true }
    }

    case "completionPulse": {
      if (clock.sinceCompletion === Infinity) return STATIC
      const t = clock.sinceCompletion - delay
      if (t <= 0) return STATIC
      // Exponential decay: strong at the moment of completion, gone shortly
      // after. `time` still advances so the effect moves while it fades.
      const amount = Math.exp(-t / PULSE_DECAY_SECONDS)
      if (amount < PULSE_CUTOFF) return STATIC
      return { time: t * speed + phase, amount, active: true }
    }

    case "loopSynced": {
      const loop = Math.max(cfg.loopSeconds ?? 4, 0.1)
      const t = Math.max(0, clock.elapsed - delay)
      // Wrapping keeps every layer on the same loop in lockstep, and means the
      // phase is identical at the start and end of each cycle.
      return { time: (t % loop) * speed + phase, amount: 1, active: true }
    }

    case "independent":
    default: {
      const t = Math.max(0, clock.elapsed - delay)
      if (t <= 0) return STATIC
      return { time: t * speed + phase, amount: 1, active: true }
    }
  }
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
