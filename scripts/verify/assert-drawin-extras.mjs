// assert-drawin-extras.mjs (DRAWIN-EXTRAS, 2026-09-30)
//
// The draw-in extras from coverage items 10 and 11
// (docs/research-2026-09-26/animation-asks-coverage.md rows 15, 19, 41, 42, 47).
// One section per extra. Every section has the same three kinds of row:
//   OFF   the extra at its default renders and times the take exactly as main;
//   ON    the extra changes what it claims, measured on the render or the clock;
//   MUST-FAIL  a knockout or a deliberately wrong input, run through the same
//         check, which has to come back red, so each check is shown able to fail.
//
// MAIN IS MEASURED, NEVER REMEMBERED. `--phase=base` runs against a dev server
// on the unchanged base and writes the reference file; the default phase reads
// it. Both runs are in the same container on the same browser, so no number
// here is a Mac number.
//
//   FS_PORT=3140 FS_HEADED=0 node scripts/verify/assert-drawin-extras.mjs --phase=base --base-file=/path/base.json
//   FS_PORT=3139 FS_HEADED=0 node scripts/verify/assert-drawin-extras.mjs --base-file=/path/base.json [--only=tip]
//
// CORPUS: the hero word (scripts/capture/logo-strokes.json, 12 strokes) on Rod
// and Inflate at 1512x982, paused at fixed playheads. NOT covered: Extrude and
// Solid, the 3-Up compare panels, and export frames.
// Exit 0 only when every row passes and every must-fail fires.

import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { readFileSync, writeFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const { loadImage, createCanvas } = require("@napi-rs/canvas")
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const PHASE = arg("phase", "lane")
const BASE_FILE = arg("base-file", null)
const ONLY = arg("only", null)?.split(",") ?? null
if (!BASE_FILE) {
  console.log("NOT RUN: --base-file is required (the base phase writes it, the lane phase reads it)")
  process.exit(2)
}
const J = JSON.stringify
const sha = (b) => createHash("sha256").update(b).digest("hex").slice(0, 16)
const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines

const MODES = ["rod", "inflate"]
const PLAYHEADS = [0.2, 0.45, 0.7, 1]
const SHIPPED_PRESETS = ["authenticDraw", "handDraw", "smoothReveal", "snappyDraw", "slowGel", "loopingStroke"]

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  :  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
/* A must-fail arm: `ok` is the verdict the real check gives on the broken input. */
const mustFail = (name, ok, detail) => row(ok === false, `${name} [must-fail fires]`, detail)

/* ─── the page ─────────────────────────────────────────────────────────── */
const browser = await chromium.launch({ label: "assert-drawin-extras" })
const errors = []
async function openPage(strokes = polys) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(String(e)))
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), strokes)
  await page.waitForTimeout(2500)
  await page.evaluate(() => window.__revealHarness.setPlaying(false))
  return page
}
const settle = async (page, ms = 400) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
async function glCanvas(page) {
  let best = null
  let area = 0
  for (const c of await page.$$("canvas")) {
    const bb = await c.boundingBox()
    const lab = (await c.getAttribute("aria-label")) ?? ""
    if (bb && !lab.includes("Drawing") && bb.width * bb.height > area) {
      area = bb.width * bb.height
      best = c
    }
  }
  return best
}
/* One frame at playhead p, captured twice. Two different captures of one paused
 * frame mean the frame is not a function of the state, and nothing built on it
 * could be graded, so that throws rather than passing or failing a row. */
async function frame(page, p) {
  await page.evaluate((p) => window.__revealHarness.setProgress(p), p)
  await settle(page)
  const c = await glCanvas(page)
  const a = await c.screenshot()
  await settle(page, 150)
  const b = await c.screenshot()
  if (sha(a) !== sha(b)) throw new Error(`frame at ${p} is not stable across two captures`)
  return a
}
async function setMode(page, mode) {
  await page.evaluate((m) => window.__styleHarness.setMode(m), mode)
  await page.waitForFunction((m) => window.__styleHarness.get().geometryMode === m, mode, { timeout: 120000 })
  await page.waitForTimeout(mode === "inflate" ? 6000 : 1500)
  await pinCamera(page)
}
/* THE CAMERA, PINNED. Without this the framing after a load differs from load
 * to load (measured 2026-09-30: 33,987 px apart on one paused frame), so no
 * frame could be compared with main's. The same view the app frames a new
 * drawing with, set by the harness and left to settle. */
async function pinCamera(page, fill = 1.7) {
  const ok = await page.evaluate((f) => window.__captureHarness.orbitView(45, 35.264, f), fill)
  if (!ok) throw new Error("orbitView refused: the camera cannot be pinned")
  await page.waitForTimeout(1500)
}
async function clockOf(page) {
  return page.evaluate(() => {
    const c = window.__fsClock?.get()
    return {
      total: window.__revealHarness.getTotalDuration(),
      takePenMs: c?.takePenMs ?? null,
      clocked: c ? c.clocked.map((pts) => pts.map((q) => q.t)) : null,
    }
  })
}

/* Pixels. `dark` is ink on the near-white page; the amber glow is not dark. */
async function pixels(buf) {
  const img = await loadImage(buf)
  const cv = createCanvas(img.width, img.height)
  const g = cv.getContext("2d")
  g.drawImage(img, 0, 0)
  return { w: img.width, h: img.height, d: g.getImageData(0, 0, img.width, img.height).data }
}
const lum = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
function diffStats(A, B, thresh = 24) {
  let n = 0
  let sx = 0
  let sy = 0
  for (let y = 0; y < A.h; y++) {
    for (let x = 0; x < A.w; x++) {
      const i = (y * A.w + x) * 4
      const dd = Math.abs(A.d[i] - B.d[i]) + Math.abs(A.d[i + 1] - B.d[i + 1]) + Math.abs(A.d[i + 2] - B.d[i + 2])
      if (dd > thresh) {
        n++
        sx += x
        sy += y
      }
    }
  }
  return { n, cx: n ? sx / n : NaN, cy: n ? sy / n : NaN }
}
/* Ink that is dark in `now` and was not dark in `before`: the stretch the pen
 * just drew. Independent of the glow code: it reads two frames with the glow off. */
function newInk(before, now, dark = 150) {
  let n = 0
  let sx = 0
  let sy = 0
  for (let y = 0; y < now.h; y++) {
    for (let x = 0; x < now.w; x++) {
      const i = (y * now.w + x) * 4
      if (lum(now.d, i) < dark && lum(before.d, i) >= dark) {
        n++
        sx += x
        sy += y
      }
    }
  }
  return { n, cx: n ? sx / n : NaN, cy: n ? sy / n : NaN }
}
const dist = (a, b) => Math.hypot(a.cx - b.cx, a.cy - b.cy)

/* ─── BASE PHASE: record main ───────────────────────────────────────────── */
if (PHASE === "base") {
  const out = { frames: {}, presets: {}, clock: {} }
  const page = await openPage()
  for (const mode of MODES) {
    await setMode(page, mode)
    for (const p of PLAYHEADS) out.frames[`${mode}@${p}`] = sha(await frame(page, p))
    out.clock[mode] = await clockOf(page)
  }
  await setMode(page, "rod")
  for (const id of SHIPPED_PRESETS) {
    await page.evaluate((id) => window.__styleHarness.selectMotionPreset(id), id)
    await settle(page, 800)
    await page.evaluate(() => window.__revealHarness.setPlaying(false))
    out.presets[id] = { frame: sha(await frame(page, 0.45)), clock: await clockOf(page) }
  }
  writeFileSync(BASE_FILE, J(out))
  console.log(`BASE written: ${BASE_FILE}, ${Object.keys(out.frames).length} frames, ${SHIPPED_PRESETS.length} presets, page errors ${errors.length}`)
  await browser.close()
  process.exit(errors.length ? 1 : 0)
}

/* ─── LANE PHASE ─────────────────────────────────────────────────────────── */
const base = JSON.parse(readFileSync(BASE_FILE, "utf8"))
const want = (name) => !ONLY || ONLY.includes(name)

/* Shared OFF row: every extra at its default, frames and clocks equal main's. */
async function offEqualsMain(page, label) {
  const bad = []
  for (const mode of MODES) {
    await setMode(page, mode)
    for (const p of PLAYHEADS) {
      const k = `${mode}@${p}`
      const h = sha(await frame(page, p))
      if (h !== base.frames[k]) bad.push(`${k} ${h} != ${base.frames[k]}`)
    }
    const c = await clockOf(page)
    if (J(c) !== J(base.clock[mode])) bad.push(`${mode} clock differs (total ${c.total} vs ${base.clock[mode].total})`)
  }
  await setMode(page, "rod")
  return { ok: bad.length === 0, detail: bad.length ? bad.slice(0, 4).join("; ") : `${MODES.length * PLAYHEADS.length} frames and ${MODES.length} clocks equal main` }
}

const sections = []

/* ═══ 1 · TIP HIGHLIGHT ═══════════════════════════════════════════════════ */
sections.push(["tip", async () => {
  const page = await openPage()
  const off = await offEqualsMain(page)
  row(off.ok, "TIP 1 OFF: tipHighlight 0 renders every frame and clock as main", off.detail)
  /* must-fail: the same comparison with the glow on has to see it */
  await page.evaluate(() => window.__styleHarness.setEnvelope({ tipHighlight: 1 }))
  const on = await offEqualsMain(page)
  mustFail("TIP 1 OFF compare, run with the glow on", on.ok, on.detail)
  await page.evaluate(() => window.__styleHarness.setEnvelope({ tipHighlight: 0 }))

  /* ON: a glow appears, and it sits on the stretch the pen just drew. The bar
   * is the glow's own radius, read off its changed pixels, so it scales with
   * the view. Graded at fill 1.0 (the form fits the view), closer than the
   * OFF frames, so a glow a few nib widths off the head is many pixels off. */
  await pinCamera(page, 1.0)
  const grade = async (p, knock) => {
    await page.evaluate((k) => { window.__FS_GATE_MUTATE = k }, knock)
    await page.evaluate(() => window.__styleHarness.setEnvelope({ tipHighlight: 0 }))
    const before = await pixels(await frame(page, p - 0.02))
    const offNow = await pixels(await frame(page, p))
    await page.evaluate(() => window.__styleHarness.setEnvelope({ tipHighlight: 1 }))
    const onNow = await pixels(await frame(page, p))
    const heads = await page.evaluate(() => window.__fsTipGlow.get())
    await page.evaluate(() => { window.__FS_GATE_MUTATE = undefined })
    await page.evaluate(() => window.__styleHarness.setEnvelope({ tipHighlight: 0 }))
    const d = diffStats(offNow, onNow)
    const ink = newInk(before, offNow)
    const gap = dist(d, ink)
    const R = Math.sqrt(d.n / Math.PI)
    const ok = d.n >= 40 && ink.n > 0 && gap <= R
    return { ok, detail: `glow ${d.n} px changed, centre (${d.cx.toFixed(0)}, ${d.cy.toFixed(0)}); new ink ${ink.n} px at (${ink.cx.toFixed(0)}, ${ink.cy.toFixed(0)}); ${gap.toFixed(1)} px apart, bar ${R.toFixed(1)} (the glow's radius); heads ${J(heads.heads)}` }
  }
  for (const p of [0.45, 0.7]) {
    const g = await grade(p, undefined)
    row(g.ok, `TIP 2 ON at ${p}: a glow shows, centred on the ink the pen just drew`, g.detail)
  }
  const atStart = await grade(0.7, "tip-at-start")
  mustFail("TIP 2 ON with the glow put at the stroke's first point (knockout tip-at-start)", atStart.ok, atStart.detail)
  const dark = await grade(0.7, "tip-dark")
  mustFail("TIP 2 ON with the glow drawn at 0 (knockout tip-dark)", dark.ok, dark.detail)

  await pinCamera(page)
  /* ON: it goes out when the stroke lands. No knockout arm for this row. */
  const offEnd = sha(await frame(page, 1))
  await page.evaluate(() => window.__styleHarness.setEnvelope({ tipHighlight: 1 }))
  const onEnd = sha(await frame(page, 1))
  const liveEnd = await page.evaluate(() => window.__fsTipGlow.get())
  await page.evaluate(() => window.__styleHarness.setEnvelope({ tipHighlight: 0 }))
  row(offEnd === onEnd && liveEnd.heads.length === 0, "TIP 3 ON at the end: the finished mark carries no glow (no must-fail arm)", `${offEnd} vs ${onEnd}, heads ${liveEnd.heads.length}`)

  /* The control: Customize under a draw-in preset lists it and the slider writes it. */
  await page.locator("button[aria-expanded]", { hasText: /^Preset/ }).first().click()
  await settle(page, 600)
  await page.locator("select").filter({ has: page.locator('option[value="geometryAnimation"]') }).first().selectOption("geometryAnimation")
  await settle(page, 500)
  await page.locator('button[data-preset-id="authenticDraw"]').first().click()
  await settle(page, 600)
  const slider = page.locator('[data-preset-customize] [data-field-keys="envelope.tipHighlight"] input[type=range]')
  const listed = await slider.count()
  let after = null
  if (listed) {
    await slider.focus()
    await page.keyboard.press("ArrowRight")
    await settle(page)
    after = await page.evaluate(() => window.__styleHarness.envelope().tipHighlight)
  }
  row(listed === 1 && after > 0, "TIP 4 CONTROL: Customize under Authentic Draw lists Tip highlight, and one step writes it", `listed ${listed}, tipHighlight after ArrowRight ${after}`)
  await page.context().close()
}])

/* ═══ 2 · PRESSURE-AWARE REVEAL ═══════════════════════════════════════════ */
/* The hero word with pressure that varies: each stroke light for its first half
 * of points (0.25), hard for the rest (0.95). The plain word is injected at a
 * constant 0.6, which is what a stroke with no pressure looks like to the reveal. */
const pressured = polys.map((poly) => poly.map((p, j) => ({ ...p, pressure: j < poly.length / 2 ? 0.25 : 0.95 })))
/* Per stroke: the share of the stroke's time spent reaching half its arc. */
async function halfShares(page) {
  const strokes = await page.evaluate(() => window.__fsClock.get().clocked)
  return strokes.map((pts) => {
    if (pts.length < 8) return null
    const cum = [0]
    for (let j = 1; j < pts.length; j++) cum.push(cum[j - 1] + Math.hypot(pts[j].x - pts[j - 1].x, pts[j].y - pts[j - 1].y))
    const half = cum[cum.length - 1] / 2
    let j = 1
    while (j < pts.length - 1 && cum[j] < half) j++
    const f = cum[j] > cum[j - 1] ? (half - cum[j - 1]) / (cum[j] - cum[j - 1]) : 0
    const tHalf = pts[j - 1].t + f * (pts[j].t - pts[j - 1].t)
    const t0 = pts[0].t
    const t1 = pts[pts.length - 1].t
    return { share: (tHalf - t0) / (t1 - t0), t0, t1 }
  })
}
sections.push(["pressure", async () => {
  const page = await openPage()
  await pinCamera(page)
  const off = await offEqualsMain(page)
  row(off.ok, "PRESSURE 1 OFF: pressureReveal 0 renders every frame and clock as main", off.detail)
  /* FALLBACK: at full strength, a word with no varying pressure is still main. */
  await page.evaluate(() => window.__styleHarness.setEnvelope({ pressureReveal: 1 }))
  const fb = await offEqualsMain(page)
  const same = await page.evaluate(() => window.__fsClock.get().sameRef)
  row(fb.ok && same, "PRESSURE 2 FALLBACK: at 1, a word with constant pressure renders and times as main, same arrays", `${fb.detail}; sameRef ${same}`)
  await page.evaluate(() => { window.__FS_GATE_MUTATE = "pressure-no-fallback" })
  await page.evaluate(() => window.__styleHarness.setEnvelope({ pressureReveal: 0.95 }))
  await page.evaluate(() => window.__styleHarness.setEnvelope({ pressureReveal: 1 }))
  const fbK = await offEqualsMain(page)
  const sameK = await page.evaluate(() => window.__fsClock.get().sameRef)
  await page.evaluate(() => { window.__FS_GATE_MUTATE = undefined })
  mustFail("PRESSURE 2 FALLBACK with the no-pressure early return knocked out (pressure-no-fallback)", fbK.ok && sameK, `${fbK.detail}; sameRef ${sameK}`)
  await page.context().close()

  /* ON: over a word that carries pressure, the light first half of each stroke
   * goes quicker, every stroke keeps its own start and end, and the frames move. */
  const pp = await openPage(pressured)
  await pinCamera(pp)
  const grade = async (knock) => {
    await pp.evaluate((k) => { window.__FS_GATE_MUTATE = k }, knock)
    await pp.evaluate(() => window.__styleHarness.setEnvelope({ pressureReveal: 0 }))
    await settle(pp, 600)
    const a = await halfShares(pp)
    const fa = [await frame(pp, 0.45), await frame(pp, 0.7), await frame(pp, 1)].map(sha)
    await pp.evaluate(() => window.__styleHarness.setEnvelope({ pressureReveal: 1 }))
    await settle(pp, 600)
    const b = await halfShares(pp)
    const fb2 = [await frame(pp, 0.45), await frame(pp, 0.7), await frame(pp, 1)].map(sha)
    await pp.evaluate(() => { window.__FS_GATE_MUTATE = undefined })
    await pp.evaluate(() => window.__styleHarness.setEnvelope({ pressureReveal: 0 }))
    let quicker = 0
    let graded = 0
    let endsKept = true
    let worst = -Infinity
    for (let i = 0; i < a.length; i++) {
      if (!a[i] || !b[i]) continue
      graded++
      const drop = a[i].share - b[i].share
      if (drop >= 0.1) quicker++
      worst = Math.max(worst, b[i].share - a[i].share)
      if (Math.abs(a[i].t0 - b[i].t0) > 1e-6 || Math.abs(a[i].t1 - b[i].t1) > 1e-6) endsKept = false
    }
    const moved = fa[0] !== fb2[0] || fa[1] !== fb2[1]
    const ok = graded > 0 && quicker === graded && endsKept && moved && fa[2] === fb2[2]
    const mean = (xs) => xs.filter(Boolean).reduce((s, x) => s + x.share, 0) / xs.filter(Boolean).length
    return { ok, detail: `${quicker} of ${graded} strokes reach half their arc at least 0.1 of their time sooner (mean share ${mean(a).toFixed(3)} off, ${mean(b).toFixed(3)} on); ends kept ${endsKept}; frames at 0.45/0.7 moved ${moved}; finished frame same ${fa[2] === fb2[2]}` }
  }
  const on = await grade(undefined)
  row(on.ok, "PRESSURE 3 ON: the light half of every stroke draws quicker, each stroke keeps its start and end, the frames move", on.detail)
  const inv = await grade("pressure-inverted")
  mustFail("PRESSURE 3 ON with the pressure read backwards (pressure-inverted)", inv.ok, inv.detail)

  /* The control. */
  await pp.locator("button[aria-expanded]", { hasText: /^Preset/ }).first().click()
  await settle(pp, 600)
  await pp.locator("select").filter({ has: pp.locator('option[value="geometryAnimation"]') }).first().selectOption("geometryAnimation")
  await settle(pp, 500)
  await pp.locator('button[data-preset-id="authenticDraw"]').first().click()
  await settle(pp, 600)
  const slider = pp.locator('[data-preset-customize] [data-field-keys="envelope.pressureReveal"] input[type=range]')
  const listed = await slider.count()
  let after = null
  if (listed) {
    await slider.focus()
    await pp.keyboard.press("ArrowRight")
    await settle(pp)
    after = await pp.evaluate(() => window.__styleHarness.envelope().pressureReveal)
  }
  row(listed === 1 && after > 0, "PRESSURE 4 CONTROL: Customize under Authentic Draw lists Pen pressure, and one step writes it", `listed ${listed}, pressureReveal after ArrowRight ${after}`)
  await pp.context().close()
}])

/* ═══ 3 · DURATION ════════════════════════════════════════════════════════ */
/* One real playback from the start, sampled in the page on rAF. The length is
 * read off the SLOPE of the playhead between 10% and 90% (a least-squares fit),
 * not off Play-to-end wall time: the first run showed Play itself costs 190 to
 * 250 ms before the playhead moves, on main's 13,116 ms take as much as on a
 * 2 s one, and that start-up is not the rate this row grades. Wall time is
 * still printed. The fit reads the UNEASED clock (`getClock`, the value the
 * ease is applied to), so an eased take is timed by its clock, not its curve. */
async function playOnce(page) {
  return page.evaluate(async () => {
    const h = window.__revealHarness
    h.setPlaying(false)
    h.setProgress(0)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    const t0 = performance.now()
    let frames = 0
    const xs = []
    const ys = []
    h.setPlaying(true)
    const ms = await new Promise((r) => {
      const tick = () => {
        frames++
        const now = performance.now()
        const p = h.getProgress()
        const c = h.getClock()
        if (c >= 0.1 && c <= 0.9) {
          xs.push(now)
          ys.push(c)
        }
        if (p >= 1 || now - t0 > 60000) r(now - t0)
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    h.setPlaying(false)
    const n = xs.length
    const mx = xs.reduce((a, b) => a + b, 0) / n
    const my = ys.reduce((a, b) => a + b, 0) / n
    let sxy = 0
    let sxx = 0
    for (let i = 0; i < n; i++) {
      sxy += (xs[i] - mx) * (ys[i] - my)
      sxx += (xs[i] - mx) ** 2
    }
    return { ms, frameMs: ms / Math.max(1, frames), fitMs: sxx > 0 && sxy > 0 ? sxx / sxy : NaN, samples: n }
  })
}
sections.push(["duration", async () => {
  const page = await openPage()
  const off = await offEqualsMain(page)
  row(off.ok, "DURATION 1 OFF: durationSeconds 0 renders every frame and clock as main", off.detail)
  await page.evaluate(() => window.__styleHarness.setEnvelope({ durationSeconds: 5 }))
  const on5 = await offEqualsMain(page)
  mustFail("DURATION 1 OFF compare, run with a 5 s duration", on5.ok, on5.detail)
  await page.evaluate(() => window.__styleHarness.setEnvelope({ durationSeconds: 0 }))

  const grade = async (sec, clock, knock) => {
    await page.evaluate((k) => { window.__FS_GATE_MUTATE = k }, knock)
    await page.evaluate(([s, c]) => { window.__styleHarness.setEnvelope({ clock: c }); window.__styleHarness.setEnvelope({ durationSeconds: s }) }, [sec, clock])
    await settle(page, 800)
    const c = await page.evaluate(() => { const g = window.__fsClock.get(); return { takePenMs: g.takePenMs, total: window.__revealHarness.getTotalDuration() } })
    const run = await playOnce(page)
    await page.evaluate(() => { window.__FS_GATE_MUTATE = undefined })
    await page.evaluate(() => { window.__styleHarness.setEnvelope({ durationSeconds: 0 }); window.__styleHarness.setEnvelope({ clock: "recorded" }) })
    await settle(page, 600)
    const want = sec * 1000
    const tol = 0.02 * want
    const ok = Math.abs(c.takePenMs - want) <= 0.5 && Math.abs(c.total - want) <= 0.5 && run.samples >= 8 && Math.abs(run.fitMs - want) <= tol
    return { ok, detail: `clock ${clock}: take ${c.takePenMs.toFixed(1)} ms, total ${c.total.toFixed(1)} ms, playhead slope says ${run.fitMs.toFixed(0)} ms over ${run.samples} frames (bar +/- ${tol.toFixed(0)}, 2%), Play-to-end wall ${run.ms.toFixed(0)} ms, want ${want}` }
  }
  for (const [sec, clock] of [[2, "recorded"], [7, "recorded"], [2, "hand"]]) {
    const g = await grade(sec, clock, undefined)
    row(g.ok, `DURATION 2 ON ${sec} s on the ${clock} clock: the take is ${sec} s and a real playback lasts ${sec} s`, g.detail)
  }
  const k = await grade(2, "recorded", "duration-ignored")
  mustFail("DURATION 2 ON with the duration dropped from the clock (duration-ignored)", k.ok, k.detail)

  /* The control, and the Speed pills it takes over. */
  await page.locator("button[aria-expanded]", { hasText: /^Preset/ }).first().click()
  await settle(page, 600)
  await page.locator("select").filter({ has: page.locator('option[value="geometryAnimation"]') }).first().selectOption("geometryAnimation")
  await settle(page, 500)
  await page.locator('button[data-preset-id="handDraw"]').first().click()
  await settle(page, 600)
  const slider = page.locator('[data-preset-customize] [data-field-keys="envelope.durationSeconds"] input[type=range]')
  const listed = await slider.count()
  let after = null
  let pillsOff = null
  if (listed) {
    await slider.focus()
    await page.keyboard.press("ArrowRight")
    await settle(page)
    after = await page.evaluate(() => window.__styleHarness.envelope().durationSeconds)
    pillsOff = await page.evaluate(() => [...document.querySelectorAll("[data-preset-customize] [data-rate]")].every((b) => b.disabled))
  }
  row(listed === 1 && after > 0 && pillsOff, "DURATION 3 CONTROL: Customize under Hand Draw lists Duration, one step writes it, and the Speed pills hold", `listed ${listed}, durationSeconds after ArrowRight ${after}, speed pills disabled ${pillsOff}`)
  await page.context().close()
}])

/* ═══ 4 · THE FIFTH REVEAL STYLE, PRESENTATION ════════════════════════════ */
async function presetRecord(page, id) {
  await page.evaluate((id) => window.__styleHarness.selectMotionPreset(id), id)
  await settle(page, 800)
  await page.evaluate(() => window.__revealHarness.setPlaying(false))
  return { frame: sha(await frame(page, 0.45)), clock: await clockOf(page) }
}
sections.push(["presentation", async () => {
  const page = await openPage()
  await setMode(page, "rod")
  /* OFF: the six shipped presets, in the base phase's order, each equal to main. */
  const bad = []
  for (const id of SHIPPED_PRESETS) {
    const r = await presetRecord(page, id)
    if (r.frame !== base.presets[id].frame) bad.push(`${id} frame ${r.frame} != ${base.presets[id].frame}`)
    if (J(r.clock) !== J(base.presets[id].clock)) bad.push(`${id} clock ${r.clock.total} vs ${base.presets[id].clock.total}`)
  }
  row(bad.length === 0, "PRESENTATION 1 OFF: each of the six shipped draw-in presets plays as main (frame at 0.45, clock)", bad.join("; ") || `${SHIPPED_PRESETS.length} of ${SHIPPED_PRESETS.length} equal`)
  const pres = await presetRecord(page, "presentationDraw")
  const asAuthentic = pres.frame === base.presets.authenticDraw.frame && J(pres.clock) === J(base.presets.authenticDraw.clock)
  mustFail("PRESENTATION 1 OFF compare, Presentation held to Authentic Draw's main record", asAuthentic, `frame ${pres.frame} vs ${base.presets.authenticDraw.frame}, clock ${pres.clock.total} vs ${base.presets.authenticDraw.clock.total}`)

  /* ON: what its description claims. Four seconds, eased both ends, a light on the pen. */
  const claim = async (id) => {
    await presetRecord(page, id)
    const env = await page.evaluate(() => window.__styleHarness.envelope())
    const c = await clockOf(page)
    await frame(page, 0.45)
    const glow = await page.evaluate(() => window.__fsTipGlow?.get() ?? { on: false, heads: [] })
    const run = await playOnce(page)
    const ok =
      Math.abs(c.total - 4000) <= 0.5 &&
      Math.abs(run.fitMs - 4000) <= 0.02 * 4000 &&
      env.ease === "inOut" &&
      glow.on && glow.heads.length > 0
    return { ok, detail: `total ${c.total.toFixed(1)} ms, playback clock slope ${run.fitMs.toFixed(0)} ms, ease ${J(env.ease)}, tip ${env.tipHighlight} with ${glow.heads.length} heads at 0.45` }
  }
  const on = await claim("presentationDraw")
  row(on.ok, "PRESENTATION 2 ON: picked, the take is 4 s, eased both ends, and the tip is lit at 0.45", on.detail)
  const other = await claim("smoothReveal")
  mustFail("PRESENTATION 2 ON, the same claim held to Smooth Reveal", other.ok, other.detail)

  /* On the rail beside the others, and Customize lists every field it sets. */
  await page.locator("button[aria-expanded]", { hasText: /^Preset/ }).first().click()
  await settle(page, 600)
  await page.locator("select").filter({ has: page.locator('option[value="geometryAnimation"]') }).first().selectOption("geometryAnimation")
  await settle(page, 500)
  const pill = page.locator('button[data-preset-id="presentationDraw"]').first()
  const onRail = await pill.count()
  let listed = []
  if (onRail) {
    await pill.click()
    await settle(page, 600)
    listed = await page.evaluate(() => [...document.querySelectorAll("[data-preset-customize] [data-field-keys]")].flatMap((n) => n.dataset.fieldKeys.split(" ")))
  }
  const extras = ["envelope.tipHighlight", "envelope.pressureReveal", "envelope.durationSeconds"]
  row(onRail === 1 && extras.every((k) => listed.includes(k)), "PRESENTATION 3 CONTROL: on the rail, and its Customize lists the draw-in extras", `on rail ${onRail}, ${listed.length} fields listed, extras ${extras.filter((k) => listed.includes(k)).length} of ${extras.length}`)
  await page.context().close()
}])

for (const [name, run] of sections) if (want(name)) await run()

row(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "))
console.log(`\n${pass} PASS  ${fail} FAIL`)
await browser.close()
process.exit(fail ? 1 : 0)
