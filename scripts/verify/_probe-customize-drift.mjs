#!/usr/bin/env node
// ANIM-4D drift probe. Does the canvas hold still at one style state?
// Grabs twice at the same state with every animation flag off and motionMode
// "off", and diffs the two PNGs in the page (pixel count, bbox, max delta).
// Arms: untouched, after selectPreset(dither, p0), after one ditherScale edit,
// after undo. Each arm prints the two hashes and the diff.
// FS_PORT=3139 FS_HEADED=0 node scripts/verify/_probe-customize-drift.mjs
//
// EXIT (HARDEN-A2): 1 when any arm reads MOVED or the positive control reads
// FAIL, 0 only when every arm reads SAME and the control PASSes. The "vs"
// lines that compare two arms are findings, not verdicts, and set no code.
// THE DIFFER refuses a size mismatch: two grabs of different sizes read
// DIFFERENT SIZE, never SAME. The old loop ran to the longer buffer and read
// the missing tail as NaN, which is falsy, so a grab one row short read SAME.
// A self-test at start diffs a grab against itself cropped by one row and
// throws unless it reads DIFFERENT SIZE.
// MUST-FAIL ARMS, each has to exit 1: DRIFT_MUTATE=moved changes the style
// between the untouched arm's two grabs; DRIFT_MUTATE=fail skips the positive
// control's style change; DRIFT_MUTATE=size crops the untouched arm's second
// grab by one row. Any other value is refused.
import { createJiti } from "jiti"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../..", import.meta.url).pathname } })
const S = await jiti.import("../../lib/style-system.ts")
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")

const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }
const sha = (x) => createHash("sha256").update(x).digest("hex").slice(0, 16)
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const p0 = S.PRESET_REGISTRY.dither.filter((p) => p.applies && "ditherScale" in p.applies && p.enabled)[0]
console.log(`p0 = dither/${p0.id} (${p0.label}), ${Object.keys(p0.applies).length} fields`)
const ARMS = ["moved", "fail", "size"]
const MUTATE = process.env.DRIFT_MUTATE ?? ""
if (MUTATE && !ARMS.includes(MUTATE)) throw new Error(`DRIFT_MUTATE=${MUTATE} is not an arm. Use one of: ${ARMS.join(", ")}.`)
if (MUTATE) console.log(`MUST-FAIL ARM DRIFT_MUTATE=${MUTATE} is on. This run has to exit 1.`)
const bad = []

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })).newPage()
const settle = async (ms) => { await page.waitForTimeout(ms); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
const still = async () => page.evaluate((st) => { window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) }, STILL)
const raw = () => page.evaluate(() => window.__captureHarness.grab())
const diff = (a, b) => page.evaluate(async ([a, b]) => {
  const load = (u) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => j(new Error("diff: a grab did not decode as an image")); i.src = u })
  const [ia, ib] = await Promise.all([load(a), load(b)])
  if (ia.width !== ib.width || ia.height !== ib.height) return { w: ia.width, h: ia.height, bw: ib.width, bh: ib.height, sameSize: false, n: null, max: null, bbox: null }
  const px = (i) => { const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const x = c.getContext("2d"); x.drawImage(i, 0, 0); return x.getImageData(0, 0, i.width, i.height).data }
  const da = px(ia), db = px(ib)
  let n = 0, max = 0, x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
  for (let k = 0; k < da.length; k += 4) {
    const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]), Math.abs(da[k + 3] - db[k + 3]))
    if (d || Number.isNaN(d)) { n++; max = Math.max(max, d); const p = k / 4, x = p % ia.width, y = (p / ia.width) | 0; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
  }
  return { w: ia.width, h: ia.height, bw: ib.width, bh: ib.height, sameSize: true, n, max, bbox: n ? [x0, y0, x1, y1] : null }
}, [a, b])
const moved = (d) => !d.sameSize || d.n !== 0
const said = (d) => (d.sameSize ? `${d.n} px differ of ${d.w}x${d.h}, max ${d.max}, bbox ${JSON.stringify(d.bbox)}` : `DIFFERENT SIZE ${d.w}x${d.h} vs ${d.bw}x${d.bh}`)
// The same PNG with its bottom row cut off.
const cropRow = (u) => page.evaluate(async (u) => {
  const i = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = () => j(new Error("cropRow: grab did not decode")); i.src = u })
  const c = document.createElement("canvas"); c.width = i.width; c.height = i.height - 1; c.getContext("2d").drawImage(i, 0, 0)
  return c.toDataURL("image/png")
}, u)
const arm = async (name, ms = 600) => {
  await still(); await settle(ms)
  const a = await raw()
  const force = MUTATE && name === "untouched" ? MUTATE : ""
  if (force === "moved") await page.evaluate(() => window.__styleHarness.setStyle({ ditherEnabled: true, ditherScale: 7 }))
  await settle(ms); let b = await raw()
  if (force === "moved") await page.evaluate(() => window.__styleHarness.undo())
  if (force === "size") b = await cropRow(b)
  const d = await diff(a, b)
  if (moved(d)) bad.push(`MOVED ${name}`)
  const clocks = await page.evaluate(() => ({ spin: window.__styleHarness.cameraSpin?.(), prog: window.__revealHarness.getProgress(), clock: window.__revealHarness.getClock(), playing: window.__revealHarness.isPlaying() }))
  console.log(`${moved(d) ? "MOVED" : "SAME "}  ${name}: ${sha(a)} ${sha(b)}  ${said(d)}  ${JSON.stringify(clocks)}`)
  return { a, b, d }
}
try {
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  // The differ's size arm must see a one-row crop, or every SAME below is suspect.
  const g0 = await raw(), st = await diff(g0, await cropRow(g0))
  if (!moved(st) || st.sameSize) throw new Error(`differ self-test: a grab against itself cropped by one row read ${said(st)}, not DIFFERENT SIZE. The differ cannot see a size change.`)
  console.log(`PASS   differ self-test: a grab vs itself one row short reads ${said(st)}`)
  const u = await arm("untouched")
  // positive control: a real change must register in the differ
  if (MUTATE !== "fail") await page.evaluate(() => window.__styleHarness.setStyle({ ditherEnabled: true, ditherScale: 7 }))
  await settle(600)
  // Against the arm's FIRST grab, which no must-fail arm touches. In a clean run a and b are the same pixels.
  const pc = await diff(u.a, await raw())
  if (!moved(pc)) bad.push("FAIL positive control")
  console.log(`${moved(pc) ? "PASS " : "FAIL "}  positive control: dither on moves ${said(pc)}`)
  if (MUTATE !== "fail") await page.evaluate(() => window.__styleHarness.undo())
  await page.evaluate(([f, id]) => window.__styleHarness.selectPreset(f, id), ["dither", p0.id])
  await arm("after selectPreset")
  await page.evaluate(() => window.__styleHarness.setStyle({ ditherScale: 8 }))
  const e = await arm("after ditherScale 8")
  await arm("after ditherScale 8, 2 s later", 2000)
  await page.evaluate(() => window.__styleHarness.undo())
  const base = await arm("after undo")
  // Same edit the gate makes: the slider's max, by harness.
  await page.evaluate(() => window.__styleHarness.setStyle({ ditherScale: 14 }))
  await arm("after ditherScale 14 (harness)")
  await page.evaluate(() => window.__styleHarness.undo())
  const u14 = await arm("after undo of 14")
  console.log(`  undo of 14 vs preset: ${said(await diff(base.b, u14.b))}`)
  // Now the gate's path: open the Preset panel, focus the slider, press End.
  const info = () => page.evaluate(() => { const i = window.__captureHarness.grabInfo(); return `${i.width}x${i.height}` })
  console.log(`  canvas before panel: ${await info()}`)
  await page.locator("button[aria-expanded]", { hasText: /^Preset/ }).first().click()
  await page.waitForSelector("[data-preset-customize]", { timeout: 20000 })
  if (process.argv.includes("--settle")) {
    const t0 = Date.now(); let last = "", seen = []
    for (let i = 0; i < 30; i++) {
      const g = await raw(); const h = sha(g)
      const extra = await page.evaluate(() => { const i = window.__captureHarness.grabInfo(); return `${i.width}x${i.height} spin ${window.__captureHarness.effectiveSpin?.()}` })
      if (h !== last) { seen.push(`t=${Date.now() - t0}ms ${h} ${extra}`); last = h }
      await page.waitForTimeout(150)
    }
    console.log("  hash changes after panel open:\n    " + seen.join("\n    "))
    const step = async (label, fn) => { await page.evaluate(fn); await settle(500); console.log(`    ${label}: ${sha(await raw())}`) }
    await step("nothing", () => {})
    await step("setPlaying(false)", () => window.__revealHarness.setPlaying(false))
    await step("setPlaying(false) again", () => window.__revealHarness.setPlaying(false))
    await step("setProgress(1)", () => window.__revealHarness.setProgress(1))
    await step("setProgress(1) again", () => window.__revealHarness.setProgress(1))
    await step("setProgress(1) third", () => window.__revealHarness.setProgress(1))
    const bnd = () => page.evaluate(() => JSON.stringify(window.__captureHarness.bounds?.()))
    console.log(`    bounds before: ${await bnd()}`)
    await step("setSpin(0) (not style)", () => window.__captureHarness.setSpin?.(0))
    await step("setLoop(true) (viewport state, not style)", () => window.__revealHarness.setLoop(true))
    await step("setLoop(false)", () => window.__revealHarness.setLoop(false))
    await step("setStyle({}) (new object, no field changed)", () => window.__styleHarness.setStyle({}))
    console.log(`    bounds after: ${await bnd()}`)
    await step("setStyle({}) again", () => window.__styleHarness.setStyle({}))
  }
  const open = await arm("panel open")
  console.log(`  canvas with panel: ${await info()}; vs before panel ${said(await diff(base.b, open.b))}`)
  const range = '[data-preset-customize] [data-field-keys="ditherScale"] input[type=range]'
  const scrolls = () => page.evaluate(() => {
    const out = [`window ${scrollX},${scrollY}`]
    for (const el of document.querySelectorAll("*")) if (el.scrollTop || el.scrollLeft) out.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className).slice(0, 60)} ${el.scrollLeft},${el.scrollTop}`)
    const r = document.querySelector("canvas")?.getBoundingClientRect()
    out.push(`canvas rect ${r && [r.x, r.y, r.width, r.height].map(Math.round).join(",")}`)
    return out.join(" | ")
  })
  const wait = await arm("panel open, 3 s later, no focus", 3000)
  console.log(`  3 s wait vs open: ${said(await diff(open.b, wait.b))}`)
  await page.evaluate(() => document.querySelector("[data-preset-customize] select")?.focus())
  const fsel = await arm("a select focused instead")
  console.log(`  select focus vs open: ${said(await diff(open.b, fsel.b))}`)
  console.log(`  scroll before focus: ${await scrolls()}`)
  await page.focus(range)
  console.log(`  scroll after focus:  ${await scrolls()}`)
  const foc = await arm("slider focused, no edit")
  console.log(`  focus vs open: ${said(await diff(open.b, foc.b))}`)
  if (process.env.DRIFT_OUT) {
    const { writeFileSync } = await import("node:fs")
    writeFileSync(process.env.DRIFT_OUT + "/open.png", Buffer.from(open.b.split(",")[1], "base64"))
    writeFileSync(process.env.DRIFT_OUT + "/focus.png", Buffer.from(foc.b.split(",")[1], "base64"))
    await page.screenshot({ path: process.env.DRIFT_OUT + "/page-focus.png" })
  }
  await page.keyboard.press("End")
  const ed = await arm("after End key")
  console.log(`  state ditherScale ${await page.evaluate(() => window.__styleHarness.get().styleState.ditherScale)}; canvas ${await info()}`)
  await page.evaluate(() => window.__styleHarness.undo())
  const un = await arm("after undo of End")
  const dd = await diff(open.b, un.b)
  console.log(`  undo of End vs panel open: ${said(dd)}; canvas ${await info()}`)
  await page.mouse.click(5, 5)
  const blur = await arm("after click away (blur)")
  console.log(`  blurred vs panel open: ${said(await diff(open.b, blur.b))}`)
  if (process.argv.includes("--series")) {
    await still()
    const hs = []
    for (let i = 0; i < 8; i++) { await settle(250); hs.push(sha(await raw())) }
    console.log("series every 250 ms:", hs.join(" "))
  }
} finally {
  await browser.close()
}
console.log(bad.length ? `EXIT 1: ${bad.length} failed: ${bad.join("; ")}` : "EXIT 0: every arm SAME, the positive control PASSed")
process.exitCode = bad.length ? 1 : 0
