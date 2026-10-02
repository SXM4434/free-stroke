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
//
// STATUS ON cloud/drawin (2026-10-02): NOT RUN. Written and run for the
// 52982e8 snapshot by the earlier DRAWIN-EXTRAS lane, ported here unrun: this
// lane had no browser. The Node rows are assert-drawin-extras-node.mjs.

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

for (const [name, run] of sections) if (want(name)) await run()

row(errors.length === 0, "no page errors", errors.slice(0, 3).join(" | "))
console.log(`\n${pass} PASS  ${fail} FAIL`)
await browser.close()
process.exit(fail ? 1 : 0)
