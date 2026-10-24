// K7 COMES BACK CHANGED — and the change is an OCCLUSION, not a shading.
//
// §3 K7 of the storyboard: *"the pitch is a ROUND TRIP: your hand survives the
// round-trip. Going one way asserts a conversion; coming back asserts an
// identity."* §10.5 call 1 takes that further — a return that is pixel-identical
// to K1 makes two of the seven key shots the same picture, so K7 carries news:
// the drawing's stroke junctions come back OPEN, later stroke in front, and the
// pen order is legible in ink alone.
//
// ── THE HARD CONSTRAINT, AND IT IS WHAT THIS FILE IS FOR. ──────────────────
// §10.5: *"the change must be OCCLUSION and never SHADING. A value difference
// at a crossing breaks gate 1 (flat ink SD < 1), which is non-negotiable. An
// occlusion gap leaves every remaining ink pixel at one value, so it passes."*
// The eleven online reference clips reach the same mechanism independently
// (`online-reference-mechanics.md` §9.1, OCCLUSION on 7 of 7 frames against two
// controls). So it is not enough to show that K7 differs from K1 — a fade, a
// darkening or an alpha ramp would all differ too, and all three are the defect.
// The rows below assert the DIRECTION of the change:
//
//   * ink may only become paper. Never the reverse, and never a new value.
//   * the ink that survives keeps gate 1's own statistic.
//   * the amount of ink lost matches what the break MODEL predicts, so the
//     shader and `buildJointBreaks` cannot drift apart silently.
//
// ── AND EVERY ROW HAS A CONTROL THAT MUST FAIL. ────────────────────────────
//   --mutate=nobreak   K7 driven with the channel at 0 — "K7 carries news" and
//                      the predicted-area row MUST go red. Catches an
//                      instrument that would call any two frames different.
//   --mutate=shade     K7 driven by `shade` on the REAL PAGE instead of by the
//                      break — a genuine value change on genuine pixels. The
//                      survives-keeps-its-value row MUST go red.
//                      ⚠ AND GATE 1 STAYS GREEN, WHICH IS A FINDING ABOUT THE
//                      GATE: `shade` multiplies the flat ink UNIFORMLY, and a
//                      standard deviation cannot see a uniform re-value. §10.5
//                      says *"a value difference at a crossing breaks gate 1"*
//                      and that is true of a difference AT A CROSSING; it is
//                      not true of a wash over the whole mark. `--mutate=wash`
//                      below is the control that matches the sentence.
//   --mutate=wash      the break region is rendered as LIGHTER INK instead of
//                      as paper — a value difference at the crossings, exactly
//                      the forbidden shot. Gate 1 MUST go red.
//   --mutate=alpha     the break is faked as a 50 % ink/paper blend — the
//                      "alpha fade wearing an occlusion's name" case. It stays
//                      under the ink threshold, so the news row and the
//                      predicted-area row MUST go red.
//
// ── AND THE AMPLITUDE IS DRIVABLE, BECAUSE THE NEWS IS A FUNCTION OF IT ─────
// (Added 2026-08-01 by the lane that sized the break against the carve.)
//
// `--carve=<0..1>` drives `HeroMotionParams.carveAmount`, exactly as
// `assert-hero-k7-intact.mjs` already does, and the live value is read back off
// the page and printed with the verdict. It is not a convenience: the two K7
// gates pull in OPPOSITE directions as the carve rises — the pen carve un-fuses
// the mark, so the same junction set opens fewer legitimate breaks and the ink
// this file counts falls — and a conflict that can only be reproduced on one of
// the two instruments is a conflict nobody can act on. Both now take the same
// flag and can be run as a pair at the same amplitude.
//
// Usage:
//   node scripts/verify/assert-hero-k7-news.mjs [--mutate=…] [--carve=1]
//   FS_PORT=3011 node …/assert-hero-k7-news.mjs
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { flatInterior, interiorStats, INK_MAX_LUMA } from "./lib/flat-interior.mjs"
import { gapRegionsFromMasks, matchToBreaks } from "./lib/joint-break-gaps.mjs"
import { injectSelfJunctions } from "./lib/self-junctions.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "hero-k7", "assert")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
/** The carve amplitude to drive, or null for the page's own default. */
const CARVE = arg("carve", null)
/** Inject the arc-keyed self-crossings — see `lib/self-junctions.mjs`. */
const SELF = process.argv.includes("--self")
const URL = HERO_URL

/** Gate 1's own threshold — `assert-hero-transition.mjs` gate 1. */
const FLAT_SD_MAX = 1

/** The flat pose both frames are taken in. One channel differs between them. */
const FLAT = { ink: 1, depth: 0.004, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1 }

let failures = 0
const rows = []
const record = (name, pass, detail) => {
  rows.push({ name, pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`)
  console.log(`      ${detail}`)
  if (!pass) failures++
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  // >= 1440 in both axes: at 1440x900 an expanded timeline dock squeezes the
  // stage to half height and CLIPS the mark (`verify-hero-transition.mjs:84`).
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  // BEFORE NAVIGATION: the amplitude is latched in a mount effect, so a flag
  // set afterwards would be read one render too late and the run would silently
  // grade the page's default.
  if (CARVE !== null) {
    await page.addInitScript((v) => {
      window.__heroCarveAmount = v
    }, Number(CARVE))
  }

  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, {
    timeout: 90000,
  })
  await page.waitForTimeout(2500)

  /* THE AMPLITUDE IS READ OFF THE PAGE, NOT OFF THE FLAG THAT ASKED FOR IT. A
   * flag that silently failed to take produces a run identical to the default
   * arm, which then reads as "the driven arm passed too" — the same trap
   * `assert-hero-k7-intact.mjs` refuses to grade through. */
  const liveCarve = await page.evaluate(() => {
    const v = document.querySelector("[data-hero-carve]")?.getAttribute("data-hero-carve")
    return v === null || v === undefined ? null : Number(v)
  })
  if (CARVE !== null && Math.abs((liveCarve ?? -1) - Number(CARVE)) > 0.005) {
    console.error(
      `--carve=${CARVE} did not take: the page publishes ${liveCarve}. ` +
        `Refusing to grade — an arm that did not switch is not an arm.`,
    )
    await browser.close()
    process.exit(2)
  }

  /* ── `--self` · THE ARC-KEYED SELF-CROSSINGS, INJECTED (2026-08-02) ───────
   * The other half of the pair takes the same flag for the same reason: the law
   * is `lib/flat-ink.ts`'s `findSelfCrossings`, but the CALL SITE is twenty
   * lines in `app/desk-doodles/page.tsx`, which belongs to another lane. This
   * publishes the set that diff would publish, computed by the real function
   * over the page's own strokes. `lib/self-junctions.mjs` states what it does
   * and does not prove; nothing downstream of `window.__heroJunctions` changes.
   *
   * WHY IT MATTERS HERE: this file's row 1 has a 200 px floor and the shipped
   * distinct-pair set clears only 97 px of it. The self-crossings are where the
   * rest of the news is. */
  let injected = null
  if (SELF) {
    injected = await injectSelfJunctions(page, liveCarve ?? 1)
    if (injected.self === 0) {
      console.error(`--self injected NOTHING — refusing to grade.`)
      await browser.close()
      process.exit(2)
    }
    await page.waitForTimeout(600)
    console.log(
      `+${injected.self} SELF-crossings injected on law "${injected.law}" -> ${injected.after} junctions\n`,
    )
  }

  const stage = page.locator("[data-hero-stage]")
  const box = await stage.boundingBox()
  const seek = async (t) => {
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, t)
    await page.waitForTimeout(500)
  }
  // CLIP, never `locator.screenshot()`: the element path waits for the node to
  // be "stable" and this page never stops rendering.
  const shot = async () => {
    await page.waitForTimeout(300)
    return page.screenshot({ clip: box })
  }
  const set = async (o) => {
    await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
    await page.waitForTimeout(250)
  }

  const endT = await page.evaluate(() =>
    Number(document.querySelector("[data-hero-scrub]").max),
  )

  /* ---- K1: the beat's OWN flat mark, no override at all ------------------
   * Found by walking the phase readout rather than by arithmetic on a beat
   * table this file does not own — `lib/hero-motion.ts` belongs to another
   * lane and its durations are live dials. The last `breath` frame is the
   * settled flat mark immediately before the anticipation. */
  let k1T = null
  for (let t = 0.2; t < endT; t += 0.25) {
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, t)
    const ph = await page.evaluate(
      () => document.querySelector("[data-hero-phase]")?.dataset.heroPhase ?? null,
    )
    if (ph === "breath") k1T = t
    else if (k1T !== null) break
  }
  if (k1T === null) {
    console.error("could not find the breath phase on the scrub — the beat's phase names moved")
    process.exit(1)
  }
  await seek(k1T)
  await set(null)
  const k1Png = await shot()
  writeFileSync(join(OUT, "k1.png"), k1Png)

  /* ---- K7: the end of the beat, in the same flat pose -------------------- */
  await seek(endT)
  /* PRIME THE READOUT. `window.__heroBreaks` is written when the break table is
   * built, which only happens while the channel is open — so a control that
   * never opens it would read "no readout" and fail rows it is not testing. */
  await set({ ...FLAT, jointBreak: 1 })
  const breaks = await page.evaluate(() => window.__heroBreaks ?? null)
  await set({ ...FLAT, jointBreak: 0 })
  const fusedPng = await shot()
  writeFileSync(join(OUT, "k7-fused.png"), fusedPng)

  await set({ ...FLAT, jointBreak: 1 })
  const openPng = await shot()
  writeFileSync(join(OUT, "k7-open.png"), openPng)

  /* ---- THE CONTROLS' OWN FRAMES, TAKEN IN THIS SAME PAGE SESSION ---------
   *
   * Four known-bads used to sit behind `--mutate=` and no sweep passed it, so
   * the required-red table below had never run in a sweep
   * (`docs/explainers/21-losing-your-work.md` §7; explainer 31 counted nineteen
   * gates like this and named this one). The flag is DELETED per explainer 29 §5.
   *
   * They are nearly free, which is why "schedule them elsewhere" was never the
   * answer here:
   *   nobreak  IS the fused frame — `{ jointBreak: 0 }` is the drive that
   *            produced `fusedPng` two statements up, so it costs NOTHING.
   *   shade    one extra set+shot in this same session.
   *   wash     pixel-side, applied after the browser closes.
   *   alpha    pixel-side, likewise.
   * One extra screenshot for four controls. */
  await set({ ...FLAT, jointBreak: 0, shade: 0.35 })
  const shadePng = await shot()
  writeFileSync(join(OUT, "k7-open-shade.png"), shadePng)

  const jlaw = await page.evaluate(() => ({
    law: window.__heroJunctions?.law ?? null,
    carve: window.__heroJunctions?.carve ?? null,
  }))
  const word = await page.evaluate(() => {
    const s = window.__handFeelHarness.processed
    let minX = Infinity
    let maxX = -Infinity
    for (const st of s) for (const [x] of st) {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
    return { spanX: maxX - minX, ink: window.__heroJunctions.inkWidth }
  })
  await set(null)
  await browser.close()

  const k1 = await flatInterior(k1Png)
  const fused = await flatInterior(fusedPng)
  const open = await flatInterior(openPng)
  const openShade = await flatInterior(shadePng)

  /* THE TWO PIXEL-SIDE CONTROLS. Both take the REAL rendered break and put back
   * the mechanism the shot is forbidden to use, so the page is untouched and the
   * control is exactly the defect. Both go through `interiorStats` — the same
   * erosion the real frames get — because a mutation that skips it is a control
   * that cannot fire, which is what the first draft of `alpha` did. */
  const pixelSide = (which) => {
    const l = Float32Array.from(open.luma)
    for (let p = 0; p < l.length; p++) {
      if (!fused.mask[p] || open.mask[p]) continue
      // `alpha`: half ink, half paper — still under the ink threshold.
      // `wash`:  the ink, lightened but still ink. A value difference AT the
      //          crossings, which is the shot §10.5 rules out.
      l[p] = which === "alpha" ? (l[p] + fused.luma[p]) / 2 : Math.min(INK_MAX_LUMA - 5, fused.luma[p] + 60)
    }
    return interiorStats(l, open.W, open.H)
  }

  console.log(
    `\nK1 at ${k1T.toFixed(2)}s (breath) · K7 at ${endT.toFixed(2)}s · ` +
      `pen carve ${liveCarve === null ? "?" : liveCarve.toFixed(2)}` +
      `${CARVE !== null ? " [forced]" : ""}\n`,
  )
  /* THE LAW THAT PRODUCED THE SET, printed with the count — for the same reason
   * `assert-hero-k7-intact.mjs` refuses to grade an arm that did not switch.
   * How much news there IS is a property of the junction set before it is a
   * property of anything this file measures, so a reader who cannot see which
   * law ran cannot act on the number. (Added 2026-08-01 with `"crossings"`.) */
  console.log(
    `junction law: ${jlaw.law} · sized at carve ${jlaw.carve ?? "?"}\n` +
      `breaks: ${breaks?.junctions ?? 0} junctions published · ${breaks?.opened ?? 0} opened · ` +
      `${breaks?.dropped ?? 0} dropped (no over/under to show) · truncated ${breaks?.truncated ?? "?"}\n`,
  )

  /* ---- 1. the returned pose IS K1's framing ------------------------------ */
  const dW = Math.abs(k1.ink - fused.ink) / Math.max(1, k1.ink)
  record(
    "the RETURN lands on K1's own picture — before the news",
    dW < 0.02,
    `ink px K1 ${k1.ink} vs K7-fused ${fused.ink} (${(dW * 100).toFixed(2)} % apart; needs < 2 %). ` +
      `Both are the flat mark dead-on, so this is what makes the two frames comparable at all.`,
  )

  /* ── EVERY `open`-DEPENDENT JUDGEMENT, IN ONE PLACE ────────────────────────
   *
   * Five rows read the OPEN frame, and all four controls work by handing this
   * function a deliberately wrong one. Factoring it is what makes them controls
   * rather than a second implementation: they grade the same clauses, with the
   * same constants, that the shipped frame is graded by.
   *
   * ⚠ THE TRIMMED STATISTIC, and the calibration is `FLAT_TRIM`'s in
   * lib/flat-interior.mjs rather than restated here. The raw sd was correct
   * until the pen carve landed and then rejected a correct picture: a sub-pixel
   * CONCAVE gap — one the carve opens between two strokes of the "D" — has no
   * mask boundary for the isotropic erosion to work back from, so its
   * antialiasing ramp survives inside a black body and THREE pixels of 4151
   * carry the whole 1.256. Those three are coverage samples, not surface
   * samples. The residue clause beside it is a claim the raw sd never made:
   * the exceptions have to be a hairline, not a shading. */
  function judgeOpen(open) {
    let lost = 0
    let gained = 0
    for (let p = 0; p < fused.mask.length; p++) {
      if (fused.mask[p] && !open.mask[p]) lost++
      else if (!fused.mask[p] && open.mask[p]) gained++
    }
    /* Every pixel that is interior ink in BOTH frames must hold its value. This
     * is the clause a shading fails and an occlusion cannot. */
    let shared = 0
    let moved = 0
    let worst = 0
    for (let p = 0; p < fused.interior.length; p++) {
      if (!fused.interior[p] || !open.interior[p]) continue
      shared++
      const d = Math.abs(fused.luma[p] - open.luma[p])
      if (d > worst) worst = d
      if (d > 2) moved++
    }
    /* `buildJointBreaks` measures, per break, the arc length of under-stroke
     * centreline it removes. The gap is a slab of that length across the stroke,
     * so the predicted area is that length times the ink diameter — converted to
     * pixels through the word's own measured scale. This is the row that would
     * catch the shader and the break table drifting apart. */
    const ratio = predicted > 0 ? lost / predicted : 0
    /* THE SAME REMOVAL, READ AS SHAPES RATHER THAN AS A TOTAL. Run on the masks
     * `flatInterior` already decoded, so this is not a second reading of the same
     * pixels — and it REFUSES a pair of different sizes rather than returning a
     * zero, which is the arithmetic `assert-hero-carve.mjs` shipped until
     * 2026-09-04. */
    const gaps = gapRegionsFromMasks(fused.mask, open.mask, open.W, open.H)
    const perBreak = gaps.refused
      ? []
      : matchToBreaks(gaps.regions, breaks?.cut ?? [], word.ink, scale)
    return {
      gate1: {
        pass: open.sdTrim < FLAT_SD_MAX && open.residue <= open.residueMax && open.n > 0,
        detail:
          `trimmed interior sd ${open.sdTrim.toFixed(3)} over ${open.n} px, residue ` +
          `${open.offModal} px off modal luma ${open.modal} = ${(100 * open.residue).toFixed(4)} % ` +
          `(needs sd < ${FLAT_SD_MAX} and residue <= ${(100 * open.residueMax).toFixed(2)} %). ` +
          `K1 reads trimmed sd ${k1.sdTrim.toFixed(3)}, residue ${(100 * k1.residue).toFixed(4)} %. ` +
          `[raw, not the verdict] open sd ${open.sd.toFixed(3)} spread ${open.spread.toFixed(1)}, ` +
          `K1 sd ${k1.sd.toFixed(3)}. The break removes ink; it may not change the value of any ink ` +
          `that stays.`,
      },
      news: {
        /* ── 🔴 THIS ROW USED TO READ `lost > 200` (corrected 2026-09-04) ─────
         *
         * A TOTAL CANNOT SEE A BREAK, which is the blind spot the sibling gate
         * was written to close one level up: *"Every one of those quantities is
         * a SUM. A sum cannot see a letter come apart."* Two breaks drawing
         * double while a third draws nothing sums the same as three drawing
         * correctly, and 250 px scattered as a hundred antialiasing specks
         * cleared a bar that 172 px of three clean over/unders did not.
         *
         * AND THE BAR SAT ABOVE THE CEILING. `buildJointBreaks` in
         * lib/flat-ink.ts has said so since 2026-08-01: *"One crossing is 97 px
         * of news against `assert-hero-k7-news`'s 200 px floor... SO THE TWO K7
         * GATES CANNOT BOTH HOLD ON THIS JUNCTION SET, and that is a property of
         * the SET, not of the law."* At the shipped law and the shipped carve the
         * table predicts 188 px in total and the render delivers 172 — a ratio of
         * 0.92 that the `area` row below PASSES. Three gates were red on a floor
         * no correct render could reach.
         *
         * THE PICTURE WAS ALWAYS FINE. The three gaps were rendered at 8x and
         * looked at on 2026-09-04 (docs/verification/hero-k7/gaps/): the eye of
         * the `e` in Desk opens, a clean hairline crosses the `D` of Doodles, and
         * the counter of its `e` opens into a slot. Every one an unambiguous
         * over/under, which is what §3 K7 asks for.
         *
         * SO THE CLAIM IS NOW PER BREAK, AND EVERY NUMBER ON BOTH SIDES IS
         * MEASURED. `window.__heroBreaks` publishes `opened` and each break's own
         * `cut`; the frame is asked how many regions of paper it opened and how
         * big each one is. A break that silently fails to draw reddens this row,
         * which no total could do. scripts/verify/lib/joint-break-gaps.mjs. */
        pass:
          gaps.refused === null &&
          gaps.regions.length === (breaks?.opened ?? -1) &&
          perBreak.length > 0 &&
          perBreak.every((b) => b.ratio > 0.6 && b.ratio < 1.4),
        detail: gaps.refused
          ? `REFUSED — ${gaps.refused}`
          : `${gaps.regions.length} gap(s) of paper against ${breaks?.opened ?? "?"} breaks the ` +
            `table opened (must be equal), ${lost} px in total. Per break, its own \`cut\` ` +
            `predicted against the region it drew: ` +
            perBreak
              .map((b) => `${b.predicted.toFixed(0)}->${b.measured} (${b.ratio.toFixed(2)})`)
              .join(" · ") +
            `, each needs 0.6-1.4. Crumbs ${gaps.crumbs} (${gaps.crumbPx} px). Without this the ` +
            `beat's last shot is a picture the audience already saw, and two of the seven key ` +
            `shots are one key shot.`,
      },
      gained: {
        pass: gained === 0,
        detail:
          `paper -> ink ${gained} px (needs 0). An occlusion can only ever take ink away; a fade, ` +
          `a wash or a drawn outline all put something back.`,
      },
      value: {
        pass: shared > 1000 && moved === 0,
        detail:
          `${shared} interior px in both frames, ${moved} moved by more than 2 luma, worst delta ` +
          `${worst.toFixed(2)}. A shading changes the ink; an occlusion only decides whether there ` +
          `IS ink.`,
      },
      area: {
        pass: ratio > 0.6 && ratio < 1.4,
        detail:
          `predicted ${predicted.toFixed(0)} px (${cutTotal.toFixed(1)} units of centreline x ` +
          `${word.ink.toFixed(1)} ink, at ${scale.toFixed(4)} px/unit), measured ${lost} px, ` +
          `ratio ${ratio.toFixed(2)} (needs 0.6-1.4). The band is a slab across the stroke, so its ` +
          `area is arc length x diameter; the tolerance is the two rounded ends and the antialiased edge.`,
      },
    }
  }

  const spanPx = (() => {
    let minX = Infinity
    let maxX = -Infinity
    for (let y = 0; y < k1.H; y++)
      for (let x = 0; x < k1.W; x++)
        if (k1.mask[y * k1.W + x]) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
        }
    return maxX - minX + 1
  })()
  const scale = spanPx / (word.spanX + word.ink)
  const cutTotal = (breaks?.cut ?? []).reduce((a, b) => a + b.cut, 0)
  const predicted = cutTotal * word.ink * scale * scale

  const NEWS = "K7 IS MEASURABLY DIFFERENT FROM K1 — the round trip says something"
  const AREA = "the ink lost MATCHES the break model — the shader and the table agree"
  const GATE1 = "GATE 1 HOLDS ON THE RETURNED FLAT — one value inside a hard silhouette"
  const VALUE = "  ...and every ink pixel that SURVIVES keeps its exact value"

  const R = judgeOpen(open)
  record(GATE1, R.gate1.pass, R.gate1.detail)
  record(NEWS, R.news.pass, R.news.detail)
  record("  ...and the change is INK -> PAPER ONLY. Nothing gained, nothing re-valued", R.gained.pass, R.gained.detail)
  record(VALUE, R.value.pass, R.value.detail)
  record(AREA, R.area.pass, R.area.detail)

  /* ---- 6. nothing fell off the end of the shader's array ---------------- */
  record(
    "every junction with news to tell REACHED the shader",
    breaks !== null && breaks.truncated === 0,
    `truncated ${breaks?.truncated ?? "no readout"} (needs 0). The array bound is a compile-time ` +
      `constant, so overflow is published rather than swallowed.`,
  )

  record(
    "console clean",
    errors.length === 0,
    `${errors.length} errors${errors.length ? ": " + errors[0] : ""}`,
  )

  /* ---- THE FOUR CONTROLS, ON THE BARE INVOCATION ------------------------
   *
   * Each hands `judgeOpen` a deliberately wrong OPEN frame and requires the rows
   * NAMED FOR IT to go red. The required-red table is unchanged — it was already
   * written, it was simply behind `--mutate=`, which nothing passed.
   *
   * Naming the target rows rather than accepting "something went red" is
   * load-bearing here: `shade` must break VALUE and must NOT break GATE 1, and
   * that asymmetry is the file's own finding — a uniform re-value has no spread,
   * so a control that reddened everything would have deleted the thing this file
   * knows about its own statistic.
   *
   * The control arms' rows are NOT echoed. They are red on purpose and both
   * battery runners count an indented `FAIL`, so echoing them would post this
   * gate's evidence as its failures (Lane I, `assert-hero-transition`). */
  const CONTROLS = [
    {
      name: "nobreak",
      why: "the break channel never opened — the fused frame wearing K7's name",
      open: fused,
      mustFail: ["news", "area"],
      mustHold: ["gate1", "value"],
    },
    {
      name: "shade",
      why: "a 0.35 SHADING instead of an occlusion — ink re-valued rather than removed",
      open: openShade,
      // NOT gate 1 — a uniform re-value has no spread. See the header.
      mustFail: ["value"],
      mustHold: ["gate1"],
    },
    {
      name: "wash",
      why: "the removed ink put back LIGHTENED but still ink — a value difference AT the crossings",
      open: pixelSide("wash"),
      mustFail: ["gate1", "value"],
      mustHold: [],
    },
    {
      name: "alpha",
      why: "the removed ink put back at HALF alpha — still under the ink threshold",
      open: pixelSide("alpha"),
      mustFail: ["news", "area"],
      mustHold: [],
    },
  ]
  const KEY_NAME = { gate1: GATE1, news: NEWS, value: VALUE, area: AREA, gained: "INK -> PAPER ONLY" }
  for (const c of CONTROLS) {
    const j = judgeOpen(c.open)
    const stillGreen = c.mustFail.filter((k) => j[k].pass)
    const brokeTooMuch = c.mustHold.filter((k) => !j[k].pass)
    const ok = stillGreen.length === 0 && brokeTooMuch.length === 0
    if (!ok) failures++
    console.log(
      `${ok ? "PASS" : "FAIL"}  CONTROL · KNOWN-BAD \`${c.name}\` — ${c.why} — is REJECTED by ` +
        `${c.mustFail.map((k) => KEY_NAME[k]).join(" + ")}`,
    )
    console.log(
      `      required red: ${c.mustFail.map((k) => `${k}=${j[k].pass ? "STAYED GREEN ✗" : "red ✓"}`).join(" · ")}` +
        (c.mustHold.length
          ? `  ·  required to SURVIVE it: ${c.mustHold.map((k) => `${k}=${j[k].pass ? "held ✓" : "BROKE ✗"}`).join(" · ")}`
          : "") +
        (ok ? "" : " — THIS GATE CANNOT TELL THE DIFFERENCE"),
    )
    console.log(`      ${c.mustFail.map((k) => j[k].detail.split(".")[0]).join(" | ")}`)
  }

  console.log(`\n${failures === 0 ? "all rows passed" : `${failures} FAILED`}`)
  console.log(`frames: ${OUT}`)
  process.exit(failures ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
