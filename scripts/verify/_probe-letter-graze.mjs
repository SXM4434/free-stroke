// WHAT IS TEARING A LETTER APART ONE FRAME BEFORE ITS EDGE?
//
// Filmed, the cascade's quick flips show a frame just before each edge where the
// letter comes apart into gouges — and one frame later the sliver is clean. The
// obvious suspect is the PEN CARVE: it is a `discard` driven by a signed
// distance divided by the screen derivative of a position in the mark's own
// plane, and at grazing incidence that derivative blows up, which drives the
// coverage to ~0.5 across the whole letter. Under `alphaToCoverage`, 0.5 is not
// a blend — it is a two-of-four sample MASK, i.e. a stipple.
//
// So this drives the SAME playhead instants with the carve on and with the
// carve parked (`__heroCarveLaw = "prior"`, the page's own dev arm), and stacks
// the two. If the tearing is the carve, the parked arm is clean at the same
// instant. If it is not, both tear and the diagnosis was wrong.
//
//   node scripts/verify/_probe-letter-graze.mjs --t=8.10,8.13,8.16,8.19
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { PORT } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=").slice(1).join("=") : d
}
const TIMES = arg("t", "8.10,8.13,8.16,8.19").split(",").map(Number)
const LABEL = arg("label", "graze")
const OUT = join(ROOT, "docs", "verification", "hero-beat-film", "o5-graze", LABEL)
mkdirSync(OUT, { recursive: true })

async function shoot(carvePrior) {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  if (carvePrior) await ctx.addInitScript(() => { window.__heroCarveLaw = "prior" })
  const page = await ctx.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))
  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })
  await page.waitForTimeout(4000)
  await page.locator(`[data-read-film="letterByLetter"]`).click()
  await page.waitForTimeout(900)
  const got = await page.locator("[data-hero-film]").getAttribute("data-hero-film")
  if (got !== "letterByLetter") throw new Error(`film pill did not take: ${got}`)
  const stage = page.locator("[data-hero-stage]")
  const box = await stage.boundingBox()
  const shots = []
  for (const t of TIMES) {
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      set.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.waitForTimeout(450)
    shots.push(await page.screenshot({ clip: box }))
  }
  await browser.close()
  return { shots, errors }
}

const on = await shoot(false)
const off = await shoot(true)
console.log(`page errors: carve ${on.errors.length} · prior ${off.errors.length}`)

const ZOOM = 9
const W = 110
const H = 70
const CX = 0.585
const CY = 0.505
const rows = TIMES.length
const c = createCanvas(W * ZOOM * 2 + 12, (H * ZOOM + 22) * rows)
const ctx2 = c.getContext("2d")
ctx2.imageSmoothingEnabled = false
ctx2.fillStyle = "#111"
ctx2.fillRect(0, 0, c.width, c.height)
for (let i = 0; i < rows; i++) {
  const a = await loadImage(on.shots[i])
  const b = await loadImage(off.shots[i])
  const sx = Math.round(a.width * CX - W / 2)
  const sy = Math.round(a.height * CY - H / 2)
  const y = i * (H * ZOOM + 22)
  ctx2.drawImage(a, sx, sy, W, H, 0, y, W * ZOOM, H * ZOOM)
  ctx2.drawImage(b, sx, sy, W, H, W * ZOOM + 12, y, W * ZOOM, H * ZOOM)
  ctx2.fillStyle = "#eee"
  ctx2.font = "15px monospace"
  ctx2.fillText(`t ${TIMES[i]}  LEFT: carve 0.70   RIGHT: carve parked`, 6, y + H * ZOOM + 16)
}
writeFileSync(join(OUT, "carve-ab.png"), c.toBuffer("image/png"))
console.log(`wrote ${join(OUT, "carve-ab.png")}`)
