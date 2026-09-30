// WHERE the quota toast lands, and what it covers. The offset was chosen for
// the canvas action bar; the RIGHT column has a bottom bar too.
import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1500, height: 1460 }, reducedMotion: "no-preference" })
await p.goto(LAB_URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__styleHarness)
await p.evaluate(() =>
  window.__styleHarness.injectStrokes([[{ x: 200, y: 300 }, { x: 380, y: 380 }, { x: 520, y: 300 }]], {}),
)
await p.waitForTimeout(1600)
await p.evaluate(() => window.__styleHarness.fillStorage())
await p.evaluate(() => {
  const big = []
  for (let i = 0; i < 6000; i++) big.push({ x: 100 + (i % 400), y: 200 + ((i * 7) % 300) })
  window.__styleHarness.injectStrokes([big], {})
})
await p.waitForSelector('[data-sonner-toast]', { timeout: 8000 })
await p.waitForTimeout(700)

const m = await p.evaluate(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height) } }
  const toasts = [...document.querySelectorAll("[data-sonner-toast]")].map((e) => ({ text: e.innerText.slice(0, 40).replace(/\s+/g, " "), ...r(e) }))
  const bars = [...document.querySelectorAll("button")]
    .filter((e) => { const b = e.getBoundingClientRect(); return b.top > innerHeight - 260 && b.width > 2 })
    .map((e) => ({ label: (e.textContent || "").trim().slice(0, 18), ...r(e) }))
  return { innerHeight, toasts, bars }
})
console.log("viewport height:", m.innerHeight)
console.log("\nTOASTS:")
for (const t of m.toasts) console.log(`  ${JSON.stringify(t.text)}  top=${t.t} bottom=${t.b} h=${t.h}  x[${t.l}..${t.r}]`)
console.log("\nBOTTOM-AREA CONTROLS:")
for (const bb of m.bars) {
  const covered = m.toasts.some((t) => !(bb.r < t.l || bb.l > t.r || bb.b < t.t || bb.t > t.b))
  console.log(`  ${bb.label.padEnd(20)} top=${bb.t} bottom=${bb.b} x[${bb.l}..${bb.r}] ${covered ? "  <<< OVERLAPPED" : ""}`)
}
await p.evaluate(() => window.__styleHarness.dropBallast())
await b.close()
