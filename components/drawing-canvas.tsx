"use client"

import { useRef, useState, useCallback, useEffect } from "react"

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
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const isDrawingRef = useRef(false)
  const currentPointsRef = useRef<Point[]>([])

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
        ? [...strokes, { points: extraPoints }]
        : strokes

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
    [strokes]
  )

  /* redraw whenever strokes change */
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
      setStrokes((prev) => [...prev, { points: [...points] }])
    }
    currentPointsRef.current = []
  }, [])

  /* ---- undo / clear ---- */
  const handleUndo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1))
  }, [])

  const handleClear = useCallback(() => {
    setStrokes([])
  }, [])

  /* ---- debug counts ---- */
  const totalPoints = strokes.reduce((sum, s) => sum + s.points.length, 0)

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
      <div className="pointer-events-none absolute left-3 top-3 select-none text-[11px] font-mono text-muted-foreground">
        {strokes.length} strokes / {totalPoints} pts
      </div>

      {/* Undo + Clear buttons */}
      <div className="absolute bottom-3 left-3 flex gap-2">
        <button
          onClick={handleUndo}
          disabled={strokes.length === 0}
          className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Undo
        </button>
        <button
          onClick={handleClear}
          disabled={strokes.length === 0}
          className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
