// TIME-ORIGIN assertions for the style timing systems.
//
// WHY A PURE-FUNCTION ASSERT AND NOT ONLY FRAMES. Every function under test
// takes its clock as an explicit argument — `evaluateLayerTime`,
// `evaluateStackAnimation`, `evaluateFusion` and `evaluateMaterialAnimation` are
// pure. That makes the ONE thing this file is about — *which frame a number was
// derived in versus which frame it is consumed in* — directly addressable: we
// can hold a clock at "the stroke finished 9 seconds ago and the user just
// picked this option" and read the answer, which is impossible to arrange
// reliably by waiting in a browser. The frames (verify-timing-origin.mjs) then
// prove the fixed numbers reach the screen through the real UI path.
//
// WHAT IS ASSERTED. Not "did anything change" — each check is the named
// behaviour's OWN signature:
//   a one-shot         rises, settles, and never snaps back up
//   a deferred mode    is absent before it arrives, not present-and-still
//   a delay            defers from when the user set it, not from scene start
//   an arming trigger  makes a completion-keyed option reachable at rest
//   a preset           determines its whole composition from any starting point
//
// Usage: node scripts/verify/assert-timing-origin.mjs
// gate-integrity: differential — every row here is a SHAPE claim about one envelope measured
// against that same run's own `_00_before` frame: held still during the delay, moving after it,
// silent before completion, decaying to still. Both arms of each comparison come from the same
// build, so a clock constant moves them together and no row can see it — which is what makes the
// shape readable at any speed. Channel D moved 27 of 53 named constants and killed 0.
import { loadTs } from "./_ts-load.mjs"

const clockMod = loadTs("lib/style-clock.ts")
const stackMod = loadTs("lib/style-stack.ts")
const fusionMod = loadTs("lib/style-fusion.ts")
const sysMod = loadTs("lib/style-system.ts")

const { evaluateLayerTime } = clockMod
const { evaluateStackAnimation } = stackMod
const { evaluateFusion } = fusionMod
const { evaluateMaterialAnimation, DEFAULT_STYLE_STATE, MATERIAL_PARAMS } = sysMod

// PRE-FIX SHIMS. This file is meant to be runnable against the tree BEFORE the
// time-origin fixes, so the before/after columns are real measurements rather
// than a claim. Where a fix introduced a new export, fall back to exactly what
// the code did before it existed — the shallow spread, and the tautological
// min — so the pre-fix run reports the pre-fix BEHAVIOUR as failures instead of
// crashing on a missing import.
const completionTrigger =
  clockMod.completionTrigger ??
  ((since, armed) => Math.min(since === Infinity ? Infinity : since, armed))
const applyPresetToStyleState =
  sysMod.applyPresetToStyleState ??
  ((state, family, id) => {
    const preset = sysMod.findPreset(id)
    return {
      ...state,
      ...(preset?.applies ?? {}),
      activePresetFamily: family,
      activePresetId: id,
      lastAppliedPresetId: preset?.implemented ? id : state.lastAppliedPresetId,
    }
  })
// THE MULTIPLIER THE SHIPPED CONSUMER APPLIES, on whichever tree this is.
// Post-fix that is simply `amount` (viewport-3d multiplies unconditionally).
// Pre-fix the consumer was `active && amount < 1 ? amount : 1` — it read the
// not-active sentinel as full strength, and that reading IS the bug, so the
// before column has to measure the envelope the screen actually got, not the
// one the function nominally returned.
const FIXED = typeof clockMod.completionTrigger === "function"
const layerAmount = FIXED
  ? (lt) => lt.amount
  : (lt) => (lt.active && lt.amount < 1 ? lt.amount : 1)
console.log(
  FIXED
    ? "tree: POST-FIX (completionTrigger present; consumer multiplies unconditionally)"
    : "tree: PRE-FIX (no completionTrigger; consumer reads not-active as full strength)",
)

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
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : String(v))
const f3 = (v) => (Number.isFinite(v) ? v.toFixed(3) : String(v))

/** A clock frozen at "the draw finished STALE seconds ago and is resting". */
function restingClock(stale = 9) {
  return { elapsed: 40, reveal: 1, sinceCompletion: stale, strokeDurationMs: 1200 }
}
/** A clock frozen mid-draw: no completion has happened yet. */
function drawingClock(reveal = 0.5) {
  return { elapsed: 40, reveal, sinceCompletion: Infinity, strokeDurationMs: 1200 }
}

/** Sweep a layer mode from the moment of arming and collect the envelope. */
function sweepLayer(cfg, clockAt, seconds = 4, step = 0.02, amountFn = layerAmount) {
  const out = []
  for (let s = 0; s <= seconds + 1e-9; s += step) {
    const lt = evaluateLayerTime(clockAt(s), { ...cfg, sinceArmed: s })
    out.push({ s, amount: amountFn(lt), time: lt.time, active: lt.active })
  }
  return out
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE CONTROL — the pre-fix consumer, INVOKED rather than merely installed.
 *
 * Until 2026-08-07 this gate had no control on the bare invocation, and the
 * reason was subtle enough to be worth stating. The pre-fix behaviour IS written
 * into this file, at `:45-69` — but as `??` FALLBACKS, which only take effect
 * when the export is missing. On any current checkout `completionTrigger`
 * exists, `FIXED` is true, and the parked pre-fix consumer never executes. The
 * counter-evidence was installed and unreachable: a control that needed a
 * different checkout rather than an argument.
 *
 * It does not. The pre-fix consumer is a two-line function and it can simply be
 * CALLED. `sweepLayer` now takes the amount reader as a parameter, so the exact
 * same sweep, through the exact same `evaluateLayerTime`, can be run through the
 * pre-fix reading — and row 1a's own predicate is then required to REJECT it.
 *
 *   PRE-FIX: `active && amount < 1 ? amount : 1` — the not-active sentinel read
 *   as full strength, which IS the bug. Every value at or above 1 collapses to
 *   exactly 1, so the completionPulse envelope can never exceed 1 and row 1a's
 *   `peak > 1.2` must fail on it.
 *
 * Two directions, because a control that only fires one way proves half of what
 * it claims: the shipped reader must ACCEPT the same sweep.
 * ═══════════════════════════════════════════════════════════════════════════ */
/* BREAK-TESTED 2026-08-07: pointing this at `(lt) => lt.amount` (i.e. making the
 * "pre-fix" reading identical to the shipped one) turns controls 1 and 3 RED and
 * the gate exits 1. A control whose two arms are secretly the same input is the
 * commonest way this class of thing goes quiet. */
const PRE_FIX_LAYER_AMOUNT = (lt) => (lt.active && lt.amount < 1 ? lt.amount : 1)

console.log("\n=== CONTROLS · the pre-fix consumer, run rather than parked ===")
{
  const cfg = { animated: true, syncMode: "completionPulse", speed: 1, phase: 0 }
  const clockAt = (s) => ({ ...restingClock(9 + s) })
  const peakOf = (fn) => Math.max(...sweepLayer(cfg, clockAt, 4, 0.02, fn).map((r) => r.amount))
  const prePeak = peakOf(PRE_FIX_LAYER_AMOUNT)
  const shipPeak = peakOf(layerAmount)
  /* Row 1a's predicate, verbatim — `peak > 1.2`. Grading a paraphrase here
   * would certify the copy rather than the row. */
  const row1a = (peak) => peak > 1.2
  check(
    "CONTROL · KNOWN-BAD — the PRE-FIX consumer's envelope is REJECTED by row 1a's own predicate",
    row1a(prePeak) === false,
    `pre-fix peak ${f3(prePeak)} (needs <= 1.2; the sentinel collapses everything at or above 1 to exactly 1, which is the bug)`,
  )
  check(
    "CONTROL · ACCEPT — the SHIPPED consumer's envelope, same sweep, same clock, is NOT rejected",
    row1a(shipPeak) === true,
    `shipped peak ${f3(shipPeak)} (needs > 1.2) — a predicate that rejects both readings would prove nothing`,
  )
  check(
    "CONTROL · the two readings actually DIFFER on this sweep",
    Math.abs(shipPeak - prePeak) > 0.1,
    `shipped ${f3(shipPeak)} vs pre-fix ${f3(prePeak)} — if these matched, the control would be grading one thing twice`,
  )
}

console.log("\n=== 1. completionPulse (per-layer) — the one-shot's own shape ===")
{
  // Armed on a stroke that finished 9s ago: `sinceCompletion` alone is long
  // spent, so this only fires if arming is a second, honest origin.
  const rows = sweepLayer(
    { animated: true, syncMode: "completionPulse", speed: 1, phase: 0 },
    (s) => ({ ...restingClock(9 + s) }),
  )
  const amounts = rows.map((r) => r.amount)
  const peak = Math.max(...amounts)
  const peakAt = rows[amounts.indexOf(peak)].s
  const settled = rows[rows.length - 1].amount

  check(
    "1a reachable at rest — the pulse fires when armed on a finished stroke",
    peak > 1.2,
    `peak amount ${f3(peak)} at t=${f2(peakAt)}s (resting 1.000)`,
  )
  check(
    "1b has an attack — the peak is NOT on the first frame",
    peakAt > 0.02 && peakAt < 0.25,
    `peak at ${f2(peakAt)}s (want a short rise, not a step)`,
  )
  // The snap-back signature: after the peak the envelope must only fall.
  let worstRise = 0
  let worstRiseAt = 0
  for (let i = amounts.indexOf(peak) + 1; i < rows.length; i++) {
    const d = amounts[i] - amounts[i - 1]
    if (d > worstRise) {
      worstRise = d
      worstRiseAt = rows[i].s
    }
  }
  check(
    "1c no snap-back — the envelope never rises again after its peak",
    worstRise < 0.01,
    `largest post-peak rise ${f3(worstRise)}${worstRise >= 0.01 ? ` at t=${f2(worstRiseAt)}s` : ""}`,
  )
  check(
    "1d returns HOME — settles to exactly the resting look, not to zero",
    Math.abs(settled - 1) < 0.01,
    `amount at 4s = ${f3(settled)}`,
  )
  // Phase continuity: a jump means the pattern visibly slides at expiry.
  const steps = []
  for (let i = 1; i < rows.length; i++) steps.push(Math.abs(rows[i].time - rows[i - 1].time))
  const maxStep = Math.max(...steps)
  const medStep = [...steps].sort((a, b) => a - b)[Math.floor(steps.length / 2)]
  check(
    "1e phase is continuous — no sideways jump when the envelope expires",
    maxStep < Math.max(medStep * 4, 0.05),
    `max step ${f3(maxStep)} vs median ${f3(medStep)}`,
  )
  // And it must be SILENT during a draw: a completion pulse pre-completion is
  // not an event, it is the resting look.
  const mid = layerAmount(
    evaluateLayerTime(drawingClock(0.5), {
      animated: true, syncMode: "completionPulse", speed: 1, sinceArmed: 3,
    }),
  )
  check(
    "1f resting mid-draw — no pulse before there is a completion",
    Math.abs(mid - 1) < 1e-9,
    `amount ${f3(mid)}`,
  )

  // THE SNAP-BACK, on a clock where the pulse genuinely fires. The sweep above
  // is armed on a stale completion, which pre-fix never triggered at all — so
  // it cannot show what the envelope did once it HAD triggered. This one starts
  // at the instant of completion, which fires on both trees, and is where the
  // inverted sentinel becomes visible: the layer decays to the 4% cutoff and
  // then jumps straight back to full because expiry returned "not active" and
  // the consumer read that as 1.
  const live = sweepLayer(
    { animated: true, syncMode: "completionPulse", speed: 1 },
    (s) => ({ elapsed: 40 + s, reveal: 1, sinceCompletion: s, strokeDurationMs: 1200 }),
    3.2,
  )
  const la = live.map((r) => r.amount)
  const lPeakIdx = la.indexOf(Math.max(...la))
  let liveRise = 0
  let liveRiseAt = 0
  for (let i = lPeakIdx + 1; i < live.length; i++) {
    const d = la[i] - la[i - 1]
    if (d > liveRise) {
      liveRise = d
      liveRiseAt = live[i].s
    }
  }
  check(
    "1g fired live — the envelope still never snaps back up",
    liveRise < 0.01,
    `largest post-peak rise ${f3(liveRise)}${liveRise >= 0.01 ? ` at t=${f2(liveRiseAt)}s (the cutoff)` : ""}`,
  )
  check(
    "1h fired live — ends at the resting look, not below it",
    Math.abs(la[la.length - 1] - 1) < 0.01,
    `amount at 3.2s ${f3(la[la.length - 1])}`,
  )
}

console.log("\n=== 2. delayedAfterReveal — absent, then arrives ===")
{
  const before = layerAmount(
    evaluateLayerTime(drawingClock(0.5), {
      animated: true, syncMode: "delayedAfterReveal", speed: 1, sinceArmed: 3,
    }),
  )
  check(
    "2a silent before the reveal completes — style lands AFTER the form",
    before === 0,
    `amount ${f3(before)}`,
  )
  const rows = sweepLayer(
    { animated: true, syncMode: "delayedAfterReveal", speed: 1 },
    (s) => ({ ...restingClock(9 + s) }),
    1.2,
  )
  check(
    "2b arrives from ZERO when armed at rest (not already finished)",
    rows[0].amount <= 0.05,
    `amount at arming ${f3(rows[0].amount)}`,
  )
  const reached = rows.find((r) => r.amount >= 0.99)
  check(
    "2c completes its arrival within ~0.6s",
    !!reached && reached.s <= 0.62,
    reached ? `full at ${f2(reached.s)}s` : "never reached full",
  )
}

console.log("\n=== 3. delay is measured from arming, not scene start ===")
{
  const DELAY = 1.2
  const rows = sweepLayer(
    { animated: true, syncMode: "independent", speed: 1, delay: DELAY },
    () => restingClock(9),
    2.4,
  )
  const firstMoving = rows.find((r) => r.active)
  check(
    "3a the wait actually happens on a 40s-old scene clock",
    !!firstMoving && Math.abs(firstMoving.s - DELAY) < 0.06,
    firstMoving ? `starts moving at ${f2(firstMoving.s)}s (set to ${DELAY}s)` : "never started",
  )
  const held = rows.filter((r) => r.s < DELAY - 0.05)
  check(
    "3b present but still during the wait — a delay defers motion, not the layer",
    held.every((r) => r.amount === 1 && !r.active),
    `${held.length} pre-delay samples, all amount=1 / inactive`,
  )
  // loopSynced must start at the BEGINNING of its cycle when armed.
  const l0 = evaluateLayerTime(restingClock(9), {
    animated: true, syncMode: "loopSynced", speed: 1, loopSeconds: 4, sinceArmed: 0,
  })
  check(
    "3c loopSynced starts at cycle position 0 on arming",
    Math.abs(l0.time) < 1e-9,
    `time at arming ${f3(l0.time)}`,
  )
}

console.log("\n=== 4. the not-animating layer is present at full strength ===")
{
  const off = evaluateLayerTime(restingClock(9), {
    animated: false, syncMode: "independent", speed: 1, phase: 0.7,
  })
  check(
    "4a amount is the multiplier in EVERY branch — a static layer rests at 1",
    off.amount === 1 && off.active === false,
    `amount ${f3(off.amount)}, active ${off.active}`,
  )
  check(
    "4b a static layer reports its own phase, not 0",
    Math.abs(off.time - 0.7) < 1e-9,
    `time ${f3(off.time)} (phase 0.7)`,
  )
}

console.log("\n=== 5. completionTrigger keeps the Infinity sentinel ===")
{
  check(
    "5a no completion yet → Infinity survives (the tautology returned sinceArmed)",
    completionTrigger(Infinity, 5) === Infinity,
    `completionTrigger(Infinity, 5) = ${completionTrigger(Infinity, 5)}`,
  )
  check(
    "5b armed after a stale completion → measures from arming",
    completionTrigger(9, 0.3) === 0.3,
    `completionTrigger(9, 0.3) = ${completionTrigger(9, 0.3)}`,
  )
  check(
    "5c completion after arming → measures from completion",
    completionTrigger(0.2, 8) === 0.2,
    `completionTrigger(0.2, 8) = ${completionTrigger(0.2, 8)}`,
  )
}

console.log("\n=== 6. stack group animation — same rules at group scale ===")
{
  const base = {
    enabled: true, speed: 1, phase: 0, reveal: 1, loopSeconds: 3,
  }
  const pulseArmed = evaluateStackAnimation({
    ...base, behaviour: "completionPulse", sinceArmed: 0.09, sinceCompletion: 9,
  })
  check(
    "6a Stack Completion Pulse is reachable on a finished stroke",
    pulseArmed.amount > 1.4,
    `amount ${f3(pulseArmed.amount)} (resting 1.0)`,
  )
  const pulseSettled = evaluateStackAnimation({
    ...base, behaviour: "completionPulse", sinceArmed: 4, sinceCompletion: 13,
  })
  check(
    "6b …and settles back to exactly the resting look",
    Math.abs(pulseSettled.amount - 1) < 1e-9,
    `amount at 4s ${f3(pulseSettled.amount)}`,
  )
  const delayArmed = evaluateStackAnimation({
    ...base, behaviour: "delayAfterReveal", sinceArmed: 0, sinceCompletion: 9,
  })
  check(
    "6c Stack Delay After Reveal arrives from zero when armed at rest",
    delayArmed.amount <= 0.02,
    `amount at arming ${f3(delayArmed.amount)}`,
  )
  const delayMidDraw = evaluateStackAnimation({
    ...base, behaviour: "delayAfterReveal", reveal: 0.4,
    sinceArmed: 5, sinceCompletion: Infinity,
  })
  check(
    "6d …and stays silent while the stroke is still drawing",
    delayMidDraw.amount === 0,
    `amount ${f3(delayMidDraw.amount)}`,
  )
  // The group pulse and the layer pulse are ONE named behaviour: same envelope.
  const layerPeak = Math.max(
    ...sweepLayer(
      { animated: true, syncMode: "completionPulse", speed: 1 },
      (s) => restingClock(9 + s),
      1,
    ).map((r) => r.amount),
  )
  const groupPeak = Math.max(
    ...Array.from({ length: 51 }, (_, i) =>
      evaluateStackAnimation({
        ...base, behaviour: "completionPulse", sinceArmed: i * 0.02, sinceCompletion: 9 + i * 0.02,
      }).amount,
    ),
  )
  check(
    "6e layer pulse and group pulse peak at the same swell (one idea, two scales)",
    Math.abs(layerPeak - groupPeak) < 0.02,
    `layer ${f3(layerPeak)} vs group ${f3(groupPeak)}`,
  )
}

console.log("\n=== 7. fusion — the reveal branch is alive again ===")
{
  const st = {
    ...DEFAULT_STYLE_STATE,
    fusionPreset: "scanlineBalloon",
    fusionAnimationEnabled: true,
    fusionIntensity: 1,
    fusionAnimationSpeed: 1,
    motionMode: "independent",
  }
  const sig = { asciiTime: 0, ditherTime: 0, textureTime: 0 }
  const at = (reveal) =>
    evaluateFusion(
      st,
      { elapsed: 40, reveal, sinceCompletion: Infinity, strokeDurationMs: 1200 },
      sig,
      2.0,
    )
  const low = at(0.2)
  const high = at(0.85)
  // The DIRECTION is the signature, not merely "the number differs". This
  // preset's concept is "as the balloon swells, the printed lines SPREAD", so
  // scanline spacing must grow with the reveal. Pre-fix the breath was a
  // constant (the reveal branch was dead) and the only reveal-dependent term
  // left was the master gate `k`, which drove the spacing the WRONG WAY —
  // measurably different, and backwards.
  check(
    "7a scanlineBalloon's lines SPREAD as the reveal advances",
    high.textureScaleMul - low.textureScaleMul > 0.05,
    `textureScaleMul reveal .20 = ${f3(low.textureScaleMul)} → reveal .85 = ${f3(high.textureScaleMul)}`,
  )
  // asciiRubber's "Slowdown" must not already be spent while the stroke draws.
  const rub = {
    ...DEFAULT_STYLE_STATE,
    fusionPreset: "asciiRubber",
    fusionAnimationEnabled: true,
    fusionIntensity: 1,
    fusionAnimationSpeed: 1,
    motionMode: "independent",
    asciiScrollSpeed: 1,
  }
  const midDraw = evaluateFusion(
    rub,
    { elapsed: 40, reveal: 0.5, sinceCompletion: Infinity, strokeDurationMs: 1200 },
    sig,
    5,
  )
  check(
    "7b asciiRubber runs at full speed mid-draw — the slowdown has not fired",
    midDraw.asciiTimeAdd === 0,
    `asciiTimeAdd ${f3(midDraw.asciiTimeAdd)}`,
  )
  const afterDone = evaluateFusion(
    rub,
    { elapsed: 40, reveal: 1, sinceCompletion: 0.8, strokeDurationMs: 1200 },
    sig,
    12,
  )
  check(
    "7c …and decelerates once the draw completes",
    afterDone.asciiTimeAdd < -0.05,
    `asciiTimeAdd ${f3(afterDone.asciiTimeAdd)}`,
  )
}

console.log("\n=== 8. completionFlash (material) — reachable at rest ===")
{
  const base = MATERIAL_PARAMS.ink
  const args = (sinceCompletion, sinceArmed) => ({
    base, type: "completionFlash", time: 40, speed: 1, intensity: 1,
    completion: 1, sinceCompletion, sinceArmed,
  })
  const stale = evaluateMaterialAnimation(args(9, 0.09))
  check(
    "8a picking Completion Flash on a finished stroke plays the flash",
    stale.emissiveIntensity > base.emissiveIntensity + 1.0,
    `emissiveIntensity ${f3(stale.emissiveIntensity)} vs base ${f3(base.emissiveIntensity)}`,
  )
  const spent = evaluateMaterialAnimation(args(12, 3))
  check(
    "8b …and it is a ONE-SHOT: gone a few seconds later",
    Math.abs(spent.emissiveIntensity - base.emissiveIntensity) < 0.05,
    `emissiveIntensity ${f3(spent.emissiveIntensity)}`,
  )
  const drawing = evaluateMaterialAnimation({
    base, type: "completionFlash", time: 40, speed: 1, intensity: 1,
    completion: 0.5, sinceCompletion: Infinity, sinceArmed: 0,
  })
  check(
    "8c no flash halfway through a draw",
    Math.abs(drawing.emissiveIntensity - base.emissiveIntensity) < 1e-9,
    `emissiveIntensity ${f3(drawing.emissiveIntensity)}`,
  )
}

console.log("\n=== 9. preset selection does not leak across rails ===")
{
  let s = { ...DEFAULT_STYLE_STATE }
  s = applyPresetToStyleState(s, "animatedTexture", "grainDrift")
  check(
    "9a an animated texture preset turns animation ON",
    s.textureAnimated === true && s.motionMode === "independent",
    `textureAnimated ${s.textureAnimated}, motionMode ${s.motionMode}`,
  )
  s = applyPresetToStyleState(s, "texture", "fineGrain")
  check(
    "9b …and a STATIC preset chosen after it actually stops crawling",
    s.textureAnimated === false,
    `textureAnimated ${s.textureAnimated}`,
  )

  let t = { ...DEFAULT_STYLE_STATE }
  t = applyPresetToStyleState(t, "layerStack", "ditheredGelStack")
  check(
    "9c a Layer Stack preset enables the stack and its opacities",
    t.layerStackEnabled === true && t.stackTextureOpacity < 1,
    `layerStackEnabled ${t.layerStackEnabled}, stackTextureOpacity ${f2(t.stackTextureOpacity)}`,
  )
  const stackTexOpacity = t.stackTextureOpacity
  t = applyPresetToStyleState(t, "texture", "fineGrain")
  check(
    "9d …and a Texture preset after it is NOT silently multiplied down",
    t.layerStackEnabled === false && t.stackTextureOpacity === 1,
    `was multiplied by ${f2(stackTexOpacity)}; now layerStackEnabled ${t.layerStackEnabled}, stackTextureOpacity ${f2(t.stackTextureOpacity)}`,
  )
  check(
    "9e …and the stack's other layers are cleared too",
    t.ditherEnabled === false && t.asciiEnabled === false,
    `ditherEnabled ${t.ditherEnabled}, asciiEnabled ${t.asciiEnabled}`,
  )

  let u = { ...DEFAULT_STYLE_STATE }
  u = applyPresetToStyleState(u, "animatedFusion", "glitchRibbonControlledBreak")
  u = applyPresetToStyleState(u, "dither", "bayerClassic")
  check(
    "9f a dither preset after an animated fusion clears the fusion",
    u.fusionPreset === "none" && u.fusionAnimationEnabled === false,
    `fusionPreset ${u.fusionPreset}, animated ${u.fusionAnimationEnabled}`,
  )

  // Material is ORTHOGONAL: it must not nuke the composition, and the
  // composition must not nuke it.
  let v = { ...DEFAULT_STYLE_STATE }
  v = applyPresetToStyleState(v, "dither", "bayerClassic")
  v = applyPresetToStyleState(v, "material", "chrome")
  check(
    "9g a material preset leaves the layer composition alone",
    v.ditherEnabled === true && v.materialPreset === "chrome",
    `ditherEnabled ${v.ditherEnabled}, materialPreset ${v.materialPreset}`,
  )
  check(
    "9h …and pins the override so a mode switch cannot overwrite it",
    v.materialUserOverride === true,
    `materialUserOverride ${v.materialUserOverride}`,
  )
  const before = v.materialPreset
  v = applyPresetToStyleState(v, "ascii", "terminalShade")
  check(
    "9i a composition preset leaves the material alone",
    v.materialPreset === before,
    `materialPreset ${v.materialPreset}`,
  )
}

console.log(
  `\n${fail === 0 ? "ALL TIME-ORIGIN ASSERTIONS PASS" : "TIME-ORIGIN FAILURES"} — ${pass} passed, ${fail} failed`,
)
if (fail) {
  for (const f of failures) console.log("  · " + f)
  process.exit(1)
}
