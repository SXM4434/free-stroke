// GATE — the unreachable half of `lib/geometry-engines.ts` neither grows nor
// quietly comes back to life.
//
// WHAT IS PINNED, AND WHY IT IS PINNED RATHER THAN REMOVED. Measured 2026-08-02:
// 48 top-level declarations spanning ~1,657 lines — the whole first raster-Solid
// pipeline, from `SOLID_RASTER_SIZE` to `findEnclosedHoles` — are reachable from
// nothing. `lib/solid-mask.ts` is the live implementation and every improvement
// of the last several passes landed there.
//
// §0.7 of the dispatch contract forbids removing a prior implementation
// ("Building NEW options must NEVER remove or overwrite existing ones… a
// deletion here is permanent"), and this repo has lost work that way twice. So
// the block is MARKED in place and PINNED here, on the fold-census pattern
// (explainer 19 §4): a NEW dead declaration fails, and a REVIVAL fails too —
// "A row getting better also fails, loudly, which is how the ledger got updated
// when class A closed rather than quietly over-permitting for the next reader."
//
// THE ANALYSER IS CALIBRATED ON EVERY RUN, in both directions, by the probe
// itself: the four engine roots and the functions the verification battery calls
// must all come back reachable, and something must come back dead. An analyser
// that has never called anything alive — or never called anything dead — has not
// been shown able to tell them apart, and this gate refuses to report on one
// that has not.
//
// Judgement is a parse of the tree as it is on disk. No stored frames, no label.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * The pinned census. Declaration COUNT, not line count: lines move whenever a
 * comment is edited (this gate's own banner moved them by 45 the day it was
 * written), and pinning a number that changes for reasons unrelated to the
 * subject is how a gate becomes noise and gets switched off.
 */
const PINNED = {
  file: "lib/geometry-engines.ts",
  deadDeclarations: 48,
  /** A generous ceiling — the block must not GROW. */
  maxDeadLines: 1750,
  /** Landmarks: the first and last declaration of the superseded block. */
  firstDead: "SOLID_RASTER_SIZE",
  lastDead: "findEnclosedHoles",
}

const r = spawnSync(process.execPath, [join(HERE, "_probe-dead-code.mjs"), `--file=${PINNED.file}`], {
  encoding: "utf8",
  timeout: 300_000,
  maxBuffer: 32 * 1024 * 1024,
})
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`
process.stdout.write(out)

let fails = 0
const say = (ok, what) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`)
}

console.log("\n=== assert-dead-code — the gate's own rows ===")
say(r.error === undefined, `the probe ran (${r.error ? r.error.message : "no spawn error"})`)

// The probe's calibration is a precondition, not a footnote.
say(out.includes("CALIBRATION OK"), `the reachability analyser calibrated in both directions`)
say(r.status === 0, `the probe exited 0 (got ${r.status})`)

const m = out.match(/UNREACHABLE: (\d+) declarations spanning (\d+) lines \(([\d.]+)%/)
say(m !== null, `the census line was found in the output`)
if (m) {
  const count = +m[1]
  const lines = +m[2]
  console.log(`      census: ${count} declarations, ${lines} lines, ${m[3]}% of the file`)
  if (count === PINNED.deadDeclarations) {
    say(true, `dead declarations = ${count}, exactly the pin`)
  } else if (count > PINNED.deadDeclarations) {
    say(false, `dead declarations ROSE ${PINNED.deadDeclarations} -> ${count}: new unreachable code landed`)
  } else {
    say(
      false,
      `dead declarations FELL ${PINNED.deadDeclarations} -> ${count}: something was revived or removed. ` +
        `This is not automatically wrong — but it must be a decision, so update the pin deliberately ` +
        `rather than letting it drift.`,
    )
  }
  say(lines <= PINNED.maxDeadLines, `dead lines ${lines} <= ceiling ${PINNED.maxDeadLines}`)
}

for (const n of [PINNED.firstDead, PINNED.lastDead]) {
  say(
    new RegExp(`\\b${n}\\b`).test(out.split("=== calibration")[0] ?? ""),
    `${n} is still in the unreachable set (the block's landmark)`,
  )
}

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`)
process.exit(fails === 0 ? 0 : 1)
