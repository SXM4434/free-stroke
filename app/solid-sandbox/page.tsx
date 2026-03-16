"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Environment } from "@react-three/drei"
import * as THREE from "three"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { buildVectorSolid, generateTestStrokes, type VectorSolidResult } from "@/lib/solid-vector"

const TEST_CANVAS_WIDTH = 600
const TEST_CANVAS_HEIGHT = 600

// 2D Canvas to show source stroke and expanded polygon
function StrokePreview2D({ 
  stroke, 
  result, 
  thickness 
}: { 
  stroke: { x: number; y: number }[]
  result: VectorSolidResult
  thickness: number 
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
    ctx.fillStyle = "#1a1a2e"
    ctx.fillRect(0, 0, width, height)

    // Scale to fit
    const scale = Math.min(width, height) / TEST_CANVAS_WIDTH * 0.8
    const offsetX = (width - TEST_CANVAS_WIDTH * scale) / 2
    const offsetY = (height - TEST_CANVAS_HEIGHT * scale) / 2

    const toCanvasX = (x: number) => offsetX + x * scale
    const toCanvasY = (y: number) => offsetY + y * scale

    // Draw expanded polygon (filled)
    if (result.polygons.length > 0) {
      const scaleRef = Math.max(TEST_CANVAS_WIDTH, TEST_CANVAS_HEIGHT)
      const normScale = 3 / scaleRef
      
      ctx.fillStyle = "rgba(59, 130, 246, 0.3)"
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 2

      for (const poly of result.polygons) {
        ctx.beginPath()
        const outer = poly.outer
        if (outer.length > 0) {
          // Convert back from world coords to canvas coords
          const firstX = outer[0].x / normScale + TEST_CANVAS_WIDTH / 2
          const firstY = -outer[0].y / normScale + TEST_CANVAS_HEIGHT / 2
          ctx.moveTo(toCanvasX(firstX), toCanvasY(firstY))
          
          for (let i = 1; i < outer.length; i++) {
            const px = outer[i].x / normScale + TEST_CANVAS_WIDTH / 2
            const py = -outer[i].y / normScale + TEST_CANVAS_HEIGHT / 2
            ctx.lineTo(toCanvasX(px), toCanvasY(py))
          }
          ctx.closePath()
        }
        ctx.fill()
        ctx.stroke()

        // Draw holes
        ctx.fillStyle = "#1a1a2e"
        for (const hole of poly.holes) {
          ctx.beginPath()
          if (hole.length > 0) {
            const firstX = hole[0].x / normScale + TEST_CANVAS_WIDTH / 2
            const firstY = -hole[0].y / normScale + TEST_CANVAS_HEIGHT / 2
            ctx.moveTo(toCanvasX(firstX), toCanvasY(firstY))
            
            for (let i = 1; i < hole.length; i++) {
              const px = hole[i].x / normScale + TEST_CANVAS_WIDTH / 2
              const py = -hole[i].y / normScale + TEST_CANVAS_HEIGHT / 2
              ctx.lineTo(toCanvasX(px), toCanvasY(py))
            }
            ctx.closePath()
          }
          ctx.fill()
        }
      }
    }

    // Draw source stroke (centerline)
    ctx.strokeStyle = "#ef4444"
    ctx.lineWidth = 3
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    if (stroke.length > 0) {
      ctx.moveTo(toCanvasX(stroke[0].x), toCanvasY(stroke[0].y))
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(toCanvasX(stroke[i].x), toCanvasY(stroke[i].y))
      }
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Draw stroke points
    ctx.fillStyle = "#ef4444"
    for (const p of stroke) {
      ctx.beginPath()
      ctx.arc(toCanvasX(p.x), toCanvasY(p.y), 4, 0, Math.PI * 2)
      ctx.fill()
    }

    // Legend
    ctx.font = "12px monospace"
    ctx.fillStyle = "#ef4444"
    ctx.fillText("--- Source Stroke", 10, 20)
    ctx.fillStyle = "#3b82f6"
    ctx.fillText("■ Expanded Polygon", 10, 36)

  }, [stroke, result, thickness])

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={300}
      className="rounded-lg border border-border"
    />
  )
}

// 3D View for the extruded result
function ExtrudedMesh3D({ result }: { result: VectorSolidResult }) {
  const meshRef = useRef<THREE.Mesh>(null)

  if (!result.geometry) {
    return (
      <mesh>
        <boxGeometry args={[0.1, 0.1, 0.1]} />
        <meshStandardMaterial color="red" />
      </mesh>
    )
  }

  return (
    <mesh ref={meshRef} geometry={result.geometry}>
      <meshStandardMaterial 
        color="#3b82f6" 
        metalness={0.1} 
        roughness={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

// Single test case card
function TestCaseCard({
  name,
  description,
  stroke,
  thickness,
  depth
}: {
  name: string
  description: string
  stroke: { points: { x: number; y: number }[]; cornerCount: number }
  thickness: number
  depth: number
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

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 flex-wrap justify-center">
          {/* 2D Source + Expanded */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">2D Source + Expanded</div>
            <StrokePreview2D
              stroke={stroke.points}
              result={result}
              thickness={thickness}
            />
          </div>

          {/* 3D Extruded Result */}
          <div className="flex flex-col items-center gap-2">
            <div className="text-sm font-medium text-muted-foreground">3D Extruded Result</div>
            <div className="w-[300px] h-[300px] rounded-lg border border-border bg-background">
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

        {/* Status */}
        <div className="text-sm">
          <span className={result.success ? "text-green-500" : "text-red-500"}>
            {result.success ? "SUCCESS" : "FAILED"}
          </span>
          {result.error && <span className="text-red-400 ml-2">({result.error})</span>}
          <span className="text-muted-foreground ml-4">
            Polygons: {result.polygons.length}, 
            Outer pts: {result.polygons[0]?.outer.length ?? 0},
            Holes: {result.polygons.reduce((sum, p) => sum + p.holes.length, 0)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SolidSandboxPage() {
  const [thickness, setThickness] = useState(0.15)
  const [depth, setDepth] = useState(0.3)

  const testCases = useMemo(() => generateTestStrokes(), [])

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">Vector Solid Mode Sandbox</h1>
          <p className="text-muted-foreground">
            Testing the new vector-based Solid pipeline with stroke expansion + polygon union
          </p>
        </div>

        {/* Controls */}
        <Card>
          <CardHeader>
            <CardTitle>Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Thickness</label>
                <span className="text-sm text-muted-foreground">{thickness.toFixed(3)}</span>
              </div>
              <Slider
                value={[thickness]}
                onValueChange={([v]) => setThickness(v)}
                min={0.02}
                max={0.5}
                step={0.01}
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <label className="text-sm font-medium">Depth</label>
                <span className="text-sm text-muted-foreground">{depth.toFixed(3)}</span>
              </div>
              <Slider
                value={[depth]}
                onValueChange={([v]) => setDepth(v)}
                min={0.05}
                max={1.0}
                step={0.01}
              />
            </div>
          </CardContent>
        </Card>

        {/* Test Cases */}
        <div className="space-y-6">
          {testCases.map((tc, i) => (
            <TestCaseCard
              key={i}
              name={tc.name}
              description={tc.description}
              stroke={tc.stroke}
              thickness={thickness}
              depth={depth}
            />
          ))}
        </div>

        {/* Implementation Notes */}
        <Card>
          <CardHeader>
            <CardTitle>Implementation Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p><strong>Pipeline:</strong> Centerline polyline → Expand by thickness → Union overlaps → Simplify → Extrude</p>
            <p><strong>Library:</strong> Manual polyline expansion with round caps (js-angusj-clipper available for complex union)</p>
            <p><strong>Winding:</strong> CCW for outer boundary, CW for holes (THREE.js requirement)</p>
            <p><strong>MVP Scope:</strong> Single stroke works reliably. Multi-stroke union for overlapping strokes coming next.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
