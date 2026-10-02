// ASSERT-TSC-BASELINE — the typecheck matches the baseline EXACTLY, in both directions.
//
// ── WHY THIS EXISTS, AND IT IS NOT "run tsc again" ──────────────────────────
//
// 2026-08-04, ~4 hours of the app being down and nobody noticing:
// `lib/texture-shader.ts` :763 carried backticks around `` `fsTexPeriod` `` in a
// GLSL comment **inside** `TEXTURE_COMMON_GLSL`'s template literal (opened :367,
// closed :997). The backticks terminated the string. Both routes served HTTP
// 500 and `tsc --noEmit` reported:
//
//     lib/texture-shader.ts(763,59): error TS1005: ',' expected.
//     lib/texture-shader.ts(763,70): error TS1005: ',' expected.
//                                                        ^ TWO errors.
//
// **The documented baseline is SIX.** So the count went DOWN, and every habit in
// this repo reads a smaller number as better. It is not better: a parse error
// stops the compiler before it ever reaches the six known errors, so the count
// falling to 2 meant the file had stopped being readable. A lane, a controller
// and a battery all looked at "2" and moved on.
//
// This is the same shape as the sixth bug pattern in docs/README.md — a check
// that cannot report the failure it exists for — except the check was a HUMAN
// habit rather than a script: "is tsc still 6?" was being read as "is tsc <= 6?"
//
// ── WHAT THE SIX ARE ────────────────────────────────────────────────────────
//
// They are deliberate and documented, and this gate does NOT ask you to fix
// them — it asks that they all still be REACHED:
//
//   5 x lib/geometry-engines.ts   the Solid diagnostics reading fields that do
//                                 not exist. HANDOFF §3.5: "they are the only
//                                 signal that defect emits; silencing them makes
//                                 it invisible, not true."
//   1 x lib/dd-engine/handFeel.ts `perfect-freehand` has no type declarations.
//
// ── WHY IT ALSO PINGS THE ROUTES ────────────────────────────────────────────
//
// Explainer 20 §8: *"The typecheck passing is not evidence that the app
// builds."* The backtick break proves the sharper version — the typecheck
// *changing* is not evidence either, in either direction. A syntax error is one
// of the few faults that shows up in both channels, so the cheapest honest
// answer is to read both: the count must equal the baseline, AND the two routes
// must serve. Either alone would have missed something this week.
//
// ── AND WHY A RUN THAT COULD NOT REACH THE ROUTES EXITS 3 ──────────────────
//
// Measured by Lane F on 2026-08-07 against a dead port: this was **the one gate
// of 32 that stayed GREEN pointed at a server that was not there.** It printed
//
//     PASS  the typecheck is EXACTLY the baseline (6) …
//     PASS  …and they are the same six, in the same two files …
//     SKIP  / — no dev server on :3199 (ERR TypeError: fetch failed)
//     SKIP  /desk-doodles — no dev server on :3199 (ERR TypeError: fetch failed)
//     TSC BASELINE HOLDS                                              (exit 0)
//
// and the battery above it printed `pass  assert-tsc-baseline  2 rows`. F
// reported it rather than editing it, which was right — it was not F's file, and
// "it has a good reason" is not the same as "it is right".
//
// The reason IS good and it is not the question. The question is whether a run
// that could not reach the tree it names may exit 0 while printing rows that
// look like a verdict about that tree. DISPATCH §3:116: **a SKIP is not a pass.**
// An operator reading only the exit code could not tell "the typecheck passed AND
// both routes served" from "the typecheck passed, both routes unreachable" — and
// the exit code is what a sweep reads.
//
// So there are three outcomes, not two:
//
//   0  every channel this run set out to judge was judged, and passed.
//   1  a judgement FAILED. A real failure outranks a partial, always.
//   3  PARTIAL — nothing failed and something was never reached. The run prints
//      an `UNSWEPT` line naming each channel and what would answer it, and both
//      batteries report it as PARTIAL: never folded into the green count, never
//      counted as red either, because nothing here failed.
//
// `--no-http` exits 3 as well, deliberately. It is the operator WITHDRAWING the
// question rather than the environment eating it, and the distinction is real —
// but if the flag bought an exit 0 it would be a switch for turning a partial run
// green, which is the one thing this file must not have. No sweep passes it
// (`EXTRA_ARGS` in run-battery.mjs is empty), so a bare run is always the fuller
// one; explainer 29 §1 classifies `--no-http` as an INVERTED flag for that reason.
//
// ⚠ CONSEQUENCE, STATED RATHER THAN HIDDEN: exit 3 is non-zero, so
// `assert-gate-integrity.mjs` channel I ("every model gate, typed with no
// arguments") will read a partial run as a bare RED in any tree with no dev
// server, which is every lane tree. Channel I is not this lane's file. The diff
// teaching it that 3 is PARTIAL is handed over with this change; until it lands,
// that row is a known false red and is named in the return rather than worked
// around here.
//
// Usage: node scripts/verify/assert-tsc-baseline.mjs [--expect=6] [--no-http]
// battery: model
import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// DISPATCH §3 — one knob, one name. This gate ALREADY honoured FS_PORT, via its
// own private `process.env.FS_PORT || 3000`, and that is the subtler half of the
// defect: a private copy of the port line opts out of the THROW that
// lib/dev-server.mjs exists to provide (`:40-55`). Set HERO_URL — the legacy
// name muscle memory still reaches for — and this gate silently ignored it and
// measured :3000 with no error. "Reads FS_PORT" was never the bar; "imports the
// shared resolver" is. Found by Lane E on assert-drawin-attrs.mjs, same night.
import { PORT } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const EXPECT = parseInt(arg("expect", "6"), 10)
const NO_HTTP = process.argv.includes("--no-http")

/* The known six, by file. Counting per-file is what turns "6" from a number
 * into a claim: six errors in one file is not this baseline even though the
 * total matches. */
const EXPECTED_BY_FILE = {
  "lib/geometry-engines.ts": 5,
  "lib/dd-engine/handFeel.ts": 1,
}

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* A channel this run set out to judge and could not reach. Deliberately NOT a
 * PASS/FAIL row — both batteries count those, and an unanswered question is
 * neither. The token `UNSWEPT` is what the runners print beside the PARTIAL tag,
 * so it names the channel AND what would answer it. */
const unswept = []
const unsweptRow = (what, why, fix) => {
  unswept.push(what)
  console.log(`UNSWEPT  ${what} — ${why}. NOT A PASS AND NOT A FAILURE: nothing was measured. ${fix}`)
}

/* `--noEmit` exits non-zero whenever there are errors, which is every run here
 * by design, so the status is ignored and the OUTPUT is the subject. */
let out = ""
try {
  out = execFileSync("npx", ["--no-install", "tsc", "--noEmit"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 32 * 1024 * 1024,
  })
} catch (e) {
  out = String(e.stdout ?? "") + String(e.stderr ?? "")
}

const lines = out.split("\n").filter((l) => /error TS\d+/.test(l))
const total = lines.length

const byFile = {}
for (const l of lines) {
  const m = l.match(/^(.+?)\(\d+,\d+\)/)
  if (m) byFile[m[1]] = (byFile[m[1]] ?? 0) + 1
}

/* THE ROW THIS FILE EXISTS FOR. Equality, not a ceiling. */
say(
  total === EXPECT,
  `the typecheck is EXACTLY the baseline (${EXPECT}) — a count BELOW it means the compiler stopped early`,
  total === EXPECT
    ? `${total} errors, as documented`
    : total < EXPECT
      ? `${total} errors — BELOW baseline. This is not an improvement: a parse error halts tsc before it reaches the known ${EXPECT}. First error: ${lines[0]?.trim() ?? "(none)"}`
      : `${total} errors — ${total - EXPECT} more than baseline. New: ${lines.filter((l) => !/geometry-engines|handFeel/.test(l))[0]?.trim() ?? "(see output)"}`,
)

/* ...and they are the SAME six, in the same files. A total that matches while
 * the files have changed is a different baseline wearing this one's number. */
const fileProblems = []
for (const [f, n] of Object.entries(EXPECTED_BY_FILE)) {
  const got = byFile[f] ?? 0
  if (got !== n) fileProblems.push(`${f}: ${got} (expected ${n})`)
}
for (const f of Object.keys(byFile)) {
  if (!(f in EXPECTED_BY_FILE)) fileProblems.push(`${f}: ${byFile[f]} UNEXPECTED FILE`)
}
say(
  fileProblems.length === 0,
  "…and they are the same six, in the same two files",
  fileProblems.length === 0
    ? Object.entries(byFile).map(([f, n]) => `${f} ${n}`).join(" · ")
    : fileProblems.join(" · "),
)

/* THE OTHER CHANNEL. A syntax error takes the routes down too, and the routes
 * catch things the typecheck cannot (a worker URL that does not resolve, a
 * module cycle that deadlocks the bundler). Skippable so the gate still runs
 * in a battery with no server, but the skip is PRINTED — a silent skip is how
 * `verify-gates` once reported ALL PASS with every geometry gate skipped. */
if (NO_HTTP) {
  unsweptRow(
    "the route channel",
    "--no-http was passed, so this run proves the typecheck only",
    `Drop the flag with a server up: FS_PORT=${PORT} node scripts/verify/assert-tsc-baseline.mjs`,
  )
} else {
  for (const path of ["/", "/desk-doodles"]) {
    let status = "unreachable"
    try {
      const r = await fetch(`http://localhost:${PORT}${path}`, { signal: AbortSignal.timeout(120000) })
      status = String(r.status)
    } catch (e) {
      status = `ERR ${String(e).slice(0, 60)}`
    }
    if (status === "unreachable" || status.startsWith("ERR")) {
      unsweptRow(
        `${path} on :${PORT}`,
        `nothing is listening (${status})`,
        `Start it — \`node node_modules/next/dist/bin/next dev --webpack -p ${PORT}\` — and re-run.`,
      )
    } else {
      say(status === "200", `${path} still serves`, `HTTP ${status}`)
    }
  }
}

/* A REAL FAILURE OUTRANKS A PARTIAL. Exit 3 means "nothing failed and something
 * was never reached"; if anything failed, the answer is 1 and the partial is
 * detail. */
if (!pass) {
  console.log("\nTSC BASELINE BROKEN")
  process.exit(1)
}
if (unswept.length) {
  console.log(
    `\nPARTIAL — the typecheck holds and ${unswept.length} channel(s) were NEVER REACHED: ${unswept.join(", ")}.` +
      `\nExiting 3, not 0. A SKIP IS NOT A PASS (DISPATCH §3:116), and an exit code is what a sweep reads.`,
  )
  process.exit(3)
}
console.log("\nTSC BASELINE HOLDS — typecheck and both routes, all swept")
process.exit(0)
