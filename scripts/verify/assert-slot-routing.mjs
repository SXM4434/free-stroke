// GATE — a worker reply lands in the slot that asked for it.
//
// THE DEFECT THIS GATE EXISTS FOR (measured 2026-08-02, before the fix). Both
// deferred-build schedulers — `lib/implicit-defer.ts` and its port
// `lib/pen-field-defer.ts` — stamped request ids from a PER-SLOT counter
// (`seq: ++slot.seq`) while sharing ONE worker, and resolved a reply by scanning
// every slot for the first in-flight job with that id. Two marks in flight
// together therefore both carried id 2, and the tie went to Map insertion order:
//
//   · mark A's live geometry moved from min.x -0.274 to 3.950 — A on screen
//     showing B's mesh
//   · mark A's `onSettled` fired with mark B's `revealKeys`, the array the
//     draw-in binary-searches
//   · mark B's `onSettled` never fired at all, so its `inFlight` never cleared,
//     its queued rebuild never drained, and that slot was WEDGED for the life of
//     the page
//
// Both modules state in their own request types the invariant this breaks: "two
// calls with different keys are different marks and neither may ever be shown in
// place of the other."
//
// THE NEGATIVE CONTROL. `DEFER_ROUTING.implicit = "scan"` and
// `PEN_DEFER_ROUTING.mode = "scan"` restore the per-slot id space and the scan
// verbatim, and must reproduce all three symptoms. A routing fix whose only
// evidence is its own green row is a green row that cannot fail.
//
// Judgement is on the modules loaded in node with a shimmed Worker that never
// replies on its own, so replies are hand-delivered and the landing site read
// directly — deterministic, not a race. No stored frames, no label.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))

const r = spawnSync(process.execPath, [join(HERE, "_probe-slot-reply-id.mjs")], {
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

console.log("\n=== assert-slot-routing — the gate's own rows ===")
say(r.error === undefined, `the probe ran (${r.error ? r.error.message : "no spawn error"})`)

const rows = out.split("\n").filter((l) => /^\s+(PASS|FAIL)\s+\w/.test(l))
say(rows.length >= 16, `the probe emitted ${rows.length} verdict rows (8 per scheduler)`)
say(!rows.some((l) => l.trim().startsWith("FAIL")), `every row is PASS`)

for (const mod of ["implicit-defer", "pen-field-defer"]) {
  const block = out.split(`=== ${mod}:`)[1] ?? ""
  const shipped = block.split("\n").find((l) => l.includes("SHIPPED byId")) ?? ""
  const prior = block.split("\n").find((l) => l.includes("PRIOR scan")) ?? ""
  say(shipped !== "", `${mod}: the SHIPPED arm reported`)
  say(prior !== "", `${mod}: the PRIOR arm reported`)
  say(!shipped.includes("COLLISION"), `${mod}: shipped ids do not collide`)
  say(!shipped.includes("OVERWRITTEN"), `${mod}: shipped does not adopt B's reply into A`)
  say(!shipped.includes("WEDGED"), `${mod}: shipped leaves no slot wedged`)
  // All three must still be present in the parked arm, or these rows prove nothing.
  say(prior.includes("COLLISION"), `${mod}: PRIOR still collides (the control fails)`)
  say(prior.includes("OVERWRITTEN"), `${mod}: PRIOR still cross-adopts (the control fails)`)
  say(prior.includes("WEDGED"), `${mod}: PRIOR still wedges a slot (the control fails)`)
}

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`)
process.exit(fails === 0 ? 0 : 1)
