/* ============================================================================
 * assert-keyed-ranges.mjs: lib/keyframes.ts `styleAt` and `loopPhaseAt` over
 * EVERY entry of KEYABLE_PATHS and LOOP_SPEED_PATHS (his ruling of
 * 2026-09-26: keyframe anything; a looping motion is keyable through its
 * settings, and a keyed speed never jumps the loop).
 *
 *   node scripts/verify/assert-keyed-ranges.mjs              rows, then every mutant
 *   node scripts/verify/assert-keyed-ranges.mjs --rows-only  rows only (a mutant child runs this)
 *
 * Node only, through scripts/verify/_ts-load.mjs. Mutants go through
 * GATE_MUTATE_FILE, so nothing on disk changes. Exits 0 only when every row
 * passes, every mutant turns its rows red, and every row has a mutant.
 *
 * WHAT IS NEW HERE. assert-key-paths.mjs samples a few hand tracks and one
 * speed path (textureSpeed). These rows run a seeded corpus of tracks on every
 * path: keys anywhere in the range, its ends included, with linear, hold, Easy
 * Ease and free handles whose y overshoots. A track acceptKeys refuses is
 * counted and set aside (its reason must name the range); every accepted
 * track is sampled by styleAt at its key times, a hair either side, between
 * keys, and before the first and after the last, and every sample must sit
 * inside the path's STYLE_RANGES row exactly, with no tolerance.
 *
 * CORPUS. The rows see lib/keyframes.ts, lib/style-system.ts and the bezier
 * in lib/flip-pose.ts. They do NOT see the viewport: which paths the frame
 * reads (KEY_DISABLED) and how each loop consumes its phase are not tested.
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
const row = (id, ok, what, detail) => rows.push({ id, ok: !!ok, what, detail })
function check(id, what, fn) {
  try {
    fn()
  } catch (e) {
    row(id, false, what, `threw: ${e && e.message}`)
  }
}
const readLeaf = (o, path) => path.split(".").reduce((x, k) => x[k], o)

function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

/** A seeded track inside [min, max]: 1 to 5 keys, the range's ends often, eases of every kind. */
function makeTrack(K, r, min, max) {
  const n = 1 + Math.floor(r() * 5)
  const value = () => {
    const u = r()
    return u < 0.2 ? min : u < 0.4 ? max : min + (max - min) * r()
  }
  const handle = (side) => {
    const u = r()
    if (u < 0.2) return "linear"
    if (u < 0.45) return side === "out" ? K.EASY_EASE_OUT : K.EASY_EASE_IN
    if (side === "out" && u < 0.6) return "hold"
    // A free handle, y anywhere in -0.6..1.6, so some curves overshoot the keys.
    return { x: r(), y: -0.6 + 2.2 * r() }
  }
  const out = []
  let t = -400 + Math.floor(r() * 800)
  for (let i = 0; i < n; i++) {
    out.push({ tMs: t, value: value(), easeOut: handle("out"), easeIn: handle("in") })
    t += 1 + Math.floor(r() * 1500)
  }
  return out
}

/** Sample times for a track: each key, a hair either side, 7 between each pair, and outside both ends. */
function timesFor(track) {
  const ts = [track[0].tMs - 1000, track[0].tMs - 1e-6, track[track.length - 1].tMs + 1e-6, track[track.length - 1].tMs + 1000]
  for (let i = 0; i < track.length; i++) {
    const k = track[i].tMs
    ts.push(k, k - 1e-9, k + 1e-9)
    if (i + 1 < track.length) {
      const k1 = track[i + 1].tMs
      for (let j = 1; j <= 7; j++) ts.push(k + ((k1 - k) * (j - 0.13)) / 7)
    }
  }
  return ts
}

const TRACKS_PER_PATH = 120

async function runRows() {
  const K = loadTs("lib/keyframes.ts")
  const S = loadTs("lib/style-system.ts")
  const base = S.DEFAULT_STYLE_STATE

  /* ---- RANGES: every sample of every accepted track sits in its range ---- */
  check("RANGES", "on every keyable path, styleAt keeps every sample of every accepted track inside the path's STYLE_RANGES row", () => {
    const r = rng(20261002)
    const baseJson = JSON.stringify(base)
    let accepted = 0
    let refused = 0
    let refusedUnnamed = 0
    let samples = 0
    let outside = 0
    let others = 0
    let wrote = 0
    const worst = []
    const perPath = []
    for (const kp of K.KEYABLE_PATHS) {
      let pathOutside = 0
      let pathAccepted = 0
      for (let i = 0; i < TRACKS_PER_PATH; i++) {
        const track = makeTrack(K, r, kp.min, kp.max)
        let keys
        try {
          keys = K.acceptKeys({ [kp.path]: track })
        } catch (e) {
          refused++
          // A refusal must say why in the range's own terms.
          if (!String(e.message).includes(`${kp.min}..${kp.max}`)) refusedUnnamed++
          continue
        }
        accepted++
        pathAccepted++
        for (const t of timesFor(track)) {
          const st = K.styleAt(base, keys, t)
          const v = readLeaf(st, kp.path)
          samples++
          if (!(typeof v === "number" && v >= kp.min && v <= kp.max)) {
            outside++
            pathOutside++
            if (worst.length < 4) worst.push(`${kp.path} ${v} at ${t} ms, range ${kp.min}..${kp.max}`)
          }
          // Every other keyable value is the base's, untouched.
          for (const other of K.KEYABLE_PATHS) if (other.path !== kp.path && !Object.is(readLeaf(st, other.path), readLeaf(base, other.path))) others++
        }
      }
      if (JSON.stringify(base) !== baseJson) wrote++
      perPath.push(`${kp.path} ${pathAccepted}${pathOutside ? ` (${pathOutside} OUT)` : ""}`)
    }
    // Positive control: the instrument sees a value outside a range when there is one.
    const probe = K.KEYABLE_PATHS[0]
    const control = !(probe.max + 1e-12 <= probe.max)
    // With nothing keyed, styleAt hands back the state itself.
    const same = K.styleAt(base, undefined, 500) === base && K.styleAt(base, K.acceptKeys({ width: [K.makeKey(0, 1)] }), 500) === base
    row("RANGES", outside === 0 && others === 0 && wrote === 0 && refusedUnnamed === 0 && accepted > K.KEYABLE_PATHS.length * 20 && refused > 0 && control && same,
      "on every keyable path, styleAt keeps every sample of every accepted track inside the path's STYLE_RANGES row",
      `${K.KEYABLE_PATHS.length} paths x ${TRACKS_PER_PATH} tracks: ${accepted} accepted, ${refused} refused (${refusedUnnamed} without the range in the reason); ${samples} samples, ${outside} outside the range, ${others} with another path changed; state written ${wrote} times; unkeyed returns the state: ${same}; ${worst.join("; ") || "no sample outside"}`)
  })

  /* ---- EDGES: a curve that touches the range's end from inside stays in -- */
  check("EDGES", "keys at both ends of each range with the strongest in-range ease: accepted, every sample inside, the ends reached", () => {
    let n = 0
    const misses = []
    let reached = 0
    for (const kp of K.KEYABLE_PATHS) {
      const tracks = [
        [{ tMs: 0, value: kp.min, easeOut: "linear", easeIn: "linear" }, { tMs: 1000, value: kp.max, easeOut: "linear", easeIn: "linear" }],
        [{ tMs: 0, value: kp.max, easeOut: K.EASY_EASE_OUT, easeIn: K.EASY_EASE_IN }, { tMs: 1000, value: kp.min, easeOut: K.EASY_EASE_OUT, easeIn: K.EASY_EASE_IN }],
        // Handles at y = 0 and y = 1: the steepest ease that never leaves 0..1.
        [{ tMs: 0, value: kp.min, easeOut: { x: 0.9, y: 0 }, easeIn: "linear" }, { tMs: 1000, value: kp.max, easeOut: "hold", easeIn: { x: 0.1, y: 1 } }, { tMs: 2000, value: kp.min, easeOut: "linear", easeIn: "linear" }],
      ]
      for (const tr of tracks) {
        n++
        let keys
        try {
          keys = K.acceptKeys({ [kp.path]: tr })
        } catch (e) {
          misses.push(`${kp.path} refused: ${e.message}`)
          continue
        }
        let lo = Infinity
        let hi = -Infinity
        for (let t = -10; t <= 2010; t += 0.5) {
          const v = readLeaf(K.styleAt(base, keys, t), kp.path)
          lo = Math.min(lo, v)
          hi = Math.max(hi, v)
        }
        if (lo < kp.min || hi > kp.max) misses.push(`${kp.path} reached ${lo}..${hi}, range ${kp.min}..${kp.max}`)
        if (lo === kp.min && hi === kp.max) reached++
      }
    }
    row("EDGES", misses.length === 0 && reached === n,
      "keys at both ends of each range with the strongest in-range ease: accepted, every sample inside, the ends reached",
      `${n - misses.length} of ${n} edge tracks accepted and inside; ${reached} reach both ends exactly; ${misses.slice(0, 3).join("; ") || "no misses"}`)
  })

  /* ---- PHASE: a keyed speed ramp never jumps any loop ------------------ *
   *
   * THREE BARS, because the phase is a 64-step Simpson sum per span and not
   * the exact integral, so its local rate can sit a little off the speed
   * (measured: up to about 2x on a step of a microsecond) without the phase
   * ever being discontinuous:
   *   . NO JUMP: at every key and at clock 0, the phase a tenth of a
   *     nanosecond either side differs by under 1e-8 s. A continuous phase
   *     moves at most 3 x 2e-7 ms there, about 6e-10 s; a jump anyone could
   *     see is a millisecond of loop time or more.
   *   . PER FRAME: over each 60 fps frame (and each part frame a key cuts), the
   *     phase moves no more than the largest |speed| on it (513 samples)
   *     allows, plus 1e-4 s, a 166th of a frame at 1x. The first run, with a
   *     1e-6 s floor, read one frame of 22915 at 1.0015x its bound (1.5e-5 s
   *     over): the Simpson nodes of a 1.5 s span sit 23 ms apart, wider than a
   *     frame, so the sum wobbles by that much. Speed times time, the thing
   *     this bar exists to catch, is over by orders more (see the mutants).
   *   . THE SUM: against a 20000-step trapezoid of the speed, independent of
   *     the code, off by under 1e-3 s, a sixteenth of a frame at 1x. */
  check("PHASE", "on every loop speed path, keyed speed ramps never jump the phase: continuous at every key, within the speed every frame, the integral of the speed", () => {
    const r = rng(4242)
    let frames = 0
    let frameOver = 0
    let jumps = 0
    let keysChecked = 0
    let integralWorst = 0
    let tracksRun = 0
    let worstRatio = 0
    let worstJump = 0
    const misses = []
    for (const path of K.LOOP_SPEED_PATHS) {
      const kp = K.styleRangeOf(path)
      for (let i = 0; i < 24; i++) {
        let track
        let keys
        do {
          track = makeTrack(K, r, kp.min, kp.max)
          try {
            keys = K.acceptKeys({ [path]: track })
          } catch {
            keys = null
          }
        } while (!keys)
        tracksRun++
        const speedAt = (t) => K.sampleTrack(track, t)
        const phase = (t) => K.loopPhaseAt(base, keys, path, t)
        // NO JUMP, at every key and at clock 0.
        for (const k of [0, ...track.map((x) => x.tMs)]) {
          keysChecked++
          const d = Math.abs(phase(k + 1e-7) - phase(k - 1e-7))
          worstJump = Math.max(worstJump, d)
          if (d >= 1e-8) {
            jumps++
            if (misses.length < 3) misses.push(`${path} jumps ${d.toExponential(3)} s at ${k} ms`)
          }
        }
        // PER FRAME.
        const t0 = Math.min(0, track[0].tMs) - 500
        const t1 = track[track.length - 1].tMs + 500
        const ts = []
        for (let t = t0; t <= t1; t += 1000 / 60) ts.push(t)
        for (const k of track) ts.push(k.tMs)
        ts.push(0)
        ts.sort((a, b) => a - b)
        let prev = phase(ts[0])
        for (let j = 1; j < ts.length; j++) {
          const [a, b] = [ts[j - 1], ts[j]]
          const cur = phase(b)
          if (b - a <= 0) {
            prev = cur
            continue
          }
          frames++
          // The largest |speed| on the step, sampled at 513 points: 33 missed the
          // peak of a steep handle by enough to read a step as over (first run).
          let top = 0
          for (let q = 0; q <= 512; q++) top = Math.max(top, Math.abs(speedAt(a + ((b - a) * q) / 512)))
          const lim = (top * (b - a)) / 1000
          const d = Math.abs(cur - prev)
          if (d > lim + 1e-4) {
            frameOver++
            if (misses.length < 3) misses.push(`${path} ${a.toFixed(3)} to ${b.toFixed(3)} ms: moved ${d.toExponential(3)} s, bound ${lim.toExponential(3)} s`)
          }
          if (lim > 1e-9) worstRatio = Math.max(worstRatio, d / lim)
          prev = cur
        }
        // THE SUM.
        for (const T of [t1, (t0 + t1) / 2]) {
          const N = 20000
          const lo = Math.min(0, T)
          const hi = Math.max(0, T)
          const h = (hi - lo) / N
          let area = 0
          for (let q = 0; q < N; q++) area += ((speedAt(lo + q * h) + speedAt(lo + (q + 1) * h)) / 2) * h
          const want = (T >= 0 ? area : -area) / 1000
          integralWorst = Math.max(integralWorst, Math.abs(phase(T) - want))
        }
      }
    }
    // Unkeyed is the speed times the time, exactly, on every loop path.
    const flat = K.LOOP_SPEED_PATHS.every((p) => [0, 777, 4000, -250].every((t) => K.loopPhaseAt(base, undefined, p, t) === (readLeaf(base, p) * t) / 1000))
    row("PHASE", jumps === 0 && frameOver === 0 && integralWorst < 1e-3 && flat && tracksRun === K.LOOP_SPEED_PATHS.length * 24,
      "on every loop speed path, keyed speed ramps never jump the phase: continuous at every key, within the speed every frame, the integral of the speed",
      `${K.LOOP_SPEED_PATHS.length} paths (${K.LOOP_SPEED_PATHS.join(", ")}) x 24 accepted ramps: ${jumps} jumps at ${keysChecked} keys and clock 0 (largest step across one ${worstJump.toExponential(2)} s); ` +
      `${frameOver} of ${frames} frame steps over the speed (largest ${worstRatio.toFixed(4)}x its bound); sum off by at most ${integralWorst.toExponential(2)} s; unkeyed is speed times time: ${flat}; ${misses.join("; ") || "no miss"}`)
  })
}

/* ---- the must-fails ----------------------------------------------------- */
const KF = "lib/keyframes.ts"

/* RANGES is red on this branch: an ease into a key with its handle at y = 1
 * (Easy Ease's in handle) reads 1.0000000000000002 a hair before the key, and
 * the sample lands an ulp past the range's end (LOG.md names it). A row that is
 * already red proves nothing by going red under a mutant, so RANGES' must-fails
 * run on a FIXED valueAt, applied through GATE_MUTATE_FILE and never written to
 * disk: FIX turns every row green, and each RANGES mutant is FIX plus its own
 * sabotage. FIX holds the ease inside the span's own reach (spanReach, the
 * function the validator already runs) and returns each key's own value where
 * the reach is the key, so rounding can no longer carry a sample past what
 * acceptKeys checked; and it sets reachReasons' tolerance to 0, since a curve
 * the tolerance let through dipped 1.1e-26 under asciiDelay's 0 (second run).
 * It is one shape a product fix could take; the call is the owner's. */
const FIX_AT = "  return k0.value + (k1.value - k0.value) * cubicBezierEase(o.x, o.y, n.x, n.y)(u)\n"
const FIX = `  const [rLo, rHi] = spanReach(o, n)
  const raw = cubicBezierEase(o.x, o.y, n.x, n.y)(u)
  const e = Math.min(rHi, Math.max(rLo, raw))
  const d = k1.value - k0.value
  const at = (f: number) => (f === 0 ? k0.value : f === 1 ? k1.value : k0.value + d * f)
  const ya = at(rLo)
  const yb = at(rHi)
  return Math.min(Math.max(ya, yb), Math.max(Math.min(ya, yb), at(e)))
`
const EPS_AT = "    const eps = 1e-9 * (r.max - r.min)\n"
const fixed = (find, text) => [{ find: FIX_AT, text: FIX }, { find: EPS_AT, text: "    const eps = 0\n" }, ...(find ? [{ find, text }] : [])]

const MUTANTS = [
  { name: "MUST-PASS: valueAt with the ease held inside its span's reach (FIX) turns every row green", file: KF, edits: fixed(), green: ["RANGES", "EDGES", "PHASE"], red: [] },
  { name: "FIX, and a curve swinging out of range accepted", file: KF, edits: fixed("if (range && out.length === 0) out.push(...reachReasons(", "if (false) out.push(...reachReasons("), red: ["RANGES"] },
  { name: "FIX, and styleAt scales its sample by 1.5", file: KF, edits: fixed("    into[parts[parts.length - 1]] = valueAt(track, clockMs)\n", "    into[parts[parts.length - 1]] = valueAt(track, clockMs)! * 1.5\n"), red: ["RANGES"] },
  { name: "FIX, and styleAt writes into the nested object it was given", file: KF, edits: fixed("      if (into[parts[i]] === next) into[parts[i]] = { ...next }\n", "\n"), red: ["RANGES"] },
  { name: "a curve that only touches its range's end is refused", file: KF, find: "    const eps = 1e-9 * (r.max - r.min)\n", text: "    const eps = -1e-9 * (r.max - r.min)\n", red: ["EDGES"] },
  { name: "the sample at a key is not the key's value", file: KF, find: "  if (clockMs <= first.tMs) return first.value\n", text: "  if (clockMs <= first.tMs) return first.value + (last.value - first.value) * 1e-3\n", red: ["EDGES"] },
  { name: "a hold's area uses the next key's speed", file: KF, find: "  if (k0.easeOut === \"hold\") return k0.value * (b - a)\n", text: "  if (k0.easeOut === \"hold\") return track[i + 1].value * (b - a)\n", red: ["PHASE"] },
  { name: "the phase is not taken from clock 0", file: KF, find: "return (F(clockMs) - F(0)) / 1000", text: "return F(clockMs) / 1000", red: ["PHASE"] },
  { name: "phase is speed times time", file: KF, find: "return (F(clockMs) - F(0)) / 1000", text: "return (valueAt(track, clockMs)! * clockMs) / 1000", red: ["PHASE"] },
]

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-keyed-ranges-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const src = readFileSync(join(ROOT, m.file), "utf8")
      const edits = (m.edits || [{ find: m.find, text: m.text }]).map((e) => {
        const at = src.indexOf(e.find)
        if (at < 0 || src.indexOf(e.find, at + 1) >= 0) throw new Error(`mutant text not unique in ${m.file}`)
        return { pos: at, end: at + e.find.length, text: e.text, was: e.find }
      })
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [m.file]: edits }))
      const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env: { ...process.env, GATE_MUTATE_FILE: jf }, encoding: "utf8", maxBuffer: 1 << 28 })
      const line = (r.stdout || "").split("\n").find((l) => l.startsWith("ROWS_JSON "))
      if (!line) note = `child did not finish (exit ${r.status}): ${(r.stderr || "").trim().split("\n").slice(-1)[0]}`
      else {
        const got = JSON.parse(line.slice(10))
        const red = m.red.filter((id) => got.find((x) => x.id === id && !x.ok))
        const green = (m.green || []).filter((id) => got.find((x) => x.id === id && x.ok))
        caught = red.length === m.red.length && green.length === (m.green || []).length
        note = m.green
          ? `green: ${green.join(", ") || "none"} of ${m.green.join(", ")}`
          : `red: ${red.join(", ") || "none"} of ${m.red.join(", ")}; other reds: ${got.filter((x) => !x.ok && !m.red.includes(x.id)).map((x) => x.id).join(", ") || "none"}`
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
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(9)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red; the MUST-PASS must turn them green)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
const unguarded = rows.filter((r) => r.id !== "RUN" && !MUTANTS.some((m) => m.red.includes(r.id))).map((r) => r.id)
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && caught === muts.length && unguarded.length === 0 ? 0 : 1)
