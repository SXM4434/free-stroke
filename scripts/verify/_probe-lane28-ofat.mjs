// LANE 28 — OFAT SWEEP OVER EVERY CONTROL THE PANEL PRESENTS AS LIVE.
//
// The question: does each control the drawer offers, in the state it is SHOWN
// in, move the render at all? Ten dead controls have been found here by hand.
// This asks the whole surface at once.
//
// HOW IT AVOIDS BEING A GREEN ROW THAT CANNOT FAIL
//
//  · It drives the REAL DOM — the tab is clicked, the slider is set on the
//    element and dispatched as `input`. It never reaches through
//    `__styleHarness` for anything it asserts. A panel that rendered ZERO
//    controls once passed harness assertions in this repo.
//  · Every control is measured against a NO-OP ARM taken with the identical
//    grab/settle timing and NOTHING changed. That arm is the noise floor AND
//    the negative control: if the no-op reads above the floor, the instrument
//    is measuring drift and every verdict on the run is void.
//  · The scene is held STILL (`motionMode: "off"`, animation switches left
//    alone) so an A/B is not a race against a running clock. Controls that
//    only mean something while the clock runs are reported
//    NOT-DECIDABLE-BY-THIS-ARM rather than called dead — an honest abstention,
//    not a pass.
//  · Disabled controls are skipped and counted. A control the panel greys out
//    is not claiming to act.
import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const URL = LAB_URL
const PANELS = ["Material", "Animation", "Texture", "Dither", "ASCII", "Layers", "Fusion", "Presets"]

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 1460 }, reducedMotion: "no-preference" })
const consoleErrors = []
p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()) })
await p.goto(URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__styleHarness)

const pts = []
for (let i = 0; i <= 120; i++) {
  const t = i / 120
  pts.push({ x: 140 + t * 470, y: 330 + Math.sin(t * Math.PI * 2.1) * 120 })
}
await p.evaluate((x) => window.__styleHarness.injectStrokes(x, { msPerPoint: 12 }), [pts])
await p.waitForTimeout(1600)

/* Every visual layer ON and every system given something to draw, so a control
 * that only acts on a live layer is not measured against a layer that is off —
 * that would report a working control as dead, which is the direction that
 * costs the most. Clock OFF so the A/B is not a race. */
await p.evaluate(() =>
  window.__styleHarness.setStyle({
    motionMode: "off",
    textureEnabled: true, textureMode: "scanlines", textureIntensity: 0.8, textureAnimated: false,
    ditherEnabled: true, ditherType: "dotScreen", ditherIntensity: 0.8, ditherAnimated: false,
    asciiEnabled: true, asciiCharset: "classic", asciiAnimated: false,
    layerStackEnabled: true, stackAnimationEnabled: false,
    materialAnimationEnabled: false,
    fusionPreset: "terminalGel",
  }),
)
/* THE SETTLE IS LOAD-BEARING AND WAS MEASURED, NOT GUESSED.
 * `evaluateFusion`'s shared completion pulse is `exp(-trigger / 0.5)` keyed
 * through `completionTrigger` (lib/style-fusion.ts:1060), so for several
 * seconds after a fusion is armed the render is legitimately still settling.
 * At a 1.4 s settle the no-op arm read 0/6 identical with a worst max|Δ| of
 * 244 and this sweep correctly ABORTED; at 14 s it reads 4/4 identical, mean
 * |Δ| 0.0000 (scripts/verify/_probe-lane28-still.mjs). "Motion mode: Off"
 * freezes fusion exactly as viewport-3d.tsx:2703 claims — the early reading
 * was a decaying one-shot, not a defect. */
await p.waitForTimeout(15000)

/* The locator is resolved FRESH each grab. A sibling lane saving a watched file
 * fast-refreshes the scene, which detaches the old canvas element — and a
 * cached locator then throws "Element is not attached to the DOM" halfway
 * through a sweep. `_run-clean.mjs` catches the contamination afterwards; this
 * just means the run gets far enough to be told so. */
const grab = async () => {
  await p.waitForTimeout(260)
  return p.locator("canvas").last().screenshot()
}
// Mean absolute per-byte difference over the PNG-decoded pixels is not
// available without a decoder here, so compare raw PNG bytes for identity and
// size delta for magnitude. Identity is the load-bearing half: two identical
// PNGs mean the render did not change at all.
const same = (a, b2) => a.length === b2.length && a.equals(b2)

const openPanel = async (label) => {
  const closeBtn = await p.$(`button[title="Close ${label}"]`)
  if (!closeBtn) {
    const chip = await p.$(`button[title="Edit ${label}"]`)
    if (chip) await chip.click()
    else {
      const any = await p.$('button[title^="Edit "]')
      if (any) await any.click()
      await p.waitForTimeout(300)
      await p.click(`nav[aria-label="Style panel sections"] button:has-text("${label}")`)
    }
  }
  await p.waitForTimeout(420)
}

/* ---- the NO-OP arm: the instrument's own floor + negative control ---- */
const noop = []
for (let i = 0; i < 6; i++) {
  const a = await grab()
  const b2 = await grab()
  noop.push(same(a, b2))
}
const noopStable = noop.filter(Boolean).length
console.log(`NO-OP ARM: ${noopStable}/6 consecutive grabs byte-identical`)
if (noopStable < 6) {
  console.log("  ⚠ the scene is not still — every verdict below would be measuring drift.")
  console.log("  ABORT: instrument uncalibrated.")
  await b.close()
  process.exit(1)
}
console.log("  calibrated: a control that changes nothing WILL read identical, so 'dead' is decidable.\n")

const rows = []
for (const panel of PANELS) {
  await openPanel(panel)
  const controls = await p.$$eval(".fs-panel-enter input, .fs-panel-enter select", (els) =>
    els.map((el, i) => ({
      i,
      tag: el.tagName.toLowerCase(),
      type: el.type || "",
      disabled: !!el.disabled || !!el.closest(".pointer-events-none"),
      label:
        (el.closest("label")?.querySelector("span")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 42) ||
        el.getAttribute("aria-label") ||
        `${el.tagName}#${i}`,
      opts: el.tagName === "SELECT" ? [...el.options].map((o) => o.value) : null,
    })),
  )
  for (const c of controls) {
    if (c.disabled) { rows.push({ panel, ...c, verdict: "skipped (disabled)" }); continue }
    if (c.type === "checkbox") { rows.push({ panel, ...c, verdict: "skipped (switch — arms another arm)" }); continue }
    const before = await grab()
    const changed = await p.evaluate(
      ({ idx }) => {
        const els = [...document.querySelectorAll(".fs-panel-enter input, .fs-panel-enter select")]
        const el = els[idx]
        if (!el) return "gone"
        const fire = () => {
          el.dispatchEvent(new Event("input", { bubbles: true }))
          el.dispatchEvent(new Event("change", { bubbles: true }))
        }
        if (el.tagName === "SELECT") {
          const other = [...el.options].map((o) => o.value).filter((v) => v !== el.value)
          if (!other.length) return "single-option"
          el.value = other[other.length - 1]
          fire()
          return `→ ${el.value}`
        }
        const min = Number(el.min), max = Number(el.max), cur = Number(el.value)
        // Move to whichever end is FURTHER away, so the change is maximal.
        const target = Math.abs(max - cur) >= Math.abs(cur - min) ? max : min
        if (target === cur) return "already-at-extreme"
        el.value = String(target)
        fire()
        return `${cur} → ${target}`
      },
      { idx: c.i },
    )
    if (typeof changed === "string" && !changed.includes("→")) {
      rows.push({ panel, ...c, verdict: `skipped (${changed})` })
      continue
    }
    const after = await grab()
    const moved = !same(before, after)
    rows.push({ panel, ...c, change: changed, verdict: moved ? "MOVES" : "NO CHANGE" })
  }
}

console.log("PANEL      CONTROL                                     CHANGE                VERDICT")
console.log("-".repeat(104))
for (const r of rows) {
  console.log(
    `${r.panel.padEnd(10)} ${String(r.label).padEnd(43)} ${String(r.change ?? "").padEnd(21)} ${r.verdict}`,
  )
}
const dead = rows.filter((r) => r.verdict === "NO CHANGE")
console.log(`\n${rows.length} controls seen · ${rows.filter((r) => r.verdict === "MOVES").length} move · ${dead.length} NO CHANGE · ${rows.filter((r) => String(r.verdict).startsWith("skipped")).length} skipped`)
if (dead.length) {
  console.log("\nNO CHANGE (candidates — each needs its own read before it is called dead):")
  for (const d of dead) console.log(`  ${d.panel} · ${d.label} (${d.change})`)
}
/* ====================================================================== */
/*  ARM 2 — the controls arm 1 abstained on, in a state where they act.    */
/* ---------------------------------------------------------------------- */
/*  Arm 1 holds the clock still, so every animation sub-control is greyed  */
/*  out and honestly unmeasurable. Turning the clock ON makes an A/B a     */
/*  RACE: at drift's own rate a 50 ms scheduling jitter is worth 0.03 of   */
/*  offset, and both arms inherit it (the trap named in                    */
/*  assert-preset-pixels.mjs).                                             */
/*                                                                          */
/*  So the clock runs but the PHASE does not come from the wall clock:     */
/*  every layer is put on `revealSynced`, whose time is                     */
/*  `clock.reveal * revealScale * speed + phase` (lib/style-clock.ts:326)  */
/*  — and `clock.reveal` is pinned at 1 by a finished stroke. Speed,        */
/*  direction and behaviour then move the render DETERMINISTICALLY, and    */
/*  the no-op arm is re-run to prove it.                                    */
/*                                                                          */
/*  DELAY IS NOT DECIDABLE THIS WAY AND IS NOT CLAIMED TO BE.               */
/*  `revealSynced` never reads `delay` at all — its branch returns before   */
/*  the value is touched — so measuring Delay here would report a working   */
/*  control as dead. It gets its own arm below, in the one mode where its   */
/*  effect is a step function: `delayedAfterReveal`, which is SILENT until  */
/*  the delay elapses.                                                      */
/* ====================================================================== */
console.log("\n\n=== ARM 2 · animation sub-controls, phase pinned to the reveal ===")
await p.evaluate(() =>
  window.__styleHarness.setStyle({
    motionMode: "independent",
    /* FUSION OFF. Arm 1 left `terminalGel` selected, and turning the clock on
     * here restarts its ambient oscillator — which runs on the wall clock and
     * has no reveal-synced mode to pin. That was the un-pinned mover that made
     * the no-op arm read 0/6 and correctly voided this arm twice. */
    fusionPreset: "none",
    textureAnimated: true, textureSyncMode: "revealSynced",
    ditherAnimated: true, ditherSyncMode: "revealSynced", ditherDirection: "horizontal",
    asciiAnimated: true, asciiSyncMode: "revealSynced", asciiAnimationType: "scroll",
    stackAnimationEnabled: true, stackAnimationType: "revealSynced",
    /* MATERIAL ANIMATION STAYS OFF, and that is a measured decision rather than
     * an omission. Its shine sweep runs on the wall clock and has no
     * reveal-synced mode to pin, so leaving it on made the no-op arm read 0/6
     * and this whole arm correctly refused. It is decided in arm 4 instead. */
    materialAnimationEnabled: false,
  }),
)
await p.waitForTimeout(15000)
const noop2 = []
for (let i = 0; i < 6; i++) { const a = await grab(); const b3 = await grab(); noop2.push(same(a, b3)) }
const stable2 = noop2.filter(Boolean).length
console.log(`NO-OP ARM 2: ${stable2}/6 byte-identical`)
if (stable2 < 6) {
  console.log("  ⚠ phase is NOT pinned — arm 2 is a race. Reporting NOT-DECIDABLE for every row rather than a verdict.")
} else {
  console.log("  calibrated.\n")
  const rows2 = []
  for (const panel of ["Material", "Texture", "Dither", "ASCII", "Layers"]) {
    await openPanel(panel)
    const controls = await p.$$eval(".fs-panel-enter input, .fs-panel-enter select", (els) =>
      els.map((el, i) => ({
        i, tag: el.tagName.toLowerCase(), type: el.type || "",
        disabled: !!el.disabled || !!el.closest(".pointer-events-none"),
        label: (el.closest("label")?.querySelector("span")?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 42) || `${el.tagName}#${i}`,
      })),
    )
    for (const c of controls) {
      if (c.disabled || c.type === "checkbox") continue
      if (/^Delay/.test(c.label)) { rows2.push({ panel, ...c, verdict: "NOT DECIDABLE HERE (revealSynced ignores delay) — see arm 3" }); continue }
      const before = await grab()
      const changed = await p.evaluate(({ idx }) => {
        const el = [...document.querySelectorAll(".fs-panel-enter input, .fs-panel-enter select")][idx]
        if (!el) return "gone"
        const fire = () => { el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })) }
        if (el.tagName === "SELECT") {
          const other = [...el.options].map((o) => o.value).filter((v) => v !== el.value)
          if (!other.length) return "single-option"
          el.value = other[other.length - 1]; fire(); return `→ ${el.value}`
        }
        const min = Number(el.min), max = Number(el.max), cur = Number(el.value)
        const target = Math.abs(max - cur) >= Math.abs(cur - min) ? max : min
        if (target === cur) return "already-at-extreme"
        el.value = String(target); fire(); return `${cur} → ${target}`
      }, { idx: c.i })
      if (typeof changed === "string" && !changed.includes("→")) { rows2.push({ panel, ...c, verdict: `skipped (${changed})` }); continue }
      const after = await grab()
      rows2.push({ panel, ...c, change: changed, verdict: !same(before, after) ? "MOVES" : "NO CHANGE" })
    }
  }
  for (const r of rows2)
    console.log(`${r.panel.padEnd(10)} ${String(r.label).padEnd(43)} ${String(r.change ?? "").padEnd(21)} ${r.verdict}`)
  const dead2 = rows2.filter((r) => r.verdict === "NO CHANGE")
  console.log(`\narm 2: ${rows2.filter((r) => r.verdict === "MOVES").length} move · ${dead2.length} NO CHANGE`)
  for (const d of dead2) console.log(`  DEAD? ${d.panel} · ${d.label} (${d.change})`)
}

/* ---- ARM 3 · Delay, in the one mode where its effect is a step ---- */
console.log("\n=== ARM 3 · Delay (delayedAfterReveal: SILENT until it elapses) ===")
for (const [layer, patch0, patch4] of [
  ["texture", { textureSyncMode: "delayedAfterReveal", textureDelay: 0 }, { textureSyncMode: "delayedAfterReveal", textureDelay: 4 }],
  ["dither", { ditherSyncMode: "delayedAfterReveal", ditherDelay: 0 }, { ditherSyncMode: "delayedAfterReveal", ditherDelay: 4 }],
  ["ascii", { asciiSyncMode: "delayedAfterReveal", asciiDelay: 0 }, { asciiSyncMode: "delayedAfterReveal", asciiDelay: 4 }],
]) {
  await p.evaluate((x) => window.__styleHarness.setStyle(x), patch4)
  await p.waitForTimeout(500)
  const silent = await grab()
  await p.evaluate((x) => window.__styleHarness.setStyle(x), patch0)
  await p.waitForTimeout(900)
  const arrived = await grab()
  console.log(`  ${layer.padEnd(8)} delay 4 (silent) vs delay 0 (arrived): ${!same(silent, arrived) ? "MOVES" : "NO CHANGE"}`)
}

/* ---- ARM 4 · Material animation, which has no pinnable phase ---- */
/* Its three controls run on the wall clock, so an A/B grab is a race. What is
 * NOT a race is whether the layer moves AT ALL: take N frames on each setting
 * and count how many are byte-identical to the first. A dead control leaves the
 * frames identical; a live one does not. That is a presence test, not a
 * magnitude test, and it is labelled as such. */
console.log("\n=== ARM 4 · Material animation (presence, not magnitude) ===")
const movesOverTime = async (patch, n = 5) => {
  await p.evaluate((x) => window.__styleHarness.setStyle(x), patch)
  await p.waitForTimeout(1200)
  const first = await grab()
  let diff = 0
  for (let i = 0; i < n; i++) { const g = await grab(); if (!same(first, g)) diff++ }
  return diff
}
console.log(`  animation OFF          frames differing from the first: ${await movesOverTime({ materialAnimationEnabled: false })} / 5  (expect 0 — this is the negative control)`)
for (const t of ["shineSweep", "gelShimmer", "roughnessPulse", "signalFlicker"]) {
  const d = await movesOverTime({ materialAnimationEnabled: true, materialAnimationType: t, materialAnimationIntensity: 1, materialAnimationSpeed: 2 })
  console.log(`  type ${t.padEnd(16)} frames differing: ${d} / 5  ${d > 0 ? "MOVES" : "NO CHANGE"}`)
}

console.log(`\nconsole errors during sweep: ${consoleErrors.length}`)
for (const e of consoleErrors.slice(0, 6)) console.log("  " + e.slice(0, 170))
await b.close()
