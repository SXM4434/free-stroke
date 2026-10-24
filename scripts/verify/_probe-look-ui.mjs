// What does the product route actually show? Screenshot / as a visitor lands on it,
// and list every panel, tab and button label, so the controller can see what
// Sebs sees. 2026-09-24, after "there's like no animation panel whatsoever".
// Usage: FS_PORT=3105 FS_HEADED=1 node scripts/verify/_probe-look-ui.mjs <outdir>
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { mkdirSync } from "node:fs"
import { join } from "node:path"

const OUT = process.argv[2]
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1512, height: 982 } })
const errs = []
page.on("pageerror", (e) => errs.push(String(e)))
try {
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded" })
  await page.waitForTimeout(9000)
  await page.screenshot({ path: join(OUT, "1-landing.png") })
  const labels = await page.evaluate(() =>
    [...document.querySelectorAll("button, [role=tab], summary, h2, h3, label")]
      .filter((e) => e.offsetParent !== null)
      .map((e) => (e.getAttribute("aria-label") || e.innerText || "").trim().replace(/\s+/g, " "))
      .filter(Boolean),
  )
  console.log("VISIBLE LABELS:", JSON.stringify([...new Set(labels)]))
  const info = await page.evaluate(() => ({
    url: location.href,
    timeline: !!document.querySelector("[data-take-timeline]"),
  }))
  console.log("INFO:", JSON.stringify(info))
  // draw a word-ish scribble on the left canvas, like a visitor would
  const box = { x: 120, y: 650, w: 480, h: 180 }
  for (let s = 0; s < 4; s++) {
    await page.mouse.move(box.x + s * 110, box.y + 40)
    await page.mouse.down()
    for (let k = 0; k <= 24; k++) {
      const t = k / 24
      await page.mouse.move(box.x + s * 110 + t * 80, box.y + 40 + Math.sin(t * 6.28 + s) * 50, { steps: 2 })
    }
    await page.mouse.up()
  }
  await page.waitForTimeout(4000)
  await page.screenshot({ path: join(OUT, "3-drawn.png") })
  const after = await page.evaluate(() =>
    [...document.querySelectorAll("button, [role=tab], summary, label")]
      .filter((e) => e.offsetParent !== null)
      .map((e) => (e.getAttribute("aria-label") || e.innerText || "").trim().replace(/\s+/g, " "))
      .filter(Boolean),
  )
  console.log("AFTER DRAW LABELS:", JSON.stringify([...new Set(after)]))
  for (const name of ["Draw-in timing", "Timing", "Play"]) {
    const b = page.getByRole("button", { name: new RegExp(name, "i") }).first()
    if (await b.count()) {
      await b.click().catch(() => {})
      await page.waitForTimeout(1500)
      await page.screenshot({ path: join(OUT, `4-${name.replace(/\W+/g, "-").toLowerCase()}.png`) })
      console.log(`clicked ${name}`)
    } else console.log(`no button named ${name}`)
  }
  for (const name of []) {
    const b = page.getByRole("button", { name: new RegExp(`^${name}`, "i") }).first()
    if (await b.count()) {
      await b.click().catch(() => {})
      await page.waitForTimeout(800)
      await page.screenshot({ path: join(OUT, `2-${name.toLowerCase()}.png`) })
      console.log(`clicked ${name}`)
    } else console.log(`no button named ${name}`)
  }
} finally {
  console.log("page errors:", errs.length)
  await browser.close()
}
