// Tuning sweeps for the presets that the envMapIntensity fix un-pinned.
// Uses the `custom` preset as a stand-in so every parameter can be driven from
// the harness, and reports the gloss statistic from the perception literature
// (luminance-histogram skewness, Motoyoshi et al. 2007) alongside mean/spec.
import { chromium } from "playwright-core"
import { loadImage, createCanvas } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

const OUT = "/Users/sebs/Desktop/Projects/free-stroke/docs/verification/material-craft/tune"
mkdirSync(OUT, { recursive: true })

function testStroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) { const t = i / 120; pts.push({ x: 120 + t * 620, y: 330 + Math.sin(t * Math.PI * 2.2) * 130 + Math.sin(t * Math.PI * 6) * 22 }) }
  return [pts]
}
async function stats(buf) {
  const img = await loadImage(buf); const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  const d = c.getContext("2d").getImageData(0, 0, img.width, img.height).data
  const L = []; let sr = 0, sg = 0, sb = 0, n = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 40) continue
    L.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])
    sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++
  }
  if (!n) return { mean: 0, max: 0, skew: 0, spec: 0, chroma: 0 }
  const m = L.reduce((s, v) => s + v, 0) / n
  const sd = Math.sqrt(L.reduce((s, v) => s + (v - m) ** 2, 0) / n) || 1
  const skew = L.reduce((s, v) => s + ((v - m) / sd) ** 3, 0) / n
  const srt = [...L].sort((a, b) => a - b)
  const q = (p) => srt[Math.min(srt.length - 1, Math.floor(p * srt.length))]
  return { mean: m, skew, spec: q(0.99) - q(0.5), chroma: Math.max(sr, sg, sb) / n - Math.min(sr, sg, sb) / n }
}
const browser = await chromium.launch({ channel: "chrome", headless: false, args: ["--use-angle=metal"] })
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 40000 })
await page.evaluate((p) => { window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }); window.__captureHarness.enable() }, testStroke())
await page.waitForTimeout(1500)
await page.evaluate(() => window.__styleHarness.setMode("solid"))
await page.waitForTimeout(900)
await page.evaluate(() => window.__revealHarness.setProgress(1))
await page.evaluate(() => window.__captureHarness.orbitView(0, 0, 0.42))
await page.waitForTimeout(400)
const grab = async () => Buffer.from((await page.evaluate(() => window.__captureHarness.grab())).match(/base64,(.+)/)[1], "base64")
const setStyle = (p) => page.evaluate((x) => window.__styleHarness.setStyle(x), p)
const setCustom = (p) => page.evaluate((x) => window.__styleHarness.setCustom(x), p)
await setStyle({ materialPreset: "custom", materialUserOverride: true, materialAnimationEnabled: false, materialAnimationType: "none", textureEnabled: false, ditherEnabled: false, asciiEnabled: false, fusionPreset: "none", layerStackEnabled: false, motionMode: "off" })
await page.waitForTimeout(700)

const run = async (tag, patch) => {
  await setCustom(patch); await page.waitForTimeout(520)
  const buf = await grab()
  writeFileSync(join(OUT, `${tag}.png`), buf)
  const s = await stats(buf)
  console.log(`  ${tag.padEnd(34)} lum ${s.mean.toFixed(1).padStart(6)}  spec ${s.spec.toFixed(1).padStart(6)}  skew ${s.skew.toFixed(2).padStart(6)}  chroma ${s.chroma.toFixed(1).padStart(6)}`)
}

// --- CERAMIC: a glaze needs a body dark enough for the highlight to have a tail
console.log("\n== ceramic: body value sweep (clearcoat 1.0, roughness 0.12, env 1.8) ==")
for (const col of ["#e2e6ea", "#c6ccd4", "#aab3bf", "#8e99a8", "#727e8e", "#5a6675"]) {
  await run(`ceramic_body_${col.slice(1)}`, { color: col, roughness: 0.12, metalness: 0, clearcoat: 1.0, sheen: 0, sheenColor: "#000000", emissive: "#000000", emissiveIntensity: 0, envMapIntensity: 1.8 })
}
console.log("== ceramic: env sweep at body #8e99a8 ==")
for (const e of [0.8, 1.2, 1.8, 2.4]) {
  await run(`ceramic_env_${e}`, { color: "#8e99a8", roughness: 0.12, metalness: 0, clearcoat: 1.0, sheen: 0, sheenColor: "#000000", emissive: "#000000", emissiveIntensity: 0, envMapIntensity: e })
}

// --- DESK DOODLES: env was authored against a pinned 1.0; find what restores it
console.log("\n== deskDoodles: env sweep (colour LOCKED to the ratified ink) ==")
for (const e of [0.12, 0.3, 0.5, 0.8, 1.0, 1.4]) {
  await run(`dd_env_${e}`, { color: "#2A2622", roughness: 1.0, metalness: 0, clearcoat: 0, sheen: 0, sheenColor: "#000000", emissive: "#000000", emissiveIntensity: 0, envMapIntensity: e })
}

// --- RUBBER
console.log("\n== rubber: env sweep ==")
for (const e of [0.4, 0.7, 1.0, 1.4, 1.8]) {
  await run(`rubber_env_${e}`, { color: "#2c2927", roughness: 0.82, metalness: 0, clearcoat: 0.04, sheen: 1.0, sheenColor: "#8f7d68", emissive: "#000000", emissiveIntensity: 0, envMapIntensity: e })
}

// --- MATTE CLAY
console.log("\n== matteClay: env sweep ==")
for (const e of [0.12, 0.3, 0.5, 0.8, 1.2]) {
  await run(`clay_env_${e}`, { color: "#6f6457", roughness: 1.0, metalness: 0, clearcoat: 0, sheen: 0, sheenColor: "#000000", emissive: "#000000", emissiveIntensity: 0, envMapIntensity: e })
}

// --- NEON: emissive vs form. Too much emissive flattens the tube to a decal.
console.log("\n== neon: emissive intensity vs surviving form (contrast) ==")
for (const ei of [0.6, 1.0, 1.4, 1.8, 2.4]) {
  await run(`neon_emi_${ei}`, { color: "#1a0b10", roughness: 0.4, metalness: 0, clearcoat: 0.6, sheen: 0, sheenColor: "#000000", emissive: "#ff2d6f", emissiveIntensity: ei, envMapIntensity: 0.4 })
}
console.log("== neon: env sweep at emissive 1.2 ==")
for (const e of [0.4, 1.0, 1.6, 2.2]) {
  await run(`neon_env_${e}`, { color: "#1a0b10", roughness: 0.4, metalness: 0, clearcoat: 0.6, sheen: 0, sheenColor: "#000000", emissive: "#ff2d6f", emissiveIntensity: 1.2, envMapIntensity: e })
}
await browser.close()
