// Where does a scene-side throw actually LAND? The boundary did not catch it,
// so the question is whether the throw happened at all, and if it did, who saw
// it. This decides whether the law is wrong or the boundary is.
import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1400, height: 1200 }, reducedMotion: "no-preference" })
const pageErrors = []
const consoleErrs = []
p.on("pageerror", (e) => pageErrors.push(String(e).slice(0, 200)))
p.on("console", (m) => { if (m.type() === "error") consoleErrs.push(m.text().slice(0, 200)) })
await p.goto(LAB_URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__styleHarness)
await p.evaluate(() =>
  window.__styleHarness.injectStrokes([[{ x: 200, y: 300 }, { x: 380, y: 380 }, { x: 520, y: 300 }]], {}),
)
await p.waitForTimeout(1600)

console.log("before: pageErrors", pageErrors.length, "consoleErrs", consoleErrs.length)
await p.evaluate(() => window.__styleHarness.crashViewport(true))
await p.waitForTimeout(2000)

console.log("\nafter firing crashViewport(true):")
console.log("  pageErrors:", pageErrors.length)
for (const e of pageErrors) console.log("   !", e)
console.log("  consoleErrs:", consoleErrs.length)
for (const e of consoleErrs.slice(0, 8)) console.log("   ·", e)

const state = await p.evaluate(() => ({
  boundary: !![...document.querySelectorAll("p")].find((e) => e.textContent.includes("The 3D view stopped")),
  canvases: document.querySelectorAll("canvas").length,
  bodyText: document.body.innerText.slice(0, 200).replace(/\s+/g, " "),
  stack: window.__fsCrashReaderStack || null,
}))
console.log("\nDOM state: boundary=%s canvases=%s", state.boundary, state.canvases)
console.log("body:", state.bodyText)
console.log("\nWHO READ THE POISONED STROKE:")
console.log(state.stack ? state.stack.split("\n").slice(0, 14).join("\n") : "  (never read)")
await b.close()
