// WHICH element is forcing the body wider than the viewport at 390px.
import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "no-preference" })
await p.goto(LAB_URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__styleHarness)
await p.waitForTimeout(1200)
const out = await p.evaluate(() => {
  const W = document.documentElement.clientWidth
  const rows = []
  for (const el of document.querySelectorAll("*")) {
    const r = el.getBoundingClientRect()
    if (r.right > W + 1 || r.width > W + 1) {
      rows.push({
        tag: el.tagName.toLowerCase(),
        cls: String(el.className || "").slice(0, 72),
        w: Math.round(r.width),
        right: Math.round(r.right),
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX,
        txt: (el.textContent || "").trim().slice(0, 24).replace(/\s+/g, " "),
      })
    }
  }
  return { W, scrollW: document.documentElement.scrollWidth, rows: rows.slice(0, 14) }
})
console.log(`clientWidth ${out.W} · scrollWidth ${out.scrollW}\n`)
for (const r of out.rows)
  console.log(
    `${r.tag.padEnd(7)} w=${String(r.w).padEnd(5)} right=${String(r.right).padEnd(5)} sw=${String(r.scrollW).padEnd(5)} ovx=${r.overflowX.padEnd(8)} ${JSON.stringify(r.txt)}\n         ${r.cls}`,
  )
await b.close()
