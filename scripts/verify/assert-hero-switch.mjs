// THE 2D→3D SWITCH CARRIES A TONAL EVENT — the gate for Sebs's second complaint.
//
// *"MAYBE ITS MATERIAL LIGHTING IDK BUT ITS STILL SUPER SUBTLE WHEN IT SWITCHES
// TO 3D AND I HAVE A HARD TIME NOTICING AT TIMES ITS NOW 3D."*
//
// ── WHY THIS FILE EXISTS AND WHY NO EXISTING GATE COULD DO IT ─────────────
// Four gates already judge this beat and not one of them could have caught
// this, which is the whole reason it survived a carve, a retime and eleven
// instrument audits:
//
//   assert-hero-transition gate 1  the FLAT state is one value        — passes either way
//   assert-hero-transition gate 2  the held ¾ has tonal RANGE (sd>6)  — passed at sd 9.1
//   assert-hero-transition gate 4a nothing washes past the ends       — a CEILING, not a floor
//   assert-flat-silhouette         the SHAPE changes                  — the other half
//
// Gate 2 is the near miss and it is worth naming: it asks whether the lit form
// has an internal gradient, and the answer was yes — sd 9.1 — while the form's
// interior sat at median 23.6 against a drawing at 20.6. **A form can have a
// perfectly good gradient and still be the same darkness as the ink it came
// from.** Range is not level, and nothing in this repo was asking about level.
//
// Measured on the shipped build before the fix, through the value-wash gate's
// own eroded-interior statistic:
//
//     interior      FLAT at rest    SETTLED solid      Δ
//     median             20.6            23.6        +3.0
//     mean               20.6            23.5        +2.9
//
// Three luma, on a mark whose ink-to-paper contrast is 229. That is the number
// this gate exists to keep off the floor.
//
// ── THE ARMS, BOTH IN THE DEFAULT INVOCATION ──────────────────────────────
// It runs SHIPPED and PRIOR (`window.__heroLitLaw = "prior"`, the beat exactly
// as Sebs saw it) in one run with no flags, because a threshold shown only the
// build it was written for is not a threshold. The prior arm is a real,
// reachable, shippable read — not a synthetic control — and rows 1 and 2 are
// the same measurement on the two of them.
//
// ── CONTROLS ──────────────────────────────────────────────────────────────
//   --mutate=noevent   the SHIPPED arm is loaded at the prior law, so rows
//                      1 and 5 MUST go red. Proves the two rows that carry the
//                      claim can fail.
//   --mutate=inkwash   at the flat playhead the shipped arm is driven
//                      `ink: 0.80` through `setFlatten`, letting lit surface
//                      through into the drawing. Rows 3 and 4 MUST go red.
//                      Proves the drawing-is-untouched rows are measuring the
//                      drawing and not agreeing by construction.
//   --mutate=warmrig   the SHIPPED arm is loaded with `window.__studioRigLaw =
//                      "prior"`, which puts back BOTH the warm studio rig and
//                      the warm #2A2622 ink — the exact picture Sebs called
//                      *"too brown"* on 2026-08-04. Rows 9 and 10 MUST go red.
//                      Row 6, the RETIRED Δr−b bar, stays green on it, which is
//                      the whole reason 9 and 10 were written.
// Each control names the rows it must flip and the script FAILS if they do not,
// so a control that stopped working cannot read as a pass.
//
// Usage: node scripts/verify/assert-hero-switch.mjs [--mutate=noevent|inkwash|warmrig]
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { HERO_URL } from "./lib/dev-server.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const MUTATE = arg("mutate", null)
const URL = HERO_URL
const OUT = join(ROOT, "docs", "verification", "hero-switch")

/* The gate's own two constants, the same values `assert-hero-transition.mjs`
 * judges with. A probe that measures with a different threshold than the gate
 * is a probe whose numbers cannot be quoted at the gate. */
const INK_MAX_LUMA = 150
const ERODE = 3

/* ---- THE BARS, and where each comes from ------------------------------- */
/** The tonal event, as interior median. The prior build reads 3.1 and the
 *  shipped one 25.8, so 18 sits between them with margin on both sides and is
 *  not a number tuned to the build it was written for. */
const MIN_EVENT = 18
/** The prior read must stay clearly under it, or rows 1 and 2 are the same
 *  claim twice. */
const MAX_PRIOR_EVENT = 8
/** `docs/research/online-reference-mechanics.md` §9.1, eleven clips of exactly
 *  this move: flat-vs-dimensional separates at interior values 0.7–2.7 against
 *  **45–63**. Ours is a render rather than an 8-bit plate so the flat end sits
 *  at 20.6 instead of ~2, but the DIMENSIONAL end is the same question and this
 *  is the genre's own answer to it. */
const BAND = [45, 63]
/** `studio-rig.tsx`'s ratified colour policy: broad warm-tan bands are banned,
 *  convicted at rgb(142,118,91), Δr−b 50. Turning the environment up is exactly
 *  the channel that produced that failure, so it is checked and not assumed.
 *
 *  ⚠ THIS BAR PASSED A PICTURE SEBS REJECTED, AND IT IS KEPT FOR CONTINUITY
 *  RATHER THAN AS THE VERDICT. Read rows 9 and 10 for the ones that bind. On
 *  2026-08-04 he said *"the 3d version is also too brown, should still feel
 *  black"* about a build this row scored at Δr−b 23.9 against a bar of 50 — 26
 *  points of margin on a form that reads as milk chocolate at 1:1.
 *
 *  THREE THINGS WERE WRONG WITH IT, and each is fixed by a row below rather
 *  than by moving this number:
 *
 *  1 · Δr−b IS A DIFFERENCE OF sRGB CODE VALUES, SO IT SCALES WITH EXPOSURE.
 *      The conviction rgb(142,118,91) sits at L* 51.2; this form's brightest
 *      decile sits at L* 34.5. The SAME chromaticity measures ~24 here and ~50
 *      there. A bar in this statistic is a bar on how bright the form is at
 *      least as much as on how coloured it is — so a dark brown passes a bar
 *      calibrated on a bright tan automatically.
 *  2 · IT READ THE BRIGHTEST DECILE ONLY. "Should still feel black" is a claim
 *      about the whole form, and the measured hue angle was 73° in EVERY
 *      decile — the brown was the whole object, not a highlight artefact.
 *  3 · THE NUMBER WAS THE CONVICTION ITSELF. Setting the acceptance ceiling at
 *      the value of the thing already judged unacceptable leaves zero margin by
 *      construction. In CIELAB that conviction is C* 19.12; the register's own
 *      3D ink range tops out at C* 2.82. The bar was six times looser than the
 *      palette it was protecting. */
const MAX_DRB = 50

/* ── THE BARS THAT REPLACE IT ─────────────────────────────────────────────
 *
 * Both are in CIELAB C* — perceptual chroma — measured PER PIXEL over the same
 * eroded interior, because that is the quantity "reads brown" is about and
 * because a shadow and a highlight of one pigment sit at comparable chroma
 * there while their Δr−b differs by 2x.
 *
 * Both anchors come from the register's OWN ratified palette, never from the
 * failure: Desk Doodles' `INK_3D_RANGE` is `#121110` → `#383632`, which in
 * CIELAB is C* 0.69 at L* 5.1 → C* 2.82 at L* 22.7. */

/** ROW 9 — THE CEILING. The lit form may not be more chromatic than the most
 *  chromatic ink in the register's own 3D range (`#383632`, C* 2.82), rounded
 *  up to 3.0. That is 6.4x under the ratified tan conviction's C* 19.12
 *  instead of level with it. Measured p90 per-pixel C*: shipped 0.69 (the same
 *  chroma as the range's DARKEST ink), the picture Sebs rejected 8.84. */
const MAX_FORM_CHROMA = 3.0

/** ROW 10 — THE LAW, AS A NUMBER. *"Matte ink, value from light — never hue"*
 *  (lib/registers.ts). Diffuse shading is `albedo x irradiance`, a MULTIPLY, so
 *  a chromatic albedo makes chroma rise in lockstep with value — which is
 *  exactly how this defect arrived: nothing turned warm, `envGain` went 1 → 3.6
 *  and dragged the ink's own hue into view. So the binding question is not "how
 *  much chroma" but "does chroma RISE WITH VALUE", asked inside one frame:
 *  C* of the brightest interior decile minus C* of the darkest.
 *
 *  Exposure cannot game it — dimming the render moves both terms together.
 *  A neutral albedo satisfies it by construction; a chromatic one cannot.
 *
 *  The bar is 2.13: the chroma drift of the ratified ink range across its ENTIRE
 *  value span (0.69 → 2.82). This form spans more value than that range does,
 *  so the allowance is generous rather than tight. Measured: shipped 0.09,
 *  the family-axis warm option 2.56, the picture Sebs rejected 4.25. */
const MAX_CHROMA_RISE = 2.13
/** `assert-hero-transition` gate 1, restated: a flat drawn mark is ONE VALUE
 *  inside a hard silhouette. */
const MAX_FLAT_SD = 1

/* ---- sRGB -> CIELAB (D65) ------------------------------------------------
 * Rows 9 and 10 need perceptual chroma, which needs real linear light, so the
 * screenshot's sRGB encoding is decoded first. Δr−b (row 6) stays on the raw
 * code values because that is the space the ratified conviction was measured
 * in and a continuity row that changed spaces would not be one. */
const srgbToLinear = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
function chroma(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b)
  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B
  const Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B
  const Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t) / 116 + 16 / 116)
  const fx = f(X / 0.95047), fy = f(Y / 1.0), fz = f(Z / 1.08883)
  return Math.hypot(500 * (fx - fy), 200 * (fy - fz))
}

function interiorOf(luma, W, H) {
  let cur = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) cur[p] = luma[p] <= INK_MAX_LUMA ? 1 : 0
  for (let pass = 0; pass < ERODE; pass++) {
    const next = new Uint8Array(W * H)
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x
        if (!cur[p]) continue
        if (
          cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] &&
          cur[p - W - 1] && cur[p - W + 1] && cur[p + W - 1] && cur[p + W + 1]
        ) next[p] = 1
      }
    cur = next
  }
  return cur
}

/** `trimmed` matches gate 1's own statistic — the ends dropped so a handful of
 *  antialiased survivors cannot decide a flatness verdict. */
async function measure(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const luma = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
  }
  let ink = 0
  for (let p = 0; p < W * H; p++) if (luma[p] <= INK_MAX_LUMA) ink++
  const cur = interiorOf(luma, W, H)
  const vals = []
  const rgb = []
  for (let p = 0; p < W * H; p++) {
    if (!cur[p]) continue
    vals.push(luma[p])
    rgb.push([data[p * 4], data[p * 4 + 1], data[p * 4 + 2], luma[p]])
  }
  if (!vals.length) {
    return { ink, n: 0, med: 0, mean: 0, sd: 0, trimSd: 0, p95: 0, topDrb: 0, p90C: 0, dimC: 0, litC: 0, cRise: 0, deciles: [] }
  }
  const sorted = vals.slice().sort((a, b) => a - b)
  const pc = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / vals.length)
  const trim = sorted.slice(40, Math.max(41, sorted.length - 40))
  const tm = trim.reduce((a, b) => a + b, 0) / trim.length
  const trimSd = Math.sqrt(trim.reduce((a, b) => a + (b - tm) * (b - tm), 0) / trim.length)
  rgb.sort((a, b) => b[3] - a[3])
  const top = rgb.slice(0, Math.max(1, Math.floor(rgb.length * 0.1)))
  const tr = top.reduce((a, v) => a + v[0], 0) / top.length
  const tb = top.reduce((a, v) => a + v[2], 0) / top.length

  /* ---- CHROMA, PER PIXEL, AND BY DECILE (rows 9 and 10) -----------------
   * `rgb` is already sorted brightest-first. The deciles are the ten equal
   * luma slices of the interior; row 10 differences the last against the
   * first, so the statistic is a WITHIN-FRAME comparison and cannot be moved
   * by exposure.
   *
   * p90 rather than max: one antialiased survivor inside the erosion must not
   * be able to decide a verdict about the body of the form. p90 rather than
   * mean: a form whose warm and cool halves average neutral is not neutral,
   * and the mean would call it that. */
  const cs = rgb.map((v) => chroma(v[0], v[1], v[2]))
  const csSorted = cs.slice().sort((a, b) => a - b)
  const p90C = csSorted[Math.min(csSorted.length - 1, Math.floor(csSorted.length * 0.9))]
  const deciles = []
  for (let d = 0; d < 10; d++) {
    const lo = Math.floor((d * rgb.length) / 10)
    const hi = Math.floor(((d + 1) * rgb.length) / 10)
    if (hi <= lo) continue
    let cSum = 0, lSum = 0, rSum = 0, bSum = 0
    for (let i = lo; i < hi; i++) {
      cSum += cs[i]; lSum += rgb[i][3]; rSum += rgb[i][0]; bSum += rgb[i][2]
    }
    const n = hi - lo
    // `d` counts DOWN from the brightest because rgb is sorted brightest-first;
    // relabelled here so decile 1 is the darkest, which is how it reads.
    deciles.unshift({ n, luma: lSum / n, C: cSum / n, drb: rSum / n - bSum / n })
  }
  const dimC = deciles.length ? deciles[0].C : 0
  const litC = deciles.length ? deciles[deciles.length - 1].C : 0
  return {
    ink, n: vals.length, med: pc(0.5), mean, sd, trimSd, p95: pc(0.95), topDrb: tr - tb,
    p90C, dimC, litC, cRise: litC - dimC, deciles,
  }
}

async function readArm(browser, { law, rigLaw, inkWash }) {
  /* deviceScaleFactor 2 — the stage is 1120x842 CSS px inside a 1440 viewport,
   * so at dsf 1 every frame this gate stored was BELOW the repo's 1440 capture
   * floor and the decile table was reading a quarter of the pixels available.
   * The verdicts are unchanged and that was checked rather than assumed: the
   * same statistics measured at 2240x1684 by `_probe-brown-decile.mjs` read
   * interior median 47.0 (identical), and both chroma rows land the same side
   * of their bars at both scales — shipped p90 C* 0.69/0.00, the warmrig
   * known-bad 8.84/8.34, against a bar of 3.0. */
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))
  if (law) await page.addInitScript((v) => { window.__heroLitLaw = v }, law)
  /* The whole pre-2026-08-04 look — warm rig AND warm ink — behind one name.
   * Set before boot because `<Environment frames={1}>` bakes on mount. */
  if (rigLaw) await page.addInitScript((v) => { window.__studioRigLaw = v }, rigLaw)
  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })

  /* ---- THE BUILD ASSERTION. A page that never booted renders identically to
   * another page that never booted, so a "no difference" reading taken that way
   * is a green that cannot fail. Three channels: the harnesses (above), a
   * TICKING rAF loop, and a real GPU rather than the SwiftShader fallback that
   * silently pauses the loop with no error. */
  const ticks = await page.evaluate(
    () => new Promise((res) => {
      let n = 0
      const t0 = performance.now()
      const step = () => { n++; performance.now() - t0 < 400 ? requestAnimationFrame(step) : res(n) }
      requestAnimationFrame(step)
    }),
  )
  const renderer = await page.evaluate(() => {
    const c = document.createElement("canvas")
    const gl = c.getContext("webgl2") || c.getContext("webgl")
    if (!gl) return "none"
    const e = gl.getExtension("WEBGL_debug_renderer_info")
    return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "unknown"
  })
  if (ticks < 8) throw new Error(`rAF is not running (${ticks} ticks). Refusing to judge a frozen page.`)
  if (/swiftshader|software/i.test(String(renderer))) {
    throw new Error(`SwiftShader (${renderer}) — --use-angle=metal did not take. Refusing to judge.`)
  }
  await page.waitForTimeout(3500)

  const scrubber = page.locator("[data-hero-scrub]")
  const canvas = page.locator("[data-hero-stage]")
  const total = await scrubber.evaluate((el) => parseFloat(el.max))
  const setPlayhead = async (t) => {
    await scrubber.evaluate((el, value) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(value))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
  }

  /* THE PLAYHEADS ARE DERIVED FROM THE PAGE'S OWN PHASES, never hardcoded —
   * every hardcoded time in this beat's tooling has been wrong at least once
   * (storyboard §11.8), and this beat has been retimed three times. */
  const marks = []
  for (let i = 0; i < 160; i++) {
    const t = (i / 159) * total
    await setPlayhead(t)
    await page.waitForTimeout(14)
    const r = await page.evaluate(() => {
      const el = document.querySelector("[data-hero-phase]")
      if (!el) return null
      const g = (k) => { const v = el.getAttribute(k); return v === null ? null : Number(v) }
      return { ph: el.getAttribute("data-hero-phase"), flat: g("data-hero-flat") }
    })
    marks.push({ t, ...r })
  }
  const midOf = (phase) => {
    const hit = marks.filter((m) => m.ph === phase)
    if (!hit.length) throw new Error(`no "${phase}" phase on the timeline`)
    return hit[Math.floor(hit.length / 2)].t
  }
  const tFlat = midOf("breath")
  const tSolid = midOf("solid")

  await setPlayhead(tFlat)
  await page.waitForTimeout(450)
  if (inkWash) {
    /* THE CONTROL FOR ROWS 3 AND 4 — let lit surface through into the drawing.
     * It perturbs exactly the pixels those rows read, which is the rule
     * `lib/flat-interior.mjs` states: a control that skips the pipeline the
     * gate uses is a control that cannot fire. */
    await page.evaluate(() => window.__captureHarness.setFlatten({ ink: 0.8 }))
    await page.waitForTimeout(450)
  }
  const flatBuf = await canvas.screenshot()
  if (inkWash) {
    await page.evaluate(() => window.__captureHarness.setFlatten(null))
    await page.waitForTimeout(250)
  }

  await setPlayhead(tSolid)
  await page.waitForTimeout(450)
  const solidBuf = await canvas.screenshot()

  /* ---- ROW 7's SERIES: is the tonal event AT the edge, or a ramp? --------
   * Sampled across the whole emerge phase from the page's own phase readout.
   * Every frame the model still calls a drawing must measure the SAME value —
   * a tonal ramp inside the flat half would be shading a drawing, which gate 1
   * exists to forbid. */
  const emerge = marks.filter((m) => m.ph === "emerge")
  const flatSeries = []
  if (emerge.length) {
    const N = Math.min(20, emerge.length)
    for (let i = 0; i < N; i++) {
      const m = emerge[Math.floor((i * (emerge.length - 1)) / Math.max(1, N - 1))]
      if (m.flat === null || m.flat < 0.999) continue
      await setPlayhead(m.t)
      await page.waitForTimeout(90)
      const b = await canvas.screenshot()
      const s = await measure(b)
      flatSeries.push({ t: m.t, med: s.med })
    }
  }

  const F = await measure(flatBuf)
  const S = await measure(solidBuf)
  await context.close()
  return { tFlat, tSolid, flat: F, solid: S, flatSeries, errors, renderer, ticks, flatBuf, solidBuf }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()

  const shippedLaw = MUTATE === "noevent" ? "prior" : null
  const shippedRig = MUTATE === "warmrig" ? "prior" : null
  const shipped = await readArm(browser, { law: shippedLaw, rigLaw: shippedRig, inkWash: MUTATE === "inkwash" })
  const prior = await readArm(browser, { law: "prior", inkWash: false })
  await browser.close()

  writeFileSync(join(OUT, "shipped-flat.png"), shipped.flatBuf)
  writeFileSync(join(OUT, "shipped-solid.png"), shipped.solidBuf)
  writeFileSync(join(OUT, "prior-solid.png"), prior.solidBuf)

  const rows = []
  const say = (id, ok, label, detail) => {
    rows.push({ id, ok, label })
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "\n      " + detail : ""}`)
  }

  console.log(`\nrenderer ${shipped.renderer} · rAF ${shipped.ticks}/400ms · arm ${MUTATE ?? "shipped"}`)
  console.log(`playheads derived from the page: flat ${shipped.tFlat.toFixed(3)}s ("breath") · solid ${shipped.tSolid.toFixed(3)}s ("solid")\n`)

  const event = shipped.solid.med - shipped.flat.med
  const priorEvent = prior.solid.med - prior.flat.med

  say(
    1,
    event >= MIN_EVENT,
    "THE SWITCH CARRIES A TONAL EVENT — the object is a different VALUE, not only a different shape",
    `interior median ${shipped.flat.med.toFixed(1)} (drawing) -> ${shipped.solid.med.toFixed(1)} (object) = +${event.toFixed(1)} luma (needs >= ${MIN_EVENT}). ` +
      `Mean ${shipped.flat.mean.toFixed(1)} -> ${shipped.solid.mean.toFixed(1)}. The mark's ink-to-paper contrast is ~229 luma, so this is the share of it the switch actually spends.`,
  )
  say(
    2,
    priorEvent < MAX_PRIOR_EVENT,
    "...AND THE PRIOR READ DEMONSTRABLY DOES NOT — the bar is shown a build it must reject",
    `prior law: interior median ${prior.flat.med.toFixed(1)} -> ${prior.solid.med.toFixed(1)} = +${priorEvent.toFixed(1)} luma (needs < ${MAX_PRIOR_EVENT}). ` +
      `This is the beat Sebs described as *"super subtle... hard to tell it's now 3D"*, rendered live rather than remembered.`,
  )
  const dMed = Math.abs(shipped.flat.med - prior.flat.med)
  const dInk = Math.abs(shipped.flat.ink - prior.flat.ink)
  say(
    3,
    dMed <= 0.5 && dInk <= 60,
    "THE DRAWING IS UNTOUCHED — the object got lit, the picture did not get lighter",
    `flat frame: median ${shipped.flat.med.toFixed(1)} vs prior ${prior.flat.med.toFixed(1)} (needs <= 0.5 apart), ink ${shipped.flat.ink} vs ${prior.flat.ink} px (needs <= 60). ` +
      `Without this row, row 1 is satisfied by turning the whole render up, which is the wash gate 4a exists to reject.`,
  )
  /* ROW 4 IS TWO-SIDED, AND THAT IS THE WHOLE POINT OF IT.
   *
   * The one-sided version — "the flat frame's trimmed sd is under 1" — is a
   * green that CANNOT FAIL here, and I proved it rather than assumed it. The
   * arrival multiplies an `envMapIntensity` that `ink: 1` has already driven to
   * zero, so no value of `lit` can reach the drawing by construction; and
   * driving `ink` down through the real override does not break it either.
   * Measured, at the breath playhead, through `setFlatten`:
   *
   *     ink  1.00 0.90 0.80 0.70 0.60 0.50 0.40 0.30 0.20
   *     sd   .000 .028 .044 .213 .394 .426 .503 .459 .521
   *
   * **Nine steps down to a fifth of the way and it never crosses 1.** The
   * reason is not that the row is strict; it is that `depth` is 0.004 at that
   * pose, so the mark is a collapsed tube seen down its own axis — N·V is ~1
   * everywhere and there is no gradient to find whatever the shading model is
   * doing. The mark is flat there for a reason that has nothing to do with the
   * channel this row guards.
   *
   * So the row carries its own CALIBRATION instead, per `docs/DISPATCH.md` §2.6
   * — *"calibrate the instrument against a known-bad input and require it to
   * fail."* The known-bad input is the SETTLED SOLID, a frame that must not
   * read as flat. If both sides read under the bar the statistic is blind and
   * the row means nothing; the row is red in that case rather than green. */
  say(
    4,
    shipped.flat.trimSd < MAX_FLAT_SD && shipped.solid.trimSd >= MAX_FLAT_SD,
    "GATE 1 SURVIVES THE ARRIVAL — the drawing is still ONE VALUE, and the statistic can still tell",
    `drawing trimmed interior sd ${shipped.flat.trimSd.toFixed(3)} over ${shipped.flat.n} px (needs < ${MAX_FLAT_SD} — assert-hero-transition gate 1). ` +
      `CALIBRATION, on the same run: the settled solid reads ${shipped.solid.trimSd.toFixed(3)} (needs >= ${MAX_FLAT_SD}, or this statistic cannot separate a drawing from an object and the row above is worth nothing). ` +
      `[raw] flat sd ${shipped.flat.sd.toFixed(3)}, solid sd ${shipped.solid.sd.toFixed(3)}`,
  )
  say(
    5,
    shipped.solid.med >= BAND[0] && shipped.solid.med <= BAND[1],
    "THE OBJECT LANDS WHERE THE GENRE'S DIMENSIONAL FORMS LAND",
    `settled interior median ${shipped.solid.med.toFixed(1)} (needs ${BAND[0]}..${BAND[1]}). ` +
      `docs/research/online-reference-mechanics.md §9.1 measures eleven clips of this exact move and puts dimensional forms at interior 45-63 against flats at 0.7-2.7. ` +
      `It is a BAND and not a floor on purpose: past it the form stops being graphite.`,
  )
  say(
    6,
    shipped.solid.topDrb < MAX_DRB,
    "THE INK-BLACK POLICY HOLDS — no warm-tan flood bought with the extra light",
    `brightest decile of the lit form: Δr-b ${shipped.solid.topDrb.toFixed(1)} (needs < ${MAX_DRB}; the ratified conviction was rgb(142,118,91), Δr-b 50). ` +
      `The drawing's own reads ${shipped.flat.topDrb.toFixed(1)} and the prior solid ${prior.solid.topDrb.toFixed(1)}. Turning the environment up is the channel that produced that failure, so it is measured rather than assumed.`,
  )
  const meds = shipped.flatSeries.map((r) => r.med)
  const spread = meds.length ? Math.max(...meds) - Math.min(...meds) : 0
  say(
    7,
    meds.length >= 3 && spread < 6,
    "THE EVENT IS AT THE EDGE, NOT A RAMP — nothing tonal happens while the mark is still a drawing",
    `${meds.length} emerge frames the model still calls flat, interior median spread ${spread.toFixed(1)} luma (needs < 6 over >= 3 frames). ` +
      `A ramp here would be shading a drawing, which is the read the hard swap at the edge exists to avoid.`,
  )
  const errs = shipped.errors.length + prior.errors.length
  say(8, errs === 0, "console clean", `${errs} errors`)

  /* ---- ROWS 9 AND 10 — THE TIGHTENED INK-BLACK BAR ------------------------
   * Row 6 above scored the picture Sebs called brown at Δr−b 23.9 against a bar
   * of 50 and passed it. These two are what would have caught it; the constants
   * carry the derivation. The decile table is printed rather than summarised so
   * the shape of the distribution is readable — the tell on 2026-08-04 was that
   * the hue angle was 73 degrees in EVERY decile, i.e. the whole form, while
   * the single statistic being gated only looked at the top one. */
  const dec = shipped.solid.deciles
  if (dec.length) {
    console.log(
      "\n      lit form, eroded interior by luma decile (1 = darkest):\n" +
        "        decile  " + dec.map((_, i) => String(i + 1).padStart(6)).join("") + "\n" +
        "        luma    " + dec.map((d) => d.luma.toFixed(1).padStart(6)).join("") + "\n" +
        "        C*      " + dec.map((d) => d.C.toFixed(2).padStart(6)).join("") + "\n" +
        "        Δr-b    " + dec.map((d) => d.drb.toFixed(1).padStart(6)).join(""),
    )
  }
  say(
    9,
    shipped.solid.p90C <= MAX_FORM_CHROMA,
    "THE FORM IS INSIDE THE REGISTER'S OWN INK — perceptual chroma, whole form, not just the highlight",
    `p90 per-pixel CIELAB C* ${shipped.solid.p90C.toFixed(2)} (needs <= ${MAX_FORM_CHROMA}, the C* of INK_3D_RANGE's lightest member #383632, 2.82, rounded up). ` +
      `The drawing it came from reads ${shipped.flat.p90C.toFixed(2)} and the ratified tan conviction rgb(142,118,91) is C* 19.12. ` +
      `Δr−b said 23.9-against-50 on the build Sebs rejected; this statistic said 8.84-against-3.`,
  )
  say(
    10,
    shipped.solid.cRise <= MAX_CHROMA_RISE,
    "VALUE FROM LIGHT, NEVER HUE — the form gets brighter across itself WITHOUT getting more coloured",
    `C* rises ${shipped.solid.dimC.toFixed(2)} (darkest decile, luma ${dec.length ? dec[0].luma.toFixed(1) : "?"}) -> ` +
      `${shipped.solid.litC.toFixed(2)} (brightest, luma ${dec.length ? dec[dec.length - 1].luma.toFixed(1) : "?"}) = +${shipped.solid.cRise.toFixed(2)} ` +
      `(needs <= ${MAX_CHROMA_RISE}, the ratified ink range's own chroma drift across its ENTIRE value span). ` +
      `A within-frame comparison, so dimming the render cannot buy it: both terms move together. ` +
      `The build Sebs rejected read +4.25; the warm family-axis option +2.56.`,
  )

  /* ---- THE CONTROLS CHECK THEMSELVES --------------------------------------
   * A control arm that quietly stopped working reads as "the control passed
   * too", which is this repo's own definition of the lie. So each named arm
   * declares the rows it MUST turn red and the script fails if they are green. */
  /* `inkwash` declares ROW 3 ONLY, and the reason is recorded rather than
   * quietly narrowed: it was first written as [3, 4] and row 4 stayed green.
   * See row 4's own comment — `ink` cannot un-flatten that pose at all, because
   * the depth collapse has already removed the shading. A control declaration
   * that lists a row it cannot actually turn red is the same defect as a gate
   * that cannot fail, one level up. */
  /* `warmrig` is the control for rows 9 and 10 and it is not synthetic: it
   * loads the shipped arm with `window.__studioRigLaw = "prior"`, which puts
   * BOTH halves of the pre-2026-08-04 look back — the warm studio rig
   * (`components/studio-rig.tsx`) and the warm `#2A2622` ink
   * (`lib/style-system.ts`) — through the one global both files read. That is
   * the exact picture Sebs called brown, rendered rather than remembered, and
   * it reproduces the baseline capture to the digit (brightest-decile Δr−b
   * 23.92, p90 C* 8.84, interior median 46.3).
   *
   * ROW 6 IS DELIBERATELY NOT IN THIS LIST. The retired Δr−b bar stays GREEN on
   * that arm — 23.9 against 50 — and that is the demonstration, printed below,
   * that it could not have caught this. A control whose value is showing a bar
   * failing must not quietly include the bar that does not. */
  const MUST_FAIL = { noevent: [1, 5], inkwash: [3], warmrig: [9, 10] }
  let ok = rows.every((r) => r.ok)
  if (MUTATE) {
    const want = MUST_FAIL[MUTATE]
    if (!want) {
      console.log(`\nunknown --mutate=${MUTATE}`)
      process.exit(1)
    }
    const still = want.filter((id) => rows.find((r) => r.id === id)?.ok)
    console.log(
      `\n--mutate=${MUTATE}: rows ${want.join(", ")} MUST be red. ` +
        (still.length ? `Row(s) ${still.join(", ")} stayed GREEN — the control is not controlling.` : "All of them are."),
    )
    if (MUTATE === "warmrig") {
      const r6 = rows.find((r) => r.id === 6)
      console.log(
        `      and the point of the arm: the RETIRED bar (row 6, Δr−b < ${MAX_DRB}) is ${r6?.ok ? "STILL GREEN" : "red"} ` +
          `at Δr−b ${shipped.solid.topDrb.toFixed(1)} on the picture Sebs called too brown. ` +
          `That is why rows 9 and 10 exist.`,
      )
    }
    ok = still.length === 0
    console.log(ok ? "CONTROL SOUND" : "CONTROL BROKEN")
    process.exit(ok ? 0 : 1)
  }

  console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} rows passed`)
  console.log(`\n  SHIPPED  drawing med ${shipped.flat.med.toFixed(1)} sd ${shipped.flat.sd.toFixed(2)}  ->  object med ${shipped.solid.med.toFixed(1)} sd ${shipped.solid.sd.toFixed(2)}   EVENT +${event.toFixed(1)}`)
  console.log(`  PRIOR    drawing med ${prior.flat.med.toFixed(1)} sd ${prior.flat.sd.toFixed(2)}  ->  object med ${prior.solid.med.toFixed(1)} sd ${prior.solid.sd.toFixed(2)}   EVENT +${priorEvent.toFixed(1)}`)
  console.log(`\nframes -> ${OUT}`)
  process.exit(ok ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  // NOT the gate's verdict — a crash. `assert-gate-integrity.mjs` counts a
  // `.catch(() => exit(1))` as NOT exit-coupled precisely because it reports
  // the script died and never that the subject failed. The real verdict exits
  // inside main().
  process.exit(2)
})
