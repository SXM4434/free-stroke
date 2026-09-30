// WANTED: BROWSER.
//
// Prose must never SUBTRACT. This file explains chromium.launch / playwright /
// puppeteer at length in a comment AND then actually launches one. A classifier
// that scored "mentions in prose" as evidence of anything would have to decide
// which mention wins; the parsed one does not have the question — the call is
// the evidence and the comment is not evidence of any kind.
import { chromium } from "playwright-core"
const MUTANT = `puppeteer.launch()`
const browser = await chromium.launch({ channel: "chrome", headless: true })
await browser.close()
console.log(`PASS  ${MUTANT.length}`)
process.exit(0)
