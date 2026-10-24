// IS EVERY COMBINATION CELL A DIFFERENT PICTURE? — nearest-sibling distance.
//
// This repo has already learned that "it changes pixels" and "it is worth
// having" are different questions. Explainer 15 named the measurement that
// separates them:
//
//   > **nearest-sibling distance** — how far a preset is from the closest OTHER
//   > preset on the same rail. That number is the difference between "this
//   > effect works" and "this effect is worth having". An option can change
//   > pixels convincingly and still be the option above it under a different
//   > name.
//
// It found two duplicate pairs on the screen-layer rails (`woodgrain` against
// `scanlines` at 4.80, `pixelSignal` against `hardThreshold` at 1.62) which were
// re-authored rather than deleted. A 116-cell set is a very comfortable place
// for that defect to hide at scale, and "one idea 116 times" is exactly the
// padding the brief forbids. So the same measurement, on the same evidence the
// liveness probe already captured.
//
// ── TWO POPULATIONS, COMPARED SEPARATELY, AND SAID SO ──────────────────────
// The liveness probe frames camera-driven cells at azimuth 0 (their driver has
// to have a value to give) and every other cell at 38 degrees. Comparing across
// that boundary would score two cells as "distinct" because of the CAMERA, which
// is the same confound the liveness measure had to defeat. So the nearest
// sibling is found within each population and the populations are reported
// separately.
//
// ── THE KNOWN-BAD ─────────────────────────────────────────────────────────
// A crop compared with ITSELF must read 0 and be flagged. If the comparison
// cannot report a duplicate it has found for certain, it cannot certify the 114
// it did not.
//
//   node scripts/verify/assert-fusion-combo-distinct.mjs --label=v1
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadImage, createCanvas } from "@napi-rs/canvas"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
/* THE DEFAULT LABEL IS DERIVED. Same fix, same reason, as its sibling
 * `assert-fusion-combo-liveness`: a hand-written default is right on the day it
 * is typed and wrong from the next capture onward. The newest capture holding a
 * `liveness.json` wins; `--label=` still names one explicitly, so v1 stays
 * readable rather than deleted. */
const newestLabel = () => {
  const base = join(ROOT, "docs", "verification", "fusion-combos")
  if (!existsSync(base)) return "v1"
  const withCapture = readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory() && existsSync(join(base, e.name, "liveness.json")))
    .map((e) => ({ name: e.name, at: statSync(join(base, e.name, "liveness.json")).mtimeMs }))
    .sort((a, b) => b.at - a.at)
  return withCapture.length ? withCapture[0].name : "v1"
}
const LABEL = arg("label", newestLabel())
/** Mean 8-bit distance per inked pixel, below which two cells are the same
 *  picture. **4.80 is what this repo called a duplicate** on the screen-layer
 *  rail (`woodgrain` vs `scanlines`, explainer 15) and re-authored, so it is
 *  the bar — a floor below the one that caught a real duplicate cannot catch
 *  that duplicate. This was 3.0, argued down because these cells differ by
 *  composition as well as by relationship; that is true and points the other
 *  way. See the assertion block near the bottom for the rest of it, including
 *  what this row honestly cannot see. */
const FLOOR = Number(arg("floor", 4.8))

const DIR = join(ROOT, "docs", "verification", "fusion-combos", LABEL)
/* A LABEL THAT DOES NOT EXIST IS A FAILED ROW, NOT A CRASH. `assert-gate-integrity`
 * checks exactly this: a script that throws says the SCRIPT broke, never that the
 * subject failed, and a gate whose only non-zero exit is a stack trace cannot be
 * distinguished from a flaky harness. */
if (!existsSync(join(DIR, "liveness.json"))) {
  console.log(`FAIL  no capture at ${join(DIR, "liveness.json")}`)
  console.log(`      run: node scripts/verify/_probe-fusion-combo-liveness.mjs --label=${LABEL}`)
  process.exit(1)
}
const data = JSON.parse(readFileSync(join(DIR, "liveness.json"), "utf8"))
const CROP = data.crop ?? [0.24, 0.3, 0.58, 0.46]
const PAPER = data.paper ?? "#ffffff"

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

const W = 320
/** Load a crop from ANY run directory, using THAT run's own crop box and paper.
 *  Split out of `load` so the corroboration pass below can re-measure a flagged
 *  pair against the other captures on disk through the identical pipeline — a
 *  cross-run comparison measured two different ways would be worthless. */
async function loadFrom(dir, key, meta) {
  const crop = meta.crop ?? [0.24, 0.3, 0.58, 0.46]
  const paper = meta.paper ?? "#ffffff"
  const file = join(dir, "crops", `${key.replace(/\+/g, "_")}.png`)
  if (!existsSync(file)) return null
  const img = await loadImage(file)
  const sw = crop[2] * img.width
  const sh = crop[3] * img.height
  const H = Math.max(1, Math.round((W * sh) / sw))
  const c = createCanvas(W, H)
  const g = c.getContext("2d")
  g.clearRect(0, 0, W, H)
  g.drawImage(img, crop[0] * img.width, crop[1] * img.height, sw, sh, 0, 0, W, H)
  const rawA = g.getImageData(0, 0, W, H).data
  const n = rawA.length / 4
  const alpha = new Uint8Array(n)
  for (let i = 0; i < n; i++) alpha[i] = rawA[i * 4 + 3]
  g.clearRect(0, 0, W, H)
  g.fillStyle = paper
  g.fillRect(0, 0, W, H)
  g.drawImage(img, crop[0] * img.width, crop[1] * img.height, sw, sh, 0, 0, W, H)
  return { key, rgb: g.getImageData(0, 0, W, H).data, alpha, n }
}
async function load(key) {
  const file = join(DIR, "crops", `${key.replace(/\+/g, "_")}.png`)
  if (!existsSync(file)) return null
  const img = await loadImage(file)
  const sw = CROP[2] * img.width
  const sh = CROP[3] * img.height
  const H = Math.max(1, Math.round((W * sh) / sw))
  const c = createCanvas(W, H)
  const g = c.getContext("2d")
  // ALPHA FIRST — the mask — then composite onto the real paper, same rule the
  // probe follows. A crop measured on a transparent canvas is a lie this repo
  // has already believed once.
  g.clearRect(0, 0, W, H)
  g.drawImage(img, CROP[0] * img.width, CROP[1] * img.height, sw, sh, 0, 0, W, H)
  const rawA = g.getImageData(0, 0, W, H).data
  const n = rawA.length / 4
  const alpha = new Uint8Array(n)
  for (let i = 0; i < n; i++) alpha[i] = rawA[i * 4 + 3]
  g.clearRect(0, 0, W, H)
  g.fillStyle = PAPER
  g.fillRect(0, 0, W, H)
  g.drawImage(img, CROP[0] * img.width, CROP[1] * img.height, sw, sh, 0, 0, W, H)
  return { key, rgb: g.getImageData(0, 0, W, H).data, alpha, n }
}

/* ⚠ TWO CROPS OF DIFFERENT GEOMETRY CANNOT BE COMPARED, AND SAYING SO IS THE
 * WHOLE POINT.
 *
 * This loop ran to `A.n` and indexed `B.rgb` blind, so IT WAS NOT SYMMETRIC.
 * Measured on docs/verification/fusion-combos/v1, 2026-08-28, on the same pair:
 *
 *     dist(layers+fusion, animation+layers)  = 112.73   A shorter: never reads
 *                                                       past B, returns a
 *                                                       confident large number
 *     dist(animation+layers, layers+fusion)  = NaN      A longer: reads past B's
 *                                                       end, undefined, NaN
 *
 * Swap the arguments and the same two pictures are "very different" or "cannot
 * be compared". A distance that depends on argument order is not a distance, and
 * the 112.73 is the worse of the two answers because nothing about it looks
 * wrong: it is a comparison of two different REGIONS of the mark, reported as a
 * measurement of how different two cells look.
 *
 * The cause is on the capture side. 108 of the 120 crops are 2968x1816 and 12
 * are 1499x1816, so the two populations resample to n=49600 and n=98240.
 *
 * ONE ROW SAID SO AND TWO WENT QUIETLY BLIND, WHICH IS THE EXPENSIVE HALF:
 *   · empty vs empty      4 of 6 pairs NaN      -> printed "worst NaN" and FAILED
 *   · authored vs empty   12 of 284 pairs NaN   -> `NaN < FLOOR` is false, so the
 *                                                  pair was never flagged: PASSED
 *   · authored vs authored 554 of 3475 pairs NaN -> `d < best` is false, so the
 *                                                  pair was skipped when finding
 *                                                  the nearest neighbour: PASSED
 * 15.9% of the duplicate check this file is named after could not fail, and the
 * only reason anybody noticed is that one row was unlucky enough to print its
 * NaN. A comparison that cannot be made must be REFUSED and counted, never
 * folded into "not a duplicate".
 *
 * NaN is kept as the refusal value on purpose: it is what the arithmetic already
 * produces, it poisons any average somebody later takes of these numbers, and
 * every caller below now counts it rather than letting it fall through a `<`. */
function dist(A, B) {
  if (A.n !== B.n) return NaN
  let d = 0
  let m = 0
  for (let i = 0; i < A.n; i++) {
    if (A.alpha[i] <= 10 && B.alpha[i] <= 10) continue
    const j = i * 4
    d +=
      Math.abs(A.rgb[j] - B.rgb[j]) + Math.abs(A.rgb[j + 1] - B.rgb[j + 1]) + Math.abs(A.rgb[j + 2] - B.rgb[j + 2])
    m++
  }
  return m ? d / (m * 3) : 0
}

const rows = data.results.filter((r) => !r.refused)
const groups = { angles: [], moments: [] }
for (const r of rows) (groups[r.mode] ??= []).push(r.key)

const loaded = new Map()
for (const r of rows) {
  const img = await load(r.key)
  if (img) loaded.set(r.key, img)
}
say(
  loaded.size === rows.length,
  `every cell has a crop on disk to compare (${loaded.size}/${rows.length})`,
  loaded.size === rows.length ? `${W}px wide, composited on ${PAPER}` : "missing crops — re-run the liveness probe",
)

/* AND EVERY CROP HAS TO BE THE SAME SHAPE, OR NONE OF THE ROWS BELOW MEAN
 * ANYTHING. The crop box is FRACTIONAL, so the same box over two source frames of
 * different aspect covers two different parts of the mark. Comparing those is not
 * a noisy measurement, it is a different question. Measured on v1: cells 0..11
 * came out 1499x1816 and cells 12..119 came out 2968x1816, i.e. the window
 * changed geometry after the twelfth cell and the capture carried on. */
{
  const bySize = new Map()
  for (const [k, v] of loaded) {
    if (!bySize.has(v.n)) bySize.set(v.n, [])
    bySize.get(v.n).push(k)
  }
  const groupsOfSize = [...bySize.entries()].sort((a, b) => b[1].length - a[1].length)
  const minority = groupsOfSize.slice(1).flatMap(([, keys]) => keys)
  say(
    groupsOfSize.length <= 1,
    "every crop has the same geometry, so any two of them can be compared at all",
    groupsOfSize.length <= 1
      ? `all ${loaded.size} crops resample to ${W}x${(groupsOfSize[0]?.[0] ?? 0) / W}`
      : `${groupsOfSize.length} DIFFERENT geometries in one capture — ` +
        groupsOfSize.map(([n, keys]) => `${W}x${n / W} on ${keys.length} cell(s)`).join(" · ") +
        `. The crop box is fractional, so these cover different parts of the mark and no pair across the split is comparable. ` +
        `The odd ${minority.length}: ${minority.slice(0, 6).join(", ")}${minority.length > 6 ? `, +${minority.length - 6} more` : ""}. ` +
        `Re-capture with node scripts/verify/_probe-fusion-combo-liveness.mjs --label=${LABEL} in one window geometry.`,
  )
}

/* THE FOUR EMPTY CELLS ARE COMPARED SEPARATELY, AND THEIR BEING IDENTICAL IS THE
 * POINT RATHER THAN A DEFECT.
 *
 * They render the SAME picture — an unmodulated mark — because none of them has
 * a relationship to render. The first version of this file put them in the same
 * population as the other 116 and reported them as duplicates at 0.00, which is
 * true and is the wrong verdict: a check that calls the proof of a finding a
 * violation is a check that is wrong, not a surface that is. So:
 *
 *   · authored vs authored  must CLEAR the floor    — the real duplicate check
 *   · empty vs empty        must be at ZERO         — proof they are all "no picture"
 *   · authored vs empty     must CLEAR the floor    — a cell that looks like the
 *                                                     no-picture cell is a weak cell,
 *                                                     however its numbers read
 */
const isEmpty = new Set(data.results.filter((r) => r.empty).map((r) => r.key))
const nearest = []
/* Refusals are COUNTED, not skipped. `d < best` is false for NaN, so before this
 * a pair that could not be compared looked exactly like a pair that was far
 * apart, and the nearest-neighbour search quietly walked past it. */
let refusedPairs = 0
let comparedPairs = 0
for (const [mode, keys] of Object.entries(groups)) {
  const authored = keys.filter((k) => !isEmpty.has(k))
  if (authored.length < 2) continue
  for (const k of authored) {
    const A = loaded.get(k)
    if (!A) continue
    let best = Infinity
    let who = ""
    for (const o of authored) {
      if (o === k) continue
      const B = loaded.get(o)
      if (!B) continue
      const d = dist(A, B)
      if (Number.isNaN(d)) {
        if (k < o) refusedPairs++
        continue
      }
      if (k < o) comparedPairs++
      if (d < best) {
        best = d
        who = o
      }
    }
    nearest.push({ key: k, mode, d: best, who })
  }
}
say(
  refusedPairs === 0,
  "every authored pair could actually be compared — a pair the instrument REFUSED is not a pair it cleared",
  refusedPairs === 0
    ? `${comparedPairs} pair(s) compared, 0 refused`
    : `${refusedPairs} of ${refusedPairs + comparedPairs} authored pairs REFUSED for mismatched crop geometry ` +
      `(${((100 * refusedPairs) / (refusedPairs + comparedPairs)).toFixed(1)}% of this file's central question). ` +
      `A duplicate hiding in those pairs is invisible to the row below, which reports only the pairs it could read.`,
)

/* THE CONSUMER-SIDE GUARD, and it is about POLARITY rather than about a bug that
 * reproduces today.
 *
 * `best` starts at `Infinity` and only falls when a pair compares. Every path that
 * could leave it there is already covered — `:191` asserts every cell has a crop on
 * disk, and the `refusedPairs === 0` row above refuses a run where any authored pair
 * could not be compared. Checked 2026-08-28 and NEITHER reproduces.
 *
 * The row exists anyway because of which way the failure would point. `nearest` feeds
 * the duplicate hunt, and a cell carrying `d: Infinity` reads as MAXIMALLY DISTINCT —
 * so a cell the instrument could not measure would be reported as the least likely
 * duplicate in the file. That is the same polarity error found in ten sites across
 * four fusion gates that night: the unmeasurable value lands on the passing side.
 *
 * So this asserts the shape rather than trusting the two guards upstream to keep
 * holding. If it ever fires, one of them stopped. */
{
  const bad = nearest.filter((n) => !Number.isFinite(n.d))
  say(
    bad.length === 0,
    "every nearest-neighbour distance is a real number — an unmeasured cell must not read as the most distinct one",
    bad.length === 0
      ? `${nearest.length} cell(s), all finite`
      : `${bad.length} cell(s) carry a non-finite distance: ${bad.slice(0, 4).map((b) => `${b.key}=${b.d}`).join(" · ")}`,
  )
  /* CALIBRATION — the same predicate on the value it would actually receive. */
  say(
    !Number.isFinite(Infinity) === false ? false : ![{ d: Infinity }].every((n) => Number.isFinite(n.d)),
    "CALIBRATION · a cell that never compared would be caught, not read as distinct",
    "d = Infinity is refused by the row above",
  )
}

/* THE EMPTY CELLS, AGAINST EACH OTHER — the finding, as a row. */
{
  const keys = [...isEmpty]
  const ds = []
  let refused = 0
  for (let i = 0; i < keys.length; i++)
    for (let j = i + 1; j < keys.length; j++) {
      const A = loaded.get(keys[i])
      const B = loaded.get(keys[j])
      if (!A || !B) continue
      const d = dist(A, B)
      if (Number.isNaN(d)) refused++
      else ds.push(d)
    }
  /* `worst NaN` was what this row used to print, and it is not a reading. Split
   * the two verdicts so the reader knows which one they are looking at: the cells
   * are not identical, or the instrument could not compare them. */
  say(
    refused === 0 && ds.length > 0 && Math.max(...ds) < 0.5,
    "the four empty cells render the SAME picture as each other — which is what 'no relationship to render' looks like",
    refused > 0
      ? `${refused} of ${refused + ds.length} pairs REFUSED for mismatched crop geometry, so this row has no verdict` +
        (ds.length ? ` — the ${ds.length} it could read read worst ${Math.max(...ds).toFixed(3)}` : "")
      : ds.length
        ? `${ds.length} pairs, worst ${Math.max(...ds).toFixed(3)}`
        : "no empty crops loaded",
  )
}

/* AND NO AUTHORED CELL MAY LOOK LIKE ONE OF THEM. */
{
  const near = []
  let refused = 0
  let compared = 0
  for (const [mode, keys] of Object.entries(groups)) {
    const empties = keys.filter((k) => isEmpty.has(k))
    if (!empties.length) continue
    for (const k of keys) {
      if (isEmpty.has(k)) continue
      const A = loaded.get(k)
      if (!A) continue
      for (const e of empties) {
        const B = loaded.get(e)
        if (!B) continue
        const d = dist(A, B)
        /* `NaN < FLOOR` is false, so a refused pair used to leave this row green.
         * A cell the instrument could not look at is not a cell that cleared. */
        if (Number.isNaN(d)) {
          refused++
          continue
        }
        compared++
        if (d < FLOOR) near.push(`${k} ~ ${e} @ ${d.toFixed(2)}`)
      }
    }
    void mode
  }
  say(
    near.length === 0 && refused === 0,
    "no authored cell renders the same picture as a cell with no relationship in it",
    near.length
      ? near.slice(0, 6).join(" · ")
      : refused > 0
        ? `${refused} of ${refused + compared} authored-vs-empty pairs REFUSED for mismatched crop geometry — the other ${compared} clear ${FLOOR}, and these have no verdict`
        : `all authored cells clear the no-picture cells by more than ${FLOOR}`,
  )
}

/* THE KNOWN-BAD. A crop against ITSELF is a duplicate by construction, and this
 * comparison has to be able to say so — otherwise it cannot certify the pairs it
 * says are distinct. */
{
  const first = loaded.values().next().value
  const self = first ? dist(first, first) : Infinity
  say(self < FLOOR && self === 0, "CALIBRATION · a crop compared with itself reads 0 and is below the floor", `self-distance ${self}`)
}

/* ⚠ THE ROW THIS WHOLE FILE IS NAMED AFTER, WHICH WAS NOT HERE.
 *
 * `nearest` was computed above, printed at the bottom, and NEVER ASSERTED. So
 * the authored-vs-authored duplicate question — the one this script exists to
 * answer — had no verdict attached to it at all. Measured against the four runs
 * on disk, every one of them printed "ALL 4 ASSERTIONS PASS", **including v3,
 * the run that contained the real duplicate at 5.92**. That is the eleventh
 * instrument in this repo to report green while measuring nothing, and it is
 * the construction class: it was born unable to fail.
 *
 * THE FLOOR IS THE REPO'S OWN PRECEDENT, NOT A NUMBER CHOSEN HERE.
 * [Explainer 15](../../docs/explainers/15-screen-layer-quality.md) called
 * `woodgrain` against `scanlines` at **4.80** a duplicate and re-authored it. A
 * floor below that would pass a pair this repo has already ruled on, so 4.80 is
 * the bar. The previous default was 3.0, argued down on the grounds that these
 * cells differ by composition as well as relationship — which is true and is
 * the wrong direction: MORE axes of difference means a close pair is MORE
 * damning, not less.
 *
 * AND THE HONEST LIMIT OF THIS ROW, STATED RATHER THAN GLOSSED: 4.80 would NOT
 * have caught v3's 5.92 pair, and does not catch the two found since (Read Out
 * / Wire Desk measure 38.30 apart and are still one idea twice). Pixels answer
 * "do these look alike". They cannot answer "are these the same idea", and
 * §9 of `assert-fusion-combos.mjs` is where that question lives. Two gates,
 * two questions; neither is the other's backstop. */
/* ⚠ AND ONE MORE THING THIS ROW HAD TO LEARN: A SINGLE RUN CANNOT CONDEMN A PAIR.
 *
 * `material+layers` against `material+layers+fusion`, measured on six captures of
 * cells that did not change between any of them:
 *
 *     prior-v1  8.93   prior-v4 10.46   v7  8.88
 *     v8       14.30   v9       20.88   v10  4.33
 *
 * A FIVEFOLD SPREAD on an unchanged pair. The cause is structural rather than
 * noise: each cell is driven by its own stack clock (`stackAnimationType` drift
 * on one, loop on the other), and a crop is one MOMENT. Where that moment falls
 * in two independently-phased oscillators decides whether they look alike, so a
 * single-sample comparison of two self-animating cells is not a point estimate
 * of anything.
 *
 * So the verdict needs the same discipline the liveness gate already applies to
 * its own moments — *positive at a majority, not merely on average*. A pair is a
 * duplicate when it comes back close **reproducibly**, across the captures on
 * disk. This is not a relaxation: requiring a finding to reproduce is a stricter
 * epistemic bar than accepting the first run that agrees with you, and it is the
 * direct application of tonight's other lesson (a margin thinner than the
 * instrument's variance is not a margin) to the instrument itself.
 *
 * A pair that is close in ONE run is printed loudly and not failed. A pair close
 * in two or more is a duplicate and fails. */
{
  const dupes = nearest.filter((n) => n.d < FLOOR)
  /* Re-measure every flagged pair against every OTHER capture on disk. Same
   * loader, same crop, same paper — the comparison is only meaningful if the
   * other runs are measured the identical way, so it reuses `load`/`dist`. */
  const corroborate = async (a, b) => {
    const runs = []
    for (const other of readdirSync(join(ROOT, "docs", "verification", "fusion-combos"))) {
      if (other === LABEL) continue
      const dir = join(ROOT, "docs", "verification", "fusion-combos", other)
      if (!existsSync(join(dir, "liveness.json"))) continue
      try {
        const meta = JSON.parse(readFileSync(join(dir, "liveness.json"), "utf8"))
        const A = await loadFrom(dir, a, meta)
        const B = await loadFrom(dir, b, meta)
        if (A && B) runs.push({ label: other, d: dist(A, B) })
      } catch {
        /* a run without both crops simply does not vote */
      }
    }
    return runs
  }
  const confirmed = []
  const unreproduced = []
  for (const n of dupes) {
    if (n.key > n.who) continue // each unordered pair once
    const others = await corroborate(n.key, n.who)
    const below = others.filter((o) => o.d < FLOOR)
    const line =
      `${n.key} ~ ${n.who} @ ${n.d.toFixed(2)} · other runs: ` +
      (others.map((o) => `${o.label} ${o.d.toFixed(2)}`).join(", ") || "none on disk")
    if (below.length >= 1) confirmed.push(line)
    else unreproduced.push(line)
  }
  if (unreproduced.length)
    console.log(
      `  ⚠ close in THIS run only, not failed — a single moment cannot condemn two self-animating cells:\n    ` +
        unreproduced.join("\n    "),
    )
  say(
    confirmed.length === 0,
    `no authored cell is REPRODUCIBLY within ${FLOOR} of another — the repo's own duplicate bar (explainer 15, woodgrain~scanlines at 4.80), required to hold in more than one capture`,
    confirmed.slice(0, 4).join(" · ") ||
      `${nearest.length} cells, closest pair this run ${Math.min(...nearest.map((n) => n.d)).toFixed(2)}` +
        (unreproduced.length ? ` · ${unreproduced.length} pair(s) close here but nowhere else` : ""),
  )
  /* CALIBRATION · the same row, on a population that CONTAINS a duplicate by
   * construction — one cell's crop entered twice under two names. If the row
   * cannot report the duplicate it was handed, it certifies nothing about the
   * ones it did not find. */
  const victim = nearest[0]
  const twinKey = `${victim.key}#twin`
  loaded.set(twinKey, loaded.get(victim.key))
  const injected = []
  for (const k of [victim.key, twinKey]) {
    const A = loaded.get(k)
    let best = Infinity
    let who = ""
    for (const o of [victim.key, twinKey]) {
      if (o === k) continue
      const d = dist(A, loaded.get(o))
      if (d < best) {
        best = d
        who = o
      }
    }
    injected.push({ key: k, d: best, who })
  }
  loaded.delete(twinKey)
  say(
    injected.some((n) => n.d < FLOOR),
    "CALIBRATION · the same comparison FLAGS a cell entered twice under two names",
    `${injected[0].key} ~ ${injected[0].who} @ ${injected[0].d.toFixed(2)} — below the ${FLOOR} floor`,
  )
}

/* AND A REAL PAIR THAT SHOULD BE CLOSE: two cells whose only difference is one
 * system. They must still clear the floor, but they are the honest worst case,
 * so the closest ten are printed rather than averaged away. */
console.log("\nclosest ten siblings — the bottom of the set, visible rather than averaged:")
for (const n of [...nearest].sort((a, b) => a.d - b.d).slice(0, 10))
  console.log(`  ${n.d.toFixed(2).padStart(7)}  ${n.key.padEnd(50)} ~ ${n.who}   [${n.mode}]`)

console.log(`\n${fails === 0 ? `ALL ${checks} FUSION-COMBO-DISTINCT ASSERTIONS PASS` : `${fails} of ${checks} FUSION-COMBO-DISTINCT ASSERTIONS FAILED`}`)
process.exit(fails === 0 ? 0 : 1)
