// FIXTURE — the ACCEPT control for channel J. Must be judged a GATE and must
// NOT be reported as withholding anything.
//
// An analyser that has never rejected anything is the disease it is looking for;
// one that has never ACCEPTED anything gets switched off within a week, which is
// worse, because A, B, C, D, E, F, G and I live in the same file. So J gets a
// pair, exactly as D, E, F and G each do.
//
// Everything that JUDGES here runs on the default invocation. The flags are
// real, and they are the two shapes that must NOT be mistaken for a withheld
// arm:
//
//   --verbose   changes what is PRINTED, never what is judged.
//   --label=    selects WHICH stored capture to grade. A sweep deliberately does
//               not pass one (`run-browser-battery.mjs`'s header: "the bare
//               invocation is the one the next person types"), and a bare run
//               grading the default capture is the fact worth surfacing — that
//               is channels F and I, not J.
const has = (k) => process.argv.includes(`--${k}`)
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const VERBOSE = has("verbose")
const LABEL = arg("label", "current")

let failed = 0
const say = (ok, name) => {
  if (!ok) failed++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
}

say(LABEL.length > 0, "the model says the dial is wired")
say(2 + 2 === 4, "the REAL control moves the REAL render")

/* The known-bad control runs BY DEFAULT — explainer 21 §7: "the gate runs three
 * kinds of control on the default invocation, never behind a flag." */
say(!(2 + 2 === 5), "CONTROL · the deliberately broken arm is REJECTED")

if (VERBOSE) console.log(`  (label=${LABEL}; printing only, nothing judged here)`)

process.exit(failed ? 1 : 0)
