// IS THE REGISTRATION EXCURSION THE PROJECTION? — the measurement that decides.
//
// THE QUESTION. `hero-beat-storyboard.md` §7 lists "one centre" second among
// the three numbers a rebuild must not lose, and §11.4.1 records it lost: the
// mark's projected centre swings sideways through the turn and steps at the
// dwell exit. Two hypotheses were live. A WRONG PIVOT — the mark turning about
// an axis it is not centred on — which a measured-pivot rebuild falsified by
// producing byte-identical numbers. And THE PROJECTION — that a real form
// really yawed under a perspective camera moves its projected centre even when
// it is perfectly centred, because the half rotating toward the lens projects
// larger than the half rotating away.
//
// The second is a claim about the MEDIUM, so it can be tested two independent
// ways, and this probe runs both. Neither alone would be enough: an
// intervention without a model shows THAT the projection matters but not that
// the mechanism is understood, and a model fitted to the same series it
// predicts is a curve fit wearing a theory's clothes.
//
// ── TEST 1 · INTERVENTION. Two captures of the same beat, same window, same
// frame count, differing in exactly one thing: `--projection=perspective` vs
// the page default. Under a parallel projection a yaw about a vertical axis
// cannot move the projected centre at all — a scale about the projected centre
// is what the projection IS — so if the excursion is the projection it must
// vanish in one arm and survive in the other.
//
// ── TEST 2 · PREDICTION FROM A MODEL WITH NO CENTRE PARAMETER. For a planar
// mark of half-width `a` yawed by θ at camera distance `d`, projecting the two
// extreme points through `X = f·x/(d − z)`:
//
//     x = ±a cosθ,  z = ±a sinθ
//     X±  =  ± f·a cosθ / (d ∓ a sinθ)
//
//     WIDTH   W(θ) = X₊ − X₋ = W₀ · cosθ / (1 − k² sin²θ),   k = a/d
//     CENTRE  Δcx  = (X₊ + X₋)/2 = (W(θ)/2) · k · sinθ
//
// The second line is the whole theory in one term. It is zero dead-on, zero
// edge-on, maximal near 45°, and it carries NO free centre parameter: fit `W₀`
// and `k` to the measured WIDTHS, read `cx₀` off the frames where the mark is
// not turning, and the entire cx series is then a PREDICTION. A model that has
// to be told where the centre went has explained nothing.
//
// θ is not fitted either — it is read out of `lib/hero-motion.ts`'s own sampler
// at each captured frame's timestamp, so the geometry comes from the model, the
// widths and centres come from the pixels, and the two never touch.
//
// The null model — "the centre does not move" — is reported beside it, because
// an rms is meaningless without the rms it has to beat.
//
// Usage:
//   node scripts/verify/_probe-hero-projection.mjs --persp=reg-persp --affine=reg-affine
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const PERSP = arg("persp", "reg-persp")
const AFFINE = arg("affine", "reg-affine")

const INK_MAX = 150

/** bbox extent + centre of the ink, on the same mask the shipped gate uses. */
async function measure(file) {
  const img = await loadImage(file)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  let minX = Infinity
  let maxX = -Infinity
  let n = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      if (l > INK_MAX) continue
      n++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
    }
  }
  if (!n) return null
  return { w: maxX - minX + 1, cx: (minX + maxX) / 2, ink: n, canvasW: W }
}

async function series(label) {
  const base = join(ROOT, "docs", "verification", "hero-transition", label)
  if (!existsSync(base)) throw new Error(`no capture at ${base}`)
  const manifest = JSON.parse(readFileSync(join(base, "manifest.json"), "utf8"))
  const em = JSON.parse(readFileSync(join(base, "emerge-manifest.json"), "utf8"))
  const dir = join(base, "emerge")
  const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort()
  const rows = []
  for (let i = 0; i < files.length; i++) {
    const m = await measure(join(dir, files[i]))
    if (!m) continue
    rows.push({ i, t: em[i]?.t ?? null, ...m })
  }
  return { label, projection: manifest.projection ?? "(unrecorded)", rows }
}

/* ---- the model ----------------------------------------------------------- */

/** W(θ)/W₀ for the slab under perspective. */
const widthRatio = (s, k) => Math.sqrt(Math.max(0, 1 - s * s)) / (1 - k * k * s * s)

function fitWidths(rows, yawOf) {
  // Two parameters, both from WIDTHS ONLY. Coarse grid then a local refine —
  // the surface is smooth and this is 72 points, so nothing subtler is earned.
  let best = null
  for (let k = 0.0; k <= 0.9; k += 0.001) {
    // W₀ is linear given k, so it is solved rather than searched.
    let num = 0
    let den = 0
    for (const r of rows) {
      const s = Math.sin(yawOf(r))
      const g = widthRatio(s, k)
      num += r.w * g
      den += g * g
    }
    if (den <= 0) continue
    const W0 = num / den
    let sse = 0
    for (const r of rows) {
      const s = Math.sin(yawOf(r))
      sse += (r.w - W0 * widthRatio(s, k)) ** 2
    }
    if (!best || sse < best.sse) best = { k, W0, sse }
  }
  best.rms = Math.sqrt(best.sse / rows.length)
  return best
}

/* ---- run ----------------------------------------------------------------- */

const { DEFAULT_HERO_MOTION, sampleHeroMotion } = loadTs("lib/hero-motion.ts")
const P = DEFAULT_HERO_MOTION
const yawAt = (t) => (t == null ? 0 : (sampleHeroMotion(P, t).yaw ?? 0))

const p = await series(PERSP)
const a = await series(AFFINE)

console.log(`PERSPECTIVE arm  ${p.label}  (live camera: ${p.projection})  ${p.rows.length} frames`)
console.log(`AFFINE arm       ${a.label}  (live camera: ${a.projection})  ${a.rows.length} frames`)
if (p.projection === a.projection) {
  console.error(
    `\nBOTH ARMS MOUNTED "${p.projection}" — this is not a comparison. ` +
      `Re-capture with --projection=perspective on one of them.`,
  )
  process.exit(2)
}

const step = (rows) => {
  let m = 0
  for (let i = 1; i < rows.length; i++) m = Math.max(m, Math.abs(rows[i].cx - rows[i - 1].cx))
  return m
}
const spanOf = (rows) => {
  const xs = rows.map((r) => r.cx)
  return Math.max(...xs) - Math.min(...xs)
}

console.log(`
── TEST 1 · INTERVENTION ────────────────────────────────────────────────────
                        max single-frame cx step      total cx excursion
  perspective           ${step(p.rows).toFixed(2).padStart(8)} px            ${spanOf(p.rows).toFixed(2).padStart(7)} px
  affine (shipped)      ${step(a.rows).toFixed(2).padStart(8)} px            ${spanOf(a.rows).toFixed(2).padStart(7)} px`)

/* Only the TURN itself is modelled, and only where the model APPLIES.
 *
 * The window opens inside `anticipation`, whose squash is a 2D scale about the
 * mark's own centre — a different thing entirely, and one that renders (w 624 /
 * h 143 against the turn's 612 / 149). Those frames are not the turn.
 *
 * And the slab model describes the FACE's projected extent. Within about ten
 * degrees of edge-on the face has no extent left and the silhouette is the
 * form's own THICKNESS — which is why the sliver survives at all (§3 K3's
 * `sx >= 0.035` clamp, and here the real depth standing in for it). Asking a
 * face model to predict a thickness is asking it the wrong question, so the
 * domain is stated rather than fudged: yaw <= 80 degrees. The excluded frames
 * are printed below with the model's answer anyway, so the limit is visible
 * instead of hidden. */
const MODEL_MAX_YAW_DEG = 80
const emergeRows = p.rows.filter((r) => r.t != null && sampleHeroMotion(P, r.t).phase === "emerge")
const turnRows = emergeRows.filter((r) => (yawAt(r.t) * 180) / Math.PI <= MODEL_MAX_YAW_DEG)
const edgeRows = emergeRows.filter((r) => (yawAt(r.t) * 180) / Math.PI > MODEL_MAX_YAW_DEG)
const rest = p.rows.filter((r) => r.t != null && yawAt(r.t) < 0.02)
const cx0 = rest.length
  ? rest.map((r) => r.cx).sort((x, y) => x - y)[Math.floor(rest.length / 2)]
  : p.rows[0].cx
const axis = (p.rows[0].canvasW - 1) / 2

const fit = fitWidths(turnRows, (r) => yawAt(r.t))

let sse = 0
let worst = 0
let nullSse = 0
const table = []
const inDomain = new Set(turnRows.map((r) => r.i))
for (const r of emergeRows) {
  const s = Math.sin(yawAt(r.t))
  // ZERO CENTRE PARAMETERS: `cx0` is the measured rest centre, `k` came from
  // the widths, and `W` is this frame's own measured extent.
  const pred = cx0 - (r.w / 2) * fit.k * s
  const err = r.cx - pred
  const counted = inDomain.has(r.i)
  if (counted) {
    sse += err * err
    nullSse += (r.cx - cx0) ** 2
    if (Math.abs(err) > Math.abs(worst)) worst = err
  }
  table.push({ t: r.t, yawDeg: (yawAt(r.t) * 180) / Math.PI, w: r.w, cx: r.cx, pred, err, counted })
}
const rms = Math.sqrt(sse / turnRows.length)
const nullRms = Math.sqrt(nullSse / turnRows.length)

console.log(`
── TEST 2 · PREDICTION, NO CENTRE PARAMETER ─────────────────────────────────
  optical axis (canvas centre)   ${axis.toFixed(1)} px
  measured rest centre  cx0      ${cx0.toFixed(1)} px      (${Math.abs(cx0 - axis).toFixed(1)} px off the axis)
  fitted to WIDTHS only          W0 ${fit.W0.toFixed(1)} px   k = a/d ${fit.k.toFixed(3)}   width rms ${fit.rms.toFixed(2)} px
  predicted cx across ${String(turnRows.length).padStart(2)} frames  rms ${rms.toFixed(2)} px   worst ${worst.toFixed(2)} px
  null model (cx never moves)    rms ${nullRms.toFixed(2)} px   — the number the model has to beat
  OUTSIDE the model's domain     ${edgeRows.length} frames within ${90 - MODEL_MAX_YAW_DEG}° of edge-on (silhouette is thickness, not face)`)

console.log(`
  t      yaw    w     cx measured   cx predicted   err`)
let prevT = null
for (const r of table) {
  if (prevT !== null && Math.abs(r.t - prevT) < 1e-9) continue
  if (table.filter((x) => x.t === r.t).length && prevT === r.t) continue
  prevT = r.t
  console.log(
    `  ${r.t.toFixed(3)}  ${r.yawDeg.toFixed(1).padStart(5)}°  ${String(r.w).padStart(4)}  ` +
      `${r.cx.toFixed(1).padStart(11)}   ${r.pred.toFixed(1).padStart(12)}   ${r.err.toFixed(2).padStart(6)}` +
      (r.counted ? "" : "   (outside the model's domain — thickness, not face)"),
  )
}

const proven = step(a.rows) < 2 && step(p.rows) > 8 && rms < nullRms / 5
console.log(`
VERDICT: the excursion ${proven ? "IS" : "is NOT"} the projection.`)
process.exit(proven ? 0 : 1)
