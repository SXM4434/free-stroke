/**
 * IMPLICIT (SIGNED-DISTANCE) SURFACE PIPELINE
 * ===========================================
 *
 * This module turns a bag of round-cone (tapered-capsule) primitives into ONE
 * watertight triangle mesh, by
 *
 *   1. defining a signed distance field  f(p) = smin_i( sdRoundCone(p, seg_i) )
 *   2. sampling f on a uniform grid restricted to the primitives' neighbourhood
 *   3. polygonising the f = 0 isosurface with marching cubes
 *
 * The reason this exists: a SWEPT LOFT (the Inflate engine's original strategy)
 * gives every stroke its own closed tube. Where two strokes cross, the tubes
 * interpenetrate — two complete shells passing through each other. There is no
 * surface at the junction, only two surfaces that happen to overlap, and a
 * cross-section through the crossing hits FOUR sheets instead of two. An
 * implicit field has no such notion of "per-stroke surface": there is one
 * scalar function, and its zero level set is one surface, everywhere. Crossing
 * strokes fuse because the field says they are one solid.
 *
 * Everything here is ISOTROPIC and unit-agnostic. The caller is expected to
 * work in whatever "field space" makes its primitives round; the Inflate engine
 * pre-scales world Z so its elliptical cross-section becomes circular, runs the
 * field, and un-scales the resulting vertices.
 *
 * ⚠ THIS PARAGRAPH CITED AN EXPLAINER 08 CALLED "implicit fusion", WHICH HAS
 * NEVER EXISTED — explainer 08 is the hero beat and registers, about something
 * else entirely. (The dead path is described rather than spelled, so the
 * citation gate does not have to special-case a citation that is ABOUT a broken
 * citation.) The write-up this points at is
 * `docs/explainers/17-the-rim-in-the-round.md` §1 (Inflate rebuilt AS the canal
 * surface, which is where the Z pre-scale comes from) and
 * `docs/explainers/19-the-elbow-and-the-fold.md` §2 and §6 (when the field
 * replaces the loft, and what `blend` actually does to it).
 *
 * ---------------------------------------------------------------------------
 * 1. THE PRIMITIVE — exact round-cone SDF
 * ---------------------------------------------------------------------------
 * A stroke is a polyline. Each polyline SEGMENT becomes a round cone: the
 * convex hull of two spheres, radius ra at a and rb at b. (Equal radii = a
 * capsule; that is just the degenerate case, so one formula covers both and the
 * per-sample width/pressure profile can vary continuously along a stroke.)
 *
 * The exact distance (Inigo Quilez's `sdRoundCone`) is derived by noticing the
 * surface has three regions — the sphere at a, the sphere at b, and the conical
 * band that is tangent to both — and that which region a point falls in is
 * decided by comparing its projection onto the axis against the tangency
 * points. Writing ba = b − a, pa = p − a, l2 = ba·ba, rr = ra − rb,
 * a2 = l2 − rr², and keeping everything scaled by l2 to avoid a divide:
 *
 *     y  = pa·ba                       (axial coordinate, scaled by |ba|)
 *     z  = y − l2                      (same, measured from b)
 *     x  = pa·l2 − ba·y                (perpendicular component, scaled by l2)
 *     x2 = x·x,  y2 = y²·l2,  z2 = z²·l2
 *     k  = sign(rr)·rr²·x2
 *
 *     sign(z)·a2·z2 > k  ->  sqrt(x2 + z2)/l2 − rb        (cap at b)
 *     sign(y)·a2·y2 < k  ->  sqrt(x2 + y2)/l2 − ra        (cap at a)
 *     otherwise          ->  (sqrt(x2·a2/l2) + y·rr)/l2 − ra   (conical band)
 *
 * It is EXACT — not a bound — which matters below, because the acceleration
 * structure's correctness proof relies on the value being a true distance.
 *
 * ---------------------------------------------------------------------------
 * 2. THE COMBINE — cubic polynomial smooth minimum
 * ---------------------------------------------------------------------------
 * A hard union is f = min(f1, f2). Its zero set is the union of the two solids,
 * and it has a CREASE wherever the two surfaces meet — exactly the "two pipes
 * jammed together" look we are trying to get rid of. A smooth minimum rounds
 * that crease into a fillet.
 *
 * Implemented here (`sminCubic`):
 *
 *     h = max(k − |a − b|, 0) / k
 *     smin(a, b, k) = min(a, b) − h³·k/6
 *
 * Why the CUBIC polynomial variant and not the others:
 *
 *   • vs. the QUADRATIC polynomial smin (h²·k/4): the quadratic is only C¹.
 *     Its second derivative jumps at |a − b| = k, so surface CURVATURE is
 *     discontinuous at the rim of every fillet. Curvature discontinuities are
 *     invisible on a matte surface and very visible on a glossy one — they
 *     show up as a faint Mach band where the specular highlight's rate of
 *     change breaks. Inflate's whole point is a glossy pressurised body, so
 *     this matters. The cubic is C²: value, normal AND curvature are
 *     continuous, so the fillet dies out invisibly. Cost is one extra multiply.
 *
 *   • vs. the EXPONENTIAL smin (−log(Σ exp(−k·d_i))/k): the exponential is
 *     C^∞ and order-independent (it is a true log-sum-exp, so it is both
 *     commutative and associative — a genuinely nice property, see the caveat
 *     in §3). But it has NON-COMPACT support: every primitive in the drawing
 *     pulls the surface outward everywhere, by an amount that never reaches
 *     zero. That means (a) a long stroke visibly fattens a distant one,
 *     (b) the drawing's silhouette depends on how many strokes exist, and
 *     (c) — fatally for us — you cannot cull distant primitives without
 *     changing the answer, so the acceleration structure in §4 stops being
 *     exact. The polynomial smins are IDENTICAL to min once |a − b| ≥ k, which
 *     is what makes culling provably lossless.
 *
 *   • The maximum displacement is k/6 for the cubic vs k/4 for the quadratic,
 *     so for the same k the cubic also adds less unintended mass.
 *
 * ---------------------------------------------------------------------------
 * 2b. WHAT MUST **NOT** BE BLENDED — run-grouped folding
 * ---------------------------------------------------------------------------
 * Naively folding smin over every primitive is WRONG here, and visibly so.
 * A stroke is resampled at ~0.6 radii, so ten-ish consecutive capsules overlap
 * any given surface point and all report almost the same distance. Folding
 * smin over near-equal values subtracts a little each time — for N nearly
 * coincident values the total displacement converges toward k, not k/6:
 *
 *     fold 1: −0.167k   fold 2: −0.263k   fold 3: −0.330k   …   fold 8: ≈ −0.5k
 *
 * i.e. a plain fold inflates every stroke by roughly half the blend radius,
 * uniformly, purely because of how it was sampled. Worse, the amount depends on
 * the local sample count, so ends and corners inflate differently from the
 * middle. That is not a fillet, it is a bug that looks like a style choice.
 *
 * The fix: a stroke's OWN consecutive capsules must combine with a HARD min.
 * That is not an approximation — the union of consecutive round cones sharing
 * an endpoint sphere IS the exact swept-sphere volume, and its distance
 * function is exactly the polyline distance. No crease, no inflation, and the
 * result matches the loft's tube where nothing crosses (which is the stated
 * requirement).
 *
 * So each primitive carries a `group` (stroke id) and an `order` (sample index
 * along that stroke), and a query folds like this:
 *
 *     partition the candidate list into RUNS — maximal spans of the same group
 *     whose order indices are within `runGap` of each other
 *     hard-min inside a run          (same piece of the same stroke)
 *     smooth-min across runs         (different strokes, or the same stroke
 *                                     doubling back on itself)
 *
 * A straight stroke yields exactly one run: an exact tube. An X yields two
 * runs: a filleted fusion. A self-crossing scribble yields two runs from the
 * SAME stroke, far apart in arc length, so self-crossings fuse with a fillet
 * too. Because primitives are appended stroke-major then sample-major, and the
 * acceleration grid's buckets come out of a counting sort, each bucket list is
 * already sorted by (group, order) — run detection is one linear pass with no
 * sorting and no allocation.
 *
 * ---------------------------------------------------------------------------
 * 3. HONEST CAVEAT — polynomial smin is not associative
 * ---------------------------------------------------------------------------
 * smin(smin(a,b),c) ≠ smin(a,smin(b,c)) in general, so folding N terms gives an
 * order-dependent result. This is true of every polynomial smin and every SDF
 * renderer that uses one. Three things keep it from mattering here:
 *
 *   • The fold is over RUNS, not primitives (§2b). A typical query point sees
 *     one run; a crossing sees two; only a pile-up of three or more strokes
 *     folds enough terms for order to matter at all.
 *   • The fold order is DETERMINISTIC (group-major, then order — the bucket
 *     lists come out of a stable counting sort), so the same drawing always
 *     produces the same mesh and preview cannot drift from export.
 *   • The error is bounded by the blend term itself, ≤ k/6 per extra run.
 *
 * It is a real approximation and it is named here rather than hidden.
 *
 * ---------------------------------------------------------------------------
 * 4. ACCELERATION — uniform grid, with a proof that culling is exact
 * ---------------------------------------------------------------------------
 * Naively, f costs O(#segments) per sample and the mesh costs
 * O(#cells × #segments). For a scribble that is ~10⁹ operations. Instead:
 *
 *   • Each segment is inserted into every cell of a uniform grid that its AABB,
 *     DILATED BY (r_max + 2k), touches. Insertion is a two-pass counting sort
 *     into flat Int32Arrays (no per-cell JS arrays, no hashing).
 *   • A field query looks up ONE cell and folds only the segments in it.
 *
 * Why 2k and not k — the culling is exact, not approximate:
 *   If p is outside a segment's AABB dilated by d, then p's distance to the
 *   AABB exceeds d, and the segment's axis lies inside the AABB, so
 *   dist(p, axis) > d and therefore sd(p) > d − r. With d = r_max + 2k that
 *   gives sd(p) > 2k for every CULLED segment. Now let `acc` be the value
 *   folded from the kept segments.
 *     – If acc ≤ k, then |acc − sd_culled| > k, so the cubic smin's support
 *       term h is exactly 0: the culled segment could not have changed the
 *       result at all.
 *     – If acc > k, the result is positive with margin (the blend can subtract
 *       at most k/6), so no zero crossing is possible in this cell either way.
 *   In both cases the ZERO LEVEL SET — the only thing marching cubes reads —
 *   is unaffected. Culling with a k dilation would NOT have this property.
 *
 *   • Cells with an empty bucket return a large positive constant without
 *     touching a single segment, so empty space costs one array read.
 *   • Marching cubes only visits cells flagged as ACTIVE (within r_max + k of
 *     some segment, rasterised straight from the segment AABBs), and grid
 *     vertex values are memoised, so each sample point is evaluated once no
 *     matter how many of the 8 adjacent cells want it.
 *
 * ---------------------------------------------------------------------------
 * 5. POLYGONISATION — marching cubes, and the ambiguous-face problem
 * ---------------------------------------------------------------------------
 * We use the classic 256-case Lorensen–Cline / Bourke tables. They are imported
 * from `three/examples/jsm/objects/MarchingCubes.js`, which EXPORTS `edgeTable`
 * and `triTable` — so we get the canonical, well-tested tables without
 * inheriting that class's fixed-resolution cubic metaball domain (see the doc
 * for why that helper was rejected). Our corner/edge/bit convention is copied
 * from that same file so the tables mean what they say.
 *
 * THE AMBIGUOUS-FACE PROBLEM. Marching cubes reads only the 8 corner SIGNS, but
 * a cube face with two diagonally-opposite negative corners and two positive
 * ones is genuinely ambiguous: the trilinear interpolant restricted to that
 * face is a bilinear saddle, and the two negative corners may be joined across
 * the face or separated by it. Six of the fifteen base cases (3, 6, 7, 10, 12,
 * 13) have such faces. If two neighbouring cubes resolve their SHARED face
 * differently, the two contours on that face do not line up and the mesh gets a
 * hole. The principled fix is the ASYMPTOTIC DECIDER: on a face with corners
 * a, b, c, d in cyclic order, the bilinear saddle value is
 *
 *     S = (a·c − b·d) / (a + c − b − d)
 *
 * and its sign says whether the two same-sign diagonal corners are connected.
 * Because S depends only on the four values ON THE SHARED FACE, both neighbours
 * necessarily compute the same answer, which is what makes the fix crack-free.
 *
 * What this module actually does: it runs the standard tables, and then MEASURES
 * whether the result is closed — `auditManifold` builds the undirected
 * edge-use histogram over the indexed mesh and reports how many edges are used
 * by exactly one triangle (a boundary — i.e. a crack/hole) and how many by more
 * than two (non-manifold). A closed surface has zero of both. The caller
 * surfaces those counts, and `scripts/verify/assert-inflate-fusion.mjs` fails
 * the build if they are non-zero. That is the honest position: the decider is
 * described because it is the correct general fix, but it is not implemented
 * speculatively — the measurement decides whether it is needed, and the
 * measurement is part of the regression net. (Measured result on the Inflate
 * test battery: 0 boundary edges, 0 non-manifold edges. See the doc.)
 *
 * Vertex placement is the usual linear interpolation along the crossed edge,
 * t = −v0/(v1 − v0); vertices are DEDUPLICATED per grid edge through an
 * Int32Array edge→index map, so the output is a properly indexed shared-vertex
 * mesh — without that, every edge would be used by exactly one triangle and the
 * manifold audit would be meaningless.
 *
 * Normals come from the analytic field gradient (central differences on f),
 * not from `computeVertexNormals`. Averaged face normals on a marching-cubes
 * mesh inherit the grid's staircase bias; the gradient is the true surface
 * normal and costs 6 extra field evaluations per output vertex.
 *
 * ---------------------------------------------------------------------------
 * 6. THE DRAW-IN — why the reveal must not rebuild
 * ---------------------------------------------------------------------------
 * The hero beat writes the mark on before it stands up, and the way that was
 * animated was to rebuild this whole pipeline from an arc-length prefix of the
 * strokes on every tick. `scripts/verify/measure-implicit-cost.mjs` measures
 * what that costs on the hero word at the resolution the hero pins:
 *
 *     reveal  0.05 → 24 ms      0.25 → 121 ms     0.50 → 247 ms
 *     reveal  0.75 → 372 ms     1.00 → 531 ms
 *
 * Not a spike at the end — a RAMP, linear in revealed arc length (the full
 * build costs 2.15× the half build), which is already over a 60fps frame
 * budget at five percent of the word. One draw-in asks for ~120 of these
 * inside 2.6 seconds. There is no resolution low enough to fix that: even
 * `resolution: 3` costs 158 ms for the full word, ten frames.
 *
 * So the reveal is not a geometry problem, it is a RENDERING problem, and this
 * codebase already knew that — Rod animates by `setDrawRange` over rings it
 * ordered by arc length at build time, and rebuilds nothing.
 *
 * The same trick needs one thing marching cubes does not naturally give you: a
 * triangle ordering that follows the pen. Each output vertex is assigned the
 * arc position of its NEAREST capsule (`CapsuleField.nearestIndex`, one extra
 * field query per vertex, reusing the same bucket walk), each triangle takes
 * the MAX over its three vertices — max, not mean, so no triangle appears
 * before the pen has reached all of it — and the index buffer is counting-sorted
 * into ascending key order. Sorted keys make the per-frame question
 * ("how many triangles at arc fraction r?") a binary search.
 *
 * The visible cost of the trick: the leading edge is a cut through the surface
 * rather than a rounded pen tip, because the cap triangles at the far end of a
 * stroke sort last. It is one stroke-width wide, it is moving, and it only
 * exists during the draw beat — by the time the mark gains depth the reveal is
 * complete and the surface is whole and watertight, byte-identical to what the
 * old rebuild produced at progress 1.
 */

import * as THREE from "three"
import {
  edgeTable as edgeTableRaw,
  triTable as triTableRaw,
} from "three/examples/jsm/objects/MarchingCubes.js"

// @types/three declares these as `Int32Array[]`. The runtime values are flat
// `Int32Array`s (256 entries, and 256*16 entries respectively) — see the source
// of MarchingCubes.js. The stub is wrong upstream, so re-assert the real type
// once, here, rather than casting at every lookup in the hot loop.
const edgeTable = edgeTableRaw as unknown as Int32Array
const triTable = triTableRaw as unknown as Int32Array

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

/** One tapered capsule (round cone) primitive, in field space. */
export interface ImplicitCapsule {
  ax: number
  ay: number
  az: number
  bx: number
  by: number
  bz: number
  /** radius at a */
  ra: number
  /** radius at b */
  rb: number
  /**
   * Which stroke this capsule belongs to. Capsules in the same group AND
   * within `runGap` of each other in `order` combine with a HARD min (they are
   * the same piece of the same stroke). See §2b of the module header.
   */
  group: number
  /** Sample index along the stroke — monotonically increasing within a group. */
  order: number
}

export interface ImplicitBuildOptions {
  /** Smooth-union blend radius k, field-space units. 0 = hard union (creases). */
  blendK: number
  /** Requested marching-cubes cell size, field-space units. */
  cellSize: number
  /**
   * Maximum gap in `order` for two same-group capsules to still count as the
   * same run (hard min). Larger = more of a stroke treated as one piece.
   * Should be ≳ the number of samples spanning one stroke diameter, so a
   * gentle curve never blends with itself. Default 6.
   */
  runGap?: number
  /**
   * Hard ceiling on total grid cells. The builder coarsens `cellSize`
   * geometrically until the grid fits, and reports what it actually used.
   */
  maxCells?: number
  /** Run the manifold/edge-use audit on the output (default true). */
  audit?: boolean
  /**
   * DRAW-IN REVEAL ORDER — one 0..1 arc-length position per capsule, in the
   * same index order as `caps`. Supplying it makes the polygoniser emit
   * `revealKeys` (see `ImplicitBuildResult`), which turns the draw-in from a
   * per-frame REBUILD into a per-frame `setDrawRange` — see §6 of the module
   * header for why that is the difference between a beat and a slideshow.
   *
   * Omitted → nothing extra is computed and the output is byte-identical to
   * before, so every non-animating caller (export, static preview) pays zero.
   */
  revealOrder?: Float32Array
}

export interface ImplicitBuildStats {
  /** Cell size actually used (may be coarser than requested — see maxCells). */
  cellSize: number
  /** Grid cell counts. */
  nx: number
  ny: number
  nz: number
  /** nx*ny*nz. */
  totalCells: number
  /** Cells flagged near a primitive and therefore visited by marching cubes. */
  activeCells: number
  /** Grid vertices whose field value was actually computed. */
  fieldSamples: number
  /**
   * Capsule SDF evaluations (the real cost driver). Includes the 6 extra
   * evaluations per output vertex spent on gradient normals.
   */
  sdfEvals: number
  /** Segment→cell insertions in the acceleration grid. */
  gridInsertions: number
  /** Mean candidate-list length over evaluated samples. */
  meanCandidates: number
  /** Mean number of RUNS folded per evaluated sample (1 = no blending at all). */
  meanRuns: number
  vertices: number
  triangles: number
  /** Edges used by exactly one triangle — a crack. 0 for a closed surface. */
  boundaryEdges: number
  /** Edges used by three or more triangles. 0 for a manifold surface. */
  nonManifoldEdges: number
  /** Whether the audit ran at all. */
  audited: boolean
  /** ms — acceleration grid construction. */
  msGrid: number
  /** ms — field sampling + marching cubes. */
  msMarch: number
  /** ms — gradient normals. */
  msNormals: number
  /** ms — total. */
  msTotal: number
  /** True if maxCells forced a coarser grid than requested. */
  coarsened: boolean
  /** ms — reveal keying + triangle sort. 0 when `revealOrder` was not supplied. */
  msReveal: number
}

export interface ImplicitBuildResult {
  geometry: THREE.BufferGeometry | null
  stats: ImplicitBuildStats
  /**
   * Per-TRIANGLE reveal position, ascending, aligned with the (reordered) index
   * buffer: triangle t occupies indices [3t, 3t+3) and appears once the draw-in
   * playhead passes `revealKeys[t]`. Because it is sorted, "how much of the
   * mark is drawn at arc fraction r" is one binary search and one
   * `setDrawRange(0, 3 * count)`.
   *
   * Null unless `revealOrder` was supplied.
   */
  revealKeys: Float32Array | null
}

/**
 * The SAME build, as raw buffers instead of a `THREE.BufferGeometry`.
 *
 * WHY IT EXISTS. `polygoniseCapsuleField` is pure arithmetic right up to its
 * last five lines, where it wraps three typed arrays in a BufferGeometry. Those
 * five lines are the only thing in the whole pipeline that a Web Worker cannot
 * hand back: a BufferGeometry is not structured-cloneable and not
 * transferable, while `Float32Array`/`Uint32Array` are both. So the pipeline is
 * split exactly at that seam — everything above it becomes this function, and
 * `polygoniseCapsuleField` becomes those five lines on top of it.
 *
 * The split is a MOVE, not a rewrite. The arithmetic, its order, and every
 * intermediate are the same object code they were, which is what makes the
 * worker's output byte-identical to the main thread's rather than merely close:
 * same V8, same IEEE-754 doubles, same sequence of operations.
 */
export interface ImplicitBuildBuffers {
  /** Interleaved xyz, 3 floats per vertex. Null when nothing was produced. */
  positions: Float32Array | null
  /** Interleaved xyz, 3 floats per vertex, aligned with `positions`. */
  normals: Float32Array | null
  /** Triangle indices — Uint16Array below 65536 vertices, Uint32Array above. */
  indices: Uint16Array | Uint32Array | null
  revealKeys: Float32Array | null
  stats: ImplicitBuildStats
}

/* ------------------------------------------------------------------ */
/*  Smooth minimum                                                    */
/* ------------------------------------------------------------------ */

/**
 * Cubic polynomial smooth minimum (Inigo Quilez).
 *
 *   h = max(k - |a-b|, 0) / k
 *   smin = min(a,b) - h^3 * k / 6
 *
 * C² continuous, compactly supported (== min once |a-b| >= k), no
 * transcendentals. See the module header for why this variant.
 */
export function sminCubic(a: number, b: number, k: number): number {
  if (k <= 0) return a < b ? a : b
  const d = a - b
  const ad = d < 0 ? -d : d
  const h = k - ad
  if (h <= 0) return a < b ? a : b
  const hn = h / k
  return (a < b ? a : b) - hn * hn * hn * k * (1 / 6)
}

/** Quadratic polynomial smooth minimum — kept for the doc's A/B comparison. */
export function sminQuadratic(a: number, b: number, k: number): number {
  if (k <= 0) return a < b ? a : b
  const d = a - b
  const ad = d < 0 ? -d : d
  const h = k - ad
  if (h <= 0) return a < b ? a : b
  const hn = h / k
  return (a < b ? a : b) - hn * hn * k * 0.25
}

/* ------------------------------------------------------------------ */
/*  The field: capsules + uniform grid                                */
/* ------------------------------------------------------------------ */

/**
 * A signed distance field made of round cones combined with `sminCubic`,
 * accelerated by a uniform grid over the primitives.
 *
 * Built once per polygonisation. All primitive data is stored in flat typed
 * arrays (struct-of-arrays) — with a few thousand primitives and a few million
 * evaluations, per-primitive object property lookups dominate the runtime.
 */
export class CapsuleField {
  readonly count: number
  /** Value returned where no primitive is in range. */
  readonly far: number
  readonly blendK: number

  // Per-segment, precomputed for sdRoundCone.
  private readonly pax: Float32Array
  private readonly pay: Float32Array
  private readonly paz: Float32Array
  private readonly bax: Float32Array
  private readonly bay: Float32Array
  private readonly baz: Float32Array
  private readonly l2a: Float32Array
  private readonly il2: Float32Array
  private readonly rr: Float32Array
  private readonly a2: Float32Array
  private readonly raA: Float32Array
  private readonly rbA: Float32Array
  private readonly groupA: Int32Array
  private readonly orderA: Int32Array
  private readonly runGap: number

  // Uniform acceleration grid.
  private readonly gCell: number
  private readonly gInv: number
  private readonly gx0: number
  private readonly gy0: number
  private readonly gz0: number
  private readonly gnx: number
  private readonly gny: number
  private readonly gnz: number
  private readonly bucketStart: Int32Array
  private readonly bucketItems: Int32Array

  /** Largest primitive radius, used for bounds dilation by the caller. */
  readonly maxRadius: number
  /** Tight AABB of the primitive axes (NOT dilated). */
  readonly minX: number
  readonly minY: number
  readonly minZ: number
  readonly maxX: number
  readonly maxY: number
  readonly maxZ: number

  /** Diagnostics — mutated by `eval`. */
  sdfEvals = 0
  evalCalls = 0
  candidateTotal = 0
  runTotal = 0
  readonly gridInsertions: number
  readonly msGrid: number

  constructor(caps: ImplicitCapsule[], blendK: number, runGap = 6) {
    const t0 = now()
    const n = caps.length
    this.count = n
    this.blendK = Math.max(0, blendK)
    this.runGap = Math.max(1, runGap)

    this.pax = new Float32Array(n)
    this.pay = new Float32Array(n)
    this.paz = new Float32Array(n)
    this.bax = new Float32Array(n)
    this.bay = new Float32Array(n)
    this.baz = new Float32Array(n)
    this.l2a = new Float32Array(n)
    this.il2 = new Float32Array(n)
    this.rr = new Float32Array(n)
    this.a2 = new Float32Array(n)
    this.raA = new Float32Array(n)
    this.rbA = new Float32Array(n)
    this.groupA = new Int32Array(n)
    this.orderA = new Int32Array(n)

    let minX = Infinity
    let minY = Infinity
    let minZ = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    let maxZ = -Infinity
    let maxRadius = 0

    for (let i = 0; i < n; i++) {
      const c = caps[i]
      const bx = c.bx - c.ax
      const by = c.by - c.ay
      const bz = c.bz - c.az
      let l2 = bx * bx + by * by + bz * bz
      // A zero-length segment is a sphere; nudge l2 so the divides stay finite.
      // (The formula degrades gracefully: y and z collapse and both cap
      // branches return the sphere distance.)
      if (!(l2 > 1e-20)) l2 = 1e-20
      this.pax[i] = c.ax
      this.pay[i] = c.ay
      this.paz[i] = c.az
      this.bax[i] = bx
      this.bay[i] = by
      this.baz[i] = bz
      this.l2a[i] = l2
      this.il2[i] = 1 / l2
      const rr = c.ra - c.rb
      this.rr[i] = rr
      // a2 = l2 - rr^2. Negative means one sphere fully contains the other;
      // clamp so the sqrt in the conical branch stays real (the branch is then
      // never selected in practice because the cap tests win).
      this.a2[i] = Math.max(l2 - rr * rr, 0)
      this.raA[i] = c.ra
      this.rbA[i] = c.rb
      this.groupA[i] = c.group
      this.orderA[i] = c.order

      const r = c.ra > c.rb ? c.ra : c.rb
      if (r > maxRadius) maxRadius = r
      if (c.ax < minX) minX = c.ax
      if (c.bx < minX) minX = c.bx
      if (c.ay < minY) minY = c.ay
      if (c.by < minY) minY = c.by
      if (c.az < minZ) minZ = c.az
      if (c.bz < minZ) minZ = c.bz
      if (c.ax > maxX) maxX = c.ax
      if (c.bx > maxX) maxX = c.bx
      if (c.ay > maxY) maxY = c.ay
      if (c.by > maxY) maxY = c.by
      if (c.az > maxZ) maxZ = c.az
      if (c.bz > maxZ) maxZ = c.bz
    }

    this.maxRadius = maxRadius
    this.minX = minX
    this.minY = minY
    this.minZ = minZ
    this.maxX = maxX
    this.maxY = maxY
    this.maxZ = maxZ
    this.far = maxRadius * 64 + 1

    // ---- Acceleration grid -------------------------------------------------
    // Dilation is (r + 2k): see the module header for why 2k makes culling
    // exact with respect to the zero level set rather than merely close.
    const dilate = maxRadius + 2 * this.blendK
    // Cell size: one dilation radius. Small enough that a bucket only holds
    // genuinely nearby segments; large enough that a segment lands in a
    // handful of cells rather than hundreds.
    const cell = Math.max(dilate, 1e-6)
    this.gCell = cell
    this.gInv = 1 / cell
    this.gx0 = minX - dilate
    this.gy0 = minY - dilate
    this.gz0 = minZ - dilate
    this.gnx = Math.max(1, Math.ceil((maxX + dilate - this.gx0) / cell) + 1)
    this.gny = Math.max(1, Math.ceil((maxY + dilate - this.gy0) / cell) + 1)
    this.gnz = Math.max(1, Math.ceil((maxZ + dilate - this.gz0) / cell) + 1)

    const cells = this.gnx * this.gny * this.gnz
    const counts = new Int32Array(cells + 1)

    // Pass 1 — count. Pass 2 — fill. A counting sort, so the bucket lists are
    // contiguous in one Int32Array and the fold order is deterministic.
    const lo = new Int32Array(n * 3)
    const hi = new Int32Array(n * 3)
    let insertions = 0
    for (let i = 0; i < n; i++) {
      const c = caps[i]
      const r = (c.ra > c.rb ? c.ra : c.rb) + 2 * this.blendK
      const x0 = Math.min(c.ax, c.bx) - r
      const y0 = Math.min(c.ay, c.by) - r
      const z0 = Math.min(c.az, c.bz) - r
      const x1 = Math.max(c.ax, c.bx) + r
      const y1 = Math.max(c.ay, c.by) + r
      const z1 = Math.max(c.az, c.bz) + r
      const i0 = clampI(Math.floor((x0 - this.gx0) * this.gInv), 0, this.gnx - 1)
      const j0 = clampI(Math.floor((y0 - this.gy0) * this.gInv), 0, this.gny - 1)
      const k0 = clampI(Math.floor((z0 - this.gz0) * this.gInv), 0, this.gnz - 1)
      const i1 = clampI(Math.floor((x1 - this.gx0) * this.gInv), 0, this.gnx - 1)
      const j1 = clampI(Math.floor((y1 - this.gy0) * this.gInv), 0, this.gny - 1)
      const k1 = clampI(Math.floor((z1 - this.gz0) * this.gInv), 0, this.gnz - 1)
      lo[i * 3] = i0
      lo[i * 3 + 1] = j0
      lo[i * 3 + 2] = k0
      hi[i * 3] = i1
      hi[i * 3 + 1] = j1
      hi[i * 3 + 2] = k1
      for (let gi = i0; gi <= i1; gi++) {
        for (let gj = j0; gj <= j1; gj++) {
          const base = (gi * this.gny + gj) * this.gnz
          for (let gk = k0; gk <= k1; gk++) {
            counts[base + gk + 1]++
            insertions++
          }
        }
      }
    }
    for (let c = 0; c < cells; c++) counts[c + 1] += counts[c]
    this.bucketStart = counts
    const items = new Int32Array(insertions)
    const cursor = new Int32Array(cells)
    for (let i = 0; i < n; i++) {
      const i0 = lo[i * 3]
      const j0 = lo[i * 3 + 1]
      const k0 = lo[i * 3 + 2]
      const i1 = hi[i * 3]
      const j1 = hi[i * 3 + 1]
      const k1 = hi[i * 3 + 2]
      for (let gi = i0; gi <= i1; gi++) {
        for (let gj = j0; gj <= j1; gj++) {
          const base = (gi * this.gny + gj) * this.gnz
          for (let gk = k0; gk <= k1; gk++) {
            const cellIdx = base + gk
            items[counts[cellIdx] + cursor[cellIdx]] = i
            cursor[cellIdx]++
          }
        }
      }
    }
    this.bucketItems = items
    this.gridInsertions = insertions
    this.msGrid = now() - t0
  }

  /** Exact signed distance to primitive `i`. */
  private sdSegment(i: number, px: number, py: number, pz: number): number {
    const pax = px - this.pax[i]
    const pay = py - this.pay[i]
    const paz = pz - this.paz[i]
    const bax = this.bax[i]
    const bay = this.bay[i]
    const baz = this.baz[i]
    const l2 = this.l2a[i]
    const il2 = this.il2[i]
    const rr = this.rr[i]
    const a2 = this.a2[i]

    const y = pax * bax + pay * bay + paz * baz
    const z = y - l2
    const xx = pax * l2 - bax * y
    const xy = pay * l2 - bay * y
    const xz = paz * l2 - baz * y
    const x2 = xx * xx + xy * xy + xz * xz
    const y2 = y * y * l2
    const z2 = z * z * l2

    const k = (rr > 0 ? 1 : rr < 0 ? -1 : 0) * rr * rr * x2
    if ((z > 0 ? 1 : z < 0 ? -1 : 0) * a2 * z2 > k) {
      return Math.sqrt(x2 + z2) * il2 - this.rbA[i]
    }
    if ((y > 0 ? 1 : y < 0 ? -1 : 0) * a2 * y2 < k) {
      return Math.sqrt(x2 + y2) * il2 - this.raA[i]
    }
    return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - this.raA[i]
  }

  /**
   * f(p) — hard min within each run, cubic smooth-min across runs.
   * Returns `far` where nothing is in range (provably positive there).
   *
   * The bucket list is sorted by (group, order) because primitives are
   * appended stroke-major/sample-major and the bucket build is a counting
   * sort, so runs are detected in a single linear pass. See §2b of the header.
   */
  eval(px: number, py: number, pz: number): number {
    const gi = Math.floor((px - this.gx0) * this.gInv)
    if (gi < 0 || gi >= this.gnx) return this.far
    const gj = Math.floor((py - this.gy0) * this.gInv)
    if (gj < 0 || gj >= this.gny) return this.far
    const gk = Math.floor((pz - this.gz0) * this.gInv)
    if (gk < 0 || gk >= this.gnz) return this.far
    const cellIdx = (gi * this.gny + gj) * this.gnz + gk
    const s = this.bucketStart[cellIdx]
    const e = this.bucketStart[cellIdx + 1]
    this.evalCalls++
    if (s === e) return this.far
    this.candidateTotal += e - s
    this.sdfEvals += e - s

    const k = this.blendK
    const gap = this.runGap
    const items = this.bucketItems
    const groups = this.groupA
    const orders = this.orderA

    let acc = 0
    let haveAcc = false
    let runMin = 0
    let haveRun = false
    let prevGroup = -1
    let prevOrder = 0
    let runs = 0

    for (let t = s; t < e; t++) {
      const idx = items[t]
      const d = this.sdSegment(idx, px, py, pz)
      const g = groups[idx]
      const o = orders[idx]
      const sameRun = haveRun && g === prevGroup && o - prevOrder <= gap
      if (sameRun) {
        if (d < runMin) runMin = d
      } else {
        if (haveRun) {
          // Close the previous run and fold it in.
          if (!haveAcc) {
            acc = runMin
            haveAcc = true
          } else if (k > 0) {
            const diff = acc - runMin
            const ad = diff < 0 ? -diff : diff
            const h = k - ad
            if (h > 0) {
              const hn = h / k
              acc = (acc < runMin ? acc : runMin) - hn * hn * hn * k * (1 / 6)
            } else if (runMin < acc) acc = runMin
          } else if (runMin < acc) acc = runMin
          runs++
        }
        runMin = d
        haveRun = true
      }
      prevGroup = g
      prevOrder = o
    }
    if (haveRun) {
      if (!haveAcc) {
        acc = runMin
        haveAcc = true
      } else if (k > 0) {
        const diff = acc - runMin
        const ad = diff < 0 ? -diff : diff
        const h = k - ad
        if (h > 0) {
          const hn = h / k
          acc = (acc < runMin ? acc : runMin) - hn * hn * hn * k * (1 / 6)
        } else if (runMin < acc) acc = runMin
      } else if (runMin < acc) acc = runMin
      runs++
    }
    this.runTotal += runs
    return haveAcc ? acc : this.far
  }

  /**
   * Index of the capsule this point is closest to, or -1 if no capsule is in
   * range. Same bucket walk as `eval`, without the run folding — the answer is
   * a single argmin, so runs and blending are irrelevant to it.
   *
   * Used to key an output vertex to a position along the mark (§6). A vertex
   * sitting in a fillet between two crossing strokes is genuinely equidistant
   * from both and either answer is defensible; taking the argmin makes the
   * choice deterministic, which is all the reveal needs.
   */
  nearestIndex(px: number, py: number, pz: number): number {
    const gi = Math.floor((px - this.gx0) * this.gInv)
    if (gi < 0 || gi >= this.gnx) return -1
    const gj = Math.floor((py - this.gy0) * this.gInv)
    if (gj < 0 || gj >= this.gny) return -1
    const gk = Math.floor((pz - this.gz0) * this.gInv)
    if (gk < 0 || gk >= this.gnz) return -1
    const cellIdx = (gi * this.gny + gj) * this.gnz + gk
    const s = this.bucketStart[cellIdx]
    const e = this.bucketStart[cellIdx + 1]
    if (s === e) return -1
    let best = -1
    let bestD = Infinity
    for (let t = s; t < e; t++) {
      const idx = this.bucketItems[t]
      const d = this.sdSegment(idx, px, py, pz)
      if (d < bestD) {
        bestD = d
        best = idx
      }
    }
    return best
  }

  /** Normalised outward normal from the analytic gradient (central diffs). */
  gradient(px: number, py: number, pz: number, h: number, out: Float32Array, o: number): void {
    const gx = this.eval(px + h, py, pz) - this.eval(px - h, py, pz)
    const gy = this.eval(px, py + h, pz) - this.eval(px, py - h, pz)
    const gz = this.eval(px, py, pz + h) - this.eval(px, py, pz - h)
    const len = Math.sqrt(gx * gx + gy * gy + gz * gz)
    if (len > 1e-12) {
      out[o] = gx / len
      out[o + 1] = gy / len
      out[o + 2] = gz / len
    } else {
      out[o] = 0
      out[o + 1] = 0
      out[o + 2] = 1
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Marching cubes                                                    */
/* ------------------------------------------------------------------ */

/**
 * Cube corner layout — copied from three's MarchingCubes so the imported
 * `edgeTable`/`triTable` mean what they say:
 *
 *   0=(0,0,0) 1=(1,0,0) 2=(1,1,0) 3=(0,1,0)
 *   4=(0,0,1) 5=(1,0,1) 6=(1,1,1) 7=(0,1,1)
 *
 * Bit c of `cubeIndex` is set when corner c is INSIDE (f < 0).
 */
const CORNER_DX = [0, 1, 1, 0, 0, 1, 1, 0]
const CORNER_DY = [0, 0, 1, 1, 0, 0, 1, 1]
const CORNER_DZ = [0, 0, 0, 0, 1, 1, 1, 1]

/** Edge e connects corners EDGE_A[e] and EDGE_B[e]. */
const EDGE_A = [0, 1, 3, 0, 4, 5, 7, 4, 0, 1, 2, 3]
const EDGE_B = [1, 2, 2, 3, 5, 6, 6, 7, 4, 5, 6, 7]
/**
 * Global identity of edge e of cell (i,j,k): the grid vertex it starts from,
 * plus which axis it runs along. Two cells sharing an edge produce the same
 * (vertex, axis) pair, which is what makes vertex dedup — and therefore the
 * manifold audit — work.
 */
const EDGE_OFF_I = [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0]
const EDGE_OFF_J = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1]
const EDGE_OFF_K = [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0]
const EDGE_AXIS = [0, 1, 0, 1, 0, 1, 0, 1, 2, 2, 2, 2]

function clampI(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function now(): number {
  return typeof performance !== "undefined" ? performance.now() : Date.now()
}

/**
 * Sample the field on a uniform grid over the primitives' dilated bounds and
 * polygonise the f = 0 isosurface — returning RAW BUFFERS.
 *
 * Only cells within (maxRadius + blendK) of a primitive are visited; grid
 * vertex values are memoised so each is evaluated exactly once.
 *
 * This is the whole pipeline minus its last five lines. Nothing here touches
 * THREE, the DOM or a canvas, so it runs unchanged inside a Web Worker — see
 * `ImplicitBuildBuffers` and `lib/implicit-surface.worker.ts`.
 * `polygoniseCapsuleField` below is this function plus the BufferGeometry wrap,
 * and remains the entry point every existing caller uses.
 */
export function polygoniseCapsuleFieldBuffers(
  caps: ImplicitCapsule[],
  opts: ImplicitBuildOptions,
): ImplicitBuildBuffers {
  const tStart = now()
  const emptyStats = (): ImplicitBuildStats => ({
    cellSize: opts.cellSize,
    nx: 0,
    ny: 0,
    nz: 0,
    totalCells: 0,
    activeCells: 0,
    fieldSamples: 0,
    sdfEvals: 0,
    gridInsertions: 0,
    meanCandidates: 0,
    meanRuns: 0,
    vertices: 0,
    triangles: 0,
    boundaryEdges: 0,
    nonManifoldEdges: 0,
    audited: false,
    msGrid: 0,
    msMarch: 0,
    msNormals: 0,
    msReveal: 0,
    msTotal: now() - tStart,
    coarsened: false,
  })

  const nothing = (stats: ImplicitBuildStats): ImplicitBuildBuffers => ({
    positions: null,
    normals: null,
    indices: null,
    revealKeys: null,
    stats,
  })

  if (caps.length === 0 || !(opts.cellSize > 0)) {
    return nothing(emptyStats())
  }

  const field = new CapsuleField(caps, opts.blendK, opts.runGap ?? 6)
  const k = Math.max(0, opts.blendK)
  // Bounds must contain the whole surface: the axes' AABB plus one radius (the
  // primitive's own extent) plus the blend reach (a fillet can bulge outward by
  // up to k/6, but the surface it fillets is already inside r), plus a cell of
  // slack so the outermost cells are guaranteed to be fully outside — that is
  // what makes the mesh CLOSED rather than clipped at the box.
  const pad = field.maxRadius + k

  let cellSize = opts.cellSize
  const maxCells = opts.maxCells ?? 12_000_000
  let nx = 0
  let ny = 0
  let nz = 0
  let coarsened = false
  for (let guard = 0; guard < 40; guard++) {
    const ox = field.minX - pad - cellSize
    const oy = field.minY - pad - cellSize
    const oz = field.minZ - pad - cellSize
    nx = Math.max(1, Math.ceil((field.maxX + pad + cellSize - ox) / cellSize))
    ny = Math.max(1, Math.ceil((field.maxY + pad + cellSize - oy) / cellSize))
    nz = Math.max(1, Math.ceil((field.maxZ + pad + cellSize - oz) / cellSize))
    if (nx * ny * nz <= maxCells) break
    cellSize *= 1.25
    coarsened = true
  }
  const ox = field.minX - pad - cellSize
  const oy = field.minY - pad - cellSize
  const oz = field.minZ - pad - cellSize
  // How close to the surface a grid sample may sit before it is pushed off it.
  // See the corner loop below.
  // 0.1% of a cell, measured 2026-09-22 on a square at eight rotations: every
  // sliver clears a 1e-5 weld (closest pair 2.3e-5), index buffers unchanged, and
  // the worst vertex moves 2.35% of a cell. At 1% it moved 32% where the surface
  // grazes an edge, so bigger is not safer.
  const nearZero = 0.001 * cellSize

  const vnx = nx + 1
  const vny = ny + 1
  const vnz = nz + 1
  const vertCount = vnx * vny * vnz

  const values = new Float32Array(vertCount)
  const computed = new Uint8Array(vertCount)
  const active = new Uint8Array(nx * ny * nz)

  // ---- Mark active cells by rasterising each primitive's dilated AABB ------
  //
  // Reach is (r + k) per primitive, plus a one-cell margin. That is provably
  // enough to contain the whole surface: smin only ever DECREASES the field
  // (moving the surface outward) and by at most k/6, so the zero set lies
  // within r + k/6 of some primitive's axis. The margin then guarantees the
  // outermost visited cells are entirely outside, which is what makes the
  // output CLOSED instead of clipped against the active region's boundary.
  let activeCells = 0
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i]
    const r = (c.ra > c.rb ? c.ra : c.rb) + k
    const i0 = clampI(Math.floor((Math.min(c.ax, c.bx) - r - ox) / cellSize) - 1, 0, nx - 1)
    const j0 = clampI(Math.floor((Math.min(c.ay, c.by) - r - oy) / cellSize) - 1, 0, ny - 1)
    const k0 = clampI(Math.floor((Math.min(c.az, c.bz) - r - oz) / cellSize) - 1, 0, nz - 1)
    const i1 = clampI(Math.floor((Math.max(c.ax, c.bx) + r - ox) / cellSize) + 1, 0, nx - 1)
    const j1 = clampI(Math.floor((Math.max(c.ay, c.by) + r - oy) / cellSize) + 1, 0, ny - 1)
    const k1 = clampI(Math.floor((Math.max(c.az, c.bz) + r - oz) / cellSize) + 1, 0, nz - 1)
    for (let gi = i0; gi <= i1; gi++) {
      for (let gj = j0; gj <= j1; gj++) {
        const base = (gi * ny + gj) * nz
        for (let gk = k0; gk <= k1; gk++) {
          if (active[base + gk] === 0) {
            active[base + gk] = 1
            activeCells++
          }
        }
      }
    }
  }

  // ---- Field sampling (memoised per grid vertex) --------------------------
  let fieldSamples = 0
  const sample = (i: number, j: number, kk: number): number => {
    const vi = (i * vny + j) * vnz + kk
    if (computed[vi] === 0) {
      values[vi] = field.eval(ox + i * cellSize, oy + j * cellSize, oz + kk * cellSize)
      computed[vi] = 1
      fieldSamples++
    }
    return values[vi]
  }

  // ---- Marching cubes -----------------------------------------------------
  const edgeVert = new Int32Array(vertCount * 3).fill(-1)
  const positions: number[] = []
  const indices: number[] = []
  const corner = new Float64Array(8)
  // Hoisted out of the cell loop — allocating a typed array per cell costs more
  // than the marching itself on a multi-hundred-thousand-cell grid.
  const local = new Int32Array(12)

  const tMarch = now()
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const baseCell = (i * ny + j) * nz
      for (let kk = 0; kk < nz; kk++) {
        if (active[baseCell + kk] === 0) continue

        let cubeIndex = 0
        for (let c = 0; c < 8; c++) {
          let v = sample(i + CORNER_DX[c], j + CORNER_DY[c], kk + CORNER_DZ[c])
          // Push a sample that sits almost exactly ON the surface off it, sign kept.
          // Left at ~0, every crossing on the edges that share this corner lands
          // within ~1e-7 of it, and any weld by distance (the census, Blender's
          // merge) collapses those slivers into non-manifold edges. Nudging the
          // VALUE keeps each crossing's ratio, so the facet still faces the way the
          // surface does; clamping t instead forced them all to one ratio and
          // doubled the creases. F91, 2026-09-22.
          if (v < 0 ? v > -nearZero : v < nearZero) v = v < 0 ? -nearZero : nearZero
          corner[c] = v
          if (v < 0) cubeIndex |= 1 << c
        }
        const bits = edgeTable[cubeIndex]
        if (bits === 0) continue

        // Emit / look up one vertex per crossed edge.
        for (let e = 0; e < 12; e++) {
          if ((bits & (1 << e)) === 0) {
            local[e] = -1
            continue
          }
          const ei = i + EDGE_OFF_I[e]
          const ej = j + EDGE_OFF_J[e]
          const ek = kk + EDGE_OFF_K[e]
          const key = ((ei * vny + ej) * vnz + ek) * 3 + EDGE_AXIS[e]
          let idx = edgeVert[key]
          if (idx < 0) {
            const ca = EDGE_A[e]
            const cb = EDGE_B[e]
            const v0 = corner[ca]
            const v1 = corner[cb]
            const denom = v1 - v0
            let t = denom !== 0 ? -v0 / denom : 0.5
            if (t < 0) t = 0
            else if (t > 1) t = 1
            const x0 = ox + (i + CORNER_DX[ca]) * cellSize
            const y0 = oy + (j + CORNER_DY[ca]) * cellSize
            const z0 = oz + (kk + CORNER_DZ[ca]) * cellSize
            const x1 = ox + (i + CORNER_DX[cb]) * cellSize
            const y1 = oy + (j + CORNER_DY[cb]) * cellSize
            const z1 = oz + (kk + CORNER_DZ[cb]) * cellSize
            idx = positions.length / 3
            positions.push(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z0 + (z1 - z0) * t)
            edgeVert[key] = idx
          }
          local[e] = idx
        }

        const row = cubeIndex << 4
        for (let t = 0; triTable[row + t] !== -1; t += 3) {
          const a = local[triTable[row + t]]
          const b = local[triTable[row + t + 1]]
          const c = local[triTable[row + t + 2]]
          if (a < 0 || b < 0 || c < 0) continue
          if (a === b || b === c || a === c) continue // degenerate — drop
          indices.push(a, b, c)
        }
      }
    }
  }
  const msMarch = now() - tMarch

  const vertexCount = positions.length / 3
  if (vertexCount === 0 || indices.length === 0) {
    const st = emptyStats()
    st.cellSize = cellSize
    st.nx = nx
    st.ny = ny
    st.nz = nz
    st.totalCells = nx * ny * nz
    st.activeCells = activeCells
    st.fieldSamples = fieldSamples
    st.sdfEvals = field.sdfEvals
    st.gridInsertions = field.gridInsertions
    st.msGrid = field.msGrid
    st.msMarch = msMarch
    st.msTotal = now() - tStart
    st.coarsened = coarsened
    return nothing(st)
  }

  const posArr = new Float32Array(positions)
  const idxArr =
    vertexCount > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)

  // ---- Winding ------------------------------------------------------------
  // The Bourke table's winding convention depends on which sign is treated as
  // "inside". Rather than assume, compare a sample of face normals against the
  // field gradient (which always points OUTWARD, since f increases outward) and
  // flip the whole index buffer if the majority disagree.
  const gradTmp = new Float32Array(3)
  const gradH = cellSize * 0.5
  let agree = 0
  let disagree = 0
  const triCount = idxArr.length / 3
  const probeStep = Math.max(1, Math.floor(triCount / 64))
  for (let t = 0; t < triCount; t += probeStep) {
    const a = idxArr[t * 3] * 3
    const b = idxArr[t * 3 + 1] * 3
    const c = idxArr[t * 3 + 2] * 3
    const ux = posArr[b] - posArr[a]
    const uy = posArr[b + 1] - posArr[a + 1]
    const uz = posArr[b + 2] - posArr[a + 2]
    const vx = posArr[c] - posArr[a]
    const vy = posArr[c + 1] - posArr[a + 1]
    const vz = posArr[c + 2] - posArr[a + 2]
    const fx = uy * vz - uz * vy
    const fy = uz * vx - ux * vz
    const fz = ux * vy - uy * vx
    const cx = (posArr[a] + posArr[b] + posArr[c]) / 3
    const cy = (posArr[a + 1] + posArr[b + 1] + posArr[c + 1]) / 3
    const cz = (posArr[a + 2] + posArr[b + 2] + posArr[c + 2]) / 3
    field.gradient(cx, cy, cz, gradH, gradTmp, 0)
    if (fx * gradTmp[0] + fy * gradTmp[1] + fz * gradTmp[2] >= 0) agree++
    else disagree++
  }
  if (disagree > agree) {
    for (let t = 0; t < triCount; t++) {
      const s = t * 3
      const tmp = idxArr[s + 1]
      idxArr[s + 1] = idxArr[s + 2]
      idxArr[s + 2] = tmp
    }
  }

  // ---- Gradient normals ---------------------------------------------------
  const tNorm = now()
  const normals = new Float32Array(vertexCount * 3)
  for (let v = 0; v < vertexCount; v++) {
    field.gradient(posArr[v * 3], posArr[v * 3 + 1], posArr[v * 3 + 2], gradH, normals, v * 3)
  }
  const msNormals = now() - tNorm

  // ---- Draw-in reveal ordering (§6) ---------------------------------------
  //
  // Key every vertex to a position along the mark, take the MAX over each
  // triangle, then counting-sort the index buffer into ascending key order so
  // the reveal is a `setDrawRange` rather than a rebuild.
  //
  // MAX and not mean: a triangle straddling the pen tip must wait until the pen
  // has passed ALL of it, otherwise the leading edge grows a fringe of
  // half-attached triangles reaching ahead of the ink.
  //
  // Counting sort, not `.sort(cmp)`: keys are already bounded to 0..1, and a
  // comparator sort of a few hundred thousand triangles costs more than the
  // marching did. Bucket width here is 1/4096 of the mark — about a fifth of a
  // stroke width on the hero word, so ordering INSIDE a bucket is below the
  // resolution the reveal can express anyway.
  let revealKeys: Float32Array | null = null
  let msReveal = 0
  const revealOrder = opts.revealOrder
  if (revealOrder && revealOrder.length === caps.length) {
    const tRev = now()
    const vertKey = new Float32Array(vertexCount)
    for (let v = 0; v < vertexCount; v++) {
      const idx = field.nearestIndex(posArr[v * 3], posArr[v * 3 + 1], posArr[v * 3 + 2])
      // A vertex with no capsule in range cannot happen for a surface built
      // from those capsules, but if it did, revealing it last is the safe
      // answer: it can never appear ahead of the ink.
      vertKey[v] = idx >= 0 ? revealOrder[idx] : 1
    }

    const BUCKETS = 4096
    const triKey = new Float32Array(triCount)
    const bucketOf = new Int32Array(triCount)
    const counts = new Int32Array(BUCKETS + 1)
    for (let t = 0; t < triCount; t++) {
      const a = vertKey[idxArr[t * 3]]
      const b = vertKey[idxArr[t * 3 + 1]]
      const c = vertKey[idxArr[t * 3 + 2]]
      const m = a > b ? (a > c ? a : c) : b > c ? b : c
      triKey[t] = m
      let bi = (m * BUCKETS) | 0
      if (bi < 0) bi = 0
      else if (bi >= BUCKETS) bi = BUCKETS - 1
      bucketOf[t] = bi
      counts[bi + 1]++
    }
    for (let b = 0; b < BUCKETS; b++) counts[b + 1] += counts[b]

    const sorted = idxArr.slice()
    revealKeys = new Float32Array(triCount)
    const cursor = new Int32Array(BUCKETS)
    for (let t = 0; t < triCount; t++) {
      const bi = bucketOf[t]
      const dst = counts[bi] + cursor[bi]
      cursor[bi]++
      sorted[dst * 3] = idxArr[t * 3]
      sorted[dst * 3 + 1] = idxArr[t * 3 + 1]
      sorted[dst * 3 + 2] = idxArr[t * 3 + 2]
      revealKeys[dst] = triKey[t]
    }
    idxArr.set(sorted)
    // Within a bucket the keys are unsorted by up to one bucket width. Make the
    // array monotone so a binary search over it is valid — clamping upward is
    // the conservative direction (a triangle is never revealed early).
    for (let t = 1; t < triCount; t++) {
      if (revealKeys[t] < revealKeys[t - 1]) revealKeys[t] = revealKeys[t - 1]
    }
    msReveal = now() - tRev
  }

  // ---- Manifold audit -----------------------------------------------------
  let boundaryEdges = 0
  let nonManifoldEdges = 0
  const audited = opts.audit !== false
  if (audited) {
    const res = auditManifold(idxArr, vertexCount)
    boundaryEdges = res.boundaryEdges
    nonManifoldEdges = res.nonManifoldEdges
  }

  return {
    positions: posArr,
    normals,
    indices: idxArr,
    revealKeys,
    stats: {
      cellSize,
      nx,
      ny,
      nz,
      totalCells: nx * ny * nz,
      activeCells,
      fieldSamples,
      sdfEvals: field.sdfEvals,
      gridInsertions: field.gridInsertions,
      meanCandidates: field.evalCalls > 0 ? field.candidateTotal / field.evalCalls : 0,
      meanRuns: field.evalCalls > 0 ? field.runTotal / field.evalCalls : 0,
      vertices: vertexCount,
      triangles: triCount,
      boundaryEdges,
      nonManifoldEdges,
      audited,
      msGrid: field.msGrid,
      msMarch,
      msNormals,
      msReveal,
      msTotal: now() - tStart,
      coarsened,
    },
  }
}

/**
 * Wrap a finished build's buffers in a `THREE.BufferGeometry`.
 *
 * These are the five lines that used to sit at the bottom of the polygoniser,
 * lifted out unchanged so both the synchronous path and the worker path go
 * through exactly one copy of them.
 */
export function implicitBuffersToGeometry(
  b: ImplicitBuildBuffers,
): THREE.BufferGeometry | null {
  if (!b.positions || !b.normals || !b.indices) return null
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute("position", new THREE.BufferAttribute(b.positions, 3))
  geometry.setAttribute("normal", new THREE.BufferAttribute(b.normals, 3))
  geometry.setIndex(new THREE.BufferAttribute(b.indices, 1))
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Sample the field on a uniform grid over the primitives' dilated bounds and
 * polygonise the f = 0 isosurface.
 *
 * The unchanged entry point: `polygoniseCapsuleFieldBuffers` followed by the
 * BufferGeometry wrap. Every caller that existed before the worker split —
 * `inflateBuildImplicitGeometry`, `scripts/verify/assert-implicit-reveal.mjs`,
 * `scripts/verify/measure-implicit-cost.mjs` — still calls this and still gets
 * exactly what it got.
 */
export function polygoniseCapsuleField(
  caps: ImplicitCapsule[],
  opts: ImplicitBuildOptions,
): ImplicitBuildResult {
  const b = polygoniseCapsuleFieldBuffers(caps, opts)
  return {
    geometry: implicitBuffersToGeometry(b),
    stats: b.stats,
    revealKeys: b.revealKeys,
  }
}

/**
 * Edge-use histogram over an indexed triangle mesh.
 *
 * A closed 2-manifold uses every undirected edge exactly twice. An edge used
 * ONCE is a boundary — a crack or hole, which is the failure mode the
 * marching-cubes ambiguous-face problem produces. An edge used three or more
 * times is non-manifold. This is the objective, geometry-level test that the
 * polygoniser did not tear the surface; it is reported in the build stats and
 * asserted by scripts/verify/assert-inflate-fusion.mjs.
 */
export function auditManifold(
  indices: ArrayLike<number>,
  vertexCount: number,
): { boundaryEdges: number; nonManifoldEdges: number; totalEdges: number } {
  const counts = new Map<number, number>()
  const n = vertexCount
  const triCount = indices.length / 3
  for (let t = 0; t < triCount; t++) {
    const a = indices[t * 3]
    const b = indices[t * 3 + 1]
    const c = indices[t * 3 + 2]
    addEdge(counts, a, b, n)
    addEdge(counts, b, c, n)
    addEdge(counts, c, a, n)
  }
  let boundaryEdges = 0
  let nonManifoldEdges = 0
  for (const v of counts.values()) {
    if (v === 1) boundaryEdges++
    else if (v > 2) nonManifoldEdges++
  }
  return { boundaryEdges, nonManifoldEdges, totalEdges: counts.size }
}

function addEdge(counts: Map<number, number>, a: number, b: number, n: number): void {
  const lo = a < b ? a : b
  const hi = a < b ? b : a
  const key = lo * n + hi
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

/* ================================================================== */
/*  §7  OFF THE MAIN THREAD — the wire format                         */
/* ================================================================== */
/**
 * ⚠ THE CLIENT HALF OF §7 LIVES IN `lib/implicit-defer.ts`, AND THE SPLIT IS
 * LOAD-BEARING — IT IS NOT TIDINESS.
 *
 * The scheduler needs `new Worker(new URL("./implicit-surface.worker.ts",
 * import.meta.url))`, and the worker needs `polygoniseCapsuleFieldBuffers`,
 * which is in THIS file. Putting both in one module makes the graph
 *
 *     implicit-surface  ->(worker URL)->  worker  ->(import)->  implicit-surface
 *
 * and Turbopack DEADLOCKS on it. Measured, not guessed (2026-08-01): with that
 * cycle present, `next dev` reported `Ready in 186ms` and then `Compiling / ...`
 * forever — every tokio worker in `next-swc.darwin-arm64.node` parked in
 * `_pthread_cond_wait` at 0% CPU, `/` and `/desk-doodles` both hanging past 25
 * minutes, and NO error printed anywhere. `tsc --noEmit` stayed clean at its
 * 51-error baseline throughout, because tsc does not resolve worker URLs — the
 * typecheck is structurally incapable of seeing this class of break. Bisected
 * with a control in both directions: removing the `new Worker(new URL(...))`
 * expression and restarting gave `GET / 200 in 1162ms`; restoring it hung the
 * compile again.
 *
 * With the scheduler in its own module nothing points back:
 *
 *     worker           -> implicit-surface        (this file — no worker ref)
 *     implicit-defer   -> implicit-surface + worker URL
 *
 * So THIS FILE MUST NEVER IMPORT `implicit-defer` OR NAME THE WORKER URL.
 * What stays here is the wire format and the request runner, because both are
 * things the worker itself needs.
 */
/**
 * THE DEFECT THIS SECTION EXISTS FOR.
 *
 * Touching any dial that changes the strokes — wobble, endpoint, spacing —
 * rebuilds this surface, and the rebuild is synchronous inside React's render.
 * Measured on the real page (`scripts/verify/_probe-dial-latency.mjs`, 2026-08-01):
 * one wobble nudge = one geometry build = a **1226-1254 ms blocked main thread**
 * and a **1450-1525 ms gap between rendered frames**. The same nudge on the Desk
 * Doodles engine, which does not polygonise a field, costs 17-33 ms. Nothing
 * else in the product is 40x off.
 *
 * WHERE THE SECOND GOES, sampled by V8 rather than guessed
 * (`scripts/verify/_probe-dial-cpu.mjs`, CDP `Profiler`, self-time per function):
 *
 *     739 ms  CapsuleField.sdSegment      the exact round-cone distance
 *     297 ms  CapsuleField.eval           the bucket walk + run folding
 *      93 ms  polygoniseCapsuleField      marching, allocation, sorting
 *     104 ms  buildPenField               ← NOT geometry; lib/pen-reveal.ts
 *      67 ms  nibHalfWidth                ← same, the pen's own field
 *
 * Two thirds of the freeze is field evaluation. The engine's own stopwatch
 * (`INFLATE_DEBUG.msBuildTotal`) reads ~600 ms for the same gesture, so the
 * engine can only SEE half of what it costs — which is why the fix had to be
 * chosen off a profile and not off that number.
 *
 * WHY NOT ANY OF THE CHEAPER LEVERS. They were priced first, in
 * `docs/research/off-thread-geometry.md`:
 *   - resolution 3 during the drag still costs 158 ms in node (~320 ms here) —
 *     ten frames, on every step of the drag;
 *   - a cache does nothing for a value never visited before, which is every
 *     value the first time;
 *   - debouncing turns twenty freezes into one freeze;
 *   - making `sdSegment` faster is worth maybe 2x and cannot reach 60 fps.
 * None of them make the page RESPOND. Only moving the work off the thread does,
 * and it is the one answer whose output can be byte-identical by construction.
 *
 * WHY IT LIVES HERE AND NOT IN THE COMPONENT. `useStrokeMeshes` is a `useMemo`:
 * whatever it returns must be returned synchronously, and React will not
 * re-render when a worker finishes because no state changed. So the swap cannot
 * go through React at all. It goes through THREE instead: the deferred call
 * hands back the geometry that is ALREADY on screen — the same
 * `THREE.BufferGeometry` instance — and when the worker lands, that instance's
 * attributes are replaced in place. three.js reads the geometry every frame, so
 * the new surface appears on the next rendered frame with no React involvement.
 * The mark never disappears and never blanks; it holds its last good shape and
 * then changes.
 *
 * WHAT IS DELIBERATELY *NOT* DEFERRED, so nothing that reads geometry
 * immediately can read a stale one:
 *   - EXPORT. `buildExport` never touches this path; a GLB is always the full
 *     synchronous build. That is what keeps `geometry-baseline`'s `exportBytes`
 *     an honest byte-level check.
 *   - THE FIRST BUILD OF A SLOT. With nothing on screen to hold, there is
 *     nothing to defer TO, so a new drawing always builds synchronously.
 *   - ANY BUILD THAT WAS NOT MEASURED EXPENSIVE. A slot only starts deferring
 *     once one of its builds has been observed to cost `minCostMs` or more.
 *     Every synthetic fixture in the verification battery builds in tens of
 *     milliseconds and therefore never leaves the synchronous path — the gates
 *     see exactly what they saw before.
 */

/** Wire form of `ImplicitCapsule[]` — two transferable arrays, no objects. */
export interface PackedCapsules {
  /** 8 doubles per capsule: ax ay az bx by bz ra rb. */
  f: Float64Array
  /** 2 ints per capsule: group, order. */
  i: Int32Array
}

/**
 * `Float64Array`, not `Float32Array`. `CapsuleField` narrows these to f32 in
 * its own storage, but `polygoniseCapsuleFieldBuffers` also reads `caps[i].ax`
 * directly as a double when it rasterises the active-cell mask. Packing at f32
 * would round those reads and could move an active-cell boundary by one cell —
 * a different mesh, from a "lossless" transport.
 */
export function packCapsules(caps: ImplicitCapsule[]): PackedCapsules {
  const n = caps.length
  const f = new Float64Array(n * 8)
  const i32 = new Int32Array(n * 2)
  for (let i = 0; i < n; i++) {
    const c = caps[i]
    const o = i * 8
    f[o] = c.ax
    f[o + 1] = c.ay
    f[o + 2] = c.az
    f[o + 3] = c.bx
    f[o + 4] = c.by
    f[o + 5] = c.bz
    f[o + 6] = c.ra
    f[o + 7] = c.rb
    i32[i * 2] = c.group
    i32[i * 2 + 1] = c.order
  }
  return { f, i: i32 }
}

export function unpackCapsules(p: PackedCapsules): ImplicitCapsule[] {
  const n = p.i.length / 2
  const out: ImplicitCapsule[] = new Array(n)
  for (let i = 0; i < n; i++) {
    const o = i * 8
    out[i] = {
      ax: p.f[o],
      ay: p.f[o + 1],
      az: p.f[o + 2],
      bx: p.f[o + 3],
      by: p.f[o + 4],
      bz: p.f[o + 5],
      ra: p.f[o + 6],
      rb: p.f[o + 7],
      group: p.i[i * 2],
      order: p.i[i * 2 + 1],
    }
  }
  return out
}

/** Message the worker receives. */
export interface ImplicitWorkerRequest {
  id: number
  capsF: Float64Array
  capsI: Int32Array
  blendK: number
  cellSize: number
  runGap: number
  maxCells: number
  audit: boolean
  revealOrder: Float32Array | null
}

/** Message the worker sends back. */
export interface ImplicitWorkerReply {
  id: number
  positions: Float32Array | null
  normals: Float32Array | null
  indices: Uint16Array | Uint32Array | null
  revealKeys: Float32Array | null
  stats: ImplicitBuildStats
  error?: string
}

/**
 * Run one request. Shared by the worker entry point so the worker file itself
 * is nothing but a message pump — the code that decides anything lives here,
 * beside the polygoniser it calls.
 */
export function runImplicitWorkerRequest(
  req: ImplicitWorkerRequest,
): { reply: ImplicitWorkerReply; transfer: ArrayBuffer[] } {
  const caps = unpackCapsules({ f: req.capsF, i: req.capsI })
  const b = polygoniseCapsuleFieldBuffers(caps, {
    blendK: req.blendK,
    cellSize: req.cellSize,
    runGap: req.runGap,
    maxCells: req.maxCells,
    audit: req.audit,
    revealOrder: req.revealOrder ?? undefined,
  })
  const transfer: ArrayBuffer[] = []
  for (const a of [b.positions, b.normals, b.indices, b.revealKeys]) {
    if (a) transfer.push(a.buffer as ArrayBuffer)
  }
  return {
    reply: {
      id: req.id,
      positions: b.positions,
      normals: b.normals,
      indices: b.indices,
      revealKeys: b.revealKeys,
      stats: b.stats,
    },
    transfer,
  }
}

/**
 * FIELD SPACE -> WORLD SPACE on Z.
 *
 * Lifted verbatim out of `inflateBuildImplicitGeometry` so the synchronous path
 * and the worker path apply it through one copy of the code. Normals transform
 * by the INVERSE TRANSPOSE of the scale: for diag(1,1,a) that is diag(1,1,1/a),
 * then renormalise. Getting that backwards is the classic way to make a
 * squashed sphere shade like a sphere.
 */
export function applyImplicitZAspect(geometry: THREE.BufferGeometry, aspect: number): void {
  const pos = geometry.getAttribute("position") as THREE.BufferAttribute | undefined
  const nrm = geometry.getAttribute("normal") as THREE.BufferAttribute | undefined
  if (!pos) return
  const pa = pos.array as Float32Array
  for (let i = 2; i < pa.length; i += 3) pa[i] *= aspect
  pos.needsUpdate = true
  if (nrm) {
    const na = nrm.array as Float32Array
    const inv = 1 / aspect
    for (let i = 0; i < na.length; i += 3) {
      const x = na[i]
      const y = na[i + 1]
      const z = na[i + 2] * inv
      const len = Math.sqrt(x * x + y * y + z * z)
      if (len > 1e-12) {
        na[i] = x / len
        na[i + 1] = y / len
        na[i + 2] = z / len
      }
    }
    nrm.needsUpdate = true
  }
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}
