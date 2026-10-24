"use client"

/* ==========================================================================
 * TAKE TIMELINE. A picture of WHEN each part of your drawing draws.
 *
 * `docs/animation-toolset-map.md` §3 item 11, verbatim: *"There is no visual
 * representation of WHEN anything happens to your drawing. The one timeline in
 * the product shows the hero film's phases, on a route your drawing never
 * reaches."* Re-measured 2026-09-04, before this file existed: `/` had 0
 * time-axis ticks and 0 track rows; `/desk-doodles` had 7 axis ticks, 10 named
 * tracks and 23 clip bars, and no drawing surface at all.
 *
 * ── IT IS A VIEW. IT IS NOT THE AUTHORING MODEL ───────────────────────────
 *
 * ⚠ SUPERSEDED ON `/`, 2026-09-25. The ruling in
 * `docs/rulings/2026-09-25-animation-comes-back.md` voids this call: he asked
 * for a stroke timeline he drags. Where a host provides the take, the default
 * export below renders `components/stroke-strip.tsx` instead, and there the
 * bars are controls and look like them. The view below, and the reasoning
 * that follows, holds for hosts with no take.
 *
 * Map §9 pick 3, his call: *"yes, but as a view of the stack, not as the
 * authoring model, the modifiers stay the source of truth and the dock draws
 * what they produce."* So there is no drag, no drop, no resize, no selection
 * and no click. The Timing popover's `DRAW IN` and `WINDOW` dials stay the only
 * way to change a take; this strip is what those dials PRODUCE. Dragging a bar
 * is that pick's named cost and is not spent here.
 *
 * Explainer 06 §3's rule cuts both ways on a read-only surface: a control that
 * cannot act is a defect, so nothing here may LOOK like a control. That is why
 * the bars are square. The shell's radii carry meaning. `rounded-full` is
 * "pick one of a set", `rounded-md` is "a switch", `rounded-lg` is "a surface"
 * and a bar with a 6px radius would be claiming to be a switch. A square end
 * is also what a broad nib leaves, which is what these bars are pictures of.
 *
 * ── AND IT DOES NOT EXIST WHEN IT WOULD HAVE NOTHING TO SAY ───────────────
 *
 * Map §8: *"a timeline with nothing to show is a worse product than no
 * timeline."* The mount sits inside the transport's own `strokeCount > 0 &&
 * !chromeless` guard, so an empty page has no strip and a host that drives its
 * own clock has no strip. There is no empty state here because there is no
 * empty strip. The authored empty state is already the two squiggles, and a
 * third one on the same screen would break `ViewportEmptyState`'s own rule,
 * *"one screen, one voice."*
 *
 * ── THE AXIS IS WALL TIME, AND THAT COSTS ONE INVERSION ───────────────────
 *
 * `schedule.tracks` gives every stroke a slot `[start, end]`, and that slot
 * lives in the space the renderer compares against: `revealDistanceFraction`'s
 * output, i.e. how far the pen has TRAVELLED. Travel is not time. The whole
 * argument for this product is that the pen's own hesitations were recorded, so
 * a strip drawn in travel would flatten the one thing nobody else has.
 *
 * So every edge is carried back through two maps:
 *
 *   travel  --(invert revealDistanceFraction)-->  playhead  --(unEase)-->  clock
 *
 * `clock` is linear in seconds. That makes the strip's width honest, the
 * quarter ticks honest, and the gaps between bars the pen's real AIR TIME
 * rather than a drawing artefact. A stroke your hand dawdled through is a WIDE
 * bar even if it laid down very little ink. That is the picture, and it is only
 * available to a tool that recorded the performance.
 *
 * The inversion is a 129-sample table over the SHIPPED function. `lib/pen-reveal.ts`
 * is imported and called, not copied, and memoised on `[strokes, mode, blend]`. It
 * runs when the drawing or the pace changes and never per frame.
 *
 * ⚠ COST, IN THE SHAPE §6.4 DEMANDS. 129 calls x O(points), once per change. No
 * geometry is built, no buffer is rebuilt, no shader is touched. §6.4's law,
 * *"anything the animation system does must be expressible as an attribute, a
 * uniform, or a reorder of an existing buffer"*, is not engaged at all, because
 * nothing here reaches the renderer.
 *
 * ── THE INK ON THE STRIP IS THE INK ON THE PAGE ───────────────────────────
 *
 * A bar is not filled "from the left up to the playhead". It is inked exactly
 * where its slot intersects `windowAt(revealWindow, playhead)`, the same
 * interval the renderer cuts with. One law, four modes:
 *
 *   Grow    `[0, d]`          ink grows from the left. The shipped default.
 *   Travel  a segment         a lit band runs across the strip.
 *   Vanish  `[d, 1]`          the strip empties from the left.
 *   Shrink  `[0, 1-d]`        the strip empties from the right.
 *
 * Filling from the left under `Vanish` would have shown a strip filling while
 * the mark on screen was emptying. That is the lie this costs one prop to avoid.
 *
 * Explainer 26 §7.1 is why the window is read ONCE for the whole strip rather
 * than per row: *"The interval lives in the beat's space, not per stroke… A
 * per-unit window would have been a second scheduling model beside the first."*
 *
 * ── ROWS ARE THE DRAWING'S OWN ORDER. BARS MOVE ───────────────────────────
 *
 * Row `k` is always the `k`-th unit your hand made. The bar inside it moves to
 * wherever the schedule put it. That is what makes the `Order` dial legible: at
 * `As drawn` the bars fall as a staircase down and to the right, at `Reversed`
 * the same staircase runs the other diagonal, and at `Random` it scatters.
 * Sorting the ROWS by lay-down order instead would have drawn the identical
 * descending staircase for all five orders. A picture that cannot show what
 * the dial did.
 *
 * ── THE UNIT IS THE PANEL'S UNIT ──────────────────────────────────────────
 *
 * Map §9 pick 2: *"group by default, stroke on request."* One row per unit, one
 * bar per stroke inside it. `drawIn.unit` decides which, and this strip does not
 * offer its own switch, because a second place to set one thing is how a control
 * stops meaning what its label says.
 *
 * ⚠ ONE DELIBERATE DIVERGENCE FROM `Scene`'S SCHEDULE, STATED RATHER THAN LEFT
 * TO BE FOUND. `Scene` skips the grouping entirely at the shipped default,
 * because `asDrawn` + `overlap 0` takes every stroke's own recorded span and a
 * grouping cannot change what the recording was, so its `unitCount` is the
 * STROKE count there. This strip always passes the grouping when the panel says
 * `Groups`, so its row count matches the number the panel prints. **Every
 * track's `start` and `end` is identical either way**; only the `unit` field
 * differs. `scripts/verify/assert-take-timeline.mjs` measures the bar geometry
 * against `window.__fsSchedule.tracks`, so the two cannot quietly disagree
 * about where a bar goes.
 *
 * ── WHAT A ROW'S LABEL IS ALLOWED TO CLAIM ────────────────────────────────
 *
 * Explainer 26 §3 names the one label trap in this whole feature: *"under a
 * non-identity schedule the hand's pacing stays attached to the BEAT, not to
 * the stroke. A reordered stroke draws at the pace the beat is at, not at its
 * own recorded pace."* So a bar's width is NOT that stroke's recorded duration
 * and the title must never say it is. It says *"draws from 0.8s to 1.2s"*,
 * when it appears on screen, which is true under every schedule.
 *
 * ── THE ARGUMENT AGAINST WHAT IS HERE ─────────────────────────────────────
 *
 * · **`Direction` does not show.** A reversed unit occupies the same slot; the
 *   flip decides which END of its ink draws first, not when the slot is busy.
 *   `ScheduleTrack.reverse` says so itself: *"`start < end` STILL, ALWAYS."* So
 *   the strip is silent about the one dial it cannot picture, and the hover
 *   title is the only place it shows. That is a real hole in "see the timing"
 *   and the fix is a mark on the ink, not a mark on the strip.
 * · **No row labels.** At 8 groups a number per row would fit; at 22 strokes it
 *   would not, and a label that vanishes at a threshold is worse than no label.
 *   So a row tells you WHEN a unit draws and not WHICH letter it is. The hover
 *   title is a thin patch on that.
 * · **The as-drawn span is not drawn.** Every track carries `from`/`to` as well
 *   as `start`/`end`, so a ghost bar could show how far the schedule MOVED each
 *   unit. Two bars per row is clutter for a fact you can get by flipping the
 *   Order dial back, so it is cut, and named here so it is not re-proposed as
 *   an oversight.
 * · **`Delay` is not on the axis.** The strip is the beat; a lead-in of blank
 *   page is the Timing panel's own dial and it prints its own seconds. Two
 *   places showing one delay is the mislabel class `DISPATCH.md` §2.7 rules on.
 * ======================================================================== */

import { useMemo } from "react"
import type { ProcessedStroke } from "@/lib/stroke-processing"
import {
  scheduleFromStrokes,
  windowAt,
  windowParts,
  type DrawInParams,
  type RevealEase,
  type RevealWindowParams,
  type ScheduleTrack,
} from "@/lib/stroke-schedule"
import { revealDistanceFraction, liftsLandBetweenStrokes, type RevealMode } from "@/lib/pen-reveal"
import { assignLetters } from "@/lib/hero-letters"
import { computeSolidEffectiveThicknessPx } from "@/lib/geometry-engines"
import { StrokeStrip, useStrokeTake } from "@/components/stroke-strip"

/** Samples in the travel->playhead inverse. 128 intervals over a monotone
 *  curve; the residual is interpolated, not snapped. */
const SAMPLES = 128

/** The band never grows past this. Beyond it the rows thin, then it scrolls. */
const BAND_MAX_PX = 96

/** Row pitches, largest first. The first one that fits the whole drawing inside
 *  `BAND_MAX_PX` wins, so a four-stroke doodle gets fat rows and a forty-stroke
 *  word gets a dense staircase, and every row inside one strip is identical,
 *  which is the only spacing rule a repeating list has.
 *
 *  ⚠ 8 IS THE CEILING AND IT WAS MEASURED, NOT PICKED. The first build capped
 *  at 12, giving 8px bars, and four of them read as the heaviest thing on the
 *  screen, heavier than the transport's own filled pills, which is where this
 *  shell already spends its one piece of boldness. `/desk-doodles`' phase ruler
 *  is 3px for the same job. 8 gives a 5px bar, which is legible at four rows and
 *  still quieter than the pills. */
const PITCHES = [8, 6, 4, 3, 2] as const

export interface TakeTimelineProps {
  strokes: ProcessedStroke[]
  drawIn: DrawInParams
  revealWindow: RevealWindowParams
  /** F118: the viewport's opening-pass flag, read at render. A seamless Travel
   *  past its opening pass holds two intervals, the head and the wrapping tail. */
  openingRef?: { readonly current: boolean }
  /** The nib the ink is sized from, so the grouping matches the panel's count. */
  inkThickness: number
  /** `revealMode`, which pace law the beat runs on. */
  mode: RevealMode
  hybridBlend: number
  /** The transport's live 0..1 playhead. */
  playhead: number
  ease: RevealEase
  /** `unEaseReveal`, handed in rather than imported, because importing it from
   *  `components/viewport-3d.tsx`, the file that renders this one, is a
   *  cycle. That is the only reason this prop exists. */
  unEase: (playhead: number, ease: RevealEase) => number
  /** Milliseconds the beat runs for. The right edge of the strip. */
  totalDurationMs: number
}

/** One stroke's slot, in clock space. */
interface Bar {
  stroke: number
  a: number
  b: number
  /** Travel space, kept so the window can be intersected at render time. */
  ta: number
  tb: number
  reverse: boolean
}

interface Row {
  unit: number
  bars: Bar[]
  a: number
  b: number
  reverse: boolean
}

/**
 * The travel->playhead inverse, as a table.
 *
 * `revealDistanceFraction` is monotone non-decreasing and FLAT wherever the pen
 * was in the air, so the inverse is only well defined as *the earliest playhead
 * at which travel reaches x*. That is also the answer the picture wants: a bar
 * begins the instant its ink starts moving, and the flat stretch before it is
 * the air time, drawn as the gap it is.
 */
function buildInverse(
  strokes: ProcessedStroke[],
  mode: RevealMode,
  blend: number,
  liftHolds: boolean,
): Float64Array {
  const table = new Float64Array(SAMPLES + 1)
  let run = 0
  for (let i = 0; i <= SAMPLES; i++) {
    const d = revealDistanceFraction(strokes, i / SAMPLES, mode, blend, liftHolds)
    // A running max rather than trust: a table that dipped would make the search
    // below return a playhead the renderer never passes through.
    run = d > run ? d : run
    table[i] = run
  }
  table[SAMPLES] = 1
  return table
}

/** Earliest playhead whose travel has reached `x`. */
function playheadAtTravel(table: Float64Array, x: number): number {
  if (!(x > 0)) return 0
  if (x >= 1) return 1
  let lo = 0
  let hi = SAMPLES
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (table[mid] >= x) hi = mid
    else lo = mid + 1
  }
  if (lo === 0) return 0
  const d0 = table[lo - 1]
  const d1 = table[lo]
  const span = d1 - d0
  const f = span > 1e-12 ? (x - d0) / span : 0
  return (lo - 1 + f) / SAMPLES
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * ANIM-1B: where a host provides the take (`/` does, through
 * `StrokeTakeProvider`), the strip is the editable one in
 * `components/stroke-strip.tsx`, one bar per stroke. Anywhere else it stays
 * the read-only view below. The viewport mounts this and never knows which.
 */
export default function TakeTimeline(props: TakeTimelineProps) {
  const ctx = useStrokeTake()
  if (ctx) return <StrokeStrip {...props} ctx={ctx} />
  return <TakeTimelineView {...props} />
}

function TakeTimelineView({
  strokes,
  drawIn,
  revealWindow,
  openingRef,
  inkThickness,
  mode,
  hybridBlend,
  playhead,
  ease,
  unEase,
  totalDurationMs,
}: TakeTimelineProps) {
  /* The grouping the panel's own count is printed from. Skipped in stroke mode,
   * where `buildStrokeSchedule` numbers one unit per stroke anyway. */
  const unitOf = useMemo(() => {
    if (drawIn.unit === "stroke" || strokes.length === 0) return null
    return assignLetters(strokes, computeSolidEffectiveThicknessPx(inkThickness)).of
  }, [strokes, drawIn.unit, inkThickness])

  const schedule = useMemo(
    () => scheduleFromStrokes(strokes, unitOf, drawIn),
    [strokes, unitOf, drawIn],
  )

  // The same lift gate the viewport asks, so a bar starts where the renderer's ink does.
  const liftHolds = liftsLandBetweenStrokes(schedule, revealWindow.mode)
  const inverse = useMemo(
    () => buildInverse(strokes, mode, hybridBlend, liftHolds),
    [strokes, mode, hybridBlend, liftHolds],
  )

  /** travel -> clock. The one conversion in this file, used for slots and edges
   *  alike so a bar and the edge crossing it can never be measured differently. */
  const toClock = useMemo(() => {
    return (travel: number) => clamp01(unEase(playheadAtTravel(inverse, travel), ease))
  }, [inverse, unEase, ease])

  /* Every slot, carried travel -> playhead -> clock and bucketed into rows by
   * unit. Recomputed when the schedule, the pace or the ease changes. The
   * window moves every frame; none of this does. */
  const rows = useMemo<Row[]>(() => {
    const byUnit = new Map<number, Bar[]>()
    for (const t of schedule.tracks as ScheduleTrack[]) {
      const bar: Bar = {
        stroke: t.stroke,
        a: toClock(t.start),
        b: toClock(t.end),
        ta: t.start,
        tb: t.end,
        reverse: t.reverse,
      }
      const list = byUnit.get(t.unit)
      if (list) list.push(bar)
      else byUnit.set(t.unit, [bar])
    }
    return [...byUnit.entries()]
      .sort((x, y) => x[0] - y[0])
      .map(([unit, bars]) => ({
        unit,
        bars,
        a: Math.min(...bars.map((b) => b.a)),
        b: Math.max(...bars.map((b) => b.b)),
        reverse: bars.some((b) => b.reverse),
      }))
  }, [schedule, toClock])

  if (rows.length === 0) return null

  const n = rows.length
  const pitch = PITCHES.find((p) => n * p <= BAND_MAX_PX) ?? PITCHES[PITCHES.length - 1]
  const gap = Math.max(1, Math.round(pitch / 3))
  const barH = pitch - gap
  const full = n * pitch
  const bandH = Math.min(BAND_MAX_PX, full)
  const scrolls = full > BAND_MAX_PX

  /* THE INTERVAL THE RENDERER IS CUTTING WITH, read once for the whole strip.
   * `playhead` is already eased; `windowAt` takes it in that space, the same as
   * every render path. */
  const win = windowAt(revealWindow, clamp01(playhead), openingRef?.current === true)
  /* One part, or two while a seamless Travel wraps: the head `[0, h]` and the
   * tail `[1 + h - L, 1]`. Reading `lo`/`hi` alone drew the head and dropped the
   * tail, the defect `windowParts` exists to prevent. */
  const parts = windowParts(win)

  const seconds = totalDurationMs > 0 ? totalDurationMs / 1000 : 0
  const noun = drawIn.unit === "stroke" ? "stroke" : "group"
  const Noun = drawIn.unit === "stroke" ? "Stroke" : "Group"
  const title = `When each ${noun} draws`
  const secondsAt = (c: number) => (c * seconds).toFixed(1)

  /* The moving edges. `lo` only exists once something has started un-drawing,
   * and neither is drawn when it is sitting on the strip's own edge. A
   * hairline on top of a border is a hairline that says nothing. */
  const edges: { key: string; at: number }[] = []
  parts.forEach(([a, b], pi) => {
    const aC = toClock(a)
    const bC = toClock(b)
    const tag = pi === 0 ? "" : `-${pi}`
    if (aC > 0.001 && aC < 0.999) edges.push({ key: `lo${tag}`, at: aC })
    if (bC > 0.001 && bC < 0.999) edges.push({ key: `hi${tag}`, at: bC })
  })

  return (
    <div
      data-take-timeline
      data-take-clock={clamp01(playhead).toFixed(6)}
      className="shrink-0 border-b border-border/60 px-3 pb-2 pt-1.5"
    >
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-medium text-foreground">{title}</span>
        {/* ⚠ "total" IS LOAD-BEARING. The transport prints an ELAPSED `1.1s` in
            the same face, the same size and forty pixels below this. Two bare
            second-figures that close together, meaning different things, is the
            mislabel `DISPATCH.md` §2.7 rules on: a readout whose label does not
            describe what it reports is a defect. This is also the only place in
            the product that prints the beat's whole length. */}
        <span className="font-mono text-[9px] leading-none tabular-nums text-muted-foreground">
          {seconds > 0 ? `${seconds.toFixed(1)}s total` : "no timing"}
        </span>
      </div>

      <div
        role="img"
        aria-label={`${title}. ${n} ${noun}${n === 1 ? "" : "s"}${
          seconds > 0 ? ` over ${seconds.toFixed(1)} seconds` : ""
        }.`}
        /* A scroll region a keyboard cannot reach is a scroll region only a
         * mouse owns. It only appears past 48 units, and only then is it
         * focusable. A tab stop on a strip that fits would be a stop with
         * nothing to do. */
        tabIndex={scrolls ? 0 : undefined}
        className={`relative ${scrolls ? "overflow-y-auto" : ""}`}
        style={{ height: `${bandH}px` }}
      >
        {/* THE SCALE. Three hairlines at the quarters, unlabelled. The right
            edge carries the beat's only number, and the transport's own clock
            sits forty pixels below, so a fourth and fifth figure here would be
            competing with both. */}
        {[0.25, 0.5, 0.75].map((q) => (
          <div
            key={q}
            data-take-tick={q}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-border"
            style={{ left: `${q * 100}%` }}
          />
        ))}

        {rows.map((r) => (
          <div
            key={r.unit}
            data-take-row={r.unit}
            title={`${Noun} ${r.unit + 1} draws from ${secondsAt(r.a)}s to ${secondsAt(r.b)}s${
              r.reverse ? ", from its far end back" : ""
            }`}
            className="relative w-full"
            style={{ height: `${pitch}px` }}
          >
            {r.bars.map((b) => {
              const span = b.b - b.a
              /* WHERE THIS SLOT IS INKED. Its own interval, cut by the beat's.
                 Measured in TRAVEL, where both intervals are defined, then
                 carried to the clock the strip is drawn on. */
              const inks = parts
                .map(([wa, wb]) => [Math.max(b.ta, wa), Math.min(b.tb, wb)] as const)
                .filter(([ia, ib]) => ib > ia)
                .map(([ia, ib]) => [toClock(ia), toClock(ib)] as const)
              return (
                <div
                  key={b.stroke}
                  data-take-bar={b.stroke}
                  data-start={b.a.toFixed(6)}
                  data-end={b.b.toFixed(6)}
                  data-reverse={b.reverse ? "1" : "0"}
                  /* A stroke shorter than the pen is wide is a real thing here
                     and STATUS.md counts nine of them in his traced word, so a
                     slot with no width still gets a mark rather than vanishing. */
                  className="absolute bg-foreground/20"
                  style={{
                    left: `${b.a * 100}%`,
                    width: `${span * 100}%`,
                    minWidth: "1px",
                    top: `${gap / 2}px`,
                    height: `${barH}px`,
                  }}
                >
                  {inks.map(([ka, kb], k) => (
                    /* THE INK. Full strength against a fifth-strength ghost, so
                       the boundary between drawn and not-yet is a step and not a
                       fade. No transition: this is where the renderer is on this
                       frame, not something easing towards it. */
                    <div
                      key={k}
                      data-take-ink
                      className="absolute top-0 bottom-0 bg-foreground"
                      style={{
                        left: span > 1e-9 ? `${((ka - b.a) / span) * 100}%` : 0,
                        width: span > 1e-9 ? `${((kb - ka) / span) * 100}%` : "100%",
                        minWidth: "1px",
                      }}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        ))}

        {/* WHERE THE INK'S EDGE IS. Under Grow that is the pen. Under Travel
            there are two of them and the band between is what is on the page.
            Under Vanish and Shrink it is the edge the mark is retreating from.
            One rule, four modes, always pointing at the thing that is moving. */}
        {edges.map((e) => (
          <div
            key={e.key}
            data-take-edge={e.key}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 bottom-0 w-px bg-foreground"
            style={{ left: `${e.at * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}
