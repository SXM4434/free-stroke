"use client"

import { useRef, useCallback, useMemo, useEffect, useState, Component, type ReactNode } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"
import type { Stroke, ProcessedStroke } from "@/lib/stroke-processing"
import type { ExportSettings } from "@/components/drawing-canvas"
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js"
import {
  type GeometryMode,
  type StrokeMeshData,
  type StrokeBuildStatus,
  type ExtrudeParams,
  type SolidParams,
  getEngine,
  TUBE_RADIUS,
  RADIAL_SEGMENTS,
  SPHERE_SEGMENTS,
} from "@/lib/geometry-engines"


const INITIAL_CAMERA_POSITION = new THREE.Vector3(0, 0, 5)
const INITIAL_CAMERA_TARGET = new THREE.Vector3(0, 0, 0)

const FRAME_K = 3.0
const TOP_K = 2.5

/* ------------------------------------------------------------------ */
/*  Convert 2D strokes to 3D mesh data via geometry engine             */
/* ------------------------------------------------------------------ */

const MIN_REVEAL_RINGS = 1 // minimum tube rings visible before showing any caps/joints

function useStrokeMeshes(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
  mode: GeometryMode,
  extrudeParams?: ExtrudeParams,
  solidParams?: SolidParams
): StrokeMeshData[] {
  return useMemo(() => {
    const engine = getEngine(mode)
    return engine.buildPreview(strokes, { canvasWidth, canvasHeight, extrudeParams, solidParams })
  }, [strokes, canvasWidth, canvasHeight, mode, extrudeParams, solidParams])
}

/* ---- Shared geometries ---- */
const sphereGeometry = new THREE.SphereGeometry(TUBE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
// Gel-ink material: preview-only (export uses its own lightweight MeshStandardMaterial)
const strokeMaterial = new THREE.MeshPhysicalMaterial({
  color: "#1a1a1a",
  clearcoat: 0.8,
  clearcoatRoughness: 0.15,
  roughness: 0.35,
  metalness: 0.0,
  reflectivity: 0.6,
})

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

/* ---- CameraSlave: copies camera from a master OrbitControls ref ---- */
function CameraSlave({
  masterControlsRef,
}: {
  masterControlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()

  useFrame(() => {
    const master = masterControlsRef.current
    if (!master) return
    camera.position.copy(master.object.position)
    camera.quaternion.copy(master.object.quaternion)
    ;(camera as THREE.PerspectiveCamera).fov = (master.object as THREE.PerspectiveCamera).fov
    ;(camera as THREE.PerspectiveCamera).updateProjectionMatrix()
  })

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

type RevealMode = "raw" | "smooth" | "hybrid"

function AnimatedStrokes({
  meshes,
  timelines,
  totalDuration,
  playheadRef,
  revealMode,
  hybridBlend,
  exportGroupRef,
}: {
  meshes: StrokeMeshData[]
  timelines: StrokeTimeline[]
  totalDuration: number
  playheadRef: React.MutableRefObject<number> // 0..1 progress
  revealMode: RevealMode
  hybridBlend: number
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
      const strokeMeshData = meshes[si]

      if (!mesh || !strokeMeshData) continue

      // Extrude/Solid meshes are always fully visible (static, no animation)
      if (strokeMeshData.mode === "extrude" || strokeMeshData.mode === "solid") {
        mesh.visible = true
        continue
      }

      // Rod mode: animate with drawRange + caps + joints
      const startCap = startCapRefs.current[si]
      const endCap = endCapRefs.current[si]
      const jointGroup = jointGroupRefs.current[si]
      const timeline = timelines[si]

      if (!timeline) continue

      const geo = mesh.geometry as THREE.TubeGeometry
      const totalIndices = geo.index ? geo.index.count : 0
      const minVisibleIndices = RADIAL_SEGMENTS * 6 * MIN_REVEAL_RINGS

      if (currentTimeMs < timeline.tStart) {
        geo.setDrawRange(0, 0)
        if (startCap) startCap.visible = false
        if (endCap) endCap.visible = false
        if (jointGroup) jointGroup.visible = false
        continue
      }

      if (currentTimeMs >= timeline.tEnd) {
        geo.setDrawRange(0, totalIndices)
        if (startCap) startCap.visible = true
        if (endCap && strokeMeshData.capPositions) {
          endCap.visible = true
          endCap.position.copy(strokeMeshData.capPositions[1])
        }
        if (jointGroup) {
          jointGroup.visible = true
          for (const child of jointGroup.children) {
            child.visible = true
          }
        }
        continue
      }

      const strokeDuration = Math.max(timeline.tEnd - timeline.tStart, 1)
      const elapsed = currentTimeMs - timeline.tStart
      const timeFrac = Math.min(elapsed / strokeDuration, 1)

      // --- Convert timeFrac -> distFrac using per-point mapping ---
      const tf = strokeMeshData.timeFracs
      const df = strokeMeshData.distFracs
      const curve = strokeMeshData.curve

      // Compute rawDistFrac: pen-speed-based arc-length fraction
      let rawDistFrac = timeFrac // fallback
      if (tf && df && tf.length >= 2 && df.length === tf.length) {
        let lo = 0
        let hi = tf.length - 1
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1
          if (tf[mid] <= timeFrac) lo = mid
          else hi = mid
        }
        if (timeFrac <= tf[0]) {
          rawDistFrac = df[0]
        } else if (timeFrac >= tf[tf.length - 1]) {
          rawDistFrac = df[df.length - 1]
        } else {
          const segLen = tf[hi] - tf[lo]
          const alpha = segLen > 0 ? (timeFrac - tf[lo]) / segLen : 0
          rawDistFrac = df[lo] + alpha * (df[hi] - df[lo])
        }
      }

      // Apply reveal mode — NO easing, all linear at the end
      let distFrac: number
      if (revealMode === "smooth") {
        distFrac = timeFrac // constant speed
      } else if (revealMode === "hybrid") {
        distFrac = rawDistFrac + (timeFrac - rawDistFrac) * hybridBlend
      } else {
        distFrac = rawDistFrac // raw pen timing
      }

      // --- Convert distFrac -> curve tParam using arc-length mapping ---
      let tParam: number
      if (curve) {
        const distance = distFrac * curve.getLength()
        tParam = curve.getUtoTmapping(0, distance)
      } else {
        tParam = distFrac
      }

      // --- DrawRange: snap to full tube rings ---
      const tubularSegments = (geo.parameters as any).tubularSegments as number || 64
      const indicesPerRing = RADIAL_SEGMENTS * 6
      const ringIndex = Math.floor(tParam * tubularSegments)
      const visibleRings = Math.min(ringIndex + 1, tubularSegments + 1)
      const drawRangeCount = Math.min(visibleRings * indicesPerRing, totalIndices)
      geo.setDrawRange(0, drawRangeCount)

      const hasVisibleSegment = visibleRings >= MIN_REVEAL_RINGS + 1

      if (startCap) startCap.visible = hasVisibleSegment

      // End cap: hidden during reveal, snaps to final position near completion
      if (endCap) {
        if (distFrac >= 0.98 && strokeMeshData.capPositions) {
          endCap.visible = true
          endCap.position.copy(strokeMeshData.capPositions[1])
        } else {
          endCap.visible = false
        }
      }

      // --- Joints ---
      if (jointGroup) {
        if (!hasVisibleSegment) {
          jointGroup.visible = false
        } else {
          jointGroup.visible = true
          const fracs = strokeMeshData.jointFractions
          for (let ji = 0; ji < jointGroup.children.length; ji++) {
            jointGroup.children[ji].visible = ji < fracs.length && (fracs?.[ji] ?? 0) <= distFrac
          }
        }
      }
    }
  })

  return (
    <>
      {/* Export group: tubes/extrude meshes + caps + joints */}
      <group ref={exportGroupRef}>
        {meshes.map((data, si) => (
          <group key={data.key}>
            {/* Main geometry (tube or extrude) */}
            <mesh
              ref={(el) => { tubeMeshRefs.current[si] = el }}
              geometry={data.tubeGeometry}
              material={strokeMaterial}
            />
            {/* Rod-mode only: caps + joints */}
            {data.mode === "rod" && data.capPositions && (
              <>
                <mesh
                  ref={(el) => { startCapRefs.current[si] = el }}
                  geometry={sphereGeometry}
                  material={strokeMaterial}
                  position={data.capPositions[0]}
                />
                <mesh
                  ref={(el) => { endCapRefs.current[si] = el }}
                  geometry={sphereGeometry}
                  material={strokeMaterial}
                  position={data.capPositions[1]}
                />
              </>
            )}
            {data.mode === "rod" && data.jointPositions && (
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
            )}
          </group>
        ))}
      </group>
    </>
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
  geometryMode,
  extrudeParams,
  solidParams,
  revealMode,
  hybridBlend,
  boundsRef,
  exportGroupRef,
  playheadRef,
  playing,
  speed,
  totalDuration,
  onProgressUpdate,
  orbitEnabled = true,
  masterControlsRef,
  meshStatusRef,
}: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
  strokes: ProcessedStroke[]
  rawStrokes: Stroke[]
  canvasWidth: number
  canvasHeight: number
  geometryMode: GeometryMode
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
  revealMode: RevealMode
  hybridBlend: number
  boundsRef: React.MutableRefObject<StrokeBounds | null>
  exportGroupRef: React.RefObject<THREE.Group | null>
  playheadRef: React.MutableRefObject<number>
  playing: boolean
  speed: number
  totalDuration: number
  onProgressUpdate: (progress: number) => void
  orbitEnabled?: boolean
  masterControlsRef?: React.RefObject<OrbitControlsImpl | null>
  meshStatusRef?: React.MutableRefObject<StrokeBuildStatus[]>
}) {
  const meshes = useStrokeMeshes(strokes, canvasWidth, canvasHeight, geometryMode, extrudeParams, solidParams)
  const bounds = useStrokeBounds(meshes)

  // Populate meshStatusRef for debug overlay
  useEffect(() => {
    if (meshStatusRef) {
      meshStatusRef.current = meshes.map((m) => m.buildStatus ?? { type: "ok" })
    }
  }, [meshes, meshStatusRef])
  const { timelines, totalDuration: computedDuration } = useTimeline(rawStrokes)

  useEffect(() => {
    boundsRef.current = bounds
  }, [bounds, boundsRef])

  return (
    <>
      {/* Lighting: key + fill + rim for gel-ink specular highlights */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.2} />
      <directionalLight position={[-4, 2, -2]} intensity={0.4} />
      <directionalLight position={[0, -3, -5]} intensity={0.3} />

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
        revealMode={revealMode}
        hybridBlend={hybridBlend}
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
      {orbitEnabled ? (
        <OrbitControls ref={controlsRef} makeDefault />
      ) : masterControlsRef ? (
        <CameraSlave masterControlsRef={masterControlsRef} />
      ) : null}
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
  geometryMode: GeometryMode
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
  settingsRef?: React.MutableRefObject<ExportSettings>
}

export default function Viewport3D({ processedStrokes, rawStrokes, geometryMode, extrudeParams, solidParams, settingsRef }: Viewport3DProps) {
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
  const [revealMode, setRevealMode] = useState<RevealMode>("hybrid")
  const [hybridBlend, setHybridBlend] = useState(0.4)
  const [comparing, setComparing] = useState(false)
  const comparePhaseRef = useRef(0) // 0=raw, 1=hybrid, 2=smooth
  const [compareLabel, setCompareLabel] = useState("")
  const [compare3Up, setCompare3Up] = useState(false)
  const [showDebug, setShowDebug] = useState(false)
  const meshStatusRef = useRef<StrokeBuildStatus[]>([])

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

  // Compare mode: auto-cycle through Raw -> Hybrid -> Smooth
  const COMPARE_MODES: RevealMode[] = ["raw", "hybrid", "smooth"]
  const COMPARE_LABELS = ["RAW", `HYBRID (blend=${hybridBlend.toFixed(2)})`, "SMOOTH"]

  useEffect(() => {
    if (!comparing) return
    // When playback finishes (progress >= 1 and not playing), advance phase
    if (progress >= 1 && !playing) {
      const nextPhase = (comparePhaseRef.current + 1) % 3
      comparePhaseRef.current = nextPhase
      setRevealMode(COMPARE_MODES[nextPhase])
      setCompareLabel(COMPARE_LABELS[nextPhase])
      // Small delay so the mode switch is visible before replay starts
      const timer = setTimeout(() => {
        playheadRef.current = 0
        setProgress(0)
        setPlaying(true)
      }, 400)
      return () => clearTimeout(timer)
    }
  }, [comparing, progress, playing, hybridBlend])

  const handleCompareToggle = useCallback(() => {
    setComparing((prev) => {
      if (!prev) {
        // Enter compare: start at phase 0 (raw)
        comparePhaseRef.current = 0
        setRevealMode("raw")
        setCompareLabel("RAW")
        playheadRef.current = 0
        setProgress(0)
        setPlaying(true)
        return true
      }
      // Exit compare: stop playback, restore manual control
      setPlaying(false)
      setCompareLabel("")
      return false
    })
  }, [])

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

  /**
   * Build a fresh export-only scene with merged geometry per stroke,
   * centered at origin, with deterministic naming. No viewer junk.
   */
  const handleExportGLB = useCallback(async () => {
    if (processedStrokes.length === 0) return

    setExporting(true)
    try {
      const engine = getEngine(geometryMode)
      const settings = settingsRef?.current

      const exportResult = engine.buildExport(processedStrokes, {
        canvasWidth,
        canvasHeight,
        exportName,
        strokeCount,
        totalPoints,
      extrudeParams,
      solidParams,
      settings: {
          spacing: settings?.spacing ?? null,
          smoothingEnabled: settings?.smoothing ?? null,
          cornersEnabled: settings?.preserveCorners ?? null,
        },
      })

      if (exportResult.objectCount === 0) {
        setExporting(false)
        return
      }

      // Build export scene
      const exportScene = new THREE.Scene()
      exportScene.add(exportResult.group)

      // Dev-only scene verification
      if (process.env.NODE_ENV === "development") {
        const FORBIDDEN_NAMES = ["grid", "helper", "cube", "debug", "controls"]
        let meshCount = 0
        exportScene.traverse((node) => {
          if (node instanceof THREE.Mesh) meshCount++
          const nameLower = (node.name || "").toLowerCase()
          for (const f of FORBIDDEN_NAMES) {
            if (nameLower.includes(f)) {
              console.warn(`[FreeStroke Export] ASSERTION: found forbidden name "${node.name}" in export scene`)
            }
          }
        })

        if (exportScene.children.length !== 1 || exportScene.children[0].name !== "FreeStroke") {
          console.warn("[FreeStroke Export] ASSERTION: root is not a single group named FreeStroke")
        }

        console.log(`[FreeStroke Export] mode=${geometryMode}, meshes=${meshCount}, strokes=${exportResult.objectCount}, merged=${exportResult.merged}`)
      }

      // Export to GLB
      const exporter = new GLTFExporter()
      const result = await new Promise<ArrayBuffer>((resolve, reject) => {
        exporter.parse(
          exportScene,
          (gltf) => resolve(gltf as ArrayBuffer),
          (error) => reject(error),
          { binary: true }
        )
      })

      // Dispose export-only resources
      for (const g of exportResult.disposables) g.dispose()
      exportScene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry?.dispose()
          if (node.material instanceof THREE.Material) node.material.dispose()
        }
      })

      // Build filename
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, "0")
      const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`
      const safeName = exportName.trim().replace(/[^a-zA-Z0-9_-]/g, "-")
      const prefix = safeName ? `${safeName}_` : "free-stroke_"
      const filename = `${prefix}${ts}.glb`

      console.log(`[FreeStroke] Exported "${filename}" — ${exportResult.objectCount} strokes (${geometryMode}), ${exportResult.merged ? "merged" : "unmerged"}`)

      // Download
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
      console.error("[FreeStroke Export] GLB export failed:", err)
    } finally {
      setExporting(false)
    }
  }, [processedStrokes, geometryMode, extrudeParams, solidParams, exportName, settingsRef, strokeCount, totalPoints, canvasWidth, canvasHeight])

  const formatDuration = (ms: number, frac: number) => {
    const sec = (ms * frac) / 1000
    return sec.toFixed(1) + "s"
  }

  const THREE_UP_MODES: { mode: RevealMode; label: string }[] = [
    { mode: "raw", label: "RAW" },
    { mode: "hybrid", label: "HYBRID" },
    { mode: "smooth", label: "SMOOTH" },
  ]

  // Dummy boundsRef/exportGroupRef for slave canvases (not used for export)
  const slaveBoundsRef1 = useRef<StrokeBounds | null>(null)
  const slaveBoundsRef2 = useRef<StrokeBounds | null>(null)
  const slaveExportRef1 = useRef<THREE.Group | null>(null)
  const slaveExportRef2 = useRef<THREE.Group | null>(null)

  return (
    <div ref={containerRef} className="relative h-full w-full">
      {compare3Up ? (
        /* ---- 3-Up side-by-side view ---- */
        <div className="grid h-full w-full grid-cols-3">
          {THREE_UP_MODES.map((item, idx) => {
            const isMaster = idx === 0
            const bRef = idx === 0 ? boundsRef : idx === 1 ? slaveBoundsRef1 : slaveBoundsRef2
            const eRef = idx === 0 ? exportGroupRef : idx === 1 ? slaveExportRef1 : slaveExportRef2
            return (
              <div key={item.mode} className="relative border-r border-border last:border-r-0">
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
                      controlsRef={isMaster ? controlsRef : { current: null }}
                      strokes={processedStrokes}
                      rawStrokes={rawStrokes}
                      canvasWidth={canvasWidth}
                      canvasHeight={canvasHeight}
                      geometryMode={geometryMode}
                      extrudeParams={extrudeParams}
                      solidParams={solidParams}
                      revealMode={item.mode}
                      hybridBlend={hybridBlend}
                      boundsRef={bRef}
                      exportGroupRef={eRef}
                      playheadRef={playheadRef}
                      playing={playing}
                      speed={speed}
                      totalDuration={totalDuration}
                      onProgressUpdate={isMaster ? onProgressUpdate : () => {}}
                      orbitEnabled={isMaster}
                      masterControlsRef={isMaster ? undefined : controlsRef}
                      meshStatusRef={meshStatusRef}
                    />
                  </Canvas>
                </ViewportErrorBoundary>
                {/* Panel label */}
                <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-background/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground backdrop-blur-sm">
                  {item.label}
                  {item.mode === "hybrid" && (
                    <span className="ml-1 font-normal text-muted-foreground">
                      ({hybridBlend.toFixed(2)})
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* ---- Single viewport ---- */
        <>
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
                geometryMode={geometryMode}
                extrudeParams={extrudeParams}
                solidParams={solidParams}
                revealMode={revealMode}
                hybridBlend={hybridBlend}
                boundsRef={boundsRef}
                exportGroupRef={exportGroupRef}
                playheadRef={playheadRef}
                playing={playing}
                speed={speed}
                totalDuration={totalDuration}
                onProgressUpdate={onProgressUpdate}
                meshStatusRef={meshStatusRef}
              />
            </Canvas>
          </ViewportErrorBoundary>
        </>
      )}

      {/* Debug overlay (only when debug mode is on) */}
      {showDebug && (
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg border border-border bg-background/80 px-2.5 py-1.5 font-mono text-[10px] leading-tight text-muted-foreground backdrop-blur-sm">
          <div>strokes: {strokeCount}</div>
          <div>points: {totalPoints}</div>
          <div>duration: {(totalDuration / 1000).toFixed(1)}s</div>
          <div>reveal: {revealMode === "hybrid" ? `Hybrid(${hybridBlend.toFixed(2)})` : revealMode}</div>
          {compare3Up && <div className="font-semibold text-foreground">3-Up Compare</div>}
          {comparing && compareLabel && (
            <div className="mt-0.5 font-semibold text-foreground">Compare: {compareLabel}</div>
          )}
          {/* Per-stroke extrude build status (extrude mode only) */}
          {geometryMode === "extrude" && (meshStatusRef.current?.length ?? 0) > 0 && (
            <div className="mt-1 border-t border-border/50 pt-1">
              <div className="font-semibold text-foreground">Build status:</div>
              {(meshStatusRef.current ?? []).map((s, i) => (
                <div key={i} className={
                  s.type === "ok" ? "text-green-600"
                    : s.type === "bevelOff" ? "text-yellow-600"
                    : s.type === "bevelOffTinyWidth" ? "text-orange-500"
                    : "text-red-500"
                }>
                  {i}: {s.type === "ok"
                    ? `extrude w=${s.width.toFixed(3)} d=${s.depth.toFixed(3)} bevel=${s.bevelEnabled}`
                    : s.type === "bevelOff"
                    ? `extrude w=${s.width.toFixed(3)} d=${s.depth.toFixed(3)} bevel=off(retry)`
                    : s.type === "bevelOffTinyWidth"
                    ? `extrude w=${s.width.toFixed(3)} d=${s.depth.toFixed(3)} bevel=off(tiny)`
                    : `rod r=${s.fallbackRadius.toFixed(3)} (${s.reason}) depth=n/a bevel=n/a`}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

          {/* Main timing toggle: Natural (hybrid) / Authentic (raw) */}
          <div className={`flex shrink-0 items-center gap-0.5 ${comparing ? "pointer-events-none opacity-40" : ""}`}>
            <button
              onClick={() => setRevealMode("hybrid")}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                revealMode === "hybrid"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Natural
            </button>
            <button
              onClick={() => setRevealMode("raw")}
              className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
                revealMode === "raw"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Authentic
            </button>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Speed */}
          <div className="flex shrink-0 items-center gap-0.5">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setSpeed(s)}
                className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${speed === s
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                  }`}
              >
                {s}x
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Debug toggle */}
          <button
            onClick={() => setShowDebug((v) => !v)}
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              showDebug
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Debug
          </button>

          {/* Debug-only tools */}
          {showDebug && (
            <>
              <div className="h-4 w-px bg-border" />

              {/* Smooth option (debug only) */}
              <button
                onClick={() => setRevealMode("smooth")}
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  revealMode === "smooth"
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Smooth
              </button>

              {/* Blend slider (debug only) */}
              {revealMode === "hybrid" && (
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={hybridBlend}
                  onChange={(e) => setHybridBlend(Number(e.target.value))}
                  title={`Blend: ${hybridBlend.toFixed(2)}`}
                  disabled={comparing}
                  className={`h-1 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-border accent-foreground ${comparing ? "opacity-40" : ""}`}
                />
              )}

              <div className="h-4 w-px bg-border" />

              {/* Compare toggle (debug only) */}
              <button
                onClick={handleCompareToggle}
                disabled={compare3Up}
                className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  comparing
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                } ${compare3Up ? "pointer-events-none opacity-40" : ""}`}
              >
                {comparing ? "Stop" : "Compare"}
              </button>

              {/* 3-Up toggle (debug only) */}
              <button
                onClick={() => {
                  setCompare3Up((v) => !v)
                  if (!compare3Up && comparing) {
                    setComparing(false)
                    setPlaying(false)
                    setCompareLabel("")
                  }
                }}
                className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  compare3Up
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {compare3Up ? "Single" : "3-Up"}
              </button>
            </>
          )}
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
