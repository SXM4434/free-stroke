#!/usr/bin/env node
// F122 resize drift probe, adapted from ANIM-4D's `_probe-customize-drift.mjs`
// (lane/presets) to main, which has no Customize panel.
//
// The question: after the GL canvas changes size, is the first frame drawn at
// the new size the SAME frame a later Viewport3D render settles on? Main opens
// the Preset popover, which shrinks the canvas (755x890 to 755x449 at
// 1512x982). With every animation flag off and motionMode "off", it grabs
//   A1  the first frame after the canvas buffer reports its new size
//   A2  two rAFs later
//   A3  600 ms later
// then forces a Viewport3D render with `setStyle({})` and grabs B. A1, A2, A3
// must equal B. It prints the camera state (read off the live camera through
// the React fiber, so the page needs no new hook) at each step, so the stale
// value is named, not guessed. A positive control proves the differ can see.
//
// Arms: `--window` resizes the viewport instead of opening the panel.
// FS_PORT=3139 FS_HEADED=0 node scripts/verify/_probe-resize-drift.mjs [--window]
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")

const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }
const sha = (x) => createHash("sha256").update(x).digest("hex").slice(0, 16)
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const WINDOW = process.argv.includes("--window")
const OUT = process.env.DRIFT_OUT

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })).newPage()
const raf2 = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
const settle = async (ms) => { await page.waitForTimeout(ms); await raf2() }
const still = () => page.evaluate((st) => { window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) }, STILL)
const raw = () => page.evaluate(() => window.__captureHarness.grab())
const size = () => page.evaluate(() => { const i = window.__captureHarness.grabInfo(); return `${i.width}x${i.height}` })
// The live camera, reached through React's fiber on the canvas element: the
// <Canvas> element's child <Scene> carries `controlsRef`, whose `.object` is
// the camera R3F renders with. No hook is added to the page for this.
const cam = () => page.evaluate(() => {
  const c = document.querySelector("canvas[data-engine]") || [...document.querySelectorAll("canvas")].find((x) => x.width > 300)
  const key = Object.keys(c).find((k) => k.startsWith("__reactFiber$"))
  let f = c[key], ctl = null
  let sceneProps = null
  const hit = (p) => { if (!p) return null; if (p.controlsRef) { sceneProps = p; return p.controlsRef } const ch = Array.isArray(p.children) ? p.children : [p.children]; for (const x of ch) if (x?.props?.controlsRef) { sceneProps = x.props; return x.props.controlsRef } return null }
  while (f && !ctl) { ctl = hit(f.memoizedProps); f = f.return }
  const o = ctl?.current?.object
  if (!o) return { error: "camera not reachable through the fiber" }
  const r = (v) => window.__driftDeep ? v : Math.round(v * 1e4) / 1e4
  const st = o.__r3f?.root?.getState?.() ?? ctl.current?.__r3f?.root?.getState?.()
  window.__driftStore = o.__r3f?.root ?? ctl.current?.__r3f?.root ?? null
  let objs = null
  if (st && window.__driftDeep) {
    objs = {}
    st.scene.traverse((x) => { const m = x.matrixWorld.elements.map(r).join(","); objs[`${x.type}:${x.name || x.userData?.fsChrome || ""}:${x.id}`] = { m, vis: x.visible } })
    objs.__size = JSON.stringify(st.size); objs.__vp = JSON.stringify({ w: st.viewport.width, h: st.viewport.height, dpr: st.viewport.dpr, f: st.viewport.factor })
    const v4 = { copy(o) { this.v = [o.x, o.y, o.z, o.w]; return this } }
    st.gl.getViewport(v4); objs.__glvp = JSON.stringify(v4.v); objs.__pr = st.gl.getPixelRatio()
    objs.__cam = st.camera === o ? "same camera" : "DIFFERENT camera"
  }
  let vpCur = null, vpGL = null
  if (st) {
    const v4 = { copy(o) { this.v = [o.x, o.y, o.z, o.w]; return this } }
    st.gl.getCurrentViewport(v4); vpCur = v4.v.join(",")
    const ctx = st.gl.getContext(); vpGL = [...ctx.getParameter(ctx.VIEWPORT)].join(",")
  }
  // The stroke-to-world inputs as Viewport3D last rendered them, and the window they come from.
  const strokeScale = sceneProps ? `${sceneProps.canvasWidth}x${sceneProps.canvasHeight}` : "?"
  return { vpCur, vpGL, cssW: st?.size.width, strokeScale, win: `${innerWidth}x${innerHeight}`, r3f: !!st, objs, pm: [...o.projectionMatrix.elements].map(r).join(","), mw: [...o.matrixWorld.elements].map(r).join(","), mwi: [...o.matrixWorldInverse.elements].map(r).join(","), tgt: ctl.current.target?.toArray().map(r), buf: `${c.width}x${c.height}`, left: r(o.left), right: r(o.right), top: r(o.top), bottom: r(o.bottom), zoom: r(o.zoom), aspect: o.aspect, p0: r(o.projectionMatrix.elements[0]), p5: r(o.projectionMatrix.elements[5]), halfH: r(o.top / o.zoom), pos: o.position.toArray().map(r) }
})
const diff = (a, b) => page.evaluate(async ([a, b]) => {
  const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u })
  const [ia, ib] = await Promise.all([load(a), load(b)])
  if (ia.width !== ib.width || ia.height !== ib.height) return { w: ia.width, h: ia.height, n: -1, max: -1, bbox: null, sizes: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` }
  const px = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data }
  const da = px(ia), db = px(ib)
  let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
  for (let k = 0; k < da.length; k += 4) {
    const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]), Math.abs(da[k + 3] - db[k + 3]))
    if (d) { n++; max = Math.max(max, d); const p = k / 4, x = p % ia.width, y = (p / ia.width) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  }
  return { w: ia.width, h: ia.height, n, max, bbox: n ? [x0, y0, x1, y1] : null }
}, [a, b])
const fmt = (d) => d.n < 0 ? `SIZE MISMATCH ${d.sizes}` : `${d.n} px differ of ${d.w}x${d.h}, max ${d.max}, bbox ${JSON.stringify(d.bbox)}`

try {
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
  if (process.argv.includes("--deep")) await page.evaluate(() => { window.__driftDeep = true })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await still(); await settle(800)
  const s0 = await raw(); await settle(400); const s1 = await raw()
  console.log(`before resize ${await size()}: two grabs ${fmt(await diff(s0, s1))}`)
  console.log(`  camera: ${JSON.stringify(await cam())}`)
  await page.evaluate(() => window.__styleHarness.setStyle({ ditherEnabled: true, ditherScale: 7 }))
  await settle(600)
  const pc = await diff(s1, await raw())
  console.log(`${pc.n > 0 ? "PASS " : "FAIL "} positive control: dither on moves ${pc.n} px`)
  await page.evaluate(() => window.__styleHarness.undo())
  await still(); await settle(800)

  const before = await size()
  if (WINDOW) await page.setViewportSize({ width: 1400, height: 900 })
  else await page.locator("button[aria-expanded]", { hasText: /^Preset/ }).first().click()
  // First frame at the new buffer size: poll once per rAF until the size moves.
  const t0 = Date.now()
  await page.waitForFunction((b) => { const i = window.__captureHarness.grabInfo(); return `${i.width}x${i.height}` !== b }, before, { polling: "raf", timeout: 10000 })
  await raf2()
  const a1 = await raw(); const c1 = await cam()
  await raf2(); const a2 = await raw()
  await settle(600); const a3 = await raw(); const c3 = await cam()
  console.log(`resize ${WINDOW ? "window 1512x982 -> 1400x900" : "Preset panel open"}: ${before} -> ${await size()} after ${Date.now() - t0} ms`)
  const brief = (c) => JSON.stringify({ ...c, objs: undefined, pm: undefined, mw: undefined, mwi: undefined })
  console.log(`  camera A1: ${brief(c1)}`)
  console.log(`  camera A3: ${brief(c3)}`)
  if (process.argv.includes("--why")) {
    // Is R3F drawing at all while the frame sits wrong? gl.info.render.frame
    // counts render calls. Then draw once by hand with the live state.
    await cam()
    console.log(`  store reachable: ${await page.evaluate(() => !!window.__driftStore)}`)
    const fr = () => page.evaluate(() => window.__driftStore.getState().gl.info.render.frame)
    const f0 = await fr(); await page.waitForTimeout(500); const f1 = await fr()
    console.log(`  render calls in 500 ms while wrong: ${f1 - f0}; frameloop ${await page.evaluate(() => window.__driftStore.getState().frameloop)}`)
    const wrong = await raw()
    await page.evaluate(() => { const s = window.__driftStore.getState(); s.gl.render(s.scene, s.camera) })
    const hand = await raw()
    console.log(`  one hand render with live state vs the wrong frame: ${fmt(await diff(wrong, hand))}`)
    await raf2(); const after = await raw()
    console.log(`  next R3F frame after the hand render vs wrong frame: ${fmt(await diff(wrong, after))}`)
    globalThis.__hand = hand
    // Who floors the viewport on the settle step? Log setRenderTarget callers.
    await page.evaluate(() => {
      const gl = window.__driftStore.getState().gl, orig = gl.setRenderTarget.bind(gl)
      window.__srt = []
      gl.setRenderTarget = (t, ...a) => { if (window.__srt.length < 3) window.__srt.push(`${t ? "target" : "null"} ${new Error().stack.split("\n").slice(2, 7).map((l) => l.trim().replace(/\(.*\/_next\//, "(").slice(0, 110)).join(" | ")}`); return orig(t, ...a) }
    })
  }
  const SETTLE_LOOP = process.argv.includes("--settle-loop")
  if (SETTLE_LOOP) await page.evaluate(() => { window.__revealHarness.setLoop(true); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) })
  else await page.evaluate(() => window.__styleHarness.setStyle({}))
  await settle(600)
  const b = await raw(); const cb = await cam()
  console.log(`  camera B (after ${SETTLE_LOOP ? "setLoop(true)" : "setStyle({})"}): ${brief(cb)}`)
  await settle(600); const b2 = await raw()
  if (process.argv.includes("--deep")) {
    const keys = new Set([...Object.keys(c3.objs || {}), ...Object.keys(cb.objs || {})])
    let same = 0
    for (const k of keys) { const x = JSON.stringify(c3.objs?.[k]), y = JSON.stringify(cb.objs?.[k]); if (x === y) same++; else console.log(`  DIFF ${k}\n    A3 ${x}\n    B  ${y}`) }
    console.log(`  deep: ${same} of ${keys.size} scene entries identical A3 vs B; r3f store ${c3.r3f}`)
    for (const k of ["pm", "mw", "mwi", "tgt"]) console.log(`  ${k} ${JSON.stringify(c3[k]) === JSON.stringify(cb[k]) ? "same" : "DIFF " + c3[k] + " vs " + cb[k]}`)
  }
  const r1 = await diff(a1, b), r2 = await diff(a2, b), r3 = await diff(a3, b), rb = await diff(b, b2)
  console.log(`${r1.n === 0 ? "SAME " : "MOVED"} A1 (first frame) vs settled B: ${fmt(r1)}`)
  console.log(`${r2.n === 0 ? "SAME " : "MOVED"} A2 (2 rAF later)  vs settled B: ${fmt(r2)}`)
  console.log(`${r3.n === 0 ? "SAME " : "MOVED"} A3 (600 ms later) vs settled B: ${fmt(r3)}`)
  console.log(`${rb.n === 0 ? "SAME " : "MOVED"} B vs B 600 ms later: ${fmt(rb)}`)
  if (globalThis.__hand) console.log(`  setRenderTarget calls on the settle step:\n    ${(await page.evaluate(() => window.__srt)).join("\n    ") || "none"}`)
  if (globalThis.__hand) console.log(`  hand render vs settled B: ${fmt(await diff(globalThis.__hand, b))}`)
  console.log(`hashes A1 ${sha(a1)} A2 ${sha(a2)} A3 ${sha(a3)} B ${sha(b)}`)
  if (OUT) {
    mkdirSync(OUT, { recursive: true })
    const tag = WINDOW ? "window" : "panel"
    for (const [n, u] of [["a1", a1], ["b", b]]) writeFileSync(`${OUT}/${tag}-${n}.png`, Buffer.from(u.split(",")[1], "base64"))
  }
} finally {
  await browser.close()
}
