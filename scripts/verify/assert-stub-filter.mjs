/**
 * ARE THE ACCIDENTAL TAPS GONE, AND DID THEIR TIME GO WITH THEM? — the stub gate.
 *
 * N8, 2026-08-28. `docs/research/write-on-timing.md` §7 ranks this first of
 * seven and says why: *"One filter, one threshold, one line. It removes 2,289 ms
 * of dead clock (13.6 % of the record), removes the mechanism that puts detached
 * dots in clear air, and removes the nine identical 241 ms durations that are
 * the regularity tell. Nothing else on this list is close on either axis."*
 *
 * The mark it removes is the one Sebs can see. N6 filmed it and could not fix
 * it from the geometry side: *"a nib stamps its own footprint on a path shorter
 * than itself; it cannot remove one."*
 *
 * ── WHAT THIS ASSERTS THAT A STROKE COUNT DOES NOT ────────────────────────
 *
 * "9 of 22 dropped" is a fact about one threshold on one word and it would stay
 * true if the threshold were wrong. The rows below are about the MARGIN (how far
 * the threshold is from anything it could get wrong), the CLOCK (both halves of
 * "drop", not just the ink), and the LETTER LAW (that removing ink did not
 * remove a letter).
 *
 * ── THE ARMS ──────────────────────────────────────────────────────────────
 *
 *   SUBJECT   the shipped word, filter ON.
 *   off       filter OFF — the PARKED PRIOR, and it is literally the state that
 *             shipped until tonight. The count, clock, regularity and letter
 *             rows must all go RED on it.
 *   crowded   the threshold moved to NINE nib diameters, which is where this
 *             word's real strokes actually cluster — measured, the lengths run
 *             … 8.53 8.54 8.96 | 9.03 9.26 9.96 … so a threshold there has a
 *             margin of 1.008× and drops 15 of 22. That is the shape of a
 *             threshold somebody PICKED rather than derived, and it is what the
 *             margin and travel rows exist to reject.
 *   NaN       `nibDiameter: NaN`, the guard's real subject. `l >= NaN` is false
 *             for every l, so an UNGUARDED filter deletes the entire word and
 *             returns an empty drawing with no error. This repo has already paid
 *             for that shape once: `Math.min(1, Math.max(0, NaN))` is NaN, and it
 *             made 1 264 of 1 266 positions non-finite on `tick/inflate`.
 *
 * Every row below is turned red by at least one arm and the matrix prints which,
 * because "about 52 of 101 gates cannot report the failure they exist for"
 * (`docs/RUN-QUEUE.md`, measured 2026-08-28) and this must not be the 53rd.
 */

// gate-integrity: differential — neither constant channel D reaches here can affect a row.
// HAND_FEEL_OFF appears nowhere in this file (0 occurrences; the leaf `wobble` is what matched), and
// processStroke's angleThresholdDeg default is unreachable because this gate passes 45 as a literal
// argument. The thresholds this file does guard are its own MARGIN, CLOCK and LETTER LAW rows, which
// are asserted against measured distances rather than against a published constant.
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { loadTs, ROOT } from "./_ts-load.mjs"
import {
  heroPolylines,
  HERO_INK_WIDTH_PX,
  HERO_DROP_SUB_NIB_STUBS,
  HERO_PEN_CLOCK,
  PROCESS_SETTINGS,
  HERO_WOBBLE_PRESET,
  HERO_ENDPOINT,
} from "./_hero-word.mjs"

const PR = loadTs("lib/pen-reveal.ts")
const SP = loadTs("lib/stroke-processing.ts")
const HF = loadTs("lib/hand-feel.ts")
const LETTERS = loadTs("lib/hero-letters.ts")

const polylines = heroPolylines()
const NIB = HERO_INK_WIDTH_PX

/** "DeskDoodles" — a fact about the trace, which will never be another word. */
const WORD_LETTERS = 11
/** How much clear air the threshold needs on both sides. 2× means the shortest
 *  surviving stroke is at least twice the longest dropped one, so no plausible
 *  re-derivation of "one nib" can cross the gap. */
const MARGIN_MIN = 2.0

/* ---------------------------------------------------------------------- */
/*  ONE ARM = one threshold and one on/off, measured end to end            */
/* ---------------------------------------------------------------------- */
function measureArm({ drop, nib = NIB }) {
  const census = PR.subNibStubCensus(polylines, nib)
  const strokes = PR.stampPenClock(polylines, HERO_PEN_CLOCK, {
    nibDiameter: nib,
    dropSubNibStubs: drop,
  })
  const first = strokes[0].points[0].t
  const last = strokes[strokes.length - 1].points
  const record = last[last.length - 1].t - first
  let air = 0
  for (let i = 1; i < strokes.length; i++) {
    const prev = strokes[i - 1].points
    air += strokes[i].points[0].t - prev[prev.length - 1].t
  }
  const durs = strokes.map((s) => s.points[s.points.length - 1].t - s.points[0].t)
  /* THE REGULARITY TELL, COUNTED RATHER THAN NAMED. Every stroke the pen model
   * cannot split gets exactly ONE lognormal submovement, and one submovement is
   * the same duration every time — so identical durations are the signature of
   * a stroke that carried no movement, not of a coincidence. */
  const shortest = Math.min(...durs)
  const atShortest = durs.filter((d) => Math.abs(d - shortest) < 1).length
  const hf = {
    wobble: HF.WOBBLE_PRESETS[HERO_WOBBLE_PRESET],
    endpoint: HERO_ENDPOINT,
    inkWidth: NIB,
  }
  const processed = strokes.map((s) =>
    SP.processStroke(s, PROCESS_SETTINGS.spacing, PROCESS_SETTINGS.smoothing, PROCESS_SETTINGS.preserveCorners, 45, hf),
  )
  /* THE LETTER LAW, over the PEN'S OWN PATHS. `lib/hero-letters.ts`'s header is
   * emphatic that this is part of the law and not a convenience: hand-feel
   * PROTRUDES every stroke past its own end, and a tail run past its end lands
   * in the next letter. */
  const map = LETTERS.assignLetters(strokes, NIB)
  return {
    census,
    strokes: strokes.length,
    record,
    air,
    durs,
    shortest,
    atShortest,
    letters: map.count,
    gapAfter: LETTERS.letterGapAfter(strokes, map),
    processedPoints: processed.reduce((a, s) => a + s.points.length, 0),
  }
}

const subject = measureArm({ drop: true })
const off = measureArm({ drop: false })
const crowded = measureArm({ drop: true, nib: NIB * 9 })

/* ---------------------------------------------------------------------- */
const rows = []
const say = (key, ok, label, detail) => {
  rows.push({ key, ok })
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/** Every gating row, as a predicate on an arm, so the arms and the rows meet in
 *  a matrix rather than in five hand-written pairings. */
const ROW = {
  dropped: (a) => a.census.droppedIdx.length > 0 && a.strokes === a.census.keptIdx.length,
  margin: (a) => a.census.shortestKept / Math.max(a.census.longestDropped, 1e-9) >= MARGIN_MIN,
  travel: (a) => a.census.travelFrac <= 0.05,
  clock: (a) => a.record < off.record - 2000,
  regularity: (a) => a.atShortest <= 2,
  letters: (a) => a.letters === WORD_LETTERS,
}
const KEYS = Object.keys(ROW)

console.log(`\n=== THE STUBS: ARE THE ACCIDENTAL TAPS GONE, AND THEIR TIME WITH THEM? ===\n`)
console.log(
  `nib diameter ${NIB.toFixed(3)} units (derived from computeSolidEffectiveThicknessPx, never written down)\n` +
    `dropped ${subject.census.droppedIdx.length} of ${polylines.length}: strokes ${subject.census.droppedIdx.join(", ")}\n`,
)

say("shipped", HERO_DROP_SUB_NIB_STUBS === true,
  "the TRACED word opts in (`page.tsx` is grepped on import by `_hero-word.mjs`, which throws if it moved)",
  `dropSubNibStubs: ${HERO_DROP_SUB_NIB_STUBS}`)

/* ---------------------------------------------------------------------- */
/*  READING ONE FUNCTION OUT OF page.tsx                                    */
/*                                                                          */
/*  `_ts-load.mjs` cannot execute page.tsx (JSX, next/*), so this is source  */
/*  and it has to be source read PROPERLY. Comments and string/template      */
/*  literals are blanked to spaces first, indices preserved, so a `}` inside  */
/*  prose cannot close a body early; then the braces are matched. Returns    */
/*  null when the name is absent or the braces never balance, and every      */
/*  caller treats null as RED.                                              */
/* ---------------------------------------------------------------------- */
function blankLiterals(src) {
  const out = src.split("")
  const blank = (a, b) => { for (let k = a; k < b && k < out.length; k++) if (out[k] !== "\n") out[k] = " " }
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (c === "/" && src[i + 1] === "/") {
      const e = src.indexOf("\n", i)
      const end = e === -1 ? src.length : e
      blank(i, end); i = end; continue
    }
    if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2)
      const end = e === -1 ? src.length : e + 2
      blank(i, end); i = end; continue
    }
    if (c === '"' || c === "'" || c === "`") {
      let k = i + 1
      while (k < src.length) {
        if (src[k] === "\\") { k += 2; continue }
        if (src[k] === c) break
        k++
      }
      blank(i + 1, Math.min(k, src.length)); i = Math.min(k + 1, src.length); continue
    }
    i++
  }
  return out.join("")
}

export function functionBody(src, name) {
  const masked = blankLiterals(src)
  const at = masked.indexOf(`function ${name}(`)
  if (at === -1) return null
  const open = masked.indexOf("{", at)
  if (open === -1) return null
  let depth = 0
  for (let i = open; i < masked.length; i++) {
    if (masked[i] === "{") depth++
    else if (masked[i] === "}" && --depth === 0) return src.slice(open, i + 1)
  }
  return null
}

/* THE FONT MUST NOT. Its `FONT_LETTER_MAP.of` is index-parallel to the strokes
 * it returns — its own comment says so — and an `i`'s tittle is authored ink,
 * not an accidental tap. A filter there renumbers every letter with no error.
 *
 * ⚠ THIS ROW USED TO COUNT OCCURRENCES, AND A COUNT CANNOT TELL THE TWO CALL
 * SITES APART. An independent crosscheck on 2026-08-28 MOVED the sole
 * `dropSubNibStubs: true` off `buildTracedStrokes` and onto the FONT's
 * `stampPenClock`, which is the one place this file's own comment says it must
 * never go — and this gate returned 16/16, exit 0. One occurrence before, one
 * after. The measured arms could not see it either, because `measureArm` forces
 * `drop: true` itself rather than reading what the page passes.
 *
 * So the question is asked of the two function BODIES. `callSiteAudit` is pure
 * so the mutant below can be handed to the same code that grades the real file,
 * and the parser is fail-closed: if the slice is wrong, the anchors each body
 * must contain are missing and the row goes red rather than grading air. */
export function callSiteAudit(src) {
  const traced = functionBody(src, "buildTracedStrokes")
  const font = functionBody(src, "buildFontStrokes")
  return {
    /* THE PARSER'S OWN CONTROLS. A brace-match that lands in the wrong place
     * returns a body that does not contain the call it is about. */
    tracedRead: traced !== null && traced.includes("stampPenClock("),
    fontRead: font !== null && font.includes("stampPenClock(") && font.includes("FONT_LETTER_MAP.of"),
    tracedOptIn: traced !== null && /dropSubNibStubs:\s*true/.test(traced),
    fontMentions: font === null ? -1 : (font.match(/dropSubNibStubs/g) ?? []).length,
    fileOptIns: (src.match(/dropSubNibStubs:\s*true/g) ?? []).length,
  }
}
const CALL_SITES_OK = (a) =>
  a.tracedRead && a.fontRead && a.tracedOptIn && a.fontMentions === 0 && a.fileOptIns === 1

{
  const src = readFileSync(join(ROOT, "app/desk-doodles/page.tsx"), "utf8")
  const a = callSiteAudit(src)
  say("font-exempt", CALL_SITES_OK(a),
    "…and it is `buildTracedStrokes` that opts in, in its own body, while `buildFontStrokes` never says the word",
    !a.tracedRead || !a.fontRead
      ? `COULD NOT READ a body: buildTracedStrokes ${a.tracedRead ? "ok" : "UNREADABLE"}, buildFontStrokes ${a.fontRead ? "ok" : "UNREADABLE"} — the slice is wrong, not the page`
      : `buildTracedStrokes opts in: ${a.tracedOptIn} · buildFontStrokes mentions dropSubNibStubs ${a.fontMentions}x · ${a.fileOptIns} occurrence(s) file-wide`)

  /* THE CROSSCHECK'S MUTATION, RUN. The option is taken off the traced word and
   * given to the font, exactly as it was moved by hand. `fileOptIns` stays 1 in
   * the mutant, which is why the count passed it, and the row above must not. */
  const moved = src
    .replace(/\n\s*dropSubNibStubs: true,(?=\n\s*\}\)\n)/, "")
    .replace("{ nibDiameter: HERO_INK_WIDTH_PX })", "{ nibDiameter: HERO_INK_WIDTH_PX, dropSubNibStubs: true })")
  const m = callSiteAudit(moved)
  say("kb-callsite", m.fileOptIns === 1 && m.tracedRead && m.fontRead && !CALL_SITES_OK(m),
    "KNOWN-BAD `moved` — the filter taken off the traced word and put on the FONT — turns that row red, and the count it replaced still reads 1",
    `mutant: traced opts in ${m.tracedOptIn} · font mentions ${m.fontMentions}x · ${m.fileOptIns} occurrence(s) file-wide` +
      (m.fileOptIns === 1 ? "" : " — THE MUTATION DID NOT APPLY, this control is measuring nothing"))
}

say("dropped", ROW.dropped(subject),
  "every polyline shorter than one nib diameter is gone, and nothing else is",
  `${polylines.length} → ${subject.strokes} strokes`)

say("margin", ROW.margin(subject),
  `the threshold sits in CLEAR AIR (shortest kept ≥ ${MARGIN_MIN}× longest dropped)`,
  `longest dropped ${subject.census.longestDropped.toFixed(3)} nib, shortest kept ` +
    `${subject.census.shortestKept.toFixed(3)} nib — a ${(subject.census.shortestKept / subject.census.longestDropped).toFixed(2)}× gap, ` +
    `so every threshold in [${subject.census.longestDropped.toFixed(2)}, ${subject.census.shortestKept.toFixed(2)}] nib drops the same set`)

say("travel", ROW.travel(subject),
  "the ink it removed is a rounding error on the pen's travel (≤ 5 %)",
  `${(subject.census.travelFrac * 100).toFixed(2)} % of the pen's travel`)

say("clock", ROW.clock(subject),
  "and their TIME went with them — the record got shorter, it was not redistributed",
  `${(off.record / 1000).toFixed(3)} s → ${(subject.record / 1000).toFixed(3)} s, ` +
    `−${((off.record - subject.record) / 1000).toFixed(3)} s = ${((1 - subject.record / off.record) * 100).toFixed(1)} % of the record; ` +
    `pen in the air ${(off.air / 1000).toFixed(3)} s → ${(subject.air / 1000).toFixed(3)} s`)

say("regularity", ROW.regularity(subject),
  "the identical-duration cluster is gone — that was the regularity tell, not a coincidence",
  `${off.atShortest} strokes shared ${off.shortest.toFixed(1)} ms; now ${subject.atShortest} share ${subject.shortest.toFixed(1)} ms`)

say("letters", ROW.letters(subject),
  `the letter law still finds every letter of the word (${WORD_LETTERS})`,
  `${off.letters} pieces before, ${subject.letters} after, word gap after piece ${subject.gapAfter}`)

/* THE GUARD. An unset or NaN dial must not be able to delete the drawing. */
say("guard", PR.dropSubNibStubs(polylines, NaN).length === polylines.length &&
             PR.dropSubNibStubs(polylines, 0).length === polylines.length &&
             PR.dropSubNibStubs(polylines, -5).length === polylines.length,
  "a nibDiameter of NaN, 0 or negative drops NOTHING rather than deleting the word",
  `NaN → ${PR.dropSubNibStubs(polylines, NaN).length}, 0 → ${PR.dropSubNibStubs(polylines, 0).length}, ` +
    `−5 → ${PR.dropSubNibStubs(polylines, -5).length} of ${polylines.length} strokes survive`)

/* ---- THE KNOWN-BADS, AS A COVERAGE MATRIX --------------------------------
 * Same contract as `assert-nib-contrast.mjs`: every gating row must be turned
 * RED by at least one arm, and which arm is evidence rather than law. */
const arms = [
  ["off", off, "the PARKED PRIOR — the filter disabled, i.e. the word that shipped until tonight"],
  ["crowded", crowded, "the threshold at NINE nib diameters, inside the word's own cluster"],
]
console.log(`\n--- known-bad arms, and which row each one turns RED ---`)
console.log("  " + "arm".padEnd(9) + KEYS.map((r) => r.slice(0, 10).padStart(13)).join(""))
for (const [n, a] of arms) {
  console.log("  " + n.padEnd(9) + KEYS.map((r) => (ROW[r](a) ? "·" : "RED").padStart(13)).join(""))
}
for (const [n, a] of arms) {
  console.log(
    `  ${n}: ${a.strokes} strokes · record ${(a.record / 1000).toFixed(3)} s · ` +
      `longest dropped ${a.census.longestDropped.toFixed(3)} nib, shortest kept ` +
      `${Number.isFinite(a.census.shortestKept) ? a.census.shortestKept.toFixed(3) : "∞"} nib · ` +
      `${a.atShortest} strokes at ${a.shortest.toFixed(1)} ms · ${a.letters} letters`,
  )
}
for (const r of KEYS) {
  const reds = arms.filter(([, a]) => !ROW[r](a)).map(([n]) => n)
  say(`kb-${r}`, reds.length > 0,
    `the \`${r}\` row HAS a control that turns it red`,
    reds.length ? `red under ${reds.join(", ")}` : "NO ARM TURNS IT RED — this row cannot say no")
}

/* AND THE GUARD'S OWN CONTROL, which is arithmetic rather than an arm: the row
 * above is only worth asserting if the UNGUARDED expression would really delete
 * the word. `l >= NaN` is false for every l, so it would — and this is the
 * comparison the filter makes, written out, not a description of it. */
{
  const unguarded = polylines.filter((pl) => {
    let d = 0
    for (let i = 1; i < pl.length; i++) d += Math.hypot(pl[i].x - pl[i - 1].x, pl[i].y - pl[i - 1].y)
    return d >= NaN
  })
  say("kb-guard", unguarded.length === 0,
    "…and the guard is LOAD-BEARING — the same comparison without it returns an empty drawing",
    `\`length >= NaN\` keeps ${unguarded.length} of ${polylines.length} strokes; the guard keeps ` +
      `${PR.dropSubNibStubs(polylines, NaN).length}`)
}

const failed = rows.filter((r) => !r.ok)
console.log(
  `\n${failed.length === 0 ? "THE TAPS ARE GONE AND SO IS THEIR CLOCK" : "STUB GATE FAILED"} — ` +
    `${rows.length - failed.length}/${rows.length} rows${failed.length ? ": " + failed.map((f) => f.key).join(", ") : ""}`,
)
process.exit(failed.length === 0 ? 0 : 1)
