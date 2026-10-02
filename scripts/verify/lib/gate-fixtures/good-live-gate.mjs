// FIXTURE — the shape a gate is supposed to have. Must be judged PASS.
import { chromium } from "playwright-core"

const arg = (k, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${k}=`))
  return h ? h.split("=")[1] : d
}
const LABEL = arg("label", "run")

let pass = true
const say = (ok, label, detail) => {
  if (!ok) pass = false
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function main() {
  const browser = await chromium.launch({ channel: "chrome", headless: false })
  const page = await browser.newPage()
  const n = await page.evaluate(() => 1)
  await browser.close()
  say(n === 1, `the page answered (${LABEL})`)
  console.log(pass ? "\nALL PASS" : "\nFAILURES PRESENT")
  process.exit(pass ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
