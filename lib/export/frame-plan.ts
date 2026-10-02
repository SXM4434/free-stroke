/**
 * THE FRAME PLAN — what an animated export is, before any pixels exist.
 *
 * ── WHY A PLAN AND NOT A RECORDER ─────────────────────────────────────────
 * The obvious way to export the animation is to press Play and record the
 * screen for as long as it takes. Every tool in this category that is any good
 * says, in its own words, not to: Spline's own video-export documentation reads
 * *"Instead of relying on recording the screen, it renders defined animations
 * for maximum precision, ensuring consistent transition timing and smooth
 * playback"* (docs.spline.design, captured 2026-08-01 →
 * `docs/refs-competitive/ref-12-spline-export.png`), and the canonical
 * canvas-capture library is called, in its own repo description, *"A library to
 * capture canvas-based animations at a fixed framerate"*
 * (github.com/spite/ccapture.js, `ref-08-ccapture.png`).
 *
 * The reason is arithmetic. A screen recorder samples wall-clock time, so the
 * output's timing is the timing of the RENDER, not of the animation: a frame
 * that took 90 ms to draw occupies 90 ms of the file. Free Stroke's whole
 * subject is a mark replayed at the speed the pen actually moved — so a
 * wall-clock recorder does not merely add jitter, it OVERWRITES the one thing
 * the product is about. The plan below is the fix: the export decides, up
 * front, exactly which instants it wants, and the renderer is then asked for
 * each of them in turn however long that takes.
 *
 * ── WHY THE PLAN CARRIES A TIMEBASE ───────────────────────────────────────
 * `timebase: "pen"` makes the exported clip last exactly as long as the drawing
 * took, so a 4.2-second gesture becomes a 4.2-second film. `"fixed"` gives the
 * canned duration every other tool offers. Both are real answers and the choice
 * is a taste call, not a technical one — see `docs/research/` for the argument
 * and the recommendation. Nothing here defaults it silently: `timebase` is
 * required.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT DO ───────────────────────────────
 * It does not apply the reveal's easing. The app owns that law
 * (`easeReveal` in `components/viewport-3d.tsx`, published for scripts as
 * `window.__revealHarness.ease`), and a second copy of an easing curve is the
 * exact drift this repo has been bitten by — a pasted constant that goes stale
 * while the file still looks current. So a planned frame carries a LINEAR
 * `clock` in 0..1 and the recorder asks the host to turn it into a playhead.
 */

/** Which clock the exported film runs on. */
export type ExportTimebase = "pen" | "fixed"

/** What a frame is FOR — lets a caller trim or label without re-deriving it. */
export type FramePhase = "lead" | "draw" | "hold"

/* ==========================================================================
 * §W · WHAT THE REVEAL SHOWS AT THE CLOCK'S TWO ENDS
 *
 * ── THE ASSUMPTION THIS FILE SHIPPED WITH, AND THE FOUR WAYS IT IS FALSE ──
 *
 * `lead` frames sit at clock 0 and `hold` frames at clock 1, and both phases
 * exist to hold STILLNESS either side of the motion. That is only meaningful
 * while clock 0 is an empty page and clock 1 is the finished mark — which was
 * true of every reveal this app had when the plan was written, and is now false
 * four separate ways:
 *
 *   `travel`  [d(1+L) − L, d(1+L)]   starts empty, **ends empty**
 *   `vanish`  [d, 1]                 **starts full**, **ends empty**
 *   `shrink`  [0, 1 − d]             **starts full**, **ends empty**
 *   `reverse` (the TRANSPORT toggle)  swaps whatever the two ends were —
 *                                     and it has shipped since long before the
 *                                     window existed
 *
 * Measured on the model (`scripts/verify/assert-export-window.mjs` §A3): of the
 * eight (window mode × reverse) states this app can reach, **five put every
 * hold frame on blank paper.** At the app's own hard-coded `holdMs: 600` that
 * is 18 frames at 30 fps — a fifth of a short film — of nothing, welded to the
 * end of a file the user is going to post.
 *
 * And it is not a cosmetic mismatch, it is this module contradicting its own
 * stated reason for the hold: *"This is not padding: every completion-keyed
 * style behaviour in the app only has anything to show AFTER the reveal reaches
 * 1."* On a reveal that ends empty there is nothing for those layers to show
 * ON, so the hold is exactly the padding the sentence disclaims.
 *
 * ── SO THE PLAN IS TOLD, RATHER THAN ASSUMING ─────────────────────────────
 *
 * `revealEnds` is a statement of FACT about the reveal — not a taste dial — and
 * it defaults to `grow`'s, which is what shipped. At the default not one line of
 * this block changes a frame. What the plan then does with the fact IS a
 * product call, so it is a default and not a decision taken away: the hold is
 * dropped, the drop is reported on the plan and said out loud in `describePlan`,
 * and `holdOnEmpty` puts it back.
 * ======================================================================== */

/** What the reveal actually shows at one end of the clock. */
export type RevealEndState = "empty" | "full" | "partial"

export interface RevealEnds {
  /** What clock 0 shows, BEFORE `reverse` is applied. */
  at0: RevealEndState
  /** What clock 1 shows, BEFORE `reverse` is applied. */
  at1: RevealEndState
}

/**
 * ⚠ A COPY OF A FACT THAT LIVES IN `lib/stroke-schedule.ts`, AND IT IS GATED.
 *
 * These four rows are `windowAt(mode, 0)` and `windowAt(mode, 1)` read off that
 * file's own model. `lib/export/` deliberately imports no app module — it is
 * served to `assert-export-live.mjs` as standalone ES modules with nothing
 * but relative specifiers rewritten, and an `@/lib/...` import would break that
 * gate outright — so the copy cannot be avoided. It CAN be gated, and it is:
 * `assert-export-window.mjs` recomputes every cell from the real `windowAt` and
 * fails if the two ever disagree. Same treatment `EXPORT_PAPER` gets against
 * `STILL_PAPER`, and for the same reason — a pasted constant that goes stale
 * while the file still looks current is a failure this repo has caught twice.
 */
export const REVEAL_WINDOW_ENDS: Record<string, RevealEnds> = {
  grow: { at0: "empty", at1: "full" },
  travel: { at0: "empty", at1: "empty" },
  vanish: { at0: "full", at1: "empty" },
  shrink: { at0: "full", at1: "empty" },
}

/** The plan's default, and the reveal this app shipped with. */
export const REVEAL_ENDS_DEFAULT: RevealEnds = REVEAL_WINDOW_ENDS.grow

/**
 * The ends for a window mode by name. Unknown names fall back to `grow` rather
 * than throwing, because a caller on a newer window mode should get the shipped
 * behaviour and a gate row, not a broken export.
 */
export function revealEndsFor(
  mode: string | null | undefined,
  pass?: { seamless?: boolean; opening?: boolean },
): RevealEnds {
  /* F118 TRAVEL-5, A SEAMLESS TRAVEL. Its head runs 0 to 1 and the tail wraps,
   * so clock 1 is `[1-L, 1]`, never empty paper. Clock 0 is empty on the
   * opening pass and `[1-L, 1]` again on a wrapped one. Kept out of the table
   * above, which is one row per window mode and gated as such. */
  if (mode === "travel" && pass?.seamless) return { at0: pass.opening === false ? "partial" : "empty", at1: "partial" }
  return (mode && REVEAL_WINDOW_ENDS[mode]) || REVEAL_ENDS_DEFAULT
}

export interface FramePlanInput {
  /**
   * The strokes' own recorded duration in ms — the app's `totalDuration`,
   * reachable from a script as `window.__revealHarness.getTotalDuration()`.
   * This is the pen's real elapsed time, first to last timestamp.
   */
  penDurationMs: number
  /** Frames per second of the output file. */
  fps: number
  /** `pen` = as long as the drawing took. `fixed` = `fixedDurationMs`. */
  timebase: ExportTimebase
  /** Required when `timebase === "fixed"`. */
  fixedDurationMs?: number
  /**
   * Playback rate, matching the transport's 0.5 / 1 / 2 buttons. 2 halves the
   * draw's screen time. Applied to the DRAW phase only — a lead-in and a hold
   * are stillness, and stillness does not have a speed.
   */
  speed?: number
  /** Stillness on the empty ground before the mark starts. */
  leadInMs?: number
  /**
   * Stillness after the mark completes. This is not padding: every
   * completion-keyed style behaviour in the app (`completionPulse`,
   * `delayedAfterReveal`, the stack's freeze-on-complete) only has anything to
   * show AFTER the reveal reaches 1, so an export that stops on the last drawn
   * frame cuts off the layer the user just spent their time choosing.
   *
   * ⚠ THAT SENTENCE IS CONDITIONAL AND THE CONDITION IS `revealEnds` — see §W.
   * On a reveal that ends EMPTY there is no finished mark to hold and nothing
   * for a completion-keyed layer to show on, so the hold is dropped and
   * `holdSuppressed` says so. `holdOnEmpty` overrides.
   */
  holdMs?: number
  /**
   * What the reveal SHOWS at clock 0 and clock 1, before `reverse`. A fact
   * about the reveal, not a preference. Omitted = `grow`, which is what
   * shipped, which is why omitting it reproduces the previous plan exactly.
   * `revealEndsFor(windowMode)` turns a window-mode name into one.
   */
  revealEnds?: RevealEnds
  /**
   * Keep the hold even when it would be blank paper. The escape hatch, so the
   * line above is a DEFAULT and not a decision taken away from the user — a
   * held blank tail is a legitimate thing to want at the end of a loop.
   */
  holdOnEmpty?: boolean
  /** Play the draw backwards, as the transport's Reverse does. */
  reverse?: boolean
  /**
   * Hard ceiling on frames, so a very slow drawing cannot ask for a file
   * nobody wants. The plan is TRUNCATED and says so — never silently resampled
   * to a different rate, which would be a second timebase nobody asked for.
   */
  maxFrames?: number
}

export interface PlannedFrame {
  /** 0-based position in the file. */
  index: number
  /** Presentation time within the output, ms from the first frame. */
  timeMs: number
  /** What this frame is for. */
  phase: FramePhase
  /**
   * LINEAR draw progress, 0..1. The recorder turns this into a playhead through
   * the app's own easing.
   *
   * ⚠ `lead` IS NOT ALWAYS 0 AND `hold` IS NOT ALWAYS 1 — the previous wording
   * here said they were, and it is false whenever `reverse` is set, because
   * `reverse` flips the CLOCK and not the PHASE (see the push below). Under
   * reverse a `lead` frame carries clock 1 and a `hold` frame carries clock 0.
   * What each phase SHOWS is `leadShows` / `holdShows` on the plan; do not
   * infer it from the phase name.
   */
  clock: number
}

export interface FramePlan {
  frames: PlannedFrame[]
  fps: number
  /** Output duration in ms, including lead-in and hold. */
  durationMs: number
  /** Per-frame interval in ms. Exact rational value, not rounded. */
  frameIntervalMs: number
  timebase: ExportTimebase
  /** The pen's own duration, carried so a caller can SAY it in the UI. */
  penDurationMs: number
  /** How long the draw phase occupies in the output, after `speed`. */
  drawDurationMs: number
  /** The lead-in the plan actually scheduled. */
  leadInMs: number
  /** The hold the plan actually scheduled — 0 when it was suppressed. */
  holdMs: number
  reverse: boolean
  /** True when `maxFrames` cut the plan short. */
  truncated: boolean
  /** Frames the plan WANTED before truncation. */
  requestedFrames: number
  /* ---- §W · what the two still phases actually contain ------------------ */
  /** The reveal's ends as the plan resolved them, AFTER `reverse`. */
  revealEnds: RevealEnds
  /** What the `lead` frames show. */
  leadShows: RevealEndState
  /** What the `hold` frames show — or would have, if it was suppressed. */
  holdShows: RevealEndState
  /** True when a hold was asked for and dropped because it would be blank. */
  holdSuppressed: boolean
  /** The hold that was ASKED for, whether or not it was scheduled. */
  holdMsRequested: number
  /**
   * True when the final frame's INSTANT was moved to the end of the draw
   * because no hold was there to land it. See the block in `planFrames`.
   */
  closingFrameClamped: boolean
}

/** The floor the app's own timeline uses (`useTimeline`: at least 1 ms). */
const MIN_DURATION_MS = 1

/**
 * Ceiling on a single export. 3600 frames is two minutes at 30 fps, which is
 * far past anything a hand gesture produces, and it is here so that a stroke
 * recorded across a coffee break cannot ask for a ten-minute film.
 */
export const DEFAULT_MAX_FRAMES = 3600

export function planFrames(input: FramePlanInput): FramePlan {
  const fps = Number.isFinite(input.fps) && input.fps > 0 ? input.fps : 30
  /* WRITTEN OUT, because the one-line version is wrong in a way that reads
   * fine: `isFinite(x ?? 1) && (x ?? 1) > 0 ? (x as number) : 1` tests the
   * DEFAULTED value and then returns the UNDEFAULTED one, so an omitted speed
   * came back `undefined` and every duration downstream was NaN. Caught by
   * `assert-export-plan.mjs` on its first run — 0 frames, draw NaNms. */
  const speedRaw = input.speed ?? 1
  const speed = Number.isFinite(speedRaw) && speedRaw > 0 ? speedRaw : 1
  const leadInMs = Math.max(0, input.leadInMs ?? 0)
  const holdMsRequested = Math.max(0, input.holdMs ?? 0)
  const reverse = !!input.reverse

  /* ---- §W · WHAT THE TWO STILL PHASES WILL ACTUALLY CONTAIN -------------
   *
   * `reverse` is applied HERE and not left for a caller to pre-swap, because
   * the caller does not know that this file flips the clock rather than the
   * phase — that is this file's own arithmetic (`clock: reverse ? 1 - clock`),
   * and a fact only this file knows is a fact only this file can apply
   * correctly. It is also what makes the transport's Reverse toggle work with
   * no change at any call site: `revealEnds` describes the REVEAL, and the
   * plan converts it into what its own frames will show. */
  const declared = input.revealEnds ?? REVEAL_ENDS_DEFAULT
  const revealEnds: RevealEnds = reverse ? { at0: declared.at1, at1: declared.at0 } : { ...declared }
  const leadShows = revealEnds.at0
  const holdShows = revealEnds.at1
  /* THE ONE PRODUCT CALL IN THIS BLOCK, AND IT IS A DEFAULT. A hold whose
   * frames are blank paper is padding, and the field's own doc two screens up
   * says a hold is not padding. `holdOnEmpty` puts it back for a caller that
   * wants a blank beat at the end of a loop. */
  const holdSuppressed = holdMsRequested > 0 && holdShows === "empty" && !input.holdOnEmpty
  const holdMs = holdSuppressed ? 0 : holdMsRequested

  const maxFrames = Math.max(1, Math.floor(input.maxFrames ?? DEFAULT_MAX_FRAMES))

  const sourceMs =
    input.timebase === "pen"
      ? Math.max(MIN_DURATION_MS, input.penDurationMs)
      : Math.max(MIN_DURATION_MS, input.fixedDurationMs ?? 0)

  /* SPEED SHORTENS THE DRAW, NOTHING ELSE. A 2x export of a 4 s gesture is a
   * 2 s draw with the same lead-in and hold — which is what the transport's
   * 2x button does on screen, so the film matches what was judged. */
  const drawDurationMs = sourceMs / speed
  const totalMs = leadInMs + drawDurationMs + holdMs

  const frameIntervalMs = 1000 / fps
  /* INCLUSIVE OF THE LAST INSTANT. `ceil(total/interval)` alone lands one frame
   * short of the end whenever the duration is an exact multiple of the
   * interval — a 1000 ms clip at 30 fps would stop at 966.67 ms and the mark
   * would never be seen finished. The `+1` is the closing frame, and it is why
   * a 0-length draw still yields one frame rather than none. */
  /* THE EPSILON IS LOAD-BEARING, AND IT WAS FOUND BY THE GATE, NOT REASONED
   * ABOUT. `1000 / (1000/30)` is 29.999999999999996, not 30 — so a 1-second
   * draw at 30 fps floored to 29 and the plan STOPPED AT 966.67ms with the
   * mark 3% unfinished. The defect is invisible in a still and shows up only as
   * "the last frame never lands", which is the single most-reported bug class
   * in exported loops. 1e-9 is ~200x the double-precision noise at the largest
   * ratio this can produce (18000 frames), so it cannot invent a frame. */
  const requestedFrames = Math.floor(totalMs / frameIntervalMs + 1e-9) + 1
  const count = Math.min(requestedFrames, maxFrames)

  const frames: PlannedFrame[] = []
  for (let i = 0; i < count; i++) {
    const timeMs = i * frameIntervalMs
    let phase: FramePhase
    let clock: number
    if (timeMs < leadInMs) {
      phase = "lead"
      clock = 0
    } else if (timeMs >= leadInMs + drawDurationMs) {
      phase = "hold"
      clock = 1
    } else {
      phase = "draw"
      clock = drawDurationMs > 0 ? (timeMs - leadInMs) / drawDurationMs : 1
    }
    /* CLAMPED, NOT TRUSTED. Floating point on the boundary can hand back
     * 1.0000000000000002, and the app's `unEaseReveal` has already been bitten
     * once by a playhead that was not exactly 1 (viewport-3d.tsx: "setProgress(1)
     * under an ease left the clock at 0.999999999"). */
    clock = clock < 0 ? 0 : clock > 1 ? 1 : clock
    frames.push({ index: i, timeMs, phase, clock: reverse ? 1 - clock : clock })
  }

  /* ── 🔴 THE CLOSING FRAME, WHEN THERE IS NO HOLD TO SUPPLY ONE ───────────
   *
   * `requestedFrames = floor(total/interval + eps) + 1` puts a frame at the
   * last WHOLE interval, which is at or before the end — so unless the
   * duration is an exact multiple of the frame interval, NO frame lands on the
   * end instant and the reveal is never rendered at clock 1. With a hold that
   * is invisible, because every hold frame is clamped to 1 and supplies the
   * finished picture. With `holdMs: 0` it is the defect the epsilon comment
   * above is written about, one level up: *"the last frame never lands, which
   * is the single most-reported bug class in exported loops."*
   *
   * MEASURED, on the real fixture that found it: a 1436 ms draw at 24 fps
   * yields 35 frames, the last at t = 1416.7 ms with **clock 0.986537** — the
   * mark 1.35 % unfinished, 1 577 px of a 44 227 px mark still showing on a
   * frame that was supposed to be the end. It surfaced only once a suppressed
   * hold stopped covering for it, on a REVERSED film, where the residue sits at
   * the empty end and is obvious.
   *
   * The last frame's INSTANT is moved to the end; its presentation time is not.
   * That keeps `durationMs`, the frame count and every other frame exactly as
   * they were, and it is the same intent the `+1` above already carries. It
   * cannot touch the shipped default, which has a 600 ms hold — and on an exact
   * multiple the final frame is already `hold`/clock 1, so this is a no-op
   * there too (which is why `assert-export-plan.mjs`'s round-number rows do not
   * move).
   */
  let closingFrameClamped = false
  if (holdMs === 0 && count > 0 && drawDurationMs > 0) {
    const end = reverse ? 0 : 1
    const last = frames[count - 1]
    if (last.clock !== end) {
      frames[count - 1] = { ...last, phase: "hold", clock: end }
      closingFrameClamped = true
    }
  }

  return {
    frames,
    fps,
    durationMs: count > 0 ? frames[count - 1].timeMs + frameIntervalMs : 0,
    frameIntervalMs,
    timebase: input.timebase,
    penDurationMs: input.penDurationMs,
    drawDurationMs,
    leadInMs,
    holdMs,
    reverse,
    truncated: requestedFrames > count,
    requestedFrames,
    revealEnds,
    leadShows,
    holdShows,
    holdSuppressed,
    holdMsRequested,
    closingFrameClamped,
  }
}

/**
 * ONE SENTENCE ABOUT WHAT THE FILM'S TWO ENDS CONTAIN, or "" when there is
 * nothing worth saying — which is the shipped `grow` case, so the panel copy is
 * unchanged until the user picks something where it is not.
 *
 * A user who has chosen Vanish has chosen a film that ends on an empty page.
 * That is a legitimate and deliberate thing to want, and it is also the single
 * most surprising property a downloaded file can have, so the export panel says
 * it BEFORE the button is pressed rather than leaving it to be discovered in
 * the finished file.
 */
export function describeRevealEnds(plan: FramePlan): string {
  const bits: string[] = []
  if (plan.holdShows === "empty") {
    bits.push(
      plan.holdSuppressed
        ? "ends on empty paper, so there is no hold"
        : "ends on empty paper, and the hold is held on it",
    )
  }
  if (plan.leadShows === "full") bits.push("opens on the finished mark")
  return bits.join(" · ")
}

/**
 * Human sentence for the export panel. Deliberately says the PEN duration out
 * loud on the `pen` timebase, because "4.2 s — the time this took you to draw"
 * is the product's whole claim and a silent 4.2 s is just a number.
 */
export function describePlan(plan: FramePlan): string {
  const secs = (plan.durationMs / 1000).toFixed(2)
  const base =
    plan.timebase === "pen"
      ? `${secs}s at ${plan.fps} fps, the time this took you to draw`
      : `${secs}s at ${plan.fps} fps`
  const bits = [base, `${plan.frames.length} frames`]
  if (plan.truncated) bits.push(`truncated from ${plan.requestedFrames}`)
  const ends = describeRevealEnds(plan)
  if (ends) bits.push(ends)
  return bits.join(" · ")
}
