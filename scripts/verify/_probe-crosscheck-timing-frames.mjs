/**
 * F113 finding 7, Codex 2026-09-18. `assert-timing-frames.mjs` had four holes:
 * a missing preset-state.json printed PASS (swapped `check()` args), a state
 * file with no fields passed every comparison (undefined equals undefined),
 * one fresh PNG vouched for every stale one, and the step-into-park bound
 * included the step it bounded, so it could not fail.
 *
 * This probe runs the REAL gate, unmodified, in a scratch repo: the gate and
 * `_capture-freshness.mjs` are copied in, `node_modules` is linked, `lib/`
 * holds one source file dated 2000, and each case gets a clone of the real
 * `docs/verification/timing-origin/after` frames with one mutation applied.
 * Codex's four mutations must go red, the known-bads must go red, and the
 * untouched clone must stay green.
 *
 *   node scripts/verify/_probe-crosscheck-timing-frames.mjs               the gate on disk
 *   node scripts/verify/_probe-crosscheck-timing-frames.mjs --gate=<file> another copy (the pre-fix one)
 *
 * Exit 0 only when every case lands where it should. Writes nothing in the repo.
 */
import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, mkdirSync, copyFileSync, symlinkSync, writeFileSync, readdirSync, renameSync, rmSync, utimesSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas } from "@napi-rs/canvas"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..", "..")
const gateArg = process.argv.find((a) => a.startsWith("--gate="))
const GATE = gateArg ? gateArg.slice(7) : join(HERE, "assert-timing-frames.mjs")
const SRC = join(ROOT, "docs", "verification", "timing-origin", "after")

const T = mkdtempSync(join(tmpdir(), "fs-probe-timing-frames-"))
mkdirSync(join(T, "scripts", "verify"), { recursive: true })
copyFileSync(GATE, join(T, "scripts", "verify", "assert-timing-frames.mjs"))
copyFileSync(join(HERE, "_capture-freshness.mjs"), join(T, "scripts", "verify", "_capture-freshness.mjs"))
symlinkSync(join(ROOT, "node_modules"), join(T, "node_modules"))
mkdirSync(join(T, "lib"))
writeFileSync(join(T, "lib", "a.ts"), "export {}\n")
utimesSync(join(T, "lib", "a.ts"), new Date("2000-01-01"), new Date("2000-01-01"))

function stage(label) {
  const d = join(T, "docs", "verification", "timing-origin", label)
  mkdirSync(dirname(d), { recursive: true })
  execFileSync("cp", ["-c", "-R", SRC, d]) // APFS clone, costs no disk
  const now = new Date()
  for (const f of readdirSync(d)) utimesSync(join(d, f), now, now)
  return d
}
/** Replace an arm's frames with flat grey PNGs whose envelope is exactly `e`. */
function synthArm(d, prefix, e) {
  for (const f of readdirSync(d)) if (f.startsWith(prefix + "_") && f.endsWith(".png")) rmSync(join(d, f))
  const png = (v) => {
    const c = createCanvas(8, 8)
    const g = c.getContext("2d")
    g.fillStyle = `rgb(${100 + v},${100 + v},${100 + v})`
    g.fillRect(0, 0, 8, 8)
    return c.toBuffer("image/png")
  }
  writeFileSync(join(d, `${prefix}_00_before.png`), png(0))
  e.forEach((v, i) => writeFileSync(join(d, `${prefix}_${String(i + 1).padStart(2, "0")}.png`), png(v)))
}
function run(label) {
  const r = spawnSync(process.execPath, [join(T, "scripts", "verify", "assert-timing-frames.mjs"), `--label=${label}`], { encoding: "utf8" })
  const rows = (r.stdout || "").split("\n").filter((l) => /^(PASS|FAIL)  /.test(l))
  return { code: r.status, rows, fails: rows.filter((l) => l.startsWith("FAIL")) }
}

const SNAP = "no snap-back to full strength"
const cases = [
  {
    name: "good: the real `after` frames, untouched and fresh",
    mutate: () => {},
    want: (r) => r.code === 0 && r.fails.length === 0 && r.rows.length >= 29,
  },
  {
    name: "codex 7a: preset-state.json written under another name",
    mutate: (d) => renameSync(join(d, "preset-state.json"), join(d, "preset-state.missing.json")),
    want: (r) => r.code === 1 && r.fails.some((l) => l.includes("resolved-state evidence present")),
  },
  {
    name: "codex 7b: preset-state holds afterStack {materialPreset: softGel} and fromClean {}",
    mutate: (d) => writeFileSync(join(d, "preset-state.json"), JSON.stringify({ afterStack: { materialPreset: "softGel" }, fromClean: {} })),
    want: (r) => r.code === 1 && r.fails.some((l) => l.includes("resets every COMPOSITION rail")) && r.fails.some((l) => l.includes("body material carried over")),
  },
  {
    name: "codex 7c: pulse_live_01.png dated 1970, every other file fresh",
    mutate: (d) => utimesSync(join(d, "pulse_live_01.png"), new Date(0), new Date(0)),
    want: (r) => r.code === 1 && r.fails.some((l) => l.includes("PROVENANCE")),
  },
  {
    /* OPEN, and pinned so a change to it is seen. With the step into the park
     * taken out of its own scale, this curve still passes: the 10 it jumped
     * earlier is larger than the 8 into the park, and 8 is below the peak of 10.
     * Whether a park at 80% of the peak after returning to 0 is a snap-back is a
     * ruling about the feature, not a hole in the instrument, so the bar is not
     * moved to catch it. The known-bad below is the one only the bound can see. */
    name: "codex 7d (OPEN): pulse_live envelope [0, 10, 0, 8 x29] still PASSES the snap-back row",
    mutate: (d) => synthArm(d, "pulse_live", [0, 10, 0, ...Array(29).fill(8)]),
    want: (r) => r.rows.some((l) => l.startsWith("PASS") && l.includes(SNAP) && l.includes("step into the park 8.00 vs the layer's own step scale 10.00")),
    report: true,
  },
  {
    name: "known-bad: a jump into the park bigger than any step the layer took while active",
    mutate: (d) => synthArm(d, "pulse_live", [5, 10, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 1, ...Array(16).fill(9)]),
    want: (r) => r.code === 1 && r.fails.some((l) => l.includes(SNAP)),
  },
  {
    name: "known-good: the same active window parking by an ordinary step",
    mutate: (d) => synthArm(d, "pulse_live", [5, 10, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 4, 5, 1, ...Array(16).fill(4)]),
    want: (r) => !r.fails.some((l) => l.includes(SNAP)) && r.rows.some((l) => l.startsWith("PASS") && l.includes(SNAP)),
  },
  {
    name: "class: fromClean is missing one composition key (stackOrder)",
    mutate: (d) => {
      const p = join(d, "preset-state.json")
      const s = JSON.parse(readFileSync(p, "utf8"))
      delete s.fromClean.stackOrder
      delete s.afterStack.stackOrder
      writeFileSync(p, JSON.stringify(s))
    },
    want: (r) => r.code === 1 && r.fails.length > 0,
  },
  {
    name: "class: preset-state.json is dated 1970 while every PNG is fresh",
    mutate: (d) => utimesSync(join(d, "preset-state.json"), new Date(0), new Date(0)),
    want: (r) => r.code === 1 && r.fails.some((l) => l.includes("PROVENANCE")),
  },
]

let bad = 0
cases.forEach((c, i) => {
  const label = `case${i}`
  const d = stage(label)
  c.mutate(d)
  // A fresh file written by the mutation must not be older than lib/; it is not.
  const r = run(label)
  const ok = c.want(r)
  if (!ok) bad++
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}  ->  exit ${r.code}, ${r.rows.length} rows, ${r.fails.length} FAIL`)
  for (const l of r.fails) console.log(`        ${l.slice(0, 190)}`)
  if (c.report) for (const l of r.rows.filter((x) => x.includes(SNAP))) console.log(`        ${l.slice(0, 190)}`)
})
rmSync(T, { recursive: true, force: true })
console.log(`\n_probe-crosscheck-timing-frames: ${cases.length - bad} of ${cases.length} cases as expected (gate ${GATE.startsWith(ROOT) ? GATE.slice(ROOT.length + 1) : GATE})`)
process.exit(bad ? 1 : 0)
