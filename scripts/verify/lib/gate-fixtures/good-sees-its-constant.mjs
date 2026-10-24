// FIXTURE for CHANNEL D — a gate that genuinely guards the constant it names.
// Must be judged CAN-FAIL: moving `fps` in the engine has to turn it red.
//
// This is the shape every model gate is supposed to have. It loads the real
// module, reads the published constant, and asserts a property of it. The gate
// and the engine share one source for the number, so the assertion moves when
// the engine does.
import { loadTs } from "../../_ts-load.mjs"

const { DEFAULT_HERO_MOTION } = loadTs("lib/hero-motion.ts")

let fails = 0
const check = (ok, name, detail) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}   [${detail}]`)
}

/* The beat is authored, captured and pasted at 30 fps in three separate places.
 * A change here is a change to every frame ledger in the repo, so it is pinned. */
check(DEFAULT_HERO_MOTION.fps === 30, "the beat runs at 30 fps", `fps ${DEFAULT_HERO_MOTION.fps}`)

console.log(fails ? `\n${fails} FAILURES` : "\nALL PASS")
process.exit(fails ? 1 : 0)
