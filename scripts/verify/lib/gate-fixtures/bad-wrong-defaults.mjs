// FIXTURE for CHANNEL I — `assert-pentip-specks`'s disease.
// Must be judged RED-WHEN-BARE: typed with no arguments it exits non-zero.
//
// THE CLASS, which is its own and not one of the others.
//
//   The capture is fresh. The inventory is complete. The assertion is correct.
//   And the two arms being compared are not the two the row is a claim about —
//   so the gate answers a question nobody asked, and prints red about it.
//
//   The real case: `assert-pentip-specks.mjs` defaulted to
//   `--arm=t275 --arm2=t160` against a capture whose `free-stroke` reference had
//   been shot at the OLD tip shape. Its author reported "9 rows, ALL PASS",
//   because they had typed the arguments. Nobody else would. Run bare it said
//   the mark had grown blank spots — about a comparison against the shape the
//   shipped one replaced.
//
//   Adjacent to F (stale input) and to E (hardcoded inventory), and neither.
//   What makes it findable is only this: the bare invocation is the one the next
//   person types, so it is the one that has to mean something.
//
// This fixture reproduces the shape and nothing else: a real assertion, a real
// measurement, and a default `--arm` that selects the wrong one to compare.

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}

/* Three arms of one capture. `shipped` is what the row is a claim about; `prior`
 * is the parked shape it replaced. Comparing `shipped` to `prior` is a real
 * question. Comparing it to `oldRef` — a reference shot before the change — is
 * not, and that is what the default does. */
const ARMS = { shipped: 22, prior: 20, oldRef: 12 }
const ARM = arg("arm", "shipped")
const REF = arg("ref", "oldRef") // <- the defect: should be "prior"

let fails = 0
const check = (ok, name, detail) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}   [${detail}]`)
}

check(
  ARMS[ARM] <= ARMS[REF] + 3,
  "the shipped tip opens no more specks than the shape it replaced",
  `${ARM} ${ARMS[ARM]} vs ${REF} ${ARMS[REF]}`,
)

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS")
process.exit(fails ? 1 : 0)
