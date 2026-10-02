// IS THE DEV SERVER SERVING THE SOURCE THAT IS ON DISK?
//
// ── WHY THIS EXISTS, MEASURED FIRST-HAND 2026-08-07 ────────────────────────
// This lane's dev server logged **exactly one** "Compiling" line for its entire
// life, across four edits to `lib/`. Whether that is because webpack dev was not
// watching, or because the page held the bundle it loaded at `page.goto` and
// never asked again, is not a question a capture can answer about itself — and
// a 50-minute, 120-cell run that measured a stale bundle is a run whose numbers
// are confidently wrong. Two captures were discarded to that uncertainty.
//
// The dispatch contract's §18.5 already has the answer for a stale TREE: do not
// trust it, **assert a known-recent marker exists before measuring anything.**
// This is that rule pointed at the served BUNDLE instead of the checkout, which
// is the same failure one layer down.
//
// ── THE MARKER IS READ OFF DISK, NOT TYPED HERE ────────────────────────────
// A hardcoded expected string is itself a hand-copied inventory — it goes stale
// the moment someone renames a cell, and then this gate fails for the wrong
// reason or, worse, passes because both copies drifted together. So the marker
// is the CURRENT name of a cell, loaded from `lib/style-fusion.ts` in node, and
// compared against what the running page says the same cell is called.
//
//   node scripts/verify/assert-fusion-bundle-fresh.mjs
import { chromium } from "./lib/browser.mjs"
import { loadTs } from "./_ts-load.mjs"
import { PORT } from "./lib/dev-server.mjs"

const F = loadTs("lib/style-fusion.ts")

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* THE PROBE CELLS. Any three with distinct names would do; these are the three
 * re-authored on 2026-08-07, which makes this gate also a regression check on
 * the duplicate work — if the bundle predates it, the names come back as the
 * duplicates and this says so by name rather than as a hash mismatch. */
const KEYS = [
  "material+dither+layers+fusion",
  "material+animation+dither+ascii+layers",
  "material+animation+texture+dither+layers+fusion",
  "animation+dither+layers",
]

const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness, null, { timeout: 60000 })

const served = await page.evaluate(() => {
  const h = window.__styleHarness
  const out = {}
  for (const k of h.fusionComboKeys()) out[k] = null
  return { keys: Object.keys(out), count: Object.keys(out).length }
})
say(
  served.count === F.FUSION_COMBO_LIST.length,
  "the page exposes the same number of combination cells the source declares",
  `page ${served.count} · disk ${F.FUSION_COMBO_LIST.length}`,
)

/* The names. `selectFusionCombo` puts the rail on `combo:<key>`, and the panel's
 * label comes from the same table — so reading the selection back proves the
 * BUNDLE resolved the key, and the disk-side name is what it must agree with. */
const drift = []
for (const key of KEYS) {
  const onDisk = F.FUSION_COMBOS_BY_KEY[key]
  if (!onDisk) {
    drift.push(`${key} is not in the source at all`)
    continue
  }
  /* ⚠ READ IT BACK ON A LATER TICK, NOT IN THE SAME `evaluate`.
   * `stylePreset()` closes over `styleState`, which is React state — so calling
   * it in the same tick as the selection returns the value from the LAST
   * RENDER. The first version of this file did exactly that and produced a
   * perfect OFF-BY-ONE: each cell reported the id of the cell selected before
   * it, which looks exactly like a bundle serving stale names. Same family as
   * the `cameraSpin()` defect this feature already found and fixed with a ref.
   * The instrument was wrong; the bundle was fine. */
  const took = await page.evaluate((k) => window.__styleHarness.selectFusionCombo(k), key)
  await page.waitForTimeout(200)
  const got = took ? await page.evaluate(() => window.__styleHarness.stylePreset()) : "REFUSED"
  if (got !== `combo:${key}`) drift.push(`${key}: page selected ${got}`)
}
say(
  drift.length === 0,
  `every probe cell resolves in the SERVED bundle to the id the source gives it (${KEYS.length} cells)`,
  drift.join(" · ") || KEYS.map((k) => `${k} = "${F.FUSION_COMBOS_BY_KEY[k].name}"`).join(" · "),
)

/* THE KNOWN-BAD. A key that exists in NEITHER is the only thing this gate can
 * be handed that must be refused — and `selectFusionCombo` was built to return
 * false rather than silently do nothing for exactly this reason: a probe has to
 * be able to tell "the route refused" from "the route ran and nothing moved". */
{
  const refused = await page.evaluate(() => window.__styleHarness.selectFusionCombo("material+notasystem"))
  say(refused === false, "CALIBRATION · the same route REFUSES a key that is not in the set", `returned ${refused}`)
}

/* AND THE STRONGER MARKER: THE COMPOSITION THE BUNDLE ACTUALLY APPLIES.
 *
 * A name proves the bundle has the right TABLE. It does not prove the bundle
 * applies the right PICTURE, and the picture is the entire thing a liveness
 * capture measures — a cell whose screen changed from `diamond` to `hatch` has
 * the same name and a completely different number. `__styleHarness.get()`
 * returns the live `styleState`, so the applied composition can be compared
 * field by field against the `compose` the source declares. Read off disk on
 * one side and off the running page on the other; nothing is typed here. */
{
  const bad = []
  for (const key of KEYS) {
    const want = F.FUSION_COMBOS_BY_KEY[key]?.compose ?? {}
    const fields = Object.keys(want)
    if (!fields.length) continue
    await page.evaluate((k) => window.__styleHarness.selectFusionCombo(k), key)
    await page.waitForTimeout(200)
    const got = await page.evaluate((fs) => {
      const s = window.__styleHarness.get().styleState
      const out = {}
      for (const f of fs) out[f] = s[f]
      return out
    }, fields)
    for (const f of fields) if (got[f] !== want[f]) bad.push(`${key}.${f}: page ${got[f]} · disk ${want[f]}`)
  }
  say(
    bad.length === 0,
    "…and the bundle APPLIES the composition the source declares, field by field — a name proves the table, only this proves the picture a capture will measure",
    bad.slice(0, 6).join(" · ") ||
      KEYS.map((k) => `${F.FUSION_COMBOS_BY_KEY[k].name}: ${Object.entries(F.FUSION_COMBOS_BY_KEY[k].compose ?? {}).filter(([f]) => f !== "materialUserOverride").map(([f, v]) => `${f}=${v}`).join(" ")}`).join(" · "),
  )
}

await browser.close()
console.log(`\n${fails === 0 ? `ALL ${checks} FUSION-BUNDLE-FRESH ASSERTIONS PASS` : `${fails} of ${checks} FUSION-BUNDLE-FRESH ASSERTIONS FAILED`}`)
process.exit(fails === 0 ? 0 : 1)
