"use client"

import { useRef, useState, useCallback, useEffect, useMemo } from "react"
import { processAllStrokes } from "@/lib/stroke-processing"

interface Point {
  x: number
  y: number
  t: number
  pressure?: number
}

interface Stroke {
  points: Point[]
}

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [rawStrokes, setRawStrokes] = useState<Stroke[]>([])
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<Point[]>([])

  /* ---- processing controls ---- */
  const [smoothing, setSmoothing] = useState(true)
  const [spacing, setSpacing] = useState(4)

  /* ---- derive processed strokes ---- */
  const processedStrokes = useMemo(
    () => processAllStrokes(rawStrokes, spacing, smoothing),
    [rawStrokes, spacing, smoothing]
  )

  /* which strokes to render (processed when smoothing on, raw when off) */
  const renderStrokes = smoothing ? processedStrokes : rawStrokes

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

  /* ---- full redraw from strokes ---- */
  const redraw = useCallback(
    (extraPoints?: Point[]) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext("2d")
      if (!ctx) return

      const dpr = window.devicePixelRatio || 1
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const allStrokes = extraPoints
        ? [...renderStrokes, { points: extraPoints }]
        : renderStrokes

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
    },
    [renderStrokes]
  )

  /* redraw whenever strokes or processing settings change */
  useEffect(() => {
    redraw()
  }, [redraw])

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
      redraw(currentPointsRef.current)
    },
    [redraw]
  )

  const handlePointerUp = useCallback(() => {
    if (!isDrawingRef.current) return
    isDrawingRef.current = false

    const points = currentPointsRef.current
    if (points.length >= 2) {
      setRawStrokes((prev) => [...prev, { points: [...points] }])
    }
    currentPointsRef.current = []
  }, [])

  /* ---- undo / clear ---- */
  const handleUndo = useCallback(() => {
    setRawStrokes((prev) => prev.slice(0, -1))
  }, [])

  const handleClear = useCallback(() => {
    setRawStrokes([])
  }, [])

  /* ---- debug counts ---- */
  const rawTotalPoints = rawStrokes.reduce((sum, s) => sum + s.points.length, 0)
  const processedTotalPoints = processedStrokes.reduce(
    (sum, s) => sum + s.points.length,
    0
  )

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
        raw {rawTotalPoints} pts | processed {processedTotalPoints} pts |
        spacing {spacing}px | smoothing {smoothing ? "on" : "off"}
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
