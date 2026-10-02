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
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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

  /* ---- WIRING: what the page hands rebaseForClock ------------------------ */
  {
    const page = readSrc("app/page.tsx")
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

/* ---- the must-fails ----------------------------------------------------------- */
const MUTANTS = [
  { name: "the nib test never fires", file: "lib/clock-rebase.ts", find: "return !!patch.solidParams && clockNibOf", replace: "return false && clockNibOf", rows: ["F1-THICK"] },
  { name: "the rebase reads the old strokes on the new clock", file: "lib/clock-rebase.ts", find: "const next: ClockDoc = { ...doc, ...patch }", replace: "const next: ClockDoc = { ...doc, ...patch, processedStrokes: doc.processedStrokes }", rows: ["F1-REPROCESS"] },
  { name: "edit skips the nib rebase", file: "app/page.tsx", find: "patchMovesNib(docRef.current, patch)", replace: "false", rows: ["W1-EDIT"] },
  { name: "handleReprocessed writes the strokes only", file: "app/page.tsx", find: "rebaseForClock({ processedStrokes: processed })", replace: "null", rows: ["W1-REPROCESS"] },
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
