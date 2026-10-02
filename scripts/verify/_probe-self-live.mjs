// WHICH BREAK SETS THE 112 px ADRIFT ON THE LIVE RENDER — one at a time.
//
// `assert-hero-k7-intact --self` reads K1 6 / K7 7 while the offline model reads
// 6 -> 6, so the live set is not the offline set. This publishes the live
// junction list with the self-crossings injected, then REMOVES one junction at a
// time and re-measures the component count — the same paired-with-clean
// discipline the OFAT sweeps use, on the real page.
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { injectSelfJunctions } from "./lib/self-junctions.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const URL = HERO_URL
const INK_MAX_LUMA = 150
const MIN = 40
async function comps(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width, H = Math.floor(img.height * 0.75)
  const m = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    m[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] <= INK_MAX_LUMA ? 1 : 0
  }
  const seen = new Uint8Array(W * H), st = new Int32Array(W * H), out = []
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || seen[s]) continue
    let sp = 0; st[sp++] = s; seen[s] = 1; let n = 0
    while (sp > 0) {
      const q = st[--sp]; n++
      const qx = q % W, qy = (q / W) | 0
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = qx + dx, ny = qy + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const r = ny * W + nx
        if (!m[r] || seen[r]) continue
        seen[r] = 1; st[sp++] = r
      }
    }
    out.push(n)
  }
  return out.filter((n) => n >= MIN).sort((a, b) => b - a)
}
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
const page = await ctx.newPage()
await page.addInitScript(() => { window.__heroCarveAmount = 1 })
await page.goto(URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, { timeout: 90000 })
await page.waitForTimeout(3000)
const inj = await injectSelfJunctions(page, 1)
await page.waitForTimeout(700)
const full = await page.evaluate(() => window.__heroJunctions.list)
const box = await page.locator("[data-hero-stage]").boundingBox()
const endT = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
const seek = async (t) => {
  await page.evaluate((v) => {
    const el = document.querySelector("[data-hero-scrub]")
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    s.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true }))
  }, t)
  await page.waitForTimeout(500)
}
const setList = async (l) => {
  await page.evaluate((v) => {
    const jg = window.__heroJunctions
    window.__heroJunctions = { ...jg, list: v }
  }, l)
  await page.waitForTimeout(700)
}
await seek(endT)
const shot = async () => { await page.waitForTimeout(320); return page.screenshot({ clip: box }) }
const brk = await page.evaluate(() => window.__heroBreaks)
console.log(`injected ${inj.self} self · ${full.length} junctions · opened ${brk.opened} dropped ${brk.dropped}`)
console.log(`opened: ${brk.cut.map(c => `${c.under}-${c.over}(${c.cut.toFixed(1)}u)`).join(" ")}`)
async function inkOf(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width, H = Math.floor(img.height * 0.75)
  let n = 0
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    if (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] <= INK_MAX_LUMA) n++
  }
  return n
}
/* K1 — the beat's own flat mark before the break, for the news count. */
await setList([])
const k1 = await shot()
const k1ink = await inkOf(k1)
const k1c = await comps(k1)
await setList(full)
const baseShot = await shot()
const base = await comps(baseShot)
console.log(`K1 (no junctions): ${k1c.length} comps, ink ${k1ink}`)
console.log(`ALL: ${base.length} comps [${base.join(", ")}] · news ${k1ink - (await inkOf(baseShot))} px`)
for (const b of brk.cut) {
  const keep = full.filter((j) => !(j.under === b.under && j.over === b.over))
  await setList(keep)
  const sh = await shot()
  const c = await comps(sh)
  console.log(`  without ${b.under}-${b.over}: ${c.length} comps [${c.slice(0,9).join(", ")}] · news ${k1ink - (await inkOf(sh))} px${c.length < base.length ? "   <-- THIS ONE SPLITS" : ""}`)
  await setList(full)
}
await browser.close()
