/* ============================================================================
 * PEN REVEAL — THE PROGRESS MODEL, AND ONLY THE PROGRESS MODEL.
 *
 * WHAT THIS FILE IS FOR, IN ONE SENTENCE: "how much of the word has the pen
 * drawn at time t" is a question about the RECORDING, not about the renderer,
 * so it is answered in exactly one place and both registers call it.
 *
 * ── THE SPLIT, WHICH IS THE WHOLE POINT ──────────────────────────────────────
 *
 * The draw-in is two things that were never separated, and conflating them is
 * why one register has a draw-in and the other has none:
 *
 *   1. THE PROGRESS MODEL — time fraction -> distance fraction along the pen's
 *      own path, honouring the recorded timestamps. This IS register
 *      independent. It is arithmetic over `ProcessedStroke.points[].t`, and a
 *      canvas, a tube and a marching-cubes surface all want the same answer.
 *      **That is this file.**
 *
 *   2. THE RENDERING MECHANISM — what you do with that number. This is NOT
 *      register independent and must not be pretended to be:
 *
 *        3D, Inflate/implicit   `setDrawRange` over an index buffer counting-
 *                               sorted by arc length at build time
 *                               (lib/implicit-surface.ts §6, explainer 18).
 *                               Zero geometry work per frame.
 *        3D, Inflate/DESK       the same `setDrawRange`, over per-triangle keys
 *          DOODLES engine       read off the builder's own uv V channel
 *                               (lib/dd-engine/adapter.ts `bakeRevealKeys`).
 *                               ⚠ IT USED TO REBUILD, and that is the defect
 *                               closed on 2026-08-04 — see the note on
 *                               `filterStrokesByProgress` below.
 *        3D, Rod                `setDrawRange` snapped to whole tube rings,
 *                               via the engine's own `ringArcFracs` table.
 *        3D, Solid/Extrude/     REBUILD from an arc-length-clipped copy of the
 *          Inflate-loft         strokes (`filterStrokesByProgress`).
 *        2D, flat ink           truncate the polyline at a cumulative arc
 *                               length and stroke it (`lib/flat-ink.ts`).
 *
 *      A vertex buffer has no meaning on a 2D canvas path and a `lineTo` has
 *      no meaning on a triangle soup. Four mechanisms, one clock.
 *
 * ── WHY IT IS A FILE AND NOT THREE COPIES ───────────────────────────────────
 *
 * PORTED, NOT REWRITTEN. Every line below was lifted out of
 * `components/viewport-3d.tsx` (`penTimeDistanceFraction` at its :2167,
 * `measureTimingCharacter` at its :2240, `TIMING_CHARACTER_THRESHOLD` at its
 * :2238) with its comments intact, because those comments record measured
 * findings and a rewrite loses them. What is NEW here is `blendReveal` and
 * `revealDistanceFraction`, which are the blend arithmetic that had been
 * written out by hand at THREE separate call sites in that file — the implicit
 * drawRange path, the partial-rebuild path and Rod's per-stroke path — with
 * nothing keeping them in step.
 *
 * That divergence is not hypothetical. The file's own comment records it
 * happening once already: `filterStrokesByProgress` cut by RAW ARC LENGTH, so
 * "the Natural / Authentic toggle silently did NOTHING in Solid, Extrude and
 * Inflate (it only reached Rod's drawRange path). A control that renders
 * identically whatever you set it to is this codebase's cardinal sin."
 * One law, one file, so it cannot happen a third time.
 * ========================================================================== */

import type { ProcessedStroke, Stroke, Point } from "@/lib/stroke-processing"
import { drawHandState, reconstructPenKinematics } from "@/lib/pen-kinematics"
import { assignLetters, letterGapAfter } from "@/lib/hero-letters"

/**
 * The three ways a playhead becomes a distance.
 *
 *   "raw"     AUTHENTIC — replay the speed the pen was actually moving at.
 *   "smooth"  NATURAL(constant) — ignore the recording, sweep at constant
 *             speed along arc length.
 *   "hybrid"  NATURAL — `raw` blended toward constant speed by `hybridBlend`.
 *
 * The UI labels and these ids are not the same words; the mapping lives at the
 * pill that sets them (components/viewport-3d.tsx) and is deliberately not
 * duplicated here.
 */
export type RevealMode = "raw" | "smooth" | "hybrid"

/* ---- Pen-timing map for the partial-rebuild reveal (stack craft pass) ----
 *
 * `filterStrokesByProgress` cuts by ARC LENGTH, so feeding it the raw playhead
 * fraction gives a constant-speed reveal — every hesitation, dwell and flick
 * in the recorded pen timing was flattened out, and the Natural / Authentic
 * toggle silently did NOTHING in Solid, Extrude and Inflate (it only reached
 * Rod's drawRange path). A control that renders identically whatever you set
 * it to is this codebase's cardinal sin.
 *
 * This helper converts a TIME fraction into the DISTANCE fraction the pen had
 * actually covered at that moment, walking the processed points' own
 * timestamps (which survive resampling). Gaps between strokes naturally hold
 * — nothing advances while the pen was in the air, exactly like Rod.
 * Returns null when the strokes carry no usable timing (degenerate range).
 */
export function penTimeDistanceFraction(
  strokes: ProcessedStroke[],
  timeFrac: number,
): number | null {
  let t0 = Infinity
  let t1 = -Infinity
  for (const s of strokes) {
    const pts = s.points
    if (pts.length === 0) continue
    t0 = Math.min(t0, pts[0].t)
    t1 = Math.max(t1, pts[pts.length - 1].t)
  }
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 - t0 <= 0) return null
  const now = t0 + (t1 - t0) * Math.max(0, Math.min(1, timeFrac))
  let total = 0
  let revealed = 0
  for (const s of strokes) {
    const pts = s.points
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x
      const dy = pts[i].y - pts[i - 1].y
      const seg = Math.sqrt(dx * dx + dy * dy)
      total += seg
      const ta = pts[i - 1].t
      const tb = pts[i].t
      if (tb <= now) {
        revealed += seg
      } else if (ta < now && tb > ta) {
        revealed += (seg * (now - ta)) / (tb - ta)
      }
    }
  }
  if (total <= 0) return null
  return revealed / total
}

/**
 * THE BLEND, IN ONE PLACE.
 *
 * `raw` is where the pen actually was; `timeFrac` is where a constant-speed
 * sweep would be. Every reveal in the app picks a point on the segment between
 * them, and the arithmetic had been written out three times.
 *
 * `hybridBlend` is the fraction of CONSTANT SPEED in the mix — 0 is fully
 * authentic, 1 is fully constant. That direction is inherited from the call
 * sites this replaces (`raw + (progress - raw) * hybridBlend`) and is kept
 * rather than flipped, because the slider that drives it is already labelled
 * against it and a silent inversion of a shipped dial is worse than a name
 * that reads backwards.
 */
export function blendReveal(
  raw: number,
  timeFrac: number,
  mode: RevealMode,
  hybridBlend: number,
): number {
  if (mode === "smooth") return timeFrac
  if (mode === "hybrid") return raw + (timeFrac - raw) * hybridBlend
  return raw
}

/**
 * THE ONE CALL BOTH REGISTERS MAKE. Time fraction in, distance fraction out.
 *
 * Falls back to `timeFrac` — a constant-speed sweep — whenever the strokes
 * carry no usable timing, which is the honest answer: with no recording there
 * is nothing to replay, and inventing a curve here would be the same class of
 * lie as the dead dials this beat has already produced twice.
 *
 * The 0/1 endpoints short-circuit because both curves are pinned there and a
 * `penTimeDistanceFraction` call at the ends can only return the value it was
 * given, at the cost of walking every point in the word.
 */
export function revealDistanceFraction(
  strokes: ProcessedStroke[],
  timeFrac: number,
  mode: RevealMode,
  hybridBlend: number,
  /** Natural holds still on every pen lift. Pass `liftsLandBetweenStrokes(...)`,
   *  never a literal: the hold is only right where a lift is a gap on screen. */
  liftHolds = true,
): number {
  if (!(timeFrac > 0)) return 0
  if (timeFrac >= 1) return 1
  if (mode === "smooth") return timeFrac
  const raw = penTimeDistanceFraction(strokes, timeFrac)
  if (raw === null) return timeFrac
  if (mode !== "hybrid") return raw
  if (!liftHolds) return blendReveal(raw, timeFrac, mode, hybridBlend)
  const even = penStrokeEvenFraction(strokes, timeFrac)
  return blendReveal(raw, even ?? timeFrac, mode, hybridBlend)
}

/**
 * DO THE PEN'S LIFTS LAND BETWEEN TWO STROKES ON SCREEN? Night C, 2026-09-25.
 *
 * Natural's lift hold stops the reveal at the beat position where the pen lifted.
 * That position is a stroke boundary only while every stroke still sits in its
 * own as-drawn slot and the window's drawing edge IS the beat. A reorder, an
 * overlap, `align: end` or a unit shuffle moves the slots, and `travel` and
 * `shrink` put the edge somewhere else, so the same hold froze a stroke HALF
 * DRAWN: 65 of 400 clock samples on the hero word, against 0 before the lifts
 * went in (`night-c-after/probe-controls.mjs`).
 *
 * A reversed stroke keeps its slot, so its lifts still land at its two ends, and
 * `vanish`'s trailing edge is the beat itself: lifts stay on for both. Asked of
 * the slots rather than of `identity`, because `identity` is false under a
 * reverse and would switch the lifts off where they are right.
 *
 * Authentic (`raw`) does not read this: its lifts are in the recording's own
 * timestamps, and a stamped lift and a real hand's lift look the same there.
 */
export function liftsLandBetweenStrokes(
  schedule: { tracks: readonly { from: number; to: number; start: number; end: number }[] } | null | undefined,
  windowMode: string | undefined,
): boolean {
  if (windowMode && windowMode !== "grow" && windowMode !== "vanish") return false
  if (!schedule) return true
  for (const t of schedule.tracks) {
    if (Math.abs(t.start - t.from) > 1e-9 || Math.abs(t.end - t.to) > 1e-9) return false
  }
  return true
}

/**
 * NATURAL'S EVEN HALF, PER STROKE ON THE PEN'S OWN CLOCK. Night C, 2026-09-25.
 *
 * Natural used to blend the pen toward ONE constant-speed sweep of the whole
 * word. That sweep never stops, so 40 % of the reveal kept moving through every
 * pen lift, and the lifts were gone from the screen: measured through the live
 * chain (`docs/verification/hero-beat-film/night-c-after/probe-lifts.mjs`),
 * **0.0 ms of screen hold at all 11 stroke boundaries**, and the draw check read
 * the next stroke's ink starting 0 to 30 ms after the last, 9 of 11 as a JUMP.
 *
 * This is the even pace INSIDE each stroke instead: at stroke `k`'s own recorded
 * start it sits at the stroke's first arc, at its recorded end at the last, and
 * between strokes it HOLDS, exactly where `raw` holds. So the blend holds on
 * every lift for the lift's full length, and inside a stroke Natural is still
 * the hand's pace eased toward even. Rod's `drawRange` path already blended per
 * stroke from its own tables (viewport-3d.tsx, `blendReveal(rawDistFrac,
 * timeFrac, ...)`), so this makes the two registers mean the same thing.
 *
 * Null when the strokes carry no usable timing, the same rule as `raw`.
 */
export function penStrokeEvenFraction(
  strokes: ProcessedStroke[],
  timeFrac: number,
): number | null {
  let t0 = Infinity
  let t1 = -Infinity
  let total = 0
  const lens: number[] = []
  for (const s of strokes) {
    const pts = s.points
    let L = 0
    for (let i = 1; i < pts.length; i++) {
      L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    }
    lens.push(L)
    total += L
    if (pts.length === 0) continue
    t0 = Math.min(t0, pts[0].t)
    t1 = Math.max(t1, pts[pts.length - 1].t)
  }
  if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 - t0 <= 0 || total <= 0) return null
  const now = t0 + (t1 - t0) * Math.max(0, Math.min(1, timeFrac))
  let before = 0
  for (let k = 0; k < strokes.length; k++) {
    const pts = strokes[k].points
    if (pts.length === 0) continue
    const a = pts[0].t
    const b = pts[pts.length - 1].t
    if (now >= b) {
      before += lens[k]
      continue
    }
    if (now > a && b > a) before += (lens[k] * (now - a)) / (b - a)
    break
  }
  return before / total
}

/* ---- THE THIRD MECHANISM — the arc-length clip the rebuild path cuts with
 *
 * MOVED HERE VERBATIM out of `components/viewport-3d.tsx` (its :6183), comments
 * intact, for the reason the header's split table already implies: this file
 * NAMES `filterStrokesByProgress` as one of the four reveal mechanisms and then
 * did not contain it, so the one thing that could measure it was a browser.
 *
 * ⚠ AND THAT IS NOT A TIDINESS ARGUMENT. The defect it turned out to carry is a
 * MODEL defect — a geometry builder whose output for the ALREADY-DRAWN prefix
 * changes every time the clip grows — and a gate for that has no business
 * paying for a GPU. `scripts/verify/assert-drawin-monotone.mjs` imports this
 * function and runs the real engines in plain node; before the move its only
 * option was a hand copy, which is the exact class of restated constant this
 * repo keeps finding drifted.
 * ------------------------------------------------------------------------ */

/**
 * Returns a partial copy of `strokes` representing the portion of the drawing
 * that has been "drawn in" at the given `progress` (0..1).
 *
 * Smoothness strategy: ARC-LENGTH based, with sub-segment interpolation.
 *
 *   1. Compute the total arc length across all strokes (sum of segment lengths).
 *   2. The target reveal length = totalLength * progress.
 *   3. Walk strokes in order; fully include any stroke whose cumulative length
 *      stays below the target.
 *   4. The stroke that contains the target receives:
 *        - all of its points up to and including the last point before the cut
 *        - one INTERPOLATED endpoint placed at the exact target length inside
 *          the current segment (linear x/y/t/pressure interpolation)
 *      This makes the reveal advance continuously instead of snapping to whole
 *      points, which removes the visible "popping" and uneven pacing that comes
 *      from raw point-count progress (corner detection clusters extra points
 *      around curves, so equal point counts != equal visible length).
 *   5. Boundaries are clean:
 *        progress <= 0  -> []                    (replay-from-empty)
 *        progress >= 1  -> original strokes      (final frame == static preview)
 *   6. Original stroke data is never mutated; partial strokes are shallow-copied
 *      and only the new points array is freshly constructed.
 *
 * ⚠ WHAT IT CANNOT DO, AND WHY THAT IS THE WHOLE POINT OF §M BELOW. It hands a
 * GROWING PREFIX to a geometry builder. Any builder whose shape depends on the
 * length of what it is handed will therefore RESHAPE ink the pen has already
 * laid, every frame. That is not a hypothetical: `lib/dd-engine/strokeTo3d.ts`
 * `buildInflateGeometry` parametrises its radius profile on `u = i/segments`,
 * i.e. on normalised position along the stroke it RECEIVES. Measured on the
 * hero word (`scripts/verify/assert-drawin-monotone.mjs`), that took ink off
 * the standing mark on **36 of 40 steps, worst 16.07 % of everything drawn in
 * a single 2.5 % step**.
 */
export function filterStrokesByProgress(
  strokes: ProcessedStroke[],
  progress: number,
): ProcessedStroke[] {
  if (progress >= 1 || strokes.length === 0) return strokes
  if (progress <= 0) return []

  // ---- Pass 1: total arc length across all strokes ----
  // Per-stroke length cached to avoid recomputation in pass 2.
  const strokeLengths: number[] = new Array(strokes.length)
  let totalLength = 0
  for (let s = 0; s < strokes.length; s++) {
    const pts = strokes[s].points
    let len = 0
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x
      const dy = pts[i].y - pts[i - 1].y
      len += Math.sqrt(dx * dx + dy * dy)
    }
    strokeLengths[s] = len
    totalLength += len
  }

  // Degenerate: zero total length (all points coincident) — fall back to
  // including everything once progress > 0 to avoid dividing by zero.
  if (totalLength <= 0) return strokes

  const targetLength = totalLength * progress

  // ---- Pass 2: walk strokes, build the partial output ----
  const filtered: ProcessedStroke[] = []
  let consumed = 0

  for (let s = 0; s < strokes.length; s++) {
    const stroke = strokes[s]
    const strokeLen = strokeLengths[s]

    // Stroke ends before target -> fully include and continue.
    if (consumed + strokeLen <= targetLength) {
      filtered.push(stroke)
      consumed += strokeLen
      continue
    }

    // Stroke contains the cut. Walk its segments to find the exact cut point.
    const remaining = targetLength - consumed
    const pts = stroke.points

    // Edge case: stroke has 0 or 1 points or zero length.
    if (pts.length <= 1 || strokeLen <= 0) {
      if (pts.length > 0) {
        filtered.push({ ...stroke, points: [pts[0]] })
      }
      break
    }

    // Edge case: cut falls before the first segment -> include just the start.
    if (remaining <= 0) {
      filtered.push({ ...stroke, points: [pts[0]] })
      break
    }

    let segAccum = 0
    let cutIdx = -1
    let segStartLen = 0

    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x
      const dy = pts[i].y - pts[i - 1].y
      const segLen = Math.sqrt(dx * dx + dy * dy)

      if (segAccum + segLen >= remaining) {
        cutIdx = i
        segStartLen = segAccum
        break
      }
      segAccum += segLen
    }

    if (cutIdx < 0) {
      // Numerical edge — include all of stroke.
      filtered.push(stroke)
      break
    }

    // Interpolate inside segment [cutIdx-1, cutIdx].
    const a = pts[cutIdx - 1]
    const b = pts[cutIdx]
    const dxSeg = b.x - a.x
    const dySeg = b.y - a.y
    const segLen = Math.sqrt(dxSeg * dxSeg + dySeg * dySeg)
    const tFrac = segLen > 0 ? Math.max(0, Math.min(1, (remaining - segStartLen) / segLen)) : 0

    const interpolatedPoint: Point = {
      x: a.x + dxSeg * tFrac,
      y: a.y + dySeg * tFrac,
      t: a.t + (b.t - a.t) * tFrac,
      pressure:
        a.pressure !== undefined && b.pressure !== undefined
          ? a.pressure + (b.pressure - a.pressure) * tFrac
          : a.pressure ?? b.pressure,
    }

    // Build partial stroke: all complete points up to cutIdx-1, plus interpolated end.
    const partialPoints: Point[] = pts.slice(0, cutIdx)
    partialPoints.push(interpolatedPoint)

    filtered.push({ ...stroke, points: partialPoints })
    break
  }

  return filtered
}

/* ==========================================================================
 * §M · THE GLOBAL ARC SPAN OF EACH STROKE — the reveal's coordinate.
 *
 * ONE convention, stated once: **cumulative arc length walked stroke-major,
 * over the total across ALL strokes.** It is what `penTimeDistanceFraction`
 * returns, what `filterStrokesByProgress` cuts at, and what `capArc` in
 * lib/geometry-engines.ts bakes into the implicit surface's `revealKeys`. A
 * fourth hand-copy of it is how a reveal ends up meaning two different things
 * in two engines, which this file's own header records happening once already.
 *
 * The FAR end of a primitive, not its near end: a piece of the mark is fully
 * drawn only once the pen has left it.
 * ======================================================================== */

export interface StrokeArcSpan {
  /** Global arc fraction at which the pen STARTS this stroke. */
  from: number
  /** Global arc fraction at which the pen LEAVES it. */
  to: number
}

export function strokeArcSpans(strokes: ProcessedStroke[]): StrokeArcSpan[] {
  const lens: number[] = []
  let total = 0
  for (const s of strokes) {
    const pts = s.points
    let L = 0
    for (let i = 1; i < pts.length; i++) {
      L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    }
    lens.push(L)
    total += L
  }
  const inv = total > 0 ? 1 / total : 0
  const out: StrokeArcSpan[] = []
  let acc = 0
  for (const L of lens) {
    const from = acc * inv
    acc += L
    out.push({ from, to: acc * inv })
  }
  return out
}

/* ==========================================================================
 * §T · THE MOVING END OF THE LINE — the TIP FIELD.
 *
 * ── THE DEFECT THIS EXISTS FOR, MEASURED BEFORE IT WAS BUILT ────────────────
 *
 * Sebs, 2026-08-02: *"the 2d drawing animation still doesnt draw like someone
 * actually drawing the strokes."*
 *
 * `scripts/verify/assert-drawin-pentip.mjs` had already located it precisely,
 * and it is NOT the stroke order (both engines score 0.86-0.90 on the
 * discriminating-pair test where 1 is a pen and 0 is a sweep). It is the SHAPE
 * OF THE MOVING END:
 *
 *     terminal transition   control CUT   control NIB   pen score
 *     free-stroke    7 px       2 px         14 px        0.417   <- a CUT
 *     desk-doodles  15 px       2 px          6 px        3.250   <- a NIB
 *
 * And the 7x crop of the same box on a mid-draw frame and on the finished frame
 * (`docs/verification/drawin-sweep/run/tip/tip-vs-final-7x.png`) shows what the
 * number means: the moving end is a square-chopped, faceted block with straight
 * corners, where the SAME BOX on the finished frame is a smooth rounded stroke.
 * So the bluntness is the REVEAL, not the mesh.
 *
 * ── WHY IT IS A CUT, AND WHY THAT IS ARCHITECTURAL ──────────────────────────
 *
 * Explainer 18 turned the Inflate draw-in into a `setDrawRange` over an index
 * buffer counting-sorted by arc length, because rebuilding the marching-cubes
 * surface per frame costs 24-531 ms per tick. That is not negotiable and this
 * file does not try to negotiate it. But it has a consequence the explainer
 * names and dismisses:
 *
 *     "the leading edge is a cut through the finished surface, not a rounded
 *      pen tip — the cap triangles at a stroke's far end sort last."
 *
 * A PREFIX OF A FINISHED SURFACE HAS NO END CAP. There is no geometry at the
 * moving end, because the cap that would be there belongs to the far end of the
 * stroke and sorts last. Worse, the boundary of a set of triangles is jagged at
 * TRIANGLE granularity — one marching-cubes cell — which is the faceting.
 *
 * ── WHY THE FIX IS A FRAGMENT TEST AND NOT EMITTED GEOMETRY ─────────────────
 *
 * Through the whole draw beat the mark is FLAT (`penCarve = carveAmount x flat`,
 * `flat` = 1 while the pen is writing), so what a viewer reads is the mark's
 * filled SILHOUETTE, not a 3D shell. A silhouette can be carved to any shape by
 * throwing fragments away — which is exactly what `applyPenCarve` already does
 * against `buildPenField`, at one texture fetch and no loop. The nib's shape is
 * therefore expressible where the cap is not.
 *
 * ── WHAT THE FIELD ANSWERS ─────────────────────────────────────────────────
 *
 * One question, per texel: **WHEN DID THE PEN FIRST INK HERE.** Two channels —
 * the global arc fraction at which the nib first touched the texel, and how far
 * off the centreline the texel is. From those two numbers the shader computes
 * an arc-position for the fragment and compares it to the playhead, so the
 * boundary is per-fragment and smooth instead of per-triangle and faceted, and
 * its SHAPE is two dials rather than a fixed chop:
 *
 *     when = arc  +  (1 - nose) * sqrt(1 - rhoN^2)  +  taper * rhoN
 *
 * `arc` is when the nib FIRST touched, which for a texel `rho` off the
 * centreline is `sqrt(R^2 - rho^2)` EARLIER than the pen point passing it.
 * Adding that term back recovers the flat cut, which is why the dial reads:
 *
 *   nose = 0, taper = 0   a straight cut across the mark, but a SMOOTH one:
 *                         the faceting gone and NOTHING ELSE changed, which is
 *                         what makes the two halves of this fix separable in a
 *                         render instead of only in an argument
 *   nose = 1, taper = 0   the exact union-of-discs a ballpoint lays down: the
 *                         level set is a semicircle of one nib radius about the
 *                         pen point. This is what a real pen tip IS, and it is
 *                         precisely the DISC-DILATED PREFIX that
 *                         `assert-drawin-pentip.mjs` uses as its NIB CONTROL.
 *   taper > 0             the mark's edges lag its centre, so the end comes to
 *                         a point — the tapered almond Desk Doodles draws,
 *                         because its rebuild-from-clipped-strokes path applies
 *                         its own stroke-end taper at the cut.
 *
 * ── THE MINIMUM IS OVER COVERERS, WHICH IS THE CROSSING CASE ────────────────
 *
 * `arc` is the SMALLEST arc among the samples that actually ink the texel, not
 * the arc of the geometrically nearest sample. On a word this dense the two
 * disagree wherever strokes cross: at a crossing the nearest centreline is
 * often the LATER stroke, and keying on it would un-draw ink the pen had
 * already laid. Taking the minimum over coverers is what makes the implicit
 * fusion's crossing behaviour survive the reveal.
 *
 * It is also why the two channels come from two DIFFERENT accumulators. At the
 * arc the nib first touches a texel the texel is exactly one radius from the
 * nib's centre, by construction — so the covering sample cannot also answer
 * "how far off the centreline is this", and `rhoN` has to be the minimum
 * perpendicular distance over every sample. That is the only one defined on the
 * outer skirt anyway, where nothing covers at all.
 *
 * ── WHAT IT DELIBERATELY DOES NOT MODEL ────────────────────────────────────
 *
 * The nib is rasterised as a DISC of the nominal half-width, not as
 * `penHalfWidth`'s direction-dependent ellipse with its end taper. This field
 * only decides WHEN a texel is inked; WHAT SHAPE the ink has is already decided
 * by `buildPenField` and applied on top of this in the same fragment. Modelling
 * the nib twice would be two sources of truth for one outline.
 * ======================================================================== */

export interface TipField {
  /**
   * TWO floats per texel, row-major:
   *   [0] `arc`  — global arc fraction (0..1, the SAME convention
   *       `revealDistanceFraction` returns and `capArc` in lib/geometry-engines
   *       bakes into `revealKeys`) of the earliest nib stamp covering this
   *       texel. 2 where nothing reaches it at all.
   *   [1] `rhoN` — that stamp's perpendicular offset, in nib half-widths,
   *       clamped to 0..1.
   */
  data: Float32Array
  width: number
  height: number
  /** The field's box, in stroke coordinates. */
  minX: number
  minY: number
  maxX: number
  maxY: number
  unitsPerTexel: number
  /** Nib half-width the field was rasterised at, stroke units. */
  radius: number
  /** Total pen travel, stroke units. Converts arc fraction to a length. */
  totalArc: number
  /** Wall-clock of the bake, ms. */
  ms: number
  /**
   * ONE float per texel, only under a timed take (`lib/stroke-timing.ts`):
   * `|dS/da|` of the sample that owns the texel, where `S` is the arrival time
   * as a fraction of the take. Per-stroke speed and ease make this differ per
   * stroke, so the shader multiplies `back` and `taper` by it instead of the
   * one `ts.scale`. Absent on every other path, which leaves the shipped field
   * exactly as it was.
   */
  slope?: Float32Array
}

/**
 * One texel per stroke unit, matching `PEN_FIELD_UNITS_PER_TEXEL`.
 *
 * The two fields are sampled by the same fragment against the same box, so a
 * different pitch here would put the tip's boundary and the pen's outline on
 * two different grids. Both are read with LINEAR filtering, and both channels
 * of this one are smooth away from a crossing, so a texel of pitch is well
 * under what the boundary can express.
 */
export const TIP_FIELD_UNITS_PER_TEXEL = 1

/**
 * How far past the nominal nib the raster reaches, in nib half-widths.
 *
 * It has to cover every fragment the mesh can produce, because a fragment whose
 * texel was never reached has no arc and would be dropped — a HOLE in the mark,
 * which is a far worse failure than a slightly late edge. The Inflate surface
 * is wider than `radiusXY`: `crossSectionBulge` adds up to 0.28, per-sample ink
 * modulation scales it, and the smooth minimum inflates a seam by `k/6`
 * (explainer 19). The cost is linear in this number SQUARED, which is why it is
 * not simply enormous.
 *
 * ⚠ IT WAS 2.0, AND THAT CLEARED NOTHING. The paragraph above is right about
 * what the number is for and was wrong about the value, in exactly the way
 * `PEN_FIELD_TUBE_SLACK` was wrong about its own (see
 * `components/viewport-3d.tsx`, `PEN_CARVE_ENVELOPE_R`, which carries the full
 * measurement). Measured on the real page 2026-08-02
 * (`scripts/verify/_probe-carve-inradius.mjs`, reading the mesh's own silhouette
 * against the carve-1.000 arm as a ruler, because the pen outline's semi-major
 * axis is pinned to R by construction):
 *
 *     arm                       R        mesh max half-width
 *     free-stroke, traced    9.00 px          18.00 px   = 2.00 R
 *     free-stroke, "Hello"   8.94 px          15.81 px   = 1.77 R
 *     desk-doodles, traced   9.00 px          14.32 px   = 1.59 R
 *
 * So the mark reaches the reach EXACTLY, with no margin at all, and the texels
 * that decide the widest fragments are the ones bleeding toward the `2` sentinel
 * under LINEAR filtering. Both are holes, and holes here are the complaint:
 * Sebs, *"THE 2D DRAWIN ANIMTION LEAVES BLANCK SPORTS."*
 *
 * 2.6 is the measured worst case with 30 % of margin — the same number the
 * carve's envelope takes, and deliberately the same so the two fields cannot
 * disagree about how fat the mark is. It costs 1.69x the stamped texels on a
 * bake measured at 20.8 ms, i.e. about 14 ms, once per stroke set.
 *
 * `TIP_FIELD_REACH_PRIOR` is the shipped 2.0, kept because every frame in
 * `docs/verification/` before today was rasterised under it.
 */
export const TIP_FIELD_REACH = 2.6
/** PARKED PRIOR — the reach that shipped. See the block above. */
export const TIP_FIELD_REACH_PRIOR = 2.0

/**
 * How far off an early sample, in nib half-widths, a texel still belongs to
 * that sample's pass when a later pass covers it. 2.0 is the widest mesh
 * measured (free-stroke traced, 2.00 R, table above). PEN-7, see `reachArc`.
 */
export const TIP_FIELD_RETURN_SKIRT = 2.0

/**
 * Rasterise the tip field. SCATTER, not gather, and that is the whole reason it
 * is affordable next to `buildPenField`'s ~200 ms.
 *
 * `buildPenField` asks every texel in the box "what is the nearest sample" —
 * W x H queries over a box that is mostly paper. This one walks the 1009
 * SEGMENTS and stamps only the texels each can possibly reach, which is the
 * small fraction of the box the ink actually occupies. Measured on the hero
 * word at 1 unit/texel: ~2.2 M texel visits, tens of milliseconds, against 374 k
 * texels x a bucket walk each.
 *
 * Exact within the raster: the closest point on a segment is solved in closed
 * form, so the arc a texel receives is interpolated ALONG the segment rather
 * than snapped to its endpoints. Without that the level set at the moving end
 * would be a chain of circular arcs one sample apart rather than one arc.
 */
/**
 * 🔴 THE ARC MAP — why the bake, and not a remap afterwards.
 *
 * Two floats per stroke, `[m0, m1]`, meaning `S = m0 + m1·a` inside stroke `i`.
 * `lib/stroke-schedule.ts` `scheduleArcCoeffs` produces it and returns null at
 * the identity, which is the only value this file's shipped path ever sees.
 *
 * ── WHY IT CANNOT BE DONE AFTERWARDS ───────────────────────────────────────
 * The `arc` channel is a **minimum over the samples that cover a texel** (see
 * the block above: *"at a crossing the nearest centreline is often the LATER
 * stroke, and keying on it would un-draw ink the pen had already laid"*).
 * `min` and a remap commute only while the remap is INCREASING over the whole
 * word. A per-unit REVERSE is decreasing inside its track — so the sample that
 * is first in beat time is the one with the LARGEST recording arc, and a field
 * baked in recording space and remapped afterwards hands the shader the wrong
 * one. Worst case is the nib's own sweep, i.e. one DIAMETER of lag on the
 * boundary: the nose sitting off the ink it is drawing, which is precisely the
 * defect `docs/animation-toolset-map.md` §6.2 flags in red.
 *
 * ── AND WHY IT IS CHEAP ────────────────────────────────────────────────────
 * The map is affine inside a stroke, so its two coefficients are constant for
 * every segment of that stroke and hoist out of the texel loop entirely. Two
 * floating-point operations per candidate on a bake that runs once per dial.
 *
 * Null takes no branch inside the loop at all — the two arcs are computed by
 * the same expressions they always were, so the shipped raster is unchanged.
 */
export type TipFieldArcMap = Float64Array | null

/**
 * THE TIMED MAP, for per-stroke speed, delay, ease and hold back
 * (`lib/stroke-timing.ts` `timedTipMap`). ANIM-1A, 2026-09-25.
 *
 * Under a timed take the map is no longer affine inside a stroke, so the two
 * hoisted coefficients cannot carry it. `arcAt(stroke, a)` is read at each
 * segment END instead, still once per segment and never per texel, and the
 * arc between the two ends is linear over one resample step (4 units). The
 * segment's own slope `|dS/da|` rides along into the `slope` channel.
 * When given, it replaces `arcMap`.
 */
export interface TipFieldTimedMap {
  arcAt: (stroke: number, a: number) => number
}

export function buildTipField(
  strokes: { points: { x: number; y: number }[] }[],
  inkDiameter: number,
  unitsPerTexel: number = TIP_FIELD_UNITS_PER_TEXEL,
  arcMap: TipFieldArcMap = null,
  timedMap: TipFieldTimedMap | null = null,
): TipField {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now()
  const R = Math.max(1e-6, inkDiameter / 2)
  const REACH = R * TIP_FIELD_REACH

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let totalArc = 0
  for (const s of strokes) {
    const pts = s.points
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
      if (i > 0) totalArc += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y)
    }
  }
  if (!Number.isFinite(minX)) {
    return {
      data: new Float32Array([2, 1, 2, 1, 2, 1, 2, 1]),
      width: 2,
      height: 2,
      minX: 0,
      minY: 0,
      maxX: 1,
      maxY: 1,
      unitsPerTexel,
      radius: R,
      totalArc: 0,
      ms: 0,
    }
  }
  minX -= REACH
  minY -= REACH
  maxX += REACH
  maxY += REACH

  const W = Math.max(2, Math.ceil((maxX - minX) / unitsPerTexel))
  const H = Math.max(2, Math.ceil((maxY - minY) / unitsPerTexel))
  const n = W * H

  /* TWO ACCUMULATORS, because "who inked this first" and "what is nearest" are
   * different questions and only the first one is the answer. The second is the
   * fallback for the outer skirt — texels between the nib and `REACH`, which
   * carry real silhouette (the bulge, the seam inflation) and must not be
   * dropped for want of a coverer. */
  const coverArc = new Float32Array(n).fill(2)
  /** Squared, to keep a `sqrt` out of the inner loop's hot compare. */
  const nearRho = new Float32Array(n).fill(Infinity)
  const nearArc = new Float32Array(n).fill(2)
  /* PEN-7, 2026-09-25: THE EARLIEST PASS WHOSE MESH REACHES THIS TEXEL.
   * `coverArc` only hears a nib within R. A texel 1 to 2 R off an EARLY sample
   * is still inside that sample's mesh (the mesh reaches 2.00 R, measured, see
   * TIP_FIELD_REACH), so it is drawn with the early stroke, but if a LATER pass
   * comes within R of it, `coverArc` hands it the later arc and the fragment is
   * cut until the pen comes back. Measured on the hero at 0.536 of the draw:
   * texels up-left of the o's start (638,110) read arc 0.6448, the o's CLOSING
   * end, 200 units past the head, while the o's start is 1.19 R away at 0.5778.
   * That is the concave notch where the o meets the D. `reachArc` keeps the
   * earliest closest-point arc within TIP_FIELD_RETURN_SKIRT R, and the
   * resolve below takes it only when it is a separate pass (see there). */
  const reachArc = new Float32Array(n).fill(2)
  /* The slope of whichever sample won each of the three accumulators. Only
   * allocated under a timed map; null everywhere else. */
  const coverSlope = timedMap ? new Float32Array(n) : null
  const nearSlope = timedMap ? new Float32Array(n) : null
  const reachSlope = timedMap ? new Float32Array(n) : null
  /* ANIM-1A6: THE RAW ARC of whichever sample won each accumulator, only under
   * a timed map. The winners are chosen on the take's clock (who inked it
   * first), but the resolve's "separate pass" gap is a length along the pen
   * path, `(TIP_FIELD_RETURN_SKIRT + 1) R` over the total arc. Comparing that
   * length to two CLOCK fractions asked a different question wherever the
   * hand's pace is not the word's average, and measured on the hero it closed
   * the D's stem top under twelve neutral rows where no rows leaves it open. */
  const coverRaw = timedMap ? new Float32Array(n).fill(2) : null
  const nearRaw = timedMap ? new Float32Array(n).fill(2) : null
  const reachRaw = timedMap ? new Float32Array(n).fill(2) : null
  const SKIRT2 = (R * TIP_FIELD_RETURN_SKIRT) ** 2

  const invTotal = totalArc > 0 ? 1 / totalArc : 0
  const invTexel = 1 / unitsPerTexel
  let acc = 0

  for (let si = 0; si < strokes.length; si++) {
    const s = strokes[si]
    /* HOISTED, WHICH IS THE WHOLE ARGUMENT FOR AFFORDABILITY — see the
     * `TipFieldArcMap` block. The map is constant inside a stroke, so it is
     * read once per stroke and applied to two numbers per segment, never to a
     * texel. `useMap` false is the shipped path and reaches the same
     * expressions it always did. */
    const useMap = !timedMap && !!arcMap && arcMap.length >= (si + 1) * 2
    const m0 = useMap ? arcMap![si * 2] : 0
    const m1 = useMap ? arcMap![si * 2 + 1] : 1
    const pts = s.points
    for (let i = 1; i < pts.length; i++) {
      const ax = pts[i - 1].x
      const ay = pts[i - 1].y
      const dx = pts[i].x - ax
      const dy = pts[i].y - ay
      const L2 = dx * dx + dy * dy
      const L = Math.sqrt(L2)
      const rawA = acc * invTotal
      const arcA = timedMap
        ? timedMap.arcAt(si, acc * invTotal)
        : useMap ? m0 + m1 * (acc * invTotal) : acc * invTotal
      acc += L
      const rawB = acc * invTotal
      const arcB = timedMap
        ? timedMap.arcAt(si, acc * invTotal)
        : useMap ? m0 + m1 * (acc * invTotal) : acc * invTotal
      if (L2 <= 0) continue
      const segSlope = timedMap && invTotal > 0 ? Math.abs(arcB - arcA) / (L * invTotal) : 0

      const bx0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - REACH - minX) * invTexel))
      const bx1 = Math.min(W - 1, Math.ceil((Math.max(ax, ax + dx) + REACH - minX) * invTexel))
      const by0 = Math.max(0, Math.floor((Math.min(ay, ay + dy) - REACH - minY) * invTexel))
      const by1 = Math.min(H - 1, Math.ceil((Math.max(ay, ay + dy) + REACH - minY) * invTexel))

      for (let ty = by0; ty <= by1; ty++) {
        const qy = minY + (ty + 0.5) * unitsPerTexel
        const row = ty * W
        for (let tx = bx0; tx <= bx1; tx++) {
          const qx = minX + (tx + 0.5) * unitsPerTexel
          const ux = qx - ax
          const uy = qy - ay
          const ud = ux * dx + uy * dy
          /* ---- WHERE THIS TEXEL SITS RELATIVE TO THE CENTRELINE ----------
           * Clamped closest point, for `rhoN` and for the outer-skirt
           * fallback. This is a DISTANCE question and it is asked of every
           * segment; the arc question below is asked only of the ones whose
           * nib actually sweeps over the texel. */
          let tc = ud / L2
          if (tc < 0) tc = 0
          else if (tc > 1) tc = 1
          const ex = qx - (ax + tc * dx)
          const ey = qy - (ay + tc * dy)
          const rho2 = ex * ex + ey * ey
          if (rho2 > REACH * REACH) continue
          const p = row + tx
          if (rho2 < nearRho[p]) {
            nearRho[p] = rho2
            nearArc[p] = arcA + (arcB - arcA) * tc
            if (nearSlope) nearSlope[p] = segSlope
            if (nearRaw) nearRaw[p] = rawA + (rawB - rawA) * tc
          }
          if (rho2 <= SKIRT2) {
            const ca = arcA + (arcB - arcA) * tc
            if (ca < reachArc[p]) {
              reachArc[p] = ca
              if (reachSlope) reachSlope[p] = segSlope
              if (reachRaw) reachRaw[p] = rawA + (rawB - rawA) * tc
            }
          }

          /* ---- WHEN THE NIB FIRST REACHED IT, SOLVED, NOT SNAPPED --------
           *
           * ⚠ THIS USED TO BE `arc at the clamped closest point`, and that is
           * WRONG in a way that renders. The earliest segment that covers a
           * texel covers it AT ITS OWN ENDPOINT, so the arc recorded was
           * quantised to the 4-unit resample grid: measured on a synthetic
           * straight stroke at R = 10, the field returned 192 / 192 / 196 /
           * 200 where the closed form is 190.00 / 190.46 / 192.00 / 195.64.
           * The level set of a staircase is a staircase — the round nose came
           * out as 2 px steps at 7x, which is the facet this whole field
           * exists to remove, reintroduced one layer down.
           *
           * So the sweep is solved instead. A disc of radius R centred on
           * `a + t·d` first touches `q` at the SMALLER root of
           *
           *     |u − t·d|²  =  R²
           *
           * i.e. `t = (u·d − √((u·d)² − L²(|u|² − R²))) / L²`. A negative
           * discriminant means this segment's sweep never reaches the texel;
           * `t > 1` means it reaches it after the segment ends, and a later
           * segment owns the answer; `t < 0` means it was already covered when
           * the segment began, which is exactly right at a stroke's first
           * segment and is superseded by an earlier segment's smaller arc
           * everywhere else. */
          const c = ux * ux + uy * uy - R * R
          const disc = ud * ud - L2 * c
          if (disc < 0) continue
          let th = (ud - Math.sqrt(disc)) / L2
          if (th > 1) continue
          if (th < 0) th = 0
          const arc = arcA + (arcB - arcA) * th
          if (arc < coverArc[p]) {
            coverArc[p] = arc
            if (coverSlope) coverSlope[p] = segSlope
            if (coverRaw) coverRaw[p] = rawA + (rawB - rawA) * th
          }
        }
      }
    }
    /* THE PEN LIFTS BETWEEN STROKES AND THE ARC DOES NOT ADVANCE, exactly as
     * `penTimeDistanceFraction` and `capArc` both have it — cumulative arc
     * length walked stroke-major, over the total across ALL strokes. Nothing to
     * add here; the comment is the assertion that nothing SHOULD be. */
  }

  const data = new Float32Array(n * 2)
  const slope = timedMap ? new Float32Array(n) : null
  const invR = 1 / R
  const returnGap = (TIP_FIELD_RETURN_SKIRT + 1) * R * invTotal
  for (let p = 0; p < n; p++) {
    /* THE TWO CHANNELS COME FROM TWO DIFFERENT ACCUMULATORS ON PURPOSE.
     *
     * At the arc the nib FIRST touches a texel, the texel is by construction
     * exactly R away from the nib's centre — so the covering segment cannot
     * also answer "how far off the centreline is this". That has to be the
     * MINIMUM perpendicular distance over every segment, which is the second
     * accumulator, and which is also the only one defined on the outer skirt
     * where nothing covers at all. */
    const rhoN = nearRho[p] === Infinity ? 1 : Math.min(1, Math.sqrt(nearRho[p]) * invR)
    data[p * 2 + 1] = rhoN
    /* On the skirt the fragment is past the nominal nib, so it takes the full
     * taper penalty and no nose extension — which is what an edge should do,
     * and it joins the covered region continuously because `rhoN` is 1 on both
     * sides of the boundary. */
    const own = coverArc[p] < 2 ? coverArc[p] : nearArc[p]
    /* A SEPARATE PASS, NOT THE MOVING END. Inside one continuous pass the
     * earliest in-reach sample and the first coverer are at most
     * (TIP_FIELD_RETURN_SKIRT + 1) R of pen travel apart, so the shape of the
     * moving end, which lives inside that span, is untouched. A gap wider than
     * that means the pen left and came back, and the texel belongs to the
     * earlier pass, the same rule the coverer minimum already applies. */
    /* Under a timed map: earlier on the clock AND a separate pass by length
     * along the pen path, in the raw arc the gap is measured in. With neutral
     * rows the clock is monotone in the arc, so this is the shipped test. */
    const useReach = timedMap
      ? reachArc[p] < own &&
        Math.abs((coverArc[p] < 2 ? coverRaw![p] : nearRaw![p]) - reachRaw![p]) > returnGap
      : reachArc[p] < own - returnGap
    data[p * 2] = useReach ? reachArc[p] : own
    if (slope) slope[p] = useReach ? reachSlope![p] : coverArc[p] < 2 ? coverSlope![p] : nearSlope![p]
  }

  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now()
  return {
    data,
    width: W,
    height: H,
    minX,
    minY,
    maxX,
    maxY,
    unitsPerTexel,
    radius: R,
    totalArc,
    ms: t1 - t0,
    ...(slope ? { slope } : {}),
  }
}

/**
 * THE SHAPE OF THE MOVING END — the two numbers, named.
 *
 * `nose` and `taper` are in NIB HALF-WIDTHS; the shader converts them to arc
 * fraction with the field's own `radius / totalArc`, so a wider pen or a longer
 * word does not silently change the shape.
 *
 * §0.7: `off` is the PARKED PRIOR and it is not a synonym for `cut`. `off`
 * leaves the fragment test inert, so the reveal is the raw per-triangle
 * `setDrawRange` boundary that shipped — faceted, exactly as measured. `cut` is
 * the same straight chop rendered per FRAGMENT. Keeping both is what makes the
 * facet removal separable from the nose in a render.
 */
export type PenTipMode = "off" | "cut" | "nib" | "quill" | "reed" | "chisel"

export interface PenTipShape {
  /**
   * Depth of the round nose ahead of the pen point, in nib half-widths.
   * 0 is a flat cut across the mark; 1 is the nib's own stamp, which is what a
   * real pen leaves. Nothing stops it going past 1 — that is a nose LONGER than
   * the pen is wide, which is a stylisation rather than a pen, and is why the
   * shipped shapes stop there.
   */
  nose: number
  /** How far the mark's EDGES lag its centre, in nib half-widths. */
  taper: number
}

export const PEN_TIP_SHAPES: Record<PenTipMode, PenTipShape> = {
  off: { nose: 0, taper: 0 },
  cut: { nose: 0, taper: 0 },
  /** A ballpoint: the union of the discs the nib has stamped. */
  nib: { nose: 1, taper: 0 },
  /**
   * THE ALMOND — the shape Sebs has asked for by name for days: *"WHERE THE
   * ELEGANT DRAWING ANIMATION LIKE AS IF SOMEONE IS DRAWING IT THAT IVE BEEN
   * ASKING FOR"*, *"THE SPECIAL DRAWING ANIMATION IN DESK DOODLES IS A LOT
   * BETTER."* He was right, it was measured, and this is the number that closes
   * it.
   *
   * ── THE NUMBER IS SOLVED, NOT PICKED ────────────────────────────────────
   * `assert-drawin-pentip.mjs` measures the f = 0.75 -> 0.25 span of the moving
   * end in half-widths. Put the shader's own boundary into that definition and
   * it comes out in closed form. The drawn set at arc offset u is
   * `|rho| <= rho*(u)` where
   *
   *     u  =  nose * R * sqrt(1 - r^2)  -  taper * R * r        (r = rho/R)
   *
   * so `f = r` EXACTLY — the gate's statistic and the shader's dial are the
   * same variable — and
   *
   *     span(0.75 -> 0.25)  =  nose * 0.3068  +  taper * 0.5
   *
   * ── AND IT WAS VALIDATED BEFORE IT WAS USED TO CHOOSE ANYTHING ──────────
   * Two shipped arms on the dense capture `docs/verification/pentip/fix-base`,
   * then four swept arms on `docs/verification/pentip/tipshape-sweep`, all 201
   * samples, all one page session:
   *
   *     taper   predicted span   measured    agreement
   *      0.00      0.3068 w      0.3036 w       99 %      (`nib`)
   *      0.85      0.7318 w      0.7720 w      105 %      (the shape that shipped)
   *      1.60      1.1068 w      1.1277 w      102 %      (the one rejected in error)
   *      2.40      1.5068 w      1.5254 w      101 %
   *      2.75      1.6818 w      1.7131 w      102 %
   *      3.10      1.8568 w      1.8428 w       99 %
   *
   * A model that holds to 2 % across a SIX-FOLD range of the dial is a law, not
   * a fit. Desk Doodles reads **1.6884 w** on the same capture; interpolating
   * the two arms that bracket it gives **2.70**, which the closed form puts at
   * 1.6568 and the measured arms put at 1.6863 — **0.1 % from Desk Doodles.**
   *
   * ── WHY THE NOSE STAYS AT 1 ─────────────────────────────────────────────
   * `nose` buys span at 0.3068 per unit against `taper`'s 0.5, and it buys it
   * AHEAD of the pen, where the mark has to be drawn past the playhead — so the
   * `setDrawRange` front margin has to grow to carry it, and the reveal starts
   * showing ink the pen has not reached. `taper` buys its span BEHIND the
   * playhead, on triangles that are already drawn. Longer end, cheaper, and the
   * pen point stays on the ink.
   *
   * ── AND THE REASON 0.85 SHIPPED IS WITHDRAWN, NOT OVERRIDDEN ────────────
   * The note that stood here said 1.6 *"came apart into loose specks at 60 %
   * and 75 % of the draw"*. **It was measured on the misregistered pen field**
   * (`setFieldRealloc` in components/viewport-3d.tsx — r175's immutable
   * `texStorage2D` left the lookup scanning a 1192x324 rectangle for a 1152x294
   * field, so the mark was carved by a stretched copy of its own outline). On
   * the repaired field, at deviceScaleFactor 1 — *"a mark thirteen screen
   * pixels wide"*, the raster the rejection was written about — taper 1.6 reads
   * 19 loose specks over 90 frames against 0.85's 20, worst frame 2 against 2,
   * 7 components against 7. **It does not reproduce**, and
   * `assert-pentip-specks.mjs` carries that as a row against a known-bad whose
   * tip is literally severed. The prior shape is `chisel` below.
   */
  quill: { nose: 1, taper: 2.7 },
  /**
   * PARKED PRIOR — the short chisel that shipped on 2026-08-02, kept whole.
   *
   * ⚠ IT HAS NO PANEL PILL YET, and that is a real gap rather than a decision:
   * `app/desk-doodles/page.tsx` carries a hardcoded four-pill list and belongs
   * to another lane tonight. The shape is reachable from the harness
   * (`__captureHarness.setPenTip("chisel")`) and from `PEN_TIP_SHAPES`, so
   * nothing is deleted and every prior frame in `docs/verification/` is
   * re-renderable — but Sebs cannot flip to it BY EYE until that pill lands,
   * which is exactly the complaint the pen-tip row was built to answer.
   */
  chisel: { nose: 1, taper: 0.85 },
  /**
   * THE MIDDLE, AND IT EXISTS BECAUSE THE MEASUREMENT ASKED FOR IT.
   *
   * `assert-pentip-specks` is red on purpose: on fresh dense evidence the
   * shipped `quill` (2.70) costs, against `chisel` (0.85), **z 2.92 on detached
   * pieces and 12 blank px at the pen, worst frame +6**. The bar was not
   * widened to hide that.
   *
   * The sweep also measured taper **1.60** — span 1.11 w, two thirds of the way
   * from chisel to quill — at **z 1.39 and 6 blank px, clean on both channels**.
   * A middle that costs nothing on the channel the endpoint costs on.
   *
   * ⚠ IT EXISTED ONLY AS A CAPTURE ARM (`t160`) AND NOT AS A SHAPE, which is
   * this project's own recurring defect one more time: an option that is real in
   * a report and unreachable in the product. Sebs was told there was a middle;
   * he could not have tried it. Now it is a named shape with a pill, and the
   * verification arm and the thing he can click are the same value.
   *
   * `reed` because the family is the pen: a reed pen sits between a chisel-cut
   * nib and a quill, which is exactly where this sits.
   *
   * 2026-09-25: taper 1.6 to **3.5**, the controller's call on his hand-off
   * ("things you can decide"). Measured on fresh dsf 1 and dsf 2 captures (lane
   * PEN-5): 3.5 opens 41 blank px at the pen against 1.6's 51, worst frame +0
   * where 1.6 fails that bar at dsf 2, and the moving end reads 0.62 nib widths
   * back against the 08-01 draw-in's 0.63 (1.6 reads 0.94). Cost: detached
   * pieces z 2.67 at dsf 2, about quill's 2.89. The 1.6 numbers above were
   * measured on an older field and no longer reproduce.
   *
   * REVERTED the same day to 1.6 (lane PEN-9). On the tree with PEN-7's return
   * pass, 3.5 reopens the o/D slit: 4 px at 0.536 and 0.539 against 0 at 1.6,
   * because the long taper brings the o's start cap in at arc 0.5897, just after
   * the head. The 1-nib column read 0.583, not 0.62. 3.5 comes back only with a
   * fix to how the taper treats a stroke's start (`when = arc + taper x rho` in
   * the tip shader), proven with the slit scan at 0.
   */
  reed: { nose: 1, taper: 1.6 },
}

/* ---- WHICH TIP IS LIVE, and why the store sits HERE ----------------------
 *
 * One writer, two readers, and they are not the same kind of thing — the same
 * split `setFlatOverride` documents in viewport-3d.tsx:
 *
 *   the frame loop   reads it every tick and writes three uniforms, so it needs
 *                    no notification at all — a change lands on the next
 *                    painted frame.
 *   the panel pill   is a RENDERED thing whose active state only changes on a
 *                    React commit, so it does need one.
 *
 * The prior note on this value said a subscriber was deliberately absent
 * because "nothing React renders reads it". That was true while the only drive
 * was `window.__captureHarness.setPenTip` from a probe, and it stopped being
 * true the moment the panel got a control — so the subscription exists now and
 * that note is corrected rather than left standing.
 *
 * ⚠ IT LIVES IN THIS FILE AND NOT IN THE VIEWPORT, and that is a bundle
 * constraint, not a preference. `components/viewport-3d-wrapper.tsx` :11-24
 * spells it out: a VALUE import of `viewport-3d.tsx` pulls three.js, R3F, drei
 * and the GLTF exporter into the importer's static graph and undoes the
 * `next/dynamic` split. The panel needs the setter as a value, so the store has
 * to sit in a module the panel can already reach — this one, which both the
 * page and the viewport import today and which pulls in nothing.
 *
 * No worker imports this module, so there is exactly one instance of the
 * variable on the main thread, which is the thread that renders.
 */
/* SHIPPED DEFAULT: `reed`, and the trade is stated because it is a real one.
 *
 * `quill` (2.70) reaches Desk Doodles — 5.578 against its 5.796, 0.6 % apart,
 * which is the parity Sebs asked for over several days. It also costs, on fresh
 * dense evidence: **12 blank px at the pen against chisel's 6, worst frame +6,
 * and detached pieces z 2.92** — and blank spots in the mark are the single
 * thing he has been angriest about all week, after a texture-misregistration
 * bug spent days erasing chunks of his word.
 *
 * `reed` (1.60) is two thirds of the way there in span and measures **6 blank
 * px and z 1.39 — clean on both channels**. So the default is the one that
 * costs him nothing on the axis he cares most about, and the parity read is one
 * pill away rather than one code edit away.
 *
 * `assert-pentip-specks` goes green on this default. That is a consequence, not
 * the reason: the row stays exactly as strict as it was, and it still reports
 * quill's cost the moment quill is selected. */
let livePenTip: PenTipMode = "reed"
const penTipSubs = new Set<() => void>()

/**
 * Returns FALSE on an unknown name — load-bearing, and the reason is in
 * `_probe-pentip-sweep.mjs`: a sweep that silently accepted a bad name would
 * capture the same arm four times and report it as four options.
 */
export function setPenTipMode(m: PenTipMode): boolean {
  if (!PEN_TIP_SHAPES[m]) return false
  if (m === livePenTip) return true
  livePenTip = m
  for (const f of penTipSubs) f()
  return true
}

export function readPenTipMode(): PenTipMode {
  return livePenTip
}

/** Subscribe to tip changes; returns the unsubscribe. Shaped for
 *  `useSyncExternalStore`, whose contract is exactly this pair. */
export function subscribePenTip(f: () => void): () => void {
  penTipSubs.add(f)
  return () => {
    penTipSubs.delete(f)
  }
}

/* ---- THE SHAPE, DRIVABLE — the instrument the named shapes were chosen with
 *
 * `PEN_TIP_SHAPES` is four points on a two-dimensional continuum, and picking
 * one of them by eye is the taste call this repo keeps being told off for. A
 * sweep needs to move `nose` and `taper` themselves, in ONE page session, with
 * nothing else differing between arms — the same discipline
 * `setCarveEnvelopeR` is built on, and for the same reason: an arm captured in
 * a second session is not comparable to one captured in the first.
 *
 * DEV ONLY. `readPenTipShape` short-circuits to the named shape in production,
 * so a build cannot ship a number that only ever existed inside a probe.
 * Returns false on anything that is not two finite non-negative numbers, so a
 * sweep cannot silently capture the same arm twice under two labels.
 */
let livePenTipShapeOverride: PenTipShape | null = null

export function setPenTipShapeOverride(s: PenTipShape | null): boolean {
  if (s === null) {
    livePenTipShapeOverride = null
    return true
  }
  if (!Number.isFinite(s.nose) || !Number.isFinite(s.taper)) return false
  if (s.nose < 0 || s.taper < 0) return false
  livePenTipShapeOverride = { nose: s.nose, taper: s.taper }
  return true
}

/**
 * The shape the renderer must use this frame. ONE reader, so the drawRange
 * margin and the fragment test cannot disagree about how long the nose is —
 * they did not disagree before only because the margin was a constant that
 * happened to cover every named shape.
 */
export function readPenTipShape(mode: PenTipMode): PenTipShape {
  if (process.env.NODE_ENV === "production") return PEN_TIP_SHAPES[mode]
  if (mode === "off") return PEN_TIP_SHAPES.off
  return livePenTipShapeOverride ?? PEN_TIP_SHAPES[mode]
}

export function readPenTipShapeOverride(): PenTipShape | null {
  return livePenTipShapeOverride
}

/* ---- Does this drawing actually HAVE timing character? -------------------
 *
 * Natural and Authentic are the same code path with one number changed:
 *
 *     Authentic : distance = penTimeDistanceFraction(t)
 *     Natural   : distance = penDistance + (t - penDistance) * hybridBlend
 *
 * So the ONLY thing that separates them is how far `penTimeDistanceFraction`
 * departs from the playhead itself. If the pen moved at a constant speed — a
 * stroke imported from the letter font, where every point is stamped the same
 * number of milliseconds apart, or a very even hand — then penDistance(t) == t
 * and the two settings are byte-identical renders. The control looks broken
 * because there is nothing in the input for it to express.
 *
 * This measures exactly that, using the SAME function the reveal uses, so what
 * the panel says can never drift from what the toggle does: sample the reveal
 * across its middle and take the largest gap between the pen's actual distance
 * and constant speed, as a fraction of total stroke length.
 *
 * Endpoints are skipped because both curves are pinned to 0 and 1 there.
 *
 * NOTE ON PRESSURE: `Point.pressure` is recorded by the drawing canvas and
 * carried through processing, but no reveal or geometry path reads it. Timing
 * character here means SPEED only, and the panel copy says so.
 */
export interface TimingCharacter {
  /** False when the strokes carry no usable timestamps at all. */
  usable: boolean
  /** Largest |pen distance - constant speed|, as a fraction of stroke length. */
  maxDeviation: number
  /** True when that gap is big enough for the two settings to render differently. */
  present: boolean
}

/** Below this, Natural and Authentic differ by less than a pixel on screen. */
export const TIMING_CHARACTER_THRESHOLD = 0.01

export function measureTimingCharacter(strokes: ProcessedStroke[]): TimingCharacter {
  const none = { usable: false, maxDeviation: 0, present: false }
  if (strokes.length === 0) return none
  const SAMPLES = 24
  let maxDeviation = 0
  for (let i = 1; i < SAMPLES; i++) {
    const u = i / SAMPLES
    const d = penTimeDistanceFraction(strokes, u)
    if (d === null) return none
    const dev = Math.abs(d - u)
    if (dev > maxDeviation) maxDeviation = dev
  }
  return {
    usable: true,
    maxDeviation,
    present: maxDeviation >= TIMING_CHARACTER_THRESHOLD,
  }
}

/* ==========================================================================
 * THE PEN'S OWN CLOCK — how long the recording says the word took.
 *
 * WHY IT IS HERE AND NOT DERIVED AT EACH CALL SITE. The hero beat times its
 * draw-in against a beat length in seconds and the app times it against the
 * recording; without one function that says what the recording's length IS,
 * "the draw is fast" is an opinion. With it, it is a ratio.
 * ======================================================================== */

export interface PenRecord {
  /** First and last timestamp across every stroke, in ms. */
  tStart: number
  tEnd: number
  /** `tEnd - tStart`, in SECONDS — the duration the app's own Play button runs. */
  durationSec: number
  /** Total pen travel, in stroke-coordinate units. */
  totalLength: number
  /**
   * Time the pen spent OFF the page, in seconds: the sum of the gaps between
   * one stroke's last timestamp and the next stroke's first.
   *
   * Named because it is the parameter the handwriting literature gives a
   * breaking point for. `docs/research/handwriting-variability.md` §3, quoting
   * Carmona-Duarte et al.: inter-stroke time `K_t` is 0.04 s good, **0.06 s
   * failure — "the superposition of the strokes is lost and the complete
   * movement becomes a sequence of straight, independent movements."**
   */
  airSec: number
  /** Number of strokes, i.e. separate acts of the hand. */
  strokes: number
  /** Mean pen speed while the pen is DOWN, in stroke units per second. */
  meanSpeedDown: number
}

export function measurePenRecord(strokes: ProcessedStroke[]): PenRecord | null {
  let tStart = Infinity
  let tEnd = -Infinity
  let totalLength = 0
  let downMs = 0
  let air = 0
  let prevEnd: number | null = null
  let counted = 0
  for (const s of strokes) {
    const pts = s.points
    if (pts.length === 0) continue
    counted++
    const a = pts[0].t
    const b = pts[pts.length - 1].t
    if (a < tStart) tStart = a
    if (b > tEnd) tEnd = b
    downMs += Math.max(0, b - a)
    if (prevEnd !== null) air += Math.max(0, a - prevEnd)
    prevEnd = b
    for (let i = 1; i < pts.length; i++) {
      totalLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    }
  }
  if (!Number.isFinite(tStart) || !Number.isFinite(tEnd) || tEnd <= tStart) return null
  return {
    tStart,
    tEnd,
    durationSec: (tEnd - tStart) / 1000,
    totalLength,
    airSec: air / 1000,
    strokes: counted,
    meanSpeedDown: downMs > 0 ? totalLength / (downMs / 1000) : 0,
  }
}

/* ==========================================================================
 * THE PEN CLOCK — what the trace says about WHEN, not only about where.
 *
 * Moved here out of `app/desk-doodles/page.tsx` so the probes can run the real
 * builder instead of a hand-copy of it, and so any surface that renders this
 * word gets the same recording. Nothing else changed.
 * ======================================================================== */

/**
 * THE PEN'S CLOCK — how long the trace says each stroke took.
 *
 * ⚠ THE COMMENT THAT USED TO STAND HERE IS THE DEFECT, AND IT IS LEFT QUOTED
 * BECAUSE IT NAMES IT EXACTLY:
 *
 *     "Timestamps are synthesised because the trace has none — the reveal is
 *      driven by the harness playhead, NOT BY THE RECORDED TIMING, so the exact
 *      values only need to be MONOTONIC AND EVENLY SPACED."
 *
 * That was true when the draw-in was a sweep. It stopped being true the moment
 * `penTimeDistanceFraction` made the reveal read those timestamps, and nobody
 * came back for it. Sebs: *"the whole reason I'm using the Free Stroke app was
 * for its drawing animation of strokes."* The thing that animation replays is
 * the recording, and the recording said the pen moved at exactly one speed for
 * the entire word.
 *
 * MEASURED, before this change (`scripts/verify/measure-drawin-pacing.mjs`):
 *
 *     r(stroke length, stroke duration)   0.9986   — 1.0000 is a machine
 *     timing character                     1.64 %  raw, 2.23 % after processing
 *                                                  (threshold to render at all: 1 %)
 *
 * `docs/research/handwriting-variability.md` §2, restated in
 * `lib/pen-kinematics.ts`: a lognormal's active duration
 * `T = 2 e^mu sinh(3 sigma)` "depends only on the WRITER's mu and sigma, not on
 * the amplitude — which is the model saying that a bigger stroke is executed
 * FASTER rather than for LONGER." Twelve milliseconds per point on a 4 px
 * arc-length grid says the exact opposite: every stroke at one speed, duration
 * strictly proportional to length. The research is in this repo, implemented,
 * with its provenance — and the hero word was handing the reveal a metronome.
 *
 * So the clock is the model's. `reconstructPenKinematics` already computes both
 * halves and the pipeline was throwing one away:
 *
 *   · BETWEEN strokes — `stats.durationSec`, the span of that stroke's own
 *     action plan, becomes the stroke's duration. This is the half that was
 *     discarded: `PenKinematicsSettings.retime` is documented to preserve "the
 *     stroke's own first/last timestamps exactly", so the model was allowed to
 *     say when the pen was fast INSIDE a stroke and forbidden to say that one
 *     stroke took longer than another.
 *   · WITHIN a stroke — `timeNorm`, which the retime pass then re-applies on
 *     the resampled points. Same model, same hand (`drawHandState` is memoised
 *     on its seed), so the two passes cannot disagree.
 *
 * `coarticulation: 0` here because this pass wants TIMING ONLY. The path is
 * owned by the wobble field and by `processStroke`'s own kinematic pass at its
 * shipped 0.35; moving anchors twice would be two hands on one line.
 */
const MS_PER_POINT = 12
const MS_GAP_BETWEEN_STROKES = 60

/**
 * PARKED PRIOR — the flat 12 ms/point stamp, reachable from the panel.
 *
 * Kept whole rather than replaced. It is the clock every frame of
 * `docs/verification/` before 2026-07-31 was captured under, so a diff against
 * those frames needs it to still exist, and it is the negative control for
 * every assertion about pen timing on this page: a run with `penClock:
 * "uniform"` MUST show the character collapse.
 */
export function timeStrokesUniform(polylines: { x: number; y: number }[][]): Stroke[] {
  let t = 0
  return polylines.map((pl) => {
    const points: Point[] = pl.map((p) => {
      const pt: Point = { x: p.x, y: p.y, t }
      t += MS_PER_POINT
      return pt
    })
    t += MS_GAP_BETWEEN_STROKES
    return { points }
  })
}

/** Which clock stamps the trace. See the block above. */
export type PenClock = "lognormal" | "uniform"

export interface PenClockOptions {
  /** Nib DIAMETER in the polylines' own coordinate space. The model needs it
   *  to place a typical component at the ink-flow law's neutral — see
   *  `NOMINAL_AMPLITUDE_NIBS` in lib/pen-kinematics.ts. */
  nibDiameter: number
  /** Instance seed for the ONE shared hand draw. Omitted -> the default. */
  handSeed?: number
  /**
   * Drop the accidental taps before the clock stamps them. See
   * `dropSubNibStubs`. **OFF unless a caller asks**, and the caller that must
   * not ask is `buildFontStrokes`: it publishes `FONT_LETTER_MAP.of`, which its
   * own comment says is "index-parallel to the strokes it returns", so a filter
   * there would renumber every letter with no error and flip an `i`'s dot away
   * from its stem. A trace has accidental taps. A font's tittles are authored.
   */
  dropSubNibStubs?: boolean
}

/* ==========================================================================
 * THE STUBS — nine taps the trace kept, and they are 13.6 % of the clock.
 *
 * ⚠ THIS IS THE ALMOND BLOB, and the nib cannot remove it.
 *
 * `docs/research/write-on-timing.md` §0.1, measured off this repo's own
 * builder: **9 of the 22 traced strokes are shorter than the nib is wide.**
 *
 *     nib diameter 22.6 units;  22 strokes;  total travel 3159.0
 *       #   pts      len   len/nib     dur_ms   gap_before_ms
 *       1     4      4.9      0.22        241             60  <- SHORTER THAN THE NIB
 *      21     4      5.2      0.23        241             60  <- SHORTER THAN THE NIB
 *
 *     They carry 64.3 of 3159.0 units = 2.03 % of the pen travel,
 *     and 2289 ms of the record.
 *
 * Four points, five units of travel, and a nib 22.6 units across: geometrically
 * that is a capsule a fifth as long as it is wide, i.e. a dot. *"A person
 * tracing over an image taps the surface by accident; the trace kept every
 * tap."* And they are not cheap: `timeStrokesByPenModel` gives every stroke at
 * least one full lognormal submovement, one submovement is 241.1 ms, so a
 * 4.9-unit stub is allotted the time a 200-unit stroke would need. Eight of the
 * nine strokes that share 241.1 ms exactly ARE the stubs, and identical
 * durations are the regularity tell the sibling research doc names as the
 * failure.
 *
 * N6 confirmed no pen can fix this from the geometry side: *"a nib stamps its
 * own footprint on a path shorter than itself; it cannot remove one."* Landing
 * the broad nib moved the entry blob from one fused lozenge to two angled ticks
 * and took it from 4275 to 4152 px — still one connected component, still a
 * mark appearing whole, in clear air, between two letters.
 *
 * ── WHAT "DROP" MEANS HERE, AND IT IS BOTH HALVES ─────────────────────────
 *
 * The stroke VANISHES: no ink, no duration, and no pen-lift gap of its own. The
 * record gets SHORTER by exactly what the stubs were costing. The alternative —
 * keep the record's length and redistribute the 2 289 ms onto the surviving
 * strokes — was rejected: R1's item 1 is *"removes 2,289 ms of DEAD clock"*, and
 * handing that time to the real strokes would slow the pen down to preserve a
 * duration that only ever existed because of the taps.
 *
 * ⚠ IT DOES NOT CLOSE THE MOVEMENT-TIME GATE, and R1 checked rather than
 * assuming: stroke 15 is a real 173.6-unit stroke that also runs at 241.1 ms, so
 * it survives this filter and still renders at 66.9 ms under the hero's 3.60×
 * compression, against the literature's 100 ms floor. That is F31, it is a
 * separate decision about the beat's length, and *"do not close the gate by
 * deleting its subject."*
 *
 * ── THE THRESHOLD IS DERIVED, AND IT IS NOT 22.6 ──────────────────────────
 *
 * One nib DIAMETER, read off `opts.nibDiameter` — the same
 * `computeSolidEffectiveThicknessPx(thickness)` the caller already has to pass
 * for the kinematics. Write the number down and it is wrong the moment the
 * weight dial moves.
 *
 * ⚠ AND IT IS DELIBERATELY THE ROUND PEN'S DIAMETER, NOT THE NIB'S EXTENT ALONG
 * TRAVEL. The broad nib is anisotropic — its extent runs 0.745 R to 1.342 R with
 * direction at aspect 1.8 — so a "correct" per-stroke threshold would make the
 * word's STROKE INVENTORY depend on a geometry dial, and differently in each of
 * the four modes and two engine families, only one of which has a nib at all.
 * One word, one list. The margin says the precision is not needed anyway:
 * measured on this trace the longest stub is **0.69 nib** and the shortest
 * surviving stroke is **3.04 nib**, so every threshold in [0.70, 3.03] drops the
 * same nine, and the whole anisotropic range 0.745–1.342 sits inside it.
 *
 * ⚠ AND IT RUNS ON THE RAW POLYLINES, WHICH IS WHY IT LIVES HERE. `processStroke`
 * with the hero's `endpoint: "protrude"` runs every stroke PAST its own ends:
 * measured, the 4.9-unit stub arrives at the geometry as a 46.7-unit stroke, two
 * nib diameters long. By the time anything downstream can see it, it no longer
 * looks like a tap.
 * ======================================================================== */

/** Arc length of a polyline, in its own coordinate space. */
function polylineLength(pl: { x: number; y: number }[]): number {
  let d = 0
  for (let i = 1; i < pl.length; i++) d += Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y)
  return d
}

/**
 * WHAT THE FILTER WOULD DO, WITHOUT DOING IT — so a gate can assert on the
 * MARGIN rather than on the count. A threshold whose two neighbours are 0.69 and
 * 3.04 is a different claim from one sitting on top of a cluster, and only the
 * margin can tell them apart.
 */
export function subNibStubCensus(
  polylines: { x: number; y: number }[][],
  nibDiameter: number,
): {
  keptIdx: number[]
  droppedIdx: number[]
  lenNibs: number[]
  /** Longest dropped stroke, in nib diameters. */
  longestDropped: number
  /** Shortest surviving stroke, in nib diameters. */
  shortestKept: number
  /** Travel dropped, as a fraction of the whole. */
  travelFrac: number
} {
  const lens = polylines.map(polylineLength)
  const total = lens.reduce((a, b) => a + b, 0)
  const lenNibs = lens.map((l) => (nibDiameter > 0 ? l / nibDiameter : Infinity))
  const keptIdx: number[] = []
  const droppedIdx: number[] = []
  lenNibs.forEach((n, i) => (n < 1 ? droppedIdx : keptIdx).push(i))
  return {
    keptIdx,
    droppedIdx,
    lenNibs,
    longestDropped: droppedIdx.length ? Math.max(...droppedIdx.map((i) => lenNibs[i])) : 0,
    shortestKept: keptIdx.length ? Math.min(...keptIdx.map((i) => lenNibs[i])) : Infinity,
    travelFrac: total > 0 ? droppedIdx.reduce((a, i) => a + lens[i], 0) / total : 0,
  }
}

/**
 * Drop every polyline shorter than one nib diameter. See the block above.
 *
 * A non-positive `nibDiameter` returns the input untouched rather than dropping
 * everything: an unset dial must not be able to delete the word.
 */
export function dropSubNibStubs(
  polylines: { x: number; y: number }[][],
  nibDiameter: number,
): { x: number; y: number }[][] {
  if (!(nibDiameter > 0)) return polylines
  return polylines.filter((pl) => polylineLength(pl) >= nibDiameter)
}

export function timeStrokesByPenModel(
  polylines: { x: number; y: number }[][],
  opts: PenClockOptions,
): Stroke[] {
  // ONE draw for the whole word — research doc §1, the single biggest finding:
  // "R_D, R_t0, R_mu, R_sigma […] are fixed for all strokes across a component."
  // `drawHandState` is memoised on its seed inside stroke-processing, so this is
  // literally the same hand the retime pass uses.
  const hand = drawHandState(opts.handSeed)
  const lifts = humanLiftsMs(polylines, opts.nibDiameter).ms
  let t = 0
  return polylines.map((pl, si) => {
    const pts = pl.map((p) => [p.x, p.y] as [number, number])
    const res =
      pts.length >= 3
        ? reconstructPenKinematics(pts, {
            hand,
            nibDiameter: opts.nibDiameter,
            coarticulation: 0,
            inkModulation: 0,
          })
        : null
    // A stroke the model cannot describe keeps the prior clock rather than
    // being given an invented one — the same rule `kinematicsPass` follows
    // ("Never substitutes a default, because a stroke this model cannot
    // describe must not be damaged by it").
    const durMs = res ? res.stats.durationSec * 1000 : Math.max(1, pl.length) * MS_PER_POINT
    const points: Point[] = pl.map((p, i) => ({
      x: p.x,
      y: p.y,
      t: t + (res ? res.timeNorm[i] : pl.length > 1 ? i / (pl.length - 1) : 0) * durMs,
    }))
    t += durMs + (lifts[si] ?? 0)
    return { points }
  })
}

/* ==========================================================================
 * THE LIFTS — three tiers, not one constant. Night C, 2026-09-25.
 *
 * `MS_GAP_BETWEEN_STROKES = 60` was every lift in the word, eleven times the
 * same number (RUN-QUEUE F29). `docs/research/write-on-timing.md` §2.4 gives the
 * bands, taken from Kandel et al. 2008 and Prunty et al. 2014: 90-150 ms inside
 * a letter (the k's stem to its arm), 150-300 ms between letters, 300-600 ms
 * between words. Where a lift sits inside its band is the TRAVEL across it: a
 * pen going one nib sits at the bottom, one going 8 nibs or more at the top. So
 * the lifts differ because the gaps differ, and nothing random is drawn.
 *
 * The letters come from `assignLetters`, the map the hero cascade already uses,
 * and the word space from `letterGapAfter`. When that finds no word gap (a
 * block of more than one line, or no gap that clears the median) every
 * between-letter lift stays in the letter band rather than guessing a word.
 *
 * These are the RECORD's lifts. The hero plays the record squeezed into its
 * 4.667 s draw beat, so what shows on screen is each one divided by the squeeze
 * (about 3.3x on the traced word). `timeStrokesUniform`, the parked prior, keeps
 * the flat 60 ms: it is the negative control and must not change.
 * ======================================================================== */
export const LIFT_BANDS_MS = {
  withinLetter: [90, 150],
  betweenLetters: [150, 300],
  betweenWords: [300, 600],
} as const
export type LiftTier = keyof typeof LIFT_BANDS_MS
/** Travel, in nib diameters, at which a lift reaches the top of its band. */
export const LIFT_TRAVEL_NIBS_AT_TOP = 8

/** One entry per gap: `ms[k]` is the lift after polyline `k`. */
export function humanLiftsMs(
  polylines: { x: number; y: number }[][],
  nibDiameter: number,
): { ms: number[]; tier: LiftTier[]; travel: number[] } {
  const n = polylines.length
  if (n < 2) return { ms: [], tier: [], travel: [] }
  const strokes = polylines.map((points) => ({ points }))
  const map = assignLetters(strokes, nibDiameter)
  const wordAfter = letterGapAfter(strokes, map)
  const ms: number[] = []
  const tier: LiftTier[] = []
  const travel: number[] = []
  for (let k = 0; k < n - 1; k++) {
    const a = polylines[k][polylines[k].length - 1]
    const b = polylines[k + 1][0]
    const d = a && b ? Math.hypot(b.x - a.x, b.y - a.y) : 0
    const la = map.of[k]
    const lb = map.of[k + 1]
    const tr: LiftTier =
      la === lb
        ? "withinLetter"
        : wordAfter >= 0 && Math.min(la, lb) <= wordAfter && Math.max(la, lb) > wordAfter
          ? "betweenWords"
          : "betweenLetters"
    const [lo, hi] = LIFT_BANDS_MS[tr]
    const f = nibDiameter > 0 ? Math.min(1, d / (LIFT_TRAVEL_NIBS_AT_TOP * nibDiameter)) : 0
    ms.push(lo + (hi - lo) * f)
    tier.push(tr)
    travel.push(d)
  }
  return { ms, tier, travel }
}


/**
 * Stamp a set of polylines with one of the two clocks.
 *
 * The ONE entry point, so a caller cannot accidentally take the parked prior by
 * calling the wrong function name.
 */
export function stampPenClock(
  polylines: { x: number; y: number }[][],
  clock: PenClock,
  opts: PenClockOptions,
): Stroke[] {
  /* BEFORE EITHER CLOCK, so the parked `uniform` prior draws the same WORD and
   * stays a control on TIMING rather than on the stroke list too. */
  const pl = opts.dropSubNibStubs ? dropSubNibStubs(polylines, opts.nibDiameter) : polylines
  return clock === "uniform" ? timeStrokesUniform(pl) : timeStrokesByPenModel(pl, opts)
}
