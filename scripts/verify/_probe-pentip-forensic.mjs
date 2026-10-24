// _PROBE-PENTIP-FORENSIC — WHY DOES THE PARKED PRIOR NO LONGER READ AS A CUT?
//
// `assert-drawin-pentip.mjs` fails its own CONTROL: the row "the PARKED PRIOR
// still reads as a CUT" wants a pen score < 0.5 and reads 1.695. Two things can
// be true and they need different answers:
//
//   (a) THE INSTRUMENT IS WRONG — its windows, normalisation or synthetic
//       controls have drifted, exactly the failure its own header describes for
//       its previous incarnation.
//   (b) THE SURFACE CHANGED — something else already rounds the reveal's moving
//       end, so the premise that the tip shape is what fixed the ending is
//       wrong and must be restated.
//
// This probe decides it BY MEASUREMENT. It re-reads frames already on disk (no
// browser, so it cannot be poisoned by a sibling lane's fast-refresh) and
// reports, per playhead rather than as a median:
//
//   1. THE REPLICATION CHECK. It re-derives the assert's own `transitionPx` for
//      every row and diffs it against the `pentip.json` the assert wrote. If
//      that does not match to 1e-9 the rest of this probe is describing a
//      different measurement and says so.
//   2. THE SPREAD. The assert reports a MEDIAN of ~14-21 playheads and nothing
//      else. A median is only a measurement if the sample is tight.
//   3. WHOSE INK IS IN THE DISC. For every ink pixel inside the measuring disc,
//      which stroke of the word does it belong to, and how far along that
//      stroke. `f(u)` is a ratio of drawn ink to finished ink at tangential
//      offset u; ink from a NEIGHBOURING stroke is in both sums and answers a
//      question about stroke order, not about the shape of the moving end.
//   4. THE SAME TRANSITION, RESTRICTED TO THE STROKE THAT OWNS THE PEN. If the
//      spread collapses under the restriction, (3) is the cause.
//
// Usage: node scripts/verify/_probe-pentip-forensic.mjs --label=lane-paneltip
//                                                       [--arm=free-stroke-off]
//                                                       [--curves=3]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
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
const DIR_ARG = arg("dir", null)
const DIR = DIR_ARG
  ? isAbsolute(DIR_ARG)
    ? DIR_ARG
    : join(ROOT, DIR_ARG)
  : join(ROOT, "docs", "verification", "pentip", LABEL)
const ONLY = arg("arm", null)
const CURVES = parseInt(arg("curves", "3"), 10)

/* Every constant below is COPIED from assert-drawin-pentip.mjs, because the
 * point of §1 is to reproduce that instrument exactly before criticising it. */
const MODE = "hybrid"
const BLEND = 0.4
const BODY_BACK_W = 1.25
const DISC_W = 2.5
const PROBE_CAP_W = 3.0
const PLAUSIBLE_LO_W = 0.25
const PLAUSIBLE_HI_W = 2.2
const BIN = 0.25
const F_HI = 0.85
const F_LO = 0.15

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

const median = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null)
const quant = (a, q) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))]
}

async function main() {
  if (!existsSync(DIR)) {
    console.error(`no capture at ${DIR}`)
    process.exit(2)
  }
  console.log(`reading ${DIR}\n`)
  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8"))
  const stored = existsSync(join(DIR, "pentip.json"))
    ? JSON.parse(readFileSync(join(DIR, "pentip.json"), "utf8"))
    : null
  const strokes = processedHeroStrokes()

  /* ---- the pen path, with per-point arc AND the stroke it belongs to ------ */
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
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const sMinX = Math.min(...xs)
  const sMaxX = Math.max(...xs)
  const sMinY = Math.min(...ys)
  const sMaxY = Math.max(...ys)

  const out = { dir: DIR, arms: {} }

  for (const engine of Object.keys(meta.engines)) {
    if (ONLY && engine !== ONLY) continue
    const samples = meta.engines[engine]
    const lastIdx = samples.length - 1
    const { m: fin, w: W, h: H } = await inkMask(join(DIR, engine, `${String(lastIdx).padStart(3, "0")}.png`))

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
    const nominalHalfPx = (HERO_INK_WIDTH_PX / 2) * SC

    // screen-space path, once
    const spath = pts.map((p) => {
      const q = toScreen(p)
      return { x: q.x, y: q.y, arcPx: p.arc * SC, stroke: p.stroke }
    })

    const at = (arcPx) => {
      const arcU = arcPx / SC
      let i = 1
      while (i < pts.length && pts[i].arc < arcU) i++
      if (i >= pts.length) i = pts.length - 1
      const a = toScreen(pts[i - 1])
      const b = toScreen(pts[i])
      const seg = Math.hypot(b.x - a.x, b.y - a.y)
      const f = seg > 0 ? (arcPx - pts[i - 1].arc * SC) / seg : 0
      const P = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
      const T = seg > 0 ? { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg } : { x: 1, y: 0 }
      return { P, N: { x: -T.y, y: T.x }, stroke: pts[i].stroke, idx: i }
    }
    const halfWidth = (mask, P, N, cap) => {
      const on = (x, y) => {
        const xi = Math.round(x)
        const yi = Math.round(y)
        return xi >= 0 && xi < W && yi >= 0 && yi < H && mask[yi * W + xi]
      }
      if (!on(P.x, P.y)) return 0
      let a = 0
      while (a < cap && on(P.x + N.x * (a + 0.5), P.y + N.y * (a + 0.5))) a += 0.5
      let b = 0
      while (b < cap && on(P.x - N.x * (b + 0.5), P.y - N.y * (b + 0.5))) b += 0.5
      return (a + b) / 2
    }
    const probeCap = PROBE_CAP_W * nominalHalfPx
    const bodyBack = BODY_BACK_W * nominalHalfPx
    const capBodies = []
    for (const endArcU of strokeEndArc) {
      const q = at(Math.max(0, endArcU * SC - bodyBack))
      const w = halfWidth(fin, q.P, q.N, probeCap)
      if (w > PLAUSIBLE_LO_W * nominalHalfPx && w < PLAUSIBLE_HI_W * nominalHalfPx) capBodies.push(w)
    }
    capBodies.sort((a, b) => a - b)
    const wPx = capBodies[Math.floor(capBodies.length / 2)] ?? nominalHalfPx
    const R = Math.max(6, Math.round(DISC_W * wPx))

    /* ── §3 · WHOSE INK. For an ink pixel, the nearest point on the pen path,
     * which gives both the stroke that owns it and where along that stroke it
     * sits. Brute force over the polyline: the word is ~2k points and a disc is
     * a few thousand pixels, which is fine offline. */
    const nearest = (x, y) => {
      let bd = Infinity
      let ba = 0
      let bs = -1
      for (let i = 1; i < spath.length; i++) {
        const a = spath[i - 1]
        const b = spath[i]
        if (a.stroke !== b.stroke) continue
        const vx = b.x - a.x
        const vy = b.y - a.y
        const L2 = vx * vx + vy * vy
        let t = L2 > 0 ? ((x - a.x) * vx + (y - a.y) * vy) / L2 : 0
        t = Math.max(0, Math.min(1, t))
        const px = a.x + vx * t
        const py = a.y + vy * t
        const d2 = (x - px) ** 2 + (y - py) ** 2
        if (d2 < bd) {
          bd = d2
          ba = a.arcPx + (b.arcPx - a.arcPx) * t
          bs = a.stroke
        }
      }
      return { dist: Math.sqrt(bd), arcPx: ba, stroke: bs }
    }

    /** The assert's transitionWidth, verbatim, plus the diagnostics. `own` is
     *  an optional Uint8Array restricting which finished-ink pixels count. */
    const transition = (M, endPx, own, wantCurve) => {
      const { P, N } = at(endPx)
      const T = { x: N.y, y: -N.x }
      const nb = Math.ceil((2 * R) / BIN) + 1
      const binsF = new Float64Array(nb)
      const binsM = new Float64Array(nb)
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R) continue
          const x = Math.round(P.x + dx)
          const y = Math.round(P.y + dy)
          if (x < 0 || x >= W || y < 0 || y >= H) continue
          if (!fin[y * W + x]) continue
          if (own && !own[y * W + x]) continue
          const u = Math.floor((dx * T.x + dy * T.y + R) / BIN)
          if (u < 0 || u >= nb) continue
          binsF[u]++
          if (M[y * W + x]) binsM[u]++
        }
      const minPop = Math.max(1, 0.125 * 2 * wPx * BIN)
      const f = new Array(nb).fill(null)
      for (let u = 0; u < nb; u++) if (binsF[u] >= minPop) f[u] = binsM[u] / binsF[u]
      let iHi = -1
      for (let u = 0; u < nb; u++) if (f[u] !== null && f[u] >= F_HI) iHi = u
      if (iHi < 0) return { tw: null, f, binsF }
      let iLo = -1
      for (let u = iHi + 1; u < nb; u++)
        if (f[u] !== null && f[u] <= F_LO) {
          iLo = u
          break
        }
      if (iLo < 0) return { tw: null, f, binsF }
      const lerpCross = (i, dir, level) => {
        let j = i + dir
        while (j >= 0 && j < nb && f[j] === null) j += dir
        if (j < 0 || j >= nb) return i * BIN
        const a = f[i]
        const b = f[j]
        if (a === b) return i * BIN
        const t = (a - level) / (a - b)
        return (i + dir * Math.max(0, Math.min(1, t))) * BIN
      }
      const uHi = lerpCross(iHi, +1, F_HI)
      const uLo = lerpCross(iLo, -1, F_LO)
      return { tw: Math.max(0, uLo - uHi), f, binsF, iHi, iLo, wantCurve }
    }

    const rows = []
    let curvesLeft = CURVES
    for (let k = 5; k < samples.length - 4; k++) {
      const phaseT = samples[k].phaseT
      const dFrac = revealDistanceFraction(strokes, phaseT, MODE, BLEND)
      const dPx = dFrac * totalPx
      if (dPx < 3 * R) continue
      const mask = await inkMask(join(DIR, engine, `${String(k).padStart(3, "0")}.png`))
      const plain = transition(mask.m, dPx, null)
      if (plain.tw === null) continue

      /* whose ink is in the disc */
      const { P, stroke: penStroke } = at(dPx)
      const own = new Uint8Array(fin.length)
      let inDisc = 0
      let ownN = 0
      let foreignStrokes = new Set()
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R) continue
          const x = Math.round(P.x + dx)
          const y = Math.round(P.y + dy)
          if (x < 0 || x >= W || y < 0 || y >= H) continue
          if (!fin[y * W + x]) continue
          inDisc++
          const nn = nearest(x, y)
          // the moving end's OWN ribbon: same stroke, and within a disc radius
          // of the pen ALONG the path (so a stroke that loops back into the
          // disc is foreign too).
          if (nn.stroke === penStroke && Math.abs(nn.arcPx - dPx) <= R + 2 * wPx) {
            own[y * W + x] = 1
            ownN++
          } else foreignStrokes.add(nn.stroke)
        }
      const restricted = transition(mask.m, dPx, own)

      const row = {
        k,
        phaseT,
        dFrac,
        dPx,
        transitionPx: plain.tw,
        restrictedPx: restricted.tw,
        inkInDisc: inDisc,
        ownInk: ownN,
        foreignPct: inDisc ? (100 * (inDisc - ownN)) / inDisc : 0,
        foreignStrokes: [...foreignStrokes].sort((a, b) => a - b),
        penStroke,
      }
      rows.push(row)

      if (curvesLeft > 0 && plain.tw !== null) {
        curvesLeft--
        const f = plain.f
        const s = []
        for (let u = 0; u < f.length; u += 4) {
          const v = f[u]
          s.push(v === null ? "·" : v >= 0.85 ? "#" : v <= 0.15 ? "_" : v >= 0.5 ? "+" : "-")
        }
        row.curve = s.join("")
        const fr = restricted.f
        const s2 = []
        for (let u = 0; u < fr.length; u += 4) {
          const v = fr[u]
          s2.push(v === null ? "·" : v >= 0.85 ? "#" : v <= 0.15 ? "_" : v >= 0.5 ? "+" : "-")
        }
        row.curveRestricted = s2.join("")
      }
    }

    const tw = rows.map((r) => r.transitionPx)
    const rw = rows.map((r) => r.restrictedPx).filter((v) => v !== null)
    console.log(`\n=== ${engine} ===`)
    console.log(`  w ${wPx.toFixed(2)} px · R ${R} px · SC ${SC.toFixed(4)} · fit ${(best.v * 100).toFixed(1)} %`)

    /* ── §1 · THE REPLICATION CHECK ─────────────────────────────────────── */
    if (stored?.[engine]) {
      const s = stored[engine].rows
      let worst = 0
      let matched = 0
      for (const r of rows) {
        const hit = s.find((q) => q.k === r.k)
        if (!hit) continue
        matched++
        worst = Math.max(worst, Math.abs(hit.transitionPx - r.transitionPx))
      }
      const ok = matched === s.length && worst < 1e-9
      console.log(
        `  ${ok ? "PASS" : "FAIL"}  REPLICATION — ${matched}/${s.length} rows re-derived, worst |Δ| ${worst.toExponential(2)}`,
      )
    }

    /* ── §2 · THE SPREAD ────────────────────────────────────────────────── */
    console.log(
      `  AS THE ASSERT MEASURES IT   median ${median(tw).toFixed(2)} px   ` +
        `min ${Math.min(...tw).toFixed(2)}  p25 ${quant(tw, 0.25).toFixed(2)}  ` +
        `p75 ${quant(tw, 0.75).toFixed(2)}  max ${Math.max(...tw).toFixed(2)}   ` +
        `IQR ${(quant(tw, 0.75) - quant(tw, 0.25)).toFixed(2)} px = ${((quant(tw, 0.75) - quant(tw, 0.25)) / wPx).toFixed(2)} w`,
    )
    console.log(
      `  RESTRICTED TO THE PEN'S OWN STROKE   median ${rw.length ? median(rw).toFixed(2) : "—"} px   ` +
        `IQR ${rw.length ? (quant(rw, 0.75) - quant(rw, 0.25)).toFixed(2) : "—"} px`,
    )
    const fp = rows.map((r) => r.foreignPct)
    console.log(
      `  FOREIGN INK IN THE DISC   median ${median(fp).toFixed(1)} %   max ${Math.max(...fp).toFixed(1)} %   ` +
        `(rows with >20 %: ${fp.filter((v) => v > 20).length}/${fp.length})`,
    )
    console.log(`   k   dFrac    plain    restricted   ink   foreign%  foreign strokes`)
    for (const r of rows)
      console.log(
        `  ${String(r.k).padStart(2)}  ${r.dFrac.toFixed(3)}  ${r.transitionPx.toFixed(2).padStart(7)}  ` +
          `${(r.restrictedPx === null ? "—" : r.restrictedPx.toFixed(2)).padStart(10)}  ` +
          `${String(r.inkInDisc).padStart(5)}  ${r.foreignPct.toFixed(1).padStart(7)}  ${r.foreignStrokes.join(",")}`,
      )
    for (const r of rows)
      if (r.curve) {
        console.log(`\n  f(u) at k=${r.k} — # >=0.85, + >=0.5, - >0.15, _ <=0.15, · unpopulated`)
        console.log(`    all ink in disc : ${r.curve}`)
        console.log(`    own stroke only : ${r.curveRestricted}`)
      }

    out.arms[engine] = { wPx, R, SC, rows }
  }

  mkdirSync(DIR, { recursive: true })
  writeFileSync(join(DIR, "forensic.json"), JSON.stringify(out, null, 2))
  console.log(`\njson: ${join(DIR, "forensic.json")}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
