// PROBE — what does a non-finite Depth or Thickness produce?
//
// WHY THIS EXISTS. `computeEffectiveExtrudeDepth` floors its input:
//
//     if (!isFinite(raw) || raw <= 0) return EXTRUDE_EFFECTIVE_DEPTH_FLOOR
//
// Its two Solid siblings — `computeSolidEffectiveDepth` and
// `computeSolidEffectiveThicknessPx` — do not. Both are
//
//     Math.max(MIN, Math.min(MAX, v))
//
// and `Math.min(0.5, NaN)` is NaN, so `Math.max(0.02, NaN)` is NaN and
// `Math.pow(NaN, 1.2)` is NaN. The clamp that looks like a clamp passes NaN
// straight through. This is the same "fixed in one place, left in the other"
// shape as the inverted corner predicate, in the same file.
//
// The two downstream consequences differ, and BOTH matter:
//
//   · DEPTH -> every vertex Z is NaN, and the builder reports success. The mesh
//     has a vertex count, a triangle count and a bounding box made of NaN; no
//     existing gate reads `Number.isFinite` on a position.
//   · THICKNESS -> `ctx.lineWidth = NaN`. Canvas2D's spec IGNORES a non-finite
//     assignment, so the rasteriser silently keeps the PREVIOUS build's width.
//     Nothing errors; the mark is simply drawn at a width nobody asked for, and
//     which build you get depends on what was rendered before it.
//
// Channels this arrives through: the persisted document (`lib/doc-store.ts`
// round-trips these numbers through JSON), `__styleHarness.setSolid(...)`, and
// any arithmetic on a slider value that divides by a zero.
import { build, SHAPES } from "./lib/engine-node.mjs"
import { loadTs } from "./_ts-load.mjs"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const eng = loadTs("lib/geometry-engines.ts")
const SELF = fileURLToPath(import.meta.url)
const ROOT = join(dirname(SELF), "..", "..")

let fails = 0
/* EVERY ROW IS COUNTED AS IT IS EMITTED, and the total is printed at the end so
 * `assert-param-guards.mjs` can assert it read exactly as many rows as this
 * probe wrote. That is the check that catches a row this probe emits and the
 * gate's `/^(PASS|FAIL)\s+\w/` filter silently drops — which is the same
 * un-run-row-scored-as-a-pass class as the bare `THREW` line section 4 used to
 * print. A count on one side of a pipe proves nothing; a count on both does. */
let emitted = 0
/* `FS_PROBE_HIDE_ROW=<n>` is the KNOWN-BAD for that agreement row. It prints one
 * row INDENTED — the exact shape of the `  ok  ` and bare `THREW` lines section
 * 4 used to emit — so the gate's `/^(PASS|FAIL)\s+\w/` filter cannot match it
 * while this probe still counts it. `FS_PROBE_HIDE_ROW=1 node
 * scripts/verify/assert-param-guards.mjs` must go red on
 * "this gate read every row the NaN probe wrote". */
const HIDE_ROW = Number(process.env.FS_PROBE_HIDE_ROW || 0)
const line = (ok, s) => {
  if (!ok) fails++
  emitted++
  if (emitted === HIDE_ROW) console.log(`  ${ok ? "ok  " : "FAIL"} ${s}`)
  else console.log(`${ok ? "PASS" : "FAIL"}  ${s}`)
}

/* ==========================================================================
 * SECTION 4'S CASE LIST, DERIVED — declared up here because the sweep runs in
 * a CHILD of this file and the child needs it before anything else. Section 4
 * itself is at the bottom, in reading order; only the derivation moved.
 *
 * ⚠ TWO DEFECTS, BOTH FOUND 2026-08-03, AND ONE OF THEM IS A LIVE CRASH.
 *
 * 1 · THE INVENTORY WAS HAND-WRITTEN AND NAMED FOUR PARAMETERS OF EIGHT:
 *
 *       ["extrudeParams.depth", …], ["extrudeParams.width", …],
 *       ["solidParams.depth",   …], ["solidParams.thickness", …]
 *
 *     `ExtrudeParams` also carries `bevelSize` and `bevelSegments`,
 *     `InflateParams` carries `blend` and `resolution`. Four numeric engine
 *     parameters had never been through this probe. The list is now DERIVED
 *     from the engines' own `DEFAULT_*_PARAMS` objects — a field added to a
 *     params interface is covered the moment it exists — and the derivation is
 *     itself gated against the TS interface declarations in
 *     `lib/geometry-engines.ts`, so a numeric field that reaches the interface
 *     without reaching the defaults is caught rather than silently uncovered.
 *
 * 2 · AND THE FOURTH UNCOVERED PARAMETER IS A CRASH AND AN OOM.
 *     `ribbonProfileRows` (lib/geometry-engines.ts:1891) does
 *
 *         const S = Math.max(1, Math.floor(segments))
 *
 *     which is the SAME "clamp that looks like a clamp" this probe's own header
 *     describes for the two Solid siblings: `Math.floor(NaN)` is NaN and
 *     `Math.max(1, NaN)` is NaN, so the `for (k = 0; k <= S; k++)` loop never
 *     runs, the function returns an EMPTY row list, and
 *     `buildContinuousRibbonStripGeometry` dereferences `L[0][i]` on it
 *     (:2215) — an unhandled `TypeError: Cannot read properties of undefined
 *     (reading '0')`. With `segments = +Infinity` the same line runs the loop
 *     forever and the process dies of heap exhaustion. Measured, both.
 *
 * WHY THE SWEEP RUNS IN A CHILD. Because of that second verdict. A case that
 * exhausts the heap does not throw — it kills the process — and a probe that
 * its own subject can kill reports nothing at all about the ninety-five cases
 * after it. Each child prints one line per case as it goes and the parent
 * RESUMES at the case after whichever one killed it, so an OOM becomes an
 * honest FAIL row instead of a silent truncation. Same discipline, and the same
 * heap cap and wall clock, as `_probe-resample-hang.mjs`.
 * ========================================================================== */
const MODES = ["rod", "extrude", "solid", "inflate"]
const PARAM_GROUPS = [
  ["extrudeParams", "ExtrudeParams", eng.DEFAULT_EXTRUDE_PARAMS],
  ["solidParams", "SolidParams", eng.DEFAULT_SOLID_PARAMS],
  ["inflateParams", "InflateParams", eng.DEFAULT_INFLATE_PARAMS],
]
/** Every NUMERIC field of every engine params object, read off the objects. */
const NUMERIC_PARAMS = []
for (const [group, iface, defaults] of PARAM_GROUPS)
  for (const field of Object.keys(defaults))
    if (typeof defaults[field] === "number") NUMERIC_PARAMS.push({ group, iface, field })

/* PARKED — the four the list used to hold, kept so the gap stays legible:
 *   extrudeParams.depth · extrudeParams.width · solidParams.depth · solidParams.thickness */
const BAD_VALUES = [
  ["NaN", NaN],
  ["+Infinity", Infinity],
  ["-Infinity", -Infinity],
]
const SWEEP_CASES = []
for (const mode of MODES)
  for (const p of NUMERIC_PARAMS)
    for (const [label, value] of BAD_VALUES)
      SWEEP_CASES.push({ mode, group: p.group, field: p.field, label, value })

/* ---------------- the sweep CHILD ---------------- */
if (process.argv[2] === "--sweep") {
  const start = Number(process.argv[3] || 0)
  for (let i = start; i < SWEEP_CASES.length; i++) {
    const c = SWEEP_CASES[i]
    let verdict
    let detail = ""
    try {
      const r = build(c.mode, SHAPES.tick(), { [c.group]: { [c.field]: c.value } })
      let nf = 0
      for (let j = 0; j < r.pos.length; j++) if (!Number.isFinite(r.pos[j])) nf++
      verdict = nf > 0 ? "NON-FINITE" : "CLEAN"
      detail = `${r.pos.length} floats, ${nf} non-finite`
    } catch (e) {
      // ⚠ A THROW IS A FAILURE, NOT A NOTE. It used to `continue` past a
      // `console.log` that was neither PASS nor FAIL, never touched `fails`,
      // and left this probe exiting 0 — see the parent's row builder.
      verdict = "THREW"
      detail = String(e && e.message).slice(0, 80)
    }
    console.log(`SWEEP\t${i}\t${verdict}\t${detail}`)
  }
  console.log("SWEEPDONE")
  process.exit(0)
}

/* ---------------- 1 · the mapping functions, directly ---------------- */
console.log("=== 1 · the three effective-parameter maps, on non-finite input ===")
const BAD = [
  ["NaN", NaN],
  ["Infinity", Infinity],
  ["-Infinity", -Infinity],
]
for (const [label, v] of BAD) {
  const ed = eng.computeEffectiveExtrudeDepth(v, 0.1)
  const sd = eng.computeSolidEffectiveDepth(v)
  const st = eng.computeSolidEffectiveThicknessPx(v)
  console.log(
    `  ${label.padEnd(10)} extrudeDepth=${String(ed).padEnd(10)}` +
      ` solidDepth=${String(sd).padEnd(10)} solidThicknessPx=${String(st)}`,
  )
  line(Number.isFinite(ed), `computeEffectiveExtrudeDepth(${label}) is finite`)
  line(Number.isFinite(sd), `computeSolidEffectiveDepth(${label}) is finite`)
  line(Number.isFinite(st), `computeSolidEffectiveThicknessPx(${label}) is finite`)
}

/* Both directions: a VALID value must be untouched, to the bit. */
console.log("\n  --- the control: valid values must pass through unchanged ---")
for (const v of [0.02, 0.18, 0.35, 0.5]) {
  const sd = eng.computeSolidEffectiveDepth(v)
  console.log(`    depth ${String(v).padEnd(5)} -> ${sd.toFixed(10)}`)
}
for (const v of [4, 24, 38, 64]) {
  const st = eng.computeSolidEffectiveThicknessPx(v)
  console.log(`    thick ${String(v).padEnd(5)} -> ${st.toFixed(10)}`)
}

/* ---------------- 2 · what the ENGINE returns ---------------- */
console.log("\n=== 2 · SolidEngine.buildPreview with a NaN depth — the real builder ===")
{
  const polys = SHAPES.circle()
  const good = build("solid", polys, { solidParams: { depth: 0.18 } })
  const bad = build("solid", polys, { solidParams: { depth: NaN } })
  const countNonFinite = (r) => {
    let n = 0
    for (let i = 0; i < r.pos.length; i++) if (!Number.isFinite(r.pos[i])) n++
    return n
  }
  const gN = countNonFinite(good)
  const bN = countNonFinite(bad)
  console.log(
    `  depth 0.18 : ${good.pos.length} floats, ${gN} non-finite, ${good.meshes} mesh(es)`,
  )
  console.log(
    `  depth NaN  : ${bad.pos.length} floats, ${bN} non-finite, ${bad.meshes} mesh(es)` +
      (bN > 0 ? `  <- returned as a valid mesh` : ""),
  )
  line(gN === 0, `depth 0.18 produces 0 non-finite positions`)
  line(bN === 0, `depth NaN produces 0 non-finite positions (got ${bN} of ${bad.pos.length})`)
}

console.log("\n=== 3 · SolidEngine with a NaN thickness — the rasteriser ===")
{
  const polys = SHAPES.circle()
  // Build a THIN mark first, then a NaN one. If the guard is missing, the NaN
  // build inherits the thin one's lineWidth — so the tell is that two different
  // requested thicknesses produce the SAME mesh.
  const thin = build("solid", polys, { solidParams: { thickness: 8 } })
  const nan1 = build("solid", polys, { solidParams: { thickness: NaN } })
  const fat = build("solid", polys, { solidParams: { thickness: 60 } })
  const nan2 = build("solid", polys, { solidParams: { thickness: NaN } })
  const sig = (r) => `${r.pos.length}/${r.idx.length}`
  console.log(`  thickness 8    -> ${sig(thin)}`)
  console.log(`  thickness NaN  -> ${sig(nan1)}   (after the thin build)`)
  console.log(`  thickness 60   -> ${sig(fat)}`)
  console.log(`  thickness NaN  -> ${sig(nan2)}   (after the fat build)`)
  const inherits = sig(nan1) !== sig(nan2)
  line(
    !inherits,
    `a NaN thickness produces the SAME mesh regardless of what was built before it` +
      (inherits ? `  <- it inherited the previous build's line width` : ""),
  )
  let nf = 0
  for (let i = 0; i < nan1.pos.length; i++) if (!Number.isFinite(nan1.pos[i])) nf++
  line(nf === 0, `thickness NaN produces 0 non-finite positions (got ${nf})`)
}

/* ---------------- 4 · every mode, every numeric engine parameter ---------------- */
/*
 * See the derivation block at the top of this file for the two defects this
 * section was repaired for. Three things changed and each is load-bearing:
 *
 *   · the parameter list is DERIVED from the engines rather than transcribed,
 *     and gated against the TS interfaces;
 *   · the bad values are NaN AND both infinities, because `Math.max(1, x)`
 *     fails differently on each — NaN empties a loop, +Infinity never leaves
 *     it;
 *   · every case gets a real `PASS`/`FAIL` row. The old form printed a bare
 *     `THREW` line on an exception and moved on: it was neither PASS nor FAIL,
 *     it never touched `fails`, this probe still exited 0, and
 *     `assert-param-guards.mjs`'s row filter (`/^(PASS|FAIL)\s+\w/`) could not
 *     see it either. All sixteen of the old section-4 cases could have thrown
 *     and the gate would have printed ALL PASS.
 */
console.log("\n=== 4 · every mode x every numeric engine parameter, on non-finite input ===")

/* THE DERIVATION IS ITSELF GATED. A numeric field can reach an interface without
 * reaching its DEFAULT_* object — and then it is a parameter nothing here covers
 * while the list still looks complete. Read the declarations out of the source
 * and require the two sets to agree, the same cross-file-constant discipline
 * `assert-export-plan.mjs` §10 uses for EXPORT_PAPER. */
{
  const src = readFileSync(join(ROOT, "lib", "geometry-engines.ts"), "utf8")
  for (const [group, iface, defaults] of PARAM_GROUPS) {
    const body = src.match(new RegExp(`export interface ${iface} \\{([\\s\\S]*?)\\n\\}`))
    const declared = body
      ? [...body[1].matchAll(/^\s*(\w+)\??:\s*number\b/gm)].map((m) => m[1]).sort()
      : null
    const derived = Object.keys(defaults)
      .filter((k) => typeof defaults[k] === "number")
      .sort()
    console.log(
      `  ${iface.padEnd(15)} interface declares [${declared ? declared.join(", ") : "NOT FOUND"}]` +
        `  ·  defaults expose [${derived.join(", ")}]`,
    )
    line(
      declared !== null && declared.join("|") === derived.join("|"),
      `${group}: every numeric field of ${iface} is present in its defaults, so the sweep below covers all of them`,
    )
  }
}

/* THE SWEEP, RESUMED ACROSS ITS OWN CASUALTIES. See the header block: a case
 * that exhausts the heap kills the process rather than throwing, so the parent
 * restarts the child at the case after whichever one died and records that one
 * as OOM / HANG. Same cap and clock as `_probe-resample-hang.mjs`. */
const SWEEP_TIMEOUT_MS = 20_000
const SWEEP_HEAP_MB = 512
const verdicts = new Array(SWEEP_CASES.length).fill(null)
{
  let i = 0
  let spawns = 0
  while (i < SWEEP_CASES.length) {
    spawns++
    const r = spawnSync(
      process.execPath,
      [`--max-old-space-size=${SWEEP_HEAP_MB}`, SELF, "--sweep", String(i)],
      { encoding: "utf8", timeout: SWEEP_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
    )
    const out = `${r.stdout ?? ""}`
    const reported = out.split("\n").filter((l) => l.startsWith("SWEEP\t"))
    for (const l of reported) {
      const [, idx, verdict, detail] = l.split("\t")
      verdicts[Number(idx)] = { verdict, detail: detail ?? "" }
    }
    if (out.includes("SWEEPDONE")) break
    const last = reported.length ? Number(reported[reported.length - 1].split("\t")[1]) : i - 1
    const timedOut = r.signal === "SIGTERM" || r.error?.code === "ETIMEDOUT"
    const oom = /heap out of memory|Allocation failed|JavaScript heap/i.test(String(r.stderr))
    verdicts[last + 1] = {
      verdict: timedOut ? "HANG" : oom ? "OOM" : `CRASH(${r.status})`,
      detail: timedOut
        ? `no return in ${SWEEP_TIMEOUT_MS} ms`
        : oom
          ? `heap exhausted at ${SWEEP_HEAP_MB} MB`
          : String(r.stderr).trim().split("\n").slice(-1)[0].slice(0, 80),
    }
    i = last + 2
  }
  console.log(
    `  ${SWEEP_CASES.length} cases (${MODES.length} modes x ${NUMERIC_PARAMS.length} numeric params x ${BAD_VALUES.length} values)` +
      ` across ${spawns} child process(es)`,
  )
  console.log(`SECTION4 CASES ${SWEEP_CASES.length}`)
}

/* One verdict row per (mode, parameter) — the three bad values are folded into
 * its detail so the table stays readable, and the row names whichever value
 * broke. `line()` prefixes PASS/FAIL at column 0, which is what makes these
 * visible to the gate; the old `  ok  ` / bare `THREW` lines were not. */
for (const mode of MODES) {
  for (const p of NUMERIC_PARAMS) {
    const cells = BAD_VALUES.map(([label]) => {
      const idx = SWEEP_CASES.findIndex(
        (c) => c.mode === mode && c.group === p.group && c.field === p.field && c.label === label,
      )
      return { label, ...(verdicts[idx] ?? { verdict: "NOT RUN", detail: "no line from any child" }) }
    })
    const bad = cells.filter((c) => c.verdict !== "CLEAN")
    line(
      bad.length === 0,
      `${mode.padEnd(8)} ${`${p.group}.${p.field}`.padEnd(26)} survives NaN / +Infinity / -Infinity` +
        (bad.length
          ? `  <- ${bad.map((c) => `${c.label}: ${c.verdict} (${c.detail})`).join(" | ")}`
          : `  [${cells.map((c) => `${c.label} ${c.detail}`).join(" · ")}]`),
    )
  }
}
console.log(`SECTION4 ROWS ${MODES.length * NUMERIC_PARAMS.length}`)
console.log(`PROBE ROWS ${emitted}`)

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`)
process.exit(fails === 0 ? 0 : 1)
