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
  type ExtrudeParams,
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
  extrudeParams?: ExtrudeParams
): StrokeMeshData[] {
  return useMemo(() => {
    const engine = getEngine(mode)
    return engine.buildPreview(strokes, { canvasWidth, canvasHeight, extrudeParams })
  }, [strokes, canvasWidth, canvasHeight, mode, extrudeParams])
}

/* ---- Shared geometries ---- */
const sphereGeometry = new THREE.SphereGeometry(TUBE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
const tipGeometry = new THREE.SphereGeometry(TUBE_RADIUS * 0.95, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
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
  smoothReveal,
  exportGroupRef,
}: {
  meshes: StrokeMeshData[]
  timelines: StrokeTimeline[]
  totalDuration: number
  playheadRef: React.MutableRefObject<number> // 0..1 progress
  smoothReveal: boolean
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
  // Refs to traveling ink-tip spheres (one per stroke)
  const tipRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame(() => {
    const progress = playheadRef.current
    const currentTimeMs = progress * totalDuration

    for (let si = 0; si < meshes.length; si++) {
      const mesh = tubeMeshRefs.current[si]
      const strokeMeshData = meshes[si]

      if (!mesh || !strokeMeshData) continue

      // Extrude meshes are always fully visible (static, no animation)
      if (strokeMeshData.mode === "extrude") {
        mesh.visible = true
        continue
      }

      // Rod mode: animate with drawRange + caps + joints + tip
      const startCap = startCapRefs.current[si]
      const endCap = endCapRefs.current[si]
      const jointGroup = jointGroupRefs.current[si]
      const tip = tipRefs.current[si]
      const timeline = timelines[si]

      if (!timeline) continue

      const geo = mesh.geometry as THREE.TubeGeometry
      const totalIndices = geo.index ? geo.index.count : 0
      const minVisibleIndices = RADIAL_SEGMENTS * 6 * MIN_REVEAL_RINGS

      if (currentTimeMs < timeline.tStart) {
        geo.setDrawRange(0, 0)
        if (startCap) startCap.visible = false
        if (endCap) endCap.visible = false
        if (tip) tip.visible = false
        if (jointGroup) jointGroup.visible = false
        continue
      }

      if (currentTimeMs >= timeline.tEnd) {
        geo.setDrawRange(0, totalIndices)
        if (startCap) startCap.visible = true
        if (endCap) endCap.visible = true
        if (tip) tip.visible = false
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

      // Compute reveal fraction — arc-length-based (smooth) or uniform linear (raw)
      let fraction: number
      const ts = smoothReveal ? strokeMeshData.pointTimestamps : undefined
      const arcs = smoothReveal ? strokeMeshData.pointArcLengths : undefined
      if (ts && arcs && ts.length >= 2 && arcs.length === ts.length) {
        // Binary search pointTimestamps for the segment containing elapsed
        let lo = 0
        let hi = ts.length - 1
        while (lo < hi - 1) {
          const mid = (lo + hi) >> 1
          if (ts[mid] <= elapsed) lo = mid
          else hi = mid
        }
        if (elapsed <= ts[0]) {
          fraction = 0
        } else if (elapsed >= ts[ts.length - 1]) {
          fraction = 1
        } else {
          // Interpolate arc-length between the two bounding points
          const segDur = ts[hi] - ts[lo]
          const alpha = segDur > 0 ? (elapsed - ts[lo]) / segDur : 0
          const arcAtElapsed = arcs[lo] + alpha * (arcs[hi] - arcs[lo])
          const totalArc = arcs[arcs.length - 1]
          fraction = totalArc > 0 ? arcAtElapsed / totalArc : 0
        }
        // "Middle" easing: mostly linear with subtle smoothing at start/end
        // smoothstep(t) = t*t*(3-2*t), blend = lerp(t, smoothstep(t), 0.6)
        const ss = fraction * fraction * (3 - 2 * fraction)
        fraction = fraction + (ss - fraction) * 0.6
      } else {
        fraction = Math.min(elapsed / strokeDuration, 1)
      }

      // Segment-aligned reveal: snap drawRange to whole tube rings
      // to avoid partial-triangle popping artifacts
      const tubularSegments = (geo.parameters as any).tubularSegments as number || 64
      const indicesPerSegment = RADIAL_SEGMENTS * 6
      const visibleSegments = Math.floor(fraction * tubularSegments)
      const drawRangeCount = Math.min(visibleSegments * indicesPerSegment, totalIndices)
      geo.setDrawRange(0, drawRangeCount)

      const hasVisibleSegment = visibleSegments >= MIN_REVEAL_RINGS

      if (startCap) startCap.visible = hasVisibleSegment

      if (endCap) {
        endCap.visible = drawRangeCount >= totalIndices
      }

      // Gel-pen tip: oriented ellipsoid along tangent with inset + dynamic stretch
      if (tip) {
        const tipFraction = Math.min(visibleSegments / tubularSegments, 1)
        // Hide tip when not enough tube is visible or when nearly complete (let end cap finish)
        if (!hasVisibleSegment || !strokeMeshData.curve || tipFraction > 0.97) {
          tip.visible = false
        } else {
          tip.visible = true
          const tipPos = strokeMeshData.curve.getPointAt(tipFraction)
          const tangent = strokeMeshData.curve.getTangentAt(tipFraction)

          // Inset backward along tangent so tip sits inside tube front
          tipPos.addScaledVector(tangent, -TUBE_RADIUS * 0.4)
          tip.position.copy(tipPos)

          // Orient ellipsoid: stretch along tangent (z-forward), squash perpendicular
          // Compute quaternion that rotates default forward (0,0,1) to tangent
          const forward = new THREE.Vector3(0, 0, 1)
          const quat = new THREE.Quaternion().setFromUnitVectors(forward, tangent.normalize())
          tip.quaternion.copy(quat)

          // Dynamic stretch based on speed (compare to previous position)
          const prevPos = tip.userData.prevPos as THREE.Vector3 | undefined
          let speedStretch = 1.0
          if (prevPos) {
            const dist = tipPos.distanceTo(prevPos)
            // Clamp stretch factor: 1.0 at rest, up to 1.6 at high speed
            speedStretch = Math.min(1.0 + dist * 30, 1.6)
          }
          tip.userData.prevPos = tipPos.clone()

          // Squash perpendicular (x,y) = 0.7, stretch along tangent (z) = 1.4 * speed
          const perp = 0.7
          const along = 1.4 * speedStretch
          tip.scale.set(perp, perp, along)
        }
      }

      if (jointGroup) {
        if (!hasVisibleSegment) {
          jointGroup.visible = false
        } else {
          jointGroup.visible = true
          const segFraction = visibleSegments / tubularSegments
          const fracs = strokeMeshData.jointFractions
          for (let ji = 0; ji < jointGroup.children.length; ji++) {
            jointGroup.children[ji].visible = ji < fracs.length && (fracs?.[ji] ?? 0) <= segFraction
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

      {/* Traveling ink tips: one per stroke, NOT exported (visibility managed in useFrame) */}
      {meshes.map((data, si) => (
        <mesh
          key={`${data.key}-tip`}
          ref={(el) => { tipRefs.current[si] = el }}
          geometry={tipGeometry}
          material={strokeMaterial}
          visible={false}
        />
      ))}
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
  smoothReveal,
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
  geometryMode: GeometryMode
  extrudeParams?: ExtrudeParams
  smoothReveal: boolean
  boundsRef: React.MutableRefObject<StrokeBounds | null>
  exportGroupRef: React.RefObject<THREE.Group | null>
  playheadRef: React.MutableRefObject<number>
  playing: boolean
  speed: number
  totalDuration: number
  onProgressUpdate: (progress: number) => void
}) {
  const meshes = useStrokeMeshes(strokes, canvasWidth, canvasHeight, geometryMode, extrudeParams)
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
        smoothReveal={smoothReveal}
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
  geometryMode: GeometryMode
  extrudeParams?: ExtrudeParams
  settingsRef?: React.MutableRefObject<ExportSettings>
}

export default function Viewport3D({ processedStrokes, rawStrokes, geometryMode, extrudeParams, settingsRef }: Viewport3DProps) {
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
  const [smoothReveal, setSmoothReveal] = useState(true)

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
  }, [processedStrokes, geometryMode, extrudeParams, exportName, settingsRef, strokeCount, totalPoints, canvasWidth, canvasHeight])

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
            geometryMode={geometryMode}
            extrudeParams={extrudeParams}
            smoothReveal={smoothReveal}
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

          {/* Smooth / Raw timing toggle */}
          <button
            onClick={() => setSmoothReveal((v) => !v)}
            title={smoothReveal ? "Smooth: arc-length eased reveal" : "Raw: uniform linear reveal"}
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              smoothReveal
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {smoothReveal ? "Smooth" : "Raw"}
          </button>

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
