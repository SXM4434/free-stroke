// measure-hand-tip-creep.mjs · HAND-DRAW-P3, 2026-09-30
//
// Plan §4, "Inflate's shader holds": the hold uniforms (uFsTipHold) are fed
// only from performed rows, and the plan says they stay empty under the hand
// clock with no performed rows. This MEASURES whether Inflate's tip creeps in
// the hand clock's slowest moments, the pen lifts, where the reveal should
// stand still: frames across each lift of 50 ms or more (PERFORMED_HOLD_MIN_MS)
// against the frame at the lift's start. A creeping tip changes pixels there.
//
// Two paths: no rows (the shipped reveal, the tip reads the beat), and a timed
// take (one row, +1 ms on the last stroke, which moves nothing else; the tip
// reads take time, which runs on through a lift). Positive control on
// each: the same frame span inside a stroke must change pixels.
//
//   FS_HEADED=0 FS_PORT=3138 node scripts/verify/measure-hand-tip-creep.mjs
//
// Measured 2026-09-30 on the logo, headless: no rows 0 px in all 10 lifts;
// timed 5 to 61 px in every lift. Point holds at the pen took the worst to
// 13 px (single pixels where strokes cross), so the viewport now holds the
// whole tip at each lift's start under a timed take: 0 px in all 10. The row
// that keeps it is `assert-hand-clock` R13, must-fail `tip-no-liftholds`.
//
// A measurement, not a gate: exit 0 when it ran, 1 when a control did not fire.
import { readFileSync } from "node:fs"
import sharp from "sharp"
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const HOLD_MIN_MS = 50

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const settle = async (ms = 250) => { await page.waitForTimeout(ms); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__fsTake && window.__fsClock, null, { timeout: 240000 })
await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys); await settle(1500)
await page.evaluate(() => window.__revealHarness.setPlaying(false))
await page.evaluate(() => window.__styleHarness.selectMotionPreset("handDraw")); await settle(800)
await page.evaluate(() => { window.__styleHarness.setMode("inflate"); window.__styleHarness.setInflate({ fusion: "auto" }) }); await settle(2500)
const rect = await page.evaluate(() => { const c = [...document.querySelectorAll("canvas")].filter((x) => x.getContext("2d") === null).sort((a, b) => b.width * b.height - a.width * a.height)[0]; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })
const cl = await page.evaluate(() => window.__fsClock.get())
const lifts = []
for (let i = 0; i + 1 < cl.clocked.length; i++) {
  const a = cl.clocked[i], b = cl.clocked[i + 1]
  const t0 = a[a.length - 1].t, t1 = b[0].t
  if (t1 - t0 >= HOLD_MIN_MS) lifts.push({ after: i, t0, t1 })
}
const frame = async (ms) => {
  const total = await page.evaluate(() => window.__revealHarness.getTotalDuration())
  await page.evaluate((p) => window.__revealHarness.setProgress(p), ms / total); await settle(200)
  const png = await page.screenshot({ clip: rect })
  return sharp(png).raw().toBuffer()
}
const diff = (A, B) => { let n = 0; for (let k = 0; k < A.length; k += 3) if (A[k] !== B[k] || A[k + 1] !== B[k + 1] || A[k + 2] !== B[k + 2]) n++; return n }
async function measure(tag) {
  const tip = await page.evaluate(() => ({ holdN: window.__heroPenTip?.holds?.length ?? null, timed: !!window.__fsTake.get().timed }))
  const out = []
  for (const L of lifts) {
    // From 2 ms after the lift starts to 2 ms before it lands, five frames.
    const a = L.t0 + 2, b = L.t1 - 2, ref = await frame(a)
    let worst = 0
    for (let k = 1; k <= 4; k++) worst = Math.max(worst, diff(ref, await frame(a + ((b - a) * k) / 4)))
    // Control: the same span inside the stroke before the lift.
    const s0 = cl.clocked[L.after][0].t, span = b - a, c0 = Math.max(s0, L.t0 - span - 2)
    const ctl = diff(await frame(c0), await frame(c0 + span))
    out.push({ after: L.after, ms: +(L.t1 - L.t0).toFixed(1), creepPx: worst, controlPx: ctl })
  }
  console.log(`${tag}: timed ${tip.timed}, shader holds ${tip.holdN}`)
  for (const r of out) console.log(`  lift after stroke ${r.after}, ${r.ms} ms: ${r.creepPx} px change across the lift; control, the same span inside the stroke: ${r.controlPx} px`)
  return out
}
const shipped = await measure("no rows (shipped path)")
const n = cl.clocked.length
await page.evaluate((i) => window.__fsTake.set({ [i]: { delayMs: 1, speed: 1, ease: { kind: "preset", id: "linear" }, holdBack: false } }), n - 1); await settle(1500)
const timed = await measure("timed take (+1 ms on the last stroke)")
await browser.close()
const all = [...shipped, ...timed]
const controlsFired = all.every((r) => r.controlPx > 0)
console.log(`\n${lifts.length} lifts of ${HOLD_MIN_MS} ms or more; creep, worst px: shipped ${Math.max(...shipped.map((r) => r.creepPx))}, timed ${Math.max(...timed.map((r) => r.creepPx))}; controls fired ${all.filter((r) => r.controlPx > 0).length} of ${all.length}`)
process.exit(controlsFired ? 0 : 1)
