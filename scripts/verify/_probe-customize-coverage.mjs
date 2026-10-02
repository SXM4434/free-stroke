// Per family: every key presetFields returns for that family's presets, against the
// non-group <Field k> wrappers inside the controls customizeControlsFor maps it to.
// A group wrapper emits no data-field-keys, so it does not count as covering a key.
//
// WHAT COUNTS AS A WRAPPER (tightened 2026-09-26, Codex crosscheck). It used to be
// any `<Field k={...}>` TEXT between one `function` line and the next, so a Field in
// a comment, in code after the return, in a `{false && ...}` branch or in a variable
// nothing renders covered its key without ever rendering. Now the control is parsed
// with TypeScript and a Field counts only when a return reaches it: through JSX
// children, both sides of a `? :`, the right of `&&`, a `.map` callback, or a local
// `const` the return names. A literal `false` guard, and every statement after a
// top-level return, are pruned. Each control prints how many Fields its text holds
// against how many a return reaches, and names the lines of any it cannot reach.
//
// WHAT IT STILL CANNOT SEE. It reads source, not the page. A Field behind a runtime
// condition (`scope.has(x) && <Field ...>`, or `Field` itself hiding a key out of
// scope) counts as reachable if ANY code path gets there, even when no preset of the
// family takes that path. A `.map` over a list that is empty at runtime counts too.
// The browser gate `assert-custom-presets` checks the rendered case for ONE preset:
// its row "Customize lists exactly presetFields" compares the page's
// [data-field-keys] against presetFields for the first dither preset. No gate checks
// the rendered list for any other family. This limit is printed with every run.
//
// EXIT: 0 every key covered, 1 a key missing, 2 nothing to check.
// CUSTOMIZE_SCAFFOLD=<path> reads that file instead of
// components/style-panel-scaffold.tsx, for the must-fail fixtures. The run says so.
import ts from "typescript"
import { readFileSync } from "node:fs"
import { loadTs, ROOT } from "./_ts-load.mjs"
const S = loadTs("lib/style-system.ts")
const file = process.env.CUSTOMIZE_SCAFFOLD || ROOT + "/components/style-panel-scaffold.tsx"
if (process.env.CUSTOMIZE_SCAFFOLD) console.log(`READING ${file}, not the scaffold`)
const src = readFileSync(file, "utf8")
const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1

const m = src.match(/function customizeControlsFor\([^)]*\)[^{]*\{([\s\S]*?)\n\}/)
if (!m) throw new Error("customizeControlsFor not found")
const map = {}
for (const [, conds, list] of m[1].matchAll(/if \(([^)]*)\)\s*return \[([^\]]*)\]/g))
  for (const [, fam] of conds.matchAll(/family === "(\w+)"/g)) map[fam] = list.split(",").map((x) => x.trim()).filter(Boolean)

const fns = {}
sf.forEachChild((n) => { if (ts.isFunctionDeclaration(n) && n.name) fns[n.name.text] = n })
const bare = (e) => (e && ts.isParenthesizedExpression(e) ? bare(e.expression) : e)
const isLit = (e, kind) => bare(e)?.kind === kind
const tagOf = (n) => (ts.isJsxElement(n) ? n.openingElement : n).tagName.getText()
const attrsOf = (n) => (ts.isJsxElement(n) ? n.openingElement : n).attributes.properties
const isField = (n) => (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) && tagOf(n) === "Field"

/** The returns a call can reach, in order: stop at the first top-level return, prune `if (false)`. */
function reachableReturns(stmts, out) {
  for (const st of stmts) {
    if (ts.isReturnStatement(st)) { out.push(st); return true }
    if (ts.isIfStatement(st)) {
      const one = (s) => reachableReturns(ts.isBlock(s) ? s.statements : [s], out)
      const t = !isLit(st.expression, ts.SyntaxKind.FalseKeyword) && one(st.thenStatement)
      const e = st.elseStatement && !isLit(st.expression, ts.SyntaxKind.TrueKeyword) && one(st.elseStatement)
      if (t && e) return true
      continue
    }
    if (ts.isBlock(st)) { if (reachableReturns(st.statements, out)) return true; continue }
    const visit = (n) => { if (ts.isFunctionLike(n)) return; if (ts.isReturnStatement(n)) out.push(n); ts.forEachChild(n, visit) }
    visit(st)
  }
  return false
}

/** Keys of every non-group Field a return of control `name` reaches. */
function wrapped(name) {
  const fn = fns[name]
  if (!fn) throw new Error(`control ${name} not found`)
  const locals = {}
  for (const st of fn.body.statements)
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && d.initializer) locals[d.name.text] = d.initializer
  const keys = new Set()
  const reached = new Set()
  const unreadK = []
  const usedLocal = new Set()
  const walk = (n) => {
    if (!n) return
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      if (isField(n)) {
        reached.add(n.getStart())
        const attrs = attrsOf(n)
        const group = attrs.some((a) => a.name?.getText() === "group")
        const k = attrs.find((a) => a.name?.getText() === "k")
        if (!group && k) {
          const e = bare(k.initializer && ts.isJsxExpression(k.initializer) ? k.initializer.expression : k.initializer)
          // `k={[]}` is read: a wrapper that covers no key. A `k` that is not literal strings is not.
          const lits = e && ts.isArrayLiteralExpression(e) ? e.elements.map(bare) : e ? [e] : null
          if (lits && lits.every((x) => ts.isStringLiteral(x))) lits.forEach((x) => keys.add(x.text))
          else unreadK.push(`line ${line(n)} k=${k.initializer?.getText().slice(0, 30)}`)
        }
      }
      for (const a of attrsOf(n)) if (a.initializer && ts.isJsxExpression(a.initializer)) walk(a.initializer.expression)
      if (ts.isJsxElement(n)) n.children.forEach(walk)
      return
    }
    if (ts.isJsxFragment(n)) return n.children.forEach(walk)
    if (ts.isJsxExpression(n)) return walk(n.expression)
    if (ts.isParenthesizedExpression(n)) return walk(n.expression)
    if (ts.isConditionalExpression(n)) {
      if (!isLit(n.condition, ts.SyntaxKind.FalseKeyword)) walk(n.whenTrue)
      if (!isLit(n.condition, ts.SyntaxKind.TrueKeyword)) walk(n.whenFalse)
      return
    }
    if (ts.isBinaryExpression(n)) {
      const op = n.operatorToken.kind
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) { if (!isLit(n.left, ts.SyntaxKind.FalseKeyword)) walk(n.right); return }
      walk(n.left); walk(n.right); return
    }
    if (ts.isIdentifier(n)) { if (locals[n.text] && !usedLocal.has(n.text)) { usedLocal.add(n.text); walk(locals[n.text]) } return }
    if (ts.isCallExpression(n)) {
      if (ts.isPropertyAccessExpression(n.expression)) walk(n.expression.expression)
      for (const a of n.arguments) {
        if (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) {
          if (ts.isBlock(a.body)) { const rs = []; reachableReturns(a.body.statements, rs); rs.forEach((r) => walk(r.expression)) }
          else walk(a.body)
        } else walk(a)
      }
    }
  }
  const rets = []
  reachableReturns(fn.body.statements, rets)
  rets.forEach((r) => walk(r.expression))
  // Every Field in the control's text, reached or not, so a pruned one is named.
  const inText = []
  const all = (n) => { if (isField(n)) inText.push(n); ts.forEachChild(n, all) }
  all(fn.body)
  const unreached = inText.filter((n) => !reached.has(n.getStart())).map(line)
  return { keys, inText: inText.length, reached: reached.size, unreached, unreadK, returns: rets.length }
}

const want = process.argv.slice(2)
const byFam = {}
for (const p of S.ALL_PRESETS) {
  const f = (byFam[p.family] ??= new Set())
  for (const k of S.presetFields(p)) f.add(k)
}
// No names means every family that has preset fields. It used to mean none, and
// exit 0 having checked nothing (controller, 2026-09-26).
const fams = want.length ? want : Object.keys(byFam).filter((f) => byFam[f].size > 0).sort()
if (fams.length === 0) { console.error("no family has preset fields: nothing to check"); process.exit(2) }
// Fields a preset sets that are its identity, not a setting to edit. Customize edits the
// picked preset, so a control that swaps the preset stays out (controller, 2026-09-26).
const RULED_OUT = { fusionPreset: "the preset itself; switch presets from the list" }
const read = {}
const readOf = (c) => (read[c] ??= wrapped(c))
let bad = 0
for (const fam of fams) {
  if (!byFam[fam]) throw new Error(`no presets for family ${fam}`)
  const fields = [...byFam[fam]]
  const controls = map[fam] ?? []
  const have = new Set(controls.flatMap((c) => [...readOf(c).keys]))
  // MOTION-CUSTOM: AnimationControl hands <Field> to DrawInTimingControls as
  // `wrap`, and that file calls it as W([...keys], ...). Those keys are read as
  // TEXT from that one file (no reach analysis there), and only for a control
  // whose source passes `wrap={fieldWrap}`. Printed so the limit is visible.
  for (const c of controls) {
    const at = src.indexOf(`function ${c}(`)
    const body = at < 0 ? "" : src.slice(at, src.indexOf("\nfunction ", at + 1))
    if (!body.includes("wrap={fieldWrap}")) continue
    const dtc = readFileSync(`${ROOT}/components/draw-in-timing-controls.tsx`, "utf8")
    const got = [...dtc.matchAll(/\bW\(\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]))
    got.forEach((k) => have.add(k))
    console.log(`${fam}: ${c} passes wrap={fieldWrap}; ${got.length} keys read as text from components/draw-in-timing-controls.tsx W([...]) calls`)
  }
  const miss = fields.filter((k) => !have.has(k) && !RULED_OUT[k])
  if (miss.length) bad++
  console.log(`${fam}: ${fields.length - miss.length} of ${fields.length} covered by [${controls.join(", ")}]${miss.length ? "  MISSING: " + miss.join(" ") : ""}`)
}
console.log("controls, Fields a return reaches of the Fields in the text:")
for (const [c, r] of Object.entries(read))
  console.log(`  ${c}: ${r.reached} of ${r.inText} from ${r.returns} return(s)${r.unreached.length ? `; NOT REACHED, not counted: line ${r.unreached.join(", ")}` : ""}${r.unreadK.length ? `; k not read: ${r.unreadK.join("; ")}` : ""}`)
console.log(
  "LIMIT: this reads source. A Field behind a runtime condition counts if any code path reaches it. " +
    "The rendered list is checked only for the first dither preset, by assert-custom-presets (\"Customize lists exactly presetFields\"); no other family has a rendered check.",
)
process.exitCode = bad ? 1 : 0
