// HEADED vs HEADLESS, THE SAME FIVE GATES, MEASURED — not preferred.
//
// `docs/DISPATCH.md` §3 says headless is fine and cites 121 rAF ticks headless
// vs 120 headed. Commit `3884dd78` says "all verification runs HEADED with
// Metal, never headless". `docs/RUN-QUEUE.md` says one gate dies at 30 s
// headless. Three claims, one repo, and no artefact settling them. This runs
// each gate twice, changing exactly one variable, and records wall time, exit
// code and row counts for both.
//
//   FS_PORT=<port> node scripts/verify/_probe-headed-matrix.mjs
import { spawnSync } from "node:child_process"
import { writeFileSync, mkdirSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "..", "docs", "verification", "harness-2026-08-28")
mkdirSync(OUT, { recursive: true })

// four that open with `waitUntil: "networkidle"`, and one that does not —
// the control that says whether `networkidle` is the variable at all.
const GATES = [
  { file: "assert-fusion-combo-ui.mjs", networkidle: true },
  { file: "assert-letter-seam.mjs", networkidle: true },
  { file: "assert-drawin-attrs.mjs", networkidle: true },
  { file: "assert-texture-motion.mjs", networkidle: true },
  { file: "assert-fusion-two-dead.mjs", networkidle: false },
]

const rows = (s) => ({
  pass: (s.match(/^\s*(?:\*\*\* )?PASS\b/gm) || []).length,
  fail: (s.match(/^\s*(?:\*\*\* )?FAIL(?:ED)?\b/gm) || []).length,
  unswept: (s.match(/^\s*UNSWEPT\b/gm) || []).length,
})

function run(file, headed) {
  const t0 = Date.now()
  const r = spawnSync(process.execPath, [join(__dirname, file)], {
    encoding: "utf8",
    cwd: join(__dirname, "..", ".."),
    env: { ...process.env, ...(headed ? { FS_HEADED: "1" } : {}) },
    timeout: 600000,
  })
  const out = (r.stdout || "") + (r.stderr || "")
  return { wallMs: Date.now() - t0, exit: r.status, timedOut: r.signal === "SIGTERM", ...rows(out), out }
}

const results = []
for (const g of GATES) {
  for (const headed of [false, true]) {
    const mode = headed ? "headed" : "headless"
    const r = run(g.file, headed)
    writeFileSync(join(OUT, `matrix-${g.file.replace(/\.mjs$/, "")}-${mode}.txt`), r.out)
    const { out, ...rest } = r
    results.push({ gate: g.file, networkidle: g.networkidle, mode, ...rest })
    console.log(
      `${g.file.padEnd(30)} ${mode.padEnd(9)} exit=${String(rest.exit).padEnd(4)} ` +
        `${(rest.wallMs / 1000).toFixed(1).padStart(6)}s  rows ${rest.pass}P/${rest.fail}F/${rest.unswept}U`,
    )
  }
}
writeFileSync(join(OUT, "headed-matrix.json"), JSON.stringify(results, null, 2) + "\n")

console.log("\n── the comparison, per gate ──")
for (const g of GATES) {
  const a = results.find((r) => r.gate === g.file && r.mode === "headless")
  const b = results.find((r) => r.gate === g.file && r.mode === "headed")
  const same = a.exit === b.exit && a.pass === b.pass && a.fail === b.fail
  console.log(
    `${g.file.padEnd(30)} ${same ? "IDENTICAL VERDICT" : "*** DIVERGED ***"}  ` +
      `headless ${(a.wallMs / 1000).toFixed(1)}s vs headed ${(b.wallMs / 1000).toFixed(1)}s ` +
      `(headed ${(b.wallMs / a.wallMs).toFixed(2)}x)`,
  )
}
