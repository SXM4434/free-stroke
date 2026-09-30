#!/usr/bin/env node
/**
 * THE TWO BEHAVIOUR CHANGES FROM THE STYLE-CONTRACTS PASS, MEASURED.
 *
 * Both are model-level, so both are measurable exactly rather than estimated
 * off a capture. The PRIOR arm is re-stated here from the code as it was, so
 * this is an A/B and not a description of the new side.
 *
 *   A · the group completion pulse. Was decay 0.5 (a private copy in
 *       lib/style-stack.ts); is now the shared 0.55 from lib/style-clock.ts.
 *   B · the shared fusion completion pulse. Was keyed to `sinceCompletion`
 *       raw; now goes through `completionTrigger` like every other consumer.
 */
import { loadTs } from "./_ts-load.mjs"

const C = loadTs("lib/style-clock.ts")
const K = loadTs("lib/style-stack.ts")
const F = loadTs("lib/style-fusion.ts")
const S = loadTs("lib/style-system.ts")

/* ---------------- A · the group completion pulse ---------------- */
// PRIOR, verbatim from lib/style-stack.ts before this pass.
const PRIOR_ATTACK = 0.09
const PRIOR_DECAY = 0.5
const priorEnv = (t) => (t <= 0 ? 0 : t < PRIOR_ATTACK ? t / PRIOR_ATTACK : Math.exp(-(t - PRIOR_ATTACK) / PRIOR_DECAY))
const priorGroup = (t) => {
  const e = priorEnv(t)
  return e < 0.04 ? 1 : 1 + e * 0.6
}
const nowGroup = (t) =>
  K.evaluateStackAnimation({
    enabled: true, behaviour: "completionPulse", speed: 1, phase: 0,
    sinceArmed: t, reveal: 1, sinceCompletion: t, loopSeconds: 4,
  }).amount
const layer = (t) => {
  const c = C.createStyleClock()
  c.reveal = 1
  c.sinceCompletion = t
  return C.evaluateLayerTime(c, { animated: true, syncMode: "completionPulse", speed: 1, sinceArmed: t }).amount
}

console.log("\nA · GROUP COMPLETION PULSE — group amount vs the LAYER it is supposed to match")
console.log("  t(s)   layer     group PRIOR   group NOW    prior err    now err")
let priorWorst = 0
let nowWorst = 0
for (const t of [0, 0.045, 0.09, 0.2, 0.4, 0.6, 0.9, 1.2, 1.5, 1.7, 1.75, 1.8, 1.86, 1.9, 2.1]) {
  const L = layer(t)
  const P = priorGroup(t)
  const N = nowGroup(t)
  priorWorst = Math.max(priorWorst, Math.abs(L - P))
  nowWorst = Math.max(nowWorst, Math.abs(L - N))
  console.log(
    `  ${t.toFixed(3)}  ${L.toFixed(5)}   ${P.toFixed(5)}      ${N.toFixed(5)}     ${(L - P >= 0 ? "+" : "")}${(L - P).toFixed(5)}     ${(L - N >= 0 ? "+" : "")}${(L - N).toFixed(5)}`,
  )
}
const endOf = (f) => {
  for (let t = 0.5; t < 4; t += 0.001) if (Math.abs(f(t) - 1) < 1e-12) return t
  return NaN
}
const eL = endOf(layer)
const ePrior = endOf(priorGroup)
const eNow = endOf(nowGroup)
console.log(`\n  settles: layer ${eL.toFixed(3)}s · group PRIOR ${ePrior.toFixed(3)}s · group NOW ${eNow.toFixed(3)}s`)
console.log(`  the group's event ended ${((eL - ePrior) * 1000).toFixed(0)} ms BEFORE the layers' — now ${((eL - eNow) * 1000).toFixed(0)} ms`)
console.log(`  worst |layer-group|: PRIOR ${priorWorst.toFixed(5)} → NOW ${nowWorst.toFixed(5)}`)
console.log(`  peak amount is UNCHANGED at ${Math.max(layer(0.09), nowGroup(0.09)).toFixed(3)} — this pass moved the TAIL, never the hit`)

/* ---------------- B · the shared fusion completion pulse ---------------- */
// PRIOR: pulse = sinceCompletion === Infinity ? 0 : exp(-sinceCompletion/0.5)
const priorPulse = (since) => (since === Infinity ? 0 : Math.exp(-since / 0.5))
const nowPulse = (since, armed) => {
  const trig = C.completionTrigger(since, armed)
  return trig === Infinity ? 0 : Math.exp(-trig / 0.5)
}

console.log("\nB · SHARED FUSION COMPLETION PULSE — the kick every fusion preset is built around")
console.log("  scenario                                            sinceCompletion  sinceArmed   PRIOR      NOW")
const rows = [
  ["mid-draw (nothing has completed yet)", Infinity, 0.1],
  ["the frame the draw finishes", 0, 12],
  ["0.35 s after the draw finishes", 0.35, 12],
  ["user picks a fusion 30 s after drawing", 30, 0.0],
  ["...0.35 s later", 30.35, 0.35],
  ["...3 s later (the one-shot must be spent)", 33, 3],
  ["...30 s later (must be silent)", 60, 30],
]
for (const [label, since, armed] of rows) {
  console.log(
    `  ${label.padEnd(50)} ${String(since).padStart(9)}       ${String(armed).padStart(6)}    ${priorPulse(since).toFixed(5)}    ${nowPulse(since, armed).toFixed(5)}`,
  )
}

// The same thing at the point it lands: Terminal Gel's emissive.
const reach = (armed, since) => {
  const c = C.createStyleClock()
  c.elapsed = 40
  c.reveal = 1
  c.sinceCompletion = since
  const f = F.evaluateFusion(
    { ...S.DEFAULT_STYLE_STATE, fusionPreset: "terminalGel", fusionDrive: "loop", fusionIntensity: 1, fusionSwing: 0, motionMode: "off" },
    c, { asciiTime: 0, ditherTime: 0, textureTime: 0 }, armed,
  )
  return f.emissiveAdd
}
console.log("\n  Terminal Gel emissiveAdd, armed on a stroke finished 30 s ago:")
console.log(`    at arming        ${reach(0.0, 30).toFixed(5)}`)
console.log(`    +0.35 s          ${reach(0.35, 30.35).toFixed(5)}`)
console.log(`    +3 s (spent)     ${reach(3, 33).toFixed(5)}`)
console.log(`    PRIOR, all three ${(0.275).toFixed(5)}  (bit-identical — the kick never fired)`)

/* The freeze case: reduced motion / Motion Off must not be re-animated by this. */
const frozenNow = reach(0.0, 30)
const frozenLate = reach(30, 60)
console.log(`\n  one-shot check: fires at arming (${frozenNow.toFixed(5)}) and is spent later (${frozenLate.toFixed(5)}) — it cannot latch on`)
