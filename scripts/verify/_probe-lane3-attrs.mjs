// _PROBE-LANE3-ATTRS — DOES THE SUBMITTED RANGE OVER-RUN AN ATTRIBUTE?
//
// The blank tail on the font word has been narrowed to a THRESHOLD in the drawn
// index count: at a fixed playhead, growing only the `setDrawRange` front margin
// takes the mark from 24 005 ink px at 111 558 triangles to **1** at 111 759,
// while the tip's fragment test gets strictly MORE permissive across the step
// (`back = (1 - nose) * radiusArc` goes negative). The 201 triangles that enter
// are geometrically ordinary — 0 non-finite, 0 degenerate, max edge 0.0071
// against a mark 1.56 across.
//
// The one remaining mechanism that drops a WHOLE draw call rather than a
// triangle is an index that is legal for `position` and past the end of some
// OTHER enabled attribute: WebGL validates against every one of them, and
// `revealState()`'s audit only ever checked `position`.
//
// So this reads two things nothing has read yet:
//   · `__inflateProbe.attrCensus(count)` — every attribute's length against the
//     largest index the submitted range actually reaches, and
//   · EVERY console message, at every level. The previous sweeps filtered on
//     `type === "error"`, and Chrome reports a failed draw as a GL warning.
//
// Usage: node scripts/verify/_probe-lane3-attrs.mjs [--at=93] [--engine=free-stroke]
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
const LABEL = arg("label", `lane3-attrs-${ENGINE}-${WORD}`)
const PORT = process.env.FS_PORT || "3000"
const OUT = join(ROOT, "docs", "verification", "drawin-vanish", LABEL)

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: DSF })
  const page = await context.newPage()
  const logs = []
  page.on("pageerror", (e) => logs.push({ type: "pageerror", text: String(e).slice(0, 400) }))
  page.on("console", (m) => logs.push({ type: m.type(), text: m.text().slice(0, 400) }))

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

  await seek(span.at + span.duration * AT)
  const setNose = async (n) => {
    await page.evaluate((v) => window.__captureHarness.setPenTipShape({ nose: v, taper: 1.6 }), n)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(400)
  }

  const shot = async (label, nose) => {
    await setNose(nose)
    const before = logs.length
    const ink = await inkOf()
    const r = await page.evaluate(() => {
      const rs = window.__inflateProbe.revealState()
      const big = rs.ranges.reduce((a, b) => (b.totalIndices > (a?.totalIndices ?? -1) ? b : a), null)
      return { count: big.count, census: window.__inflateProbe.attrCensus(big.count) }
    })
    const fresh = logs.slice(before)
    console.log(`\n${label} (nose ${nose})  INK ${ink}  drawn indices ${r.count}`)
    for (const c of r.census) {
      console.log(
        `   ${c.name.padEnd(12)} idx ${String(c.indexCount).padStart(7)} drawn ${String(c.drawn).padStart(7)}` +
          `  maxIndexUpTo ${String(c.maxIndexUpTo).padStart(7)}  attrs ${JSON.stringify(c.attrs)}` +
          `  SHORT ${c.short.length ? JSON.stringify(c.short) : "none"}`,
      )
    }
    if (fresh.length) console.log("   console during this arm:", JSON.stringify(fresh.slice(0, 6)))
    return { label, nose, ink, ...r, fresh }
  }

  const good = await shot("LAST GOOD", 2.2)
  const bad = await shot("FIRST BAD", 2.3)

  writeFileSync(join(OUT, `attrs-${(AT * 100).toFixed(2)}.json`), JSON.stringify({ span, at: AT, good, bad, logs }, null, 2))
  await page.evaluate(() => window.__captureHarness.setPenTipShape(null))
  console.log(`\nALL CONSOLE (${logs.length}):`)
  for (const l of logs.slice(0, 40)) console.log(`  [${l.type}] ${l.text}`)
  await context.close()
  await browser.close()
  console.log(`\n${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
