// _PROBE-LANED-HALVES — IS THE RE-STAMP PART OF THE BLANK-TAIL FIX, OR A
// SEPARATE DEFECT THE LANE FOUND ON THE WAY?
//
// AUDIT INSTRUMENT (lane D, read-only on source). Explainer 24 §5 ships TWO
// halves and asserts "the defect has two halves":
//
//   1 · `dropStaleImplicitAttrs`      (lib/geometry-engines.ts:5643, called :7664)
//   2 · `ensureLetterStamp`           (components/viewport-3d.tsx:4244, called :4863)
//
// and `assert-drawin-attrs.mjs` only ever arms them TOGETHER, as one known-bad.
// A pair that is only ever tested jointly cannot say which half does what. This
// splits them — the 2×2 — and reads four channels per arm:
//
//   · attrCensus over **EVERY** mesh, not only the largest (the gate reduces to
//     the biggest index buffer, so a short attribute on any other mesh is
//     invisible to it);
//   · `letterCensus()` — how many meshes still carry `aFsLetter` and how many
//     distinct letters the cascade can see;
//   · ink at DRAW 97 %, the playhead that was blank;
//   · the driver's own verdict, counted at every console level.
//
// Each arm asserts BOTH switches read back as set before it is graded, and each
// arm RE-DRIVES the dials — the mismatch is created by a rebuild, so an arm that
// only flips a switch and re-reads would grade a surface that was never refilled.
//
// Usage: FS_PORT=3104 node scripts/verify/_probe-laned-halves.mjs
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const PORT = process.env.FS_PORT || "3000"
const OUT = join(ROOT, "docs", "verification", "lane-d-audit")

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  const logs = []
  page.on("console", (m) => logs.push({ type: m.type(), text: m.text().slice(0, 200) }))
  page.on("pageerror", (e) => logs.push({ type: "pageerror", text: String(e).slice(0, 200) }))
  const glFails = () => logs.filter((l) => l.text.includes("not big enough")).length

  await page.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => window.__captureHarness && window.__inflateProbe, null, { timeout: 120000 })
  await page.waitForTimeout(2500)

  const setWobble = (v) =>
    page.evaluate((val) => {
      for (const inp of document.querySelectorAll('input[type="range"]')) {
        const row = inp.closest("div")?.parentElement
        if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) {
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          s.call(inp, String(val))
          inp.dispatchEvent(new Event("input", { bubbles: true }))
          inp.dispatchEvent(new Event("change", { bubbles: true }))
          return true
        }
      }
      return false
    }, v)
  const setEndpoint = (n) =>
    page.evaluate((name) => {
      for (const b of document.querySelectorAll("button")) {
        if ((b.textContent ?? "").trim().toLowerCase() === name) { b.click(); return true }
      }
      return false
    }, n)

  await page.click('[data-engine-option="free-stroke"]')
  await page.waitForTimeout(4000)
  await page.click('[data-word-source="font"]')
  await page.waitForTimeout(5000)

  /* WHY THE `jointBreak` OFAT ARM COULD NOT HAVE PRODUCED EVIDENCE. The break
   * table is built from `window.__heroJunctions` — where the word touches
   * ITSELF (FlatState.jointBreak, viewport-3d.tsx:1010). If the font word has
   * no junctions the channel is inert, and an arm that turns an inert channel
   * off is a row that cannot come out any other way. */
  const junctions = await page.evaluate(() => {
    const j = window.__heroJunctions
    return Array.isArray(j) ? { count: j.length, sample: j.slice(0, 3) } : { count: null, raw: typeof j }
  })
  console.log(`__heroJunctions on the FONT word: ${JSON.stringify(junctions)}`)

  const inkAt = async (frac) => {
    const span = await page.evaluate(() =>
      JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
    )
    await page.evaluate((t) => {
      const el = document.querySelector("[data-hero-scrub]")
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, String(t))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, span.at + span.duration * frac)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(300)
    const buf = await page.locator("[data-hero-stage]").screenshot()
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

  const ARMS = [
    ["SHIPPED            drop ON  · stamp ON ", true, true],
    ["DROP ONLY          drop ON  · stamp OFF", true, false],
    ["STAMP ONLY         drop OFF · stamp ON ", false, true],
    ["KNOWN-BAD          drop OFF · stamp OFF", false, false],
  ]

  const out = []
  for (const [label, drop, stamp] of ARMS) {
    const armed = await page.evaluate(
      ([d, s]) => {
        const a = window.__captureHarness.setRefillDropsStaleAttrs(d)
        const b = window.__captureHarness.setLetterStampFollowsRefill(s)
        return {
          setterOk: a && b,
          drop: window.__captureHarness.refillDropsStaleAttrs(),
          stamp: window.__captureHarness.letterStampFollowsRefill(),
        }
      },
      [drop, stamp],
    )
    const took = armed.setterOk && armed.drop === drop && armed.stamp === stamp

    // RE-DRIVE the dials: the mismatch is only CREATED by a rebuild.
    const before = glFails()
    await setWobble(0.4); await page.waitForTimeout(4000)
    await setEndpoint("protrude"); await page.waitForTimeout(4000)
    await setWobble(0); await page.waitForTimeout(4000)
    await setEndpoint("clean"); await page.waitForTimeout(4000)

    const census = await page.evaluate(() => window.__inflateProbe.attrCensus(-1))
    const letters = await page.evaluate(() => window.__inflateProbe.letterCensus())
    const ink97 = await inkAt(0.97)
    const gl = glFails() - before
    const shortMeshes = census.filter((c) => c.short.length > 0)
    const big = census.reduce((a, b) => (b.indexCount > (a?.indexCount ?? -1) ? b : a), null)

    out.push({ label, drop, stamp, took, armed, big, meshes: census.length, shortMeshes, letters, ink97, gl })
    console.log(
      `\n${label}\n` +
        `   arm TOOK ${took}  (drop ${armed.drop} · stamp ${armed.stamp})\n` +
        `   meshes ${census.length} · largest: position ${big?.attrs.position} · aFsLetter ${big?.attrs.aFsLetter ?? "(absent)"} · short ${JSON.stringify(big?.short)}\n` +
        `   meshes with ANY short attribute: ${shortMeshes.length}\n` +
        `   letterCensus: meshes ${letters.meshes} · withAttr ${letters.withAttr} · distinct letters ${letters.letters.length} [${letters.letters.slice(0, 12).join(",")}] · spanning tris ${letters.spanning}\n` +
        `   ink at DRAW 97 %: ${ink97} px · rejected draws this arm: ${gl}`,
    )
  }

  await page.evaluate(() => {
    window.__captureHarness.setRefillDropsStaleAttrs(true)
    window.__captureHarness.setLetterStampFollowsRefill(true)
  })
  writeFileSync(join(OUT, "halves.json"), JSON.stringify({ arms: out, logs: logs.slice(-30) }, null, 2))
  console.log(`\n${join(OUT, "halves.json")}`)
  await context.close()
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
