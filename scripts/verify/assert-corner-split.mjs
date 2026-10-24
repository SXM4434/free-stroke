// GATE — `detectCorners` finds the corners, and only the corners.
//
// THE DEFECT THIS GATE EXISTS FOR (measured 2026-08-02, before the fix):
// `lib/stroke-processing.ts` computed `deviation = Math.PI - acos(cosAngle)`
// where `acos(cosAngle)` is ALREADY the turn, so it compared the INTERIOR angle
// against a threshold expressed as a turn. Exactly backwards, and the same
// inversion `detectJoints3D` documents having already fixed once
// (`docs/explainers/16-the-rim-and-the-bead.md` §1). Consequences, all measured:
//
//   · a straight 200 px line reported ONE corner, at index 4
//   · a real 90-degree elbow had its corner DISCARDED — the merge pass scores a
//     straight run at PI and the true corner at PI/2, so the corner loses its own
//     group — and a straight-run sample was reported in its place
//   · every surviving "corner" therefore sat inside a straight run, where a
//     Taubin pass moves nothing, so splitting there was a NO-OP: `preserveCorners`
//     on and off were byte-identical on the `square` fixture and differed by at
//     most 0.035 px on the shipped hero word. A user-facing control that did
//     nothing.
//
// WHY THIS IS A GATE AND NOT JUST A PROBE. The fix CHANGES RENDERED GEOMETRY —
// it has to, because the dial was inert — so the thing that must not regress is
// not "the output is unchanged" but "the detector is right in both directions".
// Both directions are asserted here, and the parked inverted predicate
// (`CORNER_TUNING.predicate = "interior"`) is re-run as the negative control on
// every row: if it ever passes, the row proves nothing and this gate fails.
//
// Judgement is on the ENGINE loaded in node — the same `processStroke` the page
// calls — not on stored frames, so there is no label to refuse.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))

const r = spawnSync(process.execPath, [join(HERE, "_probe-corner-predicate.mjs")], {
  encoding: "utf8",
})
const out = `${r.stdout ?? ""}${r.stderr ?? ""}`
process.stdout.write(out)

let fails = 0
const say = (ok, what) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`)
}

console.log("\n=== assert-corner-split — the gate's own rows ===")

// The probe crashing is not the subject failing, and must not be reported as if
// it were: it is its own FAIL, with the reason.
say(r.error === undefined, `the probe ran (${r.error ? r.error.message : "no spawn error"})`)

/* Every synthetic row must be PASS in the shipped arm. The probe prints one row
 * per fixture and one summary; parse the rows rather than trusting the exit
 * code alone, so a probe that stopped emitting rows is caught here rather than
 * read as green. */
const rows = out.split("\n").filter((l) => /^(PASS|FAIL)\s+\w/.test(l.trim()))
say(rows.length >= 5, `the probe emitted ${rows.length} verdict rows (>= 5 fixtures)`)
say(
  !rows.some((l) => l.trim().startsWith("FAIL")),
  `every fixture row is PASS${rows.some((l) => l.trim().startsWith("FAIL")) ? " — see above" : ""}`,
)

/* THE TWO HEADLINE CLAIMS, read out of the probe's own printed numbers rather
 * than restated. A gate that asserts its own summary is asserting nothing. */
const straight = out.match(/straight\s+shipped=\s*(\d+)@\[([^\]]*)\]\s+prior=\s*(\d+)@\[([^\]]*)\]/)
say(straight !== null, `the straight-line row was found in the output`)
if (straight) {
  say(straight[1] === "0", `a straight line reports 0 corners (shipped) — got ${straight[1]}`)
  say(straight[3] !== "0", `the PRIOR arm still reports ${straight[3]} on a straight line (the control fails)`)
}

const elbow = out.match(/elbow90\s+shipped=\s*(\d+)@\[([^\]]*)\]\s+prior=\s*(\d+)@\[([^\]]*)\]/)
say(elbow !== null, `the 90-degree elbow row was found in the output`)
if (elbow) {
  say(elbow[1] === "1", `a 90-degree turn reports 1 corner (shipped) — got ${elbow[1]}`)
  const at = Number(elbow[2])
  say(Math.abs(at - 25) <= 2, `and it is AT the turn: index ${elbow[2]}, the corner is at 25`)
  const priorAt = Number(String(elbow[4]).split(",")[0])
  say(
    Math.abs(priorAt - 25) > 2,
    `the PRIOR arm still reports index ${elbow[4]} instead of the corner (the control fails)`,
  )
}

/* The dial must ACT — this is the part the fix is for.
 *
 * INSTRUMENT REPAIR 2026-08-03 — UNANCHORED REGEX. These two rows used to read
 *
 *     /square\s+cornerCount=\s*3\s+on\/off differ/.test(out)
 *     /straight\s+cornerCount=\s*0\s+on\/off IDENTICAL/.test(out)
 *
 * against the WHOLE probe output. Section F prints TWO blocks in an identical
 * format — `--- SHIPPED ---` and `--- PRIOR (inverted) ---` — with no anchor
 * between them, so `.test(out)` cannot say which arm it matched. A build in
 * which the arms had swapped (shipped reading `cornerCount= 1 … IDENTICAL`,
 * prior reading `3 … differ`) satisfies both regexes and the gate prints ALL
 * PASS while the dial is inert again. That is the whole defect this file exists
 * to catch, matched in the arm that is supposed to be broken.
 *
 * Repaired by cutting the output into its two blocks first and reading each on
 * its own — and by asserting the PRIOR block too, because "the shipped arm is
 * right" and "the prior arm is still wrong" are two claims and the old code
 * made neither of them unambiguously. Proof it discriminates:
 *
 *     CORNER_SPLIT_ARM=swap node scripts/verify/assert-corner-split.mjs   -> exit 1
 *
 * which swaps the two block bodies and nothing else.
 */
const ARM = process.env.CORNER_SPLIT_ARM ?? ""
const H_SHIPPED = "--- SHIPPED ---"
const H_PRIOR = "--- PRIOR (inverted) ---"
const dialBlocks = (text) => {
  const iS = text.indexOf(H_SHIPPED)
  const iP = text.indexOf(H_PRIOR)
  if (iS < 0 || iP < 0 || iP < iS) return null
  const shipped = text.slice(iS + H_SHIPPED.length, iP)
  const rest = text.slice(iP + H_PRIOR.length)
  const stop = rest.indexOf("\n\n")
  return { shipped, prior: stop < 0 ? rest : rest.slice(0, stop) }
}
let blocks = dialBlocks(out)
if (ARM === "swap" && blocks) {
  console.log(`[arm] CORNER_SPLIT_ARM=swap — the SHIPPED and PRIOR dial blocks are exchanged`)
  blocks = { shipped: blocks.prior, prior: blocks.shipped }
}
/* Both headers must be present. A probe that stopped printing section F would
 * otherwise leave every row below unrun, and `if (blocks)` with no else is the
 * skip-is-silent hole this repo has been paying for elsewhere. */
say(blocks !== null, `section F printed BOTH dial blocks (${H_SHIPPED} and ${H_PRIOR})`)
if (blocks === null) {
  say(false, `— the four dial rows below could not be evaluated and are counted as failures`)
  say(false, `— (shipped acts on square)`)
  say(false, `— (shipped is inert on straight)`)
  say(false, `— (prior does NOT act correctly on square)`)
} else {
  say(
    /square\s+cornerCount=\s*3\s+on\/off differ/.test(blocks.shipped),
    `preserveCorners now changes geometry on a shape that HAS corners (square, 3 corners) — IN THE SHIPPED BLOCK`,
  )
  say(
    /straight\s+cornerCount=\s*0\s+on\/off IDENTICAL/.test(blocks.shipped),
    `and is still a no-op on a shape that has none (straight) — IN THE SHIPPED BLOCK`,
  )
  /* THE CONTROL, which the unanchored version could never have made: the parked
   * inverted predicate must NOT produce the shipped answer. Measured today it
   * reports `square cornerCount= 1  on/off IDENTICAL` — one corner, and a dial
   * that does nothing on the one fixture with four drawn corners. */
  say(
    !/square\s+cornerCount=\s*3\s+on\/off differ/.test(blocks.prior),
    `the PRIOR arm does NOT reach that answer on the square (the control fails)`,
  )
  say(
    !/straight\s+cornerCount=\s*0\s+on\/off IDENTICAL/.test(blocks.prior),
    `and the PRIOR arm still finds a corner in a straight line (the control fails)`,
  )
}

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`)
process.exit(fails === 0 ? 0 : 1)
