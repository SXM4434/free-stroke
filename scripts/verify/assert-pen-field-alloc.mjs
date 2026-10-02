// THE FIELD'S GL STORAGE MUST BE THE SIZE OF THE FIELD IN IT.
//
// ── THE DEFECT THIS EXISTS FOR ────────────────────────────────────────────
// Sebs, for days: *"random white blank spots… like someone ran a eraser all
// over it."* The finished, static flat mark rendered with chunks missing, on
// both engines, at BREATH, after the draw was complete.
//
// The mechanism is `setFieldRealloc` in components/viewport-3d.tsx. three r175
// uploads a `DataTexture` with `texStorage2D` — IMMUTABLE storage, sized at the
// FIRST upload — and every later upload is a bare `texSubImage2D`. Re-bake the
// pen field at any other size and the new outline is written into a corner of
// the old rectangle while `fsPuv` keeps scanning the whole of it. The mark is
// then carved by a stretched, offset copy of its own outline: interior chunks
// removed, exterior ones kept.
//
// ── WHY NO EXISTING GATE COULD SEE IT ────────────────────────────────────
// Measured, `_probe-field-alloc.mjs`: a plain load and a full play of the beat
// leave the storage at 1192x324 with a 1192x324 field in it — NO mismatch. The
// whole gate battery loads the page and scrubs. It never touches a dial. Move
// the wobble slider and the field becomes 1185x324; set endpoint CLEAN and it
// becomes 1152x294; the allocation never moves. Sebs's reported state is wobble
// 0 + endpoint CLEAN, i.e. both dials off their defaults — which is why he saw
// it every day and every green row did not.
//
// So this gate is DIAL-DRIVEN on purpose. It reproduces the gesture, not the
// screenshot.
//
// ── THE CONTROL, AND IT RUNS ON THE BARE INVOCATION (2026-08-07) ──────────
//   `setFieldRealloc(false)` restores the pre-fix behaviour — the eraser itself.
//   Rows 2 and 3 MUST go red. A gate for an invariant that was true by luck is
//   the class this repo has now caught thirteen times.
//
//   It used to be `--mutate=prior` and nothing passed it. See `runArm` for the
//   two reasons that mattered: the rule it broke, and the fact that its verdict
//   was printed in a form no scoreboard could read.
//
// Usage: node scripts/verify/assert-pen-field-alloc.mjs
import { chromium } from "./lib/browser.mjs"
import { createRequire } from "node:module"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { HERO_URL } from "./lib/dev-server.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const ENGINES = ["free-stroke", "desk-doodles"]

const results = []
const record = (name, pass, detail) => {
  results.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`)
  console.log(`      ${detail}`)
}

/** Ink mask + 8-connected component count, the same reading the carve probes use. */
async function readMark(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width, H = img.height
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(W * H)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  const m = new Uint8Array(W * H)
  let ink = 0
  for (let p = 0; p < m.length; p++) { m[p] = luma[p] < cut ? 1 : 0; ink += m[p] }
  const seen = new Uint8Array(m.length)
  const st = new Int32Array(m.length)
  let comps = 0, specks = 0
  for (let p = 0; p < m.length; p++) {
    if (!m[p] || seen[p]) continue
    let sp = 0
    st[sp++] = p
    seen[p] = 1
    let n = 0
    while (sp > 0) {
      const q = st[--sp]
      const qx = q % W, qy = (q / W) | 0
      n++
      for (let dy = -1; dy <= 1; dy++) {
        const ny = qy + dy
        if (ny < 0 || ny >= H) continue
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx
          if (nx < 0 || nx >= W) continue
          const r = ny * W + nx
          if (m[r] && !seen[r]) { seen[r] = 1; st[sp++] = r }
        }
      }
    }
    if (n >= 6) { comps++; if (n < 200) specks++ }
  }
  return { ink, comps, specks }
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
  const errors = []

  /**
   * ⚠ EACH ARM GETS ITS OWN FRESH PAGE, AND THAT IS NOT TIDINESS — it is the
   * mechanism. `texStorage2D` sizes the storage at the FIRST upload, so an arm
   * run second in a warm page inherits an allocation that already matches what
   * its own re-bakes produce. MEASURED, first attempt, 2026-08-07: with both
   * arms sharing one page the control read `field 1152x294 / GL 1152x294` on
   * both engines and STAYED GREEN — a control that failed to bite for a reason
   * that is the defect's own definition. A fresh load per arm is the only way
   * the known-bad can express itself.
   */
  async function freshPage() {
    const page = await context.newPage()
    page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))
    await page.goto(HERO_URL, { waitUntil: "networkidle" })
    await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
    await page.waitForFunction(() => !!window.__captureHarness, null, { timeout: 120000 })
    await page.waitForTimeout(2500)
    return page
  }

  const seekOn = (page) => async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(280)
  }

  /**
   * ONE ARM — the whole gesture, on `want === true` (the shipped realloc) or
   * `want === false` (the parked pre-fix behaviour, which is the known-bad).
   *
   * ⚠ THE KNOWN-BAD USED TO BE `--mutate=prior` AND NO SWEEP PASSED IT, so the
   * only thing that could show these two rows able to go red was the invocation
   * nothing typed (`docs/explainers/21-losing-your-work.md` §7; explainer 31
   * counted nineteen, this among them). The flag is DELETED and both arms run on
   * the bare invocation, in ONE page — `setFieldRealloc` is a runtime toggle, so
   * the second arm costs a second gesture and no second Chrome launch.
   *
   * ⚠ AND ITS VERDICT WAS INVISIBLE TO THE SCOREBOARD. It printed "MUTATION
   * CONTROL --mutate=prior: both subject rows went RED" and "…FAILED TO BITE",
   * and `\bFAIL\b` does not match `FAILED` — explainer 31 §2 names this exact
   * file as the one channel J could not see for that reason. The verdict is a
   * `PASS`/`FAIL` row at line start now.
   *
   * COST, MEASURED: 23.9 s per arm, 47.8 s for the pair. A browser gate here
   * runs to 304 s, so there is nothing to schedule and no skip to name.
   */
  async function runArm(want) {
  const page = await freshPage()
  const seek = seekOn(page)
  const dur = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
  await page.evaluate((v) => window.__captureHarness.setFieldRealloc(v), want)
  const live = await page.evaluate(() => window.__captureHarness.fieldRealloc())

  /* THE GESTURE, not the screenshot: engine, then wobble, then endpoint — each
   * one re-bakes the field, and the second and third change its SIZE. */
  const checks = []
  const marks = []
  for (const eng of ENGINES) {
    await page.click(`[data-engine-option="${eng}"]`)
    await page.waitForTimeout(3200)
    await page.waitForFunction(() => !!window.__captureHarness, null, { timeout: 60000 })
    await page.evaluate((v) => window.__captureHarness.setFieldRealloc(v), want)
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
    await page.waitForTimeout(2200)
    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button"))
        if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
    })
    await page.waitForTimeout(2400)

    /* A CARVED FRAME WITH A WHOLE MARK ON IT, found by asking the model rather
     * than by a hardcoded second — the beat has moved its phase edges twice.
     *
     * ⚠ AND THE INK TEST IS LOAD-BEARING. The first pass of this gate took the
     * FIRST frame the model published carve >= 0.5 on, which is t = 0: the flat
     * state is fully flat there, so the carve is at its peak — and the pen has
     * put nothing on the page yet. It measured 1 ink pixel and 0 components on
     * both arms and could not have failed, which is the exact defect this file
     * exists to catch, committed inside the file that catches it. The subject
     * has to be a mark, so the search requires one. */
    const drawSpan = await page.evaluate(() =>
      JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")))
    let carved = null
    let carvedInk = 0
    for (let k = 0; k <= 48 && carved === null; k++) {
      // Walk BACKWARDS from the end of the draw: the mark is complete there and
      // stays complete through the hold, so the first carried frame is found in
      // a handful of steps rather than by scanning the whole beat.
      const t = Math.min(dur, drawSpan.at + drawSpan.duration + (dur * k) / 48)
      await seek(t)
      const c = await page.evaluate(() =>
        Number(document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-carve")))
      if (c < 0.5) continue
      const probe = await readMark(await page.locator("[data-hero-stage]").screenshot())
      if (probe.ink > 5000) { carved = t; carvedInk = probe.ink }
    }
    if (carved === null) {
      console.error("no frame with the carve ON and a whole mark on the page — the subject does not exist")
      process.exit(2)
    }
    await seek(carved)
    const g = await page.evaluate(() => window.__heroPenField)
    checks.push({ eng, ...g })

    const shipped = await readMark(await page.locator("[data-hero-stage]").screenshot())
    await page.evaluate(() => window.__captureHarness.setFlatten({ penCarve: 0 }))
    await page.waitForTimeout(320)
    const off = await readMark(await page.locator("[data-hero-stage]").screenshot())
    await page.evaluate(() => window.__captureHarness.setFlatten(null))
    await page.waitForTimeout(320)
    marks.push({ eng, t: carved, shipped, off, carvedInk })
  }

  const bad = checks.filter((c) => c.texW !== c.width || c.texH !== c.height)
  const storage = {
    ok: bad.length === 0,
    detail: checks
      .map((c) => `${c.eng}: field ${c.width}x${c.height} / GL ${c.texW}x${c.texH}${c.texW !== c.width || c.texH !== c.height ? "  MISMATCH" : ""}`)
      .join("  ·  ") +
      `. three r175 sizes a DataTexture's storage with texStorage2D at the first upload and ` +
      `texSubImage2Ds every one after, so a re-bake at a different size leaves fsPuv scanning the ` +
      `OLD rectangle. This is the eraser, and it needs a DIAL to appear — a plain load never ` +
      `resizes the field, which is why every stored-capture gate stayed green through it.`,
  }

  /* THE PICTURE, NOT ONLY THE NUMBER. A mismatched lookup carves the mark by a
   * stretched copy of its own outline, so the word breaks into pieces — that is
   * what a component count sees and what a size comparison alone would not. */
  const broke = marks.filter(
    (m) => m.shipped.comps > m.off.comps + 1 || m.shipped.specks > 0 || m.off.ink < 5000,
  )
  const apart = {
    ok: broke.length === 0,
    detail: marks
      .map((m) => `${m.eng} @${m.t.toFixed(2)}s: carved ${m.shipped.comps} comps / ${m.shipped.specks} specks / ${m.shipped.ink} px vs un-carved ${m.off.comps} comps / ${m.off.ink} px`)
      .join("  ·  ") +
      `. The carve is subtractive by construction (the pen outline is a strict subset of the tube), ` +
      `so it may THIN the mark and may never split it. Tolerance is +1 component, because at high ` +
      `amplitude a genuinely thin junction can separate two letters that were only touching.`,
  }

  await page.close()
  return { want, live, storage, apart }
  }

  /* ---- THE SHIPPED ARM ---- */
  const real = await runArm(true)
  record(
    `the arm under test actually took (shipped)`,
    real.live === true,
    `setFieldRealloc(true) -> fieldRealloc() reports ${real.live}. An arm that silently fails to ` +
      `take produces a capture identical to the other one, which would then be reported as ` +
      `"the control passed too".`,
  )
  record("THE GL STORAGE IS THE SIZE OF THE FIELD IN IT — after wobble and endpoint have moved", real.storage.ok, real.storage.detail)
  record("  ...and the carved mark does not COME APART — same component count as the un-carved one", real.apart.ok, real.apart.detail)
  record("console clean", errors.length === 0, `${errors.length} errors${errors.length ? ": " + errors.join(" | ") : ""}`)

  /* ---- THE CONTROL: the parked pre-fix behaviour, required to break BOTH ----
   *
   * `setFieldRealloc(false)` restores exactly what shipped, which is the eraser
   * Sebs saw for days. Both subject rows MUST go red. The control's own rows are
   * NOT echoed — they are red on purpose and both battery runners count an
   * indented `FAIL`, so echoing them would post this gate's evidence as its
   * failures (Lane I's finding on `assert-hero-transition`). */
  const prior = await runArm(false)
  const tookControl = prior.live === false
  const bothRed = !prior.storage.ok && !prior.apart.ok
  const controlOk = tookControl && bothRed
  if (!controlOk) results.push({ name: "control", pass: false })
  console.log(
    `${controlOk ? "PASS" : "FAIL"}  CONTROL · KNOWN-BAD — the parked pre-fix realloc (setFieldRealloc(false)), i.e. the eraser itself, is REJECTED by BOTH subject rows`,
  )
  console.log(
    `      arm took: fieldRealloc() reports ${prior.live} (needs false)` +
      ` · GL-storage row ${prior.storage.ok ? "STAYED GREEN" : "went red"}` +
      ` · comes-apart row ${prior.apart.ok ? "STAYED GREEN" : "went red"}` +
      `${controlOk ? "" : " — THIS GATE CANNOT SEE THE DEFECT IT CLAIMS TO GUARD"}`,
  )
  console.log(`      control read: ${prior.storage.detail.split(". three")[0]}`)
  console.log(`      control read: ${prior.apart.detail.split(". The carve")[0]}`)

  await context.close()
  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} rows hold`)
  console.log(failed.length ? "\nNOT SOUND" : "\nSOUND")
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
