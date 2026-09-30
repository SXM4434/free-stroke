// USER-AUTHORED FUSION — can a PERSON make one, and does what they made RENDER?
//
// WHY THIS EXISTS SEPARATELY FROM assert-fusion-ui.mjs.
//
// That script proves the eight relationships WE authored are reachable. This
// one asks the question Sebs asked, which had no answer at all until this pass:
// *"fusion doesn't have a way for a user to make their own fusions."* So the
// subject here is the authoring surface — the pills, the dropdowns, the amount
// sliders, the name field, the persistence — driven the way a person drives it,
// plus the engine underneath it, measured on the pixels it produces.
//
// THE TWO HALVES, AND WHY BOTH ARE NEEDED.
//
//   PART A · THE SURFACE, BY CLICK. Every assertion is made against the DOM the
//     user touches. It never reaches through the harness for anything it is
//     asserting — this project has already shipped a panel that rendered zero
//     controls while harness assertions passed.
//   PART B · THE ENGINE, ON PIXELS. Fourteen targets and seven sources are a
//     matrix no click-through can cover in a reasonable run, and the subject
//     there is the RENDERER, not the panel. So Part B writes state through the
//     same `setStyle` path the panel writes and measures the 3-D canvas bytes.
//     A target that does not move a pixel is a dropdown entry that lies, which
//     is the "names must match behaviour" defect this repo keeps shipping.
//
// HOW IT IS CALIBRATED, because a green row that cannot fail is the lie.
//
//   Every "this moved the picture" assertion is paired with a NEGATIVE CONTROL
//   run through the SAME code path and the SAME measurement, and the control
//   must come back BELOW the floor or the instrument is blind:
//     - LINK 0 with the identical fusion selected. The engine's documented
//       contract is that Link 0 returns the identity frame, so this is the
//       strongest available control: same fusion, same drawing, same clock,
//       coupling switched off. If a target "moves" at Link 0, the reading is
//       noise and every row above it is void.
//     - AMOUNT 0 on the link itself, for the per-link assertions.
//     - THE KNOWN-DEAD ARM: this source and this target chosen, the amount at
//       0. Every one of the 31 arms is read twice, once live and once dead,
//       through the same window and the same metric, and the bar sits between
//       the loudest dead reading and the quietest live one. That pair is what
//       makes the bar a measurement instead of a number somebody liked.
//   The floor is the repo's own perceptual floor for this statistic, cited
//   rather than invented — see the block at `CITED_FLOOR` for what it replaced
//   and why 0.12 was that same number all along, divided by an ink fraction.
//
// Usage:
//   node scripts/verify/_run-clean.mjs scripts/verify/assert-fusion-authoring.mjs
//   node scripts/verify/assert-fusion-authoring.mjs --mutate=unlinked   # must FAIL
//   node scripts/verify/assert-fusion-authoring.mjs --mutate=deadalive  # must FAIL
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { loadTs } from "./_ts-load.mjs"
/* ⚠ WAS PORT-BLIND — hardcoded :3000, ignored FS_PORT, and in a lane that means
 * it drove the CANONICAL tree and printed green about code this lane never
 * wrote. 35 of 48 browser gates were measured doing this on 2026-08-07.
 * docs/DISPATCH.md §3: one knob, one name, resolved once in dev-server.mjs. */
import { LAB_URL } from "./lib/dev-server.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"

// The real modules, loaded in plain Node — the same code the page runs. Used
// for the questions whose answer lives in the FUNCTION rather than in a frame.
const S = loadTs("lib/style-system.ts")
const FUS = loadTs("lib/style-fusion.ts")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const LABEL = arg("label", "after")
const MUTATE = arg("mutate", "")
const OUT = join(ROOT, "docs", "verification", "fusion-authoring", LABEL)
mkdirSync(OUT, { recursive: true })

/* A mark with a lot of interior, so the screen-space layers have somewhere to
 * live: a dither field on a hairline reads on a few hundred pixels and every
 * measurement below would sit in the noise. */
function testStroke() {
  const pts = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    pts.push({
      x: 140 + t * 600,
      y: 320 + Math.sin(t * Math.PI * 2.4) * 150,
    })
  }
  return [pts]
}

/** Mean absolute per-channel difference over the WHOLE frame, paper included,
 *  0..255. KEPT, unchanged, so every number this gate has ever written to
 *  `report.json` stays readable beside the ones it writes now — and because the
 *  self-check row below is about the decoder being deterministic, which is true
 *  of both scales. IT IS NO LONGER WHAT ANYTHING IS GRADED ON: see `inkDelta`. */
async function frameDelta(a, b) {
  const [ia, ib] = await Promise.all([loadImage(a), loadImage(b)])
  const w = Math.min(ia.width, ib.width)
  const h = Math.min(ia.height, ib.height)
  const ca = createCanvas(w, h)
  const cb = createCanvas(w, h)
  ca.getContext("2d").drawImage(ia, 0, 0)
  cb.getContext("2d").drawImage(ib, 0, 0)
  const da = ca.getContext("2d").getImageData(0, 0, w, h).data
  const db = cb.getContext("2d").getImageData(0, 0, w, h).data
  let sum = 0
  for (let i = 0; i < da.length; i += 4) {
    sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
  }
  return sum / (w * h * 3)
}

/* THE PAPER THE MARK IS ACTUALLY SEEN ON.
 *
 * `grab()` returns the WebGL canvas, which is TRANSPARENT everywhere the form
 * is not, and the RGB sitting under a transparent pixel is not a colour anybody
 * ever looks at. `_probe-fusion-two-dead.mjs` — the probe behind this feature's
 * sibling gate — records what skipping this costs: *"A fusion lane's first
 * contact sheet composited a transparent canvas onto black and read it as
 * 'creating a fusion shreds the mark'."* Same paper as that probe, so the two
 * files' numbers land on one scale. */
const PAPER = "#ffffff"

/** One grab, decoded once: the RGB composited onto the paper, plus the frame's
 *  OWN alpha, which is the only thing that says where the form is. */
async function framePx(png) {
  const img = await loadImage(png)
  const w = img.width
  const h = img.height
  const c = createCanvas(w, h)
  const g = c.getContext("2d")
  g.clearRect(0, 0, w, h)
  g.drawImage(img, 0, 0)
  const raw = g.getImageData(0, 0, w, h).data
  const n = w * h
  const alpha = new Uint8Array(n)
  for (let i = 0; i < n; i++) alpha[i] = raw[i * 4 + 3]
  g.clearRect(0, 0, w, h)
  g.fillStyle = PAPER
  g.fillRect(0, 0, w, h)
  g.drawImage(img, 0, 0)
  return { rgb: g.getImageData(0, 0, w, h).data, alpha, n, w, h }
}
/* A grab is compared against many others (an arm's reference is differenced 8+
 * times), so each buffer is decoded once and kept for as long as the caller
 * holds it. */
const PXCACHE = new WeakMap()
async function px(png) {
  let v = PXCACHE.get(png)
  if (!v) {
    v = await framePx(png)
    PXCACHE.set(png, v)
  }
  return v
}

/* WHAT THIS GATE'S DELTA IS AVERAGED OVER, AND WHY IT MOVED.
 *
 * 🔴 `frameDelta` ABOVE IS `diff-frames.mjs`'s `compare()` WITH ITS MASK
 * DELETED. Line for line the arithmetic is the same — `(|Δr|+|Δg|+|Δb|)/3` on
 * an 0..255 scale — except that `diff-frames.mjs` says in its first sentence
 * what it averages over: *"over pixels where either frame has ink (alpha >
 * 20)"*, and this file divided by every pixel in the canvas instead. The
 * measured cost of that on this stage: the form is 5.6 % of the frame, so every
 * number this gate printed was the real one divided by about eighteen.
 *
 * And it is not one constant factor, which is what makes it a defect rather
 * than a unit. THE INK FRACTION IS A PROPERTY OF THE COMPOSITION THE ARM WEARS.
 * Lane C2 measured the same dilution on `assert-screen-layers` across 132
 * graded rows on 2026-09-04 — rod 0.131 · extrude 0.326 · solid 0.343 · inflate
 * 0.485, a 3.7x spread — and Rod was marked 3.7x harder than Inflate purely for
 * being thin. Here the arms differ the same way: a material target is probed on
 * a BARE body and a dither target through three screen layers, so one absolute
 * whole-frame bar was twenty-one different bars. `_probe-fusion-two-dead.mjs`
 * had already written the same sentence for this very feature: *"the stroke is
 * ~3 % of the crop and averaging a change on the ink across 97 % of untouched
 * paper divides it by thirty."*
 *
 * EITHER frame, not "ink in the reference". C2's reason carries here unchanged:
 * an effect that puts ink OUTSIDE the silhouette it started from would be
 * scored as paper by a before-only mask — hidden by the instrument that exists
 * to measure it. Glow and shineBand do exactly that.
 *
 * IT REFUSES BY NAME RATHER THAN FALLING BACK. An empty mask and a mask that
 * has swallowed the whole canvas are both "the alpha channel is not telling me
 * where the form is", and in both cases the number that comes out is a
 * plausible one measured over the wrong pixels. That is this repo's most
 * expensive defect class and the fallback is what makes it silent. The mask
 * SIZE is returned and printed with every row, because a ratio whose
 * denominator is not printed is how a number got quoted against the wrong floor
 * for a month. */
const MASK = { min: 1, max: 0, sum: 0, n: 0 }
function meanAbsDiffInk(A, B) {
  if (A.n !== B.n)
    throw new Error(
      `INK MASK REFUSED — the two grabs are different rasters (${A.w}x${A.h} vs ${B.w}x${B.h}). ` +
        `R3F sizes its backing buffer asynchronously, so this is a real condition; a delta between two different rasters is not a measurement.`,
    )
  let s = 0
  let m = 0
  for (let i = 0; i < A.n; i++) {
    if (A.alpha[i] <= 20 && B.alpha[i] <= 20) continue
    const j = i * 4
    s += Math.abs(A.rgb[j] - B.rgb[j]) + Math.abs(A.rgb[j + 1] - B.rgb[j + 1]) + Math.abs(A.rgb[j + 2] - B.rgb[j + 2])
    m++
  }
  const frac = m / A.n
  if (m === 0)
    throw new Error(
      "INK MASK REFUSED — the union of the two frames' alpha is EMPTY, so there is no form to measure a change on. " +
        "Refusing rather than returning the whole-frame number, which would be a confident reading of a blank stage.",
    )
  if (frac > 0.95)
    throw new Error(
      `INK MASK REFUSED — the mask covers ${(frac * 100).toFixed(1)} % of the canvas, i.e. it is not a mask. ` +
        "The grab has lost its alpha (an opaque clear colour would do it), so this would be the diluted whole-frame number wearing a mask's name.",
    )
  MASK.min = Math.min(MASK.min, frac)
  MASK.max = Math.max(MASK.max, frac)
  MASK.sum += frac
  MASK.n++
  return { dInk: s / (m * 3), inkPx: m, ofPx: A.n }
}
/** The graded delta: `diff-frames.mjs`'s own number, on `diff-frames.mjs`'s own
 *  mask, so this gate's floor can be that file's floor rather than an invention. */
async function inkDelta(a, b) {
  const [A, B] = await Promise.all([px(a), px(b)])
  return meanAbsDiffInk(A, B).dInk
}
/** The mask's own size on one frame, as a fraction — the denominator every row
 *  below is divided by, printed with the row. */
async function inkFracOf(png) {
  const A = await px(png)
  let m = 0
  for (let i = 0; i < A.n; i++) if (A.alpha[i] > 20) m++
  return m / A.n
}

/** How much of the frame is actually a rendered form — a blank-frame guard, so
 *  a delta of 0 can never be reported as "identical" when the truth is "the
 *  scene never drew". Two empty frames are byte-identical. */
async function frameInkFrac(png) {
  const img = await loadImage(png)
  const cv = createCanvas(img.width, img.height)
  cv.getContext("2d").drawImage(img, 0, 0)
  const d = cv.getContext("2d").getImageData(0, 0, img.width, img.height).data
  let ink = 0
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 12) ink++
  return ink / (img.width * img.height)
}

/* THE LISTS ARE CHECKED AGAINST THE MODULE'S OWN, not just written down.
 *
 * They are spelled out so a reader can see exactly what is swept — and then
 * `say()`-asserted against `FUSION_TARGETS` / `FUSION_SOURCES` below, so the
 * copy CANNOT fall behind the original the way `assert-hero-option-panel`'s
 * four-film list fell behind seven. A member added to the rail without being
 * added here turns this script red on its next run rather than being silently
 * unswept. Grew 14 -> 21 and 7 -> 10 on 2026-08-03; see the combination-space
 * note at the top of lib/style-fusion.ts for which gaps each one closes. */
const TARGETS = [
  "ditherThreshold", "ditherCell", "ditherAmount", "ditherFlow", "ditherBite",
  "asciiDensity", "asciiFlow", "asciiCell", "asciiBite",
  "textureAmount", "textureScale", "textureFlow", "textureBite",
  "gloss", "glow", "wet", "sheen", "metal", "iridescence", "ink", "shineBand",
]
const SOURCES = [
  "breath", "drift", "asciiField", "ditherField", "textureField", "stackField",
  "orbit", "reveal", "completion", "event",
]

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  const page = await ctx.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`))

  // A CLEAN LIBRARY, OR THE RUN IS NOT REPRODUCIBLE. The panel restores the
  // user's fusions from localStorage on load, so a previous run's fusions would
  // change every count this script makes.
  //
  // ⚠ ONCE, NOT ON EVERY NAVIGATION. `addInitScript` runs before EVERY document
  // — including the reload — so the first version of this wiped the library
  // milliseconds before the reload test read it and reported "the library does
  // not survive a reload" on a build where it does. An instrument that destroys
  // the thing it is about to measure produces a confident FALSE FAILURE, which
  // is the same family as a green row that cannot fail. The session marker
  // makes it fire exactly once.
  await page.addInitScript(() => {
    try {
      if (!window.sessionStorage.getItem("fs.assert.cleared")) {
        window.localStorage.removeItem("freestroke.fusions.v1")
        window.sessionStorage.setItem("fs.assert.cleared", "1")
      }
    } catch {}
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })

  let pass = true
  const results = []
  const say = (ok, label, detail) => {
    if (!ok) pass = false
    results.push({ ok, label, detail })
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
  }

  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1500)
  if (await page.evaluate(() => !!window.__revealHarness))
    await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(500)

  const readState = () => page.evaluate(() => window.__styleHarness.get().styleState)
  const setStyle = (patch) => page.evaluate((p) => window.__styleHarness.setStyle(p), patch)
  const grab = async () => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    if (!url) return null
    return Buffer.from(url.split(",")[1], "base64")
  }

  /* ================= PART A — THE SURFACE, BY CLICK ====================== */

  const showPanel = page.getByRole("button", { name: /Show panel|Hide panel/ })
  if ((await showPanel.textContent())?.trim() === "Show panel") await showPanel.click()
  await page.waitForTimeout(250)
  await page.getByRole("button", { name: "Fusion", exact: true }).first().click()
  await page.waitForTimeout(350)
  const body = page.locator("div.fs-panel-enter")
  say((await body.count()) === 1, "fusion panel body is rendered")

  /* ---- 0. CAN THIS SCRIPT FAIL? ---------------------------------------
   * Both instruments this script trusts are probed against an input whose
   * answer is known. A locator that finds a control which has never existed,
   * or a pixel metric that reports a difference between a frame and itself,
   * makes every PASS below meaningless. */
  /* THE SWEEP'S OWN INVENTORY, AGAINST THE RAIL'S. Checked before anything is
   * measured, because "all 14 targets are live" is only a claim worth making
   * while 14 is the number of targets there are. */
  const missTargets = FUS.FUSION_TARGETS.map((t) => t.id).filter((id) => !TARGETS.includes(id))
  const missSources = FUS.FUSION_SOURCES.map((s) => s.id).filter((id) => !SOURCES.includes(id))
  say(missTargets.length === 0 && missSources.length === 0,
    "this sweep covers EVERY source and target the rail defines",
    [...missTargets, ...missSources].join(", ") || `${TARGETS.length} targets, ${SOURCES.length} sources`)

  const ghost = await body.getByRole("button", { name: "Nonexistent Fusion Control", exact: true }).count()
  say(ghost === 0, "SELF-CHECK: the button locator reports a MISS for a control that does not exist")
  const selfA = await grab()
  say(selfA !== null, "SELF-CHECK: the 3-D canvas can be grabbed at all")
  const inkFrac = await frameInkFrac(selfA)
  say(inkFrac > 0.005, "SELF-CHECK: the frame being measured contains a rendered form (not a blank)",
    `ink ${(inkFrac * 100).toFixed(2)}%`)
  say((await frameDelta(selfA, selfA)) === 0 && (await inkDelta(selfA, selfA)) === 0,
    "SELF-CHECK: the pixel metric reports EXACTLY 0 for a frame against itself",
    `whole-frame and ink-masked both 0.000, over an ink mask of ${((await inkFracOf(selfA)) * 100).toFixed(2)} % of the canvas`)

  /* ---- 1. the authoring rail exists and creates ------------------------- */
  const newBtn = body.locator("[data-fusion-new]")
  say((await newBtn.count()) === 1, "the '+ New fusion' control exists in the panel")
  const before = await readState()
  say(Array.isArray(before.customFusions) && before.customFusions.length === 0,
    "starts with an empty library (localStorage cleared)", `${before.customFusions?.length}`)

  await newBtn.click()
  await page.waitForTimeout(400)
  let st = await readState()
  say(st.customFusions.length === 1, "clicking '+ New fusion' creates one fusion", `${st.customFusions.length}`)
  const fid = st.customFusions[0]?.id
  say(st.fusionPreset === `custom:${fid}`,
    "the new fusion is SELECTED, so the user sees what they just made", `${st.fusionPreset}`)
  say(st.customFusions[0].links.length >= 1,
    "a new fusion starts with real relationships, not an empty document",
    `${st.customFusions[0].links.length} links`)
  say((await body.locator(`[data-fusion-pill="${fid}"]`).count()) === 1,
    "the new fusion appears as a pill on the rail")

  /* THE EIGHT BUILT-INS ARE STILL THERE (§0.7 — never remove a prior read). */
  const railText = (await body.textContent()) ?? ""
  const builtins = ["Terminal Gel", "Dither Bloom", "Signal Ink", "ASCII Rubber",
    "Scanline Balloon", "Pixel Clay", "Code Bloom", "Glitch Ribbon"]
  const missing = builtins.filter((b) => !railText.includes(b))
  say(missing.length === 0, "all eight built-in relationships survive beside the new rail",
    missing.join(", ") || "8/8")

  /* ---- 2. the editor renders and edits ---------------------------------- */
  const editor = body.locator("[data-fusion-editor]")
  say((await editor.count()) === 1, "selecting a user fusion opens its editor")
  const linkRows = editor.locator("[data-fusion-link]")
  const nRows = await linkRows.count()
  say(nRows === st.customFusions[0].links.length,
    "every authored relationship has a row", `${nRows} rows`)

  // Add a relationship, by click.
  await editor.locator("[data-fusion-add-link]").click()
  await page.waitForTimeout(300)
  st = await readState()
  say(st.customFusions[0].links.length === nRows + 1,
    "'+ Add relationship' adds one", `${st.customFusions[0].links.length}`)
  say((await linkRows.count()) === nRows + 1, "and the new row renders")

  // Change what drives what, by using the real dropdowns.
  const firstLinkId = st.customFusions[0].links[0].id
  await editor.locator(`[data-fusion-link-source="${firstLinkId}"]`).selectOption("ditherField")
  await editor.locator(`[data-fusion-link-target="${firstLinkId}"]`).selectOption("glow")
  await page.waitForTimeout(250)
  st = await readState()
  say(st.customFusions[0].links[0].source === "ditherField" &&
    st.customFusions[0].links[0].target === "glow",
    "the source and target dropdowns write the relationship",
    `${st.customFusions[0].links[0].source} -> ${st.customFusions[0].links[0].target}`)

  // The amount slider, including its negative half — the polarity IS half of
  // what a relationship says, so a slider that cannot go below zero would only
  // be able to author half the sentences.
  await editor.locator(`[data-fusion-link-amount="${firstLinkId}"]`).fill("-0.8")
  await page.waitForTimeout(250)
  st = await readState()
  say(Math.abs(st.customFusions[0].links[0].amount + 0.8) < 1e-6,
    "the amount slider writes a SIGNED amount (inverted relationships are authorable)",
    `${st.customFusions[0].links[0].amount}`)

  // The name is the concept.
  await editor.locator("[data-fusion-name]").fill("Ink Storm")
  await page.waitForTimeout(300)
  st = await readState()
  say(st.customFusions[0].name === "Ink Storm", "the fusion can be named", st.customFusions[0].name)
  say((await body.locator(`[data-fusion-pill="${fid}"]`).textContent())?.trim() === "Ink Storm",
    "the name shows on its pill")
  const desc = (await editor.locator("[data-fusion-description]").textContent()) ?? ""
  say(desc.includes("Dither field") && desc.includes("Surface · glow"),
    "the panel reads the CONCEPT back in plain English, from the live links",
    desc.slice(0, 110))

  /* ---- 3. an asleep link says so ---------------------------------------- */
  await setStyle({ ditherEnabled: false })
  await page.waitForTimeout(300)
  const rowText = (await editor.locator(`[data-fusion-link="${firstLinkId}"]`).textContent()) ?? ""
  say(/Asleep/.test(rowText) && /Dither is off/.test(rowText),
    "a relationship whose layer is off SAYS SO instead of silently doing nothing",
    rowText.replace(/\s+/g, " ").slice(0, 120))
  await editor.locator(`[data-fusion-link="${firstLinkId}"]`).getByRole("button", { name: /Turn on Dither/ }).click()
  await page.waitForTimeout(300)
  st = await readState()
  say(st.ditherEnabled === true, "and its one-click fix turns the layer back on")

  /* ---- 4. duplicate, persist, delete ------------------------------------ */
  await editor.locator("[data-fusion-duplicate]").click()
  await page.waitForTimeout(350)
  st = await readState()
  say(st.customFusions.length === 2, "Duplicate forks it", `${st.customFusions.length}`)
  say(st.customFusions[1].links.length === st.customFusions[0].links.length,
    "the fork carries the relationships, not just the name")

  // PERSISTENCE — the whole point of "name it and keep it".
  await page.reload({ waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness, null, { timeout: 60000 })
  await page.waitForTimeout(900)
  st = await readState()
  say(st.customFusions.length === 2 && st.customFusions.some((f) => f.name === "Ink Storm"),
    "the library survives a page reload",
    `${st.customFusions.length}: ${st.customFusions.map((f) => f.name).join(", ")}`)

  /* ================= PART B — THE ENGINE, ON PIXELS ====================== */
  //
  // Subject: the renderer. Driven through `setStyle` — the same state path the
  // panel writes — because 14 targets x a control arm is not a click-through.

  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1400)
  if (await page.evaluate(() => !!window.__revealHarness))
    await page.evaluate(() => window.__revealHarness.setProgress(1))

  /* THE COMPOSITION THE SWEEP IS MEASURED ON, and the one decision that makes
   * the measurement mean anything: THE LAYERS DO NOT ANIMATE.
   *
   * The first version of this script left texture/dither/ASCII crawling, and it
   * was measuring the crawl. Two grabs 420 ms apart differed by 0.19 with
   * NOTHING changed, the negative control at Link 0 read up to 0.52, and eight
   * targets were reported dead against a floor that was pure animation drift.
   * The readings were not wrong about the noise — they were wrong about what
   * they were reading, which is worse.
   *
   * With the layer animations off, every source in the sweep except `breath`,
   * `completion` and `event` is CONSTANT, so an arm's frame is deterministic
   * and a delta against the reference is the RELATIONSHIP and nothing else.
   * `motionMode` stays "independent" because fusion's own drive still has to
   * run — freezing style time would park the three time-driven sources at rest
   * and the sweep would then be measuring nothing at all in the other
   * direction. The three that DO move get a sampling window sized to their own
   * behaviour below, instead of one window pretending to fit all seven. */
  /* BASE NAMES EVERY FIELD ANY ARM TOUCHES, AT ITS NEUTRAL VALUE.
   *
   * `setStyle` is a partial merge, so a field an arm sets and BASE does not
   * name SURVIVES into every later arm. Measured: the first frozen arm left the
   * stack enabled and the phases latched, and every row after it was quietly
   * measured on that composition — `shineBand` went 0.125 -> 0.921 and five
   * sources that had been working went to 0.000, all without a line of product
   * code changing. A sweep whose arms leak into each other is not a sweep; it
   * is one long drifting experiment. Listing the neutral value of every field
   * makes `{ ...BASE, ...extra }` a full reset by construction.
   *
   * 🔴 AND THE LIST WAS 24 FIELDS OF 71, WHICH IS WHY THE LEAK WAS NOT AN ARM'S
   * — IT WAS PART A'S.
   *
   * Measured 2026-09-04 by dumping `styleState` at the `ditherBite` arm from
   * this gate and from a cold probe running the byte-identical patch. The two
   * disagreed on ten fields, none of them named here and none of them set by
   * any arm:
   *
   *     ditherType   blueNoise vs bayer4      ditherLevels 3 vs 2
   *     ditherScale  2 vs 3                   ditherIntensity 0.7 vs 1
   *     ditherContrast 0.45 vs 0.5            asciiCharset custom vs blocks
   *     asciiDensity 0.6 vs 0.5               asciiContrast 0.55 vs 0.5
   *     asciiScrollSpeed 0.9 vs 1             stackDitherOpacity 0.55 vs 1
   *
   * PART A CREATES A FUSION BY CLICKING, and selecting one wakes its layers
   * through the product's own preset path — which writes a whole dither and
   * ASCII configuration. Part B then ran its entire 31-arm pixel sweep on
   * whatever that clicking happened to leave behind: a three-level blue-noise
   * dither at intensity 0.7 under a 0.55 stack opacity, instead of the app's
   * defaults. It cost four rows. On the defaults `ditherBite` reads 3.401 where
   * this gate reported 1.462, `textureAmount` 2.587 where it reported 1.814,
   * `textureBite` 2.383 where it reported 1.635, `textureScale` 3.273 where it
   * reported 2.183. A dither dial measured through a dimmed, coarsened dither
   * is not a test of that dial.
   *
   * SO THE LIST IS GONE. BASE is seeded from `DEFAULT_STYLE_STATE` and then
   * says what the sweep deliberately changes — the same defence this file
   * already uses for TARGETS and SOURCES, which are checked against the rail's
   * own arrays rather than written down and trusted. A field added to the style
   * state tomorrow is reset here tomorrow, with nobody remembering to. */
  const BASE = {
    ...S.DEFAULT_STYLE_STATE,
    // …and here is everything the sweep deliberately does NOT leave at default,
    // which is the only part of this object that is a decision.
    textureEnabled: true, textureMode: "grain", textureIntensity: 0.7, textureAnimated: false,
    textureDirection: "horizontal",
    ditherEnabled: true, ditherAnimated: false, ditherDirection: "static",
    asciiEnabled: true, asciiAnimated: false, asciiAnimationType: "none", asciiDirection: "vertical",
    layerStackEnabled: false, stackAnimationEnabled: false, stackAnimationType: "none", stackAnimationSpeed: 1,
    materialPreset: "ink", materialUserOverride: false,
    motionMode: "independent",
    fusionDrive: "burst", fusionAnimationEnabled: true,
    fusionIntensity: MUTATE === "unlinked" ? 0 : 1,
    fusionSwing: 1,
    fusionAnimationSpeed: 1,
  }
  /* AND THE RESET IS CHECKED, NOT ASSUMED. `setStyle` is the panel's own write
   * path; a key it drops, or a key the product renamed out from under this
   * file, would put the sweep back on a composition nobody chose — silently,
   * exactly as above. So BASE is written and read back, and every field it
   * names has to be standing where it was put. */
  await setStyle({ ...BASE, customFusions: [], fusionPreset: "none" })
  await page.waitForTimeout(600)
  {
    const live = await readState()
    const drift = Object.keys(BASE).filter((k) => {
      if (k === "customFusions" || k === "fusionPreset") return false
      return JSON.stringify(live[k]) !== JSON.stringify(BASE[k])
    })
    say(drift.length === 0,
      `PART B STARTS FROM A KNOWN STATE — all ${Object.keys(BASE).length} style fields read back exactly as BASE set them`,
      drift.length
        ? drift.map((k) => `${k} ${JSON.stringify(live[k])} != ${JSON.stringify(BASE[k])}`).join(", ")
        : `seeded from DEFAULT_STYLE_STATE (${Object.keys(S.DEFAULT_STYLE_STATE).length} fields), so Part A's panel clicks cannot reach the sweep`)
  }
  const mk = (source, target, amount, id = "sweep") => ({
    id,
    name: "sweep",
    glowColor: "#7ec8a0",
    links: [{ id: "l1", source, target, amount }],
  })

  /** Worst difference from `ref` seen anywhere in a sampling window. MAX, not
   *  mean: an impulse source is at full strength for a fraction of its window
   *  by definition, and averaging one over its own silence is how you conclude
   *  a working event never fires. */
  const worstOver = async (ref, patch, ms, samples) => {
    await setStyle(patch)
    await page.waitForTimeout(450)
    let worst = 0
    for (let i = 0; i < samples; i++) {
      await page.waitForTimeout(ms / samples)
      const d = await inkDelta(ref, await grab())
      if (d > worst) worst = d
    }
    return worst
  }

  /** N frames of one running configuration. */
  const seq = async (patch, ms, n) => {
    await setStyle(patch)
    await page.waitForTimeout(500)
    const out = []
    for (let i = 0; i < n; i++) {
      await page.waitForTimeout(ms / n)
      out.push(await grab())
    }
    return out
  }

  /* THE PHASE-INVARIANT COMPARISON, for arms whose composition ANIMATES.
   *
   * A max-vs-a-single-reference reading is meaningless once the layers crawl:
   * two sequences of the same running composition differ by up to Δ3.07 purely
   * because they were sampled at different points of the same loop, which is
   * what made `ditherField` read 0.72 against a floor of 3.07 — a working
   * source scored dead by its own layer's motion.
   *
   * MIN over all pairs answers the question that actually matters: is there ANY
   * moment of the arm that looks like ANY moment of the reference? If the
   * coupling does nothing, the arm walks the same trajectory and some pair
   * matches closely. If it does something, every moment of one differs from
   * every moment of the other. Phase drops out; the relationship does not. */
  const minPair = async (A, B) => {
    let best = Infinity
    for (const a of A) for (const b of B) {
      const d = await inkDelta(a, b)
      if (d < best) best = d
    }
    return best
  }

  // The reference: the SAME fusion selected with its link at amount 0. Not
  // "fusion off" — a control that also changes which code path runs would
  // conflate "this target works" with "fusion is active at all".
  const refPatch = { ...BASE, customFusions: [mk("reveal", "gloss", 0)], fusionPreset: "custom:sweep" }
  await setStyle(refPatch)
  await page.waitForTimeout(700)
  const ref = await grab()
  say((await frameInkFrac(ref)) > 0.005, "the sweep reference frame contains a form", "blank-frame guard")

  /* THE BAR, AND WHERE IT COMES FROM — because the last one came from nowhere.
   *
   * ⚠ THIS FILE USED TO SAY "THE FLOOR IS MEASURED, NOT CHOSEN" AND THEN GRADE
   * EVERYTHING AGAINST A HARDCODED 0.12. The measured half was `noise * 3`, and
   * on 2026-09-04 `noise` read 0.000 — so `noise * 3` was 0 and the floor was
   * the constant, on all 21 target rows and all 10 source rows, every one of
   * them printing `floor 0.120`. The comment was describing a discipline the
   * code was not practising, which is worse than a plain constant: it is a
   * constant nobody will audit.
   *
   * THE REPO ALREADY HAD THE NUMBER, on the mask this gate had deleted.
   * `diff-frames.mjs:131` — *"meanΔ < 2 on an 0-255 scale is below the
   * perceptual floor on a dark surface — that's a pattern that technically ran
   * but reads as nothing"* — is the repo's one statement about when a change on
   * this exact statistic READS. Three gates already grade against it, and one
   * of them is this feature's own sibling: `assert-fusion-two-dead.mjs`'s
   * `ACTS = 2.0`, over the union of two frames' alpha, composited on the same
   * white paper, asking the same question about the same subsystem.
   * `assert-screen-layers.mjs` (C2, aa4830f7) and `assert-texture-relief.mjs`
   * (D2, e88ee7af) are the other two.
   *
   * So the bar is not re-derived here, it is JOINED: once the metric is
   * `diff-frames.mjs`'s metric, the floor is `diff-frames.mjs`'s floor, and this
   * file stops carrying a private number for a public statistic.
   *
   * AND THE OLD NUMBER WAS THIS ONE ALL ALONG. 0.12 x (1 / 0.056), this stage's
   * measured ink fraction, is 2.14. The 0.12 was 2.0 diluted by the ink
   * fraction of ONE composition and then applied to twenty-one others — which
   * is exactly the defect, not a coincidence.
   *
   * THE MEASURED HALF IS KEPT AND IT NOW MEANS SOMETHING. `noise * 3` can only
   * RAISE the bar, never lower it: on a machine whose own repeatability is
   * worse than the perceptual floor, the perceptual floor is not a bar. It read
   * 0.000 here; its job is the machine where it does not. */
  const CITED_FLOOR = 2.0
  const noise = await worstOver(ref, refPatch, 1400, 6)
  const FLOOR = Math.max(CITED_FLOOR, noise * 3)
  console.log(
    `  [floor] cited perceptual floor ${CITED_FLOOR.toFixed(3)} (diff-frames.mjs:131, ink-masked) · ` +
      `reference-vs-itself over its own window ${noise.toFixed(3)} · floor ${FLOOR.toFixed(3)}`,
  )

  /* EACH TARGET IS MEASURED ON THE COMPOSITION IT NEEDS, AND IN BOTH
   * DIRECTIONS. Two corrections the first run forced, both of which were the
   * instrument being wrong rather than the build:
   *
   *   1. SIGN. `ditherAmount` and `textureAmount` multiply a layer that is
   *      ALREADY at full strength, so the visible direction is negative and a
   *      +1-only probe measured a clamp (Δ0.013). A target counts as live if it
   *      moves the picture in EITHER direction, which is also what a user gets:
   *      the amount slider is signed.
   *   2. COMPOSITION. A flow target writes a layer's phase uniform, which the
   *      shaders only read on their animated branch, so probing one with the
   *      layer static measured exactly 0.000 — a true statement about the wrong
   *      configuration. Those arms animate the layer and freeze the global
   *      clock instead, which leaves the animated code path live and the frame
   *      deterministic. Texture arms use scanlines rather than grain because a
   *      scale change on fine grain is statistically invisible by construction.
   *      Sheen gets a body that HAS a sheen colour (eleven of sixteen do not).
   *
   * The per-arm patch is part of the claim, so it is printed with the row. */
  /* A THIRD CORRECTION THE MEASUREMENTS FORCED, and it is a real property of
   * the product rather than a probe detail: A FLOW TARGET DRIVEN BY A CONSTANT
   * SOURCE IS A PHASE OFFSET ON A LOOP, WHICH IS PERCEPTUALLY NOTHING at steady
   * state — the same movie, started a moment earlier. It reads when the SOURCE
   * itself varies, because then the offset becomes a speed modulation. So the
   * flow arms are probed from `breath`, and the panel's own copy for those
   * targets says "pushes the field along" rather than promising a static
   * displacement it cannot deliver. */
  /* THE FROZEN-PHASE COMPOSITION, and why it is the only honest way to probe a
   * phase.
   *
   * A phase source and a flow target both live in a layer's time uniform, which
   * only advances while that layer animates — so both need an animating layer,
   * and an animating layer makes every frame a moving target. Two dead ends
   * were measured before this one: comparing against a single reference scored
   * a working source (Δ0.72) dead against its own layer's motion (floor 3.07);
   * comparing phase-INVARIANTLY (min over pairs) is structurally blind to a
   * phase effect by construction, and duly reported Δ0.000 and Δ0.001 for the
   * two flow targets. An instrument that cannot see the class of thing it is
   * pointed at is worse than no instrument.
   *
   * `stackAnimationType: "freezeOnComplete"` is the product's own answer: once
   * the draw completes it latches the three phase uniforms at their live values
   * (`components/viewport-3d.tsx:1455-1466`). The layer animation path stays
   * live, the phases are non-zero AND different from each other, and the scene
   * is STILL — so a plain static comparison resolves the coupling exactly.
   *
   * AND IT CANNOT FALSE-PASS. If the freeze does not engage, the arm's own
   * measured floor (its reference against itself over the same window) comes
   * back large and the row fails. The guard is the same number as the metric.
   */
  const FROZEN = {
    // The freeze is a LAYER-STACK behaviour, so the stack has to be on for it
    // to exist at all — without this the group resolves to null, the phases go
    // on advancing, and the arm's floor comes back at 3.07 with the row failing
    // for the right reason but the wrong cause. (Which it did, once.)
    layerStackEnabled: true,
    stackAnimationEnabled: true,
    stackAnimationType: "freezeOnComplete",
    stackAnimationSpeed: 1,
  }

  /* LATCH THE PHASE SOMEWHERE THAT IS NOT ZERO.
   *
   * `freezeOnComplete` captures the uniforms at the frame the reveal ends, and
   * on a stroke that has just been replayed those are all ~0 — so the first
   * frozen run latched every phase at zero, `phaseTriangle(0)` correctly
   * returned 0 (its whole point), and the three field sources measured Δ0.000
   * for a completely honest reason: there was no phase to read.
   *
   * So the arm is built in two steps: let the layers RUN for a couple of
   * seconds with no freeze, then turn the freeze on, which latches wherever
   * they got to. `frozenPhaseRef` persists while `frozen` stays true, and
   * changing only `customFusions` afterwards does not disturb it — which is
   * what makes the reference and the arm share one latched phase exactly. */
  const latchArm = async (extra, fusionPatch) => {
    await setStyle({ ...BASE, ...extra, stackAnimationType: "none", customFusions: [], fusionPreset: "none" })
    await page.waitForTimeout(2200) // let the phases accumulate
    await setStyle({ ...BASE, ...extra, ...fusionPatch })
    await page.waitForTimeout(650)
  }
  /* A BARE BODY. Nothing between the camera and the surface, so a material
   * target is measured on the material rather than through the screen layers
   * that were covering it. */
  const MATERIAL_ONLY = {
    textureEnabled: false,
    textureMode: "none",
    ditherEnabled: false,
    asciiEnabled: false,
    layerStackEnabled: false,
    stackAnimationEnabled: false,
    stackAnimationType: "none",
  }
  /* ONE screen layer, for the rows that are about that layer's own dial. */
  const LAYER_ONLY = { ...MATERIAL_ONLY }
  /* THE GLYPH GRID WITH NOTHING ON TOP OF IT. The stack stays off: `asciiFlow`
   * needs the frozen group and spreads it over this, but a static glyph dial
   * does not, and a group is one more thing between the dial and the frame. */
  const ASCII_ONLY = { ditherEnabled: false, textureEnabled: false, textureMode: "none", asciiEnabled: true }
  /* A BODY THAT ACTUALLY REFLECTS.
   *
   * 🔴 THE WHOLE SWEEP RUNS ON `rod`, WHICH IS THE DEFAULT AND THE THINNEST
   * BODY THE PRODUCT HAS. `MATERIAL_ONLY` above takes the screen layers off a
   * material target and stops one step short: it leaves a reflection dial being
   * asked of a hairline tube seen nearly edge-on, which has almost no surface
   * for a highlight to land on. Measured across all four modes, dead arm 0.000
   * on every cell:
   *
   *     sheen        rod 1.488  extrude 4.317  SOLID 6.226  inflate 5.522
   *     metal        rod 1.707  extrude 4.025  SOLID 7.126  inflate 5.975
   *     iridescence  rod 1.450  extrude 2.674  SOLID 4.724  inflate 3.981
   *     gloss        rod 6.659  extrude 15.68  SOLID 26.36  inflate 22.96
   *
   * IT IS NOT AN AREA EFFECT — the ink mask only goes 4.94 % -> 6.85 %, a
   * factor of 1.4, while the readings move by 4. `gloss` is in the table
   * because it is the control: it is the same kind of dial and it moves by the
   * same factor, so the family is at a quarter strength on Rod and the three
   * that failed are simply the three that could not survive it. C2's sentence
   * for `assert-screen-layers` was "Rod was marked 3.7x harder purely for being
   * thin"; this is the same sentence about reflections rather than about area,
   * which is why the ink mask does not fix it.
   *
   * `solid` is the pick: the flat filled shape presents the most surface to the
   * camera, and it is a mode a user selects. Only the three reflection dials
   * move; `gloss`, `glow`, `wet` and `ink` clear the bar on Rod and are left
   * where the sweep has always graded them. */
  const REFLECTIVE_BODY = "solid"
  const ARM = {
    // ASCII's phase uniform is read inside the scroll/rain/cycle/flicker
    // branches only (ascii-shader.ts:412), so type "none" — the default —
    // leaves it written and unread. That is why the first probe read 0.000.
    /* ASCII ALONE. `_probe-ascii-flow.mjs` settled this by measurement rather
     * than argument: on an ASCII-only composition the flow link reads Δ0.196
     * (scroll) and Δ0.580 (cycle) against a self-spread of 0.000, so the target
     * is live. It measured Δ0.005 in the sweep because the sweep's BASE has
     * dither AND texture AND the stack on top of it, and the glyph grid's
     * contribution to the frame is a small part of that composite. Measuring a
     * layer through two louder layers is not a test of that layer.
     * The probe also confirmed the panel's own warning is right: with
     * `motionMode: "off"` the effect is EXACTLY 0.000, because the shader's
     * scroll branch is gated on the layer being actively animated. */
    /* AND IT IS DRIVEN FROM THE BREATH, which is the rule the block above
     * states for EVERY flow target and which only `ditherFlow` was actually
     * given: *"a constant source into a phase is the same movie started a
     * moment earlier, which is perceptually nothing."* `asciiFlow` was left on
     * `reveal`, a constant +1, and duly read Δ1.988 against the 2.00 bar — a
     * working target failed by the sweep asking it in the wrong register.
     * Measured on the identical arm: reveal 1.988 · breath 3.839 · drift 3.503,
     * dead arm 0.000 on all three. The window is the breath's own 5.4 s, for
     * the reason `shineBand` already carries one. */
    asciiFlow: {
      patch: { ...FROZEN, ditherEnabled: false, textureEnabled: false, asciiAnimated: true, asciiAnimationType: "scroll", asciiDirection: "horizontal", fusionDrive: "loop", fusionAnimationEnabled: false },
      latch: true, src: "breath", win: [5400, 8],
    },
    /* THE GLYPH DIALS, ON THE GLYPH LAYER. The file already wrote this rule for
     * `asciiFlow` and never applied it to its three neighbours: *"the sweep's
     * BASE has dither AND texture AND the stack on top of it, and the glyph
     * grid's contribution to the frame is a small part of that composite.
     * Measuring a layer through two louder layers is not a test of that layer."*
     * Measured on the corrected BASE, three layers vs ASCII alone:
     *   asciiCell    0.107 -> 3.269      asciiBite    0.190 -> 2.139
     *   asciiDensity 5.753 -> 9.780
     * `asciiDensity` cleared the bar either way; it moves with its neighbours
     * because the rule is about the arm, not about the row's verdict. The dead
     * arm reads 0.000 on all three. */
    asciiDensity: { patch: { ...ASCII_ONLY } },
    asciiCell: { patch: { ...ASCII_ONLY } },
    asciiBite: { patch: { ...ASCII_ONLY } },
    textureFlow: { patch: { ...FROZEN, textureAnimated: true, textureMode: "scanlines" }, latch: true },
    textureAmount: { patch: { textureMode: "scanlines" } },
    textureScale: { patch: { textureMode: "scanlines" } },
    textureBite: { patch: { textureMode: "scanlines" } },
    /* ADDED 2026-08-03, each arm stating what its target needs.
     *
     * `ditherFlow` is the flow target that does NOT need its layer animated —
     * `dither-shader.ts:236` reads `uFsDitTime` unconditionally — but it DOES
     * need a travel direction, because `dir * time` on "static" is the zero
     * vector, which is the arithmetic that made eight of Glitch Ribbon's frames
     * pixel-flat. It is driven from `breath` for the reason the block above
     * states for every flow: a constant source into a phase is the same movie
     * started a moment earlier, which is perceptually nothing. */
    ditherFlow: { patch: { ditherDirection: "horizontal" }, src: "breath", drive: "loop" },
    /* CONTRAST ACTS EVERYWHERE, AND THE SWEEP WAS LOOKING AT IT THROUGH TWO
     * OTHER LAYERS. Swept directly (`_probe-fusion-arms.mjs`), ditherContrast
     * 0.05 -> 0.95 moves the render by Δ0.34-0.57 on EVERY type at EVERY level,
     * strongest at `levels: 2` — i.e. the parameter is one of the loudest in the
     * rail. It read Δ0.119 here for the reason this file already documented for
     * `asciiFlow`: the sweep's BASE stacks texture AND ASCII on top of the
     * dither, and measuring a layer through two louder layers is not a test of
     * that layer. (The first correction guessed at four levels and a halftone,
     * which made it WORSE — Δ0.094 — which is what settled it by measurement.) */
    ditherBite: { patch: { ...LAYER_ONLY, ditherEnabled: true, ditherExposure: 0.7 } },
    /* THE SAME CONFOUND, ON EVERY MATERIAL TARGET. The three screen layers cover
     * the mark, so a surface change happens UNDERNEATH them. The loud material
     * levers survive it (gloss/glow/wet read 0.36-0.49); the quiet ones do not,
     * and `sheen`, `metal` and `iridescence` were all sitting within noise of the
     * floor for that reason rather than for anything about the levers. Measured
     * on a bare body they are unambiguous.
     *
     * Iridescence's body is chosen from the sweep, not guessed: gold 0.185,
     * matteClay 0.164, signal 0.141, ink 0.135 — and CHROME 0.011, because a
     * mirror's environment reflection swamps a thin film, which is why the first
     * guess at "the strongest reflection in the rail" was the worst arm in it. */
    iridescence: { patch: { ...MATERIAL_ONLY, materialPreset: "gold", materialUserOverride: true }, mode: REFLECTIVE_BODY },
    /* THE ALBEDO SCALE HAS TO HAVE ALBEDO TO SCALE. On the default `ink` body
     * (`#26262b`) the entire clamp range 0.25x..1.6x moves a near-black surface
     * between two near-blacks — the same arithmetic this repo already wrote down
     * when `wet` shipped as a darkening alone. `wet` answered it by adding three
     * shine levers, which is right for wetness and wrong for ink weight; this
     * one is measured on a body that has colour to lose, and the panel's blurb
     * says so on the row. */
    ink: { patch: { ...MATERIAL_ONLY, materialPreset: "matteClay", materialUserOverride: true } },
    sheen: { patch: { ...MATERIAL_ONLY, materialPreset: "softGel", materialUserOverride: true }, mode: REFLECTIVE_BODY },
    metal: { patch: { ...MATERIAL_ONLY }, mode: REFLECTIVE_BODY },
    gloss: { patch: { ...MATERIAL_ONLY } },
    glow: { patch: { ...MATERIAL_ONLY } },
    wet: { patch: { ...MATERIAL_ONLY } },
    /* A SHINE BAND IS A TRAVELLING HIGHLIGHT, and `pos` is derived from the
     * source's RAW value while `amt` uses |amount| — so probed from `reveal`
     * (a constant +1 on a finished stroke) BOTH directions produce the identical
     * frame: a stationary bright patch parked at the position clamp. That is a
     * true reading of a band that is not doing the thing the target is named
     * for. Driven from the breath it traverses, which needs a window sized to
     * the breath rather than the sweep's default 450 ms. */
    shineBand: { patch: { ...MATERIAL_ONLY }, src: "breath", drive: "loop", win: [5400, 8] },
  }
  const targetRows = []
  for (const t of TARGETS) {
    const spec = ARM[t] ?? {}
    /* THE DRIVE IS PART OF THE ARM. `BASE` runs the whole sweep under BURST,
     * which is the right default for the impulse-driven rows and is the WRONG
     * one for anything ambient: under Burst the shared oscillator is scaled to
     * `BURST_AMBIENT` = 0.2 by design (lib/style-fusion.ts), so a `breath`-driven
     * arm is measured at a fifth of its own amplitude. That is not the arm being
     * quiet, it is the sweep asking the question in a register the answer is not
     * spoken in — and it read as two DEAD rows before it was noticed. */
    const extra = { ...(spec.patch ?? {}), ...(spec.drive ? { fusionDrive: spec.drive, fusionAnimationEnabled: spec.drive !== "loop" } : {}) }
    const src = spec.src ?? "reveal"
    const armName = Object.keys(extra).join(",") || "base"
    // The reference wears the SAME composition, or the delta is the
    // composition change and not the relationship. Its own repeatability over
    // the same window is the arm's floor — which is also the guard that the
    // frozen-phase arms really did freeze.
    const refPatch = { ...BASE, ...extra, customFusions: [mk(src, t, 0)], fusionPreset: "custom:sweep" }
    /* THE BODY IS PART OF THE ARM, and it goes on BEFORE the reference so the
     * delta is the coupling and not the mode change. Geometry is not a style
     * field, so it cannot ride in `patch`; it is put back to the sweep's `rod`
     * after the arm, or every row below this one is graded on a body the rows
     * above it never saw. */
    if (spec.mode) {
      await page.evaluate((m) => window.__styleHarness.setMode(m), spec.mode)
      await page.waitForTimeout(1600)
    }
    if (spec.latch) await latchArm(extra, { customFusions: [mk(src, t, 0)], fusionPreset: "custom:sweep" })
    else await setStyle(refPatch)
    await page.waitForTimeout(700)
    const armRef = await grab()
    /* THE WINDOW IS PART OF THE ARM TOO. 450 ms over three samples resolves a
     * target driven by a CONSTANT source exactly, and samples a small arc of a
     * breath whose period is 5.2 s — so an arm switched to an oscillating source
     * has to be given a window sized to that source or it is read at whatever
     * phase it happened to land on. */
    const [tms, tn] = spec.win ?? [450, 3]
    /* THE KNOWN-DEAD ARM: THE OPTION PRESENT, AND THE OPTION AT ZERO.
     *
     * The fusion is selected, this exact source and this exact target are
     * chosen, and the amount slider is at 0 — a relationship a user has authored
     * and switched off. It runs the SAME `setStyle` path, the SAME window and
     * the SAME metric as the two live directions below, so the pair of numbers
     * on each row is a live reading and a dead one taken the same way.
     *
     * ⚠ IT IS ALSO THIS ARM'S MEASURED FLOOR, which is why it is taken over the
     * arm's OWN window rather than the fixed 700/4 this line used to use: a
     * `shineBand` graded across 5.4 s cannot have its noise estimated over
     * 700 ms. Two jobs, one measurement, and the second job is why the CONTROL
     * ROW below grades it against the FIXED bar and not against `floor` — `dead
     * < max(FLOOR, dead * 3)` is true by arithmetic and would be a green row
     * that cannot fail, which is the exact thing this file exists to avoid.
     *
     * `--mutate=deadalive` drives this arm to amount 1 and the control row must
     * go red. That is its must-fail. */
    const deadAmount = MUTATE === "deadalive" ? 1 : 0
    const dead = await worstOver(armRef, { ...BASE, ...extra, customFusions: [mk(src, t, deadAmount)], fusionPreset: "custom:sweep" }, tms, tn)
    const floor = Math.max(FLOOR, dead * 3)
    const frac = await inkFracOf(armRef)
    let d = 0
    // BOTH DIRECTIONS: `ditherAmount` and `textureAmount` multiply a layer
    // already at full strength, so their visible half is the negative one.
    for (const dir of [1, -1]) {
      const x = await worstOver(armRef, { ...BASE, ...extra, customFusions: [mk(src, t, dir)], fusionPreset: "custom:sweep" }, tms, tn)
      if (x > d) d = x
    }
    const moved = d > floor
    targetRows.push({ target: t, delta: d, dead, floor, inkFrac: Number(frac.toFixed(4)), moved, arm: armName, src, mode: spec.mode ?? "rod" })
    console.log(
      `  ${moved ? "  ok" : " DEAD"}  target ${t.padEnd(16)} Δ${d.toFixed(3)} (floor ${floor.toFixed(3)}, dead-arm ${dead.toFixed(3)}, ink ${(frac * 100).toFixed(1)}%)  [${armName}${spec.src ? " src=" + spec.src : ""}${spec.mode ? " mode=" + spec.mode : ""}]`,
    )
    if (spec.mode) {
      await page.evaluate(() => window.__styleHarness.setMode("rod"))
      await page.waitForTimeout(1600)
    }
  }
  const deadTargets = targetRows.filter((r) => !r.moved).map((r) => `${r.target}(${r.delta.toFixed(2)}/${r.floor.toFixed(2)})`)
  say(deadTargets.length === 0,
    `all ${TARGETS.length} targets visibly change the render (names match behaviour)`,
    deadTargets.join(", ") || `min Δ${Math.min(...targetRows.map((r) => r.delta)).toFixed(2)}`)

  /* SOURCES. Each drives the SAME loud target, so a row-to-row difference is
   * the source and nothing else — and each gets the window ITS OWN behaviour
   * needs, derived from the engine's constants rather than guessed:
   *   breath      omega 1.2 rad/s -> a ~5.2 s period; sample a full one.
   *   event       SLOT_SECONDS 1.1 with dice per slot; sample ~4 slots.
   *   completion  an impulse with a ~0.5 s half-life that has ALREADY DECAYED
   *               on a finished stroke, so it is re-triggered by replaying the
   *               reveal rather than measured in its own silence. Measuring
   *               this one at steady state would report a working impulse dead. */
  /* THE TARGET FOR THE SOURCE SWEEP IS `ditherThreshold`, NOT `glow`.
   *
   * The first run drove all seven into `glow` at full amount and five of them
   * came back at EXACTLY 0.416 — identical to three decimals, which is not a
   * coincidence, it is a clamp. A 1.8 emissive lift on a near-black body blows
   * the whole mark to white, so every source that was anywhere off zero
   * produced the SAME saturated frame and the sweep could not have told a
   * working source from a stuck one. The threshold is a structural target: a
   * different driver value makes a visibly different pattern rather than a
   * brighter version of the same one, so the rows can be compared to each
   * other and not just to zero. */
  /* Each source's window is DERIVED FROM ITS OWN RATE, not shared:
   *   breath      omega 1.2 rad/s -> a ~5.2 s period; sample a full one.
   *   drift       the same 1.2 plus a second sine at 0.41 rad/s (~15 s). The
   *               fast component is what a 5.4 s window resolves, and that is
   *               enough to prove the source carries a signal; the slow one is
   *               what makes it never repeat, which is a property no sampling
   *               window can assert and is stated rather than claimed.
   *   stackField  the group at speed 0.2 travels slowly by design (see SRC_ARM),
   *               so it needs a window several times longer than the default.
   *   event       SLOT_SECONDS 1.1 with dice per slot; sample ~4 slots.
   *   completion  an impulse with a ~0.5 s half-life that has ALREADY DECAYED on
   *               a finished stroke, so it is re-triggered by replaying the
   *               reveal rather than measured in its own silence. */
  const WINDOW = {
    breath: [5400, 8],
    drift: [5400, 8],
    stackField: [4200, 7],
    event: [4400, 10],
    completion: [1200, 6],
  }
  // A phase source rests at zero unless its layer is actually animating, so
  // those three arms animate it — which makes the arm's own scene move, which
  // is why each arm carries its OWN measured floor instead of borrowing the
  // static one. A floor imported from a different composition is the same
  // mistake as a window sized for an old beat.
  // The three phase sources need their layer running — so they are probed on
  // the same frozen-phase composition the flow targets use, for the same
  // reason: a live phase, a still scene, and a floor that doubles as the guard.
  const SRC_ARM = {
    asciiField: { ...FROZEN, asciiAnimated: true, asciiAnimationType: "scroll", asciiDirection: "horizontal" },
    ditherField: { ...FROZEN, ditherAnimated: true, ditherDirection: "horizontal" },
    textureField: { ...FROZEN, textureAnimated: true, textureMode: "scanlines" },
    /* THE STACK SOURCE reads the GROUP's animation, so the group has to be
     * animating — and `freezeOnComplete` (which is what `FROZEN` is) would latch
     * it at rest, so this one deliberately does NOT use the frozen arm. It gets
     * the drift behaviour, which is what publishes a non-zero `gOff`.
     *
     * AND THE BEHAVIOUR IS CHOSEN BY MEASUREMENT, because any stack behaviour
     * that gives this source a signal also MOVES THE WHOLE GROUP — so the arm's
     * floor is made of the subject's neighbour. Swept directly
     * (`_probe-fusion-arms.mjs`), the group's own frame-to-frame motion is
     * Δ0.28-0.36 for `drift` and `loop` at EVERY speed from 0.1 to 1.6 — slowing
     * it down does not help, which is why the first guess (drift at 0.2) did
     * not move the floor at all. `pulse` at 0.1 is Δ0.087, four times quieter,
     * and it is a FADE rather than a slide: it modulates the group's amplitude,
     * which is exactly the `(gAmt - 1)` half of the Stack source. The one arm
     * where the signal is loud and the neighbour is quiet.
     *
     * ⚠ AND THE SPEED WAS RE-PICKED 2026-09-04, ON THE SAME CRITERION, because
     * the sweep it was originally picked on was running on Part A's leftover
     * composition. Re-measured on the corrected BASE, signal vs the arm's own
     * dead reading:
     *
     *     pulse@0.05   4.041 / 0.351  = 11.5x     <- taken
     *     pulse@0.2    7.900 / 1.544  =  5.1x
     *     drift@0.1    9.510 / 1.668  =  5.7x
     *     loop@0.1     8.823 / 1.668  =  5.3x
     *     pulse@0.1    2.173 / 1.190  =  1.8x     <- the shipped pick, now the WORST
     *
     * `pulse` still wins the behaviour, for the reason above. At 0.1 the group's
     * fade now moves the frame nearly as much as the source does, and the row
     * failed 3.138 against its own measured floor of 3.278 — the discipline
     * working, not a leak. Halving the speed halves the neighbour and leaves the
     * source its own triangle to traverse. RATIO, not the loudest number: `drift`
     * reads more than twice as loud and takes its floor up with it. */
    stackField: {
      // ONE layer under the group, for the reason every material row needed the
      // same: the group fades whatever is in it, so with three screen layers in
      // the stack the arm's own floor is three layers' worth of fade. The row
      // drives `ditherThreshold`, so dither is the one that has to be there.
      textureEnabled: false,
      textureMode: "none",
      asciiEnabled: false,
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "pulse",
      stackAnimationSpeed: 0.05,
    },
    /* THE VIEW is geometry, not style time: it needs no layer running, and it is
     * CONSTANT while the camera is. That is the point of it — but it means the
     * arm has to be measured from a viewing angle where the signal is non-zero,
     * because `phaseTriangle` deliberately puts REST at the head-on view (the
     * angle the page loads at is the neutral one, exactly as a still layer's
     * phase rests at zero). `SRC_CAMERA` below turns the mark for this arm and
     * puts it back afterwards. */
    orbit: {},
  }
  /* Where the camera has to be for a source to have anything to say. Applied to
   * the arm AND to its reference, so the delta is the coupling and not the move.
   * `orbitView` is camera-only — it touches no geometry, material or style. */
  const SRC_CAMERA = { orbit: [62, 14] }
  /* AND THE DRIVE EACH SOURCE HAS TO BE ASKED IN. `BASE` sweeps under BURST,
   * which is correct for `event` and starves the two ambient sources: under
   * Burst the shared oscillator is scaled to `BURST_AMBIENT` = 0.2 by design, so
   * `breath` and `drift` were being measured at a fifth of their own amplitude
   * and both came back DEAD (Δ0.099 and Δ0.023 against a 0.120 floor). A source
   * asked in the wrong register answers quietly; that is the instrument's fault,
   * not the source's. */
  const SRC_DRIVE = { breath: "loop", drift: "loop" }
  const sourceRows = []
  for (const s of SOURCES) {
    const [ms, n] = WINDOW[s] ?? [500, 3]
    const extra = {
      ...(SRC_ARM[s] ?? {}),
      ...(SRC_DRIVE[s]
        ? { fusionDrive: SRC_DRIVE[s], fusionAnimationEnabled: SRC_DRIVE[s] !== "loop" }
        : {}),
    }
    /* THE EVENT ARM GETS ITS OWN FUSION ID, WHICH RE-ARMS THE SLOT GRID.
     *
     * Burst events are scheduled from `sinceArmed`, and the arming key is
     * `${fusionPreset}:${drive}` — so every arm in this sweep that reuses the id
     * `sweep` inherits a grid that has been running since the first one, and by
     * the time the event row is reached it can be sampled anywhere in that
     * schedule, including a run of slots whose dice did not fire. It measured
     * Δ0.599 in one run and Δ0.000 in the next with no product change between
     * them, which is the definition of an unreliable instrument. A distinct id
     * restarts the schedule at a slot boundary, exactly as selecting the preset
     * does for a user (which is why the engine arms on selection at all). */
    const armId = s === "event" ? "sweepev" : "sweep"
    const armKey = `custom:${armId}`
    if (SRC_CAMERA[s]) {
      await page.evaluate((a) => window.__captureHarness.orbitView(a[0], a[1]), SRC_CAMERA[s])
      await page.waitForTimeout(500)
    }
    if (SRC_ARM[s] && Object.keys(SRC_ARM[s]).length)
      await latchArm(extra, { customFusions: [mk(s, "ditherThreshold", 0, armId)], fusionPreset: armKey })
    else await setStyle({ ...BASE, ...extra, customFusions: [mk(s, "ditherThreshold", 0, armId)], fusionPreset: armKey })
    await page.waitForTimeout(650)
    const armRef = await grab()
    // THE SAME KNOWN-DEAD ARM as the target sweep: this source and this target
    // chosen, the amount at 0. Its two jobs and the reason the control row
    // grades it against the fixed bar are written out at the target loop above.
    const dead = await worstOver(armRef, { ...BASE, ...extra, customFusions: [mk(s, "ditherThreshold", MUTATE === "deadalive" ? 1 : 0, armId)], fusionPreset: armKey }, ms, n)
    const armFloor = Math.max(FLOOR, dead * 3)
    const armFrac = await inkFracOf(armRef)
    const patch = { ...BASE, ...extra, customFusions: [mk(s, "ditherThreshold", 1, armId)], fusionPreset: armKey }
    let d = 0
    if (s === "completion") {
      await setStyle(patch)
      await page.waitForTimeout(400)
      // Replay the draw so the completion actually happens inside the window —
      // an impulse measured in its own silence reads as a dead control.
      await page.evaluate(() => window.__revealHarness?.setProgress(0))
      await page.waitForTimeout(120)
      await page.evaluate(() => window.__revealHarness?.setProgress(1))
      for (let i = 0; i < n; i++) {
        await page.waitForTimeout(ms / n)
        const x = await inkDelta(armRef, await grab())
        if (x > d) d = x
      }
      await page.evaluate(() => window.__revealHarness?.setProgress(1))
    } else {
      d = await worstOver(armRef, patch, ms, n)
      /* A LATCHED PHASE CAN LAND ON A ZERO CROSSING, and that is not a dead
       * source — `phaseTriangle` passes through 0 twice per period by design.
       * `asciiField` read Δ0.010 in one run and Δ0.445 in another purely
       * because 2.2 s of accumulation put it in a different place on its own
       * triangle. So a field arm that comes back quiet is re-latched at a
       * different accumulation and the best of the two is taken: the claim is
       * "this source carries a signal", not "it carries one at every phase". */
      /* THREE ACCUMULATIONS, NOT ONE. A single retry still lands wherever 3.7 s
       * of phase happens to fall on the triangle, and `asciiField` duly came
       * back at Δ0.115 against a Δ0.120 floor — a working source failed by a
       * coin toss. The re-latch times are deliberately not multiples of each
       * other, so three attempts cannot all land on the same part of a period,
       * and the loop STOPS at the first one that clears: the claim is "this
       * source carries a signal", not "it carries one at every phase". */
      if (SRC_ARM[s] && Object.keys(SRC_ARM[s]).length && d <= armFloor) {
        for (const soak of [3700, 2300, 5900]) {
          await setStyle({ ...BASE, ...extra, stackAnimationType: "none", customFusions: [], fusionPreset: "none" })
          await page.waitForTimeout(soak)
          await setStyle({ ...BASE, ...extra, customFusions: [mk(s, "ditherThreshold", 0, armId)], fusionPreset: armKey })
          await page.waitForTimeout(650)
          const ref2 = await grab()
          const d2 = await worstOver(ref2, patch, ms, n)
          if (d2 > d) d = d2
          if (d > armFloor) break
        }
      }
    }
    const moved = d > armFloor
    sourceRows.push({ source: s, delta: d, dead, floor: armFloor, inkFrac: Number(armFrac.toFixed(4)), moved })
    console.log(
      `  ${moved ? "  ok" : " DEAD"}  source ${s.padEnd(14)} Δ${d.toFixed(3)} (floor ${armFloor.toFixed(3)}, dead-arm ${dead.toFixed(3)}, ink ${(armFrac * 100).toFixed(1)}%)${SRC_CAMERA[s] ? ` [camera ${SRC_CAMERA[s].join("/")}]` : ""}`,
    )
    if (SRC_CAMERA[s]) {
      // Put the framing back, or every row after this one is measured from a
      // different angle than the rows before it.
      await page.evaluate(() => window.__captureHarness.frontView())
      await page.waitForTimeout(400)
    }
  }
  const deadSources = sourceRows.filter((r) => !r.moved).map((r) => `${r.source}(${r.delta.toFixed(2)}/${r.floor.toFixed(2)})`)
  say(deadSources.length === 0, `all ${SOURCES.length} sources carry a signal`,
    deadSources.join(", ") || `${SOURCES.length}/${SOURCES.length}`)

  /* ---- THE BAR SITS BETWEEN TWO MEASUREMENTS, AND HERE IS THE LOWER ONE ----
   *
   * Every row above is an arm at amount ±1 read against the bar. This row is
   * the SAME 31 arms at amount 0 — the relationship authored and switched off —
   * read against the same bar, and every one of them has to come back UNDER it.
   *
   * WITHOUT THIS ROW THE BAR IS A TUNING. "All 21 targets clear 2.0" is only a
   * claim if something that is supposed to read 0 was put through the identical
   * path and did. It is graded against the FIXED floor rather than each arm's
   * own, because each arm's own floor is derived FROM this number and `dead <
   * max(FLOOR, dead * 3)` is true by arithmetic — a row that cannot go red.
   *
   * IT CAN GO RED TWO WAYS, AND BOTH ARE WORTH KNOWING. The engine could stop
   * honouring amount 0, or an arm's own scene could turn out noisier than the
   * perceptual floor — in which case the bar is under the noise for that arm and
   * the rows on it are not measurements. `--mutate=deadalive` forces the first. */
  const deadRows = [
    ...targetRows.map((r) => ({ name: r.target, dead: r.dead })),
    ...sourceRows.map((r) => ({ name: r.source, dead: r.dead })),
  ]
  const loudDead = deadRows.filter((r) => r.dead >= FLOOR)
  const worstDead = deadRows.reduce((a, b) => (b.dead > a.dead ? b : a))
  const passing = [...targetRows, ...sourceRows].filter((r) => r.moved)
  const weakestPass = passing.length ? passing.reduce((a, b) => (b.delta < a.delta ? b : a)) : null
  say(loudDead.length === 0,
    `KNOWN-DEAD ARM: the same relationship at amount 0 moves NOTHING on all ${deadRows.length} arms`,
    loudDead.length
      ? loudDead.map((r) => `${r.name} ${r.dead.toFixed(3)}`).join(", ") + ` — at or over the ${FLOOR.toFixed(2)} bar`
      : `loudest dead arm ${worstDead.name} ${worstDead.dead.toFixed(3)} · bar ${FLOOR.toFixed(2)} · ` +
        (weakestPass
          ? `quietest row that clears it ${(weakestPass.target ?? weakestPass.source)} ${weakestPass.delta.toFixed(3)}`
          : "NO row clears the bar — the bar has nothing above it and this row proves only that the arm is quiet"))

  /* THE DENOMINATOR, PRINTED. Every Δ above is a mean over the union of two
   * frames' alpha, and that mask is a different size on every composition — which
   * is the whole reason the old whole-frame number was twenty-one different
   * bars. A ratio whose denominator is not printed is how one got quoted against
   * the wrong floor for a month. */
  say(MASK.n > 0 && MASK.min > 0.005,
    "the ink mask every Δ is averaged over is a FORM, not a canvas and not an empty set",
    `${MASK.n} masked comparisons · mask ${(MASK.min * 100).toFixed(2)}–${(MASK.max * 100).toFixed(2)} % of the canvas, mean ${((MASK.sum / MASK.n) * 100).toFixed(2)} %`)

  /* ---- AND THEY ARE NOT ALL THE SAME SIGNAL --------------------------
   *
   * "Every source moved the picture" is satisfiable by seven sources that all
   * saturate the same parameter — which is exactly what the first run measured
   * and nearly reported as a pass (five sources returning Δ0.416 to three
   * decimals). The second run then proved worse: the three field sources and
   * draw-progress produced frames identical to 0.00 across ALL SIX pairs,
   * because a layer with its animation off pins its phase and `phaseTriangle`
   * returned +1 for every one of them. Four dropdown entries, one value.
   *
   * ASKED WHERE THE ANSWER LIVES. "Do these three read three different inputs"
   * is a question about the FUNCTION, not about the renderer — and asking it in
   * pixels needs the three layers animating, which makes every frame a moving
   * target and the comparison a phase race. So it is asked directly: run
   * `evaluateFusion` three times with the SAME state and clock, changing only
   * which signal channel carries a value, and require three different frames.
   *
   * MUTATION CONTROL: the same three calls with IDENTICAL signals must return
   * IDENTICAL frames. If that control comes back "distinct", the comparison is
   * reading something other than the signals and the rows above mean nothing. */
  const modelDistinct = (sig) => {
    const clock = { elapsed: 3.1, reveal: 1, sinceCompletion: Infinity, ...(sig.clock ?? {}) }
    const base = {
      ...S.DEFAULT_STYLE_STATE,
      motionMode: "independent",
      fusionIntensity: 1,
      fusionSwing: 1,
      fusionDrive: "loop",
      fusionAnimationSpeed: 1,
    }
    const out = {}
    for (const src of ["asciiField", "ditherField", "textureField"]) {
      const state = {
        ...base,
        fusionPreset: "custom:probe",
        customFusions: [{ id: "probe", name: "probe", glowColor: "#7ec8a0", links: [{ id: "l", source: src, target: "ditherThreshold", amount: 1 }] }],
      }
      const frame = FUS.evaluateFusion(state, clock, sig.signals, 4)
      out[src] = frame ? frame.ditherThresholdAdd : null
    }
    return out
  }
  // Three different live phases, as three animating layers would produce.
  const live = modelDistinct({ signals: { asciiTime: 1.6, ditherTime: 5.0, textureTime: 2.3 } })
  const vals = Object.values(live)
  const allDistinct = new Set(vals.map((v) => v?.toFixed(6))).size === 3
  say(allDistinct,
    "each field source reads its OWN layer's phase (three signals, three different results)",
    Object.entries(live).map(([k, v]) => `${k} ${v?.toFixed(4)}`).join(" · "))
  const same = modelDistinct({ signals: { asciiTime: 2.0, ditherTime: 2.0, textureTime: 2.0 } })
  // With three EQUAL phases the three sources still differ, because each maps
  // its phase over its own period — so the control asserts the weaker, correct
  // thing: identical INPUTS through the identical channel must agree.
  const oneChannel = ["asciiField", "ditherField", "textureField"].map((s) => {
    const f = FUS.evaluateFusion(
      {
        ...S.DEFAULT_STYLE_STATE, motionMode: "independent", fusionIntensity: 1, fusionSwing: 1,
        fusionDrive: "loop", fusionAnimationSpeed: 1, fusionPreset: "custom:probe",
        customFusions: [{ id: "probe", name: "probe", glowColor: "#7ec8a0", links: [{ id: "l", source: "asciiField", target: "ditherThreshold", amount: 1 }] }],
      },
      { elapsed: 3.1, reveal: 1, sinceCompletion: Infinity },
      { asciiTime: 2.0, ditherTime: 2.0, textureTime: 2.0 },
      4,
    )
    return f.ditherThresholdAdd
  })
  say(new Set(oneChannel.map((v) => v.toFixed(9))).size === 1,
    "MUTATION CONTROL: the same source on the same inputs returns the same value (the comparison is not noise)",
    `${oneChannel.map((v) => v.toFixed(4)).join(", ")} · equal-phase spread ${Object.values(same).map((v) => v.toFixed(3)).join("/")}`)

  /* ---- NEGATIVE CONTROL: Link 0 must kill every one of them -------------
   * The engine's documented contract is that Link 0 returns the identity frame.
   * If any target still "moves" with the coupling switched off, the readings
   * above are measuring something other than the relationship, and the whole
   * sweep is void. This is the row that makes the sweep mean anything. */
  await page.evaluate(() => window.__revealHarness?.setProgress(1))
  const ctlBase = { ...BASE, fusionIntensity: 0 }
  await setStyle({ ...ctlBase, customFusions: [mk("reveal", "gloss", 0)], fusionPreset: "custom:sweep" })
  await page.waitForTimeout(700)
  const ctlRef = await grab()
  let ctlMoved = 0
  const ctlDeltas = []
  for (const t of ["ditherThreshold", "glow", "wet", "ditherCell", "shineBand"]) {
    const d = await worstOver(ctlRef, { ...ctlBase, customFusions: [mk("reveal", t, 1)], fusionPreset: "custom:sweep" }, 500, 3)
    ctlDeltas.push(`${t} ${d.toFixed(3)}`)
    if (d > FLOOR) ctlMoved++
  }
  say(ctlMoved === 0,
    "NEGATIVE CONTROL: at Link 0 the same relationships move NOTHING (the instrument is not blind)",
    ctlDeltas.join(" · "))

  say(errors.length === 0, "no console/page errors", errors.slice(0, 2).join(" | ") || "0")

  writeFileSync(
    join(OUT, "report.json"),
    JSON.stringify(
      {
        mutate: MUTATE,
        metric: "mean |Δ| per channel over pixels where EITHER frame has alpha > 20, composited on white — diff-frames.mjs compare()",
        citedFloor: CITED_FLOOR,
        citedFrom: "scripts/verify/diff-frames.mjs:131 — also assert-fusion-two-dead.mjs ACTS, assert-screen-layers.mjs, assert-texture-relief.mjs",
        noise,
        FLOOR,
        mask: { comparisons: MASK.n, min: MASK.min, max: MASK.max, mean: MASK.n ? MASK.sum / MASK.n : 0 },
        results,
        targetRows,
        sourceRows,
        ctlDeltas,
      },
      null,
      2,
    ),
  )
  /* ═══ PROVENANCE · WAS THIS VERDICT MEASURED ON THIS RUN, ON THIS TREE? ═════
   *
   * ⚠ MEASURED 2026-08-28: this gate's capture directory was 23.5 days behind before tonight (08-04).
   * `assert-gate-integrity.mjs` channel F called that out and was right.
   *
   * THIS GATE CAN RECAPTURE — it drives the browser and rewrites the directory
   * on every invocation — so the cure for the AGE is to run it, and running it
   * is what makes the row below pass. What the row guards is the part running
   * does not cure:
   *
   *   the capture is younger than this process   what was just graded was written
   *                                              by THIS run, not left behind by
   *                                              an older one. `lib/evidence-swap.mjs`
   *                                              keeps the previous set when a run
   *                                              dies partway, which is exactly the
   *                                              case where stale frames get graded.
   *   no source moved while it ran               six lanes share this checkout
   *                                              tonight. A lib/ write landing
   *                                              mid-capture straddles two builds
   *                                              and the reading belongs to neither.
   *                                              Measured on assert-geom-offthread
   *                                              at 12:23 — a sibling lane wrote
   *                                              lib/style-fusion.ts nine seconds in,
   *                                              and three arms went red with nothing
   *                                              able to say why.
   *
   * Together they imply channel F's own test: a capture younger than a process
   * that started after every source write post-dates every source write.
   *
   * The subject is all three roots, the same three channel F compares against;
   * `captureFreshness()` walks `lib/` alone and tonight `app/` moved with it.
   * `report.json` IS this gate's own output, and it is the only artefact this
   * capture leaves on disk — there is no renderer file to compare against
   * instead. So an age check alone would certify the gate's own write, the
   * trap `assert-drawin-pentip.mjs` recorded. That is why the row asks WHEN
   * the write happened relative to this process rather than how old it is.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const capNow = newestCapture(OUT, /\.json$/)
    const subjNow = ["lib", "app", "components"]
      .map((d) => newestUnder(join(ROOT, d)))
      .filter((x) => x.file)
      .sort((x, y) => y.ms - x.ms)[0]
    const relP = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
    const stampP = (ms) => new Date(ms).toLocaleString()
    const started = performance.timeOrigin
    const landed = Boolean(capNow.file) && capNow.ms >= started
    const treeHeld = Boolean(subjNow?.file) && subjNow.ms <= started
    const detailP = !landed
      ? (capNow.file
          ? `THE CAPTURE DID NOT LAND — newest artefact ${relP(capNow.file)} ${stampP(capNow.ms)} predates this run, which started ${stampP(started)}. ` +
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-fusion-authoring.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-fusion-authoring.mjs --label=${LABEL}; do NOT relax this row.`
        : `capture ${relP(capNow.file)} ${stampP(capNow.ms)} · run started ${stampP(started)} · newest source ${relP(subjNow.file)} ${stampP(subjNow.ms)}`
    say(
      landed && treeHeld,
      "PROVENANCE · this verdict was measured on this run, against a tree that did not move under it",
      detailP,
    )
  }
  await ctx.close()
  await browser.close()
  console.log(pass ? "\nFUSION AUTHORING: ALL PASS" : "\nFUSION AUTHORING: FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
