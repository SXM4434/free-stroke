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
import { buildMaskSolid, type TestStroke, type MaskSolidResult } from "@/lib/solid-mask"

/**
 * GLOBAL SOLID DEBUG STATE - written by SolidEngine, read by UI overlay
 * Failure buckets:
 * A = SolidEngine never called
 * B = buildMaskSolid never called (early return)
 * C = buildMaskSolid returned failure/null geometry
 * D = geometry returned but mesh array empty
 * E = geometry returned and mesh created (success or camera issue)
 */
export const SOLID_DEBUG = {
  lastUpdate: 0,
  bucket: "A" as "A" | "B" | "C" | "D" | "E",
  engineCalled: false,
  canvasWidth: 0,
  canvasHeight: 0,
  strokeCount: 0,
  pointCount: 0,
  buildMaskSolidCalled: false,
  buildMaskSolidSuccess: false,
  geometryReturned: false,
  vertexCount: 0,
  filledPixels: 0,
  maskArea: 0,
  filledPercent: 0,
  failureReason: "" as string,
  // Coordinate debug
  worldMinX: 0,
  worldMaxX: 0,
  worldMinY: 0,
  worldMaxY: 0,
  // Thickness debug
  inputThickness: 0,
  worldThickness: 0,
  // Stage isolation debug - populated when stage rendering is active
  lastStages: null as any,
  // Comprehensive contour diagnostics
  rawContourPoints: 0,
  simplifiedContourPoints: 0,
  outerSignedArea: 0,
  outerWinding: "" as "CCW" | "CW" | "",
  outerSelfIntersects: false,
  holeCount: 0,
  holeAreas: [] as number[],
  holeWindings: [] as string[],
  anyHoleSelfIntersects: false,
  anyHoleOutsideOuter: false,
  holesOverlap: false,
  // Stage D vs E comparison
  stageDVertexCount: 0,
  stageEVertexCount: 0,
}

/**
 * TEMPORARY DEBUG: Stage isolation for diagnosis
 * Toggle which stage renders: A=mask B=rawContour C=simplifiedContour D=extrudeNoHoles E=full
 */
export const SOLID_STAGE_DEBUG = {
  enabled: false,  // Enable stage isolation debug overlay
  stage: "E" as "A" | "B" | "C" | "D" | "E",  // Which stage to render
}

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
  /** Depth-to-width MULTIPLIER (NOT raw depth). World-space depth is
   *  computed by `computeEffectiveExtrudeDepth(depth, effectiveWidth)`. */
  depth: number
  bevelEnabled: boolean
  bevelSize: number
  bevelSegments: number
}

/* ============================================================
 * EXTRUDE WIDTH CALIBRATION
 *
 * Width controls the ribbon HALF-WIDTH in world units (full ribbon
 * width = 2 × value). Width is the dominant contributor to perceived
 * stroke "mass" in XY. The previous slider range (0.02–0.20, default
 * 0.06) was too aggressive: anything past ~0.065 visibly bloated the
 * segmented fallback at corners. New range narrows the practical
 * span and lowers the default so most strokes read as ribbons, not
 * slabs. The effective-width clamp inside computeEffectiveWidth keeps
 * geometry sane even if a future caller passes a value outside range.
 * ============================================================ */
export const EXTRUDE_WIDTH_MIN = 0.015
export const EXTRUDE_WIDTH_MAX = 0.080
export const EXTRUDE_WIDTH_STEP = 0.005
export const EXTRUDE_WIDTH_DEFAULT = 0.035
// Absolute clamps on the effective half-width actually used by geometry.
const EXTRUDE_EFFECTIVE_WIDTH_FLOOR = 0.010
const EXTRUDE_EFFECTIVE_WIDTH_CEILING = 0.085

/* ============================================================
 * EXTRUDE DEPTH CALIBRATION (width-relative multiplier)
 *
 * `ExtrudeParams.depth` is interpreted as a DEPTH-TO-WIDTH MULTIPLIER,
 * not a raw world-space depth. The engine computes:
 *
 *   effectiveDepth = clamp(multiplier × effectiveWidth, FLOOR, CEILING)
 *
 * Width controls XY footprint; Depth multiplier controls only Z
 * extrusion height. They are decoupled: changing Depth does NOT inflate
 * the XY footprint, and changing Width does NOT compress Z. The user
 * asked for Depth to be EXPRESSIVE — multiplier max raised from 2.0
 * to 4.0, default raised from 0.75 to 1.0, and the absolute world-space
 * ceiling raised from 0.25 to 0.50 so a dramatic depth at moderate
 * width still has headroom.
 *
 * Anchor points (new spec):
 *   shallow:  0.25×
 *   default:  1.00×    ← stroke is as deep as it is half-wide
 *   deep:     2.00×
 *   dramatic: 3.00×
 *   max:      4.00×
 * ============================================================ */
export const EXTRUDE_DEPTH_MULTIPLIER_MIN = 0.1
export const EXTRUDE_DEPTH_MULTIPLIER_MAX = 4.0
export const EXTRUDE_DEPTH_MULTIPLIER_STEP = 0.05
export const EXTRUDE_DEPTH_MULTIPLIER_DEFAULT = 1.0
// Absolute clamps on the resulting world-space depth (after multiplier × width).
const EXTRUDE_EFFECTIVE_DEPTH_FLOOR = 0.005
const EXTRUDE_EFFECTIVE_DEPTH_CEILING = 0.50

/** Map a width-relative multiplier (`depth` slider value) + effective width
 *  to a calibrated world-space depth that won't visually explode. */
export function computeEffectiveExtrudeDepth(multiplier: number, effectiveWidth: number): number {
  const raw = multiplier * effectiveWidth
  if (!isFinite(raw) || raw <= 0) return EXTRUDE_EFFECTIVE_DEPTH_FLOOR
  return Math.min(EXTRUDE_EFFECTIVE_DEPTH_CEILING, Math.max(EXTRUDE_EFFECTIVE_DEPTH_FLOOR, raw))
}

export const DEFAULT_EXTRUDE_PARAMS: ExtrudeParams = {
  width: EXTRUDE_WIDTH_DEFAULT,
  // NOTE: this is a MULTIPLIER, not raw depth. See block comment above.
  depth: EXTRUDE_DEPTH_MULTIPLIER_DEFAULT,
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

/** Identifies which Extrude shape-construction strategy produced a given mesh.
 *  See EXTRUDE_GEOMETRY_STRATEGY in this file for the active default.
 *
 *   "legacy"    — parametric perpendicular-offset ribbon → THREE.ExtrudeGeometry
 *   "segmented" — depth-aware per-segment prism strip (legacy contour fallback)
 *   "raster"    — rasterize disks → marching-squares trace → THREE.ExtrudeGeometry
 *   "rod-only"  — debug only; everything becomes a TubeGeometry, depth-blind
 */
export type ExtrudeStrategyTag = "legacy" | "continuous-ribbon" | "segmented" | "raster" | "rod-only"

/**
 * Per-stroke build status for debug overlay (Extrude mode).
 *
 * Fields:
 *   width            — the effective ribbon half-width used for geometry
 *   depth            — DEPRECATED alias for effectiveDepth (kept for compatibility);
 *                       always equal to effectiveDepth on new code paths
 *   depthMultiplier  — the raw slider value (interpreted as a width-relative multiplier)
 *   effectiveDepth   — the calibrated world-space depth = computeEffectiveExtrudeDepth(...)
 *   strategy         — which shape/extrusion strategy produced this mesh
 */
export type StrokeBuildStatus =
  | { type: "ok"; width: number; depth: number; bevelEnabled: boolean; strategy: ExtrudeStrategyTag; depthMultiplier: number; effectiveDepth: number }
  | { type: "bevelOff"; width: number; depth: number; strategy: ExtrudeStrategyTag; depthMultiplier: number; effectiveDepth: number }
  | { type: "bevelOffTinyWidth"; width: number; depth: number; strategy: ExtrudeStrategyTag; depthMultiplier: number; effectiveDepth: number }
  | { type: "rodFallback"; reason: string; fallbackRadius: number; strategy: ExtrudeStrategyTag; depthMultiplier: number; effectiveDepth: number }

/** Debug contour data for Solid mode visualization */
export interface SolidDebugContour {
  points: { x: number; y: number }[]
  type: "outer" | "hole" | "rejected"
  reason?: string
  area: number
  signedArea: number
  isClosed: boolean
  parentIndex?: number  // Index of immediate parent (for containment tree)
  nestingDepth: number  // 0 = top-level, 1 = inside one contour, 2 = inside two, etc.
  contourIndex: number  // Original index in the contour list
}

/** Strict failure reason enum for Solid mode */
export type SolidFailureReason = 
  | "success"
  | "mask_empty"
  | "no_components"
  | "component_too_small"
  | "boundary_trace_failed"
  | "traced_contour_mismatch"
  | "simplified_contour_too_small"
  | "invalid_self_intersection"
  | "invalid_degenerate_edge"
  | "invalid_ring_too_small"
  | "invalid_polygon_cleanup_failed"
  | "shape_creation_failed"
  | "extrude_failed"
  | "geometry_null"
  | "geometry_zero_vertices"
  | "geometry_non_finite"
  | "geometry_bad_bbox"
  | "low_fidelity_result"

/** Solid mode build status for debug overlay */
export interface SolidBuildStatus {
  success: boolean
  failureReason: SolidFailureReason
  contourCount: number
  holesCount: number
  thickness: number
  depth: number
  // Linear trace values
  filledPixelCount: number
  componentCount: number
  selectedComponentArea: number
  tracedBoundaryPoints: number
  simplifiedPoints: number
  contourClosed: boolean
  signedArea: number
  // Fidelity metrics
  originalMaskArea: number
  simplifiedMaskArea: number
  areaRetentionRatio: number
  maskIoU: number
  usedFallbackContour: boolean
  // Polygon validation metrics
  selfIntersectionsFound: number
  duplicatePointsRemoved: number
  degenerateEdgesRemoved: number
  polygonValidationPassed: boolean
  // Geometry metrics
  vertexCount: number
  indexCount: number
  bboxSize: [number, number, number] | null
  bboxCenter: [number, number, number] | null
  rebuildTimeMs: number
  // Debug stats (legacy)
  rawContourCount: number
  rejectedCount: number
  validOuterCount: number
  openContourCount: number
  selfIntersectCount: number
  // Mask cleanup metrics
  pixelsBefore: number
  pixelsAfter: number
  holesKept: number
  holesFilled: number
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

/* ============================================================
 * RASTERIZED RIBBON BUILDER (preferred path)
 *
 * The previous parametric offset (`buildRibbonShape`, retained below
 * as a last-resort fallback) computes left/right perpendicular offsets
 * of the polyline using average normals. For any handwriting stroke
 * with meaningful curvature whose segment lengths are short relative
 * to halfWidth, the inner-side offset edges fold over each other,
 * producing a self-intersecting polygon. `validateShapeContour` then
 * (correctly) rejected those polygons as "bad contour", and Extrude
 * silently fell back to Rod for nearly every normal stroke, giving
 * Z-extent = stroke diameter (NOT depth).
 *
 * The rasterize-and-trace approach below is robust by construction:
 *   1. Rasterize the polyline at halfWidth thickness using a
 *      circular-disk brush stamped along every segment.
 *   2. Trace the outer boundary of the resulting filled region using
 *      Marching Squares (already used by SolidEngine — defined later
 *      in this file as `traceOuterBoundaryMarchingSquares`).
 *   3. Light Douglas-Peucker simplification (already defined later
 *      as `dpSimplify`) to remove jaggies.
 *   4. Wrap as a THREE.Shape, ensure CCW winding for ExtrudeGeometry.
 *
 * The mask is the union of disks stamped along the polyline, which
 * is always a connected, simply-connected region for a single
 * non-crossing stroke. Marching Squares on such a region returns a
 * simple closed polygon by construction — so triangulation never
 * fails on self-intersection.
 *
 * NOTE: The existing slider/visual convention treats `userWidth` as
 * the perpendicular offset (i.e., full ribbon = 2 × userWidth). The
 * rasterized builder preserves that convention to avoid changing the
 * visual size of strokes that were already working.
 * ============================================================ */

const RIBBON_RASTER_RESOLUTION = 256
// World-space step along each polyline segment when stamping disks.
// Smaller = smoother contour, more compute. ~0.35 of halfWidth ensures
// every disk overlaps its neighbor enough that the union has no gaps.
const RIBBON_RASTER_STEP_FRAC = 0.35
// DP simplification tolerance in PIXELS (raster space). 0.6 keeps the
// outline crisp without leaving tiny jitter spikes from the marching
// squares mid-edge sampling.
const RIBBON_RASTER_DP_TOLERANCE_PX = 0.6

/* ============================================================
 * EXTRUDE GEOMETRY STRATEGY SWITCH
 *
 * Controls which shape-construction path Extrude uses.
 *
 *   LEGACY_OFFSET_RIBBON  (default)
 *     The original parametric perpendicular-offset ribbon. Produces a
 *     smooth, calligraphic-feeling extrusion with thin variable-width
 *     edges. May fall back to Rod on tightly curved strokes whose
 *     inner-side offsets self-intersect (caught by validateShapeContour).
 *     Visually closer to a "drawn" stroke than the Solid silhouette.
 *
 *   RASTER_TRACE_RIBBON   (experimental)
 *     Stamps a circular disk along the polyline at halfWidth, traces
 *     the union with marching squares, simplifies, and extrudes. Always
 *     produces a simple polygon so Extrude never falls back to Rod for
 *     normal handwriting. However it produces a chunkier, more uniform
 *     silhouette that visually resembles Solid mode (Solid uses the same
 *     rasterize-and-trace approach for its outer cap). Use only when the
 *     legacy path's rod-fallback rate is unacceptable for a given input.
 *
 *   ROD_FALLBACK_ONLY     (debug)
 *     Skips Extrude entirely; every stroke goes through buildRodGeometryData.
 *     Depth slider does NOT apply. For diagnostic comparison only.
 *
 * Default is LEGACY_OFFSET_RIBBON because (a) it preserves the previous
 * Extrude visual style users were accustomed to, and (b) it does not
 * make Extrude visually indistinguishable from Solid. The rasterized path
 * remains available behind this flag for evaluation.
 * ============================================================ */
export const EXTRUDE_GEOMETRY_STRATEGY:
  | "LEGACY_OFFSET_RIBBON"
  | "RASTER_TRACE_RIBBON"
  | "ROD_FALLBACK_ONLY" = "LEGACY_OFFSET_RIBBON"

function strategyTag(): ExtrudeStrategyTag {
  switch (EXTRUDE_GEOMETRY_STRATEGY) {
    case "RASTER_TRACE_RIBBON": return "raster"
    case "ROD_FALLBACK_ONLY":   return "rod-only"
    case "LEGACY_OFFSET_RIBBON":
    default:                    return "legacy"
  }
}

/**
 * Rasterize a polyline at given perpendicular thickness into a binary mask.
 * Returns the mask and the world↔pixel transform (uniform scale + offset).
 */
function rasterizeStrokeToRibbonMask(
  pts: THREE.Vector3[],
  halfWidth: number,
  S: number = RIBBON_RASTER_RESOLUTION
): { mask: boolean[]; minX: number; minY: number; scale: number } | null {
  if (pts.length < 2 || halfWidth <= 0) return null

  // World bbox of polyline + padding so the round brush never clips.
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const pad = halfWidth * 1.5
  minX -= pad; maxX += pad
  minY -= pad; maxY += pad

  const sizeMax = Math.max(maxX - minX, maxY - minY)
  if (!isFinite(sizeMax) || sizeMax <= 0) return null

  // Uniform scale fits bbox into S-2 pixels (1px safety margin per side).
  const scale = (S - 2) / sizeMax
  const radiusPx = halfWidth * scale
  if (radiusPx < 0.5) return null  // sub-pixel ribbon — not enough resolution

  const mask = new Array(S * S).fill(false)
  const r2 = radiusPx * radiusPx

  const stampDisk = (wx: number, wy: number) => {
    const cx = (wx - minX) * scale
    const cy = (wy - minY) * scale
    const x0 = Math.max(0, Math.floor(cx - radiusPx))
    const x1 = Math.min(S - 1, Math.ceil(cx + radiusPx))
    const y0 = Math.max(0, Math.floor(cy - radiusPx))
    const y1 = Math.min(S - 1, Math.ceil(cy + radiusPx))
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cy
      const dy2 = dy * dy
      const row = y * S
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cx
        if (dx * dx + dy2 <= r2) mask[row + x] = true
      }
    }
  }

  // Walk each segment, stamp disks at sub-halfWidth intervals so
  // consecutive disks overlap and the union is gap-free.
  const stepWorld = Math.max(1e-6, halfWidth * RIBBON_RASTER_STEP_FRAC)
  // Always stamp at the very first vertex.
  stampDisk(pts[0].x, pts[0].y)
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1e-9) continue
    const steps = Math.max(1, Math.ceil(len / stepWorld))
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      stampDisk(a.x + t * dx, a.y + t * dy)
    }
  }

  return { mask, minX, minY, scale }
}

/**
 * Robust ribbon shape via rasterize → marching-squares → simplify.
 * Always returns a simple (non-self-intersecting) polygon for any single
 * stroke whose polyline does not self-cross, or null if the stroke is
 * too small to rasterize at the chosen resolution.
 *
 * NOTE: The slider convention here is `halfWidth` as perpendicular offset,
 * matching the legacy `buildRibbonShape` for visual compatibility. The
 * caller passes `userWidth` (slider value) as `halfWidth`, producing a
 * ribbon of full width 2 × userWidth — same as before.
 */
function buildRasterizedRibbonShape(
  pts: THREE.Vector3[],
  halfWidth: number
): THREE.Shape | null {
  const raster = rasterizeStrokeToRibbonMask(pts, halfWidth)
  if (!raster) return null

  const pxContour = traceOuterBoundaryMarchingSquares(raster.mask, RIBBON_RASTER_RESOLUTION)
  if (pxContour.length < 3) return null

  // Light DP simplification in pixel space.
  const simplifiedPx = dpSimplify(pxContour, RIBBON_RASTER_DP_TOLERANCE_PX)
  if (simplifiedPx.length < 3) return null

  // Pixel → world transform.
  const worldPts = simplifiedPx.map((p) => ({
    x: p.x / raster.scale + raster.minX,
    y: p.y / raster.scale + raster.minY,
  }))

  // Marching squares traces clockwise in raster (Y-down) coords. Since we
  // map raster-Y directly to world-Y (no flip), the resulting polygon's
  // winding may be clockwise in math sense (negative signed area). THREE
  // ExtrudeGeometry expects CCW outer contour. Reverse if needed.
  let signed = 0
  for (let i = 0, j = worldPts.length - 1; i < worldPts.length; j = i++) {
    signed += (worldPts[j].x - worldPts[i].x) * (worldPts[j].y + worldPts[i].y)
  }
  signed *= 0.5
  const ordered = signed < 0 ? worldPts : worldPts.slice().reverse()

  const shape = new THREE.Shape()
  shape.moveTo(ordered[0].x, ordered[0].y)
  for (let i = 1; i < ordered.length; i++) {
    shape.lineTo(ordered[i].x, ordered[i].y)
  }
  shape.closePath()
  return shape
}

/**
 * Build a 2D ribbon outline (offset left/right of polyline by `halfWidth`).
 * Returns an array of 2D points forming a closed polygon.
 *
 * LEGACY parametric-offset implementation. Retained as last-resort fallback
 * only; the rasterized builder above is the primary path. See the comment
 * block above `rasterizeStrokeToRibbonMask` for why this approach fails on
 * normal handwriting strokes.
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
function clampBevel(
  ep: ExtrudeParams,
  effectiveDepth: number,
  effectiveWidth: number,
): { bevelSize: number; bevelThickness: number; bevelSegments: number } {
  // bevelSize: outward-radius. bevelThickness: per-end Z eat-in.
  // Cap by BOTH the effective world depth (so end-caps don't collapse) AND
  // the effective width (so bevel doesn't visually swallow a thin ribbon).
  const maxByDepth = effectiveDepth * 0.4
  const maxByWidth = effectiveWidth * 0.4
  const cap = Math.min(maxByDepth, maxByWidth)
  const bevelSize = Math.max(0, Math.min(ep.bevelSize, cap))
  const bevelThickness = Math.max(0, Math.min(ep.bevelSize, bevelSize))
  const bevelSegments = Math.min(ep.bevelSegments, 6)
  return { bevelSize, bevelThickness, bevelSegments }
  }

/**
 * Map the slider width to an effective half-width used by geometry. Currently
 * identity within the calibrated [FLOOR, CEILING] envelope; we keep the helper
 * separate so future tuning (e.g. nonlinear mapping, polyline-length-aware
 * adjustments) can plug in without touching call sites. The CEILING is the
 * critical guard: even if a future caller passes a wider value than the
 * slider exposes, geometry will not blow up.
 */
function computeEffectiveWidth(_filtered: THREE.Vector3[], userWidth: number): number {
  if (!isFinite(userWidth) || userWidth <= 0) return EXTRUDE_EFFECTIVE_WIDTH_FLOOR
  return Math.min(EXTRUDE_EFFECTIVE_WIDTH_CEILING, Math.max(EXTRUDE_EFFECTIVE_WIDTH_FLOOR, userWidth))
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
 * @deprecated — replaced by `buildContinuousRibbonStripGeometry`.
 *
 * Kept here only as historical reference. The implementation below
 * computed a per-vertex miter offset with `halfWidth / sin(angle/2)`
 * scaling clamped at ~2.86×halfWidth. That formula produces visible
 * spikes (up to ~2.86×halfWidth wide) at every sharp-turn vertex on
 * a loopy stroke, which compounded into the "blob" the user observed
 * even at low width/depth. The replacement clamps the offset at
 * exactly halfWidth, eliminating spikes.
 *
 * NOT CALLED. Safe to delete after one stable release.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _deprecatedBuildSegmentedRibbonGeometry(
  pts: THREE.Vector3[],
  halfWidth: number,
  depth: number
): THREE.BufferGeometry | null {
  if (pts.length < 2 || halfWidth <= 0 || depth <= 0) return null

  const halfDepth = depth / 2
  const N = pts.length

  // Per-vertex offset = perpendicular direction × miter length.
  //
  // For a vertex shared by tangents t1 (incoming) and t2 (outgoing), the
  // CORRECT offset for an offset-curve ribbon is along the bisector NORMAL,
  // with length = halfWidth / sin(angle/2). The previous implementation
  // averaged the two unit perpendiculars and renormalized to halfWidth —
  // which under-offsets the OUTER edge at sharp turns (creating notches)
  // while the inner offsets self-overlap (creating chunky spikes). The
  // miter formula fixes both.
  //
  // Sharp turns would otherwise produce a miter length that diverges as
  // angle → 0. We clamp sin(angle/2) at MITER_CLAMP_SIN so the miter
  // length is bounded at halfWidth / MITER_CLAMP_SIN. The visual cost of
  // the clamp at very sharp corners is a slight inner overlap, which is
  // already invisible inside a solid mesh body. The benefit is dramatic:
  // no more corner explosions at moderate widths on loopy handwriting.
  const MITER_CLAMP_SIN = 0.35  // ≈20° half-angle ⇒ miter capped at ~2.86×halfWidth
  const perpX: number[] = new Array(N)
  const perpY: number[] = new Array(N)
  for (let i = 0; i < N; i++) {
    // Incoming-segment tangent
    let t1x = 0, t1y = 0, l1 = 0
    if (i > 0) {
      const dx = pts[i].x - pts[i - 1].x
      const dy = pts[i].y - pts[i - 1].y
      l1 = Math.hypot(dx, dy)
      if (l1 > 0) { t1x = dx / l1; t1y = dy / l1 }
    }
    // Outgoing-segment tangent
    let t2x = 0, t2y = 0, l2 = 0
    if (i < N - 1) {
      const dx = pts[i + 1].x - pts[i].x
      const dy = pts[i + 1].y - pts[i].y
      l2 = Math.hypot(dx, dy)
      if (l2 > 0) { t2x = dx / l2; t2y = dy / l2 }
    }

    let pX = 0, pY = 0, miterLen = halfWidth
    if (l1 > 0 && l2 > 0) {
      // Both segments exist → proper miter at the join.
      const bx = t1x + t2x
      const by = t1y + t2y
      const bLen = Math.hypot(bx, by)
      if (bLen < 1e-6) {
        // 180° reversal — bisector is undefined; fall back to first perp.
        pX = -t1y
        pY = t1x
        miterLen = halfWidth
      } else {
        const ubx = bx / bLen
        const uby = by / bLen
        // Miter normal = bisector rotated 90° CCW
        pX = -uby
        pY = ubx
        // sin(angle/2): half-angle between t1 and the bisector unit vector.
        // dot(t1, bisector_unit) = cos(angle/2); sin = sqrt(1 - cos²).
        const cosHalf = t1x * ubx + t1y * uby
        const sinHalf = Math.sqrt(Math.max(0, 1 - cosHalf * cosHalf))
        const effSin = Math.max(sinHalf, MITER_CLAMP_SIN)
        miterLen = halfWidth / effSin
      }
    } else if (l1 > 0) {
      // End vertex — perpendicular to incoming segment.
      pX = -t1y
      pY = t1x
      miterLen = halfWidth
    } else if (l2 > 0) {
      // Start vertex — perpendicular to outgoing segment.
      pX = -t2y
      pY = t2x
      miterLen = halfWidth
    }

    perpX[i] = pX * miterLen
    perpY[i] = pY * miterLen
  }

  const positions: number[] = []
  const indices: number[] = []

  const pushV = (x: number, y: number, z: number): number => {
    const idx = positions.length / 3
    positions.push(x, y, z)
    return idx
  }

  // CCW quad: a→b→c→d emits triangles (a,b,c) and (a,c,d). Caller is
  // responsible for ordering vertices so cross(b-a, c-a) points outward.
  const quad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d)
  }

  // 4 vertices per polyline point: top (+Z) and bottom (-Z) on each side
  //   Lp = left +halfDepth   Rp = right +halfDepth
  //   Lm = left -halfDepth   Rm = right -halfDepth
  // "Left" = the +perpendicular side, "right" = the -perpendicular side.
  const Lp: number[] = new Array(N)
  const Rp: number[] = new Array(N)
  const Lm: number[] = new Array(N)
  const Rm: number[] = new Array(N)
  for (let i = 0; i < N; i++) {
    const px = pts[i].x
    const py = pts[i].y
    const dx = perpX[i]
    const dy = perpY[i]
    Lp[i] = pushV(px + dx, py + dy, +halfDepth)
    Rp[i] = pushV(px - dx, py - dy, +halfDepth)
    Lm[i] = pushV(px + dx, py + dy, -halfDepth)
    Rm[i] = pushV(px - dx, py - dy, -halfDepth)
  }

  // Four side faces between every consecutive pair of polyline vertices.
  for (let i = 0; i < N - 1; i++) {
    // Top face (z=+halfDepth, normal +Z)
    quad(Lp[i], Rp[i], Rp[i + 1], Lp[i + 1])
    // Bottom face (z=-halfDepth, normal -Z)
    quad(Lm[i], Lm[i + 1], Rm[i + 1], Rm[i])
    // Left side wall (+perp side, normal +perp)
    quad(Lp[i], Lp[i + 1], Lm[i + 1], Lm[i])
    // Right side wall (-perp side, normal -perp)
    quad(Rp[i], Rm[i], Rm[i + 1], Rp[i + 1])
  }

  // Stroke end caps. The polyline only has two true ends; intermediate
  // segment joints share verts via the miter-join offset above, so no
  // intra-stroke caps are emitted.
  quad(Lp[0], Lm[0], Rm[0], Rp[0])                       // start cap, normal -dir
  quad(Lp[N - 1], Rp[N - 1], Rm[N - 1], Lm[N - 1])       // end cap, normal +dir

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()

  return geo
}


/* ============================================================
 * CONTINUOUS_RIBBON_STRIP — depth-aware shared-vertex strip
 *
 * This is the preferred Extrude fallback when the parametric offset
 * polygon self-intersects. It builds a SINGLE continuous extruded
 * ribbon — NOT a sequence of independent per-segment prisms — by
 * sharing the four cross-section vertices (top-left, top-right,
 * bottom-left, bottom-right) across consecutive polyline samples.
 *
 * Why it doesn't blob:
 *   • Vertices are shared between adjacent quads → no overlapping
 *     "boxes" stacking up at every sample (the visual symptom the
 *     legacy implementation showed at loops).
 *   • Offset MAGNITUDE at each vertex is clamped to halfWidth.
 *     We deliberately do NOT use the geometric miter length
 *     halfWidth / sin(angle/2): at sharp turns sin(angle/2) → 0,
 *     so that formula produces spikes up to several × halfWidth
 *     at every vertex on a loop's curve. Clamping at halfWidth
 *     means the OUTER edge has a tiny inward notch at sharp turns
 *     (acceptable for MVP) while the per-vertex maximum offset
 *     stays constant — no spikes, no piling.
 *   • Zero-length input segments are filtered, which prevents NaN
 *     perpendiculars at duplicate samples (a common cause of
 *     degenerate triangles that render as black slivers).
 *   • Tight-turn densification subdivides any segment where the
 *     bisector turn at an endpoint exceeds DENSIFY_ANGLE_THRESHOLD,
 *     so the ribbon's outer-edge "notch" is small enough to be
 *     visually unnoticeable.
 *
 * Output is centered on z=0 (range [-halfDepth, +halfDepth]). The
 * caller does NOT need to translate the resulting geometry.
 *
 * Width semantics: `halfWidth` IS the half-width — total cross-section
 * width on a straight segment is exactly 2 × halfWidth.
 *
 * Visual identity vs Rod: Rod is a circular tube (radius ≈ halfWidth);
 * this ribbon has a rectangular cross-section (full 2×halfWidth wide,
 * `depth` tall), so even at the same width slider the silhouettes are
 * clearly distinct. Visual identity vs Solid: Solid is a depth-blind
 * raster→marching-squares mask extrusion; this ribbon preserves
 * directionality (the cross-section follows the stroke tangent),
 * giving it a calligraphic feel Solid never produces.
 * ============================================================ */
function buildContinuousRibbonStripGeometry(
  pts: THREE.Vector3[],
  halfWidth: number,
  depth: number
): THREE.BufferGeometry | null {
  if (pts.length < 2 || halfWidth <= 0 || depth <= 0) return null

  // 1) Filter near-duplicate samples (zero-length segments produce NaN
  //    perpendiculars). MIN_EDGE is small enough that any handwriting
  //    sample worth keeping survives; only literal duplicates die.
  const MIN_EDGE = 1e-5
  const filtered: THREE.Vector3[] = [pts[0]]
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].distanceTo(filtered[filtered.length - 1]) > MIN_EDGE) {
      filtered.push(pts[i])
    }
  }
  if (filtered.length < 2) return null

  // 2) Tight-turn densification: subdivide segments whose endpoint
  //    bisectors turn by more than DENSIFY_ANGLE_THRESHOLD radians.
  //    A single pass of midpoint subdivision halves the per-segment
  //    turn; for typical handwriting one pass is sufficient.
  //    Threshold = 25° ≈ 0.436 rad.
  const DENSIFY_ANGLE_THRESHOLD = 0.436
  // Compute per-vertex turn angle (between incoming and outgoing tangents).
  const turnAngleAt = (arr: THREE.Vector3[], i: number): number => {
    if (i <= 0 || i >= arr.length - 1) return 0
    const ax = arr[i].x - arr[i - 1].x, ay = arr[i].y - arr[i - 1].y
    const bx = arr[i + 1].x - arr[i].x, by = arr[i + 1].y - arr[i].y
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by)
    if (la <= 0 || lb <= 0) return 0
    let cos = (ax * bx + ay * by) / (la * lb)
    if (cos > 1) cos = 1
    if (cos < -1) cos = -1
    return Math.acos(cos)
  }
  // Single subdivision pass. Insert midpoint of (i, i+1) when either
  // endpoint exhibits a sharp turn.
  const densified: THREE.Vector3[] = [filtered[0]]
  for (let i = 0; i < filtered.length - 1; i++) {
    const ta = turnAngleAt(filtered, i)
    const tb = turnAngleAt(filtered, i + 1)
    if (ta > DENSIFY_ANGLE_THRESHOLD || tb > DENSIFY_ANGLE_THRESHOLD) {
      const mx = (filtered[i].x + filtered[i + 1].x) * 0.5
      const my = (filtered[i].y + filtered[i + 1].y) * 0.5
      const mz = (filtered[i].z + filtered[i + 1].z) * 0.5
      densified.push(new THREE.Vector3(mx, my, mz))
    }
    densified.push(filtered[i + 1])
  }

  const samples = densified
  const N = samples.length
  const halfDepth = depth / 2

  // 3) Per-vertex offset: averaged unit perpendicular × halfWidth.
  //    No 1/sin(angle/2) scaling — that produced spikes at sharp turns.
  //    Magnitude is always exactly halfWidth, regardless of curvature.
  const perpX: number[] = new Array(N)
  const perpY: number[] = new Array(N)
  for (let i = 0; i < N; i++) {
    let nx = 0, ny = 0
    if (i > 0) {
      const dx = samples[i].x - samples[i - 1].x
      const dy = samples[i].y - samples[i - 1].y
      const l = Math.hypot(dx, dy)
      if (l > 0) { nx += -dy / l; ny += dx / l }
    }
    if (i < N - 1) {
      const dx = samples[i + 1].x - samples[i].x
      const dy = samples[i + 1].y - samples[i].y
      const l = Math.hypot(dx, dy)
      if (l > 0) { nx += -dy / l; ny += dx / l }
    }
    const len = Math.hypot(nx, ny)
    if (len > 1e-6) {
      perpX[i] = (nx / len) * halfWidth
      perpY[i] = (ny / len) * halfWidth
    } else {
      // Truly degenerate vertex (no neighbors with length). Reuse
      // previous vertex's perp if available; else zero.
      perpX[i] = i > 0 ? perpX[i - 1] : 0
      perpY[i] = i > 0 ? perpY[i - 1] : 0
    }
  }

  // 4) Emit 4 vertices per sample: (left/right) × (top/bottom).
  const positions: number[] = []
  const Lp: number[] = new Array(N)
  const Rp: number[] = new Array(N)
  const Lm: number[] = new Array(N)
  const Rm: number[] = new Array(N)
  const pushV = (x: number, y: number, z: number): number => {
    const idx = positions.length / 3
    positions.push(x, y, z)
    return idx
  }
  for (let i = 0; i < N; i++) {
    const x = samples[i].x, y = samples[i].y, dx = perpX[i], dy = perpY[i]
    Lp[i] = pushV(x + dx, y + dy, +halfDepth)
    Rp[i] = pushV(x - dx, y - dy, +halfDepth)
    Lm[i] = pushV(x + dx, y + dy, -halfDepth)
    Rm[i] = pushV(x - dx, y - dy, -halfDepth)
  }

  // 5) Faces between every consecutive pair of samples. The four quads
  //    share their endpoints with the next pair → continuous strip,
  //    no internal duplicated faces. Winding chosen so each face's
  //    outward normal points away from the ribbon interior; verified
  //    by right-hand rule on a +X-direction test segment.
  const indices: number[] = []
  const quad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d)
  }
  for (let i = 0; i < N - 1; i++) {
    quad(Lp[i], Rp[i], Rp[i + 1], Lp[i + 1])   // top  face  (+Z normal)
    quad(Lm[i], Lm[i + 1], Rm[i + 1], Rm[i])   // bot  face  (-Z normal)
    quad(Lp[i], Lp[i + 1], Lm[i + 1], Lm[i])   // left wall  (+perp normal)
    quad(Rp[i], Rm[i], Rm[i + 1], Rp[i + 1])   // right wall (-perp normal)
  }

  // 6) Start / end caps. Strip ends only — intermediate samples share
  //    cross-section vertices so no intra-strip caps are needed.
  quad(Lp[0], Lm[0], Rm[0], Rp[0])
  quad(Lp[N - 1], Rp[N - 1], Rm[N - 1], Lm[N - 1])

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
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
  _si: number,
): { geometry: THREE.BufferGeometry | null; status: StrokeBuildStatus } {
  // ---- Compute calibrated effective depth from multiplier ----
  // extrudeParams.depth is a width-relative multiplier; convert to world-space.
  const depthMultiplier = extrudeParams.depth
  const effectiveDepth = computeEffectiveExtrudeDepth(depthMultiplier, userWidth)
  const halfDepth = effectiveDepth / 2
  const bevel = clampBevel(extrudeParams, effectiveDepth, userWidth)
  const fbRadius = fallbackRodRadius(userWidth)
  const tag = strategyTag()

  // ROD_FALLBACK_ONLY (debug strategy): never run Extrude; always emit a
  // rodFallback status so the caller renders a TubeGeometry. Depth has no
  // effect in this path — that is intentional and is the correct way to
  // verify "this is what rod looks like" for visual comparison.
  if (EXTRUDE_GEOMETRY_STRATEGY === "ROD_FALLBACK_ONLY") {
    console.log(`[v0] stroke ${_si} final: rodFallback (strategy=rod-only)`)
    return {
      geometry: null,
      status: {
        type: "rodFallback",
        reason: "strategy=rod-only",
        fallbackRadius: fbRadius,
        strategy: tag,
        depthMultiplier,
        effectiveDepth,
      },
    }
  }

  // Build the ribbon shape according to the active strategy.
  //
  // LEGACY_OFFSET_RIBBON (default):
  //   - Try parametric offset builder. If it produces a simple polygon, use
  //     THREE.ExtrudeGeometry → smooth calligraphic ribbon (the preferred
  //     visual style).
  //   - If contour self-intersects ("bad contour") OR extrusion fails, fall
  //     back to the DEPTH-AWARE segmented builder, NOT Rod. This is the
  //     critical fix: previously every loopy handwriting stroke fell back
  //     to a depth-blind Rod tube and the Depth slider had no visible effect.
  //   - Rod only remains as final fallback if BOTH parametric and segmented
  //     refuse (essentially only for truly degenerate input).
  //
  // RASTER_TRACE_RIBBON:
  //   - Use the rasterize-and-trace builder first (always simple by
  //     construction). If raster declines (sub-pixel ribbon at 256-px
  //     resolution), fall back to parametric, then validate; on bad contour,
  //     also falls back to segmented; then Rod.
  let shape: THREE.Shape | null = null
  let shapeSource: "parametric" | "rasterized" = "parametric"

  if (EXTRUDE_GEOMETRY_STRATEGY === "RASTER_TRACE_RIBBON") {
    shape = buildRasterizedRibbonShape(filtered, userWidth)
    if (shape) {
      shapeSource = "rasterized"
    } else {
      shape = buildRibbonShape(filtered, userWidth)
      shapeSource = "parametric"
    }
  } else {
    // LEGACY_OFFSET_RIBBON
    shape = buildRibbonShape(filtered, userWidth)
    shapeSource = "parametric"
  }

  // Helper: depth-aware CONTINUOUS RIBBON STRIP fallback used when the
  // parametric ribbon contour self-intersects or extrusion fails.
  // Preserves Depth (Z extent ≈ effectiveDepth) and keeps a directional
  // ribbon feel. Crucially, this is NOT a per-segment-prism builder —
  // it produces a single shared-vertex strip mesh that does NOT visually
  // blob at loops the way independent boxes would. See
  // `buildContinuousRibbonStripGeometry` for the construction.
  //
  // Rod fallback is reserved for truly degenerate input (continuous-ribbon
  // refused, i.e. <2 valid samples or zero depth/width).
  const tryContinuousRibbonFallback = (reason: string): {
    geometry: THREE.BufferGeometry | null
    status: StrokeBuildStatus
  } => {
    const ribGeo = buildContinuousRibbonStripGeometry(filtered, userWidth, effectiveDepth)
    if (ribGeo) {
      console.log(`[v0] stroke ${_si} final: extrude(continuous-ribbon) (strategy=${tag}→continuous-ribbon)`, {
        width: userWidth,
        depthMultiplier,
        effectiveDepth,
        reason,
      })
      // bevelEnabled reported as false because the strip's side walls are
      // perpendicular to the front/back faces with no rounded bevel; bevel
      // slider does not affect this path.
      return {
        geometry: ribGeo,
        status: {
          type: "ok",
          width: userWidth,
          depth: effectiveDepth,
          bevelEnabled: false,
          strategy: "continuous-ribbon",
          depthMultiplier,
          effectiveDepth,
        },
      }
    }
    console.log(`[v0] stroke ${_si} final: rodFallback (strategy=${tag}, continuous-ribbon declined)`, { reason })
    return {
      geometry: null,
      status: {
        type: "rodFallback",
        reason: `continuous-ribbon declined: ${reason}`,
        fallbackRadius: fbRadius,
        strategy: tag,
        depthMultiplier,
        effectiveDepth,
      },
    }
  }

  if (!shape) {
    // Truly degenerate input — both shape builders refused. Try segmented
    // (it accepts any polyline with ≥2 distinct points), else Rod.
    return tryContinuousRibbonFallback("no shape")
  }

  // Validate contour ONLY for the parametric path. The rasterized polygon
  // is simple by construction.
  if (shapeSource === "parametric") {
    const contour = validateShapeContour(shape)
    if (!contour) {
      // Legacy contour self-intersects. Previously this fell back to Rod
      // (depth-blind). Now fall back to the depth-aware segmented builder
      // so normal loopy handwriting still responds to the Depth slider.
      return tryContinuousRibbonFallback("bad contour")
    }
  }

  // For tiny widths, skip bevel entirely to avoid degenerate geometry
  const isTinyWidth = userWidth < TINY_WIDTH_THRESHOLD
  const useBevel = extrudeParams.bevelEnabled && !isTinyWidth

  // Attempt 1: with bevel (if enabled and not tiny)
  if (useBevel) {
    const geo1 = safeExtrude(shape, {
      depth: effectiveDepth,
      bevelEnabled: true,
      bevelSize: bevel.bevelSize,
      bevelThickness: bevel.bevelThickness,
      bevelSegments: bevel.bevelSegments,
      curveSegments: EXTRUDE_CURVE_SEGMENTS,
    }, filtered, effectiveDepth)

    if (geo1) {
      geo1.translate(0, 0, -halfDepth)
      console.log(`[v0] stroke ${_si} final: extrude (strategy=${tag})`, { width: userWidth, depthMultiplier, effectiveDepth, bevelEnabled: true })
      return {
        geometry: geo1,
        status: { type: "ok", width: userWidth, depth: effectiveDepth, bevelEnabled: true, strategy: tag, depthMultiplier, effectiveDepth },
      }
    }
  }

  // Attempt 2: bevel OFF (either because tiny width, or bevel attempt failed)
  const geo2 = safeExtrude(shape, {
    depth: effectiveDepth,
    bevelEnabled: false,
    curveSegments: EXTRUDE_CURVE_SEGMENTS,
  }, filtered, effectiveDepth)

  if (geo2) {
    geo2.translate(0, 0, -halfDepth)
    if (isTinyWidth && extrudeParams.bevelEnabled) {
      console.log(`[v0] stroke ${_si} final: extrude(bevelOffTinyWidth) (strategy=${tag})`, { width: userWidth, depthMultiplier, effectiveDepth })
      return {
        geometry: geo2,
        status: { type: "bevelOffTinyWidth", width: userWidth, depth: effectiveDepth, strategy: tag, depthMultiplier, effectiveDepth },
      }
    }
    if (useBevel) {
      console.log(`[v0] stroke ${_si} final: extrude(bevelOff) (strategy=${tag})`, { width: userWidth, depthMultiplier, effectiveDepth })
      return {
        geometry: geo2,
        status: { type: "bevelOff", width: userWidth, depth: effectiveDepth, strategy: tag, depthMultiplier, effectiveDepth },
      }
    }
    console.log(`[v0] stroke ${_si} final: extrude (strategy=${tag})`, { width: userWidth, depthMultiplier, effectiveDepth, bevelEnabled: false })
    return {
      geometry: geo2,
      status: { type: "ok", width: userWidth, depth: effectiveDepth, bevelEnabled: false, strategy: tag, depthMultiplier, effectiveDepth },
    }
  }

  // safeExtrude returned null even with bevel off and a valid contour.
  // This is rare (degenerate triangulation in THREE.ExtrudeGeometry). Use
  // segmented as a final depth-aware fallback before resorting to Rod, so
  // even pathological strokes still respond to the Depth slider.
  return tryContinuousRibbonFallback("extrude failed")
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

      // Include the slider params that produced this geometry in the React key
      // so changing depth/width/bevel forces React to unmount-and-remount the
      // <mesh> element. This is belt-and-suspenders on top of the useStrokeMeshes
      // dep array: even if a future ref-prop-swap regression in @react-three/fiber
      // ever caused the mesh to retain the old BufferGeometry instance, a fresh
      // mount picks up the new geometry unconditionally. Extrude meshes are static
      // (no draw-in animation), so remounting on slider change has no animation cost.
      const paramKey = `w${extrudeParams.width.toFixed(3)}-d${extrudeParams.depth.toFixed(3)}-b${extrudeParams.bevelEnabled ? 1 : 0}`
      if (geometry) {
        result.push({
          tubeGeometry: geometry,
          filteredCount: filtered.length,
          key: `stroke-${si}-${stroke.points.length}-${paramKey}`,
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
          key: `stroke-${si}-${stroke.points.length}-${paramKey}-rod-fallback`,
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
        // extrudeDepth is the slider value, now interpreted as a width-relative
        // multiplier (see DEFAULT_EXTRUDE_PARAMS comment). The actual world-space
        // depth used for each stroke = computeEffectiveExtrudeDepth(multiplier, width).
        extrudeDepthMultiplier: extrudeParams.depth,
        extrudeDepthEffective: computeEffectiveExtrudeDepth(extrudeParams.depth, extrudeParams.width),
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
/** Douglas-Peucker tolerance for contour simplification */
const DP_TOLERANCE = 1.0  // Re-enabled: reduces point count for cleaner shapes

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

/* ---- Fidelity-preserving contour simplification ---- */

/** Rasterize a polygon contour to a binary mask using scanline fill */
function rasterizeContourToMask(contour: { x: number; y: number }[], S: number): boolean[] {
  const mask = new Array(S * S).fill(false)
  if (contour.length < 3) return mask
  
  // Find bounding box
  let minY = Infinity, maxY = -Infinity
  for (const p of contour) {
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  
  const yStart = Math.max(0, Math.floor(minY))
  const yEnd = Math.min(S - 1, Math.ceil(maxY))
  
  // Scanline fill
  for (let y = yStart; y <= yEnd; y++) {
    const intersections: number[] = []
    const scanY = y + 0.5
    
    for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
      const y1 = contour[j].y, y2 = contour[i].y
      const x1 = contour[j].x, x2 = contour[i].x
      
      if ((y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY)) {
        const t = (scanY - y1) / (y2 - y1)
        intersections.push(x1 + t * (x2 - x1))
      }
    }
    
    intersections.sort((a, b) => a - b)
    
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = Math.max(0, Math.floor(intersections[i]))
      const xEnd = Math.min(S - 1, Math.floor(intersections[i + 1]))
      for (let x = xStart; x <= xEnd; x++) {
        mask[y * S + x] = true
      }
    }
  }
  
  return mask
}

/** Compute IoU (Intersection over Union) between two binary masks */
function computeMaskIoU(maskA: boolean[], maskB: boolean[]): number {
  let intersection = 0
  let union = 0
  for (let i = 0; i < maskA.length; i++) {
    if (maskA[i] && maskB[i]) intersection++
    if (maskA[i] || maskB[i]) union++
  }
  return union > 0 ? intersection / union : 0
}

/** Count pixels where masks overlap */
function countMaskOverlap(maskA: boolean[], maskB: boolean[]): { intersection: number, areaA: number, areaB: number } {
  let intersection = 0
  let areaA = 0
  let areaB = 0
  for (let i = 0; i < maskA.length; i++) {
    if (maskA[i]) areaA++
    if (maskB[i]) areaB++
    if (maskA[i] && maskB[i]) intersection++
  }
  return { intersection, areaA, areaB }
}

/**
 * Fidelity-preserving simplification with validation.
 * Returns simplified contour only if it preserves shape fidelity.
 * Falls back to raw contour if simplification destroys the shape.
 */
function simplifyWithFidelityCheck(
  rawContour: { x: number; y: number }[],
  originalMask: boolean[],
  S: number,
  tolerance: number,
  minIoU: number = 0.85,
  minAreaRetention: number = 0.80
): {
  contour: { x: number; y: number }[]
  usedFallback: boolean
  simplifiedMaskArea: number
  maskIoU: number
  areaRetention: number
} {
  // Calculate minimum vertex count based on contour complexity
  // More complex shapes need more vertices
  const perimeter = computeContourPerimeter(rawContour)
  const minVertices = Math.max(8, Math.min(rawContour.length / 2, Math.ceil(perimeter / 10)))
  
  // Try progressive simplification with increasing tolerance
  const tolerances = [tolerance * 0.1, tolerance * 0.25, tolerance * 0.5, tolerance]
  
  for (const tol of tolerances) {
    const simplified = dpSimplify(rawContour, tol)
    
    // Enforce minimum vertex count
    if (simplified.length < minVertices && simplified.length < rawContour.length) {
      continue // Too aggressive, try lower tolerance
    }
    
    // Rasterize simplified contour and check fidelity
    const simplifiedMask = rasterizeContourToMask(simplified, S)
    const { intersection, areaA, areaB } = countMaskOverlap(originalMask, simplifiedMask)
    
    const union = areaA + areaB - intersection
    const iou = union > 0 ? intersection / union : 0
    const areaRetention = areaA > 0 ? areaB / areaA : 0
    
    // Check if this simplification passes fidelity thresholds
    if (iou >= minIoU && areaRetention >= minAreaRetention && areaRetention <= 1.2) {
      return {
        contour: simplified,
        usedFallback: false,
        simplifiedMaskArea: areaB,
        maskIoU: iou,
        areaRetention
      }
    }
  }
  
  // All simplification levels failed fidelity check - use raw contour
  const rawMask = rasterizeContourToMask(rawContour, S)
  const { intersection, areaA, areaB } = countMaskOverlap(originalMask, rawMask)
  const union = areaA + areaB - intersection
  
  return {
    contour: rawContour,
    usedFallback: true,
    simplifiedMaskArea: areaB,
    maskIoU: union > 0 ? intersection / union : 0,
    areaRetention: areaA > 0 ? areaB / areaA : 0
  }
}

/** Compute perimeter of a contour */
function computeContourPerimeter(pts: { x: number; y: number }[]): number {
  let perimeter = 0
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length
    const dx = pts[j].x - pts[i].x
    const dy = pts[j].y - pts[i].y
    perimeter += Math.sqrt(dx * dx + dy * dy)
  }
  return perimeter
}

/* ---- ROBUST MASK-TO-POLYGON PIPELINE ---- */

/**
 * Result of grid-edge polygon extraction.
 * Contains outer ring(s) and holes as separate validated polygon rings.
 */
interface GridPolygonResult {
  success: boolean
  failureReason: SolidFailureReason | null
  outerRings: { x: number; y: number }[][]
  holes: { x: number; y: number }[][]
  totalEdges: number
  ringCount: number
}

/**
 * ROBUST grid-edge-based polygon extraction from binary mask.
 * 
 * This algorithm extracts the ACTUAL boundary edges between filled and unfilled
 * grid cells, then chains them into closed rings. Because grid edges are axis-aligned
 * and cannot cross each other, the resulting polygons are GUARANTEED to be simple
 * (no self-intersections).
 * 
 * Algorithm:
 * 1. For each filled cell, check its 4 neighbors
 * 2. If a neighbor is unfilled (or out of bounds), that edge is a boundary edge
 * 3. Collect all boundary edges as directed segments (going CCW around filled region)
 * 4. Chain edges into closed rings by matching endpoints
 * 5. Classify rings as outer (CCW) or holes (CW) by signed area
 */
function extractPolygonsFromMask(mask: boolean[], S: number): GridPolygonResult {
  // Step 1: Extract all boundary edges
  // Each edge is stored as: startX, startY, endX, endY
  // Edges go CCW around the filled region (filled on left, unfilled on right)
  const edges: { x1: number; y1: number; x2: number; y2: number }[] = []
  
  const isFilled = (x: number, y: number): boolean => {
    if (x < 0 || x >= S || y < 0 || y >= S) return false
    return mask[y * S + x]
  }
  
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!mask[y * S + x]) continue
      
      // Cell (x,y) is filled. Check each of its 4 edges.
      // Cell corners: (x,y), (x+1,y), (x+1,y+1), (x,y+1)
      
      // Top edge: if cell above is unfilled, add edge going RIGHT (x,y) -> (x+1,y)
      if (!isFilled(x, y - 1)) {
        edges.push({ x1: x, y1: y, x2: x + 1, y2: y })
      }
      
      // Right edge: if cell to right is unfilled, add edge going DOWN (x+1,y) -> (x+1,y+1)
      if (!isFilled(x + 1, y)) {
        edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 })
      }
      
      // Bottom edge: if cell below is unfilled, add edge going LEFT (x+1,y+1) -> (x,y+1)
      if (!isFilled(x, y + 1)) {
        edges.push({ x1: x + 1, y1: y + 1, x2: x, y2: y + 1 })
      }
      
      // Left edge: if cell to left is unfilled, add edge going UP (x,y+1) -> (x,y)
      if (!isFilled(x - 1, y)) {
        edges.push({ x1: x, y1: y + 1, x2: x, y2: y })
      }
    }
  }
  
  if (edges.length === 0) {
    return { success: false, failureReason: "mask_empty", outerRings: [], holes: [], totalEdges: 0, ringCount: 0 }
  }
  
  // Step 2: Build adjacency map for edge chaining
  // Key: "x,y" of edge start point
  // Value: list of edges starting at that point
  const edgeMap = new Map<string, { x1: number; y1: number; x2: number; y2: number; used: boolean }[]>()
  
  for (const e of edges) {
    const key = `${e.x1},${e.y1}`
    if (!edgeMap.has(key)) edgeMap.set(key, [])
    edgeMap.get(key)!.push({ ...e, used: false })
  }
  
  // Step 3: Chain edges into closed rings
  const rings: { x: number; y: number }[][] = []
  
  for (const startEdges of edgeMap.values()) {
    for (const startEdge of startEdges) {
      if (startEdge.used) continue
      
      // Start a new ring from this edge
      const ring: { x: number; y: number }[] = []
      let currentEdge = startEdge
      
      const maxIterations = edges.length + 10
      let iterations = 0
      
      while (iterations < maxIterations) {
        currentEdge.used = true
        ring.push({ x: currentEdge.x1, y: currentEdge.y1 })
        
        // Find next edge: one that starts where this one ends
        const nextKey = `${currentEdge.x2},${currentEdge.y2}`
        const candidates = edgeMap.get(nextKey)
        
        if (!candidates) break
        
        let nextEdge: typeof currentEdge | null = null
        for (const c of candidates) {
          if (!c.used) {
            nextEdge = c
            break
          }
        }
        
        if (!nextEdge) break
        
        // Check if we've closed the ring
        if (nextEdge.x1 === startEdge.x1 && nextEdge.y1 === startEdge.y1) {
          break
        }
        
        currentEdge = nextEdge
        iterations++
      }
      
      if (ring.length >= 3) {
        rings.push(ring)
      }
    }
  }
  
  if (rings.length === 0) {
    return { success: false, failureReason: "boundary_trace_failed", outerRings: [], holes: [], totalEdges: edges.length, ringCount: 0 }
  }
  
  // Step 4: Classify rings as outer (CCW, positive area) or holes (CW, negative area)
  const outerRings: { x: number; y: number }[][] = []
  const holes: { x: number; y: number }[][] = []
  
  for (const ring of rings) {
    const area = signedArea(ring)
    if (area > 0) {
      outerRings.push(ring)
    } else if (area < 0) {
      holes.push(ring)
    }
    // Zero area rings are degenerate, skip them
  }
  
  if (outerRings.length === 0) {
    return { success: false, failureReason: "no_components", outerRings: [], holes: [], totalEdges: edges.length, ringCount: rings.length }
  }
  
  return {
    success: true,
    failureReason: null,
    outerRings,
    holes,
    totalEdges: edges.length,
    ringCount: rings.length
  }
}

/**
 * Simplify a polygon ring using Douglas-Peucker, but preserve axis-aligned edges.
 * This maintains the rectilinear character of grid-extracted polygons while
 * reducing vertex count for smoother appearance.
 */
function simplifyGridPolygon(pts: { x: number; y: number }[], tolerance: number): { x: number; y: number }[] {
  if (pts.length < 4) return pts
  
  // For grid polygons, use very light simplification to preserve corners
  // but remove redundant collinear points
  const result: { x: number; y: number }[] = []
  
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[(i - 1 + pts.length) % pts.length]
    const curr = pts[i]
    const next = pts[(i + 1) % pts.length]
    
    // Check if curr is collinear with prev and next
    const dx1 = curr.x - prev.x
    const dy1 = curr.y - prev.y
    const dx2 = next.x - curr.x
    const dy2 = next.y - curr.y
    
    // Cross product - if zero, points are collinear
    const cross = dx1 * dy2 - dy1 * dx2
    
    // Keep point if it's a corner (non-collinear)
    if (Math.abs(cross) > 0.001) {
      result.push(curr)
    }
  }
  
  // If too few points remain, use original with DP simplification
  if (result.length < 4) {
    return dpSimplify(pts, tolerance)
  }
  
  return result
}

/**
 * Rasterize a polygon back to a binary mask for fidelity verification.
 * Uses scanline fill algorithm.
 */
function rasterizePolygonToMask(ring: { x: number; y: number }[], S: number): boolean[] {
  const mask = new Array(S * S).fill(false)
  if (ring.length < 3) return mask
  
  // Find Y range
  let minY = Infinity, maxY = -Infinity
  for (const p of ring) {
    minY = Math.min(minY, p.y)
    maxY = Math.max(maxY, p.y)
  }
  
  const yStart = Math.max(0, Math.floor(minY))
  const yEnd = Math.min(S - 1, Math.ceil(maxY))
  
  // Scanline fill
  for (let y = yStart; y <= yEnd; y++) {
    const scanY = y + 0.5
    const intersections: number[] = []
    
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const y1 = ring[j].y, y2 = ring[i].y
      const x1 = ring[j].x, x2 = ring[i].x
      
      if ((y1 <= scanY && y2 > scanY) || (y2 <= scanY && y1 > scanY)) {
        const t = (scanY - y1) / (y2 - y1)
        intersections.push(x1 + t * (x2 - x1))
      }
    }
    
    intersections.sort((a, b) => a - b)
    
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = Math.max(0, Math.floor(intersections[i]))
      const xEnd = Math.min(S - 1, Math.floor(intersections[i + 1]))
      for (let x = xStart; x <= xEnd; x++) {
        mask[y * S + x] = true
      }
    }
  }
  
  return mask
}

/**
 * Compute IoU (Intersection over Union) between original mask and rasterized polygon.
 * This is the FINAL fidelity check to ensure the polygon accurately represents the mask.
 */
function computePolygonFidelity(
  originalMask: boolean[],
  polygonRings: { x: number; y: number }[][],
  S: number
): { iou: number; intersection: number; union: number; originalArea: number; polygonArea: number } {
  // Rasterize all polygon rings
  const polygonMask = new Array(S * S).fill(false)
  
  for (const ring of polygonRings) {
    const ringMask = rasterizePolygonToMask(ring, S)
    for (let i = 0; i < S * S; i++) {
      if (ringMask[i]) polygonMask[i] = true
    }
  }
  
  // Compute IoU
  let intersection = 0
  let originalArea = 0
  let polygonArea = 0
  
  for (let i = 0; i < S * S; i++) {
    if (originalMask[i]) originalArea++
    if (polygonMask[i]) polygonArea++
    if (originalMask[i] && polygonMask[i]) intersection++
  }
  
  const union = originalArea + polygonArea - intersection
  const iou = union > 0 ? intersection / union : 0
  
  return { iou, intersection, union, originalArea, polygonArea }
}

/* ---- Polygon validity checks and cleanup ---- */

interface PolygonValidationResult {
  valid: boolean
  reason: SolidFailureReason | null
  selfIntersectionCount: number
  duplicatePointCount: number
  degenerateEdgeCount: number
  cleanedContour: { x: number; y: number }[] | null
}

/** Check if two line segments intersect (wrapper for point objects) */
function segmentsIntersectPts(
  p1: { x: number; y: number }, p2: { x: number; y: number },
  p3: { x: number; y: number }, p4: { x: number; y: number }
): boolean {
  return segmentsIntersect(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y, p4.x, p4.y)
}

/** Remove duplicate consecutive points and near-zero edges */
function removeDuplicatesAndDegenerateEdges(
  pts: { x: number; y: number }[],
  minEdgeLength: number = 0.5
): { cleaned: { x: number; y: number }[], duplicatesRemoved: number, degenerateRemoved: number } {
  if (pts.length < 3) return { cleaned: pts, duplicatesRemoved: 0, degenerateRemoved: 0 }
  
  const cleaned: { x: number; y: number }[] = []
  let duplicatesRemoved = 0
  let degenerateRemoved = 0
  
  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i]
    const prev = cleaned.length > 0 ? cleaned[cleaned.length - 1] : pts[pts.length - 1]
    
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    
    if (dist < 0.001) {
      duplicatesRemoved++
      continue
    }
    
    if (dist < minEdgeLength && cleaned.length > 0) {
      degenerateRemoved++
      continue
    }
    
    cleaned.push(curr)
  }
  
  // Check closure - if last point is too close to first, remove it
  if (cleaned.length > 3) {
    const first = cleaned[0]
    const last = cleaned[cleaned.length - 1]
    const dx = last.x - first.x
    const dy = last.y - first.y
    if (Math.sqrt(dx * dx + dy * dy) < 0.001) {
      cleaned.pop()
      duplicatesRemoved++
    }
  }
  
  return { cleaned, duplicatesRemoved, degenerateRemoved }
}

/** Count self-intersections in a polygon ring */
function countSelfIntersections(pts: { x: number; y: number }[]): number {
  if (pts.length < 4) return 0
  
  let count = 0
  const n = pts.length
  
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n
    for (let j = i + 2; j < n; j++) {
      // Skip adjacent edges
      if (j === (i + n - 1) % n) continue
      const j2 = (j + 1) % n
      if (j2 === i) continue
      
      if (segmentsIntersectPts(pts[i], pts[i2], pts[j], pts[j2])) {
        count++
      }
    }
  }
  
  return count
}

/**
 * Clean a self-intersecting polygon by removing backtracking loops.
 * Uses a simplified approach: remove segments that cause intersections.
 */
function cleanSelfIntersectingPolygon(pts: { x: number; y: number }[]): { x: number; y: number }[] | null {
  if (pts.length < 4) return pts
  
  // First pass: remove immediate backtracks (A-B-A patterns)
  let cleaned = [...pts]
  let changed = true
  let iterations = 0
  const maxIterations = 10
  
  while (changed && iterations < maxIterations) {
    changed = false
    iterations++
    
    const newCleaned: { x: number; y: number }[] = []
    for (let i = 0; i < cleaned.length; i++) {
      const curr = cleaned[i]
      const prev = newCleaned.length > 0 ? newCleaned[newCleaned.length - 1] : null
      const prevPrev = newCleaned.length > 1 ? newCleaned[newCleaned.length - 2] : null
      
      // Check for A-B-A backtrack pattern
      if (prevPrev && prev) {
        const dx1 = prev.x - prevPrev.x
        const dy1 = prev.y - prevPrev.y
        const dx2 = curr.x - prev.x
        const dy2 = curr.y - prev.y
        
        // If vectors are roughly opposite, this is a backtrack
        const dot = dx1 * dx2 + dy1 * dy2
        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)
        
        if (len1 > 0.001 && len2 > 0.001) {
          const cosAngle = dot / (len1 * len2)
          if (cosAngle < -0.95) {
            // Nearly 180 degree turn - remove the spike
            newCleaned.pop() // Remove prev (the spike tip)
            changed = true
            continue
          }
        }
      }
      
      newCleaned.push(curr)
    }
    
    cleaned = newCleaned
  }
  
  // Second pass: remove crossing loops by walking the contour and skipping crossed sections
  const intersections = countSelfIntersections(cleaned)
  if (intersections > 0 && cleaned.length > 10) {
    // Try to simplify aggressively to remove self-intersections
    const simplified = dpSimplify(cleaned, 2.0) // Higher tolerance
    if (countSelfIntersections(simplified) === 0 && simplified.length >= 3) {
      return simplified
    }
  }
  
  return cleaned.length >= 3 ? cleaned : null
}

/** Full polygon validation and cleanup pipeline */
function validateAndCleanPolygon(
  pts: { x: number; y: number }[]
): PolygonValidationResult {
  // Step 1: Remove duplicates and degenerate edges
  const { cleaned, duplicatesRemoved, degenerateRemoved } = removeDuplicatesAndDegenerateEdges(pts)
  
  if (cleaned.length < 3) {
    return {
      valid: false,
      reason: "invalid_ring_too_small",
      selfIntersectionCount: 0,
      duplicatePointCount: duplicatesRemoved,
      degenerateEdgeCount: degenerateRemoved,
      cleanedContour: null
    }
  }
  
  // Step 2: Check for self-intersections
  let selfIntersections = countSelfIntersections(cleaned)
  
  if (selfIntersections > 0) {
    // Try to clean the polygon
    const cleanedPoly = cleanSelfIntersectingPolygon(cleaned)
    
    if (!cleanedPoly) {
      return {
        valid: false,
        reason: "invalid_polygon_cleanup_failed",
        selfIntersectionCount: selfIntersections,
        duplicatePointCount: duplicatesRemoved,
        degenerateEdgeCount: degenerateRemoved,
        cleanedContour: null
      }
    }
    
    // Re-check after cleanup
    selfIntersections = countSelfIntersections(cleanedPoly)
    
    if (selfIntersections > 0) {
      return {
        valid: false,
        reason: "invalid_self_intersection",
        selfIntersectionCount: selfIntersections,
        duplicatePointCount: duplicatesRemoved,
        degenerateEdgeCount: degenerateRemoved,
        cleanedContour: cleanedPoly
      }
    }
    
    return {
      valid: true,
      reason: null,
      selfIntersectionCount: 0,
      duplicatePointCount: duplicatesRemoved,
      degenerateEdgeCount: degenerateRemoved,
      cleanedContour: cleanedPoly
    }
  }
  
  // No self-intersections, polygon is valid
  return {
    valid: true,
    reason: null,
    selfIntersectionCount: 0,
    duplicatePointCount: duplicatesRemoved,
    degenerateEdgeCount: degenerateRemoved,
    cleanedContour: cleaned
  }
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

interface ContourMeta {
  contour: { x: number; y: number }[]
  index: number
  absArea: number
  signedArea: number
  nestingDepth: number
  parentIndex: number  // -1 if top-level
}

interface ClassifiedContours {
  outer: { x: number; y: number }[]
  outerIndex: number
  holes: { x: number; y: number }[][]
  holeIndices: number[]
}

/**
 * Classify contours for SOLID mode: single largest outer + interior holes only.
 * 
 * KEY INSIGHT: Marching squares extracts BOUNDARY contours (edges of filled regions).
 * For a thick stroke that doesn't self-overlap, we get TWO parallel contours (inner and outer edges).
 * These are NOT nested - neither contains the other - so nesting-depth classification fails.
 * 
 * SOLUTION: Use the LARGEST contour as the single filled body. Any smaller contours
 * that are GEOMETRICALLY INSIDE the largest become holes. All others are discarded.
 * This produces a clean filled solid instead of ribbon artifacts.
 */
function classifyContours(contours: { x: number; y: number }[][]): ClassifiedContours[] {
  if (contours.length === 0) return []

  // Sort by area descending - largest first
  const sorted = contours
    .map((c, idx) => ({ contour: c, index: idx, area: contourArea(c) }))
    .sort((a, b) => b.area - a.area)

  // The LARGEST contour is the outer boundary of the filled solid
  const largest = sorted[0]
  
  // Find holes: smaller contours whose CENTROID is inside the largest
  const holes: { x: number; y: number }[][] = []
  const holeIndices: number[] = []

  for (let i = 1; i < sorted.length; i++) {
    const candidate = sorted[i]
    // Use centroid for more robust inside test
    const centroid = contourCentroid(candidate.contour)
    if (pointInPolygon(centroid.x, centroid.y, largest.contour)) {
      holes.push(candidate.contour)
      holeIndices.push(candidate.index)
    }
    // Contours NOT inside the largest are discarded (they're parallel boundary artifacts)
  }

  return [{
    outer: largest.contour,
    outerIndex: largest.index,
    holes,
    holeIndices
  }]
}

/** Compute centroid of a contour */
function contourCentroid(pts: { x: number; y: number }[]): { x: number; y: number } {
  if (pts.length === 0) return { x: 0, y: 0 }
  let cx = 0, cy = 0
  for (const p of pts) {
    cx += p.x
    cy += p.y
  }
  return { x: cx / pts.length, y: cy / pts.length }
}

/** Compute signed area of a THREE.Vector2 polygon (for winding check) */
function computeShapeArea(pts: THREE.Vector2[]): number {
  let area = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y)
  }
  return area / 2  // Positive = CCW, Negative = CW
}

/** Return metadata for all contours for debug visualization (simplified: largest is outer, inside = hole) */
function buildContourHierarchy(contours: { x: number; y: number }[][]): ContourMeta[] {
  if (contours.length === 0) return []

  const metas: ContourMeta[] = contours.map((c, idx) => ({
    contour: c,
    index: idx,
    absArea: contourArea(c),
    signedArea: signedArea(c),
    nestingDepth: 0,
    parentIndex: -1
  }))
  metas.sort((a, b) => b.absArea - a.absArea)

  // Largest is the outer (depth 0), everything inside it is a hole (depth 1), rest is discarded (depth -1)
  if (metas.length > 0) {
    const largest = metas[0]
    largest.nestingDepth = 0
    largest.parentIndex = -1

    for (let i = 1; i < metas.length; i++) {
      const m = metas[i]
      const centroid = contourCentroid(m.contour)
      if (pointInPolygon(centroid.x, centroid.y, largest.contour)) {
        m.nestingDepth = 1  // Hole inside the largest
        m.parentIndex = largest.index
      } else {
        m.nestingDepth = -1  // Discarded (parallel boundary artifact)
        m.parentIndex = -1
      }
    }
  }

  return metas
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
  failureReason: SolidFailureReason
  contourCount: number
  holesCount: number
  rawContourCount: number
  rejectedCount: number
  validOuterCount: number
  openContourCount: number
  selfIntersectCount: number
  pixelsBefore: number
  pixelsAfter: number
  holesKept: number
  holesFilled: number
  debugContours: SolidDebugContour[]
  // Linear trace values
  componentCount: number
  selectedComponentArea: number
  tracedBoundaryPoints: number
  simplifiedPoints: number
  contourClosed: boolean
  signedArea: number
  // Fidelity metrics
  originalMaskArea: number
  simplifiedMaskArea: number
  areaRetentionRatio: number
  maskIoU: number
  usedFallbackContour: boolean
  // Polygon validation metrics
  selfIntersectionsFound: number
  duplicatePointsRemoved: number
  degenerateEdgesRemoved: number
  polygonValidationPassed: boolean
  // Geometry metrics
  vertexCount: number
  indexCount: number
  bboxSize: [number, number, number] | null
  bboxCenter: [number, number, number] | null
  rebuildTimeMs: number
}

/** Count true pixels in mask */
function countMaskPixels(mask: boolean[]): number {
  let count = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) count++
  }
  return count
}

/**
 * Morphological dilation - expand true pixels by radius.
 * For each true pixel, set all pixels within radius to true.
 */
function dilateMask(mask: boolean[], S: number, radius: number): boolean[] {
  if (radius <= 0) return mask.slice()
  const result = mask.slice()
  const r = Math.ceil(radius)
  
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!mask[y * S + x]) continue
      // Set all pixels within radius to true
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= S || ny < 0 || ny >= S) continue
          result[ny * S + nx] = true
        }
      }
    }
  }
  return result
}

/**
 * Morphological erosion - shrink true pixels by radius.
 * A pixel remains true only if all pixels within radius are true.
 */
function erodeMask(mask: boolean[], S: number, radius: number): boolean[] {
  if (radius <= 0) return mask.slice()
  const result: boolean[] = new Array(S * S).fill(false)
  const r = Math.ceil(radius)
  
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!mask[y * S + x]) continue
      // Check if all pixels within radius are true
      let allTrue = true
      outer: for (let dy = -r; dy <= r && allTrue; dy++) {
        for (let dx = -r; dx <= r && allTrue; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue
          const nx = x + dx, ny = y + dy
          if (nx < 0 || nx >= S || ny < 0 || ny >= S) {
            allTrue = false
            break outer
          }
          if (!mask[ny * S + nx]) {
            allTrue = false
            break outer
          }
        }
      }
      result[y * S + x] = allTrue
    }
  }
  return result
}

/**
 * Morphological close (dilation then erosion) - fills narrow gaps.
 * Radius should be based on stroke thickness to close internal voids.
 */
function morphologicalClose(mask: boolean[], S: number, radius: number): boolean[] {
  const dilated = dilateMask(mask, S, radius)
  return erodeMask(dilated, S, radius)
}

/** Compute bounding box of a contour and return min dimension */
function contourMinDimension(pts: { x: number; y: number }[]): number {
  if (pts.length === 0) return 0
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of pts) {
    minX = Math.min(minX, p.x)
    minY = Math.min(minY, p.y)
    maxX = Math.max(maxX, p.x)
    maxY = Math.max(maxY, p.y)
  }
  const width = maxX - minX
  const height = maxY - minY
  return Math.min(width, height)
}

/** Check if a hole should be kept based on geometry relative to thickness */
function shouldKeepHole(
  hole: { x: number; y: number }[],
  outerArea: number,
  thicknessInPixels: number
): { keep: boolean; reason: string } {
  const area = contourArea(hole)
  const minDim = contourMinDimension(hole)
  
  // Minimum area threshold: hole must be at least 2x thickness squared
  const minAreaThreshold = thicknessInPixels * thicknessInPixels * 4
  if (area < minAreaThreshold) {
    return { keep: false, reason: `area ${area.toFixed(0)} < ${minAreaThreshold.toFixed(0)} (4*thick^2)` }
  }
  
  // Minimum dimension threshold: hole must be at least 2x thickness wide
  const minDimThreshold = thicknessInPixels * 2
  if (minDim < minDimThreshold) {
    return { keep: false, reason: `minDim ${minDim.toFixed(0)} < ${minDimThreshold.toFixed(0)} (2*thick)` }
  }
  
  // Ratio threshold: hole must be at least 10% of outer area to be meaningful
  const ratioThreshold = 0.10
  if (area / outerArea < ratioThreshold) {
    return { keep: false, reason: `ratio ${(area / outerArea * 100).toFixed(1)}% < ${ratioThreshold * 100}%` }
  }
  
  return { keep: true, reason: "substantial" }
}

/**
 * Build a watertight extruded mesh from raster mask using connected-component boundary tracing.
 * Pipeline: connected components -> largest component -> Moore boundary trace -> simplify -> THREE.Shape -> extrude
 */
function buildSolidMeshFromMask(
  mask: boolean[],
  canvasWidth: number,
  canvasHeight: number,
  depth: number,
  thickness: number
): SolidBuildResult {
  const t0 = performance.now()
  const S = SOLID_RASTER_SIZE
  const scaleRef = Math.max(canvasWidth, canvasHeight)
  const normScale = 3 / scaleRef

  // Convert raster coords -> world coords (matching strokeTo3D transform)
  const toWorldX = (rx: number) => ((rx / S) * canvasWidth - canvasWidth / 2) * normScale
  const toWorldY = (ry: number) => -((ry / S) * canvasHeight - canvasHeight / 2) * normScale

  const pixelsBefore = countMaskPixels(mask)
  const debugContours: SolidDebugContour[] = []
  
  // Helper to create result with failure reason
  const makeResult = (
    failureReason: SolidFailureReason,
    geometry: THREE.BufferGeometry | null = null,
    extras: Partial<SolidBuildResult> = {}
  ): SolidBuildResult => {
    const rebuildTimeMs = performance.now() - t0
    return {
      geometry,
      failureReason,
      contourCount: 0,
      holesCount: 0,
      rawContourCount: 0,
      rejectedCount: 0,
      validOuterCount: 0,
      openContourCount: 0,
      selfIntersectCount: 0,
      pixelsBefore,
      pixelsAfter: pixelsBefore,
      holesKept: 0,
      holesFilled: 0,
      debugContours,
      componentCount: 0,
      selectedComponentArea: 0,
      tracedBoundaryPoints: 0,
      simplifiedPoints: 0,
      contourClosed: false,
      signedArea: 0,
      originalMaskArea: 0,
      simplifiedMaskArea: 0,
      areaRetentionRatio: 0,
      maskIoU: 0,
      usedFallbackContour: false,
      selfIntersectionsFound: 0,
      duplicatePointsRemoved: 0,
      degenerateEdgesRemoved: 0,
      polygonValidationPassed: false,
      vertexCount: 0,
      indexCount: 0,
      bboxSize: null,
      bboxCenter: null,
      rebuildTimeMs,
      ...extras
    }
  }

  // Step 1: Check mask
  if (pixelsBefore === 0) {
    return makeResult("mask_empty")
  }

  // Step 2: Connected component labeling
  const { labels, componentCount, componentSizes } = labelConnectedComponents(mask, S)
  if (componentCount === 0) {
    return makeResult("no_components", null, { componentCount: 0 })
  }

  // Step 3: Find largest component
  let largestLabel = 1, largestSize = 0
  for (let i = 1; i <= componentCount; i++) {
    if (componentSizes[i] > largestSize) {
      largestSize = componentSizes[i]
      largestLabel = i
    }
  }
  if (largestSize < 4) {
    return makeResult("component_too_small", null, { componentCount, selectedComponentArea: largestSize })
  }

  // Step 4: Create binary mask for largest component
  const componentMask: boolean[] = new Array(S * S)
  for (let i = 0; i < S * S; i++) {
    componentMask[i] = labels[i] === largestLabel
  }

  // ========== NEW ROBUST GRID-EDGE POLYGON EXTRACTION ==========
  // This replaces the broken contour tracer with a mathematically guaranteed approach
  
  // Step 5: Extract polygons from mask using grid-edge algorithm
  const polygonResult = extractPolygonsFromMask(componentMask, S)
  
  if (!polygonResult.success || polygonResult.outerRings.length === 0) {
    return makeResult(polygonResult.failureReason || "boundary_trace_failed", null, {
      componentCount,
      selectedComponentArea: largestSize,
      tracedBoundaryPoints: polygonResult.totalEdges
    })
  }
  
  // Step 6: Select largest outer ring
  let largestRing = polygonResult.outerRings[0]
  let largestRingArea = Math.abs(signedArea(largestRing))
  for (const ring of polygonResult.outerRings) {
    const area = Math.abs(signedArea(ring))
    if (area > largestRingArea) {
      largestRingArea = area
      largestRing = ring
    }
  }
  
  // Step 7: Simplify the outer ring (light simplification to remove collinear points)
  const simplifiedOuter = simplifyGridPolygon(largestRing, DP_TOLERANCE * 0.5)
  const simplifiedArea = signedArea(simplifiedOuter)
  
  if (simplifiedOuter.length < 3) {
    return makeResult("simplified_contour_too_small", null, {
      componentCount,
      selectedComponentArea: largestSize,
      tracedBoundaryPoints: largestRing.length,
      simplifiedPoints: simplifiedOuter.length
    })
  }
  
  // Step 8: Compute fidelity by re-rasterizing polygon and comparing to original mask
  const fidelity = computePolygonFidelity(componentMask, [simplifiedOuter], S)
  const maskIoU = fidelity.iou
  const areaRetentionRatio = fidelity.originalArea > 0 ? fidelity.polygonArea / fidelity.originalArea : 0
  
  // CRITICAL FIDELITY GATE: Reject if polygon doesn't match the mask
  // This prevents the "success on broken output" problem
  const MIN_IOL_THRESHOLD = 0.70  // At least 70% IoU required
  const MIN_AREA_RETENTION = 0.60  // At least 60% of original area
  
  if (maskIoU < MIN_IOL_THRESHOLD || areaRetentionRatio < MIN_AREA_RETENTION) {
    return makeResult("low_fidelity_result", null, {
      componentCount,
      selectedComponentArea: largestSize,
      tracedBoundaryPoints: largestRing.length,
      simplifiedPoints: simplifiedOuter.length,
      originalMaskArea: fidelity.originalArea,
      simplifiedMaskArea: fidelity.polygonArea,
      areaRetentionRatio,
      maskIoU
    })
  }
  
  // Step 9: Collect holes from the polygon result
  const holes = polygonResult.holes
  let holesKept = 0
  
  // Debug contour info
  debugContours.push({
    points: simplifiedOuter,
    type: "outer",
    area: Math.abs(simplifiedArea),
    signedArea: simplifiedArea,
    isClosed: true,
    nestingDepth: 0,
    contourIndex: 0
  })
  for (let i = 0; i < holes.length; i++) {
    debugContours.push({
      points: holes[i],
      type: "hole",
      area: contourArea(holes[i]),
      signedArea: signedArea(holes[i]),
      isClosed: true,
      nestingDepth: 1,
      parentIndex: 0,
      contourIndex: i + 1
    })
  }
  
  // Step 10: Transform to world coords and build THREE.Shape
  let shapePts = simplifiedOuter.map((p) => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y)))
  const outerWindingArea = computeShapeArea(shapePts)
  if (outerWindingArea < 0) {
    shapePts = shapePts.slice().reverse()
  }

  let shape: THREE.Shape
  try {
    shape = new THREE.Shape(shapePts)
  } catch {
    return makeResult("shape_creation_failed", null, {
      componentCount,
      selectedComponentArea: largestSize,
      tracedBoundaryPoints: largestRing.length,
      simplifiedPoints: simplifiedOuter.length
    })
  }

  // Add holes with correct winding (CW for THREE.js)
  for (const hole of holes) {
    if (hole.length < 3) continue
    // Simplify hole too
    const simplifiedHole = simplifyGridPolygon(hole, DP_TOLERANCE * 0.5)
    if (simplifiedHole.length < 3) continue
    
    let holePts = simplifiedHole.map((p) => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y)))
    const holeWindingArea = computeShapeArea(holePts)
    if (holeWindingArea > 0) {
      holePts = holePts.slice().reverse()
    }
    shape.holes.push(new THREE.Path(holePts))
    holesKept++
  }

  // Step 11: Extrude
  const halfDepth = depth / 2
  let geometry: THREE.BufferGeometry | null = null
  try {
    geometry = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
    })
    geometry.translate(0, 0, -halfDepth)
  } catch {
    return makeResult("extrude_failed", null, {
      componentCount,
      selectedComponentArea: largestSize,
      tracedBoundaryPoints: largestRing.length,
      simplifiedPoints: simplifiedOuter.length,
      contourCount: 1,
      holesCount: holesKept
    })
  }

  // Step 12: Validate geometry
  if (!geometry) {
    return makeResult("geometry_null", null, {
      componentCount,
      selectedComponentArea: largestSize,
      tracedBoundaryPoints: largestRing.length,
      simplifiedPoints: simplifiedOuter.length
    })
  }

  const posAttr = geometry.getAttribute("position")
  const indexAttr = geometry.getIndex()
  const vertexCount = posAttr ? posAttr.count : 0
  const indexCount = indexAttr ? indexAttr.count : 0

  if (vertexCount === 0) {
    return makeResult("geometry_zero_vertices", null, {
      componentCount,
      selectedComponentArea: largestSize,
      tracedBoundaryPoints: largestRing.length,
      simplifiedPoints: simplifiedOuter.length,
      vertexCount: 0,
      indexCount
    })
  }

  // Check for non-finite positions
  let hasNonFinite = false
  if (posAttr) {
    const arr = posAttr.array
    for (let i = 0; i < arr.length; i++) {
      if (!Number.isFinite(arr[i])) {
        hasNonFinite = true
        break
      }
    }
  }
  if (hasNonFinite) {
    return makeResult("geometry_non_finite", null, {
      componentCount,
      selectedComponentArea: largestSize,
      tracedBoundaryPoints: largestRing.length,
      simplifiedPoints: simplifiedOuter.length,
      vertexCount,
      indexCount
    })
  }

  // Compute bounding box
  geometry.computeBoundingBox()
  const bbox = geometry.boundingBox
  let bboxSize: [number, number, number] | null = null
  let bboxCenter: [number, number, number] | null = null
  
  if (bbox) {
    const size = new THREE.Vector3().subVectors(bbox.max, bbox.min)
    const center = new THREE.Vector3().addVectors(bbox.min, bbox.max).multiplyScalar(0.5)
    bboxSize = [size.x, size.y, size.z]
    bboxCenter = [center.x, center.y, center.z]
    
    // Check for degenerate bbox
    if (size.x < 0.0001 && size.y < 0.0001 && size.z < 0.0001) {
      return makeResult("geometry_bad_bbox", null, {
        componentCount,
        selectedComponentArea: largestSize,
        tracedBoundaryPoints: largestRing.length,
        simplifiedPoints: simplifiedOuter.length,
        vertexCount,
        indexCount,
        bboxSize,
        bboxCenter
      })
    }
  }

  const rebuildTimeMs = performance.now() - t0

  return {
    geometry,
    failureReason: "success",
    contourCount: polygonResult.outerRings.length,
    holesCount: holesKept,
    rawContourCount: polygonResult.ringCount,
    rejectedCount: 0,
    validOuterCount: polygonResult.outerRings.length,
    openContourCount: 0,
    selfIntersectCount: 0,
    pixelsBefore,
    pixelsAfter: largestSize,
    holesKept,
    holesFilled: holes.length - holesKept,
    debugContours,
    componentCount,
    selectedComponentArea: largestSize,
    tracedBoundaryPoints: largestRing.length,
    simplifiedPoints: simplifiedOuter.length,
    contourClosed: true,  // Grid-edge polygons are always closed
    signedArea: simplifiedArea,
    originalMaskArea: fidelity.originalArea,
    simplifiedMaskArea: fidelity.polygonArea,
    areaRetentionRatio,
    maskIoU,
    usedFallbackContour: false,  // No fallback in new pipeline
    selfIntersectionsFound: 0,  // Grid-edge polygons cannot self-intersect
    duplicatePointsRemoved: 0,
    degenerateEdgesRemoved: 0,
    polygonValidationPassed: true,  // Passed fidelity check
    vertexCount,
    indexCount,
    bboxSize,
    bboxCenter,
    rebuildTimeMs
  }
}

/** Connected component labeling using flood fill */
function labelConnectedComponents(mask: boolean[], S: number): { labels: number[], componentCount: number, componentSizes: number[] } {
  const labels = new Array(S * S).fill(0)
  const componentSizes: number[] = [0]  // Index 0 unused
  let componentCount = 0

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const idx = y * S + x
      if (mask[idx] && labels[idx] === 0) {
        componentCount++
        let size = 0
        // Flood fill using a queue (BFS to avoid stack overflow)
        const queue: number[] = [idx]
        labels[idx] = componentCount
        while (queue.length > 0) {
          const ci = queue.shift()!
          size++
          const cx = ci % S, cy = Math.floor(ci / S)
          // 4-connected neighbors
          const neighbors = [
            cy > 0 ? ci - S : -1,      // up
            cy < S - 1 ? ci + S : -1,  // down
            cx > 0 ? ci - 1 : -1,      // left
            cx < S - 1 ? ci + 1 : -1   // right
          ]
          for (const ni of neighbors) {
            if (ni >= 0 && mask[ni] && labels[ni] === 0) {
              labels[ni] = componentCount
              queue.push(ni)
            }
          }
        }
        componentSizes.push(size)
      }
    }
  }

  return { labels, componentCount, componentSizes }
}

/**
 * Marching Squares contour tracer - traces the ACTUAL outer boundary of a binary mask.
 * Unlike pixel-center tracing, this follows the edges between filled and unfilled cells.
 * Returns a closed polygon in raster coordinates.
 */
function traceOuterBoundaryMarchingSquares(mask: boolean[], S: number): { x: number, y: number }[] {
  // Helper to get cell value (treat out-of-bounds as FALSE)
  const getCell = (x: number, y: number): boolean => {
    if (x < 0 || x >= S || y < 0 || y >= S) return false
    return mask[y * S + x]
  }
  
  // Find starting edge: scan for first transition from FALSE to TRUE going left-to-right
  let startX = -1, startY = -1, startEdge = -1
  outer: for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (getCell(x, y)) {
        // Found a filled cell - check if it has a border on top or left
        if (!getCell(x, y - 1)) {
          // Top edge is a border
          startX = x
          startY = y
          startEdge = 0 // top
          break outer
        }
        if (!getCell(x - 1, y)) {
          // Left edge is a border
          startX = x
          startY = y
          startEdge = 3 // left
          break outer
        }
      }
    }
  }
  
  if (startX < 0) return []
  
  // Edge codes: 0=top, 1=right, 2=bottom, 3=left
  // For each edge, define the vertex positions (corners of the cell)
  // Cell (x,y) has corners at (x,y), (x+1,y), (x+1,y+1), (x,y+1)
  const edgeToVertex: { [edge: number]: (x: number, y: number) => { x: number, y: number } } = {
    0: (x, y) => ({ x: x + 0.5, y }),       // top edge midpoint
    1: (x, y) => ({ x: x + 1, y: y + 0.5 }), // right edge midpoint
    2: (x, y) => ({ x: x + 0.5, y: y + 1 }), // bottom edge midpoint
    3: (x, y) => ({ x, y: y + 0.5 }),       // left edge midpoint
  }
  
  // Next cell and edge based on current edge
  // If we enter a cell from edge E, we check which edges are borders and pick the next one clockwise
  const boundary: { x: number, y: number }[] = []
  const visited = new Set<string>()
  
  let cx = startX, cy = startY, edge = startEdge
  const maxIterations = S * S * 4
  let iterations = 0
  
  do {
    // Add vertex for current edge
    const v = edgeToVertex[edge](cx, cy)
    const vkey = `${v.x.toFixed(1)},${v.y.toFixed(1)}`
    
    // Skip duplicate consecutive vertices
    if (boundary.length === 0 || 
        Math.abs(boundary[boundary.length - 1].x - v.x) > 0.01 || 
        Math.abs(boundary[boundary.length - 1].y - v.y) > 0.01) {
      boundary.push(v)
    }
    
    const cellKey = `${cx},${cy},${edge}`
    if (visited.has(cellKey) && boundary.length > 3) {
      break // Closed loop
    }
    visited.add(cellKey)
    
    // Determine next edge by checking neighbors
    // We're on edge `edge` of cell (cx, cy). The cell is filled.
    // We move clockwise around the boundary.
    
    // From each edge, check clockwise: same cell next edge, or cross to neighbor
    let nextCx = cx, nextCy = cy, nextEdge = edge
    
    if (edge === 0) { // top edge
      // Check right neighbor's top, or our right edge
      if (getCell(cx + 1, cy) && !getCell(cx + 1, cy - 1)) {
        nextCx = cx + 1
        nextEdge = 0 // continue on top
      } else if (!getCell(cx + 1, cy)) {
        nextEdge = 1 // turn to right edge
      } else {
        // Neighbor above-right: go up
        nextCy = cy - 1
        nextCx = cx + 1
        nextEdge = 3 // left edge of cell above-right
      }
    } else if (edge === 1) { // right edge
      if (getCell(cx, cy + 1) && !getCell(cx + 1, cy + 1)) {
        nextCy = cy + 1
        nextEdge = 1 // continue on right
      } else if (!getCell(cx, cy + 1)) {
        nextEdge = 2 // turn to bottom edge
      } else {
        nextCx = cx + 1
        nextCy = cy + 1
        nextEdge = 0 // top edge of cell below-right
      }
    } else if (edge === 2) { // bottom edge
      if (getCell(cx - 1, cy) && !getCell(cx - 1, cy + 1)) {
        nextCx = cx - 1
        nextEdge = 2 // continue on bottom
      } else if (!getCell(cx - 1, cy)) {
        nextEdge = 3 // turn to left edge
      } else {
        nextCx = cx - 1
        nextCy = cy + 1
        nextEdge = 1 // right edge of cell below-left
      }
    } else { // edge === 3, left edge
      if (getCell(cx, cy - 1) && !getCell(cx - 1, cy - 1)) {
        nextCy = cy - 1
        nextEdge = 3 // continue on left
      } else if (!getCell(cx, cy - 1)) {
        nextEdge = 0 // turn to top edge
      } else {
        nextCx = cx - 1
        nextCy = cy - 1
        nextEdge = 2 // bottom edge of cell above-left
      }
    }
    
    cx = nextCx
    cy = nextCy
    edge = nextEdge
    iterations++
  } while ((cx !== startX || cy !== startY || edge !== startEdge) && iterations < maxIterations)
  
  // Ensure closure
  if (boundary.length > 2) {
    const first = boundary[0]
    const last = boundary[boundary.length - 1]
    if (Math.abs(first.x - last.x) > 0.01 || Math.abs(first.y - last.y) > 0.01) {
      boundary.push({ x: first.x, y: first.y })
    }
  }
  
  return boundary
}

/** Find enclosed holes within a component */
function findEnclosedHoles(componentMask: boolean[], S: number, outerBoundary: { x: number, y: number }[]): { x: number, y: number }[][] {
  // For MVP: skip hole detection to ensure clean solid
  // True holes would require finding FALSE regions completely surrounded by TRUE
  // This is complex and error-prone; returning empty for now
  return []
}



/**
 * Convert ProcessedStroke[] to a single merged TestStroke for the sandbox pipeline.
 * 
 * CRITICAL: The sandbox pipeline (buildMaskSolid/renderStrokeToMask) expects points
 * in WORLD COORDINATES (roughly -1.5 to +1.5 range, centered at 0).
 * 
 * Real app strokes are in CANVAS PIXEL COORDINATES (0 to canvasWidth/Height).
 * 
 * This function converts from canvas pixel space to world space.
 */
function strokesToTestStroke(strokes: ProcessedStroke[], canvasWidth: number, canvasHeight: number): TestStroke {
  const allPoints: { x: number; y: number }[] = []
  
  // Convert canvas pixel coords to world coords
  // Canvas: (0,0) top-left, (canvasWidth, canvasHeight) bottom-right
  // World: (-1.5, -1.5) to (1.5, 1.5), center at (0, 0), Y-up
  const scale = 3.0 / Math.max(canvasWidth, canvasHeight)
  const offsetX = canvasWidth / 2
  const offsetY = canvasHeight / 2
  
  for (const s of strokes) {
    for (const p of s.points) {
      // Convert: canvas pixel -> centered -> scaled -> flip Y for world coords
      const worldX = (p.x - offsetX) * scale
      const worldY = -(p.y - offsetY) * scale  // Flip Y: canvas Y-down, world Y-up
      allPoints.push({ x: worldX, y: worldY })
    }
  }
  return { points: allPoints }
}

/**
 * Build solidStatus from MaskSolidResult for debug overlay compatibility.
 */
function buildSolidStatusFromMaskResult(
  result: MaskSolidResult,
  thickness: number,
  depth: number
): SolidBuildStatus {
  const success = result.geometry !== null
  return {
    success,
    failureReason: success ? "success" : "mask_empty",
    contourCount: 1,
    holesCount: result.stats.holeCount,
    thickness,
    depth,
    filledPixelCount: result.stats.filledPixelCount,
    componentCount: result.stats.componentCount,
    selectedComponentArea: result.stats.largestComponentPixels,
    tracedBoundaryPoints: result.stats.outerContourPoints,
    simplifiedPoints: result.stats.simplifiedOuterPoints,
    contourClosed: true,
    signedArea: 0,
    originalMaskArea: result.stats.largestComponentPixels,
    simplifiedMaskArea: result.stats.largestComponentPixels,
    areaRetentionRatio: 1.0,
    maskIoU: 1.0,
    usedFallbackContour: false,
    selfIntersectionsFound: 0,
    duplicatePointsRemoved: 0,
    degenerateEdgesRemoved: 0,
    polygonValidationPassed: true,
    vertexCount: result.geometry?.getAttribute("position")?.count ?? 0,
    indexCount: result.geometry?.getIndex()?.count ?? 0,
    bboxSize: null,
    bboxCenter: null,
    rebuildTimeMs: result.stats.rebuildTimeMs,
    rawContourCount: 1,
    rejectedCount: 0,
    validOuterCount: 1,
    openContourCount: 0,
    selfIntersectCount: 0,
    pixelsBefore: result.stats.filledPixelCount,
    pixelsAfter: result.stats.largestComponentPixels,
    holesKept: result.stats.holeCount,
    holesFilled: 0,
    debugContours: [],
    rasterSize: result.stats.maskResolution,
  }
}

export const SolidEngine: GeometryEngine = {
  buildPreview(strokes: ProcessedStroke[], params: PreviewParams): StrokeMeshData[] {
    const { canvasWidth, canvasHeight, solidParams: sp } = params
    const solidParams = sp ?? DEFAULT_SOLID_PARAMS
    
    // Update debug state - engine was called
    SOLID_DEBUG.lastUpdate = Date.now()
    SOLID_DEBUG.engineCalled = true
    SOLID_DEBUG.canvasWidth = canvasWidth
    SOLID_DEBUG.canvasHeight = canvasHeight
    SOLID_DEBUG.strokeCount = strokes.length
    SOLID_DEBUG.buildMaskSolidCalled = false
    SOLID_DEBUG.buildMaskSolidSuccess = false
    SOLID_DEBUG.geometryReturned = false
    SOLID_DEBUG.vertexCount = 0
    SOLID_DEBUG.filledPixels = 0
    SOLID_DEBUG.failureReason = ""
    
    if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) {
      SOLID_DEBUG.bucket = "B"
      SOLID_DEBUG.failureReason = strokes.length === 0 ? "no strokes" : "canvas 0"
      return []
    }

    // Convert strokes to sandbox format (canvas pixels -> world coords) and call sandbox pipeline
    const testStroke = strokesToTestStroke(strokes, canvasWidth, canvasHeight)
    SOLID_DEBUG.pointCount = testStroke.points.length
    SOLID_DEBUG.buildMaskSolidCalled = true
    
    // CRITICAL: Convert thickness from canvas pixels to world units
    // Same scale factor as coordinate conversion: 3.0 / max(canvasWidth, canvasHeight)
    const coordScale = 3.0 / Math.max(canvasWidth, canvasHeight)
    const worldThickness = solidParams.thickness * coordScale
    SOLID_DEBUG.inputThickness = solidParams.thickness
    SOLID_DEBUG.worldThickness = worldThickness
    
    // Record coordinate ranges for debug
    if (testStroke.points.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const p of testStroke.points) {
        if (p.x < minX) minX = p.x
        if (p.x > maxX) maxX = p.x
        if (p.y < minY) minY = p.y
        if (p.y > maxY) maxY = p.y
      }
      SOLID_DEBUG.worldMinX = minX
      SOLID_DEBUG.worldMaxX = maxX
      SOLID_DEBUG.worldMinY = minY
      SOLID_DEBUG.worldMaxY = maxY
    }
    
    const result = buildMaskSolid(testStroke, worldThickness, solidParams.depth, canvasWidth, canvasHeight)
    
    SOLID_DEBUG.filledPixels = result.stats.filledPixelCount
    SOLID_DEBUG.maskArea = result.stats.maskResolution * result.stats.maskResolution
    SOLID_DEBUG.filledPercent = SOLID_DEBUG.maskArea > 0 ? (SOLID_DEBUG.filledPixels / SOLID_DEBUG.maskArea) * 100 : 0
    
    // Populate comprehensive contour diagnostics
    SOLID_DEBUG.rawContourPoints = result.stats.outerContourPoints
    SOLID_DEBUG.simplifiedContourPoints = result.stats.simplifiedOuterPoints
    SOLID_DEBUG.outerSignedArea = result.diagnostics.outerSignedArea
    SOLID_DEBUG.outerWinding = result.diagnostics.outerWinding
    SOLID_DEBUG.outerSelfIntersects = result.diagnostics.outerSelfIntersects
    SOLID_DEBUG.holeCount = result.stats.holeCount
    SOLID_DEBUG.holeAreas = result.diagnostics.holeAreas
    SOLID_DEBUG.holeWindings = result.diagnostics.holeWindings
    SOLID_DEBUG.anyHoleSelfIntersects = result.diagnostics.anyHoleSelfIntersects
    SOLID_DEBUG.anyHoleOutsideOuter = result.diagnostics.anyHoleOutsideOuter
    SOLID_DEBUG.holesOverlap = result.diagnostics.holesOverlap
    SOLID_DEBUG.stageDVertexCount = result.geometryNoHoles?.getAttribute("position")?.count ?? 0
    SOLID_DEBUG.stageEVertexCount = result.geometry?.getAttribute("position")?.count ?? 0
    
    // TARGETED DEBUG: Stage D vs E comparison
    if (SOLID_DEBUG.stageDVertexCount > 0 && SOLID_DEBUG.stageEVertexCount > 0) {
      const vertexIncrease = SOLID_DEBUG.stageEVertexCount - SOLID_DEBUG.stageDVertexCount
      const percentIncrease = (vertexIncrease / SOLID_DEBUG.stageDVertexCount) * 100
      console.log("[v0-solid] Stage D→E Vertex Comparison:", {
        stageD: SOLID_DEBUG.stageDVertexCount,
        stageE: SOLID_DEBUG.stageEVertexCount,
        increase: vertexIncrease,
        increasePercent: percentIncrease.toFixed(1),
        diagnosis: vertexIncrease > SOLID_DEBUG.stageDVertexCount * 0.5 ? "HOLE_TRIANGULATION_EXPLOSION" : "normal"
      })
    }
    
    // Store stages for 2D visualization
    SOLID_DEBUG.lastStages = result.stages

    // Build solidStatus for debug overlay
    const solidStatus = buildSolidStatusFromMaskResult(result, solidParams.thickness, solidParams.depth)

    // If geometry is null, return empty (no mesh to render)
    if (!result.geometry) {
      SOLID_DEBUG.bucket = "C"
      SOLID_DEBUG.failureReason = "geometry null"
      return []
    }
    
    SOLID_DEBUG.buildMaskSolidSuccess = true
    SOLID_DEBUG.geometryReturned = true
    SOLID_DEBUG.vertexCount = result.geometry.getAttribute("position")?.count ?? 0

    // STAGE ISOLATION: Handle stage-specific rendering
    if (SOLID_STAGE_DEBUG.enabled) {
      if (SOLID_STAGE_DEBUG.stage === "D" && result.geometryNoHoles) {
        // Stage D: Render outer only, no holes
        SOLID_DEBUG.bucket = "E"
        SOLID_DEBUG.failureReason = "stage-D-active"
        return [{
          tubeGeometry: result.geometryNoHoles,
          filteredCount: strokes.reduce((sum, s) => sum + s.points.length, 0),
          key: `solid-D-${strokes.length}-${solidParams.thickness}-${solidParams.depth}`,
          mode: "solid",
          solidStatus,
        }]
      } else if (SOLID_STAGE_DEBUG.stage !== "E" && SOLID_STAGE_DEBUG.stage !== "D") {
        // Stages A/B/C: Skip 3D rendering, show 2D overlay only
        SOLID_DEBUG.bucket = "E"
        SOLID_DEBUG.failureReason = "stage-2D-only"
        return []
      }
    }

    // Stage E (default): Return full geometry with holes
    SOLID_DEBUG.bucket = "E"
    SOLID_DEBUG.failureReason = "success"
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

    // PROOF LOG: Confirm we're using the sandbox pipeline
    console.log("USING_SANDBOX_SOLID_PIPELINE")

    const inkMaterial = new THREE.MeshStandardMaterial({ color: "#1a1a1a", name: "Ink" })
    const disposables: THREE.BufferGeometry[] = []

    // Convert strokes to sandbox format (canvas pixels -> world coords) and call sandbox pipeline
    const testStroke = strokesToTestStroke(strokes, canvasWidth, canvasHeight)
    // Convert thickness from canvas pixels to world units
    const coordScale = 3.0 / Math.max(canvasWidth, canvasHeight)
    const worldThickness = solidParams.thickness * coordScale
    const result = buildMaskSolid(testStroke, worldThickness, solidParams.depth, canvasWidth, canvasHeight)
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
