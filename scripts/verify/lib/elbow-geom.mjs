// ELBOW GEOMETRY — the pure, browser-free half of assert-elbow.mjs.
//
// Extracted for one reason: the calibration must be runnable WITHOUT launching
// a renderer. The first version of this instrument shipped its calibration
// behind a browser launch, so the only way to ask "does this probe work at all"
// was a 40-second round trip, and the answer — when it finally arrived — was
// that `turnWidth` reported a 620 degree turn and an 8.4r fillet on a synthetic
// whose fillet is ZERO BY CONSTRUCTION, identically for all four synthetics to
// four decimal places. An instrument whose reading does not move when the thing
// it measures moves by 0.5r is measuring nothing.
//
// ---------------------------------------------------------------------------
// WHY THE OLD READING WAS 620 DEGREES — a diverging polar window
// ---------------------------------------------------------------------------
// The old probe sampled rho(theta) over +/-40 degrees of the INWARD bisector,
// casting each ray inward from a launch circle of fixed radius 3.2r. But the
// armpit of a 90 degree elbow is bounded by two walls that are PARALLEL to the
// legs, so in polar coordinates about the drawn corner
//
//     rho(phi) = sqrt(2)*r / (cos phi -/+ sin phi)      phi = theta - theta_in
//
// which is 1.414r on the bisector and DIVERGES as phi -> +/-45 degrees:
// 3.86r at 30 degrees, 11.5r at 40. Past |phi| ~ 24 degrees the launch point at
// 3.2r is INSIDE the solid, the "first surface met coming inward" is some wall
// on the far side of the corner, and `start - t` goes negative. The
// reconstructed contour then teleports across the corner twice per window and
// the unsigned turn integral accumulates ~530 degrees of pure artefact on top
// of the real 90. Identical on every synthetic because the artefact is set by
// the LEGS, not by the corner — which is exactly why all four rows agreed.
//
// Two things were wrong and both are fixed here:
//
//   1. THE FRAME. A corner profile is a graph over the axis PERPENDICULAR to
//      the bisector, never over polar angle. Rays are cast parallel to the
//      bisector from a straight launch line at S*r, sampling u laterally:
//      v(u) = sqrt(2)*r + |u| for a hard corner — bounded, single-valued, and
//      the launch line is provably outside the solid (its distance to either
//      leg axis is (S - |u|)/sqrt(2) >= 1.98r at S=4, |u| <= 1.2).
//
//   2. SIGNED TURNING. `acos(dot)` is unsigned, so facet noise on a straight
//      wall ACCUMULATES instead of cancelling — a monotonically rising error
//      that can only ever inflate the answer. Turning is now the signed
//      atan2(cross, dot), and the width is read off the CUMULATIVE turn curve
//      (the arc length between its 10% and 90% crossings) rather than by
//      growing a greedy window over unsigned bumps.
//
// ---------------------------------------------------------------------------
// WHAT THE FOUR READINGS MEAN
// ---------------------------------------------------------------------------
// At a drawn corner c with tube radius r and a 90 degree turn:
//
//   rho_in / (sqrt(2) r)   1 = the exact union of balls (two cylinders meeting
//                          in a hard crease). Above 1 = the armpit is filleted;
//                          a circular fillet of radius q reads
//                          1 + q*(sqrt(2)-1)/(sqrt(2)*r), and a cubic smooth-min
//                          of radius k reads 1 + k/(6r).
//   inner fillet / r       the SAME quantity read a second, independent way —
//                          from the arc length carrying 80% of the armpit's
//                          turn. Zero for a crease. This is the reading that
//                          separates "the elbow is filleted" from "the elbow is
//                          tessellated finer", which no dihedral census can do.
//   rho_out / r            how far the form still reaches past the drawn corner.
//                          1 = the corner ball, i.e. the corner SURVIVED.
//                          Below 1 = it was rounded away — a regression, not a
//                          fix. 1.414 = a miter spike.
//   outer fillet / r       1 = a round join of exactly the tube radius, which is
//                          what the union of balls gives. 0 = a miter spike.
//                          Above 1 = the corner was rounded off.
//
// Every one of those is calibrated against a synthetic contour with the answer
// known in closed form, INCLUDING the two known-bad outer joins, because a
// one-sided "the number got smaller" gate is passed by a fix that destroys the
// drawn corner.

/* ==========================================================================
 * SLICE + RAY CAST
 * ======================================================================== */

/** Intersect every triangle with the plane z = zc; return 2-D segments. */
export function sliceZ(pos, idx, zc) {
  const segs = []
  const n = idx.length / 3
  for (let t = 0; t < n; t++) {
    const ia = idx[t * 3] * 3
    const ib = idx[t * 3 + 1] * 3
    const ic = idx[t * 3 + 2] * 3
    const v = [
      [pos[ia], pos[ia + 1], pos[ia + 2]],
      [pos[ib], pos[ib + 1], pos[ib + 2]],
      [pos[ic], pos[ic + 1], pos[ic + 2]],
    ]
    const pts = []
    for (let e = 0; e < 3; e++) {
      const a = v[e]
      const b = v[(e + 1) % 3]
      const da = a[2] - zc
      const db = b[2] - zc
      if ((da > 0 && db > 0) || (da < 0 && db < 0)) continue
      if (da === db) continue
      const s = da / (da - db)
      if (s < 0 || s > 1) continue
      pts.push([a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s])
    }
    if (pts.length >= 2) {
      const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1])
      if (d > 1e-12) segs.push([pts[0][0], pts[0][1], pts[1][0], pts[1][1]])
    }
  }
  return segs
}

/** Nearest hit of a 2-D ray against a segment soup. Returns t, or Infinity. */
export function castRay(segs, ox, oy, dx, dy) {
  let best = Infinity
  for (let i = 0; i < segs.length; i++) {
    const [x0, y0, x1, y1] = segs[i]
    const ex = x1 - x0
    const ey = y1 - y0
    const den = dx * ey - dy * ex
    if (den === 0 || Math.abs(den) < 1e-15) continue
    const rx = x0 - ox
    const ry = y0 - oy
    const t = (rx * ey - ry * ex) / den
    const u = (rx * dy - ry * dx) / den
    if (t > 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t
  }
  return best
}

/** Single inward ray from `c + dir*start`, back toward c. Returns distance from c. */
export function radialAbout(segs, cx, cy, dirx, diry, start) {
  const t = castRay(segs, cx + dirx * start, cy + diry * start, -dirx, -diry)
  return Number.isFinite(t) ? start - t : NaN
}

/* ==========================================================================
 * THE CORNER PROFILE — a graph over the bisector-perpendicular axis
 * ======================================================================== */

/**
 * Cast N rays PARALLEL to `dir`, from a launch line at distance `S` from the
 * corner, sampling laterally over u in [-W, +W]. All lengths in world units.
 *
 * Returns { u[], v[], misses } where v is the distance from the corner, along
 * `dir`, of the outermost surface on that ray. Single-valued by construction —
 * there is no polar divergence to blow it up.
 */
export function scanAlong(segs, c, dir, S, W, N) {
  const bx = dir.x
  const by = dir.y
  const nx = -by
  const ny = bx
  const u = new Float64Array(N)
  const v = new Float64Array(N)
  let misses = 0
  for (let i = 0; i < N; i++) {
    const uu = -W + (2 * W * i) / (N - 1)
    const ox = c.x + bx * S + nx * uu
    const oy = c.y + by * S + ny * uu
    const t = castRay(segs, ox, oy, -bx, -by)
    u[i] = uu
    if (Number.isFinite(t)) v[i] = S - t
    else {
      v[i] = NaN
      misses++
    }
  }
  return { u, v, misses }
}

/**
 * Turning of the profile (u, v), and the arc length carrying `frac` of it.
 *
 * A hard crease deposits its whole turn at one sample, so the width is 0. A
 * circular fillet of radius q spreads it over q*|total|, so the width carrying
 * `frac` of the turn is frac*q*|total| and q = width / (frac*|total|).
 *
 * Turning is SIGNED. On a mesh the profile is a facet chain, and unsigned
 * turning would sum the facet jitter of the straight walls into the answer
 * instead of cancelling it.
 */
export function creaseMetrics(u, v, frac = 0.8) {
  const N = u.length
  const px = []
  const py = []
  for (let i = 0; i < N; i++) {
    if (!Number.isFinite(v[i])) continue
    px.push(u[i])
    py.push(v[i])
  }
  const M = px.length
  if (M < 5) return null
  const turn = new Float64Array(M)
  const arc = new Float64Array(M)
  for (let i = 1; i < M; i++) {
    arc[i] = arc[i - 1] + Math.hypot(px[i] - px[i - 1], py[i] - py[i - 1])
  }
  for (let i = 1; i < M - 1; i++) {
    const ax = px[i] - px[i - 1]
    const ay = py[i] - py[i - 1]
    const bx = px[i + 1] - px[i]
    const by = py[i + 1] - py[i]
    if (Math.hypot(ax, ay) < 1e-14 || Math.hypot(bx, by) < 1e-14) continue
    turn[i] = Math.atan2(ax * by - ay * bx, ax * bx + ay * by)
  }
  // Cumulative signed turn, and the arc length between its frac-window edges.
  const cum = new Float64Array(M)
  let acc = 0
  for (let i = 0; i < M; i++) {
    acc += turn[i]
    cum[i] = acc
  }
  const total = cum[M - 1]
  if (Math.abs(total) < 1e-9) return { totalTurnDeg: 0, width: 0, fillet: 0, apexV: Math.min(...py) }
  const lo = ((1 - frac) / 2) * total
  const hi = ((1 + frac) / 2) * total
  const cross = (target) => {
    for (let i = 0; i < M; i++) {
      if (total > 0 ? cum[i] >= target : cum[i] <= target) return arc[i]
    }
    return arc[M - 1]
  }
  const width = Math.max(0, cross(hi) - cross(lo))
  let apexV = Infinity
  for (let i = 0; i < M; i++) if (py[i] < apexV) apexV = py[i]
  return {
    totalTurnDeg: (total * 180) / Math.PI,
    width,
    fillet: width / (frac * Math.abs(total)),
    apexV,
  }
}

/**
 * Everything measurable at one drawn corner.
 *
 * `c` corner, `bis` INWARD bisector (unit), `legs` the two unit directions
 * pointing away from the corner down each leg, `rNom` a length scale for the
 * probe windows only — every RESULT is divided by the LOCALLY measured radius.
 */
export function analyseCorner(segs, c, bis, legs, rNom, opts = {}) {
  // The inner window is deliberately NARROWER than the outer one. Inward, the
  // launch line has to stay clear of both legs (its distance to either axis is
  // (S - |u|)/sqrt(2), so S=4, W=1.2 leaves 1.98r of clearance); outward there
  // is nothing to hit, and a corner that has been ROUNDED AWAY spreads its turn
  // over a wide u before the walls resume — W=1.2 clipped that case at 74 of
  // its 90 degrees. Outward gets S=5, W=2.
  const S = (opts.scanStart ?? 4.0) * rNom
  const W = (opts.scanWidth ?? 1.2) * rNom
  const So = (opts.scanStartOuter ?? 5.0) * rNom
  const Wo = (opts.scanWidthOuter ?? 2.0) * rNom
  const N = opts.scanSamples ?? 2001
  const start = rNom * 3.2

  // --- local tube radius, from the OUTER wall of each leg, away from the bend
  const rs = []
  for (const leg of legs) {
    let nx = -leg.y
    let ny = leg.x
    if (nx * bis.x + ny * bis.y > 0) {
      nx = -nx
      ny = -ny
    }
    for (const mult of [1.8, 2.2, 2.6, 3.0]) {
      const qx = c.x + leg.x * rNom * mult
      const qy = c.y + leg.y * rNom * mult
      const t = castRay(segs, qx + nx * start, qy + ny * start, -nx, -ny)
      if (Number.isFinite(t)) rs.push(start - t)
    }
  }
  rs.sort((a, b) => a - b)
  const rLocal = rs.length ? rs[Math.floor(rs.length / 2)] : NaN

  // --- the two closed-form apex radii, on the bisector
  const rhoIn = radialAbout(segs, c.x, c.y, bis.x, bis.y, start)
  const rhoOut = radialAbout(segs, c.x, c.y, -bis.x, -bis.y, start)

  // --- the two profiles
  const inScan = scanAlong(segs, c, bis, S, W, N)
  const outScan = scanAlong(segs, c, { x: -bis.x, y: -bis.y }, So, Wo, N)
  const inM = creaseMetrics(inScan.u, inScan.v)
  const outM = creaseMetrics(outScan.u, outScan.v)

  // --- facet size right here, so a "soft" reading can be told from tessellation
  let facet = 0
  {
    const L = []
    for (const s of segs) {
      const mx = (s[0] + s[2]) / 2
      const my = (s[1] + s[3]) / 2
      if (Math.hypot(mx - c.x, my - c.y) < rNom * 2.5) L.push(Math.hypot(s[2] - s[0], s[3] - s[1]))
    }
    L.sort((a, b) => a - b)
    facet = L.length ? L[Math.floor(L.length / 2)] : NaN
  }

  return {
    rLocal,
    rhoIn,
    rhoOut,
    /** 1 = the corner survived as a corner. <1 = rounded away. 1.414 = miter spike. */
    outOverR: rhoOut / rLocal,
    inOverR: rhoIn / rLocal,
    /** sqrt(2) is the hard-union value; bigger means a real fillet. */
    inOverSqrt2R: rhoIn / (Math.SQRT2 * rLocal),
    innerTurnDeg: inM ? inM.totalTurnDeg : null,
    /** Independent of tessellation: 0 = crease, q/r = a fillet of radius q. */
    innerFilletOverR: inM ? inM.fillet / rLocal : null,
    innerWidthOverFacet: inM && facet > 0 ? inM.width / facet : null,
    outerTurnDeg: outM ? outM.totalTurnDeg : null,
    /** 1 = a round join of the tube radius (the union of balls). 0 = a spike. */
    outerFilletOverR: outM ? outM.fillet / rLocal : null,
    facetOverR: facet / rLocal,
    inMisses: inScan.misses,
    outMisses: outScan.misses,
  }
}

/* ==========================================================================
 * SYNTHETIC ELBOWS — closed form in, closed form expected out
 * ======================================================================== */

/**
 * An L with legs along -X and +Y from the origin, tube radius r.
 *
 * `innerFilletOverR` — circular fillet in the armpit. 0 = the exact union of
 *   two cylinders, a hard crease.
 * `outerJoinOverR`   — the join at the OUTER corner, as a radius in units of r:
 *   1 = the corner ball (what the union of balls gives), 0 = a miter spike,
 *   2 = a corner rounded AWAY. The last two are the known-bad inputs: an
 *   instrument that cannot tell them from the ball can be passed by a "fix"
 *   that destroys the drawn corner.
 *
 * Returned as the z = 0 slice would be: a closed 2-D contour, as segments.
 */
export function syntheticElbow(r, innerFilletOverR, outerJoinOverR = 1) {
  const L = r * 8
  const q = innerFilletOverR * r
  const R = outerJoinOverR * r
  const pts = []
  const push = (x, y) => pts.push([x, y])

  // ---- outer wall of the -X leg, then the outer join, then the +Y leg
  push(-L, -r)
  if (R <= 1e-12) {
    push(r, -r) // miter spike at sqrt(2) r along the outward bisector
  } else {
    // Centre of a circle of radius R tangent to BOTH outer walls, on the
    // outward bisector: (r - R, R - r). R = r puts it at the corner itself.
    const ox = r - R
    const oy = R - r
    push(ox, -r)
    for (let i = 0; i <= 96; i++) {
      const a = -Math.PI / 2 + (i / 96) * (Math.PI / 2)
      push(ox + Math.cos(a) * R, oy + Math.sin(a) * R)
    }
  }
  push(r, L)

  // ---- far end of the +Y leg, then its inner wall back down
  push(-r, L)
  if (q > 0) {
    const cx = -r - q
    const cy = r + q
    push(-r, cy)
    for (let i = 0; i <= 96; i++) {
      const a = (i / 96) * (Math.PI / 2)
      push(cx + Math.cos(a) * q, cy - Math.sin(a) * q)
    }
  } else {
    push(-r, r)
  }
  push(-L, r)

  const segs = []
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-15) segs.push([a[0], a[1], b[0], b[1]])
  }
  return segs
}

/** The corner frame of the synthetic: inward bisector + the two leg directions. */
export const SYNTH_FRAME = {
  c: { x: 0, y: 0 },
  bis: { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
  legs: [
    { x: -1, y: 0 },
    { x: 0, y: 1 },
  ],
}

/* ==========================================================================
 * FOLD CENSUS — sheets crossed by a -Z ray
 * ======================================================================== */
/**
 * The crease census provably cannot see a fold: `min(acos d, acos -d)` scores a
 * flap turned back through itself as a SMALL crease. This asks a different
 * question — how many sheets does a -Z ray cross?
 *
 *   one closed solid       -> every ray hits 0 or 2
 *   a self-intersecting
 *   or folded shell        -> rays over the fold hit 4, 6, ...
 */
export function rayCensus(pos, idx, cx, cy, half, n) {
  // NOTE: kept byte-for-byte as assert-elbow.mjs calibrated it. The whole-mesh,
  // per-component version added later lives in `foldCensusComponents` below and
  // carries its own epsilon and its own calibration; it deliberately does not
  // reach in and change this one's behaviour.
  const triCount = idx.length / 3
  const bin = Math.max((half * 2) / n, 1e-6)
  const grid = new Map()
  const key = (i, j) => i * 100003 + j
  const minX = cx - half
  const minY = cy - half
  for (let t = 0; t < triCount; t++) {
    const a = idx[t * 3] * 3
    const b = idx[t * 3 + 1] * 3
    const c = idx[t * 3 + 2] * 3
    const x0 = Math.min(pos[a], pos[b], pos[c])
    const x1 = Math.max(pos[a], pos[b], pos[c])
    const y0 = Math.min(pos[a + 1], pos[b + 1], pos[c + 1])
    const y1 = Math.max(pos[a + 1], pos[b + 1], pos[c + 1])
    if (x1 < minX || x0 > cx + half || y1 < minY || y0 > cy + half) continue
    const i0 = Math.floor((x0 - minX) / bin)
    const i1 = Math.floor((x1 - minX) / bin)
    const j0 = Math.floor((y0 - minY) / bin)
    const j1 = Math.floor((y1 - minY) / bin)
    for (let i = Math.max(0, i0); i <= Math.min(n - 1, i1); i++) {
      for (let j = Math.max(0, j0); j <= Math.min(n - 1, j1); j++) {
        const k = key(i, j)
        let l = grid.get(k)
        if (!l) grid.set(k, (l = []))
        l.push(t)
      }
    }
  }
  const hist = {}
  let maxHits = 0
  let rays = 0
  const worst = []
  // Origins are jittered off the cell centre by an irrational fraction so a ray
  // cannot land exactly on a shared triangle EDGE, where barycentric
  // containment counts both triangles and a clean mesh would report 4.
  const JX = 0.2360679775
  const JY = 0.3819660113
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = minX + (i + JX) * bin
      const y = minY + (j + JY) * bin
      const list = grid.get(key(i, j))
      let hits = 0
      if (list) {
        for (const t of list) {
          const a = idx[t * 3] * 3
          const b = idx[t * 3 + 1] * 3
          const c = idx[t * 3 + 2] * 3
          const ax = pos[a]
          const ay = pos[a + 1]
          const bx = pos[b]
          const by = pos[b + 1]
          const cxx = pos[c]
          const cyy = pos[c + 1]
          const d = (by - cyy) * (ax - cxx) + (cxx - bx) * (ay - cyy)
          if (d === 0) continue
          const l1 = ((by - cyy) * (x - cxx) + (cxx - bx) * (y - cyy)) / d
          const l2 = ((cyy - ay) * (x - cxx) + (ax - cxx) * (y - cyy)) / d
          const l3 = 1 - l1 - l2
          if (l1 < 0 || l2 < 0 || l3 < 0) continue
          hits++
        }
      }
      rays++
      hist[hits] = (hist[hits] ?? 0) + 1
      if (hits > maxHits) maxHits = hits
      if (hits > 2 && worst.length < 8) worst.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), hits })
    }
  }
  const over2 = Object.entries(hist)
    .filter(([h]) => Number(h) > 2)
    .reduce((s, [, c]) => s + c, 0)
  return { rays, hist, maxHits, over2, worst }
}

/* ==========================================================================
 * THE CENSUS'S BLINDNESS, MADE MEASURABLE
 *
 * `probeDihedral` (components/viewport-3d.tsx) scores every shared edge as
 *
 *     min( acos(n0·n1), acos(−n0·n1) )
 *
 * which is bounded by 90 and is SMALLEST when the two faces are antiparallel —
 * i.e. exactly when one has folded back over the other. A fold therefore reads
 * as a SMALL crease. That is not a bug in the arithmetic; it is what a dihedral
 * angle IS, and no threshold on it can be made fold-sensitive. Explainer 17 §2
 * records the cost: a whole defect (the extrude seam flap) that every number
 * called clean and one frame called broken.
 *
 * So the fix is not a better threshold, it is a SECOND QUESTION asked of the
 * same buffers — how many sheets does a −Z ray cross — and the three functions
 * below are what it takes to ask it honestly:
 *
 *   creaseCensusNode      a faithful Node mirror of probeDihedral, so the
 *                         blindness can be demonstrated on a synthetic without
 *                         a renderer, and cross-checked against the real one on
 *                         the real buffers before it is believed.
 *   meshComponents        connected components of the index buffer. A fold is a
 *                         mesh passing through ITSELF; two crossing strokes are
 *                         two shells passing through EACH OTHER, which in the
 *                         per-stroke modes is documented behaviour, not a
 *                         regression. Counting sheets per component keeps those
 *                         two questions apart.
 *   foldCensusComponents  the sheet count, per component, over the component's
 *                         own XY extent.
 *   syntheticFoldTube     a swept tube built the way the loft builds one, whose
 *                         fold is decided in closed form by the same predicate
 *                         the engine uses. The negative control.
 * ======================================================================== */

/** Faithful Node mirror of `__geomDebug.probeDihedral`, on raw buffers. */
export function creaseCensusNode(pos, idx, filter = null) {
  const triCount = idx.length / 3
  const NORMAL_EPS = 1e-14
  const faceN = []
  const edges = new Map()
  let degenerateTriangles = 0
  const key = (i) =>
    `${Math.round(pos[i * 3] * 1e5)},${Math.round(pos[i * 3 + 1] * 1e5)},${Math.round(pos[i * 3 + 2] * 1e5)}`
  for (let t = 0; t < triCount; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2]
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2]
    const e1x = pos[b * 3] - ax, e1y = pos[b * 3 + 1] - ay, e1z = pos[b * 3 + 2] - az
    const e2x = pos[c * 3] - ax, e2y = pos[c * 3 + 1] - ay, e2z = pos[c * 3 + 2] - az
    const nx = e1y * e2z - e1z * e2y
    const ny = e1z * e2x - e1x * e2z
    const nz = e1x * e2y - e1y * e2x
    const len = Math.hypot(nx, ny, nz)
    if (!(len > NORMAL_EPS)) {
      faceN.push(null)
      degenerateTriangles++
      continue
    }
    faceN.push({ x: nx / len, y: ny / len, z: nz / len })
    const ka = key(a), kb = key(b), kc = key(c)
    for (const [p, q] of [[ka, kb], [kb, kc], [kc, ka]]) {
      const ek = p < q ? `${p}|${q}` : `${q}|${p}`
      const list = edges.get(ek)
      if (list) list.push(t)
      else edges.set(ek, [t])
    }
  }
  const buckets = { wall: [], cap: [], mixed: [] }
  let boundaryEdges = 0
  let nonManifoldEdges = 0
  for (const [ek, list] of edges.entries()) {
    if (list.length === 1) { boundaryEdges++; continue }
    if (list.length > 2) { nonManifoldEdges++; continue }
    const [t0, t1] = list
    const n0 = faceN[t0], n1 = faceN[t1]
    if (!n0 || !n1) continue
    if (filter) {
      const [pa, pb] = ek.split("|").map((s) => s.split(",").map(Number))
      const mid = [(pa[0] + pb[0]) / 2e5, (pa[1] + pb[1]) / 2e5, (pa[2] + pb[2]) / 2e5]
      if (!filter(mid)) continue
    }
    const dot = Math.min(1, Math.max(-1, n0.x * n1.x + n0.y * n1.y + n0.z * n1.z))
    const deg = Math.min((Math.acos(dot) * 180) / Math.PI, (Math.acos(-dot) * 180) / Math.PI)
    const w0 = Math.abs(n0.z) < 0.4, w1 = Math.abs(n1.z) < 0.4
    const c0 = Math.abs(n0.z) > 0.9, c1 = Math.abs(n1.z) > 0.9
    buckets[w0 && w1 ? "wall" : c0 && c1 ? "cap" : "mixed"].push(deg)
  }
  const stat = (a) => {
    if (!a.length) return { n: 0, mean: 0, max: 0, over30: 0 }
    let s = 0, m = 0, o = 0
    for (const v of a) { s += v; if (v > m) m = v; if (v > 30) o++ }
    return { n: a.length, mean: Number((s / a.length).toFixed(2)), max: Number(m.toFixed(2)), over30: o }
  }
  return {
    triangles: triCount,
    degenerateTriangles,
    boundaryEdges,
    nonManifoldEdges,
    wall: stat(buckets.wall),
    cap: stat(buckets.cap),
    mixed: stat(buckets.mixed),
  }
}

/** Connected components of the triangle soup, by shared VERTEX INDEX. */
export function meshComponents(idx, vertCount) {
  const parent = new Int32Array(vertCount)
  for (let i = 0; i < vertCount; i++) parent[i] = i
  const find = (x) => {
    let r = x
    while (parent[r] !== r) r = parent[r]
    while (parent[x] !== r) { const nx = parent[x]; parent[x] = r; x = nx }
    return r
  }
  const union = (a, b) => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  const triCount = idx.length / 3
  for (let t = 0; t < triCount; t++) {
    union(idx[t * 3], idx[t * 3 + 1])
    union(idx[t * 3 + 1], idx[t * 3 + 2])
  }
  const label = new Map()
  const triComp = new Int32Array(triCount)
  for (let t = 0; t < triCount; t++) {
    const r = find(idx[t * 3])
    let l = label.get(r)
    if (l === undefined) { l = label.size; label.set(r, l) }
    triComp[t] = l
  }
  return { count: label.size, triComp }
}

/**
 * Sheets crossed by a −Z ray, PER CONNECTED COMPONENT, over that component's
 * own XY extent.
 *
 *   a closed embedded shell   every ray hits 0 or 2
 *   a folded shell            rays over the fold hit 4, 6, ...
 *
 * `areaEps` drops triangles whose XY projection is degenerate. A triangle
 * parallel to the ray is the silhouette, not a crossing: the ray lies IN its
 * plane, so counting it is a coin flip decided by float noise, and a swept tube
 * is full of them (every ring plane contains Z). `rayCensus` above skips only
 * `d === 0` exactly, which is why this is a separate function rather than an
 * edit to a calibrated one.
 *
 * ---------------------------------------------------------------------------
 * THREE THINGS MAKE A RAY CROSS MORE THAN TWO SHEETS, AND ONLY ONE IS A FOLD.
 * ---------------------------------------------------------------------------
 * The first version of this gate counted sheets and stopped, and it fired on
 * six of sixteen fixture/mode rows on its first run. Opening every flagged ray
 * (`scripts/verify/_probe-fold-truth.mjs`) showed the hits fall into classes
 * that want opposite responses:
 *
 *   FOLD          extra hits at DISTINCT depths, forming extra enter/exit
 *                 pairs. The surface genuinely passes through itself. Measured
 *                 on `circle/inflate` at its closed-loop seam: z = 0.0576,
 *                 0.0213, −0.0213, −0.0576, |n.z| 0.75 / 0.31 / 0.31 / 0.75.
 *   COPLANAR      every extra hit at the SAME depth as another, with |n.z| = 1
 *   OVERLAP       — a cap plane covered two or three times over. Measured on
 *                 `square/extrude` (three cap triangles at z = +0.0175 at each
 *                 mitred corner) and on `square|circle|crossing/solid` (the
 *                 earcut cap). The solid's boundary is unchanged as a point
 *                 set; the TRIANGULATION covers part of it more than once.
 *                 Real, worth a number, and NOT what a fold gate is for.
 *   SLIVER        a silhouette triangle nearly parallel to the ray. Zero
 *                 observed once `areaEps` was in place, and reported anyway so
 *                 that stays true.
 *
 * A gate that cannot tell those apart fires on four fixtures on day one and
 * gets switched off, which is how a real fold would then ship.
 */
export function foldCensusComponents(pos, idx, { grid = 61, areaEpsRel = 1e-9, maxComponents = 64, zEpsRel = 1e-4 } = {}) {
  const vertCount = pos.length / 3
  const { count, triComp } = meshComponents(idx, vertCount)
  const triCount = idx.length / 3
  let dx = 0, dy = 0
  {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (let i = 0; i < vertCount; i++) {
      const x = pos[i * 3], y = pos[i * 3 + 1]
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    dx = x1 - x0
    dy = y1 - y0
  }
  const areaEps = areaEpsRel * (dx * dx + dy * dy)
  const out = []
  for (let comp = 0; comp < Math.min(count, maxComponents); comp++) {
    const tris = []
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
    for (let t = 0; t < triCount; t++) {
      if (triComp[t] !== comp) continue
      tris.push(t)
      for (let k = 0; k < 3; k++) {
        const v = idx[t * 3 + k]
        const x = pos[v * 3], y = pos[v * 3 + 1]
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
    if (!tris.length) continue
    const padX = (x1 - x0) * 0.02 + 1e-6
    const padY = (y1 - y0) * 0.02 + 1e-6
    const minX = x0 - padX, minY = y0 - padY
    const binX = (x1 - x0 + 2 * padX) / grid
    const binY = (y1 - y0 + 2 * padY) / grid
    const cell = new Map()
    const key = (i, j) => i * 100003 + j
    for (const t of tris) {
      const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3
      const tx0 = Math.min(pos[a], pos[b], pos[c]), tx1 = Math.max(pos[a], pos[b], pos[c])
      const ty0 = Math.min(pos[a + 1], pos[b + 1], pos[c + 1]), ty1 = Math.max(pos[a + 1], pos[b + 1], pos[c + 1])
      const i0 = Math.max(0, Math.floor((tx0 - minX) / binX))
      const i1 = Math.min(grid - 1, Math.floor((tx1 - minX) / binX))
      const j0 = Math.max(0, Math.floor((ty0 - minY) / binY))
      const j1 = Math.min(grid - 1, Math.floor((ty1 - minY) / binY))
      for (let i = i0; i <= i1; i++) {
        for (let j = j0; j <= j1; j++) {
          const k = key(i, j)
          let l = cell.get(k)
          if (!l) cell.set(k, (l = []))
          l.push(t)
        }
      }
    }
    // Irrational jitter so a ray cannot land on a shared EDGE, where both
    // triangles contain it and a clean mesh would report 4.
    const JX = 0.2360679775
    const JY = 0.3819660113
    const hist = {}
    let maxHits = 0
    let over2 = 0
    let foldRays = 0
    let maxFoldSheets = 0
    let coplanarRays = 0
    let sliverRays = 0
    const worst = []
    const worstCoplanar = []
    // Depth tolerance for "the same plane". Scaled to the component's own Z
    // extent so it means the same thing on a 0.035-deep ribbon and a 0.15-deep
    // solid, rather than being an absolute number tuned on one fixture.
    let zLo = Infinity
    let zHi = -Infinity
    for (const t of tris) {
      for (let k = 0; k < 3; k++) {
        const z = pos[idx[t * 3 + k] * 3 + 2]
        if (z < zLo) zLo = z
        if (z > zHi) zHi = z
      }
    }
    const zEps = Math.max((zHi - zLo) * zEpsRel, 1e-12)
    for (let j = 0; j < grid; j++) {
      for (let i = 0; i < grid; i++) {
        const x = minX + (i + JX) * binX
        const y = minY + (j + JY) * binY
        const list = cell.get(key(i, j))
        let hits = 0
        const zs = []
        let slivers = 0
        if (list) {
          for (const t of list) {
            const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3
            const ax = pos[a], ay = pos[a + 1], az = pos[a + 2]
            const bx = pos[b], by = pos[b + 1], bz = pos[b + 2]
            const cx = pos[c], cy = pos[c + 1], cz = pos[c + 2]
            const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
            if (Math.abs(d) < areaEps) continue
            const l1 = ((by - cy) * (x - cx) + (cx - bx) * (y - cy)) / d
            const l2 = ((cy - ay) * (x - cx) + (ax - cx) * (y - cy)) / d
            const l3 = 1 - l1 - l2
            if (l1 < 0 || l2 < 0 || l3 < 0) continue
            hits++
            zs.push(l1 * az + l2 * bz + l3 * cz)
            // |n.z|, without normalising: the ratio of the projected area to
            // the true area IS |n.z|, and `d` is twice the projected area.
            const e1x = bx - ax, e1y = by - ay, e1z = bz - az
            const e2x = cx - ax, e2y = cy - ay, e2z = cz - az
            const nx = e1y * e2z - e1z * e2y
            const ny = e1z * e2x - e1x * e2z
            const nz = e1x * e2y - e1y * e2x
            const L = Math.hypot(nx, ny, nz) || 1
            if (Math.abs(nz / L) < 0.02) slivers++
          }
        }
        hist[hits] = (hist[hits] ?? 0) + 1
        if (hits > maxHits) maxHits = hits
        if (hits > 2) {
          over2++
          if (worst.length < 6) worst.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), hits })
          // How many DISTINCT depths were crossed? Coplanar duplicates collapse
          // to one. A genuinely folded solid still has more than two.
          zs.sort((p, q) => p - q)
          let distinct = 1
          for (let k = 1; k < zs.length; k++) if (zs[k] - zs[k - 1] > zEps) distinct++
          const extras = hits - 2
          if (distinct > 2) {
            foldRays++
            if (distinct > maxFoldSheets) maxFoldSheets = distinct
          } else if (slivers >= extras) {
            sliverRays++
          } else {
            coplanarRays++
            if (worstCoplanar.length < 6) {
              worstCoplanar.push({ x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), hits, distinctDepths: distinct })
            }
          }
        }
      }
    }
    out.push({
      component: comp,
      triangles: tris.length,
      rays: grid * grid,
      hist,
      maxHits,
      over2,
      foldRays,
      maxFoldSheets,
      coplanarRays,
      sliverRays,
      worst,
      worstCoplanar,
    })
  }
  return {
    components: count,
    rows: out,
    maxHits: out.reduce((m, r) => Math.max(m, r.maxHits), 0),
    over2: out.reduce((s, r) => s + r.over2, 0),
    /** The gated quantity: rays crossing more than two DISTINCT depths. */
    foldRays: out.reduce((s, r) => s + r.foldRays, 0),
    maxFoldSheets: out.reduce((m, r) => Math.max(m, r.maxFoldSheets), 0),
    /** Reported, not gated: a cap plane covered more than once. */
    coplanarRays: out.reduce((s, r) => s + r.coplanarRays, 0),
    sliverRays: out.reduce((s, r) => s + r.sliverRays, 0),
  }
}

/**
 * A swept tube built THE WAY THE LOFT BUILDS ONE — rings square across the
 * tangent — around a 90 degree corner, at a chosen centre-point spacing.
 *
 * The engine's own predicate (`inflateChainFoldMetric`, lib/geometry-engines.ts)
 * says a ring pair folds exactly when
 *
 *     (rᵢ + rᵢ₊₁)·sin(Δθ/2) − h  >  0
 *
 * Here Δθ is 45 degrees at each of the two rings flanking the corner (the corner
 * ring takes the bisector), so with a constant radius r the fold condition is
 * simply `2r·sin(22.5°) = 0.7654 r > h`. `spacingOverR` therefore decides the
 * answer IN CLOSED FORM, which is what makes this a control and not a demo:
 * 0.5 folds by 0.265 r, 1.5 cannot fold at all.
 *
 * Returns { pos, idx, foldDepthOverR, corner, r }.
 */
export function syntheticFoldTube(r = 1, spacingOverR = 0.5, ringSegs = 24, leadOverR = 4) {
  const s = spacingOverR * r
  const lead = leadOverR * r
  // Corner at the origin; legs along −X (incoming) and +Y (outgoing).
  const c = [
    { x: -lead - s, y: 0 },
    { x: -s, y: 0 },
    { x: 0, y: 0 },
    { x: 0, y: s },
    { x: 0, y: s + lead },
  ]
  const tan = c.map((_, i) => {
    const prev = c[Math.max(0, i - 1)]
    const next = c[Math.min(c.length - 1, i + 1)]
    let tx = next.x - prev.x
    let ty = next.y - prev.y
    const L = Math.hypot(tx, ty) || 1
    return { x: tx / L, y: ty / L }
  })
  // The engine's fold predicate, evaluated on this chain.
  let foldDepth = -Infinity
  for (let i = 0; i + 1 < c.length; i++) {
    const h = Math.hypot(c[i + 1].x - c[i].x, c[i + 1].y - c[i].y)
    const dot = Math.max(-1, Math.min(1, tan[i].x * tan[i + 1].x + tan[i].y * tan[i + 1].y))
    const depth = 2 * r * Math.sin(Math.acos(dot) / 2) - h
    if (depth > foldDepth) foldDepth = depth
  }
  const pos = []
  const idx = []
  for (let i = 0; i < c.length; i++) {
    const T = tan[i]
    const Sx = -T.y, Sy = T.x // rot90 in XY, exactly as inflateBuildEllipticalTube
    for (let k = 0; k < ringSegs; k++) {
      const th = (k / ringSegs) * Math.PI * 2
      const ca = Math.cos(th) * r
      const sa = Math.sin(th) * r
      pos.push(c[i].x + Sx * ca, c[i].y + Sy * ca, sa)
    }
  }
  for (let i = 0; i + 1 < c.length; i++) {
    const a = i * ringSegs
    const b = (i + 1) * ringSegs
    for (let k = 0; k < ringSegs; k++) {
      const k1 = (k + 1) % ringSegs
      idx.push(a + k, b + k, b + k1)
      idx.push(a + k, b + k1, a + k1)
    }
  }
  // Flat end caps, fanned from a centre vertex. Identical on the folded and the
  // clean twin, so they cannot be what separates the two readings.
  for (const [ringIdx, flip] of [[0, true], [c.length - 1, false]]) {
    const base = pos.length / 3
    pos.push(c[ringIdx].x, c[ringIdx].y, 0)
    const a = ringIdx * ringSegs
    for (let k = 0; k < ringSegs; k++) {
      const k1 = (k + 1) % ringSegs
      if (flip) idx.push(base, a + k1, a + k)
      else idx.push(base, a + k, a + k1)
    }
  }
  return {
    pos: Float64Array.from(pos),
    idx: Int32Array.from(idx),
    foldDepthOverR: foldDepth / r,
    corner: { x: 0, y: 0 },
    r,
  }
}
