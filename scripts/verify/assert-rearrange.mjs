#!/usr/bin/env node
// assert-rearrange.mjs · CAN A PERSON MOVE AND RESIZE THE PANELS? (CL-DOCK)
//
//   FS_PORT=3146 FS_HEADED=0 node scripts/verify/assert-rearrange.mjs
//
// His ruling, 2026-10-02: "Just make sure we can always rearrange the different windows and stuff."
// Until then components/dock-shell.tsx mounted dockview `locked` with `disableDnd`: on dockview 8.3.1
// `locked` disables every splitview and its CSS gives the sashes pointer-events none, so nothing moved.
//
// Every drag here is REAL pointer input: page.mouse down, a move in steps, up. No dockview API call moves or
// sizes anything; the API is only read. At 1512x982, storage cleared once per run, the logo drawn.
//   R1  the sash between Drawing and the 3D view, dragged 120 px left: Drawing narrows, the 3D view widens.
//   R2  the sash above the folded dock, dragged 200 px up: the dock grows, the column above shrinks.
//   R3  the 3D view's tab dragged onto the Drawing group's header: both panels now share one group.
//   R4  the 3D view's tab dragged onto the right edge of that group: the 3D view sits in a new group of its
//       own, right of Drawing.
//   C1  the 3D canvas is the SAME node through R3 and R4, its WebGL context is never lost, and the first
//       frame on screen after each drop is not blank (more than 0.5% of the canvas's pixels differ from its
//       corner colour in a screenshot of the canvas's box).
//   S1  the rail hides the moved 3D view and shows it again, back in its own group.
//   M1  maximize on the moved 3D view fills the dock area (within 1 px) and draws; restore returns the layout
//       equal in every value (byte-equal is printed when it holds; a key-order change alone is named, not failed).
//   W1  Style and Animate: a sash dragged 80 px and the Style tab dropped onto the 3D view's header, in each.
//   P1  per workspace: back on Draw, the moved Draw layout is the one shown.
//   P2  a reload comes back on the same Draw layout (groups, views and sizes within 2 px), and Style on its
//       moved layout; the 3D view draws (non-blank) after the reload.
// MUST-FAIL: the same run with `__fsDockMutant = "locked"` (the dock as it was): every drag row must read red.
// REFUSES TO RUN when the served JS lacks this lane's "locked" arm (a server for another tree).

const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
import { readFileSync } from "node:fs"

const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }
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
const settle = async (page, ms = 300) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

async function boot(page) {
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness && window.__dockHarness?.maximize, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 4, gapMs: 20 }), polys)
  await page.waitForTimeout(1200)
  await page.evaluate((st) => { window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) }, STILL)
  await settle(page, 800)
}

async function servedHasLane(page) {
  return page.evaluate(async () => {
    const urls = new Set([...document.scripts].map((s) => s.src).filter(Boolean))
    for (const e of performance.getEntriesByType("resource")) if (/\.js(\?|$)/.test(e.name)) urls.add(e.name)
    // The arm list, "savemax" then "locked" with any arms between (CLOUD-LAYOUT put four there).
    const re = /\\?"savemax\\?",(?:\s*\\?"\w+\\?",)*\s*\\?"locked\\?"/
    for (const u of urls) { try { if (re.test(await (await fetch(u)).text())) return u } catch {} }
    return null
  })
}

// ---- reads (the API is read, never driven) ----
const box = (page, js) => page.evaluate(js)
const groupBox = (page, id) => page.evaluate((id) => {
  const p = window.__dockHarness.api.getPanel(id)
  if (!p || !p.group.api.isVisible) return null
  const r = p.group.element.getBoundingClientRect()
  return { x: r.x, y: r.y, w: r.width, h: r.height, group: p.group.id }
}, id)
const json = (page) => page.evaluate(() => window.__dockHarness.workspace.json())
const shape = (j) => {
  const walk = (n) => n.type === "leaf"
    ? { v: [...n.data.views].sort().join("+"), s: Math.round(n.size ?? 0), vis: n.visible !== false }
    : { b: n.data.map(walk), s: Math.round(n.size ?? 0) }
  return walk(JSON.parse(j).grid.root)
}
const sameShape = (a, b, tol = 2) => {
  if (!!a.v !== !!b.v) return false
  if (Math.abs(a.s - b.s) > tol) return false
  if (a.v !== undefined) return a.v === b.v && a.vis === b.vis
  return a.b.length === b.b.length && a.b.every((x, i) => sameShape(x, b.b[i], tol))
}
/** Up to five paths where two layout JSONs differ, for a row that is not byte-equal. */
const diffPaths = (a, b) => {
  const out = []
  const walk = (x, y, path) => {
    if (out.length >= 5) return
    if (x && y && typeof x === "object" && typeof y === "object") { for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) walk(x[k], y[k], `${path}.${k}`); return }
    if (JSON.stringify(x) !== JSON.stringify(y)) out.push(`${path}: ${JSON.stringify(x)} -> ${JSON.stringify(y)}`)
  }
  walk(JSON.parse(a), JSON.parse(b), "")
  return out.join(", ")
}
/** The first object whose keys come back in another order (values equal), or "". */
const orderPath = (a, b) => {
  const walk = (x, y, path) => {
    if (!x || !y || typeof x !== "object" || typeof y !== "object") return ""
    if (Object.keys(x).join() !== Object.keys(y).join()) return `${path || "."} keys ${Object.keys(x).join(",")} -> ${Object.keys(y).join(",")}`
    for (const k of Object.keys(x)) { const r = walk(x[k], y[k], `${path}.${k}`); if (r) return r }
    return ""
  }
  return walk(JSON.parse(a), JSON.parse(b), "")
}
const views = (j) => JSON.stringify(shape(j), (k, v) => (k === "s" ? undefined : v))

/** The sash nearest a line: `axis` "x" for a column edge at x = at, "y" for a row edge at y = at. */
const sashAt = (page, axis, at, across) => page.evaluate(([axis, at, across]) => {
  const sel = axis === "x" ? ".dv-split-view-container.dv-horizontal > .dv-sash-container > .dv-sash" : ".dv-split-view-container.dv-vertical > .dv-sash-container > .dv-sash"
  let best = null
  for (const s of document.querySelectorAll(sel)) {
    const r = s.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    const c = axis === "x" ? r.x + r.width / 2 : r.y + r.height / 2
    const lo = axis === "x" ? r.y : r.x, hi = axis === "x" ? r.bottom : r.right
    if (across < lo || across > hi) continue
    const d = Math.abs(c - at)
    if (d <= 8 && (!best || d < best.d)) best = { d, x: axis === "x" ? c : across, y: axis === "x" ? across : c, pe: getComputedStyle(s).pointerEvents }
  }
  return best
}, [axis, at, across])

/** Press, move in steps, release: the only way this gate changes the layout. */
async function drag(page, from, to, steps = 20) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(from.x + Math.sign(to.x - from.x || 1) * 4, from.y + Math.sign(to.y - from.y || 1) * 4)
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps)
  await page.waitForTimeout(150)
  await page.mouse.up()
}
const centre = (page, js) => page.evaluate(js)
const tabCentre = (page, id) => centre(page, `(() => { const e = document.querySelector('[data-panel-tab="${id}"]'); if (!e) return null; const r = e.getBoundingClientRect(); return r.width ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null })()`)
const headerDrop = (page, id) => page.evaluate((id) => {
  const g = window.__dockHarness.api.getPanel(id).group
  const v = g.element.querySelector(".dv-void-container")
  const r = v.getBoundingClientRect()
  return { x: r.x + Math.min(24, r.width / 2), y: r.y + r.height / 2 }
}, id)
const edgeDrop = (page, id, side) => page.evaluate(([id, side]) => {
  const g = window.__dockHarness.api.getPanel(id).group
  const r = g.element.querySelector(".dv-content-container").getBoundingClientRect()
  return side === "right" ? { x: r.right - Math.max(6, r.width * 0.06), y: r.y + r.height / 2 } : { x: r.x + r.width / 2, y: r.bottom - Math.max(6, r.height * 0.06) }
}, [id, side])

/** What a person sees in the 3D canvas's box: the share of pixels that differ from its corner colour. */
async function seen(page) {
  const r = await page.evaluate(() => {
    const c = window.__fsRearrange?.canvas
    if (!c || !c.isConnected) return null
    const b = c.getBoundingClientRect()
    return b.width > 4 && b.height > 4 ? { x: b.x + 1, y: b.y + 1, width: b.width - 2, height: b.height - 2 } : null
  })
  if (!r) return { ok: false, frac: 0, why: "no 3D canvas on screen" }
  const png = await page.screenshot({ clip: r })
  return page.evaluate(async (u) => {
    const img = new Image()
    img.src = u
    await img.decode()
    const c = document.createElement("canvas")
    c.width = img.width; c.height = img.height
    const x = c.getContext("2d")
    x.drawImage(img, 0, 0)
    const d = x.getImageData(0, 0, c.width, c.height).data
    const bg = [d[0], d[1], d[2]]
    let n = 0
    for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 24) n++
    const frac = n / (d.length / 4)
    return { ok: frac > 0.005, frac: Math.round(frac * 10000) / 100 }
  }, `data:image/png;base64,${png.toString("base64")}`)
}
const canvasState = (page) => page.evaluate(() => {
  const now = window.__dockHarness.api.getPanel("view3d")?.view.content.element.querySelector("canvas")
  const t = window.__fsRearrange
  const gl = t.canvas.getContext("webgl2") || t.canvas.getContext("webgl")
  return { same: now === t.canvas, connected: t.canvas.isConnected, lost: t.lost + (gl && gl.isContextLost() ? 1 : 0) }
})

async function run(mutant) {
  const out = {}
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  await ctx.addInitScript(() => {
    if (sessionStorage.getItem("fs-rearrange")) return
    sessionStorage.setItem("fs-rearrange", "1")
    try { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout") || k.startsWith("fs.workspace")) localStorage.removeItem(k) } catch {}
  })
  if (mutant) await ctx.addInitScript((m) => { window.__fsDockMutant = m }, mutant)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!mutant) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await boot(page)
  if (!mutant) {
    const where = await servedHasLane(page)
    if (!where) { console.log(`REFUSED: the JS served at ${LAB_URL} lacks the CL-DOCK "locked" arm; this is not the cl-docs tree.`); process.exit(2) }
    console.log(`served: ${LAB_URL} carries the CL-DOCK arm (${where.replace(LAB_URL, "")})`)
  }
  if ((await page.evaluate(() => window.__dockHarness.workspace.current())) !== "draw") {
    await page.click('[data-rail-workspace="draw"]')
    await settle(page, 400)
  }
  await page.evaluate(() => {
    const c = window.__dockHarness.api.getPanel("view3d").view.content.element.querySelector("canvas")
    window.__fsRearrange = { canvas: c, lost: 0 }
    c.addEventListener("webglcontextlost", () => window.__fsRearrange.lost++)
  })
  const j0 = await json(page)

  // R1 · the column edge between Drawing and the 3D view.
  {
    const d = await groupBox(page, "drawing"), v = await groupBox(page, "view3d")
    const s = await sashAt(page, "x", d.x + d.w, d.y + d.h / 2)
    if (s) { await drag(page, s, { x: s.x - 120, y: s.y }); await settle(page, 400) }
    const d2 = await groupBox(page, "drawing"), v2 = await groupBox(page, "view3d")
    const dw = Math.round(d2.w - d.w), vw = Math.round(v2.w - v.w)
    out.R1 = { ok: !!s && dw <= -100 && vw >= 100, detail: s ? `sash at x=${Math.round(s.x)} (pointer-events ${s.pe}); Drawing ${Math.round(d.w)} -> ${Math.round(d2.w)} (${dw}), 3D ${Math.round(v.w)} -> ${Math.round(v2.w)} (+${vw})` : "no sash found" }
  }
  // R2 · the edge above the dock.
  {
    const k = await groupBox(page, "timeline"), d = await groupBox(page, "drawing")
    const s = k && (await sashAt(page, "y", k.y, d.x + d.w / 2))
    if (s) { await drag(page, s, { x: s.x, y: s.y - 200 }); await settle(page, 600) }
    const k2 = await groupBox(page, "timeline"), d2 = await groupBox(page, "drawing")
    const kh = Math.round(k2.h - k.h), dh = Math.round(d2.h - d.h)
    out.R2 = { ok: !!s && kh >= 150 && dh <= -150, detail: s ? `sash at y=${Math.round(s.y)} (pointer-events ${s.pe}); dock ${Math.round(k.h)} -> ${Math.round(k2.h)} (+${kh}), Drawing ${Math.round(d.h)} -> ${Math.round(d2.h)} (${dh})` : "no sash found" }
  }
  // R3 · the 3D view's tab into the Drawing group.
  {
    const from = await tabCentre(page, "view3d"), to = await headerDrop(page, "drawing")
    if (from) await drag(page, from, to)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const first = await seen(page)
    await settle(page, 400)
    const d = await groupBox(page, "drawing"), v = await groupBox(page, "view3d")
    const joined = await page.evaluate(() => { const a = window.__dockHarness.api; return a.getPanel("view3d").group.id === a.getPanel("drawing").group.id ? a.getPanel("view3d").group.panels.map((p) => p.id).join("+") : null })
    out.R3 = { ok: !!from && !!joined, detail: `${joined ? `one group holds ${joined}` : `3D in ${v?.group}, Drawing in ${d?.group}`}; layout ${views(j0) === views(await json(page)) ? "UNCHANGED" : "changed"}` }
    out.C1a = { first, state: await canvasState(page) }
  }
  // R4 · the 3D view's tab onto the right edge of that group.
  {
    const from = await tabCentre(page, "view3d"), to = await edgeDrop(page, "view3d", "right")
    if (from) await drag(page, from, to)
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const first = await seen(page)
    await settle(page, 600)
    const d = await groupBox(page, "drawing"), v = await groupBox(page, "view3d")
    const own = d && v && d.group !== v.group && v.x >= d.x + d.w - 2 && Math.abs(v.y - d.y) < 2
    out.R4 = { ok: !!out.R3.ok && !!own, detail: d && v ? `Drawing ${d.group} at x=${Math.round(d.x)} w=${Math.round(d.w)}, 3D ${v.group} at x=${Math.round(v.x)} w=${Math.round(v.w)}` : "a panel is not on screen" }
    out.C1b = { first, state: await canvasState(page) }
  }
  {
    const a = out.C1a, b = out.C1b
    const ok = out.R3.ok && out.R4.ok && a.state.same && b.state.same && b.state.connected && b.state.lost === 0 && a.first.ok && b.first.ok
    out.C1 = { ok, detail: `same node ${a.state.same}/${b.state.same}, context lost ${b.state.lost}; first frame after R3 ${a.first.frac}% non-background, after R4 ${b.first.frac}%` }
  }
  const jMoved = await json(page)

  // S1 · the rail's show/hide on the moved 3D view.
  {
    await page.click('[data-rail-panel="view3d"]'); await settle(page, 400)
    const hidden = !(await page.evaluate(() => window.__dockHarness.workspace.shown().view3d))
    await page.click('[data-rail-panel="view3d"]'); await settle(page, 500)
    const back = await page.evaluate(() => window.__dockHarness.workspace.shown().view3d)
    const d = await groupBox(page, "drawing"), v = await groupBox(page, "view3d")
    const own = !!d && !!v && d.group !== v.group
    out.S1 = { ok: out.R4.ok && hidden && back && own, detail: `hid ${hidden}, shown again ${back}, own group ${own}` }
  }
  // M1 · maximize the moved 3D view, then restore.
  {
    const before = await json(page)
    await page.click('[data-maximize="view3d"]'); await settle(page, 500)
    const fill = await page.evaluate(() => {
      const root = document.querySelector(".dv-dockview").getBoundingClientRect()
      const g = window.__dockHarness.api.getPanel("view3d").group.element.getBoundingClientRect()
      return { dx: Math.abs(g.x - root.x), dy: Math.abs(g.y - root.y), dw: Math.abs(g.width - root.width), dh: Math.abs(g.height - root.height), w: Math.round(g.width), h: Math.round(g.height), rw: Math.round(root.width), rh: Math.round(root.height) }
    })
    const fills = Math.max(fill.dx, fill.dy, fill.dw, fill.dh) <= 1
    const drawsMax = await seen(page)
    await page.click('[data-maximize="view3d"]'); await settle(page, 500)
    const after = await json(page)
    const same = before === after || diffPaths(before, after) === ""
    out.M1 = { ok: out.R4.ok && fills && drawsMax.ok && same, detail: `3D ${fill.w}x${fill.h} in ${fill.rw}x${fill.rh}; draws ${drawsMax.frac}%; restore ${before === after ? "byte-equal" : same ? `equal in every value, key order only (${orderPath(before, after)})` : `DIFFERENT (${diffPaths(before, after)})`}` }
  }
  // W1 · Style and Animate.
  out.W1 = { ok: true, detail: [] }
  const moved = {}
  for (const ws of ["style", "animate"]) {
    await page.click(`[data-rail-workspace="${ws}"]`); await settle(page, 600)
    const start = await json(page)
    const v = await groupBox(page, "view3d"), st = await groupBox(page, "style")
    const s = v && st && (await sashAt(page, "x", st.x, st.y + st.h / 2))
    if (s) { await drag(page, s, { x: s.x - 80, y: s.y }); await settle(page, 400) }
    const st2 = await groupBox(page, "style")
    const sized = !!st2 && Math.round(st2.w - st.w) >= 60
    const from = await tabCentre(page, "style"), to = await headerDrop(page, "view3d")
    if (from) await drag(page, from, to)
    await settle(page, 600)
    const joined = await page.evaluate(() => { const a = window.__dockHarness.api; return a.getPanel("style").group.id === a.getPanel("view3d").group.id })
    const ok = sized && joined && views(start) !== views(await json(page))
    out.W1.ok &&= ok
    out.W1.detail.push(`${ws}: Style ${Math.round(st?.w ?? 0)} -> ${Math.round(st2?.w ?? 0)} px, Style joined the 3D group ${joined}`)
    moved[ws] = await json(page)
  }
  out.W1.detail = out.W1.detail.join("; ")
  // P1 · back on Draw, the moved Draw layout.
  {
    await page.click('[data-rail-workspace="draw"]'); await settle(page, 700)
    const now = await json(page)
    const isDefault = sameShape(shape(now), shape(j0))
    out.P1 = { ok: out.R4.ok && sameShape(shape(now), shape(jMoved)) && !isDefault, detail: `Draw ${sameShape(shape(now), shape(jMoved)) ? "came back as moved" : "came back DIFFERENT"}; ${isDefault ? "IS" : "not"} the default arrangement (groups, views and sizes)` }
  }
  // P2 · reload.
  {
    await page.waitForTimeout(700)
    const before = await json(page)
    await page.reload({ waitUntil: "domcontentloaded", timeout: 240000 })
    await boot(page)
    const ws = await page.evaluate(() => window.__dockHarness.workspace.current())
    const after = await json(page)
    await page.evaluate(() => { window.__fsRearrange = { canvas: window.__dockHarness.api.getPanel("view3d").view.content.element.querySelector("canvas"), lost: 0 } })
    const draws = await seen(page)
    await page.click('[data-rail-workspace="style"]'); await settle(page, 600)
    const styleBack = await json(page)
    const styleOk = !!moved.style && views(styleBack) === views(moved.style)
    const same = sameShape(shape(after), shape(before))
    out.P2 = { ok: out.R4.ok && ws === "draw" && same && !sameShape(shape(after), shape(j0)) && draws.ok && styleOk, detail: `workspace ${ws}; Draw ${same ? "same groups, views and sizes" : "DIFFERENT"}; Style ${styleOk ? "as moved" : "NOT as moved"}; 3D draws ${draws.frac}%` }
  }
  await ctx.close()
  return out
}

const L = await run(null)
row("R1", "Drawing | 3D sash resizes", L.R1.ok, L.R1.detail)
row("R2", "the sash above the dock resizes", L.R2.ok, L.R2.detail)
row("R3", "3D tab dragged into the Drawing group", L.R3.ok, L.R3.detail)
row("R4", "3D tab dragged onto the right edge", L.R4.ok, L.R4.detail)
row("C1", "3D canvas survives both moves, never blank", L.C1.ok, L.C1.detail)
row("S1", "rail hides and shows the moved 3D view", L.S1.ok, L.S1.detail)
row("M1", "maximize fills after the move, restore returns the layout", L.M1.ok, L.M1.detail)
row("W1", "Style and Animate: a sash and a tab move", L.W1.ok, L.W1.detail)
row("P1", "each workspace keeps its own moved layout", L.P1.ok, L.P1.detail)
row("P2", "a reload comes back on the moved layouts", L.P2.ok, L.P2.detail)

const O = await run("locked")
for (const [id, name] of [["R1", "Drawing | 3D sash"], ["R2", "sash above the dock"], ["R3", "3D tab into a group"], ["R4", "3D tab onto an edge"], ["C1", "canvas through the moves"], ["S1", "rail after the move"], ["M1", "maximize after the move"], ["W1", "Style and Animate drags"], ["P1", "per-workspace layout"], ["P2", "reload of the moved layout"]])
  fired(id, `locked dock: ${name}`, !O[id].ok, O[id].detail)

row("G1", "the lane pages threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")
await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
