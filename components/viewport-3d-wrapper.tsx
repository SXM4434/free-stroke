"use client"

import dynamic from "next/dynamic"
import type { Stroke, ProcessedStroke } from "@/lib/stroke-processing"
import type { ExportSettings } from "@/components/drawing-canvas"
import type { GeometryMode, ExtrudeParams, SolidParams } from "@/lib/geometry-engines"

const Viewport3D = dynamic(() => import("@/components/viewport-3d"), {
  ssr: false,
})

interface Viewport3DWrapperProps {
  processedStrokes: ProcessedStroke[]
  rawStrokes: Stroke[]
  geometryMode: GeometryMode
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
  settingsRef: React.MutableRefObject<ExportSettings>
}

export default function Viewport3DWrapper({
  processedStrokes,
  rawStrokes,
  geometryMode,
  extrudeParams,
  solidParams,
  settingsRef,
}: Viewport3DWrapperProps) {
  return (
    <Viewport3D
      processedStrokes={processedStrokes}
      rawStrokes={rawStrokes}
      geometryMode={geometryMode}
      extrudeParams={extrudeParams}
      solidParams={solidParams}
      settingsRef={settingsRef}
    />
  )
}
