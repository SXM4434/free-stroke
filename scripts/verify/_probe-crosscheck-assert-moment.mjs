// _probe-crosscheck-assert-moment.mjs, F113 (the assert-moment row, 2026-09-22).
//
// `docs/storyboard/tools/assert-moment.mjs` printed FAIL for every row that
// rejected a known-bad subject, and for the retired gates rejecting the flip they
// were retired for. It exits 0 when its truth table is SOUND, so the battery rule
// `failedAtZero` in `run-battery.mjs` (a parsed FAIL row at exit 0) read a sound
// run as red, and a real red inside it could not be told apart.
//
// This probe runs the tool's OWN TEXT, from a pre-fix revision and from the
// working tree. By TypeScript AST it rewrites only the shared-module import to an
// absolute URL and `HERE` to the tool's real directory, so the copy reads the same
// measured TSVs. It scores every run with `readRows` and `failedAtZero` /
// `cleanGreen` imported from `run-battery.mjs` itself, not a copy of them.
//
//   old, real tree                  -> exit 0 and failedAtZero (the reproduction)
//   fix, real tree                  -> exit 0 and cleanGreen, truth table and
//                                      SOUND line byte-identical to old
//   fix + a real FAIL: the ORIGINAL film's final hold jitters 3 px
//                                   -> exit 0 and failedAtZero (reads red)
//   fix + a real FAIL: gate 5' fails everywhere, so it fails the accepted flip
//                                   -> a FAIL row and exit 1 (reads red)
//
//   node scripts/verify/_probe-crosscheck-assert-moment.mjs [--old=<rev>]

import ts from "typescript"
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { readRows, failedAtZero, cleanGreen } from "./run-battery.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const TOOL = "docs/storyboard/tools/assert-moment.mjs"
const TOOL_DIR = join(ROOT, "docs", "storyboard", "tools")
const OLD_REV = (process.argv.find((a) => a.startsWith("--old=")) ?? "--old=a14aa777").slice(6)
const WORK = mkdtempSync(join(tmpdir(), "probe-assert-moment-"))

function rewrite(src, plants = []) {
  const sf = ts.createSourceFile("t.mjs", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const edits = []
  const walk = (n) => {
    if (ts.isImportDeclaration(n) && n.moduleSpecifier.text.startsWith("../../../")) {
      const abs = pathToFileURL(join(TOOL_DIR, n.moduleSpecifier.text)).href
      edits.push([n.moduleSpecifier.getStart(), n.moduleSpecifier.getEnd(), JSON.stringify(abs)])
    }
    if (ts.isVariableDeclaration(n) && n.name.getText() === "HERE") {
      edits.push([n.initializer.getStart(), n.initializer.getEnd(), JSON.stringify(TOOL_DIR)])
    }
    n.forEachChild(walk)
  }
  walk(sf)
  if (edits.length !== 2) throw new Error(`expected the shared import and HERE, found ${edits.length} edits`)
  edits.sort((a, b) => b[0] - a[0])
  for (const [s, e, r] of edits) src = src.slice(0, s) + r + src.slice(e)
  for (const [from, to] of plants) {
    if (src.split(from).length !== 2) throw new Error(`plant anchor not found exactly once: ${from}`)
    src = src.replace(from, to)
  }
  return src
}

let n = 0
function run(src, plants) {
  const file = join(WORK, `tool-${++n}.mjs`)
  writeFileSync(file, rewrite(src, plants))
  const r = spawnSync("node", [file], { cwd: ROOT, encoding: "utf8", timeout: 60000 })
  const out = r.stdout + r.stderr
  const rr = { code: r.status, out, ...readRows(out) }
  const table = out.slice(out.indexOf("TRUTH TABLE"))
  return { ...rr, table, red: rr.code !== 0 || failedAtZero(rr), green: cleanGreen(rr) }
}

let bad = 0
const expect = (name, ok, r) => {
  if (!ok) bad++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: exit ${r.code}, ${r.rows} rows, ${r.fails} FAIL rows, ` +
    `failedAtZero ${failedAtZero(r)}, cleanGreen ${r.green}`)
}

const OLD = execFileSync("git", ["show", `${OLD_REV}:${TOOL}`], { cwd: ROOT, encoding: "utf8" })
const NEW = readFileSync(join(ROOT, TOOL), "utf8")

const old = run(OLD)
expect(`old ${OLD_REV} · real tree reads red at exit 0 (the reproduction)`, old.code === 0 && failedAtZero(old), old)
const fix = run(NEW)
expect("fix · real tree reads green under the battery rule", fix.code === 0 && fix.green, fix)
const sameTable = fix.table === old.table && fix.table.includes("\nSOUND")
if (!sameTable) bad++
console.log(`${sameTable ? "PASS" : "FAIL"}  fix · truth table and SOUND line byte-identical to old (${fix.table.split("\n").length} lines)`)
const knownBad = (fix.out.match(/^\s*PASS\s+KNOWN-BAD\b/gm) || []).length
const sameCount = knownBad === old.fails
if (!sameCount) bad++
console.log(`${sameCount ? "PASS" : "FAIL"}  fix · ${knownBad} KNOWN-BAD rows for old's ${old.fails} FAIL rows`)

const holdJitter = run(NEW, [[
  `["ORIGINAL  desk-doodles-traced.webm", traced, null]`,
  `["ORIGINAL  desk-doodles-traced.webm", traced.map((r, i) => ({ ...r, cx: r.cx + (i % 2) * 3 })), null]`,
]])
expect("fix + planted: the original film's hold jitters 3 px, reads red at exit 0",
  holdJitter.code === 0 && failedAtZero(holdJitter) && holdJitter.red, holdJitter)
const momentOff = run(NEW, [["  momentGate(s),\n", "  { ...momentGate(s), pass: false },\n"]])
expect("fix + planted: 5' fails the accepted flip, a FAIL row and exit 1",
  momentOff.code === 1 && momentOff.fails > 0 && momentOff.red, momentOff)

console.log(`\n${bad === 0 ? "SOUND" : "BROKEN"}: ${6 - bad} of 6 expectations held`)
process.exit(bad === 0 ? 0 : 1)
