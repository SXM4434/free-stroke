// GATE 1'S OWN STATISTIC — the ink INTERIOR, not the outline.
//
// `assert-hero-transition.mjs` gate 1 is *"a flat drawn mark is ONE VALUE
// inside a hard silhouette"*, measured as the standard deviation of ink
// luminance after eroding the mask so the antialiased boundary is not counted.
// K7's paper break has to keep that true — it is the hard constraint on the
// whole shot — so the K7 assertion needs the same statistic.
//
// ⚠ THE CONSTANTS ARE RESTATED, AND THEREFORE CHECKED. This is the second copy
// of a law, which is the defect class this repo pays for most often, so it is
// treated the way `_hero-word.mjs` treats the settings it cannot import: the
// source file is GREPPED on import and this module throws if either number has
// moved. `assert-hero-transition.mjs` is on the must-not-regress list for the
// lane that added this, so extracting the original was not an option; making
// the copy falsifiable was.
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")

/** assert-hero-transition.mjs — `INK_MAX_LUMA`. */
export const INK_MAX_LUMA = 150
/** assert-hero-transition.mjs — `ERODE`. */
export const ERODE = 3
/** assert-hero-transition.mjs — the chrome-excluding crop. */
export const HEIGHT_FRAC = 0.75

/**
 * ── THE COVERAGE RESIDUE, AND WHY GATE 1'S STATISTIC HAD TO CHANGE ──────────
 *
 * Gate 1 is *"a flat drawn mark is ONE VALUE inside a hard silhouette"*, and
 * that claim is non-negotiable. What changed is not the claim; it is the
 * ESTIMATOR, because the estimator had a blind spot the pen carve walked
 * straight into and the picture it rejected was correct.
 *
 * THE INPUT THAT BROKE IT, measured (`assert-pen-carve.mjs`, 2026-08-01):
 * at full carve the interior is 4151 px, **4148 of them at exactly luma 21** and
 * three of them not — histogram `21x4148 26x1 33x1 100x1`, so the standard
 * deviation reads **1.256** against a ceiling of 1 and the spread reads 79
 * against a ceiling of 8. The three pixels are at (733,367), (733,368) and
 * (734,373); the crop at `docs/verification/pen-carve/_outlier2.png` shows what
 * they are — the tip of a HAIRLINE PAPER GAP the carve correctly opens between
 * two strokes of the "D" that only the fat tube had fused.
 *
 * THE MECHANISM, and it is a property of the erosion rather than of the render.
 * The interior is an ISOTROPIC 3-px erosion of the ink mask, and its own comment
 * says exactly what it is for: *"a hard-edged black silhouette on pale paper has
 * a one-pixel boundary ramp that takes EVERY value between ink and paper... The
 * statistic was measuring the edge and calling it shading."* That is right, and
 * it is only half the story: erosion removes ramp pixels that lie a known
 * distance from a MASK boundary. A sub-pixel CONCAVE notch has no mask boundary
 * — the gap never gets light enough to cross the 150-luma threshold, so all 48
 * of that pixel's neighbours are ink and the erosion cannot reach it. The ramp
 * survives INSIDE the interior, by construction, and no amount of eroding
 * further will find it.
 *
 * So those pixels are COVERAGE samples, not SURFACE samples: their value is a
 * blend with the paper and carries no information whatsoever about shading. A
 * sub-pixel gap rendered with multisample coverage MUST produce a partial pixel
 * — the alternative is an aliased hairline, which is the "jaggedy" tell.
 *
 * THE FIX IS THE ESTIMATOR, AND THE TOLERANCE IS CALIBRATED, NOT PICKED.
 * `flatValueStats` reports a TRIMMED sd and spread beside the raw ones, and
 * bounds the residue explicitly. `FLAT_TRIM` is used for both — we tolerate
 * exactly as much residue as we discard — and every number below was produced by
 * `scripts/verify/_probe-flat-value.mjs` on the real frames:
 *
 *   arm                            interior   off-modal        raw sd / spread
 *   flat, CARVED                     4 151   3  (0.0723 %)     1.256 / 79.9
 *   flat, uncarved                  12 895   0  (0 %)          0.000 /  0.0
 *   BEFORE — lit tubes head-on ⛔     9 214   7 774 (84.37 %)   5.812 / 65.6
 *
 * THE RESIDUE IS THE DISCRIMINATOR AND IT IS NOT CLOSE: 0.0723 % against
 * 84.37 %, three orders of magnitude apart. A coverage artefact lives on a
 * one-pixel-wide curve, so it is O(perimeter); shading is a property of the
 * whole surface, so it is O(area). They cannot be confused by a bound on count.
 *
 * AND THE TRIM CANNOT LAUNDER THE NEGATIVE CONTROL. The same probe sweeps the
 * trim fraction until `before/` would start to pass:
 *
 *   sd < 1      first passes at trim **36.40 %**
 *   spread < 8  first passes at trim **22.45 %**
 *
 * 0.5 % is **45x** below the nearer of those and **7x** above the residue it has
 * to absorb. That is the whole justification: it sits an order of magnitude
 * clear of the defect in one direction and an order of magnitude clear of the
 * artefact in the other, and both ends are measured rather than argued.
 * `assert-hero-transition.mjs --mutate=shading|notch|speckle` are the three
 * controls that keep it honest — shading must go red, a residue inside the bound
 * must stay green, and a residue past the bound must go red.
 */
export const FLAT_TRIM = 0.005

/**
 * The value statistics gate 1 and gate 2 read, from a list of interior luma —
 * raw AND robust, so the change is visible rather than described.
 *
 * ONE IMPLEMENTATION, deliberately: `assert-hero-transition.mjs` (which owns the
 * gate), `assert-flat-silhouette.mjs`, `assert-hero-k7-news.mjs` and
 * `assert-pen-carve.mjs` all ask this same question, and four copies of one
 * robust estimator is how three of them end up on the old one.
 */
export function flatValueStats(values) {
  const n = values.length
  if (n === 0) {
    return {
      n: 0, mean: 0, sd: 0, min: 0, max: 0, spread: 0,
      modal: 0, offModal: 0, residue: 0, residueMax: FLAT_TRIM,
      sdTrim: 0, spreadTrim: 0, trimCut: 0, outliers: [],
    }
  }
  let sum = 0
  let sumSq = 0
  let min = Infinity
  let max = -Infinity
  const hist = new Map()
  for (const v of values) {
    sum += v
    sumSq += v * v
    if (v < min) min = v
    if (v > max) max = v
    const k = Math.round(v)
    hist.set(k, (hist.get(k) ?? 0) + 1)
  }
  const mean = sum / n
  let modal = 0
  let best = -1
  for (const [k, c] of hist) if (c > best) ((best = c), (modal = k))

  /* THE RESIDUE — how much of the interior is NOT at the mark's one value. This
   * is the statistic that separates a hairline from a shading, and it is the
   * same one `assert-pen-carve.mjs` row 4 asks, so the two files cannot disagree
   * about what "one value" means. */
  let offModal = 0
  const outliers = []
  for (let i = 0; i < n; i++) {
    if (Math.abs(values[i] - modal) > 1) {
      offModal++
      if (outliers.length < 8) outliers.push(Math.round(values[i]))
    }
  }

  /* THE TRIMMED PAIR — the surface, with the coverage residue discarded from
   * both ends. Symmetric on purpose: a coverage pixel is always BRIGHTER than
   * the ink it blends with the paper, but privileging that direction would make
   * the estimator one-sided against exactly the highlight gate 2 exists to
   * catch, and the whole point is that this must not become easier to pass. */
  const sorted = Float64Array.from(values).sort()
  const cut = Math.floor(FLAT_TRIM * n)
  const lo = cut
  const hi = n - cut
  let ts = 0
  let ts2 = 0
  const tn = Math.max(1, hi - lo)
  for (let i = lo; i < hi; i++) {
    ts += sorted[i]
    ts2 += sorted[i] * sorted[i]
  }
  const tmean = ts / tn
  return {
    n,
    mean,
    sd: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
    min,
    max,
    spread: max - min,
    modal,
    offModal,
    residue: offModal / n,
    residueMax: FLAT_TRIM,
    sdTrim: Math.sqrt(Math.max(0, ts2 / tn - tmean * tmean)),
    spreadTrim: hi > lo ? sorted[hi - 1] - sorted[lo] : 0,
    trimCut: cut,
    outliers,
  }
}

function assertMirrorsGate() {
  const src = readFileSync(join(ROOT, "scripts/verify/assert-hero-transition.mjs"), "utf8")
  const want = [
    [`const INK_MAX_LUMA = ${INK_MAX_LUMA}`, "INK_MAX_LUMA"],
    [`const ERODE = ${ERODE}`, "ERODE"],
    [`img.height * ${HEIGHT_FRAC}`, "the chrome crop"],
    // The gate must still be ASKING the robust question. Without this row the
    // gate could quietly revert to `flat.sd < 1` and every consumer of this
    // module would keep reporting a trimmed number nobody gates on.
    ["flatValueStats", "the robust value statistic (flatValueStats)"],
    ["sdTrim", "the trimmed sd in the gate-1 verdict"],
  ]
  for (const [needle, what] of want) {
    if (!src.includes(needle)) {
      throw new Error(
        `flat-interior: ${what} no longer matches assert-hero-transition.mjs ` +
          `(looked for \`${needle}\`). Update this file; do NOT adjust the measurement.`,
      )
    }
  }
}
assertMirrorsGate()

/**
 * Every statistic gate 1 reads, derived from a luminance field.
 *
 * Split out from the decode so a MUTATED frame goes through the identical
 * pipeline. A control that perturbs the pixels but skips the erosion is a
 * control that cannot fire — which is exactly what happened the first time
 * this file's `--mutate=alpha` was run: the blend was applied to boundary
 * pixels only, the un-recomputed interior never saw it, and the row it was
 * built to break stayed green.
 *
 * @param {Float32Array} luma
 */
export function interiorStats(luma, W, H) {
  const mask = new Uint8Array(W * H)
  let ink = 0
  for (let p = 0; p < W * H; p++) {
    if (luma[p] <= INK_MAX_LUMA) {
      mask[p] = 1
      ink++
    }
  }

  let cur = mask
  for (let pass = 0; pass < ERODE; pass++) {
    const next = new Uint8Array(W * H)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x
        if (!cur[p]) continue
        if (
          cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] &&
          cur[p - W - 1] && cur[p - W + 1] && cur[p + W - 1] && cur[p + W + 1]
        ) {
          next[p] = 1
        }
      }
    }
    cur = next
  }

  const vals = []
  for (let p = 0; p < W * H; p++) if (cur[p]) vals.push(luma[p])
  const v = flatValueStats(vals)
  return {
    W,
    H,
    luma,
    mask,
    interior: cur,
    ink,
    ...v,
  }
}

/**
 * Decode a frame and return the ink mask, the eroded interior mask, and the
 * interior's luminance statistics.
 *
 * @param {Buffer} png
 */
export async function flatInterior(png) {
  const img = await loadImage(png)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * HEIGHT_FRAC)

  const luma = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      const i = p * 4
      luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    }
  }
  return interiorStats(luma, W, H)
}
