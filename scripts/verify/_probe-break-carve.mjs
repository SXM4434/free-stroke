// THE BREAK, ON THE CARVED MARK — an offline model of the two shaders' product,
// so the fix can be SEARCHED instead of guessed one browser round-trip at a time.
//
// WHY THIS IS LEGITIMATE AND NOT A FIXTURE. Both shaders are `discard`: the pen
// carve intersects the rendered mark with the sign of `mix(tube, pen, carve)`
// sampled from `buildPenField`'s own bake, and the joint break intersects it
// with the complement of `buildJointBreaks`'s law. A discard does nothing else.
// So the product of the two masks IS the rendered mark's silhouette, and it can
// be evaluated in stroke space from the SAME two library functions the page
// calls — `buildPenField` / `samplePenField` / `buildJointBreaks`, imported, not
// re-implemented.
//
// It is CALIBRATED, not trusted: `--calibrate` prints the component counts this
// model produces at the shipped constants, and they have to land on the live
// gate's own verdict (K1 6, K7 9 at carve 1.00 — `assert-hero-k7-intact.mjs`,
// run 2026-08-01) before any number below it means anything.
//
// The junction set and the ink width are PULLED FROM THE LIVE PAGE and cached,
// never re-derived — `findHeroJunctions` lives in a React route and a second
// copy of it here is the two-sources-of-truth class this repo keeps paying for.
//
// ⚠ AND IT IS A MODEL, WHICH MEANS IT HAS A KNOWN EDGE. `--dilate=1` (the
// default) widens the cut by one pixel to stand in for the shader's coverage
// and the gate's luma threshold, and calibrated that way it reproduces the live
// gate exactly at the tube-sized law (9 components) — but at the carve-sized
// law it reads 7 where the live page reads 6, because one break (7→8) sits on
// the boundary. Every verdict in the return that could turn on one component
// was taken from the LIVE gate against a sandbox build, not from here. This
// finds the shape of the answer; the page decides it.
//
// Usage:
//   node scripts/verify/_probe-break-carve.mjs --pull [--prior]   refresh a cache
//   node scripts/verify/_probe-break-carve.mjs --geom             the junction table
//   node scripts/verify/_probe-break-carve.mjs --perBreak [--own] [--png]
//   node scripts/verify/_probe-break-carve.mjs --tube             the before picture
//   node scripts/verify/_probe-break-carve.mjs --sweep            a global keep sweep
//   node scripts/verify/_probe-break-carve.mjs --prior --guard [--noAEnd]
//   node scripts/verify/_probe-break-carve.mjs --diag=7-9         one break at 10x
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas } from "@napi-rs/canvas"
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "hero-k7", "break-carve")
const CACHE = join(OUT, process.argv.includes("--prior") ? "live-junctions-prior.json" : "live-junctions.json")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const has = (k) => process.argv.includes(`--${k}`)

const flat = loadTs("lib/flat-ink.ts")
const { buildPenField, samplePenField, buildJointBreaks, penHalfWidth, PEN_NIB_DEFAULT } = flat

/* ---------------------------------------------------------------------- */
/*  The live junction set — pulled once, cached, never re-derived here      */
/* ---------------------------------------------------------------------- */

async function pull() {
  const { chromium } = await import("./lib/browser.mjs")
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  if (has("prior"))
    await page.addInitScript(() => {
      window.__heroJunctionLaw = "prior"
    })
  await page.goto(HERO_URL, {
    waitUntil: "networkidle",
  })
  await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, {
    timeout: 90000,
  })
  await page.waitForTimeout(2500)
  const data = await page.evaluate(() => {
    const jg = window.__heroJunctions
    const proc = window.__handFeelHarness.processed
    let minX = Infinity
    let maxX = -Infinity
    for (const st of proc)
      for (const [x] of st) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
      }
    return {
      law: jg.law,
      inkWidth: jg.inkWidth,
      breakK: jg.breakK,
      list: jg.list,
      spanX: maxX - minX,
      strokeCount: proc.length,
    }
  })
  /* THE STAGE SCALE, off the live frame: the mark's px span over its stroke-unit
   * span. Connectivity is a raster property, so a model rastered at a different
   * resolution than the gate reads is a model of a different picture. */
  const box = await page.locator("[data-hero-stage]").boundingBox()
  const png = await page.screenshot({ clip: box })
  await browser.close()
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, "live-k7.png"), png)
  data.stageBox = box
  writeFileSync(CACHE, JSON.stringify(data, null, 2))
  console.log(
    `pulled: law=${data.law} · ${data.list.length} junctions · ink ${data.inkWidth.toFixed(3)} · ` +
      `breakK ${data.breakK} · spanX ${data.spanX.toFixed(1)} · ${data.strokeCount} strokes`,
  )
  return data
}

/* ---------------------------------------------------------------------- */
/*  The model                                                              */
/* ---------------------------------------------------------------------- */

const strokes = processedHeroStrokes().map((s) => ({ points: s.points }))

/** `walkOut` / `polyDist` from lib/flat-ink.ts, which does not export them. */
function walkOutLocal(pts, i, dist, sign) {
  let acc = 0
  let k = i
  for (;;) {
    const n = k + sign
    if (n < 0 || n >= pts.length) break
    acc += Math.hypot(pts[n].x - pts[k].x, pts[n].y - pts[k].y)
    k = n
    if (acc >= dist) break
  }
  return pts[k]
}
function polyDistLocal(qx, qy, p) {
  const seg = (ax, ay, bx, by) => {
    const vx = bx - ax
    const vy = by - ay
    const L = vx * vx + vy * vy
    const t = L > 0 ? Math.max(0, Math.min(1, ((qx - ax) * vx + (qy - ay) * vy) / L)) : 0
    return Math.hypot(ax + t * vx - qx, ay + t * vy - qy)
  }
  return Math.min(seg(p[0].x, p[0].y, p[1].x, p[1].y), seg(p[1].x, p[1].y, p[2].x, p[2].y))
}

/** Live px per stroke unit — measured on the shipped stage, see `--pull`. */
const PX_PER_UNIT = Number(arg("ppu", "0.5303"))
const MIN_COMPONENT_PX = 40
/** See `dilateRemoved` — 1 reproduces the live gate, 0 is the raw law. */
const DILATE = Number(arg("dilate", "1"))

function rasterCarved(field, carve, W, H, x0, y0, ppu) {
  const m = new Uint8Array(W * H)
  for (let y = 0; y < H; y++) {
    const sy = y0 + (y + 0.5) / ppu
    for (let x = 0; x < W; x++) {
      const sx = x0 + (x + 0.5) / ppu
      const f = samplePenField(field, sx, sy)
      const sd = f.tube + (f.pen - f.tube) * carve
      m[y * W + x] = sd <= 0 ? 1 : 0
    }
  }
  return m
}

/** The break law, as the shader runs it, over an already-carved mask. */
function applyBreaks(mask, breaks, keep, outer, reach, W, H, x0, y0, ppu) {
  const out = Uint8Array.from(mask)
  const seg = (qx, qy, ax, ay, bx, by) => {
    const vx = bx - ax
    const vy = by - ay
    const L = vx * vx + vy * vy
    const t = L > 0 ? Math.max(0, Math.min(1, ((qx - ax) * vx + (qy - ay) * vy) / L)) : 0
    return Math.hypot(ax + t * vx - qx, ay + t * vy - qy)
  }
  const near = (qx, qy, p) => {
    let best = null
    for (let s = 0; s < 2; s++) {
      const a = p[s]
      const b = p[s + 1]
      const vx = b.x - a.x
      const vy = b.y - a.y
      const L = vx * vx + vy * vy
      const raw = L > 0 ? ((qx - a.x) * vx + (qy - a.y) * vy) / L : 0
      const t = Math.max(0, Math.min(1, raw))
      const px = a.x + t * vx
      const py = a.y + t * vy
      const d = Math.hypot(px - qx, py - qy)
      if (!best || d < best.d) {
        const len = Math.sqrt(L)
        /* ⚠ THE ARC KEEPS COUNTING PAST THE SAMPLE'S END. `polyNearest` clamps
         * the projection, so a query BEYOND the three-point sample reports
         * arc === reach exactly and passes `arc <= reach` — the clause meant to
         * keep the break at the junction stops rejecting anything at the point
         * where it matters most. Carrying the overshoot makes the arc a real
         * distance again. */
        const over = s === 0 ? Math.max(0, -raw) * len : Math.max(0, raw - 1) * len
        best = { x: px, y: py, d, arc: (s === 0 ? (1 - t) * len : t * len) + over }
      }
    }
    return best
  }
  for (let y = 0; y < H; y++) {
    const qy = y0 + (y + 0.5) / ppu
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      if (!out[p]) continue
      const qx = x0 + (x + 0.5) / ppu
      for (const b of breaks) {
        const kp = b.keepUnder ?? keep
        const ko = b.keepOver ?? keep
        const ot = b.outer ?? outer
        const rc = b.reach ?? reach
        const n = near(qx, qy, b.under)
        if (n.d > kp || n.arc > rc) continue
        const dOver = Math.min(
          seg(n.x, n.y, b.over[0].x, b.over[0].y, b.over[1].x, b.over[1].y),
          seg(n.x, n.y, b.over[1].x, b.over[1].y, b.over[2].x, b.over[2].y),
        )
        if (dOver <= ko || dOver > ot) continue
        out[p] = 0
        break
      }
    }
  }
  return out
}

/** Nearest-centreline stroke index per texel — cheap ownership, good enough to
 *  say WHICH stroke an isolated fragment came off, which the component sizes
 *  cannot. */
function ownerMap(W, H, x0, y0, ppu) {
  const own = new Int16Array(W * H).fill(-1)
  for (let y = 0; y < H; y++) {
    const qy = y0 + (y + 0.5) / ppu
    for (let x = 0; x < W; x++) {
      const qx = x0 + (x + 0.5) / ppu
      let bd = Infinity
      let bi = -1
      for (let s = 0; s < strokes.length; s++) {
        for (const p of strokes[s].points) {
          const d = (p.x - qx) ** 2 + (p.y - qy) ** 2
          if (d < bd) {
            bd = d
            bi = s
          }
        }
      }
      own[y * W + x] = bi
    }
  }
  return own
}

/* THE LIVE CUT IS WIDER THAN THE MODEL'S BY ABOUT A PIXEL, and it has to be.
 * The shader converts the cut's signed distance to COVERAGE and the material
 * runs `alphaToCoverage`, so the boundary pixels are partial samples; the gate
 * then thresholds at luma 150, which drops the ones under about half coverage.
 * A hard-thresholded model cannot produce that. Dilating the removed set by one
 * pixel is the smallest correction that reproduces it, and it is CALIBRATED
 * rather than assumed: at the shipped tube-sized law it has to land on the live
 * gate's 9 components, and at the carve-sized law on its 7. */
function dilateRemoved(base, broken, W, H, n) {
  let out = Uint8Array.from(broken)
  for (let pass = 0; pass < n; pass++) {
    const next = Uint8Array.from(out)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = y * W + x
        if (!out[p] || !base[p]) continue
        for (let dy = -1; dy <= 1 && next[p]; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
            const q = ny * W + nx
            if (base[q] && !out[q]) {
              next[p] = 0
              break
            }
          }
      }
    out = next
  }
  return out
}

function components(mask, W, H) {
  const lab = new Int32Array(W * H).fill(-1)
  const sizes = []
  const stack = new Int32Array(W * H)
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || lab[s] >= 0) continue
    const id = sizes.length
    let sp = 0
    stack[sp++] = s
    lab[s] = id
    let n = 0
    while (sp > 0) {
      const q = stack[--sp]
      n++
      const x = q % W
      const y = (q / W) | 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const r = ny * W + nx
          if (!mask[r] || lab[r] >= 0) continue
          lab[r] = id
          stack[sp++] = r
        }
    }
    sizes.push(n)
  }
  sizes.sort((a, b) => b - a)
  return { all: sizes, real: sizes.filter((n) => n >= MIN_COMPONENT_PX) }
}

/** Components, each described by the strokes its pixels belong to. */
function describe(mask, W, H, own) {
  const lab = new Int32Array(W * H).fill(-1)
  const out = []
  const stack = new Int32Array(W * H)
  for (let s = 0; s < W * H; s++) {
    if (!mask[s] || lab[s] >= 0) continue
    const id = out.length
    let sp = 0
    stack[sp++] = s
    lab[s] = id
    let n = 0
    const tally = new Map()
    while (sp > 0) {
      const q = stack[--sp]
      n++
      const o = own[q]
      tally.set(o, (tally.get(o) ?? 0) + 1)
      const x = q % W
      const y = (q / W) | 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const r = ny * W + nx
          if (!mask[r] || lab[r] >= 0) continue
          lab[r] = id
          stack[sp++] = r
        }
    }
    out.push({
      n,
      strokes: [...tally.entries()].sort((a, b) => b[1] - a[1]).filter(([, v]) => v >= 8),
    })
  }
  return out.filter((c) => c.n >= MIN_COMPONENT_PX).sort((a, b) => b.n - a.n)
}

function writeMask(mask, W, H, name) {
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  const img = ctx.createImageData(W, H)
  for (let p = 0; p < W * H; p++) {
    const v = mask[p] ? 0 : 250
    img.data[p * 4] = v
    img.data[p * 4 + 1] = v
    img.data[p * 4 + 2] = v
    img.data[p * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  mkdirSync(OUT, { recursive: true })
  const path = join(OUT, name)
  writeFileSync(path, c.toBuffer("image/png"))
  return path
}

async function main() {
  if (has("pull")) {
    await pull()
    if (process.argv.length === 3) return
  }
  if (!existsSync(CACHE)) {
    console.error(`no cache at ${CACHE} — run with --pull first`)
    process.exit(2)
  }
  const live = JSON.parse(readFileSync(CACHE, "utf8"))
  const ink = live.inkWidth
  const R = ink / 2
  const breakK = live.breakK
  const ppu = PX_PER_UNIT

  const field = buildPenField(strokes, ink)
  const x0 = field.minX
  const y0 = field.minY
  const W = Math.ceil((field.maxX - field.minX) * ppu)
  const H = Math.ceil((field.maxY - field.minY) * ppu)

  /* ---- WHAT THE CARVED STROKE'S HALF-WIDTH ACTUALLY IS, PER JUNCTION -----
   * `keep` is meant to be "the ink half-width of the stroke": on the over
   * clause it is where the stroke in front ends, on the under clause it is how
   * far the cut may reach from the broken stroke's own centreline. The nib's
   * half-width is a function of TRAVEL DIRECTION, so it is not one number — it
   * is measured here before any of it is designed. Same derivation
   * `buildPenField` uses at each sample: theta from the neighbours, endArc from
   * the cumulative length. */
  const widthsAt = (pts, i) => {
    const a = pts[Math.max(0, i - 1)]
    const b = pts[Math.min(pts.length - 1, i + 1)]
    const theta = Math.atan2(b.y - a.y, b.x - a.x)
    let L = 0
    const cum = [0]
    for (let k = 1; k < pts.length; k++) {
      L += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y)
      cum.push(L)
    }
    const endArc = Math.min(cum[i], L - cum[i])
    return penHalfWidth(theta, endArc, R, PEN_NIB_DEFAULT)
  }
  const nearestIdx = (pts, x, y) => {
    let bi = 0
    let bd = Infinity
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2
      if (d < bd) {
        bd = d
        bi = i
      }
    }
    return bi
  }
  if (has("geom")) {
    console.log("per-junction carved half-widths (R = %s u):", R.toFixed(2))
    console.log("  under over    gap      w_under         w_over       (reach window min..max on over)")
    for (const jn of live.list) {
      const A = strokes[jn.under].points
      const B = strokes[jn.over].points
      const ai = nearestIdx(A, jn.x, jn.y)
      const bi = nearestIdx(B, jn.x, jn.y)
      const wU = widthsAt(A, ai)
      const wO = widthsAt(B, bi)
      // Across the ±reach window on the over stroke, which is the span the
      // band's inner bound actually has to hug.
      const reachU = 1.25 * ink
      let lo = Infinity
      let hi = -Infinity
      let acc = 0
      for (let k = bi; k < B.length; k++) {
        acc += k > bi ? Math.hypot(B[k].x - B[k - 1].x, B[k].y - B[k - 1].y) : 0
        if (acc > reachU) break
        const w = widthsAt(B, k)
        if (w < lo) lo = w
        if (w > hi) hi = w
      }
      acc = 0
      for (let k = bi; k >= 0; k--) {
        acc += k < bi ? Math.hypot(B[k].x - B[k + 1].x, B[k].y - B[k + 1].y) : 0
        if (acc > reachU) break
        const w = widthsAt(B, k)
        if (w < lo) lo = w
        if (w > hi) hi = w
      }
      /* WHERE ON EACH STROKE, AND AT WHAT ANGLE. The two guards that already
       * exist — the terminals filter and the collinear drop — are both
       * statements about these two quantities, so they are measured beside the
       * widths rather than inferred from the damage. */
      const arcOf = (pts) => {
        const c = [0]
        for (let k = 1; k < pts.length; k++)
          c.push(c[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y))
        return c
      }
      const ca = arcOf(A)
      const cb = arcOf(B)
      const endU = Math.min(ca[ai], ca[ca.length - 1] - ca[ai])
      const endO = Math.min(cb[bi], cb[cb.length - 1] - cb[bi])
      const tan = (pts, i) => {
        const a = pts[Math.max(0, i - 1)]
        const b = pts[Math.min(pts.length - 1, i + 1)]
        const L = Math.hypot(b.x - a.x, b.y - a.y) || 1
        return { x: (b.x - a.x) / L, y: (b.y - a.y) / L }
      }
      const tu = tan(A, ai)
      const to = tan(B, bi)
      const ang =
        (Math.acos(Math.max(0, Math.min(1, Math.abs(tu.x * to.x + tu.y * to.y)))) * 180) / Math.PI
      /* ⚠ IS `penHalfWidth` AT THE NEAREST SAMPLE THE SILHOUETTE'S OWN WIDTH?
       * The field is a MINIMUM over stamps, so a neighbouring sample with a
       * larger stamp can bulge past the local one and the true outline sits
       * WIDER than the analytic value. `keep` is where the band starts, so if
       * the analytic value understates the outline the band notches the stroke
       * in front, and if it overstates it leaves a collar — the two failure
       * modes the constant's own comment names. Measured against the shipped
       * bake by walking the perpendicular to the zero crossing. */
      const fieldHalf = (pts, i) => {
        const a = pts[Math.max(0, i - 1)]
        const b = pts[Math.min(pts.length - 1, i + 1)]
        const th = Math.atan2(b.y - a.y, b.x - a.x)
        const nx = -Math.sin(th)
        const ny = Math.cos(th)
        let best = 0
        for (const s of [1, -1]) {
          let prev = 0
          for (let d = 0; d <= 2 * R; d += 0.05) {
            const v = samplePenField(field, pts[i].x + s * nx * d, pts[i].y + s * ny * d).pen
            if (v > 0) {
              best = Math.max(best, d - 0.05 * (v / Math.max(1e-6, v - prev)))
              break
            }
            prev = v
            best = Math.max(best, d)
          }
        }
        return best
      }
      const fU = fieldHalf(A, ai)
      const fO = fieldHalf(B, bi)
      /* THE UNION'S OWN HALF-WIDTH, analytically. The field is
       * `min_j (|q - p_j| - w_j)`, i.e. a union of CIRCULAR stamps of radius
       * `w_j`, so the outline's half-width on the perpendicular at sample i is
       * `max_j sqrt(w_j^2 - d_ij^2)` — the neighbour that bulges furthest.
       * Taking the local `w_i` alone is the same one-sample mistake the field's
       * own comment warns about, one level up. */
      const unionHalf = (pts, i) => {
        let best = 0
        for (let j = 0; j < pts.length; j++) {
          const d = Math.hypot(pts[j].x - pts[i].x, pts[j].y - pts[i].y)
          if (d > R) continue
          const w = widthsAt(pts, j)
          if (w <= d) continue
          const h = Math.sqrt(w * w - d * d)
          if (h > best) best = h
        }
        return best
      }
      const uU = unionHalf(A, ai)
      const uO = unionHalf(B, bi)
      /* HOW FAR THE THREE-POINT SAMPLE IS FROM THE REAL CENTRELINE. `JointBreak`
       * claims *"three points halve the chord and put the sagitta under a stroke
       * unit"*. Every distance in the law is measured to that chord, so where
       * the claim fails the band sits somewhere the stroke is not. Measured
       * against the real polyline over the same ±reach window. */
      const sagitta = (pts, i) => {
        const reachU = flat.JOINT_BREAK_REACH_K * ink
        const p0 = walkOutLocal(pts, i, reachU, -1)
        const p2 = walkOutLocal(pts, i, reachU, 1)
        const tri = [p0, pts[i], p2]
        let worst = 0
        let acc = 0
        for (let k = i; k < pts.length; k++) {
          acc += k > i ? Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y) : 0
          if (acc > reachU) break
          worst = Math.max(worst, polyDistLocal(pts[k].x, pts[k].y, tri))
        }
        acc = 0
        for (let k = i; k >= 0; k--) {
          acc += k < i ? Math.hypot(pts[k].x - pts[k + 1].x, pts[k].y - pts[k + 1].y) : 0
          if (acc > reachU) break
          worst = Math.max(worst, polyDistLocal(pts[k].x, pts[k].y, tri))
        }
        return worst
      }
      const sU = sagitta(A, ai)
      const sO = sagitta(B, bi)
      console.log(
        `   ${String(jn.under).padStart(3)} ${String(jn.over).padStart(4)}  ${jn.gap.toFixed(2).padStart(6)}  ` +
          `${wU.toFixed(2)}u=${(wU / R).toFixed(2)}R  ${wO.toFixed(2)}u=${(wO / R).toFixed(2)}R  ` +
          `(${(lo / R).toFixed(2)}..${(hi / R).toFixed(2)} R)  ang ${ang.toFixed(1).padStart(5)}°  ` +
          `len ${(ca[ca.length - 1] / R).toFixed(1)}/${(cb[cb.length - 1] / R).toFixed(1)} R  ` +
          `toEnd ${(endU / R).toFixed(2)}/${(endO / R).toFixed(2)} R  ` +
          `field ${(fU / R).toFixed(2)}/${(fO / R).toFixed(2)} R  ` +
          `union ${(uU / R).toFixed(2)}/${(uO / R).toFixed(2)} R  ` +
          `SAGITTA ${sU.toFixed(2)}/${sO.toFixed(2)} u`,
      )
    }
    console.log("")
  }

  const carves = has("sweepCarve")
    ? [0.4, 0.55, 0.7, 0.85, 1]
    : [Number(arg("carve", "1"))]

  const keepKs = has("sweep")
    ? [1.06, 0.95, 0.85, 0.75, 0.69, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0]
    : [Number(arg("keepK", String(flat.JOINT_BREAK_KEEP_K)))]

  console.log(
    `ink ${ink.toFixed(3)} (R ${R.toFixed(3)}) · breakK ${breakK} · ${live.list.length} junctions · ` +
      `raster ${W}x${H} at ${ppu} px/unit\n`,
  )

  /* ── WHAT A CARVE-AWARE TERMINALS GUARD WOULD ADMIT ─────────────────────
   * `findHeroJunctions` (app/desk-doodles/page.tsx — NOT this lane's file)
   * drops a junction unless it is further than `reach` from either end of the
   * UNDER stroke and further than `keep` from either end of the OVER stroke,
   * and `keep` there is `JOINT_BREAK_KEEP_K · inkDiameter / 2` — the TUBE's
   * half-width. `--guard` re-runs that same filter over the PRIOR 22-junction
   * set with the OVER clause sized against the ink the carved mark actually
   * has, which is the only term of it that is a width. Nothing else changes. */
  if (has("guard")) {
    const before = live.list.length
    live.list = live.list.filter((jn) => {
      const A = strokes[jn.under].points
      const B = strokes[jn.over].points
      if (!A || !B || A.length < 2 || B.length < 2) return false
      const arcOf = (pts) => {
        const cc = [0]
        for (let k = 1; k < pts.length; k++)
          cc.push(cc[k - 1] + Math.hypot(pts[k].x - pts[k - 1].x, pts[k].y - pts[k - 1].y))
        return cc
      }
      const ai = nearestIdx(A, jn.x, jn.y)
      const bi = nearestIdx(B, jn.x, jn.y)
      const ca = arcOf(A)
      const cb = arcOf(B)
      const aEnd = Math.min(ca[ai], ca[ca.length - 1] - ca[ai])
      const bEnd = Math.min(cb[bi], cb[cb.length - 1] - cb[bi])
      const reachU = flat.JOINT_BREAK_REACH_K * ink
      const keepU = widthsAt(B, bi)
      return (has("noAEnd") ? true : aEnd > reachU) && bEnd > keepU
    })
    console.log(
      `carve-aware terminals guard: ${before} -> ${live.list.length} junctions  ` +
        `[${live.list.map((j) => `${j.under}-${j.over}`).join(" ")}]\n`,
    )
  }

  const own = has("own") ? ownerMap(W, H, x0, y0, ppu) : null
  const fmt = (c) =>
    `${c.n}px{${c.strokes.map(([s, v]) => `${s}:${v}`).join(" ")}}`

  for (const carve of carves) {
    const base = rasterCarved(field, carve, W, H, x0, y0, ppu)
    const b0 = components(base, W, H)
    if (own) {
      console.log(`carve ${carve.toFixed(2)} UNBROKEN bodies:`)
      for (const c of describe(base, W, H, own)) console.log(`      ${fmt(c)}`)
    }
    console.log(
      `carve ${carve.toFixed(2)}  UNBROKEN: ${b0.real.length} components  [${b0.real.slice(0, 10).join(", ")}]`,
    )
    for (const kk of keepKs) {
      /* THE SHIPPED LAW, CALLED — not a copy of it. `buildJointBreaks` now
       * takes the carve and returns `keepUnder` / `keepOver` / `outer` per
       * break, so this model exercises the function the renderer calls rather
       * than a second implementation that could agree with a bug.
       *
       *   --tube    forces carve 0 into the builder while the MARK stays
       *             carved: the before picture, i.e. the tube's radii on the
       *             pen's ink, which is exactly what ships today.
       *   --keepK=  / --sweep  substitute one global radius for the per-break
       *             triple, for the exploration that found the shape of the
       *             answer. Explicitly an override, and printed as one. */
      const built = buildJointBreaks(
        strokes,
        live.list,
        ink,
        Number(arg("breakK", String(breakK))),
        has("tube") ? 0 : carve,
      )
      const globalKeep = has("sweep") || arg("keepK", null) !== null
      const keep = (kk * ink) / 2
      const outer = keep + built.gap
      if (globalKeep)
        for (const b of built.breaks) {
          b.keepUnder = keep
          b.keepOver = keep
          b.outer = outer
        }
      /* ---- ONE BREAK AT A TIME, so damage is attributable ------------------
       * Nine components against six is a sum, and a sum cannot say WHICH
       * junction took the mark apart. Each break is applied alone against the
       * same carved base — the same paired-with-clean discipline the OFAT
       * sweeps use — so the row that follows names the junction. */
      if (has("perBreak")) {
        for (const b of built.breaks) {
          const one = dilateRemoved(
            base,
            applyBreaks(base, [b], keep, outer, built.reach, W, H, x0, y0, ppu),
            W,
            H,
            DILATE,
          )
          const c1 = components(one, W, H)
          let rm = 0
          for (let p = 0; p < base.length; p++) if (base[p] && !one[p]) rm++
          console.log(
            `      break ${String(b.underIndex).padStart(2)}->${String(b.overIndex).padEnd(2)} ` +
              `cut ${b.cut.toFixed(1).padStart(5)}u behind ${b.behind.toFixed(1).padStart(5)}u ratio ${(b.cut / Math.max(0.01, b.behind)).toFixed(2).padStart(5)}  ${String(rm).padStart(4)} px  ` +
              `-> ${c1.real.length} comps [${c1.real.slice(0, 10).join(", ")}]` +
              `${c1.real.length === b0.real.length ? "  ✓" : "  ✗ DAMAGE"}`,
          )
          if (own && c1.real.length !== b0.real.length)
            for (const c of describe(one, W, H, own)) console.log(`            ${fmt(c)}`)
          if (arg("diag", null) === `${b.underIndex}-${b.overIndex}`) {
            /* THE BREAK WITH ITS OWN GEOMETRY ON TOP, at 10x. Removed ink in
             * red, the UNDER centreline in blue, the OVER centreline in green,
             * the junction as a ring — because "which stroke did the cut land
             * on, and where relative to the stroke in front" is not a thing a
             * component count can answer, and every call below was made here. */
            const Z = 10
            const cxp = (b.c.x - x0) * ppu
            const cyp = (b.c.y - y0) * ppu
            const M = Math.round(4.5 * ink * ppu)
            const ax = Math.max(0, Math.round(cxp - M))
            const ay = Math.max(0, Math.round(cyp - M))
            const bx2 = Math.min(W - 1, Math.round(cxp + M))
            const by2 = Math.min(H - 1, Math.round(cyp + M))
            const cw = bx2 - ax + 1
            const ch = by2 - ay + 1
            const cv = createCanvas(cw * Z, ch * Z)
            const cx = cv.getContext("2d")
            for (let yy = 0; yy < ch; yy++)
              for (let xx = 0; xx < cw; xx++) {
                const p2 = (ay + yy) * W + (ax + xx)
                cx.fillStyle = one[p2] ? "#1a1a1a" : base[p2] ? "#e8342b" : "#fbfbfb"
                cx.fillRect(xx * Z, yy * Z, Z, Z)
              }
            const sx = (u) => ((u - x0) * ppu - ax) * Z
            const sy = (v) => ((v - y0) * ppu - ay) * Z
            const line = (pts, colour, wdt) => {
              cx.strokeStyle = colour
              cx.lineWidth = wdt
              cx.beginPath()
              pts.forEach((p, i) =>
                i ? cx.lineTo(sx(p.x), sy(p.y)) : cx.moveTo(sx(p.x), sy(p.y)),
              )
              cx.stroke()
            }
            line(strokes[b.underIndex].points, "#1f6feb", 3)
            line(strokes[b.overIndex].points, "#1a7f37", 3)
            line(b.over, "#1a7f37", 7)
            line(b.under, "#1f6feb", 7)
            cx.strokeStyle = "#8250df"
            cx.lineWidth = 3
            cx.beginPath()
            cx.arc(sx(b.c.x), sy(b.c.y), 8, 0, Math.PI * 2)
            cx.stroke()
            const p3 = join(OUT, `diag-${b.underIndex}-${b.overIndex}.png`)
            writeFileSync(p3, cv.toBuffer("image/png"))
            console.log(`          DIAG ${p3}`)
          }
          if (has("png")) {
            /* A 5x CROP FRAMED ON THE BREAK, clean left / broken right. The
             * counts above say a junction damages; only the crop says what the
             * damage looks like, and every judgement here was made at 5x. */
            const cxp = Math.round((b.c.x - x0) * ppu)
            const cyp = Math.round((b.c.y - y0) * ppu)
            const M = Math.round(3.2 * ink * ppu)
            const ax = Math.max(0, cxp - M)
            const ay = Math.max(0, cyp - M)
            const bx = Math.min(W - 1, cxp + M)
            const by = Math.min(H - 1, cyp + M)
            const cw = bx - ax + 1
            const ch = by - ay + 1
            const Z = 5
            const cv = createCanvas(cw * Z * 2 + 10, ch * Z)
            const cx = cv.getContext("2d")
            cx.fillStyle = "#ff3b30"
            cx.fillRect(0, 0, cv.width, cv.height)
            for (const [src, ox] of [
              [base, 0],
              [one, cw * Z + 10],
            ]) {
              for (let yy = 0; yy < ch; yy++)
                for (let xx = 0; xx < cw; xx++) {
                  cx.fillStyle = src[(ay + yy) * W + (ax + xx)] ? "#111111" : "#fafafa"
                  cx.fillRect(ox + xx * Z, yy * Z, Z, Z)
                }
            }
            const p = join(
              OUT,
              `break-${b.underIndex}-${b.overIndex}${has("directional") ? "-dir" : ""}.png`,
            )
            writeFileSync(p, cv.toBuffer("image/png"))
            console.log(`          ${p}`)
          }
        }
      }
      const drop = (arg("drop", "") || "").split(",").filter(Boolean)
      const kept = built.breaks.filter((b) => !drop.includes(`${b.underIndex}-${b.overIndex}`))
      const broken = dilateRemoved(
        base,
        applyBreaks(base, kept, keep, outer, built.reach, W, H, x0, y0, ppu),
        W,
        H,
        DILATE,
      )
      const c = components(broken, W, H)
      let removed = 0
      for (let p = 0; p < base.length; p++) if (base[p] && !broken[p]) removed++
      console.log(
        `   keepK ${kk.toFixed(2)} (keep ${keep.toFixed(2)}u = ${(keep / R).toFixed(2)} R) ` +
          `-> ${c.real.length} components, ${removed} px removed  [${c.real.slice(0, 10).join(", ")}]` +
          `${c.real.length === b0.real.length ? "   ✓ assembled" : ""}`,
      )
      if (has("png")) {
        console.log(`      ${writeMask(broken, W, H, `carve${carve}-keep${kk}.png`)}`)
      }
    }
    if (has("png")) console.log(`      ${writeMask(base, W, H, `carve${carve}-unbroken.png`)}`)
    console.log("")
  }
  void penHalfWidth
  void PEN_NIB_DEFAULT
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
