/**
 * MASK-FIRST Solid Mode Pipeline - CLEAN RESET
 * 
 * Single deterministic pipeline:
 * 1. Render stroke to offscreen Canvas2D
 * 2. Create binary mask
 * 3. Label connected components, find largest
 * 4. Extract boundary edges and chain into ordered loop
 * 5. Validate contour (hard gate - no bypass)
 * 6. Build FLAT ShapeGeometry only (no extrusion for this checkpoint)
 */

import * as THREE from "three"

// ============= Types =============

export interface Point2D {
  x: number
  y: number
}

export interface TestStroke {
  points: Point2D[]
  color?: string
}

export interface MaskSolidResult {
  geometry: THREE.BufferGeometry | null
  geometryNoHoles: THREE.BufferGeometry | null
  stats: MaskSolidStats
  stages: MaskSolidStages
  diagnostics: MaskSolidDiagnostics
}

/**
 * Animation-only hole stabilization override.
 *
 * When the Solid mode is reveal-animating, each partial-stroke frame
 * re-runs H1/H2 hole detection on its OWN mask, which produces unstable
 * hole counts and slightly-different hole contours frame-to-frame as
 * loops approach closure. The result is visible counter pop / shape
 * switching during playback.
 *
 * This struct lets the caller (Scene) supply a STABLE set of final-pass
 * hole world-contours and a per-frame "active" decision (with hysteresis
 * applied at the caller level). When provided to `buildMaskSolid`:
 *
 *   - H1/H2 detection STILL runs (so the diagnostics panel can prove
 *     activation logic is working and so the partial centroids stay
 *     available for the caller's next-frame activation decision).
 *   - The detected partial-frame hole contours are DISCARDED for
 *     geometry purposes.
 *   - The cap triangulation, H2 shape holes, and H3 inner walls are
 *     built from `activeFinalHolesWorld` instead — after a topological
 *     safety filter (centroid must lie strictly inside the current
 *     partial outer silhouette `shapePts`).
 *
 * Static (non-animated) callers MUST NOT pass this; behavior is exactly
 * the same as before for the static pipeline.
 */
export interface SolidHoleStabilization {
  mode: "ANIMATION_GATED"
  /**
   * Final-pass hole world-space contours, already sorted by descending
   * |area| and forced to CW winding (the same conventions buildMaskSolid
   * uses internally for partial-frame holes).
   */
  activeFinalHolesWorld: THREE.Vector2[][]
}

export interface MaskSolidDiagnostics {
  // Core geometry info
  geometryMode: "FLAT_BASE" | "EXTRUDE_FROM_FLAT_BASE" | "FLAT_CAP_WITH_HOLES" | "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES"
  geometryType:
    | "FLAT"
    | "EXTRUDE_FROM_FLAT_BASE"
    | "FLAT_CAP_WITH_HOLES"
    | "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES"
    | "NULL"
  outerSignedArea: number
  outerWinding: "CCW" | "CW"
  // Raster stage fields - MUST be visible in debug panel
  rasterStageExecuted: "YES" | "NO"
  rasterInputSpace: string
  rasterCanvasWidth: number
  rasterCanvasHeight: number
  rasterMaskWidth: number
  rasterMaskHeight: number
  rasterThicknessPx: number
  rasterStrokeBoundsX: string
  rasterStrokeBoundsY: string
  rasterRejected: "YES" | "NO"
  rasterRejectReason: string
  // Validation gate fields - MUST be visible in debug panel
  gateExecuted: "YES" | "NO"
  contourClosed: "YES" | "NO"
  contourOrdered: "YES" | "NO"
  outerAreaAbs: number
  filledPixels: number
  areaToFillRatio: number
  contourRejected: "YES" | "NO"
  contourRejectReason: string
  // H1 hole detection fields (DIAGNOSTIC ONLY - geometry unchanged)
  holeDetectionEnabled: "YES" | "NO"
  detectedHoleCount: number
  validHoleCount: number
  rejectedHoleCount: number
  largestHoleArea: number
  holeAreas: number[]
  holeRejectReasons: string[]
  // Extra H1 diagnostics for debugging "missing" holes
  borderTouchingEmptyCount: number
  rejectedHoleAreas: number[]
  // H2 flat cap with holes (only populated when mode = FLAT_CAP_WITH_HOLES)
  h2FlatCapWithHolesBuilt: "YES" | "NO"
  h2HoleContoursUsed: number
  h2HoleContourAreas: number[]            // mask-space pixel area of each used hole contour
  h2HoleContourRejectReasons: string[]    // reasons valid holes failed contour conversion
  h2ShapeHoleCount: number                // shape.holes.length AFTER assembly
  h2FrontCapTris: number                  // direct triangulateShape triangles (caps with holes)
  h2FlatCapTrisBaseline: number           // tris of the same outer with NO holes (FLAT_BASE)
  h2TriDelta: number                      // h2FrontCapTris - h2FlatCapTrisBaseline (>0 means holes changed geometry)
  // Small-counter viability: examines the SMALLEST valid H1 hole.
  // Reveals whether a tight cursive counter survives all the way through H2.
  smallestValidHoleArea: number                  // 0 if no valid holes
  smallestValidHoleBboxW: number                 // mask-space bbox width
  smallestValidHoleBboxH: number                 // mask-space bbox height
  smallestValidHoleAreaToBboxRatio: number       // 0 if no valid holes
  smallestValidHoleUsedByH2: "YES" | "NO" | "N/A"  // N/A when no valid holes
  // Counter-preserving detection (H2 only)
  counterDetectionEnabled: "YES" | "NO"
  actualThicknessPx: number                       // mask-space stroke thickness used for outer body
  counterDetectionThicknessPx: number             // thinner thickness used for hole detection (0 if disabled)
  counterDetectedHoleCount: number                // total interior empties from counter mask (pre-filter)
  counterValidHoleCount: number                   // valid interior holes from counter mask
  counterHoleAreas: number[]                      // areas of valid holes from counter mask
  counterHoleSource: "ACTUAL_MASK" | "COUNTER_MASK"  // which mask actually fed H2
  // H3 extruded cap with holes + inner side walls (only populated when mode = EXTRUDE_FROM_FLAT_CAP_WITH_HOLES)
  h3Built?: "YES" | "NO"                          // YES once the extruded H3 geometry is assembled
  h3HoleContoursUsed?: number                     // hole contours actually fed into ShapeUtils.triangulateShape
  h3ShapeHoleCount?: number                       // shape.holes.length AFTER assembly (== holes used)
  h3InnerWallCount?: number                       // distinct inner hole loops that contributed walls
  h3InnerWallSegments?: number                    // total inner wall quads across all hole loops
  h3OuterWallSegments?: number                    // outer wall quads (after epsilon-skip)
  h3FrontCapTris?: number                         // triangles on the +Z cap
  h3BackCapTris?: number                          // triangles on the -Z cap
  h3SkippedOuterWallSegments?: number             // outer segments rejected by epsilon
  h3SkippedInnerWallSegments?: number             // inner segments rejected by epsilon
  h3TotalVerts?: number
  h3TotalTris?: number
  solidDepthParam?: number                        // live solidParams.depth flowed into geometry
  solidDepthEffective?: number                    // value used after floor clamp
  geometryBBoxZ?: number                          // measured Z extent of returned geometry
  exportUsesSamePath?: "YES" | "NO"               // true: SolidEngine.buildExport flows through same buildMaskSolid call
  // ---- Solid H3 control calibration (stamped by SolidEngine after buildMaskSolid returns) ----
  solidThicknessSliderValue?: number              // raw px value the user picked on the slider
  solidEffectiveThicknessPx?: number              // calibrated px actually fed to lineWidth + H3 walls
  solidDepthSliderValue?: number                  // raw depth value the user picked on the slider
  solidDepthToThicknessRatio?: number             // effectiveDepth / worldThickness — for proportion QA
  // ---- Solid H3 animation hole stabilization (animation-only) ----
  detectedPartialHoleCentroidsWorld?: Array<{ x: number; y: number; areaPx: number }>
  stableHolesWorld?: Array<Array<{ x: number; y: number }>>
  holeStabilizationActive?: "YES" | "NO"
  holeOverrideKeptCount?: number
  holeOverrideRejectedCount?: number
  holeOverrideRejectReasons?: string[]
  // ---- Animation hole strategy ----
  /** "YES" only if a caller forced the legacy `disableHolesForAnimation`
   *  flag for this frame. Scene never does this in the current strategy. */
  holesDisabledForAnimation?: "YES" | "NO"
  /** Echoes the active animation hole strategy name. */
  solidAnimationHoleMode?: "STICKY_FINAL_HOLE_CONTOURS"
}

export interface MaskSolidStats {
  maskResolution: number
  filledPixelCount: number
  componentCount: number
  largestComponentPixels: number
  outerContourPoints: number
  simplifiedOuterPoints: number
  holeCount: number
  rebuildTimeMs: number
}

export interface MaskSolidStages {
  centerline: Point2D[]
  maskData: boolean[]
  maskWidth: number
  maskHeight: number
  outerContour: Point2D[]
  simplifiedOuter: Point2D[]
  holes: Point2D[][]
  simplifiedHoles: Point2D[][]
  rawOuter?: Point2D[]
  // Raster debug info for panel display
  rasterDebug?: {
    rasterStageExecuted: "YES" | "NO"
    rasterInputSpace: string
    rasterCanvasWidth: number
    rasterCanvasHeight: number
    rasterMaskWidth: number
    rasterMaskHeight: number
    rasterThicknessPx: number
    rasterStrokeBoundsX: string
    rasterStrokeBoundsY: string
    filledPixels: number
    rasterRejected: "YES" | "NO"
    rasterRejectReason: string
  }
  // Solid mode diagnostic info for panel display
  solidDiagnostics?: {
    geometryMode: "FLAT_BASE" | "EXTRUDE_FROM_FLAT_BASE" | "FLAT_CAP_WITH_HOLES" | "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES"
    geometryType:
      | "FLAT"
      | "EXTRUDE_FROM_FLAT_BASE"
      | "FLAT_CAP_WITH_HOLES"
      | "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES"
      | "NULL"
    gateExecuted: "YES" | "NO"
    contourClosed: "YES" | "NO"
    contourOrdered: "YES" | "NO"
    outerAreaAbs: number
    filledPixels: number
    areaToFillRatio: number
    contourRejected: "YES" | "NO"
    contourRejectReason: string
    // Extrusion builder debug fields
    extrusionBuilder?: string
    wallSegmentCount?: number
    skippedWallSegments?: number
    frontCapTriCount?: number
    backCapTriCount?: number
    // H1 hole detection fields (DIAGNOSTIC ONLY - geometry unchanged)
    holeDetectionEnabled?: "YES" | "NO"
    detectedHoleCount?: number
    validHoleCount?: number
    rejectedHoleCount?: number
    largestHoleArea?: number
    holeAreas?: number[]
    holeRejectReasons?: string[]
    borderTouchingEmptyCount?: number
    rejectedHoleAreas?: number[]
    // H2 flat cap with holes (only populated when mode = FLAT_CAP_WITH_HOLES)
    h2FlatCapWithHolesBuilt?: "YES" | "NO"
    h2HoleContoursUsed?: number
    h2HoleContourAreas?: number[]
    h2HoleContourRejectReasons?: string[]
    h2ShapeHoleCount?: number
    h2FrontCapTris?: number
    h2FlatCapTrisBaseline?: number
    h2TriDelta?: number
    smallestValidHoleArea?: number
    smallestValidHoleBboxW?: number
    smallestValidHoleBboxH?: number
    smallestValidHoleAreaToBboxRatio?: number
    smallestValidHoleUsedByH2?: "YES" | "NO" | "N/A"
    counterDetectionEnabled?: "YES" | "NO"
    actualThicknessPx?: number
    counterDetectionThicknessPx?: number
    counterDetectedHoleCount?: number
    counterValidHoleCount?: number
    counterHoleAreas?: number[]
    counterHoleSource?: "ACTUAL_MASK" | "COUNTER_MASK"
    // H3 extruded cap-with-holes + inner walls
    h3Built?: "YES" | "NO"
    h3HoleContoursUsed?: number
    h3ShapeHoleCount?: number
    h3InnerWallCount?: number
    h3InnerWallSegments?: number
    h3OuterWallSegments?: number
    h3FrontCapTris?: number
    h3BackCapTris?: number
    h3SkippedOuterWallSegments?: number
    h3SkippedInnerWallSegments?: number
    h3TotalVerts?: number
    h3TotalTris?: number
    solidDepthParam?: number
    solidDepthEffective?: number
    geometryBBoxZ?: number
    exportUsesSamePath?: "YES" | "NO"
    // Solid H3 control calibration — stamped by SolidEngine after the engine returns
    solidThicknessSliderValue?: number
    solidEffectiveThicknessPx?: number
    solidDepthSliderValue?: number
    solidDepthToThicknessRatio?: number
    // Solid H3 animation hole stabilization (animation-only)
    detectedPartialHoleCentroidsWorld?: Array<{ x: number; y: number; areaPx: number }>
    stableHolesWorld?: Array<Array<{ x: number; y: number }>>
    holeStabilizationActive?: "YES" | "NO"
    holeOverrideKeptCount?: number
    holeOverrideRejectedCount?: number
    holeOverrideRejectReasons?: string[]
    // Sticky-final-hole-contour strategy (current)
    holesDisabledForAnimation?: "YES" | "NO"
    solidAnimationHoleMode?: "STICKY_FINAL_HOLE_CONTOURS"
  }
}

// ============= Constants =============

const MASK_RESOLUTION = 512

// Animated builds (holeStabilization override or disableHolesForAnimation)
// run per rAF tick — console logging there costs real frame budget and
// floods the console. Static/export builds keep full logging.
let QUIET = false

// ============= Contour simplification + anti-stairstep smoothing =============
//
// The boundary tracer emits one vertex per lattice edge, so a 512-res mask
// contour arrives as thousands of unit-length axis-aligned segments: a pixel
// staircase. That staircase used to feed DIRECTLY into validation
// (O(n^2) self-intersection over ~thousands of points — the single biggest
// per-frame cost during draw-in), into earcut, and into the H3 wall builder
// (one wall quad per unit lattice edge — export bloat), and it is the visible
// stair-step aliasing on the extruded silhouette.
//
// Pipeline per loop (outer + each hole):
//   1. simplifyCollinearMask  — EXACT: drops interior points of straight runs.
//      The polygon is geometrically unchanged.
//   2. smoothLatticeLoop      — 3 Chaikin corner-cut passes (max deviation
//      from the lattice loop <= ~0.44 px) + Douglas-Peucker decimation at
//      0.45 px. Total deviation stays under ~0.9 px, i.e. inside the >=1 px
//      filled wall that always separates a hole boundary from the outer
//      boundary in the mask — smoothing can never fuse a hole into the outer
//      or punch a new one.
//   3. Guards: smoothed loop must keep >=90% (and <=105%) of the exact loop's
//      area and must not self-intersect; otherwise fall back to the exact
//      simplified loop. Topology (hole presence/absence) is mask-derived and
//      untouched either way.

/** EXACT collinear-run removal for integer lattice loops (mask space). */
function simplifyCollinearMask(pts: Point2D[]): Point2D[] {
  const n = pts.length
  if (n < 5) return pts
  const out: Point2D[] = []
  for (let i = 0; i < n; i++) {
    const p1 = pts[(i - 1 + n) % n]
    const p2 = pts[i]
    const p3 = pts[(i + 1) % n]
    const cross = (p2.x - p1.x) * (p3.y - p2.y) - (p2.y - p1.y) * (p3.x - p2.x)
    if (cross !== 0) out.push(p2)
  }
  return out.length >= 4 ? out : pts
}

/** One Chaikin corner-cutting pass on a CLOSED loop. */
function chaikinClosed(pts: Point2D[]): Point2D[] {
  const n = pts.length
  if (n < 3) return pts
  const out: Point2D[] = new Array(n * 2)
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    out[i * 2] = { x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 }
    out[i * 2 + 1] = { x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 }
  }
  return out
}

/** Douglas-Peucker on an OPEN polyline segment (indices lo..hi inclusive). */
function dpMark(pts: Point2D[], lo: number, hi: number, tol2: number, keep: Uint8Array): void {
  if (hi <= lo + 1) return
  const a = pts[lo]
  const b = pts[hi]
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  let maxD = -1
  let maxI = -1
  for (let i = lo + 1; i < hi; i++) {
    const p = pts[i]
    let d: number
    if (lenSq < 1e-12) {
      const ex = p.x - a.x, ey = p.y - a.y
      d = ex * ex + ey * ey
    } else {
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
      const ex = p.x - (a.x + t * dx)
      const ey = p.y - (a.y + t * dy)
      d = ex * ex + ey * ey
    }
    if (d > maxD) {
      maxD = d
      maxI = i
    }
  }
  if (maxD > tol2) {
    keep[maxI] = 1
    dpMark(pts, lo, maxI, tol2, keep)
    dpMark(pts, maxI, hi, tol2, keep)
  }
}

/** Douglas-Peucker decimation of a CLOSED loop (anchors at the two most distant vertices). */
function dpSimplifyClosed(pts: Point2D[], tol: number): Point2D[] {
  const n = pts.length
  if (n < 8) return pts
  // Anchor 0 and the vertex farthest from it — stable split for closed loops.
  let far = 1
  let farD = -1
  const p0 = pts[0]
  for (let i = 1; i < n; i++) {
    const dx = pts[i].x - p0.x
    const dy = pts[i].y - p0.y
    const d = dx * dx + dy * dy
    if (d > farD) {
      farD = d
      far = i
    }
  }
  const keep = new Uint8Array(n)
  keep[0] = 1
  keep[far] = 1
  const tol2 = tol * tol
  dpMark(pts, 0, far, tol2, keep)
  // Second half wraps: unroll it into a temp open polyline.
  const tail: Point2D[] = []
  const tailIdx: number[] = []
  for (let i = far; i < n; i++) {
    tail.push(pts[i])
    tailIdx.push(i)
  }
  tail.push(pts[0])
  tailIdx.push(0)
  const keepTail = new Uint8Array(tail.length)
  keepTail[0] = 1
  keepTail[tail.length - 1] = 1
  dpMark(tail, 0, tail.length - 1, tol2, keepTail)
  for (let i = 1; i < tail.length - 1; i++) {
    if (keepTail[i]) keep[tailIdx[i]] = 1
  }
  const out: Point2D[] = []
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i])
  return out.length >= 4 ? out : pts
}

function shoelaceAbs(pts: Point2D[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i]
    const p2 = pts[(i + 1) % pts.length]
    s += p1.x * p2.y - p2.x * p1.y
  }
  return Math.abs(s) / 2
}

/**
 * Smooth a lattice boundary loop (mask space): 3 Chaikin passes + DP 0.45 px.
 * Falls back to the exact input loop if the result loses area fidelity or
 * self-intersects. Input should already be collinear-simplified.
 */
function smoothLatticeLoop(exactLoop: Point2D[]): Point2D[] {
  if (exactLoop.length < 8) return exactLoop
  const exactArea = shoelaceAbs(exactLoop)
  if (exactArea < 4) return exactLoop
  let smooth = chaikinClosed(chaikinClosed(chaikinClosed(exactLoop)))
  smooth = dpSimplifyClosed(smooth, 0.45)
  if (smooth.length < 4) return exactLoop
  const smoothArea = shoelaceAbs(smooth)
  if (smoothArea < exactArea * 0.9 || smoothArea > exactArea * 1.05) return exactLoop
  if (contourSelfIntersects(smooth)) return exactLoop
  return smooth
}

// ============= H2 COUNTER-PRESERVING DETECTION =============
// When the actual stroke is thick (medium-weight Solid lettering), small
// closed counters (e.g. the lower loop of a cursive 'b' or 'e') get fully
// painted in by the round-cap raster body and never appear as interior
// empty regions in the actual mask. This makes them invisible to H1.
//
// Strategy: render a SECOND mask using a thinner "counter-detection"
// thickness, run H1 on it, and use ITS holes for H2 if it produces more
// valid holes than the actual mask. The outer silhouette / cap still
// uses the actual-thickness mask — only the inner hole CONTOURS are
// borrowed from the thinner mask.
//
// Topological safety: a thinner stroke renders a STRICTLY-CONTAINED
// filled body (line-disks at radius r/2 ⊆ disks at radius r). Any
// interior hole detected on the thinner body therefore lies inside the
// thinner body, which lies inside the actual body — so cutting that
// hole from the actual cap can never punch outside the actual outer
// silhouette. We additionally point-in-polygon-test each candidate
// hole's centroid against the actual outer contour as a defense-in-
// depth check (handles degenerate cases like broken-into-pieces thin
// strokes where the thinner "largest component" might not match the
// actual largest component).
//
// Open / near-touch shapes: thinning a stroke can only WIDEN gaps, not
// close them. So any open or near-touch shape that has no interior
// hole on the actual mask also has no interior hole on the thinner
// mask. False-positive holes are not introduced.
const COUNTER_DETECTION_THICKNESS_SCALE = 0.5
const COUNTER_DETECTION_MIN_PX = 6   // mask pixels
const COUNTER_DETECTION_MAX_PX = 16  // mask pixels
// Skip counter pass if actual is already thin enough that a halved
// version wouldn't be meaningfully smaller (saves a full re-raster).
const COUNTER_DETECTION_MIN_GAP_PX = 1.5

// ============= GEOMETRY MODE SWITCH =============
// FLAT_BASE                       = original validated checkpoint (valid contour -> FLAT, invalid -> NULL)
// EXTRUDE_FROM_FLAT_BASE          = validated flat base, then extruded (no holes; LOCKED reference)
// FLAT_CAP_WITH_HOLES             = H2 diagnostic: flat cap with valid H1 holes traced as inner Paths
// EXTRUDE_FROM_FLAT_CAP_WITH_HOLES = H3: full extrusion of the H2 cap-with-holes triangulation;
//                                   adds a mirrored back cap, manual outer side walls, AND manual
//                                   inner side walls for every hole. Solid Depth slider drives the
//                                   actual Z extent. Default mode. Reuses H2's hole-detection
//                                   pipeline (including counter-preserving detection) for parity.
const SOLID_GEOMETRY_MODE:
  | "FLAT_BASE"
  | "EXTRUDE_FROM_FLAT_BASE"
  | "FLAT_CAP_WITH_HOLES"
  | "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES" = "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES"

// Legacy hardcoded depth — used ONLY by the EXTRUDE_FROM_FLAT_BASE reference branch,
// which must not regress. H3 uses the live `depth` parameter (see buildMaskSolid signature).
const EXTRUDE_DEPTH = 0.15
// Absolute minimum H3 effective depth in world units. Prevents zero/negative
// depth from collapsing the mesh while keeping the slider's bottom end usable.
const H3_DEPTH_FLOOR = 0.005

// ============= Main Entry Point =============

export function buildMaskSolid(
  stroke: TestStroke,
  thickness: number,
  depth: number,
  canvasWidth: number = 800,
  canvasHeight: number = 600,
  /**
   * OPTIONAL animation-only hole stabilization.
   *
   * When undefined (static path, export path, any non-animated caller),
   * the function behaves EXACTLY as before — no code path changes.
   *
   * When provided with mode="ANIMATION_GATED", the caller supplies the
   * already-computed final-pass hole world contours that should be used
   * for cap triangulation + H3 inner walls THIS FRAME. The partial-mask
   * H1/H2 detection still runs so that diagnostics + activation matching
   * remain available, but its detected hole contours are NOT used for
   * geometry — they are replaced by the caller's `activeFinalHolesWorld`
   * after a topological safety filter (each override hole's centroid
   * must lie strictly inside the current partial outer silhouette).
   *
   * Static H1/H2 thresholds, static H3 geometry, and Solid export are
   * NOT affected.
   */
  holeStabilization?: SolidHoleStabilization,
  /**
   * OPTIONAL animation-only no-holes mode.
   *
   * When true (Solid animation reveal-in-progress callers ONLY), the
   * H2 cap-with-holes triangulation is skipped wholesale. The H3 assembly
   * then takes the existing "no valid holes" fall-through path, producing
   * the no-holes outer-silhouette extrusion using the live `depth` param.
   * H1 detection still runs (cheap, useful for the debug panel), but its
   * results are NEVER fed to geometry while this flag is on.
   *
   * Effect:
   *   - shape.holes never gets a Path attached
   *   - H3 inner walls are not built
   *   - `holeStabilization` override (if also passed) is ignored
   *   - geometry is a stable filled silhouette extrusion with live depth
   *
   * Static path, export path, and the static H1/H2/H3 production geometry
   * are completely unaffected — they call this function without this flag.
   */
  disableHolesForAnimation?: boolean
): MaskSolidResult {
  const startTime = performance.now()

  // Animated builds run per rAF tick — silence hot-path logging for them.
  // Static + export builds (no override, holes enabled) keep full logging.
  QUIET = holeStabilization !== undefined || disableHolesForAnimation === true

  if (!QUIET) console.log("[v0-solid] FLAT_OR_NULL pipeline executing")
  
  // Initialize empty structures
  const emptyStages: MaskSolidStages = {
    centerline: stroke.points,
    maskData: [],
    maskWidth: 0,
    maskHeight: 0,
    outerContour: [],
    simplifiedOuter: [],
    holes: [],
    simplifiedHoles: []
  }
  
  const emptyStats: MaskSolidStats = {
    maskResolution: MASK_RESOLUTION,
    filledPixelCount: 0,
    componentCount: 0,
    largestComponentPixels: 0,
    outerContourPoints: 0,
    simplifiedOuterPoints: 0,
    holeCount: 0,
    rebuildTimeMs: 0
  }
  
  const nullDiagnostics: MaskSolidDiagnostics = {
    geometryMode: SOLID_GEOMETRY_MODE,
    geometryType: "NULL",
    outerSignedArea: 0,
    outerWinding: "CCW",
    // Raster fields
    rasterStageExecuted: "NO",
    rasterInputSpace: "UNKNOWN",
    rasterCanvasWidth: canvasWidth,
    rasterCanvasHeight: canvasHeight,
    rasterMaskWidth: 0,
    rasterMaskHeight: 0,
    rasterThicknessPx: 0,
    rasterStrokeBoundsX: "",
    rasterStrokeBoundsY: "",
    rasterRejected: "NO",
    rasterRejectReason: "",
    // Validation fields
    gateExecuted: "NO",
    contourClosed: "NO",
    contourOrdered: "NO",
    outerAreaAbs: 0,
    filledPixels: 0,
    areaToFillRatio: 0,
    contourRejected: "YES",
    contourRejectReason: "not yet executed",
    // H1 hole detection - default disabled until componentMask is built
    holeDetectionEnabled: "NO",
    detectedHoleCount: 0,
    validHoleCount: 0,
    rejectedHoleCount: 0,
    largestHoleArea: 0,
    holeAreas: [],
    holeRejectReasons: [],
    borderTouchingEmptyCount: 0,
    rejectedHoleAreas: [],
    // H2 flat cap with holes - defaults
    h2FlatCapWithHolesBuilt: "NO",
    h2HoleContoursUsed: 0,
    h2HoleContourAreas: [],
    h2HoleContourRejectReasons: [],
    h2ShapeHoleCount: 0,
    h2FrontCapTris: 0,
    h2FlatCapTrisBaseline: 0,
    h2TriDelta: 0,
    // Small-counter viability defaults
    smallestValidHoleArea: 0,
    smallestValidHoleBboxW: 0,
    smallestValidHoleBboxH: 0,
    smallestValidHoleAreaToBboxRatio: 0,
    smallestValidHoleUsedByH2: "N/A",
    // Counter-preserving detection defaults
    counterDetectionEnabled: "NO",
    actualThicknessPx: 0,
    counterDetectionThicknessPx: 0,
    counterDetectedHoleCount: 0,
    counterValidHoleCount: 0,
    counterHoleAreas: [],
    counterHoleSource: "ACTUAL_MASK"
  }
  
  // Early exit for empty stroke
  if (stroke.points.length < 2) {
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: { ...emptyStats, rebuildTimeMs: performance.now() - startTime },
      stages: emptyStages,
      diagnostics: { ...nullDiagnostics, contourRejectReason: "stroke has <2 points" }
    }
  }
  
  // ========== STAGE 1: Render stroke to mask ==========
  // Animated builds (QUIET) run per rAF tick — use a reduced mask resolution
  // during playback only. Geometry is resolution-independent (mask -> world
  // transforms derive from width/height) and the contour smoothing hides the
  // coarser lattice; the final committed frame and every static/export build
  // stay at full MASK_RESOLUTION. Hole-detection pixel thresholds are scaled
  // by resScale below so topology decisions match the static behavior.
  const buildRes = QUIET ? 384 : MASK_RESOLUTION
  const resScale = buildRes / MASK_RESOLUTION
  const { mask, width, height, filledCount, rasterDebug } = renderStrokeToMask(stroke.points, thickness, canvasWidth, canvasHeight, buildRes)
  
  emptyStages.maskData = mask
  emptyStages.maskWidth = width
  emptyStages.maskHeight = height
  emptyStages.rasterDebug = rasterDebug  // Store for panel access
  
  // HARD FAIL: If no filled pixels, stop immediately
  if (filledCount === 0) {
    emptyStages.solidDiagnostics = {
      geometryMode: SOLID_GEOMETRY_MODE,
      geometryType: "NULL",
      gateExecuted: "NO",
      contourClosed: "NO",
      contourOrdered: "NO",
      outerAreaAbs: 0,
      filledPixels: 0,
      areaToFillRatio: 0,
      contourRejected: "YES",
      contourRejectReason: "raster stage failed",
      // H1 hole detection - not run (no filled pixels yet)
      holeDetectionEnabled: "NO",
      detectedHoleCount: 0,
      validHoleCount: 0,
      rejectedHoleCount: 0,
      largestHoleArea: 0,
      holeAreas: [],
      holeRejectReasons: [],
      borderTouchingEmptyCount: 0,
      rejectedHoleAreas: [],
      // H2 - not run
      h2FlatCapWithHolesBuilt: "NO",
      h2HoleContoursUsed: 0,
      h2HoleContourAreas: [],
      h2HoleContourRejectReasons: [],
      h2ShapeHoleCount: 0,
      h2FrontCapTris: 0,
      h2FlatCapTrisBaseline: 0,
      h2TriDelta: 0,
      // Small-counter viability - not measured
      smallestValidHoleArea: 0,
      smallestValidHoleBboxW: 0,
      smallestValidHoleBboxH: 0,
      smallestValidHoleAreaToBboxRatio: 0,
      smallestValidHoleUsedByH2: "N/A",
      // Counter-preserving detection - not run
      counterDetectionEnabled: "NO",
      actualThicknessPx: 0,
      counterDetectionThicknessPx: 0,
      counterDetectedHoleCount: 0,
      counterValidHoleCount: 0,
      counterHoleAreas: [],
      counterHoleSource: "ACTUAL_MASK",
    }
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: { ...emptyStats, rebuildTimeMs: performance.now() - startTime },
      stages: emptyStages,
      diagnostics: {
        ...nullDiagnostics,
        // Raster debug fields
        rasterStageExecuted: rasterDebug.rasterStageExecuted,
        rasterInputSpace: rasterDebug.rasterInputSpace,
        rasterCanvasWidth: rasterDebug.rasterCanvasWidth,
        rasterCanvasHeight: rasterDebug.rasterCanvasHeight,
        rasterMaskWidth: rasterDebug.rasterMaskWidth,
        rasterMaskHeight: rasterDebug.rasterMaskHeight,
        rasterThicknessPx: rasterDebug.rasterThicknessPx,
        rasterStrokeBoundsX: rasterDebug.rasterStrokeBoundsX,
        rasterStrokeBoundsY: rasterDebug.rasterStrokeBoundsY,
        rasterRejected: "YES",
        rasterRejectReason: rasterDebug.rasterRejectReason || "no filled pixels",
        filledPixels: 0,
        contourRejectReason: "raster stage failed"
      }
    }
  }
  
  // ========== STAGE 2: Label connected components ==========
  const { labels, componentCount, componentSizes } = labelConnectedComponents(mask, width, height)
  
  if (componentCount === 0) {
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: { ...emptyStats, filledPixelCount: filledCount, rebuildTimeMs: performance.now() - startTime },
      stages: emptyStages,
      diagnostics: { ...nullDiagnostics, filledPixels: filledCount, contourRejectReason: "no components" }
    }
  }
  
  // Find largest component
  let largestLabel = 1
  let largestSize = 0
  for (let i = 1; i <= componentCount; i++) {
    if (componentSizes[i] > largestSize) {
      largestSize = componentSizes[i]
      largestLabel = i
    }
  }
  
  // Create binary mask for largest component only
  const componentMask = new Array(width * height).fill(false)
  for (let i = 0; i < mask.length; i++) {
    componentMask[i] = labels[i] === largestLabel
  }
  
  // ========== H1 HOLE DETECTION (DIAGNOSTIC ONLY) ==========
  // Detects interior empty regions fully enclosed by the selected filled
  // component. THIS DOES NOT MODIFY GEOMETRY OUTPUT. Results are reported
  // through solidDiagnostics only. THREE.Shape, caps, walls, and the entire
  // extrusion path are unchanged regardless of detection results.
  const holeDetection = detectInteriorHoles(componentMask, width, height, resScale)
  if (!QUIET) console.log("[v0-solid] H1 HOLE DETECTION:", {
    detected: holeDetection.detectedHoleCount,
    valid: holeDetection.validHoleCount,
    rejected: holeDetection.rejectedHoleCount,
    largestArea: holeDetection.largestHoleArea,
    areas: holeDetection.holeAreas,
    rejectReasons: holeDetection.holeRejectReasons,
  })
  
  // ========== STAGE 3: Extract boundary edges and chain into ordered loop ==========
  const outerContour = traceOuterContour(componentMask, width, height)
  emptyStages.outerContour = outerContour
  emptyStages.rawOuter = outerContour

  // EXACT collinear simplification (polygon geometrically unchanged).
  // All O(n^2) work below (self-intersection gate) and all geometry
  // (earcut, walls) runs on this instead of the raw per-lattice-edge chain.
  const outerExact = simplifyCollinearMask(outerContour)
  
  // Compute signed area in mask space
  let outerSignedArea = 0
  for (let i = 0; i < outerContour.length; i++) {
    const p1 = outerContour[i]
    const p2 = outerContour[(i + 1) % outerContour.length]
    outerSignedArea += p1.x * p2.y - p2.x * p1.y
  }
  outerSignedArea /= 2
  
  const outerAreaAbs = Math.abs(outerSignedArea)
  
  // ========== STAGE 4: HARD VALIDATION GATE ==========
  // This gate CANNOT be bypassed. If contour is invalid, geometry is NULL.
  
  // Check 1: Closed loop (first point near last point)
  let contourClosed = false
  if (outerContour.length > 2) {
    const first = outerContour[0]
    const last = outerContour[outerContour.length - 1]
    const closeDist = Math.sqrt((last.x - first.x) ** 2 + (last.y - first.y) ** 2)
    contourClosed = closeDist < 2.0
  }
  
  // Check 2: Ordered loop (no self-intersection).
  // Runs on the EXACT collinear-simplified loop — the identical polygon with
  // ~10-30x fewer vertices, so the O(n^2) test drops ~100-900x in cost.
  const contourOrdered = !contourSelfIntersects(outerExact)
  
  // Check 3: Meaningful area
  const areaToFillRatio = largestSize > 0 ? outerAreaAbs / largestSize : 0
  
  // Determine rejection
  let contourRejected = false
  let contourRejectReason = ""
  
  if (outerContour.length < 3) {
    contourRejected = true
    contourRejectReason = "less than 3 points"
  } else if (!contourClosed) {
    contourRejected = true
    contourRejectReason = "loop not closed"
  } else if (!contourOrdered) {
    contourRejected = true
    contourRejectReason = "self-intersecting"
  } else if (outerAreaAbs < 10) {
    contourRejected = true
    contourRejectReason = `outerAreaAbs=${outerAreaAbs.toFixed(1)}<10`
  } else if (areaToFillRatio < 0.1) {
    contourRejected = true
    contourRejectReason = `areaToFillRatio=${areaToFillRatio.toFixed(4)}<0.1`
  }
  
  // Log gate execution
  if (!QUIET) console.log("[v0-solid] VALIDATION GATE:", {
    gateExecuted: "YES",
    outerContourPoints: outerContour.length,
    outerAreaAbs: outerAreaAbs.toFixed(2),
    filledPixels: largestSize,
    areaToFillRatio: areaToFillRatio.toFixed(4),
    contourClosed: contourClosed ? "YES" : "NO",
    contourOrdered: contourOrdered ? "YES" : "NO",
    contourRejected: contourRejected ? "YES" : "NO",
    contourRejectReason: contourRejectReason || "none"
  })
  
  // Build diagnostics (will be used for both success and failure)
  // geometryType depends on SOLID_GEOMETRY_MODE when contour is valid
  const successGeometryType:
    | "FLAT"
    | "EXTRUDE_FROM_FLAT_BASE"
    | "FLAT_CAP_WITH_HOLES"
    | "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES" =
    SOLID_GEOMETRY_MODE === "EXTRUDE_FROM_FLAT_BASE"
      ? "EXTRUDE_FROM_FLAT_BASE"
      : SOLID_GEOMETRY_MODE === "FLAT_CAP_WITH_HOLES"
        ? "FLAT_CAP_WITH_HOLES"
        : SOLID_GEOMETRY_MODE === "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES"
          ? "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES"
          : "FLAT"
  
  const diagnostics: MaskSolidDiagnostics = {
    geometryMode: SOLID_GEOMETRY_MODE,
    geometryType: contourRejected ? "NULL" : successGeometryType,
    outerSignedArea,
    outerWinding: outerSignedArea > 0 ? "CCW" : "CW",
    // Raster fields (from earlier stage)
    rasterStageExecuted: rasterDebug.rasterStageExecuted,
    rasterInputSpace: rasterDebug.rasterInputSpace,
    rasterCanvasWidth: rasterDebug.rasterCanvasWidth,
    rasterCanvasHeight: rasterDebug.rasterCanvasHeight,
    rasterMaskWidth: rasterDebug.rasterMaskWidth,
    rasterMaskHeight: rasterDebug.rasterMaskHeight,
    rasterThicknessPx: rasterDebug.rasterThicknessPx,
    rasterStrokeBoundsX: rasterDebug.rasterStrokeBoundsX,
    rasterStrokeBoundsY: rasterDebug.rasterStrokeBoundsY,
    rasterRejected: rasterDebug.rasterRejected,
    rasterRejectReason: rasterDebug.rasterRejectReason,
    // Validation fields
    gateExecuted: "YES",
    contourClosed: contourClosed ? "YES" : "NO",
    contourOrdered: contourOrdered ? "YES" : "NO",
    outerAreaAbs,
    filledPixels: largestSize,
    areaToFillRatio,
    contourRejected: contourRejected ? "YES" : "NO",
    contourRejectReason,
    // H1 hole detection (diagnostic only; geometry unchanged)
    holeDetectionEnabled: "YES",
    detectedHoleCount: holeDetection.detectedHoleCount,
    validHoleCount: holeDetection.validHoleCount,
    rejectedHoleCount: holeDetection.rejectedHoleCount,
    largestHoleArea: holeDetection.largestHoleArea,
    holeAreas: holeDetection.holeAreas,
    holeRejectReasons: holeDetection.holeRejectReasons,
    borderTouchingEmptyCount: holeDetection.borderTouchingEmptyCount,
    rejectedHoleAreas: holeDetection.rejectedHoleAreas,
    // H2 (default no — populated only if FLAT_CAP_WITH_HOLES branch runs)
    h2FlatCapWithHolesBuilt: "NO",
    h2HoleContoursUsed: 0,
    h2HoleContourAreas: [],
    h2HoleContourRejectReasons: [],
    h2ShapeHoleCount: 0,
    h2FrontCapTris: 0,
    h2FlatCapTrisBaseline: 0,
    h2TriDelta: 0,
    // Small-counter viability — H1 side here; H2 side overridden by branch
    ...computeSmallestValidHoleViability(holeDetection),
    // Counter-preserving detection — defaults; overridden by H2 branch if it runs
    counterDetectionEnabled: "NO",
    actualThicknessPx: rasterDebug.rasterThicknessPx ?? 0,
    counterDetectionThicknessPx: 0,
    counterDetectedHoleCount: 0,
    counterValidHoleCount: 0,
    counterHoleAreas: [],
    counterHoleSource: "ACTUAL_MASK",
  }
  
  // Mirror solid diagnostics into stages so the debug panel (which reads
  // SOLID_DEBUG.lastStages) can display them without touching geometry-engines.ts.
  emptyStages.solidDiagnostics = {
    geometryMode: diagnostics.geometryMode,
    geometryType: diagnostics.geometryType,
    gateExecuted: diagnostics.gateExecuted,
    contourClosed: diagnostics.contourClosed,
    contourOrdered: diagnostics.contourOrdered,
    outerAreaAbs: diagnostics.outerAreaAbs,
    filledPixels: diagnostics.filledPixels,
    areaToFillRatio: diagnostics.areaToFillRatio,
    contourRejected: diagnostics.contourRejected,
    contourRejectReason: diagnostics.contourRejectReason,
    // H1 hole detection (diagnostic only; geometry unchanged)
    holeDetectionEnabled: "YES",
    detectedHoleCount: holeDetection.detectedHoleCount,
    validHoleCount: holeDetection.validHoleCount,
    rejectedHoleCount: holeDetection.rejectedHoleCount,
    largestHoleArea: holeDetection.largestHoleArea,
    holeAreas: holeDetection.holeAreas,
    holeRejectReasons: holeDetection.holeRejectReasons,
    borderTouchingEmptyCount: holeDetection.borderTouchingEmptyCount,
    rejectedHoleAreas: holeDetection.rejectedHoleAreas,
    // H2 defaults — overridden later by FLAT_CAP_WITH_HOLES branch if it runs
    h2FlatCapWithHolesBuilt: "NO",
    h2HoleContoursUsed: 0,
    h2HoleContourAreas: [],
    h2HoleContourRejectReasons: [],
    h2ShapeHoleCount: 0,
    h2FrontCapTris: 0,
    h2FlatCapTrisBaseline: 0,
    h2TriDelta: 0,
    // Small-counter viability — H1 side here; H2 side overridden by branch
    ...computeSmallestValidHoleViability(holeDetection),
    // Counter-preserving detection — defaults; overridden by H2 branch if it runs
    counterDetectionEnabled: "NO",
    actualThicknessPx: rasterDebug.rasterThicknessPx ?? 0,
    counterDetectionThicknessPx: 0,
    counterDetectedHoleCount: 0,
    counterValidHoleCount: 0,
    counterHoleAreas: [],
    counterHoleSource: "ACTUAL_MASK",
  }
  
  // HARD FAIL: Return NULL geometry if validation fails
  if (contourRejected) {
    if (!QUIET) console.log("[v0-solid] REJECTED: Not building geometry")
    
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: {
        maskResolution: MASK_RESOLUTION,
        filledPixelCount: filledCount,
        componentCount,
        largestComponentPixels: largestSize,
        outerContourPoints: outerContour.length,
        simplifiedOuterPoints: 0,
        holeCount: 0,
        rebuildTimeMs: performance.now() - startTime
      },
      stages: emptyStages,
      diagnostics
    }
  }
  
  // ========== STAGE 5: Build FLAT geometry ==========
  // Transform contour to world coordinates
  const scaleX = canvasWidth / width
  const scaleY = canvasHeight / height
  const scale = Math.min(scaleX, scaleY)
  const normScale = 3 / Math.max(canvasWidth, canvasHeight)
  
  const toWorldX = (mx: number) => (mx - width / 2) * scale * normScale
  const toWorldY = (my: number) => -(my - height / 2) * scale * normScale

  // Anti-stairstep smoothing (Chaikin x3 + DP 0.45 px, guarded — falls back
  // to the exact loop on any fidelity/self-intersection failure). This is
  // what removes the raster stair-step aliasing from the extruded silhouette.
  const outerForGeometry = smoothLatticeLoop(outerExact)

  // Convert to THREE.Vector2
  let shapePts = outerForGeometry.map(p => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y)))
  
  // Ensure CCW winding for THREE.Shape
  let worldSignedArea = 0
  for (let i = 0; i < shapePts.length; i++) {
    const p1 = shapePts[i]
    const p2 = shapePts[(i + 1) % shapePts.length]
    worldSignedArea += p1.x * p2.y - p2.x * p1.y
  }
  worldSignedArea /= 2
  
  if (worldSignedArea < 0) {
    shapePts = shapePts.slice().reverse()
  }
  
  // Build the validated THREE.Shape from the validated outer loop.
  // This shape is shared by both FLAT_BASE and EXTRUDE_FROM_FLAT_BASE.
  let validatedShape: THREE.Shape
  try {
    validatedShape = new THREE.Shape(shapePts)
  } catch (e) {
    console.error("[v0-solid] THREE.Shape construction failed:", e)
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: {
        maskResolution: MASK_RESOLUTION,
        filledPixelCount: filledCount,
        componentCount,
        largestComponentPixels: largestSize,
        outerContourPoints: outerContour.length,
        simplifiedOuterPoints: shapePts.length,
        holeCount: 0,
        rebuildTimeMs: performance.now() - startTime
      },
      stages: emptyStages,
      diagnostics: {
        ...diagnostics,
        geometryType: "NULL",
        contourRejected: "YES",
        contourRejectReason: "THREE.Shape construction threw exception"
      }
    }
  }
  
  // Build flat geometry (this is the FLAT_BASE checkpoint output).
  // It is ALSO used as the cap source for EXTRUDE_FROM_FLAT_BASE.
  let flatGeom: THREE.BufferGeometry | null = null
  try {
    flatGeom = new THREE.ShapeGeometry(validatedShape)

    if (!QUIET) console.log("[v0-solid] FLAT_BASE: Built FLAT geometry", {
      inputPoints: shapePts.length,
      vertexCount: flatGeom.getAttribute("position")?.count ?? 0
    })
  } catch (e) {
    console.error("[v0-solid] ShapeGeometry failed:", e)
    
    return {
      geometry: null,
      geometryNoHoles: null,
      stats: {
        maskResolution: MASK_RESOLUTION,
        filledPixelCount: filledCount,
        componentCount,
        largestComponentPixels: largestSize,
        outerContourPoints: outerContour.length,
        simplifiedOuterPoints: shapePts.length,
        holeCount: 0,
        rebuildTimeMs: performance.now() - startTime
      },
      stages: emptyStages,
      diagnostics: {
        ...diagnostics,
        geometryType: "NULL",
        contourRejected: "YES",
        contourRejectReason: "ShapeGeometry threw exception"
      }
    }
  }
  
  // ========== SUCCESS — Branch on SOLID_GEOMETRY_MODE ==========
  emptyStages.simplifiedOuter = outerForGeometry
  
  const successStats: MaskSolidStats = {
    maskResolution: MASK_RESOLUTION,
    filledPixelCount: filledCount,
    componentCount,
    largestComponentPixels: largestSize,
    outerContourPoints: outerContour.length,
    simplifiedOuterPoints: shapePts.length,
    holeCount: 0,
    rebuildTimeMs: performance.now() - startTime
  }
  
  // ----- FLAT_BASE: known-good checkpoint, return flat geometry -----
  if (SOLID_GEOMETRY_MODE === "FLAT_BASE") {
    return {
      geometry: flatGeom,
      geometryNoHoles: flatGeom,
      stats: successStats,
      stages: emptyStages,
      diagnostics
    }
  }
  
  // ===== H2 / H3: cap-with-holes pipeline =====
  // This block is shared by both H2 (flat cap only) and H3 (full extrusion).
  // Both modes need exactly the same:
  //   - counter-preserving hole detection (thinner re-raster to catch tight counters)
  //   - per-hole mask-to-world contour tracing + simplification + winding fix
  //   - ShapeUtils.triangulateShape on the validated outer + ordered hole contours
  //
  // H2 (FLAT_CAP_WITH_HOLES): returns the flat triangulated cap as-is.
  // H3 (EXTRUDE_FROM_FLAT_CAP_WITH_HOLES): keeps the same cap as the +Z face,
  //     mirrors it to a -Z back cap, then assembles outer side walls (from the
  //     validated outer contour) and inner side walls (one quad strip per valid
  //     hole contour) using the live `depth` parameter. See the bottom of this
  //     block for the H3-only assembly + diagnostics.
  if (
    SOLID_GEOMETRY_MODE === "FLAT_CAP_WITH_HOLES" ||
    SOLID_GEOMETRY_MODE === "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES"
  ) {
    const h2HoleContourAreas: number[] = []
    const h2HoleContourRejectReasons: string[] = []
    let h2FlatCapWithHolesBuilt: "YES" | "NO" = "NO"
    let h2FrontCapTris = 0
    let h2ShapeHoleCount = 0
    let geometryWithHoles: THREE.BufferGeometry = flatGeom
    // H3-visible references — populated inside the H2 path so the H3 assembly
    // (below) can reuse exactly the same triangulated cap + hole contours.
    let h3OrderedHolesWorld: THREE.Vector2[][] = []
    let h3CapHasHoleTriangulation = false
    
    // Per-hole world-space contours (post simplification, post winding fix).
    // Used both for the THREE.Path attachment and for the direct
    // ShapeUtils.triangulateShape fallback.
    const holeContoursWorld: THREE.Vector2[][] = []
    // Parallel array of labelIds for each entry pushed into holeContoursWorld.
    // Powers the small-counter viability "usedByH2" determination.
    const usedHoleLabelIds: number[] = []
    // Parallel array of world-space centroids + raw px area for each pushed
    // hole. Exposed in diagnostics so the animation hole-stabilization gate
    // (Scene) can match partial-frame detections against the cached final
    // hole reference and decide activation per-frame.
    const detectedPartialHoleCentroidsWorld: Array<{ x: number; y: number; areaPx: number }> = []
    
    // ===== COUNTER-PRESERVING DETECTION =====
    // If the actual mask missed a counter (because thick stroke filled it in),
    // re-raster the SAME stroke at a thinner counter-detection thickness and
    // run H1 on it. If that produces MORE valid holes than the actual mask,
    // we use the thinner mask's holes as our hole source for H2.
    //
    // Outer silhouette / cap continues to use the actual-thickness mask; only
    // the inner hole contours are borrowed. Topological invariant (thinner
    // body ⊆ actual body) plus a point-in-polygon centroid check against the
    // actual outer contour together guarantee that any borrowed hole lies
    // inside the actual cap.
    const actualThicknessPx = rasterDebug.rasterThicknessPx ?? 0
    let counterDetectionEnabled: "YES" | "NO" = "NO"
    let counterDetectionThicknessPx = 0
    let counterDetectedHoleCount = 0
    let counterValidHoleCount = 0
    let counterHoleAreas: number[] = []
    let counterHoleSource: "ACTUAL_MASK" | "COUNTER_MASK" = "ACTUAL_MASK"
    let activeHoleDetection = holeDetection
    
    // Pixel thresholds scale with the animated-build resolution reduction so
    // counter-detection decisions match static behavior.
    const cdMinPx = COUNTER_DETECTION_MIN_PX * resScale
    const cdMaxPx = COUNTER_DETECTION_MAX_PX * resScale
    const cdMinGapPx = COUNTER_DETECTION_MIN_GAP_PX * resScale
    if (actualThicknessPx > cdMinPx + cdMinGapPx) {
      counterDetectionThicknessPx = Math.max(
        cdMinPx,
        Math.min(
          cdMaxPx,
          actualThicknessPx * COUNTER_DETECTION_THICKNESS_SCALE
        )
      )

      if (counterDetectionThicknessPx < actualThicknessPx - cdMinGapPx) {
        counterDetectionEnabled = "YES"
        // Scale the WORLD-space input thickness by the same ratio, so the
        // re-render lands at the desired mask-px counter thickness.
        const worldCounterThickness =
          thickness * (counterDetectionThicknessPx / actualThicknessPx)
        
        const counterRender = renderStrokeToMask(
          stroke.points,
          worldCounterThickness,
          canvasWidth,
          canvasHeight,
          buildRes
        )
        
        // Same canvas+resolution should produce same mask dims; bail otherwise.
        if (
          counterRender.width === width &&
          counterRender.height === height &&
          counterRender.filledCount > 0
        ) {
          const counterCC = labelConnectedComponents(
            counterRender.mask,
            counterRender.width,
            counterRender.height
          )
          if (counterCC.componentCount > 0) {
            // Pick largest component (same way as actual mask).
            let counterLargestLabel = 1
            let counterLargestSize = 0
            for (let i = 1; i <= counterCC.componentCount; i++) {
              if (counterCC.componentSizes[i] > counterLargestSize) {
                counterLargestSize = counterCC.componentSizes[i]
                counterLargestLabel = i
              }
            }
            const counterComponentMask = new Array(
              counterRender.width * counterRender.height
            ).fill(false)
            for (let i = 0; i < counterRender.mask.length; i++) {
              counterComponentMask[i] = counterCC.labels[i] === counterLargestLabel
            }
            const counterHoles = detectInteriorHoles(
              counterComponentMask,
              counterRender.width,
              counterRender.height,
              resScale
            )
            counterDetectedHoleCount = counterHoles.detectedHoleCount
            counterValidHoleCount = counterHoles.validHoleCount
            counterHoleAreas = counterHoles.holeAreas.slice()
            
            if (!QUIET) console.log("[v0-solid] COUNTER MASK detection:", {
              actualThicknessPx,
              counterDetectionThicknessPx,
              counterDetected: counterHoles.detectedHoleCount,
              counterValid: counterHoles.validHoleCount,
              counterAreas: counterHoles.holeAreas,
              counterRejected: counterHoles.rejectedHoleCount,
              counterRejectReasons: counterHoles.holeRejectReasons,
              counterBorderTouching: counterHoles.borderTouchingEmptyCount,
              actualValid: holeDetection.validHoleCount,
            })
            
            // Use counter-mask holes only if STRICTLY MORE valid holes than
            // actual mask. (Equal counts → trust actual; same counters likely.)
            if (counterHoles.validHoleCount > holeDetection.validHoleCount) {
              // Defense-in-depth: each candidate hole's centroid must lie
              // inside the actual outer contour. Filters out edge cases
              // where a thinner stroke breaks into pieces and the "largest
              // counter component" doesn't match the actual largest.
              const filteredIdx: number[] = []
              for (let k = 0; k < counterHoles.validHoleLabelIds.length; k++) {
                const lid = counterHoles.validHoleLabelIds[k]
                let sx = 0, sy = 0, n = 0
                for (let i = 0; i < counterHoles.emptyLabels.length; i++) {
                  if (counterHoles.emptyLabels[i] === lid) {
                    sx += i % counterRender.width
                    sy += Math.floor(i / counterRender.width)
                    n++
                  }
                }
                if (n === 0) continue
                const cx = sx / n
                const cy = sy / n
                if (pointInPolygonMask(cx, cy, outerContour)) {
                  filteredIdx.push(k)
                } else if (!QUIET) {
                  console.log(
                    `[v0-solid] counter hole label=${lid} centroid=(${cx.toFixed(1)},${cy.toFixed(1)}) REJECTED (outside actual outer)`
                  )
                }
              }
              if (filteredIdx.length > 0) {
                const filteredLabelIds = filteredIdx.map(
                  (k) => counterHoles.validHoleLabelIds[k]
                )
                const filteredAreas = filteredIdx.map(
                  (k) => counterHoles.holeAreas[k]
                )
                const filteredBboxes = filteredIdx.map(
                  (k) => counterHoles.validHoleBboxes[k]
                )
                activeHoleDetection = {
                  detectedHoleCount: counterHoles.detectedHoleCount,
                  validHoleCount: filteredLabelIds.length,
                  rejectedHoleCount:
                    counterHoles.rejectedHoleCount +
                    (counterHoles.validHoleLabelIds.length - filteredLabelIds.length),
                  largestHoleArea: filteredAreas[0] ?? 0,
                  holeAreas: filteredAreas,
                  holeRejectReasons: counterHoles.holeRejectReasons,
                  borderTouchingEmptyCount: counterHoles.borderTouchingEmptyCount,
                  rejectedHoleAreas: counterHoles.rejectedHoleAreas,
                  emptyLabels: counterHoles.emptyLabels,
                  validHoleLabelIds: filteredLabelIds,
                  validHoleBboxes: filteredBboxes,
                }
                counterHoleSource = "COUNTER_MASK"
                if (!QUIET) console.log(
                  `[v0-solid] COUNTER MASK selected as hole source (valid=${filteredLabelIds.length})`
                )
              }
            }
          }
        }
      }
    }
    
    // Only attempt to add holes if the active source has at least one valid
    // hole — OR the caller supplied an animation hole stabilization override
    // with at least one currently-active final hole. The second clause is
    // what allows the H3 hole pipeline to stay alive across brief partial-
    // detection drop-outs (e.g. mid-reveal sub-frames where the loop bridge
    // pixel happens to be classified as empty for one frame). Static callers
    // never pass `holeStabilization`, so their behavior is unchanged.
    const overrideHasActiveHoles =
      holeStabilization !== undefined &&
      holeStabilization.mode === "ANIMATION_GATED" &&
      holeStabilization.activeFinalHolesWorld.length > 0

    // Hoisted so the final diagnostics object can read them regardless of
    // whether the gate below is entered. Values stay at their defaults if
    // the gate is skipped (no partial holes AND no override).
    let stabilization_holeStabilizationActive: "YES" | "NO" = "NO"
    let stabilization_holeOverrideKeptCount = 0
    let stabilization_holeOverrideRejectedCount = 0
    let stabilization_holeOverrideRejectReasons: string[] = []
    let stabilization_stableHolesWorld: Array<Array<{ x: number; y: number }>> = []

    // Animation-only short-circuit: when the caller has explicitly asked for
    // a no-holes partial reveal, refuse to build the H2 cap-with-holes
    // pipeline regardless of detection results or override input. This is
    // the SOLE switch that controls mid-reveal hole topology — once it's
    // off (final frame or static path), this branch runs exactly as before.
    if (
      !disableHolesForAnimation &&
      ((activeHoleDetection.validHoleLabelIds.length > 0 &&
        activeHoleDetection.emptyLabels.length === width * height) ||
        overrideHasActiveHoles)
    ) {
      // Iterate EVERY valid hole — not just the largest. This is the H2
      // contract: every valid hole from the ACTIVE source gets a chance to
      // become a shape.holes entry. Per-hole failures are recorded
      // individually so the panel shows exactly which hole was dropped.
      // (Active source is either the actual mask or — when the actual mask
      // missed a counter — the thinner counter-detection mask.)
      for (const labelId of activeHoleDetection.validHoleLabelIds) {
        // Build a per-hole binary mask: TRUE where this hole's empty pixels are.
        const holeMask = new Array(width * height).fill(false)
        let pxCount = 0
        for (let i = 0; i < width * height; i++) {
          if (activeHoleDetection.emptyLabels[i] === labelId) {
            holeMask[i] = true
            pxCount++
          }
        }
        
        // Trace its outer boundary in mask space using the existing pipeline.
        // chainBoundaryEdges may split at pinch points; if so, we'd previously
        // get only the LONGEST sub-loop. To avoid silently dropping holes whose
        // boundaries pinch, we fall back to gathering ALL loops and picking
        // the one with maximum enclosed (mask-space) area.
        const holeContourMask = traceLargestAreaContour(holeMask, width, height)
        if (holeContourMask.length < 3) {
          h2HoleContourRejectReasons.push(`label=${labelId} area=${pxCount} traced<3pts`)
          continue
        }

        // Same exact-simplify + guarded anti-stairstep smoothing as the outer
        // contour, so hole rims match the outer silhouette's edge quality.
        // Deviation is bounded < 1 mask px; the mask guarantees >= 1 px of
        // filled wall between a hole boundary and the outer boundary, so
        // smoothing cannot fuse the two.
        const holeSmoothed = smoothLatticeLoop(simplifyCollinearMask(holeContourMask))

        // Convert to world coordinates using the same transform as the outer.
        let holePts = holeSmoothed.map(
          (p) => new THREE.Vector2(toWorldX(p.x), toWorldY(p.y))
        )
        
        // Simplify: drop consecutive duplicate vertices and collinear runs.
        // Pixel-edge boundaries are dominated by axis-aligned collinear runs
        // (e.g., 8 collinear points along a horizontal edge); reducing them
        // to 2 endpoints removes degenerate/zero-length earcut triangles
        // and lowers the chance that a triangulator silently drops the hole.
        holePts = simplifyCollinearAndDuplicates(holePts, 1e-9)
        
        if (holePts.length < 3) {
          h2HoleContourRejectReasons.push(`label=${labelId} area=${pxCount} simplified<3pts`)
          continue
        }
        
        // Compute world-space signed area for winding decision.
        let holeSignedArea = 0
        for (let i = 0; i < holePts.length; i++) {
          const p1 = holePts[i]
          const p2 = holePts[(i + 1) % holePts.length]
          holeSignedArea += p1.x * p2.y - p2.x * p1.y
        }
        holeSignedArea /= 2
        
        // Sanity: degenerate world-area, skip.
        if (Math.abs(holeSignedArea) < 1e-10) {
          h2HoleContourRejectReasons.push(`label=${labelId} area=${pxCount} world-area~0`)
          continue
        }
        
        // Holes must wind OPPOSITE to the outer.
        // Outer was forced CCW (worldSignedArea > 0); we force holes CW.
        if (holeSignedArea > 0) {
          holePts = holePts.slice().reverse()
        }
        
        // Compute centroid + bbox for diagnostics.
        let cx = 0, cy = 0, minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const p of holePts) {
          cx += p.x; cy += p.y
          if (p.x < minX) minX = p.x
          if (p.x > maxX) maxX = p.x
          if (p.y < minY) minY = p.y
          if (p.y > maxY) maxY = p.y
        }
        cx /= holePts.length; cy /= holePts.length
        
        if (!QUIET) console.log(`[v0-solid] H2 hole label=${labelId}`, {
          maskAreaPx: pxCount,
          contourPts: holePts.length,
          worldSignedArea: holeSignedArea.toFixed(6),
          worldBbox: `[${minX.toFixed(3)},${minY.toFixed(3)} → ${maxX.toFixed(3)},${maxY.toFixed(3)}]`,
          worldCentroid: `(${cx.toFixed(3)}, ${cy.toFixed(3)})`,
          worldWidth: (maxX - minX).toFixed(4),
          worldHeight: (maxY - minY).toFixed(4),
        })
        
        holeContoursWorld.push(holePts)
        h2HoleContourAreas.push(pxCount)
        usedHoleLabelIds.push(labelId)
        detectedPartialHoleCentroidsWorld.push({ x: cx, y: cy, areaPx: pxCount })
      }
      
      // Sort holes by descending world-space |area|. Some triangulators are
      // sensitive to hole order (largest first is the safe convention).
      const orderedIdx = holeContoursWorld
        .map((_, i) => i)
        .sort((a, b) => {
          const aa = signedAreaOf(holeContoursWorld[a])
          const ab = signedAreaOf(holeContoursWorld[b])
          return Math.abs(ab) - Math.abs(aa)
        })
      let orderedHoles = orderedIdx.map((i) => holeContoursWorld[i])
      let orderedAreas = orderedIdx.map((i) => h2HoleContourAreas[i])

      // ===== Animation hole stabilization override =====
      // If the caller (Scene) is animating Solid H3 and supplied a stable
      // final-pass hole set with per-frame activation already decided
      // (with hysteresis applied OUTSIDE this function), substitute the
      // partial-frame detected hole contours with the caller's stable
      // contours BEFORE cap triangulation / H3 wall assembly. This is the
      // single intervention that stops the visible counter pop / shape
      // switching during playback.
      //
      // Static H1/H2 thresholds, static H3 geometry, and Solid export are
      // unaffected — they never pass `holeStabilization`.
      //
      // Sticky-final-hole-contour stabilization:
      //
      //   The CALLER (Scene) is responsible for deciding which final holes
      //   are "active" this frame, using the 2-hit centroid activation
      //   matcher. By the time a final hole lands in `activeFinalHolesWorld`,
      //   the caller has already confirmed (a) it matches a real final hole
      //   and (b) the partial silhouette has reached it. From that point
      //   on the contour is TRUSTED — we attach it unconditionally for the
      //   rest of the reveal.
      //
      //   The previous "centroid-inside-partial-outer" test that lived here
      //   was the documented root cause of post-activation hole switching:
      //   an active hole could pop in and out frame-to-frame as the partial
      //   silhouette's centroid coverage wobbled. That test is gone now;
      //   the only remaining filters are mathematical sanity (need >= 3
      //   points, non-zero signed area). Static H1/H2/H3 callers never
      //   reach this block (they never pass `holeStabilization`), so their
      //   behavior is unchanged.
      if (holeStabilization && holeStabilization.mode === "ANIMATION_GATED") {
        stabilization_holeStabilizationActive = "YES"
        const overrideKept: THREE.Vector2[][] = []
        const overrideAreas: number[] = []
        for (let i = 0; i < holeStabilization.activeFinalHolesWorld.length; i++) {
          const finalHole = holeStabilization.activeFinalHolesWorld[i]
          if (!finalHole || finalHole.length < 3) {
            stabilization_holeOverrideRejectedCount++
            stabilization_holeOverrideRejectReasons.push(`final[${i}] degenerate-contour`)
            continue
          }
          const sa = Math.abs(signedAreaOf(finalHole))
          if (sa < 1e-10) {
            stabilization_holeOverrideRejectedCount++
            stabilization_holeOverrideRejectReasons.push(`final[${i}] world-area~0`)
            continue
          }
          overrideKept.push(finalHole)
          overrideAreas.push(sa * 1e6)
        }
        const ovIdx = overrideKept
          .map((_, i) => i)
          .sort((a, b) => overrideAreas[b] - overrideAreas[a])
        orderedHoles = ovIdx.map((i) => overrideKept[i])
        orderedAreas = ovIdx.map((i) => overrideAreas[i])
        stabilization_holeOverrideKeptCount = orderedHoles.length
        usedHoleLabelIds.length = 0
        for (let i = 0; i < orderedHoles.length; i++) usedHoleLabelIds.push(-(i + 1))
        if (!QUIET) console.log("[v0-solid] H3 ANIMATION_GATED override applied", {
          finalHoleCountIn: holeStabilization.activeFinalHolesWorld.length,
          kept: stabilization_holeOverrideKeptCount,
          rejected: stabilization_holeOverrideRejectedCount,
          partialDetectedHoles: holeContoursWorld.length,
        })
      }
      // Capture the FINAL ordered hole contours (post-override-or-not) into
      // the hoisted snapshot so the diagnostics object can expose exactly
      // which contours fed cap triangulation + H3 inner walls.
      stabilization_stableHolesWorld = orderedHoles.map((c) =>
        c.map((p) => ({ x: p.x, y: p.y })),
      )
      // Expose ordered hole contours to the H3 assembly block below.
      h3OrderedHolesWorld = orderedHoles
      
      // Build the shape WITH holes by attaching a THREE.Path per hole.
      const shapeWithHoles = new THREE.Shape(shapePts)
      for (const holePts of orderedHoles) {
        try {
          const path = new THREE.Path(holePts)
          shapeWithHoles.holes.push(path)
        } catch (e) {
          h2HoleContourRejectReasons.push(`Path-throw`)
        }
      }
      h2ShapeHoleCount = shapeWithHoles.holes.length
      
      // ===== Direct triangulation (bypasses ShapeGeometry's wrapper) =====
      // We use ShapeUtils.triangulateShape so we can observe the actual
      // triangle output. ShapeGeometry calls this under the hood; doing it
      // here makes silent hole drops impossible to hide.
      if (h2ShapeHoleCount > 0) {
        try {
          // Build BufferGeometry manually from the same data ShapeGeometry
          // would consume. This guarantees holes are passed to earcut.
          const triangulated = (THREE as any).ShapeUtils.triangulateShape(
            shapePts,
            orderedHoles
          ) as Array<[number, number, number]>
          
          // Flatten all rings: outer first, then each hole, in the same order
          // ShapeUtils consumed them. Indices in `triangulated` reference this
          // flat vertex array.
          const allRings: THREE.Vector2[][] = [shapePts, ...orderedHoles]
          const flatVerts: THREE.Vector2[] = []
          for (const ring of allRings) {
            for (const p of ring) flatVerts.push(p)
          }
          
          const positions = new Float32Array(flatVerts.length * 3)
          for (let i = 0; i < flatVerts.length; i++) {
            positions[i * 3] = flatVerts[i].x
            positions[i * 3 + 1] = flatVerts[i].y
            positions[i * 3 + 2] = 0
          }
          const indices = new Uint32Array(triangulated.length * 3)
          for (let i = 0; i < triangulated.length; i++) {
            indices[i * 3] = triangulated[i][0]
            indices[i * 3 + 1] = triangulated[i][1]
            indices[i * 3 + 2] = triangulated[i][2]
          }
          
          const holesGeom = new THREE.BufferGeometry()
          holesGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3))
          holesGeom.setIndex(new THREE.BufferAttribute(indices, 1))
          holesGeom.computeVertexNormals()
          
          h2FrontCapTris = triangulated.length
          geometryWithHoles = holesGeom
          h2FlatCapWithHolesBuilt = "YES"
          h3CapHasHoleTriangulation = true
        } catch (e) {
          console.error("[v0-solid] H2 triangulateShape failed, falling back to ShapeGeometry:", e)
          // Fallback: ShapeGeometry path
          try {
            const holesGeom = new THREE.ShapeGeometry(shapeWithHoles)
            const idx = holesGeom.getIndex()
            h2FrontCapTris = idx ? idx.count / 3 : 0
            geometryWithHoles = holesGeom
            h2FlatCapWithHolesBuilt = "YES"
            h3CapHasHoleTriangulation = true
          } catch (e2) {
            console.error("[v0-solid] H2 ShapeGeometry fallback also failed:", e2)
            h2HoleContourRejectReasons.push(`triangulateShape-throw`)
            h2FlatCapWithHolesBuilt = "NO"
            geometryWithHoles = flatGeom
            h2FrontCapTris = 0
          }
        }
      } else {
        h2FrontCapTris = flatIndexCount(flatGeom)
        geometryWithHoles = flatGeom
        h2FlatCapWithHolesBuilt = "NO"
      }
      
      // Replace areas array with the ordered version so the panel matches.
      h2HoleContourAreas.length = 0
      for (const a of orderedAreas) h2HoleContourAreas.push(a)
    } else {
      // No valid holes from H1 — pure flat cap (no fake hole).
      h2FrontCapTris = flatIndexCount(flatGeom)
      geometryWithHoles = flatGeom
      h2FlatCapWithHolesBuilt = "NO"
    }
    
    // Compare to flat-cap baseline tris so the panel reveals whether
    // the holes actually contributed extra triangles.
    const flatCapTris = flatIndexCount(flatGeom)
    const triDelta = h2FrontCapTris - flatCapTris
    
    if (!QUIET) console.log("[v0-solid] FLAT_CAP_WITH_HOLES:", {
      // H1 inputs
      h1DetectedHoleCount: holeDetection.detectedHoleCount,
      h1ValidHoleCount: holeDetection.validHoleCount,
      h1RejectedHoleCount: holeDetection.rejectedHoleCount,
      h1HoleAreas: holeDetection.holeAreas,
      h1RejectedHoleAreas: holeDetection.rejectedHoleAreas,
      h1HoleRejectReasons: holeDetection.holeRejectReasons,
      h1BorderTouchingEmptyCount: holeDetection.borderTouchingEmptyCount,
      // H2 outputs
      h2HoleContoursUsed: h2HoleContourAreas.length,
      h2HoleContourAreas,
      h2HoleContourRejectReasons,
      h2ShapeHoleCount,
      h2FlatCapWithHolesBuilt,
      h2FrontCapTris,
      flatCapTris,
      triDelta,
      triDeltaIndicatesHolesCut: triDelta > 0 ? "YES" : "NO",
    })
    
    // Determine whether the SMALLEST valid hole from the ACTIVE source made
    // it through H2. The smallest valid hole's labelId is the LAST entry in
    // validHoleLabelIds (since they're parallel-sorted by descending area).
    let smallestUsedByH2: "YES" | "NO" | "N/A" = "N/A"
    if (activeHoleDetection.validHoleLabelIds.length > 0) {
      const smallestLabel =
        activeHoleDetection.validHoleLabelIds[
          activeHoleDetection.validHoleLabelIds.length - 1
        ]
      smallestUsedByH2 =
        h2FlatCapWithHolesBuilt === "YES" && usedHoleLabelIds.includes(smallestLabel)
          ? "YES"
          : "NO"
    }
    
    // Recompute viability fields from the ACTIVE source so the panel reflects
    // what actually fed H2 (matters when COUNTER_MASK was selected).
    const activeViability = computeSmallestValidHoleViability(activeHoleDetection)
    
    if (!QUIET) console.log("[v0-solid] H2 small-counter viability:", {
      activeSource: counterHoleSource,
      smallestValidHoleArea: activeViability.smallestValidHoleArea,
      smallestValidHoleBboxW: activeViability.smallestValidHoleBboxW,
      smallestValidHoleBboxH: activeViability.smallestValidHoleBboxH,
      smallestValidHoleAreaToBboxRatio: activeViability.smallestValidHoleAreaToBboxRatio?.toFixed(3),
      smallestValidHoleUsedByH2: smallestUsedByH2,
      usedHoleLabelIds,
      validHoleLabelIds: activeHoleDetection.validHoleLabelIds,
    })
    
    // Mirror H2 fields into stages.solidDiagnostics (panel reads them there)
    if (emptyStages.solidDiagnostics) {
      emptyStages.solidDiagnostics.h2FlatCapWithHolesBuilt = h2FlatCapWithHolesBuilt
      emptyStages.solidDiagnostics.h2HoleContoursUsed = h2HoleContourAreas.length
      emptyStages.solidDiagnostics.h2HoleContourAreas = h2HoleContourAreas
      emptyStages.solidDiagnostics.h2HoleContourRejectReasons = h2HoleContourRejectReasons
      emptyStages.solidDiagnostics.h2ShapeHoleCount = h2ShapeHoleCount
      emptyStages.solidDiagnostics.h2FrontCapTris = h2FrontCapTris
      emptyStages.solidDiagnostics.h2FlatCapTrisBaseline = flatCapTris
      emptyStages.solidDiagnostics.h2TriDelta = triDelta
      emptyStages.solidDiagnostics.smallestValidHoleUsedByH2 = smallestUsedByH2
      emptyStages.solidDiagnostics.smallestValidHoleArea = activeViability.smallestValidHoleArea
      emptyStages.solidDiagnostics.smallestValidHoleBboxW = activeViability.smallestValidHoleBboxW
      emptyStages.solidDiagnostics.smallestValidHoleBboxH = activeViability.smallestValidHoleBboxH
      emptyStages.solidDiagnostics.smallestValidHoleAreaToBboxRatio = activeViability.smallestValidHoleAreaToBboxRatio
      emptyStages.solidDiagnostics.counterDetectionEnabled = counterDetectionEnabled
      emptyStages.solidDiagnostics.actualThicknessPx = actualThicknessPx
      emptyStages.solidDiagnostics.counterDetectionThicknessPx = counterDetectionThicknessPx
      emptyStages.solidDiagnostics.counterDetectedHoleCount = counterDetectedHoleCount
      emptyStages.solidDiagnostics.counterValidHoleCount = counterValidHoleCount
      emptyStages.solidDiagnostics.counterHoleAreas = counterHoleAreas
      emptyStages.solidDiagnostics.counterHoleSource = counterHoleSource
      // Solid H3 animation hole stabilization mirrors. Always written so the
      // panel can show "NO" when the override pipeline was not requested.
      emptyStages.solidDiagnostics.detectedPartialHoleCentroidsWorld =
        detectedPartialHoleCentroidsWorld
      emptyStages.solidDiagnostics.stableHolesWorld = stabilization_stableHolesWorld
      emptyStages.solidDiagnostics.holeStabilizationActive =
        stabilization_holeStabilizationActive
      emptyStages.solidDiagnostics.holeOverrideKeptCount =
        stabilization_holeOverrideKeptCount
      emptyStages.solidDiagnostics.holeOverrideRejectedCount =
        stabilization_holeOverrideRejectedCount
      emptyStages.solidDiagnostics.holeOverrideRejectReasons =
        stabilization_holeOverrideRejectReasons
      // Sticky-final-hole-contour strategy: the engine always reports the
      // same active label. The `disableHolesForAnimation` parameter remains
      // accepted so external callers can't break the type contract, but
      // Scene never sets it true any more — so this branch consistently
      // emits the sticky-strategy label.
      emptyStages.solidDiagnostics.holesDisabledForAnimation =
        disableHolesForAnimation ? "YES" : "NO"
      emptyStages.solidDiagnostics.solidAnimationHoleMode =
        "STICKY_FINAL_HOLE_CONTOURS"
    }
    
    // ===================================================================
    // ===== H3: EXTRUDE_FROM_FLAT_CAP_WITH_HOLES (default production mode)
    // ===================================================================
    // Reuses the H2 triangulated cap as the +Z front face, mirrors it to a
    // -Z back face, and assembles manual side walls:
    //   - Outer walls from the validated outer contour (`shapePts`, CCW)
    //   - Inner walls per hole contour (`h3OrderedHolesWorld`, each CW)
    //
    // Wall winding note: the standard quad winding (A,D,C),(A,C,B) with
    //   A = front-curr, B = front-next, C = back-next, D = back-curr
    // produces a normal that is the RIGHT-perpendicular to the walk
    // direction. For a CCW outer loop, right-perp points AWAY from the
    // body (outside the solid). For a CW hole loop, right-perp ALSO
    // points away from the body — i.e. into the hole interior. So the
    // SAME winding works for both loop types, and signed-area direction
    // takes care of normal orientation automatically.
    let h3Diagnostics: Partial<MaskSolidDiagnostics> = {}
    if (SOLID_GEOMETRY_MODE === "EXTRUDE_FROM_FLAT_CAP_WITH_HOLES") {
      const solidDepthEffective = Math.max(H3_DEPTH_FLOOR, depth)
      const halfDepth = solidDepthEffective / 2
      const WALL_EPSILON = 1e-5

      // Cap source: the H2-built cap-with-holes (preferred) or flatGeom
      // (when no valid holes were available; equivalent to outer-only).
      const capGeom: THREE.BufferGeometry = h3CapHasHoleTriangulation
        ? geometryWithHoles
        : flatGeom
      const capPosAttr = capGeom.getAttribute("position") as THREE.BufferAttribute | undefined
      const capIdxAttr = capGeom.getIndex()

      if (!capPosAttr || !capIdxAttr) {
        console.error("[v0-solid] H3: cap geometry missing position/index — falling back to flat cap")
        h3Diagnostics = {
          h3Built: "NO",
          h3HoleContoursUsed: h2HoleContourAreas.length,
          h3ShapeHoleCount: h2ShapeHoleCount,
          h3InnerWallCount: 0,
          h3InnerWallSegments: 0,
          h3OuterWallSegments: 0,
          h3FrontCapTris: 0,
          h3BackCapTris: 0,
          h3SkippedOuterWallSegments: 0,
          h3SkippedInnerWallSegments: 0,
          h3TotalVerts: 0,
          h3TotalTris: 0,
          solidDepthParam: depth,
          solidDepthEffective,
          geometryBBoxZ: 0,
          exportUsesSamePath: "YES",
        }
      } else {
        const capPos = capPosAttr.array as Float32Array
        const capIdx = capIdxAttr.array as ArrayLike<number>
        const capVertCount = capPosAttr.count
        const capTriCount = capIdx.length / 3

        // Inner loops for walls — exactly the hole contours fed into
        // triangulateShape. If H2 didn't actually attach them to the
        // cap (fallback path or no holes), there are no inner walls.
        const innerLoops: THREE.Vector2[][] = h3CapHasHoleTriangulation
          ? h3OrderedHolesWorld
          : []

        // Count segments up front so buffer sizes are exact.
        const countSegs = (loop: { x: number; y: number }[]) => {
          let kept = 0
          let skipped = 0
          for (let i = 0; i < loop.length; i++) {
            const a = loop[i]
            const b = loop[(i + 1) % loop.length]
            if (Math.hypot(b.x - a.x, b.y - a.y) < WALL_EPSILON) skipped++
            else kept++
          }
          return { kept, skipped }
        }
        const outerSegStats = countSegs(shapePts)
        let innerSegKeptTotal = 0
        let innerSegSkippedTotal = 0
        const innerSegStatsPerLoop: Array<{ kept: number; skipped: number }> = []
        for (const loop of innerLoops) {
          const s = countSegs(loop)
          innerSegStatsPerLoop.push(s)
          innerSegKeptTotal += s.kept
          innerSegSkippedTotal += s.skipped
        }

        const wallQuadCount = outerSegStats.kept + innerSegKeptTotal
        const h3TotalVerts = capVertCount * 2 + wallQuadCount * 4
        const h3TotalTris = capTriCount * 2 + wallQuadCount * 2

        const positions = new Float32Array(h3TotalVerts * 3)
        const indices = new Uint32Array(h3TotalTris * 3)
        let vOff = 0
        let iOff = 0

        // ----- Front cap (+Z) — identical triangulation to H2 cap -----
        const frontBase = vOff
        for (let v = 0; v < capVertCount; v++) {
          positions[(vOff + v) * 3 + 0] = capPos[v * 3 + 0]
          positions[(vOff + v) * 3 + 1] = capPos[v * 3 + 1]
          positions[(vOff + v) * 3 + 2] = +halfDepth
        }
        vOff += capVertCount
        for (let t = 0; t < capTriCount; t++) {
          indices[iOff++] = frontBase + capIdx[t * 3 + 0]
          indices[iOff++] = frontBase + capIdx[t * 3 + 1]
          indices[iOff++] = frontBase + capIdx[t * 3 + 2]
        }
        const frontCapTrisH3 = capTriCount

        // ----- Back cap (-Z) — same XY, reversed winding -----
        const backBase = vOff
        for (let v = 0; v < capVertCount; v++) {
          positions[(vOff + v) * 3 + 0] = capPos[v * 3 + 0]
          positions[(vOff + v) * 3 + 1] = capPos[v * 3 + 1]
          positions[(vOff + v) * 3 + 2] = -halfDepth
        }
        vOff += capVertCount
        for (let t = 0; t < capTriCount; t++) {
          // Reverse winding so the back face normal points -Z.
          indices[iOff++] = backBase + capIdx[t * 3 + 0]
          indices[iOff++] = backBase + capIdx[t * 3 + 2]
          indices[iOff++] = backBase + capIdx[t * 3 + 1]
        }
        const backCapTrisH3 = capTriCount

        // ----- Wall builder (shared between outer and each inner loop) -----
        const buildLoopWalls = (loop: { x: number; y: number }[]) => {
          for (let i = 0; i < loop.length; i++) {
            const a = loop[i]
            const b = loop[(i + 1) % loop.length]
            const dx = b.x - a.x
            const dy = b.y - a.y
            if (Math.hypot(dx, dy) < WALL_EPSILON) continue

            const A = vOff + 0
            const B = vOff + 1
            const C = vOff + 2
            const D = vOff + 3

            positions[A * 3 + 0] = a.x; positions[A * 3 + 1] = a.y; positions[A * 3 + 2] = +halfDepth
            positions[B * 3 + 0] = b.x; positions[B * 3 + 1] = b.y; positions[B * 3 + 2] = +halfDepth
            positions[C * 3 + 0] = b.x; positions[C * 3 + 1] = b.y; positions[C * 3 + 2] = -halfDepth
            positions[D * 3 + 0] = a.x; positions[D * 3 + 1] = a.y; positions[D * 3 + 2] = -halfDepth

            vOff += 4

            // Standard right-perp winding: works for both CCW outer and CW holes.
            indices[iOff++] = A
            indices[iOff++] = D
            indices[iOff++] = C

            indices[iOff++] = A
            indices[iOff++] = C
            indices[iOff++] = B
          }
        }

        // ----- Outer walls (CCW shapePts) -----
        buildLoopWalls(shapePts)

        // ----- Inner walls per hole (CW orderedHoles) -----
        for (const loop of innerLoops) {
          buildLoopWalls(loop)
        }

        const extrudedH3 = new THREE.BufferGeometry()
        extrudedH3.setAttribute("position", new THREE.BufferAttribute(positions, 3))
        extrudedH3.setIndex(new THREE.BufferAttribute(indices, 1))
        extrudedH3.computeVertexNormals()
        extrudedH3.computeBoundingBox()

        const bboxZ = extrudedH3.boundingBox
          ? extrudedH3.boundingBox.max.z - extrudedH3.boundingBox.min.z
          : 0

        if (!QUIET) console.log("[v0-solid] EXTRUDE_FROM_FLAT_CAP_WITH_HOLES (H3):", {
          solidDepthParam: depth,
          solidDepthEffective,
          halfDepth,
          capHasHoles: h3CapHasHoleTriangulation,
          capVertCount,
          capTriCount,
          frontCapTris: frontCapTrisH3,
          backCapTris: backCapTrisH3,
          outerWallSegments: outerSegStats.kept,
          skippedOuterWallSegments: outerSegStats.skipped,
          innerWallCount: innerLoops.length,
          innerWallSegments: innerSegKeptTotal,
          skippedInnerWallSegments: innerSegSkippedTotal,
          innerSegStatsPerLoop,
          totalVerts: h3TotalVerts,
          totalTris: h3TotalTris,
          bboxZ: bboxZ.toFixed(4),
        })

        // Replace the geometry that gets returned with the extruded mesh.
        geometryWithHoles = extrudedH3

        h3Diagnostics = {
          h3Built: "YES",
          h3HoleContoursUsed: innerLoops.length,
          h3ShapeHoleCount: h2ShapeHoleCount,
          h3InnerWallCount: innerLoops.length,
          h3InnerWallSegments: innerSegKeptTotal,
          h3OuterWallSegments: outerSegStats.kept,
          h3FrontCapTris: frontCapTrisH3,
          h3BackCapTris: backCapTrisH3,
          h3SkippedOuterWallSegments: outerSegStats.skipped,
          h3SkippedInnerWallSegments: innerSegSkippedTotal,
          h3TotalVerts,
          h3TotalTris,
          solidDepthParam: depth,
          solidDepthEffective,
          geometryBBoxZ: bboxZ,
          // SolidEngine.buildExport calls buildMaskSolid with the SAME
          // (stroke, thickness, depth) signature as the preview path (see
          // lib/geometry-engines.ts), so H3 export is identical to preview.
          exportUsesSamePath: "YES",
        }

        // Mirror onto the panel-facing stages.solidDiagnostics too.
        if (emptyStages.solidDiagnostics) {
          emptyStages.solidDiagnostics.h3Built = "YES"
          emptyStages.solidDiagnostics.h3HoleContoursUsed = innerLoops.length
          emptyStages.solidDiagnostics.h3ShapeHoleCount = h2ShapeHoleCount
          emptyStages.solidDiagnostics.h3InnerWallCount = innerLoops.length
          emptyStages.solidDiagnostics.h3InnerWallSegments = innerSegKeptTotal
          emptyStages.solidDiagnostics.h3OuterWallSegments = outerSegStats.kept
          emptyStages.solidDiagnostics.h3FrontCapTris = frontCapTrisH3
          emptyStages.solidDiagnostics.h3BackCapTris = backCapTrisH3
          emptyStages.solidDiagnostics.h3SkippedOuterWallSegments = outerSegStats.skipped
          emptyStages.solidDiagnostics.h3SkippedInnerWallSegments = innerSegSkippedTotal
          emptyStages.solidDiagnostics.h3TotalVerts = h3TotalVerts
          emptyStages.solidDiagnostics.h3TotalTris = h3TotalTris
          emptyStages.solidDiagnostics.solidDepthParam = depth
          emptyStages.solidDiagnostics.solidDepthEffective = solidDepthEffective
          emptyStages.solidDiagnostics.geometryBBoxZ = bboxZ
          emptyStages.solidDiagnostics.exportUsesSamePath = "YES"
        }
      }
    }

    // Mirror onto the returned diagnostics too
    const diagnosticsH2: MaskSolidDiagnostics = {
      ...diagnostics,
      h2FlatCapWithHolesBuilt,
      h2HoleContoursUsed: h2HoleContourAreas.length,
      h2HoleContourAreas,
      h2HoleContourRejectReasons,
      h2ShapeHoleCount,
      h2FrontCapTris,
      h2FlatCapTrisBaseline: flatCapTris,
      h2TriDelta: triDelta,
      smallestValidHoleUsedByH2: smallestUsedByH2,
      smallestValidHoleArea: activeViability.smallestValidHoleArea,
      smallestValidHoleBboxW: activeViability.smallestValidHoleBboxW,
      smallestValidHoleBboxH: activeViability.smallestValidHoleBboxH,
      smallestValidHoleAreaToBboxRatio: activeViability.smallestValidHoleAreaToBboxRatio,
      counterDetectionEnabled,
      actualThicknessPx,
      counterDetectionThicknessPx,
      counterDetectedHoleCount,
      counterValidHoleCount,
      counterHoleAreas,
      counterHoleSource,
      detectedPartialHoleCentroidsWorld,
      stableHolesWorld: stabilization_stableHolesWorld,
      holeStabilizationActive: stabilization_holeStabilizationActive,
      holeOverrideKeptCount: stabilization_holeOverrideKeptCount,
      holeOverrideRejectedCount: stabilization_holeOverrideRejectedCount,
      holeOverrideRejectReasons: stabilization_holeOverrideRejectReasons,
      ...h3Diagnostics,
    }
    
    return {
      geometry: geometryWithHoles,
      geometryNoHoles: flatGeom,
      stats: { ...successStats, holeCount: h2HoleContourAreas.length },
      stages: emptyStages,
      diagnostics: diagnosticsH2,
    }
  }
  
  // ----- EXTRUDE_FROM_FLAT_BASE: minimal deterministic manual extrusion -----
  // Builds extrusion directly from the validated flat base:
  //   1. Front cap = exact triangles from flatGeom (already validated by FLAT_BASE)
  //   2. Back cap = duplicate of front cap, translated by depth on Z, winding reversed
  //   3. Side walls = one quad (two triangles) per consecutive pair in the validated outer loop
  // No THREE.ExtrudeGeometry. No experimental modes. No holes. No simplification.
  
  const halfDepth = EXTRUDE_DEPTH / 2
  const WALL_EPSILON = 1e-5
  
  // ----- 1. FRONT CAP: pull positions + indices from the validated flatGeom -----
  // flatGeom is a ShapeGeometry built from validatedShape. It has triangles in
  // (x, y, 0) form. We use the exact same triangle data, lifted to z = +halfDepth.
  const flatPosAttr = flatGeom.getAttribute("position") as THREE.BufferAttribute
  const flatIndexAttr = flatGeom.getIndex()
  
  if (!flatPosAttr || !flatIndexAttr) {
    console.error("[v0-solid] EXTRUDE: flatGeom missing position or index attributes")
    return {
      geometry: flatGeom,
      geometryNoHoles: flatGeom,
      stats: successStats,
      stages: emptyStages,
      diagnostics: {
        ...diagnostics,
        geometryType: "FLAT",
        contourRejectReason: "extrusion: flatGeom missing attributes"
      }
    }
  }
  
  const flatPos = flatPosAttr.array as Float32Array
  const flatIdx = flatIndexAttr.array as ArrayLike<number>
  const flatVertCount = flatPosAttr.count
  const flatTriCount = flatIdx.length / 3
  
  // ----- 2. WALL SEGMENT COUNT (validated outer loop = shapePts, already CCW) -----
  let wallSegmentCount = 0
  let skippedWallSegments = 0
  const n = shapePts.length
  for (let i = 0; i < n; i++) {
    const a = shapePts[i]
    const b = shapePts[(i + 1) % n]
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.sqrt(dx * dx + dy * dy) < WALL_EPSILON) {
      skippedWallSegments++
    } else {
      wallSegmentCount++
    }
  }
  
  // ----- 3. ALLOCATE MERGED BUFFERS -----
  // Front cap: flatVertCount verts, flatTriCount tris
  // Back cap:  flatVertCount verts, flatTriCount tris (winding reversed)
  // Walls:     wallSegmentCount * 4 verts, wallSegmentCount * 2 tris
  const totalVerts = flatVertCount * 2 + wallSegmentCount * 4
  const totalTris = flatTriCount * 2 + wallSegmentCount * 2
  
  const positions = new Float32Array(totalVerts * 3)
  const indices = new Uint32Array(totalTris * 3)
  
  let vOff = 0      // vertex write offset (in vertex units, multiply by 3 for float offset)
  let iOff = 0      // index write offset (in index units)
  
  // ----- 4. WRITE FRONT CAP -----
  // Verts: copy flat positions, lift to z = +halfDepth
  // Indices: copy as-is (CCW viewed from +Z gives outward normal +Z)
  const frontCapBaseVert = vOff
  for (let v = 0; v < flatVertCount; v++) {
    positions[(vOff + v) * 3 + 0] = flatPos[v * 3 + 0]
    positions[(vOff + v) * 3 + 1] = flatPos[v * 3 + 1]
    positions[(vOff + v) * 3 + 2] = +halfDepth
  }
  vOff += flatVertCount
  
  for (let t = 0; t < flatTriCount; t++) {
    indices[iOff++] = frontCapBaseVert + flatIdx[t * 3 + 0]
    indices[iOff++] = frontCapBaseVert + flatIdx[t * 3 + 1]
    indices[iOff++] = frontCapBaseVert + flatIdx[t * 3 + 2]
  }
  const frontCapTriCount = flatTriCount
  
  // ----- 5. WRITE BACK CAP -----
  // Verts: same XY, z = -halfDepth
  // Indices: reverse winding so normals face -Z (outward for back cap)
  const backCapBaseVert = vOff
  for (let v = 0; v < flatVertCount; v++) {
    positions[(vOff + v) * 3 + 0] = flatPos[v * 3 + 0]
    positions[(vOff + v) * 3 + 1] = flatPos[v * 3 + 1]
    positions[(vOff + v) * 3 + 2] = -halfDepth
  }
  vOff += flatVertCount
  
  for (let t = 0; t < flatTriCount; t++) {
    // Reverse winding: (a, b, c) -> (a, c, b)
    indices[iOff++] = backCapBaseVert + flatIdx[t * 3 + 0]
    indices[iOff++] = backCapBaseVert + flatIdx[t * 3 + 2]
    indices[iOff++] = backCapBaseVert + flatIdx[t * 3 + 1]
  }
  const backCapTriCount = flatTriCount
  
  // ----- 6. WRITE WALL QUADS -----
  // For each consecutive pair (a, b) in the validated CCW outer loop, build:
  //   A = (a.x, a.y, +halfDepth)   front-curr
  //   B = (b.x, b.y, +halfDepth)   front-next
  //   C = (b.x, b.y, -halfDepth)   back-next
  //   D = (a.x, a.y, -halfDepth)   back-curr
  // Two triangles, consistent CCW winding when viewed from outside:
  //   (A, D, C) and (A, C, B)
  for (let i = 0; i < n; i++) {
    const a = shapePts[i]
    const b = shapePts[(i + 1) % n]
    const dx = b.x - a.x
    const dy = b.y - a.y
    if (Math.sqrt(dx * dx + dy * dy) < WALL_EPSILON) continue
    
    const A = vOff + 0
    const B = vOff + 1
    const C = vOff + 2
    const D = vOff + 3
    
    positions[A * 3 + 0] = a.x; positions[A * 3 + 1] = a.y; positions[A * 3 + 2] = +halfDepth
    positions[B * 3 + 0] = b.x; positions[B * 3 + 1] = b.y; positions[B * 3 + 2] = +halfDepth
    positions[C * 3 + 0] = b.x; positions[C * 3 + 1] = b.y; positions[C * 3 + 2] = -halfDepth
    positions[D * 3 + 0] = a.x; positions[D * 3 + 1] = a.y; positions[D * 3 + 2] = -halfDepth
    
    vOff += 4
    
    indices[iOff++] = A
    indices[iOff++] = D
    indices[iOff++] = C
    
    indices[iOff++] = A
    indices[iOff++] = C
    indices[iOff++] = B
  }
  
  // ----- 7. ASSEMBLE BUFFER GEOMETRY -----
  const extrudedGeom = new THREE.BufferGeometry()
  extrudedGeom.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  extrudedGeom.setIndex(new THREE.BufferAttribute(indices, 1))
  extrudedGeom.computeVertexNormals()
  
  console.log("[v0-solid] EXTRUDE_FROM_FLAT_BASE (REPLACED_MINIMAL):", {
    extrusionBuilder: "REPLACED_MINIMAL",
    frontCapTriCount,
    backCapTriCount,
    wallSegmentCount,
    skippedWallSegments,
    totalVerts,
    totalTris,
    depth: EXTRUDE_DEPTH
  })
  
  // Mirror extrusion debug fields into stages.solidDiagnostics for the panel
  if (emptyStages.solidDiagnostics) {
    emptyStages.solidDiagnostics.extrusionBuilder = "REPLACED_MINIMAL"
    emptyStages.solidDiagnostics.wallSegmentCount = wallSegmentCount
    emptyStages.solidDiagnostics.skippedWallSegments = skippedWallSegments
    emptyStages.solidDiagnostics.frontCapTriCount = frontCapTriCount
    emptyStages.solidDiagnostics.backCapTriCount = backCapTriCount
  }
  
  return {
    geometry: extrudedGeom,
    geometryNoHoles: extrudedGeom,
    stats: successStats,
    stages: emptyStages,
    diagnostics
  }
}

// ============= Stage 1: Render Stroke to Mask =============

interface RasterDebugInfo {
  rasterStageExecuted: "YES" | "NO"
  rasterInputSpace: string
  rasterCanvasWidth: number
  rasterCanvasHeight: number
  rasterMaskWidth: number
  rasterMaskHeight: number
  rasterThicknessPx: number
  rasterStrokeBoundsX: string
  rasterStrokeBoundsY: string
  filledPixels: number
  rasterRejected: "YES" | "NO"
  rasterRejectReason: string
}

// Cached raster canvas + context (see renderStrokeToMask). One per module —
// buildMaskSolid is synchronous, so there is no concurrent use.
let _rasterCanvas: HTMLCanvasElement | null = null
let _rasterCtx: CanvasRenderingContext2D | null = null

function getRasterCtx(width: number, height: number): CanvasRenderingContext2D {
  if (!_rasterCanvas || !_rasterCtx) {
    _rasterCanvas = document.createElement("canvas")
    _rasterCanvas.width = width
    _rasterCanvas.height = height
    _rasterCtx = _rasterCanvas.getContext("2d", { willReadFrequently: true })!
  } else if (_rasterCanvas.width !== width || _rasterCanvas.height !== height) {
    _rasterCanvas.width = width
    _rasterCanvas.height = height
  }
  return _rasterCtx
}

function renderStrokeToMask(
  points: Point2D[],
  thickness: number,
  canvasWidth: number,
  canvasHeight: number,
  resolution: number = MASK_RESOLUTION
): { mask: boolean[], width: number, height: number, filledCount: number, rasterDebug: RasterDebugInfo } {
  const width = resolution
  const height = Math.round(resolution * (canvasHeight / canvasWidth))
  
  // Initialize raster debug info
  const rasterDebug: RasterDebugInfo = {
    rasterStageExecuted: "YES",
    rasterInputSpace: "WORLD",
    rasterCanvasWidth: canvasWidth,
    rasterCanvasHeight: canvasHeight,
    rasterMaskWidth: width,
    rasterMaskHeight: height,
    rasterThicknessPx: 0,
    rasterStrokeBoundsX: "",
    rasterStrokeBoundsY: "",
    filledPixels: 0,
    rasterRejected: "NO",
    rasterRejectReason: ""
  }
  
  // ========== COORDINATE SPACE DETECTION ==========
  // Input points come from geometry-engines.ts strokesToTestStroke() which converts
  // canvas pixel coords (0 to canvasWidth) to world coords (roughly -1.5 to +1.5).
  // The conversion is: worldX = (pixelX - canvasWidth/2) * (3 / max(canvasWidth, canvasHeight))
  //
  // We need to reverse this to get mask coordinates:
  // maskX = (worldX / worldScale + canvasWidth/2) * (maskWidth / canvasWidth)
  // where worldScale = 3 / max(canvasWidth, canvasHeight)
  
  const worldScale = 3.0 / Math.max(canvasWidth, canvasHeight)
  
  // Compute stroke bounds in world space
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of points) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  
  rasterDebug.rasterStrokeBoundsX = `${minX.toFixed(3)} to ${maxX.toFixed(3)}`
  rasterDebug.rasterStrokeBoundsY = `${minY.toFixed(3)} to ${maxY.toFixed(3)}`
  
  // Convert world coords to mask coords
  // World -> Canvas pixel: pixelX = worldX / worldScale + canvasWidth/2
  // Canvas pixel -> Mask: maskX = pixelX * (maskWidth / canvasWidth)
  // Combined: maskX = (worldX / worldScale + canvasWidth/2) * (maskWidth / canvasWidth)
  //         = worldX * (maskWidth / (canvasWidth * worldScale)) + maskWidth/2
  
  const toMaskX = (worldX: number) => {
    const pixelX = worldX / worldScale + canvasWidth / 2
    return pixelX * (width / canvasWidth)
  }
  
  const toMaskY = (worldY: number) => {
    // Note: world Y is flipped (negative = down), but canvas Y is normal (positive = down)
    // World -> Canvas pixel: pixelY = -worldY / worldScale + canvasHeight/2
    const pixelY = -worldY / worldScale + canvasHeight / 2
    return pixelY * (height / canvasHeight)
  }
  
  // Convert thickness from world units to mask pixels
  // thickness in world units * (maskWidth / canvasWidth) / worldScale
  const thicknessPx = thickness / worldScale * (width / canvasWidth)
  rasterDebug.rasterThicknessPx = thicknessPx
  
  // Reuse a single offscreen canvas across calls (this runs per rAF tick
  // during draw-in, twice per tick when counter-detection re-rasters).
  // willReadFrequently keeps the canvas on the CPU so getImageData is not a
  // GPU readback stall every frame.
  const ctx = getRasterCtx(width, height)
  
  // Clear to black (background)
  ctx.fillStyle = "black"
  ctx.fillRect(0, 0, width, height)
  
  // Draw stroke in white (foreground)
  ctx.strokeStyle = "white"
  ctx.lineWidth = Math.max(1, thicknessPx) // Ensure at least 1px
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  
  ctx.beginPath()
  for (let i = 0; i < points.length; i++) {
    const mx = toMaskX(points[i].x)
    const my = toMaskY(points[i].y)
    
    if (i === 0) {
      ctx.moveTo(mx, my)
    } else {
      ctx.lineTo(mx, my)
    }
  }
  ctx.stroke()
  
  // Read pixel data
  const imageData = ctx.getImageData(0, 0, width, height)
  const pixels = imageData.data
  const mask: boolean[] = new Array(width * height)
  let filledCount = 0
  
  for (let i = 0; i < width * height; i++) {
    const isFilled = pixels[i * 4] > 127
    mask[i] = isFilled
    if (isFilled) filledCount++
  }
  
  rasterDebug.filledPixels = filledCount
  
  if (filledCount === 0) {
    rasterDebug.rasterRejected = "YES"
    rasterDebug.rasterRejectReason = `stroke bounds (${rasterDebug.rasterStrokeBoundsX}, ${rasterDebug.rasterStrokeBoundsY}) may be outside mask`
  }
  
  if (!QUIET) console.log("[v0-solid] RASTER DEBUG:", rasterDebug)
  
  return { mask, width, height, filledCount, rasterDebug }
}

// ============= Stage 2: Connected Component Labeling =============

function labelConnectedComponents(
  mask: boolean[],
  width: number,
  height: number
): { labels: number[], componentCount: number, componentSizes: number[] } {
  const labels = new Array(width * height).fill(0)
  const componentSizes: number[] = [0]
  let componentCount = 0
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (mask[idx] && labels[idx] === 0) {
        componentCount++
        let size = 0
        
        const queue: number[] = [idx]
        labels[idx] = componentCount
        let head = 0

        while (head < queue.length) {
          const ci = queue[head++]
          size++
          const cx = ci % width
          const cy = Math.floor(ci / width)
          
          const neighbors = [
            cy > 0 ? ci - width : -1,
            cy < height - 1 ? ci + width : -1,
            cx > 0 ? ci - 1 : -1,
            cx < width - 1 ? ci + 1 : -1
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

// ============= Stage 3: Boundary Edge Extraction and Chaining =============

interface BoundaryEdge {
  x1: number
  y1: number
  x2: number
  y2: number
}

function extractBoundaryEdges(mask: boolean[], width: number, height: number): BoundaryEdge[] {
  const edges: BoundaryEdge[] = []
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (!mask[idx]) continue
      
      // Top edge
      if (y === 0 || !mask[(y - 1) * width + x]) {
        edges.push({ x1: x, y1: y, x2: x + 1, y2: y })
      }
      
      // Bottom edge (reversed for CCW)
      if (y === height - 1 || !mask[(y + 1) * width + x]) {
        edges.push({ x1: x + 1, y1: y + 1, x2: x, y2: y + 1 })
      }
      
      // Left edge (reversed for CCW)
      if (x === 0 || !mask[y * width + (x - 1)]) {
        edges.push({ x1: x, y1: y + 1, x2: x, y2: y })
      }
      
      // Right edge
      if (x === width - 1 || !mask[y * width + (x + 1)]) {
        edges.push({ x1: x + 1, y1: y, x2: x + 1, y2: y + 1 })
      }
    }
  }
  
  return edges
}

function chainBoundaryEdges(edges: BoundaryEdge[]): Point2D[] {
  if (edges.length === 0) return []
  
  const endpointKey = (x: number, y: number) => `${x},${y}`
  const edgesByStart = new Map<string, BoundaryEdge[]>()
  
  for (const edge of edges) {
    const key = endpointKey(edge.x1, edge.y1)
    if (!edgesByStart.has(key)) edgesByStart.set(key, [])
    edgesByStart.get(key)!.push(edge)
  }
  
  const used = new Set<BoundaryEdge>()
  const loops: Point2D[][] = []
  
  for (const edge of edges) {
    if (used.has(edge)) continue
    
    const loop: Point2D[] = []
    let current: BoundaryEdge | undefined = edge
    const startKey = endpointKey(edge.x1, edge.y1)
    
    while (current && !used.has(current)) {
      used.add(current)
      loop.push({ x: current.x1, y: current.y1 })
      
      const nextKey = endpointKey(current.x2, current.y2)
      
      if (nextKey === startKey && loop.length > 2) {
        break
      }
      
      const candidates = edgesByStart.get(nextKey)
      if (!candidates) break
      
      current = undefined
      for (const cand of candidates) {
        if (!used.has(cand)) {
          current = cand
          break
        }
      }
    }
    
    if (loop.length >= 3) {
      loops.push(loop)
    }
  }
  
  if (loops.length === 0) return []
  
  let longest = loops[0]
  for (const loop of loops) {
    if (loop.length > longest.length) {
      longest = loop
    }
  }
  
  return longest
}

function traceOuterContour(mask: boolean[], width: number, height: number): Point2D[] {
  const edges = extractBoundaryEdges(mask, width, height)
  if (edges.length === 0) return []
  return chainBoundaryEdges(edges)
}

// H2 helper: collect ALL boundary loops, return the one with the largest
// enclosed (mask-space) area. Defends against pinch-point vertex-sharing
// bugs in chainBoundaryEdges that could split a single hole's boundary into
// multiple sub-loops and previously made us pick "longest" (which is not
// always the same as "the real outer of the empty region").
function traceLargestAreaContour(
  mask: boolean[],
  width: number,
  height: number
): Point2D[] {
  const edges = extractBoundaryEdges(mask, width, height)
  if (edges.length === 0) return []
  const loops = chainAllLoops(edges)
  if (loops.length === 0) return []
  
  let bestLoop = loops[0]
  let bestAbsArea = absShoelace(loops[0])
  for (let i = 1; i < loops.length; i++) {
    const a = absShoelace(loops[i])
    if (a > bestAbsArea) {
      bestAbsArea = a
      bestLoop = loops[i]
    }
  }
  return bestLoop
}

// Variant of chainBoundaryEdges that returns ALL loops, not just the
// longest one. Used by traceLargestAreaContour to keep small loops alive
// for subsequent area-based selection.
function chainAllLoops(edges: BoundaryEdge[]): Point2D[][] {
  if (edges.length === 0) return []
  
  const endpointKey = (x: number, y: number) => `${x},${y}`
  const edgesByStart = new Map<string, BoundaryEdge[]>()
  for (const edge of edges) {
    const key = endpointKey(edge.x1, edge.y1)
    if (!edgesByStart.has(key)) edgesByStart.set(key, [])
    edgesByStart.get(key)!.push(edge)
  }
  
  const used = new Set<BoundaryEdge>()
  const loops: Point2D[][] = []
  
  for (const startEdge of edges) {
    if (used.has(startEdge)) continue
    
    const loop: Point2D[] = []
    let current: BoundaryEdge | undefined = startEdge
    const startKey = endpointKey(startEdge.x1, startEdge.y1)
    
    while (current && !used.has(current)) {
      used.add(current)
      loop.push({ x: current.x1, y: current.y1 })
      
      const nextKey = endpointKey(current.x2, current.y2)
      if (nextKey === startKey && loop.length > 2) break
      
      const candidates = edgesByStart.get(nextKey)
      if (!candidates) break
      
      current = undefined
      for (const cand of candidates) {
        if (!used.has(cand)) {
          current = cand
          break
        }
      }
    }
    
    if (loop.length >= 3) loops.push(loop)
  }
  
  return loops
}

function absShoelace(loop: Point2D[]): number {
  let s = 0
  for (let i = 0; i < loop.length; i++) {
    const p1 = loop[i]
    const p2 = loop[(i + 1) % loop.length]
    s += p1.x * p2.y - p2.x * p1.y
  }
  return Math.abs(s) / 2
}

// H2 helper: triangle count from an indexed BufferGeometry.
function flatIndexCount(geom: THREE.BufferGeometry): number {
  const idx = geom.getIndex()
  return idx ? idx.count / 3 : 0
}

// H2 helper: ray-casting point-in-polygon test in mask space.
// Used by counter-preserving detection to verify that each candidate hole
// borrowed from the thinner counter mask actually lies inside the actual
// outer contour (defense-in-depth alongside the topological invariant).
function pointInPolygonMask(px: number, py: number, poly: Point2D[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x
    const yi = poly[i].y
    const xj = poly[j].x
    const yj = poly[j].y
    const denom = yj - yi
    if (denom === 0) continue
    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / denom + xi
    if (intersect) inside = !inside
  }
  return inside
}

// Small-counter viability helper: examines the SMALLEST valid H1 hole.
// H2-side ("usedByH2") defaults to "NO" when there are valid holes — the H2
// branch flips it to "YES" if the smallest's labelId is among the holes that
// actually got attached to shape.holes.
function computeSmallestValidHoleViability(h: {
  validHoleCount: number
  holeAreas: number[]
  validHoleBboxes: Array<{ w: number; h: number }>
}): {
  smallestValidHoleArea: number
  smallestValidHoleBboxW: number
  smallestValidHoleBboxH: number
  smallestValidHoleAreaToBboxRatio: number
  smallestValidHoleUsedByH2: "YES" | "NO" | "N/A"
} {
  if (h.validHoleCount === 0 || h.holeAreas.length === 0) {
    return {
      smallestValidHoleArea: 0,
      smallestValidHoleBboxW: 0,
      smallestValidHoleBboxH: 0,
      smallestValidHoleAreaToBboxRatio: 0,
      smallestValidHoleUsedByH2: "N/A",
    }
  }
  // holeAreas/validHoleBboxes are sorted descending by area, so smallest is last.
  const lastIdx = h.holeAreas.length - 1
  const area = h.holeAreas[lastIdx] ?? 0
  const bbox = h.validHoleBboxes[lastIdx] ?? { w: 0, h: 0 }
  const bboxArea = bbox.w * bbox.h
  const ratio = bboxArea > 0 ? area / bboxArea : 0
  return {
    smallestValidHoleArea: area,
    smallestValidHoleBboxW: bbox.w,
    smallestValidHoleBboxH: bbox.h,
    smallestValidHoleAreaToBboxRatio: ratio,
    smallestValidHoleUsedByH2: "NO",
  }
}

// H2 helper: signed area of a Vector2 polygon (world space).
function signedAreaOf(pts: THREE.Vector2[]): number {
  let s = 0
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i]
    const p2 = pts[(i + 1) % pts.length]
    s += p1.x * p2.y - p2.x * p1.y
  }
  return s / 2
}

// H2 helper: drop consecutive-duplicate vertices and collinear-run mid-points.
// A pixel-edge boundary loop has many collinear "fence-post" vertices along
// each axis-aligned run; reducing them to corner points yields a cleaner
// polygon for earcut and avoids it producing zero-area triangles that some
// triangulators silently skip.
function simplifyCollinearAndDuplicates(
  pts: THREE.Vector2[],
  eps: number
): THREE.Vector2[] {
  if (pts.length < 3) return pts.slice()
  
  // Pass 1: drop consecutive duplicates (including wrap-around).
  const dedup: THREE.Vector2[] = []
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const prev = dedup[dedup.length - 1]
    if (!prev || Math.abs(prev.x - p.x) > eps || Math.abs(prev.y - p.y) > eps) {
      dedup.push(p)
    }
  }
  if (dedup.length > 1) {
    const first = dedup[0]
    const last = dedup[dedup.length - 1]
    if (Math.abs(first.x - last.x) <= eps && Math.abs(first.y - last.y) <= eps) {
      dedup.pop()
    }
  }
  if (dedup.length < 3) return dedup
  
  // Pass 2: drop the middle vertex of any 3 collinear consecutive vertices.
  // Cross product of (p1->p2) x (p2->p3) being ~0 means collinear.
  const out: THREE.Vector2[] = []
  const n = dedup.length
  for (let i = 0; i < n; i++) {
    const p1 = dedup[(i - 1 + n) % n]
    const p2 = dedup[i]
    const p3 = dedup[(i + 1) % n]
    const ax = p2.x - p1.x, ay = p2.y - p1.y
    const bx = p3.x - p2.x, by = p3.y - p2.y
    const cross = ax * by - ay * bx
    if (Math.abs(cross) > eps) out.push(p2)
  }
  return out.length >= 3 ? out : dedup
}

// ============= H1: Interior Hole Detection (DIAGNOSTIC ONLY) =============
//
// Detects empty regions fully enclosed by the selected filled component.
// Strategy: flood-fill the *inverted* component mask. Any connected empty
// region that DOES NOT touch the image border is "interior" and is therefore
// fully enclosed by the filled component (a hole candidate).
//
// IMPORTANT: This function MUST NOT modify geometry. It only returns counts,
// areas, and reject reasons for the debug panel. The existing extrusion path
// (caps, walls, THREE.Shape) consumes only the validated outer contour and
// is unaffected by anything this function returns.

interface HoleDetectionResult {
  detectedHoleCount: number       // total interior empty components found (pre-filter)
  validHoleCount: number          // components passing conservative filters
  rejectedHoleCount: number       // detected - valid
  largestHoleArea: number         // largest valid hole's area in mask pixels (0 if none)
  holeAreas: number[]             // valid hole areas, descending
  holeRejectReasons: string[]     // one reason per rejected interior candidate
  // Extra diagnostics (so we can tell "rejected by threshold" from
  // "leaked to border" from "didn't even exist as an empty region"):
  borderTouchingEmptyCount: number  // empty regions that touched the image border
  rejectedHoleAreas: number[]       // mask-pixel area of each rejected interior candidate
  // H2 additions: enable per-hole contour tracing on the same component labels.
  // emptyLabels[i] is the empty-region label of pixel i (0 = unset/filled).
  // validHoleLabelIds[k] is the labelId for the k-th entry in holeAreas (descending area).
  emptyLabels: Int32Array
  validHoleLabelIds: number[]
  // Mask-space bbox (w,h) per valid hole, parallel to holeAreas/validHoleLabelIds.
  // Used for the small-counter viability diagnostic.
  validHoleBboxes: Array<{ w: number; h: number }>
}

// Conservative thresholds. Goal is reliable detection, not final modeling.
// Tuned against the test cases listed in the H1 spec: open shapes -> 0 holes,
// big O / donut -> >= 1 hole, no bogus tiny holes from rasterization noise.
const HOLE_MIN_AREA_PX = 30          // absolute minimum component area in mask pixels
const HOLE_MIN_BBOX_PX = 4           // minimum bbox width AND height in mask pixels
const HOLE_MIN_AREA_RATIO = 0.20     // area / (bbox.w * bbox.h) - rejects slivers
// Outer-frame guard: even though border-touching components are filtered out,
// require holes to be at least this many pixels inside the mask edge.
// This adds a thin safety margin against components that touch the border
// only diagonally (which 4-connectivity would not classify as touching).
const HOLE_MIN_BORDER_INSET_PX = 1

function detectInteriorHoles(
  componentMask: boolean[],
  width: number,
  height: number,
  /**
   * Resolution scale relative to MASK_RESOLUTION (1 for static/export builds,
   * <1 for reduced-resolution animated builds). Pixel-count thresholds scale
   * with it (area by resScale^2, lengths by resScale) so hole-topology
   * decisions are resolution-independent.
   */
  resScale: number = 1,
): HoleDetectionResult {
  const minAreaPx = Math.max(4, Math.round(HOLE_MIN_AREA_PX * resScale * resScale))
  const minBboxPx = Math.max(2, Math.round(HOLE_MIN_BBOX_PX * resScale))
  const emptyLabels = new Int32Array(width * height)
  
  interface RawComponent {
    labelId: number
    size: number
    touchesBorder: boolean
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
  
  const rawComponents: RawComponent[] = []
  let labelCounter = 0
  
  // Flood-fill (4-connected) over the *empty* pixels.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      if (componentMask[idx] || emptyLabels[idx] !== 0) continue
      
      labelCounter++
      let size = 0
      let touchesBorder = false
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      
      const queue: number[] = [idx]
      emptyLabels[idx] = labelCounter
      let head = 0

      while (head < queue.length) {
        const ci = queue[head++]
        size++
        const cx = ci % width
        const cy = (ci - cx) / width
        
        if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) {
          touchesBorder = true
        }
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy
        
        // 4-neighbours
        if (cy > 0) {
          const ni = ci - width
          if (!componentMask[ni] && emptyLabels[ni] === 0) {
            emptyLabels[ni] = labelCounter
            queue.push(ni)
          }
        }
        if (cy < height - 1) {
          const ni = ci + width
          if (!componentMask[ni] && emptyLabels[ni] === 0) {
            emptyLabels[ni] = labelCounter
            queue.push(ni)
          }
        }
        if (cx > 0) {
          const ni = ci - 1
          if (!componentMask[ni] && emptyLabels[ni] === 0) {
            emptyLabels[ni] = labelCounter
            queue.push(ni)
          }
        }
        if (cx < width - 1) {
          const ni = ci + 1
          if (!componentMask[ni] && emptyLabels[ni] === 0) {
            emptyLabels[ni] = labelCounter
            queue.push(ni)
          }
        }
      }
      
      rawComponents.push({ labelId: labelCounter, size, touchesBorder, minX, minY, maxX, maxY })
    }
  }
  
  // Detected = empty components that do NOT touch the image border.
  // Anything touching the border is "outside background" and is not a hole.
  const detected = rawComponents.filter((c) => !c.touchesBorder)
  const borderTouchingEmptyCount = rawComponents.length - detected.length
  
  // Conservative filtering pass.
  // Track (area, labelId, bw, bh) so we can sort and return per-hole bboxes.
  const validPairs: Array<{ area: number; labelId: number; bw: number; bh: number }> = []
  const rejectReasons: string[] = []
  const rejectedHoleAreas: number[] = []
  
  for (const c of detected) {
    const bw = c.maxX - c.minX + 1
    const bh = c.maxY - c.minY + 1
    const bboxArea = bw * bh
    const ratio = bboxArea > 0 ? c.size / bboxArea : 0
    const insetOk =
      c.minX >= HOLE_MIN_BORDER_INSET_PX &&
      c.minY >= HOLE_MIN_BORDER_INSET_PX &&
      c.maxX <= width - 1 - HOLE_MIN_BORDER_INSET_PX &&
      c.maxY <= height - 1 - HOLE_MIN_BORDER_INSET_PX
    
    if (c.size < minAreaPx) {
      rejectReasons.push(`area=${c.size}<${minAreaPx}`)
      rejectedHoleAreas.push(c.size)
    } else if (bw < minBboxPx || bh < minBboxPx) {
      rejectReasons.push(`bbox=${bw}x${bh}<${minBboxPx}(area=${c.size})`)
      rejectedHoleAreas.push(c.size)
    } else if (ratio < HOLE_MIN_AREA_RATIO) {
      rejectReasons.push(`ratio=${ratio.toFixed(2)}<${HOLE_MIN_AREA_RATIO}(area=${c.size})`)
      rejectedHoleAreas.push(c.size)
    } else if (!insetOk) {
      rejectReasons.push(`borderInset<${HOLE_MIN_BORDER_INSET_PX}(area=${c.size})`)
      rejectedHoleAreas.push(c.size)
    } else {
      validPairs.push({ area: c.size, labelId: c.labelId, bw, bh })
    }
  }
  
  validPairs.sort((a, b) => b.area - a.area)
  rejectedHoleAreas.sort((a, b) => b - a)
  const validAreas = validPairs.map((p) => p.area)
  const validHoleLabelIds = validPairs.map((p) => p.labelId)
  const validHoleBboxes = validPairs.map((p) => ({ w: p.bw, h: p.bh }))
  
  return {
    detectedHoleCount: detected.length,
    validHoleCount: validAreas.length,
    rejectedHoleCount: detected.length - validAreas.length,
    largestHoleArea: validAreas[0] ?? 0,
    holeAreas: validAreas,
    holeRejectReasons: rejectReasons,
    borderTouchingEmptyCount,
    rejectedHoleAreas,
    emptyLabels,
    validHoleLabelIds,
    validHoleBboxes,
  }
}

// ============= Utility: Self-Intersection Check =============

function contourSelfIntersects(contour: Point2D[]): boolean {
  const n = contour.length
  if (n < 4) return false
  
  for (let i = 0; i < n - 2; i++) {
    for (let j = i + 2; j < n; j++) {
      if (j === n - 1 && i === 0) continue
      if (segmentsIntersect(contour[i], contour[i + 1], contour[j], contour[(j + 1) % n])) {
        return true
      }
    }
  }
  return false
}

function segmentsIntersect(p1: Point2D, p2: Point2D, p3: Point2D, p4: Point2D): boolean {
  const d1 = (p3.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p3.y - p1.y)
  const d2 = (p4.x - p1.x) * (p2.y - p1.y) - (p2.x - p1.x) * (p4.y - p1.y)
  const d3 = (p1.x - p3.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p1.y - p3.y)
  const d4 = (p2.x - p3.x) * (p4.y - p3.y) - (p4.x - p3.x) * (p2.y - p3.y)
  
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) {
    return true
  }
  return false
}
