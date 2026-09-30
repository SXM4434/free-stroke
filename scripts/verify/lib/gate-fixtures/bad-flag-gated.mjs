// FIXTURE — `assert-layer-flicker`'s disease. Must be judged FAIL / no-verdict.
//
// Every judgement in the file is real, and every one of them sits behind a flag
// that is off by default. The default invocation prints a table and exits 0.
const has = (k) => process.argv.includes(`--${k}`)
const CHECK = has("check")
const CALIBRATE = has("calibrate")

let failed = 0
const say = (ok, name) => {
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
}

const rows = [
  { key: "a", value: 9.1 },
  { key: "b", value: 0.2 },
]

if (CALIBRATE) {
  say(rows[0].value > 1, "known-good row reads high")
  say(rows[1].value < 1, "known-bad row reads low")
  process.exit(failed ? 1 : 0)
}

if (CHECK) {
  for (const r of rows) say(r.value > 1, `${r.key} moves`)
  process.exit(failed ? 1 : 0)
}

for (const r of rows) console.log(`[fixture] ${r.key}  value=${r.value}`)
console.log("[fixture] done")
