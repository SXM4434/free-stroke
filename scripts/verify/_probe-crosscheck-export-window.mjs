// _probe-crosscheck-export-window.mjs, F113 finding 10 (Codex, 2026-09-18).
//
// Codex found three rows in `assert-export-window.mjs` that pass on nothing:
//   Q1  an EMPTY order-harness film satisfies the order control (NaN centroids leave maxD 0)
//   Q4  three EMPTY GLB exports hash to "none", match, and the row passes on the census
//   §D  an all-blank Vanish download passes the headline on its frame counts
//
// This probe runs the gate's OWN TEXT, not a copy of it. From the current file it
// takes the ==PURE-BEGIN== .. ==PURE-END== block; from both the current file and
// the pre-fix file (`git show ab67a422:...`) it takes, by TypeScript AST, the
// statements each call site runs and the arms of each `paired(...)` call. Those
// are written into a scratch module with `createCanvas`/`loadImage` prepended,
// fed synthetic PNG films, and scored through the real `lib/paired.mjs`.
//
// Each finding gets a HEALTHY case (the pair must pass) and CODEX'S MUTATION
// replayed as written in the reply (the pair must fail). The bar for committing
// the fix: every arm as expected on the fix, and each mutation PASSING on the old
// predicates, which is the reproduction.
//
//   node scripts/verify/_probe-crosscheck-export-window.mjs
//
// Exit 0 only when every expectation holds, including that the old file really
// is fooled. A probe that stopped reproducing the old defect would be a probe
// that could no longer tell the fix from the bug.

import ts from "typescript"
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs"
import { join, dirname } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createRequire } from "node:module"
import { makePaired } from "./lib/paired.mjs"

const require = createRequire(import.meta.url)
const { createCanvas } = require("@napi-rs/canvas")
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const GATE = "scripts/verify/assert-export-window.mjs"
const OLD_REV = "ab67a422"

let bad = 0
const expect = (name, got, want) => {
  const ok = got === want
  if (!ok) bad++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}  (pair ${got ? "passed" : "failed"}, expected ${want ? "pass" : "fail"})`)
}

/* ---------- harvesting the gate's own text ---------- */
function parse(src) {
  return ts.createSourceFile("g.mjs", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
}
function walk(n, f) {
  f(n)
  n.forEachChild((c) => walk(c, f))
}
const declName = (st) =>
  ts.isFunctionDeclaration(st) ? st.name?.text
  : ts.isVariableStatement(st) ? st.declarationList.declarations[0].name.getText()
  : null
/** The top-level function or const with this name, as source text. */
function topDecl(sf, name) {
  const st = sf.statements.find((s) => declName(s) === name)
  if (!st) throw new Error(`no top-level ${name}`)
  return st.getText()
}
/** The `callee(...)` call whose first argument is a string starting with `label`. */
function callByLabel(sf, callee, label) {
  let hit = null
  walk(sf, (n) => {
    if (
      !hit && ts.isCallExpression(n) && n.expression.getText() === callee &&
      n.arguments[0] && ts.isStringLiteralLike(n.arguments[0]) && n.arguments[0].text.startsWith(label)
    ) hit = n
  })
  if (!hit) throw new Error(`no ${callee}("${label}...")`)
  return hit
}
function enclosingBlock(n) {
  let p = n.parent
  while (p && !ts.isBlock(p)) p = p.parent
  return p
}
const stmtOf = (call) => {
  let p = call
  while (p && !ts.isExpressionStatement(p)) p = p.parent
  return p
}

function harvest(src, { pure }) {
  const sf = parse(src)
  let helpers
  if (pure) {
    const a = src.indexOf("/* ==PURE-BEGIN==")
    const b = src.indexOf("/* ==PURE-END== */")
    if (a < 0 || b < 0 || b < a) throw new Error("PURE markers missing")
    helpers = src.slice(src.indexOf("*/", a) + 2, b)
  } else {
    helpers = ["rasterGuard", "sameShape", "pixels", "inkMask", "iou", "differingPixels", "inkCentroidX"]
      .map((n) => topDecl(sf, n)).join("\n")
  }
  const tail = topDecl(sf, "tailCensus")

  // Q1: every statement after the draw-window loop, up to the paired call.
  const q1 = callByLabel(sf, "paired", "🔴 Q1 · the REORDER is IN the film")
  const q1b = enclosingBlock(q1)
  const q1i = q1b.statements.indexOf(stmtOf(q1))
  let q1s = q1i - 1
  while (q1s >= 0 && !ts.isForStatement(q1b.statements[q1s])) q1s--
  const q1body = q1b.statements.slice(q1s + 1, q1i).map((s) => s.getText()).join("\n")

  // Q4: the hash, the byte check if present, the stability flag, and the arms.
  const q4 = callByLabel(sf, "paired", "Q4 · GLB is the finished mark")
  const q4b = enclosingBlock(q4)
  const q4body = q4b.statements
    .filter((s) => ["h", "glbBytes", "glbStable"].includes(declName(s)))
    .map((s) => s.getText()).join("\n")
  let q4row = "true"
  try { q4row = callByLabel(sf, "row", "Q4 · every GLB export").arguments[0].getText() } catch {}

  // §D headline: expectedGap and the arms.
  const d = callByLabel(sf, "paired", "🔴 §D · THE FILE THE VIDEO BUTTON DOWNLOADS")
  const db = enclosingBlock(d)
  const dbody = db.statements.filter((s) => declName(s) === "expectedGap").map((s) => s.getText()).join("\n")
  if (!dbody) throw new Error("no expectedGap")

  const arms = (c) => `[${c.arguments[1].getText()}, ${c.arguments[3].getText()}]`
  return { helpers, tail, q1body, q1arms: arms(q1), q4body, q4arms: arms(q4), q4row, dbody, darms: arms(d) }
}

async function build(tag, src, pure, mutate = (s) => s) {
  const H = harvest(mutate(src), { pure })
  const mod = `
import { createRequire } from "node:module"
import { createHash } from "node:crypto"
const require = createRequire(${JSON.stringify(join(ROOT, GATE))})
const { createCanvas, loadImage } = require("@napi-rs/canvas")
let emptyRef = null
${H.helpers}
${H.tail}
export { inkMask, pixels, tailCensus }
export function q1({ mS, mH, mI, draw }) {
${H.q1body}
  return ${H.q1arms}
}
export function q4({ g0, g0b, g1, c0, c1 }) {
${H.q4body}
  return { arms: ${H.q4arms}, row: ${H.q4row} }
}
export function d3({ cw, cu, pw, pu, growMark }) {
${H.dbody}
  return ${H.darms}
}
`
  const dir = mkdtempSync(join(tmpdir(), "fs-probe-ew-"))
  const f = join(dir, `${tag}.mjs`)
  writeFileSync(f, mod)
  try {
    return await import(pathToFileURL(f).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

/* ---------- synthetic films ---------- */
const W = 40
const Hh = 10
/** A PNG of paper with ink in columns [x0, x1). */
function png(x0, x1) {
  const c = createCanvas(W, Hh)
  const g = c.getContext("2d")
  g.fillStyle = "#fff"
  g.fillRect(0, 0, W, Hh)
  if (x1 > x0) {
    g.fillStyle = "#000"
    g.fillRect(x0, 0, x1 - x0, Hh)
  }
  return c.toBuffer("image/png")
}
const N = 20
// identity grows left to right; the reordered film grows right to left
const identity = Array.from({ length: N }, (_, i) => png(0, Math.round((i / (N - 1)) * W)))
const reordered = Array.from({ length: N }, (_, i) => png(W - Math.round((i / (N - 1)) * W), W))

function glbB64() {
  const json = Buffer.from(JSON.stringify({ asset: { version: "2.0" } }).padEnd(28, " "))
  const len = 12 + 8 + json.length
  const b = Buffer.alloc(len)
  b.writeUInt32LE(0x46546c67, 0)
  b.writeUInt32LE(2, 4)
  b.writeUInt32LE(len, 8)
  b.writeUInt32LE(json.length, 12)
  b.writeUInt32LE(0x4e4f534a, 16)
  json.copy(b, 20)
  return b.toString("base64")
}

/* ---------- the three cases, on one module ---------- */
async function q1Case(M, { zeroHarness }) {
  const empty = await M.pixels(identity[0])
  const mS = []
  const mH = []
  const mI = []
  for (let i = 0; i < N; i++) {
    mS.push(M.inkMask(await M.pixels(reordered[i]), empty))
    mH.push(M.inkMask(await M.pixels(reordered[i]), empty)) // same schedule, other driver
    if (zeroHarness) mH[mH.length - 1].m.fill(0) // Codex's mutation, verbatim
    mI.push(M.inkMask(await M.pixels(identity[i]), empty))
  }
  const peakI = Math.max(...mI.map((m) => m.count))
  const draw = []
  for (let i = 0; i < N; i++) if (peakI > 0 && mI[i].count > peakI * 0.02 && mI[i].count < peakI * 0.98) draw.push(i)
  const [real, ctl] = M.q1({ mS, mH, mI, draw })
  return score(real, ctl)
}
function q4Case(M, { empty }) {
  const g = empty ? "" : glbB64() // Codex: `const glb = async () => ""`
  const r = M.q4({ g0: g, g0b: g, g1: g, c0: "mesh:120|nib:40", c1: "mesh:120|nib:40" })
  return score(r.arms[0], r.arms[1]) && r.row
}
async function dCase(M) {
  const ref = await M.pixels(png(0, 0))
  const growMark = M.inkMask(await M.pixels(png(0, W)), ref).count
  const n = 30
  const gap = 14
  const vanish = Array.from({ length: n }, (_, i) => png(Math.round((i / (n - 1)) * W), W))
  const unwired = [...vanish, ...Array.from({ length: gap }, () => png(0, 0))]
  const cw = await M.tailCensus(vanish, "wired", { ref, tol: 2 })
  const cu = await M.tailCensus(unwired, "unwired", { ref, tol: 2 })
  const pw = { frames: Array.from({ length: n }, () => ({ phase: "draw" })) }
  const pu = { frames: [...pw.frames, ...Array.from({ length: gap + 1 }, () => ({ phase: "hold" }))].slice(0, n + gap) }
  const [real, ctl] = M.d3({ cw, cu, pw, pu, growMark })
  return score(real, ctl)
}
function score(real, ctl) {
  let ok = null
  makePaired((v) => { ok = v })("probe", real, "control", ctl, "")
  return ok
}

/* §D's mutation is a SOURCE edit in the census, so it builds its own module. */
const D_LINE = "const m = inkMask(await pixels(f), ref)"
const D_MUT = "const m = opts.ref ? { count: 0 } : inkMask(await pixels(f), ref)"
const mutateD = (s) => {
  if (!s.includes(D_LINE)) throw new Error("Codex's §D line is not in the census; the mutation would not land")
  return s.replace(D_LINE, D_MUT)
}

const NEW = readFileSync(join(ROOT, GATE), "utf8")
const OLD = execFileSync("git", ["show", `${OLD_REV}:${GATE}`], { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 26 })

for (const [tag, src, pure, isFix] of [["old", OLD, false, false], ["fix", NEW, true, true]]) {
  console.log(`\n── ${tag === "old" ? `OLD predicates (${OLD_REV})` : "FIX (working tree)"} ──`)
  const M = await build(tag, src, pure)
  const MD = await build(`${tag}-dmut`, src, pure, mutateD)
  expect(`${tag} · Q1 healthy order films`, await q1Case(M, { zeroHarness: false }), true)
  expect(`${tag} · Q1 MUTATION every harness mask zeroed`, await q1Case(M, { zeroHarness: true }), !isFix)
  expect(`${tag} · Q4 healthy glTF 2 exports`, q4Case(M, { empty: false }), true)
  expect(`${tag} · Q4 MUTATION glb returns ""`, q4Case(M, { empty: true }), !isFix)
  expect(`${tag} · §D healthy Vanish films`, await dCase(M), true)
  expect(`${tag} · §D MUTATION census reads 0 ink`, await dCase(MD), !isFix)
}

console.log(`\n${bad === 0 ? "SOUND" : "BROKEN"}: ${12 - bad} of 12 expectations held` +
  " (old must be fooled by all three mutations, the fix by none, healthy passes on both)")
process.exit(bad === 0 ? 0 : 1)
