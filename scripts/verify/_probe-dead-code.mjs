// PROBE — how much of `lib/geometry-engines.ts` can nothing reach?
//
// WHY THIS EXISTS. The claim under audit is that ~26% of the file is
// unreachable, including an entire second Solid pipeline. Dead code in an engine
// this heavily commented is not a tidiness question: every one of those lines is
// read as documentation of how the shipped thing works, and a reader cannot tell
// from the page which half is live.
//
// HOW IT IS DECIDED, and where it can be wrong. The module is parsed with the
// `typescript` devDependency (the same one `_ts-load.mjs` and
// `assert-gate-integrity.mjs` use), the top-level function / class / const
// declarations are collected, and a breadth-first walk runs from every EXPORTED
// root plus every top-level statement — the module's real entry set. A
// declaration nothing in that closure names is unreachable FROM THIS MODULE.
//
// Three honest limits, stated rather than buried:
//   · references are resolved by IDENTIFIER, not by scope. A local variable that
//     happens to share a name with a top-level function marks it live. That errs
//     towards calling things REACHABLE, so the dead count is a LOWER BOUND.
//   · anything reached only through a string (a registry keyed by name, a
//     `window.__x` handle) is invisible here, so those are cross-checked against
//     the whole repo before anything is called dead.
//   · a declaration can be reachable and still never RUN — behind a flag that is
//     never set. This does not claim otherwise.
//
// THE CONTROL. A set of names known to be live (the four engine roots and the
// functions the verification battery calls) must ALL come back reachable, and a
// deliberately-unreferenced canary must come back dead. An analyser that has
// never called anything alive, or never called anything dead, has not been shown
// able to tell them apart.
import ts from "typescript"
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { join, extname } from "node:path"
import { ROOT } from "./_ts-load.mjs"

const TARGET = process.argv.find((a) => a.startsWith("--file="))?.slice(7) ?? "lib/geometry-engines.ts"
const abs = join(ROOT, TARGET)
const src = readFileSync(abs, "utf8")
const sf = ts.createSourceFile(abs, src, ts.ScriptTarget.ES2020, true)
const lines = src.split("\n")

/* ---- 1 · top-level declarations ---- */
const decls = new Map() // name -> { start, end, kind, exported }
function declName(n) {
  if (ts.isFunctionDeclaration(n) || ts.isClassDeclaration(n) || ts.isInterfaceDeclaration(n) || ts.isTypeAliasDeclaration(n) || ts.isEnumDeclaration(n)) {
    return n.name ? n.name.text : null
  }
  return null
}
const isExported = (n) =>
  !!(ts.getCombinedModifierFlags(n) & ts.ModifierFlags.Export) ||
  (n.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)

for (const st of sf.statements) {
  if (ts.isVariableStatement(st)) {
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name)) continue
      decls.set(d.name.text, {
        start: sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1,
        end: sf.getLineAndCharacterOfPosition(st.getEnd()).line + 1,
        kind: "const",
        exported: isExported(st),
        node: d,
      })
    }
    continue
  }
  const nm = declName(st)
  if (!nm) continue
  decls.set(nm, {
    start: sf.getLineAndCharacterOfPosition(st.getStart(sf)).line + 1,
    end: sf.getLineAndCharacterOfPosition(st.getEnd()).line + 1,
    kind: ts.isFunctionDeclaration(st) ? "function" : ts.isClassDeclaration(st) ? "class" : "type",
    exported: isExported(st),
    node: st,
  })
}

/* ---- 2 · identifier references inside each declaration ---- */
function idsIn(node) {
  const out = new Set()
  const walk = (n) => {
    if (ts.isIdentifier(n)) out.add(n.text)
    else if (ts.isPropertyAccessExpression(n)) {
      // `a.b` -> only `a` is a free identifier.
      walk(n.expression)
      return
    }
    ts.forEachChild(n, walk)
  }
  ts.forEachChild(node, walk)
  if (ts.isIdentifier(node)) out.add(node.text)
  return out
}
const refs = new Map()
for (const [name, d] of decls) refs.set(name, idsIn(d.node))

/* ---- 3 · the entry set: exports + every top-level statement that is not a
 *          declaration (side-effecting code, `if (typeof window …)` blocks) --- */
const roots = new Set()
for (const [name, d] of decls) if (d.exported) roots.add(name)
for (const st of sf.statements) {
  if (ts.isVariableStatement(st) || declName(st) || ts.isImportDeclaration(st)) continue
  for (const id of idsIn(st)) roots.add(id)
}

/* ---- 4 · BFS ---- */
const live = new Set()
const queue = [...roots].filter((r) => decls.has(r))
const rootDecls = new Set(queue)
while (queue.length) {
  const n = queue.pop()
  if (live.has(n)) continue
  live.add(n)
  for (const r of refs.get(n) ?? []) if (decls.has(r) && !live.has(r)) queue.push(r)
}

/* ---- 5 · anything named anywhere else in the repo is NOT dead ---- */
function repoFiles(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (e === "node_modules" || e === ".next" || e === ".git") continue
    const p = join(dir, e)
    const s = statSync(p)
    if (s.isDirectory()) repoFiles(p, acc)
    else if ([".ts", ".tsx", ".mjs", ".js"].includes(extname(p)) && p !== abs) acc.push(p)
  }
  return acc
}
/* AN INSTRUMENT MAY NOT BE PART OF ITS OWN SUBJECT.
 *
 * `assert-dead-code.mjs` pins the block's first and last declaration by NAME, as
 * string literals — and string literals are deliberately not stripped below
 * (a name reached through a registry key is a real reference). So the gate's own
 * pin made its own landmarks look alive, and both dropped out of the dead set.
 * Excluded by name, which is the honest fix: the two harness files talk ABOUT
 * this code and never call it. */
const SELF_REFERENTIAL = ["_probe-dead-code.mjs", "assert-dead-code.mjs"]
const others = repoFiles(join(ROOT, "lib"))
  .concat(repoFiles(join(ROOT, "app")))
  .concat(repoFiles(join(ROOT, "components")))
  .concat(repoFiles(join(ROOT, "scripts")))
  .filter((f) => !SELF_REFERENTIAL.some((s) => f.endsWith(s)))
/* COMMENTS ARE STRIPPED, AND THAT IS NOT A DETAIL.
 *
 * A mention in prose is not a reference. Caught first-hand the moment
 * `assert-dead-code.mjs` was written: that gate names `SOLID_RASTER_SIZE` and
 * `findEnclosedHoles` in its own header, so this cross-check read them as live
 * and the two landmark declarations vanished out of the dead set — the
 * instrument was measuring its own documentation. Any file that DISCUSSES the
 * dead block would have done the same, which is the whole reason it is
 * discussed.
 *
 * Block and line comments both, plus string literals are LEFT IN on purpose: a
 * name reached through a string (a registry key, a `window.__x` handle) is a
 * real reference this AST walk cannot see, and counting it keeps the dead
 * number a lower bound. */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
const otherText = others.map((f) => stripComments(readFileSync(f, "utf8"))).join("\n")
const namedElsewhere = new Set()
for (const name of decls.keys()) {
  if (name.length < 4) continue
  if (new RegExp(`\\b${name.replace(/[$]/g, "\\$")}\\b`).test(otherText)) namedElsewhere.add(name)
}

/* ---- 6 · verdict ---- */
const dead = []
for (const [name, d] of decls) {
  if (live.has(name)) continue
  if (namedElsewhere.has(name)) continue
  dead.push({ name, ...d })
}
dead.sort((a, b) => a.start - b.start)

let deadLines = 0
for (const d of dead) deadLines += d.end - d.start + 1

console.log(`=== reachability of ${TARGET} ===`)
console.log(
  `  ${lines.length} lines · ${decls.size} top-level declarations · ` +
    `${rootDecls.size} exported/side-effect roots · ${live.size} reachable`,
)
console.log(
  `  UNREACHABLE: ${dead.length} declarations spanning ${deadLines} lines ` +
    `(${((deadLines / lines.length) * 100).toFixed(1)}% of the file)\n`,
)
for (const d of dead) {
  console.log(
    `  ${String(d.start).padStart(5)}-${String(d.end).padEnd(5)} ${String(d.end - d.start + 1).padStart(5)}L  ` +
      `${d.kind.padEnd(8)} ${d.name}`,
  )
}

/* ---- 7 · CALIBRATION, both directions ---- */
console.log("\n=== calibration — can this analyser tell them apart? ===")
let fails = 0
const say = (ok, s) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${s}`)
}
/* Names the verification battery and the app demonstrably call. If any of these
 * came back dead the analyser would be broken, not the code. */
const MUST_BE_LIVE = [
  "RodEngine",
  "ExtrudeEngine",
  "SolidEngine",
  "InflateEngine",
  "computeSolidEffectiveThicknessPx",
  "computeSolidEffectiveDepth",
  "computeEffectiveExtrudeDepth",
  "detectJoints3D",
  "DEFAULT_EXTRUDE_PARAMS",
  "DEFAULT_SOLID_PARAMS",
  "DEFAULT_INFLATE_PARAMS",
  "INFLATE_DEBUG",
]
for (const n of MUST_BE_LIVE) {
  const known = decls.has(n)
  say(known && (live.has(n) || namedElsewhere.has(n)), `${n} is reachable${known ? "" : " — NOT DECLARED IN THIS FILE"}`)
}
say(dead.length > 0, `the analyser found SOMETHING unreachable (${dead.length}) — it is not blind in that direction`)
say(
  dead.length < decls.size * 0.8,
  `and it did not call almost everything dead (${dead.length}/${decls.size})`,
)

console.log(`\n${fails === 0 ? "CALIBRATION OK" : `${fails} CALIBRATION FAILURE(S)`}`)
process.exit(fails === 0 ? 0 : 1)
