// PEN-KINEMATICS CAPTURE — the acceptance test, in Sebs's own words.
//
//   "Does the word 'Desk Doodles' in Inflate read as ink laid down by a hand,
//    or as extruded pipe?"
//
// This drives /desk-doodles (which runs Inflate by default, registers.ts:252)
// through an A/B of the kinematic axis and an orbit at each setting, so the
// marks can be JUDGED from frames rather than inferred from numbers.
//
// The A/B is the whole point. "OFF" is not a hypothetical — it is exactly what
// Sebs was looking at when he said it looks machine-written: no pressure
// channel, so Inflate derives width from curvature alone and every tube is
// near enough one radius end to end.
//
// STANDING RULES honoured here:
//   · headed Chrome with --use-angle=metal. Headless silently pauses rAF on
//     this project, so a headless capture of a 3D scene is a photo of a
//     frozen one.
//   · video as well as stills, into docs/verification/ (durable). /tmp has
//     already destroyed reference material on this project.
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, existsSync, renameSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/pen-kinematics`: 38 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "pen-kinematics")
const EV = stageEvidence(FINAL)
const OUT = EV.dir

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}

/**
 * The sweep. `off` is the before-picture. `ship` is the shipped default
 * (co-articulation 0.35, modulation 0.30). The rest bracket it so the
 * judgement about raising co-articulation has frames behind it.
 */
const SETTINGS = [
  { tag: "off", label: "kinematics OFF (curvature-only width)", ov: { off: true } },
  { tag: "widthonly", label: "width only, path untouched", ov: { coarticulation: 0, inkModulation: 0.3 } },
  { tag: "ship", label: "SHIPPED DEFAULT c=0.35 m=0.30", ov: { coarticulation: 0.35, inkModulation: 0.3 } },
  { tag: "coart70", label: "co-articulation 0.70", ov: { coarticulation: 0.7, inkModulation: 0.3 } },
  { tag: "coart100", label: "co-articulation 1.00 (full reconstruction)", ov: { coarticulation: 1, inkModulation: 0.3 } },
  { tag: "ink45", label: "modulation 0.45", ov: { coarticulation: 0.35, inkModulation: 0.45 } },
]

/** Flat-on is where the letterforms read; the raked views are where a
 *  constant-radius tube gives itself away as pipe. */
const POSES = [
  { name: "flat", az: 0, el: 0, fill: 1.0 },
  { name: "raked-low", az: 18, el: 14, fill: 1.0 },
  { name: "raked-high", az: 34, el: 30, fill: 1.05 },
  { name: "profile", az: 62, el: 12, fill: 1.1 },
]

// Passed to page.evaluate as a real FUNCTION — Playwright evaluates a STRING
// as a bare expression and never binds the argument, which is how the previous
// agent's capture reported "dial not found" twice while the dial was present.
const setRange = ([labelText, value]) => {
  const labels = [...document.querySelectorAll("span")].filter(
    (s) => s.textContent.trim().toLowerCase() === labelText.toLowerCase(),
  )
  for (const lab of labels) {
    const block = lab.closest("div")?.parentElement
    const input = block?.querySelector("input[type=range]")
    if (!input) continue
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(input, String(value))
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return true
  }
  return false
}

async function main() {
  EV.open()
  const VID = join(OUT, "video")
  mkdirSync(VID, { recursive: true })

  const browser = await chromium.launch({ headed: true })
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1000 },
    recordVideo: { dir: VID, size: { width: 1600, height: 1000 } },
  })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 60000,
  })
  // The harness hooks mount before the sidebar does, so waiting on the harness
  // is not enough — wait on the control itself.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("span")].some(
        (s) => s.textContent.trim().toLowerCase() === "wobble",
      ),
    null,
    { timeout: 40000 },
  )
  await page.waitForTimeout(1800)

  const WOBBLE = Number(arg("wobble", "0.4"))
  const manifest = []

  for (const s of SETTINGS) {
    await page.evaluate((ov) => {
      window.__penKinematicsOverride = ov
    }, s.ov)
    // processedStrokes is memoised on [rawStrokes, wobble, endpoint], so the
    // override alone will not retrigger it. Nudge the dial off and back to
    // force the real rebuild through the real memo.
    await page.evaluate(setRange, ["Wobble", WOBBLE === 0 ? 0.1 : 0])
    await page.waitForTimeout(500)
    await page.evaluate(setRange, ["Wobble", WOBBLE])
    await page.waitForTimeout(1100)

    for (const pose of POSES) {
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.evaluate(
        ([az, el, fill]) => window.__captureHarness.orbitView(az, el, fill),
        [pose.az, pose.el, pose.fill],
      )
      await page.waitForTimeout(420)
      const file = `${s.tag}_${pose.name}.png`
      await page.screenshot({ path: join(OUT, file) })
      manifest.push({ tag: s.tag, pose: pose.name, file, ...s.ov })
      console.log(`[pk] ${file}`)
    }

    // The tight crop is the frame that actually answers the question.
    for (let k = 0; k < 2; k++) {
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.evaluate(() => window.__captureHarness.orbitView(0, 0, 0.7))
      await page.waitForTimeout(450)
    }
    await page.screenshot({ path: join(OUT, `crop_${s.tag}.png`) })
    // And a raked crop — width variation shows hardest across the form.
    for (let k = 0; k < 2; k++) {
      await page.evaluate(() => window.__captureHarness.orbitView(26, 22, 0.7))
      await page.waitForTimeout(400)
    }
    await page.screenshot({ path: join(OUT, `crop_raked_${s.tag}.png`) })
    console.log(`[pk] crop_${s.tag}.png + crop_raked_${s.tag}.png  (${s.label})`)
  }

  /* ---- Video: the draw-in at the shipped default -------------------------
   * The re-timed `t` channel only shows in MOTION — it is the reveal that now
   * accelerates and decelerates inside each stroke instead of crawling at
   * constant speed. Stills cannot show it, so the run records one.           */
  await page.evaluate((ov) => {
    window.__penKinematicsOverride = ov
  }, { coarticulation: 0.35, inkModulation: 0.3 })
  await page.evaluate(setRange, ["Wobble", 0])
  await page.waitForTimeout(400)
  await page.evaluate(setRange, ["Wobble", WOBBLE])
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__captureHarness.orbitView(0, 0, 0.78))
  await page.waitForTimeout(400)
  // Walk the reveal by hand so the video shows the pen laying the ink down.
  const STEPS = 150
  for (let i = 0; i <= STEPS; i++) {
    await page.evaluate((p) => window.__revealHarness.setProgress(p), i / STEPS)
    await page.waitForTimeout(28)
  }
  await page.waitForTimeout(700)

  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify({ wobble: WOBBLE, settings: SETTINGS, consoleErrors: errors, manifest }, null, 2),
  )

  await context.close()
  await browser.close()

  const vids = readdirSync(VID).filter((f) => f.endsWith(".webm"))
  if (vids.length) {
    renameSync(join(VID, vids[0]), join(VID, "drawin_ship.webm"))
    console.log(`[pk] video -> ${join(VID, "drawin_ship.webm")}`)
  }
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\n[pk] wrote ${manifest.length} frames + crops to ${FINAL} (console errors: ${errors.length})`)
  if (errors.length) errors.slice(0, 6).forEach((e) => console.log("   !", e))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
