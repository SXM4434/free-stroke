"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { buildMaskSolid, generateTestStrokes, type MaskSolidResult, type MaskSolidStats, type Point2D, type TestStroke } from "@/lib/solid-mask"

export default function SolidSandboxPage() {
  const [thickness, setThickness] = useState(0.15)
  const [depth, setDepth] = useState(0.3)
  
  const testCases = generateTestStrokes()
  
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Solid Mode Sandbox - MASK-FIRST Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Thickness: {thickness.toFixed(2)}</label>
                <Slider
                  value={[thickness]}
                  onValueChange={([v]) => setThickness(v)}
                  min={0.05}
                  max={0.4}
                  step={0.01}
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Depth: {depth.toFixed(2)}</label>
                <Slider
                  value={[depth]}
                  onValueChange={([v]) => setDepth(v)}
                  min={0.1}
                  max={1.0}
                  step={0.05}
                  className="mt-2"
                />
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground">
              Pipeline: Canvas2D render → Binary mask → Connected components → Contour tracing → Simplify → Extrude
            </div>
          </CardContent>
        </Card>
        
        <div className="grid gap-6">
          {testCases.map((tc) => (
            <TestCaseCard
              key={tc.name}
              name={tc.name}
              description={tc.description}
              stroke={tc.stroke}
              thickness={thickness}
              depth={depth}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

interface TestCaseCardProps {
  name: string
  description: string
  stroke: TestStroke
  thickness: number
  depth: number
}

function TestCaseCard({ name, description, stroke, thickness, depth }: TestCaseCardProps) {
  const [result, setResult] = useState<ReturnType<typeof buildMaskSolid> | null>(null)
  
  // Run on client only (canvas requires document)
  useEffect(() => {
    if (typeof document === "undefined") return
    const r = buildMaskSolid(stroke, thickness, depth, 800, 600)
    setResult(r)
  }, [stroke, thickness, depth])
  
  const success = result?.geometry !== null
  const isLoading = result === null
  
  return (
    <Card className={`border-2 ${isLoading ? "border-muted" : success ? "border-green-500/50" : "border-red-500/50"}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{name}</CardTitle>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <Badge variant={isLoading ? "secondary" : success ? "default" : "destructive"}>
            {isLoading ? "Loading..." : success ? "PASS" : "FAIL"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          {/* Stage 1: Centerline */}
          <StageView title="1. Centerline">
            <CenterlineCanvas points={stroke.points} />
          </StageView>
          
          {/* Stage 2: Raster Mask */}
          <StageView title="2. Raster Mask">
            {result ? <MaskCanvas stages={result.stages} /> : <LoadingPlaceholder />}
          </StageView>
          
          {/* Stage 3: Traced Contours */}
          <StageView title="3. Traced Contours">
            {result ? <ContourCanvas stages={result.stages} /> : <LoadingPlaceholder />}
          </StageView>
          
          {/* Stage 4: 3D Extrusion */}
          <StageView title="4. 3D Extrusion">
            <div className="aspect-square bg-muted rounded overflow-hidden">
              {result ? (
                <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
                  <ambientLight intensity={0.5} />
                  <directionalLight position={[5, 5, 5]} intensity={1} />
                  {result.geometry && (
                    <mesh geometry={result.geometry}>
                      <meshStandardMaterial color="#6366f1" side={THREE.DoubleSide} />
                    </mesh>
                  )}
                  <OrbitControls enableZoom={true} enablePan={false} />
                </Canvas>
              ) : <LoadingPlaceholder />}
            </div>
          </StageView>
        </div>
        
        {/* Debug Stats */}
        {result && <DebugStats stats={result.stats} success={success} />}
      </CardContent>
    </Card>
  )
}

function LoadingPlaceholder() {
  return (
    <div className="aspect-square bg-muted rounded flex items-center justify-center text-muted-foreground text-sm">
      Loading...
    </div>
  )
}

function StageView({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1">{title}</div>
      {children}
    </div>
  )
}

function CenterlineCanvas({ points }: { points: Point2D[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    const size = canvas.width
    ctx.clearRect(0, 0, size, size)
    
    // Background
    ctx.fillStyle = "#1e1e2e"
    ctx.fillRect(0, 0, size, size)
    
    if (points.length < 2) return
    
    // Transform: world coords (-1.5, 1.5) to canvas (0, size)
    const toCanvasX = (x: number) => (x + 1.5) / 3 * size
    const toCanvasY = (y: number) => (-y + 1.5) / 3 * size
    
    // Draw centerline
    ctx.strokeStyle = "#ef4444"
    ctx.lineWidth = 2
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(toCanvasX(points[0].x), toCanvasY(points[0].y))
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toCanvasX(points[i].x), toCanvasY(points[i].y))
    }
    ctx.stroke()
    ctx.setLineDash([])
    
    // Draw points
    ctx.fillStyle = "#ef4444"
    for (const p of points) {
      ctx.beginPath()
      ctx.arc(toCanvasX(p.x), toCanvasY(p.y), 2, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [points])
  
  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      className="aspect-square bg-muted rounded w-full"
    />
  )
}

function MaskCanvas({ stages }: { stages: MaskSolidResult["stages"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    const { maskData, maskWidth, maskHeight } = stages
    const size = canvas.width
    
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = "#1e1e2e"
    ctx.fillRect(0, 0, size, size)
    
    if (maskData.length === 0 || maskWidth === 0) return
    
    // Draw mask scaled to canvas
    const imageData = ctx.createImageData(size, size)
    const scaleX = maskWidth / size
    const scaleY = maskHeight / size
    
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const mx = Math.floor(x * scaleX)
        const my = Math.floor(y * scaleY)
        const maskIdx = my * maskWidth + mx
        const pixelIdx = (y * size + x) * 4
        
        if (maskData[maskIdx]) {
          imageData.data[pixelIdx] = 99      // R
          imageData.data[pixelIdx + 1] = 102 // G
          imageData.data[pixelIdx + 2] = 241 // B (indigo)
          imageData.data[pixelIdx + 3] = 255 // A
        } else {
          imageData.data[pixelIdx] = 30
          imageData.data[pixelIdx + 1] = 30
          imageData.data[pixelIdx + 2] = 46
          imageData.data[pixelIdx + 3] = 255
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0)
  }, [stages])
  
  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      className="aspect-square bg-muted rounded w-full"
    />
  )
}

function ContourCanvas({ stages }: { stages: MaskSolidResult["stages"] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    const { maskWidth, maskHeight, simplifiedOuter, simplifiedHoles } = stages
    const size = canvas.width
    
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = "#1e1e2e"
    ctx.fillRect(0, 0, size, size)
    
    if (maskWidth === 0 || simplifiedOuter.length < 3) return
    
    // Transform: mask coords to canvas
    const scaleX = size / maskWidth
    const scaleY = size / maskHeight
    const scale = Math.min(scaleX, scaleY)
    
    const toCanvasX = (x: number) => x * scale
    const toCanvasY = (y: number) => y * scale
    
    // Draw outer contour filled
    ctx.fillStyle = "rgba(99, 102, 241, 0.3)"
    ctx.strokeStyle = "#22c55e"
    ctx.lineWidth = 2
    
    ctx.beginPath()
    ctx.moveTo(toCanvasX(simplifiedOuter[0].x), toCanvasY(simplifiedOuter[0].y))
    for (let i = 1; i < simplifiedOuter.length; i++) {
      ctx.lineTo(toCanvasX(simplifiedOuter[i].x), toCanvasY(simplifiedOuter[i].y))
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    
    // Draw holes
    ctx.strokeStyle = "#3b82f6"
    ctx.fillStyle = "rgba(59, 130, 246, 0.3)"
    for (const hole of simplifiedHoles) {
      if (hole.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(toCanvasX(hole[0].x), toCanvasY(hole[0].y))
      for (let i = 1; i < hole.length; i++) {
        ctx.lineTo(toCanvasX(hole[i].x), toCanvasY(hole[i].y))
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    
    // Draw vertices
    ctx.fillStyle = "#22c55e"
    for (const p of simplifiedOuter) {
      ctx.beginPath()
      ctx.arc(toCanvasX(p.x), toCanvasY(p.y), 3, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [stages])
  
  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      className="aspect-square bg-muted rounded w-full"
    />
  )
}

function DebugStats({ stats, success }: { stats: MaskSolidStats, success: boolean }) {
  return (
    <div className="mt-4 grid grid-cols-6 gap-x-4 gap-y-1 text-xs font-mono bg-muted/50 p-3 rounded">
      <div className="text-muted-foreground">Mask res:</div>
      <div>{stats.maskResolution}x{stats.maskResolution}</div>
      
      <div className="text-muted-foreground">Filled px:</div>
      <div>{stats.filledPixelCount.toLocaleString()}</div>
      
      <div className="text-muted-foreground">Components:</div>
      <div>{stats.componentCount}</div>
      
      <div className="text-muted-foreground">Largest:</div>
      <div>{stats.largestComponentPixels.toLocaleString()} px</div>
      
      <div className="text-muted-foreground">Outer pts:</div>
      <div>{stats.outerContourPoints} → {stats.simplifiedOuterPoints}</div>
      
      <div className="text-muted-foreground">Holes:</div>
      <div>{stats.holeCount}</div>
      
      <div className="text-muted-foreground">Time:</div>
      <div suppressHydrationWarning>{stats.rebuildTimeMs.toFixed(1)} ms</div>
      
      <div className="text-muted-foreground">Status:</div>
      <div className={success ? "text-green-500" : "text-red-500"}>
        {success ? "Geometry OK" : "Failed"}
      </div>
    </div>
  )
}
