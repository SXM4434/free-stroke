// IN-PROCESS MUTANTS OF ONE SELF-CONTAINED lib FILE, for a must-fail arm.
//
// `_ts-load.mjs` mutates through GATE_MUTATE_FILE, which is one mutation per
// PROCESS. The export-format gates want several known-bad builds of the same
// writer side by side in one run (the real writer, then the writer with one
// line broken), so this loads a private copy with text edits applied between
// reading and transpiling. Nothing on disk changes.
//
// Every edit names the exact text it replaces and that text must occur EXACTLY
// ONCE. A mutant whose target moved or doubled throws, because a mutant that
// silently changed nothing reads as a must-fail that held, which is a false
// accusation of the gate and a false acquittal of the code.
//
// Only for files whose imports are relative lib modules or node packages; the
// imports are resolved through the ordinary `loadTs`, unmutated.
import ts from "typescript"
import { readFileSync, existsSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { createRequire } from "node:module"
import { loadTs, ROOT } from "../_ts-load.mjs"

export function loadTsMutant(file, edits) {
  const abs = resolve(ROOT, file)
  let src = readFileSync(abs, "utf8")
  for (const [was, now] of edits) {
    const first = src.indexOf(was)
    if (first < 0) throw new Error(`mutant: ${file} no longer contains ${JSON.stringify(was)}`)
    if (src.indexOf(was, first + 1) >= 0) throw new Error(`mutant: ${file} contains ${JSON.stringify(was)} more than once`)
    src = src.slice(0, first) + now + src.slice(first + was.length)
  }
  const out = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: abs,
  }).outputText
  const exports = {}
  const module = { exports }
  const dir = dirname(abs)
  const nodeRequire = createRequire(abs)
  const req = (spec) => {
    if (!spec.startsWith(".") && !spec.startsWith("@/")) return nodeRequire(spec)
    const base = spec.startsWith("@/") ? resolve(ROOT, spec.slice(2)) : resolve(dir, spec)
    const hit = ["", ".ts", "/index.ts"].map((e) => base + e).find((p) => existsSync(p) && !existsSync(p + "/"))
    if (!hit) throw new Error(`mutant: cannot resolve ${spec} from ${file}`)
    return loadTs(hit)
  }
  // eslint-disable-next-line no-new-func
  new Function("exports", "require", "module", "__filename", "__dirname", out)(exports, req, module, abs, dir)
  return module.exports
}
