// THE HALF THAT SURVIVES `kill -9`, AND IT WAS NOT ON DISK.
//
// `lib/browser.mjs:77` says "See `scripts/verify/sweep-browsers.mjs`".
// `assert-one-browser.mjs:475` says "The record left behind is what
// sweep-browsers.mjs reads". `docs/explainers/44-the-window-that-outlived-its-
// lane.md` §5 documents its three commands and its eleven controls. Measured
// 2026-08-28: the file did not exist, and nothing in the repo read the registry
// except the launcher that writes it. A door that lies is worse than no door,
// and this one was cited three times.
//
// WHAT IT IS FOR. 2026-08-07 left 93 orphaned Chromes, 4h48m old, spawned ~20 s
// apart, by lanes that died on a session limit. A session limit IS a `kill -9`:
// no handler in the dying process gets a turn, so the launcher's teardown cannot
// help. The registry record in the OS temp dir outlives it, and this reads it.
//
// TWO CHANNELS, BOTH DELIBERATE (explainer 44 §5):
//   1 · a registry record per launch, naming owner pid, script, tree and browser
//       pids. A record whose owner pid is dead is an orphan by definition. It
//       spans trees on purpose: the 93 came from four lanes.
//   2 · a marker switch `--fs-browser=<tree>:<ownerPid>:<label>:<n>` on the
//       browser's own command line, so attribution never depends on
//       `--disable-field-trial-config`, an internal Playwright flag that is
//       nobody's contract.
//
// THE TWO LESSONS THAT COST SOMETHING, both permanent rows in --selftest:
//   · THE MARKER MUST START A WHOLE ARGV TOKEN. The first live run swept the
//     process that PLANTED the orphan, because its command line contained the
//     marker inside a quoted script body and the check was `indexOf`. A sweep
//     that kills a process for MENTIONING a string is a grep defect with a
//     `kill -9` on the end of it.
//   · THE SWEEPER EXCLUDES ITSELF, by pid and by script name.
//
// AND IT KILLS NOTHING UNLESS TOLD TO. Bare is a dry run by construction.
//
//   node scripts/verify/sweep-browsers.mjs            names them; kills nothing
//   node scripts/verify/sweep-browsers.mjs --kill     kills only the orphans
//   node scripts/verify/sweep-browsers.mjs --legacy   ALSO the pre-marker Chromes
//   node scripts/verify/sweep-browsers.mjs --selftest the eleven controls
//
// `--legacy` is the only channel that could have seen the 93, because they
// predate the marker. It is behind a flag and every row it produces is labelled
// `legacy-heuristic`, because a heuristic that runs by default is a heuristic
// that kills somebody's real browser one morning.
import { execFileSync } from "node:child_process"
import { basename } from "node:path"
import { readRegistry, isAlive, unregister } from "./lib/browser.mjs"

const MARKER = "--fs-browser="
const LEGACY_FLAG = "--disable-field-trial-config"
const SELF = basename(new URL(import.meta.url).pathname)

/** The marker's value, but ONLY when it opens a whole argv token. `indexOf` here
 *  is what swept the planter, so tokenise first and never search the string. */
export function markerOf(command) {
  for (const tok of String(command).split(/\s+/)) {
    if (tok.startsWith(MARKER)) return tok.slice(MARKER.length)
  }
  return null
}

/**
 * THE JUDGEMENT, AS A PURE FUNCTION — a `ps` table and a registry in, rows out.
 * No process is read and none is signalled, so the eleven controls can drive it
 * with fabricated input on a machine where nothing may be killed.
 *
 * @param {{ps: {pid:number, ppid:number, command:string}[], records: any[],
 *          selfPid: number, alive: (pid:number)=>boolean, legacy?: boolean}} o
 */
export function judge({ ps, records, selfPid, alive, legacy = false }) {
  const excluded = (p) => p.pid === selfPid || p.command.includes(SELF)
  const rows = []
  const seen = new Set()

  for (const p of ps) {
    if (excluded(p)) continue
    const marker = markerOf(p.command)
    if (!marker) continue
    seen.add(p.pid)
    const ownerPid = Number(marker.split(":")[1])
    rows.push({
      pid: p.pid,
      ppid: p.ppid,
      owner: ownerPid,
      ownerAlive: alive(ownerPid),
      marker,
      channel: "marker",
      orphan: !alive(ownerPid),
    })
  }

  // channel 2: a record whose owner is gone, for pids `ps` did not show as marked
  for (const rec of records) {
    const ownerAlive = alive(rec.ownerPid)
    for (const pid of rec.pids ?? []) {
      if (seen.has(pid)) continue
      const row = ps.find((p) => p.pid === pid)
      if (!row || excluded(row)) continue
      seen.add(pid)
      rows.push({
        pid,
        ppid: row.ppid,
        owner: rec.ownerPid,
        ownerAlive,
        marker: rec.marker ?? null,
        channel: "registry",
        orphan: !ownerAlive,
      })
    }
  }

  if (legacy) {
    for (const p of ps) {
      if (excluded(p) || seen.has(p.pid)) continue
      if (!p.command.includes(LEGACY_FLAG)) continue
      if (markerOf(p.command)) continue
      rows.push({ pid: p.pid, ppid: p.ppid, owner: null, ownerAlive: false, marker: null, channel: "legacy-heuristic", orphan: true })
    }
  }

  // a record naming no live process at all is spent paperwork, not an orphan
  const stale = records.filter((r) => !alive(r.ownerPid) && !(r.pids ?? []).some((pid) => ps.some((p) => p.pid === pid)))
  return { rows, stale }
}

function readPs() {
  try {
    return execFileSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 })
      .split("\n")
      .map((l) => l.match(/^\s*(\d+)\s+(\d+)\s+(.*)$/))
      .filter(Boolean)
      .map((m) => ({ pid: Number(m[1]), ppid: Number(m[2]), command: m[3] }))
  } catch {
    return []
  }
}

// ── the eleven controls ────────────────────────────────────────────────────
if (process.argv.includes("--selftest")) {
  let bad = 0
  const row = (ok, name, detail) => {
    if (!ok) bad++
    console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  —  ${detail}` : ""}`)
  }
  const P = (pid, ppid, command) => ({ pid, ppid, command })
  const M = (owner, n = 1) => `--fs-browser=free-stroke:${owner}:gate.mjs:${n}`
  // 4242 is the one owner still running; every other pid is gone.
  const alive = (pid) => pid === 4242
  const run = (o) => judge({ selfPid: 1000, alive, ...o })

  const clean = run({ ps: [P(2, 1, "/usr/sbin/cupsd"), P(3, 1, "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")], records: [] })
  row(clean.rows.length === 0, "1 · a clean machine produces nothing", `${clean.rows.length} row(s)`)

  const bystander = run({ ps: [P(9, 1, `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome ${LEGACY_FLAG}`)], records: [] })
  row(bystander.rows.length === 0, "2 · KNOWN-BAD · a bystander Chrome is NOT swept without --legacy", `${bystander.rows.length} row(s)`)

  const legacyOn = judge({ ps: [P(9, 1, `Google Chrome ${LEGACY_FLAG}`)], records: [], selfPid: 1000, alive, legacy: true })
  row(legacyOn.rows.length === 1 && legacyOn.rows[0].channel === "legacy-heuristic", "3 · --legacy finds it AND labels every row", legacyOn.rows[0]?.channel)

  const live = run({ ps: [P(20, 1, `Chrome ${M(4242)}`)], records: [] })
  row(live.rows.length === 1 && live.rows[0].orphan === false, "4 · a marked browser whose OWNER IS ALIVE is named, not orphaned", `orphan=${live.rows[0]?.orphan}`)

  const orphan = run({ ps: [P(21, 1, `Chrome ${M(999999)}`)], records: [] })
  row(orphan.rows.length === 1 && orphan.rows[0].orphan === true, "5 · a marked browser whose owner is GONE is an orphan", `owner ${orphan.rows[0]?.owner}`)

  // THE ONE THAT COST SOMETHING. The first live run swept the process that
  // PLANTED the orphan, because the marker sat inside a quoted script body and
  // the check was `indexOf`. Tokenised, that string opens no token.
  const planter = run({ ps: [P(22, 1, `node -e "spawn('chrome', ['${M(999999)}'])"`)], records: [] })
  row(
    planter.rows.length === 0,
    "6 · KNOWN-BAD · the process that PLANTED an orphan is not swept for quoting the marker",
    `${planter.rows.length} row(s)`,
  )
  const mentioned = run({ ps: [P(23, 1, `node --eval=console.log("${M(999999)}")`)], records: [] })
  row(mentioned.rows.length === 0, "7 · KNOWN-BAD · a process that only MENTIONS the marker mid-token is NOT swept", `${mentioned.rows.length} row(s)`)

  const self = run({ ps: [P(1000, 1, `node scripts/verify/${SELF} --kill`), P(24, 1, `node ${SELF} ${M(999999)}`)], records: [] })
  row(self.rows.length === 0, "8 · KNOWN-BAD · the sweeper never sweeps itself, by pid OR by name", `${self.rows.length} row(s)`)

  const viaRecord = run({ ps: [P(30, 1, "Chrome Helper (Renderer)")], records: [{ ownerPid: 999999, pids: [30], marker: M(999999) }] })
  row(viaRecord.rows.length === 1 && viaRecord.rows[0].channel === "registry", "9 · the REGISTRY finds a browser whose command line lost the marker", viaRecord.rows[0]?.channel)

  const both = run({ ps: [P(31, 1, `Chrome ${M(999999)}`)], records: [{ ownerPid: 999999, pids: [31], marker: M(999999) }] })
  row(both.rows.length === 1, "10 · a browser on BOTH channels is one row, not two", `${both.rows.length} row(s)`)

  const spent = run({ ps: [], records: [{ ownerPid: 999999, pids: [77], marker: M(999999) }] })
  row(spent.rows.length === 0 && spent.stale.length === 1, "11 · a record naming no live process is spent paperwork, not a kill", `${spent.stale.length} stale record(s)`)

  console.log(`\nsweep-browsers selftest: ${bad === 0 ? "SOUND — 11 controls, 5 of them known-bad" : `${bad} control(s) DID NOT HOLD`}`)
  process.exit(bad === 0 ? 0 : 1)
}

// ── the live sweep ─────────────────────────────────────────────────────────
const legacy = process.argv.includes("--legacy")
const kill = process.argv.includes("--kill")
const { rows, stale } = judge({ ps: readPs(), records: readRegistry(), selfPid: process.pid, alive: isAlive, legacy })
const orphans = rows.filter((r) => r.orphan)

if (rows.length === 0 && stale.length === 0) {
  console.log("nothing to sweep.")
  process.exit(0)
}
console.log(`marked browser processes: ${rows.length}  ·  orphans: ${orphans.length}${legacy ? "  ·  --legacy ON" : ""}`)
for (const r of rows.sort((a, b) => a.pid - b.pid)) {
  const tag = r.orphan ? "ORPHAN" : "  live"
  console.log(
    `  ${tag}  pid ${String(r.pid).padStart(7)}  ppid ${String(r.ppid).padStart(7)}  owner ${r.owner ?? "?"} ${r.ownerAlive ? "alive" : "GONE"}  [${r.channel}]  ${r.marker ?? ""}`,
  )
}
for (const s of stale) console.log(`  spent   record ${s.file} — owner ${s.ownerPid} gone and none of its browser pids is running`)

if (!kill) {
  console.log(`\nDRY RUN. Nothing was signalled. Add --kill to end the ${orphans.length} orphan(s).`)
  process.exit(0)
}
let killed = 0
for (const r of orphans) {
  try {
    process.kill(r.pid, "SIGKILL")
    killed++
  } catch {
    /* already gone, which is the outcome we wanted */
  }
}
for (const s of stale) unregister(s.file)
console.log(`\nkilled ${killed} process(es) · cleared ${stale.length} spent record(s)`)
