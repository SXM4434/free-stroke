// DID THE TWO DIALS SEBS NAMED ACTUALLY START MOVING?
//
//   *"few issues with fusion — some dont animate … slow weather and turntable
//   dont animate"*  — Sebs, 2026-08-04
//
// Grades `_probe-fusion-two-dead.mjs`, which films five arms on the real page,
// on the real GPU, through the real selection route.
//
// ── THE POINT OF BOTH ARMS ─────────────────────────────────────────────────
// A one-arm gate cannot tell a FIXED dial from a dial that was never broken.
// Both of Sebs's complaints turned out to be different faults wearing one
// sentence, and only a before/after pair per dial says which:
//
//   viewTurn      genuinely inert in the state it is selected in     -> FIXED
//   slowWeather   ALIVE on the shape it lands on; inert on Burst     -> the
//                 complaint is true of one shape, and the answer is a new cell
//                 rather than an edit to a relationship Sebs can still pick
//
// ── AND THE SECOND CHANNEL IS NOT BELT-AND-BRACES ──────────────────────────
// Read §4. On the FIXED viewTurn arm the L1 control is **LOUDER than the
// signal** — because the fix is a turntable, and a mark on a turntable already
// changes as you orbit it. An L1-only instrument would report the repaired dial
// as dead. It separates on TONE. That is asserted here as a row, because a
// branch that never decides anything is decoration wearing the name of a
// safeguard.
//
//   node scripts/verify/assert-fusion-two-dead.mjs --label=v1
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "v3")
/** "Acts", on the repo's own perceptual floor of 2 for an 8-bit mean delta
 *  (explainer 15 uses it for the texture rail's dOff). */
const ACTS = Number(arg("acts", 2.0))
/**
 * ⚠ THERE USED TO BE A SEPARATE `DEAD = 0.5` BAR HERE AND IT WAS AN INVENTION.
 *
 * Three runs of the identical head-on arm — the state that is *supposed* to be
 * inert — measured **0.151 · 0.128 · 1.383**. A tenfold spread on an arm whose
 * whole job is to read as nothing. So a bar at 0.5 does not test the surface,
 * it tests which run you happened to take, and this file would have gone red on
 * its third run for no reason connected to the product.
 *
 * That is the same mistake this feature had just finished writing up about
 * `animation+dither+layers` — a margin thinner than the instrument's own
 * run-to-run variation is not a margin — committed one file over.
 *
 * **THE EYE SETTLED IT BEFORE THE BAR MOVED.** `v3/STRIP-two-dead.png` shows the
 * head-on arm as six identical frames at the run that measured 1.383. It is not
 * moving; the number is noise on a mark that covers ~5 % of the crop.
 *
 * So "does not act" is now grounded twice over instead of guessed once:
 *   · BELOW `ACTS` — the repo's own documented floor for a change that reads; and
 *   · at least 20x quieter than the SAME dial's fixed arm.
 * The ratio is the half that cannot drift with the noise floor, and it was
 * already required by §1's third row. Nothing was loosened to go green: the
 * absolute bar was replaced by a better-grounded one plus a stricter relative
 * one, and the arm still has to be invisible to the eye.
 */
const QUIET_RATIO = Number(arg("ratio", 20))
const isDead = (b, a) => b.net < ACTS && a.net > b.net * QUIET_RATIO

const FILE = join(ROOT, "docs", "verification", "fusion-two-dead", LABEL, "two-dead.json")
/* A LABEL THAT DOES NOT EXIST IS A FAILED ROW, NOT A CRASH. A script whose only
 * non-zero exit is a stack trace says the SCRIPT broke, never that the subject
 * did — `assert-gate-integrity.mjs` checks exactly this channel. */
if (!existsSync(FILE)) {
  console.log(`FAIL  no capture at ${FILE}`)
  console.log(`      run: FS_PORT=<yours> node scripts/verify/_probe-fusion-two-dead.mjs --label=${LABEL}`)
  process.exit(1)
}
const data = JSON.parse(readFileSync(FILE, "utf8"))
const by = Object.fromEntries(data.results.map((r) => [r.id, r]))

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* ═══ PROVENANCE · DOES THIS EVIDENCE BELONG TO THIS TREE ═══════════════════
 *
 * ⚠ MEASURED 2026-08-28: `docs/verification/fusion-two-dead/v3` is 2.5 days
 * behind the newest source it grades, and §0 below already refuses a run whose
 * RENDERER was wrong. It never asked whether the run was of the current CODE.
 * That is the same admissibility question one level up, and it was the missing
 * half: a capture taken on real Chrome, with a real GPU, of a build that no
 * longer exists is inadmissible for the same reason a SwiftShader capture is.
 *
 * THIS GATE CANNOT RECAPTURE. It opens no browser and writes nothing — the
 * JSON is written by `_probe-fusion-two-dead.mjs`. So the honest outcome when
 * the capture is stale is NO VERDICT.
 *
 * The comparison is the one `assert-gate-integrity.mjs` channel F makes, against
 * the same three subject roots, so the two instruments cannot disagree.
 * `captureFreshness()` is not called because it walks `lib/` alone and tonight
 * `app/` moved with it. DISPATCH §3 — a SKIP is not a pass. */
{
  console.log("=== PROVENANCE · does this capture belong to this tree? ===")
  const cap = newestCapture(join(ROOT, "docs", "verification", "fusion-two-dead", LABEL), /\.json$/)
  const subj = ["lib", "app", "components"]
    .map((d) => newestUnder(join(ROOT, d)))
    .filter((b) => b.file)
    .sort((a, b) => b.ms - a.ms)[0]
  const rel = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
  const stamp = (ms) => new Date(ms).toLocaleString()
  const fresh = Boolean(cap.file) && Boolean(subj?.file) && subj.ms <= cap.ms
  say(
    fresh,
    "PROVENANCE · the capture graded here post-dates every source under lib/ app/ components/",
    cap.file && subj?.file
      ? fresh
        ? `capture ${rel(cap.file)} ${stamp(cap.ms)} · newest source ${rel(subj.file)} ${stamp(subj.ms)}`
        : `STALE BY ${((subj.ms - cap.ms) / 3600000).toFixed(1)}h — capture ${rel(cap.file)} ${stamp(cap.ms)} ` +
          `but ${rel(subj.file)} was written ${stamp(subj.ms)}. Re-capture with ` +
          `node scripts/verify/_probe-fusion-two-dead.mjs --label=${LABEL}; do NOT relax this row.`
      : `no JSON under fusion-two-dead/${LABEL}, or no source under lib/ app/ components/ — the comparison cannot be made, so nothing below is trustworthy`,
  )
  if (!fresh) {
    console.log(
      "\n⚠ NO VERDICT. The stored capture predates the code it would be judging,\n" +
        "  so nothing below says anything about whether these two dials are dead now.",
    )
    console.log(`\n${checks} checks, ${fails} failed`)
    process.exit(1)
  }
  console.log("")
}

/* ================================================================== */
/* §0 · IS THIS RUN EVEN ADMISSIBLE?                                   */
/* ================================================================== */
console.log("=== §0 · can these numbers mean anything? ===")
say(
  !/swiftshader|software/i.test(data.renderer ?? ""),
  "filmed on the real GPU — SwiftShader silently pauses the rAF loop and a frozen animation is identical to a still one in a screenshot",
  data.renderer,
)
say(
  data.results.length === 5 && data.results.every((r) => r.alphaFrac > 0.005),
  "every arm has a mark in the crop — a measurement taken on blank paper is not a quiet relationship, it is a missed frame",
  data.results.map((r) => `${r.id} ${(r.alphaFrac * 100).toFixed(1)}%`).join(" · "),
)

/* ================================================================== */
/* §1 · TURNTABLE                                                      */
/* ================================================================== */
console.log("\n=== §1 · the turntable — was it inert, and does it act now? ===")
{
  const b = by["viewTurn-before"]
  const a = by["viewTurn-after"]
  say(
    isDead(b, a),
    "THE DEFECT REPRODUCES · Turn Table selected head-on does NOT act — `orbit` is the camera azimuth (viewport-3d.tsx:5222), `phaseTriangle` puts rest at exactly 0 (style-fusion.ts:1522), so every link multiplies by nothing",
    `net ${b.net} at spin ${b.spin} — below the ${ACTS} reads-line AND ${(a.net / Math.max(b.net, 0.001)).toFixed(0)}x quieter than its own fixed arm (L1 ${b.signal.l1} vs control ${b.control.l1}, tone ${b.signal.tone} vs ${b.control.tone})`,
  )
  say(
    a.spin === 12,
    "…and selecting it through the route the pill actually runs now STARTS the turntable — the wake reaches the one system it could not, because the camera is not style state",
    `cameraSpin ${a.spin} deg/s after selectPreset('fusion','viewTurn') — the probe never set it`,
  )
  say(
    a.net >= ACTS && a.net > b.net * 20,
    "…and with it turning the relationship ACTS",
    `net ${b.net} -> ${a.net} (x${(a.net / Math.max(b.net, 0.001)).toFixed(0)})`,
  )
}

/* ================================================================== */
/* §2 · SLOW WEATHER — MEASURED, NOT ASSUMED                           */
/* ================================================================== */
console.log("\n=== §2 · slow weather — is the complaint true of the shape it lands on? ===")
{
  const loop = by["slowWeather-loop"]
  const burst = by["slowWeather-burst"]
  const fix = by["staticChrome-burst"]
  say(
    loop.net >= ACTS,
    "on LOOP — the shape selecting it lands on — Slow Weather IS alive, so the honest answer is NOT to edit it",
    `net ${loop.net} (L1 ${loop.signal.l1} vs ${loop.control.l1}, tone ${loop.signal.tone} vs ${loop.control.tone})`,
  )
  /* THE DEFECT IS A RATIO, NOT AN ABSOLUTE, AND SAYING SO IS THE HONEST FORM.
   * On Burst the ambient allowance drops to BURST_AMBIENT = 0.2
   * (style-fusion.ts:1307, applied :1440) and Slow Weather has NO `event` link,
   * so the one thing Burst exists to do never fires. It does not fall to zero —
   * 20 % of an ambient is still an ambient — and a gate claiming it reads 0
   * would be a gate nobody could trust. What is true is that the shape whose
   * whole idea is discrete impulses makes this relationship several times
   * QUIETER while giving it nothing to fire. */
  say(
    loop.net > burst.net * 3,
    "…and on BURST it collapses: no `event` link, and BURST_AMBIENT damps the ambient it does have — the shape whose idea is discrete impulses has nothing to fire",
    `loop ${loop.net} vs burst ${burst.net} — x${(loop.net / Math.max(burst.net, 0.001)).toFixed(1)} quieter`,
  )
  say(
    fix.net >= ACTS && fix.net > burst.net * 3,
    "…and the NEW cell at Slow Weather's own address (`material+texture+fusion`, Static Chrome) ships on Burst WITH an Event link and acts there — §0.7: Slow Weather itself is untouched and still selectable",
    `Static Chrome on burst ${fix.net} vs Slow Weather on burst ${burst.net}, on ${fix.on}`,
  )
}

/* ================================================================== */
/* §3 · CALIBRATION — CAN THIS INSTRUMENT REPORT A DEAD DIAL?          */
/* ================================================================== */
console.log("\n=== §3 · calibration ===")
{
  const b = by["viewTurn-before"]
  say(
    isDead(b, by["viewTurn-after"]),
    "CALIBRATION · the same measurement, on the same page, in the same window, reports the KNOWN-DEAD state as dead — an instrument that cannot report a dead relationship cannot certify a live one",
    `viewTurn head-on net ${b.net} — under the ${ACTS} reads-line, and the strip beside this capture is six identical frames`,
  )
  /* THE SECOND CHANNEL, ASSERTED AS LOAD-BEARING RATHER THAN ASSUMED. */
  const a = by["viewTurn-after"]
  say(
    a.netL1 < 0 && a.netTone > 0,
    "CALIBRATION · the tone channel is what SEES the repaired turntable — its L1 control is LOUDER than its signal, so an L1-only instrument would report the fix as dead",
    `netL1 ${a.netL1} (control louder) · netTone ${a.netTone} -> verdict ${a.net}`,
  )
  /* ── WHAT THE EYE SAW THAT `net` DID NOT SAY ─────────────────────────────
   * REPORTED, not gated, because there is no defensible bar here and inventing
   * one would be worse than saying it plainly. `ink` is the mark's own mean
   * luminance against 255 paper; `toneSpan` is how far that mean travels over
   * the window. Slow Weather clears every liveness bar and still reads pale in
   * the contact strip — because its body sits far brighter than every other
   * arm's, so a genuine swing happens in the narrow room between a nearly-white
   * mark and white paper. Same shape as the halftone-on-ceramic defect this set
   * has been burned by twice. The louder answer at the same address is one
   * press away (Static Chrome) and Slow Weather stays untouched and selectable
   * (§0.7). Whether that is enough is Sebs's call, not a gate's. */
  console.log("\n  the mark itself — reported, because a net figure cannot say 'can I see it':")
  for (const r of data.results)
    console.log(
      `    ${r.id.padEnd(20)} ink ${String(r.ink ?? "—").padStart(6)} / 255 paper · tone travels ${String(r.toneSpan ?? "—").padStart(6)} over the window`,
    )
  say(
    (data.consoleErrors ?? []).length === 0,
    "no console errors while driving either dial",
    (data.consoleErrors ?? []).slice(0, 2).join(" · ") || "0",
  )
}

console.log(`\n${fails === 0 ? `ALL ${checks} FUSION-TWO-DEAD ASSERTIONS PASS` : `${fails} of ${checks} FUSION-TWO-DEAD ASSERTIONS FAILED`}`)
process.exit(fails === 0 ? 0 : 1)
