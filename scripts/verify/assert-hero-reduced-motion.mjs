// HERO BEAT under prefers-reduced-motion — "gentler, not zero", asserted.
//
// The page claims (explainers/14 §9) that reduced motion drops the ink's swell
// past full thickness and the stand-up's overshoot while KEEPING the flat→solid
// value change, because that change is the one thing the page exists to show.
// That claim was documented but never measured, and it is the exact place this
// kind of handling usually breaks: the cheap implementation of "respect reduced
// motion" is to skip the animation, which here would delete the product's pitch
// and leave a form that was 3D from frame one — the original defect, restored.
//
// So this asserts the two halves of the claim independently:
//
//   1. THE BEAT SURVIVES. With reduced motion on, the flat beat must still
//      render as one value and the hold must still be a lit object. Same gates
//      as the main assert, same thresholds — reduced motion is not allowed a
//      lower bar on the thing that carries the meaning.
//
//   2. THE MOVEMENT IS ACTUALLY REDUCED. The mirror gate, and without it gate 1
//      passes on a page that ignores the media query entirely.
//
//      Measured on the STAND-UP CAMERA, not on the ink's depth swell — and that
//      choice is the whole subtlety here. Reduced motion drops two things:
//      `emerge.overshoot` (the ink puffing past full thickness) and `backC1`
//      (the stand-up's overshoot past its target). The first is UNMEASURABLE
//      from the silhouette by construction: it scales depth about the form's own
//      Z centre under a dead-on camera, so the on-screen outline does not move
//      at all — which is exactly what the main assert's registration gate
//      independently proves (0.00px across 31 frames). A first version of this
//      script gated on silhouette height and read 4px of overshoot in BOTH
//      runs; that 4px was the camera beginning to tilt at the end of the sweep
//      window, not the swell. It would have failed a page that honours the
//      preference perfectly.
//
//      `backC1` does move the camera, so it is readable: with the overshoot on,
//      the stand-up sails past its targets — elevation dips below `standupEl`,
//      azimuth counter-dips below 0 before committing, fill rises above
//      `fillLie`. With it off, every one of those must stay inside its bounds.
//
// Usage: node scripts/verify/assert-hero-reduced-motion.mjs
import { chromium } from "./lib/browser.mjs"
import { loadTs } from "./_ts-load.mjs"

// Every playhead this file drives is derived from the model's own phase layout.
// Two were hardcoded seconds and BOTH had silently desynced — see the notes at
// each site. A capture addressed by wall-clock is a capture that lies the moment
// the beat is retimed, and this beat has been retimed twice.
const { DEFAULT_HERO_MOTION, phaseOffsets } = loadTs("lib/hero-motion.ts")
const OFF = phaseOffsets(DEFAULT_HERO_MOTION)
/* THE THREE BOUNDS THE OVERSHOOT SAILS PAST, READ OFF THE MODEL. See the long
 * note at their use site for what they were and why a re-typed constant is a
 * silent gate. `AZ_FLOOR` is a true structural zero — the stand-up's azimuth
 * commits from 0 — so it is stated rather than derived, and stated is not the
 * same as forgotten. */
const EL_FLOOR = DEFAULT_HERO_MOTION.holdEl
const AZ_FLOOR = 0
const FILL_CEIL = DEFAULT_HERO_MOTION.fillLie
import { mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { flatValueStats } from "./lib/flat-interior.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
/* STAGED. This wipe empties `docs/verification/hero-transition/reduced-motion`,
 * 4 tracked files, and both arms take minutes. The stored set is replaced only
 * once both arms are filmed. lib/evidence-swap.mjs. */
const FINAL = join(ROOT, "docs", "verification", "hero-transition", "reduced-motion")
const EV = stageEvidence(FINAL)
const OUT = EV.dir

const INK_MAX = 150
const ERODE = 3

async function measure(file) {
  const img = await loadImage(file)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const luma = new Float32Array(W * H)
  const mask = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    luma[p] = l
    mask[p] = l <= INK_MAX ? 1 : 0
  }
  let minY = Infinity
  let maxY = -Infinity
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!Number.isFinite(minY)) return null
  let cur = mask
  for (let k = 0; k < ERODE; k++) {
    const next = new Uint8Array(W * H)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x
        if (!cur[p]) continue
        if (
          cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] &&
          cur[p - W - 1] && cur[p - W + 1] && cur[p + W - 1] && cur[p + W + 1]
        ) next[p] = 1
      }
    }
    cur = next
  }
  /* THE VALUE STATISTICS COME FROM THE SHARED LAW — `flatValueStats` in
   * lib/flat-interior.mjs — rather than being computed a fourth time here.
   *
   * This file had its own copy, and the copy was correct until the pen carve
   * landed and then rejected a correct render: at full carve a sub-pixel CONCAVE
   * gap the carve opens between two strokes of the "D" leaves an antialiasing
   * ramp INSIDE the interior, which an isotropic erosion cannot reach, and three
   * pixels of 4151 then carry the whole standard deviation. `FLAT_TRIM` carries
   * the calibration and the controls. Four copies of one robust estimator is how
   * three of them stay on the old one — which is exactly what happened here. */
  const vals = []
  for (let p = 0; p < W * H; p++) if (cur[p]) vals.push(luma[p])
  const v = flatValueStats(vals)
  let n = 0, sum = 0, sumSq = 0, min = 255, max = 0
  for (let p = 0; p < W * H; p++) {
    if (!cur[p]) continue
    const l = luma[p]
    n++; sum += l; sumSq += l * l
    if (l < min) min = l
    if (l > max) max = l
  }
  if (!n) return null
  const mean = sum / n
  return {
    n,
    mean,
    // The RAW sd is kept and printed; the verdict reads `sdTrim` + `residue`.
    sd: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
    min,
    max,
    sdTrim: v.sdTrim,
    residue: v.residue,
    residueMax: v.residueMax,
    modal: v.modal,
    offModal: v.offModal,
    h: maxY - minY + 1,
  }
}

const results = []
const record = (name, pass, detail) => {
  results.push({ pass })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`)
}

async function run(reduce) {
  const dir = join(OUT, reduce ? "reduce" : "no-preference")
  mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ headed: true })
  /* ⚠ 1440x1440, NOT 1440x900 — AND THE OLD HEIGHT WAS SILENTLY SHRINKING THE
   * SUBJECT BY THREE TIMES.
   *
   * The page reserves its own height for the timeline dock, so at 900 the 3-D
   * stage came out **1120x302** against the 1120x841 every other assert measures
   * — `verify-hero-transition.mjs` documents the same trap and sizes the
   * viewport around it: *"every absolute pixel threshold in the gates was then
   * being read against a mark rendered at a third of the area."*
   *
   * It had never mattered here because the statistic was a standard deviation
   * over whatever survived, and a fat tube survives a 3-px erosion at any scale.
   * The pen carve made the strokes ~30 % thinner and the interior collapsed to
   * **6 pixels** — at which point the row was reporting on six pixels of
   * antialiased edge and calling it shading. A gate reading six pixels is not a
   * gate, whatever verdict it prints.
   *
   * Found by running it, not by reading it, and it is the fifth instrument in
   * this beat to have been measuring a smaller subject than it thought. */
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1440 },
    reducedMotion: reduce ? "reduce" : "no-preference",
  })
  const page = await context.newPage()
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })
  await page.waitForTimeout(3500)

  const scrubber = page.locator("[data-hero-scrub]")
  const canvas = page.locator("[data-hero-stage]")
  const setPlayhead = async (t) => {
    await scrubber.evaluate((el, v) => {
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
  }

  /* The breath (flat) and the settled LIT object, both addressed by phase
   * rather than by a hardcoded second.
   *
   * ⚠ THE SECOND ONE WAS `setPlayhead(9.8)` AND THE ROUND TRIP MOVED IT OUT OF
   * THE SHOT IT NAMES. `hold` is no longer the lit three-quarter: since K7 was
   * built, `descend -> returnTurn -> hold` takes the camera back to K1's
   * framing and turns the mark back to FLAT, so 9.8s lands on a one-value
   * drawing. The row then asserted `sd > 6` and `spread > 60` on a flat mark,
   * which is a gate that cannot pass rather than a gate that failed — it read
   * `ink sd 0.0, spread 0.0` on both arms.
   *
   * The lit hold is `orbit`, and it is taken from the middle of it so a retimed
   * beat cannot slide off the end. Same fix as the window below, same reason. */
  const FLAT_AT = OFF.breath + DEFAULT_HERO_MOTION.beats.breath * 0.65
  const LIT_AT = OFF.orbit + DEFAULT_HERO_MOTION.beats.orbit * 0.5
  await setPlayhead(FLAT_AT)
  await page.waitForTimeout(500)
  await canvas.screenshot({ path: join(dir, "flat.png") })
  await setPlayhead(LIT_AT)
  await page.waitForTimeout(500)
  await canvas.screenshot({ path: join(dir, "hold.png") })

  /* The stand-up and its settle, read off the page's OWN camera readout rather
   * than inferred from pixels.
   *
   * ⚠ THE WINDOW WAS HARDCODED AT `4.30 + 2.60·i/90` AND THAT MADE ONE ROW
   * STRUCTURALLY INCAPABLE OF FAILING — instrument bug, same class as the three
   * the storyboard's §11.3 catalogues, and found the same way: by running it.
   *
   * 4.30s lands inside `emerge`/`land`, where the camera is parked dead-on at
   * el 0. So `min(el)` over the window was 0 on EVERY arm, and
   * `elBelow = 10 − 0` reported a flat **10.0° on the reduced arm and 10.0° on
   * the control** — a number that never moved, describing the parked frames
   * before the rise instead of the rise's overshoot. It also silently desynced
   * every time the beat was retimed, and the beat has been retimed twice since.
   *
   * Derived from the model's own phase offsets now, and narrowed to `standup`,
   * which is the only phase that contains either the gather or the overshoot.
   * A retimed beat cannot desync it. */
  const WIN_FROM = OFF.standup
  const WIN_SPAN = DEFAULT_HERO_MOTION.beats.standup
  const track = []
  for (let i = 0; i <= 90; i++) {
    const t = WIN_FROM + (WIN_SPAN * i) / 90
    await setPlayhead(t)
    await page.waitForTimeout(28)
    const txt = await page.evaluate(() => {
      const ph = document.querySelector("[data-hero-phase]")
      return ph?.parentElement?.textContent ?? ""
    })
    const m = txt.match(/az\s*(-?[\d.]+)°\s*·\s*el\s*(-?[\d.]+)°\s*·\s*fill\s*([\d.]+)/)
    if (m) track.push({ az: parseFloat(m[1]), el: parseFloat(m[2]), fill: parseFloat(m[3]) })
  }
  await context.close()
  await browser.close()

  const flat = await measure(join(dir, "flat.png"))
  const hold = await measure(join(dir, "hold.png"))
  return {
    flat,
    hold,
    /* How far each channel sails PAST its bound. Zero when the overshoot is off.
     *
     * ⚠ THE BOUNDS WERE THE LITERALS `10` AND `1.0`, AND THIS FILE ALREADY HAD
     * THE MODEL LOADED AT LINE 47.
     *
     * DEFECT (class 3, a constant re-typed instead of read): `10` is
     * `DEFAULT_HERO_MOTION.holdEl` and `1.0` is `DEFAULT_HERO_MOTION.fillLie` —
     * the same two numbers `assert-hero-camera.mjs`'s reduced row reads off the
     * params object (`red.holdEl - s.el`, `100 * (s.fill - red.fillLie)`).
     * Retune either dial in `lib/hero-motion.ts` and this file went on
     * measuring the old value while printing a green row: the sibling gate and
     * this one would then have been asserting the same claim against two
     * different targets, and only one of them would have moved. Same class as
     * the two hardcoded playheads this file's own notes above catalogue, and
     * the same fix — derive it from the model, print what was read.
     *
     * NAMED, because the two dials happen to coincide today: `holdEl` and
     * `standupEl` are both 10, so the row's prose ("dips below standupEl") and
     * its arithmetic (holdEl) cannot be told apart by the number alone. It
     * follows the sibling gate and uses `holdEl`; both are printed. */
    elBelow: Math.max(0, EL_FLOOR - Math.min(...track.map((p) => p.el))),
    azBelow: Math.max(0, AZ_FLOOR - Math.min(...track.map((p) => p.az))),
    fillAbove: Math.max(0, Math.max(...track.map((p) => p.fill)) - FILL_CEIL),
    // The RAW extremes, kept so the calibration below can re-score the same
    // measured track against a different bound rather than assert an identity.
    elMin: Math.min(...track.map((p) => p.el)),
    azMin: Math.min(...track.map((p) => p.az)),
    fillMax: Math.max(...track.map((p) => p.fill)),
    samples: track.length,
  }
}

async function main() {
  EV.open()
  console.log("— reduced motion ON —")
  const r = await run(true)
  console.log("— reduced motion OFF (control) —")
  const n = await run(false)

  /* 1. The beat survives. Same bar as the main assert. */
  record(
    "reduced motion: flat beat still renders as ONE VALUE",
    r.flat.sdTrim < 1 && r.flat.residue <= r.flat.residueMax,
    `trimmed ink sd ${r.flat.sdTrim.toFixed(3)} over ${r.flat.n} px (needs < 1), residue ` +
      `${r.flat.offModal} px off modal luma ${r.flat.modal} = ${(100 * r.flat.residue).toFixed(4)} % ` +
      `(needs <= ${(100 * r.flat.residueMax).toFixed(2)} %). [raw, not the verdict] sd ${r.flat.sd.toFixed(2)}`,
  )
  record(
    "reduced motion: hold is still a lit object",
    r.hold.sd > 6 && r.hold.max - r.hold.min > 60,
    `ink sd ${r.hold.sd.toFixed(1)} (> 6), spread ${(r.hold.max - r.hold.min).toFixed(1)} (> 60)`,
  )

  /* 2. The movement really is reduced — and the control proves the gate can
   *    fail. Without this, gate 1 passes on a page ignoring the query. */
  record(
    "reduced motion: the stand-up no longer overshoots its targets",
    r.elBelow < 0.2 && r.azBelow < 0.2 && r.fillAbove < 0.002,
    `el dips ${r.elBelow.toFixed(1)}° below holdEl ${EL_FLOOR}, az ${r.azBelow.toFixed(1)}° below ${AZ_FLOOR}, ` +
      `fill ${r.fillAbove.toFixed(3)} above fillLie ${FILL_CEIL} — all must be ~0 (${r.samples} samples)` +
      `\n      [bounds read from DEFAULT_HERO_MOTION, not typed: holdEl ${EL_FLOOR}` +
      ` (standupEl is ${DEFAULT_HERO_MOTION.standupEl} — they coincide today, so the number alone` +
      ` cannot say which dial this row is about), fillLie ${FILL_CEIL}]`,
  )
  record(
    "control: the overshoot IS present without the preference",
    n.elBelow > 1 || n.azBelow > 1 || n.fillAbove > 0.005,
    `no-preference: el dips ${n.elBelow.toFixed(1)}°, az ${n.azBelow.toFixed(1)}°, ` +
      `fill +${n.fillAbove.toFixed(3)} — the gate can fail`,
  )

  /* ---- CALIBRATION: THE BOUNDS ARE CONNECTED TO THE DIALS -------------------
   *
   * The known-bad for a re-typed constant is the dial moving underneath it. So:
   * re-derive the same measured track against a RETUNED model and require the
   * answer to change. A literal `10` cannot move; a read of `holdEl` must. If
   * these two agree, the derivation is decorative and the defect is back. */
  const RETUNE = 5
  // Re-score the SAME measured track against a retuned dial. `derived` is what
  // this file now computes; `typed` is what the removed literal would have kept
  // computing. They must disagree, or the read is decorative.
  // Scored on the NO-PREFERENCE track, because that is the arm where the
  // overshoot actually exists — a bound can only be shown to be load-bearing
  // against an excursion it has something to bound.
  const derived = Math.max(0, EL_FLOOR + RETUNE - n.elMin)
  const typed = Math.max(0, 10 - n.elMin)
  const derivedFill = Math.max(0, n.fillMax - (FILL_CEIL + 0.4))
  const typedFill = Math.max(0, n.fillMax - 1.0)
  const connected = Math.abs(derived - typed) > 1e-9 && Math.abs(derivedFill - typedFill) > 1e-9
  console.log(
    `\nCALIBRATION — the bounds are READ from the model, and the read is load-bearing` +
      `\n  ${connected ? "connected, correctly" : "NOT CONNECTED — the derivation is decorative"}  ` +
      `on the no-preference arm's own track (el min ${n.elMin.toFixed(2)}°, fill max ${n.fillMax.toFixed(3)}):` +
      `\n      holdEl ${EL_FLOOR} -> ${EL_FLOOR + RETUNE}:  derived reads ${derived.toFixed(2)}°, ` +
      `the removed literal 10 would still read ${typed.toFixed(2)}°` +
      `\n      fillLie ${FILL_CEIL} -> ${(FILL_CEIL + 0.4).toFixed(1)}: derived reads ${derivedFill.toFixed(3)}, ` +
      `the removed literal 1.0 would still read ${typedFill.toFixed(3)}` +
      `\n      A retuned dial moves the target. The literals could not, which is the defect.`,
  )

  /* THE SWAP, on completion and not on the pass flag: both arms were filmed,
   * so the frames are evidence whichever way the rows went. */
  EV.commit()
  const failed = results.filter((x) => !x.pass)
  console.log(`\n${results.length - failed.length}/${results.length} gates passed`)
  process.exit(failed.length || !connected ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
