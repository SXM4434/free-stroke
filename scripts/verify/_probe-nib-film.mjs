/**
 * FILM THE WRITE-IN, BOTH ENGINE FAMILIES, AND MEASURE THE MARK.
 *
 * N6 · THE NIB, 2026-08-28. The evidence instrument for the broad-nib change:
 * it films the same beat at the same instants before and after, composites the
 * frames on white so ink is measurable at all, and reports three numbers per
 * frame that a taste argument cannot move.
 *
 * ⚠ `__captureHarness.grab()` returns a TRANSPARENT png. Flattening it on white
 * makes it LOOKABLE; it does not make it MEASURABLE, because a flattened
 * transparent pixel is indistinguishable from black ink. Every measurement here
 * reads the ALPHA channel of the raw grab, and only the saved contact frames are
 * flattened. That trap cost the controller a whole capture run tonight.
 *
 * WHAT IT MEASURES
 *   · ink px            — alpha > 128, the mark's area
 *   · counters          — enclosed background regions, flooded from the border,
 *                         min 20 px. The `e`'s eye, the `D`'s bowl, the `o`s.
 *                         A nib thins HORIZONTAL segments, which is the top and
 *                         bottom of every counter, so a correct nib GROWS them.
 *   · D-stem crop       — the region the controller filmed at 8x, anchored to
 *                         the ink bbox rather than to pixel coordinates so it
 *                         lands on the same letter whatever the mark's weight.
 *
 * Usage:  node scripts/verify/_probe-nib-film.mjs <label> [family] [runDir]
 *
 * `runDir` is the folder under `docs/verification/` the labelled run lands in.
 * It defaults to N6's `nib-2026-08-28`, so every path in that lane's report
 * still resolves; N8 films into `mark-2026-08-28` from the same instrument
 * rather than forking a second one, because a before/after that is measured by
 * two copies of a probe is measuring the copies.
 *
 * ⚠ Do NOT set `FS_PORT`. The port is derived from the listening process whose
 * cwd IS this checkout (`scripts/verify/lib/dev-server.mjs`), which is what stops
 * a lane filming another tree's server and reporting it as its own.
 */
import { chromium } from "./lib/browser.mjs"
import { HERO_URL } from "./lib/dev-server.mjs"
import { mkdirSync, writeFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import { stageEvidence } from "./lib/evidence-swap.mjs"

const LABEL = process.argv[2] ?? "run"
const FAMILIES = process.argv[3] ? [process.argv[3]] : ["free-stroke", "desk-doodles"]
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const RUN_DIR = process.argv[4] ?? "nib-2026-08-28"
const OUT = join(ROOT, "docs", "verification", RUN_DIR, LABEL)

/** Frames, in ms after PLAY. The beat runs ~13 s; the last one is the settle. */
const GRAB_MS = 300
const GRAB_N = 46

/* ---------------------------------------------------------------------- */
/*  MEASUREMENT — alpha mask in, three numbers out                         */
/* ---------------------------------------------------------------------- */

/** Enclosed background regions: flood the OUTSIDE from the border, then label
 *  what background is left. Min area filters single-texel seams. */
function counterCensus(mask, W, H, minArea = 20) {
  const outside = new Uint8Array(W * H)
  const stack = []
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = y * W + x
    if (outside[i] || mask[i]) return
    outside[i] = 1
    stack.push(i)
  }
  for (let x = 0; x < W; x++) {
    push(x, 0)
    push(x, H - 1)
  }
  for (let y = 0; y < H; y++) {
    push(0, y)
    push(W - 1, y)
  }
  while (stack.length) {
    const i = stack.pop()
    const x = i % W
    const y = (i / W) | 0
    push(x + 1, y)
    push(x - 1, y)
    push(x, y + 1)
    push(x, y - 1)
  }
  const seen = new Uint8Array(W * H)
  const areas = []
  for (let i = 0; i < W * H; i++) {
    if (mask[i] || outside[i] || seen[i]) continue
    let area = 0
    seen[i] = 1
    const st = [i]
    while (st.length) {
      const j = st.pop()
      area++
      const x = j % W
      const y = (j / W) | 0
      const nb = [
        x + 1 < W ? j + 1 : -1,
        x - 1 >= 0 ? j - 1 : -1,
        y + 1 < H ? j + W : -1,
        y - 1 >= 0 ? j - W : -1,
      ]
      for (const k of nb) {
        if (k < 0 || seen[k] || mask[k] || outside[k]) continue
        seen[k] = 1
        st.push(k)
      }
    }
    if (area >= minArea) areas.push(area)
  }
  areas.sort((a, b) => b - a)
  return areas
}

function bboxOf(mask, W, H) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 } : null
}

async function measure(buf) {
  const img = sharp(buf).ensureAlpha()
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true })
  const W = info.width
  const H = info.height
  const ch = info.channels
  const mask = new Uint8Array(W * H)
  let ink = 0
  for (let i = 0, p = 0; i < W * H; i++, p += ch) {
    if (data[p + ch - 1] > 128) {
      mask[i] = 1
      ink++
    }
  }
  return { W, H, ink, mask, bbox: bboxOf(mask, W, H) }
}

/* ---------------------------------------------------------------------- */

async function filmOne(page, family) {
  const dirFinal = join(OUT, family)
  /* STAGED PER FAMILY. `RUN_DIR` is argv[4], so this wipe can reach any subtree
   * of docs/verification; the default alone, `nib-2026-08-28`, holds 367 tracked
   * files. A run that dies mid-family now leaves that family's stored frames
   * alone. lib/evidence-swap.mjs. */
  const ev = stageEvidence(dirFinal)
  const dir = ev.open()
  mkdirSync(join(dir, "frames"), { recursive: true })

  await page.goto(HERO_URL, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("[data-hero-play]", { timeout: 120000 })
  /* ⚠ `polling: "raf"` (playwright's default) NEVER RESOLVES on a headed Chrome
   * whose window is not frontmost — the same class as the `networkidle` hang
   * DISPATCH warns about, and it costs 120 s per arm to discover. Poll on a
   * timer, and bring the tab forward so the rAF loop the beat itself rides is
   * not throttled either. */
  await page.bringToFront()
  await page.waitForFunction(() => !!window.__captureHarness && !!window.__revealHarness, null, {
    timeout: 120000,
    polling: 500,
  })
  await page.waitForTimeout(9000)
  await page.click(`[data-engine-option="${family}"]`)
  await page.waitForTimeout(4000)
  await page.evaluate(() => window.__captureHarness.enable())
  await page.waitForTimeout(1200)
  /* `frontView()` RETURNS FALSE when there are no orbit controls or no bounds
   * yet, and it does it silently. Dropping that answer is how a run films the
   * default camera for fourteen seconds and files the frames as a front view —
   * every measurement below would then be comparing two different shots. */
  const framed = await page.evaluate(() => window.__captureHarness.frontView())
  if (!framed) throw new Error(`frontView() returned false for ${family} — no controls or no bounds`)
  await page.waitForTimeout(1500)

  const tip = await page.evaluate(() => JSON.parse(JSON.stringify(window.__heroPenTip ?? {})))
  const inflate = await page.evaluate(() => {
    try {
      return window.__inflateProbe?.debug?.() ?? null
    } catch {
      return null
    }
  })

  /* NOT `page.click`. Capture mode swaps in a fixed 1920x1080 canvas that lies
   * over the controls, so Playwright's actionability check spins for 30 s on
   * "canvas intercepts pointer events" and then fails. The button is a real
   * button; call its own click. */
  await page.$eval("[data-hero-play]", (el) => el.click())
  const rows = []
  for (let i = 0; i < GRAB_N; i++) {
    const url = await page.evaluate(() => window.__captureHarness.grab())
    if (url) {
      const buf = Buffer.from(url.split(",")[1], "base64")
      const m = await measure(buf)
      rows.push({ i, ink: m.ink, bbox: m.bbox, counters: m.counters ?? null, buf, mask: m })
    }
    await page.waitForTimeout(GRAB_MS)
  }

  // Census only on the frames that matter — every frame's flood fill is slow.
  const lastIdx = rows.length - 1
  const marks = new Set([lastIdx, Math.max(0, lastIdx - 4), Math.max(0, Math.floor(lastIdx * 0.6))])
  for (const r of rows) {
    if (marks.has(r.i)) {
      r.counters = counterCensus(r.mask.mask, r.mask.W, r.mask.H)
    }
    await sharp(r.buf)
      .flatten({ background: "#ffffff" })
      .png()
      .toFile(join(dir, "frames", String(r.i).padStart(3, "0") + ".png"))
    delete r.mask
    delete r.buf
  }

  // THE D-STEM CROP, anchored to the ink bbox so it survives a weight change.
  const last = rows[lastIdx]
  const nib = { crop: null }
  if (last?.bbox) {
    const b = last.bbox
    const cw = Math.round(b.w * 0.115)
    const chh = Math.round(b.h * 0.62)
    const cx = Math.max(0, b.x0 - 6)
    const cy = Math.max(0, b.y0 - 6)
    nib.crop = { left: cx, top: cy, width: cw, height: chh }
    const src = join(dir, "frames", String(lastIdx).padStart(3, "0") + ".png")
    await sharp(src)
      .extract(nib.crop)
      .resize({ width: cw * 8, kernel: "nearest" })
      .png()
      .toFile(join(dir, "STEM-final.png"))
  }

  writeFileSync(
    join(dir, "measure.json"),
    JSON.stringify(
      {
        label: LABEL,
        family,
        tip,
        inflate: inflate && {
          fusionRequested: inflate.fusionRequested,
          fusionUsed: inflate.fusionUsed,
          implicitFailure: inflate.implicitFailure,
          nibAspect: inflate.nibAspect,
          nibAngleDeg: inflate.nibAngleDeg,
          nibWeightRestore: inflate.nibWeightRestore,
          nibContrastBuilt: inflate.nibContrastBuilt,
        },
        crop: nib.crop,
        frames: rows.map((r) => ({ i: r.i, ink: r.ink, bbox: r.bbox, counters: r.counters })),
      },
      null,
      2,
    ),
  )

  const fin = rows[lastIdx]
  console.log(
    `[${family}] tip mode=${tip.mode} R=${(tip.radius ?? 0).toFixed(3)}  fusion ${inflate?.fusionRequested ?? "?"}→${inflate?.fusionUsed ?? "?"}`,
  )
  console.log(
    `[${family}] final frame ${lastIdx}: ink ${fin?.ink} px · counters ${fin?.counters?.length ?? "?"} ` +
      `[${(fin?.counters ?? []).join(", ")}] · total ${(fin?.counters ?? []).reduce((a, z) => a + z, 0)}`,
  )
  /* THE SWAP, once the whole family is filmed and measured. */
  ev.commit()
  return { family, tip, inflate, rows }
}

const b = await chromium.launch({ headed: true, label: "nib-film" })
try {
  mkdirSync(OUT, { recursive: true })
  const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errs = []
  page.on("pageerror", (e) => errs.push(String(e).slice(0, 160)))
  for (const fam of FAMILIES) await filmOne(page, fam)
  console.log("page errors:", errs.length ? errs.slice(0, 4).join(" | ") : 0)
  await ctx.close()
} finally {
  await b.close()
}
console.log("out:", OUT)
