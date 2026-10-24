// FIXTURE — the judge exists and nothing calls it. Must be judged FAIL /
// no-verdict.
//
// This is what a half-finished refactor leaves behind: a complete, correct
// assertion block that is no longer reachable from any entry point. Grepping the
// file for "PASS" finds it and reports the script as a gate.
import { chromium } from "playwright-core"

function judge(rows) {
  let fails = 0
  for (const r of rows) {
    const ok = r.value > 1
    if (!ok) fails++
    console.log(`${ok ? "PASS" : "FAIL"}  ${r.key} moves — ${r.value}`)
  }
  return fails
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: false })
  const page = await browser.newPage()
  const rows = await page.evaluate(() => [{ key: "a", value: 0.1 }])
  for (const r of rows) console.log(`[fixture] ${r.key}  ${r.value}`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
