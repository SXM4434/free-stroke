"use client"

import { useRef, useCallback, useMemo, useEffect, Component, type ReactNode } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"
import { detectCorners, type ProcessedStroke } from "@/lib/stroke-processing"

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0, 5)
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

/* ------------------------------------------------------------------ */
/*  Convert 2D canvas strokes to 3D tube meshes + cap/joint spheres   */
/* ------------------------------------------------------------------ */

const TUBE_RADIUS = 0.012
const TUBE_SEGMENTS_MULTIPLIER = 2
const RADIAL_SEGMENTS = 14
const SPHERE_SEGMENTS = 12

interface StrokeMeshData {
  tubeGeometry: THREE.TubeGeometry
  capPositions: THREE.Vector3[]    // start + end caps
  jointPositions: THREE.Vector3[]  // corner joint spheres
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

      // Convert 2D -> 3D
      const pts3d = stroke.points.map((p) => {
        const x = (p.x - canvasWidth / 2) * normScale
        const y = -(p.y - canvasHeight / 2) * normScale
        return new THREE.Vector3(x, y, 0)
      })

      // Filter near-duplicate points
      const filtered = [pts3d[0]]
      const filteredIndices = [0] // track original indices for corner mapping
      for (let i = 1; i < pts3d.length; i++) {
        if (pts3d[i].distanceTo(filtered[filtered.length - 1]) > 0.001) {
          filtered.push(pts3d[i])
          filteredIndices.push(i)
        }
      }
      if (filtered.length < 2) continue

      // Build tube
      const curve = new THREE.CatmullRomCurve3(filtered, false, "centripetal")
      const tubularSegments = Math.max(
        curve.points.length * TUBE_SEGMENTS_MULTIPLIER,
        8
      )
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        tubularSegments,
        TUBE_RADIUS,
        RADIAL_SEGMENTS,
        false // not closed — we add sphere caps instead
      )

      // Cap positions: first and last filtered point
      const capPositions = [
        filtered[0].clone(),
        filtered[filtered.length - 1].clone(),
      ]

      // Corner joint positions: detect corners on 2D points, map to 3D
      const jointPositions: THREE.Vector3[] = []
      if (stroke.cornerCount > 0) {
        const cornerIndices = detectCorners(stroke.points, 45, 4)
        for (const ci of cornerIndices) {
          // Map corner index to closest filtered 3D point
          if (ci >= 0 && ci < pts3d.length) {
            const pos = pts3d[ci]
            // Find nearest filtered point (corner may land between filtered points)
            let best = filtered[0]
            let bestDist = pos.distanceTo(filtered[0])
            for (let fi = 1; fi < filtered.length; fi++) {
              const d = pos.distanceTo(filtered[fi])
              if (d < bestDist) {
                bestDist = d
                best = filtered[fi]
              }
            }
            jointPositions.push(best.clone())
          }
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

/* ---- Shared geometries (created once, reused) ---- */
const sphereGeometry = new THREE.SphereGeometry(TUBE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
const strokeMaterial = new THREE.MeshStandardMaterial({ color: "#1a1a1a" })

/* ---- Auto-frame camera to fit strokes ---- */
function CameraFramer({
  meshes,
  controlsRef,
}: {
  meshes: StrokeMeshData[]
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()

  useEffect(() => {
    if (meshes.length === 0) return
    const controls = controlsRef.current
    if (!controls) return

    const box = new THREE.Box3()
    for (const { tubeGeometry } of meshes) {
      tubeGeometry.computeBoundingBox()
      if (tubeGeometry.boundingBox) {
        box.union(tubeGeometry.boundingBox)
      }
    }

    if (box.isEmpty()) return

    const center = new THREE.Vector3()
    box.getCenter(center)

    const sphere = new THREE.Sphere()
    box.getBoundingSphere(sphere)

    const fov = (camera as THREE.PerspectiveCamera).fov
    const fovRad = (fov * Math.PI) / 180
    const dist = Math.max(sphere.radius / Math.sin(fovRad / 2), 1)

    camera.position.set(center.x, center.y, center.z + dist * 1.2)
    controls.target.copy(center)
    controls.update()
  }, [meshes, camera, controlsRef])

  return null
}

/* ---- Scene with strokes ---- */
function Scene({
  controlsRef,
  strokes,
  canvasWidth,
  canvasHeight,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  strokes: ProcessedStroke[]
  canvasWidth: number
  canvasHeight: number
}) {
  const meshes = useStrokeMeshes(strokes, canvasWidth, canvasHeight)

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-3, 2, -3]} intensity={0.3} />

      {/* Show cube only when no strokes exist */}
      {strokes.length === 0 && (
        <mesh>
          <boxGeometry args={[0.6, 0.6, 0.6]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      )}

      {meshes.map(({ tubeGeometry, capPositions, jointPositions, key }) => (
        <group key={key}>
          {/* Tube body */}
          <mesh geometry={tubeGeometry} material={strokeMaterial} />

          {/* End caps */}
          {capPositions.map((pos, i) => (
            <mesh
              key={`${key}-cap-${i}`}
              geometry={sphereGeometry}
              material={strokeMaterial}
              position={pos}
            />
          ))}

          {/* Corner joint spheres */}
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

      <CameraFramer meshes={meshes} controlsRef={controlsRef} />

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

  const handleResetCamera = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return

    controls.object.position.copy(INITIAL_CAMERA_POSITION)
    controls.target.copy(INITIAL_CAMERA_TARGET)
    controls.update()
  }, [])

  const canvasWidth =
    typeof window !== "undefined" ? window.innerWidth / 2 : 800
  const canvasHeight =
    typeof window !== "undefined" ? window.innerHeight - 48 : 600

  // Debug counts
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
          />
        </Canvas>
      </ViewportErrorBoundary>

      {/* Debug overlay */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 font-mono text-[10px] leading-tight text-muted-foreground backdrop-blur-sm">
        <div>strokes: {strokeCount}</div>
        <div>points: {totalPoints}</div>
      </div>

      <button
        onClick={handleResetCamera}
        className="absolute bottom-3 right-3 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent"
      >
        Reset camera
      </button>
    </div>
  )
}
