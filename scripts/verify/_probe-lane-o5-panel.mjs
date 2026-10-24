// THE PANEL, READ OFF THE REAL PAGE — copy and controls, not a claim about them.
import { chromium } from "./lib/browser.mjs"
import { PORT } from "./lib/dev-server.mjs"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 1440 } })).newPage()
const errs = []
p.on("pageerror", (e) => errs.push(String(e).slice(0, 300)))
await p.goto(`http://localhost:${PORT}/desk-doodles`, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__captureHarness, null, { timeout: 90000 })
await p.waitForTimeout(5000)
await p.locator('[data-read-film="letterByLetter"]').click()
await p.waitForTimeout(1500)
console.log("film readout :", await p.locator("[data-hero-film]").getAttribute("data-hero-film"))
const copy = await p.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find((d) => /flips as/.test(d.textContent || "") && (d.textContent || "").length < 400)
  return el ? el.textContent.replace(/\s+/g, " ").trim() : "NOT FOUND"
})
console.log("panel copy   :", copy)
const dials = await p.evaluate(() => {
  const out = []
  for (const r of document.querySelectorAll("input[type=range]")) {
    const box = r.closest("div")
    const t = (box?.textContent || "").replace(/\s+/g, " ").trim()
    if (/Ends turned|First letter|Beat|Doubling|Edge held|Fused when/.test(t)) out.push(t)
  }
  return out
})
console.log("cascade dials:", dials.length)
dials.forEach((d) => console.log("   ·", d.slice(0, 60)))
console.log("letters-from :", await p.locator("[data-letter-from]").count(), "pills, active =",
  await p.evaluate(() => [...document.querySelectorAll("[data-letter-from]")].find((e) => e.getAttribute("aria-pressed") === "true")?.getAttribute("data-letter-from") ?? "?"))
console.log("pageerrors   :", errs.length, errs.slice(0, 3))
await b.close()
