// THE CANVASES AT MAIN'S SIZE, OR NOT COMPARED (CL-GATES-1, 2026-10-02).
//
// A frame compared against main is a comparison only at equal canvas size. Since
// L4 the rail takes 48 px of width and the style bar's 44 px of height went back
// to the canvases, so `workspace.today()` (lib/dock.mjs hideDock) leaves the 3D
// canvas at 731x934 at 1512x982 where main's is 755x890, and every byte
// comparison against a main base differs for that reason alone.
//
// sizeToMain(page, { view3d, drawing }) puts them back:
//   1. today(): the Drawing and the 3D view alone, dock and Style hidden.
//   2. The window takes the rail's chrome back: its width and height move by
//      what the targets need over what the panels hold now, at most MAX_GROW px
//      per axis. A target that needs more is impossible and reads NOT COMPARED.
//   3. The dockview API sets the split: the 3D view's group to its target width
//      (`panel.group.api.setSize`), so the Drawing takes the rest.
//      `grow: false` leaves the window as it is (a page opened at the window a
//      clean call found), so a mutant that shrinks a canvas cannot be sized
//      back to main's and hidden.
//   4. PROOF: the largest canvas in each named panel has the target BACKING
//      BUFFER, exactly, read from `canvas.width/height`, twice, two frames
//      apart. Anything else returns { compared: false, why } and the gate's
//      row must print NOT COMPARED, never PASS.
// CSS TARGETS (CL-GATES-2): `css: { view3d: [w, h], drawing: [w, h] }`, main's canvas boxes in css px.
// Equal buffers are not an equal frame: R3F builds the orthographic frustum from the canvas's css size,
// so main's 755.5 px wide 3D canvas over a 755 buffer (frustum right 377.75) and the lane's 755.0 px one
// (right 377.5) rendered different bytes at proven equal buffers. Given css targets, the split is set in
// css px and the proof also holds each canvas's css box to within 0.01 px of main's.
// Targets are backing buffers [w, h], the thing a byte comparison depends on,
// and a gate passes main's own measured numbers where it has them (MAIN_1512 is
// main at 1512x982, measured by --self against :3000).
//
// CORPUS: the largest <canvas> under [data-dock-panel="view3d"] and, when a
// drawing target is given, under [data-dock-panel="drawing"]. A drawing panel
// not given is not checked, and the result says so (`drawing: "unchecked"`).
//
// MUST-FAIL ARMS, `DOCK_SIZE_MUTATE`:
//   noset       steps 2 and 3 skipped; the proof must read NOT COMPARED
//   impossible  the 3D target becomes 4000x4000; the proof must read NOT COMPARED
//   FS_PORT=3138 node scripts/verify/lib/dock-size.mjs --self
// runs the clean call, an impossible call and the noset call on one page each,
// and exits 1 unless the clean call compared and both others read NOT COMPARED.
const ARMS = ["noset", "impossible"]
const MUTATE = process.env.DOCK_SIZE_MUTATE ?? ""
if (MUTATE && !ARMS.includes(MUTATE)) throw new Error(`DOCK_SIZE_MUTATE=${MUTATE} is not an arm. Use one of: ${ARMS.join(", ")}.`)
if (MUTATE) console.log(`[dock-size] MUST-FAIL ARM DOCK_SIZE_MUTATE=${MUTATE} is on. Every call has to read NOT COMPARED.`)

/** Main at 1512x982, buffers, measured on :3000 (--self prints them again). */
export const MAIN_1512 = { win: [1512, 982], view3d: [755, 890], drawing: [755, 890], css: { view3d: [755.5, 890], drawing: [755.5, 890] } }
export const MAX_GROW = 96

const frame = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
export const readCanvases = (page) =>
  page.evaluate(() => {
    const one = (id) => {
      const p = document.querySelector(`[data-dock-panel="${id}"]`)
      if (!p) return null
      const cs = [...p.querySelectorAll("canvas")].map((c) => ({ c, r: c.getBoundingClientRect() })).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)
      const q = p.getBoundingClientRect()
      if (!cs.length) return { panel: [q.width, q.height], css: null, buf: null }
      return { panel: [q.width, q.height], css: [cs[0].r.width, cs[0].r.height], buf: [cs[0].c.width, cs[0].c.height] }
    }
    return { win: [innerWidth, innerHeight], dpr: devicePixelRatio, view3d: one("view3d"), drawing: one("drawing") }
  })
const eq = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1]
const near = (a, b) => !!a && !!b && Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01
const s = (a) => (a ? a.map((n) => Math.round(n * 10) / 10).join("x") : "none")

/* Two reads 100 ms apart that agree, with the 3D canvas filling its panel: a layout load or a window
   resize has landed. Gives up after 5 s and returns the last read; the proof below then names the miss. */
const steady = async (page) => {
  let a = null
  for (const t0 = Date.now(); Date.now() - t0 < 5000; await page.waitForTimeout(100)) {
    await frame(page)
    const b = await readCanvases(page)
    const fills = b.view3d?.css && Math.abs(b.view3d.css[0] - b.view3d.panel[0]) <= 1 && Math.abs(b.view3d.css[1] - b.view3d.panel[1]) <= 1
    if (fills && a && JSON.stringify(a) === JSON.stringify(b)) return b
    a = b
  }
  return a
}

/** Returns { compared: true, got } or { compared: false, why, got }. Never throws on a miss. */
export async function sizeToMain(page, { view3d = MAIN_1512.view3d, drawing = null, css = null, grow = true, timeout = 15000 } = {}) {
  if (MUTATE === "impossible") { view3d = [4000, 4000]; css = null }
  const no = (why, got) => ({ compared: false, why: `NOT COMPARED: ${why}`, got })
  try {
    await page.waitForFunction(() => window.__dockHarness?.workspace?.today, null, { timeout })
  } catch (e) {
    if (e?.name !== "TimeoutError") throw e
    return no(`no __dockHarness.workspace.today on the page after ${timeout} ms`, null)
  }
  await page.evaluate(() => window.__dockHarness.workspace.today())
  let m = await steady(page)
  if (!m.view3d?.buf) return no("no canvas in the 3D view panel", m)
  if (drawing && !m.drawing?.buf) return no("no canvas in the Drawing panel", m)
  const d = m.dpr
  // The targets in css px: main's boxes when given, else the buffers over the pixel ratio.
  const c3 = css?.view3d ?? [view3d[0] / d, view3d[1] / d], cD = css?.drawing ?? (drawing ? [drawing[0] / d, drawing[1] / d] : null)
  // What the window must give: the targets' css size over what the canvases hold now.
  const needW = drawing ? m.win[0] + c3[0] + cD[0] - (m.view3d.css[0] + m.drawing.css[0]) : m.win[0]
  const needH = m.win[1] + c3[1] - m.view3d.css[1]
  const more = [Math.round(needW - m.win[0]), Math.round(needH - m.win[1])]
  if (Math.abs(more[0]) > MAX_GROW || Math.abs(more[1]) > MAX_GROW)
    return no(`3D ${s(view3d)}${drawing ? ` and Drawing ${s(drawing)}` : ""} need the window ${more[0]},${more[1]} px larger, past the ${MAX_GROW} px the rail's chrome accounts for (now 3D ${s(m.view3d.css)} in ${s(m.view3d.panel)}, Drawing ${s(m.drawing?.css)} in ${s(m.drawing?.panel)}, window ${s(m.win)})`, m)
  const miss0 = (m) =>
    !eq(m.view3d?.buf, view3d) ? `3D buffer ${s(m.view3d?.buf)} is not ${s(view3d)}` : drawing && !eq(m.drawing?.buf, drawing) ? `Drawing buffer ${s(m.drawing?.buf)} is not ${s(drawing)}`
      : css?.view3d && !near(m.view3d?.css, css.view3d) ? `3D css box ${s(m.view3d?.css)} is not ${s(css.view3d)}` : css?.drawing && !near(m.drawing?.css, css.drawing) ? `Drawing css box ${s(m.drawing?.css)} is not ${s(css.drawing)}` : null
  if (MUTATE !== "noset") {
    if (grow && (more[0] || more[1])) {
      await page.setViewportSize({ width: m.win[0] + more[0], height: m.win[1] + more[1] })
      await steady(page)
      // today() reads the shell's size when it runs, so it runs again once the shell has the new room.
      await page.evaluate(() => window.__dockHarness.workspace.today())
      m = await steady(page)
    }
    // A split already at the targets is left alone: dockview's setSize lays out in whole px, so at 1329x756
    // it turned the 639.5 px that today() gave into 639 (CL-GATES-2).
    const right = () => !miss0(m)
    const split = async () => {
      if (right()) return
      const w = c3[0] + (m.view3d.panel[0] - m.view3d.css[0])
      await page.evaluate((w) => window.__dockHarness.api.getPanel("view3d").group.api.setSize({ width: w }), w)
      m = await steady(page)
    }
    await split()
    // After the window grows, dockview's split can land the two canvases a whole px short of the targets'
    // sum (1280x800: 638.5 + 639.5 against main's 639.5 + 639.5, CL-GATES-2). The window takes the
    // shortfall and the split is set again, at most twice, and never with `grow: false`.
    const win0 = m.win[0] - more[0], hin0 = m.win[1] - more[1]
    for (let i = 0; grow && i < 2; i++) {
      const short = [drawing ? Math.round(c3[0] + cD[0] - m.view3d.css[0] - m.drawing.css[0]) : 0, Math.round(c3[1] - m.view3d.css[1])]
      if (!short[0] && !short[1]) break
      const to = [m.win[0] + short[0], m.win[1] + short[1]]
      if (Math.abs(to[0] - win0) > MAX_GROW || Math.abs(to[1] - hin0) > MAX_GROW) break
      await page.setViewportSize({ width: to[0], height: to[1] })
      await steady(page)
      await page.evaluate(() => window.__dockHarness.workspace.today())
      m = await steady(page)
      await split()
    }
  }
  const t0 = Date.now()
  let why
  do {
    await frame(page)
    m = await readCanvases(page)
    why = miss0(m)
    if (!why) {
      await page.waitForTimeout(200)
      await frame(page)
      m = await readCanvases(page)
      why = miss0(m)
      if (!why) break
    }
    await page.waitForTimeout(100)
  } while (Date.now() - t0 < Math.min(timeout, 5000))
  if (why) return no(`${why} at window ${s(m.win)} after ${Date.now() - t0} ms (css 3D ${s(m.view3d?.css)} in ${s(m.view3d?.panel)}, Drawing ${s(m.drawing?.css)} in ${s(m.drawing?.panel)}${css ? `; asked css 3D ${s(c3)}, Drawing ${s(cD)}` : ""})`, m)
  const hidden = await page.evaluate(() => window.__dockHarness.dock.hidden())
  if (!hidden) return no("the canvases are main's size but the dock group still shows", m)
  console.log(`[dock-size] compared: ${css ? `css 3D ${s(m.view3d.css)}, ` : ""}3D ${s(m.view3d.buf)}${drawing ? `, Drawing ${s(m.drawing.buf)}` : `, Drawing ${s(m.drawing?.buf)} unchecked`} at window ${s(m.win)}`)
  return { compared: true, got: { ...m, drawing: drawing ? m.drawing : "unchecked" } }
}

if (process.argv.includes("--self")) {
  const { chromium } = await import("./browser.mjs")
  const { LAB_URL } = await import("./dev-server.mjs")
  const REF = process.env.REF_URL ?? "http://localhost:3000"
  const browser = await chromium.launch()
  const fails = []
  try {
    const open = async (url) => {
      const page = await browser.newPage({ viewport: { width: 1512, height: 982 } })
      await page.goto(url, { waitUntil: "load", timeout: 240000 })
      await page.waitForFunction(() => document.querySelectorAll('[data-dock-panel="view3d"] canvas, canvas').length > 1, null, { timeout: 240000 })
      await page.waitForTimeout(1500)
      return page
    }
    // Main's own buffers, its take dock floated off the 3D canvas the way its bases were recorded
    // (lib/undock.mjs's stylesheet, kept in assert-dock-shell.mjs as REF_FLOAT). On main the panels may
    // not carry data-dock-panel, so the two largest canvases, left to right.
    const mp = await open(REF)
    await mp.addStyleTag({ content: "[data-take-dock]{padding-bottom:0!important}[data-take-dock]>:is([data-animation-panel],:has([data-take-timeline])){position:absolute!important;left:12px;right:12px;bottom:64px;margin:0!important}" })
    await mp.waitForTimeout(800)
    const main = await mp.evaluate(() => {
      const cs = [...document.querySelectorAll("canvas")].map((c) => ({ x: c.getBoundingClientRect().x, a: c.width * c.height, b: [c.width, c.height], c: [c.getBoundingClientRect().width, c.getBoundingClientRect().height] })).sort((a, b) => b.a - a.a).slice(0, 2).sort((a, b) => a.x - b.x)
      return { drawing: cs[0]?.b, view3d: cs[1]?.b, css: { drawing: cs[0]?.c, view3d: cs[1]?.c } }
    })
    await mp.close()
    console.log(`[dock-size] main at 1512x982: Drawing ${s(main.drawing)}, 3D ${s(main.view3d)} (MAIN_1512 says ${s(MAIN_1512.drawing)}, ${s(MAIN_1512.view3d)})`)
    console.log(`[dock-size] main css boxes: Drawing ${s(main.css.drawing)}, 3D ${s(main.css.view3d)} (MAIN_1512 says ${s(MAIN_1512.css.drawing)}, ${s(MAIN_1512.css.view3d)})`)
    if (!eq(main.view3d, MAIN_1512.view3d) || !eq(main.drawing, MAIN_1512.drawing) || !near(main.css.view3d, MAIN_1512.css.view3d) || !near(main.css.drawing, MAIN_1512.css.drawing)) fails.push("MAIN_1512 is not main's measured size")
    const p1 = await open(LAB_URL)
    const clean = await sizeToMain(p1, { view3d: main.view3d, drawing: main.drawing, css: main.css })
    console.log(`[dock-size] clean: ${clean.compared ? "compared" : clean.why}`)
    if (!MUTATE && !clean.compared) fails.push(`clean call did not compare: ${clean.why}`)
    if (MUTATE && clean.compared) fails.push(`arm ${MUTATE} compared, the proof cannot say no`)
    await p1.close()
    const p2 = await open(LAB_URL)
    const imp = await sizeToMain(p2, { view3d: [3000, 2400], drawing: main.drawing })
    console.log(`[dock-size] must-fail, 3000x2400 asked: ${imp.compared ? "COMPARED (wrong)" : imp.why}`)
    if (imp.compared) fails.push("an impossible size compared")
    await p2.close()
  } finally {
    await browser.close()
  }
  console.log(fails.length ? `[dock-size] SELF FAIL: ${fails.join("; ")}` : `[dock-size] SELF PASS${MUTATE ? ` (arm ${MUTATE} read NOT COMPARED)` : ""}`)
  process.exit(fails.length ? 1 : 0)
}
