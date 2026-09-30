// THE EYE IS THE INSTRUMENT — before/after at 7x, on paper AND on a dark ground.
//
// Sebs, 2026-08-04: *"the 3d version is also too brown, should still feel
// black."* The numbers are in `_probe-brown-decile.mjs`; this is the picture
// that has to agree with them.
//
// TWO GROUNDS, AND THE DARK ONE IS A REAL RENDER, NOT A RE-COMPOSITE.
// A form can read neutral head-on and warm where the low fill wraps it, and a
// warm cast on a warm paper hides inside the paper. So each arm is captured
// twice:
//
//   · ON PAPER — `[data-hero-stage]` screenshot, exactly what ships, fully
//     opaque. Asserted: zero pixels below alpha 255.
//   · ON DARK  — `__captureHarness.enable()` switches the viewport to its
//     transparent render target and `grab()` returns a real alpha PNG of the
//     WebGL buffer. Composited here onto the register's own darkest ink
//     (`#121110`). This is a SECOND RENDER of the same build, not the paper
//     frame with its background swapped — a matte guessed from luminance would
//     be an artefact wearing the shape of evidence.
//
// ⚠ AND THE ALPHA IS ASSERTED IN BOTH DIRECTIONS. A contact sheet in this repo
// was once written RGBA with 95.8% of its pixels at alpha 0 and read on black;
// a later lane read a transparent canvas on black as the mark being shredded.
// So: the paper arm must be 100% opaque, and the dark arm must have a coverage
// fraction inside a sane band — enough ink to be a form, not so much that the
// "transparent" grab silently returned an opaque frame.
//
// Usage: node scripts/verify/_probe-brown-sheet.mjs --label=<name>
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { HERO_URL } from "./lib/dev-server.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", null)
if (!LABEL) {
  console.error("--label=<name> is required.")
  process.exit(1)
}
const OUT = join(ROOT, "docs", "verification", "brown-hunt", LABEL)

/** The register's own darkest ink (`INK_3D_RANGE.darkest`), used as the dark
 *  ground so the comparison is against a value the system already ships rather
 *  than against pure black, which flatters everything. */
const DARK = [18, 17, 16]
/** W1 `--dir-bg`. The sheet's own background, so the tiles sit on the same
 *  paper the render does. */
const PAPER = "#FDFCF9"

async function imageData(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  return { W: img.width, H: img.height, d: x.getImageData(0, 0, img.width, img.height).data }
}

/** Bounding box of everything darker than the ink threshold, so the crop is
 *  chosen from the FORM rather than from a hardcoded rectangle that goes stale
 *  the moment the beat re-frames. */
function inkBox({ W, H, d }, alphaGated) {
  let minX = W, maxX = 0, minY = H, maxY = 0, n = 0
  const Hc = Math.floor(H * 0.75)
  for (let y = 0; y < Hc; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const hit = alphaGated ? d[i + 3] > 128 : 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2] < 150
      if (!hit) continue
      n++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  return { minX, maxX, minY, maxY, n }
}

/** A tile: crop the form's first ~22% of width around its vertical centre — the
 *  "De" of "Desk", a bowl and a stem, which carries both a lit face and the
 *  wrapped underside — then scale it to a FIXED tile size.
 *
 *  ⚠ THE TILES ARE NORMALISED TO ONE SIZE ON PURPOSE. The two grounds come from
 *  two different render targets — the stage screenshot is 2240x1684, the
 *  transparent grab is 1920x1080 — so a crop taken as a fraction of the form
 *  lands at a different pixel count in each. Left alone, the dark tiles come
 *  out visibly smaller than the paper tiles and the reader compares two sizes
 *  as well as two colours. The magnification differs between the two rows and
 *  is printed per tile rather than implied, so nobody reads "same size" as
 *  "same zoom".
 *
 *  Nearest-neighbour throughout, so the reader sees pixels rather than a
 *  resampler's opinion of them. */
function crop(src, box, ground, tileW) {
  const cw = Math.round((box.maxX - box.minX) * 0.22)
  const ch = Math.round(cw * 0.75)
  const cx = box.minX + Math.round((box.maxX - box.minX) * 0.01)
  const cy = Math.round((box.minY + box.maxY) / 2 - ch / 2)
  const z = tileW / cw
  const ow = Math.round(cw * z)
  const oh = Math.round(ch * z)
  const out = createCanvas(ow, oh)
  const g = out.getContext("2d")
  const id = g.createImageData(ow, oh)
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const sx = Math.min(src.W - 1, cx + Math.floor(x / z))
      const sy = Math.min(src.H - 1, cy + Math.floor(y / z))
      const s = (sy * src.W + sx) * 4
      const o = (y * ow + x) * 4
      const a = ground ? src.d[s + 3] / 255 : 1
      id.data[o] = ground ? src.d[s] * a + ground[0] * (1 - a) : src.d[s]
      id.data[o + 1] = ground ? src.d[s + 1] * a + ground[1] * (1 - a) : src.d[s + 1]
      id.data[o + 2] = ground ? src.d[s + 2] * a + ground[2] * (1 - a) : src.d[s + 2]
      id.data[o + 3] = 255
    }
  }
  g.putImageData(id, 0, 0)
  out.__zoom = z
  return out
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const arms = {}
  const notes = []

  for (const rigLaw of ["prior", null]) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1440 }, deviceScaleFactor: 2 })
    const page = await context.newPage()
    if (rigLaw) await page.addInitScript((v) => { window.__studioRigLaw = v }, rigLaw)
    await page.goto(HERO_URL, { waitUntil: "networkidle" })
    await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })
    const renderer = await page.evaluate(() => {
      const c = document.createElement("canvas")
      const gl = c.getContext("webgl2") || c.getContext("webgl")
      const e = gl && gl.getExtension("WEBGL_debug_renderer_info")
      return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unknown"
    })
    if (/swiftshader|software/i.test(String(renderer))) throw new Error("SwiftShader — refusing to judge")
    await page.waitForTimeout(3500)

    const scrubber = page.locator("[data-hero-scrub]")
    const stage = page.locator("[data-hero-stage]")
    const total = await scrubber.evaluate((el) => parseFloat(el.max))
    const setPlayhead = async (t) => {
      await scrubber.evaluate((el, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        setter.call(el, String(value))
        el.dispatchEvent(new Event("input", { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
      }, t)
    }
    let tSolid = null
    for (let i = 0; i < 160; i++) {
      const t = (i / 159) * total
      await setPlayhead(t)
      await page.waitForTimeout(10)
      const ph = await page.evaluate(() => document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-phase"))
      if (ph === "solid") { tSolid = t; break }
    }
    if (tSolid === null) throw new Error("no `solid` phase")
    // Mid-phase, not its first frame — the first frame of a phase is a
    // transition frame in every beat this repo has ever measured.
    await setPlayhead(Math.min(total, tSolid + 0.4))
    await page.waitForTimeout(700)

    const arm = rigLaw === "prior" ? "PRIOR" : "SHIPPED"
    const paperBuf = await stage.screenshot()
    writeFileSync(join(OUT, `${arm}-paper.png`), paperBuf)
    const paper = await imageData(paperBuf)
    let opaque = 0
    for (let p = 0; p < paper.W * paper.H; p++) if (paper.d[p * 4 + 3] === 255) opaque++
    const paperOpacity = opaque / (paper.W * paper.H)

    // THE DARK ARM — the viewport's own transparent target, not a re-composite.
    await page.evaluate(() => window.__captureHarness.enable())
    await page.waitForTimeout(900)
    const url = await page.evaluate(() => window.__captureHarness.grab())
    await page.evaluate(() => window.__captureHarness.disable())
    const alphaBuf = Buffer.from(url.split(",")[1], "base64")
    writeFileSync(join(OUT, `${arm}-alpha.png`), alphaBuf)
    const alpha = await imageData(alphaBuf)
    let covered = 0
    for (let p = 0; p < alpha.W * alpha.H; p++) if (alpha.d[p * 4 + 3] > 128) covered++
    const coverage = covered / (alpha.W * alpha.H)

    arms[arm] = { paper, alpha, paperOpacity, coverage, renderer }
    notes.push(
      `${arm}: paper ${paper.W}x${paper.H} opacity ${(paperOpacity * 100).toFixed(2)}% · ` +
        `alpha ${alpha.W}x${alpha.H} coverage ${(coverage * 100).toFixed(2)}%`,
    )
    await context.close()
  }
  await browser.close()

  /* ---- THE ASSERTIONS THAT STOP THIS SHEET FROM LYING ------------------- */
  let ok = true
  const say = (good, msg) => { if (!good) ok = false; console.log(`${good ? "PASS" : "FAIL"}  ${msg}`) }
  for (const [arm, a] of Object.entries(arms)) {
    say(a.paperOpacity === 1, `${arm} paper crop is FULLY OPAQUE — ${(a.paperOpacity * 100).toFixed(2)}% of pixels at alpha 255`)
    say(
      a.coverage > 0.01 && a.coverage < 0.9,
      `${arm} transparent grab really is transparent AND really has a form in it — coverage ${(a.coverage * 100).toFixed(2)}% (needs 1..90%)`,
    )
  }

  /** One tile width for every tile, so the sheet compares colour and not size. */
  const TILE_W = 1200
  const tiles = []
  for (const arm of ["PRIOR", "SHIPPED"]) {
    const a = arms[arm]
    const onPaper = crop(a.paper, inkBox(a.paper, false), null, TILE_W)
    const onDark = crop(a.alpha, inkBox(a.alpha, true), DARK, TILE_W)
    tiles.push({ label: `${arm} · on paper #FDFCF9 · ${onPaper.__zoom.toFixed(1)}x`, c: onPaper })
    tiles.push({ label: `${arm} · on the register's darkest ink #121110 · ${onDark.__zoom.toFixed(1)}x`, c: onDark })
  }

  const tw = Math.max(...tiles.map((t) => t.c.width))
  const th = Math.max(...tiles.map((t) => t.c.height))
  const PAD = 28
  const CAP = 46
  const cols = 2
  const rows = Math.ceil(tiles.length / cols)
  const sheet = createCanvas(cols * (tw + PAD) + PAD, rows * (th + PAD + CAP) + PAD + CAP)
  const g = sheet.getContext("2d")
  g.fillStyle = PAPER
  g.fillRect(0, 0, sheet.width, sheet.height)
  g.fillStyle = "#121110"
  g.font = "600 26px sans-serif"
  g.fillText(
    `"too brown, should still feel black" -> DD register, the beat's own "solid" pose, nearest-neighbour · ${LABEL}`,
    PAD, PAD + 24,
  )
  tiles.forEach((t, i) => {
    const cx = PAD + (i % cols) * (tw + PAD)
    const cy = PAD + CAP + Math.floor(i / cols) * (th + PAD + CAP)
    g.drawImage(t.c, cx, cy)
    g.strokeStyle = "#E3DFD4"
    g.lineWidth = 1
    g.strokeRect(cx + 0.5, cy + 0.5, t.c.width - 1, t.c.height - 1)
    g.fillStyle = "#383632"
    g.font = "500 24px sans-serif"
    g.fillText(t.label, cx, cy + t.c.height + 30)
  })
  const file = join(OUT, "SHEET-brown.png")
  writeFileSync(file, sheet.toBuffer("image/png"))
  console.log("\n" + notes.join("\n"))
  console.log(`\nsheet -> ${file}`)
  console.log(ok ? "\nSHEET IS EVIDENCE" : "\nSHEET IS NOT EVIDENCE — see failures above")
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
