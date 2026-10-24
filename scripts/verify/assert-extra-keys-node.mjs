#!/usr/bin/env node
/* ============================================================================
 * assert-extra-keys-node: key lanes on the draw-in extras (CL-EXTRAKEYS), Node
 * side, no browser. His ruling of 2026-09-26 (docs/rulings/2026-09-26.md,
 * "Keyframe anything"): Tip highlight, Pen pressure and Duration each get a
 * diamond and a lane.
 *
 *   node scripts/verify/assert-extra-keys-node.mjs              rows, then every must-fail
 *   node scripts/verify/assert-extra-keys-node.mjs --rows-only  rows only (a mutant child runs this)
 *
 * ROWS
 *   PATHS      each extra is a key path with its slider's range and step, and none is in the style walk
 *   ROUNDTRIP  a keyed lane saves and reloads through readKeys unchanged; out of range is dropped out loud
 *   TIP        the frame's Tip highlight is the lane's value at the key clock
 *   PRESS      each stroke is pressure-timed at the lane's amount where it starts
 *   DUR        the reveal reads the take at P(t) * takeMs, P(t) = integral of ds / (1000 D(s))
 *   LAND       a keyed Duration lands once; a flat lane at D lands at D seconds
 *   REBASE     a Pen pressure lane edit re-stores performed strokes, as an envelope change does
 *              (CL-EXTRAKEYS3: on the default reveal mode with Overlap 0.3 and a take whose
 *              strokes start light and end firm. At Overlap 0 every base slot sits on a
 *              stroke boundary, which pressure keeps, so nothing moves and the row proved
 *              nothing; the row prints that move too.)
 *   END        while Duration is keyed, the transport ends at the later of its landing and the last key
 *   DIAMONDS   the dock's draw-in controls render one key button for each extra
 *
 * MUST-FAILS. A child runs the rows under one sabotage: `__FS_EXTRA_MUTANT`
 * (the arms in lib/keyframes.ts and lib/clock-rebase.ts), or a source edit
 * applied by `_ts-load.mjs` through GATE_MUTATE_FILE (nothing on disk
 * changes). A mutant counts as caught only when the child ran to completion
 * AND every named row went red. Each row runs on its own, so a mutant that
 * makes one row throw still lets the others report.
 * ========================================================================== */
if (process.env.FS_EXTRA_MUTANT) globalThis.__FS_EXTRA_MUTANT = process.env.FS_EXTRA_MUTANT

import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")

/* ---- source text, read through the same mutant file the loader uses ------- */
function readSrc(rel) {
  let src = readFileSync(join(ROOT, rel), "utf8")
  const f = process.env.GATE_MUTATE_FILE
  if (f) {
    const edits = JSON.parse(readFileSync(f, "utf8"))[rel]
    if (edits) for (const e of [...edits].sort((a, b) => b.pos - a.pos)) src = src.slice(0, e.pos) + e.text + src.slice(e.end)
  }
  return src
}

const rows = []
function check(id, what, fn) {
  try {
    const { ok, detail } = fn()
    rows.push({ id, ok: !!ok, what, detail })
  } catch (e) {
    rows.push({ id, ok: false, what, detail: `threw: ${String((e && e.message) || e).split("\n")[0]}` })
  }
}
const J = JSON.stringify
const near = (a, b, eps = 1e-6) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= eps
const f3 = (x) => (Number.isFinite(x) ? x.toFixed(3) : String(x))
/** Deep equal with keys in any order. */
function same(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  return J(ka) === J(kb) && ka.every((k) => same(a[k], b[k]))
}

const TIP = "envelope.tipHighlight"
const PRESS = "envelope.pressureReveal"
const DUR = "envelope.durationSeconds"

function runRows() {
  const K = loadTs("lib/keyframes.ts")
  const D = loadTs("lib/doc-store.ts")
  const T = loadTs("lib/stroke-timing.ts")
  const C = loadTs("lib/clock-rebase.ts")
  const PRS = loadTs("lib/pressure-reveal.ts")
  const key = (t, v, hold = false) => (hold ? { ...K.makeKey(t, v), easeOut: "hold" } : K.makeKey(t, v))
  /* A hold lane, so P(t) has a closed form: 2 s until 1 s, then 4 s. P(t) is
   * t / 2000 to 1000 ms, then 0.5 + (t - 1000) / 4000, and lands at 3000 ms. */
  const HOLD = { [DUR]: [key(0, 2, true), key(1000, 4, true)] }
  const P_HOLD = (t) => (t <= 1000 ? t / 2000 : 0.5 + (t - 1000) / 4000)

  /* ══ PATHS ═══════════════════════════════════════════════════════════════ */
  check("PATHS", "each extra is a key path with its slider's range and step, kept in range, refused out of it, never walked into the style state", () => {
    const WANT = [[TIP, "tipHighlight", 0, 1, 0.05], [PRESS, "pressureReveal", 0, 1, 0.05], [DUR, "durationSeconds", 0.5, 30, 0.5]]
    const got = K.ENVELOPE_KEY_PATHS.map((p) => [p.path, p.field, p.min, p.max, p.step])
    const bad = []
    if (J(got) !== J(WANT)) bad.push(`list ${J(got)}`)
    for (const [path, , min, max] of WANT) {
      if (!K.isKeyPath(path)) bad.push(`${path} is not a key path`)
      const kept = K.validateTrack([key(0, min), key(500, max)], path)
      if (kept.length) bad.push(`${path} refused in range: ${kept[0]}`)
      if (!K.validateTrack([key(0, max + 1)], path).length) bad.push(`${path} accepted ${max + 1}`)
      if (K.KEYABLE_PATHS.some((p) => p.path === path)) bad.push(`${path} is in the style walk`)
    }
    return { ok: bad.length === 0, detail: `${got.length} of 3 paths${bad.length ? `; ${bad.join("; ")}` : "; each keyable, in range kept, out of range refused, none in the style walk"}` }
  })

  /* ══ ROUNDTRIP ═══════════════════════════════════════════════════════════ */
  check("ROUNDTRIP", "a keyed lane on each extra saves and reloads unchanged with no repair; an out-of-range lane is dropped out loud", () => {
    const LANES = { [TIP]: [key(0, 0.2), key(1000, 0.8)], [PRESS]: [key(0, 0.3), key(1200, 1)], [DUR]: [key(0, 2), key(1500, 6)] }
    const r1 = []
    const back = D.readKeys(JSON.parse(J(LANES)), r1)
    const kept = same(back, LANES) && r1.length === 0
    const s = D.validateSession(JSON.parse(J({ ...D.defaultSession(), keys: LANES })))
    const session = same(s.session.keys, LANES)
    const r2 = []
    const out = D.readKeys(JSON.parse(J({ ...LANES, [TIP]: [key(0, 1.2)], [DUR]: [key(0, 0)] })), r2)
    const dropped = out?.[TIP] === undefined && out?.[DUR] === undefined && same(out?.[PRESS], LANES[PRESS])
    const loud = r2.some((x) => x.includes(TIP)) && r2.some((x) => x.includes(DUR))
    return {
      ok: kept && session && dropped && loud,
      detail: `readKeys kept ${kept} (${r1.length} repairs); session reload kept ${session}; Tip 1.2 and Duration 0 dropped ${dropped}, said out loud ${loud} (${r2.length} repairs)`,
    }
  })

  /* The dock passes no Field wrapper. Render its real component inside the
   * page's take provider, with the component's own envelope provider in place.
   * Count buttons, not only key paths or wrappers. */
  check("DIAMONDS", "the dock renders one key button for Tip highlight, Pen pressure, and Duration", () => {
    const { DrawInTimingControls } = loadTs("components/draw-in-timing-controls.tsx")
    const { StrokeTakeProvider } = loadTs("components/stroke-strip.tsx")
    const doc = D.defaultSession()
    const props = {
      drawIn: doc.drawIn, revealWindow: doc.revealWindow, envelope: doc.revealEnvelope,
      patchDrawIn: () => {}, patchWindow: () => {}, patchEnvelope: () => {},
      strokeCount: 0, drawInUnitCount: 0,
    }
    const html = renderToStaticMarkup(React.createElement(StrokeTakeProvider,
      { take: T.STROKE_TIMING_TAKE_DEFAULTS, timing: doc.revealEnvelope.timing,
        commit: () => {}, keys: undefined, setKeys: () => [], mode: "solid", penMs: 0, strokeCount: 0 },
      React.createElement(DrawInTimingControls, props)))
    const paths = [TIP, PRESS, DUR]
    const counts = paths.map((p) => [p, (html.match(new RegExp(`data-key-button="${p.replaceAll(".", "\\.")}"`, "g")) ?? []).length])
    const total = (html.match(/data-key-button=/g) ?? []).length
    return { ok: total === 3 && counts.every(([, n]) => n === 1),
      detail: `${total} of 3 buttons; ${counts.map(([p, n]) => `${p} ${n} of 1`).join(", ")}` }
  })

  /* ══ TIP ═════════════════════════════════════════════════════════════════ */
  check("TIP", "Tip highlight reads the lane at the key clock; unkeyed it reads the envelope", () => {
    const lane = { [TIP]: [key(0, 0.1), key(1000, 0.7), key(2000, 0.3)] }
    const at = [0, 1000, 2000].map((t) => K.envelopeValueAt("tipHighlight", 0.5, lane, t))
    const mid = K.envelopeValueAt("tipHighlight", 0.5, lane, 500)
    const unkeyed = K.envelopeValueAt("tipHighlight", 0.5, undefined, 1000)
    const wired = readSrc("components/viewport-3d.tsx").includes('envelopeValueAt("tipHighlight"')
    const ok = near(at[0], 0.1) && near(at[1], 0.7) && near(at[2], 0.3) && mid > 0.1 && mid < 0.7 && unkeyed === 0.5 && wired
    return { ok, detail: `at 0, 1000, 2000 ms: ${at.map(f3).join(", ")} (lane 0.1, 0.7, 0.3); at 500 ms ${f3(mid)}; unkeyed ${unkeyed}; viewport reads the lane ${wired}` }
  })

  /* ══ PRESS ═══════════════════════════════════════════════════════════════ */
  check("PRESS", "each stroke is pressure-timed at the lane's amount where it starts on the take's clock", () => {
    const strokes = Array.from({ length: 4 }, (_, i) => ({
      points: Array.from({ length: 30 }, (_, j) => ({ x: j * 3, y: i * 20, t: i * 400 + j * 10, pressure: 0.15 + 0.8 * Math.abs(Math.sin(j * 0.45 + i)) })),
    }))
    const V = [0.3, 0.9, 0.5, 1]
    const lane = { [PRESS]: V.map((v, i) => key(i * 400, v)) }
    const got = T.clockTail(strokes, strokes, false, 1, 0, 0, (s, takeMs) => K.pressureAmountAt(0.6, lane, s, takeMs)).processed
    const ts = (s) => s.points.map((p) => p.t)
    const bad = []
    let differs = 0
    strokes.forEach((s, i) => {
      const want = PRS.pressureTimed([s], V[i])[0]
      if (!ts(got[i]).every((t, j) => near(t, ts(want)[j], 1e-6))) bad.push(`stroke ${i}`)
      if (!ts(want).every((t, j) => near(t, ts(PRS.pressureTimed([s], 0.6)[0])[j], 1e-6))) differs++
    })
    const wired = readSrc("lib/clock-rebase.ts").includes("pressureAmountAt(")
    return {
      ok: bad.length === 0 && differs >= 3 && wired,
      detail: `${strokes.length - bad.length} of ${strokes.length} strokes timed at the lane's amount (${V.join(", ")})${bad.length ? `; wrong: ${bad.join(", ")}` : ""}; ${differs} of ${strokes.length} differ from the unkeyed 0.6; clockStrokesFor reads the lane ${wired}`,
    }
  })

  /* ══ DUR ═════════════════════════════════════════════════════════════════ */
  check("DUR", "the reveal reads the take at P(t) * takeMs under a keyed Duration; a flat lane at D on a D-second take is the identity", () => {
    const takeMs = 5000
    const T5 = [0, 250, 1000, 1800, 3000]
    const got = T5.map((t) => K.revealClockMs(HOLD, t, takeMs))
    const ok1 = T5.every((t, i) => near(got[i], P_HOLD(t) * takeMs, 1e-6))
    const flat = { [DUR]: [key(0, 3)] }
    const F = [0, 700, 1500, 3000]
    const ok2 = F.every((t) => near(K.revealClockMs(flat, t, 3000), t, 1e-6))
    return { ok: ok1 && ok2, detail: `hold lane on a 5 s take at ${T5.join(", ")} ms: ${got.map(f3).join(", ")} (want ${T5.map((t) => f3(P_HOLD(t) * takeMs)).join(", ")}); flat 3 s identity ${ok2}` }
  })

  /* ══ LAND ════════════════════════════════════════════════════════════════ */
  check("LAND", "a keyed Duration lands at exactly one clock; the hold lane at 3000 ms, a flat lane at D at D seconds", () => {
    const hold = K.durationLandingMs(HOLD)
    const flat = K.durationLandingMs({ [DUR]: [key(0, 2.5)] })
    const wild = { [DUR]: [key(0, 0.5), key(800, 30), key(2000, 1)] }
    const L = K.durationLandingMs(wild)
    let rising = true
    let crossings = 0
    let prev = -Infinity
    for (let t = 0; t <= 30000; t += 50) {
      const p = K.durationFractionAt(wild, t)
      if (!(p > prev)) rising = false
      if (prev < 1 && p >= 1) crossings++
      prev = p
    }
    const atL = K.durationFractionAt(wild, L)
    const ok = near(hold, 3000, 1e-3) && near(flat, 2500, 1e-3) && rising && crossings === 1 && near(atL, 1, 1e-6) && L >= 500 && L <= 30000
    return { ok, detail: `hold lands ${f3(hold)} ms (want 3000); flat 2.5 s lands ${f3(flat)} ms; uneven lane rises ${rising}, crosses 1 ${crossings} time(s), lands ${f3(L)} ms with P = ${f3(atL)}` }
  })

  /* ══ REBASE ══════════════════════════════════════════════════════════════ */
  check("REBASE", "a Pen pressure lane edit re-stores a performed stroke so it keeps its on-screen slot, and only the edits that re-time strokes do it", () => {
    const P = loadTs("lib/stroke-processing.ts")
    const SS = loadTs("lib/stroke-schedule.ts")
    const GE = loadTs("lib/geometry-engines.ts")
    const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines
    const cs = { ...D.DEFAULT_CANVAS_SETTINGS }
    let t = 0
    const raw = []
    for (const poly of polys) {
      if (poly.length < 2) continue
      raw.push({ points: poly.map((p, j) => { const q = { x: p.x, y: p.y, t, pressure: j < poly.length / 2 ? 0.2 : 0.95 }; t += 12; return q }) })
      t += 60
    }
    const processed = raw.map((r) => P.processStroke(r, cs.spacing, cs.smoothing, cs.preserveCorners))
    const doc = {
      rawStrokes: raw,
      processedStrokes: processed,
      solidParams: { ...GE.DEFAULT_SOLID_PARAMS },
      /* Overlap puts a stroke's start beat inside the stroke before it, where
       * pressure re-times the ink; at 0 every beat is a stroke boundary. */
      drawIn: { ...SS.DRAW_IN_DEFAULTS, overlap: 0.3 },
      revealWindow: { ...SS.REVEAL_WINDOW_DEFAULTS },
      revealEnvelope: { ...SS.REVEAL_ENVELOPE_DEFAULTS },
      keys: undefined,
    }
    const pen = T.penMsOf(raw)
    const lane = { [PRESS]: [key(0, 0.2), key(Math.round(pen / 2), 1), key(Math.round(pen), 0.4)] }
    /** The largest base-slot move, ms, between two key sets on `d`. */
    const slotMove = (a, b, d = doc) => {
      const x = C.clockSlotsOf({ ...d, keys: a }, cs)
      const y = C.clockSlotsOf({ ...d, keys: b }, cs)
      let m = x.length === y.length ? 0 : Infinity
      for (let k = 0; k < x.length; k++) m = Math.max(m, Math.abs(x[k] - y[k]))
      return m
    }
    const flatMove = slotMove(undefined, lane, { ...doc, drawIn: { ...SS.DRAW_IN_DEFAULTS } })
    const B = C.clockSlotsOf(doc, cs)
    const B2 = C.clockSlotsOf({ ...doc, keys: lane }, cs)
    let i = 0
    let moved = -1
    for (let k = 0; k < B.length / 2; k++) {
      const m = Math.max(Math.abs(B2[k * 2] - B[k * 2]), Math.abs(B2[k * 2 + 1] - B[k * 2 + 1]))
      if (m > moved) (moved = m), (i = k)
    }
    const t0 = B[i * 2] + 211
    const t1 = t0 + (B[i * 2 + 1] - B[i * 2]) * 1.4
    const take = T.withPerformed({ strokes: {}, ripple: false }, B, new Map([[i, { t0, t1, performed: [0, 0.3, 0.3, 0.7, 1] }]]))
    const rowsOf = (tk, n) => {
      const out = new Array(n).fill(T.STROKE_TIMING_NEUTRAL)
      for (const k of Object.keys(tk.strokes)) {
        const r = tk.strokes[k]
        out[Number(k)] = { ...r, speed: Number.isFinite(r.speed) && r.speed > 0 ? r.speed : 1, holdBack: !!r.holdBack }
      }
      return out
    }
    const onScreen = (tk, base) => {
      const s = T.placeSlots(rowsOf(tk, base.length / 2), base, tk.ripple)
      return [s[i * 2], s[i * 2 + 1]]
    }
    const before = onScreen(take, B)
    const stale = onScreen(take, B2)
    // The page's own decision: setKeys rebases when keysMoveClock says the edit re-times strokes.
    const rebased = C.keysMoveClock(doc.keys, lane) ? C.rebaseForPatch(take, doc, { keys: lane }, cs) : null
    const after = rebased ? onScreen(rebased, B2) : stale
    const holds = moved > 1 && near(after[0], before[0], 0.01) && near(after[1], before[1], 0.01) && !(near(stale[0], before[0], 0.01) && near(stale[1], before[1], 0.01))
    const tip = { [TIP]: [key(0, 0.5)] }
    const dur = { [DUR]: [key(0, 3)] }
    /* Each edit: the page's decision, what it should be, and whether the base
     * slots really move. An edit that re-times strokes must move them more
     * than 1 ms and rebase; one that does not must leave them exactly where
     * they were and not rebase. */
    const table = [
      ["pressure lane added", undefined, lane, true],
      ["no change", lane, lane, false],
      ["Tip lane added beside pressure", lane, { ...lane, ...tip }, false],
      ["Duration lane added while pressure is keyed", lane, { ...lane, ...dur }, true],
      ["Duration lane added, pressure unkeyed", tip, { ...tip, ...dur }, false],
    ].map(([n, a, b, want]) => [n, C.keysMoveClock(a, b), want, slotMove(a, b)])
    const wrong = table.filter(([, got, want, m]) => got !== want || (want ? !(m > 1) : m !== 0)).map(([n, got, , m]) => `${n}: rebases ${got}, slots move ${f3(m)} ms`)
    const page = readSrc("app/page.tsx")
    const wired = page.includes("!keysMoveClock(docRef.current.keys, keys) ? null : rebaseForClock({ keys })") && page.includes('edit("Keys", key, rebased ? { keys, take: rebased } : { keys })')
    return {
      ok: holds && wrong.length === 0 && wired,
      detail: `Overlap 0.3: stroke ${i} base moved ${f3(moved)} ms (at Overlap 0 ${f3(flatMove)} ms); on screen [${before.map(f3)}] -> [${after.map(f3)}] (un-rebased [${stale.map(f3)}]), rebased ${rebased ? "yes" : "no"}; edits right ${table.length - wrong.length} of ${table.length} (slot moves ${table.map(([, , , m]) => f3(m)).join(", ")} ms)${wrong.length ? ` (wrong: ${wrong.join("; ")})` : ""}; setKeys rebases ${wired}`,
    }
  })

  /* ══ END ═════════════════════════════════════════════════════════════════ */
  check("END", "while Duration is keyed the transport ends at the later of its landing and the last key, not the take's built length", () => {
    const az = { azimuth: [key(0, 0), key(4500, 30)] }
    const cases = [
      ["keyed 3 s landing, 6 s take", K.keyedLengthMs(6000, HOLD), 3000],
      ["landing, a key at 4.5 s, 6 s take", K.keyedLengthMs(6000, { ...HOLD, ...az }), 4500],
      ["landing past a 2 s take", K.keyedLengthMs(2000, HOLD), 3000],
      ["no Duration lane, a key at 4.5 s, 6 s take", K.keyedLengthMs(6000, az), 6000],
      ["no keys, 6 s take", K.keyedLengthMs(6000, undefined), 6000],
    ]
    const wrong = cases.filter(([, got, want]) => !near(got, want, 1e-3)).map(([n, got, want]) => `${n}: ${f3(got)} (want ${want})`)
    const vp = readSrc("components/viewport-3d.tsx")
    const strip = readSrc("components/stroke-strip.tsx")
    const wired = {
      transport: vp.includes("const takeTotal = keyedLengthMs(takeLen, keys)"),
      reveal: vp.includes("durationLandingMs(keys) !== undefined || lengthMs !== takeLen"),
      strip: strip.includes("keyedLengthMs(axisMs, keys)") && strip.includes("keyedLengthMs(takeMs, keys)"),
    }
    const allWired = Object.values(wired).every(Boolean)
    return {
      ok: wrong.length === 0 && allWired,
      detail: `${cases.length - wrong.length} of ${cases.length} lengths right${wrong.length ? `; ${wrong.join("; ")}` : ""}; read by ${Object.entries(wired).map(([k, v]) => `${k} ${v}`).join(", ")}`,
    }
  })
}

/* ---- the must-fails ------------------------------------------------------ */
const MUTANTS = [
  { name: "the dock drops the extra KeySpot", file: "components/draw-in-timing-controls.tsx",
    find: "? <KeySpot path={keys[0]}>{node}</KeySpot>", text: "? node", red: ["DIAMONDS"] },
  { name: "the draw-in envelope provider has no value", file: "components/draw-in-timing-controls.tsx",
    find: "<KeyEnvelopeCtx.Provider value={shown}>", text: "<KeyEnvelopeCtx.Provider value={null}>", red: ["DIAMONDS"] },
  { name: "the keyed value ignored (the draw-in reads the unkeyed field)", env: "extras-unkeyed", red: ["TIP", "PRESS"] },
  { name: "Duration not applied to the reveal", env: "duration-unread", red: ["DUR"] },
  {
    name: "a path dropped from the keyable list (Pen pressure)",
    file: "lib/keyframes.ts",
    find: '  { path: "envelope.pressureReveal", field: "pressureReveal", label: "Pen pressure", min: 0, max: 1, step: 0.05 },\n',
    text: "",
    red: ["PATHS", "ROUNDTRIP"],
  },
  { name: "a pressure lane edit never re-times the clock", env: "pressure-no-rebase", red: ["REBASE"] },
  { name: "setKeys drops the rebased take", file: "app/page.tsx", find: 'edit("Keys", key, rebased ? { keys, take: rebased } : { keys })', text: 'edit("Keys", key, { keys })', red: ["REBASE"] },
  { name: "a keyed Duration still runs the take's built length", env: "duration-takelen", red: ["END"] },
  { name: "the transport ignores the keyed length", file: "components/viewport-3d.tsx", find: "const takeTotal = keyedLengthMs(takeLen, keys)", text: "const takeTotal = Math.max(takeLen, keysEndMs(keys))", red: ["END"] },
]

function editFor(src, find, text, file) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${file}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text, was: find }
}

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-extra-keys-mut-"))
  for (const m of MUTANTS) {
    let caught = false
    let note = ""
    try {
      const env = { ...process.env }
      delete env.FS_EXTRA_MUTANT
      delete env.GATE_MUTATE_FILE
      if (m.env) env.FS_EXTRA_MUTANT = m.env
      if (m.file) {
        const jf = join(dir, "m.json")
        writeFileSync(jf, J({ [m.file]: [editFor(readFileSync(join(ROOT, m.file), "utf8"), m.find, m.text, m.file)] }))
        env.GATE_MUTATE_FILE = jf
      }
      const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env, encoding: "utf8", maxBuffer: 1 << 28 })
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
  rows.push({ id: "RUN", ok: false, what: "the rows ran to completion", detail: String(e && e.stack ? e.stack.split("\n").slice(0, 3).join(" / ") : e) })
}
if (ROWS_ONLY) {
  console.log("ROWS_JSON " + J(rows.map(({ id, ok }) => ({ id, ok }))))
  process.exit(rows.every((r) => r.ok) ? 0 : 1)
}
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(10)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught`)
process.exit(pass === rows.length && caught === muts.length ? 0 : 1)
