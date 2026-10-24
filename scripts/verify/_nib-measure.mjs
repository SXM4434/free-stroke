/**
 * THE NIB'S INSTRUMENT — build the word, rasterise its silhouette, and measure
 * the half-width perpendicular to travel along every centreline.
 *
 * N6, 2026-08-28. Extracted so `assert-nib-contrast.mjs` (the gate) and
 * `_probe-nib-sweep.mjs` (the dial sweep that argues for the default) measure
 * with ONE ruler. A sweep that recommends a number using a second copy of the
 * measurement is recommending a number the gate has never seen.
 *
 * `docs/research/stroke-width-models.md` §1.1 is the law being checked:
 *
 *     h(psi) = sqrt( a^2 sin^2 psi + b^2 cos^2 psi ),   psi = theta - alpha
 *
 * ⚠ EVERYTHING HERE IS A CLAIM ABOUT THE MESH. `INFLATE_DEBUG.nibContrastBuilt`
 * is the same ratio computed from the formula, so it reads 1.80 for a nib that
 * never reached a vertex. These functions read pixels off the built surface.
 */
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes } from "./_hero-word.mjs"
const require = createRequire(import.meta.url)
const { createCanvas } = require("@napi-rs/canvas")

const GE = loadTs("lib/geometry-engines.ts")
/* BOTH ENGINE FAMILIES THROUGH ONE RULER.
 *
 * N8, 2026-08-28. The nib landed on Free Stroke and `desk-doodles` came back
 * byte-identical because `lib/dd-engine/adapter.ts` never read `inflateParams`
 * (`docs/RUN-QUEUE.md` F34) — and this instrument could not have caught it,
 * because it called `GE.getEngine("inflate")` by name and so could only ever
 * measure the family that already had the fix. A gate that cannot address the
 * surface the complaint is about is a gate that reports green about something
 * else. `getEngineFor` is the app's own switch, so the family the gate measures
 * is the family the header pill selects. */
const REG = loadTs("lib/engine-registry.ts")
export const FAMILIES = REG.ENGINE_FAMILIES.map((f) => f.value)
const strokes = processedHeroStrokes()

const CANVAS_W = 1100
const CANVAS_H = 242
/** Raster texels per world unit. 900 puts the stroke radius at ~28 px, so a
 *  half-width is measured with about 3 % quantisation before any averaging. */
const PPU = 900
/** The hero's own inflate dials — `app/desk-doodles/page.tsx` HERO_INFLATE. */
const HERO_INFLATE = { fusion: "implicit", blend: 0.45, resolution: 5 }

/* ---------------------------------------------------------------------- */
/*  BUILD + RASTERISE                                                      */
/* ---------------------------------------------------------------------- */

export function buildMask(overrides, applyTwice = false, family = "free-stroke") {
  const params = { ...GE.DEFAULT_INFLATE_PARAMS, ...HERO_INFLATE, ...overrides }
  const meshes = REG.getEngineFor("inflate", family).buildPreview(strokes, {
    canvasWidth: CANVAS_W,
    canvasHeight: CANVAS_H,
    solidParams: GE.DEFAULT_SOLID_PARAMS,
    inflateParams: params,
  })
  const dbg = JSON.parse(JSON.stringify(GE.INFLATE_DEBUG))
  const geos = meshes.map((m) => m.tubeGeometry).filter(Boolean)
  if (geos.length === 0) throw new Error("no geometry built")

  /* THE `doubled` ARM. Not simulated — the SAME map the engine applies, applied
   * a second time, so the control reproduces the real defect rather than a
   * drawing of it. */
  if (applyTwice) {
    const n = GE.inflateResolveNib(params)
    for (const g of geos) {
      const pa = g.getAttribute("position").array
      for (let i = 0; i < pa.length; i += 3) {
        const x = pa[i]
        const y = pa[i + 1]
        const u = (x * n.ca + y * n.sa) * n.a
        const v = (-x * n.sa + y * n.ca) * n.b
        pa[i] = u * n.ca - v * n.sa
        pa[i + 1] = u * n.sa + v * n.ca
      }
    }
  }

  // World bounds, from the geometry itself — never a guessed frame.
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const g of geos) {
    const pa = g.getAttribute("position").array
    for (let i = 0; i < pa.length; i += 3) {
      if (pa[i] < x0) x0 = pa[i]
      if (pa[i] > x1) x1 = pa[i]
      if (pa[i + 1] < y0) y0 = pa[i + 1]
      if (pa[i + 1] > y1) y1 = pa[i + 1]
    }
  }
  const PAD = 0.05
  x0 -= PAD; y0 -= PAD; x1 += PAD; y1 += PAD
  const W = Math.ceil((x1 - x0) * PPU)
  const H = Math.ceil((y1 - y0) * PPU)
  const cv = createCanvas(W, H)
  const ctx = cv.getContext("2d")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = "#000000"
  // World y is up, raster y is down.
  const sx = (x) => (x - x0) * PPU
  const sy = (y) => (y1 - y) * PPU
  for (const g of geos) {
    const pa = g.getAttribute("position").array
    const idx = g.getIndex()
    const ia = idx ? idx.array : null
    const tri = ia ? ia.length / 3 : pa.length / 9
    /* FILLED IN BATCHES, and the batch size is not decoration. One
     * `beginPath` holding 76 000 triangles rasterised to ZERO ink — the path
     * is silently dropped, with no throw and no warning, which is the exact
     * silent-degradation shape: an empty mask reports every width as zero and
     * the gate would have gone red for a reason that has nothing to do with the
     * nib. Batched, each fill is a few thousand closed subpaths. */
    const BATCH = 2000
    for (let t0 = 0; t0 < tri; t0 += BATCH) {
      ctx.beginPath()
      for (let t = t0; t < Math.min(tri, t0 + BATCH); t++) {
        const a = ia ? ia[t * 3] : t * 3
        const b = ia ? ia[t * 3 + 1] : t * 3 + 1
        const c = ia ? ia[t * 3 + 2] : t * 3 + 2
        const ax = sx(pa[a * 3]), ay = sy(pa[a * 3 + 1])
        let bx = sx(pa[b * 3]), by = sy(pa[b * 3 + 1])
        let cx = sx(pa[c * 3]), cy = sy(pa[c * 3 + 1])
        /* ⚠ WINDING IS NORMALISED, AND THIS IS THE WHOLE RASTERISER.
         * A closed mesh projected to 2D lays its BACK faces over its front
         * faces with the opposite winding, so under the nonzero rule the two
         * cancel to zero and the silhouette comes out EMPTY — measured here at
         * 5 028 ink texels of 2.2 M, i.e. only the slivers where the two sheets
         * did not overlap. Flipping every triangle to one handedness makes every
         * face contribute +1 and the fill becomes the union, which is what a
         * silhouette is. */
        if ((bx - ax) * (cy - ay) - (cx - ax) * (by - ay) < 0) {
          const tx = bx, ty = by
          bx = cx; by = cy; cx = tx; cy = ty
        }
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)
        ctx.lineTo(cx, cy)
        ctx.closePath()
      }
      ctx.fill()
    }
  }
  const px = ctx.getImageData(0, 0, W, H).data
  const mask = new Uint8Array(W * H)
  let ink = 0
  for (let i = 0, p = 0; i < W * H; i++, p += 4) {
    if (px[p] < 128) {
      mask[i] = 1
      ink++
    }
  }
  /* THE RULER'S OWN UNIT, AND IT MAY NOT BE READ OFF A DEBUG GLOBAL FOR A
   * FAMILY THAT NEVER WRITES ONE. `INFLATE_DEBUG` belongs to Free Stroke's
   * engine; on a `desk-doodles` build it holds whatever the LAST free-stroke
   * build left there, so `radiusXY` would be a stale number from another arm and
   * every half-width in radii would be scaled by it. Derived instead, from the
   * dial both families read: `inflateStrokeRadiusXY` and the adapter's
   * `inflateBaseRadiusDD × ddToFsScale` are the same expression,
   * `effectiveThicknessPx × coordScale / 2`. */
  const radiusXY =
    (GE.computeSolidEffectiveThicknessPx(GE.DEFAULT_SOLID_PARAMS.thickness) *
      (3.0 / Math.max(CANVAS_W, CANVAS_H))) /
    2
  /* THE DIAL, RESOLVED, CARRIED WITH THE MASK — for the same staleness reason as
   * `radiusXY` above. `fitNibAngleDeg` needs the semi-axes it is fitting AGAINST,
   * and reading them from `INFLATE_DEBUG` on a `desk-doodles` build handed the
   * fit `a = b = 0`, which made it return 0° for every arm — a hairline-angle row
   * that reports the same answer whatever the pen is doing. */
  return { mask, W, H, ink, x0, y1, dbg, radiusXY, family, nib: GE.inflateResolveNib(params) }
}

/** Canvas px → world, the engine's own `px2w`. */
function px2w(p) {
  const coordScale = 3.0 / Math.max(CANVAS_W, CANVAS_H)
  return { x: (p.x - CANVAS_W / 2) * coordScale, y: -(p.y - CANVAS_H / 2) * coordScale }
}

/* ---------------------------------------------------------------------- */
/*  MEASURE — half-width perpendicular to travel, along the centreline     */
/* ---------------------------------------------------------------------- */

export function measure(m) {
  const R = m.radiusXY
  const at = (x, y) => {
    const ix = Math.round((x - m.x0) * PPU)
    const iy = Math.round((m.y1 - y) * PPU)
    if (ix < 0 || iy < 0 || ix >= m.W || iy >= m.H) return 0
    return m.mask[iy * m.W + ix]
  }
  /** March along `(nx,ny)` until the mask ends. Returns the distance in R. */
  const reach = (x, y, nx, ny) => {
    const step = 1 / PPU
    let d = 0
    for (let k = 1; k < Math.ceil(3 * R * PPU); k++) {
      d = k * step
      if (!at(x + nx * d, y + ny * d)) return d - step
    }
    return d
  }

  const samples = []
  let inside = 0
  let tested = 0
  for (const s of strokes) {
    const pts = s.points.map(px2w)
    // Cumulative arc, so stroke ends can be excluded — the terminal taper is a
    // different law and would masquerade as hairline travel.
    const cum = [0]
    for (let i = 1; i < pts.length; i++) {
      cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
    }
    const total = cum[cum.length - 1]
    for (let i = 2; i < pts.length - 2; i++) {
      const p = pts[i]
      tested++
      if (at(p.x, p.y)) inside++
      if (cum[i] < 2 * R || total - cum[i] < 2 * R) continue
      const dx = pts[i + 2].x - pts[i - 2].x
      const dy = pts[i + 2].y - pts[i - 2].y
      const L = Math.hypot(dx, dy)
      if (L < 1e-9) continue
      const tx = dx / L
      const ty = dy / L
      const nx = -ty
      const ny = tx
      const dp = reach(p.x, p.y, nx, ny)
      const dm = reach(p.x, p.y, -nx, -ny)
      /* REJECTED: fusion blobs and crossings. Both sides of a clean stroke agree
       * to within a few per cent; where another stroke has merged, one ray runs
       * on for radii. Filtering on the ASYMMETRY rather than on a width ceiling
       * is what keeps a genuinely thick stroke in the sample. */
      const h = (dp + dm) / 2
      if (h <= 0 || Math.abs(dp - dm) > 0.35 * (dp + dm)) continue
      if (h > 2.2 * R) continue
      samples.push({ theta: Math.atan2(dy, dx), h: h / R, u: total > 0 ? cum[i] / total : 0.5 })
    }
  }
  return { samples, insideFrac: tested ? inside / tested : 0 }
}

/**
 * THE MIDDLE OF THE STROKE, AND WHY THE CENSUS IS RESTRICTED TO IT.
 *
 * N8, 2026-08-28, measured while carrying the nib to `desk-doodles`. Half-width
 * depends on TWO things, and this instrument only wants one of them. Desk
 * Doodles' Inflate is a variable-radius capsule whose radius runs
 * `tip + (base − tip)·sin(πu)^0.8` along the stroke (`strokeTo3d.ts` :1147-1150),
 * so a direction bin fed mostly by stroke ENDS reads thin for a reason that has
 * nothing to do with the pen. Over the whole stroke the ROUND pen on that family
 * measures **1.676 : 1** of apparent contrast — above the 1.56 floor this gate
 * asks the nib for. A known-bad that cannot go red is the 53rd dead gate.
 *
 * Restricting the census to the middle 60 % of each stroke's arc costs the free
 * stroke family NOTHING and fixes Desk Doodles:
 *
 *       arc band        FS round   FS nib   DD round   DD nib
 *       0.0 – 1.0        1.203     1.784     1.676     2.920
 *       0.2 – 0.8        1.203     1.784     1.163     1.780
 *
 * **Free Stroke's two numbers do not move at all**, which is the argument that
 * this removes a confound rather than moving a goalpost: N6's recorded 1.784 : 1
 * is the same measurement it always was. `sin(π·0.2)^0.8 = 0.65` is still a real
 * taper inside the band, but it is a taper both arms share and neither arm's
 * direction census is built out of it.
 *
 * `insideFrac` and the sample COUNT are deliberately still computed over the
 * whole stroke, so the instrument row keeps its honest denominator.
 */
export const ARC_BAND = [0.2, 0.8]

/** Median half-width per 10° direction bin, directions mod 180°, over ARC_BAND. */
export function binByDirection(samples, band = ARC_BAND) {
  const NB = 18
  const bins = Array.from({ length: NB }, () => [])
  for (const s of samples) {
    if (s.u < band[0] || s.u > band[1]) continue
    const a = ((s.theta % Math.PI) + Math.PI) % Math.PI
    bins[Math.min(NB - 1, Math.floor((a / Math.PI) * NB))].push(s.h)
  }
  return bins.map((b, i) => {
    b.sort((x, y) => x - y)
    return { degWorld: i * 10 + 5, n: b.length, median: b.length ? b[Math.floor(b.length / 2)] : NaN }
  })
}

/**
 * THE NIB ANGLE THE MESH ACTUALLY HAS — a fit, not an argmin.
 *
 * The first version took the thinnest 10° bin and called that the pen angle. It
 * was 15° off on a word whose direction census is nothing like uniform, because
 * the thinnest bin is decided as much by which directions the word visits as by
 * where the hairline is. Fitting the whole `h(psi)` curve uses every bin and its
 * sample count, so a lopsided census moves the answer by far less.
 *
 * Only `alpha` is fitted; `a` and `b` come from the dial, so this asks "is the
 * mesh's width law the one that was requested, and pointing which way" rather
 * than "what is the best ellipse". A scale is fitted alongside it so that a
 * uniformly heavier or lighter mesh cannot masquerade as a rotated one.
 */
export function fitNibAngleDeg(bins, a, b) {
  let best = { deg: 0, err: Infinity }
  for (let d = 0; d < 180; d += 1) {
    const alpha = (d * Math.PI) / 180
    let num = 0
    let den = 0
    for (const bin of bins) {
      const th = (bin.degWorld * Math.PI) / 180
      const s = Math.sin(th - alpha)
      const c = Math.cos(th - alpha)
      const model = Math.sqrt(a * a * s * s + b * b * c * c)
      num += bin.n * bin.median * model
      den += bin.n * model * model
    }
    const k = den > 0 ? num / den : 1
    let err = 0
    for (const bin of bins) {
      const th = (bin.degWorld * Math.PI) / 180
      const s = Math.sin(th - alpha)
      const c = Math.cos(th - alpha)
      const model = k * Math.sqrt(a * a * s * s + b * b * c * c)
      err += bin.n * (bin.median - model) ** 2
    }
    if (err < best.err) best = { deg: d, err }
  }
  return best.deg
}

/** Enclosed background regions — the counters. Flood from the border first. */
/**
 * COUNTERS WITH THEIR POSITIONS — so two arms can be compared counter BY
 * counter instead of rank by rank.
 *
 * A rank list cannot answer "which one closed": a counter that shuts renumbers
 * every row below it, so the reported minimum can RISE while a letter shuts.
 * Measured on this word: the round pen's smallest counter is 551 texels and the
 * nib's is 601, which reads as an improvement and is not one — the 551 dropped
 * to 297 and fell under the reporting floor, and 601 is the next one up.
 * Matching by centroid is what makes the comparison mean anything.
 *
 * `floor` is deliberately low here. At 400 texels the COUNT is a threshold
 * artefact (7 → 6 across a counter that is still open at 297); at 8 the count is
 * 7 both sides and the shrinkage is visible as what it is.
 */
export function counterRegions(mask, W, H, floor = 8) {
  const out = new Uint8Array(W * H)
  const st = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = y * W + x
    if (out[i] || mask[i]) return
    out[i] = 1
    st.push(i)
  }
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1) }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y) }
  while (st.length) {
    const i = st.pop(); const x = i % W; const y = (i / W) | 0
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }
  const seen = new Uint8Array(W * H)
  const regs = []
  for (let i = 0; i < W * H; i++) {
    if (mask[i] || out[i] || seen[i]) continue
    let a = 0, sx = 0, sy = 0
    seen[i] = 1
    const s2 = [i]
    while (s2.length) {
      const j = s2.pop(); a++
      const x = j % W; const y = (j / W) | 0
      sx += x; sy += y
      for (const k of [x + 1 < W ? j + 1 : -1, x - 1 >= 0 ? j - 1 : -1, y + 1 < H ? j + W : -1, y - 1 >= 0 ? j - W : -1]) {
        if (k < 0 || seen[k] || mask[k] || out[k]) continue
        seen[k] = 1
        s2.push(k)
      }
    }
    if (a >= floor) regs.push({ area: a, cx: sx / a, cy: sy / a })
  }
  return regs.sort((p, q) => p.cx - q.cx)
}

/**
 * THE WORST SINGLE COUNTER, as a fraction of what the round pen gave it.
 *
 * The area total cannot see one letter shutting, because the pixels a closed
 * counter loses reappear in the ones that survive. This asks the question per
 * letter: 1.0 means every counter is at least as open as it was; 0.011 is what
 * `nibAngleDeg: 0` does to the `o` at x≈876, which is the eye going out.
 */
export function worstCounterRatio(refRegs, regs, tol = 60) {
  let worst = Infinity
  let at = null
  for (const r of refRegs) {
    const hit = regs.find((q) => Math.hypot(q.cx - r.cx, q.cy - r.cy) < tol)
    const ratio = hit ? hit.area / r.area : 0
    if (ratio < worst) { worst = ratio; at = { x: Math.round(r.cx), was: r.area, now: hit ? hit.area : 0 } }
  }
  return { worst, at }
}

export function counters(mask, W, H, minArea) {
  const out = new Uint8Array(W * H)
  const st = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = y * W + x
    if (out[i] || mask[i]) return
    out[i] = 1
    st.push(i)
  }
  for (let x = 0; x < W; x++) { push(x, 0); push(x, H - 1) }
  for (let y = 0; y < H; y++) { push(0, y); push(W - 1, y) }
  while (st.length) {
    const i = st.pop(); const x = i % W; const y = (i / W) | 0
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
  }
  const seen = new Uint8Array(W * H)
  const areas = []
  for (let i = 0; i < W * H; i++) {
    if (mask[i] || out[i] || seen[i]) continue
    let area = 0
    seen[i] = 1
    const s2 = [i]
    while (s2.length) {
      const j = s2.pop(); area++
      const x = j % W; const y = (j / W) | 0
      for (const k of [x + 1 < W ? j + 1 : -1, x - 1 >= 0 ? j - 1 : -1, y + 1 < H ? j + W : -1, y - 1 >= 0 ? j - W : -1]) {
        if (k < 0 || seen[k] || mask[k] || out[k]) continue
        seen[k] = 1
        s2.push(k)
      }
    }
    if (area >= minArea) areas.push(area)
  }
  areas.sort((a, b) => b - a)
  return areas
}

/** The ink's principal axis, degrees. A doubled `A` tilts the whole word. */
export function principalAxisDeg(mask, W, H) {
  let n = 0, sx = 0, sy = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) { n++; sx += x; sy += y }
  const mx = sx / n, my = sy / n
  let cxx = 0, cxy = 0, cyy = 0
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (mask[y * W + x]) {
    const a = x - mx, b = y - my
    cxx += a * a; cxy += a * b; cyy += b * b
  }
  cxx /= n; cxy /= n; cyy /= n
  return (Math.atan2(2 * cxy, cxx - cyy) / 2) * (180 / Math.PI)
}

/* ---------------------------------------------------------------------- */
/*  ARMS                                                                   */
/* ---------------------------------------------------------------------- */

/** Counter area is measured in raster texels; 20 px at the film's scale is
 *  ~360 here, so the floor is scaled rather than copied. */
export const MIN_COUNTER = 400

export function arm(overrides, applyTwice = false, family = "free-stroke") {
  const m = buildMask(overrides, applyTwice, family)
  const { samples, insideFrac } = measure(m)
  const bins = binByDirection(samples).filter((b) => b.n >= 12)
  if (process.env.NIB_DEBUG) console.log("DBG samples", samples.length, "inside", insideFrac.toFixed(4), "bins", bins.length, "mask", m.W+"x"+m.H, "ink", m.ink, "R", m.radiusXY)
  const meds = bins.map((b) => b.median)
  const hi = Math.max(...meds)
  const lo = Math.min(...meds)
  const fittedDeg = fitNibAngleDeg(bins, m.nib.a, m.nib.b)
  const areas = counters(m.mask, m.W, m.H, MIN_COUNTER)
  const regions = counterRegions(m.mask, m.W, m.H)
  return {
    mask: m,
    dbg: m.dbg,
    nib: m.nib,
    family,
    samples: samples.length,
    insideFrac,
    bins,
    contrast: hi / lo,
    hi,
    lo,
    fittedAngleWorldDeg: fittedDeg,
    counters: areas,
    regions,
    counterTotal: areas.reduce((a, b) => a + b, 0),
    counterMin: areas.length ? areas[areas.length - 1] : 0,
    axisDeg: principalAxisDeg(m.mask, m.W, m.H),
    ink: m.ink,
  }
}


export { GE, strokes }
