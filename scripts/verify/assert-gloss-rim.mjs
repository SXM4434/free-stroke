// GLOSS RIM ASSERTIONS — pass/fail for the decimation-ladder fix.
//
// Per the project rule, each check asserts the SIGNATURE OF THE FIX rather than
// "did anything change":
//
//   1. NO LOOP REVERTS TO THE STAIRCASE. The defect was not a bad smoother — it
//      was a GUARD whose failure mode was `return exactLoop`, i.e. emit the raw
//      512-lattice contour. So the check is on the witness that counts terminal
//      fallbacks, per fixture, live.
//
//   2. THE RIM IS NOT A LATTICE COMB. Measured from the geometry the renderer is
//      actually lighting: a marching-squares loop turns +-90 at every vertex and
//      alternates, which `probeNormals` reports directly. Before the fix the
//      `crossing` fixture read rimTurnMeanDeg 90 / alternation 0.987 with sample
//      `90,-90,90,-90...`. This is the number that has to move.
//
//   3. THE CONTROL — the ladder must not be a blanket loosening. The `circle`
//      already smoothed correctly at the coarsest epsilon, so it must STILL take
//      rung 0 with zero retries. A fix that just decimates everything less would
//      pass check 2 and fail this one.
//
//   4. FIDELITY. Smoothing that drifts off the mask would also flatten the comb.
//      The rendered silhouette's bounding box must stay put.
//
// Usage: node scripts/verify/assert-gloss-rim.mjs [--label=after]
import { chromium } from "./lib/browser.mjs"
import { existsSync, readFileSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder } from "./_capture-freshness.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "after")
const DIR = join(ROOT, "docs", "verification", "gloss-rim", LABEL)

let failures = 0
const check = (name, ok, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`)
  if (!ok) failures++
}

/** CHECK 2's PREDICATE, factored out so the control can grade the SAME
 *  expression the real rows do rather than a paraphrase of it. A control that
 *  re-implements the rule it certifies is certifying its own copy. */
export function notAComb(p) {
  return typeof p.rimTurnMeanDeg === "number" && p.rimTurnMeanDeg < 20 && p.rimTurnAlternationRatio < 0.3
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE NEGATIVE CONTROL — the one this gate did not have.
 *
 * Until 2026-08-07 this file called two rows "the control" and both were
 * known-GOOD fixtures required to behave correctly (see §3 below). It had NO
 * known-bad anywhere: nothing was ever required to be REJECTED, so `notAComb`
 * could have returned `true` unconditionally and every row would have stayed
 * green.
 *
 * THE KNOWN-BAD IS NOT SYNTHETIC. It is the measurement this gate was written
 * about, recorded in the header at the time and quoted here verbatim: before the
 * fix, the `crossing` fixture read **rimTurnMeanDeg 90 / alternation 0.987**,
 * with the sample `90,-90,90,-90...` — a marching-squares loop turning +-90 at
 * every vertex. That is the defect the whole file exists to detect, and the
 * numbers are on the record.
 *
 * These run on the BARE invocation, before the browser opens, so they hold in
 * any tree — including one with no dev server, where the rest of this gate
 * cannot run at all. They are PREDICATE-LEVEL and the rows say so: they prove
 * check 2's expression can say no, not that the page is correct.
 * ═══════════════════════════════════════════════════════════════════════════ */
export const RIM_CONTROLS = [
  {
    label: "CONTROL · KNOWN-BAD — the pre-fix `crossing` rim (the raw lattice comb) is REJECTED",
    probe: { rimTurnMeanDeg: 90, rimTurnAlternationRatio: 0.987, rimTurnMaxDeg: 90 },
    want: false,
    why: "the measured pre-fix reading, verbatim from this file's own header — sample 90,-90,90,-90",
  },
  {
    label: "CONTROL · KNOWN-BAD — a rim that alternates but turns gently is still REJECTED",
    probe: { rimTurnMeanDeg: 22, rimTurnAlternationRatio: 0.9, rimTurnMaxDeg: 40 },
    want: false,
    why: "the mean clause alone must bite; a comb with rounded teeth is still a comb",
  },
  {
    label: "CONTROL · KNOWN-BAD — a rim that turns hard but never alternates is REJECTED",
    probe: { rimTurnMeanDeg: 90, rimTurnAlternationRatio: 0.1, rimTurnMaxDeg: 90 },
    want: false,
    why: "…and the alternation clause alone must bite too, or one of the two is decorative",
  },
  {
    label: "CONTROL · ACCEPT — the measured post-fix `circle` rim is NOT rejected",
    probe: { rimTurnMeanDeg: 1.8, rimTurnAlternationRatio: 0.05, rimTurnMaxDeg: 6 },
    want: true,
    why: "a predicate that rejects everything is as blind as one that accepts everything",
  },
]

const FIXTURES = {
  // The case that failed. Two thin bars crossing at a shallow angle: the
  // "overlaps look weird" complaint, and the shape whose smoothed area landed
  // at 1.067 — just past the 1.05 ceiling — so BOTH loops reverted.
  crossing: () => {
    const a = [], b = []
    for (let i = 0; i <= 90; i++) {
      const t = i / 90
      a.push({ x: 140 + t * 620, y: 250 + t * 190 })
      b.push({ x: 140 + t * 620, y: 470 - t * 190 })
    }
    return [a, b]
  },
  // The SPECIFICITY fixture (it was labelled "the control" and is not one — see
  // §3): uniform curvature, already smoothed correctly before the fix.
  circle: () => {
    const p = []
    for (let i = 0; i <= 160; i++) {
      const t = (i / 160) * Math.PI * 2
      p.push({ x: 440 + Math.cos(t) * 210, y: 360 + Math.sin(t) * 210 })
    }
    return [p]
  },
  // A short mark — a tittle, a comma, an apostrophe. The smallest real unit of
  // handwriting, and the second shape that was reverting.
  tick: () => [Array.from({ length: 6 }, (_, i) => ({ x: 400 + i * 4, y: 380 + i * 3 }))],
  // Corner preservation: the ladder must not round these four 90 degree turns.
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
}

/** The negative control, run BEFORE the browser opens so it holds in any tree.
 *  Predicate-level, and the rows say so — this proves check 2's expression can
 *  say no, never that the page is correct. */
function runRimControls() {
  console.log("\n=== CONTROLS · can check 2's predicate REJECT anything? ===")
  for (const c of RIM_CONTROLS) {
    const got = notAComb(c.probe)
    check(
      `${c.label} (predicate-level, not the page)`,
      got === c.want,
      `notAComb(mean ${c.probe.rimTurnMeanDeg}, alternation ${c.probe.rimTurnAlternationRatio}) = ${got}, needs ${c.want} — ${c.why}`,
    )
  }
}

async function main() {
  /* The controls run FIRST, and unconditionally. A gate whose controls sit
   * behind a successful browser launch has its dependency backwards: the run
   * that most needs to know the instrument is awake is the one that could not
   * open a browser. */
  runRimControls()
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1300, height: 850 } })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })

  // The rim measurement lives in the app's own debug harness. If that API is
  // not there, this script cannot make its claim — and must say so rather than
  // throw a stack trace (which reads as a broken test) or skip quietly (which
  // reads as a pass). Every check below depends on it.
  const hasProbe = await page.evaluate(
    () => typeof window.__geomDebug?.probeNormals === "function",
  )
  if (!hasProbe) {
    console.log(
      "FAIL  harness / __geomDebug.probeNormals is missing — the rim measurement\n" +
        "      this pass asserts on cannot be taken. verify-solid-rim.mjs and\n" +
        "      verify-gloss-rim.mjs depend on it too, and geometry-baseline.mjs\n" +
        "      optional-chains stats() so it degrades to `verts=? tris=?` in\n" +
        "      SILENCE. Restore the harness before trusting any geometry run.",
    )
    await browser.close()
    process.exit(1)
  }

  for (const [name, fn] of Object.entries(FIXTURES)) {
    await page.evaluate(() => window.__styleHarness.clearStrokes())
    await page.waitForTimeout(200)
    // Reset EVERY counter, including the ladder ones — a witness that carries
    // the previous fixture's totals reads as if this fixture behaved.
    await page.evaluate(() => {
      const d = window.__contourSmoothDebug
      if (!d) return
      d.smoothed = 0
      d.areaFallbacks = 0
      d.selfIntersectFallbacks = 0
      d.decimationRetries = 0
      d.lastEpsilonCells = -1
      d.lastFallbackReason = ""
    })
    await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 10 }), fn())
    await page.waitForTimeout(700)
    await page.evaluate(() => window.__styleHarness.setMode("solid"))
    await page.waitForTimeout(1600)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(500)

    const dbg = await page.evaluate(() => window.__contourSmoothDebug ?? null)
    // `probeNormals` walks `exportGroupRef.current`, which is empty for a beat
    // while a rebuild swaps meshes in. Reading it once returns [] and the
    // assertion then reports `undefined` as a failure of the geometry rather
    // than of the measurement. Wait for the group to be populated instead.
    // Two ways this read comes back useless, both of which report as a geometry
    // failure if you let them: an EMPTY group (mid-swap), and a populated group
    // whose first entry is a mesh with no rim to measure. Wait for an entry that
    // actually carries the field being asserted, and take the LARGEST mesh
    // rather than index 0.
    let p0 = {}
    for (let tries = 0; tries < 30; tries++) {
      const probe = await page.evaluate(() => window.__geomDebug.probeNormals())
      if (Array.isArray(probe) && probe.length > 0) {
        const best = probe
          .filter((p) => typeof p.rimTurnMeanDeg === "number")
          .sort((a, b) => (b.vertices ?? 0) - (a.vertices ?? 0))[0]
        if (best) {
          p0 = best
          break
        }
      }
      await page.waitForTimeout(300)
    }

    // ---- 1. no terminal fallback to the raw lattice loop ----
    check(
      `${name} / no loop reverts to the raw staircase`,
      !!dbg && dbg.smoothed > 0 && dbg.areaFallbacks === 0 && dbg.selfIntersectFallbacks === 0,
      dbg
        ? `smoothed ${dbg.smoothed}, areaFallback ${dbg.areaFallbacks}, selfIntersectFallback ${dbg.selfIntersectFallbacks}${dbg.lastFallbackReason ? ` (${dbg.lastFallbackReason})` : ""}`
        : "no witness",
    )

    // ---- 2. the rim is not a lattice comb ----
    // A marching-squares loop turns exactly +-90 every vertex and alternates.
    // 20 degrees mean is well above any smoothed contour measured here (circle
    // 1.8, crossing 6.2, square 9.6) and far below the comb's 90.
    check(
      `${name} / rim is not a 90-degree lattice comb`,
      notAComb(p0),
      `rimTurnMeanDeg ${p0.rimTurnMeanDeg}, alternation ${p0.rimTurnAlternationRatio}`,
    )

    /* ---- 3. SPECIFICITY GUARDS — and they are NOT "the control" ----------
     *
     * 🔴 THIS BLOCK WAS CALLED "the control" UNTIL 2026-08-07, AND IT IS NOT ONE.
     * Both rows below are KNOWN-**GOOD** fixtures required to behave CORRECTLY:
     * the circle must still smooth at the coarsest rung, the square's drawn
     * corners must survive. They guard against the fix being a blanket
     * loosening, which is a real and useful thing to guard — it is just not a
     * negative control. A negative control feeds the instrument a DELIBERATELY
     * WRONG input and requires it to be REJECTED; nothing here is wrong on
     * purpose, so nothing here can prove the instrument is awake.
     *
     * **A gate that believes it has a control and does not is more dangerous
     * than one that knows it has none**, because the first one stops anybody
     * looking. Renamed to what they are; the real control is `notAComb`'s
     * negative arm, below.
     */
    if (name === "circle") {
      check(
        "circle / SPECIFICITY: still smooths at the COARSEST epsilon, no retries (the ladder is not a blanket loosening)",
        dbg && dbg.lastEpsilonCells === 1.4 && dbg.decimationRetries === 0,
        `epsilon ${dbg?.lastEpsilonCells} cells, retries ${dbg?.decimationRetries}`,
      )
    }
    if (name === "square") {
      // Corner preservation: the pinned 90 degree corners must survive as large
      // single turns. If the ladder had merely blurred everything, the max turn
      // would collapse toward the mean.
      check(
        "square / SPECIFICITY: the four drawn corners survive the ladder (smoothing did not just blur everything)",
        p0.rimTurnMaxDeg > 60,
        `max turn ${p0.rimTurnMaxDeg} deg vs mean ${p0.rimTurnMeanDeg}`,
      )
    }
  }

  await browser.close()

  // ---- 4. fidelity: the FORM did not move ----
  //
  // Not measured off the captured frames. The gloss-rim `before` series was
  // shot while DEV capture mode was off for part of the run, so those PNGs are
  // opaque — every pixel passes an alpha test and the "ink bounding box" is
  // just the canvas (799/868 = 0.9205, which is exactly what a naive check
  // reported). A fidelity number that is really the canvas aspect ratio is the
  // kind of measurement this project has already been burned by.
  //
  // The geometry regression net captured both sides under identical conditions,
  // so read ITS bounding boxes instead — 8 shapes rather than 1, and world
  // units rather than pixels.
  const GEO = join(ROOT, "docs", "verification", "geometry")
  const rBefore = join(GEO, arg("geoBefore", "es-before"), "report.json")
  const rAfter = join(GEO, arg("geoAfter", "es-after"), "report.json")

  /* ═══ PROVENANCE · AND THE FRESHNESS ROW WAS MEASURING THE WRONG DIRECTORY ══
   *
   * `assert-gate-integrity.mjs` channel F reports this gate stale on
   * `docs/verification/gloss-rim/after` at 24.7 days. THIS GATE NEVER OPENS
   * THAT DIRECTORY. `DIR` above is declared and read by nothing; channel F
   * finds it because `defaultCaptureDir()` regexes the first
   * `"verification", "<pass>"` pair out of the source and joins the default
   * label. So the one row guarding this gate's provenance was pointed at a path
   * it does not use — `silent-degradation` shape 2, a gate that cannot see the
   * thing it polices.
   *
   * The stored evidence this gate ACTUALLY grades is the two geometry reports
   * below, and both were captured 2026-07-29 (08:25 and 13:40). So the
   * bbox-regression row was two month-old reports compared to each other, and
   * the row that should have caught it was looking somewhere else.
   *
   * The live rows above are NOT gated on this: they read the running build
   * through the browser and stand on their own. Only the stored half is refused.
   *
   * ── 🔴 AND THE REPAIRED ROW THEN ASKED FOR A BEFORE ARM FROM THE FUTURE ───
   *
   * As first written, this row took the OLDER of the two reports and required
   * IT to post-date every source. `es-before` is the arm captured on the
   * PRE-SMOOTHING-FIX build. A reference arm is older than the fix it brackets
   * by construction, so that row could never go green in any tree, and it read
   * `STALE BY 891.2h` while naming `es-before` — a file that must not be
   * re-shot, because re-shooting it is what would destroy the comparison. Its
   * own instruction, "re-run the geometry regression net for BOTH arms", is
   * un-followable: no dev law parks `smoothLatticeLoop`, so the pre-fix build
   * cannot be rebuilt from this tree at all.
   *
   * WHAT IS GRADED NOW, AND IT IS THE HALF THAT CAN BE FRESH. `es-before` is a
   * FROZEN REFERENCE and is exempt by construction — stated here rather than
   * left as a silence. The SUBJECT arm, `es-after`, must post-date every source
   * under lib/ app/ components/, and it is re-capturable with the tool DISPATCH
   * §3 already names:
   *
   *   node scripts/verify/geometry-baseline.mjs --save=es-after
   *
   * The claim the row makes is correspondingly the one worth making on a live
   * tree: TODAY's solid form still sits where the pre-fix baseline put it,
   * within two mask cells. Re-shot 2026-09-04 on :3122, that is not a formality
   * — 16 of 32 report cells moved, and two solid shapes that had read 0.00 for
   * a month came off it: zigzag/solid 0.00 → 0.29 cells and scribble/solid
   * 0.00 → 0.84. Both inside the 2.00 ceiling, and both invisible while the
   * gate was comparing two 07-29 reports to each other.
   *
   * ORDER IS ASSERTED TOO. A reference newer than its subject would silently
   * invert the comparison, so that is a failure here rather than a shrug. */
  {
    const subj = ["lib", "app", "components"]
      .map((d) => newestUnder(join(ROOT, d)))
      .filter((x) => x.file)
      .sort((x, y) => y.ms - x.ms)[0]
    const rel = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
    const stamp = (ms) => new Date(ms).toLocaleString()
    const at = (f) => (existsSync(f) ? statSync(f).mtimeMs : null)
    const refMs = at(rBefore)
    const subjMs = at(rAfter)
    const ordered = refMs !== null && subjMs !== null && refMs <= subjMs
    const fresh = ordered && Boolean(subj?.file) && subj.ms <= subjMs
    check(
      "PROVENANCE · the geometry report this gate GRADES post-dates every source under lib/ app/ components/ (the `before` arm is the frozen pre-fix reference and is exempt by construction)",
      fresh,
      refMs === null || subjMs === null
        ? `one or both geometry reports are missing — the comparison cannot be made`
        : !subj?.file
          ? `no source found under lib/ app/ components/ — the comparison cannot be made`
          : !ordered
            ? `THE REFERENCE IS NEWER THAN THE SUBJECT — ${rel(rBefore)} ${stamp(refMs)} against ${rel(rAfter)} ${stamp(subjMs)}. ` +
              `A "before" captured after its "after" inverts the bbox row below; re-capture the subject.`
            : fresh
              ? `subject ${rel(rAfter)} ${stamp(subjMs)} · newest source ${rel(subj.file)} ${stamp(subj.ms)} · reference ${rel(rBefore)} ${stamp(refMs)} (frozen)`
              : `STALE BY ${((subj.ms - subjMs) / 3600000).toFixed(1)}h — ${rel(rAfter)} ${stamp(subjMs)} ` +
                `but ${rel(subj.file)} was written ${stamp(subj.ms)}. The bbox row below describes a mask that no longer ` +
                `exists; re-capture the SUBJECT arm with \`node scripts/verify/geometry-baseline.mjs --save=es-after\`. ` +
                `Do NOT re-shoot the reference and do NOT relax this row.`,
    )
    if (!fresh) {
      console.log(
        "      ⚠ the bbox-regression row that follows is NOT a verdict on tonight's tree.",
      )
    }
  }

  if (existsSync(rBefore) && existsSync(rAfter)) {
    const A = JSON.parse(readFileSync(rBefore, "utf8"))
    const B = JSON.parse(readFileSync(rAfter, "utf8"))
    // The tolerance is in WORLD units, not percent, because the thing being
    // bounded is a smoothing deviation measured in mask cells — an absolute
    // length — and a percentage of the form's size is not that. A percentage
    // budget is far too loose on a big form and impossibly tight on a small
    // one: the `tick` fixture is 0.13 world units tall, so a single mask cell
    // is ~3.7% of it, and a correct 1-cell inward smooth reads as a 4.2%
    // "regression" while the same absolute move on the circle reads as 0.3%.
    //
    // Derivation of the bound: geometry-baseline runs a 1400x900 viewport, the
    // canvas maps its longest side to 3 world units and the mask is 512 across,
    // so one mask cell is about 3/512 = 0.0059 world units. The raw lattice loop
    // is the OUTER hull of the mask (it steps around whole cells), so replacing
    // it with a sub-cell-snapped smooth contour is EXPECTED to pull the extremes
    // in by up to about a cell on each side. Two cells is the honest ceiling.
    const MASK_CELL_WORLD = 3 / 512
    const MAX_BBOX_DELTA_WORLD = 2 * MASK_CELL_WORLD
    let worst = 0
    let worstCase = ""
    for (const k of Object.keys(A)) {
      if (!k.endsWith("/solid")) continue
      const a = A[k]?.bbox
      const b = B[k]?.bbox
      if (!a || !b) continue
      for (let i = 0; i < 3; i++) {
        const d = Math.abs((b[i] ?? 0) - (a[i] ?? 0))
        if (d > worst) {
          worst = d
          worstCase = `${k} axis${i} ${a[i]} -> ${b[i]}`
        }
      }
    }
    check(
      "solid / form did not move (bbox across all 8 regression shapes)",
      worst < MAX_BBOX_DELTA_WORLD,
      `worst ${worst.toFixed(4)} world = ${(worst / MASK_CELL_WORLD).toFixed(2)} mask cells (ceiling 2.00) — ${worstCase || "no change"}`,
    )
  } else {
    console.log("SKIP  fidelity — need geometry/es-before and geometry/es-after reports")
  }

  console.log(failures === 0 ? "\nALL GLOSS-RIM ASSERTIONS PASS" : `\n${failures} FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
