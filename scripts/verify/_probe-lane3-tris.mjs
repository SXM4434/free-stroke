// _PROBE-LANE3-TRIS — WHAT IS IN THE TRIANGLES THAT BLANK THE FONT WORD?
//
// `_probe-lane3-margin.mjs` isolated it: at a FIXED playhead, growing only the
// `setDrawRange` front margin takes the mark from 24 002 ink px at 334 674
// indices to **1** at 335 277. The fragment test got strictly more permissive
// across that step, so the cause is the triangles that entered the range.
//
// This reads them, off the LIVE buffers (`__inflateProbe.triSpan`), and bisects
// the exact triangle at which the picture dies by moving the margin alone.
//
// Usage: node scripts/verify/_probe-lane3-tris.mjs [--at=93] [--engine=free-stroke]
//        [--word=font] [--dsf=1]
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const ENGINE = arg("engine", "free-stroke")
const WORD = arg("word", "font")
const AT = parseFloat(arg("at", "93")) / 100
const DSF = parseInt(arg("dsf", "1"), 10)
const LABEL = arg("label", `lane3-tris-${ENGINE}-${WORD}`)
const PORT = process.env.FS_PORT || "3000"
const OUT = join(ROOT, "docs", "verification", "drawin-vanish", LABEL)

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: DSF })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)))
  page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)) })

  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)
  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(3500)
  if (WORD !== "traced") {
    await page.click(`[data-word-source="${WORD}"]`)
    await page.waitForTimeout(4000)
  }
  await page.evaluate(() => {
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        setter.call(inp, "0")
        inp.dispatchEvent(new Event("input", { bubbles: true }))
        inp.dispatchEvent(new Event("change", { bubbles: true }))
        break
      }
    }
  })
  await page.waitForTimeout(2500)
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
    }
  })
  await page.waitForTimeout(2500)

  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(200)
  }
  const inkOf = async () => {
    const buf = await page.locator("[data-hero-stage]").screenshot()
    const { createCanvas, loadImage } = createRequire(import.meta.url)("@napi-rs/canvas")
    const img = await loadImage(buf)
    const c = createCanvas(img.width, img.height)
    const x = c.getContext("2d")
    x.drawImage(img, 0, 0)
    const { data } = x.getImageData(0, 0, img.width, img.height)
    const hist = new Uint32Array(256)
    const luma = new Uint8Array(img.width * img.height)
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) | 0
      luma[p] = l
      hist[l]++
    }
    let paper = 0
    for (let l = 1; l < 256; l++) if (hist[l] > hist[paper]) paper = l
    const cut = Math.max(8, paper - 45)
    let n = 0
    for (let p = 0; p < luma.length; p++) if (luma[p] < cut) n++
    return n
  }
  const drawn = async () =>
    page.evaluate(() => {
      const rs = window.__inflateProbe.revealState()
      const big = rs.ranges.reduce((a, b) => (b.totalIndices > (a?.totalIndices ?? -1) ? b : a), null)
      return { count: big.count, total: big.totalIndices, tris: Math.floor(big.count / 3) }
    })

  await seek(span.at + span.duration * AT)

  /* ---- 1. THE WHOLE BUFFER, and the window the bisect will narrow ---- */
  const whole = await page.evaluate(() => window.__inflateProbe.triSpan(0, -1))
  console.log("WHOLE BUFFER:", JSON.stringify(whole.map((s) => ({
    triangles: s.triangles, nonFinite: s.nonFinite, degenerate: s.degenerate,
    maxEdge: +s.maxEdge.toFixed(5), maxEdgeTri: s.maxEdgeTri,
    maxRadius: +s.maxRadius.toFixed(5), maxRadiusTri: s.maxRadiusTri,
  }))))

  /* ---- 2. BISECT THE BLANK, moving ONLY the margin ---- */
  const setNose = async (n) => {
    await page.evaluate((v) => window.__captureHarness.setPenTipShape({ nose: v, taper: 1.6 }), n)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(380)
  }
  let lo = 1 // known visible
  let hi = 4 // known blank
  const seen = []
  for (let it = 0; it < 14; it++) {
    const mid = (lo + hi) / 2
    await setNose(mid)
    const d = await drawn()
    const ink = await inkOf()
    seen.push({ nose: mid, tris: d.tris, count: d.count, ink })
    console.log(`  bisect nose ${mid.toFixed(6)}  tris ${String(d.tris).padStart(7)}  INK ${String(ink).padStart(7)}`)
    if (ink > 100) lo = mid
    else hi = mid
  }
  await setNose(lo)
  const lastGood = await drawn()
  await setNose(hi)
  const firstBad = await drawn()
  console.log(`\nLAST GOOD tris ${lastGood.tris} · FIRST BAD tris ${firstBad.tris} — the killer is in [${lastGood.tris}, ${firstBad.tris})`)

  /* ---- 3. READ THE TRIANGLES IN THE GAP ---- */
  const gap = await page.evaluate(
    ([a, b]) => window.__inflateProbe.triSpan(a, b),
    [lastGood.tris, firstBad.tris],
  )
  console.log("THE GAP:", JSON.stringify(gap, null, 1).slice(0, 4000))

  /* ---- 4. AND THE PER-TRIANGLE DETAIL, so the offender is named ---- */
  const detail = await page.evaluate(
    ([a, b]) => {
      const out = []
      for (const m of window.__inflateProbe.triSpan(a, b)) out.push(m)
      return out
    },
    [Math.max(0, lastGood.tris - 40), firstBad.tris + 40],
  )
  await page.evaluate(() => window.__captureHarness.setPenTipShape(null))

  writeFileSync(
    join(OUT, `tris-${(AT * 100).toFixed(2)}.json`),
    JSON.stringify({ span, at: AT, whole, seen, lastGood, firstBad, gap, detail, errors }, null, 2),
  )
  if (errors.length) console.log("\nPAGE ERRORS:\n" + errors.slice(0, 6).join("\n"))
  await context.close()
  await browser.close()
  console.log(`\n${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
