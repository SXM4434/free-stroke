// WHICH COMMIT IS THE SERVER ON PORT N ACTUALLY RUNNING.
//
// A gate that records a base, or compares against one, used to label the
// result with a SHA it was handed on the command line and never looked at the
// server. A base "recorded on ea31c5b38" could come from any tree, dirty or
// clean, and a compare against a base recorded on the branch itself compared
// the branch to itself and called it a pass (HARDEN-B3, from the Codex
// crosscheck, 2026-09-26).
//
// serverCommit(port) reads it from the process, never from the caller:
//   1. `lsof -nP -iTCP:<port> -sTCP:LISTEN -t` gives the listener pid.
//   2. Its cwd from `lsof -a -p <pid> -d cwd -Fn`. If that cwd is not inside a
//      git tree (a forked child that changed directory), walk up the parent
//      pids until one is. Stops at pid 1.
//   3. `git -C <cwd> rev-parse HEAD`, and `dirty` when
//      `git -C <top> status --porcelain -- app components lib hooks styles` is
//      non-empty, untracked files included, since a new file there is served.
//
// Returns { pid, cwd, top, head, dirty }. Throws by name, never falls back:
//   - nothing listens on the port
//   - two different pids listen on it (which one serves the page is unknown)
//   - no pid up the parent chain has a cwd inside a git tree
// Corpus of `dirty`: the five product folders above, at the repo top. Scripts,
// docs and config outside them do not count, so a script-only edit reads clean.
import { execFileSync, spawnSync } from "node:child_process"

export const PRODUCT_PATHS = ["app", "components", "lib", "hooks", "styles"]

const run = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8" })

function listenerPid(port) {
  const r = run("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"])
  const out = (r.stdout || "").trim()
  if (r.error) throw new Error(`serverCommit: lsof did not run: ${r.error.message}`)
  // lsof exits 1 with empty output when nothing matches. Anything else is a
  // failure of lsof itself, not an answer, and must not read as "no server".
  if (r.status === 1 && out === "") throw new Error(`serverCommit: no listener on :${port}`)
  if (r.status !== 0) throw new Error(`serverCommit: lsof exited ${r.status} for :${port}: ${(r.stderr || "").trim()}`)
  const pids = [...new Set(out.split(/\s+/).filter(Boolean))]
  if (pids.length !== 1) throw new Error(`serverCommit: ${pids.length} pids listen on :${port} (${pids.join(", ")}); cannot tell which one serves`)
  return Number(pids[0])
}

function cwdOf(pid) {
  const r = run("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"])
  const line = (r.stdout || "").split("\n").find((l) => l.startsWith("n"))
  return line ? line.slice(1) : null
}

function parentOf(pid) {
  const r = run("ps", ["-o", "ppid=", "-p", String(pid)])
  const p = Number((r.stdout || "").trim())
  return Number.isInteger(p) && p > 0 ? p : null
}

function gitTop(cwd) {
  const r = run("git", ["-C", cwd, "rev-parse", "--show-toplevel"])
  return r.status === 0 ? r.stdout.trim() : null
}

export function serverCommit(port) {
  const listener = listenerPid(port)
  const tried = []
  let pid = listener, cwd = null, top = null
  while (pid && pid !== 1) {
    cwd = cwdOf(pid)
    tried.push(`${pid}:${cwd ?? "no cwd"}`)
    top = cwd ? gitTop(cwd) : null
    if (top) break
    pid = parentOf(pid)
  }
  if (!top) throw new Error(`serverCommit: the listener on :${port} (pid ${listener}) and its parents run in no git tree: ${tried.join(" -> ")}`)
  const head = execFileSync("git", ["-C", cwd, "rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const status = execFileSync("git", ["-C", top, "status", "--porcelain", "--", ...PRODUCT_PATHS], { encoding: "utf8" })
  return { pid, cwd, top, head, dirty: status.trim() !== "" }
}

// Does the code served from `srv` (a serverCommit result) differ from commit
// `sha` under PRODUCT_PATHS? A clean server is compared commit to commit; a
// dirty one is compared against its working tree, and any untracked file under
// the product paths counts as a difference. Throws by name when git cannot
// answer (exit 128: the sha is unknown in the server's repo), because "cannot
// tell" must not read as "same".
export function codeDiffers(srv, sha) {
  const args = srv.dirty ? ["-C", srv.top, "diff", "--quiet", sha, "--", ...PRODUCT_PATHS] : ["-C", srv.top, "diff", "--quiet", sha, srv.head, "--", ...PRODUCT_PATHS]
  const r = run("git", args)
  if (r.status !== 0 && r.status !== 1) throw new Error(`codeDiffers: git diff exited ${r.status} for ${sha} in ${srv.top}: ${(r.stderr || "").trim()}`)
  if (r.status === 1) return true
  if (srv.dirty) {
    const u = run("git", ["-C", srv.top, "ls-files", "--others", "--exclude-standard", "--", ...PRODUCT_PATHS])
    if (u.status !== 0) throw new Error(`codeDiffers: git ls-files exited ${u.status} in ${srv.top}`)
    return u.stdout.trim() !== ""
  }
  return false
}
