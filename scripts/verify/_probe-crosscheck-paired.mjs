/**
 * F113 finding 1, Codex 2026-09-18. `makePaired` scored a crashed or coerced
 * side as a clean result. This probe replays Codex's exact mutations against
 * the real `lib/paired.mjs` and requires each to FAIL the row, plus the
 * known-goods that must still PASS, so the fix is not blind in the other
 * direction (a paired() that fails everything would also turn the bads red).
 *
 *   node scripts/verify/_probe-crosscheck-paired.mjs      exit 0 = all arms as expected
 */
import { makePaired } from "./lib/paired.mjs"

const rows = []
const paired = makePaired((ok, name, why) => rows.push({ ok, name, why }))
const quiet = (fn) => {
  const log = console.log
  console.log = () => {}
  try {
    return fn()
  } finally {
    console.log = log
  }
}

const cases = [
  // known-good: must PASS
  ["good: healthy pair", true, () => paired("g", () => true, "c", () => false)],
  ["good: boolean literals (take-timeline passes values, not functions)", true, () => paired("g", true, "c", false)],
  // known-bad that were always red: must stay red
  ["bad: control fires", false, () => paired("b", () => true, "c", () => true)],
  ["bad: real throws an Error", false, () => paired("b", () => { throw new Error("x") }, "c", () => false)],
  // Codex's mutations: were PASS before the fix, must be FAIL now
  ['codex: control `throw ""`', false, () => paired("b", () => true, "c", () => { throw "" })],
  ["codex: control throws an Error whose message starts with a newline", false, () => paired("b", () => true, "c", () => { throw new Error("\nlater line") })],
  ["codex: control returns NaN", false, () => paired("b", () => true, "c", () => NaN)],
  ["codex: control returns undefined", false, () => paired("b", () => true, "c", () => undefined)],
  ["codex: real is async and returns false", false, () => paired("b", async () => false, "c", () => false)],
  // the same class, one step further
  ["class: control throws undefined", false, () => paired("b", () => true, "c", () => { throw undefined })],
  ["class: real returns a truthy number", false, () => paired("b", () => 1, "c", () => false)],
  ["class: control is not a function or boolean", false, () => paired("b", () => true, "c", "false")],
]

let bad = 0
for (const [label, want, run] of cases) {
  const got = quiet(run)
  const good = got === want
  if (!good) bad++
  const r = rows[rows.length - 1]
  console.log(`${good ? "PASS" : "FAIL"}  ${label}  ->  row ${got ? "PASS" : "FAIL"} (want ${want ? "PASS" : "FAIL"})${r?.why ? `  ${r.why.trim()}` : ""}`)
}
console.log(`\n_probe-crosscheck-paired: ${cases.length - bad} of ${cases.length} arms as expected`)
process.exit(bad ? 1 : 0)
