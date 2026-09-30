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
import type { ClippedPiece } from "@/lib/stroke-schedule"
import { buildMaskSolid, type TestStroke, type MaskSolidResult } from "@/lib/solid-mask"
import {
  polygoniseCapsuleField,
  applyImplicitZAspect,
  type ImplicitCapsule,
  type ImplicitBuildStats,
  type ImplicitBuildResult,
} from "@/lib/implicit-surface"
// The off-thread scheduler is a SEPARATE module on purpose: the worker imports
// `implicit-surface`, so a `new Worker(new URL(...))` inside that file would
// close a cycle through a worker entry and deadlock Turbopack's compile. See
// the header of lib/implicit-defer.ts.
import { polygoniseCapsuleFieldForSlot, IMPLICIT_DEFER_DEBUG } from "@/lib/implicit-defer"
import { MATERIAL_PARAMS, type MaterialParams } from "@/lib/style-system"
import {
  EXTRUDE_DRAFT_AMOUNT,
  applyDraftTaperAbout,
  type ExtrudeSideWall,
} from "@/lib/dd-extrude-relief"

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
  /** How many disjoint ink masses this drawing resolved to. 1 = the old
   *  single-build path. >1 means separate marks were each given their own
   *  mass instead of all but the biggest being dropped. */
  clusterCount: 1,
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
  // Stage isolation debug - populated when stage rendering is active.
  // With several clusters this is the HEAD cluster's stages, except that
  // `solidDiagnostics.stableHolesWorld` and `.detectedPartialHoleCentroidsWorld`
  // hold every cluster's holes (see mergeSolidResults).
  lastStages: null as any,
  /** Every cluster's own stages, head first. One entry on the single-build path. */
  lastClusterStages: [] as any[],
  /** Per override hole (the order Scene passed them): which cluster got it, -1 for
   *  none. Empty when the build had no override. */
  holeOverrideClusterOwners: [] as number[],
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
 * Live diagnostic state for Solid H3 draw-in animation.
 *
 * Written from `Scene` in `components/viewport-3d.tsx` while playback is
 * active (or transitioning). Read by `SolidDebugOverlay` via its 100ms
 * polling loop, so no new prop plumbing is needed.
 *
 * Hard rules:
 *   - Animation diagnostics ONLY. Never used by geometry building.
 *   - All numbers are pure observations; mutating them must not change
 *     mesh output, hole detection, or export behavior.
 *   - `solidAnimationUsesArcLength` and `solidAnimationInterpolatedCutPoint`
 *     are constants ("YES") locked by the implementation of
 *     `filterStrokesByProgress`. They exist so the panel can prove the
 *     reveal is arc-length based, not point-count based.
 */
export const SOLID_ANIM_DEBUG = {
  /**
   * Which animation strategy the last build went through. Set by `Scene` on
   * every render so the debug overlay can prove the right path is in use:
   *   - "drawRange"                              -> Rod (per-segment drawRange in AnimatedStrokes)
   *   - "drawRangeImplicit"                      -> Inflate/implicit (build-time reveal table + drawRange)
   *   - "partialExtrudeRebuild"                  -> Extrude (animatedStrokes → ExtrudeGeometry rebuild)
   *   - "partialSolidRebuildWithHoleStabilization" -> Solid (animatedStrokes → buildMaskSolid w/ override)
   *   - "partialInflateRebuild"                  -> Inflate/loft (animatedStrokes → tube loft rebuild)
   *   - "static"                                 -> Not animating
   */
  animationPath:
    "static" as
      | "static"
      | "drawRange"
      | "drawRangeImplicit"
      | "partialExtrudeRebuild"
      | "partialSolidRebuildWithHoleStabilization"
      | "partialInflateRebuild",
  /** True while `playing === true` in Solid or Extrude mode, or while a boundary sync is in flight. */
  solidAnimationActive: false,
  /** Last value pushed to `solidAnimProgress` (0..1). Tracks the rebuild input. */
  solidAnimationProgress: 0,
  /** Incremented every time `animatedStrokes` useMemo recomputes for a partial reveal. */
  solidAnimationRebuildCount: 0,
  /** Total points in the partial stroke output fed to `useStrokeMeshes`. */
  animatedStrokePointCount: 0,
  /** Arc length of the animated subset (matches what filterStrokesByProgress emitted). */
  animatedVisibleArcLength: 0,
  /** Arc length of the full strokes input (the denominator for `progress`). */
  animatedTotalArcLength: 0,
  /** Constant proof that reveal is arc-length based (locked by filterStrokesByProgress). */
  solidAnimationUsesArcLength: "YES" as "YES" | "NO",
  /** Constant proof the active segment uses a sub-segment interpolated cut point. */
  solidAnimationInterpolatedCutPoint: "YES" as "YES" | "NO",
  /** "YES" once the last build was at progress >= 1 (final frame == static). */
  finalFrameMatchesStatic: "NO" as "YES" | "NO",
  /** Last validHoleCount observed in animated builds (for topology stability tracking). */
  validHoleCount: 0,
  /** Number of times validHoleCount changed across consecutive animated builds. */
  topologyChangeCount: 0,
  // ---- Hole stabilization (activation state machine) ----
  /** Count of holes in the final-pass reference snapshot taken at Play start. */
  finalHoleReferenceCount: 0,
  /** Count of final holes currently activated by the per-frame state machine. */
  activatedFinalHoleCount: 0,
  /** Per-final-hole hit streak (frames in a row where a partial centroid matched). */
  perHoleHitStreaks: [] as number[],
  /** Per-final-hole miss streak (frames in a row with no partial centroid match). */
  perHoleMissStreaks: [] as number[],
  /** World-space match tolerance applied per final hole (parallel array). */
  perHoleActivationRadiusWorld: [] as number[],
  /** Last reported reject reasons from the buildMaskSolid safety filter. */
  holeStabilizationLastReasons: [] as string[],
  /** Did the last build write `holeStabilizationActive = YES`? */
  holeStabilizationActive: "NO" as "YES" | "NO",
  /** Frame counter — how many partial centroids the matcher saw last update. */
  lastPartialCentroidCount: 0,
  // ---- Solid animation hole stabilization (CURRENT STRATEGY) ----
  //
  // Active strategy: STICKY_FINAL_HOLE_CONTOURS.
  //
  // DEPRECATED / removed strategies — intentionally absent from this union
  // so any caller still referencing them produces a TypeScript error:
  //   - "LIVE_DETECTION"                      (no centroid-PIP override, deprecated)
  //   - "FILLED_DURING_REVEAL_COMMIT_AT_END" (filled-blob reveal, abandoned)
  /** Active animation hole strategy label. */
  solidAnimationHoleMode:
    "STICKY_FINAL_HOLE_CONTOURS" as "STICKY_FINAL_HOLE_CONTOURS",
  /** Number of final static H3 holes captured at Play start (0 if no holes). */
  finalStaticHoleCount: 0,
  /** Number of holes actively attached to the cap THIS frame. */
  animatedActiveHoleCount: 0,
  /** Number of final holes matched at least once but not yet streak-confirmed. */
  pendingHoleCount: 0,
  /** Indices (snapshot order) of final holes currently active this frame. */
  activeHoleIds: [] as number[],
  /** solidAnimProgress at which each final hole flipped to active (NaN before activation). */
  holeActivationProgress: [] as number[],
  /** Where this frame's hole contours come from. */
  holeSourceDuringAnimation:
    "FINAL_STATIC_FOR_ACTIVE_NONE_OTHERWISE" as
      | "FINAL_STATIC_FOR_ACTIVE_NONE_OTHERWISE"
      | "STATIC",
  /** "YES" once at least one final-static contour is in use this session. */
  usingFinalHoleContoursForAnimation: "NO" as "YES" | "NO",
  /** "YES" when validHoleCount on the final committed frame matches finalStaticHoleCount. */
  finalFrameHoleMatch: "NO" as "YES" | "NO",
  /** "YES" if the first frame of the latest playback painted with progress at the start. */
  firstFrameResetClean: "NO" as "YES" | "NO",
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
/**
 * End-cap spheres. Same rule as JOINT_SPHERE_SEGMENTS below: a sphere welded
 * into the tube must not be COARSER than the tube, or the weld itself becomes
 * the crease. At 14 the cap's facets were 25.7° against the tube's 22.5°, so
 * the smoother surface ended at a visibly blockier hemisphere — measurable in
 * the dihedral census as a cap-bucket max above the tube's own facet angle.
 */
export const SPHERE_SEGMENTS = RADIAL_SEGMENTS
/**
 * Joint spheres fill the wedge gap on the OUTSIDE of a sharp corner, where two
 * consecutive tube cross-sections don't meet. They are the same radius as the
 * tube, so the vast majority of each sphere is buried inside the tube itself —
 * only a small cap is ever visible, and only at corners.
 *
 * HISTORY, because the old value was a symptom treating a symptom. It read:
 *
 *   "At SPHERE_SEGMENTS (14x14 = 225 verts) a scribble with hundreds of
 *    detected corners was exporting 10.7 MB of GLB, nearly all of it buried
 *    sphere. 8x8 (81 verts) is 2.8x cheaper and indistinguishable at the scale
 *    a joint actually occupies on screen."
 *
 * "Hundreds of detected corners" on a scribble was `detectJoints3D` firing its
 * INVERTED predicate on every straight sample (see its block comment). So the
 * export blowup was the bug, and 8 segments — 45° per facet, twice as coarse as
 * the 16-sided tube the sphere is meant to hide inside — was the compensation.
 * Under gloss the compensation is the defect: the dihedral census measured a
 * 44.22° max crease on EVERY Rod fixture, in all three buckets.
 *
 * With the predicate fixed, a two-stroke crossing detects a handful of joints
 * instead of ~160, so there is nothing left to trade. The rule that replaces the
 * number: **no sphere welded into the tube may be coarser than the tube**, so
 * both the joint and cap spheres take RADIAL_SEGMENTS. A joint can then only
 * ever remove a crease, never add one.
 */
export const JOINT_SPHERE_SEGMENTS = RADIAL_SEGMENTS
export const JOINT_ANGLE_THRESHOLD_DEG = 40
/**
 * Minimum spacing between consecutive joint spheres, world units.
 *
 * ⚠ THIS CONSTANT WAS DEAD, AND IT HAD DRIFTED 28% FROM THE NUMBER ACTUALLY
 * USED. `detectJoints3D` computed its own `const jointDedup = TUBE_RADIUS * 1.8`
 * (= 0.0216) inline and never read this export, which still said 0.03 — the
 * pre-1.8× value. Nothing else in the repo referenced it either (grepped), so
 * the only thing it could do was mislead a reader into believing the dedup
 * radius was 39% larger than it is.
 *
 * It is now DERIVED from the two numbers it depends on and READ at the one call
 * site, so it cannot drift again: 0.0216 is exactly what `detectJoints3D` was
 * already using, and the geometry baseline is byte-identical across the change.
 * `1.8` is the multiplier the joint-bead pass landed on — at 0.75× consecutive
 * spheres overlapped almost entirely, and 1.8× still leaves adjacent joints
 * touching (a sphere spans 2× radius) so real corners stay filled.
 */
export const JOINT_MIN_DISTANCE = TUBE_RADIUS * 1.8
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
  /**
   * Side-wall family, ported from Desk Doodles (`EXTRUDE_SIDE_WALL`):
   * `straight` = vertical walls; `drafted` = walls taper toward the BACK face,
   * the pressed/moulded read. See lib/dd-extrude-relief.ts for the taper and
   * `applyDraftTaperAbout` for why the centre has to be supplied rather than
   * taken from each stroke's own bbox.
   */
  sideWall: ExtrudeSideWall
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
 * EXTRUDE WIDTH NONLINEAR SLIDER MAPPING
 *
 * The Width slider is exposed as a normalized t in [0, 1]. The
 * mapping from t to the effective half-width is a quadratic curve
 * tuned so the practical "clean" zone covers more than half of the
 * slider:
 *
 *   width(t) = WIDTH_SLIDER_FLOOR + (WIDTH_SLIDER_CEIL - FLOOR) * t^p
 *
 * with the curve calibrated so:
 *
 *   t = 0.00 -> 0.020   (very thin, always clean)
 *   t = 0.25 -> 0.024   (thin, clean)
 *   t = 0.50 -> 0.035   (default, clean/bold)
 *   t = 0.75 -> 0.054   (heavy but still controlled)
 *   t = 1.00 -> 0.080   (chunky / experimental territory)
 *
 * The previous LINEAR slider mapped mid (0.0475) into the messy
 * zone of the segmented-fallback join behavior. With the quadratic
 * curve, t = 0.5 produces 0.035 — the original DEFAULT effective
 * width — so by definition the middle of the slider now feels
 * exactly like "clean default". Slider positions above ~0.75 are
 * where the user-acceptable "this starts to get chunky" range
 * begins; only the last ~25% of slider travel ever reaches the
 * known-breaking widths.
 *
 * The effective-width clamp inside computeEffectiveWidth is still
 * applied AFTER mapping, so even a future caller that bypasses
 * this mapping cannot drive geometry outside the safe envelope.
 * ============================================================ */
export const EXTRUDE_WIDTH_SLIDER_MIN = 0
export const EXTRUDE_WIDTH_SLIDER_MAX = 1
export const EXTRUDE_WIDTH_SLIDER_STEP = 0.01
export const EXTRUDE_WIDTH_SLIDER_DEFAULT = 0.5
const EXTRUDE_WIDTH_SLIDER_FLOOR = 0.020
const EXTRUDE_WIDTH_SLIDER_CEIL = 0.080
const EXTRUDE_WIDTH_SLIDER_EXP = 2.0

/**
 * Map a normalized Width slider value `t in [0, 1]` to the effective
 * extrude half-width. Always returns a finite value inside the
 * absolute effective-width clamp envelope.
 *
 * Inverse helper (`extrudeWidthToSlider`) exists for diagnostics so
 * the debug panel can show "what slider position produced this width"
 * even if a caller passed a raw width into ExtrudeParams directly.
 */
export function mapExtrudeWidthSlider(t: number): number {
  if (!isFinite(t)) return EXTRUDE_WIDTH_DEFAULT
  const clamped = Math.min(1, Math.max(0, t))
  const raw =
    EXTRUDE_WIDTH_SLIDER_FLOOR +
    (EXTRUDE_WIDTH_SLIDER_CEIL - EXTRUDE_WIDTH_SLIDER_FLOOR) *
      Math.pow(clamped, EXTRUDE_WIDTH_SLIDER_EXP)
  return Math.min(
    EXTRUDE_EFFECTIVE_WIDTH_CEILING,
    Math.max(EXTRUDE_EFFECTIVE_WIDTH_FLOOR, raw),
  )
}

/** Inverse of `mapExtrudeWidthSlider` — diagnostics only. */
export function extrudeWidthToSlider(width: number): number {
  if (!isFinite(width)) return EXTRUDE_WIDTH_SLIDER_DEFAULT
  const span = EXTRUDE_WIDTH_SLIDER_CEIL - EXTRUDE_WIDTH_SLIDER_FLOOR
  if (span <= 0) return EXTRUDE_WIDTH_SLIDER_DEFAULT
  const ratio = (width - EXTRUDE_WIDTH_SLIDER_FLOOR) / span
  if (ratio <= 0) return 0
  if (ratio >= 1) return 1
  return Math.pow(ratio, 1 / EXTRUDE_WIDTH_SLIDER_EXP)
}

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

/**
 * CLAMP THAT ACTUALLY CLAMPS — `Math.max(lo, Math.min(hi, NaN))` IS NaN.
 *
 * `Math.min(0.5, NaN)` is NaN and `Math.max(0.02, NaN)` is NaN, so the
 * two-sided clamp every slider map in this file is written with looks like a
 * guard and passes NaN straight through. `computeEffectiveExtrudeDepth` had
 * caught this (`if (!isFinite(raw) || raw <= 0) return FLOOR`); its two Solid
 * siblings had not, which is the same "fixed in one place, left in the other"
 * shape as the inverted corner predicate in `lib/stroke-processing.ts`.
 *
 * MEASURED, on the real builders (`scripts/verify/_probe-nan-params.mjs`,
 * gated by `assert-param-guards.mjs`):
 *   · `solidParams.depth = NaN` on `circle/solid` -> **2016 of 6048 positions
 *     non-finite**, returned as ONE valid mesh with a vertex count, a triangle
 *     count and a NaN bounding box. On `tick/inflate`, 1264 of 1266.
 *   · `solidParams.thickness = NaN` -> `ctx.lineWidth = NaN`, which Canvas2D's
 *     spec IGNORES, so the rasteriser silently keeps the PREVIOUS build's
 *     width. Two identical NaN requests produced 12288/23028 after a thin build
 *     and 12288/24576 after a fat one — the same input, two different marks,
 *     decided by whatever was rendered before.
 *
 * Non-finite input is floored to `lo` rather than to a midpoint: a mark that
 * comes back at the thinnest/shallowest legal setting reads as obviously wrong,
 * where one at the default reads as correct and hides the bad channel.
 * `+Infinity` already clamped to `hi` through `Math.min` and still does.
 */
function clampParam(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return Number.isNaN(v) ? lo : v > 0 ? hi : lo
  return Math.max(lo, Math.min(hi, v))
}

/** Map a width-relative multiplier (`depth` slider value) + effective width
 *  to a calibrated world-space depth that won't visually explode. */
export function computeEffectiveExtrudeDepth(multiplier: number, effectiveWidth: number): number {
  const raw = multiplier * effectiveWidth
  if (!isFinite(raw) || raw <= 0) return EXTRUDE_EFFECTIVE_DEPTH_FLOOR
  return Math.min(EXTRUDE_EFFECTIVE_DEPTH_CEILING, Math.max(EXTRUDE_EFFECTIVE_DEPTH_FLOOR, raw))
}

/** Desk Doodles' `rounded` profile segment count (EXTRUDE_BEVEL_SEGMENTS,
 *  strokeTo3d.ts:173). Full provenance on the bevel-profile block further down,
 *  next to `ribbonProfileRows`, which is what consumes it. */
const EXTRUDE_BEVEL_SEGMENTS_ROUNDED = 3

export const DEFAULT_EXTRUDE_PARAMS: ExtrudeParams = {
  width: EXTRUDE_WIDTH_DEFAULT,
  // NOTE: this is a MULTIPLIER, not raw depth. See block comment above.
  depth: EXTRUDE_DEPTH_MULTIPLIER_DEFAULT,
  bevelEnabled: true,
  // PORTED: desk-doodles EXTRUDE_BEVEL_SIZE 0.05 × 0.3 (world-scale conversion,
  // see the bevel-profile block above) = 0.015 — the value already here, which
  // is the cross-check that the conversion is right.
  bevelSize: 0.015,
  // PORTED: desk-doodles EXTRUDE_BEVEL_SEGMENTS (its `rounded` profile). Was 2
  // and unread — the ribbon builder never looked at this field, so every bevel
  // was one flat chamfer regardless. 3 gives the rim a curved band instead of a
  // second hard crease.
  bevelSegments: EXTRUDE_BEVEL_SEGMENTS_ROUNDED,
  // PORTED but OFF by default. Desk Doodles' own default is `straight` too, and
  // switching every Extrude silhouette to a moulded read is a judgement Sebs has
  // not made — see the note on `applyDraftTaperAbout`. It is now REACHABLE
  // (config strip + `__styleHarness.setExtrude`) rather than dead code.
  sideWall: "straight",
}

/** Solid-mode parameters */
export interface SolidParams {
  thickness: number   // raw slider value (px) — calibration is applied inside SolidEngine
  depth: number       // raw slider value (world units) — calibration is applied inside SolidEngine
}

// =============================================================================
// SOLID H3 CONTROL CALIBRATION
// =============================================================================
// The Solid Thickness and Depth sliders are EXPOSED in raw user-facing units
// but the SolidEngine maps them through nonlinear curves before they reach
// `buildMaskSolid`. This keeps the UI scale familiar while ensuring the
// breaking territory of H3 (counters collapsing, mesh feeling chunky/broken)
// lives in the upper 20–25% of each slider instead of the middle.
//
// Identity rule: if the user later wants to disable calibration, set both
// curves to 1.0 and effective[min/max] equal to slider[min/max].
// =============================================================================

// --- Thickness slider (raw px fed to canvas lineWidth before calibration) ----
export const SOLID_THICKNESS_SLIDER_MIN = 4
export const SOLID_THICKNESS_SLIDER_MAX = 64
export const SOLID_THICKNESS_SLIDER_STEP = 2
export const SOLID_THICKNESS_SLIDER_DEFAULT = 38   // was 24 — calibrated to land at ~22px effective

// Effective thickness range — what actually feeds canvas lineWidth.
// effectiveMin keeps low-end strokes thin but stable.
// effectiveMax caps how chunky H3 can get even at slider=max; this is what
// pushes "breaking territory" to the far end of the slider instead of middle.
const SOLID_THICKNESS_EFFECTIVE_MIN = 4
const SOLID_THICKNESS_EFFECTIVE_MAX = 44

// Curve > 1 compresses growth at the low end and accelerates at the high end.
// 1.35 was chosen so that:
//   slider=24 → effective ≈ 13   (was raw 24)
//   slider=38 → effective ≈ 22   (new default — feels bold but stable)
//   slider=40 → effective ≈ 24   (today's breaking point now safe)
//   slider=56 → effective ≈ 37   (chunky but coherent)
//   slider=64 → effective ≈ 44   (max — experimental/breaking territory)
const SOLID_THICKNESS_CURVE = 1.35

// --- Depth slider (raw world units fed as halfDepth*2 into H3 before calibration) ---
export const SOLID_DEPTH_SLIDER_MIN = 0.02
export const SOLID_DEPTH_SLIDER_MAX = 0.5
export const SOLID_DEPTH_SLIDER_STEP = 0.01
export const SOLID_DEPTH_SLIDER_DEFAULT = 0.18    // was 0.15 — modest bump for a more 3D default

// Effective depth range — what actually feeds H3 extrusion Z extent.
const SOLID_DEPTH_EFFECTIVE_MIN = 0.02
const SOLID_DEPTH_EFFECTIVE_MAX = 0.5

// Mild curve on depth so mid-slider isn't overly chunky in Z; max stays expressive.
const SOLID_DEPTH_CURVE = 1.2

/** Maps the raw Thickness slider value (px, 4..64) to an effective px value
 *  consumed by canvas lineWidth and the H3 outer/inner wall pipeline.
 *  Pure function. Used by BOTH `SolidEngine.buildPreview` and `buildExport`
 *  so preview/export parity is exact. */
export function computeSolidEffectiveThicknessPx(sliderPx: number): number {
  /* `clampParam`, not `Math.max(lo, Math.min(hi, …))` — see its note: the
   * plain form returns NaN for NaN, and a NaN here becomes a `ctx.lineWidth`
   * assignment Canvas2D silently ignores. */
  const clamped = clampParam(
    sliderPx,
    SOLID_THICKNESS_SLIDER_MIN,
    SOLID_THICKNESS_SLIDER_MAX
  )
  const n =
    (clamped - SOLID_THICKNESS_SLIDER_MIN) /
    (SOLID_THICKNESS_SLIDER_MAX - SOLID_THICKNESS_SLIDER_MIN)
  return (
    SOLID_THICKNESS_EFFECTIVE_MIN +
    Math.pow(n, SOLID_THICKNESS_CURVE) *
      (SOLID_THICKNESS_EFFECTIVE_MAX - SOLID_THICKNESS_EFFECTIVE_MIN)
  )
}

/** Maps the raw Depth slider value (world units, 0.02..0.5) to an effective
 *  depth value consumed by H3 extrusion Z extent. Pure function — same
 *  preview/export parity guarantee as the thickness mapping. */
export function computeSolidEffectiveDepth(sliderDepth: number): number {
  /* `clampParam`, not `Math.max(lo, Math.min(hi, …))` — see its note. A NaN
   * here made every vertex Z NaN and the build still reported success. */
  const clamped = clampParam(
    sliderDepth,
    SOLID_DEPTH_SLIDER_MIN,
    SOLID_DEPTH_SLIDER_MAX
  )
  const n =
    (clamped - SOLID_DEPTH_SLIDER_MIN) /
    (SOLID_DEPTH_SLIDER_MAX - SOLID_DEPTH_SLIDER_MIN)
  return (
    SOLID_DEPTH_EFFECTIVE_MIN +
    Math.pow(n, SOLID_DEPTH_CURVE) *
      (SOLID_DEPTH_EFFECTIVE_MAX - SOLID_DEPTH_EFFECTIVE_MIN)
  )
}

export const DEFAULT_SOLID_PARAMS: SolidParams = {
  thickness: SOLID_THICKNESS_SLIDER_DEFAULT,
  depth: SOLID_DEPTH_SLIDER_DEFAULT,
}

/* ============================================================
 * INFLATE FUSION CONTROLS
 *
 * Inflate has two surface strategies, and this is the switch between them.
 *
 *   "loft"     — the original: sweep an elliptical cross-section along each
 *                stroke's centerline. One closed tube per stroke. Fast
 *                (sub-millisecond), animates per frame, but where two strokes
 *                cross the two tubes INTERPENETRATE: you get two complete
 *                shells passing through each other, not one merged body. A
 *                ray through the crossing hits four sheets.
 *
 *   "implicit" — a signed-distance field: one round-cone SDF per polyline
 *                segment, combined with a cubic polynomial smooth minimum and
 *                polygonised with marching cubes (see lib/implicit-surface.ts).
 *                The whole drawing becomes ONE watertight surface. Crossings
 *                fuse with a real fillet. Costs tens of milliseconds.
 *
 *   "auto"     — the DEFAULT. Sweep the loft where the loft is provably valid,
 *                polygonise the field where it is not. See below.
 *
 * WHY THE DEFAULT IS "auto" AND NOT "loft".
 * A swept tube is an embedded surface iff |r′| < 1 AND r·κ < 1 — the mark must
 * not swallow its own balls, and must not turn tighter than its own radius.
 * `inflateBuildBallChain` establishes the first by construction (that is what
 * the pruning is). The second was never checked, and `square/inflate` violates
 * it at all four drawn corners: the ring sweep folds its inner column back
 * through the surface, which no ring density fixes because r·κ does not depend
 * on sampling. That fold is what `mixed max 89.6` was.
 *
 * So the loft is used exactly where it is provably correct and the field is
 * used where the loft would be lying. `inflateChainFoldMetric` is the decision,
 * it is an exact predicate on the rings the sweep would emit, and the routing
 * it drives is reported in INFLATE_DEBUG as `fusionRequested` vs `fusionUsed`
 * so the panel never claims a strategy that did not run.
 *
 * The old default was "loft" on the grounds that implicit "rebuilds every frame
 * during the draw-in reveal". That stopped being true in explainer 18: the
 * reveal is a `drawRange` over a build-time triangle ordering and rebuilds
 * nothing, so the entire cost is one build per stroke change (measured 117-183
 * ms for the square). The comment outlived the thing it described.
 *
 *   blend      — the smooth-minimum radius k, expressed as a FRACTION of the
 *                stroke radius so it stays meaningful at any Thickness. k = 0
 *                is a hard union (fused, but with a visible crease at the
 *                junction); larger k means a wider, softer fillet. Past ~1.2
 *                the fillet starts eating the stroke's own silhouette.
 *
 *                IT ACTS BETWEEN RUNS ONLY, and that is not a detail — it is
 *                the reason blend cannot soften a drawn corner. §2b of
 *                lib/implicit-surface.ts hard-mins a stroke's own consecutive
 *                capsules, because smin-folding ten overlapping samples
 *                inflates every stroke by ~k/2 for reasons of sampling rather
 *                than shape. Two legs meeting at a drawn corner are consecutive
 *                samples of one stroke, so they are one run, so they hard-min,
 *                so k does nothing there. Measured on `square`: b=0.00 and
 *                b=1.00 agree to four decimals at three of the four corners,
 *                and differ at the fourth ONLY because that is the seam where
 *                the stroke's end meets its own start — orders far enough apart
 *                to be two runs — where it moves by exactly the predicted
 *                √2·(r + k/6). See docs/explainers/19.
 *   resolution — marching-cubes cells per stroke RADIUS. 2 is blobby and fast,
 *                8 is smooth and slow; cost scales roughly with resolution³
 *                near the surface (the field is only sampled in a shell, so
 *                the true exponent measured on the X test is ≈2.2, not 3).
 * ============================================================ */
export type InflateFusion = "auto" | "loft" | "implicit"

/**
 * What Inflate does where a stroke RETURNS TO ITS OWN START.
 *
 *   "wrapped" — the DEFAULT. A closed mark has no ends, so it gets no end caps
 *               and no end taper: the ring sweep wraps from the last frame back
 *               to the first, and every sample becomes an interior join.
 *   "capped"  — the behaviour shipped up to 2026-07-31, PARKED HERE INTACT so
 *               the old look stays reachable. Both ends are tapered to the tip
 *               fraction and capped with a dome, which at a closed seam means
 *               two domes sweeping about the same point.
 *
 * WHY THE DEFAULT MOVED. `"capped"` is not a look with a defect in it; it is a
 * defect. Measured on the `circle` fixture with the real engine: **13 rays cross
 * FOUR distinct depths** at the seam coordinate [1.203, 0.137] (the fixture's
 * seam is [1.216, 0.153]) — two dome surfaces passing through each other. This
 * is the same defect explainer 17 §2 fixed for Extrude ("a closed loop built
 * with two overlapping caps", 153 non-manifold edges → 0); Rod and Inflate never
 * received the treatment. `scripts/verify/assert-seam.mjs` is the gate.
 *
 * WHAT CHANGES IN THE LOOK, because this part is not a defect and is Sebs's
 * call. On `"capped"` a closed mark thins to `INFLATE_TIP_FRACTION` (0.159 of
 * full radius) where the pen started and stopped, so a closed square reads with
 * three sharp corners and one pinched, rounded-off one — measured ρ_out 0.36 r
 * at the seam corner against 1.00–1.03 r at the other three. On `"wrapped"` the
 * mark is full width the whole way round and the fourth corner is a corner like
 * the others. The argument for `"capped"` is that a real pen does leave a lift
 * mark; the argument against is that it is being applied to a mark the drawing
 * says is closed, and that it is currently delivered by two interpenetrating
 * domes rather than by a taper anyone designed. Flip with
 * `__styleHarness.setInflate({ loopEnds: "capped" })`.
 */
export type InflateLoopEnds = "wrapped" | "capped"

export interface InflateParams {
  /**
   * Which surface strategy to use. "auto" routes on the embedding test — see
   * the block comment above. The strategy that actually ran is
   * INFLATE_DEBUG.fusionUsed; this is only the request.
   */
  fusion: InflateFusion
  /** Smooth-min blend radius k, as a fraction of the stroke's XY radius. */
  blend: number
  /** Marching-cubes cells per stroke radius. */
  resolution: number
  /**
   * How a stroke that returns to its own start is finished. Optional so every
   * existing caller and every stored params object keeps working unchanged;
   * absent reads as the default, `"wrapped"`. See `InflateLoopEnds`.
   */
  loopEnds?: InflateLoopEnds
  /**
   * THE NIB'S CONTRAST, `a/b`. 1 is the round pen this engine swept for its
   * whole life — the monoline. See the `THE BROAD NIB` block below for what the
   * number means and why it is not a taste-free constant.
   */
  nibAspect?: number
  /**
   * THE NIB'S ANGLE, degrees, in the SAME convention as `lib/flat-ink.ts`'s
   * `NIB_ANGLE_RAD`: canvas coordinates, y down, so a positive angle is the
   * chisel edge rising to the right as it does on paper. Travel PARALLEL to it
   * draws the hairline.
   */
  nibAngleDeg?: number
  /**
   * OVERALL INK WEIGHT, multiplying both nib axes. 1 keeps the swept solid's
   * cross-sectional area equal to the round pen's, which is what makes the nib
   * cost nothing in field cells and keeps the word's colour where it was.
   */
  nibWeight?: number
}

/* ════════════════════════════════════════════════════════════════════════
 * THE BROAD NIB — width from direction, as one 3×3 matrix
 * ════════════════════════════════════════════════════════════════════════
 *
 * Sebs, 2026-08-28: *"we need get that text aniamtion perfetct bigest blocker
 * and we failed for weeks getting it right"*, *"the way it writes in is ass
 * still"*.
 *
 * ── WHAT WAS WRONG, MEASURED ──────────────────────────────────────────────
 * `docs/verification/nib-2026-08-28/before/free-stroke/frames/022.png` is the
 * settled solid at the front view: every stroke of the word at one diameter,
 * hemispherical ends, no thick and no thin. `window.__heroPenTip` reports one
 * `radius: 11.290` for the entire word. The flat half of the beat has carried a
 * broad nib since `lib/flat-ink.ts` shipped `nibHalfWidth`; the solid half never
 * received one, so the beat converts a written mark into tubing.
 *
 * ── THE LAW, from docs/research/stroke-width-models.md §1.1 ────────────────
 *
 *     h(psi) = sqrt( a^2 sin^2 psi + b^2 cos^2 psi ),   psi = theta - alpha
 *
 * and its own note that *"the contrast ratio a nib produces is exactly a/b"* —
 * one aspect number IS the contrast, with no tuning curve anywhere.
 *
 * ── AND WHY NONE OF THAT FORMULA APPEARS BELOW ────────────────────────────
 * §4.3, verbatim: *"Transform the centreline by A⁻¹, sweep the round tube we
 * already sweep, transform the vertices back by A."* Because a Minkowski sum
 * commutes with an invertible linear map,
 *
 *     c ⊕ A(B₁)  =  A( A⁻¹(c) ⊕ B₁ )
 *
 * so the direction-dependent width, the oblique rings of §4.2, the tangential
 * contact shift of §1.2 (**stroke ends cut at the nib angle**) and the slanted
 * end caps all arrive for free and exactly. §4.5 checks the identity in the
 * regime a reader would doubt — `κ·a = 1.667`, far past where the offset curve
 * has inverted — at **zero symmetric difference on a 340×340 grid**.
 *
 * The centreline is untouched by the round trip: `A(A⁻¹ c) = c`. Only the body
 * swept around it changes shape. That is what keeps the pen field, the carve and
 * every world→stroke mapping in `components/viewport-3d.tsx` valid without a
 * line of change — the mark moved nowhere, it only stopped being round.
 *
 * ── THE THREE CHANNELS THIS DELIBERATELY DOES NOT USE ─────────────────────
 *   · `Point.pressure` — §2.1 measures this engine's own ceiling at
 *     **2.077 : 1** from `INFLATE_PRESSURE_INFLUENCE`, below the weakest nib in
 *     the doc's own table. It cannot express the thing.
 *   · velocity — §2.3: two of three inputs have no time axis, and
 *     `inflateResampleCenterline` makes every gap equal by construction, so a
 *     spacing-driven synthesiser returns a constant.
 *   · curvature — already shipped as `inflateSynthPressures`, and §2.2 quotes
 *     the one study that measured pen force directly: coherence with angular
 *     velocity *"never reached a value above 0.3 in any condition"*.
 *
 * ── AREA-PRESERVING BY CONSTRUCTION, WHICH IS NOT A FLOURISH ──────────────
 * The axes are `a = weight·√aspect`, `b = weight/√aspect`, so at `weight = 1`
 * the map has determinant 1. Two things fall out and both are load-bearing.
 * The field-space word is the same AREA as before, so the marching-cubes grid
 * costs the same cells — the nib is free. And §1.4's weight-restore problem
 * ("a nib's mean width over this word is ~72-75 % of its maximum, so `a` has to
 * be scaled up by about 1.37×") is answered without a second constant:
 * √1.8 = 1.342 is that factor, arrived at from the determinant rather than
 * fitted to the word.
 *
 * It also keeps the flat half of the beat a strict SUBSET of the solid half,
 * which `lib/flat-ink.ts` says in its own header is the whole reason the carve
 * can be a fragment `discard`. The 2D nib pins its semi-major axis to R; this
 * one sits at 1.342 R at the same angle and aspect, so the flat mark is a 0.745
 * scale of the solid's cross-section at EVERY direction, not only at one.
 * ════════════════════════════════════════════════════════════════════════ */

/**
 * CONTRAST `a/b`. 1.8, and it is the 2D register's authored pick rather than the
 * research doc's 5:1, because **the two halves of the beat must be one pen.**
 * `lib/flat-ink.ts`'s `NIB_ASPECT_DEFAULT` block records the rendered sweep that
 * chose it on this exact word: *"Above about 2.4 the `e`s begin to break and the
 * `o`s go lozenge — at 5.0 it is legibly Chancery and legibly not his hand."*
 * A different number here from there would be two pens in one beat.
 *
 * ⚠ THIS IS A SEBS-ONLY CALL (`docs/DISPATCH.md` §2.8) and it is a dial, not a
 * threshold. The 3-D sweep that argues for it is at
 * `docs/verification/nib-2026-08-28/sweep/`.
 */
export const INFLATE_NIB_ASPECT_DEFAULT = 1.8
/**
 * PEN ANGLE, degrees, canvas convention. 30 matches `flat-ink.ts`'s
 * `NIB_ANGLE_RAD` exactly. stroke-width-models.md §1.3 is emphatic that this is
 * a style dial with two real settings and not a right answer: **0° is
 * Foundational**, the angle Johnston's 1906 text actually specifies (*"the
 * chisel edge of the nib is parallel to the horizontal line of the paper"*),
 * hairline horizontals and maximum stem weight; **30° is the later teaching
 * convention**, where everything keeps some width. §1.4's census of this word
 * puts 9.5 % of its pen travel at hairline under 30° against 16.7 % under 0°.
 * Only **90° is forbidden** — it erases the near-vertical stems, 33.2 % of the
 * word.
 */
export const INFLATE_NIB_ANGLE_DEG_DEFAULT = 30
/** Overall weight multiplier on both axes. 1 = determinant 1 = free. */
export const INFLATE_NIB_WEIGHT_DEFAULT = 1

/** The nib, resolved: two semi-axes in units of `radiusXY`, and its rotation. */
export interface InflateNib {
  /** Semi-axis ALONG the nib edge — travel this way draws the hairline `b`. */
  a: number
  /** Semi-axis across the edge. The half-width of a hairline stroke. */
  b: number
  /** cos/sin of the nib angle in WORLD space (canvas y is flipped by px2w). */
  ca: number
  sa: number
  /** False when the map is the identity, i.e. the shipped round pen. */
  active: boolean
  aspect: number
  angleDeg: number
  weight: number
}

export function inflateResolveNib(p: {
  nibAspect?: number
  nibAngleDeg?: number
  nibWeight?: number
}): InflateNib {
  const aspect =
    Number.isFinite(p.nibAspect as number) && (p.nibAspect as number) >= 1
      ? (p.nibAspect as number)
      : INFLATE_NIB_ASPECT_DEFAULT
  const weight =
    Number.isFinite(p.nibWeight as number) && (p.nibWeight as number) > 0
      ? (p.nibWeight as number)
      : INFLATE_NIB_WEIGHT_DEFAULT
  const angleDeg = Number.isFinite(p.nibAngleDeg as number)
    ? (p.nibAngleDeg as number)
    : INFLATE_NIB_ANGLE_DEG_DEFAULT
  const root = Math.sqrt(aspect)
  /* CANVAS → WORLD. `px2w` negates y, so a canvas angle is its own negative in
   * the space the centreline lives in. Getting this wrong mirrors the nib
   * against the flat register's and the two halves of the beat disagree about
   * which strokes are thick — a defect that renders as "the solid is a
   * different hand" and reads as a taste problem. */
  const alphaWorld = (-angleDeg * Math.PI) / 180
  const a = weight * root
  const b = weight / root
  return {
    a,
    b,
    ca: Math.cos(alphaWorld),
    sa: Math.sin(alphaWorld),
    active: Math.abs(a - 1) > 1e-6 || Math.abs(b - 1) > 1e-6,
    aspect,
    angleDeg,
    weight,
  }
}

/** WORLD → FIELD, `A⁻¹`. Where the centreline goes before the round sweep.
 *
 * ⚠ EXPORTED FOR `lib/dd-engine/adapter.ts`, WHICH IS THE OTHER ENGINE FAMILY.
 * The nib landed on Free Stroke's Inflate on 2026-08-28 and `desk-doodles` came
 * back BYTE-IDENTICAL from the same film — 28 131 ink, the same seven counters —
 * because the adapter never read `inflateParams` (`docs/RUN-QUEUE.md` F34). The
 * family Sebs named by name was the one still on the round pen. Exporting the
 * map is what lets the port route THROUGH this implementation instead of
 * growing a second one; a second copy of an affine change of variables is this
 * repo's most expensive recurring defect. */
export function inflateNibToField(x: number, y: number, n: InflateNib): { x: number; y: number } {
  const u = (x * n.ca + y * n.sa) / n.a
  const v = (-x * n.sa + y * n.ca) / n.b
  return { x: u * n.ca - v * n.sa, y: u * n.sa + v * n.ca }
}

/**
 * FIELD → WORLD, `A` on positions and `A⁻ᵀ` on normals.
 *
 * `A` is symmetric, so its inverse transpose is its plain inverse — the one
 * classic bug in this pattern (normals need `A⁻ᵀ`, not `A`) collapses to
 * reusing `inflateNibToField`. `applyImplicitZAspect` in `lib/implicit-surface.ts`
 * already carries the Z half of the same idea; this is the same code generalised
 * from `diag(1,1,aspect)` to a full symmetric 3×3, which is exactly what
 * stroke-width-models.md §4.3 says the nib costs.
 *
 * ⚠ THE GUARD IS THE POSITION ARRAY ITSELF, AND A KEY WAS NOT ENOUGH.
 *
 * `lib/implicit-defer.ts` reaches one geometry object through four paths and
 * they need four different answers: a synchronous build and a worker settle both
 * REPLACE `position` with a new array and must be transformed; a cache hit also
 * replaces it, and does NOT fire `onSettled`, so nothing else would; and the
 * deferred hold hands back the surface already on screen, whose array is the one
 * that was transformed a frame ago and must be left alone.
 *
 * A boolean or a params key cannot separate those, because two of them arrive
 * with the flag set and raw vertex data underneath. **Both failures are silent
 * and both look plausible**: skip when you should have applied and the mesh
 * renders as the monoline; apply when you should have skipped and `A²` lands on
 * the word, which reads as the whole logo rotated 12° and stretched — measured
 * on this exact change tonight, in
 * `docs/verification/nib-2026-08-28/after-doubled/`.
 *
 * So the stamp records the ARRAY OBJECT this ran on. Same array plus same nib =
 * already done. Anything else is new vertex data and gets transformed.
 */
export function inflateApplyNibToGeometry(geometry: THREE.BufferGeometry, n: InflateNib): boolean {
  if (!n.active) return false
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute | undefined
  if (!pos) return false
  const ud = geometry.userData as Record<string, unknown>
  const key = `${n.a.toFixed(6)}:${n.b.toFixed(6)}:${n.angleDeg}`
  if (ud.__fsNibArray === pos.array && ud.__fsNibApplied === key) return false
  const pa = pos.array as Float32Array
  for (let i = 0; i < pa.length; i += 3) {
    const x = pa[i]
    const y = pa[i + 1]
    const u = (x * n.ca + y * n.sa) * n.a
    const v = (-x * n.sa + y * n.ca) * n.b
    pa[i] = u * n.ca - v * n.sa
    pa[i + 1] = u * n.sa + v * n.ca
  }
  pos.needsUpdate = true
  const nrm = geometry.getAttribute("normal") as THREE.BufferAttribute | undefined
  if (nrm) {
    const na = nrm.array as Float32Array
    for (let i = 0; i < na.length; i += 3) {
      const t = inflateNibToField(na[i], na[i + 1], n)
      const z = na[i + 2]
      const len = Math.sqrt(t.x * t.x + t.y * t.y + z * z)
      if (len > 1e-12) {
        na[i] = t.x / len
        na[i + 1] = t.y / len
        na[i + 2] = z / len
      }
    }
    nrm.needsUpdate = true
  }
  ud.__fsNibApplied = key
  ud.__fsNibArray = pos.array
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return true
}

/**
 * WHAT THE NIB ACTUALLY GAVE THIS WORD — arc-length-weighted, over the real
 * centrelines, not over a uniform direction sweep.
 *
 * `h(psi)` says the contrast is `a/b` at every angle it visits; whether the word
 * VISITS the hairline direction is a property of the drawing. §1.4 does this
 * census by hand on `logo-strokes.json`; this is the same census computed on
 * whatever is being built, so the debug panel reports the contrast the mark got
 * rather than the contrast the dial requested.
 *
 * ⚠ This is a claim about the WIDTH LAW, not about the mesh. It is computed from
 * the formula, so it cannot witness a nib that failed to reach the geometry.
 * `scripts/verify/assert-nib-contrast.mjs` is what measures the mesh.
 */
function inflateNibWidthCensus(
  centerlinesField: { x: number; y: number }[][],
  n: InflateNib,
): { min: number; max: number; mean: number; ratio: number; hairlineFrac: number } {
  // The census runs on FIELD-space centrelines, so directions come back through
  // A before they mean anything: a direction is a tangent, and tangents map by A.
  let min = Infinity
  let max = 0
  let wsum = 0
  let hsum = 0
  let hairline = 0
  const alpha = Math.atan2(n.sa, n.ca)
  for (const pts of centerlinesField) {
    for (let i = 1; i < pts.length; i++) {
      const dxf = pts[i].x - pts[i - 1].x
      const dyf = pts[i].y - pts[i - 1].y
      if (dxf === 0 && dyf === 0) continue
      const u = (dxf * n.ca + dyf * n.sa) * n.a
      const v = (-dxf * n.sa + dyf * n.ca) * n.b
      const dx = u * n.ca - v * n.sa
      const dy = u * n.sa + v * n.ca
      const len = Math.hypot(dx, dy)
      if (len <= 0) continue
      const psi = Math.atan2(dy, dx) - alpha
      const s = Math.sin(psi)
      const c = Math.cos(psi)
      const h = Math.sqrt(n.a * n.a * s * s + n.b * n.b * c * c)
      if (h < min) min = h
      if (h > max) max = h
      wsum += len
      hsum += h * len
      if (h < 0.3 * n.a) hairline += len
    }
  }
  if (!Number.isFinite(min) || wsum <= 0) return { min: 0, max: 0, mean: 0, ratio: 1, hairlineFrac: 0 }
  return {
    min,
    max,
    mean: hsum / wsum,
    ratio: min > 0 ? max / min : Infinity,
    hairlineFrac: hairline / wsum,
  }
}

/* CLOSED-LOOP DETECTION — ported verbatim from Extrude's, which is the one that
 * has already been through this. The constants and the reasoning are at
 * `inflateBuildRibbonGeometry`'s "CLOSED LOOPS ARE BUILT AS LOOPS" block
 * (:1803-1811): the threshold is a fraction of the mark's own HALF-WIDTH,
 * because "did the pen come back to where it started" is a question about the
 * mark's thickness — an absolute epsilon would call a fat mark open and a
 * hairline mark closed at the same pixel gap — and the arc-length floor stops a
 * two-sample tick, whose endpoints are trivially close, from being called a
 * loop. Ported rather than re-derived: the two engines must agree about what
 * "closed" means, or the same drawing is a loop in one mode and not in another. */
const INFLATE_CLOSE_EPS_HALFWIDTHS = 0.75
const INFLATE_CLOSE_MIN_ARC_HALFWIDTHS = 4

/** Is this resampled centreline a closed loop, at this stroke radius? */
function inflateChainIsClosed(
  pts: { x: number; y: number }[],
  radiusXY: number,
): boolean {
  const n = pts.length
  if (n < 4 || !(radiusXY > 0)) return false
  let arc = 0
  for (let i = 1; i < n; i++) arc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  const gap = Math.hypot(pts[n - 1].x - pts[0].x, pts[n - 1].y - pts[0].y)
  return (
    gap <= radiusXY * INFLATE_CLOSE_EPS_HALFWIDTHS &&
    arc >= radiusXY * INFLATE_CLOSE_MIN_ARC_HALFWIDTHS
  )
}

export const INFLATE_BLEND_MIN = 0
export const INFLATE_BLEND_MAX = 1.5
export const INFLATE_BLEND_STEP = 0.05
export const INFLATE_BLEND_DEFAULT = 0.55

export const INFLATE_RESOLUTION_MIN = 2
export const INFLATE_RESOLUTION_MAX = 8
export const INFLATE_RESOLUTION_STEP = 0.5
export const INFLATE_RESOLUTION_DEFAULT = 4

/** Hard ceiling on marching-cubes grid cells — the runaway guard. */
const INFLATE_MAX_FIELD_CELLS = 9_000_000

export const DEFAULT_INFLATE_PARAMS: InflateParams = {
  fusion: "auto",
  blend: INFLATE_BLEND_DEFAULT,
  resolution: INFLATE_RESOLUTION_DEFAULT,
  loopEnds: "wrapped",
  nibAspect: INFLATE_NIB_ASPECT_DEFAULT,
  nibAngleDeg: INFLATE_NIB_ANGLE_DEG_DEFAULT,
  nibWeight: INFLATE_NIB_WEIGHT_DEFAULT,
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
 *   strategy         ��� which shape/extrusion strategy produced this mesh
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
  /**
   * Arc-length fraction of every tube ring (length tubularSegments + 1).
   *
   * Rod's rings are no longer evenly spaced (see buildAdaptiveTubeGeometry), so
   * the draw-in reveal can't assume ring j sits at j / tubularSegments along the
   * stroke. This table is the ground truth it looks the reveal distance up in.
   */
  ringArcFracs?: number[]
  /** Per-point pen timestamps, relative to the stroke start (rod animation). */
  pointTimestamps?: number[]
  /** Cumulative arc length at each point (rod animation). */
  pointArcLengths?: number[]
  /** pointTimestamps normalised to 0..1 (rod animation). */
  timeFracs?: number[]
  /** pointArcLengths normalised to 0..1 (rod animation). */
  distFracs?: number[]
  filteredCount: number
  key: string
  /** Geometry mode that produced this mesh data */
  mode: GeometryMode
  /** Build status for debug overlay (extrude mode only) */
  buildStatus?: StrokeBuildStatus
  /** Build status for debug overlay (solid mode only) */
  solidStatus?: SolidBuildStatus
  /**
   * ASCENDING per-triangle draw-in position, 0..1 in the same arc-length
   * convention the reveal playhead uses. Present only on the Inflate IMPLICIT
   * path, whose index buffer is sorted to match.
   *
   * Its presence is the signal that this mesh reveals by `setDrawRange` (Rod's
   * mechanism) instead of by being rebuilt from a stroke prefix every frame.
   * See §6 of lib/implicit-surface.ts for the measurement that forced the
   * change: a rebuild-per-frame reveal of this surface costs 24-531ms PER TICK.
   */
  revealKeys?: Float32Array
}

export interface PreviewParams {
  canvasWidth: number
  canvasHeight: number
  extrudeParams?: ExtrudeParams
  solidParams?: SolidParams
  /** Inflate fusion controls. Absent = DEFAULT_INFLATE_PARAMS, whose `fusion`
   *  is **"auto"** (:627) — NOT "loft". This said "(loft)" until 2026-07-31,
   *  which is a large part of why "the Inflate elbow is broken" survived as a
   *  belief after the shipped default already routed around it. See the
   *  INFLATE FUSION CONTROLS block comment for what "auto" decides on. */
  inflateParams?: InflateParams
  /**
   * OPTIONAL Solid H3 animation hole stabilization (animation-only).
   *
   * When the Solid mesh is being rebuilt as a partial reveal frame, this
   * carries the activation-gated final hole contours that the buildMaskSolid
   * pipeline should USE for cap triangulation + H3 inner walls — instead of
   * trusting the partial-frame H1/H2 detection. Static and export callers
   * NEVER pass this; behavior is identical to before.
   */
  holeStabilization?: import("./solid-mask").SolidHoleStabilization
  /**
   * OPTIONAL animation-only no-holes mode for Solid partial reveals.
   *
   * When true, Scene is rendering a mid-reveal partial frame and wants the
   * Solid mesh to be a stable filled silhouette extrusion with NO holes.
   * Passes straight through to buildMaskSolid; static + export callers
   * never set this so their behavior is unchanged.
   */
  disableHolesForAnimation?: boolean
  /**
   * OPTIONAL world-space XY centre the DRAFTED Extrude side walls taper toward.
   *
   * Read only when `extrudeParams.sideWall === "drafted"`. Absent = the engine
   * uses the bbox centre of the strokes it was handed, which is correct
   * everywhere EXCEPT a partial-reveal frame — see the block comment above
   * `computeExtrudePoolCentreXY` for why a drifting centre re-slants every
   * already-drawn letter on every animation tick.
   */
  draftCentre?: { x: number; y: number }
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
  /** Inflate fusion controls. Absent = DEFAULT_INFLATE_PARAMS, whose `fusion`
   *  is **"auto"** (:627) — NOT "loft". This said "(loft)" until 2026-07-31,
   *  which is a large part of why "the Inflate elbow is broken" survived as a
   *  belief after the shipped default already routed around it. See the
   *  INFLATE FUSION CONTROLS block comment for what "auto" decides on. */
  inflateParams?: InflateParams
  /**
   * The user's RESOLVED material selection (Export v2 — material metadata).
   * `preset` is the preset id ("gold", "chrome", "custom", …) and becomes the
   * glTF material name; `params` is the full resolved param set from
   * `resolveMaterialParams` (preset merged with any Custom edits).
   * Optional so older callers keep working — absent falls back to "ink".
   */
  material?: ExportMaterialSpec
  /** See PreviewParams.draftCentre. Export normally has the whole mark, so this
   *  is only needed to PROVE preview and export tapered about the same point. */
  draftCentre?: { x: number; y: number }
  settings: {
    spacing: number | null
    smoothingEnabled: boolean | null
    cornersEnabled: boolean | null
  }
}

export interface ExportMaterialSpec {
  preset: string
  params: MaterialParams
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

/**
 * Export v2 — material metadata. Build the GLB material from the user's
 * resolved material selection instead of the old hardcoded "Ink".
 *
 * MeshPhysicalMaterial (NOT MeshStandardMaterial) so clearcoat / sheen /
 * iridescence / emissive strength survive into the GLB — GLTFExporter writes
 * KHR_materials_clearcoat / _sheen / _iridescence / _emissive_strength /
 * _ior automatically from a physical material, and silently drops them from
 * a standard one. Construction mirrors `liveMaterial` in viewport-3d.tsx
 * (minus the screen-space style-shader hooks, which cannot ride a GLB) so
 * preview === export for the surface itself.
 *
 * Falls back to the "ink" preset when no material is passed (old callers).
 */
function createExportMaterial(params: ExportParams): THREE.MeshPhysicalMaterial {
  const preset = params.material?.preset ?? "ink"
  const m = params.material?.params ?? MATERIAL_PARAMS.ink
  return new THREE.MeshPhysicalMaterial({
    name: preset,
    color: new THREE.Color(m.color),
    roughness: m.roughness,
    metalness: m.metalness,
    clearcoat: m.clearcoat,
    clearcoatRoughness: m.clearcoatRoughness,
    reflectivity: m.reflectivity,
    sheen: m.sheen,
    sheenRoughness: m.sheenRoughness,
    sheenColor: new THREE.Color(m.sheenColor),
    emissive: new THREE.Color(m.emissive),
    emissiveIntensity: m.emissiveIntensity,
    envMapIntensity: m.envMapIntensity,
    iridescence: m.iridescence ?? 0,
    iridescenceIOR: m.iridescenceIOR ?? 1.3,
    iridescenceThicknessRange: m.iridescenceThicknessRange ?? [100, 400],
  })
}

/**
 * Metadata block spread into every export root's userData (GLTFExporter
 * writes userData as glTF `extras`). Carries the preset name plus the full
 * resolved params so values with no glTF representation (envMapIntensity,
 * reflectivity as authored) still round-trip as data.
 */
function exportMaterialMeta(params: ExportParams) {
  return {
    materialPreset: params.material?.preset ?? "ink",
    materialParams: { ...(params.material?.params ?? MATERIAL_PARAMS.ink) },
  }
}

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

/**
 * Detect joints (sharp angle turns) in a 3D polyline, excluding endpoint zones.
 *
 * THE PREDICATE USED TO BE INVERTED, and the inversion is why Rod reads as a
 * beaded, faceted wire under gloss.
 *
 * Let θ = the TURN angle between the incoming and outgoing chords:
 * θ = acos(cosAngle), so θ = 0 on a straight run and θ = π at a hairpin. The
 * old test computed `deviation = π − acos(cosAngle)` — which is the INTERIOR
 * angle, not the deviation from straight — and fired when that exceeded 40°.
 * Written out: it fired for every turn from 0° up to 140°, i.e. on a PERFECTLY
 * STRAIGHT stretch, and stayed silent for 140°–180°, i.e. at the hairpins that
 * are the only place a joint sphere is actually needed. Exactly backwards.
 *
 * The cost was not theoretical. `__geomDebug.probeDihedral` on a two-stroke
 * crossing counted **166 meshes** — one tube, four cap spheres, and ~160 joint
 * spheres strung along two straight bars. On the `square` fixture, which has
 * four real corners, it counted 190. The only thing keeping this from being
 * catastrophic was the `jointDedup` spacing, which turned "a sphere at every
 * sample" into "a sphere every 1.8 radii" — a string of beads.
 *
 * And the beads are the coarsest surface in the app: JOINT_SPHERE_SEGMENTS was
 * lowered to 8 (45° facets) precisely BECAUSE there were thousands of them, so
 * the bug's symptom became the justification for the constant that made the
 * symptom visible. The dihedral census measured max crease 44.22° on every Rod
 * fixture — 360/8 — in all three buckets. That is the joint spheres, poking
 * through a 16-sided tube, over the whole length of every stroke.
 *
 * With the predicate corrected the count collapses to the handful of genuine
 * corners, so the segment count no longer has to be traded against export size
 * (see JOINT_SPHERE_SEGMENTS).
 */
function detectJoints3D(
  filtered: THREE.Vector3[],
  startPt: THREE.Vector3,
  endPt: THREE.Vector3,
  /**
   * IS THIS STROKE A CLOSED LOOP? — and it decides whether the endpoint
   * exclusion below applies at all.
   *
   * THE DEFECT THIS PARAMETER CLOSES. The exclusion zone drops any joint within
   * 1.25 radii of `startPt` / `endPt`, and its own reason is that a joint there
   * "causes dot artifacts" — i.e. the END CAP SPHERE already covers that
   * region, so a second sphere on top of it is a lump. That reason expired when
   * closed loops stopped getting end caps (explainer 19 §4b: a mark that comes
   * back to its start has no ends, so `capPositions` is `undefined`). Nothing
   * covers the seam any more, and the exclusion still removed its bead.
   *
   * MEASURED on `square/rod`, one stroke, four drawn 90-degree corners: three
   * beads, at corners 1, 2 and 3. Corner 0 — the seam, at [-0.2805, 0.8267] —
   * had none, the nearest bead being 113 tube radii away. It is the only corner
   * of the four whose surface is the chorded tube rather than the corner ball,
   * and two of the three creases anywhere on that mesh's VISIBLE surface are
   * there (38.52 and 30.73 degrees, against 22.5 for the tube's own facet).
   *
   * A closed loop also has a real corner AT index 0 that the scan below can
   * never reach, because it runs `1 .. n-2`. Closed, the neighbours wrap.
   */
  closed = false,
): { positions: THREE.Vector3[]; fractions: number[] } {
  const positions: THREE.Vector3[] = []
  const fractions: number[] = []
  const angleThresholdRad = (JOINT_ANGLE_THRESHOLD_DEG * Math.PI) / 180

  // Exclusion zone around endpoints: joints here cause "dot" artifacts
  const endpointEps = TUBE_RADIUS * 1.25
  // Minimum distance between consecutive joints. At 0.75x radius consecutive
  // spheres overlapped almost entirely — each one added cost while covering
  // area the previous already filled. 1.8x still leaves adjacent joints
  // touching (a sphere spans 2x radius), so corners stay filled, but the
  // redundant pile-up on a dense scribble is gone.
  //
  // READ FROM THE EXPORTED CONSTANT, which is defined as exactly this product.
  // It used to be recomputed here while `JOINT_MIN_DISTANCE` sat at a stale
  // 0.03 that nothing read — see the note on that export.
  const jointDedup = JOINT_MIN_DISTANCE

  /* On a closed loop `filtered[last]` is the same point as `filtered[0]` (that
   * is what `rodStrokeIsClosed` measured), so the wrap neighbours of index 0 are
   * `last-1` and `1`, and index `last` is a duplicate that must not be scanned
   * twice. */
  const n = filtered.length
  const seamBead = closed && ROD_TUNING.seamJoint === "bead"
  const lastReal = seamBead ? n - 2 : n - 1
  const iFrom = seamBead ? 0 : 1
  for (let i = iFrom; i <= lastReal; i++) {
    const prev = filtered[i === 0 ? lastReal - 1 : i - 1]
    const curr = filtered[i]
    const next = filtered[i === lastReal ? 0 : i + 1]
    if (!prev || !curr || !next) continue

    const ax = curr.x - prev.x, ay = curr.y - prev.y, az = curr.z - prev.z
    const bx = next.x - curr.x, by = next.y - curr.y, bz = next.z - curr.z

    const magA = Math.sqrt(ax * ax + ay * ay + az * az)
    const magB = Math.sqrt(bx * bx + by * by + bz * bz)
    if (magA < 1e-6 || magB < 1e-6) continue

    const dot = ax * bx + ay * by + az * bz
    const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)))
    // Turn angle: 0 on a straight run, π at a full reversal. NOT `π − acos(...)`,
    // which is the interior angle and fires everywhere. See the block comment.
    const turn = Math.acos(cosAngle)

    if (turn > angleThresholdRad) {
      // Skip joints too close to start or end CAP positions — a cap sphere is
      // already there and a second one on top of it reads as a lump. A CLOSED
      // loop has no caps, so there is nothing to double up on and the seam
      // corner is entitled to its bead like any other. See the `closed` param.
      if (!seamBead) {
        if (curr.distanceTo(startPt) < endpointEps) continue
        if (curr.distanceTo(endPt) < endpointEps) continue
      }

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
/*  Curvature-adaptive tube sampling                                  */
/* ------------------------------------------------------------------ */
/*
 * Rod used to segment the tube UNIFORMLY:
 *
 *     tubularSegments = clamp(points.length * 3, 8, 512)
 *
 * — one count for the whole stroke, spread evenly along it. That spends the
 * same number of cross-sections on a straight run (where two would do) as on a
 * tight curl (where the same spacing shows as flat facets). Both ends of the
 * trade are visible: long strokes waste tens of thousands of triangles on
 * straightaways, and hairpins read as a chain of chamfers.
 *
 * WHERE TO PUT A RING. Approximate the local shape by its osculating circle of
 * curvature k (radius 1/k). A chord spanning arc length ds across that circle
 * departs from the true curve by a sagitta of
 *
 *     h  =  (1/k) * (1 - cos(k*ds/2))  ~=  k * ds^2 / 8       (small k*ds)
 *
 * Requiring h <= eps and solving for the spacing gives the sampling density in
 * rings per world unit:
 *
 *     ds <= sqrt(8*eps/k)     =>     d(s) = 1/ds = sqrt(k(s) / (8*eps))
 *
 * so density grows as the SQUARE ROOT of curvature: a curve ten times tighter
 * gets ~3.2x the rings, not 10x. eps is expressed as a fraction of the tube
 * radius (FACET_TOLERANCE), because that is the scale at which a facet reads:
 * a flat spot 2% of the radius deep is invisible, one 20% deep is a chamfer.
 *
 * k(s) is measured discretely off a dense arc-length resample: the turn angle
 * between consecutive chords divided by the mean chord length (radians per
 * world unit) — exactly "turn angle per unit arc-length".
 *
 * FLOOR AND CEILING.
 *
 *   floor — a fraction of the density the uniform rule would have used, so a
 *     straight run still carries enough rings to bend with the stroke and to
 *     give the draw-in reveal somewhere to stop.
 *
 *   ceiling — ABSOLUTE, not relative: one ring per half tube-radius. Anything
 *     finer is invisible, because the cross-section itself is only
 *     RADIAL_SEGMENTS (16) sided, so ~22 degrees of radial facet is the floor
 *     on visible smoothness anyway. It has to be absolute: the uniform rule's
 *     density is `min(3*points, 512) / length`, which SHRINKS as a stroke gets
 *     longer, so a ceiling defined relative to it would starve exactly the
 *     case that needs help — a long stroke that has run into the 512 cap and
 *     contains one tight curl.
 *
 * The total ring count is the integral of the clamped density over the stroke,
 * itself clamped to [8, MAX_TUBULAR_SEGMENTS]. When a stroke is dense enough to
 * hit that cap, the adaptive placement still wins: the same 512 rings get spent
 * where the curvature is instead of being spread evenly over straightaways.
 *
 * PLACEMENT. Rings land where the CUMULATIVE density reaches j/N of its total —
 * i.e. equal "curvature budget" per ring rather than equal arc length.
 */
/**
 * DEV A/B switch. `adaptive: false` restores the old uniform rule EXACTLY, so
 * scripts/verify/verify-rod-segments.mjs can capture before and after out of a
 * single build — same stroke, same camera, same lighting, one variable.
 * Production code never writes this.
 */
export const ROD_TUNING = {
  adaptive: true,
  /**
   * What Rod does where a stroke RETURNS TO ITS OWN START. Same axis as
   * `InflateParams.loopEnds`, same two values, same default.
   *
   *   "wrapped" — the DEFAULT. Closed curve, closed tube, NO cap spheres.
   *   "capped"  — the behaviour shipped up to 2026-07-31, PARKED INTACT: an
   *               open tube plus two cap spheres, one at each end.
   *
   * WHY IT MOVED, measured on the real engine with no renderer involved:
   * at a closed seam the two cap spheres are **0.50 r apart on `square` and
   * 0.70 r apart on `circle`** — two spheres of radius r whose centres are half
   * a radius apart, i.e. a pair of near-coincident duplicate surfaces at every
   * closed seam, which is a z-fighting generator. On top of that the open
   * tube's two ends overlap: `square/rod` reads one ray crossing four distinct
   * depths at [−0.269, 0.824], and the square's first corner is [−0.281,
   * 0.827]. The control separates cleanly — on `openArc`, whose ends are near
   * each other but which is NOT closed, the two caps are **37.2 r apart**.
   *
   * It lives on ROD_TUNING rather than on a params object because Rod has no
   * per-mode params, and because ROD_TUNING is already published to the page as
   * `window.__rodTuning` (`components/viewport-3d.tsx`, `w.__rodTuning` — NO LINE
 * NUMBER ON PURPOSE: that file belongs to another lane and moved twice during
 * one session here, so a line cited into it rots faster than it can be fixed.
 * The citation gate verifies the SYMBOL instead) — so
   * behaviour is reachable at runtime without editing a file this lane does not
   * own: `__rodTuning.loopEnds = "capped"`.
   */
  loopEnds: "wrapped" as InflateLoopEnds,
  /**
   * WHETHER A CLOSED LOOP'S SEAM CORNER GETS ITS JOINT BEAD.
   *
   *   "bead" — the DEFAULT. A closed loop has no end caps, so `detectJoints3D`'s
   *            endpoint exclusion has nothing to avoid doubling up on and the
   *            seam corner is a corner like the other three.
   *   "none" — the behaviour shipped up to 2026-08-03, PARKED INTACT: the
   *            exclusion applied whether or not there was a cap to justify it.
   *
   * WHY IT MOVED. The exclusion drops any joint within 1.25 radii of the
   * stroke's own endpoints, and its stated reason is that a joint there "causes
   * dot artifacts" — a bead on top of an end CAP SPHERE is a lump. That reason
   * expired with the closed-loop fix (explainer 19 §4b), which stopped emitting
   * cap spheres on a loop. Measured on `square/rod`, one stroke, four drawn
   * 90-degree corners: THREE beads. Corner 0 — the seam — had none, the nearest
   * bead 113 tube radii away, so it was the only corner of the four carried by
   * the chorded tube instead of by the corner ball, and two of the three creases
   * anywhere on that mesh's visible surface sat there (38.52 and 30.73 degrees,
   * against 22.5 for the tube's own facet). Reachable at runtime as
   * `__rodTuning.seamJoint = "none"`, and `assert-mode-rims` requires it to fire.
   */
  seamJoint: "bead" as "bead" | "none",
}

/** Facet tolerance as a fraction of the tube radius. */
const TUBE_FACET_TOLERANCE = 0.02
/** Floor, as a fraction of the density the old uniform rule produced. */
const TUBE_DENSITY_FLOOR = 0.3
/** Ceiling, absolute: rings per tube radius (2 = one ring per half radius). */
const TUBE_MAX_RINGS_PER_RADIUS = 2

/**
 * A curve whose parameter has been WARPED so that uniform sampling in the new
 * parameter lands on the non-uniform arc-length fractions we chose.
 *
 * THREE.TubeGeometry samples its path with `getPointAt(i / tubularSegments)`
 * and frames it with `getTangentAt` — both arc-length parameterised. Overriding
 * those two to consult a piecewise-linear warp (and bypassing Curve's own
 * arc-length remap, which would otherwise undo the warp) is enough to make the
 * stock TubeGeometry emit adaptive rings, so positions, normals, UVs and the
 * index buffer all still come from three.js rather than a hand-rolled loft.
 */
class ArcWarpedCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private base: THREE.Curve<THREE.Vector3>,
    /** Arc-length fraction for ring j, length N+1, strictly increasing 0..1. */
    private fracs: number[],
  ) {
    super()
  }

  /** Piecewise-linear map from uniform u to the chosen arc-length fractions. */
  private warp(u: number): number {
    const n = this.fracs.length - 1
    if (n < 1) return u
    const x = Math.max(0, Math.min(1, u)) * n
    const i = Math.min(n - 1, Math.floor(x))
    const t = x - i
    return this.fracs[i] + (this.fracs[i + 1] - this.fracs[i]) * t
  }

  getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.base.getPointAt(this.warp(t), target)
  }

  // Bypass Curve's arc-length reparameterisation: it would re-normalise speed
  // and cancel exactly the non-uniformity we are trying to introduce.
  getPointAt(u: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.getPoint(u, target)
  }

  getTangent(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.base.getTangentAt(this.warp(t), target)
  }

  getTangentAt(u: number, target = new THREE.Vector3()): THREE.Vector3 {
    return this.getTangent(u, target)
  }
}

export interface AdaptiveTube {
  geometry: THREE.BufferGeometry
  /** Arc-length fraction of every ring, length tubularSegments + 1. */
  ringArcFracs: number[]
  tubularSegments: number
  /** What the old uniform rule would have used — for before/after reporting. */
  uniformSegments: number
}

function buildAdaptiveTubeGeometry(
  curve: THREE.CatmullRomCurve3,
  radius: number,
  /** Closed loop: three.js frames the tube cyclically and emits the wrap band,
   *  so the ring sequence has no ends. Optional, default false. */
  closed = false,
): AdaptiveTube {
  const uniformSegments = Math.min(
    Math.max(curve.points.length * TUBE_SEGMENTS_MULTIPLIER, 8),
    MAX_TUBULAR_SEGMENTS,
  )

  const length = curve.getLength()
  if (!ROD_TUNING.adaptive || !(length > 0)) {
    return {
      geometry: new THREE.TubeGeometry(curve, uniformSegments, radius, RADIAL_SEGMENTS, closed),
      ringArcFracs: Array.from({ length: uniformSegments + 1 }, (_, i) => i / uniformSegments),
      tubularSegments: uniformSegments,
      uniformSegments,
    }
  }

  // ---- 1. dense arc-length resample -> discrete curvature ----
  const M = Math.min(Math.max(uniformSegments * 4, 64), 2048)
  const pts: THREE.Vector3[] = new Array(M + 1)
  for (let i = 0; i <= M; i++) pts[i] = curve.getPointAt(i / M)

  const segLen = new Float64Array(M)
  for (let i = 0; i < M; i++) segLen[i] = pts[i].distanceTo(pts[i + 1])

  const eps = Math.max(radius * TUBE_FACET_TOLERANCE, 1e-6)
  const baseDensity = uniformSegments / length
  const dMax = TUBE_MAX_RINGS_PER_RADIUS / Math.max(radius, 1e-6)
  const dMin = Math.min(baseDensity * TUBE_DENSITY_FLOOR, dMax)

  // Density sampled at each dense NODE (curvature is a node property).
  const density = new Float64Array(M + 1)
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  for (let i = 0; i <= M; i++) {
    let k = 0
    if (i > 0 && i < M && segLen[i - 1] > 1e-9 && segLen[i] > 1e-9) {
      a.subVectors(pts[i], pts[i - 1]).divideScalar(segLen[i - 1])
      b.subVectors(pts[i + 1], pts[i]).divideScalar(segLen[i])
      const cos = Math.max(-1, Math.min(1, a.dot(b)))
      const turn = Math.acos(cos) // radians of direction change at this node
      k = turn / (0.5 * (segLen[i - 1] + segLen[i])) // rad per world unit
    }
    density[i] = Math.max(dMin, Math.min(dMax, Math.sqrt(k / (8 * eps))))
  }
  density[0] = density[Math.min(1, M)]
  density[M] = density[Math.max(M - 1, 0)]

  // ---- 2. integrate density -> cumulative "ring budget" ----
  const cum = new Float64Array(M + 1)
  for (let i = 0; i < M; i++) {
    cum[i + 1] = cum[i] + 0.5 * (density[i] + density[i + 1]) * segLen[i]
  }
  const total = cum[M]
  const segments = Math.min(
    Math.max(Math.round(total), 8),
    MAX_TUBULAR_SEGMENTS,
  )

  // ---- 3. place rings at equal budget increments ----
  const ringArcFracs: number[] = new Array(segments + 1)
  ringArcFracs[0] = 0
  ringArcFracs[segments] = 1
  let node = 0
  for (let j = 1; j < segments; j++) {
    const targetBudget = (total * j) / segments
    while (node < M - 1 && cum[node + 1] < targetBudget) node++
    const span = cum[node + 1] - cum[node]
    const frac = span > 1e-12 ? (targetBudget - cum[node]) / span : 0
    ringArcFracs[j] = (node + frac) / M
  }
  // Guard monotonicity against any float drift; TubeGeometry's frames need a
  // strictly forward-moving path or a segment can invert.
  for (let j = 1; j <= segments; j++) {
    if (ringArcFracs[j] <= ringArcFracs[j - 1]) {
      ringArcFracs[j] = Math.min(1, ringArcFracs[j - 1] + 1e-6)
    }
  }

  const warped = new ArcWarpedCurve(curve, ringArcFracs)
  const geometry = new THREE.TubeGeometry(warped, segments, radius, RADIAL_SEGMENTS, closed)
  return { geometry, ringArcFracs, tubularSegments: segments, uniformSegments }
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

      // CLOSED LOOPS — closed curve, closed tube, no cap spheres. See
      // ROD_TUNING.loopEnds for the measurement that moved this default.
      const closed = rodStrokeIsClosed(filtered, TUBE_RADIUS)
      const loopPts = closed ? dropSeamStub(filtered) : filtered
      const curve = new THREE.CatmullRomCurve3(loopPts, closed, "centripetal")
      const { geometry: tubeGeometry, ringArcFracs } = buildAdaptiveTubeGeometry(
        curve,
        TUBE_RADIUS,
        closed,
      )

      // Inset cap spheres slightly along tangent so they sit inside the tube ends
      const inset = TUBE_RADIUS * 0.35
      const startTangent = curve.getTangentAt(0)
      const endTangent = curve.getTangentAt(1)
      const startCapPos = filtered[0].clone().addScaledVector(startTangent, inset)
      const endCapPos = filtered[filtered.length - 1].clone().addScaledVector(endTangent, -inset)
      /* UNDEFINED, NOT AN EMPTY ARRAY — and this exact bug was already found and
       * fixed once, in the PORTED engine, and the native one carried it unfixed.
       *
       * `lib/dd-engine/adapter.ts:278` converts Desk Doodles' `capPositions: []`
       * to `undefined` with the reason in its own comment: "an empty array here
       * silently kills the whole render loop." The consumer
       * (`components/viewport-3d.tsx:6293`, `:6406`, `:6451` — `capPositions[1]`
       * twice and `data.capPositions &&` once) tests
       * `strokeMeshData.capPositions &&` and then reads `[1]` — and `[]` is
       * TRUTHY, so `[1]` is `undefined` and `Vector3.copy(undefined)` throws.
       * When the closed-loop fix landed here (loopEnds, 2026-07-31) it emitted
       * `[]` and the conversion was not ported with it.
       *
       * MEASURED on the shipped default, nothing touched, one page load each
       * (`scripts/verify/_probe-rod-default.mjs`): `circle/rod` 479 uncaught
       * exceptions and `square/rod` 481, in both cases with the canvas FROZEN —
       * two different camera positions rendering byte-identical frames, which is
       * indistinguishable from a still. `openArc` (an OPEN mark) throws 0. So it
       * fired on exactly the marks the closed-loop fix was about, and every
       * frame captured of a closed Rod mark since then was a frozen render. */
      const capPositions = closed ? undefined : [startCapPos, endCapPos]

      const { positions: jointPositions, fractions: jointFractions } = detectJoints3D(
        filtered, filtered[0], filtered[filtered.length - 1], closed
      )

      result.push({
        tubeGeometry,
        curve,
        capPositions,
        jointPositions,
        jointFractions,
        ringArcFracs,
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

    const exportMaterial = createExportMaterial(params)
    const capSphere = new THREE.SphereGeometry(TUBE_RADIUS, SPHERE_SEGMENTS, SPHERE_SEGMENTS)
    // Joints are mostly buried inside the tube — see JOINT_SPHERE_SEGMENTS.
    const jointSphere = new THREE.SphereGeometry(
      TUBE_RADIUS,
      JOINT_SPHERE_SEGMENTS,
      JOINT_SPHERE_SEGMENTS,
    )

    const exportObjects: THREE.Object3D[] = []
    const disposables: THREE.BufferGeometry[] = []

    for (let si = 0; si < strokes.length; si++) {
      const stroke = strokes[si]
      if (stroke.points.length < 2) continue

      const pts3d = strokeTo3D(stroke, canvasWidth, canvasHeight)
      const filtered = filterDuplicates(pts3d)
      if (filtered.length < 2) continue
      if (computeArcLength(filtered) < MIN_STROKE_LENGTH) continue

      // Closed exactly as the preview decides it — export parity is the point,
      // and a loop that wraps on screen and caps in the GLB is a parity break.
      const closed = rodStrokeIsClosed(filtered, TUBE_RADIUS)
      const loopPts = closed ? dropSeamStub(filtered) : filtered
      const curve = new THREE.CatmullRomCurve3(loopPts, closed, "centripetal")
      // Same adaptive sampler as the preview — export parity is the point.
      const { geometry: tubeGeo } = buildAdaptiveTubeGeometry(curve, TUBE_RADIUS, closed)

      // Inset cap spheres along tangent (same as preview)
      const inset = TUBE_RADIUS * 0.35
      const startTangent = curve.getTangentAt(0)
      const endTangent = curve.getTangentAt(1)
      const startCapPos = filtered[0].clone().addScaledVector(startTangent, inset)
      const endCapPos = filtered[filtered.length - 1].clone().addScaledVector(endTangent, -inset)

      const startCapGeo = capSphere.clone().translate(startCapPos.x, startCapPos.y, startCapPos.z)
      const endCapGeo = capSphere.clone().translate(endCapPos.x, endCapPos.y, endCapPos.z)

      // Build joint spheres (excluding endpoint zones — but NOT on a closed
      // loop, which has no end caps to double up on: preview/export parity is
      // the whole point of this block, so the `closed` flag goes through here
      // exactly as it does in buildPreview).
      const jointGeos: THREE.BufferGeometry[] = []
      const { positions: jointPositions } = detectJoints3D(
        filtered, filtered[0], filtered[filtered.length - 1], closed
      )
      for (const pos of jointPositions) {
        jointGeos.push(jointSphere.clone().translate(pos.x, pos.y, pos.z))
      }

      const strokeName = `stroke_${String(si).padStart(3, "0")}`
      // A closed loop has no ends, so it contributes no cap spheres — matching
      // the preview exactly. Emitting them anyway is what put two spheres 0.5 r
      // apart at every seam.
      const parts = closed
        ? [tubeGeo, ...jointGeos]
        : [tubeGeo, startCapGeo, endCapGeo, ...jointGeos]

      if (canMerge) {
        const merged = mergeGeometriesSafe(parts, false)
        if (merged) {
          const mesh = new THREE.Mesh(merged, exportMaterial)
          mesh.name = strokeName
          exportObjects.push(mesh)
          disposables.push(merged)
        } else {
          const group = new THREE.Group()
          group.name = strokeName
          for (let pi = 0; pi < parts.length; pi++) {
            const m = new THREE.Mesh(parts[pi], exportMaterial)
            m.name = `${strokeName}_part_${pi}`
            group.add(m)
          }
          exportObjects.push(group)
        }
      } else {
        const group = new THREE.Group()
        group.name = strokeName
        for (let pi = 0; pi < parts.length; pi++) {
          const m = new THREE.Mesh(parts[pi], exportMaterial)
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
      ...exportMaterialMeta(params),
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
    exportMaterial.dispose()
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
 * EXTRUDE = CONTINUOUS RIBBON STRIP (the single strategy)
 *
 * HISTORY (2026-07): Extrude used to carry a four-deep strategy chain:
 *   1. legacy parametric offset ribbon → THREE.ExtrudeGeometry
 *   2. experimental rasterize-and-trace ribbon (behind a compile-time flag)
 *   3. continuous-ribbon strip fallback
 *   4. Rod emergency fallback
 * Instrumentation across the full geometry-baseline battery (open C,
 * closed O, near-touch, zigzag, scribble, loopy S, straight strokes,
 * degenerate tick) showed the legacy path NEVER succeeded — every single
 * stroke, including straight lines, fell through to continuous-ribbon.
 * The raster path was unreachable (compile-time const never flipped).
 * So the chain was collapsed: continuous-ribbon IS the Extrude engine,
 * and Rod remains only for truly degenerate input (<2 usable samples).
 *
 * The strip builder was upgraded at the same time:
 *   • JOINS   — proper miter offsets (halfWidth / cos(turn/2), clamped
 *               at 2×halfWidth). The deprecated segmented builder used
 *               halfWidth / sin(turn/2), which explodes on NEARLY
 *               STRAIGHT vertices (sin→0) — that was the real cause of
 *               the historical "spikes at every vertex" blob. cos(φ/2)
 *               is ≈1 on smooth curves and only grows at genuine corners,
 *               so the zigzag no longer pinches and smooth strokes are
 *               untouched.
 *   • CAPS    — rounded half-disk end caps (profile revolved around the
 *               stroke endpoint), replacing the flat chopped-off quads.
 *   • BEVEL   — the UI bevel toggle now does something again: it chamfers
 *               the four long edges of the ribbon cross-section (octagonal
 *               profile), carried around the end caps too.
 *
 * Output is centered on z=0 (range [-halfDepth, +halfDepth]); the caller
 * does not translate. `halfWidth` IS the half-width: total cross-section
 * width on a straight segment is exactly 2 × halfWidth.
 *
 * Visual identity vs Rod: Rod is a circular tube; this ribbon has a
 * rectangular (or chamfered-rectangular) cross-section, so silhouettes
 * stay clearly distinct. Vs Solid: Solid is a depth-blind raster mask
 * extrusion; the ribbon cross-section follows the stroke tangent, giving
 * a calligraphic directionality Solid never produces.
 * ============================================================ */

/** Clamp the chamfer (bevel) so the cross-section stays a valid octagon:
 *  the chamfer eats `b` from each corner of the (2·halfWidth × depth)
 *  profile, so it must stay well below both half-extents. */
function clampChamfer(ep: ExtrudeParams, effectiveDepth: number, halfWidth: number): number {
  const halfDepth = effectiveDepth / 2
  const cap = 0.6 * Math.min(halfWidth, halfDepth)
  if (!isFinite(ep.bevelSize)) return 0
  return Math.max(0, Math.min(ep.bevelSize, cap))
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

/* ---- Segment intersection (shared helper — also used by Solid via
 *      segmentsIntersectPts) ---- */

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

// Miter length capped at halfWidth / RIBBON_MITER_COS_MIN = 2 × halfWidth.
// Beyond ~120° turns the miter stops growing; on smooth curves cos(turn/2) ≈ 1
// so the offset stays exactly halfWidth.
//
// This constant is the standard SVG/Canvas miter limit in disguise: the miter
// ratio is 1/sin(θ/2) where θ is the angle BETWEEN the segments, i.e.
// 1/cos(turn/2) in this file's turn convention, so cos-min 0.5 == miterlimit 2.
// What the old code did NOT do is the other half of that spec: when the limit
// is exceeded, a stroker CONVERTS THE JOIN — to bevel or round — instead of
// just shortening the miter. Clamping the magnitude while keeping ONE shared
// offset vertex is not a join at all: at a hairpin the shared vertex has to be
// on both sides of the ribbon at once, so the strip folds through itself. And
// at a true reversal the averaged normal cancels to zero length, which the old
// code handled by REUSING THE PREVIOUS VERTEX'S PERPENDICULAR — a vector that
// points the wrong way for the outgoing segment. That is the visible defect:
// the notch where 'h' 's arch springs off its stem, and the black triangular
// spike at the end of 'e' 's crossbar.
//
// Handwriting is made of these. A pen retraces its own line at the top of an
// 'h', the crotch of an 'n', the crossbar-to-bowl turn of an 'e'. So the join
// is not an edge case here, it is the letterform.
const RIBBON_MITER_COS_MIN = 0.5

/**
 * ONE tolerance replaces the two hard-coded segment counts this file used to
 * carry (a fixed 8-column cap, and no join tessellation at all).
 *
 * Both a cap and a round join are circular arcs of radius `halfWidth`. The
 * sagitta — the gap between the true arc and the chord that replaces it — is
 * `r·(1 − cos(φ/2))` for a segment spanning angle φ. Holding that error to a
 * fixed FRACTION of the radius gives `φ_max = 2·acos(1 − tol)`, so the segment
 * count follows from the angle actually being swept instead of being guessed:
 * a gentle join gets 1 segment, a hairpin gets ~11.
 *
 * This is the same error-driven rule the Rod engine already uses for its tube
 * rings (TUBE_FACET_TOLERANCE above, explainer 09 "curvature-adaptive tube
 * sampling from the sagitta") — the ribbon was the one builder still on fixed
 * counts. 0.01 (1% of the half-width) puts a 180° cap at 12 columns, close to
 * the 14-segment cap tessellation the Desk Doodles register uses.
 */
const RIBBON_ARC_FACET_TOLERANCE = 0.01
/** Max arc angle per segment at the tolerance above (≈16.2°). */
const RIBBON_ARC_MAX_ANGLE = 2 * Math.acos(1 - RIBBON_ARC_FACET_TOLERANCE)
/** Segments needed to sweep `angle`, at least 1. */
function ribbonArcSegments(angle: number): number {
  return Math.max(1, Math.ceil(Math.abs(angle) / RIBBON_ARC_MAX_ANGLE))
}

// Subdivide segments whose endpoint turn exceeds 25° (single pass).
const RIBBON_DENSIFY_ANGLE_THRESHOLD = 0.436

/* ------------------------------------------------------------------
 * BEVEL PROFILE FAMILY
 *
 * PORTED from desk-doodles `src/app/lib/geometry3d/strokeTo3d.ts:175-195`
 * (`ExtrudeBevelProfile` / `EXTRUDE_BEVEL_PROFILES`), including its finding,
 * verbatim:
 *
 *   "Rounded extrude edge (2026-06-12 look pass): the old 0.02 hairline bevel
 *    left the camera-facing face meeting the side wall at a hard 90° — under
 *    any rig the face reads as a flat cut-out. A fatter 3-segment bevel gives
 *    the rim a curved band that catches the key light and carries the form
 *    (the 'pressed cookie' read). Shared by Extrude + Solid."
 *
 * UNIT CONVERSION: Desk Doodles maps 800 canvas px to 8 world units
 * (WORLD_SCALE 0.01); Free Stroke maps the canvas's longest side to 3 units.
 * Absolute world lengths therefore convert DD → Free Stroke by ×0.3. DD's
 * EXTRUDE_BEVEL_SIZE 0.05 × 0.3 = 0.015, which is already exactly this file's
 * DEFAULT_EXTRUDE_PARAMS.bevelSize — the two registers agreed on the SIZE all
 * along. What was missing was SEGMENTS: `ExtrudeParams.bevelSegments` exists,
 * is defaulted, is typed, and was never read by the builder, so every bevel
 * was a single flat chamfer no matter what the field said.
 *
 * Why segments and not just size: a 1-segment chamfer replaces one 90° crease
 * with two ~45° creases, so the specular highlight still terminates at a hard
 * line — and two hard lines read as machined. Several segments give the rim a
 * band of continuously-varying normal, so the highlight runs ALONG the rim and
 * dies out. That gradient is most of what separates "drawn mark given volume"
 * from "CNC part".
 * ------------------------------------------------------------------ */

/**
 * Cross-section rows for one side of the ribbon, top → bottom, as
 * (inset from the offset edge, z).
 *
 * `b = 0` → the plain rectangle (DD's `sharp`: bevel off, die-cut edge).
 * `segments = 1` → the single cut corner this file produced before (DD's
 *   `soft`), byte-identical to the old four-row profile.
 * `segments ≥ 2` → a quarter-round: the rim becomes an arc from (inset b, +hd)
 *   to (inset 0, +hd − b), mirrored on the bottom (DD's `rounded`).
 */
/**
 * ⚠ `segments` IS SANITISED, AND BOTH HALVES OF THE GUARD ARE LOAD-BEARING.
 *
 * `Math.max(1, Math.floor(segments))` was not a guard. `Math.floor(NaN)` is
 * NaN and `Math.max(1, NaN)` is NaN, so the loop below never ran, this function
 * returned `[]`, and the caller dereferenced it — `Cannot read properties of
 * undefined (reading '0')`, an unhandled crash rather than a bad render. And
 * `+Infinity` survived the same expression, which does not crash: it runs the
 * loop forever and kills the heap at 512 MB.
 *
 * Both are reachable. `bevelSegments` is a real consumed field and the comment
 * at `components/viewport-3d.tsx` :503-508 anticipates the dial that writes it;
 * `window.__styleHarness.setExtrude` reaches it today. A slider that can emit an
 * empty string emits NaN.
 *
 * So: non-finite falls back to the shipped default rather than to 1 (1 is the
 * degenerate chamfer, and silently swapping a rounded rim for a cut corner is a
 * different picture, not a safe one), and the cap is stated. `SEG_MAX` is
 * generous — far past any value the rim reads differently at — because its job
 * is to bound the loop, not to express taste.
 */
const RIBBON_SEG_MAX = 256

function ribbonProfileRows(halfDepth: number, b: number, segments: number): { inset: number; z: number }[] {
  if (b <= 0) return [{ inset: 0, z: +halfDepth }, { inset: 0, z: -halfDepth }]
  const S = Number.isFinite(segments)
    ? Math.min(RIBBON_SEG_MAX, Math.max(1, Math.floor(segments)))
    : EXTRUDE_BEVEL_SEGMENTS_ROUNDED
  const top: { inset: number; z: number }[] = []
  for (let k = 0; k <= S; k++) {
    const th = (k / S) * (Math.PI / 2)
    // k=0 → (b, +hd); k=S → (0, +hd−b). At S=1 this degenerates to exactly the
    // two rows the old chamfer emitted, so `soft` is a no-op change.
    top.push({ inset: b * (1 - Math.sin(th)), z: halfDepth - b * (1 - Math.cos(th)) })
  }
  const bottom = top.map((r) => ({ inset: r.inset, z: -r.z })).reverse()
  return [...top, ...bottom]
}

/**
 * Build the Extrude ribbon: a single continuous shared-vertex strip mesh
 * with mitered joins, rounded end caps, and an optional chamfered profile.
 *
 *   pts       — polyline samples (z ignored for offsets; strokes live in XY)
 *   halfWidth — perpendicular offset; full ribbon width = 2 × halfWidth
 *   depth     — total Z extent (output spans [-depth/2, +depth/2])
 *   chamfer   — edge chamfer size (0 = sharp rectangular profile); callers
 *               should pre-clamp via `clampChamfer`, but the builder clamps
 *               defensively again.
 *
 * Why it doesn't blob:
 *   • Vertices are shared between adjacent quads → no overlapping boxes
 *     stacking up at every sample.
 *   • The miter uses halfWidth / cos(turn/2): ≈halfWidth on smooth curves,
 *     growing only at genuine corners; past the miter limit the join is
 *     CONVERTED to a round join rather than clamped, so a retrace or hairpin
 *     leaves a rounded pen blob instead of folding the strip through itself.
 *   • Zero-length input segments are filtered (prevents NaN perpendiculars).
 *   • Tight-turn densification keeps per-vertex turns small so joins stay
 *     visually smooth on loopy handwriting.
 *
 *   bevelSegments — rows of curvature in the chamfer. 1 = the flat cut corner
 *                   this builder produced before; 3 = the ported rounded rim.
 */
function buildContinuousRibbonStripGeometry(
  pts: THREE.Vector3[],
  halfWidth: number,
  depth: number,
  chamfer = 0,
  bevelSegments = 1
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
  //    bisectors turn by more than the threshold. A single midpoint pass
  //    halves the per-segment turn; for handwriting one pass suffices.
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
  const densified: THREE.Vector3[] = [filtered[0]]
  for (let i = 0; i < filtered.length - 1; i++) {
    const ta = turnAngleAt(filtered, i)
    const tb = turnAngleAt(filtered, i + 1)
    if (ta > RIBBON_DENSIFY_ANGLE_THRESHOLD || tb > RIBBON_DENSIFY_ANGLE_THRESHOLD) {
      const mx = (filtered[i].x + filtered[i + 1].x) * 0.5
      const my = (filtered[i].y + filtered[i + 1].y) * 0.5
      const mz = (filtered[i].z + filtered[i + 1].z) * 0.5
      densified.push(new THREE.Vector3(mx, my, mz))
    }
    densified.push(filtered[i + 1])
  }

  const samples = densified
  const N0 = densified.length
  const halfDepth = depth / 2
  const b = Math.max(0, Math.min(chamfer, 0.6 * Math.min(halfWidth, halfDepth)))

  /* ------------------------------------------------------------------
   * CLOSED LOOPS ARE BUILT AS LOOPS.
   *
   * MEASURED DEFECT (docs/explainers/13, §5b). `square/extrude` reported
   * **153 non-manifold edges** — an edge shared by more than two faces, i.e.
   * the surface passing through itself — and it was the only fixture with
   * `wall max 51` and `mixed max 60`, its worst creases sitting exactly there.
   * The cause is not the miter and not the bevel: the `square` fixture is a
   * closed loop drawn as ONE stroke that returns to its own start, so the
   * builder put a round END CAP at the last sample and another at the first,
   * one radius apart, sweeping opposite half-discs about THE SAME POINT. The
   * two half-discs overlap; their arc columns land on identical positions
   * wherever the two sweeps' angular steps coincide; welding by position then
   * makes those edges four-faced. This is the literal, measured instance of
   * *"look at all the weird joints … the edges and overlaps, the geometry gets
   * all weird."*
   *
   * A closed ribbon has no ends, so it needs no caps: the strip wraps from the
   * last frame back to the first and every sample is an interior mitered join.
   * Nothing is snapped or moved — the closing chord is treated as an ordinary
   * segment — so the drawn shape is unchanged; only the topology is.
   *
   * THE THRESHOLD, and why it is relative. `closeEps` is a fraction of the
   * ribbon's HALF-WIDTH, because "did the pen come back to where it started"
   * is a question about the mark's own thickness: a gap narrower than this is
   * one the two end caps already fill, so the form is visually closed whether
   * or not the topology says so, and closing it can only remove overlap. An
   * absolute epsilon would declare a fat mark open and a hairline mark closed
   * at the same pixel gap. The extra arc-length test stops a two-sample
   * back-and-forth tick — whose endpoints are trivially within one width of
   * each other — from being called a loop.
   * ------------------------------------------------------------------ */
  const CLOSE_EPS_HALFWIDTHS = 0.75
  const CLOSE_MIN_ARC_HALFWIDTHS = 4
  let arcLen = 0
  for (let i = 1; i < N0; i++) arcLen += samples[i].distanceTo(samples[i - 1])
  const endGap = samples[N0 - 1].distanceTo(samples[0])
  const closed =
    N0 >= 4 &&
    endGap <= halfWidth * CLOSE_EPS_HALFWIDTHS &&
    arcLen >= halfWidth * CLOSE_MIN_ARC_HALFWIDTHS
  // An exactly-closed loop repeats its first sample as its last. Keeping both
  // would leave a zero-length closing segment, which is the NaN-perpendicular
  // case step 1 exists to remove — so drop the repeat and let the wrap-around
  // supply that neighbour instead.
  const dropRepeat = closed && endGap <= MIN_EDGE
  let N = dropRepeat ? N0 - 1 : N0
  if (N < 2) return null

  /* THE SEAM MUST NOT BE FED BY A STUB.
   *
   * MEASURED, from the frames (docs/verification/gloss-rim/rim_after/crops/
   * extrude_seam_*.png). Closing the `square` loop replaced the overlapping-caps
   * blob with a proper mitre — and left a small inverted flap at the inner
   * corner that the other three corners do not have. The cause is in the input,
   * not the miter:
   *
   *   `processStroke` resamples at 4 px and PINS the endpoints, so the square's
   *   polyline ends ... (250,185.87) (250,181.87) (250,180), i.e. a 1.87 px
   *   REMAINDER between the last grid sample and the pinned end. (It also emits
   *   its first point twice, which `filterDuplicates` already removes.) After
   *   the repeat is dropped, that 1.87 px stub is the segment arriving at the
   *   seam corner.
   *
   *   A mitred 90 degree join offsets its shared vertex by
   *   halfWidth / cos(45) = 1.41 halfWidth, which at the default width is ~16 px
   *   of canvas. The inner column therefore has to travel 16 px inward across a
   *   1.87 px step and back out again: the inner boundary reverses over one
   *   segment, which is the flap. The other three corners are clean because
   *   Taubin smoothing spreads each of them over TWO samples (measured 51+30,
   *   49.8+28, 45.1+37.7 degrees) on regular 4 px steps, while the seam corner is
   *   pinned to a single hard 90.
   *
   * So the seam gets the spacing every other join already has: while the closing
   * segment is shorter than half a typical step, drop the sample that made it
   * short. Those samples lie ON the straight run they came from, so nothing
   * about the drawn shape moves — only the step length. Bounded by construction
   * (the closing gap only grows as samples are dropped) and it stops well before
   * it could eat a real feature, because one median step is the ceiling.
   */
  if (closed && N >= 4) {
    const steps: number[] = []
    for (let i = 1; i < N; i++) steps.push(samples[i].distanceTo(samples[i - 1]))
    steps.sort((a, b) => a - b)
    const medianStep = steps[Math.floor(steps.length / 2)]
    const minSeamStep = medianStep * 0.5
    let guard = 0
    while (
      N >= 4 &&
      guard++ < 4 &&
      samples[N - 1].distanceTo(samples[0]) < minSeamStep
    ) {
      N--
    }
  }

  // 3) Per-vertex MITERED offset along the averaged unit perpendicular.
  //    For unit segment normals n1, n2: |n1 + n2| = 2·cos(turn/2), so the
  //    averaged-normal length directly gives us the miter scale factor
  //    1 / cos(turn/2) — no extra trig. Ends get plain halfWidth.
  //    OVER THE MITER LIMIT the join is CONVERTED rather than clamped: the
  //    single shared vertex is replaced by a fan of frames that all sit on the
  //    SAME centreline point while the perpendicular rotates through the turn.
  //    That is the round join every 2D stroker uses, expressed in this strip's
  //    own vocabulary — the ladder topology is unchanged, there are just more
  //    rungs at the corner. At a hairpin the fan sweeps a full half turn on
  //    each side, i.e. the two columns together trace the round blob a pen
  //    actually leaves when it doubles back. Handwriting, not a fold.
  const frames: { x: number; y: number; ux: number; uy: number; mag: number }[] = []
  /** Index into `frames` of the ORIGINAL sample i (fan start), for the caps. */
  const frameOfSample: number[] = new Array(N)
  for (let i = 0; i < N; i++) {
    frameOfSample[i] = frames.length
    const px = samples[i].x, py = samples[i].y
    // Unit normals of the incoming and outgoing segments.
    let inX = 0, inY = 0, hasIn = false
    let outX = 0, outY = 0, hasOut = false
    // On a closed loop the neighbours wrap, so EVERY sample is an interior
    // mitered join and the `!hasIn || !hasOut` end-vertex branch below never
    // fires. That is the whole topological difference.
    const prevI = i > 0 ? i - 1 : closed ? N - 1 : -1
    const nextI = i < N - 1 ? i + 1 : closed ? 0 : -1
    if (prevI >= 0) {
      const dx = px - samples[prevI].x
      const dy = py - samples[prevI].y
      const l = Math.hypot(dx, dy)
      if (l > 0) { inX = -dy / l; inY = dx / l; hasIn = true }
    }
    if (nextI >= 0) {
      const dx = samples[nextI].x - px
      const dy = samples[nextI].y - py
      const l = Math.hypot(dx, dy)
      if (l > 0) { outX = -dy / l; outY = dx / l; hasOut = true }
    }

    if (!hasIn && !hasOut) {
      // No valid neighbours at all — a genuinely degenerate sample. Carry the
      // previous frame's direction so the strip stays continuous.
      const prev = frames[frames.length - 1]
      frames.push({ x: px, y: py, ux: prev ? prev.ux : 0, uy: prev ? prev.uy : 0, mag: halfWidth })
      continue
    }
    if (!hasIn || !hasOut) {
      // An end vertex: one segment only, plain halfWidth offset.
      const nx = hasIn ? inX : outX
      const ny = hasIn ? inY : outY
      frames.push({ x: px, y: py, ux: nx, uy: ny, mag: halfWidth })
      continue
    }

    const sx = inX + outX, sy = inY + outY
    const len = Math.hypot(sx, sy)
    const cosHalf = Math.min(1, len / 2)
    if (cosHalf >= RIBBON_MITER_COS_MIN) {
      // Inside the miter limit — one shared mitered vertex, exactly as before.
      frames.push({ x: px, y: py, ux: sx / len, uy: sy / len, mag: halfWidth / cosHalf })
      continue
    }

    // Over the limit → round join. Rotate from the incoming normal to the
    // outgoing one the short way; an exact reversal (cross and sin both ~0
    // with a negative dot) is genuinely two-sided, so take +π — either
    // direction sweeps the same disc, with the two columns swapping roles.
    const cross = inX * outY - inY * outX
    const dot = inX * outX + inY * outY
    let delta = Math.atan2(cross, dot)
    if (Math.abs(delta) < 1e-9 && dot < 0) delta = Math.PI
    const K = ribbonArcSegments(delta)
    for (let k = 0; k <= K; k++) {
      const th = (delta * k) / K
      const c = Math.cos(th), s = Math.sin(th)
      frames.push({
        x: px,
        y: py,
        ux: inX * c - inY * s,
        uy: inX * s + inY * c,
        mag: halfWidth,
      })
    }
  }

  const M = frames.length
  if (M < 2) return null

  // 4) Cross-section profile rows, top → bottom, defined at the nominal
  //    halfWidth as (inset from the offset edge, z). b = 0 is the plain
  //    rectangle; b > 0 with 1 segment is the old flat chamfer; b > 0 with
  //    more is the ported rounded rim. See ribbonProfileRows.
  const rows = ribbonProfileRows(halfDepth, b, bevelSegments)
  const RJ = rows.length

  const positions: number[] = []
  const indices: number[] = []
  const pushV = (x: number, y: number, z: number): number => {
    const idx = positions.length / 3
    positions.push(x, y, z)
    return idx
  }
  const quad = (a: number, b2: number, c: number, d: number) => {
    indices.push(a, b2, c, a, c, d)
  }
  const quadF = (a: number, b2: number, c: number, d: number, flip: boolean) => {
    if (flip) quad(d, c, b2, a)
    else quad(a, b2, c, d)
  }
  const triF = (a: number, b2: number, c: number, flip: boolean) => {
    if (flip) indices.push(c, b2, a)
    else indices.push(a, b2, c)
  }

  // 5) Strip columns: L[row][sample] / R[row][sample]. Chamfer inset is
  //    ABSOLUTE (b along the offset direction), applied to the mitered
  //    magnitude m — m ≥ halfWidth > b so the inset never crosses center.
  const L: number[][] = rows.map(() => new Array(M))
  const R: number[][] = rows.map(() => new Array(M))
  for (let i = 0; i < M; i++) {
    const f = frames[i]
    for (let j = 0; j < RJ; j++) {
      const rad = f.mag - rows[j].inset
      L[j][i] = pushV(f.x + f.ux * rad, f.y + f.uy * rad, rows[j].z)
      R[j][i] = pushV(f.x - f.ux * rad, f.y - f.uy * rad, rows[j].z)
    }
  }

  // 6) Faces between consecutive frames. Shared endpoints → continuous
  //    strip, no internal duplicated faces. Winding chosen so each face's
  //    outward normal points away from the ribbon interior (verified by
  //    right-hand rule on a +X-direction test segment). Frames inside a round
  //    join share a centreline point, so their quads are the join's own wedges.
  //    On a closed loop the last frame's rung is joined back to the first, so
  //    the strip has no free end and needs no cap — see the closure block.
  const rungs = closed ? M : M - 1
  for (let i = 0; i < rungs; i++) {
    const i2 = (i + 1) % M
    quad(L[0][i], R[0][i], R[0][i2], L[0][i2])                     // top    (+Z)
    quad(L[RJ - 1][i], L[RJ - 1][i2], R[RJ - 1][i2], R[RJ - 1][i]) // bottom (-Z)
    for (let j = 0; j < RJ - 1; j++) {
      quad(L[j][i], L[j][i2], L[j + 1][i2], L[j + 1][i])           // left strips
      quad(R[j][i], R[j + 1][i], R[j + 1][i2], R[j][i2])           // right strips
    }
  }

  /* 7) Rounded end caps: revolve the profile's outer edge half a turn
   *    around the endpoint (from the L column, through the outward
   *    tangent, to the R column), then close top/bottom with fans.
   *    k=0 / k=K reuse the strip's own end-column vertices so the mesh
   *    stays watertight and normal-smooth across the seam.
   *
   * MEASURED DEFECT (docs/explainers/13, §5c): **8–12 boundary edges on EVERY
   * Extrude mesh, regardless of fixture** — a boundary edge belongs to exactly
   * one face, so the shell had holes, consistently, everywhere.
   *
   * They were T-JUNCTIONS, and this is where they came from. The half-disc that
   * closes the cap in +Z used to be a fan around a NEW vertex at
   * `(e.x, e.y, +halfDepth)`. At an end frame the mitered magnitude is exactly
   * `halfWidth`, so that vertex lands precisely on the MIDPOINT of the chord
   * L[0]-R[0] — which is an edge of the strip's own top-face quad. The chord
   * therefore had one face (the strip's), and the two outermost fan spokes had
   * one face each (the fan's), and the three of them are collinear: geometry
   * with no visible gap, topology with three holes, per z-face, per cap. Six
   * per cap, twelve per ribbon — the exact number measured, and the reason it
   * "was small enough not to show under this lighting".
   *
   * The fix removes the vertex rather than adding a weld. A half-disc is convex,
   * so a fan anchored on one END of its diameter triangulates it just as well as
   * a fan around its centre — and that anchor is `cols[0][…]`, a vertex the
   * strip ALREADY shares. Its closing triangle spans the chord, so the chord
   * gains a second face; every spoke is interior. Boundary edges go to zero, the
   * cap loses two vertices and one triangle per z-face, and no new vertex exists
   * that could sit in the middle of somebody else's edge.
   */
  const addCap = (sampleIndex: number) => {
    const frameIndex = sampleIndex === 0 ? 0 : M - 1
    const f = frames[frameIndex]
    const e = samples[sampleIndex]
    const ux = f.ux, uy = f.uy
    if (ux === 0 && uy === 0) return
    const nb = sampleIndex === 0 ? samples[1] : samples[sampleIndex - 1]
    let dx = e.x - nb.x, dy = e.y - nb.y
    const dl = Math.hypot(dx, dy)
    if (dl <= 0) return
    dx /= dl; dy /= dl
    // Sweep handedness decides face winding (start cap mirrors end cap).
    const flip = (ux * dy - uy * dx) > 0
    // Curvature-adaptive instead of a fixed 8: the cap is a half turn, so the
    // column count comes from the same sagitta rule the joins use.
    const K = ribbonArcSegments(Math.PI)
    const cols: number[][] = []
    cols.push(rows.map((_, j) => L[j][frameIndex]))
    for (let k = 1; k < K; k++) {
      const th = (k / K) * Math.PI
      const rx = ux * Math.cos(th) + dx * Math.sin(th)
      const ry = uy * Math.cos(th) + dy * Math.sin(th)
      cols.push(rows.map((row) => {
        const rad = halfWidth - row.inset
        return pushV(e.x + rx * rad, e.y + ry * rad, row.z)
      }))
    }
    cols.push(rows.map((_, j) => R[j][frameIndex]))
    // Fan anchors: the L end of each z-face's diameter, shared with the strip.
    const anchorTop = cols[0][0]
    const anchorBot = cols[0][RJ - 1]
    for (let k = 0; k < K; k++) {
      const a = cols[k], c = cols[k + 1]
      if (k > 0) {
        // k = 0 would be degenerate — its `a` IS the anchor.
        triF(anchorTop, c[0], a[0], flip)                         // top fan   (+Z)
        triF(anchorBot, a[RJ - 1], c[RJ - 1], flip)               // bottom fan (-Z)
      }
      for (let j = 0; j < RJ - 1; j++) {
        quadF(a[j], c[j], c[j + 1], a[j + 1], flip)               // cap wall/chamfer
      }
    }
  }
  if (!closed) {
    addCap(0)
    addCap(N - 1)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}


/**
 * Build the Extrude geometry for a stroke. Single strategy: the continuous
 * ribbon strip (see block comment above). Rod fallback only fires for truly
 * degenerate input (<2 usable samples after duplicate filtering) — for any
 * real stroke the ribbon builder cannot fail.
 *
 * Bevel semantics: for widths under TINY_WIDTH_THRESHOLD the chamfer is
 * forced off (a chamfer on a hairline ribbon just eats the whole profile);
 * status reports `bevelOffTinyWidth` so the debug overlay can show why.
 */
function tryBuildExtrudeGeometry(
  filtered: THREE.Vector3[],
  extrudeParams: ExtrudeParams,
  userWidth: number,
  _si: number,
): { geometry: THREE.BufferGeometry | null; status: StrokeBuildStatus } {
  // extrudeParams.depth is a width-relative multiplier; convert to world-space.
  const depthMultiplier = extrudeParams.depth
  const effectiveDepth = computeEffectiveExtrudeDepth(depthMultiplier, userWidth)

  // THE BEVEL KILL-SWITCH IS GONE — it was the Extrude instance of "a guard
  // whose failure mode is the worst available answer".
  //
  // It read `useBevel = bevelEnabled && userWidth >= TINY_WIDTH_THRESHOLD`, and
  // its else-branch handed the ribbon a chamfer of ZERO: a hard 90° face-to-wall
  // terminator, the exact die-cut read this whole pass exists to remove. The
  // threshold is 0.03 against a width envelope of [0.020, 0.080] mapped through
  // a t² slider, so it fired for every slider position below t ≈ 0.41 — the
  // bottom 41% of the control, with the DEFAULT (0.035) sitting one notch above
  // the cliff. Nudge Width down once and the whole rolled rim disappears.
  //
  // It was also redundant. `clampChamfer` already caps the chamfer at
  // 0.6·min(halfWidth, halfDepth), which is proportional, so the profile stays a
  // valid octagon at every point in the envelope: at the floor width 0.010 with
  // the default depth multiplier the cap is 0.003 — small, but a roll rather
  // than a cut. The original worry ("a chamfer on a hairline ribbon eats the
  // whole profile") is precisely what that clamp prevents; the kill-switch was
  // a second, blunter guard layered on a working one, and only the blunt one
  // could produce a hard edge.
  //
  // So: the bevel now SHRINKS with the mark instead of vanishing. The status
  // still reports when the clamp is what set the size, so the debug overlay can
  // still say "your bevelSize was not what you got, and here is why".
  const chamfer = extrudeParams.bevelEnabled
    ? clampChamfer(extrudeParams, effectiveDepth, userWidth)
    : 0
  const clampBound = extrudeParams.bevelEnabled && chamfer > 0 && chamfer < extrudeParams.bevelSize
  const isTinyWidth = userWidth < TINY_WIDTH_THRESHOLD

  const geo = buildContinuousRibbonStripGeometry(
    filtered,
    userWidth,
    effectiveDepth,
    chamfer,
    // `bevelSegments` has existed on ExtrudeParams since the field was added
    // and was never read here — the builder always emitted a single flat
    // chamfer. It is read now; the default moved to the ported `rounded` 3.
    extrudeParams.bevelSegments,
  )
  if (geo) {
    // Reported, not acted on: the bevel is still built at a clamped size. The
    // status name is kept so the debug overlay's existing row keeps working —
    // it now means "the clamp, not your bevelSize, decided this rim", which is
    // information; it used to mean "there is no rim", which was the defect.
    if (isTinyWidth && clampBound) {
      console.log(`[v0] stroke ${_si} final: extrude(bevelClampedTinyWidth chamfer=${chamfer.toFixed(4)}) (strategy=continuous-ribbon)`, { width: userWidth, depthMultiplier, effectiveDepth })
      return {
        geometry: geo,
        status: { type: "bevelOffTinyWidth", width: userWidth, depth: effectiveDepth, strategy: "continuous-ribbon", depthMultiplier, effectiveDepth },
      }
    }
    console.log(`[v0] stroke ${_si} final: extrude(continuous-ribbon)`, { width: userWidth, depthMultiplier, effectiveDepth, chamfer })
    return {
      geometry: geo,
      status: { type: "ok", width: userWidth, depth: effectiveDepth, bevelEnabled: chamfer > 0, strategy: "continuous-ribbon", depthMultiplier, effectiveDepth },
    }
  }

  // Truly degenerate input — render a Rod tube so SOMETHING shows.
  const fbRadius = fallbackRodRadius(userWidth)
  console.log(`[v0] stroke ${_si} final: rodFallback (continuous-ribbon declined: degenerate input)`)
  return {
    geometry: null,
    status: {
      type: "rodFallback",
      reason: "continuous-ribbon declined: degenerate input",
      fallbackRadius: fbRadius,
      strategy: "continuous-ribbon",
      depthMultiplier,
      effectiveDepth,
    },
  }
}

/**
 * Is this Rod stroke a closed loop, per ROD_TUNING.loopEnds?
 *
 * ONE function, called from all three places Rod builds a curve. Rod's preview
 * path, its animated path and `buildRodGeometryData` each carry their OWN inline
 * copy of the curve/tube/cap construction — a parallel implementation of one
 * idea, which is this repo's most expensive recurring defect and is exactly why
 * the first version of this fix landed on the copy nothing calls and measured
 * ZERO change on every fixture. The decision itself lives here so it cannot
 * drift between them.
 */
function rodStrokeIsClosed(filtered: THREE.Vector3[], radius: number): boolean {
  return (
    ROD_TUNING.loopEnds === "wrapped" &&
    inflateChainIsClosed(
      filtered.map((v) => ({ x: v.x, y: v.y })),
      radius,
    )
  )
}

/**
 * THE SEAM MUST NOT BE FED BY A STUB — ported from Extrude (:1964), where it is
 * the second half of the closed-loop fix and where the reasoning lives in full.
 *
 * `processStroke` resamples at 4 px and PINS the endpoints, so a closed square's
 * polyline ends `… (250,185.87) (250,181.87) (250,180)`: a 1.87 px REMAINDER
 * between the last grid sample and the pinned end. Wrapping a sweep around that
 * stub gives the seam a step an order of magnitude shorter than every other
 * join, and a swept body cannot turn a corner inside one short step without
 * folding.
 *
 * MEASURED HERE, and it is why this exists rather than being assumed: porting
 * only the CLOSURE half to Rod took `square/rod` from 1 fold ray to **3, at up
 * to 6 sheets, all three still within 0.4-1.0 tube radii of the seam corner**.
 * The closure was right and incomplete — the same trap explainer 17 §2 hit on
 * Extrude, where the census went clean and the picture did not.
 *
 * Drops trailing samples while the closing chord is shorter than half a median
 * step. Those samples lie ON the straight run they came from, so nothing about
 * the drawn shape moves — only the step length. Bounded by construction: the
 * closing gap only grows as samples are dropped, and the guard stops it well
 * before it could eat a real feature.
 */
function dropSeamStub<T extends { x: number; y: number }>(pts: T[]): T[] {
  let n = pts.length
  if (n < 4) return pts
  const steps: number[] = []
  for (let i = 1; i < n; i++) steps.push(Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  steps.sort((a, b) => a - b)
  const minSeamStep = steps[Math.floor(steps.length / 2)] * 0.5
  let guard = 0
  while (
    n >= 4 &&
    guard++ < 4 &&
    Math.hypot(pts[n - 1].x - pts[0].x, pts[n - 1].y - pts[0].y) < minSeamStep
  ) {
    n--
  }
  return n === pts.length ? pts : pts.slice(0, n)
}

/** Derive fallback rod radius from extrude width so Width slider affects fallback strokes too */
function fallbackRodRadius(width: number): number {
  return Math.max(0.003, Math.min(width * 0.5, 0.08))
}

interface RodGeometryData {
  tubeGeometry: THREE.BufferGeometry
  curve: THREE.CatmullRomCurve3
  /** `undefined` on a CLOSED loop — a loop has no ends. Never `[]`: every
   *  consumer guards with `capPositions &&`, and an empty array passes that
   *  test and then reads `[1]`. See the note at the RodEngine emitter. */
  capPositions: THREE.Vector3[] | undefined
  jointPositions: THREE.Vector3[]
  jointFractions: number[]
  ringArcFracs: number[]
}

/** Build full rod geometry data (tube + cap positions + joint positions) for a stroke */
function buildRodGeometryData(filtered: THREE.Vector3[], radius: number = TUBE_RADIUS): RodGeometryData {
  const closed = rodStrokeIsClosed(filtered, radius)
  const loopPts = closed ? dropSeamStub(filtered) : filtered
  const curve = new THREE.CatmullRomCurve3(loopPts, closed, "centripetal")
  const { geometry: tubeGeometry, ringArcFracs } = buildAdaptiveTubeGeometry(curve, radius, closed)

  // Inset cap spheres slightly along tangent so they sit inside the tube ends.
  // A closed loop HAS no ends: emitting them anyway put two spheres 0.5-0.7 r
  // apart at the seam (near-coincident duplicate surfaces) on top of an open
  // tube whose two ends overlapped. See ROD_TUNING.loopEnds for the numbers.
  const inset = radius * 0.35
  const startTangent = curve.getTangentAt(0)
  const endTangent = curve.getTangentAt(1)
  const startCapPos = filtered[0].clone().addScaledVector(startTangent, inset)
  const endCapPos = filtered[filtered.length - 1].clone().addScaledVector(endTangent, -inset)
  // `undefined`, not `[]` — see the note at the RodEngine emitter above.
  const capPositions = closed ? undefined : [startCapPos, endCapPos]

  const { positions: jointPositions, fractions: jointFractions } = detectJoints3D(
    filtered, filtered[0], filtered[filtered.length - 1], closed
  )

  return { tubeGeometry, curve, capPositions, jointPositions, jointFractions, ringArcFracs }
}

/** Build merged capped rod geometry (tube + cap spheres + joint spheres) for export */
function buildCappedRodGeometry(filtered: THREE.Vector3[], radius: number = TUBE_RADIUS): THREE.BufferGeometry {
  const { tubeGeometry, capPositions, jointPositions } = buildRodGeometryData(filtered, radius)
  
  const capSphere = new THREE.SphereGeometry(radius, SPHERE_SEGMENTS, SPHERE_SEGMENTS)

  /* A CLOSED loop has no ends, so `capPositions` is undefined and there are no
   * cap spheres to merge. This block read `capPositions[0].x` unguarded, so the
   * EXPORT path would have thrown on any closed mark the moment it was reached —
   * the same defect as the render loop's, one file over, and unmeasured because
   * nothing in the harness exports a closed Rod loop. */
  const caps: THREE.BufferGeometry[] = []
  if (capPositions && capPositions.length >= 2) {
    caps.push(capSphere.clone().translate(capPositions[0].x, capPositions[0].y, capPositions[0].z))
    caps.push(capSphere.clone().translate(capPositions[1].x, capPositions[1].y, capPositions[1].z))
  }

  const jointGeos: THREE.BufferGeometry[] = []
  for (const pos of jointPositions) {
    jointGeos.push(capSphere.clone().translate(pos.x, pos.y, pos.z))
  }

  const parts = [tubeGeometry, ...caps, ...jointGeos]
  const merged = mergeGeometriesSafe(parts, false)
  
  // Dispose cap/joint geometries (but NOT tubeGeometry if merge failed)
  capSphere.dispose()
  
  if (merged) {
    // Merge succeeded - dispose all parts
    tubeGeometry.dispose()
    caps.forEach((g) => g.dispose())
    jointGeos.forEach((g) => g.dispose())
    return merged
  }
  
  // Merge failed - dispose only the extra parts, return tube as fallback
  caps.forEach((g) => g.dispose())
  jointGeos.forEach((g) => g.dispose())
  return tubeGeometry
}

/* ------------------------------------------------------------------
 * DRAFTED SIDE WALLS — the pool centre, and why it is an argument.
 *
 * `applyDraftTaper` (lib/dd-extrude-relief.ts, ported verbatim) shrinks the
 * back face toward THE GEOMETRY'S OWN bbox centre. Desk Doodles hands it one
 * pooled slab, so that centre is the mark's centre and the whole form reads as
 * one part released from a die. Free Stroke's Extrude emits ONE GEOMETRY PER
 * STROKE, so the verbatim call would taper the `h` of a word toward the `h`'s
 * centre and the `o` toward the `o`'s — five separate mouldings leaning in five
 * directions instead of one mark. `applyDraftTaperAbout` is the same arithmetic
 * with the centre supplied; this is where the centre comes from.
 *
 * WHY THE CALLER MAY OVERRIDE IT, and why that is not optional polish. During
 * draw-in, Extrude rebuilds its geometry every tick from an ARC-LENGTH-FILTERED
 * PARTIAL of the strokes (see `animatedStrokes` in viewport-3d). The pool of a
 * partial has a smaller bbox than the pool of the finished mark, so a centre
 * derived from whatever this call happens to have been given would MOVE across
 * the reveal — and every already-drawn letter's walls would re-slant on every
 * frame. `params.draftCentre`, computed once from the FULL strokes, pins it. The
 * fallback (this call's own pool) is correct for the static and export paths,
 * where what it was given IS the whole mark.
 * ------------------------------------------------------------------ */
export function computeExtrudePoolCentreXY(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number } | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const stroke of strokes) {
    if (!stroke.points || stroke.points.length < 2) continue
    for (const p of strokeTo3D(stroke, canvasWidth, canvasHeight)) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 }
}

export const ExtrudeEngine: GeometryEngine = {
  buildPreview(strokes: ProcessedStroke[], params: PreviewParams): StrokeMeshData[] {
    const { canvasWidth, canvasHeight, extrudeParams: ep } = params
    const extrudeParams = ep ?? DEFAULT_EXTRUDE_PARAMS
    if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) return []

    const drafted = extrudeParams.sideWall === "drafted"
    const draftCentre = drafted
      ? (params.draftCentre ?? computeExtrudePoolCentreXY(strokes, canvasWidth, canvasHeight))
      : null

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
      // dep array.
      //
      // CRITICAL: do NOT include `stroke.points.length` in this key. During
      // Extrude playback the stroke is rebuilt every ~22ms from an arc-length-
      // filtered partial (see `filterStrokesByProgress` + the `animatedStrokes`
      // useMemo in viewport-3d), and that partial grows by 1 point per tick.
      // If the React key included that count, every progress tick would change
      // the key, unmount the entire <group>, and remount it with the new
      // geometry — losing the in-flight WebGL state between ticks and visibly
      // producing a single late "appears all at once" paint at progress=1
      // instead of a smooth progressive reveal. The slider paramKey already
      // forces a remount when geometry parameters change, which is the only
      // remount we actually want.
      // `sideWall` is in the key for the same reason width/depth/bevel are: it
      // changes the geometry, so React must remount the <mesh>. (The memo
      // signature in useStrokeMeshes serialises the whole ExtrudeParams object,
      // so the rebuild itself is already covered the moment the field exists —
      // which is exactly what that derived-signature comment was written for.)
      const paramKey = `w${extrudeParams.width.toFixed(3)}-d${extrudeParams.depth.toFixed(3)}-b${extrudeParams.bevelEnabled ? 1 : 0}-sw${extrudeParams.sideWall}`
      if (geometry && drafted && draftCentre) {
        applyDraftTaperAbout(geometry, EXTRUDE_DRAFT_AMOUNT, draftCentre)
      }
      if (geometry) {
        result.push({
          tubeGeometry: geometry,
          filteredCount: filtered.length,
          key: `stroke-${si}-${paramKey}`,
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
          ringArcFracs: rodData.ringArcFracs,
          filteredCount: filtered.length,
          // Same rationale: omit stroke.points.length so the rod-fallback group
          // doesn't remount each progress tick during Extrude playback either.
          key: `stroke-${si}-${paramKey}-rod-fallback`,
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

    const exportMaterial = createExportMaterial(params)
    const exportObjects: THREE.Object3D[] = []
    const disposables: THREE.BufferGeometry[] = []

    // Export always gets the WHOLE mark, so its own pool is the right centre —
    // but honour an explicit one if a caller supplies it, so preview and export
    // can be proven to taper about the same point.
    const drafted = extrudeParams.sideWall === "drafted"
    const draftCentre = drafted
      ? (params.draftCentre ?? computeExtrudePoolCentreXY(strokes, canvasWidth, canvasHeight))
      : null

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
      // The rod fallback is tapered too — it is part of the same mark, and a
      // straight-walled tube beside drafted ribbons is the visible seam.
      if (drafted && draftCentre) {
        applyDraftTaperAbout(finalGeo, EXTRUDE_DRAFT_AMOUNT, draftCentre)
      }
      const mesh = new THREE.Mesh(finalGeo, exportMaterial)
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
      ...exportMaterialMeta(params),
      settings: {
        ...params.settings,
        extrudeWidth: extrudeParams.width,
        // extrudeDepth is the slider value, now interpreted as a width-relative
        // multiplier (see DEFAULT_EXTRUDE_PARAMS comment). The actual world-space
        // depth used for each stroke = computeEffectiveExtrudeDepth(multiplier, width).
        extrudeDepthMultiplier: extrudeParams.depth,
        extrudeDepthEffective: computeEffectiveExtrudeDepth(extrudeParams.depth, extrudeParams.width),
        bevelEnabled: extrudeParams.bevelEnabled,
        extrudeSideWall: extrudeParams.sideWall,
        extrudeDraftAmount: drafted ? EXTRUDE_DRAFT_AMOUNT : 0,
      },
    }

    for (const obj of exportObjects) {
      rootGroup.add(obj)
    }

    exportMaterial.dispose()

    return {
      group: rootGroup,
      disposables,
      objectCount: exportObjects.length,
      merged: canMerge,
    }
  },
}

/* ══════════════════════════════════════════════════════════════════════════
 *
 *   ⚠  SUPERSEDED SOLID PIPELINE — NOTHING IN THIS REPO REACHES ANY OF IT.
 *
 *   Everything from here to `findEnclosedHoles` (~1,910 lines, ending just
 *   above `strokesToTestStroke`) is the FIRST raster-Solid implementation:
 *   its own rasteriser, its own marching squares, its own Douglas-Peucker,
 *   its own self-intersection cleaner, its own contour hierarchy, its own
 *   morphology, its own hole test, and its own mesh builder.
 *
 *   THE LIVE ONE IS `lib/solid-mask.ts` (`buildMaskSolid`), imported at the
 *   top of this file and called by `SolidEngine` and by Inflate's fallback.
 *   Every improvement of the last several passes — sub-cell boundary
 *   placement, `snapLoopToCoverage`, the inward-offset rim bevel and its
 *   raster-resolution guard, `SOLID_TUNING.capFit`, the hole-topology work —
 *   landed THERE. None of it is here. Read this block as history, never as
 *   documentation of what the app does.
 *
 *   MEASURED, not assumed (`scripts/verify/_probe-dead-code.mjs`, gated by
 *   `scripts/verify/assert-dead-code.mjs`): a breadth-first walk from every
 *   exported root and every top-level side-effecting statement, cross-checked
 *   against every identifier named anywhere else in `lib/`, `app/`,
 *   `components/` and `scripts/`, reaches NONE of these declarations. The
 *   walk is calibrated in both directions on the same run — the four engine
 *   roots and the functions the verification battery calls must all come back
 *   reachable, and they do.
 *
 *   ⚠  IT IS NOT DELETED, DELIBERATELY. §0.7 of the dispatch contract:
 *   removing a prior implementation is a deletion, and this repo has lost
 *   work that way twice. It is MARKED and PINNED instead — the gate holds the
 *   dead-declaration count exactly, so a NEW dead declaration fails and a
 *   REVIVAL also fails, loudly, rather than either drifting past a reader.
 *
 *   Two consequences worth stating for anyone editing in here:
 *     · a change to this block cannot change rendered geometry. That is why
 *       the duplicate-shoelace merge below (`signedArea` is now an alias of
 *       `signedAreaRaw`) was free: both functions and every one of their
 *       callers are inside this block.
 *     · a `file:line` citation pointing into here is citing dead code. The
 *       citation gate cannot know that; you can.
 *
 * ══════════════════════════════════════════════════════════════════════════ */

/* ------------------------------------------------------------------ */
/*  SolidEngine — raster mask -> marching squares -> extrude          */
/*  (superseded — see the banner above)                               */
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

/**
 * SIGNED POLYGON AREA — the ONE implementation in this module.
 * Positive = CCW, negative = CW, in this module's y-up world space.
 *
 * ⚠ THERE WERE TWO, WITH IDENTICAL BODIES AND DIFFERENT NAMES: this one and a
 * `signedArea` down in the contour-classification block, character for
 * character the same loop. `signedArea` is now a one-line alias of this, so the
 * arithmetic exists once and every caller is byte-identical.
 *
 * ⚠ AND THERE ARE STILL TWO MORE IN THE REPO, DELIBERATELY NOT MERGED INTO
 * THIS. `lib/solid-mask.ts` uses the CROSS form `Σ(x₁y₂ − x₂y₁)/2`; this one
 * uses the TRAPEZOID form `Σ(xⱼ − xᵢ)(yⱼ + yᵢ)/2`. They agree in sign and to
 * within float error, and they do NOT agree bit for bit — so folding them
 * together is a change to rendered geometry wearing a tidy-up's clothes, and
 * this repo gates on byte identity. `lib/solid-vector.ts`'s copy is the
 * trapezoid form NEGATED, because that module works in a y-down space; merging
 * it would silently flip every winding test in it.
 *
 * The rule this leaves behind: one implementation per SIGN CONVENTION and per
 * MODULE, each stating its convention, rather than one per call site.
 */
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
            /* A `const ri = rev.findIndex(…)` sat here, computed and never read.
             * Its predicate was `r.key === contour[contour.length - 1] ? … : …`
             * — a STRING compared to a `{x, y}` POINT, which TypeScript flagged
             * (TS2367) and which can never be true, so the ternary always took
             * its else branch and the `r` parameter went unused. It found an
             * index nothing consumed, using a test that could not fire. The
             * loop below is and always was the real removal. Recorded here
             * rather than left in place: dead code that also cannot work is a
             * reader's trap, not a spare part. */
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

/** Signed area of a 2D polygon. Positive = CCW, negative = CW.
 *  ALIAS of `signedAreaRaw` — this was a second, character-identical copy of
 *  the same loop. See that function's note. */
const signedArea = signedAreaRaw

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

/* ══════════════════════════════════════════════════════════════════════════
 *   END OF THE SUPERSEDED SOLID PIPELINE. Live code resumes below.
 *   (See the banner above `SOLID_RASTER_SIZE` for what this block is and why
 *   it is marked rather than removed.)
 * ══════════════════════════════════════════════════════════════════════════ */



/**
 * Convert ProcessedStroke[] to a single merged TestStroke for the sandbox pipeline.
 *
 * CRITICAL: The sandbox pipeline (buildMaskSolid/renderStrokeToMask) expects points
 * in WORLD COORDINATES (roughly -1.5 to +1.5 range, centered at 0).
 *
 * Real app strokes are in CANVAS PIXEL COORDINATES (0 to canvasWidth/Height).
 *
 * This function converts from canvas pixel space to world space.
 *
 * "Merged" means merged into one POOL, not merged into one polyline. The pool
 * fuses in the raster — two strokes become one mass because they paint the same
 * cells. `subpathStarts` records where each stroke began so the rasterizer can
 * start a new subpath there; without it, the flat array reads as a single
 * polyline and the rasterizer draws a full-thickness connector from the end of
 * every stroke to the start of the next. Strokes with no points contribute no
 * start index, so an empty stroke can never open an empty subpath.
 */
function strokesToTestStroke(strokes: ProcessedStroke[], canvasWidth: number, canvasHeight: number): TestStroke {
  const allPoints: { x: number; y: number }[] = []
  const subpathStarts: number[] = []

  // Convert canvas pixel coords to world coords
  // Canvas: (0,0) top-left, (canvasWidth, canvasHeight) bottom-right
  // World: (-1.5, -1.5) to (1.5, 1.5), center at (0, 0), Y-up
  const scale = 3.0 / Math.max(canvasWidth, canvasHeight)
  const offsetX = canvasWidth / 2
  const offsetY = canvasHeight / 2

  // F118: a reveal-cut piece carries its true arc (`clipArc`, canvas px); the
  // raster strokes a piece shorter than the line width at its own arc.
  const subpathArc: (number | undefined)[] = []
  let anyArc = false
  for (const s of strokes) {
    if (s.points.length === 0) continue
    subpathStarts.push(allPoints.length)
    const arc = (s as ClippedPiece).clipArc
    if (arc !== undefined) anyArc = true
    subpathArc.push(arc === undefined ? undefined : arc * scale)
    for (const p of s.points) {
      // Convert: canvas pixel -> centered -> scaled -> flip Y for world coords
      const worldX = (p.x - offsetX) * scale
      const worldY = -(p.y - offsetY) * scale  // Flip Y: canvas Y-down, world Y-up
      allPoints.push({ x: worldX, y: worldY })
    }
  }
  return anyArc ? { points: allPoints, subpathStarts, subpathArc } : { points: allPoints, subpathStarts }
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

/* ============================================================
 * SOLID: SEPARATE MARKS ARE SEPARATE MASSES
 *
 * `buildMaskSolid` rasterizes the pool, labels connected components, and then
 * keeps ONLY THE LARGEST ONE (solid-mask.ts "Find largest component"). Every
 * other component is discarded before the contour is traced.
 *
 * That was invisible for as long as the rasterizer welded every stroke to the
 * next with a phantom connector bar, because then there only ever WAS one
 * component. With the connectors gone, a five-stroke word renders as its
 * biggest letter and nothing else — the second bug was being hidden by the
 * first.
 *
 * The fix that matches Solid's own semantics: strokes whose ink can touch fuse
 * into one mass (that is what Solid IS), strokes that cannot touch are separate
 * masses and each gets its own build. So we cluster first and build per cluster.
 *
 * Cost is honest and bounded: one full raster per cluster. A single-cluster
 * drawing takes the identical code path it did before (no clustering work is
 * even reachable), and above SOLID_MAX_CLUSTERS we fall back to one pooled
 * build rather than let a scribble with 40 disjoint marks multiply the raster
 * cost by 40.
 * ============================================================ */

/** Above this many disjoint clusters, fall back to a single pooled build. */
const SOLID_MAX_CLUSTERS = 16

/**
 * Group strokes that could fuse. Two strokes fuse when any pair of their points
 * is within one ink diameter — the same condition under which their stamped
 * bodies overlap in the raster. Union-find over a bbox prefilter, so the
 * O(n·m) point test only runs for stroke pairs whose padded boxes overlap.
 */
function clusterStrokesByInkOverlap(
  strokes: ProcessedStroke[],
  thicknessPx: number,
): ProcessedStroke[][] {
  const n = strokes.length
  if (n <= 1) return n === 1 ? [strokes] : []

  const pad = thicknessPx // one ink diameter: radius from each of the two bodies
  /* F118 TRAVEL-6: a reveal-cut piece shorter than the line is stroked at its own
   * arc (renderStrokeToMask, TRAVEL-4), so its ink radius is half that arc, not half
   * the line. Two bodies touch when their points sit within the SUM of their radii. */
  const radius = strokes.map((s) => {
    const arc = (s as ClippedPiece).clipArc
    return arc !== undefined && arc < thicknessPx ? arc / 2 : thicknessPx / 2
  })
  const boxes = strokes.map((s) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const p of s.points) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    return { minX, minY, maxX, maxY }
  })

  const parent = new Array(n).fill(0).map((_, i) => i)
  const find = (a: number): number => {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a] }
    return a
  }
  const union = (a: number, b: number) => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (find(i) === find(j)) continue
      const a = boxes[i], b = boxes[j]
      if (a.maxX + pad < b.minX || b.maxX + pad < a.minX) continue
      if (a.maxY + pad < b.minY || b.maxY + pad < a.minY) continue
      // Padded boxes overlap — confirm with the actual point sets.
      let touched = false
      const reach = radius[i] + radius[j]
      const reachSq = reach * reach
      const pa = strokes[i].points, pb = strokes[j].points
      for (let x = 0; x < pa.length && !touched; x++) {
        for (let y = 0; y < pb.length; y++) {
          const dx = pa[x].x - pb[y].x
          const dy = pa[x].y - pb[y].y
          if (dx * dx + dy * dy <= reachSq) { touched = true; break }
        }
      }
      if (touched) union(i, j)
    }
  }

  const byRoot = new Map<number, ProcessedStroke[]>()
  for (let i = 0; i < n; i++) {
    const r = find(i)
    const g = byRoot.get(r)
    if (g) g.push(strokes[i])
    else byRoot.set(r, [strokes[i]])
  }
  // Largest cluster first: the merged result reports cluster 0's diagnostics,
  // and the largest mass is the honest representative for the debug overlay.
  return [...byRoot.values()].sort((a, b) => {
    const ca = a.reduce((s, x) => s + x.points.length, 0)
    const cb = b.reduce((s, x) => s + x.points.length, 0)
    return cb - ca
  })
}

/** Merge the geometries of several MaskSolidResults into the first one.
 *  Everything except the two geometries is left as cluster 0's — the debug
 *  overlay's contour/hole numbers describe the largest mass, which is stated
 *  here rather than implied. */
function mergeSolidResults(results: MaskSolidResult[], fallback: MaskSolidResult): MaskSolidResult {
  if (results.length === 0) return fallback
  const head = results[0]
  if (results.length === 1) return head
  const merge = (pick: (r: MaskSolidResult) => THREE.BufferGeometry | null) => {
    const geos = results.map(pick).filter((g): g is THREE.BufferGeometry => g !== null)
    if (geos.length === 0) return null
    if (geos.length === 1) return geos[0]
    // The per-cluster geometries carry the same attribute set (position +
    // normal, indexed), so a plain merge is well-defined.
    try {
      return BufferGeometryUtils.mergeGeometries(geos, false)
    } catch {
      return geos[0]
    }
  }
  // Scene snapshots the final holes from these two lists on Play and matches the
  // partial centroids against them every tick. Head-only lists meant every other
  // cluster's holes were never snapshotted, so they never switched on during
  // play (PLAN.md section 4). Concatenated here, head first.
  const headSd = head.stages.solidDiagnostics
  const stages = headSd
    ? {
        ...head.stages,
        solidDiagnostics: {
          ...headSd,
          stableHolesWorld: results.flatMap((r) => r.stages.solidDiagnostics?.stableHolesWorld ?? []),
          detectedPartialHoleCentroidsWorld: results.flatMap(
            (r) => r.stages.solidDiagnostics?.detectedPartialHoleCentroidsWorld ?? [],
          ),
        },
      }
    : head.stages
  return {
    ...head,
    stages,
    geometry: merge((r) => r.geometry),
    geometryNoHoles: merge((r) => r.geometryNoHoles),
    stats: {
      ...head.stats,
      // Summed across clusters so the overlay's pixel/hole totals describe the
      // whole drawing even though the contour numbers describe cluster 0.
      filledPixelCount: results.reduce((s, r) => s + r.stats.filledPixelCount, 0),
      holeCount: results.reduce((s, r) => s + r.stats.holeCount, 0),
    },
  }
}

/**
 * THE single Solid build entry point. Preview and export both go through it so
 * they cannot drift — preview/export parity is an explicit gate on this
 * project, and a clustering rule applied in only one of them would break it
 * silently (the export would quietly keep dropping every mark but the biggest).
 */
function buildSolidResultForStrokes(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
  worldThickness: number,
  effectiveDepth: number,
  effectiveThicknessPx: number,
  holeStabilization?: import("./solid-mask").SolidHoleStabilization,
  disableHolesForAnimation?: boolean,
): { result: MaskSolidResult; clusterCount: number; clusterStages: MaskSolidResult["stages"][]; holeOwners: number[] } {
  const buildOne = (ts: TestStroke, hs = holeStabilization) =>
    buildMaskSolid(
      ts,
      worldThickness,
      effectiveDepth,
      canvasWidth,
      canvasHeight,
      hs,
      disableHolesForAnimation,
    )

  // SEPARATE MARKS ARE SEPARATE MASSES — see clusterStrokesByInkOverlap.
  // One cluster (a single mark, or strokes that all touch) takes exactly the
  // path it did before, with the same single pooled TestStroke.
  const clusters = clusterStrokesByInkOverlap(strokes, effectiveThicknessPx)
  // EACH CLUSTER GETS ONLY ITS OWN OVERRIDE HOLES. The override used to go to
  // every cluster whole, so a cluster extruded inner walls for holes that sit
  // inside ANOTHER cluster (measured: "Desk" given Doodles' 2 holes, 2688
  // vertices and holesUsed 2, against 2224 and 0 on its own). The pooled path
  // is filtered the same way against one box of all the strokes: early in a
  // reveal the pen may have drawn only one of the word's clusters.
  const pooled = clusters.length <= 1 || clusters.length > SOLID_MAX_CLUSTERS
  const groups = pooled ? [strokes] : clusters
  const holeOwners = holeStabilization
    ? ownerClusterOfEachHole(holeStabilization.activeFinalHolesWorld, groups, canvasWidth, canvasHeight, effectiveThicknessPx)
    : []
  const ownHoles = (gi: number) =>
    holeStabilization && {
      ...holeStabilization,
      activeFinalHolesWorld: holeStabilization.activeFinalHolesWorld.filter((_, hi) => holeOwners[hi] === gi),
    }
  /* F118 TRAVEL-6, A CLUSTER THE RASTER SPLIT IS BUILT AS ITS PARTS. The cluster
   * test calls two marks one mass when any two of their points sit within one line
   * width, but buildMaskSolid keeps only the LARGEST mask component. Near that
   * distance the 384 px animation raster already has the two apart, so one whole
   * piece was dropped until the points moved past the pad (measured on the hero
   * word, seamless Travel 25%: p 0.522 to 0.529, cluster 0 fell from 1708 to 856 px,
   * then split into 825 + 785 at p 0.531). When a group that holds a reveal-cut
   * piece comes back with more than one component, it is re-clustered at half the
   * pad and each part is built on its own. Groups with no cut piece (every static
   * drawing and every export) take the path they took before. */
  const hasCutPiece = (g: ProcessedStroke[]) => g.some((s) => (s as ClippedPiece).clipArc !== undefined)
  const buildGroup = (
    g: ProcessedStroke[],
    hs: import("./solid-mask").SolidHoleStabilization | undefined,
    pad: number,
    depth: number,
  ): MaskSolidResult[] => {
    const r = buildOne(strokesToTestStroke(g, canvasWidth, canvasHeight), hs)
    if (depth >= 3 || g.length < 2 || r.stats.componentCount <= 1 || !hasCutPiece(g)) return [r]
    const subs = clusterStrokesByInkOverlap(g, pad / 2)
    if (subs.length < 2) return buildGroup(g, hs, pad / 2, depth + 1)
    const subOwners = hs ? ownerClusterOfEachHole(hs.activeFinalHolesWorld, subs, canvasWidth, canvasHeight, effectiveThicknessPx) : []
    return subs.flatMap((sg, si) =>
      buildGroup(sg, hs && { ...hs, activeFinalHolesWorld: hs.activeFinalHolesWorld.filter((_, hi) => subOwners[hi] === si) }, pad / 2, depth + 1),
    )
  }
  if (pooled) {
    const result = buildOne(strokesToTestStroke(strokes, canvasWidth, canvasHeight), ownHoles(0))
    if (clusters.length === 1 && result.stats.componentCount > 1 && hasCutPiece(strokes)) {
      const parts = buildGroup(strokes, ownHoles(0) || undefined, effectiveThicknessPx, 0)
      const partsBuilt = parts.filter((r) => r.geometry !== null || r.geometryNoHoles !== null)
      return { result: mergeSolidResults(partsBuilt, parts[0]), clusterCount: parts.length, clusterStages: parts.map((r) => r.stages), holeOwners }
    }
    return { result, clusterCount: Math.max(1, clusters.length), clusterStages: [result.stages], holeOwners }
  }
  const perCluster = clusters.flatMap((c, ci) => buildGroup(c, ownHoles(ci) || undefined, effectiveThicknessPx, 0))
  const built = perCluster.filter((r) => r.geometry !== null || r.geometryNoHoles !== null)
  // If every cluster failed, keep a real (failed) result rather than
  // synthesising one, so the existing failure diagnostics still read true.
  return {
    result: mergeSolidResults(built, perCluster[0]),
    clusterCount: clusters.length,
    clusterStages: perCluster.map((r) => r.stages),
    holeOwners,
  }
}

/**
 * Which cluster each override hole belongs to: the cluster whose ink box
 * (stroke points padded by half the line, canvas px) holds the hole's centroid.
 * When several do (a mark drawn inside another's counter), the smallest box
 * wins. -1 when none does; that hole goes to no cluster and shows as -1 in
 * SOLID_DEBUG.holeOverrideClusterOwners.
 *
 * Why the ink box and not the partial outline: solid-mask.ts's override block
 * records that a "centroid inside the partial outer" test made active holes
 * pop in and out as the partial silhouette wobbled, and it was taken out. A
 * cluster's ink box only grows during a reveal, and a hole is only active once
 * the partial ink encloses it, so the owner does not flip frame to frame.
 */
function ownerClusterOfEachHole(
  holesWorld: { x: number; y: number }[][],
  clusters: ProcessedStroke[][],
  canvasWidth: number,
  canvasHeight: number,
  thicknessPx: number,
): number[] {
  const scale = 3.0 / Math.max(canvasWidth, canvasHeight)
  const pad = thicknessPx / 2
  const boxes = clusters.map((c) => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const s of c) for (const p of s.points) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
    return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad, area: (maxX - minX + 2 * pad) * (maxY - minY + 2 * pad) }
  })
  return holesWorld.map((hole) => {
    if (hole.length === 0) return -1
    let sx = 0, sy = 0
    for (const p of hole) { sx += p.x; sy += p.y }
    // world -> canvas px, the inverse of strokesToTestStroke
    const cx = (sx / hole.length) / scale + canvasWidth / 2
    const cy = -(sy / hole.length) / scale + canvasHeight / 2
    let owner = -1
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]
      if (cx < b.minX || cx > b.maxX || cy < b.minY || cy > b.maxY) continue
      if (owner < 0 || b.area < boxes[owner].area) owner = i
    }
    return owner
  })
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
    
    // CRITICAL: Convert thickness from canvas pixels to world units.
    // Same scale factor as coordinate conversion: 3.0 / max(canvasWidth, canvasHeight).
    //
    // CALIBRATION: The slider value is RAW. We pass it through
    // `computeSolidEffectiveThicknessPx` first so that the breaking
    // territory of H3 lands in the upper end of the slider, not the middle.
    // The depth slider goes through `computeSolidEffectiveDepth` for the
    // same reason. Both mappings are pure functions, so preview/export
    // parity is exact (see `buildExport` below for the matching path).
    const coordScale = 3.0 / Math.max(canvasWidth, canvasHeight)
    const effectiveThicknessPx = computeSolidEffectiveThicknessPx(solidParams.thickness)
    const effectiveDepth = computeSolidEffectiveDepth(solidParams.depth)
    const worldThickness = effectiveThicknessPx * coordScale
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
    
    // Animation-only hole stabilization override.
    // - Undefined for static builds and for ALL export calls (export site
    //   below never reads params.holeStabilization).
    // - Provided by Scene only while reveal-animating, with the active final
    //   hole world contours and a per-frame activation decision already
    //   applied (hysteresis is owned by Scene).
    const built = buildSolidResultForStrokes(
      strokes,
      canvasWidth,
      canvasHeight,
      worldThickness,
      effectiveDepth,
      effectiveThicknessPx,
      // During reveal we explicitly suppress holes (see disableHolesForAnimation
      // below), so the stabilization override would be moot. Pass it only when
      // holes ARE allowed this frame, which preserves the previous behavior
      // for any future caller that still uses it (export never sets either).
      params.disableHolesForAnimation ? undefined : params.holeStabilization,
      params.disableHolesForAnimation,
    )
    const result = built.result
    SOLID_DEBUG.clusterCount = built.clusterCount
    SOLID_DEBUG.lastClusterStages = built.clusterStages
    SOLID_DEBUG.holeOverrideClusterOwners = built.holeOwners

    // ---- Stamp calibration diagnostics onto the panel-facing record ----
    // The engine itself receives only effective values; the slider values
    // belong to the UI layer. We surface BOTH so the debug panel can prove
    // calibration is actually being applied (rather than identity).
    const depthToThicknessRatio =
      effectiveThicknessPx > 0
        ? effectiveDepth / (effectiveThicknessPx * coordScale)
        : 0
    if (result.stages?.solidDiagnostics) {
      result.stages.solidDiagnostics.solidThicknessSliderValue = solidParams.thickness
      result.stages.solidDiagnostics.solidEffectiveThicknessPx = effectiveThicknessPx
      result.stages.solidDiagnostics.solidDepthSliderValue = solidParams.depth
      result.stages.solidDiagnostics.solidDepthEffective = effectiveDepth
      result.stages.solidDiagnostics.solidDepthToThicknessRatio = depthToThicknessRatio
    }
    if (result.diagnostics) {
      result.diagnostics.solidThicknessSliderValue = solidParams.thickness
      result.diagnostics.solidEffectiveThicknessPx = effectiveThicknessPx
      result.diagnostics.solidDepthSliderValue = solidParams.depth
      result.diagnostics.solidDepthEffective = effectiveDepth
      result.diagnostics.solidDepthToThicknessRatio = depthToThicknessRatio
    }

    SOLID_DEBUG.filledPixels = result.stats.filledPixelCount
    SOLID_DEBUG.maskArea = result.stats.maskResolution * result.stats.maskResolution
    SOLID_DEBUG.filledPercent = SOLID_DEBUG.maskArea > 0 ? (SOLID_DEBUG.filledPixels / SOLID_DEBUG.maskArea) * 100 : 0
    
    // Populate comprehensive contour diagnostics
    SOLID_DEBUG.rawContourPoints = result.stats.outerContourPoints
    SOLID_DEBUG.simplifiedContourPoints = result.stats.simplifiedOuterPoints
    SOLID_DEBUG.outerSignedArea = result.diagnostics.outerSignedArea
    SOLID_DEBUG.outerWinding = result.diagnostics.outerWinding
    /* ⚠ FIVE DIAGNOSTIC ROWS THAT READ GREEN BECAUSE THEY READ `undefined`.
     * FOUND 2026-08-02, NOT FIXED — see the note below and the lane return.
     *
     * `outerSelfIntersects`, `holeWindings`, `anyHoleSelfIntersects`,
     * `anyHoleOutsideOuter` and `holesOverlap` are NOT fields of
     * `MaskSolidDiagnostics` — `buildMaskSolid` has never computed any of them.
     * These five assignments therefore write `undefined` into `SOLID_DEBUG`,
     * and the Solid diagnostics panel in `components/viewport-3d.tsx` renders
     * each as
     * `d.x ? "YES - BAD" : "NO"` in green. The panel has been reporting
     * "outer self-intersects: NO" on every build ever made, from a value nobody
     * has ever measured. It is the same disease as `h3BevelAchievedFrac`
     * reporting 141% — a diagnostic that cannot say anything but the good news.
     *
     * WHY IT IS LEFT STANDING RATHER THAN SILENCED. These five lines are the
     * FIVE REMAINING `tsc` ERRORS in this file, which is the only signal the
     * defect currently emits; deleting the assignments or widening the type to
     * `any` would make it silent without making it true. The honest repair is
     * either (a) compute the five predicates in `lib/solid-mask.ts` — they are
     * O(n²) segment tests on a contour that reaches ~1500 points and this runs
     * on the per-frame reveal rebuild path, so the cost has to be MEASURED
     * first, not assumed — or (b) make the panel print "NOT MEASURED", which
     * lives in `components/viewport-3d.tsx`, a file this lane does not own.
     * Flagged with evidence rather than half-done. */
    SOLID_DEBUG.outerSelfIntersects = result.diagnostics.outerSelfIntersects
    SOLID_DEBUG.holeCount = result.stats.holeCount
    SOLID_DEBUG.holeAreas = result.diagnostics.holeAreas
    SOLID_DEBUG.holeWindings = result.diagnostics.holeWindings
    SOLID_DEBUG.anyHoleSelfIntersects = result.diagnostics.anyHoleSelfIntersects
    SOLID_DEBUG.anyHoleOutsideOuter = result.diagnostics.anyHoleOutsideOuter
    SOLID_DEBUG.holesOverlap = result.diagnostics.holesOverlap
    SOLID_DEBUG.stageDVertexCount = result.geometryNoHoles?.getAttribute("position")?.count ?? 0
    SOLID_DEBUG.stageEVertexCount = result.geometry?.getAttribute("position")?.count ?? 0
    
    // TARGETED DEBUG: Stage D vs E comparison (static builds only — animated
    // reveal builds run per rAF tick and must not pay for console logging)
    const isAnimatedBuild =
      params.holeStabilization !== undefined || params.disableHolesForAnimation === true
    if (!isAnimatedBuild && SOLID_DEBUG.stageDVertexCount > 0 && SOLID_DEBUG.stageEVertexCount > 0) {
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

    const exportMaterial = createExportMaterial(params)
    const disposables: THREE.BufferGeometry[] = []

    // Convert strokes to sandbox format (canvas pixels -> world coords) and call sandbox pipeline.
    const testStroke = strokesToTestStroke(strokes, canvasWidth, canvasHeight)
    // Apply the SAME calibration mapping as buildPreview so export and preview
    // produce identical geometry. No raw slider value reaches the engine.
    const coordScale = 3.0 / Math.max(canvasWidth, canvasHeight)
    const effectiveThicknessPx = computeSolidEffectiveThicknessPx(solidParams.thickness)
    const effectiveDepth = computeSolidEffectiveDepth(solidParams.depth)
    const worldThickness = effectiveThicknessPx * coordScale
    const result = buildSolidResultForStrokes(
      strokes,
      canvasWidth,
      canvasHeight,
      worldThickness,
      effectiveDepth,
      effectiveThicknessPx,
    ).result
    const geometry = result.geometry

    const rootGroup = new THREE.Group()
    rootGroup.name = "FreeStroke"
    rootGroup.userData = {
      app: "Free Stroke",
      mode: "solid",
      exportedAt: new Date().toISOString(),
      strokeCount: params.strokeCount,
      totalPoints: params.totalPoints,
      ...exportMaterialMeta(params),
      settings: {
        ...params.settings,
        solidThickness: solidParams.thickness,         // raw slider value
        solidDepth: solidParams.depth,                 // raw slider value
        solidEffectiveThicknessPx: effectiveThicknessPx, // calibrated value used in geometry
        solidEffectiveDepth: effectiveDepth,             // calibrated value used in geometry
      },
    }

    if (geometry) {
      // Recenter at origin
      geometry.computeBoundingBox()
      const center = new THREE.Vector3()
      geometry.boundingBox?.getCenter(center)
      geometry.translate(-center.x, -center.y, -center.z)

      const mesh = new THREE.Mesh(geometry, exportMaterial)
      mesh.name = "solid_000"
      rootGroup.add(mesh)
      disposables.push(geometry)
    }

    exportMaterial.dispose()

    return {
      group: rootGroup,
      disposables,
      objectCount: geometry ? 1 : 0,
      merged: true,
    }
  },
}

/* ------------------------------------------------------------------ */
/*  InflateEngine — Phase 1: BEVEL_EXTRUDE strategy                   */
/* ------------------------------------------------------------------ */
/*
 * INFLATE PHASE 1 — preview-only
 *
 * Strategy name: `BEVEL_EXTRUDE`
 * Branches from: Solid (reuses `buildMaskSolid` for the validated outer
 *                silhouette + hole contours)
 *
 * What it does:
 *   1. Calls `buildMaskSolid` exactly the way Solid does (same calibration,
 *      same coord transforms, same hole detection). We DISCARD its returned
 *      H3 geometry — we only consume `stages.simplifiedOuter` and
 *      `stages.simplifiedHoles` (mask-space Point2D arrays).
 *   2. Re-runs the same mask-to-world transform locally to get THREE.Vector2
 *      contours.
 *   3. Builds a fresh `THREE.Shape` (outer + holes) and extrudes it with
 *      `THREE.ExtrudeGeometry`, with HIGH bevel parameters relative to the
 *      depth so the result reads as rounded/puffy rather than slab-like.
 *
 * Why this strategy:
 *   - Visibly distinct from Solid (rounded/puffy edge profile vs hard-edged
 *     extrusion) without any SDF/voxel/marching-cubes infrastructure.
 *   - Hole preservation is FREE — `Shape.holes` is the native ExtrudeGeometry
 *     mechanism for cutting interior contours, and we already have hole
 *     world-contours from the Solid pipeline.
 *   - Zero new heavy code: ExtrudeGeometry ships in three.js.
 *   - No risk of regressing Rod/Extrude/Solid because we only READ from
 *     `buildMaskSolid` (same call shape Solid uses), we never mutate the
 *     Solid result, and we never write into Solid's debug state.
 *
 * Phase 1 known limitations (do NOT block on these):
 *   - Bevel forms a rounded EDGE, not a true distance-field dome. The center
 *     of large filled regions reads as a flat plateau with rounded shoulders
 *     rather than a fully continuous dome. This is fine for proving visual
 *     direction.
 *   - Self-intersecting outer contours can occasionally produce slightly
 *     malformed bevels at very thin pinch points. We catch that with a
 *     try/catch and fall back to a flat extrude with smaller bevel.
 *   - Export is a placeholder — Phase 1 is preview-only.
 */

/** Inflate-mode debug state. Read by the panel when Debug is ON. */
export const INFLATE_DEBUG = {
  inflateMode: "STROKE_VOLUME_FIELD_INFLATE" as
    | "STROKE_VOLUME_FIELD_INFLATE"
    | "ELLIPTICAL_TUBE_LOFT"
    | "SOLID_H3_PASSTHROUGH",
  inflateStrategy:
    "Build inflated stroke volume from the resampled centerline. Width = XY radius around centerline. Puff = Z aspect / cross-section roundness. Surface is an elliptical capsule swept along the path with smooth metaball-style end caps.",
  // ---- Source-of-truth flags ----
  spikeStrategyActive: "ELLIPTICAL_TUBE_LOFT_SPIKE" as
    | "STROKE_VOLUME_FIELD_SPIKE"
    | "ELLIPTICAL_TUBE_LOFT_SPIKE"
    | "RASTER_DISTANCE_FIELD_DOME"
    | "SOLID_H3_PASSTHROUGH",
  usesStrokeCenterline: "YES" as "YES" | "NO",
  usesRasterHeightfield: "NO" as "YES" | "NO",
  medialAxisSeamExpected: "NO" as "YES" | "NO",
  widthAffectsXY: "YES" as "YES" | "NO",
  puffAffectsZCrossSection: "YES" as "YES" | "NO",
  fallbackUsed: "NO" as "YES" | "NO",
  cameraFitUsesXYOnly: "YES" as "YES" | "NO",
  // ---- Path probes ----
  inflateEngineCalled: "NO" as "YES" | "NO",
  inflateBuildPreviewCalled: "NO" as "YES" | "NO",
  inflateGeometryCreated: "NO" as "YES" | "NO",
  // ---- Decoupled named values ----
  widthSliderValue: 0,
  inflateStrokeRadiusXY: 0,
  puffSliderValue: 0,
  inflatePuffAspectZ: 0,
  inflateRadiusZ: 0,
  inflatePressure: 0,
  crossSectionBulge: 0,
  profileExponent: 0,
  ringSampleCount: 0,
  capRoundness: 0,
  joinSoftness: 0,
  tangentSmoothing: 0,
  materialRoughness: 0,
  materialMetalness: 0,
  fieldResolution: 0,
  smoothUnionStrength: 0,
  /* ---- The nib (see `THE BROAD NIB`) ------------------------------------
   * REQUESTED and PRODUCED are separate rows on purpose. `nibAspect` is the
   * dial; `nibContrastBuilt` is `max/min` half-width over this drawing's own
   * arc-length-weighted direction census, so a nib that was asked for and did
   * not reach the geometry reads as 1.000 here instead of as its dial. */
  nibAspect: 0,
  nibAngleDeg: 0,
  nibWeight: 0,
  /** Semi-axes in units of the round pen's radius: `a` thick, `b` hairline. */
  nibSemiMajor: 0,
  nibSemiMinor: 0,
  /** max/min half-width this WORD received. 1.000 = still a monoline. */
  nibContrastBuilt: 0,
  /** Mean half-width in radii — 1.000 means the word kept its ink weight. */
  nibMeanWidth: 0,
  /** Share of pen travel below 30 % of maximum width. §1.4's hairline census. */
  nibHairlineFrac: 0,
  // ---- Stroke / mesh diagnostics ----
  sampleCount: 0,
  strokeSampleCount: 0,
  fieldSampleCount: 0,
  gridCellCount: 0,
  meshVertexCount: 0,
  meshTriangleCount: 0,
  // ---- Bbox ----
  bboxX: 0,
  bboxY: 0,
  bboxZ: 0,
  // ---- Counters ----
  inputStrokeCount: 0,
  inputPointCount: 0,
  failureReason: "",
  // ---- IMPLICIT FUSION (signed-distance field + marching cubes) ----
  /** Which surface strategy the last build ACTUALLY used. */
  fusionUsed: "loft" as InflateFusion,
  /** What the user asked for. "auto" always differs from fusionUsed. */
  fusionRequested: "auto" as InflateFusion,
  /**
   * THE EMBEDDING TEST — max over every stroke of
   * (rᵢ+rᵢ₊₁)·sin(Δθ/2) − h, world units. ≤0 on every ring pair means the swept
   * tube is an embedded surface; >0 means it provably passes through itself and
   * "auto" routes that drawing to the implicit field. See
   * `inflateChainFoldMetric`.
   */
  loftFoldDepth: 0,
  /** The same depth divided by the local tube radius — how VISIBLE the fold is. */
  loftFoldOverR: 0,
  /** Ring pairs that fold, summed over all strokes. 0 = the loft is valid. */
  loftFoldingPairs: 0,
  /** Which stroke owns the worst fold, or -1. */
  loftFoldStroke: -1,
  /** Smooth-min blend radius as a fraction of the stroke radius (the dial). */
  blendFraction: 0,
  /** Smooth-min blend radius k in field-space world units. */
  blendRadiusK: 0,
  /** Marching-cubes cells per stroke radius (the dial). */
  resolutionDial: 0,
  /** Marching-cubes cell size actually used (field-space units). */
  fieldCellSize: 0,
  fieldGridX: 0,
  fieldGridY: 0,
  fieldGridZ: 0,
  /** Cells visited by marching cubes (vs gridCellCount = all cells). */
  fieldActiveCells: 0,
  /** Capsule SDF evaluations — the real cost driver. */
  fieldSdfEvals: 0,
  /** Mean primitives folded per field query. */
  fieldMeanCandidates: 0,
  /** Mean RUNS folded per field query. 1 = nothing blended anywhere. */
  fieldMeanRuns: 0,
  /** Capsule primitives in the field. */
  fieldPrimitiveCount: 0,
  /**
   * Field-space capsule radius on a STRAIGHT stretch of stroke (base radius ×
   * the profile bulge, curvature swell zero). This is the `r` in the armpit
   * prediction ρ = √2·(r + k/6) that assert-inflate-fusion.mjs checks the
   * fillet against, so it is published rather than re-derived in the script.
   */
  fieldBaseRadius: 0,
  /** Mesh edges used by exactly ONE triangle. 0 = closed surface, no cracks. */
  meshBoundaryEdges: 0,
  /** Mesh edges used by THREE OR MORE triangles. 0 = manifold. */
  meshNonManifoldEdges: 0,
  /** True when the cell budget forced a coarser grid than requested. */
  fieldCoarsened: "NO" as "YES" | "NO",
  // ---- Measured cost (ms) ----
  msFieldGrid: 0,
  msMarchingCubes: 0,
  msNormals: 0,
  /** ms — reveal keying + triangle sort (the draw-in's whole per-frame cost,
   *  paid ONCE at build time instead of 24-531ms on every animation tick). */
  msFieldReveal: 0,
  /** Triangles in the reveal table. 0 = this mesh has no drawRange reveal. */
  revealTriangleCount: 0,
  msImplicitTotal: 0,
  /** Whole-build wall clock, whichever strategy ran. Comparable loft↔implicit. */
  msBuildTotal: 0,
  // ---- Off-thread build (lib/implicit-surface.ts §7) ----
  /**
   * "YES" when the LAST preview call handed its build to a worker and returned
   * the surface already on screen. A probe reads this instead of inferring
   * "it felt fast, so presumably it deferred" — the two are not the same claim.
   */
  implicitDeferred: "NO" as "YES" | "NO",
  /** Deferred builds written back into the live geometry so far. */
  implicitDeferApplied: 0,
  /** ms the WORKER spent on the last off-thread build. */
  msImplicitWorker: 0,
  /**
   * PER-VERTEX ATTRIBUTES DROPPED BY THE LAST IN-PLACE REFILL — see
   * `IMPLICIT_REFILL_DROPS_STALE_ATTRS`. Names, comma-joined, or "" for none.
   * Published because the defect it closes was invisible for exactly as long as
   * nothing printed it.
   */
  staleAttrsDropped: "",
  /** How many refills have dropped at least one attribute, this session. */
  staleAttrDrops: 0,
}

/**
 * A REFILLED GEOMETRY MAY NOT KEEP A PER-VERTEX ATTRIBUTE FROM THE BUILD BEFORE
 * IT. This is the fix for the FONT WORD'S BLANK TAIL, and the defect is worth
 * stating in full because two of its three symptoms are silent.
 *
 * ── WHAT HAPPENS ──────────────────────────────────────────────────────────
 * `lib/implicit-defer.ts` `adoptBuffers` writes a finished worker build into
 * the LIVE `BufferGeometry` — `position`, `normal` and the INDEX are replaced
 * in place, because that is the entire mechanism by which a rebuild reaches the
 * screen without React being told (React cannot see a `Float32Array` swap, so
 * the mark holds its last good surface and then changes).
 *
 * `components/viewport-3d.tsx` writes a THIRD per-vertex attribute onto that
 * same object: `aFsLetter`, the letter index the cascade rotates by, stamped in
 * an effect keyed on `[meshes, strokes, letterMap, canvasWidth, canvasHeight]`.
 * An in-place refill moves none of those five, so the effect does not re-fire —
 * and the attribute survives, describing a surface that no longer exists,
 * addressed by an index buffer built for a different one.
 *
 * ── THE THREE OUTCOMES, AND ONLY ONE OF THEM LOOKS LIKE A BUG ─────────────
 *   · new vertex count  <  the stale attribute → renders, letters WRONG (silent)
 *   · new vertex count  =  the stale attribute → renders, letters WRONG (silent)
 *   · new vertex count  >  the stale attribute → **WebGL validates a draw
 *     against EVERY enabled attribute**, so the first `setDrawRange` that
 *     reaches an index past its end is `INVALID_OPERATION` and the driver drops
 *     the WHOLE draw call. Not the triangle — the call. The entire mark
 *     disappears, at full opacity, with valid indices, in the right place.
 *
 * Measured on the real page, engine FREE STROKE, word FONT, wobble 0, endpoint
 * CLEAN: `position` 59 936 · `normal` 59 936 · `aFsLetter` **58 998**, mark gone
 * from DRAW 93.75 % to the end of the beat, and Chrome saying so 181 times —
 * `GL_INVALID_OPERATION: glDrawElements: Vertex buffer is not big enough for
 * the draw call`, at WARNING level, which is why every console-error check in
 * the battery read zero. `docs/explainers/24-the-attribute-that-outlived-its-surface.md`.
 *
 * ── WHY IT IS FIXED HERE ──────────────────────────────────────────────────
 * `onSettled` below already exists to patch what the in-place refill
 * invalidates and React cannot see — its own comment says so, about
 * `revealKeys`. The letter attribute is the second such thing and nobody added
 * it. Dropping is the right verb rather than resizing: a fresh marching-cubes
 * run produces a completely different vertex ordering, so a stale attribute is
 * not merely the wrong LENGTH, it is the wrong VALUE at every index. The
 * viewport re-stamps it from the new surface on the next frame
 * (`ensureLetterStamp`), which is the only place that knows how.
 *
 * PARKED PRIOR — `false` restores the behaviour that shipped, verbatim, and is
 * the negative control `scripts/verify/assert-drawin-attrs.mjs` requires to
 * FAIL. §0.7: a replaced behaviour becomes a dial, never a deletion.
 */
export const IMPLICIT_REFILL_DROPS_STALE_ATTRS = true
let liveRefillDropsStale = IMPLICIT_REFILL_DROPS_STALE_ATTRS
export function setRefillDropsStaleAttrs(on: boolean): boolean {
  if (process.env.NODE_ENV === "production") return false
  liveRefillDropsStale = !!on
  return true
}
export function readRefillDropsStaleAttrs(): boolean {
  return process.env.NODE_ENV === "production"
    ? IMPLICIT_REFILL_DROPS_STALE_ATTRS
    : liveRefillDropsStale
}

/**
 * The attributes an implicit build WRITES. Anything else on a refilled geometry
 * came from a previous surface. Kept beside the switch so the two cannot drift.
 */
const IMPLICIT_OWN_ATTRS = ["position", "normal"]

/**
 * Drop every per-vertex attribute the refill did not write, and say which.
 *
 * Exported so a probe and the gate can call it on a synthetic geometry — the
 * claim "a stale attribute cannot survive a refill" is then testable without a
 * browser, a worker, or a 600 ms marching-cubes run.
 */
export function dropStaleImplicitAttrs(geo: THREE.BufferGeometry): string[] {
  const dropped: string[] = []
  for (const name of Object.keys(geo.attributes)) {
    if (IMPLICIT_OWN_ATTRS.includes(name)) continue
    dropped.push(name)
  }
  if (!readRefillDropsStaleAttrs()) return []
  for (const name of dropped) geo.deleteAttribute(name)
  return dropped
}

/**
 * Resample a polyline by arc length so consecutive samples are at most
 * `maxSpacing` apart. Returns world-space samples (already coord-scaled).
 * Output preserves endpoints exactly.
 */
function inflateResampleCenterline(
  worldPoints: { x: number; y: number }[],
  maxSpacing: number,
): { x: number; y: number }[] {
  if (worldPoints.length < 2) return worldPoints.slice()
  const out: { x: number; y: number }[] = [worldPoints[0]]
  for (let i = 1; i < worldPoints.length; i++) {
    const a = out[out.length - 1]
    const b = worldPoints[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const segLen = Math.hypot(dx, dy)
    if (segLen <= maxSpacing) {
      out.push(b)
      continue
    }
    const steps = Math.ceil(segLen / maxSpacing)
    for (let s = 1; s <= steps; s++) {
      const t = s / steps
      out.push({ x: a.x + dx * t, y: a.y + dy * t })
    }
  }
  return out
}

/* ============================================================
 * INK WIDTH PROFILE — PORTED FROM DESK DOODLES
 *
 * PROVENANCE: ~/Desktop/Projects/desk-doodles
 *   src/app/lib/geometry3d/strokeTo3d.ts
 *     · INFLATE_TIP_RADIUS / INFLATE_BASE_RADIUS  (~line 206)
 *     · INFLATE_PROFILE_EXP, INFLATE_PRESSURE_INFLUENCE
 *     · synthPressures()                          (~line 987)
 *     · the flat-channel guard + per-ring radius   (buildInflateGeometry
 *       ~line 1047 and ~1126)
 * Their SESSION-HANDOFF R-block "Pressure slider FIXED + VERIFIED 2026-06-15"
 * is the record of the bug this solves.
 *
 * WHY OURS READ AS PIPE. Free Stroke's Inflate swept ONE radius down the whole
 * stroke and stamped a hemisphere on each end. Desk Doodles' Inflate does not:
 * its radius is a SINE-EASED CAPSULE PROFILE along arc length —
 *
 *     r(u) = tip + (base − tip) · sin(πu)^exp        exp = 0.8
 *
 * — so every mark is pointed at both ends and fullest in the middle. exp < 1
 * gives fuller shoulders (their comment: "capsule read, not football"). Their
 * tip is 0.035 against a 0.22 base, i.e. 16% — a real point, not a ball. That
 * single curve is the biggest reason their output reads as ink and ours read as
 * extruded pipe, and it also removes the ball-cap: the end cap protrudes by the
 * LOCAL radius, and the local radius at the end is now the tip.
 *
 * WHAT PORTS VERBATIM vs WHAT IS CONVERTED. Desk Doodles maps 800 viewBox px to
 * 8 world units; Free Stroke maps the canvas's longest side to 3. So — using
 * their own porting rule, stated at `strokeTo3d.ts:113` (`WORLD_SCALE`, "viewBox
 * px -> world units. 800px-wide canvas -> 8 world units") — absolute world lengths
 * would need scaling but RADIUS-RELATIVE factors port verbatim. Everything used
 * here is radius-relative (tip/base ratio, profile exponent, pressure influence,
 * the 0.02 flatness threshold, the 0.25 modulation floor), so it ports as-is.
 * Our base radius keeps coming from the Thickness dial.
 *
 * THE FLAT-PRESSURE TRAP (their root cause, ours too). A pointer that is not a
 * stylus still reports a pressure: PointerEvent.pressure is 0.5 for a pressed
 * mouse button, and the SVG/font trace path bakes its own constant in. Both are
 * `!== undefined`, so the obvious guard —
 *
 *     const p = point.pressure ?? synthesise()
 *
 * — is silently defeated: every point has a pressure, every pressure is the
 * same, `(p − 0.5) = 0`, and the synthesiser never runs. Their fix, ported: the
 * test is not "is pressure present" but "does pressure VARY by more than 0.02".
 * A flat channel is treated as NO channel and falls back to synthPressures.
 *
 * synthPressures maps the turn angle at each centerline point to 0.5 (neutral
 * on straight runs) … 1.0 (fuller at bends), 3-tap smoothed and normalised by
 * the stroke's own maximum turn. Straights stay uniform — it never invents a
 * bulge on a line.
 *
 * WHAT WE CHANGED TO MAKE IT RUN HERE:
 *   • Their profile is evaluated per RING on a Catmull-Rom `getPointAt(u)`
 *     (arc-length uniform by construction). Ours is evaluated per SAMPLE of an
 *     already arc-length-resampled polyline, so u is cumulative arc length over
 *     total — the same parameter, computed from what we already have.
 *   • It is returned as a MULTIPLIER on the engine's calibrated radius rather
 *     than an absolute radius, so the Thickness and Puff dials keep working and
 *     the same profile can feed both the loft and the implicit field.
 *   • Their curvature is a 3-D turn angle; ours is planar (every stroke is on
 *     z = 0), which is the same computation with z ≡ 0.
 *   • THE TAPER ZONE IS BOUNDED IN ARC LENGTH. This is the one real deviation,
 *     and it is forced by a difference in what a "stroke" IS in the two apps.
 *     Desk Doodles' strokes are whole doodle contours — long relative to the
 *     nib — so sin(πu) over the ENTIRE stroke reads as a pen mark. Ours are
 *     often letter FRAGMENTS: the arms of a `k`, the crossbar of a `t`. Run
 *     over a fragment four radii long, the same curve produces a cone from full
 *     width down to a needle at both ends — a thorn. Captured and confirmed:
 *     the first port turned the `k` of "Desk" into an asterisk of spikes
 *     (docs/verification/deskdoodles-ink/, macro tiles).
 *     So the taper runs over a fixed END ZONE of ~2 diameters instead of the
 *     whole stroke: the SAME sine ease into the SAME tip, just bounded. A long
 *     stroke now keeps a full-width body and tapers only at its ends (which is
 *     what a nib does — the taper zone is a property of the pen, not of how
 *     long you drew for). A short stroke keeps its body instead of becoming a
 *     spindle. The zone is additionally capped at 45% of the stroke so the two
 *     ends can never meet and erase the mark.
 *   • NOT ported: their `INFLATE_MAX_BASE_TO_LENGTH` short-stroke clamp — our
 *     radius is a user dial rather than a fixed constant, and clamping it would
 *     silently override Thickness on short marks. The bounded taper zone above
 *     solves the same short-stroke problem without touching the dial.
 * ============================================================ */

/* ⚠ THESE THREE ARE EXPORTED BECAUSE A GATE GUARDS THEM AND COULD NOT READ THEM.
 *
 * `scripts/verify/assert-taper-envelope.mjs` is the gate for the ink taper. As
 * module-private `const`s these were invisible to `_ts-load.mjs`, so the gate
 * kept its OWN copies — and nothing compared the two. Setting
 * `INFLATE_PROFILE_EXP` to 1.2 here left every row of that gate green, because
 * ENV-3 computed from its private 0.8 and ENV-1/ENV-2 are loft-vs-implicit
 * ratios in which both arms move together. That is `PEN_CARVE_ENVELOPE_R`
 * exactly: a guarded constant with a second copy in its own guard.
 *
 * The gate then worked around it by TEXT-PARSING this file for
 * `^const NAME = <arithmetic>` — which works until someone reformats the
 * declaration, and which channel D of the meta-gate cannot mutate. Exporting
 * them is the actual fix; the gate imports them now and the workaround is gone.
 *
 * Exporting changes nothing at runtime: no consumer outside this module reads
 * them, and they stay `const`. */

/** Tip radius as a fraction of the base. Their 0.035 / 0.22. */
export const INFLATE_TIP_FRACTION = 0.035 / 0.22
/** sin(πt)^exp profile exponent. Their INFLATE_PROFILE_EXP. */
export const INFLATE_PROFILE_EXP = 0.8
/** How strongly pressure (0..1, neutral 0.5) scales the local radius. */
const INFLATE_PRESSURE_INFLUENCE = 0.35
/** A pressure channel flatter than this is not a pressure channel. */
const INFLATE_PRESSURE_FLAT_EPS = 0.02
/**
 * Length of the end taper, in stroke DIAMETERS. The taper zone belongs to the
 * pen, not to how long the stroke is — see the header on why this is bounded.
 */
export const INFLATE_TAPER_SPAN_DIAMETERS = 0.7

/**
 * PORT of Desk Doodles `synthPressures` (strokeTo3d.ts:987).
 *
 * Turn angle at each centerline point → 0.5 (neutral on straight runs) … 1.0
 * (fuller at bends), 3-tap smoothed, normalised by the stroke's own maximum.
 */
function inflateSynthPressures(pts: { x: number; y: number }[]): Float32Array {
  const n = pts.length
  const out = new Float32Array(Math.max(n, 1))
  if (n < 3) {
    out.fill(0.5)
    return out
  }
  const curv = new Float32Array(n)
  for (let i = 1; i < n - 1; i++) {
    const ax = pts[i].x - pts[i - 1].x
    const ay = pts[i].y - pts[i - 1].y
    const bx = pts[i + 1].x - pts[i].x
    const by = pts[i + 1].y - pts[i].y
    const la = Math.hypot(ax, ay)
    const lb = Math.hypot(bx, by)
    if (la < 1e-6 || lb < 1e-6) continue
    const dot = Math.min(1, Math.max(-1, (ax * bx + ay * by) / (la * lb)))
    curv[i] = Math.acos(dot) // 0 = straight … π = hairpin
  }
  curv[0] = curv[1]
  curv[n - 1] = curv[n - 2]
  let max = 1e-6
  for (let i = 0; i < n; i++) if (curv[i] > max) max = curv[i]
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - 1)
    const hi = Math.min(n - 1, i + 1)
    const s = (curv[lo] + curv[i] + curv[hi]) / 3
    out[i] = 0.5 + 0.5 * (s / max)
  }
  return out
}

/**
 * Per-sample radius MULTIPLIER for one stroke — the Desk Doodles capsule
 * profile, expressed relative to the engine's calibrated radius.
 *
 * `pressures` may be null (no channel) OR present-but-constant; both are
 * treated as no channel, which is the whole point — see the header.
 */
function inflateInkWidthProfile(
  pts: { x: number; y: number }[],
  pressures: Float32Array | null,
  diameter: number,
  /**
   * A CLOSED loop has no ends, so it has no end taper. Optional and defaulting
   * to false, so every existing call site is unchanged. This is the whole of
   * the ink half of the closed-loop fix: the taper is driven by distance to the
   * nearer END, and on a loop that distance is undefined rather than zero.
   */
  closed = false,
): Float32Array {
  const n = pts.length
  const out = new Float32Array(n)
  if (n === 0) return out
  if (n === 1) {
    out[0] = 1
    return out
  }

  // Arc-length parameter u ∈ [0, 1]. Their rings come off getPointAt(u), which
  // is arc-length uniform; our polyline is already arc-length resampled, so the
  // cumulative length IS that parameter.
  const s = new Float32Array(n)
  for (let i = 1; i < n; i++) {
    s[i] = s[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  }
  const total = s[n - 1]
  if (!(total > 0)) {
    out.fill(1)
    return out
  }

  // THE FLAT-CHANNEL GUARD (their fix). Real pressure only counts if it varies.
  let hasRealPressure = false
  if (pressures && pressures.length > 1) {
    let mn = pressures[0]
    let mx = pressures[0]
    for (let i = 0; i < pressures.length; i++) {
      const v = pressures[i]
      if (!Number.isFinite(v)) continue
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
    hasRealPressure = mx - mn > INFLATE_PRESSURE_FLAT_EPS
  }
  const eff =
    hasRealPressure && pressures ? pressures : inflateSynthPressures(pts)

  const tip = INFLATE_TIP_FRACTION
  // The end zone their sin(πu) implicitly spans, bounded — see the header.
  // Capped at 45% so the two ends cannot meet and erase a short mark.
  const taperLen = Math.min(
    diameter > 0 ? diameter * INFLATE_TAPER_SPAN_DIAMETERS : total * 0.45,
    total * 0.45,
  )
  for (let i = 0; i < n; i++) {
    // Distance to the NEARER end, as a fraction of the taper zone. At 1 the
    // profile has reached full width and stays there, which is the whole
    // difference from running the sine over the entire stroke.
    const d = Math.min(s[i], total - s[i])
    const x = closed ? 1 : taperLen > 0 ? Math.min(1, d / taperLen) : 1
    const profile = Math.pow(Math.sin((Math.PI / 2) * x), INFLATE_PROFILE_EXP)
    let r = tip + (1 - tip) * profile
    const p = eff[Math.min(i, eff.length - 1)]
    r *= Math.max(1 + INFLATE_PRESSURE_INFLUENCE * 2 * (p - 0.5), 0.25)
    // Their ringRadii floor, expressed as a fraction: Math.max(r, tip*0.5).
    out[i] = Math.max(r, tip * 0.5)
  }

  // Smooth the profile along the stroke.
  //
  // Desk Doodles evaluates its profile on a Catmull-Rom at FOUR TIMES the
  // anchor count, so consecutive rings differ by a quarter of what ours do:
  // our samples sit ~0.6 radii apart and the curvature term can step between
  // neighbours, which shows up as visible RINGS banding down the stroke (seen
  // on the D's stem, docs/verification/deskdoodles-ink/after-fusion). Two
  // [1,2,1] passes give the same ring-to-ring continuity without resampling
  // the centerline, and cannot move the tips (endpoints are held).
  const tmp = new Float32Array(n)
  for (let pass = 0; pass < 2; pass++) {
    tmp.set(out)
    for (let i = 1; i < n - 1; i++) {
      out[i] = tmp[i - 1] * 0.25 + tmp[i] * 0.5 + tmp[i + 1] * 0.25
    }
  }
  return out
}

/**
 * Resample a per-point scalar onto a resampled centerline, by arc length.
 *
 * `inflateResampleCenterline` walks the SAME polyline, so cumulative arc length
 * is a shared coordinate between the two point lists and no nearest-neighbour
 * guessing is needed.
 */
function inflateResampleScalar(
  srcPts: { x: number; y: number }[],
  srcValues: (number | undefined)[],
  dstPts: { x: number; y: number }[],
): Float32Array | null {
  if (srcPts.length < 2 || dstPts.length === 0) return null
  let anyDefined = false
  for (const v of srcValues) if (v !== undefined && Number.isFinite(v)) anyDefined = true
  if (!anyDefined) return null

  const sSrc = new Float64Array(srcPts.length)
  for (let i = 1; i < srcPts.length; i++) {
    sSrc[i] = sSrc[i - 1] + Math.hypot(srcPts[i].x - srcPts[i - 1].x, srcPts[i].y - srcPts[i - 1].y)
  }
  const out = new Float32Array(dstPts.length)
  let cursor = 0
  let sDst = 0
  for (let j = 0; j < dstPts.length; j++) {
    if (j > 0) sDst += Math.hypot(dstPts[j].x - dstPts[j - 1].x, dstPts[j].y - dstPts[j - 1].y)
    while (cursor < srcPts.length - 2 && sSrc[cursor + 1] < sDst) cursor++
    const a = sSrc[cursor]
    const b = sSrc[cursor + 1]
    const t = b > a ? Math.max(0, Math.min(1, (sDst - a) / (b - a))) : 0
    const va = srcValues[cursor]
    const vb = srcValues[cursor + 1]
    const fa = va !== undefined && Number.isFinite(va) ? va : (vb ?? 0)
    const fb = vb !== undefined && Number.isFinite(vb) ? vb : fa
    out[j] = fa + (fb - fa) * t
  }
  return out
}

/**
 * Per-sample RAW unit tangents (XY) of a resampled centerline.
 *
 * Extracted so the loft (`inflateBuildEllipticalTube`) and the implicit field
 * (`inflateBuildImplicitGeometry`) derive their per-sample radius profile from
 * bit-identical inputs. If these drifted apart, "the implicit path preserves
 * the current look where strokes don't cross" would stop being true silently.
 */
function inflateRawTangents(
  centerlineWorld: { x: number; y: number }[],
  /** Closed loop: the central difference WRAPS at both ends instead of
   *  degenerating to a one-sided difference there. Optional, default false. */
  closed = false,
): { Tx: Float32Array; Ty: Float32Array } {
  const n = centerlineWorld.length
  const Tx = new Float32Array(n)
  const Ty = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const prev = centerlineWorld[closed ? (i - 1 + n) % n : i === 0 ? 0 : i - 1]
    const next = centerlineWorld[closed ? (i + 1) % n : i === n - 1 ? n - 1 : i + 1]
    let tx = next.x - prev.x
    let ty = next.y - prev.y
    const len = Math.hypot(tx, ty)
    if (len < 1e-9) {
      if (i > 0) {
        tx = Tx[i - 1]
        ty = Ty[i - 1]
      } else {
        tx = 1
        ty = 0
      }
    } else {
      tx /= len
      ty /= len
    }
    Tx[i] = tx
    Ty[i] = ty
  }
  return { Tx, Ty }
}

/** Per-sample curvature in [0,1] from the turn between RAW adjacent tangents. */
function inflateCurvature(TxRaw: Float32Array, TyRaw: Float32Array): Float32Array {
  const n = TxRaw.length
  const curvature = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1)
    const i1 = Math.min(n - 1, i + 1)
    const dot = TxRaw[i0] * TxRaw[i1] + TyRaw[i0] * TyRaw[i1]
    curvature[i] = Math.max(0, Math.min(1, 1 - dot))
  }
  return curvature
}

/**
 * The pruned ball chain a swept tube is built from, plus the two derivatives
 * the canal-surface construction needs.
 *
 * Extracted from `inflateBuildEllipticalTube` so that the EMBEDDING TEST below
 * evaluates the same chain the sweep does. A predicate that answers "does this
 * tube self-intersect" from a differently-derived chain is answering about a
 * different tube — and the whole point of that test is that it decides which
 * surface strategy runs.
 */
/**
 * Per-sample tube radii, exactly as the sweep uses them.
 *
 * Shared with the embedding test for the same reason the chain is: a fold
 * predicate evaluated on radii the sweep does not use is a prediction about a
 * tube nobody built. The join bulge in particular is curvature-driven, so it is
 * LARGEST precisely where the fold question is decided.
 */
function inflateSampleRadii(
  centerlineWorld: { x: number; y: number }[],
  radiusXY: number,
  radiusZ: number,
  joinSoftness: number,
  radiusMultipliers?: Float32Array,
): { rxy: Float64Array; rz: Float64Array } {
  const n = centerlineWorld.length
  // Per-sample RAW tangent (in XY plane). Smoothing is deliberately NOT done
  // here — it happens after the ball chain is pruned, so the tangent that
  // orients each ring is the tangent of the chain the surface is actually built
  // from rather than of a sample that was discarded.
  const { Tx, Ty } = inflateRawTangents(centerlineWorld)
  // Curvature in [0,1]: 0 = straight, 1 = ~90deg+ turn.
  const curvature = inflateCurvature(Tx, Ty)
  const rxy = new Float64Array(n)
  const rz = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    // Local join bulge. This exists for a STRUCTURAL reason, not a stylistic
    // one: a swept tube pinches on the inside of a tight turn, and a little
    // extra radius there hides the pinch. It used to be 0.3, which at high Puff
    // put a +25% sphere at every bend — read as a plumbing fitting, not ink.
    // The width profile now carries the (much smaller) stylistic dwell, so this
    // is cut to the structural minimum. The implicit path applies NONE of it:
    // an exact distance field cannot pinch, so the bulge would be pure ball
    // joint there.
    const joinScale = 1 + joinSoftness * 0.1 * curvature[i]
    // Crossing/overlap pressure bulge (1 = none).
    const m = radiusMultipliers ? radiusMultipliers[i] : 1
    rxy[i] = radiusXY * joinScale * m
    rz[i] = radiusZ * joinScale * m
  }
  return { rxy, rz }
}

interface InflateBallChain {
  /** Centres, radii and Z semi-axes of the surviving balls. */
  kx: number[]
  ky: number[]
  kr: number[]
  kz: number[]
  /** Smoothed unit tangents of the PRUNED chain — what each ring is ⟂ to. */
  Tx: Float32Array
  Ty: Float32Array
  /** dr/ds by central difference. |slope| < 1 is a theorem after pruning. */
  slope: Float64Array
  arcS: Float64Array
}

function inflateBuildBallChain(
  centerlineWorld: { x: number; y: number }[],
  radiiXY: Float64Array,
  radiiZ: Float64Array,
  tangentSmoothingPasses: number,
  /**
   * Closed loop: the tangent smoothing WRAPS instead of clamping at the ends.
   * Without this the seam ring's tangent is one-sided while every other ring's
   * is central, which puts a kink at exactly the place the wrap was meant to
   * make ordinary. Optional, defaulting to false — every existing call site is
   * unchanged.
   */
  closed = false,
): InflateBallChain | null {
  const n = centerlineWorld.length
  if (n < 2) return null

  // 1) Prune contained balls. Containment is local on a swept tube, so a
  //    bounded window is enough; the endpoints are checked like everything
  //    else, because a swallowed TIP ball is the common case (it is what a
  //    near-duplicate first sample produces) and keeping it is what put a nub
  //    on the end of every mark.
  const CONTAIN_WINDOW = 6
  const alive = new Uint8Array(n).fill(1)
  for (let i = 0; i < n; i++) {
    for (let d = 1; d <= CONTAIN_WINDOW; d++) {
      for (const j of [i - d, i + d]) {
        if (j < 0 || j >= n || !alive[j] || !alive[i]) continue
        const dist = Math.hypot(
          centerlineWorld[i].x - centerlineWorld[j].x,
          centerlineWorld[i].y - centerlineWorld[j].y,
        )
        /* i inside j.
         *
         * ⚠ THE STRICT `<` USED TO MEAN NEITHER OF A COINCIDENT PAIR DIED, AND
         * THAT IS A ZERO-LENGTH SEGMENT IN THE CHAIN. The old line read
         *
         *     if (dist + radiiXY[i] <= radiiXY[j] && radiiXY[i] < radiiXY[j])
         *
         * with the comment "Strict on radius so two identical balls do not both
         * die." The hazard is real — kill both and the chain loses a station —
         * but refusing to kill EITHER is not the fix for it, and the block
         * directly above states the invariant that refusal breaks: `|r'| < 1` is
         * supposed to be a THEOREM about the pruned chain. Two balls at the same
         * point with the same radius give Δs = 0 and Δr = 0, so r' is 0/0 and
         * there is no theorem left.
         *
         * MEASURED (`_probe-loft-degenerate.mjs`, square fixture, fusion:loft):
         * under `loopEnds: "wrapped"` the chain kept a coincident pair at its
         * seam — ring 0 and ring 1 centroids 2.217e-7 r apart against a median
         * ring step of 1.2469 r — so the sweep emitted a band of zero-area
         * quads between them. Four of its 56 triangles collapse EXACTLY (the two
         * profile samples at theta = pi/2 and 3pi/2 carry no XY offset, so the
         * two rings' vertices land on the same float32), at
         * (-0.2805, 0.8267, +/-0.0523) — the seam corner. `assert-seam.mjs`
         * SEAM-1c read `square 0 -> 4 (capped -> wrapped)` and
         * `assert-fold-census.mjs` CAL-6 read `degenerate 4` on the same mesh.
         * `capped` was clean only because its end taper offsets the two rings
         * differently; the defect is in the prune, not in the wrap.
         *
         * THE FIX IS A TIE-BREAK, NOT AN EPSILON. Containment stays exact — no
         * tolerance is introduced anywhere — and the equal-radius case is
         * decided by index, which is antisymmetric: for a coincident pair (i, j)
         * exactly one of `i > j` and `j > i` holds, so exactly one ball dies and
         * the "both die" hazard the old comment names is still impossible. Two
         * coincident balls of equal radius bound the same solid, so dropping one
         * cannot move the surface. */
        if (
          dist + radiiXY[i] <= radiiXY[j] &&
          (radiiXY[i] < radiiXY[j] || (radiiXY[i] === radiiXY[j] && i > j))
        ) {
          alive[i] = 0
        }
      }
    }
  }
  const kx: number[] = []
  const ky: number[] = []
  const kr: number[] = []
  const kz: number[] = []
  for (let i = 0; i < n; i++) {
    if (!alive[i]) continue
    kx.push(centerlineWorld[i].x)
    ky.push(centerlineWorld[i].y)
    kr.push(radiiXY[i])
    kz.push(radiiZ[i])
  }
  // A one-ball chain is a sphere; the ring machinery needs two circles to sweep
  // between, so fall back to keeping the largest ball plus its neighbour.
  if (kx.length < 2) {
    let big = 0
    for (let i = 1; i < n; i++) if (radiiXY[i] > radiiXY[big]) big = i
    const other = big === 0 ? Math.min(1, n - 1) : big - 1
    const a = Math.min(big, other)
    const b = Math.max(big, other)
    kx.length = 0
    ky.length = 0
    kr.length = 0
    kz.length = 0
    for (const i of [a, b]) {
      kx.push(centerlineWorld[i].x)
      ky.push(centerlineWorld[i].y)
      kr.push(radiiXY[i])
      kz.push(radiiZ[i])
    }
  }
  const m2 = kx.length

  // 2) Tangents of the PRUNED chain, then the same 3-tap smoothing the raw
  //    centreline used to get. Smoothing the discarded chain's tangents was
  //    harmless but meaningless; this is the direction each ring is actually
  //    perpendicular to.
  const keptPts = kx.map((x, i) => ({ x, y: ky[i] }))
  const { Tx: kTxRaw, Ty: kTyRaw } = inflateRawTangents(keptPts, closed)
  let Tx = new Float32Array(kTxRaw)
  let Ty = new Float32Array(kTyRaw)
  for (let pass = 0; pass < tangentSmoothingPasses; pass++) {
    const nx = new Float32Array(m2)
    const ny = new Float32Array(m2)
    for (let i = 0; i < m2; i++) {
      const i0 = closed ? (i - 1 + m2) % m2 : Math.max(0, i - 1)
      const i1 = closed ? (i + 1) % m2 : Math.min(m2 - 1, i + 1)
      let tx = Tx[i0] * 0.25 + Tx[i] * 0.5 + Tx[i1] * 0.25
      let ty = Ty[i0] * 0.25 + Ty[i] * 0.5 + Ty[i1] * 0.25
      const L = Math.hypot(tx, ty)
      if (L > 1e-9) {
        tx /= L
        ty /= L
      } else {
        tx = Tx[i]
        ty = Ty[i]
      }
      nx[i] = tx
      ny[i] = ty
    }
    Tx = nx
    Ty = ny
  }

  // 3) dr/ds by central difference on the pruned chain. |slope| < 1 is
  //    guaranteed by step 1 for ADJACENT pairs; the central difference spans
  //    two steps, so it is bounded by the larger of the two one-sided slopes
  //    and inherits the bound. The final clamp is belt-and-braces against a
  //    coincident pair (ds ~ 0), not a tuning constant.
  const arcS = new Float64Array(m2)
  for (let i = 1; i < m2; i++) {
    arcS[i] = arcS[i - 1] + Math.hypot(kx[i] - kx[i - 1], ky[i] - ky[i - 1])
  }
  const slope = new Float64Array(m2)
  for (let i = 0; i < m2; i++) {
    const i0 = Math.max(0, i - 1)
    const i1 = Math.min(m2 - 1, i + 1)
    const ds = arcS[i1] - arcS[i0]
    const raw = ds > 1e-12 ? (kr[i1] - kr[i0]) / ds : 0
    slope[i] = Math.max(-0.999, Math.min(0.999, raw))
  }

  return { kx, ky, kr, kz, Tx, Ty, slope, arcS }
}

/**
 * THE OTHER HALF OF THE THEOREM — does this tube pass through itself?
 *
 * The canal surface (the boundary of the union of balls along a centreline) is
 * a smooth EMBEDDED surface iff two conditions hold:
 *
 *     |r′| < 1          the chain does not swallow its own balls
 *     r·κ  < 1          the centreline does not turn tighter than its own radius
 *
 * `inflateBuildBallChain` establishes the first BY CONSTRUCTION — that is what
 * the pruning is, and explainer 17 records it as a theorem rather than a clamp.
 * The second was never checked anywhere, and it is the one `square/inflate`
 * violates: a ring sweep whose centreline turns inside its own radius folds the
 * inner column back through the surface, and no amount of ring density fixes it
 * because r·κ does not depend on sampling.
 *
 * The test is written as the EXACT discrete predicate on the rings the sweep
 * actually emits, not as a continuous r·κ proxy, because a polyline's discrete
 * curvature depends on how the corner happened to be resampled. Between two
 * consecutive rings turning by Δθ over a centre advance h, the innermost
 * column advances by
 *
 *     h − (rᵢ + rᵢ₊₁)·sin(Δθ/2)
 *
 * (each ring's inner point sits at ∓sin(Δθ/2) along the chord direction), so
 * the strip folds back on itself exactly when that is negative. Reported as a
 * DEPTH in world units and normalised by the local radius, because "how far
 * does the surface reach back inside itself" is the quantity that decides
 * whether the fold is visible or is a rounding artefact below one facet.
 *
 * Returns depth ≤ 0 for every embedded tube; > 0 means the mesh provably
 * intersects itself, which `scripts/verify/assert-elbow.mjs` confirms
 * independently by counting sheets crossed by a −Z ray.
 */
interface InflateFoldMetric {
  /** Max (rᵢ+rᵢ₊₁)·sin(Δθ/2) − h over the chain, world units. >0 = folded. */
  maxFoldDepth: number
  /** The same, divided by the local radius. */
  maxFoldOverR: number
  /** How many ring pairs fold. */
  foldingPairs: number
  /** Chain index of the worst pair, or -1. */
  worstIndex: number
}

function inflateChainFoldMetric(
  chain: InflateBallChain,
  /**
   * Closed loop: the WRAP pair (last ring back to the first) is a ring pair like
   * any other and is tested like one. Leaving it out would exempt the single
   * join the wrap introduces from the only predicate that decides whether the
   * sweep is embedded — i.e. the fix would have created the one seam its own
   * gate could not see. Optional, default false; every existing caller unchanged.
   */
  closed = false,
): InflateFoldMetric {
  const { kx, ky, kr, Tx, Ty } = chain
  const m = kx.length
  let maxFoldDepth = -Infinity
  let maxFoldOverR = -Infinity
  let foldingPairs = 0
  let worstIndex = -1
  const pairs = closed ? m : m - 1
  for (let p = 0; p < pairs; p++) {
    const i = p
    const iN = closed ? (p + 1) % m : p + 1
    const h = Math.hypot(kx[iN] - kx[i], ky[iN] - ky[i])
    const dot = Math.max(-1, Math.min(1, Tx[i] * Tx[iN] + Ty[i] * Ty[iN]))
    const dTheta = Math.acos(dot)
    const reach = (kr[i] + kr[iN]) * Math.sin(dTheta / 2)
    const depth = reach - h
    const rMid = (kr[i] + kr[iN]) / 2
    if (depth > 0) foldingPairs++
    if (depth > maxFoldDepth) {
      maxFoldDepth = depth
      maxFoldOverR = rMid > 0 ? depth / rMid : 0
      worstIndex = i
    }
  }
  if (!Number.isFinite(maxFoldDepth)) {
    return { maxFoldDepth: 0, maxFoldOverR: 0, foldingPairs: 0, worstIndex: -1 }
  }
  return { maxFoldDepth, maxFoldOverR, foldingPairs, worstIndex }
}

/**
 * Build a single watertight tube mesh by sweeping an elliptical
 * cross-section along the resampled centerline.
 *
 * Cross-section: ellipse with side-radius `radiusXY` (in the screen-XY
 * plane perpendicular to the path tangent) and Z-radius `radiusZ`. At
 * each sample we build an oriented frame:
 *   tangent T = path direction in XY
 *   side    S = perpendicular to T in XY (rotate 90° CCW)
 *   up      U = +Z
 * The cross-section vertex at angle theta is:
 *   center + radiusXY*cos(theta)*S + radiusZ*sin(theta)*U
 * Sweeping theta over [0, 2π) gives a closed elliptical ring per sample.
 *
 * End caps: TRUE protruding domes. Cap rings are appended BEYOND each
 * endpoint along the endpoint tangent (like a balloon end extending past
 * the stroke end), with ring radius following the ellipsoid profile
 * r(phi) = cos(phi) at offset L*sin(phi). The old implementation instead
 * faded the radius to zero ACROSS the last in-stroke samples, which both
 * shortened the inflated form relative to the drawn stroke and made the
 * cap shape depend on sample spacing.
 *
 * Why no medial-axis seam: each ring is a single closed loop. The
 * surface wraps fully around the centerline. There is no z=0 ridge.
 *
 * Why Width feels like radius: `radiusXY` is the literal cross-section
 * half-width in world units. Doubling it doubles tube thickness with no
 * rasterization, no coverage threshold, no density behavior.
 *
 * Why Puff feels like pressure: `radiusZ / radiusXY` is the inflation
 * aspect. Low Puff → flat soft gel. High Puff → over-pressured balloon.
 */
function inflateBuildEllipticalTube(
  centerlineWorld: { x: number; y: number }[],
  radiusXY: number,
  radiusZ: number,
  opts?: {
    ringSegs?: number
    profileExponent?: number // 2 = ellipse; <2 squashed; >2 squircle/balloon
    crossSectionBulge?: number // 0..0.4 radial bulge (pressurized fullness)
    tangentSmoothingPasses?: number // # of 3-tap smoothing passes on tangents
    joinSoftness?: number // 0..1 local radial bulge at high-curvature joins
    /**
     * Optional per-sample radius multiplier (length n). Drives the
     * crossing/overlap pressure bulge: where two stroke bodies pass within
     * each other's inflated radius, both swell locally so the junction
     * reads as one merged pressurized form instead of two hard pipes
     * interpenetrating. 1 = no change.
     */
    radiusMultipliers?: Float32Array
    /**
     * CLOSED LOOP — no ends, therefore no end caps and no tip fans: the ring
     * sequence wraps from the last frame back to the first and every sample
     * becomes an interior join. Ported from Extrude's "CLOSED LOOPS ARE BUILT
     * AS LOOPS" (:1803), which fixed the identical defect there. Nothing is
     * snapped or moved — the closing chord is an ordinary segment — so the
     * drawn shape is unchanged and only the topology is.
     */
    closed?: boolean
  },
): THREE.BufferGeometry | null {
  const n = centerlineWorld.length
  if (n < 2 || radiusXY <= 0 || radiusZ <= 0) return null

  const ringSegs = Math.max(8, opts?.ringSegs ?? 24)
  const profileExponent = Math.max(0.6, opts?.profileExponent ?? 2)
  const bulge = Math.max(0, Math.min(0.5, opts?.crossSectionBulge ?? 0))
  // `capRoundness` was an opt here and is GONE, not defaulted-and-ignored: the
  // end cap is now the terminal ball's own spherical patch, so its length is
  // one local radius by construction and any other value breaks tangency with
  // the wall. See the ring-construction block below. Removed from the signature
  // so a caller that still passes it fails to typecheck rather than silently
  // having it dropped — this repo has shipped a dead control before.
  const tangentSmoothingPasses = Math.max(
    1,
    Math.min(4, Math.round(opts?.tangentSmoothingPasses ?? 1)),
  )
  const joinSoftness = Math.max(0, Math.min(1, opts?.joinSoftness ?? 0))
  const radiusMultipliers = opts?.radiusMultipliers
  const closed = opts?.closed === true

  // Precompute the cross-section profile (one normalized ring shared by
  // every sample). Superellipse with a small radial bulge term.
  // Plain ellipse: |x|^2 + |z|^2 = 1 (exponent = 2).
  // profileExponent < 2 → diamond / soft squash (low Puff).
  // profileExponent > 2 → squircle / balloon (high Puff).
  // bulge pushes the surface outward radially (fuller / pressurized).
  const profCosX = new Float32Array(ringSegs)
  const profSinZ = new Float32Array(ringSegs)
  const e = profileExponent
  for (let j = 0; j < ringSegs; j++) {
    const theta = (j / ringSegs) * Math.PI * 2
    const cT = Math.cos(theta)
    const sT = Math.sin(theta)
    // Superellipse (signed power):
    //   x = sign(cos)*|cos|^(2/e), z = sign(sin)*|sin|^(2/e)
    const k = 2 / e
    const xUnit = Math.sign(cT) * Math.pow(Math.abs(cT), k)
    const zUnit = Math.sign(sT) * Math.pow(Math.abs(sT), k)
    // Apply isotropic bulge: scale the unit by (1 + bulge).
    const scale = 1 + bulge
    profCosX[j] = xUnit * scale
    profSinZ[j] = zUnit * scale
  }

  // ---- Ring list construction ----
  // The tube is ONE ring sequence: start-cap dome rings (protruding beyond
  // the first sample), one ring per centerline sample, end-cap dome rings
  // (beyond the last sample), closed by a tip fan at each extreme.
  interface InflateRing {
    cx: number
    cy: number
    sx: number
    sy: number
    rXY: number
    rZ: number
  }

  /* ══════════════════════════════════════════════════════════════════════
   * THE RIM: RINGS ARE THE ENVELOPE OF THE BALLS, NOT CROSS-SECTIONS OF THE
   * CENTRELINE.
   *
   * MEASURED DEFECT (docs/explainers/17, docs/verification/mode-rims/before).
   * `probeDihedral` on glossyPlastic reported `mixed max` 85.3 / 89.3 / 90.0
   * and `wall max` 61.5 / 84.7 / 90.0 on circle / tick / crossing, with
   * `degenerateTriangles` 0 — real geometry, not an instrument artefact. The
   * worst edges localise, on EVERY fixture, to the same three rings: the last
   * start-cap ring, the first body ring and the second. That is the ink
   * taper's shoulder, and it is NOT Solid's missing bevel, so the Solid fix
   * does not transfer:
   *
   *   `inflateInkWidthProfile` is r(x) = tip + (1−tip)·sin(πx/2)^0.8 with
   *   tip = 0.159 (ported from Desk Doodles — see its header). exp < 1 means
   *   dr/dx → ∞ AS x → 0: the profile leaves the tip VERTICALLY. So the first
   *   ring step out of the tip raises the radius by a large fraction of a
   *   radius while advancing one sample spacing along the curve, and a ring
   *   placed square across the centreline turns the wall by
   *   atan(Δr/Δs) — measured 86 degrees on `circle`. The hemisphere cap was
   *   then built at the LOCAL (tip) radius, so a 0.16r nub was welded onto a
   *   wall flaring at nearly a right angle. That collar is the defect.
   *
   * It cannot be fixed by finer sampling. Subdividing between two rings whose
   * radii are linearly interpolated adds vertices to a straight generatrix and
   * changes no crease at all; and because the slope is unbounded at the tip, no
   * spacing makes the first step shallow. It also must not be fixed by raising
   * the exponent to 1 — the sub-1 exponent IS the ported "capsule read, not
   * football" decision, and re-deriving a ported constant is exactly what the
   * port's own header forbids.
   *
   * THE FIX IS THE CONSTRUCTION. A swept tube of varying radius has a
   * well-defined smooth boundary: the boundary of the UNION OF BALLS along the
   * centreline — the canal surface. Its characteristic circle at arc length s
   * is not the perpendicular cross-section; differentiating
   * |p − c(s)|² = r(s)² gives (p − c)·T = −r·r′, so the circle sits at
   *
   *     centre − r·r′·T        with radius   r·√(1 − r′²)
   *
   * — tilted toward the narrow end and shrunk. Two consequences, both of them
   * the thing being fixed:
   *
   *  1. The band between consecutive circles is the tangent cone of both balls,
   *     so the crease across a ring is the change in SLOPE (a second
   *     difference of r) instead of the slope itself. An unbounded first
   *     derivative stops producing an unbounded crease.
   *  2. The end cap falls out of the same family instead of being bolted on.
   *     The terminal ball's own spherical patch, run from the junction circle
   *     (cos α = ∓r′, which is where the wall left it) to the pole one radius
   *     past the endpoint, is tangent to the wall BY CONSTRUCTION. There is no
   *     free cap length to get wrong.
   *
   * This is also the surface the IMPLICIT fusion path already defines — its
   * primitives are round cones, i.e. the union of two balls — so the two
   * strategies now describe the same solid, which is what "both surface
   * strategies must read as the same drawing" asks for.
   *
   * WHY `capRoundness` NO LONGER SETS A CAP LENGTH. It scaled the dome to
   * 0.82–1.0 radii. A cap shorter than one radius is not a patch of the
   * terminal ball, so it cannot be tangent to the wall, and the residual
   * mismatch is part of the collar measured above. The cap is now exactly the
   * ball, and the value is reported as 1 rather than quietly kept as a dial
   * that fights the geometry. Puff still drives the Z aspect, the profile
   * exponent, the cross-section bulge and the join softness.
   *
   * WHY BALLS GET PRUNED FIRST, and why that removes the need for any clamp.
   * `r′` is only meaningful where |r′| < 1; at |r′| ≥ 1 the smaller ball is
   * swallowed by its neighbour and contributes no surface, and √(1 − r′²) goes
   * imaginary. Both fixtures hit this: `processStroke` can emit a near-duplicate
   * first sample (measured Δs = 0.0008 world on `circle` against Δr = 0.0126),
   * which is a ball wholly inside the next one. So the chain is pruned by the
   * exact containment test |c_i − c_j| + r_i ≤ r_j, and after pruning
   * |Δr| < |Δc| holds between every surviving neighbour BY DEFINITION —
   * i.e. |r′| < 1 is a THEOREM about the pruned chain, not a clamp bolted on
   * top of it. A clamp here would be the "guard whose failure mode is the worst
   * available answer" this codebase keeps finding.
   * ══════════════════════════════════════════════════════════════════════ */

  // 1) One ball per centreline sample, in Z-SCALED space where the tube is
  //    isotropic. rZ/rXY is the same constant at every sample, so the scaled
  //    space is uniform and the canal maths is the plain isotropic one; the Z
  //    semi-axis is carried alongside and shrinks by the same factor.
  //
  // 2-4) Prune, tangents, dr/ds — all of it lives in `inflateBuildBallChain`
  //    so the embedding test that ROUTES between surface strategies evaluates
  //    the same chain this sweep is about to turn into triangles.
  const { rxy: ballRxy, rz: ballRz } = inflateSampleRadii(
    centerlineWorld,
    radiusXY,
    radiusZ,
    joinSoftness,
    radiusMultipliers,
  )
  const chain = inflateBuildBallChain(
    centerlineWorld,
    ballRxy,
    ballRz,
    tangentSmoothingPasses,
    closed,
  )
  if (!chain) return null
  const { kx, ky, kr, kz, Tx, Ty, slope } = chain
  const m2 = kx.length

  const rings: InflateRing[] = []
  const capMeridianStep = (Math.PI * 2) / ringSegs

  // 5) Start cap: the first ball's spherical patch, from the pole one radius
  //    behind the endpoint up to (but not including) the junction circle, which
  //    the body's own ring 0 already is.
  if (!closed) {
    const r0 = kr[0]
    const z0 = kz[0]
    const tx = Tx[0]
    const ty = Ty[0]
    // cos(alpha) = r'(0) — see the derivation above. alpha is measured from the
    // pole that lies one radius BEHIND the start, along -T.
    const a0 = Math.acos(Math.max(-1, Math.min(1, slope[0])))
    const capRings = Math.max(2, Math.ceil(a0 / capMeridianStep))
    // alpha ASCENDING: alpha = 0 is the pole one radius behind the endpoint and
    // alpha = a0 is the junction, so the ring list must run tip -> body to keep
    // the single ring sequence monotonic along the tube. (The end cap below runs
    // the other way for the same reason.)
    for (let c = 1; c <= capRings - 1; c++) {
      const alpha = (c / capRings) * a0
      rings.push({
        cx: kx[0] - tx * r0 * Math.cos(alpha),
        cy: ky[0] - ty * r0 * Math.cos(alpha),
        sx: -ty,
        sy: tx,
        rXY: r0 * Math.sin(alpha),
        rZ: z0 * Math.sin(alpha),
      })
    }
  }

  // 6) Body: the canal surface's characteristic circles.
  for (let i = 0; i < m2; i++) {
    const shrink = Math.sqrt(Math.max(0, 1 - slope[i] * slope[i]))
    const off = -kr[i] * slope[i]
    rings.push({
      cx: kx[i] + Tx[i] * off,
      cy: ky[i] + Ty[i] * off,
      sx: -Ty[i],
      sy: Tx[i],
      rXY: kr[i] * shrink,
      rZ: kz[i] * shrink,
    })
  }

  // 7) End cap: the last ball's patch, junction circle (already emitted as the
  //    final body ring) down to the pole one radius past the endpoint.
  if (!closed) {
    const rN = kr[m2 - 1]
    const zN = kz[m2 - 1]
    const tx = Tx[m2 - 1]
    const ty = Ty[m2 - 1]
    const b0 = Math.acos(Math.max(-1, Math.min(1, -slope[m2 - 1])))
    const capRings = Math.max(2, Math.ceil(b0 / capMeridianStep))
    for (let c = capRings - 1; c >= 1; c--) {
      const beta = (c / capRings) * b0
      rings.push({
        cx: kx[m2 - 1] + tx * rN * Math.cos(beta),
        cy: ky[m2 - 1] + ty * rN * Math.cos(beta),
        sx: -ty,
        sy: tx,
        rXY: rN * Math.sin(beta),
        rZ: zN * Math.sin(beta),
      })
    }
  }

  const ringCount = rings.length
  if (ringCount < 2) return null

  const positions = new Float32Array((ringCount * ringSegs + 2) * 3)
  for (let i = 0; i < ringCount; i++) {
    const r = rings[i]
    for (let j = 0; j < ringSegs; j++) {
      const ux = profCosX[j]
      const uz = profSinZ[j]
      const idx = (i * ringSegs + j) * 3
      positions[idx] = r.cx + r.rXY * ux * r.sx
      positions[idx + 1] = r.cy + r.rXY * ux * r.sy
      positions[idx + 2] = r.rZ * uz
    }
  }

  // Tip vertices — the two POLES of the terminal balls, exactly one local
  // radius past each endpoint. Not a tunable protrusion any more: the pole is
  // where the cap's own sphere ends, and moving it off the sphere is what broke
  // tangency with the wall.
  const tipStart = ringCount * ringSegs
  const tipEnd = tipStart + 1
  {
    positions[tipStart * 3 + 0] = kx[0] - Tx[0] * kr[0]
    positions[tipStart * 3 + 1] = ky[0] - Ty[0] * kr[0]
    positions[tipStart * 3 + 2] = 0
    positions[tipEnd * 3 + 0] = kx[m2 - 1] + Tx[m2 - 1] * kr[m2 - 1]
    positions[tipEnd * 3 + 1] = ky[m2 - 1] + Ty[m2 - 1] * kr[m2 - 1]
    positions[tipEnd * 3 + 2] = 0
  }

  // Side walls between consecutive rings + a tip fan at each extreme.
  //
  // CLOSED: the strip wraps (ring ringCount-1 joins ring 0) and there are no
  // tip fans, because there are no tips. That is one extra quad band and two
  // fewer fans — the two tip vertices are still WRITTEN (harmlessly, unindexed)
  // so the position layout is identical in both cases and nothing downstream
  // has to know which branch ran.
  const bands = closed ? ringCount : ringCount - 1
  const indices = new Uint32Array(bands * ringSegs * 2 * 3 + (closed ? 0 : ringSegs * 2 * 3))
  let k = 0
  for (let i = 0; i < bands; i++) {
    const iNext = closed ? (i + 1) % ringCount : i + 1
    for (let j = 0; j < ringSegs; j++) {
      const j1 = (j + 1) % ringSegs
      const a = i * ringSegs + j
      const b = i * ringSegs + j1
      const c2 = iNext * ringSegs + j
      const d = iNext * ringSegs + j1
      indices[k++] = a
      indices[k++] = c2
      indices[k++] = b
      indices[k++] = b
      indices[k++] = c2
      indices[k++] = d
    }
  }
  if (!closed) {
    for (let j = 0; j < ringSegs; j++) {
      const j1 = (j + 1) % ringSegs
      indices[k++] = tipStart
      indices[k++] = j1
      indices[k++] = j
      indices[k++] = tipEnd
      indices[k++] = (ringCount - 1) * ringSegs + j
      indices[k++] = (ringCount - 1) * ringSegs + j1
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  return geometry
}

/**
 * Crossing/overlap pressure bulge.
 *
 * A real inflated form MERGES where the stroke crosses itself or another
 * stroke — the pressurized volumes fuse and the junction swells. A tube loft
 * cannot re-topologize (that needs an implicit field + marching cubes), but
 * it CAN reproduce the dominant visual cue: local swelling at the junction.
 *
 * For every centerline sample we find the nearest OTHER stroke body (any
 * sample of another stroke, or a sample of the same stroke that is far away
 * in arc length). If that body is within one merged diameter (2 * radiusXY),
 * the local radius is scaled up smoothly — peaking where the centerlines
 * actually cross. Both bodies swell symmetrically, so the junction reads as
 * one fused pressurized mass instead of two hard pipes interpenetrating.
 *
 * Pure function of the resampled centerlines — shared by preview and export
 * via inflateBuildStaticGeometries, so parity is automatic.
 */
function inflateComputeCrossingBulge(
  centerlines: { x: number; y: number }[][],
  radiusXY: number,
  bulgeAmp: number,
  /**
   * Per-stroke CLOSED flags. On a closed loop the separation test below must be
   * CYCLIC, because the samples either side of the seam are consecutive — they
   * are the same body continuing, not the stroke crossing itself.
   *
   * MEASURED, and this is why the flag exists at all: with the linear test, a
   * wrapped `circle` came out **+22 % fat at the seam** (half-width ratio to the
   * loop's own median: 1.22 at the last sample, 1.10 at the first, 1.00
   * everywhere else). The closed-loop fix would have swapped a self-intersection
   * for a visible bulge, which is the same trade this repo keeps warning about:
   * the headline defect goes and a small one arrives in its place.
   *
   * Optional, defaulting to all-open, so every existing call site is unchanged.
   */
  closedFlags?: readonly boolean[],
): Float32Array[] {
  const reach = radiusXY * 2
  if (reach <= 0) return centerlines.map((c) => new Float32Array(c.length).fill(1))

  // Spatial hash of all samples (cell size = reach) for O(1) neighborhoods.
  const cell = reach
  const hash = new Map<string, [number, number][]>() // [strokeIdx, sampleIdx]
  for (let s = 0; s < centerlines.length; s++) {
    const pts = centerlines[s]
    for (let i = 0; i < pts.length; i++) {
      const key = `${Math.floor(pts[i].x / cell)},${Math.floor(pts[i].y / cell)}`
      let bucket = hash.get(key)
      if (!bucket) {
        bucket = []
        hash.set(key, bucket)
      }
      bucket.push([s, i])
    }
  }

  const out: Float32Array[] = []
  for (let s = 0; s < centerlines.length; s++) {
    const pts = centerlines[s]
    const mult = new Float32Array(pts.length).fill(1)
    // Same-stroke samples closer than this along the chain are "the same
    // body", not a crossing. Estimated from average sample spacing.
    let avgSpacing = 0
    for (let i = 1; i < pts.length; i++) {
      avgSpacing += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    }
    avgSpacing = pts.length > 1 ? avgSpacing / (pts.length - 1) : 1
    const minSep = Math.max(4, Math.ceil((radiusXY * 3) / Math.max(avgSpacing, 1e-9)))
    const isClosed = closedFlags?.[s] === true
    const n = pts.length
    // Cyclic on a loop, linear otherwise. `minSep` itself is unchanged — it is
    // the same "~3 radii of arc is one body" threshold the implicit path's
    // `runGap` uses (:6268), so the two surface strategies agree about what
    // counts as a crossing.
    const sepAlong = (a: number, b: number) => {
      const d = Math.abs(a - b)
      return isClosed ? Math.min(d, n - d) : d
    }

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const cx = Math.floor(p.x / cell)
      const cy = Math.floor(p.y / cell)
      let best = 0
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        for (let gy = cy - 1; gy <= cy + 1; gy++) {
          const bucket = hash.get(`${gx},${gy}`)
          if (!bucket) continue
          for (const [s2, i2] of bucket) {
            if (s2 === s && sepAlong(i2, i) < minSep) continue
            const q = centerlines[s2][i2]
            const d = Math.hypot(q.x - p.x, q.y - p.y)
            if (d < reach) {
              const t = 1 - d / reach // 1 at exact crossing, 0 at the reach edge
              if (t > best) best = t
            }
          }
        }
      }
      if (best > 0) {
        const sm = best * best * (3 - 2 * best) // smoothstep
        mult[i] = 1 + bulgeAmp * sm
      }
    }

    // Smooth the multiplier along the stroke so the swell ramps organically.
    // On a loop the smoothing WRAPS, for the same reason the tangent smoothing
    // does: clamping at an index that is not an end puts a step exactly where
    // the wrap was meant to make things ordinary.
    for (let pass = 0; pass < 2; pass++) {
      const prev = Float32Array.from(mult)
      for (let i = 0; i < pts.length; i++) {
        const a = prev[isClosed ? (i - 1 + n) % n : Math.max(0, i - 1)]
        const b = prev[i]
        const c = prev[isClosed ? (i + 1) % n : Math.min(pts.length - 1, i + 1)]
        mult[i] = a * 0.25 + b * 0.5 + c * 0.25
      }
    }
    out.push(mult)
  }
  return out
}

/* ============================================================
 * IMPLICIT FUSION — the real merge
 *
 * The loft's problem is structural, not cosmetic: it builds one closed tube
 * PER STROKE, so at a crossing there are two complete surfaces occupying the
 * same space. `inflateComputeCrossingBulge` swells both tubes there, which
 * reproduces the visual CUE of fusion (the junction looks fatter) but not the
 * fact — the shells still interpenetrate, a cross-section through the crossing
 * still hits four sheets, and the exported GLB is still two solids.
 *
 * This function replaces the whole tube-per-stroke idea with a scalar field:
 *
 *     f(p) = smin_runs( sdRoundCone(p, segment) )
 *
 * and meshes f = 0. There is no per-stroke surface any more, so there is
 * nothing to interpenetrate. See lib/implicit-surface.ts for the SDF, the
 * smooth-minimum derivation, the run-grouping rule (a stroke must not blend
 * with itself), the acceleration structure and its exactness proof, and the
 * marching-cubes ambiguous-face discussion.
 *
 * COORDINATE TRICK — anisotropy for free.
 * Inflate's cross-section is an ELLIPSE: radiusXY across the stroke, radiusZ in
 * depth. A capsule SDF is circular. Rather than write an elliptical distance
 * function (which has no closed form), the whole field is evaluated in a
 * "field space" where Z is scaled by radiusXY / radiusZ. Every capsule is then
 * genuinely round, the SDF stays exact — which is what the acceleration
 * proof depends on — and the marching-cubes output is scaled back by
 * radiusZ / radiusXY on the way out. Because every stroke lies on the z = 0
 * plane and the aspect is a single global calibration, the axes themselves are
 * unchanged by the transform; only the radii are reinterpreted.
 *
 * WHAT IS INTENTIONALLY DROPPED vs the loft (both named in the doc):
 *   • the superellipse `profileExponent` (a squircle cross-section) has no
 *     exact SDF; the implicit cross-section is a true ellipse. The visible
 *     effect is a very slightly slimmer form at the 45° diagonals.
 *   • `inflateComputeCrossingBulge` is NOT applied. It exists to fake fusion.
 *     With the field doing the real thing, layering the fake on top would
 *     double-count the junction swell.
 * ============================================================ */
function inflateBuildImplicitGeometry(
  centerlines: { x: number; y: number }[][],
  inkProfiles: Float32Array[],
  radiusXY: number,
  radiusZ: number,
  crossSectionBulge: number,
  joinSoftness: number,
  sampleSpacing: number,
  inflateParams: InflateParams,
  /** The resolved nib — needed here only to measure arc in WORLD space. */
  nib: InflateNib,
  /**
   * PRESENT = this is a PREVIEW and the build may go off the main thread
   * (lib/implicit-surface.ts §7). ABSENT = build here and now, which is what
   * `buildExport` always does, so a GLB is never anything but the full
   * synchronous surface.
   */
  defer?: { slotKey: string; onSettled: (r: ImplicitBuildResult) => void } | null,
): {
  geometry: THREE.BufferGeometry | null
  stats: ImplicitBuildStats | null
  /** Smooth-min radius k in WORLD units (not the dial's fraction). */
  blendK: number
  /**
   * Field-space radius of a sample on a STRAIGHT stretch of stroke — i.e. the
   * base radius times the profile bulge, with the curvature swell at zero.
   * Published because it is the `r` in the closed-form armpit prediction
   * sqrt(2)*(r + k/6) that assert-inflate-fusion.mjs checks the fillet against.
   */
  baseRadius: number
  /** Round-cone primitives fed to the field. */
  primitiveCount: number
  /**
   * Per-triangle draw-in position, ascending, aligned with the geometry's index
   * buffer. See §6 of lib/implicit-surface.ts: this is what lets the reveal be a
   * `setDrawRange` instead of a rebuild-per-frame.
   */
  revealKeys: Float32Array | null
  /**
   * TRUE when `geometry` is the surface that was already on screen and a worker
   * is building the requested one. Not a failure — the frame the page keeps
   * instead of freezing for a second.
   */
  deferred: boolean
} {
  const empty = {
    geometry: null,
    stats: null,
    blendK: 0,
    baseRadius: 0,
    primitiveCount: 0,
    revealKeys: null,
    deferred: false,
  }
  if (centerlines.length === 0 || radiusXY <= 0 || radiusZ <= 0) return empty

  // Field-space radius of a sample = the loft's own effective semi-axis:
  // base radius × the profile's isotropic bulge × the curvature join swell.
  const bulgeScale = 1 + Math.max(0, Math.min(0.5, crossSectionBulge))
  const softness = Math.max(0, Math.min(1, joinSoftness))

  const caps: ImplicitCapsule[] = []
  for (let s = 0; s < centerlines.length; s++) {
    const pts = centerlines[s]
    if (pts.length < 2) continue
    const ink = inkProfiles[s]
    const radii = new Float32Array(pts.length)
    for (let i = 0; i < pts.length; i++) {
      // NO curvature join bulge here. That term exists to hide the pinch a
      // SWEPT tube gets on the inside of a tight turn; an exact distance field
      // cannot pinch, so applying it would only stamp a sphere at every bend.
      // The stylistic dwell in turns lives in the ink profile instead.
      radii[i] = radiusXY * bulgeScale * (ink ? ink[i] : 1)
    }
    for (let i = 0; i < pts.length - 1; i++) {
      caps.push({
        ax: pts[i].x,
        ay: pts[i].y,
        az: 0,
        bx: pts[i + 1].x,
        by: pts[i + 1].y,
        bz: 0,
        ra: radii[i],
        rb: radii[i + 1],
        group: s,
        order: i,
      })
    }
  }
  if (caps.length === 0) return empty

  /**
   * DRAW-IN ORDER — global arc position of each capsule's FAR end, 0..1.
   *
   * The convention has to be the one `filterStrokesByProgress` (viewport-3d)
   * uses, because that is what the reveal playhead means everywhere else in
   * this app: cumulative arc length walked stroke-major, over the total across
   * ALL strokes. Resampling a polyline adds points along its segments and does
   * not change its length, so the fractions computed here on the resampled
   * centrelines are the same fractions the old prefix-filter cut at.
   *
   * The FAR end, not the near end or the midpoint: a capsule is fully drawn
   * only once the pen has left it.
   */
  const capArc = new Float32Array(caps.length)
  {
    /* ⚠ MEASURED IN WORLD SPACE, NOT IN THE FIELD SPACE THESE POINTS LIVE IN.
     *
     * The centrelines here are pre-transformed by the nib's `A⁻¹`, which is
     * anisotropic — a stretch of `a` one way and `b` the other. So field arc
     * length is not world arc length, and the two disagree by up to `a/b`
     * LOCALLY even though they agree in total. `filterStrokesByProgress` in
     * `components/viewport-3d.tsx` keys the playhead on the WORLD arc of the raw
     * strokes, so a table built on the field arc puts the reveal edge in the
     * wrong place — measured at **5.03 % of the word's width** by
     * `assert-nib-contrast`'s sibling `assert-implicit-reveal.mjs`, against
     * 0.58 % with the nib off. On a draw-in that is the pen's nose sitting off
     * the ink it is drawing, which is the defect `docs/animation-toolset-map.md`
     * §6.2 flags in red.
     *
     * Mapping each segment through `A` before measuring it costs four multiplies
     * per sample and puts the table back in the space the playhead means. */
    const seg = (i0: { x: number; y: number }, i1: { x: number; y: number }) => {
      const dx = i1.x - i0.x
      const dy = i1.y - i0.y
      if (!nib.active) return Math.hypot(dx, dy)
      const u = (dx * nib.ca + dy * nib.sa) * nib.a
      const v = (-dx * nib.sa + dy * nib.ca) * nib.b
      return Math.hypot(u * nib.ca - v * nib.sa, u * nib.sa + v * nib.ca)
    }
    let totalLen = 0
    for (const pts of centerlines) {
      for (let i = 1; i < pts.length; i++) totalLen += seg(pts[i - 1], pts[i])
    }
    const inv = totalLen > 0 ? 1 / totalLen : 0
    let acc = 0
    let c = 0
    for (const pts of centerlines) {
      if (pts.length < 2) continue
      for (let i = 0; i < pts.length - 1; i++) {
        acc += seg(pts[i], pts[i + 1])
        capArc[c++] = acc * inv
      }
    }
  }

  const blendK = Math.max(0, inflateParams.blend) * radiusXY
  const resolution = Math.max(
    INFLATE_RESOLUTION_MIN,
    Math.min(INFLATE_RESOLUTION_MAX, inflateParams.resolution),
  )
  // Same "same body vs genuine crossing" threshold the loft's crossing bulge
  // uses: samples within ~3 radii of each other along the chain are one piece.
  const runGap = Math.max(4, Math.ceil((radiusXY * 3) / Math.max(sampleSpacing, 1e-9)))

  const fieldOpts = {
    blendK,
    cellSize: radiusXY / resolution,
    runGap,
    maxCells: INFLATE_MAX_FIELD_CELLS,
    audit: true,
    revealOrder: capArc,
  }
  // Un-scale Z: field space → world space. The loop that does it is now
  // `applyImplicitZAspect` so BOTH paths — this one and the worker's
  // completion handler — go through one copy of it.
  const zAspect = radiusZ / radiusXY

  let built: ImplicitBuildResult
  let deferred = false
  if (defer) {
    const r = polygoniseCapsuleFieldForSlot({
      slotKey: defer.slotKey,
      caps,
      opts: fieldOpts,
      zAspect,
      onSettled: defer.onSettled,
    })
    built = r
    deferred = r.deferred
  } else {
    built = polygoniseCapsuleField(caps, fieldOpts)
    if (built.geometry) applyImplicitZAspect(built.geometry, zAspect)
  }

  return {
    geometry: built.geometry,
    stats: built.stats,
    blendK,
    baseRadius: radiusXY * bulgeScale,
    primitiveCount: caps.length,
    revealKeys: built.revealKeys,
    deferred,
  }
}

/**
 * Final fallback: return Solid H3 unchanged. Reached only when the
 * stroke-volume tube path produces no tubes. Marks INFLATE_DEBUG so the
 * panel surfaces this clearly.
 */
function inflateFallbackToSolid(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
  solidParams: SolidParams,
  inputPts: number,
): StrokeMeshData[] {
  INFLATE_DEBUG.fallbackUsed = "YES"
  INFLATE_DEBUG.inflateMode = "SOLID_H3_PASSTHROUGH"
  INFLATE_DEBUG.spikeStrategyActive = "SOLID_H3_PASSTHROUGH"
  INFLATE_DEBUG.usesStrokeCenterline = "NO"
  INFLATE_DEBUG.inflateStrategy =
    "Fallback. STROKE_VOLUME_FIELD_INFLATE failed, returning Solid H3 unchanged. See failureReason."

  const coordScale = 3.0 / Math.max(canvasWidth, canvasHeight)
  const effectiveThicknessPx = computeSolidEffectiveThicknessPx(
    solidParams.thickness,
  )
  const effectiveDepth = computeSolidEffectiveDepth(solidParams.depth)
  const worldThickness = effectiveThicknessPx * coordScale
  const testStroke = strokesToTestStroke(strokes, canvasWidth, canvasHeight)

  let solidResult: MaskSolidResult
  try {
    solidResult = buildMaskSolid(
      testStroke,
      worldThickness,
      effectiveDepth,
      canvasWidth,
      canvasHeight,
    )
  } catch (e) {
    INFLATE_DEBUG.failureReason =
      (INFLATE_DEBUG.failureReason || "") +
      ` | fallback buildMaskSolid threw: ${(e as Error).message}`
    return []
  }
  const baseGeometry = solidResult.geometry
  if (!baseGeometry) {
    INFLATE_DEBUG.failureReason =
      (INFLATE_DEBUG.failureReason || "") +
      " | fallback Solid H3 returned null geometry"
    return []
  }
  baseGeometry.computeBoundingBox()
  INFLATE_DEBUG.inflateGeometryCreated = "YES"

  const meshData: StrokeMeshData = {
    tubeGeometry: baseGeometry,
    filteredCount: inputPts,
    key: `inflate-fallback-${strokes.length}-${canvasWidth}x${canvasHeight}-${effectiveDepth.toFixed(4)}`,
    mode: "inflate",
  }
  return [meshData]
}

/**
 * Shared static Inflate geometry builder.
 *
 * SINGLE SOURCE OF TRUTH for the full-stroke Inflate volume. Both
 * `InflateEngine.buildPreview` (static + animated reveal) and
 * `InflateEngine.buildExport` call this so the exported GLB is byte-for-byte
 * the same geometry the user sees in the preview. It receives the FULL
 * processed strokes (never animated/partial filtered strokes) and performs
 * the same calibration as Solid (coordScale + effectiveThickness + puffNorm).
 *
 * It is intentionally side-effect free except for returning everything the
 * callers need; it does NOT mutate INFLATE_DEBUG (callers own that).
 */
interface InflateStaticBuild {
  geometries: {
    geometry: THREE.BufferGeometry
    key: string
    strokeIndex: number
    filteredCount: number
    /** Ascending per-triangle draw-in position — implicit fusion only. */
    revealKeys?: Float32Array | null
  }[]
  // calibrated values (for debug + export metadata)
  inflateStrokeRadiusXY: number
  inflatePuffAspectZ: number
  radiusZ: number
  puffNorm: number
  profileExponent: number
  crossSectionBulge: number
  capRoundness: number
  ringSampleCount: number
  joinSoftness: number
  tangentSmoothingPasses: number
  totalSamples: number
  totalVerts: number
  totalTris: number
  bbox: THREE.Box3
  /** Which surface strategy actually produced `geometries`. */
  fusionUsed: InflateFusion
  /** Implicit-path diagnostics (null on the loft path). */
  implicitStats: ImplicitBuildStats | null
  /** Smooth-min radius k in world units (0 on the loft path). */
  implicitBlendK: number
  /** Field-space radius on a straight stretch (0 on the loft path). */
  implicitBaseRadius: number
  /** Round-cone primitive count (0 on the loft path). */
  implicitPrimitiveCount: number
  /** Non-empty when the implicit path was requested but could not deliver. */
  implicitFailure: string
  /** The nib this build swept with, and the width law it actually produced. */
  nib: InflateNib
  nibCensus: { min: number; max: number; mean: number; ratio: number; hairlineFrac: number }
}

function inflateBuildStaticGeometries(
  strokes: ProcessedStroke[],
  canvasWidth: number,
  canvasHeight: number,
  solidParams: SolidParams,
  inflateParams: InflateParams = DEFAULT_INFLATE_PARAMS,
  /** Forwarded to `inflateBuildImplicitGeometry`. Preview only — never export. */
  defer?: { slotKey: string; onSettled: (r: ImplicitBuildResult) => void } | null,
): InflateStaticBuild {
  // ---- Calibration (matches Solid's coord scale exactly) ----
  const coordScale = 3.0 / Math.max(canvasWidth, canvasHeight)
  const effectiveThicknessPx = computeSolidEffectiveThicknessPx(
    solidParams.thickness,
  )

  // ---- canvas-pixel → world-space ----
  const cw2 = canvasWidth / 2
  const ch2 = canvasHeight / 2
  const px2w = (px: number, py: number) => ({
    x: (px - cw2) * coordScale,
    y: -(py - ch2) * coordScale,
  })

  /* THE NIB, RESOLVED ONCE FOR THE WHOLE DRAWING — see `THE BROAD NIB` above.
   * §4.4's first caveat: `A` is one matrix for the whole word, because a nib
   * angle that drifts along a stroke breaks the change of variables. That is not
   * a compromise; the sibling doc's shared-draw rule wants pen posture to be one
   * draw per rendered instance for an independent reason. */
  const nib = inflateResolveNib(inflateParams)
  /* IN THE MEMO KEY, OR THE DIAL DOES NOTHING. `useStrokeMeshes` hands back the
   * cached mesh whenever the key matches, and every nib parameter changes the
   * SHAPE while changing neither the sample count nor the radii the old key was
   * built from — so without this a nib sweep renders the first arm four times
   * and reports it as four different settings. That is the exact shape of the
   * dead-dial defect this repo has caught before. */
  const nibKey = `n${nib.a.toFixed(4)}x${nib.b.toFixed(4)}@${nib.angleDeg}`
  /** canvas px → FIELD space: the world map, then `A⁻¹`. */
  const px2f = nib.active
    ? (px: number, py: number) => {
        const w = px2w(px, py)
        return inflateNibToField(w.x, w.y, nib)
      }
    : px2w

  // ---- decoupled controls ----
  // Width = stroke DIAMETER in canvas px → halve for radius, scale to world.
  const inflateStrokeRadiusXY = (effectiveThicknessPx * coordScale) / 2

  // Puff → Z aspect (cross-section roundness/pressure).
  const depthRange = SOLID_DEPTH_SLIDER_MAX - SOLID_DEPTH_SLIDER_MIN
  /* Puff reads the RAW slider, so it does not go through
   * `computeSolidEffectiveDepth` and needs the same NaN floor of its own —
   * `Math.min(1, Math.max(0, NaN))` is NaN, and a NaN `radiusZ` made 1264 of
   * 1266 positions non-finite on `tick/inflate`. */
  const puffNorm =
    depthRange > 0
      ? clampParam((solidParams.depth - SOLID_DEPTH_SLIDER_MIN) / depthRange, 0, 1)
      : 0.5
  const puffEased = Math.sqrt(puffNorm)
  const inflatePuffAspectZ = 0.34 + puffEased * 1.21 // 0.34 → 1.55
  const radiusZ = inflateStrokeRadiusXY * inflatePuffAspectZ

  // Profile shaping (drives the FEEL of Puff, not its size).
  const profileExponent = 2.1 + puffEased * 1.3 // 2.1 → 3.4
  const crossSectionBulge = 0.07 + puffEased * 0.21 // 0.07 → 0.28
  // Cap roundness is no longer a Puff-driven 0.6→1.0 squash of the end dome.
  // The dome is the terminal ball's spherical patch, so it is FULLY round by
  // construction — a shorter one is not a patch of that ball and cannot meet
  // the wall tangentially, which was part of the collar measured on every
  // Inflate fixture. Reported as 1 so the debug panel states the truth rather
  // than echoing a dial that no longer reaches the geometry.
  const capRoundness = 1
  const ringSampleCount = 28
  const tangentSmoothingPasses = 3
  const joinSoftness = 0.45 + puffEased * 0.4 // 0.45 → 0.85

  // ---- resample + sweep elliptical tube per stroke ----
  const sampleSpacing = Math.max(
    coordScale * 1.5,
    Math.min(inflateStrokeRadiusXY * 0.6, coordScale * 8),
  )

  const geometries: InflateStaticBuild["geometries"] = []
  let totalSamples = 0
  let totalVerts = 0
  let totalTris = 0
  const bbox = new THREE.Box3()

  // Phase 1: resample ALL centerlines first — the crossing bulge needs the
  // full set to detect stroke-vs-stroke and self-crossing proximity.
  const resampledAll: {
    si: number
    filteredCount: number
    pts: { x: number; y: number }[]
    /** Per-sample INK width multiplier (mean 1) — see inflateInkWidthProfile. */
    ink: Float32Array
    /** This stroke returns to its own start and is swept as a loop. */
    closed: boolean
  }[] = []
  let closedStrokeCount = 0
  for (let si = 0; si < strokes.length; si++) {
    const s = strokes[si]
    if (!s.points || s.points.length < 2) continue
    /* PRE-TRANSFORMED BEFORE RESAMPLING, NOT AFTER. §4.4's third caveat is that
     * "sampling density is measured in the wrong metric" if the resample runs on
     * the world centreline — a stroke travelling in the nib's thin direction
     * would be sampled as though it were its transformed length. Mapping first
     * makes the whole pipeline below — resample, closure test, ink profile,
     * crossing bulge, field cells — run in the one space where the pen is round,
     * which is the only space any of their constants were calibrated in. */
    const worldPts = s.points.map((p) => px2f(p.x, p.y))
    const resampled = inflateResampleCenterline(worldPts, sampleSpacing)
    if (resampled.length < 2) continue
    // Pressure is carried onto the resampled centerline by arc length. It may
    // well be a constant (a mouse reports 0.5); the profile builder detects
    // that and synthesises instead — see its header.
    const pressures = inflateResampleScalar(
      worldPts,
      s.points.map((p) => p.pressure),
      resampled,
    )
    /* CLOSED LOOPS. `loopEnds` decides whether a mark that returns to its own
     * start is finished with two end caps (the parked "capped" behaviour, which
     * sweeps two domes about the same point and measurably self-intersects) or
     * wrapped. Detection uses Extrude's ported threshold — see
     * `inflateChainIsClosed`. */
    const wantWrap = (inflateParams.loopEnds ?? "wrapped") === "wrapped"
    let pts = resampled
    let closed = wantWrap && inflateChainIsClosed(pts, inflateStrokeRadiusXY)
    if (closed) {
      // An exactly-closed loop repeats its first sample as its last. Keeping
      // both would leave a zero-length closing segment — the degenerate-tangent
      // case — so drop the repeat and let the wrap supply that neighbour. Only
      // an EXACT repeat is dropped; a genuine short closing chord is left alone
      // and swept like any other segment, so nothing about the drawn shape moves.
      // Extrude's seam-stub rule, ported whole (`dropSeamStub`): an exact
      // repeat AND the short remainder a pinned endpoint leaves behind both go,
      // because a swept body cannot turn a corner inside one short step without
      // folding. Dropping only the exact repeat is the incomplete half of the
      // fix, and Rod measured what that costs.
      pts = dropSeamStub(pts)
      if (pts.length < 4) {
        pts = resampled
        closed = false
      }
    }
    const pressuresForPts =
      pts === resampled || !pressures ? pressures : pressures.subarray(0, pts.length)
    const ink = inflateInkWidthProfile(
      pts,
      pressuresForPts,
      inflateStrokeRadiusXY * 2,
      closed,
    )
    if (closed) closedStrokeCount++
    resampledAll.push({ si, filteredCount: s.points.length, pts, ink, closed })
    totalSamples += pts.length
  }

  /* WHAT THE NIB GAVE THIS WORD, not what the dial asked for. Published so the
   * debug panel and the frame probes can quote a contrast that came off the
   * drawing's own direction census rather than off `a/b`. See the function's own
   * warning about what it can and cannot witness. */
  const nibCensus = inflateNibWidthCensus(
    resampledAll.map((r) => r.pts),
    nib,
  )

  // Phase 2: crossing/overlap pressure bulge (amplitude grows with Puff —
  // higher pressure fuses harder). Computed BEFORE the strategy is chosen,
  // even though the implicit path does not use it, because the embedding test
  // below has to see the radii the sweep would actually use — and the bulge
  // only ever makes a tube fatter, i.e. more likely to fold.
  const crossingBulgeAmp = 0.22 + puffEased * 0.18 // 0.22 → 0.40
  const bulgeMults = inflateComputeCrossingBulge(
    resampledAll.map((r) => r.pts),
    inflateStrokeRadiusXY,
    crossingBulgeAmp,
    resampledAll.map((r) => r.closed),
  )
  // The ink capsule profile multiplies INTO the crossing bulge, so the loft
  // gets the same tapered-mark shape the implicit field gets. Both surface
  // strategies must read as the same drawing.
  const strokeMults: Float32Array[] = resampledAll.map((r, ri) => {
    const raw = bulgeMults[ri]
    const mults = new Float32Array(raw.length)
    for (let i = 0; i < raw.length; i++) mults[i] = raw[i] * (r.ink[i] ?? 1)
    return mults
  })

  /* ---- THE EMBEDDING TEST, and the routing it drives --------------------
   * A swept tube is an embedded surface iff |r′| < 1 and r·κ < 1. Pruning
   * gives the first; nothing ever checked the second, and a mark that turns
   * inside its own radius makes the ring sweep fold back through itself. That
   * fold is not a tessellation artefact and no ring density removes it, so
   * where it is positive the loft is not an approximation of the right surface
   * — it is the wrong surface. `fusion: "auto"` sends those drawings to the
   * field, which computes the union of balls directly and cannot fold. */
  let loftFoldDepth = 0
  let loftFoldOverR = 0
  let loftFoldingPairs = 0
  let loftFoldStroke = -1
  for (let ri = 0; ri < resampledAll.length; ri++) {
    const { pts } = resampledAll[ri]
    const { rxy, rz } = inflateSampleRadii(
      pts,
      inflateStrokeRadiusXY,
      radiusZ,
      joinSoftness,
      strokeMults[ri],
    )
    const chain = inflateBuildBallChain(
      pts,
      rxy,
      rz,
      tangentSmoothingPasses,
      resampledAll[ri].closed,
    )
    if (!chain) continue
    const fm = inflateChainFoldMetric(chain, resampledAll[ri].closed)
    loftFoldingPairs += fm.foldingPairs
    if (fm.maxFoldDepth > loftFoldDepth || loftFoldStroke < 0) {
      loftFoldDepth = fm.maxFoldDepth
      loftFoldOverR = fm.maxFoldOverR
      loftFoldStroke = resampledAll[ri].si
    }
  }
  INFLATE_DEBUG.loftFoldDepth = loftFoldDepth
  INFLATE_DEBUG.loftFoldOverR = loftFoldOverR
  INFLATE_DEBUG.loftFoldingPairs = loftFoldingPairs
  INFLATE_DEBUG.loftFoldStroke = loftFoldStroke

  const wantImplicit =
    inflateParams.fusion === "implicit" ||
    (inflateParams.fusion === "auto" && loftFoldingPairs > 0)

  // ---- IMPLICIT FUSION PATH ---------------------------------------------
  // One field, one surface, for the WHOLE drawing. Returns a single geometry
  // instead of one per stroke. Falls back to the loft (below) if the
  // polygoniser produces nothing, so the user is never left with an empty
  // viewport because a dial was moved too far.
  let implicitStats: ImplicitBuildStats | null = null
  let implicitBlendK = 0
  let implicitBaseRadius = 0
  let implicitPrimitiveCount = 0
  let implicitFailure = ""
  if (wantImplicit && resampledAll.length > 0) {
    let built: ReturnType<typeof inflateBuildImplicitGeometry> = {
      geometry: null,
      stats: null,
      blendK: 0,
      baseRadius: 0,
      primitiveCount: 0,
      revealKeys: null,
      deferred: false,
    }
    try {
      built = inflateBuildImplicitGeometry(
        resampledAll.map((r) => r.pts),
        resampledAll.map((r) => r.ink),
        inflateStrokeRadiusXY,
        radiusZ,
        crossSectionBulge,
        joinSoftness,
        sampleSpacing,
        inflateParams,
        nib,
        defer,
      )
    } catch (e) {
      implicitFailure = `implicit threw: ${(e as Error).message}`
    }
    INFLATE_DEBUG.implicitDeferred = built.deferred ? "YES" : "NO"
    implicitStats = built.stats
    implicitBlendK = built.blendK
    implicitBaseRadius = built.baseRadius
    implicitPrimitiveCount = built.primitiveCount
    if (built.geometry) {
      const g = built.geometry
      /* FIELD → WORLD. Before the bbox union, because the bounds this returns
       * are what frames the camera. A deferred build hands back the PREVIOUS
       * mesh here, which already carries the stamp, so this is a no-op on it and
       * the worker's own result is transformed in `buildPreview`'s onSettled. */
      inflateApplyNibToGeometry(g, nib)
      const posAttr = g.getAttribute("position") as THREE.BufferAttribute | undefined
      if (posAttr) totalVerts += posAttr.count
      const idx = g.getIndex()
      if (idx) totalTris += idx.count / 3
      if (g.boundingBox) bbox.union(g.boundingBox)
      const st = built.stats
      geometries.push({
        geometry: g,
        strokeIndex: 0,
        filteredCount: resampledAll.reduce((a, r) => a + r.filteredCount, 0),
        // The key must change whenever ANY input to the field changes, or the
        // viewport memo will hand back a stale mesh. Sample count + radii +
        // dials + the resulting triangle count is a cheap, complete signature.
        key: `inflate-implicit-${resampledAll.length}-${totalSamples}-${inflateStrokeRadiusXY.toFixed(4)}-${radiusZ.toFixed(4)}-${inflateParams.blend.toFixed(3)}-${inflateParams.resolution.toFixed(2)}-${nibKey}-${st?.vertices ?? 0}-${st?.triangles ?? 0}`,
        revealKeys: built.revealKeys,
      })
      return {
        geometries,
        inflateStrokeRadiusXY,
        inflatePuffAspectZ,
        radiusZ,
        puffNorm,
        profileExponent,
        crossSectionBulge,
        capRoundness,
        ringSampleCount,
        joinSoftness,
        tangentSmoothingPasses,
        totalSamples,
        totalVerts,
        totalTris,
        bbox,
        fusionUsed: "implicit",
        implicitStats,
        implicitBlendK,
        implicitBaseRadius,
        implicitPrimitiveCount,
        implicitFailure,
        nib,
        nibCensus,
      }
    }
    if (!implicitFailure) implicitFailure = "implicit produced no geometry"
  }

  // Phase 3: sweep each tube with its per-sample radius multipliers.
  for (let ri = 0; ri < resampledAll.length; ri++) {
    const { si, filteredCount, pts } = resampledAll[ri]
    const mults = strokeMults[ri]

    let geometry: THREE.BufferGeometry | null = null
    try {
      // Field space in, field space out — the nib is applied below, once, to
      // whichever surface strategy produced the mesh.
      geometry = inflateBuildEllipticalTube(pts, inflateStrokeRadiusXY, radiusZ, {
        ringSegs: ringSampleCount,
        profileExponent,
        crossSectionBulge,
        tangentSmoothingPasses,
        joinSoftness,
        radiusMultipliers: mults,
        closed: resampledAll[ri].closed,
      })
    } catch {
      geometry = null
    }
    if (!geometry) continue
    inflateApplyNibToGeometry(geometry, nib)

    const posAttr = geometry.getAttribute("position") as
      | THREE.BufferAttribute
      | undefined
    if (posAttr) totalVerts += posAttr.count
    const idx = geometry.getIndex()
    if (idx) totalTris += idx.count / 3
    if (geometry.boundingBox) bbox.union(geometry.boundingBox)

    // The key must change when the bulge field changes (a NEW stroke crossing
    // an OLD one changes the old tube's radii), so fold in a cheap checksum.
    let multSum = 0
    for (let i = 0; i < mults.length; i++) multSum += mults[i]

    geometries.push({
      geometry,
      strokeIndex: si,
      filteredCount,
      key: `inflate-svfi-${si}-${pts.length}-${inflateStrokeRadiusXY.toFixed(4)}-${radiusZ.toFixed(4)}-${profileExponent.toFixed(2)}-${crossSectionBulge.toFixed(2)}-${capRoundness.toFixed(2)}-${joinSoftness.toFixed(2)}-${multSum.toFixed(3)}-${nibKey}`,
    })
  }

  return {
    geometries,
    inflateStrokeRadiusXY,
    inflatePuffAspectZ,
    radiusZ,
    puffNorm,
    profileExponent,
    crossSectionBulge,
    capRoundness,
    ringSampleCount,
    joinSoftness,
    tangentSmoothingPasses,
    totalSamples,
    totalVerts,
    totalTris,
    bbox,
    fusionUsed: "loft",
    implicitStats,
    implicitBlendK,
    implicitBaseRadius,
    implicitPrimitiveCount,
    implicitFailure,
    nib,
    nibCensus,
  }
}

/**
 * Copy the implicit-path measurements out of a build and into INFLATE_DEBUG.
 *
 * Shared by preview and export so a GLB's reported cost/topology is the same
 * report the debug panel showed for the mesh on screen — if these diverged,
 * "the export matches the preview" would be unverifiable.
 */
function inflateWriteFusionDebug(build: InflateStaticBuild): void {
  INFLATE_DEBUG.fusionUsed = build.fusionUsed
  INFLATE_DEBUG.blendRadiusK = build.implicitBlendK
  INFLATE_DEBUG.fieldBaseRadius = build.implicitBaseRadius
  INFLATE_DEBUG.fieldPrimitiveCount = build.implicitPrimitiveCount
  if (build.implicitFailure) {
    INFLATE_DEBUG.failureReason =
      (INFLATE_DEBUG.failureReason || "") + ` | ${build.implicitFailure}`
  }
  const st = build.implicitStats
  if (!st) return
  INFLATE_DEBUG.fieldCellSize = st.cellSize
  INFLATE_DEBUG.fieldGridX = st.nx
  INFLATE_DEBUG.fieldGridY = st.ny
  INFLATE_DEBUG.fieldGridZ = st.nz
  INFLATE_DEBUG.gridCellCount = st.totalCells
  INFLATE_DEBUG.fieldActiveCells = st.activeCells
  INFLATE_DEBUG.fieldSampleCount = st.fieldSamples
  INFLATE_DEBUG.fieldSdfEvals = st.sdfEvals
  INFLATE_DEBUG.fieldMeanCandidates = st.meanCandidates
  INFLATE_DEBUG.fieldMeanRuns = st.meanRuns
  INFLATE_DEBUG.meshBoundaryEdges = st.boundaryEdges
  INFLATE_DEBUG.meshNonManifoldEdges = st.nonManifoldEdges
  INFLATE_DEBUG.fieldCoarsened = st.coarsened ? "YES" : "NO"
  INFLATE_DEBUG.msFieldGrid = st.msGrid
  INFLATE_DEBUG.msMarchingCubes = st.msMarch
  INFLATE_DEBUG.msNormals = st.msNormals
  INFLATE_DEBUG.msFieldReveal = st.msReveal
  INFLATE_DEBUG.revealTriangleCount =
    build.geometries[0]?.revealKeys?.length ?? 0
  INFLATE_DEBUG.msImplicitTotal = st.msTotal
}

export const InflateEngine: GeometryEngine = {
  buildPreview(strokes: ProcessedStroke[], params: PreviewParams): StrokeMeshData[] {
    const { canvasWidth, canvasHeight, solidParams: sp } = params
    const solidParams = sp ?? DEFAULT_SOLID_PARAMS
    const inflateParams = params.inflateParams ?? DEFAULT_INFLATE_PARAMS
    const tBuild =
      typeof performance !== "undefined" ? performance.now() : Date.now()

    // ---- Reset all probes ----
    INFLATE_DEBUG.inflateMode = "STROKE_VOLUME_FIELD_INFLATE"
    INFLATE_DEBUG.spikeStrategyActive = "ELLIPTICAL_TUBE_LOFT_SPIKE"
    INFLATE_DEBUG.usesStrokeCenterline = "YES"
    INFLATE_DEBUG.inflateStrategy =
      "Build inflated stroke volume from the resampled centerline. Width = XY radius around centerline. Puff = Z aspect / cross-section roundness. Surface is an elliptical capsule swept along the path with smooth metaball-style end caps."
    INFLATE_DEBUG.usesRasterHeightfield = "NO"
    INFLATE_DEBUG.medialAxisSeamExpected = "NO"
    INFLATE_DEBUG.widthAffectsXY = "YES"
    INFLATE_DEBUG.puffAffectsZCrossSection = "YES"
    INFLATE_DEBUG.fallbackUsed = "NO"
    INFLATE_DEBUG.cameraFitUsesXYOnly = "YES"
    INFLATE_DEBUG.inflateEngineCalled = "YES"
    INFLATE_DEBUG.inflateBuildPreviewCalled = "YES"
    INFLATE_DEBUG.inflateGeometryCreated = "NO"
    INFLATE_DEBUG.widthSliderValue = solidParams.thickness
    INFLATE_DEBUG.puffSliderValue = solidParams.depth
    INFLATE_DEBUG.inflateStrokeRadiusXY = 0
    INFLATE_DEBUG.inflatePuffAspectZ = 0
    INFLATE_DEBUG.inflateRadiusZ = 0
    INFLATE_DEBUG.inflatePressure = 0
    INFLATE_DEBUG.crossSectionBulge = 0
    INFLATE_DEBUG.profileExponent = 0
    INFLATE_DEBUG.ringSampleCount = 0
    INFLATE_DEBUG.capRoundness = 0
    INFLATE_DEBUG.joinSoftness = 0
    INFLATE_DEBUG.tangentSmoothing = 0
    INFLATE_DEBUG.materialRoughness = 0
    INFLATE_DEBUG.materialMetalness = 0
    INFLATE_DEBUG.fieldResolution = 0
    INFLATE_DEBUG.smoothUnionStrength = 0
    INFLATE_DEBUG.sampleCount = 0
    INFLATE_DEBUG.strokeSampleCount = 0
    INFLATE_DEBUG.fieldSampleCount = 0
    INFLATE_DEBUG.gridCellCount = 0
    INFLATE_DEBUG.meshVertexCount = 0
    INFLATE_DEBUG.meshTriangleCount = 0
    INFLATE_DEBUG.bboxX = 0
    INFLATE_DEBUG.bboxY = 0
    INFLATE_DEBUG.bboxZ = 0
    INFLATE_DEBUG.failureReason = ""
    INFLATE_DEBUG.fusionRequested = inflateParams.fusion
    INFLATE_DEBUG.fusionUsed = "loft"
    INFLATE_DEBUG.blendFraction = inflateParams.blend
    INFLATE_DEBUG.resolutionDial = inflateParams.resolution
    INFLATE_DEBUG.blendRadiusK = 0
    INFLATE_DEBUG.fieldCellSize = 0
    INFLATE_DEBUG.fieldGridX = 0
    INFLATE_DEBUG.fieldGridY = 0
    INFLATE_DEBUG.fieldGridZ = 0
    INFLATE_DEBUG.fieldActiveCells = 0
    INFLATE_DEBUG.fieldSdfEvals = 0
    INFLATE_DEBUG.fieldMeanCandidates = 0
    INFLATE_DEBUG.fieldMeanRuns = 0
    INFLATE_DEBUG.fieldPrimitiveCount = 0
    INFLATE_DEBUG.fieldBaseRadius = 0
    INFLATE_DEBUG.meshBoundaryEdges = 0
    INFLATE_DEBUG.meshNonManifoldEdges = 0
    INFLATE_DEBUG.fieldCoarsened = "NO"
    INFLATE_DEBUG.msFieldGrid = 0
    INFLATE_DEBUG.msMarchingCubes = 0
    INFLATE_DEBUG.msNormals = 0
    INFLATE_DEBUG.msImplicitTotal = 0
    INFLATE_DEBUG.msBuildTotal = 0
    INFLATE_DEBUG.inputStrokeCount = strokes.length
    let inputPts = 0
    for (const s of strokes) inputPts += s.points?.length ?? 0
    INFLATE_DEBUG.inputPointCount = inputPts

    if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) {
      INFLATE_DEBUG.failureReason =
        strokes.length === 0 ? "no strokes" : "canvas 0"
      return []
    }

    // ---- Build the full-stroke static geometry via the SHARED builder ----
    // (Identical path used by buildExport, so preview === export.)
    //
    // THE SLOT. `defer` is what lets an expensive implicit rebuild go to a
    // worker while the mark already on screen keeps rendering
    // (lib/implicit-surface.ts §7). Its key identifies THE SURFACE, not its
    // dial values — that is the whole point: a dial change must land on the
    // same slot so the previous mark can be held, while a genuinely different
    // drawing must land on a NEW slot and therefore build synchronously with
    // nothing stale to show. Stroke count plus canvas size is that line:
    // wobble/endpoint/blend/resolution never move it, drawing or clearing a
    // stroke always does.
    let liveMeshes: StrokeMeshData[] | null = null
    const defer = {
      slotKey: `${canvasWidth}x${canvasHeight}|${strokes.length}`,
      onSettled: (r: ImplicitBuildResult) => {
        // Fires on the frame the worker's build was written into the live
        // geometry. The geometry object is unchanged (three re-uploads it on
        // the next render); what React cannot see, and therefore what has to be
        // patched by hand, is the draw-in's arc-length table — `AnimatedStrokes`
        // binary-searches `StrokeMeshData.revealKeys` every frame, and a table
        // sized for the previous triangle count would reveal the wrong amount.
        if (liveMeshes) {
          for (const m of liveMeshes) {
            if (m.mode === "inflate") m.revealKeys = r.revealKeys ?? undefined
          }
        }
        /* AND THE SECOND THING REACT CANNOT SEE — see
         * `IMPLICIT_REFILL_DROPS_STALE_ATTRS` for the full defect. The comment
         * above got `revealKeys` right and stopped one item short: a per-vertex
         * attribute written by a consumer (`aFsLetter`) also survives the
         * refill, describing the surface that was replaced, and once the new
         * build has MORE vertices than it, every draw that reaches past its end
         * is dropped whole by the driver. Dropped rather than resized: the new
         * polygonisation reorders every vertex, so the stale values are wrong at
         * every index even when the counts happen to agree. */
        if (r.geometry) {
          const dropped = dropStaleImplicitAttrs(r.geometry)
          INFLATE_DEBUG.staleAttrsDropped = dropped.join(",")
          if (dropped.length > 0) INFLATE_DEBUG.staleAttrDrops++
        }
        /* AND THE THIRD THING, WHICH IS THE SAME DEFECT ONE MORE TIME. The
         * worker's build is written into the SAME geometry object with a NEW
         * position array, in raw field space. Nothing downstream of here rebuilds
         * it, so if the nib is not applied on this edge the deferred surface
         * renders as the monoline while the synchronous one does not — two
         * different marks from one dial, decided by whether a worker was free.
         * `inflateApplyNibToGeometry` keys on the array object, so this is exact
         * whether the buffers are new or the ones it already transformed. */
        if (r.geometry) inflateApplyNibToGeometry(r.geometry, inflateResolveNib(inflateParams))
        const st = r.stats
        if (st) {
          INFLATE_DEBUG.meshVertexCount = st.vertices
          INFLATE_DEBUG.meshTriangleCount = st.triangles
          INFLATE_DEBUG.meshBoundaryEdges = st.boundaryEdges
          INFLATE_DEBUG.meshNonManifoldEdges = st.nonManifoldEdges
          INFLATE_DEBUG.msFieldGrid = st.msGrid
          INFLATE_DEBUG.msMarchingCubes = st.msMarch
          INFLATE_DEBUG.msNormals = st.msNormals
          INFLATE_DEBUG.msFieldReveal = st.msReveal
          INFLATE_DEBUG.msImplicitTotal = st.msTotal
          INFLATE_DEBUG.revealTriangleCount = r.revealKeys?.length ?? 0
        }
        INFLATE_DEBUG.msImplicitWorker = IMPLICIT_DEFER_DEBUG.lastWorkerMs
        INFLATE_DEBUG.implicitDeferApplied = IMPLICIT_DEFER_DEBUG.applied
        if (r.geometry) {
          r.geometry.computeBoundingBox()
          const bb = r.geometry.boundingBox
          if (bb) {
            INFLATE_DEBUG.bboxX = bb.max.x - bb.min.x
            INFLATE_DEBUG.bboxY = bb.max.y - bb.min.y
            INFLATE_DEBUG.bboxZ = bb.max.z - bb.min.z
          }
        }
      },
    }

    const build = inflateBuildStaticGeometries(
      strokes,
      canvasWidth,
      canvasHeight,
      solidParams,
      inflateParams,
      defer,
    )
    inflateWriteFusionDebug(build)

    // Mirror calibrated values into the debug probe.
    INFLATE_DEBUG.inflateStrokeRadiusXY = build.inflateStrokeRadiusXY
    INFLATE_DEBUG.inflatePuffAspectZ = build.inflatePuffAspectZ
    INFLATE_DEBUG.inflatePressure = build.puffNorm
    INFLATE_DEBUG.fieldResolution = 0
    INFLATE_DEBUG.smoothUnionStrength = 0
    INFLATE_DEBUG.inflateRadiusZ = build.radiusZ
    INFLATE_DEBUG.nibAspect = build.nib.aspect
    INFLATE_DEBUG.nibAngleDeg = build.nib.angleDeg
    INFLATE_DEBUG.nibWeight = build.nib.weight
    INFLATE_DEBUG.nibSemiMajor = build.nib.a
    INFLATE_DEBUG.nibSemiMinor = build.nib.b
    INFLATE_DEBUG.nibContrastBuilt = build.nibCensus.ratio
    INFLATE_DEBUG.nibMeanWidth = build.nibCensus.mean
    INFLATE_DEBUG.nibHairlineFrac = build.nibCensus.hairlineFrac
    INFLATE_DEBUG.profileExponent = build.profileExponent
    INFLATE_DEBUG.crossSectionBulge = build.crossSectionBulge
    INFLATE_DEBUG.capRoundness = build.capRoundness
    INFLATE_DEBUG.ringSampleCount = build.ringSampleCount
    INFLATE_DEBUG.joinSoftness = build.joinSoftness
    INFLATE_DEBUG.tangentSmoothing = build.tangentSmoothingPasses
    // Material is a soft, low-spec gel/balloon (set in viewport-3d.tsx).
    INFLATE_DEBUG.materialRoughness = 0.62
    INFLATE_DEBUG.materialMetalness = 0.0
    INFLATE_DEBUG.sampleCount = build.totalSamples
    INFLATE_DEBUG.strokeSampleCount = build.totalSamples
    // Tube-loft spike has no 3D field — fieldSampleCount stays 0.
    INFLATE_DEBUG.fieldSampleCount = 0
    INFLATE_DEBUG.meshVertexCount = build.totalVerts
    INFLATE_DEBUG.meshTriangleCount = build.totalTris

    if (build.geometries.length === 0) {
      INFLATE_DEBUG.failureReason =
        INFLATE_DEBUG.failureReason || "no tubes produced"
      return inflateFallbackToSolid(
        strokes,
        canvasWidth,
        canvasHeight,
        solidParams,
        inputPts,
      )
    }

    const meshes: StrokeMeshData[] = build.geometries.map((g) => ({
      tubeGeometry: g.geometry,
      filteredCount: g.filteredCount,
      key: g.key,
      mode: "inflate",
      revealKeys: g.revealKeys ?? undefined,
    }))
    // Hand the array to the slot's completion callback. Assigned AFTER the
    // build, which is safe in both directions: a synchronous build has already
    // called `onSettled` (with nothing to patch, because its `revealKeys` are
    // in `g.revealKeys` above), and a deferred one cannot land before this
    // function returns.
    liveMeshes = meshes

    if (!build.bbox.isEmpty()) {
      INFLATE_DEBUG.bboxX = build.bbox.max.x - build.bbox.min.x
      INFLATE_DEBUG.bboxY = build.bbox.max.y - build.bbox.min.y
      INFLATE_DEBUG.bboxZ = build.bbox.max.z - build.bbox.min.z
    }
    INFLATE_DEBUG.inflateGeometryCreated = "YES"
    INFLATE_DEBUG.msBuildTotal =
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - tBuild
    return meshes
  },

  buildExport(strokes: ProcessedStroke[], params: ExportParams): ExportResult {
    // Inflate export = the FULL static Inflate model. It calls the exact same
    // shared geometry builder the preview uses (`inflateBuildStaticGeometries`)
    // with the FULL processed strokes — never animated/partial filtered
    // strokes — so the exported GLB matches the static preview 1:1.
    const { canvasWidth, canvasHeight, solidParams: sp } = params
    const solidParams = sp ?? DEFAULT_SOLID_PARAMS
    const inflateParams = params.inflateParams ?? DEFAULT_INFLATE_PARAMS

    const exportMaterial = createExportMaterial(params)
    const disposables: THREE.BufferGeometry[] = []

    const rootGroup = new THREE.Group()
    rootGroup.name = "FreeStroke"

    // Empty input → non-crashing empty group (matches other modes' guard).
    if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) {
      exportMaterial.dispose()
      rootGroup.userData = { app: "Free Stroke", mode: "inflate", empty: true }
      return { group: rootGroup, disposables, objectCount: 0, merged: false }
    }

    const build = inflateBuildStaticGeometries(
      strokes,
      canvasWidth,
      canvasHeight,
      solidParams,
      inflateParams,
    )
    inflateWriteFusionDebug(build)

    // Fallback: if the loft produced nothing, export the Solid silhouette so
    // the user still gets a non-empty model (parity with preview's fallback).
    let fallbackUsed = false
    if (build.geometries.length === 0) {
      fallbackUsed = true
      exportMaterial.dispose()
      const solidExport = SolidEngine.buildExport(strokes, params)
      solidExport.group.userData = {
        ...solidExport.group.userData,
        mode: "inflate",
        inflateStrategy: "SOLID_H3_PASSTHROUGH_FALLBACK",
        fallbackUsed: true,
      }
      return solidExport
    }

    // Center the whole model at the origin (same convention as Solid export):
    // translate every geometry by the aggregate bbox center.
    const center = new THREE.Vector3()
    if (!build.bbox.isEmpty()) build.bbox.getCenter(center)

    let added = 0
    for (const g of build.geometries) {
      const geometry = g.geometry
      geometry.translate(-center.x, -center.y, -center.z)
      const mesh = new THREE.Mesh(geometry, exportMaterial)
      mesh.name = `inflate_${String(added).padStart(3, "0")}`
      rootGroup.add(mesh)
      disposables.push(geometry)
      added++
    }

    rootGroup.userData = {
      app: "Free Stroke",
      mode: "inflate",
      exportedAt: new Date().toISOString(),
      strokeCount: params.strokeCount,
      totalPoints: params.totalPoints,
      ...exportMaterialMeta(params),
      inflateStrategy:
        build.fusionUsed === "implicit"
          ? "IMPLICIT_SDF_FUSION / ROUND_CONE + CUBIC_SMIN + MARCHING_CUBES"
          : "STROKE_VOLUME_FIELD_INFLATE / ELLIPTICAL_TUBE_LOFT",
      fusionMode: build.fusionUsed,
      fallbackUsed,
      vertexCount: build.totalVerts,
      triangleCount: build.totalTris,
      settings: {
        ...params.settings,
        // Width / Puff (raw slider values) + calibrated geometry values.
        inflateThickness: solidParams.thickness,
        inflatePuff: solidParams.depth,
        inflateStrokeRadiusXY: build.inflateStrokeRadiusXY,
        inflatePuffAspectZ: build.inflatePuffAspectZ,
        inflateRadiusZ: build.radiusZ,
        // Fusion dials — so a downloaded GLB records how it was made.
        inflateFusion: build.fusionUsed,
        inflateBlend: inflateParams.blend,
        inflateResolution: inflateParams.resolution,
        ...(build.implicitStats
          ? {
              implicitCellSize: build.implicitStats.cellSize,
              implicitGrid: [
                build.implicitStats.nx,
                build.implicitStats.ny,
                build.implicitStats.nz,
              ],
              implicitBoundaryEdges: build.implicitStats.boundaryEdges,
              implicitNonManifoldEdges: build.implicitStats.nonManifoldEdges,
              implicitBuildMs: build.implicitStats.msTotal,
            }
          : {}),
      },
    }

    exportMaterial.dispose()

    return {
      group: rootGroup,
      disposables,
      objectCount: added,
      merged: false,
    }
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
