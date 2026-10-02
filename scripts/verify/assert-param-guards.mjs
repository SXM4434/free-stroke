// GATE — a non-finite parameter cannot produce a mesh, and the bevel diagnostic
// reports the bevel rather than the miter vector.
//
// TWO DEFECTS, BOTH MEASURED 2026-08-02 BEFORE THE FIX.
//
// 1 · NaN WAS NOT FLOORED. `computeEffectiveExtrudeDepth` guards its input
//     (`if (!isFinite(raw) || raw <= 0) return FLOOR`). Its two Solid siblings —
//     `computeSolidEffectiveDepth` and `computeSolidEffectiveThicknessPx` — did
//     not: both are `Math.max(lo, Math.min(hi, v))`, and `Math.min(hi, NaN)` is
//     NaN, so the clamp that looks like a clamp passed NaN straight through.
//       · `solidParams.depth = NaN` on `circle/solid` -> 2016 of 6048 positions
//         non-finite, returned as ONE valid mesh with a vertex count, a triangle
//         count and a NaN bounding box. On `tick/inflate`, 1264 of 1266.
//       · `solidParams.thickness = NaN` -> `ctx.lineWidth = NaN`, which Canvas2D
//         SILENTLY IGNORES, so the rasteriser kept the PREVIOUS build's width:
//         the same input produced 12288/23028 after a thin build and
//         12288/24576 after a fat one. Which mark you get depended on what was
//         rendered before it.
//     `+Infinity` was already caught by `Math.min` and still is; only NaN
//     escaped. That asymmetry is asserted too, so a future "simplification" that
//     drops the finite test is caught.
//
// 2 · `h3BevelAchievedFrac` MEASURED THE MITER VECTOR. `insetLoopAgainstMask`
//     displaces each vertex along a miter direction whose LENGTH is
//     `1 / cos(turn/2)` — correct geometry, since that longer travel along the
//     bisector is what puts the offset polygon `offset` inside both edges. The
//     reported fraction summed those vector magnitudes, so a bevel that took the
//     full requested offset at every vertex of a square reported 1.41421.
//     `components/viewport-3d.tsx` paints this green at >= 0.8, so the error ran
//     in the direction that HIDES a starved rim behind a corner-rich contour.
//
// 3 · ⚠ AND THIS GATE COULD NOT SEE A CRASH (found 2026-08-03, and it is RED
//     as a result — see below). Two harness defects compounded: the probe's
//     parameter inventory was hand-written and named four of the engines' eight
//     numeric parameters, and its section-4 exception handler printed a bare
//     `THREW …` line that is neither PASS nor FAIL, never incremented `fails`,
//     and does not match this gate's row filter. The count row was `>= 9`
//     against a probe whose first three sections already emit 13. Every one of
//     the sixteen section-4 cases could have thrown and this file would have
//     printed ALL PASS. Both are repaired: the inventory is derived from the
//     engines and gated against their TS interfaces, and the two sides of the
//     pipe now agree on an exact row count.
//
//     ⚠⚠ THE GATE IS RED AND THE FINDING IS IN `lib/`, NOT HERE. With the four
//     missing parameters covered, `extrude` + `extrudeParams.bevelSegments`
//     fails on two of the three non-finite values:
//
//         NaN        THREW  TypeError: Cannot read properties of undefined (reading '0')
//         +Infinity  OOM    heap exhausted at 512 MB
//
//     `ribbonProfileRows` (lib/geometry-engines.ts:1891) is
//     `const S = Math.max(1, Math.floor(segments))` — the SAME clamp-shaped
//     non-clamp as defect 1's two Solid siblings. `Math.max(1, NaN)` is NaN, so
//     `for (k = 0; k <= S; k++)` never runs, the function returns an empty row
//     list, and `buildContinuousRibbonStripGeometry` dereferences `L[0][i]` on
//     it (:2215). With `+Infinity` the same loop never ends.
//
//     REACHABILITY, stated precisely rather than assumed: the persisted-document
//     channel is currently GUARDED — `coerceAgainst` (lib/doc-store.ts:537-538)
//     keeps the default unless `isFiniteNumber(v)`, and JSON cannot carry NaN or
//     Infinity anyway. What is unguarded is `window.__styleHarness.setExtrude`
//     (app/page.tsx:1312), which writes the params straight through, and any UI
//     that ships a Bevel Segments dial — which `components/viewport-3d.tsx:503`
//     explicitly anticipates ("the first Bevel control shipped would have been a
//     dial that did nothing"). The row is not softened for that: this gate's
//     title is that a non-finite parameter cannot produce a mesh, and an
//     unhandled TypeError is not a mesh.
//
// BOTH ARMS, BOTH DIRECTIONS. The parked prior formula
// (`SOLID_TUNING.bevelFrac = "miter"`) must still reproduce the mean miter
// length in closed form, and a bevel with no material to bevel into must still
// read ~0 — a fix that made the number read 1.0 unconditionally would pass a
// one-sided check and be a worse regression than the defect.
//
// Judgement is on the ENGINES loaded in node. No stored frames, no label.
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))

let fails = 0
const say = (ok, what) => {
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`)
}

function run(script) {
  const r = spawnSync(process.execPath, [join(HERE, script)], {
    encoding: "utf8",
    timeout: 300_000,
    maxBuffer: 64 * 1024 * 1024,
  })
  return { r, out: `${r.stdout ?? ""}${r.stderr ?? ""}` }
}

/* ---- 1 · the NaN floor ---- */
const nan = run("_probe-nan-params.mjs")
// The engine probe prints the whole `[v0-solid]` diagnostic dump, which is
// hundreds of lines of noise here. Only the verdict rows are echoed.
for (const l of nan.out.split("\n")) {
  if (/^(PASS|FAIL)\s/.test(l) || /^  (PASS|FAIL|ok  )/.test(l) || /^=== /.test(l)) console.log(l)
}
console.log("\n=== assert-param-guards — the gate's own rows ===")
say(nan.r.error === undefined, `the NaN probe ran (${nan.r.error ? nan.r.error.message : "no spawn error"})`)
const nanRows = nan.out.split("\n").filter((l) => /^(PASS|FAIL)\s+\w/.test(l))

/* ⚠ THE COUNT ROW WAS A FLOOR THE PROBE HAD LONG OUTGROWN, AND IT HID A REAL
 * HOLE (found 2026-08-03). It read `nanRows.length >= 9` — and sections 1 to 3
 * alone emit 13, so the floor was already satisfied before section 4 ran a
 * single case. Section 4's exception handler printed a bare `THREW …` line that
 * this filter cannot match (`/^(PASS|FAIL)\s+\w/`), never touched the probe's
 * `fails`, and let it exit 0: EVERY case in section 4 could have thrown and this
 * gate would still have printed ALL PASS. It was not hypothetical —
 * `extrude` + `bevelSegments: NaN` throws today.
 *
 * The floor is replaced by an EXACT agreement between the two sides of the pipe.
 * The probe counts every row as it writes it and prints `PROBE ROWS n`; this
 * reads that number and requires the filter to have matched all n. A row the
 * probe emits and this gate cannot see is now a failure rather than a silence.
 * The parked floor is printed alongside so the change is auditable. */
const declaredRows = Number((nan.out.match(/^PROBE ROWS (\d+)$/m) ?? [])[1] ?? NaN)
const sweepCases = Number((nan.out.match(/^SECTION4 CASES (\d+)$/m) ?? [])[1] ?? NaN)
say(
  Number.isFinite(declaredRows) && nanRows.length === declaredRows,
  `this gate read every row the NaN probe wrote (${nanRows.length} of ${declaredRows} declared;` +
    ` the parked floor was ">= 9", which sections 1-3 satisfy on their own)`,
)
say(
  Number.isFinite(sweepCases) && sweepCases >= 96,
  `section 4 swept ${sweepCases} parameter cases (the parked hand-written list ran 16)`,
)
/* AND THE THREE VERDICTS THAT USED TO BE INVISIBLE ARE NAMED. A throw, a heap
 * exhaustion and a hang are all failures of "a non-finite parameter cannot
 * produce a mesh"; none of them is an exception to it. */
const casualties = nan.out
  .split("\n")
  .filter((l) => /\b(THREW|OOM|HANG|CRASH\(|NOT RUN)\b/.test(l) && /^(PASS|FAIL)\s/.test(l))
say(
  casualties.length === 0,
  `no engine THREW, OOM'd, hung or went unrun on a non-finite parameter` +
    (casualties.length ? ` — ${casualties.length}: ${casualties[0].slice(6, 190)}` : ""),
)
say(!nanRows.some((l) => l.startsWith("FAIL")), `every NaN row is PASS`)
say(nan.r.status === 0, `the NaN probe exited 0 (got ${nan.r.status})`)
// The mechanism, not the summary: read the three maps' NaN answers off the table.
const nanLine = nan.out.split("\n").find((l) => /^\s+NaN\s+extrudeDepth=/.test(l)) ?? ""
say(
  /solidDepth=0\.02\b/.test(nanLine),
  `computeSolidEffectiveDepth(NaN) floors to the slider minimum 0.02 — read: ${nanLine.trim() || "<row missing>"}`,
)
say(/solidThicknessPx=4\b/.test(nanLine), `computeSolidEffectiveThicknessPx(NaN) floors to 4 px`)
const infLine = nan.out.split("\n").find((l) => /^\s+Infinity\s+extrudeDepth=/.test(l)) ?? ""
say(
  /solidDepth=0\.5\b/.test(infLine) && /solidThicknessPx=44\b/.test(infLine),
  `+Infinity still clamps UP to the maxima (0.5 / 44) — the two signs are not collapsed`,
)

/* ---- 2 · the bevel fraction ---- */
const bev = run("_probe-bevel-frac.mjs")
process.stdout.write(bev.out)
console.log("=== assert-param-guards — bevel rows ===")
say(bev.r.error === undefined, `the bevel probe ran (${bev.r.error ? bev.r.error.message : "no spawn error"})`)
const bevRows = bev.out.split("\n").filter((l) => /^(PASS|FAIL)\s+\w/.test(l))
say(bevRows.length >= 12, `the bevel probe emitted ${bevRows.length} verdict rows`)
say(!bevRows.some((l) => l.startsWith("FAIL")), `every bevel row is PASS`)
say(bev.r.status === 0, `the bevel probe exited 0 (got ${bev.r.status})`)
// The headline number, read out of the probe's own table.
const sq = bev.out.split("\n").find((l) => /^square-4\s/.test(l)) ?? ""
const m = sq.match(/^square-4\s+\d+\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/)
say(m !== null, `the square-4 closed-form row was found`)
if (m) {
  /* 1e-6, not 1e-9: the probe prints to six decimals, so this reads the PRINTED
   * value and the tolerance must match the print. The probe itself asserts the
   * full-precision equality; asking for 1e-9 of a 6-dp string is a row that can
   * only fail. */
  say(Math.abs(+m[1] - 1) < 1e-6, `a fully-achieved bevel on a square reads ${m[1]} (want 1.000000)`)
  say(
    Math.abs(+m[2] - Math.SQRT2) < 1e-6,
    `the PRIOR formula still reads ${m[2]} = the mean miter length √2 (the control fails)`,
  )
}

console.log(`\n${fails === 0 ? "ALL PASS" : `${fails} FAIL`}`)
process.exit(fails === 0 ? 0 : 1)
