// ASSERT-DRAWIN-2D-PARITY — does the 3D reveal's mechanism port to 2D, or only
// its clock?
//
// The question, put by Sebs: *"yes but remember the Free Stroke animation was
// for 3D strokes, we don't know if it works on 2D stuff."* He is right that
// they are not the same thing, and the honest answer needs the two halves
// separated and each one tested on its own:
//
//   THE PROGRESS MODEL   time fraction -> distance fraction along the pen's own
//                        path. Arithmetic over `Point.t`. Register-independent
//                        by construction — there is no renderer in it.
//   THE MECHANISM        what you do with that distance. NOT portable:
//                        3D reveals by `setDrawRange` over an index buffer
//                        counting-sorted by arc length at build time
//                        (lib/implicit-surface.ts §6). A 2D canvas path has no
//                        index buffer, so there is nothing to sort and nothing
//                        to range. Its equivalent is polyline truncation at a
//                        cumulative arc length (lib/flat-ink.ts).
//
// So this proves TWO separate things:
//
//   1. Both registers reach the SAME distance at the SAME playhead, because
//      they call the same function. Not by inspection — by running them.
//   2. The 2D mechanism actually inks that distance, measured on a real 2D
//      raster: the ink laid down at playhead t is the prefix of the pen path
//      the clock says it should be, to within a fraction of the line width.
//
// NEGATIVE CONTROLS, all required to fail, ALL ON THE BARE INVOCATION since
// 2026-08-07 (they were `--control=`, which no sweep passed — see `runArm`):
//   clock      the 2D side is fed the raw playhead instead of the shared clock,
//              i.e. the constant-speed sweep it did before. The "clock" row must
//              break.
//   raw        the 2D side is driven at reveal mode `raw` while the 3D arm stays
//              on `hybrid`. The "clock" row must break. This is the "the Natural
//              / Authentic toggle silently did NOTHING" defect lib/pen-reveal.ts's
//              header records, arriving through the 2D register instead: an
//              argument that never reaches the mechanism.
//   order      the 2D side draws the strokes in REVERSE PEN ORDER, i.e. it inks
//              the right amount in the wrong place. The "begins" row must break —
//              and `monoArea` / `monoLead` must NOT, which is the point of it.
//
// ⚠ ROW 1 WAS A GREEN ROW THAT COULD NOT FAIL, AND IT WAS THE ROW THIS FILE IS
// NAMED AFTER (found and repaired 2026-08-03). It read:
//
//     const three = revealDistanceFraction(strokes, t, MODE, BLEND)
//     const two = CONTROL === "clock" ? t : revealDistanceFraction(strokes, t, MODE, BLEND)
//
// On the DEFAULT invocation — the only one anything runs — those two lines are
// the identical pure call, so `worstClock` was 0 BY CONSTRUCTION and
// `worstClock < 1e-9` could not go red for any value of anything. Nothing was
// read from the 2D renderer at all: `r.drawAtTime` was never consulted, and the
// comment claiming the number was "reproduced through the same entry point"
// described code that was not there. `f(x) === f(x)` is not a parity test.
//
// THE REPAIR, and the discipline it borrows. `assert-drawin-timing.mjs:70-82`
// deliberately RE-DERIVES its easing rather than importing it, precisely so its
// row is not a function compared with itself. The equivalent here is to take
// the second arm out of the 2D REGISTER — from its pixels. `FlatRenderer` has
// two entry points: `draw(ctx, DISTANCE)` truncates the polylines at a
// cumulative arc length, and `drawAtTime(ctx, PLAYHEAD)` is the one the app
// calls. So row 1 rasterises `drawAtTime` at a playhead, then INVERTS `draw` by
// bisection to recover the distance fraction those pixels correspond to, and
// compares that recovered number against the 3D side's arithmetic. The two arms
// now come from genuinely different code paths — one is `revealDistanceFraction`
// called directly, the other is ink on a canvas — and the row goes red if the
// 2D register's wiring breaks in any of the ways it actually can: `hasTiming`
// silently false (`drawAtTime` collapses to `draw` and the register runs on a
// raw playhead), the mode/blend arguments not reaching `revealDistanceFraction`,
// or the truncation itself drifting from the arc length it was handed.
//
// The order control exists because the first version of row 2 could NOT fail on
// it: inked AREA is symmetric under reversal, so an area metric is structurally
// blind to direction — the same class of blindness the crease census had. Row 3
// asks WHERE the ink is instead of how much, which is the property a reveal is
// actually defined by.
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes } from "./_hero-word.mjs"
const require = createRequire(import.meta.url)
const { createCanvas } = require("@napi-rs/canvas")

const { makeFlatRenderer } = loadTs("lib/flat-ink.ts")
const { revealDistanceFraction } = loadTs("lib/pen-reveal.ts")

const strokes = processedHeroStrokes()

/**
 * ONE ARM OF THIS GATE, run against `CONTROL` — "" is the shipped subject and
 * `clock` / `raw` / `order` are the three known-bads the header describes.
 *
 * ⚠ THESE THREE USED TO BE `--control=`, AND NO SWEEP HAS EVER PASSED IT.
 * `docs/explainers/21-losing-your-work.md` §7 requires a control on the DEFAULT
 * invocation; explainer 31 measured nineteen gates ignoring that, and this was
 * one — so the six greens below were, in a sweep, six greens no build had ever
 * been rejected against.
 *
 * The flag is DELETED and the arms run INLINE, in this process. Not spawned:
 * `assert-hero-transition` re-runs itself per control and needs channel J's
 * `selfSweeps()` to understand that (`assert-gate-integrity.mjs` is another
 * lane's file and that addition has not landed here), and not restated either —
 * a second copy of the mechanism would be the copy certifying the original.
 * One function, four calls.
 *
 * The control arms' verdicts are COLLECTED, NEVER PRINTED AS ROWS. A control run
 * makes rows red on purpose and both battery runners count an indented `FAIL`,
 * so echoing them would post this gate's own evidence as its failures — Lane I's
 * finding on `assert-hero-transition`, applied here before it could bite.
 */
function runArm(CONTROL, quiet) {
const verdicts = []
const say = (key, ok, label, detail) => {
  verdicts.push({ key, ok, label, detail })
  if (!quiet) console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}
const log = (...a) => { if (!quiet) console.log(...a) }

const ordered = CONTROL === "order" ? [...strokes].reverse() : strokes
const polylines = ordered.map((s) => s.points.map((p) => ({ x: p.x, y: p.y })))

const W = 1200
const H = 500
const footprint = { w: 1000, cx: W / 2, cy: H / 2 }
const r = makeFlatRenderer(polylines, footprint, ordered)

log(`\n=== 2D / 3D DRAW-IN PARITY ===\n`)
say("timing", r.hasTiming, "the 2D renderer was handed a real recording", `${strokes.length} strokes`)

/* ---- 1. ONE CLOCK ------------------------------------------------------- */
// The 3D side's number is `revealDistanceFraction`, the same function
// `AnimatedStrokes` calls. The 2D side's number is READ BACK OFF THE 2D
// RASTER — see the header for why it may not be the same call again.
const MODE = "hybrid"
const BLEND = 0.4

/** The one rasteriser every row below uses. Paper white, ink black, count dark. */
function rasterInk(drawInto) {
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)
  drawInto(ctx)
  const { data } = ctx.getImageData(0, 0, W, H)
  let n = 0
  for (let i = 0; i < data.length; i += 4) if (data[i] < 128) n++
  return n
}

/**
 * THE 2D REGISTER, DRIVEN THE WAY THE APP DRIVES IT: by a playhead.
 *
 * This is the arm under test. `--control=clock` substitutes the raw playhead
 * (the constant-speed sweep the register did before the shared clock existed);
 * `--control=raw` leaves the entry point alone and changes only the reveal MODE
 * the mechanism is handed, which is the subtler of the two defects.
 */
const inkAtPlayhead = (t) =>
  rasterInk((ctx) => {
    if (CONTROL === "clock") r.draw(ctx, t, "#000000")
    else if (CONTROL === "raw") r.drawAtTime(ctx, t, "#000000", "raw", BLEND)
    else r.drawAtTime(ctx, t, "#000000", MODE, BLEND)
  })

/** The 2D register's OTHER entry point: an explicit distance along the pen path. */
const inkAtDistance = (d) => rasterInk((ctx) => r.draw(ctx, d, "#000000"))

/**
 * RECOVER, FROM PIXELS, THE DISTANCE THE 2D REGISTER ACTUALLY REACHED.
 *
 * `draw` truncates every polyline at a cumulative arc length, so inked area is
 * monotone non-decreasing in `d` and the map is invertible by bisection. The
 * recovered value is the infimum of `{ d : ink(d) >= target }`, which is the
 * true distance wherever the curve is locally strictly increasing — and it is,
 * steeply: one thousandth of `d` is about `lineWidth * totalLen / 1000` px of
 * new ink, tens of pixels on this word, so the inversion is far finer than the
 * tolerance below. 20 halvings resolve `d` to under 1e-6.
 */
function recoverDistance(targetInk) {
  let lo = 0
  let hi = 1
  for (let k = 0; k < 20; k++) {
    const mid = (lo + hi) / 2
    if (inkAtDistance(mid) < targetInk) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/* THE TOLERANCE IS DERIVED, NOT PICKED. The finest distance this instrument can
 * resolve is one pixel of pen travel expressed as a fraction of the whole path;
 * four of those is the floor, and 1e-4 is a hard floor under that so a very
 * long path cannot make the row unfalsifiably tight. The `clock` and `raw`
 * controls both disagree by two to three orders of magnitude more than this —
 * printed on every run, so the separation is visible rather than asserted. */
const CLOCK_TOL = Math.max(4 / r.totalLen, 1e-4)

let worstClock = 0
const rows = []
/* ⚠ AN ESCAPE HATCH WAS BUILT HERE ON 2026-08-28 AND IT WAS 0 BY CONSTRUCTION.
 *
 * The argument for it was good and half of it is right. `recoverDistance`
 * bisects on INK COUNT, so it cannot resolve a distance across a stretch where
 * moving the distance does not move the ink; at t 0.60 it lands 1.81e-3 from the
 * 3D side's answer and both distances render the SAME raster. So the code asked,
 * for any sample over tolerance, whether `inkAtPlayhead(t)` and
 * `inkAtDistance(three)` agree, and if they did it set that sample's diff to 0.
 * The row went green.
 *
 * 🔴 THAT CONDITION IS TRUE AT EVERY PLAYHEAD, AND IT IS TRUE BY CONSTRUCTION.
 * `drawAtTime` IS `draw(revealDistanceFraction(...))` — `lib/flat-ink.ts:585`.
 * So `inkAtPlayhead(t)` and `inkAtDistance(revealDistanceFraction(t))` are the
 * same pure call with the same arguments. MEASURED, 19 of 19 playheads report an
 * identical count, from 4908 px at t 0.05 to 58428 px at t 0.95. The hatch
 * therefore zeroed ANY disagreement of ANY size on the shipped arm, and the row
 * could no longer report the thing it exists for. It survived its own controls
 * only because `--control=clock` and `--control=raw` REPLACE `inkAtPlayhead`, so
 * the two calls stop being the same call there.
 *
 * That is the parked self-compare printed a few lines below — `three` against a
 * second call of the same function, 0 on every input — arriving a second time
 * wearing a raster. It is why that statistic is parked rather than deleted.
 *
 * So the sample is graded. The row stays RED at 1.81e-3 against 1.30e-3, the
 * tolerance is untouched, and what the readback could actually resolve is
 * reported underneath the row instead of being used to excuse it. Row F38, N20.
 */
// PARKED — the prior row's statistic, kept so the defect stays legible: `three`
// against a SECOND CALL of the same pure function. It is 0 on every input by
// construction, which is exactly why it had to go.
let parkedSelfCompare = 0
for (let i = 1; i < 20; i++) {
  const t = i / 20
  const three = revealDistanceFraction(strokes, t, MODE, BLEND)
  const two = recoverDistance(inkAtPlayhead(t))
  parkedSelfCompare = Math.max(
    parkedSelfCompare,
    Math.abs(three - revealDistanceFraction(strokes, t, MODE, BLEND)),
  )
  worstClock = Math.max(worstClock, Math.abs(three - two))
  if (i % 4 === 0)
    rows.push(
      `   t ${t.toFixed(2)}   3D ${three.toFixed(5)}   2D (read off the raster) ${two.toFixed(5)}   |diff| ${Math.abs(three - two).toExponential(2)}`,
    )
}
log(rows.join("\n"))
log(
  `   pen path ${r.totalLen.toFixed(1)} px · tolerance ${CLOCK_TOL.toExponential(2)} of the path` +
    ` · parked self-compare ${parkedSelfCompare.toExponential(2)} (0 by construction — the defect)`,
)
say(
  "clock",
  worstClock < CLOCK_TOL,
  "the 2D and 3D registers reach the same distance at the same playhead",
  `worst disagreement ${worstClock.toExponential(2)} against a ${CLOCK_TOL.toExponential(2)} tolerance`,
)

/**
 * WHEN THAT ROW IS RED, SAY WHAT THE READBACK COULD ACTUALLY RESOLVE.
 *
 * ⚠ THE INVERSION'S PREMISE IS FALSE, AND THE ROW'S NUMBER IS THE PROOF.
 * The comment on `recoverDistance` says inked area is monotone non-decreasing in
 * `d`. Measured 2026-08-28 on this fixture: it is not. Across d in [0.6300,
 * 0.6380] the count oscillates 38431 ↔ 38432 nine times — one antialiased pixel
 * at the round cap crossing the 128 threshold as the cap slides sub-pixel.
 *
 * And around t = 0.60 sits a DEAD ZONE: over d in [0.631599, 0.635109] the count
 * never leaves 38431 ± 1. That is 3.51e-3 of the path, 10.80 px of 3075.8, and
 * 2.70× this row's tolerance. Bisection returns an INFIMUM, so it lands on the
 * left edge (0.632159); the 3D side's answer (0.633972) sits inside the zone;
 * and the gap between them is the row's 1.81e-3. Both distances render a raster
 * PIXEL-IDENTICAL to `drawAtTime(0.60)`, 0 of 38431 differing. THE TWO REGISTERS
 * DRAW THE SAME PICTURE; the instrument that reads one of them back has no
 * signal to steer by across that stretch. At the cleanest playhead (t = 0.85)
 * the dead zone is 5.0e-5 — 0.15 px — so the outlier's is 70× the control's.
 *
 * LANE N8 GUESSED THIS AND ITS INSTRUMENT WAS TOO COARSE TO CONFIRM IT. It
 * tested a retrace with an AVERAGED new-ink rate (0.665 at d = 0.634, no lower
 * than the 0.505 at t = 0.40 where the row is clean) and rejected the idea. A
 * mean over any window wider than 3.51e-3 is dominated by the steep path either
 * side of the zone. The hypothesis was the right shape and the statistic could
 * not see it. WHY 10.8 px of pen travel adds no ink there is still open: it is
 * on stroke 6 of 13, 92.2 % along it, and that stroke's pressure RISES through
 * the stretch (0.573 → 0.611), so it is not an end taper.
 *
 * ⚠ AND THE ROW CANNOT SIMPLY BE RE-POINTED AT THE RASTERS. `drawAtTime` IS
 * `draw(revealDistanceFraction(...))` (`lib/flat-ink.ts:585`), so comparing
 * `draw(three)` against `drawAtTime(t)` pixel for pixel is the same pure
 * function called twice — precisely the parked self-compare printed above,
 * which is 0 on every input by construction and is why it was removed. The
 * bisection exists to avoid that. So: the bar is UNTOUCHED, the row stays red,
 * and the reader gets the resolution instead of a bare number. Row F38, N20.
 *
 * Two extra rasters, and only on a red run.
 */
if (worstClock >= CLOCK_TOL) {
  let atWorstT = 0
  let atWorstTwo = 0
  let seen = 0
  for (let i = 1; i < 20; i++) {
    const t = i / 20
    const three = revealDistanceFraction(strokes, t, MODE, BLEND)
    const two = recoverDistance(inkAtPlayhead(t))
    if (Math.abs(three - two) > seen) {
      seen = Math.abs(three - two)
      atWorstT = t
      atWorstTwo = two
    }
  }
  /* ⚠ NOT "do the two arms ink the same count" — see the block above the loop;
   * that question is 0 by construction and answers itself. This asks the ruler
   * about ITSELF: how far can `d` travel from the bisection's answer before the
   * ink count leaves it, oscillation and all. Inside that stretch the bisection
   * has no signal to steer by, so the width IS its resolution here. Roughly a
   * dozen rasters, and only on a run that is already red. */
  const target = inkAtDistance(atWorstTwo)
  const flat = (d) => d >= 0 && d <= 1 && Math.abs(inkAtDistance(d) - target) <= 1
  let lo = atWorstTwo
  let hi = atWorstTwo
  for (const step of [1e-3, 1e-4]) {
    while (flat(hi + step)) hi += step
    while (flat(lo - step)) lo -= step
  }
  const width = hi - lo
  log(
    `   ⚠ at t ${atWorstT.toFixed(2)} the readback is BLIND over d in [${lo.toFixed(6)}, ${hi.toFixed(6)}]:` +
      ` ${(width * r.totalLen).toFixed(2)} px of path across which the ink never leaves ${target} ± 1,` +
      ` which is ${(width / CLOCK_TOL).toFixed(2)}× this row's tolerance.` +
      `\n     Bisection returns an infimum, so it reports the left edge of that stretch and the` +
      ` disagreement above is where the 3D side's answer sits inside it (F38).`,
  )
}

/* ---- 2. THE 2D MECHANISM ACTUALLY INKS THAT DISTANCE --------------------
 *
 * Rasterise, then ask the question a reveal is defined by: how much of the pen
 * path is inked. Measured as the fraction of the FINAL ink present at each
 * playhead — the same statistic `assert-drawin-parity.mjs` measures on the real
 * 3D stage, so the two are comparable numbers rather than two ideas.
 *
 * The tolerance is not a taste call: a truncated polyline ends in a ROUND CAP
 * half a line width past the cut, so the inked area runs slightly ahead of the
 * pen by a bounded amount. Expressed as a fraction of the whole word that is
 * `(lineWidth/2) * lineWidth / totalArea`, which is computed below rather than
 * guessed.
 */
// One rasteriser, one place the control's substitution is applied — row 1 now
// owns both, and this row reads the register through the same door.
const inkFractionAt = (t) => inkAtPlayhead(t)

const full = inkFractionAt(1)
const capSlop = (r.lineWidth * r.lineWidth) / 2 / full
log(`\n   final ink ${full} px · line width ${r.lineWidth.toFixed(2)} px · end-cap slop ${(capSlop * 100).toFixed(2)} %`)
log("    playhead   clock says   2D raster inked   |diff|")
let worstInk = 0
for (let i = 1; i < 10; i++) {
  const t = i / 10
  const want = revealDistanceFraction(strokes, t, MODE, BLEND)
  const got = inkFractionAt(t) / full
  const d = Math.abs(got - want)
  if (d > worstInk) worstInk = d
  log(`   ${t.toFixed(2)}       ${want.toFixed(4)}       ${got.toFixed(4)}          ${d.toFixed(4)}`)
}
// 3 x the cap slop, floored at 2 %: the cut end is a round cap, the word's own
// overlaps mean inked AREA is not exactly proportional to inked LENGTH, and
// both are bounded and small. Anything past this is a mechanism that is not
// tracking the clock.
const TOL = Math.max(0.02, capSlop * 3)
say(
  "ink",
  worstInk <= TOL,
  "the 2D mechanism inks the distance the shared clock asks for",
  `worst |diff| ${(worstInk * 100).toFixed(2)} % against a ${(TOL * 100).toFixed(2)} % tolerance`,
)

/* ---- 3. IN THE RIGHT PLACE, IN THE RIGHT ORDER ---------------------------
 *
 * WHERE the ink is, not how much. An area metric is structurally blind to
 * direction — reverse the pen order and every area figure above is unchanged,
 * which the `--control=order` run proves — so the mechanism claim needs a
 * statistic that carries position.
 *
 * The pen writes "Desk Doodles" left to right, so the LEADING EDGE of the ink
 * (its rightmost inked column) must advance monotonically across the reveal and
 * must cover the word's full width by the end. Drawing the same strokes in
 * reverse order inks exactly the same amount at every playhead and puts the
 * leading edge at the far end from the first frame.
 */
function inkProfileAt(t) {
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)
  if (CONTROL === "clock") r.draw(ctx, t, "#000000")
  else if (CONTROL === "raw") r.drawAtTime(ctx, t, "#000000", "raw", BLEND)
  else r.drawAtTime(ctx, t, "#000000", MODE, BLEND)
  const { data } = ctx.getImageData(0, 0, W, H)
  let n = 0
  let maxX = -1
  let minX = W
  let sumX = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (data[(y * W + x) * 4] < 128) {
        n++
        sumX += x
        if (x > maxX) maxX = x
        if (x < minX) minX = x
      }
    }
  }
  return { n, maxX, minX, cx: n ? sumX / n : 0 }
}

log("\n    playhead   ink px   leading edge x   centroid x")
let monotoneLead = true
let monotoneArea = true
let prevLead = -1
let prevN = -1
for (let i = 1; i <= 10; i++) {
  const t = i / 10
  const p = inkProfileAt(t)
  // 2 px of tolerance: the leading edge is an antialiased round cap and its
  // thresholded column can wobble by a pixel between adjacent playheads.
  if (p.maxX < prevLead - 2) monotoneLead = false
  if (p.n < prevN - 1) monotoneArea = false
  prevLead = p.maxX
  prevN = p.n
  if (i % 2 === 0) {
    log(`   ${t.toFixed(2)}       ${String(p.n).padStart(6)}   ${String(p.maxX).padStart(9)}       ${p.cx.toFixed(1)}`)
  }
}
say("monoArea", monotoneArea, "the 2D reveal never goes backwards")
say(
  "monoLead",
  monotoneLead,
  "the pen's LEADING EDGE advances left to right, i.e. the ink lands in pen order",
)
// AND IT STARTS AT THE BEGINNING OF THE WORD. Monotonicity alone is not enough
// and the order control proved it: draw the strokes backwards and the leading
// edge starts at the far right and simply never moves, which is monotone. This
// is the row that actually carries direction.
const early = inkProfileAt(0.12)
const finalP = inkProfileAt(1)
const wordW = finalP.maxX - finalP.minX
const earlyPos = (early.cx - finalP.minX) / wordW
log(
  `   at playhead 0.12 the ink centroid sits ${(earlyPos * 100).toFixed(1)} % across the word ` +
    `(word spans x ${finalP.minX}–${finalP.maxX})`,
)
say(
  "begins",
  earlyPos < 0.3,
  "the reveal BEGINS where the pen began — the early ink is in the first third of the word",
  `${(earlyPos * 100).toFixed(1)} %`,
)

return verdicts
}

/* ── THE SHIPPED ARM ─────────────────────────────────────────────────────── */
const real = runArm("", false)
let pass = real.every((v) => v.ok)

/* ── THE THREE CONTROLS, on the bare invocation ───────────────────────────
 *
 * Each names the row the header says it must break, so a control that fires for
 * the WRONG reason is caught too — "some row went red" is a weaker claim than
 * this file can afford, given that its own history is a row going green for a
 * reason nobody had checked.
 *
 * `order` is required to break `begins` and NOT `monoArea`/`monoLead`, and that
 * asymmetry is the file's own recorded finding: reversed strokes ink the same
 * AREA at every playhead and leave the leading edge parked at the far right,
 * which is monotone. A control that reddened everything would prove less.
 */
const MUST_REDDEN = {
  clock: { row: "clock", why: "the 2D side fed the RAW PLAYHEAD instead of the shared clock — the constant-speed sweep the register did before" },
  raw: { row: "clock", why: "the 2D side driven at reveal mode `raw` while the 3D arm stays on `hybrid` — an argument that never reaches the mechanism" },
  order: { row: "begins", why: "the 2D side drawing the strokes in REVERSE PEN ORDER — the right amount of ink in the wrong place" },
}
let controlFailed = 0
console.log("")
for (const [name, want] of Object.entries(MUST_REDDEN)) {
  const arm = runArm(name, true)
  const target = arm.find((v) => v.key === want.row)
  const reds = arm.filter((v) => !v.ok)
  const ok = target && !target.ok
  if (!ok) controlFailed++
  console.log(
    `${ok ? "PASS" : "FAIL"}  CONTROL · KNOWN-BAD \`${name}\` — ${want.why} — is REJECTED by the "${want.row}" row` +
      ` — ${reds.length} of ${arm.length} row(s) red: ${reds.map((v) => v.key).join(" ") || "NONE, i.e. THIS GATE IS BLIND"}` +
      ` · target "${want.row}" ${ok ? "went red as required" : "STAYED GREEN"}` +
      ` · ${target ? `read ${target.detail}` : "row not found"}`,
  )
}
if (controlFailed) pass = false
console.log(
  pass
    ? "\nALL PASS"
    : `\nFAILURES ABOVE${controlFailed ? ` — ${controlFailed} of them CONTROL row(s): the instrument, not the subject` : ""}`,
)
process.exit(pass ? 0 : 1)
