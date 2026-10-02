// PRELOAD — run any node-side harness with the PARKED inverted corner predicate.
//
//   node --import ./scripts/verify/_arm-prior-corners.mjs scripts/verify/assert-cap-fit.mjs
//
// WHY. The corner-predicate fix (`lib/stroke-processing.ts`, 2026-08-02) changes
// the processed polyline of any mark that HAS a corner — it has to, because the
// old predicate discarded real corners and `preserveCorners` was inert. Several
// gates pin recorded counts taken on the old geometry, so they move.
//
// A pin must never be re-recorded on the assumption that "it was probably my
// change". This preload is how that assumption becomes a measurement: flip the
// tuning back, run the SAME gate, and see whether the recorded numbers return.
// If they do, the delta is the corner fix and nothing else. If they do not,
// something else moved and re-recording would have buried it.
//
// It works because `_ts-load.mjs` caches transpiled modules per PROCESS, so the
// object mutated here is the same object the harness's own `loadTs` returns.
// ⚠ IT FLIPS THE PREDICATE ONLY, AND THAT IS NOT THE WHOLE PRIOR. The corner
// work had two halves: the inverted predicate, and the final `resampleStroke`
// gridding over the corner the smoother had just pinned. This flips the first.
// A shape with corners therefore comes back with the OLD detection and the NEW
// pinning, which is neither arm — useful for attributing ONE half of a move,
// misleading if read as "the code before this lane". Said plainly here because
// an attribution tool that overstates its own scope is how a wrong pin gets
// re-recorded with a citation attached.
import { loadTs } from "./_ts-load.mjs"

const sp = loadTs("lib/stroke-processing.ts")
sp.CORNER_TUNING.predicate = "interior"
console.log("[arm-prior] CORNER_TUNING.predicate = 'interior' (the parked inverted predicate)")
console.log("[arm-prior] NOTE: the resample keep-corners half is NOT reverted — see this file's header")
