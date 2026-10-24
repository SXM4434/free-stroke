// THE TWO DIALS SEBS SAID DO NOT MOVE — FILMED, BOTH ARMS.
//
//   *"slow weather and turntable dont animate"*  — Sebs, 2026-08-04
//
// Named in `docs/verification/fusion-combos/README.md`'s reproduce block and
// then lost with the lane that wrote it, so this is a rebuild from the bar that
// README states: **both arms**. One arm is the state Sebs was standing in; the
// other is the state the fix puts him in. A single arm cannot tell a fixed dial
// from a dial that was never broken, and this repo has shipped both mistakes.
//
// ── WHY THIS IS PIXELS AND NOT THE MODEL ───────────────────────────────────
// `assert-fusion-combos.mjs` already proves the MODEL: with the camera held
// head-on a View cell's `FusionFrame` travels EXACTLY 0 at eps 0. That is the
// mechanism. It is not the complaint. Sebs did not read a frame struct, he
// looked at a mark, and **"inert in the state he viewed it in" is dead** — so
// the verdict has to come off the mark.
//
// ── THE MEASUREMENT, AND THE ONE WAY IT LIES ───────────────────────────────
// Travel across a window, minus the SAME window with the relationship switched
// off:
//
//     signal   = how far the mark travels over the window, Link 0.85
//     control  = how far it travels over the same window,  Link 0
//     net      = signal - control
//
// The control is not optional and it is not symmetry. `viewTurn`'s fixed arm
// runs the turntable, and **a mark on a turntable already changes as you orbit
// it** — a lane measuring only the signal here would be filming three.js's
// specular response and calling it a relationship. That exact error was made on
// this rail once and read 350.8 against 349.5.
//
// TWO CHANNELS, for the reason `_probe-fusion-combo-liveness.mjs` needed two:
// L1 sees anything that moves WHERE the ink is and is blind to an even tone
// change; tone sees density and weight and is blind to a shear. A dial is alive
// if either separates. Both are measured over the MARK ONLY — the union of the
// frames' own alpha — because the stroke is ~3 % of the crop and averaging a
// change on the ink across 97 % of untouched paper divides it by thirty.
//
// EVERY CROP IS COMPOSITED ONTO THE REAL PAPER before it is measured, and the
// alpha fraction is recorded. A fusion lane's first contact sheet composited a
// transparent canvas onto black and read it as "creating a fusion shreds the
// mark".
//
//   node scripts/verify/_probe-fusion-two-dead.mjs --label=run
//   ... --samples=24 --seconds=6
//
// Grade it with `assert-fusion-two-dead.mjs`. Films land beside the frames.
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import { execFileSync } from "node:child_process"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { PORT } from "./lib/dev-server.mjs"

const require = createRequire(import.meta.url)
let FFMPEG = require("ffmpeg-static")
if (!FFMPEG || !existsSync(FFMPEG)) FFMPEG = "ffmpeg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const SAMPLES = Number(arg("samples", 24))
const SECONDS = Number(arg("seconds", 6))
const CROP = (arg("crop", "0.24,0.30,0.58,0.46") || "").split(",").map(Number)
const OUT = join(ROOT, "docs", "verification", "fusion-two-dead", LABEL)
mkdirSync(OUT, { recursive: true })
const PAPER = "#ffffff"
const GAP = Math.round((SECONDS * 1000) / SAMPLES)

function testStroke() {
  const pts = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    pts.push({ x: 140 + t * 600, y: 320 + Math.sin(t * Math.PI * 2.4) * 150 })
  }
  return [pts]
}

/* ── THE ARMS ───────────────────────────────────────────────────────────────
 *
 * `before` is not a mutant. Each one is a state the product actually put a user
 * in, reconstructed exactly:
 *
 *  · viewTurn BEFORE — the pill selected with the camera where the page loads
 *    it, head-on. `orbit = atan2(camera.x, camera.z)` (viewport-3d.tsx:5222) is
 *    0 there, and `phaseTriangle` (style-fusion.ts:1522) carries a quarter-
 *    period offset that puts REST AT ZERO — so `phaseTriangle(0, 2pi)` is
 *    EXACTLY 0 and all three of Turn Table's links multiply by nothing. The
 *    offset is itself a defect fix (without it every still layer sat pinned at
 *    +1 and at the SAME value as every other), so the answer is not to remove
 *    it. `spin: 0` reproduces the state; nothing else is changed.
 *
 *  · viewTurn AFTER — selected through `selectPreset`, the function the pill's
 *    click runs, which now also starts the turntable at FUSION_VIEW_SPIN_DEG
 *    (app/page.tsx:1279). No spin is set by this probe: if the route does not
 *    start it, the arm reads dead and says so.
 *
 *  · slowWeather LOOP — the shape selecting it lands on. The claim under test
 *    is that it is ALIVE here and that the "quietest cell" note was about Burst.
 *
 *  · slowWeather BURST — all-ambient with no `event` link, on the one shape
 *    whose ambient allowance drops to BURST_AMBIENT = 0.2 (style-fusion.ts:1307,
 *    applied :1440) and whose whole idea is discrete impulses. This is the arm
 *    that must read DEAD; it is the defect, not a control.
 *
 *  · combo material+texture+fusion BURST — "Static Chrome", the NEW cell at
 *    Slow Weather's own address, which ships on Burst WITH an event link. It is
 *    the fix, and it has to be alive on the shape that killed the other one.
 *    §0.7: Slow Weather itself is untouched, so both remain selectable.
 */
const ARMS = [
  { id: "viewTurn-before", dial: "viewTurn", kind: "preset", preset: "viewTurn", spin: 0, drive: null, expect: "dead" },
  { id: "viewTurn-after", dial: "viewTurn", kind: "preset", preset: "viewTurn", spin: null, drive: null, expect: "alive" },
  { id: "slowWeather-loop", dial: "slowWeather", kind: "preset", preset: "slowWeather", spin: 0, drive: "loop", expect: "alive" },
  { id: "slowWeather-burst", dial: "slowWeather", kind: "preset", preset: "slowWeather", spin: 0, drive: "burst", expect: "dead" },
  { id: "staticChrome-burst", dial: "slowWeather", kind: "combo", combo: "material+texture+fusion", spin: 0, drive: "burst", expect: "alive" },
]

const px = (buf) => loadImage(buf)

async function cropOf(buf) {
  const img = await px(buf)
  const W = 420
  const sw = CROP[2] * img.width
  const sh = CROP[3] * img.height
  const H = Math.max(1, Math.round((W * sh) / sw))
  const c = createCanvas(W, H)
  const g = c.getContext("2d")
  g.clearRect(0, 0, W, H)
  g.drawImage(img, CROP[0] * img.width, CROP[1] * img.height, sw, sh, 0, 0, W, H)
  const rawA = g.getImageData(0, 0, W, H).data
  const n = rawA.length / 4
  const alpha = new Uint8Array(n)
  let inked = 0
  for (let i = 0; i < n; i++) {
    alpha[i] = rawA[i * 4 + 3]
    if (alpha[i] > 10) inked++
  }
  // …THEN the real paper. Measuring a transparent canvas is a lie this repo has
  // already believed once.
  g.clearRect(0, 0, W, H)
  g.fillStyle = PAPER
  g.fillRect(0, 0, W, H)
  g.drawImage(img, CROP[0] * img.width, CROP[1] * img.height, sw, sh, 0, 0, W, H)
  return { rgb: g.getImageData(0, 0, W, H).data, alpha, n, W, H, alphaFrac: inked / n, png: c.toBuffer("image/png") }
}

const lum = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b

/** L1 and tone between two crops, over the union of their own alpha. */
function pairStats(A, B) {
  let d = 0
  let m = 0
  let la = 0
  let lb = 0
  for (let i = 0; i < A.n; i++) {
    if (A.alpha[i] <= 10 && B.alpha[i] <= 10) continue
    const j = i * 4
    d += Math.abs(A.rgb[j] - B.rgb[j]) + Math.abs(A.rgb[j + 1] - B.rgb[j + 1]) + Math.abs(A.rgb[j + 2] - B.rgb[j + 2])
    la += lum(A.rgb[j], A.rgb[j + 1], A.rgb[j + 2])
    lb += lum(B.rgb[j], B.rgb[j + 1], B.rgb[j + 2])
    m++
  }
  if (!m) return { l1: 0, tone: 0 }
  return { l1: d / (m * 3), tone: Math.abs(la - lb) / m }
}

/** HOW DARK IS THE MARK, AND HOW FAR DOES ITS TONE ACTUALLY SWING.
 *
 * ADDED BECAUSE THE EYE SAW SOMETHING THE net DID NOT SAY. Slow Weather cleared
 * every liveness bar on Loop and still read PALE in the contact strip, and the
 * reason is not the relationship — its body sits ~40 luminance units brighter
 * than every other arm's, so a real tone swing happens in the narrow room
 * between a nearly-white mark and white paper. That is the same shape as the
 * halftone-on-ceramic defect this set has now been burned by twice, and a
 * `net` figure cannot express it: net says "the relationship acts", and the
 * question a viewer is asking is "can I see it".
 *
 * So both numbers are captured beside the verdict. `ink` is the mean luminance
 * of everything meaningfully darker than paper; `toneSpan` is how far that mean
 * travels across the window. Neither is asserted as a bar — there is no
 * defensible one — they are REPORTED, because "the number is a flag, not the
 * verdict". */
function inkProfile(frames) {
  const series = frames.map((f) => {
    let s = 0
    let n = 0
    for (let i = 0; i < f.n; i++) {
      const j = i * 4
      const L = lum(f.rgb[j], f.rgb[j + 1], f.rgb[j + 2])
      if (L < 245) {
        s += L
        n++
      }
    }
    return n ? s / n : 255
  })
  return { ink: +series[0].toFixed(1), toneSpan: +(Math.max(...series) - Math.min(...series)).toFixed(2) }
}

/** Travel = the furthest any frame in the window gets from frame 0, on each
 *  channel independently. `spanDelta`, not a consecutive delta: explainer 15
 *  records that **a slow effect and a dead one are identical in a frame-to-frame
 *  delta**, and `slowWeather` is by name the slowest thing on this rail. */
function travel(frames) {
  let l1 = 0
  let tone = 0
  for (let i = 1; i < frames.length; i++) {
    const s = pairStats(frames[0], frames[i])
    if (s.l1 > l1) l1 = s.l1
    if (s.tone > tone) tone = s.tone
  }
  return { l1, tone }
}

async function film(name, crops) {
  const dir = join(OUT, "frames", name)
  mkdirSync(dir, { recursive: true })
  crops.forEach((c, i) => writeFileSync(join(dir, `${String(i).padStart(3, "0")}.png`), c.png))
  try {
    execFileSync(
      FFMPEG,
      ["-y", "-framerate", "8", "-i", join(dir, "%03d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", join(OUT, `${name}.mp4`)],
      { stdio: "ignore" },
    )
  } catch (e) {
    console.warn(`  ffmpeg failed for ${name}: ${e.message}`)
  }
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200))
  })
  await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
  const renderer = await page.evaluate(() => {
    const c = document.createElement("canvas")
    const gl = c.getContext("webgl2") || c.getContext("webgl")
    const d = gl && gl.getExtension("WEBGL_debug_renderer_info")
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown"
  })
  console.log(`renderer: ${renderer}`)
  /* ⚠ SWIFTSHADER SILENTLY PAUSES THE rAF LOOP AND A FROZEN ANIMATION IS
   * IDENTICAL TO A STILL ONE IN A SCREENSHOT. This whole probe measures whether
   * things move, so it refuses to produce numbers on a software rasteriser. */
  if (/swiftshader|software/i.test(renderer))
    throw new Error(`refusing to measure motion on ${renderer} — --use-angle=metal did not take`)

  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1500)
  if (await page.evaluate(() => !!window.__revealHarness))
    await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(500)

  const grab = async () => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    return url ? Buffer.from(url.split(",")[1], "base64") : null
  }

  const results = []
  for (const arm of ARMS) {
    const legs = {}
    for (const link of [0.85, 0]) {
      /* RESET FIRST — camera AND body, and they are two different resets. The
       * camera leak was a straight bug (one View arm started the turntable and
       * every later arm was measured on a moving camera). The body is not a
       * bug: `materialPreset` is deliberately NOT in COMPOSITION_RAIL_KEYS, so
       * a preset leaves the body alone unless its own patch names one — right
       * in the product, history-dependent in evidence. */
      await page.evaluate(() => {
        window.__styleHarness.setSpin(0)
        window.__captureHarness.orbitView(0, 14)
      })
      await page.evaluate(() => window.__styleHarness.setStyle({ fusionPreset: "none" }))
      await page.waitForTimeout(250)

      const took =
        arm.kind === "combo"
          ? await page.evaluate((k) => window.__styleHarness.selectFusionCombo(k), arm.combo)
          : (await page.evaluate((id) => {
              window.__styleHarness.selectPreset("fusion", id)
              return true
            }, arm.preset))
      if (!took) throw new Error(`${arm.id}: the selection route REFUSED — that is not "it did not move"`)

      if (arm.drive) await page.evaluate((d) => window.__styleHarness.setStyle({ fusionDrive: d }), arm.drive)
      if (arm.spin !== null) await page.evaluate((s) => window.__styleHarness.setSpin(s), arm.spin)
      await page.evaluate((v) => window.__styleHarness.setStyle({ fusionIntensity: v }), link)
      await page.waitForTimeout(700)

      const spin = await page.evaluate(() => window.__styleHarness.cameraSpin())
      const on = await page.evaluate(() => window.__styleHarness.stylePreset())
      const crops = []
      for (let i = 0; i < SAMPLES; i++) {
        crops.push(await cropOf(await grab()))
        await page.waitForTimeout(GAP)
      }
      legs[link ? "signal" : "control"] = { crops, spin, on }
      if (link) await film(arm.id, crops)
    }
    const s = travel(legs.signal.crops)
    const c = travel(legs.control.crops)
    const profile = inkProfile(legs.signal.crops)
    const netL1 = s.l1 - c.l1
    const netTone = s.tone - c.tone
    const net = Math.max(netL1, netTone * 8)
    results.push({
      ...arm,
      on: legs.signal.on,
      spin: legs.signal.spin,
      alphaFrac: Number(legs.signal.crops[0].alphaFrac.toFixed(4)),
      ...profile,
      signal: { l1: +s.l1.toFixed(3), tone: +s.tone.toFixed(3) },
      control: { l1: +c.l1.toFixed(3), tone: +c.tone.toFixed(3) },
      netL1: +netL1.toFixed(3),
      netTone: +netTone.toFixed(3),
      net: +net.toFixed(3),
    })
    console.log(
      `  ${arm.id.padEnd(20)} on=${legs.signal.on} spin=${legs.signal.spin} · ` +
        `L1 ${s.l1.toFixed(2)}/${c.l1.toFixed(2)} · tone ${s.tone.toFixed(2)}/${c.tone.toFixed(2)} · net ${net.toFixed(3)} · ` +
        `ink ${profile.ink} toneSpan ${profile.toneSpan} (expect ${arm.expect})`,
    )
  }

  writeFileSync(
    join(OUT, "two-dead.json"),
    JSON.stringify({ label: LABEL, port: PORT, renderer, samples: SAMPLES, seconds: SECONDS, crop: CROP, paper: PAPER, consoleErrors, results }, null, 2),
  )
  console.log(`\nwrote ${join(OUT, "two-dead.json")} · films in ${OUT}`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
