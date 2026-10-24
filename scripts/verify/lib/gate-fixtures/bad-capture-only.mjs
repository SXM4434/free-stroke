// FIXTURE — `assert-joint-beading`'s disease. Must be judged FAIL / no-verdict.
//
// It is named `assert-`, it drives the app, it prints real numbers, and it never
// says whether any of them is acceptable. It exits 0 in every sweep.
import { chromium } from "playwright-core"

async function capture() {
  const browser = await chromium.launch({ channel: "chrome", headless: false })
  const page = await browser.newPage()
  const stats = await page.evaluate(() => ({ joints: 7, caps: 2 }))
  console.log(`[fixture] joints=${stats.joints}  caps=${stats.caps}`)
  await browser.close()
}

capture().catch((e) => {
  console.error(e)
  process.exit(1)
})
