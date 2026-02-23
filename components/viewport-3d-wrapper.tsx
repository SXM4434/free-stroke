"use client"

import dynamic from "next/dynamic"
import type { ProcessedStroke } from "@/lib/stroke-processing"
import type { ExportSettings } from "@/components/drawing-canvas"

const Viewport3D = dynamic(() => import("@/components/viewport-3d"), {
  ssr: false,
})

interface Viewport3DWrapperProps {
  processedStrokes: ProcessedStroke[]
  settingsRef: React.MutableRefObject<ExportSettings>
}

export default function Viewport3DWrapper({
  processedStrokes,
  settingsRef,
}: Viewport3DWrapperProps) {
  return <Viewport3D processedStrokes={processedStrokes} settingsRef={settingsRef} />
}
