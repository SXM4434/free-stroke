// ENUMERATE KNOWN-BAD INPUTS for a pure-TS engine module.
//
// WHY
//
//   `docs/DISPATCH.md` §2.6 — "Calibrate the instrument against a known-bad
//   input and require it to FAIL." Every model-only `assert-*` in this repo
//   loads one or two modules under `lib/` through `_ts-load.mjs` and judges
//   numbers derived from them. The known-bad input for such a gate is therefore
//   mechanical: take a constant the module publishes, move it a long way, and
//   see whether the gate notices.
//
//   A gate that notices NO move to ANY constant of the module it reads is not
//   measuring that module. That is the `assert-pen-field` disease — a subject
//   inside the pass condition by construction — stated in a form a machine can
//   test, and it is the only one of the seven classes that can be settled by
//   EXECUTION rather than by reading code.
//
// WHAT COUNTS AS A CONSTANT
//
//   Numeric literals in CONFIG position only:
//     · `export const X = 4.2`
//     · a property of an object literal that initialises an exported const
//       (`DEFAULT_HERO_MOTION`, `HERO_SHEETS`, …), at any nesting depth
//     · a default parameter value of an exported function
//   Numbers inside function BODIES are excluded on purpose: those are algorithm
//   internals, and moving one is a code change rather than a dial change. The
//   distinction matters because a gate is not obliged to notice a rewrite of an
//   easing curve's interior, but it IS obliged to notice its published constant
//   moving.
//
// THE MOVE
//
//   ×1.6, or ±0.35 for values near zero, or 1 for an exact 0 — chosen so the
//   result stays a plausible number (a NaN or an Infinity would be caught by a
//   crash rather than by a judgement, which proves nothing). Sign is preserved.
//   Integer-valued literals stay integral so a count or an index does not turn
//   fractional and fail for the wrong reason.
import ts from "typescript"
import { readFileSync } from "node:fs"

/** The mutated value for `v`. Big enough that any gate that reads it must move. */
export function mutate(v) {
  if (!Number.isFinite(v)) return null
  if (v === 0) return 1
  const isInt = Number.isInteger(v)
  let m = Math.abs(v) < 0.05 ? v + Math.sign(v) * 0.35 : v * 1.6
  if (isInt) {
    m = Math.round(m)
    if (m === v) m = v + 1
  }
  if (!Number.isFinite(m) || m === v) return null
  return m
}

/**
 * Every mutable config literal in `file`.
 * @returns {{name:string, pos:number, end:number, was:string, value:number, mutant:number}[]}
 */
export function enumerateMutants(file, { max = Infinity } = {}) {
  const src = readFileSync(file, "utf8")
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS)
  const out = []
  const seen = new Set()

  const push = (lit, path, negated) => {
    const raw = Number(lit.text)
    if (!Number.isFinite(raw)) return
    const v = negated ? -raw : raw
    const m = mutate(v)
    if (m === null) return
    // The negation sign sits OUTSIDE the literal, so mutating the literal text
    // of `-0.4` must write the magnitude and keep the `-` that precedes it.
    const text = negated ? String(Math.abs(m)) : String(m)
    if (negated && Math.sign(m) !== Math.sign(v)) return
    const key = lit.pos + ":" + lit.end
    if (seen.has(key)) return
    seen.add(key)
    out.push({
      name: path,
      line: sf.getLineAndCharacterOfPosition(lit.getStart()).line + 1,
      pos: lit.getStart(),
      end: lit.getEnd(),
      was: lit.getText(),
      value: v,
      mutant: m,
      text,
    })
  }

  /** Descend an initialiser, recording every numeric literal in config position. */
  const descend = (node, path) => {
    if (!node) return
    if (ts.isNumericLiteral(node)) return push(node, path, false)
    if (
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.MinusToken &&
      ts.isNumericLiteral(node.operand)
    ) {
      return push(node.operand, path, true)
    }
    if (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isTypeAssertionExpression?.(node)) {
      return descend(node.expression, path)
    }
    if (ts.isObjectLiteralExpression(node)) {
      for (const p of node.properties) {
        if (ts.isPropertyAssignment(p)) descend(p.initializer, path + "." + p.name.getText())
      }
      return
    }
    if (ts.isArrayLiteralExpression(node)) {
      node.elements.forEach((el, i) => descend(el, path + "[" + i + "]"))
      return
    }
  }

  const visit = (n) => {
    if (ts.isVariableStatement(n) && n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const d of n.declarationList.declarations) {
        if (ts.isIdentifier(d.name)) descend(d.initializer, d.name.text)
      }
    }
    if (
      (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) &&
      n.parameters
    ) {
      const fname = ts.isFunctionDeclaration(n) && n.name ? n.name.text : "fn"
      for (const p of n.parameters) {
        if (p.initializer && ts.isIdentifier(p.name)) {
          descend(p.initializer, `${fname}(${p.name.text}=)`)
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  out.sort((a, b) => a.pos - b.pos)
  return out.slice(0, max)
}
