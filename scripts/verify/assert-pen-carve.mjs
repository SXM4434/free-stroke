// THE FLAT STATE GETS THE PEN'S SILHOUETTE, ON THE REAL RENDER.
//
// Sebs, on the beat this whole page exists for: *"the 2D and 3D transformation
// is way too subtle."* `scripts/verify/_probe-carve-preview.mjs` measured why,
// offline: across the whole beat the flat state and the settled solid differ ON
// THE SILHOUETTE by 4.09 % of a stroke radius — and a value-only control
// accounts for the WHOLE of that 4.09 %. The shipped beat's silhouette change
// is zero; every visible difference is the luminance threshold moving under the
// lighting. The mark changed its value and never its shape.
//
// `lib/flat-ink.ts` bakes the nib's own outline into a two-channel signed
// distance field (`buildPenField`, asserted against the analytic law in
// `assert-pen-field.mjs`) and `applyPenCarve` in components/viewport-3d.tsx
// carves it out of the tube with one texture fetch and a `discard`. This file
// judges that on the REAL page, in pixels.
//
// ── THE ROW THAT MATTERS MOST IS ROW 1, AND IT IS THE BORING ONE ──────────
// At carve 0 NOTHING may move. The settled solid is a shipped, gated picture —
// `assert-hero-transition.mjs` reads 9/9 on it and gate 1 (flat ink SD < 1) is
// non-negotiable. A channel that moved it by a pixel while nominally off would
// be a regression dressed as a feature.
//
// ── ⚠ ROWS 2, 3 AND 4 MEASURE THE CARVE WITH `jointBreak` HELD CLOSED ──────
// (2026-08-02, and this is the correction that turned two red rows green
// WITHOUT touching the surface — §17 rule 4: *"If your change makes a check
// fail because the check is WRONG, fix the check and prove the fix with its
// negative control. Never edit a surface to make a check pass."*)
//
// ROW 2 IS NAMED *"the pen outline is a subset of the tube"* AND IT WAS
// MEASURING TWO CHANNELS. This file seeks to the END of the beat, where the
// host publishes `jointBreak` OPEN, and `setFlatten` is a PARTIAL override — so
// the key it did not set came from the host and BOTH frames were drawn with the
// break open. `viewport-3d.tsx` then rebuilds the break table on `fs.penCarve`
// (`syncBreakTable(carveNow)`), and `buildJointBreaks` sizes the band's inner
// bound `keepOver` FROM THE CARVE: 1.06 R at 0, and 0.56–1.00 R at 1. The band
// is an ANNULUS `(keepOver, keepOver + gap]`, so lowering the inner bound slides
// the whole ring inward and its OUTER edge moves in with it — ink the
// tube-sized band had turned to paper is then outside the carve-sized band and
// comes back as INK. That is the 405 px, and it is not the carve.
//
// PROVEN BEFORE IT WAS FIXED, both directions, on the real page
// (`scripts/verify/_probe-carve-isolate.mjs`, run twice under `_run-clean`):
//
//     break from the host  8305 px ink→paper   405 px paper→ink   4.88 %
//     break HELD CLOSED    8374 px ink→paper     0 px paper→ink   0.00 %
//     break HELD OPEN at 1 8305 px ink→paper   405 px paper→ink   4.88 %
//
// Zero, exactly, with the break closed. The carve IS a strict subset of the
// tube on the real render, which is what row 2 always meant to say.
//
// ⚠ AND THE FIX MAY NOT MAKE THE ROW UNFALSIFIABLE, which is the obvious
// hazard: a subtractive channel measured alone can never add a pixel, so
// "0 added" is a green that cannot fail. Row 2 therefore asserts BOTH
// DIRECTIONS in one row — 0 with the break closed AND non-zero with it open —
// the same two-direction proof the dispatch contract names for `check-recede`.
// If the second half ever comes back 0 the row goes red, because that would
// mean the break stopped moving with the carve and the instrument stopped
// seeing anything at all.
//
// ── AND ROW 4 NOW ASKS THE QUESTION WITH THE REPO'S OWN ESTIMATOR ──────────
// It used a hand-rolled modal count against an uncalibrated 0.999. The interior
// at full carve is 4138 of 4144 at luma 21 — 6 outliers, 0.145 % — and LOOKED AT
// at 24x (`docs/verification/pen-carve/_outliers-6.png`) all six are the same
// thing the previous three were: the coverage residue of HAIRLINE PAPER GAPS the
// carve correctly opens where the fat tube had fused two strokes. Five sit in a
// vertical seam at x=731 inside the `D`, one at (696,445) on a wedge boundary.
// A sub-pixel concave gap has no mask boundary, so gate 1's isotropic 3-px
// erosion cannot reach it — `lib/flat-interior.mjs` documents that mechanism in
// full and answers it with `flatValueStats`, whose residue bound `FLAT_TRIM`
// (0.5 %) is CALIBRATED against the lit-tubes control at 84.37 % and against a
// trim sweep, and which `assert-hero-transition.mjs` gate 1 itself now uses.
// Row 4 asks that shared question instead of a fourth private copy of it —
// which is exactly what `flatValueStats`'s own docstring demands: *"four copies
// of one robust estimator is how three of them end up on the old one."*
//
// ── THE NEGATIVE CONTROLS ─────────────────────────────────────────────────
//   --mutate=epsilon   the "off" arm is driven at penCarve 0.05 instead of 0.
//                      Row 1 MUST go red. Without it, "carve 0 changes
//                      nothing" is a row that passes because the instrument
//                      cannot see a small silhouette change at all — which is
//                      exactly the failure the 4.09 % number came from.
//   --mutate=lit       the carved arm is driven as the LIT SOLID (ink 0, depth
//                      1) instead of flat — the exact picture gate 1 exists to
//                      reject, and a real tonal range by gate 3's own row. Row 4
//                      MUST go red.
//                      ⚠ `ink: 0.5` was tried first and does NOT work: at depth
//                      0.004 there is no volume to shade, so a half-lit flat
//                      mark measures as one value too (99.928 %, luma 13). A
//                      control that comes back clean means the instrument is
//                      blind — this one had to be the lit SOLID.
//   --mutate=breakdrift the isolation REMOVED: every pose drawn with the break
//                      taken from the host, i.e. exactly the configuration that
//                      was red. Row 2 MUST go red at ~405 px. It is the control
//                      for the fix itself — a check that was corrected without a
//                      control proving the correction mattered is a check nobody
//                      can audit. (2026-08-02)
//
// Usage: node scripts/verify/assert-pen-carve.mjs [--mutate=epsilon|lit|breakdrift]
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import {
  flatInterior,
  interiorStats,
  flatValueStats,
  INK_MAX_LUMA,
  FLAT_TRIM,
} from "./lib/flat-interior.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "pen-carve")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const MUTATE = arg("mutate", null)
const URL = HERO_URL

/** Gate 1's own threshold — `assert-hero-transition.mjs` gate 1. */
const FLAT_SD_MAX = 1

/**
 * The flat pose every frame here is taken in. One channel differs between them.
 *
 * ⚠ `jointBreak: 0` IS PART OF THE POSE AND IT IS LOAD-BEARING — see the header.
 * `setFlatten` merges over the HOST, this file seeks to the end of the beat
 * where the host has the break open, and the break's radii are a function of
 * the carve. Without this key the "one channel differs" in the sentence above is
 * false and rows 2 and 3 measure the carve and the break together.
 * `--mutate=breakdrift` removes it and row 2 must go red.
 */
const FLAT = {
  ink: 1,
  depth: 0.004,
  yaw: 0,
  shade: 0,
  shadow: 0,
  squashX: 1,
  squashY: 1,
  jointBreak: 0,
}

let failures = 0
const rows = []
const record = (name, pass, detail) => {
  rows.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`)
  console.log(`      ${detail}`)
  if (!pass) failures++
}

/** Byte-count of differing pixels between two same-size RGBA frames. */
function pixelDiff(a, b) {
  let n = 0
  let worst = 0
  for (let i = 0; i < a.length; i += 4) {
    const m = Math.max(
      Math.abs(a[i] - b[i]),
      Math.abs(a[i + 1] - b[i + 1]),
      Math.abs(a[i + 2] - b[i + 2]),
    )
    if (m > 2) n++
    if (m > worst) worst = m
  }
  return { n, worst, total: a.length / 4 }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  /* ⚠ THE PAGE IS LOADED ON THE CARVE'S PARKED ARM, AND ROW 1 STOPS MEANING
   * ANYTHING WITHOUT IT.
   *
   * `__captureHarness.setFlatten` is a PARTIAL override: `viewport-3d.tsx`
   * merges it as `{ ...flattenProp, ...ov }`, so every key the pose omits comes
   * from the HOST. Row 1's baseline arm — the pose with `penCarve` deliberately
   * omitted — therefore stopped being "the channel absent" the moment
   * `lib/hero-motion.ts` started publishing it: at the scrub position this file
   * seeks to (the end of the beat) the mark has RETURNED to flat, so the model
   * publishes `penCarve: 1` and the "absent" frame came back fully carved.
   * Measured, first-hand, before this line existed: row 1 went red at
   * **10 139 of 705 600 px differing, worst 232.6**.
   *
   * Nothing was wrong with the page and nothing was wrong with the row. The
   * baseline had silently become a second copy of the carved arm — a control
   * that no longer controls for anything, which is this repo's most expensive
   * defect class wearing yet another costume.
   *
   * `window.__heroCarveLaw = "prior"` is the page's own parked read (see
   * `app/desk-doodles/page.tsx`, the same shape as `__heroJunctionLaw`). Setting
   * it before the document loads makes the model publish a constant 0 for the
   * whole run, so "the pose with `penCarve` omitted" once again means what it
   * says — and `--mutate=epsilon` still has to break it, which is what proves
   * the row can fail at all. */
  await page.addInitScript(() => {
    window.__heroCarveLaw = "prior"
  })

  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, {
    timeout: 90000,
  })
  await page.waitForTimeout(2500)

  const stage = page.locator("[data-hero-stage]")
  const box = await stage.boundingBox()
  // CLIP, never `locator.screenshot()`: the element path waits for the node to
  // be "stable" and this page never stops rendering.
  const shot = async () => {
    await page.waitForTimeout(320)
    return page.screenshot({ clip: box })
  }
  const set = async (o) => {
    await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
    await page.waitForTimeout(300)
  }
  const seek = async (t) => {
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, t)
    await page.waitForTimeout(450)
  }
  const endT = await page.evaluate(() =>
    Number(document.querySelector("[data-hero-scrub]").max),
  )
  await seek(endT)

  /* ---- THE POSES ------------------------------------------------------- */
  /* `breakdrift` is the control for the isolation itself: it strips
   * `jointBreak` back out of the pose, so the key falls through to the host and
   * the run reproduces exactly the configuration that was red. */
  const pose = (o) => {
    const p = { ...FLAT, ...o }
    if (MUTATE === "breakdrift") delete p.jointBreak
    return p
  }

  // Baseline: the flat pose with the channel absent entirely.
  await set(pose({}))
  const basePng = await shot()
  writeFileSync(join(OUT, "flat-nochannel.png"), basePng)

  // The channel present and OFF. If `penCarve: 0` differs from omitting it,
  // every existing call site has been changed by a channel that is not on.
  await set(pose({ penCarve: MUTATE === "epsilon" ? 0.05 : 0 }))
  const offPng = await shot()
  writeFileSync(join(OUT, `flat-carve0${MUTATE ? `-${MUTATE}` : ""}.png`), offPng)

  // Fully carved. `lit` is row 4's control: the LIT SOLID at full carve, i.e.
  // exactly the picture gate 1 exists to reject.
  await set(
    MUTATE === "lit"
      ? { ink: 0, depth: 1, yaw: 0, shade: 0, jointBreak: 0, penCarve: 1 }
      : pose({ penCarve: 1 }),
  )
  const onPng = await shot()
  writeFileSync(join(OUT, "flat-carve1.png"), onPng)

  const field = await page.evaluate(() => window.__heroPenField ?? null)

  /* ---- AND THE SAME PAIR WITH THE BREAK HELD OPEN ----------------------
   * The second half of row 2's two-direction proof. Same two carve values, the
   * break pinned OPEN in both instead of closed in both, so the only thing that
   * can move the band is the carve — which is the mechanism the header names.
   * A row that only ever measured the closed arm could not fail. */
  await set({ ...FLAT, jointBreak: 1, penCarve: 0 })
  const openOffPng = await shot()
  await set({ ...FLAT, jointBreak: 1, penCarve: 1 })
  const openOnPng = await shot()
  writeFileSync(join(OUT, "flat-carve1-breakopen.png"), openOnPng)

  // The SOLID pose, carved and not — the other end of the beat must not move
  // either, because the carve is only ever driven on the flat half.
  await set({ ink: 0, depth: 1, yaw: 0, shade: 0, jointBreak: 0, penCarve: 0 })
  const solidPng = await shot()
  writeFileSync(join(OUT, "solid-carve0.png"), solidPng)

  await set(null)
  await browser.close()

  /* ---- ROW 1 · at carve 0, NOTHING moves ------------------------------ */
  const baseI = await flatInterior(basePng)
  const offI = await flatInterior(offPng)
  const onI = await flatInterior(onPng)

  // `flatInterior` does not return raw RGBA, so compare on its luma field —
  // same information for this purpose and it is already cropped identically.
  let moved = 0
  let worst = 0
  for (let p = 0; p < baseI.luma.length; p++) {
    const m = Math.abs(baseI.luma[p] - offI.luma[p])
    if (m > 2) moved++
    if (m > worst) worst = m
  }
  record(
    "1 · at carve 0 the settled picture does not move — the channel is INERT when off",
    moved === 0,
    `${moved} of ${baseI.luma.length} px differ by >2 luma (worst ${worst.toFixed(1)}) between "channel absent" and "penCarve: 0"`,
  )

  /* ---- ROW 2 · the carve REMOVES ink and never adds it ----------------
   *
   * BOTH DIRECTIONS, IN ONE ROW. See the header: with the break held closed the
   * carve must add ZERO — it is a `discard` against a field whose pen channel is
   * a strict subset of its tube channel. With the break held OPEN it must add a
   * NON-ZERO count, because the band's inner bound is sized from the carve and
   * an annulus that moves inward takes its outer edge with it. The first half
   * alone is a green that cannot fail; the second half is what proves the
   * instrument is looking at anything. */
  const direction = (a, b) => {
    let removed = 0
    let added = 0
    for (let p = 0; p < a.luma.length; p++) {
      const wasInk = a.luma[p] <= INK_MAX_LUMA
      const isInk = b.luma[p] <= INK_MAX_LUMA
      if (wasInk && !isInk) removed++
      if (!wasInk && isInk) added++
    }
    return { removed, added }
  }
  const closed = direction(offI, onI)
  const opened = direction(await flatInterior(openOffPng), await flatInterior(openOnPng))
  record(
    "2 · the carve only ever REMOVES ink — the pen outline is a subset of the tube",
    closed.removed > 0 &&
      closed.added === 0 &&
      // The other direction. `breakdrift` strips the isolation, so the closed
      // arm IS the open arm and this row must go red on `closed.added`.
      (MUTATE === "breakdrift" || opened.added > 0),
    `break CLOSED: ${closed.removed} px ink→paper, ${closed.added} px paper→ink — the carve alone, and it must be 0.  ` +
      `· break OPEN: ${opened.removed} px ink→paper, ${opened.added} px paper→ink — the band's inner bound moving with the carve, and it must NOT be 0`,
  )

  /* ---- ROW 3 · and it is a REAL change, near the predicted size -------- */
  const inkDrop = (offI.ink - onI.ink) / Math.max(1, offI.ink)
  record(
    "3 · the silhouette actually changes — the offline probe predicted 22.9 % of the ink",
    inkDrop > 0.1 && inkDrop < 0.4,
    `ink ${offI.ink} → ${onI.ink} px, a ${(100 * inkDrop).toFixed(1)} % drop (predicted 22.9 % by _probe-carve-preview.mjs)`,
  )

  /* ---- ROW 4 · GATE 1'S QUESTION, ASKED ROBUSTLY ----------------------
   *
   * ⚠ THIS ROW USED TO BE `onI.sd < 1` — gate 1's own statistic verbatim — and
   * it went RED at 1.256 while the picture was correct. The cause was located
   * rather than argued: THREE pixels out of 4151, at (733,367), (733,368) and
   * (734,373), and the crop at `_outlier2.png` shows exactly what they are —
   * the tip of a hairline PAPER GAP the carve opens between two strokes of the
   * "D" that only the fat tube had fused. 4148 of 4151 interior pixels sit at
   * exactly luma 21, the flat ink value, and the histogram is
   * `21x4148 26x1 33x1 100x1`.
   *
   * That gap is correct drawing, and a sub-pixel gap rendered with multisample
   * coverage MUST produce a partial pixel — the alternative is an aliased
   * hairline, which is the "jaggedy" tell. Gate 1's interior is an ISOTROPIC
   * 3-px erosion of the ink mask, and a one-pixel concave gap inside a black
   * body survives it by construction: every one of the pixel's 48 neighbours is
   * ink. The statistic is exact on the un-carved mark (SD 0.000) because no
   * such feature exists there.
   *
   * So this is §17 rule 4: the check is wrong for this input, and the fix is
   * the check, proved with a control that must still fail. Gate 1 asks "is the
   * flat mark SHADED"; a standard deviation answers it only while no isolated
   * boundary pixel survives the erosion. The robust form of the same question —
   * what FRACTION of the interior sits at one value — answers it either way,
   * and `--mutate=lit` (a half-lit form at full carve) is the control that
   * proves it can still say no. The raw SD is printed regardless, so nothing is
   * hidden by the change.
   *
   * ⚠ AND THE CONSEQUENCE IS NAMED, NOT BURIED: driving `penCarve` from
   * lib/hero-motion.ts would move `assert-hero-transition.mjs`'s gate 1 to
   * 1.256 on those three pixels. Nothing drives it today, so that gate is
   * untouched — but the beat cannot adopt this channel until gate 1's erosion
   * is made gap-aware, and that file belongs to another lane. */
  /* ── ASKED WITH THE REPO'S OWN ESTIMATOR (2026-08-02) ──────────────────
   * This row used to run a private modal count against an uncalibrated 0.999
   * and it went red at 99.855 % on SIX pixels of 4144. `lib/flat-interior.mjs`
   * already owns this question — `flatValueStats`, whose residue bound
   * `FLAT_TRIM` is calibrated against the lit-tubes control (84.37 % residue,
   * three orders of magnitude away) and against a trim sweep, and which
   * `assert-hero-transition.mjs` gate 1 itself reads. Its docstring names the
   * failure mode of NOT using it: *"four copies of one robust estimator is how
   * three of them end up on the old one."* This is the fourth copy, removed.
   *
   * The six were LOOKED AT at 24x before the change, not argued away — they are
   * the coverage residue of hairline paper gaps the carve correctly opens where
   * the tube had fused two strokes. `--mutate=lit` is still the control that
   * makes this row red. */
  const carvedInterior = []
  const outliers = []
  for (let p = 0; p < onI.luma.length; p++) if (onI.interior[p]) carvedInterior.push(onI.luma[p])
  const vs = flatValueStats(carvedInterior)
  for (let p = 0; p < onI.luma.length; p++) {
    if (!onI.interior[p]) continue
    if (Math.abs(onI.luma[p] - vs.modal) > 1)
      outliers.push([p % onI.W, Math.floor(p / onI.W), Math.round(onI.luma[p])])
  }
  record(
    "4 · the carved flat mark is still ONE VALUE — gate 1's question, asked robustly",
    vs.residue <= vs.residueMax,
    `${vs.n - vs.offModal} of ${vs.n} interior px at luma ${vs.modal} · residue ${(100 * vs.residue).toFixed(3)} % ` +
      `(bound ${(100 * FLAT_TRIM).toFixed(1)} %, lit-tubes control 84.37 %) · trimmed SD ${vs.sdTrim.toFixed(3)} · ` +
      `raw gate-1 SD ${onI.sd.toFixed(3)} (floor ${FLAT_SD_MAX}) · carve 0 SD ${offI.sd.toFixed(3)} · ` +
      `${outliers.length} outlier(s)${outliers.length ? ": " + outliers.slice(0, 6).map((o) => `(${o[0]},${o[1]})=${o[2]}`).join(" ") + (outliers.length > 6 ? " …" : "") : ""}`,
  )

  /* ---- ROW 5 · the field is the one the law describes ----------------- */
  record(
    "5 · the field is baked at the resolution the law specifies",
    !!field &&
      field.unitsPerTexel === field.expectedUnitsPerTexel &&
      field.texels > 10000 &&
      field.inkWidth > 0,
    field
      ? `${field.width}×${field.height} = ${field.texels} texels at ${field.unitsPerTexel} stroke unit/texel (law says ${field.expectedUnitsPerTexel}) · ink diameter ${field.inkWidth.toFixed(2)} · baked in ${field.bakeMs} ms`
      : "window.__heroPenField was never written — the field was not built",
  )

  /* ---- ROW 6 · and the page did not hang ------------------------------ */
  record(
    "6 · frames kept being presented — no `discard`-in-a-loop hang",
    onPng.length > 1000 && solidPng.length > 1000,
    `carve-1 frame ${onPng.length} B, solid frame ${solidPng.length} B — a hung Metal backend times the screenshot out instead`,
  )

  record(
    "7 · console clean",
    errors.length === 0,
    `${errors.length} errors${errors.length ? ": " + errors[0] : ""}`,
  )

  console.log(`\nframes: ${OUT}`)
  console.log(failures === 0 ? "all rows passed" : `${failures} row(s) failed`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
