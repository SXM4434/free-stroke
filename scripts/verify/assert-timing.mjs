// Turns the timing captures into pass/fail assertions.
//
// A mode "moves" if consecutive frames differ. The point of this script is that
// each mode must move in its OWN pattern — a delayed layer that animates during
// the reveal is broken even though it animates, and a pulse that never stops is
// broken even though it bursts.
//
// ── WHAT THIS FILE DOES NOT COVER, NOW SAID OUT LOUD (class 4) ─────────────
//
//   `StyleSyncMode` (lib/style-system.ts) declares SIX members. This gate grades
//   five frame groups — A_independent_, A_loopSynced_, B_delayed_, C_pulse_,
//   D_reveal_ — and `strokeTimeSynced` is in none of them. It is tested by no
//   gate in this set at all: assert-material-craft's timing phase has no frames,
//   and assert-stack-anim covers the STACK behaviours, not the per-layer sync
//   modes. A mode with no evidence anywhere reads exactly like a mode that
//   passed, which is why the gap is asserted below rather than left in a comment.
//
// ── AND THE FLOOR IS A HUNDREDFOLD LOOSE (class 5) ─────────────────────────
//
//   MOVING = 1.0 against measured 114.36 / 96.32 / 103.58 / 43.01 / 97.94 — the
//   live rows clear it by 43x to 114x, and the "still" rows read EXACTLY 0.00.
//   Nothing lives between 0 and 1, so the threshold is not separating anything:
//   it is a bimodal signal with the line drawn in the empty middle. That is not
//   harmful on its own, but it means the number has never been calibrated and
//   would not notice an animation degrading by 90% and still "moving".
//
//   Line 86's ratio was worse than loose, it was DEGENERATE:
//     say(delayedAfter > delayedDuring * 3, "after is clearly livelier than during")
//   with `delayedDuring` measured at exactly 0.00, the right-hand side is 0 and
//   ANY positive value passes — including 0.0001, i.e. a layer that never starts.
//   A ratio against a measured zero is not a comparison. It is now an absolute
//   separation with the still-floor stated, which a near-dead layer fails.
//
// Usage: node scripts/verify/assert-timing.mjs
//        node scripts/verify/assert-timing.mjs --label=timing-v2
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readdirSync, existsSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { captureFreshness, ROOT } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
/* See assert-stack.mjs: the evidence directory is an argument so this gate can
 * be pointed at nothing and shown to refuse. */
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "timing-v1")
const DIR = join(__dirname, "..", "..", "docs", "verification", LABEL)
/* DEFERRED — the CONTROLS below need no frames, and a gate that skips its own
 * controls because the SUBJECT's evidence is missing has the dependency
 * backwards. Handled after `main()` starts. */
const NO_FRAMES = !existsSync(DIR) || !readdirSync(DIR).some((f) => f.endsWith(".png"))

async function px(f) {
  const img = await loadImage(join(DIR, f))
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return c.getContext("2d").getImageData(0, 0, img.width, img.height).data
}
function diff(a, b) {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 20 && b[i + 3] < 20) continue
    sum += (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3
    n++
  }
  return n ? sum / n : 0
}
/** Mean consecutive-frame change across a named group of frames. */
async function motion(prefix) {
  const files = readdirSync(DIR).filter((f) => f.startsWith(prefix)).sort()
  if (files.length < 2) throw new Error(`not enough frames for ${prefix}`)
  let total = 0
  let prev = await px(files[0])
  for (let i = 1; i < files.length; i++) {
    const cur = await px(files[i])
    total += diff(prev, cur)
    prev = cur
  }
  return total / (files.length - 1)
}

const MOVING = 1.0 // mean consecutive change above this = the layer is animating
/* THE STILL FLOOR, stated so the "livelier after than during" row can be an
 * absolute separation instead of a ratio against a measured 0.00. The still arms
 * on this capture read exactly 0.00 and the live arms 43-114, so requiring the
 * gap itself to clear 10x MOVING sits two orders under the signal and an order
 * over anything a still arm has ever produced. */
const CLEARLY_LIVELIER = MOVING * 10
let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/** `StyleSyncMode`, from source — see the header on why the six are counted. */
function declaredSyncModes() {
  const src = readFileSync(join(ROOT, "lib", "style-system.ts"), "utf8")
  const m = src.match(/export type StyleSyncMode\s*=([\s\S]*?)\n\n/)
  if (!m) throw new Error("could not read StyleSyncMode from lib/style-system.ts")
  return [...m[1].matchAll(/"([a-zA-Z]+)"/g)].map((x) => x[1])
}
/** Which frame prefix carries evidence for each declared sync mode. */
const MODE_FRAMES = {
  independent: "A_independent_",
  loopSynced: "A_loopSynced_",
  delayedAfterReveal: "B_delayed_",
  completionPulse: "C_pulse_",
  revealSynced: "D_reveal_",
  strokeTimeSynced: "E_stroketime_",
}
const framesFor = (p) => readdirSync(DIR).filter((f) => f.startsWith(p)).length

/* ═══════════════════════════════════════════════════════════════════════════
 * THE CONTROL — the parked prior, EXECUTED instead of printed.
 *
 * Until 2026-08-07 this gate had no control of any kind. The parked prior was
 * described in a comment at `:155` and quoted inside a DETAIL STRING at `:166`,
 * where it changed no verdict — so the gate carried its own counter-evidence as
 * prose and could not notice if the replacement ever stopped biting.
 *
 * Both predicates are stated here as functions and run against the SAME
 * deliberately-wrong input, in both directions. The known-bad is not invented:
 * it is exactly what the comment says the prior degenerates on, and
 * `delayedDuring` reads 0.00 on every capture this gate has ever graded.
 *
 *   a layer that barely twitches once:  after 0.01, during 0.00
 *     PARKED   after > during * 3   ->  0.01 > 0     ->  ACCEPTS  (blind)
 *     SHIPPED  after - during > 10  ->  0.01 > 10    ->  REJECTS  (bites)
 *
 * A control that only proved the new rule works would not have shown the old one
 * was broken, and "we replaced it" is the claim being tested.
 * ═══════════════════════════════════════════════════════════════════════════ */
const parkedLivelier = (after, during) => after > during * 3
const shippedLivelier = (after, during) => after - during > CLEARLY_LIVELIER

function timingControls() {
  console.log("\n=== CONTROLS · the parked prior, run rather than quoted ===")
  const CASES = [
    {
      after: 0.01, during: 0.0,
      parked: true, shipped: false,
      why: "A LAYER THAT BARELY TWITCHES ONCE. This is the defect: with `during` at 0.00 — which is what every capture reads — the parked RATIO accepts any positive number at all. A multiplicative margin needs a non-zero baseline to be a margin.",
    },
    {
      after: 40.0, during: 0.0,
      parked: true, shipped: true,
      why: "a genuinely livelier layer — BOTH rules accept it, so the replacement did not simply get stricter about everything",
    },
    {
      after: 9.0, during: 0.0,
      parked: true, shipped: false,
      why: "just under the absolute floor: the shipped rule still says no where the parked one says yes",
    },
  ]
  for (const c of CASES) {
    const p = parkedLivelier(c.after, c.during)
    const s = shippedLivelier(c.after, c.during)
    say(
      p === c.parked && s === c.shipped,
      `CONTROL · KNOWN-BAD after ${c.after} / during ${c.during} — parked ${p ? "ACCEPTS" : "rejects"}, shipped ${s ? "accepts" : "REJECTS"} (predicate-level, not the capture)`,
      c.why,
    )
  }
}

async function main() {
  /* FIRST, and with no capture — the run that most needs to know the instrument
   * is awake is the one whose frames are missing. */
  timingControls()
  if (NO_FRAMES) {
    /* EXIT 3 — PARTIAL, Lane K's ladder. Nothing failed and the subject channel
     * was never REACHED. Exiting 1 made this a bare RED in every tree without a
     * capture run; exiting 0 was never on the table. */
    console.error(`\nUNSWEPT  the timing subject — no frames at ${DIR}. Recapture with \`node scripts/verify/verify-timing.mjs\`.`)
    console.error(
      pass
        ? `\nNOT A PASS AND NOT A FAILURE — the controls held; the subject was never reached.`
        : `\nCONTROL FAILURE — the controls ran and one of them did not hold.`,
    )
    process.exit(pass ? 3 : 1)
  }
  /* PROVENANCE. timing-v1 was captured 2026-07-28 16:18 and lib/style-clock.ts
   * was last written 2026-08-01 23:57 — four days and eight hours. Every row
   * below was describing a build that no longer existed, and nothing said so. */
  const fresh = captureFreshness(DIR, {
    subjects: ["lib/style-clock.ts", "lib/style-system.ts", "lib/style-shader.ts"],
    recapture: "node scripts/verify/verify-timing.mjs",
  })
  say(fresh.ok, fresh.label, fresh.detail)

  const declared = declaredSyncModes()
  const uncovered = declared.filter((m) => !MODE_FRAMES[m] || framesFor(MODE_FRAMES[m]) === 0)
  say(
    uncovered.length === 0,
    `every StyleSyncMode has frames on disk (${declared.length} declared in lib/style-system.ts)`,
    uncovered.length
      ? `NO EVIDENCE for ${uncovered.join(", ")} — and no other gate in this set covers it either (assert-material-craft --phase=timing has no captures, assert-stack-anim grades stack behaviours not per-layer sync modes)`
      : declared.join(", "),
  )

  const indep = await motion("A_independent_")
  say(indep > MOVING, "independent / animates freely", `consecΔ ${indep.toFixed(2)}`)

  const loop = await motion("A_loopSynced_")
  say(loop > MOVING, "loopSynced / animates", `consecΔ ${loop.toFixed(2)}`)

  const delayedDuring = await motion("B_delayed_during_")
  const delayedAfter = await motion("B_delayed_after_")
  say(
    delayedDuring < MOVING,
    "delayedAfterReveal / STILL while the reveal runs",
    `consecΔ ${delayedDuring.toFixed(2)}`,
  )
  say(
    delayedAfter > MOVING,
    "delayedAfterReveal / animates once the reveal ends",
    `consecΔ ${delayedAfter.toFixed(2)}`,
  )
  /* PARKED PRIOR — `delayedAfter > delayedDuring * 3`.
   * It degenerates whenever `delayedDuring` is 0.00, which is what it MEASURES
   * on every capture this gate has ever graded: the right-hand side becomes 0
   * and every positive number on the left passes, including a layer that barely
   * twitches once. A multiplicative margin needs a non-zero baseline to be a
   * margin at all. Replaced by an ABSOLUTE separation, which does not care what
   * the still arm reads and fails a layer that never really starts. */
  say(
    shippedLivelier(delayedAfter, delayedDuring),
    "delayedAfterReveal / after is clearly livelier than during",
    `gap ${(delayedAfter - delayedDuring).toFixed(2)} (${delayedAfter.toFixed(2)} vs ${delayedDuring.toFixed(2)}), floor ${CLEARLY_LIVELIER.toFixed(2)}` +
      `   [the parked ratio delayedAfter > delayedDuring*3 passes any positive value while during reads ${delayedDuring.toFixed(2)}]`,
  )

  const pulseBefore = await motion("C_pulse_before_")
  const pulseBurst = await motion("C_pulse_burst_")
  const pulseSettled = await motion("C_pulse_settled_")
  say(pulseBefore < MOVING, "completionPulse / silent before completion", `consecΔ ${pulseBefore.toFixed(2)}`)
  say(pulseBurst > MOVING, "completionPulse / bursts at completion", `consecΔ ${pulseBurst.toFixed(2)}`)
  say(
    pulseSettled < MOVING,
    "completionPulse / decays back to still (it is ONE-SHOT)",
    `consecΔ ${pulseSettled.toFixed(2)}`,
  )

  const revealHeld = await motion("D_reveal_held_")
  const revealScrub = await motion("D_reveal_scrub_")
  say(
    revealHeld < MOVING,
    "revealSynced / static when the playhead is static",
    `consecΔ ${revealHeld.toFixed(2)}`,
  )
  say(
    revealScrub > MOVING,
    "revealSynced / driven by scrubbing the reveal",
    `consecΔ ${revealScrub.toFixed(2)}`,
  )

  console.log(pass ? "\nALL TIMING ASSERTIONS PASS" : "\nTIMING FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
