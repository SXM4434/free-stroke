"use client"

import dynamic from "next/dynamic"

const Viewport3D = dynamic(() => import("@/components/viewport-3d"), {
  ssr: false,
})

export default function Viewport3DWrapper() {
  return <Viewport3D />
}
