// PRELOAD — run any node-side harness with the PARKED Solid rim behaviour.
//
//   node --import ./scripts/verify/_arm-prior-rim.mjs scripts/verify/assert-cap-fit.mjs
//   node --import ./scripts/verify/_arm-prior-rim.mjs scripts/verify/_probe-rim-rows.mjs
//
// WHY. The rim repair of 2026-08-04 changed `insetLoopAgainstMask` in three
// ways, all of which move the INSET LOOPS the cap is drawn at — which is
// exactly the geometry `assert-cap-fit`'s parked `capFit:"source"` control
// measures. Its recorded counts therefore move, and a pin must never be
// re-recorded on the assumption that "it was probably my change". This preload
// is how that assumption becomes a measurement: flip all three back, run the
// SAME gate, and see whether the recorded numbers return. If they do, the delta
// is this lane's and nothing else. If they do not, something else moved and
// re-recording would have buried it.
//
// The three, and each is a separate parked prior on `SOLID_TUNING`:
//
//   probeBlind "onecell" — the offset guard trusted the binary mask one cell in.
//   flipRepair "halve"   — the fold repair multiplied by 0.5 blindly.
//   rimProfile "flat"    — the bevel's Z drop was a per-ring constant.
//
// It works because `_ts-load.mjs` caches transpiled modules per PROCESS, so the
// object mutated here is the same one the harness's own `loadTs` returns.
// UNLIKE `_arm-prior-corners.mjs`, this one IS the whole prior for its subject:
// with all three set, `assert-mode-rims`' census reproduces the pre-repair
// numbers exactly — openArc/solid `mixed max` 84.73, square/solid 84.24,
// crossing/solid 89.25, circle/solid and tick/solid 30.00.
import { loadTs } from "./_ts-load.mjs"

const sm = loadTs("lib/solid-mask.ts")
sm.SOLID_TUNING.probeBlind = "onecell"
sm.SOLID_TUNING.flipRepair = "halve"
sm.SOLID_TUNING.rimProfile = "flat"
console.log("[arm-prior-rim] SOLID_TUNING probeBlind='onecell' flipRepair='halve' rimProfile='flat'")
