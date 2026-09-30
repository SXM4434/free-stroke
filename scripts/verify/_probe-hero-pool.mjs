// Debug: does orbitView move the view, and does the contact pool render at all?
import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 1440, height: 1440 } })
const p = await c.newPage()
p.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 160)) })
p.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)))
await p.goto(HERO_URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })
await p.waitForTimeout(2500)
await p.evaluate(() => {
  const el = document.querySelector("[data-hero-scrub]")
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
  set.call(el, "3.0")
  el.dispatchEvent(new Event("input", { bubbles: true }))
})
await p.waitForTimeout(600)
const camAt = () =>
  p.evaluate(() => {
    const h = window.__captureHarness
    return { ok: h.orbitView ? true : false }
  })
console.log(await camAt())
const OUT = "/private/tmp/claude-501/-Users-sebs/a04ad079-bdad-4022-8b1e-fdacd06d013f/scratchpad"
const stage = p.locator("[data-hero-stage]")
await p.evaluate(() => window.__captureHarness.setFlatten({ ink: 0, depth: 1, shadow: 1 }))
await p.waitForTimeout(400)
await stage.screenshot({ path: `${OUT}/pool-el0-shadow1.png` })
console.log("el0 shadow1 done, orbitView ->", await p.evaluate(() => window.__captureHarness.orbitView(0, 35, 1)))
await p.waitForTimeout(500)
await stage.screenshot({ path: `${OUT}/pool-el35-shadow1.png` })
await p.evaluate(() => window.__captureHarness.setFlatten({ ink: 0, depth: 1, shadow: 0 }))
await p.waitForTimeout(400)
await stage.screenshot({ path: `${OUT}/pool-el35-shadow0.png` })
console.log("done")
await b.close()
