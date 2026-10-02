// Read-only: open each style family, then Keyframes and Draw-in, and record every control the app shows.
import { readFileSync, writeFileSync } from "node:fs"
const ROOT = new URL("../../../../", import.meta.url).pathname
const { chromium } = await import(ROOT + "scripts/verify/lib/browser.mjs")
const OUT = new URL("./parts/", import.meta.url).pathname
const raw = JSON.parse(readFileSync(ROOT + "scripts/capture/logo-strokes.json", "utf8")).polylines
const K = 0.48, OX = 378 - K * 548, OY = 400 - K * 120
export const logo = raw.map((l) => l.map((q) => ({ ...q, x: OX + q.x * K, y: OY + q.y * K })))
const browser = await chromium.launch({ label: "layout-mockups-inventory" })
const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 180000 })
await page.waitForFunction(() => window.__styleHarness && window.__revealHarness, null, { timeout: 240000 })
await page.waitForTimeout(800)
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 8, gapMs: 40 }), logo)
await page.waitForTimeout(1500)
await page.evaluate(() => window.__revealHarness.setPlaying(false))
const visCtrls = () => page.evaluate(() => [...document.querySelectorAll("button, input, select, [role=slider], [role=tab], [role=switch]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }).map((e) => { const r = e.getBoundingClientRect(); return { t: e.tagName + (e.type ? ":" + e.type : ""), label: (e.getAttribute("aria-label") || e.textContent || e.getAttribute("title") || e.value || "").trim().replace(/\s+/g, " ").slice(0, 36), r: [r.left, r.top, r.width, r.height].map(Math.round) } }))
const key = (c) => c.t + c.label + c.r[0]
const base = await visCtrls(), baseKeys = new Set(base.map(key))
const fams = ["Material", "Texture", "Dither", "ASCII", "Animation", "Layers", "Fusion", "Preset"]
const families = {}
for (const f of fams) {
  const b = page.locator("button", { hasText: new RegExp("^" + f) }).first()
  await b.click(); await page.waitForTimeout(500)
  const now = await visCtrls()
  const added = now.filter((c) => !baseKeys.has(key(c)))
  const box = added.reduce((a, c) => [Math.min(a[0], c.r[0]), Math.min(a[1], c.r[1]), Math.max(a[2], c.r[0] + c.r[2]), Math.max(a[3], c.r[1] + c.r[3])], [1e9, 1e9, -1e9, -1e9])
  families[f] = { box, controls: added.map((c) => c.t.replace("BUTTON:", "") + " " + c.label) }
  if (f === "Preset") {
    await page.screenshot({ path: OUT + "app-preset-open.png" })
    const canvases = await page.evaluate(() => [...document.querySelectorAll("canvas")].map((c) => { const r = c.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map(Math.round) }))
    families[f].canvasesWhenOpen = canvases
  }
  await b.click(); await page.waitForTimeout(400)
}
await page.locator("button", { hasText: /^Keyframes/ }).first().click(); await page.waitForTimeout(500)
await page.evaluate(() => { const t = document.querySelector("[data-animation-drawin]"); if (t && t.getAttribute("aria-expanded") !== "true") t.click() })
await page.waitForTimeout(600)
await page.screenshot({ path: OUT + "app-dock-open.png" })
await page.locator("[data-animation-panel]").screenshot({ path: OUT + "real-dock-open.png" })
const dock = await page.evaluate(() => {
  const p = document.querySelector("[data-animation-panel]"); const pr = p.getBoundingClientRect()
  const all = [...p.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 })
  const ctr = all.filter((e) => e.matches("button, input, select, [role=slider]")).map((e) => { const r = e.getBoundingClientRect(); return (e.tagName === "INPUT" ? "range/" + e.type : "") + " " + (e.getAttribute("aria-label") || e.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) + " @" + [r.left - pr.left, r.top - pr.top, r.width, r.height].map(Math.round).join(",") })
  const lanes = document.querySelector("[data-key-lanes-root]")
  const small = lanes ? [...lanes.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 2 && r.width <= 16 && r.height <= 16 && r.height > 2 }).map((e) => { const r = e.getBoundingClientRect(); return e.tagName + " " + [...e.attributes].map((a) => a.name + "=" + a.value.slice(0, 20)).join(" ").slice(0, 90) + " @" + [r.left, r.top, r.width, r.height].map(Math.round).join(",") }) : []
  const texts = lanes ? [...lanes.querySelectorAll("*")].filter((e) => e.children.length === 0 && e.textContent.trim()).map((e) => { const r = e.getBoundingClientRect(); return e.textContent.trim().slice(0, 30) + " @" + [r.left, r.top, r.width, r.height].map(Math.round).join(",") }) : []
  return { panel: [pr.left, pr.top, pr.width, pr.height].map(Math.round), controls: ctr, keyish: small.slice(0, 60), laneTexts: texts.slice(0, 80) }
})
writeFileSync(OUT + "inventory-open.json", JSON.stringify({ families, dock }, null, 1))
console.log(JSON.stringify(families, null, 0).slice(0, 6000))
console.log("DOCK", dock.panel, "\n" + dock.controls.join("\n"))
console.log("KEYISH", dock.keyish.length, "\n" + dock.keyish.slice(0, 25).join("\n"))
console.log("LANETEXT\n" + dock.laneTexts.join("\n"))
await browser.close()
