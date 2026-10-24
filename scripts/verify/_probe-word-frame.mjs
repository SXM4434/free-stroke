// _PROBE-WORD-FRAME — does the camera actually re-fit when the word changes?
//
// The ladder's `fixed` arm came back with "Desk Doodles" cropped to "Desk" and
// a two-line block rendered as an empty grid. Both are framing pictures, not
// geometry ones, so this reads the bounds the viewport publishes and the camera
// it parks — before and after a re-issued `orbitView` — for each rung.
import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"

const LADDER = ["ok", "Desk Doodles", "Hello world", "Sebastian Mendez", "the quick brown fox jumps"]

async function main() {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1600, height: 1600 } })).newPage()
  page.on("pageerror", (e) => console.log("PAGEERROR", String(e).slice(0, 200)))
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__revealHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)
  await page.click(`[data-word-source="font"]`)
  await page.waitForTimeout(1000)

  const span = await page.evaluate(() =>
    JSON.parse(document.querySelector("[data-hero-draw-span]").getAttribute("data-hero-draw-span")),
  )
  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(250)
  }
  await seek(span.at + span.duration * 0.999)

  for (const text of LADDER) {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-word-input]")
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      setter.call(el, tt)
      el.dispatchEvent(new Event("input", { bubbles: true }))
    }, text)
    await page.waitForTimeout(1200)

    const before = await page.evaluate(() => {
      const b = window.__captureHarness.bounds()
      return b ? { r: b.radius, c: [b.center.x, b.center.y, b.center.z] } : null
    })
    // Re-issue framing explicitly and see whether the picture would change.
    const after = await page.evaluate(() => {
      window.__captureHarness.frontView(1.0)
      const b = window.__captureHarness.bounds()
      return b ? { r: b.radius, c: [b.center.x, b.center.y, b.center.z] } : null
    })
    const metrics = await page.evaluate(() =>
      JSON.parse(document.querySelector("[data-word-metrics]")?.getAttribute("data-word-metrics") ?? "null"),
    )
    console.log(
      `${JSON.stringify(text).padEnd(30)} lines ${metrics?.lineCount}  w ${metrics?.widthPx?.toFixed(0)}  ` +
        `bounds r ${before ? before.r.toFixed(4) : "null"} centre ${before ? before.c.map((v) => v.toFixed(3)).join(",") : "-"}  ` +
        `| after refit r ${after ? after.r.toFixed(4) : "null"}`,
    )
  }
  await browser.close()
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
