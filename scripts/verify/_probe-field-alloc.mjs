// _PROBE-FIELD-ALLOC — does the eraser need a dial, or does a PLAIN LOAD do it?
//
// The mechanism is `setFieldRealloc` in components/viewport-3d.tsx: a
// `DataTexture`'s GL storage is immutable after its first upload, so a field
// re-baked at any other size is written into a corner of the old rectangle
// while `fsPuv` keeps scanning the whole of it. That only bites if the field is
// re-baked at a DIFFERENT SIZE — so the question that decides how much of the
// verification battery was rendering the defect is: does that happen with
// nobody touching anything?
//
// Prints, per checkpoint, the field size and the size the GL storage is
// actually allocated at. Touches no dial in the `plain` arm.
//
// Usage: node scripts/verify/_probe-field-alloc.mjs [--arm=plain|dials] [--engine=]
import { chromium } from "./lib/browser.mjs"
import { fileURLToPath } from "node:url"
import { dirname } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { HERO_URL } from "./lib/dev-server.mjs"

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const ARM = arg("arm", "plain")
const ENGINE = arg("engine", "")
const REALLOC = arg("realloc", "off")

async function main() {
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1600 }, deviceScaleFactor: 1 })
  const page = await context.newPage()
  await page.goto(HERO_URL, { waitUntil: "networkidle" })
  await page.waitForSelector("[data-hero-play]", { timeout: 90000 })
  await page.waitForFunction(() => !!window.__captureHarness, null, { timeout: 120000 })
  await page.waitForTimeout(2500)
  // The parked prior by default, because the question is what the SHIPPED build
  // did — the fix would hide the answer.
  await page.evaluate((v) => window.__captureHarness.setFieldRealloc(v), REALLOC !== "off")

  const read = async (what) => {
    const g = await page.evaluate(() => window.__heroPenField ?? null)
    if (!g) { console.log(`${what.padEnd(34)}  (no field yet)`); return }
    const bad = g.texW !== g.width || g.texH !== g.height
    console.log(
      `${what.padEnd(34)}  field ${String(g.width).padStart(5)}x${String(g.height).padStart(3)}   GL ${String(g.texW).padStart(5)}x${String(g.texH).padStart(3)}   ${bad ? "MISMATCH  <-- the eraser" : "ok"}`,
    )
  }

  const seek = async (t) => {
    await page.evaluate((tt) => {
      const el = document.querySelector("[data-hero-scrub]")
      const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
      s.call(el, String(tt))
      el.dispatchEvent(new Event("input", { bubbles: true }))
      el.dispatchEvent(new Event("change", { bubbles: true }))
    }, t)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    await page.waitForTimeout(300)
  }

  const dur = await page.evaluate(() => Number(document.querySelector("[data-hero-scrub]").max))
  console.log(`arm=${ARM}  realloc=${REALLOC}\n`)

  // The first frame where the carve is ON — that is the first bake.
  for (let k = 0; k <= 40; k++) {
    await seek((dur * k) / 40)
    const c = await page.evaluate(() => Number(document.querySelector("[data-hero-phase]")?.getAttribute("data-hero-carve")))
    if (c > 0) { await read(`FIRST carved frame (t=${((dur * k) / 40).toFixed(2)}s)`); break }
  }
  // Play the whole beat through, still touching nothing.
  await page.click("[data-hero-play]")
  await page.waitForTimeout(14000)
  await read("after one full PLAY")

  if (ARM === "dials") {
    if (ENGINE) {
      await page.click(`[data-engine-option="${ENGINE}"]`)
      await page.waitForTimeout(3500)
      await page.waitForFunction(() => !!window.__captureHarness, null, { timeout: 60000 })
      await seek(dur * 0.45)
      await read(`after engine -> ${ENGINE}`)
    }
    await page.evaluate(() => {
      for (const inp of document.querySelectorAll('input[type="range"]')) {
        const row = inp.closest("div")?.parentElement
        if (((row?.textContent ?? "").toLowerCase()).includes("wobble")) {
          const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
          s.call(inp, "0")
          inp.dispatchEvent(new Event("input", { bubbles: true }))
          inp.dispatchEvent(new Event("change", { bubbles: true }))
          break
        }
      }
    })
    await page.waitForTimeout(2500)
    await seek(dur * 0.45)
    await read("after wobble -> 0")
    await page.evaluate(() => {
      for (const b of document.querySelectorAll("button"))
        if ((b.textContent ?? "").trim().toLowerCase() === "clean") { b.click(); break }
    })
    await page.waitForTimeout(2500)
    await seek(dur * 0.45)
    await read("after endpoint -> clean")
  }

  await context.close()
  await browser.close()
}
main().catch((e) => { console.error(e); process.exit(1) })
