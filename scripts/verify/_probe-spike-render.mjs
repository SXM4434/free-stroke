/**
 * THE SPIKE AND THE PINCH, ON THE RENDER — one arm, one family, one aspect.
 *
 * C2, 2026-08-28. `_probe-nib-film.mjs` films the beat and crops the D stem at
 * 8x; that crop is the image the cold Codex read. This probe films the SAME
 * beat at the SAME cadence — 46 grabs, 300 ms apart, so its last frame is the
 * film's last frame — and then measures the two things the crop shows, so a
 * verdict on either does not rest on looking.
 *
 *   SPIKE   the rows of ink ABOVE the top stroke, and how wide they are.
 *   PINCH   the stem's ink run, row by row, from the crossing downward: where
 *           it is narrowest and where it reaches its plateau.
 *
 * ⚠ `grab()` returns a TRANSPARENT png. Every measurement reads the ALPHA
 * channel; only the saved frame is flattened on white. A flattened transparent
 * pixel is indistinguishable from ink, and that trap cost a capture run.
 *
 * ⚠ It films with `FS_HEADED` unset -> headless, which the launcher's own
 * header measures as inside the headless-vs-headless noise floor.
 *
 * Usage: node scripts/verify/_probe-spike-render.mjs <label> <family>
 *   e.g. node scripts/verify/_probe-spike-render.mjs a18 desk-doodles
 *
 * Writes docs/verification/spike-2026-08-28/<label>-<family>/{final.png,mask.json,measure.json}.
 * The crop and the A/B are composed afterwards by `_probe-spike-compose.mjs`,
 * from the UNION of the arms' bounding boxes, so the frame cannot move.
 */
import { chromium } from "./lib/browser.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"

const LABEL = process.argv[2] ?? "run"
const FAMILY = process.argv[3] ?? "desk-doodles"
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs", "verification", "spike-2026-08-28", `${LABEL}-${FAMILY}`)

/** Identical to `_probe-nib-film.mjs`, so the last frame IS the film's last. */
const GRAB_MS = 300
const GRAB_N = 46

function bboxOf(mask, W, H) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  return Number.isFinite(x0) ? { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null
}

async function alphaMask(buf) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const W = info.width, H = info.height, ch = info.channels
  const mask = new Uint8Array(W * H)
  let ink = 0
  for (let i = 0, p = 0; i < W * H; i++, p += ch) {
    if (data[p + ch - 1] > 128) { mask[i] = 1; ink++ }
  }
  return { W, H, mask, ink, bbox: bboxOf(mask, W, H) }
}

/**
 * ROW PROFILE over the D-stem column band.
 *
 * The band is the film's own crop — the leftmost 11.5 % of the word's ink bbox,
 * top 62 % — so this measures the region the 8x image shows and nothing else.
 * Per row it reports every contiguous ink run, longest first. That is enough to
 * separate the three things stacked in that band: a lone narrow run above the
 * bar (the SPIKE), one very wide run (the BAR), and a run that grows downward
 * (the STEM leaving the crossing).
 */
function rowRuns(mask, W, band) {
  const rows = []
  for (let y = band.top; y < band.top + band.height; y++) {
    const runs = []
    let s = -1
    for (let x = band.left; x < band.left + band.width; x++) {
      const on = !!mask[y * W + x]
      if (on && s < 0) s = x
      if (!on && s >= 0) { runs.push({ x0: s, x1: x - 1, len: x - s }); s = -1 }
    }
    if (s >= 0) runs.push({ x0: s, x1: band.left + band.width - 1, len: band.left + band.width - s })
    runs.sort((a, b) => b.len - a.len)
    rows.push({ y, n: runs.length, runs: runs.slice(0, 4), total: runs.reduce((a, r) => a + r.len, 0) })
  }
  return rows
}

const b = await chromium.launch({ label: "spike-render" })
try {
  mkdirSync(OUT, { recursive: true })
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)))

  await page.goto(HERO_URL, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("[data-hero-play]", { timeout: 120000 })
  await page.waitForFunction(() => !!window.__captureHarness && !!window.__revealHarness, null, {
    timeout: 120000, polling: 500,
  })
  await page.waitForTimeout(9000)
  await page.click(`[data-engine-option="${FAMILY}"]`)
  await page.waitForTimeout(4000)
  await page.evaluate(() => window.__captureHarness.enable())
  await page.waitForTimeout(1200)
  const framed = await page.evaluate(() => window.__captureHarness.frontView())
  if (!framed) throw new Error(`frontView() returned false for ${FAMILY}`)
  await page.waitForTimeout(1500)

  /* WHAT THE LIVE PAGE IS ACTUALLY BUILT AT — read BEFORE the beat, which is
   * the method F59 used to keep an aspect bisect honest. A run whose arm is not
   * witnessed here is a run about a constant somebody believes was flipped. */
  const tip = await page.evaluate(() => JSON.parse(JSON.stringify(window.__heroPenTip ?? {})))
  const inflate = await page.evaluate(() => {
    try { return window.__inflateProbe?.debug?.() ?? null } catch { return null }
  })
  console.log(
    `[${LABEL}/${FAMILY}] LIVE nibAspect=${inflate?.nibAspect ?? "n/a"} ` +
      `angle=${inflate?.nibAngleDeg ?? "n/a"} contrastBuilt=${inflate?.nibContrastBuilt ?? "n/a"} ` +
      `tip.mode=${tip.mode} R=${(tip.radius ?? 0).toFixed(3)}`,
  )

  await page.$eval("[data-hero-play]", (el) => el.click())
  let last = null
  const inkTrace = []
  for (let i = 0; i < GRAB_N; i++) {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    if (url) {
      last = Buffer.from(url.split(",")[1], "base64")
      inkTrace.push(i)
    }
    await page.waitForTimeout(GRAB_MS)
  }
  if (!last) throw new Error("no frame grabbed")

  const m = await alphaMask(last)
  await sharp(last).flatten({ background: "#ffffff" }).png().toFile(join(OUT, "final.png"))

  // The film's own D-stem band, anchored to the ink bbox.
  const bb = m.bbox
  const band = {
    left: Math.max(0, bb.x0 - 6),
    top: Math.max(0, bb.y0 - 6),
    width: Math.round(bb.w * 0.115),
    height: Math.round(bb.h * 0.62),
  }
  const rows = rowRuns(m.mask, m.W, band)

  writeFileSync(
    join(OUT, "measure.json"),
    JSON.stringify({ label: LABEL, family: FAMILY, tip, inflate, ink: m.ink, W: m.W, H: m.H, bbox: bb, band, rows, pageErrors: errs.slice(0, 4) }, null, 2),
  )

  console.log(`[${LABEL}/${FAMILY}] ink ${m.ink} px  bbox ${JSON.stringify(bb)}`)
  console.log(`[${LABEL}/${FAMILY}] band ${JSON.stringify(band)}  page errors ${errs.length}`)
  await ctx.close()
} finally {
  await b.close()
}
console.log("out:", OUT)
