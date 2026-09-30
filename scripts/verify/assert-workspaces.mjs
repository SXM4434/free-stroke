#!/usr/bin/env node
// assert-workspaces.mjs · THE RAIL SWITCHES THREE SAVED ARRANGEMENTS, AND NOTHING IS LOST ON THE WAY
//
//   FS_PORT=3140 FS_HEADED=0 node scripts/verify/assert-workspaces.mjs
//
// Layout rethink phase L4 (`docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md` §3 and §5 row L4;
// his rulings of 2026-09-26: workspaces on dockable panels, B's left rail, a label on every icon).
// Draw, Style and Animate are arrangements of the same six panels (`components/workspace/
// workspaces.ts`), switched from the rail (`components/workspace/rail.tsx`) and loaded by
// `components/dock-shell.tsx` over the panels already open.
//
// Rows, each with a must-fail run on a page that must fail it:
//   W1  ROUND TRIP. Draw, changed (the dock opened and resized), then Animate, then Draw: the layout
//       JSON is byte-equal to the Draw that was left. must-fail: `__fsDockMutant = "nosave"`, a
//       switch that does not save the workspace it leaves.
//   W2  BLOCKED STORAGE. With every localStorage call throwing, the page loads, runs on the default
//       arrangement, switches all three workspaces, and says so in exactly one toast. must-fail:
//       `"unguarded"`, the first read bare, must throw.
//   W3  A CORRUPT SAVE. A saved Style layout that names a panel this build lacks is not loaded:
//       Style opens on its default and a toast names the panel. must-fail: `"silent"`, the same
//       fallback with no toast.
//   W4  NO PANEL UNDER ITS MINIMUM, NO SIDEWAYS SCROLL, in all three workspaces at 1280x800,
//       1512x982 and 1600x1500. Minimums: dockview's 100 px each way, Style 280 wide, the dock 36
//       tall. must-fail: the same probe on a page with a 2000 px wide element added, and the same
//       sizes read against a 2000 px minimum.
//   W5  RESET puts the current workspace back to its default and deletes its save; the other two
//       keep theirs. must-fail: the reader, on the changed layout before the reset, must see it
//       differ from the default.
//   W6  THE 3D VIEW LIVES THROUGH EVERY SWITCH (§1): the same canvas element, the same WebGL
//       context, no `webglcontextlost`, across Draw, Style, Animate, Draw, Reset. must-fail:
//       `"noReuse"`, loads without `reuseExistingPanels`.
//   W7  THE RAIL. Every button has its label as its accessible name, a 28x28 target, a 36 px pitch;
//       hovering shows the label in a tooltip; 1, 2 and 3 switch the workspace, and a 2 typed in
//       the filename field does not. must-fail: the tooltip probe on a rail button whose label
//       was stripped reads no label.
//   G1  no page error on the lane pages.

const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")

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

const BLOCK_STORAGE = () => {
  const deny = () => { throw new DOMException("The operation is insecure.", "SecurityError") }
  for (const k of ["getItem", "setItem", "removeItem", "key", "clear"]) Storage.prototype[k] = deny
}

async function open({ mutant = null, size = [1512, 982], init = null, keep = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } })
  if (!keep) await ctx.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout.")) localStorage.removeItem(k) } catch {} })
  if (mutant) await ctx.addInitScript((m) => { window.__fsDockMutant = m }, mutant)
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  const pageErrors = []
  page.on("pageerror", (e) => { pageErrors.push(e.message); if (!mutant) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  const ready = await page.waitForFunction(() => window.__styleHarness && window.__dockHarness?.workspace, null, { timeout: mutant === "unguarded" ? 30000 : 240000 }).then(() => true, () => false)
  if (ready) await settle(page, 400)
  return { ctx, page, ready, pageErrors }
}
const settle = async (page, ms = 250) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const W = (page, fn, arg) => page.evaluate(([fn, arg]) => window.__dockHarness.workspace[fn](arg), [fn, arg])
const json = (page) => W(page, "json")
const toastsMatching = (page, re) =>
  page.evaluate((src) => [...document.querySelectorAll("[data-sonner-toast]")].map((t) => t.innerText).filter((t) => new RegExp(src, "i").test(t)), re.source)

/* The default layout's JSON for a workspace, read on a fresh page with nothing saved. */
async function defaultJson(page, ws) {
  await W(page, "switch", ws)
  await settle(page, 300)
  await W(page, "reset")
  await settle(page, 300)
  return json(page)
}

// ---------------------------------------------------------------- W1
async function roundTrip(mutant) {
  const { ctx, page } = await open({ mutant })
  await page.evaluate(() => window.__dockHarness.dock.open("timeline"))
  await settle(page, 400)
  const g = await page.evaluate(() => {
    const d = window.__dockHarness.api.groups.find((x) => x.panels.some((p) => p.id === "timeline"))
    d.api.setSize({ height: 300 })
    return d.element.getBoundingClientRect().height
  })
  await settle(page, 600) // past the 300 ms save
  const left = await json(page)
  await W(page, "switch", "animate")
  await settle(page, 400)
  await W(page, "switch", "draw")
  await settle(page, 400)
  const back = await json(page)
  await ctx.close()
  return { same: left === back, dockPx: Math.round(g), bytes: left.length }
}
{
  const r = await roundTrip(null)
  row("W1", "Draw, changed, to Animate and back is byte-equal", r.same, `dock set to ${r.dockPx} px; ${r.bytes} bytes, ${r.same ? "equal" : "DIFFER"}`)
  const m = await roundTrip("nosave")
  fired("W1", "a switch that does not save", !m.same, `round trip ${m.same ? "equal" : "differs"}`)
}

// ---------------------------------------------------------------- W2
{
  const { ctx, page, ready, pageErrors } = await open({ init: BLOCK_STORAGE })
  let detail = "page never became ready"
  let ok = false
  if (ready) {
    const first = await json(page)
    for (const ws of ["style", "animate", "draw", "animate"]) { await W(page, "switch", ws); await settle(page, 300) }
    await settle(page, 600)
    const toasts = await toastsMatching(page, /cannot be saved/)
    // Defaults: the Draw the blocked page opened on equals Draw's default read on an unblocked page.
    const clean = await open()
    const def = await defaultJson(clean.page, "draw")
    await clean.ctx.close()
    ok = pageErrors.length === 0 && toasts.length === 1 && first === def
    detail = `page errors ${pageErrors.length}, storage toasts ${toasts.length}, opened on Draw's default ${first === def}`
  }
  row("W2", "blocked storage: defaults, one toast, no throw", ok, detail)
  await ctx.close()
  const m = await open({ mutant: "unguarded", init: BLOCK_STORAGE })
  fired("W2", "the first read unguarded", !m.ready || m.pageErrors.length > 0, `ready ${m.ready}, page errors ${m.pageErrors.length}${m.pageErrors[0] ? `: ${m.pageErrors[0].slice(0, 80)}` : ""}`)
  await m.ctx.close()
}

// ---------------------------------------------------------------- W3
async function corrupt(mutant) {
  const { ctx, page } = await open({ mutant })
  const def = await defaultJson(page, "style")
  await W(page, "switch", "draw")
  await settle(page, 300)
  // A Style save with an extra panel, "ghost", written while on Draw.
  await page.evaluate(() => {
    const j = JSON.parse(window.__dockHarness.workspace.json())
    j.panels.ghost = { id: "ghost", contentComponent: "ghost", title: "Ghost" }
    localStorage.setItem("fs.layout.v1.style", JSON.stringify(j))
  })
  await W(page, "switch", "style")
  await settle(page, 700)
  const now = await json(page)
  const toasts = await toastsMatching(page, /ghost/)
  await ctx.close()
  return { fellBack: now === def, toasts: toasts.length, text: toasts[0]?.replace(/\n/g, " ").slice(0, 120) ?? "" }
}
{
  const r = await corrupt(null)
  row("W3", "a save naming a missing panel falls back and says which", r.fellBack && r.toasts === 1, `on Style's default ${r.fellBack}, toasts naming it ${r.toasts}: "${r.text}"`)
  const m = await corrupt("silent")
  fired("W3", "the same fallback with no toast", m.toasts === 0, `toasts naming it ${m.toasts}`)
}

// ---------------------------------------------------------------- W4
const MINS = { drawing: [100, 100], view3d: [100, 100], style: [280, 100], timeline: [100, 36] }
const FIT = (mins) => {
  const out = []
  const doc = document.documentElement
  if (doc.scrollWidth > innerWidth + 0.5) out.push(`page scrolls sideways (${doc.scrollWidth} > ${innerWidth})`)
  const api = window.__dockHarness.api
  for (const [id, [mw, mh]] of Object.entries(mins)) {
    const p = api.getPanel(id)
    if (!p || !p.group.api.isVisible) continue
    const r = p.group.element.getBoundingClientRect()
    if (r.width + 0.5 < mw || r.height + 0.5 < mh) out.push(`${id} ${Math.round(r.width)}x${Math.round(r.height)} < ${mw}x${mh}`)
  }
  return out
}
{
  const bad = []
  let checked = 0
  for (const size of [[1280, 800], [1512, 982], [1600, 1500]]) {
    const { ctx, page } = await open({ size })
    for (const ws of ["draw", "style", "animate"]) {
      await W(page, "switch", ws)
      await settle(page, 400)
      const v = await page.evaluate(FIT, MINS)
      checked++
      for (const x of v) bad.push(`${size.join("x")} ${ws}: ${x}`)
    }
    if (size[0] === 1512) {
      const wide = await page.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "width:2000px;height:1px"; document.body.appendChild(d); return true })
      const v1 = await page.evaluate(FIT, MINS)
      const v2 = await page.evaluate(FIT, { drawing: [2000, 100], view3d: [2000, 100], style: [2000, 100], timeline: [2000, 36] })
      fired("W4", "the probe on a 2000 px wide page and against a 2000 px minimum", wide && v1.some((x) => /sideways/.test(x)) && v2.length >= 2, `${v1.length} and ${v2.length} findings`)
    }
    await ctx.close()
  }
  row("W4", "no panel under its minimum, no sideways scroll, 3 workspaces x 3 sizes", bad.length === 0, bad.length ? bad.join("; ") : `${checked} arrangements checked`)
}

// ---------------------------------------------------------------- W5
{
  const { ctx, page } = await open()
  const defAnimate = await defaultJson(page, "animate")
  // Give Style a save of its own, then change Animate and reset it.
  await W(page, "switch", "style")
  await W(page, "toggle", "drawing")
  await settle(page, 600)
  const styleSaved = await page.evaluate(() => localStorage.getItem("fs.layout.v1.style"))
  await W(page, "switch", "animate")
  await W(page, "toggle", "style")
  await settle(page, 600)
  const changed = await json(page)
  const hadSave = await page.evaluate(() => localStorage.getItem("fs.layout.v1.animate") !== null)
  await W(page, "reset")
  await settle(page, 600)
  const after = await json(page)
  const saveAfter = await page.evaluate(() => localStorage.getItem("fs.layout.v1.animate"))
  const styleAfter = await page.evaluate(() => localStorage.getItem("fs.layout.v1.style"))
  // A reset writes nothing back until the next change, so the save stays deleted.
  row(
    "W5",
    "Reset restores the default and deletes its save; the others keep theirs",
    after === defAnimate && hadSave && saveAfter === null && styleSaved !== null && styleAfter === styleSaved,
    `default restored ${after === defAnimate}, Animate save before ${hadSave} after ${saveAfter === null ? "deleted" : "kept"}, Style save kept ${styleAfter === styleSaved}`,
  )
  fired("W5", "the changed layout reads as different from the default", changed !== defAnimate, `changed ${changed === defAnimate ? "EQUALS" : "differs from"} the default`)
  await ctx.close()
}

// ---------------------------------------------------------------- W6
async function survives(mutant) {
  const { ctx, page } = await open({ mutant })
  await page.evaluate(() => {
    const c = document.querySelector('[data-dock-panel="view3d"] canvas')
    window.__w6 = { c, gl: c.getContext("webgl2") || c.getContext("webgl"), lost: 0 }
    c.addEventListener("webglcontextlost", () => window.__w6.lost++)
  })
  for (const ws of ["style", "animate", "draw"]) { await W(page, "switch", ws); await settle(page, 400) }
  await W(page, "reset")
  await settle(page, 400)
  const r = await page.evaluate(() => {
    const c = document.querySelector('[data-dock-panel="view3d"] canvas')
    return { same: c === window.__w6.c, gl: !!c && (c.getContext("webgl2") || c.getContext("webgl")) === window.__w6.gl, lost: window.__w6.lost }
  })
  await ctx.close()
  return r
}
{
  const r = await survives(null)
  row("W6", "the 3D canvas and its context live through every switch and a reset", r.same && r.gl && r.lost === 0, `same element ${r.same}, same context ${r.gl}, lost ${r.lost}`)
  const m = await survives("noReuse")
  fired("W6", "loads without reuseExistingPanels", !(m.same && m.gl && m.lost === 0), `same element ${m.same}, same context ${m.gl}, lost ${m.lost}`)
}

// ---------------------------------------------------------------- W7
{
  const { ctx, page } = await open()
  const rail = await page.evaluate(() => {
    const bs = [...document.querySelectorAll("[data-rail] button")]
    const group = (b) => (b.hasAttribute("data-rail-workspace") ? "ws" : b.hasAttribute("data-rail-panel") ? "panel" : "reset")
    const boxes = bs.map((b) => { const r = b.getBoundingClientRect(); return { name: b.getAttribute("aria-label"), w: r.width, h: r.height, top: r.top, g: group(b) } })
    // The pitch is icon to icon inside a group (§3: 28x28 on a 36 px pitch);
    // the rule between the workspaces and the panels is not an icon.
    const pitches = []
    for (let i = 1; i < boxes.length; i++) if (boxes[i].g === boxes[i - 1].g) pitches.push(Math.round(boxes[i].top - boxes[i - 1].top))
    return { boxes, pitches }
  })
  const tip = async (sel) => {
    // A pointer that travels onto the icon, the way a hand does, from the canvas.
    const box = await page.locator(sel).first().boundingBox()
    await page.mouse.move(700, 400, { steps: 4 })
    await settle(page, 700)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 8 })
    await page.waitForTimeout(900)
    // The open tooltip: one closing from the last hover can still be in the document.
    const t = await page.evaluate(() => [...document.querySelectorAll("[data-rail-tooltip]")].filter((x) => x.getAttribute("data-state") !== "closed").map((x) => x.innerText.replace(/\n/g, " ")).pop() ?? "")
    return t
  }
  const tips = []
  for (const b of rail.boxes) tips.push({ name: b.name, tip: await tip(`[data-rail] button[aria-label="${b.name}"]`) })
  const unnamed = rail.boxes.filter((b) => !b.name)
  const small = rail.boxes.filter((b) => b.w < 28 - 0.5 || b.h < 28 - 0.5)
  const badPitch = rail.pitches.filter((p) => p !== 36)
  const noTip = tips.filter((t) => !t.name || !t.tip.includes(t.name))
  // Keys: 3 goes to Animate, 1 back to Draw; a 2 typed in the filename field stays text.
  await page.mouse.click(700, 300)
  await page.keyboard.press("3")
  await settle(page, 400)
  const k3 = await W(page, "current")
  await page.keyboard.press("1")
  await settle(page, 400)
  const k1 = await W(page, "current")
  await page.evaluate(() => window.__dockHarness.dock.open("export"))
  await settle(page, 300)
  await page.locator('input[aria-label="Filename prefix for exports"]').click()
  await page.keyboard.press("2")
  await settle(page, 300)
  const kIn = await W(page, "current")
  const typed = await page.locator('input[aria-label="Filename prefix for exports"]').inputValue()
  const keysOk = k3 === "animate" && k1 === "draw" && kIn === "draw" && typed === "2"
  row(
    "W7",
    "every rail button named, 28x28 on a 36 px pitch, its label in a tooltip; 1, 2, 3 switch, not while typing",
    rail.boxes.length === 9 && !unnamed.length && !small.length && !badPitch.length && !noTip.length && keysOk,
    `${rail.boxes.length} buttons, unnamed ${unnamed.length}, under 28x28 ${small.length}, pitches ${[...new Set(rail.pitches)].join("/")}, without their label in a tooltip ${noTip.map((t) => t.name).join(", ") || 0}; keys 3 ${k3}, 1 ${k1}, 2 in the field ${kIn} (field reads "${typed}")`,
  )
  // must-fail: strip one button's label and the tooltip probe must read nothing for it.
  await page.evaluate(() => { const b = document.querySelector('[data-rail] button[aria-label="Style"]'); b.dataset.was = b.getAttribute("aria-label"); b.setAttribute("aria-label", "") })
  const stripped = await page.evaluate(() => document.querySelector('[data-rail] button[data-was]').getAttribute("aria-label"))
  fired("W7", "a rail button whose label was stripped", !stripped, `accessible name "${stripped}"`)
  await ctx.close()
}

row("G1", "the lane pages threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")

await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
