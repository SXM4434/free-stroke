// THE RANK, AT FOUR LANDING YAWS — the "muddy" question, as a picture.
//
// Board §4 O5 warns in one direction only: *"if it reads as a mistake rather
// than a shelf of hand-cut letters, the yaw is too small; push it until the side
// walls read."* At the shipped 16 deg the rank held reads as pale milk against
// an ink word that is pure black, which is what "muddy" describes. So the dial
// is driven through the PANEL — the control a person drags — and the payoff
// frame is captured at each setting.
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { PORT } from "./lib/dev-server.mjs"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => { const h = process.argv.find((a) => a.startsWith(`--${k}=`)); return h ? h.split("=").slice(1).join("=") : d }
const YAWS = arg("yaws", "0,16,24,32,40").split(",").map(Number)
const AT = parseFloat(arg("at", "12.0"))
const OUT = join(ROOT, "docs/verification/hero-beat-film", arg("label", "o5-rank-yaw"))
mkdirSync(OUT, { recursive: true })

const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 1440 } })).newPage()
const errs = []
p.on("pageerror", (e) => errs.push(String(e).slice(0, 300)))
await p.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })
await p.waitForTimeout(5000)
await p.locator('[data-read-film="letterByLetter"]').click()
await p.waitForTimeout(1200)
if ((await p.locator("[data-hero-film]").getAttribute("data-hero-film")) !== "letterByLetter")
  throw new Error("film pill did not take")

/** Drag the panel's own slider — the control a person uses, not a model write. */
async function setDial(label, v) {
  const el = p.locator(`input[type="range"]`).filter({ hasNot: p.locator("x") })
  const n = await p.evaluate(
    ([lab, val]) => {
      const rows = [...document.querySelectorAll("input[type=range]")]
      const hit = rows.find((r) => (r.closest("div")?.textContent || "").includes(lab))
      if (!hit) return -1
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(hit, String(val))
      hit.dispatchEvent(new Event("input", { bubbles: true }))
      hit.dispatchEvent(new Event("change", { bubbles: true }))
      return 1
    },
    [label, v],
  )
  void el
  if (n !== 1) {
    await p.waitForTimeout(800)
    const again = await p.evaluate(
      ([lab, val]) => {
        const rows = [...document.querySelectorAll("input[type=range]")]
        const hit = rows.find((r) => (r.closest("div")?.textContent || "").includes(lab))
        if (!hit) return -1
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        setter.call(hit, String(val))
        hit.dispatchEvent(new Event("input", { bubbles: true }))
        hit.dispatchEvent(new Event("change", { bubbles: true }))
        return 1
      },
      [label, v],
    )
    if (again !== 1) throw new Error(`no slider labelled ${label}`)
  }
}
async function scrubTo(t) {
  await p.evaluate((tt) => {
    const s = document.querySelector("[data-hero-scrub]")
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(s, String(tt))
    s.dispatchEvent(new Event("input", { bubbles: true }))
  }, t)
  await p.waitForTimeout(700)
}

const shots = []
for (const y of YAWS) {
  await setDial("Ends turned", y)
  await p.waitForTimeout(500)
  await scrubTo(AT)
  const buf = await p.screenshot()
  const f = join(OUT, `yaw-${String(y).padStart(2, "0")}.png`)
  writeFileSync(f, buf)
  shots.push({ y, f })
  const img0 = await loadImage(f)
  const cc = createCanvas(img0.width, img0.height)
  const c2 = cc.getContext("2d")
  c2.drawImage(img0, 0, 0)
  // the STAGE only — the panel on the right is chrome, not the picture
  const d = c2.getImageData(0, 67, 1120, 841).data
  const lum = []
  const px = []
  for (let q = 0; q < d.length; q += 4) {
    const L = 0.2126 * d[q] + 0.7152 * d[q + 1] + 0.0722 * d[q + 2]
    if (L < 200) { lum.push(L); px.push([d[q], d[q + 1], d[q + 2], L]) }
  }
  lum.sort((a, b) => a - b)
  const core = lum.slice(0, Math.max(1, Math.round(lum.length * 0.1)))
  const coreMean = core.reduce((a, b) => a + b, 0) / core.length
  const med = lum[Math.floor(lum.length / 2)]
  /* CHROMA, which is what "muddy" is actually about. Luma alone cannot tell warm
   * milky brown from neutral graphite — they can sit at the same brightness.
   * max(r,g,b) − min(r,g,b) over the mark, and the r−b split that says WARM. */
  let sat = 0, warm = 0
  for (const [r, g, bl] of px) { sat += Math.max(r, g, bl) - Math.min(r, g, bl); warm += r - bl }
  sat /= Math.max(1, px.length); warm /= Math.max(1, px.length)
  console.log(`yaw ${String(y).padStart(2)} -> ink core ${coreMean.toFixed(1).padStart(5)}  median ${med.toFixed(1).padStart(5)}  chroma ${sat.toFixed(1).padStart(5)}  warm(r-b) ${warm.toFixed(1).padStart(5)}  mark px ${px.length}`)
}
console.log("pageerrors:", errs.length, errs.slice(0, 3))
await b.close()

/* stack them, cropped to the word, at 2x */
const W = 620, H = 170, Z = 1.8
const c = createCanvas(W * Z, (H * Z + 20) * shots.length)
const ctx = c.getContext("2d")
ctx.fillStyle = "#101010"; ctx.fillRect(0, 0, c.width, c.height)
for (let i = 0; i < shots.length; i++) {
  const img = await loadImage(shots[i].f)
  ctx.drawImage(img, Math.round(img.width * 0.396 - W / 2), Math.round(img.height * 0.342 - H / 2), W, H, 0, i * (H * Z + 20), W * Z, H * Z)
  ctx.fillStyle = "#eee"; ctx.font = "14px monospace"
  ctx.fillText(`landYaw ${shots[i].y}°`, 6, i * (H * Z + 20) + H * Z + 15)
}
writeFileSync(join(OUT, "compare.png"), c.toBuffer("image/png"))
console.log(join(OUT, "compare.png"))
