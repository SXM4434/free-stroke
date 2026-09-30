// WHICH JUNCTION SETS INK ADRIFT, ON THE PAGE'S OWN PUBLISHED SET — one at a time.
//
// The twin of `_probe-self-live.mjs`, with the injection removed: since the
// call site landed, `app/desk-doodles/page.tsx` publishes the self-crossings
// itself, so injecting the same set again would DOUBLE it and grade a list the
// page never renders. This reads `window.__heroJunctions.list` as the page
// wrote it and removes one entry at a time — paired with the full set between
// every removal, which is the discipline that makes an OFAT sweep readable.
//
// ⚠ THE REMOVAL IS BY LIST INDEX, not by `under`/`over`. A self-crossing has
// `under === over`, so a pair-keyed filter would remove EVERY crossing on that
// stroke and report one junction's damage as another's.
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { HERO_URL } from "./lib/dev-server.mjs"

const URL = HERO_URL
const INK_MAX_LUMA = 150
const MIN = 40
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const CARVE = Number(arg("carve", "1"))
/** `--law=` drives `window.__heroJunctionLaw` — the parked arms (§0.7). */
const LAW = arg("law", null)

async function mask(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const m = new Uint8Array(W * H)
  let n = 0
  for (let p = 0; p < W * H; p++) {
    const i = p * 4
    const on =
      0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] <= INK_MAX_LUMA ? 1 : 0
    m[p] = on
    n += on
  }
  return { m, W, H, n }
}
function comps({ m, W, H }) {
  const seen = new Uint8Array(W * H)
  const st = new Int32Array(W * H)
  const out = []
  for (let s = 0; s < W * H; s++) {
    if (!m[s] || seen[s]) continue
    let sp = 0
    st[sp++] = s
    seen[s] = 1
    let n = 0
    while (sp > 0) {
      const q = st[--sp]
      n++
      const qx = q % W
      const qy = (q / W) | 0
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = qx + dx
          const ny = qy + dy
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
          const r = ny * W + nx
          if (!m[r] || seen[r]) continue
          seen[r] = 1
          st[sp++] = r
        }
    }
    out.push(n)
  }
  return out.filter((n) => n >= MIN).sort((a, b) => b - a)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
const page = await ctx.newPage()
await page.addInitScript(
  ({ c, l }) => {
    window.__heroCarveAmount = c
    if (l) window.__heroJunctionLaw = l
  },
  { c: CARVE, l: LAW },
)
await page.goto(URL, { waitUntil: "networkidle" })
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
const seek = async (t) => {
  await page.evaluate((v) => {
    const el = document.querySelector("[data-hero-scrub]")
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    s.call(el, String(v))
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }, t)
  await page.waitForTimeout(500)
}
// `syncBreakTable` caches on the list's object identity, so every write is a
// NEW array on a NEW object or the renderer keeps the old table.
const setList = async (l) => {
  await page.evaluate((v) => {
    const g = window.__heroJunctions
    window.__heroJunctions = { ...g, list: v }
  }, l)
  await page.waitForTimeout(700)
}
await seek(endT)
const shot = async () => {
  await page.waitForTimeout(320)
  return page.screenshot({ clip: box })
}
const brk = await page.evaluate(() => window.__heroBreaks)
console.log(
  `law ${jg.law} · carve ${jg.carve} · ${jg.list.length} junctions · opened ${brk.opened} dropped ${brk.dropped}`,
)
console.log(
  `opened: ${brk.cut.map((c) => `${c.under}-${c.over}(${c.cut.toFixed(1)}u)`).join("  ")}`,
)

await setList([])
const k1 = await mask(await shot())
const k1c = comps(k1)
console.log(`K1 (no junctions): ${k1c.length} comps [${k1c.join(", ")}] · ink ${k1.n}`)

await setList(jg.list)
const baseM = await mask(await shot())
const base = comps(baseM)
console.log(`ALL: ${base.length} comps [${base.join(", ")}] · news ${k1.n - baseM.n} px`)

for (let i = 0; i < jg.list.length; i++) {
  const j = jg.list[i]
  const opened = brk.cut.some((c) => c.under === j.under && c.over === j.over)
  if (!opened) continue
  await setList(jg.list.filter((_, k) => k !== i))
  const m = await mask(await shot())
  const c = comps(m)
  console.log(
    `  without [${i}] ${j.under}-${j.over}${j.underAt === undefined ? "" : `@${j.underAt}/${j.overAt}`}: ` +
      `${c.length} comps [${c.slice(0, 9).join(", ")}] · news ${k1.n - m.n} px` +
      `${c.length < base.length ? "   <-- THIS ONE SPLITS" : ""}`,
  )
  await setList(jg.list)
}
await browser.close()
