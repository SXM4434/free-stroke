// _PROBE-PENTIP-CARTESIAN-PARKED — THE PARKED PRIOR OF THE INSTRUMENT ITSELF.
//
// This is `assert-drawin-pentip.mjs` EXACTLY as it stood on 2026-08-02, byte for
// byte below this header, kept because the repair that replaced it has to be
// readable as a before/after and because its numbers are quoted in
// `HANDOFF-2026-08-02.md`. Nothing here is live: it is named `_probe-` so the
// meta-gate does not count it as a gate, and it is not run by any sweep.
//
// WHY IT WAS REPLACED, in one line: it measured the moving end in a Cartesian
// disc of 2.5 half-widths, which on this word gathers a median of 27.7 % and a
// maximum of 87.4 % of its ink from OTHER STROKES, and its per-playhead reading
// therefore has an IQR of 0.59-1.32 w against a cut->nib range of 0.462 w. The
// ruler's noise was larger than its subject, so its median moved with the
// PLAYHEAD GRID rather than with the mark: the same parked-prior arm read 0.444
// at 33 samples and 1.695 at 25.
//
// The evidence is `_probe-pentip-forensic.mjs`, which re-derives every row of
// this file's own `pentip.json` to |delta| = 0 before criticising it.
//
// ────────────────────────────────────────────────────────────────────────────
// ASSERT-DRAWIN-PENTIP — is the moving end of the line a PEN, or a CUT?
//
// Sebs, 2026-08-01: *"WHEN THE ENGINE IS FREE STROKE THE 2D DRAW-IN IT STILL
// JANK, IT'S LIKE ITS USING SOME STUPID SWEEP REVEAL, AND THE SPECIAL DRAWING
// ANIMATION IN DESK DOODLES IS A LOT BETTER"*. And 2026-08-02, after a pass
// that measured this and did not fix it: *"the 2d drawing animation still
// doesnt draw like someone actually drawing the strokes."*
//
// `_probe-drawin-order.mjs` already settled that the reveal is NOT a spatial
// wipe: on the discriminating-pair test both engines score 0.86-0.90 where 1 is
// a pen and 0 is a sweep, with synthetic controls at exactly 1.0000 and 0.0000.
// So the ORDER is right. What is left is the SHAPE OF THE MOVING END, and that
// is where "sweep" is literally true: a wipe terminates in a straight cut across
// the mark, a pen terminates in a nib.
//
// ════════════════════════════════════════════════════════════════════════════
// ⚠ THE INSTRUMENT WAS COMPROMISED, AND THIS IS THE RECALIBRATION.
// ════════════════════════════════════════════════════════════════════════════
//
// Measured 2026-08-02, on fresh frames, with the version that shipped: the
// verdict read PASS while ITS OWN CONTROLS had collapsed —
//
//     CONTROL  half-plane CUT     2.0 px
//     CONTROL  disc-dilated NIB   5.0 px      (14.0 px when it was written)
//
// A gate whose negative control cannot fail proves nothing, and this repo has a
// standing rule about exactly that (docs/README.md, the sixth bug pattern: *"a
// script named `assert-` that cannot fail […] Eleven instruments in this repo
// have reported green while measuring nothing"*). Both causes were the DRIFT
// class named in the same paragraph — *"a hardcoded second, a window sized for
// an old beat"* — and the defence it prescribes is *"derive every window from
// the model's own offsets and print what was actually read."* So:
//
//  1. EVERY WINDOW WAS A HARDCODED PIXEL COUNT. `BODY_BACK = 14`, the disc
//     radius `R = 22`, the half-width search cap `25`, the plausibility filter
//     `w < 25`. All four were chosen against a mark whose ink half-width was
//     about 7 px. Then `FlatState.penCarve` shipped, which REPLACES the tube's
//     outline with the pen's and is documented to take the median half-width
//     from 7.211 px to 6.000 px — and, on a capture at a different device scale
//     factor, those constants mean something else again. A ruler whose
//     graduations are pinned to a mark that has since changed width is not a
//     ruler. Every window is now a multiple of the mark's OWN measured ink
//     half-width, and every one of them is printed.
//
//  2. THE TRANSITION WAS MEASURED IN WHOLE PIXELS. `Math.round(u)` binning and
//     an integer crossing search cannot express a difference of less than one
//     pixel, and on a thirteen-pixel-wide mark the whole effect is a few. The
//     bins are now a quarter of a pixel and both crossings are interpolated, so
//     the ruler's resolution is a property of the arithmetic rather than of the
//     screenshot.
//
// And because a fix to an instrument is the easiest place in a repo to fit the
// answer to the picture, the calibration is asserted BEFORE the verdict and the
// verdict is not reported if it fails.
//
// ── THE MEASUREMENT ────────────────────────────────────────────────────────
//
// Using the page's own strokes and the page's own reveal law:
//
//     d      = revealDistanceFraction(strokes, phaseT, "hybrid", 0.4)   <- the
//              same call `AnimatedStrokes` makes, not a re-derivation
//
// Take a disc about the pen point at arc d, and inside it consider only pixels
// that are INK ON THE FINISHED MARK — so the engine's own thickness, taper and
// protrusion divide out. For each tangential coordinate u (positive = ahead of
// the pen), let
//
//     f(u) = (finished ink at u that is ALREADY DRAWN) / (finished ink at u)
//
// f goes from 1 well behind the pen to 0 well ahead of it. THE WIDTH OF THAT
// TRANSITION is the shape of the moving end:
//
//     ~0 w    the mark is at full width and then simply stops — A CUT
//     ~1 w    the mark rounds off over its own half-width — A NIB
//
// ⚠ TWO EARLIER METRICS WERE TRIED AND DISCARDED, AND BOTH ARE NAMED because
// each failed in a way that read as an answer:
//
//  (1) half-width across the path AT the clock's pen point. It returned 0 on
//      17 of 24 Free Stroke playheads — there is no ink there — and then
//      DIVIDED by it, reporting "a perfect nib" for an absence.
//  (2) the same with a walk-back to the last inked point. Better, but the
//      perpendicular ray crosses NEIGHBOURING STROKES in a word this dense,
//      which put the Free Stroke "ink half-width" at 23.3 px against a real one
//      nearer 9, and the noise swamped the effect.
//
// TWO SYNTHETIC CONTROLS, built from the same finished mask, calibrate it: a
// HALF-PLANE cut (must read ~0) and a DISC-dilated pen prefix (must read about
// the ink half-width). Neither is a constant chosen to make an answer.
//
// Reads the frames captured by `_probe-pentip-sweep.mjs` (or the older
// `_probe-drawin-sweep.mjs`).
// Usage: node scripts/verify/assert-drawin-pentip.mjs [--label=run]
//                                                     [--dir=docs/verification/pentip/run]
import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, isAbsolute } from "node:path"
import { createRequire } from "node:module"
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"
import { loadTs } from "./_ts-load.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const { revealDistanceFraction } = loadTs("lib/pen-reveal.ts")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const DIR_ARG = arg("dir", null)
/* THE DEFAULT IS THE CAPTURE THIS RULER IS CALIBRATED FOR.
 *
 * `_probe-pentip-sweep.mjs` writes three arms at deviceScaleFactor 2. The older
 * `docs/verification/drawin-sweep/<label>` captures are two arms at scale 1 and
 * are still readable with `--dir=`, which is how the before/after can be taken
 * off the frames the previous pass actually looked at. */
const DIR = DIR_ARG
  ? isAbsolute(DIR_ARG)
    ? DIR_ARG
    : join(ROOT, DIR_ARG)
  : join(ROOT, "docs", "verification", "pentip", LABEL)
/**
 * The arm captured with the tip shape OFF. It is the PARKED PRIOR (explainer
 * 18's raw per-triangle `setDrawRange` boundary) and it is the negative control
 * for the fix itself, so the "reads as a NIB" verdict is NOT asserted on it —
 * the INVERSE is, further down. Asserting both would make the script exit 1 in
 * the shipped state, and a gate that is red when everything is right gets
 * ignored, which is the same disease as one that is green when nothing is.
 */
const PRIOR_ARM = "free-stroke-off"
// The page's shipped reveal settings — `viewport-3d.tsx`, the `AnimatedStrokes`
// drawRange branch.
const MODE = "hybrid"
const BLEND = 0.4

/* ── EVERY WINDOW, AS A MULTIPLE OF THE MARK'S OWN INK HALF-WIDTH ──────────
 *
 * Named here rather than inline so the calibration is one readable block and
 * so a future reader can see at a glance that not one of them is a pixel
 * count. `w` below is the median half-width MEASURED off the finished frame of
 * the engine being judged.
 */
/** How far back along the path "the body of the stroke" is. */
const BODY_BACK_W = 1.25
/** Radius of the disc the transition is measured inside. It has to hold the
 *  whole nose plus enough body behind it for f to reach 1. */
const DISC_W = 2.5
/** How far a half-width probe may walk before it is a crossing, not a width. */
const PROBE_CAP_W = 3.0
/** A measured half-width outside this band is a neighbouring stroke, not this
 *  one, and is dropped from the median rather than allowed to inflate it. */
const PLAUSIBLE_LO_W = 0.25
const PLAUSIBLE_HI_W = 2.2
/**
 * Sub-pixel bin pitch for f(u). One quarter pixel: fine enough that the CUT
 * control lands under a tenth of a half-width, coarse enough that a bin still
 * holds several ink pixels on a mark this thin.
 *
 * OVERRIDABLE WITH `--bin=`, and that is the MUTATION TEST for this whole
 * recalibration rather than a convenience. `--bin=1` restores the integer ruler
 * the previous version used; if the calibration assertions do not go red under
 * it, then they are not measuring the thing that went wrong. Run it:
 *
 *     node scripts/verify/assert-drawin-pentip.mjs --bin=1
 */
const BIN = parseFloat(arg("bin", "0.25"))
/** f's two crossings. */
const F_HI = 0.85
const F_LO = 0.15

/* ── WHAT THE NIB CONTROL SHOULD READ, IN CLOSED FORM ─────────────────────
 *
 * The bar the calibration is judged against is DERIVED, not chosen, because a
 * chosen one is how the previous version came to have a control that could not
 * fail. For a straight ribbon of half-width w, the disc-dilated prefix covers
 * the points with `u² + y² <= w²`, so at tangential offset u
 *
 *     f(u) = 2·√(w² − u²) / 2w = √(1 − (u/w)²)
 *
 * and the F_HI → F_LO span is `(√(1 − F_LO²) − √(1 − F_HI²)) · w` = 0.462 w.
 * That is what a perfect round nose of one half-width MUST measure.
 */
const NIB_IDEAL_W = Math.sqrt(1 - F_LO * F_LO) - Math.sqrt(1 - F_HI * F_HI)
/**
 * How much of that ideal the real control has to reach.
 *
 * A half, and the three reasons it is not the whole of it are all properties of
 * the word rather than of the measurement: the disc is 2.5 w across, so on a
 * dense word it gathers ink from NEIGHBOURING strokes which lifts f in the
 * tail; the mark CURVES inside the disc, so the tangential axis is not square
 * to the ribbon everywhere; and the finished-ink mask is a threshold on an
 * antialiased render. Measured on the hero word the control reaches 0.29 w
 * against the 0.46 w ideal, i.e. 63 %.
 */
const NIB_REACHES = 0.5
/** And a half-plane cut must stay under a tenth of it. */
const CUT_UNDER = 0.1
/**
 * THE RESOLUTION BAR, WHICH IS THE ONE THAT CAUGHT THE ORIGINAL FAILURE.
 *
 * Expressing the controls as a fraction of w is necessary and NOT sufficient:
 * the version this replaces read cut 2.0 px and nib 5.0 px on a mark whose
 * half-width was about 6.5 px, which is 0.31 w and 0.77 w — a ratio that looks
 * perfectly healthy and was completely useless, because THREE PIXELS of
 * separation measured on an integer grid cannot place anything between them.
 *
 * So the separation is also required in BINS. Eight of them puts the pen score's
 * own resolution at 0.125, four times finer than the 0.5 the verdict is taken
 * at. The old instrument scores 3 against this bar and fails, which is the
 * check working.
 */
const CONTROL_SEPARATION_BINS = 8

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function inkMask(path) {
  const img = await loadImage(path)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const hist = new Uint32Array(256)
  const luma = new Uint8Array(img.width * img.height)
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
    luma[p] = l
    hist[l]++
  }
  let paper = 0
  for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
  const cut = Math.max(8, paper - 45)
  const m = new Uint8Array(luma.length)
  for (let p = 0; p < luma.length; p++) m[p] = luma[p] < cut ? 1 : 0
  return { m, w: img.width, h: img.height }
}

async function main() {
  if (!existsSync(DIR)) {
    console.error(`no capture at ${DIR} — run _probe-pentip-sweep.mjs first`)
    process.exit(2)
  }
  console.log(`reading ${DIR}\n`)
  const meta = JSON.parse(readFileSync(join(DIR, "meta.json"), "utf8"))
  const strokes = processedHeroStrokes()

  /* ---- the pen path, with per-point arc length and per-stroke bounds ----- */
  const pts = []
  const strokeEndArc = []
  let total = 0
  for (const s of strokes)
    for (let i = 1; i < s.points.length; i++)
      total += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
  {
    let acc = 0
    for (const s of strokes) {
      for (let i = 0; i < s.points.length; i++) {
        if (i > 0) acc += Math.hypot(s.points[i].x - s.points[i - 1].x, s.points[i].y - s.points[i - 1].y)
        pts.push({ x: s.points[i].x, y: s.points[i].y, arc: acc })
      }
      strokeEndArc.push(acc)
    }
  }
  const xs = pts.map((p) => p.x)
  const ys = pts.map((p) => p.y)
  const sMinX = Math.min(...xs)
  const sMaxX = Math.max(...xs)
  const sMinY = Math.min(...ys)
  const sMaxY = Math.max(...ys)

  const results = {}
  for (const engine of Object.keys(meta.engines)) {
    const samples = meta.engines[engine]
    const lastIdx = samples.length - 1
    const finalMask = await inkMask(join(DIR, engine, `${String(lastIdx).padStart(3, "0")}.png`))
    const { m: fin, w: W, h: H } = finalMask

    /* ---- fit stroke space -> screen against the FINAL ink (searched, then
     * scored on how much of the path lands on ink — the closed-form solve was
     * wrong once, see `_probe-drawin-order.mjs`). */
    let bMinX = W, bMaxX = -1, bMinY = H, bMaxY = -1
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (fin[y * W + x]) {
          if (x < bMinX) bMinX = x
          if (x > bMaxX) bMaxX = x
          if (y < bMinY) bMinY = y
          if (y > bMaxY) bMaxY = y
        }
    const cxS = (bMinX + bMaxX) / 2
    const cyS = (bMinY + bMaxY) / 2
    const cxP = (sMinX + sMaxX) / 2
    const cyP = (sMinY + sMaxY) / 2
    const sHi = (bMaxX - bMinX) / (sMaxX - sMinX)
    const mk = (sc, fl) => (p) => ({ x: cxS + (p.x - cxP) * sc, y: cyS + (p.y - cyP) * sc * fl })
    const score = (f) => {
      let on = 0
      for (const p of pts) {
        const q = f(p)
        const xi = Math.round(q.x)
        const yi = Math.round(q.y)
        if (xi >= 0 && xi < W && yi >= 0 && yi < H && fin[yi * W + xi]) on++
      }
      return on / pts.length
    }
    let best = { sc: sHi, fl: 1, v: -1 }
    for (const fl of [1, -1])
      for (let i = 0; i <= 80; i++) {
        const sc = sHi * (0.55 + (0.45 * i) / 80)
        const v = score(mk(sc, fl))
        if (v > best.v) best = { sc, fl, v }
      }
    const SC = best.sc
    const toScreen = mk(best.sc, best.fl)
    const totalPx = total * SC

    /* ---- THE SCALE ANCHOR, FROM THE LAW AND NOT FROM THE PICTURE ---------
     *
     * `HERO_INK_WIDTH_PX` is `computeSolidEffectiveThicknessPx(DEFAULT_SOLID_
     * PARAMS.thickness)` — the same function `inflateBuildImplicitGeometry`
     * sizes the mark with. Times the fitted `SC` it is the nib's half-width in
     * SCREEN pixels for this capture, whatever device scale factor it was taken
     * at. Everything below that needs a pixel window derives from it, so the
     * windows follow the capture instead of being asserted against it.
     *
     * It is only the ANCHOR. The width the measurement actually uses is still
     * measured off the finished frame, because the carve makes the drawn mark
     * narrower than the nominal nib and it is the DRAWN mark being judged. */
    const nominalHalfPx = (HERO_INK_WIDTH_PX / 2) * SC

    /* ---- half-width of the ink across the path at a given ARC (screen px) -- */
    const at = (arcPx) => {
      const arcU = arcPx / SC
      let i = 1
      while (i < pts.length && pts[i].arc < arcU) i++
      if (i >= pts.length) i = pts.length - 1
      const a = toScreen(pts[i - 1])
      const b = toScreen(pts[i])
      const seg = Math.hypot(b.x - a.x, b.y - a.y)
      const f = seg > 0 ? (arcPx - pts[i - 1].arc * SC) / seg : 0
      const P = { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }
      const T = seg > 0 ? { x: (b.x - a.x) / seg, y: (b.y - a.y) / seg } : { x: 1, y: 0 }
      return { P, N: { x: -T.y, y: T.x } }
    }
    /** Contiguous ink half-width across the mark at P along N, in px. */
    const halfWidth = (mask, P, N, cap) => {
      const on = (x, y) => {
        const xi = Math.round(x)
        const yi = Math.round(y)
        return xi >= 0 && xi < W && yi >= 0 && yi < H && mask[yi * W + xi]
      }
      if (!on(P.x, P.y)) return 0
      let a = 0
      while (a < cap && on(P.x + N.x * (a + 0.5), P.y + N.y * (a + 0.5))) a += 0.5
      let b = 0
      while (b < cap && on(P.x - N.x * (b + 0.5), P.y - N.y * (b + 0.5))) b += 0.5
      return (a + b) / 2
    }

    /* ---- THE MARK'S OWN INK HALF-WIDTH, MEASURED, THEN EVERY WINDOW ------ */
    const probeCap = PROBE_CAP_W * nominalHalfPx
    const bodyBack = BODY_BACK_W * nominalHalfPx
    const capBodies = []
    for (const endArcU of strokeEndArc) {
      const q = at(Math.max(0, endArcU * SC - bodyBack))
      const w = halfWidth(fin, q.P, q.N, probeCap)
      if (w > PLAUSIBLE_LO_W * nominalHalfPx && w < PLAUSIBLE_HI_W * nominalHalfPx) capBodies.push(w)
    }
    capBodies.sort((a, b) => a - b)
    const wPx = capBodies[Math.floor(capBodies.length / 2)] ?? nominalHalfPx
    const R = Math.max(6, Math.round(DISC_W * wPx))

    /** Transition width of f(u) over a disc about `endPx`, for mask `M`, in px.
     *
     * Sub-pixel: `u` is binned at BIN px and BOTH crossings are interpolated
     * inside their bin, so the answer is not quantised to the screen grid. On a
     * mark thirteen device pixels wide the entire effect is a few pixels, and
     * an integer ruler across it is the reason the controls collapsed. */
    const transitionWidth = (M, endPx) => {
      const { P, N } = at(endPx)
      const T = { x: N.y, y: -N.x }
      const nb = Math.ceil((2 * R) / BIN) + 1
      const binsF = new Float64Array(nb)
      const binsM = new Float64Array(nb)
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          if (dx * dx + dy * dy > R * R) continue
          const x = Math.round(P.x + dx)
          const y = Math.round(P.y + dy)
          if (x < 0 || x >= W || y < 0 || y >= H) continue
          if (!fin[y * W + x]) continue
          const u = Math.floor((dx * T.x + dy * T.y + R) / BIN)
          if (u < 0 || u >= nb) continue
          binsF[u]++
          if (M[y * W + x]) binsM[u]++
        }
      /* THE MINIMUM POPULATION IS A FRACTION OF THE MARK, NOT A COUNT. At BIN
       * of a pixel across a mark of half-width w, a full bin holds about
       * `2w*BIN` pixels; requiring an eighth of that keeps the tails out
       * without cutting into the body at any capture scale. */
      const minPop = Math.max(1, 0.125 * 2 * wPx * BIN)
      const f = new Array(nb).fill(null)
      for (let u = 0; u < nb; u++) if (binsF[u] >= minPop) f[u] = binsM[u] / binsF[u]

      // Last bin at or above F_HI, then the first at or below F_LO after it.
      let iHi = -1
      for (let u = 0; u < nb; u++) if (f[u] !== null && f[u] >= F_HI) iHi = u
      if (iHi < 0) return null
      let iLo = -1
      for (let u = iHi + 1; u < nb; u++)
        if (f[u] !== null && f[u] <= F_LO) {
          iLo = u
          break
        }
      if (iLo < 0) return null
      /* INTERPOLATE BOTH CROSSINGS inside their own bin, against the nearest
       * populated neighbour on the other side of the level. Without this the
       * answer can only ever be a whole number of bins. */
      const lerpCross = (i, dir, level) => {
        let j = i + dir
        while (j >= 0 && j < nb && f[j] === null) j += dir
        if (j < 0 || j >= nb) return i * BIN
        const a = f[i]
        const b = f[j]
        if (a === b) return i * BIN
        const t = (a - level) / (a - b)
        return (i + dir * Math.max(0, Math.min(1, t))) * BIN
      }
      const uHi = lerpCross(iHi, +1, F_HI)
      const uLo = lerpCross(iLo, -1, F_LO)
      return Math.max(0, uLo - uHi)
    }

    /* ---- CONTROLS on the finished mask ---------------------------------- */
    const halfPlaneMask = (endPx) => {
      const { P, N } = at(endPx)
      const T = { x: N.y, y: -N.x }
      const m = new Uint8Array(fin.length)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (fin[y * W + x] && (x - P.x) * T.x + (y - P.y) * T.y <= 0) m[y * W + x] = 1
      return m
    }
    const discPrefixMask = (endPx) => {
      // The finished ink within `rad` of the pen path PREFIX — what a real nib
      // laying ink down would have covered.
      const rad = wPx
      const m = new Uint8Array(fin.length)
      for (let a = 0; a <= endPx; a += 1) {
        const { P } = at(a)
        const x0 = Math.max(0, Math.floor(P.x - rad))
        const x1 = Math.min(W - 1, Math.ceil(P.x + rad))
        const y0 = Math.max(0, Math.floor(P.y - rad))
        const y1 = Math.min(H - 1, Math.ceil(P.y + rad))
        for (let y = y0; y <= y1; y++)
          for (let x = x0; x <= x1; x++)
            if (fin[y * W + x] && (x - P.x) ** 2 + (y - P.y) ** 2 <= rad * rad) m[y * W + x] = 1
      }
      return m
    }

    /* ---- THE REVEAL'S MOVING END ---------------------------------------- */
    const tipRows = []
    const ctlCut = []
    const ctlNib = []
    for (let k = 5; k < samples.length - 4; k++) {
      const phaseT = samples[k].phaseT
      const dFrac = revealDistanceFraction(strokes, phaseT, MODE, BLEND)
      const dPx = dFrac * totalPx
      if (dPx < 3 * R) continue
      const mask = await inkMask(join(DIR, engine, `${String(k).padStart(3, "0")}.png`))
      const tw = transitionWidth(mask.m, dPx)
      if (tw === null) continue
      tipRows.push({ k, phaseT, dFrac, transitionPx: tw })
      const c1 = transitionWidth(halfPlaneMask(dPx), dPx)
      const c2 = transitionWidth(discPrefixMask(dPx), dPx)
      if (c1 !== null) ctlCut.push(c1)
      if (c2 !== null) ctlNib.push(c2)
    }
    const med = (a) => (a.length ? [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)] : null)
    const tipMedian = med(tipRows.map((r) => r.transitionPx)) ?? 0
    const cutCtl = med(ctlCut) ?? 0
    const nibCtl = med(ctlNib) ?? 0
    // Where does the measurement sit between the two controls? 0 = a cut,
    // 1 = a nib the size of this engine's own ink radius.
    const penScore = nibCtl > cutCtl ? (tipMedian - cutCtl) / (nibCtl - cutCtl) : 0

    results[engine] = {
      fitScale: SC,
      fitPathOnInk: best.v,
      nominalHalfWidthPx: nominalHalfPx,
      medianHalfWidthPx: wPx,
      discRadiusPx: R,
      bodyBackPx: bodyBack,
      binPx: BIN,
      playheads: tipRows.length,
      terminalTransitionPx: tipMedian,
      terminalTransitionW: tipMedian / wPx,
      controlCutPx: cutCtl,
      controlNibPx: nibCtl,
      controlCutW: cutCtl / wPx,
      controlNibW: nibCtl / wPx,
      penScore,
      rows: tipRows,
    }

    console.log(`\n=== ${engine} ===`)
    console.log(`  fit ${SC.toFixed(4)} px/unit · ${(best.v * 100).toFixed(1)} % of path on final ink`)
    console.log(`  THE RULER, DERIVED (every window a multiple of the mark's own half-width):`)
    console.log(`      nominal half-width  (law × fit)  ${nominalHalfPx.toFixed(2)} px`)
    console.log(`      MEASURED half-width w (finished) ${wPx.toFixed(2)} px   over ${capBodies.length} stroke ends`)
    console.log(`      body-back ${BODY_BACK_W}w = ${bodyBack.toFixed(1)} px · disc ${DISC_W}w = ${R} px · bin ${BIN} px`)
    console.log(`  TERMINAL-EDGE TRANSITION (f = ${F_HI} -> ${F_LO}), median over ${tipRows.length} playheads:`)
    console.log(`      measured                       ${tipMedian.toFixed(2)} px   ${(tipMedian / wPx).toFixed(3)} w`)
    console.log(`      CONTROL  half-plane CUT        ${cutCtl.toFixed(2)} px   ${(cutCtl / wPx).toFixed(3)} w`)
    console.log(`      CONTROL  disc-dilated NIB      ${nibCtl.toFixed(2)} px   ${(nibCtl / wPx).toFixed(3)} w   (closed form ${NIB_IDEAL_W.toFixed(3)} w)`)
    /* A SCORE ABOVE 1 IS NOT AN ERROR AND IS WORTH SAYING SO. The NIB control
     * is a HARD disc — a binary dilation of the finished mask — while a real
     * drawn end carries the pen carve's own antialiased outline on top of the
     * render's. Both engines' real ends therefore transition over more than the
     * control does. What the score locates is a POSITION between two named
     * shapes, and past the nib end of that line still means "rounder than a
     * hard disc", never "measured wrong". */
    console.log(`      pen score (0 = cut, 1 = nib)   ${penScore.toFixed(3)}${penScore > 1 ? "   (>1 = softer than a HARD disc of one half-width)" : ""}`)
    console.log(`   k   phaseT   revealDist   transitionPx`)
    for (const r of tipRows)
      console.log(`  ${String(r.k).padStart(2)}   ${r.phaseT.toFixed(3)}   ${r.dFrac.toFixed(4)}      ${r.transitionPx.toFixed(2)}`)
  }

  /* ---- ASSERTIONS -------------------------------------------------------
   *
   * THE INSTRUMENT IS ASSERTED FIRST AND THE VERDICT IS NOT REPORTED IF IT
   * FAILS. That ordering is the whole lesson of the recalibration above: the
   * previous version printed a PASS verdict on a run where its own controls had
   * collapsed to 2 px and 5 px, and the verdict was read while the calibration
   * row was not. */
  console.log("")
  let calibrated = true
  for (const [engine, r] of Object.entries(results)) {
    say(r.fitPathOnInk > 0.9, `${engine} — the stroke->screen fit is real`, `${(r.fitPathOnInk * 100).toFixed(1)} %`)
    say(r.playheads >= 8, `${engine} — enough playheads inside the draw to judge`, `${r.playheads}`)
    const cutOk = r.controlCutW <= CUT_UNDER * NIB_IDEAL_W
    say(
      cutOk,
      `${engine} — CONTROL: a half-plane CUT reads as a cut`,
      `${r.controlCutW.toFixed(3)} w (must be <= ${(CUT_UNDER * NIB_IDEAL_W).toFixed(3)}, a tenth of the round nose's closed form ${NIB_IDEAL_W.toFixed(3)} w)`,
    )
    const nibOk = r.controlNibW >= NIB_REACHES * NIB_IDEAL_W
    say(
      nibOk,
      `${engine} — CONTROL: a disc NIB reads like the geometry it is built from`,
      `${r.controlNibW.toFixed(3)} w = ${((r.controlNibW / NIB_IDEAL_W) * 100).toFixed(0)} % of the closed form ${NIB_IDEAL_W.toFixed(3)} w (must be >= ${(NIB_REACHES * 100).toFixed(0)} %)`,
    )
    const sepBins = (r.controlNibPx - r.controlCutPx) / r.binPx
    const sepOk = sepBins >= CONTROL_SEPARATION_BINS
    say(
      sepOk,
      `${engine} — CONTROL: the ruler can RESOLVE the gap between them`,
      `cut ${r.controlCutPx.toFixed(2)} px vs nib ${r.controlNibPx.toFixed(2)} px = ${sepBins.toFixed(1)} bins of ${r.binPx} px (must be >= ${CONTROL_SEPARATION_BINS}; the version this replaces scored 3.0)`,
    )
    if (!cutOk || !nibOk || !sepOk) calibrated = false
  }
  if (!calibrated) {
    console.log(
      "\n⚠ THE CONTROLS DID NOT SEPARATE. No verdict is reported: a gate whose\n" +
        "  negative control cannot fail proves nothing, and printing a PASS beside\n" +
        "  a collapsed control is exactly how this instrument went blind before.",
    )
  } else {
    for (const [engine, r] of Object.entries(results)) {
      if (engine === PRIOR_ARM) continue
      say(
        r.penScore > 0.5,
        `${engine} — the reveal's moving end reads as a NIB, not a CUT`,
        `pen score ${r.penScore.toFixed(3)} (measured ${r.terminalTransitionW.toFixed(3)} w between cut ${r.controlCutW.toFixed(3)} and nib ${r.controlNibW.toFixed(3)})`,
      )
    }
  }

  const fs = results["free-stroke"]
  const dd = results["desk-doodles"]
  const prior = results[PRIOR_ARM]
  if (fs && dd) {
    console.log(
      `\n  Free Stroke pen score ${fs.penScore.toFixed(3)}   vs   Desk Doodles pen score ${dd.penScore.toFixed(3)}`,
    )
  }
  /* THE PARKED PRIOR IS THE POSITIVE CONTROL FOR THE FIX ITSELF. If the arm
   * captured with the tip shape OFF does not read as a CUT, then either the fix
   * is not what moved the number or the switch did not take — and either way the
   * after reading means nothing. */
  if (fs && prior) {
    console.log(
      `  Free Stroke, tip OFF (the parked prior) pen score ${prior.penScore.toFixed(3)}  ->  shipped ${fs.penScore.toFixed(3)}`,
    )
    if (calibrated) {
      say(
        prior.penScore < 0.5,
        "CONTROL: the PARKED PRIOR still reads as a CUT",
        `pen score ${prior.penScore.toFixed(3)} (must be < 0.5, or the fix is not what moved the number)`,
      )
      say(
        fs.penScore - prior.penScore > 0.3,
        "the shipped tip is decisively nearer a NIB than the prior it replaces",
        `${prior.penScore.toFixed(3)} -> ${fs.penScore.toFixed(3)}`,
      )
    }
  }

  writeFileSync(join(DIR, "pentip.json"), JSON.stringify(results, null, 2))
  console.log(`\njson: ${join(DIR, "pentip.json")}`)
  console.log(pass ? "\nALL PASS" : "\nFAILURES ABOVE")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
