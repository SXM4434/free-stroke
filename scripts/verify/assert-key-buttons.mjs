#!/usr/bin/env node
// assert-key-buttons.mjs · EVERY KEYABLE STYLE VALUE HAS ITS KEY BUTTON, AND ONLY KEYED VALUES SHOW AS LANES
//
//   FS_PORT=3140 FS_HEADED=0 node scripts/verify/assert-key-buttons.mjs
//
// Keyframe phase K3 (`docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md` §4 "The key button in Field",
// §5 row K3; his ruling of 2026-09-26: every numeric style value gets a key button beside it, keying one
// adds it as a lane in the dock, only keyed values show as lanes).
//
// Rows, each with its must-fail:
//   B1  COUNT. With every style feature on, each Style family opened in turn: the enabled key buttons are
//       exactly the keyable paths K2 does not disable (`KEY_DISABLED`), named when missing or extra; each
//       disabled path's button is disabled and says why. must-fail: `__fsKeyMutant = "dropfield"`, one
//       Field (textureScale) drawing no button: it is named missing.
//   B2  ONE LANE, IN ITS FAMILY. Clicking textureScale's button adds exactly one lane, under the Texture
//       heading, and a key at the playhead holding the value on screen.
//   B3  AN UNKEYED VALUE SHOWS NO LANE. With textureScale keyed, no other style path has a lane.
//       must-fail for B2 and B3: `"alllanes"`, the lanes listing every keyable value: keying adds no lane
//       and unkeyed values show lanes.
//   B4  HIT BOX. Every key button answers at all 25 points of a 5x5 grid over the 24x24 square centred
//       on it. must-fail: the same probe over 30x30 misses (the grid measures the button, not a bigger box).
//   B5  EDITING A KEYED VALUE KEYS IT. With textureIntensity keyed 0.2 at 0 and 0.8 at the end, moving its
//       slider to 0.35 at the middle writes a third key there holding 0.35, and the slider then shows
//       0.35. must-fail: `"noeditkey"`, the edit written to the doc's value only: no key is added.
//   B6  THE BUTTON'S LOOK. Unkeyed: outline; on a key: filled; keyed, off a key: outline with a dot.
//   G1  no page error.

const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
const { openStyle } = await import("./lib/dock.mjs")
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

// Every feature on, so every slider renders.
const ALL_ON = {
  motionMode: "independent",
  materialPreset: "custom",
  materialAnimationEnabled: true,
  materialAnimationType: "roughnessPulse",
  textureEnabled: true,
  textureMode: "grain",
  textureAnimated: true,
  ditherEnabled: true,
  ditherAnimated: true,
  asciiEnabled: true,
  asciiAnimated: true,
  layerStackEnabled: true,
  stackAnimationEnabled: true,
  stackAnimationType: "loop",
  fusionPreset: "terminalGel",
}
const FAMILIES = ["material", "animation", "texture", "dither", "ascii", "layers", "fusion"]
/** The keyable style paths as the page reports them (`window.__fsKeyPaths`), read on B1's page. */
let STYLE_PATHS = new Set()

async function open(mutant = null) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  await ctx.addInitScript(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith("fs.layout.")) localStorage.removeItem(k) } catch {} })
  if (mutant) await ctx.addInitScript((m) => { window.__fsKeyMutant = m }, mutant)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!mutant) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__fsSetKeys && window.__fsKeyPaths && window.__dockHarness?.workspace, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p.slice(0, 5), { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__revealHarness.setPlaying(false))
  await page.evaluate((st) => window.__styleHarness.setStyle(st), ALL_ON)
  await settle(page, 400)
  return { ctx, page }
}
const settle = async (page, ms = 300) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const paths = (page) => page.evaluate(() => window.__fsKeyPaths.paths)
const keysNow = (page) => page.evaluate(() => window.__fsKeys?.() ?? {})
const len = (page) => page.evaluate(() => window.__fsTransport?.derived()?.totalDuration ?? 0)

/** Every key button in the Style panel, family by family. */
async function buttons(page) {
  const out = []
  for (const f of FAMILIES) {
    await openStyle(page, f)
    await settle(page, 250)
    const got = await page.evaluate(() =>
      [...document.querySelectorAll('[data-dock-panel="style"] [data-key-button]')].map((b) => ({
        path: b.getAttribute("data-key-button"),
        disabled: b.disabled,
        label: b.getAttribute("aria-label") ?? "",
      })),
    )
    for (const b of got) out.push({ ...b, family: f })
  }
  return out
}

function count(all, found) {
  const want = all.filter((p) => !p.disabled).map((p) => p.path)
  const on = new Set(found.filter((b) => !b.disabled).map((b) => b.path))
  const missing = want.filter((p) => !on.has(p))
  const extra = [...on].filter((p) => !want.includes(p))
  const dup = found.filter((b, i) => found.findIndex((c) => c.path === b.path) !== i).map((b) => b.path)
  const badDisabled = found.filter((b) => b.disabled && !all.find((p) => p.path === b.path)?.disabled).map((b) => b.path)
  const unexplained = found.filter((b) => b.disabled && !/cannot be keyed: .{8,}/.test(b.label)).map((b) => b.path)
  const wrongFamily = found.filter((b) => all.find((p) => p.path === b.path)?.family !== b.family).map((b) => `${b.path} in ${b.family}`)
  return { want: want.length, on: on.size, missing, extra, dup, badDisabled, unexplained, wrongFamily, disabledShown: found.filter((b) => b.disabled).length }
}

// ---------------------------------------------------------------- B1
{
  const { ctx, page } = await open()
  const all = await paths(page)
  STYLE_PATHS = new Set(all.map((x) => x.path))
  const found = await buttons(page)
  const c = count(all, found)
  const ok = c.missing.length === 0 && c.extra.length === 0 && c.dup.length === 0 && c.badDisabled.length === 0 && c.unexplained.length === 0 && c.wrongFamily.length === 0 && c.want > 0
  row("B1", "enabled key buttons = keyable paths less KEY_DISABLED, each in its family", ok,
    `${c.on}/${c.want} enabled (of ${all.length} keyable, ${all.length - c.want} disabled, ${c.disabledShown} shown disabled with a reason); missing ${c.missing.join(", ") || "none"}; extra ${c.extra.join(", ") || "none"}; twice ${c.dup.join(", ") || "none"}; disabled without cause ${c.badDisabled.join(", ") || "none"}; no reason ${c.unexplained.join(", ") || "none"}; wrong family ${c.wrongFamily.join(", ") || "none"}`)

  // ------------------------------------------------------------ B4 (same page)
  await openStyle(page, "texture")
  await settle(page, 250)
  const hit = await page.evaluate(() => {
    const probe = (b, size) => {
      b.scrollIntoView({ block: "nearest" })
      const r = b.getBoundingClientRect()
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2
      let n = 0
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const t = document.elementFromPoint(cx - (size - 1) / 2 + ((size - 1) * i) / 4, cy - (size - 1) / 2 + ((size - 1) * j) / 4)
        if (t && (t === b || b.contains(t))) n++
      }
      return n
    }
    const all = [...document.querySelectorAll('[data-dock-panel="style"] [data-key-button]')]
    return { n: all.length, full24: all.filter((b) => probe(b, 24) === 25).length, full30: all.filter((b) => probe(b, 30) === 25).length, sizes: [...new Set(all.map((b) => { const r = b.getBoundingClientRect(); return `${r.width}x${r.height}` }))] }
  })
  row("B4", "every key button in the Texture family answers over 24x24", hit.n > 0 && hit.full24 === hit.n, `${hit.full24}/${hit.n} at all 25 points (${hit.sizes.join(", ")})`)
  fired("B4", "the same probe over 30x30 misses", hit.full30 < hit.n, `${hit.full30}/${hit.n} at all 25 points over 30x30`)
  await ctx.close()

  const m = await open("dropfield")
  const cm = count(await paths(m.page), await buttons(m.page))
  fired("B1", "one Field (textureScale) drawing no button", cm.missing.includes("textureScale"), `missing ${cm.missing.join(", ") || "none"}`)
  await m.ctx.close()
}

// ---------------------------------------------------------------- B2, B3, B6
async function keying(mutant) {
  const { ctx, page } = await open(mutant)
  const L = await len(page)
  await page.evaluate(() => window.__dockHarness.dock.open("timeline"))
  await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => x.textContent.trim().startsWith("Keyframes")); if (b && b.getAttribute("aria-expanded") !== "true") b.click() })
  await settle(page, 400)
  await openStyle(page, "texture")
  await page.evaluate(() => window.__revealHarness.setProgress(0.5))
  await settle(page, 400)
  const lanes = () => page.evaluate(() => [...document.querySelectorAll("[data-key-lane]")].map((l) => ({ path: l.getAttribute("data-key-lane"), group: l.closest("[data-key-group]")?.getAttribute("data-key-group") ?? null })))
  const look = () => page.evaluate(() => document.querySelector('[data-key-button="textureScale"]')?.getAttribute("data-key-look") ?? null)
  const before = await lanes()
  const look0 = await look()
  const shown = await page.evaluate(() => Number(document.querySelector('[data-key-spot="textureScale"] input[type="range"]')?.value))
  await page.locator('[data-key-button="textureScale"]').click()
  await settle(page, 400)
  const after = await lanes()
  const look1 = await look()
  const keys = await keysNow(page)
  await page.evaluate(() => window.__revealHarness.setProgress(0.1))
  await settle(page, 400)
  const look2 = await look()
  await ctx.close()
  return { L, before, after, keys, shown, looks: [look0, look1, look2] }
}
{
  const r = await keying(null)
  const added = r.after.filter((a) => !r.before.some((b) => b.path === a.path))
  const track = r.keys.textureScale ?? []
  const atMid = track.length === 1 && Math.abs(track[0].tMs - r.L * 0.5) <= 1000 / 60 && Math.abs(track[0].value - r.shown) < 1e-9
  row("B2", "keying textureScale adds exactly one lane, under Texture, and a key at the playhead holding the value shown", added.length === 1 && added[0].path === "textureScale" && added[0].group === "texture" && atMid,
    `lanes ${r.before.length} -> ${r.after.length}, added ${added.map((a) => `${a.path} in ${a.group}`).join(", ") || "none"}; key ${JSON.stringify(track)} against playhead ${(r.L * 0.5).toFixed(1)} ms, value shown ${r.shown}`)
  const style = STYLE_PATHS
  const strays = r.after.filter((l) => style.has(l.path) && l.path !== "textureScale")
  row("B3", "no unkeyed style value shows a lane", strays.length === 0 && r.before.every((l) => !style.has(l.path)), `style lanes ${r.after.filter((l) => style.has(l.path)).map((l) => l.path).join(", ") || "none"}`)
  row("B6", "the button's look: outline unkeyed, filled on a key, a dot off one", r.looks[0] === "none" && r.looks[1] === "on" && r.looks[2] === "off", `looks ${r.looks.join(" -> ")}`)
  const m = await keying("alllanes")
  const mAdded = m.after.filter((a) => !m.before.some((b) => b.path === a.path))
  const mStrays = m.after.filter((l) => style.has(l.path) && l.path !== "textureScale")
  fired("B2", "the lanes listing every keyable value: keying adds no lane", mAdded.length !== 1, `added ${mAdded.length}`)
  fired("B3", "the lanes listing every keyable value: unkeyed values show lanes", mStrays.length > 0, `${mStrays.length} unkeyed style lanes`)
}

// ---------------------------------------------------------------- B5
async function edit(mutant) {
  const { ctx, page } = await open(mutant)
  const L = await len(page)
  const k = (t, v) => ({ tMs: Math.round(t), value: v, easeOut: "linear", easeIn: "linear" })
  const refused = await page.evaluate((x) => window.__fsSetKeys(x), { textureIntensity: [k(0, 0.2), k(L, 0.8)] })
  if (refused?.length) throw new Error(`keys refused: ${refused.join("; ")}`)
  await openStyle(page, "texture")
  await page.evaluate(() => window.__revealHarness.setProgress(0.5))
  await settle(page, 500)
  const sel = '[data-key-spot="textureIntensity"] input[type="range"]'
  const before = await page.evaluate((s) => Number(document.querySelector(s)?.value), sel)
  await page.evaluate((s) => {
    const el = document.querySelector(s)
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set
    set.call(el, "0.35")
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }, sel)
  await settle(page, 500)
  const keys = await keysNow(page)
  const shownAfter = await page.evaluate((s) => Number(document.querySelector(s)?.value), sel)
  await ctx.close()
  return { L, before, keys: keys.textureIntensity ?? [], shownAfter }
}
{
  const r = await edit(null)
  const mid = r.keys.find((x) => Math.abs(x.tMs - r.L * 0.5) <= 1000 / 60)
  row("B5", "moving a keyed slider at the playhead writes a key there with the new value, and the slider shows it",
    r.keys.length === 3 && mid && Math.abs(mid.value - 0.35) < 1e-9 && Math.abs(r.shownAfter - 0.35) < 1e-9 && Math.abs(r.before - 0.5) < 0.011,
    `slider showed ${r.before} (the sample at the middle), keys ${JSON.stringify(r.keys.map((x) => [x.tMs, x.value]))}, slider after ${r.shownAfter}`)
  const m = await edit("noeditkey")
  fired("B5", "the edit written to the doc's value only", m.keys.length !== 3, `keys ${JSON.stringify(m.keys.map((x) => [x.tMs, x.value]))}, slider after ${m.shownAfter}`)
}

row("G1", "the pages threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")
await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
