// Why is the scene not still with motionMode "off"? Measure the residual so the
// OFAT sweep can be given a floor derived from the scene rather than assumed.
import { chromium } from "./lib/browser.mjs"
import { loadImage, createCanvas } from "@napi-rs/canvas"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const dec = async (buf) => {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  return ctx.getImageData(0, 0, img.width, img.height).data
}
const mad = (a, b) => {
  let s = 0, n = 0
  for (let i = 0; i < a.length; i += 4) { s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n += 3 }
  return s / n
}
const maxd = (a, b) => {
  let m = 0
  for (let i = 0; i < a.length; i += 4)
    for (let k = 0; k < 3; k++) m = Math.max(m, Math.abs(a[i + k] - b[i + k]))
  return m
}

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 1460 }, reducedMotion: "no-preference" })
await p.goto(LAB_URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__styleHarness)
const pts = []
for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push({ x: 140 + t * 470, y: 330 + Math.sin(t * Math.PI * 2.1) * 120 }) }
await p.evaluate((x) => window.__styleHarness.injectStrokes(x, { msPerPoint: 12 }), [pts])
await p.waitForTimeout(1800)

const vp = p.locator("canvas").last()
const arms = {
  "everything on, motion off": {
    motionMode: "off",
    textureEnabled: true, textureMode: "scanlines", textureIntensity: 0.8, textureAnimated: false,
    ditherEnabled: true, ditherType: "dotScreen", ditherIntensity: 0.8, ditherAnimated: false,
    asciiEnabled: true, asciiCharset: "classic", asciiAnimated: false,
    layerStackEnabled: true, stackAnimationEnabled: false,
    materialAnimationEnabled: false, fusionPreset: "terminalGel",
  },
  "no fusion": {
    motionMode: "off", fusionPreset: "none",
    textureEnabled: true, textureMode: "scanlines", textureAnimated: false,
    ditherEnabled: true, ditherAnimated: false, asciiEnabled: true, asciiAnimated: false,
    layerStackEnabled: true, stackAnimationEnabled: false, materialAnimationEnabled: false,
  },
  "bare (no layers, no fusion)": {
    motionMode: "off", fusionPreset: "none",
    textureEnabled: false, ditherEnabled: false, asciiEnabled: false,
    layerStackEnabled: false, stackAnimationEnabled: false, materialAnimationEnabled: false,
  },
}
const SETTLE = Number(process.argv.find((a) => a.startsWith("--settle="))?.split("=")[1] ?? 1400)
for (const [name, patch] of Object.entries(arms)) {
  await p.evaluate((x) => window.__styleHarness.setStyle(x), patch)
  // The shared completion pulse decays as exp(-t/0.5) from whenever the fusion
  // was ARMED, so a short settle measures a legitimate one-shot dying, not a
  // violation of "Motion mode: Off". `--settle=` is how that is told apart.
  await p.waitForTimeout(SETTLE)
  const shots = []
  for (let i = 0; i < 5; i++) { await p.waitForTimeout(260); shots.push(await dec(await vp.screenshot())) }
  let worstM = 0, worstX = 0, ident = 0
  for (let i = 1; i < shots.length; i++) {
    const m = mad(shots[0], shots[i]); const x = maxd(shots[0], shots[i])
    if (m === 0) ident++
    worstM = Math.max(worstM, m); worstX = Math.max(worstX, x)
  }
  console.log(`${name.padEnd(30)} identical ${ident}/4 · worst mean|Δ| ${worstM.toFixed(4)} · worst max|Δ| ${worstX}`)
}
await b.close()
