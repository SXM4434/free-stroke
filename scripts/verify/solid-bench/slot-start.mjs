// solid-bench/slot-start.mjs · WHERE DOES STROKE 5's INK START, TIMED AGAINST SHIPPED? (ANIM-1C5, ANIM-1C6)
//
//   node scripts/verify/solid-bench/slot-start.mjs [--k=5] [--span=15]
//
// Builds the gate's word in Node exactly as `assert-stroke-timing-browser.mjs` injects it
// (logo-strokes.json, 12 ms a point, 60 ms a lift, the app's process settings, hybrid 0.4, lifts
// on), then walks stroke K's first `span` ms of base clock and prints stroke K's reach three ways:
//   shipped   rdf(c) straight, the curve Solid's untimed path reads per frame
//   table     the timed pace's clockToBeat, what `sampleTake` reads
//   sample    sampleTake itself, under a neutral row and under ease "in" on stroke K
//
// ANIM-1C5 found the cause: the table was 1024 uniform samples, so it ramped across stroke 5's
// landing while rdf held flat, and `sampleTake` gave stroke 5 up to 0.0004 of its arc before its
// first ink. ANIM-1C6 put each flat's exact ends in the table. This file now GRADES that, exit 1
// on any failure:
//   AGREE     over stroke K's first `span` ms from first ink, every 0.1 ms, table and shipped
//             differ by under 5e-5 of the stroke (they agree to 4 places)
//   NO-SLIVER stroke K's table reach, and sampleTake's reach under neutral and ease "in", are
//             exactly 0 at every 0.1 ms from stroke K-1's pen-up to stroke K's first ink
//   EVERY     the same on every lift of the word, table only: each stroke's table reach is exactly
//             0 from the pen-up before it to its first ink, 11 of 11 lifts on this word
//   MUST-FAIL the old uniform table (a copy of the pre-ANIM-1C6 paceFromCurve, kept below) must
//             show the ramp on stroke K; if it does not, this word no longer tests the defect.
//             The old table's ramps on the other lifts are counted too.
//   SLOT-START (F120) every stroke's timed slot opens within 1 ms of its first ink, 12 of 12, read
//             off `buildTimedSchedule` under a neutral row on every stroke (the t0 a delay or hold-back
//             moves). Three sets of start beats go through it: the hero's own, each one set to rdf's
//             held beat exactly, and each one a float step above that. The rule may not care which.
//   MUST-FAIL-START the old rule, `beatToClock(start)`, must open the last stroke more than 1 ms
//             early (72 ms on this word, at the pen lift's start), or this word no longer tests F120.
//   --timing-from=<rev> grades lib/stroke-timing.ts as it was at <rev> (`git show`), swapped in
//             through the loader's GATE_MUTATE_FILE hook, so no file on disk changes. A rev git
//             cannot show is an error. Against ea31c5b38 (before F120), SLOT-START fails.
// Not graded: past the first sample after a landing the table is plain linear interpolation, off
// the curve by up to 3.8e-4 of a stroke in a landing's first 15 ms and 1.1e-3 mid-stroke on this
// word (ANIM-1C6, measured). That is the table's resolution, not the lift.
// The B0 and first-ink numbers ANIM-1C4 measured in the browser (5890.4 and 5904.2) are printed as
// a positive control on the inputs. B0 sits on the landing (about 5904), not the last lift sample
// (5892.0): a slot start reads `beatToLanding`, the last clock still on the start beat, and the
// table holds each landing exactly. Before F120 it read `beatToClock`, which lands there only when
// the start beat is a float step above rdf's held beat, as it is on strokes 1 to 10.
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execFileSync } from "node:child_process"
import { ROOT, loadTs } from "../_ts-load.mjs"

const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=")[1]
const K = Number(arg("k", 5))
const SPAN = Number(arg("span", 15))
const FROM = arg("timing-from", "")
let fromDir = null
if (FROM) {
  if (process.env.GATE_MUTATE_FILE) throw new Error("--timing-from would replace the GATE_MUTATE_FILE already set")
  const cur = readFileSync(join(ROOT, "lib/stroke-timing.ts"), "utf8")
  const old = execFileSync("git", ["show", `${FROM}:lib/stroke-timing.ts`], { cwd: ROOT, encoding: "utf8" })
  fromDir = mkdtempSync(join(tmpdir(), "slot-start-"))
  writeFileSync(join(fromDir, "m.json"), JSON.stringify({ "lib/stroke-timing.ts": [{ pos: 0, end: cur.length, text: old }] }))
  process.env.GATE_MUTATE_FILE = join(fromDir, "m.json")
  console.log(`lib/stroke-timing.ts READ FROM ${FROM}, not the working copy`)
}
const S = loadTs("lib/stroke-schedule.ts")
const R = loadTs("lib/pen-reveal.ts")
const T = loadTs("lib/stroke-timing.ts")
const P = loadTs("lib/stroke-processing.ts")
if (fromDir) rmSync(fromDir, { recursive: true, force: true })

const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines
let t = 0
const raws = []
for (const poly of polys) {
  if (poly.length < 2) continue
  raws.push({ points: poly.map((p) => { const pt = { x: p.x, y: p.y, t, pressure: 0.6 }; t += 12; return pt }) })
  t += 60
}
const strokes = raws.map((r) => P.processStroke(r, 4, true, true))
const all = raws.flatMap((r) => r.points.map((p) => p.t))
const baseMs = Math.max(Math.max(...all) - Math.min(...all), 1)
const sched = S.scheduleFromStrokes(strokes, null, S.DRAW_IN_DEFAULTS)
const lifts = R.liftsLandBetweenStrokes(sched, "grow")
const rdf = (c) => R.revealDistanceFraction(strokes, c, "hybrid", 0.4, lifts)
const pace = T.paceFromCurve(rdf)
const tr = sched.tracks[K]
const own = (beat) => Math.min(1, Math.max(0, (beat - tr.start) / (tr.end - tr.start)))
const NEUTRAL = { delayMs: 0, speed: 1, holdBack: false, ease: { kind: "preset", id: "linear" } }
const tsN = T.buildTimedSchedule(sched, { strokes: { [K]: NEUTRAL }, ripple: false }, { baseMs, pace })
const tsE = T.buildTimedSchedule(sched, { strokes: { [K]: { ...NEUTRAL, ease: { kind: "preset", id: "in" } } }, ripple: false }, { baseMs, pace })
const B0 = tsN.baseSlots[K * 2]
const B1 = tsN.baseSlots[K * 2 + 1]
let firstInk = null
for (let c = B0 - 80; c < B0 + 80; c += 0.1) if (own(rdf(c / baseMs)) > 0) { firstInk = c; break }
const sampleMs = baseMs / 1024

/* THE OLD TABLE, verbatim from lib/stroke-timing.ts before ANIM-1C6 (clockToBeat half only). */
function uniformTable(curve, n = 1024) {
  const beats = new Float64Array(n + 1)
  let prev = 0
  for (let k = 0; k <= n; k++) {
    const b = k === 0 ? 0 : k === n ? 1 : curve(k / n)
    prev = b > prev ? b : prev
    beats[k] = prev
  }
  return (c) => {
    const x = (c < 0 ? 0 : c > 1 ? 1 : c) * n
    const k = Math.min(n - 1, Math.floor(x))
    return beats[k] + (beats[k + 1] - beats[k]) * (x - k)
  }
}
const oldC2b = uniformTable(rdf)

/* Stroke i's exact first ink: the last clock its own reach is still 0, by bisection on rdf. */
const inkAt = (i) => {
  const ti = sched.tracks[i]
  const ownI = (beat) => (beat - ti.start) / (ti.end - ti.start)
  let lo = i > 0 ? raws[i - 1].points.at(-1).t : 0, hi = raws[i].points[1].t
  if (ownI(rdf(lo / baseMs)) > 0 || !(ownI(rdf(hi / baseMs)) > 0)) return null
  for (let it = 0; it < 80; it++) { const m = (lo + hi) / 2; if (ownI(rdf(m / baseMs)) > 0) hi = m; else lo = m }
  return lo
}
const land = inkAt(K)
console.log(`${strokes.length} strokes, baseMs ${baseMs}, one pace sample = ${sampleMs.toFixed(2)} ms, identity ${sched.identity}, lifts ${lifts}`)
console.log(`stroke ${K}: B0 ${B0.toFixed(1)} B1 ${B1.toFixed(1)}, shipped first ink ${firstInk?.toFixed(1)} (0.1 ms walk), ${land?.toFixed(4)} (bisected)  (browser, ANIM-1C4: B0 5890.4, first ink 5904.2)`)
console.log(`stroke ${K}: start beat ${tr.start} against rdf's held beat ${rdf((land - 1) / baseMs)} (a float step above inverts to the landing)`)
console.log(`pen-up of stroke ${K - 1} at ${raws[K - 1].points.at(-1).t} ms, pen-down of stroke ${K} at ${raws[K].points[0].t} ms (raw clock)`)

const fails = []
const f4 = (v) => v.toFixed(4)
console.log(`\n  base ms   shipped  table   old     sample(neutral)  |  ease-in take ms  u     sample(ease)`)
const ease = tsE.eases[K]
let agreeMax = 0
for (let d = 0; d <= SPAN * 10; d++) {
  const c = land + d / 10
  agreeMax = Math.max(agreeMax, Math.abs(own(rdf(c / baseMs)) - own(pace.clockToBeat(c / baseMs))))
}
for (let d = 0; d <= SPAN; d += 1) {
  const c = land + d
  const shipped = own(rdf(c / baseMs))
  const table = own(pace.clockToBeat(c / baseMs))
  const old = own(oldC2b(c / baseMs))
  const sN = T.sampleTake(tsN, c, { lo: 0, hi: c / tsN.takeMs }).spans[K * 2 + 1]
  /* The ease take time whose eased base instant is c: u with e(u) = w. */
  const w = (c - B0) / (B1 - B0)
  let lo = 0, hi = 1
  for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; if (ease(m) < w) lo = m; else hi = m }
  const tE = tsE.slots[K * 2] + (tsE.slots[K * 2 + 1] - tsE.slots[K * 2]) * lo
  const sE = T.sampleTake(tsE, tE, { lo: 0, hi: tE / tsE.takeMs }).spans[K * 2 + 1]
  console.log(`  ${c.toFixed(1).padStart(7)}  ${f4(shipped)}   ${f4(table)}  ${f4(old)}  ${f4(sN).padStart(8)}         |  ${tE.toFixed(1).padStart(9)}     ${lo.toFixed(3)}  ${f4(sE)}`)
}
const agreeOk = agreeMax < 5e-5
if (!agreeOk) fails.push(`AGREE: table and shipped differ by ${agreeMax.toExponential(2)} of stroke ${K} in its first ${SPAN} ms`)
console.log(`AGREE      ${agreeOk ? "PASS" : "FAIL"}  table and shipped differ by at most ${agreeMax.toExponential(2)} of stroke ${K} over ${SPAN * 10 + 1} instants (0.1 ms) from first ink (bar 5e-5)`)

/* NO-SLIVER: stroke K-1's pen-up to stroke K's first ink, every 0.1 ms. */
let slivers = 0, oldMax = 0, walked = 0
const upAt = raws[K - 1].points.at(-1).t
for (let c = upAt; c < land; c += 0.1) {
  walked++
  const table = own(pace.clockToBeat(c / baseMs))
  const sN = T.sampleTake(tsN, c, { lo: 0, hi: c / tsN.takeMs }).spans[K * 2 + 1]
  const w = (c - B0) / (B1 - B0)
  let sE = 0
  if (w > 0) {
    let lo = 0, hi = 1
    for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; if (ease(m) < w) lo = m; else hi = m }
    const tE = tsE.slots[K * 2] + (tsE.slots[K * 2 + 1] - tsE.slots[K * 2]) * lo
    sE = T.sampleTake(tsE, tE, { lo: 0, hi: tE / tsE.takeMs }).spans[K * 2 + 1]
  }
  if (table !== 0 || sN !== 0 || sE !== 0) slivers++
  oldMax = Math.max(oldMax, own(oldC2b(c / baseMs)))
}
if (slivers) fails.push(`NO-SLIVER: ${slivers} of ${walked} instants before first ink give stroke ${K} arc`)
console.log(`NO-SLIVER  ${slivers ? "FAIL" : "PASS"}  stroke ${K} reach exactly 0 at ${walked - slivers} of ${walked} instants (0.1 ms) from ${upAt} to ${land.toFixed(1)}: table, sampleTake neutral, sampleTake ease "in"`)

/* EVERY: each lift, pen-up to first ink, table reach exactly 0; the old table's ramps counted. */
let seen = 0, oldRamps = 0
const bad = []
for (let i = 1; i < strokes.length; i++) {
  const li = inkAt(i)
  if (li == null) { bad.push(`${i}:no landing`); continue }
  seen++
  const ti = sched.tracks[i]
  const ownI = (beat) => Math.min(1, Math.max(0, (beat - ti.start) / (ti.end - ti.start)))
  let nz = 0, oldNz = 0
  for (let c = raws[i - 1].points.at(-1).t; c < li; c += 0.1) {
    if (ownI(pace.clockToBeat(c / baseMs)) !== 0) nz++
    if (ownI(oldC2b(c / baseMs)) !== 0) oldNz++
  }
  if (nz) bad.push(`${i}:${nz}`)
  if (oldNz) oldRamps++
}
const liftsN = strokes.length - 1
if (seen !== liftsN || bad.length) fails.push(`EVERY: ${seen} of ${liftsN} landings found, slivers ${bad.join(" ")}`)
console.log(`EVERY      ${seen === liftsN && !bad.length ? "PASS" : "FAIL"}  ${seen - bad.length} of ${liftsN} lifts give the next stroke exactly 0 before its first ink${bad.length ? " (" + bad.join(" ") + ")" : ""}; the old table ramped on ${oldRamps} of ${liftsN}`)

/* MUST-FAIL: the old table ramps before first ink. */
const mf = oldMax > 0
if (!mf) fails.push("MUST-FAIL: the old uniform table shows no ramp, so this word no longer tests the defect")
console.log(`MUST-FAIL  ${mf ? "PASS" : "FAIL"}  the old uniform table gives stroke ${K} up to ${f4(oldMax)} of its arc before first ink (must be > 0)`)

/* SLOT-START (F120): every stroke's slot opens on its first ink, whatever float its start beat is. */
const n = strokes.length
const inks = sched.tracks.map((_, i) => inkAt(i))
/* rdf's held beat: its value 1 ms before first ink, on the lift's flat (every lift here is 60 ms). */
const held = inks.map((c) => (c == null ? NaN : rdf(Math.max(0, c - 1) / baseMs)))
const bitsOf = (x) => new BigUint64Array(new Float64Array([x]).buffer)[0]
const nextUp = (x) => { const f = new Float64Array([x]); new BigUint64Array(f.buffer)[0] += 1n; return f[0] }
const allNeutral = Object.fromEntries(sched.tracks.map((_, i) => [i, NEUTRAL]))
const opensUnder = (starts) => {
  const base = starts ? { ...sched, tracks: sched.tracks.map((ti, i) => ({ ...ti, start: starts[i] })) } : sched
  const ts = T.buildTimedSchedule(base, { strokes: allNeutral, ripple: false }, { baseMs, pace })
  return sched.tracks.map((_, i) => ts.slots[i * 2])
}
const missesOf = (opens) => opens.flatMap((t0, i) => (inks[i] != null && Math.abs(t0 - inks[i]) <= 1 ? [] : [i]))
const inksFound = inks.filter((c) => c != null).length
const heroOpens = opensUnder(null)
const oldOpens = sched.tracks.map((ti) => pace.beatToClock(ti.start) * baseMs)
console.log(`\n  stroke  start beat vs held      first ink   slot opens  (off)     old rule  (off)`)
for (let i = 0; i < n; i++) {
  const st = sched.tracks[i].start
  const rel = st === held[i] ? "= held" : st > held[i] ? `held + ${bitsOf(st) - bitsOf(held[i])} float step${bitsOf(st) - bitsOf(held[i]) === 1n ? "" : "s"}` : "below held"
  const f1 = (v) => (v == null ? "none" : v.toFixed(1))
  console.log(`  ${String(i).padStart(6)}  ${rel.padEnd(22)} ${f1(inks[i]).padStart(9)}   ${f1(heroOpens[i]).padStart(9)}  ${(heroOpens[i] - inks[i]).toFixed(1).padStart(6)}   ${f1(oldOpens[i]).padStart(9)}  ${(oldOpens[i] - inks[i]).toFixed(1).padStart(6)}`)
}
const sets = [["hero starts", null], ["starts = held beat", held], ["starts = held + 1 float step", held.map(nextUp)]]
for (const [name, starts] of sets) {
  const opens = starts ? opensUnder(starts) : heroOpens
  const miss = missesOf(opens)
  const worst = Math.max(...opens.map((t0, i) => Math.abs(t0 - inks[i])))
  const ok = inksFound === n && miss.length === 0
  if (!ok) fails.push(`SLOT-START (${name}): ${n - miss.length} of ${n} slots open within 1 ms of first ink, ${inksFound} of ${n} first inks found; off: ${miss.join(" ")}`)
  console.log(`SLOT-START ${ok ? "PASS" : "FAIL"}  ${name}: ${n - miss.length} of ${n} slots open within 1 ms of first ink, worst ${worst.toFixed(4)} ms (${inksFound} of ${n} first inks found)${miss.length ? ", off: strokes " + miss.join(" ") : ""}`)
}

/* MUST-FAIL-START: the old rule opens the last stroke at its pen lift's start. */
const lastOff = oldOpens[n - 1] - inks[n - 1]
const mfs = missesOf(oldOpens).includes(n - 1) && lastOff < -1
if (!mfs) fails.push(`MUST-FAIL-START: the old rule opens stroke ${n - 1} ${lastOff.toFixed(1)} ms from first ink, so this word no longer tests F120`)
console.log(`MUST-FAIL-START ${mfs ? "PASS" : "FAIL"}  the old rule, beatToClock(start), opens stroke ${n - 1} ${lastOff.toFixed(1)} ms from its first ink (must be under -1); it misses ${missesOf(oldOpens).length} of ${n}`)

console.log(fails.length ? `\n${fails.length} FAIL\n  ${fails.join("\n  ")}` : "\nALL PASS")
process.exit(fails.length ? 1 : 0)
