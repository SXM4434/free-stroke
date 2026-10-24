// _PROBE-PENTIP-ENDCROPS — LOOK AT THE MOVING END, AT THE PLAYHEADS THE GATE
// ACTUALLY MEASURED, IN THE PEN'S OWN FRAME.
//
// Sebs's standing lesson: every real correction in this repo came from someone
// zooming in and looking, not from a number. So this is the picture that goes
// with `assert-drawin-pentip.mjs`'s numbers, and it is bound to them rather than
// taken beside them:
//
//   * the playheads are READ OUT OF `pentip.json` — the same k values the gate
//     kept, not a hand-picked "good" frame.
//   * the box is centred on the pen point the reveal law puts at arc d, using
//     the same stroke->screen fit the gate solved.
//   * it is ROTATED into the pen's own (T, N) frame, so the pen always advances
//     LEFT TO RIGHT and four arms can be compared as shapes instead of as
//     positions. An axis-aligned crop of a cursive word compares orientations.
//   * the FINISHED frame is cut from the identical box, because "is this end
//     rounded" is only answerable against what that stretch of mark looks like
//     when it is done.
//
// ⚠ THE SHEET IS ASSERTED OPAQUE. A sibling lane lost a day to a contact sheet
// ffmpeg had written as RGBA with 95.8 % of its pixels at alpha 0: the viewer
// composited it onto white and it looked correct. A crop of a tip that is not
// there is indistinguishable from a crop of a tip that is, once something else
// supplies the background.
//
// Usage: node scripts/verify/_probe-pentip-endcrops.mjs --label=gate-repair-dense
//                                                       [--zoom=8] [--box=44] [--cols=4]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, isAbsolute } from "node:path"
import { createRequire } from "node:module"
import { processedHeroStrokes } from "./_hero-word.mjs"
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
const LABEL = arg("label", "gate-repair-dense")
const DIR = isAbsolute(arg("dir", "")) ? arg("dir") : join(ROOT, "docs", "verification", "pentip", LABEL)
const ZOOM = parseInt(arg("zoom", "8"), 10)
/** Half-width of the crop, in SOURCE pixels, along the pen's tangent. */
const BOX = parseInt(arg("box", "44"), 10)
const COLS = parseInt(arg("cols", "4"), 10)
const MODE = "hybrid"
const BLEND = 0.4

async function rgba(path) {
  const img = await loadImage(path)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  return { d: x.getImageData(0, 0, img.width, img.height), W: img.width, H: img.height }
}

function assertOpaque(canvas, path) {
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height)
  let clear = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) clear++
  const pct = (clear / (data.length / 4)) * 100
  console.log(`  ${clear === 0 ? "PASS" : "FAIL"}  the sheet is OPAQUE — ${clear} px below alpha 255 (${pct.toFixed(3)} %)`)
  if (clear !== 0) {
    console.error(`the sheet at ${path} is not opaque; what it shows is composited, not measured`)
    process.exit(1)
  }
}

async function main() {
  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8"))
  const pentip = JSON.parse(readFileSync(join(DIR, "pentip.json"), "utf8"))
  const results = pentip.results ?? pentip
  const strokes = processedHeroStrokes()

  const pts = []
  let total = 0
  for (const s of strokes)
    for (let i = 1; i < s.points.length; i++)
      total += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
  {
    let acc = 0
    for (const s of strokes)
      for (let i = 0; i < s.points.length; i++) {
        if (i > 0) acc += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
        pts.push({ x: s.points[i].x, y: s.points[i].y, arc: acc })
      }
  }
  const sMinX = Math.min(...pts.map((p) => p.x))
  const sMaxX = Math.max(...pts.map((p) => p.x))
  const sMinY = Math.min(...pts.map((p) => p.y))
  const sMaxY = Math.max(...pts.map((p) => p.y))

  const ARMS = Object.keys(meta.engines)
  /* THE PLAYHEADS: the ones the gate kept for EVERY arm, so the same stretch of
   * mark is shown four times. Falling back to the shipped arm's rows if the
   * intersection is too thin, and saying so. */
  let ks = null
  for (const a of ARMS) {
    const mine = new Set((results[a]?.rows ?? []).map((r) => r.k))
    ks = ks === null ? mine : new Set([...ks].filter((k) => mine.has(k)))
  }
  let source = "kept by every arm"
  if (!ks || ks.size < COLS) {
    ks = new Set((results["free-stroke"]?.rows ?? []).map((r) => r.k))
    source = "kept by free-stroke (the four-arm intersection was too thin)"
  }
  const all = [...ks].sort((a, b) => a - b)
  const picked = []
  for (let i = 0; i < COLS; i++) picked.push(all[Math.round(((all.length - 1) * i) / (COLS - 1))])
  const chosen = [...new Set(picked)]
  console.log(`playheads ${chosen.join(", ")}  (${source}; ${all.length} available)`)

  const CW = 2 * BOX
  const CH = Math.round(1.1 * BOX)
  const LABELH = 26
  const cellW = CW * ZOOM
  const cellH = CH * ZOOM
  const sheet = createCanvas(cellW * chosen.length, (cellH + LABELH) * (ARMS.length + 1))
  const sc = sheet.getContext("2d")
  sc.fillStyle = "#0e0e12"
  sc.fillRect(0, 0, sheet.width, sheet.height)
  sc.imageSmoothingEnabled = false

  const rowsJson = []
  for (let ri = 0; ri <= ARMS.length; ri++) {
    const arm = ARMS[Math.min(ri, ARMS.length - 1)]
    const samples = meta.engines[arm]
    const isFinished = ri === ARMS.length
    // the fit, re-solved on this arm's finished frame exactly as the gate does
    const finImg = await rgba(join(DIR, arm, `${String(samples.length - 1).padStart(3, "0")}.png`))
    const { W, H } = finImg
    const fin = new Uint8Array(W * H)
    {
      const hist = new Uint32Array(256)
      const luma = new Uint8Array(W * H)
      const dta = finImg.d.data
      for (let i = 0, p = 0; i < dta.length; i += 4, p++) {
        const l = (0.2126 * dta[i] + 0.7152 * dta[i + 1] + 0.0722 * dta[i + 2]) | 0
        luma[p] = l
        hist[l]++
      }
      let paper = 0
      for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
      const cut = Math.max(8, paper - 45)
      for (let p = 0; p < luma.length; p++) fin[p] = luma[p] < cut ? 1 : 0
    }
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
    const mk = (s2, fl) => (p) => ({ x: cxS + (p.x - cxP) * s2, y: cyS + (p.y - cyP) * s2 * fl })
    const scoreFit = (f) => {
      let on = 0
      for (const p of pts) {
        const q = f(p)
        const xi = Math.round(q.x)
        const yi = Math.round(q.y)
        if (xi >= 0 && xi < W && yi >= 0 && yi < H && fin[yi * W + xi]) on++
      }
      return on / pts.length
    }
    let best = { s2: sHi, fl: 1, v: -1 }
    for (const fl of [1, -1])
      for (let i = 0; i <= 80; i++) {
        const s2 = sHi * (0.55 + (0.45 * i) / 80)
        const v = scoreFit(mk(s2, fl))
        if (v > best.v) best = { s2, fl, v }
      }
    const SC = best.s2
    const toScreen = mk(best.s2, best.fl)
    const totalPx = total * SC
    const at = (arcPx) => {
      const arcU = arcPx / SC
      let i = 1
      while (i < pts.length && pts[i].arc < arcU) i++
      if (i >= pts.length) i = pts.length - 1
      const a = toScreen(pts[i - 1])
      const b = toScreen(pts[i])
      const seg = Math.hypot(b.x - a.x, b.y - a.y)
      const f = seg > 0 ? (arcPx - pts[i - 1].arc * SC) / seg : 0
      const T = seg > 0 ? { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg } : { x: 1, y: 0 }
      return { P: { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }, T, N: { x: -T.y, y: T.x } }
    }

    for (let ci = 0; ci < chosen.length; ci++) {
      const k = chosen[ci]
      const phaseT = samples[k].phaseT
      const dFrac = revealDistanceFraction(strokes, phaseT, MODE, BLEND)
      const d = dFrac * totalPx
      /* THE TANGENT IS A CHORD over a few pixels, not one resampled segment —
       * the same reason the gate uses one: the strokes carry hand-feel wobble at
       * a 5 px spacing and a per-segment tangent rotates the crop by the noise. */
      const p0 = at(Math.max(0, d - 12)).P
      const p1 = at(d + 12).P
      const L = Math.hypot(p1.x - p0.x, p1.y - p0.y)
      const T = L > 0 ? { x: (p1.x - p0.x) / L, y: (p1.y - p0.y) / L } : { x: 1, y: 0 }
      const N = { x: -T.y, y: T.x }
      const P = at(d).P

      const src = isFinished
        ? finImg
        : await rgba(join(DIR, arm, `${String(k).padStart(3, "0")}.png`))
      const crop = createCanvas(CW, CH)
      const cctx = crop.getContext("2d")
      const out = cctx.createImageData(CW, CH)
      for (let j = 0; j < CH; j++)
        for (let i = 0; i < CW; i++) {
          const su = i - CW / 2
          const sv = j - CH / 2
          const x = Math.round(P.x + T.x * su + N.x * sv)
          const y = Math.round(P.y + T.y * su + N.y * sv)
          const o = (j * CW + i) * 4
          if (x < 0 || x >= src.W || y < 0 || y >= src.H) {
            out.data[o] = 24
            out.data[o + 1] = 24
            out.data[o + 2] = 30
            out.data[o + 3] = 255
            continue
          }
          const s = (y * src.W + x) * 4
          out.data[o] = src.d.data[s]
          out.data[o + 1] = src.d.data[s + 1]
          out.data[o + 2] = src.d.data[s + 2]
          out.data[o + 3] = 255
        }
      cctx.putImageData(out, 0, 0)

      const yTop = ri * (cellH + LABELH)
      sc.drawImage(crop, 0, 0, CW, CH, ci * cellW, yTop + LABELH, cellW, cellH)
      // the pen point the reveal law names, marked, so "where is the end" is not
      // a matter of opinion
      sc.strokeStyle = "#ff5f5f"
      sc.lineWidth = 2
      sc.beginPath()
      sc.moveTo(ci * cellW + cellW / 2, yTop + LABELH)
      sc.lineTo(ci * cellW + cellW / 2, yTop + LABELH + 10)
      sc.moveTo(ci * cellW + cellW / 2, yTop + LABELH + cellH - 10)
      sc.lineTo(ci * cellW + cellW / 2, yTop + LABELH + cellH)
      sc.stroke()
      sc.strokeStyle = "#33333d"
      sc.strokeRect(ci * cellW, yTop + LABELH, cellW, cellH)
      const row = (results[arm]?.rows ?? []).find((r) => r.k === k)
      sc.fillStyle = isFinished ? "#7fd1ff" : "#ffd479"
      sc.font = "16px monospace"
      sc.fillText(
        isFinished
          ? `FINISHED (same box)  ·  draw ${(dFrac * 100).toFixed(0)} %`
          : `${arm}  ·  draw ${(dFrac * 100).toFixed(0)} %${row ? `  ·  ${row.measuredW.toFixed(3)} w · score ${row.penScore.toFixed(2)}` : ""}`,
        ci * cellW + 8,
        yTop + 18,
      )
      if (!isFinished) rowsJson.push({ arm, k, dFrac, measuredW: row?.measuredW ?? null })
    }
  }

  assertOpaque(sheet, "sheet")
  mkdirSync(DIR, { recursive: true })
  const out = join(DIR, `end-${ZOOM}x.png`)
  writeFileSync(out, sheet.toBuffer("image/png"))
  writeFileSync(join(DIR, "endcrops.json"), JSON.stringify({ zoom: ZOOM, box: BOX, chosen, rows: rowsJson }, null, 2))
  console.log(`\nsheet: ${out}  (${sheet.width}x${sheet.height})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
