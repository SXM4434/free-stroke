"use client"

/* ==========================================================================
 * PERFORM (ANIM-2). He moves the pen along a stroke and the take keeps his
 * timing. His words: "as if you were someone in control of the pen through a
 * motion tool". The reference is Procreate Dreams Perform: pen down records,
 * lifting pauses the clock, and a re-take of the same stroke overwrites it.
 * After Effects' Motion Sketch adds capture speed, so at 0.5x the take's
 * clock runs at half speed and he can perform slowly.
 *
 * ONE TAKE. Nothing here keeps timing after it closes. A finished performance
 * becomes rows through `withPerformed` and lands with ONE `commit`, the strip's
 * path, so one ⌘Z takes it back. Esc closes and writes nothing.
 *
 * The stage is flat: every stroke in its drawn 2D shape, the one being
 * performed lit, and the ink following the pointer's progress along it. The
 * progress only moves forward, and only to the nearest point on the path a
 * short way ahead, so a loop that crosses itself cannot jump.
 * ======================================================================== */

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent } from "react"
import { createPortal } from "react-dom"
import type { ProcessedStroke } from "@/lib/stroke-processing"
import {
  CAPTURE_SPEEDS,
  fitPerformed,
  withPerformed,
  type PerformSample,
  type StrokeTimingTake,
} from "@/lib/stroke-timing"

type Fit = { t0: number; t1: number; performed: number[] }

export interface PerformTakeProps {
  strokes: ProcessedStroke[]
  /** `[B0, B1]` per stroke in ms, the strip's base slots. */
  baseSlots: Float64Array
  /** The strip's current slots, so a single re-take opens where the stroke opens now. */
  slots: Float64Array
  /** Per stroke: drawn from its last point back to its first. */
  reverse: boolean[]
  take: StrokeTimingTake
  commit: (next: StrokeTimingTake, key: string | null) => void
  /** The stroke picked in the strip, if any. */
  initial: number | null
  onClose: () => void
}

const PAD = 48
const NEAR_PX = 44
let performSerial = 0

export function PerformTake(props: PerformTakeProps) {
  const { strokes, baseSlots, slots, reverse, take, commit, initial, onClose } = props
  const n = strokes.length
  const order = useMemo(
    () => Array.from({ length: n }, (_, i) => i).sort((a, b) => baseSlots[a * 2] - baseSlots[b * 2] || a - b),
    [n, baseSlots],
  )
  const [target, setTarget] = useState<number | "all">(initial ?? "all")
  const [smoothing, setSmoothing] = useState(0)
  const [capture, setCapture] = useState<number>(1)
  const [box, setBox] = useState({ w: 1200, h: 700 })
  const stageRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* Every stroke fitted into the stage, in draw order, with its arc lengths. */
  const paths = useMemo(() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const s of strokes) for (const p of s.points) {
      x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y)
    }
    const k = Math.min((box.w - PAD * 2) / Math.max(x1 - x0, 1), (box.h - PAD * 2) / Math.max(y1 - y0, 1))
    const ox = (box.w - (x1 - x0) * k) / 2
    const oy = (box.h - (y1 - y0) * k) / 2
    return strokes.map((s, i) => {
      const pts = s.points.map((p) => [ox + (p.x - x0) * k, oy + (p.y - y0) * k] as [number, number])
      if (reverse[i]) pts.reverse()
      const arc = [0]
      for (let j = 1; j < pts.length; j++) arc.push(arc[j - 1] + Math.hypot(pts[j][0] - pts[j - 1][0], pts[j][1] - pts[j - 1][1]))
      return { pts, arc, len: arc[arc.length - 1], d: "M" + pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("L") }
    })
  }, [strokes, reverse, box])

  const queue = useMemo(() => (target === "all" ? order : [target]).filter((i) => paths[i]?.len > 0), [target, order, paths])

  /* The performance in progress. Refs, because a pointer frame must not wait for React. */
  const rec = useRef({ at: 0, clock: 0, last: 0, down: false, p: 0, samples: [] as PerformSample[], fits: new Map<number, Fit>(), raw: new Map<number, PerformSample[]>() })
  const [, tick] = useState(0)
  const [phase, setPhase] = useState<"ready" | "review">("ready")
  const origin = target === "all" ? 0 : slots[(target as number) * 2] ?? 0

  const reset = () => {
    rec.current = { at: 0, clock: 0, last: 0, down: false, p: 0, samples: [], fits: new Map(), raw: new Map() }
    setPhase("ready")
    tick((v) => v + 1)
  }
  useEffect(reset, [target]) // eslint-disable-line react-hooks/exhaustive-deps

  const refit = (sm: number) => {
    const r = rec.current
    r.fits = new Map()
    for (const [i, s] of r.raw) {
      const f = fitPerformed(s, sm)
      if (f) r.fits.set(i, f)
    }
  }

  const keep = () => {
    const r = rec.current
    if (r.fits.size === 0) return
    commit(withPerformed(take, baseSlots, r.fits), `perform:${++performSerial}`)
    onClose()
  }

  /* The keys and the frame loop subscribe once and read the latest render
   * through this ref. Before ANIM-2B both effects had no deps, so every tick
   * (one per frame while recording) removed and re-added the keydown listener
   * and cancelled and re-requested the frame: ~60 of each a second. */
  const latest = useRef({ step: (_x: number | null, _y: number | null, _now: number) => {}, keep, onClose, phase })
  useLayoutEffect(() => {
    latest.current = { step, keep, onClose, phase }
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const L = latest.current
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); L.onClose() }
      else if (e.key === "Enter" && L.phase === "review") { e.preventDefault(); e.stopPropagation(); L.keep() }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [])

  /* Advance the take clock by real time times the capture speed, then read progress. */
  const step = (x: number | null, y: number | null, now: number) => {
    const r = rec.current
    if (!r.down || phase !== "ready") return
    r.clock += (now - r.last) * capture
    r.last = now
    const i = queue[r.at]
    const P = paths[i]
    if (x !== null && y !== null && P) {
      const L = P.len
      const lo = r.p * L
      const hi = lo + Math.max(48, 0.2 * L)
      let best = r.p, bestD = NEAR_PX
      for (let j = 1; j < P.pts.length; j++) {
        if (P.arc[j] < lo || P.arc[j - 1] > hi) continue
        const [ax, ay] = P.pts[j - 1], [bx, by] = P.pts[j]
        const dx = bx - ax, dy = by - ay
        const seg = dx * dx + dy * dy
        const u = seg > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / seg)) : 0
        const d = Math.hypot(ax + dx * u - x, ay + dy * u - y)
        const a = (P.arc[j - 1] + (P.arc[j] - P.arc[j - 1]) * u) / L
        if (d < bestD && a >= r.p && a * L <= hi) { bestD = d; best = a }
      }
      /* A move that ends a hold: the pen was still until this event, so the
       * hold runs to now and the rise starts here, not at the last frame's
       * sample. Without it a pause plays up to one frame short. */
      const last = r.samples[r.samples.length - 1]
      if (best > r.p && last && last.p === r.p && last.tMs < origin + r.clock) r.samples.push({ tMs: origin + r.clock, p: r.p })
      r.p = best > 0.995 ? 1 : best
    }
    r.samples.push({ tMs: origin + r.clock, p: r.p })
    if (r.p >= 1) {
      r.raw.set(i, r.samples)
      const f = fitPerformed(r.samples, smoothing)
      if (f) r.fits.set(i, f)
      r.at++
      r.p = 0
      r.samples = [{ tMs: origin + r.clock, p: 0 }]
      if (r.at >= queue.length) { r.down = false; setPhase("review") }
    }
    tick((v) => v + 1)
  }

  /* A held pen with no motion is a pause, so the clock keeps sampling per frame. */
  useEffect(() => {
    let id = 0
    const loop = () => { latest.current.step(null, null, performance.now()); id = requestAnimationFrame(loop) }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])

  const toStage = (e: PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect()
    return [e.clientX - b.left, e.clientY - b.top] as const
  }
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    if (phase === "review") { reset(); return }
    e.currentTarget.setPointerCapture(e.pointerId)
    const r = rec.current
    r.down = true
    r.last = performance.now()
    if (r.samples.length === 0) r.samples.push({ tMs: origin + r.clock, p: r.p })
    const [x, y] = toStage(e)
    step(x, y, r.last)
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    if (!rec.current.down) return
    const [x, y] = toStage(e)
    step(x, y, performance.now())
  }
  const onUp = () => { rec.current.down = false; tick((v) => v + 1) }

  const r = rec.current
  const live = queue[r.at]
  const inked = (i: number) => (r.fits.has(i) || r.raw.has(i) ? 1 : i === live ? r.p : 0)
  const seconds = (r.clock / 1000).toFixed(2)

  /* The recorded pace, every performed stroke end to end on the take's time. */
  const graph = useMemo(() => {
    if (phase !== "review" || r.fits.size === 0) return null
    const fits = queue.map((i) => r.fits.get(i)).filter(Boolean) as Fit[]
    const a = fits[0].t0, b = fits[fits.length - 1].t1
    const pts: string[] = []
    fits.forEach((f, k) => f.performed.forEach((v, j) => {
      const t = f.t0 + ((f.t1 - f.t0) * j) / (f.performed.length - 1)
      pts.push(`${(((t - a) / Math.max(b - a, 1)) * 240).toFixed(2)},${(44 - ((k + v) / fits.length) * 40).toFixed(3)}`)
    }))
    return pts.join(" ")
  }, [phase, smoothing, queue, r.fits.size]) // eslint-disable-line react-hooks/exhaustive-deps

  const hint =
    phase === "review"
      ? "Enter keeps it. Esc throws it away. Press the stage to start over."
      : r.at === 0 && r.p === 0 && r.clock === 0
        ? "Press on the lit stroke and drag along it. Lift the pen and the clock stops."
        : r.down
          ? "Recording. Hold still and the take pauses there. Lift and the clock stops."
          : "Clock stopped. Press to carry on from here."

  // A portal, so a transformed ancestor in the panel cannot trap the fixed stage.
  return createPortal(
    <div data-perform-take className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-border px-4 py-2 text-xs">
        <span className="flex items-center gap-2 font-medium">
          <span className={`size-2 rounded-full ${r.down ? "bg-red-500" : "bg-muted-foreground/50"}`} aria-hidden />
          Perform
        </span>
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Stroke</span>
          <select data-perform-target value={String(target)} onChange={(e) => setTarget(e.target.value === "all" ? "all" : Number(e.target.value))} className="rounded border border-border bg-background px-1.5 py-0.5">
            <option value="all">All, in order</option>
            {order.map((i) => <option key={i} value={i}>Stroke {i + 1}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2" title="Evens out the shake in your pace. Long pauses stay.">
          <span className="text-muted-foreground">Smoothing</span>
          <input data-perform-smoothing type="range" min={0} max={1} step={0.05} value={smoothing}
            onChange={(e) => { const v = Number(e.target.value); setSmoothing(v); refit(v); tick((x) => x + 1) }} className="w-24 accent-foreground" />
          <span className="w-8 tabular-nums">{Math.round(smoothing * 100)}%</span>
        </label>
        <span className="flex items-center gap-2" title="At 0.5x the clock runs at half speed. Perform slowly and it plays back twice as fast.">
          <span className="text-muted-foreground">Capture speed</span>
          <span className="flex overflow-hidden rounded border border-border">
            {CAPTURE_SPEEDS.map((s) => (
              <button key={s} type="button" data-perform-capture={s} disabled={r.clock > 0 && phase === "ready"}
                onClick={() => setCapture(s)}
                className={`px-2 py-0.5 tabular-nums transition-transform active:scale-[0.97] ${capture === s ? "bg-foreground text-background" : ""}`}>
                {s}x
              </button>
            ))}
          </span>
        </span>
        <span data-perform-clock className="tabular-nums text-muted-foreground">{seconds} s</span>
        <span className="ml-auto flex items-center gap-2">
          {phase === "review" && (
            <button type="button" data-perform-keep onClick={keep} title="Enter" className="rounded bg-foreground px-2.5 py-1 text-background active:scale-[0.97]">Keep take</button>
          )}
          <button type="button" data-perform-cancel onClick={onClose} title="Esc" className="rounded border border-border px-2.5 py-1 active:scale-[0.97]">Cancel</button>
        </span>
      </div>
      <p data-perform-hint className="px-4 pt-3 text-xs text-muted-foreground">{hint}</p>
      <svg ref={stageRef} data-perform-stage className="min-h-0 flex-1 touch-none select-none"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
        {paths.map((P, i) => (
          <g key={i} data-perform-stroke={i}>
            <path d={P.d} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={i === live ? 10 : 6}
              className={i === live ? "stroke-foreground/25" : "stroke-foreground/10"} />
            {/* A zero-length dash with round caps draws a dot, so an unstarted stroke has no ink path at all. */}
            <path d={P.d} fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={6} className="stroke-foreground"
              strokeDasharray={`${(inked(i) * P.len).toFixed(1)} ${P.len + 1}`} visibility={inked(i) > 0 ? "visible" : "hidden"} />
          </g>
        ))}
        {live !== undefined && paths[live] && phase === "ready" && (() => {
          const P = paths[live]
          const at = r.p * P.len
          let j = 1
          while (j < P.arc.length - 1 && P.arc[j] < at) j++
          const u = P.arc[j] > P.arc[j - 1] ? (at - P.arc[j - 1]) / (P.arc[j] - P.arc[j - 1]) : 0
          const x = P.pts[j - 1][0] + (P.pts[j][0] - P.pts[j - 1][0]) * u
          const y = P.pts[j - 1][1] + (P.pts[j][1] - P.pts[j - 1][1]) * u
          return <circle cx={x} cy={y} r={7} className="fill-red-500" />
        })()}
      </svg>
      {graph && (
        <div className="absolute bottom-4 left-4 rounded border border-border bg-background px-3 py-2 text-xs">
          <p className="mb-1 text-muted-foreground">Your pace. Flat is where you held still.</p>
          <svg width={240} height={48} data-perform-graph><polyline points={graph} fill="none" className="stroke-foreground" strokeWidth={1.5} /></svg>
        </div>
      )}
    </div>,
    document.body,
  )
}
