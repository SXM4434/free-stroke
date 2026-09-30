/**
 * F113 finding 2, Codex 2026-09-18. `reapOrphans()` in `lib/browser.mjs`
 * matched ownership by substring and deleted a record whose kill failed. This
 * probe drives the REAL function with a fabricated registry, a fabricated ps
 * and a fake kill, so nothing on the machine is read or signalled.
 *
 *   node scripts/verify/_probe-crosscheck-browser.mjs     exit 0 = all arms as expected
 */
import { reapOrphans, ownsMarker } from "./lib/browser.mjs"

const REC = "--fs-browser=free-stroke:123:gate:1"
const scene = (o) => {
  // `in`, not a default, so an explicitly undefined marker stays undefined
  const { cmd, killErr = null, psThrows = false, stillAlive = true } = o
  const marker = "marker" in o ? o.marker : REC
  const kills = []
  const dropped = []
  const logs = []
  const out = reapOrphans({
    detail: true,
    records: [{ ownerAlive: false, marker, pids: [4242], file: "/fake/123-1.json" }],
    alive: () => stillAlive,
    commandOf: () => {
      if (psThrows) throw new Error("ps failed")
      return cmd
    },
    kill: (pid) => {
      if (killErr) throw Object.assign(new Error(killErr), { code: killErr })
      kills.push(pid)
    },
    drop: (f) => dropped.push(f),
    log: (m) => logs.push(m),
  })
  return { ...out, kills: kills.length, dropped: dropped.length, logs }
}

const chrome = (m) => `/Applications/Chrome.app/Contents/MacOS/Chrome --no-first-run ${m} --user-data-dir=/tmp/x`
const cases = [
  // known-good: our own orphan is still reaped and its record removed
  ["good: exact marker is reaped", scene({ cmd: chrome(REC) }), (r) => r.kills === 1 && r.dropped === 1],
  ["good: exact marker at the end of the command", scene({ cmd: `Chrome ${REC}` }), (r) => r.kills === 1],
  ["good: a label with spaces still matches whole", scene({ marker: "--fs-browser=free-stroke:1:a b:2", cmd: chrome("--fs-browser=free-stroke:1:a b:2") }), (r) => r.kills === 1],
  ["good: an unrelated reused pid is left alone and the record dropped", scene({ cmd: "/usr/sbin/somethingelse" }), (r) => r.kills === 0 && r.dropped === 1],
  ["good: kill says ESRCH (already gone), record dropped", scene({ cmd: chrome(REC), killErr: "ESRCH" }), (r) => r.dropped === 1],
  // Codex's mutations: must not kill / must keep the record
  ["codex: record :1 against a browser marked :10", scene({ cmd: chrome("--fs-browser=free-stroke:123:gate:10") }), (r) => r.kills === 0],
  ["codex: empty record marker against any command", scene({ marker: "", cmd: chrome(REC) }), (r) => r.kills === 0],
  ["codex: kill throws EPERM, record must be kept", scene({ cmd: chrome(REC), killErr: "EPERM" }), (r) => r.kills === 0 && r.dropped === 0 && r.kept === 1 && r.logs.some((l) => /could NOT kill/.test(l))],
  // the same class
  ["class: record marker is a PREFIX-extended copy (x--fs-browser=...)", scene({ cmd: chrome("x" + REC) }), (r) => r.kills === 0],
  ["class: missing marker (undefined)", scene({ marker: undefined, cmd: chrome(REC) }), (r) => r.kills === 0],
  ["class: bare --fs-browser= marker", scene({ marker: "--fs-browser=", cmd: chrome(REC) }), (r) => r.kills === 0],
  ["class: ps unreadable while the pid is alive keeps the record", scene({ cmd: "", psThrows: true }), (r) => r.dropped === 0],
]

let bad = 0
for (const [label, r, want] of cases) {
  const ok = want(r)
  if (!ok) bad++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (kills=${r.kills} dropped=${r.dropped} kept=${r.kept})`)
}
// direct unit rows on the matcher
const unit = [
  [ownsMarker(chrome(REC), REC), true],
  [ownsMarker(chrome(REC + "0"), REC), false],
  [ownsMarker(`${REC}0 ${REC}`, REC), true],
  [ownsMarker(chrome(REC), ""), false],
]
unit.forEach(([got, want], i) => {
  if (got !== want) bad++
  console.log(`${got === want ? "PASS" : "FAIL"}  ownsMarker unit ${i + 1}: ${got} (want ${want})`)
})
console.log(`\n_probe-crosscheck-browser: ${cases.length + unit.length - bad} of ${cases.length + unit.length} arms as expected`)
process.exit(bad ? 1 : 0)
