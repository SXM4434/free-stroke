// EVERY FUSION RELATIONSHIP, ON THE REAL SURFACE, LOOKED AT.
//
// A table of deltas cannot answer "does this read as a look". This renders every
// preset on the fusion rail — the eight that shipped and the four added
// 2026-08-03 — three frames apart across a window wide enough to contain a full
// breath, and lays them out as a contact sheet so the set can be judged as a set:
// does each one look like a different idea, or like the same idea eight times?
//
//   node scripts/verify/_probe-fusion-sheet.mjs --label=v1
//   ... --drive=arc          the same rail under a different drive shape
//   ... --mode=solid         a different geometry engine
//   ... --crop=x,y,w,h       fractions; defaults frame the test stroke
import { chromium } from "./lib/browser.mjs"
import { writeFileSync, mkdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { loadTs } from "./_ts-load.mjs"
import { PORT } from "./lib/dev-server.mjs"

const S = loadTs("lib/style-system.ts")
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL = arg("label", "run")
const DRIVE = arg("drive", "loop")
const CROP = (arg("crop", "0.24,0.30,0.58,0.46") || "").split(",").map(Number)
const ORBIT = arg("orbit", "")
const OUT = join(ROOT, "docs", "verification", "fusion-rail", LABEL)
mkdirSync(OUT, { recursive: true })

const PAPER = "#ffffff"

function testStroke() {
  const pts = []
  for (let i = 0; i <= 150; i++) {
    const t = i / 150
    pts.push({ x: 140 + t * 600, y: 320 + Math.sin(t * Math.PI * 2.4) * 150 })
  }
  return [pts]
}

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

  /* ---- THE ORBIT SWEEP — the only honest proof of a camera-driven relationship.
   *
   * `viewTurn` couples the surface to WHERE YOU ARE LOOKING FROM. Three frames
   * at one camera angle cannot show that however far apart in time they are, and
   * a still of it is indistinguishable from a still of any other polished body.
   * So this arm holds TIME as near still as the rail allows and moves the
   * CAMERA instead — which is the axis the relationship actually runs on.
   *
   * The control is the same sweep with the relationship switched off (Link 0):
   * a mark on a turntable already changes as you orbit it, and without that arm
   * this sheet would be proving that three.js has specular highlights. */
  if (ORBIT) {
    const angles = [0, 26, 52, 78, 104, 130]
    const arms = []
    for (const link of [0.85, 0]) {
      await page.evaluate((id) => window.__styleHarness.selectPreset("fusion", id), ORBIT)
      await page.evaluate((v) => window.__styleHarness.setStyle({ fusionIntensity: v, fusionSwing: 0 }), link)
      await page.waitForTimeout(900)
      const shots = []
      for (const a of angles) {
        await page.evaluate((az) => window.__captureHarness.orbitView(az, 14), a)
        await page.waitForTimeout(900)
        shots.push(await grab())
      }
      arms.push({ label: link ? `${ORBIT} — Link ${link}` : `${ORBIT} — Link 0 (the control: the same orbit, uncoupled)`, shots })
      console.log(`  orbit arm captured at Link ${link}`)
    }
    const TWo = 560
    const io = await loadImage(arms[0].shots[0])
    const sxo = CROP[0] * io.width
    const syo = CROP[1] * io.height
    const swo = CROP[2] * io.width
    const sho = CROP[3] * io.height
    const THo = Math.round((TWo * sho) / swo)
    const co = createCanvas(angles.length * TWo, arms.length * (THo + 30))
    const go = co.getContext("2d")
    go.fillStyle = "#e6e6e6"
    go.fillRect(0, 0, co.width, co.height)
    for (let r = 0; r < arms.length; r++) {
      const y = r * (THo + 30)
      go.fillStyle = "#1a1a1a"
      go.font = "600 17px sans-serif"
      go.fillText(arms[r].label, 12, y + 21)
      for (let i = 0; i < arms[r].shots.length; i++) {
        const img = await loadImage(arms[r].shots[i])
        const x = i * TWo
        go.fillStyle = PAPER
        go.fillRect(x, y + 30, TWo, THo)
        go.drawImage(img, sxo, syo, swo, sho, x, y + 30, TWo, THo)
        go.fillStyle = "#555"
        go.font = "13px sans-serif"
        go.fillText(`${angles[i]}°`, x + 10, y + 47)
      }
    }
    writeFileSync(join(OUT, `SHEET-orbit-${ORBIT}.png`), co.toBuffer("image/png"))
    console.log(`wrote ${join(OUT, `SHEET-orbit-${ORBIT}.png`)}`)
    await page.evaluate(() => window.__captureHarness.frontView())
    await ctx.close()
    await browser.close()
    return
  }

  const presets = S.FUSION_PRESET_DEFS.filter((p) => p.enabled)
  const rows = []
  for (const p of presets) {
    // Selected through the SAME function the pill calls, so what is rendered is
    // what a click produces — composition patch included.
    await page.evaluate((id) => window.__styleHarness.selectPreset("fusion", id), p.id)
    await page.evaluate((d) => window.__styleHarness.setStyle({ fusionDrive: d, fusionAnimationEnabled: d !== "loop" }), DRIVE)
    /* THE VIEW PRESET NEEDS A VIEW. `viewTurn` is driven by the camera's
     * azimuth and rests at the head-on angle by design, so a head-on capture of
     * it is a capture of its resting state — true, and not what the sheet is
     * for. Every arm gets the same three-quarter framing so the set is
     * comparable and the one relationship that answers the camera has something
     * to answer. */
    await page.evaluate(() => window.__captureHarness.orbitView(38, 14))
    await page.waitForTimeout(1400)
    const shots = []
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(1500)
      shots.push(await grab())
    }
    for (let i = 0; i < shots.length; i++)
      writeFileSync(join(OUT, `${p.id}-${i}.png`), shots[i])
    rows.push({ id: p.id, label: p.label, shots })
    console.log(`  captured ${p.id}`)
  }
  await page.evaluate(() => window.__captureHarness.frontView())

  // ---- the sheet: one ROW per relationship, three moments across it ----
  const TW = 620
  const i0 = await loadImage(rows[0].shots[0])
  const sx = CROP[0] * i0.width
  const sy = CROP[1] * i0.height
  const sw = CROP[2] * i0.width
  const sh = CROP[3] * i0.height
  const TH = Math.round((TW * sh) / sw)
  const LABEL_W = 190
  const c = createCanvas(LABEL_W + 3 * TW, rows.length * TH)
  const g = c.getContext("2d")
  g.fillStyle = "#e6e6e6"
  g.fillRect(0, 0, c.width, c.height)
  for (let r = 0; r < rows.length; r++) {
    const y = r * TH
    g.fillStyle = "#1a1a1a"
    g.font = "600 17px sans-serif"
    g.fillText(rows[r].label, 12, y + 26)
    g.fillStyle = "#666"
    g.font = "13px sans-serif"
    g.fillText(rows[r].id, 12, y + 46)
    for (let i = 0; i < rows[r].shots.length; i++) {
      const img = await loadImage(rows[r].shots[i])
      const x = LABEL_W + i * TW
      g.fillStyle = PAPER
      g.fillRect(x, y, TW, TH)
      g.drawImage(img, sx, sy, sw, sh, x, y, TW, TH)
    }
  }
  writeFileSync(join(OUT, `SHEET-fusion-rail-${DRIVE}.png`), c.toBuffer("image/png"))
  console.log(`\nwrote ${join(OUT, `SHEET-fusion-rail-${DRIVE}.png`)}  (${presets.length} relationships x 3 moments)`)
  await ctx.close()
  await browser.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
