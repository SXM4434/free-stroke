"use client"

import { useState, useRef } from "react"
import Viewport3DWrapper from "@/components/viewport-3d-wrapper"
import DrawingCanvas, { type ExportSettings } from "@/components/drawing-canvas"
import type { Stroke, ProcessedStroke } from "@/lib/stroke-processing"
import {
  type GeometryMode,
  type ExtrudeParams,
  type SolidParams,
  DEFAULT_EXTRUDE_PARAMS,
  DEFAULT_SOLID_PARAMS,
  EXTRUDE_WIDTH_MIN,
  EXTRUDE_WIDTH_MAX,
  EXTRUDE_WIDTH_STEP,
  EXTRUDE_DEPTH_MULTIPLIER_MIN,
  EXTRUDE_DEPTH_MULTIPLIER_MAX,
  EXTRUDE_DEPTH_MULTIPLIER_STEP,
  SOLID_THICKNESS_SLIDER_MIN,
  SOLID_THICKNESS_SLIDER_MAX,
  SOLID_THICKNESS_SLIDER_STEP,
  SOLID_DEPTH_SLIDER_MIN,
  SOLID_DEPTH_SLIDER_MAX,
  SOLID_DEPTH_SLIDER_STEP,
} from "@/lib/geometry-engines"

const GEOMETRY_MODES: { value: GeometryMode; label: string; disabled: boolean; tooltip?: string }[] = [
  { value: "rod", label: "Rod", disabled: false },
  { value: "extrude", label: "Extrude", disabled: false },
  { value: "solid", label: "Solid", disabled: false },
  { value: "inflate", label: "Inflate", disabled: true, tooltip: "Coming soon" },
]

export default function Home() {
  const [rawStrokes, setRawStrokes] = useState<Stroke[]>([])
  const [processedStrokes, setProcessedStrokes] = useState<ProcessedStroke[]>(
    []
  )
  const [geometryMode, setGeometryMode] = useState<GeometryMode>("rod")
  const [extrudeParams, setExtrudeParams] = useState<ExtrudeParams>(DEFAULT_EXTRUDE_PARAMS)
  const [solidParams, setSolidParams] = useState<SolidParams>(DEFAULT_SOLID_PARAMS)
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

      {/* Extrude mode controls */}
      {geometryMode === "extrude" && (
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border bg-muted/30 px-4">
          {/* Width */}
          {/* Width — slider value is a half-width in world units. Range
              is calibrated so the practical span keeps the segmented
              fallback usable; the engine additionally clamps the effective
              width into a safe envelope (see computeEffectiveWidth). */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="select-none font-medium">Width</span>
            <input
              type="range"
              min={EXTRUDE_WIDTH_MIN}
              max={EXTRUDE_WIDTH_MAX}
              step={EXTRUDE_WIDTH_STEP}
              value={extrudeParams.width}
              onChange={(e) => setExtrudeParams((p) => ({ ...p, width: Number(e.target.value) }))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            />
            <span className="w-8 select-none font-mono text-[10px]">
              {extrudeParams.width.toFixed(3)}
            </span>
          </label>

          <div className="h-4 w-px bg-border" />

          {/* Depth — slider value is a width-relative MULTIPLIER (effective
              depth = multiplier × width, clamped). See computeEffectiveExtrudeDepth. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="select-none font-medium">Depth</span>
            <input
              type="range"
              min={EXTRUDE_DEPTH_MULTIPLIER_MIN}
              max={EXTRUDE_DEPTH_MULTIPLIER_MAX}
              step={EXTRUDE_DEPTH_MULTIPLIER_STEP}
              value={extrudeParams.depth}
              onChange={(e) => setExtrudeParams((p) => ({ ...p, depth: Number(e.target.value) }))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            />
            <span className="w-10 select-none font-mono text-[10px]">
              {extrudeParams.depth.toFixed(2)}×
            </span>
          </label>

          <div className="h-4 w-px bg-border" />

          {/* Bevel toggle */}
          <button
            onClick={() => setExtrudeParams((p) => ({ ...p, bevelEnabled: !p.bevelEnabled }))}
            className={`rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              extrudeParams.bevelEnabled
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border bg-background text-muted-foreground hover:text-foreground"
            }`}
          >
            Bevel
          </button>
        </div>
      )}

      {/* Solid mode controls */}
      {geometryMode === "solid" && (
        <div className="flex h-10 shrink-0 items-center gap-4 border-b border-border bg-muted/30 px-4">
          {/* Thickness — slider value is RAW px. The SolidEngine applies a
              nonlinear calibration (see computeSolidEffectiveThicknessPx)
              before feeding the value to canvas lineWidth + H3 walls, so
              the breaking territory lives in the upper end of the slider
              instead of the middle. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="select-none font-medium">Thickness</span>
            <input
              type="range"
              min={SOLID_THICKNESS_SLIDER_MIN}
              max={SOLID_THICKNESS_SLIDER_MAX}
              step={SOLID_THICKNESS_SLIDER_STEP}
              value={solidParams.thickness}
              onChange={(e) => setSolidParams((p) => ({ ...p, thickness: Number(e.target.value) }))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            />
            <span className="w-8 select-none font-mono text-[10px]">
              {solidParams.thickness}px
            </span>
          </label>

          <div className="h-4 w-px bg-border" />

          {/* Depth — slider value is RAW world depth. Calibrated through
              computeSolidEffectiveDepth before being used as the H3 Z extent. */}
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="select-none font-medium">Depth</span>
            <input
              type="range"
              min={SOLID_DEPTH_SLIDER_MIN}
              max={SOLID_DEPTH_SLIDER_MAX}
              step={SOLID_DEPTH_SLIDER_STEP}
              value={solidParams.depth}
              onChange={(e) => setSolidParams((p) => ({ ...p, depth: Number(e.target.value) }))}
              className="h-1 w-20 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            />
            <span className="w-8 select-none font-mono text-[10px]">
              {solidParams.depth.toFixed(2)}
            </span>
          </label>
        </div>
      )}

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
          <Viewport3DWrapper processedStrokes={processedStrokes} rawStrokes={rawStrokes} geometryMode={geometryMode} extrudeParams={geometryMode === "extrude" ? extrudeParams : undefined} solidParams={geometryMode === "solid" ? solidParams : undefined} settingsRef={settingsRef} />
        </div>
      </div>
    </div>
  )
}
