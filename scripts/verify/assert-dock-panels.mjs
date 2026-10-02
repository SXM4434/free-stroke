#!/usr/bin/env node
// assert-dock-panels.mjs · DID THE DOCK LEAVE THE VIEWPORT WITH EVERY CONTROL IT HELD?
//
//   FS_PORT=3139 FS_HEADED=0 node scripts/verify/assert-dock-panels.mjs
//
// Layout rethink phase L3 (`docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md`
// §5 row L3). The strip, Perform, the keys, the transport, the timing note, the
// Draw-in controls and Export moved out of `components/viewport-3d.tsx` into
// three dockview panels under both the Drawing and the 3D view (Timeline,
// Draw-in, Export), with the transport as the dock's header row. Top and Reset
// camera stay on the 3D view.
//
// THE INVENTORY is the MOCKUPS one (`docs/research-2026-09-26/layout-rethink/
// mockups/MOCKUPS.md`, "Every control today": 3D toolbar, Export, Dock), each
// control named the way the page names it. The scrubber had no name in that
// inventory; it is "Playhead" since L3. Debug is dev-only and is counted, since
// the gate runs on a dev server.
//
// Rows (each with its must-fail, run on a page that must fail it):
//   R1  every inventory control is reachable: after one click on its dock tab
//       (and, for the key lanes, on Keyframes), it is on screen and
//       `elementFromPoint` at its centre is the control. Counted, found / total.
//       must-fail: the dock's panels never added (`__fsDockMutant = "nodock"`).
//   R2  with a toast up and the dock open, on each of its three tabs, no
//       control on the page has the toaster at its centre. must-fail: the
//       pre-L3 fixed 182 px offset (`"toast182"`) against the moved transport.
//   R3  the GL canvas is the same element, with no `webglcontextlost`, across
//       fold, open, all three tabs and fold again. must-fail: the probe itself,
//       on a context lost on purpose (`WEBGL_lose_context`), must see it.
//   R4  the drawer's "Show in dock" path (OPEN_ANIMATION_PANEL_EVENT, through
//       the store's `drawInOpen`) opens a folded dock on the Draw-in tab with
//       its controls showing, and Escape takes it back to the Timeline.
//       must-fail: the store no longer drives the tab (`"nosync"`).
//   R5  the 3D canvas fills its panel within 1 px folded and open (no band
//       under it any more), and folding gives the height back. must-fail: the
//       same comparison against the pre-L3 band (`pb-16`, 64 px) goes red.
//   G1  no page error.

import { readFileSync } from "node:fs"
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")

const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines

let pass = 0, fail = 0
const row = (id, name, ok, detail = "") => {
  ok ? pass++ : fail++
  console.log(`${ok ? "PASS" : "FAIL"}  ${id.padEnd(4)} ${name}${detail ? `  :  ${detail}` : ""}`)
}
const fired = (id, name, redAsRequired, detail = "") => {
  redAsRequired ? pass++ : fail++
  console.log(`${redAsRequired ? "FIRED" : "BLIND"} ${id.padEnd(4)} must-fail: ${name}${detail ? `  :  ${detail}` : ""}`)
}

// [tab, kind, name]. `kind` is the element: button, slider (range input), text,
// or `title`, a button found by its title (the timing note's fold, whose text
// is the note itself).
const INVENTORY = [
  ["view", "button", "Top"],
  ["view", "button", "Reset camera"],
  ["export", "text", "Filename prefix for exports"],
  ["export", "button", "PNG"],
  ["export", "button", "PNG export settings"],
  ["export", "button", "Video"],
  ["export", "button", "Video export settings"],
  ["export", "button", "GLB"],
  ["timeline", "button", "Play"],
  ["timeline", "slider", "Playhead"],
  ["timeline", "button", "Natural"],
  ["timeline", "button", "Authentic"],
  ["timeline", "button", "0.5x"],
  ["timeline", "button", "1x"],
  ["timeline", "button", "2x"],
  ["timeline", "button", "Draw-in"],
  ["timeline", "button", "Debug"],
  ["timeline", "button", "Perform"],
  ["timeline", "button", "Ripple"],
  ["timeline", "button", "Keyframes"],
  ["timeline", "title", "Read the whole timing note"],
  ["keys", "button", "Add a Draw key at the playhead"],
  ["keys", "button", "Add a Depth key at the playhead"],
  ["keys", "button", "Add a Turn key at the playhead"],
  ["keys", "button", "Add a Orbit key at the playhead"],
  ["keys", "button", "Add a Tilt key at the playhead"],
  ["keys", "button", "Add a Distance key at the playhead"],
  ["keys", "button", "Add a Width key at the playhead"],
  ["keys", "button", "Camera"],
  ...["As drawn", "Reversed", "Short first", "Left to right", "Random", "Start together", "End together", "Groups", "Strokes",
    "Start → end", "End → start", "Alternating", "Grow", "Travel", "Vanish", "Shrink", "Lit object", "Flat ink",
    "Linear", "Ease in", "Ease out", "Ease in-out", "Ones", "Twos", "Reverse", "Loop"].map((n) => ["drawin", "button", n]),
  ...["Overlap", "Window length", "Turn", "Delay before it starts"].map((n) => ["drawin", "slider", n]),
]

const browser = await chromium.launch()
const errors = []

async function open(mutant = null, size = [1512, 982]) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } })
  if (mutant) await ctx.addInitScript((m) => { window.__fsDockMutant = m }, mutant)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => errors.push(`${mutant ?? "lane"}: ${e.message}`))
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__dockHarness && window.__fsTransport, null, { timeout: 240000 })
  await page.waitForTimeout(600)
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__revealHarness.setPlaying(false))
  await settle(page)
  return { ctx, page }
}
async function settle(page, ms = 200) {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const clickTab = async (page, id) => {
  const ok = await page.evaluate((id) => {
    const t = document.querySelector(`[data-dock-tab="${id}"]`)
    if (!t) return false
    // Draw-in's tab toggles; only click it when it is not already showing.
    if (id === "drawin" && t.getAttribute("aria-expanded") === "true") return true
    if (id !== "drawin" && t.getAttribute("aria-pressed") === "true") return true
    t.click()
    return true
  }, id)
  await settle(page, 300)
  return ok
}

/* Every control in the page that matches `kind` and `name`, with whether it is
   on screen and whether `elementFromPoint` at its centre is it. */
const FIND = ([kind, name]) => {
  const norm = (s) => (s || "").replace(/\s+/g, " ").trim()
  const label = (el) => norm(el.getAttribute("aria-label") || el.labels?.[0]?.textContent || el.textContent || el.title)
  const sel = kind === "button" || kind === "title" ? "button" : kind === "slider" ? "input[type=range]" : "input[type=text]"
  const hits = []
  for (const el of document.querySelectorAll(sel)) {
    const l = kind === "title" ? norm(el.title) : label(el)
    // Draw-in's tab carries the summary of what is set after its name.
    const match = kind === "slider" ? l.toLowerCase().startsWith(name.toLowerCase()) : l === name || (name === "Draw-in" && l.startsWith(name))
    if (!match) continue
    // A control below the fold of its panel is one scroll away, as it was in
    // the old dock's scroll box: scroll it into view inside its own panel.
    el.scrollIntoView({ block: "nearest", inline: "nearest" })
    const r = el.getBoundingClientRect()
    const onScreen = r.width >= 2 && r.height >= 2 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth
    const top = onScreen ? document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) : null
    hits.push({ onScreen, hit: !!top && (top === el || el.contains(top)) })
  }
  return hits
}

/* Walk the inventory the way a person would: one tab at a time. */
async function reach(page) {
  const missing = []
  let found = 0
  const groups = ["view", "timeline", "keys", "drawin", "export"]
  for (const g of groups) {
    if (g === "timeline" || g === "keys") await clickTab(page, "timeline")
    if (g === "keys") {
      await page.evaluate(() => {
        const k = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Keyframes")
        if (k && k.getAttribute("aria-expanded") !== "true") k.click()
      })
      await settle(page, 300)
    }
    if (g === "drawin") await clickTab(page, "drawin")
    if (g === "export") await clickTab(page, "export")
    for (const item of INVENTORY.filter((i) => i[0] === g)) {
      const hits = await page.evaluate(FIND, [item[1], item[2]])
      if (hits.some((h) => h.onScreen && h.hit)) found++
      else missing.push(`${item[2]}${hits.length ? hits.some((h) => h.onScreen) ? " (covered)" : " (off screen)" : " (absent)"}`)
    }
  }
  return { found, total: INVENTORY.length, missing }
}

/* What a toast covers: every control whose centre, asked of the document,
   is inside the toaster. The probe `assert-shell-states` §3 uses. */
const COVERED = () => {
  const out = []
  for (const el of document.querySelectorAll("button, input, select, a[href]")) {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    if (!top || top === el || el.contains(top) || top.contains(el)) continue
    if (top.closest("[data-sonner-toaster],[data-sonner-toast]")) out.push((el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30))
  }
  return out
}
/* A toast, raised the way the page raises one: Clear's "⌘Z brings them back".
   The strokes are put back afterwards so the strip has its bars. */
async function covered(page) {
  const out = {}
  for (const tab of ["timeline", "drawin", "export"]) {
    await clickTab(page, tab)
    await page.evaluate(() => window.__styleHarness.clearCanvas())
    await page.waitForSelector("[data-sonner-toast]", { timeout: 5000 })
    await settle(page, 700)
    out[tab] = await page.evaluate(COVERED)
    await page.evaluate(() => document.querySelectorAll("[data-sonner-toast] [data-close-button]").forEach((b) => b.click()))
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
    await page.waitForFunction(() => !document.querySelector("[data-sonner-toast]"), null, { timeout: 8000 }).catch(() => {})
    await settle(page, 600)
  }
  return out
}

const canvasBox = (page) =>
  page.evaluate(() => {
    const c = document.querySelector('[data-dock-panel="view3d"] canvas')
    const p = document.querySelector('[data-dock-panel="view3d"]')
    if (!c || !p) return null
    const a = c.getBoundingClientRect(), b = p.getBoundingClientRect()
    return { canvas: [a.width, a.height], panel: [b.width, b.height] }
  })
const fills = (m, band = 0) => !!m && Math.abs(m.canvas[0] - m.panel[0]) <= 1 && Math.abs(m.canvas[1] - (m.panel[1] - band)) <= 1

// ---------------------------------------------------------------- the lane
{
  const { ctx, page } = await open()

  // R5 first, from the folded start.
  const folded0 = await canvasBox(page)
  await page.evaluate(() => window.__dockHarness.dock.open("timeline"))
  await settle(page, 400)
  const opened = await canvasBox(page)
  await page.evaluate(() => window.__dockHarness.dock.fold())
  await settle(page, 400)
  const folded1 = await canvasBox(page)
  const r5 = fills(folded0) && fills(opened) && fills(folded1) && opened.canvas[1] < folded0.canvas[1] - 100 && Math.abs(folded1.canvas[1] - folded0.canvas[1]) <= 1
  const px = (m) => (m ? `${m.canvas.map((v) => Math.round(v)).join("x")} in ${m.panel.map((v) => Math.round(v)).join("x")}` : "none")
  row("R5", "the 3D canvas fills its panel, folded and open; folding gives the height back", r5, `folded ${px(folded0)}, open ${px(opened)}, folded again ${px(folded1)}`)
  fired("R5", "the same test against the pre-L3 64 px band", !(fills(folded0, 64) && fills(opened, 64)), `folded fills with a band: ${fills(folded0, 64)}, open: ${fills(opened, 64)}`)

  // R3: the canvas element and its context across fold, open, the tabs.
  await page.evaluate(() => {
    const c = document.querySelector('[data-dock-panel="view3d"] canvas')
    window.__r3 = { canvas: c, lost: 0 }
    c.addEventListener("webglcontextlost", () => window.__r3.lost++)
  })
  for (const step of ["fold", "timeline", "drawin", "export", "timeline", "fold"]) {
    if (step === "fold") await page.evaluate(() => window.__dockHarness.dock.fold())
    else await clickTab(page, step)
    await settle(page, 300)
  }
  const r3 = await page.evaluate(() => ({ same: document.querySelector('[data-dock-panel="view3d"] canvas') === window.__r3.canvas, lost: window.__r3.lost }))
  row("R3", "the same GL canvas, no context lost, across fold, open and the three tabs", r3.same && r3.lost === 0, `same element ${r3.same}, contexts lost ${r3.lost}`)

  // R1: reach, from a folded dock.
  const r1 = await reach(page)
  row("R1", "every inventory control reachable, one tab click away, and hit at its centre", r1.found === r1.total, `${r1.found} of ${r1.total}${r1.missing.length ? `; missing: ${r1.missing.join(", ")}` : ""}`)

  // R2: nothing covered by a toast, dock open, each tab.
  const r2 = await covered(page)
  const r2hits = Object.entries(r2).filter(([, v]) => v.length)
  row("R2", "a toast covers no control, dock open on each tab", r2hits.length === 0, Object.entries(r2).map(([k, v]) => `${k}: ${v.length ? `COVERED ${v.join(", ")}` : "clear"}`).join("; "))

  // R4: the drawer's door into the Draw-in tab, and Escape out.
  await page.evaluate(() => window.__dockHarness.dock.fold())
  await clickTab(page, "timeline")
  await page.evaluate(() => window.__dockHarness.dock.fold())
  await settle(page, 300)
  const r4read = () => page.evaluate(() => ({
    folded: window.__dockHarness.dock.collapsed(),
    body: (() => {
      const b = document.querySelector("[data-animation-drawin-body]")
      if (!b || !b.checkVisibility({ visibilityProperty: true })) return false
      const r = b.getBoundingClientRect()
      return r.height > 20 && b.contains(document.elementFromPoint(r.left + 40, r.top + 10))
    })(),
    expanded: document.querySelector("[data-animation-drawin]")?.getAttribute("aria-expanded"),
    store: window.__fsTransport.get("drawInOpen"),
  }))
  await page.evaluate(() => window.dispatchEvent(new Event("fs:animation-panel")))
  await settle(page, 400)
  const r4a = await r4read()
  await page.keyboard.press("Escape")
  await settle(page, 400)
  const r4b = await r4read()
  const r4 = !r4a.folded && r4a.body && r4a.expanded === "true" && r4a.store === true && !r4b.body && r4b.expanded === "false" && r4b.store === false
  row("R4", "Show in dock opens a folded dock on Draw-in; Escape goes back to the Timeline", r4, `after the event ${JSON.stringify(r4a)}; after Escape ${JSON.stringify(r4b)}`)

  await ctx.close()
}

// ---------------------------------------------------------------- must-fails
{
  const { ctx, page } = await open("nodock")
  const r1 = await reach(page)
  fired("R1", "no dock panels on the page", r1.found < r1.total, `${r1.found} of ${r1.total}`)
  await ctx.close()
}
{
  const { ctx, page } = await open("toast182")
  const r2 = await covered(page)
  const n = Object.values(r2).reduce((a, v) => a + v.length, 0)
  fired("R2", "the fixed 182 px toast offset against the moved transport", n > 0, Object.entries(r2).map(([k, v]) => `${k}: ${v.length ? v.join(", ") : "clear"}`).join("; "))
  await ctx.close()
}
{
  const { ctx, page } = await open("nosync")
  await page.evaluate(() => window.dispatchEvent(new Event("fs:animation-panel")))
  await settle(page, 400)
  const body = await page.evaluate(() => {
    const b = document.querySelector("[data-animation-drawin-body]")
    if (!b || !b.checkVisibility({ visibilityProperty: true })) return false
    const r = b.getBoundingClientRect()
    return r.height > 20 && b.contains(document.elementFromPoint(r.left + 40, r.top + 10))
  })
  fired("R4", "the store no longer drives the Draw-in tab", !body, `Draw-in controls showing after the event: ${body}`)
  await ctx.close()
}
{
  const { ctx, page } = await open()
  const lost = await page.evaluate(async () => {
    const c = document.querySelector('[data-dock-panel="view3d"] canvas')
    let n = 0
    c.addEventListener("webglcontextlost", () => n++)
    const gl = c.getContext("webgl2") || c.getContext("webgl")
    gl?.getExtension("WEBGL_lose_context")?.loseContext()
    await new Promise((r) => setTimeout(r, 300))
    return n
  })
  fired("R3", "the probe sees a context lost on purpose", lost > 0, `contexts lost seen: ${lost}`)
  await ctx.close()
}

row("G1", "the page threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")

await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
