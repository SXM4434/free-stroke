// MARQUEE BULB SHAPE — are the lit cells round or square?
//
// The ASCII layer is SCREEN-LOCKED (asciiLockMode: "screen"), so its cell grid
// lives in device pixels and moving the camera cannot magnify a glyph. The only
// way to see the shape of one bulb is to capture the frame and enlarge a crop,
// which is what this does: nearest-neighbour upscale so the bulb's actual pixel
// footprint is visible rather than resampled into a blur.
//
// Presets are applied through `__styleHarness.selectPreset` — the SAME function
// the preset rail calls — so this exercises what a user gets, not a synthetic
// style object.
//
// Usage: node scripts/verify/verify-marquee-bulbs.mjs --label=after
// Output: docs/verification/marquee-bulbs/<label>/
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
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
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const OUT = join(ROOT, "docs", "verification", "marquee-bulbs", LABEL)

// Cases: the reported one first, then the other dot alphabet, then two
// letterform charsets that MUST still render as bitmap glyphs.
const CASES = [
  { name: "marquee_braille", family: "layerStack", id: "marqueeStack", mode: "solid" },
  { name: "sparseGlyph_dots", family: "ascii", id: "sparseGlyph", mode: "solid" },
  { name: "blueprint_boxes", family: "layerStack", id: "blueprintStack", mode: "solid" },
  { name: "terminalShade_classic", family: "ascii", id: "terminalShade", mode: "solid" },
]

function stroke() {
  const pts = []
  for (let i = 0; i <= 120; i++) {
    const t = i / 120
    pts.push({ x: 120 + t * 620, y: 380 + Math.sin(t * Math.PI * 1.6) * 120 })
  }
  return [pts]
}

// Nearest-neighbour crop-and-magnify: 1 source pixel -> SCALE x SCALE block.
async function magnify(srcFile, dstFile, box, scale) {
  const img = await loadImage(srcFile)
  const src = createCanvas(img.width, img.height)
  src.getContext("2d").drawImage(img, 0, 0)
  const data = src.getContext("2d").getImageData(box.x, box.y, box.w, box.h)
  const out = createCanvas(box.w * scale, box.h * scale)
  const ctx = out.getContext("2d")
  // Opaque backdrop: the captured frame has alpha, and a bulb's falloff lives
  // in the alpha-composited result, so flatten it the way a viewer sees it.
  ctx.fillStyle = "#0b0b0b"
  ctx.fillRect(0, 0, out.width, out.height)
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      const i = (y * box.w + x) * 4
      const a = data.data[i + 3] / 255
      if (a <= 0.002) continue
      ctx.fillStyle = `rgba(${data.data[i]},${data.data[i + 1]},${data.data[i + 2]},${a})`
      ctx.fillRect(x * scale, y * scale, scale, scale)
    }
  }
  writeFileSync(dstFile, out.toBuffer("image/png"))
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness,
    null,
    { timeout: 30000 },
  )

  await page.evaluate((poly) => window.__styleHarness.injectStrokes(poly, { msPerPoint: 12 }), stroke())
  await page.waitForTimeout(900)
  await page.evaluate(() => window.__captureHarness.enable())

  for (const c of CASES) {
    await page.evaluate((m) => window.__styleHarness.setMode(m), c.mode)
    await page.waitForTimeout(700)
    await page.evaluate(({ family, id }) => window.__styleHarness.selectPreset(family, id), c)
    await page.waitForTimeout(900)
    await page.evaluate(() => window.__revealHarness.setProgress(1))
    await page.evaluate(() => window.__captureHarness.frontView(1.0))
    await page.waitForTimeout(700)

    const url = await page.evaluate(() => window.__captureHarness.grab())
    const m = (url || "").match(/base64,(.+)/)
    if (!m) throw new Error(`grab failed for ${c.name}`)
    const full = join(OUT, `${c.name}_full.png`)
    writeFileSync(full, Buffer.from(m[1], "base64"))

    // Three magnified crops across the form so the sample isn't cherry-picked.
    const size = await page.evaluate(() => window.__captureHarness.size())
    const boxes = [
      { x: Math.round(size.width * 0.30), y: Math.round(size.height * 0.42), w: 130, h: 74 },
      { x: Math.round(size.width * 0.46), y: Math.round(size.height * 0.50), w: 130, h: 74 },
      { x: Math.round(size.width * 0.60), y: Math.round(size.height * 0.44), w: 130, h: 74 },
    ]
    for (let i = 0; i < boxes.length; i++) {
      await magnify(full, join(OUT, `${c.name}_zoom${i}.png`), boxes[i], 8)
    }
    console.log(`[bulbs] ${c.name}: captured`)
  }

  writeFileSync(join(OUT, "errors.json"), JSON.stringify(errors, null, 2))
  console.log(`[bulbs] console errors: ${errors.length}`)
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
