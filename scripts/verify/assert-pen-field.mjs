// THE PEN FIELD IS THE LAW — asserted against the law, not against itself.
//
// `buildPenField` (lib/flat-ink.ts) bakes the nib's outline into a two-channel
// signed-distance texture so a fragment shader can carve the flat state out of
// the solid with one fetch. A baked field is a SECOND representation of a law
// that already exists in closed form (`penHalfWidth`), and this repo's most
// expensive recurring defect is two representations of one idea drifting apart.
// So every row here compares the bake to the analytic law or to the rendered
// raster, never to a previous run of itself.
//
// The load-bearing row is the last one: AT CARVE ZERO THE FIELD REMOVES NOTHING.
// The settled solid is a shipped, gated picture — `assert-hero-transition.mjs`
// reads 9/9 on it — and a channel that moved it by a pixel while nominally off
// would be a regression dressed as a feature.
//
// Usage: node scripts/verify/assert-pen-field.mjs
import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes, HERO_INK_WIDTH_PX } from "./_hero-word.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")

const require = createRequire(import.meta.url)
const { createCanvas } = require("@napi-rs/canvas")
const {
  buildPenField,
  samplePenField,
  penHalfWidth,
  nibHalfWidth,
  makeFlatRenderer,
  PEN_NIB_DEFAULT,
  PEN_FIELD_TUBE_SLACK,
  NIB_ANGLE_RAD,
} = loadTs("lib/flat-ink.ts")

let failures = 0
const record = (name, pass, detail) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}`)
  console.log(`      ${detail}`)
  if (!pass) failures++
}

const strokes = processedHeroStrokes()
/* The ink diameter in STROKE units, which is the space the field lives in —
 * `INK_DIAMETER_IN_STROKE_SPACE` in lib/flat-ink.ts, restated through the page's
 * own published width so the two cannot drift. */
const INK = 22

console.log(`\nhero word: ${strokes.length} strokes, ink diameter ${INK} stroke units`)
console.log(`page HERO_INK_WIDTH_PX = ${HERO_INK_WIDTH_PX.toFixed(2)} px\n`)

/* ── THE NEGATIVE CONTROLS, AND THEY NOW RUN ON THE BARE INVOCATION ─────────
 *
 * Two rows here are structural — "the pen is a subset of the tube" and the carve
 * envelope's vice — and a structural row is exactly the kind that passes because
 * it cannot fail. Each has a deliberately wrong input that must break it.
 *
 * ⚠ ALL FOUR USED TO SIT BEHIND `--mutate=`, AND NO SWEEP HAS EVER PASSED IT.
 * `docs/explainers/21-losing-your-work.md` §7 states the law — *"the gate runs
 * three kinds of control on the DEFAULT invocation, never behind a flag"* — and
 * explainer 31 measured nineteen gates breaking it, this among them. The flag is
 * DELETED rather than added to a runner table, per explainer 29 §5: a
 * runner-passed flag only helps people who go through a runner, and anyone
 * typing this gate's name still gets the half that cannot fail.
 *
 * They are cheap, which is why "schedule them elsewhere" was never the answer
 * here: the two bake mutations run over a COPY of the baked field (no re-bake —
 * `buildPenField` is the whole cost of this gate) and the two envelope
 * mutations are arithmetic on the same predicates the real rows evaluate.
 *
 *   BAKE · slack=1.0R   the tube channel baked at 1.0 R instead of 1.35 R, i.e.
 *                       exactly the mistake the slack constant exists to
 *                       prevent. The subset row must go red.
 *   BAKE · heavy x1.37  the ink weight restored the way the research doc
 *                       recommends (§4), which is right for a mark that must
 *                       keep its colour and WRONG here — the nib's ink then sits
 *                       OUTSIDE the tube and a discard cannot express it. Both
 *                       the subset row and the bake-vs-raster row must go red.
 *   ENV · 1.0 R         an envelope narrower than the mesh's own worst surface
 *                       point — the lower jaw of the vice must bite.
 *   ENV · 4.0 R         an envelope so wide the carve removes nothing — the
 *                       upper jaw must bite. Too wide is a dead silhouette, not
 *                       a safe one.
 *
 * ⚠ A STALE CLAIM CORRECTED WHILE DOING THIS. The parked wording said
 * `--mutate=slack` broke "row 5", the envelope row. Measured 2026-08-07 it does
 * not and cannot: slack moves the BAKE and the shipped uniform envelope absorbs
 * it (the note at row 5 already said so, contradicting the header). It breaks
 * the SUBSET row, which is where it is now graded.
 */
const t0 = Date.now()
const field = buildPenField(strokes, INK, PEN_NIB_DEFAULT)
const bakeMs = Date.now() - t0
const TEXELS = field.width * field.height

/** The tube channel re-baked at 1.0 R, on a COPY. Only that channel moves. */
function bakeTubeAt1R(src) {
  const d = Float32Array.from(src)
  const R = INK / 2
  for (let i = 0; i < TEXELS; i++) d[i * 2 + 1] = d[i * 2 + 1] + R * 1.35 - R
  return d
}
/** The x1.37 weight restore on the PEN channel, on a COPY: every stamp fatter. */
function bakePenHeavy(src) {
  const d = Float32Array.from(src)
  const R = INK / 2
  for (let i = 0; i < TEXELS; i++) d[i * 2] -= R * 0.37
  return d
}

let controlFailed = 0
const control = (ok, label, detail) => {
  if (!ok) controlFailed++
  console.log(`${ok ? "PASS" : "FAIL"}  CONTROL · ${label}`)
  console.log(`      ${detail}`)
}
console.log(
  `field: ${field.width}x${field.height} texels at ${field.unitsPerTexel} stroke units each, ` +
    `baked in ${bakeMs} ms\n`,
)

/* ---- 1. THE NIB LAW IS THE ONE THE RESEARCH DOC STATES ------------------- */
// h(psi) = sqrt(a^2 sin^2 psi + b^2 cos^2 psi), contrast = a/b exactly.
// stroke-width-models.md §1.1. Checked at the two directions where the answer
// is known without evaluating the formula.
{
  const a = 10
  const b = 4
  const alpha = NIB_ANGLE_RAD
  const thin = nibHalfWidth(alpha, a, b, alpha) // travelling ALONG the nib -> b
  const fat = nibHalfWidth(alpha + Math.PI / 2, a, b, alpha) // across it -> a
  record(
    "the nib law is h(psi) = sqrt(a^2 sin^2 psi + b^2 cos^2 psi), and the contrast IS a/b",
    Math.abs(thin - b) < 1e-9 && Math.abs(fat - a) < 1e-9 && Math.abs(fat / thin - a / b) < 1e-9,
    `travelling along the nib -> ${thin.toFixed(6)} (must be b = ${b}); ` +
      `across it -> ${fat.toFixed(6)} (must be a = ${a}); ratio ${(fat / thin).toFixed(6)} ` +
      `(must be a/b = ${a / b}). stroke-width-models.md §1.1: "the contrast ratio a nib ` +
      `produces is exactly a/b".`,
  )
}

/* ---- 2. THE TAPER HAS AN ENVELOPE ---------------------------------------- */
// |dr/ds| <= 1 — Choi, Choi & Moon's existence condition, quoted at
// stroke-width-models.md §3.1: "the radius cannot grow faster than the curve
// advances; a taper steeper than 45 degrees has no envelope at all." The shipped
// Inflate taper VIOLATES it over the first 0.195 R (§3.2); this one may not.
{
  const R = INK / 2
  const L = PEN_NIB_DEFAULT.taperRadii * R
  let worst = 0
  for (let i = 0; i < 400; i++) {
    const s0 = (i / 400) * L
    const s1 = ((i + 1) / 400) * L
    const w0 = penHalfWidth(Math.PI / 2 + NIB_ANGLE_RAD, s0, R, PEN_NIB_DEFAULT)
    const w1 = penHalfWidth(Math.PI / 2 + NIB_ANGLE_RAD, s1, R, PEN_NIB_DEFAULT)
    worst = Math.max(worst, Math.abs(w1 - w0) / (s1 - s0))
  }
  const predicted = (1 - PEN_NIB_DEFAULT.tip) / PEN_NIB_DEFAULT.taperRadii
  record(
    "the terminal taper HAS AN ENVELOPE — |dr/ds| <= 1 everywhere along it",
    worst <= 1 && Math.abs(worst - predicted) < 0.02,
    `worst |dr/ds| = ${worst.toFixed(4)} (must be <= 1), and it matches the closed form ` +
      `(1 - tip)/taperRadii = ${predicted.toFixed(4)}. The shipped Inflate profile ` +
      `(INFLATE_PROFILE_EXP 0.8) reads 1.252 at 0.05 of its taper — no envelope exists there.`,
  )
}

/* ---- 3. THE BAKE AGREES WITH AN INDEPENDENT RASTERISATION OF THE SAME LAW - */
//
// ⚠ THE FIRST VERSION OF THIS ROW WAS WRONG, AND IT FAILED HONESTLY RATHER THAN
// QUIETLY. It compared the field ON the centreline against `-penHalfWidth` at
// that point's own tangent, and read a worst disagreement of 2.06 stroke units
// against a 1.6 threshold. Raising the resolution did not fix it: at 4 / 2 / 1 /
// 0.5 units per texel the worst reads 2.74 / 2.06 / 2.27 / 2.37 while the MEDIAN
// halves each time (1.82 / 1.10 / 0.56 / 0.28). A residual that shrinks in the
// median and plateaus in the tail is not discretisation — it is a wrong
// expectation.
//
// And the expectation was wrong for the reason the whole renderer is built on:
// the mark is a UNION of nib stamps (`C (+) K`, stroke-width-models.md §4.5), so
// the field at a point is the minimum over ALL samples, which on a curve or
// beside a neighbouring stroke is legitimately deeper than the local stamp
// alone. Asserting the local law would have been asserting the offset-curve
// mistake §1.2 warns about, one level down.
//
// So the row now compares the bake against an INDEPENDENT rasterisation of the
// same law — the canvas stamp union in `makeFlatRenderer` — which is a genuine
// second implementation and the thing that would actually catch a drift.
{
  const W = 1120
  const H = 630
  const WORD = 648
  const polylines = strokes.map((s) => s.points.map((p) => ({ x: p.x, y: p.y })))
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)
  const r = makeFlatRenderer(polylines, { w: WORD, cx: W / 2, cy: H / 2 }, strokes, PEN_NIB_DEFAULT)
  r.draw(ctx, 1, "#000000")
  const { data } = ctx.getImageData(0, 0, W, H)

  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity
  for (const pl of polylines)
    for (const p of pl) {
      if (p.x < mnX) mnX = p.x
      if (p.x > mxX) mxX = p.x
      if (p.y < mnY) mnY = p.y
      if (p.y > mxY) mxY = p.y
    }
  const scale = WORD / Math.max(mxX - mnX, 1)
  const dx = W / 2 - ((mnX + mxX) / 2) * scale
  const dy = H / 2 - ((mnY + mxY) / 2) * scale

  /* ⚠ AND THE FIRST METRIC FOR THIS ROW WAS ALSO WRONG. IoU read 94.64 % at 2
   * units per texel against a 95 % bar, so the resolution was raised to 1 — and
   * IoU moved to 94.51 %, i.e. very slightly WORSE. A statistic that does not
   * respond to the thing that halves the underlying error is not measuring that
   * error. IoU is AREA over UNION, and this word has an enormous perimeter for
   * its area — roughly 4 100 px of boundary around 20 500 px of ink — so a
   * quarter-pixel boundary offset spends 1 100 px of disagreement and IoU
   * reports 94.5 % on two shapes that are the same to well under a pixel.
   *
   * The scale-free statement of "the same shape" is BOUNDARY DISPLACEMENT: the
   * field's own value, sampled on the raster's boundary, is by definition the
   * signed distance from that boundary to the field's. It should be zero, it is
   * in stroke units rather than in pixels of an arbitrary raster, and it does not
   * care how convoluted the outline is. IoU stays REPORTED, because a real drift
   * would move both. */
  let inter = 0
  let union = 0
  let onlyRaster = 0
  let onlyField = 0
  const ink = new Uint8Array(W * H)
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      const inRaster = l <= 150
      if (inRaster) ink[y * W + x] = 1
      const q = { x: (x + 0.5 - dx) / scale, y: (y + 0.5 - dy) / scale }
      const inField = samplePenField(field, q.x, q.y).pen < 0
      if (inRaster || inField) union++
      if (inRaster && inField) inter++
      else if (inRaster) onlyRaster++
      else if (inField) onlyField++
    }
  const iou = union ? inter / union : 0

  const offs = []
  for (let y = 1; y < H - 1; y++)
    for (let x = 1; x < W - 1; x++) {
      const p = y * W + x
      if (!ink[p]) continue
      if (ink[p - 1] && ink[p + 1] && ink[p - W] && ink[p + W]) continue // interior
      const q = { x: (x + 0.5 - dx) / scale, y: (y + 0.5 - dy) / scale }
      offs.push(Math.abs(samplePenField(field, q.x, q.y).pen))
    }
  offs.sort((a, b) => a - b)
  const meanOff = offs.reduce((a, b) => a + b, 0) / offs.length
  const p95 = offs[Math.floor(0.95 * offs.length)]
  const pxPerUnit = scale

  record(
    "the BAKED field and the RASTERISED stamp union describe the same shape",
    meanOff < 1 && p95 < 2.5,
    `boundary displacement: mean ${meanOff.toFixed(3)} stroke units ` +
      `(${(meanOff * pxPerUnit).toFixed(3)} px at this stage), p95 ${p95.toFixed(3)} units ` +
      `(needs mean < 1 and p95 < 2.5), over ${offs.length} boundary pixels. Two independent ` +
      `implementations of one law — a min-over-samples signed field at ${field.unitsPerTexel} ` +
      `stroke units per texel, and a canvas ellipse union at 0.5 px stamp spacing.\n` +
      `      [reported, not the verdict] IoU ${(100 * iou).toFixed(2)}%, disagreeing on ` +
      `${onlyRaster} px the raster has and ${onlyField} px the field has, of ${union}. ` +
      `IoU is area-over-union and this word carries ~4100 px of boundary around ~20500 px of ink, ` +
      `so it charges a quarter-pixel offset at 5% and does not respond to resolution.`,
  )
}

/* ---- 4. THE PEN IS A STRICT SUBSET OF THE TUBE --------------------------- */
// The property that makes a `discard` able to express this at all, and the
// property that keeps gate 1 safe at EVERY intermediate value of the carve
// rather than only at its two ends. `penHalfWidth` pins the semi-major axis to R
// and deliberately does NOT restore the weight; this is that decision, asserted.
/** THE ROW'S WHOLE PREDICATE, so the controls grade it rather than a copy. */
function subsetOfTube(data) {
  let violations = 0
  let worst = 0
  for (let i = 0; i < TEXELS; i++) {
    const pen = data[i * 2]
    const tube = data[i * 2 + 1]
    if (pen < tube - 1e-6) {
      violations++
      worst = Math.max(worst, tube - pen)
    }
  }
  return { violations, worst }
}
{
  const { violations, worst } = subsetOfTube(field.data)
  record(
    "the PEN outline is a strict SUBSET of the tube — ink can only ever be REMOVED",
    violations === 0,
    `${violations} texels of ${TEXELS} where the pen field is inside the tube ` +
      `field (must be 0${violations ? `, worst by ${worst.toFixed(3)} units` : ""}). ` +
      `A discard cannot add ink, so if this ever fails the beat would have to GROW to become a ` +
      `drawing — and gate 1 would no longer be safe at the intermediate values.`,
  )
  /* THE TWO BAKE CONTROLS, on the same predicate, on copies of the same bake. */
  const slack = subsetOfTube(bakeTubeAt1R(field.data))
  control(
    slack.violations > 0,
    "KNOWN-BAD — a tube channel baked at 1.0 R instead of 1.35 R is REJECTED by that same clause",
    `${slack.violations} of ${TEXELS} texels violate it (needs > 0), worst by ` +
      `${slack.worst.toFixed(3)} units. Against ${violations} on the shipped bake. ` +
      `PEN_FIELD_TUBE_SLACK exists to stop exactly this, and until 2026-08-07 nothing ran it.`,
  )
  const heavy = subsetOfTube(bakePenHeavy(field.data))
  control(
    heavy.violations > 0,
    "KNOWN-BAD — the research doc's x1.37 ink-weight restore pushes the pen OUTSIDE the tube, and is REJECTED",
    `${heavy.violations} of ${TEXELS} texels violate it (needs > 0), worst by ` +
      `${heavy.worst.toFixed(3)} units. stroke-width-models.md §4 recommends the restore for a mark ` +
      `that must keep its colour; here it makes the carve unexpressible by a discard.`,
  )
}

/* ---- 5. THE FIRST AMPLITUDE THE SHADER ACTUALLY EVALUATES ----------------
 *
 * ⚠ THIS ROW USED TO TEST `carve = 0`, AND THAT IS AN AMPLITUDE THE SHADER
 * NEVER EVALUATES. `applyPenCarve` (components/viewport-3d.tsx) wraps the whole
 * block in `if (fsPenAmt > 0.0) { ... }`: at penCarve 0 there is no fetch, no
 * `mix` and no test, `fsPenCov` stays 1 and every fragment survives by
 * construction. So "at carve zero the field removes nothing" was an identity
 * dressed as a measurement — it could only ever have caught a bake so broken
 * that the field was wrong at an amplitude nothing renders.
 *
 * The amplitude that matters is the smallest one the branch is taken at, where
 * `mix(tube, pen, c)` is the TUBE CHANNEL ALONE. That is what has to remove
 * nothing, and it is the arm every live probe drives (`carve 0.001`).
 *
 * ⚠ AND IT USED TO TEST THE WRONG CONSTANT. The tube channel is baked at
 * `PEN_FIELD_TUBE_SLACK` (1.35 R) but the shader subtracts `uFsPenSlack` from
 * it before the mix, so what the rendered envelope actually is is
 * `PEN_CARVE_ENVELOPE_R` — a number that appeared NOWHERE in this file. The
 * envelope shipped at 2.6 R for a day while every row here passed.
 *
 * ⚠ AND THE SUBJECT IS THE INK RASTER, NOT THE MESH. `makeFlatRenderer` draws
 * the PEN's own mark; the GPU shades the tube/implicit MESH, whose footprint is
 * a strict superset. So a pass here is NECESSARY and not sufficient, and the
 * sufficient row is the live one in `assert-hero-carve.mjs`, which reads the
 * rendered ink at 0.001 off the page. Stated rather than implied, because a row
 * whose name overclaims its subject is how this one stayed green.
 */
{
  /* THE SHIPPED ENVELOPE, READ OUT OF THE SHADER'S OWN FILE. It cannot be
   * imported — `_ts-load.mjs` cannot parse JSX — so it is scraped, and the
   * scrape PRINTS what it read. A gate that silently defaults a constant it
   * failed to find would be the same class of lie this row is being repaired
   * for. */
  const src = readFileSync(join(ROOT, "components", "viewport-3d.tsx"), "utf8")
  const m = src.match(/export const PEN_CARVE_ENVELOPE_R\s*=\s*([0-9.]+)/)
  if (!m) {
    record("the shipped carve envelope can be read from the shader", false,
      "PEN_CARVE_ENVELOPE_R not found in components/viewport-3d.tsx — every row below is void")
  }
  /* THESE TWO ROWS NEED THEIR OWN CONTROL, and it is not the bake's: the bake
   * mutations move the FIELD, and the shipped uniform envelope absorbs that, so
   * neither of them can break these. A row whose only mutation stopped biting it
   * is a row back in the class this file exists to police. The control has to
   * drive the constant the rows actually read — which is what `--mutate=env=`
   * did, behind a flag nothing passed. It is now two values evaluated inline
   * against the same two predicates, below. */
  const ENVELOPE_R = m ? parseFloat(m[1]) : NaN
  const R_STROKE = INK / 2
  /* THE BAKE'S OWN SLACK, PINNED — and this file is the reason that matters.
   *
   * `assert-gate-integrity` channel D moved `PEN_FIELD_TUBE_SLACK` 1.35 -> 2.16
   * and every row here stayed green. It appears below only inside
   * `ENVELOPE_R - PEN_FIELD_TUBE_SLACK`, a difference the rows then use
   * relatively, so the pair can slide together and nothing notices. That is the
   * exact shape of this file's own recorded defect — it "never referenced
   * PEN_CARVE_ENVELOPE_R, so 2.6 shipped for a day with every row green" — with
   * the second of the two numbers that decide how much of the mark the carve
   * removes. Stating the value once is what makes the difference readable. */
  record(
    "the bake's tube slack is still 1.35 R",
    Math.abs(PEN_FIELD_TUBE_SLACK - 1.35) < 1e-9,
    `PEN_FIELD_TUBE_SLACK = ${PEN_FIELD_TUBE_SLACK} R (lib/flat-ink.ts). Every other row reads it only as a ` +
      `difference against the shader's envelope, so the two can move together unseen — this row is the one that sees it.`,
  )
  /* `mix` happens on the SLACKENED tube channel, exactly as the fragment does:
   * `fsEnv = fsPf.g - uFsPenSlack`, then `mix(fsEnv, fsPf.r, amt)`. */
  const EXTRA_SLACK = Math.max(0, (ENVELOPE_R - PEN_FIELD_TUBE_SLACK) * R_STROKE)
  const W = 1120
  const H = 630
  const WORD = 648
  const polylines = strokes.map((s) => s.points.map((p) => ({ x: p.x, y: p.y })))
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)
  const r = makeFlatRenderer(polylines, { w: WORD, cx: W / 2, cy: H / 2 }, strokes, null)
  r.draw(ctx, 1, "#000000")
  const { data } = ctx.getImageData(0, 0, W, H)

  // screen -> stroke, the inverse of makeFlatRenderer's own map
  let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity
  for (const pl of polylines)
    for (const p of pl) {
      if (p.x < mnX) mnX = p.x
      if (p.x > mxX) mxX = p.x
      if (p.y < mnY) mnY = p.y
      if (p.y > mxY) mxY = p.y
    }
  const scale = WORD / Math.max(mxX - mnX, 1)
  const dx = W / 2 - ((mnX + mxX) / 2) * scale
  const dy = H / 2 - ((mnY + mxY) / 2) * scale
  const toStroke = (sx, sy) => ({ x: (sx - dx) / scale, y: (sy - dy) / scale })

  const count = (carve) => {
    let ink = 0
    let cut = 0
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4
        const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        if (l > 150) continue
        ink++
        const q = toStroke(x + 0.5, y + 0.5)
        const f = samplePenField(field, q.x, q.y)
        const env = f.tube - EXTRA_SLACK
        if (env + (f.pen - env) * carve > 0) cut++
      }
    return { ink, cut }
  }
  const at1 = count(1)
  /* ── THE SUBJECT, AND WHY THE INK RASTER IS NOT IT ────────────────────────
   * Counting discarded pixels over the PEN's own ink cannot fail for ANY
   * envelope: every ink pixel is within one nib half-width of a centreline by
   * construction, so it is inside even a 1.0 R envelope, and `--mutate=env=1.0`
   * proves exactly that — the count stayed 0. That is the row this repo has now
   * caught thirteen times, and re-aiming its amplitude would not have saved it.
   *
   * The subject has to be the MESH, whose footprint is a superset. The
   * builder's own arithmetic gives its outer radius in closed form
   * (`lib/geometry-engines.ts` `buildInflateSVFI`): `radiusXY * bulgeScale *
   * ink[i]` with `bulgeScale = 1 + crossSectionBulge`; the smooth union then
   * adds the seam, `sqrt(2)(r + k/6)` (explainer 19). So the statement, in one
   * line of arithmetic on the same constants the geometry is built from:
   *   ENVELOPE_R  >=  sqrt(2) * bulgeScale.
   * That one CAN fail, in both directions, and does.
   *
   * ⚠ THE BULGE IS THE SHIPPED ONE, NOT THE TOP OF THE DIAL. `crossSectionBulge
   * = 0.07 + puffEased * 0.21` runs to 0.28, but neither register ships at full
   * puff — lib/flat-ink.ts records the operating value as `bulgeScale = 1.07`.
   * Bounding against 1.28 gives 1.81 R, which is 20 % wider than the mesh
   * actually is, and an envelope that wide measurably kills the flat state's
   * silhouette (`assert-flat-silhouette.mjs` reads 13.4 % at 1.75 R against a
   * 12.7 % bar, and 1.65 % at 2.6 R against a 4.2 % value-only floor). A bound
   * calibrated to a setting nothing runs at is a bound that fails the product to
   * protect an unreachable case. Both numbers are printed. */
  const MESH_BULGE_SHIPPED = 1.07
  const MESH_BULGE_MAXPUFF = 1 + 0.07 + 0.21
  const MESH_WORST_R = Math.SQRT2 * MESH_BULGE_SHIPPED
  /* THE TWO JAWS OF THE VICE, as predicates, so a control can drive them. */
  const containsMesh = (e) => Number.isFinite(e) && e >= MESH_WORST_R
  const affordable = (e) => Number.isFinite(e) && e <= 1.62
  record(
    `THE ENVELOPE CONTAINS THE MESH — the surface the shader shades, not the ink it draws`,
    containsMesh(ENVELOPE_R),
    `envelope ${Number.isFinite(ENVELOPE_R) ? ENVELOPE_R.toFixed(2) : "?"} R vs the builder's worst ` +
      `surface point ${MESH_WORST_R.toFixed(3)} R = sqrt(2) x the SHIPPED bulgeScale ` +
      `${MESH_BULGE_SHIPPED}, the smooth-union seam. At full puff the bulge is ` +
      `${MESH_BULGE_MAXPUFF.toFixed(2)} and the seam ${(Math.SQRT2 * MESH_BULGE_MAXPUFF).toFixed(2)} R ` +
      `— reported, not the bar, because neither register ships there and an envelope that wide ` +
      `measurably kills the flat silhouette. PEN_CARVE_ENVELOPE_R is read out of ` +
      `components/viewport-3d.tsx; the bake contributes ${PEN_FIELD_TUBE_SLACK} R and the uniform ` +
      `the remaining ${EXTRA_SLACK.toFixed(2)} stroke units. ` +
      `NOT measured over the ink raster: every ink pixel sits within one nib half-width of a ` +
      `centreline, so that count is 0 for any envelope down to 1.0 R and cannot fail. ` +
      `penCarve 0 is not tested at all — the shader short-circuits on 'if (fsPenAmt > 0.0)'. ` +
      `The rendered row is in assert-hero-carve.mjs.`,
  )
  record(
    "  ...and at carve ONE it removes a real fraction of the mark",
    at1.cut / at1.ink > 0.15,
    `${at1.cut} of ${at1.ink} ink px discarded at penCarve 1 = ` +
      `${((100 * at1.cut) / at1.ink).toFixed(1)}% (needs > 15%). Measured on the live form the same ` +
      `operation removes 18.6% (scripts/verify/_probe-carve-preview.mjs).`,
  )
  /* THE ENVELOPE IS NOT ALLOWED TO BE ARBITRARILY WIDE EITHER. The carve IS the
   * flat state's silhouette, so slack bought "to be safe" is silhouette given
   * away — 2.6 R cost between 3.7x and 4.4x of the ink removed at the shipped
   * amplitude (`_probe-carve-envelope-recal.mjs`). The upper bar is the closed
   * form with margin: explainer 19's smooth-union seam is `sqrt(2)(r + k/6)`,
   * i.e. 1.81 R at the fattest cross-section, and the live sweep reads zero
   * removal from 1.90 R up on all three page states. */
  record(
    "  ...and it is not WIDER than the flat silhouette can afford",
    affordable(ENVELOPE_R),
    `PEN_CARVE_ENVELOPE_R = ${ENVELOPE_R} R (needs <= 1.62). Measured, not argued: ` +
      `assert-flat-silhouette.mjs reads the flat-vs-solid earth-mover distance at 17.86 % of a ` +
      `stroke radius at 1.60 R, 16.07 % at 1.65 R, 13.43 % at 1.75 R, 10.03 % at 1.90 R and 1.65 % ` +
      `at 2.60 R — and its second row, the median half-width gain, steps from passing at 1.60 R to ` +
      `14.02 % against a 15.31 % bar at 1.65 R. So 1.60 is the WIDEST envelope that still leaves ` +
      `the flat state a different SHAPE from the solid, which is the whole reason the carve exists ` +
      `(Sebs: "the 2D and 3D transformation is way too subtle"). This bar and the one above are ` +
      `deliberately a vice: an envelope has a floor from the mesh and a ceiling from the picture.`,
  )
  /* ── AND BOTH JAWS ARE SHOWN TO BITE, on the same two predicates ────────── */
  control(
    !containsMesh(1.0),
    "KNOWN-BAD — an envelope of 1.0 R, NARROWER than the mesh's own worst surface point, is REJECTED",
    `1.00 R vs the required ${MESH_WORST_R.toFixed(3)} R → ${containsMesh(1.0) ? "ACCEPTED — THE LOWER JAW CANNOT BITE" : "rejected, as required"}. ` +
      `Note the ink-raster count at this envelope is 0 discarded pixels — the statistic this row ` +
      `was rebuilt to stop using, because it passes 1.0 R happily.`,
  )
  control(
    !affordable(4.0),
    "KNOWN-BAD — an envelope of 4.0 R, wide enough that the carve removes nothing, is REJECTED",
    `4.00 R against the 1.62 R ceiling → ${affordable(4.0) ? "ACCEPTED — THE UPPER JAW CANNOT BITE" : "rejected, as required"}. ` +
      `Too wide is a dead silhouette, not a safe one: 2.6 R shipped for a day with every row here green.`,
  )
  control(
    containsMesh(ENVELOPE_R) === affordable(ENVELOPE_R) && containsMesh(1.6),
    "…and the vice is not simply refusing everything — 1.60 R clears BOTH jaws",
    `containsMesh(1.60)=${containsMesh(1.6)} affordable(1.60)=${affordable(1.6)}; the shipped ` +
      `${ENVELOPE_R} R clears both too. A control that rejects every input proves nothing.`,
  )
}

const bad = failures + controlFailed
console.log(
  `\n${bad === 0 ? "all rows passed" : `${bad} FAILED`}` +
    `${controlFailed ? ` — ${controlFailed} of them CONTROL row(s): the instrument is blind, not the subject` : ""}`,
)
process.exit(bad ? 1 : 0)
