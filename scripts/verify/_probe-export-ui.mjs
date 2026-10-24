// EYE PASS on the export cluster: the panel, the toast, and the empty state.
// Frames only — `assert-still-export.mjs` is what judges.
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
// DISPATCH §3 — one knob, one name. `FS_URL` was a FOURTH name for the knob that
// lib/dev-server.mjs had never heard of, so it was neither honoured nor thrown on.
// It now throws, and this probe reads the resolver instead. Explainer 27 §1.
import { LAB_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "still-export")
const URL_ = LAB_URL

const WORD = [
  [
    { x: 200, y: 320 }, { x: 260, y: 200 }, { x: 330, y: 320 },
    { x: 400, y: 200 }, { x: 470, y: 320 },
  ],
  [
    { x: 220, y: 400 }, { x: 320, y: 370 }, { x: 420, y: 400 }, { x: 500, y: 360 },
  ],
]

const wait = (page, ms) => page.evaluate((m) => new Promise((r) => setTimeout(r, m)), ms)

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 1440 },
    acceptDownloads: true,
  })
  const page = await ctx.newPage()
  await page.goto(URL_, { waitUntil: "networkidle" })
  await page.waitForFunction(() => !!window.__styleHarness, { timeout: 30000 })
  await wait(page, 900)

  writeFileSync(join(OUT, "ui-empty-full.png"), await page.screenshot())

  await page.evaluate((w) => window.__styleHarness.injectStrokes(w), WORD)
  await wait(page, 1400)

  await page.getByRole("button", { name: "PNG export settings" }).click()
  await wait(page, 350)
  writeFileSync(
    join(OUT, "ui-png-panel.png"),
    await page.screenshot({ clip: { x: 880, y: 1050, width: 560, height: 390 } }),
  )

  // Close it the way a user would, then export and catch the toast.
  await page.keyboard.press("Escape")
  await wait(page, 250)
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 60000 }),
    page.getByRole("button", { name: "PNG", exact: true }).click(),
  ])
  await dl.path()
  await wait(page, 700)
  writeFileSync(join(OUT, "ui-toast-success.png"), await page.screenshot())

  // …and JOB 4's actual failure path: strokes exist, so the button is live, but
  // the engine builds NO MESH from them. A zero-length stroke does exactly that.
  // This is the `if (!result) return` that used to be a silent no-op.
  await page.evaluate(() => {
    window.__styleHarness.injectStrokes([[{ x: 300, y: 300 }, { x: 300, y: 300 }]])
  })
  await wait(page, 1500)
  await page.getByRole("button", { name: "GLB", exact: true }).click()
  await wait(page, 1200)
  writeFileSync(join(OUT, "ui-toast-error.png"), await page.screenshot())

  await browser.close()
  console.log("frames:", OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
