// ASSERT-DRAWIN-PARITY — does the word actually WRITE ITSELF IN, in every
// register and on every engine?
//
// Sebs: *"and also if switch engine to desk doodles the word just auto
// appears"*. That is a state question, not a time question, so it is answered
// by scrubbing the beat's own draw phase and counting ink on the real stage —
// not by watching. Four combinations are driven through the page's own pills:
//
//     LOOK   Desk Doodles | Free Stroke      (the visual register)
//   × ENGINE Desk Doodles | Free Stroke      (whose geometry builds the form)
//
// WHAT MAKES THIS AN INSTRUMENT RATHER THAN A GREEN ROW. The failing case is
// REAL and is checked in: before this lane's fix, `engine=desk-doodles` shows
// full ink on the FIRST sample of the draw. An agreement test that cannot fail
// proves nothing.
//
// ── 2026-08-07 · THE CONTROL WAS BEHIND `--expect-pop=`, AND NOTHING PASSED IT.
//
// That flag made the expectation explicit and made it OPTIONAL, which is the
// same defect the flag existed to prevent. `run-browser-battery.mjs` passes no
// flags by design — *"the bare invocation is the one the next person types"* —
// so the only row in this file that proves the instrument can fail had never run
// in a sweep. Explainer 21 §7 is the standing law: *"the gate runs three kinds
// of control on the DEFAULT invocation, never behind a flag."*
//
// AND THE FLAG COULD NOT SIMPLY BE DROPPED, which is the part worth writing
// down. `--expect-pop=desk-doodles` names a known-bad that NO LONGER EXISTS:
// the engine was fixed, so requiring it to pop today fails — correctly, and
// uselessly. A control whose known-bad has been repaired is not a control, it
// is a memorial. The subject had to be re-armed rather than re-enabled.
//
// So the known-bad is now SYNTHESISED ON THE REAL STAGE, every run: a fifth arm
// holds the scrub at the END of the draw span for all nine samples, which is
// exactly the observable Sebs reported — *"the word just auto appears"* — and
// the instrument is required to reject it. Same page, same pills, same
// screenshot, same ink counter, same predicates. Only the input is bad.
//
// Two predicates that arm cannot reach — "never goes backwards" and "no single
// step reveals half the word" — get a second, cheaper control that feeds
// deliberately bad SERIES through the same judge. It grades the predicate and
// not the page, and it says so in its own row text, because a control that
// overstates its reach is the defect one level in.
//
// Usage:
//   node scripts/verify/assert-drawin-parity.mjs               # controls included
//   node scripts/verify/assert-drawin-parity.mjs --label=after
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "after")
/* STAGED, because this wipe can reach committed evidence. It empties
 * `docs/verification/drawin-parity/<label>`, and the label is an argument, so the reach is the
 * whole subtree, 52 tracked files.
 * The capture now writes to a sibling `.<name>.staging` and the stored set is
 * replaced only when the run completes, so a run that dies partway leaves every
 * committed frame alone. The same wipe on `hero-windup`, killed 14 s in, deleted
 * all 102 of its tracked files. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "drawin-parity", LABEL)
const EV = stageEvidence(FINAL)
const OUT = EV.dir

// The stage is captured at >= 1440x1440 because a shorter viewport lets the
// DialKit dock squeeze the stage and CLIP the mark, which already caused one
// wrong diagnosis on this beat.
const VIEW = { width: 1600, height: 1600 }
const SAMPLES = 9

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/**
 * Count ink on a stage screenshot.
 *
 * Thresholding on LUMA alone is wrong here, because the two registers ship
 * different papers: Free Stroke's is near-white and Desk Doodles' is a warm
 * mid-tone, so one fixed cut would read the whole Desk Doodles stage as ink.
 * The paper is therefore measured from the image's own modal luma and the cut
 * is placed a fixed distance below it — the mark is the darkest thing on the
 * stage in both registers, which is the property that actually transfers.
 */
async function inkPixels(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(img.width * img.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  let n = 0
  for (let p = 0; p < luma.length; p++) if (luma[p] < cut) n++
  return { n, paper, cut, w: img.width, h: img.height }
}

/**
 * THE FOUR PREDICATES, IN ONE PLACE, so the controls grade the SAME judge the
 * real arms are graded by.
 *
 * They used to be four inline `say(...)` calls, which meant a control could only
 * ever re-state them — and a control that re-implements the predicate it is
 * testing proves the copy, not the original. This is the shape explainer 27
 * names as the repo's most expensive recurring defect (two implementations of
 * one idea), aimed at the one place where it would be invisible.
 */
function judge(series) {
  const full = series[series.length - 1] || 1
  const frac = series.map((v) => v / full)
  const steps = frac.slice(1).map((v, i) => v - frac[i])
  const maxStep = Math.max(...steps)
  return {
    full,
    frac,
    maxStep,
    startsEmpty: frac[0] < 0.15,
    monotone: steps.every((s) => s >= -0.02),
    noBigStep: maxStep < 0.45,
    onScreen: full > 1000,
    /* The defect's own signature, kept as its own name: either the first sample
     * is already most of the word, or one step delivers half of it. */
    popped: frac[0] > 0.5 || maxStep > 0.45,
  }
}

async function main() {
  EV.open()

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 120000,
  })
  await page.waitForTimeout(1500)

  // The draw phase's own span, read off the page rather than assumed: the
  // timeline owns the durations and a hard-coded 2.13 here would silently
  // measure the wrong window the moment a clip edge is dragged.
  const drawSpan = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-draw-span]")
    return el ? JSON.parse(el.getAttribute("data-hero-draw-span")) : null
  })
  const span = drawSpan ?? { at: 0, duration: 2.1333 }
  console.log(`draw phase: at ${span.at.toFixed(3)}s, ${span.duration.toFixed(3)}s long`)

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    // Two frames: one for React to commit the seek, one for the scene to draw
    // the pose that commit produced.
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    await page.waitForTimeout(120)
  }

  const report = {}

  /** Nine samples of the draw phase on the pills currently selected.
   *  `holdAt` pins every sample to one instant instead of walking the span —
   *  that is the known-bad, and it is the ONLY difference between the control
   *  arm and a real one. */
  const sampleArm = async (key, holdAt = null) => {
    const series = []
    for (let k = 0; k < SAMPLES; k++) {
      const t = holdAt ?? span.at + (span.duration * k) / (SAMPLES - 1)
      await seek(t)
      const buf = await page.locator("[data-hero-stage]").screenshot()
      const m = await inkPixels(buf)
      series.push(m.n)
      if (k === 0 || k === SAMPLES - 1 || k === Math.floor(SAMPLES / 2)) {
        writeFileSync(join(OUT, `${key}_${String(k).padStart(2, "0")}.png`), buf)
      }
    }
    report[key] = series
    const v = judge(series)
    console.log(`\n${key}`)
    console.log(`  coverage: ${v.frac.map((f) => f.toFixed(3)).join("  ")}`)
    console.log(
      `  first sample ${(v.frac[0] * 100).toFixed(1)} % of final · largest single step ${(v.maxStep * 100).toFixed(1)} %`,
    )
    return v
  }

  const pills = async (look, engine) => {
    await page.click(`[data-register-option="${look}"]`)
    await page.waitForTimeout(300)
    await page.click(`[data-engine-option="${engine}"]`)
    // The Desk Doodles engine rebuilds the whole word on a switch; give it a
    // real settle rather than a frame.
    await page.waitForTimeout(2500)
  }

  for (const look of ["desk-doodles", "free-stroke"]) {
    for (const engine of ["desk-doodles", "free-stroke"]) {
      const key = `look-${look}__engine-${engine}`
      await pills(look, engine)
      const v = await sampleArm(key)
      say(v.startsEmpty, `${key} — the draw STARTS near empty`, `${(v.frac[0] * 100).toFixed(1)} % of final`)
      say(v.monotone, `${key} — the reveal never goes backwards`)
      say(v.noBigStep, `${key} — no single step reveals half the word`, `max step ${(v.maxStep * 100).toFixed(1)} %`)
      say(v.onScreen, `${key} — the word is actually on screen at the end`, `${v.full} ink px`)
    }
  }

  /* ══ THE CONTROLS · both run on the bare invocation ═══════════════════════ *
   *
   * Explainer 21 §7: *"the gate runs three kinds of control on the DEFAULT
   * invocation, never behind a flag."* Until 2026-08-07 the only control here
   * was behind `--expect-pop=`, which neither battery passes, so every green
   * above was worth what an unrun control is worth.
   */

  /* 1 · THE STAGE CONTROL — a real page that does not reveal.
   *
   * The pills are left on the SHIPPED arm (free-stroke look, free-stroke
   * engine), and the scrub is pinned to the END of the draw span for all nine
   * samples. Every screenshot is therefore the finished word, which is exactly
   * what *"the word just auto appears"* looks like from this instrument's side.
   *
   * It is the shipped arm on purpose: a control run on a register nobody ships
   * proves the instrument is awake somewhere else. */
  await pills("free-stroke", "free-stroke")
  const bad = await sampleArm("CONTROL__no-reveal", span.at + span.duration)
  say(
    bad.popped && !bad.startsEmpty,
    "CONTROL · KNOWN-BAD — a stage held at the END of the draw is REJECTED (it must be, or this instrument is blind)",
    `first sample ${(bad.frac[0] * 100).toFixed(1)} % of final (the real arms read under 15 %), ` +
      `"starts near empty" = ${bad.startsEmpty} (needs false), "popped" = ${bad.popped} (needs true), ` +
      `${bad.full} ink px. Same page, same pills, same screenshot, same ink counter — only the input is bad.`,
  )

  /* 2 · THE PREDICATE CONTROL — the two clauses arm 1 cannot reach.
   *
   * A held stage is monotone and stepless, so it says nothing about "never goes
   * backwards" or "no single step reveals half the word". Those two are fed
   * deliberately bad SERIES through the same `judge`. This grades the predicate
   * and NOT the page, and saying so is the point: a control that quietly claims
   * more reach than it has is the defect this file is fixing, one level in. */
  const backwards = judge([100, 400, 900, 600, 1000, 1200, 1400, 1600, 2000])
  const oneStep = judge([5, 8, 10, 12, 2000, 2000, 2000, 2000, 2000])
  say(
    !backwards.monotone,
    "CONTROL · a series that GOES BACKWARDS is rejected by the monotone clause (predicate-level, not the page)",
    `900 -> 600 ink px mid-series; monotone = ${backwards.monotone} (needs false)`,
  )
  say(
    !oneStep.noBigStep && oneStep.popped,
    "CONTROL · a series with ONE 99 % step is rejected by the step clause (predicate-level, not the page)",
    `max step ${(oneStep.maxStep * 100).toFixed(1)} %; noBigStep = ${oneStep.noBigStep} (needs false), ` +
      `popped = ${oneStep.popped} (needs true)`,
  )

  writeFileSync(join(OUT, "series.json"), JSON.stringify(report, null, 2))

  /* ═══ PROVENANCE · WAS THIS VERDICT MEASURED ON THIS RUN, ON THIS TREE? ═════
   *
   * ⚠ MEASURED 2026-08-28: this gate's capture directory was 0.1h behind, and it had just been run — the gap is a sibling lane writing lib/ after the capture.
   * `assert-gate-integrity.mjs` channel F called that out and was right.
   *
   * THIS GATE CAN RECAPTURE — it drives the browser and rewrites the directory
   * on every invocation — so the cure for the AGE is to run it, and running it
   * is what makes the row below pass. What the row guards is the part running
   * does not cure:
   *
   *   the capture is younger than this process   what was just graded was written
   *                                              by THIS run, not left behind by
   *                                              an older one. `lib/evidence-swap.mjs`
   *                                              keeps the previous set when a run
   *                                              dies partway, which is exactly the
   *                                              case where stale frames get graded.
   *   no source moved while it ran               six lanes share this checkout
   *                                              tonight. A lib/ write landing
   *                                              mid-capture straddles two builds
   *                                              and the reading belongs to neither.
   *
   * Together they imply channel F's own test: a capture younger than a process
   * that started after every source write post-dates every source write.
   *
   * The subject is all three roots, the same three channel F compares against;
   * `captureFreshness()` walks `lib/` alone and tonight `app/` moved with it.
   * The filter is narrowed to the captured PNGs so the row cannot certify this gate's own
   * series.json as evidence — the trap `assert-drawin-pentip.mjs` recorded.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const capNow = newestCapture(OUT, /\.png$/)
    const subjNow = ["lib", "app", "components"]
      .map((d) => newestUnder(join(ROOT, d)))
      .filter((x) => x.file)
      .sort((x, y) => y.ms - x.ms)[0]
    const relP = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
    const stampP = (ms) => new Date(ms).toLocaleString()
    const started = performance.timeOrigin
    const landed = Boolean(capNow.file) && capNow.ms >= started
    const treeHeld = Boolean(subjNow?.file) && subjNow.ms <= started
      const detailP = !landed
    ? (capNow.file
          ? `THE CAPTURE DID NOT LAND — newest artefact ${relP(capNow.file)} ${stampP(capNow.ms)} predates this run, which started ${stampP(started)}. ` +
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-drawin-parity.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-drawin-parity.mjs --label=${LABEL}; do NOT relax this row.`
        : `capture ${relP(capNow.file)} ${stampP(capNow.ms)} · run started ${stampP(started)} · newest source ${relP(subjNow.file)} ${stampP(subjNow.ms)}`
    say(
      landed && treeHeld,
      "PROVENANCE · this verdict was measured on this run, against a tree that did not move under it",
      detailP,
    )
  }

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0")
  await browser.close()
  /* THE SWAP, on completion and not on the pass flag. lib/evidence-swap.mjs */
  EV.commit()
  console.log(`\nframes: ${FINAL}`)
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
