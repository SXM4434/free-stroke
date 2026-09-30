import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"
const FORCE = process.argv.find((a) => a.startsWith("--projection="))?.split("=")[1] ?? null
const b = await chromium.launch()
const c = await b.newContext({ viewport: { width: 1440, height: 1440 } })
const p = await c.newPage()
const errs = []
p.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errs.push(m.text().slice(0, 200)) })
p.on("pageerror", (e) => errs.push("pageerror: " + String(e).slice(0, 200)))
if (FORCE) await p.addInitScript((v) => { window.__viewport3dProjection = v }, FORCE)
await p.goto(HERO_URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 90000 })
await p.waitForTimeout(3000)
const info = await p.evaluate(() => {
  const h = window.__captureHarness
  const el = document.querySelector("[data-hero-stage]")
  const r = el?.getBoundingClientRect()
  return {
    projection: h.projection?.() ?? "no accessor",
    bounds: h.bounds(),
    stage: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
    total: document.querySelector("[data-hero-scrub]")?.max,
  }
})
console.log(JSON.stringify(info, null, 2))
await p.locator("[data-hero-stage]").screenshot({ path: `/private/tmp/claude-501/-Users-sebs/a04ad079-bdad-4022-8b1e-fdacd06d013f/scratchpad/smoke-${FORCE ?? "default"}.png` })
console.log("errors:", errs.length, errs.slice(0, 5))
await b.close()
