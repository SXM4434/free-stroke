// ASSERT-ARM-TOOK — did the arm reach the render, or only the transcript?
//
// WHY THIS EXISTS
//
//   Explainer 39 §5 names the hole and predicts the number:
//
//     "No gate enforces rule 1. The meta-gate's channel J asks whether a
//      judgement is withheld behind a flag; nothing asks whether a sweep reads
//      what its own driver returned. That would be a new channel, and it is a
//      real one: twenty-four files would fail it today."
//
//   Rule 1 is explainer 39 §4: "Read what the setter returned. It is one
//   binding. An arm that never reached the render and an arm that reached it and
//   changed nothing print the same number, and only the boolean separates them."
//
//   That is not a hypothetical. `{flat: 0}` is a key that does not exist on
//   `FlatState`; the arm set NOTHING, the frame was identical to the one before
//   it, and the row published "not it" about a path it had never touched
//   (explainer 24 §8). The setter now refuses the object whole and returns
//   `false` — and Lane Q measured that **1 of 28 files reads that answer.**
//
// ── THIS IS AN UNGUARDED EDGE, NOT A FIRE. SAY IT THAT WAY. ────────────────
//
//   The obvious inference from explainer 24 — if one arm typo'd a key, others
//   must too — is WRONG, and Lane Q proved it by reading twenty-five files in
//   full: **no file in the survey passes an invalid key.** `{flat: 0}` was one
//   typo, not a class (explainer 39 §3.3). So nothing in the tree is currently
//   lying because of this. What is missing is the ability to NOTICE when one
//   starts to, and the discipline is already in these files — Lane Q quoted
//   EIGHT of them checking a DIFFERENT control's return on the same run
//   (`assert-carve-graze:152` grades `carveAA()`; `assert-hero-live-shadow:163`
//   throws when `orbitView` refuses). They skipped this one setter for a good
//   reason that expired: `setFlatten` returned `true` unconditionally until
//   2026-08-07, so reading it proved nothing and everybody correctly stopped.
//   The fix landed; the call sites did not hear about it.
//
//   **A validator nobody reads the answer of is a validator that is not running.**
//
// ── WHAT IT ASKS, AND WHY IT PARSES ───────────────────────────────────────
//
//   `run-battery.mjs`'s classifier is the nearest prior art and its lesson is
//   the whole design here: a grep matched a file's RAW TEXT, so a token inside a
//   string, a fixture, or **a comment explaining the rule** decided the answer —
//   "a grep cannot tell code from prose" (`assert-one-knob.mjs:211`, explainer
//   33). This file would fail its own grep on the paragraph above, which names
//   `setFlatten` six times without driving anything. So nothing here is matched
//   on text. Every question is asked of the syntax tree:
//
//     A · THE DRIVER TABLE IS DERIVED FROM THE HARNESS, NEVER COPIED.
//         Every `w.__X = { … }` object literal the app publishes is parsed, each
//         member resolved through at most one hop to its implementation, and a
//         member counts as a DRIVER only if it takes an argument and has a
//         reachable `return false`. A hand-written list is the exact rot
//         explainer 37 §2 records: `assert-texture-motion`'s twelve string
//         literals against a thirteen-member type, where "a mode nobody
//         enumerated is a mode whose animation nobody has ever measured, and it
//         reads identically to a mode that passed." A new validating setter
//         joins this gate's subject the day it lands, with no edit here.
//
//         ── WIDENED 2026-08-07, AND WHY (Lane AB's GAP 3, handed over) ───────
//         This channel used to match ONE name — `n.left.name.text ===
//         "__captureHarness"` — so `__inflateProbe`, `__revealHarness`,
//         `__styleHarness` and the rest were not in its subject at all. AB:
//         *"The moment `setMeshVisible` lands it costs exactly one validating
//         driver, which is a gate whose subject silently excludes a member of
//         the surface it grades."* It landed the same night. A gate scoped by
//         ONE NAME is explainer 43's family pointed at its own subject: the
//         CLAIM is "did the arm read what its driver returned" and the SUBJECT
//         was "…on one of the thirteen objects that publish drivers."
//
//         ── THERE IS NO SECOND LIST, AND CHANNEL E PROVES IT EVERY RUN ──────
//         Two lists of one thing is this repo's most expensive recurring defect
//         (contract §17.5; §17: *"never build a second harness beside the
//         existing one"*). So nothing here NAMES a surface. The rule — every
//         `w.__X = { … }` object literal in the app's own source — is the same
//         rule `assert-harness-surface.mjs` applies, and **channel E spawns that
//         gate and requires the two derivations to name exactly the same
//         surfaces and exactly the same members, BOTH DIRECTIONS, hard fail.**
//
//         Why spawn rather than import, stated rather than hidden: that file
//         exports `publishedSurfaces()` but also RUNS on load and ends in
//         `process.exit(...)`, so `import` kills this process before the symbol
//         is bound — measured, not assumed. The one-line fix that would turn
//         channel E's spawn into a plain import belongs to that file's owner and
//         is written up in this lane's return, not applied here. Until it lands,
//         the duplication that cannot be removed is the duplication that is
//         PROVED EQUAL on every run — and channel E fails loudly if the spawn
//         cannot be made, because a cross-check that can be skipped is not one.
//
//     B · EVERY ARM READS WHAT THE DRIVER RETURNED. An ARM is a site that
//         reaches a driver, directly through `page.evaluate(cb)` or through ONE
//         level of local indirection — the same bounded hop `run-battery.mjs`
//         follows for spawns, "because otherwise the check is defeated by a
//         helper." The boolean has two places to die and both count:
//           · DROPPED AT THE BOUNDARY — the callback never returns it, so it
//             does not leave the page. `() => { h.setFlatten(o); h.setPenTip(m) }`
//             is a block body with no return: two answers, neither asked for.
//           · DROPPED AT THE CALLER — it crosses and lands in an
//             ExpressionStatement, or in a variable nobody reads. A binding
//             nobody reads is not a reading, and counting it would make this
//             gate satisfiable by `const ok =` and nothing else.
//         A boolean tested INSIDE the page passes: `if (!h.setFlatten(o)) throw`
//         is a read, and where it is read is not this gate's business.
//
//     C · THE ALLOW LIST IS HONEST — Lane F's channel E, copied rather than
//         rebuilt. It has already caught three stale entries in real use
//         (explainer 37 §5), which is more than a second implementation of it
//         could claim on day one.
//
//     D · CALIBRATION, BOTH DIRECTIONS, EVERY RUN — before any verdict above is
//         believed. An analyser that has never rejected anything is the disease
//         it is looking for, one level up.
//
// ── THE ALLOW LIST IS THE POINT, NOT AN ESCAPE HATCH ──────────────────────
//
//   Twenty-four failing files cannot be fixed by one lane, and a gate that goes
//   red on arrival for a year is a gate somebody deletes. So the debt is
//   EXEMPTED BY NAME, each entry carrying WHY, and every entry PRINTS on every
//   run — a list nobody reads is a list that rots. A STALE entry, one whose file
//   no longer drops anything, is itself a FAILURE: that is how an exemption list
//   kills the gate that owns it — the file is fixed, the entry stays, and the
//   next arm to land in that file is excused by an argument nobody made about
//   it. Entries whose reason is OWNERSHIP say so and name what retires them.
//
// Usage:
//   node scripts/verify/assert-arm-took.mjs            # the sweep
//   node scripts/verify/assert-arm-took.mjs --list     # every arm, with its verdict
//   node scripts/verify/assert-arm-took.mjs --calibrate  # channel D alone, verbose
import ts from "typescript"
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, relative } from "node:path"
import { tmpdir } from "node:os"
import { spawnSync } from "node:child_process"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const VERIFY = join(ROOT, "scripts", "verify")
const has = (k) => process.argv.includes(`--${k}`)
const argOf = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const rel = (p) => relative(ROOT, p)
/* SCOPE THE SWEEP TO ONE DRIVER. Explainer 39 §5 predicts "twenty-four files
 * would fail it today" — a number taken over `setFlatten` ALONE, because that is
 * the only setter Lane Q surveyed ("Only `setFlatten` was surveyed", its LANE-STATE
 * `:300`). Confirming a prediction means measuring it at the scope it was made
 * at, so `--driver=setFlatten` reproduces exactly that scope and the bare run
 * reports the honest total across every driver the harness exposes. */
let ONLY_DRIVER = argOf("driver", "")

let bad = 0
const rows = []
const row = (ok, what, detail) => {
  if (!ok) bad++
  rows.push(`${ok ? "PASS" : "FAIL"}  ${what}${detail ? `  —  ${detail}` : ""}`)
}

/* ══════════════════════════════════════════════════════════════════════════
 * CHANNEL A · THE DRIVER TABLE, DERIVED
 *
 * A DRIVER is a `__captureHarness` member that (a) takes at least one argument
 * and (b) can return `false`. Both halves matter and each excludes a real
 * member: `penTip()` takes nothing and READS — demanding its return be graded
 * would be a gate that is wrong about a real key, which explainer 24 §8 names
 * as the way a validator "gets deleted the first time it blocks someone".
 * `enable: () => setCaptureMode(true)` takes nothing and returns nothing.
 *
 * The resolution is one hop, and one hop is enough because the harness is
 * written that way throughout: `setPenTip: (m) => setPenTipMode(m)` delegates to
 * `lib/pen-reveal.ts:993`, whose first line is `if (!PEN_TIP_SHAPES[m]) return
 * false`. Anything needing two hops is REPORTED as unresolved rather than
 * guessed at — an unresolved member is not silently dropped from the subject.
 * ══════════════════════════════════════════════════════════════════════════ */

/** The app's own source. NOT a list of publishers — a list of places to look, so a
 *  surface published from a file nobody thought of still joins the subject. */
const APP_DIRS = ["components", "app", "lib", "hooks"].map((d) => join(ROOT, d))
const appSources = () => {
  const out = []
  const w = (dir) => {
    if (!existsSync(dir)) return
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isDirectory()) { if (f !== "node_modules") w(p); continue }
      if (/\.(ts|tsx)$/.test(f)) out.push(p)
    }
  }
  for (const d of APP_DIRS) w(d)
  return out
}
/** Files a one-hop delegate may be resolved in. Read off disk, not assumed. */
const IMPL_FILES = () => {
  const out = []
  const libDir = join(ROOT, "lib")
  const vp = join(ROOT, "components", "viewport-3d.tsx")
  if (existsSync(vp)) out.push(vp)
  if (existsSync(libDir)) {
    for (const f of readdirSync(libDir)) {
      if (f.endsWith(".ts") || f.endsWith(".tsx")) out.push(join(libDir, f))
    }
  }
  /* every file that publishes a surface can also hold its implementations —
   * `__engineHarness`'s live in `app/desk-doodles/page.tsx`, not in `lib/`. */
  for (const p of PUBLISHER_FILES) if (!out.includes(p)) out.push(p)
  return out.filter((p) => existsSync(p))
}

const sourceOf = (p) =>
  ts.createSourceFile(
    p,
    readFileSync(p, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    p.endsWith(".tsx") ? ts.ScriptKind.TSX : p.endsWith(".ts") ? ts.ScriptKind.TS : ts.ScriptKind.JS,
  )

/** Does this function-ish node have a reachable `return false`? */
function returnsFalse(node) {
  let found = false
  const walk = (n) => {
    if (found) return
    if (ts.isReturnStatement(n) && n.expression && n.expression.kind === ts.SyntaxKind.FalseKeyword) {
      found = true
      return
    }
    ts.forEachChild(n, walk)
  }
  if (node) walk(node)
  return found
}

/** The body of a function-like, unwrapping `useCallback(fn, deps)`. */
function bodyOf(node) {
  if (!node) return null
  if (ts.isCallExpression(node) && /useCallback|useMemo/.test(node.expression.getText?.() ?? "")) {
    return bodyOf(node.arguments[0])
  }
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isFunctionDeclaration(node)) return node
  return null
}

/** Find a top-level-ish function by name across the implementation files. */
const IMPL_INDEX = new Map()
function indexImplementations() {
  for (const p of IMPL_FILES()) {
    let sf
    try {
      sf = sourceOf(p)
    } catch {
      continue
    }
    const walk = (n) => {
      if (ts.isFunctionDeclaration(n) && n.name) {
        if (!IMPL_INDEX.has(n.name.text)) IMPL_INDEX.set(n.name.text, { node: n, file: p, sf })
      }
      if (ts.isVariableDeclaration(n) && n.name && ts.isIdentifier(n.name) && n.initializer) {
        const b = bodyOf(n.initializer)
        if (b && !IMPL_INDEX.has(n.name.text)) IMPL_INDEX.set(n.name.text, { node: b, file: p, sf })
      }
      ts.forEachChild(n, walk)
    }
    walk(sf)
  }
}

/**
 * EVERY `w.__X = { … }` LITERAL IN THE APP, and every member of every one of them.
 *
 * The rule is the rule `assert-harness-surface.mjs` applies, and channel E proves the
 * two agree. Nothing here is a name: a surface published from a file nobody thought of
 * joins the subject the day it lands, exactly like a new member of one already here.
 *
 * A UNION, NEVER FIRST-WINS — a global assigned in two branches with two key sets
 * would otherwise have half its surface invisible, which is this file's own subject.
 */
function deriveSurfaces() {
  const surfaces = new Map() // name -> { file, line, members: [] }
  const seen = new Set()
  for (const path of appSources()) {
    let sf
    try { sf = sourceOf(path) } catch { continue }
    const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
    const walk = (n) => {
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isObjectLiteralExpression(n.right)
      ) {
        let name = null
        if (ts.isPropertyAccessExpression(n.left) && n.left.name.text.startsWith("__")) name = n.left.name.text
        else if (
          ts.isElementAccessExpression(n.left) &&
          n.left.argumentExpression &&
          ts.isStringLiteral(n.left.argumentExpression) &&
          n.left.argumentExpression.text.startsWith("__")
        ) name = n.left.argumentExpression.text
        if (name) {
          if (!surfaces.has(name)) surfaces.set(name, { file: path, line: lineOf(n), members: [] })
          const s = surfaces.get(name)
          for (const p of n.right.properties) {
            if (!p.name) continue
            const key = ts.isIdentifier(p.name) || ts.isStringLiteral(p.name) ? p.name.text : null
            if (!key) continue
            if (s.members.some((m) => m.name === key)) continue
            s.members.push(classifyMember(name, key, p, lineOf(p)))
          }
          seen.add(path)
        }
      }
      ts.forEachChild(n, walk)
    }
    walk(sf)
  }
  return { surfaces, publisherFiles: [...seen] }
}

/** Does this member take an argument, and can it answer `false`? */
function classifyMember(surface, name, p, line) {
  let fn = null
  let via = "inline"
  if (ts.isPropertyAssignment(p)) fn = bodyOf(p.initializer)
  if (!fn) {
    // `orbitView: apiOrbitView` / shorthand — resolve the identifier, one hop.
    const idName = ts.isPropertyAssignment(p) && ts.isIdentifier(p.initializer) ? p.initializer.text : ts.isShorthandPropertyAssignment(p) ? name : null
    if (idName && IMPL_INDEX.has(idName)) {
      fn = IMPL_INDEX.get(idName).node
      via = `-> ${idName}`
    }
  }
  if (!fn) {
    /* A PAYLOAD KEY IS NOT AN UNRESOLVED DELEGATE, AND CONFLATING THEM MAKES THE
     * WARNING USELESS. `__letterSeam.spanningBefore: 3` is a number: it cannot be a
     * driver and there is nothing to resolve. Only an IDENTIFIER or a shorthand that
     * failed to resolve is genuinely unresolved — the case where a driver may be
     * hiding behind a name this file could not follow, which must stay loud. */
    const init = ts.isPropertyAssignment(p) ? p.initializer : null
    const isDelegate = ts.isShorthandPropertyAssignment(p) || (!!init && ts.isIdentifier(init))
    return isDelegate
      ? { surface, name, line, params: 0, validating: false, via: "UNRESOLVED", unresolved: true }
      : { surface, name, line, params: 0, validating: false, via: "value — not a function" }
  }
  const params = (fn.parameters ?? []).length
  let validating = returnsFalse(fn.body ?? fn)
  // one hop: `setPenTip: (m) => setPenTipMode(m)`
  if (!validating && ts.isArrowFunction(fn) && fn.body && ts.isCallExpression(fn.body)) {
    const callee = fn.body.expression
    const idName = ts.isIdentifier(callee) ? callee.text : null
    if (idName && IMPL_INDEX.has(idName)) {
      const impl = IMPL_INDEX.get(idName)
      if (returnsFalse(impl.node.body ?? impl.node)) {
        validating = true
        via = `-> ${idName}() in ${rel(impl.file)}`
      }
    }
  }
  return { surface, name, line, params, validating, via }
}

/* THE ORDER MATTERS AND IT BIT ONCE: `classifyMember` reads `IMPL_INDEX`, and
 * `IMPL_FILES()` reads `PUBLISHER_FILES`, so the publishers are discovered FIRST with
 * a bare literal walk, then the implementations are indexed, then the members are
 * classified against them. A single pass classified every delegating member as
 * UNRESOLVED against an empty index. */
const PUBLISHER_FILES = []
{
  for (const path of appSources()) {
    let sf
    try { sf = sourceOf(path) } catch { continue }
    let hit = false
    const w = (n) => {
      if (hit) return
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isObjectLiteralExpression(n.right) &&
        ((ts.isPropertyAccessExpression(n.left) && n.left.name.text.startsWith("__")) ||
          (ts.isElementAccessExpression(n.left) && n.left.argumentExpression && ts.isStringLiteral(n.left.argumentExpression) && n.left.argumentExpression.text.startsWith("__")))
      ) hit = true
      ts.forEachChild(n, w)
    }
    w(sf)
    if (hit) PUBLISHER_FILES.push(path)
  }
}
indexImplementations()
const SURFACES = deriveSurfaces().surfaces
const ALL_MEMBERS = [...SURFACES.values()].flatMap((s) => s.members)
const HARNESS = {
  members: ALL_MEMBERS,
  error:
    SURFACES.size === 0
      ? "no `w.__X = { … }` object literal found anywhere in the app's source"
      : ALL_MEMBERS.length === 0
        ? "surfaces were found but not one member was read off them"
        : null,
}
const DRIVERS = ALL_MEMBERS.filter((m) => m.validating && m.params >= 1)
const DRIVER_NAMES = new Set(DRIVERS.map((m) => m.name))
/** member name -> the surface(s) that publish it, for the report. */
const DRIVER_SURFACES = new Map()
for (const d of DRIVERS) {
  if (!DRIVER_SURFACES.has(d.name)) DRIVER_SURFACES.set(d.name, [])
  DRIVER_SURFACES.get(d.name).push(d.surface)
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE ARM ANALYSER
 *
 * `useOf(node)` answers ONE question — what happens to this expression's value —
 * and it is the whole gate. Everything else is plumbing.
 * ══════════════════════════════════════════════════════════════════════════ */

/** Climb past the wrappers that do not change what happens to a value. */
function effectiveParent(n) {
  let cur = n
  let p = cur.parent
  while (p && (ts.isAwaitExpression(p) || ts.isParenthesizedExpression(p) || ts.isAsExpression?.(p) || ts.isNonNullExpression(p))) {
    cur = p
    p = cur.parent
  }
  return { node: cur, parent: p }
}

/** Is `name` referenced anywhere in `scope` other than at `declNode`? */
function isReferenced(scope, name, declNode) {
  let hits = 0
  const walk = (n) => {
    if (ts.isIdentifier(n) && n.text === name && n !== declNode) hits++
    ts.forEachChild(n, walk)
  }
  walk(scope)
  return hits > 0
}

/**
 * What happens to this expression's value?
 *   "dropped"   — thrown away (an ExpressionStatement, or bound and never read)
 *   "read"      — tested, passed on, interpolated, destructured, awaited-into-use
 *   "returned"  — handed to the enclosing function's caller
 */
function useOf(node, scope) {
  const { node: cur, parent: p } = effectiveParent(node)
  if (!p) return { kind: "dropped", why: "no parent" }

  if (ts.isExpressionStatement(p)) return { kind: "dropped", why: "bare expression statement" }
  if (ts.isReturnStatement(p)) return { kind: "returned", why: "returned" }

  if (ts.isVariableDeclaration(p) && p.initializer === cur) {
    if (ts.isIdentifier(p.name)) {
      const nm = p.name.text
      if (!isReferenced(scope, nm, p.name)) {
        return { kind: "dropped", why: `bound to \`${nm}\` and never read — a binding nobody reads is not a reading` }
      }
      // is it returned, or read?
      return { kind: "read", why: `bound to \`${nm}\`, which is read`, binding: nm }
    }
    // destructuring counts as a read
    return { kind: "read", why: "destructured" }
  }

  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && p.right === cur) {
    if (ts.isIdentifier(p.left)) {
      const nm = p.left.text
      if (!isReferenced(scope, nm, p.left)) return { kind: "dropped", why: `assigned to \`${nm}\` and never read` }
      return { kind: "read", why: `assigned to \`${nm}\`, which is read` }
    }
    return { kind: "read", why: "assigned" }
  }

  if (
    ts.isIfStatement(p) ||
    ts.isWhileStatement(p) ||
    ts.isConditionalExpression(p) ||
    ts.isPrefixUnaryExpression(p) ||
    ts.isBinaryExpression(p) ||
    ts.isCallExpression(p) ||
    ts.isTemplateSpan(p) ||
    ts.isArrayLiteralExpression(p) ||
    ts.isPropertyAssignment(p) ||
    ts.isThrowStatement(p) ||
    ts.isPropertyAccessExpression(p)
  ) {
    return { kind: "read", why: ts.isCallExpression(p) ? "passed as an argument" : "tested or consumed in an expression" }
  }

  if (ts.isArrowFunction(p) && p.body === cur) return { kind: "returned", why: "concise arrow body" }

  return { kind: "read", why: `consumed by ${ts.SyntaxKind[p.kind]}` }
}

/** The named function that encloses `n`, if it has a name we can call. */
function enclosingNamedFn(n) {
  let p = n.parent
  while (p) {
    if (ts.isFunctionDeclaration(p) && p.name) return { name: p.name.text, node: p }
    if (
      (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
      p.parent &&
      ts.isVariableDeclaration(p.parent) &&
      p.parent.initializer === p &&
      ts.isIdentifier(p.parent.name)
    ) {
      return { name: p.parent.name.text, node: p }
    }
    p = p.parent
  }
  return null
}

/* ── A CLEAR IS NOT AN ARM, AND THIS IS A SUBJECT BOUNDARY, NOT AN EXEMPTION ──
 *
 * `setFlatten(null)` means CLEAR — the documented contract explainer 24 §8 item 3
 * insists on keeping ("callers rely on it") — and `isValidFlatState` opens with
 * `if (o === null || o === undefined) return true` (`viewport-3d.tsx:1388`,
 * read first-hand, not assumed). `setPenTipShape(null)` is the same shape:
 * `if (s === null) { livePenTipShapeOverride = null; return true }`
 * (`lib/pen-reveal.ts:1031-1033`).
 *
 * So a clear CANNOT come back `false`. Requiring a caller to grade an answer
 * that has exactly one possible value would be a row that cannot fail — the lie
 * this repo is organised around — pointed at the teardown rather than the arm.
 * It is also how a real gate dies: explainer 37 §3 records channel F going "red
 * on day one, on a file that is not violating anything," and being switched off
 * on day two. Clears are COUNTED AND PRINTED, never silently skipped.
 */
const isNullClear = (call) =>
  call.arguments.length === 1 && call.arguments[0].kind === ts.SyntaxKind.NullKeyword

/** Driver calls anywhere in a node — `<anything>.setFlatten(…)`, never a bare identifier. */
function driverCallsIn(node) {
  const out = []
  const walk = (n) => {
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      DRIVER_NAMES.has(n.expression.name.text) &&
      (!ONLY_DRIVER || n.expression.name.text === ONLY_DRIVER)
    ) {
      out.push({ call: n, driver: n.expression.name.text, clear: isNullClear(n) })
    }
    ts.forEachChild(n, walk)
  }
  walk(node)
  return out
}

/** The function-like that lexically encloses `n`. */
function enclosingFn(n) {
  let p = n.parent
  while (p) {
    if (ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p)) return p
    p = p.parent
  }
  return null
}

/** The name a function-like is reachable by, if any. */
function nameOfFn(fn) {
  if (ts.isFunctionDeclaration(fn) && fn.name) return fn.name.text
  if (
    fn.parent &&
    ts.isVariableDeclaration(fn.parent) &&
    fn.parent.initializer === fn &&
    ts.isIdentifier(fn.parent.name)
  ) {
    return fn.parent.name.text
  }
  return null
}

/** Is this call `<something>.evaluate(...)` / `.evaluateHandle(...)`? */
const isEvaluateCall = (n) =>
  ts.isCallExpression(n) &&
  ts.isPropertyAccessExpression(n.expression) &&
  /^evaluate(Handle)?$/.test(n.expression.name.text)

/**
 * WHERE DOES THIS FUNCTION'S RESULT SHOW UP? — the hop, in three shapes.
 *
 * All three are ONE level of local indirection, the same bound `run-battery.mjs`
 * puts on its spawn chain "because otherwise the check is defeated by a helper."
 * The third shape is the one a `page.evaluate`-shaped analyser cannot see, and
 * it is not hypothetical: `_probe-lane3-blank-tail.mjs` hands every one of its
 * eight OFAT arms to a local `run(name, setup, teardown)` helper, which does
 * `if (setup) await page.evaluate(setup)` and discards the answer. An analyser
 * that only looked INSIDE `page.evaluate(...)` argument lists reported that file
 * as having no arms at all — measured here, on this gate's first draft, which is
 * why the shape is enumerated rather than assumed.
 */
function resultSitesOf(fn, sf) {
  const out = []
  const parent = fn.parent

  //  ① the function IS the callback of `page.evaluate(cb)` — its result is the
  //     evaluate call's result. The boundary crossing is a hop like any other.
  if (parent && isEvaluateCall(parent) && parent.arguments[0] === fn) {
    return [{ node: parent, crossed: true, via: "across the page.evaluate boundary" }]
  }

  //  ② it has a name — every call of that name is a site.
  const nm = nameOfFn(fn)
  if (nm) {
    const walk = (n) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === nm) out.push({ node: n, crossed: false, via: `via \`${nm}()\`` })
      ts.forEachChild(n, walk)
    }
    walk(sf)
    if (out.length) return out
  }

  //  ③ it is argument #k of a call to a LOCAL named helper — follow into the
  //     helper, find parameter #k, and ask what the helper does with it.
  if (parent && ts.isCallExpression(parent) && ts.isIdentifier(parent.expression)) {
    const helperName = parent.expression.text
    const k = parent.arguments.indexOf(fn)
    let helper = null
    const findHelper = (n) => {
      if (helper) return
      if (ts.isFunctionDeclaration(n) && n.name?.text === helperName) helper = n
      if (
        ts.isVariableDeclaration(n) &&
        ts.isIdentifier(n.name) &&
        n.name.text === helperName &&
        n.initializer &&
        (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))
      ) {
        helper = n.initializer
      }
      ts.forEachChild(n, findHelper)
    }
    findHelper(sf)
    if (helper && k >= 0 && helper.parameters[k] && ts.isIdentifier(helper.parameters[k].name)) {
      const pname = helper.parameters[k].name.text
      const sites = []
      const walk = (n) => {
        //  `page.evaluate(param)` — the helper hands the callback across
        if (isEvaluateCall(n) && n.arguments[0] && ts.isIdentifier(n.arguments[0]) && n.arguments[0].text === pname) {
          sites.push({ node: n, crossed: true, via: `via \`${helperName}()\`, which hands it to page.evaluate` })
        }
        //  `param()` — the helper calls it directly
        else if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === pname) {
          sites.push({ node: n, crossed: false, via: `via \`${helperName}()\`, which calls it` })
        }
        ts.forEachChild(n, walk)
      }
      walk(helper)
      if (sites.length) return sites
    }
  }

  return []
}

const MAX_HOPS = 3

/**
 * Follow one driver call's answer until it is READ or LOST.
 *
 * Returns one row per place the answer ends up, because a helper fans out:
 * `_probe-drawin-holes.mjs` reaches `setFlatten` through one `setFlat()` from
 * five different arms, and five arms that each drop an answer is five findings,
 * not one.
 */
function followValue(node, sf, lineOf, depth, crossed, trail) {
  const u = useOf(node, sf)
  const where = crossed ? "DROPPED-AT-CALLER" : "DROPPED-AT-BOUNDARY"
  const prefix = trail.length ? trail.join(" → ") + " → " : ""

  if (u.kind === "read") return [{ line: lineOf(node), verdict: "READ", why: `${prefix}${u.why}` }]
  if (u.kind === "dropped") {
    return [
      {
        line: lineOf(node),
        verdict: where,
        why: crossed
          ? `${prefix}${u.why}`
          : `${prefix}${u.why} — the answer never leaves the page`,
      },
    ]
  }

  // returned: hop.
  if (depth >= MAX_HOPS) return [{ line: lineOf(node), verdict: "UNRESOLVED", why: `${prefix}returned beyond ${MAX_HOPS} hops — REPORTED, never guessed at` }]
  const fn = enclosingFn(node)
  if (!fn) return [{ line: lineOf(node), verdict: "UNRESOLVED", why: `${prefix}returned from no enclosing function` }]
  const sites = resultSitesOf(fn, sf)
  if (!sites.length) {
    return [
      {
        line: lineOf(node),
        verdict: "UNRESOLVED",
        why: `${prefix}returned from ${nameOfFn(fn) ? `\`${nameOfFn(fn)}\`` : "an anonymous function"} whose result goes somewhere this cannot follow`,
      },
    ]
  }
  return sites.flatMap((s) => followValue(s.node, sf, lineOf, depth + 1, crossed || s.crossed, [...trail, s.via]))
}

/**
 * Every ARM in a file, with its verdict.
 *
 * Driver calls are found ANYWHERE in the file, not only inside a
 * `page.evaluate(...)` argument list — see `resultSitesOf` shape ③ for the file
 * that made that difference measurable.
 */
function armsIn(file) {
  const src = readFileSync(file, "utf8")
  let sf
  try {
    sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  } catch (e) {
    return { arms: [], unparseable: String(e).slice(0, 120) }
  }
  const lineOf = (n) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
  const arms = []
  for (const { call, driver, clear } of driverCallsIn(sf)) {
    if (clear) {
      arms.push({
        line: lineOf(call),
        driver,
        verdict: "CLEAR",
        why: "`null` means clear and cannot be refused — grading this answer would be a row that cannot fail",
      })
      continue
    }
    for (const r of followValue(call, sf, lineOf, 0, false, [])) arms.push({ ...r, driver })
  }
  return { arms }
}

/* ── the sweep's file set ──────────────────────────────────────────────────
 * `scripts/verify/**` is the survey's scope and where every arm in the repo
 * lives. `lib/gate-fixtures` is skipped: a fixture is an input, not a subject. */
function sweepFiles(dir = VERIFY) {
  const out = []
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      if (e.isDirectory()) {
        if (e.name === "gate-fixtures" || e.name === "node_modules") continue
        walk(join(d, e.name))
      } else if (e.name.endsWith(".mjs")) {
        out.push(join(d, e.name))
      }
    }
  }
  walk(dir)
  return out.sort()
}

/* ══════════════════════════════════════════════════════════════════════════
 * THE ALLOW LIST — Lane F's mechanism, copied (assert-one-knob.mjs:155-186)
 *
 * Every entry costs one honest sentence. An entry with no reason fails channel
 * C, and so does an entry whose file no longer drops anything. Entries reading
 * OWNERSHIP, NOT JUDGEMENT are TEMPORARY by construction and name what retires
 * them — explainer 28 §4, quoted in 37 §5: "They are meant to expire, and
 * channel E is what notices when they have."
 * ══════════════════════════════════════════════════════════════════════════ */
const ALLOW = {

  /* ── THE 23 GATES. A gate that drops a driver's answer prints a VERDICT off an
   * arm that may never have reached the render, so these are the sharper half of
   * the debt and they are listed first. ──────────────────────────────────────── */
  "scripts/verify/assert-carve-graze.mjs": { arms: 3, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 3 arm(s) drive setCarveAA, setFlatten and drop the answer (first at :139; 1 never leave the page). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-draft-taper.mjs": { arms: 1, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive orbitView and drop the answer (first at :187). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-drawin-timing.mjs": { arms: 38, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 38 arm(s) drive orbitView and drop the answer (first at :227). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-flat-silhouette.mjs": { arms: 1, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :129). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-fusion-authoring.mjs": { arms: 2, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive frontView, orbitView and drop the answer (first at :801). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-geometry-presets.mjs": { arms: 5, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 5 arm(s) drive frontView, orbitView and drop the answer (first at :176). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-hero-flatstate.mjs": { arms: 3, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 3 arm(s) drive orbitView, setFlatten and drop the answer (first at :165). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-hero-k7-news.mjs": { arms: 1, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :189). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-hero-switch.mjs": { arms: 1, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :370). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-joint-beading.mjs": { arms: 4, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 4 arm(s) drive focusView, orbitView and drop the answer (first at :245). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. RAISED FROM 2 TO 4 ON 2026-09-04, and the two new ones are lane D1's blank-guard calibration at :427: it aims focusView 3R off the form and REQUIRES the blank guard to throw. A refusal there IS caught, just indirectly — the camera would not move, the frame would still hold ink, the guard would not fire and guardFired stays false, so the row fails. That is weaker than reading the boolean and it is why this stays an exemption rather than a pass. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-layer-flicker.mjs": { arms: 2, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive frontView and drop the answer (first at :906). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-letter-seam.mjs": { arms: 2, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive setLetterSettle, setLetterWholeTriangles and drop the answer (first at :177). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-pen-carve.mjs": { arms: 1, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :228). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-pen-field-alloc.mjs": { arms: 3, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 3 arm(s) drive setFieldRealloc, setFlatten and drop the answer (first at :177). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-preset-pixels.mjs": { arms: 1, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :324). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-preset-routing.mjs": { arms: 4, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 4 arm(s) drive frontView, orbitView and drop the answer (first at :374). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-register-light.mjs": { arms: 4, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 4 arm(s) drive orbitView and drop the answer (first at :362). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-rod-caps.mjs": { arms: 2, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive orbitView and drop the answer (first at :115). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-stroke-schedule.mjs": { arms: 17, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 17 arm(s) drive frontView, setFlatten, setFlattenValidates, setPenTip, setTipFieldBake, setTipRidesSchedule, setTipTrailsWindow and drop the answer (first at :698; 5 never leave the page). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-taper-envelope.mjs": { arms: 1, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive orbitView and drop the answer (first at :266). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-texture-motion.mjs": { arms: 1, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :97). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-texture-relief.mjs": { arms: 1, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :90). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/assert-view-presets.mjs": { arms: 3, why: "A GATE — OWNERSHIP, NOT JUDGEMENT. 3 arm(s) drive orbitView and drop the answer (first at :184). A gate that drops a driver's answer prints a VERDICT off an arm that may never have reached the render, which is the sharper half of this debt. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },

  /* ── FOUR GATES THAT THIS CHANNEL COULD NOT SEE UNTIL 2026-08-07, and every one
   * of them is a GATE. They drive `__styleHarness` and `__inflateProbe`, which were
   * outside the subject while channel A matched `__captureHarness` by name (Lane AB
   * GAP 3). Nothing in these files changed; the gate's subject did. That is worth
   * saying plainly, because a debt that appears the day the instrument widens is not
   * a regression and must not be read as one — it is the part of the population that
   * was never counted. All four are BROWSER files, which Lane V holds. ─────────── */
  "scripts/verify/assert-data-safety.mjs": { arms: 1, why: "A GATE, AND NEW TO THIS CHANNEL'S SUBJECT — OWNERSHIP, NOT JUDGEMENT. :1162 drives `__styleHarness.selectGeometryPreset` across the page.evaluate boundary into a bare expression statement, so a preset that REFUSED and a preset that applied print the same rows underneath it. `__styleHarness` (app/page.tsx:1313, 31 members, 3 validating drivers) entered this gate's subject on 2026-08-07 when channel A stopped matching one surface by name. Lane V holds every browser file. REMOVE THIS ENTRY once that arm reads the boolean." },
  "scripts/verify/assert-fusion-bundle-fresh.mjs": { arms: 1, why: "A GATE, AND THE DISCIPLINE IS ALREADY IN THE FILE — OWNERSHIP, NOT JUDGEMENT. :84 binds `took` and reads it, :100 binds `refused` and reads it, and :119 drives the same `__styleHarness.selectFusionCombo` into a bare expression statement. Two arms out of three grade the answer, which makes this the cheapest of the four to retire and the clearest evidence that the rule is understood here. Lane V holds every browser file. REMOVE THIS ENTRY once :119 reads the boolean like its two neighbours." },
  "scripts/verify/assert-fusion-combo-ui.mjs": { arms: 1, why: "A GATE, AND NEW TO THIS CHANNEL'S SUBJECT — OWNERSHIP, NOT JUDGEMENT. :234 drives `__styleHarness.selectFusionCombo` across the boundary into a bare expression statement. A combo that was refused and a combo that applied and changed nothing produce the same UI census below it, and only the boolean separates them — explainer 25's duplicate-cell finding is what that costs. Lane V holds every browser file. REMOVE THIS ENTRY once that arm reads the boolean." },
  "scripts/verify/assert-shell-states.mjs": { arms: 2, why: "A GATE, AND THE ONLY ONE OF THE FOUR WITH MORE THAN ONE — OWNERSHIP, NOT JUDGEMENT. :492 and :501 both drive `__styleHarness.selectViewPreset` into bare expression statements, so every shell-state verdict below them is taken at a view the gate never confirmed it reached. Lane V holds every browser file. REMOVE THIS ENTRY once both arms read the boolean; the ceiling of 2 goes red if a third lands first." },

  /* ── THE 73 CAPTURE TOOLS. These file evidence rather than publish verdicts,
   * so a dropped answer mis-attributes a FRAME rather than a ROW. ───────────── */
  "scripts/verify/_diag.mjs": { arms: 3, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 3 arm(s) drive frontView, orbitView and drop the answer (first at :67). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-brown-decile.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive orbitView and drop the answer (first at :302). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-carve-amplitude.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :132). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-carve-envelope-recal.mjs": { arms: 4, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 4 arm(s) drive setCarveEnvelope, setFieldRealloc, setFlatten and drop the answer (first at :135). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-carve-film.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :93). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-carve-gpu-readback.mjs": { arms: 6, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 6 arm(s) drive setCarveDebug, setCarveHard, setFlatten and drop the answer (first at :256). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-carve-isolate.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :68). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-carve-preview.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :95). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-carve-sweep-live.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive setFlatten and drop the answer (first at :201). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-corner-frames.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive focusView and drop the answer (first at :122). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-dither-collapse.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :157). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-eraser-ab.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFieldRealloc and drop the answer (first at :64). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-field-alloc.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFieldRealloc and drop the answer (first at :44). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-fusion-combo-liveness.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive orbitView and drop the answer (first at :258). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-fusion-sheet.mjs": { arms: 4, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 4 arm(s) drive frontView, orbitView and drop the answer (first at :83). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-fusion-two-dead.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive orbitView and drop the answer (first at :283; 1 never leave the page). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-grain-triplanar.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :103). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-hero-pool-projection.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive orbitView, setFlatten and drop the answer (first at :98). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-hero-pool.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive setFlatten and drop the answer (first at :33). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-k7-smoke.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :84). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-k7-zoom.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :63). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-lane1-blank-tail.mjs": { arms: 3, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 3 arm(s) drive setFlatten, setPenTip and drop the answer (first at :189). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-lane1-cascade-diff.mjs": { arms: 4, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 4 arm(s) drive setLetterSettle, setLetterWholeTriangles and drop the answer (first at :149; 2 never leave the page). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-lane1-seam-picture.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setLetterWholeTriangles and drop the answer (first at :210). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-lane3-attrs.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setPenTipShape and drop the answer (first at :122). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-lane3-margin.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setPenTipShape and drop the answer (first at :140). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-lane3-tris.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setPenTipShape and drop the answer (first at :127). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-lane7-tex.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :56). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-laned-halves.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive setLetterStampFollowsRefill, setRefillDropsStaleAttrs and drop the answer (first at :176; 2 never leave the page). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-laned-ofat.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive orbitView, setFlatten and drop the answer (first at :337). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-pentip-lab3d.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setPenTip and drop the answer (first at :183). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-pentip-shape.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setTipAA and drop the answer (first at :315; 1 never leave the page). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-pentip-smoke.mjs": { arms: 3, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 3 arm(s) drive setPenTip and drop the answer (first at :172). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-pentip-sweep.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive setPenTip and drop the answer (first at :224). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-pentip-zoom.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive setPenTip and drop the answer (first at :132). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-relief-origin.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :89). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-relief-sheet.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :132). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-relief-sweep.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive frontView and drop the answer (first at :156). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-rim-crops.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive focusView and drop the answer (first at :137). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-rod-default.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive orbitView and drop the answer (first at :30). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-rod-loop.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive orbitView and drop the answer (first at :44). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-stroke-schedule.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive frontView and drop the answer (first at :204). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-word-frame.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :62; 1 never leave the page). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe-word-ladder.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :177). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :18). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/_probe3.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :18). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/geometry-baseline.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :150). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/judge-fusion.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :128). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-deskdoodles-ink.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive orbitView and drop the answer (first at :130). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-elbow.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive focusView and drop the answer (first at :189). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-engine-ab.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive orbitView and drop the answer (first at :211). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-form-orbit.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive orbitView and drop the answer (first at :149). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-gloss-rim.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive focusView, orbitView and drop the answer (first at :232). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-handfeel.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive orbitView and drop the answer (first at :132). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-hero-k7-film.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive setFlatten and drop the answer (first at :108). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-inflate-fusion.mjs": { arms: 9, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 9 arm(s) drive frontView, orbitView and drop the answer (first at :189). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-live.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :84). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-marquee-bulbs.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :108). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-material-craft.mjs": { arms: 3, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 3 arm(s) drive frontView, orbitView and drop the answer (first at :158). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-pen-kinematics.mjs": { arms: 4, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 4 arm(s) drive orbitView and drop the answer (first at :138). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-register-light.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive orbitView and drop the answer (first at :77). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-rod-banding.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive orbitView and drop the answer (first at :137). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-rod-segments.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive focusView, orbitView and drop the answer (first at :150). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-screen-layers.mjs": { arms: 3, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 3 arm(s) drive frontView and drop the answer (first at :275). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-seam-frames.mjs": { arms: 2, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 2 arm(s) drive focusView, orbitView and drop the answer (first at :174). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-solid-rim.mjs": { arms: 4, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 4 arm(s) drive focusView, orbitView and drop the answer (first at :105). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-stack-anim.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :91). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-stack.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :39). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-style-craft.mjs": { arms: 3, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 3 arm(s) drive frontView, orbitView and drop the answer (first at :137). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-style.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :106). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-timing-note.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :182). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-timing-origin.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :139). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
  "scripts/verify/verify-timing.mjs": { arms: 1, why: "A CAPTURE TOOL — OWNERSHIP, NOT JUDGEMENT. 1 arm(s) drive frontView and drop the answer (first at :70). A tool files EVIDENCE rather than a verdict, so a dropped answer here mis-attributes a frame instead of publishing a row — real, and one rung below a gate. Not this lane's file. REMOVE THIS ENTRY once its arms read the boolean." },
}

/* ══════════════════════════════════════════════════════════════════════════
 * CHANNEL D · CALIBRATION — every run, before any verdict above is believed
 *
 * Both directions on a synthetic pair AND on the tree's own files, because a
 * synthetic set proves only that the analyser agrees with whoever wrote it.
 * Written to a TEMP DIR and deleted: nothing lands under scripts/verify, where
 * a stray `.mjs` becomes somebody else's sweep's problem.
 * ══════════════════════════════════════════════════════════════════════════ */
const FIXTURES = {
  "drops-at-caller.mjs": {
    want: "DROPPED-AT-CALLER",
    src: `await page.evaluate((v) => window.__captureHarness.setFlatten(v), { jointBreak: 0 })\n`,
  },
  "drops-at-boundary.mjs": {
    want: "DROPPED-AT-BOUNDARY",
    src: `const ok = await page.evaluate(() => { window.__captureHarness.setFlatten({ ink: 0 }) })\nif (!ok) process.exit(1)\n`,
  },
  "binds-and-never-reads.mjs": {
    want: "DROPPED-AT-CALLER",
    src: `const took = await page.evaluate((v) => window.__captureHarness.setFlatten(v), { ink: 0 })\n`,
  },
  "reads-at-caller.mjs": {
    want: "READ",
    src: `const ok = await page.evaluate((v) => window.__captureHarness.setFlatten(v), { ink: 0 })\nif (!ok) throw new Error("refused")\n`,
  },
  "reads-in-page.mjs": {
    want: "READ",
    src: `await page.evaluate((v) => { if (!window.__captureHarness.setFlatten(v)) throw new Error("refused") }, { ink: 0 })\n`,
  },
  "reads-through-a-helper.mjs": {
    want: "READ",
    src: `const setFlat = (o) => page.evaluate((oo) => window.__captureHarness.setFlatten(oo), o)\nconst ok = await setFlat({ ink: 0 })\nif (!ok) throw new Error("refused")\n`,
  },
  "drops-through-a-helper.mjs": {
    want: "DROPPED-AT-CALLER",
    src: `const setFlat = (o) => page.evaluate((oo) => window.__captureHarness.setFlatten(oo), o)\nawait setFlat({ jointBreak: 0 })\n`,
  },
  /* SHAPE ③ — the callback handed to a local helper. This pair exists because
   * the FIRST draft of this gate looked only inside `page.evaluate(...)`
   * argument lists and reported `_probe-lane3-blank-tail.mjs` — a file with
   * EIGHT OFAT arms — as having no arms at all. An analyser scoped by a
   * description of the problem rather than by the problem, which is the exact
   * sentence explainer 37 §7 ends on. */
  "helper-callback-dropped.mjs": {
    want: "DROPPED-AT-CALLER",
    src: `const run = async (name, setup) => { if (setup) await page.evaluate(setup) }\nawait run("break OFF", () => window.__captureHarness.setFlatten({ jointBreak: 0 }))\n`,
  },
  "helper-callback-read.mjs": {
    want: "READ",
    src: `const run = async (name, setup) => { const ok = await page.evaluate(setup); if (!ok) throw new Error(name) }\nawait run("break OFF", () => window.__captureHarness.setFlatten({ jointBreak: 0 }))\n`,
  },
  "a-null-clear-is-not-an-arm.mjs": {
    want: "CLEAR",
    src: `await page.evaluate(() => window.__captureHarness.setFlatten(null))\n`,
  },
  "mentions-a-driver-in-prose.mjs": {
    want: null, // no arms at all
    src: `// This file talks about window.__captureHarness.setFlatten at length and\n// drives nothing. A grep calls it an arm; a parser does not.\nconst NOTE = "setFlatten returns false on a key that cannot exist"\nconsole.log(NOTE)\n`,
  },
  "a-reader-is-not-a-driver.mjs": {
    want: null,
    src: `const tip = await page.evaluate(() => window.__captureHarness.penTip())\nconsole.log(tip)\n`,
  },
}

function calibrate() {
  const out = []
  const dir = mkdtempSync(join(tmpdir(), "arm-took-"))
  /* CALIBRATION IS NEVER SCOPED. `--driver=` narrows the SWEEP so a prediction
   * can be checked at the scope it was made at; narrowing the calibration too
   * would let a scoped run report a green analyser it never exercised. */
  const savedScope = ONLY_DRIVER
  ONLY_DRIVER = ""
  try {
    for (const [name, { want, src }] of Object.entries(FIXTURES)) {
      const p = join(dir, name)
      writeFileSync(p, src)
      const { arms } = armsIn(p)
      if (want === null) {
        out.push({
          ok: arms.length === 0,
          what: `${name.padEnd(30)} -> no arm`,
          detail: arms.length ? `*** ${arms.length} arm(s) found: ${arms.map((a) => a.verdict).join(", ")} ***` : "a driver named in prose, and a READER driven, are both correctly invisible",
        })
        continue
      }
      const got = arms.map((a) => a.verdict)
      out.push({
        ok: arms.length > 0 && got.every((g) => g === want),
        what: `${name.padEnd(30)} -> ${want}`,
        detail: arms.length ? `got ${got.join(", ")} — ${arms[0].why}` : "*** NO ARM DETECTED — the analyser is blind here ***",
      })
    }
  } finally {
    ONLY_DRIVER = savedScope
    rmSync(dir, { recursive: true, force: true })
  }
  return out
}

/* ══════════════════════════════════════════════════════════════════════════
 * RUN
 * ══════════════════════════════════════════════════════════════════════════ */

console.log("=== ASSERT-ARM-TOOK — did the arm reach the render, or only the transcript? ===\n")

/* ── A · the derived driver table, across EVERY published surface ────────── */
console.log(
  `--- the DRIVER table, derived from EVERY \`w.__X = { … }\` literal in ` +
    `${PUBLISHER_FILES.length} publisher file(s): ${PUBLISHER_FILES.map(rel).join(", ")} ---`,
)
if (HARNESS.error) console.log(`  🔴 ${HARNESS.error}`)
for (const [name, s] of SURFACES) {
  const d = s.members.filter((m) => m.validating && m.params >= 1)
  console.log(
    `  ${name.padEnd(24)} ${rel(s.file)}:${s.line}  ${String(s.members.length).padStart(3)} members  ` +
      `${d.length ? `${d.length} DRIVER(S): ${d.map((m) => m.name).join(", ")}` : "no validating driver"}`,
  )
}
console.log("")
for (const m of DRIVERS) console.log(`  DRIVER   ${m.surface}.${m.name.padEnd(24)} :${String(m.line).padEnd(6)} ${m.via}`)
const nonDrivers = HARNESS.members.filter((m) => !(m.validating && m.params >= 1))
console.log(
  `  …and ${nonDrivers.length} member(s) that are NOT drivers (no argument, or no reachable \`return false\`) — ` +
    `readers like \`penTip()\` are deliberately out of scope`,
)
const unresolved = HARNESS.members.filter((m) => m.unresolved)
if (unresolved.length) console.log(`  ⚠ ${unresolved.length} UNRESOLVED member(s), REPORTED not guessed at: ${unresolved.slice(0, 12).map((m) => `${m.surface}.${m.name} (:${m.line})`).join(", ")}${unresolved.length > 12 ? " …" : ""}`)
console.log("")

row(
  !HARNESS.error && HARNESS.members.length > 0,
  "A · every published surface's object literal was PARSED, not grepped",
  HARNESS.error
    ? `*** ${HARNESS.error} ***`
    : `${SURFACES.size} surface(s), ${HARNESS.members.length} members read off the syntax tree, across ${PUBLISHER_FILES.length} publisher file(s)`,
)
row(
  DRIVERS.length > 0,
  "A · …and at least one member is a VALIDATING driver",
  `${DRIVERS.length} driver(s) on ${new Set(DRIVERS.map((d) => d.surface)).size} surface(s): ` +
    [...new Set(DRIVERS.map((d) => d.surface))].map((s) => `${s}(${DRIVERS.filter((d) => d.surface === s).length})`).join(" · "),
)
/* THE SUBJECT IS NOT ONE OBJECT, AND THAT IS THE WHOLE POINT OF THE WIDENING.
 * A row that only asked "is there a driver" would go green on `__captureHarness`
 * alone — which is precisely the state this channel was in before Lane AB's GAP 3,
 * and it read exactly like this one does now. */
row(
  new Set(DRIVERS.map((d) => d.surface)).size >= 2,
  "A · …on MORE THAN ONE surface — the subject is every published `window.__*`, not one by name",
  new Set(DRIVERS.map((d) => d.surface)).size >= 2
    ? `Lane AB GAP 3: channel A used to match \`__captureHarness\` by name, so a validating driver landing anywhere else was outside the gate that grades it`
    : "*** every driver found sits on ONE surface — the widening has silently collapsed back to a single name ***",
)
row(
  DRIVER_NAMES.has("setFlatten"),
  "A · …including `setFlatten`, the channel's founding case",
  DRIVER_NAMES.has("setFlatten")
    ? "explainer 24 §8 — `{flat: 0}` set nothing and published a verdict; the setter now refuses and says so"
    : "*** setFlatten is not classified as a driver — the derivation is wrong, or the setter stopped validating ***",
)
/* AB's handover named ONE member as the cost of the old scope. It is named here for
 * the same reason `setFlatten` is: it is the case that was measured, and a row about
 * a measured case is falsifiable in a way that a row about "some member" is not. */
row(
  (DRIVER_SURFACES.get("setMeshVisible") ?? []).includes("__inflateProbe"),
  "A · …and `__inflateProbe.setMeshVisible`, the member the old one-name scope excluded",
  (DRIVER_SURFACES.get("setMeshVisible") ?? []).includes("__inflateProbe")
    ? "Lane AB: “the moment `setMeshVisible` lands it costs exactly one validating driver” — it landed 2026-08-07 and is in the subject now"
    : "*** setMeshVisible is not in the driver table — either it stopped validating, or the widening regressed ***",
)
row(
  nonDrivers.some((m) => m.name === "penTip"),
  "A · …and a READER is NOT a driver",
  "`penTip()` takes no argument and reports state; grading its return would be a gate wrong about a real key",
)

/* ══════════════════════════════════════════════════════════════════════════
 * CHANNEL E · THE TWO DERIVATIONS NAME THE SAME THING — both directions
 *
 * `assert-harness-surface.mjs` owns the question "what does the app publish". This
 * file has to walk the literals itself because it needs each member's INITIALISER
 * (does it take an argument, can it answer `false`), which that gate's output does
 * not carry. So the walk is duplicated and the ANSWER is checked: same surfaces,
 * same members, symmetric difference zero, or this gate goes red.
 *
 * A CROSS-CHECK THAT CAN BE SKIPPED IS NOT ONE. A spawn that fails, a `--list` that
 * parses to nothing, a missing file — every one of those is a FAILURE here, never a
 * skip. Explainer 33: `assert-tsc-baseline` exited 0 against a dead port for weeks
 * because a channel it could not reach counted as a channel that passed.
 * ══════════════════════════════════════════════════════════════════════════ */
const SURFACE_GATE = join(VERIFY, "assert-harness-surface.mjs")
function crossCheckSurfaces() {
  if (!existsSync(SURFACE_GATE)) return { ok: false, why: `${rel(SURFACE_GATE)} is MISSING — the derivation has no second reader` }
  const r = spawnSync(process.execPath, [SURFACE_GATE, "--list"], { encoding: "utf8", cwd: ROOT, timeout: 120000 })
  if (r.error) return { ok: false, why: `spawn failed: ${String(r.error.message).slice(0, 120)}` }
  const out = `${r.stdout ?? ""}`
  /* `--list` prints one header per surface and one line per member:
   *   __captureHarness  components/viewport-3d.tsx:10178  —  52 members  ·  API…
   *      grab                           :10180   12 call site(s)                */
  const theirs = new Map()
  let cur = null
  for (const line of out.split("\n")) {
    const h = line.match(/^(__\w+)\s{2,}(\S+):(\d+)\s{2,}—\s{2,}(\d+) members/)
    if (h) { cur = h[1]; theirs.set(cur, new Set()); continue }
    if (!cur) continue
    const m = line.match(/^ {3}(\S+)\s+:(\d+)\s/)
    if (m) { theirs.get(cur).add(m[1]); continue }
    if (/^\S/.test(line)) cur = null
  }
  if (theirs.size === 0) {
    return { ok: false, why: `\`${rel(SURFACE_GATE)} --list\` produced no parseable surface — exit ${r.status}, ${out.length} bytes of output. A cross-check that resolved NOTHING is a failure, not a pass.` }
  }
  /* WHICH FILES THAT GATE DEMONSTRABLY READS — derived from its own output, so this
   * file does not carry a copy of its scope either. `--list` prints each surface's
   * `file:line`, so the set of files it found surfaces in is a lower bound on what it
   * scanned, and it is the only honest bound available without reading its source as
   * data. */
  const theirFiles = new Set()
  for (const line of out.split("\n")) {
    const h = line.match(/^(__\w+)\s{2,}(\S+):(\d+)\s{2,}—/)
    if (h) theirFiles.add(h[2])
  }

  const mine = new Map([...SURFACES].map(([n, s]) => [n, { members: new Set(s.members.map((m) => m.name)), file: rel(s.file) }]))
  const problems = []
  const explained = []
  for (const n of theirs.keys()) if (!mine.has(n)) problems.push(`surface \`${n}\` is in ${rel(SURFACE_GATE)} and NOT here — this gate's derivation is the narrower one, which it must never be`)
  for (const [n, m] of mine) {
    if (theirs.has(n)) continue
    /* A surface that gate cannot have seen is not a disagreement — its publisher
     * file is outside the two it scans. A surface in a file it DOES read and does not
     * report IS a disagreement, and goes red. */
    if (theirFiles.has(m.file)) problems.push(`surface \`${n}\` is here, its file \`${m.file}\` IS read by ${rel(SURFACE_GATE)}, and that gate does not report it`)
    else explained.push(`${n} (${m.file})`)
  }
  for (const [n, set] of theirs) {
    const ours = mine.get(n)
    if (!ours) continue
    for (const k of set) if (!ours.members.has(k)) problems.push(`${n}.${k} is theirs and not ours`)
    for (const k of ours.members) if (!set.has(k)) problems.push(`${n}.${k} is ours and not theirs`)
  }
  const agreed = [...theirs.values()].reduce((a, s) => a + s.size, 0)
  return {
    ok: problems.length === 0,
    explained,
    why:
      problems.length === 0
        ? `${theirs.size} surfaces / ${agreed} members agreed, symmetric difference 0` +
          (explained.length
            ? `  ·  ⚠ ${explained.length} surface(s) THIS gate sees and that one CANNOT: ${explained.join(", ")} — its publisher list is two files, so a surface published from lib/ or app/page.tsx is outside its subject. RETURNED to that file's owner, not fixed here.`
            : "")
        : problems.slice(0, 8).join(" · ") + (problems.length > 8 ? ` …and ${problems.length - 8} more` : ""),
  }
}
const XCHECK = crossCheckSurfaces()
row(
  XCHECK.ok,
  "E · this gate's derivation and `assert-harness-surface.mjs`'s name the SAME surfaces and members, both directions",
  XCHECK.ok ? XCHECK.why : `*** ${XCHECK.why} ***`,
)

/* ── D · calibration, before anything above is believed ─────────────────── */
const calib = calibrate()
if (has("calibrate") || has("list")) {
  console.log("--- CHANNEL D · calibration, both directions ---")
  for (const c of calib) console.log(`  ${c.ok ? "ok " : "BAD"} ${c.what}  —  ${c.detail}`)
  console.log("")
}
const calibBad = calib.filter((c) => !c.ok)
row(
  calibBad.length === 0,
  "D · CALIBRATED — the analyser separates a dropped answer from a read one, both directions",
  calibBad.length === 0
    ? `${calib.length}/${calib.length} known answers: dropped-at-caller · dropped-at-boundary · bound-but-never-read · read-at-caller · read-in-page · through a helper, both ways · prose · a reader`
    : `*** ${calibBad.map((c) => `${c.what}: ${c.detail}`).join(" · ")} ***`,
)
if (calibBad.length) {
  console.log("\nNOT CALIBRATED — refusing to report a sweep on an unproven analyser.\n")
  for (const r of rows) console.log(r)
  process.exit(1)
}

/* ── B · the sweep ─────────────────────────────────────────────────────── */
const files = sweepFiles()
const report = []
for (const f of files) {
  const { arms, unparseable } = armsIn(f)
  if (unparseable) {
    report.push({ file: rel(f), unparseable, arms: [], dropped: [] })
    continue
  }
  if (!arms.length) continue
  const dropped = arms.filter((a) => a.verdict !== "READ" && a.verdict !== "CLEAR")
  report.push({ file: rel(f), arms, dropped })
}

const withArms = report.filter((r) => r.arms.length)
const failing = report.filter((r) => r.dropped.length)
const allowed = failing.filter((r) => ALLOW[r.file])
const unallowed = failing.filter((r) => !ALLOW[r.file])
const clean = withArms.filter((r) => !r.dropped.length)

const allArms = report.flatMap((r) => r.arms)
const nRead = allArms.filter((a) => a.verdict === "READ").length
const nClear = allArms.filter((a) => a.verdict === "CLEAR").length
const nDropped = allArms.length - nRead - nClear
console.log(
  `--- THE SWEEP · ${files.length} files under ${rel(VERIFY)}, ` +
    `${withArms.length} of them drive a validating driver` +
    `${ONLY_DRIVER ? `  [SCOPED to --driver=${ONLY_DRIVER}]` : ""} ---`,
)
console.log(
  `  ARMS  ${allArms.length}  =  ${nRead} READ  ·  ${nDropped} DROPPED  ·  ${nClear} CLEAR ` +
    `(a \`null\` clear cannot be refused, so it is not an arm — counted, never hidden)\n` +
    `  FILES ${clean.length} read the answer on every arm  ·  ` +
    `${failing.length} drop it on at least one  (${allowed.length} ALLOW-listed, ${unallowed.length} NOT)\n`,
)

if (has("list")) {
  for (const r of report) {
    const tag = r.dropped.length ? (ALLOW[r.file] ? "ALLOW" : "🔴   ") : "ok   "
    console.log(`${tag} ${r.file}`)
    for (const a of r.arms) console.log(`        :${String(a.line).padEnd(5)} ${a.driver.padEnd(20)} ${a.verdict.padEnd(21)} ${a.why}`)
  }
  console.log("")
}

/* THE ALLOW LIST PRINTS EVERY RUN. A list nobody reads is a list that rots. */
console.log(`--- ALLOW · ${Object.keys(ALLOW).length} exemption(s), every one with a written reason ---`)
if (!Object.keys(ALLOW).length) console.log("  (empty)")
for (const [f, entry] of Object.entries(ALLOW)) {
  const r = report.find((x) => x.file === f)
  const now = r ? r.dropped.length : null
  const drift = now === null ? "NOT FOUND" : now > entry.arms ? `🔴 ${now} dropped arm(s), exempted at ${entry.arms} — ROSE` : now < entry.arms ? `${now} dropped arm(s), exempted at ${entry.arms} — FELL, re-record to hold the ground` : `${now} dropped arm(s), held`
  console.log(`  · ${f}  —  ${drift}`)
  if (has("list") || has("allow")) console.log(`      ${entry.why}`)
}
if (!has("list") && !has("allow")) console.log(`  (reasons printed with --allow or --list; every entry carries one and channel C requires it)`)
console.log("")

row(
  unallowed.length === 0,
  "B · every arm reads what its driver returned, or is ALLOW-listed with a reason",
  unallowed.length === 0
    ? `${withArms.length} file(s) drive a driver; ${clean.length} clean, ${allowed.length} exempted by name`
    : `*** ${unallowed.length} file(s) drop a driver's answer with no exemption: ` +
      unallowed
        .slice(0, 6)
        .map((r) => `${r.file}:${r.dropped[0].line} (${r.dropped[0].verdict})`)
        .join(" · ") +
      (unallowed.length > 6 ? ` …and ${unallowed.length - 6} more` : "") +
      " ***",
)

/* ── C · the allow list is honest (Lane F's channel E) ──────────────────── */
const cProblems = []
for (const [f, entry] of Object.entries(ALLOW)) {
  const why = entry?.why
  if (!why || why.trim().length < 20) cProblems.push(`${f}: reason missing or too thin to be a reason`)
  if (typeof entry?.arms !== "number") cProblems.push(`${f}: no recorded arm count — the exemption has no ceiling`)
  const abs = join(ROOT, f)
  if (!existsSync(abs)) {
    cProblems.push(`${f}: allowed but NOT FOUND on disk — stale entry, DELETE IT`)
    continue
  }
  const r = report.find((x) => x.file === f)
  if (!r || !r.dropped.length) {
    cProblems.push(
      `${f}: allowed but no longer drops any driver's answer — DELETE THIS ENTRY, ` +
        `or it will excuse the next arm to land in that file`,
    )
    continue
  }
  /* ── HEADROOM IS FREE VIOLATIONS, so an exemption carries a CEILING ──────
   * Explainer 37 §4 measured this exactly: while a ratchet sits above the true
   * count "a new violation costs nothing … 85 sites of headroom is 85 free
   * violations." A file-level allow list has the same hole one rung down — the
   * file is excused, so any NUMBER of new dropped arms lands inside the
   * exemption. The entry records the count it was written against, and a file
   * that drops MORE than that goes red while still being allowed. The count may
   * FALL freely; only a rise is a failure. */
  if (typeof entry.arms === "number" && r.dropped.length > entry.arms) {
    cProblems.push(
      `${f}: exempted at ${entry.arms} dropped arm(s) and now drops ${r.dropped.length} — ` +
        `a NEW arm was added under an old exemption (first new: :${r.dropped[r.dropped.length - 1].line}). ` +
        `Fix it, or re-record the entry deliberately.`,
    )
  }
}
row(
  cProblems.length === 0,
  "C · every ALLOW entry carries a written reason and still needs the exemption",
  cProblems.length === 0 ? `${Object.keys(ALLOW).length} entries, all live` : `*** ${cProblems.join(" · ")} ***`,
)

const unparse = report.filter((r) => r.unparseable)
row(
  unparse.length === 0,
  "…and every swept file PARSED — an unparseable file is not a silent pass",
  unparse.length === 0 ? `${files.length} files` : `*** ${unparse.map((r) => `${r.file}: ${r.unparseable}`).join(" · ")} ***`,
)

const OUT = join(ROOT, "docs", "verification", "gate-integrity")
try {
  writeFileSync(
    join(OUT, "arm-took.json"),
    JSON.stringify(
      {
        when: new Date().toISOString(),
        drivers: DRIVERS.map((d) => ({ name: d.name, line: d.line, via: d.via })),
        counts: { files: files.length, withArms: withArms.length, clean: clean.length, failing: failing.length, allowed: allowed.length, unallowed: unallowed.length },
        files: report.map((r) => ({ file: r.file, arms: r.arms })),
      },
      null,
      2,
    ),
  )
  console.log(`wrote ${rel(join(OUT, "arm-took.json"))}`)
} catch {
  /* a tree built without docs/verification/ — explainer 27 §4. Not a verdict. */
  console.log(`(no ${rel(OUT)} in this tree — the report was not written; that is not a verdict)`)
}

console.log("")
for (const r of rows) console.log(r)
console.log(`\n${rows.length - bad}/${rows.length} rows PASS`)
process.exit(bad ? 1 : 0)
