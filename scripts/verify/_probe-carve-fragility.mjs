// THE AMPLITUDE LADDER, RE-SHOT UNDER THE CURRENT LAW — and shot at 3x, because
// the question is FRAGILITY and fragility does not exist in a 600 px contact
// sheet.
//
// ── WHY IT HAD TO BE RE-SHOT ───────────────────────────────────────────────
// `docs/verification/pen-carve/sweep/SHEET-amplitude.png` is the ladder the
// amplitude call was made from, and its K7 column is STALE: it was captured on
// 2026-08-01 before the break learned the carve, so it reports K7 assembly
// 5 -> 9 at full carve — the shattering that has since been fixed. Its FLAT
// column is still the real picture and is what this replaces properly.
//
// The recommendation of 1.00 was argued on shape purity — the pen field and the
// tube field are two real shapes and everything between is neither — and that
// argument was made BEFORE anyone had looked at the flat mark at 3x. This exists
// so the call can be made on the picture as well as on the argument.
//
// ── WHAT IT SHOOTS ─────────────────────────────────────────────────────────
// For each amplitude: the flat mark at K1 (no break) and at K7 (the beat's own
// end, break open), plus a 3x detail strip over the three places the fragility
// was reported — the `D`'s entry tick, the `s`, and the `sk` cluster. The strip
// is where the judgement is actually made; the full word is context.
//
// Usage: node scripts/verify/_probe-carve-fragility.mjs [--amounts=0,0.4,...]
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { injectSelfJunctions } from "./lib/self-junctions.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "pen-carve", "fragility")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const AMOUNTS = arg("amounts", "0,0.4,0.55,0.7,0.85,1").split(",").map(Number)
const URL = HERO_URL
const INK_MAX_LUMA = 150

/** Median ink half-width, from the mask's distance transform along scanlines —
 *  a cheap stand-in for the medial axis that is monotone in the same quantity. */
async function inkStats(buf) {
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  const x = c.getContext("2d")
  x.drawImage(img, 0, 0)
  const { data } = x.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  let ink = 0
  const runs = []
  /* ⚠ THE DETAIL CROPS ARE DERIVED FROM THIS BOX, NOT GUESSED. The first
   * version of this sheet placed them at hand-picked fractions of the stage and
   * every 3x panel came out EMPTY WHITE — the fragility sheet, with no
   * fragility in it. Measured, it cannot miss. */
  let bx0 = W
  let by0 = H
  let bx1 = -1
  let by1 = -1
  for (let y = 0; y < H; y++) {
    let run = 0
    for (let px = 0; px < W; px++) {
      const i = (y * W + px) * 4
      const on = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2] <= INK_MAX_LUMA
      if (on) {
        ink++
        run++
        if (px < bx0) bx0 = px
        if (px > bx1) bx1 = px
        if (y < by0) by0 = y
        if (y > by1) by1 = y
      } else {
        if (run > 0) runs.push(run)
        run = 0
      }
    }
    if (run > 0) runs.push(run)
  }
  runs.sort((a, b) => a - b)
  return {
    ink,
    medianRun: runs.length ? runs[runs.length >> 1] : 0,
    thinRuns: runs.filter((r) => r <= 3).length,
    runCount: runs.length,
    box: { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 },
  }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const rows = []
  const shots = []

  for (const amount of AMOUNTS) {
    await page.addInitScript((v) => {
      window.__heroCarveAmount = v
    }, amount)
    await page.goto(URL, { waitUntil: "networkidle" })
    await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, {
      timeout: 90000,
    })
    await page.waitForTimeout(2600)
    const live = await page.evaluate(() =>
      Number(document.querySelector("[data-hero-carve]")?.getAttribute("data-hero-carve")),
    )
    if (Math.abs(live - amount) > 0.005) {
      console.error(`carve ${amount} did not take (page says ${live}) — refusing to shoot.`)
      process.exit(2)
    }
    const inj = amount > 0 ? await injectSelfJunctions(page, amount) : { self: 0, after: 0 }
    await page.waitForTimeout(600)
    const box = await page.locator("[data-hero-stage]").boundingBox()
    const endT = await page.evaluate(() =>
      Number(document.querySelector("[data-hero-scrub]").max),
    )
    await page.evaluate((v) => {
      const el = document.querySelector("[data-hero-scrub]")
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, String(v))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, endT)
    await page.waitForTimeout(600)
    const png = await page.screenshot({ clip: box })
    const tag = String(Math.round(amount * 100)).padStart(3, "0")
    writeFileSync(join(OUT, `k7-${tag}.png`), png)
    const st = await inkStats(png)
    rows.push({ amount, self: inj.self, ...st })
    shots.push({ amount, png })
    console.log(
      `carve ${amount.toFixed(2)}  ink ${st.ink}  median run ${st.medianRun} px  ` +
        `runs <= 3 px: ${st.thinRuns} of ${st.runCount} (${((100 * st.thinRuns) / Math.max(1, st.runCount)).toFixed(1)} %)  ` +
        `· ${inj.self} self-crossings`,
    )
  }
  await browser.close()

  /* ---- THE SHEET · full word, then the same three details at 3x --------- */
  const first = await loadImage(shots[0].png)
  const SW = 900
  /* The MARK's own box, measured on the uncarved frame — every crop below is a
   * fraction of this, so the sheet cannot come back empty. */
  const B = rows[0].box
  const PAD = Math.round(B.h * 0.22)
  const cropY = Math.max(0, B.y - PAD)
  const cropH = Math.min(first.height - cropY, B.h + 2 * PAD)
  const scale = SW / first.width
  const SH = Math.round(cropH * scale)
  /* The three places the fragility was reported, in units of the mark's box:
   * the `D`'s entry tick, the `s` of Desk, and the `sk` cluster. */
  const det = (name, fx, fw) => ({
    name,
    x: B.x + fx * B.w,
    y: B.y - B.h * 0.12,
    w: fw * B.w,
    h: B.h * 1.24,
  })
  const DETAILS = [det("D entry tick", -0.01, 0.1), det("the s", 0.13, 0.11), det("the sk cluster", 0.16, 0.2)]
  const DZ = 3
  const dW = DETAILS.reduce((a, d) => a + Math.round(d.w * DZ) + 12, 0)
  const dH = Math.max(...DETAILS.map((d) => Math.round(d.h * DZ)))
  const rowH = SH + dH + 46
  const cv = createCanvas(Math.max(SW, dW) + 32, rowH * shots.length + 20)
  const cx = cv.getContext("2d")
  cx.fillStyle = "#ffffff"
  cx.fillRect(0, 0, cv.width, cv.height)
  for (let i = 0; i < shots.length; i++) {
    const img = await loadImage(shots[i].png)
    const y0 = i * rowH + 10
    const r = rows[i]
    cx.fillStyle = "#111"
    cx.font = "600 15px -apple-system, Helvetica, sans-serif"
    cx.fillText(
      `carve ${r.amount.toFixed(2)}   ·   ink ${r.ink} px   ·   median stroke run ${r.medianRun} px   ` +
        `·   hairline runs (<=3 px) ${((100 * r.thinRuns) / Math.max(1, r.runCount)).toFixed(1)} %`,
      16,
      y0 + 16,
    )
    cx.imageSmoothingEnabled = true
    cx.drawImage(img, 0, cropY, img.width, cropH, 16, y0 + 24, SW, SH)
    let dx = 16
    for (const d of DETAILS) {
      const w = Math.round(d.w * DZ)
      const h = Math.round(d.h * DZ)
      cx.imageSmoothingEnabled = false
      cx.drawImage(img, d.x, d.y, d.w, d.h, dx, y0 + SH + 34, w, h)
      cx.strokeStyle = "#d0d0d0"
      cx.lineWidth = 1
      cx.strokeRect(dx + 0.5, y0 + SH + 34.5, w, h)
      dx += w + 12
    }
    cx.fillStyle = "#888"
    cx.font = "12px -apple-system, Helvetica, sans-serif"
    cx.fillText(`3x:  ${DETAILS.map((d) => d.name).join("   |   ")}`, 16, y0 + SH + 30)
  }
  const sheet = join(OUT, "SHEET-fragility.png")
  writeFileSync(sheet, cv.toBuffer("image/png"))
  writeFileSync(join(OUT, "fragility.json"), JSON.stringify(rows, null, 2))
  console.log(`\n${sheet}  (${cv.width}x${cv.height})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
