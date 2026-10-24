// _PROBE-LANE1-SEAM-PICTURE — DRIVE THE STATE SEBS PHOTOGRAPHED AND LOOK AT IT.
//
// ── WHY A SECOND INSTRUMENT, WHEN assert-letter-seam ALREADY PASSES ────────
//
// `assert-letter-seam.mjs` is a TOPOLOGY claim: zero triangles own vertices from
// two letters, so no triangle can be stretched into a sheet across a join. That
// is exact, it needs no raster, and it reads 11 rows ALL PASS on this tree.
//
// **It says nothing about whether the PICTURE is clean.** Zero spanning
// triangles removes the stretched sheets; it does not prove the seam now reads
// as eleven objects rather than as one torn one. A letter can still show a hard
// bright edge where its own shell ends, and a count of triangles cannot see it.
// Every real bug in this repo was found by looking at 5-10x, and several were
// hidden by instruments that could not fail. So this drives HIS state:
//
//     look Desk Doodles · engine FREE STROKE · film letterByLetter ·
//     camera dead-on   · parked in SOLID, around 57 %
//
// ── AND IT IS AN A/B, BECAUSE ONE PICTURE PROVES NOTHING ──────────────────
//
// A single clean render is consistent with "the fix works" AND with "this pass
// never drove the defect". So the same frames are shot twice: with whole-triangle
// ownership ON (shipped) and with `setLetterWholeTriangles(false)` — the parked
// prior, §0.7, which is the exact per-vertex stamp that produced the slabs. The
// prior arm MUST show the shards, or this probe is measuring nothing and its
// clean arm means nothing either.
//
// The stamp is baked into the geometry, so the prior arm is followed by a real
// REBUILD (engine away and back), never a uniform write.
//
// Usage: node scripts/verify/_probe-lane1-seam-picture.mjs --label=b-now
//        [--film=letterByLetter] [--phase=solid] [--from=0.30] [--to=0.80]
//        [--steps=11] [--dsf=2]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const FILM = arg("film", "letterByLetter")
const PHASE = arg("phase", "solid")
const FROM = parseFloat(arg("from", "0.30"))
const TO = parseFloat(arg("to", "0.80"))
const STEPS = parseInt(arg("steps", "11"), 10)
const DSF = parseInt(arg("dsf", "2"), 10)
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

async function main() {
  EV.open()
  mkdirSync(join(OUT, "whole"), { recursive: true })
  mkdirSync(join(OUT, "prior"), { recursive: true })

  const browser = await chromium.launch()
  // >= 1440x1440, or the timeline dock squeezes the stage and clips the mark.
  const context = await browser.newContext({
    viewport: { width: 1600, height: 1600 },
    deviceScaleFactor: DSF,
  })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(2500)

  /* ---- HIS FOUR CHANNELS, SET THROUGH THE REAL UI AND READ BACK ---------- */
  await page.click('[data-register-option="desk-doodles"]')
  await page.waitForTimeout(1500)
  await page.click('[data-engine-option="free-stroke"]')
  await page.waitForTimeout(3500)
  const filmPill = page.locator(`[data-read-film="${FILM}"]`)
  if ((await filmPill.count()) !== 1) throw new Error(`no [data-read-film="${FILM}"] pill`)
  await filmPill.click()
  await page.waitForTimeout(3000)

  const state = await page.evaluate(() => ({
    family: document.querySelector("[data-engine-family]")?.getAttribute("data-engine-family") ?? null,
    film: document.querySelector("[data-hero-film]")?.textContent?.trim() ?? null,
    camera: document.querySelector("[data-hero-camera]")?.textContent?.trim() ?? null,
  }))
  console.log("live state:", JSON.stringify(state))
  say(state.family === "free-stroke", "engine is FREE STROKE", String(state.family))
  say(state.film === FILM, `film is ${FILM}`, String(state.film))
  say(state.camera === "deadOn", "camera is dead-on", String(state.camera))

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(220)
  }
  const readPhase = () =>
    page.evaluate(() => {
      const el = document.querySelector("[data-hero-phase]")
      return {
        phase: el?.getAttribute("data-hero-phase") ?? null,
        t: Number(el?.getAttribute("data-hero-phase-t")),
        flat: Number(document.querySelector("[data-hero-flat]")?.getAttribute("data-hero-flat")),
        yaw: Number(document.querySelector("[data-hero-yaw]")?.getAttribute("data-hero-yaw")),
      }
    })

  const total = await page.evaluate(() =>
    Number(document.querySelector("[data-hero-scrub]").getAttribute("max")),
  )
  console.log(`transport max ${total}s`)

  /* ---- FIND THE PHASE'S OWN WINDOW, rather than assuming a second --------
   * A hardcoded time is the drift class this repo has been burned by: a window
   * sized for an old beat still reads green while measuring the wrong frames.
   * So the window is derived by scanning the transport for the phase's name. */
  let lo = null
  let hi = null
  const SCAN = 240
  for (let i = 0; i <= SCAN; i++) {
    const t = (total * i) / SCAN
    await seek(t)
    const p = await readPhase()
    if (p.phase === PHASE) {
      if (lo === null) lo = t
      hi = t
    }
  }
  say(lo !== null, `the transport actually has a ${PHASE.toUpperCase()} phase`, lo === null ? "not found" : `${lo.toFixed(3)}s … ${hi.toFixed(3)}s`)
  if (lo === null) {
    await context.close()
    await browser.close()
    process.exit(1)
  }

  const times = []
  for (let k = 0; k < STEPS; k++) {
    const f = FROM + ((TO - FROM) * k) / Math.max(1, STEPS - 1)
    times.push({ f, t: lo + (hi - lo) * f })
  }

  const censusOf = () =>
    page.evaluate(() => ({
      live: window.__inflateProbe?.letterCensus?.() ?? null,
      whole: window.__captureHarness?.letterWholeTriangles?.() ?? null,
    }))

  const shoot = async (dir) => {
    const meta = []
    for (const { f, t } of times) {
      await seek(t)
      const p = await readPhase()
      const buf = await page.locator("[data-hero-stage]").screenshot()
      const name = `${PHASE}-${String(Math.round(f * 100)).padStart(3, "0")}.png`
      writeFileSync(join(OUT, dir, name), buf)
      meta.push({ name, f, t, ...p })
    }
    return meta
  }

  /* ---- ARM 1: SHIPPED (whole-triangle ownership) ------------------------- */
  const cWhole = await censusOf()
  say(cWhole.whole === true, "whole-triangle ownership is the shipped setting", String(cWhole.whole))
  say(
    !!cWhole.live && cWhole.live.spanning === 0,
    "shipped arm: NO triangle spans two letters",
    cWhole.live ? `${cWhole.live.spanning} of ${cWhole.live.triangles}` : "no census",
  )
  const metaWhole = await shoot("whole")

  /* ---- ARM 2: THE PARKED PRIOR (per-vertex ownership) -------------------- */
  const took = await page.evaluate(() => window.__captureHarness.setLetterWholeTriangles(false))
  say(took === true, "the parked prior arm can be selected", String(took))
  await page.click('[data-engine-option="desk-doodles"]')
  await page.waitForTimeout(2500)
  await page.click('[data-engine-option="free-stroke"]')
  await page.waitForTimeout(3500)
  await filmPill.click()
  await page.waitForTimeout(2500)
  const cPrior = await censusOf()
  say(cPrior.whole === false, "the prior arm actually TOOK", String(cPrior.whole))
  say(
    !!cPrior.live && cPrior.live.spanning > 0,
    "…and the prior arm really does span joins (so this A/B can fail)",
    cPrior.live ? `${cPrior.live.spanning} of ${cPrior.live.triangles}` : "no census",
  )
  const metaPrior = await shoot("prior")

  await page.evaluate(() => window.__captureHarness.setLetterWholeTriangles(true))
  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")

  writeFileSync(
    join(OUT, "seam-picture.json"),
    JSON.stringify({ state, total, phase: PHASE, window: { lo, hi }, cWhole, cPrior, metaWhole, metaPrior }, null, 2),
  )

  await context.close()
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\nframes: ${FINAL}`)
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
