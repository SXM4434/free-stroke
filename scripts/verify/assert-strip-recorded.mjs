// assert-strip-recorded.mjs · INSPECTS THE SHIPPED STRIP WITHOUT A BROWSER
// Input: app/page.tsx and components/stroke-strip.tsx from this checkout.
// No gate bar or fixture is changed. The must-fail removes only the row's mute
// class in memory, then runs the same Recorded predicate against that mutant.
// Covers mode wiring and JSX state, not computed CSS or a rendered browser frame.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const root = fileURLToPath(new URL("../../", import.meta.url))
const stripText = readFileSync(`${root}components/stroke-strip.tsx`, "utf8")
const pageText = readFileSync(`${root}app/page.tsx`, "utf8")
const parse = (text, name) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const strip = parse(stripText, "stroke-strip.tsx")
const page = parse(pageText, "page.tsx")
const visit = (node, predicate) => {
  if (predicate(node)) return node
  return ts.forEachChild(node, (child) => visit(child, predicate))
}
const tag = (node) => ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node) ? node : null
const attr = (node, name) => node?.attributes.properties.find((p) => ts.isJsxAttribute(p) && p.name.text === name)
const jsx = (file, name, marker) => visit(file, (node) => {
  const opening = tag(node)
  return opening?.tagName.getText(file) === name && attr(opening, marker)
})
const expression = (attribute) => attribute?.initializer && ts.isJsxExpression(attribute.initializer)
  ? attribute.initializer.expression : null
const row = jsx(strip, "div", "data-take-row")
const rowClass = expression(attr(row, "className"))
const choice = rowClass && ts.isTemplateExpression(rowClass) && rowClass.templateSpans.length === 1
  ? rowClass.templateSpans[0].expression : null
const modeChoice = choice && ts.isConditionalExpression(choice) ? choice : null
const recordedMuted = (source) => {
  const file = parse(source, "stroke-strip.tsx")
  const target = jsx(file, "div", "data-take-row")
  const cls = expression(attr(target, "className"))
  const branch = cls && ts.isTemplateExpression(cls) ? cls.templateSpans[0]?.expression : null
  return !!branch && ts.isConditionalExpression(branch) &&
    branch.condition.getText(file) === 'ctx.timing === "recorded"' &&
    ts.isStringLiteral(branch.whenTrue) && branch.whenTrue.text === "opacity-40"
}
const provider = jsx(page, "StrokeTakeProvider", "timing")
const providerTiming = expression(attr(provider, "timing"))?.getText(page) === "revealEnvelope.timing"
const contextTiming = /timing:\s*TakeTiming/.test(stripText) &&
  /\[value\.take, value\.timing,/.test(stripText)
const authoredFull = !!modeChoice && ts.isStringLiteral(modeChoice.whenFalse) && modeChoice.whenFalse.text === ""
const rowEditable = !!row && !!rowClass &&
  rowClass.head.text.includes("group/row pointer-events-none relative w-full") &&
  stripText.includes("group pointer-events-auto absolute touch-none") &&
  /onPointerDown=\{\(e\) => onBarDown\(e, i\)\}/.test(stripText) &&
  !/aria-disabled|\bdisabled=|pointer-events-none/.test(modeChoice?.whenTrue.getText(strip) ?? "")
const notice = stripText.includes('ctx.timing === "recorded"\n              ? "Set aside by Skip timings. Edit here; switch to Authored to play."')

let passed = 0
let failed = 0
function check(ok, label) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`)
  ok ? passed++ : failed++
}
check(providerTiming && contextTiming, "page passes the live Timing mode through the strip context")
check(recordedMuted(stripText), "Recorded mutes every per-stroke row with the existing opacity-40 state")
check(authoredFull, "Authored restores the row to full opacity")
check(rowEditable, "muted rows keep their pointer edits")
check(notice, "strip plainly marks Recorded rows as set aside")

const mutant = stripText.replace('ctx.timing === "recorded" ? "opacity-40" : ""', 'ctx.timing === "recorded" ? "" : ""')
const mutantFired = mutant !== stripText && !recordedMuted(mutant)
console.log(`${recordedMuted(mutant) ? "PASS" : "FAIL"}  MUTANT: Recorded rows are muted after removing opacity-40 (expected FAIL)`)
console.log(`${mutantFired ? "PASS" : "FAIL"}  MUST-FAIL: removing the mute reads red under the same Recorded predicate`)
mutantFired ? passed++ : failed++
console.log(`\n${passed} of ${passed + failed} strip Recorded gate rows pass`)
process.exitCode = failed ? 1 : 0
