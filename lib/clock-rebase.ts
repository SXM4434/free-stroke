/* ============================================================================
 * THE CLOCK, AND WHAT A CHANGE TO IT DOES TO A PERFORMED STROKE (CLOUD-HANDFIX).
 *
 * A performed row (`withPerformed`) is stored against the base slots of the
 * clock it was performed on. Anything that moves those slots moves the stroke
 * he performed unless the row is re-stored (`rebasePerformed`). The clock pills
 * did that; the Solid Thickness slider (the hand clock's nib), a spacing or
 * smoothing reprocess, Draw-in and Window did not (REVIEW.md, Review 2,
 * findings 1 and 2). So every one of them now asks this module, through one
 * function, `rebaseForPatch`: the document before, the patch, and the take
 * re-stored for the document after, or null when no performed stroke moves.
 *
 * Moved out of `app/page.tsx` so the page's clock handlers can be driven in
 * Node: `scripts/verify/assert-handfix.mjs` calls `rebaseForPatch` with the
 * patch each handler builds. `clockStrokesFor` and `baseSlotsFor` are the
 * page's functions, unchanged, and the page's memo still calls the first.
 * ========================================================================== */

import { processStroke, type ProcessedStroke, type Stroke } from "@/lib/stroke-processing"
import { stampPenClock, liftsLandBetweenStrokes, revealDistanceFraction } from "@/lib/pen-reveal"
import { scheduleFromStrokes, type DrawInParams } from "@/lib/stroke-schedule"
import { assignLetters } from "@/lib/hero-letters"
import { computeSolidEffectiveThicknessPx } from "@/lib/geometry-engines"
import { HAND_DRAW_RATE } from "@/lib/style-system"
import {
  carryTimeByArc,
  paceFromCurve,
  penMsOf,
  rateScaled,
  rebasePerformed,
  takeHasPerformed,
  type StrokeTimingTake,
} from "@/lib/stroke-timing"

type RevealPaceMode = Parameters<typeof revealDistanceFraction>[2]

/** The canvas settings a hand-clock stamp is resampled with. */
export interface ClockCanvas {
  spacing: number
  smoothing: boolean
  preserveCorners: boolean
}

/** The document fields the clock and the base slots read. `DocSnapshot` fits. */
export interface ClockDoc {
  rawStrokes: Stroke[]
  processedStrokes: ProcessedStroke[]
  solidParams: { thickness: number }
  drawIn: DrawInParams
  revealWindow: { mode: Parameters<typeof liftsLandBetweenStrokes>[1] }
  revealEnvelope: { clock: string; rate: number; mode: RevealPaceMode }
}

/* THE CLOCK, as a pure function (HAND-DRAW-P2): the memo on / calls it for the
 * clock that plays, and a clock change calls it for the old clock and the new
 * one, so `rebasePerformed` reads both from the same code. */
export function clockStrokesFor(
  rawStrokes: Stroke[],
  processedStrokes: ProcessedStroke[],
  env: { clock: string; rate: number },
  clockNib: number,
  cs: ClockCanvas,
) {
  const mutate = typeof window !== "undefined" ? (window as unknown as { __FS_GATE_MUTATE?: string }).__FS_GATE_MUTATE : undefined
  const wantHand = env.clock === "hand" || mutate === "clock-always-hand"
  const rate = mutate === "clock-rate-off" ? 1 : mutate === "clock-rate-leak" ? HAND_DRAW_RATE : env.rate
  if ((!wantHand && rate === 1) || processedStrokes.length === 0)
    return { raw: rawStrokes, processed: processedStrokes, hand: false, stamped: null as Stroke[] | null, drift: 0, ms: 0 }
  const t0 = performance.now()
  let processed: ProcessedStroke[] = processedStrokes
  let raw: Stroke[] = rawStrokes
  let stamped: Stroke[] | null = null
  let drift = 0
  if (wantHand) {
    const stampResample = mutate === "clock-stamp-resampled"
    stamped = stampPenClock(
      (stampResample ? processedStrokes : rawStrokes).map((s) => s.points),
      mutate === "clock-uniform" ? "uniform" : "lognormal",
      { nibDiameter: clockNib },
    )
    processed = processedStrokes.map((s, i) => {
      const q = stamped![i]
      if (!q) { drift++; return s }
      if (stampResample) return { ...s, points: s.points.map((p, j) => ({ ...p, t: q.points[j].t })) }
      const r = rawStrokes[i]
      if (!r || q.points.length !== r.points.length) { drift++; return { ...s, points: carryTimeByArc(s.points, q.points) } }
      const timed = processStroke({ ...r, points: r.points.map((p, j) => ({ ...p, t: q.points[j].t })) }, cs.spacing, cs.smoothing, cs.preserveCorners).points
      if (timed.length === s.points.length) return { ...s, points: s.points.map((p, j) => ({ ...p, t: timed[j].t })) }
      drift++
      return { ...s, points: carryTimeByArc(s.points, timed) }
    })
    raw = processed as Stroke[]
  }
  processed = rateScaled(processed, rate)
  raw = wantHand ? (processed as Stroke[]) : rateScaled(raw, rate)
  return { raw, processed, hand: wantHand, stamped, drift, ms: performance.now() - t0 }
}

/* HAND-DRAW-P2. The base slots the strip lays a take on (`components/stroke-strip.tsx`,
 * its `slots` memo with no rows) for one clock's strokes: the schedule's tracks
 * through that clock's pace, times its pen ms. The pace is the one the viewport
 * and the strip run: the transport's override over the document's mode, and the
 * transport's hybrid blend (CLOUD-HANDFIX finding 8; a fixed 0.4 and the
 * document's mode put a performed stroke off under Debug's Smooth). */
export function baseSlotsFor(
  strokes: ProcessedStroke[],
  penMs: number,
  drawIn: DrawInParams,
  windowMode: Parameters<typeof liftsLandBetweenStrokes>[1],
  revealMode: RevealPaceMode,
  nib: number,
  hybridBlend = 0.4,
): Float64Array {
  const unitOf = drawIn.unit === "stroke" || strokes.length === 0 ? null : assignLetters(strokes, nib).of
  const schedule = scheduleFromStrokes(strokes, unitOf, drawIn)
  const lifts = liftsLandBetweenStrokes(schedule, windowMode)
  const pace = paceFromCurve((c) => revealDistanceFraction(strokes, c, revealMode, hybridBlend, lifts))
  const s = new Float64Array(schedule.tracks.length * 2)
  schedule.tracks.forEach((t, i) => {
    s[i * 2] = pace.beatToLanding(t.start) * penMs
    s[i * 2 + 1] = pace.beatToClock(t.end) * penMs
  })
  return s
}

/** The hand clock's nib: the base thickness, never the keyed width track. */
export function clockNibOf(doc: Pick<ClockDoc, "solidParams">): number {
  return computeSolidEffectiveThicknessPx(doc.solidParams.thickness)
}

/** The transport's pace inputs (`lib/take-transport.ts`): the diagnostic's
 *  override and the hybrid blend. Persisted nowhere, read live. */
export interface ClockPace {
  modeOverride: RevealPaceMode | null
  hybridBlend: number
}
export const CLOCK_PACE_DEFAULTS: ClockPace = { modeOverride: null, hybridBlend: 0.4 }

/** Every stroke's base slot, ms, for one document on the clock it plays. */
export function clockSlotsOf(doc: ClockDoc, cs: ClockCanvas, pace: ClockPace = CLOCK_PACE_DEFAULTS): Float64Array {
  const nib = clockNibOf(doc)
  const c = clockStrokesFor(doc.rawStrokes, doc.processedStrokes, doc.revealEnvelope, nib, cs)
  return baseSlotsFor(c.processed, penMsOf(c.raw), doc.drawIn, doc.revealWindow.mode, pace.modeOverride ?? doc.revealEnvelope.mode, nib, pace.hybridBlend)
}

/**
 * The take re-stored for `doc` changed by `patch`, or null when no performed
 * stroke would move. `csBefore` is the canvas the playing clock was stamped
 * with (the page's memo keeps it), `csAfter` the one the next stamp reads, so
 * a spacing change rebases from the resample that played to the one that will.
 * `pace` is the transport's, the same on both sides. A patch that adds or drops
 * a stroke is not a re-stamp and returns null.
 */
export function rebaseForPatch(
  take: StrokeTimingTake | null | undefined,
  doc: ClockDoc,
  patch: Partial<ClockDoc>,
  csBefore: ClockCanvas,
  csAfter: ClockCanvas = csBefore,
  pace: ClockPace = CLOCK_PACE_DEFAULTS,
): StrokeTimingTake | null {
  if (!take || !takeHasPerformed(take)) return null
  const next: ClockDoc = { ...doc, ...patch }
  if (next.processedStrokes.length !== doc.processedStrokes.length || next.rawStrokes.length !== doc.rawStrokes.length) return null
  const a = clockSlotsOf(doc, csBefore, pace)
  const b = clockSlotsOf(next, csAfter, pace)
  if (a.length !== b.length || a.every((v, i) => v === b[i])) return null
  return rebasePerformed(take, a, b)
}

/** True when `patch` changes the hand clock's nib: every Solid Thickness path
 *  (both sliders, the geometry presets, the dev dials) writes `solidParams`. */
export function patchMovesNib(doc: Pick<ClockDoc, "solidParams">, patch: { solidParams?: { thickness: number } }): boolean {
  return !!patch.solidParams && clockNibOf({ solidParams: patch.solidParams }) !== clockNibOf(doc)
}

/** A browser gate's knockout, set on the page before load (`__FS_GATE_MUTATE`). */
export function gateKnocked(name: string): boolean {
  return typeof window !== "undefined" && (window as unknown as { __FS_GATE_MUTATE?: string }).__FS_GATE_MUTATE === name
}
