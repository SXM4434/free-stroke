// IS THE MODE THE VARIABLE, OR IS THE GATE JUST NOISY?
//
// One A/B pass over five gates diverged on three of them, and not in one
// direction: headless lost `assert-letter-seam`, headed lost
// `assert-drawin-attrs`. A single pair cannot tell "headed changes the verdict"
// from "this gate does not give the same answer twice", and attributing noise to
// a mode is how a repo ends up with a rule nobody can reproduce.
//
// So this runs the SAME-MODE repeat as its control, the shape explainer 37 used:
// if headless-vs-headless disagrees as often as headless-vs-headed, the mode is
// not the variable. Every run also records whether the page reloaded under it,
// because a dev server three lanes are editing can destroy an execution context
// mid-run and that red is not a regression.
//
//   FS_PORT=<port> node scripts/verify/_probe-mode-noise.mjs [reps]
import { spawnSync } from "node:child_process"
import { writeFileSync, mkdirSync, statSync, readdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "harness-2026-08-28")
mkdirSync(OUT, { recursive: true })

const REPS = Number(process.argv[2] || 3)
const GATES = ["assert-letter-seam.mjs", "assert-drawin-attrs.mjs", "assert-texture-motion.mjs"]

/** newest mtime under the app source the dev server watches — a run that
 *  straddles a change to any of it was reading a page mid-rebuild. */
function sourceStamp() {
  let newest = 0
  const walk = (d) => {
    let ents = []
    try {
      ents = readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of ents) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(tsx?|css)$/.test(e.name)) newest = Math.max(newest, statSync(p).mtimeMs)
    }
  }
  for (const d of ["app", "components", "lib"]) walk(join(ROOT, d))
  return newest
}

const rows = (s) => ({
  pass: (s.match(/^\s*(?:\*\*\* )?PASS\b/gm) || []).length,
  fail: (s.match(/^\s*(?:\*\*\* )?FAIL(?:ED)?\b/gm) || []).length,
})

const results = []
for (let rep = 1; rep <= REPS; rep++) {
  for (const gate of GATES) {
    for (const headed of [false, true]) {
      const mode = headed ? "headed" : "headless"
      const before = sourceStamp()
      const t0 = Date.now()
      const r = spawnSync(process.execPath, [join(__dirname, gate)], {
        encoding: "utf8",
        cwd: ROOT,
        env: { ...process.env, ...(headed ? { FS_HEADED: "1" } : {}) },
        timeout: 600000,
      })
      const out = (r.stdout || "") + (r.stderr || "")
      const after = sourceStamp()
      const rec = {
        rep,
        gate,
        mode,
        exit: r.status,
        wallMs: Date.now() - t0,
        ...rows(out),
        sourceChangedUnderIt: after !== before,
        contextDestroyed: out.includes("Execution context was destroyed"),
        failedRows: (out.match(/^\s*FAIL\s+.*$/gm) || []).map((s) => s.trim().slice(0, 110)),
      }
      results.push(rec)
      writeFileSync(join(OUT, `noise-${gate.replace(/\.mjs$/, "")}-${mode}-r${rep}.txt`), out)
      console.log(
        `r${rep} ${gate.padEnd(26)} ${mode.padEnd(9)} exit=${String(rec.exit).padEnd(4)} ` +
          `${(rec.wallMs / 1000).toFixed(1).padStart(6)}s ${rec.pass}P/${rec.fail}F` +
          `${rec.contextDestroyed ? "  [CONTEXT DESTROYED]" : ""}${rec.sourceChangedUnderIt ? "  [SOURCE MOVED]" : ""}`,
      )
      writeFileSync(join(OUT, "mode-noise.json"), JSON.stringify(results, null, 2) + "\n")
    }
  }
}

console.log("\n── verdict spread per gate ──")
for (const gate of GATES) {
  for (const mode of ["headless", "headed"]) {
    const rs = results.filter((r) => r.gate === gate && r.mode === mode)
    const exits = rs.map((r) => r.exit).join(",")
    const stable = new Set(rs.map((r) => `${r.exit}/${r.pass}/${r.fail}`)).size === 1
    console.log(`${gate.padEnd(26)} ${mode.padEnd(9)} exits [${exits}]  ${stable ? "stable" : "*** UNSTABLE WITHIN ONE MODE ***"}`)
  }
}
