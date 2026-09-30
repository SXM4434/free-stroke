// A CRASH MUST BECOME A ROW, one guard, injected, never 101 hand edits.
//
// THE DEFECT (F25, measured by lane N4 across the full battery, re-derived by N11)
//
//   101 of the 103 gates `discover()` finds turn a crash into a non-zero exit
//   with NO FAIL ROW. Only `assert-data-safety.mjs:1784` and
//   `assert-stroke-schedule.mjs:1868` print a row when they die. N4 measured
//   98 of 100 on 2026-08-28; three gates have landed since and all three have
//   the bad shape, so the two numbers are the same finding at two commits.
//
//   Every scoreboard in this repo counts ROWS. A gate that crashes prints its
//   PASS rows, then dies. The scoreboard sees the passes and no failure, and
//   only the exit code carries the truth. N4's own battery log had to
//   special-case it:
//
//     FAIL(1)   assert-hero-word-legible.mjs   14 rows, 14 PASS row(s) printed
//               BEFORE it failed   129.9s
//               (no FAIL row — non-zero exit without one)
//
//   This is one level up from a trap the repo already knows. `verdict-rows.mjs`
//   records eight control rows that were invisible to every scoreboard because
//   `\bFAIL\b` does not match `FAILED`. A row in a format nothing parses is bad.
//   A verdict that never becomes a row at all is worse.
//
// WHY THIS IS A PRELOAD AND NOT A LINE IN 101 GATES
//
//   The gates are spread across nine lanes' ownership and three directories.
//   Adding `import "./lib/crash-row.mjs"` to each is 101 edits that six lanes
//   would have to review and that the next gate written would forget. Node's
//   `--import` puts this module in the child BEFORE the gate's first line, so
//   both runners cover every gate they run, including gates that do not exist
//   yet. Nothing in a gate changes and nothing in a gate can opt out by
//   accident.
//
//   THE ROW LANDS IN THE GATE'S OWN STDOUT, which is the half that matters. The
//   two runners already knew a red gate had no FAIL row and said so. What they
//   could not do is put the row where every OTHER reader looks: the per-gate
//   logs in `docs/verification/gate-integrity/browser-logs/`, a lane piping one
//   gate through `grep`, a person scrolling back. A row synthesised in the
//   runner's own output would fix the runner's summary and nothing else.
//
//   THE HONEST LIMIT, STATED: a bare `node scripts/verify/assert-x.mjs` typed by
//   hand does NOT load this. There is no repo-side hook for that short of
//   editing every gate or setting NODE_OPTIONS, and a bare run prints a stack
//   trace a person reads fine. A gate that wants the row bare adds one line:
//
//
//     import { install } from "./lib/crash-row.mjs"
//     install()
//
//   It is idempotent, so a gate that installs it AND runs under the preload
//   installs one guard and prints one row.
//
// WHAT IT WILL NOT DO, AND WHY EACH REFUSAL IS LOAD-BEARING
//
//   · IT NEVER FIRES ON EXIT 0. A green gate cannot gain a spurious row. That
//     is the inverse proof this change lives or dies on: the whole value of a
//     row is that somebody printed it on purpose, so a guard that sprays rows
//     onto clean runs would be a worse defect than the one it closes.
//   · IT NEVER FIRES ON EXIT 3. Three is PARTIAL in both runners: a channel the
//     run could not REACH. `assert-tsc-baseline` exits 3 against a dead port and
//     prints UNSWEPT, which is deliberately neither a pass nor a failure. A FAIL
//     row there would convert every partial into a red and inflate the count.
//   · IT NEVER FIRES WHEN A RED ROW IS ALREADY THERE. The predicate is
//     `redRe()` from `lib/verdict-rows.mjs`, the same function the scoreboards
//     count with, applied to this process's own output as it is written. So a
//     gate that failed honestly, and the two gates that already print their own
//     crash row, are untouched.
//   · IT NEVER CLAIMS THE SUBJECT FAILED. The row says the RUN ended without a
//     verdict, names the throw, and says who wrote it. `assert-stroke-schedule`
//     had the register right already: "FAIL  the gate itself threw — this is not
//     a measurement of the schedule".
//
// AND THE BETTER HALF, WHICH THIS CANNOT RETROFIT
//
//   `assert-data-safety` does something this guard cannot do for anyone:
//   `main()` asks whether §3's subject is reachable BEFORE the first row prints,
//   and turns "the app is not up" into an UNSWEPT line and exit 3 instead of 85
//   greens and a throw. A gate that validates its preconditions before printing
//   anything cannot mislead a scoreboard in the first place. This guard is the
//   floor for the 101 gates already written. Precondition-first is the rule for
//   the next one.
//
// Usage:
//   node --import <this file> <gate>          # what both runners do
//   node scripts/verify/lib/crash-row.mjs --selftest    # and channel L's spawn
//   node scripts/verify/lib/crash-row.mjs --selftest --break=no-guard
//   FS_NO_CRASH_ROW=1 node …                  # the negative control, by hand

import { writeSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { redRe } from "./verdict-rows.mjs"

/** PARTIAL. Both runners had their own `const PARTIAL_EXIT = 3`, and this guard
 *  needed a third copy of the same number. It is DEFINED here and imported by
 *  all three: a gate that could not reach a channel is not a gate that failed,
 *  and one place decides that. */
export const PARTIAL_EXIT = 3

/** The channel this guard signs its rows with. `verdict-rows.mjs`'s row rule
 *  admits a `[channel]` prefix (`assert-layer-flicker` prints `[calib] PASS`),
 *  so the row parses everywhere without widening any rule, and it says who
 *  wrote it in the first eight characters. */
export const CRASH_CHANNEL = "crash"

const flat = (x) => String(x).replace(/\s+/g, " ").trim()

/** THE ROW.
 *
 *  DELIBERATELY NOT SHARED WITH THE RUNNER'S BACKSTOP. `run-battery.mjs` writes
 *  its own sentence under its own channel, `[runner-synth]`, because the two say
 *  different things: this one is written from inside the gate and can name the
 *  throw, and that one is the runner inferring a failure it did not watch. One
 *  helper for both would make them look alike, which is the single thing a
 *  synthesised row must never do. */
export function crashRowText({ channel = CRASH_CHANNEL, code, why, rows = null }) {
  const head = `[${channel}] FAIL  ${why}`
  const said = rows === null ? "" : ` ${rows} row(s) had already printed.`
  return (
    `${head}\n` +
    `[${channel}]   exit ${code}, and no failing row was printed by the gate itself.${said}\n` +
    `[${channel}]   Written by scripts/verify/lib/crash-row.mjs when the process ended, not by the gate.\n` +
    `[${channel}]   It records that the run STOPPED. It is not a verdict on the subject, and any rows\n` +
    `[${channel}]   above it came from a run that did not finish.`
  )
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE GUARD
 *
 * Four ways a gate ends non-zero, and each needs its own hook. Measured against
 * the real shapes in this repo (`--selftest` runs one fixture per row):
 *
 *   main().catch(e => { console.error(e); process.exit(1) })   44 gates
 *       The rejection IS handled, so `unhandledRejection` never fires. Only a
 *       wrapper on `process.exit` sees it. This is the largest single shape and
 *       it is the one a naive uncaught-exception handler misses entirely.
 *   top-level await that rejects, no handler                   the ESM default
 *       Surfaces as `uncaughtException` during module evaluation on Node 25.
 *       Both events are hooked, because which one fires has moved between
 *       Node versions and this must not depend on that.
 *   a synchronous throw at module top level, or no top-level catch at all   57 gates
 *       `uncaughtException`. Node prints a stack and exits 1, and a stack is not a row.
 *   process.exitCode = 1, then a natural exit
 *       Neither event, and no call to `process.exit`. Caught on the `exit`
 *       event, where `console.log` CANNOT BE TRUSTED: stdout to a pipe is
 *       asynchronous on macOS and a write queued in an exit handler is dropped.
 *       `writeSync(1, …)` is the syscall and it always lands.
 *
 * SIGKILL is the one that has no hook at all. A gate the runner kills at its
 * timeout cap never gets a turn, so the runner keeps a backstop for exactly
 * that, marked as the runner's own inference.
 *
 * `process.abort()` IS THE SAME SHAPE AND IT IS NOT FIXABLE HERE. Measured on
 * 2026-08-28, Node 25.6.1: it raises SIGABRT with the disposition already reset,
 * so the child ends at `code === null, signal === "SIGABRT"`. No `exit` event
 * fires, no `uncaughtException` fires, and a `process.on("SIGABRT")` listener
 * does NOT run either — the same file that catches `process.kill(pid,
 * "SIGABRT")` in its own listener is stepped straight over by `process.abort()`.
 * There is no in-process hook to add, and inventing one would be a fix that
 * fakes it. The fixture below records the limit as a measurement, and the
 * runner's `[runner-synth]` backstop is where the row belongs: `run-battery.mjs`
 * asks `code !== 0 && !partial && fails === 0`, and a signal-killed child
 * reports `code === null`, so it fires.
 * ══════════════════════════════════════════════════════════════════════════ */

let installed = false

export function install({ exitFn = null } = {}) {
  if (installed || process.env.FS_NO_CRASH_ROW === "1") return false
  installed = true

  /* WAS A RED ROW ALREADY PRINTED? Asked with `redRe()`, the scoreboards'
   * function, not a second opinion about what red means. Line-buffered, because
   * a gate may write half a line at a time and a rule anchored at `^` would
   * miss a row split across two chunks. */
  let sawRed = false
  /* WHAT THE GATE SAID ON THE WAY OUT. Two readings, because a gate that does
   * `console.error(e)` prints the message on line one and its stack under it, so
   * the LAST line is a `node:internal` frame and says nothing. The error line is
   * preferred when there is one; the last line is the fallback for a gate that
   * refuses in plain English (`no capture at … — run _probe-pentip-sweep first`). */
  let lastErr = ""
  let lastErrorLine = ""
  const tail = { out: "", err: "" }
  const scan = (which, chunk) => {
    const s = tail[which] + String(chunk)
    const cut = s.lastIndexOf("\n")
    tail[which] = cut === -1 ? s : s.slice(cut + 1)
    const whole = cut === -1 ? "" : s.slice(0, cut + 1)
    if (!whole) return
    /* `indexOf` first: this runs on every write a gate makes, and the regex is
     * only worth building when the word is present at all. */
    if (whole.includes("FAIL") && redRe().test(whole)) sawRed = true
    if (which === "err") {
      const lines = whole.split("\n").filter((l) => l.trim())
      if (lines.length) lastErr = lines[lines.length - 1]
      for (const l of lines) if (/^\s*\w*(?:Error|Exception)\b/.test(l)) lastErrorLine = l
    }
  }
  for (const [which, stream] of [["out", process.stdout], ["err", process.stderr]]) {
    const real = stream.write.bind(stream)
    stream.write = (chunk, ...rest) => {
      try {
        scan(which, chunk)
      } catch {
        /* the guard may never be the reason a gate cannot print */
      }
      return real(chunk, ...rest)
    }
  }

  const said = () => flat(lastErrorLine || lastErr).slice(0, 300) || "(nothing on stderr)"
  const realExit = exitFn ?? process.exit.bind(process)
  let emitted = false

  /** Print the row, once.
   *
   *  `sync` decides HOW, and it is not a style choice. In normal flow, on a
   *  throw or a call to `process.exit`, `console.log` keeps the row in
   *  order behind everything the gate already queued. On the `exit` EVENT there
   *  is no normal flow left: stdout to a pipe is asynchronous on macOS and a
   *  write queued there is dropped, so that one path goes to fd 1 directly and
   *  accepts landing out of order rather than not landing. */
  const emit = ({ code, why, sync = false }) => {
    if (emitted || sawRed) return false
    emitted = true
    sawRed = true
    const text = crashRowText({ code, why })
    try {
      if (sync) writeSync(1, `${text}\n`)
      else console.log(text)
    } catch {
      /* fd 1 gone (the crash may have been the pipe). The exit code still
       * carries the truth, which is the state this whole guard improves on. */
    }
    return true
  }

  const fromThrow = (e, kind) => {
    /* Node's default handler prints the stack. Installing a listener suppresses
     * it, so print it first: swapping a stack trace for a one-line row would
     * trade one kind of blindness for another. */
    try {
      process.stderr.write(`${e && e.stack ? e.stack : String(e)}\n`)
    } catch {}
    emit({ code: 1, why: `the gate itself threw (${kind}): ${flat(e).slice(0, 300)}` })
    realExit(1)
  }
  process.on("uncaughtException", (e) => fromThrow(e, "uncaughtException"))
  process.on("unhandledRejection", (e) => fromThrow(e, "unhandledRejection"))

  process.exit = (code) => {
    const n = code ?? process.exitCode ?? 0
    if (n !== 0 && n !== PARTIAL_EXIT) {
      emit({
        code: n,
        why: `the gate ended at exit ${n} without a verdict: ${said()}`,
      })
    }
    return realExit(code)
  }

  process.on("exit", (code) => {
    if (code !== 0 && code !== PARTIAL_EXIT) {
      emit({
        code,
        why: `the gate ended at exit ${code} without a verdict: ${said()}`,
        sync: true,
      })
    }
  })
  return true
}

/* ── WHO GETS THE GUARD, AND WHO ONLY GETS THE CONSTANTS ───────────────────
 *
 * Installing on any import would wrap `process.exit` inside `run-battery.mjs`
 * too, and the runner imports this file for `PARTIAL_EXIT` and the row text. A
 * runner that refuses to sweep exits 1 having printed no row, so it would sign
 * its own refusal `[crash] FAIL` and put a row that looks like a GATE's into the
 * scoreboard's own output. The guard belongs in the CHILD.
 *
 * So the install is automatic in exactly one case: this module is the thing
 * `--import` loaded, which is what both runners do and what `process.execArgv`
 * says out loud. Anyone else asks:
 *
 *   import { install } from "./lib/crash-row.mjs"; install()
 *
 * ⚠️ And NOT when this file is the thing being RUN. The selftest spawns children
 * of itself and grades them; a guard wrapping the GRADER's own exit would be the
 * instrument measuring itself. */
export function loadedAsPreload() {
  const here = import.meta.url
  const base = pathToFileURL(process.cwd() + "/")
  const specs = []
  for (let i = 0; i < process.execArgv.length; i++) {
    const a = process.execArgv[i]
    if (a === "--import" || a === "--experimental-loader") specs.push(process.execArgv[i + 1])
    else if (a.startsWith("--import=")) specs.push(a.slice("--import=".length))
  }
  return specs.some((sp) => {
    if (!sp) return false
    try {
      return new URL(sp, base).href === here
    } catch {
      return false
    }
  })
}

/* ⚠️ PATH EQUALITY, NOT `endsWith`, AND IT COST A FORK BOMB TO LEARN.
 *
 * This read `process.argv[1].endsWith("crash-row.mjs")`. One selftest fixture is
 * named after the gate it models, `assert-data-safety-s-own-crash-row.mjs`, so
 * the CHILD matched too, ran the selftest, spawned its own children, and 331
 * node processes existed inside two minutes. That is this repo's own recorded
 * rule arriving from the inside: JUDGE BY WHAT A THING IS, NEVER BY WHAT ITS
 * NAME ENDS IN. `run-battery.mjs:910` had the correct form already and this is
 * the same line. Two more things stop it independently: the fixtures are named
 * `fx-N.mjs`, and a child cannot start a selftest at all (see FS_CRASH_ROW_SELFTEST). */
const IS_MAIN = !!(process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
if (!IS_MAIN && loadedAsPreload()) install()

/* ------------------------------------------------------------------------- *
 * SELFTEST, one fixture per real shape, each with a MUST-PRINT and the same
 * fixture under `FS_NO_CRASH_ROW=1` as its MUST-NOT.
 *
 * A guard that has only ever been run against crashing fixtures proves it can
 * print. It does not prove the row was missing before, and it does not prove a
 * clean run stays clean. Both directions are asserted here, on spawned child
 * processes, because that is how the runners invoke a gate and a guard proved
 * in-process would be proved on the wrong thing.
 *
 *   --break=no-guard   run every fixture WITHOUT the preload. Every crashing
 *                      one must then print NO row. If they still do, the
 *                      fixtures are not measuring this guard.
 * ------------------------------------------------------------------------- */

const FIXTURES = [
  {
    name: "handled rejection, then exit 1",
    why: "44 of the 101 have this shape. The rejection is handled, so no event fires and only the exit wrapper sees it.",
    src: `console.log("PASS  row one")\nasync function main(){ throw new Error("known-bad handled") }\nmain().catch((e)=>{ console.error(e); process.exit(1) })\n`,
    wantRow: true,
    wantCode: 1,
    ownReds: 0,
  },
  {
    name: "top-level await rejects, no handler",
    why: "the ESM default. Node 25 surfaces it as uncaughtException; both events are hooked so the version cannot matter.",
    src: `console.log("PASS  row one")\nawait Promise.reject(new Error("known-bad toplevel await"))\n`,
    wantRow: true,
    wantCode: 1,
    ownReds: 0,
  },
  {
    name: "synchronous throw at module top level",
    why: "the plainest crash there is, and the one N4's assert-hero-word-legible looked like from outside.",
    src: `console.log("PASS  row one")\nthrow new Error("known-bad sync throw")\n`,
    wantRow: true,
    wantCode: 1,
    ownReds: 0,
  },
  {
    name: "process.exitCode = 1, then a natural exit",
    why: "no event and no exit() call. Only the exit handler catches it, and only writeSync survives there.",
    src: `console.log("PASS  row one")\nprocess.exitCode = 1\n`,
    wantRow: true,
    wantCode: 1,
    ownReds: 0,
  },
  {
    name: "exit 2, refusing to grade",
    why: "28 sites in this repo. The gate says why on stderr and the scoreboard already calls it red; now the log agrees.",
    src: `console.log("PASS  row one")\nconsole.error("no capture on disk, refusing to grade")\nprocess.exit(2)\n`,
    wantRow: true,
    wantCode: 2,
    ownReds: 0,
  },
  // ---- must NOT gain a row ----
  {
    name: "a clean pass",
    why: "THE INVERSE, and the one this change lives or dies on. A green gate may never gain a row it did not print.",
    src: `console.log("PASS  row one")\nconsole.log("PASS  row two")\nprocess.exit(0)\n`,
    wantRow: false,
    wantCode: 0,
    ownReds: 0,
  },
  {
    name: "a clean pass that never calls exit",
    why: "same, through the exit event rather than the wrapper.",
    src: `console.log("PASS  row one")\n`,
    wantRow: false,
    wantCode: 0,
    ownReds: 0,
  },
  {
    name: "an honest failure that printed its own row",
    why: "the gate said FAIL itself. A second row would double-count a failure that was never hidden.",
    src: `console.log("PASS  row one")\nconsole.log("FAIL  the mark does not hold")\nprocess.exit(1)\n`,
    wantRow: false,
    wantCode: 1,
    ownReds: 1,
  },
  {
    name: "assert-data-safety's own crash row",
    why: "one of the two gates that already do this right, in miniature. It must not gain a second row.",
    src: `console.log("PASS  row one")\nconsole.log("FAIL  the run itself crashed after 1 row(s) had already printed — Error: x")\nprocess.exit(1)\n`,
    wantRow: false,
    wantCode: 1,
    ownReds: 1,
  },
  {
    name: "PARTIAL, exit 3",
    why: "a channel the run could not REACH. Not a pass and not a failure, a FAIL row here would turn every partial red.",
    src: `console.log("PASS  row one")\nconsole.log("UNSWEPT  §3 — the app is not up. NOT A PASS AND NOT A FAILURE.")\nprocess.exit(3)\n`,
    wantRow: false,
    wantCode: 3,
    ownReds: 0,
  },
  {
    /* ⚠ THE LIMIT, AS A MEASUREMENT RATHER THAN A SENTENCE. See the guard's
     * header: `process.abort()` cannot be caught from inside the process, so
     * this fixture asserts that it is NOT caught, and would go red the day that
     * changed. It is here so nobody has to take the claim on trust, and so the
     * one shape this guard genuinely does not cover is named in its own output
     * beside the ten it does. */
    name: "process.abort(), which no in-process hook can reach",
    why: "SIGABRT with the disposition reset: no exit event, no uncaughtException, and a process.on(\"SIGABRT\") listener does not run either. run-battery.mjs's [runner-synth] backstop owns this one — a signal-killed child reports code === null, which its `code !== 0` test catches.",
    src: `console.log("PASS  row one")\nprocess.abort()\n`,
    wantRow: false,
    wantCode: null,
    wantSignal: "SIGABRT",
    ownReds: 0,
  },
  {
    name: "a crash that prints FAIL in prose only",
    why: "prose is not a row. `verdict-rows.mjs` keeps the anchoring narrow on purpose, and the guard asks the same question it does.",
    src: `console.log("PASS  row one")\nconsole.log("this run may FAIL later, who knows")\nthrow new Error("known-bad prose")\n`,
    wantRow: true,
    wantCode: 1,
    ownReds: 0,
  },
]

async function selftest({ noGuard = false, named = false } = {}) {
  const { spawn } = await import("node:child_process")
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")

  const self = fileURLToPath(import.meta.url)
  const dir = mkdtempSync(join(tmpdir(), "crash-row-"))
  const rowOf = (out) => (out.match(new RegExp(`^\\[${CRASH_CHANNEL}\\] FAIL\\b.*$`, "m")) || [""])[0]
  let bad = 0
  let wentBare = 0
  const crashers = FIXTURES.filter((f) => f.wantRow).length

  console.log(`=== crash-row selftest, ${FIXTURES.length} spawned fixtures, one per real shape ===`)
  console.log(`    ${noGuard ? "WITHOUT the guard (--break=no-guard): every crash must print NO row" : "WITH the guard, injected exactly as the runners inject it"}`)
  console.log(`    invoked ${named ? "as \`--selftest\`, which is how channel L spawns it" : "bare, which does the same thing"}\n`)

  for (const [i, f] of FIXTURES.entries()) {
    /* `fx-N.mjs`, never the fixture's prose name. A fixture named after the gate
     * it models is how the child came to look like the parent. */
    const file = join(dir, `fx-${i}.mjs`)
    writeFileSync(file, f.src)
    const args = noGuard ? [file] : ["--import", pathToFileURL(self).href, file]
    const r = await new Promise((res) => {
      const p = spawn(process.execPath, args, { cwd: dir, env: { ...process.env, FS_CRASH_ROW_SELFTEST: "1" } })
      let out = ""
      p.stdout.on("data", (d) => (out += d))
      p.stderr.on("data", (d) => (out += d))
      /* THE SIGNAL, NOT JUST THE CODE. A child killed by a signal reports
       * `code === null`, and `null` is what the abort fixture is ABOUT. Grading
       * on the code alone cannot tell "died on SIGABRT" from "exited 0". */
      p.on("close", (code, signal) => res({ code, signal, out }))
    })
    const row = rowOf(r.out)
    /* WITHOUT the guard the answer must be NO ROW, whatever the fixture wanted.
     * That is the negative control and it is the whole proof: the six crashing
     * fixtures go from a row to nothing, which is F25 reproduced on demand. A
     * fixture that still prints one without the preload is measuring something
     * else. */
    const wantRow = noGuard ? false : f.wantRow
    const gotRow = !!row
    /* ⚠ THE COUNT THE SCOREBOARDS WOULD READ — AND IT USED TO BE PRINTED AND
     * NOT GRADED. An independent crosscheck on 2026-08-28 made the guard emit
     * its row TWICE; the fixtures printed `red-rows=2` in plain sight and the
     * selftest still said SOUND, because `ok` was `okRow && okCode` and `reds`
     * was decoration. A number a reader has to notice is not an assertion.
     *
     * The expectation is DERIVED, never a second hand-list: what the fixture's
     * own source prints, plus one if the guard is meant to add its row. So the
     * duplicate that got past this file is now `reds=2` against a wanted 1, and
     * a guard that stopped emitting is `reds=0` against a wanted 1. */
    const reds = (r.out.match(redRe()) || []).length
    const wantReds = f.ownReds + (wantRow ? 1 : 0)
    const okRow = gotRow === wantRow
    const okCode = r.code === f.wantCode
    const okSignal = (r.signal ?? null) === (f.wantSignal ?? null)
    const okReds = reds === wantReds
    const ok = okRow && okCode && okSignal && okReds
    if (!ok) bad++
    if (noGuard && f.wantRow) wentBare += gotRow ? 0 : 1
    console.log(
      `${ok ? "PASS" : "FAIL"}  row=${String(gotRow).padEnd(5)} exit=${String(r.signal ?? r.code).padEnd(7)} red-rows=${reds}/${wantReds}  ${f.name}` +
        `\n        ${f.why}` +
        (okRow ? "" : `\n        *** wanted row=${wantRow}, got ${gotRow} ***`) +
        (okCode ? "" : `\n        *** wanted exit ${f.wantCode}, got ${r.code} ***`) +
        (okSignal ? "" : `\n        *** wanted signal ${f.wantSignal ?? "none"}, got ${r.signal ?? "none"} ***`) +
        (okReds ? "" : `\n        *** wanted ${wantReds} red row(s) the scoreboards would count, got ${reds} ***`) +
        (row ? `\n        ${row.slice(0, 120)}` : ""),
    )
  }
  rmSync(dir, { recursive: true, force: true })

  if (noGuard) {
    const confirmed = wentBare === crashers && bad === 0
    console.log(
      confirmed
        ? `\nBREAK "no-guard" CONFIRMED, all ${crashers} crashing fixture(s) exit non-zero and print NO row` +
            `\n   without the preload. That is F25, reproduced on demand, and it is what the guard changes.`
        : `\nBREAK "no-guard" DID NOT BITE, ${crashers - wentBare} crashing fixture(s) still printed a row with` +
            `\n   no guard installed${bad ? `, and ${bad} case(s) went wrong besides` : ""}. The fixtures are measuring something else.`,
    )
    return confirmed ? 0 : 1
  }
  console.log(
    bad
      ? `\n${bad} of ${FIXTURES.length} wrong. The guard is NOT proved.`
      : `\nSOUND, ${FIXTURES.length} cases, ${FIXTURES.filter((f) => !f.wantRow).length} of them must-NOT-print. ` +
          `Run --break=no-guard to see the same fixtures go bare.`,
  )
  return bad
}

if (IS_MAIN) {
  /* A CHILD MAY NEVER START A SELFTEST. The selftest spawns children of this
   * same file, so any path by which a child re-enters this block is a fork bomb.
   * The path-equality check above closes the one that opened; this closes the
   * class. */
  if (process.env.FS_CRASH_ROW_SELFTEST === "1") {
    console.error("refusing to run the selftest inside a selftest child, that is the fork bomb")
    process.exit(2)
  }
  /* ⚠ `--selftest` NAMES THE RUN THIS FILE ALREADY DOES, and accepting it is
   * what puts the guard's own known-answer test into a SWEEP. Channel L in
   * `assert-gate-integrity.mjs` derives its subjects with `parsesSelftest` —
   * the flag and `argv` on one line — and spawns each with `--selftest`. Until
   * this line existed, the eleven fixtures below could only ever be run by
   * hand: the thing that turns 101 crashes into rows was itself in no sweep.
   * `lib/control-manifest.json` prescribes exactly this one-line fix for
   * `_probe-port-resolver.mjs`, which has the same shape. */
  const SELFTEST = process.argv.includes("--selftest")
  const flags = process.argv.slice(2)
  const brk = (flags.find((a) => a.startsWith("--break=")) ?? "").split("=")[1]
  const unknown = flags.filter((a) => a !== "--selftest" && !a.startsWith("--break="))
  if (unknown.length) {
    console.error(`unknown flag(s) ${unknown.join(" ")}; this file takes --selftest and --break=no-guard`)
    process.exit(2)
  }
  if (brk && brk !== "no-guard") {
    console.error(`unknown --break=${brk}, the only one is no-guard`)
    process.exit(2)
  }
  const bad = await selftest({ noGuard: brk === "no-guard", named: SELFTEST })
  process.exit(bad === 0 ? 0 : 1)
}
