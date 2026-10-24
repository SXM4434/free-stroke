// _PROBE-CARVE-SWEEP-LIVE — the carve amplitude, measured on the REAL page.
//
// WHY THIS EXISTS. `_probe-carve-law.mjs` walks the real bake and finds the
// carved half-width never below 7.75 stroke units (median 12.50) — a THINNING.
// The rendered page at the same amplitude loses 42-53 % of its ink and comes
// apart into 13 components. Both cannot be true, so this asks the amplitude
// itself, at 0.001 as well as at the shipped 0.70.
//
// 0.001 IS THE LOAD-BEARING ARM. `mix(tube, pen, 0.001)` is the TUBE channel
// alone. The carve's whole premise is that the tube channel is a generous
// envelope of the mesh (`PEN_FIELD_TUBE_SLACK = 1.35`), so at 0.001 it must
// remove essentially NOTHING. If it removes ink, the premise is false in the
// rendered scene and the pen outline was never the thing doing the damage.
//
// Usage: node scripts/verify/_probe-carve-sweep-live.mjs [--label=sweep] [--engine=free-stroke]
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
import { stageEvidence } from "./lib/evidence-swap.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "sweep")
const ENGINE = arg("engine", "free-stroke")
/* THE ANY-TEXT ARM. Sebs: *"the 3d text is fully distorted worse when u type ur
 * own text like someone ran a eraser all over it."* `buildFontStrokes` scales
 * the laid-out word to a FIXED target width (`k = FONT_TARGET_W / laid.width`),
 * so longer text shrinks every glyph in stroke units while the nib stays at
 * `HERO_INK_WIDTH_PX` — strokes fuse harder, and whatever the fusion adds
 * beyond the pen's outline is what the carve throws away. */
const TEXT = arg("text", "")
/* THE ENVELOPE ARM, in nib radii. Empty = whatever ships. `--envelope=1.35` is
 * the PARKED PRIOR and is this fix's negative control: it must reproduce the
 * eraser. See `PEN_CARVE_ENVELOPE_R` in components/viewport-3d.tsx. */
const ENVELOPE = arg("envelope", "")
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/drawin-holes/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 618 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "drawin-holes", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const VIEW = { width: 1600, height: 1600 }
const AMPS = [0, 0.001, 0.05, 0.1, 0.2, 0.3, 0.5, 0.7, 0.85, 1.0]

function measure(img) {
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
  let ink = 0
  for (let p = 0; p < luma.length; p++) { m[p] = luma[p] < cut ? 1 : 0; ink += m[p] }
  // Connected components, 8-connected — "came apart" vs "got thinner".
  const seen = new Uint8Array(m.length)
  const stack = new Int32Array(m.length)
  let comps = 0
  let specks = 0
  for (let p = 0; p < m.length; p++) {
    if (!m[p] || seen[p]) continue
    let sp = 0
    stack[sp++] = p
    seen[p] = 1
    let n = 0
    while (sp > 0) {
      const q = stack[--sp]
      const qx = q % img.width
      const qy = (q / img.width) | 0
      n++
      for (let dy = -1; dy <= 1; dy++) {
        const ny = qy + dy
        if (ny < 0 || ny >= img.height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx
          if (nx < 0 || nx >= img.width) continue
          const r = ny * img.width + nx
          if (m[r] && !seen[r]) { seen[r] = 1; stack[sp++] = r }
        }
      }
    }
    if (n >= 6) { comps++; if (n < 200) specks++ }
  }
  /* MEDIAN RUN LENGTH ACROSS THE MARK — the pen-weight number the handoff
   * quotes (18 -> 11 px at carve 1.00). Horizontal runs of ink, which on a word
   * of mostly-vertical stems is the stem WIDTH. */
  const runs = []
  for (let y = 0; y < img.height; y++) {
    let run = 0
    for (let x = 0; x < img.width; x++) {
      const v = m[y * img.width + x]
      if (v) run++
      else { if (run > 0) runs.push(run); run = 0 }
    }
    if (run > 0) runs.push(run)
  }
  runs.sort((a, b) => a - b)
  return { ink, comps, specks, medRun: runs.length ? runs[runs.length >> 1] : 0, runs: runs.length }
}

async function main() {
  EV.open()
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)
  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3500)
  await page.evaluate(() => {
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        s.call(inp, "0")
        inp.dispatchEvent(new Event("input", { bubbles: true }))
        inp.dispatchEvent(new Event("change", { bubbles: true }))
        break
      }
    }
  })
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
    }
  })
  await page.waitForTimeout(2500)

  if (TEXT) {
    // "Any text" source, then the string. Both through the real controls.
    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button")) {
        if ((b.textContent ?? "").trim().toLowerCase() === "any text") { b.click(); break }
      }
    })
    await page.waitForTimeout(2000)
    await page.evaluate((t) => {
      const el = [...document.querySelectorAll("input")].find(
        (i) => i.getAttribute("placeholder") === "Type anything",
      )
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, t)
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, TEXT)
    await page.waitForTimeout(4000)
    const live = await page.evaluate(
      () =>
        [...document.querySelectorAll("input")].find(
          (i) => i.getAttribute("placeholder") === "Type anything",
        )?.value ?? null,
    )
    console.log(`text arm: "${live}"`)
    if (live !== TEXT) { console.error(`the text did not take: got "${live}"`); process.exit(1) }
  }

  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  // The FINISHED word, so every arm measures the same subject and the reveal
  // boundary is not a second variable.
  await page.evaluate((tt) => {
    const el = document.querySelector("[data-hero-scrub]")
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    s.call(el, String(tt))
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }, span.at + span.duration)
  await page.waitForTimeout(500)

  if (ENVELOPE) {
    const ok = await page.evaluate((e) => window.__captureHarness.setCarveEnvelope(e), parseFloat(ENVELOPE))
    if (!ok) { console.error(`setCarveEnvelope(${ENVELOPE}) refused`); process.exit(1) }
  }
  // WHAT THE PAGE SAYS IT IS RUNNING, not what was asked for — the same rule
  // `projection()` follows. A control that reports the request cannot catch a
  // request that did not take.
  await page.evaluate(() => window.__captureHarness.setFlatten({ penCarve: 0.5 }))
  await page.waitForTimeout(900)
  const env = await page.evaluate(() => ({
    live: window.__captureHarness.carveEnvelope(),
    field: window.__heroPenField
      ? {
          bakedSlackR: window.__heroPenField.bakedSlackR,
          envelopeR: window.__heroPenField.envelopeR,
          slackUnits: window.__heroPenField.envelopeSlackStrokeUnits,
          radius: window.__heroPenField.radius,
        }
      : null,
  }))
  console.log(`envelope: ${JSON.stringify(env)}`)

  const rows = []
  for (const a of AMPS) {
    await page.evaluate((aa) => window.__captureHarness.setFlatten({ penCarve: aa }), a)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(280)
    const p = join(OUT, `carve-${String(a).replace(".", "p")}.png`)
    writeFileSync(p, await page.locator("[data-hero-stage]").screenshot())
    const m = measure(await loadImage(p))
    rows.push({ carve: a, ...m })
  }
  await page.evaluate(() => window.__captureHarness.setFlatten(null))

  const base = rows[0]
  console.log(`\nengine ${ENGINE}, FINISHED word, ${VIEW.width}x${VIEW.height}\n`)
  console.log("carve    ink px    kept %   components   specks   median run px")
  for (const r of rows) {
    console.log(
      `${r.carve.toFixed(3).padStart(5)}  ${String(r.ink).padStart(8)}  ${((r.ink / base.ink) * 100).toFixed(1).padStart(7)}  ${String(r.comps).padStart(10)}  ${String(r.specks).padStart(7)}  ${String(r.medRun).padStart(13)}`,
    )
  }
  console.log(errors.length ? `\npage errors: ${errors.join(" | ")}` : "\nno page errors")
  writeFileSync(join(OUT, "sweep.json"), JSON.stringify({ engine: ENGINE, rows }, null, 2))
  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\nframes: ${FINAL}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
