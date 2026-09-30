// ASSERT-ONE-BROWSER — NO SCRIPT IN scripts/verify MAY OPEN ITS OWN CHROME,
// AND NONE OF THEM MAY NAME `headless`.
// battery: model
//
// ── WHY A SWEEP WAS NOT ENOUGH ─────────────────────────────────────────────
//
// 2026-08-07, ~09:00. Four lanes ran browser gates at once. The controller told
// every one of them to run HEADLESS. **50 files hardcoded `headless: false` and
// ignored it**, Sebs's screen was taken over for the morning, and the lanes that
// died on a session limit left **93 orphaned Chromes, 4h48m old, ~20 s apart.**
// His instruction: *"make sure it is enforced."*
//
// "Enforced" is the word that matters. `lib/browser.mjs` is the pass — one
// launcher, one knob, one teardown. This file is the other half, and the standing
// rule for a systemic drift is three things, not one: **the sweep, a gate that
// fails on the next violation, and an exemption list that demands a written
// reason.** The exemption list is the part that gets skipped, and it is what
// decides whether the gate is still switched on in a month.
//
// ── WHY A `headless: false` GREP CANNOT BE THE DEFENCE ─────────────────────
//
// Because it already wasn't. `verify-screen-layers.mjs` computed its flag —
// `headless: process.env.SL_HEADLESS === "1"` — so it **defaulted to headed and
// was invisible to every survey of the literal.** It was missing from Lane J's
// census of 48 and had to be found by reading. Explainer 37 §3.1: *"the census is
// scoped by a spelling."* That file is this gate's headline known-bad and it is
// NOT synthetic: `--mutate` restores the exact line and requires channel C to
// fire on it, and requires a grep for `headless: false` to find NOTHING.
//
// Measured here by parsing, before the conversion: 202 launchers, 50 literal
// `false`, 1 computed, and — the number the grep-shaped question never asks —
// **27 files that never call `.close()` at all.**
//
// ── THE SIX CHANNELS ───────────────────────────────────────────────────────
//
//   A  DRIVER IMPORT   a file under scripts/verify importing a browser driver by
//                      module specifier — static, dynamic or require. The driver
//                      comes in through `lib/browser.mjs` or it does not come in.
//   B  FOREIGN LAUNCH  a `<x>.launch(…)` whose binding does NOT come from
//                      `lib/browser.mjs`. This is the SUBTLE half and it is why
//                      the gate resolves the BINDING rather than the NAME: after
//                      the conversion every call site still reads
//                      `chromium.launch(…)`, and the only thing separating a
//                      converted file from an unconverted one is where the
//                      identifier was imported from. Lane F's bar, verbatim and
//                      unchanged: *"reads FS_PORT is not the bar; imports the
//                      shared resolver is."*
//   C  THE FLAG        a script naming `headless` AT ALL — a property, a
//                      shorthand, a `"headless"` string key, a destructured
//                      binding. `headless: true` fails too: a file that computes
//                      the right answer is still opting out of the guarantee, and
//                      the controller cannot overrule 50 correct private
//                      decisions with one env var.
//   D  FOREIGN KNOB    `process.env.<X>` where X is a headed/headless-shaped name
//                      other than `FS_HEADED`. `SL_HEADLESS`, `FS_HEADLESS` (Lane
//                      R's parked name), `HEADLESS`, `PWDEBUG`. Mirrors
//                      `assert-one-knob` channel C, one knob over.
//   E  TEARDOWN        the launcher must close what it opened when the caller
//                      dies. Driven END TO END in a child process against a FAKE
//                      browser, in five death modes — because a teardown nobody
//                      has fired is a teardown nobody knows the shape of, and
//                      this lane was forbidden to open a real one.
//   F  THE RATCHET     the launchers that legitimately still open their own
//                      Chrome — six calibration fixtures, plus whatever a live
//                      sibling lane is holding — are BASELINED in
//                      `browser-baseline.json`. The count may FALL, never rise.
//   G  ALLOW HONESTY   every ALLOW entry carries a written reason AND must still
//                      actually violate something. A stale exemption is how a
//                      list quietly stops describing reality.
//
// ── WHY THE BASELINE IS A DATA FILE AND NOT A CONST IN HERE ────────────────
//
// Copied wholesale from `assert-one-knob.mjs`, including both of the lessons that
// shaped it, because both apply here unchanged:
//
//   · Lane J paid 85 sites down and COULD NOT RECORD THE GAIN, because lowering
//     the number meant editing a gate it did not own and two live lanes may never
//     hold the same file. *"A ratchet only its author can lower is a debt counter,
//     not a gate."* So the numbers live in `browser-baseline.json` and ANY lane
//     may `--record`. Lanes W and X are holding five of the remaining launchers
//     right now; when they land, they record, and they need nothing from me.
//   · `--record` runs LAST and REFUSES while any non-ratchet channel is red.
//     The first version of that in `assert-one-knob` ran first and was a laundry:
//     with known-bads planted the sweep went red and `--record` still wrote the
//     count down as the new floor. *"Recording a baseline during a red run
//     grandfathers whatever made it red."*
//
// ── WHY IT PARSES ──────────────────────────────────────────────────────────
//
// This file, `lib/browser.mjs`, `sweep-browsers.mjs`, `run-battery.mjs` and
// `verify-screen-layers.mjs` ALL discuss `headless: false` in prose. A grep is red
// on day one, on five files that are violating nothing, and gets switched off on
// day two. And the obvious repair is worse than useless: a naive `//.*$` stripper
// eats `//localhost` out of a URL string, and the same class of stripper here
// would have to guess where a comment ends inside a template literal. So this
// walks the syntax tree, and one of its controls is a file whose only mention of
// the flag is in prose. Explainer 28 §4.
//
// Usage:
//   node scripts/verify/assert-one-browser.mjs
//   node scripts/verify/assert-one-browser.mjs --list     # who still launches, by file
//   node scripts/verify/assert-one-browser.mjs --record   # you converted some: hold the ground
//
// There is no `--mutate`. The 24 controls run on the bare invocation, which is
// the invocation the next person types. Explainer 29 §5.

import ts from "typescript"
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs"
import { spawn } from "node:child_process"
import { join, dirname, relative, basename } from "node:path"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const VERIFY = join(ROOT, "scripts", "verify")
const LAUNCHER = join(VERIFY, "lib", "browser.mjs")
const BASELINE_FILE = join(__dirname, "browser-baseline.json")

const LIST = process.argv.includes("--list")
const RECORD = process.argv.includes("--record")

// ───────────────────────────────────────────────────────────────────────────
// THE ALLOW LIST. Every entry costs one honest sentence. An entry with no reason
// fails channel G, and so does an entry that no longer violates anything.
// ───────────────────────────────────────────────────────────────────────────
const ALLOW = {
  "scripts/verify/lib/browser.mjs":
    "IT IS THE LAUNCHER. This is the one place in the repo allowed to import a browser driver " +
    "and the one place allowed to write the word `headless`; every other script gets its Chrome " +
    "from here. Exempting it is the whole point of the rule, not an exception to it.",

  /* ── AN ENTRY FOR THIS GATE WAS WRITTEN HERE AND CHANNEL G DELETED IT ON THE
   * FIRST RUN, which is the mechanism working rather than a fault.
   *
   * The reasoning that put it here was borrowed from `assert-one-knob.mjs`, which
   * genuinely does need one: its analyser reads STRING LITERALS, and its fixtures
   * are strings spelling `http://localhost:3000`, so the gate violates its own
   * channel A by construction. This analyser reads PROPERTY NAMES, IMPORT
   * SPECIFIERS and `process.env` ACCESSES — none of which a fixture string
   * contains. So the known-bads live here in full (`headless:
   * process.env.SL_HEADLESS === "1"` is spelled verbatim at the channel-C mutant)
   * and this file still violates nothing.
   *
   * Copying an exemption from a gate of the same family, without checking whether
   * it is true of THIS one, is exactly how a list stops describing reality. Row G
   * read "allowed but no longer violates anything — DELETE THIS ENTRY" and it was
   * right. Explainer 28 §4: "they are meant to expire, and channel E is what
   * notices when they have." */

  // ── OWNERSHIP, NOT JUDGEMENT. These expire; channel G is what notices. ────
  "scripts/verify/_probe-carve-bounds.mjs":
    "OWNERSHIP, NOT JUDGEMENT — LANE W held this file while lane V converted the other 191. " +
    "Two live lanes may never hold the same file (DISPATCH §4). The conversion is one import " +
    "line and dropping three option keys. REMOVE THIS ENTRY once lane W lands.",
  "scripts/verify/_probe-carve-register.mjs":
    "OWNERSHIP, NOT JUDGEMENT — LANE W held this file. REMOVE THIS ENTRY once lane W lands.",
  "scripts/verify/_probe-drawin-holes.mjs":
    "OWNERSHIP, NOT JUDGEMENT — LANE W held this file. REMOVE THIS ENTRY once lane W lands.",
  "scripts/verify/_probe-lane3-blank-tail.mjs":
    "OWNERSHIP, NOT JUDGEMENT — LANE W held this file. REMOVE THIS ENTRY once lane W lands.",
  "scripts/verify/assert-hero-k7-intact.mjs":
    "OWNERSHIP, NOT JUDGEMENT — LANE X held this file. REMOVE THIS ENTRY once lane X lands.",
}

/* ── THE FIXTURES ARE NOT AN EXEMPTION, THEY ARE THE RATCHET'S SUBJECT ─────
 *
 * Six files under `lib/gate-fixtures/` open a real Chrome ON PURPOSE and must
 * keep doing so. Three are `assert-gate-integrity.mjs`'s calibration set (a gate
 * that only captures, a gate whose judge is dead, a gate that is live and good);
 * three are `run-battery.mjs`'s MODEL-vs-BROWSER calibration set, which that
 * runner re-proves on EVERY invocation and refuses to sweep without. Converting
 * any of them would make the classifier's known answers wrong, which is the
 * instrument, not the subject.
 *
 * They are not in ALLOW because ALLOW is for files whose exemption is a
 * JUDGEMENT. A calibration fixture is a fact about another gate, and six copies
 * of one sentence is padding — which is what gets a list deleted. So they are
 * counted, printed by --list, and ratcheted: six may become five, never seven. */
const FIXTURE_DIR = "scripts/verify/lib/gate-fixtures/"

// ───────────────────────────────────────────────────────────────────────────
// THE BASELINES — read from `browser-baseline.json`, NOT from a const here.
// A MISSING FILE IS A FAILURE, NOT A DEFAULT: falling back to a built-in number
// would make deleting the file a way to choose the ceiling.
// ───────────────────────────────────────────────────────────────────────────
const BASELINE_KEYS = {
  privateLaunchSites: "F · launch sites that do not come from the shared launcher",
  headlessNamingSites: "F · sites naming `headless` outside the launcher",
}
function readBaseline() {
  if (!existsSync(BASELINE_FILE)) return null
  try {
    const j = JSON.parse(readFileSync(BASELINE_FILE, "utf8"))
    for (const k of Object.keys(BASELINE_KEYS)) if (!Number.isInteger(j[k])) return { bad: `\`${k}\` is missing or not an integer` }
    return j
  } catch (e) {
    return { bad: String(e.message).slice(0, 120) }
  }
}
/** THE RATCHET, as one function so --record and --mutate ask the SAME question. */
function canRecord(measured, base) {
  if (!base || base.bad) return { ok: false, rises: [], why: "there is no readable baseline to compare against" }
  const rises = Object.keys(BASELINE_KEYS).filter((k) => measured[k] > base[k])
  return { ok: rises.length === 0, rises, why: rises.map((k) => `${k}: ${base[k]} -> ${measured[k]}`).join(" · ") }
}

// ───────────────────────────────────────────────────────────────────────────
// THE ANALYSER — pure, takes a file path + text, so --mutate can run it over
// temp files without ever writing a scratch script into scripts/verify.
// ───────────────────────────────────────────────────────────────────────────

/** module specifiers that ARE a browser driver. Matched on the specifier NODE. */
const DRIVER_MODULE = /^(playwright|playwright-core|puppeteer|puppeteer-core|@playwright\/test)(\/|$)/
/** the launch family, matched on the CALLEE, not on the file's text. */
const LAUNCH_METHOD = /^(launch|launchPersistentContext|launchServer|connect|connectOverCDP)$/
/** the shared launcher, by specifier. */
const SHARED = /(^|\/)lib\/browser\.mjs$/
/** a headed/headless-shaped env var. `FS_HEADED` is the one knob. */
const HEADED_KNOB = /^[A-Z0-9_]*(HEADLESS|HEADED|PWDEBUG)$/

export function analyse(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const out = {
    driverImports: [], // A
    privateLaunches: [], // B
    sharedLaunches: [],
    headlessNames: [], // C
    foreignKnobs: [], // D
    importsLauncher: false,
  }
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const txt = (n) => (n ? n.getText(sf) : "")

  /** identifier -> "driver" | "shared", built from the file's own imports.
   *  THE BINDING IS THE QUESTION, NOT THE NAME: after the conversion both a
   *  converted and an unconverted file call `chromium.launch`, and only the
   *  import specifier separates them. */
  const origin = new Map()

  const noteImport = (spec, clause, node) => {
    const kind = DRIVER_MODULE.test(spec) ? "driver" : SHARED.test(spec) ? "shared" : null
    if (!kind) return
    if (kind === "driver") out.driverImports.push({ line: lineOf(node), spec })
    else out.importsLauncher = true
    for (const name of clause) origin.set(name, kind)
  }

  const namesFromImportClause = (n) => {
    const names = []
    const c = n.importClause
    if (!c) return names
    if (c.name) names.push(c.name.text)
    const nb = c.namedBindings
    if (nb) {
      if (ts.isNamespaceImport(nb)) names.push(nb.name.text)
      else for (const el of nb.elements) names.push(el.name.text)
    }
    return names
  }
  /** `const { chromium } = await import("…")` / `= require("…")` */
  const namesFromBindingPattern = (name) => {
    if (!name) return []
    if (ts.isIdentifier(name)) return [name.text]
    if (ts.isObjectBindingPattern(name)) return name.elements.map((e) => e.name.getText(sf))
    return []
  }

  const visit = (n) => {
    // ── imports, three ways ─────────────────────────────────────────────────
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      noteImport(n.moduleSpecifier.text, namesFromImportClause(n), n)
    }
    if (ts.isCallExpression(n)) {
      const callee = txt(n.expression)
      const a0 = n.arguments[0]
      const isDyn = n.expression.kind === ts.SyntaxKind.ImportKeyword || /^require$/.test(callee)
      if (isDyn && a0 && (ts.isStringLiteral(a0) || ts.isNoSubstitutionTemplateLiteral(a0))) {
        // find the binding pattern this import is assigned into, if any
        let p = n.parent
        while (p && !ts.isVariableDeclaration(p) && !ts.isSourceFile(p)) p = p.parent
        const names = p && ts.isVariableDeclaration(p) ? namesFromBindingPattern(p.name) : []
        noteImport(a0.text, names, n)
      }
      // ── B · a launch call, judged by where its receiver came from ────────
      if (ts.isPropertyAccessExpression(n.expression) && LAUNCH_METHOD.test(n.expression.name.text)) {
        const recv = n.expression.expression
        const root = ts.isIdentifier(recv) ? recv.text : ts.isPropertyAccessExpression(recv) ? recv.expression.getText(sf) : null
        const from = root ? origin.get(root) : undefined
        const rec = { line: lineOf(n), callee: txt(n.expression), root, from: from ?? "unresolved" }
        if (from === "shared") out.sharedLaunches.push(rec)
        else out.privateLaunches.push(rec)
      }
    }
    // ── C · the flag, in every spelling ────────────────────────────────────
    if (
      (ts.isPropertyAssignment(n) || ts.isPropertySignature(n)) &&
      (ts.isIdentifier(n.name) || ts.isStringLiteral(n.name)) &&
      n.name.text === "headless"
    ) {
      out.headlessNames.push({ line: lineOf(n), how: "property", text: txt(n).replace(/\s+/g, " ").slice(0, 70) })
    }
    if (ts.isShorthandPropertyAssignment(n) && n.name.text === "headless") {
      out.headlessNames.push({ line: lineOf(n), how: "shorthand", text: "headless" })
    }
    if (ts.isBindingElement(n) && ts.isIdentifier(n.name) && n.name.text === "headless") {
      out.headlessNames.push({ line: lineOf(n), how: "destructured", text: txt(n).slice(0, 70) })
    }
    // ── D · a foreign knob ─────────────────────────────────────────────────
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      ts.isIdentifier(n.expression.expression) &&
      n.expression.expression.text === "process" &&
      n.expression.name.text === "env"
    ) {
      const name = n.name.text
      if (HEADED_KNOB.test(name) && name !== "FS_HEADED") out.foreignKnobs.push({ line: lineOf(n), name })
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

// ───────────────────────────────────────────────────────────────────────────

let pass = 0
let fail = 0
const row = (ok, msg, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}${detail ? `  —  ${detail}` : ""}`)
  ok ? pass++ : fail++
}

/* ── CHANNEL E · TEARDOWN, DRIVEN ──────────────────────────────────────────
 * A child process tracks a FAKE browser and then dies the way it was told to.
 * No Chrome is involved, which is the only reason this can run at all on a
 * machine where a window must not appear — and it is also a BETTER control than
 * a real browser would be, because a fake can prove `close()` was called rather
 * than that a process happened to vanish. */
const TEARDOWN_CHILD = (mod, flag, mode) => `
import { writeFileSync } from "node:fs"
const M = await import(${JSON.stringify(mod)})
const rec = M.register({ repo: "selftest", ownerPid: process.pid, n: 1, label: "teardown", marker: "x", pids: [], startedAt: "now" })
M.track({ async close() { writeFileSync(${JSON.stringify(flag)}, "closed") }, on() {} }, { pids: [], recordPath: rec })
console.log(rec)
${mode === "throw" ? 'setTimeout(() => { throw new Error("boom") }, 10)' : ""}
${mode === "reject" ? 'setTimeout(() => { Promise.reject(new Error("nope")) }, 10)' : ""}
${mode === "exit" ? "setTimeout(() => process.exit(0), 10)" : ""}
${mode === "signal" || mode === "kill9" ? "setTimeout(() => {}, 60000)" : ""}
${mode === "untracked" ? "setTimeout(() => { throw new Error('boom') }, 10)" : ""}
`

function runTeardown(dir, mode) {
  const flag = join(dir, `${mode}.flag`)
  const src = join(dir, `child-${mode}.mjs`)
  writeFileSync(
    src,
    mode === "untracked"
      ? // THE NEGATIVE CONTROL: same child, but it never tracks anything. If the
        // flag appears here, the flag is not evidence of anything.
        `import { writeFileSync } from "node:fs"\nconst M = await import(${JSON.stringify(LAUNCHER)})\nconsole.log("none")\nsetTimeout(() => { throw new Error("boom") }, 10)\n`
      : TEARDOWN_CHILD(LAUNCHER, flag, mode),
  )
  return new Promise((res) => {
    const p = spawn(process.execPath, [src], { stdio: ["ignore", "pipe", "pipe"] })
    let out = ""
    p.stdout.on("data", (d) => {
      out += d
      if (mode === "signal") setTimeout(() => p.kill("SIGTERM"), 30)
      if (mode === "kill9") setTimeout(() => p.kill("SIGKILL"), 30)
    })
    p.stderr.on("data", () => {})
    p.on("close", (code) => {
      const rec = out.trim().split("\n")[0]
      const recordLeft = rec && rec !== "none" ? existsSync(rec) : null
      if (rec && rec !== "none") rmSync(rec, { force: true })
      res({ mode, code, closed: existsSync(flag), recordLeft })
    })
  })
}

{
  // ─────────────────────────────────────────────────────────────────────────
  // THE NEGATIVE CONTROLS, AND THEY RUN ON THE BARE INVOCATION.
  //
  // DISPATCH §2.6: "Calibrate the instrument against a known-bad input and
  // require it to fail. A green row that cannot fail is the lie." Everything
  // below runs in a temp dir; nothing is written into scripts/verify.
  //
  // ⚠ ALL 24 USED TO SIT BEHIND `--mutate`, AND NO SWEEP HAS EVER PASSED IT.
  // `docs/explainers/21-losing-your-work.md` §7 states the law — "the gate runs
  // three kinds of control on the DEFAULT invocation, never behind a flag."
  // Explainer 31 measured nineteen gates breaking it; explainer 36 moved
  // thirteen onto the default path. This gate was in neither pass, and it had a
  // sharper version of the same defect: the block below already ARGUED the case
  // and then drew the line in the wrong place. See the calibration block further
  // down, which quotes `run-battery.mjs` — "it costs ~0.1 s, so there is no
  // version of this behind a flag" — moves three checks onto the bare path on
  // exactly that reasoning, and leaves the other 24 behind the flag anyway.
  //
  // THE COST ARGUMENT DOES NOT SURVIVE BEING MEASURED. The full 24-row set is
  // 0.64 s, all of it `createSourceFile` over strings of a few hundred bytes
  // plus four short-lived node children for the teardown rows. Explainer 36 §2
  // sets the bar for scheduling an arm elsewhere at Lane I's accepted example,
  // `assert-layer-flicker --fusion` at 304 s. This is three orders of magnitude
  // under it, so the flag is DELETED rather than handed to a runner table —
  // explainer 29 §5: "a runner-passed flag only helps people who go through a
  // runner", and anyone typing this gate's name still gets the half that cannot
  // fail.
  //
  // The rows land in the SAME counters as the sweep below, so the gate prints
  // one verdict and `--record` refuses while a control is red.
  // ─────────────────────────────────────────────────────────────────────────
  const dir = mkdtempSync(join(tmpdir(), "onebrowser-"))
  const M = (name, src) => analyse(join(dir, name), src)

  // ── A · a driver import, three spellings ────────────────────────────────
  const a1 = M("assert-mutant-import.mjs", `import { chromium } from "playwright-core"\nawait chromium.launch()\n`)
  row(a1.driverImports.length === 1 && a1.privateLaunches.length === 1, "MUTANT A · a STATIC driver import is CAUGHT", `${a1.driverImports.length} import(s) · ${a1.privateLaunches.length} private launch(es)`)

  const a2 = M("assert-mutant-dyn.mjs", `const { chromium } = await import("playwright-core")\nawait chromium.launch({})\n`)
  row(a2.driverImports.length === 1 && a2.privateLaunches.length === 1, "MUTANT A · a DYNAMIC driver import is CAUGHT", "assert-hero-dials.mjs and _probe-break-carve.mjs both had this shape; a static-import-only check reads 0 on them")

  const a3 = M("assert-mutant-req.mjs", `const pw = require("puppeteer")\nawait pw.launch()\n`)
  row(a3.driverImports.length === 1, "MUTANT A · a require() of a driver is CAUGHT", a3.driverImports[0]?.spec)

  // ── B · THE ONE THAT MAKES THE GATE WORTH HAVING ────────────────────────
  // After the conversion BOTH files below read `chromium.launch(...)`. Only the
  // import specifier tells them apart, so a name-based check calls them the same.
  const b1 = M("assert-mutant-lookalike.mjs", `import { chromium } from "playwright-core"\nconst b = await chromium.launch({ headless: true, args: [] })\n`)
  const b2 = M("assert-mutant-converted.mjs", `import { chromium } from "./lib/browser.mjs"\nconst b = await chromium.launch()\n`)
  row(
    b1.privateLaunches.length === 1 && b2.privateLaunches.length === 0 && b2.sharedLaunches.length === 1,
    "MUTANT B · two files whose LAUNCH CALLS ARE IDENTICAL are told apart by their BINDING",
    `driver-bound: ${b1.privateLaunches.length} private · launcher-bound: ${b2.privateLaunches.length} private, ${b2.sharedLaunches.length} shared — a callee-name check scores both the same`,
  )
  const b3 = M("assert-mutant-unresolved.mjs", `await someBrowserThing.launch({ headless: false })\n`)
  row(b3.privateLaunches[0]?.from === "unresolved", "MUTANT B · a launch whose receiver cannot be resolved is NOT waved through", "an unknown origin is a violation, not a default")

  // ── C · THE HEADLINE, AND IT IS NOT SYNTHETIC ───────────────────────────
  // The exact line that was live at verify-screen-layers.mjs, restored.
  const KNOWN_BAD_LINE = `  headless: process.env.SL_HEADLESS === "1",`
  const c1 = M(
    "assert-mutant-computed.mjs",
    `import { chromium } from "./lib/browser.mjs"\nconst b = await chromium.launch({\n  channel: "chrome",\n${KNOWN_BAD_LINE}\n  args: ["--use-angle=metal"],\n})\n`,
  )
  row(
    c1.headlessNames.length === 1 && c1.foreignKnobs.length === 1,
    "MUTANT C · the COMPUTED flag from verify-screen-layers.mjs is CAUGHT",
    `channel C: ${c1.headlessNames.length} · channel D: ${c1.foreignKnobs[0]?.name} — this file defaulted to HEADED for days`,
  )
  row(
    !/headless:\s*false/.test(KNOWN_BAD_LINE) && c1.headlessNames.length === 1,
    "…and a `headless: false` GREP finds NOTHING in it",
    "explainer 37 §3.1 — \"the census is scoped by a spelling\"; this is the whole argument for parsing",
  )
  const c2 = M("assert-mutant-true.mjs", `import { chromium } from "./lib/browser.mjs"\nawait chromium.launch({ headless: true })\n`)
  row(c2.headlessNames.length === 1, "MUTANT C · `headless: true` fails TOO", "a file that computes the right answer privately still cannot be overruled by one env var")
  const c3 = M("assert-mutant-shorthand.mjs", `const headless = true\nawait chromium.launch({ headless })\n`)
  row(c3.headlessNames.length >= 1, "MUTANT C · the SHORTHAND spelling is caught", `${c3.headlessNames.length} hit(s) — \`{ headless }\` names it just as loudly`)
  const c4 = M("assert-mutant-strkey.mjs", `await chromium.launch({ "headless": false })\n`)
  row(c4.headlessNames.length === 1, "MUTANT C · a STRING-KEYED `\"headless\"` is caught", "the quotes are not a hiding place")

  // ── THE CONTROLS. An instrument that is simply always-red has measured nothing.
  const clean = M(
    "assert-mutant-clean.mjs",
    `import { chromium } from "./lib/browser.mjs"\nimport { LAB_URL } from "./lib/dev-server.mjs"\nconst b = await chromium.launch({ headed: true })\nawait b.close()\n`,
  )
  row(
    clean.driverImports.length === 0 && clean.privateLaunches.length === 0 && clean.headlessNames.length === 0 && clean.foreignKnobs.length === 0 && clean.importsLauncher,
    "A CONVERTED file is NOT flagged (the instrument is not simply always-red)",
    "driver=0 private=0 headless=0 knobs=0 importsLauncher=true — this is exactly what 191 files now look like",
  )
  const prose = M(
    "assert-mutant-prose.mjs",
    `// this used to say headless: false and that was the bug\n/* see also process.env.SL_HEADLESS and chromium.launch({ headless: false }) */\nimport { chromium } from "./lib/browser.mjs"\nawait chromium.launch()\n`,
  )
  row(
    prose.headlessNames.length === 0 && prose.foreignKnobs.length === 0 && prose.driverImports.length === 0,
    "A file whose ONLY mention of the flag is in COMMENTS is NOT flagged",
    "a grep fires on both lines, and FIVE real files in this tree — including this gate — discuss `headless: false` in prose",
  )
  const strLit = M("assert-mutant-string.mjs", `const doc = "pass headless: false to see a window"\nconsole.log(doc)\n`)
  row(strLit.headlessNames.length === 0, "…and neither is one that mentions it inside a STRING", "a property name is structure; the same characters in a message are not")

  // ── D · the foreign knob, including the one a killed lane parked ─────────
  const d1 = M("assert-mutant-knob.mjs", `const a = process.env.FS_HEADLESS\nconst b = process.env.SL_HEADLESS\nconst c = process.env.PWDEBUG\nconst ok = process.env.FS_HEADED\n`)
  row(
    d1.foreignKnobs.length === 3 && !d1.foreignKnobs.some((k) => k.name === "FS_HEADED"),
    "MUTANT D · foreign knob names are CAUGHT and FS_HEADED is not",
    `${d1.foreignKnobs.map((k) => k.name).join(", ")} — FS_HEADLESS is Lane R's parked name, live at unfinished-lane-R/…/verify-screen-layers.mjs:267`,
  )

  // ── E · TEARDOWN, DRIVEN END TO END AGAINST A FAKE BROWSER ──────────────
  const want = {
    throw: { closed: true, recordLeft: false, why: "a gate that throws at row 4 of 40 must not leave a Chrome behind" },
    reject: { closed: true, recordLeft: false, why: "an unhandled rejection is the most common way one of these dies" },
    signal: { closed: true, recordLeft: false, why: "Ctrl-C and `kill <pid>`" },
    exit: { closed: false, recordLeft: false, why: "`exit` cannot await, so the browser is KILLED, not closed — but the record still goes" },
    kill9: { closed: false, recordLeft: true, why: "NOTHING in-process survives this, and a session limit IS this. The record left behind is what sweep-browsers.mjs reads" },
  }
  for (const mode of Object.keys(want)) {
    const r = await runTeardown(dir, mode)
    const w = want[mode]
    row(
      r.closed === w.closed && r.recordLeft === w.recordLeft,
      `E · TEARDOWN on ${mode.padEnd(6)} — closed=${r.closed} recordLeft=${r.recordLeft}`,
      `${w.why} (exit ${r.code})`,
    )
  }
  const neg = await runTeardown(dir, "untracked")
  row(neg.closed === false, "E · CONTROL — a child that tracks NOTHING writes no flag", "otherwise every row above would pass on a machine where the flag file simply appears")

  // ── the baseline file's own ratchet, exercised rather than assumed ───────
  const bl = readBaseline()
  row(bl !== null && !bl.bad, "BASELINE FILE loads and carries every key as an integer", bl?.bad ?? Object.keys(BASELINE_KEYS).map((k) => `${k}=${bl?.[k]}`).join(" · "))
  row(
    !canRecord({ privateLaunchSites: (bl?.privateLaunchSites ?? 0) + 1, headlessNamingSites: bl?.headlessNamingSites ?? 0 }, bl).ok,
    "RATCHET · --record REFUSES a measurement that would RAISE a baseline",
    "a paydown mechanism that can also raise the ceiling is not a ratchet",
  )
  row(
    canRecord({ privateLaunchSites: Math.max(0, (bl?.privateLaunchSites ?? 0) - 1), headlessNamingSites: bl?.headlessNamingSites ?? 0 }, bl).ok,
    "RATCHET · --record ACCEPTS a measurement that lowers one",
    "which is the point: lanes W and X can hold the ground they pay for without touching this gate",
  )

  // ── THE REAL IN-TREE CONTROL, not a fixture ─────────────────────────────
  // The launcher itself must read as: imports a driver, names the flag, and is
  // the ONE file allowed to. If this comes back clean the analyser is blind.
  {
    const r = analyse(LAUNCHER, readFileSync(LAUNCHER, "utf8"))
    row(
      r.driverImports.length >= 1 && r.headlessNames.length >= 1,
      "REAL IN-TREE CONTROL · lib/browser.mjs itself DOES violate A and C",
      `driverImports=${r.driverImports.length} headlessNames=${r.headlessNames.length} — its ALLOW entry is load-bearing, not decorative`,
    )
  }

  rmSync(dir, { recursive: true, force: true })
  console.log("")
}

// ── the real sweep ─────────────────────────────────────────────────────────
const files = []
const walk = (d) => {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) walk(join(d, e.name))
    else if (e.name.endsWith(".mjs")) files.push(join(d, e.name))
  }
}
walk(VERIFY)
files.sort()

const results = files.map((f) => {
  const rel = relative(ROOT, f)
  return { rel, base: basename(f), ...analyse(f, readFileSync(f, "utf8")) }
})

/* ── THE ANALYSER CALIBRATES ITSELF, EVERY BARE RUN, BEFORE IT IS BELIEVED ──
 *
 * `run-battery.mjs` makes the same argument about its own classifier and it is
 * right: *"an analyser that has never rejected anything is the disease it is
 * looking for, one floor up… it costs ~0.1 s, so there is no version of this
 * behind a flag."* These three cost three `createSourceFile` calls on ~100 bytes
 * each and are the minimum that make the seven rows below mean anything.
 *
 * ⚠ THIS BLOCK USED TO END "the full 24-row control set stays in `--mutate`",
 * and that sentence is why the gate spent months certifying itself with a
 * control set no battery ran. The reasoning quoted above admits no such line:
 * if 0.1 s is too cheap to hide behind a flag, so is 0.64 s. The 24 now run
 * bare, above, and this block stays as the CALIBRATION — a hard refusal to
 * sweep at all on a blind analyser, which is a stronger statement than a red
 * row and is worth keeping separate from them.
 *
 * The known-bad is the REAL one — the line that was live in
 * `verify-screen-layers.mjs` and that a `headless: false` census could not see.
 * If channel C ever goes blind to it, this file refuses to print a verdict rather
 * than printing seven green rows about nothing. */
{
  const bad = analyse(
    "calibrate-known-bad.mjs",
    `import { chromium } from "playwright-core"\nawait chromium.launch({ headless: process.env.SL_HEADLESS === "1" })\n`,
  )
  const good = analyse(
    "calibrate-clean.mjs",
    `import { chromium } from "./lib/browser.mjs"\nconst b = await chromium.launch({ headed: true })\nawait b.close()\n`,
  )
  const prose = analyse("calibrate-prose.mjs", `// it used to say headless: false and read process.env.SL_HEADLESS\n`)
  const caught = bad.driverImports.length === 1 && bad.privateLaunches.length === 1 && bad.headlessNames.length === 1 && bad.foreignKnobs.length === 1
  const cleanIsClean = good.driverImports.length === 0 && good.privateLaunches.length === 0 && good.headlessNames.length === 0 && good.sharedLaunches.length === 1
  const proseIsClean = prose.headlessNames.length === 0 && prose.foreignKnobs.length === 0
  if (!(caught && cleanIsClean && proseIsClean)) {
    console.log("=== CALIBRATION ===")
    console.log(`FAIL  the analyser is not calibrated — knownBadCaught=${caught} cleanStaysClean=${cleanIsClean} proseStaysClean=${proseIsClean}`)
    console.log("\nRefusing to sweep on an uncalibrated analyser. Every row it would print is unproven.")
    process.exit(1)
  }
  row(
    true,
    "CALIBRATED · the real known-bad is caught on all four channels, and neither a converted file nor prose is",
    "`headless: process.env.SL_HEADLESS === \"1\"` — the line that was live at verify-screen-layers.mjs and that no `headless: false` grep could find",
  )
}

const allowed = (r) => Object.prototype.hasOwnProperty.call(ALLOW, r.rel)
const isFixture = (r) => r.rel.startsWith(FIXTURE_DIR)
const judged = results.filter((r) => !allowed(r))

// the two ratcheted measurements, computed ONCE so --list, --record and the rows
// below can never disagree about what was measured.
const ratchetFiles = judged.filter((r) => isFixture(r) && (r.privateLaunches.length || r.headlessNames.length))
const MEASURED = {
  privateLaunchSites: ratchetFiles.reduce((n, r) => n + r.privateLaunches.length, 0),
  headlessNamingSites: ratchetFiles.reduce((n, r) => n + r.headlessNames.length, 0),
}
const baseline = readBaseline()

if (LIST) {
  /* ⚠ THE MARKER IS NOT THE WORD `FAIL`, AND THAT IS DELIBERATE.
   *
   * These two lines used to prefix an offending file with the literal string
   * "  ⚠ FAIL  ". `assert-gate-integrity.mjs` channel J reported them as two
   * "judgements no sweep reaches", because it asks a SOURCE-level question —
   * does this console call build a string carrying a PASS/FAIL token — and a
   * listing label spelled `FAIL` answers yes. It was never a judgement: `--list`
   * emits no verdict, is not exit-coupled, and exits 0 unconditionally below.
   *
   * `lib/verdict-rows.mjs` is explicit that PASS and FAIL are a reserved
   * alphabet with two readers, and this file was spending one of them on a
   * bullet point. `⚠ DIRTY` says the same thing to a person and nothing to
   * either reader. The judgements live in `row()`, where they belong. */
  console.log("── FILES THAT STILL OPEN THEIR OWN CHROME ──")
  for (const r of results)
    if (r.driverImports.length || r.privateLaunches.length)
      console.log(`  ${allowed(r) ? "[allowed] " : isFixture(r) ? "[fixture] " : "  ⚠ DIRTY "}${r.rel}  driverImports=${r.driverImports.length} privateLaunches=${r.privateLaunches.length}`)
  console.log("\n── FILES THAT NAME `headless` ──")
  for (const r of results)
    if (r.headlessNames.length)
      console.log(`  ${allowed(r) ? "[allowed] " : isFixture(r) ? "[fixture] " : "  ⚠ DIRTY "}${r.rel}:${r.headlessNames[0].line}  (${r.headlessNames[0].how})`)
  console.log(`\n── THROUGH THE SHARED LAUNCHER ──\n  ${results.filter((r) => r.sharedLaunches.length).length} files, ${results.reduce((n, r) => n + r.sharedLaunches.length, 0)} launch sites`)
  console.log("\n── ALLOW ──")
  for (const [rel, why] of Object.entries(ALLOW)) console.log(`  ${rel}\n      ${why.slice(0, 150)}`)
  process.exit(0)
}

// ── A · a driver import outside the launcher ───────────────────────────────
const aBad = judged.filter((r) => r.driverImports.length && !isFixture(r))
row(
  aBad.length === 0,
  "A · no script imports a browser driver except lib/browser.mjs",
  aBad.length === 0
    ? `${results.length} files parsed, ${Object.keys(ALLOW).length} allowed by written reason, ${ratchetFiles.length} calibration fixtures ratcheted`
    : aBad.map((r) => `${r.rel}:${r.driverImports[0].line}`).join(" · "),
)

// ── B · a launch whose binding is not the shared launcher ──────────────────
const bBad = judged.filter((r) => r.privateLaunches.length && !isFixture(r))
row(
  bBad.length === 0,
  "B · every launch call resolves to a binding imported from lib/browser.mjs",
  bBad.length === 0
    ? `${results.reduce((n, r) => n + r.sharedLaunches.length, 0)} launch sites across ${results.filter((r) => r.sharedLaunches.length).length} files, all launcher-bound`
    : bBad.map((r) => `${r.rel}:${r.privateLaunches[0].line} (${r.privateLaunches[0].from})`).join(" · "),
)

// ── C · nobody names the flag ──────────────────────────────────────────────
const cBad = judged.filter((r) => r.headlessNames.length && !isFixture(r))
row(
  cBad.length === 0,
  "C · no script names `headless` — literally, computed, shorthand or string-keyed",
  cBad.length === 0
    ? "the decision belongs to lib/browser.mjs and to FS_HEADED; a call site asks with `headed: true` and can be overruled"
    : cBad.map((r) => `${r.rel}:${r.headlessNames[0].line} (${r.headlessNames[0].how})`).join(" · "),
)

// ── D · foreign knob names ─────────────────────────────────────────────────
const dBad = judged.filter((r) => r.foreignKnobs.length)
row(
  dBad.length === 0,
  "D · no script reads a headless/headed env var by any name other than FS_HEADED",
  dBad.length === 0
    ? "one knob, one name — unset lets the call site ask, =1 forces headed, =0 forces headless over every call site"
    : dBad.map((r) => `${r.rel}:${r.foreignKnobs[0].line} (${r.foreignKnobs.map((k) => k.name).join(",")})`).join(" · "),
)

// ── E · the launcher still has all four teardown channels ──────────────────
// Structural, on every sweep; --mutate drives them for real. Both are needed:
// this one catches a deleted handler in a diff, that one catches a broken one.
{
  const src = readFileSync(LAUNCHER, "utf8")
  const sf = ts.createSourceFile(LAUNCHER, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const hooked = new Set()
  const visit = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.expression.getText(sf) === "process" &&
      /^(on|once)$/.test(n.expression.name.text)
    ) {
      const a0 = n.arguments[0]
      if (a0 && ts.isStringLiteral(a0)) hooked.add(a0.text)
      // `for (const sig of ["SIGINT", …]) process.on(sig, …)` — read the loop's list
      if (a0 && ts.isIdentifier(a0)) {
        let p = n.parent
        while (p && !ts.isForOfStatement(p) && !ts.isSourceFile(p)) p = p.parent
        if (p && ts.isForOfStatement(p) && ts.isArrayLiteralExpression(p.expression))
          for (const el of p.expression.elements) if (ts.isStringLiteral(el)) hooked.add(el.text)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  const need = ["exit", "SIGINT", "SIGTERM", "uncaughtException", "unhandledRejection"]
  const missing = need.filter((x) => !hooked.has(x))
  row(
    missing.length === 0,
    "E · the launcher registers teardown on exit, SIGINT, SIGTERM, uncaughtException and unhandledRejection",
    missing.length === 0
      ? `${[...hooked].sort().join(", ")} — and --mutate DRIVES all five against a fake browser, plus kill -9, which none of them survives`
      : `MISSING: ${missing.join(", ")}`,
  )
}

// ── F · the ratchet ────────────────────────────────────────────────────────
const baseOk = baseline !== null && !baseline.bad
if (!baseOk) {
  row(
    false,
    "the baseline file is readable",
    `${relative(ROOT, BASELINE_FILE)} — ${baseline === null ? "missing" : baseline.bad}. Channel F cannot be judged without it; recreate it with \`node scripts/verify/assert-one-browser.mjs --record\` from a tree you trust.`,
  )
}
const fOk =
  baseOk &&
  MEASURED.privateLaunchSites <= baseline.privateLaunchSites &&
  MEASURED.headlessNamingSites <= baseline.headlessNamingSites
row(
  fOk,
  "F · the calibration-fixture debt has not GROWN",
  !baseOk
    ? "no baseline"
    : `${MEASURED.privateLaunchSites} private launch site(s) + ${MEASURED.headlessNamingSites} headless site(s) across ${ratchetFiles.length} fixtures ` +
      `vs baseline ${baseline.privateLaunchSites}/${baseline.headlessNamingSites}` +
      (MEASURED.privateLaunchSites < baseline.privateLaunchSites || MEASURED.headlessNamingSites < baseline.headlessNamingSites
        ? " — it FELL; run --record to hold the ground (no gate ownership needed)"
        : MEASURED.privateLaunchSites === baseline.privateLaunchSites && MEASURED.headlessNamingSites === baseline.headlessNamingSites
          ? " — held"
          : " — a NEW private launcher was added"),
)

// ── G · the allow list is honest ───────────────────────────────────────────
const gProblems = []
for (const [rel, reason] of Object.entries(ALLOW)) {
  if (!reason || reason.trim().length < 40) gProblems.push(`${rel}: reason missing or too thin to be a reason`)
  const r = results.find((x) => x.rel === rel)
  if (!r) {
    gProblems.push(`${rel}: allowed but NOT FOUND on disk — stale entry`)
    continue
  }
  const violates = r.driverImports.length > 0 || r.privateLaunches.length > 0 || r.headlessNames.length > 0 || r.foreignKnobs.length > 0
  if (!violates) gProblems.push(`${rel}: allowed but no longer violates anything — DELETE THIS ENTRY`)
}
row(
  gProblems.length === 0,
  "G · every ALLOW entry carries a written reason and still needs the exemption",
  gProblems.length === 0
    ? `${Object.keys(ALLOW).length} entries, all live — 5 of them say OWNERSHIP, NOT JUDGEMENT and are meant to EXPIRE`
    : gProblems.join(" · "),
)

console.log("")
const laneHeld = Object.entries(ALLOW).filter(([, why]) => why.startsWith("OWNERSHIP")).length
console.log(
  `scanned ${results.length} .mjs under scripts/verify — ` +
    `${results.filter((r) => r.sharedLaunches.length).length} launch through lib/browser.mjs, ` +
    `${results.filter((r) => r.privateLaunches.length).length - 1} do not ` +
    `(${ratchetFiles.length} ratcheted calibration fixtures + ${laneHeld} held by a live lane), ` +
    `and 1 IS the launcher`,
)
console.log(`assert-one-browser: ${pass} PASS · ${fail} FAIL`)

if (RECORD) {
  /* ── THE PAYDOWN PATH, AND IT NEEDS NO OWNERSHIP OF THIS FILE ─────────────
   * `--record` runs LAST and refuses while any NON-ratchet channel is red.
   * `assert-one-knob`'s first version ran first and was a laundering channel: a
   * planted known-bad proved that with the sweep RED it still wrote the count
   * down as the new floor, because the number was below the ceiling. Recording
   * during a red run grandfathers whatever made it red. */
  const ratchetFails = fOk ? 0 : 1
  const hardFail = fail - ratchetFails
  const verdict = canRecord(MEASURED, baseline)
  console.log("")
  if (hardFail > 0) {
    console.log(`REFUSED — ${hardFail} channel(s) other than the ratchet are RED. Nothing was written.`)
    console.log("  Recording a baseline during a red run grandfathers whatever made it red.")
    process.exit(1)
  }
  if (!verdict.ok) {
    console.log(`REFUSED — --record may only LOWER a baseline. ${verdict.why}`)
    console.log("  Nothing was written. A ratchet that can be raised is a debt counter.")
    process.exit(1)
  }
  const next = { ...baseline, ...MEASURED, measuredAt: new Date().toISOString().slice(0, 10) }
  writeFileSync(BASELINE_FILE, JSON.stringify(next, null, 2) + "\n")
  for (const k of Object.keys(BASELINE_KEYS))
    console.log(`  ${k}: ${baseline[k]} -> ${MEASURED[k]}${baseline[k] === MEASURED[k] ? "  (held)" : `  (paid down ${baseline[k] - MEASURED[k]})`}`)
  console.log(`recorded to ${relative(ROOT, BASELINE_FILE)}`)
  process.exit(0)
}

process.exit(fail === 0 ? 0 : 1)
