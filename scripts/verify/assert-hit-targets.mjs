#!/usr/bin/env node
// assert-hit-targets.mjs · CAN A KEY, A LANE AND A BAR'S END BE GRABBED?
//
//   FS_PORT=3140 FS_HEADED=0 node scripts/verify/assert-hit-targets.mjs
//
// Layout rethink phase L6 (`docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md` §4 "Hit targets",
// §5 row L6). His ruling of 2026-09-26: "it's literally hard to click on the keyframes". Measured before
// (mockups/MOCKUPS.md): key rows 12 px, the add-key button 12x12, keys 12x12, strip grips 6x8.
//
// Every row measures a control type on the page and reports pass out of total. A hit box is not the
// element's box: it is where `elementFromPoint` answers with the control, probed on a grid of points.
//   H1  every key row is at least 32 px tall; 36 px while the dock is maximized.
//   H2  every key is DRAWN 10 to 14 px (the diamond's box).
//   H3  every key is CLICKABLE over at least 24x24 around its centre: 25 points on a 5x5 grid over the
//       24x24 square centred on the key all resolve to that key.
//   H4  every add-key button is clickable over at least 24x24 the same way.
//   H5  every strip bar's two ends are grabbable over at least 24 px: 9 points across a 24 px span that
//       reaches 12 px into the bar (a third of a short bar) and the rest outside, at the row's centre,
//       all resolve to that end's handle or grip. At the axis's own edge the span lies wholly inside the
//       axis (there is no outside to grab); it is still 24 px.
//   H6  every resize edge between panels is an 8 px grab strip.
//   H7  every bezier handle of the speed curve is a 5 px dot with a 24 px hit circle: its centre, 8
//       points at 6 px and 8 at 11.5 px from it, 17 in all, resolve to that handle.
// MUST-FAIL: the same seven measurements on a page with `__fsHitMutant = "old"`, today's sizes (12 px
// rows, 12x12 keys and add buttons, 6 px grips, 4 px edges, a 16 px handle with a 7 px dot): each
// row's count must drop.

const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
import { readFileSync } from "node:fs"

const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
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

async function open(mutant) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  await ctx.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout.")) localStorage.removeItem(k) } catch {} })
  if (mutant) await ctx.addInitScript((m) => { window.__fsHitMutant = m }, mutant)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!mutant) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__dockHarness?.maximize && window.__fsSetKeys, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__revealHarness.setPlaying(false))
  // Keys on four lanes, far enough apart that no two hit boxes could share a point.
  const len = await page.evaluate(() => window.__fsTransport?.derived()?.takeLen ?? 8000)
  const k = (t, v) => ({ tMs: Math.round(t), value: v, easeOut: "linear", easeIn: "linear" })
  const keys = {
    drawProgress: [k(0, 0), k(len * 0.5, 0.6), k(len, 1)],
    depth: [k(len * 0.2, 1), k(len * 0.8, 1.5)],
    turn: [k(len * 0.3, 0), k(len * 0.9, 45)],
    azimuth: [k(len * 0.1, 0), k(len * 0.6, 30)],
  }
  const refused = await page.evaluate((x) => window.__fsSetKeys(x), keys)
  if (refused?.length) throw new Error(`keys refused: ${refused.join("; ")}`)
  await page.evaluate(() => window.__dockHarness.dock.open("timeline"))
  await page.evaluate(() => window.__dockHarness.api.groups.find((g) => g.panels.some((p) => p.id === "timeline")).api.setSize({ height: 520 }))
  await settle(page, 500)
  // Open the lanes the way a person does: the Keyframes disclosure.
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith("Keyframes")); if (b && b.getAttribute("aria-expanded") !== "true") b.click() })
  await settle(page, 600)
  return { ctx, page }
}
const settle = async (page, ms = 300) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

/* Scroll a control into view inside its own scroll box, then probe a grid of points. */
const MEASURE = () => {
  const grid = (cx, cy, w, h, nx, ny) => {
    const pts = []
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) pts.push([cx - w / 2 + (w * i) / (nx - 1), cy - h / 2 + (h * j) / (ny - 1)])
    return pts
  }
  const hits = (el, pts, ok) => pts.filter(([x, y]) => { const t = document.elementFromPoint(x, y); return !!t && ok(t) }).length
  const out = { rows: [], drawn: [], keyHit: [], addHit: [], ends: [], sashes: [], handles: [], dots: [] }
  for (const lane of document.querySelectorAll("[data-key-lane]")) {
    const r = lane.querySelector(":scope > div.flex")?.getBoundingClientRect()
    if (r) out.rows.push(Math.round(r.height * 10) / 10)
  }
  for (const key of document.querySelectorAll("[data-key]")) {
    key.scrollIntoView({ block: "nearest", inline: "nearest" })
    const r = key.getBoundingClientRect()
    const mark = key.querySelector("[data-key-mark]") ?? key.querySelector("span")
    const m = mark?.getBoundingClientRect()
    out.drawn.push(m ? Math.round(Math.max(m.width, m.height) * 10) / 10 : 0)
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const pts = grid(cx, cy, 23, 23, 5, 5)
    out.keyHit.push(`${hits(key, pts, (t) => t === key || key.contains(t))}/${pts.length}`)
  }
  for (const add of document.querySelectorAll("[data-key-add]")) {
    add.scrollIntoView({ block: "nearest", inline: "nearest" })
    const r = add.getBoundingClientRect()
    const pts = grid(r.left + r.width / 2, r.top + r.height / 2, 23, 23, 5, 5)
    out.addHit.push(`${hits(add, pts, (t) => t === add || add.contains(t))}/${pts.length}`)
  }
  for (const bar of document.querySelectorAll("[data-take-bar]")) {
    const r = bar.getBoundingClientRect()
    if (r.width < 9) continue
    bar.scrollIntoView({ block: "nearest", inline: "nearest" })
    const b = bar.getBoundingClientRect()
    const inside = Math.min(12, b.width / 3)
    const cy = b.top + b.height / 2
    // The axis: a bar's row spans it. At the axis's edge there is no outside, so the 24 px span lies
    // wholly inside it (the handle shifts in the same way); it is 24 px either way.
    const ax = bar.closest("[data-take-row]").getBoundingClientRect()
    for (const side of ["start", "end"]) {
      const from = side === "start" ? Math.max(ax.left + 0.5, b.left + inside - 23.5) : Math.min(ax.right - 23.5, b.right - inside + 0.5)
      const pts = Array.from({ length: 9 }, (_, i) => [from + (23 * i) / 8, cy])
      const n = hits(bar, pts, (t) => {
        const h = t.closest("[data-grip-hit],[data-grip]")
        if (!h) return false
        const which = h.getAttribute("data-grip-hit") ?? h.getAttribute("data-grip")
        const own = h.closest("[data-take-row]") === bar.closest("[data-take-row]")
        return own && which === side
      })
      out.ends.push(`${n}/9`)
    }
  }
  for (const h of document.querySelectorAll("[data-curve-handle]")) {
    h.scrollIntoView({ block: "nearest", inline: "nearest" })
    const r = h.getBoundingClientRect()
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    const pts = [[cx, cy]]
    for (const rad of [6, 11.5]) for (let i = 0; i < 8; i++) pts.push([cx + rad * Math.cos((i * Math.PI) / 4), cy + rad * Math.sin((i * Math.PI) / 4)])
    out.handles.push(`${hits(h, pts, (t) => t === h || h.contains(t))}/${pts.length}`)
    const d = h.querySelector("[data-curve-dot]") ?? h.querySelector("span")
    const db = d?.getBoundingClientRect()
    out.dots.push(db ? Math.round(Math.max(db.width, db.height) * 10) / 10 : 0)
  }
  for (const s of document.querySelectorAll(".dv-sash.dv-enabled")) {
    const r = s.getBoundingClientRect()
    if (r.width < 1 || r.height < 1) continue
    out.sashes.push(Math.round(Math.min(r.width, r.height) * 10) / 10)
  }
  return out
}
const full = (list) => list.filter((x) => typeof x === "string" && x.split("/")[0] === x.split("/")[1]).length

async function measure(mutant) {
  const { ctx, page } = await open(mutant)
  const m = await page.evaluate(MEASURE)
  await page.evaluate(() => window.__dockHarness.maximize.toggle("timeline"))
  await settle(page, 600)
  const mMax = await page.evaluate(MEASURE)
  // The speed curve between the first two Draw keys, opened the way a click on the span opens it.
  await page.evaluate(() => document.querySelector("[data-key-span='drawProgress:0']")?.click())
  await settle(page, 500)
  const mCurve = await page.evaluate(MEASURE)
  await ctx.close()
  return { m, mMax, mCurve }
}
const summarise = ({ m, mMax, mCurve }) => ({
  rows: m.rows.filter((h) => h >= 32).length,
  rowsN: m.rows.length,
  rowsMax: mMax.rows.filter((h) => h >= 36).length,
  rowsMaxN: mMax.rows.length,
  drawn: m.drawn.filter((d) => d >= 10 && d <= 14).length,
  drawnN: m.drawn.length,
  keyHit: full(m.keyHit),
  keyHitN: m.keyHit.length,
  addHit: full(m.addHit),
  addHitN: m.addHit.length,
  ends: full(m.ends),
  endsN: m.ends.length,
  sashes: m.sashes.filter((w) => w >= 8).length,
  sashesN: m.sashes.length,
  handles: mCurve.handles.filter((x, i) => x.split("/")[0] === x.split("/")[1] && Math.abs(mCurve.dots[i] - 5) <= 0.5).length,
  handlesN: mCurve.handles.length,
  raw: m,
  rawCurve: mCurve,
})

const L = summarise(await measure(null))
row("H1", "key rows at least 32 px; 36 px with the dock maximized", L.rowsN > 0 && L.rows === L.rowsN && L.rowsMax === L.rowsMaxN, `${L.rows}/${L.rowsN} rows at 32 or more (${[...new Set(L.raw.rows)].join(", ")} px); maximized ${L.rowsMax}/${L.rowsMaxN} at 36 or more`)
row("H2", "keys drawn 10 to 14 px", L.drawnN > 0 && L.drawn === L.drawnN, `${L.drawn}/${L.drawnN} (${[...new Set(L.raw.drawn)].join(", ")} px)`)
row("H3", "keys clickable over 24x24", L.keyHitN > 0 && L.keyHit === L.keyHitN, `${L.keyHit}/${L.keyHitN} keys hit at all 25 points (${L.raw.keyHit.join(" ")})`)
row("H4", "add-key buttons clickable over 24x24", L.addHitN > 0 && L.addHit === L.addHitN, `${L.addHit}/${L.addHitN} (${L.raw.addHit.join(" ")})`)
row("H5", "strip bar ends grabbable over 24 px", L.endsN > 0 && L.ends === L.endsN, `${L.ends}/${L.endsN} ends hit at all 9 points`)
row("H6", "resize edges 8 px", L.sashesN > 0 && L.sashes === L.sashesN, `${L.sashes}/${L.sashesN} (${[...new Set(L.raw.sashes)].join(", ")} px)`)
row("H7", "bezier handles: 5 px dot, 24 px hit circle", L.handlesN > 0 && L.handles === L.handlesN, `${L.handles}/${L.handlesN} (hits ${L.rawCurve.handles.join(" ")}; dots ${L.rawCurve.dots.join(", ")} px)`)

const O = summarise(await measure("old"))
fired("H1", "today's 12 px rows", O.rows < O.rowsN, `${O.rows}/${O.rowsN}`)
fired("H2", "today's 7 px diamond (9.9 px drawn)", O.drawn < O.drawnN, `${O.drawn}/${O.drawnN} (${[...new Set(O.raw.drawn)].join(", ")} px)`)
fired("H3", "today's 12x12 key", O.keyHit < O.keyHitN, `${O.keyHit}/${O.keyHitN}`)
fired("H4", "today's 12x12 add button", O.addHit < O.addHitN, `${O.addHit}/${O.addHitN}`)
fired("H5", "today's 6x8 grips", O.ends < O.endsN, `${O.ends}/${O.endsN}`)
fired("H6", "today's 4 px edges", O.sashes < O.sashesN, `${O.sashes}/${O.sashesN}`)
fired("H7", "today's 16 px handle, 7 px dot", O.handles < O.handlesN, `${O.handles}/${O.handlesN} (hits ${O.rawCurve.handles.join(" ")}; dots ${O.rawCurve.dots.join(", ")} px)`)

row("G1", "the lane pages threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")
await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
