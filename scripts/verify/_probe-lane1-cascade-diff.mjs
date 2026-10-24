// _PROBE-LANE1-CASCADE-DIFF — WHERE, IN THE WHOLE FILM, DO THE TWO ARMS DIFFER?
//
// ── WHY THIS EXISTS ───────────────────────────────────────────────────────
//
// `assert-letter-seam.mjs` proves a TOPOLOGY claim (0 spanning triangles) and
// `_probe-lane1-seam-picture.mjs` shot the state the source comment names —
// `letterByLetter`, FREE STROKE, SOLID 57 % — and the PARKED PRIOR rendered
// CLEAN there. A prior arm that shows no defect is a negative control that did
// not fire, and a clean shipped arm beside it proves nothing at all.
//
// So instead of trusting the phase named in the comment, this LOCATES the tear:
// it shoots the SAME times on both arms across the ENTIRE transport and reports,
// per frame, how many pixels disagree. Whole-triangle ownership changes nothing
// except at a letter boundary that is mid-flip, so the disagreement IS the
// shard, and its peak is the frame to look at.
//
// A frame where the two arms agree to zero pixels is a frame where this fix does
// nothing — which is most of the film, and saying so is the point.
//
// ── WHICH CONTROL IS BEING SWEPT ─────────────────────────────────────────
//
// `--arm=whole`  toggles `setLetterWholeTriangles` (the triangle census fix).
// `--arm=settle` toggles `setLetterSettle` — whether a LANDED letter turns about
//                the word's axis or its own. That is the one that decides the
//                settled hold: with it off, every join is pulled open by
//                `(I − R)·Δpivot` and stays open for the whole 2.2 s SOLID beat.
//
// A uniform write takes on the next FRAME; a baked stamp takes on the next
// BUILD. `settle` is the former and `whole` the latter, so only `whole` is
// followed by a real rebuild — driving a rebuild for a uniform would be slower
// and, worse, would suggest the two controls work the same way.
//
// Usage: node scripts/verify/_probe-lane1-cascade-diff.mjs --label=cascade
//        [--arm=whole|settle] [--film=letterByLetter] [--steps=155] [--dsf=1]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { stageEvidence } from "./lib/evidence-swap.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "cascade")
const FILM = arg("film", "letterByLetter")
const STEPS = parseInt(arg("steps", "155"), 10)
const ARM = arg("arm", "whole")
if (ARM !== "whole" && ARM !== "settle") throw new Error(`--arm must be whole|settle, got ${ARM}`)
const DSF = parseInt(arg("dsf", "1"), 10)
const PORT = process.env.FS_PORT || "3000"
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/letter-seam-picture/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 969 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "letter-seam-picture", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function rgba(path) {
  const img = await loadImage(path)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  return { d: x.getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height }
}

async function main() {
  EV.open()
  mkdirSync(join(OUT, "whole"), { recursive: true })
  mkdirSync(join(OUT, "prior"), { recursive: true })

  const browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1600 },
    deviceScaleFactor: DSF,
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  await page.click('[data-register-option="desk-doodles"]')
  await page.waitForTimeout(1500)
  await page.click('[data-engine-option="free-stroke"]')
  await page.waitForTimeout(3500)
  const filmPill = page.locator(`[data-read-film="${FILM}"]`)
  await filmPill.click()
  await page.waitForTimeout(3000)

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(170)
  }
  const total = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").getAttribute("max")))
  const times = []
  for (let k = 0; k < STEPS; k++) times.push((total * k) / (STEPS - 1))

  const shoot = async (dir) => {
    const meta = []
    for (let k = 0; k < times.length; k++) {
      await seek(times[k])
      const info = await page.evaluate(() => {
        const el = document.querySelector("[data-hero-phase]")
        return {
          phase: el?.getAttribute("data-hero-phase") ?? null,
          pt: Number(el?.getAttribute("data-hero-phase-t")),
        }
      })
      const buf = await page.locator("[data-hero-stage]").screenshot()
      const name = `${String(k).padStart(3, "0")}.png`
      writeFileSync(join(OUT, dir, name), buf)
      meta.push({ k, t: times[k], name, ...info })
    }
    return meta
  }

  const readArm = () =>
    page.evaluate(() => ({
      whole: window.__captureHarness?.letterWholeTriangles?.() ?? null,
      settle: window.__captureHarness?.letterSettle?.() ?? null,
      span: window.__inflateProbe?.letterCensus?.()?.spanning ?? null,
    }))

  const cw = await readArm()
  say(
    ARM === "whole" ? cw.whole === true && cw.span === 0 : cw.settle === true,
    `shipped arm is selected (${ARM})`,
    JSON.stringify(cw),
  )
  const metaWhole = await shoot("whole")

  if (ARM === "whole") {
    await page.evaluate(() => window.__captureHarness.setLetterWholeTriangles(false))
    // The stamp is BAKED into the geometry, so this arm needs a real rebuild.
    await page.click('[data-engine-option="desk-doodles"]')
    await page.waitForTimeout(2500)
    await page.click('[data-engine-option="free-stroke"]')
    await page.waitForTimeout(3500)
    await filmPill.click()
    await page.waitForTimeout(2500)
  } else {
    // A UNIFORM. It takes on the next frame — no rebuild, and asserting that it
    // took is what stops a sweep capturing the same arm twice.
    await page.evaluate(() => window.__captureHarness.setLetterSettle(false))
    await page.waitForTimeout(400)
  }
  const cp = await readArm()
  say(
    ARM === "whole" ? cp.whole === false && cp.span > 0 : cp.settle === false,
    `the parked prior arm actually TOOK (${ARM})`,
    JSON.stringify(cp),
  )
  const metaPrior = await shoot("prior")

  await page.evaluate(() => {
    window.__captureHarness.setLetterWholeTriangles(true)
    window.__captureHarness.setLetterSettle(true)
  })
  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  await context.close()
  await browser.close()

  /* ---- THE DIFF ---------------------------------------------------------- */
  const rows = []
  let peak = { diff: -1 }
  for (let k = 0; k < times.length; k++) {
    const name = `${String(k).padStart(3, "0")}.png`
    const A = await rgba(join(OUT, "whole", name))
    const B = await rgba(join(OUT, "prior", name))
    let diff = 0
    let worst = 0
    for (let i = 0; i < A.d.length; i += 4) {
      const d = Math.max(
        Math.abs(A.d[i] - B.d[i]),
        Math.abs(A.d[i + 1] - B.d[i + 1]),
        Math.abs(A.d[i + 2] - B.d[i + 2]),
      )
      if (d > 12) diff++
      if (d > worst) worst = d
    }
    const row = { k, t: +times[k].toFixed(3), phase: metaWhole[k].phase, pt: metaWhole[k].pt, diff, worst }
    rows.push(row)
    if (diff > peak.diff) peak = { ...row }
    if (diff > 0) console.log(`  ${String(k).padStart(3)}  t=${row.t.toFixed(2)}s  ${String(row.phase).padEnd(12)} ${String(row.pt).padStart(5)}   DIFF ${String(diff).padStart(6)} px   worst Δ ${worst}`)
  }
  writeFileSync(join(OUT, "cascade-diff.json"), JSON.stringify({ total, rows, peak }, null, 2))

  const any = rows.filter((r) => r.diff > 0).length
  say(any > 0, "the two arms DO disagree somewhere in the film — the control fires", `${any} of ${rows.length} frames differ · peak ${peak.diff} px at t=${peak.t}s (${peak.phase} ${peak.pt})`)
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\nframes: ${FINAL}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
