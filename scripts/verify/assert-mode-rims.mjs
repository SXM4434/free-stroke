// PER-MODE RIM CENSUS — the same question asked of all four engines.
//
// WHY THIS EXISTS. Every geometry judgement this project has made was made per
// mode, on whatever material that mode DEFAULTS to (MODE_MATERIAL_DEFAULTS:
// rod->ink, extrude->glossyPlastic, solid->matteClay, inflate->softGel). Two of
// those four are poor detectors and one is actively blind:
//
//   matte   integrates over the hemisphere, so a normal discontinuity moves the
//           shaded value a few percent. Solid was judged entirely on this.
//   softGel has sheen 1.0 with a BROAD lobe. A broad lobe averages over a
//           discontinuity instead of tracing it — better than matte, still not
//           an instrument.
//   gloss   (roughness 0.06, clearcoat 1.0) mirrors a narrow solid angle, so the
//           shaded value tracks the reflection vector and the same discontinuity
//           swings the pixel from black to white in one step.
//
// Specular is a DERIVATIVE operator on the normal field, and every artefact in
// scope — facets, staircases, creases, quantisation ripple — is a defect in that
// derivative. So the rule is: a form is judged on gloss, in every mode.
//
// The frames come from verify-gloss-rim.mjs. This script is the number that
// goes with them, and it reads the geometry the renderer is actually lighting
// rather than pixels:
//
//   __geomDebug.probeDihedral() keys every edge by its ROUNDED POSITION PAIR and
//   reports the angle between the two faces sharing it, bucketed by where the
//   edge lives (wall / cap / mixed). That is order-, winding- and weld-
//   independent, so ONE metric is comparable across the ribbon strip, the mask
//   extrusion, the tube and the implicit surface. `probeNormals` is not: its
//   split-group metric is 0 by construction on a shared-vertex strip and its
//   rimTurn metric assumes contour emission order, which only Solid has.
//
// The buckets and what each mode owes:
//   cap   — both faces near-flat. Must be ~0 everywhere, in every mode.
//   wall  — both faces near-vertical. This is the rim/side surface. A smooth
//           curve creases a few degrees per edge; a facet ladder creases by the
//           facet angle. `over30` is the count that matters — one legitimate
//           drawn corner raises `max`, a faceted curve raises the COUNT.
//   mixed — a cap face meeting a wall face: the bevel band. A single ~90 here
//           is a die-cut edge (Solid's state before this pass). A chain of small
//           ones is a rolled rim that carries the light.
//
// Usage: node scripts/verify/assert-mode-rims.mjs [--label=before] [--modes=...]
// Output: docs/verification/gloss-rim/<label>/rim-census.json + PASS/FAIL lines
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const MODES = arg("modes", "rod,extrude,solid,inflate").split(",")
const MATERIAL = arg("material", "glossyPlastic")
/* THE CONTROL FOR THE SEAM CORNER. Corner 0 of `square` used to be excluded
 * from the rho_out gate as "the taper seam"; the closed-loop fix removed that
 * taper and it is now asserted with the other three. `--loopEnds=capped`
 * selects the parked prior behaviour, on which corner 0 falls back to 0.360 and
 * the row MUST fail — that is what proves the un-excluded row can still fail.
 * Unset means "leave the page's own default alone", so a normal run measures
 * exactly what ships. */
const LOOP_ENDS = arg("loopEnds", null)
/** `--seamJoint=none` parks the prior in which a closed loop's seam corner got
 *  no joint bead. The bead row below MUST fail on it. */
const SEAM_JOINT = arg("seamJoint", null)
/* ── AN OPT-IN ROUND-PEN ARM, SAME KNOB AND SAME DISCIPLINE AS assert-elbow ──
 *
 * Every red row this gate has ever produced on `inflate` has been attributed to
 * the broad nib (F59), and the attribution was made by flipping
 * `INFLATE_NIB_ASPECT_DEFAULT` in `lib/geometry-engines.ts` — a source edit, on
 * a constant that is his. `nibAspect` is a real `InflateParams` field that
 * `setInflate` reaches, so the same arm is available without touching a source
 * file. Unset, this file behaves byte-identically to the run it has always made.
 *
 * ⚠ THE DIAL IS NOT THE PROOF. `INFLATE_DEBUG.nibAspect` is `build.nib.aspect`,
 * `inflateResolveNib`'s echo of the REQUEST; the PRODUCED value is
 * `nibContrastBuilt`. Both are read back below. `_probe-elbow-nib.mjs` carries
 * the must-fail that shows the difference: on a one-direction drawing the dial
 * reads 2.4 while the geometry census reads 1.000, with nothing broken.
 *
 * A DIAGNOSTIC RUN IS NEVER A VERDICT — it exits 2 whatever the rows do, so an
 * all-green run at aspect 1.0 can never be quoted as this gate passing. */
const NIB_ASPECT = process.env.FS_NIB_ASPECT ? Number(process.env.FS_NIB_ASPECT) : null
if (process.env.FS_NIB_ASPECT && !(Number.isFinite(NIB_ASPECT) && NIB_ASPECT >= 1)) {
  console.log(`FAIL  FS_NIB_ASPECT=${process.env.FS_NIB_ASPECT} is not a nib aspect (finite, >= 1)`)
  process.exit(1)
}
const OUT = join(ROOT, "docs", "verification", "gloss-rim", LABEL)

let failures = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

// Same fixtures as verify-gloss-rim so the numbers and the frames describe the
// same objects. `crossing` leads because "the edges and overlaps get weird" is
// the complaint under test and a crossing is where two marks share a surface.
// Canvas -> world, the same mapping the engine uses (coordScale =
// 3 / max(w,h), origin at the canvas centre, y flipped). Needed so the corner
// support function below can be evaluated at the DRAWN corner rather than at a
// vertex the mesh happened to emit.
import { sliceZ, analyseCorner } from "./lib/elbow-geom.mjs"
/* THE PER-EDGE CENSUS, mirrored in Node from the SAME buffers the page's
 * `probeDihedral` reads. It is not a second instrument: it is the same
 * arithmetic (same 1e-5 position key, same NORMAL_EPS, same
 * `min(acos d, acos -d)`, same |n.z| bucketing), and it is asserted to agree
 * with the shipped one on every row before a single number is read from it —
 * `assert-fold-census`'s CAL-4 pattern. The only thing it adds is that it
 * returns every edge instead of six, which is what the PLACES rows below need. */
import { census as censusNode } from "./_probe-rim-rows.mjs"
/* THE FIXTURES, IMPORTED RATHER THAN COPIED.
 *
 * INSTRUMENT REPAIR 2026-08-03 — A DIVERGED FIXTURE SET (class 4). This file
 * carried its OWN four-entry `SHAPES` under the comment "Same fixtures as
 * verify-gloss-rim so the numbers and the frames describe the same objects".
 * They were not the same: `scripts/verify/lib/engine-node.mjs:145` — which
 * `assert-seam.mjs` and (since today) `assert-fold-census.mjs` both read — holds
 * FIVE, and the missing one is `openArc`, the OPEN control for every closed-loop
 * claim in this repo. Four rows of sixteen were simply never asked. The copy is
 * gone; the four definitions it held were byte-identical to the canonical ones,
 * so nothing about the existing rows moves, and the fifth fixture now arrives on
 * its own. A copied fixture list diverges; an imported one cannot. */
import { SHAPES } from "./lib/engine-node.mjs"
import { loadTs } from "./_ts-load.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"
/** The real constant, read from the engine rather than typed here — the sphere
 *  the viewport instantiates for a cap and for a bead is
 *  `SphereGeometry(TUBE_RADIUS, RADIAL_SEGMENTS, RADIAL_SEGMENTS)`, so every one
 *  of its (RADIAL_SEGMENTS+1)^2 vertices sits at exactly that radius from its
 *  own local origin. */
const { TUBE_RADIUS, RADIAL_SEGMENTS } = loadTs("lib/geometry-engines.ts")
const SPHERE_VERTS = (RADIAL_SEGMENTS + 1) ** 2

const VIEW = { width: 1300, height: 850 }
const CW = VIEW.width / 2
const CH = VIEW.height - 48
const SCALE = 3.0 / Math.max(CW, CH)

const PARKED_LOCAL_SHAPES_REMOVED_2026_08_03 = {
  crossing: () => {
    const a = [], b = []
    for (let i = 0; i <= 90; i++) {
      const t = i / 90
      a.push({ x: 140 + t * 620, y: 250 + t * 190 })
      b.push({ x: 140 + t * 620, y: 470 - t * 190 })
    }
    return [a, b]
  },
  circle: () => {
    const p = []
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2
      p.push({ x: 440 + Math.cos(t) * 210, y: 360 + Math.sin(t) * 210 })
    }
    return [p]
  },
  square: () => {
    const p = []
    const c = [[250, 180], [640, 180], [640, 545], [250, 545], [250, 180]]
    for (let k = 0; k < c.length - 1; k++) {
      const [x0, y0] = c[k], [x1, y1] = c[k + 1]
      for (let i = 0; i < 30; i++) p.push({ x: x0 + ((x1 - x0) * i) / 30, y: y0 + ((y1 - y0) * i) / 30 })
    }
    p.push({ x: 250, y: 180 })
    return [p]
  },
  tick: () => [Array.from({ length: 6 }, (_, i) => ({ x: 400 + i * 4, y: 380 + i * 3 }))],
}
/* The parked copy above is kept as evidence for the divergence note, and is
 * asserted against the canonical set so it cannot rot into a second source of
 * truth: every fixture it holds must still be present upstream. */
void PARKED_LOCAL_SHAPES_REMOVED_2026_08_03

/* BOTH BUCKETS MUST BE POPULATED ON EVERY ROW.
 *
 * The cap bucket was guarded by `a.cap.n === 0 ||` and the whole mixed block by
 * a bare `if (a.mixed.n > 0)`, so "this mode emits no cap plane" read as a PASS
 * and an empty mixed bucket silently dropped three rows. The question that
 * settles it is a measurement, and it was taken: on 2026-08-03 across all
 * 20 rows (5 fixtures x 4 modes) EVERY row reports a populated cap bucket and a
 * populated mixed bucket — the smallest is `tick/inflate` at cap n=36, mixed
 * n=372, and the largest `square/inflate` at 17564 / 32408. There is therefore
 * no legitimate empty case to carve out, and emptiness is simply a failure. */

/* THE LARGEST SPREAD across a square's four rho_out readings that is still "the
 * same corner four times", PER MODE.
 *
 * The absolute rho_out gate is Inflate-only for the reason written out at the
 * check itself. The SPREAD is a weaker claim that more modes can carry — but
 * only where the premise holds, and measurement says it does not hold
 * everywhere. Recorded 2026-08-03 at the shipped defaults:
 *
 *   square/inflate  spread 0.0271   1.0001 0.9756 0.9730 0.9781
 *   square/solid    spread 0.1057   1.0340 1.0456 1.0890 0.9833
 *   square/extrude  spread 0.5279   1.3696 0.8417 1.0221 1.0401
 *   square/rod      spread 0.5042   0.9494 0.5001 0.4452 0.6300
 *
 * Inflate and Solid are gated at 0.15, which is 5.5x and 1.4x their readings.
 * Rod and Extrude are PINNED AT A CEILING, not endorsed: their reading mixes
 * the join with how much of the corner the pipeline had already cut off the
 * centreline before building, and this lane cannot separate those two without a
 * harness that publishes the PROCESSED polyline. The ceilings still catch a
 * regression — the parked `loopEnds: "capped"` seam breaks every one of them by
 * 0.62 — and they are written here with the reading that motivates a closer
 * look: `square/extrude` corner 0 (the seam) reads 1.3696, which is 0.045 from
 * the 1.414 this instrument is calibrated to return for a MITER SPIKE. That is
 * reported to Sebs rather than gated away. */
const CORNER_SPREAD_MAX = { inflate: 0.15, solid: 0.15, rod: 0.55, extrude: 0.55 }

/* ── PLACES, NOT PERCENTAGES ──────────────────────────────────────────────
 *
 * TWO ROWS HERE WERE ASKING A QUESTION THEIR OWN DENOMINATOR MADE
 * UNANSWERABLE, and both had been red for days while being carried as "a look
 * call, not a repair".
 *
 *   `wall is not a facet ladder`  — `wall.over30 / wall.n < 0.05`
 *   `the rim is not a chain of cuts` — `mixed.over30 / mixed.n < 0.35`
 *
 * BOTH DENOMINATORS ARE A FUNCTION OF HOW CURVED THE SHAPE IS. A rim needs a
 * vertex where it turns and none where it runs straight, so a rectangle's wall
 * bucket holds 600 edges where a circle of the same size holds 4032 — and the
 * numerator is the corners, which are four either way. `square/solid` failed
 * the wall row at 39/600 = 6.5 % with every one of those 39 edges at one of the
 * band's eight corners, while `circle/solid` passed at 0/4032. That is not two
 * different rims; it is one metric divided by two different numbers.
 *
 * THE SECOND ROW WAS WORSE, AND ITS OWN COMMENT SAID SO: "the Extrude bevel's
 * own three steps land at ~30.0, so the threshold is on creases past 45" — and
 * then it counted `over30`. A 3-segment quarter round creases EXACTLY 30.00 at
 * every step by construction, so `over30` is a coin flip on float noise at the
 * designed value. Measured: `circle/solid` has `mixed max` exactly 30.00 and
 * ZERO edges past 45, and scores 1103/4032 = 27.4 % "over 30" — 78 % of the way
 * to a 35 % failure bar, on a rim that is provably perfect. There was never any
 * headroom; `square/solid` tipped over it by having a short contour.
 *
 * THE QUANTITY THAT ACTUALLY SEPARATES THE TWO CASES is not how many edges
 * crease but HOW MANY PLACES DO. A drawn corner is a place: all its creases are
 * one XY position stacked through the ring table. A facet ladder is not a
 * place: it is one crease per contour vertex, all the way round. So the rows
 * count connected groups of offending edges, linked when their midpoints are
 * within 1.5 median wall-edge lengths of each other — a distance the mesh
 * supplies, not a constant typed in here.
 *
 * Measured 2026-08-04 at the shipped defaults, and the two cases separate by
 * KIND rather than by a percentage: `circle/solid` 0 places, `tick/solid` 0,
 * `openArc/solid` 1, `square/solid` 7, against a facet ladder's several hundred.
 *
 * THE LEDGER IS TWO-SIDED. A row over its entry fails (something spread), a row
 * under it fails (a corner was rounded away, which is the regression a
 * one-sided "must be small" row invites and which this file's own header warns
 * about twice). Entries are `[wallPlaces, mixedPlaces]` and every one carries
 * its reason:
 *
 *   square/*    the four drawn 90 degree corners. Solid and Extrude carry each
 *               of them TWICE — the band has an outer corner and an inner one —
 *               so 7-8 rather than 4. Inflate carries a corner as a round join
 *               of the tube radius, so its inner side has no crease at all and
 *               it reads 4/3. Rod carries one as a BEAD, and its tube folds
 *               through itself at each ( r*kappa >= 1, explainer 19 §2 ), which
 *               is 11 places on the wall bucket and 4 on mixed — one per corner.
 *   crossing/solid  the notch where the two bars' MERGED silhouette reverses.
 *               Solid only: Extrude and Inflate emit one body per stroke, so
 *               there is no merged outline and they read 0.
 *   openArc/solid  ONE place, at the stroke's own end cap, and it is the
 *               residue of the rim repair this pass landed — down from the 22
 *               places the parked `probeBlind: "onecell"` guard produced.
 *   circle/inflate, tick/inflate  the loft's closed-loop seam and its tip ring.
 *               PRE-EXISTING and pinned rather than absorbed: they are 2 and 2
 *               places on a smooth fixture, which the old fraction row hid at
 *               0.2 % and 1.2 %.
 *   everything else  ZERO, and that is the strongest claim in this file: a
 *               smooth fixture may not carry a single place where the rim
 *               creases past its own bevel step.
 */
const CREASE_PLACES = {
  "crossing/rod": [0, 0],
  "crossing/extrude": [0, 0],
  "crossing/solid": [7, 7],
  "crossing/inflate": [0, 0],
  "circle/rod": [0, 0],
  "circle/extrude": [0, 0],
  "circle/solid": [0, 0],
  "circle/inflate": [2, 1],
  "square/rod": [11, 4],
  "square/extrude": [8, 8],
  "square/solid": [7, 5],
  "square/inflate": [4, 3],
  "tick/rod": [0, 0],
  "tick/extrude": [0, 0],
  "tick/solid": [0, 0],
  "tick/inflate": [2, 0],
  "openArc/rod": [0, 0],
  "openArc/extrude": [0, 0],
  "openArc/solid": [1, 1],
  "openArc/inflate": [0, 0],
}

/* ROD CARRIES A DRAWN CORNER AS A BEAD — so the bead count IS Rod's corner
 * claim, and it is the only one this file can make about a Rod corner without
 * the dump (see the `dumpIsLocal` block). Two-sided by construction: a beadless
 * corner and a bead on a smooth curve are both failures, in opposite directions.
 *
 *   square    FOUR. One per drawn 90 degree corner — and it read THREE until
 *             2026-08-04. `detectJoints3D` drops any candidate within 1.25 radii
 *             of the stroke's endpoints, on the stated grounds that a bead on
 *             top of an end CAP SPHERE is a lump. That reason expired when
 *             closed loops stopped getting end caps (explainer 19 §4b), so the
 *             seam corner lost its bead and nothing replaced it: corner 0 was
 *             the only one of the four carried by the chorded tube instead of
 *             the corner ball, with the nearest bead 113 tube radii away.
 *   circle    ZERO, and it is the control that says the fix did not simply start
 *             stamping beads on loops: `circle` is closed too, and smooth, and
 *             still reads 0.
 *   openArc, tick, crossing   ZERO. Open or smooth; nothing turns hard enough.
 *
 * `--seamJoint=none` selects the parked prior (`ROD_TUNING.seamJoint`) and
 * `square` falls back to 3, which is what proves the row can fail. */
const ROD_BEADS = { square: 4, circle: 0, openArc: 0, tick: 0, crossing: 0 }

/**
 * Connected groups of offending edges, linked by XY proximity, split into
 * PLACES and RUNS.
 *
 * The link distance is 1.5 median wall-edge lengths — read off the mesh, so it
 * scales with the tessellation instead of being a world constant that rots.
 *
 * COUNTING GROUPS IS NOT ENOUGH ON ITS OWN, and the calibration below caught
 * that before any row was believed: a rim with the bevel OFF creases at every
 * contour vertex, so the whole ring links into ONE group and the count comes
 * back 2. A die-cut rim scoring "2 places" is precisely the shape of a metric
 * that cannot fail. So a group is only a PLACE if it is LOCAL, and the two
 * cases separate by a factor of thirty rather than by a judgement — measured
 * over every fixture and mode at the shipped defaults, group diameter in link
 * distances:
 *
 *     legitimate corners / seams / tips      0.0 .. 2.0
 *     circle/extrude with the bevel OFF     69.0, 75.4
 *     square/extrude with the bevel OFF     59.4 .. 85.8
 *
 * `RUN_DIAM` sits at 8 — four times the widest thing that is a place, an eighth
 * of the narrowest thing that is a ladder.
 */
const RUN_DIAM = 8
function creasePlaces(rows, bucket, threshold, linkDist) {
  const bad = rows.filter((r) => r.bucket === bucket && r.deg > threshold)
  const parent = bad.map((_, i) => i)
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < bad.length; i++) {
    for (let j = i + 1; j < bad.length; j++) {
      if (Math.hypot(bad[i].mid[0] - bad[j].mid[0], bad[i].mid[1] - bad[j].mid[1]) < linkDist) {
        parent[find(i)] = find(j)
      }
    }
  }
  const byGroup = new Map()
  bad.forEach((r, i) => {
    const g = find(i)
    const list = byGroup.get(g)
    if (list) list.push(r)
    else byGroup.set(g, [r])
  })
  let places = 0
  let runs = 0
  let maxDiam = 0
  for (const g of byGroup.values()) {
    let d = 0
    for (let i = 0; i < g.length; i++) {
      for (let j = i + 1; j < g.length; j++) {
        d = Math.max(d, Math.hypot(g[i].mid[0] - g[j].mid[0], g[i].mid[1] - g[j].mid[1]))
      }
    }
    maxDiam = Math.max(maxDiam, d)
    if (d >= RUN_DIAM * linkDist) runs++
    else places++
  }
  return { edges: bad.length, places, runs, maxDiam: Number((maxDiam / (linkDist || 1)).toFixed(1)) }
}

async function main() {
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: VIEW })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })

  // The instrument must be present, or this script has no claim to make. It
  // must say so rather than skip quietly (which reads as a pass) — the same
  // failure mode as the guard this pass is hunting.
  // The corner support function evaluates at a DRAWN corner mapped through this
  // script's own copy of the engine's canvas->world transform. If the page's
  // canvas is not the size the script assumes, that corner lands somewhere
  // else and the reach reading is nonsense that still prints a number.
  const dims = await page.evaluate(() => ({ w: window.innerWidth / 2, h: window.innerHeight - 48 }))
  if (dims.w !== CW || dims.h !== CH) {
    console.log(`FAIL canvas mismatch page ${dims.w}x${dims.h} vs script ${CW}x${CH}`)
    await browser.close()
    process.exit(1)
  }

  const hasProbe = await page.evaluate(() => typeof window.__geomDebug?.probeDihedral === "function")
  if (!hasProbe) {
    console.log("FAIL  harness / __geomDebug.probeDihedral is missing — no rim measurement is possible.")
    await browser.close()
    process.exit(1)
  }

  /* ── CALIBRATION: THE CENSUS MUST BE SHOWN TO FAIL ────────────────────────
   * Every instrument this project has trusted and then caught was one that had
   * never been run against a known-bad input: `maxRimSplitDeg` was 0 by
   * construction on a shared-vertex strip, the joint census was zero on every
   * fixture once two vertex counts became equal, and `probeDihedral` itself
   * scored a normal-less triangle as EXACTLY 90 — the same number a die-cut rim
   * scores — until this pass counted degenerates separately. A metric that
   * cannot fire reads identically to a metric that is firing and finding
   * nothing.
   *
   * So before any measurement is believed, the rim assertion is pointed at a rim
   * that is a hard 90 degrees BY CONSTRUCTION: Extrude with `bevelEnabled:
   * false` is Desk Doodles' `sharp` profile, the die-cut edge, and
   * `ribbonProfileRows` collapses to two rows at +-halfDepth with no band. If
   * `mixed max` does NOT come back near 90 there, the census is not reading the
   * rim and nothing below it means anything.
   * ──────────────────────────────────────────────────────────────────────── */
  async function calibrate() {
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }), SHAPES.circle())
    await page.waitForTimeout(700)
    await page.evaluate(() => window.__styleHarness.setMode("extrude"))
    await page.waitForTimeout(1200)
    // typeof INSIDE the page: `page.evaluate(() => fn)` cannot serialise a
    // function and comes back undefined, which would report a present harness
    // as missing.
    if (!(await page.evaluate(() => typeof window.__styleHarness.setExtrude === "function"))) {
      console.log("FAIL  calibration / __styleHarness.setExtrude is missing — the census cannot be shown to fail.")
      return false
    }
    const read = async (bevelEnabled) => {
      await page.evaluate((b) => window.__styleHarness.setExtrude({ bevelEnabled: b }), bevelEnabled)
      await page.waitForTimeout(900)
      const got = await page.evaluate(() => window.__styleHarness.get().extrudeParams.bevelEnabled)
      if (got !== bevelEnabled) throw new Error(`setExtrude did not take (bevelEnabled=${got})`)
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.waitForTimeout(400)
      let probe = []
      for (let t = 0; t < 30; t++) {
        probe = await page.evaluate(() => window.__geomDebug.probeDihedral())
        if (Array.isArray(probe) && probe.length && probe.some((p) => p.triangles > 0)) break
        await page.waitForTimeout(300)
      }
      let max = 0
      for (const p of probe) if (p.mixed?.n) max = Math.max(max, p.mixed.max)
      return max
    }
    /* THE PLACES METRIC NEEDS ITS OWN KNOWN-BAD, because it is new and because
     * a metric that has only ever been met is not a gate. A die-cut rim is a
     * crease at EVERY contour vertex — the opposite of a place — so with the
     * bevel off `circle/extrude` must come back with a place count in the
     * hundreds, against the 0 it reads with the bevel on. Same buffers, same
     * mirror, same link distance rule as the rows below. */
    const readPlaces = async (bevelEnabled) => {
      await page.evaluate((b) => window.__styleHarness.setExtrude({ bevelEnabled: b }), bevelEnabled)
      await page.waitForTimeout(900)
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.waitForTimeout(400)
      const d = await page.evaluate(() => window.__geomDebug.dumpMeshes())
      const m = censusNode(Float64Array.from(d.pos), Int32Array.from(d.idx))
      const lens = m.rows
        .filter((r) => r.bucket === "wall")
        .map((r) => Math.hypot(r.a[0] - r.b[0], r.a[1] - r.b[1]))
        .filter((v) => v > 1e-9)
        .sort((x, y) => x - y)
      const link = 1.5 * (lens.length ? lens[Math.floor(lens.length / 2)] : 0.01)
      return creasePlaces(m.rows, "mixed", 45, link)
    }
    const sharp = await read(false)
    const placesCut = await readPlaces(false)
    const rolled = await read(true)
    const placesRolled = await readPlaces(true)
    check(
      "CALIBRATION / the PLACES metric separates a die-cut rim from a rolled one",
      placesCut.runs > 0 && placesRolled.runs === 0 && placesRolled.places === 0,
      `circle/extrude bevel OFF -> ${placesCut.edges} mixed edges past 45 in ${placesCut.places} place(s) + ${placesCut.runs} RUN(s), widest ${placesCut.maxDiam} link;` +
        ` bevel ON -> ${placesRolled.edges} in ${placesRolled.places} + ${placesRolled.runs}, widest ${placesRolled.maxDiam}.` +
        ` A die-cut rim creases at EVERY contour vertex, so it links into ONE group — which is why counting groups alone is not a gate and the rows assert RUNS = 0 as well.`,
    )
    // Restore the default so the census below measures the shipped rim.
    await page.evaluate(() => window.__styleHarness.setExtrude({ bevelEnabled: true }))
    await page.waitForTimeout(600)

    /* SECOND KNOWN-BAD, for the gate this pass added. `square/inflate` is now
     * asserted at `mixed max < 75` instead of `> 60`, because a tube's corner
     * is a round join and the census reads tessellation there, not shape. A
     * threshold that has only ever been met is not a gate — so point the same
     * census at `fusion: "loft"` on the square, which the embedding predicate
     * says self-intersects at all four corners (8 folding ring pairs, depth
     * 0.158r) and which the ray census independently confirms (720/6/6/8 rays
     * crossing 4-8 sheets). It must come back ABOVE the threshold it is
     * supposed to catch. */
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }), SHAPES.square())
    await page.waitForTimeout(700)
    await page.evaluate(() => window.__styleHarness.setMode("inflate"))
    await page.waitForTimeout(1400)
    const readInflate = async (fusion) => {
      await page.evaluate((f) => window.__styleHarness.setInflate({ fusion: f }), fusion)
      await page.waitForTimeout(2600)
      const used = await page.evaluate(() => window.__inflateProbe?.debug?.()?.fusionUsed ?? null)
      let probe = []
      for (let t = 0; t < 30; t++) {
        probe = await page.evaluate(() => window.__geomDebug.probeDihedral())
        if (Array.isArray(probe) && probe.length && probe.some((p) => p.triangles > 0)) break
        await page.waitForTimeout(300)
      }
      let max = 0
      for (const p of probe) if (p.mixed?.n) max = Math.max(max, p.mixed.max)
      return { max, used }
    }
    const folded = await readInflate("loft")
    await page.evaluate(() => window.__styleHarness.setInflate({ fusion: "auto" }))
    await page.waitForTimeout(2600)
    check(
      "CALIBRATION / census reports the FOLDED elbow as die-cut (the square/inflate gate can fail)",
      folded.used === "loft" && folded.max > 80,
      `fusion=loft -> used ${folded.used}, mixed max ${folded.max.toFixed(2)} (must be >80: this is the input the <75 gate exists to catch)`,
    )
    check(
      "CALIBRATION / census reports a die-cut rim as die-cut",
      sharp > 80,
      `bevel OFF -> mixed max ${sharp.toFixed(2)} (must be >80, i.e. the metric CAN fail)`,
    )
    check(
      "CALIBRATION / census separates a rolled rim from a cut one",
      rolled < 45 && sharp - rolled > 30,
      `bevel ON -> mixed max ${rolled.toFixed(2)} vs OFF ${sharp.toFixed(2)}`,
    )
    return sharp > 80 && rolled < 45
  }
  const calibrated = await calibrate()
  if (!calibrated) {
    console.log("\nCALIBRATION FAILED — refusing to report a rim census from an uncalibrated instrument.")
    await browser.close()
    process.exit(1)
  }

  const census = {}
  for (const [shape, fn] of Object.entries(SHAPES)) {
    for (const mode of MODES) {
      await page.evaluate(() => window.__styleHarness.clearStrokes())
      await page.waitForTimeout(200)
      await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }), fn())
      await page.waitForTimeout(700)
      await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
      await page.waitForTimeout(1500)
      if (SEAM_JOINT) {
        // Read back rather than assume — a control arm that silently did not
        // take comes back PASSING, which reads as "the row cannot fail".
        await page.evaluate((v) => { window.__rodTuning.seamJoint = v }, SEAM_JOINT)
        await page.evaluate((m) => window.__styleHarness.setMode(m === "rod" ? "extrude" : "rod"), mode)
        await page.waitForTimeout(600)
        await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
        await page.waitForTimeout(1500)
        const sj = await page.evaluate(() => window.__rodTuning.seamJoint)
        if (sj !== SEAM_JOINT) throw new Error(`__rodTuning.seamJoint did not take: ${sj}`)
      }
      if (NIB_ASPECT !== null && mode === "inflate") {
        await page.evaluate((v) => window.__styleHarness.setInflate({ nibAspect: v }), NIB_ASPECT)
        await page.waitForTimeout(2000)
        const d = await page.evaluate(() => window.__inflateProbe?.debug?.() ?? null)
        const built = Number(d?.nibContrastBuilt)
        if (d?.nibAspect !== NIB_ASPECT) {
          throw new Error(
            `setInflate({nibAspect}) did not take for ${shape}/${mode}: asked ${NIB_ASPECT}, resolver reports ${d?.nibAspect}`,
          )
        }
        if (NIB_ASPECT === 1 ? Math.abs(built - 1) > 0.02 : !(built > 1.02)) {
          throw new Error(
            `the driven nib did not reach the GEOMETRY for ${shape}/${mode}: dial ${d?.nibAspect}, ` +
              `nibContrastBuilt ${built} (the dial is an echo of the request; this is the produced value)`,
          )
        }
        console.log(`  [nib] ${shape}/${mode}: dial ${d.nibAspect} nibContrastBuilt ${built.toFixed(4)}`)
      }
      if (LOOP_ENDS) {
        // Read back rather than assume: a control arm that silently did not
        // take would come back PASSING and read as "the gate cannot fail".
        await page.evaluate((v) => window.__styleHarness.setInflate({ loopEnds: v }), LOOP_ENDS)
        await page.waitForTimeout(1500)
        const le = await page.evaluate(() => window.__styleHarness.get().inflateParams.loopEnds)
        if (le !== LOOP_ENDS) throw new Error(`setInflate({loopEnds}) did not take: ${le}`)
      }
      // Material AFTER mode — setMode stamps MODE_MATERIAL_DEFAULTS over it
      // otherwise. Read back: a run that silently measured the wrong register
      // is worse than no run, because it looks like evidence.
      await page.evaluate((mat) => window.__styleHarness.setMaterial(mat), MATERIAL)
      await page.waitForTimeout(400)
      const got = await page.evaluate(() => window.__styleHarness.get().styleState.materialPreset)
      if (got !== MATERIAL) throw new Error(`material did not take for ${shape}/${mode}: ${got}`)
      await page.evaluate(() => window.__revealHarness.setProgress(1))
      await page.waitForTimeout(500)

      // exportGroupRef is empty for a beat while a rebuild swaps meshes in.
      // Reading once returns [] and the assertion then blames the geometry for
      // a failure of the measurement. Poll for a populated group.
      let probe = []
      for (let tries = 0; tries < 30; tries++) {
        probe = await page.evaluate(() => window.__geomDebug.probeDihedral())
        if (Array.isArray(probe) && probe.length > 0 && probe.some((p) => p.triangles > 0)) break
        await page.waitForTimeout(300)
      }
      // Modes that emit ONE mesh per stroke (rod, extrude, inflate-loft) return
      // several entries. Aggregate rather than taking [0]: a per-stroke read
      // would silently describe one bar of the crossing.
      const agg = {
        triangles: 0,
        degenerateTriangles: 0,
        boundaryEdges: 0,
        nonManifoldEdges: 0,
        meshes: probe.length,
      }
      for (const b of ["wall", "cap", "mixed"]) {
        let n = 0, sum = 0, max = 0, over30 = 0, p95 = 0
        for (const p of probe) {
          const s = p[b]
          if (!s || !s.n) continue
          n += s.n
          sum += s.mean * s.n
          max = Math.max(max, s.max)
          over30 += s.over30
          // The WORST mesh's 95th percentile. Not a true pooled percentile, and
          // deliberately the pessimistic reading of one: a mesh whose top 5% is
          // creased fails even if the pool would have averaged it away.
          p95 = Math.max(p95, s.p95 ?? 0)
        }
        agg[b] = { n, mean: n ? Number((sum / n).toFixed(2)) : 0, max: Number(max.toFixed(2)), p95: Number(p95.toFixed(2)), over30 }
      }
      for (const p of probe) {
        agg.triangles += p.triangles
        agg.degenerateTriangles += p.degenerateTriangles ?? 0
        agg.boundaryEdges += p.boundaryEdges
        agg.nonManifoldEdges += p.nonManifoldEdges
      }
      // The worst mixed edge of the worst mesh, with its two face normals —
      // recorded so a max can be ATTRIBUTED rather than guessed at. Inflate's
      // rim was mis-diagnosed as "marching cubes meeting its dome caps" from a
      // bare max; the same max with its normals reads as a taper shoulder.
      let worstMixed = null
      for (const p of probe) {
        const w = p.worst?.mixed?.[0]
        if (w && (!worstMixed || w.deg > worstMixed.deg)) worstMixed = w
      }
      agg.worstMixed = worstMixed

      /* THE SAME CENSUS, RE-RUN IN NODE OVER THE RAW BUFFERS — and cross-checked
       * against the shipped one before it is believed. `probeDihedral` publishes
       * aggregates and its six worst edges; the PLACES rows need every edge, and
       * a second instrument that has not been shown to agree with the first is
       * how this repo got three of its worst numbers. `dumpMeshes` concatenates
       * with indices rebased, so an edge shared across two meshes at identical
       * positions welds — the agreement row below is what proves that never
       * happens on these fixtures rather than assuming it. */
      const dump = await page.evaluate(() => window.__geomDebug.dumpMeshes())
      const mirror = censusNode(Float64Array.from(dump.pos), Int32Array.from(dump.idx))
      const mstat = (b) => {
        const v = mirror.rows.filter((r) => r.bucket === b).map((r) => r.deg)
        return { n: v.length, max: v.length ? Math.max(...v) : 0 }
      }
      agg.mirror = {
        triangles: mirror.triangles,
        wall: mstat("wall"),
        cap: mstat("cap"),
        mixed: mstat("mixed"),
      }
      const wallLens = mirror.rows
        .filter((r) => r.bucket === "wall")
        .map((r) => Math.hypot(r.a[0] - r.b[0], r.a[1] - r.b[1]))
        .filter((v) => v > 1e-9)
        .sort((x, y) => x - y)
      const linkDist = 1.5 * (wallLens.length ? wallLens[Math.floor(wallLens.length / 2)] : 0.01)
      agg.linkDist = Number(linkDist.toFixed(5))
      /* THE SIGNATURE OF THE LOCAL-POSITION DEFECT, measured rather than
       * assumed: how many dumped vertices sit within a bead radius of the world
       * ORIGIN. A sphere of RADIAL_SEGMENTS=16 is (16+1)^2 = 289 vertices, so a
       * mark with four beads piles exactly 1156 there. */
      {
        let atOrigin = 0
        for (let i = 0; i < dump.pos.length; i += 3) {
          // EXACTLY on the sphere's own radius, not merely "near the origin":
          // `crossing`'s tube passes within 0.05 of the origin and contributed
          // 42 vertices to a proximity count, which made the row read 1198
          // against an expected 1156. A sphere's vertices are all at radius r to
          // float precision; a tube vertex lands there only by coincidence.
          const d = Math.hypot(dump.pos[i], dump.pos[i + 1], dump.pos[i + 2])
          if (Math.abs(d - TUBE_RADIUS) < 1e-9) atOrigin++
        }
        agg.dumpAtOrigin = atOrigin
      }
      agg.wallPlaces = creasePlaces(mirror.rows, "wall", 30, linkDist)
      agg.mixedPlaces = creasePlaces(mirror.rows, "mixed", 45, linkDist)

      /* HOW FAR THE FORM STILL REACHES PAST EACH DRAWN CORNER.
       *
       * The `mixed max > 60` gate below reads the DIHEDRAL CENSUS, which
       * reports "total turn / how many edges it was spread over". That is a
       * legitimate corner reading for a flat-walled mode, where the corner
       * genuinely is ONE edge between two planes and no tessellation can split
       * it. It is NOT a corner reading for a TUBE: the union of balls turns a
       * drawn corner into a ROUND JOIN of exactly the tube radius, spread over
       * as many facets as the surface strategy cares to emit — so the SAME
       * surviving corner reads 89.6 swept coarsely and 47.8 polygonised finely.
       *
       * So `square` also gets rho_out from scripts/verify/lib/elbow-geom.mjs —
       * the SHARED, CALIBRATED instrument, not a second one invented here. It
       * casts one ray inward along each corner's outward bisector and divides
       * by the tube radius measured on that corner's OWN two legs, which is the
       * normalisation that matters on a tapered mark: a first attempt at this
       * divided by the half-width taken at the middle of one leg and read
       * 0.87-0.91 on every mode, because the ink profile is a different width
       * there. It is calibrated to recover 1.000 for a round join, 1.414 for a
       * miter spike and 0.586 for a corner rounded away.
       *
       * ALL FOUR CORNERS ARE ASSERTED, as of 2026-07-31. Corner 0 used to be
       * excluded and named: it is the seam, where this one-stroke square's start
       * meets its own end, and while a closed mark still got two end caps the
       * ink profile was at its TIP radius there, reaching 0.360 r instead of
       * ~1 r. The closed-loop fix (`loopEnds: "wrapped"`, explainer 19 §4b)
       * removed the taper, and corner 0 now reads 0.992 — inside the same gate
       * as the other three. An exclusion kept past its reason is a widened gate,
       * so it is gone rather than reworded.
       *
       * The parked `loopEnds: "capped"` behaviour is the control and it still
       * FAILS this row at 0.360, which is what proves the row can fail. Run it
       * with `--loopEnds=capped`; if Sebs picks `capped` as the look, this
       * assertion is the thing that has to be re-scoped, deliberately and with
       * his call cited — not silently re-excluded.
       * Pictures: docs/verification/elbow/<label>/frames/*_c0_*.png. */
      if (shape === "square") {
        const buf = await page.evaluate(() => window.__geomDebug.dumpMeshes())
        const segs = sliceZ(Float64Array.from(buf.pos), Int32Array.from(buf.idx), 0)
        const CO = [[250, 180], [640, 180], [640, 545], [250, 545]].map(([px, py]) => ({
          x: (px - CW / 2) * SCALE,
          y: -(py - CH / 2) * SCALE,
        }))
        const cen = {
          x: CO.reduce((a, p) => a + p.x, 0) / 4,
          y: CO.reduce((a, p) => a + p.y, 0) / 4,
        }
        const nrm = (a, b) => {
          const dx = b.x - a.x
          const dy = b.y - a.y
          const L = Math.hypot(dx, dy) || 1
          return { x: dx / L, y: dy / L }
        }
        // A probe-window scale only; every RESULT is divided by the radius
        // measured locally at that corner.
        const rNom = Math.hypot(CO[0].x - CO[1].x, CO[0].y - CO[1].y) / 24
        agg.cornerOut = CO.map((c, i) => {
          const bx = cen.x - c.x
          const by = cen.y - c.y
          const L = Math.hypot(bx, by) || 1
          const m = analyseCorner(
            segs,
            c,
            { x: bx / L, y: by / L },
            [nrm(c, CO[(i + 3) % 4]), nrm(c, CO[(i + 1) % 4])],
            rNom,
          )
          return Number(m.outOverR.toFixed(4))
        })
      }

      /* ROD CARRIES A DRAWN CORNER AS A BEAD, so the bead count IS Rod's corner
       * claim. `stats()` reads the meshes' own part tags (`FS_PART_JOINT`) —
       * explainer 16 §1 records what it cost to infer the part from its vertex
       * count instead — and reports `untagged` so a pass that stops being tagged
       * shows up as a number rather than as a clean zero. */
      if (mode === "rod") {
        const st = await page.evaluate(() => window.__geomDebug.stats())
        agg.jointSpheres = st?.jointSpheres ?? null
        agg.capSpheres = st?.capSpheres ?? null
        agg.untagged = st?.untagged ?? null
      }
      census[`${shape}/${mode}`] = agg
      console.log(
        `[rim] ${shape}/${mode}  tris=${agg.triangles} degen=${agg.degenerateTriangles} meshes=${agg.meshes} ` +
          `wall(n=${agg.wall.n} mean=${agg.wall.mean} max=${agg.wall.max} >30=${agg.wall.over30}) ` +
          `cap(mean=${agg.cap.mean} max=${agg.cap.max}) ` +
          `mixed(n=${agg.mixed.n} mean=${agg.mixed.mean} max=${agg.mixed.max} >30=${agg.mixed.over30}) ` +
          `bnd=${agg.boundaryEdges} nonmanifold=${agg.nonManifoldEdges}`,
      )
    }
  }

  await browser.close()
  mkdirSync(OUT, { recursive: true })
  writeFileSync(join(OUT, "rim-census.json"), JSON.stringify(census, null, 2))

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
   *
   * Together they imply channel F's own test: a capture younger than a process
   * that started after every source write post-dates every source write.
   *
   * The subject is all three roots, the same three channel F compares against;
   * `captureFreshness()` walks `lib/` alone and tonight `app/` moved with it.
   * `rim-census.json` IS this gate's own output, and it is the only artefact this
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
            `The rows here graded evidence an earlier run left behind. Re-run node scripts/verify/assert-mode-rims.mjs --label=${LABEL}; do NOT relax this row.`
          : `NO ARTEFACT written by this run under ${relP(OUT)} — nothing was graded, so nothing below is a verdict.`)
      : !treeHeld
        ? `THE TREE MOVED UNDER THIS RUN — ${relP(subjNow.file)} was written ${stampP(subjNow.ms)}, after this run started ${stampP(started)}. ` +
          `The capture straddles two builds and belongs to neither. Re-run node scripts/verify/assert-mode-rims.mjs --label=${LABEL}; do NOT relax this row.`
        : `capture ${relP(capNow.file)} ${stampP(capNow.ms)} · run started ${stampP(started)} · newest source ${relP(subjNow.file)} ${stampP(subjNow.ms)}`
    check(
      "PROVENANCE · this verdict was measured on this run, against a tree that did not move under it",
      landed && treeHeld,
      detailP,
    )
  }


  // ---- ASSERTIONS -------------------------------------------------------
  // Each asserts a SIGNATURE, not "something changed".
  //
  /* WHICH CASES OWN A DRAWN CORNER — and it is a property of the SHAPE AND THE
   * MODE, not of the shape alone.
   *
   * This is what makes the rim assertions TWO-SIDED, the same discipline as
   * assert-joint-beading: on a smooth case a near-90 crease is the defect and
   * must fall; on a case with a real corner it IS the corner and must survive.
   * A one-sided "max must be small" gate is satisfied by a fix that rounds the
   * drawn corners off, which is a worse regression than the defect.
   *
   *   square/extrude, square/solid
   *       four deliberate 90 degree turns, carried as ONE edge between two flat
   *       walls. No tessellation can split that edge, so the dihedral census is
   *       a real corner reading here.
   *   NOT square/inflate — and this is the correction, not an omission.
   *       A tube has no flat wall to crease. The union of balls turns a drawn
   *       corner into a ROUND JOIN of exactly the tube radius, and the census
   *       reports "total turn / how many edges it was spread over", so the SAME
   *       surviving corner reads 89.6 swept coarsely and 47.8 polygonised
   *       finely. Gating on >60 there asserts a COARSE MESH, not a corner. The
   *       geometric claim is `cornerReach` above (a support function: 1.00 =
   *       round join, 1.414 = miter, <1 = rounded away), and the closed-form
   *       version with its own calibration lives in assert-elbow.mjs.
   *   crossing/solid
   *       the notch where the two bars' MERGED silhouette reverses direction —
   *       explainer 16's "crossing's notch". Solid only: Extrude and Inflate
   *       emit two separate bodies per stroke, so there is no merged outline and
   *       therefore no notch.
   *   never for `rod`
   *       a tube has no corner feature in its surface at all — Rod carries a
   *       drawn corner as a JOINT BEAD, and assert-joint-beading is the script
   *       that measures whether those survive. Claiming it here as well would
   *       be two gates asserting one fact, and the Rod tube genuinely should be
   *       smooth everywhere, corners included.
   */
  const HAS_DRAWN_CORNERS = new Set([
    "square/extrude",
    "square/solid",
    "crossing/solid",
  ])

  for (const [key, a] of Object.entries(census)) {
    const [shape, mode] = key.split("/")
    const corners = HAS_DRAWN_CORNERS.has(key)

    // 0. NO PHANTOM CREASES. A zero-area triangle has no orientation, so it
    //    cannot crease — but it scored exactly 90 in the census until this pass,
    //    which is the same value a die-cut rim scores. Assert the count is zero
    //    so the buckets below are known to be describing real faces.
    check(
      `${key} / no degenerate triangles`,
      a.degenerateTriangles === 0,
      `${a.degenerateTriangles} zero-area triangles of ${a.triangles}`,
    )

    /* 1. THE CAP BAND IS NOT BUCKLED.
     *
     * THIS ASSERTION'S THRESHOLD WAS DERIVED FOR A WORLD THAT NO LONGER EXISTS,
     * and it has been reporting FAIL on all four modes on every fixture ever
     * since. It read `cap.max < 5` under the comment "two near-flat faces
     * sharing an edge must be coplanar", which was true when the `cap` bucket
     * held nothing but the flat cap plane. `probeDihedral` buckets an edge as
     * `cap` when BOTH faces have |n.z| > 0.9 — i.e. within 25.8 degrees of the
     * cap plane, not ON it — so the moment Extrude and then Solid grew a rolled
     * rim, the shallowest ring of the bevel band started landing in this bucket
     * and bringing its ~15 degrees per step with it. Measured now: 15.0 on
     * circle/solid and circle/extrude, which is exactly one step of a
     * 3-segment quarter round and is the rim WORKING.
     *
     * Nobody re-derived the number because the pass that added the bevel
     * reported `verify-gates.mjs` (a different script) as its all-pass, and a
     * FAIL line that has always been there stops being read. Recorded here
     * rather than quietly retuned.
     *
     * So the honest question this bucket can answer is not "is it coplanar" but
     * "is it SHALLOW": a working bevel step is ~15, a drawn corner in the band
     * reaches the high 20s-30s, and a buckled cap triangulation or a lattice
     * staircase in the cap plane reads far higher than either. 45 sits in that
     * gap. The bound is not vacuous — the bucket admits faces up to 51.6 degrees
     * apart.
     */
    /* INSTRUMENT REPAIR 2026-08-03 — AN EMPTY BUCKET PASSED (class 7).
     *   WAS: `a.cap.n === 0 || a.cap.max < 45`. A row whose cap bucket is empty
     *   satisfied the left branch and printed PASS, so "the cap band is shallow"
     *   was indistinguishable from "there is no cap band" — and a mode that
     *   stopped emitting a cap plane at all would have made this row GREENER.
     *   The emptiness is now its own assertion, pinned per row, so it is a
     *   recorded fact rather than a free pass; the shallowness claim is only
     *   made where there is something to make it about. */
    check(
      `${key} / the cap bucket is POPULATED (an empty bucket must not read as a pass)`,
      a.cap.n > 0,
      `cap edges n=${a.cap.n}` + (a.cap.n > 0 ? "" : " — the shallowness claim below has nothing to be about"),
    )
    check(
      `${key} / cap band is shallow, not buckled`,
      a.cap.n > 0 && a.cap.max < 45,
      `cap max ${a.cap.max}, mean ${a.cap.mean}, ${a.cap.over30}/${a.cap.n} over 30`,
    )

    /* 2. THE RIM IS NOT A LATTICE COMB — asked as PLACES, not as a percentage.
     *    See the CREASE_PLACES ledger for why the fraction this replaced could
     *    not answer the question on a shape whose contour is mostly straight.
     *    The mirror must agree with the shipped census first. */
    /* `dumpMeshes` HANDS OUT **LOCAL** POSITIONS, and Rod is the only mode that
     * puts a mesh anywhere other than the origin — the viewport instantiates
     * each cap and joint sphere as its own `<mesh position={...}>` rather than
     * baking the translation into the geometry, and the dumper reads the
     * geometry. MEASURED on `square/rod`: 1156 of 4029 dumped vertices sit
     * within 0.05 of the world ORIGIN, which is exactly 4 beads x 289 verts —
     * four coincident spheres piled in the middle of the square, none of them at
     * the corner it belongs to. That is why the mirror's wall bucket comes back
     * 1682 where the shipped per-mesh census reads 2978: the four piles weld.
     *
     * So the agreement row is asserted where it CAN be (the three modes that
     * emit untransformed meshes) and, on Rod, the known signature is asserted
     * INSTEAD — because a skip reads as a pass, and because the day
     * `dumpMeshes` starts applying the transform this row must fire and be read
     * rather than the PLACES rows quietly starting to work. `dumpMeshes` lives
     * in `components/viewport-3d.tsx`, which this lane does not own.
     *
     * IT IS NOT ONLY THIS FILE'S PROBLEM. `assert-fold-census` casts its rays
     * through the same dump and pins `square/rod` at 0/1/1/3 — measured against
     * a mark PLUS a pile of coincident spheres at the origin. Reported, not
     * fixed here. */
    const spheres = (a.jointSpheres ?? 0) + (a.capSpheres ?? 0)
    const dumpIsLocal = mode === "rod" && spheres > 0
    /* The defect's own signature, asserted so it cannot change unread: every
     * sphere the viewport instantiates contributes (RADIAL_SEGMENTS+1)^2
     * vertices to the pile at the origin, and a mode that emits none piles
     * nothing. When `dumpMeshes` is fixed to apply the transform, THIS row fires
     * first and the PLACES rows below turn on by themselves. */
    if (mode === "rod") {
      check(
        `${key} / dumpMeshes' LOCAL positions pile every sphere at the origin — the known count, so a fix cannot land unread`,
        a.dumpAtOrigin === spheres * SPHERE_VERTS,
        `${a.dumpAtOrigin} dumped vertices at exactly TUBE_RADIUS from the origin, expected ${spheres} sphere(s) x ${SPHERE_VERTS} = ${spheres * SPHERE_VERTS}` +
          ` (jointSpheres ${a.jointSpheres}, capSpheres ${a.capSpheres})`,
      )
    }
    check(
      `${key} / the Node mirror of probeDihedral agrees with the shipped census`,
      dumpIsLocal
        ? a.mirror.triangles === a.triangles && a.mirror.wall.n < a.wall.n
        : a.mirror.triangles === a.triangles &&
          a.mirror.wall.n === a.wall.n &&
          a.mirror.mixed.n === a.mixed.n &&
          Math.abs(a.mirror.wall.max - a.wall.max) < 0.02 &&
          Math.abs(a.mirror.mixed.max - a.mixed.max) < 0.02,
      (dumpIsLocal ? "ROD, spheres present: dumpMeshes returns LOCAL positions, so every bead piles at the origin and welds — " : "") +
        `mirror tris ${a.mirror.triangles} wall ${a.mirror.wall.n}/${a.mirror.wall.max.toFixed(2)} mixed ${a.mirror.mixed.n}/${a.mirror.mixed.max.toFixed(2)}` +
        ` vs shipped ${a.triangles} / ${a.wall.n}/${a.wall.max} / ${a.mixed.n}/${a.mixed.max}` +
        (dumpIsLocal ? " (the PLACES rows below are therefore not asked of this row; see the block comment)" : ""),
    )
    const ledger = dumpIsLocal ? undefined : CREASE_PLACES[key]
    if (mode !== "rod") {
      check(
        `${key} / wall creases are PLACES, not a ladder — ${ledger ? ledger[0] : "?"} expected`,
        ledger !== undefined && a.wallPlaces.places === ledger[0] && a.wallPlaces.runs === 0,
        ledger === undefined
          ? `no CREASE_PLACES entry for ${key} — record it with its reason`
          : `${a.wallPlaces.edges} wall edges past 30 in ${a.wallPlaces.places} place(s) + ${a.wallPlaces.runs} run(s), widest group ${a.wallPlaces.maxDiam} link; ledger ${ledger[0]}` +
            ` (link ${a.linkDist}; OVER = something spread along the rim, UNDER = a drawn corner was rounded away, RUN = a ladder)`,
      )
    } else {
      /* WHAT ROD CAN CARRY WITHOUT THE DUMP, and it is a stronger bar than the
       * one it replaces.
       *
       * The row that used to sit here on Rod was `cap-to-wall edge is rolled,
       * not die-cut — mixed max < 75`, and it had been red on `square/rod` at
       * 83.96 for days. It is the wrong question twice over. A TUBE HAS NEITHER
       * A CAP NOR A WALL: the census buckets by |n.z|, and a tube's normals
       * sweep the whole circle, so `mixed` on Rod is just a diagonal band of the
       * ring and `max` there is whatever the centreline did.
       *
       * And what the centreline did at a drawn 90 degree corner is FOLD. `r*kappa
       * >= 1` there (explainer 19 §2, the other half of the embedding condition),
       * so consecutive rings interpenetrate and the flap turns back INSIDE the
       * solid. Rod's solid is exactly the union of balls of radius TUBE_RADIUS
       * along the centreline, so a point is on its visible surface iff its
       * distance to the centreline is r — a closed-form test, no raster, no
       * threshold. Measured that way on `square/rod`
       * (`scripts/verify/_probe-rim-rows.mjs`): of the 84 creases past 30
       * degrees, **81 lie strictly inside the solid** and the worst crease
       * anywhere ON THE SURFACE is 38.52 degrees. The 83.96 the row was failing
       * on is interior geometry. No camera reaches it, and `min(acos d,
       * acos -d)` cannot tell the census which side of the surface it is on.
       *
       * So the claim becomes the one a tube can actually make: over 95 % of it,
       * the only crease is its own tessellation. 360/RADIAL_SEGMENTS = 22.5, and
       * this reads the WORST mesh's p95, not a pooled one. */
      const facet = 360 / 16 // RADIAL_SEGMENTS
      check(
        `${key} / the tube is smooth to its own facet over 95% of itself (p95, not max)`,
        a.mixed.p95 <= facet + 2 && a.wall.p95 <= facet + 2,
        `wall p95 ${a.wall.p95}, mixed p95 ${a.mixed.p95} (bar ${facet + 2} = 360/RADIAL_SEGMENTS + 2)` +
          ` — max is wall ${a.wall.max} / mixed ${a.mixed.max}, and 81 of the 84 creases past 30 on square/rod are INSIDE the union of balls`,
      )
      const beads = ROD_BEADS[shape]
      check(
        `${key} / every drawn corner carries a joint bead — ${beads === undefined ? "?" : beads} expected`,
        beads !== undefined && a.jointSpheres === beads && a.untagged === SHAPES[shape]().length,
        beads === undefined
          ? `no ROD_BEADS entry for ${shape} — record it with its reason`
          : `${a.jointSpheres} joint sphere(s), ${a.capSpheres} cap sphere(s), untagged ${a.untagged}` +
            ` (ledger ${beads}, untagged must be ${SHAPES[shape]().length} = one tube per stroke; seamJoint=${SEAM_JOINT ?? "page default"}.` +
            ` UNDER = a corner is carried by the chorded tube;` +
            ` OVER = beads on a curve that does not pinch)`,
      )
    }

    // 3. THE CAP/WALL TERMINATOR IS A ROLL, NOT A CUT — and BOTH SIGNS OF IT.
    //    This is the bevel assertion Solid failed outright (mixed mean 90.0,
    //    max 90.0, every edge over 30) and the one Inflate failed at its ink
    //    taper (mixed max 85-90 on all four fixtures).
    //
    //    On a SMOOTH fixture a rolled rim spreads the turn over several edges,
    //    so no single mixed crease approaches 90 — assert the max.
    //    On `square` a near-90 crease at the four drawn corners is the CORRECT
    //    answer, so asserting a small max there would be asserting the corners
    //    away. Assert instead that they SURVIVED (max stays high) while the
    //    faceting count stays low. Explainer 13's rule, applied in both
    //    directions: one legitimate corner raises the max, a faceted curve
    //    raises the count.
    /* INSTRUMENT REPAIR 2026-08-03 — THE SAME HOLE, THREE ROWS WIDE (class 7).
     *   WAS: the whole block below sat inside `if (a.mixed.n > 0)` with no else,
     *   so a row with an empty mixed bucket silently dropped the corner-survival
     *   row, the rolled-rim row AND the facet-count row while the run still
     *   ended ALL PASS. Pinned the same way the cap bucket is. */
    check(
      `${key} / the mixed bucket is POPULATED (an empty bucket silently skipped the three rows below)`,
      a.mixed.n > 0,
      `mixed edges n=${a.mixed.n}`,
    )
    if (a.mixed.n > 0) {
      const mixedFacetFrac = a.mixed.over30 / a.mixed.n
      const w = a.worstMixed
      const where = w ? ` worst at [${w.mid}] n0=[${w.n0}] n1=[${w.n1}]` : ""
      if (corners) {
        check(
          `${key} / drawn corners SURVIVE the rim fix`,
          a.mixed.max > 60,
          `mixed max ${a.mixed.max} (must stay >60: four drawn 90 degree corners)${where}`,
        )
      } else if (mode === "rod") {
        /* NOT ASKED OF ROD — see the p95 block above for the measurement that
         * decided it. `mixed` on a tube is a diagonal band of the ring, not a
         * rim, and its max on `square/rod` is a fold turned back INSIDE the
         * solid (81 of 84 creases past 30 are strictly interior). The number is
         * still printed, because a row this file stops asking must not become a
         * number nobody can see — that is the exact failure mode explainer 17
         * §2b records ("every Extrude mesh has 8-12 boundary edges", measured
         * and ungated for a whole cycle). */
        console.log(
          `  ---   ${key} / mixed max reported, not gated — ${a.mixed.max} (a tube has no cap and no wall;` +
            ` the smoothness claim is the p95 row above and the corner claim is the bead row below)${where}`,
        )
      } else {
        check(
          `${key} / cap-to-wall edge is rolled, not die-cut`,
          a.mixed.max < 75,
          `mixed max ${a.mixed.max}, mean ${a.mixed.mean}, ${a.mixed.over30}/${a.mixed.n} over 30${where}`,
        )
      }
      /* The count side of the same question — and the threshold this row's own
       * comment always named. It read `over30`, which is the bevel's own
       * designed step (a 3-segment quarter round creases EXACTLY 30.00 at every
       * ring), so it counted float noise at the design value: `circle/solid`
       * reads `mixed max` 30.00 with ZERO edges past 45 and still scored 27.4 %
       * "over 30". Past 45, and as PLACES rather than as a fraction, for the
       * reason in the CREASE_PLACES ledger. */
      if (mode !== "rod") check(
        `${key} / the rim is not a chain of cuts — ${ledger ? ledger[1] : "?"} place(s) expected`,
        ledger !== undefined && a.mixedPlaces.places === ledger[1],
        ledger === undefined
          ? `no CREASE_PLACES entry for ${key} — record it with its reason`
          : `${a.mixedPlaces.edges} mixed edges crease past 45 in ${a.mixedPlaces.places} place(s) + ${a.mixedPlaces.runs} run(s), widest group ${a.mixedPlaces.maxDiam} link; ledger ${ledger[1]}` +
            ` — for reference the old row read ${a.mixed.over30}/${a.mixed.n} past 30 (${(mixedFacetFrac * 100).toFixed(1)}%), which is the bevel's own step`,
      )
    }

    // 3b. THE CORNER SURVIVED, AS GEOMETRY — asserted on `square` in EVERY
    //     mode, including the ones whose corner is a smooth round join and is
    //     therefore invisible to a crease census. Below 0.95 the drawn corner
    //     has been rounded away; above 1.5 it is a miter spike rather than the
    //     round join the union of balls gives. Both are failures, in opposite
    //     directions, which is the point.
    /* rho_out is GATED ON INFLATE ONLY, and the reason is not a convenience.
     *
     * It is measured from the NOMINAL drawn corner, so it carries two things at
     * once: how far the surface reaches past the corner (the join, which is
     * what is being asserted) and how far the pipeline already cut the corner
     * off the CENTRELINE before building (which is not). Those separate only
     * when the centreline is held fixed — which is exactly the loft-vs-field
     * comparison on Inflate, where both strategies consume the identical
     * resampled polyline.
     *
     * Measured across modes on the same drawing: rod 0.48, extrude 0.80-0.85,
     * solid 0.82-0.92, inflate 1.02-1.03. Rod's 0.48 is Rod smoothing a right
     * angle into an arc, which is what a Rod corner IS (it carries corners as
     * BEADS — assert-joint-beading owns that claim, per explainer 17). Extrude
     * and Solid keep their own corner gate, `mixed max > 60`, which is a valid
     * corner reading for a mode whose corner is one edge between two flat
     * walls. Gating rho_out on those would need the PROCESSED centreline, which
     * no harness exposes — so the number is reported, and what it would take to
     * gate it is written down rather than replaced by a per-mode threshold. */
    if (a.cornerOut) {
      const drawn = a.cornerOut // all four, including the seam corner — see above
      const lo = Math.min(...drawn)
      const hi = Math.max(...drawn)
      const detail =
        `rho_out/r ${a.cornerOut.join(" ")} (1.00 = round join, 1.414 = miter, <1 = rounded away;` +
        ` corner 0 is the seam and is INCLUDED — loopEnds=${LOOP_ENDS ?? "page default"})`
      if (mode === "inflate") {
        check(`${key} / drawn corners still REACH (rho_out, not a crease angle)`, lo >= 0.95 && hi <= 1.5, detail)
      } else {
        console.log(`  ---   ${key} / absolute rho_out reported, not gated — ${detail}`)
      }
      /* INSTRUMENT REPAIR 2026-08-03 — ONE ROW OF SIXTEEN CARRIED THE CORNER
       * CLAIM. The absolute rho_out gate is Inflate-only for the reason written
       * out above (it mixes the join with the pipeline's own corner cut, and
       * only Inflate holds the centreline fixed across its two strategies), and
       * that reasoning is sound. But it left rod, extrude and solid printing
       * "reported, not gated" — twelve rows of measurement with nothing reading
       * them, on a square whose corners are the whole subject.
       *
       * There IS a claim those rows can carry, and it needs no processed
       * centreline: the four corners of a square are the SAME corner four times,
       * so whatever the pipeline cuts it must cut equally. The SPREAD is
       * therefore gateable in every mode while the absolute value is not. And it
       * is not a vacuous claim — it is exactly the number the parked
       * `loopEnds: "capped"` behaviour breaks, on every mode: the seam corner
       * read 0.360 against ~0.98 at the other three, a spread of 0.62. Run
       * `--loopEnds=capped` and this row fires on rod, extrude and solid too,
       * which the Inflate-only gate could never have shown. */
      /* ── A SQUARE'S FOUR CORNERS ARE TWO CORNERS TWICE, NOT ONE CORNER FOUR
       *    TIMES. N21, 2026-08-28. The paragraph above is a ROUND-PEN premise
       *    and the pen stopped being round tonight.
       *
       * `INFLATE_NIB_ASPECT_DEFAULT` went 1.0 -> 1.8. A broad nib is an ELLIPSE
       * dragged along the path, so the outer envelope at a corner is the corner
       * ELLIPSE and its reach depends on WHICH WAY that corner points. An
       * ellipse is pi-periodic: the two corners on one diagonal point along the
       * same axis of it and must still agree to the polygoniser's floor, while
       * the two diagonals sit 90 degrees apart on it and have no business being
       * compared with each other at all.
       *
       * MEASURED — this row's own `cornerOut`, bisected on the constant, two
       * runs per arm, diagonal {0,2} then diagonal {1,3}:
       *   aspect 1.0   1.0001 0.9730   0.9756 0.9781   full spread 0.0271
       *   aspect 1.8   1.0360 1.0290   0.6085 0.6112   full spread 0.4275
       *   aspect 2.0   1.0294 1.0322   0.5507 0.5544   full spread 0.4815
       *   aspect 2.4   0.9985 1.0136   0.4649 0.4663   full spread 0.5487
       * The worst DIAGONAL gap across all four arms is 0.0271, and it lands at
       * aspect 1.0 where there is no nib — it is the marching-cubes floor. The
       * full spread tracks the nib and nothing else. Closed form, from
       * `inflateResolveNib`'s own semi-axes and a 30 degree pen on an
       * axis-aligned square: rho_out/r alternates between e(bis)/max(h) at 75
       * and at 165 degrees off the nib's major axis, which predicts 1.025/0.626
       * at 1.8 and 0.978/0.481 at 2.4 — every measured corner above sits inside
       * 0.036 of it, under the +/-0.1 r the 0.2 r cell already quantises to.
       *
       * THE CAP DOES NOT MOVE AND NO CORNER IS EXCLUDED. At aspect 1 the two
       * diagonals coincide and the diagonal spread IS the full spread, so rod,
       * extrude and solid — none of which carries a nib — grade byte-for-byte as
       * before. This is `assert-seam.mjs`'s own reason applied one gate over:
       * hold the pen constant across a comparison, or "a real seam bulge becomes
       * indistinguishable from the pen".
       *
       * AND IT STILL FIRES, MEASURED RATHER THAN ARGUED. `--loopEnds=capped` at
       * aspect 1.8, 2026-08-28: corner 0 falls 1.036 -> 0.4215 and corners 1, 2,
       * 3 do not move. The known-bad this row was built for lands on a DIAGONAL,
       * so the pair form catches it at 0.6075 against the 0.15 cap — the
       * identical number the full spread reported.
       *
       * WHAT IT CAN NO LONGER SEE, said plainly: a defect that moves BOTH ends
       * of one diagonal together and leaves the other diagonal alone. Nothing is
       * pinned to hide that. The absolute `still REACH` row above still grades
       * all four corners on the SHIPPED nib and is still RED at 1.8, and
       * `assert-nib-contrast.mjs` reads the width law on the shipped word,
       * 30/30 the same night. */
      /* THE DIAGONAL FORM APPLIES WHERE THE PEN IS BROAD, AND ONLY INFLATE
       * CARRIES A NIB. The same scope as the absolute row eight lines up, for a
       * sharper reason: on rod, extrude and solid the four corners really are
       * one corner four times and the FULL spread is the right claim, so those
       * three are graded exactly as they were and their numbers do not move.
       *
       * ⚠ THE DERIVED VERSION WAS TRIED FIRST AND IT IS UNSAFE — measured, not
       * assumed, 2026-08-28. `window.__inflateProbe.debug().nibAspect` is ONE
       * GLOBAL that survives a mode change: driving rod, extrude, solid,
       * inflate, rod, extrude, solid through `setMode` reads 0, 0, 0, 1.8, 1.8,
       * 1.8, 1.8. The last three are the INFLATE build still standing there. A
       * read like that would have applied the nib's invariant to three modes
       * that never swept a nib and shown nothing while doing it. Deriving beats
       * naming only when the derivation is fresh; this one is stale by
       * construction, and the fix belongs in the harness. */
      const nibbed = mode === "inflate"
      const diag = [Math.abs(drawn[0] - drawn[2]), Math.abs(drawn[1] - drawn[3])]
      const spread = nibbed ? Math.max(diag[0], diag[1]) : hi - lo
      const cap = CORNER_SPREAD_MAX[mode]
      check(
        nibbed
          ? `${key} / each DIAGONAL of the square agrees with itself (the seam is not special; the nib makes the two diagonals differ by design)`
          : `${key} / the four corners of a square AGREE with each other (the seam is not special)`,
        cap !== undefined && spread <= cap,
        cap === undefined
          ? `no CORNER_SPREAD_MAX for mode ${mode} — measured spread ${spread.toFixed(4)}, record it`
          : (nibbed
              ? `worst diagonal ${spread.toFixed(4)} — {0,2} ${diag[0].toFixed(4)}, {1,3} ${diag[1].toFixed(4)} — ` +
                `across ${a.cornerOut.join(" ")}; full spread ${(hi - lo).toFixed(4)}, reported and NOT graded ` +
                `because under a nib it reads the pen as well as the corner (max ${cap}`
              : `spread ${spread.toFixed(4)} across ${a.cornerOut.join(" ")} (max ${cap}`) +
            (cap > 0.2 ? ", a RECORDED CEILING on a reading this lane cannot yet separate — see the note at CORNER_SPREAD_MAX" : "") +
            (nibbed
              ? `; the parked capped seam puts corner 0 at 0.4215 against corner 2 at 1.029, a diagonal of 0.6075)`
              : `; the parked capped seam reads 0.360 against ~0.98, a spread of 0.62)`),
      )
    }

    // 4. THE SURFACE IS CLOSED. Boundary edges are holes in the shell; a
    //    non-manifold edge is three faces meeting, which is what
    //    interpenetrating shells look like once welded.
    //
    //    ASSERTED ON EXTRUDE TOO, as of this pass. It used to be Solid-only, and
    //    that is exactly why "every Extrude mesh has 8-12 boundary edges" and
    //    "square/extrude has 153 non-manifold edges" sat measured-but-ungated
    //    for a whole cycle: the numbers were printed and nothing read them.
    if (mode === "solid" || mode === "extrude") {
      check(
        `${key} / shell is manifold`,
        a.nonManifoldEdges === 0,
        `${a.nonManifoldEdges} non-manifold, ${a.boundaryEdges} boundary`,
      )
      check(
        `${key} / shell is closed`,
        a.boundaryEdges === 0,
        `${a.boundaryEdges} boundary edges (a boundary edge belongs to one face: the shell has a hole)`,
      )
    }
  }

  if (NIB_ASPECT !== null) {
    console.log(
      `\nDIAGNOSTIC RUN AT nibAspect ${NIB_ASPECT} — NOT A VERDICT ON THE SHIPPED PEN.\n` +
        `${failures} row(s) failed. The shipped build is INFLATE_NIB_ASPECT_DEFAULT and this run ` +
        `overrode it on the inflate arms, so these rows say what the PREDICATES do at aspect ` +
        `${NIB_ASPECT} and nothing about what ships. Exiting 2 for that reason.`,
    )
    process.exit(2)
  }
  console.log(failures === 0 ? "\nALL MODE-RIM ASSERTIONS PASS" : `\n${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
