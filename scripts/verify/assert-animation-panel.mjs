#!/usr/bin/env node
// ASSERT-ANIMATION-PANEL. One place for the animation tools (plan 2026-09-26 §1).
// The dock under the canvas holds the draw-in controls as a collapsible section,
// the Timing popover and its button are gone, the dock shows before the first
// stroke, and the drawer's Animation tab has a button that opens the section.
//
// Two runs, one script:
//   on main (the popover still there)  records the popover's controls, the state
//     each one writes, and the canvas height, into main-popover-baseline.json.
//     Rows 1-4 must be RED here: that is the positive control.
//   on the lane                        reads that baseline and checks every row,
//     then runs each row's must-fail and shows it firing.
//
//   FS_HEADED=0 FS_PORT=3138 node scripts/verify/assert-animation-panel.mjs

import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
const { openStyle, openDock } = await import("./lib/dock.mjs")
const OUT = new URL("../../docs/verification/animation-panel/", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const BASE = `${OUT}main-popover-baseline.json`
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const sha = (s) => createHash("sha1").update(s).digest("hex").slice(0, 10)

const rows = []
const row = (id, name, ok, detail = "", mustFail = false) => {
  rows.push({ id, name, ok: !!ok, detail, mustFail })
  const tag = mustFail ? (ok ? "FIRED" : "FAIL ") : ok ? "PASS " : "FAIL "
  console.log(`${mustFail ? "[must-fail] " : ""}${tag} ${id} ${name}${detail ? `  (${detail})` : ""}`)
}

const browser = await chromium.launch()
async function fresh(w = 1512, h = 982, strokes = true, init = null) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness, null, { timeout: 240000 })
  await page.waitForTimeout(800)
  if (strokes) {
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), Array.isArray(strokes) ? strokes : polys)
    await page.waitForTimeout(1500)
    await page.evaluate(() => window.__revealHarness.setPlaying(false))
  }
  // CL-GATES-3 LOCATORS. Since L3 the dock is a dockview group under both canvases (Timeline, Draw-in,
  // Export tabs), so "the dock" is that group's element, tagged here for the rows; the draw-in section is
  // the Draw-in panel's body; the canvas is the 3D view's. On main none of these exist and the old ones hold.
  await page.evaluate(() => window.__dockHarness?.api?.getPanel("timeline")?.group?.element?.setAttribute("data-gate-dock", ""))
  await settle(page)
  return { ctx, page }
}
async function settle(page, ms = 150) {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

// Where the draw-in controls live: main's popover, or the lane's dock section.
const DOCKSEC = `[data-dock-panel="drawin"] [data-animation-drawin-body], [data-animation-panel] [data-animation-drawin-body]`
const HOST = `[role="dialog"][aria-label="Draw-in timing"], ${DOCKSEC}`
const hasPopover = (page) => page.evaluate(() => [...document.querySelectorAll("button")].some((b) => /^Timing/.test(b.textContent.trim())))

async function openHost(page) {
  const opened = await page.evaluate(() => {
    const t = document.querySelector("[data-animation-drawin]")
    if (t) { if (t.getAttribute("aria-expanded") !== "true") t.click(); return "dock" }
    const b = [...document.querySelectorAll("button")].find((x) => /^Timing/.test(x.textContent.trim()))
    if (b) { b.click(); return "popover" }
    return null
  })
  await settle(page, 300)
  return opened
}

// Every control in the host, labelled in code the same way on both trees.
// Numbers in a label are masked, since a readout inside a button changes with state.
const ENUM = (host) => {
  const root = document.querySelector(host)
  if (!root) return null
  const norm = (s) => (s || "").replace(/\s+/g, " ").replace(/-?\d+(\.\d+)?/g, "#").trim()
  const seen = new Map()
  return [...root.querySelectorAll("button, input, select, textarea, [role=radio], [role=switch], [role=slider]")]
    .filter((el) => !(el.tagName === "INPUT" && el.type === "hidden"))
    .map((el) => {
      const lab = norm(el.getAttribute("aria-label") || el.labels?.[0]?.textContent || el.textContent || el.title || el.name)
      const kind = el.tagName === "INPUT" ? `input:${el.type}` : el.tagName.toLowerCase()
      const base = `${kind}|${lab}`
      const n = seen.get(base) ?? 0
      seen.set(base, n + 1)
      return { key: `${base}#${n}`, kind, label: lab }
    })
}
// What the section's controls show, plus the host state the viewport plays.
const STATE = (host) => {
  const r = window.__revealHarness
  const root = document.querySelector(host)
  // CURVE-2 added a Custom ease pill and its curve editor: controls main never had. R1 proves main's controls
  // write main's state, so the fingerprint leaves out [data-ease-custom] and [data-ease-curve]; the draw-in,
  // window, schedule and duration in the same snapshot still catch any state they change.
  const ctl = root ? [...root.querySelectorAll("button, input, select")].filter((el) => !el.closest("[data-ease-custom], [data-ease-curve]")).map((el) => [el.getAttribute("aria-pressed"), el.getAttribute("aria-checked"), el.value, el.checked, el.disabled].join(",")) : []
  return JSON.stringify({ d: r.drawIn(), w: r.window(), s: r.schedule(), t: Math.round(r.getTotalDuration()), ctl })
}

// Act on control `key` once: click, one arrow step, or the next option.
async function act(page, host, key) {
  const kind = await page.evaluate(({ host, key, ENUM }) => {
    const list = new Function(`return (${ENUM})`)()(host)
    const i = list ? list.findIndex((c) => c.key === key) : -1
    if (i < 0) return null
    const el = document.querySelector(host).querySelectorAll("button, input, select, textarea, [role=radio], [role=switch], [role=slider]")
    const node = [...el].filter((e) => !(e.tagName === "INPUT" && e.type === "hidden"))[i]
    node.setAttribute("data-gate-target", "1")
    return list[i].kind
  }, { host, key, ENUM: ENUM.toString() })
  if (!kind) return "absent"
  const loc = page.locator("[data-gate-target]")
  if (kind === "select") {
    const next = await loc.evaluate((s) => s.options[(s.selectedIndex + 1) % s.options.length]?.value)
    await loc.selectOption(next)
  } else if (kind === "input:range" || kind === "input:number" || kind === "[role=slider]") {
    await loc.focus(); await page.keyboard.press(kind === "input:number" ? "ArrowUp" : "ArrowRight")
  } else if (kind.startsWith("input:text")) {
    await loc.focus()
  } else {
    await loc.evaluate((b) => b.click())
  }
  await page.evaluate(() => document.querySelector("[data-gate-target]")?.removeAttribute("data-gate-target"))
  await settle(page)
  return "done"
}

async function sweep(page, keys) {
  const steps = []
  for (const key of keys) {
    const how = await act(page, HOST, key)
    const st = await page.evaluate(STATE, HOST)
    steps.push({ key, how, state: sha(st), d: JSON.parse(st).d })
  }
  return steps
}
const canvasH = (page) => page.evaluate(() => {
  const c = document.querySelector('[data-dock-panel="view3d"] canvas, [data-take-dock] canvas')
  return c ? Math.round(c.getBoundingClientRect().height) : null
})

// ---------------------------------------------------------------- main run
const warm = await fresh(1512, 982, false)
await warm.ctx.close()
const probe = await fresh()
const onMain = await hasPopover(probe.page)
console.log(`TREE: ${onMain ? "main (popover present), recording the baseline and running the positive control" : "lane (no popover)"}`)

let base
if (onMain) {
  const closedH = await canvasH(probe.page)
  await openHost(probe.page)
  const controls = await probe.page.evaluate(ENUM, HOST)
  const steps = await sweep(probe.page, controls.map((c) => c.key))
  base = { commit: "main", controls, steps, canvasH1512: closedH, recorded: new Date().toISOString() }
  writeFileSync(BASE, JSON.stringify(base, null, 1))
  console.log(`BASELINE: ${controls.length} controls in main's popover, ${steps.filter((s) => s.how === "done").length} acted on, canvas ${closedH}px tall at 1512x982`)
} else {
  if (!existsSync(BASE)) { console.log("FAIL no baseline: run this gate on main first"); process.exit(1) }
  base = JSON.parse(readFileSync(BASE, "utf8"))
}
await probe.ctx.close()
const keys = base.controls.map((c) => c.key)
console.log(`DENOMINATOR: ${keys.length} controls from main's popover (${[...new Set(base.controls.map((c) => c.kind))].join(", ")}); 8 rows, each with a must-fail`)

// Row 1: every control, found by label in the dock section, writes the same state.
async function row1(mutate = null) {
  const { ctx, page } = await fresh()
  const where = await openHost(page)
  const inDock = await page.evaluate((s) => !!document.querySelector(s), DOCKSEC)
  if (mutate === "drop") await page.evaluate(() => document.querySelector("[data-animation-drawin-body] input[type=range]")?.remove())
  const have = inDock ? (await page.evaluate(ENUM, DOCKSEC)).map((c) => c.key) : []
  const missing = keys.filter((k) => !have.includes(k))
  let steps = [], diff = null
  if (!missing.length) {
    steps = await sweep(page, keys)
    const want = mutate === "shift" ? [...base.steps.slice(1), base.steps[0]] : base.steps
    const i = steps.findIndex((s, j) => s.how !== want[j].how || s.state !== want[j].state)
    if (i >= 0) diff = `${steps[i].key}: ${steps[i].state} vs main ${want[i].state}`
  }
  await ctx.close()
  const ok = inDock && !missing.length && !diff
  return { ok, detail: `host ${where ?? "none"}, ${have.length}/${keys.length} found in the dock section${missing.length ? `, missing ${missing.slice(0, 3).join(" ; ")}` : ""}${diff ? `, first mismatch ${diff}` : `, ${steps.length} of ${keys.length} state writes match main step for step`}` }
}
// Row 2: no Timing button, no Draw-in timing dialog.
async function row2(mutate = false) {
  const { ctx, page } = await fresh()
  if (mutate) await page.evaluate(() => { const b = document.createElement("button"); b.textContent = "Timing"; document.querySelector("[data-gate-dock], [data-take-dock]").appendChild(b) })
  const r = await page.evaluate(() => ({
    btn: [...document.querySelectorAll("button")].filter((b) => /^Timing/.test(b.textContent.trim())).length,
    dlg: document.querySelectorAll('[role="dialog"][aria-label="Draw-in timing"]').length,
  }))
  await ctx.close()
  return { ok: r.btn === 0 && r.dlg === 0, detail: `${r.btn} Timing buttons, ${r.dlg} Draw-in timing dialogs` }
}
// Row 3: the dock renders on a fresh page with 0 strokes.
async function row3(mutate = false) {
  const { ctx, page } = await fresh(1512, 982, false)
  if (mutate) await page.addStyleTag({ content: "[data-gate-dock], [data-animation-panel]{display:none!important}" })
  const r = await page.evaluate(() => {
    const d = document.querySelector("[data-gate-dock], [data-animation-panel]")
    const b = d?.getBoundingClientRect()
    return { vis: !!b && b.height > 20 && b.bottom <= innerHeight && getComputedStyle(d).display !== "none", h: b ? Math.round(b.height) : 0 }
  })
  await ctx.close()
  return { ok: r.vis, detail: `dock ${r.vis ? "visible" : "absent"}, ${r.h}px tall, 0 strokes` }
}
// Row 4: the Animation tab's button opens the dock section, in view.
async function row4(mutate = false) {
  const { ctx, page } = await fresh()
  if (mutate) await page.evaluate(() => { const d = window.dispatchEvent.bind(window); window.dispatchEvent = (e) => (e.type === "fs:animation-panel" ? true : d(e)) })
  // The drawer's nav: one button per panel, the current one carries aria-current.
  // The drawer opens from the style strip's chip ("Animation Static"); inside it,
  // the nav button for the tab carries aria-current.
  const tab = page.locator("nav button", { has: page.locator("span", { hasText: /^Animation$/ }) }).first()
  // L4: the style strip's chip is gone; the Style panel is shown from the rail.
  await openStyle(page, "animation"); await settle(page, 600)
  const tabOk = (await tab.count()) > 0 && (await tab.isVisible()) && (await tab.getAttribute("aria-current")) === "true"
  const show = page.getByRole("button", { name: "Show animation panel" })
  const has = (await show.count()) > 0
  if (has) { await show.first().click(); await settle(page, 600) }
  if (has && !mutate) await page.screenshot({ path: `${OUT}drawer-show-1512x982.png` })
  const r = await page.evaluate(() => {
    const t = document.querySelector("[data-animation-drawin]")
    const body = document.querySelector("[data-animation-drawin-body]")
    const b = body?.getBoundingClientRect()
    return { open: t?.getAttribute("aria-expanded") === "true", inView: !!b && b.height > 0 && b.top < innerHeight && b.bottom > 0 }
  })
  await ctx.close()
  return { ok: tabOk && has && r.open && r.inView, detail: `tab ${tabOk ? "found" : "missing"}, button ${has ? "found" : "missing"}, section ${r.open ? "open" : "closed"}, ${r.inView ? "in view" : "not in view"}` }
}
// Row 5: section closed, the canvas is main's height at 1512x982.
async function row5(mutate = false) {
  const { ctx, page } = await fresh()
  if (mutate) await openHost(page)
  const h = await canvasH(page)
  // NOT COMPARED under the rail (CL-GATES-3). Main's height is a comparison only at main's window and boxes
  // (lib/dock-size.mjs), and sizing to them hides the dock this row is about. The accepted layout ("the new
  // layout stands", docs/rulings/2026-09-26.md) puts the folded dock's 35 px header under the canvases, and a
  // closed Draw-in tab goes back to the Timeline tab of the same group, so "section closed" is no longer a
  // canvas height of its own. Pages without the rail keep main's check and its must-fail.
  const railed = await page.evaluate(() => !!window.__dockHarness?.workspace?.today)
  await ctx.close()
  if (railed && !onMain) return { nc: true, ok: false, detail: `NOT COMPARED: canvas ${h}px under the rail's folded dock, main ${base.canvasH1512}px at another layout` }
  return { ok: h !== null && Math.abs(h - base.canvasH1512) <= 1, detail: `canvas ${h}px vs main ${base.canvasH1512}px` }
}

// Rows 6 and 7 (PANEL-2): the dock's layout at the two laptop sizes, closed and open.
// R6: every control in the transport row lies fully inside the dock's box.
// R7: every strip row the closed strip shows (up to 12) is whole inside the band.
// Each must-fail reverts its fix with a style tag: the row back to nowrap with the
// range input's 129 px floor (PANEL's row, 4 px past the dock at 1280), and the
// strip back to PANEL's six-row floor under a 55% dock.
// CL-GATES-3: since L3 the dock spans both canvases (1232 px at 1280x800), so PANEL's row, 4 px past a 640 px
// dock, fits, and its revert cannot fire; the strip's --strip-band is gone from the code. Each arm now puts the
// same defect back on this layout: the row with the scrubber's floor at the window's width, and the strip's
// scroll box cut to 72 px, PANEL's floor, so rows past it are not whole.
const REVERT_ROW = `[data-animation-transport]{flex-wrap:nowrap!important} [data-animation-transport] input[type=range]{min-width:100vw!important}`
const REVERT_STRIP = `[data-take-scroll]{max-height:72px!important;height:72px!important}`
async function layout(css = null) {
  const out = []
  for (const [w, h] of [[1280, 800], [1512, 982]]) for (const open of [false, true]) {
    const { ctx, page } = await fresh(w, h)
    if (css) await page.addStyleTag({ content: css })
    if (open) await openHost(page)
    else if (await page.evaluate(() => !!window.__dockHarness?.dock)) await openDock(page)
    await settle(page, 300)
    const m = await page.evaluate(() => {
      const dock = document.querySelector("[data-gate-dock], [data-animation-panel]")
      const row = document.querySelector("[data-animation-transport]")
      if (!dock || !row) return { controls: 0, out: ["no dock or transport row"], bars: 0, full: 0 }
      const d = dock.getBoundingClientRect()
      const inside = (r) => r.left >= d.left - 0.5 && r.right <= d.right + 0.5 && r.top >= d.top - 0.5 && r.bottom <= d.bottom + 0.5
      const els = [...row.querySelectorAll("button, input")].filter((el) => el.getClientRects().length)
      const out = els.filter((el) => !inside(el.getBoundingClientRect())).map((el) => (el.textContent || el.getAttribute("aria-label") || el.type || "").trim().slice(0, 12))
      // dockview mounts a panel's content outside its group's element, so the strip is found by its panel.
      const tl = document.querySelector('[data-dock-panel="timeline"]') || dock
      const strip = tl.querySelector("[data-take-timeline]")
      if (strip && !strip.checkVisibility({ visibilityProperty: true })) return { controls: els.length, out, bars: 0, full: 0, hidden: true }
      const bars = [...tl.querySelectorAll("[id^=stroke-bar-]")]
      const box = (tl.querySelector("[data-take-scroll]") || bars[0]?.parentElement)?.getBoundingClientRect()
      const full = box ? bars.filter((b) => { const r = b.getBoundingClientRect(); return r.top >= box.top - 0.5 && r.bottom <= box.bottom + 0.5 && inside(r) }).length : 0
      return { controls: els.length, out, bars: bars.length, full }
    })
    out.push({ at: `${w}x${h} ${open ? "open" : "closed"}`, ...m })
    await ctx.close()
  }
  return out
}
const r6ok = (L) => L.every((l) => l.controls > 0 && l.out.length === 0)
const r6detail = (L) => L.map((l) => `${l.at}: ${l.controls - l.out.length}/${l.controls} inside${l.out.length ? ` (out: ${l.out.join(", ")})` : ""}`).join("; ")
// Corpus: the arms where the strip shows. Draw-in open is its own tab of the dock since L3, so the strip is not
// on screen there and that arm is printed, never graded. A shown arm with no bars fails: no population, no pass.
const r7shown = (L) => L.filter((l) => !l.hidden)
const r7ok = (L) => r7shown(L).length > 0 && r7shown(L).every((l) => l.bars > 0 && l.full === Math.min(12, l.bars))
const r7fired = (L) => r7shown(L).some((l) => l.bars > 0 && l.full < Math.min(12, l.bars))
const r7detail = (L) => L.map((l) => `${l.at}: ${l.hidden ? "strip not shown, Draw-in is its own tab" : `${l.full}/${l.bars} whole`}`).join("; ")

// Row 8 (PANEL-5): with Draw-in open, no option inside it moves the canvas.
// PANEL-4 measured the content-sized dock: Window from Grow to Vanish shows more
// controls and took the canvas from 798x544 to 798x558. The open dock is a fixed
// 66% now. At both laptop sizes the row sets every Window pill and every Order
// pill in turn, then Grow and As drawn again, and reads the canvas box after each,
// at the two laptop sizes and at export-window's 1600x1500.
// A pill that is missing, or that does not read pressed after its click, fails the
// row, so a click that never lands cannot pass as "nothing moved".
// Corpus: the 4 Window pills under "Ends" and the 5 Order pills, found by label.
// Not covered: the sliders, ease, reverse and loop; opening and closing the
// section, which is meant to resize the canvas.
// Must-fail: PANEL-4's content-sized dock put back by a style tag. It fires only
// when every pill landed AND the canvas took more than one size. PANEL_MUTATE=dock
// runs the real row against that dock too, so the row itself can be seen going red.
const WINDOW_PILLS = ["Grow", "Travel", "Vanish", "Shrink"]
const ORDER_PILLS = ["As drawn", "Reversed", "Short first", "Left to right", "Random"]
const R8_STEPS = [...WINDOW_PILLS.map((l) => ["Ends", l]), ...ORDER_PILLS.map((l) => ["Order", l]), ["Ends", "Grow"], ["Order", "As drawn"]]
const REVERT_DOCK = `[data-animation-panel]{height:auto!important;max-height:66%!important}`
// CL-GATES-3: dockview sizes the dock group in script, so PANEL-4's content-sized dock goes back through its API:
// the group follows the Draw-in body's content height, the defect the row exists for.
const CONTENT_DOCK = () => {
  const fit = () => {
    const body = document.querySelector('[data-dock-panel="drawin"] [data-animation-drawin-body]')
    const g = window.__dockHarness?.api?.getPanel("drawin")?.group
    if (body && g) g.api.setSize({ height: Math.round(body.firstElementChild.getBoundingClientRect().height) + 52 })
  }
  new MutationObserver(fit).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed"] })
  fit()
}
// Scenes: the logo's 12 strokes at the two laptop sizes and at export-window's
// 1600x1500, and 2 strokes at 1512x982 and 1600x1500. With the logo the strip band
// alone keeps the open dock at its cap, so the content-sized dock never moved the
// canvas there (PANEL-5's first run: 756x533 and 640x351 throughout) and the
// must-fail could not see the defect it exists for. A short take leaves the dock
// under its cap, which is where PANEL-4's 798x544 to 798x558 came from.
const R8_SIZES = [[1512, 982, true], [1280, 800, true], [1600, 1500, true], [1512, 982, polys.slice(0, 2)], [1600, 1500, polys.slice(0, 2)]]
async function row8(css = null, shots = false) {
  const out = []
  for (const [w, h, strokes] of R8_SIZES) {
    const { ctx, page } = await fresh(w, h, strokes)
    if (css) await page.addStyleTag({ content: css })
    await openHost(page)
    if (css && (await page.evaluate(() => !!window.__dockHarness?.dock))) await page.evaluate(CONTENT_DOCK)
    await settle(page, 300)
    const box = () => page.evaluate(() => {
      const c = document.querySelector('[data-dock-panel="view3d"] canvas, [data-take-dock] canvas')
      if (!c) return null
      const r = c.getBoundingClientRect()
      return `${Math.round(r.width)}x${Math.round(r.height)} at y ${Math.round(r.top)}`
    })
    const ref = await box()
    const seen = new Set([ref])
    const missed = []
    for (const [group, label] of R8_STEPS) {
      const hit = await page.evaluate(({ group, label }) => {
        const body = document.querySelector('[data-dock-panel="drawin"] [data-animation-drawin-body], [data-animation-panel] [data-animation-drawin-body]')
        const head = body && [...body.querySelectorAll("span")].find((s) => s.textContent.trim().toLowerCase() === group.toLowerCase())
        const b = head && [...(head.nextElementSibling?.querySelectorAll("button") ?? [])].find((x) => x.textContent.trim() === label)
        if (!b) return false
        b.setAttribute("data-r8", "1")
        b.click()
        return true
      }, { group, label })
      await settle(page, 200)
      const pressed = hit && (await page.evaluate(() => {
        const b = document.querySelector("[data-r8]")
        b?.removeAttribute("data-r8")
        return b?.getAttribute("aria-pressed") === "true"
      }))
      if (!pressed) missed.push(`${group}:${label}`)
      seen.add(await box())
      if (shots && strokes === true && group === "Ends" && (label === "Grow" || label === "Vanish")) await page.screenshot({ path: `${OUT}drawin-open-${label.toLowerCase()}-${w}x${h}.png` })
    }
    out.push({ at: `${w}x${h} ${Array.isArray(strokes) ? strokes.length : polys.length} strokes`, ref, set: R8_STEPS.length - missed.length, missed, sizes: [...seen] })
    await ctx.close()
  }
  return out
}
const r8landed = (L) => L.every((l) => l.ref !== null && l.missed.length === 0)
const r8ok = (L) => r8landed(L) && L.every((l) => l.sizes.length === 1)
const r8detail = (L) => L.map((l) => `${l.at}: ${l.set}/${R8_STEPS.length} set${l.missed.length ? ` (missed ${l.missed.join(", ")})` : ""}, canvas ${l.sizes.join(" / ")}`).join("; ")
const r8fired = (L) => r8landed(L) && L.some((l) => l.sizes.length > 1)

const r1 = await row1(); row("R1", "every popover control is in the dock section and writes the same state", r1.ok, r1.detail)
const r2 = await row2(); row("R2", "the Timing button and its popover are gone", r2.ok, r2.detail)
const r3 = await row3(); row("R3", "the dock renders before any stroke", r3.ok, r3.detail)
const r4 = await row4(); row("R4", "Show animation panel opens the dock section", r4.ok, r4.detail)
const r5 = await row5()
if (r5.nc) { rows.push({ id: "R5", name: "section closed, the canvas keeps main's height at 1512x982", ok: false, nc: true, detail: r5.detail }); console.log(`NOT COMPARED R5  (${r5.detail})`) }
else row("R5", "section closed, the canvas keeps main's height at 1512x982", r5.ok, r5.detail)
const L = await layout()
row("R6", "every transport-row control lies inside the dock at 1280x800 and 1512x982, closed and open", r6ok(L), r6detail(L))
row("R7", "every strip row the closed strip shows is whole, closed and open, at both sizes", r7ok(L), r7detail(L))
const L8 = await row8(process.env.PANEL_MUTATE === "dock" ? REVERT_DOCK : null, !onMain && !process.env.PANEL_MUTATE)
row("R8", "Draw-in open, every Window mode and every Order leaves the canvas box unchanged, in all five scenes", r8ok(L8), r8detail(L8))

if (!onMain) {
  const m1a = await row1("drop"); row("R1", "a range control dropped from the dock is caught", !m1a.ok, m1a.detail, true)
  const m1b = await row1("shift"); row("R1", "a state write that differs from main is caught", !m1b.ok, m1b.detail, true)
  const m2 = await row2(true); row("R2", "a Timing button put back is caught", !m2.ok, m2.detail, true)
  const m3 = await row3(true); row("R3", "a hidden dock is caught", !m3.ok, m3.detail, true)
  const m4 = await row4(true); row("R4", "a button whose event never lands is caught", !m4.ok, m4.detail, true)
  if (!r5.nc) { const m5 = await row5(true); row("R5", "the section open (canvas shrinks) is caught", !m5.ok, m5.detail, true) }
  const m6 = await layout(REVERT_ROW); row("R6", "the nowrap row with the scrubber's floor at the window's width is caught", !r6ok(m6), r6detail(m6), true)
  const m7 = await layout(REVERT_STRIP); row("R7", "the strip's scroll box cut to PANEL's 72 px floor is caught", r7fired(m7), r7detail(m7), true)
  const m8 = await row8(REVERT_DOCK); row("R8", "PANEL-4's content-sized dock (the canvas follows the section) is caught", r8fired(m8), r8detail(m8), true)

  // Screenshots: closed, open, before the first stroke, at two sizes.
  for (const [w, h] of [[1512, 982], [1280, 800]]) {
    for (const state of ["closed", "open", "empty"]) {
      const { ctx, page } = await fresh(w, h, state !== "empty")
      if (state === "open") await openHost(page)
      await page.screenshot({ path: `${OUT}${state}-${w}x${h}.png` })
      await page.locator("[data-gate-dock], [data-animation-panel]").first().screenshot({ path: `${OUT}${state}-dock-${w}x${h}.png` }).catch(() => {})
      await ctx.close()
    }
  }
}
await browser.close()

const nc = rows.filter((r) => r.nc), real = rows.filter((r) => !r.mustFail && !r.nc), mf = rows.filter((r) => r.mustFail)
writeFileSync(`${OUT}result-${onMain ? "main" : "lane"}.json`, JSON.stringify({ tree: onMain ? "main" : "lane", denominator: keys.length, rows }, null, 1))
if (onMain) {
  const red = real.filter((r) => !r.ok).map((r) => r.id)
  console.log(`POSITIVE CONTROL on main: ${red.length} of ${real.length} rows red (${red.join(", ")}); R1-R4 must be red`)
  process.exit(["R1", "R2", "R3", "R4"].every((id) => red.includes(id)) ? 0 : 1)
}
const pass = real.filter((r) => r.ok).length, fired = mf.filter((r) => r.ok).length
console.log(`SUMMARY: ${pass}/${real.length} rows pass${nc.length ? ` (${nc.map((r) => r.id).join(", ")} NOT COMPARED)` : ""}, ${fired}/${mf.length} must-fails fired, ${keys.length} popover controls checked`)
process.exit(pass === real.length && fired === mf.length ? 0 : 1)
