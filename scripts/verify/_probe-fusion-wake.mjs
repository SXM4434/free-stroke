// WHAT COMPOSITION SHOULD A NEWBORN FUSION LAND ON?
//
// `createFusion` turns dither and ASCII on so the seed links have something to
// act on. Measured on the real page (`_probe-fusion-newborn.mjs --label=known-bad`),
// what that actually does is EAT THE MARK: the solid stroke comes back as a
// dashed line of specks, because both layers land at their bare defaults on a
// near-black `ink` body — the exact "near-black subject vs a 0-1 brightness ramp"
// trap docs/README.md lists as bug pattern #2.
//
// So this compares candidate compositions on ink retained and on the eye:
//   bare      — what the panel does today
//   codebloom — the composition Code Bloom was authored with, which is the
//               built-in that runs the SAME relationship (glyph density <-> dither
//               threshold) on the SAME default ink body
//
//   node scripts/verify/_probe-fusion-wake.mjs --label=v1
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { PORT } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const OUT = join(ROOT, "docs", "verification", "fusion-newborn", LABEL)
mkdirSync(OUT, { recursive: true })

function testStroke() {
  const pts = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    pts.push({ x: 140 + t * 600, y: 320 + Math.sin(t * Math.PI * 2.4) * 150 })
  }
  return [pts]
}

/* THE PAPER IS WHITE AND THE CANVAS IS TRANSPARENT WHERE IT DID NOT DRAW.
 * `document.body` computes `lab(100 0 0)`. Measuring the raw grab counts
 * un-drawn paper as black, which inverts every ink statistic. */
const PAPER = "#ffffff"
function onPaper(img) {
  const c = createCanvas(img.width, img.height)
  const g = c.getContext("2d")
  g.fillStyle = PAPER
  g.fillRect(0, 0, img.width, img.height)
  g.drawImage(img, 0, 0)
  return c
}

/** Share of the frame carrying INK — a pixel meaningfully DARKER than paper. */
async function inkStats(png) {
  const img = await loadImage(png)
  const d = onPaper(img).getContext("2d").getImageData(0, 0, img.width, img.height).data
  let inked = 0
  let sum = 0
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    if (l < 215) inked++
    sum += l
  }
  const n = img.width * img.height
  return { litFrac: inked / n, meanLuma: sum / n }
}

const CODEBLOOM_DITHER = {
  ditherEnabled: true,
  ditherType: "blueNoise",
  ditherScale: 2,
  ditherLevels: 3,
  ditherIntensity: 0.7,
  ditherContrast: 0.45,
  ditherThreshold: 0.5,
  ditherExposure: 0.9,
  ditherLockMode: "screen",
}
const CODEBLOOM_ASCII = {
  asciiEnabled: true,
  asciiCharset: "custom",
  asciiCellSize: 13,
  asciiDensity: 0.6,
  asciiContrast: 0.55,
  asciiLockMode: "screen",
}
const CODEBLOOM_STACK = {
  layerStackEnabled: true,
  stackDitherOpacity: 0.55,
  stackAsciiOpacity: 0.95,
  stackDitherBlend: "normal",
  stackAsciiBlend: "normal",
  stackOrder: "ditherFirst",
}

const ARMS = [
  { id: "clean", label: "no layers (the mark alone)", patch: {} },
  {
    id: "bare",
    label: "TODAY: dither+ascii at bare defaults",
    patch: { ditherEnabled: true, asciiEnabled: true, motionMode: "independent" },
  },
  {
    id: "codebloom",
    label: "Code Bloom's composition",
    patch: { ...CODEBLOOM_DITHER, ...CODEBLOOM_ASCII, ...CODEBLOOM_STACK, motionMode: "independent" },
  },
  {
    id: "codebloom-anim",
    label: "Code Bloom's composition + ASCII scrolling",
    patch: {
      ...CODEBLOOM_DITHER,
      ...CODEBLOOM_ASCII,
      ...CODEBLOOM_STACK,
      asciiAnimated: true,
      asciiAnimationType: "scroll",
      asciiScrollSpeed: 0.9,
      asciiDirection: "horizontal",
      motionMode: "independent",
    },
  },
  {
    id: "soft",
    label: "same, layers pulled back so the MARK still reads",
    patch: {
      ...CODEBLOOM_DITHER,
      ...CODEBLOOM_ASCII,
      ...CODEBLOOM_STACK,
      stackDitherOpacity: 0.4,
      stackAsciiOpacity: 0.6,
      asciiAnimated: true,
      asciiAnimationType: "scroll",
      asciiScrollSpeed: 0.9,
      asciiDirection: "horizontal",
      motionMode: "independent",
    },
  },
  {
    id: "softer",
    label: "pulled back further",
    patch: {
      ...CODEBLOOM_DITHER,
      ...CODEBLOOM_ASCII,
      ...CODEBLOOM_STACK,
      stackDitherOpacity: 0.28,
      stackAsciiOpacity: 0.45,
      asciiAnimated: true,
      asciiAnimationType: "scroll",
      asciiScrollSpeed: 0.9,
      asciiDirection: "horizontal",
      motionMode: "independent",
    },
  },
]

async function main() {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  await page.goto(`http://localhost:${PORT}`, { waitUntil: "networkidle" })
  await page.waitForFunction(() => window.__styleHarness && window.__captureHarness, null, { timeout: 60000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1500)
  if (await page.evaluate(() => !!window.__revealHarness))
    await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(500)

  const grab = async () => {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    return url ? Buffer.from(url.split(",")[1], "base64") : null
  }
  const RESET = {
    textureEnabled: false, textureMode: "none", textureAnimated: false,
    ditherEnabled: false, ditherAnimated: false, ditherType: "bayer4", ditherScale: 3,
    ditherThreshold: 0.5, ditherContrast: 0.5, ditherIntensity: 1, ditherLevels: 2,
    ditherExposure: 0.5, ditherLockMode: "screen", ditherDirection: "static",
    asciiEnabled: false, asciiAnimated: false, asciiAnimationType: "none",
    asciiCharset: "blocks", asciiCellSize: 13, asciiDensity: 0.5, asciiContrast: 0.5,
    asciiLockMode: "screen", asciiDirection: "vertical",
    layerStackEnabled: false, stackAnimationEnabled: false, stackAnimationType: "none",
    stackTextureOpacity: 1, stackDitherOpacity: 1, stackAsciiOpacity: 1,
    stackDitherBlend: "normal", stackAsciiBlend: "normal", stackOrder: "ditherFirst",
    materialPreset: "ink", materialUserOverride: false,
    fusionPreset: "none", motionMode: "off",
  }

  const rows = []
  const shots = []
  for (const a of ARMS) {
    await page.evaluate((p) => window.__styleHarness.setStyle(p), { ...RESET, ...a.patch })
    await page.waitForTimeout(900)
    const png = await grab()
    writeFileSync(join(OUT, `wake-${a.id}.png`), png)
    shots.push({ ...a, png })
    const s = await inkStats(png)
    rows.push({ id: a.id, label: a.label, ...s })
    console.log(`  ${a.id.padEnd(16)} lit ${(s.litFrac * 100).toFixed(3)}%  meanLuma ${s.meanLuma.toFixed(3)}  — ${a.label}`)
  }
  const clean = rows.find((r) => r.id === "clean")
  console.log(`\n  RETAINED against the bare mark (lit fraction):`)
  for (const r of rows) {
    if (r.id === "clean") continue
    console.log(`    ${r.id.padEnd(16)} ${((r.litFrac / clean.litFrac) * 100).toFixed(1)}%`)
  }

  // Contact sheet.
  const TW = 900
  const i0 = await loadImage(shots[0].png)
  const TH = Math.round((TW * i0.height) / i0.width)
  const cols = 2
  const c = createCanvas(cols * TW, Math.ceil(shots.length / cols) * (TH + 30))
  const g = c.getContext("2d")
  g.fillStyle = "#d8d8d8"
  g.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < shots.length; i++) {
    const img = await loadImage(shots[i].png)
    const x = (i % cols) * TW
    const y = Math.floor(i / cols) * (TH + 30)
    g.fillStyle = PAPER
    g.fillRect(x, y + 30, TW, TH)
    g.drawImage(img, x, y + 30, TW, TH)
    g.fillStyle = "#202020"
    g.font = "18px sans-serif"
    g.fillText(`${shots[i].id} — ${shots[i].label}`, x + 12, y + 21)
  }
  writeFileSync(join(OUT, "SHEET-wake.png"), c.toBuffer("image/png"))
  writeFileSync(join(OUT, "wake-report.json"), JSON.stringify(rows, null, 2))
  console.log(`\nwrote ${OUT}`)
  await ctx.close()
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
