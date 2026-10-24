// _PROBE-LANE3-WHEN — WHICH GESTURE LEAVES `aFsLetter` SHORTER THAN `position`?
//
// The blank tail is now named: `glDrawElements: Vertex buffer is not big enough
// for the draw call`. `position` and `normal` carry 59 936 vertices and
// `aFsLetter` carries 58 998, so the moment `setDrawRange` submits an index of
// 58 998 or more the driver rejects the WHOLE draw call and the mark vanishes
// entire. 59 936 − 58 998 = 938, which is exactly the number of vertices
// `ownTrianglesWhole` duplicates: the split grew position and normal and left
// the letter attribute at its pre-split length.
//
// `ownTrianglesWhole` is internally consistent when it runs once on a fresh
// geometry, so the mismatch must be produced by a SEQUENCE. This walks Sebs's
// own sequence one step at a time and reads the attribute counts and
// `window.__letterSeam` after each, so the answer is "this gesture", not "some
// gesture".
//
// Usage: node scripts/verify/_probe-lane3-when.mjs [--engine=free-stroke] [--word=font]
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const ENGINE = arg("engine", "free-stroke")
const WORD = arg("word", "font")
const LABEL = arg("label", `lane3-when-${ENGINE}-${WORD}`)
const PORT = process.env.FS_PORT || "3000"
const OUT = join(ROOT, "docs", "verification", "drawin-vanish", LABEL)

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const logs = []
  page.on("pageerror", (e) => logs.push({ type: "pageerror", text: String(e).slice(0, 300) }))
  page.on("console", (m) => logs.push({ type: m.type(), text: m.text().slice(0, 300) }))

  const steps = []
  const read = async (label) => {
    const r = await page.evaluate(() => ({
      census: window.__inflateProbe?.attrCensus?.(-1) ?? null,
      seam: window.__letterSeam ?? null,
    }))
    const gl = logs.filter((l) => l.text.includes("not big enough")).length
    steps.push({ label, ...r, glErrors: gl })
    for (const c of r.census ?? []) {
      if (c.indexCount < 100) continue
      console.log(
        `${label.padEnd(26)} idx ${String(c.indexCount).padStart(7)} maxIdx ${String(c.maxIndexUpTo).padStart(7)}` +
          `  attrs ${JSON.stringify(c.attrs)}  SHORT ${c.short.length ? c.short.join(",") : "none"}` +
          `  seam ${JSON.stringify(r.seam)}  GLfails ${gl}`,
      )
    }
    return r
  }

  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(3000)
  await read("0 load (traced, DD)")

  await page.click(`[data-engine-option="${ENGINE}"]`)
  await page.waitForTimeout(4000)
  await read(`1 engine=${ENGINE}`)

  if (WORD !== "traced") {
    await page.click(`[data-word-source="${WORD}"]`)
    await page.waitForTimeout(5000)
    await read(`2 word=${WORD}`)
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
  await page.waitForTimeout(4000)
  await read("3 wobble=0")

  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
    }
  })
  await page.waitForTimeout(4000)
  await read("4 endpoint=clean")

  /* AND THE END OF THE BEAT — the tail is only where the sweep looked. If the
   * attribute is short at all, every playhead that submits the whole buffer is
   * equally dead, which is the whole SOLID hold and every frame after it. */
  await page.evaluate(() => {
    const el = document.querySelector("[data-hero-scrub]")
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    setter.call(el, el.max)
    el.dispatchEvent(new Event("input", { bubbles: true }))
    el.dispatchEvent(new Event("change", { bubbles: true }))
  })
  await page.waitForTimeout(1500)
  await read("5 playhead=end")

  writeFileSync(join(OUT, "when.json"), JSON.stringify({ steps, logs }, null, 2))
  console.log(`\nGL "not big enough" messages total: ${logs.filter((l) => l.text.includes("not big enough")).length}`)
  await context.close()
  await browser.close()
  console.log(`\n${OUT}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
