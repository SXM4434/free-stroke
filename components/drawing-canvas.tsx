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
  
  // TEMP: Debug stroke state
  useEffect(() => {
    console.log("[v0] DrawingCanvas: rawStrokes=" + rawStrokes.length + ", processedStrokes=" + processedStrokes.length + ", renderStrokes=" + renderStrokes.length + ", smoothing=" + smoothing)
  }, [rawStrokes.length, processedStrokes.length, renderStrokes.length, smoothing])

  /* ---- resize canvas to fill container ---- */
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
    })

    ro.observe(container)
    return () => ro.disconnect()
  }, [])

  /* ---- full redraw from strokes (instrumented) ---- */
  const redraw = useCallback(
    (extraPoints?: Point[]) => {
      const canvas = canvasRef.current
      if (!canvas) {
        console.log("[v0] redraw: canvas is null")
        return
      }
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        console.log("[v0] redraw: ctx is null")
        return
      }

      const t0 = performance.now()

      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const allStrokes = extraPoints
        ? [...renderStrokes, { points: extraPoints }]
        : renderStrokes
      
      // TEMP: Debug
      if (allStrokes.length > 0) {
        console.log("[v0] redraw: drawing " + allStrokes.length + " strokes, canvas=" + canvas.width + "x" + canvas.height)
      }

      for (const stroke of allStrokes) {
        if (stroke.points.length < 2) continue
        ctx.beginPath()
        ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
        }
        ctx.strokeStyle = "#000000"
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
    scheduleRedraw()
  }, [scheduleRedraw])

  /* cleanup rAF on unmount */
  useEffect(() => {
    return () => cancelAnimationFrame(rafIdRef.current)
  }, [])

  /* ---- pointer handlers ---- */
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      canvas.setPointerCapture(e.pointerId)
      isDrawingRef.current = true

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
        className="h-full w-full cursor-crosshair touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />

      {/* Debug info */}
      <div className="pointer-events-none absolute left-3 top-3 select-none font-mono text-[11px] text-muted-foreground">
        <div>
          raw {rawTotalPoints} pts | processed {processedTotalPoints} pts |
          spacing {spacing}px | smoothing: {smoothing ? "on" : "off"} |
          corners: {preserveCorners ? "on" : "off"} | last splits:{" "}
          {lastCornerCount}
        </div>
        <div className="mt-0.5">{timingDisplay}</div>
      </div>

      {/* Controls bar */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3">
        {/* Undo + Clear */}
        <button
          onClick={handleUndo}
          disabled={rawStrokes.length === 0}
          className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Undo
        </button>
        <button
          onClick={handleClear}
          disabled={rawStrokes.length === 0}
          className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          Clear
        </button>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Smoothing toggle */}
        <button
          onClick={() => setSmoothing((v) => !v)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-colors ${
            smoothing
              ? "border-foreground/20 bg-foreground text-background"
              : "border-border bg-background/80 text-foreground hover:bg-accent"
          }`}
        >
          Smoothing
        </button>

        {/* Preserve corners toggle */}
        <button
          onClick={() => setPreserveCorners((v) => !v)}
          disabled={!smoothing}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium backdrop-blur-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
            preserveCorners
              ? "border-foreground/20 bg-foreground text-background"
              : "border-border bg-background/80 text-foreground hover:bg-accent"
          }`}
        >
          Corners
        </button>

        {/* Spacing slider */}
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="select-none">Spacing</span>
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={spacing}
            onChange={(e) => setSpacing(Number(e.target.value))}
            onPointerUp={() => commitReprocess("spacing-commit")}
            className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
          />
          <span className="w-5 select-none font-mono text-[11px]">
            {spacing}
          </span>
        </label>
      </div>
    </div>
  )
}
