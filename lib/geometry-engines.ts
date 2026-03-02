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

/** Per-stroke mesh data used by the viewport for rendering + animation */
export interface StrokeMeshData {
  /** The geometry — TubeGeometry for rod, ExtrudeGeometry for extrude */
  tubeGeometry: THREE.BufferGeometry
  /** Curve for rod-mode animation (undefined for extrude) */
  curve?: THREE.CatmullRomCurve3
  /** Cap positions for rod-mode caps (undefined for extrude) */
  capPositions?: THREE.Vector3[]
  /** Joint positions for rod-mode joints (undefined for extrude) */
  jointPositions?: THREE.Vector3[]
  jointFractions?: number[]
  filteredCount: number
  key: string
  /** Geometry mode that produced this mesh data */
  mode: GeometryMode
  /**
   * Per-filtered-point timestamps (ms, relative to stroke start = 0).
   * Used for continuous reveal interpolation so the animation follows
   * the actual pen speed rather than advancing at a uniform rate.
   */
  pointTimestamps?: number[]
  /**
   * Cumulative arc-length at each filtered point (world units, starting at 0).
   * Used with pointTimestamps for arc-length-based progress mapping
   * so curves reveal at constant spatial speed instead of per-index stepping.
   */
  pointArcLengths?: number[]
  /**
   * Normalized time fractions [0..1] at each filtered point.
   * timeFracs[i] = pointTimestamps[i] / pointTimestamps[last]
   */
  timeFracs?: number[]
  /**
   * Normalized distance fractions [0..1] at each filtered point.
   * distFracs[i] = pointArcLengths[i] / pointArcLengths[last]
   */
  distFracs?: number[]
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

      const shape = buildRibbonShape(filtered, extrudeParams.width)
      if (!shape) continue

      const halfDepth = extrudeParams.depth / 2
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: extrudeParams.depth,
        bevelEnabled: extrudeParams.bevelEnabled,
        bevelSize: extrudeParams.bevelSize,
        bevelThickness: extrudeParams.bevelSize,
        bevelSegments: extrudeParams.bevelSegments,
        curveSegments: 12,
      })

      // Center the extrusion on z=0 (ExtrudeGeometry extrudes along +z from 0)
      geometry.translate(0, 0, -halfDepth)

      result.push({
        tubeGeometry: geometry,
        filteredCount: filtered.length,
        key: `stroke-${si}-${stroke.points.length}`,
        mode: "extrude",
      })
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

      const shape = buildRibbonShape(filtered, extrudeParams.width)
      if (!shape) continue

      const halfDepth = extrudeParams.depth / 2
      const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: extrudeParams.depth,
        bevelEnabled: extrudeParams.bevelEnabled,
        bevelSize: extrudeParams.bevelSize,
        bevelThickness: extrudeParams.bevelSize,
        bevelSegments: extrudeParams.bevelSegments,
        curveSegments: 12,
      })
      geometry.translate(0, 0, -halfDepth)

      const strokeName = `stroke_${String(si).padStart(3, "0")}`
      const mesh = new THREE.Mesh(geometry, inkMaterial)
      mesh.name = strokeName
      exportObjects.push(mesh)
      disposables.push(geometry)
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
/*  SolidEngine — raster mask -> voxel extrude (watertight spike)     */
/* ------------------------------------------------------------------ */

const SOLID_RASTER_SIZE = 512 // offscreen canvas resolution

/**
 * Rasterize processedStrokes into a binary mask on an offscreen 2D canvas.
 * Returns a boolean[] of size SOLID_RASTER_SIZE^2 (row-major, true = filled).
 */
function rasterizeMask(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
  lineWidth: number
): boolean[] {
  const S = SOLID_RASTER_SIZE
  // Use OffscreenCanvas if available, otherwise fallback to document.createElement
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

  // Map from stroke coordinate space -> raster space
  // Stroke points are in pixel space (0..canvasWidth, 0..canvasHeight)
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
    // Check red channel (white = 255, black = 0), threshold at 128
    mask[i] = imageData.data[i * 4] > 128
  }
  return mask
}

/**
 * Build a coarse grid mesh from the binary mask.
 * For efficiency, uses greedy row-run merging: for each row, merge
 * consecutive filled pixels into a single box spanning the run.
 * Then extrude each run box to the specified depth.
 */
function buildSolidMesh(
  mask: boolean[],
  canvasWidth: number,
  canvasHeight: number,
  depth: number
): THREE.BufferGeometry | null {
  const S = SOLID_RASTER_SIZE
  const scaleRef = Math.max(canvasWidth, canvasHeight)
  const normScale = 3 / scaleRef
  const pixelSize = 1 / S // in raster coords

  // Convert raster (row, col) -> world (x, y) matching strokeTo3D transform
  const toWorldX = (col: number) => ((col / S) * canvasWidth - canvasWidth / 2) * normScale
  const toWorldY = (row: number) => -((row / S) * canvasHeight - canvasHeight / 2) * normScale

  const halfDepth = depth / 2
  const boxes: THREE.BufferGeometry[] = []

  // Greedy row-run merge
  for (let row = 0; row < S; row++) {
    let col = 0
    while (col < S) {
      if (!mask[row * S + col]) {
        col++
        continue
      }
      // Find run end
      let runEnd = col
      while (runEnd < S && mask[row * S + runEnd]) runEnd++

      const runLen = runEnd - col

      // World coordinates for this run
      const x0 = toWorldX(col)
      const x1 = toWorldX(runEnd)
      const y0 = toWorldY(row)
      const y1 = toWorldY(row + 1)

      const w = Math.abs(x1 - x0)
      const h = Math.abs(y1 - y0)
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2

      const box = new THREE.BoxGeometry(w, h, depth)
      box.translate(cx, cy, 0)
      boxes.push(box)

      col = runEnd
    }
  }

  if (boxes.length === 0) return null

  // Merge all boxes into one geometry
  const merged = mergeGeometriesSafe(boxes, false)

  // Dispose individual boxes
  for (const b of boxes) b.dispose()

  return merged || null
}

export const SolidEngine: GeometryEngine = {
  buildPreview(strokes: ProcessedStroke[], params: PreviewParams): StrokeMeshData[] {
    const { canvasWidth, canvasHeight, solidParams: sp } = params
    const solidParams = sp ?? DEFAULT_SOLID_PARAMS
    if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) return []

    const mask = rasterizeMask(strokes, canvasWidth, canvasHeight, solidParams.thickness)
    const geometry = buildSolidMesh(mask, canvasWidth, canvasHeight, solidParams.depth)

    if (!geometry) return []

    return [{
      tubeGeometry: geometry,
      filteredCount: strokes.reduce((sum, s) => sum + s.points.length, 0),
      key: `solid-${strokes.length}-${solidParams.thickness}-${solidParams.depth}`,
      mode: "solid",
    }]
  },

  buildExport(_strokes: ProcessedStroke[], _params: ExportParams): ExportResult {
    // TODO: Solid export in a future iteration
    const group = new THREE.Group()
    group.name = "FreeStroke"
    group.userData = { app: "Free Stroke", mode: "solid" }
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
  solid: SolidEngine,
  inflate: InflateEngine,
}

export function getEngine(mode: GeometryMode): GeometryEngine {
  return engines[mode]
}
