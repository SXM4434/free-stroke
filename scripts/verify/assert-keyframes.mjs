#!/usr/bin/env node
/* ============================================================================
 * assert-keyframes: keys and curves on draw progress, width, depth, turn and
 * camera (`lib/keyframes.ts`), phase 3 of
 * `docs/research-2026-09-25/animation-tools/DESIGN.md`. Node only, no browser.
 *
 *   node scripts/verify/assert-keyframes.mjs              rows, then every must-fail
 *   node scripts/verify/assert-keyframes.mjs --rows-only  rows only (a mutant child runs this)
 *
 * WHAT IT READS. `lib/keyframes.ts` on hand-built tracks. DRAW-HOLD also runs
 * the real stroke timing (`buildTimedSchedule`, `sampleTake` from
 * `lib/stroke-timing.ts`) on a three-stroke schedule with one delayed stroke,
 * so the drawProgress rule is checked on the spans the reveal draws.
 *
 * WHAT IT DOES NOT READ. The viewport, the doc store, any UI. Nothing here
 * proves `/` calls `revealClockMs` or writes sampled depth, turn or camera
 * anywhere. Those are phase 3b gates.
 *
 * MUST-FAILS. Each mutant is a one-line sabotage of `lib/keyframes.ts` applied
 * by `_ts-load.mjs` through GATE_MUTATE_FILE (nothing on disk changes).
 * Offsets are found by unique text at run time, so a mutant whose text is gone
 * FAILS loudly instead of catching nothing. A mutant counts as caught only when
 * the child ran to completion AND every named row went red.
 * ========================================================================== */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")

const rows = []
function row(id, ok, what, detail) {
  rows.push({ id, ok: !!ok, what, detail })
}

const sameBytes = (a, b) =>
  a.length === b.length && Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0

/** One row's block. A block that throws is that row's FAIL, and the rows after
 *  it still run, so one broken row can never hide the others. */
function check(id, what, fn) {
  try {
    fn()
  } catch (e) {
    row(id, false, what, `threw: ${e && e.message}`)
  }
}

/** JSON that shows an undefined value instead of dropping its key. */
const show = (o) => JSON.stringify(o, (_, v) => (v === undefined ? "undefined" : v))

/** The error a call throws, or null when it returned. */
function thrown(fn) {
  try {
    fn()
    return null
  } catch (e) {
    return String(e && e.message)
  }
}

/*
 * AFTER EFFECTS' EASY EASE, DERIVED, NOT READ OFF OUR SOLVER.
 *
 * Easy Ease sets speed 0 at the key and influence 33.33% on each side (School of
 * Motion's graph editor guide, and `docs/research-2026-09-25/animation-tools/
 * REFERENCES.md` §2). Bodymovin, AE's Lottie exporter, turns an AE ease into a
 * Lottie bezier (`bundle/jsx/utils/keyframeHelper.jsx`):
 *   bezierOut.x = influence / 100        bezierOut.y = speed * influence / 100 * duration / delta
 *   bezierIn.x  = 1 - influence / 100    bezierIn.y  = 1 - (the same for the in ease)
 * and the Lottie spec reads `o`, `i` as the inner points of a cubic from [0,0] to
 * [1,1]. Speed 0 gives (1/3, 0) and (2/3, 1). With x controls at 0, 1/3, 2/3, 1,
 * x(s) = s, so the value at time u is y(u) = 3u^2(1-u) + u^3 = 3u^2 - 2u^3.
 * Worked by hand:
 */
const AE_EASY_EASE = [
  [0.1, 0.028], // 0.03 - 0.002
  [0.25, 0.15625], // 0.1875 - 0.03125
  [0.5, 0.5], // 0.75 - 0.25
  [0.75, 0.84375], // 1.6875 - 0.84375
  [0.9, 0.972], // 2.43 - 1.458
]

async function runRows() {
  const K = loadTs("lib/keyframes.ts")
  const lin = (tMs, value) => ({ tMs, value, easeOut: "linear", easeIn: "linear" })

  /* AT-KEY. Every key's own time returns its value exactly, the interior ones
   * too, including the key right after a hold (the jump lands on the key). */
  check("AT-KEY", "the row ran", () => {
    const tr = [
      { tMs: 0, value: 0.1, easeOut: "hold", easeIn: "linear" },
      K.makeKey(400, 0.7),
      lin(1000, 0.3),
      K.makeKey(1600, 0.9),
    ]
    const got = tr.map((k) => K.sampleTrack(tr, k.tMs))
    const ok = tr.every((k, i) => Object.is(got[i], k.value))
    row("AT-KEY", ok, "the value at a key's time is that key's value, exactly", `keys ${tr.map((k) => k.value).join(", ")}; sampled ${got.join(", ")}`)
  })

  /* LINEAR. Linear on both sides is the straight line. */
  check("LINEAR", "the row ran", () => {
    const tr = [lin(0, 10), lin(1000, 30)]
    const mid = K.sampleTrack(tr, 500)
    const q = K.sampleTrack(tr, 250)
    row("LINEAR", mid === 20 && Math.abs(q - 15) < 1e-12, "linear keys 10 at 0 ms and 30 at 1000 ms give 20 at 500 ms", `500 ms: ${mid}; 250 ms: ${q}`)
  })

  /* HOLD. A hold out of a key keeps its value to the next key's time. */
  check("HOLD", "the row ran", () => {
    const tr = [{ tMs: 0, value: 5, easeOut: "hold", easeIn: "linear" }, lin(1000, 9)]
    const at = [0, 1, 250, 500, 999.999].map((t) => K.sampleTrack(tr, t))
    const end = K.sampleTrack(tr, 1000)
    row("HOLD", at.every((v) => v === 5) && end === 9, "a hold keeps 5 from 0 ms until the next key, which lands 9 at 1000 ms", `0..999.999 ms: ${at.join(", ")}; 1000 ms: ${end}`)
  })

  /* EASE-AE. The default key is AE's Easy Ease. */
  check("EASE-AE", "the row ran", () => {
    const tr = [K.makeKey(0, 0), K.makeKey(1000, 1)]
    const got = AE_EASY_EASE.map(([u]) => K.sampleTrack(tr, u * 1000))
    const err = Math.max(...got.map((v, i) => Math.abs(v - AE_EASY_EASE[i][1])))
    row("EASE-AE", err < 1e-9, "a new key's curve matches AE's Easy Ease (3u^2 - 2u^3) at 5 points", `u ${AE_EASY_EASE.map((p) => p[0]).join(", ")}: ${got.map((v) => v.toFixed(6)).join(", ")}; worst ${err.toExponential(2)}`)
  })

  /* EDGES. Before the first key holds the first; after the last holds the last. */
  check("EDGES", "the row ran", () => {
    const tr = [K.makeKey(200, 3), K.makeKey(800, 7)]
    const before = [-500, 0, 199.9].map((t) => K.sampleTrack(tr, t))
    const after = [800.1, 5000, 1e9].map((t) => K.sampleTrack(tr, t))
    row("EDGES", before.every((v) => v === 3) && after.every((v) => v === 7), "before the first key reads 3, after the last reads 7", `before: ${before.join(", ")}; after: ${after.join(", ")}`)
  })

  /* EMPTY. No keys is undefined, the shipped value, never 0. */
  check("EMPTY", "the row ran", () => {
    const tr = [K.makeKey(0, 1), K.makeKey(1000, 2)]
    const a = K.sampleTrack(undefined, 500)
    const b = K.sampleTrack([], 500)
    const none = K.sampleKeys(undefined, 500)
    const some = K.sampleKeys({ turn: tr }, 500)
    const others = K.KEY_PROPERTIES.filter((p) => p !== "turn")
    const ok =
      a === undefined &&
      b === undefined &&
      K.KEY_PROPERTIES.every((p) => none[p] === undefined) &&
      others.every((p) => some[p] === undefined) &&
      some.turn === 1.5 &&
      K.KEY_PROPERTIES.length === 7
    row("EMPTY", ok, "a property with no keys samples as undefined", `track undefined: ${a}; []: ${b}; sampleKeys(undefined): ${show(none)}; with turn only: ${show(some)}`)
  })

  /* SAME-CLOCK. The same clock gives the same values, in any order. */
  check("SAME-CLOCK", "the row ran", () => {
    const keys = {
      drawProgress: [lin(0, 0), K.makeKey(900, 0.4), K.makeKey(1500, 1)],
      depth: [K.makeKey(0, 1), { tMs: 300, value: 2, easeOut: { x: 0.7, y: -0.1 }, easeIn: { x: 0.4, y: 1.1 } }, K.makeKey(1400, 0.5)],
      turn: [K.makeKey(100, 0), K.makeKey(1300, 90)],
      azimuth: [K.makeKey(0, -20), K.makeKey(1600, 25)],
      elevation: [{ tMs: 0, value: 10, easeOut: "hold", easeIn: "linear" }, K.makeKey(700, 30), K.makeKey(1500, 5)],
      distance: [K.makeKey(0, 1), K.makeKey(1600, 1.4)],
      width: [K.makeKey(200, 1), K.makeKey(1100, 2), K.makeKey(1500, 0.5)],
    }
    const clocks = Array.from({ length: 257 }, (_, i) => -100 + i * 7.3)
    const pass1 = clocks.map((c) => K.sampleKeys(keys, c))
    const pass2 = [...clocks].reverse().map((c) => K.sampleKeys(keys, c)).reverse()
    let diffs = 0
    for (let i = 0; i < clocks.length; i++) for (const p of K.KEY_PROPERTIES) if (!Object.is(pass1[i][p], pass2[i][p])) diffs++
    const moving = K.KEY_PROPERTIES.every((p) => new Set(pass1.map((s) => s[p])).size > 2)
    row("SAME-CLOCK", diffs === 0 && moving, "257 clocks sampled forward, then in reverse, give the same seven values", `${diffs} of ${clocks.length * 7} values differ; every property moves: ${moving}`)
  })

  /* VALID-CONTROL. A good field validates clean and samples without throwing,
   * so the INVALID rows below cannot pass on a validator that rejects all. */
  check("VALID-CONTROL", "the row ran", () => {
    const keys = { drawProgress: [K.makeKey(0, 0), K.makeKey(1000, 1)], turn: [{ tMs: 0, value: 0, easeOut: "hold", easeIn: { x: 0, y: 0 } }, { tMs: 10, value: 1, easeOut: { x: 1, y: 2 }, easeIn: "linear" }] }
    const reasons = K.validateKeys(keys)
    const err = thrown(() => K.sampleKeys(keys, 500))
    row("VALID-CONTROL", reasons.length === 0 && err === null, "a good field, handle x at 0 and 1 included, is accepted", `reasons: ${JSON.stringify(reasons)}; sampler threw: ${err}`)
  })

  /* INVALID-*. Each bad case is rejected with its reason, and the sampler
   * throws with that reason instead of returning something plausible. */
  const INVALID = [
    { id: "INVALID-UNSORTED", keys: { turn: [K.makeKey(1000, 0), K.makeKey(500, 1)] }, reason: "unsorted" },
    { id: "INVALID-UNSORTED", keys: { turn: [K.makeKey(500, 0), K.makeKey(500, 1)] }, reason: "unsorted" },
    { id: "INVALID-NAN", keys: { depth: [K.makeKey(0, NaN), K.makeKey(500, 1)] }, reason: "value NaN is not a finite number" },
    { id: "INVALID-NAN", keys: { depth: [K.makeKey(NaN, 0), K.makeKey(500, 1)] }, reason: "tMs NaN is not a finite number" },
    { id: "INVALID-X", keys: { azimuth: [{ ...K.makeKey(0, 0), easeOut: { x: 1.2, y: 0 } }, K.makeKey(500, 1)] }, reason: "easeOut handle x 1.2 is outside 0..1" },
    { id: "INVALID-X", keys: { azimuth: [K.makeKey(0, 0), { ...K.makeKey(500, 1), easeIn: { x: -0.1, y: 1 } }] }, reason: "easeIn handle x -0.1 is outside 0..1" },
    { id: "INVALID-HOLDIN", keys: { turn: [K.makeKey(0, 0), { ...K.makeKey(500, 1), easeIn: "hold" }] }, reason: "a hold belongs on the key it leaves" },
    { id: "INVALID-RANGE", keys: { drawProgress: [K.makeKey(0, 0), K.makeKey(500, 1.4)] }, reason: "drawProgress 1.4 is outside 0..1" },
  ]
  for (const id of [...new Set(INVALID.map((c) => c.id))]) check(id, "the row ran", () => {
    const cases = INVALID.filter((c) => c.id === id)
    const notes = []
    let ok = true
    for (const c of cases) {
      const [prop] = Object.keys(c.keys)
      const reasons = K.validateKeys(c.keys)
      const hit = reasons.some((r) => r.includes(c.reason))
      const viaKeys = thrown(() => K.sampleKeys(c.keys, 250))
      const viaTrack = thrown(() => K.sampleTrack(c.keys[prop], 250, prop))
      const threw = viaKeys !== null && viaKeys.includes(c.reason) && viaTrack !== null && viaTrack.includes(c.reason)
      ok = ok && hit && threw
      notes.push(`${JSON.stringify(c.reason)}: validate ${hit ? "names it" : `says ${JSON.stringify(reasons)}`}; sampleKeys ${viaKeys === null ? "RETURNED" : "threw"}; sampleTrack ${viaTrack === null ? "RETURNED" : "threw"}`)
    }
    row(id, ok, "rejected with its reason, and the samplers throw it", notes.join(" | "))
  })

  /* WIDTH. Phase 3b made width keyable. In range, 0.5 and 2 included, it
   * validates clean and samples; outside it the validator names the reason and
   * both samplers throw it. A property that is still not keyable (`thickness`,
   * the engine word a caller might reach for) is refused, the job this row did
   * when it was INVALID-PROP and width was the unknown name. */
  check("WIDTH", "the row ran", () => {
    const notes = []
    const good = { width: [K.makeKey(0, K.WIDTH_MIN), K.makeKey(1000, K.WIDTH_MAX)] }
    const goodReasons = K.validateKeys(good)
    const mid = thrown(() => K.sampleKeys(good, 500)) ?? K.sampleKeys(good, 500).width
    const ends = [K.sampleTrack(good.width, 0, "width"), K.sampleTrack(good.width, 1000, "width")]
    let ok = goodReasons.length === 0 && mid === 1.25 && ends[0] === 0.5 && ends[1] === 2 && K.WIDTH_MIN === 0.5 && K.WIDTH_MAX === 2
    notes.push(`0.5 at 0 ms to 2 at 1000 ms: reasons ${JSON.stringify(goodReasons)}; 500 ms ${mid}; ends ${ends.join(", ")}`)
    const bad = [
      [2.5, "width 2.5 is outside 0.5..2"],
      [0.25, "width 0.25 is outside 0.5..2"],
      [0, "width 0 is outside 0.5..2"],
    ]
    for (const [v, reason] of bad) {
      const keys = { width: [K.makeKey(0, 1), K.makeKey(500, v)] }
      const hit = K.validateKeys(keys).some((r) => r.includes(reason))
      const viaKeys = thrown(() => K.sampleKeys(keys, 250))
      const viaTrack = thrown(() => K.sampleTrack(keys.width, 250, "width"))
      const threw = viaKeys !== null && viaKeys.includes(reason) && viaTrack !== null && viaTrack.includes(reason)
      ok = ok && hit && threw
      notes.push(`${v}: validate ${hit ? "names it" : "MISSES it"}; sampleKeys ${viaKeys === null ? "RETURNED" : "threw"}; sampleTrack ${viaTrack === null ? "RETURNED" : "threw"}`)
    }
    const unknown = { thickness: [K.makeKey(0, 1)] }
    const uHit = K.validateKeys(unknown).some((r) => r.includes("thickness: not a keyable property"))
    const uThrew = thrown(() => K.sampleKeys(unknown, 250))
    ok = ok && uHit && uThrew !== null && uThrew.includes("thickness: not a keyable property")
    notes.push(`thickness: validate ${uHit ? "names it" : "MISSES it"}; sampleKeys ${uThrew === null ? "RETURNED" : "threw"}`)
    row("WIDTH", ok, "width in range is accepted and sampled, out of range is refused with its reason, an unknown property is still refused", notes.join(" | "))
  })

  /* DRAW-HOLD and DRAW-NONE. The drawProgress rule on the real stroke timing. */
  check("DRAW-HOLD", "the row ran", () => {
    const S = loadTs("lib/stroke-schedule.ts")
    const T = loadTs("lib/stroke-timing.ts")
    const sched = S.buildStrokeSchedule(
      { spans: [{ from: 0, to: 0.3 }, { from: 0.3, to: 0.7 }, { from: 0.7, to: 1 }], unitOf: null, positionOf: null },
      S.DRAW_IN_DEFAULTS,
    )
    const ts = T.buildTimedSchedule(sched, { strokes: { 1: { ...T.STROKE_TIMING_NEUTRAL, delayMs: 150 } }, ripple: false }, { baseMs: 2000 })
    const takeMs = ts.takeMs
    const keys = {
      drawProgress: [lin(0, 0), K.makeKey(1000, 0.4), K.makeKey(2000, 0.4), K.makeKey(2600, 1)],
      azimuth: [K.makeKey(0, 0), K.makeKey(2600, 30)],
    }
    const spansAt = (c) => T.sampleTake(ts, K.revealClockMs(keys, c, takeMs)).spans
    const held = T.sampleTake(ts, 0.4 * takeMs).spans
    const full = T.sampleTake(ts, takeMs).spans
    const holdClocks = Array.from({ length: 41 }, (_, i) => 1000 + i * 25)
    const holdBad = holdClocks.filter((c) => !sameBytes(spansAt(c), held))
    const drawn = (sp) => [0, 1, 2].reduce((s, i) => s + (sp[i * 2 + 1] - sp[i * 2]), 0)
    const partly = drawn(held) > 0.2 && drawn(held) < 2.8
    const moves = !sameBytes(spansAt(500), held) && !sameBytes(spansAt(2300), held)
    const done = [2600, 3000].every((c) => sameBytes(spansAt(c), full)) && drawn(full) === 3
    const endMs = K.keysEndMs(keys)
    const camMoves = K.sampleKeys(keys, 1000).azimuth !== K.sampleKeys(keys, 2000).azimuth
    row(
      "DRAW-HOLD",
      !ts.identity && holdBad.length === 0 && partly && moves && done && endMs === 2600 && endMs > takeMs && camMoves,
      "drawProgress keys at 0.4 from 1000 to 2000 ms hold the whole drawing, then it finishes",
      `take ${takeMs} ms, timed (not identity) ${!ts.identity}; ${holdBad.length} of ${holdClocks.length} clocks in the hold differ from the take at 40%; ` +
        `drawn at 40% ${drawn(held).toFixed(3)} of 3 strokes; moves outside the hold ${moves}; whole at 2600 ms ${done}; ` +
        `keysEndMs ${endMs}; camera still moves through the hold ${camMoves}`,
    )
  })

  check("DRAW-NONE", "the row ran", () => {
    const takeMs = 2000
    const noDraw = { azimuth: [K.makeKey(0, 0), K.makeKey(2600, 30)] }
    const clocks = Array.from({ length: 64 }, (_, i) => i * 41.7)
    const idBad = clocks.filter((c) => !Object.is(K.revealClockMs(noDraw, c, takeMs), c) || !Object.is(K.revealClockMs(undefined, c, takeMs), c))
    row("DRAW-NONE", idBad.length === 0, "with no drawProgress keys the reveal reads clockMs itself", `${idBad.length} of ${clocks.length} clocks moved`)
  })
}

/* ---- the must-fails ----------------------------------------------------- */
const F = "lib/keyframes.ts"
const MUTANTS = [
  { name: "a key's time lands in the span before it", find: "if (track[mid].tMs <= clockMs) lo = mid", text: "if (track[mid].tMs < clockMs) lo = mid", red: ["AT-KEY"] },
  { name: "linear handle off the diagonal", find: "const LINEAR_OUT: Handle = { x: EASE_INFLUENCE, y: EASE_INFLUENCE }", text: "const LINEAR_OUT: Handle = { x: EASE_INFLUENCE, y: 0 }", red: ["LINEAR"] },
  { name: "hold read as linear", find: '  if (k0.easeOut === "hold") return k0.value\n', text: "", also: { find: 'const o = k0.easeOut === "linear" ? LINEAR_OUT : k0.easeOut', text: 'const o = k0.easeOut === "linear" || k0.easeOut === "hold" ? LINEAR_OUT : k0.easeOut' }, red: ["HOLD"] },
  { name: "default influence 30%, not AE's 33.33%", find: "export const EASE_INFLUENCE = 1 / 3", text: "export const EASE_INFLUENCE = 0.3", red: ["EASE-AE"] },
  { name: "before the first key reads as unkeyed", find: "if (clockMs <= first.tMs) return first.value", text: "if (clockMs <= first.tMs) return clockMs < first.tMs ? undefined : first.value", red: ["EDGES"] },
  { name: "after the last key reads as unkeyed", find: "if (clockMs >= last.tMs) return last.value", text: "if (clockMs >= last.tMs) return clockMs > last.tMs ? undefined : last.value", red: ["EDGES"] },
  { name: "no keys reads as 0", find: "if (track === undefined) return undefined", text: "if (track === undefined) return 0", also: { find: "keys?.[p] ? valueAt(keys[p]!, clockMs) : undefined", text: "keys?.[p] ? valueAt(keys[p]!, clockMs) : 0" }, red: ["EMPTY"] },
  { name: "sampler reads performance.now()", find: "const u = (clockMs - k0.tMs) / (k1.tMs - k0.tMs)", text: "const u = (performance.now() % 1000) / 1000", red: ["SAME-CLOCK"] },
  { name: "validator rejects every key", find: "if (!(k.tMs > prevMs)) out.push(", text: "if (true) out.push(", red: ["VALID-CONTROL"] },
  { name: "unsorted keys accepted", find: "if (!(k.tMs > prevMs)) out.push(", text: "if (false) out.push(", red: ["INVALID-UNSORTED"] },
  { name: "non-finite numbers accepted", find: "if (!finite(k.value)) out.push(", text: "if (false) out.push(", also: { find: "if (!finite(k.tMs)) out.push(", text: "if (false) out.push(" }, red: ["INVALID-NAN"] },
  { name: "handle x outside 0..1 accepted", find: "if (x < 0 || x > 1) return", text: "if (false) return", red: ["INVALID-X"] },
  { name: "hold accepted on easeIn", find: 'return side === "easeOut" ? null :', text: "return true ? null :", red: ["INVALID-HOLDIN"] },
  { name: "drawProgress outside 0..1 accepted", find: 'property === "drawProgress" && (k.value < 0 || k.value > 1)', text: "false", red: ["INVALID-RANGE"] },
  { name: "unknown property ignored", find: "      out.push(`${name}: not a keyable property", text: "      void (`${name}: not a keyable property", red: ["WIDTH"] },
  { name: "width out of range accepted", find: 'property === "width" && (k.value < WIDTH_MIN || k.value > WIDTH_MAX)', text: "false", red: ["WIDTH"] },
  { name: "width still not keyable", find: '  "distance",\n  "width",\n]', text: '  "distance",\n]', red: ["WIDTH"] },
  { name: "width range read as 0..1", find: "export const WIDTH_MAX = 2", text: "export const WIDTH_MAX = 1", red: ["WIDTH"] },
  { name: "sampleTrack drops the reasons and samples anyway", find: "  const bad = validateTrack(track, property)\n  if (bad.length) refuse(bad)", text: "  const bad = validateTrack(track, property)\n  if (false) refuse(bad)", red: ["INVALID-UNSORTED", "INVALID-NAN", "INVALID-X", "INVALID-HOLDIN", "INVALID-RANGE", "WIDTH"] },
  { name: "drawProgress multiplies the reveal", find: "return (p < 0 ? 0 : p > 1 ? 1 : p) * takeMs", text: "return (p < 0 ? 0 : p > 1 ? 1 : p) * clockMs", red: ["DRAW-HOLD"] },
  { name: "no drawProgress key reads as fully drawn", find: "if (p === undefined) return clockMs", text: "if (p === undefined) return takeMs", red: ["DRAW-NONE"] },
]

function editFor(src, find, text) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${F}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text, was: find }
}

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-keyframes-mut-"))
  const src = readFileSync(join(ROOT, F), "utf8")
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const edits = [editFor(src, m.find, m.text)]
      if (m.also) edits.push(editFor(src, m.also.find, m.also.text))
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [F]: edits }))
      const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env: { ...process.env, GATE_MUTATE_FILE: jf }, encoding: "utf8", maxBuffer: 1 << 28 })
      const line = (r.stdout || "").split("\n").find((l) => l.startsWith("ROWS_JSON "))
      if (!line) {
        note = `child did not finish (exit ${r.status}): ${(r.stderr || "").trim().split("\n").slice(-1)[0]}`
      } else {
        const got = JSON.parse(line.slice(10))
        const red = m.red.filter((id) => got.find((x) => x.id === id && !x.ok))
        caught = red.length === m.red.length
        note = `red: ${red.join(", ") || "none"} of ${m.red.join(", ")}; other reds: ${got.filter((x) => !x.ok && !m.red.includes(x.id)).map((x) => x.id).join(", ") || "none"}`
      }
    } catch (e) {
      note = `mutant could not be built: ${e.message}`
    }
    out.push({ ...m, caught, note })
  }
  rmSync(dir, { recursive: true, force: true })
  return out
}

/* ---- main ---------------------------------------------------------------- */
try {
  await runRows()
} catch (e) {
  row("RUN", false, "the rows ran to completion", String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e))
}
if (ROWS_ONLY) {
  console.log("ROWS_JSON " + JSON.stringify(rows.map(({ id, ok }) => ({ id, ok }))))
  process.exit(rows.every((r) => r.ok) ? 0 : 1)
}
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(17)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
// Every row must have at least one mutant that names it, or it has never been shown able to fail.
const unguarded = rows.filter((r) => r.id !== "RUN" && !MUTANTS.some((m) => m.red.includes(r.id))).map((r) => r.id)
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && caught === muts.length && unguarded.length === 0 ? 0 : 1)
