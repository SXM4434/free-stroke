// DID EVERY COMBINATION CELL ACTUALLY MOVE THE PICTURE? — judged on pixels.
//
// Reads what `_probe-fusion-combo-liveness.mjs` measured on the real page and
// turns it into pass/fail. The split is this repo's own: capturing is cheap and
// rerunnable, asserting is where "it reads" gets settled.
//
// ── WHAT MAKES THIS ABLE TO FAIL, WHICH IS THE ONLY QUESTION THAT MATTERS ───
// The negative control is not synthetic and it is not optional: FOUR OF THE 120
// CELLS ARE STRUCTURALLY EMPTY. `animation+layers`, `animation+fusion`,
// `layers+fusion` and all three together contain no system that owns a fusion
// target — they are clocks, and clocks have nothing to write to. They are
// captured on the same page, in the same window, through the same control, and
// they MUST read dead. A run in which they do not read dead is a run whose
// numbers mean nothing, and the assertion says so rather than quietly passing
// 116 rows. That is a known-bad the PRODUCT supplies, which is stronger than one
// the test invents.
//
// Three more channels each carry their own arm:
//   · PROVENANCE — the capture must be newer than lib/style-fusion.ts. A gate
//     grading a build that no longer exists has read three confident reds off
//     stale arms in this repo already.
//   · COVERAGE — the crop must contain the mark. A capture that caught nothing
//     reads exactly like a cell that did nothing.
//   · THE TURNTABLE — a View cell must come back with the spin RUNNING, and a
//     cell that never reads the camera must not.
//
// ── AND THE ONE THAT LET ALL OF THAT PASS ON A BROKEN CAPTURE ──────────────
//
// An independent crosscheck on 2026-08-28 ran two mutations and this gate read
// 11/11, exit 0, on both:
//
//   · `material+animation` DUPLICATED over `material+layers`. 120 rows in, 120
//     rows out, one cell gone — because the set was checked by COUNTING.
//   · `maskPx`, `w` and `spinOnSelect` DELETED from a cell. The gate printed
//     `mask NaN..NaN` and `undefinedx1816` in its own detail lines and still
//     said 11/11, because every one of those rows selects its FAILING set with a
//     comparison — `r.maskPx < 2000`, `r.w < 1440`, `r.net > FLOOR` — and a
//     missing value is not less than anything. `undefined < 2000` is false.
//     `NaN < 1440` is false. So the broken cell was excluded from the failures.
//
// That is a CLASS, not two bugs, and this repo has it elsewhere: lane N18 found
// `dist(A,B) = 112.73` beside `dist(B,A) = NaN` in `assert-fusion-combo-distinct`,
// where `NaN < FLOOR` is false and 554 of 3475 pairs therefore could not fail.
//
// Both halves are closed the same way and BEFORE any threshold is applied: the
// capture's cell set is compared as a SET, and every number this file compares
// has to be present and finite first. `atLeast()` and `above()` below are the
// comparison written so that a missing value is a failure rather than a pass.
//
//   node scripts/verify/assert-fusion-combo-liveness.mjs --label=v1
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
/**
 * THE DEFAULT LABEL IS DERIVED, NOT WRITTEN DOWN.
 *
 * It was `"v1"`. On 2026-08-28 a lane fixed a dead cell, re-captured as `v2`,
 * and reported eleven of eleven rows passing — while a BARE run still read `v1`
 * and reported three failures, about evidence that predates the fix by hours.
 * Both were true and only one was current.
 *
 * A hand-written default is right on the day it is typed and wrong from the next
 * capture onward, which is the same defect this repo found six other times that
 * night: a derived value frozen into a literal. So it is derived. The newest
 * capture that actually holds a `liveness.json` wins, and `--label=` still names
 * one explicitly, which is how `v1` stays readable rather than being deleted.
 */
const newestLabel = () => {
  const base = join(ROOT, "docs", "verification", "fusion-combos")
  if (!existsSync(base)) return "v1"
  const withCapture = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(base, e.name, "liveness.json")))
    .map((e) => ({ name: e.name, at: statSync(join(base, e.name, "liveness.json")).mtimeMs }))
    .sort((a, b) => b.at - a.at)
  return withCapture.length ? withCapture[0].name : "v1"
}
const LABEL = arg("label", newestLabel())
/**
 * The floor on `net` — the difference the LINK makes once the composition's own
 * motion over the same interval has been subtracted, on whichever of the two
 * channels can see this relationship (`max(netL1, netTone * 8)`; see the probe
 * for why one channel is not enough). 1.0 is comfortably under anything an eye
 * would call a change and comfortably over the **0.000** the four structurally
 * empty cells read on the same instrument in the same window.
 */
const FLOOR = Number(arg("floor", 1.0))

const F = loadTs("lib/style-fusion.ts")
const DIR = join(ROOT, "docs", "verification", "fusion-combos", LABEL)
const FILE = join(DIR, "liveness.json")

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/** THE COMPARISON, WRITTEN SO A MISSING VALUE IS A FAILURE.
 *
 *  `v >= f` and `v > f` are both false for `undefined` and for `NaN`, so a
 *  failing set built by negating them silently drops the cell that has no
 *  number at all. These two say what they mean: v EXISTS, is a real number, and
 *  clears f. Negate them and a hole lands in the failing set where it belongs. */
const atLeast = (v, f) => Number.isFinite(v) && v >= f
const above = (v, f) => Number.isFinite(v) && v > f

/** Every number this gate compares, per measured cell. Not a wish-list: each
 *  name below is read by a row further down, and a cell missing one of them is
 *  a cell one of those rows would grade on `undefined`. */
const CELL_NUMBERS = ["maskPx", "opaqueFrac", "w", "h", "net", "netL1", "netTone", "control", "spinOnSelect", "signal"]

/**
 * IS THE CAPTURE THE THING THIS GATE THINKS IT IS? — asked of the parsed JSON,
 * before a single threshold. Pure, so the known-bads below hand it the two
 * mutations that got past the old version and watch it say no.
 */
export function cellAudit(results, wantKeys) {
  const rows = results.filter((r) => !r.refused && !r.lost)
  const seen = new Map()
  for (const r of rows) seen.set(r.key, (seen.get(r.key) ?? 0) + 1)
  const dupes = [...seen].filter(([, n]) => n > 1).map(([k, n]) => `${k} x${n}`)
  const missing = wantKeys.filter((k) => !seen.has(k))
  const want = new Set(wantKeys)
  const extra = [...seen.keys()].filter((k) => !want.has(k))
  const malformed = []
  for (const r of rows) {
    const holes = CELL_NUMBERS.filter((f) => !Number.isFinite(r[f]))
    const pm = r.perMomentNet
    if (!Array.isArray(pm) || pm.length === 0 || pm.some((v) => !Number.isFinite(v))) holes.push("perMomentNet")
    if (typeof r.empty !== "boolean") holes.push("empty")
    if (holes.length) malformed.push(`${r.key ?? "(no key)"}: ${holes.join(", ")}`)
  }
  return { dupes, missing, extra, malformed, measured: rows.length }
}

if (!existsSync(FILE)) {
  console.log(`FAIL  no capture at ${FILE}`)
  console.log("      run: node scripts/verify/_probe-fusion-combo-liveness.mjs --label=" + LABEL)
  process.exit(1)
}
const data = JSON.parse(readFileSync(FILE, "utf8"))
const rows = data.results.filter((r) => !r.refused && !r.lost)
const refused = data.results.filter((r) => r.refused)
/* A CELL THE PROBE COULD NOT MEASURE, which is a different verdict from a cell
 * that did not move and must never be allowed to become one. A dev server
 * reloads mid-run and takes the prepared page with it; the probe retries and,
 * failing that, writes the cell `lost` with NO `net` field. Filtered out of
 * `rows` above so nothing can average it in, and failed on here so a run with a
 * hole in it cannot report a clean table. */
{
  const lost = data.results.filter((r) => r.lost)
  say(
    lost.length === 0,
    "every cell was actually MEASURED — a cell the probe lost the page on is not a cell that did not move",
    lost.map((r) => `${r.key}: ${r.lost}`).join(" · ") ||
      `${rows.length} measured · ${data.reloads ?? 0} page reload(s) recovered mid-run`,
  )
}

/* ---- PROVENANCE ---------------------------------------------------------- */
{
  const capAt = statSync(FILE).mtimeMs
  const srcs = ["lib/style-fusion.ts", "components/style-panel-scaffold.tsx", "app/page.tsx"]
  const stale = srcs.filter((f) => statSync(join(ROOT, f)).mtimeMs > capAt)
  say(
    stale.length === 0,
    "the capture is NEWER than every source it grades",
    stale.length ? `${stale.join(", ")} changed after the capture — re-run the probe, do NOT relax this` : `${data.label} · ${data.at}`,
  )
}

/* ---- THE SET ------------------------------------------------------------- */
/* ⚠ THIS WAS A COUNT, AND A COUNT CANNOT SEE A SUBSTITUTION. Duplicating one
 * cell's record over another's keeps `rows.length` at 120 while a cell that was
 * never measured reads as measured, twice. Asked as a SET now, plus duplicates,
 * so the only way to 120 is the 120 that exist. */
const WANT_KEYS = F.FUSION_COMBO_LIST.map((c) => c.key)
const audit = cellAudit(data.results, WANT_KEYS)
say(
  refused.length === 0 && audit.missing.length === 0 && audit.extra.length === 0 && audit.dupes.length === 0,
  `every one of the ${WANT_KEYS.length} cells was reachable BY CLICK through the real control, and each appears EXACTLY ONCE`,
  refused.length
    ? `${refused.length} refused: ${refused.map((r) => r.key).join(", ")}`
    : audit.missing.length || audit.extra.length || audit.dupes.length
      ? [
          audit.missing.length ? `NOT IN THE CAPTURE: ${audit.missing.join(", ")}` : "",
          audit.extra.length ? `NOT A COMBO: ${audit.extra.join(", ")}` : "",
          audit.dupes.length ? `DUPLICATED: ${audit.dupes.join(", ")}` : "",
        ].filter(Boolean).join(" · ")
      : `${audit.measured} cells driven via __styleHarness.selectFusionCombo, ${new Set(rows.map((r) => r.key)).size} distinct keys`,
)

/* ---- THE NUMBERS EXIST AT ALL, BEFORE ANY OF THEM IS COMPARED ------------ */
say(
  audit.malformed.length === 0,
  `every measured cell carries all ${CELL_NUMBERS.length} numbers this gate compares, and every one is FINITE`,
  audit.malformed.length
    ? `${audit.malformed.length} cell(s) with holes: ${audit.malformed.slice(0, 6).join(" · ")}${audit.malformed.length > 6 ? ` · +${audit.malformed.length - 6} more` : ""}`
    : `${audit.measured} cells x ${CELL_NUMBERS.length} numbers + perMomentNet, no undefined and no NaN`,
)

/* ---- COVERAGE: did the capture actually catch the mark? ------------------- */
{
  const empty = rows.filter((r) => !atLeast(r.maskPx, 2000))
  say(
    empty.length === 0,
    "every capture contains the mark — a crop that caught nothing reads exactly like a cell that did nothing",
    empty.map((r) => `${r.key} ${Number.isFinite(r.maskPx) ? `${r.maskPx}px` : `maskPx ${r.maskPx} — NO NUMBER`}`).join(", ") ||
      `mask ${Math.min(...rows.map((r) => r.maskPx))}..${Math.max(...rows.map((r) => r.maskPx))}px, alpha ${(Math.min(...rows.map((r) => r.opaqueFrac)) * 100).toFixed(1)}%+`,
  )
  const dims = rows.filter((r) => !atLeast(r.w, 1440) || !atLeast(r.h, 1440))
  /* THE DETAIL USED TO PRINT `rows[0]` AS IF IT SPOKE FOR THE SET. On v1 it
   * printed "1499x1816" while 108 of the 120 frames are 2968x1816 — the window
   * changed geometry after the twelfth cell and this line reported the twelfth.
   * A gate stating a false fact about its own evidence is how the mismatch in
   * assert-fusion-combo-distinct's `dist()` stayed invisible. Report the set. */
  const geoms = [...new Set(rows.map((r) => `${r.w}x${r.h}`))]
  say(
    dims.length === 0,
    "every frame is >= 1440 on both axes",
    dims.length
      ? `${dims.length} under`
      : geoms.length === 1
        ? geoms[0]
        : `${geoms.length} geometries in one capture: ` +
          geoms.map((g) => `${g} on ${rows.filter((r) => `${r.w}x${r.h}` === g).length}`).join(" · "),
  )
}

/* ---- LIVENESS ------------------------------------------------------------ */
{
  const authored = rows.filter((r) => !r.empty)
  /* THE MEAN IS NOT ENOUGH ON ITS OWN, AND NEITHER IS A MAJORITY.
   *
   * A relationship's driver oscillates, so at some of the sampled moments it is
   * legitimately AT REST and the link contributes nothing — a majority rule
   * would call that dead. But a mean alone can be carried by one loud sample. So
   * both: the average has to clear the floor, AND at least one moment has to
   * clear it by a clear margin, which is the moment a viewer would have seen. */
  const peak = (r) => Math.max(...(r.perMomentNet ?? [0]))
  const dead = authored.filter((r) => !(r.net > FLOOR && peak(r) > FLOOR * 2))
  say(
    dead.length === 0,
    `all ${authored.length} authored cells change the mark — measured as the LINK's contribution with the composition's own motion subtracted`,
    dead.map((r) => `${r.key} net ${r.net.toFixed(2)} peak ${peak(r).toFixed(2)} [${(r.perMomentNet ?? []).join(", ")}]`).join(" · ") ||
      `floor ${FLOOR} · weakest mean ${Math.min(...authored.map((r) => r.net)).toFixed(2)} · weakest peak ${Math.min(...authored.map(peak)).toFixed(2)} · strongest ${Math.max(...authored.map((r) => r.net)).toFixed(2)}`,
  )
  /* THE KNOWN-BAD, AND IT IS A REAL PRODUCT STATE — not a synthetic mutant. */
  const empties = rows.filter((r) => r.empty)
  /* AND `DEAD` HAS TO BE A MEASUREMENT TOO. `NaN > FLOOR` is false, so a cell
   * with no `net` at all used to read as a confirmed dead cell and CALIBRATE
   * this gate's own floor. Dead means a real number at or under the floor. */
  const notDead = empties.filter((r) => !(Number.isFinite(r.net) && r.net <= FLOOR))
  say(
    empties.length === 4 && notDead.length === 0,
    "CALIBRATION · the four structurally empty cells read DEAD on the same instrument in the same window — it CAN report a dead relationship",
    notDead.map((r) => `${r.key} ${Number.isFinite(r.net) ? `moved ${r.net.toFixed(3)}` : `net ${r.net} — NOT A MEASUREMENT`}`).join(", ") ||
      empties.map((r) => `${r.key} ${r.net.toFixed(3)}`).join(" · "),
  )
  /* …AND THE SEPARATION IS REAL, not two numbers either side of a hair. */
  const worstLive = Math.min(...authored.map((r) => r.net))
  const bestDead = Math.max(...empties.map((r) => r.net), 0)
  say(
    worstLive > FLOOR && worstLive > bestDead + FLOOR,
    "the quietest live cell is clear of the loudest dead one — the floor separates two populations, not one",
    `quietest live ${worstLive.toFixed(3)} · loudest dead ${bestDead.toFixed(3)}`,
  )
  /* BOTH CHANNELS HAVE TO BE CARRYING THE SET, or one of them is decoration.
   * If every cell passed on L1 alone, the tone channel would be an unexercised
   * branch pretending to be a safeguard. */
  const byL1 = authored.filter((r) => above(r.netL1, FLOOR)).length
  const byTone = authored.filter((r) => above(r.netTone * 8, FLOOR)).length
  const onlyTone = authored.filter((r) => !above(r.netL1, FLOOR) && above(r.netTone * 8, FLOOR))
  say(
    onlyTone.length > 0,
    "the tone channel is load-bearing — some cells are visible ONLY as a change in the mark's own tone, which an L1 pixel diff cannot separate from a scrolling layer",
    `${byL1} cells clear on L1 · ${byTone} on tone · ${onlyTone.length} ONLY on tone (e.g. ${onlyTone.slice(0, 3).map((r) => r.key).join(", ")})`,
  )
  /* AND THE DRIFT CONTROL ITSELF HAS TO HAVE BEEN MEASURED. A run in which every
   * `control` came back 0.000 would mean the unlinked pair never captured — the
   * subtraction would be vacuous and every cell would pass on its raw signal. */
  const measuredDrift = rows.filter((r) => above(r.control, 0.05))
  say(
    measuredDrift.length > 0,
    "CALIBRATION · the drift control is a real measurement, not a constant zero — some cells DO have a composition that moves on its own",
    `${measuredDrift.length} of ${rows.length} cells show background motion (max ${Math.max(...rows.map((r) => r.control)).toFixed(2)})`,
  )
}

/* ---- THE TURNTABLE ------------------------------------------------------- */
{
  const wrong = []
  for (const r of rows) {
    const cell = F.FUSION_COMBOS_BY_KEY[r.key]
    const wants = !!cell && F.fusionUsesView(cell)
    /* NO NUMBER IS NOT "NO SPIN". `undefined > 0` is false, so a cell whose
     * `spinOnSelect` went missing used to agree with every cell that correctly
     * does not spin, and 75 of the 120 cells correctly do not spin. */
    if (!Number.isFinite(r.spinOnSelect)) {
      wrong.push(`${r.key}: spinOnSelect is ${r.spinOnSelect}, not a reading`)
      continue
    }
    /* ⚠ AND THE RATE, NOT JUST "SOME SPIN". This row's own detail line has always
     * SAID "all at ${F.FUSION_VIEW_SPIN_DEG} deg/s" while the test was `> 0`, so
     * the gate stated a fact about its evidence that it never checked — the same
     * thing the geometry comment twenty lines up warns about. Channel D of
     * `assert-gate-integrity` proves it: it moved `FUSION_VIEW_SPIN_DEG` from 12
     * to 19 and this gate SURVIVED, 0 of 1 mutants killed. All 45 camera-driven
     * cells read exactly 12 in the capture, so the exact rate is what to ask. */
    const want = wants ? F.FUSION_VIEW_SPIN_DEG : 0
    if (r.spinOnSelect !== want) wrong.push(`${r.key}: wants ${want} deg/s, got ${r.spinOnSelect}`)
  }
  const viewCells = rows.filter((r) => {
    const c = F.FUSION_COMBOS_BY_KEY[r.key]
    return !!c && F.fusionUsesView(c)
  })
  say(
    wrong.length === 0,
    "pressing a camera-driven cell STARTS the turntable, and pressing any other one does not",
    wrong.slice(0, 6).join(" · ") || `${viewCells.length} camera-driven cells, all at ${F.FUSION_VIEW_SPIN_DEG} deg/s`,
  )
}

/* ---- THE KNOWN-BADS, ON THE REAL CAPTURE, MUTATED IN MEMORY --------------
 * The two the crosscheck ran by hand. They are handed to `cellAudit`, the same
 * function that grades the live file three rows up, so a run in which these go
 * quiet is a run in which the live rows have stopped seeing the same things. */
{
  /* THE SUBSTITUTION. One cell's record copied over another's: still 120 rows,
   * still no refusals, and `material+layers` was never measured. */
  const victim = "material+layers"
  const donor = "material+animation"
  const dup = data.results.map((r) => (r.key === victim ? { ...data.results.find((x) => x.key === donor), key: donor } : r))
  const a = cellAudit(dup, WANT_KEYS)
  say(
    dup.length === data.results.length && a.missing.includes(victim) && a.dupes.some((d) => d.startsWith(donor)),
    "KNOWN-BAD `duplicated` — one cell's record copied over another's — turns the SET row red, at the same 120 rows the count read as clean",
    `${dup.length} rows in, ${dup.length} rows out · missing ${a.missing.join(", ") || "NOTHING — the set check cannot see a substitution"} · duplicated ${a.dupes.join(", ") || "NOTHING"}`,
  )
}
{
  /* THE HOLE. Three numbers taken off one cell, which is what printed
   * `mask NaN..NaN` and `undefinedx1816` while the gate said 11/11. */
  /* BY INDEX, NOT BY KEY. A capture that is ALREADY broken can hold the same key
   * twice, and a key-matched mutation would then hole two cells and make this
   * control fail for a reason that is not its own. One cell, chosen positionally. */
  const idx = data.results.findIndex((r) => !r.refused && !r.lost)
  const target = data.results[idx].key
  const holed = data.results.map((r, i) => {
    if (i !== idx) return r
    const { maskPx, w, spinOnSelect, ...rest } = r
    return rest
  })
  const a = cellAudit(holed, WANT_KEYS)
  const hit = a.malformed.find((m) => m.startsWith(`${target}:`)) ?? ""
  say(
    a.malformed.length === 1 && ["maskPx", "w", "spinOnSelect"].every((f) => hit.includes(f)),
    "KNOWN-BAD `holed` — maskPx, w and spinOnSelect deleted from one cell — turns the NUMBERS row red rather than being excluded from every failing set",
    hit || "NO CELL FLAGGED — a cell with three missing numbers read as sound",
  )
  /* AND THE ARITHMETIC THAT MADE IT INVISIBLE, WRITTEN OUT. Not a description
   * of the defect: the comparisons themselves, on the value that was missing. */
  const gone = holed.find((r) => r.key === target)
  say(
    !(gone.maskPx < 2000) && !(gone.w < 1440) && !(gone.spinOnSelect > 0) && !atLeast(gone.maskPx, 2000) === true,
    "CALIBRATION · and the reason it was invisible — `undefined < 2000` is FALSE, so the old comparisons excluded the broken cell from their own failing sets",
    `maskPx ${gone.maskPx}: \`< 2000\` is ${gone.maskPx < 2000}, \`atLeast(_, 2000)\` is ${atLeast(gone.maskPx, 2000)} · ` +
      `w ${gone.w}: \`< 1440\` is ${gone.w < 1440} · spinOnSelect ${gone.spinOnSelect}: \`> 0\` is ${gone.spinOnSelect > 0}`,
  )
}

/* ---- THE TABLE, so a reader can see the shape rather than take the verdict - */
console.log("\nweakest twelve, so the bottom of the set is visible rather than averaged away:")
for (const r of [...rows].sort((a, b) => a.signal - b.signal).slice(0, 12))
  console.log(
    `  ${r.empty ? "EMPTY" : "     "} ${r.key.padEnd(52)} ${r.mode.padEnd(6)} signal ${r.signal.toFixed(3).padStart(8)} · control ${r.control.toFixed(3)}`,
  )

console.log(`\n${fails === 0 ? `ALL ${checks} FUSION-COMBO-LIVENESS ASSERTIONS PASS` : `${fails} of ${checks} FUSION-COMBO-LIVENESS ASSERTIONS FAILED`}`)
process.exit(fails === 0 ? 0 : 1)
