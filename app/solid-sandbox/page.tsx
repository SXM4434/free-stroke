"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei"
import * as THREE from "three"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { 
  buildVectorSolid, 
  generateTestStrokes, 
  type VectorSolidResult,
  type VectorSolidDebugStats
} from "@/lib/solid-vector"

const TEST_CANVAS_WIDTH = 600
const TEST_CANVAS_HEIGHT = 600

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debouncedValue
}

// Convert world coords to canvas coords for rendering
function worldToCanvas(wx: number, wy: number): { x: number; y: number } {
  const scaleRef = Math.max(TEST_CANVAS_WIDTH, TEST_CANVAS_HEIGHT)
  const normScale = 3 / scaleRef
  return {
    x: wx / normScale + TEST_CANVAS_WIDTH / 2,
    y: -wy / normScale + TEST_CANVAS_HEIGHT / 2
  }
}

// 2D Canvas showing all stages: centerline, expanded outlines before union, post-union polygon
function StrokePreview2D({ 
  stroke, 
  result,
  showPreUnion
}: { 
  stroke: { x: number; y: number }[]
  result: VectorSolidResult
  showPreUnion: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const width = canvas.width
    const height = canvas.height
    
    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = "#0f0f1a"
    ctx.fillRect(0, 0, width, height)

    // Scale to fit
    const scale = Math.min(width, height) / TEST_CANVAS_WIDTH * 0.85
    const offsetX = (width - TEST_CANVAS_WIDTH * scale) / 2
    const offsetY = (height - TEST_CANVAS_HEIGHT * scale) / 2

    const toCanvasX = (x: number) => offsetX + x * scale
    const toCanvasY = (y: number) => offsetY + y * scale

    // 1. Draw expanded outlines BEFORE union (yellow, dashed)
    if (showPreUnion && result.expandedOutlines.length > 0) {
      ctx.strokeStyle = "#fbbf24"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      
      for (const outline of result.expandedOutlines) {
        if (outline.length < 3) continue
        ctx.beginPath()
        const first = worldToCanvas(outline[0].x, outline[0].y)
        ctx.moveTo(toCanvasX(first.x), toCanvasY(first.y))
        for (let i = 1; i < outline.length; i++) {
          const pt = worldToCanvas(outline[i].x, outline[i].y)
          ctx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y))
        }
        ctx.closePath()
        ctx.stroke()
      }
      ctx.setLineDash([])
    }

    // 2. Draw POST-UNION filled polygon (blue fill, solid stroke)
    if (result.polygons.length > 0) {
      for (const poly of result.polygons) {
        // Fill outer
        ctx.fillStyle = "rgba(59, 130, 246, 0.4)"
        ctx.strokeStyle = "#3b82f6"
        ctx.lineWidth = 2

        if (poly.outer.length > 0) {
          ctx.beginPath()
          const first = worldToCanvas(poly.outer[0].x, poly.outer[0].y)
          ctx.moveTo(toCanvasX(first.x), toCanvasY(first.y))
          for (let i = 1; i < poly.outer.length; i++) {
            const pt = worldToCanvas(poly.outer[i].x, poly.outer[i].y)
            ctx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y))
          }
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
        }

        // Cut out holes (draw with background color)
        ctx.fillStyle = "#0f0f1a"
        ctx.strokeStyle = "#f97316"
        ctx.lineWidth = 1.5
        for (const hole of poly.holes) {
          if (hole.length < 3) continue
          ctx.beginPath()
          const first = worldToCanvas(hole[0].x, hole[0].y)
          ctx.moveTo(toCanvasX(first.x), toCanvasY(first.y))
          for (let i = 1; i < hole.length; i++) {
            const pt = worldToCanvas(hole[i].x, hole[i].y)
            ctx.lineTo(toCanvasX(pt.x), toCanvasY(pt.y))
          }
          ctx.closePath()
          ctx.fill()
          ctx.stroke()
        }
      }
    }

    // 3. Draw source stroke centerline (red dashed)
    ctx.strokeStyle = "#ef4444"
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    if (stroke.length > 0) {
      ctx.moveTo(toCanvasX(stroke[0].x), toCanvasY(stroke[0].y))
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(toCanvasX(stroke[i].x), toCanvasY(stroke[i].y))
      }
    }
    ctx.stroke()
    ctx.setLineDash([])

    // 4. Draw stroke points
    ctx.fillStyle = "#ef4444"
    for (const p of stroke) {
      ctx.beginPath()
      ctx.arc(toCanvasX(p.x), toCanvasY(p.y), 3, 0, Math.PI * 2)
      ctx.fill()
    }

    // Legend
    ctx.font = "11px system-ui, sans-serif"
    ctx.fillStyle = "#ef4444"
    ctx.fillText("--- Centerline", 8, 16)
    if (showPreUnion) {
      ctx.fillStyle = "#fbbf24"
      ctx.fillText("--- Pre-Union Outline", 8, 30)
    }
    ctx.fillStyle = "#3b82f6"
    ctx.fillText("Filled Polygon", 8, showPreUnion ? 44 : 30)
    ctx.fillStyle = "#f97316"
    ctx.fillText("Holes", 8, showPreUnion ? 58 : 44)

  }, [stroke, result, showPreUnion])

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={320}
      className="rounded-lg border border-border"
    />
  )
}

// 3D View for the extruded result
function ExtrudedMesh3D({ result }: { result: VectorSolidResult }) {
  if (!result.geometry) {
    return (
      <mesh>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="#ef4444" wireframe />
      </mesh>
    )
  }

  return (
    <mesh geometry={result.geometry}>
      <meshStandardMaterial 
        color="#3b82f6" 
        metalness={0.1} 
        roughness={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Debug stats display
function DebugStats({ stats, success }: { stats: VectorSolidDebugStats; success: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono">
      <div className="text-muted-foreground">Input points:</div>
      <div>{stats.inputPointCount}</div>
      <div className="text-muted-foreground">Expanded outline pts:</div>
      <div>{stats.expandedOutlineCount}</div>
      <div className="text-muted-foreground">Polygons before union:</div>
      <div>{stats.polygonCountBeforeUnion}</div>
      <div className="text-muted-foreground">Polygons after union:</div>
      <div className={stats.polygonCountAfterUnion === 1 ? "text-green-500" : "text-yellow-500"}>
        {stats.polygonCountAfterUnion}
      </div>
      <div className="text-muted-foreground">Holes:</div>
      <div>{stats.holeCount}</div>
      <div className="text-muted-foreground">Rebuild time:</div>
      <div>{stats.rebuildTimeMs.toFixed(1)} ms</div>
    </div>
  )
}

// Single test case card
function TestCaseCard({
  name,
  description,
  stroke,
  thickness,
  depth,
  showPreUnion
}: {
  name: string
  description: string
  stroke: { points: { x: number; y: number }[]; cornerCount: number }
  thickness: number
  depth: number
  showPreUnion: boolean
}) {
  const result = useMemo(() => {
    return buildVectorSolid(
      [stroke],
      TEST_CANVAS_WIDTH,
      TEST_CANVAS_HEIGHT,
      thickness,
      depth
    )
  }, [stroke, thickness, depth])

  // Determine pass/fail criteria
  const isPassing = result.success && 
    result.stats.polygonCountAfterUnion === 1 && 
    result.stats.rebuildTimeMs < 100

  return (
    <Card className={`w-full ${isPassing ? "border-green-500/50" : "border-yellow-500/50"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{name}</CardTitle>
          <Badge variant={isPassing ? "default" : "secondary"} className={isPassing ? "bg-green-600" : "bg-yellow-600"}>
            {isPassing ? "PASS" : "CHECK"}
          </Badge>
        </div>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 flex-wrap justify-center">
          {/* 2D Source + Expanded + Union */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs font-medium text-muted-foreground">2D Pipeline Stages</div>
            <StrokePreview2D
              stroke={stroke.points}
              result={result}
              showPreUnion={showPreUnion}
            />
          </div>

          {/* 3D Extruded Result */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-xs font-medium text-muted-foreground">3D Extruded Result</div>
            <div className="w-[320px] h-[320px] rounded-lg border border-border bg-background">
              <Canvas>
                <PerspectiveCamera makeDefault position={[0, 0, 4]} />
                <OrbitControls enablePan={false} />
                <ambientLight intensity={0.5} />
                <directionalLight position={[5, 5, 5]} intensity={1} />
                <ExtrudedMesh3D result={result} />
                <gridHelper args={[4, 20, "#333", "#222"]} rotation={[Math.PI / 2, 0, 0]} />
              </Canvas>
            </div>
          </div>
        </div>

        {/* Debug Stats */}
        <div className="flex items-start justify-between gap-4 pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${result.success ? "text-green-500" : "text-red-500"}`}>
              {result.success ? "SUCCESS" : "FAILED"}
            </span>
            {result.error && <span className="text-xs text-red-400">({result.error})</span>}
          </div>
          <DebugStats stats={result.stats} success={result.success} />
        </div>
      </CardContent>
    </Card>
  )
}

export default function SolidSandboxPage() {
  const [thickness, setThickness] = useState(0.15)
  const [depth, setDepth] = useState(0.3)
  const [showPreUnion, setShowPreUnion] = useState(true)

  // Debounce thickness and depth to prevent rebuild spam
  const debouncedThickness = useDebounce(thickness, 50)
  const debouncedDepth = useDebounce(depth, 50)

  const testCases = useMemo(() => generateTestStrokes(), [])

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold">Vector Solid Mode Sandbox</h1>
          <p className="text-sm text-muted-foreground">
            Testing vector-based Solid pipeline with polygon-clipping union
          </p>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-medium">Thickness</label>
                  <span className="text-muted-foreground font-mono">{thickness.toFixed(3)}</span>
                </div>
                <Slider
                  value={[thickness]}
                  onValueChange={([v]) => setThickness(v)}
                  min={0.02}
                  max={0.5}
                  step={0.005}
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <label className="font-medium">Depth</label>
                  <span className="text-muted-foreground font-mono">{depth.toFixed(3)}</span>
                </div>
                <Slider
                  value={[depth]}
                  onValueChange={([v]) => setDepth(v)}
                  min={0.05}
                  max={1.0}
                  step={0.01}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id="showPreUnion" 
                checked={showPreUnion}
                onChange={(e) => setShowPreUnion(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="showPreUnion" className="text-sm">
                Show pre-union outline (yellow dashed)
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Test Cases */}
        <div className="grid gap-6">
          {testCases.map((tc, i) => (
            <TestCaseCard
              key={i}
              name={tc.name}
              description={tc.description}
              stroke={tc.stroke}
              thickness={debouncedThickness}
              depth={debouncedDepth}
              showPreUnion={showPreUnion}
            />
          ))}
        </div>

        {/* Implementation Notes */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Implementation Details</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p><strong>Library:</strong> polygon-clipping (pure JavaScript)</p>
            <p><strong>Expansion:</strong> Manual polyline offset with round caps and joins</p>
            <p><strong>Union:</strong> polygon-clipping union operation</p>
            <p><strong>Pass Criteria:</strong> 1 polygon after union, no artifacts, rebuild time under 100ms</p>
            <p><strong>Winding:</strong> CCW for outer boundary, CW for holes (THREE.js requirement)</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
