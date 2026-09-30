// _PROBE-LANE3-MARGIN — IS THE BLANK TAIL THE FRAGMENT TEST, OR THE TRIANGLES?
//
// `_probe-lane3-blank-tail.mjs` found `setPenTip("off")` is the ONLY arm that
// brings the font word back at DRAW 93.75 %. That is not yet an attribution,
// because turning the tip off changes TWO things at once:
//
//   1. the fragment test (`uFsTipOn = 0`, no `discard`), and
//   2. the DRAWN TRIANGLE SET — `components/viewport-3d.tsx` computes
//      `margin = tipOn ? radiusArc * max(2, nose + 1) : 0` and searches
//      `revealKeys` for `front = frac + margin`, so `off` also pulls the
//      `setDrawRange` boundary back by two nib half-widths of arc.
//
// One knob, two effects, is exactly the shape that makes an OFAT arm
// uninterpretable — the same trap that made the previous lane's sweep exonerate
// all three discards.
//
// ── THE SEPARATION, AND WHY IT IS CLEAN ───────────────────────────────────
// `__captureHarness.setPenTipShape({nose, taper})` moves the SHAPE without
// touching the playhead. Growing `nose` past 1:
//   · GROWS the margin — `max(2, nose+1)` — so MORE triangles are drawn, and
//   · makes the fragment test STRICTLY MORE PERMISSIVE — `back = (1 - nose) *
//     radiusArc` goes negative, which SUBTRACTS from `fsWhen` and therefore
//     discards strictly less.
// So if the mark blanks as `nose` grows at a FIXED playhead, the fragment test
// cannot be the cause and the added triangles are. If it survives, the reverse.
//
// Usage: node scripts/verify/_probe-lane3-margin.mjs [--at=93] [--engine=free-stroke]
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
const LABEL = arg("label", "lane3-margin")
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
  const readAll = async () =>
    page.evaluate(() => {
      const rs = window.__inflateProbe?.revealState?.() ?? null
      const dd = window.__inflateProbe?.drawDiag?.() ?? null
      const all = rs?.ranges ?? []
      const big = all.reduce((a, b) => (b.totalIndices > (a?.totalIndices ?? -1) ? b : a), null)
      return { frac: rs?.frac ?? null, count: big?.count ?? null, total: big?.totalIndices ?? null, diag: dd?.diag ?? null, tri: dd?.render?.triangles ?? null }
    })

  await seek(span.at + span.duration * AT)
  const base = await readAll()
  const rows = []
  /* nose only — taper is held at reed's 1.6 so the ONLY thing that moves with
   * `nose` is the margin (up) and `back` (down, i.e. more permissive). */
  const NOSES = [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4]
  for (const nose of NOSES) {
    await page.evaluate((n) => window.__captureHarness.setPenTipShape({ nose: n, taper: 1.6 }), nose)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(450)
    const r = await readAll()
    const ink = await inkOf()
    const radiusArc = r.diag?.tip?.taper != null ? r.diag.tip.taper / 1.6 : null
    const front = r.frac != null && radiusArc != null ? r.frac + radiusArc * Math.max(2, nose + 1) : null
    rows.push({ nose, ink, ...r, front })
    console.log(
      `nose ${String(nose).padStart(5)}  margin×${String(Math.max(2, nose + 1)).padStart(4)}` +
        `  front ${String(front?.toFixed(6)).padStart(9)}  tris ${String(r.tri).padStart(8)}` +
        `  range ${String(r.count).padStart(7)}  back ${String(r.diag?.tip?.back?.toFixed(6)).padStart(10)}` +
        `  INK ${String(ink).padStart(7)}`,
    )
  }
  await page.evaluate(() => window.__captureHarness.setPenTipShape(null))

  writeFileSync(join(OUT, `margin-${(AT * 100).toFixed(2)}.json`), JSON.stringify({ span, at: AT, base, rows, errors }, null, 2))
  if (errors.length) console.log("\nPAGE ERRORS:\n" + errors.slice(0, 6).join("\n"))
  await context.close()
  await browser.close()
  console.log(`\n${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
