#!/usr/bin/env node
/* assert-width-keys: F118 ANIM-3C-W2, the width track as each engine draws it.
 *
 *   node scripts/verify/assert-width-keys.mjs
 *
 * Node only, no browser. What it reads and what it does not:
 *   - the four engines through scripts/verify/lib/engine-node.mjs, the hero word at
 *     the bench's 120 reveal frames (solid-bench/hero-sig.mjs) and one horizontal
 *     straight line;
 *   - lib/width-keys.ts, the path a width key takes to an engine, and nothing of
 *     the viewport: Rod's cap and joint spheres, the "rebuild only when the width
 *     changed" rule and the GPU upload live in viewport-3d.tsx, which the UI lane
 *     wires. THROTTLE models that rule; it does not run it.
 *
 * Rows:
 *   SIGS         the gate's shipped Solid signatures equal
 *                `solid-bench/bench.mjs --input=hero --sigs=` 120 of 120, bench run
 *                as a clean child, so IDENTITY compares what the rig compares.
 *                Both sides build with today's engine, so SIGS catches the two paths
 *                disagreeing and cannot catch a geometry regression they share.
 *   IDENTITY-*   a width track held at 1 builds byte-identical geometry to the
 *                shipped build, 120 hero frames, one row per engine
 *   WIDEN-*      width 2 (Solid also 1.5, under its clamp) widens a horizontal
 *                line's Y extent by what the engine reached; Z held, Rod's Z times w
 *   INTERP       a key between two times interpolates, in the value and on the line
 *   THROTTLE     the rebuild throttle builds every key's value at its time and the
 *                last one at the end of the take, and still throttles. It models the
 *                calls to widthForFrame; a broken viewport rebuild or GPU upload
 *                leaves it green.
 *   RANGE        out-of-range width keys are refused with the reason, on every engine
 *
 * Each row is proved able to fail: MUTANTS below swap source text through
 * GATE_MUTATE_FILE (scripts/verify/_ts-load.mjs), nothing on disk changes, and
 * every mutant must turn the rows it names red. Exit 0 only when every row passes,
 * every mutant is caught and no row lacks a mutant.
 */
import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const SELF = fileURLToPath(import.meta.url)
const ROOT = fileURLToPath(new URL("../../", import.meta.url))
const ROWS_ONLY = process.argv.includes("--rows-only")
const FRAMES = 120

const E = await import(ROOT + "scripts/verify/lib/engine-node.mjs")
const { loadTs } = await import(ROOT + "scripts/verify/_ts-load.mjs")
const { heroPolys, sig, HS_GATED, heroProgress } = await import(ROOT + "scripts/verify/solid-bench/hero-sig.mjs")
const { SOLID_DEBUG } = loadTs("lib/geometry-engines.ts")
const pen = loadTs("lib/pen-reveal.ts")
const K = loadTs("lib/keyframes.ts")
const W = loadTs("lib/width-keys.ts")

const { CW, CH } = E
const MODES = ["rod", "inflate", "extrude", "solid"]
const ENGINE = { rod: E.RodEngine, inflate: E.InflateEngine, extrude: E.ExtrudeEngine, solid: E.SolidEngine }
const OPTS = {
  canvasWidth: CW, canvasHeight: CH,
  extrudeParams: E.DEFAULT_EXTRUDE_PARAMS, solidParams: E.DEFAULT_SOLID_PARAMS, inflateParams: E.DEFAULT_INFLATE_PARAMS,
  holeStabilization: HS_GATED,
}

const rows = []
const row = (id, ok, what, detail) => rows.push({ id, ok: !!ok, what, detail })
const realLog = console.log
const quiet = (f) => {
  console.log = () => {}
  try {
    return f()
  } finally {
    console.log = realLog
  }
}
const sigFor = (mode, meshes) => sig(meshes, mode === "solid" ? SOLID_DEBUG.lastStages?.solidDiagnostics ?? {} : null)

/** Build `mode` at width `w` the way the viewport will: Rod builds shipped and
 * moves every tube vertex along its normal, the other three rebuild with
 * previewParamsAtWidth's params. */
function buildAt(mode, strokes, w) {
  if (mode === "rod") {
    const meshes = ENGINE.rod.buildPreview(strokes, OPTS)
    const off = W.rodNormalOffset(w)
    for (const m of meshes) {
      if (!m.tubeGeometry) continue
      const pos = m.tubeGeometry.getAttribute("position").array
      W.widenAlongNormals(pos.slice(), m.tubeGeometry.getAttribute("normal").array, off, pos)
    }
    return { meshes, reached: w ?? 1, clamp: null }
  }
  const at = W.previewParamsAtWidth(mode, OPTS, w)
  return { meshes: ENGINE[mode].buildPreview(strokes, at.params), reached: at.reached, clamp: at.clamp }
}

/** X, Y, Z extent of every tube position. Rod's caps are not in the tube. */
function extent(meshes) {
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  let n = 0
  for (const m of meshes) {
    const a = m.tubeGeometry?.getAttribute("position")?.array
    if (!a) continue
    n += a.length / 3
    for (let i = 0; i < a.length; i += 3)
      for (let j = 0; j < 3; j++) {
        if (a[i + j] < lo[j]) lo[j] = a[i + j]
        if (a[i + j] > hi[j]) hi[j] = a[i + j]
      }
  }
  if (!n) throw new Error("extent: no tube positions, the measurement cannot see its subject")
  return hi.map((h, j) => h - lo[j])
}

/* How close a drawn Y extent must come to `reached`, per engine, and why:
 *   Rod, Extrude  exact: Rod is centre + r n, Extrude's Y extent is 2 x width (the
 *                 bevel is inset), both measured at 1.0000 of reached;
 *   Inflate 1 %   the field is sampled on a grid, measured 0.2 % short at w 2;
 *   Solid 4 %     the mark comes from a raster mask and its drawn width does not
 *                 scale exactly with computeSolidEffectiveThicknessPx: on this
 *                 animated path it measured 2.7 % short at w 1.5 (1.459x) and 1.6 %
 *                 short at the w 2 clamp (1.918x of 1.949x); 2.1 % at w 1.5 static.
 *                 The mapping lands the calibrated px exactly; the gap is the engine's. */
const Y_TOL = { rod: 1e-6, extrude: 1e-6, inflate: 0.01, solid: 0.04 }
const Z_TOL = { rod: 1e-6, extrude: 1e-6, inflate: 0.005, solid: 1e-6 }
const LINE = [Array.from({ length: 61 }, (_, i) => ({ x: CW * 0.2 + (CW * 0.6 * i) / 60, y: CH / 2 }))]
const held = (v) => ({ width: [K.makeKey(0, v), K.makeKey(2000, v)] })
const check = (id, what, f) => {
  try {
    f()
  } catch (e) {
    row(id, false, what, `threw: ${e && e.message}`)
  }
}

function runRows() {
  /* ---- SIGS and IDENTITY: the hero, the bench's frames --------------------- */
  const strokes = quiet(() => E.process(heroPolys(CW, CH)))
  const frames = Array.from({ length: FRAMES }, (_, i) => pen.filterStrokesByProgress(strokes, heroProgress(i + 1, FRAMES)))
  const shipped = {}
  for (const mode of MODES) {
    const what = `${mode}: a width track held at 1 builds byte-identical geometry to shipped, ${FRAMES} hero frames`
    check(`IDENTITY-${mode.toUpperCase()}`, what, () => {
      const keys = held(1)
      const same = [], sigs = []
      let firstDiff = null
      for (let f = 0; f < FRAMES; f++) {
        const a = sigFor(mode, quiet(() => ENGINE[mode].buildPreview(frames[f], OPTS)))
        sigs.push(a)
        const w = W.widthForFrame(mode, keys, (f + 1) * (1000 / 60))
        const b = sigFor(mode, quiet(() => buildAt(mode, frames[f], w).meshes))
        if (a === b) same.push(f)
        else firstDiff ??= `frame ${f + 1} at w ${w}: ${a.slice(0, 40)} vs ${b.slice(0, 40)}`
      }
      shipped[mode] = sigs
      const passThrough = MODES.every((m) => m === "rod" || (W.previewParamsAtWidth(m, OPTS, 1).params === OPTS && W.previewParamsAtWidth(m, OPTS, undefined).params === OPTS))
      row(`IDENTITY-${mode.toUpperCase()}`, same.length === FRAMES && passThrough, what,
        `identical ${same.length} of ${FRAMES}; w 1 and no width hand back the caller's params object: ${passThrough}${firstDiff ? `; first diff ${firstDiff}` : ""}`)
    })
  }

  check("SIGS", "the gate's shipped Solid signatures equal bench.mjs --input=hero --sigs= frame for frame", () => {
    const dir = mkdtempSync(join(tmpdir(), "fs-width-sigs-"))
    try {
      const out = join(dir, "bench.json")
      const env = { ...process.env }
      delete env.GATE_MUTATE_FILE
      const r = spawnSync(process.execPath, [ROOT + "scripts/verify/solid-bench/bench.mjs", "--input=hero", `--frames=${FRAMES}`, `--sigs=${out}`], { env, encoding: "utf8" })
      if (r.status !== 0) throw new Error(`bench exited ${r.status}: ${(r.stderr || "").trim().split("\n").slice(-1)[0]}`)
      const bench = JSON.parse(readFileSync(out, "utf8"))
      const mine = shipped.solid ?? []
      let same = 0
      for (let i = 0; i < FRAMES; i++) if (bench[i] !== undefined && bench[i] === mine[i]) same++
      const withTail = mine.filter((s) => s.includes("|valid=")).length
      row("SIGS", bench.length === FRAMES && mine.length === FRAMES && same === FRAMES && withTail === FRAMES,
        "the gate's shipped Solid signatures equal bench.mjs --input=hero --sigs= frame for frame",
        `identical ${same} of ${FRAMES} (bench wrote ${bench.length}, the gate ${mine.length}, ${withTail} carry Solid's hole tail); bench ran without GATE_MUTATE_FILE; both sides use today's engine, so a shared geometry regression reads the same`)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  /* ---- WIDEN: a horizontal line, Y by reached, Z held (Rod: Z times w) ------- */
  const line = quiet(() => E.process(LINE))
  const base = Object.fromEntries(MODES.map((m) => [m, extent(quiet(() => ENGINE[m].buildPreview(line, OPTS)))]))
  for (const mode of MODES) {
    const id = `WIDEN-${mode.toUpperCase()}`
    const what = `${mode}: ${mode === "solid" ? "w 1.5 and 2" : "w 2"} widen a line's Y extent by reached, Z ${mode === "rod" ? "times w" : "held"}`
    check(id, what, () => {
      const notes = []
      let ok = true
      for (const w of mode === "solid" ? [1.5, 2] : [2]) {
        const r = quiet(() => buildAt(mode, line, w))
        const e = extent(r.meshes)
        const y = e[1] / base[mode][1], z = e[2] / base[mode][2]
        const wantZ = mode === "rod" ? w : 1
        const clampOk = Math.abs(r.reached - w) < 1e-9 ? r.clamp === null : typeof r.clamp === "string" && r.clamp.length > 0 && r.reached < w
        const yOk = Math.abs(y / r.reached - 1) <= Y_TOL[mode] && r.reached > 1
        const zOk = Math.abs(z / wantZ - 1) <= Z_TOL[mode]
        ok &&= yOk && zOk && clampOk
        notes.push(`w ${w}: reached ${r.reached.toFixed(4)}, Y ${y.toFixed(4)}x (tol ${Y_TOL[mode]})${yOk ? "" : " WRONG"}, Z ${z.toFixed(4)}x want ${wantZ}${zOk ? "" : " WRONG"}, clamp ${r.clamp === null ? "none" : JSON.stringify(r.clamp)}${clampOk ? "" : " WRONG"}`)
      }
      row(id, ok, what, notes.join(" | "))
    })
  }

  /* ---- INTERP: 1 at 0 ms, 2 at 1000 ms ------------------------------------ */
  check("INTERP", "a width key between two times interpolates, in the value and on the line", () => {
    const keys = { width: [K.makeKey(0, 1), K.makeKey(1000, 2)] }
    const notes = []
    let ok = true
    for (const mode of MODES) {
      const ws = [250, 500, 750].map((t) => W.widthForFrame(mode, keys, t))
      const inside = ws.every((w) => w > 1 && w < 2) && ws[0] < ws[1] && ws[1] < ws[2]
      // each rebuilding engine builds on its own step (WIDTH_REBUILD_STEP_BY_MODE); read the same one
      const bc = W.widthBuildClockMs(keys.width, 500, mode === "rod" ? undefined : W.WIDTH_REBUILD_STEP_BY_MODE[mode])
      const agrees = ws[1] === K.sampleTrack(keys.width, mode === "rod" ? 500 : bc, "width")
      const mid = mode === "rod" ? Math.abs(ws[1] - 1.5) < 1e-9 : true
      const r = quiet(() => buildAt(mode, line, ws[1]))
      const y = extent(r.meshes)[1] / base[mode][1]
      const drawn = Math.abs(y / r.reached - 1) <= Y_TOL[mode] && y > 1
      ok &&= inside && agrees && mid && drawn
      notes.push(`${mode} ${ws.map((w) => w.toFixed(4)).join(" < ")}${inside ? "" : " NOT BETWEEN"}${agrees ? "" : " DISAGREES WITH sampleTrack"}${mid ? "" : " MID NOT 1.5"}, line Y ${y.toFixed(4)}x${drawn ? "" : " WRONG"}`)
    }
    row("INTERP", ok, "a width key between two times interpolates, in the value and on the line", notes.join(" | "))
  })

  /* ---- THROTTLE: the take ends on the last key, off a step boundary ------- */
  check("THROTTLE", "the rebuild throttle builds every key's value at its time and the last at the end, and still throttles", () => {
    const keys = { width: [K.makeKey(0, 1), K.makeKey(250, 1.6), K.makeKey(1010, 2)] }
    const endMs = 1010
    const step = W.WIDTH_REBUILD_STEP_MS
    const steady = Array.from({ length: Math.floor(endMs / (1000 / 60)) + 1 }, (_, i) => i * (1000 / 60))
    let seed = 7
    const jank = [0]
    while (jank[jank.length - 1] < endMs) {
      seed = (seed * 1103515245 + 12345) % 2147483648
      jank.push(jank[jank.length - 1] + 8 + (seed % 113))
    }
    const notes = []
    let ok = step > 0 && Number.isFinite(step)
    for (const [name, raw] of [["60 Hz", steady], ["janky", jank]]) {
      const clocks = [...raw.map((c) => Math.min(c, endMs)), endMs]
      for (const mode of ["inflate", "extrude", "solid"]) {
        let built, rebuilds = 0
        for (const c of clocks) {
          const w = W.widthForFrame(mode, keys, c)
          if (w !== built) (built = w), rebuilds++
        }
        const atKeys = keys.width.every((k) => W.widthForFrame(mode, keys, k.tMs) === k.value)
        const after = [endMs, endMs + 1, endMs + step / 2, endMs + 5000].every((c) => W.widthForFrame(mode, keys, c) === 2)
        const cap = Math.ceil(endMs / step) + keys.width.length
        const throttles = rebuilds <= cap && rebuilds < clocks.length
        ok &&= built === 2 && atKeys && after && throttles
        if (mode === "solid" || !(built === 2 && atKeys && after && throttles))
          notes.push(`${name} ${mode}: last built ${built}${built === 2 ? "" : " NOT THE FINAL 2"}, every key at its time ${atKeys}, final held after ${after}, ${rebuilds} rebuilds over ${clocks.length} frames (cap ${cap})${throttles ? "" : " NOT THROTTLED"}`)
      }
    }
    const rodAtKeys = keys.width.every((k) => W.widthForFrame("rod", keys, k.tMs) === k.value)
    ok &&= rodAtKeys
    notes.push(`rod reads every key at its time: ${rodAtKeys}; step ${step.toFixed(2)} ms`)
    row("THROTTLE", ok, "the rebuild throttle builds every key's value at its time and the last at the end, and still throttles", [...notes, "models widthForFrame calls only; the viewport rebuild and GPU upload are not run"].join(" | "))
  })

  /* ---- RANGE: refused on every engine, the ends accepted ------------------ */
  check("RANGE", "out-of-range width keys are refused with the reason on every engine; 0.5 and 2 are accepted", () => {
    const notes = []
    let ok = true
    for (const [v, reason] of [[2.5, "width 2.5 is outside 0.5..2"], [0.25, "width 0.25 is outside 0.5..2"], [0, "width 0 is outside 0.5..2"]]) {
      const keys = { width: [K.makeKey(0, 1), K.makeKey(500, v)] }
      const missed = []
      for (const mode of MODES)
        for (const t of [0, 250, 500, 900]) {
          let msg = null
          try {
            W.widthForFrame(mode, keys, t)
          } catch (e) {
            msg = String(e && e.message)
          }
          if (msg === null || !msg.includes(reason)) missed.push(`${mode}@${t}${msg === null ? " sampled" : ` said ${msg.slice(0, 50)}`}`)
        }
      ok &&= missed.length === 0
      notes.push(`${v}: ${missed.length ? `NOT REFUSED ${missed.slice(0, 3).join(", ")}` : `refused 16 of 16 with "${reason}"`}`)
    }
    const ends = MODES.every((m) => W.widthForFrame(m, { width: [K.makeKey(0, 0.5), K.makeKey(500, 2)] }, 500) === 2 && W.widthForFrame(m, { width: [K.makeKey(0, 0.5), K.makeKey(500, 2)] }, 0) === 0.5)
    ok &&= ends
    notes.push(`0.5 and 2 accepted on every engine: ${ends}`)
    row("RANGE", ok, "out-of-range width keys are refused with the reason on every engine; 0.5 and 2 are accepted", notes.join(" | "))
  })
}

/* ---- the must-fails ----------------------------------------------------- */
const WK = "lib/width-keys.ts"
const MUTANTS = [
  { name: "the gate's Solid default drifts from the rig's (the gate would compare a different build)", file: "lib/geometry-engines.ts", find: "  thickness: SOLID_THICKNESS_SLIDER_DEFAULT,\n  depth: SOLID_DEPTH_SLIDER_DEFAULT,", text: "  thickness: SOLID_THICKNESS_SLIDER_DEFAULT + 0.5,\n  depth: SOLID_DEPTH_SLIDER_DEFAULT,", red: ["SIGS"] },
  { name: "a width held at 1 samples as 1.01", file: WK, find: "return w < WIDTH_MIN ? WIDTH_MIN : w > WIDTH_MAX ? WIDTH_MAX : w\n", text: "return (w < WIDTH_MIN ? WIDTH_MIN : w > WIDTH_MAX ? WIDTH_MAX : w) * 1.01\n", red: ["IDENTITY-ROD", "IDENTITY-INFLATE", "IDENTITY-EXTRUDE", "IDENTITY-SOLID"] },
  { name: "no engine follows width", file: WK, find: '  if (w === undefined || w === 1 || mode === "rod") return same(params)', text: "  return same(params)", also: { find: "  return w === undefined || w === 1 ? 0 : (w - 1) * TUBE_RADIUS", text: "  return 0" }, red: ["WIDEN-ROD", "WIDEN-INFLATE", "WIDEN-EXTRUDE", "WIDEN-SOLID", "INTERP"] },
  { name: "Extrude's depth grows with its width", file: WK, find: "depth: p.depth / reached", text: "depth: p.depth", red: ["WIDEN-EXTRUDE"] },
  { name: "Solid draws short of w and says nothing", file: WK, find: "  const clamp =\n    target === want\n      ? null", text: "  const clamp =\n    true\n      ? null", red: ["WIDEN-SOLID"] },
  { name: "width reads the first key at every time", file: WK, find: 'sampleTrack(keys?.width, clockMs, "width")', text: 'sampleTrack(keys?.width, keys?.width?.[0]?.tMs ?? clockMs, "width")', red: ["INTERP"] },
  { name: "the throttle does not snap to key times", file: WK, find: "if (k.tMs > c) c = k.tMs", text: "if (false) c = k.tMs", red: ["THROTTLE"] },
  { name: "the rebuilders rebuild every frame", file: WK, find: 'if (WIDTH_APPLY[mode] === "per-frame") return widthAt(keys, clockMs)', text: "return widthAt(keys, clockMs)", red: ["THROTTLE"] },
  { name: "width out of range accepted", file: "lib/keyframes.ts", find: 'property === "width" && (k.value < WIDTH_MIN || k.value > WIDTH_MAX)', text: "false", red: ["RANGE"] },
]

function editFor(src, file, find, text) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${file}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text, was: find }
}

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-width-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const src = readFileSync(join(ROOT, m.file), "utf8")
      const edits = [editFor(src, m.file, m.find, m.text)]
      if (m.also) edits.push(editFor(src, m.file, m.also.find, m.also.text))
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [m.file]: edits }))
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
  runRows()
} catch (e) {
  row("RUN", false, "the rows ran to completion", String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e))
}
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(17)} ${r.what}\n      ${r.detail}`)
if (ROWS_ONLY) {
  console.log("ROWS_JSON " + JSON.stringify(rows.map(({ id, ok }) => ({ id, ok }))))
  process.exit(rows.every((r) => r.ok) ? 0 : 1)
}
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
const unguarded = rows.filter((r) => r.id !== "RUN" && !MUTANTS.some((m) => m.red.includes(r.id))).map((r) => r.id)
const EXPECT = 12
console.log(`\n${pass} of ${rows.length} rows pass (${EXPECT} expected); ${caught} of ${muts.length} mutants caught; rows with no must-fail: ${unguarded.join(", ") || "none"}`)
process.exit(pass === rows.length && rows.length === EXPECT && caught === muts.length && unguarded.length === 0 ? 0 : 1)
