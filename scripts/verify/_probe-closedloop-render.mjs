/**
 * THE CLOSED LOOP, ON THE RENDER — one arm, one family, one state.
 *
 * D1, 2026-08-28. C2 proved on the centreline that `endpoint: "protrude"` opens
 * three loops the trace had closed, and stated its own limit: *"the fix is
 * proved on the centreline, offline, through the real `processStroke`. Nobody
 * has looked at a frame drawn with it."* This probe is that frame.
 *
 * It films the SAME beat at the SAME cadence as `_probe-spike-render.mjs`
 * (46 grabs, 300 ms apart, so its last frame is the film's last frame) and then
 * measures three things rather than one:
 *
 *   SPIKE     the rows of ink ABOVE the top bar of the `D`, and how wide they
 *             are. C2's band law verbatim, so the before frame reproduces the
 *             shipped measurement and the after frame is read the same way.
 *   O LOOPS   the same row profile over each `o` of "Doodles", whose protruded
 *             tails `AB-o-loops.png` shows but never measured.
 *   THE FLAG  `window.__handFeelHarness` publishes the page's OWN raw and
 *             processed strokes. Per stroke: the raw endpoint gap, the
 *             processed endpoint gap, and whether the page decided it was
 *             closed. That is what makes this a witnessed arm rather than a
 *             belief about an edit — a centreline claim and a rendered frame
 *             taken from the same page, in the same run.
 *
 * The o bands are DERIVED from the raw word's own letter geometry rather than
 * typed in, so they cannot drift from the word: each band is the letter's own
 * bbox expressed as a fraction of the word's, re-anchored to the arm's ink bbox.
 *
 * ⚠ `grab()` returns a TRANSPARENT png. Every measurement reads the ALPHA
 * channel; only the saved frame is flattened on white. A flattened transparent
 * pixel is indistinguishable from ink.
 *
 * Usage: node scripts/verify/_probe-closedloop-render.mjs <state> <family>
 *   e.g. FS_HEADED=0 node scripts/verify/_probe-closedloop-render.mjs before desk-doodles
 *
 * Writes docs/verification/closedloop-2026-08-28/<state>-<family>/{final.png,measure.json}.
 */
import { chromium } from "./lib/browser.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"
import { ROOT } from "./_ts-load.mjs"
import { heroPolylines, rawHeroStrokes } from "./_hero-word.mjs"

const STATE = process.argv[2] ?? "before"
const FAMILY = process.argv[3] ?? "desk-doodles"
const OUT = join(ROOT, "docs", "verification", "closedloop-2026-08-28", `${STATE}-${FAMILY}`)

/** Identical to `_probe-spike-render.mjs`, so the last frame IS the film's last. */
const GRAB_MS = 300
const GRAB_N = 46
/** Slack around a derived letter band, in render px. The protruded tails run a
 *  little past the letter's own centreline bbox, and a band that clips the
 *  defect it exists to measure is worse than no band. */
const PAD = 22

/* ── THE LETTER BANDS, DERIVED ───────────────────────────────────────────── */
const bboxOfPts = (pts) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of pts) {
    const x = p.x ?? p[0], y = p.y ?? p[1]
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }
}
const rawStrokes = rawHeroStrokes()
const wordBox = bboxOfPts(rawStrokes.flatMap((s) => s.points))
/** kept-stroke index -> letter, from `_probe-closure-predicate.mjs`'s census:
 *  0 = the `D` of "Desk", 6 and 7 = the two `o`s of "Doodles". */
const LETTERS = [
  { key: "o1", idx: 6 },
  { key: "o2", idx: 7 },
]
const letterFracs = LETTERS.map(({ key, idx }) => {
  const b = bboxOfPts(rawStrokes[idx].points)
  return {
    key,
    fx0: (b.x0 - wordBox.x0) / wordBox.w,
    fx1: (b.x1 - wordBox.x0) / wordBox.w,
    fy0: (b.y0 - wordBox.y0) / wordBox.h,
    fy1: (b.y1 - wordBox.y0) / wordBox.h,
  }
})

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

/** Every contiguous ink run per row of a band, longest first. */
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

/**
 * THE SPIKE, AS A NUMBER RATHER THAN A LOOK.
 *
 * The `D`'s top bar is the widest ink run in the stem band — nothing else in
 * that window is close. So the bar's row is the argmax of the longest run, and
 * every inked row ABOVE it is ink standing over the top of the letter. That is
 * the needle, and it counts itself.
 */
function spikeAboveBar(rows) {
  let barY = null, barLen = 0
  for (const r of rows) {
    const L = r.runs[0]?.len ?? 0
    if (L > barLen) { barLen = L; barY = r.y }
  }
  const above = rows.filter((r) => r.y < barY && r.total > 0)
  return {
    barY,
    barLen,
    rowsAbove: above.length,
    widths: above.map((r) => r.runs[0].len),
    maxWidth: above.length ? Math.max(...above.map((r) => r.runs[0].len)) : 0,
    inkAbove: above.reduce((a, r) => a + r.total, 0),
    firstRow: above.length ? above[0].y : null,
  }
}

const gapOf = (pts) => Math.hypot(pts[pts.length - 1][0] - pts[0][0], pts[pts.length - 1][1] - pts[0][1])

const b = await chromium.launch({ label: "closedloop-render" })
try {
  mkdirSync(OUT, { recursive: true })
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)))

  page.setDefaultTimeout(180000)
  page.setDefaultNavigationTimeout(180000)
  await page.goto(HERO_URL, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("[data-hero-play]", { timeout: 120000 })
  await page.waitForFunction(() => !!window.__captureHarness && !!window.__revealHarness && !!window.__handFeelHarness, null, {
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

  /* THE ARM, WITNESSED BEFORE THE BEAT — never assumed. */
  const tip = await page.evaluate(() => JSON.parse(JSON.stringify(window.__heroPenTip ?? {})))
  const inflate = await page.evaluate(() => {
    try { return window.__inflateProbe?.debug?.() ?? null } catch { return null }
  })
  const hf = await page.evaluate(() => {
    const h = window.__handFeelHarness
    return { raw: h.raw, processed: h.processed, wobble: h.wobble, endpoint: h.endpoint, closed: h.closed ?? null }
  })
  const strokes = hf.raw.map((r, i) => ({
    i,
    rawGap: +gapOf(r).toFixed(2),
    processedGap: +gapOf(hf.processed[i]).toFixed(2),
    closed: hf.closed ? hf.closed[i] : null,
  }))
  console.log(
    `[${STATE}/${FAMILY}] LIVE nibAspect=${inflate?.nibAspect ?? "n/a"} angle=${inflate?.nibAngleDeg ?? "n/a"} ` +
      `endpoint=${hf.endpoint} wobble=${hf.wobble} closedFlags=${hf.closed ? JSON.stringify(hf.closed) : "NOT PUBLISHED"}`,
  )

  await page.$eval("[data-hero-play]", (el) => el.click())
  let last = null
  for (let i = 0; i < GRAB_N; i++) {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    if (url) last = Buffer.from(url.split(",")[1], "base64")
    await page.waitForTimeout(GRAB_MS)
  }
  if (!last) throw new Error("no frame grabbed")

  const m = await alphaMask(last)
  await sharp(last).flatten({ background: "#ffffff" }).png().toFile(join(OUT, "final.png"))

  const bb = m.bbox
  /* THE `D` STEM BAND — C2's law verbatim, so before and after are read the
   * same way the shipped AB was. */
  const bands = {
    Dstem: {
      left: Math.max(0, bb.x0 - 6),
      top: Math.max(0, bb.y0 - 6),
      width: Math.round(bb.w * 0.115),
      height: Math.round(bb.h * 0.62),
    },
  }
  for (const f of letterFracs) {
    bands[f.key] = {
      left: Math.max(0, Math.round(bb.x0 + f.fx0 * bb.w) - PAD),
      top: Math.max(0, Math.round(bb.y0 + f.fy0 * bb.h) - PAD),
      width: Math.round((f.fx1 - f.fx0) * bb.w) + PAD * 2,
      height: Math.round((f.fy1 - f.fy0) * bb.h) + PAD * 2,
    }
  }

  const measured = {}
  for (const [key, band] of Object.entries(bands)) {
    const rows = rowRuns(m.mask, m.W, band)
    measured[key] = {
      band,
      ink: rows.reduce((a, r) => a + r.total, 0),
      spike: spikeAboveBar(rows),
      rows,
    }
  }

  writeFileSync(
    join(OUT, "measure.json"),
    JSON.stringify(
      { state: STATE, family: FAMILY, tip, inflate, handFeel: { wobble: hf.wobble, endpoint: hf.endpoint, closed: hf.closed }, strokes,
        ink: m.ink, W: m.W, H: m.H, bbox: bb, bands: measured, pageErrors: errs.slice(0, 4) },
      null, 2,
    ),
  )

  console.log(`[${STATE}/${FAMILY}] ink ${m.ink} px  bbox ${JSON.stringify(bb)}  page errors ${errs.length}`)
  for (const [k, v] of Object.entries(measured)) {
    console.log(
      `  ${k.padEnd(6)} band ${JSON.stringify(v.band)}  ink ${v.ink}  ` +
        `barY ${v.spike.barY} barLen ${v.spike.barLen}  ROWS ABOVE ${v.spike.rowsAbove} widths [${v.spike.widths}]`,
    )
  }
  console.log("  per-stroke gaps (raw -> processed, closed):")
  for (const s of strokes) console.log(`    ${String(s.i).padStart(2)}  ${String(s.rawGap).padStart(7)} -> ${String(s.processedGap).padStart(7)}   ${s.closed}`)
  await ctx.close()
} finally {
  await b.close()
}
console.log("out:", OUT)
