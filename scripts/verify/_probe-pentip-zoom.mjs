// _PROBE-PENTIP-ZOOM — LOOK AT THE MOVING END. §0.6, "ZOOM IN before you return".
//
// The mark is about thirteen pixels wide on a 1280 px stage. Every claim about
// the shape of its moving end is therefore a claim about a dozen pixels, and a
// full-word contact sheet cannot carry it — which is why the previous lane's
// finding lived in a 7x crop and not in the sheet.
//
// WHAT IT CROPS, AND WHY THE BOX IS NOT CHOSEN BY HAND. For each playhead the
// box is centred on the CENTROID OF THE PIXELS THAT DIFFER between the parked
// prior (`off`) and the built shape — i.e. on the place the change actually is,
// found rather than guessed. The SAME box is then cut from every mode and from
// the FINISHED frame, so the four shapes and the engine's own natural terminus
// are compared in one column instead of described.
//
// Usage: node scripts/verify/_probe-pentip-zoom.mjs [--zoom=7] [--crop=90]
//                                                   [--at=0.35,0.55,0.75]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "zoom")
const OUT = join(ROOT, "docs", "verification", "pentip", LABEL)
const ZOOM = parseInt(arg("zoom", "7"), 10)
const CROP = parseInt(arg("crop", "90"), 10)
const CROP_H = Math.round(CROP * 0.8)
const ATS = arg("at", "0.30,0.45,0.60,0.75").split(",").map(Number)
const ENGINE = arg("engine", "free-stroke")
const VIEW = { width: 1600, height: 1600 }
const MODES = ["off", "cut", "nib", "quill"]

function mask(img) {
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
  return m
}

/* ⚠ THE SHEET MUST BE OPAQUE, AND IT IS ASSERTED RATHER THAN ASSUMED.
 *
 * A sibling lane lost a day to exactly this: it built a contact sheet, LOOKED
 * at it, and the sheet was fine — because ffmpeg had written it as RGBA with
 * 95.8 % of its pixels at alpha 0, and the viewer composited a near-black film
 * onto white. The verification tool had the same bug as the thing it was
 * verifying. A crop of a tip that is not actually there is indistinguishable
 * from a crop of a tip that is, once something else supplies the background. */
function assertOpaque(canvas, path) {
  const ctx = canvas.getContext("2d")
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  let clear = 0
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) clear++
  const pct = (clear / (data.length / 4)) * 100
  console.log(
    `  ${clear === 0 ? "PASS" : "FAIL"}  the sheet is OPAQUE — ${clear} px below alpha 255 (${pct.toFixed(2)} %)`,
  )
  if (clear !== 0) {
    console.error(`the sheet at ${path} is not opaque; what it shows is composited, not measured`)
    process.exit(1)
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2000)
  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(400)
  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3000)
  const fam = await page.evaluate(() => document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family"))
  console.log(`engine: ${fam}`)

  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(150)
  }
  const shoot = async () => {
    const buf = await page.locator("[data-hero-stage]").screenshot()
    return await loadImage(buf)
  }

  /* The FINISHED frame — the engine's own natural terminus, which is what a
   * mid-draw tip has to look like. Taken once, in the parked prior mode, so it
   * cannot be a frame this change produced. */
  await page.evaluate(() => window.__captureHarness.setPenTip("off"))
  await seek(span.at + span.duration)
  const finished = await shoot()

  const rows = []
  const grid = []
  for (const u of ATS) {
    const t = span.at + span.duration * u
    const shots = {}
    for (const m of MODES) {
      await page.evaluate((mm) => window.__captureHarness.setPenTip(mm), m)
      await seek(t - 0.012)
      await seek(t)
      shots[m] = await shoot()
    }
    // WHERE THE CHANGE IS — the centroid of the pixels the built shape moves.
    const a = mask(shots.off)
    const b = mask(shots.quill)
    let sx = 0
    let sy = 0
    let n = 0
    for (let y = 0; y < shots.off.height; y++)
      for (let x = 0; x < shots.off.width; x++) {
        const p = y * shots.off.width + x
        if (a[p] !== b[p]) {
          sx += x
          sy += y
          n++
        }
      }
    if (n === 0) {
      console.log(`  u=${u}  NO DIFFERING PIXELS — nothing to look at`)
      rows.push({ u, t, differing: 0 })
      continue
    }
    const cx = Math.max(0, Math.min(shots.off.width - CROP, Math.round(sx / n - CROP / 2)))
    const cy = Math.max(0, Math.min(shots.off.height - CROP_H, Math.round(sy / n - CROP_H / 2)))
    console.log(`  u=${u}  differing ${n} px  box ${cx},${cy} ${CROP}x${CROP_H}`)
    rows.push({ u, t, differing: n, box: [cx, cy, CROP, CROP_H] })
    grid.push({ u, cx, cy, shots, finished })
  }

  /* THE SHEET: one column per playhead, one row per mode, plus the FINISHED
   * frame cut from the identical box at the bottom. */
  const LABELH = 24
  const cellW = CROP * ZOOM
  const cellH = CROP_H * ZOOM
  const rowsN = MODES.length + 1
  const sheet = createCanvas(cellW * grid.length, (cellH + LABELH) * rowsN)
  const sc = sheet.getContext("2d")
  sc.fillStyle = "#0e0e12"
  sc.fillRect(0, 0, sheet.width, sheet.height)
  sc.imageSmoothingEnabled = false
  const names = [...MODES, "FINISHED (same box)"]
  for (let ci = 0; ci < grid.length; ci++) {
    const g = grid[ci]
    for (let ri = 0; ri < rowsN; ri++) {
      const img = ri < MODES.length ? g.shots[MODES[ri]] : g.finished
      const y = ri * (cellH + LABELH)
      sc.drawImage(img, g.cx, g.cy, CROP, CROP_H, ci * cellW, y + LABELH, cellW, cellH)
      sc.strokeStyle = "#33333d"
      sc.lineWidth = 2
      sc.strokeRect(ci * cellW, y + LABELH, cellW, cellH)
      sc.fillStyle = ri === rowsN - 1 ? "#7fd1ff" : "#ffd479"
      sc.font = "15px monospace"
      sc.fillText(`${names[ri]}  ·  ${ENGINE} ·  draw ${(g.u * 100).toFixed(0)}%`, ci * cellW + 8, y + 17)
    }
  }
  assertOpaque(sheet, "sheet")
  writeFileSync(join(OUT, `pentip-${ZOOM}x.png`), sheet.toBuffer("image/png"))
  writeFileSync(join(OUT, "zoom.json"), JSON.stringify({ engine: ENGINE, span, zoom: ZOOM, crop: [CROP, CROP_H], rows }, null, 2))

  console.log(`\nsheet: ${join(OUT, `pentip-${ZOOM}x.png`)}  (${sheet.width}x${sheet.height})`)
  console.log(errors.length ? `page errors: ${errors.join(" | ")}` : "no page errors")
  await context.close()
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
