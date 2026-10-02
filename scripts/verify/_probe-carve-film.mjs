// WHAT THE EMERGE WOULD LOOK LIKE — the carve retracting, as a film.
//
// A still comparison of two states says the shapes differ. It does not say the
// CHANGE reads, and the change is the whole product. The dispatch's rule is
// blunt about this: *"Save video as well as frames, and watch it back. Motion
// defects — crawl, strobing, judder — do not exist in a still."*
//
// So: take the shipped SOLID frame, carve it with the nib outline at
// `penCarve` 1 -> 0 across the emerge's own duration, and encode it. Every frame
// is the real rendered form with real pixels discarded out of it, which is what
// the proposed shader produces, so the film is of the fix rather than of a
// mock-up of it.
//
// Usage: node scripts/verify/_run-clean.mjs scripts/verify/_probe-carve-film.mjs
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { maskFromRGBA, boundaryStats, HEIGHT_FRAC } from "./lib/medial-width.mjs"
import { fitFootprint, renderStrokeMask, RECOMMENDED_NIB } from "./lib/nib-carve.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const ffmpeg = require("ffmpeg-static")
const { NIB_ANGLE_RAD } = loadTs("lib/flat-ink.ts")

const OUT = "docs/verification/flat-silhouette/carve-film"
/* STAGED. Only `frames/` is wiped here, and it holds 48 tracked stills; the mp4,
 * the sheet and report.json beside it are single-file overwrites. The frames now
 * build in a sibling staging dir and land when the film does. lib/evidence-swap.mjs. */
const EV = stageEvidence(`${OUT}/frames`)
const FRAMES_DIR = EV.open()

/* THE CARVE'S OWN CURVE. `penCarve` 1 is the drawing, 0 is the solid, and the
 * retract rides the emerge's `easeOutBack` overshoot — the same curve the depth
 * swells on, for the same reason explainer 14 §5 gives: *"Matter arriving has
 * weight; a depth that eases straight to its final value reads as a value being
 * set."* Overshoot on a SUBTRACTIVE channel means the carve retracts a little
 * PAST the tube and rocks back, i.e. the mark puffs marginally proud of its
 * settled section — which is only expressible because the carve is a discard on
 * a form that is already there. */
const easeOutBack = (t, s = 1.1) => {
  const u = t - 1
  return u * u * ((s + 1) * u + s) + 1
}

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, {
    timeout: 90000,
  })
  await page.waitForTimeout(2500)

  const scrubTo = async (v) => {
    await page.evaluate((t) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setV = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setV.call(el, String(t))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, v)
  }
  const parkT = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
  let holdT = null
  for (let t = 0.2; t < parkT; t += 0.25) {
    await scrubTo(t)
    const ph = await page.evaluate(
      () => document.querySelector("[data-hero-phase]")?.dataset.heroPhase ?? null,
    )
    if (ph === "breath") holdT = t
    else if (holdT !== null) break
  }
  await scrubTo(holdT)
  await page.waitForTimeout(600)

  /* Two live frames, one per end of the beat: the FLAT state's shading with the
   * carve on, and the SOLID's shading with it off. The carve rides the flat
   * frame while `ink` is high and the lit frame after, so the film shows the two
   * events the beat actually has — the outline filling and the light arriving —
   * on their own clocks, which is the 80 ms lag explainer 14 §5 specifies. */
  const set = async (o) => {
    await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
    await page.waitForTimeout(140)
  }
  const stage = page.locator("[data-hero-stage]")

  const FRAMES = 48
  const shots = []
  for (let i = 0; i < FRAMES; i++) {
    const u = i / (FRAMES - 1)
    // ink lags the carve by 80ms of a 540ms beat = 0.148 of the span
    const inkU = Math.max(0, Math.min(1, (u - 0.148) / (1 - 0.148)))
    await set({
      ink: 1 - inkU,
      depth: 1,
      yaw: 0,
      shade: 0,
      shadow: inkU,
      squashX: 1,
      squashY: 1,
    })
    await page.waitForTimeout(60)
    shots.push({ u, png: await stage.screenshot() })
  }
  await set(null)
  await browser.close()

  const first = await loadImage(shots[0].png)
  const W = first.width
  const FULLH = first.height
  const H = Math.floor(FULLH * HEIGHT_FRAC)

  /* Fit ONCE, on the settled solid, and reuse it for every frame. That is the
   * point of the orthographic camera: the map does not change with the beat, so
   * there is no per-frame measurement and therefore no per-frame chance to
   * disagree. The two-layer build that failed re-measured every frame. */
  const lastC = createCanvas(W, FULLH)
  const lctx = lastC.getContext("2d")
  lctx.drawImage(await loadImage(shots[FRAMES - 1].png), 0, 0)
  const liveSolid = maskFromRGBA(lctx.getImageData(0, 0, W, FULLH).data, W, FULLH).mask
  const fit = fitFootprint(liveSolid, W, H)
  console.log(
    `fit once on the settled solid: word ${fit.w.toFixed(1)} px, centre ` +
      `(${fit.cx.toFixed(1)}, ${fit.cy.toFixed(1)}), ink ${fit.ink.toFixed(2)} px, IoU ${(100 * fit.iou).toFixed(2)}%`,
  )

  /* Pre-render one nib mask per distinct carve level. */
  const LEVELS = 33
  const nibMasks = []
  for (let k = 0; k < LEVELS; k++) {
    const c = k / (LEVELS - 1) // 0 = tube, 1 = full nib
    if (c <= 0.001) {
      nibMasks.push(null)
      continue
    }
    // Lerp the nib toward the round tube: aspect 1 is the tube's own section.
    const aspect = 1 + (RECOMMENDED_NIB.aspect - 1) * c
    const taperRadii = RECOMMENDED_NIB.taperRadii * c
    const tip = 1 - (1 - RECOMMENDED_NIB.tip) * c
    nibMasks.push(
      renderStrokeMask(W, H, fit, { aspect, angle: NIB_ANGLE_RAD, taperRadii, tip }, fit.ink),
    )
  }

  const rows = []
  for (let i = 0; i < FRAMES; i++) {
    const { u, png } = shots[i]
    const carve = Math.max(0, Math.min(1, 1 - easeOutBack(u)))
    const k = Math.round(carve * (LEVELS - 1))
    const nm = nibMasks[k]

    const c = createCanvas(W, FULLH)
    const ctx = c.getContext("2d")
    ctx.drawImage(await loadImage(png), 0, 0)
    const id = ctx.getImageData(0, 0, W, FULLH)
    const live = maskFromRGBA(id.data, W, FULLH).mask

    if (nm) {
      // THE DISCARD. Where the form is inked but the nib outline is not, the
      // fragment is thrown away and the paper shows through. Paper is sampled
      // from the frame's own top-left corner so it carries the real ground.
      const pr = id.data[0]
      const pg = id.data[1]
      const pb = id.data[2]
      for (let p = 0; p < W * H; p++) {
        if (live[p] && !nm[p]) {
          const q = p * 4
          id.data[q] = pr
          id.data[q + 1] = pg
          id.data[q + 2] = pb
        }
      }
      ctx.putImageData(id, 0, 0)
    }
    const carvedMask = new Uint8Array(W * H)
    for (let p = 0; p < W * H; p++) carvedMask[p] = live[p] && (!nm || nm[p]) ? 1 : 0
    const st = boundaryStats(carvedMask, W, H)
    rows.push({ i, u, carve, median: st.median, ink: st.inkPx })

    writeFileSync(`${FRAMES_DIR}/${String(i).padStart(4, "0")}.png`, c.toBuffer("image/png"))
  }

  console.log("\n  frame     u    carve   median half-width   ink px")
  for (const r of rows)
    if (r.i % 4 === 0 || r.i === FRAMES - 1)
      console.log(
        `  ${String(r.i).padStart(5)}  ${r.u.toFixed(2)}  ${r.carve.toFixed(3)}   ` +
          `${r.median.toFixed(3).padStart(8)}          ${String(r.ink).padStart(6)}`,
      )
  const first0 = rows[0]
  const last0 = rows[rows.length - 1]
  console.log(
    `\n  across the beat: median half-width ${first0.median.toFixed(3)} -> ${last0.median.toFixed(3)} px ` +
      `(+${(100 * (last0.median / first0.median - 1)).toFixed(1)}%), ` +
      `ink ${first0.ink} -> ${last0.ink} px (+${(100 * (last0.ink / first0.ink - 1)).toFixed(1)}%)`,
  )
  let worst = 0
  for (let i = 1; i < rows.length; i++)
    worst = Math.max(worst, Math.abs(rows[i].median - rows[i - 1].median))
  console.log(
    `  largest single-frame step in median half-width: ${worst.toFixed(3)} px — ` +
      `no frame may carry the change`,
  )

  spawnSync(
    ffmpeg,
    [
      "-y", "-framerate", "24", "-i", `${FRAMES_DIR}/%04d.png`,
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", `${OUT}/emerge-carve.mp4`,
    ],
    { stdio: "inherit" },
  )
  spawnSync(
    ffmpeg,
    [
      "-y", "-i", `${OUT}/emerge-carve.mp4`,
      "-vf", "crop=760:200:180:330,fps=8,scale=380:-1,tile=4x4",
      "-frames:v", "1", `${OUT}/SHEET-emerge.png`,
    ],
    { stdio: "inherit" },
  )
  writeFileSync(`${OUT}/report.json`, JSON.stringify({ fit, rows }, null, 2))
  /* THE SWAP, after ffmpeg and the sheet have read the frames out of staging. */
  EV.commit()
  console.log(`\n-> ${OUT}/emerge-carve.mp4  +  SHEET-emerge.png`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
