// For each control Customize mounts: any element that renders outside every <Field>
// shows for EVERY preset of the family. List them. Layout divs are walked through.
// Elements under a `group` Field but outside an inner Field are listed apart: they
// show whenever the group does (the note paragraphs, by design).
//
// CORPUS: with no arguments, every control named in `customizeControlsFor`
// (read from its array literals, so a control added there is checked without
// editing this file). Names on the command line check those instead. EVERY
// return in a control is walked, early ones inside an `if` too; a return inside
// a nested function (a `.map` callback) is not, because that callback shows up
// in the tree as a call and is listed as one. Before 2026-09-26 only the LAST
// top-level return was walked, so a leak in an early return passed (Codex
// crosscheck). Still outside it: anything a child component renders inside
// itself, and any runtime condition (a branch is walked whether or not a
// preset can reach it).
//
// A return the walker cannot read (it returns a variable or a call, not JSX)
// is refused, never skipped: a skipped return is a leak nobody looked at.
//
// EXIT: 0 no leak, 1 a leak, 2 NOTHING TO CHECK (no control found, or the
// controls hold no <Field> at all), 3 a return it could not read. A probe that
// read nothing must not look like a clean one. (ANIM-4E; it exited 0 with no
// arguments before.)
//
// CUSTOMIZE_SCAFFOLD=<path> reads that file instead of
// components/style-panel-scaffold.tsx, for the must-fail fixtures. The run
// says so on its first line.
import ts from "typescript"
import { readFileSync } from "node:fs"
const file = process.env.CUSTOMIZE_SCAFFOLD || new URL("../../components/style-panel-scaffold.tsx", import.meta.url).pathname
if (process.env.CUSTOMIZE_SCAFFOLD) console.log(`READING ${file}, not the scaffold`)
const src = readFileSync(file, "utf8")
const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const fns = {}
sf.forEachChild((n) => { if (ts.isFunctionDeclaration(n) && n.name) fns[n.name.text] = n })
const fromMap = () => {
  const map = fns.customizeControlsFor
  if (!map) return []
  const seen = new Set()
  const visit = (n) => { if (ts.isArrayLiteralExpression(n)) n.elements.forEach((e) => ts.isIdentifier(e) && seen.add(e.text)); ts.forEachChild(n, visit) }
  visit(map.body)
  return [...seen]
}
const names = process.argv.length > 2 ? process.argv.slice(2) : fromMap()
if (!names.length) { console.log("NOTHING TO CHECK: no control names given and none found in customizeControlsFor"); process.exit(2) }
const tag = (n) => (ts.isJsxElement(n) ? n.openingElement : n).tagName.getText()
const attrs = (n) => (ts.isJsxElement(n) ? n.openingElement : n).attributes.properties
const line = (n) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1
/** Every return in `fn`'s own body, early ones inside blocks too, none from a nested function. */
const returnsOf = (fn) => {
  const out = []
  const visit = (n) => {
    if (ts.isFunctionLike(n)) return
    if (ts.isReturnStatement(n)) out.push(n)
    ts.forEachChild(n, visit)
  }
  fn.body.statements.forEach(visit)
  return out
}
/** A return this walker can read: JSX, a branch between JSX, or nothing at all. */
const readable = (e) => {
  if (!e || e.kind === ts.SyntaxKind.NullKeyword) return true
  if (ts.isParenthesizedExpression(e)) return readable(e.expression)
  if (ts.isConditionalExpression(e)) return readable(e.whenTrue) && readable(e.whenFalse)
  if (ts.isBinaryExpression(e)) return readable(e.right)
  return ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)
}
let fieldsAll = 0
let total = 0
let returnsAll = 0
const unread = []
for (const name of names) {
  const fn = fns[name]
  if (!fn) throw new Error(`no function ${name}`)
  const rets = returnsOf(fn)
  if (!rets.length) throw new Error(`no return in ${name}`)
  const leaks = [], inGroup = []
  let fields = 0
  const walk = (n, group) => {
    if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
      const t = tag(n)
      if (t === "Field") {
        fields++
        const isGroup = attrs(n).some((a) => a.name?.getText() === "group")
        if (isGroup && ts.isJsxElement(n)) n.children.forEach((c) => walk(c, true))
        return
      }
      if ((t === "div" || t === "section") && ts.isJsxElement(n)) return n.children.forEach((c) => walk(c, group))
      ;(group ? inGroup : leaks).push(`${t}@${line(n)}`)
      return
    }
    if (ts.isJsxFragment(n)) return n.children.forEach((c) => walk(c, group))
    if (ts.isJsxText(n)) { if (n.getText().trim()) (group ? inGroup : leaks).push(`text@${line(n)}`); return }
    if (ts.isJsxExpression(n)) { if (n.expression) walk(n.expression, group); return }
    if (ts.isParenthesizedExpression(n)) return walk(n.expression, group)
    if (ts.isBinaryExpression(n)) return walk(n.right, group)
    if (ts.isConditionalExpression(n)) { walk(n.whenTrue, group); walk(n.whenFalse, group); return }
    if (ts.isCallExpression(n)) { (group ? inGroup : leaks).push(`call ${n.expression.getText().slice(0, 30)}@${line(n)}`); return }
  }
  const walked = []
  for (const ret of rets) {
    if (!readable(ret.expression)) { unread.push(`${name} return@${line(ret)} (${ret.expression.getText().slice(0, 40)})`); continue }
    if (ret.expression) walk(ret.expression, false)
    walked.push(line(ret))
  }
  total += leaks.length
  fieldsAll += fields
  returnsAll += rets.length
  console.log(`${name}: ${walked.length} of ${rets.length} return(s) walked${walked.length ? ` (line ${walked.join(", ")})` : ""}; ${fields} Field wrappers; outside every Field: ${leaks.length ? leaks.join(", ") : "none"}; inside a group only: ${inGroup.join(", ") || "none"}`)
}
console.log(`${names.length} controls, ${returnsAll} returns, ${fieldsAll} Field wrappers, ${total} leak(s)`)
if (unread.length) { console.log(`UNREAD RETURN: ${unread.length} return(s) hand back something other than JSX, so nothing under them was checked: ${unread.join("; ")}`); process.exit(3) }
if (!fieldsAll) { console.log("NOTHING TO CHECK: the controls hold no <Field>"); process.exit(2) }
process.exitCode = total ? 1 : 0
