"use client"

import { useRef, useCallback, useMemo, useEffect, useState, Component, type ReactNode } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"
import type { ProcessedStroke } from "@/lib/stroke-processing"

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0, 5)
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

const FRAME_K = 3.0  // distance multiplier for diagonal reset view
const TOP_K = 2.5    // distance multiplier for top-down view

/* ------------------------------------------------------------------ */
/*  Convert 2D canvas strokes to 3D tube meshes + cap/joint spheres   */
/* ------------------------------------------------------------------ */

const TUBE_RADIUS = 0.012
const TUBE_SEGMENTS_MULTIPLIER = 3
const MAX_TUBULAR_SEGMENTS = 512
const RADIAL_SEGMENTS = 16
const SPHERE_SEGMENTS = 14
const JOINT_ANGLE_THRESHOLD_DEG = 40
const JOINT_MIN_DISTANCE = 0.03

interface StrokeMeshData {
  tubeGeometry: THREE.TubeGeometry
  capPositions: THREE.Vector3[]
  jointPositions: THREE.Vector3[]
  key: string
}

function useStrokeMeshes(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number
): StrokeMeshData[] {
  return useMemo(() => {
    if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0)
      return []

    const scaleRef = Math.max(canvasWidth, canvasHeight)
    const normScale = 3 / scaleRef

    const result: StrokeMeshData[] = []

    for (let si = 0; si < strokes.length; si++) {
      const stroke = strokes[si]
      if (stroke.points.length < 2) continue

      const pts3d = stroke.points.map((p) => {
        const x = (p.x - canvasWidth / 2) * normScale
        const y = -(p.y - canvasHeight / 2) * normScale
        return new THREE.Vector3(x, y, 0)
      })

      const filtered = [pts3d[0]]
      for (let i = 1; i < pts3d.length; i++) {
        if (pts3d[i].distanceTo(filtered[filtered.length - 1]) > 0.001) {
          filtered.push(pts3d[i])
        }
      }
      if (filtered.length < 2) continue

      const curve = new THREE.CatmullRomCurve3(filtered, false, "centripetal")
      const tubularSegments = Math.min(
        Math.max(curve.points.length * TUBE_SEGMENTS_MULTIPLIER, 8),
        MAX_TUBULAR_SEGMENTS
      )
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        tubularSegments,
        TUBE_RADIUS,
        RADIAL_SEGMENTS,
        false
      )

      const capPositions = [
        filtered[0].clone(),
        filtered[filtered.length - 1].clone(),
      ]

      const jointPositions: THREE.Vector3[] = []
      const angleThresholdRad = (JOINT_ANGLE_THRESHOLD_DEG * Math.PI) / 180

      for (let i = 1; i < filtered.length - 1; i++) {
        const prev = filtered[i - 1]
        const curr = filtered[i]
        const next = filtered[i + 1]

        const ax = curr.x - prev.x
        const ay = curr.y - prev.y
        const az = curr.z - prev.z
        const bx = next.x - curr.x
        const by = next.y - curr.y
        const bz = next.z - curr.z

        const magA = Math.sqrt(ax * ax + ay * ay + az * az)
        const magB = Math.sqrt(bx * bx + by * by + bz * bz)
        if (magA < 1e-6 || magB < 1e-6) continue

        const dot = ax * bx + ay * by + az * bz
        const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)))
        const deviation = Math.PI - Math.acos(cosAngle)

        if (deviation > angleThresholdRad) {
          if (jointPositions.length > 0) {
            const lastJoint = jointPositions[jointPositions.length - 1]
            if (curr.distanceTo(lastJoint) < JOINT_MIN_DISTANCE) continue
          }
          jointPositions.push(curr.clone())
        }
      }

      result.push({
        tubeGeometry,
        capPositions,
        jointPositions,
        key: `stroke-${si}-${stroke.points.length}`,
      })
    }

    return result
  }, [strokes, canvasWidth, canvasHeight])
}

/* ---- Shared geometries ---- */
const sphereGeometry = new THREE.SphereGeometry(TUBE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
const strokeMaterial = new THREE.MeshStandardMaterial({ color: "#1a1a1a" })

/* ---- Compute bounding center + radius from mesh data ---- */
interface StrokeBounds {
  center: THREE.Vector3
  radius: number
}

function useStrokeBounds(meshes: StrokeMeshData[]): StrokeBounds | null {
  return useMemo(() => {
    if (meshes.length === 0) return null

    const box = new THREE.Box3()
    for (const { tubeGeometry } of meshes) {
      tubeGeometry.computeBoundingBox()
      if (tubeGeometry.boundingBox) {
        box.union(tubeGeometry.boundingBox)
      }
    }
    if (box.isEmpty()) return null

    const center = new THREE.Vector3()
    box.getCenter(center)

    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)

    return { center, radius: sphere.radius }
  }, [meshes])
}

/* ---- Auto-frame on first draw (once per empty->drawn transition) ---- */
function AutoFrameOnFirstDraw({
  meshes,
  bounds,
  controlsRef,
}: {
  meshes: StrokeMeshData[]
  bounds: StrokeBounds | null
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()
  const hasFramedRef = useRef(false)
  const prevCountRef = useRef(0)

  useEffect(() => {
    // Reset flag when going from strokes -> empty
    if (meshes.length === 0) {
      hasFramedRef.current = false
      prevCountRef.current = 0
      return
    }

    // Auto-frame once on first draw (0 -> >0 transition)
    if (prevCountRef.current === 0 && meshes.length > 0 && !hasFramedRef.current && bounds) {
      hasFramedRef.current = true

      const controls = controlsRef.current
      if (!controls) return

      const dir = new THREE.Vector3(1, 1, 1).normalize()
      const pos = bounds.center.clone().add(dir.multiplyScalar(bounds.radius * FRAME_K))

      camera.position.copy(pos)
      controls.target.copy(bounds.center)
      controls.update()
    }

    prevCountRef.current = meshes.length
  }, [meshes, bounds, camera, controlsRef])

  return null
}

/* ---- Scene ---- */
function Scene({
  controlsRef,
  strokes,
  canvasWidth,
  canvasHeight,
  boundsRef,
  exportGroupRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  strokes: ProcessedStroke[]
  canvasWidth: number
  canvasHeight: number
  boundsRef: React.MutableRefObject<StrokeBounds | null>
  exportGroupRef: React.RefObject<THREE.Group | null>
}) {
  const meshes = useStrokeMeshes(strokes, canvasWidth, canvasHeight)
  const bounds = useStrokeBounds(meshes)

  // Keep boundsRef synced for external use (Reset / Top buttons)
  useEffect(() => {
    boundsRef.current = bounds
  }, [bounds, boundsRef])

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-3, 2, -3]} intensity={0.3} />

      {strokes.length === 0 && (
        <mesh>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      )}

      {/* Export group: contains ONLY stroke geometry (tubes + caps + joints) */}
      <group ref={exportGroupRef}>
        {meshes.map(({ tubeGeometry, capPositions, jointPositions, key }) => (
          <group key={key}>
            <mesh geometry={tubeGeometry} material={strokeMaterial} />
            {capPositions.map((pos, i) => (
              <mesh
                key={`${key}-cap-${i}`}
                geometry={sphereGeometry}
                material={strokeMaterial}
                position={pos}
              />
            ))}
            {jointPositions.map((pos, i) => (
              <mesh
                key={`${key}-joint-${i}`}
                geometry={sphereGeometry}
                material={strokeMaterial}
                position={pos}
              />
            ))}
          </group>
        ))}
      </group>

      <AutoFrameOnFirstDraw
        meshes={meshes}
        bounds={bounds}
        controlsRef={controlsRef}
      />

      <gridHelper
        args={[6, 12, "#cccccc", "#e5e5e5"]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.05]}
      />
      <OrbitControls ref={controlsRef} makeDefault />
    </>
  )
}

/* ---- Error boundary ---- */
interface ErrorBoundaryProps {
  children: ReactNode
}
interface ErrorBoundaryState {
  hasError: boolean
  error: string | null
}

class ViewportErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-destructive/5 p-6">
          <div className="rounded-xl border border-destructive/20 bg-background p-6 text-center">
            <p className="text-sm font-medium text-destructive">3D Viewport Error</p>
            <p className="mt-1 text-xs text-muted-foreground">{this.state.error}</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Retry
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/* ---- Main viewport component ---- */
interface Viewport3DProps {
  processedStrokes: ProcessedStroke[]
}

export default function Viewport3D({ processedStrokes }: Viewport3DProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const boundsRef = useRef<StrokeBounds | null>(null)
  const exportGroupRef = useRef<THREE.Group | null>(null)
  const [exporting, setExporting] = useState(false)

  const handleResetCamera = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return

    const bounds = boundsRef.current
    if (bounds && bounds.radius > 0) {
      // Frame the current drawing
      const dir = new THREE.Vector3(1, 1, 1).normalize()
      const pos = bounds.center.clone().add(dir.multiplyScalar(bounds.radius * FRAME_K))
      controls.object.position.copy(pos)
      controls.target.copy(bounds.center)
    } else {
      // No strokes: fall back to default
      controls.object.position.copy(INITIAL_CAMERA_POSITION)
      controls.target.copy(INITIAL_CAMERA_TARGET)
    }
    controls.update()
  }, [])

  const handleTopView = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return

    const bounds = boundsRef.current
    if (bounds && bounds.radius > 0) {
      const pos = bounds.center.clone().add(new THREE.Vector3(0, 0, bounds.radius * TOP_K))
      controls.object.position.copy(pos)
      controls.target.copy(bounds.center)
    } else {
      controls.object.position.set(0, 0, 5)
      controls.target.copy(INITIAL_CAMERA_TARGET)
    }
    controls.update()
  }, [])

  const handleExportGLB = useCallback(async () => {
    const group = exportGroupRef.current
    if (!group || processedStrokes.length === 0) return

    setExporting(true)
    try {
      const { GLTFExporter } = await import("three-stdlib")
      const exporter = new GLTFExporter()

      const result = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          group,
          (gltf) => resolve(gltf as ArrayBuffer),
          (error) => reject(error),
          { binary: true }
        )
      })

      const blob = new Blob([result], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const timestamp = Date.now()
      const a = document.createElement("a")
      a.href = url
      a.download = `free-stroke-${timestamp}.glb`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("GLB export failed:", err)
    } finally {
      setExporting(false)
    }
  }, [processedStrokes.length])

  const canvasWidth =
    typeof window !== "undefined" ? window.innerWidth / 2 : 800
  const canvasHeight =
    typeof window !== "undefined" ? window.innerHeight - 48 : 600

  const strokeCount = processedStrokes.length
  const totalPoints = processedStrokes.reduce(
    (sum, s) => sum + s.points.length,
    0
  )

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <ViewportErrorBoundary>
        <Canvas
          camera={{
            position: [
              INITIAL_CAMERA_POSITION.x,
              INITIAL_CAMERA_POSITION.y,
              INITIAL_CAMERA_POSITION.z,
            ],
            fov: 50,
          }}
          style={{ background: "#fafafa" }}
        >
          <Scene
            controlsRef={controlsRef}
            strokes={processedStrokes}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            boundsRef={boundsRef}
            exportGroupRef={exportGroupRef}
          />
        </Canvas>
      </ViewportErrorBoundary>

      {/* Debug overlay */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 font-mono text-[10px] leading-tight text-muted-foreground backdrop-blur-sm">
        <div>strokes: {strokeCount}</div>
        <div>points: {totalPoints}</div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        <button
          onClick={handleExportGLB}
          disabled={strokeCount === 0 || exporting}
          className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {exporting ? "Exporting..." : "Export GLB"}
        </button>
        <button
          onClick={handleTopView}
          className="rounded-lg border border-border bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent"
        >
          Top
        </button>
        <button
          onClick={handleResetCamera}
          className="rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent"
        >
          Reset camera
        </button>
      </div>
    </div>
  )
}
