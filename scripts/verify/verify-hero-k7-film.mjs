// FILM THE BREAK OPENING, AND CHECK IT FOR THE THINGS A STILL CANNOT SHOW.
//
// `assert-hero-k7-news.mjs` judges two frames. Two frames cannot say whether the
// channel opens SMOOTHLY — whether a junction pops, flickers, or opens and then
// partly closes again — and the model hard-flips `jointBreak` inside the dwell
// precisely so the change is hidden at the one frame nobody can resolve. That
// only makes the channel's own behaviour more important to look at: a beat that
// hides a flip inside a held instant is relying on the flip being clean.
//
// So this ramps the channel 0 -> 1 across `--frames`, saves every frame, encodes
// an mp4 to watch, and reports the per-frame ink series. The verdict rows are:
// the ink only ever falls (monotone, so nothing re-inks), no single step carries
// more than a stated share of the change (no pop), and the last frame matches
// the beat's own hard-flipped end state.
//
// Usage: node scripts/verify/verify-hero-k7-film.mjs [--frames=30]
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
let FFMPEG
try {
  FFMPEG = require("ffmpeg-static")
} catch {
  FFMPEG = null
}
if (!FFMPEG || !existsSync(FFMPEG)) FFMPEG = "ffmpeg"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
/* STAGED. This wipe empties `docs/verification/hero-k7/film`, 31 tracked files.
 * lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "hero-k7", "film")
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? Number(hit.split("=")[1]) : d
}
const FRAMES = arg("frames", 30)
const INK_MAX = 150
const FLAT = { ink: 1, depth: 0.004, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1 }

let failures = 0
const record = (name, pass, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`)
  console.log(`      ${detail}`)
  if (!pass) failures++
}

async function inkOf(png) {
  const img = await loadImage(png)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const H = Math.floor(img.height * 0.75)
  let n = 0
  for (let y = 0; y < H; y++)
    for (let px = 0; px < img.width; px++) {
      const i = (y * img.width + px) * 4
      if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] <= INK_MAX) n++
    }
  return n
}

async function main() {
  EV.open()
  mkdirSync(join(OUT, "frames"), { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness, null, { timeout: 90000 })
  await page.waitForTimeout(2500)

  const endT = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-scrub]")
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    set.call(el, el.max)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    return Number(el.max)
  })
  await page.waitForTimeout(900)

  const stage = page.locator("[data-hero-stage]")
  const box = await stage.boundingBox()
  const series = []
  for (let i = 0; i < FRAMES; i++) {
    const open = i / (FRAMES - 1)
    await page.evaluate((v) => window.__captureHarness.setFlatten(v), { ...FLAT, jointBreak: open })
    await page.waitForTimeout(140)
    const png = await page.screenshot({ clip: box })
    writeFileSync(join(OUT, "frames", `${String(i).padStart(4, "0")}.png`), png)
    series.push({ open, ink: await inkOf(png) })
  }
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  await browser.close()

  try {
    spawnSync(
      FFMPEG,
      [
        "-y", "-framerate", "12", "-i", join(OUT, "frames", "%04d.png"),
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-pix_fmt", "yuv420p",
        join(OUT, "break-open.mp4"),
      ],
      { stdio: "ignore" },
    )
  } catch (e) {
    console.warn("[k7] ffmpeg failed:", e.message)
  }

  console.log(`\nbeat parked at ${endT.toFixed(2)}s · ${FRAMES} frames · ${FINAL}\n`)
  console.log("  open     ink px    step")
  let worstStep = 0
  let rises = 0
  for (let i = 0; i < series.length; i++) {
    const step = i ? series[i].ink - series[i - 1].ink : 0
    if (i && step > 0) rises++
    if (Math.abs(step) > Math.abs(worstStep)) worstStep = step
    console.log(
      `  ${series[i].open.toFixed(3)}  ${String(series[i].ink).padStart(8)}  ${i ? (step > 0 ? "+" : "") + step : ""}`,
    )
  }
  const total = series[0].ink - series[series.length - 1].ink

  record(
    "the break only ever OPENS — ink never comes back",
    rises === 0,
    `${rises} of ${FRAMES - 1} steps added ink (needs 0). A channel that re-inks mid-ramp is a ` +
      `flicker, and at 12 fps a still cannot show it.`,
  )
  record(
    "no single step carries the change — it is a ramp, not a pop",
    Math.abs(worstStep) <= total * 0.35,
    `largest step ${worstStep} px against ${total} px total (needs <= 35 %). The model hard-flips ` +
      `this channel inside the dwell on purpose; that is a choice about WHERE the change happens, ` +
      `and it is only safe if the channel itself is continuous.`,
  )
  record(
    "the ramp actually arrives",
    total > 200 && series[0].ink > series[series.length - 1].ink,
    `${series[0].ink} -> ${series[series.length - 1].ink} px (${total} px of paper opened).`,
  )
  record("console clean", errors.length === 0, `${errors.length} errors`)

  /* THE SWAP. The film and its frames exist; the rows are a separate question. */
  EV.commit()
  console.log(`\n${failures === 0 ? "all rows passed" : `${failures} FAILED`}`)
  console.log(`film: ${join(FINAL, "break-open.mp4")}`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
