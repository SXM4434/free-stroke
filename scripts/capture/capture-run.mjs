// Local capture driver (replaces the v0 sandbox's agent-browser CLI).
// Drives the running dev preview (http://localhost:3000) through the DEV
// harnesses to capture the transparent draw-in of the "Desk Doodles" word in
// Inflate mode. Two stroke sources:
//   --source=trace  -> scripts/capture/logo-strokes.json (traced handwriting)
//   --source=font   -> letters.mjs clean single-stroke font, logo-sized
// Output: scripts/capture/frames/3d_0000.png ... 3d_full.png (1920x1080 alpha)
//
// Usage: node scripts/capture/capture-run.mjs --source=font [--headed]
import { chromium } from "playwright-core"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { layoutWord } from "./letters.mjs"
import { stageEvidence } from "../verify/lib/evidence-swap.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
/* STAGED. This is not under docs/verification, so the census of the class missed
 * it, and it is the same defect: `scripts/capture/frames` holds 344 tracked PNGs
 * and this wipe emptied them before a capture that takes minutes. The run writes
 * to a sibling `.frames.staging` and the stored set is replaced only once every
 * frame exists. lib/evidence-swap.mjs. */
const FINAL = join(__dirname, "frames")
const EV = stageEvidence(FINAL)
const FRAMES = EV.dir
const STROKES = join(__dirname, "logo-strokes.json")

const source = (process.argv.find((a) => a.startsWith("--source=")) || "--source=trace").split("=")[1]
const headed = process.argv.includes("--headed")
const DRAW_FRAMES = parseInt(process.env.DRAW_FRAMES || "60", 10)
const ROUGHNESS = parseFloat(process.env.ROUGHNESS || "0.35")
const FONT_TARGET_W = parseFloat(process.env.FONT_TARGET_W || "1100")

function getPolylines() {
  if (source === "trace") {
    return JSON.parse(readFileSync(STROKES, "utf8")).polylines
  }
  // Font: lay the word out, then scale so total width matches the trace's
  // coordinate span (~1100). The inflate rasterizer's fixed lineWidth is
  // relative to stroke coordinate space, so matching the span keeps the tube
  // weight consistent with the logo's stroke weight.
  const { polylines, width } = layoutWord("Desk Doodles", { x: 0, y: 0, size: 120, tracking: 12 })
  const k = FONT_TARGET_W / width
  return polylines.map((pl) => pl.map((p) => ({ x: p.x * k, y: 400 + p.y * k })))
}

async function main() {
  EV.open()

  const polylines = getPolylines()
  console.log(`[cap] source=${source} polylines=${polylines.length}`)

  const browser = await chromium.launch({ channel: "chrome", headless: !headed })
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } })
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[page-error]", m.text().slice(0, 200))
  })
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
    null,
    { timeout: 30000 },
  )

  const ok = await page.evaluate(
    ({ poly, roughness }) => {
      const H = window.__styleHarness
      H.setMode("inflate")
      H.setMaterial("custom")
      H.setCustom({
        color: "#1a1a1a",
        roughness,
        metalness: 0.0,
        clearcoat: 0.0,
        sheen: 0.0,
        emissiveIntensity: 0.0,
        envMapIntensity: 1.0,
      })
      H.injectStrokes(poly, { msPerPoint: 12, gapMs: 60 })
      window.__captureHarness.enable()
      return "ok"
    },
    { poly: polylines, roughness: ROUGHNESS },
  )
  console.log("[cap] inject+style:", ok)
  await page.waitForTimeout(2000)

  const front = await page.evaluate(() => String(window.__captureHarness.frontView(1.0)))
  console.log("[cap] frontView:", front)
  await page.waitForTimeout(800)

  const grabTo = async (file) => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    const m = (url || "").match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)
    if (!m) throw new Error("grab returned no data url")
    writeFileSync(file, Buffer.from(m[1], "base64"))
  }

  for (let i = 0; i < DRAW_FRAMES; i++) {
    const p = i / (DRAW_FRAMES - 1)
    await page.evaluate((v) => window.__revealHarness.setProgress(v), p)
    await page.waitForTimeout(160) // let the inflate rebuild + render settle
    const name = i === DRAW_FRAMES - 1 ? "3d_full" : `3d_${String(i).padStart(4, "0")}`
    await grabTo(join(FRAMES, `${name}.png`))
    if (i % 10 === 0) console.log(`[cap] frame ${i}/${DRAW_FRAMES} p=${p.toFixed(2)}`)
  }
  await page.evaluate(() => window.__revealHarness.setProgress(1.0))
  await page.waitForTimeout(400)
  await grabTo(join(FRAMES, "3d_full.png"))

  await browser.close()
  /* THE SWAP. The only moment `scripts/capture/frames` is written at all. */
  EV.commit()
  console.log("[cap] done")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
