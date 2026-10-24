"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import {
  processStroke,
  processAllStrokes,
  type Point,
  type Stroke,
  type ProcessedStroke,
} from "@/lib/stroke-processing"

export interface ExportSettings {
  spacing: number
  smoothing: boolean
  preserveCorners: boolean
}

/**
 * ⚠ THIS COMPONENT NO LONGER OWNS ANY DOCUMENT STATE, AND THAT IS THE POINT.
 *
 * It used to own the stroke setters, the three processing settings, undo, clear
 * and the ⌘Z binding. Every one of those is part of the DOCUMENT, and a
 * document that lives inside the canvas is a document only the canvas can undo
 * — which is exactly what shipped: ⌘Z popped a stroke and reached nothing else
 * in the app, and ⇧⌘Z was explicitly swallowed by the same handler
 * (`if (… || e.shiftKey) return`), so there was no redo anywhere.
 *
 * All of it moved up to `app/page.tsx`, which is the only place that can see
 * the whole document. What is left here is what a canvas is actually for:
 * capturing a gesture and drawing it.
 */
interface DrawingCanvasProps {
  rawStrokes: Stroke[]
  processedStrokes: ProcessedStroke[]
  /** Stroke-processing settings, owned upstream so they are undoable + saved. */
  settings: ExportSettings
  onSettingsChange: (patch: Partial<ExportSettings>, opts?: { coalesceKey?: string }) => void
  /** A finished gesture. One undo step. */
  onStrokeComplete: (raw: Stroke, processed: ProcessedStroke) => void
  /** The debounced re-derive after a setting change — NOT its own undo step. */
  onReprocessed: (processed: ProcessedStroke[]) => void
  onUndo: () => boolean
  onRedo: () => boolean
  onClear: () => void
  canUndo: boolean
  canRedo: boolean
  /** What the next ⌘Z would take back, for the button's tooltip. */
  undoLabel: string | null
  redoLabel: string | null
}

export default function DrawingCanvas({
  rawStrokes,
  processedStrokes,
  settings,
  onSettingsChange,
  onStrokeComplete,
  onReprocessed,
  onUndo,
  onRedo,
  onClear,
  canUndo,
  canRedo,
  undoLabel,
  redoLabel,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<Point[]>([])
  // Mirrors isDrawingRef for the empty-state hint only (the hot pointer path
  // keeps using the ref so drawing never waits on a React render).
  const [isDrawing, setIsDrawing] = useState(false)
  /* The processing readout is for whoever is debugging, not for a visitor.
   * Development builds only, and only when `?debug` is in the URL, the same
   * rule as the viewport's own debug panel (asked for, never on by default).
   * Read in an effect so the server render and the first client render agree. */
  const [debugReadout, setDebugReadout] = useState(false)
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    setDebugReadout(new URLSearchParams(window.location.search).has("debug"))
  }, [])

  /* ---- processing controls (owned by app/page.tsx) ---- */
  const { spacing, smoothing, preserveCorners } = settings

  /* ---- refs for current settings (so callbacks read fresh values) ---- */
  const smoothingRef = useRef(smoothing)
  const spacingRef = useRef(spacing)
  const preserveCornersRef = useRef(preserveCorners)
  const rawStrokesRef = useRef(rawStrokes)

  useEffect(() => {
    smoothingRef.current = smoothing
  }, [smoothing])
  useEffect(() => {
    spacingRef.current = spacing
  }, [spacing])
  useEffect(() => {
    preserveCornersRef.current = preserveCorners
  }, [preserveCorners])
  useEffect(() => {
    rawStrokesRef.current = rawStrokes
  }, [rawStrokes])

  /* ---- timing instrumentation ---- */
  const timingRef = useRef({
    drawMs: 0,
    procOneMs: 0,
    procAllMs: 0,
    callsOne: 0,
    callsAll: 0,
    lastTrigger: "none" as string,
  })
  const [timingDisplay, setTimingDisplay] = useState(
    "draw: 0ms | procOne: 0ms ×0 | procAll: 0ms ×0 | lastTrigger: none"
  )
  const processingRef = useRef(false)

  /* `callsOne` was counted on every finished stroke and NEVER READ — the
   * readout showed `procOne` (the duration) beside `callsAll` (the other
   * path's count), so the one number that says how many single-stroke passes
   * had run was written and thrown away. Shown rather than deleted: it is the
   * denominator for the `procOne` beside it, and a duration with no call count
   * cannot be read as a rate. */
  const updateTimingDisplay = useCallback(() => {
    const t = timingRef.current
    setTimingDisplay(
      `draw: ${t.drawMs.toFixed(1)}ms | procOne: ${t.procOneMs.toFixed(1)}ms ×${t.callsOne} | procAll: ${t.procAllMs.toFixed(1)}ms ×${t.callsAll} | lastTrigger: ${t.lastTrigger}`
    )
  }, [])

  /* ---- rAF batching ---- */
  const rafIdRef = useRef(0)

  /* ---- stable debounced reprocess (ref-based, never recreated) ---- */
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Run processAllStrokes synchronously, update timing + state */
  const runFullReprocess = useCallback(
    (trigger: string) => {
      if (processingRef.current) return
      processingRef.current = true

      /* THE RE-ENTRANCY FLAG NEEDS A `finally`, AND IT DID NOT HAVE ONE.
       *
       * `processAllStrokes` runs on user-supplied geometry and this file has no
       * idea what it can throw on — the edge sweep pushes a 5,000-point
       * scribble, a NaN coordinate and a closed loop through it. Without the
       * `finally`, one throw anywhere in here leaves `processingRef.current`
       * stuck at `true` FOREVER, and the guard on the line above then swallows
       * every later reprocess silently: the Smoothing / Corners / Spacing
       * controls keep moving, keep recording undo steps, and stop changing the
       * mark. That is the worst shape of failure in this app — controls that
       * respond and do nothing — and it would outlive the error that caused it.
       *
       * The throw is deliberately NOT swallowed: it still propagates, so the
       * fault is visible. Only the flag is guaranteed. */
      try {
        const t0 = performance.now()
        const result = processAllStrokes(
          rawStrokesRef.current,
          spacingRef.current,
          smoothingRef.current,
          preserveCornersRef.current
        )
        const t1 = performance.now()

        timingRef.current.procAllMs = t1 - t0
        timingRef.current.callsAll += 1
        timingRef.current.lastTrigger = trigger

        onReprocessed(result)
        updateTimingDisplay()
      } finally {
        processingRef.current = false
      }
    },
    [onReprocessed, updateTimingDisplay]
  )

  const debouncedReprocess = useCallback(
    (trigger: string) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = setTimeout(() => {
        runFullReprocess(trigger)
      }, 200)
    },
    [runFullReprocess]
  )

  /** Immediately run reprocess, cancelling any pending debounce */
  const commitReprocess = useCallback(
    (trigger: string) => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
      runFullReprocess(trigger)
    },
    [runFullReprocess]
  )

  /* Trigger debounced reprocess when settings change */
  useEffect(() => {
    debouncedReprocess("smoothing")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [smoothing])

  useEffect(() => {
    debouncedReprocess("spacing")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spacing])

  useEffect(() => {
    debouncedReprocess("corners")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preserveCorners])

  /* Cleanup debounce on unmount */
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    }
  }, [])

  /* which strokes to render on 2D canvas */
  const renderStrokes = smoothing ? processedStrokes : rawStrokes

  /* ---- resize canvas to fill container ---- */
  // Resizing a canvas clears its bitmap, so every resize MUST be followed by a
  // redraw — otherwise the user's drawing silently vanishes whenever the
  // layout shifts (opening/closing panels, switching modes, window resize).
  const redrawRef = useRef<() => void>(() => {})
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const dpr = window.devicePixelRatio || 1
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      redrawRef.current()
    })

    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  /* ---- full redraw from strokes (instrumented) ---- */
  const redraw = useCallback(
    (extraPoints?: Point[]) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const t0 = performance.now()

      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const allStrokes = extraPoints
        ? [...renderStrokes, { points: extraPoints }]
        : renderStrokes

      // Ink follows the theme's foreground color (the canvas element carries
      // text-foreground), so strokes stay visible in dark mode too.
      const ink = getComputedStyle(canvas).color || "#000000"

      for (const stroke of allStrokes) {
        if (stroke.points.length < 2) continue
        ctx.beginPath()
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
        }
        ctx.strokeStyle = ink
        ctx.lineWidth = 2
        ctx.lineCap = "round"
        ctx.lineJoin = "round"
        ctx.stroke()
      }

      const t1 = performance.now()
      timingRef.current.drawMs = t1 - t0
    },
    [renderStrokes]
  )

  /* ---- rAF-batched redraw scheduler ---- */
  const scheduleRedraw = useCallback(
    (extraPoints?: Point[]) => {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = requestAnimationFrame(() => {
        redraw(extraPoints)
      })
    },
    [redraw]
  )

  /* redraw whenever committed strokes or processing result change */
  useEffect(() => {
    redrawRef.current = redraw
    scheduleRedraw()
  }, [redraw, scheduleRedraw])

  /* cleanup rAF on unmount */
  useEffect(() => {
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [])

  /* ---- pointer handlers ---- */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      // Ignore extra touch points once a drag is live (multi-touch protection).
      if (isDrawingRef.current) return

      canvas.setPointerCapture(e.pointerId)
      isDrawingRef.current = true
      setIsDrawing(true)

      const rect = canvas.getBoundingClientRect()
      const point: Point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t: Date.now(),
        pressure: e.pressure !== undefined ? e.pressure : undefined,
      }
      currentPointsRef.current = [point]
    },
    []
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawingRef.current) return

      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const point: Point = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        t: Date.now(),
        pressure: e.pressure !== undefined ? e.pressure : undefined,
      }
      currentPointsRef.current.push(point)
      scheduleRedraw(currentPointsRef.current)
    },
    [scheduleRedraw]
  )

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    setIsDrawing(false)

    const points = currentPointsRef.current
    if (points.length >= 2) {
      const newRaw: Stroke = { points: [...points] }

      const t0 = performance.now()
      const newProcessed = processStroke(
        newRaw,
        spacingRef.current,
        smoothingRef.current,
        preserveCornersRef.current
      )
      const t1 = performance.now()

      timingRef.current.procOneMs = t1 - t0
      timingRef.current.callsOne += 1
      timingRef.current.lastTrigger = "pointerUp"

      onStrokeComplete(newRaw, newProcessed)
      updateTimingDisplay()
    }
    currentPointsRef.current = []
  }, [onStrokeComplete, updateTimingDisplay])

  /**
   * A CANCELLED GESTURE IS NOT A STROKE — and `pointercancel` was not handled
   * at all.
   *
   * MEASURED (scripts/verify/_probe-lane28-edges.mjs): a real captured gesture
   * — mouse down on the canvas, ten moves, `setPointerCapture` succeeded — then
   * a `pointercancel` for the same pointerId. Raw point count before 0, after
   * the cancel 0: nothing closed the gesture. The eleven points from the
   * CANCELLED drag were still sitting in `currentPointsRef`, and the next
   * `pointerup` committed them as a finished stroke.
   *
   * `pointercancel` means the browser has taken the gesture over — a scroll
   * took it, a system edge-swipe took it, the pen left range, the touch became
   * a two-finger gesture. The user did not finish a mark; they had one taken
   * away. Committing it writes a stroke they did not draw, and it goes onto the
   * undo stack as "Draw stroke", so the ⌘Z label lies about it too.
   *
   * It also has to CLOSE the gesture, not just drop the points: `handlePointer-
   * Down` returns early while `isDrawingRef` is true (multi-touch protection),
   * so a cancel that left the flag set would make the canvas ignore every later
   * gesture until something else happened to close it.
   *
   * Ordering with `onPointerLeave` is safe in both directions. A real cancel
   * releases pointer capture and the browser then fires pointerout/pointerleave
   * at the capture target; by then `isDrawingRef` is false and
   * `handlePointerUp`'s own guard makes that a no-op.
   */
  const handlePointerCancel = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false
    setIsDrawing(false)
    currentPointsRef.current = []
    // Repaint without the in-flight polyline, or the abandoned line stays on
    // the bitmap until some other redraw happens to clear it.
    scheduleRedraw()
  }, [scheduleRedraw])

  /* THE ⌘Z LISTENER USED TO LIVE HERE AND IT HAS MOVED TO `app/page.tsx`.
   *
   * It could only ever have reached the stroke list from in here, and the thing
   * a user means by ⌘Z is the document. The version that lived here also bailed
   * on `e.shiftKey` before doing anything at all, which is the whole reason
   * ⇧⌘Z did nothing anywhere in the product. */

  /* ---- debug counts ---- */
  const rawTotalPoints = rawStrokes.reduce(
    (sum, s) => sum + s.points.length,
    0
  )
  const processedTotalPoints = processedStrokes.reduce(
    (sum, s) => sum + s.points.length,
    0
  )
  const lastCornerCount =
    processedStrokes.length > 0
      ? processedStrokes[processedStrokes.length - 1].cornerCount
      : 0

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <canvas
        ref={canvasRef}
        aria-label="Drawing canvas. Draw a stroke here to create 3D geometry."
        className="h-full w-full cursor-crosshair touch-none text-foreground"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      />

      {/* Empty-state affordance: invites the first gesture, then gets out of
          the way. Exit is a 200ms strong ease-out fade (element leaving). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex select-none flex-col items-center justify-center gap-1.5"
        style={{
          opacity: rawStrokes.length === 0 && !isDrawing ? 1 : 0,
          transition: "opacity 200ms var(--ease-out-strong)",
        }}
      >
        <svg
          width="28"
          height="28"
          viewBox="0 0 28 28"
          fill="none"
          className="text-muted-foreground/50"
        >
          <path
            d="M4 20 C 8 8, 12 8, 14 14 S 20 22, 24 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-sm font-medium text-muted-foreground">Draw here</span>
        <span className="text-xs text-muted-foreground/70">
          Your stroke becomes a 3D form on the right
        </span>
      </div>

      {/* Debug info: development build AND ?debug in the URL. */}
      {debugReadout && (
        <div className="pointer-events-none absolute left-3 top-3 select-none font-mono text-[10px] text-muted-foreground/60">
          <div>
            raw {rawTotalPoints} pts | processed {processedTotalPoints} pts |
            spacing {spacing}px | smoothing: {smoothing ? "on" : "off"} |
            corners: {preserveCorners ? "on" : "off"} | last splits:{" "}
            {lastCornerCount}
          </div>
          <div className="mt-0.5">{timingDisplay}</div>
        </div>
      )}

      {/* Controls: two grouped cards — actions on the left, stroke-processing
          options on the right. No dead gaps inside a group. */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-3">
        {/* THE ACTIONS.
            Undo and Redo are a pair and are grouped as one; Clear is separated
            by a rule because it is the destructive one and it sat flush against
            Undo, which is how a mis-click destroys a drawing.

            Each button NAMES what it will do — "Undo Delete fusion" rather than
            "Undo last stroke", which was the old tooltip and was a lie the
            moment ⌘Z reached anything but a stroke. */}
        <div className="flex items-center gap-1 rounded-xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={canUndo ? `Undo ${undoLabel} (⌘Z)` : "Nothing to undo (⌘Z)"}
            className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title={canRedo ? `Redo ${redoLabel} (⇧⌘Z)` : "Nothing to redo (⇧⌘Z)"}
            className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Redo
          </button>
          <div className="mx-1 h-5 w-px bg-border" />
          <button
            type="button"
            onClick={onClear}
            disabled={rawStrokes.length === 0}
            title="Clear all strokes. ⌘Z brings them back."
            className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => onSettingsChange({ smoothing: !smoothing })}
            aria-pressed={smoothing}
            title="Smooth the stroke path"
            className={`fs-press rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              smoothing
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Smoothing
          </button>
          <button
            type="button"
            onClick={() => onSettingsChange({ preserveCorners: !preserveCorners })}
            disabled={!smoothing}
            aria-pressed={preserveCorners}
            title="Keep sharp corners sharp while smoothing"
            className={`fs-press rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              preserveCorners
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            Corners
          </button>
          <div className="mx-1 h-5 w-px bg-border" />
          <label
            className="flex items-center gap-2 pr-2 text-xs text-muted-foreground"
            title="Distance between resampled points. Smaller keeps more detail."
          >
            <span className="select-none pl-1 font-medium">Spacing</span>
            <input
              type="range"
              min={2}
              max={8}
              step={1}
              value={spacing}
              onChange={(e) =>
                onSettingsChange({ spacing: Number(e.target.value) }, { coalesceKey: "canvas:spacing" })
              }
              onPointerUp={() => commitReprocess("spacing-commit")}
              className="fs-slider w-20"
            />
            <span className="w-8 select-none text-[11px] tabular-nums">
              {spacing} px
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
