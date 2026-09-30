// _PROBE-CARVE-ENVELOPE-RECAL — re-derive the carve envelope on a field that
// REGISTERS.
//
// WHY THIS HAS TO BE REDONE. `PEN_CARVE_ENVELOPE_R = 2.6` was calibrated
// against a measurement taken while the GL storage was allocated at 1192x324
// and the field in it was 1152x294 (see `setFieldRealloc` in
// components/viewport-3d.tsx). Under that mismatch the lookup scanned the wrong
// rectangle, so `mix(envelope, pen, 0.001)` removed 38 % of the ink and the
// answer looked like "the envelope is too tight". It was not. Widening the
// envelope to 2.6 R masked the misregistration — and a needlessly wide envelope
// is not free: at carve 0.700 it leaves the silhouette almost where it was,
// which is the exact channel Sebs says does not read
// (*"the 2D and 3D transformation is way too subtle"*).
//
// So this sweeps ENVELOPE x CARVE in one session, on the fixed field, and asks
// the two questions that decide the number:
//   1. at carve 0.001 the carve must remove NOTHING (the tube channel alone)
//   2. at carve 0.700 how much silhouette does each envelope actually buy
//
// The envelope is a UNIFORM, not a bake, so the whole grid is one page load and
// one field — no arm differs from another by anything but the number under test.
//
// Usage: node scripts/verify/_probe-carve-envelope-recal.mjs [--label=x]
//        [--engine=free-stroke] [--realloc=on|off]
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
const LABEL = arg("label", "env-recal")
const ENGINE = arg("engine", "free-stroke")
const REALLOC = arg("realloc", "on")
/** `off` leaves the page on its own default wobble/endpoint. */
const DIALS = arg("dials", "on")
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
const ENVS = [1.45, 1.55, 1.6, 1.65, 1.75, 1.9]
const AMPS = [0, 0.001, 0.3, 0.5, 0.7, 0.85, 1.0]

/* MEASURE — copied verbatim from `_probe-carve-sweep-live.mjs` rather than
 * rewritten, so the two probes cannot disagree about what "ink" is. */
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
  const W = img.width, H = img.height
  const seen = new Uint8Array(m.length)
  const stack = new Int32Array(m.length)
  let comps = 0, specks = 0
  for (let p = 0; p < m.length; p++) {
    if (!m[p] || seen[p]) continue
    let sp = 0
    stack[sp++] = p
    seen[p] = 1
    let n = 0
    while (sp > 0) {
      const q = stack[--sp]
      const qx = q % W, qy = (q / W) | 0
      n++
      for (let dy = -1; dy <= 1; dy++) {
        const ny = qy + dy
        if (ny < 0 || ny >= H) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx
          if (nx < 0 || nx >= W) continue
          const r = ny * W + nx
          if (m[r] && !seen[r]) { seen[r] = 1; stack[sp++] = r }
        }
      }
    }
    if (n >= 6) { comps++; if (n < 200) specks++ }
  }
  // Horizontal run lengths — "got thinner" vs "came apart", the same reading
  // `_probe-carve-sweep-live.mjs` prints.
  const runs = []
  for (let y = 0; y < H; y++) {
    let r = 0
    for (let x2 = 0; x2 <= W; x2++) {
      const on = x2 < W && m[y * W + x2]
      if (on) r++
      else { if (r > 1) runs.push(r); r = 0 }
    }
  }
  runs.sort((a, b) => a - b)
  return { ink, comps, specks, medRun: runs.length ? runs[runs.length >> 1] : 0, mask: m, W, H }
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
  await page.waitForFunction(() => window.__captureHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  await page.evaluate((v) => window.__captureHarness.setFieldRealloc(v), REALLOC !== "off")
  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3500)
  await page.waitForFunction(() => !!window.__captureHarness, null, { timeout: 60000 })
  // HIS STATE: wobble 0, endpoint CLEAN. `--dials=off` leaves the page on its
  // own defaults instead — the state the whole gate battery renders, and the
  // one an envelope has to be safe at as well as at his.
  if (DIALS !== "off") await page.evaluate(() => {
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
  await page.waitForTimeout(2000)
  if (DIALS !== "off") await page.evaluate(() => {
    for (const b of document.querySelectorAll("button"))
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
  })
  await page.waitForTimeout(2500)

  // The FINISHED word, so the reveal boundary is not a second variable.
  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  await page.evaluate((tt) => {
    const el = document.querySelector("[data-hero-scrub]")
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    s.call(el, String(tt))
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  }, span.at + span.duration)
  await page.evaluate(() => window.__captureHarness.setFlatten({ penCarve: 0.5 }))
  await page.waitForTimeout(900)

  const g = await page.evaluate(() => window.__heroPenField)
  console.log(`field ${g.width}x${g.height}   GL storage ${g.texW}x${g.texH}   realloc=${g.fieldRealloc}   R ${g.radius.toFixed(3)}`)
  if (REALLOC !== "off" && (g.texW !== g.width || g.texH !== g.height)) {
    console.error("the fix did not take — the allocation still disagrees with the field")
    process.exit(1)
  }

  const grid = []
  let base = null
  /* THE HARNESS IS RE-CREATED ON A REMOUNT — an engine switch tears the
   * viewport down and `__captureHarness` with it, and a sweep that assumed it
   * was still there died mid-grid. Wait for it rather than hope. */
  const ready = () => page.waitForFunction(() => !!window.__captureHarness, null, { timeout: 60000 })
  for (const e of ENVS) {
    await ready()
    const ok = await page.evaluate((ee) => window.__captureHarness.setCarveEnvelope(ee), e)
    if (!ok) { console.error(`setCarveEnvelope(${e}) refused`); process.exit(1) }
    const live = await page.evaluate(() => window.__captureHarness.carveEnvelope())
    if (Math.abs(live - e) > 1e-9) { console.error(`envelope ${e} did not take (${live})`); process.exit(1) }
    for (const a of AMPS) {
      await ready()
      await page.evaluate((aa) => window.__captureHarness.setFlatten({ penCarve: aa }), a)
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
      await page.waitForTimeout(240)
      const p = join(OUT, `env${e.toFixed(2)}-carve-${String(a).replace(".", "p")}.png`)
      writeFileSync(p, await page.locator("[data-hero-stage]").screenshot())
      const m = measure(await loadImage(p))
      // carve 0 is the SAME picture for every envelope (the block is behind
      // `fsPenAmt > 0.0`), so the first one is the reference for all of them.
      if (!base) base = m
      grid.push({ env: e, carve: a, ink: m.ink, comps: m.comps, specks: m.specks, medRun: m.medRun, file: p })
    }
  }
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  // Back to whatever the build ships, read off the page rather than retyped —
  // a probe that restores a hardcoded constant is a second source of truth for
  // it, which is the drift this whole lane was about.
  await page.evaluate(() => window.__captureHarness.setCarveEnvelope(window.__heroPenField.envelopeShipR))

  console.log(`\nreference (carve 0): ink ${base.ink}  components ${base.comps}  median run ${base.medRun}\n`)
  console.log("env     carve    ink px   kept %   comps  specks  medRun")
  for (const r of grid) {
    const flag = r.carve === 0.001 && (r.ink / base.ink < 0.995 || r.specks > 0) ? "  <-- REMOVES INK AT 0.001" : ""
    console.log(
      `${r.env.toFixed(2)}   ${r.carve.toFixed(3).padStart(5)}  ${String(r.ink).padStart(8)}  ${((r.ink / base.ink) * 100).toFixed(1).padStart(6)}  ${String(r.comps).padStart(6)}  ${String(r.specks).padStart(6)}  ${String(r.medRun).padStart(6)}${flag}`,
    )
  }
  console.log(`\nTHE TWO QUESTIONS`)
  console.log(`  envelope   kept% @0.001 (must be ~100, 0 specks)   kept% @0.700 (the silhouette event)   comps@0.700`)
  for (const e of ENVS) {
    const a = grid.find((r) => r.env === e && r.carve === 0.001)
    const b = grid.find((r) => r.env === e && r.carve === 0.7)
    console.log(
      `    ${e.toFixed(2)}          ${((a.ink / base.ink) * 100).toFixed(2).padStart(7)}  (${a.specks} specks)              ${((b.ink / base.ink) * 100).toFixed(2).padStart(7)}                       ${b.comps}`,
    )
  }
  console.log(errors.length ? `\npage errors: ${errors.join(" | ")}` : "\nno page errors")
  writeFileSync(join(OUT, "grid.json"), JSON.stringify({ engine: ENGINE, realloc: REALLOC, field: g, base: { ink: base.ink, comps: base.comps, medRun: base.medRun }, grid: grid.map(({ ...r }) => r) }, null, 2))
  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\nframes: ${FINAL}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
