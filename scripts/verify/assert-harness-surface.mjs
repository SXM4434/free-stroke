// ASSERT-HARNESS-SURFACE — does the question a gate asks the app actually exist,
// and does everything the app offers ever get asked?
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
//
//   `__captureHarness` and `__inflateProbe` are how every browser gate in this
//   repo asks the app a question. Three lanes in a row hit the same wall from
//   three directions, and the wall is this object:
//
//     · Lane Q: "row 3 is unfalsified — NO HARNESS CAN SET A MESH INVISIBLE, so
//       nothing available makes `visible` say otherwise."  (a question that
//       cannot be asked)
//     · Lane W: `_probe-drawin-holes.mjs`'s census read TWO KEY NAMES THAT DO
//       NOT EXIST, so `list.length` — the number that attributes a whole arm —
//       was never recorded. `pick` guards with `if (k in o)`, so the invented
//       names could not throw. They were simply absent from every `globals.json`
//       that probe has ever written.  (a question answered with silence)
//     · Lane W again: four teardowns restored `setPenTip("reed")`, a named guess
//       rather than the recorded prior, so arms 4-8 ran off-state.  (a question
//       the harness could not answer, so the file guessed)
//
//   DISPATCH §2.7 — *"Names must match behaviour. A dial whose label does not
//   describe what renders is a defect — wire it or remove it."* This gate is
//   §2.7 applied to an API instead of a dial. A harness key that is read and
//   always `undefined` is a measurement that silently returns nothing; a harness
//   member nobody has ever called is a dial with no wire behind it.
//
//   Both failures are SILENT, which is the whole cost. `o.count` on an object
//   with no `count` is `undefined`, not an error. A member nobody calls is not a
//   warning. Neither shows up in a green run, and both of them attributed a
//   number to something that never happened.
//
// ── WHAT IT ASKS ────────────────────────────────────────────────────────────
//
//   A · THE SURFACE IS DERIVED, NEVER COPIED. The `w.__X = { … }` object
//       literals in the app are PARSED and their own property names are the
//       subject. A hand-written member list is the exact rot explainer 37 §2
//       records — `assert-texture-motion`'s twelve string literals against a
//       thirteen-member type, where "a mode nobody enumerated is a mode whose
//       animation nobody has ever measured, and it reads identically to a mode
//       that passed." A new member joins this gate's subject the day it lands.
//
//   B · EVERY CALL NAMES A MEMBER THAT EXISTS. `h.setAutoRotate(…)` on an
//       object with no `setAutoRotate` is a TypeError at best and a silent
//       `undefined` at worst, depending on how it is reached. HARD FAIL, with a
//       named ALLOW for the one legitimate shape: a deliberate probe FOR
//       ABSENCE, which `assert-view-presets.mjs` does on purpose and reports.
//
//   C · EVERY MEMBER IS CALLED BY SOMETHING. Dead surface. RATCHETED rather than
//       hard-failed, because a member landed today for a row that needs a
//       browser tomorrow is not a defect — but the count may FALL and never
//       RISE, and every exemption is named with what retires it.
//
//   D · A KEY CENSUS NAMES KEYS THAT EXIST. Lane W's actual defect, which is
//       one level below B: `pick(w.__heroJunctions, ["inkWidth", "count",
//       "total"])` reads two names the object does not have. The published
//       globals are parsed the same way the harnesses are, and a literal list of
//       key names handed to a call ALONGSIDE one of them must name only real
//       keys. HARD FAIL.
//
//   E · ALLOW HONESTY — Lane F's channel E, copied rather than rebuilt (it has
//       already caught three stale entries in real use, explainer 37 §5). Every
//       entry carries a written reason AND must still be needed. A STALE entry
//       is itself a FAILURE: that is how an exemption list kills the gate that
//       owns it — the file is fixed, the entry stays, and the next violation in
//       that file is excused by an argument nobody made about it.
//
//   F · CALIBRATION, BOTH DIRECTIONS, EVERY RUN, ON THE BARE INVOCATION. An
//       analyser that has never rejected anything is the disease it is looking
//       for, one level up (DISPATCH §2.6: *"A green row that cannot fail is the
//       lie"*). The fixtures are written to a TEMP DIR — a stray `assert-*` or
//       `_probe-*` inside `scripts/verify/` would be picked up by both
//       batteries.
//
// ── PARSE, DO NOT GREP ──────────────────────────────────────────────────────
//
//   Lane K proved a grep cannot tell code from prose *inside the machine that
//   decides which battery runs a file* (`assert-one-knob.mjs` header, explainer
//   33). This file would fail its own grep on the paragraphs above, which name
//   `__captureHarness.setAutoRotate` and `__heroJunctions` without calling
//   anything. So every question is asked of the syntax tree.
//
//   THE ONE PLACE THAT IS NOT ENOUGH, STATED RATHER THAN HIDDEN: a call can be
//   written as a STRING — `evalJS("window.__captureHarness.grab()")` in
//   `scripts/capture/capture-frames.mjs` is real and is invisible to an AST walk
//   of the calling file. So a string or template literal containing a harness
//   name is RE-PARSED AS JAVASCRIPT: clean parse => it is a call site; parse
//   errors => it is prose, and it is PRINTED under "text mentions" rather than
//   silently dropped. `assert-hero-dials.mjs`'s `az: "page.tsx
//   __captureHarness.orbitView"` is a data-table label and produces one parse
//   diagnostic, which is how it is told apart from the real thing. The residual
//   risk is one-directional and it is the safe direction: a prose string that
//   happens to parse can only make a member look USED, never make a real call
//   look missing.
//
// Usage:
//   node scripts/verify/assert-harness-surface.mjs             # the sweep, and channel F's 9 controls
//   node scripts/verify/assert-harness-surface.mjs --list      # every member + every call site
//
// There is no `--calibrate` and no `--record`. Channel F's nine fixtures were
// never behind `--calibrate` in the first place — `calibrate()` has always run
// unconditionally and the flag only re-printed it — so the flag is gone and the
// nine now print as nine rows instead of one aggregate. `--record` is gone
// because it could not do anything; see THE RATCHET below.
import ts from "typescript"
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdtempSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative } from "node:path"
import { tmpdir } from "node:os"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const has = (k) => process.argv.includes(`--${k}`)
const LIST = has("list")
const rel = (p) => relative(ROOT, p)

const BASELINE_FILE = join(__dirname, "harness-surface-baseline.json")

/** Where the surfaces are PUBLISHED. Read off disk; a missing file is a failure,
 *  never a skip. */
const PUBLISHER_FILES = [
  join(ROOT, "components", "viewport-3d.tsx"),
  join(ROOT, "app", "desk-doodles", "page.tsx"),
]
/** Where the surfaces are CONSUMED. Everything runnable under `scripts/`, which
 *  is `scripts/verify/` plus `scripts/capture/` — the capture tools drive the
 *  same harness and a member alive only there is not dead. */
const CONSUMER_ROOT = join(ROOT, "scripts")

// ───────────────────────────────────────────────────────────────────────────
// THE ALLOW LISTS. Every entry costs one honest sentence naming WHY and WHAT
// RETIRES IT. An entry with no reason fails channel E, and so does an entry
// whose file no longer violates.
// ───────────────────────────────────────────────────────────────────────────

/** B · calls that name a member which does not exist, and are RIGHT to. */
const MISSING_ALLOW = {
  "scripts/verify/verify-timing.mjs::__captureHarness.__captureEpoch":
    "WRITTEN, NOT CALLED. The site is " +
    "`if (h.__captureEpoch === undefined) h.__captureEpoch = Math.random()`, which " +
    "STAMPS a random marker on the harness and reads it back to tell one page " +
    "instance from another across a reload. The member is SUPPOSED not to exist " +
    "on a fresh page; that is the whole mechanism. Naming it here is the gate " +
    "reading a property assignment as a call. " +
    "REMOVE THIS ENTRY if that file ever stops stamping its own marker.",

  "scripts/verify/assert-view-presets.mjs::__captureHarness.setAutoRotate":
    "A DELIBERATE ABSENCE PROBE, NOT A CALL. The site is " +
    "`setAutoRotate: typeof h?.setAutoRotate === \"function\"` and the row it feeds " +
    "REPORTS the answer: \"the name the parked assertion probed for — absent, and " +
    "never present in this repo\". The gate's own header at :23 says the same. " +
    "Probing for absence is the one legitimate reason to name a member that does " +
    "not exist, and it must stay legal or the gate deletes a working control. " +
    "REMOVE THIS ENTRY if that file ever stops reporting the absence.",

  /* ── FOUR REAL DEFECTS, FOUND BY THIS GATE ON ITS FIRST RUN, IN FILES THIS
   * LANE DOES NOT OWN. Every one is Lane W's class exactly: a key that is read
   * and is always `undefined`, silently, with a number published beside it.
   * Lane V holds every browser file tonight, so these are ROUTED, not taken.
   * ──────────────────────────────────────────────────────────────────────── */
  "scripts/verify/_probe-laned-halves.mjs::__heroJunctions.length":
    "🔴 A REAL DEFECT — OWNERSHIP, NOT JUDGEMENT. `:88-89` read " +
    "`const j = window.__heroJunctions; return Array.isArray(j) ? { count: j.length, … }` " +
    "— but `__heroJunctions` is an OBJECT (`app/desk-doodles/page.tsx`, keys " +
    "`inkWidth · breakK · law · carve · list`) and has never been an array, so " +
    "`Array.isArray` is ALWAYS false and this probe has printed `count: null` on " +
    "every run it has ever made. It is Lane W's `_probe-drawin-holes` census in a " +
    "second file, and the number lost is the same one: `list.length`, which " +
    "attributes the joint-break arm. THE FIX IS `j?.list?.length`. " +
    "REMOVE THIS ENTRY once that file reads `list`.",
  "scripts/verify/_probe-laned-halves.mjs::__heroJunctions.slice":
    "🔴 THE SAME SITE, SECOND MEMBER — `sample: j.slice(0, 3)` on the same " +
    "always-false branch. Listed separately because the gate reports per member " +
    "and an entry that covered two would go stale in halves. " +
    "REMOVE THIS ENTRY with the entry above it.",
  "scripts/verify/verify-engine-ab.mjs::__geomDebug.meshCount":
    "🔴 A REAL DEFECT — OWNERSHIP, NOT JUDGEMENT. `:241` reads " +
    "`{ meshCount: d.meshCount?.(), buildCount: d.buildCount?.() }`. `__geomDebug` " +
    "has eleven members and `meshCount` is not one of them; the optional call " +
    "makes it `undefined` rather than a throw, so every A/B row this tool has " +
    "written carries `meshCount: undefined` beside a real `buildCount`. THE " +
    "MEMBER IT WANTS IS `stats()`, which is what seventeen other call sites use. " +
    "REMOVE THIS ENTRY once that line reads `stats`.",
  "scripts/verify/verify-gloss-rim.mjs::__geomDebug.normalHistogram":
    "🔴 A REAL DEFECT, AND THE MOST EXPENSIVE OF THE FOUR — OWNERSHIP, NOT " +
    "JUDGEMENT. `:299` reads `const root = window.__geomDebug?.normalHistogram; " +
    "return root ? root() : null`, and `normalHistogram` appears NOWHERE in this " +
    "repo — not in components/, not in lib/, not in app/. So `band` is `null` in " +
    "every `probes[…]` payload this tool has ever written, and the comment three " +
    "lines above it says that band IS the bevel: \"a die-cut rim scores 0\". The " +
    "measurement was never taken and the evidence file has a field for it. THE " +
    "MEMBER THAT EXISTS IS `probeNormals()`. " +
    "REMOVE THIS ENTRY once that line names a member that exists.",
}

/** C · members nothing calls, and there is a written reason. */
const DEAD_ALLOW = {
  "__inflateProbe.setMeshVisible":
    "LANDED 2026-08-07 FOR A ROW THAT NEEDS A BROWSER. It closes explainer 24 " +
    "§10.2 row 3 (`visible` has never been observed reading `false`). Its three " +
    "known-bad rows belong on `assert-drawin-attrs.mjs`, which is not this lane's " +
    "file and every row of which is a pixel row. NO BROWSER WAS OPENED TODAY, so " +
    "the consumer is UNWRITTEN and stated as such rather than faked. " +
    "REMOVE THIS ENTRY once `assert-drawin-attrs.mjs` carries the rows.",
  "__inflateProbe.forcedHidden":
    "THE DISARM READING FOR THE ABOVE. A sweep that hides a mesh must be able to " +
    "assert it un-hid everything it hid, instead of assuming it did; it lands with " +
    "its setter or the setter ships without a way to check itself. " +
    "REMOVE THIS ENTRY with the entry above it.",
  "__captureHarness.snapshot":
    "LANDED 2026-08-07 SO SIXTEEN TEARDOWNS CAN STOP GUESSING. Lane W measured " +
    "four teardowns restoring `setPenTip(\"reed\")` — a named value, not the one " +
    "that shipped — so arms 4-8 ran off-state. The 17 files that drive a paired " +
    "dial to a hardcoded literal are OTHER LANES' FILES (Lane V holds every one " +
    "that launches a browser tonight). REMOVE THIS ENTRY once the first teardown " +
    "is converted.",
  "__captureHarness.restore":
    "THE OTHER HALF OF `snapshot()`. A snapshot with no restore is a reading " +
    "nobody can act on. REMOVE THIS ENTRY with the entry above it.",
  "__captureHarness.flatten":
    "THE READER `setFlatten` NEVER HAD. Counted by parsing this surface: eighteen " +
    "`set*` members, seventeen with a paired reader, and `setFlatten` — the " +
    "most-driven member of the whole harness — was the exception, so nothing could " +
    "ask the page what the flat override IS. `snapshot()` above would have had a " +
    "hole in it exactly there. REMOVE THIS ENTRY once a sweep reads it directly " +
    "or `snapshot()` gains a consumer.",
  "__captureHarness.letterSeam":
    "A DEAD WRAPPER, AND ITS CONSUMERS REACH PAST IT. `assert-letter-seam.mjs:118` " +
    "and `_probe-lane3-when.mjs:48` both read `window.__letterSeam` DIRECTLY, which " +
    "is the same value this member forwards. Not a lane's mistake — the wrapper " +
    "was never the shorter path. OWNERSHIP: deleting it edits two other lanes' " +
    "assumptions about a global. RETIRED by either wiring those two through it or " +
    "removing it, per DISPATCH §2.7.",
  "__engineHarness.setEngine":
    "AN ENTIRE API NOTHING DRIVES — OWNERSHIP, NOT JUDGEMENT. " +
    "`app/desk-doodles/page.tsx` publishes `__engineHarness = { setEngine, get }` " +
    "with the comment that switching the engine \"builds the word — which is the " +
    "whole point of the comparison\", and NO file under `scripts/` names " +
    "`__engineHarness` at all. `verify-engine-ab.mjs` — the A/B tool it was " +
    "written for — drives the page's pills instead. Both members, both dead. " +
    "RETIRED by wiring the A/B tool through it or removing it.",
  "__engineHarness.get":
    "THE OTHER HALF OF THE SAME UNUSED API — see the entry above. Listed " +
    "separately so it expires independently, because an entry covering two " +
    "members goes stale in halves. RETIRED with the entry above it.",
  "__inflateProbe.meshCount":
    "DUPLICATED BY `stats().meshCount`, WHICH IS WHAT EVERYBODY CALLS — " +
    "`assert-inflate-fusion.mjs:220`, `verify-inflate-fusion.mjs:283`, " +
    "`verify-deskdoodles-ink.mjs:165`. One number, two doors, and the traffic all " +
    "goes through the other one. RETIRED by removing it, per DISPATCH §2.7; not " +
    "taken here because `__inflateProbe` is read by files this lane does not own.",
}

// ───────────────────────────────────────────────────────────────────────────
// THE RATCHET — a data file, not a private const.
//
// `assert-one-knob.mjs` states the rule this copies: *"A ratchet only its author
// can lower is a debt counter, not a gate."*
//
// A MISSING FILE IS A FAILURE, NOT A DEFAULT. Falling back to a built-in number
// would make deleting the file a way to choose the ceiling.
//
// AND IT HAS NO HEADROOM BY CONSTRUCTION: every dead member with a written
// reason is in DEAD_ALLOW and is EXCLUDED from the ratcheted count, so the
// baseline counts only the unexplained ones. Headroom is free violations
// (explainer 37 §4).
//
// ⚠ 2026-08-28 · `--record` IS DELETED, AND THE SENTENCE ABOVE IS WHY.
//
// It was reported as two judgements no sweep reaches. It is not a judgement at
// all: with no headroom by construction the baseline is 0, the measurement is
// `deadUnallowed.length` and so cannot be negative, and the ratchet writes only
// when nothing RISES. The one value `--record` could ever write is 0, over a
// file that already says 0. Its two reachable outcomes were a refusal and a
// byte-identical rewrite.
//
// So the flag was not an arm behind a gate; it was the leftover of a mechanism
// this file's own design had already argued out of existence, three paragraphs
// up. DEAD_ALLOW is the surviving way to excuse a dead member, and it costs a
// written reason, which is the point. Deleting beats tabling: `run-battery.mjs`
// — "an arm that always runs needs no entry and cannot drift out of one."
// ───────────────────────────────────────────────────────────────────────────
const BASELINE_KEYS = {
  deadMembersUnexplained: "C · harness members nothing calls, with no written reason",
}
function readBaseline() {
  if (!existsSync(BASELINE_FILE)) return null
  try {
    const j = JSON.parse(readFileSync(BASELINE_FILE, "utf8"))
    for (const k of Object.keys(BASELINE_KEYS)) if (!Number.isInteger(j[k])) return { bad: `\`${k}\` is missing or not an integer` }
    return j
  } catch (e) {
    return { bad: String(e.message).slice(0, 140) }
  }
}
// ═══════════════════════════════════════════════════════════════════════════
// THE ANALYSER — pure. It takes explicit file lists so channel F's controls can
// run it over temp fixtures without ever writing a script into `scripts/verify/`.
// ═══════════════════════════════════════════════════════════════════════════

const kindOf = (p) =>
  p.endsWith(".tsx") ? ts.ScriptKind.TSX : p.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS
const parse = (p, text) => ts.createSourceFile(p, text, ts.ScriptTarget.Latest, true, kindOf(p))

/**
 * A · PUBLISHED SURFACES. Every `w.__X = { … }` / `window.__X = { … }` whose
 * right-hand side is an OBJECT LITERAL. The literal's own property names are the
 * subject; a global assigned something else (a number, a string, a variable) has
 * no key set to check and is REPORTED as out of scope rather than skipped.
 */
export function publishedSurfaces(files) {
  const surfaces = new Map() // name -> { file, line, members: [{name, line}] }
  const nonLiteral = []
  for (const { path, text } of files) {
    const sf = parse(path, text)
    const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
    const walk = (n) => {
      if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
        let name = null
        if (ts.isPropertyAccessExpression(n.left) && n.left.name.text.startsWith("__")) name = n.left.name.text
        else if (
          ts.isElementAccessExpression(n.left) &&
          n.left.argumentExpression &&
          ts.isStringLiteral(n.left.argumentExpression) &&
          n.left.argumentExpression.text.startsWith("__")
        ) name = n.left.argumentExpression.text
        if (name) {
          if (ts.isObjectLiteralExpression(n.right)) {
            /* UNION, NOT FIRST-WINS. A global assigned in two branches with two
             * key sets would otherwise have half its surface invisible, and a
             * legitimate read of a key from the OTHER branch would be reported
             * as naming a member that does not exist — a false red, which is
             * the fastest way to get a gate switched off. */
            if (!surfaces.has(name)) surfaces.set(name, { file: path, line: lineOf(n), members: [], fns: 0, vals: 0 })
            const s = surfaces.get(name)
            for (const p of n.right.properties) {
              if (!p.name) continue
              const key = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null
              if (!key) continue
              if (s.members.some((m) => m.name === key)) continue
              const init = ts.isPropertyAssignment(p) ? p.initializer : null
              const isFn =
                ts.isMethodDeclaration(p) ||
                (!!init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init)))
              /* A BARE IDENTIFIER INITIALISER IS UNKNOWN, NOT DATA. `bounds:
               * apiBounds` is a function reference and counting it as a value
               * would misclassify the biggest API on the surface. Unknowns are
               * excluded from the ratio in BOTH directions rather than guessed. */
              const isVal = !isFn && !!init && !ts.isIdentifier(init) && !ts.isShorthandPropertyAssignment(p)
              if (isFn) s.fns++
              else if (isVal || ts.isShorthandPropertyAssignment(p)) s.vals++
              s.members.push({ name: key, line: lineOf(p), fn: !!isFn })
            }
          } else {
            nonLiteral.push({ name, file: path, line: lineOf(n) })
          }
        }
      }
      ts.forEachChild(n, walk)
    }
    walk(sf)
  }
  return { surfaces, nonLiteral }
}

/**
 * B + D · every reference to a published surface, from one consumer file.
 *
 * `surfaceOf(expr)` is the whole analyser: does this expression evaluate to one
 * of the published objects? It follows `window.__X`, `w["__X"]`, a local alias
 * bound to either, and the `a ?? b` / `a || b` shapes these files actually use.
 * It does NOT follow two hops, and an alias is scoped to the function it was
 * declared in — a file-wide alias map would let `const h = {}` in one function
 * turn `h.anything` into a phantom harness call in another.
 */
export function referencesIn(path, text, surfaceNames) {
  const sf = parse(path, text)
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const calls = []
  const keyLists = []
  const textMentions = []

  /** enclosing function-ish scope, so an alias cannot leak between functions. */
  const scopeOf = (n) => {
    let cur = n
    while (cur) {
      if (
        ts.isArrowFunction(cur) || ts.isFunctionExpression(cur) ||
        ts.isFunctionDeclaration(cur) || ts.isMethodDeclaration(cur) ||
        ts.isSourceFile(cur)
      ) return cur
      cur = cur.parent
    }
    return sf
  }

  // pass 1 — aliases, keyed by (scope, name)
  const aliases = new Map()
  const aliasKey = (scope, name) => `${scope.pos}:${scope.end}:${name}`
  const surfaceOf = (e, scope) => {
    if (!e) return null
    if (ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e)) return surfaceOf(e.expression, scope)
    if (ts.isAsExpression && ts.isAsExpression(e)) return surfaceOf(e.expression, scope)
    if (ts.isBinaryExpression(e) &&
      (e.operatorToken.kind === ts.SyntaxKind.BarBarToken || e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken))
      return surfaceOf(e.left, scope) || surfaceOf(e.right, scope)
    if (ts.isPropertyAccessExpression(e) && surfaceNames.has(e.name.text)) return e.name.text
    if (ts.isElementAccessExpression(e) && e.argumentExpression && ts.isStringLiteral(e.argumentExpression) && surfaceNames.has(e.argumentExpression.text))
      return e.argumentExpression.text
    if (ts.isIdentifier(e)) {
      let s = scope
      while (s) {
        const hit = aliases.get(aliasKey(s, e.text))
        if (hit) return hit
        if (ts.isSourceFile(s)) break
        s = scopeOf(s.parent ?? sf)
        if (!s) break
      }
    }
    return null
  }
  // two passes so an alias declared after its use still resolves
  for (let pass = 0; pass < 2; pass++) {
    const aWalk = (n) => {
      if (ts.isVariableDeclaration(n) && n.initializer) {
        const scope = scopeOf(n)
        const s = surfaceOf(n.initializer, scope)
        if (s && ts.isIdentifier(n.name)) aliases.set(aliasKey(scope, n.name.text), s)
      }
      ts.forEachChild(n, aWalk)
    }
    aWalk(sf)
  }

  // pass 2 — member accesses, destructures, key lists, strings
  const walk = (n) => {
    const scope = scopeOf(n)

    if (ts.isPropertyAccessExpression(n)) {
      const s = surfaceOf(n.expression, scope)
      if (s && ts.isIdentifier(n.name)) calls.push({ surface: s, member: n.name.text, line: lineOf(n), how: "access" })
    }
    if (ts.isElementAccessExpression(n) && n.argumentExpression && ts.isStringLiteral(n.argumentExpression)) {
      const s = surfaceOf(n.expression, scope)
      if (s) calls.push({ surface: s, member: n.argumentExpression.text, line: lineOf(n), how: "index" })
    }
    // `const { grab, bounds } = window.__captureHarness`
    if (ts.isVariableDeclaration(n) && n.name && ts.isObjectBindingPattern(n.name) && n.initializer) {
      const s = surfaceOf(n.initializer, scope)
      if (s) for (const el of n.name.elements) {
        const key = el.propertyName ?? el.name
        if (ts.isIdentifier(key)) calls.push({ surface: s, member: key.text, line: lineOf(el), how: "destructured" })
        else if (ts.isStringLiteral(key)) calls.push({ surface: s, member: key.text, line: lineOf(el), how: "destructured" })
      }
    }
    /* D · A KEY CENSUS. `pick(w.__heroJunctions, ["inkWidth", "count", "total"])`
     * — one argument IS a published surface and another is an array of string
     * literals. Those strings are key names by construction: the only thing a
     * helper can do with them is index the object beside them. This is Lane W's
     * exact defect and it is why `count` and `total` were absent from every
     * `globals.json` that probe ever wrote, silently. */
    if (ts.isCallExpression(n) && n.arguments.length >= 2) {
      let surface = null
      for (const a of n.arguments) {
        const s = surfaceOf(a, scope)
        if (s) { surface = s; break }
      }
      if (surface) {
        for (const a of n.arguments) {
          if (!ts.isArrayLiteralExpression(a)) continue
          if (a.elements.length === 0 || !a.elements.every((e) => ts.isStringLiteral(e))) continue
          keyLists.push({
            surface,
            keys: a.elements.map((e) => e.text),
            line: lineOf(a),
            callee: n.expression.getText(sf).slice(0, 40),
          })
        }
      }
    }
    // strings that might be code — see the header
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      const raw = n.text
      if (surfaceNames.size && [...surfaceNames].some((h) => raw.includes(`${h}.`))) {
        const inner = ts.createSourceFile("inline.js", raw, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
        if (inner.parseDiagnostics.length === 0) {
          const iWalk = (m) => {
            if (ts.isPropertyAccessExpression(m) && ts.isPropertyAccessExpression(m.expression) && surfaceNames.has(m.expression.name.text)) {
              calls.push({ surface: m.expression.name.text, member: m.name.text, line: lineOf(n), how: "string-eval" })
            }
            ts.forEachChild(m, iWalk)
          }
          iWalk(inner)
        } else {
          textMentions.push({ line: lineOf(n), text: raw.slice(0, 70), diags: inner.parseDiagnostics.length })
        }
      }
    }
    ts.forEachChild(n, walk)
  }
  walk(sf)
  return { calls, keyLists, textMentions }
}

/** The whole measurement, over explicit file lists. */
export function analyse(publisherFiles, consumerFiles) {
  const { surfaces, nonLiteral } = publishedSurfaces(publisherFiles)
  const surfaceNames = new Set(surfaces.keys())
  const calls = []
  const keyLists = []
  const textMentions = []
  for (const { path, text } of consumerFiles) {
    const r = referencesIn(path, text, surfaceNames)
    for (const c of r.calls) calls.push({ ...c, file: path })
    for (const k of r.keyLists) keyLists.push({ ...k, file: path })
    for (const t of r.textMentions) textMentions.push({ ...t, file: path })
  }
  const known = new Map()
  for (const [name, s] of surfaces) known.set(name, new Set(s.members.map((m) => m.name)))

  const missing = calls.filter((c) => !known.get(c.surface).has(c.member))
  const badKeys = []
  for (const k of keyLists) {
    const bad = k.keys.filter((n) => !known.get(k.surface).has(n))
    if (bad.length) badKeys.push({ ...k, bad })
  }
  const used = new Map()
  for (const c of calls) {
    if (!used.has(c.surface)) used.set(c.surface, new Set())
    used.get(c.surface).add(c.member)
  }
  /* ── WHICH SURFACES CHANNEL C IS ABOUT, DERIVED RATHER THAN LISTED ────────
   * "Every member gets called" is a real rule about an API — a method nobody
   * calls is DISPATCH §2.7's dial with no wire behind it. It is NOT a rule about
   * a DIAGNOSTIC PAYLOAD: `__heroPenField` publishes thirty numbers so that
   * whichever one a future defect needs is already there, and an unread key is
   * the payload doing its job. Grading those would put 61 non-defects on this
   * gate's first run, which is how a gate gets switched off in week one.
   *
   * So: a surface is an API when every member whose kind is KNOWN is a function.
   * Derived from the literal, so a new surface joins the right side of the line
   * the day it lands, and neither side is a name in this file. */
  for (const [, s] of surfaces) s.isApi = s.fns > 0 && s.vals === 0
  const dead = []
  for (const [name, s] of surfaces) {
    if (!s.isApi) continue
    for (const m of s.members) if (!used.get(name)?.has(m.name)) dead.push({ surface: name, member: m.name, line: m.line, file: s.file })
  }
  return { surfaces, nonLiteral, calls, keyLists, textMentions, missing, badKeys, dead }
}

// ═══════════════════════════════════════════════════════════════════════════
// THE RUN
// ═══════════════════════════════════════════════════════════════════════════

const readAll = (paths) => paths.filter((p) => existsSync(p)).map((p) => ({ path: p, text: readFileSync(p, "utf8") }))
const listScripts = (d) => {
  const out = []
  const w = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) { w(p); continue }
      if (/\.(mjs|js|cjs)$/.test(f)) out.push(p)
    }
  }
  if (existsSync(d)) w(d)
  return out
}

let bad = 0
const rows = []
const row = (ok, what, detail) => {
  if (!ok) bad++
  rows.push(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  —  ${detail}` : ""}`)
}

// ── F · CALIBRATION, on the bare invocation, both directions ───────────────
//
// The analyser is handed a known-bad publisher + consumer pair and REQUIRED to
// flag it, and a clean pair and REQUIRED not to. NINE shapes, because a control
// that only tests one of them proves the analyser can say "no" about that one.
// (The prose said "five" until 2026-08-28; four fixtures were added under it and
// the number was never moved. `lib/control-manifest.json` and `docs/RUN-QUEUE.md`
// copied the five — handed to the controller, since neither file is this lane's.)
const FIXTURES = [
  {
    label: "B · a call naming a member that does NOT exist -> RED",
    pub: `const w = window as any\nw.__fixtureHarness = { alpha: () => 1, beta: (n: number) => n > 0 }\n`,
    con: `await page.evaluate(() => window.__fixtureHarness.gamma(1))\n`,
    want: (r) => r.missing.length === 1 && r.missing[0].member === "gamma",
  },
  {
    label: "B · a CLEAN pair does NOT flag",
    pub: `const w = window as any\nw.__fixtureHarness = { alpha: () => 1, beta: (n: number) => n > 0 }\n`,
    con: `await page.evaluate(() => window.__fixtureHarness.alpha())\nawait page.evaluate(() => window.__fixtureHarness.beta(1))\n`,
    want: (r) => r.missing.length === 0 && r.dead.length === 0,
  },
  {
    label: "C · a member NOBODY calls -> reported dead",
    pub: `const w = window as any\nw.__fixtureHarness = { alpha: () => 1, beta: (n: number) => n > 0 }\n`,
    con: `await page.evaluate(() => window.__fixtureHarness.alpha())\n`,
    want: (r) => r.dead.length === 1 && r.dead[0].member === "beta",
  },
  {
    label: "D · a key census naming a key that does NOT exist -> RED  (Lane W's defect)",
    pub: `const w = window as any\nw.__fixtureGlobal = { inkWidth: 1, breakK: 2, list: [] }\n`,
    con: `const g = pick(window.__fixtureGlobal, ["inkWidth", "count", "total"])\n`,
    want: (r) => r.badKeys.length === 1 && r.badKeys[0].bad.join(",") === "count,total",
  },
  {
    label: "D · a key census naming only REAL keys does NOT flag",
    pub: `const w = window as any\nw.__fixtureGlobal = { inkWidth: 1, breakK: 2, list: [] }\n`,
    con: `const g = pick(window.__fixtureGlobal, ["inkWidth", "breakK", "list"])\n`,
    want: (r) => r.badKeys.length === 0,
  },
  {
    label: "B · an ALIAS is followed  (`const h = window.__X; h.nope()`)",
    pub: `const w = window as any\nw.__fixtureHarness = { alpha: () => 1 }\n`,
    con: `await page.evaluate(() => { const h = window.__fixtureHarness; return h.nope() })\n`,
    want: (r) => r.missing.length === 1 && r.missing[0].member === "nope",
  },
  {
    label: "B · a PROSE string is NOT a call  (`\"page.tsx __fixtureHarness.nope\"`)",
    pub: `const w = window as any\nw.__fixtureHarness = { alpha: () => 1 }\n`,
    con: `const label = "page.tsx __fixtureHarness.nope"\nawait page.evaluate(() => window.__fixtureHarness.alpha())\n`,
    want: (r) => r.missing.length === 0 && r.textMentions.length === 1,
  },
  {
    label: "B · a string that IS code is a call  (`evalJS(\"window.__X.nope()\")`)",
    pub: `const w = window as any\nw.__fixtureHarness = { alpha: () => 1 }\n`,
    con: `evalJS("window.__fixtureHarness.nope()")\nawait page.evaluate(() => window.__fixtureHarness.alpha())\n`,
    want: (r) => r.missing.length === 1 && r.missing[0].member === "nope",
  },
  {
    label: "B · an unrelated `h` in ANOTHER function is not a phantom call",
    pub: `const w = window as any\nw.__fixtureHarness = { alpha: () => 1 }\n`,
    con: `const one = () => { const h = window.__fixtureHarness; return h.alpha() }\nconst two = () => { const h = { zzz: 1 }; return h.zzz }\n`,
    want: (r) => r.missing.length === 0,
  },
]

function calibrate() {
  const dir = mkdtempSync(join(tmpdir(), "harness-surface-"))
  const results = []
  try {
    for (const f of FIXTURES) {
      const pub = join(dir, "pub.tsx")
      const con = join(dir, "con.mjs")
      writeFileSync(pub, f.pub)
      writeFileSync(con, f.con)
      const r = analyse([{ path: pub, text: f.pub }], [{ path: con, text: f.con }])
      results.push({ label: f.label, ok: !!f.want(r), r })
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  return results
}

const calib = calibrate()
const calibBad = calib.filter((c) => !c.ok)

// ── the real measurement ──────────────────────────────────────────────────
const publisherFiles = readAll(PUBLISHER_FILES)
const consumerFiles = readAll(listScripts(CONSUMER_ROOT))
const R = analyse(publisherFiles, consumerFiles)

const key = (c) => `${rel(c.file)}::${c.surface}.${c.member}`
const deadKey = (d) => `${d.surface}.${d.member}`
const missingUnallowed = R.missing.filter((m) => !Object.prototype.hasOwnProperty.call(MISSING_ALLOW, key(m)))
const deadUnallowed = R.dead.filter((d) => !Object.prototype.hasOwnProperty.call(DEAD_ALLOW, deadKey(d)))

if (LIST) {
  for (const [name, s] of R.surfaces) {
    console.log(`\n${name}  ${rel(s.file)}:${s.line}  —  ${s.members.length} members  ·  ${s.isApi ? "API — channel C grades it" : "DATA PAYLOAD — channel C does NOT grade it; an unread key is the payload doing its job"}`)
    const used = new Map()
    for (const c of R.calls) {
      if (c.surface !== name) continue
      if (!used.has(c.member)) used.set(c.member, [])
      used.get(c.member).push(`${rel(c.file)}:${c.line}`)
    }
    for (const m of s.members) {
      const u = used.get(m.name)
      /* A LISTING THAT SAYS RED ABOUT SOMETHING THE GATE DOES NOT GRADE IS THIS
       * FILE'S OWN SUBJECT, ONE LEVEL UP. The first draft printed "🔴 DEAD"
       * beside sixty-one payload keys that channel C correctly ignores. */
      const tag = u
        ? `${u.length} call site(s)`
        : !s.isApi
          ? "unread — a payload key, not graded"
          : Object.prototype.hasOwnProperty.call(DEAD_ALLOW, `${name}.${m.name}`)
            ? "DEAD — allowed by written reason"
            : "🔴 DEAD"
      console.log(`   ${m.name.padEnd(30)} :${String(m.line).padEnd(6)} ${tag}${u && u.length <= 3 ? "  " + u.join(" · ") : ""}`)
    }
  }
  console.log(`\n── text mentions (a string naming a surface that does not parse as code) — ${R.textMentions.length} ──`)
  for (const t of R.textMentions) console.log(`   ${rel(t.file)}:${t.line}  ${JSON.stringify(t.text)}  (${t.diags} parse diagnostic(s))`)
  console.log(`\n── globals assigned something other than an object literal — ${R.nonLiteral.length}, OUT OF SCOPE, not skipped ──`)
  for (const n of R.nonLiteral) console.log(`   ${n.name}  ${rel(n.file)}:${n.line}`)
}

// ── A ─────────────────────────────────────────────────────────────────────
const surfaceSummary = [...R.surfaces].map(([n, s]) => `${n} ${s.members.length}`).join(" · ")
row(
  R.surfaces.size >= 2 && [...R.surfaces.values()].every((s) => s.members.length > 0),
  "A · the surface is DERIVED from the app's own object literals, never copied",
  `${R.surfaces.size} surface(s) · ${surfaceSummary} · ${consumerFiles.length} consumer files · ${R.calls.length} resolved references`,
)
/* A parse that finds nothing must FAIL, not pass vacuously — a gate whose
 * subject is empty is the green row that cannot fail, one level up. */
row(
  R.calls.length > 0,
  "A · …and the consumer scan RESOLVED references, so an empty subject cannot read green",
  `${R.calls.length} references across ${consumerFiles.length} files`,
)

// ── B ─────────────────────────────────────────────────────────────────────
row(
  missingUnallowed.length === 0,
  "B · every harness member a script calls ACTUALLY EXISTS",
  missingUnallowed.length === 0
    ? `${R.missing.length} named a member that does not exist, ${Object.keys(MISSING_ALLOW).length} allowed by written reason`
    : missingUnallowed.map((m) => `${rel(m.file)}:${m.line} ${m.surface}.${m.member}`).join(" · "),
)

// ── D ─────────────────────────────────────────────────────────────────────
row(
  R.badKeys.length === 0,
  "D · every KEY a census asks for actually exists on the object it names",
  R.badKeys.length === 0
    ? `${R.keyLists.length} key list(s) checked, ${R.keyLists.reduce((a, k) => a + k.keys.length, 0)} names`
    : R.badKeys.map((k) => `${rel(k.file)}:${k.line} ${k.callee}(${k.surface}, [… ${k.bad.join(", ")} …])`).join(" · "),
)

// ── C · the ratchet ───────────────────────────────────────────────────────
const measured = { deadMembersUnexplained: deadUnallowed.length }
const base = readBaseline()
if (!base || base.bad) {
  row(false, "C · the ratchet's baseline is readable", base?.bad ?? `${rel(BASELINE_FILE)} is MISSING — a missing baseline is a failure, not a default`)
} else {
  const k = "deadMembersUnexplained"
  row(
    measured[k] <= base[k],
    `${BASELINE_KEYS[k]} has not RISEN`,
    `${measured[k]} against a baseline of ${base[k]}` +
      (deadUnallowed.length ? ` · ${deadUnallowed.map((d) => `${d.surface}.${d.member} (${rel(d.file)}:${d.line})`).join(" · ")}` : "") +
      (measured[k] < base[k] ? "  — it FELL, which cannot happen: the baseline is 0 and the count is a length" : ""),
  )
}

// ── E · ALLOW honesty (Lane F's channel E) ────────────────────────────────
const eProblems = []
for (const [k, why] of Object.entries(MISSING_ALLOW)) {
  if (!why || why.trim().length < 40) eProblems.push(`${k}: no written reason`)
  else if (!R.missing.some((m) => key(m) === k)) eProblems.push(`${k}: STALE — allowed, but no longer names a missing member`)
}
for (const [k, why] of Object.entries(DEAD_ALLOW)) {
  if (!why || why.trim().length < 40) eProblems.push(`${k}: no written reason`)
  else if (!R.dead.some((d) => deadKey(d) === k)) eProblems.push(`${k}: STALE — allowed, but the member is called now`)
}
row(
  eProblems.length === 0,
  "E · every ALLOW entry carries a written reason AND still needs the exemption",
  eProblems.length === 0
    ? `${Object.keys(MISSING_ALLOW).length + Object.keys(DEAD_ALLOW).length} entries, all live`
    : eProblems.join(" · "),
)

// ── F · THE NINE CONTROLS, ONE ROW EACH ───────────────────────────────────
//
// This used to be a single aggregate row, with the nine printed individually
// only under `--calibrate`. Channel J read that flag as a withheld judgement
// and it was half right: nothing was withheld — `calibrate()` runs above,
// unconditionally, and the aggregate below it was exit-coupled — but the nine
// separate verdicts really were reachable only by typing a flag, and no runner
// types one. Explainer 36 §6: an arm nobody can read is not worth scheduling.
//
// So the flag is deleted and the nine print as nine. Five are known-bad and
// must be flagged; four are clean and must NOT be. A control set that only ever
// says "no" proves the analyser is loud, not that it is right — which is why
// this reads in both directions and why the row says which direction it is.
row(
  calibBad.length === 0,
  "F · CALIBRATED — the analyser separates a real call from a phantom, BOTH directions",
  calibBad.length === 0 ? `${calib.length}/${calib.length} fixtures` : calibBad.map((c) => c.label).join(" · "),
)
/* ⚠ THE AGGREGATE ROW ABOVE STAYS, AND THE REASON IS NOT TIDINESS.
 *
 * `lib/control-manifest.json` cites this gate's control BY TOKEN, and channel K3
 * checks on every run that the cited token still appears on a line of code.
 * Deleting this row to leave only the nine below took the meta-gate from
 * CALIBRATED 41/41 to NOT CALIBRATED 40/41 — and an uncalibrated
 * `assert-gate-integrity.mjs` REFUSES TO SWEEP, so all eleven channels went
 * dark over one moved line, in a tree with six lanes live and the manifest owned
 * by none of them.
 *
 * That is worth writing down as a property of the system rather than an
 * accident: K3 is calibrated against the LIVE manifest, so any lane that moves a
 * cited control line darkens the whole meta-gate until a different lane lands
 * the replacement entry. Keeping the token alive costs one row. */
for (const c of calib) row(c.ok, `F · ${c.label}`, c.ok ? "" : "the analyser gave the wrong answer on a fixture whose answer is known")

// ── the exemption list PRINTS on every run. A list nobody reads is a list
//    that rots. ─────────────────────────────────────────────────────────────
console.log("── THE EXEMPTIONS, PRINTED (a list nobody reads is a list that rots) ──")
for (const [k, why] of Object.entries(MISSING_ALLOW)) console.log(`  B ${k}\n      ${why}`)
for (const [k, why] of Object.entries(DEAD_ALLOW)) console.log(`  C ${k}\n      ${why}`)
console.log("")
for (const r of rows) console.log(r)

console.log(
  `\n${rows.length - bad}/${rows.length} rows PASS` +
    (bad ? ` — ${bad} RED` : "") +
    `  ·  ${R.surfaces.size} surfaces, ${[...R.surfaces.values()].reduce((a, s) => a + s.members.length, 0)} members, ` +
    `${R.calls.length} references, ${R.dead.length} uncalled (${deadUnallowed.length} unexplained), ` +
    `${R.missing.length} calls naming a member that does not exist (${missingUnallowed.length} unexplained)`,
)
process.exit(bad === 0 ? 0 : 1)
