// PROBE — the RENDERED evidence for the relief amplitude call.
//
// A dOff crossing a line is not the same as a pattern reading as a material, and
// this whole lane exists because a rail that "changed pixels" still looked like
// one silver tube thirteen times. So every amplitude in the sweep also gets
// LOOKED AT: one row per texture preset, one column per amplitude, cropped to
// the densest patch of ink at native device resolution and NOT downscaled — a
// contact sheet that has been resized cannot answer "does the pattern read".
//
// Output: docs/verification/texture-relief/sheets/<mode>_<preset>.png  (one row)
//         docs/verification/texture-relief/sheets/<mode>_ALL.png       (the grid)
//
// Usage: node scripts/verify/_probe-relief-sheet.mjs [--modes=rod] [--bumps=0,0.25,0.5,1]
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
const OUT = join(ROOT, "docs", "verification", "texture-relief", "sheets")
mkdirSync(OUT, { recursive: true })
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}
const MODES = arg("modes", "rod").split(",")
const BUMPS = arg("bumps", "0,0.25,0.5,1").split(",").map(Number)
/* Which parked uniform the columns sweep. Defaults to the relief amplitude; the
 * any parked uniform in lib/texture-shader.ts can be swept the same way — one
 * uniform, one row of native-resolution crops, judged by eye. */
const UNIFORM = arg("uniform", "uFsTexBump")
const HOLD = arg("hold", "")   // e.g. --hold=uFsTexBump:0.6, applied to every cell
const PRESETS = arg("presets",
  "fineGrain,scanlines,contourBands,scratchedInk,gelBubbles,crosshatch,inkDots,woodgrain,cellular,brushedSteel,craquelure,interference").split(",")

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

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const errors = []
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 300)) })
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 300)))
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness)
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), stroke())
await page.waitForTimeout(1600)
await page.evaluate(() => window.__revealHarness.setProgress(1))

const boxes = await page.$$eval("canvas", (els) =>
  els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }))
const box = boxes.reduce((a, b) => (b.x > a.x ? b : a))
const rectOf = (fx, fy, fw, fh) => ({
  x: box.x + box.width * fx, y: box.y + box.height * fy,
  width: box.width * fw, height: box.height * fh,
})
const OFF = {
  textureEnabled: false, textureMode: "none", ditherEnabled: false,
  asciiEnabled: false, layerStackEnabled: false, fusionPreset: "none", motionMode: "off",
}

/* Densest patch of ink, same construction verify-screen-layers.mjs uses, with
 * its three guards: paper must be paper, the crop must be ON the form, and the
 * crop must not be a flat field. A sheet of blank stage is the failure this
 * whole family of scripts keeps producing. */
async function macroRect() {
  const full = await page.screenshot({ clip: rectOf(0, 0, 1, 1) })
  const { d, w, h } = await pxOf(full)
  const X0 = Math.round(w * 0.03), X1 = Math.round(w * 0.97)
  const Y0 = Math.round(h * 0.03), Y1 = Math.round(h * 0.68)
  const hist = new Float64Array(256)
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) hist[Math.max(0, Math.min(255, Math.round(LUM(d, (y * w + x) * 4))))]++
  let best = 0
  for (let v = 1; v < 256; v++) if (hist[v] > hist[best]) best = v
  PAPER = best
  if (PAPER < 200) throw new Error(`paper measured at ${PAPER} — not on the stage`)
  const colN = new Int32Array(w), rowN = new Int32Array(h)
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) {
    if (isInk(LUM(d, (y * w + x) * 4))) { colN[x]++; rowN[y]++ }
  }
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
  let bestS = -1, bx = 0, by = 0, W = 5
  for (let r = 0; r + W <= NB; r++) for (let c = 0; c + W <= NB; c++) {
    let s = 0
    for (let rr = 0; rr < W; rr++) for (let cc = 0; cc < W; cc++) s += cov[(r + rr) * NB + c + cc]
    if (s > bestS) { bestS = s; bx = c; by = r }
  }
  const mx = (x0 + (bx + W / 2) * bw) / w, my = (y0 + (by + W / 2) * bh) / h
  const iw = (x1 - x0) / w
  const mw = iw * 0.15, mh = mw * 0.72
  return rectOf(mx - mw / 2, my - mh / 2, mw, mh)
}

let fails = 0
for (const mode of MODES) {
  await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
  await page.waitForTimeout(1300)
  await page.evaluate(() => window.__captureHarness.frontView(0.95))
  await page.waitForTimeout(600)
  await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
  await page.waitForTimeout(600)
  const MACRO = await macroRect()
  const offBuf = await page.screenshot({ clip: MACRO })

  const allRows = []
  for (const preset of PRESETS) {
    const cells = [{ label: "layers OFF", buf: offBuf }]
    for (const v of BUMPS) {
      await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
      await page.waitForTimeout(140)
      await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), ["texture", preset])
      const applied = await page.evaluate(([name, k, hold]) => {
        if (hold) { const [hn, hv] = hold.split(":"); window.__textureShaderHarness.set(hn, Number(hv)) }
        window.__textureShaderHarness.set(name, k)
        return window.__textureShaderHarness.get(name)
      }, [UNIFORM, v, HOLD])
      if (!applied.length || applied.some((x) => Math.abs(x - v) > 1e-9)) {
        throw new Error(`${UNIFORM} did not take: asked ${v}, read ${JSON.stringify(applied)}`)
      }
      await page.waitForTimeout(560)
      cells.push({ label: `${UNIFORM.replace("uFsTex", "")} ${v}`, buf: await page.screenshot({ clip: MACRO }) })
    }
    // one row, NATIVE SIZE — never scaled down, that is the whole point
    const imgs = await Promise.all(cells.map((c) => loadImage(c.buf)))
    const cw = imgs[0].width, ch = imgs[0].height, pad = 6, lab = 26
    const cv = createCanvas(cells.length * (cw + pad) + pad, ch + lab + pad * 2)
    const g = cv.getContext("2d")
    g.fillStyle = "#111"; g.fillRect(0, 0, cv.width, cv.height)
    cells.forEach((c, i) => {
      g.drawImage(imgs[i], pad + i * (cw + pad), pad)
      g.fillStyle = "#eee"; g.font = "16px monospace"
      g.fillText(c.label, pad + i * (cw + pad) + 2, pad + ch + 19)
    })
    writeFileSync(join(OUT, `${mode}_${UNIFORM}_${preset}.png`), cv.toBuffer("image/png"))
    allRows.push({ preset, cells })
    console.log(`[sheet] ${mode}/${preset} — ${cells.length} cells at ${cw}x${ch}`)
  }

  // the grid, at whatever scale fits — for scanning, not for judging
  const first = await loadImage(allRows[0].cells[0].buf)
  const scale = Math.min(1, 1600 / ((BUMPS.length + 1) * first.width))
  const tw = Math.round(first.width * scale), th = Math.round(first.height * scale)
  const pad = 4, lab = 18, labW = 130
  const cv = createCanvas(labW + (BUMPS.length + 1) * (tw + pad) + pad, allRows.length * (th + pad) + lab + pad)
  const g = cv.getContext("2d")
  g.fillStyle = "#111"; g.fillRect(0, 0, cv.width, cv.height)
  g.fillStyle = "#eee"; g.font = "13px monospace"
  allRows[0].cells.forEach((c, i) => g.fillText(c.label, labW + i * (tw + pad), 13))
  for (let r = 0; r < allRows.length; r++) {
    const y = lab + pad + r * (th + pad)
    g.fillStyle = "#eee"; g.fillText(allRows[r].preset, 4, y + th / 2)
    const ims = await Promise.all(allRows[r].cells.map((c) => loadImage(c.buf)))
    ims.forEach((im, i) => g.drawImage(im, labW + i * (tw + pad), y, tw, th))
  }
  writeFileSync(join(OUT, `${mode}_${UNIFORM}_ALL.png`), cv.toBuffer("image/png"))
  console.log(`[sheet] wrote ${mode}_${UNIFORM}_ALL.png`)
}
await page.evaluate(() => {
  window.__textureShaderHarness.set("uFsTexBump", 0)
})
if (errors.length) { console.log(`FAIL  ${errors.length} console error(s):`); errors.slice(0, 6).forEach((e) => console.log("   ", e)); fails++ }
else console.log("PASS  no console errors while sweeping the relief amplitude")
await browser.close()
process.exit(fails ? 1 : 0)
