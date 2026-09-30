// _PROBE-PENTIP-RIBBON — the PROTOTYPE for the repaired ruler, and the bench it
// was tuned on. `assert-drawin-pentip.mjs` carries the finished version.
//
// `_probe-pentip-forensic.mjs` settled WHAT is wrong with the shipped
// instrument, byte-for-byte against its own `pentip.json`:
//
//   * its per-playhead readings have an IQR of 0.59 w to 1.32 w, on every arm of
//     both captures, while the ENTIRE cut→nib range it is trying to resolve is
//     0.462 w. The ruler's noise is larger than its subject.
//   * a median of 27.7 % (max 87.4 %) of the ink inside its measuring disc
//     belongs to OTHER STROKES of the word. `f(u)` is drawn-ink over
//     finished-ink, and foreign ink sits in both sums, so those bins answer a
//     question about STROKE ORDER, not about the shape of the moving end.
//
// ── WHAT THIS PROTOTYPE CHANGES, AND WHY EACH IS FORCED ────────────────────
//
//  1. THE COORDINATE IS ARC LENGTH ALONG THE PEN PATH, NOT A CARTESIAN AXIS.
//     The shipped ruler projects every pixel in a disc of 2.5 w onto ONE tangent
//     taken at the pen point. The mark curves inside that disc — its own header
//     admits this and calls it one of three reasons the nib control only reaches
//     63 % of its closed form. Give every pixel the arc `a` and offset `rho` of
//     its nearest point on the path and the axis follows the mark exactly.
//
//     This also makes the closed form EXACT rather than aspirational. A disc of
//     radius w swept along the path covers the ribbon point (a, rho) once the
//     pen reaches `a - sqrt(w² - rho²)`, so at arc offset u the covered share is
//     `sqrt(1 - (u/w)²)` and the F_HI→F_LO span is 0.462 w — the same number the
//     shipped header derives but could only reach 63 % of, because it was
//     measuring that geometry in the wrong coordinates.
//
//  2. ONLY THE STROKE THAT OWNS THE PEN. A pixel whose nearest path point is on
//     a different stroke is dropped. So is one on a different PASS of the same
//     stroke (|a − d| outside the window), which is how a loop that re-enters
//     the disc gets in.
//
//  3. INK TWO STROKES BOTH LAID DOWN IS DROPPED. At a crossing the same pixels
//     belong to both strokes; if the other one is already drawn they read as
//     "already drawn" ahead of the pen no matter what the tip does. Each pixel
//     therefore carries its distance to the nearest OTHER stroke as well.
//
//  4. THE HALF-WIDTH IS LOCAL. The shipped ruler normalises everything by one
//     median half-width for the whole word. The mark tapers and wobbles; the
//     bin population behind the pen measures the half-width where the pen
//     actually is, as an area rather than a ray, so a threshold notch cannot
//     halve it.
//
// Toggle each with --own=0 --shared=0 --ribbon=0 to see what it is worth.
//
// Usage: node scripts/verify/_probe-pentip-ribbon.mjs --label=lane-paneltip
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, isAbsolute } from "node:path"
import { createRequire } from "node:module"
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"
import { loadTs } from "./_ts-load.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const { revealDistanceFraction } = loadTs("lib/pen-reveal.ts")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "lane-paneltip")
const DIR = isAbsolute(arg("dir", "")) ? arg("dir") : join(ROOT, "docs", "verification", "pentip", LABEL)
const USE_OWN = arg("own", "1") !== "0"
const USE_SHARED = arg("shared", "1") !== "0"
const USE_RIBBON = arg("ribbon", "1") !== "0"

const MODE = "hybrid"
const BLEND = 0.4
const F_HI = 0.85
const F_LO = 0.15
const NIB_IDEAL_W = Math.sqrt(1 - F_LO * F_LO) - Math.sqrt(1 - F_HI * F_HI)
/** Arc window either side of the pen, in half-widths. */
const ARC_WINDOW_W = 3.0
/** Ink further off the centreline than this is a junction blob, not the ribbon. */
const RHO_CAP_W = 1.7
/** How far the path may turn inside the window before the ribbon folds. */
const TURN_CAP = (parseFloat(arg("turn", "50")) * Math.PI) / 180
/** Ink this close to ANOTHER stroke's centreline was laid down twice. */
const SHARED_W = 1.15
/** Bin pitch, in half-widths — scale free. 0.025 w puts 18.5 bins across the
 *  closed-form nib span, against the 8 the resolution bar asks for. */
const BIN_W = 0.025

const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null)
const quant = (a, q) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]
}

async function inkMask(path) {
  const img = await loadImage(path)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(img.width * img.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  const m = new Uint8Array(luma.length)
  for (let p = 0; p < luma.length; p++) m[p] = luma[p] < cut ? 1 : 0
  return { m, w: img.width, h: img.height }
}

async function main() {
  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8"))
  const strokes = processedHeroStrokes()

  const pts = []
  const strokeEndArc = []
  let total = 0
  for (const s of strokes)
    for (let i = 1; i < s.points.length; i++)
      total += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
  {
    let acc = 0
    let si = 0
    for (const s of strokes) {
      for (let i = 0; i < s.points.length; i++) {
        if (i > 0) acc += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
        pts.push({ x: s.points[i].x, y: s.points[i].y, arc: acc, stroke: si })
      }
      strokeEndArc.push(acc)
      si++
    }
  }
  const sMinX = Math.min(...pts.map((p) => p.x))
  const sMaxX = Math.max(...pts.map((p) => p.x))
  const sMinY = Math.min(...pts.map((p) => p.y))
  const sMaxY = Math.max(...pts.map((p) => p.y))

  console.log(
    `reading ${DIR}\nown=${USE_OWN ? 1 : 0} shared=${USE_SHARED ? 1 : 0} ribbon=${USE_RIBBON ? 1 : 0}\n`,
  )

  for (const engine of Object.keys(meta.engines)) {
    const samples = meta.engines[engine]
    const { m: fin, w: W, h: H } = await inkMask(
      join(DIR, engine, `${String(samples.length - 1).padStart(3, "0")}.png`),
    )

    /* ---- fit (identical to the assert) --------------------------------- */
    let bMinX = W, bMaxX = -1, bMinY = H, bMaxY = -1
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (fin[y * W + x]) {
          if (x < bMinX) bMinX = x
          if (x > bMaxX) bMaxX = x
          if (y < bMinY) bMinY = y
          if (y > bMaxY) bMaxY = y
        }
    const cxS = (bMinX + bMaxX) / 2
    const cyS = (bMinY + bMaxY) / 2
    const cxP = (sMinX + sMaxX) / 2
    const cyP = (sMinY + sMaxY) / 2
    const sHi = (bMaxX - bMinX) / (sMaxX - sMinX)
    const mk = (sc, fl) => (p) => ({ x: cxS + (p.x - cxP) * sc, y: cyS + (p.y - cyP) * sc * fl })
    const score = (f) => {
      let on = 0
      for (const p of pts) {
        const q = f(p)
        const xi = Math.round(q.x)
        const yi = Math.round(q.y)
        if (xi >= 0 && xi < W && yi >= 0 && yi < H && fin[yi * W + xi]) on++
      }
      return on / pts.length
    }
    let best = { sc: sHi, fl: 1, v: -1 }
    for (const fl of [1, -1])
      for (let i = 0; i <= 80; i++) {
        const sc = sHi * (0.55 + (0.45 * i) / 80)
        const v = score(mk(sc, fl))
        if (v > best.v) best = { sc, fl, v }
      }
    const SC = best.sc
    const toScreen = mk(best.sc, best.fl)
    const totalPx = total * SC
    const nomHalf = (HERO_INK_WIDTH_PX / 2) * SC

    const spath = pts.map((p) => {
      const q = toScreen(p)
      return { x: q.x, y: q.y, arcPx: p.arc * SC, stroke: p.stroke }
    })

    /* ---- THE RIBBON FIELD: for every pixel near the path, the arc and offset
     * of its nearest path point, the stroke that owns it, and the distance to
     * the nearest point of a DIFFERENT stroke. Rasterised by stamping each
     * segment's neighbourhood, which is linear in the path. */
    const REACH = RHO_CAP_W * nomHalf * 1.6
    const nRho = new Float32Array(W * H).fill(Infinity)
    const nArc = new Float32Array(W * H)
    const nStr = new Int16Array(W * H).fill(-1)
    const nRho2 = new Float32Array(W * H).fill(Infinity)
    const nStr2 = new Int16Array(W * H).fill(-1)
    for (let i = 1; i < spath.length; i++) {
      const a = spath[i - 1]
      const b = spath[i]
      if (a.stroke !== b.stroke) continue
      const vx = b.x - a.x
      const vy = b.y - a.y
      const L2 = vx * vx + vy * vy
      const x0 = Math.max(0, Math.floor(Math.min(a.x, b.x) - REACH))
      const x1 = Math.min(W - 1, Math.ceil(Math.max(a.x, b.x) + REACH))
      const y0 = Math.max(0, Math.floor(Math.min(a.y, b.y) - REACH))
      const y1 = Math.min(H - 1, Math.ceil(Math.max(a.y, b.y) + REACH))
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          let t = L2 > 0 ? ((x - a.x) * vx + (y - a.y) * vy) / L2 : 0
          t = t < 0 ? 0 : t > 1 ? 1 : t
          const px = a.x + vx * t
          const py = a.y + vy * t
          const d = Math.hypot(x - px, y - py)
          if (d > REACH) continue
          const p = y * W + x
          if (d < nRho[p]) {
            if (nStr[p] !== a.stroke && nStr[p] !== -1) {
              nRho2[p] = nRho[p]
              nStr2[p] = nStr[p]
            }
            nRho[p] = d
            nArc[p] = a.arcPx + (b.arcPx - a.arcPx) * t
            nStr[p] = a.stroke
          } else if (a.stroke !== nStr[p] && d < nRho2[p]) {
            nRho2[p] = d
            nStr2[p] = a.stroke
          }
        }
    }

    /* ---- global half-width, for windows only (the measurement uses local) - */
    const at = (arcPx) => {
      const arcU = arcPx / SC
      let i = 1
      while (i < pts.length && pts[i].arc < arcU) i++
      if (i >= pts.length) i = pts.length - 1
      const a = toScreen(pts[i - 1])
      const b = toScreen(pts[i])
      const seg = Math.hypot(b.x - a.x, b.y - a.y)
      const f = seg > 0 ? (arcPx - pts[i - 1].arc * SC) / seg : 0
      return {
        P: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f },
        T: seg > 0 ? { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg } : { x: 1, y: 0 },
        stroke: pts[i].stroke,
      }
    }
    /* THE HALF-WIDTH, FROM THE RIBBON FIELD AND NOT FROM A RAY.
     *
     * Every earlier attempt measured it by walking a perpendicular ray, which
     * is why the shipped instrument reads 17.50 px on one capture and 14.25 on
     * another: at a stroke end the tangent is poor, the ray runs ALONG the mark
     * instead of across it, and the walk returns a length rather than a width.
     *
     * `nRho` already holds every ink pixel's true distance from the centreline.
     * For a ribbon of half-width w that distance is uniform on [0, w], so
     * `2 · mean(rho)` is an unbiased estimate and no tangent, ray or threshold
     * crossing is involved. Reported beside its own percentiles so the shape of
     * the distribution is visible rather than assumed. */
    const rhoStats = (test) => {
      let n = 0
      let s = 0
      const all = []
      for (let p = 0; p < fin.length; p++) {
        if (!fin[p] || nStr[p] === -1) continue
        if (!test(p)) continue
        n++
        s += nRho[p]
        all.push(nRho[p])
      }
      all.sort((a, b) => a - b)
      const q = (f) => all[Math.min(all.length - 1, Math.floor(f * all.length))] ?? 0
      return { n, mean2: n ? (2 * s) / n : 0, p50: q(0.5), p90: q(0.9), p97: q(0.97), max: all[all.length - 1] ?? 0 }
    }
    const gs = rhoStats(() => true)
    const wG = gs.mean2
    console.log(
      `  [rho over the whole word]  2·mean ${gs.mean2.toFixed(2)}  p50 ${gs.p50.toFixed(2)}  ` +
        `p90 ${gs.p90.toFixed(2)}  p97 ${gs.p97.toFixed(2)}  max ${gs.max.toFixed(2)}  n ${gs.n}`,
    )
    const BIN = BIN_W * wG
    const ARC_W = ARC_WINDOW_W * wG
    const RHO_CAP = RHO_CAP_W * wG

    /** The ribbon sample set at pen arc d: index list + local half-width. */
    const windowAt = (d, penStroke) => {
      const idx = []
      const P = at(d).P
      const bx0 = Math.max(0, Math.floor(P.x - ARC_W - RHO_CAP - 4))
      const bx1 = Math.min(W - 1, Math.ceil(P.x + ARC_W + RHO_CAP + 4))
      const by0 = Math.max(0, Math.floor(P.y - ARC_W - RHO_CAP - 4))
      const by1 = Math.min(H - 1, Math.ceil(P.y + ARC_W + RHO_CAP + 4))
      let dropForeign = 0
      let dropShared = 0
      for (let y = by0; y <= by1; y++)
        for (let x = bx0; x <= bx1; x++) {
          const p = y * W + x
          if (!fin[p]) continue
          if (nStr[p] === -1) continue
          if (nRho[p] > RHO_CAP) continue
          const u = nArc[p] - d
          if (u < -ARC_W || u > ARC_W) continue
          if (USE_OWN && nStr[p] !== penStroke) {
            dropForeign++
            continue
          }
          if (USE_SHARED && nStr2[p] !== -1 && nRho2[p] <= SHARED_W * wG) {
            dropShared++
            continue
          }
          idx.push(p)
        }
      return { idx, dropForeign, dropShared }
    }

    /** f(u) over a sample set, u in ARC coordinates (or Cartesian if --ribbon=0).
     *
     * Returns BOTH candidate statistics so they can be compared on the same
     * bins rather than argued about:
     *
     *   tw     the shipped one - the span between the LAST bin at or above 0.85
     *          and the FIRST at or below 0.15. Two bins out of ~150 decide it,
     *          so one contaminated bin moves the answer by its whole range.
     *   sigma  the standard deviation of (-df/du) after a non-increasing
     *          isotonic fit. f runs 1 -> 0 across the moving end, so -df/du is a
     *          density and its spread IS the width of that end. Every bin
     *          contributes, the isotonic fit makes the density non-negative by
     *          construction, and it does not care WHERE the boundary sits.
     *          Closed form: a CUT is 0; a disc nose of radius r has
     *          f = sqrt(1-(u/r)^2) on [0,r], whose density has E[u] = (pi/4) r
     *          and E[u^2] = (2/3) r^2, so sigma = 0.22327 r.
     */
    const transition = (idx, d, M, wLoc, tangent) => {
      const nb = Math.ceil((2 * ARC_W) / BIN) + 1
      const bF = new Float64Array(nb)
      const bM = new Float64Array(nb)
      const P = at(d).P
      for (const p of idx) {
        let u
        if (USE_RIBBON) u = nArc[p] - d
        else {
          const x = p % W
          const y = (p - x) / W
          u = (x - P.x) * tangent.x + (y - P.y) * tangent.y
        }
        const b = Math.floor((u + ARC_W) / BIN)
        if (b < 0 || b >= nb) continue
        bF[b]++
        if (M[p]) bM[b]++
      }
      const minPop = Math.max(1, 0.125 * 2 * wLoc * BIN)
      const f = new Array(nb).fill(null)
      for (let b = 0; b < nb; b++) if (bF[b] >= minPop) f[b] = bM[b] / bF[b]

      /* ---- the shipped statistic: two threshold crossings ---------------- */
      let tw = null
      let u50 = null
      let iHi = -1
      for (let b = 0; b < nb; b++) if (f[b] !== null && f[b] >= F_HI) iHi = b
      if (iHi >= 0) {
        let iLo = -1
        for (let b = iHi + 1; b < nb; b++)
          if (f[b] !== null && f[b] <= F_LO) {
            iLo = b
            break
          }
        if (iLo >= 0) {
          const lerp = (i, dir, level) => {
            let j = i + dir
            while (j >= 0 && j < nb && f[j] === null) j += dir
            if (j < 0 || j >= nb) return i * BIN
            const a = f[i]
            const b2 = f[j]
            if (a === b2) return i * BIN
            const t = (a - level) / (a - b2)
            return (i + dir * Math.max(0, Math.min(1, t))) * BIN
          }
          tw = Math.max(0, lerp(iLo, -1, F_LO) - lerp(iHi, +1, F_HI))
        }
      }
      let i50 = -1
      for (let b = 0; b < nb; b++) if (f[b] !== null && f[b] >= 0.5) i50 = b
      if (i50 >= 0) u50 = i50 * BIN - ARC_W

      /* ---- the whole-curve statistic ------------------------------------- */
      const U = []
      const V = []
      const Wt = []
      for (let b = 0; b < nb; b++)
        if (f[b] !== null) {
          U.push(b * BIN - ARC_W + BIN / 2)
          V.push(f[b])
          Wt.push(bF[b])
        }
      let sigma = null
      let head = null
      let tail = null
      let twIso = null
      let twIso50 = null
      let uMid = null
      let isoAt = null
      if (U.length >= 12) {
        // POOL-ADJACENT-VIOLATORS, fitting the best NON-INCREASING curve.
        const bv = []
        const bw = []
        const bn = []
        for (let i = 0; i < V.length; i++) {
          let v = V[i]
          let w2 = Wt[i]
          let n2 = 1
          while (bv.length && bv[bv.length - 1] < v) {
            const pv = bv.pop()
            const pw = bw.pop()
            const pn = bn.pop()
            v = (v * w2 + pv * pw) / (w2 + pw)
            w2 += pw
            n2 += pn
          }
          bv.push(v)
          bw.push(w2)
          bn.push(n2)
        }
        const g = []
        for (let i = 0; i < bv.length; i++) for (let j = 0; j < bn[i]; j++) g.push(bv[i])
        head = g[0]
        tail = g[g.length - 1]
        const span = head - tail
        if (span > 0.6) {
          let m1 = 0
          let m2 = 0
          for (let i = 0; i + 1 < g.length; i++) {
            const dw = (g[i] - g[i + 1]) / span
            const uc = (U[i] + U[i + 1]) / 2
            m1 += dw * uc
            m2 += dw * uc * uc
          }
          const v2 = m2 - m1 * m1
          sigma = v2 > 0 ? Math.sqrt(v2) : 0
        }
        /* THE CROSSINGS, TAKEN ON THE MONOTONE FIT. `g` is non-increasing by
         * construction, so each level is crossed exactly once and there is no
         * "last bin above" to be moved by a single contaminated bin. */
        isoAt = (L) => {
          if (head < L) return U[0]
          if (tail > L) return U[U.length - 1]
          for (let i = 0; i + 1 < g.length; i++) {
            if (g[i] >= L && g[i + 1] <= L) {
              const a = g[i]
              const b = g[i + 1]
              const t = a === b ? 0 : (a - L) / (a - b)
              return U[i] + (U[i + 1] - U[i]) * t
            }
          }
          return U[U.length - 1]
        }
        if (head >= F_HI && tail <= F_LO) {
          twIso = isoAt(F_LO) - isoAt(F_HI)
          twIso50 = isoAt(0.25) - isoAt(0.75)
          uMid = isoAt(0.5)
        }
      }
      return { tw, sigma, u50, head, tail, twIso, twIso50, uMid }
    }
    /* ---- per playhead --------------------------------------------------- */
    const rows = []
    const rejects = { ends: 0, turn: 0, crowded: 0, unreadable: 0 }
    for (let k = 5; k < samples.length - 4; k++) {
      const phaseT = samples[k].phaseT
      const dFrac = revealDistanceFraction(strokes, phaseT, MODE, BLEND)
      const d = dFrac * totalPx
      if (d < 4 * wG || d > totalPx - 4 * wG) continue
      const { P, T, stroke: penStroke } = at(d)

      /* ── THE THREE GEOMETRIC GATES ON WHETHER THIS PLAYHEAD IS MEASURABLE.
       * Each is a property of the PATH, decided before a pixel is read, so
       * none of them can be a way of dropping a row whose answer is inconvenient.
       * Every rejection is counted and printed. */
      const sArc0 = strokeEndArc[penStroke - 1] ?? 0
      const sArc1 = strokeEndArc[penStroke]
      // 1 · the pen must have body behind it and mark ahead of it, on ITS stroke
      if (d - sArc0 * SC < 2.5 * wG || sArc1 * SC - d < 2.5 * wG) {
        rejects.ends++
        continue
      }
      // 2 · the path must not turn hard inside the window, or the ribbon folds
      let turn = 0
      {
        let prev = null
        for (let a = d - ARC_WINDOW_W * wG; a <= d + ARC_WINDOW_W * wG; a += wG / 2) {
          const t = at(a).T
          if (prev) turn += Math.abs(Math.atan2(prev.x * t.y - prev.y * t.x, prev.x * t.x + prev.y * t.y))
          prev = t
        }
      }
      if (turn > TURN_CAP) {
        rejects.turn++
        continue
      }
      const { idx, dropForeign, dropShared } = windowAt(d, penStroke)
      // 3 · the window must be mostly the pen's own clean ink
      const dropped = dropForeign + dropShared
      if (idx.length < 400 || dropped / (idx.length + dropped) > 0.15) {
        rejects.crowded++
        continue
      }

      /* THE LOCAL HALF-WIDTH AND THE NIB RADIUS ARE THE SAME NUMBER, AND IT IS
       * THE INK'S OWN REACH OFF THE CENTRELINE — read from the body behind the
       * pen, where the mark is at full width by construction. `2·mean(rho)` is
       * the unbiased estimate for a uniform ribbon and is the one the score is
       * normalised by; the disc control needs the EXTENT rather than the mean,
       * or a disc smaller than the ink under-reads its own closed form. */
      const bodyRho = []
      for (const p of idx) {
        const u = nArc[p] - d
        if (u >= -3.0 * wG && u <= -1.0 * wG) bodyRho.push(nRho[p])
      }
      if (bodyRho.length < 100) continue
      bodyRho.sort((a, b) => a - b)
      const bq = (f) => bodyRho[Math.min(bodyRho.length - 1, Math.floor(f * bodyRho.length))]
      /* THE HALF-WIDTH IS 2 x THE MEDIAN OFFSET, NOT THE MEAN AND NOT A
       * PERCENTILE OF THE EXTENT. For a ribbon of half-width W the offset rho
       * is uniform on [0, W], so median(rho) = W/2 exactly. The mean has the
       * same expectation but the distribution has a heavy UPPER tail — junction
       * blobs, corner fill and the protruding endpoints all put ink further off
       * the centreline than the ribbon reaches — and the median ignores it by
       * construction while the mean and every high quantile do not. Measured on
       * the hero word: p50 6.21 px against a uniform-consistent W of 12.42,
       * while p90 reads 12.27 where uniform would give 11.18. */
      const MULT = parseFloat(arg("mult", "2.0"))
      const WEST = arg("west", "areal")
      /* THE AREAL ESTIMATE IS EXACTLY UNBIASED UNDER CURVATURE, WHICH IS WHY IT
       * WINS. In ribbon coordinates the area element is (1 + rho*kappa) da drho,
       * and integrating rho from -W to +W kills the kappa term outright:
       * the count of ink pixels per unit ARC is 2W however the mark curves.
       * Every offset-based estimate (mean, median, any percentile of rho) is
       * biased upward on a curve instead, because the outside of a bend carries
       * more pixels per unit arc at larger rho. */
      let nBody = 0
      for (const p of idx) {
        const u = nArc[p] - d
        if (u >= -3.0 * wG && u <= -1.0 * wG) nBody++
      }
      const wAreal = nBody / (2 * 2.0 * wG)
      const rNib = WEST === "areal" ? wAreal : MULT * bq(0.5)
      const wLoc = rNib
      if (!(wLoc > 0.4 * wG && wLoc < 1.8 * wG)) continue

      const mask = await inkMask(join(DIR, engine, `${String(k).padStart(3, "0")}.png`))
      const real = transition(idx, d, mask.m, wLoc, T)

      // controls, on the SAME sample set and the same playhead
      const cutM = new Uint8Array(fin.length)
      for (const p of idx) if (nArc[p] <= d) cutM[p] = 1
      const hpM = new Uint8Array(fin.length)
      for (const p of idx) {
        const x = p % W
        const y = (p - x) / W
        if ((x - P.x) * T.x + (y - P.y) * T.y <= 0) hpM[p] = 1
      }
      /* THE NIB CONTROL, IN THE RIBBON'S OWN COORDINATES. A disc of radius r
       * swept along the path first covers the ribbon point (a, rho) when the
       * pen reaches `a − sqrt(r² − rho²)`, so the prefix is a per-pixel test on
       * the two numbers the field already holds. Sweeping an actual raster disc
       * (what the shipped instrument does) adds a rasterisation error of half a
       * pixel to a quantity of a few, for no gain. */
      const nibM = new Uint8Array(fin.length)
      for (const p of idx) {
        const rho = nRho[p]
        if (rho > rNib) continue
        if (nArc[p] <= d + Math.sqrt(rNib * rNib - rho * rho)) nibM[p] = 1
      }
      const cut = transition(idx, d, cutM, wLoc, T)
      const hp = transition(idx, d, hpM, wLoc, T)
      const nib = transition(idx, d, nibM, wLoc, T)
      if (real.twIso === null || cut.twIso === null || nib.twIso === null) {
        rejects.unreadable++
        continue
      }
      /* A ROW WHOSE OWN CONTROLS DO NOT SEPARATE IS NOT A READING. The shipped
       * instrument divides by (nib − cut) unconditionally, which is where the
       * 1e13 scores come from: a denominator of one bin. */
      const sepBins = (nib.tw - cut.tw) / BIN
      const sc = nib.tw !== null && cut.tw !== null && real.tw !== null && sepBins >= 8
        ? (real.tw - cut.tw) / (nib.tw - cut.tw)
        : null
      const scS = nib.sigma > cut.sigma ? (real.sigma - cut.sigma) / (nib.sigma - cut.sigma) : null
      rows.push({
        k,
        dFrac,
        wLoc,
        px: idx.length,
        dropForeign,
        dropShared,
        realW: real.tw === null ? null : real.tw / wLoc,
        u50W: real.u50 === null ? null : real.u50 / wLoc,
        cutW: cut.tw === null ? null : cut.tw / wLoc,
        hpW: hp.tw === null ? null : hp.tw / wLoc,
        nibW: nib.tw === null ? null : nib.tw / wLoc,
        score: sc,
        sReal: real.twIso / wLoc,
        sCut: cut.twIso / wLoc,
        sNib: nib.twIso / wLoc,
        sHp: hp.twIso === null ? null : hp.twIso / wLoc,
        sScore: nib.twIso > cut.twIso ? (real.twIso - cut.twIso) / (nib.twIso - cut.twIso) : null,
        qReal: real.twIso50 / wLoc,
        qCut: cut.twIso50 / wLoc,
        qNib: nib.twIso50 / wLoc,
        head: real.head,
        tail: real.tail,
      })
    }

    const S = rows.map((r) => r.score).filter((v) => v !== null)
    const RW = rows.map((r) => r.realW).filter((v) => v !== null)
    const NW = rows.map((r) => r.nibW).filter((v) => v !== null)
    const CW = rows.map((r) => r.cutW).filter((v) => v !== null)
    const sR = rows.map((r) => r.sReal)
    const sN = rows.map((r) => r.sNib)
    const sC = rows.map((r) => r.sCut)
    const sS = rows.map((r) => r.sScore).filter((v) => v !== null)
    const SIG_IDEAL = NIB_IDEAL_W
    const qR = rows.map((r) => r.qReal)
    const qN = rows.map((r) => r.qNib)
    const Q_IDEAL = Math.sqrt(1 - 0.25 ** 2) - Math.sqrt(1 - 0.75 ** 2)
    console.log(`=== ${engine} ===`)
    console.log(
      `  w(global) ${wG.toFixed(2)} px · bin ${BIN.toFixed(3)} px · rows ${rows.length} · nominal ${nomHalf.toFixed(2)} px`,
    )
    console.log(
      `  measured   ${med(RW).toFixed(3)} w   IQR ${(quant(RW, 0.75) - quant(RW, 0.25)).toFixed(3)} w`,
    )
    console.log(
      `  CUT ctl    ${med(CW).toFixed(3)} w   IQR ${(quant(CW, 0.75) - quant(CW, 0.25)).toFixed(3)} w   ` +
        `| half-plane ${med(rows.map((r) => r.hpW)).toFixed(3)} w`,
    )
    console.log(
      `  NIB ctl    ${med(NW).toFixed(3)} w   IQR ${(quant(NW, 0.75) - quant(NW, 0.25)).toFixed(3)} w   ` +
        `(closed form ${NIB_IDEAL_W.toFixed(3)} w → ${((med(NW) / NIB_IDEAL_W) * 100).toFixed(0)} %)`,
    )
    console.log(
      `  PEN SCORE  ${med(S).toFixed(3)}   IQR ${(quant(S, 0.75) - quant(S, 0.25)).toFixed(3)}   ` +
        `p10 ${quant(S, 0.1).toFixed(2)} p90 ${quant(S, 0.9).toFixed(2)}`,
    )
    console.log(
      `  --- ISOTONIC CROSSINGS -----------------------------------------------`,
    )
    console.log(`  measured   ${med(sR).toFixed(4)} w   IQR ${(quant(sR, 0.75) - quant(sR, 0.25)).toFixed(4)} w`)
    console.log(`  CUT ctl    ${med(sC).toFixed(4)} w   IQR ${(quant(sC, 0.75) - quant(sC, 0.25)).toFixed(4)} w`)
    console.log(
      `  NIB ctl    ${med(sN).toFixed(4)} w   IQR ${(quant(sN, 0.75) - quant(sN, 0.25)).toFixed(4)} w   ` +
        `(closed form ${SIG_IDEAL.toFixed(4)} w -> ${((med(sN) / SIG_IDEAL) * 100).toFixed(0)} %)`,
    )
    console.log(
      `  PEN SCORE  ${sS.length ? med(sS).toFixed(3) : "—"}   IQR ${sS.length ? (quant(sS, 0.75) - quant(sS, 0.25)).toFixed(3) : "—"}   ` +
        `p10 ${sS.length ? quant(sS, 0.1).toFixed(2) : "—"} p90 ${sS.length ? quant(sS, 0.9).toFixed(2) : "—"}`,
    )
    console.log(
      `  q75->q25   real ${med(qR).toFixed(4)} w  IQR ${(quant(qR, 0.75) - quant(qR, 0.25)).toFixed(4)}  |  ` +
        `NIB ctl ${med(qN).toFixed(4)} w  IQR ${(quant(qN, 0.75) - quant(qN, 0.25)).toFixed(4)}  ` +
        `(closed form ${Q_IDEAL.toFixed(4)} -> ${((med(qN) / Q_IDEAL) * 100).toFixed(0)} %)`,
    )
    console.log(`  rejected: ends ${rejects.ends} · hard turn ${rejects.turn} · crowded ${rejects.crowded} · unreadable ${rejects.unreadable}`)
    console.log(`   k  dFrac   wLoc    px  foreign shared   real    cut    nib   score   u50   |  sReal  sCut  sNib  sScore  head tail`)
    for (const r of rows)
      console.log(
        `  ${String(r.k).padStart(2)}  ${r.dFrac.toFixed(3)}  ${r.wLoc.toFixed(1).padStart(5)} ${String(r.px).padStart(5)}` +
          ` ${String(r.dropForeign).padStart(7)} ${String(r.dropShared).padStart(6)}` +
          `  ${(r.realW ?? 0).toFixed(3)}  ${(r.cutW ?? 0).toFixed(3)}  ${(r.nibW ?? 0).toFixed(3)}  ${r.score === null ? "  —  " : r.score.toFixed(3)}  ${(r.u50W ?? 0).toFixed(2)}` +
          `  | ${r.sReal.toFixed(4)} ${r.sCut.toFixed(4)} ${r.sNib.toFixed(4)}  ${r.sScore === null ? "  —  " : r.sScore.toFixed(3)}  ${r.head.toFixed(2)} ${r.tail.toFixed(2)}`,
      )
    console.log("")
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
