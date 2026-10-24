// FIXTURE for CHANNEL G — `verify-gates.mjs`'s old disease.
// Must be judged SKIP-AS-PASS: it says it skipped something, summarises itself
// as all-pass, and exits 0. Any two of those three are fine. All three is a lie.
//
// The real case: `verify-gates.mjs` printed ALL GATES PASS with all four
// geometry gates skipped. Nothing in the summary line distinguished four-of-four
// from zero-of-four, and the exit code said everything was well.

let fails = 0
const check = (ok, name) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
}

check(true, "the one gate that did run")

/* The three that did not. In the real case this was an `if (existsSync(...))`
 * with no `else` — the rows simply never appeared, and the tally counted what
 * it had rather than what it owed. */
console.log("SKIP  geometry rebuild — no engine on this machine")
console.log("SKIP  export taxonomy — needs ffmpeg")
console.log("SKIP  style sweep — needs a dev server")

console.log(fails ? `\n${fails} FAILURES` : "\nALL GATES PASS")
process.exit(fails ? 1 : 0)
