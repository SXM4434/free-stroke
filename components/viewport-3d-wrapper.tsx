"use client"

import dynamic from "next/dynamic"
import type { Stroke, ProcessedStroke } from "@/lib/stroke-processing"
import type { ExportSettings } from "@/components/drawing-canvas"
import type { GeometryMode, ExtrudeParams, SolidParams } from "@/lib/geometry-engines"
import type { StyleState } from "@/lib/style-system"

const Viewport3D = dynamic(() => import("@/components/viewport-3d"), {
  ssr: false,
})

interface Viewport3DWrapperProps {
  processedStrokes: ProcessedStroke[]
  rawStrokes: Stroke[]
  geometryMode: GeometryMode
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
  styleState?: StyleState
  settingsRef: React.MutableRefObject<ExportSettings>
}

export default function Viewport3DWrapper({
  processedStrokes,
  rawStrokes,
  geometryMode,
  extrudeParams,
  solidParams,
  styleState,
  settingsRef,
}: Viewport3DWrapperProps) {
  return (
    <Viewport3D
      processedStrokes={processedStrokes}
      rawStrokes={rawStrokes}
      geometryMode={geometryMode}
      extrudeParams={extrudeParams}
      solidParams={solidParams}
      styleState={styleState}
      settingsRef={settingsRef}
    />
  )
}
