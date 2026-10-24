#!/usr/bin/env node
// ANIM-4E look probe. Customize at 1512x982 on the Fusion preset with the most
// Customize fields (Fusion is the widest family), one field edited with a real
// key press, the page as he sees it (take panel docked, no test stylesheet).
// Writes docs/verification/presets/customize-fusion-<tag>.png (whole page) and
// customize-fusion-<tag>-panel.png (the Customize section, scrolled into view
// top first, then the rest of it), and prints the section's box and field count.
// FS_PORT=3138 FS_HEADED=0 node scripts/verify/_probe-customize-look.mjs [tag] [family] [WxH]
// ANIM-4F: family (default fusion) and window (default 1512x982) are arguments;
// a window other than 1512x982 adds -WxH to the file names. Also prints, with
// the drawer as it first opens (scrollTop 0, before the edit), whether Save as
// mine and Reset all sit inside the drawer's visible box and the window; per
// system section, its heading, field count, height, columns used, the top rule
// of its first block, and any field label that repeats inside it. Exits 1 when
// a button is out of view, a label repeats inside a section, or a first block
// keeps a top rule; exits 2 when there is nothing to look at.
// HARDEN-A3: the section verdict used to pass on an empty list, since its loop
// ran zero times. It now fails by name, exit 1, on ZERO SYSTEMS (no
// [data-customize-system] inside Customize), ZERO SHOWN SYSTEMS (all hidden),
// and SHOWN SYSTEM WITH NO FIELDS, and prints how many systems and fields it
// graded, against the Customize section's own field count.
// MUST-FAIL ARMS, set LOOK_MUTATE, each has to exit nonzero; each edits the
// page's DOM just before the sections are read, so the real read path runs:
//   empty     strips data-customize-system from every section
//   hidden    sets display:none on every section
//   nofields  pins the first shown section's display (the page's CSS hides a
//             section with no field in scope), then strips data-field-keys
//             from its fields
// Other values refused.
import { createJiti } from "jiti"
import { readFileSync, mkdirSync } from "node:fs"
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../..", import.meta.url).pathname } })
const S = await jiti.import("../../lib/style-system.ts")
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
const tag = process.argv[2] ?? "before"
const family = process.argv[3] ?? "fusion"
const [VW, VH] = (process.argv[4] ?? "1512x982").split("x").map(Number)
const size = VW === 1512 && VH === 982 ? "" : `-${VW}x${VH}`
const OUT = new URL("../../docs/verification/presets/", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const pool = (S.PRESET_REGISTRY[family] ?? []).filter((p) => p.applies && p.enabled !== false)
if (!pool.length) { console.log(`NOTHING TO LOOK AT: no ${family} preset with applies`); process.exit(2) }
const p = pool.reduce((a, b) => (S.presetFields(b).length > S.presetFields(a).length ? b : a))
console.log(`${family}/${p.id} (${p.label}), ${S.presetFields(p).length} fields at ${VW}x${VH}: ${S.presetFields(p).join(" ")}`)
let bad = 0
const LOOK_ARMS = ["empty", "hidden", "nofields"]
const MUTATE = process.env.LOOK_MUTATE ?? ""
if (MUTATE && !LOOK_ARMS.includes(MUTATE)) throw new Error(`LOOK_MUTATE=${MUTATE} is not an arm. Use one of: ${LOOK_ARMS.join(", ")}.`)
if (MUTATE) console.log(`MUST-FAIL ARM LOOK_MUTATE=${MUTATE} is on. This run has to exit nonzero.`)

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 })).newPage()
try {
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness, null, { timeout: 240000 })
  await page.evaluate((x) => window.__styleHarness.injectStrokes(x, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate(([f, id]) => window.__styleHarness.selectPreset(f, id), [family, p.id])
  await page.locator("button[aria-expanded]", { hasText: /^Preset/ }).first().click()
  await page.waitForSelector("[data-preset-customize]", { timeout: 20000 })
  await page.waitForTimeout(400)
  const first = await page.$eval("[data-preset-customize]", (n) => {
    let box = null
    for (let e = n.parentElement; e; e = e.parentElement) if (/(auto|scroll)/.test(getComputedStyle(e).overflowY)) { box = e; break }
    const b = box ? box.getBoundingClientRect() : { top: 0, bottom: innerHeight, left: 0, right: innerWidth }
    const inView = (sel) => {
      const el = n.querySelector(sel)
      if (!el) return { sel, found: false }
      const r = el.getBoundingClientRect()
      const ok = r.width > 0 && r.top >= Math.max(b.top, 0) && r.bottom <= Math.min(b.bottom, innerHeight) && r.left >= Math.max(b.left, 0) && r.right <= Math.min(b.right, innerWidth)
      return { sel, found: true, ok, top: Math.round(r.top), bottom: Math.round(r.bottom) }
    }
    return { scrollTop: box ? box.scrollTop : null, drawer: { top: Math.round(b.top), bottom: Math.round(b.bottom), w: Math.round(b.right - b.left) }, buttons: [inView("[data-save-mine]"), inView("[data-reset-all]")] }
  })
  console.log(`drawer as it opens: scrollTop ${first.scrollTop}, visible y ${first.drawer.top}-${first.drawer.bottom}, width ${first.drawer.w}`)
  for (const b of first.buttons) { console.log(`  ${b.ok ? "OK  " : "FAIL"} ${b.sel} ${b.found ? `y ${b.top}-${b.bottom}` : "not found"}`); if (!b.ok) bad++ }
  const range = page.locator("[data-preset-customize] [data-field-keys] input[type=range]").first()
  let key = "(no slider)"
  if (await range.count()) {
    key = await range.evaluate((el) => el.closest("[data-field-keys]").dataset.fieldKeys)
    await range.focus(); await page.keyboard.press("End")
  }
  await page.evaluate(() => { window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) })
  await page.waitForTimeout(800)
  await page.mouse.move(2, 2)
  const info = await page.$eval("[data-preset-customize]", (n) => {
    const r = n.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), fields: n.querySelectorAll("[data-field-keys]").length, readOnly: n.querySelectorAll("[data-read-only-field]").length, dots: n.querySelectorAll("[data-edited-dot]").length }
  })
  console.log(`edited ${key}; Customize box ${JSON.stringify(info)}`)
  if (MUTATE) console.log(`LOOK_MUTATE=${MUTATE}: ${await page.$$eval("[data-preset-customize] [data-customize-system]", (ns, m) => {
    if (m === "empty") { for (const n of ns) n.removeAttribute("data-customize-system"); return `stripped the attribute from ${ns.length} section(s)` }
    if (m === "hidden") { for (const n of ns) n.style.display = "none"; return `hid ${ns.length} section(s)` }
    const n = ns.find((x) => getComputedStyle(x).display !== "none")
    const fs = n ? [...n.querySelectorAll("[data-field-keys]")] : []
    // The page's CSS hides a section with no field in scope, so the section's
    // display is pinned first; otherwise this arm builds a HIDDEN empty section.
    if (n) n.style.setProperty("display", getComputedStyle(n).display, "important")
    for (const f of fs) f.removeAttribute("data-field-keys")
    return n ? `stripped data-field-keys from ${fs.length} field(s) in ${n.dataset.customizeSystem}, display pinned to ${n.style.display}` : "no shown section to strip"
  }, MUTATE)}`)
  const systems = await page.$$eval("[data-preset-customize] [data-customize-system]", (ns) => ns.map((n) => {
    const shown = getComputedStyle(n).display !== "none"
    const cols = n.querySelector(":scope > div")
    const root = cols?.firstElementChild
    const firstBlock = root?.firstElementChild
    const fields = [...n.querySelectorAll("[data-field-keys]")]
    // A field's NAME is the first label that belongs to its own wrapper: a
    // field label (11px medium muted), or a card title (12px medium foreground,
    // the layer cards "2 · Dither"). SUB-LABELS are every field label, so the
    // "Opacity" inside each layer card shows up there, reported, not failed.
    const isLabel = (e) => /text-\[11px\]/.test(e.className) && /font-medium/.test(e.className) && /text-muted-foreground/.test(e.className)
    const isTitle = (e) => /(^|\s)text-xs(\s|$)/.test(e.className) && /font-medium/.test(e.className) && /text-foreground/.test(e.className)
    const clean = (t) => t.trim().replace(/[\s.:,]*[-\d.,]+\s*(x|×|%|°|px|ms|s)?$/i, "").replace(/\.\s.*$/, "").trim()
    const labels = fields.map((f) => [...f.querySelectorAll("span, label")].find((e) => e.closest("[data-field-keys]") === f && (isLabel(e) || isTitle(e)))).filter(Boolean).map((e) => clean(e.textContent)).filter(Boolean)
    const subs = [...n.querySelectorAll("span, label")].filter(isLabel).map((e) => clean(e.textContent)).filter(Boolean)
    const seen = new Map(); for (const l of labels) seen.set(l, (seen.get(l) ?? 0) + 1)
    const subSeen = new Map(); for (const l of subs) subSeen.set(l, (subSeen.get(l) ?? 0) + 1)
    const cs = cols ? getComputedStyle(cols) : null
    const W = cols ? cols.getBoundingClientRect().width : 0, gap = cs ? parseFloat(cs.columnGap) || 0 : 0, cw = cs ? parseFloat(cs.columnWidth) : NaN
    const used = Number.isFinite(cw) ? Math.max(1, Math.floor((W + gap) / (cw + gap))) : 1
    const pitch = (W + gap) / used, left = cols ? cols.getBoundingClientRect().left : 0
    const inCols = [...new Set(fields.map((f) => Math.floor((f.getBoundingClientRect().left - left + 1) / pitch)))].sort()
    const colTop = inCols.map((c) => Math.round(Math.min(...fields.filter((f) => Math.floor((f.getBoundingClientRect().left - left + 1) / pitch) === c).map((f) => f.getBoundingClientRect().top))))
    const ruled = root ? [...root.children].filter((e) => parseFloat(getComputedStyle(e).borderTopWidth) > 0).length : 0
    return {
      name: n.dataset.customizeSystem, shown,
      heading: n.querySelector("h5")?.textContent ?? null,
      fields: fields.length,
      h: Math.round(n.getBoundingClientRect().height),
      used, inCols, colW: Math.round((W - (used - 1) * gap) / used),
      firstRule: firstBlock ? getComputedStyle(firstBlock).borderTopWidth : null,
      colTop, ruled,
      subRepeats: [...subSeen].filter(([, c]) => c > 1),
      labels, repeats: [...seen].filter(([, c]) => c > 1),
    }
  }))
  const across = new Map()
  for (const s of systems.filter((s) => s.shown)) {
    console.log(`  ${s.name}: heading ${JSON.stringify(s.heading)}, ${s.fields} fields, ${s.h} px, ${s.used} column(s) of ${s.colW} px, fields in column(s) ${s.inCols.join("+")}, column tops y ${s.colTop.join("/")}, first block top rule ${s.firstRule}, group rules ${s.ruled}, name repeats ${JSON.stringify(s.repeats)}`)
    console.log(`    field names: ${s.labels.join(" | ")}`)
    if (s.subRepeats.length) console.log(`    sub-labels seen more than once (inside different fields): ${s.subRepeats.map(([l, c]) => `${l} x${c}`).join(", ")}`)
    if (s.repeats.length) bad++
    if (s.firstRule && s.firstRule !== "0px") bad++
    if (s.ruled) bad++
    if (s.colTop.length > 1 && Math.max(...s.colTop) - Math.min(...s.colTop) > 2) { console.log(`    FAIL column tops differ by ${Math.max(...s.colTop) - Math.min(...s.colTop)} px`); bad++ }
    for (const l of new Set(s.labels)) across.set(l, [...(across.get(l) ?? []), s.name])
  }
  // The loop above grades nothing when the list is empty, so an empty list is
  // a FAIL by name here, never a quiet pass.
  const shownSys = systems.filter((s) => s.shown)
  if (!systems.length) { console.log("  FAIL ZERO SYSTEMS: no [data-customize-system] inside Customize, so no section was graded"); bad++ }
  else if (!shownSys.length) { console.log(`  FAIL ZERO SHOWN SYSTEMS: ${systems.length} section(s) found, every one hidden, so no section was graded`); bad++ }
  for (const s of shownSys.filter((s) => !s.fields)) { console.log(`  FAIL SHOWN SYSTEM WITH NO FIELDS: ${s.name}, heading ${JSON.stringify(s.heading)}`); bad++ }
  const gradedFields = shownSys.reduce((a, s) => a + s.fields, 0)
  console.log(`  graded ${shownSys.length} shown system(s) of ${systems.length} found, ${gradedFields} field(s); the Customize section holds ${info.fields} field(s)`)
  const hiddenWithFields = systems.filter((s) => !s.shown && s.fields)
  const hidden = systems.filter((s) => !s.shown).map((s) => s.name)
  console.log(`  hidden sections (no field in scope): ${hidden.join(", ") || "none"}${hiddenWithFields.length ? `; FAIL hidden with fields: ${hiddenWithFields.map((s) => s.name)}` : ""}`)
  if (hiddenWithFields.length) bad++
  console.log(`  labels in more than one section: ${[...across].filter(([, v]) => v.length > 1).map(([l, v]) => `${l} (${v.join(", ")})`).join("; ") || "none"}`)
  await page.$eval("[data-preset-customize]", (n) => { for (let e = n.parentElement; e; e = e.parentElement) if (/(auto|scroll)/.test(getComputedStyle(e).overflowY)) e.scrollTop = 0 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}customize-${family}-${tag}${size}.png` })
  await page.$eval("[data-preset-customize]", (n) => n.scrollIntoView({ block: "start" }))
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}customize-${family}-${tag}${size}-panel.png` })
  // The whole section in one image: the drawer's scroll box unclamped for this
  // shot only (test-only style), so the layout can be judged top to bottom.
  await page.$eval("[data-preset-customize]", (n) => { for (let e = n.parentElement; e; e = e.parentElement) { const cs = getComputedStyle(e); if (/(auto|scroll)/.test(cs.overflowY)) { e.style.maxHeight = "none"; e.style.height = "auto"; e.style.overflow = "visible" } } })
  await page.waitForTimeout(400)
  await page.locator("[data-preset-customize]").screenshot({ path: `${OUT}customize-${family}-${tag}${size}-whole.png` })
  const whole = await page.$eval("[data-preset-customize]", (n) => { const r = n.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}` })
  console.log(`wrote customize-${family}-${tag}${size}.png, -panel.png and -whole.png (${whole})`)
} finally {
  await browser.close()
}
console.log(bad ? `${bad} FAIL` : "ALL OK")
process.exit(bad ? 1 : 0)
