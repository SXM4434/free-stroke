#!/usr/bin/env node
/* ============================================================================
 * assert-drawin-extras-node: the draw-in extras, Node side, no browser.
 * Coverage items 10 and 11 of docs/research-2026-09-26/animation-asks-coverage.md
 * (rows 15, 19, 41, 42, 47).
 *
 *   node scripts/verify/assert-drawin-extras-node.mjs              rows, then every must-fail
 *   node scripts/verify/assert-drawin-extras-node.mjs --rows-only  rows only (a mutant child runs this)
 *
 * WHAT IT READS. lib/ through `_ts-load.mjs`: the envelope defaults, the
 * shipped draw-in presets and `presetFields`, `validateSession`, the schedule
 * and reveal math on the hero word (`_hero-word.mjs`), and each extra's own
 * module. The two React files (the control in
 * components/draw-in-timing-controls.tsx, the Customize key list in
 * components/style-panel-scaffold.tsx) cannot run here, so their rows read the
 * source text for the wrapped control and the listed key. That proves the
 * control is written and listed, not that it renders: the browser rows in
 * assert-drawin-extras.mjs do that, and they are NOT RUN in this lane.
 *
 * OFF IS COMPARED, NEVER REMEMBERED. The base is the unchanged snapshot this
 * branch was cut from, materialised from git into a temp tree (EXTRAS_BASE,
 * default 2cc9e98). A missing base FAILS; it never skips.
 *
 * MUST-FAILS. Each mutant is a small sabotage applied by `_ts-load.mjs` through
 * GATE_MUTATE_FILE (nothing on disk changes); the source-text rows read through
 * the same file. Offsets are found by unique text at run time, so a mutant
 * whose text is gone FAILS loudly. A mutant counts as caught only when the
 * child ran to completion AND every named row went red.
 * ========================================================================== */
import { execFileSync, spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")
const BASE_REV = process.env.EXTRAS_BASE || "2cc9e98"

/* Every extra, its off value, and whether a preset may ship it on. */
const EXTRAS = {
  tipHighlight: 0,
  pressureReveal: 0,
  durationSeconds: 0,
}
const EXTRA_KEYS = Object.keys(EXTRAS)

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

/* ---- the base tree, loaded with NO mutation -------------------------------- */
async function loadBase() {
  const dir = mkdtempSync(join(tmpdir(), "fs-drawin-extras-base-"))
  const tar = execFileSync("git", ["-C", ROOT, "archive", BASE_REV, "lib", "scripts/verify/_ts-load.mjs"], { maxBuffer: 1 << 30 })
  execFileSync("tar", ["-x", "-C", dir], { input: tar })
  symlinkSync(join(ROOT, "node_modules"), join(dir, "node_modules"))
  const saved = process.env.GATE_MUTATE_FILE
  delete process.env.GATE_MUTATE_FILE
  try {
    const L = await import(join(dir, "scripts/verify/_ts-load.mjs"))
    return {
      dir,
      S: L.loadTs("lib/stroke-schedule.ts"),
      T: L.loadTs("lib/stroke-timing.ts"),
      SS: L.loadTs("lib/style-system.ts"),
      D: L.loadTs("lib/doc-store.ts"),
    }
  } finally {
    if (saved !== undefined) process.env.GATE_MUTATE_FILE = saved
  }
}

/* ---- the rows --------------------------------------------------------------- */
const rows = []
function row(id, ok, what, detail) {
  rows.push({ id, ok: !!ok, what, detail })
}
const J = (x) => JSON.stringify(x)
const strip = (o) => Object.fromEntries(Object.entries(o ?? {}).filter(([k]) => !EXTRA_KEYS.includes(k)))
/** Deep equal with keys in any order. */
function same(a, b) {
  if (a === b) return true
  if (typeof a !== typeof b || a === null || b === null || typeof a !== "object") return Number.isNaN(a) && Number.isNaN(b)
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (ArrayBuffer.isView(a)) return ArrayBuffer.isView(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const ka = Object.keys(a).sort()
  const kb = Object.keys(b).sort()
  return J(ka) === J(kb) && ka.every((k) => same(a[k], b[k]))
}
const extrasOff = (env) => EXTRA_KEYS.every((k) => Object.is(env?.[k], EXTRAS[k]))
const DRAW_IN_PRESETS = (SS) => SS.GEOMETRY_ANIMATION_PRESET_DEFS.filter((p) => p.motion?.envelope)
/* Presets this lane adds. Each extra step that adds one names it here. */
const NEW_PRESETS = new Set([])

async function runRows() {
  const S = loadTs("lib/stroke-schedule.ts")
  const T = loadTs("lib/stroke-timing.ts")
  const SS = loadTs("lib/style-system.ts")
  const D = loadTs("lib/doc-store.ts")
  const TH = loadTs("lib/tip-highlight.ts")
  const PR = loadTs("lib/pen-reveal.ts")
  const PRS = loadTs("lib/pressure-reveal.ts")
  const HW = await import("./_hero-word.mjs")
  const base = await loadBase()
  const hero = HW.processedHeroStrokes()

  /* ══ OFF, every extra at once ═══════════════════════════════════════════ */
  {
    const a = S.REVEAL_ENVELOPE_DEFAULTS
    const b = base.S.REVEAL_ENVELOPE_DEFAULTS
    const added = Object.keys(a).filter((k) => !(k in b))
    row("OFF-DEFAULTS", same(strip(a), b) && J(added.sort()) === J([...EXTRA_KEYS].sort()) && extrasOff(a),
      "the envelope defaults are the base's, plus each extra at off and nothing else",
      `added ${J(added)}; extras ${J(Object.fromEntries(EXTRA_KEYS.map((k) => [k, a[k]])))}; rest ${same(strip(a), b) ? "same" : "DIFFERS"}`)
  }
  {
    const bad = []
    const lane = new Map(SS.GEOMETRY_ANIMATION_PRESET_DEFS.map((p) => [p.id, p]))
    for (const bp of base.SS.GEOMETRY_ANIMATION_PRESET_DEFS) {
      const lp = lane.get(bp.id)
      if (!lp) { bad.push(`${bp.id}: gone`); continue }
      const lc = lp.motion?.envelope ? { ...lp, motion: { ...lp.motion, envelope: strip(lp.motion.envelope) } } : lp
      if (!same(lc, bp)) bad.push(`${bp.id}: differs from base past the extras`)
      if (lp.motion?.envelope && !extrasOff(lp.motion.envelope)) bad.push(`${bp.id}: an extra is not off ${J(lp.motion.envelope)}`)
    }
    const extra = [...lane.keys()].filter((id) => !base.SS.GEOMETRY_ANIMATION_PRESET_DEFS.some((p) => p.id === id) && !NEW_PRESETS.has(id))
    if (extra.length) bad.push(`unexpected new presets ${J(extra)}`)
    row("OFF-PRESETS", bad.length === 0, "every shipped draw-in preset is the base's, plus each extra at off",
      `${base.SS.GEOMETRY_ANIMATION_PRESET_DEFS.length} base presets${bad.length ? `; ${bad.slice(0, 4).join("; ")}` : ""}`)
  }
  {
    const docs = {
      default: () => base.D.defaultSession(),
      edited: () => ({ ...base.D.defaultSession(), revealEnvelope: { ...base.S.REVEAL_ENVELOPE_DEFAULTS, rate: 2, clock: "hand", ease: "inOut", delaySeconds: 0.6 } }),
      "no envelope": () => { const d = { ...base.D.defaultSession() }; delete d.revealEnvelope; return d },
    }
    const bad = []
    for (const [name, mk] of Object.entries(docs)) {
      const doc = JSON.parse(J(mk()))
      const l = D.validateSession(JSON.parse(J(doc)))
      const b = base.D.validateSession(JSON.parse(J(doc)))
      const ls = { ...l.session, revealEnvelope: strip(l.session.revealEnvelope) }
      if (!same(JSON.parse(J(ls)), JSON.parse(J(b.session)))) bad.push(`${name}: session differs past the extras`)
      if (!extrasOff(l.session.revealEnvelope)) bad.push(`${name}: extras not off ${J(l.session.revealEnvelope)}`)
      if (J(l.repairs) !== J(b.repairs)) bad.push(`${name}: repairs ${J(l.repairs)} vs base ${J(b.repairs)}`)
    }
    row("OFF-DOC", bad.length === 0, "a document from before the extras reads back as the base reads it, each extra off, no new repair",
      `${Object.keys(docs).length} documents${bad.length ? `; ${bad.join("; ")}` : ""}`)
  }
  {
    const bad = []
    const sweep = Array.from({ length: 41 }, (_, k) => k / 40)
    for (const p of [S.DRAW_IN_DEFAULTS, { ...S.DRAW_IN_DEFAULTS, overlap: 0.45 }, { ...S.DRAW_IN_DEFAULTS, reverse: "alternate", overlap: 0.3 }]) {
      const sc = S.scheduleFromStrokes(hero, null, p)
      const sb = base.S.scheduleFromStrokes(hero, null, p)
      if (!same(JSON.parse(J(sc)), JSON.parse(J(sb)))) bad.push(`schedule ${J(p)}`)
      for (const m of ["grow", "travel"]) for (const length of [0.25, 0.01]) {
        const w = { ...S.REVEAL_WINDOW_DEFAULTS, mode: m, length }
        if (!sweep.every((h) => same(S.windowAt(w, h), base.S.windowAt(w, h)))) bad.push(`windowAt ${m} ${length}`)
      }
      const take = { strokes: { 2: { ...T.STROKE_TIMING_NEUTRAL, speed: 2 } }, ripple: false }
      const tl = T.buildTimedSchedule(sc, take, { baseMs: 3000 })
      const tb = base.T.buildTimedSchedule(sb, take, { baseMs: 3000 })
      if (!sweep.every((h) => same(T.sampleTake(tl, h * tl.takeMs).spans, base.T.sampleTake(tb, h * tb.takeMs).spans))) bad.push("sampleTake")
    }
    for (const r of [1, 2, 3.333]) {
      const a = T.rateScaled(hero, r)
      const b = base.T.rateScaled(hero, r)
      if (!same(a.map((s) => s.points), b.map((s) => s.points)) || T.penMsOf(a) !== base.T.penMsOf(b)) bad.push(`rateScaled ${r}`)
    }
    row("OFF-MATH", bad.length === 0, "schedule, window, timed take and rate on the hero word are the base's", bad.length ? bad.slice(0, 4).join("; ") : "3 schedules x 4 windows x 41 playheads, a timed take, 3 rates")
  }
  /* Every extra is a field Customize lists under every draw-in preset. */
  {
    const presets = DRAW_IN_PRESETS(SS)
    const missing = []
    for (const p of presets) for (const k of EXTRA_KEYS) if (!SS.presetFields(p).includes(`envelope.${k}`)) missing.push(`${p.id}:${k}`)
    const scaffold = readSrc("components/style-panel-scaffold.tsx")
    const listBlock = scaffold.slice(scaffold.indexOf("const MOTION_FIELD_KEYS"), scaffold.indexOf("\n]", scaffold.indexOf("const MOTION_FIELD_KEYS")))
    const unlisted = EXTRA_KEYS.filter((k) => !listBlock.includes(`"envelope.${k}"`))
    const dtc = readSrc("components/draw-in-timing-controls.tsx")
    const unwrapped = EXTRA_KEYS.filter((k) => !dtc.includes(`W(["envelope.${k}"]`))
    row("LISTED", presets.length >= 6 && missing.length === 0 && unlisted.length === 0 && unwrapped.length === 0,
      "each extra: presetFields lists it under every draw-in preset, Customize's key list carries it, and its control is wrapped for Customize",
      `${presets.length} draw-in presets x ${EXTRA_KEYS.length} extras${missing.length ? `; presetFields misses ${missing.slice(0, 4)}` : ""}${unlisted.length ? `; MOTION_FIELD_KEYS misses ${unlisted}` : ""}${unwrapped.length ? `; no wrapped control for ${unwrapped}` : ""}`)
  }

  /* One persistence row per 0..1 extra: a value reads back, out of range is
   * clamped and said, a wrong type reads off. */
  const persistRow = (id, key, label) => {
    const bad = []
    const read = (v) => {
      const doc = JSON.parse(J(D.defaultSession()))
      doc.revealEnvelope = { ...doc.revealEnvelope, [key]: v }
      return D.validateSession(doc)
    }
    const r1 = read(0.4)
    if (r1.session.revealEnvelope[key] !== 0.4 || r1.repairs.length) bad.push(`0.4 read as ${r1.session.revealEnvelope[key]} ${J(r1.repairs)}`)
    const r2 = read(5)
    if (r2.session.revealEnvelope[key] !== 1 || !r2.repairs.some((x) => x.includes(key))) bad.push(`5 read as ${r2.session.revealEnvelope[key]} ${J(r2.repairs)}`)
    const r3 = read(-1)
    if (r3.session.revealEnvelope[key] !== 0 || !r3.repairs.some((x) => x.includes(key))) bad.push(`-1 read as ${r3.session.revealEnvelope[key]}`)
    const r4 = read("x")
    if (r4.session.revealEnvelope[key] !== 0) bad.push(`"x" read as ${J(r4.session.revealEnvelope[key])}`)
    row(id, bad.length === 0, `${label} persists: 0.4 reads back 0.4, out of range is clamped and said, a wrong type reads off`, bad.join("; ") || "4 documents")
  }

  /* ══ 1 · TIP HIGHLIGHT ═══════════════════════════════════════════════════ */
  persistRow("TIP-PERSIST", "tipHighlight", "tip highlight")
  /* The reference for where the moving end is, written here from the strokes'
   * own geometry: at window edge `hi` on an identity schedule the reveal has
   * drawn `hi` of the word's total arc, in stroke order. */
  const total = []
  let acc = 0
  for (const s of hero) {
    let L = 0
    for (let j = 1; j < s.points.length; j++) L += Math.hypot(s.points[j].x - s.points[j - 1].x, s.points[j].y - s.points[j - 1].y)
    total.push([acc, acc + L])
    acc += L
  }
  const refEnd = (hi) => {
    const want = hi * acc
    for (let i = 0; i < hero.length; i++) {
      const [a, b] = total[i]
      if (want > a && want < b) {
        let d = want - a
        const pts = hero[i].points
        for (let j = 1; j < pts.length; j++) {
          const seg = Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y)
          if (d <= seg) {
            const f = seg > 0 ? d / seg : 0
            return { stroke: i, x: pts[j - 1].x + f * (pts[j].x - pts[j - 1].x), y: pts[j - 1].y + f * (pts[j].y - pts[j - 1].y) }
          }
          d -= seg
        }
      }
    }
    return null
  }
  const arcTracks = PR.strokeArcSpans(hero).map((a) => ({ start: a.from, end: a.to }))
  const cum = hero.map((s) => TH.cumulativeArc(s.points))
  const headPoint = (h) => TH.pointAtFrac(hero[h.stroke].points, cum[h.stroke], h.frac)
  {
    let worst = 0
    let n = 0
    const bad = []
    for (let k = 1; k < 200; k++) {
      const hi = k / 200
      const want = refEnd(hi)
      if (!want) continue
      const heads = TH.tipHeadsAt({ hi, whole: false, empty: false }, null, arcTracks)
      const h = heads.find((x) => x.stroke === want.stroke)
      if (heads.length !== 1 || !h) { bad.push(`hi ${hi}: ${heads.length} heads`); continue }
      const p = headPoint(h)
      const d = Math.hypot(p.x - want.x, p.y - want.y)
      worst = Math.max(worst, d)
      n++
      if (!(d < 1e-6)) bad.push(`hi ${hi}: ${d.toFixed(3)} px off`)
    }
    row("TIP-ON-END", bad.length === 0 && n > 150, "the glow sits on the moving end: one head, on the stroke being drawn, at the point the reveal has reached",
      `${n} playheads, worst ${worst.toExponential(2)} px against 1e-6${bad.length ? `; ${bad.slice(0, 3).join("; ")}` : ""}`)
  }
  {
    const bad = []
    /* The window's own flags decide, whatever its edge reads. */
    if (TH.tipHeadsAt({ hi: 0.5, whole: true }, null, arcTracks).length) bad.push("whole window has heads")
    if (TH.tipHeadsAt({ hi: 0.5, empty: true }, null, arcTracks).length) bad.push("empty window has heads")
    if (TH.headsFromTracks(arcTracks, 1).length) bad.push("hi 1 has heads")
    if (TH.headsFromTracks(arcTracks, 0).length) bad.push("hi 0 has heads")
    /* Just past each stroke's end: that stroke has landed and carries no head. */
    for (let i = 0; i < arcTracks.length - 1; i++) {
      const hi = arcTracks[i].end + 1e-7
      if (TH.headsFromTracks(arcTracks, hi).some((h) => h.stroke === i)) bad.push(`stroke ${i} still lit after it landed`)
      const lo = arcTracks[i].start - 1e-7
      if (lo > 0 && TH.headsFromTracks(arcTracks, lo).some((h) => h.stroke === i)) bad.push(`stroke ${i} lit before it starts`)
    }
    row("TIP-OUT", bad.length === 0, "no glow before a stroke starts or after it lands, and none on a whole or empty frame", bad.slice(0, 4).join("; ") || `${arcTracks.length} strokes`)
  }
  {
    /* Smooth Reveal's overlap: several strokes draw at once, each lit at its
     * own reach; a reversed track lights its far end. */
    const sc = S.scheduleFromStrokes(hero, null, { ...S.DRAW_IN_DEFAULTS, overlap: 0.45, reverse: "alternate" })
    const tracks = TH.tipTracksOf(sc)
    let multi = 0
    let revSeen = 0
    const bad = []
    if (!tracks) bad.push("overlap schedule read as identity")
    else for (let k = 1; k < 100; k++) {
      const hi = k / 100
      const heads = TH.tipHeadsAt({ hi }, null, tracks)
      const live = tracks.map((t, i) => [t, i]).filter(([t]) => hi > t.start && hi < t.end)
      if (heads.length !== live.length) bad.push(`hi ${hi}: ${heads.length} heads for ${live.length} drawing`)
      if (heads.length > 1) multi++
      for (const h of heads) {
        const t = tracks[h.stroke]
        const reach = (hi - t.start) / (t.end - t.start)
        const want = t.reverse ? 1 - reach : reach
        if (t.reverse) revSeen++
        if (Math.abs(h.frac - want) > 1e-12) bad.push(`hi ${hi} stroke ${h.stroke}: frac ${h.frac} want ${want}`)
      }
    }
    row("TIP-OVERLAP", bad.length === 0 && multi > 0 && revSeen > 0, "with overlap every drawing stroke has its own head, and a reversed stroke lights its far end",
      `${multi} playheads with more than one head, ${revSeen} reversed heads${bad.length ? `; ${bad.slice(0, 3).join("; ")}` : ""}`)
  }
  {
    /* Under a timed take the take's spans decide. A neutral take must light the
     * same heads as the schedule does; one stroke at 2x moves its head. */
    const sc = S.scheduleFromStrokes(hero, null, { ...S.DRAW_IN_DEFAULTS, overlap: 0.45 })
    const rowsAll = {}
    for (let i = 0; i < sc.tracks.length; i++) rowsAll[i] = { ...T.STROKE_TIMING_NEUTRAL }
    const ts = T.buildTimedSchedule(sc, { strokes: rowsAll, ripple: false }, { baseMs: 3000 })
    const bad = []
    for (let k = 1; k < 50; k++) {
      const hi = k / 50
      const sp = T.sampleTake(ts, 0, { lo: 0, hi }).spans
      const a = TH.tipHeadsAt({ hi }, { spans: sp, reversed: (i) => !!ts.base.tracks[i]?.reverse }, sc.tracks)
      const b = TH.headsFromTracks(sc.tracks, hi)
      if (a.length !== b.length || a.some((h, j) => h.stroke !== b[j].stroke || Math.abs(h.frac - b[j].frac) > 1e-6)) bad.push(`hi ${hi}`)
    }
    row("TIP-TIMED", ts !== null && bad.length === 0, "under a timed take the heads come from the take's spans, and a neutral take lights what the schedule lights", bad.slice(0, 4).join(", ") || "49 playheads")
  }

  /* ══ 2 · PRESSURE-AWARE REVEAL ═══════════════════════════════════════════ */
  persistRow("PRESS-PERSIST", "pressureReveal", "pen pressure")
  const withP = (strokes, f) => strokes.map((s) => ({ ...s, points: s.points.map((p, j) => ({ ...p, pressure: f(j, s.points.length) })) }))
  const noP = hero.map((s) => ({ ...s, points: s.points.map(({ pressure, ...p }) => p) }))
  const flatP = withP(hero, () => 0.6)
  const pts = (a) => a.map((s) => s.points)
  {
    /* Off: the clock tail at pressure 0 is the two lines / always ran, on a
     * drawing that carries varying pressure. */
    const varied = withP(hero, (j, n) => (j < n / 2 ? 0.25 : 0.95))
    const bad = []
    for (const hand of [false, true]) for (const r of [1, 2, 3.333]) {
      const t = T.clockTail(varied, varied, hand, r, 0)
      const bp = base.T.rateScaled(varied, r)
      const br = hand ? bp : base.T.rateScaled(varied, r)
      if (!same(pts(t.processed), pts(bp)) || !same(pts(t.raw), pts(br)) || t.pressured) bad.push(`hand ${hand} rate ${r}`)
      if (r === 1 && !(t.processed === varied && t.raw === varied)) bad.push(`rate 1 hand ${hand}: not the same arrays`)
    }
    row("PRESS-OFF", bad.length === 0, "pressure at 0 is the base clock exactly: same arrays at rate 1, the base's rate scaling otherwise, on either clock", bad.join("; ") || "2 clocks x 3 rates, varying pressure on every stroke")
  }
  {
    /* Falls back cleanly: no pressure, or pressure that never varies (a mouse),
     * hands back the same objects, so the clock is main's. */
    const bad = []
    for (const [name, st] of [["no pressure", noP], ["constant 0.6", flatP]]) {
      for (const amt of [0.5, 1]) {
        if (PRS.pressureTimed(st, amt) !== st) bad.push(`${name} @${amt}: a new array`)
        const t = T.clockTail(st, st, false, 1, amt)
        if (t.processed !== st || t.raw !== st || t.pressured) bad.push(`${name} @${amt}: clockTail moved it`)
        const t2 = T.clockTail(st, st, false, 2, amt)
        if (!same(pts(t2.processed), pts(base.T.rateScaled(st, 2)))) bad.push(`${name} @${amt} rate 2: not the base's`)
      }
    }
    /* Mixed: one stroke pressed, the rest not. Only that stroke moves. */
    const mixed = hero.map((s, i) => (i === 3 ? withP([s], (j, n) => (j < n / 2 ? 0.25 : 0.95))[0] : noP[i]))
    const m = PRS.pressureTimed(mixed, 1)
    const moved = m.map((s, i) => s !== mixed[i]).reduce((a, b, i) => (b ? [...a, i] : a), [])
    if (J(moved) !== J([3])) bad.push(`mixed: strokes ${J(moved)} moved, want [3]`)
    row("PRESS-FALLBACK", bad.length === 0, "a stroke with no pressure, or a mouse's constant pressure, plays exactly as recorded at any amount; in a mixed drawing only the pressed stroke moves", bad.join("; ") || "2 inputs x 2 amounts, plus a mixed drawing")
  }
  {
    /* On: pressed lightly in each stroke's first half and hard in the second,
     * the light half goes quicker, so every stroke reaches half its arc in
     * less than its share of time, through clockTail as / calls it. Start and
     * end of every stroke, and so every gap between strokes, stay put. */
    const varied = withP(hero, (j, n) => (j < n / 2 ? 0.25 : 0.95))
    const halfShare = (s) => {
      const c = TH.cumulativeArc(s.points)
      const L = c[c.length - 1]
      const t0 = s.points[0].t
      const t1 = s.points[s.points.length - 1].t
      let j = 0
      while (c[j] < L / 2) j++
      return (s.points[j].t - t0) / (t1 - t0)
    }
    const off = varied.map(halfShare)
    const bad = []
    const shares = {}
    for (const amt of [0.5, 1]) {
      const t = T.clockTail(varied, varied, false, 1, amt)
      if (!t.pressured || t.raw !== t.processed) bad.push(`@${amt}: pressured ${t.pressured}, raw follows ${t.raw === t.processed}`)
      const on = t.processed.map(halfShare)
      shares[amt] = on.reduce((a, b) => a + b, 0) / on.length
      on.forEach((v, i) => { if (!(v < off[i] - 0.02)) bad.push(`@${amt} stroke ${i}: half-arc share ${v.toFixed(3)} vs off ${off[i].toFixed(3)}`) })
      t.processed.forEach((s, i) => {
        const a = varied[i].points
        if (Math.abs(s.points[0].t - a[0].t) > 1e-9 || Math.abs(s.points[s.points.length - 1].t - a[a.length - 1].t) > 1e-9) bad.push(`@${amt} stroke ${i}: start or end moved`)
        for (let j = 1; j < s.points.length; j++) if (!(s.points[j].t >= s.points[j - 1].t)) { bad.push(`@${amt} stroke ${i}: time runs back`); break }
      })
    }
    /* A feather-light touch for most of each stroke and a hard press at the
     * end: the slowest-step floor kicks in, so the stroke only keeps its end
     * because it is scaled back to its recorded length. */
    {
      const skew = withP(hero, (j, n) => (j < n * 0.8 ? 0.01 : 1))
      const t = T.clockTail(skew, skew, false, 1, 1)
      t.processed.forEach((s, i) => {
        const a = skew[i].points
        if (Math.abs(s.points[0].t - a[0].t) > 1e-9 || Math.abs(s.points[s.points.length - 1].t - a[a.length - 1].t) > 1e-9) bad.push(`skewed stroke ${i}: start or end moved`)
        for (let j = 1; j < s.points.length; j++) if (!(s.points[j].t >= s.points[j - 1].t)) { bad.push(`skewed stroke ${i}: time runs back at point ${j}`); break }
      })
    }
    const offMean = off.reduce((a, b) => a + b, 0) / off.length
    if (!(shares[1] < shares[0.5] && shares[0.5] < offMean)) bad.push(`amount does not scale: off ${offMean.toFixed(3)}, 0.5 ${shares[0.5]?.toFixed(3)}, 1 ${shares[1]?.toFixed(3)}`)
    row("PRESS-ON", bad.length === 0, "harder press, slower pen: every stroke reaches half its arc sooner when its first half is light, keeps its start and end, and the amount scales it",
      `mean half-arc share off ${offMean.toFixed(3)}, 0.5 ${shares[0.5]?.toFixed(3)}, 1 ${shares[1]?.toFixed(3)}${bad.length ? `; ${bad.slice(0, 3).join("; ")}` : ""}`)
  }
  {
    /* Wired on /: the clock function reads it before its early return and
     * runs the tail, and the memo re-runs on it. */
    const page = readSrc("app/page.tsx")
    const fn = page.slice(page.indexOf("function clockStrokesFor("), page.indexOf("function baseSlotsFor("))
    const bad = []
    if (!fn.includes("if ((!wantHand && rate === 1 && !(pressure > 0) &&")) bad.push("early return ignores pressure")
    if (!fn.includes("clockTail(processed, raw, wantHand, rate, pressure,")) bad.push("tail does not get pressure")
    if (!fn.includes("const pressure = env.pressureReveal ?? 0")) bad.push("pressure not read from the envelope")
    if (!/revealEnvelope\.rate, revealEnvelope\.pressureReveal[^\]]*\],/.test(page)) bad.push("memo does not re-run on pressure")
    row("PRESS-WIRED", bad.length === 0, "/ reads pen pressure in its clock function, and the clock memo re-runs on it (source text; the browser rows are not run)", bad.join("; ") || "4 checks")
  }

  /* ══ 3 · DURATION ═════════════════════════════════════════════════════════ */
  {
    const bad = []
    const read = (v) => {
      const doc = JSON.parse(J(D.defaultSession()))
      doc.revealEnvelope = { ...doc.revealEnvelope, durationSeconds: v }
      return D.validateSession(doc)
    }
    for (const [v, want, repaired] of [[0, 0, false], [4, 4, false], [S.DURATION_MIN_SECONDS, S.DURATION_MIN_SECONDS, false], [S.DURATION_MAX_SECONDS, S.DURATION_MAX_SECONDS, false], [0.2, 0, true], [31, 0, true], [-3, 0, true], ["x", 0, false]]) {
      const r = read(v)
      const got = r.session.revealEnvelope.durationSeconds
      const said = r.repairs.some((x) => x.includes("durationSeconds"))
      if (got !== want || (repaired && !said)) bad.push(`${J(v)} read as ${J(got)}${repaired && !said ? ", not said" : ""}`)
    }
    row("DUR-PERSIST", bad.length === 0, "duration persists: 0 is off, 0.5 to 30 s read back, anything else reads off and is said", bad.join("; ") || "8 documents")
  }
  {
    const raw = HW.rawHeroStrokes()
    const bad = []
    for (const r of [1, 2]) {
      const t = T.clockTail(hero, raw, false, r, 0, 0)
      if (t.rate !== r || !same(pts(t.processed), pts(base.T.rateScaled(hero, r))) || !same(pts(t.raw), pts(base.T.rateScaled(raw, r)))) bad.push(`rate ${r}`)
    }
    row("DUR-OFF", bad.length === 0, "duration at 0 leaves the rate in charge: the base's clock at rate 1 and 2", bad.join("; ") || "2 rates")
  }
  {
    /* On: the take's length, read off the array `takePenMs` reads (raw), is
     * the duration on the recorded clock, on the hand path and with pressure,
     * whatever the rate pill says. */
    const raw = HW.rawHeroStrokes()
    const varied = withP(hero, (j, n) => (j < n / 2 ? 0.25 : 0.95))
    const bad = []
    const got = []
    const cases = [
      ["recorded", hero, raw, false, 0],
      /* A recording whose resample ends short of it: the take is read off raw. */
      ["raw longer", hero, T.rateScaled(hero, 0.9), false, 0],
      ["hand", hero, hero, true, 0],
      ["pressure", varied, varied, false, 1],
    ]
    for (const [name, p, r0, hand, press] of cases) for (const ms of [2000, 7000]) for (const rate of [1, 2]) {
      const t = T.clockTail(p, r0, hand, rate, press, ms)
      const len = T.penMsOf(t.raw)
      got.push(`${name} ${ms}: ${len.toFixed(3)}`)
      if (Math.abs(len - ms) > 1e-6) bad.push(`${name} ${ms} ms at rate ${rate}: take ${len.toFixed(3)} ms`)
    }
    const pen0 = T.penMsOf(raw)
    row("DUR-ON", bad.length === 0, "the whole draw plays in exactly the set duration on the recorded clock, the hand path and with pressure, whatever the speed pill",
      `recorded take ${pen0.toFixed(1)} ms; ${[...new Set(got)].slice(0, 6).join(", ")}${bad.length ? `; ${bad.slice(0, 3).join("; ")}` : ""}`)
  }
  {
    const page = readSrc("app/page.tsx")
    const fn = page.slice(page.indexOf("function clockStrokesFor("), page.indexOf("function baseSlotsFor("))
    const dtc = readSrc("components/draw-in-timing-controls.tsx")
    const bad = []
    if (!fn.includes("!(pressure > 0) && !(durationMs > 0)) || processedStrokes.length === 0)")) bad.push("early return ignores duration")
    if (!fn.includes("clockTail(processed, raw, wantHand, rate, pressure, durationMs)")) bad.push("tail does not get the duration")
    if (!fn.includes("const durationMs = (env.durationSeconds ?? 0) * 1000")) bad.push("duration not read from the envelope")
    if (!/revealEnvelope\.pressureReveal, revealEnvelope\.durationSeconds, clockNib\],/.test(page)) bad.push("memo does not re-run on duration")
    if (!dtc.includes("disabled={envelope.durationSeconds > 0}")) bad.push("speed pills stay live while duration sets the speed")
    row("DUR-WIRED", bad.length === 0, "/ reads the duration in its clock function and re-runs on it, and the speed pills step aside while it is on (source text; browser rows not run)", bad.join("; ") || "5 checks")
  }

  rmSync(base.dir, { recursive: true, force: true })
}

/* ---- the must-fails ----------------------------------------------------- */
const MUTANTS = [
  /* OFF */
  { name: "an extra defaults on", file: "lib/stroke-schedule.ts", find: "  tipHighlight: 0,\n", text: "  tipHighlight: 0.3,\n", red: ["OFF-DEFAULTS", "OFF-DOC"] },
  { name: "a preset ships an extra on", file: "lib/style-system.ts", find: "  tipHighlight: 0,\n", text: "  tipHighlight: 0.5,\n", red: ["OFF-PRESETS"] },
  { name: "window min length moved", file: "lib/stroke-schedule.ts", find: "export const WINDOW_MIN_LENGTH = 0.02", text: "export const WINDOW_MIN_LENGTH = 0.03", red: ["OFF-MATH"] },
  { name: "Customize key list drops the tip", file: "components/style-panel-scaffold.tsx", find: `"envelope.tipHighlight",`, text: "", red: ["LISTED"] },
  { name: "tip control not wrapped for Customize", file: "components/draw-in-timing-controls.tsx", find: `W(["envelope.tipHighlight"]`, text: `W(["envelope.tipHighlightX"]`, red: ["LISTED"] },
  /* 1 · tip */
  { name: "tip clamp removed", file: "lib/doc-store.ts", find: "if (!(revealEnvelope.tipHighlight >= 0 && revealEnvelope.tipHighlight <= 1)) {", text: "if (false) {", red: ["TIP-PERSIST"] },
  { name: "tip head at half its reach", file: "lib/tip-highlight.ts", find: "const reach = (hi - t.start) / span", text: "const reach = (hi - t.start) / span / 2", red: ["TIP-ON-END", "TIP-OVERLAP"] },
  { name: "tip lit on unstarted and landed strokes", file: "lib/tip-highlight.ts", find: "if (reach > TIP_REACH_EPS && reach < 1 - TIP_REACH_EPS) out.push({ stroke: i, frac: t.reverse", text: "if (reach >= -1 && reach <= 2) out.push({ stroke: i, frac: t.reverse", red: ["TIP-OUT", "TIP-ON-END"] },
  { name: "tip lit on a whole frame", file: "lib/tip-highlight.ts", find: "if (win.whole || win.empty) return []", text: "if (false) return []", red: ["TIP-OUT"] },
  { name: "tip ignores a reversed track", file: "lib/tip-highlight.ts", find: "out.push({ stroke: i, frac: t.reverse ? 1 - reach : reach })", text: "out.push({ stroke: i, frac: reach })", red: ["TIP-OVERLAP"] },
  { name: "timed heads read a strict 0 (float noise lights waiting strokes)", file: "lib/tip-highlight.ts", find: "if (reach > TIP_REACH_EPS && reach < 1 - TIP_REACH_EPS) out.push({ stroke: i, frac: rev", text: "if (reach > 0 && reach < 1) out.push({ stroke: i, frac: rev", red: ["TIP-TIMED"] },
  /* 2 · pressure */
  { name: "pressure clamp removed", file: "lib/doc-store.ts", find: "if (!(revealEnvelope.pressureReveal >= 0 && revealEnvelope.pressureReveal <= 1)) {", text: "if (false) {", red: ["PRESS-PERSIST"] },
  { name: "pressure fallback removed", file: "lib/pressure-reveal.ts", find: `if (knock !== "pressure-no-fallback" && !strokeHasPressure(points)) return points`, text: "if (false) return points", red: ["PRESS-FALLBACK"] },
  { name: "pressure inverted (harder is quicker)", file: "lib/pressure-reveal.ts", find: "(inverted ? 2 - rel : rel)", text: "(2 - rel)", red: ["PRESS-ON"] },
  { name: "stroke not scaled back to its length", file: "lib/pressure-reveal.ts", find: "const k = before / after", text: "const k = 1", red: ["PRESS-ON"] },
  { name: "clockTail ignores pressure", file: "lib/stroke-timing.ts", find: "  if (pressure > 0) {\n    const pt = pressureTimed(processed, pressure)", text: "  if (false) {\n    const pt = pressureTimed(processed, pressure)", red: ["PRESS-ON"] },
  { name: "clockTail runs pressure at 0", file: "lib/stroke-timing.ts", find: "  if (pressure > 0) {\n    const pt = pressureTimed(processed, pressure)", text: "  if (true) {\n    const pt = pressureTimed(processed, pressure || 1)", red: ["PRESS-OFF"] },
  { name: "raw does not follow a pressured clock", file: "lib/stroke-timing.ts", find: "const follows = wantHand || pressured", text: "const follows = wantHand", red: ["PRESS-ON"] },
  { name: "/ early return ignores pressure", file: "app/page.tsx", find: "rate === 1 && !(pressure > 0) &&", text: "rate === 1 &&", red: ["PRESS-WIRED"] },
  { name: "/ memo does not re-run on pressure", file: "app/page.tsx", find: "revealEnvelope.rate, revealEnvelope.pressureReveal, revealEnvelope.durationSeconds, clockNib]", text: "revealEnvelope.rate, revealEnvelope.durationSeconds, clockNib]", red: ["PRESS-WIRED"] },
  /* 3 · duration */
  { name: "duration range check removed", file: "lib/doc-store.ts", find: "if (!(dur === 0 || (dur >= DURATION_MIN_SECONDS && dur <= DURATION_MAX_SECONDS))) {", text: "if (false) {", red: ["DUR-PERSIST"] },
  { name: "duration ignored by the tail", file: "lib/stroke-timing.ts", find: "  if (durationMs > 0) {\n    const pen", text: "  if (false) {\n    const pen", red: ["DUR-ON"] },
  { name: "duration measured on the resample, not the take's array", file: "lib/stroke-timing.ts", find: "const pen = penMsOf(follows ? processed : raw)", text: "const pen = penMsOf(processed)", red: ["DUR-ON"] },
  { name: "duration applied at 0", file: "lib/stroke-timing.ts", find: "  if (durationMs > 0) {\n    const pen", text: "  if (durationMs >= 0) {\n    durationMs = durationMs || 1000\n    const pen", red: ["DUR-OFF"] },
  { name: "/ early return ignores duration", file: "app/page.tsx", find: "!(pressure > 0) && !(durationMs > 0)) || processedStrokes.length === 0)", text: "!(pressure > 0)) || processedStrokes.length === 0)", red: ["DUR-WIRED"] },
  { name: "/ memo does not re-run on duration", file: "app/page.tsx", find: "revealEnvelope.pressureReveal, revealEnvelope.durationSeconds, clockNib]", text: "revealEnvelope.pressureReveal, clockNib]", red: ["DUR-WIRED"] },
  { name: "speed pills live under a duration", file: "components/draw-in-timing-controls.tsx", find: "disabled={envelope.durationSeconds > 0}", text: "disabled={false}", red: ["DUR-WIRED"] },
  { name: "tip ignores the timed take", file: "lib/tip-highlight.ts", find: "if (timed) return headsFromSpans(timed.spans, timed.reversed)", text: "if (timed) return []", red: ["TIP-TIMED"] },
]

function editFor(src, find, text, file) {
  const at = src.indexOf(find)
  if (at < 0 || src.indexOf(find, at + 1) >= 0) throw new Error(`mutant text not unique in ${file}: ${JSON.stringify(find)}`)
  return { pos: at, end: at + find.length, text }
}

function runMutants() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "fs-drawin-extras-mut-"))
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
for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id.padEnd(14)} ${r.what}\n      ${r.detail}`)
const muts = runMutants()
console.log("\nMUST-FAILS (each mutant must turn its rows red)")
for (const m of muts) console.log(`${m.caught ? "CAUGHT" : "MISSED"}  ${m.name}\n      ${m.note}`)
const pass = rows.filter((r) => r.ok).length
const caught = muts.filter((m) => m.caught).length
console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${muts.length} mutants caught`)
process.exit(pass === rows.length && caught === muts.length ? 0 : 1)
