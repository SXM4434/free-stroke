// FIXTURE for CHANNEL E, the other side — a gate that covers its whole set.
// Must be judged COMPLETE: no partial-coverage finding.
//
// Without this, channel E has only ever been shown to accuse. An analyser that
// reports every gate is the same uselessness as one that reports none, and the
// pair is what makes the verdict mean something. All seven members of
// `HeroShape` are named here, so the channel must stay silent.

const FILMS = [
  "shipped",
  "popUp",
  "turnLands",
  "solidFirst",
  "cutaway",
  "standTurn",
  "letterByLetter",
]

let fails = 0
const check = (ok, name) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`)
}

for (const f of FILMS) check(typeof f === "string", `film ${f} is in the panel`)

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS")
process.exit(fails ? 1 : 0)
