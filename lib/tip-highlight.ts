/* ============================================================================
 * TIP HIGHLIGHT (DRAWIN-EXTRAS, 2026-09-30). A glow on the pen's moving end.
 *
 * His plan, PRD Layer 3: "Future: ... pressure-aware reveal, tip highlight".
 * Coverage row 42: "The pen tip renders (vp:4135-4525). No tip control found in
 * dtc." The pen tip there is the SHAPE of the moving end (a cut, a nib, a quill),
 * carved in the shader. This is a separate thing: a light on that end while it
 * moves, so the eye can follow the pen.
 *
 * WHERE THE HEADS ARE. One head per stroke that is part drawn: its reach is
 * strictly between 0 and 1 of its own arc. With overlap several strokes draw at
 * once, so there can be several heads. The reach comes from the same numbers the
 * reveal already uses, never a copy of them:
 *   a timed take    `sampleTake` spans (the caller passes them in);
 *   a schedule      each track's `start`/`end` against the window's upper edge;
 *   neither         `strokeArcSpans` against the same edge.
 * A reversed track draws from its far end, so its head is at `1 - reach`.
 *
 * OFF IS MAIN. `envelope.tipHighlight` is 0 by default, and at 0 the viewport
 * mounts nothing and calls nothing here.
 * ========================================================================== */

import type { StrokeSchedule } from "@/lib/stroke-schedule"

export const TIP_HIGHLIGHT_MAX = 1

/** How many heads the glow draws at most. Past this the extras are dropped,
 *  in stroke order, and the count says so. */
export const TIP_HEADS_MAX = 64

export interface TipHead {
  stroke: number
  /** Where the head is, as a fraction of the stroke's own arc from its first point. */
  frac: number
}

/** Heads from per-stroke `[f0, f1]` spans, the form `sampleTake` returns. The
 *  head is the end that is still moving: `f1` forward, `f0` reversed. */
export function headsFromSpans(spans: ArrayLike<number>, reversed: (i: number) => boolean): TipHead[] {
  const out: TipHead[] = []
  const n = spans.length >> 1
  for (let i = 0; i < n && out.length < TIP_HEADS_MAX; i++) {
    const rev = reversed(i)
    const reach = rev ? 1 - spans[i * 2] : spans[i * 2 + 1]
    if (reach > 0 && reach < 1) out.push({ stroke: i, frac: rev ? 1 - reach : reach })
  }
  return out
}

/** Heads from a schedule's tracks (or plain arc spans) at the window's upper edge. */
export function headsFromTracks(
  tracks: readonly { start: number; end: number; reverse?: boolean }[],
  hi: number,
): TipHead[] {
  const out: TipHead[] = []
  for (let i = 0; i < tracks.length && out.length < TIP_HEADS_MAX; i++) {
    const t = tracks[i]
    const span = t.end - t.start
    if (!(span > 0)) continue
    const reach = (hi - t.start) / span
    if (reach > 0 && reach < 1) out.push({ stroke: i, frac: t.reverse ? 1 - reach : reach })
  }
  return out
}

/** The schedule's tracks when it moves anything, else null (use arc spans). */
export function tipTracksOf(sched: StrokeSchedule | null | undefined): StrokeSchedule["tracks"] | null {
  return sched && !sched.identity ? sched.tracks : null
}

/** Cumulative arc length per point, for `pointAtFrac`. */
export function cumulativeArc(points: readonly { x: number; y: number }[]): Float64Array {
  const c = new Float64Array(points.length)
  for (let j = 1; j < points.length; j++) {
    c[j] = c[j - 1] + Math.hypot(points[j].x - points[j - 1].x, points[j].y - points[j - 1].y)
  }
  return c
}

/** The point `frac` of the way along the stroke by arc length. */
export function pointAtFrac(
  points: readonly { x: number; y: number }[],
  cum: Float64Array,
  frac: number,
): { x: number; y: number } | null {
  const n = points.length
  if (n === 0) return null
  if (n === 1) return { x: points[0].x, y: points[0].y }
  const L = cum[n - 1]
  const want = Math.max(0, Math.min(1, frac)) * L
  let lo = 1
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (cum[mid] < want) lo = mid + 1
    else hi = mid
  }
  const a = cum[lo - 1]
  const b = cum[lo]
  const f = b > a ? (want - a) / (b - a) : 0
  return {
    x: points[lo - 1].x + f * (points[lo].x - points[lo - 1].x),
    y: points[lo - 1].y + f * (points[lo].y - points[lo - 1].y),
  }
}
