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

export type GeometryMode = "rod" | "extrude" | "inflate" | "solid"

/** Extrude-mode parameters */
export interface ExtrudeParams {
  width: number       // ribbon half-width in world units
  depth: number       // extrusion depth
  bevelEnabled: boolean
  bevelSize: number
  bevelSegments: number
}

export const DEFAULT_EXTRUDE_PARAMS: ExtrudeParams = {
  width: 0.06,
  depth: 0.2,
  bevelEnabled: true,
  bevelSize: 0.015,
  bevelSegments: 2,
}

/** Solid-mode parameters */
export interface SolidParams {
  thickness: number   // stroke width in pixels when rasterizing (2D canvas lineWidth)
  depth: number       // extrusion depth in world units
}

export const DEFAULT_SOLID_PARAMS: SolidParams = {
  thickness: 24,
  depth: 0.15,
}

/** Per-stroke build status for debug overlay (Extrude mode) */
export type StrokeBuildStatus =
  | { type: "ok"; width: number; depth: number; bevelEnabled: boolean }
  | { type: "bevelOff"; width: number; depth: number }
  | { type: "bevelOffTinyWidth"; width: number; depth: number }
  | { type: "rodFallback"; reason: string; fallbackRadius: number }

/** Debug contour data for Solid mode visualization */
export interface SolidDebugContour {
  points: { x: number; y: number }[]
  type: "outer" | "hole" | "rejected"
  reason?: string
  area: number
  isClosed: boolean
}

/** Solid mode build status for debug overlay */
export interface SolidBuildStatus {
  success: boolean
  contourCount: number
  holesCount: number
  thickness: number
  depth: number
  // Debug stats
  rawContourCount: number
  rejectedCount: number
  validOuterCount: number
  openContourCount: number
  selfIntersectCount: number
  // Debug contour data for visualization (only populated in debug builds)
  debugContours?: SolidDebugContour[]
  // Raster size for 2D overlay rendering
  rasterSize: number
}

/** Below this width, auto-disable bevel to avoid degenerate extrusions */
const TINY_WIDTH_THRESHOLD = 0.03

/** Per-stroke mesh data used by the viewport for rendering + animation */
export interface StrokeMeshData {
  /** The geometry — TubeGeometry for rod, ExtrudeGeometry for extrude */
  tubeGeometry: THREE.BufferGeometry
  /** Curve for rod-mode animation (undefined for extrude) */
  curve?: THREE.CatmullRomCurve3
  /** Cap positions for rod-mode caps (undefined for extrude) */
  capPositions?: THREE.Vector3[]
  /** Radius for cap/joint spheres (defaults to TUBE_RADIUS if not set) */
  capRadius?: number
  /** Joint positions for rod-mode joints (undefined for extrude) */
  jointPositions?: THREE.Vector3[]
  jointFractions?: number[]
  filteredCount: number
  key: string
  /** Geometry mode that produced this mesh data */
  mode: GeometryMode
  /** Build status for debug overlay (extrude mode only) */
  buildStatus?: StrokeBuildStatus
  /** Build status for debug overlay (solid mode only) */
  solidStatus?: SolidBuildStatus
}

export interface PreviewParams {
  canvasWidth: number
  canvasHeight: number
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
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
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
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

/** Detect joints (sharp angle turns) in a 3D polyline, excluding endpoint zones */
function detectJoints3D(
  filtered: THREE.Vector3[],
  startPt: THREE.Vector3,
  endPt: THREE.Vector3
): { positions: THREE.Vector3[]; fractions: number[] } {
  const positions: THREE.Vector3[] = []
  const fractions: number[] = []
  const angleThresholdRad = (JOINT_ANGLE_THRESHOLD_DEG * Math.PI) / 180

  // Exclusion zone around endpoints: joints here cause "dot" artifacts
  const endpointEps = TUBE_RADIUS * 1.25
  // Minimum distance between consecutive joints (tighter than JOINT_MIN_DISTANCE)
  const jointDedup = TUBE_RADIUS * 0.75

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
      // Skip joints too close to start or end cap positions
      if (curr.distanceTo(startPt) < endpointEps) continue
      if (curr.distanceTo(endPt) < endpointEps) continue

      // Deduplicate joints that are too close together
      if (positions.length > 0) {
        const lastJoint = positions[positions.length - 1]
        if (curr.distanceTo(lastJoint) < jointDedup) continue
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

      // Filter duplicates while tracking which source indices survived
      const filtered: THREE.Vector3[] = [pts3d[0]]
      const survivedIndices: number[] = [0]
      for (let i = 1; i < pts3d.length; i++) {
        if (pts3d[i].distanceTo(filtered[filtered.length - 1]) > 0.001) {
          filtered.push(pts3d[i])
          survivedIndices.push(i)
        }
      }
      if (filtered.length < 2) continue
      if (computeArcLength(filtered) < MIN_STROKE_LENGTH) continue

      // Build per-filtered-point timestamps (relative to stroke start)
      const strokeTStart = stroke.points[0].t
      const pointTimestamps = survivedIndices.map((idx) => stroke.points[idx].t - strokeTStart)

      // Build cumulative arc-length at each filtered point
      const pointArcLengths: number[] = [0]
      for (let i = 1; i < filtered.length; i++) {
        pointArcLengths.push(pointArcLengths[i - 1] + filtered[i].distanceTo(filtered[i - 1]))
      }

      // Pre-compute normalized time/distance fraction arrays for playback lookup
      const totalTime = pointTimestamps[pointTimestamps.length - 1]
      const totalArc = pointArcLengths[pointArcLengths.length - 1]
      const timeFracs = totalTime > 0
        ? pointTimestamps.map((t) => t / totalTime)
        : pointTimestamps.map((_, i) => i / (pointTimestamps.length - 1))
      const distFracs = totalArc > 0
        ? pointArcLengths.map((a) => a / totalArc)
        : pointArcLengths.map((_, i) => i / (pointArcLengths.length - 1))

      const curve = new THREE.CatmullRomCurve3(filtered, false, "centripetal")
      const tubularSegments = Math.min(
        Math.max(curve.points.length * TUBE_SEGMENTS_MULTIPLIER, 8),
        MAX_TUBULAR_SEGMENTS
      )
      const tubeGeometry = new THREE.TubeGeometry(
        curve, tubularSegments, TUBE_RADIUS, RADIAL_SEGMENTS, false
      )

      // Inset cap spheres slightly along tangent so they sit inside the tube ends
      const inset = TUBE_RADIUS * 0.35
      const startTangent = curve.getTangentAt(0)
      const endTangent = curve.getTangentAt(1)
      const startCapPos = filtered[0].clone().addScaledVector(startTangent, inset)
      const endCapPos = filtered[filtered.length - 1].clone().addScaledVector(endTangent, -inset)
      const capPositions = [startCapPos, endCapPos]

      const { positions: jointPositions, fractions: jointFractions } = detectJoints3D(
        filtered, filtered[0], filtered[filtered.length - 1]
      )

      result.push({
        tubeGeometry,
        curve,
        capPositions,
        jointPositions,
        jointFractions,
        filteredCount: filtered.length,
        key: `stroke-${si}-${stroke.points.length}`,
        mode: "rod",
        pointTimestamps,
        pointArcLengths,
        timeFracs,
        distFracs,
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

      // Inset cap spheres along tangent (same as preview)
      const inset = TUBE_RADIUS * 0.35
      const startTangent = curve.getTangentAt(0)
      const endTangent = curve.getTangentAt(1)
      const startCapPos = filtered[0].clone().addScaledVector(startTangent, inset)
      const endCapPos = filtered[filtered.length - 1].clone().addScaledVector(endTangent, -inset)

      const startCapGeo = capSphere.clone().translate(startCapPos.x, startCapPos.y, startCapPos.z)
      const endCapGeo = capSphere.clone().translate(endCapPos.x, endCapPos.y, endCapPos.z)

      // Build joint spheres (excluding endpoint zones)
      const jointGeos: THREE.BufferGeometry[] = []
      const { positions: jointPositions } = detectJoints3D(
        filtered, filtered[0], filtered[filtered.length - 1]
      )
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
/*  ExtrudeEngine                                                     */
/* ------------------------------------------------------------------ */

/**
 * Build a 2D ribbon outline (offset left/right of polyline by `halfWidth`).
 * Returns an array of 2D points forming a closed polygon.
 */
function buildRibbonShape(pts: THREE.Vector3[], halfWidth: number): THREE.Shape | null {
  if (pts.length < 2) return null

  const left: THREE.Vector2[] = []
  const right: THREE.Vector2[] = []

  for (let i = 0; i < pts.length; i++) {
    let nx: number, ny: number

    if (i === 0) {
      // First point: normal from first segment
      const dx = pts[1].x - pts[0].x
      const dy = pts[1].y - pts[0].y
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-6
      nx = -dy / len
      ny = dx / len
    } else if (i === pts.length - 1) {
      // Last point: normal from last segment
      const dx = pts[i].x - pts[i - 1].x
      const dy = pts[i].y - pts[i - 1].y
      const len = Math.sqrt(dx * dx + dy * dy) || 1e-6
      nx = -dy / len
      ny = dx / len
    } else {
      // Middle: average normals of adjacent segments
      const dx1 = pts[i].x - pts[i - 1].x
      const dy1 = pts[i].y - pts[i - 1].y
      const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1) || 1e-6
      const nx1 = -dy1 / len1
      const ny1 = dx1 / len1

      const dx2 = pts[i + 1].x - pts[i].x
      const dy2 = pts[i + 1].y - pts[i].y
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2) || 1e-6
      const nx2 = -dy2 / len2
      const ny2 = dx2 / len2

      // Average
      nx = (nx1 + nx2) * 0.5
      ny = (ny1 + ny2) * 0.5
      const nlen = Math.sqrt(nx * nx + ny * ny) || 1e-6
      nx /= nlen
      ny /= nlen
    }

    left.push(new THREE.Vector2(pts[i].x + nx * halfWidth, pts[i].y + ny * halfWidth))
    right.push(new THREE.Vector2(pts[i].x - nx * halfWidth, pts[i].y - ny * halfWidth))
  }

  // Build closed polygon: left forward + right backward
  const shape = new THREE.Shape()
  shape.moveTo(left[0].x, left[0].y)
  for (let i = 1; i < left.length; i++) {
    shape.lineTo(left[i].x, left[i].y)
  }
  // Round end cap (semicircle at end)
  const endCenter = new THREE.Vector2(
    (left[left.length - 1].x + right[right.length - 1].x) / 2,
    (left[left.length - 1].y + right[right.length - 1].y) / 2
  )
  shape.absarc(endCenter.x, endCenter.y, halfWidth, 
    Math.atan2(left[left.length - 1].y - endCenter.y, left[left.length - 1].x - endCenter.x),
    Math.atan2(right[right.length - 1].y - endCenter.y, right[right.length - 1].x - endCenter.x),
    true
  )
  for (let i = right.length - 1; i >= 0; i--) {
    shape.lineTo(right[i].x, right[i].y)
  }
  // Round start cap (semicircle at start)
  const startCenter = new THREE.Vector2(
    (left[0].x + right[0].x) / 2,
    (left[0].y + right[0].y) / 2
  )
  shape.absarc(startCenter.x, startCenter.y, halfWidth,
    Math.atan2(right[0].y - startCenter.y, right[0].x - startCenter.x),
    Math.atan2(left[0].y - startCenter.y, left[0].x - startCenter.x),
    true
  )
  shape.closePath()

  return shape
}

/** Auto-clamp bevel so it doesn't exceed half the extrusion depth */
function clampBevel(ep: ExtrudeParams): { bevelSize: number; bevelThickness: number; bevelSegments: number } {
  // THREE.ExtrudeGeometry bevel extends *outward* from the 2D shape outline,
  // so ribbon width does NOT constrain bevelSize. Only depth matters:
  // bevelThickness on each end eats into the extrusion, so cap at depth/2.
  const maxBevel = ep.depth * 0.5
  const bevelSize = Math.max(0, Math.min(ep.bevelSize, maxBevel))
  const bevelThickness = Math.max(0, Math.min(ep.bevelSize, bevelSize))
  const bevelSegments = Math.min(ep.bevelSegments, 6)
  return { bevelSize, bevelThickness, bevelSegments }
}

/**
 * Pass through user width directly. Small floor to avoid degenerate zero-width shapes.
 */
function computeEffectiveWidth(_filtered: THREE.Vector3[], userWidth: number): number {
  return Math.max(userWidth, 0.001)
}

/* ---- Contour validation ---- */

const EXTRUDE_CURVE_SEGMENTS = 12

/** Proper segment-segment intersection test (excluding shared endpoints). */
function segmentsIntersect(
  ax1: number, ay1: number, ax2: number, ay2: number,
  bx1: number, by1: number, bx2: number, by2: number
): boolean {
  const d1x = ax2 - ax1, d1y = ay2 - ay1
  const d2x = bx2 - bx1, d2y = by2 - by1

  const denom = d1x * d2y - d1y * d2x
  if (Math.abs(denom) < 1e-12) return false // parallel

  const t = ((bx1 - ax1) * d2y - (by1 - ay1) * d2x) / denom
  const u = ((bx1 - ax1) * d1y - (by1 - ay1) * d1x) / denom

  const eps = 1e-6
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps
}

/** Check if a 2D contour has self-intersections (O(n^2) segment test). */
function contourSelfIntersects(pts: THREE.Vector2[]): boolean {
  const n = pts.length
  if (n < 4) return false

  for (let i = 0; i < n; i++) {
    const a1 = pts[i]
    const a2 = pts[(i + 1) % n]
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue // skip wrap-around adjacent
      const b1 = pts[j]
      const b2 = pts[(j + 1) % n]
      if (segmentsIntersect(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) {
        return true
      }
    }
  }
  return false
}

/** Signed area of a 2D contour. */
function contourSignedArea(pts: THREE.Vector2[]): number {
  let area = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y)
  }
  return area / 2
}

/** Remove near-duplicate consecutive points from a contour. */
function deduplicateContour(pts: THREE.Vector2[], minDist = 1e-6): THREE.Vector2[] {
  if (pts.length < 2) return pts
  const out = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].distanceTo(out[out.length - 1]) > minDist) {
      out.push(pts[i])
    }
  }
  return out
}

/**
 * Validate a shape's flattened contour: no self-intersections, non-degenerate area,
 * enough unique vertices, reasonable edge lengths. Returns the deduplicated contour or null if invalid.
 */
function validateShapeContour(shape: THREE.Shape): THREE.Vector2[] | null {
  const raw = shape.getPoints(EXTRUDE_CURVE_SEGMENTS)
  const pts = deduplicateContour(raw)
  if (pts.length < 3) return null

  // Reject near-zero area shapes
  const area = Math.abs(contourSignedArea(pts))
  if (area < 1e-6) return null

  // Reject shapes where any edge is extremely short (causes triangulation issues)
  const minEdge = 1e-5
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    if (pts[i].distanceTo(pts[j]) < minEdge) return null
  }

  if (contourSelfIntersects(pts)) return null
  return pts
}

/**
 * Post-extrude sanity check: detect degenerate "sheet" triangles by comparing
 * bounding box dimensions. A valid extrude should have reasonable XY extent
 * relative to its Z extent. If the geometry has huge flat triangles, the
 * XY bbox will be disproportionately large relative to what the stroke covers.
 */
function isExtrudeGeometryDegenerate(
  geo: THREE.BufferGeometry,
  filtered: THREE.Vector3[],
  depth: number
): boolean {
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  if (!bb) return true

  const sizeX = bb.max.x - bb.min.x
  const sizeY = bb.max.y - bb.min.y
  const sizeZ = bb.max.z - bb.min.z

  // Compute expected stroke extent (from the filtered polyline)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of filtered) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const strokeExtentX = maxX - minX
  const strokeExtentY = maxY - minY

  // If the extruded geo is >3x the stroke extent in XY, it's probably a sheet
  const margin = 3.0
  if (sizeX > (strokeExtentX + 0.5) * margin) return true
  if (sizeY > (strokeExtentY + 0.5) * margin) return true

  // Z should be roughly depth (with bevel) — if it's wildly off, something broke
  if (sizeZ > depth * 5) return true

  return false
}

/**
 * Safely build an ExtrudeGeometry, catching any THREE.js triangulation errors.
 * Returns the geometry or null if construction fails or result is degenerate.
 */
function safeExtrude(
  shape: THREE.Shape,
  options: THREE.ExtrudeGeometryOptions,
  filtered: THREE.Vector3[],
  depth: number
): THREE.BufferGeometry | null {
  try {
    const geo = new THREE.ExtrudeGeometry(shape, options)
    // Check for empty geometry
    const posAttr = geo.attributes.position
    if (!posAttr || posAttr.count < 3) {
      geo.dispose()
      return null
    }
    // Check for degenerate sheet artifacts
    if (isExtrudeGeometryDegenerate(geo, filtered, depth)) {
      geo.dispose()
      return null
    }
    return geo
  } catch {
    return null
  }
}


/**
 * Try to build a valid ExtrudeGeometry for a stroke.
 * 1) If width < TINY_WIDTH_THRESHOLD, force bevel OFF to avoid degenerate extrusions.
 * 2) Try with bevel ON (if enabled and width not tiny).
 * 3) If fails and bevel was ON, retry with bevel OFF.
 * 4) If still fails, return rodFallback.
 */
function tryBuildExtrudeGeometry(
  filtered: THREE.Vector3[],
  extrudeParams: ExtrudeParams,
  userWidth: number,
  _si: number
): { geometry: THREE.BufferGeometry | null; status: StrokeBuildStatus } {
  const halfDepth = extrudeParams.depth / 2
  const bevel = clampBevel(extrudeParams)
  const fbRadius = fallbackRodRadius(userWidth)

  // Build shape once (same for all attempts)
  const shape = buildRibbonShape(filtered, userWidth)
  if (!shape) {
    console.log(`[v0] stroke ${_si} final: rodFallback`, { reason: "no shape" })
    return { geometry: null, status: { type: "rodFallback", reason: "no shape", fallbackRadius: fbRadius } }
  }

  const contour = validateShapeContour(shape)
  if (!contour) {
    console.log(`[v0] stroke ${_si} final: rodFallback`, { reason: "bad contour" })
    return { geometry: null, status: { type: "rodFallback", reason: "bad contour", fallbackRadius: fbRadius } }
  }

  // For tiny widths, skip bevel entirely to avoid degenerate geometry
  const isTinyWidth = userWidth < TINY_WIDTH_THRESHOLD
  const useBevel = extrudeParams.bevelEnabled && !isTinyWidth

  // Attempt 1: with bevel (if enabled and not tiny)
  if (useBevel) {
    const geo1 = safeExtrude(shape, {
      depth: extrudeParams.depth,
      bevelEnabled: true,
      bevelSize: bevel.bevelSize,
      bevelThickness: bevel.bevelThickness,
      bevelSegments: bevel.bevelSegments,
      curveSegments: EXTRUDE_CURVE_SEGMENTS,
    }, filtered, extrudeParams.depth)

    if (geo1) {
      geo1.translate(0, 0, -halfDepth)
      console.log(`[v0] stroke ${_si} final: extrude`, { width: userWidth, depth: extrudeParams.depth, bevelEnabled: true })
      return { geometry: geo1, status: { type: "ok", width: userWidth, depth: extrudeParams.depth, bevelEnabled: true } }
    }
  }

  // Attempt 2: bevel OFF (either because tiny width, or bevel attempt failed)
  const geo2 = safeExtrude(shape, {
    depth: extrudeParams.depth,
    bevelEnabled: false,
    curveSegments: EXTRUDE_CURVE_SEGMENTS,
  }, filtered, extrudeParams.depth)

  if (geo2) {
    geo2.translate(0, 0, -halfDepth)
    // Distinguish why bevel was off
    if (isTinyWidth && extrudeParams.bevelEnabled) {
      console.log(`[v0] stroke ${_si} final: extrude(bevelOffTinyWidth)`, { width: userWidth, depth: extrudeParams.depth })
      return { geometry: geo2, status: { type: "bevelOffTinyWidth", width: userWidth, depth: extrudeParams.depth } }
    }
    if (useBevel) {
      console.log(`[v0] stroke ${_si} final: extrude(bevelOff)`, { width: userWidth, depth: extrudeParams.depth })
      return { geometry: geo2, status: { type: "bevelOff", width: userWidth, depth: extrudeParams.depth } }
    }
    console.log(`[v0] stroke ${_si} final: extrude`, { width: userWidth, depth: extrudeParams.depth, bevelEnabled: false })
    return { geometry: geo2, status: { type: "ok", width: userWidth, depth: extrudeParams.depth, bevelEnabled: false } }
  }

  console.log(`[v0] stroke ${_si} final: rodFallback`, { reason: "extrude failed" })
  return { geometry: null, status: { type: "rodFallback", reason: "extrude failed", fallbackRadius: fbRadius } }
}

/** Derive fallback rod radius from extrude width so Width slider affects fallback strokes too */
function fallbackRodRadius(width: number): number {
  return Math.max(0.003, Math.min(width * 0.5, 0.08))
}

interface RodGeometryData {
  tubeGeometry: THREE.BufferGeometry
  curve: THREE.CatmullRomCurve3
  capPositions: THREE.Vector3[]
  jointPositions: THREE.Vector3[]
  jointFractions: number[]
}

/** Build full rod geometry data (tube + cap positions + joint positions) for a stroke */
function buildRodGeometryData(filtered: THREE.Vector3[], radius: number = TUBE_RADIUS): RodGeometryData {
  const curve = new THREE.CatmullRomCurve3(filtered, false, "centripetal")
  const tubularSegments = Math.min(
    Math.max(curve.points.length * TUBE_SEGMENTS_MULTIPLIER, 8),
    MAX_TUBULAR_SEGMENTS
  )
  const tubeGeometry = new THREE.TubeGeometry(curve, tubularSegments, radius, RADIAL_SEGMENTS, false)

  // Inset cap spheres slightly along tangent so they sit inside the tube ends
  const inset = radius * 0.35
  const startTangent = curve.getTangentAt(0)
  const endTangent = curve.getTangentAt(1)
  const startCapPos = filtered[0].clone().addScaledVector(startTangent, inset)
  const endCapPos = filtered[filtered.length - 1].clone().addScaledVector(endTangent, -inset)
  const capPositions = [startCapPos, endCapPos]

  const { positions: jointPositions, fractions: jointFractions } = detectJoints3D(
    filtered, filtered[0], filtered[filtered.length - 1]
  )

  return { tubeGeometry, curve, capPositions, jointPositions, jointFractions }
}

/** Build merged capped rod geometry (tube + cap spheres + joint spheres) for export */
function buildCappedRodGeometry(filtered: THREE.Vector3[], radius: number = TUBE_RADIUS): THREE.BufferGeometry {
  const { tubeGeometry, capPositions, jointPositions } = buildRodGeometryData(filtered, radius)
  
  const capSphere = new THREE.SphereGeometry(radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
  
  const startCapGeo = capSphere.clone().translate(capPositions[0].x, capPositions[0].y, capPositions[0].z)
  const endCapGeo = capSphere.clone().translate(capPositions[1].x, capPositions[1].y, capPositions[1].z)
  
  const jointGeos: THREE.BufferGeometry[] = []
  for (const pos of jointPositions) {
    jointGeos.push(capSphere.clone().translate(pos.x, pos.y, pos.z))
  }
  
  const parts = [tubeGeometry, startCapGeo, endCapGeo, ...jointGeos]
  const merged = mergeGeometriesSafe(parts, false)
  
  // Dispose cap/joint geometries (but NOT tubeGeometry if merge failed)
  capSphere.dispose()
  
  if (merged) {
    // Merge succeeded - dispose all parts
    tubeGeometry.dispose()
    startCapGeo.dispose()
    endCapGeo.dispose()
    jointGeos.forEach((g) => g.dispose())
    return merged
  }
  
  // Merge failed - dispose only the extra parts, return tube as fallback
  startCapGeo.dispose()
  endCapGeo.dispose()
  jointGeos.forEach((g) => g.dispose())
  return tubeGeometry
}

export const ExtrudeEngine: GeometryEngine = {
  buildPreview(strokes: ProcessedStroke[], params: PreviewParams): StrokeMeshData[] {
    const { canvasWidth, canvasHeight, extrudeParams: ep } = params
    const extrudeParams = ep ?? DEFAULT_EXTRUDE_PARAMS
    if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) return []

    const result: StrokeMeshData[] = []

    for (let si = 0; si < strokes.length; si++) {
      const stroke = strokes[si]
      if (stroke.points.length < 2) continue

      const pts3d = strokeTo3D(stroke, canvasWidth, canvasHeight)
      const filtered = filterDuplicates(pts3d)
      if (filtered.length < 2) continue
      if (computeArcLength(filtered) < MIN_STROKE_LENGTH) continue

      const effectiveWidth = computeEffectiveWidth(filtered, extrudeParams.width)
      const { geometry, status } = tryBuildExtrudeGeometry(filtered, extrudeParams, effectiveWidth, si)

      if (geometry) {
        result.push({
          tubeGeometry: geometry,
          filteredCount: filtered.length,
          key: `stroke-${si}-${stroke.points.length}`,
          mode: "extrude",
          buildStatus: status,
        })
      } else {
        // Fallback to rod - same builder as Rod mode but with radius derived from Width slider
        const fbRadius = fallbackRodRadius(extrudeParams.width)
        const rodData = buildRodGeometryData(filtered, fbRadius)
        result.push({
          tubeGeometry: rodData.tubeGeometry,
          curve: rodData.curve,
          capPositions: rodData.capPositions,
          capRadius: fbRadius,
          jointPositions: rodData.jointPositions,
          jointFractions: rodData.jointFractions,
          filteredCount: filtered.length,
          key: `stroke-${si}-${stroke.points.length}-rod-fallback`,
          mode: "rod",
          buildStatus: status,
        })
      }
    }

    return result
  },

  buildExport(strokes: ProcessedStroke[], params: ExportParams): ExportResult {
    const { canvasWidth, canvasHeight, extrudeParams: ep } = params
    const extrudeParams = ep ?? DEFAULT_EXTRUDE_PARAMS
    const canMerge = typeof mergeGeometriesSafe === "function"

    const inkMaterial = new THREE.MeshStandardMaterial({ color: "#1a1a1a", name: "Ink" })
    const exportObjects: THREE.Object3D[] = []
    const disposables: THREE.BufferGeometry[] = []

    for (let si = 0; si < strokes.length; si++) {
      const stroke = strokes[si]
      if (stroke.points.length < 2) continue

      const pts3d = strokeTo3D(stroke, canvasWidth, canvasHeight)
      const filtered = filterDuplicates(pts3d)
      if (filtered.length < 2) continue
      if (computeArcLength(filtered) < MIN_STROKE_LENGTH) continue

      const effectiveWidth = computeEffectiveWidth(filtered, extrudeParams.width)
      const { geometry, status } = tryBuildExtrudeGeometry(filtered, extrudeParams, effectiveWidth, si)

      const strokeName = `stroke_${String(si).padStart(3, "0")}`
      // Use capped rod geometry for fallback with radius derived from Width slider
      const fbRadius = fallbackRodRadius(extrudeParams.width)
      const finalGeo = geometry ?? buildCappedRodGeometry(filtered, fbRadius)
      const mesh = new THREE.Mesh(finalGeo, inkMaterial)
      mesh.name = strokeName
      exportObjects.push(mesh)
      disposables.push(finalGeo)
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
      mode: "extrude",
      exportedAt: new Date().toISOString(),
      strokeCount: params.strokeCount,
      totalPoints: params.totalPoints,
      settings: {
        ...params.settings,
        extrudeWidth: extrudeParams.width,
        extrudeDepth: extrudeParams.depth,
        bevelEnabled: extrudeParams.bevelEnabled,
      },
    }

    for (const obj of exportObjects) {
      rootGroup.add(obj)
    }

    inkMaterial.dispose()

    return {
      group: rootGroup,
      disposables,
      objectCount: exportObjects.length,
      merged: canMerge,
    }
  },
}

/* ------------------------------------------------------------------ */
/*  SolidEngine — raster mask -> marching squares -> extrude          */
/* ------------------------------------------------------------------ */

const SOLID_RASTER_SIZE = 512
/** Minimum contour area (in raster pixels squared) to keep — filters tiny noise islands */
const MIN_CONTOUR_AREA = 50  // Increased from 25 for stricter filtering
/** Minimum distance between consecutive points to consider distinct */
const MIN_POINT_DIST = 0.5
/** Douglas-Peucker tolerance — set to 0 to DISABLE simplification during debugging */
const DP_TOLERANCE = 0  // DISABLED: was 0.3, simplification can break contours

/** Remove near-duplicate consecutive points from a contour */
function deduplicateContourStrict(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  if (pts.length < 2) return pts
  const result: { x: number; y: number }[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    const prev = result[result.length - 1]
    const dx = pts[i].x - prev.x
    const dy = pts[i].y - prev.y
    if (Math.sqrt(dx * dx + dy * dy) >= MIN_POINT_DIST) {
      result.push(pts[i])
    }
  }
  // Also check if last point is too close to first (for closed contours)
  if (result.length > 2) {
    const first = result[0]
    const last = result[result.length - 1]
    const dx = last.x - first.x
    const dy = last.y - first.y
    if (Math.sqrt(dx * dx + dy * dy) < MIN_POINT_DIST) {
      result.pop()
    }
  }
  return result
}

/** Check if a contour is closed (first point near last point) */
function isContourClosed(pts: { x: number; y: number }[], threshold: number = 2.0): boolean {
  if (pts.length < 3) return false
  const first = pts[0]
  const last = pts[pts.length - 1]
  const dx = last.x - first.x
  const dy = last.y - first.y
  return Math.sqrt(dx * dx + dy * dy) < threshold
}

/** Ensure contour has CCW winding (positive area). Returns reversed if needed. */
function ensureWindingCCW(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  const area = signedAreaRaw(pts)
  return area >= 0 ? pts : pts.slice().reverse()
}

/** Ensure contour has CW winding (negative area). Returns reversed if needed. */
function ensureWindingCW(pts: { x: number; y: number }[]): { x: number; y: number }[] {
  const area = signedAreaRaw(pts)
  return area <= 0 ? pts : pts.slice().reverse()
}

/** Signed area without abs - positive = CCW, negative = CW */
function signedAreaRaw(pts: { x: number; y: number }[]): number {
  let area = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y)
  }
  return area / 2
}

/** Check if two line segments intersect (excluding shared endpoints) - object-based version */
function segmentsIntersect2D(
  a1: { x: number; y: number }, a2: { x: number; y: number },
  b1: { x: number; y: number }, b2: { x: number; y: number }
): boolean {
  const d1x = a2.x - a1.x, d1y = a2.y - a1.y
  const d2x = b2.x - b1.x, d2y = b2.y - b1.y
  const cross = d1x * d2y - d1y * d2x
  if (Math.abs(cross) < 1e-10) return false // parallel
  
  const dx = b1.x - a1.x, dy = b1.y - a1.y
  const t = (dx * d2y - dy * d2x) / cross
  const u = (dx * d1y - dy * d1x) / cross
  
  // Exclude endpoints (t and u strictly between 0 and 1)
  const eps = 1e-6
  return t > eps && t < 1 - eps && u > eps && u < 1 - eps
}

/** Check if a contour self-intersects (any non-adjacent edges cross) */
function contourSelfIntersects2D(pts: { x: number; y: number }[]): boolean {
  const n = pts.length
  if (n < 4) return false
  
  for (let i = 0; i < n; i++) {
    const a1 = pts[i]
    const a2 = pts[(i + 1) % n]
    // Check against non-adjacent edges
    for (let j = i + 2; j < n; j++) {
      // Skip if j+1 wraps to i (adjacent edge)
      if (j === n - 1 && i === 0) continue
      const b1 = pts[j]
      const b2 = pts[(j + 1) % n]
      if (segmentsIntersect2D(a1, a2, b1, b2)) return true
    }
  }
  return false
}

/**
 * Rasterize processedStrokes into a binary mask on an offscreen 2D canvas.
 * Returns a boolean[] of size S*S (row-major, true = filled).
 */
function rasterizeMask(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
  lineWidth: number
): boolean[] {
  const S = SOLID_RASTER_SIZE
  let canvas: OffscreenCanvas | HTMLCanvasElement
  let ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null
  if (typeof OffscreenCanvas !== "undefined") {
    canvas = new OffscreenCanvas(S, S)
    ctx = canvas.getContext("2d")
  } else {
    canvas = document.createElement("canvas")
    canvas.width = S
    canvas.height = S
    ctx = canvas.getContext("2d")
  }
  if (!ctx) return new Array(S * S).fill(false)

  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, S, S)

  const scaleX = S / canvasWidth
  const scaleY = S / canvasHeight

  ctx.strokeStyle = "#fff"
  ctx.lineWidth = lineWidth * Math.max(scaleX, scaleY)
  ctx.lineCap = "round"
  ctx.lineJoin = "round"

  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue
    ctx.beginPath()
    ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY)
    }
    ctx.stroke()
  }

  const imageData = ctx.getImageData(0, 0, S, S)
  const mask: boolean[] = new Array(S * S)
  for (let i = 0; i < S * S; i++) {
    mask[i] = imageData.data[i * 4] > 128
  }
  return mask
}

/* ---- Marching Squares ---- */

/**
 * Edge segment key: encode two grid-edge endpoints into a string for hashing.
 * Each endpoint is (x*2, y*2) to avoid fractional keys — marching squares
 * vertices lie on half-integer grid positions.
 */
function edgeKey(ax: number, ay: number): string {
  // Multiply by 2 to get integer keys for half-positions
  return `${Math.round(ax * 2)},${Math.round(ay * 2)}`
}

interface Seg { ax: number; ay: number; bx: number; by: number }

/**
 * Run marching squares on a binary mask of size S*S.
 * Returns an array of closed contour polylines (each is an array of {x,y}).
 * Coordinates are in raster space [0..S].
 */
function marchingSquaresContours(mask: boolean[], S: number): { x: number; y: number }[][] {
  // Sample the mask: val(row, col) — treat out-of-bounds as false
  const val = (r: number, c: number): boolean => {
    if (r < 0 || r >= S || c < 0 || c >= S) return false
    return mask[r * S + c]
  }

  // Collect edge segments from each 2x2 cell
  const segments: Seg[] = []

  for (let row = 0; row <= S; row++) {
    for (let col = 0; col <= S; col++) {
      // Four corners of the cell: TL, TR, BR, BL
      // Each corner samples mask[row-1][col-1], etc.
      const tl = val(row - 1, col - 1) ? 1 : 0
      const tr = val(row - 1, col) ? 1 : 0
      const br = val(row, col) ? 1 : 0
      const bl = val(row, col - 1) ? 1 : 0

      const cellCase = (tl << 3) | (tr << 2) | (br << 1) | bl

      if (cellCase === 0 || cellCase === 15) continue

      // Edge midpoints (in grid coordinates where cell top-left = (col, row)):
      // top    = (col + 0.5, row)
      // right  = (col + 1,   row + 0.5)
      // bottom = (col + 0.5, row + 1)
      // left   = (col,       row + 0.5)
      const tx = col + 0.5, ty = row
      const rx = col + 1,   ry = row + 0.5
      const bx = col + 0.5, by = row + 1
      const lx = col,       ly = row + 0.5

      // 16-case lookup — emit 1 or 2 segments per cell
      switch (cellCase) {
        case 1:  segments.push({ ax: lx, ay: ly, bx: bx, by: by }); break
        case 2:  segments.push({ ax: bx, ay: by, bx: rx, by: ry }); break
        case 3:  segments.push({ ax: lx, ay: ly, bx: rx, by: ry }); break
        case 4:  segments.push({ ax: tx, ay: ty, bx: rx, by: ry }); break
        case 5:  // Saddle: TL + BR on
          segments.push({ ax: lx, ay: ly, bx: tx, by: ty })
          segments.push({ ax: bx, ay: by, bx: rx, by: ry })
          break
        case 6:  segments.push({ ax: tx, ay: ty, bx: bx, by: by }); break
        case 7:  segments.push({ ax: lx, ay: ly, bx: tx, by: ty }); break
        case 8:  segments.push({ ax: tx, ay: ty, bx: lx, by: ly }); break
        case 9:  segments.push({ ax: tx, ay: ty, bx: bx, by: by }); break
        case 10: // Saddle: TR + BL on
          segments.push({ ax: tx, ay: ty, bx: rx, by: ry })
          segments.push({ ax: lx, ay: ly, bx: bx, by: by })
          break
        case 11: segments.push({ ax: tx, ay: ty, bx: rx, by: ry }); break
        case 12: segments.push({ ax: lx, ay: ly, bx: rx, by: ry }); break
        case 13: segments.push({ ax: bx, ay: by, bx: rx, by: ry }); break
        case 14: segments.push({ ax: lx, ay: ly, bx: bx, by: by }); break
      }
    }
  }

  if (segments.length === 0) return []

  // Chain segments into closed contours using an adjacency map
  const adj = new Map<string, { x: number; y: number; key: string }[]>()
  for (const seg of segments) {
    const ka = edgeKey(seg.ax, seg.ay)
    const kb = edgeKey(seg.bx, seg.by)
    if (!adj.has(ka)) adj.set(ka, [])
    if (!adj.has(kb)) adj.set(kb, [])
    adj.get(ka)!.push({ x: seg.bx, y: seg.by, key: kb })
    adj.get(kb)!.push({ x: seg.ax, y: seg.ay, key: ka })
  }

  const visited = new Set<string>()
  const contours: { x: number; y: number }[][] = []

  for (const [startKey, neighbors] of adj) {
    if (visited.has(startKey) || neighbors.length === 0) continue

    const contour: { x: number; y: number }[] = []
    let currentKey = startKey
    // Decode startKey back to coords
    const parts = startKey.split(",")
    let cx = parseInt(parts[0]) / 2
    let cy = parseInt(parts[1]) / 2

    // Walk the chain
    for (let step = 0; step < segments.length * 2 + 1; step++) {
      contour.push({ x: cx, y: cy })
      visited.add(currentKey)

      const nexts = adj.get(currentKey)
      if (!nexts) break

      // Find first unvisited neighbor
      let found = false
      for (let ni = 0; ni < nexts.length; ni++) {
        const n = nexts[ni]
        if (!visited.has(n.key)) {
          cx = n.x
          cy = n.y
          currentKey = n.key
          // Remove this edge (mark as used) by splicing
          nexts.splice(ni, 1)
          // Also remove reverse
          const rev = adj.get(n.key)
          if (rev) {
            const ri = rev.findIndex((r) => r.key === contour[contour.length - 1] ? false : edgeKey(contour[contour.length - 1].x, contour[contour.length - 1].y) === currentKey)
            // Simple: remove first entry pointing back
            for (let rj = 0; rj < rev.length; rj++) {
              if (rev[rj].key === edgeKey(contour[contour.length - 1].x, contour[contour.length - 1].y)) {
                rev.splice(rj, 1)
                break
              }
            }
          }
          found = true
          break
        }
      }

      if (!found) break // closed or dead-end
    }

    if (contour.length >= 3) {
      contours.push(contour)
    }
  }

  return contours
}

/* ---- Douglas-Peucker simplification ---- */

function dpSimplify(pts: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] {
  if (pts.length <= 2) return pts

  // Find the point with the maximum distance from the line (first, last)
  let maxDist = 0
  let maxIdx = 0
  const first = pts[0]
  const last = pts[pts.length - 1]
  const dx = last.x - first.x
  const dy = last.y - first.y
  const lineLenSq = dx * dx + dy * dy

  for (let i = 1; i < pts.length - 1; i++) {
    let dist: number
    if (lineLenSq < 1e-10) {
      const ex = pts[i].x - first.x
      const ey = pts[i].y - first.y
      dist = Math.sqrt(ex * ex + ey * ey)
    } else {
      const t = Math.max(0, Math.min(1, ((pts[i].x - first.x) * dx + (pts[i].y - first.y) * dy) / lineLenSq))
      const px = first.x + t * dx
      const py = first.y + t * dy
      const ex = pts[i].x - px
      const ey = pts[i].y - py
      dist = Math.sqrt(ex * ex + ey * ey)
    }
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }

  if (maxDist > tolerance) {
    const left = dpSimplify(pts.slice(0, maxIdx + 1), tolerance)
    const right = dpSimplify(pts.slice(maxIdx), tolerance)
    return left.slice(0, -1).concat(right)
  }

  return [first, last]
}

/* ---- Contour classification (outer vs hole) ---- */

/** Signed area of a 2D polygon. Positive = CCW, negative = CW. */
function signedArea(pts: { x: number; y: number }[]): number {
  let area = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y)
  }
  return area / 2
}

/** Point-in-polygon (ray casting). */
function pointInPolygon(px: number, py: number, poly: { x: number; y: number }[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y
    const xj = poly[j].x, yj = poly[j].y
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

interface ClassifiedContours {
  outer: { x: number; y: number }[]
  holes: { x: number; y: number }[][]
}

/**
 * Classify contours into outer boundary + holes.
 * - Sort by absolute area descending.
 * - Largest = outer shape.
 * - Remaining contours that have a sample point inside the outer = holes.
 * - Remaining contours that are outside the outer = separate outer shapes
 *   (we merge them all into one Shape with multiple sub-paths).
 */
function classifyContours(contours: { x: number; y: number }[][]): ClassifiedContours[] {
  if (contours.length === 0) return []

  // Compute areas and sort by absolute area descending
  const withArea = contours.map((c) => ({ contour: c, area: signedArea(c) }))
  withArea.sort((a, b) => Math.abs(b.area) - Math.abs(a.area))

  const used = new Set<number>()
  const results: ClassifiedContours[] = []

  for (let i = 0; i < withArea.length; i++) {
    if (used.has(i)) continue
    used.add(i)

    const outer = withArea[i].contour
    const holes: { x: number; y: number }[][] = []

    // Find holes: smaller contours whose first point is inside this outer
    for (let j = i + 1; j < withArea.length; j++) {
      if (used.has(j)) continue
      const candidate = withArea[j].contour
      if (candidate.length > 0 && pointInPolygon(candidate[0].x, candidate[0].y, outer)) {
        holes.push(candidate)
        used.add(j)
      }
    }

    results.push({ outer, holes })
  }

  return results
}

/** Compute absolute area of a 2D contour in raster space */
function contourArea(pts: { x: number; y: number }[]): number {
  let area = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y)
  }
  return Math.abs(area / 2)
}

interface SolidBuildResult {
  geometry: THREE.BufferGeometry | null
  contourCount: number
  holesCount: number
  rawContourCount: number
  rejectedCount: number
  validOuterCount: number
  openContourCount: number
  selfIntersectCount: number
  debugContours: SolidDebugContour[]
}

/**
 * Build a watertight extruded mesh from raster mask contours.
 * Pipeline: rasterize -> marching squares -> dedupe -> simplify -> validate -> classify -> winding -> Shape -> ExtrudeGeometry
 */
function buildSolidMeshFromMask(
  mask: boolean[],
  canvasWidth: number,
  canvasHeight: number,
  depth: number
): SolidBuildResult {
  const S = SOLID_RASTER_SIZE
  const scaleRef = Math.max(canvasWidth, canvasHeight)
  const normScale = 3 / scaleRef

  // Convert raster coords -> world coords (matching strokeTo3D transform)
  const toWorldX = (rx: number) => ((rx / S) * canvasWidth - canvasWidth / 2) * normScale
  const toWorldY = (ry: number) => -((ry / S) * canvasHeight - canvasHeight / 2) * normScale

  const debugContours: SolidDebugContour[] = []
  const emptyResult: SolidBuildResult = {
    geometry: null, contourCount: 0, holesCount: 0,
    rawContourCount: 0, rejectedCount: 0, validOuterCount: 0, openContourCount: 0, selfIntersectCount: 0, debugContours
  }

  // 1) Extract contours via marching squares
  const rawContours = marchingSquaresContours(mask, S)
  if (rawContours.length === 0) return emptyResult

  // 2) Deduplicate + simplify contours
  let rejectedCount = 0
  let openContourCount = 0
  let selfIntersectCount = 0
  const validated: { x: number; y: number }[][] = []

  for (const raw of rawContours) {
    // Deduplicate near-duplicate points
    const deduped = deduplicateContourStrict(raw)
    
    // Only simplify if tolerance > 0 (currently disabled for debugging)
    const simplified = DP_TOLERANCE > 0 ? dpSimplify(deduped, DP_TOLERANCE) : deduped
    
    // Reject if too few points
    if (simplified.length < 4) {
      debugContours.push({
        points: simplified,
        type: "rejected",
        reason: "too few points",
        area: contourArea(simplified),
        isClosed: false
      })
      rejectedCount++
      continue
    }

    // Check if closed
    const closed = isContourClosed(simplified)
    if (!closed) {
      debugContours.push({
        points: simplified,
        type: "rejected",
        reason: "open contour",
        area: contourArea(simplified),
        isClosed: false
      })
      openContourCount++
      rejectedCount++
      continue
    }

    // Filter by area
    const area = contourArea(simplified)
    if (area < MIN_CONTOUR_AREA) {
      debugContours.push({
        points: simplified,
        type: "rejected",
        reason: "too small",
        area,
        isClosed: true
      })
      rejectedCount++
      continue
    }

    // Reject self-intersecting contours
    if (contourSelfIntersects2D(simplified)) {
      debugContours.push({
        points: simplified,
        type: "rejected",
        reason: "self-intersects",
        area,
        isClosed: true
      })
      selfIntersectCount++
      rejectedCount++
      continue
    }

    validated.push(simplified)
  }

  if (validated.length === 0) {
    return { ...emptyResult, rawContourCount: rawContours.length, rejectedCount, openContourCount, selfIntersectCount, debugContours }
  }

  // 3) Classify into outer + holes
  const classified = classifyContours(validated)
  if (classified.length === 0) {
    return {
      geometry: null, contourCount: validated.length, holesCount: 0,
      rawContourCount: rawContours.length, rejectedCount, validOuterCount: 0, openContourCount, selfIntersectCount, debugContours
    }
  }

  // Count total holes and add debug entries
  let totalHoles = 0
  for (const group of classified) {
    // Add outer to debug
    debugContours.push({
      points: group.outer,
      type: "outer",
      area: contourArea(group.outer),
      isClosed: true
    })
    for (const hole of group.holes) {
      debugContours.push({
        points: hole,
        type: "hole",
        area: contourArea(hole),
        isClosed: true
      })
      totalHoles++
    }
  }

  // 4) Build THREE.Shape(s) with consistent winding and extrude
  const geometries: THREE.BufferGeometry[] = []
  const halfDepth = depth / 2

  for (const group of classified) {
    // Ensure outer is CCW (positive area in screen coords = CCW)
    const outerCCW = ensureWindingCCW(group.outer)
    const shapePts = outerCCW.map((p) => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y)))
    if (shapePts.length < 3) continue

    const shape = new THREE.Shape(shapePts)

    // Add holes with CW winding (opposite to outer)
    for (const hole of group.holes) {
      const holeCW = ensureWindingCW(hole)
      const holePts = holeCW.map((p) => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y)))
      if (holePts.length < 3) continue
      shape.holes.push(new THREE.Path(holePts))
    }

    try {
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: 1,
      })
      geo.translate(0, 0, -halfDepth)
      geometries.push(geo)
    } catch {
      // Triangulation can fail on degenerate shapes — skip silently
      continue
    }
  }

  const resultBase = {
    contourCount: classified.length,
    holesCount: totalHoles,
    rawContourCount: rawContours.length,
    rejectedCount,
    validOuterCount: classified.length,
    openContourCount,
    selfIntersectCount,
    debugContours
  }

  if (geometries.length === 0) return { geometry: null, ...resultBase }
  if (geometries.length === 1) return { geometry: geometries[0], ...resultBase }

  // Merge multiple shapes into one geometry
  const merged = mergeGeometriesSafe(geometries, false)
  for (const g of geometries) g.dispose()
  return { geometry: merged || null, ...resultBase }
}

export const SolidEngine: GeometryEngine = {
  buildPreview(strokes: ProcessedStroke[], params: PreviewParams): StrokeMeshData[] {
    const { canvasWidth, canvasHeight, solidParams: sp } = params
    const solidParams = sp ?? DEFAULT_SOLID_PARAMS
    if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) return []

    const mask = rasterizeMask(strokes, canvasWidth, canvasHeight, solidParams.thickness)
    const result = buildSolidMeshFromMask(mask, canvasWidth, canvasHeight, solidParams.depth)

    const solidStatus: SolidBuildStatus = {
      success: result.geometry !== null,
      contourCount: result.contourCount,
      holesCount: result.holesCount,
      thickness: solidParams.thickness,
      depth: solidParams.depth,
      rawContourCount: result.rawContourCount,
      rejectedCount: result.rejectedCount,
      validOuterCount: result.validOuterCount,
      openContourCount: result.openContourCount,
      selfIntersectCount: result.selfIntersectCount,
      debugContours: result.debugContours,
      rasterSize: SOLID_RASTER_SIZE,
    }

    if (!result.geometry) return []

    return [{
      tubeGeometry: result.geometry,
      filteredCount: strokes.reduce((sum, s) => sum + s.points.length, 0),
      key: `solid-${strokes.length}-${solidParams.thickness}-${solidParams.depth}`,
      mode: "solid",
      solidStatus,
    }]
  },

  buildExport(strokes: ProcessedStroke[], params: ExportParams): ExportResult {
    const { canvasWidth, canvasHeight, solidParams: sp } = params
    const solidParams = sp ?? DEFAULT_SOLID_PARAMS

    const inkMaterial = new THREE.MeshStandardMaterial({ color: "#1a1a1a", name: "Ink" })
    const disposables: THREE.BufferGeometry[] = []

    const mask = rasterizeMask(strokes, canvasWidth, canvasHeight, solidParams.thickness)
    const result = buildSolidMeshFromMask(mask, canvasWidth, canvasHeight, solidParams.depth)
    const geometry = result.geometry

    const rootGroup = new THREE.Group()
    rootGroup.name = "FreeStroke"
    rootGroup.userData = {
      app: "Free Stroke",
      mode: "solid",
      exportedAt: new Date().toISOString(),
      strokeCount: params.strokeCount,
      totalPoints: params.totalPoints,
      settings: {
        ...params.settings,
        solidThickness: solidParams.thickness,
        solidDepth: solidParams.depth,
      },
    }

    if (geometry) {
      // Recenter at origin
      geometry.computeBoundingBox()
      const center = new THREE.Vector3()
      geometry.boundingBox?.getCenter(center)
      geometry.translate(-center.x, -center.y, -center.z)

      const mesh = new THREE.Mesh(geometry, inkMaterial)
      mesh.name = "solid_000"
      rootGroup.add(mesh)
      disposables.push(geometry)
    }

    inkMaterial.dispose()

    return {
      group: rootGroup,
      disposables,
      objectCount: geometry ? 1 : 0,
      merged: true,
    }
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
  solid: SolidEngine,
  inflate: InflateEngine,
}

export function getEngine(mode: GeometryMode): GeometryEngine {
  return engines[mode]
}
