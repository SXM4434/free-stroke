// ─── adapter — Free Stroke's GeometryEngine, implemented on Desk Doodles ────
//
// This is the ONE file in lib/dd-engine/ that is Free Stroke's own code. Every
// other file here is a Desk Doodles file copied across (see README.md). The
// port rule for this directory is: adapt at the boundary, never inside the
// port. So all the framework glue lives here.
//
// WHAT IT DOES
//
//   Free Stroke's viewport talks to `GeometryEngine`:
//       buildPreview(ProcessedStroke[], PreviewParams) -> StrokeMeshData[]
//       buildExport (ProcessedStroke[], ExportParams)  -> ExportResult
//   Desk Doodles' engine talks in `StrokeInputPoint[][]` and returns
//   `StrokeGeometryResult`. This file is the translation, nothing more.
//
// ── THE COORDINATE DECISION, AND WHY IT IS THE WAY IT IS ────────────────────
//
// The two apps do not agree on how big a world unit is:
//
//   Free Stroke  normScale = 3 / max(canvasW, canvasH)     (long side -> 3u)
//   Desk Doodles WORLD_SCALE = 0.01                        (800px -> 8u)
//
// There are two ways to reconcile that, and only one of them is a port.
//
//   (a) Feed Desk Doodles' normalizer Free Stroke's scale.  REJECTED. Their
//       tuning is a web of ABSOLUTE world lengths, and most of them are
//       module-private with no option to override: ROD_RESAMPLE_SPACING 0.04,
//       DEDUPE_MIN_DIST 0.00267, MIN_EXTRUDE_AREA 0.005, SOLID_MIN_LOOP_AREA,
//       the CLOSE_GAP_PX * WORLD_SCALE world-closure test, INFLATE's
//       MAX_BASE_TO_LENGTH clamp. Running their code at 1/3 of the world scale
//       it was tuned at silently changes what counts as a duplicate point, a
//       closed loop, a degenerate area and a corner. That is not their engine
//       any more — it is their engine mistuned, which is exactly the failure
//       mode this port exists to avoid.
//
//   (b) Run the whole pipeline in THEIR world units, then apply ONE uniform
//       scale to the finished geometry.  CHOSEN. Every internal relationship —
//       radius vs resample spacing, ink radius vs grid cell, bevel vs depth —
//       is preserved exactly, and the form simply arrives at Free Stroke's
//       framing size. The scale is
//
//           k = (3 / max(w, h)) / WORLD_SCALE  =  300 / max(w, h)
//
//       which on a ~1000px canvas is 0.3 — the same DD->FS factor
//       docs/research/extrude-solid-quality.md derived independently, and the
//       exact inverse of the 8/3 Desk Doodles used when it took Rod FROM Free
//       Stroke (strokeTo3d.ts:116-122: "All ABSOLUTE world lengths convert
//       x8/3; radius-RELATIVE factors port verbatim").
//
// Centering matches Free Stroke's convention: both normalize about the CANVAS
// centre, not the stroke bbox, so a form sits where Free Stroke's camera
// expects it. (Desk Doodles' poolCenter is available and is what its own desk
// uses; using it here would shift every form off Free Stroke's framing.)
//
// ── WHICH DIALS ARE HONOURED ────────────────────────────────────────────────
//
// Three Free Stroke dials have a genuine Desk Doodles counterpart and are
// translated: the Solid thickness dial drives BOTH their Solid `inkRadius` and
// their Inflate `baseRadius` (see inflateBaseRadiusDD for why the second one is
// not optional), and Extrude/Solid depth drives their `depth`. Everything else
// runs at Desk Doodles' own tuned defaults, because the point of the comparison
// is to see THEIR calibration.
//
// Free Stroke's Inflate dials (fusion / blend / MC resolution) belong to its
// implicit-surface fusion and have no Desk Doodles analogue at all — the DD
// Inflate is a swept variable-radius capsule, so those three are ignored here
// rather than mapped onto something they do not mean.
//
// The rule for what gets translated and what stays is Desk Doodles' own, from
// the header of the file it applied it in: ABSOLUTE world lengths convert,
// radius-RELATIVE factors port verbatim (strokeTo3d.ts:116-122). So their tip
// FRACTION, their profile exponent, their pressure influence, their joint
// angle, their dedup factors and their cap inset all come across untouched;
// only the two absolute ink weights are re-anchored to the dial.
import * as THREE from "three"

import {
  DEDUPE_MIN_DIST,
  DEFAULT_VIEWBOX,
  INFLATE_BASE_RADIUS,
  INFLATE_TIP_RADIUS,
  RDP_EPSILON,
  ROD_RADIUS,
  WORLD_SCALE,
  buildExtrudeGeometry,
  buildInflateGeometry,
  buildPoolSolidGeometry,
  buildRodGeometry,
  extractPressures,
  isClosedStroke,
  normalizeStrokePoints,
  rdpPoints,
  type ExtrudeBevelProfile,
  type ExtrudeSideWall,
  type SolidEdge,
  type StrokeInputPoint,
  type ViewBoxSize,
} from "./strokeTo3d"

import {
  DEFAULT_EXTRUDE_PARAMS,
  DEFAULT_INFLATE_PARAMS,
  DEFAULT_SOLID_PARAMS,
  computeSolidEffectiveDepth,
  computeSolidEffectiveThicknessPx,
  inflateApplyNibToGeometry,
  inflateNibToField,
  inflateResolveNib,
  type ExportParams,
  type ExportResult,
  type GeometryEngine,
  type GeometryMode,
  type InflateNib,
  type PreviewParams,
  type StrokeMeshData,
} from "@/lib/geometry-engines"
import type { ProcessedStroke } from "@/lib/stroke-processing"
import { strokeArcSpans } from "@/lib/pen-reveal"

/* ------------------------------------------------------------------ */
/*  Tunables that belong to the ADAPTER, not to either engine          */
/* ------------------------------------------------------------------ */

/**
 * Desk Doodles' Tier-2 look families, at their shipped defaults.
 *
 * `rounded` is the 3-segment curved bevel band their own note calls the
 * "pressed cookie" read (strokeTo3d.ts:166); `eased` is the Solid equivalent.
 * They are surfaced here as a single object so a future dial can drive them
 * without touching the port.
 */
export const DD_LOOK_DEFAULTS: {
  bevelProfile: ExtrudeBevelProfile
  sideWall: ExtrudeSideWall
  solidEdge: SolidEdge
} = {
  bevelProfile: "rounded",
  sideWall: "straight",
  solidEdge: "eased",
}

/* ------------------------------------------------------------------ */
/*  Coordinate bridge                                                 */
/* ------------------------------------------------------------------ */

/** DD world units -> Free Stroke world units. See the header. */
function ddToFsScale(canvasWidth: number, canvasHeight: number): number {
  return 3 / Math.max(canvasWidth, canvasHeight) / WORLD_SCALE
}

/** Free Stroke's ProcessedStroke -> Desk Doodles' StrokeInputPoint tuples.
 *  Pressure rides index 2 exactly as their `extractPressures` expects; a point
 *  with no pressure is emitted as a bare [x, y] pair so `extractPressures`
 *  can still report "no channel at all" and let the curvature synth fire. */
function toInputPoints(stroke: ProcessedStroke): StrokeInputPoint[] {
  return stroke.points.map((p) =>
    typeof p.pressure === "number"
      ? ([p.x, p.y, p.pressure] as StrokeInputPoint)
      : ([p.x, p.y] as StrokeInputPoint),
  )
}

/** Scale a finished DD geometry into Free Stroke's world, in place. */
function scaleGeometry(geo: THREE.BufferGeometry, k: number): THREE.BufferGeometry {
  if (k !== 1) geo.scale(k, k, k)
  return geo
}

/* ==================================================================== *
 *  THE BROAD NIB, CARRIED ACROSS                                       *
 * ==================================================================== *
 *
 * ── THE DEFECT THIS CLOSES, MEASURED BEFORE IT WAS WRITTEN ────────────
 *
 * N6 landed the broad nib on Free Stroke's Inflate on 2026-08-28 and filmed
 * BOTH engine families before and after. `free-stroke` moved. `desk-doodles`
 * came back byte-identical — 28 131 ink at the settled solid, the same seven
 * counters, `docs/verification/nib-2026-08-28/{before,after}/desk-doodles/
 * measure.json` frames 38-45 — because this file read `solidParams` and
 * `extrudeParams` and never `inflateParams`. `docs/RUN-QUEUE.md` F34.
 *
 * That is the family Sebs named: *"the desk doodles like its all kind of crappy
 * and the way it writes in is ass still."* The half of the beat he complained
 * about by name was the half still swept by a round pen.
 *
 * ── ROUTED, NOT REIMPLEMENTED ─────────────────────────────────────────
 *
 * `inflateResolveNib`, `inflateNibToField` and `inflateApplyNibToGeometry` are
 * imported from `lib/geometry-engines.ts`. A second copy of an affine change of
 * variables is exactly the parallel-implementation defect this repo pays for
 * most often, and the two families have to be ONE pen or the engine switch
 * stops comparing engines and starts comparing pens.
 *
 * The map is `stroke-width-models.md` §4.3: pre-transform the centreline by
 * `A⁻¹`, sweep the round cross-section the port already builds, map the finished
 * vertices back by `A` (and normals by `A⁻ᵀ`, which for a symmetric `A` is `A⁻¹`
 * again). Nothing inside `strokeTo3d.ts` is touched — the port rule for this
 * directory is adapt at the boundary, and the boundary is here.
 *
 * ── WHY THE SIGNS NEED NO TRANSLATION ─────────────────────────────────
 *
 * `inflateResolveNib` negates the dial's canvas angle because Free Stroke's
 * `px2w` flips y. `normalizeStrokePoints` (strokeTo3d.ts:532) writes
 * `-(y - cy) * scale` — the SAME flip — so Desk Doodles' world space has Free
 * Stroke's handedness and the resolved nib drops straight in. The one remaining
 * transform between them, `ddToFsScale`, is a positive scalar, and a scalar
 * commutes with `A`. Getting this wrong would mirror the solid's pen against the
 * flat register's, which renders as two hands in one beat.
 *
 * ── INFLATE ONLY, AND THAT IS THE SAME SCOPE FREE STROKE HAS ──────────
 *
 * Free Stroke applies the nib in `inflateBuildStatic` and nowhere else. Rod,
 * Extrude and Solid stay round in both families, so the engine switch keeps
 * comparing like with like in the three modes that never had a nib.
 */

/** The centreline, pre-transformed into the space where the pen is round. */
function nibFieldPoints(world: THREE.Vector3[], nib: InflateNib): THREE.Vector3[] {
  return world.map((v) => {
    const f = inflateNibToField(v.x, v.y, nib)
    return new THREE.Vector3(f.x, f.y, v.z)
  })
}

/**
 * FIELD ARC FRACTION → WORLD ARC FRACTION, and this is not optional.
 *
 * ⚠ THE EXACT DEFECT N6 SHIPPED AND THEN CAUGHT BY MEASUREMENT. Its first build
 * left the draw-in's arc table in field space and `assert-implicit-reveal` went
 * 0.58 % → 5.03 % of word width — the pen's nose off the ink it is drawing.
 *
 * Both Desk Doodles builders that Inflate can produce write the curve parameter
 * into uv.V and both walk their centreline with `getPointAt`, which is
 * ARC-LENGTH parametrised (`bakeRevealKeys`'s own block says so). After the
 * pre-transform that arc length is measured in FIELD space, where `A` has
 * stretched one axis by √aspect and squeezed the other by the same factor. The
 * reveal then plays the stroke at the wrong rate wherever it changes direction.
 *
 * MEASURED ON THE HERO WORD at the shipped aspect 1.8 / 30°: the worst
 * disagreement between a field arc fraction and its world arc fraction is
 * **13.62 % of that stroke's own length** (stroke 9, 222 units — about thirty
 * units, more than one nib diameter of misplaced pen). Nine of the twenty-two
 * are at 0.00 %, and they are the stubs, whose direction never changes.
 *
 * The remap is a property of the CURVE, not of the builder's sampling of it, so
 * it is evaluated on a dense sampling of the same centripetal Catmull-Rom the
 * port builds (strokeTo3d.ts:1095) and interpolated. `dedupeConsecutive` cannot
 * move it: it drops points closer than DEDUPE_MIN_DIST, 0.00267 world units,
 * which is three orders below the mark's own radius.
 */
function nibArcRemap(fieldPts: THREE.Vector3[], nib: InflateNib): ((u: number) => number) | null {
  const pts: THREE.Vector3[] = []
  for (const v of fieldPts) {
    const prev = pts[pts.length - 1]
    if (!prev || prev.distanceToSquared(v) > DEDUPE_MIN_DIST * DEDUPE_MIN_DIST) pts.push(v)
  }
  if (pts.length < 2) return null
  let curve: THREE.CatmullRomCurve3
  try {
    curve = new THREE.CatmullRomCurve3(pts, false, "centripetal", 0.5)
    if (!(curve.getLength() > 0)) return null
  } catch {
    return null
  }
  /* 256 is the port's own INFLATE_MAX_SEGMENTS, so the table is never coarser
   * than the mesh it corrects. */
  const N = 256
  const world: { x: number; y: number }[] = []
  for (let i = 0; i <= N; i++) {
    const p = curve.getPointAt(i / N)
    /* FIELD → WORLD is `A`, which is `inflateNibToField` with the semi-axes
     * multiplied rather than divided. Written out here rather than exported as a
     * fifth helper: it is four lines and it is the inverse of the line above. */
    const u = (p.x * nib.ca + p.y * nib.sa) * nib.a
    const v = (-p.x * nib.sa + p.y * nib.ca) * nib.b
    world.push({ x: u * nib.ca - v * nib.sa, y: u * nib.sa + v * nib.ca })
  }
  const cum = new Float64Array(N + 1)
  for (let i = 1; i <= N; i++) {
    cum[i] = cum[i - 1] + Math.hypot(world[i].x - world[i - 1].x, world[i].y - world[i - 1].y)
  }
  const total = cum[N]
  if (!(total > 0)) return null
  for (let i = 0; i <= N; i++) cum[i] /= total
  return (u: number) => {
    if (!(u > 0)) return 0
    if (u >= 1) return 1
    const f = u * N
    const i = Math.min(N - 1, Math.floor(f))
    const t = f - i
    return cum[i] + (cum[i + 1] - cum[i]) * t
  }
}

/** Rewrite uv.V in place through the field→world arc remap. Every consumer of
 *  the along-curve coordinate — `bakeRevealKeys` and any texture that reads it —
 *  then agrees with the mark that is actually on screen. */
function remapGeometryArcUV(geo: THREE.BufferGeometry, remap: (u: number) => number): boolean {
  const uv = geo.getAttribute("uv") as THREE.BufferAttribute | undefined
  if (!uv) return false
  for (let i = 0; i < uv.count; i++) uv.setY(i, remap(uv.getY(i)))
  uv.needsUpdate = true
  return true
}

/** `A` on a world-space point that came out of the field build — caps, joints. */
function nibToWorldVec(v: THREE.Vector3, nib: InflateNib): THREE.Vector3 {
  const u = (v.x * nib.ca + v.y * nib.sa) * nib.a
  const w = (-v.x * nib.sa + v.y * nib.ca) * nib.b
  return new THREE.Vector3(u * nib.ca - w * nib.sa, u * nib.sa + w * nib.ca, v.z)
}

interface BuiltStroke {
  geometry: THREE.BufferGeometry
  /** True when Desk Doodles produced a ROD — either because rod was asked for,
   *  or because their Extrude/Inflate honest-degradation path fell back to one
   *  (an open or self-intersecting outline can't be filled: the LOW-3 guard).
   *  The viewport renders cap and joint spheres only for mode "rod", so this is
   *  what decides the reported mode, NOT the presence of caps — a CLOSED rod is
   *  still a rod and still wants its joint spheres, it just has no ends. */
  isRod: boolean
  /** Only rod produces these. UNDEFINED, never [], when the rod is closed.
   *
   *  Desk Doodles returns `capPositions: []` for a closed loop (buildRodGeometry
   *  fills them only inside `if (!canClose)`), whereas Free Stroke's RodEngine
   *  always returns exactly two. The viewport takes Free Stroke's contract at
   *  its word — `if (endCap && strokeMeshData.capPositions) endCap.position.copy(
   *  strokeMeshData.capPositions[1])` — and an empty array is truthy, so `[1]`
   *  is undefined and `.copy()` throws "Cannot read properties of undefined
   *  (reading 'x')" EVERY FRAME. That kills the render loop silently: the canvas
   *  keeps its last good frame, so a capture script happily writes a folder of
   *  identical stale PNGs that look exactly like evidence. Collapsing the empty
   *  array to undefined at the boundary is the whole fix, and it belongs here
   *  rather than in the port or in the viewport. */
  capPositions?: THREE.Vector3[]
  jointPositions?: THREE.Vector3[]
  capRadius?: number
  /** TubeGeometry keeps the curve it was swept along in `parameters.path`,
   *  which is the exact centripetal Catmull-Rom `buildRodGeometry` built from
   *  its own dense resample. Reusing it is how the reveal animation gets a
   *  correct arc-length mapping without re-deriving their private resampler.
   *  It stays in DD units — every consumer uses it as a ratio (distFrac *
   *  getLength() -> getUtoTmapping), which is scale-invariant. */
  curve?: THREE.CatmullRomCurve3
  ringArcFracs?: number[]
}

/* ------------------------------------------------------------------ */
/*  Per-stroke builders                                               */
/* ------------------------------------------------------------------ */

function buildOneStroke(
  stroke: ProcessedStroke,
  mode: GeometryMode,
  viewBox: ViewBoxSize,
  k: number,
  depthDD: number,
  inflateBaseDD: number,
  /** The resolved nib, or null for the round pen. Inflate only — see THE BROAD
   *  NIB, CARRIED ACROSS. */
  nib: InflateNib | null,
): BuiltStroke | null {
  const raw = toInputPoints(stroke)
  if (raw.length < 2) return null

  // Desk Doodles simplifies in VIEWBOX space first — RDP_EPSILON 3.0 is a
  // viewBox-pixel epsilon, and every closure threshold downstream is
  // calibrated against post-RDP anchors. Doing it in world space would change
  // what the epsilon means. rdpPoints carries pressure (index 2) through.
  const simplified = rdpPoints(raw, RDP_EPSILON)
  const world = normalizeStrokePoints(simplified, viewBox, WORLD_SCALE)
  if (world.length < 2) return null

  if (mode === "extrude") {
    const res = buildExtrudeGeometry(world, {
      depth: depthDD,
      rodRadius: ROD_RADIUS,
      bevelProfile: DD_LOOK_DEFAULTS.bevelProfile,
      sideWall: DD_LOOK_DEFAULTS.sideWall,
    })
    // Their extrude falls back to Rod on an open or self-intersecting
    // outline (the LOW-3 guard). That is real behaviour, not a failure —
    // surface it as a rod so the caps/joints still render.
    if (res.kind === "rod") return rodResultToBuilt(res, k)
    return { geometry: scaleGeometry(res.geometry, k), isRod: false }
  }

  if (mode === "inflate") {
    /* THE PRE-TRANSFORM. `A⁻¹` on the centreline, then the port's own round
     * sweep, then `A` on the vertices. Two of the port's inputs are measured on
     * whatever centreline it is handed — `baseRadius` is clamped to
     * `arcLen × INFLATE_MAX_BASE_TO_LENGTH` (strokeTo3d.ts:1100) and the
     * curvature `synthPressures` fallback (:1087) — so both read field space
     * here. That is inherent to a change of variables and Free Stroke's own
     * Inflate resamples in field space for the same reason
     * (stroke-width-models.md §4.4, caveat 3); `det A = 1`, so neither drifts by
     * more than the √aspect the nib exists to introduce. */
    const pen = nib && nib.active ? nib : null
    const centre = pen ? nibFieldPoints(world, pen) : world
    const res = buildInflateGeometry(centre, {
      baseRadius: inflateBaseDD,
      // Their TIP FRACTION, not their tip radius. INFLATE_TIP_RADIUS is an
      // absolute 0.035 that only reads correctly against their absolute
      // INFLATE_BASE_RADIUS of 0.22 — 16% of the base. Rescaling the base
      // without rescaling the tip would leave a 32% tip and kill the taper,
      // so the RATIO ports and the absolute does not. Their own header states
      // the rule: "All ABSOLUTE world lengths convert; radius-RELATIVE factors
      // port verbatim" (strokeTo3d.ts:116-122).
      tipRadius: inflateBaseDD * (INFLATE_TIP_RADIUS / INFLATE_BASE_RADIUS),
      pressures: extractPressures(simplified),
      rodRadius: ROD_RADIUS,
      /* THE CLOSURE THE ROD PATH WAS ALREADY BEING TOLD ABOUT. Twenty lines
       * down, `buildRodGeometry` gets `closed: isClosedStroke(simplified)` and
       * Inflate got nothing, so a loop was swept as a stroke with two ends and
       * tapered to 16 % width at both of them. On the hero's first `o` that
       * split the ring visibly open once F70 pulled its two ends back together
       * to 7 px — two ends at 16 % width cannot bridge that. One adapter, one
       * answer, and the same value the rod path already gets.
       *
       * ── AND THE TAPER SPAN IS DELIBERATELY NOT PASSED ─────────────────────
       *
       * `buildInflateGeometry` also takes `taperSpanDiameters`, which bounds
       * the end zone the way Free Stroke's `INFLATE_TAPER_SPAN_DIAMETERS` does
       * — the fix for the PINCH a cold Codex read named on the shipped AB:
       * *"the stem narrows sharply where it leaves the crossing."* It is built,
       * it is gated (`scripts/verify/assert-taper-port.mjs`), and it is
       * measured: the hero stem goes from **6 px leaving the crossing against
       * an 18 px plateau to a flat 17/18**, and the port's thin fraction drops
       * from 65.4 % of every stroke to 20.2 % over 2u, landing on Free
       * Stroke's own 21.8 %.
       *
       * It is NOT adopted here, and the reason is a number rather than a
       * feeling. It adds 24.8 % ink to this family (28 569 -> 36 440 px on the
       * hero word) and `assert-nib-contrast`'s per-counter row goes RED on
       * desk-doodles: the worst single counter, the `e` of "Doodles", drops
       * from **33.0 % to 4.1 %** of what the round pen keeps — 775 texels to
       * 32. Free Stroke survives the same change at 48.7 % because its Inflate
       * fuses strokes into one implicit field and this engine fuses nothing.
       * Measured both ways on 2026-08-28: with `closed` alone the row is green
       * at 33.0 %, with the span it is red at 4.1 %.
       *
       * So the two families sharing a taper span is a LOOK call with a
       * legibility cost attached, and this file is not where that gets decided.
       * See docs/verification/closedloop-2026-08-28/REPORT.md. */
      closed: isClosedStroke(simplified),
    })
    if (res.kind === "rod") return rodResultToBuilt(res, k, pen, centre)
    if (pen) {
      inflateApplyNibToGeometry(res.geometry, pen)
      const remap = nibArcRemap(centre, pen)
      if (remap) remapGeometryArcUV(res.geometry, remap)
    }
    return { geometry: scaleGeometry(res.geometry, k), isRod: false }
  }

  // rod
  const res = buildRodGeometry(world, {
    radius: ROD_RADIUS,
    closed: isClosedStroke(simplified),
  })
  return rodResultToBuilt(res, k)
}

function rodResultToBuilt(
  res: ReturnType<typeof buildRodGeometry>,
  k: number,
  /** Set only on Inflate's honest-degradation fallback, where the centreline
   *  handed to the builder was already in field space. Everything the rod
   *  returns — mesh, caps, joints, and the curve the reveal reads — has to come
   *  back through `A` together, or the caps sit off the ends of their own tube. */
  nib: InflateNib | null = null,
  fieldPts: THREE.Vector3[] | null = null,
): BuiltStroke {
  const params = (res.geometry as unknown as {
    parameters?: { path?: THREE.CatmullRomCurve3; tubularSegments?: number }
  }).parameters
  const tubularSegments = params?.tubularSegments
  // TubeGeometry places ring j at getPointAt(j / N) — an ARC-LENGTH fraction —
  // so its ring table is exactly uniform. (Free Stroke's own Rod is
  // curvature-adaptive and has to measure; this one does not.)
  const ringArcFracs =
    typeof tubularSegments === "number"
      ? Array.from({ length: tubularSegments + 1 }, (_, j) => j / tubularSegments)
      : undefined
  let path = params?.path
  if (nib) {
    inflateApplyNibToGeometry(res.geometry, nib)
    const remap = fieldPts ? nibArcRemap(fieldPts, nib) : null
    if (remap) remapGeometryArcUV(res.geometry, remap)
    /* The curve is what `viewport-3d.tsx:7163` walks to place the end cap, so a
     * field-space curve would put the cap on the ink's pre-nib position. */
    if (path) path = new THREE.CatmullRomCurve3(path.points.map((v) => nibToWorldVec(v, nib)), false, "centripetal", 0.5)
  }
  return {
    geometry: scaleGeometry(res.geometry, k),
    isRod: true,
    // Empty -> undefined. See the note on BuiltStroke.capPositions: an empty
    // array here silently kills the whole render loop.
    capPositions:
      res.capPositions.length >= 2
        ? res.capPositions.map((v) => (nib ? nibToWorldVec(v, nib) : v.clone()).multiplyScalar(k))
        : undefined,
    jointPositions: res.jointPositions.map((v) => (nib ? nibToWorldVec(v, nib) : v.clone()).multiplyScalar(k)),
    capRadius: res.radius * k,
    curve: path,
    ringArcFracs,
  }
}

/* ==================================================================== *
 *  THE DRAW-IN, WITHOUT A REBUILD                                      *
 * ==================================================================== *
 *
 * ── THE DEFECT THIS EXISTS FOR, MEASURED BEFORE IT WAS BUILT ──────────
 *
 * Sebs, 2026-08-04, three stepped screenshots of `/desk-doodles` on THIS
 * engine: *"if a letter covers another like the d over the o it leaves part of
 * the o just like erased — the o should still be fully drawn but its edge
 * doesnt get drawn on that side."*
 *
 * He is right that ink disappears and wrong about which letter causes it, and
 * the difference matters because it names the fix. Nothing here fuses: every
 * stroke is its own mesh (`buildOneStroke`), so a neighbour cannot touch it.
 * What was happening is that the reveal on this engine went through
 * `filterStrokesByProgress` — REBUILD FROM AN ARC-LENGTH-CLIPPED COPY — and
 * **Desk Doodles' Inflate profile is parametrised on normalised position along
 * the stroke it is handed** (`strokeTo3d.ts` :1147-1150,
 * `u = i / segments`, `r = tip + (base − tip)·sin(πu)^0.8`). Three more of its
 * inputs are length-dependent in the same way: `baseRadius` is clamped to
 * `arcLen × INFLATE_MAX_BASE_TO_LENGTH` (:1100), the ring count is
 * `clamp(pts.length × 4, 32, 256)` (:1105), and `synthPressures` is derived
 * from the curvature of whatever polyline it receives (:1087).
 *
 * So a growing clip re-shapes ALL the ink already on the page, every frame. On
 * the hero word (`scripts/verify/assert-drawin-monotone.mjs`, plain node, no
 * GPU) the standing mark lost ink on **36 of 40 steps, worst 16.07 % of
 * everything drawn in a single 2.5 % step**, and one fixed physical point on
 * the second `o` swung
 * **0.0201 → 0.0289 → 0.0220** in half-width — up 44 % and back down — while
 * the pen was still going round it. That is the "erased edge", and it heals for
 * the reason he saw: when the stroke finishes, its clip stops moving.
 *
 * ── THE FIX IS THE ONE THE REPO ALREADY PROVED ────────────────────────
 *
 * Explainer 18: the reveal is a RENDERING problem, and the answer is to stop
 * rebuilding — order the triangles by arc length once, at build time, and
 * animate with `setDrawRange`. A prefix of a finished buffer cannot reshape
 * what is behind it; monotonicity stops being a property to test for and
 * becomes one the mechanism cannot violate.
 *
 * `components/viewport-3d.tsx` already routes on evidence rather than on an
 * engine name — `meshesCarryRevealKeys` is STATE the built meshes correct, and
 * its comment says outright that this engine "builds a perfectly good Inflate
 * mesh and never sets `revealKeys`". So the whole switch is: set them.
 *
 * ── AND THE ARC COORDINATE IS READ OFF THE PORT, NOT RE-DERIVED ───────
 *
 * Both DD builders that Inflate can produce write the curve parameter into the
 * uv V channel and nowhere else: `buildInflateGeometry` sets
 * `uvs[vi·2+1] = i / segments` with the two poles pinned to 0 and 1
 * (`strokeTo3d.ts` :1192, :1207-1208), and `THREE.TubeGeometry` — the rod
 * fallback — sets the same thing. Both walk their centreline with
 * `getPointAt`, which is ARC-LENGTH parametrised, so uv.y IS the fraction of
 * the stroke the pen had covered. Reading it is exact and costs nothing;
 * re-deriving it with a nearest-point search would be a second opinion about a
 * number the builder already knows.
 */

/**
 * Per-triangle global arc keys, ascending, with the index buffer sorted to
 * match — the same contract `lib/implicit-surface.ts` §6 produces and
 * `AnimatedStrokes` binary-searches.
 *
 * The key is the **MAX** over the triangle's three vertices, not the mean: a
 * triangle is fully drawn only once the pen has left all of it, which is the
 * same "FAR end" rule `capArc` states in lib/geometry-engines.ts.
 *
 * Returns null — rather than a wrong table — for any geometry that carries no
 * uv or no index. The viewport treats a missing table as "this engine cannot
 * reveal by drawRange" and falls back to the rebuild path, so a null here is
 * the old behaviour and never a broken reveal.
 */
function bakeRevealKeys(
  geo: THREE.BufferGeometry,
  arcFrom: number,
  arcTo: number,
): Float32Array | null {
  const idx = geo.getIndex()
  const uv = geo.getAttribute("uv")
  if (!idx || !uv) return null
  const triCount = Math.floor(idx.count / 3)
  if (triCount === 0) return null

  const span = arcTo - arcFrom
  const raw = new Float32Array(triCount)
  for (let t = 0; t < triCount; t++) {
    let u = uv.getY(idx.getX(t * 3))
    const b = uv.getY(idx.getX(t * 3 + 1))
    const c = uv.getY(idx.getX(t * 3 + 2))
    if (b > u) u = b
    if (c > u) u = c
    raw[t] = arcFrom + span * (u < 0 ? 0 : u > 1 ? 1 : u)
  }

  const order = new Uint32Array(triCount)
  for (let t = 0; t < triCount; t++) order[t] = t
  // A comparison sort is right here where the implicit surface counting-sorts:
  // that one orders 147k triangles, this one orders ~1k per stroke, and the
  // whole build happens once rather than per frame.
  const sorted = Array.from(order).sort((p, q) => raw[p] - raw[q])

  const out = new Uint32Array(triCount * 3)
  const keys = new Float32Array(triCount)
  for (let t = 0; t < triCount; t++) {
    const s = sorted[t]
    out[t * 3] = idx.getX(s * 3)
    out[t * 3 + 1] = idx.getX(s * 3 + 1)
    out[t * 3 + 2] = idx.getX(s * 3 + 2)
    // ASCENDING BY CONSTRUCTION, and pinned rather than assumed — the binary
    // search in AnimatedStrokes is a plain lower bound and a single float wobble
    // out of order would make it return the wrong count.
    keys[t] = t > 0 && raw[s] < keys[t - 1] ? keys[t - 1] : raw[s]
  }
  geo.setIndex(new THREE.BufferAttribute(out, 1))
  return keys
}

/** Per-stroke animation channels. Copied in shape from RodEngine.buildPreview
 *  so the reveal behaves identically; the values are the stroke's own pen
 *  timing, which is upstream of either engine. */
function animationChannels(stroke: ProcessedStroke) {
  const pts = stroke.points
  const tStart = pts[0].t
  const pointTimestamps = pts.map((p) => p.t - tStart)
  const pointArcLengths: number[] = [0]
  for (let i = 1; i < pts.length; i++) {
    pointArcLengths.push(
      pointArcLengths[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y),
    )
  }
  const totalTime = pointTimestamps[pointTimestamps.length - 1]
  const totalArc = pointArcLengths[pointArcLengths.length - 1]
  const timeFracs =
    totalTime > 0
      ? pointTimestamps.map((t) => t / totalTime)
      : pointTimestamps.map((_, i) => i / Math.max(pointTimestamps.length - 1, 1))
  const distFracs =
    totalArc > 0
      ? pointArcLengths.map((a) => a / totalArc)
      : pointArcLengths.map((_, i) => i / Math.max(pointArcLengths.length - 1, 1))
  return { pointTimestamps, pointArcLengths, timeFracs, distFracs }
}

/* ------------------------------------------------------------------ */
/*  Pool builder (Solid)                                              */
/* ------------------------------------------------------------------ */

/** Solid is POOL-level in Desk Doodles by nature: every stroke rasterises into
 *  ONE binary grid so overlapping ink merges into a watertight mass. Their
 *  `rasterizePoolLoops` stamps each stroke INDEPENDENTLY into the shared grid
 *  — union happens in the grid, never by concatenating point arrays (the
 *  defect docs/research/extrude-solid-quality.md §5 found in Free Stroke's own
 *  Solid). So this returns a single StrokeMeshData for the whole drawing,
 *  matching what Free Stroke's SolidEngine does. */
function buildPool(
  strokes: ProcessedStroke[],
  viewBox: ViewBoxSize,
  k: number,
  inkRadiusDD: number,
  depthDD: number,
): THREE.BufferGeometry | null {
  const pool = strokes.filter((s) => s.points.length >= 2).map(toInputPoints)
  if (pool.length === 0) return null
  const res = buildPoolSolidGeometry(pool, {
    viewBox,
    // Free Stroke centres on the CANVAS, so pass the canvas centre explicitly
    // instead of letting buildPoolSolidGeometry default to the pool bbox.
    center: { x: viewBox.w / 2, y: viewBox.h / 2 },
    epsilon: RDP_EPSILON,
    inkRadius: inkRadiusDD,
    depth: depthDD,
    rodRadius: ROD_RADIUS,
    holes: true,
    edge: DD_LOOK_DEFAULTS.solidEdge,
  })
  return scaleGeometry(res.geometry, k)
}

/* ------------------------------------------------------------------ */
/*  Dial translation                                                  */
/* ------------------------------------------------------------------ */

/** Free Stroke's Solid thickness dial (raw px -> calibrated effective px) into
 *  Desk Doodles' `inkRadius` (world units, half-width of the stamped ink
 *  body). Their own default 0.08 world = 8 viewBox px radius = a 16px ink
 *  body; Free Stroke's default effective thickness is ~22px, so the two are
 *  the same order and the dial maps straight across. */
function solidInkRadiusDD(thicknessSlider: number): number {
  return (computeSolidEffectiveThicknessPx(thicknessSlider) / 2) * WORLD_SCALE
}

/**
 * Free Stroke's ink-weight dial into Desk Doodles' Inflate base radius.
 *
 * FOUND BY CAPTURE, AND WORTH STATING PLAINLY: at Desk Doodles' own
 * INFLATE_BASE_RADIUS of 0.22 the word "Desk Doodles" comes out as a row of
 * fused beads. 0.22 world units is a 22 viewBox-px RADIUS — a 44px ink body on
 * a ~118px letter, about 37% of cap height. That is not a bug in their engine;
 * it is their engine correctly tuned for the thing it was tuned on, a doodle
 * drawn freehand across an 800x600 canvas, where a stroke is long and a fat
 * capsule reads as a puffy inflated form. A letterform is short and close to
 * its neighbours, so the same radius swallows the counters.
 *
 * Keeping 0.22 would make the comparison a comparison of two ink weights, not
 * of two engines. So Inflate's base radius comes off the SAME thickness dial
 * that already drives Solid's ink radius, exactly the way Free Stroke's own
 * Inflate reads its weight from solidParams. Everything that makes their
 * Inflate theirs — the sin(pi*u)^0.8 profile, the pressure influence, the
 * parallel-transport frames, the dr/ds normal correction, the pole-fan caps —
 * is untouched.
 */
function inflateBaseRadiusDD(thicknessSlider: number): number {
  return (computeSolidEffectiveThicknessPx(thicknessSlider) / 2) * WORLD_SCALE
}

/** A Free Stroke world-space depth back into Desk Doodles world units. */
function depthToDD(depthFS: number, k: number): number {
  return depthFS / k
}

/* ------------------------------------------------------------------ */
/*  The engines                                                       */
/* ------------------------------------------------------------------ */

function resolveViewBox(params: { canvasWidth: number; canvasHeight: number }): ViewBoxSize {
  const w = params.canvasWidth || DEFAULT_VIEWBOX.w
  const h = params.canvasHeight || DEFAULT_VIEWBOX.h
  return { w, h }
}

function makeDeskDoodlesEngine(mode: GeometryMode): GeometryEngine {
  return {
    buildPreview(strokes: ProcessedStroke[], params: PreviewParams): StrokeMeshData[] {
      const { canvasWidth, canvasHeight } = params
      if (strokes.length === 0 || canvasWidth === 0 || canvasHeight === 0) return []
      const viewBox = resolveViewBox(params)
      const k = ddToFsScale(canvasWidth, canvasHeight)

      if (mode === "solid") {
        const sp = params.solidParams ?? DEFAULT_SOLID_PARAMS
        const geo = buildPool(
          strokes,
          viewBox,
          k,
          solidInkRadiusDD(sp.thickness),
          depthToDD(computeSolidEffectiveDepth(sp.depth), k),
        )
        if (!geo) return []
        return [
          {
            tubeGeometry: geo,
            filteredCount: strokes.reduce((n, s) => n + s.points.length, 0),
            key: `dd-solid-${strokes.length}-${strokes.reduce((n, s) => n + s.points.length, 0)}`,
            mode: "solid",
          },
        ]
      }

      const ep = params.extrudeParams ?? DEFAULT_EXTRUDE_PARAMS
      const spAll = params.solidParams ?? DEFAULT_SOLID_PARAMS
      const depthDD = depthToDD(
        mode === "extrude" ? ep.depth : computeSolidEffectiveDepth(spAll.depth),
        k,
      )
      const inflateBaseDD = inflateBaseRadiusDD(spAll.thickness)
      /* THE NIB, RESOLVED ONCE FOR THE WHOLE DRAWING — see THE BROAD NIB,
       * CARRIED ACROSS. One matrix per word: a nib angle that drifts along a
       * stroke breaks the change of variables (stroke-width-models.md §4.4). */
      const nib = mode === "inflate" ? inflateResolveNib(params.inflateParams ?? DEFAULT_INFLATE_PARAMS) : null
      /* IN THE MEMO KEY, OR THE DIAL DOES NOTHING. `useStrokeMeshes` hands back
       * the cached mesh whenever the key matches, and every nib parameter
       * changes the SHAPE while changing neither the point count nor the radii
       * the old key was built from — so without this a nib sweep renders the
       * first arm four times and reports it as four settings. Free Stroke's own
       * Inflate carries the identical line for the identical reason. */
      const nibKey = nib && nib.active ? `-n${nib.a.toFixed(4)}x${nib.b.toFixed(4)}@${nib.angleDeg}` : ""

      /* THE REVEAL'S COORDINATE, ONCE PER BUILD. Only Inflate reveals by
       * drawRange in this app (`inflateRevealsByDrawRange` in
       * components/viewport-3d.tsx is gated on `geometryMode === "inflate"`),
       * so only Inflate pays for the spans — and only Inflate gets a table.
       * Emitting one in Extrude or Rod would be a claim the viewport does not
       * read, which is the dead-parameter class this repo has found three
       * times. See the block above `bakeRevealKeys`. */
      const spans = mode === "inflate" ? strokeArcSpans(strokes) : null

      const out: StrokeMeshData[] = []
      for (let si = 0; si < strokes.length; si++) {
        const stroke = strokes[si]
        if (stroke.points.length < 2) continue
        const built = buildOneStroke(stroke, mode, viewBox, k, depthDD, inflateBaseDD, nib)
        if (!built) continue
        const span = spans?.[si]
        const revealKeys = span ? bakeRevealKeys(built.geometry, span.from, span.to) : null
        out.push({
          tubeGeometry: built.geometry,
          curve: built.curve,
          capPositions: built.capPositions,
          jointPositions: built.jointPositions,
          capRadius: built.capRadius,
          ringArcFracs: built.ringArcFracs,
          ...(revealKeys ? { revealKeys } : {}),
          filteredCount: stroke.points.length,
          key: `dd-${mode}-${si}-${stroke.points.length}${nibKey}`,
          // Report the mode the VIEWPORT should render as. Rod is the only one
          // that draws cap and joint spheres, and Desk Doodles' rod genuinely
          // has them, so a stroke that fell back to rod is reported as rod —
          // including a CLOSED one, which has joints but no caps.
          mode: built.isRod ? "rod" : mode,
          ...animationChannels(stroke),
        })
      }
      return out
    },

    buildExport(strokes: ProcessedStroke[], params: ExportParams): ExportResult {
      const { canvasWidth, canvasHeight } = params
      const viewBox = resolveViewBox(params)
      const k = ddToFsScale(canvasWidth, canvasHeight)
      const material = new THREE.MeshPhysicalMaterial({
        name: params.material?.preset ?? "ink",
        color: new THREE.Color(params.material?.params?.color ?? "#1a1a1a"),
        roughness: params.material?.params?.roughness ?? 0.5,
        metalness: params.material?.params?.metalness ?? 0,
      })

      const objects: THREE.Object3D[] = []
      const disposables: THREE.BufferGeometry[] = []

      if (mode === "solid") {
        const sp = params.solidParams ?? DEFAULT_SOLID_PARAMS
        const geo = buildPool(
          strokes,
          viewBox,
          k,
          solidInkRadiusDD(sp.thickness),
          depthToDD(computeSolidEffectiveDepth(sp.depth), k),
        )
        if (geo) {
          const m = new THREE.Mesh(geo, material)
          m.name = "dd_solid"
          objects.push(m)
          disposables.push(geo)
        }
      } else {
        const ep = params.extrudeParams ?? DEFAULT_EXTRUDE_PARAMS
        const spAll = params.solidParams ?? DEFAULT_SOLID_PARAMS
        const depthDD = depthToDD(
          mode === "extrude" ? ep.depth : computeSolidEffectiveDepth(spAll.depth),
          k,
        )
        const inflateBaseDD = inflateBaseRadiusDD(spAll.thickness)
        /* THE SAME NIB THE PREVIEW GOT. Export reading a different pen from the
         * preview is the defect the repo names "preview == export byte-for-byte"
         * to forbid. */
        const nib = mode === "inflate" ? inflateResolveNib(params.inflateParams ?? DEFAULT_INFLATE_PARAMS) : null
        for (let si = 0; si < strokes.length; si++) {
          const stroke = strokes[si]
          if (stroke.points.length < 2) continue
          const built = buildOneStroke(stroke, mode, viewBox, k, depthDD, inflateBaseDD, nib)
          if (!built) continue
          const group = new THREE.Group()
          group.name = `dd_${mode}_stroke_${si}`
          const body = new THREE.Mesh(built.geometry, material)
          body.name = `${group.name}_body`
          group.add(body)
          disposables.push(built.geometry)
          // Cap + joint spheres are SIBLING meshes in Desk Doodles too
          // ("simpler than CSG merge", 3d-roundtrip-build-plan.md:48), so the
          // export mirrors the preview exactly.
          const r = built.capRadius ?? ROD_RADIUS * k
          for (const [i, p] of (built.capPositions ?? []).entries()) {
            const g = new THREE.SphereGeometry(r, 14, 14)
            g.translate(p.x, p.y, p.z)
            const m = new THREE.Mesh(g, material)
            m.name = `${group.name}_cap_${i}`
            group.add(m)
            disposables.push(g)
          }
          for (const [i, p] of (built.jointPositions ?? []).entries()) {
            const g = new THREE.SphereGeometry(r, 8, 8)
            g.translate(p.x, p.y, p.z)
            const m = new THREE.Mesh(g, material)
            m.name = `${group.name}_joint_${i}`
            group.add(m)
            disposables.push(g)
          }
          objects.push(group)
        }
      }

      // Recentre at origin — same convention as every Free Stroke engine.
      const bbox = new THREE.Box3()
      for (const obj of objects) bbox.union(new THREE.Box3().setFromObject(obj))
      const centre = new THREE.Vector3()
      bbox.getCenter(centre)
      for (const obj of objects) {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && child.geometry) {
            child.geometry.translate(-centre.x, -centre.y, -centre.z)
          }
        })
      }

      const root = new THREE.Group()
      root.name = "FreeStroke"
      root.userData = {
        app: "Free Stroke",
        engine: "desk-doodles",
        mode,
        exportedAt: new Date().toISOString(),
        strokeCount: params.strokeCount,
        totalPoints: params.totalPoints,
        settings: {
          ...params.settings,
          ddWorldScale: WORLD_SCALE,
          ddToFsScale: k,
          rodRadius: ROD_RADIUS,
        },
      }
      for (const obj of objects) root.add(obj)

      return { group: root, disposables, objectCount: objects.length, merged: false }
    },
  }
}

/* ------------------------------------------------------------------ */
/*  Registry                                                          */
/* ------------------------------------------------------------------ */

export const ddEngines: Record<GeometryMode, GeometryEngine> = {
  rod: makeDeskDoodlesEngine("rod"),
  extrude: makeDeskDoodlesEngine("extrude"),
  solid: makeDeskDoodlesEngine("solid"),
  inflate: makeDeskDoodlesEngine("inflate"),
}

export function getDeskDoodlesEngine(mode: GeometryMode): GeometryEngine {
  return ddEngines[mode]
}
