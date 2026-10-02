#!/usr/bin/env node
/* ============================================================================
 * assert-handfix: a stroke he performed by hand stays where he put it
 * (CLOUD-HANDFIX, REVIEW.md "Review 2: Hand Draw phase 3 and carve", findings
 * 1 to 6 and 8). Node only, no browser: `lib/stroke-timing.ts`,
 * `lib/clock-rebase.ts` (the page's clock handlers, moved out so they run
 * here), and the page's and the viewport's wiring read as source.
 *
 *   node scripts/verify/assert-handfix.mjs              rows, then every must-fail
 *   node scripts/verify/assert-handfix.mjs --rows-only  rows only (a mutant child runs this)
 *
 * WHAT IT READS. The logo (`scripts/capture/logo-strokes.json`) injected the
 * way `__styleHarness.injectStrokes` does it (12 ms a point, 60 ms a gap, the
 * call `assert-hand-clock` R6 makes), resampled with the page's default canvas
 * settings. A performed row is written by `withPerformed`, the strip's own
 * call, and a stroke's on-screen slot is `placeSlots`, the build's own walk.
 *
 * WIRING rows read `app/page.tsx` and `components/viewport-3d.tsx` as text:
 * they prove each handler hands `rebaseForClock` the value it writes, not that
 * the page runs. The browser half is `assert-handfix-browser.mjs`.
 *
 * MUST-FAILS. Each mutant is a one-line sabotage applied through
 * GATE_MUTATE_FILE (`_ts-load.mjs` for the TS modules, `readSrc` below for the
 * wiring rows), found by unique text at run time, so a mutant whose text is
 * gone FAILS loudly. A mutant counts as caught only when the child ran to
 * completion AND every row it names went red.
 * ========================================================================== */
import { spawnSync, execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { ROOT, loadTs } from "./_ts-load.mjs"

const SELF = fileURLToPath(import.meta.url)
const ROWS_ONLY = process.argv.includes("--rows-only")

/* ---- source as the wiring rows read it, mutants applied ------------------- */
const MUT = process.env.GATE_MUTATE_FILE ? JSON.parse(readFileSync(process.env.GATE_MUTATE_FILE, "utf8")) : {}
function readSrc(rel) {
  let src = readFileSync(join(ROOT, rel), "utf8")
  for (const e of [...(MUT[rel] || [])].sort((a, b) => b.pos - a.pos)) {
    if (src.slice(e.pos, e.end) !== e.was) throw new Error(`stale mutant offset in ${rel}`)
    src = src.slice(0, e.pos) + e.text + src.slice(e.end)
  }
  return src
}
/** The body of `const name = ...` up to the next line that opens a sibling
 *  declaration at the same indent: enough to ask what one handler calls. */
function bodyOf(src, decl) {
  const at = src.indexOf(decl)
  if (at < 0) return ""
  const indent = src.slice(src.lastIndexOf("\n", at) + 1, at)
  const rest = src.slice(at + decl.length)
  const m = rest.search(new RegExp(`\\n${indent}(const|function|let|/\\*|useEffect)\\b`))
  return m < 0 ? rest : rest.slice(0, m)
}

/* ---- the rows --------------------------------------------------------------- */
const rows = []
function row(id, ok, what, detail) {
  rows.push({ id, ok: !!ok, what, detail })
}
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b))
const fmt = (v) => (Number.isFinite(v) ? v.toFixed(3) : String(v))

async function runRows() {
  const T = loadTs("lib/stroke-timing.ts")
  const C = loadTs("lib/clock-rebase.ts")
  const P = loadTs("lib/stroke-processing.ts")
  const SS = loadTs("lib/stroke-schedule.ts")
  const DS = loadTs("lib/doc-store.ts")
  const GE = loadTs("lib/geometry-engines.ts")

  /* The logo, as `injectStrokes` builds it. */
  const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines
  const cs = { ...DS.DEFAULT_CANVAS_SETTINGS }
  const inject = (msPerPoint = 12, gapMs = 60) => {
    let t = 0
    const raw = []
    for (const poly of polys) {
      if (poly.length < 2) continue
      raw.push({ points: poly.map((p) => { const q = { x: p.x, y: p.y, t, pressure: 0.6 }; t += msPerPoint; return q }) })
      t += gapMs
    }
    return raw
  }
  const raw = inject()
  const processedWith = (c) => raw.map((r) => P.processStroke(r, c.spacing, c.smoothing, c.preserveCorners))
  const processed = processedWith(cs)
  const docOf = (over = {}) => ({
    rawStrokes: raw,
    processedStrokes: processed,
    solidParams: { ...GE.DEFAULT_SOLID_PARAMS },
    drawIn: { ...SS.DRAW_IN_DEFAULTS },
    revealWindow: { ...SS.REVEAL_WINDOW_DEFAULTS },
    revealEnvelope: { ...SS.REVEAL_ENVELOPE_DEFAULTS, clock: "hand", rate: 1 },
    ...over,
  })
  /* Rows as the build reads them. */
  const cleanRows = (take, n) => {
    const out = new Array(n).fill(T.STROKE_TIMING_NEUTRAL)
    for (const k of Object.keys(take.strokes)) {
      const r = take.strokes[k]
      out[Number(k)] = { ...r, speed: Number.isFinite(r.speed) && r.speed > 0 ? r.speed : 1, holdBack: !!r.holdBack }
    }
    return out
  }
  const onScreen = (take, base, i) => {
    const s = T.placeSlots(cleanRows(take, base.length / 2), base, take.ripple)
    return [s[i * 2], s[i * 2 + 1]]
  }
  /** Perform stroke `i` on `doc`'s clock: 211 ms late, 1.4x as long, with a pause. */
  const perform = (doc, i, c = cs, take = { strokes: {}, ripple: false }) => {
    const B = C.clockSlotsOf(doc, c)
    const t0 = B[i * 2] + 211
    const t1 = t0 + (B[i * 2 + 1] - B[i * 2]) * 1.4
    return { B, take: T.withPerformed(take, B, new Map([[i, { t0, t1, performed: [0, 0.3, 0.3, 0.7, 1] }]])) }
  }
  /** One handler's patch through `rebaseForPatch`: the performed stroke keeps
   *  its on-screen slot, the base under it really moved (else the row proves
   *  nothing), and the stored row alone, un-rebased, would have moved it. */
  const holds = (label, doc, patch, i, csAfter = cs, gate = () => true) => {
    const next = { ...doc, ...patch }
    const B2 = C.clockSlotsOf(next, csAfter)
    if (i === "most") {
      // The stroke whose base moves most, so the row is never vacuous by choice of stroke.
      const B = C.clockSlotsOf(doc, cs)
      let best = -1
      for (let k = 0; k < B.length / 2; k++) {
        const m = Math.max(Math.abs(B2[k * 2] - B[k * 2]), Math.abs(B2[k * 2 + 1] - B[k * 2 + 1]))
        if (m > best) (best = m), (i = k)
      }
    }
    const { B, take } = perform(doc, i)
    const before = onScreen(take, B, i)
    const moved = Math.max(Math.abs(B2[i * 2] - B[i * 2]), Math.abs(B2[i * 2 + 1] - B[i * 2 + 1]))
    const stale = onScreen(take, B2, i)
    const rebased = gate() ? C.rebaseForPatch(take, doc, patch, cs, csAfter) : null
    const after = rebased ? onScreen(rebased, B2, i) : stale
    const ok = moved > 1 && near(after[0], before[0]) && near(after[1], before[1]) && !(near(stale[0], before[0]) && near(stale[1], before[1]))
    return {
      ok,
      detail: `${label}: stroke ${i} base moved ${moved.toFixed(1)} ms; on screen [${before.map(fmt)}] -> [${after.map(fmt)}] (un-rebased [${stale.map(fmt)}]), rebased ${rebased ? "yes" : "no"}`,
    }
  }

  /* ---- F1 · Solid Thickness and the reprocess re-stamp the hand clock ---- */
  {
    const doc = docOf()
    const thick = { solidParams: { ...doc.solidParams, thickness: doc.solidParams.thickness + 14 } }
    const nibMoves = C.patchMovesNib(doc, thick)
    const a = holds("Solid Thickness +14", doc, thick, 3, cs, () => nibMoves)
    row("F1-THICK", nibMoves && a.ok, "a Solid Thickness change under Hand keeps a performed stroke's on-screen slot (the edit path rebases it)", `nib moves ${nibMoves}; ${a.detail}`)

    const cs2 = { ...cs, spacing: cs.spacing + 2 }
    const re = { processedStrokes: processedWith(cs2) }
    const b = holds("reprocess spacing 4 -> 6 (Hand)", doc, re, 3, cs2)
    const docRec = docOf({ revealEnvelope: { ...SS.REVEAL_ENVELOPE_DEFAULTS } })
    const c = holds("reprocess spacing 4 -> 6 (Recorded)", docRec, re, 3, cs2)
    const csS = { ...cs, smoothing: !cs.smoothing }
    const d = holds("reprocess smoothing off (Hand)", doc, { processedStrokes: processedWith(csS) }, "most", csS)
    row("F1-REPROCESS", b.ok && c.ok && d.ok, "a spacing or smoothing reprocess keeps a performed stroke's on-screen slot, on either clock", `${b.detail}; ${c.detail}; ${d.detail}`)
  }

  /* ---- F2 · Draw-in and Window move the base slots ----------------------- */
  {
    const doc = docOf({ revealEnvelope: { ...SS.REVEAL_ENVELOPE_DEFAULTS } })
    const a = holds("Draw-in overlap 0 -> 0.3 (Natural)", doc, { drawIn: { ...doc.drawIn, overlap: 0.3 } }, "most")
    const hand = docOf()
    const b = holds("Draw-in overlap 0 -> 0.3 (Hand)", hand, { drawIn: { ...hand.drawIn, overlap: 0.3 } }, "most")
    row("F2-DRAWIN", a.ok && b.ok, "a Draw-in change keeps a performed stroke's on-screen slot", `${a.detail}; ${b.detail}`)
    const c = holds("Window Grow -> Travel (Natural)", doc, { revealWindow: { ...doc.revealWindow, mode: "travel" } }, "most")
    const d = holds("Window Grow -> Travel (Hand)", hand, { revealWindow: { ...hand.revealWindow, mode: "travel" } }, "most")
    row("F2-WINDOW", c.ok && d.ok, "a Window change (Grow to Travel moves the lifts and the pace) keeps a performed stroke's on-screen slot", `${c.detail}; ${d.detail}`)
  }

  /* ---- F3 · the held-back fix and placeSlots' clamp ---------------------- */
  {
    const lin = { kind: "preset", id: "linear" }
    const take = { strokes: { 1: { delayMs: -3500, speed: 1, ease: lin, holdBack: true, performed: [0, 0.5, 1] } }, ripple: false }
    const A = [0, 4600, 4000, 4600]
    const B = [0, 2300, 2000, 2300]
    const before = onScreen(take, A, 1)
    const rb = T.rebasePerformed(take, A, B)
    const after = onScreen(rb, B, 1)
    row("F3-REVIEW", near(after[0], before[0]) && near(after[1], before[1]) && near(before[0], 1100) && near(before[1], 1700),
      "the review's input: stroke 1 held back at delay -3500, swapped to rate 2x, stays at [1100, 1700]",
      `[${before.map(fmt)}] -> [${after.map(fmt)}], row delay ${fmt(rb.strokes[1].delayMs)} speed ${fmt(rb.strokes[1].speed)}`)

    const fz = fuzz(T, cleanRows)
    row("F3-FUZZ", fz.checked > 0 && fz.fail.length === 0,
      `rebasePerformed over ${FUZZ_TAKES.toLocaleString("en-US")} random takes: every performed stroke keeps its on-screen slot`,
      `${fz.takes} takes, ${fz.checked} performed strokes checked (${fz.held} held back, ${fz.clampCases} of those with an old delay that starts them below 0 on the new clock), ${fz.fail.length} moved${fz.fail.length ? ": " + fz.fail.slice(0, 3).map((f) => f.what).join("; ") : ""}`)

    /* THE SAME FUZZ ON THE CODE BEFORE THE FIX, so the instrument is shown to see
     * the defect: `lib/stroke-timing.ts` at the snapshot this branch starts from. */
    const Tb = loadBaseTiming()
    if (!Tb) row("F3-BEFORE", false, "the fuzz fails on the snapshot's rebasePerformed", `no ${BASE_REV}:lib/stroke-timing.ts in this clone`)
    else {
      const fb = fuzz(Tb, cleanRows)
      const allClamp = fb.fail.every((f) => f.clamp)
      row("F3-BEFORE", fb.fail.length > 0 && allClamp,
        `the same ${FUZZ_TAKES.toLocaleString("en-US")} takes on ${BASE_REV}'s rebasePerformed fail, every failure the clamp (the must-fail on the real code)`,
        `${fb.fail.length} moved (${fb.fail.filter((f) => f.held).length} held back, ${fb.fail.filter((f) => !f.held).length} not), ${fb.fail.filter((f) => f.clamp).length} of them on a take where placeSlots clamps a start at 0${fb.fail.length ? "; first: " + fb.fail[0].what : ""}`)
    }
  }

  /* ---- F4 · a slot that is zero-length on one clock ---------------------- */
  {
    const A = [0, 1000, 1000, 2000]
    const B = [0, 500, 900, 900]
    const perf = [0, 0.25, 0.25, 1]
    const cases = []
    for (const held of [false, true]) {
      let take = T.withPerformed({ strokes: {}, ripple: false }, A, new Map([[1, { t0: 1000, t1: 2000, performed: perf }]]))
      if (held) {
        // Held back at 0 lands after stroke 0 ends at 1000: the same [1000, 2000].
        take = { ...take, strokes: { ...take.strokes, 1: { ...take.strokes[1], holdBack: true, delayMs: 0 } } }
      }
      const s0 = onScreen(take, A, 1)
      const toB = T.rebasePerformed(take, A, B)
      const sB = onScreen(toB, B, 1)
      const back = T.rebasePerformed(toB, B, A)
      const sA = onScreen(back, A, 1)
      const r1 = back.strokes[1]
      const ok = near(s0[0], 1000) && near(s0[1], 2000) && near(sB[0], 1000) && near(sB[1], 2000) && near(sA[0], 1000) && near(sA[1], 2000) &&
        Number.isFinite(toB.strokes[1].speed) && Number.isFinite(r1.speed) && near(r1.speed, 1) && near(r1.delayMs, 0) && r1.lengthMs === undefined
      cases.push({ ok, d: `${held ? "held back" : "in sequence"}: [${s0.map(fmt)}] -> zero-span clock [${sB.map(fmt)}] (speed ${fmt(toB.strokes[1].speed)}, length ${toB.strokes[1].lengthMs}) -> back [${sA.map(fmt)}] (delay ${fmt(r1.delayMs)}, speed ${fmt(r1.speed)})` })
    }
    // Performed straight onto the zero-span clock, and the build reads the row.
    const direct = T.withPerformed({ strokes: {}, ripple: false }, B, new Map([[1, { t0: 1200, t1: 1500, performed: perf }]]))
    const sD = onScreen(direct, B, 1)
    const sched = { tracks: [{ from: 0, to: 0.5, start: 0, end: 0.5, reverse: false }, { from: 0.5, to: 1, start: 0.9, end: 0.9, reverse: false }], sig: "f4" }
    const pace = { beatToClock: (b) => b, beatToLanding: (b) => b, clockToBeat: (c) => c }
    const ts = T.buildTimedSchedule(sched, direct, { baseMs: 1000, pace })
    const okD = near(sD[0], 1200) && near(sD[1], 1500) && Number.isFinite(direct.strokes[1].speed) && ts && ts.rejected.length === 0 && near(ts.slots[2], 1200) && near(ts.slots[3], 1500)
    cases.push({ ok: okD, d: `performed on the zero-span clock: [${sD.map(fmt)}], build slot [${ts ? [ts.slots[2], ts.slots[3]].map(fmt) : "none"}], rejected ${ts ? ts.rejected.length : "n/a"}` })
    row("F4-ZERO", cases.every((c) => c.ok), "a slot zero-length on one clock keeps its performed slot there and back, with a finite speed", cases.map((c) => c.d).join("; "))
  }

  /* ---- F5 · the pace is part of the timed schedule's key ------------------ */
  {
    const R = loadTs("lib/pen-reveal.ts")
    const HL = loadTs("lib/hero-letters.ts")
    /* What the stale key costs: the Natural bake's lifts held over the new pace's
     * ink, ms of ink inside a lift the camera turns in. */
    const inkInside = (lifts, ts) => {
      let ms = 0
      for (let k = 0; k + 1 < lifts.length; k += 2) {
        for (let t = lifts[k] + 1; t + 2 <= lifts[k + 1] - 1; t += 2) {
          const a = T.sampleTake(ts, t).spans
          const b = T.sampleTake(ts, t + 2).spans
          if (a.some((v, j) => Math.abs(v - b[j]) > 1e-9)) ms += 2
        }
      }
      return ms
    }
    const parts = []
    for (const clock of ["hand", "recorded"]) {
      const doc = docOf({ revealEnvelope: { ...SS.REVEAL_ENVELOPE_DEFAULTS, clock } })
      const nib = C.clockNibOf(doc)
      const c = C.clockStrokesFor(doc.rawStrokes, doc.processedStrokes, doc.revealEnvelope, nib, cs)
      const strokes = c.processed
      const baseMs = T.penMsOf(c.raw)
      const sched = SS.scheduleFromStrokes(strokes, HL.assignLetters(strokes, nib).of, doc.drawIn)
      const n = sched.tracks.length
      // The viewport's `timed` memo: one +1 ms row on the last stroke.
      const take = { strokes: { [n - 1]: { delayMs: 1, speed: 1, ease: { kind: "preset", id: "linear" }, holdBack: false } }, ripple: false }
      const build = (mode, blend, win) => {
        const lifts = R.liftsLandBetweenStrokes(sched, win)
        return T.buildTimedSchedule(sched, take, { baseMs, pace: T.paceFromCurve((t) => R.revealDistanceFraction(strokes, t, mode, blend, lifts)) })
      }
      const nat = build("hybrid", 0.4, "grow")
      const variants = [["Natural to Authentic", build("raw", 0.4, "grow")], ["Grow to Travel", build("hybrid", 0.4, "travel")], ["hybrid blend 0.4 to 0.7", build("hybrid", 0.7, "grow")]]
      const natLifts = T.takeLiftsMs(nat, nat.pace, nat.baseSlots, nat.baseMs)
      for (const [label, ts] of variants) {
        const lifts = T.takeLiftsMs(ts, ts.pace, ts.baseSlots, ts.baseMs)
        parts.push({ label: `${clock}, ${label}`, differs: ts.sig !== nat.sig, stale: inkInside(natLifts, ts), fresh: inkInside(lifts, ts) })
      }
    }
    row("F5-PACEKEY", parts.every((p) => p.differs && p.fresh === 0) && parts.some((p) => p.stale > 0),
      "a pace-only change under a timed take changes the schedule's key (the tip bake, its lifts and the triangle keys rebuild), and the rebuilt lifts hold no ink",
      parts.map((p) => `${p.label}: key ${p.differs ? "changes" : "SAME"}, ink inside the rebuilt lifts ${p.fresh} ms, inside the stale Natural lifts ${p.stale} ms`).join("; "))
  }

  /* ---- WIRING: what the page hands rebaseForClock ------------------------ */
  {
    const page = readSrc("app/page.tsx")
    const di = bodyOf(page, "const handleDrawInChange = useCallback(")
    row("W2-DRAWIN", /const next = \{ \.\.\.docRef\.current\.drawIn, \.\.\.patch \}/.test(di) && /rebaseForClock\(\{ drawIn: next \}\)/.test(di) && /\{ drawIn: next, take: rebased \}/.test(di),
      "page: handleDrawInChange rebases with the next draw-in and writes both in one edit",
      di ? "read the body of handleDrawInChange" : "no handleDrawInChange in app/page.tsx")
    const wi = bodyOf(page, "const handleRevealWindowChange = useCallback(")
    row("W2-WINDOW", /const next = \{ \.\.\.docRef\.current\.revealWindow, \.\.\.patch \}/.test(wi) && /rebaseForClock\(\{ revealWindow: next \}\)/.test(wi) && /\{ revealWindow: next, take: rebased \}/.test(wi),
      "page: handleRevealWindowChange rebases with the next window and writes both in one edit",
      wi ? "read the body of handleRevealWindowChange" : "no handleRevealWindowChange in app/page.tsx")
    const edit = bodyOf(page, "const edit = useCallback(")
    row("W1-EDIT", /patchMovesNib\(docRef\.current, patch\)/.test(edit) && /rebaseForClock\(patch\)/.test(edit),
      "page: `edit` runs every patch that moves the nib (both Thickness sliders, the geometry presets, the dev dials) through rebaseForClock",
      edit ? "read the body of `edit`" : "no `const edit = useCallback(` in app/page.tsx")
    const rp = bodyOf(page, "const handleReprocessed = useCallback(")
    row("W1-REPROCESS", /rebaseForClock\(\{ processedStrokes: processed \}\)/.test(rp) && /take: rebased/.test(rp),
      "page: handleReprocessed rebases with the strokes it writes, in the same patch",
      rp ? "read the body of handleReprocessed" : "no handleReprocessed in app/page.tsx")
    const memo = bodyOf(page, "const clocked = useMemo(")
    row("W1-CS", /const cs = \{ \.\.\.settingsRef\.current \}/.test(memo) && /clockCsRef\.current = clocked\.cs/.test(page),
      "page: the clock memo keeps the canvas it stamped with, so a reprocess rebases from the resample that played",
      memo ? "read the clock memo" : "no clock memo in app/page.tsx")
  }
}

/* ---- F3's fuzz ---------------------------------------------------------------- */
const FUZZ_TAKES = 14582
const FUZZ_SEED = 20261002
const BASE_REV = process.env.HANDFIX_BASE || "0ad6d79"
function mulberry32(a) {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
/** `rebasePerformed` of `T` on random takes: 2 to 6 strokes, base slots on an
 *  old clock and a new one (a rate and a jitter apart, as a clock or rate swap
 *  moves them), rows with any delay in +-4 s, speeds 0.25 to 4, hold back,
 *  ripple, and a performed pace on some. Every performed stroke's on-screen
 *  slot on the new clock must be its slot on the old one. */
function fuzz(T, cleanRows) {
  const rnd = mulberry32(FUZZ_SEED)
  const pick = (a) => a[Math.floor(rnd() * a.length)]
  const lin = { kind: "preset", id: "linear" }
  const out = { takes: 0, checked: 0, held: 0, clampCases: 0, fail: [] }
  for (let k = 0; k < FUZZ_TAKES; k++) {
    const n = 2 + Math.floor(rnd() * 5)
    const A = new Float64Array(n * 2)
    const B = new Float64Array(n * 2)
    const f = pick([0.3, 0.5, 0.75, 1.3, 2, 3.333])
    for (let i = 0; i < n; i++) {
      const s = Math.round(rnd() * 6000)
      const d = 50 + Math.round(rnd() * 3000)
      A[i * 2] = s
      A[i * 2 + 1] = s + d
      const s2 = Math.max(0, Math.round(s * f + (rnd() * 2 - 1) * 200))
      B[i * 2] = s2
      B[i * 2 + 1] = s2 + Math.max(1, Math.round(d * f * (0.7 + rnd() * 0.6)))
    }
    const take = { strokes: {}, ripple: rnd() < 0.3 }
    for (let i = 0; i < n; i++) {
      if (rnd() >= 0.6) continue
      const r = { delayMs: Math.round((rnd() * 2 - 1) * 4000), speed: pick([0.25, 0.5, 1, 1.5, 2, 4]), ease: lin, holdBack: rnd() < 0.3 }
      if (rnd() < 0.6) r.performed = [0, 0.4, 1]
      take.strokes[i] = r
    }
    out.takes++
    const rb = T.rebasePerformed(take, A, B)
    const was = T.placeSlots(cleanRows(take, n), A, take.ripple)
    const now = T.placeSlots(cleanRows(rb, n), B, take.ripple)
    // Where the old fix would have started each held row before the clamp.
    const from = new Float64Array(n)
    T.placeSlots(cleanRows(rb, n), B, take.ripple, from)
    for (let i = 0; i < n; i++) {
      const r = take.strokes[i]
      if (!r || !r.performed) continue
      out.checked++
      if (r.holdBack) out.held++
      const dt = Math.max(Math.abs(now[i * 2] - was[i * 2]), Math.abs(now[i * 2 + 1] - was[i * 2 + 1]))
      // Touched by the clamp: some start was below 0 before `max(0, ...)` on the old clock,
      // on the new clock with the old rows (what a rebase first reads), or with the new rows.
      const clamp = clampTouched(cleanRows(take, n), A, take.ripple) || clampTouched(cleanRows(take, n), B, take.ripple) || clampTouched(cleanRows(rb, n), B, take.ripple)
      if (r.holdBack && from[i] + r.delayMs < 0) out.clampCases++
      if (!(dt <= 1e-6 * Math.max(1, Math.abs(was[i * 2 + 1])))) {
        out.fail.push({ held: r.holdBack, clamp, what: `take ${k} stroke ${i}${r.holdBack ? " held" : ""}: [${was[i * 2].toFixed(1)}, ${was[i * 2 + 1].toFixed(1)}] -> [${now[i * 2].toFixed(1)}, ${now[i * 2 + 1].toFixed(1)}]` })
      }
    }
  }
  return out
}
/** True when `placeSlots`' walk clamps any start at 0 for these rows. A copy of
 *  the walk, used only to say which failures the clamp touched. */
function clampTouched(rows, base, ripple) {
  const n = base.length / 2
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => base[a * 2] - base[b * 2] || a - b)
  let carry = 0
  let lastEnd = 0
  let hit = false
  for (const i of order) {
    const r = rows[i]
    if (r.holdBack) continue
    const raw = base[i * 2] + (ripple ? carry : 0) + r.delayMs
    if (raw < 0) hit = true
    const t0 = Math.max(0, raw)
    const t1 = t0 + (base[i * 2 + 1] - base[i * 2]) / r.speed
    if (ripple) carry = t1 - base[i * 2 + 1]
    if (t1 > lastEnd) lastEnd = t1
  }
  for (const i of order) {
    const r = rows[i]
    if (!r.holdBack) continue
    const raw = lastEnd + r.delayMs
    if (raw < 0) hit = true
    const t0 = Math.max(0, raw)
    lastEnd = Math.max(lastEnd, t0 + (base[i * 2 + 1] - base[i * 2]) / r.speed)
  }
  return hit
}

/** `lib/stroke-timing.ts` at BASE_REV, loaded beside today's modules (its `@/`
 *  imports resolve to this tree, where they are unchanged). */
function loadBaseTiming() {
  let src
  try {
    src = execFileSync("git", ["-C", ROOT, "show", `${BASE_REV}:lib/stroke-timing.ts`], { encoding: "utf8", maxBuffer: 1 << 26, stdio: ["ignore", "pipe", "ignore"] })
  } catch {
    return null
  }
  const dir = mkdtempSync(join(tmpdir(), "fs-handfix-base-"))
  const f = join(dir, "stroke-timing.ts")
  writeFileSync(f, src)
  try {
    return loadTs(f)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* ---- the must-fails ----------------------------------------------------------- */
const MUTANTS = [
  { name: "the nib test never fires", file: "lib/clock-rebase.ts", find: "return !!patch.solidParams && clockNibOf", replace: "return false && clockNibOf", rows: ["F1-THICK"] },
  { name: "the rebase reads the old strokes on the new clock", file: "lib/clock-rebase.ts", find: "const next: ClockDoc = { ...doc, ...patch }", replace: "const next: ClockDoc = { ...doc, ...patch, processedStrokes: doc.processedStrokes }", rows: ["F1-REPROCESS"] },
  { name: "edit skips the nib rebase", file: "app/page.tsx", find: "patchMovesNib(docRef.current, patch)", replace: "false", rows: ["W1-EDIT"] },
  { name: "handleReprocessed writes the strokes only", file: "app/page.tsx", find: "rebaseForClock({ processedStrokes: processed })", replace: "null", rows: ["W1-REPROCESS"] },
  { name: "handleDrawInChange rebases on the old draw-in", file: "app/page.tsx", find: "rebaseForClock({ drawIn: next })", replace: "rebaseForClock({})", rows: ["W2-DRAWIN"] },
  { name: "handleRevealWindowChange never rebases", file: "app/page.tsx", find: "rebaseForClock({ revealWindow: next })", replace: "null", rows: ["W2-WINDOW"] },
  { name: "the next doc keeps the old draw-in and window", file: "lib/clock-rebase.ts", find: "const next: ClockDoc = { ...doc, ...patch }", replace: "const next: ClockDoc = { ...doc, ...patch, drawIn: doc.drawIn, revealWindow: doc.revealWindow }", rows: ["F2-DRAWIN", "F2-WINDOW"] },
  { name: "the held-back delay is solved from the clamped start again", file: "lib/stroke-timing.ts", find: "delayMs: old[i * 2] - from[i],", replace: "delayMs: r.delayMs + old[i * 2] - placeSlots(clean(out), newBaseSlots, out.ripple)[i * 2],", rows: ["F3-REVIEW", "F3-FUZZ"] },
  { name: "the ripple carry skips strokes with no row again", file: "lib/stroke-timing.ts", find: "const r = strokes[i] ?? STROKE_TIMING_NEUTRAL", replace: "const r = strokes[i] ?? { ...STROKE_TIMING_NEUTRAL, holdBack: true }", rows: ["F3-FUZZ"] },
  { name: "withPerformed skips a zero-span slot again", file: "lib/stroke-timing.ts", find: "    if (f) {\n      /* A zero base span", replace: "    if (f && B1 > B0) {\n      /* A zero base span", rows: ["F4-ZERO"] },
  { name: "placeSlots ignores the row's own length", file: "lib/stroke-timing.ts", find: "return (span > 0 ? span : row.lengthMs ?? 0) / row.speed", replace: "return span / row.speed", rows: ["F4-ZERO"] },
  { name: "the pace is left out of the key", file: "lib/stroke-timing.ts", find: "|r${t.ripple ? 1 : 0}|pace${pace.sig ?? \"?\"}`", replace: "|r${t.ripple ? 1 : 0}`", rows: ["F5-PACEKEY"] },
  { name: "the memo forgets its canvas", file: "app/page.tsx", find: "clockCsRef.current = clocked.cs", replace: "clockCsRef.current = settingsRef.current", rows: ["W1-CS"] },
]

function mutantFile(m) {
  const src = readFileSync(join(ROOT, m.file), "utf8")
  const pos = src.indexOf(m.find)
  if (pos < 0 || src.indexOf(m.find, pos + 1) >= 0) return { error: `text ${pos < 0 ? "not found" : "not unique"}: ${JSON.stringify(m.find)}` }
  return { json: { [m.file]: [{ pos, end: pos + m.find.length, was: m.find, text: m.replace }] } }
}

async function main() {
  try {
    await runRows()
  } catch (e) {
    row("RUN", false, "the rows ran to the end", String(e && e.stack ? e.stack : e))
  }
  if (ROWS_ONLY) {
    process.stdout.write(JSON.stringify(rows) + "\n")
    return
  }
  for (const r of rows) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id}  ${r.what}\n      ${r.detail}`)
  const dir = mkdtempSync(join(tmpdir(), "fs-handfix-"))
  let caught = 0
  for (const m of MUTANTS) {
    const mf = mutantFile(m)
    if (mf.error) {
      console.log(`MISSED  ${m.name}\n      ${mf.error}`)
      continue
    }
    const jf = join(dir, "m.json")
    writeFileSync(jf, JSON.stringify(mf.json))
    const r = spawnSync(process.execPath, [SELF, "--rows-only"], { env: { ...process.env, GATE_MUTATE_FILE: jf }, encoding: "utf8", maxBuffer: 1 << 28 })
    let got = null
    try {
      got = JSON.parse(r.stdout.trim().split("\n").pop())
    } catch {}
    const red = got ? got.filter((x) => !x.ok).map((x) => x.id) : []
    const ran = got && !red.includes("RUN")
    const hit = ran && m.rows.every((id) => red.includes(id))
    if (hit) caught++
    console.log(`${hit ? "CAUGHT" : "MISSED"}  ${m.name}\n      red: ${red.join(", ") || "none"}${ran ? "" : " (the child did not finish: " + (r.stderr || "").slice(-300) + ")"}`)
  }
  rmSync(dir, { recursive: true, force: true })
  const pass = rows.filter((r) => r.ok).length
  console.log(`\n${pass} of ${rows.length} rows pass; ${caught} of ${MUTANTS.length} mutants caught`)
  process.exit(pass === rows.length && caught === MUTANTS.length ? 0 : 1)
}
main()
