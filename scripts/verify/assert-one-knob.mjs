// ASSERT-ONE-KNOB — NO SCRIPT IN scripts/verify MAY NAME ITS OWN DEV SERVER.
// battery: model
//
// ── WHY A SWEEP WAS NOT ENOUGH ─────────────────────────────────────────────
//
// `scripts/verify/lib/dev-server.mjs` was written to close exactly one defect:
// three names for one knob, so "set the one your muscle memory has and half the
// battery talks to the shared server on :3000 anyway, with no error, and the run
// is attributed to the wrong tree." **The fix landed in 46 scripts and missed
// 35 of the 48 browser gates**, which never imported it. Nothing noticed for
// four days, because on the shared checkout the hardcoded literal and the
// derived URL are the same string — it only bites in a lane, which is precisely
// where the confident-green wrong answer does the most damage. Explainer 27.
//
// So the sweep is half the fix. This file is the other half, and the standing
// rule for a systemic drift is three things, not one: **the sweep, a gate that
// fails on the next violation, and an exemption list that demands a written
// reason.** The exemption list is the part that gets skipped, and it is what
// makes the gate survive: a gate with no exemption mechanism gets disabled the
// first time it is inconvenient; one that costs a single honest sentence stays on.
//
// ── WHY A BANNED-NAMES LIST CANNOT BE THE DEFENCE ──────────────────────────
//
// `dev-server.mjs` throws on `HERO_URL` / `LAB_URL`, and had never heard of
// `FS_URL`, which was live in four files the entire time. That is the second
// time that blacklist has been found short — a list of banned names can only
// catch the names somebody already thought of. This gate inverts it: a script
// may not name a dev server AT ALL. The URL comes from the shared module or the
// script does not get one. A whitelist catches the next name too.
//
// ── THE FIVE CHANNELS ──────────────────────────────────────────────────────
//
//   A  HARDCODED URL      an assert-* gate carries `localhost:<digits>` in a
//                         string. `http://localhost:${PORT}` does NOT fire —
//                         deriving the path from the port is fine, the port IS
//                         the knob (explainer 27 §6). Channel B covers that case.
//   B  PRIVATE PORT LINE  a gate names `localhost` at all — literally or by
//                         interpolation — without importing the shared resolver.
//                         This is the SUBTLE half: `assert-tsc-baseline.mjs` had
//                         its own `process.env.FS_PORT || 3000`, so it honoured
//                         FS_PORT and *silently ignored a set HERO_URL*, opting
//                         out of the throw the module exists to provide. "Reads
//                         FS_PORT" was never the bar. "Imports the resolver" is.
//   C  FOREIGN KNOB       any file here reading `process.env.<SOMETHING_URL|
//                         _PORT|_HOST|_ORIGIN>` that is not `FS_PORT`.
//   D  THE RATCHET        the non-gate files (`_probe-*`, `verify-*`, and the
//                         handful of tools) that still hardcode are REAL debt —
//                         92 SITES across 90 files, a separate sweep's work.
//                         Demanding 90 written reasons would produce 90 copies of one
//                         sentence, which is padding, and padding is what gets a
//                         list deleted. So they are BASELINED instead: the count
//                         may fall, never rise. A new hardcoded probe is a
//                         regression and fails here even though the existing
//                         ones are grandfathered.
//   E  ALLOW HONESTY      every ALLOW entry must carry a non-empty reason AND
//                         must still actually violate something. An exemption
//                         for a file that no longer needs one is stale, and a
//                         stale exemption is how a list stops describing reality.
//                         "A gate that is loosened and never re-tested is a gate
//                         that has been deleted."
//   F  ABSOLUTE PATH      a string or template literal naming a CHECKOUT by
//                         absolute path. THE DEFECT IS A PATH, NOT A URL, and
//                         channels A-E were structurally unable to see it.
//   G  URL IN A REGEXP    a dev-server address written as a RegularExpression
//                         literal. The analyser read string + template literals
//                         only, so this was invisible and was never in the debt.
//
// ── F AND G: WHY THE FIRST FIVE CHANNELS WERE THE WRONG SHAPE ──────────────
//
// Explainer 28 §6 names the pattern this whole family keeps arriving at: "an
// instrument scoped by a description of the problem, rather than by the problem."
// Channels A-E were scoped to `localhost:<digits>` inside a string. Two things
// that are the same defect were therefore outside the description:
//
//   G, measured 2026-08-07: `_probe-root-wedge.mjs:146` stripped the origin off
//      stack-trace lines with `/\(http:\/\/localhost:3000/`. A dev-server address
//      inside a RegExp literal. This gate walks the tree and reads only
//      `isStringLiteral` / `isNoSubstitutionTemplateLiteral` / template
//      expressions, so it was never one of the 92 and could never have become one.
//
//   F, same sweep: SIX scripts hardcoded an ABSOLUTE PATH into a checkout. Two
//      wrote their captures into the shared checkout's stored evidence — and one,
//      `_probe-drawin-film.mjs:16`, `rmSync`'d that directory FIRST. So a lane
//      running a capture on its own port did not merely file wrong evidence in the
//      shared checkout: it DELETED the shared checkout's stored evidence before
//      writing. Destroying evidence is strictly worse than writing bad evidence,
//      because a wrong frame can be re-graded and a deleted one cannot.
//
//      And the worst of the six was not an output at all. `assert-texture-motion`
//      read the CANONICAL `lib/style-system.ts` absolutely to derive the very set
//      of rows it grades, so it graded the shared tree's texture-mode list from
//      any tree — with the rows still headed by the right names, because the names
//      came from the same file. Re-pointing a tool's URL fixes which tree it
//      READS over HTTP; it says nothing about which tree it reads off DISK, and
//      nothing at all about which tree it WRITES to.
//
// F and G are exactly as parse-based as A-D, and for the same reason:
// `assert-gate-integrity.mjs:1502` discusses this defect class in a COMMENT that
// spells an absolute path, so a grep-based F is wrong on day one and gets
// disabled on day two. That file is a real in-tree negative control, supplied by
// the repo rather than invented here, and --mutate asserts it stays clean.
//
// ── THE RATCHET'S BASELINE IS NO LONGER A PRIVATE CONST ────────────────────
//
// It was `const NON_GATE_DEBT_BASELINE = 92` in this file. Lane J then paid 85
// sites down and COULD NOT RECORD IT, because lowering the number meant editing
// a gate it did not own, and two live lanes may never hold the same file
// (DISPATCH §4). Its design note is the finding, and it is a real one:
//
//   "the ratchet's baseline is a private constant in the file that reads it, so a
//    lane that pays debt down cannot record the gain."
//
// A ratchet only its author can lower is a debt counter, not a gate: the number
// drifts upward from reality until nobody believes it, which is the same failure
// as a stale ALLOW entry one level up. So the baselines live in
// `one-knob-baseline.json` beside this file, and ANY lane can record what it paid
// down with `--record` — which writes the CURRENT measurement and REFUSES, without
// writing anything, if any count would RISE. Paying debt down needs no ownership;
// raising the ceiling is still impossible. Missing file = a FAIL row naming the
// command, never a silent pass.
//
// ── WHY IT PARSES INSTEAD OF GREPPING ──────────────────────────────────────
//
// `assert-drawin-attrs.mjs:155` contains `http://localhost:3000` inside a
// COMMENT describing this very defect, and `assert-hero-flatstate.mjs:115` does
// the same. A grep flags both and the gate is wrong on day one. Stripping
// comments with a regex is WORSE than useless here: the naive `//.*$` stripper
// eats `//localhost:3000"` out of `"http://localhost:3000"` — it deletes the
// exact evidence it was looking for, and the gate goes quietly green. So this
// walks the real syntax tree and reads only string and template literals.
// Channel `comment-blind` in --mutate proves both halves of that.
//
// Usage:
//   node scripts/verify/assert-one-knob.mjs            # channels A-G AND the 15 negative controls
//   node scripts/verify/assert-one-knob.mjs --list     # the debt, by file
//   node scripts/verify/assert-one-knob.mjs --record   # you paid debt down: hold the ground
//
// There is no `--mutate`. The controls run on the bare invocation, which is the
// invocation the next person types. Explainer 29 §5, and the EXTRA_ARGS note in
// `run-battery.mjs`.

import ts from "typescript"
import { readdirSync, readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs"
import { join, dirname, relative, basename } from "node:path"
import { fileURLToPath } from "node:url"
import { tmpdir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const VERIFY = join(ROOT, "scripts", "verify")
const BASELINE_FILE = join(__dirname, "one-knob-baseline.json")

const LIST = process.argv.includes("--list")
const RECORD = process.argv.includes("--record")

// ───────────────────────────────────────────────────────────────────────────
// THE ALLOW LIST. Every entry costs one honest sentence. An entry with no
// reason fails channel E, and so does an entry that no longer violates.
// ───────────────────────────────────────────────────────────────────────────
const ALLOW = {
  "scripts/verify/lib/dev-server.mjs":
    "IT IS THE RESOLVER. This is the one place in the repo allowed to name a dev " +
    "server; every other script derives its URL from here. Exempting it is the " +
    "whole point of the rule, not an exception to it.",

  "scripts/verify/assert-one-knob.mjs":
    "IT IS THIS GATE. Its negative-control fixtures must contain a literal " +
    "`http://localhost:3000`, a private `process.env.FS_PORT` line, an ABSOLUTE " +
    "path into a checkout and a dev-server address inside a RegExp literal, " +
    "because a negative control that does not contain the known-bad input cannot " +
    "prove the gate catches it. Caught by its own channels A, B and F on the first " +
    "real run, which is a small proof the channels work. The fixtures are written " +
    "to a temp dir and never into scripts/verify. They run BARE — there is no " +
    "flag to type, so the exemption covers a control set that actually executes.",

  // ── THREE ENTRIES DELETED HERE ON 2026-08-07, and the deletion is the point ──
  //
  // `assert-fusion-ui.mjs`, `assert-fusion-authoring.mjs` and
  // `assert-export-app.mjs` each carried an `OWNERSHIP, NOT JUDGEMENT` reason
  // naming the lane holding the file and the words `REMOVE THIS ENTRY once <lane>
  // lands`. Lanes A and G landed and converted all three, so channel E went RED —
  // "allowed but no longer violates anything" — which is the mechanism working
  // exactly as designed on its first real test rather than a fault. Explainer 28
  // §4: "They are meant to expire, and channel E is what notices when they have."
  //
  // Verified before deleting, not assumed: all three now import
  // `./lib/dev-server.mjs` and none names a server. An exemption removed while the
  // file still violated would have turned channel E's honest red into a real one.
}

// ───────────────────────────────────────────────────────────────────────────
// THE BASELINES — read from `one-knob-baseline.json`, NOT from a const here.
//
// The numbers may FALL and never RISE. `--record` writes the current measurement
// and refuses to raise any of them, so a lane that owns none of the gates can
// still hold the ground it paid for. Read the header for why that matters.
//
// A MISSING FILE IS A FAILURE, NOT A DEFAULT. Falling back to a built-in number
// would make deleting the file a way to choose the ceiling, and "a gate that is
// loosened and never re-tested is a gate that has been deleted."
// ───────────────────────────────────────────────────────────────────────────
const BASELINE_KEYS = {
  nonGateHardcodeSites: "D · the non-gate hardcode debt",
  absPathSites: "F · absolute checkout paths",
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
/** THE RATCHET, as one function so --record and --mutate ask the SAME question.
 *  A measurement may be recorded only if no count rises. Returns the rises so a
 *  refusal can name them instead of just saying no. */
function canRecord(measured, base) {
  if (!base || base.bad) return { ok: false, rises: [], why: "there is no readable baseline to compare against" }
  const rises = Object.keys(BASELINE_KEYS).filter((k) => measured[k] > base[k])
  return { ok: rises.length === 0, rises, why: rises.map((k) => `${k}: ${base[k]} -> ${measured[k]}`).join(" · ") }
}

// ───────────────────────────────────────────────────────────────────────────
// THE ANALYSER — pure, takes a file list, so --mutate can run it over temp
// files without ever writing a scratch script into scripts/verify (a stray
// `assert-*` there would be picked up by the batteries).
// ───────────────────────────────────────────────────────────────────────────

/** a LITERAL port: `localhost:3000`. Not `localhost:${PORT}` — that is derived. */
const HARDCODED = /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):\d/
/** names a dev server at all, literally or by interpolation. */
const NAMES_SERVER = /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])/
/** a knob-shaped env var. */
const KNOB = /^[A-Z0-9_]*(URL|PORT|HOST|ORIGIN)$/
/** an ABSOLUTE path that names a checkout: a user home, or any absolute path
 *  carrying this repo's own directory name. Two clauses because either alone is
 *  short by construction — a blacklist of one shape, which is the mistake
 *  explainer 28 §3.3 records the legacy-name list making twice. Relative paths
 *  and `join(dirname(fileURLToPath(import.meta.url)), …)` are the good shape and
 *  are not matched: the tool is denied the ability to choose its own tree. */
const REPO = basename(ROOT).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/* ⚠ THE ANCHOR ADMITS ONE LEADING `${}`, AND MUTANT F4 IS WHY IT HAS TO.
 * The first version anchored on `^/` alone. A template expression is
 * reconstructed with `${}` standing in for each substitution, so
 * `` `${process.env.HOME}/Projects/<repo>/docs` `` reconstructs as
 * `${}/Projects/<repo>/docs` — which is the identical defect wearing a variable,
 * and the anchored rule read 0 hits on it. Caught by its own negative control
 * before it shipped, which is the only reason it is not still there. The
 * placeholder is optional and appears at most once at the front, so a genuinely
 * derived path — `` `${ROOT}/docs/verification/${label}` `` — still does not
 * match, and neither does `` `${OUT}/<repo>.png` `` (a FILE named for the repo is
 * not a checkout: the segment must be followed by `/` or end). */
const ABS_CHECKOUT = new RegExp(
  `^(?:\\$\\{\\})?/(?:Users|home)/[^/]+/|^(?:\\$\\{\\})?/(?:[^/]+/)*${REPO}(?:/|$)`,
)

/** THE REGEXP LITERAL, UNESCAPED. `/\\(http:\\/\\/localhost:3000/` carries a
 *  dev-server address that no string-literal walk can see. Delimiters and flags
 *  are stripped and backslash-escapes removed, so `\\/` reads as `/`. A pattern
 *  built around a derived port — `localhost:\\d+` — unescapes to `localhost:d+`
 *  and correctly does NOT match HARDCODED, exactly as `localhost:${PORT}` does
 *  not: the port is the knob (explainer 27 §6). It still sets namesServer, so
 *  channel B holds it to importing the resolver, same as every other shape. */
function unRegex(raw) {
  const end = raw.lastIndexOf("/")
  const body = end > 0 ? raw.slice(1, end) : raw
  return body.replace(/\\(.)/g, "$1")
}

function analyse(file, text) {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const out = { hardcoded: [], namesServer: false, importsResolver: false, foreignKnobs: [], absPaths: [] }

  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const seePath = (n, s) => { if (ABS_CHECKOUT.test(s)) out.absPaths.push({ line: lineOf(n), text: s.slice(0, 80) }) }

  const visit = (node) => {
    // ── the import of the shared resolver
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (node.moduleSpecifier.text.includes("lib/dev-server.mjs")) out.importsResolver = true
    }
    // ── string + template literals ONLY. Comments are excluded by construction.
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (HARDCODED.test(node.text)) out.hardcoded.push({ line: lineOf(node), text: node.text.slice(0, 80) })
      if (NAMES_SERVER.test(node.text)) out.namesServer = true
      seePath(node, node.text)
    }
    if (ts.isTemplateExpression(node)) {
      // reconstruct with ${} placeholders so `localhost:${PORT}` reads as derived
      let full = node.head.text
      for (const sp of node.templateSpans) full += "${}" + sp.literal.text
      if (HARDCODED.test(full)) out.hardcoded.push({ line: lineOf(node), text: full.slice(0, 80) })
      if (NAMES_SERVER.test(full)) out.namesServer = true
      // `${HOME}/free-stroke/docs` is the same defect with a variable in front of
      // it, so the HEAD alone is not enough — the reconstruction is what is tested.
      seePath(node, full)
    }
    // ── G · a dev server hiding in a RegExp literal ──────────────────────────
    if (ts.isRegularExpressionLiteral(node)) {
      const pat = unRegex(node.text)
      if (HARDCODED.test(pat)) out.hardcoded.push({ line: lineOf(node), text: node.text.slice(0, 80), regex: true })
      if (NAMES_SERVER.test(pat)) out.namesServer = true
    }
    // ── process.env.<KNOB>
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "process" &&
      node.expression.name.text === "env"
    ) {
      const name = node.name.text
      if (KNOB.test(name) && name !== "FS_PORT") out.foreignKnobs.push({ line: lineOf(node), name })
    }
    ts.forEachChild(node, visit)
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

{
  // ─────────────────────────────────────────────────────────────────────────
  // THE NEGATIVE CONTROLS, AND THEY RUN ON THE BARE INVOCATION.
  //
  // DISPATCH §2.6: "Calibrate the instrument against a known-bad input and
  // require it to fail. A green row that cannot fail is the lie." Fifteen
  // mutants, in a temp dir — nothing is written into scripts/verify.
  //
  // ⚠ THEY USED TO SIT BEHIND `--mutate`, AND NO SWEEP HAS EVER PASSED IT.
  // `docs/explainers/21-losing-your-work.md` §7 states the law — "the gate runs
  // three kinds of control on the DEFAULT invocation, never behind a flag" —
  // explainer 31 measured nineteen gates breaking it, and explainer 36 moved
  // thirteen of them onto the default path. This gate was not one of the
  // thirteen and had the same defect: every channel below was certified by a
  // control set that no battery has ever executed.
  //
  // THE FLAG IS DELETED RATHER THAN ADDED TO A RUNNER TABLE, per explainer 29
  // §5: "a runner-passed flag only helps people who go through a runner", and
  // anyone typing this gate's name still gets the half that cannot fail.
  // `run-battery.mjs`'s own EXTRA_ARGS note says the same thing — "prefer
  // deleting the flag in the gate itself; an arm that always runs needs no
  // entry and cannot drift out of one."
  //
  // COST, MEASURED, because that is what decides between the three answers:
  // 0.17 s for the whole set. Every mutant is a `createSourceFile` call over a
  // string of about a hundred bytes, plus one parse of a real in-tree fixture.
  // Nothing here reads an image, opens a browser or touches the network, so
  // there was never a version of this worth scheduling somewhere else.
  //
  // The rows land in the SAME pass/fail counters as the sweep below, so the
  // gate prints one verdict and `--record` refuses while a control is red —
  // which is the correct order: a baseline written under a blind analyser
  // grandfathers whatever the analyser could not see.
  // ─────────────────────────────────────────────────────────────────────────
  const dir = mkdtempSync(join(tmpdir(), "oneknob-"))
  const M = (name, src) => {
    const p = join(dir, name)
    writeFileSync(p, src)
    return analyse(p, src)
  }

  // ⚠ NO FIXTURE, AND NO COMMENT IN THIS FILE, MAY SPELL THE BROWSER-CLASSIFIER
  // TOKENS — the launch call and the two driver package names that
  // `run-battery.mjs` greps for. The batteries classify a gate MODEL vs BROWSER
  // by matching that regex against the file's RAW TEXT, so one fixture string
  // naming a driver moved THIS gate into the browser list, where the model
  // battery refuses to run it and the browser battery runs it against a dev
  // server it does not need. Caught by `run-battery.mjs --list` before shipping.
  //
  // It took TWO passes to fix, and the second one is the interesting one: the
  // first fix removed the token from the fixture and left it in a comment
  // explaining the rule — and the gate stayed misclassified, because the
  // classifier is a grep and a grep cannot tell code from prose. That is
  // precisely the defect this gate refuses to have (see the header), sitting in
  // the machine that decides which battery runs it. Explainer 27 §3 is "a gate
  // lands in the wrong list and nothing in either output says so"; this is the
  // same thing reached from a new direction — a COMMENT is source text too.
  // Reported to the controller; `run-battery.mjs` is Lane G's file.
  const a = M(
    "assert-mutant-hardcoded.mjs",
    `await page.goto("http://localhost:3000", { waitUntil: "networkidle" })\n`,
  )
  row(a.hardcoded.length === 1, "MUTANT hardcoded literal is CAUGHT", `${a.hardcoded.length} hit(s) — ${a.hardcoded[0]?.text}`)

  const b = M(
    "assert-mutant-comment.mjs",
    `// this gate used to say "http://localhost:3000" and that was the bug\n/* also http://localhost:3000 in a block comment */\nimport { LAB_URL } from "./lib/dev-server.mjs"\nawait page.goto(LAB_URL)\n`,
  )
  row(
    b.hardcoded.length === 0 && b.importsResolver,
    "MUTANT with the URL only in COMMENTS is NOT flagged",
    `${b.hardcoded.length} hit(s) — a grep would have fired here, and a naive //-stripper would have eaten the real evidence in mutant 1`,
  )

  const c = M(
    "assert-mutant-private-port.mjs",
    `const PORT = process.env.FS_PORT || 3000\nawait page.goto(\`http://localhost:\${PORT}/desk-doodles\`)\n`,
  )
  row(
    c.hardcoded.length === 0 && c.namesServer && !c.importsResolver,
    "MUTANT with a PRIVATE port line is CAUGHT by channel B",
    `hardcoded=${c.hardcoded.length} (correctly 0 — it is derived) · namesServer=${c.namesServer} · importsResolver=${c.importsResolver}`,
  )

  const d = M("assert-mutant-foreign-knob.mjs", `const U = process.env.FS_URL ?? process.env.HERO_URL\n`)
  row(
    d.foreignKnobs.length === 2,
    "MUTANT reading a FOREIGN knob name is CAUGHT by channel C",
    d.foreignKnobs.map((k) => k.name).join(", "),
  )

  const e = M(
    "assert-mutant-clean.mjs",
    `import { LAB_URL } from "./lib/dev-server.mjs"\nconst p = process.env.FS_PORT\nawait page.goto(LAB_URL)\n`,
  )
  row(
    e.hardcoded.length === 0 && e.foreignKnobs.length === 0 && e.importsResolver,
    "A CLEAN gate is NOT flagged (the instrument is not simply always-red)",
    `hardcoded=${e.hardcoded.length} foreign=${e.foreignKnobs.length} importsResolver=${e.importsResolver}`,
  )

  // ── CHANNEL F · THE PATH ──────────────────────────────────────────────────
  // Four mutants, because F has to catch two shapes and refuse two others. The
  // fixtures use a synthetic user name on purpose: a real one would put this
  // file into every grep-based survey of the same debt, which is J's §4.1
  // finding ("a comment is source text too") reached from the fixture side.
  const f1 = M(
    "assert-mutant-abs-out.mjs",
    `const OUT = "/Users/nobody/Projects/${basename(ROOT)}/docs/verification/stack-v1"\n`,
  )
  row(f1.absPaths.length === 1, "MUTANT F · an ABSOLUTE output path into a checkout is CAUGHT", `${f1.absPaths.length} hit(s) — ${f1.absPaths[0]?.text}`)

  const f2 = M(
    "assert-mutant-abs-src.mjs",
    "const SRC = readFileSync(`/srv/ci/" + basename(ROOT) + "/lib/style-system.ts`, \"utf8\")\n",
  )
  row(
    f2.absPaths.length === 1,
    "MUTANT F · an absolute INPUT path is caught too, on the repo-name clause alone",
    `${f2.absPaths.length} hit(s) — ${f2.absPaths[0]?.text} (no user home in it; the home-only rule would have missed this)`,
  )

  const f3 = M(
    "assert-mutant-abs-comment.mjs",
    `// this tool used to read "/Users/nobody/Projects/${basename(ROOT)}/docs" and that was the bug\n` +
      `/* see also /Users/nobody/Projects/${basename(ROOT)}/lib */\n` +
      `import { join, dirname } from "node:path"\nimport { fileURLToPath } from "node:url"\n` +
      `const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "docs", "verification", "x")\n`,
  )
  row(
    f3.absPaths.length === 0,
    "MUTANT F · a path only in COMMENTS, beside a DERIVED path, is NOT flagged",
    `${f3.absPaths.length} hit(s) — a grep fires on both comment lines, and assert-gate-integrity.mjs:1502 is a real file in this tree that would go red under one`,
  )

  const f4 = M(
    "assert-mutant-abs-interp.mjs",
    "const OUT = `${process.env.HOME}/Projects/" + basename(ROOT) + "/docs/verification/x`\n",
  )
  row(
    f4.absPaths.length === 1,
    "MUTANT F · an absolute checkout path behind an INTERPOLATION is CAUGHT",
    `${f4.absPaths.length} hit(s) — the reconstruction is tested, not just the head`,
  )

  // ── CHANNEL G · THE REGEXP ────────────────────────────────────────────────
  const g1 = M(
    "assert-mutant-regex-url.mjs",
    String.raw`const clean = (l) => l.replace(/\(http:\/\/localhost:3000/, "(")` + "\n",
  )
  row(
    g1.hardcoded.length === 1 && g1.hardcoded[0].regex === true,
    "MUTANT G · a dev-server URL inside a REGEXP LITERAL is CAUGHT",
    `${g1.hardcoded.length} hit(s) — ${g1.hardcoded[0]?.text}; this exact shape was live at _probe-root-wedge.mjs:146 and was never one of the 92`,
  )

  const g2 = M(
    "assert-mutant-regex-derived.mjs",
    String.raw`import { LAB_URL } from "./lib/dev-server.mjs"` + "\n" +
      String.raw`const anyPort = /http:\/\/localhost:\d+/` + "\n" +
      `console.log(anyPort, LAB_URL)\n`,
  )
  row(
    g2.hardcoded.length === 0 && g2.namesServer && g2.importsResolver,
    "MUTANT G · a regex over a DERIVED port is not a hardcode (but still names a server)",
    `hardcoded=${g2.hardcoded.length} (correctly 0 — \\d is not a digit) · namesServer=${g2.namesServer} · importsResolver=${g2.importsResolver}`,
  )

  // THE REAL IN-TREE CONTROL, not a fixture. Lane K's classifier fixture carries
  // a `//` inside a string AND `/^https?:\/\/[a-z]+/` inside a regex — the two
  // shapes F and G hunt, in a file where neither is a violation. If either
  // channel is simply always-red, this is where it shows.
  const realCtl = join(VERIFY, "lib", "gate-fixtures", "classify", "url-and-regex-slashes.mjs")
  if (existsSync(realCtl)) {
    const r = analyse(realCtl, readFileSync(realCtl, "utf8"))
    row(
      r.hardcoded.length === 0 && r.absPaths.length === 0,
      "REAL IN-TREE CONTROL · url-and-regex-slashes.mjs is NOT flagged by F or G",
      `hardcoded=${r.hardcoded.length} absPaths=${r.absPaths.length} namesServer=${r.namesServer} — its regex is a protocol matcher, not a dev server, and its string names no port`,
    )
  } else {
    row(false, "REAL IN-TREE CONTROL · url-and-regex-slashes.mjs is missing", realCtl)
  }

  // ── THE BASELINE FILE'S OWN RATCHET, exercised rather than assumed ────────
  // Explainer 33 §3: "an exemption mechanism nobody has exercised is an exemption
  // mechanism nobody knows the shape of." Same for a paydown mechanism.
  const bl = readBaseline()
  row(bl !== null && !bl.bad, "BASELINE FILE loads and carries every key as an integer", bl?.bad ?? `${Object.keys(BASELINE_KEYS).map((k) => `${k}=${bl?.[k]}`).join(" · ")}`)
  row(
    !canRecord({ nonGateHardcodeSites: (bl?.nonGateHardcodeSites ?? 0) + 1, absPathSites: bl?.absPathSites ?? 0 }, bl).ok,
    "RATCHET · --record REFUSES a measurement that would RAISE a baseline",
    "a paydown mechanism that can also raise the ceiling is not a ratchet",
  )
  row(
    canRecord({ nonGateHardcodeSites: Math.max(0, (bl?.nonGateHardcodeSites ?? 0) - 1), absPathSites: bl?.absPathSites ?? 0 }, bl).ok,
    "RATCHET · --record ACCEPTS a measurement that lowers one",
    "which is the whole point: a lane owning no gates can hold the ground it paid for",
  )

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
  return { rel, base: f.split("/").pop(), ...analyse(f, readFileSync(f, "utf8")) }
})

const isGate = (r) => r.base.startsWith("assert-")
const allowed = (r) => Object.prototype.hasOwnProperty.call(ALLOW, r.rel)

const gates = results.filter(isGate)
const nonGates = results.filter((r) => !isGate(r))

// The two ratcheted measurements, computed once so --list, --record and the rows
// below can never disagree about what was measured.
const debtFiles = nonGates.filter((r) => r.hardcoded.length && !allowed(r))
const absFiles = results.filter((r) => r.absPaths.length && !allowed(r))
const MEASURED = {
  nonGateHardcodeSites: debtFiles.reduce((n, r) => n + r.hardcoded.length, 0),
  absPathSites: absFiles.reduce((n, r) => n + r.absPaths.length, 0),
}
const baseline = readBaseline()

if (LIST) {
  console.log("── GATES (assert-*) that hardcode or privately name a server ──")
  for (const r of gates)
    if (r.hardcoded.length || (r.namesServer && !r.importsResolver))
      console.log(`  ${allowed(r) ? "[allowed] " : "          "}${r.rel}  hardcoded=${r.hardcoded.length} namesServer=${r.namesServer} importsResolver=${r.importsResolver}`)
  console.log("\n── NON-GATE debt (the ratchet's subject) ──")
  for (const r of nonGates) if (r.hardcoded.length && !allowed(r)) console.log(`  ${r.rel}:${r.hardcoded[0].line}${r.hardcoded[0].regex ? "  (in a RegExp literal)" : ""}`)
  console.log("\n── ABSOLUTE CHECKOUT PATHS (channel F) ──")
  for (const r of absFiles) for (const h of r.absPaths) console.log(`  ${r.rel}:${h.line}  ${h.text}`)
  if (!absFiles.length) console.log("  none")
  process.exit(0)
}

// `--record` is handled AFTER the sweep, not here. See the block at the bottom:
// recording while the gate is red about something else is a laundering channel,
// and it took a planted known-bad to notice.

// ── A · hardcoded URL in a gate ────────────────────────────────────────────
const aBad = gates.filter((r) => r.hardcoded.length && !allowed(r))
row(
  aBad.length === 0,
  "A · no assert-* gate hardcodes a dev-server URL",
  aBad.length === 0
    ? `${gates.length} gates scanned, ${Object.keys(ALLOW).length} allowed by written reason`
    : aBad.map((r) => `${r.rel}:${r.hardcoded[0].line}`).join(" · "),
)

// ── B · a gate that names a server must import the resolver ────────────────
const bBad = gates.filter((r) => r.namesServer && !r.importsResolver && !allowed(r))
row(
  bBad.length === 0,
  "B · every gate that names a dev server imports lib/dev-server.mjs",
  bBad.length === 0
    ? `${gates.filter((r) => r.importsResolver).length} of ${gates.length} gates import the resolver; none of the rest names a server`
    : bBad.map((r) => r.rel).join(" · "),
)

// ── C · foreign knob names ─────────────────────────────────────────────────
const cBad = results.filter((r) => r.foreignKnobs.length && !allowed(r))
row(
  cBad.length === 0,
  "C · no script reads a port/URL env var by any name other than FS_PORT",
  cBad.length === 0
    ? "one knob, one name"
    : cBad.map((r) => `${r.rel}:${r.foreignKnobs[0].line} (${r.foreignKnobs.map((k) => k.name).join(",")})`).join(" · "),
)

// ── D · the ratchet ────────────────────────────────────────────────────────
// COUNTED IN SITES, NOT FILES. The first version counted files, and its own
// negative control killed it: appending a brand-new hardcoded URL to a script
// that ALREADY had one left the count unchanged, so the ratchet sat green while
// the debt grew. A per-file count cannot see a second violation in a file that
// is already dirty — which is where a new one is most likely to be added.
// A MISSING OR BROKEN BASELINE FILE IS ITS OWN FAILURE, never a default.
const baseOk = baseline !== null && !baseline.bad
if (!baseOk) {
  row(
    false,
    "the baseline file is readable",
    `${relative(ROOT, BASELINE_FILE)} — ${baseline === null ? "missing" : baseline.bad}. Channels D and F cannot be judged without it; recreate it with \`node scripts/verify/assert-one-knob.mjs --record\` from a tree you trust.`,
  )
}
const debt = MEASURED.nonGateHardcodeSites
const dOk = baseOk && debt <= baseline.nonGateHardcodeSites
row(
  dOk,
  "D · the non-gate hardcode debt has not GROWN",
  !baseOk
    ? "no baseline"
    : `${debt} sites across ${debtFiles.length} files vs baseline ${baseline.nonGateHardcodeSites}` +
      (debt < baseline.nonGateHardcodeSites
        ? ` — it FELL by ${baseline.nonGateHardcodeSites - debt}; run --record to hold the ground (no gate ownership needed)`
        : debt === baseline.nonGateHardcodeSites
          ? " — held"
          : ` — a NEW hardcoded capture tool was added`),
)

// ── E · the allow list is honest ───────────────────────────────────────────
const eProblems = []
for (const [rel, reason] of Object.entries(ALLOW)) {
  if (!reason || reason.trim().length < 20) eProblems.push(`${rel}: reason missing or too thin to be a reason`)
  const r = results.find((x) => x.rel === rel)
  if (!r) {
    eProblems.push(`${rel}: allowed but NOT FOUND on disk — stale entry`)
    continue
  }
  // F and G join the definition of "violates" or channel E goes stale in the
  // other direction: an entry kept alive only by a path would read as removable.
  const violates =
    r.hardcoded.length > 0 || (r.namesServer && !r.importsResolver) || r.foreignKnobs.length > 0 || r.absPaths.length > 0
  if (!violates) eProblems.push(`${rel}: allowed but no longer violates anything — DELETE THIS ENTRY`)
}
row(
  eProblems.length === 0,
  "E · every ALLOW entry carries a written reason and still needs the exemption",
  eProblems.length === 0 ? `${Object.keys(ALLOW).length} entries, all live` : eProblems.join(" · "),
)

// ── F · absolute checkout paths ────────────────────────────────────────────
// THE DEFECT IS A PATH, NOT A URL. Ratcheted rather than absolute for the same
// reason channel D is: the ground actually held, recordable by whoever pays it.
const abs = MEASURED.absPathSites
const fOk = baseOk && abs <= baseline.absPathSites
row(
  fOk,
  "F · no script names a CHECKOUT by absolute path",
  !baseOk
    ? "no baseline"
    : abs === 0
      ? `0 sites across ${results.length} files vs baseline ${baseline.absPathSites} — every output, input and baseline dir is derived from the caller's own tree`
      : `${abs} sites across ${absFiles.length} files vs baseline ${baseline.absPathSites}` +
        (abs < baseline.absPathSites ? " — it FELL; run --record" : abs === baseline.absPathSites ? " — held" : " — a NEW absolute path was added") +
        `  ·  ${absFiles.map((r) => `${r.rel}:${r.absPaths[0].line}`).join(" · ")}`,
)

// ── G · a dev server hiding in a RegExp literal ────────────────────────────
// Its hits also feed A and D, which is the point: this class was never in the 92
// and could not have been. The row exists so the class is VISIBLE in the output —
// a channel that only ever contributes silently to another count is a channel
// nobody knows is running.
const regexHits = results.filter((r) => r.hardcoded.some((h) => h.regex) && !allowed(r))
row(
  regexHits.length === 0,
  "G · no dev-server URL hides in a RegExp literal",
  regexHits.length === 0
    ? `${results.length} files parsed for regex literals; the shape that was live at _probe-root-wedge.mjs:146 is now covered by the parser, not by a grep`
    : regexHits.map((r) => `${r.rel}:${r.hardcoded.find((h) => h.regex).line}`).join(" · "),
)

console.log("")
console.log(`scanned ${results.length} .mjs under scripts/verify — ${gates.length} gates, ${nonGates.length} tools`)
console.log(`assert-one-knob: ${pass} PASS · ${fail} FAIL`)

if (RECORD) {
  /* ── THE PAYDOWN PATH, AND IT NEEDS NO OWNERSHIP OF THIS FILE ──────────────
   *
   * ⚠ THE FIRST VERSION OF THIS RAN BEFORE THE SWEEP AND WAS A LAUNDERING
   * CHANNEL. A planted known-bad proved it end to end: with two fresh absolute
   * paths planted in a mirror, the sweep went RED on A, B and G — and `--record`
   * still wrote `absPathSites: 2`, because 2 was below the 7 it was compared
   * against. A ratchet with headroom makes a NEW violation free, and recording
   * during a red run bakes that violation into the ground as though it had been
   * grandfathered. This is explainer 28 §4's finding ("the ratchet sat green
   * while the debt grew") reappearing in the machinery built from it.
   *
   * Two consequences, both kept: `--record` runs LAST, and it refuses while any
   * NON-ratchet channel is red. And the headroom argument is why J's inability
   * to record mattered more than a tidy number — 85 sites of headroom is 85 free
   * violations for anyone who wanted them. Record promptly; that is the mitigation. */
  const ratchetFails = (dOk ? 0 : 1) + (fOk ? 0 : 1)
  const hardFail = fail - ratchetFails
  const verdict = canRecord(MEASURED, baseline)
  console.log("")
  if (hardFail > 0) {
    console.log(`REFUSED — ${hardFail} channel(s) other than the ratchets are RED. Nothing was written.`)
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
