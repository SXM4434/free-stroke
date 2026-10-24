// _probe-crosscheck-drawin-timing.mjs, F113 finding 5 (Codex, 2026-09-18).
//
// `assert-drawin-timing.mjs`'s default CONTROL row claims its sample "landed
// mid-pass, so the identity above was read while the clock was still moving".
// Codex froze the playhead at 0.4 inside `playUntilHead`'s page callback and made
// `setPlaying` do nothing. `landed` came back true and the row passed.
//
// This probe takes the gate's OWN TEXT by TypeScript AST, from the working tree
// and from a pre-fix revision: the page callback `playUntilHead` hands to
// `page.evaluate`, and the CONTROL row's predicate plus any helper declared in
// its block. It runs the callback in plain node against a fake `__revealHarness`
// (a 1000 ms pass on `performance.now()`, `requestAnimationFrame` shimmed at 16
// ms) and scores the predicate on what comes back.
//
//   healthy transport                       -> the row must PASS on both
//   Codex's mutation, verbatim, + setPlaying that does nothing -> old PASSES (the
//                                             reproduction), fix FAILS
//   a transport that plays and never moves  -> fix FAILS
//
//   node scripts/verify/_probe-crosscheck-drawin-timing.mjs [--old=<rev>]

import ts from "typescript"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const GATE = "scripts/verify/assert-drawin-timing.mjs"
const OLD_REV = (process.argv.find((a) => a.startsWith("--old=")) ?? "--old=ee920c9c").slice(6)

const walk = (n, f) => { f(n); n.forEachChild((c) => walk(c, f)) }
function harvest(src) {
  const sf = ts.createSourceFile("g.mjs", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  let cb = null
  let ctl = null
  walk(sf, (n) => {
    if (!cb && ts.isVariableDeclaration(n) && n.name.getText() === "playUntilHead") {
      walk(n.initializer, (m) => {
        if (!cb && ts.isCallExpression(m) && m.expression.getText() === "R") cb = m.arguments[0].getText()
      })
    }
    if (
      !ctl && ts.isCallExpression(n) && n.expression.getText() === "say" && n.arguments[1] &&
      ts.isStringLiteralLike(n.arguments[1]) && n.arguments[1].text.startsWith("CONTROL · that sample landed mid-pass")
    ) ctl = n
  })
  if (!cb || !ctl) throw new Error(`could not find ${cb ? "" : "playUntilHead's page callback "}${ctl ? "" : "the CONTROL row"}`)
  let blk = ctl.parent
  while (blk && !ts.isBlock(blk)) blk = blk.parent
  const helpers = blk.statements
    .filter((s) => ts.isVariableStatement(s) && s.declarationList.declarations[0].name.getText() === "sampleMoved")
    .map((s) => s.getText()).join("\n")
  return { cb, pred: ctl.arguments[0].getText(), helpers }
}

function fakeHarness({ moves, playOn }) {
  const PASS = 1000
  let playing = false
  let head = 0
  let t0 = 0
  let from = 0
  const now = () => performance.now()
  const cur = () => (playing && moves ? Math.min(1, from + (now() - t0) / PASS) : head)
  return {
    setProgress(p) { head = p },
    setPlaying(on) {
      if (!playOn) return
      if (on && !playing) { from = head; t0 = now() }
      if (!on && playing) head = cur()
      playing = on
    },
    isPlaying: () => playing,
    getProgress: () => cur(),
    getClock: () => cur(),
  }
}

const MUT_FROM = "const head0 = h.getProgress()"
const MUT_TO = "h.getProgress = h.getClock = () => 0.4; const head0 = h.getProgress()"

async function run(H, harness, mutate) {
  let cb = H.cb
  if (mutate) {
    if (!cb.includes(MUT_FROM)) throw new Error("Codex's line is not in the callback; the mutation would not land")
    cb = cb.replace(MUT_FROM, MUT_TO)
  }
  globalThis.window = { __revealHarness: harness }
  globalThis.requestAnimationFrame = (f) => setTimeout(() => f(performance.now()), 16)
  harness.setProgress(0)
  const def = await eval(cb)([0.3, 0.5, 3500])
  const defHead = def.head
  const ok = eval(`(() => { ${H.helpers}\n return (${H.pred}) })()`)
  return { ok, def }
}

let bad = 0
const expect = (name, r, want) => {
  const good = r.ok === want
  if (!good) bad++
  console.log(
    `${good ? "PASS" : "FAIL"}  ${name}: row ${r.ok ? "passes" : "fails"}, expected ${want ? "pass" : "fail"}` +
      `  (head0 ${r.def.head0.toFixed(3)} head ${r.def.head.toFixed(3)} playing ${r.def.playing} landed ${r.def.landed})`,
  )
}

const OLD = execFileSync("git", ["show", `${OLD_REV}:${GATE}`], { cwd: ROOT, encoding: "utf8" })
const NEW = readFileSync(join(ROOT, GATE), "utf8")
for (const [tag, src, isFix] of [[`old ${OLD_REV}`, OLD, false], ["fix", NEW, true]]) {
  const H = harvest(src)
  expect(`${tag} · healthy transport`, await run(H, fakeHarness({ moves: true, playOn: true }), false), true)
  expect(`${tag} · CODEX MUTATION head frozen at 0.4, setPlaying a no-op`,
    await run(H, fakeHarness({ moves: true, playOn: false }), true), !isFix)
  if (isFix) expect(`${tag} · plays but the head never leaves 0.4`, await run(H, (() => {
    const h = fakeHarness({ moves: false, playOn: true }); h.setProgress = () => {}; h.getProgress = h.getClock = () => 0.4; return h
  })(), false), false)
}
console.log(`\n${bad === 0 ? "SOUND" : "BROKEN"}: ${5 - bad} of 5 expectations held`)
process.exit(bad === 0 ? 0 : 1)
