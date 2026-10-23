"use client"

import {
  useRef,
  useState,
  useCallback,
  useEffect,
  type Dispatch,
  type SetStateAction,
} from "react"
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

interface DrawingCanvasProps {
  rawStrokes: Stroke[]
  setRawStrokes: Dispatch<SetStateAction<Stroke[]>>
  processedStrokes: ProcessedStroke[]
  setProcessedStrokes: Dispatch<SetStateAction<ProcessedStroke[]>>
  settingsRef: React.MutableRefObject<ExportSettings>
}

export default function DrawingCanvas({
  rawStrokes,
  setRawStrokes,
  processedStrokes,
  setProcessedStrokes,
  settingsRef,
}: DrawingCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<Point[]>([])
  // Mirrors isDrawingRef for the empty-state hint only (the hot pointer path
  // keeps using the ref so drawing never waits on a React render).
  const [isDrawing, setIsDrawing] = useState(false)

  /* ---- processing controls ---- */
  const [smoothing, setSmoothing] = useState(true)
  const [spacing, setSpacing] = useState(4)
  const [preserveCorners, setPreserveCorners] = useState(true)

  /* ---- refs for current settings (so callbacks read fresh values) ---- */
  const smoothingRef = useRef(smoothing)
  const spacingRef = useRef(spacing)
  const preserveCornersRef = useRef(preserveCorners)
  const rawStrokesRef = useRef(rawStrokes)

  useEffect(() => {
    smoothingRef.current = smoothing
    settingsRef.current = { ...settingsRef.current, smoothing }
  }, [smoothing, settingsRef])
  useEffect(() => {
    spacingRef.current = spacing
    settingsRef.current = { ...settingsRef.current, spacing }
  }, [spacing, settingsRef])
  useEffect(() => {
    preserveCornersRef.current = preserveCorners
    settingsRef.current = { ...settingsRef.current, preserveCorners }
  }, [preserveCorners, settingsRef])
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
    "draw: 0ms | procOne: 0ms | procAll: 0ms | callsAll: 0 | lastTrigger: none"
  )
  const processingRef = useRef(false)

  const updateTimingDisplay = useCallback(() => {
    const t = timingRef.current
    setTimingDisplay(
      `draw: ${t.drawMs.toFixed(1)}ms | procOne: ${t.procOneMs.toFixed(1)}ms | procAll: ${t.procAllMs.toFixed(1)}ms | callsAll: ${t.callsAll} | lastTrigger: ${t.lastTrigger}`
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

      setProcessedStrokes(result)
      processingRef.current = false
      updateTimingDisplay()
    },
    [setProcessedStrokes, updateTimingDisplay]
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

      setRawStrokes((prev) => [...prev, newRaw])
      setProcessedStrokes((prev) => [...prev, newProcessed])
      updateTimingDisplay()
    }
    currentPointsRef.current = []
  }, [setRawStrokes, setProcessedStrokes, updateTimingDisplay])

  /* ---- undo / clear ---- */
  const handleUndo = useCallback(() => {
    setRawStrokes((prev) => prev.slice(0, -1))
    setProcessedStrokes((prev) => prev.slice(0, -1))
  }, [setRawStrokes, setProcessedStrokes])

  const handleClear = useCallback(() => {
    setRawStrokes([])
    setProcessedStrokes([])
  }, [setRawStrokes, setProcessedStrokes])

  /* ⌘Z / Ctrl+Z removes the last stroke. Keyboard-initiated, so it is
   * deliberately NOT animated (emil: never animate keyboard actions). */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if (e.key.toLowerCase() !== "z") return
      const t = e.target as HTMLElement | null
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "SELECT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return
      e.preventDefault()
      handleUndo()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleUndo])

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
        aria-label="Drawing canvas — draw a stroke here to create 3D geometry"
        className="h-full w-full cursor-crosshair touch-none text-foreground"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
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

      {/* Debug info (development-only telemetry; hidden in demo/production build) */}
      {process.env.NODE_ENV === "development" && (
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
        <div className="flex items-center gap-1 rounded-xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={handleUndo}
            disabled={rawStrokes.length === 0}
            title="Undo last stroke (⌘Z)"
            className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Undo
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={rawStrokes.length === 0}
            title="Clear all strokes"
            className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
          >
            Clear
          </button>
        </div>

        <div className="flex items-center gap-1 rounded-xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setSmoothing((v) => !v)}
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
            onClick={() => setPreserveCorners((v) => !v)}
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
            title="Distance between resampled points — smaller keeps more detail"
          >
            <span className="select-none pl-1 font-medium">Spacing</span>
            <input
              type="range"
              min={2}
              max={8}
              step={1}
              value={spacing}
              onChange={(e) => setSpacing(Number(e.target.value))}
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
