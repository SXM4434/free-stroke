"use client"

import { useState, useRef, useEffect } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { buildMaskSolid, generateTestStrokes, generateRealAppSamples, type MaskSolidResult, type MaskSolidStats, type Point2D, type TestStroke, type TestCase } from "@/lib/solid-mask"

export default function SolidSandboxPage() {
  const [thickness, setThickness] = useState(0.15)
  const [depth, setDepth] = useState(0.3)
  const [showRawContour, setShowRawContour] = useState(false)
  
  const testCases = generateTestStrokes()
  const realSamples = generateRealAppSamples()
  
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Solid Mode Sandbox - MASK-FIRST Pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Pipeline: Canvas2D render, Binary mask, Connected components, Contour tracing, Simplify, Extrude
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className="text-sm font-medium">Thickness: {thickness.toFixed(2)}</label>
                <Slider
                  value={[thickness]}
                  onValueChange={([v]) => setThickness(v)}
                  min={0.03}
                  max={0.40}
                  step={0.01}
                  className="mt-2"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Depth: {depth.toFixed(2)}</label>
                <Slider
                  value={[depth]}
                  onValueChange={([v]) => setDepth(v)}
                  min={0.05}
                  max={1.0}
                  step={0.05}
                  className="mt-2"
                />
              </div>
              <div className="flex items-center space-x-2 pt-5">
                <Switch id="raw-contour" checked={showRawContour} onCheckedChange={setShowRawContour} />
                <Label htmlFor="raw-contour">Show raw contour (pre-simplification)</Label>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Stress Test Cases */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Stress Test Cases (7)</h2>
          <div className="grid gap-3">
            {testCases.map((tc) => (
              <TestCaseCard
                key={tc.name}
                testCase={tc}
                thickness={thickness}
                depth={depth}
                showRawContour={showRawContour}
              />
            ))}
          </div>
        </div>
        
        {/* Real App Samples */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Real App Samples (5)</h2>
          <p className="text-sm text-muted-foreground mb-2">Simulated stroke data from actual failing user drawings</p>
          <div className="grid gap-3">
            {realSamples.map((tc) => (
              <TestCaseCard
                key={tc.name}
                testCase={tc}
                thickness={thickness}
                depth={depth}
                showRawContour={showRawContour}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

interface TestCaseCardProps {
  testCase: TestCase
  thickness: number
  depth: number
  showRawContour: boolean
}

function TestCaseCard({ testCase, thickness, depth, showRawContour }: TestCaseCardProps) {
  const [result, setResult] = useState<ReturnType<typeof buildMaskSolid> | null>(null)
  
  useEffect(() => {
    if (typeof document === "undefined") return
    const r = buildMaskSolid(testCase.stroke, thickness, depth, 800, 600)
    setResult(r)
  }, [testCase.stroke, thickness, depth])
  
  const success = result?.geometry !== null
  const isLoading = result === null
  
  return (
    <Card className={`border-2 ${isLoading ? "border-muted" : success ? "border-green-500/30" : "border-red-500/30"}`}>
      <CardHeader className="py-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">{testCase.name}</CardTitle>
              <Badge variant={isLoading ? "secondary" : success ? "default" : "destructive"} className="text-xs">
                {isLoading ? "..." : success ? "PASS" : "FAIL"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{testCase.description}</p>
            <p className="text-xs text-emerald-600 mt-0.5">Expected: {testCase.expectedBehavior}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-5 gap-3">
          <StageView title="Centerline">
            <CenterlineCanvas points={testCase.stroke.points} />
          </StageView>
          
          <StageView title="Raster Mask">
            {result ? <MaskCanvas stages={result.stages} /> : <LoadingPlaceholder />}
          </StageView>
          
          <StageView title={showRawContour ? "Raw Contour" : "Simplified Contour"}>
            {result ? <ContourCanvas stages={result.stages} showRaw={showRawContour} /> : <LoadingPlaceholder />}
          </StageView>
          
          <StageView title="3D Extrusion">
            <div className="aspect-square bg-muted rounded overflow-hidden">
              {result ? (
                <Canvas camera={{ position: [0, 0, 2.5], fov: 50 }}>
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
          
          <StageView title="Stats">
            {result ? <DebugStats stats={result.stats} success={success} /> : <LoadingPlaceholder />}
          </StageView>
        </div>
      </CardContent>
    </Card>
  )
}

function LoadingPlaceholder() {
  return (
    <div className="aspect-square bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">
      Loading...
    </div>
  )
}

function StageView({ title, children }: { title: string, children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-muted-foreground mb-1">{title}</div>
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
    ctx.fillStyle = "#1e1e2e"
    ctx.fillRect(0, 0, size, size)
    
    if (points.length < 2) return
    
    const toCanvasX = (x: number) => (x + 1.2) / 2.4 * size
    const toCanvasY = (y: number) => (-y + 1.2) / 2.4 * size
    
    ctx.strokeStyle = "#ef4444"
    ctx.lineWidth = 1.5
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.moveTo(toCanvasX(points[0].x), toCanvasY(points[0].y))
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(toCanvasX(points[i].x), toCanvasY(points[i].y))
    }
    ctx.stroke()
    ctx.setLineDash([])
  }, [points])
  
  return <canvas ref={canvasRef} width={150} height={150} className="aspect-square bg-muted rounded w-full" />
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
          imageData.data[pixelIdx] = 99
          imageData.data[pixelIdx + 1] = 102
          imageData.data[pixelIdx + 2] = 241
          imageData.data[pixelIdx + 3] = 255
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
  
  return <canvas ref={canvasRef} width={150} height={150} className="aspect-square bg-muted rounded w-full" />
}

function ContourCanvas({ stages, showRaw }: { stages: MaskSolidResult["stages"], showRaw: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    
    const { maskWidth, maskHeight, outerContour, simplifiedOuter, holes, simplifiedHoles } = stages
    const size = canvas.width
    
    ctx.clearRect(0, 0, size, size)
    ctx.fillStyle = "#1e1e2e"
    ctx.fillRect(0, 0, size, size)
    
    const contour = showRaw ? outerContour : simplifiedOuter
    const holeList = showRaw ? holes : simplifiedHoles
    
    if (maskWidth === 0 || contour.length < 3) return
    
    const scale = size / Math.max(maskWidth, maskHeight)
    const toX = (x: number) => x * scale
    const toY = (y: number) => y * scale
    
    // Draw outer filled
    ctx.fillStyle = "rgba(99, 102, 241, 0.4)"
    ctx.strokeStyle = "#22c55e"
    ctx.lineWidth = 1.5
    
    ctx.beginPath()
    ctx.moveTo(toX(contour[0].x), toY(contour[0].y))
    for (let i = 1; i < contour.length; i++) {
      ctx.lineTo(toX(contour[i].x), toY(contour[i].y))
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    
    // Draw holes
    ctx.strokeStyle = "#3b82f6"
    ctx.fillStyle = "#1e1e2e"
    for (const hole of holeList) {
      if (hole.length < 3) continue
      ctx.beginPath()
      ctx.moveTo(toX(hole[0].x), toY(hole[0].y))
      for (let i = 1; i < hole.length; i++) {
        ctx.lineTo(toX(hole[i].x), toY(hole[i].y))
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }
    
    // Point count label
    ctx.fillStyle = "#fff"
    ctx.font = "10px monospace"
    ctx.fillText(`${contour.length} pts`, 4, size - 4)
  }, [stages, showRaw])
  
  return <canvas ref={canvasRef} width={150} height={150} className="aspect-square bg-muted rounded w-full" />
}

function DebugStats({ stats, success }: { stats: MaskSolidStats, success: boolean }) {
  return (
    <div className="aspect-square bg-muted/50 rounded p-2 text-[9px] font-mono space-y-0.5 overflow-hidden">
      <div className="flex justify-between"><span className="text-muted-foreground">Mask:</span><span>{stats.maskResolution}x{stats.maskResolution}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Filled:</span><span>{(stats.filledPixelCount / 1000).toFixed(1)}k px</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Components:</span><span>{stats.componentCount}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Largest:</span><span>{(stats.largestComponentPixels / 1000).toFixed(1)}k px</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Outer pts:</span><span>{stats.outerContourPoints} → {stats.simplifiedOuterPoints}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Holes:</span><span>{stats.holeCount}</span></div>
      <div className="flex justify-between"><span className="text-muted-foreground">Time:</span><span suppressHydrationWarning>{stats.rebuildTimeMs.toFixed(1)} ms</span></div>
      <div className={`flex justify-between font-semibold ${success ? "text-green-500" : "text-red-500"}`}>
        <span>Status:</span><span>{success ? "OK" : "FAIL"}</span>
      </div>
    </div>
  )
}
