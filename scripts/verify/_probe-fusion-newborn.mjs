// WHAT DOES A BRAND-NEW CUSTOM FUSION DO, ON THE PATH A PERSON ACTUALLY TAKES?
//
// Sebs, 2026-08-02: *"i can make a new custom fusion but nhting actually
// apples"*. `assert-fusion-authoring.mjs` says every source and every target is
// live, and it is not lying — it BUILDS the composition each link needs before
// it measures it (its `BASE` turns texture, dither and ASCII on). The user gets
// the composition they happen to be in. So the two are answering different
// questions, and only one of them is the product.
//
// This probe asks the product's question and nothing else: open the page, draw,
// open the Fusion panel, click "+ New fusion" — the real DOM, the real clicks —
// and measure the canvas before and after. No `setStyle`, no fabricated state.
//
//   node scripts/verify/_probe-fusion-newborn.mjs --label=before
//
// `--sheet` also writes a contact sheet of the two arms side by side.
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { PORT } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const has = (k) => process.argv.includes(`--${k}`)
const LABEL = arg("label", "run")
const OUT = join(ROOT, "docs", "verification", "fusion-newborn", LABEL)
mkdirSync(OUT, { recursive: true })

/* A mark with real interior, so a screen-space layer has somewhere to live —
 * the same stroke assert-fusion-authoring measures on, for comparability. */
function testStroke() {
  const pts = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    pts.push({ x: 140 + t * 600, y: 320 + Math.sin(t * Math.PI * 2.4) * 150 })
  }
  return [pts]
}

/* ON WHITE, BECAUSE THE PAPER IS WHITE.
 *
 * `__captureHarness.grab()` returns the WebGL canvas, which is TRANSPARENT
 * wherever the scene did not draw — the paper is the page's own background
 * (`document.body` computes `lab(100 0 0)`), not a pixel the canvas owns. The
 * first version of this probe composited onto #101010 and I read the resulting
 * contact sheet as "creating a fusion shreds the mark". It does not: that was my
 * sheet's background showing through the mark's own antialiasing. Every metric
 * and every sheet here composites onto white, so what is measured is what is on
 * screen. */
const PAPER = "#ffffff"
function onPaper(img) {
  const c = createCanvas(img.width, img.height)
  const g = c.getContext("2d")
  g.fillStyle = PAPER
  g.fillRect(0, 0, img.width, img.height)
  g.drawImage(img, 0, 0)
  return c
}

async function frameDelta(a, b) {
  const [ia, ib] = await Promise.all([loadImage(a), loadImage(b)])
  const w = Math.min(ia.width, ib.width)
  const h = Math.min(ia.height, ib.height)
  const ca = onPaper(ia)
  const cb = onPaper(ib)
  const da = ca.getContext("2d").getImageData(0, 0, w, h).data
  const db = cb.getContext("2d").getImageData(0, 0, w, h).data
  let sum = 0
  for (let i = 0; i < da.length; i += 4) {
    sum += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
  }
  return sum / (w * h * 3)
}

async function main() {
  const browser = await chromium.launch()
  // 2x device scale: the grabbed canvas is the DRAWING buffer, so this is what
  // puts the capture over the 1440 bar the dispatch requires.
  const ctx = await browser.newContext({
    viewport: { width: 1500, height: 950 },
    deviceScaleFactor: 2,
  })
  const page = await ctx.newPage()
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem("freestroke.fusions.v1")
    } catch {}
  })
  await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1500)
  if (await page.evaluate(() => !!window.__revealHarness))
    await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(500)

  const grab = async () => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    return url ? Buffer.from(url.split(",")[1], "base64") : null
  }
  const readState = () => page.evaluate(() => window.__styleHarness.get().styleState)

  const first = await grab()
  const dim = await loadImage(first)
  console.log(`  capture ${dim.width}x${dim.height}`)

  // Open the panel exactly as a person does.
  const showPanel = page.getByRole("button", { name: /Show panel|Hide panel/ })
  if ((await showPanel.textContent())?.trim() === "Show panel") await showPanel.click()
  await page.waitForTimeout(250)
  await page.getByRole("button", { name: "Fusion", exact: true }).first().click()
  await page.waitForTimeout(400)
  const body = page.locator("div.fs-panel-enter")

  /* BEFORE. Six frames over 3 s, so the "reference" is a window and not one
   * instant — the page has its own idle motion and a single frame cannot tell
   * that from the thing being measured. */
  const before = []
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500)
    before.push(await grab())
  }
  let selfNoise = 0
  for (let i = 1; i < before.length; i++) {
    const d = await frameDelta(before[0], before[i])
    if (d > selfNoise) selfNoise = d
  }

  const stBefore = await readState()

  // THE CLICK.
  await body.locator("[data-fusion-new]").click()
  await page.waitForTimeout(500)
  const stAfter = await readState()

  const after = []
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(500)
    after.push(await grab())
  }
  let worst = 0
  for (const f of after) {
    const d = await frameDelta(before[0], f)
    if (d > worst) worst = d
  }
  // And the arm's own internal travel — is the relationship MOVING, or did it
  // just land on a different constant?
  let travel = 0
  for (let i = 0; i < after.length; i++)
    for (let j = i + 1; j < after.length; j++) {
      const d = await frameDelta(after[i], after[j])
      if (d > travel) travel = d
    }

  /* THE RELATIONSHIP, ISOLATED FROM THE COMPOSITION — the number that actually
   * answers Sebs's complaint.
   *
   * Creating a fusion changes the picture twice over: it switches layers on
   * (a COMPOSITION change) and it couples them (the RELATIONSHIP). Only the
   * second is fusion, and only the second was broken. So hold everything the
   * click produced and move the Link dial between 0 and its value: the engine's
   * documented contract is that Link 0 returns the identity frame, which makes
   * this the strongest available control — same fusion, same layers, same clock,
   * coupling switched off. */
  const holdComposition = async (fusionIntensity, n = 6) => {
    await page.evaluate((v) => window.__styleHarness.setStyle({ fusionIntensity: v }), fusionIntensity)
    await page.waitForTimeout(500)
    const out = []
    for (let i = 0; i < n; i++) {
      await page.waitForTimeout(430)
      out.push(await grab())
    }
    return out
  }
  /* TWO COMPARISONS WERE TRIED AND BOTH ARE STRUCTURALLY WRONG HERE. Recorded,
   * because the third only makes sense against them:
   *
   *  1. MAX vs a reference. The composition the click produces ANIMATES — the
   *     glyph field has to scroll or the seed link's source is pinned and we are
   *     back at the defect. So two windows of the SAME configuration already
   *     differ by whatever the ASCII layer travelled: measured Δ0.253 with the
   *     coupling switched off entirely, against a coupled reading of Δ0.339.
   *     A 1.3x margin over a floor made of the subject's own motion is not a
   *     measurement of the subject.
   *  2. MIN over pairs (assert-fusion-authoring's phase-invariant comparison).
   *     It answers "is there any moment of the coupled arm that looks like any
   *     moment of the uncoupled one" — and for a driver that passes THROUGH
   *     ZERO, which `phaseTriangle` does twice per period and `breath` does
   *     twice per breath, the honest answer is YES: at that instant the coupled
   *     picture IS the uncoupled one. Measured Δ0.014 coupled against a Δ0.018
   *     floor, i.e. it scored a working relationship as beneath noise. An
   *     instrument blind to the class of thing it is pointed at is worse than
   *     no instrument, and this one is blind by construction.
   *
   *  3. WHAT WORKS: compare each arm's OWN INTERNAL TRAVEL. A relationship adds
   *     movement to the picture, so the coupled arm's spread over its window
   *     must exceed the uncoupled arm's spread over an identical window. Both
   *     numbers are measured the same way on the same composition, so the
   *     layer's own scroll is in BOTH and cancels; what is left is the coupling.
   *     It cannot be fooled by phase, because it never compares two arms frame
   *     to frame. */
  const spread = async (A) => {
    let worst = 0
    for (let i = 0; i < A.length; i++)
      for (let j = i + 1; j < A.length; j++) {
        const d = await frameDelta(A[i], A[j])
        if (d > worst) worst = d
      }
    return worst
  }
  const unlinkedA = await holdComposition(0)
  const linked = await holdComposition(stAfter.fusionIntensity)
  const coupling = await spread(linked)
  /* THE FLOOR IS MEASURED, NOT CHOSEN: the identical window with the coupling
   * switched off. The engine's documented contract is that Link 0 returns the
   * identity frame, which makes this the strongest available control — same
   * fusion, same layers, same clock, coupling off. */
  const unlinkedSpread = await spread(unlinkedA)
  await page.evaluate(
    (v) => window.__styleHarness.setStyle({ fusionIntensity: v }),
    stAfter.fusionIntensity,
  )

  writeFileSync(join(OUT, "before.png"), before[0])
  writeFileSync(join(OUT, "after.png"), after[after.length - 1])
  for (let i = 0; i < after.length; i++)
    writeFileSync(join(OUT, `after-${String(i).padStart(2, "0")}.png`), after[i])

  if (has("sheet")) {
    /* CROPPED, BECAUSE A 760px TILE OF THE WHOLE STAGE CANNOT ANSWER THE
     * QUESTION. The mark occupies about a fifth of the frame; at full-frame
     * thumbnail scale a stipple layer and a clean stroke look the same, which
     * is how the first read of this probe's sheet got the finding backwards.
     * Defaults frame the test stroke; `--crop=x,y,w,h` in fractions overrides. */
    const CROP = (arg("crop", "0.24,0.30,0.58,0.46") || "").split(",").map(Number)
    const TW = 900
    const imgs = [before[0], ...after.slice(0, 5)]
    const i0 = await loadImage(imgs[0])
    const sx = CROP[0] * i0.width
    const sy = CROP[1] * i0.height
    const sw = CROP[2] * i0.width
    const sh = CROP[3] * i0.height
    const TH = Math.round((TW * sh) / sw)
    const c = createCanvas(3 * TW, 2 * (TH + 26))
    const g = c.getContext("2d")
    g.fillStyle = "#d8d8d8"
    g.fillRect(0, 0, c.width, c.height)
    const names = ["BEFORE — no fusion", "+0.5s", "+1.0s", "+1.5s", "+2.0s", "+2.5s"]
    for (let i = 0; i < imgs.length; i++) {
      const img = await loadImage(imgs[i])
      const x = (i % 3) * TW
      const y = Math.floor(i / 3) * (TH + 26)
      g.fillStyle = PAPER
      g.fillRect(x, y + 26, TW, TH)
      g.drawImage(img, sx, sy, sw, sh, x, y + 26, TW, TH)
      g.fillStyle = "#202020"
      g.font = "16px sans-serif"
      g.fillText(names[i], x + 10, y + 18)
    }
    writeFileSync(join(OUT, "SHEET-newborn.png"), c.toBuffer("image/png"))
  }

  const report = {
    label: LABEL,
    capture: { w: dim.width, h: dim.height },
    stateBefore: {
      fusionPreset: stBefore.fusionPreset,
      ditherEnabled: stBefore.ditherEnabled,
      asciiEnabled: stBefore.asciiEnabled,
      textureEnabled: stBefore.textureEnabled,
      motionMode: stBefore.motionMode,
    },
    stateAfter: {
      fusionPreset: stAfter.fusionPreset,
      ditherEnabled: stAfter.ditherEnabled,
      asciiEnabled: stAfter.asciiEnabled,
      asciiAnimated: stAfter.asciiAnimated,
      asciiAnimationType: stAfter.asciiAnimationType,
      ditherAnimated: stAfter.ditherAnimated,
      textureEnabled: stAfter.textureEnabled,
      motionMode: stAfter.motionMode,
      fusionIntensity: stAfter.fusionIntensity,
      links: stAfter.customFusions?.[0]?.links,
    },
    selfNoise,
    worstDeltaVsBefore: worst,
    armInternalTravel: travel,
    coupling,
    unlinkedSpread,
  }
  writeFileSync(join(OUT, "report.json"), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  console.log(
    `\n  idle self-noise                 Δ${selfNoise.toFixed(3)}` +
      `\n  creating a fusion moved         Δ${worst.toFixed(3)}` +
      `\n  and the arm itself travels      Δ${travel.toFixed(3)}` +
      `\n  THE RELATIONSHIP: coupled window spread Δ${coupling.toFixed(3)} vs the SAME window at Link 0 Δ${unlinkedSpread.toFixed(3)}` +
      `  (ratio ${(coupling / Math.max(unlinkedSpread, 1e-6)).toFixed(2)}x)`,
  )
  await ctx.close()
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
