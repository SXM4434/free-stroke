// THE OTHER HALF OF THE BATTERY — the 44 gates `run-battery.mjs` refuses to run.
//
// WHY THIS EXISTS
//
//   `run-battery.mjs` runs the 37 MODEL gates and LISTS the browser ones, on the
//   correct reasoning that a skip is not a pass and that serialising a dozen
//   Chrome launches behind one shared dev server is fragile. Naming them was the
//   honest thing to do — but it left 44 gates that **no sweep has ever run**, and
//   "nobody knows what these say" is the largest unmeasured surface in the repo.
//
//   So: run them. SERIALLY, because they share one dev server, and one at a time
//   is the only way a fast-refresh remount can be attributed to the gate that saw
//   it. Every result is recorded — pass, fail, timeout and crash alike — with the
//   first failing row of each red, so the output is a scoreboard and not a claim.
//
// WHAT IT DOES NOT DO
//
//   It does not pass `--label=` to anything. That is deliberate: the bare
//   invocation is the one the next person types (channel I of the meta-gate), so
//   a bare red is exactly the fact worth surfacing. Where a gate NEEDS a label to
//   be meaningful, that is a finding about the gate, not about this file.
//
// Usage:
//   node scripts/verify/run-browser-battery.mjs                 # all of them
//   node scripts/verify/run-browser-battery.mjs --only=hero     # substring filter
//   node scripts/verify/run-browser-battery.mjs --timeout=420   # seconds per gate
//   node scripts/verify/run-browser-battery.mjs --list
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const VERIFY = join(ROOT, "scripts", "verify")
const has = (k) => process.argv.includes(`--${k}`)
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const ONLY = arg("only", "")
const TIMEOUT = Number(arg("timeout", "300")) * 1000

/* ── ONE INVENTORY, IMPORTED — never a second copy ─────────────────────────
 *
 * This used to restate `run-battery.mjs`'s discovery and classification: the
 * same `readdirSync`, the same `assert-*` filter, the same
 * `chromium.launch|playwright|puppeteer|// battery: browser` regex, written out
 * twice. The two runners are a PARTITION — every gate must land in exactly one
 * of them — and a partition maintained by two independent copies of one rule is
 * a partition that will eventually drop a gate into neither list with nothing to
 * say so. That is this repo's most expensive recurring defect (README §"a
 * pattern worth knowing"), aimed at the very files whose job is to notice it.
 *
 * Both halves now come from `run-battery.mjs`, which is also where the fix to
 * the directory scoping lives (it walks the REPO, not just `scripts/verify/`,
 * because `docs/storyboard/tools/assert-moment.mjs` was in no sweep).
 *
 * ── AND THE SHARED RULE IS NO LONGER A GREP ────────────────────────────────
 *
 * Sharing one copy of a rule stops the two lists DRIFTING apart. It does nothing
 * about the rule being wrong in both at once, and it was: the classifier matched
 * `chromium.launch|playwright|puppeteer|// battery: browser` against the file's
 * RAW TEXT, so a token in a string, a fixture, or a comment explaining the rule
 * decided the answer — and a gate that drove Chrome through a CHILD process was
 * invisible to it in the other direction. It is parsed now (`run-battery.mjs`,
 * "THE CLASSIFIER"), it calibrates against `lib/gate-fixtures/classify/` on every
 * run of either battery, and `partition()` asserts what sharing the rule was
 * always supposed to buy: every gate in exactly one list, model + browser =
 * discovered, overlap 0. A property true by construction is exactly the kind
 * nobody notices breaking. */
import { discover, isBrowser, rel, extraArgsFor, nodeArgsFor, partition, classify, classifySelfTest, reportPartition, readRows, failedAtZero, cleanGreen, tagOf, sweepExit, evidenceName } from "./run-battery.mjs"
/* PARTIAL is 3 in one place now. This file and `run-battery.mjs` each used to
 * declare it, and `lib/crash-row.mjs` needed the same number a third time. */
import { PARTIAL_EXIT } from "./lib/crash-row.mjs"

/* F104. The production channel of `assert-debug-surface-fenced` needs a real
 * `next build` served somewhere, and no runner ever handed it one, so every
 * battery ended PARTIAL on the fence that keeps the debug surface out of
 * production. A flag rather than an env var, because `assert-one-knob` channel C
 * allows exactly ONE port environment name in this repo and it is `FS_PORT`. */
const PROD_PORT = (() => {
  const hit = process.argv.find((a) => a.startsWith("--prod-port="))
  return hit ? hit.split("=")[1] : ""
})()

const ALL = discover()
const PART = partition(ALL)
const browser = PART.browser.filter((p) => (ONLY ? rel(p).includes(ONLY) : true))

if (has("list")) {
  reportPartition(ALL, PART)
  console.log(`BROWSER (${browser.length}):`)
  for (const p of browser) console.log(`  ${rel(p)}  — ${classify(p).why}`)
  process.exit(PART.problems.length ? 1 : 0)
}

/* THE SAME CALIBRATION THE MODEL RUNNER PAYS FOR, for the same reason: this file
 * is a claim about which gates need a browser, and that claim is worth what its
 * classifier is worth. ~0.5 s against a battery measured in minutes. */
if (!reportPartition(ALL, PART)) {
  console.log("\nRefusing to sweep on a broken partition — the list is what the sweep is ABOUT.")
  process.exit(1)
}
{
  const { ok, bad, rows } = classifySelfTest()
  if (!ok) {
    for (const r of rows) console.log(r)
    console.log(`\nNOT CALIBRATED — ${bad} of ${rows.length} wrong. Refusing to sweep on an unproven MODEL/BROWSER split.`)
    process.exit(1)
  }
  console.log(`classifier CALIBRATED — ${rows.length}/${rows.length} known answers\n`)
}

const OUT = join(ROOT, "docs", "verification", "gate-integrity")
/* F113: a filtered run writes its own record AND its own logs, so neither the
 * full `browser-battery.json` nor the per-gate transcripts beside it can end up
 * describing a run other than the full one. Rule and reasoning: `evidenceName()`
 * in `run-battery.mjs`. */
const RECORD = join(OUT, `${evidenceName("browser-battery", ONLY)}.json`)
const LOGS = join(OUT, evidenceName("browser-logs", ONLY))
mkdirSync(LOGS, { recursive: true })

function run(path) {
  const f = path.split("/").pop()
  return new Promise((resolve) => {
    const t0 = Date.now()
    /* THE SAME SPAWN THE MODEL RUNNER MAKES, imported rather than restated ,
     * including `--import lib/crash-row.mjs`, which turns a crash into a
     * `[crash] FAIL` row in the gate's own stdout. It matters more here: this
     * file is the one that WRITES the per-gate logs, and a log is where a crash
     * used to disappear. Two of the four browser reds in N4's battery died on
     * harness globals and neither left a row behind in its log. */
    const p = spawn("node", nodeArgsFor(path, { prodPort: PROD_PORT }), { cwd: ROOT })
    let out = ""
    p.stdout.on("data", (d) => (out += d))
    p.stderr.on("data", (d) => (out += d))
    const timer = setTimeout(() => {
      /* SIGKILL, not SIGTERM: a gate that has launched Chrome does not die on a
       * TERM it never handles, and the sweep inherits the hang. */
      p.kill("SIGKILL")
    }, TIMEOUT)
    p.on("close", (code) => {
      clearTimeout(timer)
      const ms = Date.now() - t0
      resolve({ f, code, ms, out, timedOut: ms >= TIMEOUT - 2000 })
    })
  })
}

console.log(`=== BROWSER BATTERY — ${browser.length} gates, SERIAL, ${TIMEOUT / 1000}s cap each ===\n`)

/* A ROW IS ONLY EVIDENCE IF THE RUN THAT PRINTED IT FINISHED — see the long note
 * in `run-battery.mjs` ("COUNTING"). It matters more here than there:
 * `assert-data-safety` prints 85 PASS rows from its model arms before its live
 * arm ever touches the app, and five more browser gates have the same shape
 * (`assert-rod-caps` 12, `assert-elbow` 7, `assert-form-orbit` 4,
 * `assert-fold-census` 3, `assert-taper-envelope` 3 — measured by Lane F against
 * a dead port). A scoreboard that sums rows across red runs reports that as
 * overwhelmingly green.
 *
 * And exit 3 is PARTIAL: the run reached no failure and no verdict either. */

/* ── THE BACKSTOP, MARKED AS AN INFERENCE ─────────────────────────────────
 * `lib/crash-row.mjs` emits from inside the gate and can name the throw. The one
 * thing it cannot survive is the SIGKILL above, so this file keeps a last line
 * of defence and signs it `[runner-synth]` rather than `[crash]`. It is printed
 * HERE and never appended to `r.out`, so it never enters the gate's log, its row
 * count, or `browser-battery.json`'s counts. A synthesised row that a reader
 * cannot tell from a real one would be a worse defect than the missing row. */
const guardMissedIt = ({ code, partial, fails }) => code !== 0 && !partial && fails === 0
const synthRow = ({ f, code, timedOut }) =>
  `[runner-synth] FAIL  ${f} ended at exit ${timedOut ? "SIGKILL (timed out)" : code} and printed no failing row.\n` +
  `[runner-synth]   SYNTHESISED BY run-browser-battery.mjs. The gate did not say this and lib/crash-row.mjs did\n` +
  `[runner-synth]   not reach it${timedOut ? ", a killed process gets no handler" : ""}. Counted nowhere: not in this gate's rows, not in its log.`

const logWriteFailures = []
const results = []
for (const path of browser) {
  const f = path.split("/").pop()
  const r = await run(path)
  /* ONE ROW PARSER, IMPORTED — the same rule the model runner uses, for the same
   * reason the classifier is shared. It counts a `[channel] FAIL` row (which
   * `assert-layer-flicker` emits three of) and `FAILED` as a verdict word, and it
   * separately NAMES failures announced in English rather than guessing how many
   * verdicts a sentence carries. See `run-battery.mjs`, "WHAT COUNTS AS A ROW". */
  const { rows, fails, announced } = readRows(r.out)
  const partial = r.code === PARTIAL_EXIT && !r.timedOut
  const guardMissed = guardMissedIt({ code: r.code, partial, fails })
  /* THE LOG IS A CONVENIENCE. THE VERDICT IS THE PRODUCT. F102: on 2026-09-05
   * macOS revoked this terminal's access to ~/Desktop mid-run (TCC), this line
   * threw EPERM on ONE transcript, and the whole battery died having already
   * judged 31 of 59 gates. All 31 were discarded, because a run that does not
   * finish is not evidence. A full disk, a read-only mount or a permissions
   * change all land here the same way, and none of them is a statement about
   * the code being graded.
   *
   * ⚠ NOT A SILENT `try {}`. A run whose transcripts vanished without a word is
   * its own trap, so it warns per gate, counts them, and the count is printed in
   * the summary, where a run with missing logs cannot be read as a clean one. */
  try {
    writeFileSync(join(LOGS, f.replace(/\.mjs$/, ".log")), r.out)
  } catch (e) {
    logWriteFailures.push({ gate: f, code: e.code ?? String(e) })
    console.log(`          ⚠ could not write the transcript for ${f} (${e.code ?? e}). The VERDICT is kept; the log is not.`)
  }
  results.push({ f, at: rel(path), code: r.code, ms: r.ms, rows, fails, announced, partial, timedOut: r.timedOut, guardMissed })
  const tag = tagOf({ ...r, rows, fails }, partial)
  console.log(
    `${tag.padEnd(9)} ${f.padEnd(34)} ${String(rows).padStart(3)} rows` +
      `${fails ? `, ${fails} red` : ""}` +
      `${announced.length ? `, ${announced.length} UNCOUNTED failure announcement(s)` : ""}` +
      `${r.code !== 0 && !partial && rows - fails > 0 ? `, ${rows - fails} PASS row(s) printed BEFORE it failed` : ""}` +
      `  ${(r.ms / 1000).toFixed(1)}s`,
  )
  if (r.code !== 0 || fails > 0) {
    const first = partial
      ? (r.out.match(/^.*\bUNSWEPT\b.*$/m) || ["  (exit 3 with no UNSWEPT line — see the gate's log)"])[0]
      : (r.out.match(/^.*(?:\*\*\* )?FAIL\b.*$/m) || [
          r.timedOut ? "  (timed out)" : "  (no FAIL row — non-zero exit without one)",
        ])[0]
    console.log(`          ${first.trim().slice(0, 150)}`)
  }
  if (guardMissed) console.log(synthRow({ f, code: r.code, timedOut: r.timedOut }))
}

const partialRuns = results.filter((r) => r.partial)
const red = results.filter((r) => r.code !== 0 && !r.partial)
const zeroRow = results.filter((r) => r.code === 0 && r.rows === 0)

if (partialRuns.length) {
  console.log(
    `\n--- PARTIAL (exit ${PARTIAL_EXIT}) — could not REACH a channel it set out to judge. NOT green: ---`,
  )
  for (const r of partialRuns) console.log(`  · ${r.f}`)
}

if (zeroRow.length) {
  console.log(`\n--- exited 0 having emitted NO PASS/FAIL row. That is not a pass, and it fails the sweep: ---`)
  for (const r of zeroRow) console.log(`  · ${r.f}`)
}
/* F113: a parsed FAIL row fails the gate whatever its exit code. The rule lives
 * in `run-battery.mjs` (`failedAtZero`, `sweepExit`) and is imported, not restated. */
const redAtZero = results.filter(failedAtZero)
if (redAtZero.length) {
  console.log(`\n--- 🔴 printed a FAIL row and EXITED 0. The row is the verdict, so these fail the sweep: ---`)
  for (const r of redAtZero) console.log(`  · ${r.f.padEnd(34)} ${r.fails} FAIL row(s) of ${r.rows}`)
}

if (red.length) {
  console.log(`\n--- RED (${red.length}), and what each printed before it failed: ---`)
  for (const r of red) {
    const before = r.rows - r.fails
    console.log(
      `  · ${r.f.padEnd(34)} exit ${String(r.timedOut ? "TIMEOUT" : r.code).padEnd(8)}` +
        (before > 0 ? `${before} PASS row(s) printed BEFORE the failure — not evidence` : `no passing rows`),
    )
  }
}

/* A FAILURE ANNOUNCED IN A FORM NO SCOREBOARD COUNTS — named, and RED when the
 * run that printed it went green anyway. */
const announcedAny = results.filter((r) => r.announced.length)
const announcedGreen = results.filter((r) => r.code === 0 && r.announced.length)
if (announcedAny.length) {
  console.log(
    `\n--- a FAILURE ANNOUNCED in a form the row parser cannot count (${announcedAny.length} gate(s)) ---`,
  )
  for (const r of announcedAny) {
    console.log(`  ${r.code === 0 ? "🔴 EXITED 0" : "   exit " + r.code}  ${r.f}`)
    for (const a of r.announced.slice(0, 2)) console.log(`        ${a}`)
  }
}
if (announcedGreen.length) {
  console.log(
    `\n🔴 ${announcedGreen.length} gate(s) ANNOUNCED A FAILURE AND EXITED 0 — a control reporting itself blind` +
      `\n   while its gate goes green. Counted as RED here.`,
  )
}

const guardMissed = results.filter((r) => r.guardMissed)
if (guardMissed.length) {
  console.log(
    `\n--- ${guardMissed.length} gate(s) exited non-zero with NO FAILING ROW even under the crash guard.` +
      `\n    The row below each is THIS FILE'S INFERENCE, not the gate's verdict: ---`,
  )
  for (const r of guardMissed) console.log(synthRow({ f: r.f, code: r.code, timedOut: r.timedOut }))
}

const greenRuns = results.filter(cleanGreen)
const rowsGreen = greenRuns.reduce((n, r) => n + r.rows, 0)
const rowsRed = red.reduce((n, r) => n + r.rows, 0)
const rowsPartial = partialRuns.reduce((n, r) => n + r.rows, 0)
const passRowsBeforeFailing = red.reduce((n, r) => n + (r.rows - r.fails), 0)
writeFileSync(
  RECORD,
  JSON.stringify(
    {
      when: new Date().toISOString(),
      filter: ONLY || null,
      partition: { discovered: ALL.length, model: PART.model.length, browser: PART.browser.length, overlap: 0 },
      counts: {
        green: greenRuns.length,
        partial: partialRuns.length,
        red: red.length,
        rowsGreen,
        rowsPartial,
        rowsRed,
        passRowsBeforeFailing,
        announcedFailuresUncounted: announcedAny.reduce((n, r) => n + r.announced.length, 0),
        announcedWhileGreen: announcedGreen.map((r) => r.f),
        failRowsAtExit0: redAtZero.map((r) => r.f),
        zeroRowAtExit0: zeroRow.map((r) => r.f),
      },
      /* BESIDE the counts, never inside them. */
      synthesised: guardMissed.map((r) => ({ f: r.f, code: r.code, timedOut: !!r.timedOut, by: "run-browser-battery.mjs", channel: "runner-synth" })),
      results,
    },
    null,
    2,
  ),
)

/* THE HEADLINE NEVER ADDS THE THREE TOGETHER. */
console.log(
  `\n${greenRuns.length}/${results.length} browser gates green, ${rowsGreen} rows on gates that finished clean.` +
    (partialRuns.length ? `\n${partialRuns.length} PARTIAL — ${rowsPartial} row(s), and a channel each could not reach. A SKIP IS NOT A PASS.` : ``) +
    (red.length
      ? `\n${red.length} RED — ${rowsRed} row(s), of which ${passRowsBeforeFailing} PASSED before the failure. Those are not evidence: the run that printed them did not finish.`
      : ``) +
    (announcedAny.length
      ? `\n${announcedAny.length} gate(s) announced a failure the row parser cannot count${announcedGreen.length ? `, ${announcedGreen.length} of them WHILE EXITING 0` : ""}.`
      : ``) +
    (redAtZero.length ? `\n${redAtZero.length} gate(s) printed a FAIL row and exited 0: RED.` : ``) +
    (zeroRow.length ? `\n${zeroRow.length} gate(s) exited 0 with no row at all: RED.` : ``) +
    /* F102. A run whose transcripts went missing must not read as a clean one. */
    (logWriteFailures.length
      ? `\n⚠ ${logWriteFailures.length} transcript(s) could NOT be written (${[...new Set(logWriteFailures.map((x) => x.code))].join(", ")}). ` +
        `The verdicts above stand; their logs are missing, so anything you cannot reproduce from this summary is gone: ` +
        `${logWriteFailures.map((x) => x.gate).join(", ")}`
      : ``),
)
console.log(`wrote ${RECORD}, logs in ${LOGS}${ONLY ? `  (filtered to "${ONLY}", the full record is untouched)` : ""}`)
/* Same three-way ladder as a gate, for the same reason: if the sweep collapsed
 * PARTIAL into 0, a gate that stopped exiting 1 for "I could not start" would
 * silently take the battery green on a tree nothing was measured against. */
process.exit(sweepExit(results))
