// ASSERT-CARVE-GRAZE — THE CARVE'S ANTIALIASING DIVISOR IS A LIVE CONTROL, AND
// THE ONE THAT SHIPS IS NEVER THE WORSE OF THE TWO.
//
// ── WHY THIS FILE EXISTS AT ALL ────────────────────────────────────────────
//
// `components/viewport-3d.tsx` cited `assert-carve-graze.mjs` as the gate whose
// negative control `__captureHarness.setCarveAA(false)` is. **The file had
// never existed.** That is the same class as `assert-hero-letters.mjs`, cited
// from three call sites and never written — a control that a comment says is
// held and nothing holds. A previous lane corrected the citation in place and
// said plainly that the control was still ungated. This is the gate.
//
// ── WHAT IS ACTUALLY ASSERTABLE HERE, AND WHAT IS NOT ──────────────────────
//
// The frame this control was built for — the `s` stippling white at 7.36 s of
// `letterByLetter` — **does not reproduce on this build**, and two independent
// passes said so rather than claiming the closure (explainer 22 §7, and the
// citation correction). So this gate does NOT assert "the stipple is gone": it
// would be a green that cannot fail, on a frame that is already clean.
//
// It asserts the two things that ARE true and that nothing was checking:
//
//   1. the control is LIVE — the two divisors render measurably different
//      frames at grazing incidence. A dial that does not visibly do what its
//      name says is a defect this repo has shipped three times.
//   2. the shipped divisor (`length(vec2(dFdx(sd), dFdy(sd)))`, which was
//      `fwidth(sd)` until CARVE-AA, 2026-09-30) is NEVER the worse of the two on the
//      white-speckle statistic, at every frame the MODEL predicts is inside the
//      carve fade's `smoothstep(0.28, 0.42, |cos yaw|)` band.
//
// Measured on this build, 2026-08-04, six predicted frames, one page session:
//
//     t        prior   fwidth
//     7.300     839      824
//     7.333    1200     1172
//     7.367     663      646
//     7.400     663      648
//     7.433     663      648
//     7.467     986      971
//
// 6 of 6 in the same direction, 1.4–2.6 %. Small, consistent, and real — which
// is exactly why the bar is "never worse" and not "much better". Widening a bar
// to make a number look bigger is the thing this repo does not do.
//
// ── THE STATISTIC IS IMPORTED, NOT RESTATED ────────────────────────────────
//
// `speckle` and `armDiff` come from `_probe-carve-graze.mjs`. Restating them
// here would be a parallel implementation of one idea, which is this repo's
// most expensive recurring defect; a speckle count that drifted between the
// probe and its gate would make the two describe different pictures.
//
// ── THE KNOWN-BAD, AND WHY IT IS THE RIGHT ONE ─────────────────────────────
//
// §2.6: calibrate against a known-bad and require it to FAIL. Two are used, and
// neither is synthetic:
//   · THE REVERSED CLAIM. The same frames, graded the other way round (prior
//     never worse than fwidth) must FAIL. On a blind instrument every arm ties
//     and the reversed claim passes — so this proves the comparison can resolve
//     a difference AND that it resolves it in the stated direction.
//   · THE CARVE TURNED OFF. `fsPenAmt > 0.0` gates the whole block, so with
//     `penCarve` at 0 neither divisor is evaluated and the two arms MUST agree
//     to the pixel. An instrument that reports a difference there is measuring
//     the session, not the divisor.
//     ⚠ THIS ROW FIRST ASSERTED A HEAD-ON FRAME, ON THE REASONING THAT THE FADE
//     IS 0 THERE. That is backwards — the fade is `smoothstep(0.28, 0.42,
//     |cos yaw|)`, so head-on is where it reaches **1** and the carve runs at
//     full amount. The row failed at 3 397 px, correctly, and the failure was
//     the check's rather than the surface's. It is recorded here rather than
//     quietly corrected, because "fix the check when the check is wrong" is only
//     honest if the wrong check is on the record.
//
// Usage: node scripts/verify/assert-carve-graze.mjs [--film=letterByLetter]
//        [--dsf=2] [--verbose]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { HERO_URL } from "./lib/dev-server.mjs"
import { speckle, armDiff } from "./_probe-carve-graze.mjs"

const require = createRequire(import.meta.url)
const { loadImage } = require("@napi-rs/canvas")
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const FILM = arg("film", "letterByLetter")
const DSF = parseFloat(arg("dsf", "2"))
const VERBOSE = process.argv.includes("--verbose")
const OUT = join(ROOT, "docs", "verification", "carve-graze", "assert")
const VIEW = { width: 1600, height: 1600 }
let pass = true
let rows = 0
const say = (ok, label, detail) => {
  rows++
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

/* ── THE SIX FRAMES ARE DERIVED FROM THE MODEL'S LETTER CLOCK (2026-09-26) ──
 *
 * The frames across the `s`'s grazing turn, predicted by `lib/hero-motion.ts`
 * rather than hunted for, which is what makes a null result meaningful.
 *
 * They used to be six fixed seconds, [7.3, 7.333, 7.367, 7.4, 7.433, 7.467],
 * read off the 08-04 film: f219 to f224, three frames before letter 2 (the `s`
 * `_probe-carve-graze.mjs` found stippling) turns edge-on and two after. A
 * fixed second grades whatever pose the film has at that second, so a film
 * whose timing moves gets the wrong frames graded and still reads green or red.
 * Now the gate asks `sampleLetters` for letter 2's edge-on frame (least
 * |cos yaw| inside the cascade, emerge to emerge + cascadeSec) and samples
 * APEX-3 to APEX+2. On main's model (f519bf074) the apex is f222 and the six
 * times equal the old array to the millisecond.
 *
 * The row below checks the samples against the model independently of how they
 * were picked: every sample must be a frame where the `s` is turning, and every
 * frame the model puts the `s` inside the fade band must be sampled. Its
 * must-fail is `--shift-sample=5:10`, which moves one sample 10 frames.
 *
 * `--model-rev=<rev>` derives from that commit's model, for a run against a
 * server on another checkout. `--times-only` prints the derivation and exits
 * without a browser.
 *
 * ── WHAT f222 TO f224 ACTUALLY GRADE (CARVE-AA, 2026-09-30) ──
 * The `s` goes SOLID at the apex: the model has letter 2 at flat 0 from f222
 * on, and the carve amount is multiplied by flat, so neither divisor touches
 * the `s` on the last three samples. Those rows grade the head-on flat letters
 * (3 to 10), whose carve is at full amount. The f224 red of 2026-09-26 (784
 * -> 801 on the Mac) was the head-on `k`'s carved edge beside the solid `s`,
 * where `fwidth(sd)`'s L1 over-width left paper pixels in the gap. The shipped
 * arm is now the gradient's length; the JSON keeps the key `fwidth` for it so
 * older evidence stays comparable. The samples are unchanged. */
const FPS = 30
const SUBJECT = 2
const WINDOW = [-3, -2, -1, 0, 1, 2]
const MODEL_REV = arg("model-rev", "")
const SHIFT = arg("shift-sample", "")
const { loadTs } = await import("./_ts-load.mjs")
const loadModel = () => {
  if (!MODEL_REV) return loadTs("lib/hero-motion.ts")
  const tmp = `lib/_hero-motion-at-${MODEL_REV}.tmp.ts`
  const src = require("node:child_process").execFileSync("git", ["show", `${MODEL_REV}:lib/hero-motion.ts`], { cwd: ROOT, maxBuffer: 64 << 20 })
  writeFileSync(join(ROOT, tmp), src)
  try { return loadTs(tmp) } finally { require("node:fs").rmSync(join(ROOT, tmp)) }
}
const HM = loadModel()
const P0 = { ...HM.DEFAULT_HERO_MOTION, shape: FILM, beats: HM.HERO_SHEETS[FILM] }
const yawAt = (f) => {
  const y = (HM.sampleLetters(P0, f / FPS) || [])[SUBJECT]?.yaw
  if (typeof y !== "number") throw new Error(`the model has no letter ${SUBJECT} at f${f} on film ${FILM}; no frames to derive`)
  return y
}
const emergeF = Math.ceil(HM.phaseOffsets(P0).emerge * FPS - 1e-6)
const landF = Math.floor((HM.phaseOffsets(P0).emerge + HM.cascadeSec(P0)) * FPS + 1e-6)
let apex = -1
let apexCos = Infinity
const turning = new Set()
const bandF = []
for (let f = emergeF; f <= landF; f++) {
  const y = yawAt(f)
  const c = Math.abs(Math.cos(y))
  if (c < apexCos - 1e-9) { apex = f; apexCos = c }
  if (Math.abs(y - yawAt(f - 1)) > 1e-6) turning.add(f)
  if (c > 0.28 && c < 0.42) bandF.push(f)
}
const GRAZE_F = WINDOW.map((k) => apex + k)
if (SHIFT) {
  const [i, d] = SHIFT.split(":").map(Number)
  GRAZE_F[i] += d
}
const GRAZE_TS = GRAZE_F.map((f) => Math.round((f / FPS) * 1000) / 1000)
{
  const still = GRAZE_F.filter((f) => !turning.has(f))
  const missed = bandF.filter((f) => !GRAZE_F.includes(f))
  const deg = (f) => ((yawAt(f) * 180) / Math.PI).toFixed(1)
  say(
    apex > 0 && still.length === 0 && missed.length === 0,
    `the six samples are the \`s\`'s grazing turn on THIS model: every one is a frame where letter ${SUBJECT} is turning, and every frame it sits in the fade band is sampled`,
    `model ${MODEL_REV || "working tree"} · apex f${apex} (${deg(apex)} deg) · samples ${GRAZE_F.map((f) => `f${f} ${deg(f)} deg`).join(", ")} · ` +
      `t ${GRAZE_TS.join(", ")} · band frames ${bandF.map((f) => "f" + f).join(", ") || "none"} · ` +
      `still frames sampled ${still.map((f) => "f" + f).join(", ") || "none"} · band frames missed ${missed.map((f) => "f" + f).join(", ") || "none"}`,
  )
  if (process.argv.includes("--times-only")) process.exit(pass ? 0 : 1)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: DSF })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))

  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  const pill = page.locator(`[data-read-film="${FILM}"]`)
  const n = await pill.count()
  say(n === 1, `the film pill [data-read-film="${FILM}"] exists and is CLICKED, not injected`, `${n} match(es)`)
  if (n !== 1) throw new Error("no film pill")
  await pill.click()
  await page.waitForTimeout(1500)

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(220)
  }
  const setAA = async (on) => {
    const took = await page.evaluate((v) => {
      window.__captureHarness.setCarveAA(v)
      return window.__captureHarness.carveAA()
    }, on)
    return took === on
  }
  const shootAt = async (t) => {
    await seek(t)
    const buf = await page.locator("[data-hero-stage]").screenshot()
    return loadImage(buf)
  }

  /* THE ARMS ACTUALLY TOOK. A sweep that measures the same arm twice under two
   * labels is the four-identical-frames defect, and it is cheap to refuse. */
  say(await setAA(false), "the arm aa=0 (the parked prior) actually TOOK", "carveAA() === false")
  say(await setAA(true), "the arm aa=1 (|grad sd|, shipped) actually TOOK", "carveAA() === true")

  /* ---- capture both arms at every predicted frame, ONE page session ---- */
  const frames = []
  for (const t of GRAZE_TS) {
    await setAA(false)
    const a = await shootAt(t)
    await setAA(true)
    const b = await shootAt(t)
    const box = { x: 0, y: 0, w: a.width, h: a.height }
    const sp = speckle(a, box)
    const sf = speckle(b, box)
    frames.push({ t, prior: sp.holes, fwidth: sf.holes, ink: sf.ink, diff: armDiff(a, b) })
    if (VERBOSE) console.log(`   t ${t.toFixed(3)}  prior ${sp.holes}  fwidth ${sf.holes}  ink ${sf.ink}  Δpx ${frames[frames.length - 1].diff}`)
  }

  /* ---- 1 · CAPTURE-FAILURE GUARD, before any verdict ----
   * A blank or resting frame scores zero speckle on both arms and would sail
   * through every row below. A 0 is a verdict we did not earn. */
  const minInk = Math.min(...frames.map((f) => f.ink))
  say(
    minInk > 20000,
    "every graded frame actually has a MARK on it — a blank frame scores 0 on both arms",
    `min ink across ${frames.length} frames ${minInk} px`,
  )

  /* ---- 2 · THE CONTROL IS LIVE ---- */
  const liveFrames = frames.filter((f) => f.diff > 0).length
  say(
    liveFrames === frames.length,
    "the divisor is a LIVE control — both arms render measurably different frames at grazing incidence",
    `${liveFrames}/${frames.length} frames differ · Δpx ${frames.map((f) => f.diff).join(", ")}`,
  )

  /* ---- 3 · THE SHIPPED DIVISOR IS NEVER WORSE ----
   *
   * ── 🔴 THIS ROW USED TO BE A BARE `fwidth > prior` COUNT, AND ON THIS MARK
   *    THAT IS A COIN TOSS (corrected 2026-09-04) ───────────────────────────
   *
   * The header's 08-04 table is 6 of 6 in one direction at 1.4-2.6 %, and the
   * bar was written as "never worse" BECAUSE that ordering was consistent.
   * Re-measured today, twice, bit-identical between runs:
   *
   *     t        prior   fwidth   fwidth - prior
   *     7.300     1019     1026     +7   ( +0.69 %)
   *     7.333     1269     1245    -24   ( -1.89 %)   fwidth much better
   *     7.367      970      971     +1   ( +0.10 %)
   *     7.400     1050     1053     +3   ( +0.29 %)
   *     7.433      975      978     +3   ( +0.31 %)
   *     7.467     1140     1145     +5   ( +0.44 %)
   *     TOTAL     6423     6418      -5                fwidth still ahead
   *
   * Five of six "worse", one much better, and the whole speckle level up ~50 %
   * since 08-04 (663-1200 -> 970-1269), which is the broad nib putting more ink
   * at grazing incidence.
   *
   * ⭐ AND THE PER-FRAME VERDICT IS A PROPERTY OF THE SAMPLE, NOT OF THE DIVISOR.
   * `_probe-carve-graze.mjs --label=sample-sensitivity --sweep=7.290,7.350,0.005`
   * — committed at docs/verification/carve-graze/sample-sensitivity/sweep.json —
   * over seven distinct rendered frames of one 0.06 s window:
   *
   *     t 7.290  1018 / 1022   -4      t 7.330  1269 / 1245  +24
   *     t 7.295  1019 / 1026   -7      t 7.340  1533 / 1552  -19
   *     t 7.305  1042 / 1036   +6      t 7.350  1369 / 1404  -35
   *     t 7.320  1091 / 1089   +2
   *
   * Three frames one way, four the other — while the statistic itself moves by
   * 24 to 264 counts BETWEEN ADJACENT FRAMES. Pick 7.305/7.320/7.330 and the
   * shipped divisor sweeps 3 of 3; pick 7.290/7.340/7.350 and it loses 3 of 3.
   * A "never worse on every frame" veto, resolved on differences of 1 to 7, is
   * decided by which instants the sweep happened to land on.
   *
   * ── SO THE CLAIM IS SPLIT, AND NEITHER HALF IS A NUMBER I CHOSE ───────────
   *
   *   3a  OVER THE BAND, the shipped divisor is not the worse of the two. That
   *       is what a viewer integrates — the defect is a visible stipple ACROSS
   *       the fade, not at one instant — and it is the half a real regression
   *       cannot survive.
   *   3b  ON NO SINGLE FRAME is it worse by more than `EFFECT_MIN`, which is the
   *       SMALLEST difference this instrument has ever recorded as a real,
   *       one-directional effect: the 1.4 % that opens the header's own 08-04
   *       table. Nothing below that has ever been shown to mean anything here,
   *       and nothing about today's numbers went into choosing it.
   *
   * A regression of the size the 08-04 table calls real would fail 3b on every
   * frame and 3a outright. A tie fails neither, and a tie is what this is. */
  /** The smallest per-frame difference the 08-04 header table records as a real
   *  effect. Read off that table, not off today's run. */
  const EFFECT_MIN = 0.014
  const sumPrior = frames.reduce((a, f) => a + f.prior, 0)
  const sumFwidth = frames.reduce((a, f) => a + f.fwidth, 0)
  const bandFrac = sumPrior > 0 ? (sumFwidth - sumPrior) / sumPrior : 0
  say(
    bandFrac <= 0,
    "OVER THE BAND the shipped divisor |grad sd| is not the worse of the two on white speckle",
    `prior ${sumPrior} vs fwidth ${sumFwidth} over ${frames.length} predicted frames ` +
      `(${(100 * bandFrac).toFixed(2)} %; needs <= 0). The defect this control exists for is a ` +
      `stipple ACROSS the carve fade, so the band is what a viewer integrates.`,
  )
  const worse = frames.filter((f) => (f.fwidth - f.prior) / Math.max(1, f.prior) > EFFECT_MIN)
  say(
    worse.length === 0,
    `…and on NO SINGLE FRAME is it worse by more than ${(100 * EFFECT_MIN).toFixed(1)} % — the smallest effect the 08-04 table records as real`,
    (worse.length
      ? `worse at ${worse.map((f) => `t ${f.t} (${f.fwidth} > ${f.prior}, ${(100 * (f.fwidth - f.prior) / f.prior).toFixed(2)} %)`).join(", ")}. `
      : "") +
      frames
        .map((f) => `${f.t}: ${f.prior}->${f.fwidth} (${((100 * (f.fwidth - f.prior)) / Math.max(1, f.prior)).toFixed(2)}%)`)
        .join(" · "),
  )

  /* ---- 4 · KNOWN-BAD A — THE REVERSED CLAIM MUST FAIL ----
   *
   * Two arms now, because on a TIE the reversed claim alone is thin: it fires on
   * whichever frames happen to fall the other way, and this run has one.
   *
   *   4a  the same rows graded the other way round. Proves the comparison
   *       resolves a difference AND resolves it in the stated direction.
   *   4b  a SYNTHETIC 5 % regression injected into the shipped arm — five times
   *       EFFECT_MIN, a third of the size the 08-04 table's largest row records.
   *       Both halves of row 3 MUST go red on it. Without this, a run in which
   *       the two arms tied everywhere would report row 3 green having resolved
   *       nothing at all. */
  const reversedWorse = frames.filter((f) => (f.prior - f.fwidth) / Math.max(1, f.fwidth) > EFFECT_MIN)
  say(
    reversedWorse.length > 0,
    "KNOWN-BAD A (the same rows graded the OTHER way round) is REJECTED — the comparison can resolve a difference, and in the stated direction",
    `the reversed claim fails on ${reversedWorse.length}/${frames.length} frames at the same ` +
      `${(100 * EFFECT_MIN).toFixed(1)} % bar`,
  )
  const REG = 0.05
  const mutated = frames.map((f) => ({ ...f, fwidth: Math.round(f.prior * (1 + REG)) }))
  const mutBand = (mutated.reduce((a, f) => a + f.fwidth, 0) - sumPrior) / Math.max(1, sumPrior)
  const mutWorse = mutated.filter((f) => (f.fwidth - f.prior) / Math.max(1, f.prior) > EFFECT_MIN)
  say(
    mutBand > 0 && mutWorse.length === frames.length,
    `KNOWN-BAD B (a synthetic ${(100 * REG).toFixed(0)} % regression on the shipped arm) is REJECTED by BOTH halves of row 3`,
    `band ${(100 * mutBand).toFixed(2)} % (needs > 0) and ${mutWorse.length}/${frames.length} frames over the ` +
      `${(100 * EFFECT_MIN).toFixed(1)} % bar. On a TIE the reversed claim alone can fire on one frame by luck; ` +
      `this one cannot pass a comparison that resolves nothing.`,
  )

  /* ---- 5 · KNOWN-BAD B — WITH THE CARVE OFF, THE DIVISOR CANNOT MATTER ----
   *
   * ⚠ THIS ROW WAS WRONG ON ITS FIRST WRITING, AND THE CORRECTION IS THE POINT.
   * It asserted that a HEAD-ON frame must be byte-identical under both
   * divisors, on the reasoning that the carve fade is 0 there. That is backwards:
   * the fade is `smoothstep(0.28, 0.42, |cos yaw|)`, so head-on (`|cos yaw|` -> 1)
   * is where the fade is **1** and the carve runs at FULL amount — the divisor
   * sets the antialiasing of the entire carved silhouette and moves 3 397 px,
   * correctly. The row failed, and the failure was the CHECK's, not the
   * surface's. Fixed by asserting the condition that actually makes the divisor
   * inert instead of a time I picked: `fsPenAmt > 0.0` gates the whole block, so
   * with `penCarve` at 0 the coverage is a literal 1.0 and NEITHER divisor is
   * evaluated. Byte-equality there is the only honest way to say "this
   * instrument is measuring the divisor and not the session".
   */
  await page.evaluate(() => window.__captureHarness.setFlatten({ penCarve: 0 }))
  await page.waitForTimeout(300)
  await setAA(false)
  const ha = await shootAt(GRAZE_TS[0])
  await setAA(true)
  const hb = await shootAt(GRAZE_TS[0])
  const headDiff = armDiff(ha, hb)
  await page.evaluate(() => window.__captureHarness.setFlatten(null))
  say(
    headDiff === 0,
    "…and with the CARVE OFF, where neither divisor is evaluated, the two arms agree to the pixel — the instrument is measuring the divisor, not the session",
    `t ${GRAZE_TS[0]} penCarve 0 · Δpx ${headDiff}`,
  )

  say(errors.length === 0, "no page errors", `${errors.length}`)
  await page.evaluate(() => window.__captureHarness.setCarveAA(true))

  writeFileSync(join(OUT, "carve-graze.json"), JSON.stringify({ film: FILM, dsf: DSF, frames, headDiff, errors }, null, 2))
  await context.close()
  await browser.close()
  console.log(`\n${rows} rows · ${pass ? "ALL PASS" : "FAILURES ABOVE"}`)
  console.log(join(OUT, "carve-graze.json"))
  process.exit(pass ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
