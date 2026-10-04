#!/usr/bin/env node
// assert-maximize.mjs · ANY PANEL TAKES THE WHOLE AREA, AND COMES BACK EXACTLY AS IT WAS
//
//   FS_PORT=3140 FS_HEADED=0 node scripts/verify/assert-maximize.mjs
//
// Layout rethink phase L5 (`docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md` §3 "Maximize and
// restore", §5 row L5; his call of 2026-09-26: any panel maximizes, the dock above all). Built in
// `components/dock-shell.tsx` as a layout: maximize keeps `toJSON()` in memory and hides every other
// group; when the panel is not the 3D view, the 3D view floats as a 360x216 preview 12 px in from the
// bottom right. Restore loads the kept layout with `reuseExistingPanels`.
//
// Rows, each with a must-fail on a page that must fail it:
//   X1  ROUND TRIP. For the Drawing, the 3D view, Style and the dock, in Draw and in Animate: maximize
//       then restore returns the layout JSON byte-equal. must-fail: `__fsDockMutant = "restoreDefault"`,
//       restore loads the workspace's default instead of what it left (the Draw layout is changed
//       first, so the default differs).
//   X2  THE SAME CANVAS, THE SAME FRAME. The 3D canvas element and its WebGL context are the same
//       before, while maximized (in the preview) and after restore; no `webglcontextlost`; the 3D frame
//       grabbed before maximizing equals the one grabbed after restore, byte for byte. must-fail:
//       `"noReuse"`, loads without `reuseExistingPanels` (the canvas is remounted and the frame is
//       drawn by a new context).
//   X3  THE PREVIEW. With the dock maximized, the 3D canvas is 360x216 (within 1 px), its box 12 px in
//       from the bottom right of the shell (within 2 px), on top (`elementFromPoint` at its centre is
//       the canvas), and every other panel is hidden. must-fail: `"nopreview"`.
//   X4  THE WAYS IN AND OUT. The header's maximize button, a double-click on the header, Shift+Space
//       over the panel under the pointer: each maximizes; the same three, and Esc, each restore.
//       Shift+Space typed in the filename field does nothing. must-fail: `"nokeys"`, Shift+Space and
//       Esc do nothing.
//   X5  NEVER SAVED. A reload while maximized comes back restored, on the layout from before the
//       maximize. must-fail: `"savemax"`, the maximized layout saved.
//   X6  THE DOCK MAXIMIZED MARKS ITS 36 PX ROWS: `data-fs-dock-max` on the root while the dock is the
//       maximized panel, gone after restore and while another panel is maximized. must-fail: the same
//       reader with the dock not maximized reads no mark.
//   X7  EVERY PANEL HAS ITS HEADER (§2): a 28 px header with its name and a maximize button on the
//       Drawing, the 3D view and Style; the dock's 36 px header carries a maximize button too.
//       must-fail: the reader under `workspace.today()`, where the headers are hidden, finds none.
//   X8  (CLOUD-LAYOUT) THE PREVIEW INSIDE THE WINDOW. With the dock maximized, the float's box, the 3D
//       panel and its canvas each sit 12 px (within 1) inside the shell and the window, at 1512x982,
//       1280x720 and 900x700 (stacked), and after the window shrinks to 760x430 while maximized.
//       must-fail: `"previewLoose"`, the preview placed as before.
//   X9  (CLOUD-LAYOUT) THE DRAWING FITS THE PREVIEW. In the preview's own frame the ink clears every
//       edge by 8 px and spans 70% of the width or height. must-fail: `"previewNoFit"`, the main view's
//       framing in the preview (the logo cropped at the top and right).
//   X10 (CLOUD-LAYOUT) A RAIL CLICK WHILE MAXIMIZED DOES WHAT ITS BUTTON SAYS. In Draw: the Drawing
//       maximized, then the rail's Timeline, 3D view and Style; the dock maximized, then the rail's
//       Drawing. Each click restores and leaves its panel the opposite of what its button showed
//       (aria-pressed) before the click. must-fail: `"railflip"`, restore then flip the restored state.
//   X11 (CLOUD-LAYOUT) CROSSING 1024 PX WHILE MAXIMIZED. Style maximized at 1512x982, the window to
//       900x700 and back, then the rail hides the Drawing, then a reload: the hide is kept, nothing is
//       maximized after the reload, and before it the header said Restore only while something was
//       maximized. must-fail: `"maxstuck"`, the breakpoint reload under the maximize as before (the
//       maximize stuck, saving off, the hide lost).
//   G1  no page error on the lane pages.

const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"

const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16)
let pass = 0, fail = 0
const row = (id, name, ok, detail = "") => {
  ok ? pass++ : fail++
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(4)} ${name}${detail ? `  :  ${detail}` : ""}`)
}
const fired = (id, name, red, detail = "") => {
  red ? pass++ : fail++
  console.log(`${red ? "FIRED" : "BLIND"} ${id.padEnd(4)} must-fail: ${name}${detail ? `  :  ${detail}` : ""}`)
}

const browser = await chromium.launch()
const errors = []
const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }

async function open({ mutant = null, keepStorage = false, ctx: given = null } = {}) {
  const ctx = given ?? (await browser.newContext({ viewport: { width: 1512, height: 982 } }))
  if (!given) {
    await ctx.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout.")) localStorage.removeItem(k) } catch {} })
    if (mutant) await ctx.addInitScript((m) => { window.__fsDockMutant = m }, mutant)
  }
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!mutant) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness && window.__dockHarness?.maximize, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate((st) => { window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) }, STILL)
  await settle(page, 800)
  return { ctx, page }
}
const settle = async (page, ms = 300) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const M = (page, fn, arg) => page.evaluate(([fn, arg]) => window.__dockHarness.maximize[fn](arg), [fn, arg])
const json = (page) => page.evaluate(() => window.__dockHarness.workspace.json())
const frame = async (page) => {
  // The same settle the resize gates use: a no-op style write forces one render after a size change.
  await page.evaluate((st) => window.__styleHarness.setStyle(st), STILL)
  await settle(page, 700)
  return page.evaluate(() => window.__captureHarness.grab()).then((u) => (typeof u === "string" && u.startsWith("data:") ? sha(u) : `none (${u})`))
}

// ---------------------------------------------------------------- X1
async function roundTrips(mutant) {
  const { ctx, page } = await open({ mutant })
  // Change Draw first (the dock opened to 300 px), so a default is not this layout.
  await page.evaluate(() => window.__dockHarness.dock.open("timeline"))
  await page.evaluate(() => window.__dockHarness.api.groups.find((g) => g.panels.some((p) => p.id === "timeline")).api.setSize({ height: 300 }))
  await settle(page, 600)
  const out = []
  for (const ws of ["draw", "animate"]) {
    if (ws !== "draw") { await page.evaluate((w) => window.__dockHarness.workspace.switch(w), ws); await settle(page, 400) }
    for (const id of ["drawing", "view3d", "style", "timeline"]) {
      const shown = await page.evaluate((id) => !!window.__dockHarness.api.getPanel(id)?.group.api.isVisible, id)
      if (!shown) await page.evaluate((id) => window.__dockHarness.workspace.toggle(id === "view3d" ? "view3d" : id), id)
      await settle(page, 300)
      const before = await json(page)
      await M(page, "toggle", id)
      await settle(page, 300)
      const during = await M(page, "current")
      await M(page, "restore")
      await settle(page, 300)
      const after = await json(page)
      out.push({ ws, id, same: before === after, during })
    }
  }
  await ctx.close()
  return out
}
{
  const r = await roundTrips(null)
  const bad = r.filter((x) => !x.same || !x.during)
  row("X1", "maximize then restore is byte-equal, 4 panels x Draw and Animate", bad.length === 0, bad.length ? bad.map((x) => `${x.ws}/${x.id}: ${x.during ? "" : "never maximized, "}${x.same ? "equal" : "DIFFERS"}`).join("; ") : `${r.length} round trips equal`)
  const m = await roundTrips("restoreDefault")
  fired("X1", "restore loads the default", m.some((x) => !x.same), `${m.filter((x) => !x.same).length} of ${m.length} differ`)
}

// ---------------------------------------------------------------- X2
async function sameCanvas(mutant) {
  const { ctx, page } = await open({ mutant })
  await page.evaluate(() => {
    const c = document.querySelector('[data-dock-panel="view3d"] canvas')
    window.__x2 = { c, gl: c.getContext("webgl2") || c.getContext("webgl"), lost: 0 }
    c.addEventListener("webglcontextlost", () => window.__x2.lost++)
  })
  const f0 = await frame(page)
  const ids = { before: true }
  await M(page, "toggle", "timeline")
  await settle(page, 500)
  ids.during = await page.evaluate(() => { const c = document.querySelector('[data-dock-panel="view3d"] canvas'); return c === window.__x2.c && (c.getContext("webgl2") || c.getContext("webgl")) === window.__x2.gl })
  await M(page, "restore")
  await settle(page, 500)
  const f1 = await frame(page)
  const r = await page.evaluate(() => { const c = document.querySelector('[data-dock-panel="view3d"] canvas'); return { same: c === window.__x2.c, gl: !!c && (c.getContext("webgl2") || c.getContext("webgl")) === window.__x2.gl, lost: window.__x2.lost } })
  await ctx.close()
  return { ...r, during: ids.during, f0, f1 }
}
{
  const r = await sameCanvas(null)
  row("X2", "the same canvas and context throughout, the frame after restore equals the frame before", r.same && r.gl && r.during && r.lost === 0 && r.f0 === r.f1, `element ${r.same}, context ${r.gl}, kept while maximized ${r.during}, lost ${r.lost}, frame ${r.f0} -> ${r.f1}`)
  const m = await sameCanvas("noReuse")
  fired("X2", "loads without reuseExistingPanels", !(m.same && m.gl && m.lost === 0 && m.f0 === m.f1), `element ${m.same}, context ${m.gl}, lost ${m.lost}, frame ${m.f0} -> ${m.f1}`)
}

// ---------------------------------------------------------------- X3
async function preview(mutant) {
  const { ctx, page } = await open({ mutant })
  await M(page, "toggle", "timeline")
  await settle(page, 600)
  const r = await page.evaluate(() => {
    const c = document.querySelector('[data-dock-panel="view3d"] canvas')
    const shell = document.querySelector(".dv-dockview")?.getBoundingClientRect() ?? document.body.getBoundingClientRect()
    const b = c?.getBoundingClientRect()
    const hit = b && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2)
    const api = window.__dockHarness.api
    const others = ["drawing", "style"].filter((id) => api.getPanel(id)?.group.api.isVisible)
    return {
      size: b ? [b.width, b.height] : null,
      inset: b ? [shell.right - b.right, shell.bottom - b.bottom] : null,
      onTop: !!hit && (hit === c || c.contains(hit)),
      visible: !!c && c.checkVisibility({ visibilityProperty: true }),
      others,
    }
  })
  await ctx.close()
  return r
}
{
  const r = await preview(null)
  const size = !!r.size && Math.abs(r.size[0] - 360) <= 1 && Math.abs(r.size[1] - 216) <= 1
  const inset = !!r.inset && Math.abs(r.inset[0] - 12) <= 2 && Math.abs(r.inset[1] - 12) <= 2
  row("X3", "the dock maximized: the 3D view floats 360x216, 12 px from the bottom right, on top; the rest hidden", size && inset && r.onTop && r.visible && r.others.length === 0, `canvas ${r.size?.map(Math.round).join("x")}, inset ${r.inset?.map(Math.round).join("/")}, on top ${r.onTop}, visible ${r.visible}, other panels showing ${r.others.join(", ") || "none"}`)
  const m = await preview("nopreview")
  const mSize = !!m.size && Math.abs(m.size[0] - 360) <= 1 && Math.abs(m.size[1] - 216) <= 1
  fired("X3", "no floating preview", !(mSize && m.onTop && m.visible), `canvas ${m.size?.map(Math.round).join("x")}, on top ${m.onTop}, visible ${m.visible}`)
}

// ---------------------------------------------------------------- X4
async function ways(mutant) {
  const { ctx, page } = await open({ mutant })
  const cur = () => M(page, "current")
  const out = {}
  // The header button.
  await page.locator('[data-maximize="drawing"]').click()
  await settle(page, 300)
  out.buttonIn = await cur()
  await page.locator('[data-maximize="drawing"]').click()
  await settle(page, 300)
  out.buttonOut = await cur()
  // A double-click on the 3D view's header, off its buttons.
  const head = await page.evaluate(() => { const t = document.querySelector('[data-panel-tab="view3d"]'); const r = t.getBoundingClientRect(); return [r.right + 40, r.top + r.height / 2] })
  await page.mouse.dblclick(head[0], head[1])
  await settle(page, 300)
  out.dblIn = await cur()
  const head2 = await page.evaluate(() => { const t = document.querySelector('[data-panel-tab="view3d"]'); const r = t.getBoundingClientRect(); return [r.right + 40, r.top + r.height / 2] })
  await page.mouse.dblclick(head2[0], head2[1])
  await settle(page, 300)
  out.dblOut = await cur()
  // Shift+Space over the Drawing, then Shift+Space again, then over it again and Esc.
  const over = await page.evaluate(() => { const r = document.querySelector('[data-dock-panel="drawing"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2] })
  await page.mouse.move(over[0], over[1], { steps: 4 })
  await page.keyboard.press("Shift+Space")
  await settle(page, 300)
  out.keyIn = await cur()
  await page.keyboard.press("Shift+Space")
  await settle(page, 300)
  out.keyOut = await cur()
  await page.mouse.move(over[0], over[1], { steps: 2 })
  await page.keyboard.press("Shift+Space")
  await settle(page, 300)
  out.escIn = await cur()
  await page.keyboard.press("Escape")
  await settle(page, 300)
  out.escOut = await cur()
  // Typing: Shift+Space in the filename field is text.
  await page.evaluate(() => window.__dockHarness.dock.open("export"))
  await settle(page, 300)
  await page.locator('input[aria-label="Filename prefix for exports"]').click()
  await page.keyboard.press("Shift+Space")
  await settle(page, 300)
  out.typing = await cur()
  await ctx.close()
  return out
}
{
  const r = await ways(null)
  const ok = r.buttonIn === "drawing" && r.buttonOut === null && r.dblIn === "view3d" && r.dblOut === null && r.keyIn === "drawing" && r.keyOut === null && r.escIn === "drawing" && r.escOut === null && r.typing === null
  row("X4", "header button, double-click, Shift+Space in and out, Esc out; not while typing", ok, JSON.stringify(r))
  const m = await ways("nokeys")
  fired("X4", "Shift+Space and Esc do nothing", !(m.keyIn === "drawing" && m.escOut === null), `Shift+Space ${m.keyIn}, after Esc ${m.escOut}`)
}

// ---------------------------------------------------------------- X5
async function reload(mutant) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  await ctx.addInitScript(() => { if (!sessionStorage.getItem("x5")) { sessionStorage.setItem("x5", "1"); try { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout.")) localStorage.removeItem(k) } catch {} } })
  if (mutant) await ctx.addInitScript((m) => { window.__fsDockMutant = m }, mutant)
  const { page } = await open({ mutant, ctx })
  await page.evaluate(() => window.__dockHarness.workspace.toggle("style"))
  await settle(page, 700)
  const before = await json(page)
  await M(page, "toggle", "drawing")
  await settle(page, 300)
  await page.evaluate(() => window.__dockHarness.api.getPanel("drawing").group.api.setSize({ width: 900 }))
  await settle(page, 700)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => window.__dockHarness?.maximize, null, { timeout: 240000 })
  await settle(page, 800)
  const after = await json(page)
  const cur = await M(page, "current")
  await ctx.close()
  return { same: before === after, cur }
}
{
  const r = await reload(null)
  row("X5", "a reload while maximized comes back restored, on the layout from before", r.same && r.cur === null, `layout ${r.same ? "equal" : "DIFFERS"}, maximized after reload ${r.cur}`)
  const m = await reload("savemax")
  fired("X5", "the maximized layout saved", !m.same, `layout ${m.same ? "equal" : "differs"}`)
}

// ---------------------------------------------------------------- X6, X7
{
  const { ctx, page } = await open()
  const mark = () => page.evaluate(() => document.documentElement.dataset.fsDockMax === "1")
  const m0 = await mark()
  await M(page, "toggle", "timeline")
  await settle(page, 300)
  const m1 = await mark()
  await M(page, "toggle", "drawing")
  await settle(page, 300)
  const m2 = await mark()
  await M(page, "restore")
  await settle(page, 300)
  const m3 = await mark()
  row("X6", "the dock maximized marks its 36 px rows, and only then", !m0 && m1 && !m2 && !m3, `before ${m0}, dock maximized ${m1}, drawing maximized ${m2}, restored ${m3}`)
  fired("X6", "the reader with the dock not maximized", !m0, `mark ${m0}`)

  const headers = () => page.evaluate(() => {
    const out = {}
    for (const id of ["drawing", "view3d", "style", "timeline"]) {
      const g = window.__dockHarness.api.getPanel(id)?.group
      if (!g || !g.api.isVisible) { out[id] = null; continue }
      const h = g.element.querySelector(":scope > .dv-tabs-and-actions-container")
      const r = h?.getBoundingClientRect()
      const max = g.element.querySelector("[data-maximize]")
      out[id] = { h: r ? Math.round(r.height) : 0, name: (h?.innerText ?? "").split("\n")[0].trim(), max: !!max && max.checkVisibility() }
    }
    return out
  })
  await page.evaluate(() => window.__dockHarness.workspace.toggle("style"))
  await settle(page, 400)
  const hs = await headers()
  const ok = ["drawing", "view3d", "style"].every((id) => hs[id] && hs[id].h === 28 && hs[id].max && hs[id].name.length > 0) && hs.timeline && hs.timeline.h === 36 && hs.timeline.max
  row("X7", "every panel has its header with a maximize button", ok, JSON.stringify(hs))
  await page.evaluate(() => window.__dockHarness.workspace.today())
  await settle(page, 400)
  const ht = await headers()
  fired("X7", "the reader under today(), headers hidden", !["drawing", "view3d"].every((id) => ht[id] && ht[id].h === 28 && ht[id].max), JSON.stringify({ drawing: ht.drawing, view3d: ht.view3d }))
  await ctx.close()
}

// ---------------------------------------------------------------- X8 (CLOUD-LAYOUT)
// The preview sits fully inside the window, 12 px in, at every size: the float's box, the 3D panel and
// its canvas, each against the shell. Below `lg` (900x700) the 3D column used to grow to its content in
// the float and run 52 px past the window's bottom; a shell resized while maximized moves it too.
async function previewInside(mutant) {
  const out = []
  const box = (page) => page.evaluate(() => {
    const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom } }
    const c = document.querySelector('[data-dock-panel="view3d"] canvas')
    return {
      win: [innerWidth, innerHeight],
      shell: r(document.querySelector("[data-fs-dock-box]")),
      // The panel's content is drawn in an overlay layer, not inside the float, so the float is found
      // through the 3D view's group.
      parts: { float: r(window.__dockHarness.api.getPanel("view3d")?.group.element.closest(".dv-resize-container") ?? null), panel: r(document.querySelector('[data-dock-panel="view3d"]')), canvas: r(c) },
    }
  })
  const grade = (m, label) => {
    const bad = []
    for (const [k, v] of Object.entries(m.parts)) {
      if (!v) { bad.push(`${k} missing`); continue }
      const ins = [v.l - m.shell.l, v.t - m.shell.t, m.shell.r - v.r, m.shell.b - v.b, m.win[0] - v.r, m.win[1] - v.b]
      if (Math.min(...ins) < 11) bad.push(`${k} ${Math.round(v.l)},${Math.round(v.t)}..${Math.round(v.r)},${Math.round(v.b)}`)
    }
    out.push({ label, ok: bad.length === 0, bad })
  }
  for (const [w, h] of [[1512, 982], [1280, 720], [900, 700]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } })
    await ctx.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout.")) localStorage.removeItem(k) } catch {} })
    if (mutant) await ctx.addInitScript((m) => { window.__fsDockMutant = m }, mutant)
    const { page } = await open({ mutant, ctx })
    await M(page, "toggle", "timeline")
    await settle(page, 600)
    grade(await box(page), `${w}x${h}`)
    if (w === 1512) {
      await page.setViewportSize({ width: 760, height: 430 })
      await settle(page, 900)
      grade(await box(page), "1512x982 resized to 760x430 while maximized")
    }
    await ctx.close()
  }
  return out
}
{
  const r = await previewInside(null)
  row("X8", "the preview's float, panel and canvas sit inside the window, 12 px in, at 3 sizes and after a resize", r.every((x) => x.ok), r.map((x) => `${x.label} ${x.ok ? "inside" : `OUT: ${x.bad.join("; ")}`}`).join(" | "))
  const m = await previewInside("previewLoose")
  fired("X8", "the preview placed as before (360x216 whatever the shell, content free to grow)", m.some((x) => !x.ok), m.filter((x) => !x.ok).map((x) => `${x.label}: ${x.bad.join("; ")}`).join(" | "))
}

// ---------------------------------------------------------------- X9 (CLOUD-LAYOUT)
// The drawing fits the preview: in the preview's own frame the ink (pixels darker than the grid, which
// is light grey on #fafafa) clears every edge by at least 8 px (the fit's margin is 16) and spans at
// least 70% of the width or the height. With the main view's framing the logo ran off the top and the
// right. The main view's framing after restore is X2's byte-equal frame, which runs with this fit on.
async function previewInk(mutant) {
  const { ctx, page } = await open({ mutant })
  await M(page, "toggle", "timeline")
  await settle(page, 900)
  await page.evaluate((st) => window.__styleHarness.setStyle(st), STILL)
  await settle(page, 700)
  const url = await page.evaluate(() => window.__captureHarness.grab())
  const ink = await page.evaluate(async (u) => {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = u })
    const c = document.createElement("canvas")
    c.width = img.width
    c.height = img.height
    const g = c.getContext("2d")
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let x0 = Infinity, x1 = -1, y0 = Infinity, y1 = -1, n = 0
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4
      if (d[i + 3] < 128) continue
      if ((d[i] + d[i + 1] + d[i + 2]) / 3 > 140) continue
      n++
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
    return { w: c.width, h: c.height, n, box: n ? [x0, y0, x1, y1] : null }
  }, url)
  await ctx.close()
  if (!ink.box) return { ok: false, detail: `no ink in a ${ink.w}x${ink.h} frame` }
  const [x0, y0, x1, y1] = ink.box
  const clear = Math.min(x0, y0, ink.w - 1 - x1, ink.h - 1 - y1)
  const span = Math.max((x1 - x0 + 1) / ink.w, (y1 - y0 + 1) / ink.h)
  return { ok: clear >= 8 && span >= 0.7, detail: `frame ${ink.w}x${ink.h}, ink ${x0},${y0}..${x1},${y1} (${ink.n} px), clears the edges by ${clear} px, spans ${(span * 100).toFixed(0)}%` }
}
{
  const r = await previewInk(null)
  row("X9", "the drawing fits the preview: clears every edge by 8 px and spans 70% of it", r.ok, r.detail)
  const m = await previewInk("previewNoFit")
  fired("X9", "the preview shows the main view's framing", !m.ok, m.detail)
}

// ---------------------------------------------------------------- X10 (CLOUD-LAYOUT)
async function railWhileMax(mutant) {
  const { ctx, page } = await open({ mutant })
  const out = []
  for (const [max, rail] of [["drawing", "timeline"], ["drawing", "view3d"], ["drawing", "style"], ["timeline", "drawing"]]) {
    await page.evaluate(() => window.__dockHarness.workspace.reset())
    await settle(page, 400)
    await M(page, "toggle", max)
    await settle(page, 400)
    const said = await page.locator(`[data-rail-panel="${rail}"]`).getAttribute("aria-pressed")
    await page.locator(`[data-rail-panel="${rail}"]`).click()
    await settle(page, 500)
    const now = await page.evaluate((rail) => window.__dockHarness.workspace.shown()[rail], rail)
    const cur = await M(page, "current")
    out.push({ max, rail, said, now, ok: cur === null && now === (said !== "true") })
  }
  await ctx.close()
  return out
}
{
  const say = (r) => r.map((x) => `${x.max} maximized, rail ${x.rail} said ${x.said === "true" ? "on" : "off"}, now ${x.now ? "shown" : "hidden"}`).join("; ")
  const r = await railWhileMax(null)
  row("X10", "a rail click while maximized leaves its panel the opposite of what its button said", r.every((x) => x.ok), say(r))
  const m = await railWhileMax("railflip")
  fired("X10", "restore, then flip the restored state", m.some((x) => !x.ok), say(m))
}

// ---------------------------------------------------------------- X11 (CLOUD-LAYOUT)
async function crossLg(mutant) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  await ctx.addInitScript(() => { if (!sessionStorage.getItem("x11")) { sessionStorage.setItem("x11", "1"); try { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout.")) localStorage.removeItem(k) } catch {} } })
  if (mutant) await ctx.addInitScript((m) => { window.__fsDockMutant = m }, mutant)
  const { page } = await open({ mutant, ctx })
  await M(page, "toggle", "style")
  await settle(page, 400)
  await page.setViewportSize({ width: 900, height: 700 })
  await settle(page, 900)
  await page.setViewportSize({ width: 1512, height: 982 })
  await settle(page, 900)
  const during = await M(page, "current")
  const restoreSaid = await page.evaluate(() => [...document.querySelectorAll("[data-maximize]")].filter((b) => b.getAttribute("aria-pressed") === "true").length)
  await page.locator('[data-rail-panel="drawing"]').click()
  await settle(page, 900)
  const hidden = await page.evaluate(() => !window.__dockHarness.workspace.shown().drawing)
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => window.__dockHarness?.maximize, null, { timeout: 240000 })
  await settle(page, 900)
  const kept = await page.evaluate(() => !window.__dockHarness.workspace.shown().drawing)
  const after = await M(page, "current")
  await ctx.close()
  const consistent = (during === null) === (restoreSaid === 0)
  return { ok: hidden && kept && after === null && consistent, during, restoreSaid, hidden, kept, after }
}
{
  const say = (x) => `maximized after the round trip: ${x.during}, Restore buttons pressed ${x.restoreSaid}; Drawing hidden ${x.hidden}, after reload ${x.kept}; maximized after reload ${x.after}`
  const r = await crossLg(null)
  row("X11", "maximized across 1024 px and back: consistent, a later hide saved and kept across a reload", r.ok, say(r))
  const m = await crossLg("maxstuck")
  fired("X11", "the breakpoint reload under the maximize (stuck)", !m.ok, say(m))
}

row("G1", "the lane pages threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")
await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
