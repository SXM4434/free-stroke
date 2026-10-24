#!/usr/bin/env node
/* ============================================================================
 * assert-stroke-timing: per-stroke delay, speed, ease, hold back and ripple
 * (`lib/stroke-timing.ts`), phase 1a of
 * `docs/research-2026-09-25/animation-tools/DESIGN.md`. Node only, no browser.
 *
 *   node scripts/verify/assert-stroke-timing.mjs              rows, then every must-fail
 *   node scripts/verify/assert-stroke-timing.mjs --rows-only  rows only (a mutant child runs this)
 *
 * WHAT IT READS. Real reveal keys from the Inflate engine's preview build (the
 * one engine whose Node preview carries `revealKeys`) on the hero word
 * (`scripts/capture/logo-strokes.json`, through `_hero-word.mjs`) and on every
 * engine-node SHAPE. The tip field is `buildTipField` on the same strokes.
 *
 * WHAT IT DOES NOT READ. The viewport: nothing here proves the shader reads the
 * slope channel or that `/` hands the reveal `clock` under a timed take. Those
 * are browser gates and the handback lists them NOT RUN.
 *
 * IDENTITY compares against b0da66626 itself, materialised from git into a
 * temp tree, not against a golden hash. A missing base FAILS; it never skips.
 * Override with STROKE_TIMING_BASE=<rev>.
 *
 * MUST-FAILS. Each mutant is a one-line sabotage applied by `_ts-load.mjs`
 * through GATE_MUTATE_FILE (nothing on disk changes). Offsets are found by
 * unique text at run time, so a mutant whose text is gone FAILS loudly instead
 * of silently catching nothing. A mutant counts as caught only when the child
 * ran to completion AND the named rows went red.
 * ========================================================================== */
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")
const BASE_REV = process.env.STROKE_TIMING_BASE || "b0da66626"

/* ---- the base tree, loaded with NO mutation -------------------------------- */
async function loadBase() {
  const dir = mkdtempSync(join(tmpdir(), "fs-stroke-timing-base-"))
  const tar = execFileSync("git", ["-C", ROOT, "archive", BASE_REV, "lib", "scripts/verify/_ts-load.mjs"], {
    maxBuffer: 1 << 30,
  })
  execFileSync("tar", ["-x", "-C", dir], { input: tar })
  symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"))
  const saved = process.env.GATE_MUTATE_FILE
  delete process.env.GATE_MUTATE_FILE
  try {
    const L = await import(join(dir, "scripts/verify/_ts-load.mjs"))
    return { dir, S: L.loadTs("lib/stroke-schedule.ts"), R: L.loadTs("lib/pen-reveal.ts") }
  } finally {
    if (saved !== undefined) process.env.GATE_MUTATE_FILE = saved
  }
}

/* ---- the rows --------------------------------------------------------------- */
const rows = []
function row(id, ok, what, detail) {
  rows.push({ id, ok: !!ok, what, detail })
}

const sameBytes = (a, b) =>
  a.length === b.length && Buffer.compare(Buffer.from(a.buffer, a.byteOffset, a.byteLength), Buffer.from(b.buffer, b.byteOffset, b.byteLength)) === 0

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
    const n = parts.reduce((s, k) => s + k.length, 0)
    const out = new Float32Array(n)
    let o = 0
    for (const k of parts) (out.set(k, o), (o += k.length))
    return out
  }

  const fixtures = [{ name: "hero", strokes: HW.processedHeroStrokes(), ink: HW.HERO_INK_WIDTH_PX }]
  for (const [name, f] of Object.entries(EN.SHAPES)) fixtures.push({ name, strokes: EN.process(f()), ink: 20 })
  for (const fx of fixtures) fx.keys = buildKeys(fx.strokes)
  const noKeys = fixtures.filter((f) => f.keys.length === 0).map((f) => f.name)
  row("FIXTURES", fixtures[0].keys.length > 0 && noKeys.length < fixtures.length - 1, "the hero and at least one SHAPE carry real reveal keys (the rest cover tip field, coefficients and windows only)", `${fixtures.length} fixtures, ${fixtures.map((f) => `${f.name} ${f.strokes.length}s/${f.keys.length}t`).join(", ")}${noKeys.length ? `; NO KEYS: ${noKeys}` : ""}`)

  /* ── 1 · IDENTITY: no rows, byte for byte against the base ─────────────── */
  const PARAMS = [
    S.DRAW_IN_DEFAULTS,
    { ...S.DRAW_IN_DEFAULTS, order: "reversed" },
    { ...S.DRAW_IN_DEFAULTS, unit: "stroke", order: "random", seed: 3, overlap: 0.4 },
    { ...S.DRAW_IN_DEFAULTS, reverse: "alternate", overlap: 1, align: "end" },
  ]
  const MODES = ["grow", "travel", "vanish", "shrink"]
  let idN = 0
  const idBad = []
  for (const fx of fixtures) {
    for (const [pi, p] of PARAMS.entries()) {
      const sc = S.scheduleFromStrokes(fx.strokes, null, p)
      const sb = base.S.scheduleFromStrokes(fx.strokes, null, p)
      const timed = T.buildTimedSchedule(sc, T.STROKE_TIMING_TAKE_DEFAULTS, { baseMs: 3000 })
      const where = `${fx.name}/p${pi}`
      idN++
      if (timed !== null) idBad.push(`${where}: no-rows take built a timed schedule`)
      const kb = base.S.remapRevealKeys(fx.keys, sb)
      if (!sameBytes(S.remapRevealKeys(fx.keys, sc), kb)) idBad.push(`${where}: remapRevealKeys`)
      if (!sameBytes(T.timedRevealKeys(fx.keys, sc, timed), kb)) idBad.push(`${where}: timedRevealKeys(no rows)`)
      const cb = base.S.scheduleArcCoeffs(sb)
      const cc = S.scheduleArcCoeffs(sc)
      if (!((cb === null && cc === null) || (cb && cc && sameBytes(cb, cc)))) idBad.push(`${where}: scheduleArcCoeffs`)
      const fb = base.R.buildTipField(fx.strokes, fx.ink, 1, cb)
      const fc = R.buildTipField(fx.strokes, fx.ink, 1, cc, null)
      const meta = (f) => JSON.stringify([f.width, f.height, f.minX, f.minY, f.maxX, f.maxY, f.radius, f.totalArc, Object.keys(f).sort()])
      if (!sameBytes(fb.data, fc.data) || meta(fb) !== meta(fc)) idBad.push(`${where}: tip field`)
      if (pi === 0) {
        for (const m of MODES) {
          for (let k = 0; k <= 60; k++) {
            const wp = { ...base.S.REVEAL_WINDOW_DEFAULTS, mode: m, length: 0.3 }
            const ws = { ...wp, length: 0.001 }
            /* The loop-wrap merge (F118 TRAVEL, 2026-09-25) added `wrapLo` to every
             * window. Compare every field the base window carries, and require the
             * new field to say "no wrap" (1) on these non-seamless windows, so the
             * row still sees a value change and also sees a wrong wrapLo. */
            const same = (a, b) => JSON.stringify(a) === JSON.stringify(Object.fromEntries(Object.keys(a).map((key) => [key, b[key]]))) && (b.wrapLo === undefined || b.wrapLo === 1)
            if (!same(base.S.windowAt(wp, k / 60), S.windowAt(wp, k / 60)) ||
                !same(base.S.windowAt(ws, k / 60), S.windowAt(ws, k / 60))) {
              idBad.push(`${where}: windowAt ${m} @${k}/60`)
              break
            }
          }
        }
      }
    }
  }
  row("IDENTITY", idBad.length === 0, `no rows: keys, coefficients, tip field and windows byte-identical to ${BASE_REV}`, `${idN - new Set(idBad.map((s) => s.split(":")[0])).size} of ${idN} fixture x schedule cases identical (x4 artefacts; windows 4 modes x 2 lengths x 61 playheads)${idBad.length ? `; DIFFER: ${idBad.slice(0, 4).join("; ")}` : ""}`)

  /* The positive control: the comparison can see a 1 ms row. */
  {
    const fx = fixtures[0]
    const sc = S.scheduleFromStrokes(fx.strokes, null, S.DRAW_IN_DEFAULTS)
    const timed = T.buildTimedSchedule(sc, { strokes: { 0: { ...T.STROKE_TIMING_NEUTRAL, delayMs: 1 } }, ripple: false }, { baseMs: 3000 })
    const k = T.timedRevealKeys(fx.keys, sc, timed)
    row("IDENTITY+", timed !== null && !sameBytes(k, S.remapRevealKeys(fx.keys, sc)), "positive control: one row with delayMs 1 is NOT byte-identical", `timed=${timed !== null}`)
  }

  /* ── the hero, timed ─────────────────────────────────────────────────────── */
  const hero = fixtures[0]
  const sched = S.scheduleFromStrokes(hero.strokes, null, S.DRAW_IN_DEFAULTS)
  const BASE_MS = 3000
  const n = sched.tracks.length
  const K = 5
  const owner = new Int32Array(hero.keys.length)
  const perStroke = new Array(n).fill(0)
  for (let t = 0; t < hero.keys.length; t++) {
    owner[t] = hero.keys[t] > 1 ? -1 : T.strokeOfArc(sched, hero.keys[t])
    if (owner[t] >= 0) perStroke[owner[t]]++
  }
  const todayMs = Float64Array.from(S.remapRevealKeys(hero.keys, sched), (k) => k * BASE_MS)
  const take = (rowsK, ripple = false, pace) => T.buildTimedSchedule(sched, { strokes: rowsK, ripple }, { baseMs: BASE_MS, pace })
  const keysMs = (ts) => Float64Array.from(T.timedRevealKeys(hero.keys, sched, ts), (k) => k * ts.takeMs)
  const TOL = 0.05 // ms. Float32 keys at ~3.5 s carry ~2e-4 ms.
  const shiftCheck = (ts, expect) => {
    const got = keysMs(ts)
    let bad = 0
    let worst = 0
    let counted = 0
    for (let t = 0; t < got.length; t++) {
      if (owner[t] < 0) continue
      counted++
      const d = Math.abs(got[t] - todayMs[t] - expect(owner[t], t))
      /* Codex crosscheck 2026-09-25: NaN > TOL is false, so a NaN key read as good. */
      if (!Number.isFinite(d)) { bad++; worst = Infinity; continue }
      if (d > worst) worst = d
      if (d > TOL) bad++
    }
    return { bad, worst, counted }
  }
  row("HERO", n === 12 && perStroke[K] > 0 && K < n - 1, `stroke ${K} of the hero is a real, not-last stroke`, `${n} strokes, stroke ${K} owns ${perStroke[K]} of ${hero.keys.length} triangles`)

  /* NEUTRAL: a timed take whose rows move nothing reproduces today's keys. */
  {
    const rowsAll = {}
    for (let i = 0; i < n; i++) rowsAll[i] = { ...T.STROKE_TIMING_NEUTRAL }
    const ts = take(rowsAll)
    const r = shiftCheck(ts, () => 0)
    row("NEUTRAL", r.bad === 0 && Math.abs(ts.takeMs - BASE_MS) < 1e-6, "neutral rows on every stroke reproduce today's keys", `${r.counted - r.bad} of ${r.counted} triangles within ${TOL} ms, worst ${r.worst.toExponential(2)} ms, takeMs ${ts.takeMs}`)
  }

  /* PACE: the hand's pace moves into the keys. Under a non-linear pace, the
   * neutral timed set at clock c is today's set at beat clockToBeat(c). */
  {
    const pace = { beatToClock: (b) => b * b, beatToLanding: (b) => b * b, clockToBeat: (c) => Math.sqrt(c) }
    const ts = take({ 0: { ...T.STROKE_TIMING_NEUTRAL } }, false, pace)
    const kt = T.timedRevealKeys(hero.keys, sched, ts)
    const kd = S.remapRevealKeys(hero.keys, sched)
    let bad = 0
    for (let j = 0; j < 60; j++) {
      const c = (j + 0.37) / 60
      let a = 0
      let b = 0
      for (let t = 0; t < kt.length; t++) {
        if (kt[t] <= c) a++
        if (kd[t] <= pace.clockToBeat(c)) b++
      }
      if (Math.abs(a - b) > 2) bad++
    }
    row("PACE", bad === 0, "under a non-linear pace, neutral timed keys draw today's set at the matching beat", `${60 - bad} of 60 clocks agree within 2 triangles (float32 ties)`)
  }

  /* DELAY */
  {
    const ts = take({ [K]: { ...T.STROKE_TIMING_NEUTRAL, delayMs: 500 } })
    const r = shiftCheck(ts, (s) => (s === K ? 500 : 0))
    row("DELAY", r.bad === 0, `delay 500 ms on stroke ${K} shifts only its keys, by exactly 500 ms`, `${r.counted - r.bad} of ${r.counted} triangles right within ${TOL} ms (worst ${r.worst.toFixed(4)})`)
  }

  /* SPEED */
  {
    const ts = take({ [K]: { ...T.STROKE_TIMING_NEUTRAL, speed: 2 } })
    const B0 = ts.baseSlots[K * 2]
    const B1 = ts.baseSlots[K * 2 + 1]
    const t0 = ts.slots[K * 2]
    const got = keysMs(ts)
    let bad = 0
    let counted = 0
    for (let t = 0; t < got.length; t++) {
      if (owner[t] < 0) continue
      counted++
      const want = owner[t] === K ? t0 + (todayMs[t] - B0) / 2 : todayMs[t]
      if (Math.abs(got[t] - want) > TOL) bad++
    }
    const durOk = Math.abs(ts.slots[K * 2 + 1] - t0 - (B1 - B0) / 2) < 1e-9
    row("SPEED", bad === 0 && durOk, `speed 2 on stroke ${K} halves its duration, others unchanged`, `${counted - bad} of ${counted} triangles right; duration ${(ts.slots[K * 2 + 1] - t0).toFixed(2)} ms vs base ${(B1 - B0).toFixed(2)}`)
  }

  /* HOLD BACK */
  {
    const todayMaxK = Math.max(...Array.from(todayMs).filter((_, t) => owner[t] === K))
    const ts = take({ [K]: { ...T.STROKE_TIMING_NEUTRAL, holdBack: true } })
    const got = keysMs(ts)
    let minK = Infinity
    let maxOther = -Infinity
    for (let t = 0; t < got.length; t++) {
      if (owner[t] < 0) continue
      if (owner[t] === K) minK = Math.min(minK, got[t])
      else maxOther = Math.max(maxOther, got[t])
    }
    const endsLast = Math.abs(ts.slots[K * 2 + 1] - ts.takeMs) < 1e-9
    row("HOLD", todayMaxK < BASE_MS - 1 && minK >= maxOther - TOL && endsLast, `hold back makes stroke ${K} start after every other stroke and end last`, `today it ended at ${todayMaxK.toFixed(1)} of ${BASE_MS} ms; held: first key ${minK.toFixed(1)} ms >= others' last ${maxOther.toFixed(1)} ms; t1 ${ts.slots[K * 2 + 1].toFixed(1)} = takeMs ${ts.takeMs.toFixed(1)}`)
  }

  /* EASE */
  {
    const lin = take({ [K]: { ...T.STROKE_TIMING_NEUTRAL } })
    const ts = take({ [K]: { ...T.STROKE_TIMING_NEUTRAL, ease: { kind: "preset", id: "out" } } })
    const tr = sched.tracks[K]
    const t0 = ts.slots[K * 2]
    const t1 = ts.slots[K * 2 + 1]
    const slotSame = t0 === lin.slots[K * 2] && t1 === lin.slots[K * 2 + 1]
    const endsSame = Math.abs(T.timedArcMsIn(ts, K, tr.from) - t0) < 1e-6 && Math.abs(T.timedArcMsIn(ts, K, tr.to) - t1) < 1e-6
    // the triangle nearest the middle of the stroke's base slot
    const B0 = ts.baseSlots[K * 2]
    const B1 = ts.baseSlots[K * 2 + 1]
    const got = keysMs(ts)
    let best = -1
    let bestD = Infinity
    for (let t = 0; t < got.length; t++) {
      if (owner[t] !== K) continue
      const d = Math.abs((todayMs[t] - B0) / (B1 - B0) - 0.5)
      if (d < bestD) (bestD = d), (best = t)
    }
    const w = (todayMs[best] - B0) / (B1 - B0)
    const u = (got[best] - t0) / (t1 - t0)
    const wantU = 1 - Math.cbrt(1 - w) // out = 1-(1-u)^3, inverted
    const shapeOk = Math.abs(u - wantU) < 0.02 && Math.abs(u - w) > 0.1
    const others = shiftCheck(ts, () => 0)
    let otherBad = 0
    for (let t = 0; t < got.length; t++) if (owner[t] >= 0 && owner[t] !== K && Math.abs(got[t] - todayMs[t]) > TOL) otherBad++
    row("EASE", slotSame && endsSame && shapeOk && otherBad === 0, `ease "out" on stroke ${K} bends its key curve and keeps its ends`, `slot kept ${slotSame}, ends kept ${endsSame}; at w=${w.toFixed(3)} u=${u.toFixed(3)} (want ${wantU.toFixed(3)}, linear ${w.toFixed(3)}); other strokes moved: ${otherBad} (of ${others.counted - perStroke[K]})`)
  }

  /* RIPPLE on and off */
  {
    const d = { [K]: { ...T.STROKE_TIMING_NEUTRAL, delayMs: 500 } }
    const later = (s) => sched.tracks[s].start > sched.tracks[K].start
    const nLater = perStroke.reduce((a, c, s) => a + (later(s) ? c : 0), 0)
    const on = shiftCheck(take(d, true), (s) => (s === K || later(s) ? 500 : 0))
    row("RIPPLE-ON", on.bad === 0 && nLater > 0, `ripple on: delay 500 on stroke ${K} moves every later stroke by 500 ms`, `${on.counted - on.bad} of ${on.counted} triangles right; ${nLater} of them in later strokes`)
    const off = shiftCheck(take(d, false), (s) => (s === K ? 500 : 0))
    row("RIPPLE-OFF", off.bad === 0, "ripple off (the default): later strokes stay put", `${off.counted - off.bad} of ${off.counted} triangles right`)
    const sp = take({ [K]: { ...T.STROKE_TIMING_NEUTRAL, speed: 2 } }, true)
    const half = (sp.baseSlots[K * 2 + 1] - sp.baseSlots[K * 2]) / 2
    const ons = shiftCheck(sp, (s, t) => (s === K ? -(todayMs[t] - sp.baseSlots[K * 2]) / 2 : later(s) ? -half : 0))
    row("RIPPLE-SPEED", ons.bad === 0, `ripple on: speed 2 on stroke ${K} pulls every later stroke in by half its duration`, `${ons.counted - ons.bad} of ${ons.counted} triangles right; pull ${half.toFixed(2)} ms`)
  }

  /* SLOPE: the tip field's third channel */
  {
    const neutral = take({ [K]: { ...T.STROKE_TIMING_NEUTRAL } })
    const ts = take({ [K]: { ...T.STROKE_TIMING_NEUTRAL, speed: 2 } })
    const fN = R.buildTipField(hero.strokes, hero.ink, 1, null, T.timedTipMap(neutral))
    const fS = R.buildTipField(hero.strokes, hero.ink, 1, null, T.timedTipMap(ts))
    const today = R.buildTipField(hero.strokes, hero.ink, 1, S.scheduleArcCoeffs(sched))
    const expectBase = BASE_MS / neutral.takeMs // |dS/da| at the identity, linear pace
    let arcWorst = 0
    let uniBad = 0
    let uniN = 0
    for (let p = 0; p < fN.data.length / 2; p++) {
      if (!(fN.data[p * 2] < 2)) continue
      arcWorst = Math.max(arcWorst, Math.abs(fN.data[p * 2] - today.data[p * 2]))
      if (fN.slope[p] > 0) (uniN++, Math.abs(fN.slope[p] - expectBase) > 1e-3 && uniBad++)
    }
    const k0 = ts.slots[K * 2] / ts.takeMs
    const k1 = ts.slots[K * 2 + 1] / ts.takeMs
    const inK = []
    const outK = []
    for (let p = 0; p < fS.data.length / 2; p++) {
      const a = fS.data[p * 2]
      if (!(a < 2) || !(fS.slope[p] > 0)) continue
      const f = (a - k0) / (k1 - k0)
      if (f > 0.1 && f < 0.9) inK.push(fS.slope[p])
      else if (a < k0 - 0.02 || a > k1 + 0.02) outK.push(fS.slope[p])
    }
    const med = (v) => (v.sort((x, y) => x - y), v[v.length >> 1])
    const mIn = med(inK)
    const mOut = med(outK)
    const ok =
      !("slope" in today) && arcWorst < 1e-5 && uniBad === 0 && uniN > 0 &&
      Math.abs(mIn / (0.5 * expectBase) - 1) < 0.02 && Math.abs(mOut / expectBase - 1) < 0.02
    row("SLOPE", ok, `tip field slope channel: uniform at neutral, half inside stroke ${K} at speed 2 (half the time per unit of arc)`, `neutral arc vs today worst ${arcWorst.toExponential(2)}, slope uniform ${uniN - uniBad} of ${uniN} texels; speed 2: median ${mIn?.toFixed(4)} on ${inK.length} texels of stroke ${K} (want ${(0.5 * expectBase).toFixed(4)}), ${mOut?.toFixed(4)} on ${outK.length} others (want ${expectBase.toFixed(4)}); shipped field has no slope key: ${!("slope" in today)}`)
  }

  /* CLOCK: export's forward sample = live keys, at 60 clock values */
  {
    const pace = { beatToClock: (b) => b * b, beatToLanding: (b) => b * b, clockToBeat: (c) => Math.sqrt(c) }
    const ts = take(
      {
        [K]: { delayMs: 400, speed: 1.6, ease: { kind: "preset", id: "inOut" }, holdBack: false },
        2: { ...T.STROKE_TIMING_NEUTRAL, holdBack: true, speed: 0.7 },
        8: { ...T.STROKE_TIMING_NEUTRAL, ease: { kind: "bezier", x1: 0.45, y1: 0, x2: 0.2, y2: 1 } },
      },
      true,
      pace,
    )
    const kt = T.timedRevealKeys(hero.keys, sched, ts)
    const q = new Float64Array(hero.keys.length)
    for (let t = 0; t < q.length; t++) {
      if (owner[t] < 0) continue
      const tr = sched.tracks[owner[t]]
      q[t] = tr.to > tr.from ? (hero.keys[t] - tr.from) / (tr.to - tr.from) : 1
    }
    let checked = 0
    let mismatch = 0
    let ties = 0
    let nondet = 0
    for (const mode of ["grow", "travel"]) {
      for (let j = 0; j < 60; j++) {
        const c = (j + 0.37) / 60
        const win = mode === "grow" ? { lo: 0, hi: c } : S.windowAt({ mode: "travel", length: 0.3 }, c)
        const s1 = T.sampleTake(ts, c * ts.takeMs, mode === "grow" ? undefined : win)
        const s2 = T.sampleTake(ts, c * ts.takeMs, mode === "grow" ? undefined : win)
        if (!sameBytes(s1.spans, s2.spans)) nondet++
        for (let t = 0; t < kt.length; t++) {
          if (owner[t] < 0) continue
          checked++
          const live = kt[t] <= win.hi && (win.lo <= 0 || kt[t] > win.lo)
          const f0 = s1.spans[owner[t] * 2]
          const f1 = s1.spans[owner[t] * 2 + 1]
          const exp = q[t] <= f1 && q[t] >= f0 && f1 > 0
          if (live !== exp) {
            const near = Math.min(Math.abs(kt[t] - win.hi), Math.abs(kt[t] - win.lo)) * ts.takeMs
            if (near < 0.05) ties++
            else mismatch++
          }
        }
      }
    }
    row("CLOCK", mismatch === 0 && nondet === 0 && checked > 0, "export's sampleTake(take, clockMs) draws the live keys' set, grow and travel, 60 clocks each", `${checked} triangle x clock checks: ${mismatch} disagree, ${ties} ties within 0.05 ms of an edge, ${nondet} of 120 samples non-deterministic; takeMs ${ts.takeMs.toFixed(1)}`)
  }

  /* REJECT: a row that cannot act is reported, not swallowed. */
  {
    const ts = take({ 40: { ...T.STROKE_TIMING_NEUTRAL, delayMs: 100 }, [K]: { ...T.STROKE_TIMING_NEUTRAL, speed: 0 } })
    row("REJECT", ts.rejected.length === 2, "a row for a missing stroke and a speed of 0 are both reported", `${ts.rejected.length} of 2 reported: ${ts.rejected.join(" | ")}`)
  }

  rmSync(base.dir, { recursive: true, force: true })
}

/* ---- the must-fails ----------------------------------------------------- */
const MUTANTS = [
  { name: "delay dropped", file: "lib/stroke-timing.ts", find: "+ row.delayMs)\n    const t1", text: "+ 0)\n    const t1", red: ["DELAY", "RIPPLE-ON"] },
  { name: "speed read as 1", file: "lib/stroke-timing.ts", find: "return (span > 0 ? span : row.lengthMs ?? 0) / row.speed", text: "return (span > 0 ? span : row.lengthMs ?? 0) / 1", red: ["SPEED", "SLOPE"] },
  { name: "holdBack ignored", file: "lib/stroke-timing.ts", find: "    if (row.holdBack) continue", text: "    if (false) continue", also: { find: "    if (!row.holdBack) continue", text: "    continue" }, red: ["HOLD"] },
  { name: "ease replaced by linear", file: "lib/stroke-timing.ts", find: "const u = e ? easeInverse(e, w) : w", text: "const u = w", red: ["EASE"] },
  { name: "ripple ignored", file: "lib/stroke-timing.ts", find: "(ripple ? carry : 0)", text: "(0)", red: ["RIPPLE-ON", "RIPPLE-SPEED"] },
  { name: "ripple always on", file: "lib/stroke-timing.ts", find: "(ripple ? carry : 0)", text: "(carry)", also: { find: "if (ripple) carry =", text: "carry =" }, red: ["RIPPLE-OFF"] },
  { name: "slope channel read as 1", file: "lib/pen-reveal.ts", find: "Math.abs(arcB - arcA) / (L * invTotal)", text: "1", red: ["SLOPE"] },
  { name: "sampler reads performance.now()", file: "lib/stroke-timing.ts", find: "const hiMs = win ? win.hi * ts.takeMs : clockMs", text: "const hiMs = win ? win.hi * ts.takeMs : (performance.now() % ts.takeMs)", red: ["CLOCK"] },
  { name: "empty take builds a timed schedule", file: "lib/stroke-timing.ts", find: "if (!isTimedTake(take)) return null", text: "if (false) return null", red: ["IDENTITY"] },
  { name: "tip reach moved (shipped path)", file: "lib/pen-reveal.ts", find: "export const TIP_FIELD_REACH = 2.6", text: "export const TIP_FIELD_REACH = 2.7", red: ["IDENTITY"] },
  { name: "window min length moved (shipped path)", file: "lib/stroke-schedule.ts", find: "export const WINDOW_MIN_LENGTH = 0.02", text: "export const WINDOW_MIN_LENGTH = 0.03", red: ["IDENTITY"] },
  { name: "reverse read as off in the key remap", file: "lib/stroke-schedule.ts", find: "return t.reverse ? t.end - (t.end - t.start) * r : t.start + (t.end - t.start) * r", text: "return t.start + (t.end - t.start) * r", red: ["IDENTITY"] },
]

function editFor(src, find, text, file) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${file}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text, was: find }
}

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-stroke-timing-mut-"))
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
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(12)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught`)
process.exit(pass === rows.length && caught === muts.length ? 0 : 1)
