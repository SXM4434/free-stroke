// ONE BROWSER, ONE KNOB — where a Chrome comes from, whether anybody can see it,
// and who is responsible for closing it.
//
// ── THE DEFECT THIS CLOSES ─────────────────────────────────────────────────
// 2026-08-07, ~09:00. Four lanes ran browser gates concurrently. The controller
// instructed every one of them to run HEADLESS. **Measured by parsing, 202 of the
// 381 `.mjs` under `scripts/verify` launch a browser directly, there was no shared
// launcher at all, and 50 of them hardcoded `headless: false`.** Sebs's screen was
// taken over for the morning. His instruction: *"make sure it is enforced."*
//
// "Headless" was a HOPE — a thing the controller said and 50 call sites privately
// contradicted. This module is the machinery that makes it a PROPERTY: the call
// site does not decide, this file does, and one env var settles it for all 202.
//
// ── AND 93 CHROMES OUTLIVED THE LANES THAT SPAWNED THEM ────────────────────
// The same morning left **93 orphaned Chrome processes, 4h48m old, spawned ~20 s
// apart**, by lanes that died on a session limit. That is the other half and it is
// the expensive half: a wrong screenshot can be re-taken, a machine with 93 live
// Chromes on it cannot be used. Measured here: **27 of the 202 launchers never call
// `.close()` anywhere in the file.** They are not leaking on an error path; they
// leak on the success path.
//
// ── ONE KNOB, ONE NAME: `FS_HEADED` ───────────────────────────────────────
// `docs/DISPATCH.md` §3:130 — *"One knob, one name: FS_PORT … two names for one
// knob is how a control silently stops reaching the thing it names."* Same knob
// design, applied to the window:
//
//   FS_HEADED unset   the call site's own request decides, and its DEFAULT is
//                     HEADLESS. A file that says nothing gets headless.
//   FS_HEADED=1       EVERY browser is headed. A human is watching.
//   FS_HEADED=0       EVERY browser is HEADLESS — including the call sites that
//                     explicitly ask to be headed. **This is the controller's
//                     guarantee, and it is the whole point of the file.** On
//                     2026-08-07 the controller said "headless" and was wrong 50
//                     times; with `FS_HEADED=0` exported it is right 202 times.
//
// Any other value THROWS. A knob whose value is a typo must not silently pick a
// default — that is the same silence the port knob was fixed for.
//
// Headless is safe here and it was MEASURED, not assumed. DISPATCH §3: *"121 rAF
// ticks headless vs 120 headed, identical renderer string"* (2026-07-30), and
// explainer 37 §6 re-ran it at 8 s and 180 s: the headed-vs-headless difference
// (median mean|Δ| 0.050) is SMALLER than the headless-vs-headless noise floor
// (0.065). Nothing here overrides explainer 37's other conclusion — that flipping
// a headed capture tool changes what it RECORDS, and is not a lane's call. So the
// conversion is behaviour-preserving: every file that was headed still asks to be
// headed, by name, and the operator can now overrule all of them at once.
//
// ── `--use-angle=metal` IS NOT AN OPTION ──────────────────────────────────
// DISPATCH §3:106 — *"The flag is load-bearing: without it Chrome falls back to
// SwiftShader, which silently pauses the rAF loop with no error — a frozen
// animation and a still one are identical in a screenshot."* So it is added here,
// always, and a caller cannot remove it. Measured 2026-08-07: **3 launch sites
// omitted it entirely** (`_probe-lane-o5-panel.mjs:4`, `_probe-lane-o5-smoke.mjs:3`,
// `_probe-lane13-smoke.mjs:9`) — all three were headed, so all three were
// susceptible. Likewise `channel: "chrome"` — *"Never Playwright's bundled
// Chromium."*
//
// ── A LEGACY NAME IS AN ERROR, NOT A SHRUG ────────────────────────────────
// Copied from `lib/dev-server.mjs`, including its second lesson: the throw is the
// COURTESY, never the defence. *"A banned-names list can only ever catch the names
// somebody already thought of."* The defence is `assert-one-browser.mjs`, which
// inverts it — **a script under `scripts/verify` may not name `headless` at all,
// in any spelling, computed or literal.** `SL_HEADLESS` is in the list below
// because it was live at `verify-screen-layers.mjs:218` and was invisible to every
// survey of `headless: false`; it is in the list as a courtesy and it is the gate,
// not the list, that would have caught it.
//
// ── ATTRIBUTION, BECAUSE THE CONTROLLER HAD TO GUESS ──────────────────────
// To find this morning's orphans the controller filtered `ps` on
// `--disable-field-trial-config` — an internal Playwright flag that is nobody's
// contract and can change in a patch release. So every browser this repo opens now
// carries `--fs-browser=<repo>:<ownerPid>:<label>` on its command line, and a
// record in a registry directory naming the process that asked for it. Two
// channels on purpose: the switch needs Chrome to tolerate an unknown flag (it
// does, but this lane could not launch one to prove it), the registry needs
// nothing but a filesystem. See `scripts/verify/sweep-browsers.mjs`.
//
// ── WHAT SURVIVES WHAT ────────────────────────────────────────────────────
// Stated plainly, because the failure mode is believing a teardown is stronger
// than it is:
//
//   script throws / rejects        closed here   (uncaughtException, unhandledRejection)
//   Ctrl-C, `kill <pid>`           closed here   (SIGINT, SIGTERM, SIGHUP)
//   normal exit without .close()   killed here   (the `exit` hook, synchronously)
//   `kill -9` on the node process  NOTHING in-process can help — and that is
//                                  what a session limit does. The registry record
//                                  outlives it, and `sweep-browsers.mjs` is what
//                                  reads it. THIS is the half that cost the morning.

import { execFileSync } from "node:child_process"
import { mkdirSync, writeFileSync, rmSync, readdirSync, readFileSync } from "node:fs"
import { join, dirname, basename } from "node:path"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
/** the caller's OWN tree, derived — never an absolute path written down.
 *  `assert-one-knob.mjs` channel F is why: "the defect is a PATH, not a URL." */
export const ROOT = join(__dirname, "..", "..", "..")
const REPO = basename(ROOT)

// ── the legacy names, and why each is here ────────────────────────────────
const LEGACY = {
  HEADLESS: "the generic name, and the one muscle memory reaches for",
  FS_HEADLESS: "the FS_-prefixed inverse; two names for one knob, in opposite polarity",
  SL_HEADLESS: "was LIVE at verify-screen-layers.mjs:218 and defaulted the tool to HEADED",
  HEADED: "the unprefixed form — it is FS_HEADED that is the knob",
  PWDEBUG: "Playwright's own; it forces headed behind this module's back",
}
for (const [name, why] of Object.entries(LEGACY)) {
  const v = process.env[name]
  if (v === undefined || v === "") continue
  throw new Error(
    `${name} is no longer read — one knob, one name. Use FS_HEADED instead:\n` +
      `    FS_HEADED=0 node <script>   # every browser headless, overriding every call site\n` +
      `    FS_HEADED=1 node <script>   # every browser headed, a human is watching\n` +
      `  (it was ${name}=${v}; ${why}. See scripts/verify/lib/browser.mjs)`,
  )
}

const TRUE = new Set(["1", "true", "yes", "on"])
const FALSE = new Set(["0", "false", "no", "off"])

/** THE KNOB, resolved once. `null` = unset, i.e. "the call site decides". */
export const FORCED = (() => {
  const raw = process.env.FS_HEADED
  if (raw === undefined || raw === "") return null
  const v = String(raw).trim().toLowerCase()
  if (TRUE.has(v)) return "headed"
  if (FALSE.has(v)) return "headless"
  throw new Error(
    `FS_HEADED=${raw} is not a value this knob has. Use one of 1/true/yes/on (headed) or ` +
      `0/false/no/off (headless), or leave it unset to let each call site decide.\n` +
      `  A knob whose value is a typo must not silently pick a default — that is the ` +
      `silence the port knob was fixed for (docs/DISPATCH.md §3).`,
  )
})()

/** the flag that keeps the rAF loop alive. Not negotiable, not removable. */
export const ANGLE_FLAG = "--use-angle=metal"

/**
 * THE DECISION, AS A PURE FUNCTION — no process, no filesystem, no driver.
 *
 * Kept separate so the gate's negative controls can interrogate the DECISION
 * without opening a browser. DISPATCH §2.6: "calibrate the instrument against a
 * known-bad input and require it to fail" — a launcher whose only testable
 * surface is a live Chrome is a launcher nobody can test on a machine where a
 * browser must not appear.
 *
 * @param {{headed?: boolean, args?: string[], label?: string, [k: string]: any}} opts
 */
export function resolveLaunchOptions(opts = {}) {
  const { headed, args = [], label, channel, executablePath, headless, ...rest } = opts

  if (headless !== undefined) {
    throw new Error(
      "launch() does not take `headless` — that is the defect this module exists to close. " +
        "Pass `headed: true` if a human must watch this run, and let FS_HEADED overrule it.",
    )
  }
  if (channel !== undefined && channel !== "chrome") {
    throw new Error(
      `channel: ${JSON.stringify(channel)} — DISPATCH §3 is "Real Chrome, real GPU … Never ` +
        `Playwright's bundled Chromium." This module always uses channel "chrome".`,
    )
  }
  if (executablePath !== undefined) {
    throw new Error(
      "executablePath bypasses `channel: \"chrome\"`, which DISPATCH §3 pins. If a different " +
        "binary is genuinely needed, that is a change to this module with a written reason.",
    )
  }

  // the call site asks; the knob, if set, overrules it in EITHER direction.
  const wanted = headed === true ? "headed" : "headless"
  const resolved = FORCED ?? wanted
  const why =
    FORCED === null
      ? `call site asked for ${wanted} (FS_HEADED unset)`
      : `FS_HEADED=${process.env.FS_HEADED} forces ${FORCED}` +
        (FORCED === wanted ? "" : `, OVERRULING the call site's ${wanted}`)

  const merged = [ANGLE_FLAG, ...args.filter((a) => a !== ANGLE_FLAG)]

  return {
    launch: { channel: "chrome", headless: resolved === "headless", args: merged, ...rest },
    resolved,
    wanted,
    why,
    label: label ?? basename(process.argv[1] ?? "unknown"),
  }
}

// ───────────────────────────────────────────────────────────────────────────
// THE REGISTRY — the only channel that survives `kill -9` on the owner.
//
// It lives in the OS temp dir rather than in the tree on purpose: it is process
// state, not evidence, and a sweep run from ANY lane must be able to see every
// lane's records. This morning's 93 came from four different trees.
// ───────────────────────────────────────────────────────────────────────────
export const REGISTRY = join(tmpdir(), "fs-browser-registry")

export function markerFor(ownerPid, label, n) {
  return `--fs-browser=${REPO}:${ownerPid}:${label}:${n}`
}

export function register(record) {
  mkdirSync(REGISTRY, { recursive: true })
  const p = join(REGISTRY, `${record.ownerPid}-${record.n}.json`)
  writeFileSync(p, JSON.stringify(record, null, 2) + "\n")
  return p
}

export function unregister(path) {
  try {
    rmSync(path, { force: true })
  } catch {
    /* the sweep may have collected it already; that is the mechanism working */
  }
}

/** Every record on disk, with the ones whose owner process is gone marked. */
export function readRegistry() {
  let names = []
  try {
    names = readdirSync(REGISTRY).filter((n) => n.endsWith(".json"))
  } catch {
    return []
  }
  return names
    .map((n) => {
      try {
        const rec = JSON.parse(readFileSync(join(REGISTRY, n), "utf8"))
        return { ...rec, file: join(REGISTRY, n), ownerAlive: isAlive(rec.ownerPid) }
      } catch {
        return null
      }
    })
    .filter(Boolean)
}

/** signal 0 asks the kernel "does this pid exist and may I signal it" */
export function isAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === "EPERM"
  }
}

/**
 * The direct children of a pid, read from `pgrep`. Used to learn the browser's
 * own pid WITHOUT reaching into the driver's private fields — playwright-core
 * exposes no `process()` on `Browser`, and an internal that moves in a patch
 * release is not a teardown.
 */
export function childPidsOf(pid) {
  try {
    return execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
      .split("\n")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)
  } catch {
    return [] // no children, or no pgrep — degrade to the registry channel alone
  }
}

// ───────────────────────────────────────────────────────────────────────────
// TEARDOWN. Installed once, on first launch, never at import — importing this
// module to read `resolveLaunchOptions` must not attach handlers to a process
// that is never going to open anything.
// ───────────────────────────────────────────────────────────────────────────
const live = new Set()
let hooked = false
let counter = 0

function closeSync() {
  for (const t of [...live]) {
    live.delete(t)
    unregister(t.recordPath)
    // `exit` cannot await. A SIGKILL to the browser pid is the only thing that
    // works from here, and a browser that is already gone throws ESRCH, which is
    // the outcome we wanted anyway.
    for (const pid of t.pids) {
      try {
        process.kill(pid, "SIGKILL")
      } catch {
        /* already gone */
      }
    }
  }
}

export async function closeAll(why = "closeAll") {
  const all = [...live]
  live.clear()
  for (const t of all) {
    unregister(t.recordPath)
    try {
      await t.browser.close()
    } catch {
      for (const pid of t.pids) {
        try {
          process.kill(pid, "SIGKILL")
        } catch {
          /* already gone */
        }
      }
    }
  }
  return { closed: all.length, why }
}

/**
 * REAP THE BROWSERS WHOSE OWNER IS DEAD. Runs once, at first launch.
 *
 * WHY IT EXISTS. Everything needed to do this was already in this file: the
 * registry that survives `kill -9`, `readRegistry()` marking each record with
 * `ownerAlive`, and `isAlive()`. The only thing missing was a CALLER.
 * `sweep-browsers.mjs` was the sole one, and it is a script a human has to
 * remember to run.
 *
 * MEASURED 2026-09-05: a headless Chrome from `verify-hero-windup.mjs` had been
 * up since 2026-08-28, EIGHT DAYS, holding 343 MB across four processes, with
 * `ppid=1`. Two dead records sat in the registry the whole time and
 * `readRegistry()` flagged both correctly on the first try. Hundreds of gate
 * runs launched past them. **A reaper nobody calls is not a reaper**, which is
 * the same shape as the 93-orphan morning this file was written for.
 *
 * ⚠ WHY IT CANNOT KILL A BROWSER SOMEBODY WANTS. Two independent guards:
 *   1 · the owner must be DEAD. If the node process that launched a browser is
 *       gone, nothing is driving that browser. A live owner is never touched,
 *       and pid reuse fails SAFE here: a reused ownerPid reads alive, so the
 *       record is skipped rather than reaped.
 *   2 · the browser pid must still carry THIS record's `--fs-browser=` marker.
 *       A pid that has been reused by an unrelated process does not, so it is
 *       left alone. Without this, an 8-day-old record could name a pid that now
 *       belongs to something else entirely.
 */
/**
 * 🔴 F113 (Codex, 2026-09-18), reproduced 2026-09-22. Ownership used to be
 * `cmd.includes(rec.marker)`, a SUBSTRING test: a record ending `:gate:1`
 * matched a browser whose marker ends `:gate:10`, a different launch, and an
 * empty marker matched every command on the machine. The marker must now
 * appear WHOLE: at the start of the command or after whitespace, and followed
 * by whitespace or the end. An empty or non-string marker matches nothing.
 * Labels may carry spaces, which is why this is a bounded substring and not a
 * token compare: a token compare would fail safe, but would never reap them.
 */
export function ownsMarker(cmd, marker) {
  if (typeof marker !== "string" || !marker.startsWith("--fs-browser=") || marker.length <= "--fs-browser=".length) return false
  if (typeof cmd !== "string" || !cmd) return false
  let at = cmd.indexOf(marker)
  while (at !== -1) {
    const before = at === 0 ? "" : cmd[at - 1]
    const after = cmd[at + marker.length] ?? ""
    if ((before === "" || /\s/.test(before)) && (after === "" || /\s/.test(after))) return true
    at = cmd.indexOf(marker, at + 1)
  }
  return false
}

const psCommandOf = (pid) =>
  execFileSync("ps", ["-o", "command=", "-p", String(pid)], {
    encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
  }).trim()

/**
 * `deps` is injected only so `_probe-crosscheck-browser.mjs` can drive the
 * judgement with a fabricated registry, ps and kill on a machine where nothing
 * may be killed. Called with no argument it is exactly the production path.
 *
 * 🔴 F113, the second half: a FAILED kill used to delete the record anyway, so
 * an orphan that survived an EPERM lost its only retry record. The record now
 * stays whenever a pid it owns is still alive after the attempt, or could not
 * be read at all while alive. It is removed only when every pid is gone, was
 * killed, or provably belongs to somebody else.
 */
export function reapOrphans(deps = {}) {
  const {
    records = readRegistry(),
    alive = isAlive,
    commandOf = psCommandOf,
    kill = (pid) => process.kill(pid, "SIGKILL"),
    drop = unregister,
    log = console.log,
  } = deps
  let reaped = 0
  let kept = 0
  for (const rec of records) {
    if (rec.ownerAlive) continue
    let keep = false
    for (const pid of rec.pids ?? []) {
      if (!alive(pid)) continue
      let cmd = ""
      try {
        cmd = commandOf(pid)
      } catch {
        if (alive(pid)) keep = true // could not read a live pid: unknown, not "not ours"
        continue // gone between the check and the read
      }
      if (!ownsMarker(cmd, rec.marker)) continue // pid reused or marker unusable: not ours, leave it
      try {
        kill(pid)
        reaped++
      } catch (e) {
        if (e && e.code === "ESRCH") continue // already gone, which is what we wanted
        keep = true
        log(`[browser] could NOT kill orphan ${pid} (${e && e.code ? e.code : e}); its record is kept for the next run`)
      }
    }
    if (keep) kept++
    else drop(rec.file)
  }
  if (reaped) log(`[browser] reaped ${reaped} orphaned browser process(es) whose owner had died`)
  return deps.detail ? { reaped, kept } : reaped
}

function hook() {
  if (hooked) return
  hooked = true
  reapOrphans()
  // 1 · normal exit, including `process.exit()` — SYNCHRONOUS ONLY.
  process.on("exit", closeSync)
  // 2 · the signals a human or a supervisor sends.
  for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.on(sig, async () => {
      await closeAll(sig)
      // re-raise the default disposition so the exit code is honest
      process.exit(sig === "SIGINT" ? 130 : sig === "SIGTERM" ? 143 : 129)
    })
  }
  // 3 · the script blowing up. Without this, a gate that throws at row 4 of 40
  // leaves a Chrome behind and prints a stack trace that says nothing about it.
  process.on("uncaughtException", async (e) => {
    console.error(e)
    await closeAll("uncaughtException")
    process.exit(1)
  })
  process.on("unhandledRejection", async (e) => {
    console.error(e)
    await closeAll("unhandledRejection")
    process.exit(1)
  })
}

/** Exposed so the gate can drive teardown against a FAKE browser — the only way
 *  to prove the mechanism on a machine where a real one must not appear. */
export function track(browser, { pids = [], recordPath = null } = {}) {
  hook()
  const t = { browser, pids, recordPath }
  live.add(t)
  return t
}

export function liveCount() {
  return live.size
}

let announced = false

/**
 * THE ONE PLACE A BROWSER COMES FROM.
 *
 * Exported as `chromium.launch` rather than as a plainly-named `launchBrowser`,
 * and that is a COUPLING with a reason, recorded rather than hidden:
 * `run-battery.mjs` decides MODEL vs BROWSER by reading the CALLEE of every call
 * expression against `/(chromium|firefox|…)\.(launch|…)/`. A gate that stopped
 * calling `chromium.launch` would be re-classified MODEL, and the model battery
 * would run 50-odd browser gates in parallel against a dev server it promises not
 * to need. `run-battery.mjs` is another lane's file, so the fix — teach the
 * classifier that importing `lib/browser.mjs` IS a browser signal — is HANDED
 * OVER, not applied. Until it lands, the callee name is what keeps the partition
 * honest, and the import specifier is what makes the two tellable apart.
 * `assert-one-browser.mjs` therefore resolves the BINDING, never the name.
 */
export const chromium = Object.freeze({
  async launch(opts = {}) {
    const plan = resolveLaunchOptions(opts)
    const n = ++counter
    const marker = markerFor(process.pid, plan.label, n)
    plan.launch.args = [...plan.launch.args, marker]

    if (!announced) {
      announced = true
      // A silent resolution is how `verify-gates` once reported ALL PASS with
      // every geometry gate skipped. Say it once, out loud, per process.
      console.log(`[browser] ${plan.resolved.toUpperCase()} — ${plan.why}`)
    }

    hook()
    const before = new Set(childPidsOf(process.pid))
    const { chromium: driver } = await import("playwright-core")
    const browser = await driver.launch(plan.launch)
    const pids = childPidsOf(process.pid).filter((p) => !before.has(p))

    const recordPath = register({
      repo: REPO,
      root: ROOT,
      ownerPid: process.pid,
      n,
      label: plan.label,
      marker,
      pids,
      script: process.argv[1] ?? null,
      resolved: plan.resolved,
      startedAt: new Date().toISOString(),
    })

    const t = track(browser, { pids, recordPath })
    // a caller that closes properly must not leave a record behind
    browser.on("disconnected", () => {
      live.delete(t)
      unregister(recordPath)
    })
    return browser
  },
})
