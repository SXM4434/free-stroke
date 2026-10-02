/* ============================================================================
 * assert-transport-math.mjs: lib/take-transport.ts, in Node, against the
 * inline code it replaced (layout rethink phase L2).
 *
 *   node scripts/verify/assert-transport-math.mjs              rows, then every mutant
 *   node scripts/verify/assert-transport-math.mjs --rows-only  rows only (a mutant child runs this)
 *
 * Node only, through scripts/verify/_ts-load.mjs. Mutants go through
 * GATE_MUTATE_FILE, so nothing on disk changes. Exits 0 only when every row
 * passes, every mutant turns its rows red, and every row has a mutant.
 *
 * THE REFERENCE. "L2 step 4" (6b24ba5 on cloud/layout-l2) took four values out
 * of components/viewport-3d.tsx and into this module. The lines it removed are
 * copied below as OLD, verbatim but for the types:
 *
 *   const revealMode: RevealMode = modeOverride ?? revealEnvelope.mode
 *   const takeLen = takeMs ?? penMs
 *   const totalDuration = Math.max(takeLen, keysEndMs(keys))
 *   () => effectiveWindow(revealWindow, { loop: revealLoop, delaySeconds: revealDelaySeconds })
 *   export function unEaseReveal(p, ease) { ...bisection, 30 steps... }
 *
 * effectiveWindow is the one function both sides call, so the SEAM row also
 * holds it to the rule its comment states (travel, looping, no delay, and
 * nothing else, is seamless) written out here, not imported.
 *
 * CORPUS. The rows see the module's pure functions and its store with no
 * React render. They do NOT see the viewport publish, the frame loop, or a
 * panel's useSyncExternalStore: that is assert-take-transport.mjs, in a browser.
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

async function runRows() {
  const T = loadTs("lib/take-transport.ts")
  const S = loadTs("lib/stroke-schedule.ts")
  const { easeReveal } = loadTs("lib/stroke-timing.ts")

  /* ---- OLD: the inline code L2 step 4 removed ------------------------------ */
  const OLD = {
    revealMode: (modeOverride, revealEnvelope) => modeOverride ?? revealEnvelope.mode,
    lengths: (takeMs, penMs, keysEnd) => {
      const takeLen = takeMs ?? penMs
      const totalDuration = Math.max(takeLen, keysEnd)
      return { takeLen, totalDuration }
    },
    seam: (revealWindow, revealLoop, revealDelaySeconds) =>
      S.effectiveWindow(revealWindow, { loop: revealLoop, delaySeconds: revealDelaySeconds }),
    unEaseReveal(p, ease) {
      if (p <= 0) return 0
      if (p >= 1) return 1
      if (ease === "linear") return p
      let lo = 0
      let hi = 1
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2
        if (easeReveal(mid, ease) < p) lo = mid
        else hi = mid
      }
      return (lo + hi) / 2
    },
  }

  /* ---- MODE: revealModeOf is `modeOverride ?? envelope.mode` -------------- */
  check("MODE", "revealModeOf equals the old inline `??` for every override and pace", () => {
    let n = 0
    const misses = []
    for (const over of [null, undefined, "raw", "smooth", "hybrid"]) {
      for (const pace of ["raw", "hybrid", "smooth"]) {
        const env = { ...S.REVEAL_ENVELOPE_DEFAULTS, mode: pace }
        n++
        const got = T.revealModeOf(over, env)
        const want = OLD.revealMode(over, env)
        if (got !== want) misses.push(`override ${over}, pace ${pace}: ${got} vs ${want}`)
      }
    }
    // Positive control: the override wins when it is set.
    const control = T.revealModeOf("smooth", { ...S.REVEAL_ENVELOPE_DEFAULTS, mode: "raw" }) === "smooth"
    row("MODE", misses.length === 0 && control, "revealModeOf equals the old inline `??` for every override and pace",
      `${n - misses.length} of ${n} pairs equal; override wins: ${control}; ${misses.join("; ") || "no misses"}`)
  })

  /* ---- LENGTHS: takeLen and totalDuration, edge values included ----------- */
  check("LENGTHS", "transportLengths equals the old takeLen and totalDuration, 0, NaN and Infinity included", () => {
    const takes = [null, undefined, 0, -0, 1, 1800, 4666.7, 1e9, Infinity, NaN]
    const pens = [0, 1, 1800, 5024.9, Infinity, NaN]
    const ends = [0, 1, 1799.999, 1800, 1800.001, 9000, Infinity, NaN]
    let n = 0
    const misses = []
    for (const t of takes)
      for (const p of pens)
        for (const k of ends) {
          n++
          const got = T.transportLengths(t, p, k)
          const want = OLD.lengths(t, p, k)
          const keys = Object.keys(got).sort().join(",")
          if (keys !== "takeLen,totalDuration" || !Object.is(got.takeLen, want.takeLen) || !Object.is(got.totalDuration, want.totalDuration)) {
            if (misses.length < 4) misses.push(`take ${t}, pen ${p}, keys end ${k}: ${JSON.stringify(got)} vs ${JSON.stringify(want)}`)
            else misses.push("")
          }
        }
    // Two rows that read the `??`: a take of 0 ms is a take, not "no take".
    const zero = T.transportLengths(0, 1800, 0)
    const zeroOk = zero.takeLen === 0 && zero.totalDuration === 0
    // A key past the take stretches the transport and leaves takeLen alone.
    const past = T.transportLengths(1800, 2400, 3000)
    const pastOk = past.takeLen === 1800 && past.totalDuration === 3000
    row("LENGTHS", misses.length === 0 && zeroOk && pastOk, "transportLengths equals the old takeLen and totalDuration, 0, NaN and Infinity included",
      `${n - misses.length} of ${n} triples equal under Object.is; take 0 stays 0 (not the pen's 1800): ${zeroOk}; key at 3000 past a 1800 take: total ${past.totalDuration}, takeLen ${past.takeLen}; ${misses.filter(Boolean).join("; ") || "no misses"}`)
  })

  /* ---- SEAM: seamWindowOf, against the old call and the rule itself ------- */
  check("SEAM", "seamWindowOf equals the old effectiveWindow call and the stated rule, identity kept when not seamless", () => {
    const windows = [
      { mode: "grow", length: 0.3 },
      { mode: "travel", length: 0.3 },
      { mode: "travel", length: 1 },
      { mode: "travel", length: 0.3, seamless: false },
      { mode: "vanish", length: 0.3 },
      { mode: "shrink", length: 0.5 },
      S.REVEAL_WINDOW_DEFAULTS,
    ]
    const delays = [0, -0, -1, 1e-9, 0.5, 2, NaN, undefined]
    let n = 0
    let seamless = 0
    const misses = []
    for (const w of windows)
      for (const loop of [false, true])
        for (const d of delays) {
          n++
          const got = T.seamWindowOf(w, { loop, delaySeconds: d })
          const old = OLD.seam(w, loop, d)
          // The rule, written out: travel, looping, and no positive delay.
          const should = w.mode === "travel" && loop && !(d > 0)
          const ruleOk = should ? got !== w && got.seamless === true && got.mode === w.mode && got.length === w.length : got === w
          const sameAsOld = JSON.stringify(got) === JSON.stringify(old) && (got === w) === (old === w)
          if (should) seamless++
          if (!ruleOk || !sameAsOld) misses.push(`${JSON.stringify(w)} loop ${loop} delay ${d}: ${JSON.stringify(got)} (old ${JSON.stringify(old)})`)
        }
    // seamWindowOf must not write into the window it was given.
    const w0 = { mode: "travel", length: 0.3 }
    T.seamWindowOf(w0, { loop: true, delaySeconds: 0 })
    const untouched = !("seamless" in w0)
    // Extra envelope fields are not read: only loop and delaySeconds decide.
    const full = T.seamWindowOf(w0, { ...S.REVEAL_ENVELOPE_DEFAULTS, loop: true, delaySeconds: 0, ease: "inOut", rate: 3 })
    row("SEAM", misses.length === 0 && untouched && full.seamless === true && seamless > 0,
      "seamWindowOf equals the old effectiveWindow call and the stated rule, identity kept when not seamless",
      `${n - misses.length} of ${n} cases equal the old call and the rule (${seamless} seamless); input untouched: ${untouched}; ${misses.slice(0, 4).join("; ") || "no misses"}`)
  })

  /* ---- UNEASE: the inverse, bit-equal to the old one, exact at the ends --- */
  check("UNEASE", "unEaseReveal is bit-equal to the old bisection, inverts easeReveal, and is exact at 0 and 1", () => {
    const eases = ["linear", "in", "out", "inOut", { x1: 0.42, y1: 0, x2: 0.58, y2: 1 }, { x1: 0.3, y1: -0.4, x2: 0.7, y2: 1.4 }, { x1: 0, y1: 0, x2: 1, y2: 1 }]
    const ps = [-1, -1e-12, 0, -0, 1e-9, 0.001, 0.1, 0.25, 0.5, 0.5 + 1e-12, 0.75, 0.9, 0.999, 1 - 1e-12, 1, 1 + 1e-12, 2]
    for (let i = 0; i < 64; i++) ps.push((i + 0.37) / 64)
    let n = 0
    let worst = 0
    const misses = []
    for (const e of eases)
      for (const p of ps) {
        n++
        const got = T.unEaseReveal(p, e)
        const want = OLD.unEaseReveal(p, e)
        if (!Object.is(got, want)) misses.push(`${JSON.stringify(e)} p ${p}: ${got} vs ${want}`)
        // Round trip, inside (0, 1): easeReveal(unEaseReveal(p)) is p to the bisection's step.
        if (p > 0 && p < 1) {
          const back = easeReveal(got, e)
          worst = Math.max(worst, Math.abs(back - p))
        }
      }
    // The ends are exact, under every ease: the playback loop tests `clock >= 1`.
    const ends = eases.every((e) => T.unEaseReveal(1, e) === 1 && T.unEaseReveal(0, e) === 0 && T.unEaseReveal(1.5, e) === 1 && T.unEaseReveal(-0.5, e) === 0)
    // Monotone: a later p never maps to an earlier clock.
    let mono = true
    for (const e of eases) {
      let prev = -1
      for (let i = 0; i <= 512; i++) {
        const c = T.unEaseReveal(i / 512, e)
        if (c < prev) mono = false
        prev = c
      }
    }
    // The bisection's step is 2^-30 in the clock; a steep ease turns that into
    // more in p, so the bound is the step times the steepest slope (3 for these).
    const bound = 3 * 2 ** -30 * 2
    row("UNEASE", misses.length === 0 && ends && mono && worst <= bound,
      "unEaseReveal is bit-equal to the old bisection, inverts easeReveal, and is exact at 0 and 1",
      `${n - misses.length} of ${n} (ease, p) pairs bit-equal to the old code; round trip worst ${worst.toExponential(2)} (bound ${bound.toExponential(2)}); ends exact: ${ends}; monotone over 513 steps: ${mono}; ${misses.slice(0, 3).join("; ") || "no misses"}`)
  })

  /* ---- STORE: the slots behave as a useState each, one notify list per slot */
  check("STORE", "each slot sets, dedups under Object.is, takes an updater, and notifies only its own subscribers", () => {
    const s = T.createTakeTransport()
    const fired = {}
    for (const k of Object.keys(T.TRANSPORT_DEFAULTS)) s.subscribe(k, () => (fired[k] = (fired[k] || 0) + 1))
    const defaultsOk = Object.keys(T.TRANSPORT_DEFAULTS).every((k) => Object.is(s.get(k), T.TRANSPORT_DEFAULTS[k]))
    const frozen = Object.isFrozen(T.TRANSPORT_DEFAULTS) && Object.isFrozen(s.setters)
    s.set("playing", true)
    s.set("playing", true) // same value, no notify
    s.setters.speed((v) => v * 2) // updater form, through the stable setter
    s.set("speed", 2) // same value after the updater, no notify
    s.set("hybridBlend", NaN)
    s.set("hybridBlend", NaN) // Object.is(NaN, NaN): no notify
    s.set("speed", -0) // Object.is(2, -0) false: notify
    s.set("speed", 0) // Object.is(-0, 0) false: notify, as useState would
    const want = { playing: 1, speed: 3, hybridBlend: 1 }
    const firedOk = Object.keys(T.TRANSPORT_DEFAULTS).every((k) => (fired[k] || 0) === (want[k] || 0))
    const firedSeen = JSON.stringify(fired)
    const values = s.get("playing") === true && Object.is(s.get("speed"), 0) && Number.isNaN(s.get("hybridBlend"))
    // Unsubscribe stops the calls; the setter is the same function every read.
    let late = 0
    const off = s.subscribe("drawInOpen", () => late++)
    s.set("drawInOpen", true)
    off()
    s.set("drawInOpen", false)
    const unsubOk = late === 1 && s.setters.drawInOpen === s.setters.drawInOpen
    // Two stores share nothing.
    const s2 = T.createTakeTransport()
    const isolated = s2.get("playing") === false && s2.playheadRef !== s.playheadRef && s2.progress !== s.progress
    row("STORE", defaultsOk && frozen && firedOk && values && unsubOk && isolated,
      "each slot sets, dedups under Object.is, takes an updater, and notifies only its own subscribers",
      `defaults ${defaultsOk ? "read back" : "WRONG"}; frozen: ${frozen}; notifies ${firedSeen} (want ${JSON.stringify(want)}); values ${values ? "as set" : "WRONG"}; unsubscribe ${unsubOk ? "stops" : "FAILS"}; two stores isolated: ${isolated}`)
  })

  /* ---- DERIVED: a publish that changes nothing is dropped --------------- */
  check("DERIVED", "publishDerived notifies on a change of any field and drops a publish that changes nothing", () => {
    const s = T.createTakeTransport()
    let n = 0
    s.subscribeDerived(() => n++)
    const win = T.seamWindowOf({ mode: "travel", length: 0.3 }, { loop: false, delaySeconds: 0 })
    const d0 = { totalDuration: 1800, takeLen: 1800, revealEase: "linear", revealMode: "hybrid", seamWindow: win }
    const nullFirst = s.derived() === null
    s.publishDerived(d0)
    s.publishDerived({ ...d0 }) // equal fields: dropped
    const afterSame = n
    const changes = [
      { totalDuration: 2400 },
      { takeLen: 1200 },
      { revealEase: "inOut" },
      { revealMode: "raw" },
      { seamWindow: { ...win } }, // a new window object is a change: the viewport memoizes it
    ]
    let notified = 0
    for (const c of changes) {
      const before = n
      s.publishDerived({ ...d0, ...c })
      if (n === before + 1) notified++
      s.publishDerived(d0)
    }
    const latest = s.derived() === d0
    row("DERIVED", nullFirst && afterSame === 1 && notified === changes.length && latest,
      "publishDerived notifies on a change of any field and drops a publish that changes nothing",
      `null before the first publish: ${nullFirst}; an equal publish notified ${afterSame - 1} extra times; ${notified} of ${changes.length} one-field changes notified; latest read back: ${latest}`)
  })

  /* ---- RESET: resetSilently is the fresh store, and tells nobody -------- */
  check("RESET", "resetSilently puts every slot, ref, derived value and the readout back to a fresh store's, with no notify", () => {
    const s = T.createTakeTransport()
    let calls = 0
    for (const k of Object.keys(T.TRANSPORT_DEFAULTS)) s.subscribe(k, () => calls++)
    s.subscribeDerived(() => calls++)
    s.progress.subscribe(() => calls++)
    s.set("playing", true)
    s.set("speed", 0.25)
    s.set("exportName", "take")
    s.playheadRef.current = 0.7
    s.clockRef.current = 0.6
    s.openingRef.current = false
    s.progress.set(0.6)
    s.publishDerived({ totalDuration: 1, takeLen: 1, revealEase: "linear", revealMode: "raw", seamWindow: { mode: "grow", length: 0.3 } })
    const before = calls
    s.resetSilently()
    const fresh = T.createTakeTransport()
    const slots = Object.keys(T.TRANSPORT_DEFAULTS).every((k) => Object.is(s.get(k), fresh.get(k)))
    const refs = s.playheadRef.current === 0 && s.clockRef.current === 0 && s.openingRef.current === true
    const rest = s.derived() === null && s.progress.get() === 0
    // After the reset, a set to the default value is a no-op again, and a set off it notifies.
    const silent = calls === before
    s.set("playing", false)
    const noop = calls === before
    s.set("playing", true)
    const live = calls === before + 1
    row("RESET", slots && refs && rest && silent && noop && live,
      "resetSilently puts every slot, ref, derived value and the readout back to a fresh store's, with no notify",
      `slots ${slots ? "fresh" : "NOT FRESH"}; refs ${refs ? "fresh" : "NOT FRESH"}; derived null and readout 0: ${rest}; notifies during reset: ${calls - before - (live ? 1 : 0)}; set after reset dedups: ${noop}, notifies: ${live}`)
  })

  /* ---- PROGRESS: the readout store ---------------------------------------- */
  check("PROGRESS", "createProgressStore holds its initial, notifies on change only, and unsubscribes", () => {
    const p = T.createProgressStore(0.25)
    let n = 0
    const off = p.subscribe(() => n++)
    const init = p.get() === 0.25
    p.set(0.25)
    p.set(0.5)
    p.set(0.5)
    p.set(NaN)
    p.set(NaN)
    off()
    p.set(0.9)
    const noReset = !("reset" in p)
    row("PROGRESS", init && n === 2 && p.get() === 0.9 && noReset,
      "createProgressStore holds its initial, notifies on change only, and unsubscribes",
      `initial ${init ? "held" : "LOST"}; ${n} notifies for 0.25, 0.5, 0.5, NaN, NaN (want 2); after unsubscribe reads ${p.get()}; no reset on the public store: ${noReset}`)
  })
}

/* ---- the must-fails ----------------------------------------------------- */
const TT = "lib/take-transport.ts"
const MUTANTS = [
  { name: "the override loses to the document", file: TT, find: "return modeOverride ?? envelope.mode", text: "return envelope.mode ?? modeOverride", red: ["MODE"] },
  { name: "a 0 ms take reads as no take", file: TT, find: "const takeLen = takeMs ?? penMs", text: "const takeLen = takeMs || penMs", red: ["LENGTHS"] },
  { name: "keys no longer stretch the transport", file: TT, find: "totalDuration: Math.max(takeLen, keysEndMs) }", text: "totalDuration: takeLen }", red: ["LENGTHS"] },
  { name: "the seam ignores the delay", file: TT, find: "{ loop: envelope.loop, delaySeconds: envelope.delaySeconds }", text: "{ loop: envelope.loop, delaySeconds: 0 }", red: ["SEAM"] },
  { name: "the seam ignores the loop", file: TT, find: "{ loop: envelope.loop, delaySeconds: envelope.delaySeconds }", text: "{ loop: true, delaySeconds: envelope.delaySeconds }", red: ["SEAM"] },
  { name: "the top end comes back one ulp short", file: TT, find: "  if (p >= 1) return 1\n  if (ease", text: "  if (p > 1) return 1\n  if (ease", red: ["UNEASE"] },
  { name: "the bisection runs 20 steps", file: TT, find: "for (let i = 0; i < 30; i++)", text: "for (let i = 0; i < 20; i++)", red: ["UNEASE"] },
  { name: "a slot notifies on an equal value", file: TT, find: "    if (Object.is(next, prev)) return\n", text: "\n", red: ["STORE"] },
  { name: "a slot notifies every slot's subscribers", file: TT, find: "subs.get(key)?.forEach((fn) => fn())", text: "subs.forEach((s) => s.forEach((fn) => fn()))", red: ["STORE"] },
  { name: "a new seam window is not a change", file: TT, find: " &&\n        derived.seamWindow === d.seamWindow\n", text: "\n", red: ["DERIVED"] },
  { name: "the reset forgets the readout", file: TT, find: "      derived = null\n      resetProgress()\n", text: "      derived = null\n", red: ["RESET"] },
  { name: "the readout notifies on an equal value", file: TT, find: "        if (Object.is(v, value)) return\n", text: "\n", red: ["PROGRESS"] },
]

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-transport-math-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const src = readFileSync(join(ROOT, m.file), "utf8")
      const at = src.indexOf(m.find)
      if (at < 0 || src.indexOf(m.find, at + 1) >= 0) throw new Error(`mutant text not unique in ${m.file}`)
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [m.file]: [{ pos: at, end: at + m.find.length, text: m.text, was: m.find }] }))
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
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(9)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
const unguarded = rows.filter((r) => r.id !== "RUN" && !MUTANTS.some((m) => m.red.includes(r.id))).map((r) => r.id)
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && caught === muts.length && unguarded.length === 0 ? 0 : 1)
