// HEADED fusion judge — captures timed frame sequences for every fusion /
// animated-fusion preset from a real visible Metal-backed Chrome window, and
// computes per-frame metrics so "X drives Y" becomes checkable numbers as well
// as watchable pixels. NEVER headless (standing rule).
//
// Plans:
//   node scripts/verify/judge-fusion.mjs --plan=static     # 8 fusion presets, ambient drive
//   node scripts/verify/judge-fusion.mjs --plan=anim       # 7 animated choreographies
//   node scripts/verify/judge-fusion.mjs --plan=proofs     # driver-dial proofs
//   node scripts/verify/judge-fusion.mjs --plan=one --family=fusion --preset=x --mode=solid
//
// Frames land in docs/verification/fusion-v1/. Metrics per frame:
//   lum   mean luminance over ink pixels (glow / wet-darkening axis)
//   sd    luminance stddev over ink (pattern/glyph contrast: washout axis)
//   dark  fraction of ink pixels below lum 60 (ink coverage: threshold axis)
//   bandX brightest-column position, normalized 0..1 (sweep-band tracking)
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
// ONE KNOB, ONE NAME — this judge spelled the default dev-server address, so a lane
// running it on its own port judged the CANONICAL tree's fusions and wrote the
// numbers into fusion-v1 as if they were its own. DISPATCH §3; explainers 27 §1 and
// 28 §3.2. IMPORTING the resolver is the bar, not reading the right variable name
// (Lane F). No address is spelled in this comment (explainer 28 §4.1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, "..", "..", "docs", "verification", "fusion-v1")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const PLAN = arg("plan", "one")

function testStroke() {
  const pts = []
  for (let i = 0; i <= 130; i++) {
    const t = i / 130
    pts.push({
      x: 110 + t * 660,
      y: 330 + Math.sin(t * Math.PI * 2.2) * 135 + Math.sin(t * Math.PI * 6) * 20,
    })
  }
  return [pts]
}

async function metrics(pngPath) {
  const img = await loadImage(pngPath)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const d = ctx.getImageData(0, 0, img.width, img.height).data
  let n = 0, sum = 0, sumSq = 0, dark = 0
  const colSum = new Float64Array(img.width)
  const colN = new Float64Array(img.width)
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4
      if (d[i + 3] < 20) continue
      const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
      n++
      sum += l
      sumSq += l * l
      if (l < 60) dark++
      colSum[x] += l
      colN[x] += 1
    }
  }
  if (!n) return { lum: 0, sd: 0, dark: 0, bandX: 0, n }
  const mean = sum / n
  // Brightest column via windowed column means (window smooths glyph noise).
  let bandX = 0, best = -1
  const W = 40
  for (let x = 0; x < img.width - W; x += 8) {
    let s = 0, m = 0
    for (let k = 0; k < W; k++) { s += colSum[x + k]; m += colN[x + k] }
    if (m > 200) {
      const v = s / m
      if (v > best) { best = v; bandX = (x + W / 2) / img.width }
    }
  }
  return {
    lum: mean,
    sd: Math.sqrt(Math.max(0, sumSq / n - mean * mean)),
    dark: dark / n,
    bandX,
    n,
  }
}

async function launch() {
  mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headed: true, args: ["--window-size=1500,1000"] })
  const page = await browser.newPage({ viewport: { width: 1440, height: 940 } })
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404"))
      console.log("[page-error]", m.text().slice(0, 200))
  })
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.bringToFront()
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness,
    null,
    { timeout: 30000 },
  )
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12 }), testStroke())
  await page.waitForTimeout(1000)
  return { browser, page }
}

async function applyPreset(page, family, preset, mode, patch) {
  await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
  await page.waitForTimeout(700)
  // Reset fusion so re-selecting re-ARMS the choreography deterministically.
  await page.evaluate(() =>
    window.__styleHarness.setStyle({ fusionPreset: "none", fusionAnimationEnabled: false }),
  )
  await page.waitForTimeout(120)
  await page.evaluate(({ family, preset }) => window.__styleHarness.selectPreset(family, preset), {
    family,
    preset,
  })
  if (patch) {
    await page.evaluate((p) => window.__styleHarness.setStyle(p), patch)
  }
  await page.evaluate(() => window.__captureHarness.enable())
  await page.waitForTimeout(500)
  await page.evaluate(() => window.__captureHarness.frontView(1))
  await page.waitForTimeout(200)
}

async function grabSeq(page, tag, frames, intervalMs, scrub) {
  const rows = []
  for (let i = 0; i < frames; i++) {
    if (scrub) {
      const v = scrub.from + ((scrub.to - scrub.from) * i) / (frames - 1)
      await page.evaluate((x) => window.__revealHarness.setProgress(x), v)
      await page.waitForTimeout(scrub.settleMs ?? 250)
    }
    const u = await page.evaluate(() => window.__captureHarness.grab())
    const file = join(OUT, `${tag}_${String(i).padStart(2, "0")}.png`)
    writeFileSync(file, Buffer.from(u.match(/base64,(.+)/)[1], "base64"))
    const m = await metrics(file)
    rows.push(m)
    console.log(
      `${tag}_${String(i).padStart(2, "0")}  lum=${m.lum.toFixed(1)}  sd=${m.sd.toFixed(1)}  dark=${(m.dark * 100).toFixed(1)}%  bandX=${m.bandX.toFixed(3)}`,
    )
    if (!scrub && i < frames - 1) await page.waitForTimeout(intervalMs)
  }
  return rows
}

const STATIC_SET = [
  ["terminalGel", "inflate"],
  ["ditherBloom", "solid"],
  ["signalInk", "rod"],
  ["asciiRubber", "inflate"],
  ["scanlineBalloon", "inflate"],
  ["pixelClay", "solid"],
  ["codeBloom", "extrude"],
  ["glitchRibbon", "extrude"],
]

const ANIM_SET = [
  // [id, mode, frames, intervalMs, scrub?]
  ["terminalGelRevealBuild", "inflate", 10, 550, null],
  ["ditherBloomThresholdOpen", "solid", 10, 500, null],
  ["signalInkDataFlow", "rod", 12, 300, null],
  ["asciiRubberSlowdown", "inflate", 12, 500, null],
  ["scanlineBalloonSoftPulse", "inflate", 14, 450, null],
  ["glitchRibbonControlledBreak", "extrude", 20, 400, null],
  ["codeBloomCharacterReveal", "extrude", 10, 550, null],
]

async function main() {
  const { browser, page } = await launch()
  try {
    if (PLAN === "static") {
      for (const [id, mode] of STATIC_SET) {
        console.log(`\n== fusion/${id} (${mode}) ==`)
        await applyPreset(page, "fusion", id, mode)
        await grabSeq(page, `fus_${id}`, 8, 700)
      }
    } else if (PLAN === "anim") {
      for (const [id, mode, frames, interval, scrub] of ANIM_SET) {
        console.log(`\n== animatedFusion/${id} (${mode}) ==`)
        await applyPreset(page, "animatedFusion", id, mode)
        await grabSeq(page, `anim_${id}`, frames, interval, scrub)
      }
    } else if (PLAN === "proofs") {
      // P1 — ASCII Rubber: the scroll-speed dial drives the glyph current;
      // the shine band must speed up WITH it (band pos derived from asciiTime).
      for (const spd of [0.45, 1.8]) {
        console.log(`\n== proof asciiRubber scrollSpeed=${spd} ==`)
        await applyPreset(page, "fusion", "asciiRubber", "inflate", { asciiScrollSpeed: spd })
        await page.waitForTimeout(400)
        await grabSeq(page, `proof_rubber_s${String(spd).replace(".", "")}`, 8, 400)
      }
      // P2 — Code Bloom Character Reveal: reveal progress is the driver; glyph
      // contrast (sd) AND stipple ink coverage (dark) must build together.
      console.log(`\n== proof codeBloom reveal scrub ==`)
      await applyPreset(page, "animatedFusion", "codeBloomCharacterReveal", "extrude")
      await grabSeq(page, `proof_codebloom_rv`, 6, 0, { from: 0.15, to: 1.0, settleMs: 350 })
      // P3 — Signal Ink: burst drives glow UP and pattern OUT (anti-phase):
      // across ambient frames, lum and sd must anti-correlate.
      console.log(`\n== proof signalInk anti-phase ==`)
      await applyPreset(page, "fusion", "signalInk", "rod")
      const rows = await grabSeq(page, `proof_signal`, 14, 350)
      const lums = rows.map((r) => r.lum)
      const sds = rows.map((r) => r.sd)
      const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length
      const ml = mean(lums), ms = mean(sds)
      let num = 0, dl = 0, ds = 0
      for (let i = 0; i < rows.length; i++) {
        num += (lums[i] - ml) * (sds[i] - ms)
        dl += (lums[i] - ml) ** 2
        ds += (sds[i] - ms) ** 2
      }
      const r = num / Math.sqrt(dl * ds || 1)
      console.log(`signalInk corr(lum, patternContrast) = ${r.toFixed(3)} (negative = anti-phase confirmed)`)
    } else if (PLAN === "band") {
      // Wrap-aware band velocity at two scroll-speed dial settings. The band
      // travels +x and wraps every 2.3 units of sweep pos (~1.0 of bandX), so
      // per-frame deltas are folded into [0,1) before taking the median —
      // robust against the glyph checker noise that polluted single deltas.
      for (const spd of [0.45, 1.8]) {
        await applyPreset(page, "fusion", "asciiRubber", "inflate", { asciiScrollSpeed: spd })
        await page.waitForTimeout(400)
        const rows = await grabSeq(page, `band_s${String(spd).replace(".", "")}`, 14, 250)
        const deltas = []
        for (let i = 1; i < rows.length; i++) {
          let d = rows[i].bandX - rows[i - 1].bandX
          d = ((d % 1) + 1) % 1 // forward wrap
          deltas.push(d)
        }
        deltas.sort((a, b) => a - b)
        const med = deltas[Math.floor(deltas.length / 2)]
        console.log(`scrollSpeed=${spd}  median forward bandX delta/frame = ${med.toFixed(3)}`)
      }
    } else {
      const family = arg("family", "fusion")
      const preset = arg("preset", "terminalGel")
      const mode = arg("mode", "solid")
      const frames = parseInt(arg("frames", "8"))
      const interval = parseInt(arg("interval", "700"))
      const patch = arg("patch", "")
      console.log(`\n== ${family}/${preset} (${mode}) ==`)
      await applyPreset(page, family, preset, mode, patch ? JSON.parse(patch) : null)
      await grabSeq(page, `one_${preset}${arg("tag", "")}`, frames, interval)
    }
  } finally {
    await browser.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
