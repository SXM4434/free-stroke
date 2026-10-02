// HAND-FEEL CAPTURE — the acceptance test, framed as Sebs framed it.
//
// "Does the word 'Desk Doodles' rendered in Inflate read as ink laid down by a
// hand, or as extruded pipe?"
//
// /desk-doodles runs Inflate by default (registers.ts:252 defaultMode:
// "inflate") and drives the real scene through the hero beat, so it is both
// the page Sebs is looking at AND the acceptance test. This drives the live
// Wobble dial from 0 (the exact font — what he was looking at) up through the
// ported Desk Doodles calibration, and captures a dense orbit at each setting
// so the marks can be JUDGED, not inferred from code.
//
// STANDING RULE: headed Chrome with Metal ANGLE. Headless silently pauses the
// rAF loop here, so a headless capture of a 3D transform is a picture of a
// frozen scene.
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
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
 * `docs/verification/handfeel`: 15 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "handfeel")
const EV = stageEvidence(FINAL)
const OUT = EV.dir

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}

/** Wobble settings to sweep. 0 = the machine. 0.4 = Desk Doodles' settled
 *  rough-handdrawn default. 0.8 / 1.2 show the headroom on the dial. */
const WOBBLES = arg("wobbles", "0,0.4,0.8,1.2").split(",").map(Number)
const ENDPOINT = arg("endpoint", "protrude")

/** Orbit poses. Flat-on is where letterforms read; the raked views are where a
 *  constant-radius tube gives itself away as pipe. */
const POSES = [
  { name: "flat", az: 0, el: 0, fill: 1.0 },
  { name: "raked-low", az: 18, el: 14, fill: 1.0 },
  { name: "raked-high", az: 34, el: 30, fill: 1.05 },
  { name: "profile", az: 62, el: 12, fill: 1.1 },
  { name: "top", az: 8, el: 58, fill: 1.1 },
]

/** Set a React-controlled range input. Assigning .value does not notify React;
 *  the native setter + an input event does.
 *
 *  NOTE: these are passed to page.evaluate as real FUNCTIONS, not strings.
 *  Playwright evaluates a string as a bare expression and never binds the
 *  argument, so a stringified arrow silently evaluates to a function object
 *  that is never called — which is exactly how this script failed the first
 *  two runs while reporting "dial not found". */
const setRange = ([labelText, value]) => {
  const labels = [...document.querySelectorAll("span")].filter(
    (s) => s.textContent.trim().toLowerCase() === labelText.toLowerCase(),
  )
  for (const lab of labels) {
    const block = lab.closest("div")?.parentElement
    const input = block?.querySelector("input[type=range]")
    if (!input) continue
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value",
    ).set
    setter.call(input, String(value))
    input.dispatchEvent(new Event("input", { bubbles: true }))
    return true
  }
  return false
}

const clickPill = (text) => {
  const b = [...document.querySelectorAll("button")].find(
    (x) => x.textContent.trim().toLowerCase() === text.toLowerCase(),
  )
  if (!b) return false
  b.click()
  return true
}

async function main() {
  EV.open()

  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 40000,
  })
  // Wait for the control panel to actually mount — the harness hooks land
  // before the sidebar does, so a fixed sleep raced it.
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("span")].some(
        (s) => s.textContent.trim().toLowerCase() === "wobble",
      ),
    null,
    { timeout: 30000 },
  )
  await page.waitForTimeout(1500)

  const endpointOk = await page.evaluate(clickPill, ENDPOINT === "long-overshoot" ? "long" : ENDPOINT)
  console.log(`[hf] endpoint pill "${ENDPOINT}" -> ${endpointOk ? "set" : "NOT FOUND"}`)

  const manifest = []
  for (const w of WOBBLES) {
    const ok = await page.evaluate(setRange, ["Wobble", w])
    if (!ok) throw new Error("could not find the Wobble dial — is the Hand section rendered?")
    // Geometry rebuild + paint.
    await page.waitForTimeout(900)

    const tag = `w${String(w).replace(".", "p")}`
    for (const pose of POSES) {
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.evaluate(
        ([az, el, fill]) => window.__captureHarness.orbitView(az, el, fill),
        [pose.az, pose.el, pose.fill],
      )
      await page.waitForTimeout(420)
      const file = `${tag}_${pose.name}.png`
      await page.screenshot({ path: join(OUT, file), fullPage: false })
      manifest.push({ wobble: w, pose: pose.name, file })
      console.log(`[hf] ${file}`)
    }
  }

  // A tight crop of the word at each wobble, flat-on — this is the frame that
  // actually answers the question, so capture it large.
  for (const w of WOBBLES) {
    await page.evaluate(setRange, ["Wobble", w])
    await page.waitForTimeout(900)
    // The page re-drives reveal+camera from its own motion sample on every
    // render, so a single set can be overwritten before the shot lands. Assert
    // twice with a beat between — the second one wins because no further
    // render is pending by then.
    for (let k = 0; k < 2; k++) {
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.evaluate(() => window.__captureHarness.orbitView(0, 0, 0.72))
      await page.waitForTimeout(450)
    }
    const file = `crop_w${String(w).replace(".", "p")}.png`
    await page.screenshot({ path: join(OUT, file) })
    manifest.push({ wobble: w, pose: "crop", file })
    console.log(`[hf] ${file}`)
  }

  writeFileSync(
    join(OUT, "manifest.json"),
    JSON.stringify({ wobbles: WOBBLES, endpoint: ENDPOINT, consoleErrors: errors, manifest }, null, 2),
  )
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\n[hf] wrote ${manifest.length} frames to ${FINAL} (console errors: ${errors.length})`)
  if (errors.length) errors.slice(0, 5).forEach((e) => console.log("   !", e))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
