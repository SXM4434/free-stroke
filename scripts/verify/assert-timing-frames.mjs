// Turns the timing-origin FRAMES into verdicts, and prints the envelope each
// run traced so the shape can be read as numbers as well as looked at.
//
// The measure is deliberately blunt and shared by every run: mean absolute RGB
// difference from the run's own `_00_before` frame, over pixels where either
// frame has ink. That is "how far has this option moved the picture away from
// where it started" — which is exactly the envelope, whatever the option
// happens to modulate. Every check below is a statement about the SHAPE of that
// curve, not about its size.
//
// Usage: node scripts/verify/assert-timing-frames.mjs --label=after
//        node scripts/verify/assert-timing-frames.mjs --label=before   (should fail)
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=")[1] : d
}
const LABEL = arg("label", "after")
const DIR = join(ROOT, "docs", "verification", "timing-origin", LABEL)
if (!existsSync(DIR)) {
  console.error(`no frames at ${DIR} — run verify-timing-origin.mjs --label=${LABEL} first`)
  process.exit(1)
}

const cache = new Map()
async function px(file) {
  if (cache.has(file)) return cache.get(file)
  const img = await loadImage(join(DIR, file))
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  const v = c.getContext("2d").getImageData(0, 0, img.width, img.height).data
  cache.set(file, v)
  return v
}
function diff(a, b) {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.length; i += 4) {
    if (a[i + 3] < 20 && b[i + 3] < 20) continue
    sum +=
      (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3
    n++
  }
  return n ? sum / n : 0
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".png")).sort()
const of = (prefix) => files.filter((f) => f.startsWith(prefix + "_"))

let pass = 0
let fail = 0
const failures = []
function check(name, ok, detail = "") {
  if (ok) {
    pass++
    console.log(`PASS  ${name}${detail ? " — " + detail : ""}`)
  } else {
    fail++
    failures.push(name)
    console.log(`FAIL  ${name}${detail ? " — " + detail : ""}`)
  }
}
const f2 = (v) => v.toFixed(2)

/** Envelope of a run: distance from its own first frame, per sample. */
async function envelope(prefix) {
  const fs = of(prefix)
  if (!fs.length) return null
  const base = await px(fs[0])
  const out = []
  for (const f of fs.slice(1)) out.push(await diff(base, await px(f)))
  return out
}
const curve = (e) => "[" + e.map((v) => v.toFixed(1)).join(" ") + "]"

console.log(`\n=== timing-origin frames — label "${LABEL}" (${files.length} frames) ===\n`)

/* ═══ PROVENANCE · DOES THIS EVIDENCE BELONG TO THIS TREE ═══════════════════
 *
 * ⚠ MEASURED 2026-08-28: `docs/verification/timing-origin/after` is 23.5 days
 * behind the newest source it grades. Eleven checks below read those PNGs and
 * every one of them printed PASS, describing a build that has since had a broad
 * nib land in `geometry-engines.ts`, nine stub strokes dropped, and the cascade
 * clip rewritten. A green row on stale frames is not a weak signal, it is a
 * FALSE one: it says "the current code does X" on evidence that cannot speak
 * about the current code at all.
 *
 * THIS GATE CANNOT RECAPTURE. It opens no browser and writes nothing — it only
 * reads what `verify-timing-origin.mjs` left behind. So the honest outcome when
 * the frames are stale is NO VERDICT, not a softer verdict.
 *
 * The comparison is the one `assert-gate-integrity.mjs` channel F makes, against
 * the same three subject roots, so the two instruments cannot disagree.
 * `captureFreshness()` is not called because it walks `lib/` alone and tonight
 * `app/` moved with it. DISPATCH §3 — a SKIP is not a pass, so a comparison that
 * cannot be made at all is red, never absent. */
{
  console.log("--- PROVENANCE · does this evidence belong to this tree ---")
  /* THE OLDEST GRADED FILE, NOT THE NEWEST (F113 finding 7, Codex 2026-09-18).
   * This read `newestCapture(DIR, /\.png$/)`, so one fresh PNG vouched for every
   * other frame in the directory, including arms an `--only` recapture left
   * behind from an older build. Codex set `pulse_live_01.png` to 1970 and the
   * row stayed PASS. The row's own name says EVERY frame, so the frame that
   * decides is the oldest one graded, and the JSON the gate reads beside the
   * frames (clocks, preset-state) counts too. */
  const graded = readdirSync(DIR).filter((f) => /\.(png|json)$/.test(f))
  const capPng = graded
    .map((f) => ({ file: join(DIR, f), ms: statSync(join(DIR, f)).mtimeMs }))
    .sort((a, b) => a.ms - b.ms)[0] ?? { file: null, ms: 0 }
  const subj = ["lib", "app", "components"]
    .map((d) => newestUnder(join(ROOT, d)))
    .filter((b) => b.file)
    .sort((a, b) => b.ms - a.ms)[0]
  const rel = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
  const stamp = (ms) => new Date(ms).toLocaleString()
  const fresh = Boolean(capPng.file) && Boolean(subj?.file) && subj.ms <= capPng.ms
  check(
    "PROVENANCE · every frame graded here post-dates every source under lib/ app/ components/",
    fresh,
    capPng.file && subj?.file
      ? fresh
        ? `oldest of ${graded.length} graded files ${rel(capPng.file)} ${stamp(capPng.ms)} · newest source ${rel(subj.file)} ${stamp(subj.ms)}`
        : `STALE BY ${((subj.ms - capPng.ms) / 3600000).toFixed(1)}h. The oldest of ${graded.length} graded files ${rel(capPng.file)} ${stamp(capPng.ms)} ` +
          `but ${rel(subj.file)} was written ${stamp(subj.ms)}. Re-capture with ` +
          `node scripts/verify/verify-timing-origin.mjs --label=${LABEL}; do NOT relax this row.`
      : `no PNGs at ${rel(DIR)}, or no source under lib/ app/ components/ — the comparison cannot be made, so nothing below is trustworthy`,
  )
  if (!fresh) {
    console.log(
      "\n⚠ NO VERDICT. The stored frames predate the code they would be judging,\n" +
        "  so no reading taken from them says anything about the current timing.",
    )
    console.log(`\n${pass} passed, ${fail} failed`)
    process.exit(1)
  }
  console.log("")
}

/* ── EVERY CHECK BELOW WAS OPTIONAL, AND THAT WAS THE BIGGEST DEFECT IN THIS
 *    FILE (found 2026-08-01 by running it on two labels).
 *
 * Each block guards itself: `if (e)`, `if (fs.length > 6)`, `if (anim.length > 2
 * && stat.length > 2)`, `if (files.includes(after) && files.includes(clean))`.
 * A group of frames that is not on disk therefore produces no row at all — not
 * a FAIL, not a SKIP, nothing. Run against `--label=before` (39 frames, an old
 * partial capture) this script prints **"ALL TIMING-ORIGIN FRAME CHECKS PASS —
 * 2 passed, 0 failed"**. Against a complete label it runs eleven. Two of eleven
 * is a green that cannot fail, and it is the same disease the missing rows in
 * `assert-joint-beading` had.
 *
 * So the evidence is a MANIFEST now. Counts are the capture script's own loop
 * bounds (verify-timing-origin.mjs §1-§7); a group that is short is a capture
 * that was cut off, which is exactly what a poisoned run looks like. */
const MANIFEST = [
  ["pulse_armed_at_rest", 27],
  ["pulse_live", 33],
  ["delayed_after_reveal", 21],
  ["delay_dial", 25],
  ["completion_flash", 23],
  ["stack_completion_pulse", 23],
  ["stack_delay_after_reveal", 21],
  ["preset_01_animated", 6],
  ["preset_02_static_after_animated", 6],
]
console.log("--- evidence completeness (a missing group used to produce no row at all) ---")
for (const [prefix, want] of MANIFEST) {
  const got = of(prefix).length
  check(`evidence / ${prefix}`, got >= want, `${got} frames (need ${want})`)
}
for (const one of ["preset_03_layerstack.png", "preset_04_texture_after_layerstack.png", "preset_05_texture_from_clean.png", "ui_00_panel.png"]) {
  check(`evidence / ${one}`, files.includes(one), files.includes(one) ? "present" : "MISSING")
}
if (fail) {
  console.log(
    `\nINCOMPLETE EVIDENCE — ${fail} group(s) missing or short. Re-capture with\n` +
      `  node scripts/verify/_run-clean.mjs scripts/verify/verify-timing-origin.mjs --label=${LABEL}\n` +
      `Judging a partial capture is how this file reported 2 of 11 checks as "ALL PASS".`,
  )
  process.exit(1)
}
console.log("")

/* ---- 1. a one-shot armed at rest must actually DO something ------------- */
for (const [prefix, label] of [
  ["pulse_armed_at_rest", "Completion Pulse (texture layer)"],
  ["completion_flash", "Completion Flash (material)"],
  ["stack_completion_pulse", "Stack Completion Pulse"],
  ["delayed_after_reveal", "Delayed After Reveal (texture layer)"],
  ["stack_delay_after_reveal", "Stack Delay After Reveal"],
]) {
  const e = await envelope(prefix)
  if (!e) continue
  const peak = Math.max(...e)
  console.log(`  ${label}: ${curve(e)}`)
  check(
    `${label} — reachable: arming it on a finished stroke changes the picture`,
    peak > 2.0,
    `peak departure from the pre-arm frame ${f2(peak)}`,
  )
}

/* ---- 2. the one-shot's shape: rise, then settle, never snap back --------
 *
 * ⚠ THIS CHECK WAS REPORTING A FALSE RED, AND THE THRESHOLD WAS THE BUG.
 *
 * It compared the largest post-peak rise against `max(median * 4, 1.5)`, where
 * the median was taken over EVERY step in the window — including the parked
 * tail. The one-shot ends about two thirds of the way through the sample, so
 * fifteen of thirty-one steps are exactly 0, the median collapses to ~0.7, and
 * the gate lands near 3 while the layer's OWN animation steps ±7. The row could
 * only ever be red. Same shape as the `p95` bug written up in
 * assert-layer-flicker.mjs: a percentile of the whole distribution asked about
 * a bimodal one.
 *
 * PROVED IT WAS THE INSTRUMENT, NOT THE APP, BY RE-CAPTURING: two independent
 * runs put the "largest post-peak jump" at 7.66 (frame 15, ~1.35 s) and 7.72
 * (frame 6, ~0.54 s). A snap-back is a FIXED event — the envelope expiring at
 * ~1.86 s — so a jump whose position moves by 0.8 s between runs while its size
 * does not is the oscillation of the animated layer, not the cutoff.
 *
 * WHAT THE DEFECT ACTUALLY LOOKED LIKE, from the original note: "the envelope
 * expired and the consumer read the not-active sentinel AS FULL STRENGTH". So
 * it has two signatures a rise-size threshold cannot express, and both are
 * asserted here instead:
 *   · the run PARKS (a one-shot has to stop) — and where it parks is where the
 *     "active" window ends, so the step statistics are taken there rather than
 *     over the whole sample;
 *   · the parked level is BELOW the peak the burst reached. Snapping to full
 *     strength parks at or above it. That statement is scale-free and does not
 *     care how large the layer's own animation steps are. */
{
  const e = await envelope("pulse_live")
  if (e) {
    console.log(`\n  Completion Pulse fired live: ${curve(e)}`)
    const verdictOnCurve = (curveVals, tag) => {
      const steps = []
      for (let i = 1; i < curveVals.length; i++) steps.push(curveVals[i] - curveVals[i - 1])
      // Where it parks: the start of the longest run of ~zero steps that reaches
      // the end of the window.
      const STILL = 0.05
      let park = steps.length
      while (park > 0 && Math.abs(steps[park - 1]) < STILL) park--
      /* THE STEP INTO THE PARK IS NOT PART OF THE SCALE IT IS GRADED AGAINST
       * (F113 finding 7, Codex 2026-09-18). `active` used to end at `park`, so
       * it held `steps[park - 1]`, which IS `stepIntoPark`, and
       * `stepIntoPark <= max(|active|)` could not fail for any finite curve.
       * The scale is now the steps BEFORE the one into the park. */
      const active = steps.slice(0, Math.max(0, park - 1))
      const activeScale = active.length ? Math.max(...active.map((v) => Math.abs(v))) : 0
      const parkedFor = steps.length - park
      const peak = Math.max(...curveVals)
      const parked = curveVals[curveVals.length - 1]
      const stepIntoPark = park > 0 ? steps[park - 1] : 0
      return { tag, parkedFor, activeScale, peak, parked, stepIntoPark, park }
    }
    const v = verdictOnCurve(e, "measured")
    console.log(
      `    parks after ${v.park} steps and holds for ${v.parkedFor}; active step scale ${f2(v.activeScale)}; ` +
        `peak ${f2(v.peak)}, parked at ${f2(v.parked)}`,
    )
    check(
      "Completion Pulse fired live — it STOPS (a one-shot has to end)",
      v.parkedFor >= 4,
      `${v.parkedFor} still frames at the end of a ${e.length}-step window`,
    )
    check(
      "Completion Pulse fired live — no snap-back to full strength at the envelope cutoff",
      v.parked < v.peak - 0.5 && v.stepIntoPark <= v.activeScale,
      `parked at ${f2(v.parked)} vs burst peak ${f2(v.peak)}; step into the park ${f2(v.stepIntoPark)} vs the layer's own step scale ${f2(v.activeScale)}`,
    )
    /* THE CONTROL, built from THIS RUN'S OWN NUMBERS.
     *
     * A rule that has only been seen to pass proves nothing, and there is no
     * pre-fix capture on disk to point at (`--label=before` is a 39-frame
     * partial whose pulse_live is 11 steps long). So the defect is reconstructed
     * out of the measured curve rather than invented: take the real active
     * window and park it at the real PEAK — which is precisely "read the
     * not-active sentinel as full strength". No number here is made up; only the
     * arrangement is. The rule must reject it. */
    const ctl = [...e.slice(0, v.park), ...Array(Math.max(4, v.parkedFor)).fill(Math.max(...e))]
    const c = verdictOnCurve(ctl, "control")
    check(
      "control: the snap-back rule REJECTS a curve parked at full strength",
      !(c.parked < c.peak - 0.5 && c.stepIntoPark <= c.activeScale),
      `control parks at ${f2(c.parked)} against peak ${f2(c.peak)}, step into the park ${f2(c.stepIntoPark)} vs scale ${f2(c.activeScale)}`,
    )
  }
}

/* ---- 3. a Delay must hold the layer still, then release it ------------- */
{
  const fs = of("delay_dial")
  if (fs.length > 6) {
    // Consecutive-frame movement: near zero while waiting, non-zero after.
    const steps = []
    for (let i = 1; i < fs.length; i++) steps.push(await diff(await px(fs[i - 1]), await px(fs[i])))
    console.log(`\n  Delay dial (1.2s @ 110ms/frame): ${curve(steps)}`)
    /* ⚠ THE RELEASE IS FOUND, NOT ASSUMED, AND THAT IS THE WHOLE FIX.
     *
     * These windows were `slice(1, 9)` and `slice(13)`, hand-converted from a
     * 1.2s delay at 110ms a frame. That conversion cannot be right, because the
     * DELAY is wall-clock from arming and the INDEX is frames from the first
     * capture, and the two are separated by however long the capture takes to
     * start. Measured 2026-09-05 on a fresh shot: the curve is
     *   [0.0 x8] 42.1 63.7 70.0 63.1 63.8 ...
     * which is a delay working perfectly. `slice(1, 9)` includes index 8, the
     * RELEASE frame, so `wMax` read 42.14 against a bar of 1.0 and the row
     * failed on the one frame that proves the feature works. It then poisoned
     * its sibling, because `rMean > wMax * 2` became 63.96 > 84.28.
     *
     * So the boundary is measured: the release is the FIRST step above the
     * floor, everything before it must be still, everything after must move,
     * and the release must land where the delay predicts. That is three claims
     * where there were two, and none of them needs a frame count typed by hand. */
    const FLOOR = 1.0
    const release = steps.findIndex((d) => d >= FLOOR)
    const waiting = release > 0 ? steps.slice(0, release) : []
    const running = release >= 0 ? steps.slice(release + 1) : []
    const wMax = waiting.length ? Math.max(...waiting) : Infinity
    const rMean = running.length ? running.reduce((a, b) => a + b, 0) / running.length : 0
    /* GRADED IN MILLISECONDS OFF THE CAPTURE'S OWN CLOCK, not in frame indices.
     * `verify-timing-origin.mjs` now writes `delay_dial.clock.json` with the
     * offset of every frame from ARM, because a dial set in SECONDS cannot be
     * graded against a frame index without knowing how long arming took.
     * You cannot locate an event finer than the rate you sampled it at, and the
     * window is NOT symmetric, which a one-interval bar got wrong twice.
     *
     * LATE, up to TWO intervals, and this is construction rather than slop.
     * Say the dial expires at T. The first sample at or after T lands within
     * one interval of it, but it may land only microseconds after the release,
     * when no ink has moved yet, so it reads as STILL. The first sample that
     * can show movement is therefore the one after that, up to a second
     * interval later. Measured on a fresh shot: samples at 1094 and 1216 and
     * 1338 against a 1200ms dial, so the 1216 sample sat just 16ms past the
     * release with nothing yet drawn, and the first MOVING frame was 1338.
     * Three runs read 1302, 1308 and 1338, all late, none early. A one-interval
     * bar failed the third while the feature worked.
     *
     * EARLY, one interval, because the app's delay timer and the harness clock
     * do not start on the same instruction. An earlier shot read 1171ms against
     * the same 1.2s dial, 29ms early.
     *
     * ⚠ THIS IS NOT A WIDER BAR TO MAKE A RED GO GREEN. It still refuses
     * anything off by more than ~220ms on a 1200ms dial, 18% of the interval it
     * grades, and the calibration below proves it: the dial set to 0.3s while
     * the gate grades 1.2s releases at ~300ms and fails the floor. */
    let clock = null
    try { clock = JSON.parse(readFileSync(join(DIR, "delay_dial.clock.json"), "utf8")) } catch {}
    if (!clock) {
      check("Delay dial — the capture recorded its own clock", false,
        "delay_dial.clock.json is absent, so the release cannot be graded in seconds. Re-run verify-timing-origin.mjs.")
    } else {
      const relMs = clock.msSinceArm[release]
      const dialMs = 1200
      const lo = dialMs - clock.everyMs
      const hi = dialMs + clock.everyMs * 2
      check(
        "Delay dial — the release lands in the window the dial predicts",
        release >= 0 && relMs >= lo && relMs <= hi,
        `released at ${relMs}ms against a ${dialMs}ms dial, window ${lo}..${hi}ms ` +
          `(one sampling interval early, two late: a sample landing just after the release shows nothing yet) · ` +
          `arm took ${clock.armedMs}ms · curve ${curve(steps)}`,
      )
    }
    check(
      "Delay dial — the layer is HELD STILL for the delay, on an old scene clock",
      wMax < 1.0,
      `largest frame-to-frame move during the wait ${f2(wMax)}`,
    )
    check(
      "Delay dial — …and moves once the delay elapses",
      rMean > wMax * 2 && rMean > 1.0,
      `mean frame-to-frame move after the wait ${f2(rMean)}`,
    )
  }
}

/* ---- 4. preset selection does not leak across rails -------------------- */
{
  const anim = of("preset_01_animated")
  const stat = of("preset_02_static_after_animated")
  if (anim.length > 2 && stat.length > 2) {
    const moved = async (fs) => {
      let m = 0
      for (let i = 1; i < fs.length; i++) m = Math.max(m, await diff(await px(fs[i - 1]), await px(fs[i])))
      return m
    }
    const animMove = await moved(anim)
    const statMove = await moved(stat)
    console.log(`\n  Preset rail: animated moves ${f2(animMove)}, static-after-animated moves ${f2(statMove)}`)
    check(
      "Preset rail — the animated preset is genuinely animating (control)",
      animMove > 1.0,
      `frame-to-frame movement ${f2(animMove)}`,
    )
    check(
      "Preset rail — a STATIC preset chosen after it is actually still",
      statMove < 1.0,
      `frame-to-frame movement ${f2(statMove)} (was crawling if high)`,
    )
  }
  /* ---- the layer-stack → texture hand-off -------------------------------
   *
   * ⚠ THE OLD ROW HERE NAMED THE WRONG MECHANISM, and it took a re-capture to
   * see it: it judged the pair on a whole-frame diff and its own detail string
   * said "stale stack opacity would darken/weaken it". When the pair finally
   * differed — 56.00, on a fresh capture where the old label had no such frames
   * at all — the opacity was not the cause. A frame diff cannot name a channel,
   * so the RESOLVED STYLE STATE is captured beside the frames now
   * (verify-timing-origin.mjs §7) and the assertion reads fields.
   *
   * WHAT IS ACTUALLY HAPPENING, and it is two different things:
   *   · the COMPOSITION rails DO reset. `applyPresetToStyleState`
   *     (lib/style-system.ts:3325) writes `railDefaults(COMPOSITION_RAIL_KEYS)`
   *     for every non-material family before applying the new preset, so the
   *     stack's opacities, blends and order are gone. That is the taxonomy law
   *     `verify-gates.mjs` §3 enforces for texture/dither/ascii, and it is the
   *     claim this row is FOR.
   *   · the MATERIAL does not, and that is deliberate: `materialPreset` is
   *     knowingly outside `COMPOSITION_RAIL_KEYS` (the note at :3311 — "a
   *     separate control surface with no preset rail of their own"). But
   *     `ditheredGelStack.applies` writes `materialPreset: "softGel"` AND
   *     `materialUserOverride: true`, so a COMPOSITION preset pins the body
   *     material and marks it as the user's. Picking a Texture preset next
   *     correctly leaves the body alone — and the 56.00 is that body, not a
   *     stale opacity.
   *
   * Both halves are asserted, in the direction the code actually promises. The
   * `materialUserOverride` question — a flag named for the user, set by a preset
   * — is a call for Sebs, not a silent edit, and it is printed as such. */
  const statePath = join(DIR, "preset-state.json")
  if (existsSync(statePath)) {
    const { afterStack = {}, fromClean = {} } = JSON.parse(readFileSync(statePath, "utf8")) ?? {}
    const COMPOSITION = [
      "textureMode", "textureEnabled", "textureAnimated", "textureScale",
      "textureIntensity", "textureContrast", "textureSpeed", "textureDirection",
      "textureSyncMode", "textureDelay", "textureLockMode",
      "ditherEnabled", "ditherAnimated", "ditherType", "ditherScale",
      "ditherThreshold", "ditherContrast", "ditherIntensity", "ditherLevels",
      "ditherLockMode", "ditherSyncMode",
      "asciiEnabled", "asciiAnimated", "asciiCharset", "asciiCellSize",
      "layerStackEnabled", "stackTextureOpacity", "stackDitherOpacity",
      "stackAsciiOpacity", "stackDitherBlend", "stackAsciiBlend", "stackOrder",
      "stackAnimationEnabled", "fusionPreset", "fusionDrive", "motionMode",
    ]
    /* A FIELD NEITHER SIDE RECORDED IS NOT A FIELD THAT MATCHED (F113 finding
     * 7, Codex 2026-09-18). `JSON.stringify(undefined) === JSON.stringify(undefined)`,
     * so a preset-state.json holding `fromClean: {}` passed all 36 comparisons.
     * Every key has to be present on both sides before the comparison means
     * anything, and the material row needs a real value on both sides too. */
    const has = (o, k) => o != null && typeof o === "object" && Object.hasOwn(o, k) && o[k] !== undefined
    const absent = ["afterStack", "fromClean"].flatMap((side) =>
      COMPOSITION.filter((k) => !has(side === "afterStack" ? afterStack : fromClean, k)).map((k) => `${side}.${k}`),
    )
    check(
      "Preset rail: preset-state.json records all 36 composition keys on both sides",
      absent.length === 0,
      absent.length ? `ABSENT: ${absent.join(", ")}. A missing key compares equal to a missing key, so nothing below could see a leak.` : "72 of 72 recorded",
    )
    const leaked = COMPOSITION.filter((k) => !has(afterStack, k) || !has(fromClean, k) || JSON.stringify(afterStack[k]) !== JSON.stringify(fromClean[k]))
    check(
      "Preset rail — a Texture preset resets every COMPOSITION rail the Layer Stack preset had set",
      leaked.length === 0,
      leaked.length ? `LEAKED: ${leaked.map((k) => `${k} ${JSON.stringify(afterStack[k])} vs ${JSON.stringify(fromClean[k])}`).join(", ")}` : "all 36 composition keys identical",
    )
    check(
      "Preset rail — the body material carried over is exactly the one the Layer Stack preset declared",
      afterStack?.materialPreset === "softGel" && typeof fromClean?.materialPreset === "string" && fromClean.materialPreset.length > 0 && fromClean.materialPreset !== "softGel",
      `after the stack: ${afterStack.materialPreset} (softGel, as ditheredGelStack asks for) · from clean: ${fromClean.materialPreset}`,
    )
    console.log(
      `    [for Sebs, reported not changed] \`ditheredGelStack\` also writes ` +
        `materialUserOverride: ${afterStack.materialUserOverride} — a flag named for the USER, set by a preset. ` +
        `While it is true a geometry-mode switch no longer picks the mode's default material.`,
    )
  } else {
    const after = "preset_04_texture_after_layerstack.png"
    const clean = "preset_05_texture_from_clean.png"
    /* (name, ok, detail). This was `check(false, name, detail)`: the name became
     * a truthy `ok` and a MISSING state file printed PASS under the row name
     * "false" (F113 finding 7, Codex 2026-09-18). */
    check(
      "Preset rail — resolved-state evidence present",
      false,
      `no preset-state.json in ${DIR} — re-capture; the frame pair alone (${files.includes(after) && files.includes(clean) ? "present" : "also missing"}) cannot name which field leaked`,
    )
  }
}

console.log(
  `\n${fail === 0 ? "ALL TIMING-ORIGIN FRAME CHECKS PASS" : "TIMING-ORIGIN FRAME FAILURES"} — ${pass} passed, ${fail} failed`,
)
if (fail) {
  for (const f of failures) console.log("  · " + f)
  process.exit(1)
}
