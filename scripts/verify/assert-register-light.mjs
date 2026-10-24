// Register lighting — PASS/FAIL.
//
// The capture pass (verify-register-light.mjs) produces pictures. This asserts
// the rig's OWN signature, not "the two registers look different" — a material
// swap alone would satisfy that, and a material swap alone is exactly the thing
// this work replaced.
//
// Three signatures, each traceable to one piece of the ported rig:
//
//   1. CONTACT SHADOW. Desk Doodles pools a soft shadow under the form; Free
//      Stroke does not. Signature: the strip of ground immediately below the
//      form is darker in the Desk Doodles register than in the Free Stroke one,
//      at a raised camera where a horizontal plane is actually facing us.
//
//   2. TONAL RANGE ACROSS THE FORM. The acceptance test is that the form is not
//      a flat black cut-out. Signature: the spread of luminance across the ink
//      pixels, measured HEAD-ON — the pose where a directional-only rig shades
//      a camera-facing face uniformly and the form collapses to a silhouette.
//
//   3. THE ENVIRONMENT. Free Stroke's rig hangs a cool rim panel, a warm fill
//      and a warm floor bounce, and specular reflection bypasses albedo — so
//      its form carries banded blue and tan at once. Desk Doodles' was
//      de-warmed on purpose (a warm version once produced a measurable tan
//      flood) so nothing chromatic returns. Signature: the spread of R−B
//      across the form is far wider in Free Stroke.
//
//   4. FRESNEL RIM. Signature: how far the silhouette sits above the body in
//      the Desk Doodles register. Calibrated by flipping `rim` off and
//      re-measuring, so the threshold separates "rim present" from "a lit tube
//      has a bright edge anyway" rather than being a guess.
//
// Standing rule: HEADED Chrome, Metal ANGLE. Headless pauses rAF here.
//
// ── CONTROL ────────────────────────────────────────────────────────────────
//   --mutate=warmrig   loads the page with `window.__studioRigLaw = "prior"`,
//                      which restores the pre-2026-08-04 warm studio rig AND
//                      the warm #2A2622 ink. Row 3b MUST go red. Row 3, the
//                      RELATIVE chroma row that shipped before it, stays green
//                      on that arm — which is why 3b exists.
//
// Usage: node scripts/verify/assert-register-light.mjs [--mutate=warmrig]
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { HERO_URL } from "./lib/dev-server.mjs"

const POSES = {
  headon: { az: 0, el: 0, fill: 1.0 },
  raised: { az: 8, el: 45, fill: 1.15 },
}

const INK = 150 // below the grid's lightest line, well below the #fafafa ground

const MUTATE = (process.argv.find((a) => a.startsWith("--mutate=")) || "").split("=")[1] || null

/** ROW 3b's BAR. CIELAB C* of the register's own `INK_3D_RANGE` at its lightest
 *  (`#383632` → C* 2.82), rounded up. Same anchor and same derivation as
 *  `assert-hero-switch.mjs` rows 9/10 — one law, one number, two gates. */
const MAX_DD_CHROMA = 3.0

const srgbToLinear = (c) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}
/** Perceptual chroma. `chromaSd` below is a SPREAD of R−B and therefore says
 *  nothing about a form that is uniformly coloured — which is exactly what the
 *  2026-08-04 brown was (hue 73° in every luma decile, spread small). */
function chromaOf(r, g, b) {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b)
  const X = 0.4124564 * R + 0.3575761 * G + 0.1804375 * B
  const Y = 0.2126729 * R + 0.7151522 * G + 0.0721750 * B
  const Z = 0.0193339 * R + 0.1191920 * G + 0.9503041 * B
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t) / 116 + 16 / 116)
  const fx = f(X / 0.95047), fy = f(Y / 1.0), fz = f(Z / 1.08883)
  return Math.hypot(500 * (fx - fy), 200 * (fy - fz))
}

async function measure(file) {
  const img = await loadImage(file)
  const W = img.width
  // The lab viewport draws its own transport chrome over the lower fifth of the
  // canvas; it is HTML, not the render, and must not enter the statistics.
  const H = Math.round(img.height * 0.76)
  const c = createCanvas(W, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, W, H).data
  const lum = new Float64Array(W * H)
  const ink = new Uint8Array(W * H)
  let minX = W, maxX = 0, minY = H, maxY = 0, inkN = 0, inkSum = 0
  for (let i = 0, p = 0; p < W * H; p++, i += 4) {
    const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    lum[p] = L
    if (L < INK) {
      ink[p] = 1
      inkN++
      inkSum += L
      const x = p % W, y = (p / W) | 0
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!inkN) return null
  const mean = inkSum / inkN
  let varSum = 0
  for (let p = 0; p < W * H; p++) if (ink[p]) varSum += (lum[p] - mean) ** 2
  const sd = Math.sqrt(varSum / inkN)

  // CHROMA SPREAD across the form, as (R − B) per ink pixel.
  //
  // This is the environment's fingerprint. Free Stroke's rig deliberately hangs
  // a cool #9fc4ff rim panel, a warm #ffd9b0 fill and a warm #b9a98f floor
  // bounce, and specular reflection bypasses albedo — so its form carries
  // banded blue AND tan at once. Desk Doodles' rig was de-warmed on purpose
  // (key Δr−b 2, fill Δ5, ink-family ground) precisely so nothing chromatic
  // returns; its form should sit at one steady warm-graphite value.
  //
  // Two earlier attempts at a gloss discriminator both saturated and are worth
  // recording so they are not retried: "brightest pixel within 3px of ink"
  // catches the antialiased paper edge, and "brightest pixel enclosed by ink"
  // catches the paper showing through the counters of D, o and e.
  let cSum = 0
  for (let p = 0; p < W * H; p++) if (ink[p]) cSum += d[p * 4] - d[p * 4 + 2]
  const cMean = cSum / inkN
  let cVar = 0
  for (let p = 0; p < W * H; p++) if (ink[p]) cVar += (d[p * 4] - d[p * 4 + 2] - cMean) ** 2
  const chromaSd = Math.sqrt(cVar / inkN)

  /* ABSOLUTE PERCEPTUAL CHROMA, added 2026-08-04. `chromaSd` above is a SPREAD:
   * it separates a BANDED environment (Free Stroke's cool rim + warm floor)
   * from an even one, and that is a real signature. It is also blind to the
   * failure Sebs actually reported — a form that is uniformly warm has a small
   * spread and a large chroma, and this row passed it. p90 rather than max so
   * one antialiased survivor cannot decide the verdict. */
  const cs = []
  for (let p = 0; p < W * H; p++) if (ink[p]) cs.push(chromaOf(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]))
  cs.sort((a, b) => a - b)
  const p90C = cs.length ? cs[Math.floor(cs.length * 0.9)] : 0

  // FRESNEL RIM. The rim term is view-angle driven, so it lifts pixels whose
  // normal grazes the eye — the silhouette — and barely touches the pixels
  // facing us. Measuring the edge alone proves nothing (a lit tube has a bright
  // edge anyway); the signature is how much HIGHER the silhouette sits than the
  // body. Measured by flipping `rim` off in the register and re-running:
  // lift 62.9 with the rim, 53.4 without, and the interior moved only 1.3 —
  // edge-selective, which is what a fresnel term is.
  let edgeSum = 0, edgeN = 0, coreSum = 0, coreN = 0
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const p = y * W + x
      if (!ink[p]) continue
      if (!ink[p - 1] || !ink[p + 1] || !ink[p - W] || !ink[p + W]) {
        edgeSum += lum[p]; edgeN++
      } else if (ink[p - 2] && ink[p + 2] && ink[p - 2 * W] && ink[p + 2 * W]) {
        coreSum += lum[p]; coreN++
      }
    }
  }
  const rimLift = edgeN && coreN ? edgeSum / edgeN - coreSum / coreN : 0
  // Reported SEPARATELY as well as differenced. The rim's signature is
  // edge-selective: the silhouette rises and the interior does not. Without the
  // two halves a rim-off control can only say the difference moved, not that it
  // moved in the edge — and the original calibration's strongest sentence was
  // "the interior moved only 1.3".
  const edgeMean = edgeN ? edgeSum / edgeN : 0
  const coreMean = coreN ? coreSum / coreN : 0

  // Ground strip below the form — background only, so any darkening there is
  // the contact-shadow pool.
  let bandSum = 0, bandN = 0
  for (let y = Math.min(maxY + 6, H - 1); y <= Math.min(maxY + 110, H - 1); y++) {
    for (let x = minX; x <= maxX; x++) { bandSum += lum[y * W + x]; bandN++ }
  }
  return {
    inkN,
    mean: +mean.toFixed(2),
    sd: +sd.toFixed(2),
    chromaMean: +cMean.toFixed(2),
    chromaSd: +chromaSd.toFixed(2),
    p90C: +p90C.toFixed(2),
    rimLift: +rimLift.toFixed(2),
    edgeMean: +edgeMean.toFixed(2),
    coreMean: +coreMean.toFixed(2),
    band: +(bandSum / Math.max(bandN, 1)).toFixed(3),
  }
}

/* ── WHERE DID THE LIGHT GO? ───────────────────────────────────────────────
 *
 * The right measurement for "is this a fresnel term", and the reason the
 * edge-minus-core statistic had to be replaced as the verdict.
 *
 * `rimLift` classifies pixels as ink with `L < 150` and then averages the edge
 * ring against the core. THE MASK DEPENDS ON THE THING BEING MEASURED: a
 * brighter rim pushes its own pixels ABOVE 150 and out of the mask, so the
 * harder the rim works the fewer of its pixels are counted. Measured, at the
 * tight framing: 763 ink pixels with the rim ON against 804 with it OFF — 41
 * pixels, the brightest ones, silently discarded from exactly the ring under
 * test. The statistic then reported the rim as making the edge DARKER (−0.65)
 * and the interior brighter (+6.10), which is the opposite of what a
 * view-angle term does, and it is an artefact of the mask, not the rig.
 *
 * Two renders of the same camera 400 ms apart differ in one thing. So subtract
 * them and ask where the difference lives:
 *   · the mask comes from the rim-OFF frame ONLY, so it cannot move with the
 *     term being measured;
 *   · EDGE = an ink pixel with a non-ink 4-neighbour; CORE = an ink pixel whose
 *     neighbours two out are all ink;
 *   · a fresnel term puts its light on the EDGE and almost none in the CORE.
 * Framing-independent, threshold-independent, and its own null case is exact:
 * with the rim off in both arms every delta is 0. */
async function rimDelta(fileOn, fileOff) {
  const [a, b] = [await loadImage(fileOn), await loadImage(fileOff)]
  const W = Math.min(a.width, b.width)
  const H = Math.round(Math.min(a.height, b.height) * 0.76)
  const grab = (img) => {
    const c = createCanvas(img.width, img.height)
    const g = c.getContext("2d")
    g.drawImage(img, 0, 0)
    return g.getImageData(0, 0, W, H).data
  }
  const da = grab(a)
  const db = grab(b)
  const lum = (d, p) => 0.2126 * d[p * 4] + 0.7152 * d[p * 4 + 1] + 0.0722 * d[p * 4 + 2]
  const ink = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) if (lum(db, p) < INK) ink[p] = 1
  let eS = 0, eN = 0, cS = 0, cN = 0, absMax = 0
  for (let y = 2; y < H - 2; y++) {
    for (let x = 2; x < W - 2; x++) {
      const p = y * W + x
      if (!ink[p]) continue
      const d = lum(da, p) - lum(db, p)
      if (Math.abs(d) > absMax) absMax = Math.abs(d)
      if (!ink[p - 1] || !ink[p + 1] || !ink[p - W] || !ink[p + W]) { eS += d; eN++ }
      else if (ink[p - 2] && ink[p + 2] && ink[p - 2 * W] && ink[p + 2 * W]) { cS += d; cN++ }
    }
  }
  return {
    edgeDelta: eN ? +(eS / eN).toFixed(2) : 0,
    coreDelta: cN ? +(cS / cN).toFixed(2) : 0,
    edgePx: eN,
    corePx: cN,
    maxAbs: +absMax.toFixed(2),
  }
}

async function main() {
  const out = mkdtempSync(path.join(tmpdir(), "reglight-"))
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 200))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 200)))

  if (MUTATE === "warmrig") {
    // Before boot: `<Environment frames={1}>` bakes on mount, so a flag set
    // afterwards would light the form with the wrong rig and be invisible.
    await page.addInitScript(() => { window.__studioRigLaw = "prior" })
  }
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 60000,
  })
  await page.waitForTimeout(2500)
  const gl = page.locator("main canvas").first()

  /* ── PARK THE BEAT ON A SOLID, FULLY-DRAWN POSE FIRST. ────────────────────
   * FOUND BY RUNNING IT, 2026-07-31: this assert had gone STRUCTURALLY BLIND.
   * It measured `dd.headon: null / dd.raised: null` and `fs.*: inkN 1120` —
   * 1120 px is the studio grid, not a form — and it reported the failure
   * honestly rather than passing, which is the only reason it is fixable.
   *
   * The cause is an architecture change on the page it drives, not a defect in
   * the rig: `/desk-doodles` now OWNS the reveal clock. It writes
   * `revealRef.current = sample.reveal` and `HostRevealTick` copies that into
   * the playhead EVERY FRAME, so `__revealHarness.setProgress(1)` is overwritten
   * before the next paint. At the transport's t = 0 the beat's own reveal is 0,
   * so every frame this measured was a page with nothing drawn on it.
   *
   * The fix is to ask the beat for the state instead of fighting it: seek the
   * transport into `orbit`, where the reveal is complete and the mark is the LIT
   * SOLID this file is about (during `breath` it is a flat drawing with no
   * shading to measure at all). The camera stays the harness's to drive —
   * `orbitView` is re-issued by the page only on a React render, and a parked
   * transport does not re-render. */
  const scrubTo = async (t) => {
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, t)
  }
  const endT = await page.evaluate(() =>
    Number(document.querySelector("[data-hero-scrub]").max),
  )
  let solidT = null
  for (let t = 0.25; t < endT; t += 0.25) {
    await scrubTo(t)
    const ph = await page.evaluate(
      () => document.querySelector("[data-hero-phase]")?.dataset.heroPhase ?? null,
    )
    if (ph === "orbit") {
      solidT = t
      break
    }
  }
  if (solidT === null) {
    console.log("FAIL  the beat has no `orbit` phase to park on — the phase names moved")
    process.exit(1)
  }
  await scrubTo(solidT)
  await page.waitForTimeout(900)
  console.log(`(parked at ${solidT.toFixed(2)}s of ${endT.toFixed(2)}s — the lit solid, in "orbit")`)

  const m = {}
  const retries = []
  for (const reg of ["Desk Doodles", "Free Stroke"]) {
    await page
      .getByRole("group", { name: "Visual register" })
      .getByRole("button", { name: reg })
      .click()
    await page.waitForTimeout(1200)
    const tag = reg === "Desk Doodles" ? "dd" : "fs"
    for (const [name, p] of Object.entries(POSES)) {
      /* ── RETRIED, AND EVERY RETRY IS PRINTED. ────────────────────────────
       * Switching the register REMOUNTS the whole rig, and the beat rebuilds
       * geometry across that remount, so `orbitView` returns false and
       * `measure` returns null for a window whose length is not deterministic
       * — observed 2026-08-04 as `dd.headon: null` on one run and a 15s
       * `waitForFunction` timeout on the very next, on identical code.
       *
       * The retry is NOT a way to make a blind read look green: a null read is
       * the gate's own STRUCTURAL BLINDNESS signal (see the park block above,
       * which exists because this file once measured nothing and said so). So
       * the attempt count is recorded and printed with the results, and if
       * every attempt comes back null the read stays null and row 1 fails
       * exactly as it did before. Retrying a race is honest; swallowing a null
       * is not. */
      let shot = null
      for (let attempt = 1; attempt <= 3 && !shot; attempt++) {
        try {
          await page.evaluate(() => window.__revealHarness.setProgress(1))
          await page.waitForTimeout(500 * attempt)
          // orbitView returns false while the geometry is rebuilding and bounds
          // are momentarily null; screenshotting through that leaves the camera
          // pointed at nothing and the frame empty. Poll until it lands.
          await page.waitForFunction(
            (q) => window.__captureHarness.orbitView(q.az, q.el, q.fill),
            p,
            { timeout: 15000 },
          )
          // Re-assert the reveal after the orbit so the pool bakes against a
          // fully revealed form rather than a mid-draw one.
          await page.evaluate(() => window.__revealHarness.setProgress(1))
          await page.waitForTimeout(500)
          await page.evaluate((q) => window.__captureHarness.orbitView(q.az, q.el, q.fill), p)
          await page.waitForTimeout(350)
          const file = path.join(out, `${tag}-${name}.png`)
          await gl.screenshot({ path: file })
          shot = await measure(file)
        } catch (e) {
          shot = null
        }
        if (!shot && attempt < 3) retries.push(`${tag}.${name} attempt ${attempt}`)
      }
      m[`${tag}.${name}`] = shot
    }
  }
  if (retries.length) console.log(`(re-shot after a rebuild race: ${retries.join(", ")})`)

  /* ── THE RIM-OFF CONTROL, ON THE SAME REGISTER, AT THE SAME FRAMING ───────
   *
   * This is what the file's own ⚠ note said was impossible: "recalibrating needs
   * a rim-OFF render of the SAME register at the SAME framing, and nothing
   * exposes `lighting.rim` — it is a constant on the register". It is exposed
   * now, dev-only, in `lib/registers.ts` (see the block at the bottom of that
   * file), so the control can be MEASURED rather than argued from the Free
   * Stroke register, which differs in material and light as well.
   *
   * And the threshold changes shape, which is the actual fix. `> 58` was an
   * ABSOLUTE lift, so it was a statement about how large the mark sits on screen
   * as much as about the rim — that is why it went stale the moment the beat
   * took ownership of the framing. A SEPARATION between two renders taken 400 ms
   * apart, at one camera, on one register, cancels the framing entirely.
   *
   * The mutation is put back before anything else runs. */
  /* TWO FRAMINGS, and the second one is not belt-and-braces — it is the control
   * on the CONTROL. `rimLift` is edge-minus-core over a one-pixel ring, and at a
   * loose framing most of that ring is the antialiased boundary against paper.
   * The AA is bright on BOTH arms, so it inflates the baseline equally and
   * SWAMPS the rim's marginal contribution without changing it. (That shows in
   * the numbers: the rim-OFF lift is 53.8 here against 53.4 at the original
   * framing — essentially unmoved — while the rim-ON lift fell 62.9 → 55.3.)
   * Measuring the same pair tight tells the two stories apart: if the separation
   * comes back, the rim is intact and the loose read is dilution; if it stays
   * flat, the term itself is weak. */
  let rimOff = null
  let rimOffTight = null
  let rimOnTight = null
  const TIGHT = { az: POSES.headon.az, el: POSES.headon.el, fill: 2.2 }
  const shoot = async (name, pose) => {
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForFunction((q) => window.__captureHarness.orbitView(q.az, q.el, q.fill), pose, { timeout: 15000 })
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.waitForTimeout(450)
    await page.evaluate((q) => window.__captureHarness.orbitView(q.az, q.el, q.fill), pose)
    await page.waitForTimeout(350)
    const f = path.join(out, `${name}.png`)
    await gl.screenshot({ path: f })
    const r = await measure(f)
    if (r) r.__file = f
    return r
  }
  const rimSwitch = await page.evaluate(
    () => typeof window.__registerHarness?.setRim === "function",
  )
  if (rimSwitch) {
    // Back on Desk Doodles (the loop above left the page on Free Stroke).
    const pick = async (name) =>
      page.getByRole("group", { name: "Visual register" }).getByRole("button", { name }).click()
    await pick("Desk Doodles")
    await page.waitForTimeout(1200)
    rimOnTight = await shoot("dd-headon-tight-rimon", TIGHT)
    m["dd.headonTight.rimOn"] = rimOnTight

    const was = await page.evaluate(() => window.__registerHarness.setRim("desk-doodles", false))
    // The register object is read during render, so force one through the REAL
    // control: leave the register and come back. Nothing here reaches into React.
    await pick("Free Stroke")
    await page.waitForTimeout(700)
    await pick("Desk Doodles")
    await page.waitForTimeout(1200)
    rimOff = await shoot("dd-headon-rimoff", POSES.headon)
    m["dd.headon.rimOff"] = rimOff
    rimOffTight = await shoot("dd-headon-tight-rimoff", TIGHT)
    m["dd.headonTight.rimOff"] = rimOffTight
    // PUT IT BACK, in the same run, before anything else can read it.
    await page.evaluate(() => window.__registerHarness.setRim("desk-doodles", true))
    const restored = await page.evaluate(() => window.__registerHarness.get("desk-doodles").rim)
    m.__rimRestored = restored === true && was === true
  }

  await browser.close()

  let pass = true
  const say = (ok, label, detail) => {
    if (!ok) pass = false
    console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
  }

  for (const k of Object.keys(m)) {
    console.log(`      ${k}: ${JSON.stringify(m[k])}`)
  }

  const ddR = m["dd.raised"], fsR = m["fs.raised"]
  const ddH = m["dd.headon"], fsH = m["fs.headon"]

  say(!!(ddR && fsR && ddH && fsH), "both registers rendered a form in both poses")
  if (!ddR || !fsR || !ddH || !fsH) {
    console.log("\nASSERT FAILURES PRESENT")
    process.exit(1)
  }

  // 1. contact shadow — Desk Doodles pools, Free Stroke does not.
  const bandDrop = fsR.band - ddR.band
  say(bandDrop > 1.0, "contact shadow / pool under the form in the DD register only",
    `ground strip ${fsR.band} (FS) -> ${ddR.band} (DD), drop ${bandDrop.toFixed(2)}`)

  // 2. tonal range head-on — not a flat cut-out.
  say(ddH.sd > 12, "tonal range / DD form has real value spread head-on",
    `stddev ${ddH.sd} over ${ddH.inkN} ink px`)

  // 3. the two ENVIRONMENTS are doing different work, not one tint.
  say(fsH.chromaSd > ddH.chromaSd * 1.6, "environment / FS returns banded chroma, DD returns none",
    `chroma stddev ${fsH.chromaSd} (FS) vs ${ddH.chromaSd} (DD)`)

  /* 3b. …AND "NONE" IS CHECKED ABSOLUTELY, NOT ONLY AGAINST THE OTHER RIG.
   *
   * Row 3 is a RATIO between the two registers, so it stays green while the
   * Desk Doodles form is any colour at all, as long as Free Stroke's is more
   * banded. On 2026-08-04 Sebs said the 3D form was *"too brown, should still
   * feel black"* about a build that passed row 3 comfortably — the form was
   * uniformly warm (CIELAB hue 73° in every luma decile), so its R−B SPREAD was
   * small and its R−B LEVEL was not. A spread statistic cannot see a uniform
   * cast; that is not a calibration problem, it is the wrong quantity.
   *
   * The bar is the register's own ink: `INK_3D_RANGE`'s lightest member
   * `#383632` sits at C* 2.82, so the lit form may not exceed 3.0. Same anchor
   * as `assert-hero-switch.mjs` rows 9 and 10. Known-bad, live and reachable:
   * `--mutate=warmrig`. */
  say(ddH.p90C <= MAX_DD_CHROMA, "environment / and the DD form is achromatic in ABSOLUTE terms, not just relative ones",
    `DD p90 per-pixel CIELAB C* ${ddH.p90C} (needs <= ${MAX_DD_CHROMA}, the C* of INK_3D_RANGE's lightest ink #383632). ` +
      `Free Stroke's own reads ${fsH.p90C} — printed, not gated, because that register's chroma is its look.`)

  /* 4. FRESNEL RIM — the silhouette sits above the body by more than lighting
   *    alone accounts for. 53.4 is the same measurement with `rim` switched off.
   *
   * ⚠ THIS THRESHOLD'S CALIBRATION IS STALE, AND IT IS LEFT RED RATHER THAN
   * MOVED. 62.9-with / 53.4-without were measured at the framing this file used
   * to produce, and that framing no longer exists: the page owns the reveal and
   * the beat's `orbit` pose now decides how large the mark sits on screen (see
   * the park block above). At the pose available today the DD lift reads 55.27,
   * between the two calibration points, so the row cannot say which side of the
   * old question it is on.
   *
   * Recalibrating needs a rim-OFF render of the SAME register at the SAME
   * framing, and nothing exposes `lighting.rim` to a harness — it is a constant
   * on the register (`lib/registers.ts:247`). Lowering the number to fit is the
   * one thing that must not happen: it would turn a stale calibration into a
   * green row that means nothing.
   *
   * WHAT IS AVAILABLE AT THIS FRAMING, printed rather than asserted: Free
   * Stroke's register ships `rim: false` (`lib/registers.ts:305`), so its lift
   * is a rim-off reading of a DIFFERENT rig at the SAME size. The separation is
   * large and one-directional, which is evidence the term is alive; it is not a
   * substitute for the same-register control, because the two rigs also differ
   * in material and light. */
  console.log(
    `      [diagnostic, not the verdict] the Free Stroke register ships rim:false and lifts ` +
      `${fsH.rimLift} head-on against DD's ${ddH.rimLift}. DIFFERENT RIG — different material and ` +
      `different light — so it never could recalibrate the threshold, only show the term is not dead.`,
  )
  if (!rimOff) {
    say(false, "fresnel rim / the same-register rim-off control was measured",
      "window.__registerHarness.setRim is missing — see lib/registers.ts. Without it this row is " +
        "back to an absolute threshold that goes stale whenever the beat changes the framing.")
  } else {
    /* THE SEPARATION, not the absolute. 9.5 is the gap the ORIGINAL calibration
     * measured (62.9 with the rim, 53.4 without) and it is the only number from
     * that calibration that survives a framing change, because both of its terms
     * moved together. A rim that lifts the silhouette by less than two thirds of
     * that is not doing the job the register added it for. */
    /* The retired statistic, printed because the PAIR is the evidence that the
     * old absolute threshold was measuring the framing as much as the rim. */
    console.log(
      `      [retired statistic, edge-minus-core, mask moves with the term]\n` +
        `        loose (fill ${POSES.headon.fill})  rim ON lift ${ddH.rimLift} / OFF ${rimOff.rimLift}   ink px ${ddH.inkN} vs ${rimOff.inkN}\n` +
        (rimOnTight
          ? `        tight (fill ${TIGHT.fill})  rim ON lift ${rimOnTight.rimLift} / OFF ${rimOffTight.rimLift}   ink px ${rimOnTight.inkN} vs ${rimOffTight.inkN}  <- ${rimOffTight.inkN - rimOnTight.inkN} of the rim's own pixels pushed over the L<${INK} ink test\n`
          : "") +
        `        (the ORIGINAL calibration, at a framing gone since: 62.9 with / 53.4 without)`,
    )

    const loose = await rimDelta(path.join(out, "dd-headon.png"), path.join(out, "dd-headon-rimoff.png"))
    const tight = rimOnTight
      ? await rimDelta(path.join(out, "dd-headon-tight-rimon.png"), path.join(out, "dd-headon-tight-rimoff.png"))
      : null
    console.log(
      `      [the verdict] rim-ON minus rim-OFF, over the rim-OFF frame's own mask:\n` +
        `        loose  edge ${loose.edgeDelta}  core ${loose.coreDelta}   (${loose.edgePx} edge px, ${loose.corePx} core px, max |Δ| ${loose.maxAbs})` +
        (tight
          ? `\n        tight  edge ${tight.edgeDelta}  core ${tight.coreDelta}   (${tight.edgePx} edge px, ${tight.corePx} core px, max |Δ| ${tight.maxAbs})`
          : ""),
    )

    /* THE FLOORS. `RIM_BASE_STRENGTH` is 0.55 (viewport-3d.tsx:776, restated
     * from Desk Doodles' `applyRimGlow`), added on top of a fresnel falloff, so
     * at the silhouette it is worth tens of levels on 0..255 — the original
     * calibration's 9.5 was that term already diluted by an edge ring two thirds
     * antialiasing. 3.0 is set well under that and an order of magnitude over
     * the null case, which is EXACT: with the rim off in both arms every delta
     * is 0 by construction.
     *
     * The SELECTIVITY floor is the one that says "fresnel" rather than
     * "brighter". A view-angle term reaches the grazing edge and not the face. */
    const EDGE_FLOOR = 3.0
    const best = tight ? (Math.abs(tight.edgeDelta) > Math.abs(loose.edgeDelta) ? tight : loose) : loose
    say(
      best.maxAbs > 1.0,
      "fresnel rim / the control actually reached the render",
      `largest single-pixel change between the rim-on and rim-off frames: ${best.maxAbs} levels — a switch that changed nothing would read ~0`,
    )
    say(
      best.edgeDelta > EDGE_FLOOR,
      "fresnel rim / it puts real light on the silhouette",
      `edge Δ ${best.edgeDelta} vs floor ${EDGE_FLOOR} (loose ${loose.edgeDelta}${tight ? `, tight ${tight.edgeDelta}` : ""})`,
    )
    say(
      best.edgeDelta > Math.abs(best.coreDelta) * 2,
      "fresnel rim / it is EDGE-SELECTIVE — the silhouette lights and the interior does not",
      `edge Δ ${best.edgeDelta} against core Δ ${best.coreDelta} — a term that lifted both would be exposure, not fresnel`,
    )
    say(m.__rimRestored === true,
      "fresnel rim / the control put `lighting.rim` back",
      m.__rimRestored ? "restored to true" : "NOT RESTORED — the dev mutation is still live in this page")
  }

  // The Free Stroke register must not have been dimmed by any of this.
  say(fsH.mean > ddH.mean * 1.4, "free stroke register kept its own look",
    `ink mean ${fsH.mean} (FS) vs ${ddH.mean} (DD)`)

  say(errors.length === 0, "console errors", `${errors.length}${errors.length ? ": " + errors[0] : ""}`)

  /* THE CONTROL CHECKS ITSELF — a control arm that quietly stopped working
   * reads as "the control passed too", which is this repo's own definition of
   * the lie. */
  if (MUTATE === "warmrig") {
    const rowRed = !(ddH.p90C <= MAX_DD_CHROMA)
    console.log(
      `\n--mutate=warmrig: row 3b MUST be red. It is ${rowRed ? "red." : "GREEN — the control is not controlling."}` +
        `\n      and the point of the arm: the RELATIVE row 3 reads ${fsH.chromaSd} (FS) vs ${ddH.chromaSd} (DD) ` +
        `on the picture Sebs called too brown — ${fsH.chromaSd > ddH.chromaSd * 1.6 ? "STILL GREEN" : "red"}. That is why 3b exists.`,
    )
    console.log(rowRed ? "CONTROL SOUND" : "CONTROL BROKEN")
    process.exit(rowRed ? 0 : 1)
  }

  console.log(pass ? "\nALL REGISTER-LIGHT ASSERTS PASS" : "\nASSERT FAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
