// ASSERT-HERO-DEAD-CHANNELS — the two channels the model computed and nothing
// rendered, and the proof they now do.
//
// `docs/hero-beat-storyboard.md` §11.4.3, measured on the real capture:
//
//     f39  t 3.66  breath        w 648  h 158  cx 559.5  cy 444.5  ink 28371
//     f40  t 3.76  anticipation  w 648  h 158  cx 559.5  cy 444.5  ink 28371
//     f41  t 3.85  anticipation  w 648  h 158  cx 559.5  cy 444.5  ink 28371
//
// "identical TO THE DIGIT", because `squashX`/`squashY` had no render consumer
// — `sampleHeroMotion` computed them and the only reader in the repo printed
// them as text in a panel. `shadow` was the same class one step earlier: the
// field existed, the contact shadow read `1 - flatten.ink`, and the host never
// passed the model's own value.
//
// So the test is the storyboard's own: measure the mark's BOUNDING BOX across
// the breath→anticipation boundary and require it to MOVE, in the direction and
// by the amount the dials say.
//
//   scaleY 0.955 on h 158  ->  ~151
//   scaleX 1.018 on w 648  ->  ~660
//
// NEGATIVE CONTROL, and it is the whole point: `--control=flat` sets the two
// anticipation dials to 1.000 through the page's own sliders and requires the
// frames to go back to being identical. A row that reports "the box moved"
// without ever having seen it not move is not evidence.
//
// Usage: node scripts/verify/assert-hero-dead-channels.mjs [--control=flat]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const CONTROL = (process.argv.find((a) => a.startsWith("--control=")) ?? "").split("=")[1] ?? ""
const CONTROLS = ["flat", "unrelated-red"]
/* ⚠ AN UNRECOGNISED `--control=` USED TO PRINT A CONFIDENT LIE (2026-08-28).
 *
 * `CONTROL` was never checked against anything. `--control=typo` skipped both
 * mutation blocks, left the dials alone, ran the beat unmodified, found `squash`
 * and `widen` green as they should be, and printed:
 *
 *     UNSOUND — with both dials at 1.000 the squash and widen row(s) PASSED.
 *
 * The dials were never touched. The sentence asserts a precondition that did not
 * happen, and it exits 1, so it reads as a real failure of the gate. It also
 * left a `docs/verification/hero-dead-channels/typo/` behind when it finished.
 *
 * The refusal idiom is the repo's, not a new one: `assert-hero-option-panel`,
 * `assert-hero-switch` and `assert-hero-transition` all answer an unknown key
 * with exit 2, and `assert-gate-integrity.mjs` measured every exit-2 across all
 * 95 gates as the same thing — a gate DECLINING to judge, which is the opposite
 * of a withheld judgement. It names `unknown --control="x"` first in that list,
 * so the idiom was already credited to this flag. It just was not here.
 *
 * The check sits ABOVE `stageEvidence` so a typo also stops leaving a directory. */
if (CONTROL && !CONTROLS.includes(CONTROL)) {
  console.error(`unknown --control=${CONTROL} (${CONTROLS.join(" | ")})`)
  process.exit(2)
}
/* STAGED. `docs/verification/hero-dead-channels/<control|after>`, 3 tracked
 * files, and the `--control` arm picks the directory. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "hero-dead-channels", CONTROL || "after")
const EV = stageEvidence(FINAL)
const OUT = EV.dir
const VIEW = { width: 1600, height: 1600 }

let pass = true
/* ROWS ARE NAMED NOW, AND THE `--control=flat` VERDICT IS THE REASON.
 *
 * ⚠ DEFECT (class 7, skip/unrelated-red-as-proof): the control's verdict used to
 * read the GLOBAL `pass` flag. That flag also carries "both phases were sampled"
 * and "no page errors", neither of which is a squash row. So a single console
 * error — or a scrub that never reached `anticipation` — printed
 * "SOUND — with the dials flat, the squash rows correctly FAIL" while the squash
 * rows had not been shown to fail at all, and in the sampling case had not been
 * evaluated. A control that can be satisfied by an unrelated red is not a
 * control. The verdict below now names the two rows it is about. */
const ROWS = new Map()
const say = (ok, label, detail, key = null) => {
  if (!ok) pass = false
  if (key) ROWS.set(key, { ok, label, detail })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}
/** Printed, never scored — a parked prior statistic keeps its evidence visible. */
const note = (label, detail) => console.log(`note  ${label}${detail ? " — " + detail : ""}`)

async function measure(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  /* AN ABSOLUTE DARK CUT, AND THE FIRST VERSION OF THIS FUNCTION IS WHY.
   *
   * It thresholded relative to the image's modal luma (paper − 45), which is
   * right for "is there a mark at all" and WRONG for a bounding box: the stage
   * draws a grid and a ground plane that run the full height, so the mask came
   * back h 1001 on a word 158 px tall and the squash was invisible inside it.
   * The reported height did not move by a pixel across the whole beat, which
   * would have read as the dead channel still being dead. It was the
   * instrument.
   *
   * The mark is near-black in both registers by construction — Desk Doodles'
   * `deskDoodles` albedo is #2A2622 and Free Stroke's `ink` is #26262b, luma 38
   * and 39 — while nothing else on the stage is below about 200. 120 sits in
   * the empty middle of that gap. */
  const INK_MAX = 120
  const luma = new Uint8Array(img.width * img.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    luma[p] = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
  }
  const cut = INK_MAX
  let n = 0
  let minX = 1e9
  let maxX = -1
  let minY = 1e9
  let maxY = -1
  for (let y = 0; y < img.height; y++) {
    for (let px = 0; px < img.width; px++) {
      if (luma[y * img.width + px] < cut) {
        n++
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  /* `top`/`bottom` ARE THE EDGES, AND THEY ARE NOT A CONVENIENCE — see the
   * CONTACT row below. The bbox MIDPOINT cannot tell a contact-pinned squash
   * from a centre-pinned one, and the edge can. */
  return {
    ink: n,
    w: maxX - minX + 1,
    h: maxY - minY + 1,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    top: minY,
    bottom: maxY,
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

  /* ---- THE CONTROL'S OWN CONTROL ------------------------------------------
   *
   * `--control=unrelated-red` is the known-bad for the VERDICT, not for the
   * beat: it leaves the dials alone (so both squash rows are GREEN and the
   * panel is provably live) and injects one page error (so the global `pass`
   * flag goes false for a reason that has nothing to do with the squash).
   *
   * Under the verdict as it was written — `if (pass) UNSOUND else SOUND` —
   * this arm printed "SOUND — with the dials flat, the squash rows correctly
   * FAIL" and exited 0, on a run in which the dials were never flattened and
   * neither squash row failed. Its required verdict is now UNSOUND / exit 1.
   * A control whose own verdict cannot be wrong is not a control. */
  if (CONTROL === "unrelated-red") {
    await page.evaluate(() => {
      setTimeout(() => {
        throw new Error("injected by --control=unrelated-red: an unrelated console error")
      }, 0)
    })
    await page.waitForTimeout(300)
    console.log(
      "control: dials LEFT ALONE (the squash rows must stay green) and one page error injected",
    )
  }

  if (CONTROL === "flat") {
    // Drive the page's own sliders back to 1.000 — the state in which the two
    // dials genuinely have nothing to say. Uses the labels the panel renders,
    // not an injected global, so a control that cannot reach the UI is a
    // control that fails loudly rather than silently.
    const flattened = await page.evaluate(() => {
      let hit = 0
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      ).set
      for (const row of document.querySelectorAll("label, div")) {
        const txt = (row.textContent ?? "").trim()
        if (!/^Scale [XY]/.test(txt)) continue
        const input = row.querySelector('input[type="range"]')
        if (!input) continue
        setter.call(input, "1")
        input.dispatchEvent(new Event("input", { bubbles: true }))
        input.dispatchEvent(new Event("change", { bubbles: true }))
        hit++
      }
      return hit
    })
    console.log(`control: set ${flattened} anticipation slider(s) to 1.000`)
    if (flattened === 0) {
      console.log("FAIL  the control could not reach the Scale X / Scale Y sliders")
      process.exit(1)
    }
    await page.waitForTimeout(400)
  }

  const span = await page.evaluate(() => {
    const el = document.querySelector("[data-hero-draw-span]")
    return JSON.parse(el.getAttribute("data-hero-draw-span"))
  })
  // Beat layout is cumulative, so anticipation starts after draw + breath. Read
  // the phase tag rather than compute it: the timeline owns the durations.
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
    await page.evaluate(
      () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))),
    )
    await page.waitForTimeout(90)
  }

  // Walk the beat at 40ms and collect one sample per phase tag we care about.
  const rows = []
  for (let t = span.duration; t < span.duration + 2.2; t += 0.04) {
    await seek(t)
    const phase = await page.evaluate(
      () => document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-phase") ?? "",
    )
    if (phase !== "breath" && phase !== "anticipation") continue
    const buf = await page.locator("[data-hero-stage]").screenshot()
    const m = await measure(buf)
    rows.push({ t: +t.toFixed(3), phase, ...m })
  }

  const breath = rows.filter((r) => r.phase === "breath")
  const antic = rows.filter((r) => r.phase === "anticipation")
  console.log("\n  t      phase          ink      w     h     cx      cy")
  for (const r of [...breath.slice(-3), ...antic]) {
    console.log(
      `  ${r.t.toFixed(2)}   ${r.phase.padEnd(13)} ${String(r.ink).padStart(6)}  ${String(r.w).padStart(4)}  ${String(r.h).padStart(4)}  ${r.cx.toFixed(1)}  ${r.cy.toFixed(1)}`,
    )
  }
  writeFileSync(join(OUT, "rows.json"), JSON.stringify(rows, null, 2))
  /* THE SWAP, on completion and not on the pass flag. */
  EV.commit()

  say(breath.length > 0 && antic.length > 0, "both phases were sampled", `${breath.length} breath, ${antic.length} anticipation`, "sampled")
  if (breath.length && antic.length) {
    const b = breath[breath.length - 1]
    // The deepest squash — the compress lands and then holds, so the extreme is
    // what the dials predict, not the mean.
    const minH = Math.min(...antic.map((r) => r.h))
    const maxW = Math.max(...antic.map((r) => r.w))
    const dH = (minH - b.h) / b.h
    const dW = (maxW - b.w) / b.w
    console.log(
      `\n  breath  w ${b.w} h ${b.h}   ->   anticipation  w ${maxW} (${(dW * 100).toFixed(2)} %)  h ${minH} (${(dH * 100).toFixed(2)} %)`,
    )
    console.log(`  the dials say scaleY 0.955 (-4.50 %) and scaleX 1.018 (+1.80 %)`)
    // Half the authored amount: the beat compresses over 6 frames and the scrub
    // grid is 40ms, so the sampled extreme need not be the authored extreme.
    // Anything at or past half is the channel rendering; zero is the dead dial.
    say(dH <= -0.0225, "the anticipation SQUASH renders — the mark loses height", `${(dH * 100).toFixed(2)} %`, "squash")
    say(dW >= 0.009, "the anticipation WIDEN renders — the mark gains width", `${(dW * 100).toFixed(2)} %`, "widen")

    /* ---- the CONTACT pin, measured on the EDGE and not on the midpoint ------
     *
     * ⚠ DEFECT (class 2, the row passed MORE STRONGLY on the defect it names).
     * The assertion here was:
     *
     *     Math.abs(b.cy - antic[antic.length - 1].cy) < 6
     *
     * and that is the wrong statistic in both directions at once.
     *
     *   · A bbox MIDPOINT moves by dh/2 IF AND ONLY IF the squash is pinned at
     *     the contact — the bottom stays, the top comes down, the midpoint
     *     splits the difference. So the number the row was bounding was the
     *     EVIDENCE OF CORRECTNESS, and it was bounding it from above. A
     *     CENTRE-pinned squash — the exact defect the row's own name rejects —
     *     leaves cy at 0.0 delta and passed with a BIGGER margin than the
     *     correct render. The row scored the defect higher than the fix.
     *   · And it was inverted-fragile: measured live at scaleY 0.955 on h 173
     *     the delta is 3.5 px against a bar of 6. At scaleY <= 0.93 the correct,
     *     contact-pinned render produces delta cy = 6 and the row goes RED for
     *     doing its job.
     *
     * The correct statistic is the BOTTOM EDGE — the contact itself. It is the
     * form `assert-hero-flatstate.mjs:226-230` already uses on the same beat
     * ("bottom 495 -> 495 … a centre-pinned squash would have lifted it by
     * ~11 px"), ported here so the two instruments measure the same thing.
     *
     * Judged on the DEEPEST frame, not the last one: the compress lands and then
     * holds, so the deepest squash is where a centre pin lifts the contact
     * furthest, i.e. where the row is most able to fail. */
    const deep = antic.reduce((x, y) => (y.h < x.h ? y : x))
    const dropPx = b.h - deep.h
    const centrePinnedLift = dropPx / 2
    const bottomDrift = Math.abs(deep.bottom - b.bottom)
    say(
      bottomDrift <= 2,
      "the squash is pinned at the CONTACT, not the centre — the baseline holds",
      `bottom ${b.bottom} -> ${deep.bottom} (${bottomDrift.toFixed(1)} px, needs <= 2). ` +
        `The mark loses ${dropPx} px of height here, so a centre-pinned squash would have ` +
        `lifted the contact by ~${centrePinnedLift.toFixed(1)} px — this row can fail.`,
      "contact",
    )

    /* PARKED, NOT DELETED — the prior statistic, printed beside the verdict so
     * what changed is visible rather than described. */
    note(
      "[parked prior statistic, not the verdict] bbox MIDPOINT",
      `cy ${b.cy.toFixed(1)} -> ${antic[antic.length - 1].cy.toFixed(1)} ` +
        `(delta ${Math.abs(b.cy - antic[antic.length - 1].cy).toFixed(1)}, old bar < 6) — ` +
        `this number RISES when the pin is correct and falls to 0 when it is wrong`,
    )

    /* ---- CALIBRATION: a synthetic CENTRE-PINNED squash, required to FAIL -----
     *
     * Not an invented difficulty. It takes the squash the beat ACTUALLY renders
     * — the same ${dropPx} px of lost height, measured a few lines up — and
     * applies the other pin to it, which is precisely the defect. The repaired
     * row must reject it, and the old row must be shown accepting it, or the
     * repair is unproven. */
    const synthBottom = b.bottom - centrePinnedLift
    const synthCy = b.cy // a centre pin does not move the midpoint at all
    const newRowCatches = Math.abs(synthBottom - b.bottom) > 2
    const oldRowCatches = Math.abs(b.cy - synthCy) >= 6
    console.log(
      `\nCALIBRATION — the same ${dropPx} px squash, pinned at the CENTRE instead ` +
        `(bottom ${b.bottom} -> ${synthBottom.toFixed(1)}, cy ${b.cy.toFixed(1)} -> ${synthCy.toFixed(1)})`,
    )
    console.log(
      `  ${newRowCatches ? "caught, correctly" : "MISSED"}  the CONTACT row on the bottom edge: ` +
        `${Math.abs(synthBottom - b.bottom).toFixed(1)} px against a 2 px bar`,
    )
    console.log(
      `  ${oldRowCatches ? "caught" : "MISSED — this is the defect"}  the parked cy row: ` +
        `${Math.abs(b.cy - synthCy).toFixed(1)} px against a 6 px bar` +
        (oldRowCatches ? "" : " — the old assertion passed the centre pin with a PERFECT score"),
    )
    if (dropPx < 2) {
      // NOT APPLICABLE, and named rather than scored: re-pinning a squash that
      // is not there proves nothing. This only ever happens on an arm where the
      // SQUASH row is already red — `--control=flat` is exactly that arm — so
      // scoring it would be a second red for the first red's reason.
      note(
        "CALIBRATION: not applicable",
        `the mark loses ${dropPx} px here, so there is no squash to re-pin. ` +
          `Expected only on an arm where the SQUASH row is already red (it is: ${dH === 0 ? "yes" : "check above"}).`,
      )
    } else if (!newRowCatches) {
      say(false, "CALIBRATION: the CONTACT row cannot catch a centre-pinned squash", `lift ${centrePinnedLift.toFixed(1)} px is inside the 2 px bar — the row is not discriminating`, "calibration")
    } else {
      say(true, "CALIBRATION: the CONTACT row catches a centre-pinned squash", `a synthetic centre pin of the beat's own ${dropPx} px squash lifts the contact ${centrePinnedLift.toFixed(1)} px and is REJECTED`, "calibration")
    }
  }

  say(errors.length === 0, "no page errors", errors.join(" | ") || "0", "console")
  await browser.close()

  if (CONTROL) {
    console.log(`\n=== CONTROL: ${CONTROL} ===`)
    /* THE VERDICT NAMES ITS OWN ROWS. See the note on `ROWS` at the top: reading
     * the global `pass` flag let an unrelated red — a console error, a scrub
     * that never reached the phase — print SOUND without either squash row
     * having been shown to fail. The two rows the control is about are `squash`
     * and `widen`; both must have been EVALUATED and both must have FAILED. */
    const subject = ["squash", "widen"]
    if (CONTROL === "unrelated-red") {
      // Required verdict: UNSOUND. See the injection site above.
      const green = subject.filter((k) => ROWS.get(k)?.ok)
      const red = [...ROWS.entries()].filter(([, v]) => !v.ok).map(([k]) => k)
      const correct = green.length === subject.length && red.length > 0
      console.log(
        `${correct ? "caught, correctly" : "MISSED"}  the squash rows are GREEN (${green.join(", ") || "none"}) ` +
          `while ${red.join(", ") || "nothing"} is red. The old verdict read the GLOBAL pass flag and printed ` +
          `SOUND here; the repaired verdict must print UNSOUND.`,
      )
      console.log(
        correct
          ? "UNSOUND — the squash rows PASSED. Nothing was shown to fail, whatever else is red."
          : "the arm did not reproduce its own precondition — re-run against a live panel",
      )
      process.exit(correct ? 1 : 2)
    }
    const missing = subject.filter((k) => !ROWS.has(k))
    if (missing.length) {
      console.log(
        `UNSOUND — the ${missing.join(" and ")} row(s) never ran, so nothing was shown to fail. ` +
          `A skipped row is not a failed row.`,
      )
      process.exit(1)
    }
    const stillGreen = subject.filter((k) => ROWS.get(k).ok)
    if (stillGreen.length) {
      console.log(
        `UNSOUND — with both dials at 1.000 the ${stillGreen.join(" and ")} row(s) PASSED. They cannot fail.`,
      )
      process.exit(1)
    }
    console.log(
      `SOUND — with the dials flat, the squash rows correctly FAIL (` +
        subject.map((k) => `${k}: ${ROWS.get(k).detail}`).join(" · ") +
        `).`,
    )
    if (!pass) {
      const others = [...ROWS.entries()].filter(([k, v]) => !subject.includes(k) && !v.ok)
      if (others.length)
        console.log(
          `      NOTE — unrelated rows are also red and they are NOT what this control proves: ` +
            others.map(([k]) => k).join(", "),
        )
    }
    process.exit(0)
  }
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
