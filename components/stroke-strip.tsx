"use client"

/* ==========================================================================
 * THE STROKE STRIP. One bar per stroke, and you drag them (ANIM-1B).
 *
 * His words, 2026-09-25: "keyframing, editing any of the motion of the strokes
 * ... as if you were someone in control of the pen through a motion tool", and
 * the tools before this were "a couple buttons to click and no custom". The
 * ruling (`docs/rulings/2026-09-25-animation-comes-back.md`) voids the old
 * "the strip is a view" call, so on `/` the take timeline becomes this.
 *
 * The reference is Jitter: one rounded bar per stroke, drag the body to delay
 * it, drag an end to change its speed, the selected bar filled with a grip at
 * each end, and every other bar stays put. Final Cut's word for "the later ones
 * slide along" is Ripple, so that is the toggle's name. Off by default.
 *
 * ── ONE TAKE, NO SECOND MODEL ────────────────────────────────────────────
 *
 * Nothing here stores timing. A drag writes the page's `take` through
 * `commit`, which is `edit()` in `app/page.tsx`, the same path `__fsTake.set`
 * and every other control uses, so ⌘Z reaches it. The bars are laid out by
 * `buildTimedSchedule`, the function the viewport's Scene runs, with the same
 * pace and the same `baseMs`. The gate holds the strip's slots to
 * `__fsTake.get().slots`, so the two builds cannot drift apart quietly.
 *
 * A drag is ONE undo step: every bar carries `data-stroke-drag`, which the
 * page's window-level gesture bracket treats like a slider, and every move in
 * one drag commits under the same key.
 *
 * ── WHAT A DRAG MEANS ────────────────────────────────────────────────────
 *
 *   body   shifts the slot:        delayMs += the time under the pointer
 *   end    moves t1, t0 fixed:     speed = base length / new length
 *   start  moves t0, t1 fixed:     speed and delayMs both, so t1 stays
 *
 * The axis is frozen for the length of a drag. Dragging the last bar right
 * makes the take longer, and an axis that rescaled under the pointer would
 * move the bar away from the hand holding it.
 *
 * A click selects and writes nothing. A page nobody dragged on has an empty
 * take, and an empty take draws the shipped path (ANIM-1A6).
 * ======================================================================== */

import { createContext, useContext, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import type { ProcessedStroke } from "@/lib/stroke-processing"
import { KEY_PROPERTIES, keysEndMs, revealClockMs, validateKeys, type TakeKeys } from "@/lib/keyframes"
import { KeyLanes, KEY_GUTTER_PX } from "@/components/key-lanes"
import type { GeometryMode } from "@/lib/geometry-engines"
import {
  scheduleFromStrokes,
  windowAt,
  windowParts,
  type DrawInParams,
  type RevealEase,
  type RevealWindowParams,
} from "@/lib/stroke-schedule"
import { revealDistanceFraction, liftsLandBetweenStrokes, type RevealMode } from "@/lib/pen-reveal"
import { assignLetters } from "@/lib/hero-letters"
import { PerformTake } from "@/components/perform-take"
import { computeSolidEffectiveThicknessPx } from "@/lib/geometry-engines"
import {
  buildTimedSchedule,
  easeReveal,
  isTimedTake,
  paceFromCurve,
  rowOf,
  withRow,
  type StrokeTiming,
  type StrokeTimingTake,
} from "@/lib/stroke-timing"

/* ──────────────────────────────────────────────────────────────────────────
 * THE CONTEXT. `app/page.tsx` provides it; the strip and the stroke block in
 * `draw-in-timing-controls.tsx` read it. Absent, both fall back to what they
 * were before this lane: the read-only view, and no stroke block.
 * ────────────────────────────────────────────────────────────────────────── */

export interface StrokeTakeContextValue {
  take: StrokeTimingTake
  /** `key` names the gesture, so one drag or one run of nudges is one ⌘Z. */
  commit: (next: StrokeTimingTake, key: string | null) => void
  /** The doc's keys beside the take. Absent means no keys, the shipped motion. */
  keys?: TakeKeys
  /** One call is one undo step, or one per gesture `key` like `commit`. Returns the reasons it refused, empty when committed. */
  setKeys?: (next: TakeKeys | undefined, key: string | null) => string[]
  mode: GeometryMode
  /** The pen's own length, `penMsOf(rawStrokes)`. */
  penMs: number
  strokeCount: number
  selected: number | null
  select: (i: number | null) => void
  /** The strip's slots in ms, written on every render of the strip, so the
   *  stroke block can clamp a typed delay at t0 = 0 exactly. */
  slotsRef: { current: Float64Array | null }
  /** ANIM-3B · what the view shows this frame, written by the viewport's
   *  `KeyLive` every frame and read by the key lanes when "+" adds a key. Null
   *  until the view has drawn once. */
  liveRef: { current: KeyLiveValues | null }
}

/** One frame of the view in key units. `playhead` is the transport fraction,
 *  so the clock is `playhead` times the lanes' length. `turn`, `azimuth` and
 *  `elevation` are degrees, `distance` is `fillK`. NaN where the view has
 *  nothing to read, e.g. before the orbit controls mount. */
export interface KeyLiveValues {
  playhead: number
  drawProgress: number
  depth: number
  turn: number
  azimuth: number
  elevation: number
  distance: number
  /** The width multiplier the view draws this frame, `widthAt(keys, clockMs) ?? 1`. */
  width: number
  /** Why the engine draws short of the keyed width (Solid's thickness ceiling, say), or null. */
  widthClamp: string | null
  /** The multiplier the engine actually drew at, `AtWidth.reached`. Short of `width` when clamped. */
  widthReached: number
}

const StrokeTakeContext = createContext<StrokeTakeContextValue | null>(null)

export function StrokeTakeProvider({
  children,
  ...value
}: Omit<StrokeTakeContextValue, "selected" | "select" | "slotsRef" | "liveRef"> & { children: ReactNode }) {
  const [picked, setPicked] = useState<number | null>(null)
  const slotsRef = useRef<Float64Array | null>(null)
  const liveRef = useRef<KeyLiveValues | null>(null)
  // A selection past the last stroke (an undo removed it) reads as none.
  const selected = picked !== null && picked < value.strokeCount ? picked : null
  const ctx = useMemo<StrokeTakeContextValue>(
    () => ({ ...value, selected, select: setPicked, slotsRef, liveRef }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [value.take, value.commit, value.keys, value.setKeys, value.mode, value.penMs, value.strokeCount, selected],
  )
  return <StrokeTakeContext.Provider value={ctx}>{children}</StrokeTakeContext.Provider>
}

export function useStrokeTake(): StrokeTakeContextValue | null {
  return useContext(StrokeTakeContext)
}

/* Every mode plays the take: Rod and Inflate since ANIM-1A, Extrude and Solid since ANIM-1C,
 * graded on all four by `assert-stroke-timing-browser.mjs --grade-solid` (ANIM-1C6). The strip
 * carried a "does not reach Extrude/Solid yet" line until then; with nothing left to warn about,
 * the line is gone rather than kept as a switch nobody flips. */

/** Nudge sizes, ms. Arrow and Shift+Arrow. */
export const NUDGE_MS = 10
export const NUDGE_BIG_MS = 100
/** Speeds outside this read as a mistake, not a choice. */
export const SPEED_MIN = 0.1
export const SPEED_MAX = 10

/** A delay that would push t0 below zero moves nothing (`buildTimedSchedule`
 *  clamps it), so it is clamped here where the hand can see it stop. */
export function clampDelay(row: StrokeTiming, t0: number, next: number): number {
  const floor = row.delayMs - t0
  return Math.round(Math.max(floor, next))
}

export function clampSpeed(v: number): number {
  return Math.min(SPEED_MAX, Math.max(SPEED_MIN, Math.round(v * 1000) / 1000))
}

/* ──────────────────────────────────────────────────────────────────────────
 * THE STRIP
 * ────────────────────────────────────────────────────────────────────────── */

/** Row pitch. A bar has to be tall enough to grab, which the read-only view's
 *  5px bar was never meant to be. */
const PITCH = 12
const BAR_H = 8
const BAND_MAX_PX = 144
/** The band's height with nothing else mounted: every row up to twelve, then it
 *  scrolls. The dock reads this as the strip's floor when its Draw-in section
 *  opens, so opening the section never hides a row the closed strip showed. */
export const stripBandPx = (strokeCount: number) => Math.min(BAND_MAX_PX, strokeCount * PITCH)
/** The end zone a pointer grabs to change speed. */
const END_PX = 6

export interface StrokeStripProps {
  strokes: ProcessedStroke[]
  drawIn: DrawInParams
  revealWindow: RevealWindowParams
  openingRef?: { readonly current: boolean }
  inkThickness: number
  mode: RevealMode
  hybridBlend: number
  playhead: number
  ease: RevealEase
  unEase: (playhead: number, ease: RevealEase) => number
  totalDurationMs: number
}

interface Drag {
  i: number
  kind: "body" | "start" | "end"
  x0: number
  width: number
  axisMs: number
  row0: StrokeTiming
  t0: number
  t1: number
  base: number
  a0: number
  b0: number
  /** The keys' squeeze on the axis at grab time, 1 with no keys. */
  kx: number
  key: string
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
let dragSerial = 0

export function StrokeStrip(props: StrokeStripProps & { ctx: StrokeTakeContextValue }) {
  const { strokes, drawIn, revealWindow, openingRef, inkThickness, mode, hybridBlend, playhead, ease, unEase, ctx } = props
  const { take, commit, penMs, selected, select } = ctx

  const unitOf = useMemo(() => {
    if (drawIn.unit === "stroke" || strokes.length === 0) return null
    return assignLetters(strokes, computeSolidEffectiveThicknessPx(inkThickness)).of
  }, [strokes, drawIn.unit, inkThickness])
  const schedule = useMemo(() => scheduleFromStrokes(strokes, unitOf, drawIn), [strokes, unitOf, drawIn])
  const lifts = liftsLandBetweenStrokes(schedule, revealWindow.mode)
  /* The viewport's pace, built the same way (`viewport-3d.tsx`, the `timed` memo). */
  const pace = useMemo(
    () => paceFromCurve((c) => revealDistanceFraction(strokes, c, mode, hybridBlend, lifts)),
    [strokes, mode, hybridBlend, lifts],
  )
  const timed = useMemo(
    () => buildTimedSchedule(schedule, take, { baseMs: penMs, pace }),
    [schedule, take, penMs, pace],
  )

  const n = schedule.tracks.length
  /* Every slot in ms, from the timed schedule when there are rows, and from
   * the same pace's base slots when there are none, so the first drag never
   * nudges the bars it did not touch. */
  const slots = useMemo(() => {
    if (timed) return timed.slots
    const s = new Float64Array(n * 2)
    schedule.tracks.forEach((t, i) => {
      s[i * 2] = pace.beatToLanding(t.start) * penMs
      s[i * 2 + 1] = pace.beatToClock(t.end) * penMs
    })
    return s
  }, [timed, schedule, pace, penMs, n])
  const baseLen = (i: number) => {
    const t = schedule.tracks[i]
    return (pace.beatToClock(t.end) - pace.beatToLanding(t.start)) * penMs
  }
  const takeMs = timed ? timed.takeMs : penMs
  ctx.slotsRef.current = slots

  const bandRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<Drag | null>(null)
  const [dragAxis, setDragAxis] = useState<number | null>(null)
  const [dragKind, setDragKind] = useState<Drag["kind"] | null>(null)
  const axisMs = dragAxis ?? takeMs
  /* ANIM-3B · THE KEYS' AXIS. Keys can run past the take, and the transport
   * then plays to the last key, so the strip's axis is the keyed length and the
   * bars squeeze left by `k`. With no keys `k` is exactly 1 and nothing below
   * changes. Keys `validateKeys` refuses are left out here, as the viewport
   * leaves them out, since `revealClockMs` throws on them. */
  const keysIn = ctx.keys
  const keys = useMemo(
    () =>
      keysIn !== undefined && validateKeys(keysIn).length === 0 && KEY_PROPERTIES.some((q) => (keysIn[q]?.length ?? 0) > 0)
        ? keysIn
        : undefined,
    [keysIn],
  )
  const [keyAxis, setKeyAxis] = useState<number | null>(null)
  const lengthMs = keys ? (keyAxis ?? Math.max(axisMs, keysEndMs(keys))) : axisMs
  const k = keys ? axisMs / lengthMs : 1
  /* Open by default when the doc has keys, closed when it has none, until the
   * row is clicked. The label column exists only while the lanes are open. */
  const [lanesPick, setLanesPick] = useState<boolean | null>(null)
  const lanesOpen = ctx.setKeys ? (lanesPick ?? keys !== undefined) : false
  /* Perform (ANIM-2). Base slots from the same pace, so a performed row's
   * delay and speed are measured from where the schedule puts the stroke. */
  const [performing, setPerforming] = useState(false)
  const baseSlots = useMemo(() => {
    const s = new Float64Array(n * 2)
    schedule.tracks.forEach((t, i) => {
      s[i * 2] = pace.beatToLanding(t.start) * penMs
      s[i * 2 + 1] = pace.beatToClock(t.end) * penMs
    })
    return s
  }, [schedule, pace, penMs, n])
  const canPerform = n === strokes.length

  const xOf = (ms: number) => unEase(clamp01(ms / axisMs), ease) * k
  /** Strip fraction to ms, on the frozen axis. Past the right edge it carries
   *  on linearly, so the last bar can be dragged out and the take grows. */
  const msAt = (x: number, axis: number) =>
    (x <= 0 ? 0 : x >= 1 ? x : easeReveal(x, ease)) * axis

  if (n === 0 || !(penMs > 0)) return null

  /* With keys the ink shows what the viewport draws: a drawProgress key remaps
   * the take's clock the way `keyedRevealRef` does in the viewport. */
  const revealP = keys ? clamp01(revealClockMs(keys, clamp01(playhead) * lengthMs, takeMs) / takeMs) : clamp01(playhead)
  const win = windowAt(revealWindow, revealP, openingRef?.current === true)
  const parts = windowParts(win)
  const inkOf = (i: number): [number, number][] => {
    const out: [number, number][] = []
    for (const [wa, wb] of parts) {
      if (timed) {
        const lo = Math.max(slots[i * 2], wa * timed.takeMs)
        const hi = Math.min(slots[i * 2 + 1], wb * timed.takeMs)
        if (hi > lo) out.push([lo, hi])
      } else {
        const t = schedule.tracks[i]
        const lo = Math.max(t.start, wa)
        const hi = Math.min(t.end, wb)
        if (hi > lo) out.push([pace.beatToClock(lo) * penMs, pace.beatToClock(hi) * penMs])
      }
    }
    return out
  }

  const writeRow = (i: number, patch: Partial<StrokeTiming>, key: string | null) => {
    const cur = rowOf(take, i)
    // A patch that changes nothing writes nothing: no undo step, no row.
    if ((Object.keys(patch) as (keyof StrokeTiming)[]).every((k) => patch[k] === cur[k])) return
    commit(withRow(take, i, patch), key)
  }

  const onBarDown = (e: PointerEvent<HTMLDivElement>, i: number) => {
    if (e.button !== 0 || dragRef.current) return
    e.stopPropagation()
    const band = bandRef.current
    if (!band) return
    const W = band.clientWidth
    const barBox = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
    const off = e.clientX - barBox.left
    const zone = Math.min(END_PX, barBox.width / 3)
    const canResize = baseLen(i) > 0 && barBox.width >= 9
    const kind: Drag["kind"] =
      canResize && off <= zone ? "start" : canResize && off >= barBox.width - zone ? "end" : "body"
    select(i)
    ;(e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId)
    const t0 = slots[i * 2]
    const t1 = slots[i * 2 + 1]
    dragRef.current = {
      i,
      kind,
      x0: e.clientX,
      width: W,
      axisMs: takeMs,
      row0: rowOf(take, i),
      t0,
      t1,
      base: baseLen(i),
      a0: unEase(clamp01(t0 / takeMs), ease),
      b0: unEase(clamp01(t1 / takeMs), ease),
      kx: k,
      key: `take:strip:${i}:${++dragSerial}`,
    }
    setDragAxis(takeMs)
    setDragKind(kind)
  }

  const onBarMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = (e.clientX - d.x0) / (d.width > 0 ? d.width : 1) / d.kx
    const minLen = (d.axisMs * 2) / Math.max(1, d.width)
    if (d.kind === "body") {
      const t0 = msAt(d.a0 + dx, d.axisMs)
      writeRow(d.i, { delayMs: clampDelay(d.row0, d.t0, d.row0.delayMs + (t0 - d.t0)) }, d.key)
    } else if (d.kind === "end") {
      const t1 = Math.max(d.t0 + minLen, msAt(d.b0 + dx, d.axisMs))
      writeRow(d.i, { speed: clampSpeed(d.base / (t1 - d.t0)) }, d.key)
    } else {
      const t0 = Math.min(d.t1 - minLen, Math.max(0, msAt(d.a0 + dx, d.axisMs)))
      const speed = clampSpeed(d.base / (d.t1 - t0))
      // t1 stays: the new start is wherever the rounded speed puts it.
      const t0Kept = d.t1 - d.base / speed
      writeRow(d.i, { speed, delayMs: Math.round(d.row0.delayMs + (t0Kept - d.t0)) }, d.key)
    }
  }

  const onBarUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    try {
      ;(e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId)
    } catch {
      /* already released by a pointercancel: nothing to hand back */
    }
    dragRef.current = null
    setDragAxis(null)
    setDragKind(null)
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      if (selected === null) return
      e.preventDefault()
      select(null)
      return
    }
    if (e.key === "r" || e.key === "R") {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      e.preventDefault()
      commit({ ...take, ripple: !take.ripple }, null)
      return
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault()
      const from = selected ?? (e.key === "ArrowDown" ? -1 : n)
      select(Math.min(n - 1, Math.max(0, from + (e.key === "ArrowDown" ? 1 : -1))))
      return
    }
    if (selected === null || (e.key !== "ArrowLeft" && e.key !== "ArrowRight")) return
    e.preventDefault()
    const step = (e.shiftKey ? NUDGE_BIG_MS : NUDGE_MS) * (e.key === "ArrowLeft" ? -1 : 1)
    const row = rowOf(take, selected)
    writeRow(selected, { delayMs: clampDelay(row, slots[selected * 2], row.delayMs + step) }, `take:nudge:${selected}`)
  }

  /* With the key lanes mounted, the band and the lanes scroll as ONE region
   * (`KeyLanes`, `data-take-scroll`), so the band draws at its full height and
   * never scrolls on its own: two nested scrollers under one pointer is the
   * thing the shared region exists to avoid. */
  const shared = !!ctx.setKeys
  const scrolls = !shared && n * PITCH > BAND_MAX_PX
  const bandH = shared ? n * PITCH : Math.min(BAND_MAX_PX, n * PITCH)
  const seconds = (keys ? Math.max(takeMs, keysEndMs(keys)) : takeMs) / 1000
  const sel = selected
  const selRow = sel !== null ? rowOf(take, sel) : null

  const edges: { key: string; at: number }[] = []
  parts.forEach(([a, b], pi) => {
    const toX = (v: number) => (timed ? xOf(v * timed.takeMs) : xOf(pace.beatToClock(v) * penMs))
    const tag = pi === 0 ? "" : `-${pi}`
    const aX = toX(a)
    const bX = toX(b)
    if (aX > 0.001 && aX < 0.999) edges.push({ key: `lo${tag}`, at: aX })
    if (bX > 0.001 && bX < 0.999) edges.push({ key: `hi${tag}`, at: bX })
  })

  const band = (
      <div
        ref={bandRef}
        role="listbox"
        aria-label={`When each stroke draws. ${n} stroke${n === 1 ? "" : "s"} over ${seconds.toFixed(1)} seconds. Arrows nudge the selected stroke, Shift for bigger steps, Escape lets go.`}
        aria-activedescendant={sel !== null ? `stroke-bar-${sel}` : undefined}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          if (e.button === 0 && e.target === e.currentTarget) select(null)
        }}
        className={`relative shrink-0 overflow-x-hidden rounded-sm ${lanesOpen ? "min-w-0 flex-1" : ""} outline-none focus-visible:ring-1 focus-visible:ring-foreground/30 ${
          scrolls ? "overflow-y-auto" : "overflow-y-hidden"
        }`}
        style={{ height: `${bandH}px` }}
      >
        {[0.25, 0.5, 0.75].map((q) => (
          <div
            key={q}
            data-take-tick={q}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 w-px bg-border/70"
            style={{ left: `${q * 100}%`, height: `${n * PITCH}px` }}
          />
        ))}

        {Array.from({ length: n }, (_, i) => {
          const t0 = slots[i * 2]
          const t1 = slots[i * 2 + 1]
          const a = xOf(t0)
          const b = dragAxis !== null ? unEase(Math.max(0, t1 / axisMs), ease) * k : xOf(t1)
          const span = b - a
          const isSel = sel === i
          const row = take.strokes[i]
          const inks = inkOf(i)
          return (
            <div
              key={i}
              data-take-row={i}
              className="pointer-events-none relative w-full"
              style={{ height: `${PITCH}px` }}
            >
              <div
                id={`stroke-bar-${i}`}
                role="option"
                aria-selected={isSel}
                aria-label={`Stroke ${i + 1}, ${(t0 / 1000).toFixed(2)}s to ${(t1 / 1000).toFixed(2)}s`}
                data-take-bar={i}
                data-stroke-drag
                data-start={a.toFixed(6)}
                data-end={b.toFixed(6)}
                data-t0={t0.toFixed(3)}
                data-t1={t1.toFixed(3)}
                data-selected={isSel ? "1" : "0"}
                data-row={row ? "1" : "0"}
                onPointerDown={(e) => onBarDown(e, i)}
                onPointerMove={onBarMove}
                onPointerUp={onBarUp}
                onPointerCancel={onBarUp}
                title={`Stroke ${i + 1}: ${(t0 / 1000).toFixed(2)}s to ${(t1 / 1000).toFixed(2)}s${
                  row?.holdBack ? ", lands last" : ""
                }`}
                className={`group pointer-events-auto absolute touch-none select-none overflow-hidden rounded-[3px] transition-colors duration-100 ${
                  isSel ? "bg-foreground/20 ring-1 ring-inset ring-foreground" : "bg-foreground/15 hover:bg-foreground/25"
                } ${isSel && dragKind === "body" ? "cursor-grabbing" : "cursor-grab"}`}
                style={{
                  left: `${a * 100}%`,
                  width: `${Math.max(0, span) * 100}%`,
                  minWidth: "3px",
                  top: `${(PITCH - BAR_H) / 2}px`,
                  height: `${BAR_H}px`,
                }}
              >
                {inks.map(([ka, kb], k) => {
                  const ia = xOf(ka)
                  const ib = xOf(kb)
                  return (
                    <div
                      key={k}
                      data-take-ink
                      className={`pointer-events-none absolute top-0 bottom-0 ${isSel ? "bg-foreground" : "bg-foreground/45"}`}
                      style={{
                        left: span > 1e-9 ? `${((ia - a) / span) * 100}%` : 0,
                        width: span > 1e-9 ? `${((ib - ia) / span) * 100}%` : "100%",
                      }}
                    />
                  )
                })}
                {/* The two ends. Grips show on the selected bar and hint on
                    hover; the cursor says "resize" wherever a drag would.
                    ANIM-1B2: the selected bar is told apart by its outline, not
                    its grey, because its un-drawn grey used to match a finished
                    bar's. The grips invert what is under them (white on ink,
                    dark on the un-drawn part), so they show at either end. */}
                {(["start", "end"] as const).map((side) => (
                  <div
                    key={side}
                    data-grip={side}
                    className={`absolute top-0 bottom-0 flex cursor-ew-resize items-center justify-center ${
                      side === "start" ? "left-0" : "right-0"
                    }`}
                    style={{ width: `${END_PX}px` }}
                  >
                    <span
                      className={`block h-[6px] w-[2px] rounded-full bg-white mix-blend-difference transition-opacity duration-100 ${
                        isSel ? "opacity-100" : "opacity-0 group-hover:opacity-60"
                      }`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* With the lanes open the clock line below is the one playhead. The ink
            front stays readable in the bar fill, so its edge line steps aside:
            next to the clock it read as a double line, and under a Draw hold
            as a second playhead. */}
        {!lanesOpen && edges.map((e) => (
          <div
            key={e.key}
            data-take-edge={e.key}
            aria-hidden="true"
            className="pointer-events-none absolute top-0 w-px bg-foreground"
            style={{ left: `${e.at * 100}%`, height: `${n * PITCH}px` }}
          />
        ))}

        {lanesOpen && (
          <div
            data-take-clock-line
            aria-hidden="true"
            className="pointer-events-none absolute top-0 z-20 w-px bg-foreground/60"
            style={{ left: `${clamp01(playhead) * 100}%`, height: `${n * PITCH}px` }}
          />
        )}
      </div>
  )

  return (
    <div
      data-take-timeline
      data-stroke-strip
      data-take-clock={clamp01(playhead).toFixed(6)}
      data-axis-ms={axisMs.toFixed(3)}
      data-ease={ease}
      data-ripple={take.ripple ? "1" : "0"}
      data-length-ms={keys ? lengthMs.toFixed(3) : undefined}
      className="flex min-h-0 flex-col border-b border-border/60 px-3 pb-2 pt-1.5"
    >
      <div className="mb-1.5 flex shrink-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 text-[10px] font-medium text-foreground">When each stroke draws</span>
          <span className="truncate text-[10px] tabular-nums text-muted-foreground">
            {sel !== null && selRow
              ? `Stroke ${sel + 1}, ${selRow.delayMs === 0 ? "on time" : `${selRow.delayMs > 0 ? "+" : ""}${selRow.delayMs} ms`}, ${selRow.speed}x${selRow.holdBack ? ", lands last" : ""}`
              : "Drag a bar to move it, an end to change its speed"}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {sel !== null && selRow && (
            <button
              type="button"
              data-strip-holdback
              aria-pressed={selRow.holdBack}
              onClick={() => writeRow(sel, { holdBack: !selRow.holdBack }, null)}
              title="Stroke lands last, after every other stroke has finished"
              className={`fs-press rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                selRow.holdBack
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              Hold back
            </button>
          )}
          <button
            type="button"
            data-strip-perform
            disabled={!canPerform}
            onClick={() => setPerforming(true)}
            title={canPerform ? "Move the pen along a stroke yourself. The take keeps your timing." : "Perform needs one bar per stroke. Switch Draw by to Stroke."}
            className="fs-press rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            Perform
          </button>
          {performing && (
            <PerformTake
              strokes={strokes}
              baseSlots={baseSlots}
              slots={slots}
              reverse={schedule.tracks.map((t) => !!t.reverse)}
              take={take}
              commit={commit}
              initial={selected}
              onClose={() => setPerforming(false)}
            />
          )}
          <button
            type="button"
            data-strip-ripple
            aria-pressed={take.ripple}
            onClick={() => commit({ ...take, ripple: !take.ripple }, null)}
            title="On: moving a stroke slides every later stroke along with it. Off: the others stay put. R toggles it."
            className={`fs-press rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
              take.ripple
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Ripple
          </button>
          <span className="font-mono text-[9px] leading-none tabular-nums text-muted-foreground">
            {seconds.toFixed(1)}s total
          </span>
        </div>
      </div>

      {shared ? (
        <KeyLanes
          ctx={ctx}
          open={lanesOpen}
          onToggle={() => setLanesPick(!lanesOpen)}
          lengthMs={lengthMs}
          playhead={playhead}
          freezeAxis={setKeyAxis}
          leadMaxPx={Math.min(BAND_MAX_PX, n * PITCH)}
          lead={
            lanesOpen ? (
              <div className="flex">
                <div
                  className="flex shrink-0 items-start pt-px text-[10px] text-muted-foreground"
                  style={{ width: `${KEY_GUTTER_PX}px`, height: `${bandH}px` }}
                >
                  Strokes
                </div>
                {band}
              </div>
            ) : (
              band
            )
          }
        />
      ) : (
        band
      )}
    </div>
  )
}
