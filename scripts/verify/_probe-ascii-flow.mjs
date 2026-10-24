// WHY DOES AN ASCII FLOW LINK MOVE NOTHING? Read the uniforms, don't guess.
//
// assert-fusion-authoring measured Δ0.005 for the `asciiFlow` target on a
// composition where the arithmetic says the glyph grid should shift by ~9.6
// cells. Three explanations were available by reasoning and none of them could
// be settled by reasoning: the shader's scroll branch may be inactive, the
// phase uniform may not be receiving the addition, or the shift may be real and
// invisible. This reads the actual values.
import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const stroke = () => {
  const pts = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    pts.push({ x: 140 + t * 600, y: 320 + Math.sin(t * Math.PI * 2.4) * 150 })
  }
  return [pts]
}

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage()
await page.goto(LAB_URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), stroke())
await page.waitForTimeout(1500)
await page.evaluate(() => window.__revealHarness?.setProgress(1))

const setStyle = (patch) => page.evaluate((p) => window.__styleHarness.setStyle(p), patch)
const grab = async () => {
  const url = await page.evaluate(() => window.__captureHarness.grab())
  return url ? Buffer.from(url.split(",")[1], "base64") : null
}
const { createCanvas, loadImage } = await import("@napi-rs/canvas")
const delta = async (a, b) => {
  const [ia, ib] = await Promise.all([loadImage(a), loadImage(b)])
  const w = Math.min(ia.width, ib.width), h = Math.min(ia.height, ib.height)
  const ca = createCanvas(w, h), cb = createCanvas(w, h)
  ca.getContext("2d").drawImage(ia, 0, 0)
  cb.getContext("2d").drawImage(ib, 0, 0)
  const da = ca.getContext("2d").getImageData(0, 0, w, h).data
  const db = cb.getContext("2d").getImageData(0, 0, w, h).data
  let s = 0
  for (let i = 0; i < da.length; i += 4) s += Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])
  return s / (w * h * 3)
}

const BASE = {
  textureEnabled: false, ditherEnabled: false,
  asciiEnabled: true, asciiAnimated: true, asciiAnimationType: "scroll", asciiDirection: "horizontal",
  asciiAmount: 1, motionMode: "independent",
  layerStackEnabled: false, stackAnimationEnabled: false, stackAnimationType: "none",
  materialPreset: "ink",
  fusionDrive: "loop", fusionIntensity: 1, fusionSwing: 1, fusionAnimationSpeed: 1,
}
const link = (amount) => ({
  customFusions: [{ id: "p", name: "p", glowColor: "#7ec8a0", links: [{ id: "l", source: "reveal", target: "asciiFlow", amount }] }],
  fusionPreset: "custom:p",
})

const FREEZE = { layerStackEnabled: true, stackAnimationEnabled: true, stackAnimationType: "freezeOnComplete" }
for (const arm of [
  { name: "ascii scroll, motion OFF (phase pinned at 0)", extra: { motionMode: "off" } },
  { name: "ascii scroll + stack freeze, latched at 0", extra: FREEZE },
  { name: "ascii scroll + stack freeze, latched LATE", extra: FREEZE, latch: true },
  { name: "ascii CYCLE + stack freeze, latched LATE", extra: { ...FREEZE, asciiAnimationType: "cycle" }, latch: true },
  { name: "ascii scroll, clock RUNNING (phase advancing)", extra: {} },
  { name: "control: asciiDensity instead of flow", extra: {}, target: "asciiDensity" },
]) {
  const mkl = (amount) => ({
    customFusions: [{ id: "p", name: "p", glowColor: "#7ec8a0", links: [{ id: "l", source: "reveal", target: arm.target ?? "asciiFlow", amount }] }],
    fusionPreset: "custom:p",
  })
  if (arm.latch) {
    await setStyle({ ...BASE, ...arm.extra, stackAnimationType: "none", customFusions: [], fusionPreset: "none" })
    await page.waitForTimeout(2200)
  }
  await setStyle({ ...BASE, ...arm.extra, ...mkl(0) })
  await page.waitForTimeout(900)
  const a = await grab()
  // Self-spread first: if this composition is not still, the number below is noise.
  await page.waitForTimeout(500)
  const a2 = await grab()
  await setStyle({ ...BASE, ...arm.extra, ...mkl(1) })
  await page.waitForTimeout(900)
  const b = await grab()
  console.log(`${arm.name.padEnd(46)} self ${(await delta(a, a2)).toFixed(3)}   effect ${(await delta(a, b)).toFixed(3)}`)
}

await browser.close()
