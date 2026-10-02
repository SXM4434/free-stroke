// PROBE — WHERE IS THE WEAVE COMING FROM?
//
// With relief on, twelve texture presets on Rod render as the same fine woven
// mesh: a 3-band stripe (contourBands, feature period 0.419) and a 4-line stripe
// (scanlines, 0.224) and a dot grid (inkDots, 0.167) produce a picture with the
// SAME apparent frequency. Something other than the pattern is setting that
// frequency.
//
// THE DECIDING EXPERIMENT, and it needs no opinion to read. `textureScale`
// multiplies the pattern coordinate, so it changes the pattern's frequency on
// screen and NOTHING else — not the mesh, not the camera, not the material.
//
//   · if the weave's frequency tracks textureScale, the relief is drawing the
//     PATTERN and the fault is amplitude/normalisation;
//   · if it does not move, the relief is drawing something fixed to the surface —
//     and the only fixed thing at that scale is the tube's TESSELLATION, which
//     the position derivatives are piecewise-constant across.
//
// The frequency is measured, not eyeballed: mean |Δ| between horizontally
// adjacent ink pixels (fine structure) against the same at a 4px stride (coarse
// structure). A pattern getting coarser as scale drops must move those two
// apart; a fixed mesh cannot.
//
// Usage: node scripts/verify/_probe-relief-origin.mjs
import { chromium } from "./lib/browser.mjs"
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "texture-relief")
mkdirSync(join(OUT, "sheets"), { recursive: true })

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}
const SCALES = arg("scales", "0.3,0.6,1.1,2.2,4.4").split(",").map(Number)
const PRESET = arg("preset", "contourBands")
const CASES = arg("bumps", "0.25,0").split(",").map(Number).map((b) => ({ preset: PRESET, bump: b }))

const stroke = () => {
  const p = []
  for (let i = 0; i <= 140; i++) {
    const t = i / 140
    p.push({ x: 110 + t * 640, y: 330 + Math.sin(t * Math.PI * 2.2) * 135 + Math.sin(t * Math.PI * 6) * 24 })
  }
  return [p]
}
async function pxOf(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height }
}
const LUM = (a, i) => 0.2126 * a[i] + 0.7152 * a[i + 1] + 0.0722 * a[i + 2]
let PAPER = 247
const isInk = (l) => Math.abs(l - PAPER) > 5
/** Mean |Δ| between ink pixels `stride` apart horizontally. */
function energyAt(a, w, h, stride) {
  let s = 0, n = 0
  for (let y = 0; y < h; y++) for (let x = 0; x + stride < w; x++) {
    const i = (y * w + x) * 4, j = (y * w + x + stride) * 4
    const l0 = LUM(a, i), l1 = LUM(a, j)
    if (!isInk(l0) || !isInk(l1)) continue
    s += Math.abs(l0 - l1); n++
  }
  return n ? s / n : 0
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness)
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), stroke())
await page.waitForTimeout(1600)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.evaluate(() => window.__styleHarness.setMode("rod"))
await page.waitForTimeout(1300)
await page.evaluate(() => window.__captureHarness.frontView(0.95))
await page.waitForTimeout(600)

const boxes = await page.$$eval("canvas", (els) =>
  els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
const box = boxes.reduce((a, b) => (b.x > a.x ? b : a))
const rectOf = (fx, fy, fw, fh) => ({ x: box.x + box.width * fx, y: box.y + box.height * fy, width: box.width * fw, height: box.height * fh })
const OFF = { textureEnabled: false, textureMode: "none", ditherEnabled: false, asciiEnabled: false, layerStackEnabled: false, fusionPreset: "none", motionMode: "off" }
await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
await page.waitForTimeout(600)

/* Paper, ink box and the densest patch, located from the layers-off frame — the
 * same construction verify-screen-layers.mjs uses. A hardcoded crop rectangle
 * was tried first and landed on 1.3% ink; the guard caught it, which is the only
 * reason this file is not reporting numbers taken off blank stage. */
let MACRO = null
{
  const { d, w, h } = await pxOf(await page.screenshot({ clip: rectOf(0, 0, 1, 1) }))
  const X0 = Math.round(w * 0.03), X1 = Math.round(w * 0.97)
  const Y0 = Math.round(h * 0.03), Y1 = Math.round(h * 0.68)
  const hist = new Float64Array(256)
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) hist[Math.max(0, Math.min(255, Math.round(LUM(d, (y * w + x) * 4))))]++
  let best = 0
  for (let v = 1; v < 256; v++) if (hist[v] > hist[best]) best = v
  PAPER = best
  if (PAPER < 200) throw new Error(`paper ${PAPER} — not on the stage`)
  const colN = new Int32Array(w), rowN = new Int32Array(h)
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (isInk(LUM(d, (y * w + x) * 4))) { colN[x]++; rowN[y]++ }
  const colMin = (Y1 - Y0) * 0.04, rowMin = (X1 - X0) * 0.04
  let x0 = -1, x1 = -1, y0 = -1, y1 = -1
  for (let x = X0; x < X1; x++) if (colN[x] > colMin) { if (x0 < 0) x0 = x; x1 = x }
  for (let y = Y0; y < Y1; y++) if (rowN[y] > rowMin) { if (y0 < 0) y0 = y; y1 = y }
  if (x1 < 0 || y1 < 0) throw new Error("no ink found")
  const NB = 48, bw = (x1 - x0) / NB, bh = (y1 - y0) / NB
  const cov = new Float32Array(NB * NB)
  for (let y = y0; y <= y1; y++) {
    const by = Math.min(NB - 1, Math.floor((y - y0) / bh))
    for (let x = x0; x <= x1; x++) if (isInk(LUM(d, (y * w + x) * 4))) cov[by * NB + Math.min(NB - 1, Math.floor((x - x0) / bw))]++
  }
  let bestS = -1, bx = 0, by = 0
  const W = 5
  for (let r = 0; r + W <= NB; r++) for (let c = 0; c + W <= NB; c++) {
    let sm = 0
    for (let rr = 0; rr < W; rr++) for (let cc = 0; cc < W; cc++) sm += cov[(r + rr) * NB + c + cc]
    if (sm > bestS) { bestS = sm; bx = c; by = r }
  }
  const mx = (x0 + (bx + W / 2) * bw) / w, my = (y0 + (by + W / 2) * bh) / h
  const iw = (x1 - x0) / w, mw = iw * 0.15, mh = iw * 0.15 * 0.72
  MACRO = rectOf(mx - mw / 2, my - mh / 2, mw, mh)
}

const rows = []
let fails = 0
for (const cs of CASES) {
  const cells = []
  console.log(`\n=== ${cs.preset}, relief ${cs.bump} ===`)
  console.log("  scale    fine(1px)   coarse(4px)   ratio")
  for (const sc of SCALES) {
    await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
    await page.waitForTimeout(140)
    await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), ["texture", cs.preset])
    await page.evaluate((v) => window.__styleHarness.setStyle({ textureScale: v }), sc)
    await page.evaluate((k) => window.__textureShaderHarness.set("uFsTexBump", k), cs.bump)
    await page.waitForTimeout(560)
    const buf = await page.screenshot({ clip: MACRO })
    const { d, w, h } = await pxOf(buf)
    let ink = 0, tot = 0
    for (let i = 0; i < d.length; i += 4) { tot++; if (isInk(LUM(d, i))) ink++ }
    if (ink / tot < 0.02) throw new Error(`macro crop is off the form (ink ${(ink / tot).toFixed(4)})`)
    const fine = energyAt(d, w, h, 1)
    const coarse = energyAt(d, w, h, 4)
    console.log(`  ${String(sc).padEnd(8)} ${fine.toFixed(2).padStart(9)} ${coarse.toFixed(2).padStart(13)} ${(coarse / Math.max(fine, 1e-6)).toFixed(3).padStart(8)}`)
    rows.push({ preset: cs.preset, bump: cs.bump, scale: sc, fine: +fine.toFixed(3), coarse: +coarse.toFixed(3) })
    cells.push({ label: `scale ${sc}`, buf })
  }
  const imgs = await Promise.all(cells.map((c) => loadImage(c.buf)))
  const cw = imgs[0].width, ch = imgs[0].height, pad = 6
  const cv = createCanvas(cells.length * (cw + pad) + pad, ch + 30 + pad)
  const g = cv.getContext("2d")
  g.fillStyle = "#111"; g.fillRect(0, 0, cv.width, cv.height)
  cells.forEach((c, i) => {
    g.drawImage(imgs[i], pad + i * (cw + pad), pad)
    g.fillStyle = "#eee"; g.font = "16px monospace"
    g.fillText(c.label, pad + i * (cw + pad) + 2, pad + ch + 20)
  })
  writeFileSync(join(OUT, "sheets", `origin_${cs.preset}_b${cs.bump}.png`), cv.toBuffer("image/png"))

  /* THE VERDICT. Across a 14.7x span of textureScale a real pattern's fine/coarse
   * energy ratio has to MOVE; a mesh fixed to the surface cannot. */
  const set = rows.filter((r) => r.preset === cs.preset && r.bump === cs.bump)
  const ratios = set.map((r) => r.coarse / Math.max(r.fine, 1e-6))
  const spread = Math.max(...ratios) - Math.min(...ratios)
  const label = `${cs.preset} relief ${cs.bump}`
  if (cs.bump === 0) {
    if (spread > 0.15) console.log(`  PASS  control (${label}): the ratio moves ${spread.toFixed(3)} across the scale sweep, so this measure CAN see a pattern changing frequency`)
    else { console.log(`  FAIL  control (${label}): ratio spread only ${spread.toFixed(3)} — the measure cannot see frequency, so nothing below it means anything`); fails++ }
  } else {
    console.log(`  ratio spread with relief on: ${spread.toFixed(3)}`)
  }
}
writeFileSync(join(OUT, "origin.json"), JSON.stringify(rows, null, 2))
await page.evaluate(() => window.__textureShaderHarness.set("uFsTexBump", 0))
await browser.close()
console.log(fails ? `\n${fails} FAILING ROW(S)` : "\nALL CONTROL ROWS PASS")
process.exit(fails ? 1 : 0)
