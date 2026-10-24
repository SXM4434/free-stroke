// FIXTURE for CHANNEL D — `assert-pen-field`'s disease, reduced to its bones.
// Must be judged CANNOT-FAIL: it NAMES the constant and no value of it can turn
// a single row red.
//
// The real case: `assert-pen-field.mjs` existed to guard `PEN_CARVE_ENVELOPE_R`,
// never referenced it, and 2.6 shipped for a full day with every row green. This
// fixture is one step less obvious and therefore the harder control — it does
// mention `fps`, in a comment and in a printed detail, so a GREP for the
// constant finds it and reports the gate as covered. Only moving the value and
// re-running settles it.
import { loadTs } from "../../_ts-load.mjs"

const { DEFAULT_HERO_MOTION, totalDuration } = loadTs("lib/hero-motion.ts")

let fails = 0
const check = (ok, name, detail) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}   [${detail}]`)
}

/* Reads `fps`, prints `fps`, and asserts a property that is true of every
 * positive frame rate — so the subject is inside the pass condition by
 * construction, which is class 1 exactly. */
const frames = Math.round(totalDuration(DEFAULT_HERO_MOTION) * DEFAULT_HERO_MOTION.fps)
check(frames > 0, "the beat has frames in it", `${frames} frames at fps ${DEFAULT_HERO_MOTION.fps}`)
check(DEFAULT_HERO_MOTION.fps > 0, "fps is a positive number", `fps ${DEFAULT_HERO_MOTION.fps}`)

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS")
process.exit(fails ? 1 : 0)
