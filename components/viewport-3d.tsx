"use client"

import { useRef, useCallback, useMemo } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"
import type { ProcessedStroke } from "@/lib/stroke-processing"

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0, 5)
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

/* ------------------------------------------------------------------ */
/*  Convert 2D canvas strokes to 3D tube meshes                       */
/* ------------------------------------------------------------------ */

const TUBE_RADIUS = 0.02
const TUBE_SEGMENTS_MULTIPLIER = 2
const RADIAL_SEGMENTS = 6

/**
 * Given canvas dimensions and a set of processed strokes,
 * compute bounding box, center, and scale so strokes fit a ~3-unit view.
 */
function useStrokeTubes(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number
) {
  return useMemo(() => {
    if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0)
      return []

    // Use canvas dimensions as the reference frame
    // Map canvas coords to a centered 3D space on the XY plane
    const scaleRef = Math.max(canvasWidth, canvasHeight)
    // We'll normalize to fit within ~3 units
    const normScale = 3 / scaleRef

    const tubes: { curve: THREE.CatmullRomCurve3; key: string }[] = []

    for (let si = 0; si < strokes.length; si++) {
      const stroke = strokes[si]
      if (stroke.points.length < 2) continue

      const pts3d = stroke.points.map((p) => {
        // Center: shift so canvas center is at origin
        const x = (p.x - canvasWidth / 2) * normScale
        // Flip Y: canvas Y goes down, 3D Y goes up
        const y = -(p.y - canvasHeight / 2) * normScale
        return new THREE.Vector3(x, y, 0)
      })

      // Deduplicate points that are too close (CatmullRomCurve3 needs spacing)
      const filtered = [pts3d[0]]
      for (let i = 1; i < pts3d.length; i++) {
        if (pts3d[i].distanceTo(filtered[filtered.length - 1]) > 0.001) {
          filtered.push(pts3d[i])
        }
      }
      if (filtered.length < 2) continue

      const curve = new THREE.CatmullRomCurve3(filtered, false, "centripetal")
      tubes.push({ curve, key: `stroke-${si}-${stroke.points.length}` })
    }

    return tubes
  }, [strokes, canvasWidth, canvasHeight])
}

/* ---- Single tube mesh component ---- */
function StrokeTube({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geometry = useMemo(() => {
    const tubularSegments = Math.max(
      curve.points.length * TUBE_SEGMENTS_MULTIPLIER,
      8
    )
    return new THREE.TubeGeometry(
      curve,
      tubularSegments,
      TUBE_RADIUS,
      RADIAL_SEGMENTS,
      false
    )
  }, [curve])

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#1a1a1a" />
    </mesh>
  )
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
  const tubes = useStrokeTubes(strokes, canvasWidth, canvasHeight)

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      <directionalLight position={[-3, 2, -3]} intensity={0.3} />

      {tubes.map(({ curve, key }) => (
        <StrokeTube key={key} curve={curve} />
      ))}

      <gridHelper
        args={[6, 12, "#cccccc", "#e5e5e5"]}
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, 0, -0.05]}
      />
      <OrbitControls ref={controlsRef} makeDefault />
    </>
  )
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

  // Get a reasonable canvas size estimate for coordinate mapping.
  // We read from the sibling (left column) via the parent layout.
  // Fallback to window dimensions / 2 since columns are equal.
  const canvasWidth =
    typeof window !== "undefined" ? window.innerWidth / 2 : 800
  const canvasHeight =
    typeof window !== "undefined" ? window.innerHeight - 48 : 600

  return (
    <div ref={containerRef} className="relative h-full w-full">
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

      <button
        onClick={handleResetCamera}
        className="absolute bottom-3 right-3 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-sm transition-colors hover:bg-accent"
      >
        Reset camera
      </button>
    </div>
  )
}
