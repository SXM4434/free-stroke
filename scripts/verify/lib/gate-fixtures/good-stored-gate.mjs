// FIXTURE — a legitimate frames-to-verdicts assert. Must be judged PASS.
//
// It reads stored evidence, which is the repo's documented split ("verify-*
// captures frames. assert-* turns them into pass/fail"), and it refuses to
// report anything at all when the evidence is not there — which is what keeps a
// stored-evidence gate from passing on nothing.
import { readFileSync, existsSync } from "node:fs"

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}
const LABEL = arg("label", "final")
const DIR = `docs/verification/gate-fixture/${LABEL}`
if (!existsSync(DIR)) {
  console.error(`no evidence at ${DIR} — capture it first`)
  process.exit(1)
}

let fails = 0
const check = (ok, name) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
}

const report = JSON.parse(readFileSync(`${DIR}/report.json`, "utf8"))
check(report.value > 2, "the stored value clears the floor")
console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS")
process.exit(fails ? 1 : 0)
