#!/usr/bin/env node
/* ============================================================================
 * assert-camera-moves: the named camera moves and thinKeys (`lib/camera-moves.ts`),
 * phase 5 of `docs/research-2026-09-25/animation-tools/DESIGN.md`. Node only.
 *
 *   node scripts/verify/assert-camera-moves.mjs              rows, then every must-fail
 *   node scripts/verify/assert-camera-moves.mjs --rows-only  rows only (a mutant child runs this)
 *
 * WHAT IT READS. The moves run on takes built by the real stroke timing
 * (`buildStrokeSchedule`, `buildTimedSchedule`): a six-stroke take with pen
 * lifts, the same take with a drawProgress pause, a take whose strokes overlap,
 * a take with no lifts, and a take whose draw progress never finishes. Where a
 * key should land is worked out HERE, from the slots and `revealClockMs`, by a
 * different method than the library's, so a row never checks the code against
 * itself.
 *
 * WHAT IT DOES NOT READ. The viewport, `KeyCamera`, the picker. Nothing here
 * proves `/` offers these moves or that the camera follows the keys on screen.
 *
 * MUST-FAILS. Each mutant is a one-line sabotage of `lib/camera-moves.ts`, or of
 * `lib/keyframes.ts` where a mutant names that file, applied by `_ts-load.mjs`
 * through GATE_MUTATE_FILE (nothing on disk changes).
 * A mutant whose text is gone fails loudly. It counts as caught only when the
 * child ran to completion AND every named row went red.
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
/* A sampled camera value must be a finite number. Every stillness and speed row below
 * compares sampled differences, and `NaN > bar` is false, so a NaN sample used to read
 * as a camera that never moved (Codex crosscheck, 2026-09-26). `at` refuses by name,
 * and every comparison is written as `!(x <= bar)` so a NaN from the arithmetic fails too. */
const at = (K, tr, c) => {
  const v = K.sampleTrack(tr, c)
  if (!Number.isFinite(v)) throw new Error(`sampleTrack gave ${v} at ${c} ms, not a finite number`)
  return v
}
const thrown = (fn) => {
  try {
    fn()
    return null
  } catch (e) {
    return String(e && e.message)
  }
}

async function runRows() {
  const K = loadTs("lib/keyframes.ts")
  const S = loadTs("lib/stroke-schedule.ts")
  const T = loadTs("lib/stroke-timing.ts")
  const C = loadTs("lib/camera-moves.ts")
  const byId = Object.fromEntries(C.CAMERA_MOVES.map((m) => [m.id, m]))

  /* ---- the takes, from the real stroke timing ---- */
  const schedOf = (n) =>
    S.buildStrokeSchedule({ spans: Array.from({ length: n }, (_, i) => ({ from: i / n, to: (i + 1) / n })), unitOf: null, positionOf: null }, S.DRAW_IN_DEFAULTS)
  const N = T.STROKE_TIMING_NEUTRAL
  const liftRows = {}
  for (let i = 1; i < 6; i++) liftRows[i] = { ...N, delayMs: 150 + (i % 3) * 100 }
  const tsA = T.buildTimedSchedule(schedOf(6), { strokes: liftRows, ripple: true }, { baseMs: 3000 })
  const A = { slots: tsA.slots, takeMs: tsA.takeMs }
  const pause = [K.makeKey(0, 0), K.makeKey(1500, 0.4), K.makeKey(2600, 0.4), K.makeKey(5200, 1)]
  const B = { ...A, keys: { drawProgress: pause } }
  const tsC = T.buildTimedSchedule(schedOf(4), { strokes: { 1: { ...N, delayMs: 600 }, 3: { ...N, delayMs: 300 } }, ripple: false }, { baseMs: 2000 })
  const Cv = { slots: tsC.slots, takeMs: tsC.takeMs }
  const tsD = T.buildTimedSchedule(schedOf(3), { strokes: { 0: { ...N } }, ripple: false }, { baseMs: 2000 })
  const D = { slots: tsD.slots, takeMs: tsD.takeMs }
  const E = { ...A, keys: { drawProgress: [K.makeKey(0, 0), K.makeKey(3000, 0.7)] } }
  const TAKES = { A, B, C: Cv }

  /* ---- where things land on the clock, worked out independently ---- */
  const clockCache = new Map()
  function clockOf(take, t) {
    const dp = take.keys?.drawProgress
    if (!dp) return t
    let tab = clockCache.get(take)
    if (!tab) {
      tab = []
      for (let c = 0; c <= dp[dp.length - 1].tMs + 1; c += 0.05) tab.push([c, K.revealClockMs(take.keys, c, take.takeMs)])
      clockCache.set(take, tab)
    }
    // The first grid point past the crossing, then bisected against the grid point before it,
    // so a window edge is exact and not up to 0.05 ms late.
    const at = tab.findIndex(([, r]) => r >= t - 1e-9)
    if (at < 0) return null
    if (at === 0) return 0
    let [a, b] = [tab[at - 1][0], tab[at][0]]
    for (let i = 0; i < 60; i++) {
      const m = (a + b) / 2
      if (K.revealClockMs(take.keys, m, take.takeMs) >= t - 1e-9) b = m
      else a = m
    }
    return b
  }
  const windowsOf = (take) => {
    const out = []
    for (let i = 0; i < take.slots.length / 2; i++) out.push([clockOf(take, take.slots[2 * i]), clockOf(take, take.slots[2 * i + 1])])
    return out
  }
  /** Gaps in the drawing: every stretch between two window edges whose midpoint no stroke is drawing. */
  function gapsOf(W) {
    const edges = [...new Set(W.flat())].sort((a, b) => a - b)
    const out = []
    for (let i = 0; i + 1 < edges.length; i++) {
      const m = (edges[i] + edges[i + 1]) / 2
      if (W.some(([a, b]) => a <= m && m <= b)) continue
      if (out.length && Math.abs(out[out.length - 1][1] - edges[i]) < 1e-9) out[out.length - 1][1] = edges[i + 1]
      else out.push([edges[i], edges[i + 1]])
    }
    return out
  }
  /** Per move: the key times each track must hold, and the only stretches it may move in. */
  function expectFor(id, take) {
    const W = windowsOf(take)
    const L = Math.max(...W.map((w) => w[1]))
    if (id === "orbit-lifts") {
      const lifts = gapsOf(W).filter(([a, b]) => b - a >= 120)
      return { anchors: { azimuth: lifts.flat() }, moving: lifts }
    }
    if (id === "settle-front") {
      const early = W.map((w) => w[0]).filter((c) => L - c >= 700)
      const s = early.length ? Math.max(...early) : Math.min(...W.map((w) => w[0]))
      return { anchors: { azimuth: [s, L], elevation: [s, L] }, moving: [[s, L]] }
    }
    if (id === "depth-turn") {
      return { anchors: { azimuth: [L, L + 400, L + 1400, L + 2000, L + 3000] }, moving: [[L + 400, L + 1400], [L + 2000, L + 3000]] }
    }
    if (id === "lean-in") {
      const dp = take.keys.drawProgress
      let best = null
      for (let i = 0; i + 1 < dp.length; i++) {
        const held = dp[i].easeOut === "hold" || dp[i].value === dp[i + 1].value
        if (held && dp[i + 1].tMs - dp[i].tMs >= 200 && (!best || dp[i + 1].tMs - dp[i].tMs > best[1] - best[0])) best = [dp[i].tMs, dp[i + 1].tMs]
      }
      return { anchors: { distance: best, elevation: best }, moving: [best] }
    }
    throw new Error(`the gate has no expectation for move ${id}`)
  }
  /** Which moves run on which take. Lean in needs the pause, so it runs on B only. */
  const RUNS = [
    ["orbit-lifts", "A"], ["orbit-lifts", "B"], ["orbit-lifts", "C"],
    ["settle-front", "A"], ["settle-front", "B"],
    ["depth-turn", "A"], ["depth-turn", "B"],
    ["lean-in", "B"],
  ]
  const keysOf = (id, t) => byId[id].keys(TAKES[t])

  check("VALID", "the rows ran", () => {
    const bad = []
    for (const [id, t] of RUNS) {
      const k = keysOf(id, t)
      const r = K.validateKeys(k)
      const tracks = Object.keys(k).sort().join(",")
      if (r.length) bad.push(`${id} on ${t}: ${r[0]}`)
      if (tracks !== [...byId[id].tracks].sort().join(",")) bad.push(`${id} on ${t} wrote ${tracks}, names ${byId[id].tracks.join(",")}`)
      if (Object.values(k).some((tr) => tr.length < 2)) bad.push(`${id} on ${t} wrote a track with fewer than 2 keys`)
      // A move whose keys all sit at one value places a camera and never moves it.
      for (const [p, tr] of Object.entries(k)) if (Math.max(...tr.map((x) => x.value)) - Math.min(...tr.map((x) => x.value)) <= 0) bad.push(`${id} on ${t} ${p} never moves`)
      if (id === "orbit-lifts" && Math.abs(k.azimuth.at(-1).value - k.azimuth[0].value - 30) > 1e-9) bad.push(`orbit on ${t} turns ${(k.azimuth.at(-1).value - k.azimuth[0].value).toFixed(3)} deg, not its 30`)
    }
    const covered = new Set(RUNS.map((r) => r[0]))
    for (const m of C.CAMERA_MOVES) if (!covered.has(m.id)) bad.push(`${m.id} is never run by this gate`)
    for (const m of C.CAMERA_MOVES) if (!m.reason || !m.label || /[\u2013\u2014]/.test(m.reason + m.label)) bad.push(`${m.id} has no reason line, or a dash in it`)
    row("VALID", bad.length === 0, "every move returns keys validateKeys accepts, on exactly the tracks it names", bad.join(" | ") || `${RUNS.length} runs over ${C.CAMERA_MOVES.length} moves, all valid`)
  })

  check("LANDS", "the rows ran", () => {
    const bad = []
    let n = 0
    for (const [id, t] of RUNS) {
      const k = keysOf(id, t)
      const { anchors } = expectFor(id, TAKES[t])
      for (const [p, want] of Object.entries(anchors)) {
        const got = (k[p] ?? []).map((x) => x.tMs)
        if (got.length !== want.length) bad.push(`${id} on ${t} ${p}: ${got.length} keys, expected ${want.length}`)
        else
          for (let i = 0; i < got.length; i++) {
            n++
            if (!(Math.abs(got[i] - want[i]) <= 1)) bad.push(`${id} on ${t} ${p} key ${i} at ${got[i].toFixed(2)} ms, the slot is at ${want[i].toFixed(2)}`)
          }
      }
    }
    row("LANDS", bad.length === 0, "each move's keys land on the stroke slot it names, within 1 ms, through the drawProgress remap", bad.slice(0, 3).join(" | ") || `${n} keys on their slots`)
  })

  check("ORBIT-STILL", "the rows ran", () => {
    const bad = []
    let windows = 0
    for (const t of ["A", "B", "C"]) {
      const az = keysOf("orbit-lifts", t).azimuth
      for (const [c0, c1] of windowsOf(TAKES[t])) {
        windows++
        const v0 = at(K, az, c0)
        let worst = 0
        for (let c = c0; c <= c1; c += 0.5) worst = Math.max(worst, Math.abs(at(K, az, c) - v0))
        worst = Math.max(worst, Math.abs(at(K, az, c1) - v0))
        if (!(worst <= 1e-9)) bad.push(`take ${t} window [${c0.toFixed(1)}, ${c1.toFixed(1)}] turns ${worst.toFixed(4)} deg`)
      }
    }
    row("ORBIT-STILL", bad.length === 0, "Turn in the lifts changes azimuth by exactly 0 while any stroke draws", bad.slice(0, 3).join(" | ") || `${windows} draw windows over 3 takes, 0 deg in each`)
  })

  check("HOLDS", "the rows ran", () => {
    const bad = []
    for (const [id, t] of RUNS) {
      const k = keysOf(id, t)
      const { moving } = expectFor(id, TAKES[t])
      const end = K.keysEndMs(k) + 500
      const still = []
      let x = 0
      for (const [a, b] of [...moving].sort((p, q) => p[0] - q[0])) {
        if (a > x) still.push([x, a])
        x = Math.max(x, b)
      }
      still.push([x, end])
      for (const [p, tr] of Object.entries(k))
        for (const [a, b] of still) {
          const v0 = at(K, tr, a)
          for (let c = a; c <= b; c += 1) if (!(Math.abs(at(K, tr, c) - v0) <= 1e-9)) {
            bad.push(`${id} on ${t} ${p} moves at ${c.toFixed(1)} ms, outside the stretch it names`)
            break
          }
        }
    }
    row("HOLDS", bad.length === 0, "every move is exactly still outside the stretches its reason names", bad.slice(0, 3).join(" | ") || `${RUNS.length} runs, still everywhere else`)
  })

  check("EASED", "the rows ran", () => {
    const bad = []
    const same = (h, e) => h && typeof h === "object" && h.x === e.x && h.y === e.y
    const frame = 1000 / 60
    for (const [id, t] of RUNS)
      for (const [p, tr] of Object.entries(keysOf(id, t))) {
        tr.forEach((k, i) => {
          if (!same(k.easeOut, K.EASY_EASE_OUT) || !same(k.easeIn, K.EASY_EASE_IN)) bad.push(`${id} ${p} key ${i} is not Easy Ease`)
        })
        for (let i = 0; i + 1 < tr.length; i++) {
          const [k0, k1] = [tr[i], tr[i + 1]]
          const dv = Math.abs(k1.value - k0.value)
          const dt = k1.tMs - k0.tMs
          if (dv === 0) continue
          const lin = (dv * 0.5) / dt
          const atStart = Math.abs(at(K, tr, k0.tMs + 0.5) - k0.value) / lin
          const atEnd = Math.abs(k1.value - at(K, tr, k1.tMs - 0.5)) / lin
          if (!(atStart <= 0.1) || !(atEnd <= 0.1)) bad.push(`${id} on ${t} ${p} span ${i} leaves at ${atStart.toFixed(2)} and arrives at ${atEnd.toFixed(2)} of linear speed`)
          let maxStep = 0
          for (let c = k0.tMs; c + frame <= k1.tMs; c += frame) maxStep = Math.max(maxStep, Math.abs(at(K, tr, c + frame) - at(K, tr, c)))
          if (!(maxStep <= 1.5 * dv * (frame / dt) * 1.02 + 1e-9)) bad.push(`${id} ${p} span ${i} steps ${maxStep.toFixed(3)} in one frame, over the eased maximum`)
        }
      }
    row("EASED", bad.length === 0, "every camera key is Easy Ease: each span leaves and arrives at rest and never steps past 1.5x its average speed", bad.slice(0, 3).join(" | ") || "every span eases in and out")
  })

  check("DETERMINISTIC", "the rows ran", () => {
    const bad = []
    const snap = (tk) => JSON.stringify({ s: Array.from(tk.slots), m: tk.takeMs, k: tk.keys ?? null })
    for (const [id, t] of RUNS) {
      const before = snap(TAKES[t])
      const clone = { slots: Float64Array.from(TAKES[t].slots), takeMs: TAKES[t].takeMs, keys: structuredClone(TAKES[t].keys) }
      const a = JSON.stringify(byId[id].keys(TAKES[t]))
      const b = JSON.stringify(byId[id].keys(clone))
      if (a !== b) bad.push(`${id} on ${t} gave different keys on a second run`)
      if (snap(TAKES[t]) !== before) bad.push(`${id} on ${t} changed the take it read`)
    }
    row("DETERMINISTIC", bad.length === 0, "the same take gives the same keys, and a move never edits the take", bad.join(" | ") || `${RUNS.length} runs, byte-identical twice`)
  })

  check("REFUSE", "the rows ran", () => {
    const bad = []
    const expectRefusal = (m, take, opts, needle, what) => {
      const msg = thrown(() => m.keys(take, opts))
      if (msg === null) bad.push(`${m.id} on ${what} returned keys`)
      else if (!msg.startsWith(`${m.label}: `) || !msg.includes(needle)) bad.push(`${m.id} on ${what} threw "${msg.slice(0, 70)}", not its reason`)
    }
    for (const m of C.CAMERA_MOVES) {
      expectRefusal(m, null, undefined, "no timed schedule", "no schedule")
      expectRefusal(m, { slots: new Float64Array(0), takeMs: 0 }, undefined, "no strokes", "an empty take")
      expectRefusal(m, E, undefined, "never reach", "a take that never finishes")
    }
    expectRefusal(byId["orbit-lifts"], D, undefined, "never lifts", "a take with no lifts")
    expectRefusal(byId["lean-in"], A, undefined, "never pauses", "a take with no pause")
    expectRefusal(byId["settle-front"], A, { from: C.FRONT }, "already starts face-on", "a face-on start")
    const tr = C.tryCameraMove(byId["lean-in"], A)
    if (!tr.refused || tr.keys) bad.push("tryCameraMove did not hand back the refusal")
    row("REFUSE", bad.length === 0, "a move with no moment to land on refuses with its own reason", bad.slice(0, 3).join(" | ") || `${C.CAMERA_MOVES.length * 3 + 3} refusals, each naming why`)
  })

  /* ---- thinKeys on a recorded path: two sines, a held stretch, frame noise ---- */
  let seed = 7
  const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648 - 0.5
  const wave = (t) => 12 * Math.sin((2 * Math.PI * t) / 2600) + 4 * Math.sin((2 * Math.PI * t) / 900)
  const rec = []
  for (let t = 0; t <= 6000; t += 1000 / 60) rec.push({ tMs: t, value: wave(t > 2000 && t < 2800 ? 2000 : t) + 0.1 * rnd() })
  const fit = (tol) => {
    const tr = C.thinKeys(rec, tol)
    let err = 0
    for (const s of rec) err = Math.max(err, Math.abs(K.sampleTrack(tr, s.tMs) - s.value))
    return { tr, err }
  }

  check("THIN-FIT", "the rows ran", () => {
    const { tr, err } = fit(0.5)
    const v = K.validateTrack(tr)
    const ends = tr[0].tMs === rec[0].tMs && tr[tr.length - 1].value === rec[rec.length - 1].value
    const ok = v.length === 0 && err <= 0.5 && tr.length * 10 <= rec.length && ends
    row("THIN-FIT", ok, "thinKeys fits a recorded path within the tolerance with a tenth of the keys or fewer", `${tr.length} keys for ${rec.length} samples, worst miss ${err.toFixed(3)} deg against 0.5${v.length ? `; invalid: ${v[0]}` : ""}${ends ? "" : "; endpoints moved"}`)
  })

  check("THIN-LOOSER", "the rows ran", () => {
    const tols = [0.25, 0.5, 1, 2]
    const got = tols.map((tol) => ({ tol, ...fit(tol) }))
    const fewer = got.every((g, i) => i === 0 || g.tr.length <= got[i - 1].tr.length) && got[3].tr.length < got[0].tr.length
    const within = got.every((g) => g.err <= g.tol)
    row("THIN-LOOSER", fewer && within, "a looser tolerance gives fewer keys, each fit still within its own tolerance", got.map((g) => `${g.tol}: ${g.tr.length} keys, miss ${g.err.toFixed(2)}`).join("; "))
  })

  check("THIN-REFUSE", "the rows ran", () => {
    const cases = [
      ["no samples", () => C.thinKeys([], 1)],
      ["unsorted", () => C.thinKeys([{ tMs: 10, value: 0 }, { tMs: 5, value: 1 }], 1)],
      ["NaN value", () => C.thinKeys([{ tMs: 0, value: 0 }, { tMs: 5, value: NaN }], 1)],
      ["tolerance 0", () => C.thinKeys(rec, 0)],
    ]
    const bad = cases.map(([w, f]) => [w, thrown(f)]).filter(([, m]) => !m || !m.startsWith("Thin keys: "))
    row("THIN-REFUSE", bad.length === 0, "thinKeys refuses bad samples with the reason, never thins them", bad.map(([w, m]) => `${w}: ${m === null ? "returned keys" : m.slice(0, 60)}`).join(" | ") || `${cases.length} bad inputs refused`)
  })
}

/* ---- the must-fails ----------------------------------------------------- */
const F = "lib/camera-moves.ts"
const MUTANTS = [
  { name: "settle's landing key sits on its start", find: "key(landingMs, FRONT.azimuth)", text: "key(startMs, FRONT.azimuth)", red: ["VALID"] },
  { name: "orbit turns 0 degrees: keys placed, camera never moves", find: "cur += (turn * (b - a)) / total", text: "cur += 0", red: ["VALID"] },
  { name: "drawProgress remap ignored: slots read as clock", find: "if (!dp || dp.length === 0) return (t) => t", text: "if (true) return (t) => t", red: ["LANDS"] },
  { name: "settle always starts at the first stroke", find: "const startMs = early.length ? Math.max(...early) : Math.min(...starts)", text: "const startMs = Math.min(...starts)", red: ["LANDS"] },
  { name: "the turn starts 30 ms before the pen lifts", find: "pushKey(az, a, cur)", text: "pushKey(az, a - 30, cur)", red: ["ORBIT-STILL"] },
  { name: "lifts read in stroke order, not merged by time", find: ".sort((a, b) => a[0] - b[0])", text: "", red: ["ORBIT-STILL"] },
  { name: "depth turn drops its dwell", find: "pushKey(az, landingMs + hold + move + dwell, a0 + turn)", text: "", red: ["HOLDS"] },
  { name: "camera keys linear, not Easy Ease", find: "const key = (tMs: number, value: number): Key => makeKey(tMs, value)", text: 'const key = (tMs: number, value: number): Key => ({ tMs, value, easeOut: "linear", easeIn: "linear" })', red: ["EASED"] },
  { name: "orbit share jitters by Math.random", find: "cur += (turn * (b - a)) / total", text: "cur += ((turn * (b - a)) / total) * (1 + Math.random() * 1e-9)", red: ["DETERMINISTIC"] },
  { name: "empty take not refused", find: "if (!s || n === 0 || s.length % 2 !== 0) refuse(", text: "if (false) refuse(", red: ["REFUSE"] },
  { name: "a stroke that never lands not refused", find: "if (c0 === null || c1 === null) {", text: "if (false) {", red: ["REFUSE"] },
  { name: "orbit with no lifts not refused", find: "if (lifts.length === 0) {", text: "if (false) {", red: ["REFUSE"] },
  { name: "lean in with no pause not refused", find: "if (pauses.length === 0) {", text: "if (false) {", red: ["REFUSE"] },
  { name: "thinning stops at the turning points", find: "if (worst >= 0) {", text: "if (false) {", red: ["THIN-FIT"] },
  { name: "thinning keeps every sample", find: "const keep = new Set<number>([0, n - 1])", text: "const keep = new Set<number>(t.map((_, i) => i))", red: ["THIN-FIT", "THIN-LOOSER"] },
  { name: "thinKeys thins bad samples instead of refusing", find: "if (bad.length) throw new Error(`Thin keys:", text: "if (false) throw new Error(`Thin keys:", red: ["THIN-REFUSE"] },
  // The keys stay valid and only the sampled camera output goes bad. The drawProgress
  // read is left alone so the clock remap still works and no row goes red by a throw
  // from somewhere else. A `>` on a NaN difference is false, so before 2026-09-26
  // these three rows read a NaN camera as a still one.
  { file: "lib/keyframes.ts", name: "sampleTrack returns NaN for a camera track while the keys stay valid", find: "return valueAt(track, clockMs)", text: 'return property === "drawProgress" ? valueAt(track, clockMs) : NaN', red: ["ORBIT-STILL", "HOLDS", "EASED"] },
]

function editFor(src, find, text, file = F) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${file}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text, was: find }
}

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-camera-mut-"))
  const srcs = {}
  const srcOf = (f) => (srcs[f] ??= readFileSync(join(ROOT, f), "utf8"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const jf = join(dir, "m.json")
      const f = m.file ?? F
      writeFileSync(jf, JSON.stringify({ [f]: [editFor(srcOf(f), m.find, m.text, f)] }))
      const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env: { ...process.env, GATE_MUTATE_FILE: jf }, encoding: "utf8", maxBuffer: 1 << 28 })
      const line = (r.stdout || "").split("\n").find((l) => l.startsWith("ROWS_JSON "))
      if (!line) note = `child did not finish (exit ${r.status}): ${(r.stderr || "").trim().split("\n").slice(-1)[0]}`
      else {
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
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(14)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
const unguarded = rows.filter((r) => r.id !== "RUN" && !MUTANTS.some((m) => m.red.includes(r.id))).map((r) => r.id)
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && caught === muts.length && unguarded.length === 0 ? 0 : 1)
