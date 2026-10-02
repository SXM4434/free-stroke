#!/usr/bin/env node
/* ============================================================================
 * assert-schedule-controls: the stroke schedule controls of coverage item 13
 * (rows 14, 31, 32, 33) and the plan's 3b Stagger
 * (`docs/research-2026-09-26/animation-panel-and-sequences-plan.md` 3b), in
 * `lib/stroke-schedule.ts` and `lib/stroke-timing.ts`. Node only, no browser.
 *
 *   node scripts/verify/assert-schedule-controls.mjs              rows, then every must-fail
 *   node scripts/verify/assert-schedule-controls.mjs --rows-only  rows only (a mutant child runs this)
 *
 * WHAT IT READS. Real reveal keys from the Inflate engine's Node preview on the
 * hero word (`_hero-word.mjs`), the hero's real pace (`paceFromCurve` over
 * `revealDistanceFraction`, as the strip builds it), and every engine-node
 * SHAPE for the identity row.
 *
 * WHAT IT DOES NOT READ. The page: nothing here clicks a control, proves a
 * preset is one undo step, or looks at a frame. Those are browser gates and
 * the lane's LOG lists them NOT RUN.
 *
 * OFF IS TODAY. IDENTITY compares against the snapshot this lane started from
 * (2cc9e98), materialised from git into a temp tree, never a golden hash. A
 * missing base FAILS. Override with SCHEDULE_CONTROLS_BASE=<rev>.
 *
 * MUST-FAILS. Each mutant is a one-line sabotage applied by `_ts-load.mjs`
 * through GATE_MUTATE_FILE (nothing on disk changes). Offsets are found by
 * unique text at run time, so a mutant whose text is gone FAILS loudly. A
 * mutant counts as caught only when the child ran to completion AND every
 * named row went red.
 * ========================================================================== */
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")
const BASE_REV = process.env.SCHEDULE_CONTROLS_BASE || "2cc9e98"

async function loadBase() {
  const dir = mkdtempSync(join(tmpdir(), "fs-schedule-controls-base-"))
  const tar = execFileSync("git", ["-C", ROOT, "archive", BASE_REV, "lib", "scripts/verify/_ts-load.mjs"], { maxBuffer: 1 << 30 })
  execFileSync("tar", ["-x", "-C", dir], { input: tar })
  symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"))
  const saved = process.env.GATE_MUTATE_FILE
  delete process.env.GATE_MUTATE_FILE
  try {
    const L = await import(join(dir, "scripts/verify/_ts-load.mjs"))
    return { dir, S: L.loadTs("lib/stroke-schedule.ts"), R: L.loadTs("lib/pen-reveal.ts"), T: L.loadTs("lib/stroke-timing.ts") }
  } finally {
    if (saved !== undefined) process.env.GATE_MUTATE_FILE = saved
  }
}

const rows = []
function row(id, ok, what, detail) {
  rows.push({ id, ok: !!ok, what, detail })
}

const sameBytes = (a, b) =>
  !!a && !!b && a.length === b.length &&
  Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0

async function runRows() {
  const S = loadTs("lib/stroke-schedule.ts")
  const R = loadTs("lib/pen-reveal.ts")
  const T = loadTs("lib/stroke-timing.ts")
  const EN = await import("./lib/engine-node.mjs")
  const HW = await import("./_hero-word.mjs")
  const base = await loadBase()

  const buildKeys = (strokes) => {
    const m = EN.InflateEngine.buildPreview(strokes, {
      canvasWidth: EN.CW,
      canvasHeight: EN.CH,
      extrudeParams: EN.DEFAULT_EXTRUDE_PARAMS,
      solidParams: EN.DEFAULT_SOLID_PARAMS,
      inflateParams: EN.DEFAULT_INFLATE_PARAMS,
    })
    const parts = m.map((x) => x.revealKeys).filter(Boolean)
    const out = new Float32Array(parts.reduce((s, k) => s + k.length, 0))
    let o = 0
    for (const k of parts) (out.set(k, o), (o += k.length))
    return out
  }

  const fixtures = [{ name: "hero", strokes: HW.processedHeroStrokes(), ink: HW.HERO_INK_WIDTH_PX }]
  for (const [name, f] of Object.entries(EN.SHAPES)) fixtures.push({ name, strokes: EN.process(f()), ink: 20 })
  for (const fx of fixtures) fx.keys = buildKeys(fx.strokes)
  const hero = fixtures[0]
  /* A precondition, not a row: without the hero's 12 strokes and real keys every
   * row below would measure nothing, so the run stops and RUN goes red. */
  if (!(hero.keys.length > 0 && hero.strokes.length === 12)) {
    throw new Error(`fixtures: hero ${hero.strokes.length} strokes, ${hero.keys.length} keys; want 12 strokes and real keys`)
  }

  /* The hero's own pace, built the way the strip builds it, so the lifts are real. */
  const paceOf = (Tm, strokes, sched) => {
    const lifts = R.liftsLandBetweenStrokes(sched, "grow")
    return Tm.paceFromCurve((c) => R.revealDistanceFraction(strokes, c, "hybrid", 0.4, lifts))
  }
  const slotsOf = (sched, pace, ms) => {
    const s = new Float64Array(sched.tracks.length * 2)
    sched.tracks.forEach((t, i) => {
      s[i * 2] = pace.beatToLanding(t.start) * ms
      s[i * 2 + 1] = pace.beatToClock(t.end) * ms
    })
    return s
  }

  /* ── IDENTITY: every control off, every artefact byte for byte against the base ── */
  {
    const PARAMS = [
      S.DRAW_IN_DEFAULTS,
      { ...S.DRAW_IN_DEFAULTS, order: "reversed" },
      { ...S.DRAW_IN_DEFAULTS, unit: "stroke", order: "random", seed: 3, overlap: 0.4 },
      { ...S.DRAW_IN_DEFAULTS, order: "byPosition", reverse: "alternate", overlap: 1, align: "end" },
    ]
    const TAKES = [
      { strokes: {}, ripple: false },
      { strokes: { 1: { delayMs: 120, speed: 1.5, ease: { kind: "preset", id: "out" }, holdBack: false } }, ripple: false },
      {
        strokes: {
          0: { delayMs: -40, speed: 0.8, ease: { kind: "bezier", x1: 0.4, y1: 0, x2: 0.2, y2: 1.2 }, holdBack: false },
          2: { delayMs: 0, speed: 1, ease: { kind: "preset", id: "linear" }, holdBack: true },
          3: { delayMs: 30, speed: 1.2, ease: { kind: "preset", id: "linear" }, holdBack: false, performed: [0, 0.2, 0.2, 0.7, 1] },
        },
        ripple: true,
      },
    ]
    let n = 0
    const bad = []
    for (const fx of fixtures) {
      const nS = fx.strokes.length
      for (const [pi, p] of PARAMS.entries()) {
        const sc = S.scheduleFromStrokes(fx.strokes, null, p)
        const sb = base.S.scheduleFromStrokes(fx.strokes, null, p)
        const where = `${fx.name}/p${pi}`
        n++
        if (JSON.stringify(sc) !== JSON.stringify(sb)) bad.push(`${where}: schedule`)
        if (!sameBytes(S.remapRevealKeys(fx.keys, sc), base.S.remapRevealKeys(fx.keys, sb))) bad.push(`${where}: keys`)
        const pace = paceOf(T, fx.strokes, sc)
        const paceB = paceOf(base.T, fx.strokes, sb)
        const ms = 3000
        for (const [ti, tk0] of TAKES.entries()) {
          if (nS < 4 && ti > 0) continue
          const tk = JSON.parse(JSON.stringify(tk0))
          const ts = T.buildTimedSchedule(sc, tk, { baseMs: ms, pace })
          const tb = base.T.buildTimedSchedule(sb, JSON.parse(JSON.stringify(tk0)), { baseMs: ms, pace: paceB })
          const w = `${where}/t${ti}`
          n++
          if ((ts === null) !== (tb === null)) {
            bad.push(`${w}: timed ${ts !== null} vs base ${tb !== null}`)
            continue
          }
          const bs = slotsOf(sc, pace, ms)
          if (!sameBytes(T.takeLiftsMs(ts, pace, bs, ms), base.T.takeLiftsMs(tb, paceB, slotsOf(sb, paceB, ms), ms))) bad.push(`${w}: lifts`)
          if (!sameBytes(T.timedRevealKeys(fx.keys, sc, ts), base.T.timedRevealKeys(fx.keys, sb, tb))) bad.push(`${w}: timed keys`)
          if (!ts) continue
          if (!sameBytes(ts.slots, tb.slots) || ts.takeMs !== tb.takeMs || ts.sig !== tb.sig || ts.identity !== tb.identity) bad.push(`${w}: slots/takeMs/sig`)
          for (let j = 0; j <= 30; j++) {
            const c = j / 30
            const a = T.sampleTake(ts, c * ts.takeMs, j % 2 ? { lo: Math.max(0, c - 0.3), hi: c } : undefined)
            const b = base.T.sampleTake(tb, c * tb.takeMs, j % 2 ? { lo: Math.max(0, c - 0.3), hi: c } : undefined)
            if (!sameBytes(a.spans, b.spans)) (bad.push(`${w}: sampleTake @${j}`), (j = 99))
            else if (T.timedFront(ts, c * ts.takeMs, 0.02) !== base.T.timedFront(tb, c * tb.takeMs, 0.02)) (bad.push(`${w}: timedFront @${j}`), (j = 99))
          }
          if (JSON.stringify(T.performedHolds(ts)) !== JSON.stringify(base.T.performedHolds(tb))) bad.push(`${w}: performedHolds`)
          if (fx === hero) {
            const fc = R.buildTipField(fx.strokes, fx.ink, 1, null, T.timedTipMap(ts))
            const fb = base.R.buildTipField(fx.strokes, fx.ink, 1, null, base.T.timedTipMap(tb))
            if (!sameBytes(fc.data, fb.data) || !sameBytes(fc.slope, fb.slope)) bad.push(`${w}: tip field`)
          }
        }
      }
    }
    row("IDENTITY", bad.length === 0, `every control off: schedules, keys, slots, lifts, spans, front, holds and the tip field byte-identical to ${BASE_REV}`, `${n} schedule and take cases${bad.length ? `; DIFFER: ${bad.slice(0, 5).join("; ")}` : ", all identical"}`)
  }

  /* ── the hero, timed on its real pace ──────────────────────────────────── */
  const sched = S.scheduleFromStrokes(hero.strokes, null, S.DRAW_IN_DEFAULTS)
  const n = sched.tracks.length
  const pace = paceOf(T, hero.strokes, sched)
  const BASE_MS = 4000
  const baseSlots = slotsOf(sched, pace, BASE_MS)
  const build = (take) => T.buildTimedSchedule(sched, take, { baseMs: BASE_MS, pace })
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => baseSlots[a * 2] - baseSlots[b * 2] || a - b)

  /* ── STAGGER (plan 3b) ─────────────────────────────────────────────────── */
  {
    const tk = T.withStagger({ strokes: {}, ripple: false }, baseSlots, { gapMs: 50 })
    const ts = build(tk)
    const first = baseSlots[order[0] * 2]
    let worst = 0
    let durBad = 0
    order.forEach((i, k) => {
      worst = Math.max(worst, Math.abs(ts.slots[i * 2] - (first + 50 * k)))
      const d0 = baseSlots[i * 2 + 1] - baseSlots[i * 2]
      if (Math.abs(ts.slots[i * 2 + 1] - ts.slots[i * 2] - d0) > 1e-6) durBad++
    })
    row("STAGGER", worst <= 0.5 && durBad === 0 && Object.keys(tk.strokes).length === n, "Stagger 50 ms: the k-th stroke in base order starts 50k ms after the first, each keeps its length", `${n} rows written; worst start off by ${worst.toFixed(3)} ms (0.5 allowed, delays are whole ms); ${durBad} lengths changed`)
  }
  {
    const tk = T.withStagger({ strokes: {}, ripple: true }, baseSlots, { gapMs: 50 })
    const ts = build(tk)
    const first = baseSlots[order[0] * 2]
    let worst = 0
    order.forEach((i, k) => (worst = Math.max(worst, Math.abs(ts.slots[i * 2] - (first + 50 * k)))))
    row("STAGGER-RIPPLE", worst <= 0.5, "Stagger under Ripple: the carry is taken out, so the starts still fall 50 ms apart", `worst start off by ${worst.toFixed(3)} ms`)
  }
  {
    const K = 5
    const H = 8
    const prior = {
      strokes: {
        [K]: { delayMs: 0, speed: 2, ease: { kind: "preset", id: "out" }, holdBack: false },
        [H]: { delayMs: 15, speed: 1, ease: { kind: "preset", id: "linear" }, holdBack: true },
      },
      ripple: false,
    }
    const tk = T.withStagger(prior, baseSlots, { gapMs: 50 })
    const kept = tk.strokes[K].speed === 2 && tk.strokes[K].ease.id === "out" && JSON.stringify(tk.strokes[H]) === JSON.stringify(prior.strokes[H])
    const ts = build(tk)
    const rest = order.filter((i) => i !== H)
    const first = baseSlots[rest[0] * 2]
    let worst = 0
    rest.forEach((i, k) => (worst = Math.max(worst, Math.abs(ts.slots[i * 2] - (first + 50 * k)))))
    const endsLast = Math.abs(ts.slots[H * 2 + 1] - ts.takeMs) < 1e-9
    row("STAGGER-KEEP", kept && worst <= 0.5 && endsLast, "Stagger writes delays only: a row's speed and ease stay, a held-back stroke stays held and out of the count", `speed and ease kept ${kept}; ${rest.length} strokes staggered, worst ${worst.toFixed(3)} ms; held stroke still lands last ${endsLast}`)
  }
  {
    const St = loadTs("lib/style-system.ts")
    const p = St.PRESET_REGISTRY.geometryAnimation.find((x) => x.id === "stagger")
    const gap = p?.motion?.stagger?.gapMs
    row("STAGGER-PRESET", !!p && p.implemented === true && gap >= 40 && gap <= 60 && gap === T.STAGGER_GAP_MS && St.resolveMotionPreset("stagger")?.stagger?.gapMs === gap, "Geometry Animation has a Stagger preset that resolves to a 40 to 60 ms stagger, the same number as STAGGER_GAP_MS", p ? `"${p.label}", implemented ${p.implemented}, gap ${gap} ms, STAGGER_GAP_MS ${T.STAGGER_GAP_MS}` : "no preset with id stagger")
  }

  rmSync(base.dir, { recursive: true, force: true })
}

/* ---- the must-fails ----------------------------------------------------- */
const MUTANTS = [
  { name: "an empty take builds a timed schedule", file: "lib/stroke-timing.ts", find: "if (!isTimedTake(take)) return null", text: "if (false) return null", red: ["IDENTITY"] },
  { name: "stagger gap ignored", file: "lib/stroke-timing.ts", find: "const at = first + starts[k]", text: "const at = first", red: ["STAGGER", "STAGGER-RIPPLE"] },
  { name: "stagger forgets the ripple carry", file: "lib/stroke-timing.ts", find: "const want = at - B0 - (take.ripple ? carry : 0)", text: "const want = at - B0", red: ["STAGGER-RIPPLE"] },
  { name: "stagger writes neutral rows", file: "lib/stroke-timing.ts", find: "strokes[i] = { ...rowOf(take, i), delayMs }", text: "strokes[i] = { ...STROKE_TIMING_NEUTRAL, delayMs }", red: ["STAGGER-KEEP"] },
  { name: "stagger preset at 500 ms", file: "lib/style-system.ts", find: "stagger: { gapMs: 50 }", text: "stagger: { gapMs: 500 }", red: ["STAGGER-PRESET"] },
]

function editFor(src, find, text, file) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${file}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text, was: find }
}

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-schedule-controls-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const src = readFileSync(join(ROOT, m.file), "utf8")
      const edits = [editFor(src, m.find, m.text, m.file)]
      if (m.also) edits.push(editFor(src, m.also.find, m.also.text, m.file))
      const jf = join(dir, "m.json")
      writeFileSync(jf, JSON.stringify({ [m.file]: edits }))
      const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env: { ...process.env, GATE_MUTATE_FILE: jf }, encoding: "utf8", maxBuffer: 1 << 28 })
      const line = (r.stdout || "").split("\n").find((l) => l.startsWith("ROWS_JSON "))
      if (!line) {
        note = `child did not finish (exit ${r.status}): ${(r.stderr || "").trim().split("\n").slice(-1)[0]}`
      } else {
        const got = JSON.parse(line.slice(10))
        const red = m.red.filter((id) => got.find((x) => x.id === id && !x.ok))
        const ran = !got.find((x) => x.id === "RUN")
        caught = ran && red.length === m.red.length
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

try {
  await runRows()
} catch (e) {
  row("RUN", false, "the rows ran to completion", String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e))
}
if (ROWS_ONLY) {
  console.log("ROWS_JSON " + JSON.stringify(rows.map(({ id, ok }) => ({ id, ok }))))
  process.exit(rows.every((r) => r.ok) ? 0 : 1)
}
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(15)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught`)
process.exit(pass === rows.length && caught === muts.length ? 0 : 1)
