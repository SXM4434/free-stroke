// WHAT ACTUALLY BREAKS ON A PHONE — measured, so the build/don't-build call is
// made on numbers rather than on a guess.
// `devices` was imported here and never used — it was the ONLY named import of a
// driver besides `chromium` in all 385 files, and it is dropped rather than
// re-exported, because one dead binding is not a reason for a second door into
// playwright.
import { chromium } from "./lib/browser.mjs"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const b = await chromium.launch()

const sizes = [
  ["desktop 1500", { width: 1500, height: 1460 }],
  ["laptop 1280", { width: 1280, height: 800 }],
  ["tablet 834", { width: 834, height: 1112 }],
  ["phone 390", { width: 390, height: 844 }],
  ["phone 360", { width: 360, height: 740 }],
]

console.log("viewport meta:", "")
{
  const p = await b.newPage({ viewport: { width: 1200, height: 800 } })
  await p.goto(LAB_URL, { waitUntil: "domcontentloaded" })
  const meta = await p.evaluate(() => document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? null)
  console.log("  <meta name=viewport> =", JSON.stringify(meta))
  await p.close()
}

console.log("\nSIZE            docW  bodyScrollW  H-OVERFLOW  canvasW  viewportW  strip  <44px targets  panel clipped")
console.log("-".repeat(112))
for (const [name, vp] of sizes) {
  const p = await b.newPage({ viewport: vp, reducedMotion: "no-preference" })
  await p.goto(LAB_URL, { waitUntil: "networkidle" })
  await p.waitForFunction(() => window.__styleHarness)
  await p.evaluate(() =>
    window.__styleHarness.injectStrokes([[{ x: 60, y: 120 }, { x: 160, y: 220 }, { x: 260, y: 130 }]], {}),
  )
  await p.waitForTimeout(1400)
  // Open the biggest panel — the one with the most controls.
  await p.evaluate(() => {
    const chip = [...document.querySelectorAll("button")].find((e) => (e.title || "").startsWith("Edit Fusion"))
    chip?.click()
  })
  await p.waitForTimeout(700)

  const m = await p.evaluate(() => {
    const doc = document.documentElement
    const cols = [...document.querySelectorAll(".flex-1")]
    const canvasCol = document.querySelector("canvas")?.getBoundingClientRect()
    const all = [...document.querySelectorAll("canvas")]
    const vpCanvas = all[all.length - 1]?.getBoundingClientRect()
    const strip = [...document.querySelectorAll("div")].find((d) =>
      d.className && String(d.className).includes("overflow-x-auto") && d.textContent.startsWith("Style"),
    )
    const targets = [...document.querySelectorAll("button, input, select, a[href]")]
      .map((e) => e.getBoundingClientRect())
      .filter((r) => r.width > 1 && r.height > 1)
    const small = targets.filter((r) => r.height < 44 || r.width < 44).length
    const body = document.querySelector(".fs-panel-enter")
    return {
      docW: doc.clientWidth,
      scrollW: doc.scrollWidth,
      overflow: doc.scrollWidth > doc.clientWidth,
      canvasW: canvasCol ? Math.round(canvasCol.width) : -1,
      vpW: vpCanvas ? Math.round(vpCanvas.width) : -1,
      stripScroll: strip ? `${strip.scrollWidth}>${Math.round(strip.clientWidth)}` : "n/a",
      small,
      total: targets.length,
      panelClipped: body ? body.scrollHeight > body.clientHeight + 2 : false,
      cols: cols.length,
    }
  })
  console.log(
    `${name.padEnd(15)} ${String(m.docW).padEnd(5)} ${String(m.scrollW).padEnd(12)} ${String(m.overflow).padEnd(11)} ${String(m.canvasW).padEnd(8)} ${String(m.vpW).padEnd(10)} ${String(m.stripScroll).padEnd(6)} ${m.small}/${m.total}`.padEnd(96) +
      `${m.panelClipped}`,
  )
  await p.screenshot({ path: `docs/verification/shell-states/mobile-${vp.width}.png` })
  await p.close()
}
await b.close()
