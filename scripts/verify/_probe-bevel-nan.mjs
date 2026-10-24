// Does a non-finite Bevel Segments value crash the extrude builder?
//
// The audit lane found `ribbonProfileRows` returning [] for NaN (the caller then
// dereferences it) and looping forever for +Infinity. Both are reachable from
// `window.__styleHarness.setExtrude`. This drives that real channel.
//
// Usage: node scripts/verify/_probe-bevel-nan.mjs [--prior]
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
const PRIOR = process.argv.includes("--prior")
const URL = LAB_URL
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1600 } })
const errors = []
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)))
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)) })
await page.goto(URL, { waitUntil: "networkidle" })
await page.waitForFunction(() => window.__styleHarness && window.__geomDebug, null, { timeout: 60000 })
const renderer = await page.evaluate(() => {
  const c = document.createElement("canvas"); const gl = c.getContext("webgl2")
  const d = gl && gl.getExtension("WEBGL_debug_renderer_info")
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown"
})
console.log("renderer:", renderer)
if (!/Metal|Apple/i.test(renderer)) { console.log("REFUSING — not the real GPU"); await browser.close(); process.exit(2) }
await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12 }),
  [Array.from({ length: 26 }, (_, i) => ({ x: 120 + i * 18, y: 300 + Math.sin(i / 3) * 60 }))])
await page.waitForTimeout(1200)
await page.evaluate(() => window.__styleHarness.setMode && window.__styleHarness.setMode("extrude"))
await page.waitForTimeout(800)
const VALUES = [3, 0, -5, NaN, Infinity]
for (const v of VALUES) {
  const before = errors.length
  const t0 = Date.now()
  const r = await page.evaluate(async ([val, prior]) => {
    const n = prior ? val : val
    try { window.__styleHarness.setExtrude({ bevelSize: 0.02, bevelSegments: n }) } catch (e) { return { threw: String(e).slice(0, 120) } }
    await new Promise((res) => setTimeout(res, 700))
    return { builds: window.__geomDebug.buildCount(), bytes: window.__geomDebug.exportBytes() }
  }, [Number.isFinite(v) ? v : (v === Infinity ? 1e999 : NaN), PRIOR]).catch((e) => ({ died: String(e).slice(0, 120) }))
  const ms = Date.now() - t0
  const newErr = errors.slice(before)
  console.log(
    String(v).padEnd(10),
    `${ms}ms`.padEnd(8),
    r.died ? `PAGE DIED: ${r.died}` : r.threw ? `THREW: ${r.threw}` : `builds=${r.builds} exportBytes=${r.bytes}`,
    newErr.length ? `| ${newErr.length} console error(s): ${newErr[0]}` : "| clean",
  )
}
await browser.close()
console.log(errors.length === 0 ? "\nNO PAGE ERRORS" : `\n${errors.length} PAGE ERROR(S)`)
