// A FUSION THAT STOPS DRIVING THE SHINE BAND MUST HAND THE WHOLE BAND BACK.
//
// `lib/style-fusion.ts:768` reports the defect from the code: viewport-3d
// applies the band inside `if (fz.sweep)` and, on the else branch, restored only
// the sweep's AXIS — so `uFsSweepAmt`, `uFsSweepPos` and `uFsSweepWidth` kept
// whatever the last band-driving frame had left in them. Custom fusions work
// around it from their own side by emitting the shineBand link at strength 0;
// the built-ins (ASCII Rubber is the one that drives the band) do not.
//
// ── THE FINDING THIS FILE EXISTS TO RECORD ────────────────────────────────
// Driven on the real page, the pre-fix code RENDERED CORRECTLY ANYWAY. The
// material-animation block writes `uFsSweepAmt = 0` on every frame that is not
// a Shine Sweep, and it runs twenty lines EARLIER in the same frame, so the
// strength the fusion branch failed to release was overwritten immediately.
// The invariant was held by the execution order of two blocks that know nothing
// about each other. That is not a bug that is safe to leave — it is one refactor
// from shipping — but it does mean a `--law=prior` arm PASSES here, and this
// file prints that rather than pretending its negative control is elsewhere.
//
// So there are two parked arms and they say different things:
//   prior     the literal pre-fix branch. Rows 2 and 3 are EXPECTED to pass on
//             the strength (the material block masks it) and EXPECTED to fail on
//             the geometry, which nothing else writes.
//   hazard    the pre-fix branch with the masking line removed. Row 2 — "the
//             band is off" — MUST go red, or this instrument is blind.
//
// ── AND BOTH NOW RUN ON THE BARE INVOCATION (2026-08-07) ───────────────────
// They were `--law=prior|hazard` and no sweep passed either, so the only arm
// that could show this instrument is not blind was the arm nothing ran —
// `docs/explainers/21-losing-your-work.md` §7's rule broken, one of the nineteen
// explainer 31 counted. The flag is DELETED, per explainer 29 §5: a
// runner-passed flag only helps people who go through a runner.
//
// COST, MEASURED, because that is the deciding evidence for scheduling an arm
// elsewhere instead: 19.5 s bare → the three arms share ONE browser and one
// context (a page each, because the law is read by `addInitScript` before the
// first frame), so it is three page loads rather than three Chrome launches.
// That is well inside what a browser gate costs here — `assert-layer-flicker
// --fusion` is 304 s — so there is nothing to schedule and no skip to name.
//
// THE `prior` ARM'S ASYMMETRY IS THE EVIDENCE, not a weakness: it must redden
// row 3 and must LEAVE ROW 2 GREEN. That is the finding above — the invariant
// was being held by the execution order of two unrelated blocks — so a control
// that reddened everything would have deleted the thing this file knows.
//
// Usage: node scripts/verify/assert-sweep-release.mjs
import { chromium } from "./lib/browser.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const URL = LAB_URL

/** Two crossing strokes — enough form for a band to sit on. */
const WORD = [
  [
    { x: 220, y: 300 }, { x: 280, y: 220 }, { x: 340, y: 300 },
    { x: 400, y: 220 }, { x: 460, y: 300 },
  ],
  [
    { x: 240, y: 380 }, { x: 320, y: 360 }, { x: 400, y: 380 }, { x: 470, y: 350 },
  ],
]

let failures = 0
const record = (name, pass, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`)
  console.log(`      ${detail}`)
  if (!pass) failures++
}

const settle = (page, ms) => page.evaluate((m) => new Promise((r) => setTimeout(r, m)), ms)

async function main() {
  const browser = await chromium.launch()
  // >= 1440 in both axes, per the standing rule for this repo's captures.
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })

  /**
   * ONE ARM. The shipped law is `release`; `prior` and `hazard` are the two
   * known-bads the header describes, and they run on every invocation now.
   *
   * Each arm needs its OWN page because `addInitScript` has to land before the
   * first frame — but they share the browser and the context, so the extra cost
   * is a page load, not a Chrome launch.
   */
  async function runArm(LAW) {
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(e.message))

  // BEFORE navigation: R3F reads the law inside the frame loop, but setting it
  // first means no frame ever runs on the wrong arm.
  await page.addInitScript((law) => {
    window.__fsSweepLaw = law
  }, LAW)

  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => !!window.__styleHarness && !!window.__geomDebug, {
    timeout: 30000,
  })
  await page.evaluate((w) => window.__styleHarness.injectStrokes(w), WORD)
  await settle(page, 1500)

  /* `motionMode: "off"` FREEZES every fusion choreography (viewport-3d
   * :1664-1672). Without it Terminal Gel breathes, and two reads taken at two
   * wall-clock moments are two phases of one animation — an earlier version of
   * this probe read median luma 21.8 vs 174.8 that way and it meant nothing. */
  const arm = async (preset, extra = {}) => {
    await page.evaluate(
      ([p, x]) => {
        window.__styleHarness.setStyle({
          fusionPreset: p,
          fusionEnabled: p !== "none",
          asciiEnabled: true,
          motionMode: "off",
          ...x,
        })
      },
      [preset, extra],
    )
    await settle(page, 600)
  }

  const band = () => page.evaluate(() => window.__geomDebug.sweepBand())
  const shot = () =>
    page.evaluate(() => {
      // THE LAST canvas: `/` mounts the 2-D drawing canvas before the WebGL
      // viewport, and reading the first one measures the drawing surface.
      const all = [...document.querySelectorAll("canvas")]
      const c = all[all.length - 1]
      const g = document.createElement("canvas")
      g.width = c.width
      g.height = c.height
      const ctx = g.getContext("2d")
      ctx.drawImage(c, 0, 0)
      const d = ctx.getImageData(0, 0, g.width, g.height).data
      return Array.from(d)
    })

  const compare = (a, b) => {
    let n = 0
    let worst = 0
    for (let i = 0; i < a.length; i += 4) {
      const dr = Math.abs(a[i] - b[i])
      const dg = Math.abs(a[i + 1] - b[i + 1])
      const db = Math.abs(a[i + 2] - b[i + 2])
      const m = Math.max(dr, dg, db)
      if (m > 2) n++
      if (m > worst) worst = m
    }
    return { differing: n, total: a.length / 4, worst }
  }

  /* ---- ARM A: Terminal Gel reached FRESH ---- */
  await arm("none")
  await arm("terminalGel")
  const fresh = await shot()

  /* ---- ARM B: Terminal Gel reached FROM the band-driving fusion ---- */
  await arm("none")
  await arm("asciiRubber")
  const driving = await band()
  await arm("terminalGel")
  const released = await band()
  const after = await shot()

  const diff = compare(fresh, after)
  await page.close()

  /* THE FOUR JUDGEMENTS, as data. The shipped arm prints them as rows; the two
   * control arms DO NOT — a control run makes rows red on purpose and both
   * battery runners count an indented `FAIL`, so echoing a control's rows would
   * post this gate's own evidence as its failures (Lane I's finding on
   * `assert-hero-transition`). Only the one-line control verdict is printed. */
  return [
    {
      key: "1",
      name: "1 · the instrument can see a band at all — ASCII Rubber drives it",
      ok: driving.amt > 0.05 && driving.source === "fusion",
      detail: `amt ${driving.amt.toFixed(4)} · source ${driving.source} · pos ${driving.pos.toFixed(3)} · dir (${driving.dirX.toFixed(2)}, ${driving.dirY.toFixed(2)})`,
    },
    {
      key: "2",
      name: "2 · the band is OFF after switching to a fusion that does not drive it",
      ok: released.amt === 0 && released.source !== "fusion",
      detail: `amt ${released.amt.toFixed(4)} · source ${released.source}`,
    },
    {
      key: "3",
      name: "3 · and its GEOMETRY is released too, not just its strength",
      ok: released.pos === -10 && Math.abs(released.width - 0.3) < 1e-6,
      detail: `pos ${released.pos.toFixed(3)} (want -10) · width ${released.width.toFixed(3)} (want 0.3) · dir (${released.dirX.toFixed(2)}, ${released.dirY.toFixed(2)})`,
    },
    {
      key: "4",
      name: "4 · the PICTURE is the same as arriving there fresh",
      ok: diff.differing / diff.total < 0.001,
      detail: `${diff.differing} of ${diff.total} px differ by >2 (${((100 * diff.differing) / diff.total).toFixed(4)} %), worst channel delta ${diff.worst}`,
    },
    {
      key: "5",
      name: "5 · console clean",
      ok: errors.length === 0,
      detail: `${errors.length} page errors${errors.length ? ": " + errors[0] : ""}`,
    },
  ]
  }

  /* ---- THE SHIPPED LAW ---- */
  const real = await runArm("release")
  for (const v of real) record(v.name, v.ok, v.detail)

  /* ---- THE TWO PARKED ARMS, required to fail in the ways the header states ---- */
  const control = (ok, label, detail) => {
    if (!ok) failures++
    console.log(`${ok ? "PASS" : "FAIL"}  CONTROL · ${label}`)
    console.log(`      ${detail}`)
  }
  const reds = (rows) => rows.filter((v) => !v.ok).map((v) => v.key)
  const at = (rows, k) => rows.find((v) => v.key === k)

  const prior = await runArm("prior")
  control(
    !at(prior, "3").ok && at(prior, "2").ok,
    "KNOWN-BAD `prior` — the literal pre-fix branch — is REJECTED by row 3, and row 2 correctly SURVIVES it",
    `red: [${reds(prior).join(" ") || "NONE — THIS INSTRUMENT IS BLIND"}] (want 3 red, 2 green). ` +
      `row 3 read: ${at(prior, "3").detail}. row 2 read: ${at(prior, "2").detail} — the material block ` +
      `zeroes the strength twenty lines earlier in the same frame, which is exactly the finding in ` +
      `this file's header and the reason `.concat("`prior` alone cannot certify this gate."),
  )

  const hazard = await runArm("hazard")
  control(
    !at(hazard, "2").ok,
    "KNOWN-BAD `hazard` — the pre-fix branch WITHOUT the masking line — is REJECTED by row 2",
    `red: [${reds(hazard).join(" ") || "NONE — THIS INSTRUMENT IS BLIND"}] (want 2 red). ` +
      `row 2 read: ${at(hazard, "2").detail}. This is the only arm that can show row 2 able to say no.`,
  )

  await browser.close()
  console.log(failures === 0 ? "\nall rows passed" : `\n${failures} row(s) failed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
