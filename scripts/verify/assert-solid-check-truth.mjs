// ASSERT-SOLID-CHECK-TRUTH: a Solid debug check nobody measured must not read green.
//
// From 2026-08-02 to 2026-10-24 the Solid diagnostics panel printed five checks
// (outer self-intersects, hole windings, hole self-intersects, hole outside
// outer, holes overlap) from fields `buildMaskSolid` never computed. The value
// was `undefined`, the panel did `v ? "YES - BAD" : "NO"`, and every build
// showed a green NO. The only signal was five tsc errors.
//
// This gate checks the three places that bug lived:
//   A. lib/solid-check-label.ts prints null and undefined as NOT MEASURED in a
//      tone that is not the good one. false is NO, true is YES - BAD.
//   B. components/viewport-3d.tsx prints every Solid check through that label,
//      and no two-state `? "YES - BAD" : "NO"` is left anywhere in it.
//   C. lib/geometry-engines.ts never copies one of the five off
//      `result.diagnostics` while MaskSolidDiagnostics (lib/solid-mask.ts) lacks
//      that field. When someone really computes one, add it to the interface
//      and this row lets the copy through.
//
// The same checks also run against planted false greens (the old label, the
// old JSX, the old assignment). Each one must FAIL, or the gate is blind.
//
// Usage: node scripts/verify/assert-solid-check-truth.mjs
// battery: model
import { readFileSync } from "node:fs"
import { fileURLToPath, pathToFileURL } from "node:url"
import { dirname, join } from "node:path"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const read = (p) => readFileSync(join(ROOT, p), "utf8")

const CHECK_FIELDS = ["outerSelfIntersects", "anyHoleSelfIntersects", "anyHoleOutsideOuter", "holesOverlap"]
const ALL_FIELDS = [...CHECK_FIELDS, "holeWindings"]

/* A. The label. Returns a list of problems, empty when honest. */
function checkLabel(label, classes) {
  const problems = []
  for (const v of [null, undefined]) {
    const r = label(v)
    if (r.text !== "NOT MEASURED") problems.push(`label(${v}) reads "${r.text}", not NOT MEASURED`)
    if (r.tone === "good" || /green/.test(classes[r.tone] ?? "")) problems.push(`label(${v}) is shown in the good tone`)
  }
  const f = label(false)
  if (f.text !== "NO" || f.tone !== "good") problems.push(`label(false) reads "${f.text}" in ${f.tone}`)
  const t = label(true)
  if (t.text !== "YES - BAD" || t.tone !== "bad") problems.push(`label(true) reads "${t.text}" in ${t.tone}`)
  return problems
}

/* B. The panel source. */
function checkPanel(src) {
  const problems = []
  const twoState = src.match(/\?\s*"YES - BAD"\s*:\s*"NO"/g)
  if (twoState) problems.push(`${twoState.length} two-state "YES - BAD" : "NO" left`)
  for (const f of CHECK_FIELDS) {
    if (!new RegExp(`solidCheckLabel\\(d\\.${f}\\)\\.text`).test(src)) problems.push(`d.${f} is not printed through solidCheckLabel`)
  }
  for (const f of CHECK_FIELDS) {
    if (!src.includes(`className={SOLID_CHECK_CLASS[solidCheckLabel(d.${f}).tone]}`)) problems.push(`d.${f} row colour does not come from the label tone`)
    if (new RegExp(`d\\.${f}\\s*\\?\\s*"text-`).test(src)) problems.push(`d.${f} still has a two-state colour ternary`)
  }
  // The holeWindings fallback must be the grey NOT MEASURED cell itself, right after the array branch.
  if (!/Array\.isArray\(d\.holeWindings\)\s*\?\s*\(\s*<span[^>]*>[^\n]*<\/span>\s*\)\s*:\s*\(\s*<span className=\{SOLID_CHECK_CLASS\.unmeasured\}>NOT MEASURED<\/span>\s*\)/.test(src))
    problems.push("holeWindings has no grey NOT MEASURED fallback")
  return problems
}

/* C. The engine source against the diagnostics interface. */
function checkEngine(engineSrc, maskSrc) {
  const problems = []
  const body = maskSrc.match(/export interface MaskSolidDiagnostics\s*\{([\s\S]*?)\n\}/)
  if (!body) return ["MaskSolidDiagnostics interface not found in lib/solid-mask.ts"]
  for (const f of ALL_FIELDS) {
    // Only a required field counts as measured. An optional one can be declared and never set.
    const declared = new RegExp(`^\\s*${f}\\s*:`, "m").test(body[1])
    if (declared) continue
    // Not measured: the default and every assignment must be null, so nothing can read as a green NO.
    if (!new RegExp(`^\\s*${f}:\\s*null as `, "m").test(engineSrc)) problems.push(`SOLID_DEBUG.${f} does not default to null`)
    for (const m of engineSrc.matchAll(new RegExp(`SOLID_DEBUG\\.${f}\\s*=\\s*([^\\n]+)`, "g"))) {
      if (m[1].trim() !== "null") problems.push(`SOLID_DEBUG.${f} is set to ${m[1].trim()}, not null, while unmeasured`)
    }
  }
  return problems
}

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " -- " + detail : ""}`)
}

const mod = await import(pathToFileURL(join(ROOT, "lib/solid-check-label.ts")).href)
const panel = read("components/viewport-3d.tsx")
const engine = read("lib/geometry-engines.ts")
const mask = read("lib/solid-mask.ts")

const a = checkLabel(mod.solidCheckLabel, mod.SOLID_CHECK_CLASS)
say(a.length === 0, "A. an unmeasured check reads NOT MEASURED, not a green NO", a.join(" | ") || "null, undefined, false, true all correct")
const b = checkPanel(panel)
say(b.length === 0, "B. the Solid panel prints every check through the label", b.join(" | ") || `${CHECK_FIELDS.length} checks and holeWindings`)
const c = checkEngine(engine, mask)
say(c.length === 0, "C. no check is copied from a field that does not exist", c.join(" | ") || `${ALL_FIELDS.length} fields`)

/* Planted false greens. Each must be caught. */
console.log("\nPlanted faults (each must be CAUGHT):")
const oldLabel = (v) => (v ? { text: "YES - BAD", tone: "bad" } : { text: "NO", tone: "good" })
const oldPanel = panel.replace(
  /\{SOLID_CHECK_CLASS\[solidCheckLabel\(d\.outerSelfIntersects\)\.tone\]\}>\s*\{solidCheckLabel\(d\.outerSelfIntersects\)\.text\}/,
  '{d.outerSelfIntersects ? "text-red-400 font-bold" : "text-green-400"}>\n{d.outerSelfIntersects ? "YES - BAD" : "NO"}',
)
const oldEngine = engine.replace(/SOLID_DEBUG\.holesOverlap = null/, "SOLID_DEBUG.holesOverlap = result.diagnostics.holesOverlap")
const falseDefault = engine.replace(/^(\s*)anyHoleOutsideOuter: null as boolean \| null,/m, "$1anyHoleOutsideOuter: false,")
const falseAssign = engine.replace(/SOLID_DEBUG\.anyHoleSelfIntersects = null/, "SOLID_DEBUG.anyHoleSelfIntersects = false")
const oldClass = panel.replace("className={SOLID_CHECK_CLASS[solidCheckLabel(d.holesOverlap).tone]}", '{d.holesOverlap ? "text-red-400 font-bold" : "text-green-400"}'.replace(/^/, "className="))
const greenWinds = panel.replace("<span className={SOLID_CHECK_CLASS.unmeasured}>NOT MEASURED</span>", '<span className="text-green-400">NOT MEASURED</span>')
const plants = [
  ["old two-state label", true, checkLabel(oldLabel, mod.SOLID_CHECK_CLASS)],
  ["old outerSelfX JSX", oldPanel !== panel, checkPanel(oldPanel)],
  ["old holesOverlap copy", oldEngine !== engine, checkEngine(oldEngine, mask)],
  ["false default (anyHoleOutsideOuter)", falseDefault !== engine, checkEngine(falseDefault, mask)],
  ["false assignment (anyHoleSelfIntersects)", falseAssign !== engine, checkEngine(falseAssign, mask)],
  ["old green class with new text (holesOverlap)", oldClass !== panel, checkPanel(oldClass)],
  ["green holeWindings fallback", greenWinds !== panel, checkPanel(greenWinds)],
]
for (const [name, planted, problems] of plants) {
  const caught = planted && problems.length > 0
  say(caught, `planted: ${name}`, !planted ? "could not plant (source moved); the gate cannot prove it sees this" : caught ? `caught: ${problems[0]}` : "NOT caught")
}

console.log(pass ? "\nALL SOLID CHECK TRUTH ROWS PASS" : "\nSOLID CHECK TRUTH FAILED")
process.exit(pass ? 0 : 1)
