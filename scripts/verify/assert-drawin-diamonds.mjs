#!/usr/bin/env node
// The three Draw-in diamonds must key the values shown when first clicked.
// FS_PORT=3138 FS_HEADED=0 BROWSER_CDP=<leased CDP> node scripts/verify/assert-drawin-diamonds.mjs

import { readFileSync } from "node:fs"
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { openDock } from "./lib/dock.mjs"

const strokes = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const paths = ["envelope.durationSeconds", "envelope.pressureReveal", "envelope.tipHighlight"]
const browser = await chromium.launch()
let pass = 0
let fail = 0

function row(name, ok, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`)
  ok ? pass++ : fail++
}

try {
  for (const [width, height] of [[1512, 982], [1280, 800]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (error) => errors.push(error.message))
    try {
      await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
      await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__dockHarness?.dock && window.__fsKeys, null, { timeout: 240000 })
      await page.evaluate((items) => window.__styleHarness.injectStrokes(items.slice(0, 5), { msPerPoint: 12, gapMs: 60 }), strokes)
      await page.waitForTimeout(1200)
      await page.evaluate(() => window.__revealHarness.setPlaying(false))
      await openDock(page, { tab: "drawin" })
      await page.evaluate(() => {
        const toggle = document.querySelector("[data-animation-drawin]")
        if (toggle && toggle.getAttribute("aria-expanded") !== "true") toggle.click()
      })
      const takeMs = await page.evaluate(() => window.__fsTransport?.derived()?.totalDuration)
      const results = []
      for (const path of paths) {
        const button = page.locator(`[data-dock-panel="drawin"] [data-key-button="${path}"]`)
        if (await button.count() !== 1) {
          results.push({ path, error: "button count is not one" })
          continue
        }
        await button.scrollIntoViewIfNeeded()
        const before = await page.evaluate((key) => {
          const el = document.querySelector(`[data-dock-panel="drawin"] [data-key-button="${key}"]`)
          const rect = el.getBoundingClientRect()
          const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
          return { visible: el.checkVisibility({ visibilityProperty: true }), enabled: !el.disabled, centreHit: hit === el || el.contains(hit) }
        }, path)
        if (before.visible && before.enabled && before.centreHit) await button.click()
        await page.waitForTimeout(200)
        const after = await page.evaluate((key) => ({
          track: window.__fsKeys?.()?.[key] ?? null,
          refusal: window.__fsKeyRefusals?.()?.[key] ?? null,
        }), path)
        results.push({ path, ...before, ...after })
      }
      const controls = results.every((item) => item.visible && item.enabled && item.centreHit)
      const keyed = results.every((item) => item.track?.length === 1 && !item.refusal)
      const duration = results[0]?.track?.[0]?.value
      const keptLength = Number.isFinite(takeMs) && Math.abs(duration - takeMs / 1000) < 1e-9
      row(`${width}x${height} buttons`, controls, `${results.filter((item) => item.visible && item.enabled && item.centreHit).length}/3 visible, enabled and centre hit`)
      row(`${width}x${height} first clicks`, keyed && keptLength, `${results.filter((item) => item.track?.length === 1 && !item.refusal).length}/3 keyed; Duration ${duration ?? "none"}s, current take ${takeMs}ms; refusals ${results.map((item) => item.refusal).filter(Boolean).join("; ") || "none"}`)
      row(`${width}x${height} page`, errors.length === 0, `${errors.length} page errors`)
    } finally {
      await context.close()
    }
  }
} finally {
  await browser.close()
}

console.log(`${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
