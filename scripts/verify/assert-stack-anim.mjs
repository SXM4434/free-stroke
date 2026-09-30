// Asserts STACK-LEVEL animation behaves as a group, with each behaviour showing
// its own signature. Written as measurements of ink coverage and frame-to-frame
// change, because "the group faded in" is a claim about how much of the effect
// is present, which a single screenshot cannot settle.
//
// ── THE DEFECT THIS FILE CARRIED, AND WHAT THE FRAMES ACTUALLY SAY ─────────
//   (class 1 — an assertion that cannot discriminate; repaired 2026-08-02)
//
//   Two rows were wrapped in `Math.abs`:
//
//     say(Math.abs(last - first) > 2, "stack fadeIn / presence changes …")
//     say(Math.abs(dAfter - dDuring) > 2, "stack delay / absent during, present after")
//
//   `Math.abs` deletes the only thing those labels claim. "Presence CHANGES" is
//   not the spec; "the group ARRIVES" is. A fadeIn wired backwards — a fade-OUT
//   under a fadeIn name — moves `|last - first|` exactly as far and passes
//   identically. Same for the delay row: `|after - during|` is satisfied by a
//   stack that is present during the reveal and absent after it, which is the
//   precise inversion of the behaviour the row is named for.
//
//   ⚠ AND THE SECOND HALF OF THE DEFECT IS THE MEASURE ITSELF, which is why
//   this repair is not "drop the Math.abs and flip the sign". `presence()` was
//   mean LUMINANCE over covered pixels, and luminance is not presence: this
//   stack's layers (scanline texture + Bayer dither) are INK, so the more of the
//   group arrives the DARKER the frame gets. Measured on stack-anim-v1:
//
//       frame        lum    detail        <- detail = mean |neighbour Δ|
//       fade_00    120.27    10.617
//       fade_07     95.87    31.074
//       delay_during 124.87   8.868       (group absent by construction)
//       delay_after   92.74  37.139       (group present by construction)
//
//   The fade IS running forwards: its high-frequency structure triples,
//   monotonically, 10.6 -> 31.1, and lands on the same number the
//   known-present delay arm reads. Luminance falling 120 -> 96 is the CORRECT
//   signature of ink arriving, not a fade running backwards. So asserting
//   `last > first` on luminance would have turned this gate red on a working
//   surface — a false accusation, which is worse than the silence it replaced.
//
//   The repair is therefore to measure presence with something whose direction
//   does not depend on whether a layer happens to be darker or lighter than what
//   it sits on. `structure()` is the mean absolute neighbour difference over
//   covered pixels: a bare shaded surface is smooth and reads ~9, and every
//   graphic layer this group can contain — scanlines, dither, glyphs — ADDS
//   high-frequency structure whatever its polarity. It rises with presence by
//   construction, so "the group arrives" becomes a directional claim that a
//   reversed fade genuinely fails. The luminance figure is PARKED below, printed
//   as a diagnostic, because it is still the fastest way to see ink polarity.
//
// ── COVERAGE (class 4) ────────────────────────────────────────────────────
//   `StackAnimationBehaviour` (lib/style-stack.ts) is read from source rather
//   than restated here, and every non-`none` member must have frames on disk.
//   Three never did — completionPulse, loop, revealSynced — and nothing said so,
//   because five hardcoded prefixes cannot report what they do not mention.
//
// ── THE TWO KNOWN-BADS NOW RUN ON THE BARE INVOCATION (2026-08-07) ─────────
//   They were `--reverse-fade` and `--swap-delay`, and NO SWEEP EVER PASSED
//   EITHER — so the only two inputs that could show these direction rows able to
//   say no were the two nothing ran. `docs/explainers/21-losing-your-work.md` §7:
//   *"the gate runs three kinds of control on the DEFAULT invocation, never
//   behind a flag"*; explainer 31 counted nineteen violations and this was one.
//
//   The flags are DELETED rather than handed to a runner (explainer 29 §5: a
//   runner-passed flag only helps people who go through a runner). Both controls
//   drive the SAME `arrives()` predicate the real rows do, on deliberately wrong
//   inputs, and the verdict is INVERTED — a control that is not rejected is the
//   failure:
//     · the fade frames graded BACK TO FRONT — a fade-OUT wearing a fadeIn name,
//       exactly what `Math.abs` used to wave through — must be REJECTED;
//     · the delay arms read the WRONG WAY ROUND — present during the reveal,
//       absent after — must be REJECTED.
//   They cost four extra `structure()` evaluations and no extra image decode for
//   the fade (its two frames are already in hand).
//
// Usage: node scripts/verify/assert-stack-anim.mjs
//        node scripts/verify/assert-stack-anim.mjs --label=stack-anim-v2
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
const LABEL = arg("label", "stack-anim-v1")
const DIR = join(__dirname, "..", "..", "docs", "verification", LABEL)

if (!existsSync(DIR) || !readdirSync(DIR).some((f) => f.endsWith(".png"))) {
  console.error(`no frames at ${DIR} — run verify-stack-anim.mjs first`)
  process.exit(1)
}

async function px(f) {
  const img = await loadImage(join(DIR, f))
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height }
}
function diff(a, b) {
  let s = 0, n = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 20 && b.d[i + 3] < 20) continue
    s += (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2])) / 3
    n++
  }
  return n ? s / n : 0
}
const files = (p) => readdirSync(DIR).filter((f) => f.startsWith(p)).sort()
async function motion(p) {
  const fs = files(p)
  let t = 0, prev = await px(fs[0])
  for (let i = 1; i < fs.length; i++) { const c = await px(fs[i]); t += diff(prev, c); prev = c }
  return t / (fs.length - 1)
}

/**
 * HOW PRESENT THE GROUP IS, measured polarity-independently.
 *
 * Mean absolute neighbour difference (right + down) over covered pixels. Every
 * layer this stack can hold is a high-frequency graphic — scanlines, an ordered
 * dither lattice, glyph cells — so structure RISES as the group arrives whether
 * the layer darkens or lightens what it sits on. That is the property mean
 * luminance did not have, and the reason the direction of a fade was untestable
 * with it. See the header for the measured 10.6 -> 31.1 across the fade.
 */
function structure(a) {
  const { d, w, h } = a
  const L = (p) => (d[p] + d[p + 1] + d[p + 2]) / 3
  let s = 0, n = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4
      if (d[i + 3] < 20) continue
      s += Math.abs(L(i) - L(i + 4)) + Math.abs(L(i) - L(i + w * 4))
      n++
    }
  }
  return n ? s / n : 0
}

/* ── PARKED PRIOR, kept as a DIAGNOSTIC and never asserted on ──────────────
 * This was the verdict metric until 2026-08-02. It is not deleted because it is
 * still the quickest read of ink polarity — but it must not decide anything: it
 * moves DOWN when an ink layer arrives and UP when a pale one does, so no fixed
 * direction is correct for it across the presets this rail can hold. */
function parkedLuminancePresence(a) {
  let s = 0, n = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 20) continue
    s += (a.d[i] + a.d[i + 1] + a.d[i + 2]) / 3
    n++
  }
  return n ? s / n : 0
}

const MOVING = 1.0
/* The group's arrival has to clear the frame-to-frame noise of the per-layer
 * animations underneath it, which keep running the whole time. On the shipping
 * capture the fade travels +20.5 structure and the still-frame jitter within the
 * settled `delay_after` arm is under 1.0, so 4.0 sits well above the noise and
 * far under the signal. Set from both known-answer arms, not from taste. */
const ARRIVES = 4.0
let pass = true
const say = (ok, l, d) => { if (!ok) pass = false; console.log(`${ok ? "PASS" : "FAIL"}  ${l}${d ? " — " + d : ""}`) }
/** Signed delta, so a reversed arm reads "−20.46" rather than "+-20.46". */
const signed = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2)

/* ── EVERY BEHAVIOUR THE TYPE DECLARES MUST HAVE EVIDENCE (class 4) ────────
 * Read from lib/style-stack.ts rather than restated, so a tenth behaviour
 * cannot be added and silently graded by nothing. The map is prefix -> the
 * behaviour(s) that prefix's frames were captured for; a behaviour with no
 * prefix has no evidence and is a red row, not a silence. */
const BEHAVIOUR_FRAMES = {
  fadeIn: "fade_",
  pulse: "pulse_",
  drift: "drift_",
  delayAfterReveal: "delay_",
  freezeOnComplete: "freeze_",
  completionPulse: "cpulse_",
  loop: "loop_",
  revealSynced: "rsync_",
}
function declaredBehaviours() {
  const src = readFileSync(join(ROOT, "lib", "style-stack.ts"), "utf8")
  const m = src.match(/export type StackAnimationBehaviour\s*=([\s\S]*?)\n\n/)
  if (!m) throw new Error("could not read StackAnimationBehaviour from lib/style-stack.ts")
  return [...m[1].matchAll(/"([a-zA-Z]+)"/g)].map((x) => x[1]).filter((v) => v !== "none")
}

async function main() {
  /* PROVENANCE FIRST. Grading frames older than the code they describe is not a
   * weaker signal, it is a false one — see _capture-freshness.mjs. */
  const fresh = captureFreshness(DIR, {
    subjects: ["lib/style-stack.ts", "lib/style-system.ts", "lib/style-shader.ts"],
    recapture: "node scripts/verify/verify-stack-anim.mjs",
  })
  say(fresh.ok, fresh.label, fresh.detail)

  const declared = declaredBehaviours()
  const uncovered = declared.filter((b) => !BEHAVIOUR_FRAMES[b] || files(BEHAVIOUR_FRAMES[b]).length === 0)
  say(
    uncovered.length === 0,
    `every StackAnimationBehaviour has frames on disk (${declared.length} declared in lib/style-stack.ts)`,
    uncovered.length
      ? `NO EVIDENCE for ${uncovered.join(", ")} — verify-stack-anim.mjs captures ${Object.keys(BEHAVIOUR_FRAMES).length} of ${declared.length} behaviours, so these are ungraded by this gate and by every other gate in this set`
      : declared.join(", "),
  )

  // fadeIn: the group must be measurably MORE PRESENT at the end than the start.
  // Directional, on purpose — see the header for why `Math.abs` here was the
  // whole defect and why luminance was the wrong quantity to take a sign of.
  /** THE DIRECTION PREDICATE, in one place, so both controls grade the same
   *  clause the real rows do rather than a restatement of it. */
  const arrives = (from, to) => structure(to) - structure(from) > ARRIVES

  const fadeFiles = files("fade_")
  const fadeFirst = await px(fadeFiles[0])
  const fadeLast = await px(fadeFiles[fadeFiles.length - 1])
  const first = structure(fadeFirst)
  const last = structure(fadeLast)
  say(
    arrives(fadeFirst, fadeLast),
    "stack fadeIn / the group ARRIVES — structure rises from start to end",
    `structure ${first.toFixed(2)} -> ${last.toFixed(2)} (${signed(last - first)}, floor +${ARRIVES})` +
      `   [diagnostic, not asserted: luminance ${parkedLuminancePresence(fadeFirst).toFixed(1)} -> ${parkedLuminancePresence(fadeLast).toFixed(1)}, falling because this group's layers are INK]`,
  )

  const pulse = await motion("pulse_")
  say(pulse > MOVING, "stack pulse / the group oscillates", `consecΔ ${pulse.toFixed(2)}`)

  const drift = await motion("drift_")
  say(drift > MOVING, "stack drift / the group slides", `consecΔ ${drift.toFixed(2)}`)

  // delayAfterReveal: the stack is ABSENT during the reveal and PRESENT after.
  // Directional for the same reason as the fade.
  const duringImg = await px(files("delay_during_")[2])
  const afterImg = await px(files("delay_after_")[4])
  const dDuring = structure(duringImg)
  const dAfter = structure(afterImg)
  say(
    arrives(duringImg, afterImg),
    "stack delay / absent during reveal, PRESENT after (in that order)",
    `structure during ${dDuring.toFixed(2)} vs after ${dAfter.toFixed(2)} (${signed(dAfter - dDuring)}, floor +${ARRIVES})` +
      `   [diagnostic: luminance ${parkedLuminancePresence(duringImg).toFixed(1)} vs ${parkedLuminancePresence(afterImg).toFixed(1)}]`,
  )

  // freezeOnComplete: the headline claim — moving, then EXACTLY still.
  const fDuring = await motion("freeze_during_")
  const fAfter = await motion("freeze_after_")
  say(fDuring > MOVING, "stack freeze / layers animate during the reveal", `consecΔ ${fDuring.toFixed(2)}`)
  say(fAfter < 0.5, "stack freeze / EXACTLY still once complete", `consecΔ ${fAfter.toFixed(2)}`)

  /* ── THE CONTROLS · on the bare invocation, verdicts INVERTED ─────────────
   * Each drives `arrives()` — the same clause the two direction rows above use
   * — on an input built to be wrong, and REQUIRES it to say no. A control that
   * is not rejected means the row above it could not have failed either. */
  let controlFailed = 0
  const control = (ok, label, detail) => {
    if (!ok) controlFailed++
    console.log(`${ok ? "PASS" : "FAIL"}  CONTROL · ${label}${detail ? " — " + detail : ""}`)
  }
  const revFade = arrives(fadeLast, fadeFirst)
  control(
    !revFade,
    "KNOWN-BAD — the fade graded BACK TO FRONT (a fade-OUT under a fadeIn name) is REJECTED",
    `structure ${last.toFixed(2)} -> ${first.toFixed(2)} (${signed(first - last)}, floor +${ARRIVES}) → ` +
      `${revFade ? "ACCEPTED — THIS ROW CANNOT FAIL" : "rejected, as required"}. ` +
      `This is exactly what the parked \`Math.abs(last - first) > 2\` waved through.`,
  )
  const swapDuring = await px(files("delay_after_")[2])
  const swapAfter = await px(files("delay_during_")[4])
  const swapped = arrives(swapDuring, swapAfter)
  control(
    !swapped,
    "KNOWN-BAD — the delay arms read the WRONG WAY ROUND (present during, absent after) is REJECTED",
    `structure ${structure(swapDuring).toFixed(2)} -> ${structure(swapAfter).toFixed(2)} ` +
      `(${signed(structure(swapAfter) - structure(swapDuring))}, floor +${ARRIVES}) → ` +
      `${swapped ? "ACCEPTED — THIS ROW CANNOT FAIL" : "rejected, as required"}`,
  )
  if (controlFailed) pass = false

  console.log(pass ? "\nALL STACK-ANIMATION ASSERTIONS PASS" : "\nSTACK-ANIMATION FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}
main().catch((e) => { console.error(e); process.exit(1) })
