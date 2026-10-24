// THE AMPLITUDE SWEEP — Sebs's pick, rendered, with the constraint measured.
//
// `HeroMotionParams.carveAmount` says how far the flat mark's silhouette is
// carved back toward the shape the nib drew. 0 is the tube (what shipped, and
// what he called *"way too subtle"*); 1 is the pen's own outline. **The pick is
// his.** This probe renders the sheet he picks from and measures the two things
// that pull in opposite directions, so the choice is a trade with numbers on it
// rather than a slider with a shrug on it:
//
//   ↑ LEGIBILITY   how different the drawing and the object are, on the
//                  SILHOUETTE — earth-mover distance between the two medial
//                  half-width distributions, in % of a stroke radius. The gate
//                  `assert-flat-silhouette.mjs` needs >= 10 % and >= 3x the
//                  value-only noise floor.
//
//   ↓ ASSEMBLY     whether K7's returned drawing is still in one piece. This is
//                  the constraint nobody predicted and it is real: the joint
//                  break removes a transverse slab of the UNDER stroke at every
//                  crossing, and on the fat tube the mark stayed whole because
//                  the FUSIONS gave every fragment a second path. The carve
//                  removes those fusions — correctly, it is the whole point —
//                  so past some amplitude the break stops reading as an
//                  occlusion and starts reading as damage.
//                  `assert-hero-k7-intact.mjs` is the gate and its header
//                  records that the defect was found BY EYE first: *"a
//                  DECAPITATED `l` ... a severed `s`, and four white bars across
//                  the `sk` that read as shattered rather than as over/under."*
//
// ⚠ THE BREAK'S GAP IS NOT THE LEVER, and that was measured before this probe
// was written rather than assumed. Sweeping `ret.breakK` 0.35 -> 0.24 -> 0.16 ->
// 0.10 at full carve leaves the component count at 9 · 9 · 8 · 8 against K1's 6,
// while the ink removed falls through the news gate's own 200 px floor at 0.16.
// The cut is defined by DISTANCE TO THE OVER STROKE'S CENTRELINE, so it spans
// the under stroke's whole cross-section however narrow the band is — a thinner
// gap severs just as completely. Amplitude is the only lever that touches this.
//
// Usage: node scripts/verify/_run-clean.mjs scripts/verify/_probe-carve-amplitude.mjs
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { boundaryFromPng, compareBoundaries } from "./lib/medial-width.mjs"
import { flatInterior } from "./lib/flat-interior.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "pen-carve", "sweep")
const URL = HERO_URL
const AMOUNTS = [0, 0.25, 0.4, 0.55, 0.7, 0.85, 1]
const MIN_COMPONENT_PX = 40

/** 8-connected ink components, largest first — the same law as
 *  `assert-hero-k7-intact.mjs`, restated because that file does not export it
 *  and a probe that measures a DIFFERENT connectivity would not be a probe of
 *  the same claim. Sizes are printed so the two can be compared by eye. */
async function components(png) {
  const { createCanvas, loadImage } = await import("@napi-rs/canvas")
  const img = await loadImage(png)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const ink = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    ink[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] <= 150 ? 1 : 0
  }
  const seen = new Uint8Array(W * H)
  const sizes = []
  const stack = new Int32Array(W * H)
  for (let p0 = 0; p0 < W * H; p0++) {
    if (!ink[p0] || seen[p0]) continue
    let sp = 0
    stack[sp++] = p0
    seen[p0] = 1
    let n = 0
    while (sp > 0) {
      const p = stack[--sp]
      n++
      const x = p % W
      const y = (p - x) / W
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const q = ny * W + nx
          if (ink[q] && !seen[q]) {
            seen[q] = 1
            stack[sp++] = q
          }
        }
      }
    }
    sizes.push(n)
  }
  sizes.sort((a, b) => b - a)
  return sizes.filter((s) => s >= MIN_COMPONENT_PX)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const rows = []
  for (const amount of AMOUNTS) {
    const browser = await chromium.launch()
    const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
    const page = await context.newPage()
    // A fresh load per amplitude: the page latches the amount in a mount effect,
    // which is the same reason the projection arm reloads. Slower and honest.
    await page.addInitScript((v) => {
      window.__heroCarveAmount = v
    }, amount)
    await page.goto(URL, { waitUntil: "networkidle" })
    await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, {
      timeout: 90000,
    })
    await page.waitForTimeout(2500)

    const stage = page.locator("[data-hero-stage]")
    const box = await stage.boundingBox()
    const shot = async () => {
      await page.waitForTimeout(300)
      return page.screenshot({ clip: box })
    }
    const set = async (o) => {
      await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
      await page.waitForTimeout(280)
    }
    const endT = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, endT)
    await page.waitForTimeout(600)

    // ASSERT THE ARM TOOK — off the page's own readout, never off the flag.
    const live = await page.evaluate(() =>
      Number(document.querySelector("[data-hero-carve]")?.getAttribute("data-hero-carve")),
    )
    if (Math.abs(live - amount) > 0.005) {
      throw new Error(`carveAmount ${amount} did not take: the page publishes ${live}`)
    }

    const FLAT = { ink: 1, depth: 0.004, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1 }
    // K7 = the live beat, no flatten override at all: the break arrives through
    // page.tsx's own memo. K1 = the same frame with the break pinned shut.
    const k7Png = await shot()
    await set({ ...FLAT, jointBreak: 0 })
    const k1Png = await shot()
    await set({ ...FLAT, jointBreak: 0, penCarve: amount })
    const flatPng = await shot()
    await set({ ink: 0, depth: 1, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1, penCarve: 0, jointBreak: 0 })
    const solidPng = await shot()
    await set(null)
    await browser.close()

    const tag = String(Math.round(amount * 100)).padStart(3, "0")
    writeFileSync(join(OUT, `carve-${tag}-flat.png`), flatPng)
    writeFileSync(join(OUT, `carve-${tag}-k7.png`), k7Png)

    const flat = await boundaryFromPng(flatPng)
    const solid = await boundaryFromPng(solidPng)
    const cmp = compareBoundaries(flat, solid)
    const g1 = await flatInterior(flatPng)
    const k1c = await components(k1Png)
    const k7c = await components(k7Png)

    rows.push({
      amount,
      emdRel: cmp.emdRel,
      medianFlat: flat.median,
      medianSolid: solid.median,
      sectionGain: flat.median > 0 ? solid.median / flat.median - 1 : 0,
      inkFlat: flat.inkPx,
      inkSolid: solid.inkPx,
      inkDropRel: solid.inkPx ? (solid.inkPx - flat.inkPx) / solid.inkPx : 0,
      k1Components: k1c.length,
      k7Components: k7c.length,
      k7Sizes: k7c,
      gate1SdTrim: g1.sdTrim,
      gate1Residue: g1.residue,
      gate1SdRaw: g1.sd,
    })
    console.log(
      `carve ${amount.toFixed(2)}  silhouette ${(100 * cmp.emdRel).toFixed(2)}%  ` +
        `half-width ${flat.median.toFixed(2)}->${solid.median.toFixed(2)}px ` +
        `(+${(100 * rows[rows.length - 1].sectionGain).toFixed(1)}%)  ` +
        `ink -${(100 * rows[rows.length - 1].inkDropRel).toFixed(1)}%  ` +
        `K7 assembly ${k1c.length} -> ${k7c.length} parts  ` +
        `gate1 sdTrim ${g1.sdTrim.toFixed(3)} (raw ${g1.sd.toFixed(3)}), residue ${(100 * g1.residue).toFixed(3)}%`,
    )
  }

  writeFileSync(join(OUT, "sweep.json"), JSON.stringify({ rows }, null, 2))

  /* ---- THE SHEET SEBS PICKS FROM ----------------------------------------
   * The crop is measured off the carve-0 frame, so every cell is the same box
   * and the only thing changing across the sheet is the amplitude. Captioned
   * with BOTH numbers that matter, because the pick is a trade and a sheet that
   * only shows the upside is a sales deck. */
  const { createCanvas, loadImage } = await import("@napi-rs/canvas")
  const first = await loadImage(join(OUT, "carve-000-flat.png"))
  const c0 = createCanvas(first.width, first.height)
  const x0 = c0.getContext("2d")
  x0.drawImage(first, 0, 0)
  const { data } = x0.getImageData(0, 0, first.width, first.height)
  let minX = 1e9
  let maxX = -1
  let minY = 1e9
  let maxY = -1
  const HH = Math.floor(first.height * 0.75)
  for (let y = 0; y < HH; y++) {
    for (let x = 0; x < first.width; x++) {
      const i = (y * first.width + x) * 4
      if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] > 150) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const cw = Math.round((maxX - minX) / 2.2)
  const ch = maxY - minY + 20
  const S = 2
  const CAP = 30
  // The canvas is at least as wide as the widest caption. A sheet whose numbers
  // are clipped at the right edge is a sheet that answers half the question, and
  // the caption is the half that carries the trade.
  const sheet = createCanvas(Math.max(cw * S, 760), (ch * S + CAP) * rows.length)
  const sc = sheet.getContext("2d")
  sc.fillStyle = "#ffffff"
  sc.fillRect(0, 0, sheet.width, sheet.height)
  sc.imageSmoothingEnabled = false
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    const tag = String(Math.round(r.amount * 100)).padStart(3, "0")
    const img = await loadImage(join(OUT, `carve-${tag}-flat.png`))
    const y = i * (ch * S + CAP)
    sc.fillStyle = "#111111"
    sc.font = "17px sans-serif"
    // ASCII only in the caption: the fallback sans has no glyph for the warning
    // sign and a tofu box on the sheet Sebs picks from is worse than a word.
    // The sign is formatted rather than prefixed, because at carve 0 the flat
    // mark is FATTER than the solid and "ink --4.2%" is not a number anybody
    // should have to parse.
    const drop = -100 * r.inkDropRel
    sc.fillText(
      `carve ${r.amount.toFixed(2)}   silhouette ${(100 * r.emdRel).toFixed(1)}% of a radius   ` +
        `ink ${drop >= 0 ? "+" : ""}${drop.toFixed(1)}%   ` +
        `K7 assembly ${r.k1Components} -> ${r.k7Components} parts` +
        `${r.k7Components === r.k1Components ? "" : "   K7 SPLITS"}`,
      8,
      y + 20,
    )
    sc.drawImage(img, minX - 6, minY - 10, cw, ch, 0, y + CAP, cw * S, ch * S)
  }
  writeFileSync(join(OUT, "SHEET-amplitude.png"), sheet.toBuffer("image/png"))

  console.log(`\nframes + sweep.json + SHEET-amplitude.png -> ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
