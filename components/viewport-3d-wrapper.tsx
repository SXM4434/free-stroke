"use client"

import dynamic from "next/dynamic"
import type { ProcessedStroke } from "@/lib/stroke-processing"

const Viewport3D = dynamic(() => import("@/components/viewport-3d"), {
  ssr: false,
})

interface Viewport3DWrapperProps {
  processedStrokes: ProcessedStroke[]
}

export default function Viewport3DWrapper({
  processedStrokes,
}: Viewport3DWrapperProps) {
  return <Viewport3D processedStrokes={processedStrokes} />
}
