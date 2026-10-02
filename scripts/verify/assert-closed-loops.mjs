/**
 * THE LOOP THE PEN CLOSED MUST STILL BE CLOSED WHEN IT IS DRAWN.
 *
 * F70, 2026-08-28. `endpoint: "protrude"` extends the first anchor BACKWARD
 * along its outgoing segment. On the `D` of "Desk" — one stroke, down the stem,
 * round the bowl, back up and off along the top bar, finishing 6.58 px from
 * where it began — that segment points straight up the stem, so the tail came
 * out ABOVE the top bar as a needle 1 to 4 px wide against a 12 px stem. Both
 * `o`s of "Doodles" carried the same beak. The fix is one flag,
 * `HandFeelSettings.closed`, which had been declared, implemented and READ
 * since the port and was written by nothing.
 *
 * ── WHAT THIS GATE REFUSES TO BE ──────────────────────────────────────────
 *
 * It is NOT "the three gaps got smaller". A gap that shrank could be a wobble
 * seed moving. The rows below are the things that are true of the flag reaching
 * the pass and false of everything else:
 *
 *   A. THE PAGE PUBLISHES ITS OWN ANSWER. `__handFeelHarness.closed` is read
 *      off the live page beside the paths it shaped, so a flag that silently
 *      stopped being set cannot pass as a flag that is set.
 *   B. THE PREDICATE IS THE ENGINE'S, NOT A LIST. The same `closureStateOf`
 *      the Desk Doodles engine runs is recomputed here from the page's own raw
 *      strokes and must agree element for element. A hard-coded letter map, or
 *      a predicate that drifted to a looser bound, turns this red.
 *   C. A CLOSED LOOP STAYS UNDER THE SWEEP'S OWN WRAP BOUND. `gap <= 0.75 x
 *      radius`, with both numbers read out of lib/geometry-engines.ts rather
 *      than typed here, because that bound is what makes Inflate wrap the loop
 *      instead of capping two free ends.
 *   D. NOTHING ELSE MOVED. Every stroke the page calls OPEN must come out
 *      byte-identical to the same stroke processed with the flag omitted:
 *      same point count, every x and y the same finite number (`===`).
 *      2026-09-25: it compared the endpoint gap only, so an interior point
 *      moved 99 units passed. `openStrokeDiff` below, selftested.
 *   E. KNOWN-BAD, AND IT IS THE SHIPPED STATE RATHER THAN A SYNTHETIC ONE.
 *      The same raw strokes through the same `processStroke` with `closed`
 *      omitted is exactly what shipped before the flag. Every loop must come out
 *      OPEN, at the gaps in `OPEN_GAPS_BY_LOOP`. If that arm ever comes back
 *      closed, this gate is measuring nothing and says so instead of passing.
 *
 * ── 2026-09-25 · ROW E IS KEYED BY LETTER NOW, AND IT CAN NO LONGER PASS ON A
 *    MISSING KEY ────────────────────────────────────────────────────────────
 *
 * The table used to be `{ 0: 26.15, 6: 22.77, 7: 29.99 }`, stroke numbers on
 * the 13-stroke trace. The retrace `77a44826b` shipped a 12-stroke word, and two
 * things broke at once:
 *   1. The numbers named the wrong strokes, so the row went red for a reason
 *      that had nothing to do with the loops.
 *   2. Worse, it could have gone GREEN for no reason. `badGaps[i]` exists only
 *      for strokes the engine calls closed. A key that stopped being a loop
 *      gave `undefined`, `Math.abs(NaN - g) > 0.02` is false, and the key
 *      counted as matched. A loop missing from the table was never checked.
 * Now every entry names its letter and the x range it sits in, and the row is
 * a one-to-one match: each closed stroke lands in exactly one entry, each entry
 * holds exactly one closed stroke, and each gap is finite and within 0.02 px.
 * Any other shape is a FAIL that names the stroke or the letter.
 *
 * The four gaps were MEASURED in Node on 2026-09-25 by
 * `docs/research-2026-09-25/gates/probe-closed-loop-gaps.mjs`, which reproduces
 * the old table exactly on the old trace (26.15, 22.77, 29.99). The D of
 * Doodles is new to the table: on the old trace it was `treated-as-closed`,
 * not `closed`, so it was never checked.
 *
 * ── OFFLINE ───────────────────────────────────────────────────────────────
 *
 * Row E needs no browser: every number in it is `processStroke` in Node, and
 * the page's word is the same file (row D checks the count on the page).
 *   node scripts/verify/assert-closed-loops.mjs --offline
 *       row E on the shipped trace. Must pass.
 *   node scripts/verify/assert-closed-loops.mjs --offline --trace=scripts/capture/logo-strokes.before-2026-09-24.json
 *       row E on the old trace. MUST FAIL: other gaps, and no closed D of Doodles.
 *   node scripts/verify/assert-closed-loops.mjs --selftest
 *       the matcher on the shipped gaps with one gap +0.03, one entry removed and
 *       one extra loop. Each must fail, and the untouched copy must pass. Then
 *       row D's point comparison on a real open stroke: 2 must-pass, 6 must-fail.
 * Denominator: 4 closed loops of 12 strokes on the shipped trace.
 *
 * The RENDER evidence is not here and is not meant to be: it lives in
 * `_probe-closedloop-render.mjs` and the AB frames under
 * docs/verification/closedloop-2026-08-28/. This gate is what fails a build.
 */
import { chromium } from "./lib/browser.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"
import { readFileSync } from "node:fs"
import { join, isAbsolute } from "node:path"
import { ROOT, loadTs } from "./_ts-load.mjs"
import {
  rawHeroStrokes,
  HERO_INK_WIDTH_PX,
  PROCESS_SETTINGS,
  HERO_ENDPOINT,
  HERO_WOBBLE_PRESET,
  HERO_PEN_CLOCK,
  HERO_DROP_SUB_NIB_STUBS,
} from "./_hero-word.mjs"

const { processStroke } = loadTs("lib/stroke-processing.ts")
const { WOBBLE_PRESETS } = loadTs("lib/hand-feel.ts")
const { closureStateOf } = loadTs("lib/dd-engine/strokeTo3d.ts")
const { stampPenClock } = loadTs("lib/pen-reveal.ts")

const arg = (k) => {
  const hit = process.argv.find((a) => a === `--${k}` || a.startsWith(`--${k}=`))
  if (!hit) return null
  return hit.includes("=") ? hit.split("=").slice(1).join("=") : true
}
/* AN ARGUMENT THIS FILE DOES NOT KNOW IS REFUSED. A mistyped `--offline` used
 * to fall through to the browser run, which is the opposite of what was asked. */
for (const a of process.argv.slice(2))
  if (!/^--(offline|selftest)$/.test(a) && !/^--trace=.+/.test(a))
    throw new Error(`assert-closed-loops: unknown argument \`${a}\`. Known: --offline, --trace=<file>, --selftest`)
const OFFLINE = !!arg("offline")
const SELFTEST = !!arg("selftest")
const TRACE = arg("trace")
if (TRACE && !OFFLINE) throw new Error("assert-closed-loops: --trace only means something with --offline")

/* THE WRAP BOUND, READ OUT OF ITS OWN FILE. `inflateChainIsClosed` is module-
 * private and lib/geometry-engines.ts is not this gate's to edit, so the two
 * constants are lifted from the source text. A restated constant that drifts is
 * the defect class this repo keeps finding, so a miss THROWS. */
const GE = readFileSync(join(ROOT, "lib/geometry-engines.ts"), "utf8")
const readConst = (name) => {
  const m = GE.match(new RegExp(`const ${name} = ([0-9.]+)`))
  if (!m) throw new Error(`assert-closed-loops: ${name} is gone from lib/geometry-engines.ts`)
  return Number(m[1])
}
const EPS_HW = readConst("INFLATE_CLOSE_EPS_HALFWIDTHS")
const RADIUS = HERO_INK_WIDTH_PX / 2
const WRAP_BOUND = RADIUS * EPS_HW

/** The gaps with the flag omitted, one entry per loop, keyed by letter. `x` is
 *  the letter's x range in trace units; a closed stroke belongs to the entry
 *  whose range holds its x centre. MEASURED 2026-09-25 on the 12-stroke trace
 *  `scripts/capture/logo-strokes.json` (see the header). The 13-stroke table it
 *  replaces, `{ 0: 26.15, 6: 22.77, 7: 29.99 }`, was filmed at
 *  docs/verification/closedloop-2026-08-28/before-<family> measure.json. */
const OPEN_GAPS_BY_LOOP = [
  { loop: "D of Desk", x: [6, 126], gap: 28.01 },
  { loop: "D of Doodles", x: [492, 599], gap: 18.37 },
  { loop: "first o of Doodles", x: [622, 693], gap: 32.55 },
  { loop: "second o of Doodles", x: [734, 796], gap: 25.89 },
]
const GAP_TOL = 0.02

/**
 * Match every closed stroke to exactly one table entry and compare its gap.
 * `closed` is `[{ i, xc, gap }]`. Returns the problems, each one a sentence;
 * an empty list is the only pass. A non-finite gap is a problem, never a match.
 */
function matchLoops(closed, table) {
  const problems = []
  const held = table.map(() => [])
  for (const c of closed) {
    const hits = table.map((e, j) => (c.xc >= e.x[0] && c.xc <= e.x[1] ? j : null)).filter((j) => j !== null)
    if (hits.length === 0) problems.push(`closed stroke #${c.i} (x centre ${c.xc.toFixed(0)}) has NO entry in the table`)
    else if (hits.length > 1) problems.push(`closed stroke #${c.i} falls in ${hits.length} entries`)
    else held[hits[0]].push(c)
  }
  table.forEach((e, j) => {
    const h = held[j]
    if (h.length === 0) {
      problems.push(`${e.loop} has NO closed stroke (want gap ${e.gap})`)
      return
    }
    if (h.length > 1) {
      problems.push(`${e.loop} holds ${h.length} closed strokes (#${h.map((c) => c.i).join(", #")})`)
      return
    }
    const g = h[0].gap
    if (!Number.isFinite(g)) problems.push(`${e.loop} #${h[0].i} gap is ${g}, not a number`)
    else if (Math.abs(g - e.gap) > GAP_TOL) problems.push(`${e.loop} #${h[0].i} want ${e.gap} got ${g.toFixed(2)}`)
  })
  return problems
}

const gap = (pts) => {
  const a = pts[0], b = pts[pts.length - 1]
  const ax = a.x ?? a[0], ay = a.y ?? a[1]
  const bx = b.x ?? b[0], by = b.y ?? b[1]
  return Math.hypot(bx - ax, by - ay)
}

/**
 * Row D's comparison. `off` is the stroke through `processStroke` with `closed`
 * omitted, `on` is the same stroke as the page drew it. Returns null only when
 * both have the same point count and EVERY coordinate is the same finite number,
 * compared within 1e-9 px (float noise between the page and Node is 2.27e-13), so
 * the row's "identical" is what is checked. It used
 * to compare the endpoint gap alone: an interior point moved 99 units with the
 * endpoints held passed, and a NaN gap passed because `NaN > 0.01` is false.
 */
const POINT_TOL = 1e-9 // px
const xyOf = (p) => [p.x ?? p[0], p.y ?? p[1]]
function openStrokeDiff(off, on) {
  if (!Array.isArray(off) || !Array.isArray(on)) return `not two point lists (${typeof off}, ${typeof on})`
  if (off.length === 0) return "the offline stroke has no points"
  if (off.length !== on.length) return `${off.length} vs ${on.length} points`
  for (let k = 0; k < off.length; k++) {
    const [ax, ay] = xyOf(off[k]), [bx, by] = xyOf(on[k])
    if (![ax, ay, bx, by].every(Number.isFinite)) return `point ${k} is not finite (${ax},${ay} vs ${bx},${by})`
    // The page and Node run the same pipeline in different engines: INSTR-2 measured
    // 163 of 519 points differing by at most 2.27e-13 px (4 ULP) on a correct page.
    // 1e-9 px is four orders above that noise and nine below the 99-unit must-fail.
    if (Math.abs(ax - bx) > POINT_TOL || Math.abs(ay - by) > POINT_TOL) return `point ${k} moved ${Math.hypot(bx - ax, by - ay).toExponential(2)} (${ax},${ay} vs ${bx},${by})`
  }
  return null
}

const fails = []
const ok = (name, cond, detail) => {
  console.log(`${cond ? "  PASS" : "  FAIL"}  ${name}${detail ? " — " + detail : ""}`)
  if (!cond) fails.push(name)
}

const hfBase = {
  wobble: WOBBLE_PRESETS[HERO_WOBBLE_PRESET],
  endpoint: HERO_ENDPOINT,
  inkWidth: HERO_INK_WIDTH_PX,
}
const run = (s, extra) =>
  processStroke(s, PROCESS_SETTINGS.spacing, PROCESS_SETTINGS.smoothing, PROCESS_SETTINGS.preserveCorners, 45, {
    ...hfBase,
    ...extra,
  })

/** Row E. `closedIdx` is the strokes the engine calls closed, from the page in
 *  the browser run and from the same predicate on the same file offline. */
function rowE(raws, closedIdx) {
  console.log("\nE. KNOWN-BAD — the shipped pre-fix state, and it must be REJECTED")
  const bad = raws.map((s) => run(s, {}))
  const closed = closedIdx.map((i) => {
    const xs = raws[i].points.map((p) => p.x)
    return { i, xc: (Math.min(...xs) + Math.max(...xs)) / 2, gap: gap(bad[i].points) }
  })
  const stillOpen = closed.filter((c) => c.gap > WRAP_BOUND)
  ok(
    "with the flag omitted, every loop comes out OPEN",
    closed.length > 0 && stillOpen.length === closed.length,
    (closed.map((c) => `#${c.i} ${c.gap.toFixed(2)}`).join(" ") || "NO closed strokes") + `  (bound ${WRAP_BOUND.toFixed(2)})`,
  )
  const problems = matchLoops(closed, OPEN_GAPS_BY_LOOP)
  ok(
    "…and it reproduces the SHIPPED gaps, loop for loop, so the control is the real defect",
    problems.length === 0,
    problems.length
      ? problems.join(" · ")
      : `${closed.length} closed loops of ${raws.length} strokes: ` +
          OPEN_GAPS_BY_LOOP.map((e) => `${e.loop} ${e.gap}`).join(", "),
  )
}

/** The raw strokes of any trace file, built the way `rawHeroStrokes()` builds
 *  the shipped one. Checked against it below so the two cannot drift. */
function rawStrokesOf(file) {
  const polys = JSON.parse(readFileSync(isAbsolute(file) ? file : join(ROOT, file), "utf8")).polylines
  return stampPenClock(polys, HERO_PEN_CLOCK, { nibDiameter: HERO_INK_WIDTH_PX, dropSubNibStubs: HERO_DROP_SUB_NIB_STUBS })
}

if (SELFTEST) {
  /* The matcher, on the shipped gaps, broken three ways. Each broken copy must
   * FAIL; the untouched copy must PASS, or the three fails prove nothing. */
  const shipped = OPEN_GAPS_BY_LOOP.map((e, i) => ({ i, xc: (e.x[0] + e.x[1]) / 2, gap: e.gap }))
  const cases = [
    ["untouched", shipped, OPEN_GAPS_BY_LOOP, true],
    ["one gap +0.03", shipped.map((c, k) => (k === 1 ? { ...c, gap: c.gap + 0.03 } : c)), OPEN_GAPS_BY_LOOP, false],
    ["one entry removed", shipped, OPEN_GAPS_BY_LOOP.slice(1), false],
    ["one extra loop", [...shipped, { i: 99, xc: 960, gap: 40 }], OPEN_GAPS_BY_LOOP, false],
    ["a loop that stopped closing", shipped.slice(0, 3), OPEN_GAPS_BY_LOOP, false],
    ["a NaN gap", shipped.map((c, k) => (k === 2 ? { ...c, gap: NaN } : c)), OPEN_GAPS_BY_LOOP, false],
  ]
  console.log("SELFTEST: the loop matcher, 1 must-pass and 5 must-fail")
  for (const [name, closed, table, want] of cases) {
    const p = matchLoops(closed, table)
    const got = p.length === 0
    ok(`${name} ${want ? "passes" : "fails"}`, got === want, got ? "matched" : p.join(" · "))
  }
  /* Row D's comparison, on a REAL open stroke of the shipped word through the
   * same `processStroke` row D runs. Codex's counterexample is the second case. */
  const raws = rawHeroStrokes()
  const openI = raws.findIndex((s) => closureStateOf(s.points.map((p) => [p.x, p.y])) !== "closed")
  const base = run(raws[openI], {}).points
  const mid = Math.floor(base.length / 2)
  const bump = (k, f) => base.map((p, j) => (j === k ? f(p) : { ...p }))
  const dCases = [
    ["the same stroke, copied", base.map((p) => ({ ...p })), true],
    ["the same stroke as [x, y] pairs, the other shape the page may hand back", base.map((p) => [p.x, p.y]), true],
    ["an interior point moved 99 units, endpoints unchanged", bump(mid, (p) => ({ ...p, x: p.x + 99 })), false],
    ["one interior point off by 1e-9", bump(mid, (p) => ({ ...p, y: p.y + 1e-9 })), false],
    ["a NaN endpoint, so a NaN gap", bump(base.length - 1, (p) => ({ ...p, x: NaN })), false],
    ["one point dropped", base.slice(1), false],
    ["an empty page stroke", [], false],
    ["no page stroke at all", undefined, false],
  ]
  console.log(`\nSELFTEST: row D's comparison on open stroke #${openI} (${base.length} points), 2 must-pass and 6 must-fail`)
  if (openI < 0 || base.length < 3) ok("an open stroke with an interior point exists to test on", false, `#${openI}`)
  for (const [name, on, want] of dCases) {
    const d = openStrokeDiff(base, on)
    ok(`${name} ${want ? "passes" : "fails"}`, (d === null) === want, d ?? "identical")
  }
  const total = cases.length + dCases.length
  console.log(fails.length ? `\nSELFTEST FAILURES: ${fails.join(" · ")}` : `\nSELFTEST holds, ${total} of ${total}`)
  process.exit(fails.length ? 1 : 0)
}

if (OFFLINE) {
  console.log(`OFFLINE: row E only, in Node, on ${TRACE || "scripts/capture/logo-strokes.json (shipped)"}`)
  const shippedRaws = rawHeroStrokes()
  const mirror = rawStrokesOf("scripts/capture/logo-strokes.json")
  ok(
    "the trace loader builds the same word as rawHeroStrokes()",
    mirror.length === shippedRaws.length &&
      mirror.every((s, i) => s.points.length === shippedRaws[i].points.length &&
        s.points.every((p, k) => p.x === shippedRaws[i].points[k].x && p.y === shippedRaws[i].points[k].y)),
    `${mirror.length} vs ${shippedRaws.length} strokes`,
  )
  const raws = TRACE ? rawStrokesOf(TRACE) : shippedRaws
  const closedIdx = raws.map((s, i) => (closureStateOf(s.points.map((p) => [p.x, p.y])) === "closed" ? i : null)).filter((v) => v !== null)
  console.log(`  ${raws.length} strokes, engine calls closed: [${closedIdx.join(", ")}]`)
  rowE(raws, closedIdx)
  console.log(fails.length ? `\nFAILURES — ${fails.join(" · ")}` : "\nROW E HOLDS OFFLINE. Rows A to D need the browser and were NOT RUN")
  process.exit(fails.length ? 1 : 0)
}

const browser = await chromium.launch({ label: "closed-loops" })
try {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)))
  page.setDefaultTimeout(180000)
  page.setDefaultNavigationTimeout(180000)
  await page.goto(HERO_URL, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => !!window.__handFeelHarness, null, { timeout: 120000, polling: 500 })
  await page.waitForTimeout(1500)
  const live = await page.evaluate(() => {
    const h = window.__handFeelHarness
    return { raw: h.raw, processed: h.processed, closed: h.closed ?? null, endpoint: h.endpoint, wobble: h.wobble }
  })

  console.log("\nA. THE PAGE PUBLISHES ITS OWN ANSWER")
  ok("the harness is populated", live.raw.length > 0 && live.processed.length === live.raw.length, `${live.raw.length} strokes`)
  ok(
    "the page publishes a closed flag per stroke",
    Array.isArray(live.closed) && live.closed.length === live.raw.length,
    Array.isArray(live.closed) ? `${live.closed.filter(Boolean).length} of ${live.closed.length} closed` : "NOT PUBLISHED",
  )
  ok("the endpoint dial is at the shipped setting", live.endpoint === HERO_ENDPOINT, `endpoint ${live.endpoint}`)

  console.log("\nB. THE PREDICATE IS THE ENGINE'S, NOT A LIST")
  const engineSays = live.raw.map((r) => closureStateOf(r.map(([x, y]) => [x, y])) === "closed")
  const disagree = engineSays.map((v, i) => (v === (live.closed?.[i] ?? null) ? null : i)).filter((v) => v !== null)
  ok(
    "the page's flags are exactly the engine's closureStateOf",
    disagree.length === 0,
    disagree.length ? `disagree on strokes ${disagree}` : `agree on all ${engineSays.length}, closed = [${engineSays.map((v, i) => (v ? i : null)).filter((v) => v !== null)}]`,
  )
  ok(
    "…and it selects some strokes and not others, so it is a predicate and not a constant",
    engineSays.some(Boolean) && engineSays.some((v) => !v),
    `${engineSays.filter(Boolean).length} closed of ${engineSays.length}`,
  )

  console.log("\nC. A CLOSED LOOP STAYS UNDER THE SWEEP'S OWN WRAP BOUND")
  const closedIdx = engineSays.map((v, i) => (v ? i : null)).filter((v) => v !== null)
  for (const i of closedIdx) {
    const g = gap(live.processed[i])
    ok(`stroke #${i} is still a loop on the page that drew it`, g <= WRAP_BOUND, `gap ${g.toFixed(2)} px <= ${WRAP_BOUND.toFixed(2)} (0.75 x radius ${RADIUS.toFixed(2)})`)
  }

  console.log("\nD. NOTHING ELSE MOVED")
  const raws = rawHeroStrokes()
  ok("the offline word is the page's word", raws.length === live.raw.length, `${raws.length} vs ${live.raw.length}`)
  let moved = []
  let compared = 0
  for (let i = 0; i < raws.length; i++) {
    if (engineSays[i]) continue
    const d = openStrokeDiff(run(raws[i], {}).points, live.processed[i])
    compared++
    if (d) moved.push(`#${i} ${d}`)
  }
  ok(
    "every OPEN stroke is byte-identical to the shipped pass",
    moved.length === 0 && compared > 0 && compared === raws.length - closedIdx.length,
    moved.length ? moved.join(" · ") : `${compared} open strokes, every point identical`,
  )

  rowE(raws, closedIdx)
  ok("no page errors", errs.length === 0, `${errs.length}`)
  await ctx.close()
} finally {
  await browser.close()
}

console.log(fails.length ? `\nFAILURES — ${fails.join(" · ")}` : "\nTHE LOOPS ARE CLOSED — all rows hold")
process.exit(fails.length ? 1 : 0)
