// THE BATTERY — run every gate that can be run, and name every one that cannot.
//
// WHY THIS EXISTS
//
//   `assert-gate-integrity.mjs` proves each `assert-*` CAN fail. Nothing proved
//   any of them was ever RUN. Measured 2026-08-03: the repo has **81** scripts
//   named `assert-*`, and the only executable sweep in the tree —
//   `scripts/verify/_lane-gates.sh` — invokes **eight** of them. `package.json`
//   has no verify script. `docs/DISPATCH.md` §3 names exactly one gate.
//
//   So 73 of 81 gates were in no sweep at all. A gate nobody runs cannot fail in
//   practice, whatever the meta-gate says about it in principle — and that is the
//   same defect as a green row that cannot fail, arrived at from the other side.
//   Three of the instruments found broken this week were found by accident,
//   which is what "in no sweep" looks like from the inside.
//
// WHAT IT RUNS, AND WHAT IT REFUSES TO PRETEND
//
//   MODEL gates — no browser, no dev server, seconds each — are run. That is
//   most of the numeric judgement in the repo and it is cheap enough to run on
//   every change.
//
//   BROWSER gates are NOT run here and are NOT counted as passing. They need
//   `pnpm dev` and real Chrome with `--use-angle=metal` (without the flag Chrome
//   falls back to SwiftShader, which silently pauses the rAF loop, and a frozen
//   animation and a still one are identical in a screenshot). Running them from
//   inside a battery would also serialise a dozen browser launches behind one
//   shared dev server that a sibling lane's save can remount mid-capture. They
//   are LISTED, every one, so the output says what it did not do.
//
//   **A SKIP IS NOT A PASS.** `verify-gates.mjs` once printed ALL GATES PASS with
//   all four geometry gates skipped. This file exits non-zero if any model gate
//   fails, and prints the un-run list above its summary rather than below it.
//
// Usage:
//   node scripts/verify/run-battery.mjs               # every model gate
//   node scripts/verify/run-battery.mjs --list        # what it would run
//   node scripts/verify/run-battery.mjs --only=hero   # substring filter
//   node scripts/verify/run-battery.mjs --jobs=4      # parallelism (default 4)
//   node scripts/verify/run-battery.mjs --classify-selftest   # prove the classifier
import ts from "typescript"
import { readdirSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync, statSync, realpathSync } from "node:fs"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { tmpdir } from "node:os"
/* The row alphabet is DEFINED in one place — see `ROW_RE` below for why this
 * file no longer restates it. */
import { rowRe, redRe } from "./lib/verdict-rows.mjs"
/* THE CRASH GUARD, and the exit code that is not a failure. Both come from the
 * same file for the same reason the row alphabet does: `PARTIAL_EXIT = 3` was
 * written out here AND in `run-browser-battery.mjs`, and the guard needed the
 * same number a third time. Importing this module does NOT install the guard ,
 * see `loadedAsPreload()` there. The guard reaches a gate through `--import`,
 * below. */
import { PARTIAL_EXIT } from "./lib/crash-row.mjs"
import { pathToFileURL } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const VERIFY = join(ROOT, "scripts", "verify")
const has = (k) => process.argv.includes(`--${k}`)
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const ONLY = arg("only", "")
const JOBS = Math.max(1, Number(arg("jobs", "4")))
const TIMEOUT = Number(arg("timeout", "180")) * 1000

/* `assert-gate-integrity` is excluded: it SPAWNS the others, so running it from
 * inside a battery of the others is a fork bomb with good intentions. It is run
 * on its own, and `_lane-gates.sh` already does that. */
const EXCLUDE = new Set(["assert-gate-integrity.mjs"])

/* ── THE INVENTORY IS THE REPO, NOT ONE DIRECTORY ──────────────────────────
 *
 * This used to be `readdirSync(VERIFY)`, and so did the browser runner. That
 * scoped the whole "is every gate swept?" question to `scripts/verify/` — so a
 * gate written anywhere else was invisible to both sweeps no matter how good it
 * was, which is the SAME defect this file exists to close, re-entering through
 * the door the fix left open.
 *
 * Measured 2026-08-07: `docs/storyboard/tools/assert-moment.mjs` was in NO
 * SWEEP. It is not a stub — it emits PASS/FAIL (`:192`), it is exit-coupled
 * (`:245 process.exit(sound ? 0 : 1)`), and it carries four synthetic negative
 * controls including the mis-registered layer swap that gate 4 exists for. Run
 * by hand it exits 0 and prints a seven-subject truth table. A gate that good,
 * unrun for a week, is exactly the "73 of 81" finding wearing a directory.
 *
 * ONE IMPLEMENTATION, IMPORTED — never a second copy in the browser runner. A
 * parallel implementation of one idea is this repo's most expensive recurring
 * defect, and an inventory that drifts between the two runners would silently
 * un-partition the set: a gate could land in neither list and nothing would say
 * so. `run-browser-battery.mjs` imports `discover()` and `isBrowser()` from
 * here, which is why the execution below is guarded by `IS_MAIN`. */
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "verification", "gate-fixtures"])
export function discover(root = ROOT) {
  const found = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue
        walk(join(dir, e.name))
      } else if (e.name.startsWith("assert-") && e.name.endsWith(".mjs") && !EXCLUDE.has(e.name)) {
        found.push(join(dir, e.name))
      }
    }
  }
  walk(root)
  /* Sort by BASENAME so the printed order is unchanged from when this only ever
   * saw one directory — a reordered scoreboard reads as a changed result. */
  return found.sort((a, b) => a.split("/").pop().localeCompare(b.split("/").pop()))
}
/** repo-relative, for printing — a bare basename would hide which tree it came from. */
export const rel = (p) => p.replace(ROOT + "/", "")

/* ══════════════════════════════════════════════════════════════════════════
 * WHAT COUNTS AS A ROW — and the two ways this got it wrong, in both directions
 *
 * The row parser was `/^\s*(?:\*\*\* )?(?:PASS|FAIL)\b/gm`, and Lane I measured
 * two holes in it. They point opposite ways and both make the headline mean
 * something other than what a reader thinks.
 *
 *   ① ROWS THAT ARE NOT COUNTED. A verdict behind a CHANNEL PREFIX is invisible:
 *      `assert-layer-flicker.mjs:1148/1184/1371` print `[fus-reduced] FAIL …`,
 *      `[fus-cal] FAIL …`, `[reduced] FAIL …`. Measured across the canonical
 *      48-gate browser battery's own logs, exactly one such line survives into a
 *      green run — `[calib] PASS` — because the rest sit behind flags no sweep
 *      passes (channel J). They are real rows and the scoreboard cannot see them.
 *      Same family as explainer 29 §5, where the live arm printed `live`/`DEAD`
 *      and four real verdicts were invisible — except this format ALMOST parses.
 *
 *   ② `\bFAIL\b` DOES NOT MATCH `FAILED`. Lane I's pair, from real gates:
 *      "…FAILED TO BITE" -> blind, "…FAILED TO FAIL." -> seen, and the second one
 *      only because its sentence ends in a full stop.
 *
 * ── AND WIDENING IS NOT FREE, WHICH IS THIS LANE'S OWN LESSON ───────────────
 *
 * Measured over all 94 gates' emission sites: the verdict words also appear in
 * SUMMARY lines — `assert-one-knob: 5 PASS · 0 FAIL`, and eight more of that
 * shape — and in PROSE, including this file's siblings ("REPORTED, NOT FAILED",
 * "NOT A PASS AND NOT A FAILURE", "A SKIP IS NOT A PASS"). A blind widening to
 * `\bFAIL\b` counts every summary line as rows and every sentence about failure
 * as a failure. **That is a grep failing to tell code from prose, at the
 * scoreboard layer** — the same defect as the classifier's, one floor up.
 *
 * So the widening is narrow and measured, and the part that cannot be parsed is
 * REPORTED rather than guessed at:
 *
 *   · the row regex gains an optional `[channel]` prefix and `FAILED` as a
 *     verdict word — both anchored at line start, so a summary or a sentence
 *     still cannot become a row;
 *   · a separate detector names the lines that ANNOUNCE a failure in English —
 *     the measured idioms, not a general parse — and a run that prints one AND
 *     EXITS 0 fails the sweep. A control that reports itself blind while the gate
 *     goes green is the exact lie this repo is organised around.
 * ══════════════════════════════════════════════════════════════════════════ */
/* ── ONE STATEMENT OF THE RULE, NOT TWO (Lane L's ask, made 2026-08-07) ─────
 * These two lines used to restate `lib/verdict-rows.mjs`'s row alphabet
 * character for character. Two copies of one rule is this repo's most expensive
 * recurring defect, and `assertReadersAgree()` existed only to assert that this
 * copy had not drifted from that one — an equality re-proved on every sweep and
 * red on the first divergence. Lane L unified the predicate into
 * `lib/verdict-rows.mjs` and could not wire the scoreboard to it because this
 * file was another lane's. It is wired now: the rule is DEFINED there and
 * CONSUMED here, so the equality is true by construction rather than by
 * assertion. `assertReadersAgree()` stays — it is now a check that the
 * *meta-gate's* view and this one agree over real output, and it is the thing
 * that would catch a future re-inlining. Measured across the canonical 48
 * browser-battery logs before and after this change: **1033 rows, 0 red, 0
 * drift**, byte-identical.
 *
 * `rowRe()` / `redRe()` return a FRESH `gm` regex per call, which matters: a
 * module-level `/g` regex carries `lastIndex`. Every consumer below either uses
 * `String.match` (which resets it) or `new RegExp(ROW_RE.source)`, and both are
 * unaffected — but the freshness is why these are functions there and constants
 * here, and why calling them once at module load is safe. */
export const ROW_RE = rowRe()
export const FAIL_ROW_RE = redRe()

/* MEASURED IDIOMS, not a general parse. Every one of these is a real string from
 * a real gate, and each announces that an instrument could not fail:
 *   assert-hero-carve:336 · assert-hero-transition:1280 · assert-flat-silhouette:499
 *
 *   ⚠ CORRECTED 2026-08-07 (lane AA). This line read
 *   `assert-hero-k7-intact:379  "…FAILED TO FAIL…"` and that gate does not
 *   contain the string AT ANY LINE — `:379` is a blank ` *` in a comment block.
 *   The claim above this list is "every one of these is a real string from a real
 *   gate", so a citation naming a gate that never emits it is the one thing the
 *   list may not contain. The idiom itself is real and matched below; it is
 *   emitted by FOUR gates, and the replacement was chosen by opening the line:
 *   `assert-hero-dials.mjs:925` reads
 *   "FAIL  CONTROL · FAILED TO FAIL. ${frozenAlive.length} row(s) still reported…".
 *   (The others are assert-hero-transition:1408, assert-flat-silhouette:501 and
 *   assert-hero-option-panel:431.) Comment only — no rule changed.
 *   NOTE: this citation lives under `scripts/`, which `assert-citations.mjs`
 *   does NOT scan; it was found by hand, and that gap is stated in explainer 46.
 *   assert-hero-dials:925              "…FAILED TO FAIL…"
 *   assert-hero-k7-news:445            "CONTROL FAILED — … could not tell the difference."
 *   assert-joint-beading:388           "[joints] control FAILED TO CAPTURE — …"
 *   assert-hero-dead-channels:394      "UNSOUND — … row(s) PASSED. They cannot fail…"
 *   assert-export-plan:40 / -live:59 / -encoders:49
 *                                      "the control … PASSED — this row cannot fail…"
 * A line matching one of these is NOT turned into a row: nobody can say from the
 * outside whether it is one verdict or six. It is NAMED, and it is a hard failure
 * when the run that printed it exited 0. */
const ANNOUNCED_FAILURE_RE =
  /FAILED TO (?:FAIL|BITE|CAPTURE|REACT|NOTICE)|CONTROL FAILED|\bUNSOUND\b|\bNOT SOUND\b|this (?:row|check) cannot fail/i

/** Rows, failures, and the failures the row parser could not count. */
export function readRows(out) {
  const rows = (out.match(ROW_RE) || []).length
  const fails = (out.match(FAIL_ROW_RE) || []).length
  const announced = out
    .split("\n")
    .filter((l) => ANNOUNCED_FAILURE_RE.test(l) && !new RegExp(ROW_RE.source).test(l))
    .map((l) => l.trim().slice(0, 150))
  return { rows, fails, announced }
}

/* ── A GREEN IS AN EXIT 0 THAT PRINTED ROWS AND NONE OF THEM RED ──────────
 * 🔴 F113 (Codex, 2026-09-18), reproduced 2026-09-22 with mocked children. The
 * verdict read only the exit code. A child that printed `FAIL  broken` and then
 * exited 0 was counted `fails=1` and still green, and `announcedGreen` did not
 * catch it because it deliberately skips lines the row parser already counted.
 * A child that exited 0 before any assertion was warned about as zero-row and
 * then counted green anyway. Both runners now take the verdict from here, so
 * the rule is stated once:
 *   · a parsed FAIL row fails the gate whatever its exit code;
 *   · exit 0 with no row at all is not a pass;
 *   · green is exit 0, at least one row, and no FAIL row.
 * PARTIAL (exit 3) and a non-zero exit keep their existing meaning. */
export const failedAtZero = (r) => r.code === 0 && r.fails > 0
export const zeroRowAtZero = (r) => r.code === 0 && r.rows === 0
export const cleanGreen = (r) => r.code === 0 && r.rows > 0 && r.fails === 0
export const tagOf = (r, partial) =>
  r.timedOut ? "TIMEOUT" : failedAtZero(r) ? "RED@0" : zeroRowAtZero(r) ? "EMPTY@0" : r.code === 0 ? "pass" : partial ? "PARTIAL" : `FAIL(${r.code})`
/** The sweep's exit: 1 if anything failed, 3 if nothing failed and something was never reached, else 0. */
export const sweepExit = (results) => {
  const failed = results.some(
    (r) => (r.code !== 0 && !r.partial) || failedAtZero(r) || zeroRowAtZero(r) || (r.code === 0 && r.announced?.length),
  )
  return failed ? 1 : results.some((r) => r.partial) ? 3 : 0
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE CLASSIFIER — PARSED, NOT GREPPED
 *
 * WHAT IT REPLACED, and why it had to go:
 *
 *   export const isBrowser = (path) =>
 *     /chromium\.launch|playwright|puppeteer|\/\/ battery: browser/
 *       .test(readFileSync(path, "utf8"))
 *
 * That matched the file's RAW TEXT, so a token inside a string, inside a
 * negative-control fixture, or inside **a comment explaining the rule** decided
 * which battery ran the file. Lane F hit it twice on `assert-one-knob.mjs` — a
 * gate whose entire subject is "a script may not name its own dev server", i.e.
 * a gate written because greps are the wrong instrument — and could not fix it
 * by moving the token. `assert-one-knob.mjs:211` is the scar:
 *
 *   ⚠ NO FIXTURE, AND NO COMMENT IN THIS FILE, MAY SPELL THE BROWSER-CLASSIFIER
 *   TOKENS … the first fix removed the token from the fixture and left it in a
 *   comment explaining the rule — and the gate stayed misclassified, because the
 *   classifier is a grep and a grep cannot tell code from prose.
 *
 * A workaround that forbids a file from documenting itself is not a fix. And it
 * failed in BOTH directions, which the grep could never have said: measured
 * 2026-08-07, `assert-hero-word-legible.mjs` sat in the MODEL battery — "no
 * browser, no dev server, seconds each" — while `:291` spawns
 * `_probe-word-ladder.mjs`, which launches Chrome. `assert-hero-transition.mjs`
 * has the same shape and only avoided it by DECLARING itself, in a comment whose
 * own text says "neither regex could see it".
 *
 * ── WHAT IT ASKS INSTEAD: WHAT DOES THE FILE *DO*? ────────────────────────
 *
 *   1 · IMPORT      an ImportDeclaration / dynamic import / require whose module
 *                   specifier IS a browser driver. A specifier is structure; the
 *                   same nine characters inside a message are not.
 *   2 · LAUNCH      a CallExpression whose callee is `<driver>.launch` /
 *                   `.launchPersistentContext` / `.connect` / `.connectOverCDP`.
 *   3 · SPAWN       a child process, given a repo script that itself classifies
 *                   BROWSER. Followed through ONE level of local indirection —
 *                   `assert-param-guards.mjs:88` wraps its spawn in `run(script)`
 *                   — because otherwise the check is defeated by a helper.
 *   4 · DIRECTIVE   a comment line that is EXACTLY `battery: browser|model`.
 *
 * ── AND A COMMENT IS ALLOWED TO CLASSIFY EXACTLY ONCE ─────────────────────
 *
 * Rule 4 looks like the defect wearing a hat, and the difference is the whole
 * point: an ACCIDENTAL MENTION cannot classify, a DELIBERATE DIRECTIVE can. A
 * directive is a whole trimmed comment line and nothing else, there may be only
 * one kind per file, it is PRINTED on every `--list`, and — this is the part
 * that keeps it honest — a directive that CONTRADICTS the structural answer is a
 * FAILURE unless `CLASSIFY_ALLOW` carries a written reason for it. A marker that
 * has gone stale is the same silent defect as the grep, one level up.
 *
 * The template-literal trap is closed by construction: `url-and-regex-slashes.mjs`
 * carries a line reading `battery: browser` inside a template literal, and the
 * scanner reports zero directives for it. A raw-text scan honours it.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Module specifiers that ARE a browser driver. Matched on the specifier node. */
const DRIVER_MODULE = /^(playwright|playwright-core|puppeteer|puppeteer-core|@playwright\/test)(\/|$)/
/** `chromium.launch(…)` and its siblings, matched on the CALLEE, not the text. */
const LAUNCH_CALLEE =
  /(^|\.)(chromium|firefox|webkit|puppeteer|browserType|playwright)\.(launch|launchPersistentContext|launchServer|connect|connectOverCDP)$/
/** node:child_process, by the name actually called. */
const SPAWNER = /^(spawn|spawnSync|exec|execSync|execFile|execFileSync|fork)$/
/** a repo script a spawn could be handed. */
const SCRIPT_LITERAL = /(^|\/)[A-Za-z0-9_.-]+\.(mjs|cjs|js)$/
/** the ONE comment form allowed to decide. Whole trimmed line, nothing else. */
const DIRECTIVE_LINE = /^battery:\s*(browser|model)$/

/* ── CLASSIFY_ALLOW · the exemption list ───────────────────────────────────
 *
 * An entry is required when a file's DIRECTIVE contradicts what the parser reads
 * off its syntax tree. It costs two sentences: WHY the structure is not the
 * right answer, and WHAT makes the directive true. Every entry PRINTS on every
 * `--list` and on every self-test — a list nobody reads is a list that rots —
 * and a STALE entry, one whose file no longer contradicts anything, is itself a
 * FAILURE. That is how an exemption list kills the gate that owns it: the file
 * is fixed, the entry stays, and the next file to land under that name is
 * excused by an argument nobody made about it.
 *
 * IT IS EMPTY, and that is a measurement, not an omission. Both directives in
 * the tree AGREE with the parser and are therefore REDUNDANT rather than
 * exempt — `assert-hero-transition.mjs` declares `battery: browser` and the
 * parser reaches the same answer through its spawn of `verify-hero-transition.mjs`,
 * and `assert-one-knob.mjs` declares `battery: model` and is model. Redundant
 * markers are printed, never failed: deleting them is their owners' call.
 * The mechanism is proved by `directive-says-browser.mjs` in the self-test,
 * which is failed without an entry and passed with one. */
export const CLASSIFY_ALLOW = {}

/** Every COMMENT in the file, one entry per line of it — read off the PARSER's
 *  trivia, never off a regex and never off a bare scanner.
 *
 *  Both of the cheaper ways are wrong, and each was tried here first:
 *
 *  · A `//.*$` stripper eats `//localhost/app"` out of a string literal and
 *    deletes the evidence it was looking for — `assert-one-knob.mjs:66` records
 *    the same finding about the same class of check.
 *  · `ts.createScanner()` driven by a bare `while (scan())` loop DESYNCHRONISES
 *    on the first template literal carrying a substitution: continuing a template
 *    needs `reScanTemplateToken`, which only the parser calls. Measured here —
 *    `assert-hero-transition.mjs:122` is `` a.startsWith(`--${k}=`) ``, and after
 *    it the scanner missed that file's `battery: browser` marker at `:129`
 *    entirely. A classifier that silently loses a directive is the grep's defect
 *    with a syntax tree bolted on.
 *
 *  Every comment in a file is leading trivia of some token (the EOF token
 *  included), so walking every token and asking the parser for its comment
 *  ranges is exact. */
function commentLines(sf, src) {
  const out = []
  const seen = new Set()
  const take = (ranges) => {
    for (const r of ranges ?? []) {
      if (seen.has(r.pos)) continue
      seen.add(r.pos)
      const text = src.slice(r.pos, r.end)
      const firstLine = sf.getLineAndCharacterOfPosition(r.pos).line + 1
      text.split("\n").forEach((l, i) => {
        // strip the comment's own furniture: `//`, `/*`, `*/`, and a leading ` * `
        const body = l
          .replace(/^\s*\/\*+/, "")
          .replace(/\*+\/\s*$/, "")
          .replace(/^\s*\/\//, "")
          .replace(/^\s*\*+/, "")
          .trim()
        out.push({ line: firstLine + i, body })
      })
    }
  }
  const walk = (n) => {
    const kids = n.getChildren(sf)
    if (!kids.length) {
      take(ts.getLeadingCommentRanges(src, n.getFullStart()))
      take(ts.getTrailingCommentRanges(src, n.getEnd()))
      return
    }
    for (const k of kids) walk(k)
  }
  walk(sf)
  return out
}

/** What one file DOES, read off its syntax tree. No text matching anywhere. */
function readSignals(file) {
  const src = readFileSync(file, "utf8")
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const txt = (n) => (n ? n.getText(sf) : "")

  const imports = []
  const launches = []
  /** named function-likes, so one level of local indirection can be followed */
  const funcs = new Map()
  /** function node -> does its body contain a spawner call */
  const spawnsIn = new Set()
  const spawnCalls = []

  const collectFns = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) funcs.set(n.name.text, n)
    if (
      ts.isVariableDeclaration(n) &&
      n.name &&
      ts.isIdentifier(n.name) &&
      n.initializer &&
      (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
    ) {
      funcs.set(n.name.text, n.initializer)
    }
    ts.forEachChild(n, collectFns)
  }
  collectFns(sf)

  const enclosingFn = (n) => {
    let p = n.parent
    while (p) {
      if (
        (ts.isFunctionDeclaration(p) && p.name) ||
        ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
          p.parent &&
          ts.isVariableDeclaration(p.parent) &&
          p.parent.initializer === p)
      ) {
        return p
      }
      p = p.parent
    }
    return null
  }

  const visit = (n) => {
    // 1 · IMPORT — the specifier NODE, not the file's text
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      if (DRIVER_MODULE.test(n.moduleSpecifier.text)) imports.push({ what: n.moduleSpecifier.text, line: lineOf(n) })
    }
    if (ts.isCallExpression(n)) {
      const callee = txt(n.expression)
      const a0 = n.arguments[0]
      // dynamic import(), and require()
      if (
        (n.expression.kind === ts.SyntaxKind.ImportKeyword || /^require$/.test(callee)) &&
        a0 &&
        ts.isStringLiteral(a0) &&
        DRIVER_MODULE.test(a0.text)
      ) {
        imports.push({ what: a0.text, line: lineOf(n) })
      }
      // 2 · LAUNCH
      if (LAUNCH_CALLEE.test(callee)) launches.push({ what: callee, line: lineOf(n) })
      // 3 · SPAWN — record the call, and mark its enclosing function as spawning
      const name = ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : callee
      if (SPAWNER.test(name)) {
        spawnCalls.push({ node: n, line: lineOf(n) })
        const owner = enclosingFn(n)
        if (owner) spawnsIn.add(owner)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)

  /* ── the argument subtrees a spawned path can come from ──────────────────
   * Directly: `execFileSync("node", [join(__dirname, "_probe-word-ladder.mjs")])`.
   * Or through ONE local hop: `run("_probe-nan-params.mjs")` where `run` spawns
   * (`assert-param-guards.mjs:88`). Without the hop a helper defeats the check;
   * with it, a script named only in a MESSAGE — `assert-hero-transition.mjs:651`
   * prints "run verify-hero-transition.mjs first" — is still not followed,
   * because a console.error is not a spawn and not a call to one. */
  const argRoots = spawnCalls.map((c) => c.node)
  const spawningFnNames = new Set([...funcs].filter(([, node]) => spawnsIn.has(node)).map(([n]) => n))
  const findHopCalls = (n) => {
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && spawningFnNames.has(n.expression.text)) {
      argRoots.push(n)
    }
    ts.forEachChild(n, findHopCalls)
  }
  if (spawningFnNames.size) findHopCalls(sf)

  const spawnedScripts = []
  for (const root of argRoots) {
    const grab = (n) => {
      if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
        if (SCRIPT_LITERAL.test(n.text)) spawnedScripts.push({ text: n.text, line: lineOf(n) })
      }
      ts.forEachChild(n, grab)
    }
    for (const a of root.arguments) grab(a)
  }

  // 4 · DIRECTIVE — comments only, whole trimmed line only, at most one kind
  const directives = []
  for (const c of commentLines(sf, src)) {
    const m = DIRECTIVE_LINE.exec(c.body)
    if (m) directives.push({ kind: m[1], line: c.line })
  }

  return { file, src, imports, launches, spawnedScripts, spawnCalls: spawnCalls.length, directives }
}

/** Resolve a spawned literal to a real file on disk, or null. */
function resolveScript(fromFile, text) {
  for (const base of [dirname(fromFile), ROOT, VERIFY]) {
    const p = join(base, text)
    try {
      if (existsSync(p) && statSync(p).isFile()) return p
    } catch {
      /* raced with another lane's write */
    }
  }
  return null
}

const CLASSIFY_CACHE = new Map()

/**
 * MODEL or BROWSER, with the reason, the directive, and the structural answer
 * kept apart — because "it declares itself" and "it demonstrably drives one" are
 * different claims and collapsing them is how a stale marker survives.
 */
export function classify(path, seen = new Set(), depth = 0) {
  if (CLASSIFY_CACHE.has(path) && depth === 0) return CLASSIFY_CACHE.get(path)
  if (seen.has(path)) return { list: "model", why: "cycle", structural: "model", evidence: [], directives: [] }
  seen.add(path)

  let s
  try {
    s = readSignals(path)
  } catch (e) {
    /* A file this cannot PARSE gets no silent answer. It is BROWSER-listed —
     * the serial runner, which logs per gate — and the reason is printed.
     * Guessing "model" would drop it into a parallel sweep that promises no
     * browser, which is the direction that costs a wrong tree. */
    const r = { list: "browser", why: `UNPARSEABLE — ${String(e).slice(0, 120)}`, structural: "browser", evidence: [], directives: [], unparseable: true }
    if (depth === 0) CLASSIFY_CACHE.set(path, r)
    return r
  }

  const evidence = []
  for (const i of s.imports) evidence.push(`imports ${i.what} (:${i.line})`)
  for (const l of s.launches) evidence.push(`calls ${l.what} (:${l.line})`)

  /* the transitive hop — bounded, and it names the chain it followed */
  if (!evidence.length && depth < 3) {
    for (const sc of s.spawnedScripts) {
      const child = resolveScript(path, sc.text)
      if (!child) continue
      const c = classify(child, seen, depth + 1)
      if (c.list === "browser") {
        evidence.push(`spawns ${rel(child)} (:${sc.line}) which ${c.evidence[0] ?? c.why}`)
        break
      }
    }
  }

  const structural = evidence.length ? "browser" : "model"
  const kinds = [...new Set(s.directives.map((d) => d.kind))]
  const directive = kinds.length === 1 ? kinds[0] : null
  const conflicted = kinds.length > 1

  let list = structural
  let why = evidence.length ? evidence.join(" · ") : "no driver import, no launch call, no browser child"
  if (directive && directive !== structural) {
    list = directive
    why = `DIRECTIVE \`battery: ${directive}\` at :${s.directives[0].line} OVERRIDES the parser, which reads ${structural.toUpperCase()}`
  }

  const r = {
    list,
    why,
    structural,
    evidence,
    directives: s.directives,
    directive,
    conflicted,
    redundantDirective: !!directive && directive === structural,
    contradicts: !!directive && directive !== structural,
  }
  if (depth === 0) CLASSIFY_CACHE.set(path, r)
  return r
}

/** The name every consumer already imports. One implementation, three readers. */
export const isBrowser = (path) => classify(path).list === "browser"

/* ── THE PARTITION, ASSERTED RATHER THAN ASSUMED ──────────────────────────
 *
 * Lane C made the two runners share one classifier because "a partition
 * maintained by two copies of one rule can drop a gate into neither list with
 * nothing to say so". Sharing it makes that impossible by construction — and a
 * property that is true by construction is exactly the kind nobody notices
 * breaking. So it is CHECKED, on every invocation of either runner: every
 * discovered gate lands in exactly one list, `model + browser = total`, and the
 * two lists do not intersect. */
export function partition(all) {
  const model = []
  const browser = []
  const problems = []
  const notes = []
  for (const p of all) {
    const c = classify(p)
    if (c.list === "browser") browser.push(p)
    else if (c.list === "model") model.push(p)
    else problems.push(`${rel(p)}: classified "${c.list}", which is neither list`)

    if (c.conflicted) problems.push(`${rel(p)}: TWO CONFLICTING battery directives — ${c.directives.map((d) => `battery: ${d.kind} @:${d.line}`).join(", ")}`)
    if (c.unparseable) notes.push(`${rel(p)}: ${c.why} — listed BROWSER so it runs serially and logged`)
    if (c.contradicts) {
      const allow = CLASSIFY_ALLOW[p.split("/").pop()]
      if (!allow) {
        problems.push(
          `${rel(p)}: its directive says ${c.directive.toUpperCase()} and the parser reads ${c.structural.toUpperCase()}. ` +
            `Either the marker is stale or the parser is wrong — say which in CLASSIFY_ALLOW, with a reason.`,
        )
      } else {
        notes.push(`${rel(p)}: EXEMPT · directive ${c.directive.toUpperCase()} over parser ${c.structural.toUpperCase()} — ${allow.why}`)
      }
    }
    if (c.redundantDirective) {
      notes.push(`${rel(p)}: REDUNDANT DIRECTIVE \`battery: ${c.directive}\` at :${c.directives[0].line} — the parser reaches the same answer without it (${c.why})`)
    }
  }
  const seen = new Set(model.map(rel))
  const overlap = browser.filter((p) => seen.has(rel(p))).map(rel)
  if (overlap.length) problems.push(`OVERLAP — in BOTH lists: ${overlap.join(", ")}`)
  if (model.length + browser.length !== all.length) {
    problems.push(`model ${model.length} + browser ${browser.length} != ${all.length} discovered`)
  }
  /* A STALE EXEMPTION IS A FAILURE, reconciled in both directions. */
  const contradicting = new Set(all.filter((p) => classify(p).contradicts).map((p) => p.split("/").pop()))
  for (const name of Object.keys(CLASSIFY_ALLOW)) {
    if (!contradicting.has(name)) {
      problems.push(
        `CLASSIFY_ALLOW["${name}"]: STALE EXEMPTION — nothing about that file contradicts the parser any more. ` +
          `Delete the entry, or it will excuse the next marker to land under that name.`,
      )
    }
  }
  return { model, browser, problems, notes, overlap }
}

/* ── CALIBRATION · the fixtures, and F's real file ────────────────────────
 *
 * `lib/gate-fixtures/classify/` fixes each verdict by filename. And because a
 * synthetic set proves only that the analyser agrees with the person who wrote
 * it, the run ALSO reproduces the real defect: `assert-one-knob.mjs`'s source is
 * read off disk and the token is put back where Lane F had it — first in a
 * fixture string, then in a comment explaining the rule — and the OLD classifier
 * must call both BROWSER while the new one calls both MODEL. The reconstruction
 * is written to a TEMP DIR and deleted; nothing lands under scripts/verify,
 * where a stray `.mjs` becomes somebody else's sweep's problem. */
const OLD_CLASSIFIER = /chromium\.launch|playwright|puppeteer|\/\/ battery: browser/

const FIXTURE_EXPECT = {
  "mentions-a-driver-in-prose.mjs": "model",
  "launches-a-browser.mjs": "browser",
  "both-prose-and-launch.mjs": "browser",
  "spawns-a-browser-child.mjs": "browser",
  "spawns-a-model-child.mjs": "model",
  "url-and-regex-slashes.mjs": "model",
  "directive-says-browser.mjs": "browser",
}

export function classifySelfTest() {
  const FX = join(VERIFY, "lib", "gate-fixtures", "classify")
  let bad = 0
  const rows = []
  const row = (ok, what, detail) => {
    if (!ok) bad++
    rows.push(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  —  ${detail}` : ""}`)
  }

  for (const [name, want] of Object.entries(FIXTURE_EXPECT)) {
    const p = join(FX, name)
    if (!existsSync(p)) {
      row(false, `fixture ${name}`, `MISSING at ${p}`)
      continue
    }
    const c = classify(p)
    row(c.list === want, `${name.padEnd(32)} -> ${c.list.toUpperCase()}`, `wanted ${want.toUpperCase()} · ${c.why}`)
    /* THE OLD CLASSIFIER MUST DISAGREE ON THE PROSE FIXTURE, or the fixture is
     * not a known-bad and this whole set proves nothing. */
    if (name === "mentions-a-driver-in-prose.mjs") {
      row(
        OLD_CLASSIFIER.test(readFileSync(p, "utf8")),
        "…and the OLD grep classifier calls it BROWSER",
        "a fixture both classifiers agree on cannot show the difference",
      )
    }
  }

  /* the DIRECTIVE machinery: contradiction fails without an entry, passes with */
  {
    const p = join(FX, "directive-says-browser.mjs")
    const c = classify(p)
    row(c.contradicts && c.structural === "model" && c.list === "browser", "a contradicting DIRECTIVE is honoured AND flagged", `structural=${c.structural} directive=${c.directive}`)
    const { problems } = partition([p])
    row(problems.some((x) => x.includes("CLASSIFY_ALLOW")), "…and is a FAILURE with no exemption", problems[0]?.slice(0, 90) ?? "(no problem raised — the exemption list cannot be required)")
    const saved = CLASSIFY_ALLOW["directive-says-browser.mjs"]
    CLASSIFY_ALLOW["directive-says-browser.mjs"] = { why: "self-test only" }
    const withEntry = partition([p])
    if (saved === undefined) delete CLASSIFY_ALLOW["directive-says-browser.mjs"]
    else CLASSIFY_ALLOW["directive-says-browser.mjs"] = saved
    row(withEntry.problems.length === 0, "…and CLEAN once an entry says why", withEntry.notes[0]?.slice(0, 90) ?? "")
    const stale = partition([join(FX, "launches-a-browser.mjs")])
    row(stale.problems.length === 0, "a clean file needs no entry", "")
  }
  {
    /* and a STALE entry is a failure — proved by planting one */
    CLASSIFY_ALLOW["__nothing-matches-this.mjs"] = { why: "self-test only" }
    const { problems } = partition([join(FX, "launches-a-browser.mjs")])
    delete CLASSIFY_ALLOW["__nothing-matches-this.mjs"]
    row(problems.some((x) => x.includes("STALE EXEMPTION")), "a STALE exemption is itself a FAILURE", problems[0]?.slice(0, 100) ?? "(none raised)")
  }

  /* the comment extractor's control */
  {
    const p = join(FX, "url-and-regex-slashes.mjs")
    const c = classify(p)
    row(c.directives.length === 0, "a `battery:` line inside a TEMPLATE LITERAL is not a directive", `${c.directives.length} directive(s) found — a raw-text scan finds 1`)
  }

  /* ── THE ROW PARSER, AGAINST KNOWN ANSWERS ──────────────────────────────
   *
   * Every string below is a REAL emission from a real gate, cited. The pairs
   * matter more than the individual rows: widening a scoreboard's regex is the
   * same move as widening a classifier's, and the anti-widening controls are the
   * half that keeps it honest. A parser that counts every sentence containing
   * the word FAIL is not a better parser. */
  {
    const OLD_ROW = /^\s*(?:\*\*\* )?(?:PASS|FAIL)\b/gm
    const rowCase = (src, want, why, wantAnnounced = 0) => {
      const got = readRows(src)
      const oldRows = (src.match(OLD_ROW) || []).length
      row(
        got.rows === want && got.announced.length === wantAnnounced,
        `row parser: ${JSON.stringify(src.slice(0, 46))}`,
        `rows ${got.rows} (wanted ${want}, old parser saw ${oldRows}) · announced ${got.announced.length} (wanted ${wantAnnounced}) — ${why}`,
      )
    }
    // ① rows the OLD parser could not see
    rowCase("[reduced] FAIL  ascii layer not renderable — x", 1, "assert-layer-flicker.mjs:1371 — a channel-prefixed verdict is a verdict")
    rowCase("[calib] PASS  ruler holds", 1, "the ONE such row that survives into a green run, in the canonical logs")
    rowCase("FAILED TO FAIL. the control did not bite", 1, "`\\bFAIL\\b` does not match `FAILED` — Lane I's finding, at line start")
    // ② ANTI-WIDENING: summaries and prose must stay invisible
    rowCase("assert-one-knob: 5 PASS · 0 FAIL", 0, "a SUMMARY is not a row — nine gates print this shape and a blind widening counts them all")
    rowCase("REPORTED, NOT FAILED · 3 relationship(s) compose", 0, "assert-fusion-rail.mjs:221 — prose about failure is not a failure")
    rowCase(
      "UNSWEPT  / on :3112 — nothing is listening. NOT A PASS AND NOT A FAILURE: nothing was measured.",
      0,
      "assert-tsc-baseline.mjs's own line — this lane's change must not turn its own prose into a row",
    )
    rowCase("A SKIP IS NOT A PASS (DISPATCH §3:116)", 0, "the law itself, quoted in output, is not a verdict")
    // ③ announced failures: named, never guessed at as a row count
    rowCase(
      "MUTATION CONTROL --mutate=prior: FAILED TO FAIL.",
      0,
      "assert-flat-silhouette.mjs:499 — NOT turned into a row (nobody can say how many verdicts a sentence carries); NAMED instead",
      1,
    )
    rowCase("[joints] control FAILED TO CAPTURE — no frames", 0, "assert-joint-beading.mjs:388", 1)
    rowCase("the control \"prior\" PASSED — this row cannot fail, so it proves nothing", 0, "assert-export-plan.mjs:40 / -live:59 / -encoders:49", 1)
    // ④ and the shapes that always worked, so the widening did not break them
    rowCase("PASS  1.1a  nothing stored reads as `empty`", 1, "the ordinary case")
    rowCase("  *** FAIL: bead count moved ***", 1, "assert-joint-beading.mjs:452 — the `*** ` prefix still counts")
  }

  /* ── THE EXPORT CONTRACT · THIS FILE IS NOW AN IMPORT DEPENDENCY ─────────
   *
   * `assert-gate-integrity.mjs` imports from here. Lane I hit the failure mode
   * head-on: a 1930-line meta-gate against a 220-line `run-battery.mjs` gave
   *
   *     SyntaxError: does not provide an export named 'EXTRA_ARGS'
   *
   * and a meta-gate that cannot LOAD does not fail a row — it fails to run at
   * all, which every sweep above it reads as nothing to report. That is a silent
   * green of the worst kind, and it is caused by editing THIS file.
   *
   * So the contract is asserted rather than remembered: read this module's own
   * exports off its syntax tree, read every consumer's named imports of it off
   * theirs, and require the second to be a subset of the first. It generalises
   * past the meta-gate to any consumer, which is the point — the next one will
   * not be in anybody's head either. */
  {
    const selfPath = fileURLToPath(import.meta.url)
    const selfSrc = readFileSync(selfPath, "utf8")
    const selfSf = ts.createSourceFile(selfPath, selfSrc, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    const exported = new Set()
    const collectExports = (n) => {
      const mods = ts.canHaveModifiers(n) ? ts.getModifiers(n) ?? [] : []
      const isExported = mods.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
      if (isExported && ts.isFunctionDeclaration(n) && n.name) exported.add(n.name.text)
      if (isExported && ts.isVariableStatement(n)) {
        for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name)) exported.add(d.name.text)
      }
      if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) {
        for (const e of n.exportClause.elements) exported.add(e.name.text)
      }
      ts.forEachChild(n, collectExports)
    }
    collectExports(selfSf)

    const consumers = []
    for (const f of readdirSync(VERIFY)) {
      if (!f.endsWith(".mjs") || f === "run-battery.mjs") continue
      const p = join(VERIFY, f)
      const src = readFileSync(p, "utf8")
      if (!src.includes("run-battery.mjs")) continue
      const sf = ts.createSourceFile(p, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
      const walk = (n) => {
        if (
          ts.isImportDeclaration(n) &&
          ts.isStringLiteral(n.moduleSpecifier) &&
          n.moduleSpecifier.text.endsWith("run-battery.mjs") &&
          n.importClause?.namedBindings &&
          ts.isNamedImports(n.importClause.namedBindings)
        ) {
          for (const e of n.importClause.namedBindings.elements) {
            consumers.push({ f, name: (e.propertyName ?? e.name).text })
          }
        }
        ts.forEachChild(n, walk)
      }
      walk(sf)
    }
    const missing = consumers.filter((c) => !exported.has(c.name))
    row(
      consumers.length > 0,
      "run-battery.mjs has consumers that import named bindings from it",
      `${consumers.length} named import(s) across ${new Set(consumers.map((c) => c.f)).size} file(s) — incl. assert-gate-integrity.mjs`,
    )
    row(
      missing.length === 0,
      "…and EVERY name they import is still exported (the meta-gate can still LOAD)",
      missing.length
        ? `*** ${missing.map((m) => `${m.f} imports \`${m.name}\` — NOT EXPORTED`).join(" · ")} — that is a SyntaxError at import time, not a red row ***`
        : `exports: ${[...exported].sort().join(", ")}`,
    )
  }

  /* ── F's REAL FILE, both of the two passes it took her ─────────────────── */
  const KNOWN_BAD = join(VERIFY, "assert-one-knob.mjs")
  if (!existsSync(KNOWN_BAD)) {
    row(false, "assert-one-knob.mjs", "MISSING — the known-bad is not synthetic and cannot be replaced")
  } else {
    const real = readFileSync(KNOWN_BAD, "utf8")
    row(
      !OLD_CLASSIFIER.test(real) && classify(KNOWN_BAD).list === "model",
      "assert-one-knob.mjs AS IT STANDS is MODEL on both classifiers",
      "F fixed it by DELETING the token — the two only agree because the file was censored",
    )
    /* Reconstructed honestly, in a TEMP DIR — nothing is written under
     * scripts/verify, where a stray `.mjs` is somebody else's sweep's problem.
     * The two mutations are the two states F describes at `assert-one-knob.mjs:211-227`:
     * the token in a negative-control FIXTURE STRING, and then the token in a
     * COMMENT explaining the rule. */
    const dir = mkdtempSync(join(tmpdir(), "classify-"))
    const asFixtureString = real.replace(
      "  const a = M(",
      '  const KNOWN_BAD_FIXTURE = `import { chromium } from "playwright"\\nawait chromium.launch()`\n  const a = M(',
    )
    const asComment = real.replace(
      "// ⚠ NO FIXTURE, AND NO COMMENT IN THIS FILE, MAY SPELL THE BROWSER-CLASSIFIER",
      "// ⚠ the classifier greps for chromium.launch, playwright and puppeteer, so\n  // NO FIXTURE, AND NO COMMENT IN THIS FILE, MAY SPELL THE BROWSER-CLASSIFIER",
    )
    for (const [what, src] of [
      ["pass 1 · token in a FIXTURE STRING", asFixtureString],
      ["pass 2 · token in A COMMENT explaining the rule", asComment],
    ]) {
      if (src === real) {
        row(false, `reconstruction ${what}`, "the anchor did not match — assert-one-knob.mjs has moved; re-anchor this before trusting the row")
        continue
      }
      const tmp = join(dir, "one-knob-reconstructed.mjs")
      writeFileSync(tmp, src)
      const oldSays = OLD_CLASSIFIER.test(src) ? "browser" : "model"
      const newSays = classify(tmp).list
      CLASSIFY_CACHE.delete(tmp)
      row(
        oldSays === "browser" && newSays === "model",
        `assert-one-knob.mjs, ${what}`,
        `OLD grep -> ${oldSays.toUpperCase()} (the defect, reproduced) · PARSED -> ${newSays.toUpperCase()}`,
      )
    }
    rmSync(dir, { recursive: true, force: true })
  }

  return { ok: bad === 0, bad, rows }
}

/* ── WHAT THE SWEEP TYPES, WHEN BARE IS NOT ENOUGH ─────────────────────────
 *
 * THE RULE THIS TABLE DOES NOT BREAK: the bare invocation is still the one the
 * next person types, and `run-browser-battery.mjs`'s header is right that not
 * passing `--label=` is deliberate. A LABEL selects which stored capture to
 * grade; a bare run grading the default capture is exactly the fact worth
 * surfacing, and passing one would hide it.
 *
 * A FLAG THAT GATES A JUDGEMENT IS A DIFFERENT ANIMAL, and conflating the two
 * is how nine gates ended up with an arm no sweep has ever run. Measured
 * 2026-08-07 (explainer 27 §2, re-measured here): `assert-hero-dials` emits four
 * MODEL rows bare and keeps its entire browser arm behind `--live`. It is
 * classified BROWSER because its source contains `chromium.launch`, so
 * `run-battery.mjs` refuses it as a model gate and `run-browser-battery.mjs`
 * runs it WITHOUT the flag that makes it a browser gate. It fell between the two
 * runners while appearing in both their inventories, in 0.3 s, green.
 *
 * ONE TABLE, THREE READERS. Both runners spawn from it and
 * `assert-gate-integrity.mjs` channel J IMPORTS it to verify its own exemption
 * list. A second copy of this mapping is the repo's most expensive recurring
 * defect (README §"a pattern worth knowing"), and an exemption checked against a
 * hand-written sentence instead of the real table is the same defect wearing a
 * meta-gate's name.
 *
 * A gate is in here only when leaving it out would make the sweep LIE. Prefer
 * deleting the flag in the gate itself — an arm that always runs needs no entry
 * and cannot drift out of one. */
export const EXTRA_ARGS = {
  /* THE PRODUCTION FENCE, F104. `assert-debug-surface-fenced` grades two
   * channels: §1 DEV against the dev server, and §2 PRODUCTION against a real
   * `next build`, which it will only look at when handed `--prod-port`. No
   * runner passed it, so EVERY battery ended:
   *
   *     UNSWEPT  §2 · PRODUCTION — no --prod-port was given
   *     PARTIAL — 4 row(s) passed and 1 channel(s) were NEVER REACHED
   *
   * The gate is right to refuse; a channel it never reached is not a pass. But
   * a permanent PARTIAL in the headline is one a reader learns to skip, and the
   * fence that keeps the debug surface out of production is the last thing that
   * should become background noise. **That is this table's stated bar: leaving
   * it out makes the sweep lie.**
   *
   * 🔴 IT IS A FLAG, NOT AN ENV VAR, AND `assert-one-knob` IS WHY. The first
   * version of this read a second port variable from the environment, and
   * channel C caught it on
   * the next run: *"no script reads a port/URL env var by any name other than
   * FS_PORT"*. I wrote "one knob, one name" in this very comment while adding a
   * second knob. **The rule is not "name your port knobs consistently", it is
   * "there is ONE port env var in this repo".** So the port arrives as a
   * forwarded argument and no new environment name exists:
   *
   *     npm run build && npx next start --port 3106
   *     FS_PORT=3105 node scripts/verify/run-browser-battery.mjs --prod-port=3106
   *
   * Without the flag `extraArgsFor` returns `[]`, the gate behaves exactly as
   * before and still refuses to claim a channel it never reached. Swept this way
   * on 2026-09-05: 8/8, dev AND a real `next build`. */
  PROD_PORT_GATE: "assert-debug-surface-fenced.mjs",

  /* `assert-hero-dials.mjs` is NOT here on purpose: `--live` was REMOVED from
   * that gate rather than passed to it. Its browser arm now runs on the bare
   * invocation, which is the answer that survives someone typing the gate's name
   * by hand — the entry that would sit here only helps people who go through a
   * runner. Left as a comment because "why is the headline gate absent from the
   * flag table" is a question worth answering in the file itself. */
}

/** The extra arguments a sweep passes to one gate, or `[]`.
 *  `opts.prodPort` is forwarded ONLY to the gate that asks for one, so the
 *  mapping from gate to flag stays in this table and is never copied. */
export const extraArgsFor = (path, opts = {}) => {
  const name = path.split("/").pop()
  const own = EXTRA_ARGS[name]
  const extra = Array.isArray(own) ? own : []
  if (opts.prodPort && name === EXTRA_ARGS.PROD_PORT_GATE) return [...extra, `--prod-port=${opts.prodPort}`]
  return extra
}

/* REALPATH ON BOTH SIDES. `import.meta.url` is the resolved path and argv[1] is
 * whatever was typed, so `node /var/folders/.../run-battery.mjs` (where /var is a
 * symlink to /private/var) compared unequal, skipped the whole sweep and EXITED 0
 * with no record written. Measured 2026-09-22 by `_probe-crosscheck-battery-only`,
 * whose sandbox sits under /var: its first filtered run "passed" having done
 * nothing. The same holds for any symlinked checkout path. */
const IS_MAIN = (() => {
  if (!process.argv[1]) return false
  try {
    return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1])
  } catch {
    return fileURLToPath(import.meta.url) === process.argv[1]
  }
})()

/* ── A FILTERED RUN NEVER REPLACES THE FULL RECORD ─────────────────────────
 * F113 crosscheck, 2026-09-22. `--only=<x>` used to write `battery.json` as a
 * one-gate file, deleting the full sweep (662 lines) with nothing to say so. The
 * next reader opened a green one-gate record and took it for the tree. F99 was
 * the same defect in the staged capture.
 *
 * A filtered run writes to its OWN file, never merged into the full one. Merging
 * by gate was rejected: the result would carry one `when` and one set of counts
 * over verdicts taken at different commits, which is a full sweep that never
 * happened. The full record changes only when the full sweep ran.
 *
 * ONE RULE for both runners, imported by `run-browser-battery.mjs`. Probe:
 * `_probe-crosscheck-battery-only.mjs`. */
export function evidenceName(base, only) {
  return only ? `${base}-only` : base
}

const all = discover().filter((p) => (ONLY ? rel(p).includes(ONLY) : true))

/* ONE CLASSIFIER, ASSERTED. `partition()` is the same call `run-browser-battery.mjs`
 * makes, and it raises a problem rather than returning a quiet answer whenever a
 * gate would land in neither list, in both, or under a directive that disagrees
 * with its own code. */
const { model, browser, problems: PARTITION_PROBLEMS, notes: PARTITION_NOTES } = partition(all)

/** Printed by BOTH runners, above their own output. A partition that is wrong is
 *  not a detail of the scoreboard; it decides what the scoreboard is about. */
export function reportPartition(all_, { model: m, browser: b, problems, notes }) {
  if (notes.length) {
    console.log(`--- classifier notes (${notes.length}) ---`)
    for (const n of notes) console.log(`  · ${n}`)
    console.log("")
  }
  if (problems.length) {
    console.log(`🔴 THE PARTITION IS BROKEN — ${problems.length} problem(s). The lists below are not trustworthy:`)
    for (const p of problems) console.log(`   ${p}`)
    return false
  }
  console.log(
    `partition OK — ${all_.length} discovered = ${m.length} MODEL + ${b.length} BROWSER, overlap 0\n`,
  )
  return true
}

if (IS_MAIN && has("classify-selftest")) {
  const { ok, bad, rows } = classifySelfTest()
  console.log("=== CLASSIFIER CALIBRATION — MODEL vs BROWSER, against known answers ===\n")
  for (const r of rows) console.log(r)
  const okP = reportPartition(all, { model, browser, problems: PARTITION_PROBLEMS, notes: PARTITION_NOTES })
  console.log(
    ok && okP
      ? `\nCALIBRATED — ${rows.length}/${rows.length}. The MODEL/BROWSER split below is usable.`
      : `\nNOT CALIBRATED — ${bad} wrong${okP ? "" : " + a broken partition"}. Every classification is unproven until this is green.`,
  )
  process.exit(ok && okP ? 0 : 1)
}

if (IS_MAIN && has("list")) {
  reportPartition(all, { model, browser, problems: PARTITION_PROBLEMS, notes: PARTITION_NOTES })
  console.log(`MODEL (${model.length}):`)
  for (const p of model) console.log(`  ${rel(p)}  — ${classify(p).why}`)
  console.log(`\nBROWSER — not run by this file (${browser.length}):`)
  for (const p of browser) console.log(`  ${rel(p)}  — ${classify(p).why}`)
  process.exit(PARTITION_PROBLEMS.length ? 1 : 0)
}

/* ── EVERY GATE RUNS UNDER THE CRASH GUARD (F25) ───────────────────────────
 *
 * 101 of the 103 gates `discover()` finds turn a crash into a non-zero exit with
 * no FAIL row, so a scoreboard sees the PASS rows they printed first and no
 * failure. `--import` puts `lib/crash-row.mjs` in the child before the gate's
 * first line and it emits `[crash] FAIL …` into THE GATE'S OWN STDOUT, which is
 * what puts the row in `browser-logs/*.log` and in front of anyone who pipes one
 * gate through `grep`, not just in this file's summary. It fires only on a
 * non-zero exit that is not PARTIAL and that printed no red row, so a green gate
 * cannot gain a row and an honest failure cannot gain a second one.
 *
 * It is a node OPTION, so it does not enter the gate's `process.argv` and no
 * gate's flag parsing or `IS_MAIN` check can see it. Exported so the browser
 * runner spawns the same way rather than restating it. */
export const CRASH_GUARD = pathToFileURL(join(VERIFY, "lib", "crash-row.mjs")).href
export const nodeArgsFor = (path, opts = {}) => ["--import", CRASH_GUARD, path, ...extraArgsFor(path, opts)]

function run(path) {
  const f = path.split("/").pop()
  return new Promise((resolve) => {
    const t0 = Date.now()
    const p = spawn("node", nodeArgsFor(path), { cwd: ROOT })
    let out = ""
    p.stdout.on("data", (d) => (out += d))
    p.stderr.on("data", (d) => (out += d))
    const timer = setTimeout(() => {
      p.kill("SIGKILL")
      resolve({ f, path, code: null, ms: Date.now() - t0, out, timedOut: true })
    }, TIMEOUT)
    /* `close` hands back the SIGNAL as well as the code, and until 2026-08-28
     * this dropped it. A process killed by a signal reports `code: null`, so the
     * synthesised row read "ended at exit null" and named nothing. `process.abort()`
     * is the case that needs it: uncatchable in-process, so this runner is its only
     * reader. */
    p.on("close", (code, sig) => {
      clearTimeout(timer)
      resolve({ f, path, code, sig, ms: Date.now() - t0, out })
    })
  })
}

/* ══════════════════════════════════════════════════════════════════════════
 * COUNTING · A ROW IS ONLY EVIDENCE IF THE RUN THAT PRINTED IT FINISHED
 *
 * `assert-data-safety` prints **85 PASS rows and then fails** — its §1 and §2 are
 * model arms and its §3 needs the app, so against an unreachable tree the whole
 * model half scrolls past in green before `page.goto` throws. The exit code was
 * always honest. The COUNT was not: this file used to sum `rows` across every
 * result, red ones included, and print "633 rows" as the headline. A reader takes
 * that number for 633 settled judgements. Eighty-five of them were printed by a
 * run that could not reach its subject and does not know whether they hold on the
 * tree it was pointed at.
 *
 * This is the inverse of the defect explainer 29 §5 records — there the live arm
 * printed `live`/`DEAD`, which no scoreboard can parse, so four real verdicts were
 * invisible. Here the rows ARE parsed, and they drown the verdict.
 *
 * So rows are split by the exit code of the run that emitted them, and the two
 * are never added together. Measured in the model battery on 2026-08-07: of 633
 * rows, 76 came from gates that then went red.
 *
 * FIVE MORE GATES HAVE THE SAME SHAPE, measured by Lane F against a dead port and
 * named here so nobody has to find them twice — `assert-rod-caps` (12 rows),
 * `assert-elbow` (7), `assert-form-orbit` (4), `assert-fold-census` (3),
 * `assert-taper-envelope` (3) — plus `assert-hero-word-legible` (14), which is in
 * THIS battery. They are other lanes' files; the counting is this one's.
 *
 * EXIT 3 IS NOT A FAILURE AND IT IS NOT A PASS. A gate that could not reach a
 * channel it set out to judge exits 3 and is PARTIAL: reported by name, never
 * folded into the green count. `assert-tsc-baseline` is the instance — pointed at
 * a dead port it used to print two SKIP rows and exit 0, and the battery printed
 * `pass  assert-tsc-baseline  2 rows`, which is how a skipped route check gets
 * read as a passing one. DISPATCH §3:116: a SKIP is not a pass.
 * ══════════════════════════════════════════════════════════════════════════ */

/* ── THE BACKSTOP, AND WHY ITS ROW SAYS SO IN ITS FIRST WORD ───────────────
 *
 * `lib/crash-row.mjs` runs INSIDE the gate and emits the row from there, which
 * is the honest path: it can name the throw, and the row lands in the gate's own
 * output where every reader looks. One thing can defeat it, a SIGKILL at the
 * timeout cap, where no handler in the dying process gets a turn. That is the
 * same fact `DISPATCH` §3 records about a session limit killing a lane.
 *
 * So this file keeps its own last line of defence, and the whole cost of a
 * backstop is that its row is an INFERENCE, not a verdict. A reader must never
 * have to work that out:
 *
 *   · the channel is `[runner-synth]`, not `[crash]`, and not blank;
 *   · it is printed by THIS FILE, into THIS FILE's stdout. It is never appended
 *     to `r.out`, so it never enters a per-gate log, never enters `rows`, and
 *     never enters the row counts written to `battery.json`. The gate's log
 *     stays a record of what the gate said;
 *   · it lands in `battery.json` under `synthesised`, beside the counts and
 *     never inside them.
 *
 * When it fires it is also a finding in its own right: the guard was bypassed. */
const guardMissedIt = ({ code, partial, fails }) => code !== 0 && !partial && fails === 0
const synthRow = ({ f, code, sig, timedOut }) =>
  /* `code` is null when a process died on a SIGNAL, and this line is the ONLY place
   * an aborted gate surfaces. It read "ended at exit null", which names nothing.
   * Measured 2026-08-28: `process.abort()` is uncatchable in-process on Node 25.6.1
   * (SIGABRT arrives with the disposition already reset, so no `exit` event, no
   * `uncaughtException`, and not even a SIGABRT listener), so the backstop is the
   * only reader of that case and it has to say which signal. */
  `[runner-synth] FAIL  ${f} ended at ${timedOut ? "SIGKILL (timed out)" : code === null ? `signal ${sig ?? "unknown"} (uncatchable, no in-process handler runs)` : `exit ${code}`} and printed no failing row.\n` +
  `[runner-synth]   SYNTHESISED BY run-battery.mjs. The gate did not say this and lib/crash-row.mjs did not\n` +
  `[runner-synth]   reach it${timedOut ? ", a killed process gets no handler" : ""}. Counted nowhere: not in this gate's rows, not in its log.`

const results = []
const queue = [...model]
async function worker() {
  while (queue.length) {
    const path = queue.shift()
    const f = path.split("/").pop()
    const r = await run(path)
    const { rows, fails, announced } = readRows(r.out)
    const partial = r.code === PARTIAL_EXIT && !r.timedOut
    const guardMissed = guardMissedIt({ code: r.code, partial, fails })
    results.push({ ...r, rows, fails, announced, partial, guardMissed })
    const tag = tagOf({ ...r, rows, fails }, partial)
    console.log(
      `${tag.padEnd(9)} ${f.padEnd(34)} ${String(rows).padStart(3)} rows` +
        `${fails ? `, ${fails} red` : ""}` +
        `${announced.length ? `, ${announced.length} UNCOUNTED failure announcement(s)` : ""}` +
        `${r.code !== 0 && !partial && rows - fails > 0 ? `, ${rows - fails} PASS row(s) printed BEFORE it failed` : ""}` +
        `  ${(r.ms / 1000).toFixed(1)}s`,
    )
    if (guardMissed) console.log(synthRow({ f, code: r.code, sig: r.sig, timedOut: r.timedOut }))
  }
}

if (!IS_MAIN) {
  /* Imported for `discover()` / `isBrowser()` by `run-browser-battery.mjs`.
   * Running the model battery as a side effect of that import would be a fork
   * bomb with good intentions, which is the same mistake `EXCLUDE` avoids. */
} else {

console.log(`=== BATTERY — ${model.length} model gates, ${JOBS} at a time ===\n`)
if (!reportPartition(all, { model, browser, problems: PARTITION_PROBLEMS, notes: PARTITION_NOTES })) {
  console.log("\nRefusing to sweep on a broken partition — the lists are what the sweep is ABOUT.")
  process.exit(1)
}
{
  /* THE CLASSIFIER CALIBRATES ITSELF, EVERY RUN, before it is believed. An
   * analyser that has never rejected anything is the disease it is looking for,
   * one level up — the same rule `assert-gate-integrity.mjs` applies to itself
   * (`:1478` "The sweep calibrates FIRST, every run"). It parses 9 small files
   * and costs ~0.1 s, so there is no version of this behind a flag. */
  const { ok, bad, rows } = classifySelfTest()
  if (!ok) {
    console.log("=== CLASSIFIER CALIBRATION ===\n")
    for (const r of rows) console.log(r)
    console.log(`\nNOT CALIBRATED — ${bad} of ${rows.length} wrong. Refusing to sweep on an unproven MODEL/BROWSER split.`)
    process.exit(1)
  }
  console.log(`classifier CALIBRATED — ${rows.length}/${rows.length} known answers, incl. assert-one-knob.mjs reconstructed in both of the states it failed in\n`)
}
await Promise.all(Array.from({ length: JOBS }, worker))

results.sort((a, b) => a.f.localeCompare(b.f))
const partialRuns = results.filter((r) => r.partial)
const red = results.filter((r) => r.code !== 0 && !r.partial)
const zeroRow = results.filter((r) => r.code === 0 && r.rows === 0)

console.log(
  `\n--- NOT RUN, and a SKIP IS NOT A PASS. ${browser.length} browser gate(s) need ` +
    `\`pnpm dev\` and real Chrome (channel "chrome", --use-angle=metal). Each one named: ---`,
)
for (const p of browser) console.log(`  · ${rel(p)}`)

if (partialRuns.length) {
  console.log(
    `\n--- PARTIAL (exit ${PARTIAL_EXIT}) — the run could not REACH a channel it set out to judge. ` +
      `Nothing failed and nothing about that channel was settled. NOT counted as green: ---`,
  )
  for (const r of partialRuns) {
    const why = (r.out.match(/^.*\bUNSWEPT\b.*$/m) || ["  (no UNSWEPT line — see the gate's own output)"])[0]
    console.log(`  · ${r.f.padEnd(34)} ${why.trim().slice(0, 130)}`)
  }
}

if (zeroRow.length) {
  console.log(`\n--- exited 0 having emitted NO PASS/FAIL row. That is not a pass, and it fails the sweep: ---`)
  for (const r of zeroRow) console.log(`  · ${r.f}`)
}
const redAtZero = results.filter(failedAtZero)
if (redAtZero.length) {
  console.log(`\n--- 🔴 printed a FAIL row and EXITED 0. The row is the verdict, so these fail the sweep: ---`)
  for (const r of redAtZero) {
    const first = (r.out.match(/^.*(?:\*\*\* )?FAIL\b.*$/m) || ["  (FAIL row counted but not re-found)"])[0]
    console.log(`  · ${r.f.padEnd(34)} ${r.fails} FAIL row(s) of ${r.rows}   ${first.trim().slice(0, 110)}`)
  }
}

/* ── FAILURES ANNOUNCED IN A FORM NO SCOREBOARD COUNTS ────────────────────
 * Reported, and FAILED when the run went green anyway. The row parser is not
 * asked to guess how many verdicts an English sentence carries — it is asked to
 * stop pretending it saw none. */
const announcedGreen = results.filter((r) => r.code === 0 && r.announced.length)
const announcedAny = results.filter((r) => r.announced.length)
if (announcedAny.length) {
  console.log(
    `\n--- a FAILURE ANNOUNCED in a form the row parser cannot count (${announcedAny.length} gate(s)). ` +
      `\`\\bFAIL\\b\` does not match \`FAILED\`, and a control that says so in English is invisible: ---`,
  )
  for (const r of announcedAny) {
    console.log(`  ${r.code === 0 ? "🔴 EXITED 0" : "   exit " + r.code}  ${r.f}`)
    for (const a of r.announced.slice(0, 2)) console.log(`        ${a}`)
  }
}
if (announcedGreen.length) {
  console.log(
    `\n🔴 ${announcedGreen.length} gate(s) ANNOUNCED A FAILURE AND EXITED 0. A control that reports itself` +
      `\n   blind while its gate goes green is the lie this repo is organised around. Counted as RED here.`,
  )
}

const guardMissed = results.filter((r) => r.guardMissed)
if (guardMissed.length) {
  console.log(
    `\n--- ${guardMissed.length} gate(s) exited non-zero with NO FAILING ROW even under the crash guard. ` +
      `\n    The row below each is the RUNNER'S INFERENCE, not the gate's verdict: ---`,
  )
  for (const r of guardMissed) console.log(synthRow({ f: r.f, code: r.code, sig: r.sig, timedOut: r.timedOut }))
}

if (red.length) {
  console.log(`\n--- RED, with the first failing row of each: ---`)
  for (const r of red) {
    const first = (r.out.match(/^.*(?:\*\*\* )?FAIL\b.*$/m) || [r.timedOut ? "  (timed out)" : "  (no FAIL row — non-zero exit without one)"])[0]
    const before = r.rows - r.fails
    console.log(`\n  ${r.f}  exit ${r.code}${before > 0 ? `   — and it printed ${before} PASS row(s) before this` : ""}`)
    console.log(`    ${first.trim().slice(0, 160)}`)
  }
}

const OUT = join(ROOT, "docs", "verification", "gate-integrity")
mkdirSync(OUT, { recursive: true })
const greenRuns = results.filter(cleanGreen)
const rowsGreen = greenRuns.reduce((n, r) => n + r.rows, 0)
const rowsRed = red.reduce((n, r) => n + r.rows, 0)
const rowsPartial = partialRuns.reduce((n, r) => n + r.rows, 0)
const passRowsBeforeFailing = red.reduce((n, r) => n + (r.rows - r.fails), 0)
const RECORD = join(OUT, `${evidenceName("battery", ONLY)}.json`)
writeFileSync(
  RECORD,
  JSON.stringify(
    {
      when: new Date().toISOString(),
      /* null on a full sweep. A filtered record says what it was filtered to. */
      filter: ONLY || null,
      partition: { discovered: all.length, model: model.length, browser: browser.length, overlap: 0 },
      classifier: { basis: "parsed — driver import / launch call / browser child / declared directive", notes: PARTITION_NOTES },
      counts: {
        green: greenRuns.length,
        partial: partialRuns.length,
        red: red.length,
        rowsGreen,
        rowsPartial,
        rowsRed,
        passRowsBeforeFailing,
        announcedFailuresUncounted: announcedAny.reduce((n, r) => n + r.announced.length, 0),
        announcedWhileGreen: announcedGreen.map((r) => r.f),
        failRowsAtExit0: redAtZero.map((r) => r.f),
        zeroRowAtExit0: zeroRow.map((r) => r.f),
      },
      /* BESIDE the counts, never inside them. A row this file inferred is not a
       * row a gate printed, and `counts` is what a reader adds up. */
      synthesised: guardMissed.map((r) => ({ f: r.f, code: r.code, timedOut: !!r.timedOut, by: "run-battery.mjs", channel: "runner-synth" })),
      model: results.map(({ f, path, code, ms, rows, fails, announced, partial, guardMissed: gm }) => ({ f, at: rel(path), code, ms, rows, fails, announced, partial: !!partial, guardMissed: !!gm })),
      notRun: browser.map(rel),
    },
    null,
    2,
  ),
)

/* THE HEADLINE NEVER ADDS THE THREE TOGETHER. A single "633 rows" is the number
 * that does not mean what a reader thinks it means. */
console.log(
  `\n${greenRuns.length}/${results.length} model gates green, ${rowsGreen} rows on gates that finished clean.` +
    (partialRuns.length ? `\n${partialRuns.length} PARTIAL — ${rowsPartial} row(s), and a channel each of them could not reach. A SKIP IS NOT A PASS.` : ``) +
    (red.length
      ? `\n${red.length} RED — ${rowsRed} row(s), of which ${passRowsBeforeFailing} PASSED before the failure. Those are not evidence: the run that printed them did not finish.`
      : ``) +
    (announcedAny.length
      ? `\n${announcedAny.length} gate(s) announced a failure the row parser cannot count${announcedGreen.length ? `, ${announcedGreen.length} of them WHILE EXITING 0` : ""}.`
      : ``) +
    (redAtZero.length ? `\n${redAtZero.length} gate(s) printed a FAIL row and exited 0: RED.` : ``) +
    (zeroRow.length ? `\n${zeroRow.length} gate(s) exited 0 with no row at all: RED.` : ``) +
    `\n${browser.length} browser gate(s) NOT RUN.`,
)
console.log(`wrote ${RECORD}${ONLY ? `  (filtered to "${ONLY}", the full record in battery.json is untouched)` : ""}`)
/* ── THE SWEEP'S OWN EXIT CODE CARRIES THE SAME THREE MEANINGS ─────────────
 * Otherwise PARTIAL is a loophole: a gate that stops exiting 1 for "I could not
 * start" and starts exiting 3 would quietly drop out of the red count and the
 * battery would go green on a tree nothing was measured against. Same ladder as
 * a gate: 1 if anything FAILED, 3 if nothing failed and something was never
 * reached, 0 only for a complete clean sweep. `!= 0` still catches both. */
process.exit(sweepExit(results))

}
