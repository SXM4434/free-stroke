// ONE KNOB, ONE NAME — where the dev server is.
//
// ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
// Two lanes independently added an override for the same thing and neither
// knew about the other, so the repo ended up with THREE names for one knob:
//
//   HERO_URL   a full URL to `/desk-doodles`   (24 files)
//   LAB_URL    a full URL to `/`                (3 files)
//   FS_PORT    a port number                    (18 files)
//
// …and several files carried all of it at once, e.g.
//
//   process.env.HERO_URL ?? `http://localhost:${process.env.FS_PORT || 3000}/desk-doodles`
//
// while `film-hero-beat.mjs` read only `FS_PORT` and `assert-hero-k7-news.mjs`
// read only `HERO_URL`. Two names for one knob is how a control silently stops
// reaching the thing it names: set the one your muscle memory has and half the
// battery talks to the shared server on :3000 anyway, with no error, and the
// run is attributed to the wrong tree.
//
// ── WHY THE PORT WON ───────────────────────────────────────────────────────
// `HERO_URL` and `LAB_URL` are not one knob with two names — they are two
// SURFACES of one server, so no single URL variable can express both. The thing
// an operator actually varies is which dev server, i.e. the PORT, and both URLs
// are functions of it. So the port is the knob, `FS_PORT` is its one name, and
// the two surfaces are derived here once.
//
// ── THE DEFAULT IS BYTE-IDENTICAL ──────────────────────────────────────────
// Unset, this resolves to exactly what every call site resolved to before:
// `http://localhost:3000/desk-doodles` and `http://localhost:3000`. Nothing
// that runs without an override behaves differently.
//
// ── A LEGACY NAME IS AN ERROR, NOT A SHRUG ─────────────────────────────────
// Silently ignoring `HERO_URL` would recreate the defect from the other side:
// the operator sets it, nothing complains, and every capture is taken against
// the wrong server. So a set legacy variable THROWS, with the replacement
// command in the message. `_lane-gates.sh` and `docs/README.md` are updated to
// the new name in the same pass.

// ── AND THE LIST WAS SHORT, BECAUSE A BLACKLIST ALWAYS IS ──────────────────
// `FS_URL` was added 2026-08-07. It had been live in four files the whole time
// (`assert-still-export.mjs:37`, `assert-sweep-release.mjs:35`, and two orphan
// probes) and this list had never heard of it, because the list was written from
// the three names that had ALREADY caused a problem. That is the second time
// this blacklist has been found short.
//
// So the throw is no longer the primary defence — it is the courtesy. The
// primary defence is that a gate must not be able to NAME its own server: the
// URL comes from this module or the gate does not get one, and
// `scripts/verify/assert-one-knob.mjs` fails the build on any gate that writes
// its own. A banned-names list can only ever catch the names somebody already
// thought of; a whitelist catches the next one too. Explainer 27 §1, 28.
const LEGACY = ["HERO_URL", "LAB_URL", "FS_URL"]
for (const name of LEGACY) {
  const v = process.env[name]
  if (v === undefined || v === "") continue
  let port = ""
  try {
    port = new URL(v).port || "3000"
  } catch {
    port = ""
  }
  throw new Error(
    `${name} is no longer read — one knob, one name. Use FS_PORT instead:\n` +
      `    FS_PORT=${port || "<port>"} node <script>\n` +
      `  (it was ${name}=${v}; both surfaces are derived from the port, see scripts/verify/lib/dev-server.mjs)`,
  )
}

// ── AND THE DEFAULT AIMED AT A SERVER NOBODY WAS RUNNING ──────────────────
// 2026-08-28, measured before this was written. On this checkout, with its dev
// server UP on :3105:
//
//   node scripts/verify/assert-tsc-baseline.mjs                 2 PASS, 2 UNSWEPT, exit 3
//   FS_PORT=3105 node scripts/verify/assert-tsc-baseline.mjs    4 PASS, 0 UNSWEPT, exit 0
//   node scripts/verify/assert-fusion-combo-ui.mjs              exit 1 in 1 s,
//                                                               ERR_CONNECTION_REFUSED at :3000
//
// The UNSWEPT was the instrument being honest, and `STATUS.md` has printed
// `exit 3 (PARTIAL)` on page one since 08-25 with nothing telling the reader
// that one environment variable closes it. A default that is right on the
// shared checkout and wrong in every lane is the same shape as the four-names
// defect above: no error, no verdict, and the run attributed to nothing.
//
// THREE WAYS TO FIX IT, AND WHY THIS ONE.
//
//   read the port out of `package.json`   MEASURED AND REJECTED. The dev script
//     is `next dev`, with no `-p`, so it declares 3000 and resolving it changes
//     nothing. The port an operator actually runs on is never written down.
//
//   probe a candidate list                REJECTED on this file's own lesson.
//     Tonight :3105 serves this tree and :3106 serves a lane's clone at
//     `~/.fs-lanes/battery-0828`. First hit wins would have graded the wrong
//     tree, silently, which is the exact defect the header opens with. And a
//     candidate list is a blacklist: "it can only ever catch the names somebody
//     already thought of."
//
//   keep 3000, name the live port in the  REJECTED against the bar. It improves
//     UNSWEPT line                        the message and leaves the gate still
//     unable to reach a server that is running two feet away.
//
// So the port is DERIVED, from the one fact that ties a server to a tree: the
// listening process whose working directory IS this checkout. Nothing is
// enumerated, nothing is guessed, and a lane finds its own server rather than
// the first one that answers. `one-system` §4.6, "derive, never enumerate", and
// §5, "prove which tree you are serving".
//
// WHAT IT REFUSES TO DO. Two servers on this same tree is an operator's
// question, not a resolver's, so it THROWS with the `FS_PORT` command instead
// of picking. Nothing serving this tree falls back to 3000 exactly as before,
// so the honest UNSWEPT survives: discovery may find a server, it may never
// invent a pass. A skip is not a pass (`docs/DISPATCH.md` §3).

import { execFileSync } from "node:child_process"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { realpathSync } from "node:fs"

/** the caller's OWN tree, derived, never an absolute path written down.
 *  Same rule as `lib/browser.mjs`: `assert-one-knob` channel F. */
const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = (() => {
  const r = join(HERE, "..", "..", "..")
  try {
    return realpathSync(r)
  } catch {
    return r
  }
})()

/**
 * THE DECISION, AS A PURE FUNCTION. No process, no network, no filesystem.
 *
 * Kept separate for the reason `lib/browser.mjs` keeps `resolveLaunchOptions`
 * separate: DISPATCH §2.6 wants the instrument calibrated against a known-bad
 * input, and a resolver whose only testable surface is a live machine is a
 * resolver nobody can hand a known-bad. Feed it a listener table and it tells
 * you the port and why.
 *
 * @param {{env?: object, root: string, listeners?: {pid:number, port:number, cwd:string}[]}} o
 * @returns {{port: string, source: "FS_PORT"|"discovered"|"default", why: string, pid?: number}}
 */
export function resolvePort({ env = {}, root, listeners = [] }) {
  const named = env.FS_PORT
  if (named !== undefined && named !== "") {
    return { port: String(named), source: "FS_PORT", why: `FS_PORT=${named}, the operator named it` }
  }
  const mine = listeners.filter((l) => l.cwd === root)
  const ports = [...new Set(mine.map((l) => l.port))]
  if (ports.length === 1) {
    return {
      port: String(ports[0]),
      source: "discovered",
      why: `pid ${mine[0].pid} is listening on :${ports[0]} and its working directory is this checkout`,
      pid: mine[0].pid,
    }
  }
  if (ports.length > 1) {
    throw new Error(
      `${ports.length} dev servers are listening for this checkout, on :${ports.join(", :")}.\n` +
        `  Which one a gate should grade is your call, not this module's. Name it:\n` +
        `    FS_PORT=${ports[0]} node <script>\n` +
        `  (a resolver that picked for you is how a run gets attributed to the wrong tree, ` +
        `which is the defect this file opens with)`,
    )
  }
  return {
    port: "3000",
    source: "default",
    why: "nothing is listening for this checkout, so the historical default stands and gates will report UNSWEPT",
  }
}

/**
 * Every listening TCP socket on this machine, paired with the working directory
 * of the process holding it. Two `lsof` calls, roughly 160 ms, paid once per
 * node process and only when `FS_PORT` is unset.
 *
 * A missing or unhappy `lsof` returns an empty table, which resolves to 3000,
 * which is what this file did before discovery existed. Degrading to the old
 * behaviour is safe here precisely because the old behaviour reports UNSWEPT
 * rather than green.
 */
export function readListeners() {
  const lsof = (args) => {
    try {
      return execFileSync("lsof", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 })
    } catch (e) {
      // lsof exits 1 when a selection matches nothing, and still prints what it found
      return typeof e.stdout === "string" ? e.stdout : ""
    }
  }
  /** lsof field mode: `p<pid>` opens a process block, `n<name>` is the socket or path */
  const fields = (text, take) => {
    const out = []
    let pid = 0
    for (const line of text.split("\n")) {
      if (line[0] === "p") pid = Number(line.slice(1))
      else if (line[0] === "n" && pid) take(out, pid, line.slice(1))
    }
    return out
  }

  const sockets = fields(lsof(["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpn"]), (out, pid, name) => {
    const port = Number(name.slice(name.lastIndexOf(":") + 1))
    if (Number.isInteger(port) && port > 0) out.push({ pid, port })
  })
  if (sockets.length === 0) return []

  const pids = [...new Set(sockets.map((s) => s.pid))]
  const cwds = new Map()
  fields(lsof(["-a", "-d", "cwd", "-p", pids.join(","), "-Fn"]), (_out, pid, name) => cwds.set(pid, name))

  return sockets.map((s) => ({ ...s, cwd: cwds.get(s.pid) ?? "" }))
}

const RESOLVED = resolvePort({
  env: process.env,
  root: ROOT,
  listeners: process.env.FS_PORT ? [] : readListeners(),
})

/** The one knob. Named by `FS_PORT`, or derived from the server running this tree. */
export const PORT = RESOLVED.port

/** How `PORT` was arrived at: `FS_PORT` | `discovered` | `default`. */
export const PORT_SOURCE = RESOLVED.source

/** The lab / style surface, `app/page.tsx`. */
export const LAB_URL = `http://localhost:${PORT}`

/** The hero-beat surface, `app/desk-doodles/page.tsx`. */
export const HERO_URL = `${LAB_URL}/desk-doodles`

// SAY IT OUT LOUD, ONCE. `lib/browser.mjs`: "A silent resolution is how
// `verify-gates` once reported ALL PASS with every geometry gate skipped."
// Discovery is a new way to end up on the wrong port, so it announces the port
// AND the reason, every run. On stderr, because a gate's stdout is its verdict
// stream and this line is provenance: every log this repo keeps is captured
// with `2>&1`, so nothing is lost by keeping it off the scoreboard.
process.stderr.write(`[dev-server] :${PORT} — ${RESOLVED.why}\n`)
