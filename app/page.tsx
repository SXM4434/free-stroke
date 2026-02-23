"use client"

import { useState, useRef } from "react"
import Viewport3DWrapper from "@/components/viewport-3d-wrapper"
import DrawingCanvas, { type ExportSettings } from "@/components/drawing-canvas"
import type { Stroke, ProcessedStroke } from "@/lib/stroke-processing"
import type { GeometryMode } from "@/lib/geometry-engines"

const GEOMETRY_MODES: { value: GeometryMode; label: string; disabled: boolean; tooltip?: string }[] = [
  { value: "rod", label: "Rod", disabled: false },
  { value: "extrude", label: "Extrude", disabled: true, tooltip: "Coming soon" },
  { value: "inflate", label: "Inflate", disabled: true, tooltip: "Coming soon" },
]

export default function Home() {
  const [rawStrokes, setRawStrokes] = useState<Stroke[]>([])
  const [processedStrokes, setProcessedStrokes] = useState<ProcessedStroke[]>(
    []
  )
  const [geometryMode, setGeometryMode] = useState<GeometryMode>("rod")
  const settingsRef = useRef<ExportSettings>({
    spacing: 4,
    smoothing: true,
    preserveCorners: true,
  })

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-4">
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          Free Stroke
        </h1>

        {/* Geometry mode selector */}
        <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
          {GEOMETRY_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => !mode.disabled && setGeometryMode(mode.value)}
              disabled={mode.disabled}
              title={mode.tooltip}
              className={`relative rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                geometryMode === mode.value
                  ? "bg-background text-foreground shadow-sm"
                  : mode.disabled
                    ? "cursor-not-allowed text-muted-foreground/40"
                    : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode.label}
              {mode.disabled && (
                <span className="ml-1 text-[9px] font-normal opacity-60">
                  soon
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="w-[70px]" />
      </header>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: drawing canvas */}
        <div className="relative flex-1 border-r border-border">
          <DrawingCanvas
            rawStrokes={rawStrokes}
            setRawStrokes={setRawStrokes}
            processedStrokes={processedStrokes}
            setProcessedStrokes={setProcessedStrokes}
            settingsRef={settingsRef}
          />
        </div>

        {/* Right column: 3D viewport */}
        <div className="flex-1">
          <Viewport3DWrapper processedStrokes={processedStrokes} rawStrokes={rawStrokes} geometryMode={geometryMode} settingsRef={settingsRef} />
        </div>
      </div>
    </div>
  )
}
