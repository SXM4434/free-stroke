// F118, THE TRAVEL WRAP, checked in Node against the REAL lib of this clone.
// It was a prototype of the two-part window; now it reads the built code and the
// pre-change code (git show <base>:lib/stroke-schedule.ts) side by side.
//
//   node scripts/verify/travel-wrap/wrap-proto.mjs [--base=bc9ae5c7b]
//
// Rows: W1 non-wrapped windows byte-equal to the base, W2 ink length and seam
// set, W3 seam change against the median frame change, W4 hero-word ink
// continuity, W5 filterStrokesBySchedule arc equals W4, W6 the window moves across
// the pass (a window frozen at one wrapped position is its must-fail). Each row has a must-fail
// arm against the base (lane W's mapping), and the script exits 1 if any row
// fails OR any must-fail arm passes.
//
// CORPUS: the pure functions only. It cannot see a GPU consumer, the frame loop,
// or a probe that recomputes the window in its own arithmetic.
import { createJiti } from "../../../node_modules/jiti/lib/jiti.mjs"
import { readFileSync, writeFileSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import path from "node:path"

const R = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..")
const base = (process.argv.find((a) => a.startsWith("--base=")) || "--base=bc9ae5c7b").slice(7)
const jiti = createJiti(R + "/", { alias: { "@": R }, moduleCache: false })
const S = await jiti.import(R + "/lib/stroke-schedule.ts")
// The base lib goes in the repo's own lib/ folder under a temp name, so its
// relative imports resolve; it is removed on exit.
const baseFile = path.join(R, "lib", `.stroke-schedule.base-${process.pid}.ts`)
writeFileSync(baseFile, execFileSync("git", ["-C", R, "show", `${base}:lib/stroke-schedule.ts`]))
let B
try { B = await jiti.import(baseFile) } finally { execFileSync("rm", ["-f", baseFile]) }

const { windowAt, windowParts, strokeSpansIn, scheduleFromStrokes, filterStrokesBySchedule, DRAW_IN_DEFAULTS } = S
if (typeof windowParts !== "function") { console.error("FAIL: lib has no windowParts"); process.exit(1) }

let failed = 0
const row = (id, ok, text) => { console.log(`${ok ? "PASS" : "FAIL"} ${id} ${text}`); if (!ok) failed++ }
const mustFail = (id, ok, text) => { console.log(`${ok ? "MUST-FAIL fired" : "MUST-FAIL DID NOT FIRE"} ${id} ${text}`); if (!ok) failed++ }

/* measures in beat space */
const len = (ps) => ps.reduce((a, [x, y]) => a + (y - x), 0)
const partsOf = (w) => (w.wrapLo !== undefined ? windowParts(w) : w.hi > w.lo ? [[w.lo, w.hi]] : [])
function symDiff(a, b) {
  const N = 20000; let n = 0
  const inn = (ps, x) => ps.some(([l, h]) => x > l && x <= h)
  for (let i = 0; i < N; i++) { const x = (i + 0.5) / N; if (inn(a, x) !== inn(b, x)) n++ }
  return n / N
}
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1] }
const FPS = 60, TAKE_MS = 6215, steps = Math.round((TAKE_MS / 1000) * FPS) // night-w take, 373 frames

/* W1: every window that is not a seamless Travel is byte-equal to the base. */
{
  let diffs = 0, checked = 0
  const F = ["lo", "hi", "openBack", "whole", "empty", "identity"]
  for (const mode of ["grow", "travel", "vanish", "shrink"]) for (const L of [0.02, 0.25, 0.5, 1]) for (let k = 0; k <= 400; k++) {
    const p = { mode, length: L }, d = k / 400
    const a = B.windowAt(p, d), b = windowAt(p, d); checked++
    if (F.some((f) => a[f] !== b[f]) || b.wrapLo !== 1) diffs++
  }
  row("W1", diffs === 0, `non-wrapped windows differing from base windowAt: ${diffs} of ${checked}`)
  // must-fail: the seamless rows DO differ from the base (the guard is live)
  let sd = 0, sc = 0
  for (const L of [0.02, 0.25, 0.5, 1]) for (let k = 0; k <= 400; k++) {
    const p = { mode: "travel", length: L, seamless: true }, d = k / 400
    const a = B.windowAt(p, d), b = windowAt(p, d); sc++
    if (a.lo !== b.lo || a.hi !== b.hi || b.wrapLo !== 1) sd++
  }
  mustFail("W1", sd > 0, `seamless travel windows that changed: ${sd} of ${sc}`)
}

/* W6, 2026-09-25: THE WINDOW MOVES. W2, W3, W4 and W5 all hold for a fixed-length
 * window frozen at one wrapped position: its length is L, its seam step is 0
 * against a median of 0, its ink share never jumps, and two consumers of the
 * same frozen window agree. So this row measures motion directly, over the
 * frames of one pass:
 *   covered   the share of [0, 1] the window touched on some frame. A Travel
 *             sweeps the whole beat once per pass, so this must be 1; a frozen
 *             window covers only its own L.
 *   stillFrames  frame steps where the set did not change at all. Must be 0.
 *   travelled the sum of the per-frame set changes over the pass. A window of
 *             length L that slides a full cycle changes by 2 x (1 / steps) per
 *             frame, so about 2 in all. Must be at least 1.9.
 * The bars come from the geometry of one pass, not from a run, and the measured
 * values print beside them. */
function motion(at) {
  const N = 20000, hit = new Uint8Array(N)
  let still = 0, travelled = 0, prev = null
  for (let k = 0; k <= steps; k++) {
    const ps = partsOf(at(k / steps))
    for (const [l, h] of ps) for (let i = Math.max(0, Math.floor(l * N)); i < Math.min(N, Math.ceil(h * N)); i++) if ((i + 0.5) / N > l && (i + 0.5) / N <= h) hit[i] = 1
    if (prev) { const d = symDiff(prev, ps); travelled += d; if (d === 0) still++ }
    prev = ps
  }
  return { covered: +(hit.reduce((a, b) => a + b, 0) / N).toFixed(4), stillFrames: still, travelled: +travelled.toFixed(4) }
}
const moves = (r) => r.covered >= 1 - 1e-3 && r.stillFrames === 0 && r.travelled >= 1.9
const motionText = (r) => `covered ${r.covered} of the beat (want 1), ${r.stillFrames} still frames of ${steps} (want 0), travelled ${r.travelled} (want >= 1.9)`

/* W2 + W3 over one pass at 60 fps */
const table = []
function pass(label, at, L) {
  let minLen = 9, maxLen = 0
  const steps_ = []
  let prev = null
  for (let k = 0; k <= steps; k++) {
    const ps = partsOf(at(k / steps))
    const l = len(ps); minLen = Math.min(minLen, l); maxLen = Math.max(maxLen, l)
    if (prev) steps_.push(symDiff(prev, ps))
    prev = ps
  }
  // the seam: the last frame before the wrap, then frame 0 of the next pass. One
  // frame interval apart, since d = 1 and d = 0 are the same instant of a loop.
  const seam = symDiff(partsOf(at((steps - 1) / steps)), partsOf(at(0)))
  const med = median(steps_)
  const r = { label, L, minLen: +minLen.toFixed(4), maxLen: +maxLen.toFixed(4), medianStep: +med.toFixed(4), seamStep: +seam.toFixed(4), setAt0eqAt1: symDiff(partsOf(at(0)), partsOf(at(1))) === 0, ...motion(at) }
  table.push(r)
  return r
}
for (const L of [0.25, 0.75]) {
  const P = { mode: "travel", length: L, seamless: true }
  const w = pass("wrap", (d) => windowAt(P, d), L)
  const lw = pass("laneW(base)", (d) => B.windowAt(P, d), L)
  pass("once", (d) => windowAt({ mode: "travel", length: L }, d), L)
  const o = pass("opening pass", (d) => windowAt(P, d, true), L)
  row("W2", Math.abs(w.minLen - L) < 1e-9 && Math.abs(w.maxLen - L) < 1e-9 && w.setAt0eqAt1, `L ${L}: ink length ${w.minLen}..${w.maxLen} on all ${steps + 1} frames, window at 0 equals window at 1: ${w.setAt0eqAt1}`)
  row("W3", Math.abs(w.seamStep - w.medianStep) <= 0.1 * w.medianStep, `L ${L}: seam step ${w.seamStep} against median step ${w.medianStep}`)
  mustFail("W3", !(Math.abs(lw.seamStep - lw.medianStep) <= 0.1 * lw.medianStep), `L ${L}: lane W seam step ${lw.seamStep} against median ${lw.medianStep}`)
  row("W6", moves(w), `L ${L}: the seamless window moves across the pass: ${motionText(w)}`)
  // must-fail: the same window frozen at one WRAPPED position, the counterexample
  // that W2 to W5 cannot see. It must be wrapped, or it is not that counterexample.
  const dFrozen = [0.05, 0.1, 0.15, 0.2].find((d) => windowAt(P, d).wrapLo < 1)
  if (dFrozen === undefined) row("W6", false, `L ${L}: no wrapped window to freeze, so the must-fail cannot be built`)
  else {
    const fr = pass("frozen(must-fail)", () => windowAt(P, dFrozen), L)
    console.log(`NOTE W6 L ${L}: frozen at d ${dFrozen}: ink length ${fr.minLen}..${fr.maxLen}, seam step ${fr.seamStep} vs median ${fr.medianStep}, window at 0 equals window at 1: ${fr.setAt0eqAt1} (W2 and W3 alone would pass it)`)
    mustFail("W6", !moves(fr), `L ${L}: a window frozen at wrapped d ${dFrozen}: ${motionText(fr)}`)
  }
  // opening pass: starts empty, ends on [1-L, 1], which is the wrapped pass's first window
  const end = windowAt(P, 1, true), first = windowAt(P, 0)
  row("W2o", o.minLen === 0 && symDiff(partsOf(end), partsOf(first)) === 0, `L ${L}: opening pass starts at ink ${o.minLen}, ends on [${end.lo}, ${end.hi}], equal to the wrapped pass's d=0 set`)
}
console.table(table)

/* W4 + W5 on the hero word */
const logo = JSON.parse(readFileSync(R + "/scripts/capture/logo-strokes.json", "utf8"))
const strokes = logo.polylines.map((pts) => ({ points: pts.map((q, i) => ({ x: q.x, y: q.y, t: i * 8, pressure: 0.5 })), cornerCount: 0 }))
const arcOf = (s) => { let a = 0; for (let i = 1; i < s.points.length; i++) a += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y); return a }
const sLen = strokes.map(arcOf)
const total = sLen.reduce((a, b) => a + b, 0)
const spanArc = (sp) => { let a = 0; for (let i = 0; i < sp.length / 2; i++) a += (sp[2 * i + 1] - sp[2 * i]) * sLen[i]; return a }
for (const overlap of [0, 1]) {
  const sched = scheduleFromStrokes(strokes, null, { ...DRAW_IN_DEFAULTS, overlap })
  const P = { mode: "travel", length: 0.25, seamless: true }
  const inkParts = (w) => partsOf(w).reduce((a, [l, h]) => a + spanArc(strokeSpansIn(sched, l, h)), 0) / total
  const inkClip = (w, d) => filterStrokesBySchedule(strokes, sched, d, w).reduce((a, s) => a + arcOf(s), 0) / total
  const series = [], clipDiff = []
  for (let k = 0; k <= steps; k++) {
    const w = windowAt(P, k / steps); const a = inkParts(w); series.push(a)
    clipDiff.push(Math.abs(inkClip(w, k / steps) - a))
  }
  const jumps = series.slice(1).map((v, i) => Math.abs(v - series[i]))
  const last = series[steps - 1], first = series[0]
  const lwLast = spanArc(strokeSpansIn(sched, B.windowAt(P, (steps - 1) / steps).lo, B.windowAt(P, (steps - 1) / steps).hi)) / total
  const lwFirst = spanArc(strokeSpansIn(sched, B.windowAt(P, 0).lo, B.windowAt(P, 0).hi)) / total
  const seamJump = Math.abs(first - last), maxJump = Math.max(...jumps)
  row("W4", seamJump <= Math.max(2 * median(jumps), 0.01), `overlap ${overlap}: ink share last ${last.toFixed(4)} -> first ${first.toFixed(4)} (seam jump ${seamJump.toFixed(4)}, largest in-pass step ${maxJump.toFixed(4)}, median ${median(jumps).toFixed(4)})`)
  // At overlap 0 the beat is arc-proportional, so lane W's whole-segment swap keeps
  // the same ink SHARE (0.25 -> 0.25): this instrument is blind to it there, and
  // W3's set change is the row that sees it. The must-fail runs at overlap 1 only.
  if (overlap > 0) mustFail("W4", Math.abs(lwFirst - lwLast) > Math.max(2 * median(jumps), 0.01), `overlap ${overlap}: lane W last ${lwLast.toFixed(4)} -> first ${lwFirst.toFixed(4)}`)
  else console.log(`NOTE W4 overlap 0: lane W last ${lwLast.toFixed(4)} -> first ${lwFirst.toFixed(4)}; ink share cannot see a swap here, W3 does`)
  // must-fail: the same clip handed a window with its second part stripped
  let dropped = 0
  for (let k = 0; k <= steps; k++) { const w = windowAt(P, k / steps); if (w.wrapLo < 1 && Math.abs(inkClip({ ...w, wrapLo: 1 }, k / steps) - inkParts(w)) > 1e-6) dropped++ }
  mustFail("W5", dropped > 0, `overlap ${overlap}: clip with wrapLo stripped disagrees on ${dropped} of ${steps + 1} frames`)
  row("W5", Math.max(...clipDiff) < 1e-6, `overlap ${overlap}: filterStrokesBySchedule arc vs per-part spans arc, worst difference ${Math.max(...clipDiff).toExponential(2)} over ${steps + 1} frames`)
}
console.log(failed ? `\n${failed} row(s) failed` : "\nall rows pass, all must-fail arms fired")
process.exit(failed ? 1 : 0)
