// FIXTURE — the judgement is emitted and then thrown away. Must be judged
// FAIL / exit-uncoupled.
//
// A human reading the output sees FAIL rows. A sweep reading the exit code sees
// green. This is the version of the disease that survives a code review.
let fails = 0
const say = (ok, name) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
}

say(true, "row one")
say(false, "row two")

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS")
process.exit(0)
