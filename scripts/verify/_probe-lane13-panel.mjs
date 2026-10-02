// Shoots the two panels this lane changed so they can be LOOKED at, not just
// asserted: the Layers panel (group opacity / direction / phase / the eighth
// behaviour) and the Presets panel on the new Animated Material family.
// Capture only — the verdicts live in assert-preset-pixels.mjs.
import { chromium } from "./lib/browser.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this tool used to hardcode the default dev-server address,
// so a lane running it on its own port captured the CANONICAL tree and filed those
// frames under its own label. DISPATCH §3; explainers 27 §1 and 28 §3.2 (importing
// the resolver rather than copying the port line is what keeps the legacy-name throw).
// This comment deliberately spells no URL: a comment is source text too, and the
// surveys that measure this debt are greps (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "..", "docs", "verification", "preset-families", "panel")
mkdirSync(OUT, { recursive: true })

const pts = []
for (let i = 0; i <= 110; i++) {
  const t = i / 110
  pts.push({ x: 150 + t * 560, y: 340 + Math.sin(t * Math.PI * 1.9) * 120 })
}

const b = await chromium.launch({ headed: true })
const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, reducedMotion: "no-preference" })
await p.goto(LAB_URL, { waitUntil: "networkidle" })
await p.waitForFunction(() => window.__styleHarness)
await p.evaluate((x) => window.__styleHarness.injectStrokes(x, { msPerPoint: 12 }), [pts])
await p.waitForTimeout(1400)

/* ⚠ THERE IS NO "Layers" CHIP IN THE SUMMARY STRIP. Every other style system
 * has one — the strip's own comment says a chip per system, and Fusion was
 * added for exactly this reason ("FUSION BELONGS IN THE STRIP, and it did not
 * have a chip", app/page.tsx:784) — but the panel that carries the whole layer
 * stack AND the stack animation is reachable only by opening some other panel
 * first and then using the drawer's internal nav. Reported in this lane's
 * return with the diff; app/page.tsx is not this lane's file. */
const openDrawerAt = async (panelLabel) => {
  const open = await p.$('button[title^="Close "]')
  if (!open) await p.click('button[title="Edit Material"]')
  await p.waitForTimeout(350)
  await p.click(`button:has-text("${panelLabel}")`)
  await p.waitForTimeout(450)
}

const panel = async (panelLabel, file, patch, scrollTo) => {
  if (patch) await p.evaluate((x) => window.__styleHarness.setStyle(x), patch)
  await p.waitForTimeout(250)
  await openDrawerAt(panelLabel)
  if (scrollTo) {
    // The drawer body is a fixed-height scroller; the stack-animation block
    // sits below the fold on a 1000px viewport.
    await p.evaluate((t) => {
      const el = [...document.querySelectorAll("span,label,div")].find(
        (e) => e.textContent.trim() === t,
      )
      if (el) el.scrollIntoView({ block: "start" })
    }, scrollTo)
    await p.waitForTimeout(350)
  }
  writeFileSync(join(OUT, file), await p.screenshot({ fullPage: false }))
}

await panel("Layers", "layers-drift.png", {
  layerStackEnabled: true,
  textureEnabled: true,
  textureMode: "scanlines",
  ditherEnabled: true,
  asciiEnabled: true,
  stackAnimationEnabled: true,
  stackAnimationType: "drift",
  stackAnimationSpeed: -0.6,
  stackAnimationPhase: 1.2,
  stackAnimationOpacity: 0.55,
}, "Stack Animation")
await panel("Layers", "layers-fadein.png", {
  stackAnimationType: "fadeIn",
  stackAnimationSpeed: 1,
  stackAnimationPhase: 0,
  stackAnimationOpacity: 1,
}, "Stack Animation")
await panel("Layers", "layers-revealsync.png", { stackAnimationType: "revealSynced" }, "Stack Animation")
await p.evaluate(() => window.__styleHarness.selectPreset("animatedMaterial", "deepGelBloom"))
await panel("Presets", "presets-animated-material.png")

console.log("wrote panel shots to", OUT)
await b.close()
