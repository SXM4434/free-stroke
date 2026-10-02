// DOES THE CONTACT POOL DEPEND ON THE PROJECTION? — one question, both arms.
//
// `assert-hero-flatstate.mjs` fails two rows on the shadow channel: at el 35
// the ground tone under the mark reads 249.79 whether `shadow` is 0 or 1, so
// the pool measures as absent. The registration fix put an ORTHOGRAPHIC camera
// on the hero stage, and a contact pool is a horizontal plane, so "the ortho
// camera hid the pool" is a live hypothesis and has to be settled by driving it
// rather than by reasoning about it.
//
// This drives the page's own harness twice — once with the page's default arm
// and once with `--projection=perspective` through the same
// `window.__viewport3dProjection` hook the capture uses — and prints the pool
// tone at a given elevation on both. If the pool is present under perspective
// and absent under affine, the projection owns the failure. If it is absent on
// both, it is a shadow defect that predates this lane.
//
// Usage: node scripts/verify/_probe-hero-pool-projection.mjs [--projection=perspective] [--el=35]
import { chromium } from "./lib/browser.mjs"
import { createRequire } from "node:module"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const INK_MAX = 150
const FORCE = process.argv.find((a) => a.startsWith("--projection="))?.split("=")[1] ?? null
const EL = Number(process.argv.find((a) => a.startsWith("--el="))?.split("=")[1] ?? 35)

/** Ink bbox plus the tone of the paper band immediately under it — the same
 *  measurement `assert-hero-flatstate.mjs` makes, so the numbers are comparable. */
async function stats(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = img.height
  let n = 0
  let minX = 1e9
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < H; y++)
    for (let px = 0; px < W; px++) {
      const i = (y * W + px) * 4
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
      if (l <= INK_MAX) {
        n++
        if (px < minX) minX = px
        if (px > maxX) maxX = px
        if (y > maxY) maxY = y
      }
    }
  let poolSum = 0
  let poolN = 0
  let poolMin = 255
  if (n) {
    const y0 = Math.min(H - 1, maxY + 2)
    const y1 = Math.min(H - 1, maxY + 60)
    for (let y = y0; y <= y1; y++)
      for (let px = minX; px <= maxX; px++) {
        const i = (y * W + px) * 4
        const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        if (l > INK_MAX) {
          poolSum += l
          poolN++
          if (l < poolMin) poolMin = l
        }
      }
  }
  return { n, bottom: n ? maxY : 0, pool: poolN ? poolSum / poolN : 0, poolMin }
}

const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 1440, height: 1440 } })
const p = await c.newPage()
if (FORCE) await p.addInitScript((v) => { window.__viewport3dProjection = v }, FORCE)
await p.goto(HERO_URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })
await p.waitForTimeout(2500)
const mounted = await p.evaluate(() => window.__captureHarness.projection())
if (FORCE && mounted !== FORCE) {
  console.error(`--projection=${FORCE} did not take (live camera reports "${mounted}")`)
  process.exit(2)
}
const stage = p.locator("[data-hero-stage]")
await p.evaluate(() => {
  const el = document.querySelector("[data-hero-scrub]")
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
  s.call(el, "3.0")
  el.dispatchEvent(new Event("input", { bubbles: true }))
})
await p.waitForTimeout(600)
await p.evaluate((e) => window.__captureHarness.orbitView(0, e, 1), EL)
await p.waitForTimeout(250)
const shot = async (o) => {
  await p.evaluate((v) => window.__captureHarness.setFlatten(v), o)
  await p.waitForTimeout(200)
  return stage.screenshot()
}
const bufNo = await shot({ ink: 0, depth: 1, shadow: 0, squashX: 1, squashY: 1 })
const bufFull = await shot({ ink: 0, depth: 1, shadow: 1, squashX: 1, squashY: 1 })
const no = await stats(bufNo)
const full = await stats(bufFull)

/* WHOLE-FRAME DIFF — because "the pool did not move" and "nothing moved" are
 * different findings and the second is the dead-channel class (§11.4.3, and
 * `pushScaleEnd` before it). A band statistic cannot tell them apart. */
async function pixelDiff(a, b) {
  const ia = await loadImage(a)
  const ib = await loadImage(b)
  const ca = createCanvas(ia.width, ia.height)
  const cb = createCanvas(ib.width, ib.height)
  ca.getContext("2d").drawImage(ia, 0, 0)
  cb.getContext("2d").drawImage(ib, 0, 0)
  const da = ca.getContext("2d").getImageData(0, 0, ia.width, ia.height).data
  const db = cb.getContext("2d").getImageData(0, 0, ib.width, ib.height).data
  let n = 0
  let worst = 0
  for (let i = 0; i < da.length; i += 4) {
    const d = Math.max(
      Math.abs(da[i] - db[i]),
      Math.abs(da[i + 1] - db[i + 1]),
      Math.abs(da[i + 2] - db[i + 2]),
    )
    if (d > 1) n++
    if (d > worst) worst = d
  }
  return { n, worst, total: da.length / 4 }
}
const diff = await pixelDiff(bufNo, bufFull)

console.log(
  `projection=${mounted}  el=${EL}  pool ${no.pool.toFixed(2)} -> ${full.pool.toFixed(2)}  ` +
    `delta ${(no.pool - full.pool).toFixed(2)}  poolMin ${no.poolMin.toFixed(1)} -> ${full.poolMin.toFixed(1)}  ` +
    `bottom ${no.bottom} -> ${full.bottom}\n` +
    `  whole-frame diff shadow 0 vs 1: ${diff.n} of ${diff.total} px differ by > 1 (worst channel delta ${diff.worst})`,
)
await p.evaluate(() => window.__captureHarness.setFlatten(null))
await b.close()
