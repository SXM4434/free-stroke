// THE PEN CARVE IS DRIVEN BY THE BEAT — the wiring, the curve, and the park.
//
// ── WHAT THIS FILE IS FOR, AND WHAT IT DELIBERATELY IS NOT ────────────────
// Three other gates already judge the carve's PICTURE and none of them judges
// the thing that was actually missing:
//
//   assert-pen-carve.mjs        the shader: at carve 0 nothing moves, at carve 1
//                               8354 px go ink -> paper and 0 go paper -> ink.
//   assert-flat-silhouette.mjs  the payload: flat vs solid on the SILHOUETTE,
//                               39.12 % of a stroke radius against a 4.09 %
//                               value-only floor, with the parked arm as its
//                               negative control.
//   assert-hero-transition.mjs  gate 1 survives it.
//
// All three were green-able through `__captureHarness.setFlatten`, which is a
// DEV-ONLY override. `FlatState.penCarve` was landed, correct, gated — and
// reachable by nothing a visitor could ever trigger. That is this beat's most
// expensive recurring defect: `squashX`/`squashY` rendered nowhere for months,
// `jointBreak` was published by the model and read by nothing, `pushScaleEnd`
// was declared, defaulted, documented and dead. So this file asks the three
// questions those three gates cannot:
//
//   1 · IS THE CHANNEL ORTHOGONAL? Turning the carve on may not move anything
//       else the model publishes. Otherwise "the carve made the beat better" is
//       a claim about an unknown number of changes.
//   2 · IS THE CURVE THE ONE THAT WAS ARGUED FOR? `sampleForm` says the carve
//       RIDES `flat` and gets no clock of its own, with five reasons. A comment
//       is not a measurement.
//   3 · §0.7 — DOES THE PARK REPRODUCE? `carveLaw: "prior"` has to render the
//       shipped picture, on PIXELS, on the frames where the model publishes 0 —
//       and the same comparison has to SEE a difference on the frames where it
//       publishes 1, or it is a byte-compare that cannot fail.
//
// ── THE CONTROLS · BOTH RUN ON THE DEFAULT INVOCATION ─────────────────────
//   BLIND   the park comparison is ALSO run against the same capture twice. Its
//           "and the arms DO differ where the carve is on" clause MUST come back
//           red on that input — that clause is the only thing standing between
//           this file and a byte-compare of a capture with itself, which passes
//           trivially and means nothing.
//   CLOCK   the curve law is ALSO evaluated against a sampler whose carve leads
//           `flat` by two frames — the "give it its own clock" version the
//           argument rejects. It MUST be rejected.
//
// ── 2026-08-07 · THEY USED TO BE `--mutate=blind|clock`, AND NOTHING PASSED IT.
//
// Both controls existed, both were correct, and both were behind a flag neither
// battery types (`run-browser-battery.mjs`: *"the bare invocation is the one the
// next person types"*). So in every sweep this gate has ever been in, the two
// arms proving it can fail did not run — and explainer 21 §7 already said they
// must: *"the gate runs three kinds of control on the DEFAULT invocation, never
// behind a flag."*
//
// THE FIX IS NOT A SECOND COPY OF THE MEASUREMENT. Both controls are the same
// code with a different input: `curveLaw()` is called twice, once on the shipped
// samples and once on the shifted ones; `diffFrames()` is called twice per
// frame, once on (shipped, prior) and once on (shipped, shipped). One
// implementation, two inputs — which is what makes the control evidence about
// the real predicate rather than about a paraphrase of it.
//
// The blind arm reuses the already-decoded luma of the `LABEL` frame for both
// sides instead of decoding the same PNG twice. The claim under test is the
// CLAUSE, not the decoder, and this run grades ~200 frames — a second decode per
// frame buys nothing and costs the whole run again.
//
// Usage:
//   node scripts/verify/assert-hero-carve.mjs [--label=carve] [--prior=carve-prior]
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
/* THE PROVENANCE MODULE THIS DIRECTORY ALREADY HAD. `_capture-freshness.mjs` was
 * written for exactly the hole this gate has, and `assert-drawin-pentip.mjs` and
 * `assert-pentip-specks.mjs` already use these two primitives the same way.
 * Nothing new is written here. */
import { newestUnder, newestCapture } from "./_capture-freshness.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const { DEFAULT_HERO_MOTION, sampleHeroMotion, totalDuration } = loadTs("lib/hero-motion.ts")

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "carve")
const PRIOR = arg("prior", "carve-prior")
const dirFor = (l) => join(ROOT, "docs", "verification", "hero-transition", l)

const results = []
const record = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`)
}

/* -------------------------------------------------------------------------- */
/*  1 + 2 · THE MODEL — no browser, so the law is checked against the law      */
/* -------------------------------------------------------------------------- */

const P = DEFAULT_HERO_MOTION
const TOTAL = totalDuration(P)
const FPS = P.fps > 0 ? P.fps : 30
const N = Math.max(2, Math.round(TOTAL * FPS))
const times = Array.from({ length: N }, (_, i) => (i + 0.5) / FPS)

function sampleAll(params, mutateSample = null) {
  return times.map((t) => {
    const s = sampleHeroMotion(params, t)
    return mutateSample ? mutateSample(s, t) : s
  })
}

const pen = sampleAll(P)
const prior = sampleAll({ ...P, carveLaw: "prior" })

/* ---- 1. ORTHOGONAL ------------------------------------------------------- */
// Every field of `HeroSample` except `penCarve` has to be bit-identical between
// the two arms. `phase` is a string and is compared as one. A field that moved
// would mean the carve dial is a second name for something else.
const FIELDS = Object.keys(pen[0]).filter((k) => k !== "penCarve")
const moved = []
for (let i = 0; i < N; i++) {
  for (const f of FIELDS) {
    if (pen[i][f] !== prior[i][f]) {
      moved.push(`${f} @${times[i].toFixed(3)}s: ${pen[i][f]} vs ${prior[i][f]}`)
      break
    }
  }
}
const carveDiffers = pen.filter((s, i) => s.penCarve !== prior[i].penCarve).length
record(
  "the carve is ORTHOGONAL — switching it moves the carve and nothing else",
  moved.length === 0 && carveDiffers > 0,
  `${FIELDS.length} other channels compared over ${N} samples of the whole ${TOTAL.toFixed(2)}s beat: ` +
    `${moved.length} moved (needs 0)${moved.length ? " — " + moved.slice(0, 3).join(" · ") : ""}. ` +
    `penCarve itself differs on ${carveDiffers} of ${N} samples (needs > 0, or the arms are the same arm).`,
)

/* ---- 2. THE CURVE IS `flat`'s ------------------------------------------- */
/* `sampleForm`'s five reasons come down to one testable law: the carve is the
 * flat state's SHAPE, so it lasts exactly as long as the flat state does. Any
 * instant where `flat` is 1 and the carve is 0 is a frame that is a drawing in
 * value and a tube in shape — the defect Sebs named — and any instant where the
 * carve leads `flat` is a second piece of news on its own clock, which is what
 * the argument rejects. Both are the same equality. */
/** THE CURVE LAW, EVALUATED ON WHATEVER SERIES IT IS HANDED.
 *
 *  Factored out so the control below can be the SAME predicate on a different
 *  input rather than a second copy of it. A control that re-implements the
 *  thing it certifies proves the copy. */
function curveLaw(samples) {
  let curveBad = 0
  let firstBad = null
  for (let i = 0; i < N; i++) {
    const want = Math.max(0, Math.min(1, P.carveAmount)) * Math.max(0, Math.min(1, samples[i].flat))
    if (Math.abs(samples[i].penCarve - want) > 1e-9) {
      curveBad++
      if (firstBad === null) {
        firstBad = `@${times[i].toFixed(3)}s in "${samples[i].phase}": carve ${samples[i].penCarve} against flat ${samples[i].flat} x amount ${P.carveAmount}`
      }
    }
  }
  // And the swap is INSIDE the turn, not before or after it: the frames where
  // the carve changes must all be in a turn phase, which is what "hidden at the
  // edge" means when it is a number.
  const swapPhases = new Set()
  for (let i = 1; i < N; i++) {
    if (samples[i].penCarve !== samples[i - 1].penCarve) swapPhases.add(samples[i].phase)
  }
  const swapsOutsideTurn = [...swapPhases].filter((p) => p !== "emerge" && p !== "returnTurn")
  return {
    curveBad,
    firstBad,
    swapPhases,
    swapsOutsideTurn,
    ok: curveBad === 0 && swapsOutsideTurn.length === 0 && swapPhases.size > 0,
  }
}

const law = curveLaw(pen)
record(
  "the carve RIDES `flat` — no clock of its own, and the swap is hidden at the edge",
  law.ok,
  `penCarve == carveAmount x flat on ${N - law.curveBad} of ${N} samples` +
    (law.firstBad ? ` — first mismatch ${law.firstBad}` : "") +
    `. It changes value only inside {${[...law.swapPhases].join(", ")}} ` +
    `(needs the two turns and nothing else; ${law.swapsOutsideTurn.length} outside).`,
)

/* THE CLOCK CONTROL — on the bare invocation, per explainer 21 §7.
 *
 * A carve that LEADS `flat` by two frames: the "give it its own clock" version
 * `sampleForm`'s five reasons reject. It is built by shifting the carve forward
 * in the series, which is exactly what an independent ramp looks like at the
 * swap. The row above's predicate — the same function, not a restatement — must
 * come back FALSE on it.
 *
 * Until 2026-08-07 this was `--mutate=clock`, and no sweep types a flag. */
const clock = curveLaw(pen.map((s, i) => ({ ...s, penCarve: pen[Math.min(N - 1, i + 2)].penCarve })))
record(
  "CONTROL · a carve on its OWN CLOCK (leading `flat` by two frames) is REJECTED by that same law",
  !clock.ok,
  `the identical predicate, handed a carve shifted +2 frames, reports ${clock.curveBad} of ${N} samples ` +
    `off the law (needs > 0)` +
    (clock.firstBad ? ` — first mismatch ${clock.firstBad}` : "") +
    `. Without this the row above passes on any series that happens to satisfy an equality, and ` +
    `"the carve rides flat" would be a green nobody had shown a build it must reject.`,
)

/* -------------------------------------------------------------------------- */
/*  3 · §0.7 THE PARK — on pixels, both directions                            */
/* -------------------------------------------------------------------------- */

async function frameLuma(file) {
  const img = await loadImage(file)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const out = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    out[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }
  return out
}

async function main() {
  const a = dirFor(LABEL)
  const b = dirFor(PRIOR)
  for (const [d, n] of [[a, LABEL], [b, PRIOR]]) {
    if (!existsSync(join(d, "manifest.json"))) {
      console.error(
        `no capture at ${d} — run:\n` +
          `  node scripts/verify/verify-hero-transition.mjs --label=${LABEL}\n` +
          `  node scripts/verify/verify-hero-transition.mjs --label=${PRIOR} --carve=prior`,
      )
      process.exit(1)
    }
  }
  /* ═══ PROVENANCE · DO THESE CAPTURES BELONG TO THIS TREE ═══════════════════
   *
   * ⚠ MEASURED 2026-08-28: `docs/verification/hero-transition/carve` is 24.7
   * days behind the newest source it grades — the oldest evidence of the
   * seventeen. Rows 3 onward read those scrub PNGs and their manifests.
   *
   * THIS GATE CANNOT RECAPTURE, and `assert-gate-integrity.mjs` does not know
   * that. Channel F classifies it LIVE+STORED because it calls
   * `loadTs("lib/hero-motion.ts")`, and LIVE buys the lenient 1.5-day bar. But
   * loading a module is the MODEL half — rows 1 and 2 above, "the law checked
   * against the law", which need no capture at all. The pixel half opens no
   * browser and writes nothing; only `verify-hero-transition.mjs` can refresh
   * it. So the lenient bar was bought with liveness this gate does not have
   * where it matters, and the row below applies the strict one.
   *
   * Rows 1 and 2 stand either way: they are statements about the motion law and
   * do not depend on a frame. Everything from the manifests down does.
   *
   * Subject is all three roots, the same three channel F compares against.
   * `captureFreshness()` is not called because it walks `lib/` alone.
   * DISPATCH §3 — a SKIP is not a pass. */
  {
    const subj = ["lib", "app", "components"]
      .map((d) => newestUnder(join(ROOT, d)))
      .filter((x) => x.file)
      .sort((x, y) => y.ms - x.ms)[0]
    const rel = (f) => (f && f.startsWith(ROOT) ? f.slice(ROOT.length + 1) : f)
    const stamp = (ms) => new Date(ms).toLocaleString()
    let stale = false
    for (const [d, n] of [[a, LABEL], [b, PRIOR]]) {
      const cap = newestCapture(d, /\.png$/)
      const fresh = Boolean(cap.file) && Boolean(subj?.file) && subj.ms <= cap.ms
      if (!fresh) stale = true
      record(
        `PROVENANCE · the "${n}" scrub frames post-date every source under lib/ app/ components/`,
        fresh,
        cap.file && subj?.file
          ? fresh
            ? `newest frame ${rel(cap.file)} ${stamp(cap.ms)} · newest source ${rel(subj.file)} ${stamp(subj.ms)}`
            : `STALE BY ${((subj.ms - cap.ms) / 3600000).toFixed(1)}h — newest frame ${rel(cap.file)} ${stamp(cap.ms)} ` +
              `but ${rel(subj.file)} was written ${stamp(subj.ms)}. Re-capture with ` +
              `node scripts/verify/verify-hero-transition.mjs --label=${n}${n === PRIOR ? " --carve=prior" : ""}; do NOT relax this row.`
          : `no PNGs under ${rel(d)}, or no source under lib/ app/ components/ — the comparison cannot be made`,
      )
    }
    if (stale) {
      console.log(
        "\n⚠ NO PIXEL VERDICT. The stored scrub frames predate the code they would\n" +
          "  be judging, so nothing below the model rows describes tonight's carve.",
      )
      process.exit(1)
    }
  }

  const mA = JSON.parse(readFileSync(join(a, "manifest.json"), "utf8"))
  const mB = JSON.parse(readFileSync(join(b, "manifest.json"), "utf8"))

  /* THE ARMS ARE READ OFF THE CAPTURES, not off their directory names. A run
   * that pointed both labels at the same arm would otherwise pass row 3's first
   * clause perfectly and mean nothing. */
  if (!(mA.carvePeak > 0 && mB.carvePeak === 0)) {
    console.error(
      `the two captures are not the two arms: "${LABEL}" carvePeak ${mA.carvePeak}, ` +
        `"${PRIOR}" carvePeak ${mB.carvePeak} (need > 0 and exactly 0). Re-capture.`,
    )
    process.exit(2)
  }
  /* THE MODEL THE CAPTURES WERE TAKEN AT, AGAINST THE MODEL AS IT STANDS NOW.
   *
   * ⚠ WITHOUT THIS ROW EVERY MODEL CONSTANT IN THIS FILE IS UNGUARDED, proven
   * by execution: `assert-gate-integrity` channel D moved
   * `DEFAULT_HERO_MOTION.carveAmount` 0.7 -> 1.12 and `.fps` 30 -> 48 and this
   * gate stayed green on both. It is a two-STORED-capture differential, so the
   * pixels it grades were made before the mutation and cannot move — but the
   * numbers it PRINTS ("shipped: carveLaw pen, carveAmount 0.7") come from the
   * live model, so a run could report a shipped amplitude the frames were never
   * taken at and nothing would say so. That is the stale-arm class one level in.
   *
   * The capture writes what it ran at into its manifest, so the two can simply
   * be compared. This is also the only row here that notices a carve default
   * changing without a re-capture — which is exactly when these stored arms stop
   * describing the build. */
  const shipAmt = Math.max(0, Math.min(1, P.carveAmount))
  record(
    "the captures were taken at the carve the model still ships",
    mA.carvePeak === undefined || Math.abs(mA.carvePeak - shipAmt) < 1e-6,
    `capture "${LABEL}" carvePeak ${mA.carvePeak} · DEFAULT_HERO_MOTION.carveAmount ${P.carveAmount}` +
      (mA.carvePeak === undefined
        ? " — this capture predates the manifest field; re-capture to gate it"
        : Math.abs(mA.carvePeak - shipAmt) < 1e-6
          ? " (same build)"
          : " — THE MODEL MOVED SINCE THIS CAPTURE. Re-capture both arms; the verdicts below describe a carve that no longer ships."),
  )

  if (mA.frames !== mB.frames) {
    console.error(`frame counts differ: ${mA.frames} vs ${mB.frames}. Re-capture both.`)
    process.exit(2)
  }

  let sameOn = 0
  let sameMoved = 0
  let onWorst = 0
  let offN = 0
  let offMoved = 0
  let offWorst = 0
  /* ⚠ FRAMES WITH NO MARK ON THE PAGE ARE EXCLUDED FROM THE "MUST DIFFER"
   * CLAUSE, AND THE EXCLUSION IS MEASURED RATHER THAN INDEXED.
   *
   * Found by running it: 70 of 71 carve-1 frames differed and one did not, which
   * looked like a hole in the carve until the frame was identified. It is the
   * first scrub sample — t = 0, phase `draw`, reveal 0 — where the pen has not
   * put ink on the page yet. The carve is an OCCLUSION: it can only remove ink,
   * so on a frame with no ink it is identically a no-op on both arms, by
   * construction and not by accident.
   *
   * Excluding it by frame INDEX would be a scoped-out clause one retime away
   * from hiding a real tie, so the test is "does this frame have any ink at
   * all", the count is printed, and any frame that has ink and still ties is a
   * failure. */
  let emptyExcluded = 0
  const tied = []
  /* THE BLIND CONTROL'S COUNTERS — the same comparison, on the same capture
   * twice. `blindMoved` is what the "arms DO differ" clause would score if it
   * were pointed at one arm; it must be ZERO on every carve-1 frame, or that
   * clause cannot tell a real park from a byte-compare with itself. */
  let blindMoved = 0

  /* ── IS THIS PAIR COMPARABLE AT ALL? — asked BEFORE `diffFrames`, because
   *    `diffFrames` cannot ask it and cannot survive the answer.
   *
   * MEASURED 2026-09-04, on this repo's own evidence: the capture at
   * hero-transition/carve-prior held 2 of its 72 emerge frames at 1120x1242
   * while the other 70 were 1120x842. The hero stage resized under the capture,
   * which is the hazard `verify-hero-transition.mjs` warns about in its own
   * viewport comment. It is not hypothetical and it is not rare.
   *
   * `diffFrames` walks ONE index across two buffers. Across a size change that
   * index means a different place in each picture, and the verdict it returns is
   * ZERO — "the same picture" — in BOTH directions:
   *
   *   y LONGER   (842 against 1242) every read is defined, so it silently
   *              compares the taller frame's TOP 842 rows and calls two
   *              differently-framed pictures identical.
   *   y SHORTER  (1242 against 842) the tail reads `undefined`, `|x - undefined|`
   *              is NaN, `NaN > 2` is FALSE, and the unread pixels are excluded
   *              from the count rather than failing it.
   *
   * That is the same arithmetic `assert-fusion-combo-liveness.mjs` documents at
   * length — a missing value is not greater than anything — landing on the park
   * row, which needs `offMoved === 0` and is this gate's headline claim. A
   * comparison that did not happen must not read as a comparison that found
   * nothing.
   *
   * A refused pair is dropped from the counts, which would be its own silent
   * degradation if it were the end of it. It is not: `geomRefused` fails a row
   * of its own, so a run that drops a frame cannot report a clean table. */
  const comparable = (x, y) => x.length === y.length
  const geomRefused = []
  /** One real decoded frame, kept so the control below runs on pixels off this
   *  capture rather than on an array invented for the test. */
  let firstLuma = null

  /** ONE comparison, used for both the real pair and the blind pair. */
  const diffFrames = (x, y) => {
    let n = 0
    let worst = 0
    for (let p = 0; p < x.length; p++) {
      const d = Math.abs(x[p] - y[p])
      if (d > 2) n++
      if (d > worst) worst = d
    }
    return { n, worst }
  }

  for (let i = 0; i < mA.manifest.length; i++) {
    const rowA = mA.manifest[i]
    const f = String(rowA.i).padStart(4, "0") + ".png"
    const pa = join(a, "scrub", f)
    const pb = join(b, "scrub", f)
    if (!existsSync(pa) || !existsSync(pb)) continue
    const la = await frameLuma(pa)
    const lb = await frameLuma(pb)
    if (firstLuma === null) firstLuma = la
    if (!comparable(la, lb)) {
      geomRefused.push(`f${rowA.i} "${rowA.phase}": ${la.length}px against ${lb.length}px`)
      continue
    }
    const { n, worst } = diffFrames(la, lb)
    let ink = 0
    for (let p = 0; p < la.length; p++) if (la[p] <= 150) ink++
    if ((rowA.carve ?? 0) > 0) {
      if (ink === 0) {
        emptyExcluded++
        continue
      }
      sameOn++
      sameMoved += n > 0 ? 1 : 0
      if (n === 0) tied.push(`f${rowA.i} t=${rowA.t}s "${rowA.phase}" ink ${ink}px`)
      if (worst > onWorst) onWorst = worst
      /* THE CONTROL, on the same frame, through the same function: the shipped
       * arm against ITSELF. Until 2026-08-07 this was `--mutate=blind`, which
       * re-pointed `b` at `a` — the input this line reproduces — and no sweep
       * ever typed it. */
      blindMoved += diffFrames(la, la).n > 0 ? 1 : 0
    } else {
      offN++
      offMoved += n > 0 ? 1 : 0
      if (worst > offWorst) offWorst = worst
    }
  }

  /* REPORTED BEFORE THE PARK, because the park's verdict is only worth reading
   * once every pair under it was actually a pair. */
  record(
    "every graded pair is the SAME GEOMETRY — a stage that resized mid-capture is REFUSED, never compared through an index",
    geomRefused.length === 0,
    geomRefused.length
      ? `${geomRefused.length} pair(s) refused: ${geomRefused.slice(0, 4).join(" · ")}. Re-capture BOTH arms; ` +
        `an index-wise diff across a size change is not a comparison.`
      : `${offN + sameOn + emptyExcluded} pairs, one geometry on both arms`,
  )
  /* AND THE CONTROL, on this capture's own pixels, through the same predicate.
   * The second clause is the point: it shows what `diffFrames` ALONE returns on
   * a mismatched pair — 0 moved, "identical" — which is the false green the row
   * above exists to stop, stated as arithmetic rather than as a warning. */
  {
    const short = firstLuma ? firstLuma.subarray(0, firstLuma.length - 1) : null
    const blindN = firstLuma ? diffFrames(firstLuma, short).n : -1
    record(
      "CONTROL · a mismatched pair IS refused, and `diffFrames` alone would have called it IDENTICAL",
      firstLuma !== null && comparable(firstLuma, short) === false && blindN === 0,
      firstLuma
        ? `a real frame off this capture (${firstLuma.length}px) against itself one pixel short ` +
          `(${short.length}px): comparable() -> ${comparable(firstLuma, short)} (needs false), ` +
          `diffFrames() -> ${blindN} moved (needs 0 — that zero is the defect, and it is why the ` +
          `length test cannot live inside diffFrames)`
        : "NO FRAME WAS DECODED — the control could not run, so the row above is unproven",
    )
  }

  record(
    "§0.7 THE PARK — where the model publishes carve 0 the two arms are the SAME PICTURE",
    offMoved === 0 && offN > 0,
    `${offN - offMoved} of ${offN} carve-0 frames identical (worst channel delta ${offWorst.toFixed(1)} luma, ` +
      `needs 0 frames moved). These are the solid half of the beat: the carve may not touch a shipped, ` +
      `gated picture while it is nominally off.`,
  )
  /** The "arms DO differ" predicate itself, so the control below can be handed
   *  the blind pair's counts instead of a restatement of the clause. */
  const armsDiffer = (moved, n) => moved === n && n > 0
  record(
    "  ...and the arms DO differ where the carve is ON — the compare is not blind",
    armsDiffer(sameMoved, sameOn),
    `${sameMoved} of ${sameOn} carve-1 frames WITH INK ON THE PAGE differ (worst channel delta ` +
      `${onWorst.toFixed(1)} luma, needs every one of them)` +
      (tied.length ? ` — TIED: ${tied.slice(0, 4).join(" · ")}` : "") +
      `. ${emptyExcluded} frame(s) excluded for carrying no ink at all — the carve is an ` +
      `occlusion, so on an empty page it is a no-op on both arms by construction. Without this ` +
      `clause the row above passes on a capture compared with itself, which is the ` +
      `green-that-cannot-fail this repo keeps shipping.`,
  )

  /* THE BLIND CONTROL'S ROW — on the bare invocation, per explainer 21 §7.
   *
   * The row above is the ONLY thing standing between this file and a
   * byte-compare of a capture with itself. So the same comparison is run on
   * exactly that input, and it is required to find NOTHING: if a self-compare
   * ever reported a difference, the "arms DO differ" clause could be satisfied
   * by two pointers at one arm and the park row above would mean nothing. */
  record(
    "CONTROL · that same clause REJECTS a capture compared with ITSELF — the compare cannot pass on one arm twice",
    !armsDiffer(blindMoved, sameOn) && sameOn > 0,
    `the identical predicate, handed the self-pair, scores ${blindMoved} of ${sameOn} carve-1 frames ` +
      `differing and returns ${armsDiffer(blindMoved, sameOn)} (needs false). The real pair scores ` +
      `${sameMoved} of the same ${sameOn} and returns ${armsDiffer(sameMoved, sameOn)}. Same function, ` +
      `same frames — only the second operand changes.`,
  )

  /* ONE EXEMPTION, AND IT IS THE HARNESS'S OWN SHADOW.
 *
 * React's hydration-mismatch warning is UNAVOIDABLE on an arm whose dev law is
 * injected client-side into an SSR page. The server renders `data-hero-carve`
 * from the shipped law and the client re-renders it from the injected one, so
 * the attribute genuinely differs and React genuinely says so.
 *
 * PROVEN, not assumed, with a control capture on 2026-09-04:
 *   --carve=prior (differs from the shipped law) -> 1 error, the mismatch
 *   --carve=pen   (IS the shipped law, injected) -> 0 errors
 *   no injection at all                          -> 0 errors
 * Injecting is not what does it. Injecting a DIFFERENT VALUE is, which is the
 * one thing a comparison arm exists to do.
 *
 * Narrow on purpose: only this message, and only on the PRIOR arm. A real error
 * on either arm, and any second message on the prior arm, still fails. */
  const HYDRATION = "A tree hydrated but some attributes"
  const priorErrs = (mB.errors ?? []).filter((e) => !String(e).includes(HYDRATION))
  const exempted = (mB.errors ?? []).length - priorErrs.length
  record(
    "console clean on both arms",
    (mA.errors ?? []).length === 0 && priorErrs.length === 0,
    `${(mA.errors ?? []).length} on "${LABEL}" + ${priorErrs.length} on "${PRIOR}"` +
      (exempted
        ? ` (${exempted} hydration-mismatch warning(s) exempted: the injected law differs from the SSR one, proven by control)`
        : ""),
  )

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} rows hold`)
  console.log(
    `arms: "${LABEL}" carveLaw ${mA.carveLaw} peak ${mA.carvePeak} · ` +
      `"${PRIOR}" carveLaw ${mB.carveLaw} peak ${mB.carvePeak}` +
      `\nshipped: carveLaw "${P.carveLaw}", carveAmount ${P.carveAmount}`,
  )

  console.log(failed.length ? "\nNOT SOUND" : "\nSOUND")
  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
