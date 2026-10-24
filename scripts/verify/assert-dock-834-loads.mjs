#!/usr/bin/env node
// Eighteen fresh 834x1112 loads after the six recorded in FS-DOCK-SHELL-834.
// FS_PORT=3138 FS_HEADED=0 BROWSER_CDP=<leased CDP> node scripts/verify/assert-dock-834-loads.mjs

import { writeFileSync } from "node:fs"
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"

const browser = await chromium.launch()
const rows = []
const box = (page) => page.evaluate(() => [...document.querySelectorAll("canvas")].map((canvas) => {
  const rect = canvas.getBoundingClientRect()
  return {
    panel: canvas.closest("[data-dock-panel]")?.getAttribute("data-dock-panel") ?? "none",
    css: `${rect.width}x${rect.height}`,
    buffer: `${canvas.width}x${canvas.height}`,
  }
}).filter((item) => item.css !== "0x0"))

try {
  for (let i = 1; i <= 18; i++) {
    const context = await browser.newContext({ viewport: { width: 834, height: 1112 }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    try {
      await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
      await page.waitForFunction(() => window.__dockHarness?.workspace?.today && window.__captureHarness, null, { timeout: 180000 })
      await page.waitForTimeout(350)
      const initial = await box(page)
      await page.evaluate(() => window.__dockHarness.workspace.today())
      await page.waitForTimeout(350)
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const settled = await box(page)
      const sizes = settled.map((item) => item.css)
      const ok = sizes.includes("786x532") && sizes.includes("786x531.5") && errors.length === 0
      if (!ok || initial.some((item) => item.css.includes("x361"))) {
        await page.screenshot({ path: `/Users/sebs/.bb/thread-storage/thr_wzn6c2j3bu/fs-dock-834-load-${i}-4cbc8d5f.png` })
      }
      rows.push({ load: i, initial, settled, errors, ok })
      console.log(`${ok ? "PASS" : "FAIL"} load ${i}/18: ${sizes.join(", ")}; initial ${initial.map((item) => item.css).join(", ")}; errors ${errors.length}`)
    } catch (error) {
      rows.push({ load: i, error: String(error), ok: false })
      console.log(`FAIL load ${i}/18: ${error}`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

const out = "docs/verification/dock-shell/834-fresh-loads-1023.json"
writeFileSync(out, JSON.stringify({ head: "0f68f6312", viewport: [834, 1112], rows }, null, 2) + "\n")
console.log(`${rows.filter((row) => row.ok).length}/18 settled, ${rows.filter((row) => row.initial?.some((item) => item.css.includes("x361"))).length}/18 initial x361; ${out}`)
process.exit(rows.every((row) => row.ok) ? 0 : 1)
