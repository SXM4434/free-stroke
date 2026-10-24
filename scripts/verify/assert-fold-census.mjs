// FOLD CENSUS — does any shell pass through ITSELF?
//
// THE GAP THIS CLOSES. Every geometry gate in this repo reads
// `__geomDebug.probeDihedral`, and that census scores a shared edge as
//
//     min( acos(n0·n1), acos(−n0·n1) )
//
// which is bounded by 90 and is SMALLEST when the two faces are ANTIPARALLEL —
// precisely the configuration a fold produces. So a flap of surface turned back
// through itself reads as a SMALL crease. It is not a tuning problem: no
// threshold on a dihedral angle can be made fold-sensitive, because the quantity
// itself throws the information away. Explainer 17 §2 records what that cost:
// the extrude seam flap was invisible to every number the census reports
// (manifold, closed, low counts, `wall over30` 32/6161) and obvious in one
// frame, and it was found by eye.
//
// It is not hypothetical for Inflate either. On `square/inflate` at
// `fusion: "loft"` the census reports **boundary 0, non-manifold 0, degenerate
// 0** — every topology number says the shell is clean — while the loft's own
// embedding predicate reports 8 folding ring pairs at 0.158 r depth and the ray
// census below finds 740 rays crossing 4 to 8 sheets.
//
// So this asks a DIFFERENT question of the same buffers: how many sheets does a
// −Z ray cross?
//
//     a closed embedded shell     every ray hits 0 or 2
//     a folded shell              rays over the fold hit 4, 6, ...
//
// PER COMPONENT, and that is the load-bearing detail. A fold is one shell
// passing through ITSELF. Two crossing strokes in Rod / Extrude / Inflate-loft
// are two shells passing through EACH OTHER, which is documented behaviour of
// those modes ("where two strokes cross the two tubes INTERPENETRATE",
// lib/geometry-engines.ts §INFLATE FUSION CONTROLS) and not a regression. A
// whole-drawing ray count cannot tell those apart and would fire on `crossing`
// in three modes on day one — a gate that cries wolf gets switched off. The
// components are recovered in Node by union-find over the index buffer, because
// `dumpMeshes` concatenates with indices rebased and there is no per-mesh
// boundary in its output.
//
// CALIBRATION, BEFORE ANY ROW IS BELIEVED — four ways, three of them known-bad:
//   • a synthetic tube swept the way the loft sweeps one, around a 90 degree
//     corner, at a spacing that makes it fold BY CLOSED FORM (the engine's own
//     predicate: (rᵢ+rᵢ₊₁)·sin(Δθ/2) − h > 0). The census must FIRE.
//   • its clean twin — identical construction, wider spacing, fold depth
//     negative. It must NOT fire.
//   • the crease census, mirrored faithfully in Node and run on those SAME two
//     meshes, must fail to separate them. That is the blindness, in closed form,
//     and it is asserted rather than described.
//   • the mirror is cross-checked against the real `probeDihedral` on the real
//     buffers, so the previous point is a statement about the shipped census and
//     not about my copy of it.
//   • the real known-bad: `square/inflate` at `fusion: "loft"` must FIRE.
//
// EVERY FOLD COUNT IS SWEPT ACROSS GRIDS, and the fixtures and modes are
// IMPORTED rather than copied — see the notes at `GRIDS` and at the `SHAPES`
// import. Three instrument defects were repaired here on 2026-08-03 and all
// three are named at the code that fixes them: a fold count pinned at one grid
// (class 5), a fixture set that had diverged from the canonical five (class 4),
// and a `--modes=` subset that dropped twelve of sixteen rows and still printed
// ALL PASS (class 7).
//
// Run: node scripts/verify/assert-fold-census.mjs [--label=run] [--modes=...]
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import {
  syntheticFoldTube,
  creaseCensusNode,
  foldCensusComponents,
} from "./lib/elbow-geom.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"
/* THE FIXTURES, IMPORTED RATHER THAN COPIED.
 *
 * INSTRUMENT REPAIR 2026-08-03 — A DIVERGED FIXTURE SET (class 4).
 *   WAS: a local `SHAPES` with FOUR entries (crossing, circle, square, tick),
 *   under the comment "The same fixtures assert-mode-rims uses". They are not:
 *   `scripts/verify/lib/engine-node.mjs:145` and `assert-seam.mjs` both
 *   enumerate FIVE. The missing one is `openArc` — and this gate's own ledger
 *   cites `openArc/solid` at 59 rays as evidence (see the KNOWN_OPEN note),
 *   which means the gate reasons about a fixture it does not sweep. A copied
 *   fixture list is a fixture list that will diverge; this one already had.
 *   Importing the canonical set makes divergence impossible rather than
 *   detectable. */
import { SHAPES } from "./lib/engine-node.mjs"
import { loadTs } from "./_ts-load.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
/* EVERY GeometryMode, derived from the engine's own registry
 * (`lib/geometry-engines.ts` `export const engines: Record<GeometryMode, …>`)
 * rather than typed here — so a fifth mode is swept on the day it lands. */
const ALL_MODES = Object.keys(loadTs("lib/geometry-engines.ts").engines)
const MODES = arg("modes", ALL_MODES.join(",")).split(",")
const OUT = join(ROOT, "docs", "verification", "fold-census", LABEL)

/* THE GRID SWEEP — the answer to defect class 5 in this file.
 *
 * A fold-ray count at ONE grid is a coin flip. Measured on `square/extrude`
 * across grid 61/91/121/141/161/181/241/301: 3/5/8/10/15/15/35/46, a 15x
 * spread — and `KNOWN_OPEN["square/extrude"] = { foldRays: 5 }` was an EXACT
 * EQUALITY pin on the middle of that. Worse, the strict branch (`foldRays === 0`)
 * was satisfiable purely by undersampling: a real fold narrower than one bin
 * reads zero. Both branches now run the whole sweep — clean means clean at
 * every resolution, and a known-open row is pinned as a VECTOR so the reader
 * can see the number is resolution-dependent instead of being told a single
 * figure that looks absolute. */
const GRIDS = [61, 121, 181, 241]
const foldSweep = (pos, idx) =>
  GRIDS.map((grid) => foldCensusComponents(pos, idx, { grid }).foldRays)

const VIEW = { width: 1300, height: 850 }
const CW = VIEW.width / 2
const CH = VIEW.height - 48

let failures = 0
const rows = []
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? `   [${detail}]` : ""}`)
  rows.push({ name, ok: !!ok, detail })
  if (!ok) failures++
}

// The same fixtures assert-mode-rims uses, so the numbers describe the same
// objects the rim census and the gloss frames describe.
/* ==========================================================================
 * THE KNOWN-OPEN LEDGER
 *
 * This gate was built for the Inflate elbow and, on its first run, fired on six
 * of sixteen fixture/mode rows. Every flagged ray was opened up
 * (`_probe-fold-truth.mjs`, evidence in docs/verification/fold-census/truth2/)
 * and they are NOT one defect. Two mechanisms, neither of them the elbow, both
 * pre-existing and both measured here for the first time:
 *
 *  A · THE CLOSED-LOOP SEAM (rod, inflate) — **FIXED 2026-07-31**, see
 *      `assert-seam.mjs`. Left described here because the ledger is only
 *      readable if it says what was closed as well as what is open. A stroke
 *      that returns to its own start got an END CAP at the last sample and
 *      another at the first, one radius apart, sweeping about the same point —
 *      so the two caps interpenetrated. This is the SAME defect explainer 17 §2 fixed for
 *      Extrude ("a closed loop built with two overlapping caps"); Rod and
 *      Inflate never got the treatment. Located: `circle/inflate` fires at
 *      [1.20, 0.137] — the circle fixture's seam is at [1.216, 0.153], i.e. the
 *      flagged rays are the seam — with hits at four DISTINCT depths
 *      (0.0576 / 0.0213 / −0.0213 / −0.0576), two dome surfaces crossing.
 *      `square/rod` fires at [−0.269, 0.824]; the square's first corner is
 *      [−0.281, 0.827].
 *
 *  B · THE RIM ASSEMBLY OVERLAPPING ITSELF (solid, extrude). The extra hits are
 *      the cap plane (|n.z| = 1) plus a BEVEL RING (|n.z| = 0.96593 = cos 15°,
 *      one step of a 3-segment quarter round) at 0.9% of the depth below it —
 *      i.e. the cap and the first bevel ring cover the same plan region. On
 *      `square/extrude` three bevel rings are crossed at one corner
 *      (|n.z| 0.966 / 0.966 / 0.707), which is the mitred inner offset folding
 *      over itself. Depth scale 0.0007 world units on a 0.148-deep solid.
 *
 * NEITHER IS THIS PASS'S DEFECT and neither is fixed here — see the return and
 * docs/explainers/19. But "measured and ungated" is exactly how "every Extrude
 * mesh has 8–12 boundary edges" sat unread for a whole cycle (explainer 17 §2b),
 * so each one is pinned to its MEASURED count. A new fold anywhere fails. A row
 * getting worse fails. A row getting BETTER also fails, loudly, so the ledger
 * gets updated rather than quietly over-permitting for the next reader.
 * ======================================================================== */
const KNOWN_OPEN = {
  // The class-A row `circle/inflate` 13 is FIXED (2026-07-31) and has moved to
  // the strict `foldRays === 0` branch: Rod and Inflate now build a closed mark
  // as a loop, with no end caps and no end taper. `scripts/verify/assert-seam.mjs`
  // is the gate, and it holds the parked `capped` behaviour as its negative
  // control.
  //
  // ⚠ `square/rod` WAS DECLARED FIXED IN THE SAME PASS AND THAT WAS A
  // SINGLE-GRID CLAIM. It read 0 at grid 121 and was moved to the strict branch
  // on that one number; the moment this row became a SWEEP it went red at
  // 0/1/1/3. See the entry below — the seam fix is real and exact, and what the
  // sweep is seeing is not the seam.
  //
  // The three class-B SOLID rows that were here — `circle/solid` 53,
  // `square/solid` 4, `crossing/solid` 1 — are FIXED (2026-07-31) and have moved
  // to the same strict branch. They were NOT what they were filed as. The cap
  // was TRIANGULATED on the original contour and DRAWN at the contour inset by
  // the bevel, and the inward offset narrows the outline underneath a chord
  // earcut was entitled to emit, so the cap crossed itself: 198 overlapping
  // triangle pairs on `circle`, 0 with the same triangle list drawn at the
  // original positions. The cap is now triangulated on the loops it is drawn at.
  // `scripts/verify/assert-cap-fit.mjs` is the gate and it holds the parked
  // `SOLID_TUNING.capFit = "source"` behaviour as its negative control.
  //
  // The old entry blamed "the cap re-triangulation spans the hole", and the fix
  // it proposed — reuse H2's triangulation with an index map — is a MEASURED
  // no-op: on the fixtures that carry a hole, H3's index buffer was already
  // byte-identical to H2's (circle 0 of 1512 indices differing, square 0 of 255).
  // The "hole" half of the story was wrong too: `openArc/solid` (59 rays) and
  // `crossing/solid` (1) have NO hole at all.
  //
  // RE-MEASURED INDEPENDENTLY 2026-07-31 (`_probe-extrude-topface.mjs`), because
  // the paragraph below is a MECHANISM claim and a ray count does not prove one.
  // The question was asked without any ray casting: do the ribbon's TOP-face
  // triangles overlap EACH OTHER — the same separating-axis test assert-cap-fit
  // asks of Solid's cap?
  //
  //   square/extrude  chamfer off   288 overlapping pairs   per corner 29/85/85/89
  //   square/extrude  chamfer on    182                     per corner 18/53/53/58
  //   circle/extrude  either          0     tick/extrude either   0
  //
  // Three things follow, none of them inferred. The double cover is present with
  // the chamfer OFF and the chamfer REDUCES it, so the chamfer is not the cause.
  // It sits at ALL FOUR corners and NOWHERE else — 0 pairs off a corner — while
  // the two corner-free fixtures read 0, which is the control that says the probe
  // is neither blind nor over-eager. (`crossing/extrude` reads 162, all at the
  // crossing point: two SEPARATE strokes' shells, documented behaviour of a
  // per-stroke mode, not a fold.) And the seam corner is now the LEAST bad of the
  // four (29 against 85-89), which is explainer 17 §2's stub fix still holding.
  //
  // THE MECHANISM IN CLOSED FORM. A mitred join puts its shared vertex at
  // halfWidth/cos(turn/2) along the bisector, whose foot on either leg is
  // halfWidth*tan(turn/2) BACK from the corner. On the concave side that is where
  // the two inner offset lines cross — the correct union boundary, but only while
  // it stays inside both segments. Measured on the square, in half-widths:
  //
  //   corner 0 (seam)   turn 90.00 deg in ONE sample   back 1.000   step 0.4275
  //   corner 1          turn 51.00 deg                 back 0.478   step 0.4056
  //   corner 2          turn 49.82 deg                 back 0.464   step 0.3903
  //   corner 3          turn 45.05 deg                 back 0.415   step 0.3965
  //
  // Negative at all four: the inner column travels backwards and the strip folds.
  //
  // AND WHY NO CLAMP CLOSES IT. The engine's own miter limit cannot: at 45-51 deg
  // per sample the miter ratio is 1.08-1.11, an order of magnitude inside
  // RIBBON_MITER_COS_MIN, so the limit never engages — and that constant's own
  // comment (geometry-engines.ts:1737) already states the reason: "Clamping the
  // magnitude while keeping ONE shared offset vertex is not a join at all". The
  // spec-correct response to an over-long miter is to CONVERT the join, which
  // this builder does past the limit — but an inner overshoot needs the join
  // converted on ONE SIDE ONLY, i.e. two inner vertices where the strip has one.
  // That is a variable-arity strip: a re-topologising of
  // `buildContinuousRibbonStripGeometry`, which the chamfer rows, the closure,
  // the caps, the T-junction fix and the draft taper all index uniformly, and it
  // removes a sliver of material at the inner corner of EVERY join in every
  // letterform. That is the elbow's limit one parametrisation over, and it has
  // the same answer: the mark would have to be built as the boolean UNION of its
  // segment rectangles — which is what the Solid path already does — rather than
  // as a swept strip. A look decision for Sebs, not a repair.
  //
  // `square/extrude` remains open and is a DIFFERENT mechanism — see §7 of
  // docs/explainers/19. Every flagged ray sits within 0.03 world of a DRAWN
  // CORNER (measured: the square's corners are at (-0.2805, 0.8267) etc. and the
  // rays at (-0.2778, -0.5491), (1.1686, -0.5244), (-0.2515, -0.512) …), on the
  // concave side. It is the ribbon's INNER OFFSET self-intersecting at a corner:
  // with the chamfer off the census still reports 17 coplanar rays there (a plan
  // region covered twice), and the chamfer only lifts that double cover onto
  // distinct depths — fold rays go 5 / 5 / 4 / 1 / 0 as bevelSize goes
  // 0.015 / 0.010 / 0.006 / 0.003 / 0.001. That is the elbow's own `r·κ < 1`
  // condition one parametrisation over: a drawn corner has turn radius 0, so ANY
  // inner offset self-intersects there, and no chamfer size makes it embedded —
  // 0.001 only shrinks the fold below one facet. Closing it means unioning the
  // stroke outline (re-topologising), which a strip cannot express, exactly as
  // the loft could not express the elbow.
  /* PINNED AS A VECTOR over GRIDS, not as one number at one grid. The old entry
   * read `{ foldRays: 5 }`, an exact-equality pin taken at grid 121; the same
   * mesh reads 3/5/8/10/15/15/35/46 across 61…301, so "5" described the
   * detector's resolution as much as the mesh. `sweep` is filled in from a
   * measured run; a `null` here means the row has not been re-recorded yet and
   * the check below fails loudly rather than passing on a missing entry. */
  "square/extrude": {
    sweep: [3, 8, 15, 35],
    cause: "the ribbon's inner offset self-intersecting at a drawn corner",
  },
  /* ── square/rod, RE-OPENED 2026-08-03 WITH ITS MECHANISM MEASURED ────────
   *
   * This row was closed on 2026-07-31 as "FIXED by the loop build" on the
   * strength of ONE number at ONE grid (0 at 121). The sweep reads 0/1/1/3.
   *
   * THE SEAM FIX IS NOT WHAT THIS IS, and that is settled EXACTLY rather than
   * by ray count. `assert-seam.mjs` measures two grid-free statistics on this
   * same build: the two cap spheres are GONE (`caps 2 -> 0`) and the tube
   * centreline's closest self-approach goes `0.0000 r -> 4.3226 r`, against the
   * 2 r at which a tube of radius r touches itself. A closed loop that
   * approaches itself no nearer than 4.3 r has no seam self-intersection, and
   * no ray count can overturn an exact distance.
   *
   * WHERE THE RAYS ACTUALLY ARE (`_probe-square-rod-folds.mjs`, Node, same
   * buffers): all four square CORNERS, and nowhere else —
   *
   *     (-0.2805,  0.8267)   the seam corner      grid 241: 1 ray
   *     (-0.2708, -0.5290)   corner 1             grid 241: 1 ray, 6 sheets
   *     ( 1.1707, -0.5290)   corner 2             grid 241: 1 ray, 6 sheets
   *     ( 1.1652,  0.8160)   corner 3             grid 301: present
   *
   * — i.e. the seam corner is ONE OF FOUR and carries no more than the other
   * three. That is `square/extrude`'s mechanism above, one engine over: a drawn
   * corner has turn radius 0, so `r·κ ≥ 1` at every one of them and the swept
   * tube's inner wall crosses itself there. Explainer 19.
   *
   * AND THE FIX IMPROVES IT RATHER THAN CAUSING IT. Same probe, both arms,
   * grids 61/121/181/241/301:
   *
   *     capped  (the parked defect)   0 / 0 / 3 / 5 / 12
   *     wrapped (shipped)             0 / 1 / 1 / 3 /  8
   *
   * The wrapped arm is better at every grid except 121, where 1 against 0 is
   * the resolution floor `assert-seam.mjs` defect D2 names in as many words:
   * at grid 121 the square's bin is 0.01276 world against TUBE_RADIUS 0.01200,
   * one ray per tube radius. A statistic that ranks the fix below the defect at
   * one grid is not measuring the defect at that grid.
   *
   * So it is pinned, not silenced: a new fold anywhere fails, worse fails, and
   * BETTER fails too so the ledger is updated rather than quietly widened. */
  "square/rod": {
    sweep: [0, 1, 1, 3],
    cause: "the swept tube's inner wall crossing itself at all four DRAWN 90° corners (r·κ ≥ 1, explainer 19) — not the seam, which reads 4.3226 r clear",
  },
}

/* ==========================================================================
 * CALIBRATION — pure, no renderer. Runs first so a broken probe costs
 * milliseconds rather than a browser session.
 * ======================================================================== */
function calibrate() {
  console.log("\nCALIBRATION — a swept tube whose fold is decided in closed form\n")
  const near = (mid) => Math.hypot(mid[0], mid[1]) < 2
  const folded = syntheticFoldTube(1, 0.5, 24)
  const clean = syntheticFoldTube(1, 1.5, 24)
  const fFold = foldCensusComponents(folded.pos, folded.idx, { grid: 121 })
  const cFold = foldCensusComponents(clean.pos, clean.idx, { grid: 121 })
  const fCrease = creaseCensusNode(folded.pos, folded.idx, near)
  const cCrease = creaseCensusNode(clean.pos, clean.idx, near)

  console.log("            fold depth/r   fold rays   depths max   coplanar   crease wall max   crease mixed max")
  const line = (nm, m, f, c) =>
    console.log(
      `   ${nm.padEnd(9)}   ${m.foldDepthOverR.toFixed(4).padStart(9)}   ${String(f.foldRays).padStart(9)}   ${String(f.maxFoldSheets).padStart(10)}   ${String(f.coplanarRays).padStart(8)}   ${c.wall.max.toFixed(2).padStart(15)}   ${c.mixed.max.toFixed(2).padStart(16)}`,
    )
  line("FOLDED", folded, fFold, fCrease)
  line("clean", clean, cFold, cCrease)

  check(
    "CAL-1 the fold census FIRES on a tube that folds by closed form",
    fFold.foldRays > 0 && fFold.maxFoldSheets >= 4,
    `depth +${folded.foldDepthOverR.toFixed(4)}r -> ${fFold.foldRays} fold rays, up to ${fFold.maxFoldSheets} distinct depths`,
  )
  check(
    "CAL-2 the fold census is SILENT on its clean twin (same construction, wider spacing)",
    cFold.foldRays === 0 && cFold.maxHits <= 2,
    `depth ${clean.foldDepthOverR.toFixed(4)}r -> ${cFold.foldRays} fold rays, maxHits ${cFold.maxHits}`,
  )
  /* THE BLINDNESS, ASSERTED RATHER THAN DESCRIBED.
   *
   * If this row ever FAILS, the crease census has become able to separate a
   * folded shell from a clean one and this witness should be retired — read the
   * header before "fixing" it. As of this pass it reads: the folded mesh scores
   * HIGHER on `mixed` by a few degrees (which reads as "more of a corner", not
   * "broken") and LOWER on `wall`, i.e. the response is not merely absent, it is
   * inverted. */
  const wallSep = fCrease.wall.max - cCrease.wall.max
  const mixedSep = fCrease.mixed.max - cCrease.mixed.max
  check(
    "CAL-3 BLINDNESS WITNESS: the crease census cannot separate the two (no bucket separates them by 30 deg)",
    Math.abs(wallSep) < 30 && Math.abs(mixedSep) < 30,
    `folded−clean: wall ${wallSep >= 0 ? "+" : ""}${wallSep.toFixed(2)} deg, mixed ${mixedSep >= 0 ? "+" : ""}${mixedSep.toFixed(2)} deg — a fold moves the census by less than one bevel step`,
  )
  return { folded: { fold: fFold, crease: fCrease, depth: folded.foldDepthOverR }, clean: { fold: cFold, crease: cCrease, depth: clean.foldDepthOverR } }
}

/* ========================================================================== */
async function main() {
  const cal = calibrate()
  if (failures > 0) {
    console.log("\nCALIBRATION FAILED — refusing to measure. Nothing below would mean anything.")
    process.exit(1)
  }

  // Headless is correct here BECAUSE OF THE ANGLE FLAG. Without it Chrome falls
  // back to SwiftShader, which silently pauses the rAF loop. Measured in this
  // repo 2026-07-30: 121 rAF ticks headless vs 120 headed, identical renderer.
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: VIEW })
  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })
  const dims = await page.evaluate(() => ({ w: window.innerWidth / 2, h: window.innerHeight - 48 }))
  if (dims.w !== CW || dims.h !== CH) {
    console.log(`FAIL canvas mismatch page ${dims.w}x${dims.h} vs script ${CW}x${CH}`)
    await browser.close()
    process.exit(1)
  }

  const dump = async () => {
    for (let t = 0; t < 30; t++) {
      const d = await page.evaluate(() => window.__geomDebug.dumpMeshes())
      if (d && d.meshes > 0 && d.idx.length > 0) return d
      await page.waitForTimeout(300)
    }
    return null
  }
  const load = async (poly, mode) => {
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 10 }), poly)
    await page.waitForTimeout(800)
    await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
    await page.waitForTimeout(1600)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(500)
  }

  /* ---- the Node mirror is cross-checked against the SHIPPED census -------- */
  await load(SHAPES.square(), "solid")
  {
    const d = await dump()
    const pos = Float64Array.from(d.pos)
    const idx = Int32Array.from(d.idx)
    const mine = creaseCensusNode(pos, idx)
    const theirs = await page.evaluate(() => window.__geomDebug.probeDihedral())
    let tMixed = 0, tWall = 0, tTris = 0, tBnd = 0, tNm = 0
    for (const p of theirs) {
      tMixed = Math.max(tMixed, p.mixed?.max ?? 0)
      tWall = Math.max(tWall, p.wall?.max ?? 0)
      tTris += p.triangles ?? 0
      tBnd += p.boundaryEdges ?? 0
      tNm += p.nonManifoldEdges ?? 0
    }
    check(
      "CAL-4 the Node mirror of probeDihedral agrees with the shipped one on the real buffers",
      Math.abs(mine.mixed.max - tMixed) < 0.02 &&
        Math.abs(mine.wall.max - tWall) < 0.02 &&
        mine.triangles === tTris &&
        mine.boundaryEdges === tBnd &&
        mine.nonManifoldEdges === tNm,
      `mirror mixed ${mine.mixed.max} / wall ${mine.wall.max} / tris ${mine.triangles} / bnd ${mine.boundaryEdges} / nm ${mine.nonManifoldEdges}` +
        ` vs shipped ${tMixed.toFixed(2)} / ${tWall.toFixed(2)} / ${tTris} / ${tBnd} / ${tNm}`,
    )
  }

  /* ---- THE REAL KNOWN-BAD: square/inflate on the loft --------------------- */
  await load(SHAPES.square(), "inflate")
  await page.evaluate(() => window.__styleHarness.setInflate({ fusion: "loft" }))
  await page.waitForTimeout(2600)
  const loftDbg = await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null)
  const loftDump = await dump()
  const loftFold = foldCensusComponents(Float64Array.from(loftDump.pos), Int32Array.from(loftDump.idx), { grid: 141 })
  const loftCrease = creaseCensusNode(Float64Array.from(loftDump.pos), Int32Array.from(loftDump.idx))
  // Swept, like every other fold count in this file: a known-bad that only fires
  // at one resolution is a known-bad that will stop firing when the fixture is
  // re-sampled, which is exactly what happened to `assert-seam.mjs`.
  const loftSweep = foldSweep(Float64Array.from(loftDump.pos), Int32Array.from(loftDump.idx))
  check(
    "CAL-5 KNOWN-BAD square/inflate at fusion:loft FIRES at EVERY resolution (the shape this gate exists to catch)",
    loftDbg?.fusionUsed === "loft" && loftSweep.every((v) => v > 0) && loftFold.maxFoldSheets >= 4,
    `used ${loftDbg?.fusionUsed}, predicate pairs ${loftDbg?.loftFoldingPairs} depth ${loftDbg?.loftFoldOverR?.toFixed(4)}r -> ${loftSweep.join("/")} fold rays at grid ${GRIDS.join("/")}, up to ${loftFold.maxFoldSheets} distinct depths`,
  )
  check(
    "CAL-6 and on that SAME mesh every topology number the crease census reports says CLEAN",
    loftCrease.boundaryEdges === 0 && loftCrease.nonManifoldEdges === 0 && loftCrease.degenerateTriangles === 0,
    `boundary ${loftCrease.boundaryEdges}, non-manifold ${loftCrease.nonManifoldEdges}, degenerate ${loftCrease.degenerateTriangles}, mixed max ${loftCrease.mixed.max} — a folded shell that passes every existing structural gate`,
  )
  await page.evaluate(() => window.__styleHarness.setInflate({ fusion: "auto" }))
  await page.waitForTimeout(2600)

  /* ---- THE SWEEP ---------------------------------------------------------- */
  console.log("\nSWEEP — every fixture, every mode, per connected component\n")
  const census = {}
  /** Which fixture/mode rows actually got measured — see COVERAGE below. */
  const swept = new Set()
  for (const [shape, fn] of Object.entries(SHAPES)) {
    for (const mode of MODES) {
      await load(fn(), mode)
      const d = await dump()
      if (!d) {
        check(`${shape}/${mode} / mesh exists`, false, "dumpMeshes returned nothing")
        continue
      }
      const pos = Float64Array.from(d.pos)
      const idx = Int32Array.from(d.idx)
      const per = foldCensusComponents(pos, idx, { grid: 121 })
      const sweep = foldSweep(pos, idx)
      // Reported, NOT gated: the whole drawing at once. In the per-stroke modes
      // two crossing marks legitimately read 4 here, and that is the documented
      // interpenetration, not a fold.
      const whole = foldCensusComponents(pos, idx, { grid: 121, maxComponents: 1 })
      const inflateDbg =
        mode === "inflate" ? await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null) : null
      const key = `${shape}/${mode}`
      census[key] = {
        meshes: d.meshes,
        components: per.components,
        triangles: idx.length / 3,
        foldRays: per.foldRays,
        foldSweep: sweep,
        grids: GRIDS,
        maxFoldSheets: per.maxFoldSheets,
        coplanarRays: per.coplanarRays,
        sliverRays: per.sliverRays,
        perComponentMaxSheets: per.rows.map((r) => r.maxHits),
        wholeDrawingMaxSheets: whole.rows[0]?.maxHits ?? null,
        fusionUsed: inflateDbg?.fusionUsed ?? null,
        loftFoldingPairs: inflateDbg?.loftFoldingPairs ?? null,
        loftFoldOverR: inflateDbg?.loftFoldOverR ?? null,
        worstFold: per.rows.flatMap((r) => r.worst).slice(0, 4),
        worstCoplanar: per.rows.flatMap((r) => r.worstCoplanar).slice(0, 4),
      }
      console.log(
        `   ${key.padEnd(18)} comps ${String(per.components).padStart(2)}  FOLD rays ${sweep.join("/")} at grid ${GRIDS.join("/")} (max ${per.maxFoldSheets} depths)  ` +
          `coplanar ${String(per.coplanarRays).padStart(3)}  sliver ${per.sliverRays}` +
          (inflateDbg ? `  fusion ${inflateDbg.fusionUsed} (pairs ${inflateDbg.loftFoldingPairs})` : ""),
      )
      swept.add(key)
      const known = KNOWN_OPEN[key]
      if (known) {
        /* PARKED: the old single-grid pin, `per.foldRays === known.foldRays`
         * at grid 121. Kept as a printed diagnostic because the number appears
         * in explainer 19 and in this file's ledger; not gated, because the
         * same mesh gives a 15x range of answers across the grids below. */
        const pinnedOk =
          Array.isArray(known.sweep) &&
          known.sweep.length === sweep.length &&
          known.sweep.every((v, i) => v === sweep[i])
        check(
          `${key} / known-open fold count is EXACTLY as recorded at EVERY resolution (${known.cause})`,
          pinnedOk,
          !Array.isArray(known.sweep)
            ? `no recorded sweep for this row — record it as [${sweep.join(", ")}] at grid ${GRIDS.join("/")} rather than leaving it unpinned`
            : `${sweep.join("/")} vs ${known.sweep.join("/")} recorded, at grid ${GRIDS.join("/")}` +
              (pinnedOk
                ? ""
                : sweep.every((v, i) => v <= known.sweep[i])
                  ? " — BETTER than the ledger: update KNOWN_OPEN, do not widen it"
                  : " — WORSE than the ledger: a regression") +
              `  [parked single-grid figure, grid 121: ${per.foldRays}]`,
        )
      } else {
        check(
          `${key} / no shell passes through ITSELF, at EVERY resolution`,
          sweep.every((v) => v === 0),
          `${sweep.join("/")} rays crossing more than two DISTINCT depths at grid ${GRIDS.join("/")} (max ${per.maxFoldSheets}); ` +
            `coplanar-overlap rays ${per.coplanarRays}, sliver ${per.sliverRays}` +
            (sweep.some((v) => v > 0) && per.foldRays === 0
              ? " — NOTE: zero at grid 121 and nonzero elsewhere, i.e. the old single-grid form of this row was passing on undersampling"
              : ""),
        )
      }
    }
  }

  /* ---- COVERAGE, because a partial sweep printed ALL PASS -----------------
   * INSTRUMENT REPAIR 2026-08-03 (class 7). `--modes=rod` dropped twelve of the
   * sixteen rows and the run still ended `ALL FOLD-CENSUS ASSERTIONS PASS`.
   * Nothing asserted that the sweep had covered every fixture and every
   * GeometryMode, so the cheapest way to get a green fold census was to ask for
   * less of it. The expected grid is derived — fixtures from
   * `lib/engine-node.mjs`, modes from the engine's own `engines` record — so it
   * grows on its own. */
  const expected = []
  for (const shape of Object.keys(SHAPES)) for (const mode of ALL_MODES) expected.push(`${shape}/${mode}`)
  const uncovered = expected.filter((k) => !swept.has(k))
  check(
    `COVERAGE the sweep ran every fixture x every GeometryMode (${expected.length} rows)`,
    uncovered.length === 0,
    uncovered.length === 0
      ? `${swept.size}/${expected.length} rows: ${Object.keys(SHAPES).length} fixtures x ${ALL_MODES.length} modes`
      : `${uncovered.length} NOT MEASURED: ${uncovered.join(", ")}` +
        (MODES.join(",") !== ALL_MODES.join(",") ? ` — --modes=${MODES.join(",")} is a PARTIAL run and cannot be green` : ""),
  )

  mkdirSync(OUT, { recursive: true })
  writeFileSync(
    join(OUT, "fold-census.json"),
    JSON.stringify({ calibration: cal, knownBad: { debug: loftDbg, fold: loftFold, crease: loftCrease }, census, checks: rows }, null, 2),
  )
  /* ═══ PROVENANCE · WAS THIS VERDICT MEASURED ON THIS RUN, ON THIS TREE? ═════
   *
   * ⚠ MEASURED 2026-08-28: this gate's capture directory was 21.3 days behind before tonight (08-07).
   * `assert-gate-integrity.mjs` channel F called that out and was right.
   *
   * THIS GATE CAN RECAPTURE — it drives the browser and rewrites the directory
   * on every invocation — so the cure for the AGE is to run it, and running it
   * is what makes the row below pass. What the row guards is the part running
   * does not cure:
   *
   *   the capture is younger than this process   what was just graded was written
   *                                              by THIS run, not left behind by
   *                                              an older one. `lib/evidence-swap.mjs`
   *                                              keeps the previous set when a run
   *                                              dies partway, which is exactly the
   *                                              case where stale frames get graded.
   *   no source moved while it ran               six lanes share this checkout
   *                                              tonight. A lib/ write landing
   *                                              mid-capture straddles two builds
   *                                              and the reading belongs to neither.
   *                                              Measured on assert-geom-offthread
   *                                              at 12:23 — a sibling lane wrote
   *                                              lib/style-fusion.ts nine seconds in,
   *                                              and three arms went red with nothing
   *                                              able to say why.
   *
   * Together they imply channel F's own test: a capture younger than a process
   * that started after every source write post-dates every source write.
   *
   * The subject is all three roots, the same three channel F compares against;
   * `captureFreshness()` walks `lib/` alone and tonight `app/` moved with it.
   * `fold-census.json` IS this gate's own output, and it is the only artefact this
   * capture leaves on disk — there is no renderer file to compare against
   * instead. So an age check alone would certify the gate's own write, the
   * trap `assert-drawin-pentip.mjs` recorded. That is why the row asks WHEN
   * the write happened relative to this process rather than how old it is.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const capNow = newestCapture(OUT, /\.json$/)
    const subjNow = ["lib", "app", "components"]
      .map((d) => newestUnder(join(ROOT, d)))
      .filter((x) => x.file)
      .sort((x, y) => y.ms - x.ms)[0]
    const relP = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
    const stampP = (ms) => new Date(ms).toLocaleString()
    const started = performance.timeOrigin
    const landed = Boolean(capNow.file) && capNow.ms >= started
    const treeHeld = Boolean(subjNow?.file) && subjNow.ms <= started
    const detailP = !landed
      ? (capNow.file
          ? `THE CAPTURE DID NOT LAND — newest artefact ${relP(capNow.file)} ${stampP(capNow.ms)} predates this run, which started ${stampP(started)}. ` +
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-fold-census.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-fold-census.mjs --label=${LABEL}; do NOT relax this row.`
        : `capture ${relP(capNow.file)} ${stampP(capNow.ms)} · run started ${stampP(started)} · newest source ${relP(subjNow.file)} ${stampP(subjNow.ms)}`
    check(
      "PROVENANCE · this verdict was measured on this run, against a tree that did not move under it",
      landed && treeHeld,
      detailP,
    )
  }
  console.log(`\nwrote ${join(OUT, "fold-census.json")}`)
  console.log(`console errors: ${consoleErrors.length}`)
  if (consoleErrors.length) console.log(consoleErrors.slice(0, 4).join("\n"))
  await browser.close()
  console.log(failures === 0 ? "\nALL FOLD-CENSUS ASSERTIONS PASS" : `\n${failures} FOLD-CENSUS FAILURES`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
