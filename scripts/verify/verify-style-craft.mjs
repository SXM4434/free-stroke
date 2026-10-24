// DEEP-DIVE CRAFT VERIFICATION for the screen-space style layers
// (texture / dither / ascii).
//
// WHY THIS EXISTS AND WHY IT IS NOT verify-style.mjs:
// verify-style.mjs proves an effect CHANGED PIXELS and did not regress. It
// grabs the 1920x1080 capture canvas, which is (a) transparent-background and
// (b) so large that any human/model looking at it sees the pattern downsampled
// into mush — exactly the condition under which "a halftone at subpixel cell
// size" and "an ASCII pass that rendered as empty space" both passed review.
//
// This script answers a different question: DOES IT LOOK GOOD.
//   * shoots the REAL viewport (paper background, real dpr) — what a human sees
//   * crops at 2x device scale so a 5px glyph is 10 screenshot pixels
//   * builds CONTACT SHEETS so options are judged against each other, not alone
//   * records VIDEO of every animated option (crawl/alias/strobe only exist in
//     motion) as a durable file under docs/verification/
//
// Usage:
//   node scripts/verify/verify-style-craft.mjs --pass=style-craft --only=stills
//   node scripts/verify/verify-style-craft.mjs --pass=style-craft --only=motion
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import ffmpegPath from "ffmpeg-static"
import { execFileSync } from "node:child_process"
import { writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const PASS = arg("pass", "style-craft")
const ONLY = arg("only", "all")
const OUT = join(ROOT, "docs", "verification", PASS)
const SHEETS = join(OUT, "sheets")
const CROPS = join(OUT, "crops")
const VIDEO = join(OUT, "video")
const TMP = join(OUT, ".frames")

for (const d of [OUT, SHEETS, CROPS, VIDEO]) mkdirSync(d, { recursive: true })

/* The stroke: one broad loop with a couple of tight turns, so every crop has
 * BOTH a wide face (where a pattern has room to read) and a narrow limb (where
 * a too-large cell size stops reading). */
function testStroke() {
  const pts = []
  for (let i = 0; i <= 140; i++) {
    const t = i / 140
    pts.push({
      x: 110 + t * 640,
      y: 330 + Math.sin(t * Math.PI * 2.2) * 135 + Math.sin(t * Math.PI * 6) * 24,
    })
  }
  return [pts]
}

const TEXTURES = [
  "grain", "noise", "scanlines", "bands", "contour", "crosshatch",
  "dots", "woodgrain", "cellular", "brushed", "craquelure", "ripple",
]
const DITHERS = [
  "bayer4", "bayer8", "blueNoise", "halftone", "lines",
  "dotScreen", "hatch", "crosshatch", "diamond", "newsprint",
]
const CHARSETS = [
  "classic", "blocks", "minimal", "dots", "custom",
  "braille", "boxes", "arrows", "punct", "numeric",
]

/* Real preset ids, so the sheets show what a USER actually gets, not a
 * harness-neutral parameter set nobody will ever select. */
const TEXTURE_PRESET_IDS = [
  "fineGrain", "scanlines", "contourBands", "scratchedInk", "gelBubbles",
  "crosshatch", "inkDots", "woodgrain", "cellular", "brushedSteel",
  "craquelure", "interference",
]
const DITHER_PRESET_IDS = ["bayerClassic", "dotMatrix", "hardThreshold", "softDither", "pixelSignal"]
const ASCII_PRESET_IDS = ["terminalShade", "binarySkin", "blockGlyph", "codeMarks", "sparseGlyph"]

const OFF = {
  textureEnabled: false, textureMode: "none", textureAnimated: false,
  ditherEnabled: false, ditherAnimated: false,
  asciiEnabled: false, asciiAnimated: false,
  fusionPreset: "none", layerStackEnabled: false,
  stackAnimationEnabled: false, materialAnimationEnabled: false,
  motionMode: "off",
}

async function main() {
  const browser = await chromium.launch({ headed: true })
  const ctx = await browser.newContext({
    viewport: { width: 1500, height: 950 },
    deviceScaleFactor: 2,
    ...(ONLY === "motion" || ONLY === "all"
      ? { recordVideo: { dir: VIDEO, size: { width: 1500, height: 950 } } }
      : {}),
  })
  const page = await ctx.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
    null, { timeout: 30000 },
  )
  await page.evaluate((poly) => {
    window.__styleHarness.injectStrokes(poly, { msPerPoint: 12, gapMs: 60 })
  }, testStroke())
  await page.waitForTimeout(1600)
  await page.evaluate(() => window.__revealHarness.setProgress(1.0))

  const setStyle = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
  const selectPreset = (fam, id) =>
    page.evaluate(([f, i]) => window.__styleHarness.selectPreset(f, i), [fam, id])
  const setMode = async (mode) => {
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(900)
    await page.evaluate(() => window.__captureHarness.frontView(0.95))
    await page.waitForTimeout(350)
  }

  // THE 3D VIEWPORT CANVAS, NOT THE DRAWING CANVAS.
  // The page has two <canvas> elements; the first in DOM order is the 2D ink
  // pad on the left. Screenshotting that one produces a thin black hairline on
  // white for every style setting — an evidence set in which nothing ever
  // changes and everything therefore "passes". Pick the right-hand (3D) one.
  const boxes = await page.$$eval("canvas", (els) =>
    els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } }),
  )
  const box = boxes.reduce((a, b) => (b.x > a.x ? b : a))
  if (box.width < 300) throw new Error("3D canvas not found: " + JSON.stringify(boxes))

  const shotRect = (r) => page.screenshot({ clip: r })
  const rectOf = (fx, fy, fw, fh) => ({
    x: box.x + box.width * fx, y: box.y + box.height * fy,
    width: box.width * fw, height: box.height * fh,
  })

  /** Ink bounding box inside the 3D canvas, measured from a real frame with
   *  every layer off — so the crops always land ON the form no matter how the
   *  camera framed it. Guessing fractions is how the last harness ended up
   *  photographing blank paper. */
  async function locate() {
    const full = await shotRect(rectOf(0, 0, 1, 1))
    const img = await loadImage(full)
    const cv = createCanvas(img.width, img.height), g = cv.getContext("2d")
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, img.width, img.height).data
    // The 3D canvas also carries CHROME: a faint grid across the whole area and
    // the timeline/note panel along the bottom. Both are "not paper", so a
    // naive dark-pixel bbox returns the whole canvas — which is exactly the
    // failure that made the first run photograph blank paper. Restrict to the
    // stage area, and require a row/column to be MOSTLY ink before it counts.
    const X0 = Math.round(img.width * 0.03), X1 = Math.round(img.width * 0.97)
    const Y0 = Math.round(img.height * 0.03), Y1 = Math.round(img.height * 0.68)
    const colN = new Int32Array(img.width), rowN = new Int32Array(img.height)
    for (let y = Y0; y < Y1; y++) {
      for (let x = X0; x < X1; x++) {
        const i = (y * img.width + x) * 4
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
        if (l < 232) { colN[x]++; rowN[y]++ }
      }
    }
    const colMin = (Y1 - Y0) * 0.012, rowMin = (X1 - X0) * 0.012
    let x0 = -1, x1 = -1, y0 = -1, y1 = -1
    for (let x = X0; x < X1; x++) if (colN[x] > colMin) { if (x0 < 0) x0 = x; x1 = x }
    for (let y = Y0; y < Y1; y++) if (rowN[y] > rowMin) { if (y0 < 0) y0 = y; y1 = y }
    if (x1 < 0 || y1 < 0) throw new Error("no ink found in 3D canvas")
    // MACRO CENTRE = the densest patch of ink, not a guessed fraction of the
    // bbox. A stroke is a thin ribbon inside a big rectangle, so any fixed
    // fraction of the bbox lands on paper or clips the form's edge — the first
    // macro sheets came back as slivers for exactly that reason.
    const NB = 48
    const bw = (x1 - x0) / NB, bh = (y1 - y0) / NB
    const cov = new Float32Array(NB * NB)
    for (let y = y0; y <= y1; y++) {
      const by = Math.min(NB - 1, Math.floor((y - y0) / bh))
      for (let x = x0; x <= x1; x++) {
        const i = (y * img.width + x) * 4
        const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
        if (l < 232) cov[by * NB + Math.min(NB - 1, Math.floor((x - x0) / bw))]++
      }
    }
    let best = -1, bx = 0, by = 0
    const W = 5 // window in blocks
    for (let r = 0; r + W <= NB; r++) {
      for (let c = 0; c + W <= NB; c++) {
        let s = 0
        for (let rr = 0; rr < W; rr++) for (let cc = 0; cc < W; cc++) s += cov[(r + rr) * NB + c + cc]
        if (s > best) { best = s; bx = c; by = r }
      }
    }
    const sx = img.width, sy = img.height
    return {
      x0: x0 / sx, y0: y0 / sy, x1: x1 / sx, y1: y1 / sy,
      mx: (x0 + (bx + W / 2) * bw) / sx,
      my: (y0 + (by + W / 2) * bh) / sy,
    }
  }

  // Two standard framings, both derived from the measured ink box:
  //   WIDE  — the left half of the form: "does this read as a treatment"
  //   MACRO — one limb blown up ~6x: "is the cell/glyph/dot legible at all"
  let WIDE = null, MACRO = null
  async function reframe() {
    const ink = await locate()
    const iw = ink.x1 - ink.x0, ih = ink.y1 - ink.y0
    WIDE = rectOf(ink.x0 - 0.01, ink.y0 - 0.02, iw * 0.55, ih + 0.04)
    const mw = iw * 0.15, mh = mw * 0.72
    MACRO = rectOf(ink.mx - mw / 2, ink.my - mh / 2, mw, mh)
    console.log("[craft] reframed ink", JSON.stringify(ink))
  }
  const wide = () => shotRect(WIDE)
  const macro = () => shotRect(MACRO)

  /** Fraction of a crop that is not paper. A verification frame showing blank
   *  paper is worse than no frame: it reads as "nothing changed" and passes. */
  async function inkFrac(buf) {
    const img = await loadImage(buf)
    const cv = createCanvas(img.width, img.height), g = cv.getContext("2d")
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, img.width, img.height).data
    let n = 0
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
      if (l < 232) n++
    }
    return n / (d.length / 4)
  }
  async function assertOnForm(label) {
    const f = await inkFrac(await macro())
    if (f < 0.12) {
      await reframe()
      const f2 = await inkFrac(await macro())
      if (f2 < 0.12) throw new Error(`macro crop is off the form for ${label} (ink ${f2.toFixed(3)})`)
    }
  }

  const shot = async (name, buf) => {
    writeFileSync(join(CROPS, `${name}.png`), buf)
    return buf
  }

  /** Tile labelled crops into one contact sheet. */
  async function sheet(name, entries, cols) {
    const imgs = await Promise.all(entries.map((e) => loadImage(e.buf)))
    const cw = imgs[0].width, ch = imgs[0].height
    const scale = Math.min(1, 1360 / (cols * cw))
    const tw = Math.round(cw * scale), th = Math.round(ch * scale)
    const pad = 4, lab = 20
    const rows = Math.ceil(entries.length / cols)
    const cv = createCanvas(cols * (tw + pad) + pad, rows * (th + lab + pad) + pad)
    const g = cv.getContext("2d")
    g.fillStyle = "#111"
    g.fillRect(0, 0, cv.width, cv.height)
    entries.forEach((e, i) => {
      const cx = pad + (i % cols) * (tw + pad)
      const cy = pad + Math.floor(i / cols) * (th + lab + pad)
      g.drawImage(imgs[i], cx, cy, tw, th)
      g.fillStyle = "#eee"
      g.font = "13px monospace"
      g.fillText(e.label, cx + 3, cy + th + 14)
    })
    writeFileSync(join(SHEETS, `${name}.png`), cv.toBuffer("image/png"))
    console.log(`[craft] sheet ${name} (${entries.length} cells)`)
  }

  /** Mean/σ over the ink region of a crop — numbers so nothing passes on vibes.
   *  Ink region = pixels darker than the paper background. */
  async function stats(buf) {
    const img = await loadImage(buf)
    const cv = createCanvas(img.width, img.height)
    const g = cv.getContext("2d")
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, img.width, img.height).data
    let n = 0, sum = 0, sum2 = 0, dark = 0
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
      if (l < 235) { n++; sum += l; sum2 += l * l }
      if (l < 60) dark++
    }
    if (!n) return { n: 0, mean: 0, sd: 0, darkFrac: 0 }
    const mean = sum / n
    return {
      n, mean: +mean.toFixed(1),
      sd: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(1),
      darkFrac: +(dark / (d.length / 4)).toFixed(3),
    }
  }

  const report = []

  /* ================= STILLS ============================================ */
  if (ONLY === "all" || ONLY === "stills") {
    for (const mode of ["solid", "extrude"]) {
      await setMode(mode)

      // --- texture, raw options at one fixed setting ---
      await setStyle({ ...OFF })
      await page.waitForTimeout(400)
      await reframe()
      const offW = await wide()
      const offStats = await stats(offW)
      await shot(`${mode}_00_off_wide`, offW)
      const offM = await macro()
      await shot(`${mode}_00_off_macro`, offM)

      const texEntries = [{ label: "OFF", buf: offW }]
      const texMacro = [{ label: "OFF", buf: offM }]
      for (const t of TEXTURES) {
        await setStyle({ ...OFF, textureEnabled: true, textureMode: t,
          textureScale: 1.0, textureIntensity: 0.7, textureContrast: 0.6,
          textureLockMode: "object" })
        await page.waitForTimeout(260)
        const w = await wide(); const m = await macro()
        await shot(`${mode}_tex_${t}_wide`, w)
        await shot(`${mode}_tex_${t}_macro`, m)
        texEntries.push({ label: t, buf: w })
        texMacro.push({ label: t, buf: m })
        const s = await stats(w)
        report.push({ mode, sys: "texture", opt: t, ...s, refSd: offStats.sd })
      }
      await sheet(`${mode}_texture_wide`, texEntries, 4)
      await sheet(`${mode}_texture_macro`, texMacro, 4)

      // --- texture at REAL preset settings ---
      const texPre = []
      for (const id of TEXTURE_PRESET_IDS) {
        await setStyle({ ...OFF })
        await selectPreset("texture", id)
        await page.waitForTimeout(280)
        const m = await macro()
        await shot(`${mode}_texpreset_${id}_macro`, m)
        texPre.push({ label: id, buf: m })
        report.push({ mode, sys: "texturePreset", opt: id, ...(await stats(m)) })
      }
      await sheet(`${mode}_texture_presets_macro`, texPre, 4)

      // --- dither ---
      const ditEntries = [{ label: "OFF", buf: offW }]
      const ditMacro = [{ label: "OFF", buf: offM }]
      for (const d of DITHERS) {
        await setStyle({ ...OFF, ditherEnabled: true, ditherType: d,
          ditherScale: 4, ditherLevels: 2, ditherIntensity: 1,
          ditherContrast: 0.55, ditherThreshold: 0.5, ditherExposure: 0.5,
          ditherAngle: 45, ditherLockMode: "screen" })
        await page.waitForTimeout(260)
        const w = await wide(); const m = await macro()
        await shot(`${mode}_dit_${d}_wide`, w)
        await shot(`${mode}_dit_${d}_macro`, m)
        ditEntries.push({ label: d, buf: w })
        ditMacro.push({ label: d, buf: m })
        report.push({ mode, sys: "dither", opt: d, ...(await stats(w)) })
      }
      await sheet(`${mode}_dither_wide`, ditEntries, 4)
      await sheet(`${mode}_dither_macro`, ditMacro, 4)

      const ditPre = []
      for (const id of DITHER_PRESET_IDS) {
        await setStyle({ ...OFF })
        await selectPreset("dither", id)
        await page.waitForTimeout(280)
        const m = await macro()
        await shot(`${mode}_ditpreset_${id}_macro`, m)
        ditPre.push({ label: id, buf: m })
        report.push({ mode, sys: "ditherPreset", opt: id, ...(await stats(m)) })
      }
      await sheet(`${mode}_dither_presets_macro`, ditPre, 3)

      // --- ascii ---
      const ascEntries = [{ label: "OFF", buf: offW }]
      const ascMacro = [{ label: "OFF", buf: offM }]
      for (const c of CHARSETS) {
        await setStyle({ ...OFF, asciiEnabled: true, asciiCharset: c,
          asciiCellSize: 12, asciiDensity: 0.5, asciiContrast: 0.5,
          asciiLockMode: "screen" })
        await page.waitForTimeout(260)
        const w = await wide(); const m = await macro()
        await shot(`${mode}_asc_${c}_wide`, w)
        await shot(`${mode}_asc_${c}_macro`, m)
        ascEntries.push({ label: c, buf: w })
        ascMacro.push({ label: c, buf: m })
        report.push({ mode, sys: "ascii", opt: c, ...(await stats(w)) })
      }
      await sheet(`${mode}_ascii_wide`, ascEntries, 4)
      await sheet(`${mode}_ascii_macro`, ascMacro, 4)

      const ascPre = []
      for (const id of ASCII_PRESET_IDS) {
        await setStyle({ ...OFF })
        await selectPreset("ascii", id)
        await page.waitForTimeout(280)
        const m = await macro()
        await shot(`${mode}_ascpreset_${id}_macro`, m)
        ascPre.push({ label: id, buf: m })
        report.push({ mode, sys: "asciiPreset", opt: id, ...(await stats(m)) })
      }
      await sheet(`${mode}_ascii_presets_macro`, ascPre, 3)
      console.log(`[craft] stills done: ${mode}`)
    }

    // --- DIAL RANGE SWEEPS: does the control reach a visible range? --------
    await setMode("solid")
    await setStyle({ ...OFF })
    await page.waitForTimeout(400)
    await reframe()
    const sweeps = [
      { sys: "texture", dial: "textureIntensity", base: { ...OFF, textureEnabled: true, textureMode: "crosshatch", textureScale: 1, textureContrast: 0.6, textureLockMode: "object" }, vals: [0, 0.25, 0.5, 0.75, 1] },
      { sys: "texture", dial: "textureScale", base: { ...OFF, textureEnabled: true, textureMode: "dots", textureIntensity: 0.75, textureContrast: 0.6, textureLockMode: "object" }, vals: [0.25, 0.5, 1, 2, 4] },
      { sys: "texture", dial: "textureContrast", base: { ...OFF, textureEnabled: true, textureMode: "noise", textureScale: 1, textureIntensity: 0.7, textureLockMode: "object" }, vals: [0, 0.25, 0.5, 0.75, 1] },
      { sys: "dither", dial: "ditherScale", base: { ...OFF, ditherEnabled: true, ditherType: "halftone", ditherLevels: 2, ditherIntensity: 1, ditherContrast: 0.55, ditherThreshold: 0.5, ditherExposure: 0.5, ditherLockMode: "screen" }, vals: [1, 2, 4, 8, 16] },
      { sys: "dither", dial: "ditherLevels", base: { ...OFF, ditherEnabled: true, ditherType: "bayer4", ditherScale: 4, ditherIntensity: 1, ditherContrast: 0.55, ditherThreshold: 0.5, ditherExposure: 0.5, ditherLockMode: "screen" }, vals: [2, 3, 4, 6, 8] },
      { sys: "dither", dial: "ditherExposure", base: { ...OFF, ditherEnabled: true, ditherType: "bayer4", ditherScale: 4, ditherLevels: 2, ditherIntensity: 1, ditherContrast: 0.55, ditherThreshold: 0.5, ditherLockMode: "screen" }, vals: [0, 0.25, 0.5, 0.75, 1] },
      { sys: "dither", dial: "ditherAngle", base: { ...OFF, ditherEnabled: true, ditherType: "hatch", ditherScale: 5, ditherLevels: 2, ditherIntensity: 1, ditherContrast: 0.55, ditherThreshold: 0.5, ditherExposure: 0.5, ditherLockMode: "screen" }, vals: [0, 15, 30, 45, 75] },
      { sys: "ascii", dial: "asciiCellSize", base: { ...OFF, asciiEnabled: true, asciiCharset: "classic", asciiDensity: 0.5, asciiContrast: 0.5, asciiLockMode: "screen" }, vals: [4, 8, 12, 20, 32] },
      { sys: "ascii", dial: "asciiDensity", base: { ...OFF, asciiEnabled: true, asciiCharset: "classic", asciiCellSize: 14, asciiContrast: 0.5, asciiLockMode: "screen" }, vals: [0, 0.25, 0.5, 0.75, 1] },
      { sys: "ascii", dial: "asciiContrast", base: { ...OFF, asciiEnabled: true, asciiCharset: "classic", asciiCellSize: 14, asciiDensity: 0.5, asciiLockMode: "screen" }, vals: [0, 0.25, 0.5, 0.75, 1] },
    ]
    for (const s of sweeps) {
      const cells = []
      for (const v of s.vals) {
        await setStyle({ ...s.base, [s.dial]: v })
        await page.waitForTimeout(240)
        const m = await macro()
        await shot(`sweep_${s.dial}_${v}`, m)
        cells.push({ label: `${s.dial}=${v}`, buf: m })
        report.push({ mode: "solid", sys: `sweep:${s.dial}`, opt: String(v), ...(await stats(m)) })
      }
      await sheet(`sweep_${s.dial}`, cells, 5)
    }

    // --- LOCK MODE: object vs screen, static and orbiting -----------------
    for (const lock of ["object", "screen"]) {
      const cells = []
      for (const az of [0, 20, 40]) {
        await setStyle({ ...OFF, textureEnabled: true, textureMode: "crosshatch",
          textureScale: 1, textureIntensity: 0.7, textureContrast: 0.6, textureLockMode: lock })
        await page.evaluate((a) => window.__captureHarness.orbitView(a, 8, 0.95), az)
        await page.waitForTimeout(300)
        cells.push({ label: `${lock} az${az}`, buf: await macro() })
      }
      await sheet(`lock_${lock}_orbit`, cells, 3)
    }
    await page.evaluate(() => window.__captureHarness.frontView(0.95))
  }

  /* ================= MOTION (frames + video) =========================== */
  if (ONLY === "all" || ONLY === "motion") {
    const FR = parseInt(process.env.MOTION_FRAMES || "48", 10)
    const motionCells = [
      { mode: "solid", key: "tex_grainBoil", family: "animatedTexture", preset: "grainDrift" },
      { mode: "solid", key: "tex_scanScroll", family: "animatedTexture", preset: "scanlineScroll" },
      { mode: "solid", key: "dit_crawl", family: "animatedDither", preset: "ditherCrawl" },
      { mode: "solid", key: "dit_sweep", family: "animatedDither", preset: "thresholdSweep" },
      { mode: "solid", key: "dit_diagDrift", family: "animatedDither", preset: "diagonalMatrixDrift" },
      { mode: "solid", key: "asc_scroll", family: "animatedAscii", preset: "glyphScroll" },
      { mode: "solid", key: "asc_rain", family: "animatedAscii", preset: "asciiRain" },
      { mode: "solid", key: "asc_cycle", family: "animatedAscii", preset: "characterCycle" },
      { mode: "solid", key: "asc_flicker", family: "animatedAscii", preset: "terminalFlicker" },
    ]
    let last = null
    const motionReport = []
    for (const c of motionCells) {
      if (c.mode !== last) {
        await setMode(c.mode)
        await setStyle({ ...OFF })
        await page.waitForTimeout(400)
        await reframe()
        last = c.mode
      }
      await setStyle({ ...OFF })
      await selectPreset(c.family, c.preset)
      await page.waitForTimeout(600)
      await assertOnForm(c.key)
      rmSync(TMP, { recursive: true, force: true })
      mkdirSync(TMP, { recursive: true })
      const bufs = [], wides = []
      mkdirSync(join(TMP, "w"), { recursive: true })
      for (let i = 0; i < FR; i++) {
        const b = await macro()
        writeFileSync(join(TMP, `f${String(i).padStart(4, "0")}.png`), b)
        bufs.push(b)
        const w = await wide()
        writeFileSync(join(TMP, "w", `f${String(i).padStart(4, "0")}.png`), w)
        wides.push(w)
        await page.waitForTimeout(45)
      }
      // frame-to-frame delta over all channels: does it actually move, and how
      // violently. A high mean with a high variance is a strobe, not motion.
      const deltas = []
      for (let i = 1; i < bufs.length; i++) {
        const [a, b] = await Promise.all([loadImage(bufs[i - 1]), loadImage(bufs[i])])
        const cv = createCanvas(a.width, a.height), g = cv.getContext("2d")
        g.drawImage(a, 0, 0)
        const da = g.getImageData(0, 0, a.width, a.height).data
        g.clearRect(0, 0, a.width, a.height); g.drawImage(b, 0, 0)
        const db = g.getImageData(0, 0, a.width, a.height).data
        let s = 0, n = 0
        for (let p = 0; p < da.length; p += 4) {
          s += Math.abs(da[p] - db[p]) + Math.abs(da[p + 1] - db[p + 1]) + Math.abs(da[p + 2] - db[p + 2])
          n += 3
        }
        deltas.push(+(s / n).toFixed(3))
      }
      const mean = deltas.reduce((x, y) => x + y, 0) / deltas.length
      const sd = Math.sqrt(deltas.reduce((a, v) => a + (v - mean) ** 2, 0) / deltas.length)
      motionReport.push({
        cell: c.key, frames: FR,
        meanDelta: +mean.toFixed(3),
        sdDelta: +sd.toFixed(3),
        maxDelta: Math.max(...deltas),
        minDelta: Math.min(...deltas),
        deltas,
      })
      // strip of 8 evenly spaced frames, for reading phase progression
      const step = Math.max(1, Math.floor(FR / 8))
      await sheet(`motion_${c.key}_strip`,
        Array.from({ length: 8 }, (_, i) => ({ label: `f${i * step}`, buf: bufs[i * step] })), 4)
      // durable video
      if (ffmpegPath) {
        for (const [src, suffix] of [[join(TMP, "f%04d.png"), "macro"], [join(TMP, "w", "f%04d.png"), "wide"]]) {
          execFileSync(ffmpegPath, [
            "-y", "-framerate", "18", "-i", src,
            "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2",
            join(VIDEO, `${c.key}_${suffix}.mp4`),
          ], { stdio: "ignore" })
        }
      }
      console.log(`[craft] motion ${c.key}: meanΔ=${mean.toFixed(2)}`)
    }
    rmSync(TMP, { recursive: true, force: true })
    writeFileSync(join(OUT, "motion-report.json"), JSON.stringify(motionReport, null, 2))
  }

  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2))
  console.log(`[craft] console errors: ${errors.length}`)
  errors.slice(0, 8).forEach((e) => console.log("   ", e))
  await ctx.close()
  await browser.close()
  console.log(`[craft] wrote to ${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
