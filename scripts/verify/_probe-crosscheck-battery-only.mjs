// PROBE: does `--only=<x>` on either battery replace the FULL record?
//
// F113 crosscheck, 2026-09-22. `run-battery.mjs --only=<x>` rewrote
// `docs/verification/gate-integrity/battery.json` as a one-gate file and the
// full 662-line record was gone. `run-browser-battery.mjs` had the same shape,
// and also overwrote the full run's per-gate transcript in `browser-logs/`.
//
// HOW IT MEASURES. A sandbox tree in the OS temp dir gets a copy of each runner
// and `lib/`, a `node_modules` link back to the repo, two tiny model gates and two
// tiny browser gates that print one PASS row and never launch anything. The full
// record and one full-run log are seeded with a sentinel. Each runner is then run
// with `--only=zzprobe-one`, once as it was at `--before` (default 38dcf238, the
// commit before the fix) and once as it is on disk.
//
//   MUST-FAIL  the old runner changes the sentinel record. If it does not, this
//              probe cannot see the defect and says so.
//   FIXED      the new runner leaves the sentinel record and log byte-identical.
//   POSITIVE   the new filtered run DID write its own record, with `filter` set,
//              so "untouched" cannot come from a run that wrote nothing.
//   POSITIVE   the new runner with NO filter does replace the sentinel, so the
//              probe can see a write to the full record when one happens.
//
// Plus one pair for IS_MAIN: through a symlinked path, the old model runner
// exited 0 having run nothing, and the new one must run.
//
// Exit 0 only when every row holds for BOTH runners. Nothing in the repo is written.
//
// Usage: node scripts/verify/_probe-crosscheck-battery-only.mjs [--before=<ref>] [--keep]
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, symlinkSync, cpSync, rmSync, realpathSync } from "node:fs"
import { execFileSync, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || "").slice(k.length + 3) || d
const BEFORE = arg("before", "38dcf238")
const KEEP = process.argv.includes("--keep")

const SENTINEL = JSON.stringify({ sentinel: "FULL RECORD, 662 lines in real life", model: [{ f: "assert-everything.mjs" }] }, null, 2)
const LOG_SENTINEL = "FULL-RUN TRANSCRIPT\nPASS  from the full run\n"

const MODEL_GATE = (n) => `// probe gate ${n}\nconsole.log("PASS  zzprobe ${n} model")\n`
const BROWSER_GATE = (n) =>
  `// probe gate ${n}\nimport { chromium } from "playwright-core"\n` +
  `if (process.env.ZZPROBE_NEVER_SET_THIS) { const b = await chromium.launch(); await b.close() }\n` +
  `console.log("PASS  zzprobe ${n} browser")\n`

function sandbox(version) {
  /* The UNRESOLVED temp path on purpose: on macOS /var is a symlink to /private/var,
   * which is what exposed the IS_MAIN defect below. */
  const T = mkdtempSync(join(tmpdir(), "fs-probe-battery-only-"))
  const V = join(T, "scripts", "verify")
  mkdirSync(V, { recursive: true })
  symlinkSync(join(ROOT, "node_modules"), join(T, "node_modules"))
  cpSync(join(ROOT, "scripts", "verify", "lib"), join(V, "lib"), { recursive: true })
  for (const f of ["run-battery.mjs", "run-browser-battery.mjs"]) {
    const src =
      version === "old"
        ? execFileSync("git", ["show", `${BEFORE}:scripts/verify/${f}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 })
        : readFileSync(join(ROOT, "scripts", "verify", f), "utf8")
    writeFileSync(join(V, f), src)
  }
  /* The runners' own calibration reads these two by path: the real known-bad
   * `assert-one-knob.mjs`, and `assert-gate-integrity.mjs` as a consumer of the
   * runner's exports. Without them both runners refuse to sweep, and a runner
   * that refuses writes nothing, which would read here as "record untouched". */
  for (const f of ["assert-one-knob.mjs", "assert-gate-integrity.mjs"]) cpSync(join(ROOT, "scripts", "verify", f), join(V, f))
  for (const n of ["one", "two"]) {
    writeFileSync(join(V, `assert-zzprobe-${n}.mjs`), MODEL_GATE(n))
    writeFileSync(join(V, `assert-zzprobe-${n}-browser.mjs`), BROWSER_GATE(n))
  }
  const OUT = join(T, "docs", "verification", "gate-integrity")
  mkdirSync(join(OUT, "browser-logs"), { recursive: true })
  writeFileSync(join(OUT, "battery.json"), SENTINEL)
  writeFileSync(join(OUT, "browser-battery.json"), SENTINEL)
  writeFileSync(join(OUT, "browser-logs", "assert-zzprobe-one-browser.log"), LOG_SENTINEL)
  return { T, V, OUT }
}

const run = (V, runner, args) => spawnSync("node", [join(V, runner), ...args], { cwd: dirname(dirname(V)), encoding: "utf8", timeout: 120000 })
const read = (p) => (existsSync(p) ? readFileSync(p, "utf8") : null)

let bad = 0
const row = (ok, what) => {
  if (!ok) bad++
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`)
}

const RUNNERS = [
  { runner: "run-battery.mjs", record: "battery.json", only: "battery-only.json", log: null },
  { runner: "run-browser-battery.mjs", record: "browser-battery.json", only: "browser-battery-only.json", log: join("browser-logs", "assert-zzprobe-one-browser.log") },
]

/* IS_MAIN. The model runner decides whether it is the entry point by comparing
 * its own path with argv[1]. Through a symlinked path the old comparison failed,
 * the sweep was skipped and the process exited 0 having written nothing. */
{
  console.log(`\n=== run-battery.mjs invoked through a symlinked path ===`)
  const V0 = sandbox("old")
  const link = V0.V !== realpathSync(V0.V)
  row(link, `setup  the sandbox path crosses a symlink (${V0.V} vs ${realpathSync(V0.V)})`)
  const r0 = run(V0.V, "run-battery.mjs", ["--only=zzprobe-one"])
  row(r0.status === 0 && read(join(V0.OUT, "battery.json")) === SENTINEL && !/BATTERY/.test(r0.stdout), `must-fail  ${BEFORE}'s runner through the link exits ${r0.status}, prints no sweep and writes nothing`)
  const V1 = sandbox("new")
  const r1 = run(V1.V, "run-battery.mjs", ["--only=zzprobe-one"])
  row(/BATTERY/.test(r1.stdout) && existsSync(join(V1.OUT, "battery-only.json")), `fixed  the runner on disk through the same link runs the sweep and writes its record (exit ${r1.status})`)
  for (const x of [V0, V1]) if (!KEEP) rmSync(x.T, { recursive: true, force: true })
}

for (const R of RUNNERS) {
  console.log(`\n=== ${R.runner} --only=zzprobe-one ===`)

  // MUST-FAIL: the runner as it was at BEFORE. Invoked through its REALPATH so
  // this arm measures the --only defect and not the IS_MAIN one.
  {
    const { T, V, OUT } = sandbox("old")
    const r = run(realpathSync(V), R.runner, ["--only=zzprobe-one"])
    const after = read(join(OUT, R.record))
    const logAfter = R.log ? read(join(OUT, R.log)) : null
    const wiped = after !== SENTINEL || (R.log && logAfter !== LOG_SENTINEL)
    row(wiped, `must-fail  ${BEFORE}'s runner replaces the full record on a filtered run (exit ${r.status}; record ${after === SENTINEL ? "UNCHANGED, probe is blind" : `now ${after ? after.split("\n").length : 0} lines, sentinel gone`}${R.log ? `; log ${logAfter === LOG_SENTINEL ? "kept" : "overwritten"}` : ""})`)
    if (!KEEP) rmSync(T, { recursive: true, force: true })
    else console.log(`      kept ${T}`)
  }

  // FIXED + POSITIVE: the runner on disk.
  {
    const { T, V, OUT } = sandbox("new")
    const r = run(V, R.runner, ["--only=zzprobe-one"])
    if (r.status !== 0) console.log(r.stdout.slice(-1500), r.stderr.slice(-800))
    row(r.status === 0, `filtered run exits 0 (got ${r.status})`)
    row(read(join(OUT, R.record)) === SENTINEL, `fixed  full ${R.record} byte-identical after the filtered run`)
    if (R.log) row(read(join(OUT, R.log)) === LOG_SENTINEL, `fixed  full-run transcript ${R.log} byte-identical`)
    let own = null
    try { own = JSON.parse(read(join(OUT, R.only)) || "null") } catch {}
    const ownRows = own ? (own.model || own.results || []).map((x) => x.f) : []
    row(own && own.filter === "zzprobe-one" && ownRows.length === 1, `positive  filtered run wrote ${R.only} with filter="zzprobe-one" and 1 gate (got ${own ? `filter=${JSON.stringify(own.filter)}, ${ownRows.length} gate(s): ${ownRows.join(", ")}` : "no file"})`)

    const full = run(V, R.runner, [])
    let rec = null
    try { rec = JSON.parse(read(join(OUT, R.record)) || "null") } catch {}
    /* Exit is not asserted: the unfiltered model run also runs the copied
     * assert-one-knob.mjs outside its repo. What matters is that it WROTE. */
    const n = rec ? (rec.model || rec.results || []).filter((x) => x.f.includes("zzprobe")).length : 0
    row(rec && rec.filter === null && n === 2, `positive  an unfiltered run DOES replace ${R.record}: filter=${rec ? JSON.stringify(rec.filter) : "?"}, ${n} of 2 probe gates (exit ${full.status})`)
    if (!KEEP) rmSync(T, { recursive: true, force: true })
    else console.log(`      kept ${T}`)
  }
}

console.log(`\n${bad === 0 ? "GREEN" : "RED"}  ${bad} failing row(s). Old runner must wipe, new runner must not, in both batteries.`)
process.exit(bad === 0 ? 0 : 1)
