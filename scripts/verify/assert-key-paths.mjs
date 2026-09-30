/* ============================================================================
 * assert-key-paths.mjs: K1, keyframe anything (docs/rulings/2026-09-26.md,
 * docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md section 4).
 *
 *   node scripts/verify/assert-key-paths.mjs              rows, then every mutant
 *   node scripts/verify/assert-key-paths.mjs --rows-only  rows only (a mutant child runs this)
 *
 * Node only, through scripts/verify/_ts-load.mjs. Mutants go through
 * GATE_MUTATE_FILE, so nothing on disk changes. Exits 0 only when every row
 * passes, every mutant turns its rows red, and every row has a mutant.
 *
 * CORPUS. The rows read lib/keyframes.ts, the STYLE_RANGES table and
 * DEFAULT_STYLE_STATE in lib/style-system.ts, the sliders in
 * components/style-panel-scaffold.tsx, and main's lib/keyframes.ts at
 * 747af8fa0 for EXISTING. They do NOT see the viewport: nothing here proves a
 * keyed value reaches the frame. That wiring is K2, and so is lib/doc-store.ts
 * calling acceptKeys on load and save.
 * ========================================================================== */
import { spawnSync, execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")
const MAIN = "747af8fa0"

const rows = []
const row = (id, ok, what, detail) => rows.push({ id, ok: !!ok, what, detail })
function check(id, what, fn) {
  try {
    fn()
  } catch (e) {
    row(id, false, what, `threw: ${e && e.message}`)
  }
}
function thrown(fn) {
  try {
    fn()
    return null
  } catch (e) {
    return String(e && e.message)
  }
}
/** 64 times across [a, b], off the key times so a sampler's span choice matters. */
const times64 = (a, b) => Array.from({ length: 64 }, (_, i) => a + ((b - a) * (i + 0.37)) / 64)

/** Every leaf of an object, walked here and not by the code under test. */
function leaves(o, prefix = "", out = []) {
  for (const [k, v] of Object.entries(o)) {
    const p = prefix + k
    if (v !== null && typeof v === "object" && !Array.isArray(v)) leaves(v, p + ".", out)
    else out.push([p, v])
  }
  return out
}
const readLeaf = (o, path) => path.split(".").reduce((x, k) => x[k], o)

async function runRows() {
  const K = loadTs("lib/keyframes.ts")
  const S = loadTs("lib/style-system.ts")
  const base = S.DEFAULT_STYLE_STATE
  const ranges = new Map(K.KEYABLE_PATHS.map((p) => [p.path, p]))

  /* ---- PATHS: every numeric leaf is keyable, with a range -------------- */
  check("PATHS", "every numeric style field is in KEYABLE_PATHS with a range", () => {
    // Positive control: the walker sees a number two levels down.
    const control = leaves({ a: { b: { c: 1 } }, d: "x" }).some(([p, v]) => p === "a.b.c" && v === 1)
    const all = leaves(base)
    const numeric = all.filter(([, v]) => typeof v === "number").map(([p]) => p)
    const missing = numeric.filter((p) => !ranges.has(p))
    const badRange = K.KEYABLE_PATHS.filter((r) => !(Number.isFinite(r.min) && Number.isFinite(r.max) && r.min < r.max && r.step > 0))
    const outside = numeric.filter((p) => ranges.has(p) && (readLeaf(base, p) < ranges.get(p).min || readLeaf(base, p) > ranges.get(p).max))
    const extra = K.KEYABLE_PATHS.filter((r) => !numeric.includes(r.path)).map((r) => r.path)
    const leftNumeric = K.STYLE_LEFT_OUT.filter((l) => numeric.includes(l.path) || !all.some(([p]) => p === l.path))
    const nonNumeric = all.filter(([, v]) => typeof v !== "number").length
    const leftCount = K.STYLE_LEFT_OUT.length
    const shown = K.STYLE_LEFT_OUT.map((l) => `${l.path} (${l.reason})`)
    const ok = control && missing.length === 0 && badRange.length === 0 && outside.length === 0 && extra.length === 0 &&
      leftNumeric.length === 0 && leftCount === nonNumeric && K.KEYABLE_PATHS.length === numeric.length
    row("PATHS", ok, "every numeric style field is in KEYABLE_PATHS with a range",
      `${K.KEYABLE_PATHS.length} keyable of ${numeric.length} numeric leaves (${all.length} leaves in all); walker control ${control ? "sees" : "CANNOT SEE"} a nested number; ` +
      `missing ${missing.join(", ") || "none"}; bad ranges ${badRange.map((r) => r.path).join(", ") || "none"}; defaults outside their range ${outside.join(", ") || "none"}; ` +
      `keyable but not a number ${extra.join(", ") || "none"}; left out ${leftCount} of ${nonNumeric} non-numeric: ${shown.join("; ")}`)
  })

  /* ---- SLIDERS: the table and the sliders say the same numbers ---------- */
  check("SLIDERS", "every range equals the min, max and step of the slider that sets it", () => {
    const lines = readFileSync(join(ROOT, "components/style-panel-scaffold.tsx"), "utf8").split("\n")
    const num = (s) => (s === undefined ? NaN : Number(s))
    const boundsNear = (i, before, after) => {
      const win = lines.slice(Math.max(0, i - before), i + after).join("\n")
      const m = (k) => num((win.match(new RegExp(`${k}=\\{([\\d.]+)\\}`)) || [])[1])
      return { min: m("min"), max: m("max"), step: m("step") }
    }
    const lineOf = (re) => lines.findIndex((l) => re.test(l))
    const delayAt = lineOf(/value=\{delay\}/)
    const rowAt = lineOf(/const row = \(/)
    const found = []
    const bad = []
    for (const r of K.KEYABLE_PATHS) {
      let b = null
      const leaf = r.path.split(".").pop()
      if (r.path.startsWith("customMaterial.")) {
        const m = lines.join("\n").match(new RegExp(`\\["[^"]*", "${leaf}", ([\\d.]+), ([\\d.]+), ([\\d.]+)\\]`))
        if (m) b = { min: num(m[1]), max: num(m[2]), step: num(m[3]), via: "material table" }
      } else if (lineOf(new RegExp(`delay=\\{styleState\\.${leaf}\\}`)) >= 0 && delayAt >= 0) {
        b = { ...boundsNear(delayAt, 6, 1), via: "delay control" }
      } else if (lineOf(new RegExp(`^\\s*styleState\\.${leaf},\\s*$`)) >= 0 && rowAt >= 0) {
        b = { ...boundsNear(rowAt, 0, 40), via: "stack row" }
      } else if (lineOf(new RegExp(`value=\\{Math\\.abs\\(styleState\\.${leaf}\\)\\}`)) >= 0) {
        // A signed value behind a size slider: the stored value runs -max..max.
        const s = boundsNear(lineOf(new RegExp(`value=\\{Math\\.abs\\(styleState\\.${leaf}\\)\\}`)), 6, 1)
        b = { min: -s.max, max: s.max, step: s.step, via: `size slider ${s.min}..${s.max}, signed` }
      } else {
        const at = lineOf(new RegExp(`value=\\{styleState\\.${leaf}\\}`))
        if (at >= 0) b = { ...boundsNear(at, 6, 1), via: "own slider" }
      }
      if (!b || [b.min, b.max, b.step].some((x) => !Number.isFinite(x))) {
        bad.push(`${r.path}: no slider found`)
        continue
      }
      found.push(r.path)
      if (b.min !== r.min || b.max !== r.max || b.step !== r.step) bad.push(`${r.path}: slider ${b.min}..${b.max} step ${b.step} (${b.via}), table ${r.min}..${r.max} step ${r.step}`)
    }
    row("SLIDERS", bad.length === 0 && found.length === K.KEYABLE_PATHS.length && K.KEYABLE_PATHS.length > 0, "every range equals the min, max and step of the slider that sets it",
      `${found.length} of ${K.KEYABLE_PATHS.length} paths found a slider; disagreements: ${bad.join("; ") || "none"}`)
  })

  /* ---- SAMPLE: a keyed path samples exactly as sampleTrack does ---------- */
  check("SAMPLE", "a keyed style path samples exactly as the key sampler does, at 64 times", () => {
    const speed = [
      { tMs: 200, value: 0.4, easeOut: K.EASY_EASE_OUT, easeIn: K.EASY_EASE_IN },
      { tMs: 900, value: 2.6, easeOut: "linear", easeIn: { x: 0.8, y: 0.9 } },
      { tMs: 1600, value: 1.1, easeOut: "hold", easeIn: "linear" },
      { tMs: 2200, value: 2.9, easeOut: K.EASY_EASE_OUT, easeIn: K.EASY_EASE_IN },
    ]
    const rough = [K.makeKey(0, 0.1), K.makeKey(1500, 0.9)]
    const keys = { textureSpeed: speed, "customMaterial.roughness": rough, turn: [K.makeKey(0, 0), K.makeKey(1000, 90)] }
    const before = JSON.stringify(base)
    const accepted = K.acceptKeys(keys)
    let same = 0
    let rest = 0
    const misses = []
    const ts = times64(-100, 2400)
    for (const t of ts) {
      for (const [label, k] of [["raw", keys], ["accepted", accepted]]) {
        const s = K.styleAt(base, k, t)
        const a = s.textureSpeed
        const b = s.customMaterial.roughness
        const ok = Object.is(a, K.sampleTrack(speed, t, "textureSpeed")) && Object.is(b, K.sampleTrack(rough, t, "customMaterial.roughness"))
        if (ok) same++
        else if (misses.length < 3) misses.push(`${label} t=${t.toFixed(2)}: ${a} / ${b}`)
        const strip = (o) => JSON.stringify({ ...o, textureSpeed: 0, customMaterial: { ...o.customMaterial, roughness: 0 } })
        if (strip(s) === strip(base) && s.customMaterial !== base.customMaterial) rest++
      }
    }
    const untouched = JSON.stringify(base) === before
    const n = ts.length * 2
    row("SAMPLE", same === n && rest === n && untouched, "a keyed style path samples exactly as the key sampler does, at 64 times",
      `${same} of ${n} samples identical to sampleTrack (raw and accepted keys); every other value unchanged in ${rest} of ${n}; base ${untouched ? "not written" : "WRITTEN"}; ${misses.join("; ") || "no misses"}`)
  })

  /* ---- UNKEYED: no style keys hands back the state itself ---------------- */
  check("UNKEYED", "styleAt with no style keys returns the state byte-identical", () => {
    const other = { ...base, textureSpeed: 1.7, customMaterial: { ...base.customMaterial, sheen: 0.3 } }
    const cases = [
      ["no keys", undefined],
      ["empty field", {}],
      ["only the seven take tracks", { drawProgress: [K.makeKey(0, 0), K.makeKey(1000, 1)], width: [K.makeKey(0, 1)] }],
      ["an empty style track", { textureSpeed: [] }],
    ]
    let ident = 0
    let bytes = 0
    const ts = times64(-50, 3000)
    for (const st of [base, other]) {
      const json = JSON.stringify(st)
      for (const [, k] of cases) {
        for (const t of ts) {
          const s = K.styleAt(st, k, t)
          if (s === st) ident++
          if (JSON.stringify(s) === json) bytes++
        }
      }
    }
    const n = 2 * cases.length * ts.length
    row("UNKEYED", ident === n && bytes === n, "styleAt with no style keys returns the state byte-identical",
      `same object ${ident} of ${n}, byte-identical ${bytes} of ${n} (2 states, ${cases.length} cases: ${cases.map((c) => c[0]).join(", ")}, 64 times)`)
  })

  /* ---- RANGE: out-of-range keys are refused, never clamped --------------- */
  check("RANGE", "an out-of-range key is refused with its reason on 10 paths", () => {
    const all = K.KEYABLE_PATHS
    const pick = Array.from({ length: 10 }, (_, i) => all[Math.floor((i * all.length) / 10)])
    const out = []
    let refused = 0
    let control = 0
    for (const r of pick) {
      for (const v of [r.max + r.step, r.min - r.step]) {
        const k = { [r.path]: [K.makeKey(0, (r.min + r.max) / 2), K.makeKey(500, v)] }
        const reasons = K.validateKeys(k)
        const named = reasons.some((x) => x.startsWith(`${r.path}: key 1 ${r.path} ${v} is outside ${r.min}..${r.max}`))
        const a = thrown(() => K.acceptKeys(k))
        const s = thrown(() => K.styleAt(base, k, 250))
        if (named && a && s) refused++
        else out.push(`${r.path} ${v}: reasons ${JSON.stringify(reasons)}, accept ${a ? "threw" : "ACCEPTED"}, styleAt ${s ? "threw" : "SAMPLED"}`)
      }
      // Positive control: a key exactly at each end is fine and samples exactly.
      const edge = { [r.path]: [K.makeKey(0, r.min), K.makeKey(500, r.max)] }
      const acc = thrown(() => K.acceptKeys(edge)) === null
      if (acc && K.validateKeys(edge).length === 0 && readLeaf(K.styleAt(base, edge, 0), r.path) === r.min && readLeaf(K.styleAt(base, edge, 500), r.path) === r.max) control++
      else out.push(`${r.path}: in-range ends refused or moved`)
    }
    // The curve between two in-range keys may not swing out either.
    const swing = { textureIntensity: [{ tMs: 0, value: 0, easeOut: { x: 0.3, y: 1.4 }, easeIn: "linear" }, { tMs: 500, value: 1, easeOut: "linear", easeIn: { x: 0.7, y: 1.3 } }] }
    const swingHit = K.validateKeys(swing).some((x) => x.includes("swings to") && x.includes("outside 0..1"))
    const inside = { textureIntensity: [{ tMs: 0, value: 0.2, easeOut: { x: 0.3, y: 1.2 }, easeIn: "linear" }, { tMs: 500, value: 0.7, easeOut: "linear", easeIn: "linear" }] }
    const insideOk = K.validateKeys(inside).length === 0
    const colour = K.validateKeys({ "customMaterial.color": [K.makeKey(0, 1)] }).some((x) => x.startsWith("customMaterial.color: not a keyable property"))
    row("RANGE", refused === 20 && control === 10 && swingHit && insideOk && colour, "an out-of-range key is refused with its reason on 10 paths",
      `${refused} of 20 out-of-range keys refused by validateKeys, acceptKeys and styleAt, on ${pick.map((p) => p.path).join(", ")}; ` +
      `${control} of 10 in-range ends accepted and sampled exactly; a curve swinging past 1 ${swingHit ? "refused" : "ACCEPTED"}; a swing that stays inside ${insideOk ? "accepted" : "REFUSED"}; ` +
      `a colour ${colour ? "refused as not keyable" : "NOT REFUSED"}; ${out.slice(0, 3).join("; ") || "no misses"}`)
  })

  /* ---- EXISTING: the seven tracks sample as main does -------------------- */
  check("EXISTING", "the seven take tracks sample identically to main at 64 times", () => {
    const dir = mkdtempSync(join(tmpdir(), "fs-key-paths-main-"))
    const f = join(dir, "keyframes-main.ts")
    writeFileSync(f, execFileSync("git", ["-C", ROOT, "show", `${MAIN}:lib/keyframes.ts`], { encoding: "utf8" }))
    const M = loadTs(f)
    rmSync(dir, { recursive: true, force: true })
    const keys = {
      drawProgress: [K.makeKey(0, 0), { tMs: 700, value: 0.4, easeOut: "hold", easeIn: "linear" }, K.makeKey(1400, 0.4), K.makeKey(2200, 1)],
      depth: [K.makeKey(100, 0), { tMs: 1200, value: 1.5, easeOut: { x: 0.2, y: 1.3 }, easeIn: { x: 0.6, y: -0.2 } }, K.makeKey(2400, 0.2)],
      turn: [{ tMs: 0, value: -30, easeOut: "linear", easeIn: "linear" }, { tMs: 2000, value: 45, easeOut: "linear", easeIn: "linear" }],
      azimuth: [K.makeKey(300, 10), K.makeKey(1800, 170)],
      elevation: [K.makeKey(0, 5), K.makeKey(900, 40), K.makeKey(2500, 12)],
      distance: [K.makeKey(0, 1.2), K.makeKey(2600, 0.8)],
      width: [K.makeKey(0, 0.5), { tMs: 1000, value: 2, easeOut: "hold", easeIn: K.EASY_EASE_IN }, K.makeKey(2000, 1)],
    }
    const accepted = K.acceptKeys(keys)
    let same = 0
    let n = 0
    const misses = []
    for (const t of times64(-200, 2900)) {
      const want = M.sampleKeys(keys, t)
      for (const [label, k] of [["raw", keys], ["accepted", accepted]]) {
        const got = K.sampleKeys(k, t)
        for (const p of M.KEY_PROPERTIES) {
          n++
          if (Object.is(got[p], want[p]) && Object.is(K.sampleTrack(k[p], t, p), M.sampleTrack(keys[p], t, p))) same++
          else if (misses.length < 3) misses.push(`${label} ${p} t=${t.toFixed(2)}: ${got[p]} vs ${want[p]}`)
        }
        n++
        if (Object.is(K.revealClockMs(k, t, 1800), M.revealClockMs(keys, t, 1800))) same++
        else misses.push(`${label} reveal t=${t}`)
      }
    }
    const endSame = K.keysEndMs(keys) === M.keysEndMs(keys) && K.keysEndMs(accepted) === M.keysEndMs(keys)
    const props = JSON.stringify(K.KEY_PROPERTIES) === JSON.stringify(M.KEY_PROPERTIES)
    row("EXISTING", same === n && endSame && props, "the seven take tracks sample identically to main at 64 times",
      `${same} of ${n} samples identical to main ${MAIN} (seven tracks and the reveal clock, raw and accepted keys); keysEndMs ${endSame ? "same" : "DIFFERS"}; the seven names ${props ? "unchanged" : "CHANGED"}; ${misses.join("; ") || "no misses"}`)
  })

  /* ---- PHASE: a keyed speed never jumps the loop ------------------------- */
  check("PHASE", "a keyed speed ramp gives a phase with no jump at any frame; speed times time jumps", () => {
    const track = [
      { tMs: 0, value: 0.5, easeOut: K.EASY_EASE_OUT, easeIn: K.EASY_EASE_IN },
      { tMs: 1000, value: 3, easeOut: "linear", easeIn: K.EASY_EASE_IN },
      { tMs: 1500, value: 1, easeOut: "hold", easeIn: "linear" },
      { tMs: 2500, value: 2.5, easeOut: K.EASY_EASE_OUT, easeIn: "linear" },
      { tMs: 3500, value: 0.2, easeOut: "linear", easeIn: K.EASY_EASE_IN },
    ]
    const keys = K.acceptKeys({ textureSpeed: track })
    const speedAt = (t) => K.sampleTrack(track, t, "textureSpeed")
    const frames = []
    for (let t = 0; t <= 4000; t += 1000 / 60) frames.push(t)
    for (const k of track) frames.push(k.tMs - 1e-3, k.tMs, k.tMs + 1e-3)
    frames.sort((a, b) => a - b)
    const bound = (a, b) => {
      let top = 0
      for (let j = 0; j <= 32; j++) top = Math.max(top, speedAt(a + ((b - a) * j) / 32))
      return (top * (b - a)) / 1000 + 1e-9
    }
    let worst = 0
    let naiveWorst = 0
    let jumps = 0
    let naiveJumps = 0
    for (let i = 1; i < frames.length; i++) {
      const [a, b] = [frames[i - 1], frames[i]]
      if (b - a <= 0) continue
      const lim = bound(a, b) * (1 + 1e-6)
      const d = Math.abs(K.loopPhaseAt(base, keys, "textureSpeed", b) - K.loopPhaseAt(base, keys, "textureSpeed", a))
      const dn = Math.abs(speedAt(b) * b - speedAt(a) * a) / 1000
      worst = Math.max(worst, d / lim)
      naiveWorst = Math.max(naiveWorst, dn / lim)
      if (d > lim) jumps++
      if (dn > lim) naiveJumps++
    }
    // The sum is right, not only smooth: a linear ramp integrates exactly.
    const ramp = K.acceptKeys({ ditherSpeed: [{ tMs: 0, value: 1, easeOut: "linear", easeIn: "linear" }, { tMs: 2000, value: 3, easeOut: "linear", easeIn: "linear" }] })
    const rampErr = Math.abs(K.loopPhaseAt(base, ramp, "ditherSpeed", 3000) - (4 + 3)) // 2 s averaging 2x, then 1 s at 3x
    // Unkeyed is today's speed times time, exactly.
    const flat = [0, 777, 4000].every((t) => K.loopPhaseAt(base, undefined, "textureSpeed", t) === (base.textureSpeed * t) / 1000)
    row("PHASE", jumps === 0 && naiveJumps > 0 && rampErr < 1e-9 && flat && K.LOOP_SPEED_PATHS.length > 0,
      "a keyed speed ramp gives a phase with no jump at any frame; speed times time jumps",
      `running sum: ${jumps} jumps in ${frames.length - 1} frames (worst step ${worst.toFixed(4)} of the speed bound); must-fail, speed times time: ${naiveJumps} jumps (worst ${naiveWorst.toFixed(2)}x the bound); ` +
      `linear ramp off by ${rampErr.toExponential(1)}; unkeyed ${flat ? "equals" : "DIFFERS FROM"} speed times time; loop speeds: ${K.LOOP_SPEED_PATHS.join(", ")}`)
  })
}

/* ---- the must-fails ----------------------------------------------------- */
const KF = "lib/keyframes.ts"
const SS = "lib/style-system.ts"
const MUTANTS = [
  { name: "the walk skips nested objects", file: KF, find: 'else if (v !== null && typeof v === "object") walk(v, path + ".")', text: 'else if (v !== null && typeof v === "object") void 0', red: ["PATHS"] },
  { name: "a range row drifts from its slider", file: SS, find: "textureScale: { min: 0.2, max: 4, step: 0.05 },", text: "textureScale: { min: 0.2, max: 5, step: 0.05 },", red: ["SLIDERS"] },
  { name: "styleAt samples a millisecond late", file: KF, find: "into[parts[parts.length - 1]] = valueAt(track, clockMs)", text: "into[parts[parts.length - 1]] = valueAt(track, clockMs + 1)", red: ["SAMPLE"] },
  { name: "styleAt copies the state when nothing is keyed", file: KF, find: "return (out as StyleState | null) ?? state", text: "return (out as StyleState | null) ?? { ...state }", red: ["UNKEYED"] },
  { name: "out-of-range style keys accepted", file: KF, find: "} else if (range && (k.value < range.min || k.value > range.max)) {", text: "} else if (false) {", red: ["RANGE"] },
  { name: "a curve swinging out of range accepted", file: KF, find: "if (range && out.length === 0) out.push(...reachReasons(", text: "if (false) out.push(...reachReasons(", red: ["RANGE"] },
  { name: "sampleKeys reads a rounded clock", file: KF, find: "for (const p of KEY_PROPERTIES) out[p] = keys?.[p] ? valueAt(keys[p]!, clockMs) : undefined", text: "for (const p of KEY_PROPERTIES) out[p] = keys?.[p] ? valueAt(keys[p]!, Math.round(clockMs)) : undefined", red: ["EXISTING"] },
  { name: "phase is speed times time", file: KF, find: "return (F(clockMs) - F(0)) / 1000", text: "return (valueAt(track, clockMs)! * clockMs) / 1000", red: ["PHASE"] },
]

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-key-paths-mut-"))
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
