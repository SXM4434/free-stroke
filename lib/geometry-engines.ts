/**
 * Pluggable geometry engine architecture for Free Stroke.
 *
 * Each engine converts 2D processed strokes into 3D geometry for:
 *   1. Viewport preview (per-stroke mesh data for animation/drawRange)
 *   2. Export (merged/grouped THREE.Group for GLB)
 *
 * Engines:
 *   - RodEngine   — tubes + spherical caps + joint spheres (current)
 *   - ExtrudeEngine — TODO: Iteration 7
 *   - InflateEngine — TODO: Iteration 8+
 */

import * as THREE from "three"
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js"
import type { ProcessedStroke } from "@/lib/stroke-processing"

const mergeGeometriesSafe =
  (BufferGeometryUtils as any).mergeGeometries ??
  (BufferGeometryUtils as any).mergeBufferGeometries

/* ------------------------------------------------------------------ */
/*  Shared constants                                                  */
/* ------------------------------------------------------------------ */

export const TUBE_RADIUS = 0.012
export const TUBE_SEGMENTS_MULTIPLIER = 3
export const MAX_TUBULAR_SEGMENTS = 512
export const RADIAL_SEGMENTS = 16
export const SPHERE_SEGMENTS = 14
export const JOINT_ANGLE_THRESHOLD_DEG = 40
export const JOINT_MIN_DISTANCE = 0.03
export const MIN_STROKE_LENGTH = 0.01

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type GeometryMode = "rod" | "extrude" | "inflate"

/** Per-stroke mesh data used by the viewport for rendering + animation */
export interface StrokeMeshData {
  tubeGeometry: THREE.TubeGeometry
  curve: THREE.CatmullRomCurve3
  capPositions: THREE.Vector3[]
  jointPositions: THREE.Vector3[]
  jointFractions: number[]
  filteredCount: number
  key: string
}

export interface PreviewParams {
  canvasWidth: number
  canvasHeight: number
}

export interface ExportResult {
  group: THREE.Group
  disposables: THREE.BufferGeometry[]
  objectCount: number
  merged: boolean
}

export interface ExportParams {
  canvasWidth: number
  canvasHeight: number
  exportName: string
  strokeCount: number
  totalPoints: number
  settings: {
    spacing: number | null
    smoothingEnabled: boolean | null
    cornersEnabled: boolean | null
  }
}

/** The geometry engine interface. Each mode implements this. */
export interface GeometryEngine {
  /** Build per-stroke mesh data for viewport rendering + animation */
  buildPreview(strokes: ProcessedStroke[], params: PreviewParams): StrokeMeshData[]
  /** Build a self-contained export group (centered at origin, named) */
  buildExport(strokes: ProcessedStroke[], params: ExportParams): ExportResult
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                    */
/* ------------------------------------------------------------------ */

/** Convert 2D stroke points to 3D vectors on the z=0 plane */
function strokeTo3D(
  stroke: ProcessedStroke,
  canvasWidth: number,
  canvasHeight: number
): THREE.Vector3[] {
  const scaleRef = Math.max(canvasWidth, canvasHeight)
  const normScale = 3 / scaleRef

  return stroke.points.map((p) => {
    const x = (p.x - canvasWidth / 2) * normScale
    const y = -(p.y - canvasHeight / 2) * normScale
    return new THREE.Vector3(x, y, 0)
  })
}

/** Deduplicate nearly-coincident points */
function filterDuplicates(pts: THREE.Vector3[], minDist = 0.001): THREE.Vector3[] {
  const filtered = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].distanceTo(filtered[filtered.length - 1]) > minDist) {
      filtered.push(pts[i])
    }
  }
  return filtered
}

/** Compute arc length of a point array */
function computeArcLength(pts: THREE.Vector3[]): number {
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    len += pts[i].distanceTo(pts[i - 1])
  }
  return len
}

/** Detect joints (sharp angle turns) in a 3D polyline */
function detectJoints3D(
  filtered: THREE.Vector3[]
): { positions: THREE.Vector3[]; fractions: number[] } {
  const positions: THREE.Vector3[] = []
  const fractions: number[] = []
  const angleThresholdRad = (JOINT_ANGLE_THRESHOLD_DEG * Math.PI) / 180

  for (let i = 1; i < filtered.length - 1; i++) {
    const prev = filtered[i - 1]
    const curr = filtered[i]
    const next = filtered[i + 1]

    const ax = curr.x - prev.x, ay = curr.y - prev.y, az = curr.z - prev.z
    const bx = next.x - curr.x, by = next.y - curr.y, bz = next.z - curr.z

    const magA = Math.sqrt(ax * ax + ay * ay + az * az)
    const magB = Math.sqrt(bx * bx + by * by + bz * bz)
    if (magA < 1e-6 || magB < 1e-6) continue

    const dot = ax * bx + ay * by + az * bz
    const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)))
    const deviation = Math.PI - Math.acos(cosAngle)

    if (deviation > angleThresholdRad) {
      if (positions.length > 0) {
        const lastJoint = positions[positions.length - 1]
        if (curr.distanceTo(lastJoint) < JOINT_MIN_DISTANCE) continue
      }
      positions.push(curr.clone())
      fractions.push(i / (filtered.length - 1))
    }
  }

  return { positions, fractions }
}

/* ------------------------------------------------------------------ */
/*  RodEngine                                                         */
/* ------------------------------------------------------------------ */

export const RodEngine: GeometryEngine = {
  buildPreview(strokes: ProcessedStroke[], params: PreviewParams): StrokeMeshData[] {
    const { canvasWidth, canvasHeight } = params
    if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) return []

    const result: StrokeMeshData[] = []

    for (let si = 0; si < strokes.length; si++) {
      const stroke = strokes[si]
      if (stroke.points.length < 2) continue

      const pts3d = strokeTo3D(stroke, canvasWidth, canvasHeight)
      const filtered = filterDuplicates(pts3d)
      if (filtered.length < 2) continue
      if (computeArcLength(filtered) < MIN_STROKE_LENGTH) continue

      const curve = new THREE.CatmullRomCurve3(filtered, false, "centripetal")
      const tubularSegments = Math.min(
        Math.max(curve.points.length * TUBE_SEGMENTS_MULTIPLIER, 8),
        MAX_TUBULAR_SEGMENTS
      )
      const tubeGeometry = new THREE.TubeGeometry(
        curve, tubularSegments, TUBE_RADIUS, RADIAL_SEGMENTS, false
      )

      const capPositions = [filtered[0].clone(), filtered[filtered.length - 1].clone()]
      const { positions: jointPositions, fractions: jointFractions } = detectJoints3D(filtered)

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
  },

  buildExport(strokes: ProcessedStroke[], params: ExportParams): ExportResult {
    const { canvasWidth, canvasHeight } = params
    const canMerge = typeof mergeGeometriesSafe === "function"

    const inkMaterial = new THREE.MeshStandardMaterial({ color: "#1a1a1a", name: "Ink" })
    const capSphere = new THREE.SphereGeometry(TUBE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS)

    const exportObjects: THREE.Object3D[] = []
    const disposables: THREE.BufferGeometry[] = []

    for (let si = 0; si < strokes.length; si++) {
      const stroke = strokes[si]
      if (stroke.points.length < 2) continue

      const pts3d = strokeTo3D(stroke, canvasWidth, canvasHeight)
      const filtered = filterDuplicates(pts3d)
      if (filtered.length < 2) continue
      if (computeArcLength(filtered) < MIN_STROKE_LENGTH) continue

      const curve = new THREE.CatmullRomCurve3(filtered, false, "centripetal")
      const tubularSegments = Math.min(
        Math.max(curve.points.length * TUBE_SEGMENTS_MULTIPLIER, 8),
        MAX_TUBULAR_SEGMENTS
      )
      const tubeGeo = new THREE.TubeGeometry(
        curve, tubularSegments, TUBE_RADIUS, RADIAL_SEGMENTS, false
      )

      const startCapGeo = capSphere.clone().translate(filtered[0].x, filtered[0].y, filtered[0].z)
      const endCapGeo = capSphere.clone().translate(
        filtered[filtered.length - 1].x,
        filtered[filtered.length - 1].y,
        filtered[filtered.length - 1].z
      )

      // Build joint spheres
      const jointGeos: THREE.BufferGeometry[] = []
      const { positions: jointPositions } = detectJoints3D(filtered)
      for (const pos of jointPositions) {
        jointGeos.push(capSphere.clone().translate(pos.x, pos.y, pos.z))
      }

      const strokeName = `stroke_${String(si).padStart(3, "0")}`
      const parts = [tubeGeo, startCapGeo, endCapGeo, ...jointGeos]

      if (canMerge) {
        const merged = mergeGeometriesSafe(parts, false)
        if (merged) {
          const mesh = new THREE.Mesh(merged, inkMaterial)
          mesh.name = strokeName
          exportObjects.push(mesh)
          disposables.push(merged)
        } else {
          const group = new THREE.Group()
          group.name = strokeName
          for (let pi = 0; pi < parts.length; pi++) {
            const m = new THREE.Mesh(parts[pi], inkMaterial)
            m.name = `${strokeName}_part_${pi}`
            group.add(m)
          }
          exportObjects.push(group)
        }
      } else {
        const group = new THREE.Group()
        group.name = strokeName
        for (let pi = 0; pi < parts.length; pi++) {
          const m = new THREE.Mesh(parts[pi], inkMaterial)
          m.name = `${strokeName}_part_${pi}`
          group.add(m)
        }
        exportObjects.push(group)
      }

      if (canMerge) {
        tubeGeo.dispose()
        startCapGeo.dispose()
        endCapGeo.dispose()
        jointGeos.forEach((g) => g.dispose())
      }
    }

    // Recenter at origin
    const bbox = new THREE.Box3()
    for (const obj of exportObjects) {
      bbox.union(new THREE.Box3().setFromObject(obj))
    }
    const center = new THREE.Vector3()
    bbox.getCenter(center)

    for (const obj of exportObjects) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry) {
          child.geometry.translate(-center.x, -center.y, -center.z)
        }
      })
    }

    // Build root group
    const rootGroup = new THREE.Group()
    rootGroup.name = "FreeStroke"
    rootGroup.userData = {
      app: "Free Stroke",
      mode: "rod",
      exportedAt: new Date().toISOString(),
      strokeCount: params.strokeCount,
      totalPoints: params.totalPoints,
      settings: {
        ...params.settings,
        tubeRadius: TUBE_RADIUS,
        radialSegments: RADIAL_SEGMENTS,
      },
    }

    for (const obj of exportObjects) {
      rootGroup.add(obj)
    }

    // Dispose template sphere
    inkMaterial.dispose()
    capSphere.dispose()

    return {
      group: rootGroup,
      disposables,
      objectCount: exportObjects.length,
      merged: canMerge,
    }
  },
}

/* ------------------------------------------------------------------ */
/*  ExtrudeEngine — TODO: Iteration 7                                 */
/* ------------------------------------------------------------------ */

export const ExtrudeEngine: GeometryEngine = {
  buildPreview(_strokes: ProcessedStroke[], _params: PreviewParams): StrokeMeshData[] {
    // TODO: Iteration 7 — Extrude mode
    // Will generate ribbon/extruded profiles along stroke paths
    return []
  },

  buildExport(_strokes: ProcessedStroke[], _params: ExportParams): ExportResult {
    // TODO: Iteration 7 — Extrude mode export
    const group = new THREE.Group()
    group.name = "FreeStroke"
    group.userData = { app: "Free Stroke", mode: "extrude" }
    return { group, disposables: [], objectCount: 0, merged: false }
  },
}

/* ------------------------------------------------------------------ */
/*  InflateEngine — TODO: Iteration 8+                                */
/* ------------------------------------------------------------------ */

export const InflateEngine: GeometryEngine = {
  buildPreview(_strokes: ProcessedStroke[], _params: PreviewParams): StrokeMeshData[] {
    // TODO: Iteration 8+ — Inflate mode
    // Will generate inflated blob/surface geometry from enclosed regions
    return []
  },

  buildExport(_strokes: ProcessedStroke[], _params: ExportParams): ExportResult {
    // TODO: Iteration 8+ — Inflate mode export
    const group = new THREE.Group()
    group.name = "FreeStroke"
    group.userData = { app: "Free Stroke", mode: "inflate" }
    return { group, disposables: [], objectCount: 0, merged: false }
  },
}

/* ------------------------------------------------------------------ */
/*  Engine registry                                                   */
/* ------------------------------------------------------------------ */

export const engines: Record<GeometryMode, GeometryEngine> = {
  rod: RodEngine,
  extrude: ExtrudeEngine,
  inflate: InflateEngine,
}

export function getEngine(mode: GeometryMode): GeometryEngine {
  return engines[mode]
}
