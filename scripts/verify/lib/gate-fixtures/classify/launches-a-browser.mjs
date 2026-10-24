// WANTED: BROWSER.
// The accept half of the pair — an analyser that has never accepted anything is
// as useless as one that has never rejected anything.
import { chromium } from "playwright-core"

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--use-angle=metal"] })
const page = await browser.newPage()
await page.close()
await browser.close()
console.log("PASS  a real launch")
process.exit(0)
