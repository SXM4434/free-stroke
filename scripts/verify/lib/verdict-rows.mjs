// WHAT COUNTS AS A JUDGEMENT — one definition, two readers.
//
// WHY THIS FILE EXISTS
//
//   Two places in this repo decided what a verdict looks like, and they decided
//   it the same wrong way, separately:
//
//     assert-gate-integrity.mjs:297   const EMIT_RE = /\bPASS\b|\bFAIL\b/
//     run-battery.mjs:191             /^\s*(?:\*\*\* )?(?:PASS|FAIL)\b/gm
//     run-browser-battery.mjs:101     …the same line again
//
//   `\bFAIL\b` DOES NOT MATCH `FAILED`. There is no word boundary between the
//   `L` and the `E`. Measured 2026-08-07 on real gate output:
//
//     BLIND  "MUTATION CONTROL --mutate=prior FAILED TO BITE: …"
//     SEEN   "MUTATION CONTROL --mutate=cx: FAILED TO FAIL."
//
//   `assert-hero-transition`'s withheld control was visible to the meta-gate
//   ONLY because its refusal sentence happens to end in a full stop, which
//   restores the boundary. `assert-pen-field-alloc`'s, which announces itself in
//   capitals, was invisible. That is the accident behind "channel J sees 2 of
//   the 19" (explainer 31 §2), and it is the same accident Lane G recorded for
//   `assert-hero-dials`, whose live arm printed `live`/`DEAD` and was counted as
//   zero rows.
//
//   Two copies of one rule is this repo's most expensive recurring defect — it
//   is why the browser runner now IMPORTS its inventory from the model runner
//   instead of restating it, and why the meta-gate imports `EXTRA_ARGS` rather
//   than describing it in a sentence. The rule lives here now.
//
// THE TWO READERS ASK DIFFERENT QUESTIONS, AND THAT IS WHY THE ANCHORING IS NOT
// SHARED — only the alphabet is.
//
//   · The META-GATE asks a SOURCE-level question: does this `console.*` call
//     carry a verdict at all, anywhere in the string it builds? A row helper
//     writes `` `${ok ? "PASS" : "FAIL"}  ${name}` ``, so the token is a whole
//     literal of its own and is never at the start of anything.
//   · The SCOREBOARDS ask an OUTPUT-level question: how many judgement ROWS did
//     this run print? There the token must LEAD the line, because a gate's prose
//     mentions "fail" constantly and a summary line is not a row.
//
//   Sharing the anchoring would break one of them. Sharing the alphabet is the
//   whole of what they had in common, and it is the whole of what was wrong.
//
// THE ALPHABET, CHOSEN BY MEASUREMENT
//
//   Every candidate inflection was counted across all 95 `assert-*` gates, in
//   string literals that do not already carry a bare PASS/FAIL, and READ:
//
//     PASSED    8 hits — all verdicts   "UNSOUND — the control PASSED."
//     PASSES    1 hit  — a verdict      "PASSES <- WRONG"
//     FAILED   40 hits — all verdicts   "CONTROL FAILED — 2 row(s) could not tell…"
//     FAILS     6 hits — all verdicts   "SOUND — the control correctly FAILS."
//     FAILURE  39 hits — NOT a verdict  "FAILURES ABOVE", "12 FAILURE(S) across…"
//
//   `FAILURE`/`FAILURES` is deliberately OUT. It is a COUNT of failures, not a
//   verdict about a subject: every one of the 39 is a summary line. Admitting it
//   would let a gate satisfy the meta-gate's channel A with a summary that names
//   no row — which is the disease, not the cure. Naming the exclusion is the
//   point; an alphabet nobody can argue with is an alphabet nobody re-reads.
//
//   UPPERCASE ONLY, and that is also measured rather than assumed. "all rows
//   passed" is how six gates print their SUMMARY; counting it would add a row
//   per gate that corresponds to nothing.
//
// PROVED SAFE FOR THE SCOREBOARDS BEFORE IT WAS PROPOSED TO THEM.
//   The widened anchored regex was run against the 48 real gate logs in
//   `docs/verification/gate-integrity/browser-logs/` and compared with the
//   shipped one: **rows +0, red +0, across all 48.** No battery row count moves.
//   The gain is entirely at the SOURCE level, where the meta-gate reads.

import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

// ── 🔴 THE TWO RULES ARE NOT THE SAME RULE, AND THAT IS THE FINDING ─────────
//
//   The obvious tidy-up — one alternation, both readers — IS WRONG, and Lane K
//   is the one who proved it while widening the scoreboard's copy. **The two
//   readers' RISK RUNS IN OPPOSITE DIRECTIONS:**
//
//     · At the SCOREBOARD, this pattern decides how many rows are COUNTED.
//       Over-matching INFLATES A TOTAL — a summary line ("5 PASS · 0 FAIL") or a
//       sentence about failure becomes a row, and the headline stops meaning
//       what a reader thinks. So the row rule stays NARROW and stays ANCHORED.
//     · At the META-GATE, it decides whether a console call IS A JUDGEMENT.
//       Under-matching BLINDS CHANNEL J — which is the 2-of-19 defect. But
//       over-matching lets a capture-only script pass channel A on PROSE, which
//       is the exact false green channel A exists to catch, arrived at by
//       widening the thing that catches it.
//
//   So: ONE FILE, ONE ALPHABET CORE, TWO DELIBERATE ANCHORINGS, each with its
//   own controls and its own measured justification. Collapsing them would break
//   one of the two readers, and the reason is written here rather than
//   rediscovered by whoever tries.
//
//   THE ROW HALF MIRRORS LANE K'S LANDED RULE EXACTLY. K shipped `ROW_RE` and
//   `FAIL_ROW_RE` as exports of `run-battery.mjs` and replayed them over the 48
//   real logs (1032 -> 1033 rows, 0 false positives, the one recovered row being
//   `[calib] PASS` in assert-layer-flicker). Restating that rule here would be
//   the very defect this file exists to end, so `assertReadersAgree()` below
//   PROVES the two are the same function on real output, every sweep, and goes
//   red if they ever drift. The collapse to a single definition is handed to the
//   controller as a diff, because `run-battery.mjs` is not this lane's file.

/** ROW half — Lane K's landed rule, mirrored. `[channel]` prefix because
 *  `assert-layer-flicker` prints `[calib] PASS`; `FAILED` because `\bFAIL\b`
 *  does not match it; `^\s*` because an indented child row still counts (which
 *  is exactly why `assert-hero-transition` must not echo its controls' output);
 *  `\*\*\* ` because that is how this repo marks a headline failure.
 *  NOT widened past that: everything else measured was a summary or prose. */
export const ROW_ALTERNATION = "PASS|FAIL(?:ED)?"
export const RED_ALTERNATION = "FAIL(?:ED)?"
const ROW_PREFIX = "^\\s*(?:\\[[\\w.-]+\\]\\s*)?(?:\\*\\*\\* )?"

export const rowRe = () => new RegExp(`${ROW_PREFIX}(?:${ROW_ALTERNATION})\\b`, "gm")
export const redRe = () => new RegExp(`${ROW_PREFIX}(?:${RED_ALTERNATION})\\b`, "gm")

/** How many judgement rows did this run print? …and how many were red? */
export const countRows = (out) => (String(out).match(rowRe()) || []).length
export const countReds = (out) => (String(out).match(redRe()) || []).length

/** SOURCE half — the meta-gate's question, asked of a string literal in the
 *  syntax tree rather than of a line of output. Unanchored, because a row helper
 *  builds `` `${ok ? "PASS" : "FAIL"}  ${name}` `` and the token is a literal of
 *  its own, never at the start of anything.
 *
 *  WIDER THAN THE ROW RULE, DELIBERATELY, and every addition was counted across
 *  all 95 gates and READ before being admitted (see the table in the header).
 *  `UNSOUND` / `NOT SOUND` are Lane K's, and they are the vocabulary this repo's
 *  controls actually use to refuse. */
export const SOURCE_ALTERNATION = "PASS(?:ED|ES)?|FAIL(?:ED|S)?|UNSOUND|NOT SOUND"

export function carriesVerdict(text) {
  return new RegExp(`\\b(?:${SOURCE_ALTERNATION})\\b`).test(text)
}

/* ------------------------------------------------------------------------- *
 * SELF-TEST — every rule with a MUST-MATCH and a MUST-NOT-MATCH.
 *
 * A predicate that has never rejected anything is the disease this whole file
 * is downstream of, one level up. `node lib/verdict-rows.mjs --selftest`.
 * ------------------------------------------------------------------------- */

/** The shared fixture set. Real strings, every one lifted from a gate in this
 *  repo or from explainer 31's measurement, plus the negatives that keep the
 *  alphabet from widening into prose. */
export const FIXTURES = [
  // [text, carriesVerdict, countRows-as-a-whole-line, why]
  ["PASS  the mark holds", true, 1, "the ordinary row"],
  ["FAIL  the mark does not", true, 1, "the ordinary red row"],
  ["*** FAIL  headline", true, 1, "the headline marker the runners already allow"],
  ["    FAIL  an indented child row", true, 1, "indented rows count — see the echo warning above"],
  [
    "MUTATION CONTROL --mutate=cx: FAILED TO FAIL.",
    true,
    0,
    "the one the OLD regex saw, and only because the full stop restored the boundary",
  ],
  [
    "MUTATION CONTROL --mutate=prior FAILED TO BITE: 1 of 2 subject rows still pass.",
    true,
    0,
    "THE BUG: `\\bFAIL\\b` cannot match FAILED. Blind before this file existed.",
  ],
  ["UNSOUND — the control PASSED. The instrument is not measuring what it claims.", true, 0, "assert-drawin-2d-parity:328"],
  ["SOUND — the control correctly FAILS.", true, 0, "assert-drawin-2d-parity:331"],
  ["CONTROL FAILED — 2 row(s) could not tell the difference.", true, 0, "assert-hero-k7-news:445"],
  [
    "PASSED — THIS GATE IS BLIND",
    true,
    0,
    "assert-citations:339 — a SOURCE verdict, and deliberately NOT a row: Lane K kept `PASSED` out of the anchored rule because a line beginning with it is a summary in every measured case",
  ],
  ["[calib] PASS  cal_offform  BROKEN — ink 1.6%", true, 1, "the `[channel]` prefix Lane K recovered — the one row that moved across 48 real logs"],
  // ---- must NOT match ----
  [
    "assert-one-knob: 5 PASS · 0 FAIL",
    true,
    0,
    "A SUMMARY LINE. It carries verdicts (so the source half sees it) and it is NOT a row — the anchoring is the whole defence, and nine gates print this shape",
  ],
  ["FAILURES ABOVE", false, 0, "a COUNT, not a verdict — the whole reason FAILURE is excluded"],
  ["12 FAILURE(S) across channels A-J", false, 0, "ditto, and it is this repo's own summary line"],
  ["all rows passed", false, 0, "lowercase summary — six gates print it; it is not a row"],
  ["MUTATION CONTROL --mutate=prior: both subject rows went RED, as required.", false, 0, "NO TOKEN RULE CAN CATCH THIS — see the note below"],
  ["the bypass is clean", false, 0, "`bypass` must not match PASS — the word boundary earns its keep"],
  ["passes the ray through", false, 0, "lowercase prose"],
  ["  the row above FAILED", true, 0, "carries a verdict, but does not LEAD its line — not a row"],
]

/* THE BREAK MODES — the selftest's own negative control.
 *
 * A selftest that has only ever been run against the correct alphabet proves
 * that the fixtures agree with themselves, not that they can catch anything.
 * So the alphabet is INJECTABLE and two deliberately wrong ones are named here,
 * each of which the fixture set must reject:
 *
 *   --break=old-alphabet   the shipped `PASS|FAIL`, i.e. the bug this file fixes
 *   --break=admit-failure  `FAILURE(S)` let in, i.e. the widening this file refuses
 *
 * Reproducible, and it stays in the file — a break test that lived in a shell
 * history is a break test nobody can re-run. */
export const BREAKS = {
  // the rule as it shipped in BOTH readers — no `FAILED`, no `[channel]` prefix
  "old-alphabet": { source: "PASS|FAIL", row: "PASS|FAIL", prefix: "^\\s*(?:\\*\\*\\* )?" },
  // the widening this file refuses: `FAILURE(S)` admitted as a verdict
  "admit-failure": { source: "PASS(?:ED|ES)?|FAIL(?:ED|S|URES?)?|UNSOUND|NOT SOUND" },
  // the row rule widened to the SOURCE alphabet — the tidy-up that looks right
  // and is not: summary lines beginning `PASSED …` become counted rows.
  "one-rule-for-both": { row: SOURCE_ALTERNATION },
}

export function selftest(over = {}) {
  const source = over.source ?? SOURCE_ALTERNATION
  const row = over.row ?? ROW_ALTERNATION
  const prefix = over.prefix ?? ROW_PREFIX
  const carries = (t) => new RegExp(`\\b(?:${source})\\b`).test(t)
  const rows = (t) => (String(t).match(new RegExp(`${prefix}(?:${row})\\b`, "gm")) || []).length
  let bad = 0
  console.log(`=== verdict-rows selftest — every rule with a must-match AND a must-not-match ===`)
  console.log(`    SOURCE (meta-gate, unanchored, wider): /${source}/`)
  console.log(`    ROW    (scoreboards, anchored, narrow): /${prefix}(?:${row})\\b/\n`)
  for (const [text, wantCarries, wantRows, why] of FIXTURES) {
    const gotCarries = carries(text)
    const gotRows = rows(text)
    const ok = gotCarries === wantCarries && gotRows === wantRows
    if (!ok) bad++
    console.log(
      `${ok ? "PASS" : "FAIL"}  carries=${String(gotCarries).padEnd(5)} rows=${gotRows}  ` +
        `${JSON.stringify(text.slice(0, 62))}\n        ${why}`,
    )
  }
  /* THE HONEST LIMIT, asserted rather than written in a comment. A gate that
   * announces its control verdict as "went RED" carries no verdict token and no
   * token rule will ever catch it. That is not a hole this file can close, and
   * pretending otherwise is how an alphabet grows until it matches prose. It is
   * closed one level up instead — the meta-gate ALSO counts a withheld
   * `process.exit(non-zero)`, which that same block does have. */
  const wentRed = "MUTATION CONTROL --mutate=prior: both subject rows went RED, as required."
  const limitHolds = !carries(wentRed)
  if (!limitHolds) bad++
  console.log(
    `\n${limitHolds ? "PASS" : "FAIL"}  THE STATED LIMIT: "went RED" is NOT claimed to be caught here.` +
      `\n        It is caught by the meta-gate's exit-derived arm instead. A file that claimed` +
      `\n        to catch it would be over-claiming, which is the defect one level up.`,
  )
  console.log(bad ? `\nNOT SOUND — ${bad} case(s) wrong.` : `\nSOUND — ${FIXTURES.length + 1} cases, ${FIXTURES.filter((f) => !f[1]).length} of them must-NOT-match.`)
  return bad
}

/* ------------------------------------------------------------------------- *
 * DO THE TWO READERS ACTUALLY AGREE? — asserted, not assumed.
 *
 * `run-battery.mjs` owns `ROW_RE`/`FAIL_ROW_RE` (Lane K, landed 2026-08-07) and
 * this file owns `rowRe()`/`redRe()`. That is two statements of one rule, which
 * is the defect this file was opened to end — so until `run-battery.mjs` imports
 * from here (a diff handed to the controller; it is not this lane's file), the
 * two are PROVED EQUAL on every sweep, over REAL OUTPUT.
 *
 * The corpus is the canonical tree's 48 browser-battery logs. Fixtures alone
 * would not do: this whole class of defect is made of formats nobody thought to
 * write a fixture for.
 * ------------------------------------------------------------------------- */
export function assertReadersAgree(theirRowRe, theirRedRe, logDir) {
  const out = { ok: true, files: 0, rows: 0, reds: 0, drift: [], corpus: "fixtures + real logs" }
  const fresh = (re) => new RegExp(re.source, re.flags)

  /* THE FIXTURE HALF ALWAYS RUNS. It is small but it is not weak: it carries the
   * `[channel]` prefix, the summary line, and the `PASSED`-leads-the-line case —
   * i.e. every axis on which the two rules could differ. */
  for (const [text, , wantRows] of FIXTURES) {
    const mine = countRows(text)
    const theirs = (text.match(fresh(theirRowRe)) || []).length
    if (mine !== theirs || mine !== wantRows) {
      out.ok = false
      out.drift.push(`fixture ${JSON.stringify(text.slice(0, 40))}: mine ${mine} vs theirs ${theirs} (want ${wantRows})`)
    }
  }

  let names = []
  try {
    names = readdirSync(logDir).filter((f) => f.endsWith(".log"))
  } catch {
    /* NOT A FAILURE, AND NOT A PASS EITHER — it is the weaker check, NAMED.
     * Failing here would make the meta-gate red in every tree that has not run a
     * browser battery, which is every lane tree, for the absence of evidence
     * nobody asked it to have. That is the wolf-crying the ALLOW list's
     * joint-beading entry exists to describe. The fixture half above still ran
     * and still had to agree. */
    return { ...out, corpus: "FIXTURES ONLY — no log corpus on this tree; the real-output half is UNRUN, not passed" }
  }
  for (const f of names) {
    let text
    try {
      text = readFileSync(join(logDir, f), "utf8")
    } catch {
      continue
    }
    out.files++
    const mine = countRows(text)
    const theirs = (text.match(fresh(theirRowRe)) || []).length
    const myRed = countReds(text)
    const theirRed = (text.match(fresh(theirRedRe)) || []).length
    out.rows += mine
    out.reds += myRed
    if (mine !== theirs || myRed !== theirRed) {
      out.ok = false
      out.drift.push(`${f}: rows ${mine} vs ${theirs}, red ${myRed} vs ${theirRed}`)
    }
  }
  if (!out.files) out.corpus = "FIXTURES ONLY — the log directory exists but is empty; the real-output half is UNRUN, not passed"
  return out
}

if (process.argv[1] && process.argv[1].endsWith("verdict-rows.mjs")) {
  const brk = (process.argv.find((a) => a.startsWith("--break=")) ?? "").split("=")[1]
  if (brk) {
    if (!(brk in BREAKS)) {
      console.error(`unknown --break=${brk} — one of ${Object.keys(BREAKS).join(" | ")}`)
      process.exit(2)
    }
    /* INVERTED: under a deliberately wrong alphabet the fixture set MUST go red.
     * A break mode that comes back clean means the fixtures are not testing the
     * alphabet at all, which is this file's own disease one level up. */
    const bad = selftest(BREAKS[brk])
    console.log(
      bad
        ? `\nBREAK "${brk}" CONFIRMED — the wrong alphabet fails ${bad} fixture(s), as required.`
        : `\nBREAK "${brk}" DID NOT BITE — the fixtures pass an alphabet known to be wrong. They prove nothing.`,
    )
    process.exit(bad ? 0 : 1)
  }
  process.exit(selftest() === 0 ? 0 : 1)
}
