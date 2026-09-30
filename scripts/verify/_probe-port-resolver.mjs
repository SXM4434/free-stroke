// CAN THE PORT RESOLVER SAY NO?
//
// `lib/dev-server.mjs` now DERIVES the port from the dev server whose working
// directory is this checkout. That is a new way to land on the wrong port, so it
// gets what DISPATCH §2.6 asks of every instrument here: a known-bad input, and
// a requirement that it fails on exactly that.
//
// The one that matters is arm 2. Point the resolver at a machine where the only
// server belongs to SOMEBODY ELSE'S tree and it must fall back to 3000, so the
// gate above it reports UNSWEPT. Discovery is allowed to find a server. It is
// never allowed to invent a pass.
//
//   node scripts/verify/_probe-port-resolver.mjs
//   node scripts/verify/_probe-port-resolver.mjs --selftest   ← the same run
//
// `--selftest` IS THE BARE RUN, AND IT IS PARSED SO THAT CHANNEL L CAN SEE THIS
// FILE AT ALL. `assert-gate-integrity`'s channel L derives its set rather than
// keeping a list: any `.mjs` under `scripts/verify` that is not `assert-*` and
// parses a `--selftest` flag. A derived set cannot go stale the way a list does,
// but it can only find what announces itself, and this file announced nothing.
//
// It is NOT renamed to `assert-*`, deliberately. About 200 `_probe-*` scripts
// here are hand-run diagnostics, so renaming one to join a sweep argues the
// other 199 should follow. One flag joins by convention and costs nobody a
// rename. There is no second mode and no second code path: the flag is read and
// discarded, so a run that passes it and a run that does not are the same run.
import { spawnSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { resolvePort, readListeners, ROOT } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
// The two trees are DERIVED from this checkout, never typed. A literal absolute
// path here would be caught by `assert-one-knob` channel F, and rightly: a fixture
// that names a checkout is the same defect as a tool that does, one level down.
const MINE = ROOT
const THEIRS = join(ROOT, "..", "somebody-elses-clone")

// Read and discard. See the header: the flag exists to be FOUND, not to branch.
process.argv.slice(2).includes("--selftest")

let bad = 0
const row = (ok, name, detail) => {
  if (!ok) bad++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  —  ${detail}` : ""}`)
}
const throws = (fn) => {
  try {
    fn()
    return null
  } catch (e) {
    return String(e.message)
  }
}

// ── 1 · POSITIVE CONTROL. Without this the negatives prove only that the
//        function returns 3000, which it could do by being broken.
const found = resolvePort({ root: MINE, listeners: [{ pid: 11, port: 3105, cwd: MINE }] })
row(found.port === "3105" && found.source === "discovered", "the server on THIS tree is found", `:${found.port} (${found.source})`)

// ── 2 · KNOWN-BAD. The only listener is another tree's. Required: UNSWEPT, not PASS.
const foreign = resolvePort({ root: MINE, listeners: [{ pid: 12, port: 3106, cwd: THEIRS }] })
row(
  foreign.port === "3000" && foreign.source === "default",
  "KNOWN-BAD · a server on ANOTHER tree is not adopted",
  `:${foreign.port} (${foreign.source}) — the gate above this reports UNSWEPT, which is the honest answer`,
)
row(found.port !== foreign.port, "…and the two arms disagree, so arm 1 is measuring something", `${found.port} vs ${foreign.port}`)

// ── 3 · KNOWN-BAD. Nothing listening anywhere. Still UNSWEPT, never green.
const none = resolvePort({ root: MINE, listeners: [] })
row(none.port === "3000" && none.source === "default", "KNOWN-BAD · an empty machine keeps the historical default", `:${none.port}`)

// ── 4 · KNOWN-BAD. Two servers on THIS tree. Picking one is the wrong-tree
//        defect with extra steps, so it must refuse and name the knob.
const two = throws(() =>
  resolvePort({ root: MINE, listeners: [{ pid: 13, port: 3105, cwd: MINE }, { pid: 14, port: 3200, cwd: MINE }] }),
)
row(two !== null && /FS_PORT/.test(two), "KNOWN-BAD · two servers for one tree REFUSES rather than picks", (two ?? "it picked one").split("\n")[0])

// ── 5 · the operator still outranks the machine, in both directions.
const named = resolvePort({ env: { FS_PORT: "3200" }, root: MINE, listeners: [{ pid: 15, port: 3105, cwd: MINE }] })
row(named.port === "3200" && named.source === "FS_PORT", "FS_PORT overrules a discovered server", `:${named.port}`)
const namedDead = resolvePort({ env: { FS_PORT: "39999" }, root: MINE, listeners: [] })
row(namedDead.port === "39999", "FS_PORT is honoured even when nothing is on it — the operator may aim at a dead port", `:${namedDead.port}`)

// ── 6 · the live reading, against this actual machine.
const live = readListeners()
const here = live.filter((l) => l.cwd === ROOT)
row(Array.isArray(live) && live.length > 0, "readListeners sees this machine at all", `${live.length} listening socket(s)`)
console.log(`      this checkout: ${here.length === 0 ? "no dev server running for it" : here.map((l) => `pid ${l.pid} on :${l.port}`).join(", ")}`)

// ── 7 · END TO END. A real gate, aimed by FS_PORT at a port nothing serves,
//        must report UNSWEPT and a non-zero exit. This is the arm that proves
//        the honest-skip path survived the change.
const dead = spawnSync(process.execPath, [join(__dirname, "assert-tsc-baseline.mjs")], {
  encoding: "utf8",
  cwd: join(__dirname, "..", ".."),
  env: { ...process.env, FS_PORT: "39999" },
  timeout: 600000,
})
const out = (dead.stdout || "") + (dead.stderr || "")
const unswept = (out.match(/^UNSWEPT\b/gm) || []).length
row(
  unswept === 2 && dead.status === 3,
  "KNOWN-BAD END TO END · a real gate on a dead port reports UNSWEPT and exits 3",
  `${unswept} UNSWEPT row(s), exit ${dead.status}`,
)

console.log(`\nport resolver: ${bad === 0 ? "SOUND" : `${bad} arm(s) DID NOT HOLD`}`)
process.exit(bad === 0 ? 0 : 1)
