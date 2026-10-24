// _probe-video-route.mjs — DRIVE THE "Video Preview Export" VIEW PRESET FOR REAL,
// and prove the four things a multi-second file-writing control owes the user.
//
// The route is one `else if` in `applyViewPresetById` (app/page.tsx) reaching an
// export that has existed since 2026-08-01. What makes it safe to ship is not
// the line, it is that the export it reaches already:
//
//   1 · SAYS WHAT IT WILL DO FIRST — the pill's tooltip is the preset's own
//       description, and `handleExportVideo` opens a toast before frame one.
//   2 · SHOWS PROGRESS — that same toast counts frames to 100 %.
//   3 · CANNOT BE STARTED TWICE — one re-entrancy guard at the top of
//       `handleExportVideo`, where BOTH callers pass through.
//   4 · REPORTS WHERE THE FILE WENT, AND REPORTS FAILURE.
//
// Every row here is settled on an artefact — the DOM's own toast text, the count
// `window.__fsVideoExportRuns`, the bytes the browser downloaded — never on this
// script's summary of what it did.
//
// THE MUTATION ARM IS THE POINT OF THE FILE. `--reentry=allow` sets
// `window.__fsExportReentry = "allow"`, the parked prior in which the guard does
// not run, and REQUIRES the guard's row to break. A guard whose test cannot go
// red is the defect this repo has caught eleven times.
//
//   node scripts/verify/_probe-video-route.mjs                    # the shipped guard
//   node scripts/verify/_probe-video-route.mjs --reentry=allow    # the parked prior — must FAIL row 3
//   node scripts/verify/_probe-video-route.mjs --fail=grab        # the FAILURE PATH, forced
//
// Needs `pnpm dev` (FS_PORT, default 3000). Real Chrome, --use-angle=metal:
// without it Chrome falls back to SwiftShader and silently pauses the rAF loop,
// which this export awaits two of per frame.
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { LAB_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "video-route")
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}
const REENTRY = arg("reentry", "guard") // "guard" (shipped) | "allow" (parked prior)
const FAILARM = arg("fail", "") // "" | "grab" — force the failure path
/* THE THIRD OUTCOME. Success and failure both replace the progress toast; CANCEL
 * is the one that nearly did not, and the reason is worth a flag of its own —
 * see the note beside `toast.dismiss` in components/viewport-3d.tsx. */
const CANCEL = process.argv.includes("--cancel")
const LABEL = arg("label", CANCEL ? "cancel" : REENTRY === "allow" ? "reentry-allow" : FAILARM ? `fail-${FAILARM}` : "shipped")
const BASE = LAB_URL

let fails = 0
let checks = 0
const rows = []
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  rows.push({ ok, label, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/** Every toast currently on screen, as text. The announcement, the progress and
 *  the outcome are all one sonner toast (one id, replaced in place), so this is
 *  the only surface that has to be read to judge three of the four claims. */
const toasts = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[data-sonner-toast]")].map((t) => t.textContent.replace(/\s+/g, " ").trim()),
  )

function testStroke() {
  const pts = []
  for (let i = 0; i <= 90; i++) {
    const t = i / 90
    pts.push({ x: 170 + t * 520, y: 350 + Math.sin(t * Math.PI * 1.7) * 110 })
  }
  return [pts]
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, acceptDownloads: true })
const page = await context.newPage()
const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)))

/* The laws go on before navigation for the ones read at module scope, and again
 * after load for the ones read per call — `readDevLaw` reads `window` at the
 * moment of the call, so setting them here is enough and is what the app's other
 * law-driven gates do. */
await page.addInitScript(
  ({ reentry, failArm }) => {
    if (reentry === "allow") window.__fsExportReentry = "allow"
    /* THE FAILURE PATH, FORCED. `__fsExportFailAtFrame` makes the host's
     * `grabFrame` hand back null at that GRAB — a real failure mode (a lost GL
     * context does exactly this), answered by the recorder with a real message.
     * Grabs and plan frames differ by one: `exportAnimation` takes a probe grab
     * first to size the encoder, so 3 kills plan index 1 — late enough that the
     * run has genuinely started and encoded a frame, early enough that the whole
     * arm costs under a second. */
    if (failArm === "grab") window.__fsExportFailAtFrame = 3
  },
  { reentry: REENTRY, failArm: FAILARM },
)
await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness && window.__revealHarness, null, {
  timeout: 240000,
})
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
await page.waitForTimeout(1800)

/* ── 1 · IT SAYS WHAT IT WILL DO, BEFORE THE CLICK ───────────────────────────
 * Read off the shipped pill in the shipped panel, not off the preset table — a
 * description that never reaches a tooltip is a description nobody sees. */
/* The Presets panel opens from the summary strip and that is the ONLY way in —
 * the same click a user makes, and the same one `assert-preset-routing` uses. A
 * probe that read the preset table instead of the panel would be reading a
 * description no user is shown. */
await page.getByRole("button", { name: /^Preset/ }).click()
await page.waitForTimeout(400)
await page.evaluate(() => {
  const sel = [...document.querySelectorAll("select")].find((s) =>
    [...s.options].some((o) => o.textContent === "Material"),
  )
  if (!sel) return
  const opt = [...sel.options].find((o) => o.textContent === "View / Export")
  sel.value = opt.value
  sel.dispatchEvent(new Event("change", { bubbles: true }))
})
await page.waitForTimeout(400)
const pill = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith("Video Preview Export"))
  return b ? { title: b.title, disabled: b.disabled } : null
})
say(
  !!pill && !pill.disabled,
  "the pill is SELECTABLE — the blocker that used to grey it out is gone with the route",
  pill ? `disabled=${pill.disabled}` : "PILL NOT FOUND — is the View / Export family on the rail?",
)
say(
  !!pill && /\brender/i.test(pill.title) && /\bframe/i.test(pill.title) && /(saved|download|file)/i.test(pill.title),
  "…and it SAYS WHAT IT WILL DO before it is clicked — a frame-by-frame render that writes a file",
  pill ? JSON.stringify(pill.title) : "-",
)

/* ── 2 · IT ANNOUNCES, THEN SHOWS PROGRESS ───────────────────────────────────*/
await page.evaluate(() => {
  window.__fsVideoExportRuns = 0
})
const dlPromise = page.waitForEvent("download", { timeout: 240000 }).catch(() => null)
const routed = await page.evaluate(() => window.__styleHarness.selectViewPreset("videoPreviewExport"))
say(routed === true, "the route RAN — selectViewPreset('videoPreviewExport') returned true", `returned ${routed}`)

/* The announcement is asserted BEFORE any frame can have finished. */
await page.waitForFunction(
  () => [...document.querySelectorAll("[data-sonner-toast]")].some((t) => /Rendering the film/i.test(t.textContent)),
  null,
  { timeout: 20000 },
)
const announce = await toasts(page)
say(
  announce.some((t) => /Rendering the film/i.test(t) && /(few seconds|downloads)/i.test(t)),
  "it ANNOUNCES the wait as soon as it starts — the click is not silent for eight seconds",
  JSON.stringify(announce.find((t) => /Rendering the film/i.test(t))?.slice(0, 150) ?? announce),
)

/* PROGRESS: the same toast has to reach a percentage that is neither 0 nor 100,
 * i.e. it is genuinely counting rather than showing a spinner that flips at the
 * end. Sampled while the export runs. */
/* ⚠ THE MID-RENDER ROWS NEED A MID-RENDER, so the forced-failure arm — which
 * kills the export inside a second, on purpose — skips them rather than
 * reporting them red. They are SAID to be skipped and why, because "we did not
 * look" must never read the same as "it is fine". */
if (FAILARM || CANCEL) {
  console.log(
    `SKIP  the progress and re-entrancy rows — --${FAILARM ? `fail=${FAILARM}` : "cancel"} ends the render early on purpose, so ` +
      "there is no full mid-render to sample. They are judged on the shipped arm and on --reentry=allow.",
  )
} else {
  const seenPct = new Set()
  for (let i = 0; i < 120; i++) {
    const t = await toasts(page)
    for (const s of t) {
      const m = s.match(/Rendering the film, (\d+)%/)
      if (m) seenPct.add(Number(m[1]))
    }
    if (await page.evaluate(() => !document.querySelector("[data-sonner-toast]") || /Saved/.test(document.body.textContent))) break
    if (seenPct.size >= 3) break
    await page.waitForTimeout(120)
  }
  const mid = [...seenPct].filter((p) => p > 0 && p < 100)
  say(
    mid.length > 0,
    "…and it SHOWS PROGRESS — the same toast counts frames while the render runs",
    `percentages seen mid-render: ${[...seenPct].sort((a, b) => a - b).join(", ") || "none"}`,
  )

  /* ── 3 · IT CANNOT BE STARTED TWICE ────────────────────────────────────────
   * The second click lands while the first is provably in flight. The verdict is
   * a COUNT incremented past the guard, not a screenshot of a toast. */
  await page.waitForFunction(() => window.__fsVideoExportRuns >= 1, null, { timeout: 30000 })
  const secondRouted = await page.evaluate(() => window.__styleHarness.selectViewPreset("videoPreviewExport"))
  await page.waitForTimeout(800)
  const runsAfterSecond = await page.evaluate(() => window.__fsVideoExportRuns)
  const refusalToast = (await toasts(page)).find((t) => /already rendering/i.test(t))
  say(
    runsAfterSecond === 1,
    "a second click MID-RENDER starts NOTHING — one export at a time",
    `__fsVideoExportRuns = ${runsAfterSecond} after two clicks (route returned ${secondRouted} both times, because the refusal belongs to the export) · reentry law: ${REENTRY}`,
  )
  say(
    !!refusalToast,
    "…and the refusal SAYS SO rather than swallowing the click",
    refusalToast ? JSON.stringify(refusalToast.slice(0, 160)) : "no 'already rendering' toast on screen",
  )
}

/* ── 3b · THE THIRD OUTCOME: THE USER STOPS IT ───────────────────────────────
 * Pressed through the export bar's own Video button, which becomes the cancel
 * while a render is running — the affordance a user actually has. The claim is
 * not "an error appeared": it is that the progress toast STOPS, because a
 * cancelled job that goes on spinning is the one state where the UI is arguing
 * with a decision the user has already made. */
if (CANCEL) {
  /* The bar's Video button becomes the cancel WHILE a render runs, so this waits
   * for that state rather than for a fixed delay — a click that lands before the
   * button flips would be testing the wrong control. */
  const stop = page.locator('button[title="Stop the export"]')
  await stop.waitFor({ state: "visible", timeout: 60000 })
  say(true, "the export bar's Video button became the CANCEL while the render ran", "button[title='Stop the export'] present")
  await stop.click()
  await page
    .waitForFunction(
      () => [...document.querySelectorAll("[data-sonner-toast]")].some((t) => /cancelled/i.test(t.textContent)),
      null,
      { timeout: 30000 },
    )
    .catch(() => {})
  await page.waitForTimeout(500)
  const after = await toasts(page)
  const spinners = await page.evaluate(
    () => document.querySelectorAll("[data-sonner-toast][data-type='loading'], [data-sonner-toast] .sonner-loading-wrapper[data-visible='true']").length,
  )
  say(
    after.some((t) => /cancelled/i.test(t)),
    "CANCEL · pressing the counting button stops the export and SAYS it stopped",
    JSON.stringify(after.find((t) => /cancelled/i.test(t))?.slice(0, 150) ?? after),
  )
  say(
    spinners === 0 && !after.some((t) => /Rendering the film/i.test(t)),
    "…and NO SPINNER SURVIVES IT — the progress toast is gone, not merged into the receipt",
    `${spinners} loading toast(s) still on screen · ${after.length} toast(s) total`,
  )
  const clock = await page.evaluate(() => window.__geomDebug?.styleClock?.()?.source ?? "unknown")
  say(clock !== "driven", "CONTROL · the style clock is released on the cancel path too", `styleClock source: ${clock}`)
  const ph = await page.evaluate(() => window.__revealHarness.getProgress())
  say(Math.abs(ph - 1) < 0.02, "CONTROL · and the reveal is back where it was", `progress ${ph.toFixed(4)}`)
  say(pageErrors.length === 0, "no uncaught page errors across the run", pageErrors[0] ?? "0")
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, `${LABEL}.json`), JSON.stringify({ label: LABEL, cancel: true, checks, fails, rows }, null, 2))
  await page.screenshot({ path: join(OUT, `${LABEL}.png`) })
  await browser.close()
  console.log(`\n${fails === 0 ? `ALL ${checks} ROWS PASS` : `${fails} of ${checks} ROWS FAILED`}  ·  arm: cancel`)
  process.exit(fails === 0 ? 0 : 1)
}

/* ── 4 · IT REPORTS WHERE THE FILE WENT — OR WHY IT DID NOT ──────────────────*/
const dl = FAILARM ? null : await dlPromise
const dlPath = dl ? await dl.path() : null
const bytes = dlPath ? readFileSync(dlPath) : null
const isWebm = !!bytes && bytes.length > 4 && bytes.readUInt32BE(0) === 0x1a45dfa3
const isPng = !!bytes && bytes.length > 8 && bytes.readUInt32BE(0) === 0x89504e47
if (!FAILARM) {
  say(
    !!bytes && (isWebm || isPng) && bytes.length > 2000,
    "a REAL FILE lands — the container is what the encoder claims, not an empty blob",
    `${dl ? dl.suggestedFilename() : "NO DOWNLOAD"} · ${bytes ? bytes.length : 0} bytes · ${
      isWebm ? "EBML/WebM magic" : isPng ? "PNG/APNG magic" : "unrecognised"
    }`,
  )
}
await page
  .waitForFunction(
    () => [...document.querySelectorAll("[data-sonner-toast]")].some((t) => /Saved |failed|cancelled/i.test(t.textContent)),
    null,
    { timeout: 60000 },
  )
  .catch(() => {})
const done = await toasts(page)
const outcome = done.find((t) => /Saved |Video export failed|Export cancelled/i.test(t))
say(
  !!outcome,
  "…and the SAME toast becomes the receipt — it names the file, or it names the failure",
  outcome ? JSON.stringify(outcome.slice(0, 190)) : JSON.stringify(done),
)
if (FAILARM === "grab") {
  /* THE FAILURE PATH, JUDGED. Not "an error appeared" — the message has to name
   * the actual fault, because "Video export failed" with no reason is the same
   * silence with a red icon on it. */
  say(
    !!outcome && /Video export failed/i.test(outcome) && /returned no frame at index/i.test(outcome),
    "THE FAILURE PATH REPORTS HONESTLY — the toast names the fault, not just that there was one",
    outcome ? JSON.stringify(outcome.slice(0, 190)) : "no outcome toast",
  )
  say(
    !bytes,
    "CONTROL · a failed export writes NOTHING — no half-file lands in Downloads",
    dl ? `a download arrived anyway: ${dl.suggestedFilename()}` : "no download",
  )
  const clockAfter = await page.evaluate(() => window.__geomDebug?.styleClock?.()?.source ?? "unknown")
  say(
    clockAfter !== "driven",
    "CONTROL · the style clock is released on the failure path too — a dead export must not freeze the page's layers",
    `styleClock source after the failure: ${clockAfter}`,
  )
}
say(
  !done.some((t) => /Rendering the film/i.test(t)),
  "CONTROL · no progress toast is left hanging beside the receipt — one toast for the run, replaced in place",
  `${done.length} toast(s) on screen at the end`,
)

/* ── 5 · THE PLAYHEAD GOES BACK ──────────────────────────────────────────────*/
const playhead = await page.evaluate(() => window.__revealHarness.getProgress())
say(
  Math.abs(playhead - 1) < 0.02,
  "the export put the reveal back where it found it — pressing Save did not move the scrubber",
  `progress ${playhead.toFixed(4)}`,
)

say(pageErrors.length === 0, "no uncaught page errors across the run", pageErrors[0] ?? "0")

mkdirSync(OUT, { recursive: true })
writeFileSync(
  join(OUT, `${LABEL}.json`),
  JSON.stringify({ label: LABEL, reentry: REENTRY, failArm: FAILARM, checks, fails, rows }, null, 2),
)
await page.screenshot({ path: join(OUT, `${LABEL}.png`) })
await browser.close()

console.log(
  `\n${fails === 0 ? `ALL ${checks} ROWS PASS` : `${fails} of ${checks} ROWS FAILED`}  ·  arm: reentry=${REENTRY}${FAILARM ? ` fail=${FAILARM}` : ""}`,
)
if (REENTRY === "allow") {
  console.log(
    "⚠ THIS IS THE PARKED PRIOR ARM. The guard is switched OFF, so the " +
      '"a second click starts NOTHING" row MUST be red. A green run here means the ' +
      "guard's test is measuring nothing.",
  )
  process.exit(fails > 0 ? 0 : 1)
}
process.exit(fails === 0 ? 0 : 1)
