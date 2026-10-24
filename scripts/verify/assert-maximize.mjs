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
//       1280x720 and 900x700 (stacked), and after 1512x982 shrinks to 1100x620 while maximized (above
//       1024 px, so maximize holds). A shrink to 760x430 crosses 1024 px, which ends maximize (X11):
//       there the check is maximize null with the six panels present.
//       must-fail: `"previewLoose"`, the preview placed as before.
//   X9  (CLOUD-LAYOUT) THE DRAWING FITS THE PREVIEW. In the preview's own frame the ink clears every
//       edge by 8 px and spans 70% of the width or height. must-fail: `"previewNoFit"`, the main view's
//       framing in the preview (the logo cropped at the top and right).
//   X10 (CL-LAYOUTV) A RAIL CLICK WHILE MAXIMIZED DOES WHAT ITS LABEL SAID. At 1512x982, reset Draw,
//       maximize the Drawing, click the rail's Timeline while it reads "show": maximize ends, six panels,
//       Timeline, Drawing and 3D view visible, Style hidden. Again with the rail's Drawing, reading
//       "hide": maximize ends, the Drawing hidden, six panels. must-fail: `"railAfter"`, the old order
//       (restore, then flip what the restored layout shows).
//   X11 (CL-LAYOUTV) CROSSING 1024 PX CLEARS MAXIMIZE. Reset Style, maximize Style, 1023 px wide and back
//       to 1512: maximize null, no maximize button pressed, Style's reads "Maximize Style". The rail then
//       hides Style, the save holds its group at `visible: false`, and a reload keeps it hidden.
//       must-fail: `"lgKeepMax"`, the lg handler leaves maxRef set.
//   X12 (CL-LAYOUTV) A SAVE DOCKVIEW THROWS ON. Draw's default plus a floating group whose id is a number:
//       layoutProblem passes it and dockview's fromJSON throws. A reload shows the warning toast, which
//       says Dockview could not load it, with the six panels back. The fallback writes the default over
//       the bad save, so the next reload loads with 0 notes and six panels.
//       must-fail: `"nocatch"`, the shell's catch rethrows, as with no catch. `"keepBad"`, the fallback
//       leaves the bad save: the next reload shows the note again.
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
      await page.setViewportSize({ width: 1100, height: 620 })
      await settle(page, 900)
      grade(await box(page), "1512x982 resized to 1100x620 while maximized")
      // Under 1024 px maximize ends (X11), so there is no preview to place: maximize null, six panels.
      await page.setViewportSize({ width: 760, height: 430 })
      await settle(page, 900)
      const cur = await M(page, "current")
      const ids = await page.evaluate(() => window.__dockHarness.api.panels.map((p) => p.id).sort().join(","))
      const n = ids.split(",").filter(Boolean).length
      const bad = [...(cur === null ? [] : [`maximize still ${JSON.stringify(cur)}`]), ...(n === 6 ? [] : [`${n} panels (${ids})`])]
      out.push({ label: "1512x982 resized to 760x430 while maximized", ok: bad.length === 0, bad, note: `maximize ${cur === null ? "ended" : "held"}, ${n} panels` })
    }
    await ctx.close()
  }
  return out
}
{
  const r = await previewInside(null)
  row("X8", "the preview's float, panel and canvas sit inside the window, 12 px in, at 3 sizes and after a resize", r.every((x) => x.ok), r.map((x) => `${x.label} ${x.ok ? (x.note ?? "inside") : `OUT: ${x.bad.join("; ")}`}`).join(" | "))
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

// ---------------------------------------------------------------- X10, X11, X12 (CL-LAYOUTV)
// These rows reload, so their context clears the saved layouts once per tab, not on every load.
const W = (await import("./_ts-load.mjs")).loadTs("components/workspace/workspaces.ts")
async function fresh(mutant) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  await ctx.addInitScript(() => { try { if (!sessionStorage.getItem("__fsCleared")) { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout.")) localStorage.removeItem(k); sessionStorage.setItem("__fsCleared", "1") } } catch {} })
  if (mutant) await ctx.addInitScript((m) => { window.__fsDockMutant = m }, mutant)
  const { page } = await open({ mutant, ctx })
  return { ctx, page }
}
const reloadUp = async (page, timeout = 240000) => {
  await page.reload({ waitUntil: "domcontentloaded", timeout: 240000 })
  const up = await page.waitForFunction(() => window.__dockHarness?.maximize, null, { timeout }).then(() => true, () => false)
  if (up) await settle(page, 1200)
  return up
}
const panelIds = (page) => page.evaluate(() => window.__dockHarness.api.panels.map((p) => p.id).sort().join(","))
const shownOf = (page) => page.evaluate(() => window.__dockHarness.workspace.shown())
const resetTo = async (page, ws) => {
  await page.evaluate((w) => { window.__dockHarness.workspace.switch(w); window.__dockHarness.workspace.reset() }, ws)
  await settle(page, 600)
}

async function railClick(mutant) {
  const { ctx, page } = await fresh(mutant)
  const out = []
  for (const [click, want] of [["timeline", "show"], ["drawing", "hide"]]) {
    await resetTo(page, "draw")
    const six = await panelIds(page)
    await M(page, "toggle", "drawing")
    await settle(page, 500)
    const during = await M(page, "current")
    const pressed = want === "hide" ? "true" : "false"
    const ready = await page.waitForFunction(([c, p]) => document.querySelector(`[data-rail-panel="${c}"]`)?.getAttribute("aria-pressed") === p, [click, pressed], { timeout: 5000 }).then(() => true, () => false)
    const btn = page.locator(`[data-rail-panel="${click}"]`)
    await btn.hover()
    const tip = await page.locator("[data-rail-tooltip]").first().textContent({ timeout: 5000 }).catch(() => null)
    await btn.click()
    await settle(page, 600)
    const cur = await M(page, "current")
    const ids = await panelIds(page)
    const s = await shownOf(page)
    await page.mouse.move(760, 480)
    await settle(page, 400)
    const vis = click === "timeline" ? s.timeline && s.drawing && s.view3d && !s.style : !s.drawing
    const ok = ready && during === "drawing" && (tip ?? "").includes(want) && cur === null && ids === six && six.split(",").length === 6 && vis
    out.push({ ok, detail: `${click} read aria-pressed ${ready ? pressed : "WRONG"}, tooltip ${tip === null ? "none" : JSON.stringify(tip)}, with ${during} maximized; after the click: max ${cur}, ${ids.split(",").length} panels${ids === six ? "" : " CHANGED"}, ${["drawing", "view3d", "style", "timeline"].map((k) => `${k} ${s[k] ? "shown" : "hidden"}`).join(", ")}` })
  }
  await ctx.close()
  return out
}
{
  const r = await railClick(null)
  row("X10", "a rail click while maximized does what its label said, Timeline on show and Drawing on hide", r.every((x) => x.ok), r.map((x) => x.detail).join(" | "))
  const m = await railClick("railAfter")
  fired("X10", "restore first, then flip what the restored layout shows", m.some((x) => !x.ok), m.map((x) => `${x.ok ? "held" : "WRONG"}: ${x.detail}`).join(" | "))
}

async function lgCross(mutant) {
  const { ctx, page } = await fresh(mutant)
  await resetTo(page, "style")
  const six = await panelIds(page)
  await M(page, "toggle", "style")
  await settle(page, 500)
  const during = await M(page, "current")
  await page.setViewportSize({ width: 1023, height: 982 })
  await settle(page, 1200)
  await page.setViewportSize({ width: 1512, height: 982 })
  await settle(page, 1200)
  const cur = await M(page, "current")
  const pressedN = await page.locator('[data-maximize][aria-pressed="true"]').count()
  const label = await page.evaluate(() => { const b = document.querySelector('[data-maximize="style"]'); return b ? b.getAttribute("aria-label") ?? b.getAttribute("title") ?? b.textContent : null })
  const before = (await shownOf(page)).style
  await page.locator('[data-rail-panel="style"]').click()
  await page.mouse.move(760, 480)
  await settle(page, 700)
  const saved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem("fs.layout.v1.style") ?? "null") } catch { return null } })
  const leaf = (n) => (n?.type === "leaf" ? (n.data?.views?.includes("style") ? n : null) : Array.isArray(n?.data) ? n.data.map(leaf).find(Boolean) ?? null : null)
  const styleLeaf = saved ? leaf(saved.grid?.root) : null
  const up = await reloadUp(page)
  const back = up ? { ws: await page.evaluate(() => window.__dockHarness.workspace.current()), ids: await panelIds(page), style: (await shownOf(page)).style, cur: await M(page, "current") } : null
  await ctx.close()
  const ok = during === "style" && cur === null && pressedN === 0 && label === "Maximize Style" && before === true && styleLeaf?.visible === false && !!back && back.ws === "style" && back.ids === six && back.style === false && back.cur === null
  return { ok, detail: `maximized ${during}; after 1023 px and back: max ${cur}, ${pressedN} maximize button(s) pressed, Style's reads ${JSON.stringify(label)}; the rail hid Style (shown before: ${before}), the save's Style group visible ${styleLeaf ? String(styleLeaf.visible) : "NO SAVE"}; reload: ${back ? `${back.ws}, ${back.ids.split(",").length} panels, Style ${back.style ? "shown" : "hidden"}, max ${back.cur}` : "the harness never came"}` }
}
{
  const r = await lgCross(null)
  row("X11", "crossing 1024 px clears maximize, and the next change saves", r.ok, r.detail)
  const m = await lgCross("lgKeepMax")
  fired("X11", "the lg handler leaves maxRef set", !m.ok, m.detail)
}

async function badSave(mutant) {
  const { ctx, page } = await fresh(mutant)
  await resetTo(page, "draw")
  const six = await panelIds(page)
  const base = JSON.parse(await json(page))
  const bad = { ...base, floatingGroups: [{ data: { id: 7, views: [] }, position: { left: 40, top: 40, width: 240, height: 160 } }] }
  const problem = W.layoutProblem(bad)
  await page.evaluate((s) => localStorage.setItem("fs.layout.v1.draw", s), JSON.stringify(bad))
  const note = () => page.locator("[data-sonner-toast]").filter({ hasText: "The saved Draw layout was not loaded" })
  const up1 = await reloadUp(page, mutant ? 45000 : 240000)
  const seen = await note().first().waitFor({ state: "visible", timeout: 6000 }).then(() => true, () => false)
  const text = seen ? ((await note().first().textContent()) ?? "") : ""
  const ids1 = up1 ? await panelIds(page) : ""
  // The fallback's save is debounced (300 ms, after the load's fit); a fixed wait, not one on the outcome.
  if (up1) await settle(page, 900)
  const stored = up1 ? await page.evaluate(() => localStorage.getItem("fs.layout.v1.draw")) : null
  const replaced = stored !== null && stored !== JSON.stringify(bad)
  const up2 = up1 ? await reloadUp(page) : false
  const ids2 = up2 ? await panelIds(page) : ""
  // Give the note the same chance to show as on the first reload.
  const again = up2 ? await note().first().waitFor({ state: "visible", timeout: 3000 }).then(() => note().count(), () => 0) : 0
  await ctx.close()
  const ok = problem === null && up1 && seen && text.includes("Dockview could not load it") && ids1 === six && up2 && ids2 === six && again === 0
  return { ok, again, detail: `layoutProblem ${problem === null ? "passes it" : `refuses it (${problem})`}; reload: ${up1 ? `${ids1.split(",").filter(Boolean).length} panels${ids1 === six ? "" : " NOT the six"}` : "the harness never came"}, toast ${seen ? JSON.stringify(text.slice(0, 160)) : "NOT on screen"}; the save ${stored === null ? "gone" : replaced ? "replaced" : "still the bad one"}; next reload: ${up2 ? `${ids2.split(",").filter(Boolean).length} panels, ${again} note(s)` : "not reached"}` }
}
{
  const r = await badSave(null)
  row("X12", "a save dockview throws on opens the default, says so, and the next reload loads", r.ok, r.detail)
  const m = await badSave("nocatch")
  fired("X12", "the shell's catch removed", !m.ok, m.detail)
  const k = await badSave("keepBad")
  fired("X12", "the fallback leaves the bad save (the note again on the next reload)", k.again > 0, k.detail)
}

row("G1", "the lane pages threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")
await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
