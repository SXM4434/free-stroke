// _probe-crosscheck-register-light.mjs, F113 finding 8 (Codex, 2026-09-18).
//
// `verify-register-light.mjs` found orbit and then trusted it. Codex's mutation:
// replace the park `await scrubTo(solidT)` with `await scrubTo(0)`. Discovery
// still finds orbit, every frame is taken at the wrong transport position, and
// the script exits 0. Collected console and page errors were printed and never
// counted.
//
// This probe runs the capture script's OWN TEXT, from a pre-fix revision and from
// the working tree. It rewrites only the import specifiers (by TypeScript AST) and,
// for the mutation, the one `await scrubTo(solidT)` expression statement that is
// the park (also found by AST, so the replacement cannot land on the discovery
// loop), then runs the result as a child process and reads its exit code.
//
// Default mode drives a FAKE page: a scrub input, a phase readout that is `orbit`
// from 9.50 s, a Play button, and a screenshot that paints a dark block only while
// the phase is `orbit`. Cases, each against old and fix:
//   healthy                                   -> exit 0 on both
//   CODEX: `scrubTo(0)` for the park          -> old exit 0 (the reproduction), fix exit 1
//   a console error during the run            -> old exit 0, fix exit 1
//   phase reads orbit but the render is blank -> old exit 0, fix exit 1
//
// `--live` drives the REAL page instead (headed, the repo launcher, FS_PORT), and
// runs healthy and Codex's mutation against old and fix. Frames go to the scratch
// dir given by --out= (default a tmpdir), never over committed evidence.
//
//   node scripts/verify/_probe-crosscheck-register-light.mjs [--old=<rev>]
//   FS_PORT=3105 FS_HEADED=1 node scripts/verify/_probe-crosscheck-register-light.mjs --live

import ts from "typescript"
import { execFileSync, spawnSync } from "node:child_process"
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const GATE = "scripts/verify/verify-register-light.mjs"
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).slice(k.length + 3)
const OLD_REV = arg("old", "a14aa777")
const LIVE = process.argv.includes("--live")
const WORK = mkdtempSync(join(tmpdir(), "probe-register-light-"))
const OUT = arg("out", join(WORK, "frames"))
const CANVAS = import.meta.resolve("@napi-rs/canvas")
const libUrl = (f) => pathToFileURL(join(__dirname, "lib", f)).href

const FAKE = `
import { createCanvas } from ${JSON.stringify(CANVAS)}
import { writeFileSync } from "node:fs"
const ORBIT_FROM = 9.5, END = 12.37
let t = 0
const phase = () => (t >= ORBIT_FROM && t < END ? "orbit" : t < 3 ? "draw" : "breath")
class HTMLInputElement {
  get value() { return String(this._v ?? 0) }
  set value(v) { this._v = v }
  dispatchEvent() { t = Number(this._v); return true }
}
const scrub = new HTMLInputElement()
scrub.max = String(END)
const doc = {
  querySelector(sel) {
    if (sel === "[data-hero-scrub]") return scrub
    if (sel === "[data-hero-phase]") return { dataset: { heroPhase: phase() } }
    if (sel === "[data-hero-play]") return { textContent: "Play" }
    return null
  },
}
const win = {
  HTMLInputElement,
  __captureHarness: { orbitView: () => true },
  __revealHarness: { setProgress() {}, getProgress: () => 1 },
}
function newPage() {
  const on = {}
  const clickable = { click: async () => {}, getByRole: () => clickable }
  return {
    on(ev, cb) { on[ev] = cb },
    async goto() {
      if (process.env.PROBE_CONSOLE_ERROR) on.console?.({ type: () => "error", text: () => "planted by the probe" })
    },
    async waitForFunction(fn, a) { globalThis.window = win; globalThis.document = doc; return fn(a) },
    async waitForTimeout() {},
    async evaluate(fn, a) { globalThis.window = win; globalThis.document = doc; return fn(a) },
    getByRole: () => clickable,
    locator: () => ({
      first: () => ({
        async screenshot({ path }) {
          const c = createCanvas(1120, 302)
          const x = c.getContext("2d")
          x.fillStyle = "#fafafa"; x.fillRect(0, 0, 1120, 302)
          x.fillStyle = "#e4e4e4"; for (let i = 0; i < 1120; i += 20) x.fillRect(i, 0, 1, 302)
          if (phase() === "orbit" && !process.env.PROBE_BLANK) { x.fillStyle = "#303030"; x.fillRect(480, 90, 200, 40) }
          writeFileSync(path, c.toBuffer("image/png"))
        },
      }),
    }),
  }
}
export const chromium = { launch: async () => ({ newPage: async () => newPage(), close: async () => {} }) }
export const HERO_URL = "fake://desk-doodles"
`
const FAKE_PATH = join(WORK, "fake-browser.mjs")
writeFileSync(FAKE_PATH, FAKE)

function rewrite(src, mutate) {
  const sf = ts.createSourceFile("g.mjs", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const edits = []
  const parks = []
  const walk = (n) => {
    if (ts.isImportDeclaration(n)) {
      const spec = n.moduleSpecifier.text
      const to = spec === "./lib/browser.mjs" ? (LIVE ? libUrl("browser.mjs") : pathToFileURL(FAKE_PATH).href)
        : spec === "./lib/dev-server.mjs" ? (LIVE ? libUrl("dev-server.mjs") : pathToFileURL(FAKE_PATH).href)
        : spec === "@napi-rs/canvas" ? CANVAS
        : null
      if (to) edits.push([n.moduleSpecifier.getStart(), n.moduleSpecifier.getEnd(), JSON.stringify(to)])
    }
    // The park: an expression statement `await scrubTo(solidT)`. The discovery
    // loop calls `scrubTo(t)`, so it cannot match.
    if (
      ts.isExpressionStatement(n) && ts.isAwaitExpression(n.expression) &&
      ts.isCallExpression(n.expression.expression) && n.expression.expression.expression.getText() === "scrubTo" &&
      n.expression.expression.arguments[0]?.getText() === "solidT"
    ) parks.push(n.expression.expression.arguments[0])
    n.forEachChild(walk)
  }
  walk(sf)
  if (edits.length < 2) throw new Error("could not find the gate's imports; the rewrite would not land")
  if (mutate) {
    if (parks.length !== 1) throw new Error(`expected one park \`await scrubTo(solidT)\`, found ${parks.length}`)
    edits.push([parks[0].getStart(), parks[0].getEnd(), "0"])
  }
  edits.sort((a, b) => b[0] - a[0])
  for (const [s, e, r] of edits) src = src.slice(0, s) + r + src.slice(e)
  return src
}

let n = 0
let bad = 0
function run(tag, src, { mutate = false, env = {} } = {}, wantExit) {
  const file = join(WORK, `gate-${++n}.mjs`)
  writeFileSync(file, rewrite(src, mutate))
  const out = join(OUT, `run-${n}`)
  mkdirSync(out, { recursive: true })
  const r = spawnSync("node", [file, out], { cwd: ROOT, env: { ...process.env, ...env }, encoding: "utf8", timeout: 240000 })
  const code = r.status
  const good = code === wantExit
  if (!good) bad++
  const why = (r.stdout + r.stderr).split("\n").filter((l) => l.startsWith("FAIL")).slice(0, 2).join(" | ")
  console.log(`${good ? "PASS" : "FAIL"}  ${tag}: exit ${code}, expected ${wantExit}${why ? `  (${why.slice(0, 220)})` : ""}`)
}

const OLD = execFileSync("git", ["show", `${OLD_REV}:${GATE}`], { cwd: ROOT, encoding: "utf8" })
const NEW = readFileSync(join(ROOT, GATE), "utf8")
for (const [tag, src, isFix] of [[`old ${OLD_REV}`, OLD, false], ["fix", NEW, true]]) {
  run(`${tag} · healthy`, src, {}, 0)
  run(`${tag} · CODEX MUTATION park at scrubTo(0)`, src, { mutate: true }, isFix ? 1 : 0)
  if (!LIVE) {
    run(`${tag} · a console error during the run`, src, { env: { PROBE_CONSOLE_ERROR: "1" } }, isFix ? 1 : 0)
    run(`${tag} · phase reads orbit, render is blank`, src, { env: { PROBE_BLANK: "1" } }, isFix ? 1 : 0)
  }
}
console.log(`\n${bad === 0 ? "SOUND" : "BROKEN"}: ${n - bad} of ${n} expectations held${LIVE ? " (live page)" : " (fake page)"}; frames in ${OUT}`)
process.exit(bad === 0 ? 0 : 1)
