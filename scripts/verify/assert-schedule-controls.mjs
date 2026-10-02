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
  /* Delays are whole ms, so a start may sit half a ms off; the 1e-6 is float
   * noise on that half, not room. */
  const HALF_MS = 0.5 + 1e-6

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
    row("STAGGER", worst <= HALF_MS && durBad === 0 && Object.keys(tk.strokes).length === n, "Stagger 50 ms: the k-th stroke in base order starts 50k ms after the first, each keeps its length", `${n} rows written; worst start off by ${worst.toFixed(3)} ms (0.5 allowed, delays are whole ms); ${durBad} lengths changed`)
  }
  {
    const tk = T.withStagger({ strokes: {}, ripple: true }, baseSlots, { gapMs: 50 })
    const ts = build(tk)
    const first = baseSlots[order[0] * 2]
    let worst = 0
    order.forEach((i, k) => (worst = Math.max(worst, Math.abs(ts.slots[i * 2] - (first + 50 * k)))))
    row("STAGGER-RIPPLE", worst <= HALF_MS, "Stagger under Ripple: the carry is taken out, so the starts still fall 50 ms apart", `worst start off by ${worst.toFixed(3)} ms`)
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
    row("STAGGER-KEEP", kept && worst <= HALF_MS && endsLast, "Stagger writes delays only: a row's speed and ease stay, a held-back stroke stays held and out of the count", `speed and ease kept ${kept}; ${rest.length} strokes staggered, worst ${worst.toFixed(3)} ms; held stroke still lands last ${endsLast}`)
  }
  {
    const St = loadTs("lib/style-system.ts")
    const p = St.PRESET_REGISTRY.geometryAnimation.find((x) => x.id === "stagger")
    const gap = p?.motion?.stagger?.gapMs
    row("STAGGER-PRESET", !!p && p.implemented === true && gap >= 40 && gap <= 60 && gap === T.STAGGER_GAP_MS && St.resolveMotionPreset("stagger")?.stagger?.gapMs === gap, "Geometry Animation has a Stagger preset that resolves to a 40 to 60 ms stagger, the same number as STAGGER_GAP_MS", p ? `"${p.label}", implemented ${p.implemented}, gap ${gap} ms, STAGGER_GAP_MS ${T.STAGGER_GAP_MS}` : "no preset with id stagger")
  }

  /* ── THE STAGGER CURVE (coverage row 14) ───────────────────────────────── */
  {
    const m = order.length
    const span = (m - 1) * 50
    const first = baseSlots[order[0] * 2]
    const want = {
      in: (u) => u * u * u,
      out: (u) => 1 - Math.pow(1 - u, 3),
      inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    }
    let worst = 0
    let spread = 0
    const notes = []
    for (const id of ["in", "out", "inOut"]) {
      const ts = build(T.withStagger({ strokes: {}, ripple: false }, baseSlots, { gapMs: 50, ease: { kind: "preset", id } }))
      let w = 0
      order.forEach((i, k) => {
        const u = k / (m - 1)
        w = Math.max(w, Math.abs(ts.slots[i * 2] - (first + span * want[id](u))))
        spread = Math.max(spread, Math.abs(ts.slots[i * 2] - (first + 50 * k)))
      })
      worst = Math.max(worst, w)
      notes.push(`${id} worst ${w.toFixed(3)} ms`)
    }
    row("CURVE", worst <= HALF_MS && spread > 50, "a stagger curve lays the starts along the ease over stroke index (in, out, in-out), not evenly", `${notes.join(", ")} (0.5 allowed); furthest from Even ${spread.toFixed(1)} ms`)
  }
  {
    const first = baseSlots[order[0] * 2]
    const last = first + 50 * (order.length - 1)
    let bad = []
    for (const ease of [{ kind: "preset", id: "in" }, { kind: "preset", id: "inOut" }, { kind: "bezier", x1: 0.3, y1: -0.6, x2: 0.7, y2: 1.6 }]) {
      const ts = build(T.withStagger({ strokes: {}, ripple: true }, baseSlots, { gapMs: 50, ease }))
      const st = order.map((i) => ts.slots[i * 2])
      const what = ease.kind === "preset" ? ease.id : "overshoot curve"
      if (Math.abs(st[0] - first) > HALF_MS || Math.abs(st[st.length - 1] - last) > HALF_MS) bad.push(`${what}: ends ${st[0].toFixed(1)}, ${st[st.length - 1].toFixed(1)}`)
      for (let k = 1; k < st.length; k++) if (st[k] < st[k - 1] - 1) (bad.push(`${what}: start ${k} runs back`), (k = st.length))
    }
    row("CURVE-ENDS", bad.length === 0, "every curve keeps Even's first and last start and never runs a start backwards, overshoot and Ripple included", bad.length ? bad.join("; ") : `first ${first.toFixed(1)} ms, last ${last.toFixed(1)} ms, all starts in order`)
  }

  /* ── REVERSE ONE STROKE (coverage row 31) ──────────────────────────────── */
  const K = 5
  const owner = new Int32Array(hero.keys.length)
  for (let t = 0; t < hero.keys.length; t++) owner[t] = hero.keys[t] > 1 ? -1 : T.strokeOfArc(sched, hero.keys[t])
  const keysMs = (sc, ts) => Float64Array.from(T.timedRevealKeys(hero.keys, sc, ts), (k) => k * ts.takeMs)
  const TOL = 0.05 // ms; float32 keys near 4 s carry about 2e-4 ms
  {
    const tsN = build({ strokes: { [K]: { ...T.STROKE_TIMING_NEUTRAL } }, ripple: false })
    const tsR = build({ strokes: { [K]: { ...T.STROKE_TIMING_NEUTRAL, reverse: true } }, ripple: false })
    const kN = keysMs(sched, tsN)
    const kR = keysMs(sched, tsR)
    const tr = sched.tracks[K]
    let mine = 0, bad = 0, others = 0, othersBad = 0, moved = 0
    for (let t = 0; t < kR.length; t++) {
      if (owner[t] < 0) continue
      if (owner[t] !== K) {
        others++
        if (kR[t] !== kN[t]) othersBad++
        continue
      }
      mine++
      const want = T.timedArcMsIn(tsN, K, tr.to - (hero.keys[t] - tr.from))
      if (!(Math.abs(kR[t] - want) <= TOL)) bad++
      if (Math.abs(kR[t] - kN[t]) > 100) moved++
    }
    const slotSame = tsR.slots[K * 2] === tsN.slots[K * 2] && tsR.slots[K * 2 + 1] === tsN.slots[K * 2 + 1]
    row("REV-KEYS", mine > 0 && bad === 0 && othersBad === 0 && slotSame && moved > mine / 4, `reverse on stroke ${K}: arc a arrives when its mirror did, in the same slot; no other stroke moves`, `${mine - bad} of ${mine} of its triangles on the mirror within ${TOL} ms, ${moved} moved by over 100 ms; ${othersBad} of ${others} others changed; slot kept ${slotSame}`)
  }
  {
    /* Under Direction "all" every track already runs back; the row turns stroke K round again. */
    const all = S.scheduleFromStrokes(hero.strokes, null, { ...S.DRAW_IN_DEFAULTS, reverse: "all" })
    const tsA = T.buildTimedSchedule(all, { strokes: { [K]: { ...T.STROKE_TIMING_NEUTRAL, reverse: true } }, ripple: false }, { baseMs: BASE_MS, pace })
    const tsF = build({ strokes: { [K]: { ...T.STROKE_TIMING_NEUTRAL } }, ripple: false })
    const kA = keysMs(all, tsA)
    const kF = keysMs(sched, tsF)
    let mine = 0, bad = 0
    for (let t = 0; t < kA.length; t++) {
      if (owner[t] !== K) continue
      mine++
      if (!(Math.abs(kA[t] - kF[t]) <= TOL)) bad++
    }
    const sp = T.sampleTake(tsA, (tsA.slots[K * 2] + tsA.slots[K * 2 + 1]) / 2).spans
    const fwd = sp[K * 2] === 0 && sp[K * 2 + 1] > 0 && sp[K * 2 + 1] < 1
    row("REV-DIRECTION", mine > 0 && bad === 0 && fwd, `reverse on top of Direction "all" runs stroke ${K} forward again, keys and spans`, `${mine - bad} of ${mine} keys equal the forward take's within ${TOL} ms; mid-slot span [${sp[K * 2].toFixed(3)}, ${sp[K * 2 + 1].toFixed(3)}] starts at its first point ${fwd}`)
  }
  const revTakes = (sc) => [
    ["direction off", sc, { strokes: { [K]: { delayMs: 300, speed: 1.4, ease: { kind: "preset", id: "inOut" }, holdBack: false, reverse: true }, 8: { ...T.STROKE_TIMING_NEUTRAL, reverse: true, performed: [0, 0.3, 0.3, 1] }, 2: { ...T.STROKE_TIMING_NEUTRAL, holdBack: true, reverse: true } }, ripple: true }],
  ]
  const alt = S.scheduleFromStrokes(hero.strokes, null, { ...S.DRAW_IN_DEFAULTS, reverse: "alternate" })
  const revCases = [...revTakes(sched), ["direction alternate", alt, revTakes(alt)[0][2]]]
  {
    let checked = 0, mismatch = 0, ties = 0
    for (const [, sc, tk] of revCases) {
      const ts = T.buildTimedSchedule(sc, tk, { baseMs: BASE_MS, pace })
      const kt = T.timedRevealKeys(hero.keys, sc, ts)
      for (const mode of ["grow", "travel"]) {
        for (let j = 0; j < 60; j++) {
          const c = (j + 0.37) / 60
          const win = mode === "grow" ? { lo: 0, hi: c } : S.windowAt({ mode: "travel", length: 0.3 }, c)
          const sp = T.sampleTake(ts, c * ts.takeMs, mode === "grow" ? undefined : win).spans
          for (let t = 0; t < kt.length; t++) {
            if (owner[t] < 0) continue
            checked++
            const tr = sc.tracks[owner[t]]
            const q = tr.to > tr.from ? (hero.keys[t] - tr.from) / (tr.to - tr.from) : 1
            const live = kt[t] <= win.hi && (win.lo <= 0 || kt[t] > win.lo)
            const f0 = sp[owner[t] * 2]
            const f1 = sp[owner[t] * 2 + 1]
            const exp = q <= f1 && q >= f0 && f1 > f0
            if (live !== exp) {
              if (Math.min(Math.abs(kt[t] - win.hi), Math.abs(kt[t] - win.lo)) * ts.takeMs < 0.05) ties++
              else mismatch++
            }
          }
        }
      }
    }
    row("REV-CLOCK", checked > 0 && mismatch === 0, "with reversed rows, export's sampleTake draws the live keys' set (grow and travel, 60 clocks, Direction off and alternate)", `${checked} triangle x clock checks: ${mismatch} disagree, ${ties} ties within 0.05 ms of an edge`)
  }
  {
    /* Stroke K held back and reversed, so it draws alone at the end and the
     * front is its own walk, not the max over every stroke still drawing. */
    const margin = 0.02
    const alone = { strokes: { [K]: { ...T.STROKE_TIMING_NEUTRAL, holdBack: true, reverse: true }, 8: { ...T.STROKE_TIMING_NEUTRAL, reverse: true } }, ripple: false }
    let checked = 0, bad = 0, worst = 0
    for (const [, sc, tk] of [["direction off", sched, alone], ["direction alternate", alt, alone]]) {
      const ts = T.buildTimedSchedule(sc, tk, { baseMs: BASE_MS, pace })
      const kt = T.timedRevealKeys(hero.keys, sc, ts)
      const back = (i) => sc.tracks[i].reverse !== !!tk.strokes[i]?.reverse
      for (let j = 1; j < 60; j++) {
        const c = j / 60
        const front = T.timedFront(ts, c * ts.takeMs, margin)
        for (const i of [K, 8]) {
          const tr = sc.tracks[i]
          const len = tr.to - tr.from
          const along = (a) => (back(i) ? tr.to - a : a - tr.from)
          let reached = -1
          for (let t = 0; t < kt.length; t++) if (owner[t] === i && kt[t] <= c) reached = Math.max(reached, along(hero.keys[t]))
          if (reached < 0 || reached >= len) continue
          for (let t = 0; t < kt.length; t++) {
            if (owner[t] !== i) continue
            const d = along(hero.keys[t]) - reached
            if (d <= 0 || d > margin * 0.9) continue
            checked++
            if (kt[t] > front + 1e-7) (bad++, (worst = Math.max(worst, (kt[t] - front) * ts.takeMs)))
          }
        }
      }
    }
    row("REV-FRONT", checked > 0 && bad === 0, `the cull's front walks a reversed stroke from its far end: every triangle within the margin ahead of the pen is submitted`, `${checked} triangle x clock checks on strokes ${K} and 8: ${bad} left out${bad ? `, worst ${worst.toFixed(1)} ms late` : ""}`)
  }

  /* ── SAVED: every new field survives the session reader, and junk is named ── */
  {
    const D = loadTs("lib/doc-store.ts")
    const row0 = { delayMs: 5, speed: 1, ease: { kind: "preset", id: "linear" }, holdBack: false }
    const got = D.validateSession({ take: { strokes: { 1: { ...row0, reverse: true }, 2: { ...row0, reverse: "yes" }, 3: { ...row0 } }, ripple: false } })
    const tk = got.session.take
    const ok = tk.strokes[1].reverse === true && !("reverse" in tk.strokes[2]) && !("reverse" in tk.strokes[3]) && got.repairs.some((r) => r.includes("strokes.2.reverse"))
    row("DOC-REVERSE", ok, "a reversed row survives save and load; a reverse that is not a boolean is read as off and named", `rows ${JSON.stringify(Object.fromEntries(Object.entries(tk.strokes).map(([k, v]) => [k, v.reverse ?? null])))}; repairs: ${got.repairs.join(" | ") || "none"}`)
  }

  rmSync(base.dir, { recursive: true, force: true })
}

/* ---- the must-fails ----------------------------------------------------- */
const MUTANTS = [
  { name: "an empty take builds a timed schedule", file: "lib/stroke-timing.ts", find: "if (!isTimedTake(take)) return null", text: "if (false) return null", red: ["IDENTITY"] },
  { name: "stagger gap ignored", file: "lib/stroke-timing.ts", find: "const at = first + starts[k]", text: "const at = first", red: ["STAGGER", "STAGGER-RIPPLE"] },
  { name: "stagger forgets the ripple carry", file: "lib/stroke-timing.ts", find: "const want = at - B0 - (take.ripple ? carry : 0)", text: "const want = at - B0", red: ["STAGGER-RIPPLE"] },
  { name: "stagger writes neutral rows", file: "lib/stroke-timing.ts", find: "strokes[i] = { ...rowOf(take, i), delayMs }", text: "strokes[i] = { ...STROKE_TIMING_NEUTRAL, delayMs }", red: ["STAGGER-KEEP"] },
  { name: "reverse row ignored by the keys", file: "lib/stroke-timing.ts", find: "scheduleArc(ts.base, ts.flip[i] ? mirrorIn(ts.base.tracks[i], a) : a)", text: "scheduleArc(ts.base, a)", red: ["REV-KEYS", "REV-DIRECTION", "REV-CLOCK"] },
  { name: "reverse row ignored by spans and front", file: "lib/stroke-timing.ts", find: "return ts.base.tracks[i].reverse !== (ts.flip[i] === 1)", text: "return ts.base.tracks[i].reverse", red: ["REV-DIRECTION", "REV-CLOCK", "REV-FRONT"] },
  { name: "reverse row dropped when the rows are read", file: "lib/stroke-timing.ts", find: "if (r.reverse === true) rows[i].reverse = true", text: "", red: ["REV-KEYS", "REV-DIRECTION"] },
  { name: "the session reader drops reverse", file: "lib/doc-store.ts", find: "if (r.reverse === true) strokes[i].reverse = true", text: "if (false) strokes[i].reverse = true", red: ["DOC-REVERSE"] },
  { name: "stagger curve ignored", file: "lib/stroke-timing.ts", find: "const f = easeFnOf(ease)", text: "const f = easeFnOf(undefined)", red: ["CURVE"] },
  { name: "stagger curve read without its clamp", file: "lib/stroke-timing.ts", find: "(m - 1) * gapMs * f(k / (m - 1))", text: "(m - 1) * gapMs * bz(-0.6, 1.6, k / (m - 1))", red: ["CURVE-ENDS"] },
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
