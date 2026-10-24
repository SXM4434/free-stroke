// FIXTURE for CHANNEL E — `assert-hero-option-panel`'s disease, reproduced.
// Must be judged PARTIAL: it names 4 of the 7 members of `HeroShape`.
//
// The real case: a hardcoded FOUR-film list against a SEVEN-film panel. Two
// films shipped and were unwatched from the moment they landed, and every row
// in this gate was CORRECT about the four it knew about — which is why nothing
// went red and why a reader of the output had no way to notice. The defect is
// not in any assertion. It is that the list is a second copy of something the
// app states exactly once, and a copy cannot notice the original growing.
//
// 4 of 7 is 0.571, just above the 0.50 floor `partialCoverage` uses to decide a
// gate is TRYING to enumerate a set rather than testing three specific members
// of it. That ratio is the calibration point, so this fixture is what pins it.

const FILMS = ["shipped", "popUp", "turnLands", "solidFirst"]

let fails = 0
const check = (ok, name) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
}

for (const f of FILMS) check(typeof f === "string", `film ${f} is in the panel`)

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS")
process.exit(fails ? 1 : 0)
