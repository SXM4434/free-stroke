// GATE — a coordinate cannot hang the stroke pipeline.
//
// THE DEFECT THIS GATE EXISTS FOR (measured 2026-08-02, before the fix):
// `resampleStroke`'s walk is `while (walked <= segLen) { …; walked += spacing }`
// and its only guard was `if (segLen === 0) continue`. That terminates only when
// BOTH `segLen` is finite AND `spacing` is a positive finite number, and neither
// was checked. Four inputs — a non-finite coordinate, two FINITE coordinates
// whose separation squared overflows a double, `spacing = 0`, `spacing < 0` —
// each exhausted a 512 MB heap in its own node process. The failure is not an
// exception; the array grows until the tab dies.
//
// Both channels are user-reachable: coordinates come from the pointer stream and
// from persisted documents (`lib/doc-store.ts` round-trips them through JSON),
// and `spacing` comes from a slider and from the same documents.
//
// THE NEGATIVE CONTROL IS THE POINT. `RESAMPLE_TUNING.guards = "off"` restores
// the pre-fix walk verbatim, and every malformed case must still die there. A
// guard whose only evidence is its own green row is a green row that cannot
// fail. Two ordinary strokes and one with a zero-length segment run in BOTH arms
// and must emit the identical point count, so the guards are proved not to have
// moved a well-formed result.
//
// ⚠ THE GATE NAMED FIVE CASES AND THE PROBE DEFINES TEN (found and repaired
// 2026-08-03). The list was written out by hand —
//
//     for (const c of ["infX","overflow","zeroSpacing","negSpacing","tinySpacing"])
//
// — against a probe whose `CASES` map holds ten, seven of them malformed. Two
// malformed inputs, `nanY` (a NaN coordinate from a lost pointer capture) and
// `nanSpacing`, were named nowhere in this file: the gate did not assert the
// shipped arm returns CLEAN on them, it simply DROPPED them. And the count row
// read `rows.length >= 9` against a probe that emits 10, so a case could have
// been deleted from `_probe-resample-hang.mjs` outright and this gate would
// still have printed ALL PASS — an inventory that had stopped being maintained
// on one axis, guarded by a floor that no longer touched the number.
//
// THE REPAIR. The inventory is IMPORTED from the probe rather than transcribed,
// and partitioned by the probe's own `malformed` / `priorSurvives` flags, so a
// case added there is asserted here the moment it exists and one removed there
// fails the count. The `priorSurvives` pair get their own row shape: the
// shipped arm must still return CLEAN, and the fact that the PRIOR arm survives
// them too — i.e. that these two guards have no negative control — is asserted
// rather than left implicit, so it goes red the day that stops being true.
//
// Judgement is on the ENGINE loaded in node — no stored frames, no label.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// The probe's own case map. Importing it does NOT run the probe: its parent
// block is behind `import.meta.url === file://${process.argv[1]}`.
import { CASES } from "./_probe-resample-hang.mjs"

const HERE = dirname(fileURLToPath(import.meta.url))

const r = spawnSync(process.execPath, [join(HERE, "_probe-resample-hang.mjs")], {
  encoding: "utf8",
  timeout: 300_000,
})
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`
process.stdout.write(out)

let fails = 0
const say = (ok, what) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`)
}

console.log("\n=== assert-stroke-guards — the gate's own rows ===")
say(r.error === undefined, `the probe ran (${r.error ? r.error.message : "no spawn error"})`)

/* THE INVENTORY, DERIVED. Three disjoint families, and their union must be the
 * whole of `CASES` — the partition is asserted below rather than trusted, so a
 * case with a new flag combination cannot fall between the loops the way
 * `nanY` and `nanSpacing` fell between the old hand-written list and nothing. */
const ALL = Object.keys(CASES)
const GUARDED = ALL.filter((n) => CASES[n].malformed && !CASES[n].priorSurvives)
const SURVIVED = ALL.filter((n) => CASES[n].malformed && CASES[n].priorSurvives)
const CONTROLS = ALL.filter((n) => !CASES[n].malformed)

const rows = out.split("\n").filter((l) => /^(PASS|FAIL)\s+\w/.test(l))
// EXACT, not a floor. `>= 9` against a probe that emits 10 meant one case could
// be deleted and this row would not notice.
say(
  rows.length === ALL.length,
  `the probe emitted one verdict row per declared case (${rows.length} of ${ALL.length})`,
)
say(
  GUARDED.length + SURVIVED.length + CONTROLS.length === ALL.length,
  `every declared case falls in exactly one family ` +
    `(${GUARDED.length} guarded + ${SURVIVED.length} prior-survives + ${CONTROLS.length} control = ${ALL.length})`,
)
say(!rows.some((l) => l.startsWith("FAIL")), `every case row is PASS`)

/* Read the four OOM claims out of the probe's own table, so this gate states
 * the mechanism rather than repeating a summary. */
const table = out.split("\n")
const arm = (name) => {
  const l = table.find((x) => new RegExp(`^(PASS|FAIL) ${name}\\s`).test(x))
  if (!l) return null
  const m = l.match(/^(PASS|FAIL) (\S+)\s+(\S+)\s+(\S+)/)
  return m ? { verdict: m[1], shipped: m[3], prior: m[4] } : null
}
/* PARKED — the hand-written list this loop replaced. It named five of ten and
 * dropped `nanY` and `nanSpacing` without saying so:
 *     ["infX", "overflow", "zeroSpacing", "negSpacing", "tinySpacing"] */
for (const c of GUARDED) {
  const a = arm(c)
  say(a !== null, `case ${c} appears in the table`)
  if (!a) continue
  say(a.shipped === "CLEAN", `${c}: the SHIPPED walk returns cleanly (got ${a.shipped})`)
  say(
    a.prior === "OOM" || a.prior === "HANG",
    `${c}: the PRIOR walk still dies (${a.prior}) — the control fails, so the guard is proved`,
  )
}

/* THE TWO THE OLD LIST DROPPED. They are malformed and the PRIOR walk survives
 * them (`<= NaN` is false, so the unbounded loop never started), which is why
 * they cannot satisfy the `prior === OOM|HANG` row above — the probe records
 * that honestly with `priorSurvives: true`. Dropping them was still wrong: the
 * SHIPPED arm's answer on a NaN coordinate is the whole question a user's lost
 * pointer capture asks, and nothing was asserting it. Both halves are asserted
 * here — the shipped arm is clean, AND the prior arm's survival is stated as a
 * fact that must stay true, so "this guard has no negative control" is a row
 * somebody can read rather than a silence. */
for (const c of SURVIVED) {
  const a = arm(c)
  say(a !== null, `case ${c} appears in the table`)
  if (!a) continue
  say(a.shipped === "CLEAN", `${c}: the SHIPPED walk returns cleanly (got ${a.shipped})`)
  say(
    a.prior === "CLEAN",
    `${c}: the PRIOR walk survives it too (${a.prior}) — declared, so this guard's MISSING ` +
      `negative control is on the record instead of being dropped from the list`,
  )
}

for (const c of CONTROLS) {
  const a = arm(c)
  say(a !== null && a.shipped === "CLEAN" && a.prior === "CLEAN", `${c}: unchanged in BOTH arms`)
}

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`)
process.exit(fails === 0 ? 0 : 1)
