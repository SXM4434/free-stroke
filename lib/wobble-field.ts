/* ============================================================================
 * ARC-LENGTH WOBBLE FIELD — PORTED FROM DESK DOODLES
 *
 * PROVENANCE
 *   ~/Desktop/Projects/desk-doodles/src/app/components/canvas/SvgStyleTransform.tsx
 *     · smoothPolyline          (:654-691)  verbatim
 *     · arcLengthWobbleField    (:697-725)  verbatim
 *     · applyEndpointBehavior   (:727-768)  verbatim
 *     · the anchor-displacement block of catmullRomPath (:826-862) verbatim,
 *       lifted out of the `d`-string builder it was embedded in
 *   ~/Desktop/Projects/desk-doodles/src/app/lib/geometry3d/strokeTo3d.ts
 *     · rdpPoints + its DEGENERATE-CHORD GUARD  (:344-391) verbatim
 *     · RDP_EPSILON = 3.0                       (:111)
 *
 * ── WHAT THIS IS, AND WHY IT IS THE ANSWER ──
 *
 * Desk Doodles' locked invariant I-11 makes wobble the master of the PATH:
 *
 *     "Wobble = path/motion master. [...] Wobble defines WHERE the stroke's
 *      path goes in 2D space. Geometric path waviness — the trajectory
 *      wanders. [...] Roughness does NOT move the path — only wobble does."
 *        — docs/locked-refs/F3-smart-hachure-system/09-LOCKED-MODEL.md, I-11
 *
 * Free Stroke has a width axis (Thickness/Puff, and now the ported Desk
 * Doodles capsule profile in geometry-engines.ts) and a surface axis (the
 * whole style-system). It has never had a PATH axis. Its stroke trajectories
 * are exactly what the font emitted. That is the missing half.
 *
 * ── THE MECHANISM, AND WHY IT IS NOT JUST "ADD NOISE" ──
 *
 * The naive version — jitter every point independently — is the thing Desk
 * Doodles tried and rejected. Their diagnosis, verbatim
 * (SvgStyleTransform.tsx:1695-1707):
 *
 *     "drawn freehand and uploaded auto-traced SVGs come in DENSE (heart ~80
 *      verts / 502px [...]). The wobble pipeline was calibrated against audit
 *      shapes which are SPARSE (2-6 verts per path). Dense input through the
 *      same wobble produces braid character (wavelength ~ vertex spacing)."
 *
 *     "EPSILON 1.5 -> 3.0 (2026-06-09 follow-up): heart curves at e=1.5 still
 *      produced ~30-40 anchors -> braid. Bumped to 3.0 -> ~15-20 anchors ->
 *      flowing."
 *
 * Per-point jitter has a wavelength equal to the point spacing, so a densely
 * sampled stroke turns into a hairy rope. THIS MATTERS ACUTELY HERE: Free
 * Stroke's `processStroke` arc-length-resamples at spacing 4, which is
 * precisely the dense regime that braids. A wobble bolted on without the RDP
 * stage would have produced exactly the failure Desk Doodles already paid for.
 *
 * The fix is two stages, both ported:
 *   1. RDP at their canonical e=3.0 knocks the anchor count down to the
 *      sparse band the calibration was tuned against.
 *   2. The wobble FIELD decouples wobble frequency from point spacing
 *      altogether: one continuous cosine-interpolated value-noise field
 *      sampled by CUMULATIVE ARC LENGTH, one cycle per 35-90px of path,
 *      regardless of how many vertices that path happens to carry.
 *
 * And it displaces the ANCHORS, not the control points. Their note (:854-856):
 *
 *     "Displacing the anchors themselves produces a curve that wobbles WITH
 *      the path direction. Jittering only control points doesn't move the
 *      curve."
 *
 * ── WHAT PORTS VERBATIM ──
 *
 * All of it. Desk Doodles calibrated these px constants against an 800x600
 * viewBox; Free Stroke's stroke space is the same order (hero word laid out at
 * FONT_TARGET_W=1100 with ~100px cap height, baseline shapes spanning
 * x 120-740). See the scale note in lib/hand-feel.ts for the full argument.
 *
 * ── WHAT WAS CHANGED TO MAKE IT RUN HERE ──
 *
 *   - Desk Doodles' `catmullRomPath` did endpoint -> smooth -> field -> and
 *     then emitted an SVG cubic-Bezier `d` string. Free Stroke has no SVG
 *     render path; its engines consume a point list. So the pipeline stages
 *     port unchanged and the `d`-string emitter is dropped. Everything that
 *     shaped the path is kept; only the serializer is gone.
 *   - Their Catmull-Rom-through-anchors step is likewise dropped here, because
 *     Free Stroke re-resamples and then builds its own CatmullRomCurve3 in the
 *     geometry engines (geometry-engines.ts buildAdaptiveTubeGeometry). Doing
 *     it twice would double-smooth the wobble back out.
 *   - `rdpPoints` is taken from their strokeTo3d.ts rather than the copy inside
 *     SvgStyleTransform.tsx, because the strokeTo3d copy carries the
 *     DEGENERATE-CHORD GUARD (their BUG 2 fix) that the older copy lacks, and
 *     Free Stroke feeds closed loops (closedO, nearTouch) straight into it.
 * ========================================================================== */

import { seededRandom, endpointAmountFor, type EndpointBehavior } from "@/lib/hand-feel"

/** A bare 2D anchor, matching the shape Desk Doodles' hand-feel code operates
 *  on. Free Stroke's richer `Point` is converted at the stroke-processing
 *  boundary so this file stays diffable against theirs. */
export type Anchor = [number, number]

/** e matches the 2D canonical RDP epsilon (research doc 22 dispatch-freeze).
 *  strokeTo3d.ts:110-111 */
export const RDP_EPSILON = 3.0

/* ------------------------------------------------------------------ */
/*  RDP — strokeTo3d.ts:344-391, verbatim                             */
/* ------------------------------------------------------------------ */

/** Ramer-Douglas-Peucker polyline simplification.
 *  A point is dropped if its perpendicular distance from the chord through the
 *  segment endpoints is < epsilon. */
export function rdpPoints(points: Anchor[], epsilon: number = RDP_EPSILON): Anchor[] {
  if (points.length < 3) return points.slice()
  const [x1, y1] = points[0]
  const [x2, y2] = points[points.length - 1]
  const dx = x2 - x1
  const dy = y2 - y1
  const lineLen = Math.hypot(dx, dy)
  // DEGENERATE-CHORD GUARD (BUG 2 — closed-loop collapse): when the first and
  // last points coincide (a CLOSED loop: a clean circle's endpoints are equal,
  // or within float noise ~1e-13), the chord length is ~0 and the
  // perpendicular-distance formula `|…|/lineLen` divides by ~0 → garbage
  // distances → RDP collapses the whole symmetric loop to just [first, last]
  // (2 coincident anchors). Downstream closureStateOf then reads <3 pts → 'open'
  // → a closed circle routes to a hollow ROD instead of a solid slab, and the
  // bug is RADIUS-DEPENDENT (which intermediate point happens to win the
  // garbage-max) so it looks non-deterministic. Treat any near-zero chord as
  // the degenerate case and measure distance from the shared endpoint, so the
  // farthest point splits the loop and recursion keeps it ≥3 anchors.
  const chordDegenerate = lineLen < 1e-9
  let maxDist = 0
  let maxIdx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]
    const dist = chordDegenerate
      ? Math.hypot(px - x1, py - y1)
      : Math.abs(dy * px - dx * py + x2 * y1 - y2 * x1) / lineLen
    if (dist > maxDist) {
      maxDist = dist
      maxIdx = i
    }
  }
  if (maxDist > epsilon) {
    const left = rdpPoints(points.slice(0, maxIdx + 1), epsilon)
    const right = rdpPoints(points.slice(maxIdx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [points[0], points[points.length - 1]]
}

/* ------------------------------------------------------------------ */
/*  Corner-preserving smoothing — SvgStyleTransform.tsx:654-691       */
/* ------------------------------------------------------------------ */

/** Corner-preserving smoothing. Applies 3-point moving average ONLY at points
 *  where the local angle change is small (smooth curve). Skips smoothing at
 *  sharp corners (>30° turn) so rectangles stay rectangles, hearts keep their
 *  V-bottom sharp, etc. Endpoints always preserved exactly.
 *  intensity (0-1) blends original ↔ smoothed at smooth interior points. */
export function smoothPolyline(
  points: Anchor[],
  intensity = 0.5,
  cornerThresholdRad = Math.PI / 6, // 30 degrees
): Anchor[] {
  if (points.length < 3 || intensity <= 0) return points
  const out: Anchor[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const [ax, ay] = points[i - 1]
    const [bx, by] = points[i]
    const [cx, cy] = points[i + 1]
    // Angle change at point i (signed turn from incoming → outgoing segment)
    const v1x = bx - ax,
      v1y = by - ay
    const v2x = cx - bx,
      v2y = cy - by
    const len1 = Math.hypot(v1x, v1y)
    const len2 = Math.hypot(v2x, v2y)
    if (len1 < 0.01 || len2 < 0.01) {
      out.push([bx, by])
      continue
    }
    const dot = (v1x * v2x + v1y * v2y) / (len1 * len2)
    const cosClamped = Math.max(-1, Math.min(1, dot))
    const angle = Math.acos(cosClamped)
    if (angle > cornerThresholdRad) {
      // Corner — preserve as-is.
      out.push([bx, by])
    } else {
      // Smooth segment — blend toward 3-point average.
      const sx = (ax + bx + cx) / 3
      const sy = (ay + by + cy) / 3
      out.push([bx * (1 - intensity) + sx * intensity, by * (1 - intensity) + sy * intensity])
    }
  }
  out.push(points[points.length - 1])
  return out
}

/* ------------------------------------------------------------------ */
/*  The wobble field — SvgStyleTransform.tsx:693-725, verbatim        */
/* ------------------------------------------------------------------ */

/** Generate a smooth low-frequency 1D wobble field along arc length.
 *  Returns a function (t: 0..1) → [dx, dy] that produces ~1 oscillation per
 *  `wavelengthPx` of path length. Used to add flowing wobble to a Catmull-Rom
 *  curve without per-anchor micro-jitter. */
export function arcLengthWobbleField(
  totalArcLen: number,
  amplitude: number,
  wavelengthPx: number,
  seed: number,
): (t: number) => [number, number] {
  if (amplitude <= 0.001 || totalArcLen <= 1) return () => [0, 0]
  const r = seededRandom(seed)
  // Anchor count = arc length / wavelength, minimum 3 so we get a curve.
  const numAnchors = Math.max(3, Math.ceil(totalArcLen / wavelengthPx))
  // Random anchor displacements
  const dxs: number[] = []
  const dys: number[] = []
  for (let k = 0; k <= numAnchors; k++) {
    dxs.push((r() - 0.5) * 2 * amplitude)
    dys.push((r() - 0.5) * 2 * amplitude)
  }
  return (t: number): [number, number] => {
    const clampedT = Math.max(0, Math.min(1, t))
    const u = clampedT * numAnchors
    const i = Math.floor(u)
    const f = u - i
    // Cosine interpolation for smooth transitions
    const fs = (1 - Math.cos(f * Math.PI)) / 2
    const dx = dxs[i] * (1 - fs) + dxs[Math.min(i + 1, numAnchors)] * fs
    const dy = dys[i] * (1 - fs) + dys[Math.min(i + 1, numAnchors)] * fs
    return [dx, dy]
  }
}

/* ------------------------------------------------------------------ */
/*  Endpoint behaviour — SvgStyleTransform.tsx:727-768, verbatim      */
/* ------------------------------------------------------------------ */

/** Apply endpointBehavior to a polyline: extend / push points based on the
 *  user-selected endpoint mode. */
export function applyEndpointBehavior(
  points: Anchor[],
  mode: EndpointBehavior,
  isClosed: boolean,
  seed: number,
  /** Scale on the overshoot amount. Desk Doodles' own Hero-8-Lab fork carries
   *  the identical parameter — `protrudeScale: number = 1.0` (f3HandFeel.ts:337,
   *  :374, :450, :493) — added there because "Playground pen-tip preset sizes
   *  were tuned for 300-500px artifacts. Our hero items are ~80px." Same
   *  problem here, different axis: ours is ink weight, not artifact size. */
  protrudeScale: number = 1,
): Anchor[] {
  if (mode === "clean" || points.length < 2) return points
  const amount = endpointAmountFor(mode) * protrudeScale
  const r = seededRandom(seed + 5555)
  if (mode === "kink") {
    // Random-angle push at every anchor — produces the twitchy/spasm kink
    return points.map(([x, y]) => {
      const a = r() * Math.PI * 2
      return [x + Math.cos(a) * amount, y + Math.sin(a) * amount] as Anchor
    })
  }
  if (isClosed) {
    /* ── THE INK SCALE DOES NOT REACH THIS BRANCH, AND HERE IS THE NUMBER ────
     *
     * `protrudeScale` exists for the OPEN case, where the amount lands on two
     * anchors and reads as a tail. Its own caller says why it is needed:
     * *"scaling it by the full ink ratio threw 22px tails off every stroke end
     * and was the single biggest destroyer in the over-scaled capture"*
     * (lib/stroke-processing.ts). A closed loop has no tail. The amount lands
     * on EVERY anchor, so it is not an overshoot at all — it is a DILATION of
     * the whole glyph, and the same multiplier that gently lengthens two tips
     * inflates a letter.
     *
     * Measured on the hero word, 2026-08-28, the first time this branch was
     * ever reached (nothing in the repo set `closed` until then). At the hero's
     * ink width the scale is 4.34, so Desk Doodles' 4 px became 17.35 px:
     *
     *     the `D`      144.7 x 215.0  ->  152.9 x 232.2   +14.1 % area
     *     an `o`        72.7 x  68.6  ->  105.7 x  87.3   +84.8 % area
     *     the other `o` 58.1 x  75.8  ->   90.3 x  94.8   +94.4 % area
     *
     * Two of the three letters nearly DOUBLED, and their counters opened from
     * small round holes into faceted polygons. Picture:
     * docs/verification/closedloop-2026-08-28/AB-o1-dilation.png.
     *
     * So the branch runs at Desk Doodles' own calibrated amount, verbatim, in a
     * coordinate space this file's header already establishes is the same order
     * as theirs: *"Desk Doodles calibrated these px constants against an
     * 800x600 viewBox; Free Stroke's stroke space is the same order."* The ink
     * scale is Free Stroke's addition, for Free Stroke's tube, at the two ends
     * it was added for.
     */
    const radial = endpointAmountFor(mode)
    // Radial outward from centroid for all anchors (matches old case 'path')
    let cx = 0,
      cy = 0
    for (const p of points) {
      cx += p[0]
      cy += p[1]
    }
    cx /= points.length
    cy /= points.length
    return points.map(([x, y]) => {
      const dx = x - cx,
        dy = y - cy
      const len = Math.max(0.01, Math.hypot(dx, dy))
      return [x + (dx / len) * radial, y + (dy / len) * radial] as Anchor
    })
  }
  // Open path: extend first point backward along outgoing segment, last point
  // forward along incoming segment.
  const out = points.slice()
  const [p0, p1n] = [points[0], points[1]]
  const d1x = p1n[0] - p0[0],
    d1y = p1n[1] - p0[1]
  const l1 = Math.max(0.01, Math.hypot(d1x, d1y))
  out[0] = [p0[0] - (d1x / l1) * amount, p0[1] - (d1y / l1) * amount]
  const [pn1, pn] = [points[points.length - 2], points[points.length - 1]]
  const d2x = pn[0] - pn1[0],
    d2y = pn[1] - pn1[1]
  const l2 = Math.max(0.01, Math.hypot(d2x, d2y))
  out[points.length - 1] = [pn[0] + (d2x / l2) * amount, pn[1] + (d2y / l2) * amount]
  return out
}

/* ------------------------------------------------------------------ */
/*  The composed pass — SvgStyleTransform.tsx catmullRomPath :826-862 */
/* ------------------------------------------------------------------ */

export interface HandFeelOptions {
  /** Master wobble multiplier (Desk Doodles' 0-2 scale, I-11). 0 = clean. */
  wobble: number
  /** Endpoint treatment. Default 'clean'. */
  endpoint?: EndpointBehavior
  /** Scale on the endpoint overshoot — mirrors Desk Doodles' own
   *  `protrudeScale` fork parameter (f3HandFeel.ts:337). */
  endpointScale?: number
  /** Per-stroke seed. MUST differ per stroke — see deriveStrokeSeed. */
  seed: number
  /** Whether this stroke reads as a closed loop (changes endpoint handling). */
  closed?: boolean
}

/**
 * Run the Desk Doodles hand-feel pass over one polyline.
 *
 * Stage order is THEIRS and the order matters — catmullRomPath:826-862:
 *   0) endpoint behavior BEFORE smoothing "so the extended/kinked points feed
 *      into the curve"
 *   1) corner-preserving smoothing, "remove input micro-jitter at gentle-curve
 *      segments so wobble=0 reads clean. Sharp corners (rectangles, V-bottoms)
 *      bypass smoothing entirely so they stay sharp"
 *   2) arc-length-parameterized wobble field, applied to the ANCHORS
 *
 * The one Free Stroke addition is the RDP stage in front, which in Desk
 * Doodles lives in the caller (SvgStyleTransform.tsx:1695-1716) rather than in
 * catmullRomPath. It is not optional — see this file's header on braid.
 */
export function applyHandFeel(points: Anchor[], opts: HandFeelOptions): Anchor[] {
  const n0 = points.length
  if (n0 < 2) return points
  if (opts.wobble <= 0 && (opts.endpoint ?? "clean") === "clean") return points

  // RDP INPUT NORMALIZATION. Free Stroke resamples at spacing 4 before this
  // runs, which is exactly the dense regime that braids. Knock it back to the
  // sparse band the wobble constants were calibrated against.
  const sparse = rdpPoints(points, RDP_EPSILON)
  if (sparse.length < 2) return points

  // 0) Apply endpoint behavior BEFORE smoothing so the extended/kinked points
  //    feed into the curve.
  const adjusted = applyEndpointBehavior(
    sparse,
    opts.endpoint ?? "clean",
    opts.closed ?? false,
    opts.seed,
    opts.endpointScale ?? 1,
  )

  // 1) Corner-preserving smoothing: remove input micro-jitter at gentle-curve
  //    segments so wobble=0 reads clean. Sharp corners (rectangles, V-bottoms)
  //    bypass smoothing entirely so they stay sharp.
  const smoothed = smoothPolyline(adjusted, 0.5)
  const N = smoothed.length

  if (opts.wobble <= 0) return smoothed

  // 2) Build arc-length-parameterized wobble field. Wavelength scales with
  //    overall path length so short paths get full character but long paths
  //    don't read as braid (one cycle per ~60px).
  let arcLen = 0
  const cum: number[] = [0]
  for (let i = 1; i < N; i++) {
    arcLen += Math.hypot(smoothed[i][0] - smoothed[i - 1][0], smoothed[i][1] - smoothed[i - 1][1])
    cum.push(arcLen)
  }
  if (!(arcLen > 0)) return smoothed

  // The amplitude expression is theirs too. SvgStyleTransform.tsx:1874,:1921 —
  //   ROUGH      = HAND_FEEL_BASE.line * effectiveWobble(m.wobble, bbox)
  //   wobbleAmp  = max(0, ROUGH * 2)
  // The caller does the HAND_FEEL_BASE × effectiveWobble part (it needs the
  // stroke's bbox); what arrives here is the finished amplitude.
  const wobbleAmplitude = Math.max(0, opts.wobble)

  // Wavelength scales with path length so short paths still get a few cycles
  // and long paths don't read as braid. 1 cycle per ~12% of total length
  // floored at 35px and capped at 90px.
  const wavelength = Math.max(35, Math.min(90, arcLen * 0.12))
  const wobbleAt = arcLengthWobbleField(arcLen, wobbleAmplitude, wavelength, opts.seed)

  // Apply wobble field to each anchor before generating Catmull-Rom curve.
  // (Displacing the anchors themselves produces a curve that wobbles WITH the
  // path direction. Jittering only control points doesn't move the curve.)
  const displaced: Anchor[] = []
  for (let i = 0; i < N; i++) {
    const t = N > 1 ? cum[i] / arcLen : 0
    const [wdx, wdy] = wobbleAt(t)
    displaced.push([smoothed[i][0] + wdx, smoothed[i][1] + wdy])
  }
  return displaced
}

/* ------------------------------------------------------------------ */
/*  Per-stroke seed derivation — FREE STROKE ADDITION                 */
/* ------------------------------------------------------------------ */

/**
 * Derive a stable, per-stroke seed from the stroke's own geometry.
 *
 * WHY THIS EXISTS (this part is NOT ported — Desk Doodles solves it
 * differently and their solution does not reach here).
 *
 * Desk Doodles seeds by element index: `100 + idx * 13` per top-level child,
 * `seed + idx * 17` per group child, `seed + subIdx * 31` per sub-path
 * (SvgStyleTransform.tsx:2099, :2053, :1894), with coprime increments
 * (SEED_INCREMENTS, :218-224) so layers never collide. They can do that
 * because they walk an SVG tree and always know where they are in it.
 *
 * Free Stroke's `processStroke` is called one stroke at a time with no index
 * (app/page.tsx:198, app/desk-doodles/page.tsx:264), so there is no idx to
 * multiply. Deriving the seed from the stroke's own coordinates gets the same
 * property and one better:
 *
 *   - deterministic, so the capture/verify frame-diff pipeline still works
 *     (Desk Doodles I-7: "All randomness derives from a deterministic seed");
 *   - DIFFERENT per stroke, which is the whole point on a word like
 *     "Desk Doodles" — the two D's, the three e's and the two s's are the SAME
 *     glyph geometry at DIFFERENT positions, so position-derived seeds make
 *     them wobble differently. A hand does not draw the same letter twice the
 *     same way; an index-free constant seed would have made it do exactly
 *     that, and the word would have gone straight back to reading as a font.
 *
 * FNV-1a over the quantised endpoints and length. Quantised to 0.1px so
 * floating-point noise upstream cannot flip the seed between runs.
 */
export function deriveStrokeSeed(points: Anchor[]): number {
  if (points.length === 0) return 1
  const q = (v: number) => Math.round(v * 10)
  const [fx, fy] = points[0]
  const [lx, ly] = points[points.length - 1]
  const mid = points[Math.floor(points.length / 2)]
  const key = `${points.length}:${q(fx)},${q(fy)}:${q(mid[0])},${q(mid[1])}:${q(lx)},${q(ly)}`
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  // Keep it inside the LCG's modulus band so the first draw isn't degenerate.
  return (h % 233279) + 1
}

/** Smaller bbox dimension of a polyline — the `bboxMin` that effectiveWobble
 *  clamps against (SvgStyleTransform.tsx:557). */
export function bboxMinOf(points: Anchor[]): number {
  if (points.length === 0) return 0
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const [x, y] of points) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return Math.min(maxX - minX, maxY - minY)
}
