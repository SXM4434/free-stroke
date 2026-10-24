// Not a fixture with a verdict — the spawn target for `spawns-a-browser-child`.
import { chromium } from "playwright-core"
const b = await chromium.launch({ channel: "chrome", headless: true })
await b.close()
console.log("PASS  child launched")
