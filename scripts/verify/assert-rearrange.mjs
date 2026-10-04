#!/usr/bin/env node
// assert-rearrange.mjs · EVERY PANEL CAN ALWAYS BE REARRANGED
//
//   FS_PORT=3138 FS_HEADED=0 node scripts/verify/assert-rearrange.mjs [--only=RA1,RA8]
//
// His ruling of 2026-10-02: the new layout stands as long as every panel can always be rearranged ("Just
// make sure we can always rearrange the different windows and stuff"). In every workspace (Draw, Style,
// Animate), and with any panel maximized and restored: any panel can be dragged by its header to another
// edge or into another panel's tab group, the dividers resize, the arrangement is kept per workspace
// across a reload, and Reset puts the default back. Nothing may lock a panel in place. And (a Claude
// lane's finding the same day, the Drawing toolbar's Spacing slider cut off at 35%): every panel stays
// usable at any width he can drag it to.
//
// The page is `components/dock-shell.tsx` over dockview 8.3.1. Panels are moved two ways: a REAL pointer
// drag (page.mouse down, move, up on the panel's header tab, which is dockview's HTML5 drag in Chromium)
// and dockview's own API (`panel.api.moveTo`). Read back through `__dockHarness.api`: which group holds
// each panel, each group's box, and whether it shows.
//
// Rows, each with a must-fail on a page that must fail it (`window.__fsDockMutant`, read once by the
// shell; `window.__fsToolbarMutant` for RA8):
//   RA1  REAL DRAGS. In each workspace, every panel whose header shows is dragged by its header tab with
//        the mouse: odd ones to the right edge of another panel (a new group to its right), even ones onto
//        another panel's middle (into its tab group). Each lands where it was dropped. must-fail:
//        "nodrag", the shell's old `disableDnd`: every drag leaves the panel where it was.
//   RA2  API MOVES. In each workspace, each of the six panels is moved with `moveTo` to the left, right,
//        top and bottom of another panel and into its group: 3 x 6 x 5 moves. Each lands, shows, and is
//        still there 600 ms later. must-fail: "pinned", the layout put back after every move (what any
//        code that holds a panel in place does).
//   RA3  DIVIDERS. In each workspace a real drag of 80 px on the divider beside the 3D view moves it by
//        80 px (within 4). must-fail: "locked", the shell's old `locked`, sashes disabled.
//   RA4  KEPT ACROSS A RELOAD. A move in each workspace, a reload, and each workspace comes back on its own
//        moved arrangement. must-fail: "nosave", nothing saved.
//   RA5  RESET. After moves in each workspace, Reset gives the workspace's default arrangement, the same
//        as a fresh load with no save. must-fail: "noreset", Reset does nothing.
//   RA6  AFTER MAXIMIZE AND RESTORE. In each workspace, every shown panel maximized and restored, then a
//        real drag and an API move still land. must-fail: "nodrag".
//   RA7  A DRAG WHILE MAXIMIZED. The dock maximized in Animate, its Export tab dragged to the dock's right
//        edge, then restored: Export keeps its new group beside the Timeline, every panel shown before is
//        shown, and the 3D view is back in the grid. must-fail: "restoreDefault", restore loads the
//        default and the drag is lost.
//   RA8  EVERY TOOLBAR CONTROL INSIDE ITS PANEL. In each workspace, each shown panel (and the dock, moved
//        beside the 3D view) at 35% and at 25% of the shell's width: every control in its header and in
//        its toolbars (every control not inside a scroll region of the panel) lies fully inside the
//        panel's box and is the element hit at its centre. must-fail: `__fsToolbarMutant = "nowrap"`,
//        the Drawing toolbar's pre-fix single row (the Spacing slider cut off).
//   RA9  A BAD SAVE NEVER KILLS THE PAGE (the controller's review, D1 to D5 from CLOUD-TESTS'
//        assert-workspace-layouts): a saved Draw layout with a numeric group id, a leaf for a root, a null
//        Style entry, a Drawing entry naming panel "ghost", a 3D view entry naming component "ghost".
//        Lane: each opens on Draw's default, the six panels each under its own component, with a note
//        and no page error. "unchecked" (the save reaches fromJSON without layoutProblem): the two that
//        dockview throws on (D1, D2) still open on the default, with a note. must-fail: "nocatch", the same
//        with no catch, and the page does not come up.
//   G1   no page error on the lane pages.

const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
import { readFileSync } from "node:fs"

const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const ONLY = (process.argv.find((a) => a.startsWith("--only=")) ?? "").slice(7).split(",").filter(Boolean)
const want = (id) => ONLY.length === 0 || ONLY.includes(id)
let pass = 0, fail = 0
const row = (id, name, ok, detail = "") => {
  ok ? pass++ : fail++
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(4)} ${name}${detail ? `  :  ${detail}` : ""}`)
}
const fired = (id, name, red, detail = "") => {
  red ? pass++ : fail++
  console.log(`${red ? "FIRED" : "BLIND"} ${id.padEnd(4)} must-fail: ${name}${detail ? `  :  ${detail}` : ""}`)
}

const WS = ["draw", "style", "animate"]
const PANELS = ["drawing", "view3d", "style", "timeline", "drawin", "export"]
const browser = await chromium.launch()
const errors = []

const clearLayouts = () => { try { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout.")) localStorage.removeItem(k) } catch {} }
async function open({ mutant = null, toolbar = null, size = [1512, 982], ctx: given = null } = {}) {
  const ctx = given ?? (await browser.newContext({ viewport: { width: size[0], height: size[1] } }))
  if (!given) {
    await ctx.addInitScript(clearLayouts)
    if (mutant) await ctx.addInitScript((m) => { window.__fsDockMutant = m }, mutant)
    if (toolbar) await ctx.addInitScript((m) => { window.__fsToolbarMutant = m }, toolbar)
  }
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!mutant && !toolbar) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__dockHarness?.workspace, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate(() => { window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) })
  await settle(page, 500)
  return { ctx, page }
}
const settle = async (page, ms = 250) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const switchWs = async (page, ws) => { await page.evaluate((w) => window.__dockHarness.workspace.switch(w), ws); await settle(page, 400) }
const reset = async (page) => { await page.evaluate(() => window.__dockHarness.workspace.reset()); await settle(page, 400) }

/** Where every panel is: its group's id, box, whether it shows, and which panels share it. */
const where = (page) => page.evaluate((ids) => {
  const api = window.__dockHarness.api
  const out = {}
  for (const id of ids) {
    const p = api.getPanel(id)
    if (!p) { out[id] = null; continue }
    const g = p.group
    const r = g.element.getBoundingClientRect()
    out[id] = { g: g.id, vis: g.api.isVisible && r.width > 0 && r.height > 0, loc: g.api.location.type, l: r.left, t: r.top, r: r.right, b: r.bottom, with: g.panels.map((x) => x.id).sort() }
  }
  return out
}, PANELS)
const shownPanels = async (page) => {
  const w = await where(page)
  return PANELS.filter((id) => w[id]?.vis && w[id].loc === "grid")
}

/** The panel's header tab: the element a drag starts on. */
const tabCentre = (page, id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-panel-tab="${id}"]`) ?? document.querySelector(`[data-dock-tab="${id}"]`)
  const tab = el?.closest(".dv-tab") ?? el
  if (!tab) return null
  const r = tab.getBoundingClientRect()
  if (!(r.width > 0 && r.height > 0)) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}, id)
/** A point in a group's content: its middle, or near one edge. */
const contentPoint = (page, id, at) => page.evaluate(([id, at]) => {
  const g = window.__dockHarness.api.getPanel(id).group
  const c = g.element.querySelector(":scope > .dv-content-container") ?? g.element
  const r = c.getBoundingClientRect()
  const k = 0.06
  const x = at === "right" ? r.right - r.width * k : at === "left" ? r.left + r.width * k : r.left + r.width / 2
  const y = at === "bottom" ? r.bottom - r.height * k : at === "top" ? r.top + r.height * k : r.top + r.height / 2
  return { x, y }
}, [id, at])
async function realDrag(page, from, to) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + 6, from.y + 6, { steps: 3 })
  await page.mouse.move(to.x, to.y, { steps: 14 })
  await page.waitForTimeout(150)
  await page.mouse.move(to.x + 1, to.y + 1, { steps: 2 })
  await page.waitForTimeout(80)
  await page.mouse.up()
  await settle(page, 400)
}

/** Did `id` land `pos` of `target`? `pos` is left, right, top, bottom or center. */
function landed(w, id, target, pos) {
  const a = w[id], b = w[target]
  if (!a || !b || !a.vis) return false
  if (pos === "center") return a.g === b.g
  if (a.g === b.g) return false
  const ov = (lo1, hi1, lo2, hi2) => Math.min(hi1, hi2) - Math.max(lo1, lo2) > 4
  if (pos === "right") return a.l >= b.r - 4
  if (pos === "left") return a.r <= b.l + 4
  if (pos === "bottom") return a.t >= b.b - 4 && ov(a.l, a.r, b.l, b.r)
  if (pos === "top") return a.b <= b.t + 4 && ov(a.l, a.r, b.l, b.r)
  return false
}
/** A target for `id`: a shown panel in another group, the 3D view when it can be. */
const targetFor = (w, id) => {
  const order = ["view3d", "drawing", "style", "timeline"]
  return order.find((t) => t !== id && w[t]?.vis && w[t].loc === "grid" && w[t].g !== w[id]?.g) ?? null
}

// ---------------------------------------------------------------- RA1
async function realDrags(mutant) {
  const { ctx, page } = await open({ mutant })
  const out = []
  for (const ws of WS) {
    await switchWs(page, ws)
    await reset(page)
    const shown = await shownPanels(page)
    // Every panel whose header tab is on screen: the shown ones and the dock's three tabs.
    const movers = PANELS.filter((id) => shown.includes(id) || ["timeline", "drawin", "export"].includes(id))
    let n = 0
    for (const id of movers) {
      await reset(page)
      const w0 = await where(page)
      const target = targetFor(w0, id)
      const from = await tabCentre(page, id)
      if (!target || !from) { out.push({ ws, id, ok: false, why: `no ${target ? "tab" : "target"}` }); continue }
      const pos = n++ % 2 === 0 ? "right" : "center"
      const to = await contentPoint(page, target, pos)
      await realDrag(page, from, to)
      const w1 = await where(page)
      out.push({ ws, id, target, pos, ok: landed(w1, id, target, pos) })
    }
  }
  await reset(page)
  await ctx.close()
  return out
}
if (want("RA1")) {
  const r = await realDrags(null)
  const bad = r.filter((x) => !x.ok)
  row("RA1", "a real drag on every shown panel's header lands it beside or into another panel, 3 workspaces", r.length > 0 && bad.length === 0, `${r.length - bad.length} of ${r.length} landed${bad.length ? `; missed: ${bad.map((x) => `${x.ws}/${x.id}->${x.pos ?? ""} ${x.target ?? x.why}`).join(", ")}` : ""}`)
  const m = await realDrags("nodrag")
  fired("RA1", "dragging switched off (the old disableDnd)", m.every((x) => !x.ok), `${m.filter((x) => x.ok).length} of ${m.length} landed`)
}

// ---------------------------------------------------------------- RA2
async function apiMoves(mutant) {
  const { ctx, page } = await open({ mutant })
  const out = []
  for (const ws of WS) {
    await switchWs(page, ws)
    for (const id of PANELS) {
      for (const pos of ["left", "right", "top", "bottom", "center"]) {
        await reset(page)
        const w0 = await where(page)
        const target = targetFor(w0, id)
        if (!target) { out.push({ ws, id, pos, ok: false, why: "no target" }); continue }
        let now = false, later = false
        try {
          await page.evaluate(([id, target, pos]) => {
            const api = window.__dockHarness.api
            api.getPanel(id).api.moveTo({ group: api.getPanel(target).group, position: pos })
          }, [id, target, pos])
          await settle(page, 150)
          now = landed(await where(page), id, target, pos)
          await settle(page, 600)
          later = landed(await where(page), id, target, pos)
        } catch (e) {
          // A page that dies on a move did not keep it.
          out.push({ ws, id, target, pos, ok: false, now, later, why: `page died: ${String(e.message).split("\n")[0]}` })
          await ctx.close().catch(() => {})
          return out
        }
        out.push({ ws, id, target, pos, ok: now && later, now, later })
      }
    }
  }
  await reset(page)
  await ctx.close()
  return out
}
if (want("RA2")) {
  const r = await apiMoves(null)
  const bad = r.filter((x) => !x.ok)
  row("RA2", "moveTo puts each of the 6 panels left, right, top, bottom of and into another panel, 3 workspaces, and it stays", r.length === 90 && bad.length === 0, `${r.length - bad.length} of ${r.length}${bad.length ? `; failed: ${bad.slice(0, 8).map((x) => `${x.ws}/${x.id} ${x.pos} of ${x.target ?? x.why} (now ${x.now}, 600 ms ${x.later})`).join(", ")}` : ""}`)
  const m = await apiMoves("pinned")
  fired("RA2", "the layout put back after every move", m.some((x) => !x.ok), `${m.filter((x) => !x.ok).length} of ${m.length} did not stay`)
}

// ---------------------------------------------------------------- RA3
async function dividers(mutant) {
  const { ctx, page } = await open({ mutant })
  const out = []
  for (const ws of WS) {
    await switchWs(page, ws)
    await reset(page)
    // The divider on the 3D view's right edge (Draw: the drawing's on its left) and the one above the dock.
    const sashes = await page.evaluate(() => {
      const api = window.__dockHarness.api
      const v = api.getPanel("view3d").group.element.getBoundingClientRect()
      const d = api.getPanel("timeline").group.element.getBoundingClientRect()
      const near = (x, y, vertical) => {
        let best = null
        const shell = document.querySelector("[data-fs-dock-box]").getBoundingClientRect()
        for (const s of document.querySelectorAll(".dv-sash")) {
          const r = s.getBoundingClientRect()
          if (!(r.width > 0 && r.height > 0)) continue
          // A sash on the shell's edge sits beside a hidden group: nothing to drag there.
          if (r.left + r.width / 2 <= shell.left + 4 || r.left + r.width / 2 >= shell.right - 4) continue
          const isV = r.height > r.width
          if (isV !== vertical) continue
          const c = vertical ? { x: r.left + r.width / 2, y: Math.min(Math.max(y, r.top + 2), r.bottom - 2) } : { x: Math.min(Math.max(x, r.left + 2), r.right - 2), y: r.top + r.height / 2 }
          const dist = Math.hypot(c.x - x, c.y - y)
          if (!best || dist < best.dist) best = { ...c, dist }
        }
        return best && best.dist < 12 ? best : null
      }
      return {
        side: near(v.right, v.top + v.height / 2, true) ?? near(v.left, v.top + v.height / 2, true),
        dock: near(d.left + d.width / 2, d.top, false),
      }
    })
    for (const [name, s] of Object.entries(sashes)) {
      if (!s) { out.push({ ws, name, ok: false, why: "no divider found" }); continue }
      const vertical = name === "side"
      const before = await where(page)
      await page.mouse.move(s.x, s.y)
      await page.mouse.down()
      await page.mouse.move(s.x + (vertical ? -80 : 0), s.y + (vertical ? 0 : -80), { steps: 10 })
      await page.mouse.up()
      await settle(page, 400)
      const after = await where(page)
      const moved = vertical ? (after.view3d.r - after.view3d.l) - (before.view3d.r - before.view3d.l) : (before.timeline.t - after.timeline.t)
      const ok = vertical ? Math.abs(Math.abs(moved) - 80) <= 4 : Math.abs(moved - 80) <= 4
      out.push({ ws, name, ok, moved: Math.round(moved) })
    }
  }
  await reset(page)
  await ctx.close()
  return out
}
if (want("RA3")) {
  const r = await dividers(null)
  row("RA3", "a real 80 px drag on a divider moves it 80 px: beside the 3D view and above the dock, 3 workspaces", r.every((x) => x.ok), r.map((x) => `${x.ws}/${x.name} ${x.why ?? `${x.moved} px`}`).join(", "))
  const m = await dividers("locked")
  fired("RA3", "dividers locked (the old locked)", m.every((x) => !x.ok), m.map((x) => `${x.ws}/${x.name} ${x.why ?? `${x.moved} px`}`).join(", "))
}

// ---------------------------------------------------------------- RA4
const MOVES = { draw: ["style", "drawing", "right"], style: ["drawin", "view3d", "left"], animate: ["export", "style", "bottom"] }
async function kept(mutant) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  await ctx.addInitScript(() => { if (!sessionStorage.getItem("ra4")) { sessionStorage.setItem("ra4", "1"); try { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout.")) localStorage.removeItem(k) } catch {} } })
  if (mutant) await ctx.addInitScript((m) => { window.__fsDockMutant = m }, mutant)
  const { page } = await open({ mutant, ctx })
  for (const ws of WS) {
    await switchWs(page, ws)
    const [id, target, pos] = MOVES[ws]
    await page.evaluate(([id, target, pos]) => { const api = window.__dockHarness.api; api.getPanel(id).api.moveTo({ group: api.getPanel(target).group, position: pos }) }, [id, target, pos])
    await settle(page, 700)
  }
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => window.__dockHarness?.workspace, null, { timeout: 240000 })
  await settle(page, 800)
  const out = []
  for (const ws of WS) {
    await switchWs(page, ws)
    const [id, target, pos] = MOVES[ws]
    out.push({ ws, ok: landed(await where(page), id, target, pos), move: `${id} ${pos} of ${target}` })
  }
  await ctx.close()
  return out
}
if (want("RA4")) {
  const r = await kept(null)
  row("RA4", "a move in each workspace survives a reload, each workspace on its own arrangement", r.every((x) => x.ok), r.map((x) => `${x.ws}: ${x.move} ${x.ok ? "kept" : "LOST"}`).join(", "))
  const m = await kept("nosave")
  fired("RA4", "nothing saved", m.some((x) => !x.ok), m.map((x) => `${x.ws}: ${x.ok ? "kept" : "lost"}`).join(", "))
}

// ---------------------------------------------------------------- RA5
const shape = (w) => {
  // Each shown panel's group, by the panels it holds, and its box to 4 px.
  const gs = {}
  for (const [id, v] of Object.entries(w)) if (v && v.vis) gs[v.with.join("+")] = [v.l, v.t, v.r, v.b].map((n) => Math.round(n / 4))
  return JSON.stringify(Object.keys(gs).sort().map((k) => [k, gs[k]]))
}
async function resets(mutant) {
  const fresh = {}
  {
    const { ctx, page } = await open()
    for (const ws of WS) { await switchWs(page, ws); fresh[ws] = shape(await where(page)) }
    await ctx.close()
  }
  const { ctx, page } = await open({ mutant })
  const out = []
  for (const ws of WS) {
    await switchWs(page, ws)
    const [id, target, pos] = MOVES[ws]
    await page.evaluate(([id, target, pos]) => { const api = window.__dockHarness.api; api.getPanel(id).api.moveTo({ group: api.getPanel(target).group, position: pos }) }, [id, target, pos])
    await settle(page, 400)
    const moved = shape(await where(page))
    await reset(page)
    const back = shape(await where(page))
    out.push({ ws, ok: moved !== fresh[ws] && back === fresh[ws], moved: moved !== fresh[ws] })
  }
  await ctx.close()
  return out
}
if (want("RA5")) {
  const r = await resets(null)
  row("RA5", "Reset after a move gives each workspace's fresh default", r.every((x) => x.ok), r.map((x) => `${x.ws}: ${x.moved ? "moved" : "DID NOT MOVE"}, ${x.ok ? "default back" : "NOT the default"}`).join(", "))
  const m = await resets("noreset")
  fired("RA5", "Reset does nothing", m.some((x) => !x.ok), m.map((x) => `${x.ws}: ${x.ok ? "default" : "not default"}`).join(", "))
}

// ---------------------------------------------------------------- RA6
async function afterMax(mutant) {
  const { ctx, page } = await open({ mutant })
  const out = []
  for (const ws of WS) {
    await switchWs(page, ws)
    await reset(page)
    for (const id of await shownPanels(page)) {
      await page.evaluate((id) => window.__dockHarness.maximize.toggle(id), id)
      await settle(page, 300)
      await page.evaluate(() => window.__dockHarness.maximize.restore())
      await settle(page, 300)
    }
    // A real drag: the Style panel (Draw: the Drawing) to the 3D view's right edge.
    const mover = ws === "draw" ? "drawing" : "style"
    const from = await tabCentre(page, mover)
    const to = await contentPoint(page, "view3d", "right")
    if (from) await realDrag(page, from, to)
    const drag = landed(await where(page), mover, "view3d", "right")
    // An API move: Export to the left of the 3D view.
    await page.evaluate(() => { const api = window.__dockHarness.api; api.getPanel("export").api.moveTo({ group: api.getPanel("view3d").group, position: "left" }) })
    await settle(page, 600)
    const move = landed(await where(page), "export", "view3d", "left")
    out.push({ ws, ok: drag && move, drag, move })
  }
  await reset(page)
  await ctx.close()
  return out
}
if (want("RA6")) {
  const r = await afterMax(null)
  row("RA6", "after every shown panel is maximized and restored, a real drag and an API move land, 3 workspaces", r.every((x) => x.ok), r.map((x) => `${x.ws}: drag ${x.drag}, move ${x.move}`).join(", "))
  const m = await afterMax("nodrag")
  fired("RA6", "dragging switched off", m.some((x) => !x.drag), m.map((x) => `${x.ws}: drag ${x.drag}`).join(", "))
}

// ---------------------------------------------------------------- RA7
async function whileMax(mutant) {
  const { ctx, page } = await open({ mutant })
  await switchWs(page, "animate")
  await reset(page)
  const before = await shownPanels(page)
  await page.evaluate(() => window.__dockHarness.maximize.toggle("timeline"))
  await settle(page, 500)
  const from = await tabCentre(page, "export")
  const to = await contentPoint(page, "timeline", "right")
  if (from) await realDrag(page, from, to)
  const during = landed(await where(page), "export", "timeline", "right")
  await page.evaluate(() => window.__dockHarness.maximize.restore())
  await settle(page, 600)
  const w = await where(page)
  const after = landed(w, "export", "timeline", "right")
  const shown = await shownPanels(page)
  const lost = before.filter((id) => !shown.includes(id))
  const view = w.view3d?.loc
  await ctx.close()
  return { ok: during && after && lost.length === 0 && view === "grid", during, after, lost, view }
}
if (want("RA7")) {
  const r = await whileMax(null)
  row("RA7", "Export dragged out of the maximized dock keeps its place after restore; every panel back, the 3D view docked", r.ok, `landed while maximized ${r.during}, after restore ${r.after}, panels lost ${r.lost.join(", ") || "none"}, 3D view ${r.view}`)
  const m = await whileMax("restoreDefault")
  fired("RA7", "restore loads the default", !m.ok, `after restore ${m.after}, 3D view ${m.view}`)
}

// ---------------------------------------------------------------- RA8
const TOOLBAR_READ = () => {
  const api = window.__dockHarness.api
  const out = {}
  for (const g of api.groups) {
    if (!g.api.isVisible || g.api.location.type !== "grid") continue
    const box = g.element.getBoundingClientRect()
    if (!(box.width > 0)) continue
    const id = g.activePanel?.id
    const content = id ? document.querySelector(`[data-dock-panel="${id}"]`) : null
    const scrolls = (el, stop) => {
      for (let p = el.parentElement; p && p !== stop; p = p.parentElement) {
        const s = getComputedStyle(p)
        if (/(auto|scroll)/.test(s.overflowY) || /(auto|scroll)/.test(s.overflowX)) return true
      }
      return false
    }
    const controls = []
    const head = g.element.querySelector(":scope > .dv-tabs-and-actions-container")
    for (const root of [head, content]) {
      if (!root) continue
      for (const el of root.querySelectorAll("button, input, select, textarea, [role=slider], [role=switch], [role=combobox]")) {
        if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: false })) continue
        if (el.closest("[data-rail-tooltip], [data-radix-popper-content-wrapper]")) continue
        if (root === content && scrolls(el, content)) continue
        const r = el.getBoundingClientRect()
        if (!(r.width > 0 && r.height > 0)) continue
        const label = (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || el.tagName).trim().slice(0, 24)
        const inside = r.left >= box.left - 0.5 && r.right <= box.right + 0.5 && r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5
        const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1)
        const hit = document.elementFromPoint(cx, cy)
        const reach = !!hit && (hit === el || el.contains(hit) || hit.contains(el))
        controls.push({ label, ok: inside && reach, inside, reach })
      }
    }
    out[g.panels.map((p) => p.id).join("+")] = { w: Math.round(box.width), n: controls.length, bad: controls.filter((c) => !c.ok).map((c) => `${c.label}${c.inside ? "" : " (cut)"}${c.reach ? "" : " (covered)"}`) }
  }
  return out
}
async function widths(toolbar) {
  const { ctx, page } = await open({ toolbar })
  const out = []
  for (const ws of WS) {
    await switchWs(page, ws)
    await reset(page)
    const shell = await page.evaluate(() => document.querySelector("[data-fs-dock-box]").getBoundingClientRect().width)
    const shown = (await shownPanels(page)).filter((id) => ["drawing", "view3d", "style"].includes(id))
    // The dock's own width is the shell's where the workspace puts it; beside the 3D view it can be any.
    for (const id of [...shown, "timeline"]) {
      for (const k of [0.35, 0.25]) {
        await reset(page)
        if (id === "timeline") {
          await page.evaluate(() => { const api = window.__dockHarness.api; api.getPanel("timeline").api.moveTo({ group: api.getPanel("view3d").group, position: "right" }) })
          await settle(page, 300)
        }
        await page.evaluate(([id, w]) => window.__dockHarness.api.getPanel(id).group.api.setSize({ width: w }), [id, Math.round(shell * k)])
        await settle(page, 500)
        const got = await page.evaluate((id) => window.__dockHarness.api.getPanel(id).group.element.getBoundingClientRect().width, id)
        const read = await page.evaluate(TOOLBAR_READ)
        const key = Object.keys(read).find((x) => x.split("+").includes(id))
        const r = read[key] ?? { n: 0, bad: ["panel not found"] }
        out.push({ ws, id, k, w: Math.round(got), sized: Math.abs(got - shell * k) <= Math.max(6, shell * 0.01), n: r.n, bad: r.bad })
      }
    }
  }
  await ctx.close()
  return out
}
if (want("RA8")) {
  const r = await widths(null)
  const bad = r.filter((x) => !x.sized || x.bad.length || x.n === 0)
  row("RA8", "at 35% and 25% width every header and toolbar control lies inside its panel and is hit at its centre, 3 workspaces", r.length > 0 && bad.length === 0, `${r.length - bad.length} of ${r.length} panel widths clean, ${r.reduce((n, x) => n + x.n, 0)} controls read${bad.length ? `; ${bad.map((x) => `${x.ws}/${x.id}@${Math.round(x.k * 100)}% (${x.w} px${x.sized ? "" : ", NOT SIZED"}): ${x.n === 0 ? "no controls read" : x.bad.join(", ")}`).join(" | ")}` : ""}`)
  const m = await widths("nowrap")
  const mBad = m.filter((x) => x.bad.length)
  fired("RA8", "the Drawing toolbar's pre-fix single row", mBad.length > 0, mBad.map((x) => `${x.ws}/${x.id}@${Math.round(x.k * 100)}%: ${x.bad.join(", ")}`).join(" | "))
}

// ---------------------------------------------------------------- RA9
const BAD = {
  D1: (l) => { const leaf = (function first(n) { return n.type === "leaf" ? n : n.data.map(first).find(Boolean) })(l.grid.root); leaf.data.id = 7; return l },
  D2: (l) => { l.grid.root = { type: "leaf", data: { views: ["drawing", "view3d", "style", "timeline", "drawin", "export"], activeView: "drawing", id: "g-one" }, size: l.grid.width }; return l },
  D3: (l) => { l.panels.style = null; return l },
  D4: (l) => { l.panels.drawing.id = "ghost"; return l },
  D5: (l) => { l.panels.view3d.contentComponent = "ghost"; return l },
}
async function badSave(mutant, which) {
  // The default Draw layout, from a clean page.
  const base = await (async () => { const { ctx, page } = await open(); const j = await page.evaluate(() => window.__dockHarness.workspace.json()); await ctx.close(); return JSON.parse(j) })()
  const out = []
  for (const k of which) {
    const save = JSON.stringify(BAD[k](structuredClone(base)))
    const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
    await ctx.addInitScript(([save, mutant]) => {
      try { localStorage.setItem("fs.layout.v1.draw", save); localStorage.setItem("fs.layout.v1.current", "draw") } catch {}
      if (mutant) window.__fsDockMutant = mutant
    }, [save, mutant])
    const page = await ctx.newPage()
    const errs = []
    page.on("pageerror", (e) => errs.push(e.message))
    await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
    let up = true
    try { await page.waitForFunction(() => window.__dockHarness?.workspace, null, { timeout: 60000 }) } catch { up = false }
    let six = false, note = ""
    if (up) {
      await settle(page, 1200)
      six = await page.evaluate(() => {
        const want = { drawing: "drawing", view3d: "view3d", style: "style", timeline: "timeline", drawin: "drawin", export: "export" }
        return Object.entries(want).every(([id]) => !!window.__dockHarness.api.getPanel(id) && !!document.querySelector(`[data-dock-panel="${id}"]`))
          && window.__dockHarness.api.panels.length === 6
      })
      note = await page.evaluate(() => [...document.querySelectorAll("[data-sonner-toast]")].map((t) => t.textContent).find((t) => /layout (was not|could not be) loaded/.test(t)) ?? "")
    }
    out.push({ k, ok: up && six && !!note && errs.length === 0, up, six, note: note.slice(0, 60), errs: errs.length })
    await ctx.close()
  }
  return out
}
if (want("RA9")) {
  const say = (r) => r.map((x) => `${x.k}: ${x.up ? `six ${x.six}, note "${x.note}", errors ${x.errs}` : "PAGE DID NOT COME UP"}`).join("; ")
  const r = await badSave(null, ["D1", "D2", "D3", "D4", "D5"])
  const c = await badSave("unchecked", ["D1", "D2"])
  row("RA9", "every bad save opens on the default with a note; past layoutProblem, the throwing ones still do", r.every((x) => x.ok) && c.every((x) => x.ok), `lane: ${say(r)} | unchecked: ${say(c)}`)
  const m = await badSave("nocatch", ["D1", "D2"])
  fired("RA9", "no catch round fromJSON", m.some((x) => !x.ok), say(m))
}

row("G1", "the lane pages threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")
await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
