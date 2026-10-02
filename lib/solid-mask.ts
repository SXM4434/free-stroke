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
// Desk Doodles' bevel profile, world-scale-converted. Its own comment says the
// profile is "Shared by Extrude + Solid"; this is the Solid consumer that
// docs/research/extrude-solid-quality.md §7 recorded as "not written".
import { EXTRUDE_BEVEL_PROFILES_FS } from "./dd-extrude-relief"

/**
 * Solid's parked prior behaviours, reachable by name.
 *
 * `capFit` — which loops the front/back cap is TRIANGULATED on. The cap is
 * DRAWN at ring 0, i.e. the contour inset by the bevel's XY offset:
 *
 *   "inset"  (default) triangulate the inset loops — the ones the cap is drawn
 *            at, so the triangulation is valid for the polygon it describes.
 *   "source" the behaviour before 2026-07-31: triangulate the ORIGINAL contour
 *            and draw those triangles at the inset positions. On a thin form the
 *            offset narrows the outline underneath a chord earcut was entitled
 *            to emit, and the cap crosses itself — 198 overlapping triangle
 *            pairs on `circle`, 53 fold-census rays. PARKED, not deleted, and
 *            exercised: `scripts/verify/assert-cap-fit.mjs` requires it to fire.
 *
 * A mutable module object rather than a build parameter because it selects
 * between a defect and its fix rather than between two looks — the geometry the
 * two produce is the same region with the same silhouette and the same normals.
 */
export const SOLID_TUNING: {
  capFit: "inset" | "source"
  /**
   * How `h3BevelAchievedFrac` is computed. `"offset"` ships and is the honest
   * one — the perpendicular distance the offset line moved, as a fraction of
   * the one requested. `"miter"` is the PARKED PRIOR formula, which summed the
   * miter VECTORS and therefore reported √2 at a right angle for a bevel that
   * achieved exactly 1.0. It is the negative control for
   * `scripts/verify/assert-param-guards.mjs`.
   */
  bevelFrac: "offset" | "miter"
  /**
   * HOW DEEP THE OFFSET GUARD TRUSTS THE BINARY MASK.
   *
   *   "raster"  (default) the depth the raster can actually answer —
   *             `OFFSET_PROBE_BLIND_CELLS`, derived and measured there.
   *   "onecell" the PARKED PRIOR: one cell. On `openArc/solid` it told 22 of 497
   *             contour vertices "not material" 1.0-1.6 cells inside a band 17.9
   *             cells thick, dropped them to the bottom of the ladder, and left
   *             `mixed max 84.73` with 120 edges past 45 degrees on a fixture
   *             with no drawn corner anywhere.
   */
  probeBlind: "raster" | "onecell"
  /**
   * HOW THE EDGE-FLIP REPAIR SCALES A FOLDED OFFSET BACK.
   *
   *   "exact"  (default) one linear solve for the largest common scale that
   *            leaves the offset edge with `OFFSET_FLIP_KEEP` of its original
   *            projected length.
   *   "halve"  the PARKED PRIOR: multiply both endpoints by 0.5, up to three
   *            passes, regardless of how far the edge had reversed — so a vertex
   *            could land on 1/8 beside a neighbour on 1/1, and three passes
   *            could run out with the fold still there.
   */
  flipRepair: "exact" | "halve"
  /**
   * WHETHER THE BEVEL'S Z DROP FOLLOWS THE OFFSET IT ACHIEVED.
   *
   *   "scaled" (default) it does, so the band's slope is the designed one at
   *            every vertex and a clamped vertex gets a smaller round of the
   *            same shape.
   *   "flat"   the PARKED PRIOR: a per-ring constant. A vertex at a fifth of the
   *            requested offset still dropped the full height, which is a
   *            65.9-degree cliff welded into an otherwise 15-degree rim.
   */
  rimProfile: "scaled" | "flat"
} = {
  capFit: "inset",
  bevelFrac: "offset",
  probeBlind: "raster",
  flipRepair: "exact",
  rimProfile: "scaled",
}

// ============= Types =============

export interface Point2D {
  x: number
  y: number
}

export interface TestStroke {
  points: Point2D[]
  /**
   * SUBPATH STARTS — indices into `points` at which a NEW stroke begins.
   *
   * `points` is the whole drawing's strokes concatenated (Solid is a pool
   * operation: every stroke fuses into one mass). Concatenation alone is
   * ambiguous — nothing in a flat array says where one stroke ended and the
   * next began, and the rasterizer used to assume there was only ever one, so
   * it drew the entire array as a single Canvas2D path: `moveTo` at index 0,
   * `lineTo` for everything after. Every stroke boundary therefore became a
   * full-thickness straight bar from the end of one stroke to the start of the
   * next, welded into the mask before any of the contour work ran. On a word
   * that is a phantom zigzag joining the letters ("hello" built as "heMo").
   *
   * Union between strokes is supposed to happen in the RASTER — two strokes
   * merge because they set the same cells — not by connecting their endpoints.
   * PROVENANCE for the model: desk-doodles
   * `src/app/lib/geometry3d/strokeTo3d.ts` `rasterizePoolLoops` (~line 1640),
   * which loops over the pool and stamps each stroke into the shared grid
   * independently.
   *
   * Optional and defaults to `[0]` so a legitimate single-polyline caller
   * (the smoke fixtures) is byte-identical to before.
   */
  subpathStarts?: number[]
  /**
   * F118, TRUE ARC OF A CUT PIECE, world units, parallel to `subpathStarts`.
   * Set only for a piece the reveal clip cut out of a longer stroke; absent for
   * every whole stroke, so a real dot or tap still gets its full round cap.
   * A cut piece shorter than the line width is stroked at a width equal to its
   * own arc, so it grows from nothing instead of landing as a full capsule.
   */
  subpathArc?: (number | undefined)[]
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
  h3RimSmoothJunctions?: number                   // rim junctions whose wall verts are SHARED (smooth)
  h3RimHardJunctions?: number                     // rim junctions kept split (turn > crease angle)
  // ---- H3 rim bevel (the inward offset — see insetLoopAgainstMask) ----
  // A silently un-bevelled rim is indistinguishable from a bevelled one in every
  // other number this build reports, which is why these exist.
  h3BevelStatus?: "ROLLED" | "CUT_CAP_NOT_MAPPABLE" | "CUT_DISABLED"
  h3BevelSizeWorld?: number                       // XY offset actually requested
  h3BevelThicknessWorld?: number                  // Z drop actually used (clamped by halfDepth)
  h3BevelSegments?: number                        // rings per bevel band
  h3BevelAchievedFrac?: number                    // mean achieved offset / requested, over all loops
  h3BevelStarvedVerts?: number                    // verts that got under 25% (form locally too thin)
  h3BevelFlipsRepaired?: number                   // offset edges that folded and were halved
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
  /** Binary mask, 1 = filled. Uint8Array (row-major, width*height) — typed for
   *  per-rAF animated rebuild performance. Truthiness-indexed consumers
   *  (debug overlay) are unaffected. */
  maskData: Uint8Array
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
    h3RimSmoothJunctions?: number
    h3RimHardJunctions?: number
    // H3 rim bevel — see insetLoopAgainstMask
    h3BevelStatus?: "ROLLED" | "CUT_CAP_NOT_MAPPABLE" | "CUT_DISABLED"
    h3BevelSizeWorld?: number
    h3BevelThicknessWorld?: number
    h3BevelSegments?: number
    h3BevelAchievedFrac?: number
    h3BevelStarvedVerts?: number
    h3BevelFlipsRepaired?: number
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

/**
 * Contour-smoothing witness.
 *
 * `smoothLatticeLoop` has two guards that fall back to the RAW lattice loop —
 * the maximally-faceted output — and both used to do it silently, so a rim that
 * reverted to the staircase was indistinguishable from a rim that was smoothed.
 * This counts what actually happened inside the smoother rather than what the
 * caller intended, so an assertion can check that the fix RAN and not merely
 * that it was reached. Read from the page via `window.__contourSmoothDebug`.
 */
export const CONTOUR_SMOOTH_DEBUG = {
  smoothed: 0,
  areaFallbacks: 0,
  selfIntersectFallbacks: 0,
  lastInPoints: 0,
  lastDecimatedPoints: 0,
  lastOutPoints: 0,
  /** Decimation epsilon (cells) the accepted result was produced at. */
  lastEpsilonCells: 0,
  /** Ladder rungs rejected before one passed. 0 = the coarsest epsilon worked. */
  decimationRetries: 0,
  /** Why the last terminal fallback happened, for the debug overlay. */
  lastFallbackReason: "",
}
if (typeof globalThis !== "undefined") {
  ;(globalThis as unknown as Record<string, unknown>).__contourSmoothDebug = CONTOUR_SMOOTH_DEBUG
}

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
//   2. smoothLatticeLoop      — sub-cell snap onto the coverage isoline, then
//      Douglas-Peucker decimation, then corner-aware multi-pass Chaikin. That
//      ORDER is the fix (see docs/research/extrude-solid-quality.md §2):
//      decimating first collapses the staircase so Chaikin has real shape to
//      converge on instead of rippling every step.
//   3. Guards: smoothed loop must keep >=90% (and <=105%) of the exact loop's
//      area and must not self-intersect. A failure no longer abandons the loop
//      to the raw staircase — it steps DOWN the decimation ladder and tries
//      again (see CONTOUR_DECIMATE_EPSILON_LADDER). Topology (hole
//      presence/absence) is mask-derived and untouched either way.

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

/** |signed area| of a polygon. See `signedAreaOf` — this was a second copy of
 *  the same cross-form loop with an `abs` on the end. Same expression, same
 *  bits; only the sign is discarded. */
function shoelaceAbs(pts: Point2D[]): number {
  return Math.abs(signedAreaOf(pts))
}

// ── Sub-cell boundary placement (the upstream half of the staircase fix) ──
//
// The tracer walks the BINARY mask, so every contour vertex lands on an integer
// lattice corner and a diagonal edge arrives as a staircase. Everything
// downstream (decimate, smooth) is then reconstruction: trying to recover a
// sub-pixel boundary that was thrown away one stage earlier.
//
// It does not have to be thrown away. The mask is produced by Canvas2D with
// antialiasing ON, so `pixels[i*4]` is a real coverage value, and
// renderStrokeToMask reduced it to 0/1 with `> 127`. Keeping the coverage
// field lets us put each contour vertex where the 50%-coverage isoline
// actually crosses, instead of at the nearest lattice corner. This is the
// standard marching-squares refinement — linear interpolation of the scalar
// field along the cell edge rather than binary corner classification — and it
// removes the staircase at SOURCE rather than blurring it afterwards.
//
// Method: one Newton step onto the 127.5 isoline of the bilinearly-sampled
// coverage field, along its own gradient.
//
// SAFETY: the displacement is clamped to SUBCELL_MAX_SHIFT px. The mask always
// separates a hole boundary from the outer boundary by at least one filled
// pixel; two boundaries each moving 0.45 px toward each other close 0.9 px of
// that ≥1 px wall, so the snap can never fuse a hole into the outer or punch a
// new one. Topology stays mask-derived, exactly as before.
const SUBCELL_MAX_SHIFT = 0.45

/** Bilinear sample of the coverage field at a lattice-corner position. */
function sampleCoverage(cov: Uint8Array, w: number, h: number, x: number, y: number): number {
  const cx = Math.max(0, Math.min(w - 1.001, x - 0.5))
  const cy = Math.max(0, Math.min(h - 1.001, y - 0.5))
  const x0 = Math.floor(cx), y0 = Math.floor(cy)
  const fx = cx - x0, fy = cy - y0
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1)
  const c00 = cov[y0 * w + x0], c10 = cov[y0 * w + x1]
  const c01 = cov[y1 * w + x0], c11 = cov[y1 * w + x1]
  return (c00 * (1 - fx) + c10 * fx) * (1 - fy) + (c01 * (1 - fx) + c11 * fx) * fy
}

/**
 * Move each lattice vertex onto the 50%-coverage isoline. Run AFTER
 * simplifyCollinearMask: the exact collinear pass has already reduced a
 * staircase to its step corners, which are precisely the vertices that carry
 * the quantisation error, and skipping the straight runs keeps this cheap.
 */
function snapLoopToCoverage(loop: Point2D[], cov: Uint8Array, w: number, h: number): Point2D[] {
  const TARGET = 127.5
  const out: Point2D[] = new Array(loop.length)
  for (let i = 0; i < loop.length; i++) {
    const { x, y } = loop[i]
    const c = sampleCoverage(cov, w, h, x, y)
    // Central-difference gradient of the coverage field, in px^-1.
    const gx = (sampleCoverage(cov, w, h, x + 1, y) - sampleCoverage(cov, w, h, x - 1, y)) / 2
    const gy = (sampleCoverage(cov, w, h, x, y + 1) - sampleCoverage(cov, w, h, x, y - 1)) / 2
    const g2 = gx * gx + gy * gy
    // A flat neighbourhood carries no information about where the edge is
    // (interior, or a hairline thinner than the gradient stencil) — leave the
    // vertex on the lattice rather than inventing a displacement.
    if (g2 < 1e-6) { out[i] = { x, y }; continue }
    let dx = ((TARGET - c) * gx) / g2
    let dy = ((TARGET - c) * gy) / g2
    const d = Math.hypot(dx, dy)
    if (d > SUBCELL_MAX_SHIFT) { dx = (dx / d) * SUBCELL_MAX_SHIFT; dy = (dy / d) * SUBCELL_MAX_SHIFT }
    out[i] = { x: x + dx, y: y + dy }
  }
  return out
}

/* ------------------------------------------------------------------ */
/*  Inward polygon offset, clamped against the mask it came from      */
/* ------------------------------------------------------------------ */
/*
 * THIS EXISTS SO SOLID CAN HAVE A BEVEL. Until now it could not.
 *
 * `probeDihedral` on the `mixed` bucket — a cap face meeting a wall face — read
 * Extrude 15.4° mean / 30.1° max (the ported 3-segment rounded profile) against
 * Solid **90.0 mean, 90.0 max, on every edge of every fixture**. A spike, not a
 * distribution: the H3 assembly writes a cap at +halfDepth, a cap at −halfDepth
 * and a vertical wall between them, and there is no bevel construction anywhere
 * in it. Desk Doodles' own comment on `EXTRUDE_BEVEL_SIZE` says the profile is
 * "Shared by Extrude + Solid"; this repo ported the Extrude half, because DD gets
 * its Solid bevel free from `THREE.ExtrudeGeometry` and Free Stroke's H3
 * assembles caps and walls by hand (it has to — it carries hole walls,
 * preview/export parity and partial-reveal rebuilds).
 *
 * A bevel needs the one operation this pipeline had avoided: an INWARD OFFSET of
 * the traced contour. `docs/research/extrude-solid-quality.md` §7 sets out why
 * that is not a per-vertex bisector displacement on a handwriting silhouette —
 * the form is thin (a stem's half-width is a handful of mask cells, so an offset
 * that is a rounding error on a bowl is a large fraction of a stem, and an offset
 * past the local inradius INVERTS the polygon); the contour has concavities,
 * which is exactly where a naive offset self-intersects; and holes must offset
 * the other way, so a hole can grow into the outer contour and change topology.
 *
 * WHAT THIS DOES, and why it is safe. §7 recommends offsetting through the field
 * the contour was traced from, because an isoline of a scalar field cannot
 * self-intersect and, where the form is thinner than 2d, the isoline simply does
 * not exist so the bevel vanishes instead of inverting. This is that idea in the
 * form that keeps a 1:1 vertex correspondence with the original loop (which is
 * what makes the bevel band a plain quad strip and lets the cap keep its existing
 * triangulation and hole topology, byte for byte):
 *
 *   1. Displace each vertex along its exact MITER vector — the direction that
 *      lands it on both neighbouring offset lines — with a miter limit, so a
 *      needle-sharp corner cannot throw the vertex to infinity.
 *   2. CLAMP THE DISPLACEMENT AGAINST THE MASK. Probe a ring of points around
 *      the displaced position at the displacement radius; every one of them must
 *      be inside the material. That is a direct test of "is this point at least d
 *      inside the form", asked of the same raster the contour was traced from, so
 *      it needs no new field and no new library. Where the material is thinner
 *      than 2d the test fails at every rung and the vertex stops short — the
 *      bevel narrows to nothing locally, which is §7's required failure mode.
 *   3. Repair edge FLIPS. If an offset edge reverses direction relative to its
 *      original, the polygon folded there; halve both endpoints and re-check.
 *
 * The inward direction is the LEFT normal of the walk for BOTH loop types. That
 * is not a coincidence and it is the same fact the wall-winding note in the H3
 * assembly relies on: the outer loop is CCW and holes are CW precisely so that
 * right-perp always points out of the body, hence left-perp always points into
 * it. Holes therefore offset outward (into their own wall) with no special case.
 *
 * The failure mode is NOT "return the un-offset loop". A guard whose failure mode
 * is the worst available answer is worse than no guard — that is the lesson the
 * Solid staircase already taught this file. Failure here is per-vertex and
 * gradual: the offset shrinks toward zero exactly where it is unsafe, so the rim
 * degrades from a roll to a cut over a few vertices instead of the whole form
 * snapping back to a die-cut edge.
 */
const OFFSET_MITER_LIMIT = 2.0
/** Rungs of the per-vertex ladder, as fractions of the requested offset. */
const OFFSET_LADDER = [1.0, 0.66, 0.33, 0.12]
/**
 * Probe geometry, and WHY IT IS TWO TESTS RATHER THAN ONE.
 *
 * The first version asked only "is the disc of radius 0.9r around the offset
 * point entirely material" — a direct reading of "is this point at least r
 * inside". It is also, at this scale, a coin flip. The offset is
 * EXTRUDE_BEVEL_PROFILES_FS.rounded.size = 0.015 world, which on a 512-cell
 * raster spanning 3 world units is 2.6 CELLS. On a straight boundary the offset
 * point sits exactly r inside, so the disc's nearest sample sits 0.1r = 0.26 of
 * a cell inside, and rounding the sample to the nearest cell decides the answer.
 * Measured: `mixed max 90` survived on all four Solid fixtures after the bevel
 * was built, because a scatter of vertices all over otherwise-fat forms starved
 * to zero offset and each one left a 90° cap-to-wall crease behind. The bevel
 * was correct and the guard was noise.
 *
 * So the two tests ask the two things that actually matter, each at a radius the
 * raster can answer:
 *
 *   RAY — sample along the displacement itself. This is the thin-stem test: if
 *     the offset crosses the medial axis and comes out the far side, some sample
 *     on the ray is outside. It is exact regardless of r, because it does not
 *     depend on measuring a margin.
 *   RING at 0.5r — margin, so the offset point is not merely inside but
 *     comfortably inside. Half a radius is ~1.3 cells at the shipped bevel size,
 *     which the raster CAN resolve.
 *
 * A stem of local half-width w therefore keeps a bevel of about min(size, w):
 * the ladder steps down until the ray stays inside, and at r ~ w the offset
 * point lands on the medial axis, the cap face closes to a line and the rim
 * becomes a full round-over. Which is the right answer for a stem thinner than
 * twice the bevel — not a die-cut edge, and not an inverted polygon.
 */
const OFFSET_PROBE_SAMPLES = 8
const OFFSET_PROBE_RING_FRAC = 0.5
const OFFSET_PROBE_RAY_STEPS = 4
/**
 * THE RASTER'S BLIND RADIUS, IN CELLS — and this is the THIRD time the same
 * mistake has been made on this function, so it is written out with the number
 * that settles it.
 *
 * The rule has been right since the second iteration: *do not ask a discrete
 * field a question finer than its cell*. What was wrong is the RADIUS at which
 * that rule was applied. It was `cell` — one cell — on the reasoning that the
 * contour rides the 50 %-coverage isoline, so half the vertices sit in a cell
 * whose binary value is background and a sample within about a cell of the
 * vertex reads "outside" for a point that is on the surface by definition.
 *
 * ONE CELL IS NOT ENOUGH, and the bound is arithmetic before it is measured.
 * Two quantisations stack:
 *
 *   • `isMaterialWorld` does `Math.round` to the nearest CELL CENTRE, so a query
 *     lands up to 0.5 cell away on each axis — up to √2/2 = 0.707 cell in
 *     distance — from the point actually asked about.
 *   • `componentMask` is the coverage field thresholded AT cell centres, so the
 *     outermost cell flagged 1 can sit a full cell inside the 50 % isoline the
 *     contour vertices were snapped to.
 *
 * 1 + 0.707 = 1.707 cells before the loop's own Chaikin/DP smoothing is allowed
 * to move a vertex off the isoline it was snapped to. MEASURED, over all 1329
 * contour vertices of all five standard fixtures — walk inward from each vertex
 * and find the first depth past which the mask reads material continuously:
 *
 *     max misread            1.950 cells
 *     floor 1.00 cell   ->   117 vertices still misreadable   (what shipped)
 *     floor 1.50 cells  ->    24
 *     floor 1.75 cells  ->     5
 *     floor 2.00 cells  ->     0
 *
 * What the shipped 1-cell floor cost, on `openArc/solid`: 22 of 497 contour
 * vertices were told "not material" at 1.04 and 1.58 cells inside a band 17.9
 * CELLS THICK, failed every real rung, and fell to the bottom of the ladder —
 * where 0.12 x 0.015 = 0.38 of a cell trips this same clause and is granted
 * UNPROBED. A 0.38-cell inward offset paired with the full 0.015 Z drop is not a
 * bevel: the first ring band tilts `atan(dz / (0.5 x inset))` = 65.9° instead of
 * its designed 15.0°, and the census read a `mixed max` of 84.73 on a fixture
 * with no drawn corner anywhere. `circle/solid` — the same band width, the same
 * raster, the same cell — starves nothing and reads `mixed max` exactly 30.00.
 *
 * It is used for all THREE of the places the old code wrote `cell`, deliberately:
 * the ray-sample skip, the ring-sample skip, and the "an offset smaller than
 * this cannot cross anything the raster is able to see" early accept. One
 * radius, one meaning — two names for one knob is how a control silently stops
 * reaching the thing it names.
 */
const OFFSET_PROBE_BLIND_CELLS = 2.0
/** Edge-flip repair iterations. */
const OFFSET_FLIP_PASSES = 3
/**
 * Fraction of its original projected length an offset edge must retain when the
 * repair scales it back — the ONE free parameter in the repair, and it is
 * bounded from both sides rather than picked.
 *
 *   too LARGE — the repair over-corrects a fold that barely happened and drives
 *     a vertex far below its neighbours, which the profile scale then turns into
 *     a step in the rim's own width.
 *   too SMALL — the offset edge survives as a sliver, and the band quad built on
 *     it has a normal made of float noise.
 *
 * Swept on the five standard fixtures, `mixed max` on the two that exercise it:
 *
 *     KEEP      0.05     0.10     0.20     0.35     0.50
 *     openArc  75.49    69.86    71.24    73.22    75.11
 *     square   71.38    71.92    72.91    74.22    75.36
 *
 * Monotone worsening above 0.10 (over-correction) and worsening below it
 * (slivers), so the shipped value sits at the bottom of a measured curve with
 * both failure directions named. Reported rather than asserted, and the prior
 * blind halving is parked at `SOLID_TUNING.flipRepair = "halve"`.
 */
const OFFSET_FLIP_KEEP = 0.1

/**
 * WHAT THE LADDER DID, PER VERTEX, ON THE LAST CALL — write-only, never read by
 * the builder. Same shape as `INFLATE_DEBUG` in `geometry-engines.ts` and for
 * the same reason: the rim's appearance is decided entirely by which rung each
 * vertex took, and until this existed that was the one number no harness could
 * see. `meanFrac` averages it away and `starved` counts only the bottom of it,
 * so a rim with 22 vertices at 0.12 among 473 at 1.0 — which is a visible tear
 * at every one of those 22 — reported `meanFrac 0.96, starved 22` and read as a
 * rim that had achieved 96 % of what it asked for.
 */
export const INSET_DEBUG: {
  /** One record per call, most recent last. Bounded so a live preview that
   *  rebuilds on every dial tick cannot grow it without limit. */
  calls: {
    rungs: number[]
    why: string[]
    trail: string[]
    /** Achieved offset / requested AFTER the flip repair. */
    final?: number[]
    /** Edges the flip repair halved, by index. */
    flipped?: number[]
    offset: number
    cell: number
    /** The loop this call was made about, and the material predicate it was
     *  clamped against — captured ONLY when `captureProbe` is set, so shipped
     *  builds retain no reference to the raster. */
    loop?: { x: number; y: number }[]
    dirs?: { x: number; y: number }[]
    isMaterial?: (x: number, y: number) => boolean
  }[]
  /** Off by default: a captured `isMaterial` closes over the component mask
   *  (512x632 bytes) and this record is a ring buffer. Harnesses set it. */
  captureProbe: boolean
} = { calls: [], captureProbe: false }
const INSET_DEBUG_KEEP = 8

export interface InsetLoopResult {
  /**
   * Per-vertex inward displacement VECTOR (world units).
   *
   * ⚠ ITS MAGNITUDE IS **NOT** THE OFFSET, and this comment used to say
   * "Magnitude <= offset", which is false in two directions. `dirs[i]` is a
   * MITER vector — `(n1 + n2) / (1 + n1·n2)`, whose length is `1/cos(turn/2)`,
   * i.e. 1 on a straight run and **√2 = 1.4142 at a 90° corner** — capped at
   * `OFFSET_MITER_LIMIT` = 2. So `|vecs[i]|` runs up to 2× the offset, and it
   * has to: that longer travel along the bisector is exactly what puts the
   * offset polygon `offset` inside BOTH incident edges. The geometry is right.
   */
  vecs: { x: number; y: number }[]
  /**
   * Mean achieved INWARD OFFSET as a fraction of the requested one.
   *
   * This is `mean(dist[i]) / offset`, where `dist[i]` is what the ladder took —
   * the perpendicular distance the offset line actually moved. It used to be
   * `mean(|vecs[i]|) / offset`, which measures the miter vector instead, so a
   * bevel that achieved exactly what was asked reported **1.414** at a 90°
   * corner and up to 2.0 at a sharper one. `components/viewport-3d.tsx` paints
   * `h3BevelAchievedFrac` green at >= 0.8 (no line number: that file is another
   * lane's and its numbers rot within the hour), so the lie ran in the
   * direction that hides a
   * starved rim. Proved in closed form by
   * `scripts/verify/_probe-bevel-frac.mjs`.
   */
  meanFrac: number
  /**
   * PER-VERTEX ACHIEVED OFFSET / REQUESTED — `dist[i] / offset`, after both the
   * ladder and the flip repair, which is exactly the fraction the rings are
   * built at.
   *
   * Not a convenience: the rim's appearance is decided vertex by vertex and
   * every number this function returned before was an AGGREGATE. `meanFrac`
   * averages the tear away (a loop with 22 vertices at 0.12 among 473 at 1.0
   * reports 0.96) and `starved` counts the bottom without saying where. The
   * H3 assembly needs the per-vertex value because the bevel's Z drop is
   * scaled by it — see the ring table.
   */
  fracs: Float64Array
  /** Vertices that got less than 25% of the requested offset. */
  starved: number
  /** Edge flips repaired. */
  flipsRepaired: number
}

/** Exported for `scripts/verify/_probe-bevel-frac.mjs`, which needs a
 *  closed-form control on `meanFrac`. Not used outside this module. */
export function insetLoopAgainstMask(
  loop: { x: number; y: number }[],
  offset: number,
  isMaterial: (x: number, y: number) => boolean,
  /**
   * One raster cell, in world units. THE PROBE MUST NOT BE ASKED QUESTIONS THE
   * RASTER CANNOT ANSWER, and this is the second time that bit me on this
   * function. The contour vertices ride the 50%-COVERAGE ISOLINE — that is what
   * `snapLoopToCoverage` puts them on — so roughly half of them sit in a cell
   * whose binary value is BACKGROUND. Any probe sample within about a cell of the
   * vertex therefore reads "outside" for a vertex that is on the surface by
   * definition, every rung of the ladder fails, the offset lands on zero, and the
   * bevel leaves a 90° cap-to-wall crease at that vertex. Measured: `mixed max
   * 90` survived on three of four Solid fixtures with a bevel that was otherwise
   * building correctly, and the frames showed a rolled rim with occasional nicks
   * in it rather than a die-cut edge.
   *
   * So samples closer than the raster's BLIND RADIUS are not consulted, and an
   * offset smaller than it is accepted without probing at all — it cannot cross
   * anything the raster is able to see.
   *
   * ⚠ THAT RADIUS IS NOT ONE CELL, and this comment said it was for a cycle
   * while the code did too. Two quantisations stack — `Math.round` to the
   * nearest cell centre (up to √2/2 = 0.707 cell) and a mask thresholded AT cell
   * centres (up to a full cell inside the isoline) — and measured over all 1329
   * contour vertices of the five fixtures the worst misread is 1.950 cells. See
   * `OFFSET_PROBE_BLIND_CELLS`, which is what every probe below now measures
   * against; one cell left 117 of those 1329 misreadable.
   */
  cell: number,
): InsetLoopResult {
  const n = loop.length
  const vecs: { x: number; y: number }[] = new Array(n)
  const dirs: { x: number; y: number }[] = new Array(n)
  const dist = new Float64Array(n)
  if (n < 3 || offset <= 0) {
    for (let i = 0; i < n; i++) vecs[i] = { x: 0, y: 0 }
    return { vecs, meanFrac: 0, fracs: new Float64Array(n), starved: n, flipsRepaired: 0 }
  }

  // --- 1. miter direction per vertex ---
  for (let i = 0; i < n; i++) {
    const p = loop[(i - 1 + n) % n]
    const c = loop[i]
    const q = loop[(i + 1) % n]
    let ax = c.x - p.x, ay = c.y - p.y
    let bx = q.x - c.x, by = q.y - c.y
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la < 1e-12 || lb < 1e-12) { dirs[i] = { x: 0, y: 0 }; continue }
    ax /= la; ay /= la; bx /= lb; by /= lb
    // Left normal of a direction (dx, dy) is (-dy, dx) — into the body for a
    // CCW outer loop AND for a CW hole loop (see the block comment).
    const n1x = -ay, n1y = ax
    const n2x = -by, n2y = bx
    const denom = 1 + (n1x * n2x + n1y * n2y)
    if (denom < 1e-6) {
      // A near-180° reversal: the miter is unbounded. Use the outgoing normal.
      dirs[i] = { x: n2x, y: n2y }
      continue
    }
    let mx = (n1x + n2x) / denom
    let my = (n1y + n2y) / denom
    const ml = Math.hypot(mx, my)
    if (ml > OFFSET_MITER_LIMIT) { mx = (mx / ml) * OFFSET_MITER_LIMIT; my = (my / ml) * OFFSET_MITER_LIMIT }
    dirs[i] = { x: mx, y: my }
  }

  // --- 2. per-vertex ladder, clamped by the mask ---
  let starved = 0
  const dbg: (typeof INSET_DEBUG)["calls"][number] = {
    rungs: new Array<number>(n),
    why: new Array<string>(n),
    trail: new Array<string>(n),
    offset,
    cell,
  }
  if (INSET_DEBUG.captureProbe) { dbg.loop = loop; dbg.dirs = dirs; dbg.isMaterial = isMaterial }
  INSET_DEBUG.calls.push(dbg)
  while (INSET_DEBUG.calls.length > INSET_DEBUG_KEEP) INSET_DEBUG.calls.shift()
  // The radius inside which the binary mask cannot be trusted — see
  // OFFSET_PROBE_BLIND_CELLS. Every probe below measures against THIS, not
  // against one cell.
  const blind = cell * (SOLID_TUNING.probeBlind === "onecell" ? 1 : OFFSET_PROBE_BLIND_CELLS)
  for (let i = 0; i < n; i++) {
    const d = dirs[i]
    if (d.x === 0 && d.y === 0) { dist[i] = 0; vecs[i] = { x: 0, y: 0 }; starved++; dbg.rungs[i] = 0; dbg.why[i] = "no-dir"; continue }
    let taken = 0
    let why = "starved"
    const trail: string[] = []
    for (const frac of OFFSET_LADDER) {
      const r = offset * frac
      const mag = r * Math.hypot(d.x, d.y)
      if (mag <= blind) { taken = r; why = "sub-cell"; trail.push(`${frac}:sub-cell`); break }
      const qx = loop[i].x + d.x * r
      const qy = loop[i].y + d.y * r
      if (!isMaterial(qx, qy)) { why = "point"; trail.push(`${frac}:point`); continue }
      let ok = true
      // RAY: the displacement must not leave the material on the way.
      for (let s = 1; s <= OFFSET_PROBE_RAY_STEPS; s++) {
        const t = s / OFFSET_PROBE_RAY_STEPS
        if (mag * t < blind) continue
        if (!isMaterial(loop[i].x + d.x * r * t, loop[i].y + d.y * r * t)) { ok = false; why = "ray"; trail.push(`${frac}:ray@${t}`); break }
      }
      // RING: margin, at a radius the raster can resolve.
      if (ok) {
        const pr = r * OFFSET_PROBE_RING_FRAC
        for (let s = 0; s < OFFSET_PROBE_SAMPLES; s++) {
          const a = (s / OFFSET_PROBE_SAMPLES) * Math.PI * 2
          const sx = qx + Math.cos(a) * pr
          const sy = qy + Math.sin(a) * pr
          if (Math.hypot(sx - loop[i].x, sy - loop[i].y) < blind) continue
          if (!isMaterial(sx, sy)) { ok = false; why = `ring@${((a * 180) / Math.PI).toFixed(0)}`; trail.push(`${frac}:ring@${((a * 180) / Math.PI).toFixed(0)}`); break }
        }
      }
      if (ok) { taken = r; why = "ok"; trail.push(`${frac}:ok`); break }
    }
    dist[i] = taken
    dbg.rungs[i] = offset > 0 ? taken / offset : 0
    dbg.why[i] = why
    dbg.trail[i] = trail.join(" ")
    vecs[i] = { x: d.x * taken, y: d.y * taken }
    if (taken < offset * 0.25) starved++
  }

  // --- 3. edge-flip repair ---
  let flipsRepaired = 0
  for (let pass = 0; pass < OFFSET_FLIP_PASSES; pass++) {
    let changed = false
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      const ox = loop[j].x - loop[i].x
      const oy = loop[j].y - loop[i].y
      const o2 = ox * ox + oy * oy
      if (o2 < 1e-18) continue
      const nx = (loop[j].x + vecs[j].x) - (loop[i].x + vecs[i].x)
      const ny = (loop[j].y + vecs[j].y) - (loop[i].y + vecs[i].y)
      const proj = nx * ox + ny * oy
      if (proj > 0) continue
      /* SCALE TO THE EXACT LARGEST SAFE VALUE, NOT BY A BLIND HALF.
       *
       * The trigger is unchanged — the offset edge has reversed relative to its
       * original, so the polygon folded there. What changed is the amount. This
       * read `*= 0.5` twice per pass for three passes, so a vertex could land on
       * 1/8 of its offset with nothing in the loop that knew when to stop, and
       * the reduction was applied WITHOUT REGARD TO HOW FAR THE EDGE HAD
       * ACTUALLY REVERSED. Two adjacent vertices could therefore come out at 1.0
       * and 0.25 — the same discontinuity the ladder's rungs used to produce,
       * one stage later, and the same visible consequence once the profile is
       * scaled by the achieved offset.
       *
       * Scaling both endpoints by a common `s` moves the offset edge to
       * `o + s*(v_j - v_i)`, so requiring it to retain `KEEP` of its original
       * projected length is one linear equation:
       *
       *     (o + s*D).o = KEEP*|o|^2      =>   s = (KEEP - 1)*|o|^2 / (D.o)
       *
       * with `D.o = proj - |o|^2`, which the trigger guarantees is negative.
       * KEEP is 0.5 because that is what ONE halving achieved in the marginal
       * case (`proj = 0` gives `s = 0.5` exactly) — the constant is inherited
       * from the shipped behaviour at its own boundary rather than invented, and
       * everywhere else the new value is the largest one that clears the fold
       * instead of the first power of two that happens to. */
      const s =
        SOLID_TUNING.flipRepair === "halve"
          ? 0.5
          : Math.max(0, Math.min(1, ((OFFSET_FLIP_KEEP - 1) * o2) / (proj - o2)))
      dist[i] *= s
      dist[j] *= s
      vecs[i] = { x: dirs[i].x * dist[i], y: dirs[i].y * dist[i] }
      vecs[j] = { x: dirs[j].x * dist[j], y: dirs[j].y * dist[j] }
      flipsRepaired++
      ;(dbg.flipped ??= []).push(i)
      changed = true
    }
    if (!changed) break
  }

  /* `dist[i]`, NOT `Math.hypot(vecs[i])` — see `InsetLoopResult.meanFrac`.
   * `dist[i]` is what the ladder took, i.e. the perpendicular offset achieved.
   * `|vecs[i]|` is that times the miter length `1/cos(turn/2)`, which is 1.4142
   * at a right angle, so summing the vectors reported a bevel that got exactly
   * what it asked for as 141% achieved. The flip-repair pass halves `dist[i]`
   * and rebuilds `vecs[i]` from it, so the two stay in step and this reads the
   * repaired value, not the pre-repair one.
   *
   * BOTH SIGNS MATTER, which is why the number is worth having at all: a
   * genuinely starved vertex still drives it down, and `starved` counts them
   * separately. `MITER_FRAC_PARITY` in `SOLID_TUNING` parks the old formula as
   * the negative control. */
  let sum = 0
  for (let i = 0; i < n; i++) {
    sum +=
      SOLID_TUNING.bevelFrac === "miter"
        ? Math.hypot(vecs[i].x, vecs[i].y)
        : dist[i]
  }
  /* THE PROFILE SCALE — the offset this vertex actually achieved, whatever
   * reduced it.
   *
   * The rim's cross-section at a vertex is a quarter-round, and a quarter-round
   * has ONE size. Its XY axis was already per-vertex (it is `dist[i]`); its Z
   * axis was a per-ring constant. Where the two disagree the result is not a
   * smaller bevel, it is a CLIFF — the band's slope is
   * `atan(dz / (inFrac step x dist))`, which is the designed 15.0 degrees at
   * full offset and 65.9 degrees at a fifth of it. Feeding the same fraction to
   * both axes makes the slope invariant, so a clamped vertex gets a smaller
   * round of the SAME shape and the rim narrows toward a cut instead of tearing.
   *
   * `dist[i]` post-repair, deliberately: the rings are built at `vecs[i]`, which
   * the repair also rewrites, so anything else puts the two axes back out of
   * step at exactly the vertices the repair touched. */
  dbg.final = Array.from({ length: n }, (_, i) => (offset > 0 ? dist[i] / offset : 0))
  const profileFrac = new Float64Array(n)
  for (let i = 0; i < n; i++) profileFrac[i] = offset > 0 ? dist[i] / offset : 0
  return { vecs, meanFrac: offset > 0 ? sum / (n * offset) : 0, fracs: profileFrac, starved, flipsRepaired }
}

// ── Corner-aware multi-pass Chaikin ──────────────────────────────────────────
//
// PORTED VERBATIM (constants + reasoning) from desk-doodles
// `src/app/lib/geometry3d/strokeTo3d.ts` lines 1427-1563 — `CONTOUR_CORNER_PIN_RAD`,
// `CONTOUR_SMOOTH_PASSES`, `turnAngleAt`, `markCorners`, `chaikinCornerAwarePass`,
// `smoothClosedLoopCornerAware`. All three constants are ANGLE- or COUNT-valued,
// so they port without unit conversion. See docs/research/extrude-solid-quality.md
// §1 and §3 for the literature these encode.
//
// Desk Doodles' own note on why a plain Chaikin pass is not enough:
//   "A SINGLE Chaikin pass only doubles the vertex count — a 14-gon -> 28-gon
//    still catches the studio key light as flats."

/** Turn angle (radians) at/above which a vertex is a REAL corner and is PINNED
 *  (never corner-cut), so intentional sharp corners survive smoothing. A drawn
 *  square turns ~90° (π/2 ≈ 1.571) at each corner; a circle/blob's per-vertex
 *  turn on a ~14–28-gon contour is ≪ this. 1.05 rad ≈ 60° sits comfortably
 *  between the two: anything sharper than a hexagon corner is treated as
 *  deliberate. (Turn angle = π − interior angle: 0 = straight, π = full
 *  reversal.) */
const CONTOUR_CORNER_PIN_RAD = 1.05
/** How many corner-aware Chaikin passes to run on a closed contour. 3 passes
 *  takes a 14-gon to a smooth ~64-point curve on the rounded segments while
 *  pinned corners stay crisp — the rim reads as a curve, not facets, without an
 *  unbounded vertex blow-up (cap below keeps perf sane). */
const CONTOUR_SMOOTH_PASSES = 3

/** Turn angle (radians, 0..π) at vertex i of a CLOSED loop — the deviation of
 *  the path from straight (0 = collinear, π/2 = right angle, π = doubles back).
 *  Degenerate (coincident-neighbour) vertices report 0 (treated as smoothable
 *  filler, never a corner). */
function contourTurnAngleAt(loop: Point2D[], i: number): number {
  const n = loop.length
  const p = loop[(i - 1 + n) % n]
  const c = loop[i]
  const q = loop[(i + 1) % n]
  const ax = c.x - p.x, ay = c.y - p.y
  const bx = q.x - c.x, by = q.y - c.y
  const magA = Math.hypot(ax, ay)
  const magB = Math.hypot(bx, by)
  if (magA < 1e-12 || magB < 1e-12) return 0
  const cos = Math.min(Math.max((ax * bx + ay * by) / (magA * magB), -1), 1)
  return Math.acos(cos) // 0 = straight, π = reversal
}

/** Mark which vertices of a CLOSED loop are CORNERS to pin (never corner-cut).
 *  Two ways to qualify, so BOTH a clean vector corner AND a raster-chamfered
 *  one survive WITHOUT pinning a uniformly-curving circle/polygon:
 *    (1) DIRECT — the vertex's own turn ≥ pinRad (a sharp single-vertex corner).
 *    (2) CONCENTRATED — marching-squares/lattice tracing quantizes a 90° corner
 *        into a 2-step ~45° chamfer (no single vertex clears pinRad). Such a
 *        corner is a SHORT high-turn cluster bordered by STRAIGHT runs: the
 *        vertex + its sharper neighbour sum ≥ pinRad WHILE the next ring out
 *        (±2) is nearly flat (Σ < flatRad). A regular polygon / coarse circle
 *        turns UNIFORMLY — the ±2 ring is just as bent as the centre — so it
 *        fails the flatness test and rounds normally. Only the cluster PEAK
 *        pins (local max) so the corner stays a single crisp vertex, never a
 *        flat chamfer.
 *  This keeps a drawn square SQUARE through the raster→smooth path while an
 *  octagon / circle rounds. */
function markContourCorners(loop: Point2D[], pinRad: number): boolean[] {
  const n = loop.length
  const turn = new Array<number>(n)
  for (let i = 0; i < n; i++) turn[i] = contourTurnAngleAt(loop, i)
  const pinned = new Array<boolean>(n).fill(false)
  // "Flat" = the outer ring carries little turn, marking the corner as isolated
  // rather than part of a continuous curve. Half pinRad is a comfortable gap
  // between a straight run (~0) and uniform curvature (each vertex ~pinRad/k).
  const flatRad = pinRad * 0.5
  for (let i = 0; i < n; i++) {
    const prev = turn[(i - 1 + n) % n]
    const next = turn[(i + 1) % n]
    if (turn[i] >= pinRad) {
      pinned[i] = true // direct sharp corner
      continue
    }
    const localMax = turn[i] >= prev && turn[i] >= next
    const concentrated = turn[i] + Math.max(prev, next) >= pinRad
    const outerFlat = turn[(i - 2 + n) % n] + turn[(i + 2) % n] < flatRad
    if (localMax && concentrated && outerFlat) pinned[i] = true
  }
  return pinned
}

/** ONE corner-aware Chaikin pass on a CLOSED loop. Pinned vertices are emitted
 *  verbatim so corners stay sharp; every other vertex is corner-cut (the
 *  standard ¼/¾ split) so the facet read disappears. The loop stays closed and
 *  simple — each cut point lies strictly inside an existing edge, so no new
 *  self-intersection. */
function chaikinCornerAwarePass(loop: Point2D[], pinRad: number): Point2D[] {
  const n = loop.length
  if (n < 3) return loop
  const pinned = markContourCorners(loop, pinRad)
  const out: Point2D[] = []
  for (let i = 0; i < n; i++) {
    const a = loop[i]
    const b = loop[(i + 1) % n]
    if (pinned[i]) out.push({ x: a.x, y: a.y }) // keep the corner exactly
    if (!pinned[i]) out.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 })
    if (!pinned[(i + 1) % n]) out.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 })
  }
  return out
}

/** Corner-aware multi-pass smoother for a CLOSED contour loop.
 *
 *  `maxPoints` is NOT one of Desk Doodles' verbatim constants and must not be.
 *  Its 192 is calibrated to a 144-cell grid; this mask is 512, and RDP at a
 *  CELL-relative epsilon keeps roughly sqrt(res) more vertices for the same
 *  shape, so a verbatim 192 would trip the cap on pass 0 and silently perform
 *  ZERO smoothing — a ported constant that renders as a no-op, which is the
 *  exact bug class this codebase keeps producing. It is therefore scaled by the
 *  resolution ratio at the call site. */
function smoothClosedLoopCornerAware(
  loop: Point2D[],
  maxPoints: number,
  passes: number = CONTOUR_SMOOTH_PASSES,
  pinRad: number = CONTOUR_CORNER_PIN_RAD,
): Point2D[] {
  if (loop.length < 3) return loop
  let cur = loop
  for (let p = 0; p < passes; p++) {
    if (cur.length * 2 > maxPoints) break
    const next = chaikinCornerAwarePass(cur, pinRad)
    if (next.length < 3) break
    cur = next
  }
  return cur
}

/** Desk Doodles' reference grid resolution, the basis of its point cap. */
const DD_REFERENCE_GRID_RESOLUTION = 144
/** Desk Doodles' cap at that resolution (CONTOUR_SMOOTH_MAX_POINTS). */
const DD_CONTOUR_SMOOTH_MAX_POINTS = 192

/**
 * STAIRCASE-COLLAPSE epsilon, in grid-CELL units (here 1 cell = 1 mask px).
 *
 * PORTED from desk-doodles `SOLID_SMOOTH_DECIMATE_EPSILON_CELLS` (strokeTo3d.ts:242),
 * with its reasoning verbatim:
 *
 *   "The gentle 0.6 epsilon leaves the marching-squares staircase intact on a
 *    circle (max per-vertex turn ~45° — the facet read Sebs sees), and a single
 *    Chaikin pass barely dents it. Re-decimating the contour at ~1.4 cells
 *    collapses the staircase steps (max turn -> ~20°) so the subsequent
 *    multi-pass corner-aware Chaikin can rebuild a TRUE smooth curve, while a
 *    real corner's large deviation always survives RDP (it's the farthest point
 *    on its segment). Cell-unit space, so it scales with grid resolution."
 *
 * The old value here was 0.45 px applied AFTER smoothing, which is the reverse
 * order — see docs/research/extrude-solid-quality.md §2 for why that cannot work.
 */
const CONTOUR_DECIMATE_EPSILON_CELLS = 1.4

/**
 * DECIMATION LADDER — coarsest first.
 *
 * The epsilon above is a FIDELITY/SMOOTHNESS trade, not a constant of nature:
 * a coarser epsilon collapses more staircase (smoother rim) and departs further
 * from the traced mask (less fidelity). The area guard below measures exactly
 * that departure. So when the guard rejects a result, the answer is to move
 * along the trade — not to abandon the loop.
 *
 * WHY THIS EXISTS. The guard's only alternative used to be `return exactLoop`,
 * i.e. the RAW marching-squares staircase: the single most faceted output the
 * pipeline can produce. A guard whose failure mode is the worst available
 * answer is worse than no guard. Measured on the `crossing` fixture (two thin
 * bars overlapping at a shallow angle — the "overlaps look weird" case):
 * `CONTOUR SMOOTH FALLBACK: area 1.067` on both loops, `smoothed 0`, and the
 * live rim probe came back `rimTurnMeanDeg 90, alternation 0.987`, sample
 * `90, -90, 90, -90…` — a perfect 512-lattice comb, rendered at full specular
 * contrast on any glossy material.
 *
 * WHY A THIN FORM OVERSHOOTS. RDP's epsilon is absolute (cells) but its damage
 * is relative to the local half-thickness. On a wide form 1.4 cells is a rounding
 * error; on a bar ~8 cells across it is ~17% of the half-width, so the decimated
 * polygon cuts the concave notch at the crossing and Chaikin then bulges the
 * result outward — area up 6.7%, past the 5% ceiling. Nothing is wrong with the
 * epsilon in general; it is wrong for THAT loop.
 *
 * The floor of the ladder (0) means "no decimation": snap + corner-aware
 * Chaikin only. That is still strictly better than the raw staircase, and it is
 * essentially the behaviour this file had before the decimate-first reorder, so
 * the ladder can only ever land somewhere between "as good as the port" and "as
 * good as what preceded it". The raw loop remains the terminal fallback, but now
 * it needs EVERY rung to fail rather than the first one.
 */
const CONTOUR_DECIMATE_EPSILON_LADDER = [CONTOUR_DECIMATE_EPSILON_CELLS, 0.9, 0.55, 0.3, 0]

/** Smoothed loop must keep this fraction of the exact loop's area, at least… */
const CONTOUR_AREA_MIN_RATIO = 0.9
/** …and at most this much. */
const CONTOUR_AREA_MAX_RATIO = 1.05

/**
 * Turn a lattice boundary loop into a smooth contour (mask space).
 *
 * Pipeline, in this order — the order IS the fix:
 *   1. sub-cell snap onto the coverage isoline  (removes the quantisation)
 *   2. RDP decimate                             (collapses what's left of the steps)
 *   3. corner-aware multi-pass Chaikin          (rebuilds a true curve, pins corners)
 *
 * Steps 2-3 are retried down CONTOUR_DECIMATE_EPSILON_LADDER until the result
 * clears the area and self-intersection guards; only if every rung fails does
 * the loop fall back to the exact input.
 *
 * `cov` is optional: hole contours are traced in a CROPPED mask whose
 * coordinates do not index the full-size coverage field, so they skip step 1
 * and get steps 2-3 only. Passing a mismatched field would be a coordinate bug,
 * and a hole rim is small enough that the reordering alone carries it.
 *
 * Input should already be collinear-simplified.
 */
function smoothLatticeLoop(
  exactLoop: Point2D[],
  cov?: { data: Uint8Array; width: number; height: number },
): Point2D[] {
  if (exactLoop.length < 8) return exactLoop
  const exactArea = shoelaceAbs(exactLoop)
  if (exactArea < 4) return exactLoop

  const snapped = cov ? snapLoopToCoverage(exactLoop, cov.data, cov.width, cov.height) : exactLoop
  const maxPoints = Math.round(
    (DD_CONTOUR_SMOOTH_MAX_POINTS * MASK_RESOLUTION) / DD_REFERENCE_GRID_RESOLUTION,
  )

  let retries = 0
  let reason = ""
  for (const eps of CONTOUR_DECIMATE_EPSILON_LADDER) {
    // eps 0 is the explicit "skip decimation" rung, not a degenerate epsilon.
    const decimated = eps > 0 ? dpSimplifyClosed(snapped, eps) : snapped
    const smooth = smoothClosedLoopCornerAware(decimated, maxPoints)

    if (smooth.length < 4) {
      reason = "degenerate"
    } else {
      const smoothArea = shoelaceAbs(smooth)
      const ratio = smoothArea / exactArea
      if (ratio < CONTOUR_AREA_MIN_RATIO || ratio > CONTOUR_AREA_MAX_RATIO) {
        reason = `area ${ratio.toFixed(3)}`
      } else if (contourSelfIntersects(smooth)) {
        reason = "self-intersection"
      } else {
        CONTOUR_SMOOTH_DEBUG.smoothed++
        CONTOUR_SMOOTH_DEBUG.decimationRetries += retries
        CONTOUR_SMOOTH_DEBUG.lastEpsilonCells = eps
        CONTOUR_SMOOTH_DEBUG.lastInPoints = exactLoop.length
        CONTOUR_SMOOTH_DEBUG.lastDecimatedPoints = decimated.length
        CONTOUR_SMOOTH_DEBUG.lastOutPoints = smooth.length
        if (retries > 0 && !QUIET) {
          console.log(`[v0-solid] CONTOUR SMOOTH: epsilon ${eps} cells after ${retries} rejected (${reason})`)
        }
        return smooth
      }
    }
    retries++
  }

  // Every rung failed. This is the only path that emits the raw staircase, and
  // it says so — a silent revert here is indistinguishable from a smooth rim.
  if (!QUIET) console.log(`[v0-solid] CONTOUR SMOOTH FALLBACK (all ${CONTOUR_DECIMATE_EPSILON_LADDER.length} rungs): ${reason}`)
  if (reason === "self-intersection") CONTOUR_SMOOTH_DEBUG.selfIntersectFallbacks++
  else CONTOUR_SMOOTH_DEBUG.areaFallbacks++
  CONTOUR_SMOOTH_DEBUG.lastFallbackReason = reason
  // Write the point counts on THIS path too. They used to be success-only, so
  // after a fallback the witness reported the previous loop's numbers and read
  // as if the smoother had worked.
  CONTOUR_SMOOTH_DEBUG.lastInPoints = exactLoop.length
  CONTOUR_SMOOTH_DEBUG.lastDecimatedPoints = 0
  CONTOUR_SMOOTH_DEBUG.lastOutPoints = exactLoop.length
  return exactLoop
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
    maskData: new Uint8Array(0),
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
  const { mask, width, height, filledCount, coverage, rasterDebug, rect, framePad } = renderStrokeToMask(stroke.points, thickness, canvasWidth, canvasHeight, buildRes, stroke.subpathStarts, stroke.subpathArc)
  
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
  const { labels, componentCount, componentSizes } = labelConnectedComponents(mask, width, height, rect)
  
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
  
  // Create binary mask for largest component only (typed — hot path)
  const componentMask = new Uint8Array(width * height)
  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let i = y * width + rect.x0, end = y * width + rect.x1; i <= end; i++) {
      if (labels[i] === largestLabel) componentMask[i] = 1
    }
  }
  
  // ========== H1 HOLE DETECTION (DIAGNOSTIC ONLY) ==========
  // Detects interior empty regions fully enclosed by the selected filled
  // component. THIS DOES NOT MODIFY GEOMETRY OUTPUT. Results are reported
  // through solidDiagnostics only. THREE.Shape, caps, walls, and the entire
  // extrusion path are unchanged regardless of detection results.
  const holeDetection = detectInteriorHoles(componentMask, width, height, resScale, rect)
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
  const cutPieceStroke = stroke.subpathArc?.some((a) => a !== undefined) === true
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
  } else if (outerAreaAbs < 10 && !cutPieceStroke) {
    /* F118 TRAVEL-6: a stroke that holds a reveal-cut piece (`subpathArc` set) is
     * exempt. That piece is stroked at its own arc, so at the start of its pass it is
     * a few mask px by design; this gate dropped it until 10 px and it then landed
     * at 11 in one frame, the Solid in-pass pop (measured in Node: arc 3.5 canvas px
     * builds nothing, arc 4 builds 11 px). Exempt, it builds at its lattice size
     * from the first filled pixel. Whole strokes keep the gate. */
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
  // Base dims, not the padded ones: the frame pad adds mask px without
  // changing mask px per canvas px (F118 ANIM-1C3; 0 pad is the old sum).
  const scaleX = canvasWidth / (width - 2 * framePad.kx)
  const scaleY = canvasHeight / (height - 2 * framePad.ky)
  const scale = Math.min(scaleX, scaleY)
  const normScale = 3 / Math.max(canvasWidth, canvasHeight)
  
  const toWorldX = (mx: number) => (mx - width / 2) * scale * normScale
  const toWorldY = (my: number) => -(my - height / 2) * scale * normScale

  // Anti-stairstep smoothing (Chaikin x3 + DP 0.45 px, guarded — falls back
  // to the exact loop on any fidelity/self-intersection failure). This is
  // what removes the raster stair-step aliasing from the extruded silhouette.
  const outerForGeometry = smoothLatticeLoop(outerExact, { data: coverage, width, height })

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
          buildRes,
          stroke.subpathStarts,
          stroke.subpathArc,
          framePad
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
            counterRender.height,
            counterRender.rect
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
            const counterComponentMask = new Uint8Array(
              counterRender.width * counterRender.height
            )
            const cr = counterRender.rect
            for (let y = cr.y0; y <= cr.y1; y++) {
              for (let i = y * counterRender.width + cr.x0, end = y * counterRender.width + cr.x1; i <= end; i++) {
                if (counterCC.labels[i] === counterLargestLabel) counterComponentMask[i] = 1
              }
            }
            const counterHoles = detectInteriorHoles(
              counterComponentMask,
              counterRender.width,
              counterRender.height,
              resScale,
              cr
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
                // Centroid was accumulated during the detection flood fill —
                // identical value (exact integer sums / size), no full-mask
                // rescan per hole.
                const cen = counterHoles.validHoleCentroids[k]
                if (!cen) continue
                const cx = cen.x
                const cy = cen.y
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
                const filteredBboxMins = filteredIdx.map(
                  (k) => counterHoles.validHoleBboxMin[k]
                )
                const filteredCentroids = filteredIdx.map(
                  (k) => counterHoles.validHoleCentroids[k]
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
                  validHoleBboxMin: filteredBboxMins,
                  validHoleCentroids: filteredCentroids,
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
      for (let hk = 0; hk < activeHoleDetection.validHoleLabelIds.length; hk++) {
        const labelId = activeHoleDetection.validHoleLabelIds[hk]
        // Build a per-hole binary mask CROPPED to the hole's bbox (the flood
        // fill already computed it). Pixels outside the crop are by definition
        // not this hole's pixels, and extractBoundaryEdges treats out-of-bounds
        // exactly like empty neighbours, so the traced boundary is IDENTICAL
        // to the full-mask trace, just offset by the bbox origin. This turns
        // per-hole cost from O(maskArea) into O(bboxArea).
        const bbox = activeHoleDetection.validHoleBboxes[hk] ?? { w: 0, h: 0 }
        const bmin = activeHoleDetection.validHoleBboxMin[hk] ?? { x: 0, y: 0 }
        const bw = bbox.w
        const bh = bbox.h
        const bx = bmin.x
        const by = bmin.y
        const holeMask = new Uint8Array(bw * bh)
        let pxCount = 0
        const emptyLabels = activeHoleDetection.emptyLabels
        for (let y = 0; y < bh; y++) {
          const srcRow = (by + y) * width + bx
          const dstRow = y * bw
          for (let x = 0; x < bw; x++) {
            if (emptyLabels[srcRow + x] === labelId) {
              holeMask[dstRow + x] = 1
              pxCount++
            }
          }
        }

        // Trace its outer boundary in mask space using the existing pipeline.
        // chainBoundaryEdges may split at pinch points; if so, we'd previously
        // get only the LONGEST sub-loop. To avoid silently dropping holes whose
        // boundaries pinch, we fall back to gathering ALL loops and picking
        // the one with maximum enclosed (mask-space) area.
        const holeContourCropped = traceLargestAreaContour(holeMask, bw, bh)
        if (holeContourCropped.length < 3) {
          h2HoleContourRejectReasons.push(`label=${labelId} area=${pxCount} traced<3pts`)
          continue
        }
        // Undo the crop offset so downstream world transforms are unchanged.
        const holeContourMask: Point2D[] = holeContourCropped.map((p) => ({
          x: p.x + bx,
          y: p.y + by,
        }))

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

        // ---- Wall plan: segments + crease decisions ------------------------
        //
        // RIM STRIPING (fixed 2026-07). The rim used to be built as independent
        // quads — four fresh vertices per contour segment — so
        // `computeVertexNormals()` had nothing to average and handed every quad
        // a flat face normal. Measured on the live geometry
        // (`__geomDebug.probeNormals`, docs/verification/solid-rim/before):
        // 306 of 306 contour points carried a normal split between their two
        // wall faces, mean 25 degrees, max 91.
        //
        // The size of that split is not the contour "turning" — it is
        // quantisation noise. The outline is traced off a 512-px lattice,
        // Chaikin-smoothed, then Douglas-Peucker decimated at 0.45 px, so the
        // retained vertices sit up to ~half a pixel either side of the true
        // curve. The same probe measured a turn-direction ALTERNATION RATIO of
        // 0.834 with a textbook signature: -39.9, +39.9, -39.9, +39.9. The
        // contour zig-zags left-right by half a pixel every segment.
        //
        // Half a pixel is geometrically nothing (0.1% of the form's width), but
        // per-face normals render it at full contrast: alternating quads catch
        // and lose the key light, which is exactly the reported striping.
        //
        // Fix: share the wall vertices between neighbouring quads unless the
        // contour genuinely turns hard (WALL_CREASE_DEG). Sharing lets
        // computeVertexNormals average the two faces, and the average of a
        // symmetric zig-zag is the true surface direction — the alternation
        // cancels instead of being drawn. POSITIONS ARE UNCHANGED: the
        // silhouette, mask fidelity, hole topology and export shape are all
        // exactly what they were; only the normals (and the vertex count) move.
        const WALL_CREASE_DEG = 60
        const WALL_CREASE_COS = Math.cos((WALL_CREASE_DEG * Math.PI) / 180)

        interface WallSeg {
          ax: number
          ay: number
          bx: number
          by: number
          dx: number
          dy: number
          /** Index in the SOURCE loop of this segment's start vertex. The rim ring
           *  stack is indexed by junction, the cap triangulation by loop point;
           *  this is the only thing that relates them, and without it the cap has
           *  to be a separate vertex block and the cap/bevel junction becomes the
           *  hard shading line the bevel exists to remove. */
          li: number
        }
        interface WallPlan {
          segs: WallSeg[]
          /** shareStart[j]: segment j's start vertices are shared with segment j-1's end. */
          shareStart: boolean[]
          kept: number
          skipped: number
          smoothJunctions: number
          hardJunctions: number
          /** Vertices this loop writes PER RING: one per junction, +1 per hard junction. */
          vertsPerRing: number
        }

        const planLoopWalls = (loop: { x: number; y: number }[]): WallPlan => {
          const segs: WallSeg[] = []
          let skipped = 0
          for (let i = 0; i < loop.length; i++) {
            const a = loop[i]
            const b = loop[(i + 1) % loop.length]
            const dx = b.x - a.x
            const dy = b.y - a.y
            const len = Math.hypot(dx, dy)
            if (len < WALL_EPSILON) {
              skipped++
              continue
            }
            segs.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, dx: dx / len, dy: dy / len, li: i })
          }
          const m = segs.length
          const shareStart: boolean[] = new Array(m).fill(false)
          let smoothJunctions = 0
          let hardJunctions = 0
          for (let j = 0; j < m; j++) {
            const prev = segs[(j - 1 + m) % m]
            const cur = segs[j]
            const cos = prev.dx * cur.dx + prev.dy * cur.dy
            const smooth = cos >= WALL_CREASE_COS
            shareStart[j] = smooth
            if (smooth) smoothJunctions++
            else hardJunctions++
          }
          return {
            segs,
            shareStart,
            kept: m,
            skipped,
            smoothJunctions,
            hardJunctions,
            vertsPerRing: m + hardJunctions,
          }
        }

        const allLoops: { x: number; y: number }[][] = [shapePts, ...innerLoops]

        const outerPlan = planLoopWalls(shapePts)
        const innerPlans = innerLoops.map(planLoopWalls)
        const outerSegStats = { kept: outerPlan.kept, skipped: outerPlan.skipped }
        let innerSegKeptTotal = 0
        let innerSegSkippedTotal = 0
        const innerSegStatsPerLoop: Array<{ kept: number; skipped: number }> = []
        for (const p of innerPlans) {
          innerSegStatsPerLoop.push({ kept: p.kept, skipped: p.skipped })
          innerSegKeptTotal += p.kept
          innerSegSkippedTotal += p.skipped
        }

        const allPlans = [outerPlan, ...innerPlans]
        const wallQuadCount = outerSegStats.kept + innerSegKeptTotal
        const rimSmoothJunctions = allPlans.reduce((s, p) => s + p.smoothJunctions, 0)
        const rimHardJunctions = allPlans.reduce((s, p) => s + p.hardJunctions, 0)

        // CAP SOURCE. The cap is drawn at RING 0, which is the contour INSET by
        // `bevelXY` — so its triangulation has to be computed on the INSET loops,
        // which is what `SOLID_TUNING.capFit: "inset"` does. The index space is
        // still the one H2 builds — `[shapePts, ...orderedHoles]` concatenated in
        // the order ShapeUtils consumed them (see the H2 triangulation above) —
        // because insetting moves points without adding or reordering any, so
        // `toFront` maps through unchanged and the triangle count, the hole
        // topology and every H2 number stay exactly what they were. If the
        // triangulation throws or comes back empty, `capMappable` goes false, the
        // rim falls back to the plain vertical wall with its own cap block, and
        // the diagnostics SAY SO — a silently un-bevelled rim looks identical in
        // every other number this build reports.
        const capMappableRequested = EXTRUDE_BEVEL_PROFILES_FS.rounded.enabled
        let capMappable = capMappableRequested
        for (const p of allPlans) if (p.segs.length === 0) capMappable = false
        let mapCapIdx: ArrayLike<number> = capIdx
        let mapCapTris = capTriCount
        const loopBase: number[] = []
        {
          let acc = 0
          for (const l of allLoops) { loopBase.push(acc); acc += l.length }
        }

        // ---- THE RIM BEVEL ------------------------------------------------
        //
        // Ring stack, front cap plane -> back cap plane, `RINGS[r] = {inFrac, z}`:
        //
        //   inFrac(u) = 1 - sin(u*pi/2)      z(u) = halfDepth - bz*(1 - cos(u*pi/2))
        //
        // A quarter circle with the TANGENTS THE RIGHT WAY ROUND, which is the
        // whole point and the easy thing to get backwards. At u=0 (the cap plane)
        // d(inFrac) is maximal and dz is zero, so the band leaves the cap
        // TANGENTIALLY — that is what makes the cap/bevel crease ~0 instead of
        // another hard line one step further in. At u=1 it is vertical, so it
        // meets the wall tangentially too. Put the sin and cos the other way
        // round and you get a band that meets the cap AND the wall at 45°: three
        // creases instead of one, which is worse than the die-cut edge it replaces.
        //
        // When the bevel is off — profile disabled, no room in Z, or the cap could
        // not be mapped onto the rings — the table collapses to two rings at
        // +/-halfDepth with inFrac 0, which is vertex-for-vertex the vertical wall
        // this block built before the bevel existed. Deliberate: the un-bevelled
        // assembly is not a second code path that can rot, it is this one with the
        // profile switched off.
        const bevelProfile = EXTRUDE_BEVEL_PROFILES_FS.rounded
        // Z drop is capped so the two bands cannot meet and eat the wall: at
        // 0.42*halfDepth a straight wall band always survives between them.
        const bevelZ = Math.min(bevelProfile.thickness, halfDepth * 0.42)
        const bevelXY = bevelProfile.size
        let bevelSegs =
          capMappable && bevelProfile.enabled && bevelZ > 1e-6 && bevelXY > 1e-6
            ? Math.max(1, bevelProfile.segments)
            : 0
        if (bevelSegs === 0) capMappable = false

        // The material test the offset is clamped against is the SAME raster the
        // contour was traced from — `componentMask`, the largest connected
        // component, not the full `mask`: the geometry IS that component alone, so
        // a separate nearby blob must not be allowed to vouch for an offset point.
        // A detected-but-rejected small hole reads as non-material here, so the
        // bevel narrows near it rather than rolling over a hole the cap fills.
        // Conservative in the safe direction.
        const worldPerPx = scale * normScale
        const isMaterialWorld = (wx: number, wy: number): boolean => {
          const mx = Math.round(wx / worldPerPx + width / 2)
          const my = Math.round(height / 2 - wy / worldPerPx)
          if (mx < 0 || my < 0 || mx >= width || my >= height) return false
          return componentMask[my * width + mx] === 1
        }

        let bevelStarved = 0
        let bevelFlips = 0
        let bevelFracSum = 0
        const insetPerLoop = allLoops.map((loop) => {
          if (bevelSegs === 0) {
            return {
              vecs: loop.map(() => ({ x: 0, y: 0 })),
              meanFrac: 0,
              fracs: new Float64Array(loop.length),
              starved: 0,
              flipsRepaired: 0,
            }
          }
          const r = insetLoopAgainstMask(loop, bevelXY, isMaterialWorld, worldPerPx)
          bevelStarved += r.starved
          bevelFlips += r.flipsRepaired
          bevelFracSum += r.meanFrac
          return r
        })
        let bevelAchievedFrac = allLoops.length > 0 ? bevelFracSum / allLoops.length : 0

        /* ---- THE CAP'S TRIANGULATION, ON THE LOOPS IT IS ACTUALLY DRAWN AT ----
         *
         * DEFECT (fold census, 2026-07-31; FIXED 2026-07-31). The bevel path used
         * to triangulate the ORIGINAL contour and then draw those triangles at the
         * INSET positions. That is a triangulation applied to a polygon it was not
         * computed for, and on a thin form it stops being one: earcut is free to
         * emit a long chord as long as the chord stays inside the outline, and the
         * inward offset narrows the outline underneath it.
         *
         * The arithmetic on `circle`, whose band is 0.087 wide: the longest cap
         * edge is 0.6597 world units, subtending ~49 degrees on a mean radius of
         * 0.785, so its sagitta is 0.785(1 - cos 24.7 deg) = 0.072 — inside the
         * band, legally. Inset by bevelXY = 0.015 on BOTH sides the band is 0.057,
         * and 0.072 no longer fits. The chord now crosses the hole and lands on the
         * triangles coming the other way.
         *
         * MEASURED, on the SAME triangle list, both directions
         * (`scripts/verify/_probe-cap-fit.mjs`) — cap triangles overlapping each
         * other, drawn at the inset positions vs at the original ones:
         *     circle 198 -> 0    openArc 228 -> 0    square 14 -> 0
         *     crossing 37 -> 0   tick 0 -> 0
         * and the fold census follows it exactly: 53 / 59 / 4 / 1 / 0 -> all 0.
         *
         * THREE EARLIER CANDIDATES were eliminated by measurement and stay
         * eliminated: the two opposing insets crossing (band 0.0868 vs 2 x bevelXY
         * = 0.030, they cannot meet); a duplicated end point shifting the index
         * space (504 triangles for 504 points = n + 2h - 2); unnormalised winding
         * (already outer +2.1187 / hole -1.7304).
         *
         * A FOURTH — "earcut's intersection-curing fallback, fixed by reusing H2's
         * triangulation with an index map" — is DISPROVED, not merely unused. The
         * H3 call was `triangulateShape(shapePts, innerLoops)` with the same
         * arguments H2 passes, and earcut is deterministic: measured on the
         * fixtures that carry a hole, H3's index buffer was byte-identical to H2's
         * (circle 0 of 1512 indices differing, square 0 of 255). Reusing it would
         * have been a no-op. The hole-free fixtures differed only because their cap
         * came from `THREE.ShapeGeometry`, and `tick` — which differs on all 210
         * indices — reads 0 fold rays, so a differing index buffer is not the
         * defect either.
         *
         * `capFit: "source"` parks the old behaviour, and it is not an unexercised
         * guard: `scripts/verify/assert-cap-fit.mjs` requires it to FIRE. */
        if (capMappable) {
          try {
            const capOuter =
              SOLID_TUNING.capFit === "source"
                ? shapePts
                : shapePts.map((p, i) => new THREE.Vector2(p.x + insetPerLoop[0].vecs[i].x, p.y + insetPerLoop[0].vecs[i].y))
            const capHoles =
              SOLID_TUNING.capFit === "source"
                ? innerLoops
                : innerLoops.map((loop, L) =>
                    loop.map((p, i) => new THREE.Vector2(p.x + insetPerLoop[L + 1].vecs[i].x, p.y + insetPerLoop[L + 1].vecs[i].y)),
                  )
            const tri = (THREE as any).ShapeUtils.triangulateShape(capOuter, capHoles) as Array<[number, number, number]>
            const flat = new Uint32Array(tri.length * 3)
            for (let i = 0; i < tri.length; i++) {
              flat[i * 3 + 0] = tri[i][0]
              flat[i * 3 + 1] = tri[i][1]
              flat[i * 3 + 2] = tri[i][2]
            }
            mapCapIdx = flat
            mapCapTris = tri.length
            if (tri.length === 0) capMappable = false
          } catch (e) {
            capMappable = false
          }
          if (!capMappable) {
            // The rim falls back to the vertical wall, so the inset is not applied
            // and its counters would otherwise report a roll that never happened.
            bevelSegs = 0
            bevelStarved = 0
            bevelFlips = 0
            bevelAchievedFrac = 0
            for (const r of insetPerLoop) for (const v of r.vecs) { v.x = 0; v.y = 0 }
          }
        }

        /* THE Z DROP IS PER VERTEX, SCALED BY THE OFFSET THAT VERTEX ACHIEVED.
         *
         * `inFrac` was already per-vertex — it multiplies that vertex's own
         * inset vector — but `z` was a per-RING constant, so a vertex whose
         * inward offset had been clamped still dropped the FULL `bevelZ`. That
         * is not a smaller bevel, it is a CLIFF: the first band's slope is
         *
         *     atan( dz / (inFrac step x achieved inset) )
         *
         * which at the shipped 3-segment profile is atan(0.00201 / 0.0075) =
         * 15.0 degrees at full offset and atan(0.00201 / 0.00090) = 65.9
         * degrees at the ladder's bottom rung. Measured on `openArc/solid`
         * before this: 64 mixed edges in the 65-70 bin, `mixed max 84.73`, on a
         * fixture with no drawn corner anywhere — a rolled rim with a tear
         * across it, which reads worse than the die-cut edge the bevel replaced.
         *
         * Scaling the drop by the same fraction makes the slope INVARIANT in
         * that fraction — `atan(f.dz / (0.5 . f . inset))` has no `f` in it — so
         * a starved vertex gets a SMALLER quarter-round of the same shape, and
         * the rim degrades from a roll to a cut continuously. That is what this
         * function's own header has claimed since it was written ("the rim
         * degrades from a roll to a cut over a few vertices instead of the whole
         * form snapping back to a die-cut edge"); it was not true of the code.
         *
         * Two properties that make this safe rather than merely nicer:
         *   • RING 0 IS UNMOVED. At k = 0, `1 - cos(0) = 0`, so ring 0 sits at
         *     exactly +halfDepth for every vertex whatever it achieved — the cap
         *     plane stays PLANAR and the cap triangulation is untouched.
         *   • THE WALL'S XY IS UNMOVED. At k = bevelSegs, `inFrac = 0`, so the
         *     widest ring is the traced contour exactly as before. Only the z at
         *     which the wall starts moves, and only where the bevel starved.
         *
         * `zFracMin` exists so two rings can never coincide: the smallest gap in
         * the table is `bevelZ * (1 - cos(pi / 2 bevelSegs))`, and the census
         * (and any position weld) quantises at 1e-5, so the gap is floored an
         * order of magnitude clear of that. A vertex at zero achieved offset
         * then emits a 1e-4-tall vertical stub and meets the cap at 90 degrees,
         * which is the correct answer for a bevel of zero width. */
        const RINGS: { inFrac: number; zSign: number; zDrop: number }[] = []
        if (bevelSegs === 0) {
          RINGS.push({ inFrac: 0, zSign: +1, zDrop: 0 }, { inFrac: 0, zSign: -1, zDrop: 0 })
        } else {
          for (let k = 0; k <= bevelSegs; k++) {
            const phi = (k / bevelSegs) * (Math.PI / 2)
            RINGS.push({ inFrac: 1 - Math.sin(phi), zSign: +1, zDrop: bevelZ * (1 - Math.cos(phi)) })
          }
          for (let k = bevelSegs; k >= 0; k--) {
            const phi = (k / bevelSegs) * (Math.PI / 2)
            RINGS.push({ inFrac: 1 - Math.sin(phi), zSign: -1, zDrop: bevelZ * (1 - Math.cos(phi)) })
          }
        }
        const RING_COUNT = RINGS.length
        const MIN_RING_GAP = 1e-4
        const smallestGapUnit = bevelSegs > 0 ? 1 - Math.cos(Math.PI / (2 * bevelSegs)) : 0
        const zFracMin =
          bevelSegs > 0 && bevelZ * smallestGapUnit > 0
            ? Math.min(1, MIN_RING_GAP / (bevelZ * smallestGapUnit))
            : 1

        const rimVertCount = allPlans.reduce((s, p) => s + p.vertsPerRing * RING_COUNT, 0)
        const frontCapTrisH3 = capMappable ? mapCapTris : capTriCount
        const backCapTrisH3 = frontCapTrisH3
        const h3TotalVerts = rimVertCount + (capMappable ? 0 : capVertCount * 2)
        const h3TotalTris = frontCapTrisH3 * 2 + wallQuadCount * (RING_COUNT - 1) * 2

        const positions = new Float32Array(h3TotalVerts * 3)
        const indices = new Uint32Array(h3TotalTris * 3)
        let vOff = 0
        let iOff = 0
        const writeVert = (x: number, y: number, z: number) => {
          positions[vOff * 3 + 0] = x
          positions[vOff * 3 + 1] = y
          positions[vOff * 3 + 2] = z
          return vOff++
        }

        // ----- Rim ring stack (shared between outer and each inner loop) -----
        //
        // One vertex per (RING, JUNCTION) rather than per quad. A smooth junction
        // hands the same vertex to the segment on either side, so
        // computeVertexNormals averages the two faces and the half-pixel raster
        // zig-zag cancels instead of being drawn as stripes; a hard junction
        // (turn beyond WALL_CREASE_DEG) allocates a second, coincident vertex so
        // a genuine corner keeps its crease. Winding per strip is unchanged from
        // the two-ring version:
        //   A = ring r start, B = ring r end, C = ring r+1 end, D = ring r+1 start
        //   triangles (A, D, C) and (A, C, B) — right-perp normal, which points
        //   out of the body for a CCW outer loop AND for a CW hole loop.
        //   Rings are ordered front-cap-plane -> back-cap-plane, i.e. monotonic
        //   in -z, so the same winding is correct for every strip including the
        //   two bevel bands.
        const buildLoopRings = (
          plan: WallPlan,
          loop: { x: number; y: number }[],
          inset: { x: number; y: number }[],
          insetFrac: Float64Array,
        ): { front: Int32Array; back: Int32Array; li: Int32Array } | null => {
          const { segs, shareStart } = plan
          const m = segs.length
          if (m === 0) return null

          const startIdx: Int32Array[] = []
          const endIdx: Int32Array[] = []
          for (let r = 0; r < RING_COUNT; r++) {
            startIdx.push(new Int32Array(m))
            endIdx.push(new Int32Array(m))
          }
          const li = new Int32Array(m)

          for (let r = 0; r < RING_COUNT; r++) {
            const ring = RINGS[r]
            for (let j = 0; j < m; j++) {
              const idx = segs[j].li
              li[j] = idx
              const v = loop[idx]
              const iv = inset[idx]
              const x = v.x + iv.x * ring.inFrac
              const y = v.y + iv.y * ring.inFrac
              const f =
                SOLID_TUNING.rimProfile === "flat"
                  ? 1
                  : Math.max(insetFrac[idx] ?? 1, zFracMin)
              const z = ring.zSign * (halfDepth - ring.zDrop * f)
              startIdx[r][j] = writeVert(x, y, z)
              const prev = (j - 1 + m) % m
              if (shareStart[j]) {
                endIdx[r][prev] = startIdx[r][j]
              } else {
                endIdx[r][prev] = writeVert(x, y, z)
              }
            }
          }

          for (let r = 0; r + 1 < RING_COUNT; r++) {
            for (let j = 0; j < m; j++) {
              const A = startIdx[r][j]
              const B = endIdx[r][j]
              const C = endIdx[r + 1][j]
              const D = startIdx[r + 1][j]
              indices[iOff++] = A
              indices[iOff++] = D
              indices[iOff++] = C

              indices[iOff++] = A
              indices[iOff++] = C
              indices[iOff++] = B
            }
          }

          return { front: startIdx[0], back: startIdx[RING_COUNT - 1], li }
        }

        const ringResults = allPlans.map((p, i) =>
          buildLoopRings(p, allLoops[i], insetPerLoop[i].vecs, insetPerLoop[i].fracs),
        )

        // ----- Caps -----
        if (capMappable) {
          // The caps ARE ring 0 and ring RING_COUNT-1: the cap face and the first
          // bevel ring share their vertices, so the normal is averaged across that
          // junction and the cap flows into the roll. Building the cap as its own
          // vertex block instead would put a hard shading line exactly where the
          // bevel is supposed to remove one.
          const flatLoopVertCount =
            loopBase[loopBase.length - 1] + allLoops[allLoops.length - 1].length
          const toFront = new Int32Array(flatLoopVertCount)
          const toBack = new Int32Array(flatLoopVertCount)
          toFront.fill(-1)
          toBack.fill(-1)
          for (let L = 0; L < allLoops.length; L++) {
            const rr = ringResults[L]
            if (!rr) continue
            const base = loopBase[L]
            const len = allLoops[L].length
            for (let j = 0; j < rr.li.length; j++) {
              toFront[base + rr.li[j]] = rr.front[j]
              toBack[base + rr.li[j]] = rr.back[j]
            }
            // A loop point dropped by the WALL_EPSILON segment filter never
            // appears as a junction. Its position is within 1e-5 world of the
            // junction that precedes it, so the cap triangle that references it is
            // geometrically unchanged by borrowing that vertex.
            let lastF = -1
            let lastB = -1
            for (let pass = 0; pass < 2; pass++) {
              for (let i = 0; i < len; i++) {
                if (toFront[base + i] >= 0) { lastF = toFront[base + i]; lastB = toBack[base + i] }
                else if (lastF >= 0) { toFront[base + i] = lastF; toBack[base + i] = lastB }
              }
            }
          }
          for (let t = 0; t < mapCapTris; t++) {
            const a = toFront[mapCapIdx[t * 3 + 0]]
            const b = toFront[mapCapIdx[t * 3 + 1]]
            const c = toFront[mapCapIdx[t * 3 + 2]]
            indices[iOff++] = a < 0 ? 0 : a
            indices[iOff++] = b < 0 ? 0 : b
            indices[iOff++] = c < 0 ? 0 : c
          }
          for (let t = 0; t < mapCapTris; t++) {
            // Reverse winding so the back face normal points -Z.
            const a = toBack[mapCapIdx[t * 3 + 0]]
            const b = toBack[mapCapIdx[t * 3 + 1]]
            const c = toBack[mapCapIdx[t * 3 + 2]]
            indices[iOff++] = a < 0 ? 0 : a
            indices[iOff++] = c < 0 ? 0 : c
            indices[iOff++] = b < 0 ? 0 : b
          }
        } else {
          // Un-bevelled fallback: the original independent cap blocks at the two
          // cap planes, with RINGS collapsed to the two-ring vertical wall.
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
          const backBase = vOff
          for (let v = 0; v < capVertCount; v++) {
            positions[(vOff + v) * 3 + 0] = capPos[v * 3 + 0]
            positions[(vOff + v) * 3 + 1] = capPos[v * 3 + 1]
            positions[(vOff + v) * 3 + 2] = -halfDepth
          }
          vOff += capVertCount
          for (let t = 0; t < capTriCount; t++) {
            indices[iOff++] = backBase + capIdx[t * 3 + 0]
            indices[iOff++] = backBase + capIdx[t * 3 + 2]
            indices[iOff++] = backBase + capIdx[t * 3 + 1]
          }
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
          rimSmoothJunctions: rimSmoothJunctions,
          rimHardJunctions: rimHardJunctions,
          rimCreaseDeg: WALL_CREASE_DEG,
          bevelStatus: bevelSegs > 0 ? "ROLLED" : capMappableRequested ? "CUT_CAP_NOT_MAPPABLE" : "CUT_DISABLED",
          bevelSizeWorld: bevelXY,
          bevelThicknessWorld: bevelZ,
          bevelSegments: bevelSegs,
          bevelAchievedFrac: Number(bevelAchievedFrac.toFixed(3)),
          bevelStarvedVerts: bevelStarved,
          bevelFlipsRepaired: bevelFlips,
          ringCount: RING_COUNT,
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
          h3RimSmoothJunctions: rimSmoothJunctions,
          h3RimHardJunctions: rimHardJunctions,
          h3BevelStatus:
            bevelSegs > 0 ? "ROLLED" : capMappableRequested ? "CUT_CAP_NOT_MAPPABLE" : "CUT_DISABLED",
          h3BevelSizeWorld: bevelXY,
          h3BevelThicknessWorld: bevelZ,
          h3BevelSegments: bevelSegs,
          h3BevelAchievedFrac: bevelAchievedFrac,
          h3BevelStarvedVerts: bevelStarved,
          h3BevelFlipsRepaired: bevelFlips,
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
          emptyStages.solidDiagnostics.h3RimSmoothJunctions = rimSmoothJunctions
          emptyStages.solidDiagnostics.h3RimHardJunctions = rimHardJunctions
          emptyStages.solidDiagnostics.h3BevelStatus =
            bevelSegs > 0 ? "ROLLED" : capMappableRequested ? "CUT_CAP_NOT_MAPPABLE" : "CUT_DISABLED"
          emptyStages.solidDiagnostics.h3BevelSizeWorld = bevelXY
          emptyStages.solidDiagnostics.h3BevelThicknessWorld = bevelZ
          emptyStages.solidDiagnostics.h3BevelSegments = bevelSegs
          emptyStages.solidDiagnostics.h3BevelAchievedFrac = bevelAchievedFrac
          emptyStages.solidDiagnostics.h3BevelStarvedVerts = bevelStarved
          emptyStages.solidDiagnostics.h3BevelFlipsRepaired = bevelFlips
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

/** Inclusive pixel rect in mask space that holds every pixel a raster can touch. */
interface MaskRect { x0: number; y0: number; x1: number; y1: number }
/** Mask px added on each side of the canvas-rect frame (see renderStrokeToMask). */
interface RasterFramePad { kx: number; ky: number }

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
  resolution: number = MASK_RESOLUTION,
  subpathStarts?: number[],
  subpathArc?: (number | undefined)[],
  forceFramePad?: RasterFramePad
): { mask: Uint8Array, width: number, height: number, filledCount: number, coverage: Uint8Array, rasterDebug: RasterDebugInfo, rect: MaskRect, framePad: RasterFramePad } {
  // BASE FRAME: the canvas rect at `resolution` px across. baseW/baseH set the
  // mask px per canvas px, and nothing below may change that density.
  const baseW = resolution
  const baseH = Math.round(resolution * (canvasHeight / canvasWidth))
  let width = baseW
  let height = baseH
  
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
  
  // F118 ANIM-1C3 FRAME PAD: kx/ky mask px added on EACH side of the base
  // frame when the ink reaches past the canvas. 0 when the ink is inside, and
  // x + 0 is exact, so that path is byte-identical to the canvas-only raster.
  let padX = 0
  let padY = 0
  const toMaskX = (worldX: number) => {
    const pixelX = worldX / worldScale + canvasWidth / 2
    return pixelX * (baseW / canvasWidth) + padX
  }
  
  const toMaskY = (worldY: number) => {
    // Note: world Y is flipped (negative = down), but canvas Y is normal (positive = down)
    // World -> Canvas pixel: pixelY = -worldY / worldScale + canvasHeight/2
    const pixelY = -worldY / worldScale + canvasHeight / 2
    return pixelY * (baseH / canvasHeight) + padY
  }
  
  // Convert thickness from world units to mask pixels
  // thickness in world units * (maskWidth / canvasWidth) / worldScale
  const thicknessPx = thickness / worldScale * (baseW / canvasWidth)
  rasterDebug.rasterThicknessPx = thicknessPx
  
  // Reuse a single offscreen canvas across calls (this runs per rAF tick
  // during draw-in, twice per tick when counter-detection re-rasters).
  // willReadFrequently keeps the canvas on the CPU so getImageData is not a
  // GPU readback stall every frame. Sized below, once the frame is known.

  // DIRTY RECT. Every pixel the stroke can touch lies within half the line width
  // of a point (round caps and joins, and the single-point dots below use the
  // same radius), plus 2 px for antialiasing. Only this rect is cleared, read
  // back and scanned; the rest of `mask` and `coverage` stays 0, which is what
  // a whole-canvas read gave there. The ink is a small part of the canvas, so
  // this skips reading back the blank page (PLAN.md section 7, option B).
  const lineWidthPx = Math.max(1, thicknessPx) // Ensure at least 1px
  const dirtyPad = Math.ceil(lineWidthPx / 2) + 2

  // F118 ANIM-1C3 RASTER FRAME = union(canvas rect, ink bounds padded by half
  // the line width + 2 px antialiasing). The canvas-only raster dropped every
  // stroke whose ink lay past the canvas edge: Scene hands Solid the draw
  // panel (innerWidth / 2) while the ink can span more. The frame grows by
  // the same amount on both sides, so the mask centre stays the world origin
  // and mask px per canvas px stays baseW / canvasWidth; buildMaskSolid maps
  // back with the base dims. The counter re-raster passes forceFramePad so
  // both masks share one frame.
  if (forceFramePad) {
    padX = forceFramePad.kx
    padY = forceFramePad.ky
  } else if (points.length > 0) {
    const overL = dirtyPad - Math.floor(toMaskX(minX))
    const overR = Math.ceil(toMaskX(maxX)) + dirtyPad - (baseW - 1)
    const overT = dirtyPad - Math.floor(toMaskY(maxY))
    const overB = Math.ceil(toMaskY(minY)) + dirtyPad - (baseH - 1)
    padX = Math.max(0, overL, overR)
    padY = Math.max(0, overT, overB)
  }
  width = baseW + 2 * padX
  height = baseH + 2 * padY
  rasterDebug.rasterMaskWidth = width
  rasterDebug.rasterMaskHeight = height
  const ctx = getRasterCtx(width, height)
  ctx.lineWidth = lineWidthPx
  const rect: MaskRect = {
    x0: Math.max(0, Math.floor(toMaskX(minX)) - dirtyPad),
    y0: Math.max(0, Math.floor(toMaskY(maxY)) - dirtyPad),
    x1: Math.min(width - 1, Math.ceil(toMaskX(maxX)) + dirtyPad),
    y1: Math.min(height - 1, Math.ceil(toMaskY(minY)) + dirtyPad),
  }

  // Clear to black (background). The canvas is shared across calls, so an
  // earlier, larger stroke may have left white outside this rect; nothing
  // outside the rect is read.
  ctx.fillStyle = "black"
  if (rect.x1 >= rect.x0 && rect.y1 >= rect.y0) {
    ctx.fillRect(rect.x0, rect.y0, rect.x1 - rect.x0 + 1, rect.y1 - rect.y0 + 1)
  }

  // Draw stroke in white (foreground)
  ctx.strokeStyle = "white"
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  
  // PER-STROKE SUBPATHS. `points` is the whole pool concatenated; a boundary
  // between two strokes must start a NEW subpath (moveTo), not continue the
  // current one (lineTo). Continuing draws a full-thickness bar from the end of
  // one stroke to the start of the next and welds it into the mask — see the
  // `subpathStarts` doc on TestStroke. Union between strokes happens because
  // they set the same cells, never because they are connected.
  //
  // One beginPath + one stroke() for all subpaths: Canvas2D applies line caps
  // and joins per subpath, so the round cap still closes each stroke's ends,
  // and a single stroke() keeps the raster cost identical to before.
  const starts = subpathStarts && subpathStarts.length > 0 ? subpathStarts : [0]
  /* F118 SHORT CUT PIECES, in mask px: a piece whose true arc is under the line
   * width is left out of the shared path and stroked below at its own arc. The
   * width equals the arc, so the footprint is continuous from 0 and meets the
   * full-width capsule exactly when the arc reaches the width. */
  const fullWidth = ctx.lineWidth
  const arcW = subpathArc
  const shortW: (number | undefined)[] = []
  if (arcW) for (let s = 0; s < starts.length; s++) {
    const a = arcW[s]
    if (a !== undefined && Number.isFinite(a)) {
      const px = a / worldScale * (baseW / canvasWidth)
      if (px < fullWidth) shortW[s] = px
    }
  }
  let nextStart = 0
  let sub = -1
  ctx.beginPath()
  for (let i = 0; i < points.length; i++) {
    const mx = toMaskX(points[i].x)
    const my = toMaskY(points[i].y)

    if (nextStart < starts.length && i === starts[nextStart]) {
      sub = nextStart
      nextStart++
      if (shortW[sub] === undefined) ctx.moveTo(mx, my)
    } else if (shortW[sub] === undefined) {
      ctx.lineTo(mx, my)
    }
  }
  ctx.stroke()
  for (let s = 0; s < starts.length; s++) {
    const w = shortW[s]
    if (w === undefined || w < 0.5) continue
    const from = starts[s]
    const to = s + 1 < starts.length ? starts[s + 1] : points.length
    ctx.lineWidth = w
    ctx.beginPath()
    if (to - from === 1) {
      ctx.arc(toMaskX(points[from].x), toMaskY(points[from].y), w / 2, 0, Math.PI * 2)
      ctx.fillStyle = "white"
      ctx.fill()
      continue
    }
    for (let i = from; i < to; i++) {
      if (i === from) ctx.moveTo(toMaskX(points[i].x), toMaskY(points[i].y))
      else ctx.lineTo(toMaskX(points[i].x), toMaskY(points[i].y))
    }
    ctx.stroke()
  }
  ctx.lineWidth = fullWidth

  // A single-point stroke produces a subpath with no segment, which Canvas2D
  // does not stroke at all (a moveTo with no lineTo draws nothing, round cap or
  // not) — the mark would silently vanish from the mass. Stamp those as dots.
  for (let s = 0; s < starts.length; s++) {
    const from = starts[s]
    const to = s + 1 < starts.length ? starts[s + 1] : points.length
    if (to - from !== 1 || shortW[s] !== undefined) continue
    ctx.beginPath()
    ctx.arc(toMaskX(points[from].x), toMaskY(points[from].y), Math.max(0.5, ctx.lineWidth / 2), 0, Math.PI * 2)
    ctx.fillStyle = "white"
    ctx.fill()
  }
  
  // Read pixel data, the dirty rect only
  const total = width * height
  const mask = new Uint8Array(total)
  // COVERAGE: the antialiased red channel, kept rather than discarded. The
  // binary mask still drives every topological decision (components, holes,
  // validation) exactly as before; coverage is used only to place contour
  // vertices sub-pixel accurately. See snapLoopToCoverage.
  const coverage = new Uint8Array(total)
  let filledCount = 0

  if (rect.x1 >= rect.x0 && rect.y1 >= rect.y0) {
    const rw = rect.x1 - rect.x0 + 1
    const pixels = ctx.getImageData(rect.x0, rect.y0, rw, rect.y1 - rect.y0 + 1).data
    for (let y = rect.y0; y <= rect.y1; y++) {
      const src = (y - rect.y0) * rw * 4
      const row = y * width
      for (let x = rect.x0; x <= rect.x1; x++) {
        const c = pixels[src + (x - rect.x0) * 4]
        const i = row + x
        coverage[i] = c
        if (c > 127) {
          mask[i] = 1
          filledCount++
        }
      }
    }
  }

  rasterDebug.filledPixels = filledCount
  
  if (filledCount === 0) {
    rasterDebug.rasterRejected = "YES"
    rasterDebug.rasterRejectReason = `stroke bounds (${rasterDebug.rasterStrokeBoundsX}, ${rasterDebug.rasterStrokeBoundsY}) may be outside mask`
  }
  
  if (!QUIET) console.log("[v0-solid] RASTER DEBUG:", rasterDebug)
  
  return { mask, width, height, filledCount, coverage, rasterDebug, rect, framePad: { kx: padX, ky: padY } }
}

// ============= Stage 2: Connected Component Labeling =============

function labelConnectedComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  /** Where the filled pixels are (renderStrokeToMask's dirty rect). Scanning it
   *  in row-major order meets every component in the same order as a whole
   *  canvas scan, so the labels are the same. */
  rect: MaskRect,
): { labels: Int32Array, componentCount: number, componentSizes: number[] } {
  const total = width * height
  const labels = new Int32Array(total)
  const componentSizes: number[] = [0]
  let componentCount = 0
  // Preallocated BFS ring — every filled pixel enters the queue at most once,
  // so `total` is a hard upper bound. No per-pixel array allocations.
  const queue = new Int32Array((rect.x1 - rect.x0 + 1) * (rect.y1 - rect.y0 + 1))

  for (let y = rect.y0; y <= rect.y1; y++) {
    for (let x = rect.x0; x <= rect.x1; x++) {
      const idx = y * width + x
      if (mask[idx] && labels[idx] === 0) {
        componentCount++
        let size = 0

        let head = 0
        let tail = 0
        queue[tail++] = idx
        labels[idx] = componentCount

        while (head < tail) {
          const ci = queue[head++]
          size++
          const cx = ci % width
          const cy = (ci - cx) / width

          if (cy > 0) {
            const ni = ci - width
            if (mask[ni] && labels[ni] === 0) {
              labels[ni] = componentCount
              queue[tail++] = ni
            }
          }
          if (cy < height - 1) {
            const ni = ci + width
            if (mask[ni] && labels[ni] === 0) {
              labels[ni] = componentCount
              queue[tail++] = ni
            }
          }
          if (cx > 0) {
            const ni = ci - 1
            if (mask[ni] && labels[ni] === 0) {
              labels[ni] = componentCount
              queue[tail++] = ni
            }
          }
          if (cx < width - 1) {
            const ni = ci + 1
            if (mask[ni] && labels[ni] === 0) {
              labels[ni] = componentCount
              queue[tail++] = ni
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
//
// PERF NOTE (draw-in hot path): these run per rAF tick during Solid playback
// (outer contour once per frame, plus once per hole via the cropped hole
// trace). The original implementation allocated one object per lattice edge
// and chained them through a Map keyed by "x,y" template strings — string
// building + hashing dominated the trace cost on dense scribbles. This packed
// version encodes each lattice vertex as the integer y * (width + 1) + x and
// chains via a counting-sorted Int32Array bucket table. Edge emission ORDER,
// candidate selection order (insertion order, first unused), and loop closure
// rules are IDENTICAL to the original, so the traced loops are byte-identical.

interface PackedBoundaryEdges {
  /** Packed start-vertex key per edge: y * (width+1) + x */
  starts: number[]
  /** Packed end-vertex key per edge */
  ends: number[]
  /** Lattice vertex-grid width = mask width + 1 (key decode divisor) */
  vw: number
  /** Lattice vertex-grid height = mask height + 1 */
  vh: number
}

function extractBoundaryEdgesPacked(
  mask: Uint8Array,
  width: number,
  height: number
): PackedBoundaryEdges {
  const starts: number[] = []
  const ends: number[] = []
  const vw = width + 1

  for (let y = 0; y < height; y++) {
    const row = y * width
    const vTop = y * vw
    const vBot = (y + 1) * vw
    for (let x = 0; x < width; x++) {
      if (!mask[row + x]) continue

      // Top edge: (x, y) -> (x+1, y)
      if (y === 0 || !mask[row - width + x]) {
        starts.push(vTop + x)
        ends.push(vTop + x + 1)
      }

      // Bottom edge (reversed for CCW): (x+1, y+1) -> (x, y+1)
      if (y === height - 1 || !mask[row + width + x]) {
        starts.push(vBot + x + 1)
        ends.push(vBot + x)
      }

      // Left edge (reversed for CCW): (x, y+1) -> (x, y)
      if (x === 0 || !mask[row + x - 1]) {
        starts.push(vBot + x)
        ends.push(vTop + x)
      }

      // Right edge: (x+1, y) -> (x+1, y+1)
      if (x === width - 1 || !mask[row + x + 1]) {
        starts.push(vTop + x + 1)
        ends.push(vBot + x + 1)
      }
    }
  }

  return { starts, ends, vw, vh: height + 1 }
}

/**
 * Chain packed boundary edges into loops. Semantics match the original
 * Map<string, Edge[]> implementation exactly:
 *   - outer iteration in edge-emission order
 *   - next-edge candidates considered in emission (insertion) order,
 *     first unused wins
 *   - loop closes when the walk returns to the start vertex with > 2 points
 *   - loops shorter than 3 points are discarded
 */
function chainPackedLoops(packed: PackedBoundaryEdges): Point2D[][] {
  const { starts, ends, vw, vh } = packed
  const m = starts.length
  if (m === 0) return []

  const keySpan = vw * vh
  // Stable counting sort of edge indices by start key.
  const bucketOffsets = new Int32Array(keySpan + 1)
  for (let e = 0; e < m; e++) bucketOffsets[starts[e] + 1]++
  for (let k = 0; k < keySpan; k++) bucketOffsets[k + 1] += bucketOffsets[k]
  const bucketEdges = new Int32Array(m)
  const fillPos = bucketOffsets.slice(0, keySpan)
  for (let e = 0; e < m; e++) bucketEdges[fillPos[starts[e]]++] = e

  const used = new Uint8Array(m)
  const loops: Point2D[][] = []

  for (let e0 = 0; e0 < m; e0++) {
    if (used[e0]) continue

    const loop: Point2D[] = []
    let cur = e0
    const startKey = starts[e0]

    while (cur >= 0 && !used[cur]) {
      used[cur] = 1
      const sk = starts[cur]
      const sx = sk % vw
      loop.push({ x: sx, y: (sk - sx) / vw })

      const nextKey = ends[cur]
      if (nextKey === startKey && loop.length > 2) break

      let next = -1
      const b1 = bucketOffsets[nextKey + 1]
      for (let b = bucketOffsets[nextKey]; b < b1; b++) {
        const cand = bucketEdges[b]
        if (!used[cand]) {
          next = cand
          break
        }
      }
      cur = next
    }

    if (loop.length >= 3) loops.push(loop)
  }

  return loops
}

function traceOuterContour(mask: Uint8Array, width: number, height: number): Point2D[] {
  const packed = extractBoundaryEdgesPacked(mask, width, height)
  if (packed.starts.length === 0) return []
  const loops = chainPackedLoops(packed)
  if (loops.length === 0) return []

  // Longest loop by point count (strictly greater keeps the first on ties —
  // same rule as the original chainBoundaryEdges).
  let longest = loops[0]
  for (const loop of loops) {
    if (loop.length > longest.length) {
      longest = loop
    }
  }
  return longest
}

// H2 helper: collect ALL boundary loops, return the one with the largest
// enclosed (mask-space) area. Defends against pinch-point vertex-sharing
// bugs in edge chaining that could split a single hole's boundary into
// multiple sub-loops and previously made us pick "longest" (which is not
// always the same as "the real outer of the empty region").
function traceLargestAreaContour(
  mask: Uint8Array,
  width: number,
  height: number
): Point2D[] {
  const packed = extractBoundaryEdgesPacked(mask, width, height)
  if (packed.starts.length === 0) return []
  const loops = chainPackedLoops(packed)
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

/**
 * SIGNED POLYGON AREA — the ONE implementation in this module, CROSS form
 * `Σ(x₁y₂ − x₂y₁)/2`. Positive = CCW in world space.
 *
 * Typed on the structural `{x, y}` rather than `THREE.Vector2` so `shoelaceAbs`
 * (which was a second, identical copy of this loop) can delegate to it without
 * boxing a `Point2D` into a Vector2 — that boxing would be a real allocation on
 * a hot contour path, and the merge is only worth doing if it is free.
 *
 * ⚠ NOT merged with `lib/geometry-engines.ts`'s `signedAreaRaw`, which uses the
 * TRAPEZOID form. They agree in sign and to within float error, not bit for
 * bit — see the note there.
 */
function signedAreaOf(pts: { x: number; y: number }[]): number {
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
  // Mask-space bbox origin (minX,minY) per valid hole, parallel to
  // validHoleBboxes. Lets H2 trace each hole inside its own bbox crop
  // instead of rescanning the full mask per hole.
  validHoleBboxMin: Array<{ x: number; y: number }>
  // Mask-space centroid per valid hole (exact integer-sum / size, accumulated
  // during the flood fill), parallel to validHoleLabelIds. Replaces the old
  // per-hole full-mask centroid rescan in counter-preserving detection.
  validHoleCentroids: Array<{ x: number; y: number }>
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
  componentMask: Uint8Array,
  width: number,
  height: number,
  /**
   * Resolution scale relative to MASK_RESOLUTION (1 for static/export builds,
   * <1 for reduced-resolution animated builds). Pixel-count thresholds scale
   * with it (area by resScale^2, lengths by resScale) so hole-topology
   * decisions are resolution-independent.
   */
  resScale: number = 1,
  /** Where the filled pixels are; the ink's bbox is searched inside it only. */
  rect: MaskRect = { x0: 0, y0: 0, x1: width - 1, y1: height - 1 },
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
    // Integer coordinate sums for exact centroid (sumX/size, sumY/size).
    sumX: number
    sumY: number
  }

  const rawComponents: RawComponent[] = []

  // BOUNDED FLOOD. Every pixel outside the filled pixels' bbox is empty and
  // joined to the canvas edge, so a 1 px ring around that bbox is exterior. An
  // empty region that reaches the ring (or the canvas edge, where the box is
  // clamped) is the exterior; one that does not is enclosed, exactly as in a
  // full-canvas scan. Scan order inside the box is the full scan's row-major
  // order, so hole label ids come out the same. The ink is a small part of the
  // canvas, so this skips flooding the blank page (was 41 % of a Solid build,
  // docs/research-2026-09-25/solid/PLAN.md section 6). `emptyLabels` stays full
  // size: the per-hole crop in buildMaskSolid indexes it by canvas pixel.
  // Only `borderTouchingEmptyCount` (debug panel) can differ: exterior pockets
  // outside the box are no longer counted.
  let bx0 = width, by0 = height, bx1 = -1, by1 = -1
  for (let y = rect.y0; y <= rect.y1; y++) {
    const row = y * width
    for (let x = rect.x0; x <= rect.x1; x++) {
      if (componentMask[row + x]) {
        if (x < bx0) bx0 = x
        if (x > bx1) bx1 = x
        if (y < by0) by0 = y
        if (y > by1) by1 = y
      }
    }
  }
  if (bx1 < 0) { bx0 = 0; by0 = 0; bx1 = width - 1; by1 = height - 1 }
  const x0 = Math.max(0, bx0 - 1)
  const y0 = Math.max(0, by0 - 1)
  const x1 = Math.min(width - 1, bx1 + 1)
  const y1 = Math.min(height - 1, by1 + 1)

  let labelCounter = 0
  // Preallocated BFS ring: every empty pixel of the box enters the queue at most once.
  const queue = new Int32Array((x1 - x0 + 1) * (y1 - y0 + 1))

  // Flood-fill (4-connected) over the *empty* pixels of the box.
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const idx = y * width + x
      if (componentMask[idx] || emptyLabels[idx] !== 0) continue

      labelCounter++
      let size = 0
      let touchesBorder = false
      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let sumX = 0
      let sumY = 0

      let head = 0
      let tail = 0
      queue[tail++] = idx
      emptyLabels[idx] = labelCounter

      while (head < tail) {
        const ci = queue[head++]
        size++
        const cx = ci % width
        const cy = (ci - cx) / width

        if (cx === x0 || cy === y0 || cx === x1 || cy === y1) touchesBorder = true
        if (cx < minX) minX = cx
        if (cx > maxX) maxX = cx
        if (cy < minY) minY = cy
        if (cy > maxY) maxY = cy
        sumX += cx
        sumY += cy

        // 4-neighbours, inside the box
        if (cy > y0) {
          const ni = ci - width
          if (!componentMask[ni] && emptyLabels[ni] === 0) {
            emptyLabels[ni] = labelCounter
            queue[tail++] = ni
          }
        }
        if (cy < y1) {
          const ni = ci + width
          if (!componentMask[ni] && emptyLabels[ni] === 0) {
            emptyLabels[ni] = labelCounter
            queue[tail++] = ni
          }
        }
        if (cx > x0) {
          const ni = ci - 1
          if (!componentMask[ni] && emptyLabels[ni] === 0) {
            emptyLabels[ni] = labelCounter
            queue[tail++] = ni
          }
        }
        if (cx < x1) {
          const ni = ci + 1
          if (!componentMask[ni] && emptyLabels[ni] === 0) {
            emptyLabels[ni] = labelCounter
            queue[tail++] = ni
          }
        }
      }

      rawComponents.push({ labelId: labelCounter, size, touchesBorder, minX, minY, maxX, maxY, sumX, sumY })
    }
  }

  // Detected = empty components that do NOT touch the image border.
  // Anything touching the border is "outside background" and is not a hole.
  const detected = rawComponents.filter((c) => !c.touchesBorder)
  const borderTouchingEmptyCount = rawComponents.length - detected.length
  
  // Conservative filtering pass.
  // Track (area, labelId, bbox, centroid) so we can sort and return per-hole data.
  const validPairs: Array<{
    area: number
    labelId: number
    bw: number
    bh: number
    bx: number
    by: number
    cx: number
    cy: number
  }> = []
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
      validPairs.push({
        area: c.size,
        labelId: c.labelId,
        bw,
        bh,
        bx: c.minX,
        by: c.minY,
        cx: c.sumX / c.size,
        cy: c.sumY / c.size,
      })
    }
  }

  validPairs.sort((a, b) => b.area - a.area)
  rejectedHoleAreas.sort((a, b) => b - a)
  const validAreas = validPairs.map((p) => p.area)
  const validHoleLabelIds = validPairs.map((p) => p.labelId)
  const validHoleBboxes = validPairs.map((p) => ({ w: p.bw, h: p.bh }))
  const validHoleBboxMin = validPairs.map((p) => ({ x: p.bx, y: p.by }))
  const validHoleCentroids = validPairs.map((p) => ({ x: p.cx, y: p.cy }))
  
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
    validHoleBboxMin,
    validHoleCentroids,
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
