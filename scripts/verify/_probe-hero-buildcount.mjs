// _PROBE-HERO-BUILDCOUNT — is the 1.2 s dial freeze ONE build or TWO?
//
// The stall probe measured a repeatable ~1.2 s main-thread block on every
// hand-feel dial change on the Free Stroke engine (0 on Desk Doodles).
// `measure-implicit-cost.mjs` puts one full implicit build of the hero word at
// ~531 ms in plain node. 1.2 s is about two of those, and the first repetition
// recorded TWO long tasks — so the first thing to establish is the BUILD COUNT
// per gesture, because "it builds twice" is a fixable defect and "it builds once
// and that build is slow" is an architecture.
//
// `GEOM_BUILD_DEBUG.buildCount` already exists for exactly this
// (components/viewport-3d.tsx:121) and is published on the capture harness at
// :4730, so this reads the page's own counter rather than inferring anything.
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
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
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/hero-lag/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 5 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "hero-lag", arg("label", "buildcount"))
const EV = stageEvidence(FINAL)
const OUT = EV.dir

async function main() {
  EV.open()
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(1800)
  await page.click(`[data-register-option="desk-doodles"]`)
  await page.waitForTimeout(400)

  // ⚠ THE FIRST VERSION READ `window.__captureHarness.buildCount`, WHICH DOES
  // NOT EXIST. The counter is published on `window.__geomDebug` (viewport-3d.tsx
  // :4730). `undefined ?? null` then made every delta `null - null === 0`, so the
  // probe reported "0 builds per dial change" AND its own idle control also read
  // 0 — a control that could not fail, on a run that measured nothing.
  const count = async () => {
    const v = await page.evaluate(() => window.__geomDebug?.buildCount?.() ?? null)
    if (v === null) throw new Error("window.__geomDebug.buildCount is missing — this probe would measure nothing")
    return v
  }
  const setWobble = (v) =>
    page.evaluate((val) => {
      for (const inp of document.querySelectorAll('input[type="range"]')) {
        const row = inp.closest("div")?.parentElement
        if ((row?.textContent ?? "").toLowerCase().includes("wobble")) {
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          s.call(inp, String(val))
          inp.dispatchEvent(new Event("input", { bubbles: true }))
          inp.dispatchEvent(new Event("change", { bubbles: true }))
          return
        }
      }
    }, v)

  const rows = []
  for (const engine of ["free-stroke", "desk-doodles"]) {
    await page.click(`[data-engine-option="${engine}"]`)
    await page.waitForTimeout(3500)
    await setWobble(0.4)
    await page.waitForTimeout(3500)
    // CONTROL: an untouched window must add ZERO builds, or the counter is
    // firing on something other than the gesture and the deltas are noise.
    const c0 = await count()
    await page.waitForTimeout(2500)
    const cIdle = await count()
    const deltas = []
    for (let i = 0; i < 3; i++) {
      const a = await count()
      await setWobble(0.4 + 0.05 * (i + 1))
      await page.waitForTimeout(3500)
      const b = await count()
      deltas.push(b - a)
    }
    await setWobble(0.4)
    await page.waitForTimeout(3000)
    rows.push({ engine, idleDelta: cIdle - c0, perDialChange: deltas })
    console.log(
      `${engine.padEnd(14)}  idle window adds ${cIdle - c0} builds (control, must be 0)  ·  ` +
        `builds per dial change: ${deltas.join(" / ")}`,
    )
  }
  writeFileSync(join(OUT, "buildcount.json"), JSON.stringify(rows, null, 2))
  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\njson: ${FINAL}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
