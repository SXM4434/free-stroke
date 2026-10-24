// LOOK AT IT — the K7 mark at 3-5x, clean beside broken, on the page's own set.
//
// Every real correction in this work came from the eye rather than from a gate,
// so this is the instrument for the eye: it drives the LIVE beat to K7, takes
// the mark with the published junction list and again with one junction
// removed, finds what changed, and writes magnified crops of both beside a
// difference map.
//
// `--drop=<i>` removes list entry `i` (index, never `under`/`over` — a
// self-crossing has `under === over`). `--crop=x,y,w,h` overrides the automatic
// window with a hand-chosen one in stage px. `--zoom=` is the magnification.
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { HERO_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
/** No `--carve=` means the PAGE'S OWN default — the value Sebs actually sees. */
const CARVE = arg("carve", null)
const ZOOM = Number(arg("zoom", "5"))
const DROP = arg("drop", null)
const CROP = arg("crop", null)
const TAG = arg("tag", "zoom")
const OUT = join(ROOT, "docs", "verification", "hero-k7", "lane31")
mkdirSync(OUT, { recursive: true })
const INK_MAX_LUMA = 150

async function px(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  return { d: x.getImageData(0, 0, img.width, img.height), W: img.width, H: img.height }
}
const isInk = (d, i) =>
  0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2] <= INK_MAX_LUMA

function magnify(src, x0, y0, w, h, z, label) {
  const c = createCanvas(w * z, h * z + 22)
  const g = c.getContext("2d")
  g.fillStyle = "#fff"
  g.fillRect(0, 0, c.width, c.height)
  g.imageSmoothingEnabled = false
  const tmp = createCanvas(w, h)
  tmp.getContext("2d").putImageData(src.d, -x0, -y0, x0, y0, w, h)
  g.drawImage(tmp, 0, 0, w * z, h * z)
  g.fillStyle = "#000"
  g.font = "14px monospace"
  g.fillText(label, 6, h * z + 16)
  return c
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
const page = await ctx.newPage()
await page.addInitScript((c) => {
  if (c !== null) window.__heroCarveAmount = c
}, CARVE === null ? null : Number(CARVE))
await page.goto(HERO_URL, {
  waitUntil: "networkidle",
})
await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, {
  timeout: 90000,
})
await page.waitForTimeout(3000)
const jg = await page.evaluate(() => ({
  law: window.__heroJunctions.law,
  carve: window.__heroJunctions.carve,
  list: window.__heroJunctions.list,
}))
const box = await page.locator("[data-hero-stage]").boundingBox()
const endT = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
await page.evaluate((v) => {
  const el = document.querySelector("[data-hero-scrub]")
  const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
  s.call(el, String(v))
  el.dispatchEvent(new Event("input", { bubbles: true }))
}, endT)
await page.waitForTimeout(700)
const setList = async (l) => {
  await page.evaluate((v) => {
    const g = window.__heroJunctions
    window.__heroJunctions = { ...g, list: v }
  }, l)
  await page.waitForTimeout(700)
}
const shot = async () => {
  await page.waitForTimeout(320)
  return page.screenshot({ clip: box })
}

const brk = await page.evaluate(() => window.__heroBreaks)
console.log(
  `law ${jg.law} · carve ${jg.carve} · ${jg.list.length} junctions · opened ${brk.opened}`,
)
console.log(`stage box ${Math.round(box.width)} x ${Math.round(box.height)}`)
console.log(`opened: ${brk.cut.map((c) => `${c.under}-${c.over}`).join("  ")}`)

await setList([])
const clean = await px(await shot())
await setList(jg.list)
const broken = await px(await shot())
let alt = null
if (DROP !== null) {
  await setList(jg.list.filter((_, k) => k !== Number(DROP)))
  alt = await px(await shot())
  await setList(jg.list)
}

// Where the two differ.
let x0 = 1e9
let y0 = 1e9
let x1 = -1
let y1 = -1
const ref = alt ?? clean
for (let y = 0; y < Math.floor(broken.H * 0.75); y++)
  for (let x = 0; x < broken.W; x++) {
    const i = (y * broken.W + x) * 4
    if (isInk(broken.d, i) === isInk(ref.d, i)) continue
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
let win
if (CROP) {
  const [a, b, c, d] = CROP.split(",").map(Number)
  win = { x: a, y: b, w: c, h: d }
} else if (x1 < 0) {
  console.log("no difference at all")
  win = { x: 0, y: 0, w: broken.W, h: Math.floor(broken.H * 0.75) }
} else {
  const pad = 26
  win = {
    x: Math.max(0, x0 - pad),
    y: Math.max(0, y0 - pad),
    w: Math.min(broken.W, x1 + pad) - Math.max(0, x0 - pad),
    h: Math.min(broken.H, y1 + pad) - Math.max(0, y0 - pad),
  }
  console.log(`differ in x ${x0}..${x1}  y ${y0}..${y1}  ->  crop ${JSON.stringify(win)}`)
}

const panes = [
  [clean, `K1 clean`],
  [broken, `K7 all ${jg.list.length} junctions`],
]
if (alt) panes.push([alt, `K7 without [${DROP}]`])
const z = ZOOM
const cvs = panes.map(([s, l]) => magnify(s, win.x, win.y, win.w, win.h, z, l))
const sheet = createCanvas(cvs.length * (win.w * z + 8) + 8, win.h * z + 30)
const sg = sheet.getContext("2d")
sg.fillStyle = "#e8e8e8"
sg.fillRect(0, 0, sheet.width, sheet.height)
cvs.forEach((c, i) => sg.drawImage(c, 8 + i * (win.w * z + 8), 4))
const p = join(OUT, `${TAG}-x${z}.png`)
writeFileSync(p, sheet.toBuffer("image/png"))
console.log(`wrote ${p}  (${sheet.width}x${sheet.height})`)
await browser.close()
