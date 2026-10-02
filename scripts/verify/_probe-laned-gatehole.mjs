// _PROBE-LANED-GATEHOLE — DOES `assert-drawin-attrs.mjs` STAY GREEN WITH HALF
// THE FIX REMOVED?
//
// AUDIT INSTRUMENT (lane D, read-only on source). It edits nothing and asserts
// nothing about the product. Its subject is THE GATE.
//
// §2.6 of this repo: *"a green row that cannot fail is the lie."* The gate arms
// its two parked priors ONLY as a pair, so nothing has ever asked what it reads
// when exactly one of them is off. This arms one at a time, drives the SAME dial
// walk the gate drives, and then evaluates the gate's own seven shipped-arm
// predicates **verbatim** against the readings — not a re-implementation of the
// gate, an evaluation of its predicates on measured data.
//
// The predicates, copied from assert-drawin-attrs.mjs:
//   :194  moved >= 3
//   :200  anyShort.length === 0
//   :207  final.attrs.position === (final.attrs.aFsLetter ?? final.attrs.position)
//   :216  glFails() === 0
//   :226  inkMid > 1000
//   :228  inkTail >= inkMid
//   :232  inkEnd >= inkTail
//
// Usage: FS_PORT=3104 node scripts/verify/_probe-laned-gatehole.mjs
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

/** One full run of the gate's SHIPPED arm, with the two priors pre-armed. */
async function runArm(label, drop, stamp) {
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

  /* ARM BEFORE THE WALK. The gate arms its priors only at its known-bad step, so
   * its own walk always runs with both ON. This is the state nobody has read. */
  const armed = await page.evaluate(
    ([d, s]) => {
      const a = window.__captureHarness.setRefillDropsStaleAttrs(d)
      const b = window.__captureHarness.setLetterStampFollowsRefill(s)
      return {
        ok: a && b,
        drop: window.__captureHarness.refillDropsStaleAttrs(),
        stamp: window.__captureHarness.letterStampFollowsRefill(),
      }
    },
    [drop, stamp],
  )

  const census = () =>
    page.evaluate(() => {
      const c = window.__inflateProbe.attrCensus(-1)
      return c.reduce((a, b) => (b.indexCount > (a?.indexCount ?? -1) ? b : a), null)
    })
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
    await page.waitForTimeout(250)
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

  // ---- the gate's dial walk, same order, same waits ----
  const walk = []
  walk.push({ label: "0 load", ...(await census()) })
  await page.click('[data-engine-option="free-stroke"]'); await page.waitForTimeout(4000)
  walk.push({ label: "1 engine", ...(await census()) })
  await page.click('[data-word-source="font"]'); await page.waitForTimeout(5000)
  walk.push({ label: "2 word", ...(await census()) })
  await page.evaluate(() => {
    for (const inp of document.querySelectorAll('input[type="range"]')) {
      const row = inp.closest("div")?.parentElement
      if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) {
        const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
        s.call(inp, "0")
        inp.dispatchEvent(new Event("input", { bubbles: true }))
        inp.dispatchEvent(new Event("change", { bubbles: true }))
        return
      }
    }
  })
  await page.waitForTimeout(4000)
  walk.push({ label: "3 wobble=0", ...(await census()) })
  await page.evaluate(() => {
    for (const b of document.querySelectorAll("button")) {
      if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); return }
    }
  })
  await page.waitForTimeout(4000)
  const final = { label: "4 endpoint=clean", ...(await census()) }
  walk.push(final)

  const inkMid = await inkAt(0.93)
  const inkTail = await inkAt(0.97)
  const inkEnd = await inkAt(1.0)
  const letters = await page.evaluate(() => window.__inflateProbe.letterCensus())

  // ---- the gate's seven shipped-arm predicates, verbatim ----
  const counts = walk.map((w) => w.attrs.position)
  const moved = new Set(counts).size
  const anyShort = walk.filter((w) => w.short.length > 0)
  const P = [
    [":194 non-vacuity — moved >= 3", moved >= 3, `${moved} distinct: ${counts.join(" -> ")}`],
    [":200 no step is short", anyShort.length === 0, `${anyShort.length} short step(s)`],
    [
      ":207 position === (aFsLetter ?? position)",
      final.attrs.position === (final.attrs.aFsLetter ?? final.attrs.position),
      `position ${final.attrs.position} · aFsLetter ${final.attrs.aFsLetter ?? "(ABSENT)"}`,
    ],
    [":216 glFails === 0", glFails() === 0, `${glFails()}`],
    [":226 inkMid > 1000", inkMid > 1000, `${inkMid} px`],
    [":228 inkTail >= inkMid", inkTail >= inkMid, `${inkMid} -> ${inkTail}`],
    [":232 inkEnd >= inkTail", inkEnd >= inkTail, `${inkEnd}`],
  ]
  const allGreen = P.every(([, ok]) => ok)
  console.log(`\n═══ ${label}  (drop ${armed.drop} · stamp ${armed.stamp}, setters ok ${armed.ok}) ═══`)
  for (const [name, ok, detail] of P) console.log(`  ${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`)
  console.log(`  letterCensus: withAttr ${letters.withAttr} · distinct letters ${letters.letters.length} · spanning tris ${letters.spanning}`)
  console.log(`  >>> the gate's SHIPPED arm would read: ${allGreen ? "ALL PASS" : "FAILURES"}`)

  await context.close()
  await browser.close()
  return { label, armed, walk, final, inkMid, inkTail, inkEnd, letters, predicates: P, allGreen }
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const out = []
  out.push(await runArm("MUTANT A — `ensureLetterStamp` DISABLED (drop ON · stamp OFF)", true, false))
  out.push(await runArm("MUTANT B — `dropStaleImplicitAttrs` DISABLED (drop OFF · stamp ON)", false, true))
  writeFileSync(join(OUT, "gatehole.json"), JSON.stringify(out, null, 2))
  console.log(`\n${join(OUT, "gatehole.json")}`)
  const survived = out.filter((o) => o.allGreen)
  console.log(
    `\n${survived.length} of ${out.length} single-half mutants leave the gate's shipped arm ALL PASS.`,
  )
}
main().catch((e) => { console.error(e); process.exit(1) })
