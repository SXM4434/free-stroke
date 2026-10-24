// HEADED live driver — opens a real visible Chrome window and leaves it open.
//
// The headless capture scripts answer "did the pixels change". They cannot
// answer "is this strong enough to be worth having", which needs a real window
// you can watch in motion. This script opens the app headed, injects a test
// stroke, applies a style state, and then STAYS OPEN so the effect can be
// watched running rather than sampled.
//
// Usage:
//   node scripts/verify/verify-live.mjs                       # open + hold
//   node scripts/verify/verify-live.mjs --mode=solid
//   node scripts/verify/verify-live.mjs --style='{"textureEnabled":true,...}'
//   node scripts/verify/verify-live.mjs --hold=600            # seconds to stay open
//   node scripts/verify/verify-live.mjs --shot=name           # also save a still
//
// Frames captured here come from the SAME window you are watching, so a
// screenshot and the live impression cannot disagree.
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "..", "docs", "verification", "live")

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const MODE = arg("mode", "solid")
const HOLD = parseFloat(arg("hold", "900"))
const SHOT = arg("shot", "")
const STYLE = arg("style", "")

function testStroke() {
  const pts = []
  for (let i = 0; i <= 130; i++) {
    const t = i / 130
    pts.push({
      x: 110 + t * 660,
      y: 330 + Math.sin(t * Math.PI * 2.2) * 135 + Math.sin(t * Math.PI * 6) * 20,
    })
  }
  return [pts]
}

async function main() {
  mkdirSync(OUT, { recursive: true })

  // HEADED. Metal-backed GL on macOS, real compositor, real timing.
  const browser = await chromium.launch({ headed: true, args: ["--window-size=1500,1000"] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } })
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) console.log("[page-error]", m.text().slice(0, 200))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.bringToFront()
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 30000 })

  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1200)
  await page.evaluate((m) => window.__styleHarness.setMode(m), MODE)
  await page.waitForTimeout(900)

  if (STYLE) {
    await page.evaluate((s) => window.__styleHarness.setStyle(JSON.parse(s)), STYLE)
    await page.waitForTimeout(500)
  }

  if (SHOT) {
    await page.evaluate(() => window.__captureHarness.enable())
    await page.waitForTimeout(600)
    await page.evaluate(() => window.__captureHarness.frontView(1))
    await page.waitForTimeout(400)
    const u = await page.evaluate(() => window.__captureHarness.grab())
    writeFileSync(join(OUT, `${SHOT}.png`), Buffer.from(u.match(/base64,(.+)/)[1], "base64"))
    console.log(`[live] saved ${join(OUT, SHOT)}.png`)
  }

  console.log(`[live] window open on mode=${MODE}. Holding ${HOLD}s — watch it, then Ctrl-C.`)
  await page.waitForTimeout(HOLD * 1000)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
