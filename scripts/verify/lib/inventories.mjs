// THE CLOSED SETS THE APP DEFINES — so a gate's hand-written list can be checked
// against one.
//
// WHY
//
//   `assert-hero-option-panel.mjs` carried a hardcoded FOUR-film list while the
//   panel had SEVEN. Two films shipped and were unwatched from the moment they
//   landed, and the gate read ALL PASS throughout. That is not a bug in that
//   file's logic — every row in it was correct about the four it knew about. The
//   bug is that the inventory is a SECOND COPY of something the app already
//   states exactly once, and the copy has no way to notice the original growing.
//
//   Same shape, same week, four more times:
//     verify-gates.mjs        5 of 14 TextureMode
//     assert-motion-off.mjs   4 of 8  StackAnimationType
//     assert-timing.mjs       5 of 6  StyleSyncMode
//     assert-fold-census.mjs  4 of 5  fixtures
//
//   So the enumerations are collected from source and every `assert-*` is asked
//   the one question that settles it: of the members of this closed set, how
//   many does the gate MENTION anywhere in its text? A member the file never
//   names cannot be a member the file tests.
//
// WHAT COUNTS AS A CLOSED SET
//
//   · `type X = "a" | "b" | "c"`            — a string-literal union
//   · `const X = ["a", "b"] as const`       — a frozen list
//   · `const X: Record<SomeUnion, T> = {…}` — keyed by a union, so its keys are
//                                             the union, exhaustively
//
//   NOT a plain config object. `DEFAULT_STYLE_STATE` has 71 fields and no gate
//   is expected to name all of them; including it produced four confident and
//   entirely useless findings in the first draft of this file. A closed set is
//   one where naming all the members is the POINT.
//
// THE TEST IS "MENTIONS", NOT "ITERATES", AND THAT IS DELIBERATE
//
//   Asking whether a gate iterates a set requires following the data flow, which
//   is the analysis this repo has already proved unreliable. Asking whether the
//   STRING appears is decidable, cheap, and one-sided in the safe direction: a
//   gate that never writes the word `procedural` anywhere is certainly not
//   testing `procedural`. It can over-forgive (a gate might name a member in a
//   comment and test nothing), never over-accuse.
import ts from "typescript"
import { readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"

/** Sets bigger than this are configuration, not inventory. */
const MAX_MEMBERS = 40
const MIN_MEMBERS = 3

function walk(dir, out = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue
    const p = join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

/**
 * Every closed string set the app defines.
 * @returns {{name:string, members:string[], file:string, line:number, kind:string}[]}
 */
export function collectInventories(root, dirs = ["lib", "app", "components"]) {
  const files = dirs.flatMap((d) => walk(join(root, d)))
  const out = []
  const seen = new Set()
  for (const f of files) {
    const src = readFileSync(f, "utf8")
    const sf = ts.createSourceFile(
      f,
      src,
      ts.ScriptTarget.ES2022,
      true,
      /\.tsx$/.test(f) ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    const rel = relative(root, f)
    const add = (name, members, node, kind) => {
      const uniq = [...new Set(members)]
      if (uniq.length < MIN_MEMBERS || uniq.length > MAX_MEMBERS) return
      const key = uniq.slice().sort().join("|")
      if (seen.has(key)) return // the union and the Record keyed by it are one set
      seen.add(key)
      out.push({
        name,
        members: uniq,
        file: rel,
        line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
        kind,
      })
    }
    const visit = (n) => {
      // type X = "a" | "b" | "c"
      if (ts.isTypeAliasDeclaration(n) && ts.isUnionTypeNode(n.type)) {
        const lit = n.type.types.filter(
          (t) => ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal),
        )
        if (lit.length === n.type.types.length) {
          add(n.name.text, lit.map((t) => t.literal.text), n, "union")
        }
      }
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer) {
        let init = n.initializer
        const asConst =
          ts.isAsExpression(init) && /(^|\W)const$/.test(init.type.getText() || "")
        if (ts.isAsExpression(init)) init = init.expression
        // const X = ["a","b"] as const   /   const X: readonly T[] = [...]
        if (ts.isArrayLiteralExpression(init)) {
          const lit = init.elements.filter(ts.isStringLiteral)
          const declared = n.type ? n.type.getText() : ""
          if (lit.length === init.elements.length && (asConst || /readonly|\[\]/.test(declared))) {
            add(n.name.text, lit.map((e) => e.text), n, "array")
          }
        }
        /* const X: Record<SomeUnion, T> = { a: …, b: … }
         * Keyed by a union, so the keys ARE the union and a missing key is a
         * type error — which is what makes the key set closed rather than a
         * config bag that happens to have members. */
        if (ts.isObjectLiteralExpression(init) && n.type) {
          const t = n.type.getText()
          if (/^(Readonly<)?Record<\s*[A-Za-z_$][\w$]*\s*,/.test(t)) {
            const keys = init.properties
              .map((p) =>
                ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)
                  ? ts.isStringLiteral(p.name) || ts.isIdentifier(p.name)
                    ? p.name.text
                    : null
                  : null,
              )
              .filter(Boolean)
            if (keys.length === init.properties.length) add(n.name.text, keys, n, "record")
          }
        }
      }
      ts.forEachChild(n, visit)
    }
    visit(sf)
  }
  return out
}

/** Every string literal (and template head/spans) in a script, as a Set. */
export function stringsIn(file) {
  const src = readFileSync(file, "utf8")
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS)
  const out = new Set()
  const visit = (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.add(n.text)
    if (ts.isTemplateExpression(n)) {
      out.add(n.head.text)
      for (const s of n.templateSpans) out.add(s.literal.text)
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

/**
 * Which closed sets does this gate PARTIALLY cover?
 *
 * `floor` — the share of a set a gate must mention before we treat the set as
 * one the gate is TRYING to enumerate. Below it the overlap is coincidence: a
 * gate naming "rod" and "solid" is not attempting `GeometryMode`, and at 0.30
 * this produced 42 findings of which most were that.
 *
 * 0.50 is calibrated on the confirmed cases rather than chosen for taste:
 *   assert-hero-option-panel  4 of 7  HeroShape              0.571
 *   assert-motion-off         5 of 9  StackAnimationBehaviour 0.556
 *   verify-gates              8 of 14 TextureMode            0.571
 *   assert-timing-origin      4 of 6  StyleSyncMode          0.667
 *   assert-texture-motion    12 of 14 TextureMode            0.857
 * The lowest confirmed case is 0.556, so the floor sits just under it.
 *
 * WHAT THIS MISSES, said plainly: a gate covering under half a set is not
 * reported. `assert-fold-census` naming 4 of 5 fixtures IS caught; a gate naming
 * 3 of 12 phases is not, and cannot be — at that ratio the gate is testing three
 * specific phases, not enumerating twelve, and there is no way to tell those two
 * intentions apart from the text.
 *
 * A DELIBERATE SUBSET IS DECLARABLE. A gate carrying
 *   // gate-integrity: partial <SetName> — <reason>
 * records the exclusion instead of being accused of it. That is the whole point:
 * turn a silent copy into a stated decision, so the next reader sees a reason
 * rather than a list that happens to be short.
 */
export function partialCoverage(gateFile, inventories, { floor = 0.5 } = {}) {
  const words = stringsIn(gateFile)
  const raw = readFileSync(gateFile, "utf8")
  const declared = new Set(
    [...raw.matchAll(/gate-integrity:\s*partial\s+([A-Za-z_$][\w$]*)/g)].map((m) => m[1]),
  )
  const hits = []
  for (const inv of inventories) {
    if (declared.has(inv.name)) continue
    const named = inv.members.filter((m) => words.has(m))
    if (named.length < MIN_MEMBERS) continue
    if (named.length === inv.members.length) continue // fully covered — nothing to say
    if (named.length / inv.members.length < floor) continue
    hits.push({
      set: inv.name,
      kind: inv.kind,
      at: `${inv.file}:${inv.line}`,
      named: named.length,
      total: inv.members.length,
      missing: inv.members.filter((m) => !words.has(m)),
    })
  }
  // One finding per gate per member-set; the widest gap first.
  hits.sort((a, b) => b.missing.length - a.missing.length)
  return hits
}
