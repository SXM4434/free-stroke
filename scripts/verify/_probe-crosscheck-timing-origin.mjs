// _probe-crosscheck-timing-origin.mjs, F113 finding 6 (Codex, 2026-09-18).
//
// `verify-timing-origin.mjs --only=<x>` read `<x>` two ways: `want()` as a
// SELECTOR and the cleanup as a FILE PREFIX. Codex:
//   --only=flash                shoots completion_flash, clears none of its old frames
//   --only=pulse_armed_at_rest  clears that arm's frames, shoots nothing
//   an unknown name             has no failure guard
//
// The probe takes the script's own text by TypeScript AST: the old `mine`/`want`
// from inside `main()` at a pre-fix revision, and the ==PURE-BEGIN== block of the
// working tree. It grades both on the REAL file list of
// docs/verification/timing-origin/after (read, never written) and on the arms the
// script really captures, taken from the `if (want("x"))` blocks and the names
// their `run(...)` and `grab(...)` calls write.
//
//   node scripts/verify/_probe-crosscheck-timing-origin.mjs [--old=<rev>]

import ts from "typescript"
import { execFileSync } from "node:child_process"
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const GATE = "scripts/verify/verify-timing-origin.mjs"
const OLD_REV = (process.argv.find((a) => a.startsWith("--old=")) ?? "--old=d6f914a1").slice(6)
const FILES = readdirSync(join(ROOT, "docs/verification/timing-origin/after"))
if (FILES.length < 100) throw new Error(`the after capture holds ${FILES.length} files; this probe needs a complete one to grade against`)

const walk = (n, f) => { f(n); n.forEachChild((c) => walk(c, f)) }
const parse = (src) => ts.createSourceFile("g.mjs", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)

/** `selection(only)` for either version, returning { ok, want, mine }. */
function selector(src, pure) {
  if (pure) {
    const a = src.indexOf("/* ==PURE-BEGIN==")
    const b = src.indexOf("/* ==PURE-END== */")
    if (a < 0 || b < a) throw new Error("PURE markers missing")
    return new Function(`${src.slice(src.indexOf("*/", a) + 2, b)}\nreturn selection`)()
  }
  const sf = parse(src)
  const decl = {}
  walk(sf, (n) => {
    if (ts.isVariableDeclaration(n) && ["mine", "want"].includes(n.name.getText()) && !decl[n.name.getText()])
      decl[n.name.getText()] = n.initializer.getText()
  })
  if (!decl.mine || !decl.want) throw new Error("old mine/want not found")
  return (only) => new Function("ONLY", `return { ok: true, mine: ${decl.mine}, want: ${decl.want} }`)(only)
}

/** Each `if (want("x"))` block, and the file-name prefixes its run()/grab() calls write. */
function capturedArms(src) {
  const out = {}
  walk(parse(src), (n) => {
    if (!ts.isIfStatement(n) || !ts.isCallExpression(n.expression) || n.expression.expression.getText() !== "want") return
    const sel = n.expression.arguments[0].text
    const names = (out[sel] ??= new Set())
    walk(n.thenStatement, (m) => {
      if (!ts.isCallExpression(m) || !["run", "grab"].includes(m.expression.getText())) return
      const a = m.arguments[0]
      if (ts.isStringLiteralLike(a)) names.add(a.text)
      else if (ts.isTemplateExpression(a)) names.add(a.head.text)
    })
  })
  return out
}

let bad = 0
const expect = (name, got, want) => {
  const ok = got === want
  if (!ok) bad++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (got ${got}, want ${want})`)
}

const OLD = execFileSync("git", ["show", `${OLD_REV}:${GATE}`], { cwd: ROOT, encoding: "utf8" })
const NEW = readFileSync(join(ROOT, GATE), "utf8")
const arms = capturedArms(NEW)
const SELECTORS = Object.keys(arms)
console.log(`script captures ${SELECTORS.length} selectors: ${SELECTORS.join(", ")} · after/ holds ${FILES.length} files`)

for (const [tag, src, isFix] of [[`old ${OLD_REV}`, OLD, false], ["fix", NEW, true]]) {
  console.log(`\n── ${tag} ──`)
  const sel = selector(src, isFix)
  const S = (o) => sel(o)
  const cleared = (o) => (S(o).ok ? FILES.filter(S(o).mine).length : 0)
  const shoots = (o) => (S(o).ok ? SELECTORS.filter((x) => S(o).want(x)).length : 0)
  const flashFiles = FILES.filter((f) => /^completion_flash[_.]/.test(f)).length

  // Codex's three, replayed
  expect(`${tag} · CODEX --only=flash clears completion_flash's ${flashFiles} old files`, cleared("flash") === flashFiles, isFix)
  expect(`${tag} · CODEX --only=pulse_armed_at_rest is refused rather than deleting and shooting nothing`,
    !S("pulse_armed_at_rest").ok, isFix)
  expect(`${tag} · CODEX --only=bogus is refused`, !S("bogus").ok, isFix)
  // healthy, must hold on both
  expect(`${tag} · no --only shoots every selector`, shoots(""), SELECTORS.length)
  expect(`${tag} · --only=pulse shoots one selector`, shoots("pulse"), 1)
  expect(`${tag} · --only=delay leaves delayed_after_reveal alone`,
    FILES.filter((f) => f.startsWith("delayed_")).some(S("delay").mine), false)

  if (!isFix) continue
  // The two readings agree, from source: every name a selector's block writes is
  // its own and no other selector's; every file on disk has exactly one owner.
  let agree = true
  for (const x of SELECTORS)
    for (const nm of arms[x]) {
      const probe = /[_.-]$/.test(nm) ? `${nm}00.png` : `${nm}.png`
      const owners = SELECTORS.filter((y) => S(y).mine(probe))
      if (owners.length !== 1 || owners[0] !== x) { agree = false; console.log(`   ${x} writes ${nm}, owned by [${owners}]`) }
    }
  expect(`${tag} · every name each want() block writes is cleared by that selector and no other`, agree, true)
  const orphan = FILES.filter((f) => SELECTORS.filter((y) => S(y).mine(f)).length !== 1)
  expect(`${tag} · every file in after/ has exactly one owning selector${orphan.length ? ` (not: ${orphan.slice(0, 4)})` : ""}`,
    orphan.length, 0)
}

console.log(`\n${bad === 0 ? "SOUND" : "BROKEN"}: ${bad} expectation(s) missed`)
process.exit(bad === 0 ? 0 : 1)
