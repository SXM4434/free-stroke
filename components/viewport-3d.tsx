"use client"

import { useRef, useCallback, useMemo, useEffect, useState, Component, type ReactNode } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"
import type { Stroke, ProcessedStroke } from "@/lib/stroke-processing"
import type { ExportSettings } from "@/components/drawing-canvas"

const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0, 5)
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

const FRAME_K = 3.0
const TOP_K = 2.5

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
const MIN_STROKE_LENGTH = 0.01 // world units — skip micro-strokes below this arc-length
const MIN_REVEAL_RINGS = 1 // minimum tube rings visible before showing any caps/joints

interface StrokeMeshData {
  tubeGeometry: THREE.TubeGeometry
  curve: THREE.CatmullRomCurve3
  capPositions: THREE.Vector3[]
  jointPositions: THREE.Vector3[]
  /** Normalized time [0,1] at which each joint appears (based on nearest point along the curve) */
  jointFractions: number[]
  /** Number of 3D filtered points (used for drawRange fraction calculation) */
  filteredCount: number
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

      // Micro-stroke filter: skip strokes with negligible arc-length
      let arcLength = 0
      for (let i = 1; i < filtered.length; i++) {
        arcLength += filtered[i].distanceTo(filtered[i - 1])
      }
      if (arcLength < MIN_STROKE_LENGTH) continue

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

      // Detect joints via angle scan on 3D polyline
      const jointPositions: THREE.Vector3[] = []
      const jointFractions: number[] = []
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
          jointFractions.push(i / (filtered.length - 1))
        }
      }

      result.push({
        tubeGeometry,
        curve,
        capPositions,
        jointPositions,
        jointFractions,
        filteredCount: filtered.length,
        key: `stroke-${si}-${stroke.points.length}`,
      })
    }

    return result
  }, [strokes, canvasWidth, canvasHeight])
}

/* ---- Shared geometries ---- */
const sphereGeometry = new THREE.SphereGeometry(TUBE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
const strokeMaterial = new THREE.MeshStandardMaterial({ color: "#1a1a1a" })

/* ---- Bounding box ---- */
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

/* ---- Auto-frame on first draw ---- */
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
    if (meshes.length === 0) {
      hasFramedRef.current = false
      prevCountRef.current = 0
      return
    }
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

/* ------------------------------------------------------------------ */
/*  Animation timeline: computes timing from raw stroke timestamps    */
/* ------------------------------------------------------------------ */

interface StrokeTimeline {
  /** Global time start (ms since epoch) relative to the very first point */
  tStart: number
  /** Global time end */
  tEnd: number
}

function useTimeline(rawStrokes: Stroke[]): {
  timelines: StrokeTimeline[]
  totalDuration: number
  globalTStart: number
} {
  return useMemo(() => {
    if (rawStrokes.length === 0) return { timelines: [], totalDuration: 0, globalTStart: 0 }

    let globalMin = Infinity
    let globalMax = -Infinity

    for (const stroke of rawStrokes) {
      for (const p of stroke.points) {
        if (p.t < globalMin) globalMin = p.t
        if (p.t > globalMax) globalMax = p.t
      }
    }

    const totalDuration = Math.max(globalMax - globalMin, 1) // at least 1ms to avoid div/0

    const timelines: StrokeTimeline[] = rawStrokes.map((stroke) => {
      const pts = stroke.points
      if (pts.length === 0) return { tStart: 0, tEnd: 0 }
      let sMin = Infinity
      let sMax = -Infinity
      for (const p of pts) {
        if (p.t < sMin) sMin = p.t
        if (p.t > sMax) sMax = p.t
      }
      return {
        tStart: sMin - globalMin,
        tEnd: sMax - globalMin,
      }
    })

    return { timelines, totalDuration, globalTStart: globalMin }
  }, [rawStrokes])
}

/* ------------------------------------------------------------------ */
/*  AnimatedStrokes: manages drawRange + visibility per frame         */
/* ------------------------------------------------------------------ */

function AnimatedStrokes({
  meshes,
  timelines,
  totalDuration,
  playheadRef,
  exportGroupRef,
}: {
  meshes: StrokeMeshData[]
  timelines: StrokeTimeline[]
  totalDuration: number
  playheadRef: React.MutableRefObject<number> // 0..1 progress
  exportGroupRef: React.RefObject<THREE.Group | null>
}) {
  // Refs to all tube meshes for drawRange updates
  const tubeMeshRefs = useRef<(THREE.Mesh | null)[]>([])
  // Refs to end cap meshes
  const endCapRefs = useRef<(THREE.Mesh | null)[]>([])
  // Refs to start cap meshes
  const startCapRefs = useRef<(THREE.Mesh | null)[]>([])
  // Refs to joint groups (one group per stroke)
  const jointGroupRefs = useRef<(THREE.Group | null)[]>([])

  useFrame(() => {
    const progress = playheadRef.current
    const currentTimeMs = progress * totalDuration

    for (let si = 0; si < meshes.length; si++) {
      const mesh = tubeMeshRefs.current[si]
      const startCap = startCapRefs.current[si]
      const endCap = endCapRefs.current[si]
      const jointGroup = jointGroupRefs.current[si]
      const timeline = timelines[si]
      const strokeMeshData = meshes[si]

      if (!mesh || !timeline || !strokeMeshData) continue

      const geo = mesh.geometry as THREE.TubeGeometry
      // Total indices in the tube
      const totalIndices = geo.index ? geo.index.count : 0

      // Minimum indices for one visible tube ring
      const minVisibleIndices = RADIAL_SEGMENTS * 6 * MIN_REVEAL_RINGS

      if (currentTimeMs < timeline.tStart) {
        // Stroke hasn't started yet — hide everything
        geo.setDrawRange(0, 0)
        if (startCap) startCap.visible = false
        if (endCap) endCap.visible = false
        if (jointGroup) jointGroup.visible = false
        continue
      }

      if (currentTimeMs >= timeline.tEnd) {
        // Stroke fully revealed
        geo.setDrawRange(0, totalIndices)
        if (startCap) startCap.visible = true
        if (endCap) endCap.visible = true
        if (jointGroup) {
          jointGroup.visible = true
          for (const child of jointGroup.children) {
            child.visible = true
          }
        }
        continue
      }

      // Partial reveal: compute fraction within this stroke's time range
      const strokeDuration = Math.max(timeline.tEnd - timeline.tStart, 1)
      const elapsed = currentTimeMs - timeline.tStart
      const fraction = Math.min(elapsed / strokeDuration, 1)

      // Set drawRange proportionally
      const revealedIndices = Math.floor(fraction * totalIndices)
      geo.setDrawRange(0, revealedIndices)

      // Guard: if fewer than one ring of indices revealed, hide everything for this stroke
      const hasVisibleSegment = revealedIndices >= minVisibleIndices

      // Start cap: only show when we have a visible tube segment
      if (startCap) startCap.visible = hasVisibleSegment

      // End cap: show ONLY when drawRange covers the entire tube geometry
      if (endCap) {
        endCap.visible = revealedIndices >= totalIndices
      }

      // Joints: only show when stroke has a visible segment AND reveal has passed that joint
      if (jointGroup) {
        if (!hasVisibleSegment) {
          jointGroup.visible = false
        } else {
          jointGroup.visible = true
          const fracs = strokeMeshData.jointFractions
          for (let ji = 0; ji < jointGroup.children.length; ji++) {
            jointGroup.children[ji].visible = ji < fracs.length && fracs[ji] <= fraction
          }
        }
      }
    }
  })

  return (
    <group ref={exportGroupRef}>
      {meshes.map((data, si) => (
        <group key={data.key}>
          {/* Tube */}
          <mesh
            ref={(el) => { tubeMeshRefs.current[si] = el }}
            geometry={data.tubeGeometry}
            material={strokeMaterial}
          />
          {/* Start cap */}
          <mesh
            ref={(el) => { startCapRefs.current[si] = el }}
            geometry={sphereGeometry}
            material={strokeMaterial}
            position={data.capPositions[0]}
          />
          {/* End cap */}
          <mesh
            ref={(el) => { endCapRefs.current[si] = el }}
            geometry={sphereGeometry}
            material={strokeMaterial}
            position={data.capPositions[1]}
          />
          {/* Joints */}
          <group ref={(el) => { jointGroupRefs.current[si] = el }}>
            {data.jointPositions.map((pos, ji) => (
              <mesh
                key={`${data.key}-joint-${ji}`}
                geometry={sphereGeometry}
                material={strokeMaterial}
                position={pos}
              />
            ))}
          </group>
        </group>
      ))}
    </group>
  )
}

/* ---- PlaybackController: advances playheadRef when playing ---- */
function PlaybackController({
  playheadRef,
  playing,
  speed,
  totalDuration,
  onProgressUpdate,
}: {
  playheadRef: React.MutableRefObject<number>
  playing: boolean
  speed: number
  totalDuration: number
  onProgressUpdate: (progress: number) => void
}) {
  const lastTimeRef = useRef<number | null>(null)

  useFrame(() => {
    if (!playing || totalDuration <= 0) {
      lastTimeRef.current = null
      return
    }

    const now = performance.now()
    if (lastTimeRef.current === null) {
      lastTimeRef.current = now
      return
    }

    const deltaMs = (now - lastTimeRef.current) * speed
    lastTimeRef.current = now

    const deltaFraction = deltaMs / totalDuration
    const newProgress = Math.min(playheadRef.current + deltaFraction, 1)
    playheadRef.current = newProgress
    onProgressUpdate(newProgress)

    // Auto-pause at end
    if (newProgress >= 1) {
      lastTimeRef.current = null
    }
  })

  return null
}

/* ---- Scene ---- */
function Scene({
  controlsRef,
  strokes,
  rawStrokes,
  canvasWidth,
  canvasHeight,
  boundsRef,
  exportGroupRef,
  playheadRef,
  playing,
  speed,
  totalDuration,
  onProgressUpdate,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  strokes: ProcessedStroke[]
  rawStrokes: Stroke[]
  canvasWidth: number
  canvasHeight: number
  boundsRef: React.MutableRefObject<StrokeBounds | null>
  exportGroupRef: React.RefObject<THREE.Group | null>
  playheadRef: React.MutableRefObject<number>
  playing: boolean
  speed: number
  totalDuration: number
  onProgressUpdate: (progress: number) => void
}) {
  const meshes = useStrokeMeshes(strokes, canvasWidth, canvasHeight)
  const bounds = useStrokeBounds(meshes)
  const { timelines, totalDuration: computedDuration } = useTimeline(rawStrokes)

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

      <AnimatedStrokes
        meshes={meshes}
        timelines={timelines}
        totalDuration={computedDuration}
        playheadRef={playheadRef}
        exportGroupRef={exportGroupRef}
      />

      <PlaybackController
        playheadRef={playheadRef}
        playing={playing}
        speed={speed}
        totalDuration={totalDuration}
        onProgressUpdate={onProgressUpdate}
      />

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
interface ErrorBoundaryProps { children: ReactNode }
interface ErrorBoundaryState { hasError: boolean; error: string | null }

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
  rawStrokes: Stroke[]
  settingsRef?: React.MutableRefObject<ExportSettings>
}

export default function Viewport3D({ processedStrokes, rawStrokes, settingsRef }: Viewport3DProps) {
  const controlsRef = useRef<OrbitControlsImpl | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const boundsRef = useRef<StrokeBounds | null>(null)
  const exportGroupRef = useRef<THREE.Group | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportName, setExportName] = useState("")

  /* ---- Animation state ---- */
  const playheadRef = useRef(0) // 0..1
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // for UI slider display
  const [speed, setSpeed] = useState(1)

  const { totalDuration } = useTimeline(rawStrokes)

  // Sync progress from the frame loop at ~15fps to avoid React re-render storms
  const progressUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onProgressUpdate = useCallback((p: number) => {
    // Throttled UI update
    if (progressUpdateTimerRef.current) return
    progressUpdateTimerRef.current = setTimeout(() => {
      setProgress(p)
      progressUpdateTimerRef.current = null
      // Auto-pause at end
      if (p >= 1) setPlaying(false)
    }, 66) // ~15fps UI updates
  }, [])

  // Cleanup throttle timer
  useEffect(() => {
    return () => {
      if (progressUpdateTimerRef.current) clearTimeout(progressUpdateTimerRef.current)
    }
  }, [])

  // Reset animation when strokes are cleared or undone
  const prevStrokeCountRef = useRef(processedStrokes.length)
  useEffect(() => {
    const prevCount = prevStrokeCountRef.current
    const newCount = processedStrokes.length

    if (newCount < prevCount || newCount === 0) {
      // Undo or Clear happened
      setPlaying(false)
      playheadRef.current = newCount === 0 ? 0 : 1
      setProgress(newCount === 0 ? 0 : 1)
    } else if (newCount > prevCount) {
      // New stroke added — show fully
      playheadRef.current = 1
      setProgress(1)
    }

    prevStrokeCountRef.current = newCount
  }, [processedStrokes.length])

  const handlePlayPause = useCallback(() => {
    setPlaying((prev) => {
      if (!prev) {
        // If at end, restart from beginning
        if (playheadRef.current >= 1) {
          playheadRef.current = 0
          setProgress(0)
        }
        return true
      }
      return false
    })
  }, [])

  const handleScrub = useCallback((value: number) => {
    playheadRef.current = value
    setProgress(value)
  }, [])

  const canvasWidth =
    typeof window !== "undefined" ? window.innerWidth / 2 : 800
  const canvasHeight =
    typeof window !== "undefined" ? window.innerHeight - 48 : 600

  const strokeCount = processedStrokes.length
  const totalPoints = processedStrokes.reduce(
    (sum, s) => sum + s.points.length,
    0
  )

  const handleResetCamera = useCallback(() => {
    const controls = controlsRef.current
    if (!controls) return
    const bounds = boundsRef.current
    if (bounds && bounds.radius > 0) {
      const dir = new THREE.Vector3(1, 1, 1).normalize()
      const pos = bounds.center.clone().add(dir.multiplyScalar(bounds.radius * FRAME_K))
      controls.object.position.copy(pos)
      controls.target.copy(bounds.center)
    } else {
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

    // Before export, ensure full reveal
    playheadRef.current = 1
    setProgress(1)
    setPlaying(false)

    // Wait one frame for drawRange to update
    await new Promise((resolve) => requestAnimationFrame(resolve))

    setExporting(true)
    try {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
      const safeName = exportName.trim().replace(/[^a-zA-Z0-9_-]/g, "-")
      const prefix = safeName ? `${safeName}_` : "free-stroke_"
      const filename = `${prefix}${ts}.glb`

      const settings = settingsRef?.current
      group.userData = {
        app: "Free Stroke",
        exportedAt: now.toISOString(),
        strokeCount,
        totalPoints,
        settings: {
          spacing: settings?.spacing ?? null,
          smoothingEnabled: settings?.smoothing ?? null,
          cornersEnabled: settings?.preserveCorners ?? null,
          tubeRadius: TUBE_RADIUS,
          radialSegments: RADIAL_SEGMENTS,
        },
      }

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

      group.userData = {}

      const blob = new Blob([result], { type: "application/octet-stream" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("GLB export failed:", err)
    } finally {
      setExporting(false)
    }
  }, [processedStrokes.length, exportName, settingsRef, strokeCount, totalPoints])

  const formatDuration = (ms: number, frac: number) => {
    const sec = (ms * frac) / 1000
    return sec.toFixed(1) + "s"
  }

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
            rawStrokes={rawStrokes}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            boundsRef={boundsRef}
            exportGroupRef={exportGroupRef}
            playheadRef={playheadRef}
            playing={playing}
            speed={speed}
            totalDuration={totalDuration}
            onProgressUpdate={onProgressUpdate}
          />
        </Canvas>
      </ViewportErrorBoundary>

      {/* Debug overlay */}
      <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 font-mono text-[10px] leading-tight text-muted-foreground backdrop-blur-sm">
        <div>strokes: {strokeCount}</div>
        <div>points: {totalPoints}</div>
        <div>duration: {(totalDuration / 1000).toFixed(1)}s</div>
      </div>

      {/* Animation controls */}
      {strokeCount > 0 && (
        <div className="absolute bottom-12 left-3 right-3 flex items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-2 backdrop-blur-sm">
          {/* Play/Pause */}
          <button
            onClick={handlePlayPause}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <rect x="2" y="1" width="3" height="10" rx="0.5" />
                <rect x="7" y="1" width="3" height="10" rx="0.5" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M3 1.5v9l7.5-4.5L3 1.5z" />
              </svg>
            )}
          </button>

          {/* Time display */}
          <span className="w-10 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
            {formatDuration(totalDuration, progress)}
          </span>

          {/* Scrubber */}
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(e) => handleScrub(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
          />

          {/* Speed */}
          <div className="flex shrink-0 items-center gap-0.5">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  speed === s
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Camera + Export controls */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
        <input
          type="text"
          value={exportName}
          onChange={(e) => setExportName(e.target.value)}
          placeholder="filename prefix"
          maxLength={32}
          className="h-[30px] w-28 rounded-lg border border-border bg-background/80 px-2 text-xs text-foreground placeholder:text-muted-foreground/50 backdrop-blur-sm focus:outline-none focus:ring-1 focus:ring-foreground/20"
        />
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
