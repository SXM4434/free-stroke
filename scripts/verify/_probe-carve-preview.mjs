// THE FIX, APPLIED TO THE REAL FORM, WITHOUT EDITING THE RENDERER.
//
// `components/viewport-3d.tsx` belongs to another lane this session, so the
// shader change is specified rather than made. That is not a reason to hand over
// an unproven law. A fragment `discard` does exactly one thing — it intersects
// the rendered mark with a mask — so the same result is reachable offline:
// screenshot the shipped SOLID, render the nib outline from the SAME strokes at
// the SAME footprint, and AND them. Whatever that produces is, pixel for pixel,
// what the proposed shader produces.
//
// Two things come out of it:
//
//   1. THE SEPARATION THE FIX BUYS, measured on the real form rather than on a
//      2-D stand-in for it.
//   2. THE REGISTRATION ANSWER. `viewport-3d.tsx:561` rejects a 2-D layer over
//      the WebGL one because it *"failed on REGISTRATION: two renderers, two
//      coordinate systems and a measured-bbox round-trip between them."* That
//      was written under a PERSPECTIVE camera. The hero stage now mounts an
//      ORTHOGRAPHIC one (`projection: "affine"`, storyboard §11.7.1), under
//      which the stroke-space -> screen map is a similarity transform with three
//      free parameters and no depth term at all. This probe fits those three and
//      reports the residual, which is the number that decides whether the
//      objection still stands. Neither document joins those two facts.
//
// Usage: node scripts/verify/_run-clean.mjs scripts/verify/_probe-carve-preview.mjs
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { processedHeroStrokes } from "./_hero-word.mjs"
import {
  boundaryStats,
  boundaryFromPng,
  compareBoundaries,
  maskFromRGBA,
  maskPng,
  HEIGHT_FRAC,
} from "./lib/medial-width.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const { makeFlatRenderer, NIB_ANGLE_RAD, PEN_TAPER_RADII, PEN_TIP_FRACTION, NIB_ASPECT_DEFAULT } =
  loadTs("lib/flat-ink.ts")

const OUT = "docs/verification/flat-silhouette/carve-preview"
mkdirSync(OUT, { recursive: true })

const strokes = processedHeroStrokes()
const polylines = strokes.map((s) => s.points.map((p) => ({ x: p.x, y: p.y })))

function renderMask(W, H, footprint, nib, inkPx) {
  const c = createCanvas(W, H)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#ffffff"
  ctx.fillRect(0, 0, W, H)
  const r = makeFlatRenderer(polylines, footprint, strokes, nib, inkPx)
  r.draw(ctx, 1, "#000000")
  const { data } = ctx.getImageData(0, 0, W, H)
  return maskFromRGBA(data, W, H, { crop: false }).mask
}

const iou = (a, b, n) => {
  let i = 0
  let u = 0
  for (let p = 0; p < n; p++) {
    if (a[p] || b[p]) u++
    if (a[p] && b[p]) i++
  }
  return u ? i / u : 0
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

  const stage = page.locator("[data-hero-stage]")
  const set = async (o) => {
    await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
    await page.waitForTimeout(140)
  }
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

  /* THE CAMERA IS ORTHOGRAPHIC — asserted, not assumed. The whole registration
   * argument below is a property of a parallel projection, so a run against a
   * perspective camera would be measuring something else entirely. */
  const ortho = await page.evaluate(() => window.__captureHarness?.projection?.() ?? null)

  await set({ ink: 0, depth: 1, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1 })
  await page.waitForTimeout(200)
  const solidPng = await stage.screenshot()
  writeFileSync(`${OUT}/live-solid.png`, solidPng)

  const img = await loadImage(solidPng)
  const W = img.width
  const H = Math.floor(img.height * HEIGHT_FRAC)
  const cc = createCanvas(img.width, img.height)
  const cx = cc.getContext("2d")
  cx.drawImage(img, 0, 0)
  const live = maskFromRGBA(cx.getImageData(0, 0, img.width, img.height).data, img.width, img.height).mask

  /* ---- FIT THE THREE PARAMETERS ------------------------------------------
   * Under a parallel projection with the camera dead-on, stroke space reaches
   * the screen through `x' = s.x + tx`, `y' = s.y + ty` — a uniform scale and a
   * translation, THREE numbers, and no depth term because there is no
   * perspective divide to carry one. That is the whole difference from the
   * build the doc rejected. Seeded from the ink bboxes and refined against IoU
   * with the MONOLINE render, which is the tube's own outline. */
  let bx0 = 1e9
  let bx1 = -1
  let by0 = 1e9
  let by1 = -1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (live[y * W + x]) {
        if (x < bx0) bx0 = x
        if (x > bx1) bx1 = x
        if (y < by0) by0 = y
        if (y > by1) by1 = y
      }
  /* FOUR parameters, not three, and the fourth is the finding. The first run
   * fitted only (scale, tx, ty) and reached IoU 83.98 % with the extent 8x9 px
   * out — because the two renderers' stroke WEIGHTS are set by different
   * constants and disagree by ~12 % (median half-width 6.325 px against 7.211).
   * That is explainer 14 §3's *"stroke-weight mismatch of about 11 % by
   * construction"*, and it is a mismatch of ONE SCALAR rather than of a
   * coordinate system. Fitting it is the honest thing; hiding it in the scale
   * would have traded a weight error for a size error. */
  let best = {
    w: bx1 - bx0 + 1,
    cx: (bx0 + bx1) / 2,
    cy: (by0 + by1) / 2,
    ink: 2 * 7.2,
    iou: 0,
  }
  for (let pass = 0; pass < 4; pass++) {
    const step = [8, 3, 1, 0.4][pass]
    let improved = true
    while (improved) {
      improved = false
      for (const [dw, dx, dy, di] of [
        [step, 0, 0, 0], [-step, 0, 0, 0],
        [0, step, 0, 0], [0, -step, 0, 0],
        [0, 0, step, 0], [0, 0, -step, 0],
        [0, 0, 0, step], [0, 0, 0, -step],
      ]) {
        const cand = { w: best.w + dw, cx: best.cx + dx, cy: best.cy + dy, ink: best.ink + di }
        if (cand.ink <= 2) continue
        const m = renderMask(W, H, cand, null, cand.ink)
        const v = iou(live, m, W * H)
        if (v > best.iou + 1e-6) {
          best = { ...cand, iou: v }
          improved = true
        }
      }
    }
  }

  const monoMask = renderMask(W, H, best, null, best.ink)
  const monoStats = boundaryStats(monoMask, W, H)
  const liveStats = boundaryStats(live, W, H)

  /* Registration residual, in the terms the objection was stated in: how far
   * apart are the two renderers' silhouette centres and extents. */
  const bbox = (m) => {
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++)
        if (m[y * W + x]) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
          if (y < y0) y0 = y
          if (y > y1) y1 = y
        }
    return { x0, x1, y0, y1, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, w: x1 - x0 + 1, h: y1 - y0 + 1 }
  }
  const bl = bbox(live)
  const bm = bbox(monoMask)

  console.log(`\n=== REGISTRATION, UNDER THE ORTHOGRAPHIC CAMERA ===\n`)
  console.log(`  camera projection reported by the page: ${ortho}`)
  console.log(`  fitted map: word ${best.w.toFixed(2)} px wide, centre ` +
    `(${best.cx.toFixed(2)}, ${best.cy.toFixed(2)}), ink diameter ${best.ink.toFixed(2)} px`)
  console.log(`              FOUR scalars, no depth term and no per-frame measurement`)
  console.log(`  silhouette centre   WebGL (${bl.cx.toFixed(2)}, ${bl.cy.toFixed(2)})  ` +
    `2D (${bm.cx.toFixed(2)}, ${bm.cy.toFixed(2)})   |d| = ` +
    `${Math.hypot(bl.cx - bm.cx, bl.cy - bm.cy).toFixed(2)} px`)
  console.log(`  silhouette extent   WebGL ${bl.w}x${bl.h}   2D ${bm.w}x${bm.h}   ` +
    `dw ${bm.w - bl.w} px, dh ${bm.h - bl.h} px`)
  console.log(`  mask agreement (IoU) between the two renderers: ${(100 * best.iou).toFixed(2)}%`)
  console.log(`  ink px  WebGL ${liveStats.inkPx}  ·  2D monoline ${monoStats.inkPx}  ` +
    `(${(100 * (monoStats.inkPx - liveStats.inkPx) / liveStats.inkPx).toFixed(2)}%)`)
  console.log(`  median half-width  WebGL ${liveStats.median.toFixed(3)}  ·  2D ${monoStats.median.toFixed(3)} px`)

  /* ---- THE CARVE: the shipped solid, intersected with the nib outline ----- */
  const nib = {
    aspect: NIB_ASPECT_DEFAULT,
    angle: NIB_ANGLE_RAD,
    taperRadii: PEN_TAPER_RADII,
    tip: PEN_TIP_FRACTION,
  }
  const nibMask = renderMask(W, H, best, nib, best.ink)
  const carved = new Uint8Array(W * H)
  let removed = 0
  let added = 0
  for (let p = 0; p < W * H; p++) {
    if (live[p] && nibMask[p]) carved[p] = 1
    else if (live[p]) removed++
    else if (nibMask[p]) added++
  }
  const carvedStats = boundaryStats(carved, W, H)
  const cmp = compareBoundaries(carvedStats, liveStats)

  console.log(`\n=== THE CARVE — the shipped SOLID with the nib outline discarded out of it ===\n`)
  console.log(`  nib: aspect ${nib.aspect}, angle ${((nib.angle * 180) / Math.PI).toFixed(0)} deg, ` +
    `taper ${nib.taperRadii} R to tip ${nib.tip}`)
  console.log(`  ink  ${liveStats.inkPx} -> ${carvedStats.inkPx} px  ` +
    `(${(100 * (carvedStats.inkPx - liveStats.inkPx) / liveStats.inkPx).toFixed(2)}%)`)
  console.log(`  SUBTRACTIVE? ink the nib would have ADDED outside the solid: ${added} px ` +
    `(${(100 * added / liveStats.inkPx).toFixed(3)}% — must be ~0, or a discard cannot express it)`)
  console.log(`  median half-width  ${liveStats.median.toFixed(3)} -> ${carvedStats.median.toFixed(3)} px ` +
    `(${(100 * (carvedStats.median / liveStats.median - 1)).toFixed(2)}%)`)
  console.log(`  terminal ratio     ${liveStats.terminalRatio.toFixed(3)} -> ${carvedStats.terminalRatio.toFixed(3)}`)
  console.log(`\n  SEPARATION flat vs solid: ${(100 * cmp.emdRel).toFixed(2)}% of a stroke radius`)
  console.log(`     shipped build            4.09%   (of which 4.09% is the luminance threshold — i.e. 0 shape)`)
  console.log(`     instrument's floor      10.00%`)
  console.log(`     known pen vs known tube 16.90%`)

  writeFileSync(`${OUT}/live-solid-mask.png`, maskPng(live, W, H))
  writeFileSync(`${OUT}/carved-flat-mask.png`, maskPng(carved, W, H))
  const diff = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) if (live[p] && !carved[p]) diff[p] = 1
  writeFileSync(`${OUT}/what-the-emerge-adds.png`, maskPng(carved, W, H, diff))
  writeFileSync(
    `${OUT}/report.json`,
    JSON.stringify(
      {
        projection: ortho,
        fit: best,
        registration: {
          centreDeltaPx: Math.hypot(bl.cx - bm.cx, bl.cy - bm.cy),
          extentDeltaPx: { w: bm.w - bl.w, h: bm.h - bl.h },
          iou: best.iou,
        },
        live: { inkPx: liveStats.inkPx, median: liveStats.median, terminalRatio: liveStats.terminalRatio },
        carved: { inkPx: carvedStats.inkPx, median: carvedStats.median, terminalRatio: carvedStats.terminalRatio },
        addedPx: added,
        removedPx: removed,
        separation: cmp,
      },
      null,
      2,
    ),
  )
  console.log(`\n-> ${OUT}/`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
