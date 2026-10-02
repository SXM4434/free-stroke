// THE ARRIVAL'S DIALS, SWEPT ONE AT A TIME.
//
// `FlatState.lit` moves three things and a change that moves three things at
// once is a claim about an unknown number of changes. This sweeps each dial on
// its own against the parked prior, on the real page, and prints what each one
// buys — so the shipped `HERO_LIT` is a reading rather than a taste.
//
// WHAT IT MEASURES, at TWO playhead positions that are the whole question:
//   FLAT   — mid-`breath`, the mark as a drawing. Every arm MUST agree here to
//            the digit: `lit` is 0 while the mark is flat, so a dial that moves
//            this frame is a dial that is leaking into the drawing, and gate 1
//            (flat interior sd < 1) is the thing it would break.
//   SOLID  — the settled head-on solid, the frame the switch arrives at.
//
// The number that matters is the SEPARATION between the two: the drawing's one
// value against the object's interior. That is what a viewer is being asked to
// notice, and before this channel existed it was 3.0 luma of median.
//
// Usage:
//   node scripts/verify/_probe-lit-sweep.mjs [--out=sweep]
import { mkdirSync, writeFileSync } from "node:fs"
import { chromium } from "./lib/browser.mjs"
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
const OUTNAME = arg("out", "sweep")
const URL = HERO_URL
const OUT = join(ROOT, "docs", "verification", "switch-tone", OUTNAME)

const INK_MAX_LUMA = 150
const ERODE = 3

/* ONE ARM PER ROW. `null` is the parked prior — the beat as Sebs saw it.
 * Every other row changes EXACTLY ONE field of `HERO_LIT_PRIOR`, so the column
 * differences are attributable. The combined rows at the end are the only ones
 * that move more than one dial and they are labelled as such. */
const ARMS_JSON = arg("arms", null)
const ARMS = ARMS_JSON ? JSON.parse(ARMS_JSON) : [
  ["PRIOR (parked)", "prior"],
  ["rimPower 2.0", { rimPower: 2.0, rimGain: 1, envGain: 1 }],
  ["rimPower 1.6", { rimPower: 1.6, rimGain: 1, envGain: 1 }],
  ["rimPower 1.15", { rimPower: 1.15, rimGain: 1, envGain: 1 }],
  ["rimPower 0.85", { rimPower: 0.85, rimGain: 1, envGain: 1 }],
  ["rimGain 1.5", { rimPower: 2.6, rimGain: 1.5, envGain: 1 }],
  ["rimGain 2.2", { rimPower: 2.6, rimGain: 2.2, envGain: 1 }],
  ["envGain 1.8", { rimPower: 2.6, rimGain: 1, envGain: 1.8 }],
  ["envGain 2.6", { rimPower: 2.6, rimGain: 1, envGain: 2.6 }],
  ["envGain 3.6", { rimPower: 2.6, rimGain: 1, envGain: 3.6 }],
  ["envGain 5.0", { rimPower: 2.6, rimGain: 1, envGain: 5.0 }],
  ["COMBINED rimPower 1.15 + envGain 2.6", { rimPower: 1.15, rimGain: 1, envGain: 2.6 }],
  ["COMBINED rimPower 1.15 + envGain 3.6", { rimPower: 1.15, rimGain: 1, envGain: 3.6 }],
  ["COMBINED rimPower 1.4 + rimGain 1.4 + envGain 2.6", { rimPower: 1.4, rimGain: 1.4, envGain: 2.6 }],
]

function interiorOf(luma, W, H) {
  let cur = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) cur[p] = luma[p] <= INK_MAX_LUMA ? 1 : 0
  for (let pass = 0; pass < ERODE; pass++) {
    const next = new Uint8Array(W * H)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x
        if (!cur[p]) continue
        if (
          cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] &&
          cur[p - W - 1] && cur[p - W + 1] && cur[p + W - 1] && cur[p + W + 1]
        ) next[p] = 1
      }
    }
    cur = next
  }
  return cur
}

async function stats(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const luma = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }
  let ink = 0
  let minX = Infinity, maxX = -Infinity
  for (let y = 0; y < H; y++)
    for (let px = 0; px < W; px++) {
      if (luma[y * W + px] > INK_MAX_LUMA) continue
      ink++
      if (px < minX) minX = px
      if (px > maxX) maxX = px
    }
  const cur = interiorOf(luma, W, H)
  const vals = []
  for (let p = 0; p < W * H; p++) if (cur[p]) vals.push(luma[p])
  const sorted = vals.slice().sort((a, b) => a - b)
  const pc = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length)
  /* THE BRIGHT TAIL OUTSIDE THE ERODED INTERIOR, counted separately — a
   * fresnel rim lives on the boundary, so an interior-only reading is exactly
   * the statistic that cannot see it. This counts ink pixels the erosion drops
   * that are brighter than the interior's own 95th percentile: the rim's own
   * footprint, in pixels. */
  const p95 = pc(0.95)
  let rimPx = 0
  for (let p = 0; p < W * H; p++) {
    if (luma[p] > INK_MAX_LUMA || cur[p]) continue
    if (luma[p] > p95) rimPx++
  }
  return { ink, w: maxX - minX + 1, n: vals.length, mean, sd, p05: pc(0.05), med: pc(0.5), p95, rimPx }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const results = []
  for (const [name, law] of ARMS) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)))
    await page.addInitScript((v) => { window.__heroLitLaw = v }, law)
    await page.goto(URL, { waitUntil: "networkidle" })
    await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })
    await page.waitForTimeout(3500)
    const scrubber = page.locator("[data-hero-scrub]")
    const canvas = page.locator("[data-hero-stage]")
    const total = await scrubber.evaluate((el) => parseFloat(el.max))
    const setPlayhead = async (t) => {
      await scrubber.evaluate((el, value) => {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        setter.call(el, String(value))
        el.dispatchEvent(new Event("input", { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
      }, t)
    }
    /* THE TWO PLAYHEADS, DERIVED FROM THE PAGE'S OWN PHASES rather than from a
     * hardcoded second — every hardcoded time in this beat's tooling has been
     * wrong at least once. Walk coarsely, take the middle of `breath` and the
     * middle of `solid`. */
    const marks = []
    for (let i = 0; i < 160; i++) {
      const t = (i / 159) * total
      await setPlayhead(t)
      await page.waitForTimeout(14)
      const ph = await page.evaluate(() => document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-phase") ?? null)
      marks.push({ t, ph })
    }
    const midOf = (phase) => {
      const hit = marks.filter((m) => m.ph === phase)
      if (!hit.length) throw new Error(`no ${phase} phase found`)
      return hit[Math.floor(hit.length / 2)].t
    }
    const tFlat = midOf("breath")
    const tSolid = midOf("solid")

    await setPlayhead(tFlat)
    await page.waitForTimeout(500)
    const flatBuf = await canvas.screenshot()
    await setPlayhead(tSolid)
    await page.waitForTimeout(500)
    const solidBuf = await canvas.screenshot()
    writeFileSync(join(OUT, `${name.replace(/[^a-z0-9]+/gi, "-")}-solid.png`), solidBuf)
    if (name.startsWith("PRIOR")) writeFileSync(join(OUT, "PRIOR-flat.png"), flatBuf)

    const F = await stats(flatBuf)
    const S = await stats(solidBuf)
    results.push({ name, law, tFlat, tSolid, flat: F, solid: S, errors })
    await context.close()
  }
  await browser.close()

  writeFileSync(join(OUT, "sweep.json"), JSON.stringify(results, null, 2))

  const base = results[0]
  console.log("\nFLAT frame — every arm must agree with PRIOR to the digit (lit is 0 while flat).")
  console.log("arm".padEnd(40) + "  med    sd    ink")
  for (const r of results) {
    const bad = Math.abs(r.flat.med - base.flat.med) > 0.2 || Math.abs(r.flat.sd - base.flat.sd) > 0.2
    console.log(
      r.name.padEnd(40) +
        r.flat.med.toFixed(1).padStart(6) +
        r.flat.sd.toFixed(2).padStart(6) +
        String(r.flat.ink).padStart(8) +
        (bad ? "   <-- LEAKING INTO THE DRAWING" : ""),
    )
  }
  console.log("\nSOLID frame — the object the switch arrives at.")
  console.log("arm".padEnd(40) + "  mean   sd    p05   med   p95  rimPx |  SEPARATION from the drawing")
  console.log("".padEnd(40) + "                                        |  Δmed   Δp95   Δmean  sd x")
  for (const r of results) {
    const dmed = r.solid.med - r.flat.med
    const dp95 = r.solid.p95 - r.flat.p95
    const dmean = r.solid.mean - r.flat.mean
    console.log(
      r.name.padEnd(40) +
        r.solid.mean.toFixed(1).padStart(6) +
        r.solid.sd.toFixed(2).padStart(6) +
        r.solid.p05.toFixed(1).padStart(6) +
        r.solid.med.toFixed(1).padStart(6) +
        r.solid.p95.toFixed(1).padStart(6) +
        String(r.solid.rimPx).padStart(7) +
        " | " +
        dmed.toFixed(1).padStart(6) +
        dp95.toFixed(1).padStart(7) +
        dmean.toFixed(1).padStart(7) +
        (r.solid.sd / Math.max(0.01, r.flat.sd)).toFixed(1).padStart(7),
    )
  }
  const errs = results.filter((r) => r.errors.length)
  if (errs.length) console.log("\nPAGE ERRORS:", errs.map((e) => `${e.name}: ${e.errors[0]}`))
  console.log(`\nframes -> ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
