// Writes a GATE_MUTATE_FILE JSON (scripts/verify/_ts-load.mjs) that swaps ONE exact
// piece of lib/solid-mask.ts text, for the must-fail controls of bench.mjs. Nothing on
// disk changes; the loader substitutes the text, and its `was` guard fails loudly
// when the source has moved.
//
//   node scripts/verify/solid-bench/make-mutant.mjs --control=canvas-edge-only --out=m.json
//   node scripts/verify/solid-bench/make-mutant.mjs --control=pad0 --out=m.json
//        [--input=hero|o|shapes] [--static]   passed on to bench.mjs
//
// After writing, it RUNS bench.mjs twice, once clean and once with the mutant, and
// exits 1 unless the mutant changes at least one frame's signature. A control that
// does not move the signature cannot fail anything, so writing it is not a success.
// Exit 2 if either bench run itself fails.
//
// canvas-edge-only  the bounded flood's exterior rule put back to canvas edges only, so
//                   exterior pockets inside the ink's box count as holes (option A's
//                   control: bench must drop well below 120 of 120)
// pad0              the dirty rect padded by 0 instead of half the line plus 2, so the
//                   round caps and the line's half width are cut off (option B's control)
// noop-must-fail    the anchor swapped for itself: this script's own must-fail, exits 1
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { resolve, join } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath } from "node:url"

const REPO = fileURLToPath(new URL("../../../", import.meta.url))
const FILE = "lib/solid-mask.ts"
const CONTROLS = {
  "canvas-edge-only": {
    find: "if (cx === x0 || cy === y0 || cx === x1 || cy === y1) touchesBorder = true",
    text: "if (cx === 0 || cy === 0 || cx === width - 1 || cy === height - 1) touchesBorder = true",
  },
  pad0: {
    find: "const dirtyPad = Math.ceil(ctx.lineWidth / 2) + 2",
    text: "const dirtyPad = 0",
  },
  // make-mutant's own must-fail: swaps the anchor for itself, so the source is
  // unchanged and the signature cannot move. This run MUST exit 1.
  "noop-must-fail": {
    find: "const dirtyPad = Math.ceil(ctx.lineWidth / 2) + 2",
    text: "const dirtyPad = Math.ceil(ctx.lineWidth / 2) + 2",
  },
}
const control = (process.argv.find((a) => a.startsWith("--control=")) ?? "").slice(10)
const out = (process.argv.find((a) => a.startsWith("--out=")) ?? "").slice(6)
const c = CONTROLS[control]
if (!c) throw new Error(`--control must be one of ${Object.keys(CONTROLS).join(", ")}`)
if (!out) throw new Error("--out=<file> is required")
const src = readFileSync(REPO + FILE, "utf8")
const pos = src.indexOf(c.find)
if (pos < 0) throw new Error(`${control}: anchor not found in ${FILE}`)
if (src.indexOf(c.find, pos + 1) >= 0) throw new Error(`${control}: anchor is not unique in ${FILE}`)
writeFileSync(out, JSON.stringify({ [FILE]: [{ pos, end: pos + c.find.length, text: c.text, was: c.find }] }))
console.log(`wrote ${out}: ${control} at byte ${pos}`)

const BENCH = REPO + "scripts/verify/solid-bench/bench.mjs"
const pass = process.argv.filter((a) => a.startsWith("--input=") || a === "--static")
const dir = mkdtempSync(join(tmpdir(), "solid-mutant-"))
const benchSigs = (label, env) => {
  const f = join(dir, `${label}.json`)
  try {
    execFileSync(process.execPath, [BENCH, ...pass, `--sigs=${f}`], { env: { ...process.env, ...env }, stdio: ["ignore", "ignore", "inherit"] })
  } catch (e) {
    console.error(`${control}: the ${label} bench run failed (${e.status ?? e.message}), so the control is UNCHECKED`)
    rmSync(dir, { recursive: true, force: true })
    process.exit(2)
  }
  return JSON.parse(readFileSync(f, "utf8"))
}
const base = benchSigs("clean", { GATE_MUTATE_FILE: "" })
const mut = benchSigs("mutant", { GATE_MUTATE_FILE: resolve(out) })
rmSync(dir, { recursive: true, force: true })
if (base.length === 0 || base.length !== mut.length) {
  console.error(`${control}: ${base.length} clean frames vs ${mut.length} mutant frames, so nothing was compared`)
  process.exit(2)
}
const changed = base.filter((s, i) => s !== mut[i]).length
console.log(`${control}: the mutant changes ${changed} of ${base.length} frame signatures`)
if (changed === 0) {
  console.error(`${control}: FAIL, the control does not move the signature, so it cannot fail bench --against`)
  process.exit(1)
}
