// Read-only look at the live app on :3000: one screenshot and an inventory of every control.
import { readFileSync, writeFileSync } from "node:fs"
const ROOT = new URL("../../../../", import.meta.url).pathname
const { chromium } = await import(ROOT + "scripts/verify/lib/browser.mjs")
const OUT = new URL("./parts/", import.meta.url).pathname
const polys = JSON.parse(readFileSync(ROOT + "scripts/capture/logo-strokes.json", "utf8")).polylines
const browser = await chromium.launch({ label: "layout-mockups-probe" })
const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
await page.goto("http://localhost:3000", { waitUntil: "domcontentloaded", timeout: 180000 })
await page.waitForFunction(() => window.__styleHarness && window.__revealHarness, null, { timeout: 240000 })
await page.waitForTimeout(800)
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
await page.waitForTimeout(1500)
await page.evaluate(() => window.__revealHarness.setPlaying(false))
await page.waitForTimeout(400)
await page.screenshot({ path: OUT + "app-default.png" })
const inv = await page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const R = (e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] }
  const regions = [...document.querySelectorAll("*")].filter((e) => [...e.attributes].some((a) => a.name.startsWith("data-") && !a.name.startsWith("data-slot") && !a.name.startsWith("data-state") && !a.name.startsWith("data-orientation"))).filter(vis).map((e) => ({ tag: e.tagName, attrs: [...e.attributes].filter((a) => a.name.startsWith("data-")).map((a) => a.name + "=" + a.value.slice(0, 30)).join(" "), r: R(e) })).filter((x) => x.r[2] > 120 && x.r[3] > 30)
  const ctrls = [...document.querySelectorAll("button, input, select, [role=slider], [role=tab]")].filter(vis).map((e) => ({ t: e.tagName, type: e.type || "", label: (e.getAttribute("aria-label") || e.textContent || e.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 40), exp: e.getAttribute("aria-expanded"), pressed: e.getAttribute("aria-pressed"), r: R(e) }))
  const cs = (e) => { if (!e) return null; const s = getComputedStyle(e); return { bg: s.backgroundColor, color: s.color, font: s.fontFamily.slice(0, 40), fs: s.fontSize, fw: s.fontWeight, rad: s.borderRadius, border: s.border, shadow: s.boxShadow.slice(0, 80), pad: s.padding, h: e.getBoundingClientRect().height } }
  const btns = [...document.querySelectorAll("button")].filter(vis)
  return { body: cs(document.body), html: getComputedStyle(document.documentElement).backgroundColor, sampleButtons: btns.slice(0, 40).map((b) => ({ label: (b.getAttribute("aria-label") || b.textContent).trim().slice(0, 24), ...cs(b) })), regions, ctrls }
})
writeFileSync(OUT + "inventory-default.json", JSON.stringify(inv, null, 1))
console.log("regions", inv.regions.length, "controls", inv.ctrls.length)
await browser.close()
