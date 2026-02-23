import Viewport3DWrapper from "@/components/viewport-3d-wrapper"
import DrawingCanvas from "@/components/drawing-canvas"

export default function Home() {
  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center justify-center border-b border-border">
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          Free Stroke
        </h1>
      </header>

      {/* Two-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: drawing canvas */}
        <div className="relative flex-1 border-r border-border">
          <DrawingCanvas />
        </div>

        {/* Right column: 3D viewport */}
        <div className="flex-1">
          <Viewport3DWrapper />
        </div>
      </div>
    </div>
  )
}
