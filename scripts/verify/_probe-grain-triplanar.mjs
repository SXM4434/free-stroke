// PROBE — is the triplanar blend AVERAGING Fine Grain out of existence on Rod?
//
// THE OBSERVATION. On Rod, fineGrain measures dOff 1.40 while eleven siblings on
// the same rail measure 4.7-6.2, and it does not respond to textureScale
// (docs/verification/texture-relief/sheets/origin_fineGrain_b0.png, 32x sweep),
// to the grain lattice floor (rod_uFsTexGrainPx_fineGrain.png, 2..9 px), or to
// relief. Three dials that each move every other preset move this one by nothing.
//
// THE HYPOTHESIS. `fsTexTriplanar` evaluates the pattern on THREE object-space
// planes — p.xy, p.zy, p.xz — and blends them by |normal|^6. On a TUBE the
// normal sweeps continuously, so over a wide band of the surface two or three
// weights are comparable.
//
//   · A pattern that depends on ONE axis survives that. Bands and scanlines are
//     f(co.y), so p.xy and p.zy return the SAME VALUE and blending changes
//     almost nothing.
//   · Grain is hash(floor(co * cell)) — the three planes return three
//     UNCORRELATED numbers, so blending them is averaging independent random
//     variables. The mean stays 0.5 and the variance falls by up to 3x. The
//     pattern is not being hidden; it is being cancelled.
//
// THE TEST, and it needs no code change to run. Screen lock evaluates ONE plane
// (gl_FragCoord) — no triplanar, no blend. So:
//   · if grain's contrast on Rod jumps under screen lock while a one-axis
//     pattern like contourBands barely moves, the averaging is the mechanism;
//   · if grain stays flat under screen lock too, the blend is innocent and the
//     suppression is somewhere else.
// contourBands is the control: it must NOT show the same jump, or the test is
// just measuring "screen lock looks different".
//
// Usage: node scripts/verify/_probe-grain-triplanar.mjs
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

const CASES = [
  { preset: "fineGrain", why: "2-D uncorrelated hash — the suspect" },
  { preset: "contourBands", why: "f(co.y) only — the control, must not jump" },
  { preset: "inkDots", why: "2-D but low frequency — the middle case" },
]
const LOCKS = ["object", "screen"]

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
function diff(a, b) {
  let s = 0, n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (!isInk(LUM(a, i)) && !isInk(LUM(b, i))) continue
    s += Math.abs(LUM(a, i) - LUM(b, i)); n++
  }
  return n ? s / n : 0
}
/** Standard deviation of ink luminance — "how much contrast does the pattern
 *  actually put on the surface", which is the quantity averaging destroys. */
function inkSd(a) {
  let n = 0, s = 0, s2 = 0
  for (let i = 0; i < a.length; i += 4) {
    const l = LUM(a, i)
    if (!isInk(l)) continue
    n++; s += l; s2 += l * l
  }
  return n ? Math.sqrt(Math.max(0, s2 / n - (s / n) ** 2)) : 0
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

let MACRO = null
{
  const { d, w, h } = await pxOf(await page.screenshot({ clip: rectOf(0, 0, 1, 1) }))
  const X0 = Math.round(w * 0.03), X1 = Math.round(w * 0.97), Y0 = Math.round(h * 0.03), Y1 = Math.round(h * 0.68)
  const hist = new Float64Array(256)
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) hist[Math.max(0, Math.min(255, Math.round(LUM(d, (y * w + x) * 4))))]++
  let best = 0
  for (let v = 1; v < 256; v++) if (hist[v] > hist[best]) best = v
  PAPER = best
  if (PAPER < 200) throw new Error(`paper ${PAPER} — not on the stage`)
  const colN = new Int32Array(w), rowN = new Int32Array(h)
  for (let y = Y0; y < Y1; y++) for (let x = X0; x < X1; x++) if (isInk(LUM(d, (y * w + x) * 4))) { colN[x]++; rowN[y]++ }
  let x0 = -1, x1 = -1, y0 = -1, y1 = -1
  for (let x = X0; x < X1; x++) if (colN[x] > (Y1 - Y0) * 0.04) { if (x0 < 0) x0 = x; x1 = x }
  for (let y = Y0; y < Y1; y++) if (rowN[y] > (X1 - X0) * 0.04) { if (y0 < 0) y0 = y; y1 = y }
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
  const iw = (x1 - x0) / w, mw = iw * 0.15
  MACRO = rectOf(mx - mw / 2, my - mw * 0.72 / 2, mw, mw * 0.72)
}
const offBuf = await page.screenshot({ clip: MACRO })
const off = (await pxOf(offBuf)).d
const offSd = inkSd(off)

const rows = []
console.log(`layers OFF: ink sigma ${offSd.toFixed(2)}\n`)
console.log("preset          lock       dOff     inkSigma")
const cells = [{ label: "layers OFF", buf: offBuf }]
for (const cs of CASES) {
  const got = {}
  for (const lock of LOCKS) {
    await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
    await page.waitForTimeout(150)
    await page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), ["texture", cs.preset])
    await page.waitForTimeout(150)
    await page.evaluate((l) => window.__styleHarness.setStyle({ textureLockMode: l }), lock)
    await page.waitForTimeout(520)
    const buf = await page.screenshot({ clip: MACRO })
    const { d } = await pxOf(buf)
    const dOff = diff(off, d), sd = inkSd(d)
    got[lock] = { dOff, sd }
    rows.push({ preset: cs.preset, lock, dOff: +dOff.toFixed(3), inkSd: +sd.toFixed(3) })
    cells.push({ label: `${cs.preset} ${lock}`, buf })
    console.log(`${cs.preset.padEnd(15)} ${lock.padEnd(8)} ${dOff.toFixed(2).padStart(8)} ${sd.toFixed(2).padStart(12)}`)
  }
  const ratio = got.screen.dOff / Math.max(got.object.dOff, 1e-6)
  console.log(`   -> screen/object dOff ratio ${ratio.toFixed(2)}   (${cs.why})\n`)
  rows.push({ preset: cs.preset, ratio: +ratio.toFixed(3) })
}

const imgs = await Promise.all(cells.map((c) => loadImage(c.buf)))
const cw = imgs[0].width, ch = imgs[0].height, pad = 6
const cv = createCanvas(cells.length * (cw + pad) + pad, ch + 30 + pad)
const g = cv.getContext("2d")
g.fillStyle = "#111"; g.fillRect(0, 0, cv.width, cv.height)
cells.forEach((c, i) => {
  g.drawImage(imgs[i], pad + i * (cw + pad), pad)
  g.fillStyle = "#eee"; g.font = "14px monospace"
  g.fillText(c.label, pad + i * (cw + pad) + 2, pad + ch + 20)
})
writeFileSync(join(OUT, "sheets", "grain_triplanar.png"), cv.toBuffer("image/png"))
writeFileSync(join(OUT, "grain-triplanar.json"), JSON.stringify(rows, null, 2))

const grain = rows.find((r) => r.preset === "fineGrain" && r.ratio !== undefined).ratio
const ctrl = rows.find((r) => r.preset === "contourBands" && r.ratio !== undefined).ratio
let fails = 0
if (grain > 2.0 && grain > ctrl * 1.8) {
  console.log(`PASS  the blend is the mechanism: fineGrain gains ${grain.toFixed(2)}x from dropping the triplanar blend while the one-axis control gains only ${ctrl.toFixed(2)}x`)
} else {
  console.log(`FAIL  not the blend: fineGrain ${grain.toFixed(2)}x vs control ${ctrl.toFixed(2)}x — the suppression is somewhere else and this hypothesis is dead`)
  fails++
}
await page.evaluate((x) => window.__styleHarness.setStyle(x), OFF)
await browser.close()
process.exit(fails ? 1 : 0)
