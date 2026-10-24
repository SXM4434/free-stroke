// IS THE `paper -> ink` IN `assert-pen-carve` ROW 2 THE CARVE, OR THE BREAK?
//
// Row 2 says *"the carve only ever REMOVES ink — the pen outline is a subset of
// the tube"* and it is red at 405 px paper→ink against 8305 px ink→paper. Row 3
// says the removal is 32.2 % where `_probe-carve-preview.mjs` predicted 22.9 %.
// Both controls fire, so the red is trustworthy — but a red row is a
// measurement, not a diagnosis.
//
// THE SUSPECT, stated before it is tested: the two frames row 2 compares differ
// in TWO channels, not one. `assert-pen-carve` sets `penCarve` and leaves
// `jointBreak` to the host, and it seeks to the END of the beat where the host
// publishes the break OPEN. `viewport-3d.tsx` then rebuilds the break table on
// `fs.penCarve` (`syncBreakTable(carveNow)`), and `buildJointBreaks` sizes the
// paper band's INNER bound `keepOver` from the carve — 1.06 R at carve 0 and
// 0.56-1.00 R at carve 1. The band is an ANNULUS `(keepOver, keepOver + gap]`
// about the stroke in front, so lowering `keepOver` slides the WHOLE annulus
// inward and its OUTER edge moves in with it. Ink that the tube-sized band had
// turned to paper is then outside the carve-sized band, and comes back as ink.
//
// If that is the mechanism, holding `jointBreak: 0` in both frames must take
// `added` to zero and pull the removal toward the offline 22.9 %.
//
// This is a PROBE and it decides which of two fixes is the right one: §17 rule 4
// (the check is wrong — isolate the channel) or a change to the law.
//
// Usage: node scripts/verify/_probe-carve-isolate.mjs
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { flatInterior, INK_MAX_LUMA } from "./lib/flat-interior.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "pen-carve", "isolate")
const URL = HERO_URL
const FLAT = { ink: 1, depth: 0.004, yaw: 0, shade: 0, shadow: 0, squashX: 1, squashY: 1 }

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1440 } })
  const page = await context.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)))
  // Same parked arm `assert-pen-carve` loads on, for the same reason: the host
  // publishes `penCarve: 1` at the end of the beat, so a pose that OMITS the
  // key would come back already carved.
  await page.addInitScript(() => {
    window.__heroCarveLaw = "prior"
  })
  await page.goto(URL, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__captureHarness && window.__heroJunctions, null, {
    timeout: 90000,
  })
  await page.waitForTimeout(2500)

  const box = await page.locator("[data-hero-stage]").boundingBox()
  const shot = async () => {
    await page.waitForTimeout(320)
    return page.screenshot({ clip: box })
  }
  const set = async (o) => {
    await page.evaluate((v) => window.__captureHarness.setFlatten(v), o)
    await page.waitForTimeout(300)
  }
  const endT = await page.evaluate(() =>
    Number(document.querySelector("[data-hero-scrub]").max),
  )
  await page.evaluate((v) => {
    const el = document.querySelector("[data-hero-scrub]")
    const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set
    s.call(el, String(v))
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }, endT)
  await page.waitForTimeout(450)

  const hostBreak = await page.evaluate(() => window.__heroBreaks ?? null)

  const arms = []
  for (const [name, extra] of [
    ["break-from-host (what row 2 measures today)", {}],
    ["break-HELD-CLOSED (the carve alone)", { jointBreak: 0 }],
    ["break-HELD-OPEN-at-1 (the break alone moves with the carve)", { jointBreak: 1 }],
  ]) {
    await set({ ...FLAT, ...extra, penCarve: 0 })
    const off = await shot()
    writeFileSync(join(OUT, `off-${name.split(" ")[0]}.png`), off)
    await set({ ...FLAT, ...extra, penCarve: 1 })
    const on = await shot()
    writeFileSync(join(OUT, `on-${name.split(" ")[0]}.png`), on)
    const o = await flatInterior(off)
    const n = await flatInterior(on)
    let removed = 0
    let added = 0
    const addedAt = []
    for (let p = 0; p < o.luma.length; p++) {
      const was = o.luma[p] <= INK_MAX_LUMA
      const is = n.luma[p] <= INK_MAX_LUMA
      if (was && !is) removed++
      if (!was && is) {
        added++
        if (addedAt.length < 8) addedAt.push([p % o.W, Math.floor(p / o.W)])
      }
    }
    arms.push({
      name,
      removed,
      added,
      pct: (100 * added) / Math.max(1, removed),
      inkOff: o.ink,
      inkOn: n.ink,
      drop: (100 * (o.ink - n.ink)) / Math.max(1, o.ink),
      sdOff: o.sd,
      sdOn: n.sd,
      addedAt,
    })
  }
  await set(null)
  await browser.close()

  console.log(
    `host break table at the end of the beat: ${JSON.stringify(hostBreak && { junctions: hostBreak.junctions, opened: hostBreak.opened, dropped: hostBreak.dropped })}\n`,
  )
  for (const a of arms) {
    console.log(a.name)
    console.log(
      `   ${a.removed} px ink→paper, ${a.added} px paper→ink (${a.pct.toFixed(2)} %)  ` +
        `· ink ${a.inkOff} → ${a.inkOn} (${a.drop.toFixed(1)} % drop, offline predicts 22.9)  ` +
        `· SD ${a.sdOff.toFixed(3)} → ${a.sdOn.toFixed(3)}`,
    )
    if (a.addedAt.length)
      console.log(`   first added px: ${a.addedAt.map((p) => `(${p[0]},${p[1]})`).join(" ")}`)
  }
  console.log(`\n${errors.length} page error(s)`)
  console.log(`frames: ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
