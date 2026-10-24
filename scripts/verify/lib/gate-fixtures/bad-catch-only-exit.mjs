// FIXTURE — rows are emitted, the exit code only ever reports a CRASH. Must be
// judged FAIL / exit-uncoupled.
//
// The `.catch(… process.exit(1))` tail makes the file look exit-coupled to a
// grep. It reports that the script threw, never that the subject failed.
let fails = 0
const say = (ok, name) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
}

async function main() {
  say(true, "row one")
  say(false, "row two")
  console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
