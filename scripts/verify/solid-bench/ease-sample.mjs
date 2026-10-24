// solid-bench/ease-sample.mjs · WHICH NO-ROWS INSTANT DOES SOLID'S EASE FRAME DRAW? (ANIM-1C4)
//
//   FS_PORT=3139 node scripts/verify/solid-bench/ease-sample.mjs [--engine=solid] [--te=6512.76] [--tb=5967.5]
//
// `assert-stroke-timing-browser.mjs` row 4 read solid 0.072 where 0.101 was wanted at u 0.4. The
// want is g(inAt(T)), a NO-ROWS frame at base time tb; the got is an ease-"in" frame at take
// time te. If the product maps te to tb, the two frames are the same pixels. This grabs the ease
// frame, then no-rows frames across tb ± 60 ms, and prints how many pixels each differs by. It
// also re-grabs every frame after a further 1.5 s, so a frame read before Solid's rebuild landed
// shows as a frame that changed while nothing moved. A diagnostic; it grades nothing.
import { chromium } from "../lib/browser.mjs"
import { LAB_URL } from "../lib/dev-server.mjs"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..")
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=")[1]
const ENGINE = arg("engine", "solid")
const TE = Number(arg("te", 6512.76))
const TB = Number(arg("tb", 5967.5))
const SETTLE = Number(arg("settle", 280))
/* Stroke K's screen box (x0,y0,x1,y1), as the gate's R0 prints it; a diff is split inside and outside it. */
const BOX = arg("box", "337,343,379,408").split(",").map(Number)
const K = 5
const NEUTRAL = { delayMs: 0, speed: 1, holdBack: false, ease: { kind: "preset", id: "linear" } }
const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines

const browser = await chromium.launch()
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })).newPage()
  const settle = async (ms) => {
    await page.waitForTimeout(ms)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  }
  const seek = async (p) => (await page.evaluate((x) => window.__revealHarness.setProgress(x), Math.max(0, Math.min(1, p))), settle(SETTLE))
  const grab = () => page.evaluate(() => window.__captureHarness.grab())
  const pixels = async (u) => {
    const im = await loadImage(Buffer.from(u.split(",")[1], "base64"))
    const c = createCanvas(im.width, im.height)
    c.getContext("2d").drawImage(im, 0, 0)
    W = im.width
    return c.getContext("2d").getImageData(0, 0, im.width, im.height).data
  }
  let W = 0
  const diff = (a, b, split = false) => {
    let n = 0
    let inBox = 0
    for (let i = 0; i < a.length; i += 4)
      if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) {
        n++
        const x = (i >> 2) % W, y = Math.floor((i >> 2) / W)
        if (x >= BOX[0] && x <= BOX[2] && y >= BOX[1] && y <= BOX[3]) inBox++
      }
    return split ? `${n} px (${inBox} inside stroke ${K}'s box, ${n - inBox} outside)` : n
  }
  const take = async (rows) => {
    await page.evaluate((r) => (r ? window.__fsTake.set(r, { ripple: false }) : window.__fsTake.clear()) && window.__fsTake.knockout(null), rows)
    await page.waitForTimeout(1500)
    return page.evaluate(() => window.__fsTake.get())
  }
  /* A frame at `ms`, and the same frame after 1.5 s more with nothing moved. */
  const shot = async (ms, dur) => {
    await seek(ms / dur)
    const a = await pixels(await grab())
    await settle(1500)
    const b = await pixels(await grab())
    return { a, late: diff(a, b) }
  }

  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness && window.__fsTake, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate(() => (window.__revealHarness.setEase("linear"), window.__revealHarness.setPlaying(false)))
  await page.evaluate((m) => window.__styleHarness.setMode(m), ENGINE)
  await page.waitForTimeout(2500)

  const g0 = await take(null)
  const pen = g0.totalDuration
  const tE = await take({ [K]: { ...NEUTRAL, ease: { kind: "preset", id: "in" } } })
  console.log(`${ENGINE}: pen ${pen} ms, ease takeMs ${tE.takeMs}, timed ${tE.timed}; settle ${SETTLE} ms`)
  const E = await shot(TE, tE.takeMs)
  const E2 = await shot(TE, tE.takeMs)
  console.log(`ease frame at take ${TE} ms: changed ${E.late} px after 1.5 s more; a second seek to it differs by ${diff(E.a, E2.a)} px`)
  await take(null)
  let best = null
  for (const dt of (arg("dts", "-60,-40,-20,-10,0,10,20,40") ).split(",").map(Number)) {
    const B = await shot(TB + dt, pen)
    const n = diff(E.a, B.a)
    if (!best || n < best.n) best = { dt, n }
    console.log(`  no rows at ${(TB + dt).toFixed(1)} ms (tb ${dt >= 0 ? "+" : ""}${dt}): differs from the ease frame by ${diff(E.a, B.a, true)}, changed ${B.late} px after 1.5 s more`)
  }
  console.log(`closest no-rows instant: tb ${best.dt >= 0 ? "+" : ""}${best.dt} ms (${best.n} px)`)
} finally {
  await browser.close()
}
