#!/usr/bin/env node
// CLOUD-REFIT · THE CAMERA IS FRAMED ONCE THE CANVAS HAS SETTLED, SO EVERY LOAD FRAMES THE SAME.
//
// app/page.tsx refits the camera after the last stroke (`orbitView(45, 35.264, 1.7)`). The camera is
// orthographic, so the refit's zoom is the canvas's half-height over the framed half-height
// (`applyFraming` in components/viewport-3d.tsx), read at the moment of the refit and kept through every
// later resize (F123). The refit ran on a fixed 450 ms timer. At 834x1112 the stacked 3D canvas was still
// growing (188 to 217.72 px tall, about 700 ms), so the timer read whichever height it landed on and the
// at-load zoom changed from load to load: 34.78, 34.68, 33.92, 33.92 (assert-dock-shell, FRAMES AT LOAD).
// The fix waits for the geometry as before, then for a ResizeObserver on the canvas to report no change
// for 6 animation frames in a row, and refits ONCE.
//
// THE GROWTH IS DRIVEN, AND WHY. On this tree, headless, the 3D canvas has its size about 2 s before the
// refit could read it (measured: sized 210 to 230 ms after the strokes land; then the first build blocks
// the main thread about 1.9 s; the overdue 450 ms timer and the viewport's first framing both run as it
// ends), so a plain load cannot reach the race and both arms would read green. Each load therefore grows
// the 3D canvas the way main's stacked canvas grew: a stylesheet set before navigation mounts R3F's
// wrapper SHORT_PX[k] px short (30, 25, 20, 15, 10, 5: a different growth step per load, as on main), and
// from the moment the WebGL context is made the wrapper opens back to full height linearly over 700 ms,
// frame by frame. Under the fixed timer the refit reads the height R3F had applied when the timer ran.

// ROW (per size, 834x1112 the stacked layout and 1512x982 the docked one, 6 loads each, fresh context):
//   REFIT  every load ends on the identical camera zoom AND the identical 3D frame hash (logo, still
//          style, reveal 1, `__captureHarness.grab()`), every load's refit ran exactly once (zoom writes
//          through `apiOrbitView`; more than one is a refit per resize), and on the fix arm every refit
//          ran after the growth had ended.
//   CONTROLS (per size, first load of the fix arm): the grab sees the scene (reveal 0.5 hashes differently
//          from reveal 1); the growth really happened (the canvas ended at its tallest, 30 px taller than
//          its shortest).
//
// MUST-FAIL: `window.__fsRefitTimer = "fixed"`, set before navigation, parks the fixed 450 ms timer in
// page.tsx. REFIT must go red on it at both sizes (the zoom differs between loads). The gate exits 0 only
// when the fix arm is green at both sizes, the must-fail arm is red at both, and every control holds.
//
// Writes nothing to disk. CORPUS: `/` at dpr 1, headless, the default workspace of a fresh profile. It does
// not see dpr 2, a growth with a pause longer than 6 frames, or a refit after the user's own edits.
//
// FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-refit-settles.mjs [--arm=fix|fixed] [--size=834x1112]
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")

const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }
const SIZE = (process.argv.find((a) => a.startsWith("--size=")) ?? "").slice(7)
const SIZES = [[834, 1112], [1512, 982]].filter(([w, h]) => !SIZE || SIZE === `${w}x${h}`)
const ARM = (process.argv.find((a) => a.startsWith("--arm=")) ?? "").slice(6)
const ARMS = ["fix", "fixed"].filter((a) => !ARM || ARM === a)
const LOADS = 6
const SHORT_PX = [30, 25, 20, 15, 10, 5]
const GROW_MS = 700
const sha = (u) => createHash("sha256").update(Buffer.from(u.split(",")[1], "base64")).digest("hex").slice(0, 16)

const browser = await chromium.launch()
let pass = 0, fail = 0
const verdicts = []
const say = (ok, row, detail) => {
  ok ? pass++ : fail++
  console.log(`${ok ? "PASS" : "FAIL"}  ${row} ${detail}`)
  return ok
}

async function load([w, h], arm, short, control) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  await page.addInitScript(([arm, short, GROW_MS]) => {
    if (arm === "fixed") window.__fsRefitTimer = "fixed"
    const P = (window.__refitProbe = { refits: [], heights: [], growStart: null, growEnd: null })
    // R3F's wrapper is <div style="position:relative;width:100%;height:100%"><div><canvas>; the rule is in
    // place before the canvas mounts, so R3F's first measurement is already short.
    const css = document.createElement("style")
    const rule = (px) => `[data-dock-panel="view3d"] div:has(> div > canvas){height:calc(100% - ${px}px)!important}`
    css.textContent = rule(short)
    // Added once the document exists; the 3D canvas mounts long after that, once strokes land.
    if (document.documentElement) document.documentElement.appendChild(css)
    else document.addEventListener("DOMContentLoaded", () => document.head.appendChild(css), { once: true })
    const orig = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (type, ...a) {
      const c = orig.call(this, type, ...a)
      if (!c || !/webgl/.test(type) || P.canvas) return c
      const cv = (P.canvas = this)
      new ResizeObserver(() => {
        const r = cv.getBoundingClientRect(), z = P.heights
        if (r.height > 0 && z[z.length - 1] !== r.height) z.push(r.height)
      }).observe(cv)
      // The growth, from the moment the context is made: linear in wall time over GROW_MS, one step a frame.
      P.growStart = performance.now()
      const step = () => {
        const k = Math.min(1, (performance.now() - P.growStart) / GROW_MS)
        css.textContent = k < 1 ? rule((short * (1 - k)).toFixed(3)) : ""
        if (k < 1) requestAnimationFrame(step)
        else P.growEnd = performance.now()
      }
      requestAnimationFrame(step)
      // The zoom setter, wrapped once the controls are reachable through the fiber (as assert-dock-shell
      // does). Writes made through `apiOrbitView` are the page's refits.
      const tick = () => {
        let f = cv[Object.keys(cv).find((k) => k.startsWith("__reactFiber$"))], ctl = null
        const hit = (p) => { if (!p) return null; if (p.controlsRef) return p.controlsRef; for (const x of [].concat(p.children)) if (x?.props?.controlsRef) return x.props.controlsRef; return null }
        while (f && !ctl) { ctl = hit(f.memoizedProps); f = f.return }
        const cam = ctl?.current?.object
        if (!cam || !cam.isOrthographicCamera) return requestAnimationFrame(tick)
        P.cam = cam
        let z = cam.zoom
        Object.defineProperty(cam, "zoom", {
          configurable: true,
          get: () => z,
          set: (v) => {
            if (v !== z && /apiOrbitView/.test(new Error().stack ?? "")) P.refits.push({ t: performance.now(), top: cam.top, zoom: v })
            z = v
          },
        })
      }
      requestAnimationFrame(tick)
      return c
    }
  }, [arm, short, GROW_MS])
  page.on("pageerror", (e) => console.log(`  pageerror ${arm}: ${e.message.slice(0, 160)}`))
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  // Settled: the growth ended, a refit ran, and 1.5 s more.
  await page.waitForFunction(() => window.__refitProbe.growEnd !== null && window.__refitProbe.refits.length > 0, null, { timeout: 60000, polling: 100 }).catch(() => {})
  await page.waitForTimeout(1500)
  await page.evaluate((st) => { window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) }, STILL)
  const raf2 = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  await page.waitForTimeout(1500); await raf2()
  const frame = sha(await page.evaluate(() => window.__captureHarness.grab()))
  const probe = await page.evaluate(() => {
    const P = window.__refitProbe
    return { zoom: P.cam?.zoom ?? null, top: P.cam?.top ?? null, refits: P.refits.map((r) => ({ ...r, t: r.t - P.growStart })), growStart: P.growStart, growMs: P.growEnd && P.growStart ? P.growEnd - P.growStart : null, heights: P.heights.slice() }
  })
  let ctl = null
  if (control) {
    await page.evaluate(() => window.__revealHarness.setProgress(0.5)); await page.waitForTimeout(800); await raf2()
    ctl = { half: sha(await page.evaluate(() => window.__captureHarness.grab())) }
  }
  await ctx.close()
  return { frame, ...probe, ctl }
}

try {
  for (const size of SIZES) {
    const tag = `${size[0]}x${size[1]}`
    for (const arm of ARMS) {
      const runs = []
      for (let k = 0; k < LOADS; k++) {
        const r = await load(size, arm, SHORT_PX[k], arm === ARMS[0] && k === 0)
        runs.push(r)
        const rf = r.refits.map((x) => `${x.t.toFixed(0)} ms into the growth at top ${x.top}`).join(", ") || "none"
        console.log(`  ${tag} [${arm}] load ${k + 1} mounted ${SHORT_PX[k]} px short: zoom ${r.zoom}, frame ${r.frame}, refits ${r.refits.length} (${rf}), growth ${r.growMs?.toFixed(0) ?? "none"} ms, heights ${r.heights.length} (${r.heights.join(" > ")})`)
        if (r.ctl) {
          verdicts.push(say(r.ctl.half !== r.frame, `CONTROL ${tag} [${arm}]`, `the grab sees the scene: reveal 0.5 ${r.ctl.half} vs reveal 1 ${r.frame}`))
          const lo = Math.min(...r.heights), hi = Math.max(...r.heights), end = r.heights[r.heights.length - 1]
          const grew = r.heights.length > 1 && end === hi && Math.abs(hi - lo - SHORT_PX[0]) < 1
          verdicts.push(say(grew, `CONTROL ${tag} [${arm}]`, `the canvas grew: ${r.heights.length} heights, ${lo} to ${hi} px, ending at ${end}`))
        }
      }
      const zooms = [...new Set(runs.map((r) => r.zoom))]
      const frames = [...new Set(runs.map((r) => r.frame))]
      const once = runs.every((r) => r.refits.length === 1)
      // BLIND: a load whose probe saw no refit or no growth measured nothing, on either arm. A blind
      // must-fail arm is never counted as fired.
      const blind = runs.filter((r) => r.refits.length === 0 || r.growMs === null || r.heights.length < 2).length
      const after = arm === "fix" ? runs.every((r) => r.refits.length === 1 && r.growMs !== null && r.refits[0].t >= r.growMs) : true
      const ok = zooms.length === 1 && zooms[0] !== null && frames.length === 1 && once && after
      say(ok, `REFIT ${tag} [${arm}]`,
        `${LOADS} loads: ${zooms.length} zoom value(s) (${zooms.join(", ")}), ${frames.length} frame hash(es) (${frames.join(", ")}), refits per load ${runs.map((r) => r.refits.length).join("/")}` +
        (arm === "fix" ? `, every refit after the growth ended: ${after}` : ""))
      const held = blind === 0 && (arm === "fix" ? ok : !ok)
      verdicts.push(held)
      console.log(blind ? `BLIND   REFIT ${tag} [${arm}] ${blind} of ${LOADS} loads measured nothing (no refit, no growth or no canvas heights)`
        : `${arm === "fix" ? (ok ? "GRADED" : "BROKEN") : ok ? "BROKEN" : "FIRED "}  REFIT ${tag} ${arm === "fix" ? "green with the fix" : "must-fail (fixed 450 ms timer) " + (ok ? "did NOT go red" : "went red")}`)
    }
  }
} finally {
  await browser.close()
}
const graded = verdicts.filter(Boolean).length
console.log(`\n${graded}/${verdicts.length} verdicts hold (fix arm green and must-fail red per size, controls); rows ${pass} PASS ${fail} FAIL`)
process.exit(graded === verdicts.length && verdicts.length > 0 ? 0 : 1)
