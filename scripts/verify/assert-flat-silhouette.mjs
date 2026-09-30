// K1'S SILHOUETTE COMPLAINT, MEASURED — the gate the beat has never had.
//
// ── WHAT SEBS SAID ──────────────────────────────────────────────────────────
//     "THE 2D AND 3D TRANSFORMATION IS WAY TOO SUBTLE LIKE IT'S HARD TO TELL
//      IT WENT FROM 2D TO 3D"
//
// ── WHY NO EXISTING GATE CAN SEE IT ────────────────────────────────────────
// `assert-hero-transition.mjs` has seven craft gates and every one of them is a
// statistic over LUMINANCE inside an ERODED mask. Erosion exists to throw the
// boundary away — `docs/explainers/14-the-flat-to-solid-beat.md` §8 states the
// reason and it is correct: *"any statistic over a luminance-gated mask is
// measuring the edge unless it was told not to."* The consequence nobody drew:
// having told it not to, the beat acquired a set of gates that are structurally
// incapable of seeing a SHAPE defect, and a shape defect is what it has.
//
// `docs/hero-beat-storyboard.md` §3 K1:591
//     "The silhouette is a tube's, not a pen's: blunt round terminals, constant
//      width, bulges at the joints ... A pen's outline tapers and varies. This
//      one cannot ... The flat state passes every **value** gate and fails the
//      **shape** test, and no value gate can see that."
//
// and §11.9.9:3752
//     "K1's silhouette complaint (§3 K1) is still not re-measured. It is a shape
//      judgement and it has now survived three passes unexamined."
//
// This file is that measurement. It reads only SHAPE — the medial-axis
// half-width of the rendered mark — and it is blind to value by construction,
// which its own calibration proves (`_calibrate-boundary.mjs`, last row).
//
// ── HOW IT IS CALIBRATED, AND WHY IT MUST FAIL TODAY ───────────────────────
// Two calibrations, both required before a number here means anything:
//
//   1. `node scripts/verify/_calibrate-boundary.mjs` — a synthetic tube and a
//      synthetic pen with the SAME centreline and the SAME nominal radius,
//      differing only in the width law. Measured: terminal ratio 0.993 against
//      0.317, relative sd 0.044 against 0.228. The instrument separates them.
//
//   2. THIS FILE, ON TODAY'S BUILD, MUST FAIL. `components/viewport-3d.tsx:589`
//      records the flat state and the settled solid at *"half-width median
//      7.07px, spread 0.493"* both — *"Identical to three decimals."* If these
//      rows come back green on a build where nothing about the silhouette
//      changes between the two states, they are measuring nothing and the whole
//      lane is decoration. A green run here on the unfixed build is the failure
//      condition, not the success one.
//
// Usage: node scripts/verify/_run-clean.mjs scripts/verify/assert-flat-silhouette.mjs
//        [--label=<dir>] [--mutate=taper]
import { chromium } from "./lib/browser.mjs"
import { fileURLToPath } from "node:url"
import { writeFileSync, mkdirSync } from "node:fs"
import {
  boundaryFromPng,
  boundaryStats,
  compareBoundaries,
  maskPng,
  taperTerminals,
} from "./lib/medial-width.mjs"
import { fitFootprint, nibCarve, RECOMMENDED_NIB } from "./lib/nib-carve.mjs"
import { flatInterior } from "./lib/flat-interior.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const arg = (k, d) => {
  const a = process.argv.find((s) => s.startsWith(`--${k}=`))
  return a ? a.slice(k.length + 3) : d
}
const LABEL = arg("label", "run")
/* `taper` and `nib` carve the mask OFFLINE — they were the proposal's proof
 * before the shader existed. `prior` is different in kind and is the control
 * this file needed once the shader landed: it loads the page on the carve's
 * PARKED arm, so the two silhouette rows are run against the build Sebs was
 * complaining about. THEY MUST GO RED THERE. A gate that only ever sees the
 * fixed build is a gate nobody has shown can fail — and this file's own header
 * says so: *"A green run here on the unfixed build is the failure condition,
 * not the success one."* `--mutate=prior` is how that run is still reachable
 * after the fix has landed. */
const MUTATE = arg("mutate", null)
const OUT = `docs/verification/flat-silhouette/${LABEL}`
mkdirSync(OUT, { recursive: true })

let failures = 0
const rows = []
const record = (name, pass, detail) => {
  rows.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`)
  console.log(`      ${detail}`)
  if (!pass) failures++
}

const fmt = (s) =>
  `median ${s.median.toFixed(3)} px · sd ${s.sd.toFixed(3)} · iqr ${s.iqr.toFixed(3)} · ` +
  `p10 ${s.p10.toFixed(2)} / p90 ${s.p90.toFixed(2)} · ${s.terminalCount} terminals, ratio ${s.terminalRatio.toFixed(3)} · ` +
  `ink ${s.inkPx}px`

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  // Before navigation: the page latches the carve law in a mount effect.
  if (MUTATE === "prior") {
    await page.addInitScript(() => {
      window.__heroCarveLaw = "prior"
    })
  }

  // See the same line in `assert-hero-flatstate.mjs` — `FS_PORT`, default
  // unchanged, so a worktree lane can point this at its own dev server.
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 90000,
  })
  await page.waitForTimeout(2500)

  const stage = page.locator("[data-hero-stage]")
  const shot = async () => {
    await page.waitForTimeout(200)
    return stage.screenshot()
  }
  const set = async (o) => {
    await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
    await page.waitForTimeout(140)
  }
  const scrubTo = async (v) => {
    await page.evaluate((t) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setV = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setV.call(el, String(t))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, v)
  }

  /* Park on the settled flat mark — DERIVED from the phase readout, never a
   * constant, for the reason assert-hero-flatstate.mjs records: a constant
   * standing in for a phase boundary reports on the beat's tempo instead of on
   * the thing it names. */
  const parkT = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
  let holdT = null
  for (let t = 0.2; t < parkT; t += 0.25) {
    await scrubTo(t)
    const ph = await page.evaluate(
      () => document.querySelector("[data-hero-phase]")?.dataset.heroPhase ?? null,
    )
    if (ph === "breath") holdT = t
    else if (holdT !== null) break
  }
  if (holdT === null) {
    console.error("no `breath` phase on the scrub — the beat's phase names moved")
    process.exit(1)
  }
  await scrubTo(holdT)
  await page.waitForTimeout(600)
  console.log(
    `(timeline ${parkT.toFixed(2)}s; parked at ${holdT.toFixed(2)}s — the last BREATH frame, ` +
      `the held flat mark, dead-on, derived not hard-coded)\n`,
  )

  /* THE TWO STATES. Same camera, same frame — everything that differs between
   * these two shots is what the beat's central event actually does to the
   * picture.
   *
   * ⚠ `penCarve` IS PINNED ON BOTH, AND WITHOUT THAT THIS FILE MEASURES NOTHING.
   * `__captureHarness.setFlatten` is a PARTIAL override: viewport-3d merges it
   * as `{ ...flattenProp, ...ov }`, so any key a pose omits comes from the HOST.
   * The moment `lib/hero-motion.ts` started publishing the carve, BOTH poses
   * silently inherited the model's value at the parked breath frame — which is
   * 1 — so the flat mark and the "solid" were BOTH carved and the comparison
   * cancelled. Measured, first-hand, before this line existed: earth-mover
   * **0.33 %** of a radius, median half-width 5.000 px on both arms, and the
   * headline row still red on a build where the fix had landed. A control that
   * accidentally applies the treatment to both arms reports NO EFFECT, which is
   * the most expensive way to be wrong.
   *
   * So each pose carries the value the BEAT carries in that state, and the flat
   * one is READ OFF THE PAGE rather than hardcoded — the same rule the parked
   * frame above follows, for the same reason: a constant standing in for a model
   * value reports on the constant. */
  const beatCarve = await page.evaluate(() => {
    const v = document.querySelector("[data-hero-carve]")?.getAttribute("data-hero-carve")
    return v === null || v === undefined ? null : Number(v)
  })
  if (beatCarve === null) {
    console.error("no [data-hero-carve] on the page — the carve readout moved")
    process.exit(1)
  }
  const carveLaw = await page.evaluate(
    () => document.querySelector("[data-hero-carve-law]")?.getAttribute("data-hero-carve-law") ?? null,
  )
  if (MUTATE === "prior" && carveLaw !== "prior") {
    console.error(
      `--mutate=prior did not take: the page reports carveLaw "${carveLaw}". ` +
        `Refusing to run — an arm that did not switch is not a control.`,
    )
    process.exit(2)
  }
  console.log(
    `(carve law "${carveLaw}"; the beat publishes penCarve ${beatCarve.toFixed(3)} at this frame)\n`,
  )
  const FLAT = { ink: 1, depth: 0.004, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1, penCarve: beatCarve }
  const SOLID = { ink: 0, depth: 1, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1, penCarve: 0 }

  await set(FLAT)
  const flatPng = await shot()
  await set(SOLID)
  const solidPng = await shot()
  writeFileSync(`${OUT}/flat.png`, flatPng)
  writeFileSync(`${OUT}/solid.png`, solidPng)

  let flat = await boundaryFromPng(flatPng)
  const solid = await boundaryFromPng(solidPng)

  /* THE MUTATION CONTROL. `--mutate=taper` erodes the flat mask's terminals in
   * software — i.e. hands the instrument a mark that IS tapered without
   * changing the build. Every row below must flip. A run in which the mutant
   * also passes is a run whose rows cannot fail. */
  if (MUTATE === "taper") {
    const carved = taperTerminals(flat)
    const mut = boundaryStats(carved, flat.W, flat.H)
    console.log(
      `[mutate=taper] the flat mask's terminals carved in software:\n` +
        `               terminal ratio ${flat.terminalRatio.toFixed(3)} -> ${mut.terminalRatio.toFixed(3)} · ` +
        `ink ${flat.inkPx} -> ${mut.inkPx} px\n`,
    )
    writeFileSync(`${OUT}/flat-mutant.png`, maskPng(carved, flat.W, flat.H))
    flat = mut
  }

  /* ---- THE MUTATION CONTROL THAT MATTERS -------------------------------- */
  //
  // `--mutate=nib` hands the instrument the mark the proposed shader would
  // produce: the live SOLID with the nib outline discarded out of it. A
  // fragment `discard` intersects the rendered mark with a mask and does nothing
  // else, so this IS that operation, offline.
  //
  // It is the negative control the whole file turns on. If the rows stay red
  // under it, the fix does not fix anything. If they were already green without
  // it, they were measuring nothing. Both directions have to be run and both are
  // reported.
  if (MUTATE === "nib") {
    const fit = fitFootprint(solid.mask, solid.W, solid.H)
    const { carved, removed, wouldAdd } = nibCarve(solid.mask, solid.W, solid.H, fit, RECOMMENDED_NIB)
    const mut = boundaryStats(carved, solid.W, solid.H)
    console.log(
      `[mutate=nib] the SHIPPED SOLID carved down to the nib outline — i.e. what the proposed\n` +
        `             fragment discard produces, applied offline to the real frame.\n` +
        `             fit: word ${fit.w.toFixed(1)} px, centre (${fit.cx.toFixed(1)}, ${fit.cy.toFixed(1)}), ` +
        `ink ${fit.ink.toFixed(2)} px, IoU ${(100 * fit.iou).toFixed(2)}%\n` +
        `             nib: aspect ${RECOMMENDED_NIB.aspect}, ` +
        `${((RECOMMENDED_NIB.angle * 180) / Math.PI).toFixed(0)} deg, taper ` +
        `${RECOMMENDED_NIB.taperRadii} R to tip ${RECOMMENDED_NIB.tip}\n` +
        `             ink ${solid.inkPx} -> ${mut.inkPx} px · removed ${removed} · ` +
        `WOULD HAVE ADDED ${wouldAdd} px (${((100 * wouldAdd) / solid.inkPx).toFixed(2)}% — ` +
        `a discard cannot add, so this has to be ~0)\n`,
    )
    writeFileSync(`${OUT}/flat-mutant-nib.png`, maskPng(carved, solid.W, solid.H))
    flat = mut
  }

  writeFileSync(`${OUT}/flat-skeleton.png`, maskPng(flat.mask, flat.W, flat.H, flat.skeleton))
  writeFileSync(`${OUT}/solid-skeleton.png`, maskPng(solid.mask, solid.W, solid.H, solid.skeleton))

  console.log(`FLAT   (ink 1, depth 0)   ${fmt(flat)}`)
  console.log(`SOLID  (ink 0, depth 1)   ${fmt(solid)}`)
  console.log("")
  console.log("terminal taper profile — half-width / median, walking inward from each tip:")
  console.log("  at medians:  " + flat.taperProfile.map((p) => p.atMedians.toFixed(1).padStart(6)).join(" "))
  console.log(
    "  FLAT:        " +
      flat.taperProfile.map((p) => (p.ratio === null ? "  --  " : p.ratio.toFixed(3).padStart(6))).join(" "),
  )
  console.log(
    "  SOLID:       " +
      solid.taperProfile.map((p) => (p.ratio === null ? "  --  " : p.ratio.toFixed(3).padStart(6))).join(" "),
  )
  console.log("")

  const cmp = compareBoundaries(solid, flat)
  console.log(
    `flat vs solid: earth-mover ${cmp.emd.toFixed(4)} px (${(100 * cmp.emdRel).toFixed(2)}% of a radius) · ` +
      `median shift ${cmp.medianShift.toFixed(4)} px · ink shift ${(100 * cmp.inkShiftRel).toFixed(2)}%\n`,
  )

  /* ---- TWO CONTROLS, BOTH MEASURED ON THIS SURFACE, NEITHER ASSUMED ------ */
  //
  // FOUND BY RUNNING IT, and the first version of this file was wrong without
  // it. The instrument reads a MASK, and the mask comes from a luminance
  // threshold — so a pure VALUE change moves where the 150-luma contour falls
  // and registers as a small shape change even though no geometry moved.
  // Reporting the shipped build's 4.09 % as "the beat does change the
  // silhouette a little" would have been confidently wrong.
  //
  // CONTROL A — VALUE ONLY. `ink` 1 -> 0 at depth 1: the beat's ENTIRE value
  // swing, from black emissive to fully lit, on geometry that does not move by
  // a vertex. Whatever this measures is what the instrument cannot attribute.
  await set({ ...SOLID, ink: 1 })
  const valFlat = await boundaryFromPng(await shot())
  await set({ ...SOLID, ink: 0 })
  const valLit = await boundaryFromPng(await shot())
  const noise = compareBoundaries(valLit, valFlat)

  // CONTROL B — DEPTH ONLY, and this one is not a control, it is THE RECEIPT.
  // `depth` 0.004 -> 1 at ink 1: the beat's one PHYSICAL event — the mark
  // acquiring thickness — with the shading held identical and the camera parked
  // dead-on. hero-beat-storyboard.md §1.4 says what this has to read and why:
  // *"a tube seen down its own axis has the same outline whether it is 1mm or
  // 10mm thick ... the depth went from ~0 to full and the silhouette did not
  // move by one pixel."*
  await set({ ...FLAT, depth: 0.004 })
  const depthThin = await boundaryFromPng(await shot())
  await set({ ...FLAT, depth: 1 })
  const depthFull = await boundaryFromPng(await shot())
  const depthOnly = compareBoundaries(depthThin, depthFull)

  console.log(
    `CONTROL A — value only (ink 1 -> 0, geometry identical):  earth-mover ` +
      `${(100 * noise.emdRel).toFixed(2)}% of a radius, median ${(100 * noise.medianShiftRel).toFixed(2)}%.\n` +
      `           This is the instrument's noise floor on this surface. Anything at or below it is\n` +
      `           the luminance threshold moving, not the silhouette.\n`,
  )
  console.log(
    `CONTROL B — depth only (0.004 -> 1, shading identical): earth-mover ` +
      `${(100 * depthOnly.emdRel).toFixed(2)}% of a radius, median ${(100 * depthOnly.medianShiftRel).toFixed(2)}%.\n` +
      `           The beat's one PHYSICAL event, measured on the silhouette, dead-on. Reported and\n` +
      `           not asserted: storyboard §1.4 predicts ~0 and the fix must not need it to be\n` +
      `           otherwise — the answer has to come from the OUTLINE, not from the view axis.\n`,
  )
  await set(FLAT)

  /* ---- 1. THE BEAT CHANGES THE SILHOUETTE ------------------------------- */
  //
  // The threshold is not picked, it is READ OFF THE CALIBRATION. The synthetic
  // pen and the synthetic tube — same centreline, same radius — separate at
  // 16.9% of a radius. A change smaller than that is a change the instrument
  // has already been shown not to be able to attribute, so 10% is the floor and
  // it sits comfortably inside a difference that is real.
  record(
    "THE BEAT CHANGES THE SILHOUETTE — the flat state and the solid are different SHAPES",
    cmp.emdRel >= 0.10 && cmp.emdRel >= 3 * noise.emdRel,
    `earth-mover distance ${(100 * cmp.emdRel).toFixed(2)}% of a stroke radius (needs >= 10% AND ` +
      `>= 3x the ${(100 * noise.emdRel).toFixed(2)}% value-only noise floor measured above). ` +
      `The calibration separates a known pen from a known tube at 16.9%; the nib law at its ` +
      `recommended setting measures 24.54% on this word ` +
      `(scripts/verify/_probe-pen-vs-tube-hero.mjs). ` +
      `viewport-3d.tsx:589 records both states at "half-width median 7.07px, spread 0.493" — ` +
      `identical to three decimals — so on the unfixed build this row MUST fail.`,
  )

  /* ---- 2. THE MARK GAINS SECTION --------------------------------------- */
  //
  // The simplest physical statement the beat can make, and the one a viewer
  // reads without being told: the drawing is THINNER than the object it becomes.
  // A drawing has no cross-section; the thing it turns into has one, and one
  // section is what a tube IS. The material arriving is visible on the OUTLINE,
  // which is the only place it can be seen when the camera is dead-on.
  //
  // ⚠ THE FLOOR IS SUBTRACTED, NOT MULTIPLIED, AND THAT IS A DELIBERATE CHOICE
  // WITH A REASON. Control A is not noise — it is a BIAS WITH A KNOWN SIGN: the
  // lit form's edge is brighter than the black emissive one, so the 150-luma
  // contour sits INSIDE it, and the lit mark always measures thinner. That bias
  // pushes against this row rather than around it, so the honest correction is
  // to require the effect to clear it by a full ten points rather than to
  // multiply it. Multiplying a one-sided bias would demand the effect be three
  // times an offset it is already paying once.
  const sectionGain = flat.median > 0 ? solid.median / flat.median - 1 : 0
  record(
    "THE MARK GAINS SECTION — the drawing is measurably THINNER than the object it becomes",
    sectionGain >= 0.1 && sectionGain >= Math.abs(noise.medianShiftRel) + 0.1,
    `median half-width ${flat.median.toFixed(3)} px flat -> ${solid.median.toFixed(3)} px solid ` +
      `= ${(100 * sectionGain).toFixed(2)}% (needs >= 10% AND >= ` +
      `${(100 * (Math.abs(noise.medianShiftRel) + 0.1)).toFixed(2)}%, i.e. the ` +
      `${(100 * Math.abs(noise.medianShiftRel)).toFixed(2)}% value-only bias plus ten points). ` +
      `On the shipped build the SIGN IS INVERTED — the flat mark measures FATTER than the ` +
      `solid, which is that bias with nothing underneath it.`,
  )

  /* ---- REPORTED, AND ASSERTED NOWHERE ----------------------------------- */
  //
  // Two statistics this instrument produces that it is NOT fit to gate on, said
  // out loud rather than quietly dropped or quietly used.
  //
  // THE TERMINALS. A tube ends in a round cap and ink ends by tapering, and the
  // terminal ratio separates those cleanly on synthetic shapes — 0.993 against
  // 0.317. On THIS word it cannot carry a gate, and the reason is measured
  // rather than assumed: `_probe-terminal-census.mjs` counts FOUR free
  // medial-axis terminals in a word with twenty-two strokes and forty-four pen
  // ends, out of 1635 medial samples. The fused mass has almost no free ends.
  // Worth 2.73 % of a stroke radius against the width law's 24.54 %
  // (`_probe-pen-vs-tube-hero.mjs`).
  //
  // AND THE SHIPPED TAPER IS DELIBERATELY BLUNT, so a terminal gate would have
  // fought it. A first build tapered to 10 % over 3 radii — textbook — and
  // rendered the `k` stem, the `l` and `d` ascenders and the `D`'s opening as
  // needle-sharp daggers. Only the eye caught that; every number improved.
  // `SHEET-taper-tune.png` is the sheet. A felt-tip has no point to come to.
  //
  // THE WIDTH SPREAD. Whole-axis relative sd reads 0.182 on the shipped flat
  // state and 0.188 on the 2-D register's own MONOLINE, which is one radius from
  // end to end by construction. It is measuring the bulges where strokes fuse.
  // Excluding every junction neighbourhood does not rescue it: monoline 0.136
  // against the nib's 0.144.
  console.log(
    `  reported, not asserted:\n` +
      `    terminal ratio        flat ${flat.terminalRatio.toFixed(3)} (${flat.terminalCount} terminals) · ` +
      `solid ${solid.terminalRatio.toFixed(3)} (${solid.terminalCount})   ` +
      `[known tube 0.993, known pen 0.317]\n` +
      `    body width spread     flat ${flat.bodyRelSd.toFixed(3)} · solid ${solid.bodyRelSd.toFixed(3)} ` +
      `over ${flat.bodyN} body samples, ${flat.junctionCount} junction px excluded   ` +
      `[a known MONOLINE reads 0.136 here, so this cannot separate]\n`,
  )

  /* ---- 3. GATE 1 SURVIVES — the non-negotiable ------------------------- */
  //
  // MUST NOT REGRESS. A genuinely flat 2D state is still ONE VALUE inside a
  // hard silhouette. Whatever carves the pen's outline has to be an OCCLUSION,
  // never a shading — the identical argument `FlatState.jointBreak` makes for
  // K7's paper break: "every surviving ink pixel is still at exactly the one
  // value."
  //
  // ⚠ IT READS THE TRIMMED STATISTIC, and `FLAT_TRIM` in `lib/flat-interior.mjs`
  // carries the input that forced that and the calibration that sizes it. In one
  // line: a sub-pixel CONCAVE gap — which is exactly what the carve correctly
  // opens between two strokes of the "D" — has no mask boundary for the
  // isotropic erosion to work back from, so its antialiasing ramp survives
  // INSIDE the interior. Three pixels of 4151 then read sd 1.256 while 4148 sit
  // at exactly luma 21. Those three are coverage samples, not surface samples.
  // The residue is bounded explicitly beside the trimmed sd, which is a STRICTER
  // claim than the raw sd ever made: the exceptions have to be a hairline
  // (O(perimeter)) and not a shading (O(area)) — measured, 0.07 % against the
  // lit control's 84 %.
  const gate1 = await flatInterior(flatPng)
  record(
    "GATE 1 HOLDS — the flat state is still ONE VALUE inside a hard silhouette",
    gate1.sdTrim < 1 && gate1.residue <= gate1.residueMax,
    `trimmed interior sd ${gate1.sdTrim.toFixed(4)} over ${gate1.n} px (needs < 1 — ` +
      `assert-hero-transition gate 1), residue ${gate1.offModal} px off modal luma ` +
      `${gate1.modal} = ${(100 * gate1.residue).toFixed(4)} % (needs <= ` +
      `${(100 * gate1.residueMax).toFixed(2)} %). [raw, not the verdict] sd ${gate1.sd.toFixed(4)}. ` +
      `Whatever changes the outline must be an occlusion, never a shading.`,
  )

  record("console clean", errors.length === 0, `${errors.length} errors${errors.length ? ": " + errors[0] : ""}`)

  await set(null)
  await browser.close()

  writeFileSync(
    `${OUT}/report.json`,
    JSON.stringify(
      {
        label: LABEL,
        mutate: MUTATE,
        parkedAt: holdT,
        flat: strip(flat),
        solid: strip(solid),
        compare: cmp,
        controlValueOnly: noise,
        controlDepthOnly: depthOnly,
        carveLaw,
        beatCarve,
        gate1: {
          sd: gate1.sd,
          sdTrim: gate1.sdTrim,
          residue: gate1.residue,
          n: gate1.n,
          mean: gate1.mean,
        },
        failures,
      },
      null,
      2,
    ),
  )

  console.log(`\n${failures === 0 ? "all rows passed" : `${failures} FAILED`}   -> ${OUT}/`)

  /* ---- THE PARKED-CARVE ARM'S VERDICT IS INVERTED ------------------------
   * On `--mutate=prior` the two SHAPE rows must be RED and gate 1 must be
   * GREEN. That pair is the whole claim of this lane in one run: without the
   * carve the beat does not change the silhouette at all (which is what Sebs
   * saw), and the shipped flat state was already one value (which is what made
   * the defect invisible to every gate the beat had). */
  if (MUTATE === "prior") {
    const shape = rows.filter(
      (r) => r.name.includes("CHANGES THE SILHOUETTE") || r.name.includes("GAINS SECTION"),
    )
    const stillGreen = shape.filter((r) => r.pass)
    if (shape.length !== 2) {
      console.error(`\nMUTATION CONTROL --mutate=prior: expected 2 shape rows, saw ${shape.length}`)
      process.exit(2)
    }
    if (stillGreen.length) {
      console.error(
        `\nMUTATION CONTROL --mutate=prior: FAILED TO FAIL.\n` +
          `On the PARKED carve the beat cannot change the silhouette — that is the defect this ` +
          `lane exists to close — yet ${stillGreen.length} shape row(s) stayed green: ` +
          `${stillGreen.map((r) => r.name).join(", ")}. Their green means nothing.`,
      )
      process.exit(1)
    }
    const g1 = rows.find((r) => r.name.includes("GATE 1"))
    console.log(
      `\nMUTATION CONTROL --mutate=prior: both SHAPE rows went RED, as required — the parked ` +
        `build genuinely does not change the silhouette, and this file can still say so. ` +
        `Gate 1 on that arm: ${g1?.pass ? "GREEN" : "RED"} (it must be green — the shipped flat ` +
        `state was always one value; that is why no value gate could see the defect).`,
    )
    process.exit(g1?.pass ? 0 : 1)
  }

  /* ── THE CONTROL, ON THE BARE INVOCATION — this gate runs it itself ───────
   *
   * ⚠ `--mutate=prior` HAD NEVER RUN IN A SWEEP. This file's own header says
   * *"A green run here on the unfixed build is the failure condition, not the
   * success one"* — and the only invocation that could produce that run was one
   * nothing typed. So the two SHAPE rows, which are the entire claim of this
   * file, had never been shown able to go red in a sweep
   * (`docs/explainers/21-losing-your-work.md` §7; explainer 31 counted nineteen
   * and named this one, as `partial`: CONTROL A above only SCALES thresholds, so
   * a blind CONTROL A makes this gate GREENER and never red — a scaling factor
   * is not a negative control).
   *
   * THE BARE RUN NOW SPAWNS ITSELF ONCE on the parked carve law and turns the
   * child's exit code into a row. The mutation machinery is unchanged and NOT
   * duplicated: the carve law is latched in a mount effect before navigation, so
   * a second arm needs a second page load anyway, and a child is the honest form
   * of "this gate, run against the build Sebs was complaining about".
   * `assert-gate-integrity.mjs`'s `selfSweeps()` — landed — is what teaches
   * channel J that a flag the gate passes itself on every run is swept.
   *
   * ⚠ THE CHILD'S ROWS ARE NOT ECHOED. They are red on purpose, and both battery
   * runners count an indented `FAIL`, so echoing the child would post this
   * gate's own evidence as its failures (Lane I, `assert-hero-transition`). */
  const { spawnSync } = await import("node:child_process")
  const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), "--mutate=prior"], {
    encoding: "utf8",
    env: process.env,
  })
  const childOut = `${child.stdout ?? ""}${child.stderr ?? ""}`
  const verdictLine =
    childOut
      .split("\n")
      .filter((l) => /^MUTATION CONTROL --mutate=prior:/.test(l.trim()))
      .pop() ?? "(no verdict line — the child did not reach its control block)"
  const controlOk = child.status === 0
  console.log(
    `${controlOk ? "PASS" : "FAIL"}  CONTROL · KNOWN-BAD — the PARKED carve law (the build that ` +
      `prompted "the 2D and 3D transformation is way too subtle") is REJECTED by BOTH shape rows, ` +
      `while GATE 1 correctly survives it`,
  )
  console.log(
    `      child exit ${child.status} (needs 0) · ${verdictLine.trim().replace(/\s+/g, " ").slice(0, 300)}` +
      `${controlOk ? "" : "\n      A GREEN RUN ON THE UNFIXED BUILD IS THIS FILE'S OWN FAILURE CONDITION"}`,
  )

  process.exit(failures || !controlOk ? 1 : 0)
}

const strip = (s) => ({
  n: s.n,
  inkPx: s.inkPx,
  median: s.median,
  sd: s.sd,
  iqr: s.iqr,
  p10: s.p10,
  p90: s.p90,
  terminalCount: s.terminalCount,
  terminalMedian: s.terminalMedian,
  terminalRatio: s.terminalRatio,
  junctionCount: s.junctionCount,
  bodyN: s.bodyN,
  bodyMedian: s.bodyMedian,
  bodyRelSd: s.bodyRelSd,
  taperProfile: s.taperProfile,
})

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
