"use client"

/* ==========================================================================
 * THE KEY LANES (ANIM-3B). One lane per keyable property under the stroke
 * strip, a diamond per key, and the speed curve between two keys opening in
 * the lane itself.
 *
 * The reference is Spline's timeline with After Effects' speed graph. Keys sit
 * on the property's own lane. The curve shows SPEED, since where the pen is
 * fastest is what he shapes, and the `x1, y1, x2, y2` numbers sit under it the
 * way Figma prints a bezier. A new key eases the way AE's Easy Ease does.
 *
 * ── ONE MODEL, ONE CLOCK ─────────────────────────────────────────────────
 *
 * Nothing here stores keys. Every edit builds the next track, runs
 * `validateTrack` on it, and writes it through the context's `setKeys`, which
 * is the page's `edit()`, so ⌘Z reaches it. A refused edit shows its reason in
 * the row under the lanes and writes nothing. The speed fill is `sampleTrack`
 * differenced on a two-key copy of the span, so the curve cannot drift from
 * what the viewport plays. The x axis is the transport fraction, the strip's
 * own, over `lengthMs`: a key at `tMs` sits at `tMs / lengthMs`.
 *
 * A drag is ONE undo step: diamonds and curve handles carry
 * `data-stroke-drag`, which the page's gesture bracket treats like a slider,
 * and every move in one drag commits under the same key.
 *
 * ── LAYOUT ───────────────────────────────────────────────────────────────
 *
 * The dock card is anchored at the bottom, so anything that grows pushes what
 * is above it up. So the disclosure row sits UNDER the lanes, and an open
 * curve grows ABOVE its diamond row: the row and the span you clicked stay
 * under the pointer. Closed, the row is the only thing added to the strip.
 * ======================================================================== */

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react"
import {
  EASY_EASE_IN,
  EASY_EASE_OUT,
  handleOf,
  makeKey,
  sampleTrack,
  validateKeys,
  validateTrack,
  type EaseIn,
  type EaseOut,
  type Handle,
  type Key,
  type KeyProperty,
  type TakeKeys,
  type Track,
} from "@/lib/keyframes"
import { CAMERA_MOVES, tryCameraMove, type CameraMove } from "@/lib/camera-moves"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { StrokeTakeContextValue } from "@/components/stroke-strip"

/** The label column. The strip's band gets the same column while the lanes
 *  are open, so the two time axes line up to the pixel. */
export const KEY_GUTTER_PX = 84
/** L6 (BUILD-PLAN.md §4 "Hit targets", §5 row L6): a key row is 32 px, and 36
 *  px while the dock is maximized (L5 marks the root with `data-fs-dock-max`).
 *  Until L6 a lane was one more 12 px row of the strip, and a key a 12x12
 *  button: too small to grab, his "hot mess" (rulings 2026-09-26). */
const KEY_ROW_PX_MIN = 32
const KEY_ROW_PX_MAX = 36
/** The must-fail arm of scripts/verify/assert-hit-targets.mjs: the pre-L6
 *  sizes, read once. Nothing but that gate sets it. */
const HIT_OLD = typeof window !== "undefined" && (window as unknown as { __fsHitMutant?: string }).__fsHitMutant === "old"
function useKeyRowPx(): number {
  const read = () =>
    HIT_OLD ? 12 : typeof document !== "undefined" && document.documentElement.dataset.fsDockMax === "1" ? KEY_ROW_PX_MAX : KEY_ROW_PX_MIN
  const [px, setPx] = useState(read)
  useEffect(() => {
    const mo = new MutationObserver(() => setPx(read()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-fs-dock-max"] })
    setPx(read())
    return () => mo.disconnect()
  }, [])
  return px
}
/** The disclosure row. Closed, this is all the lanes add. */
export const KEY_ROW_PX = 22
const BOX_H = 52
/** Room above and below the box for a handle that overshoots. */
const BOX_PAD = 12
const NUM_H = 24
export const CURVE_H = BOX_PAD * 2 + BOX_H + NUM_H
/** A `fit` editor's height: its numbers row takes a second line. */
export const CURVE_FIT_H = CURVE_H + NUM_H + 4
/** The numbers row's width, so it never runs off the right edge. */
const NUM_ROW_PX = 430
/** Average speed draws at this share of the box height. */
const SPEED_AT_AVG = 0.45
const SPEED_N = 96
/** The line under the Width lane when the engine draws short of the keyed width. */
const NOTE_H = 14
/** A dragged handle's y stays inside the room the box leaves for it. */
const Y_MIN = -BOX_PAD / BOX_H
const Y_MAX = 1 + BOX_PAD / BOX_H

interface LaneMeta {
  prop: KeyProperty
  label: string
  unit: string
  /** Shown value = stored value times this. */
  scale: number
  digits: number
  title: string
}

const LANES: LaneMeta[] = [
  { prop: "drawProgress", label: "Draw", unit: "%", scale: 100, digits: 0, title: "How much of the drawing shows. Two keys at the same value hold the pen still." },
  { prop: "depth", label: "Depth", unit: "%", scale: 100, digits: 0, title: "How deep the mark is. 100% is full depth, 0% is flat." },
  { prop: "turn", label: "Turn", unit: "°", scale: 1, digits: 1, title: "How far the mark turns, in degrees." },
  { prop: "azimuth", label: "Orbit", unit: "°", scale: 1, digits: 1, title: "Where the camera sits around the mark, in degrees." },
  { prop: "elevation", label: "Tilt", unit: "°", scale: 1, digits: 1, title: "How far the camera looks down on the mark, in degrees." },
  { prop: "distance", label: "Distance", unit: "x", scale: 1, digits: 2, title: "How far away the camera is. Lower is closer." },
  { prop: "width", label: "Width", unit: "x", scale: 1, digits: 2, title: "How wide the mark is, times the width it ships at. 0.5x to 2x." },
]
const metaOf = (p: KeyProperty) => LANES.find((m) => m.prop === p)!

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const fmt = (v: number, d: number) => {
  const s = v.toFixed(d)
  return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s
}
const secs = (ms: number) => fmt(ms / 1000, 2)
const shown = (m: LaneMeta, v: number) => `${fmt(v * m.scale, m.digits)}${m.unit}`
const sameHandle = (e: EaseOut | EaseIn, h: Handle) => typeof e === "object" && e.x === h.x && e.y === h.y
let serial = 0

/** What the view reported the last time the engine drew short of the keyed width. */
interface WidthClamp {
  /** `widthClamp` as the engine wrote it. */
  full: string
  /** The multiplier it drew at instead. */
  reached: number
  /** It clamped going wider, not thinner. */
  up: boolean
}

function clampNote(mode: string, c: WidthClamp): string {
  // Reached 1 with a reason means no width was applied at all; the reason says why.
  if (c.reached === 1) return c.full
  const r = fmt(c.reached, 2)
  if (mode === "solid") return c.up ? `Solid draws this at ${r}x. Any wider and the counters close.` : `Solid draws this at ${r}x. It won't go thinner.`
  if (mode === "extrude") return `Extrude draws this at ${r}x, the end of its width slider.`
  return c.full
}

/** Speed across the span, from `sampleTrack` on a two-key copy running 0 to 1,
 *  as a closed path in a 0..100 box. Average speed sits at `SPEED_AT_AVG` of
 *  the height and anything faster than the box holds is cut at the top. */
function speedPath(o: EaseOut, n: EaseIn): string {
  const unit: Key[] = [
    { tMs: 0, value: 0, easeOut: o, easeIn: "linear" },
    { tMs: 1000, value: 1, easeOut: "linear", easeIn: n },
  ]
  let d = "M0,100"
  let prev = 0
  for (let j = 1; j <= SPEED_N; j++) {
    const v = sampleTrack(unit, (j / SPEED_N) * 1000) as number
    const s = Math.abs(v - prev) * SPEED_N
    prev = v
    d += ` L${(((j - 0.5) / SPEED_N) * 100).toFixed(2)},${(100 - Math.min(100, s * SPEED_AT_AVG * 100)).toFixed(2)}`
  }
  return `${d} L100,100 Z`
}

/* ──────────────────────────────────────────────────────────────────────────
 * A number field. Enter or leaving the field commits, Escape puts it back. A
 * refused commit puts the field back too, and the reason shows in the row.
 * ────────────────────────────────────────────────────────────────────────── */

function NumField({
  label,
  value,
  digits,
  unit,
  disabled,
  placeholder,
  onCommit,
  attrs,
}: {
  label: string
  value: number | null
  digits: number
  unit?: string
  disabled?: boolean
  placeholder?: string
  onCommit: (text: string) => boolean
  attrs?: Record<string, string>
}) {
  const text = value === null ? "" : fmt(value, digits)
  return (
    <label className="flex items-center gap-1 text-[10px] text-muted-foreground">
      {label}
      <input
        key={text}
        type="text"
        inputMode="decimal"
        defaultValue={text}
        placeholder={placeholder}
        disabled={disabled}
        {...attrs}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur()
          else if (e.key === "Escape") {
            e.currentTarget.value = text
            e.currentTarget.blur()
          }
        }}
        onBlur={(e) => {
          const t = e.currentTarget.value.trim()
          if (t === text) return
          if (!onCommit(t)) e.currentTarget.value = text
        }}
        className="h-5 w-12 rounded-md border border-border bg-background px-1 text-[10px] tabular-nums text-foreground outline-none focus-visible:ring-1 focus-visible:ring-foreground/30 disabled:opacity-40"
      />
      {unit && <span>{unit}</span>}
    </label>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * THE CURVE between key i and key i + 1. (0, 0) is the first key at the
 * bottom left, (1, 1) the next key at the top right. The out handle is the
 * first key's easeOut, the in handle the next key's easeIn.
 * ────────────────────────────────────────────────────────────────────────── */

export function CurveEditor({
  m,
  i,
  k0,
  k1,
  a,
  b,
  onEase,
  onReason,
  fit = false,
}: {
  m: LaneMeta
  i: number
  k0: Key
  k1: Key
  a: number
  b: number
  onEase: (out: EaseOut, inn: EaseIn, gesture: string | null) => boolean
  onReason: (r: string) => void
  /** For a host narrower than the numbers row (the draw-in's Custom ease, about
   *  315 px against 430): the row wraps onto a second line under the box, and
   *  Hold is left out, because a draw-in that holds is a blank page, then all of it.
   *  The host reserves CURVE_FIT_H. The key lanes never pass it. */
  fit?: boolean
}) {
  const boxRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ side: "out" | "in"; key: string; box: DOMRect } | null>(null)
  const out = handleOf(k0.easeOut, "out")
  const inn = handleOf(k1.easeIn, "in") ?? EASY_EASE_IN
  const hold = out === null
  const isEasy = sameHandle(k0.easeOut, EASY_EASE_OUT) && sameHandle(k1.easeIn, EASY_EASE_IN)
  const isLinear = k0.easeOut === "linear" && k1.easeIn === "linear"

  const onDown = (e: PointerEvent<HTMLButtonElement>, side: "out" | "in") => {
    if (e.button !== 0 || dragRef.current || !boxRef.current) return
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { side, key: `keys:ease:${m.prop}:${i}:${++serial}`, box: boxRef.current.getBoundingClientRect() }
  }
  const onMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d) return
    const x = Math.round(clamp01((e.clientX - d.box.left) / Math.max(1, d.box.width)) * 1000) / 1000
    const yRaw = (d.box.bottom - e.clientY) / Math.max(1, d.box.height)
    const y = Math.round(Math.min(Y_MAX, Math.max(Y_MIN, yRaw)) * 1000) / 1000
    if (d.side === "out") {
      if (out && out.x === x && out.y === y) return
      onEase({ x, y }, k1.easeIn, d.key)
    } else {
      if (inn.x === x && inn.y === y) return
      onEase(k0.easeOut, { x, y }, d.key)
    }
  }
  const onUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    dragRef.current = null
  }

  const setNum = (which: "x1" | "y1" | "x2" | "y2", text: string): boolean => {
    const v = Number(text)
    if (text === "" || !Number.isFinite(v)) {
      onReason(`${which} needs a number.`)
      return false
    }
    const o = out ?? EASY_EASE_OUT
    if (which === "x1") return onEase({ ...o, x: v }, k1.easeIn, null)
    if (which === "y1") return onEase({ ...o, y: v }, k1.easeIn, null)
    if (which === "x2") return onEase(k0.easeOut, { ...inn, x: v }, null)
    return onEase(k0.easeOut, { ...inn, y: v }, null)
  }

  const allPresets: { id: "easy" | "linear" | "hold"; label: string; on: boolean; title: string; apply: () => void }[] = [
    { id: "easy", label: "Easy Ease", on: isEasy, title: "Slow out of the first key, slow into the next", apply: () => onEase(EASY_EASE_OUT, EASY_EASE_IN, null) },
    { id: "linear", label: "Linear", on: isLinear, title: "The same speed the whole way", apply: () => onEase("linear", "linear", null) },
    { id: "hold", label: "Hold", on: hold, title: "Stay on the first key's value, then jump to the next", apply: () => onEase("hold", k1.easeIn, null) },
  ]
  const presets = fit ? allPresets.filter((p) => p.id !== "hold") : allPresets

  return (
    <div data-key-curve={`${m.prop}:${i}`} className="absolute inset-0">
      <div
        ref={boxRef}
        data-curve-box
        className="absolute border border-border/70"
        style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%`, top: `${BOX_PAD}px`, height: `${BOX_H}px` }}
      >
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {!hold && <path data-curve-speed d={speedPath(k0.easeOut, k1.easeIn)} className="fill-foreground/10" />}
          <path
            d={
              hold
                ? "M0,100 L100,100 L100,0"
                : `M0,100 C${out.x * 100},${100 - out.y * 100} ${inn.x * 100},${100 - inn.y * 100} 100,0`
            }
            fill="none"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
            className="stroke-foreground/35"
          />
          {!hold && (
            <>
              <line x1={0} y1={100} x2={out.x * 100} y2={100 - out.y * 100} strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-foreground/50" />
              <line x1={100} y1={0} x2={inn.x * 100} y2={100 - inn.y * 100} strokeWidth={1} vectorEffect="non-scaling-stroke" className="stroke-foreground/50" />
            </>
          )}
        </svg>
        {hold ? (
          <span className="absolute left-1.5 top-1 text-[10px] text-muted-foreground">Hold</span>
        ) : (
          ([
            ["out", out],
            ["in", inn],
          ] as const).map(([side, h]) => (
            <button
              key={side}
              type="button"
              data-curve-handle={side}
              data-stroke-drag
              data-x={h.x}
              data-y={h.y}
              aria-label={`${side === "out" ? "Out of the first key" : "Into the next key"}, ${fmt(h.x, 2)}, ${fmt(h.y, 2)}`}
              title={side === "out" ? "Drag to shape the speed out of the first key" : "Drag to shape the speed into the next key"}
              onPointerDown={(e) => onDown(e, side)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
              /* L6 (BUILD-PLAN.md §4): a 24 px hit circle around a 5 px dot. */
              className={`absolute z-10 flex ${HIT_OLD ? "h-4 w-4" : "h-6 w-6"} -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none items-center justify-center rounded-full outline-none focus-visible:ring-1 focus-visible:ring-foreground/30 active:cursor-grabbing`}
              style={{ left: `${h.x * 100}%`, top: `${(1 - h.y) * 100}%` }}
            >
              <span data-curve-dot className={`block ${HIT_OLD ? "h-[7px] w-[7px]" : "h-[5px] w-[5px]"} rounded-full bg-foreground`} />
            </button>
          ))
        )}
      </div>

      <div
        className={`absolute z-30 flex items-center gap-2 ${fit ? "flex-wrap gap-y-1" : ""}`}
        style={
          fit
            ? { top: `${BOX_PAD * 2 + BOX_H}px`, left: 0, right: 0 }
            : {
                top: `${BOX_PAD * 2 + BOX_H}px`,
                height: `${NUM_H}px`,
                left: `max(0px, min(${a * 100}%, calc(100% - ${NUM_ROW_PX}px)))`,
              }
        }
      >
        <NumField label="x1" value={out ? out.x : null} digits={2} disabled={hold} placeholder="hold" onCommit={(t) => setNum("x1", t)} attrs={{ "data-curve-num": "x1" }} />
        <NumField label="y1" value={out ? out.y : null} digits={2} disabled={hold} placeholder="hold" onCommit={(t) => setNum("y1", t)} attrs={{ "data-curve-num": "y1" }} />
        <NumField label="x2" value={hold ? null : inn.x} digits={2} disabled={hold} placeholder="hold" onCommit={(t) => setNum("x2", t)} attrs={{ "data-curve-num": "x2" }} />
        <NumField label="y2" value={hold ? null : inn.y} digits={2} disabled={hold} placeholder="hold" onCommit={(t) => setNum("y2", t)} attrs={{ "data-curve-num": "y2" }} />
        <div className={`flex items-center gap-1 ${fit ? "whitespace-nowrap" : "ml-1"}`}>
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              data-curve-preset={p.id}
              aria-pressed={p.on}
              title={p.title}
              onClick={p.apply}
              className={`fs-press rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                p.on ? "border-foreground/20 bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * THE CAMERA PICKER (ANIM-5A's moves). Each move reads the take's own slots
 * and keys and either places its keys or says why this take has no moment for
 * it. A refused move stays listed, greyed, with that reason, so he can see
 * what to change. Picking writes the move's keys in ONE `setKeys`, replacing
 * only the tracks the move names, so one ⌘Z takes it back.
 * ────────────────────────────────────────────────────────────────────────── */

type MoveOption = { move: CameraMove; keys: TakeKeys; refused?: undefined } | { move: CameraMove; keys?: undefined; refused: string }

function moveOptions(ctx: StrokeTakeContextValue): MoveOption[] {
  const slots = ctx.slotsRef.current
  if (!slots || slots.length < 2) {
    const why = "The strip hasn't laid out the strokes yet, so there is no take to time this to."
    return CAMERA_MOVES.map((move) => ({ move, refused: why }))
  }
  // The take ends where the last slot ends, the rule `buildTimedSchedule` uses.
  let takeMs = 0
  for (let i = 1; i < slots.length; i += 2) if (slots[i] > takeMs) takeMs = slots[i]
  if (!(takeMs > 0)) takeMs = ctx.penMs
  return CAMERA_MOVES.map((move) => ({ move, ...tryCameraMove(move, { slots, takeMs, keys: ctx.keys }) }))
}

function CameraPicker({
  ctx,
  open,
  onOpenChange,
  onPick,
}: {
  ctx: StrokeTakeContextValue
  open: boolean
  onOpenChange: (open: boolean) => void
  onPick: (move: CameraMove, keys: TakeKeys) => void
}) {
  // Read when the list opens, so it times the moves to the take as it is now.
  const options = open ? moveOptions(ctx) : []
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-camera-picker
          data-open={open ? "1" : "0"}
          title="Place a camera move timed to this take"
          className={`fs-press flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
            open ? "border-foreground/20 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Camera
          <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" className="shrink-0">
            <path d="M1.5 5.5 4 2.5 6.5 5.5" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" sideOffset={6} className="w-80 p-1" data-camera-moves>
        {options.map(({ move, keys: moveKeys, refused }) => {
          const replaced = move.tracks.reduce((n, t) => n + (ctx.keys?.[t]?.length ?? 0), 0)
          const why = refused === undefined ? null : refused.startsWith(`${move.label}: `) ? refused.slice(move.label.length + 2) : refused
          const text = why ?? move.reason
          return (
            <button
              key={move.id}
              type="button"
              data-camera-move={move.id}
              data-refused={why ? "1" : "0"}
              disabled={why !== null}
              onClick={() => moveKeys && onPick(move, moveKeys)}
              className="fs-press flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors enabled:hover:bg-foreground/[0.06] disabled:cursor-not-allowed"
            >
              <span className="flex w-full items-baseline justify-between gap-2">
                <span className={`text-[11px] font-medium ${why ? "text-muted-foreground" : "text-foreground"}`}>{move.label}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {move.tracks.map((t) => metaOf(t).label).join(", ")}
                </span>
              </span>
              <span data-camera-reason className={`text-[10px] leading-snug ${why ? "text-muted-foreground/80" : "text-muted-foreground"}`}>
                {why ? `Can't run here: ${text}` : text}
              </span>
              {!why && replaced > 0 && (
                <span className="text-[10px] leading-snug text-muted-foreground">
                  Replaces the {replaced} key{replaced === 1 ? "" : "s"} on {move.tracks.filter((t) => ctx.keys?.[t]?.length).map((t) => metaOf(t).label).join(" and ")}.
                </span>
              )}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * THE LANES
 * ────────────────────────────────────────────────────────────────────────── */

interface Sel {
  prop: KeyProperty
  i: number
}

interface KeyDrag {
  prop: KeyProperty
  i: number
  x0: number
  width: number
  axis: number
  t0: number
  lo: number
  hi: number
  key: string
}

export interface KeyLanesProps {
  ctx: StrokeTakeContextValue
  open: boolean
  onToggle: () => void
  /** The lanes' axis in ms: `max(takeMs, keysEndMs(keys))`, frozen while a key is dragged. */
  lengthMs: number
  /** The strip's playhead, the transport fraction. Draws the line; "+" reads `liveRef` instead. */
  playhead: number
  /** Holds the axis still for the length of a drag, or lets it go with null. */
  freezeAxis: (ms: number | null) => void
  /** The strip's band, drawn at the top of the one scroll region the lanes share with it. */
  lead?: ReactNode
  /** The band's own cap. The region's cap is this plus the open lanes, so the lanes never
   *  scroll inside the floating panel; the docked panel caps it tighter through flex. */
  leadMaxPx?: number
}

export function KeyLanes({ ctx, open, onToggle, lengthMs, playhead, freezeAxis, lead, leadMaxPx = 0 }: KeyLanesProps) {
  const PITCH = useKeyRowPx()
  const { keys, setKeys, liveRef, mode } = ctx
  const [sel, setSel] = useState<Sel | null>(null)
  const [span, setSpan] = useState<Sel | null>(null)
  const [reason, setReason] = useState<string | null>(null)
  const dragRef = useRef<KeyDrag | null>(null)
  const [picking, setPicking] = useState(false)

  const bad = keys === undefined ? [] : validateKeys(keys)
  const trackOf = (p: KeyProperty): Track => keys?.[p] ?? []
  // A selection or span past the end of its track, after an undo, reads as none.
  const selKey = sel && trackOf(sel.prop)[sel.i] ? sel : null
  const openSpan = span && trackOf(span.prop)[span.i + 1] ? span : null
  const keyed = LANES.filter((m) => trackOf(m.prop).length > 0)
  const count = keyed.reduce((n, m) => n + trackOf(m.prop).length, 0)
  const x = (tMs: number) => (lengthMs > 0 ? tMs / lengthMs : 0)

  /** Every edit ends here: validate the track, write it, or show why not. */
  const commit = (prop: KeyProperty, next: Key[], gesture: string | null): boolean => {
    const r = validateTrack(next, prop)
    if (r.length) {
      setReason(`${metaOf(prop).label}: ${r.join("; ")}`)
      return false
    }
    if (!setKeys) {
      setReason("This page has no document to save keys to.")
      return false
    }
    const refused = setKeys({ ...(keys ?? {}), [prop]: next }, gesture)
    if (refused.length) {
      setReason(refused.join("; "))
      return false
    }
    setReason(null)
    return true
  }

  /** A camera move: its tracks cleared, its keys in, one `setKeys`, so one undo step. */
  const pickMove = (move: CameraMove, moveKeys: TakeKeys) => {
    if (!setKeys) {
      setReason("This page has no document to save keys to.")
      return
    }
    const next: TakeKeys = { ...(keys ?? {}) }
    for (const t of move.tracks) delete next[t]
    Object.assign(next, moveKeys)
    const refused = setKeys(next, null)
    if (refused.length) {
      setReason(`${move.label}: ${refused.join("; ")}`)
      return
    }
    setReason(null)
    setSel(null)
    setSpan(null)
    setPicking(false)
  }

  const add = (m: LaneMeta) => {
    const live = liveRef.current
    const p = live ? live.playhead : clamp01(playhead)
    const tMs = Math.round(p * lengthMs)
    const track = trackOf(m.prop)
    const at = track.findIndex((k) => k.tMs === tMs)
    if (at >= 0) {
      setSel({ prop: m.prop, i: at })
      setReason(null)
      return
    }
    let value: number | undefined
    if (track.length && validateTrack(track, m.prop).length === 0) value = sampleTrack(track, tMs, m.prop)
    else value = live ? live[m.prop] : undefined
    if (value === undefined || !Number.isFinite(value)) {
      setReason(`${m.label}: the view has no ${m.label.toLowerCase()} to read yet, so no key was added. Play or scrub once, then press + again.`)
      return
    }
    if (m.prop === "drawProgress") value = clamp01(value)
    value = Math.round(value * 10000) / 10000
    const next = [...track, makeKey(tMs, value)].sort((u, v) => u.tMs - v.tMs)
    if (commit(m.prop, next, null)) setSel({ prop: m.prop, i: next.findIndex((k) => k.tMs === tMs) })
  }

  const remove = (s: Sel) => {
    const track = trackOf(s.prop)
    if (commit(s.prop, track.filter((_, j) => j !== s.i), null)) {
      setSel(null)
      if (span?.prop === s.prop) setSpan(null)
    }
  }

  const setTime = (s: Sel, text: string): boolean => {
    const m = metaOf(s.prop)
    const v = Number(text)
    const t = Math.round(v * 1000)
    if (text === "" || !Number.isFinite(v) || t < 0) {
      setReason("Time needs a number of seconds, 0 or more.")
      return false
    }
    const track = trackOf(s.prop)
    if (track.some((k, j) => j !== s.i && k.tMs === t)) {
      setReason(`A ${m.label} key already sits at ${secs(t)}s. Two keys can't share a time.`)
      return false
    }
    const next = track.map((k, j) => (j === s.i ? { ...k, tMs: t } : k)).sort((u, w) => u.tMs - w.tMs)
    if (!commit(s.prop, next, null)) return false
    setSel({ prop: s.prop, i: next.findIndex((k) => k.tMs === t) })
    if (span?.prop === s.prop) setSpan(null)
    return true
  }

  const setValue = (s: Sel, text: string): boolean => {
    const m = metaOf(s.prop)
    const v = Number(text)
    if (text === "" || !Number.isFinite(v)) {
      setReason(`${m.label} needs a number.`)
      return false
    }
    const value = Math.round((v / m.scale) * 10000) / 10000
    return commit(s.prop, trackOf(s.prop).map((k, j) => (j === s.i ? { ...k, value } : k)), null)
  }

  const setEase = (prop: KeyProperty, i: number, out: EaseOut, inn: EaseIn, gesture: string | null) =>
    commit(
      prop,
      trackOf(prop).map((k, j) => (j === i ? { ...k, easeOut: out } : j === i + 1 ? { ...k, easeIn: inn } : k)),
      gesture,
    )

  const onKeyDown = (e: PointerEvent<HTMLButtonElement>, m: LaneMeta, i: number) => {
    if (e.button !== 0 || dragRef.current) return
    e.stopPropagation()
    const track = trackOf(m.prop)
    const k = track[i]
    const row = e.currentTarget.parentElement
    if (!k || !row) return
    setSel({ prop: m.prop, i })
    setReason(null)
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = {
      prop: m.prop,
      i,
      x0: e.clientX,
      width: row.clientWidth,
      axis: lengthMs,
      t0: k.tMs,
      lo: i > 0 ? track[i - 1].tMs + 1 : 0,
      hi: i < track.length - 1 ? track[i + 1].tMs - 1 : Infinity,
      key: `keys:drag:${m.prop}:${i}:${++serial}`,
    }
    freezeAxis(lengthMs)
  }
  const onKeyMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d) return
    const t = Math.min(d.hi, Math.max(d.lo, Math.round(d.t0 + ((e.clientX - d.x0) / Math.max(1, d.width)) * d.axis)))
    const track = trackOf(d.prop)
    if (!track[d.i] || track[d.i].tMs === t) return
    commit(d.prop, track.map((k, j) => (j === d.i ? { ...k, tMs: t } : k)), d.key)
  }
  const onKeyUp = (e: PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    dragRef.current = null
    freezeAxis(null)
  }

  const onRootKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!open || (e.target as HTMLElement).tagName === "INPUT") return
    // The camera list is portalled but its keys still bubble here through React.
    if ((e.target as HTMLElement).closest?.("[data-camera-moves]")) return
    if ((e.key === "Delete" || e.key === "Backspace") && selKey) {
      e.preventDefault()
      e.stopPropagation()
      remove(selKey)
    } else if (e.key === "Escape" && (openSpan || selKey)) {
      e.preventDefault()
      e.stopPropagation()
      if (openSpan) setSpan(null)
      else setSel(null)
    }
  }

  /* THE WIDTH CLAMP. The view writes why it drew short of the keyed width into
   * `liveRef` every frame; nothing re-renders for it, so a rAF reads it while
   * the lanes are open and the width track has keys, and sets state only when
   * the answer changes. The note HOLDS once seen: a clamp belongs to the keyed
   * values, not the playhead, and a line that came and went every loop would
   * move the dock under the pointer. It clears when the track or the engine
   * changes, or when the engine draws past the recorded limit unclamped, which
   * means the limit moved (a thickness slider, say). */
  const widthTrack = keys?.width
  const [clamp, setClamp] = useState<WidthClamp | null>(null)
  const clampRef = useRef<WidthClamp | null>(null)
  useEffect(() => {
    clampRef.current = null
    setClamp(null)
  }, [widthTrack, mode])
  useEffect(() => {
    if (!open || !widthTrack?.length) return
    let raf = 0
    const tick = () => {
      const live = liveRef.current
      const prev = clampRef.current
      let next = prev
      if (live?.widthClamp) {
        const up = live.width > 1
        // The widest clamp seen names the limit; a ramp toward it keeps the first reading.
        if (!prev || prev.up !== up || Math.abs(prev.reached - live.widthReached) > 5e-4) next = { full: live.widthClamp, reached: live.widthReached, up }
      } else if (live && prev && (prev.up ? live.widthReached > prev.reached + 5e-4 : live.widthReached < prev.reached - 5e-4)) {
        next = null
      }
      if (next !== prev) {
        clampRef.current = next
        setClamp(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open, widthTrack, liveRef])

  const shownReason = reason ?? (bad.length ? `These keys can't play: ${bad.join("; ")}` : null)
  const p = clamp01(playhead)

  /* ONE SCROLL REGION FOR THE BAND AND THE LANES. Docked under the canvas, the
   * panel is capped so the canvas keeps its room, and the region is what gives.
   * Opening the lanes or a curve adds rows below whatever the region shows, so
   * the new rows are scrolled into view; otherwise the click reads as doing
   * nothing. Instant, since this opens tens of times in a session. */
  const bodyRef = useRef<HTMLDivElement>(null)
  const curveShown = openSpan !== null && !bad.length
  const clampShown = clamp !== null && (widthTrack?.length ?? 0) > 0
  // The Width row's note line is always reserved (see its render), so it always counts: a clamp
  // appearing must not change the lanes' height and reframe the canvas.
  const bodyH = LANES.length * PITCH + (curveShown ? CURVE_H : 0) + NOTE_H
  const spanKey = curveShown ? `${openSpan.prop}:${openSpan.i}` : ""
  useEffect(() => {
    const body = bodyRef.current
    if (!open || !body) return
    // The curve's whole lane, so its keys and its label come into view with it.
    const lane = body.querySelector("[data-key-curve]")?.closest("[data-key-lane]")
    ;(lane ?? body).scrollIntoView({ block: "nearest" })
  }, [open, spanKey])

  /* THE REGION SAYS WHEN IT HOLDS MORE. Overlay scrollbars show nothing until
   * the pointer scrolls, so a capped region otherwise hides rows with no sign
   * they are there. The edge with more content behind it fades over 16 px. */
  const scrollRef = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState<"" | "above" | "below" | "both">("")
  const readMore = () => {
    const el = scrollRef.current
    if (!el) return
    const above = el.scrollTop > 0.5
    const below = el.scrollTop + el.clientHeight < el.scrollHeight - 0.5
    setMore(above && below ? "both" : above ? "above" : below ? "below" : "")
  }
  useEffect(readMore)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || typeof ResizeObserver === "undefined") return
    const ro = new ResizeObserver(readMore)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const fadeTop = more === "above" || more === "both"
  const fadeBottom = more === "below" || more === "both"
  const mask = more
    ? `linear-gradient(to bottom, ${fadeTop ? "transparent" : "#000"} 0, #000 ${fadeTop ? 16 : 0}px, #000 calc(100% - ${fadeBottom ? 16 : 0}px), ${fadeBottom ? "transparent" : "#000"} 100%)`
    : undefined

  const lane = (m: LaneMeta) => {
    const track = trackOf(m.prop)
    const sp = openSpan && openSpan.prop === m.prop ? openSpan.i : null
    return (
      <div key={m.prop} data-key-lane={m.prop} data-key-count={track.length}>
        {sp !== null && !bad.length && (
          <div className="flex">
            <div className="shrink-0" style={{ width: `${KEY_GUTTER_PX}px` }} />
            <div className="relative min-w-0 flex-1" style={{ height: `${CURVE_H}px` }}>
              <CurveEditor
                m={m}
                i={sp}
                k0={track[sp]}
                k1={track[sp + 1]}
                a={x(track[sp].tMs)}
                b={x(track[sp + 1].tMs)}
                onEase={(o, n, g) => setEase(m.prop, sp, o, n, g)}
                onReason={setReason}
              />
            </div>
          </div>
        )}
        <div className="flex" style={{ height: `${PITCH}px` }}>
          {/* L6: 14 px between the add button and the track, so a key at 0 s
              (a 24 px hit box centred on the track's edge, reaching 12 px
              into this gutter) never touches it. The gutter went from 72 to 84
              px to keep the label's room for the 24 px button. */}
          <div className={`flex shrink-0 items-center justify-between ${HIT_OLD ? "pr-2" : "pr-3.5"}`} style={{ width: `${KEY_GUTTER_PX}px` }}>
            {/* Line height = the row. At the inherited 1.5 the label is 15 px in a
                12 px row, and the last lane's label pokes 1.5 px out of the body,
                so the region scrolls 2 px and fades its top with nothing hidden. */}
            <span
              title={m.title}
              className={`truncate text-[10px] ${track.length ? "text-foreground" : "text-muted-foreground"}`}
              style={{ lineHeight: `${PITCH}px` }}
            >
              {m.label}
            </span>
            <button
              type="button"
              data-key-add={m.prop}
              aria-label={`Add a ${m.label} key at the playhead`}
              title={`Add a ${m.label} key at the playhead`}
              onClick={() => add(m)}
              /* L6: a square 24x24 hit box (a rounded corner is not hit, so the
                 rounding lives on the drawn plate inside it). */
              className={`fs-press group/add flex ${HIT_OLD ? "h-3 w-3 rounded-[3px]" : "h-6 w-6"} shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground`}
            >
              <span className="flex h-full max-h-5 w-full max-w-5 items-center justify-center rounded-[3px] transition-colors group-hover/add:bg-foreground/15">
                <svg aria-hidden="true" width={HIT_OLD ? 7 : 10} height={HIT_OLD ? 7 : 10} viewBox="0 0 7 7">
                  <path d="M3.5 0.5v6M0.5 3.5h6" stroke="currentColor" strokeWidth="1" />
                </svg>
              </span>
            </button>
          </div>
          <div className="relative min-w-0 flex-1">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 rounded-[3px] bg-foreground/[0.05]"
              style={{ top: `${(PITCH - 8) / 2}px`, height: "8px" }}
            />
            {track.slice(0, -1).map((k, i) => {
              const a = x(k.tMs)
              const b = x(track[i + 1].tMs)
              const isOpen = sp === i
              const hold = k.easeOut === "hold"
              return (
                <button
                  key={`s${i}`}
                  type="button"
                  data-key-span={`${m.prop}:${i}`}
                  aria-pressed={isOpen}
                  aria-label={`${m.label}, ${secs(k.tMs)}s to ${secs(track[i + 1].tMs)}s. Opens the speed curve.`}
                  title="Click to shape the speed between these two keys"
                  onClick={() => {
                    setSpan(isOpen ? null : { prop: m.prop, i })
                    setReason(null)
                  }}
                  className="group absolute inset-y-0 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-foreground/30"
                  style={{ left: `${a * 100}%`, width: `${Math.max(0, b - a) * 100}%` }}
                >
                  <span
                    className={`absolute inset-x-0 top-1/2 ${
                      hold
                        ? `border-t border-dashed ${isOpen ? "border-foreground" : "border-foreground/45 group-hover:border-foreground/70"}`
                        : `h-px ${isOpen ? "bg-foreground" : "bg-foreground/45 group-hover:bg-foreground/70"}`
                    }`}
                  />
                </button>
              )
            })}
            {track.map((k, i) => {
              const isSel = selKey?.prop === m.prop && selKey.i === i
              return (
                <button
                  key={`k${i}`}
                  type="button"
                  data-key={`${m.prop}:${i}`}
                  data-stroke-drag
                  data-t-ms={k.tMs}
                  data-value={k.value}
                  data-selected={isSel ? "1" : "0"}
                  aria-label={`${m.label} key at ${secs(k.tMs)}s, ${shown(m, k.value)}`}
                  title={`${m.label} ${shown(m, k.value)} at ${secs(k.tMs)}s. Drag to move it.`}
                  onPointerDown={(e) => onKeyDown(e, m, i)}
                  onPointerMove={onKeyMove}
                  onPointerUp={onKeyUp}
                  onPointerCancel={onKeyUp}
                  /* L6: the key is clickable over the whole row and 24 px wide (the
                     plan's "at least 24x24"), and drawn as a 12 px diamond: a
                     rotated 8.5 px square is 12 px corner to corner. */
                  className={`group absolute top-0 z-10 flex ${HIT_OLD ? "h-3 w-3" : "h-full w-6"} -translate-x-1/2 cursor-grab touch-none select-none items-center justify-center rounded-[3px] outline-none focus-visible:ring-1 focus-visible:ring-foreground/30 active:cursor-grabbing`}
                  style={{ left: `${x(k.tMs) * 100}%` }}
                >
                  <span
                    data-key-mark
                    className={`block ${HIT_OLD ? "h-[7px] w-[7px]" : "h-[8.5px] w-[8.5px]"} rotate-45 rounded-[1px] border ${
                      isSel ? "border-foreground bg-foreground" : "border-foreground/60 bg-background group-hover:border-foreground"
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>
        {/* The note's line is always reserved under the Width row, so a clamp showing up never grows the
         * dock and reframes the canvas under him (controller, 2026-09-26: it did, mid-play). */}
        {m.prop === "width" && (
          <div className="flex" style={{ height: `${NOTE_H}px` }}>
            <div className="shrink-0" style={{ width: `${KEY_GUTTER_PX}px` }} />
            {clampShown && clamp && (
              <span
                data-width-clamp
                title={clamp.full}
                className="min-w-0 truncate text-[10px] text-muted-foreground"
                style={{ lineHeight: `${NOTE_H}px` }}
              >
                {clampNote(mode, clamp)}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  const sm = selKey ? metaOf(selKey.prop) : null
  const sk = selKey ? trackOf(selKey.prop)[selKey.i] : null

  return (
    <div data-key-lanes-root className="flex min-h-0 flex-col">
      <div
        ref={scrollRef}
        data-take-scroll
        data-take-more={more || undefined}
        onScroll={readMore}
        // -mr/pr: a key at the axis end is centred on 100%, and the region clips x.
        // 6 px of the strip's 12 px padding keeps its right half without moving the axis.
        className="-mr-1.5 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain pr-1.5"
        style={{
          maxHeight: `${leadMaxPx + (open ? bodyH : 0)}px`,
          maskImage: mask,
          WebkitMaskImage: mask,
          // A row scrolled into view stops clear of the 16 px fade, not under it.
          scrollPaddingBlock: "16px",
        }}
      >
      {lead}
      {open && (
        <div ref={bodyRef} data-key-lanes-body className="relative" onKeyDown={onRootKey}>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0" style={{ left: `${KEY_GUTTER_PX}px` }}>
            {[0.25, 0.5, 0.75].map((q) => (
              <div key={q} className="absolute inset-y-0 w-px bg-border/70" style={{ left: `${q * 100}%` }} />
            ))}
          </div>
          {LANES.map(lane)}
          {/* Clipped to the lane column, as the band clips its clock line, so the
              playhead at 100% hides in both instead of showing only here. */}
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-20 overflow-hidden" style={{ left: `${KEY_GUTTER_PX}px` }}>
            <div data-key-playhead className="absolute inset-y-0 w-px bg-foreground/60" style={{ left: `${p * 100}%` }} />
          </div>
        </div>
      )}
      </div>

      <div className="flex min-w-0 shrink-0 items-center gap-2" style={{ height: `${KEY_ROW_PX}px` }} onKeyDown={onRootKey}>
        <button
          type="button"
          data-key-lanes
          data-open={open ? "1" : "0"}
          aria-expanded={open}
          onClick={onToggle}
          title={open ? "Hide the keyframe lanes" : "Show the keyframe lanes"}
          className="fs-press flex shrink-0 items-center gap-1 text-[10px] font-medium text-foreground"
          style={open ? { width: `${KEY_GUTTER_PX - 8}px` } : undefined}
        >
          <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" className={`shrink-0 ${open ? "rotate-90" : ""}`}>
            <path d="M2.5 1.5 5.5 4 2.5 6.5" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
          Keyframes
        </button>
        {open && selKey && sm && sk ? (
          <div className="flex shrink-0 items-center gap-2" data-key-selected={`${selKey.prop}:${selKey.i}`}>
            <span className="text-[10px] font-medium text-foreground">{sm.label} key</span>
            <NumField
              label="Time"
              value={sk.tMs / 1000}
              digits={2}
              unit="s"
              onCommit={(t) => setTime(selKey, t)}
              attrs={{ "data-key-time": "" }}
            />
            <NumField
              label="Value"
              value={sk.value * sm.scale}
              digits={sm.digits}
              unit={sm.unit}
              onCommit={(t) => setValue(selKey, t)}
              attrs={{ "data-key-value": "" }}
            />
            <button
              type="button"
              data-key-delete
              onClick={() => remove(selKey)}
              title="Delete this key. Delete or Backspace does the same."
              className="fs-press rounded-md border border-border px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Delete
            </button>
          </div>
        ) : !shownReason ? (
          <span className="min-w-0 truncate text-[10px] text-muted-foreground">
            {open
              ? "+ adds a key at the playhead. Click the line between two keys to shape its speed."
              : count
                ? `${count} key${count === 1 ? "" : "s"} on ${keyed.map((m) => m.label).join(", ")}`
                : "Animate the drawing, depth, turn and camera over time"}
          </span>
        ) : null}
        <span data-key-reason title={shownReason ?? undefined} className="min-w-0 truncate text-[10px] text-destructive">
          {shownReason ?? ""}
        </span>
        <div className="ml-auto flex shrink-0 items-center">
          <CameraPicker ctx={ctx} open={picking} onOpenChange={setPicking} onPick={pickMove} />
        </div>
      </div>
    </div>
  )
}
