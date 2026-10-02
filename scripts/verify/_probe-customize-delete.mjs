#!/usr/bin/env node
// ANIM-4E delete probe. Does deleting a Mine preset resize the GL canvas?
// Walks the gate's path to a saved Mine preset (dither p0, one ditherScale
// edit, Save as mine), then deletes it and prints, before and after: the GL
// canvas size, the Customize section's presence, the panel's height, the
// active preset, and the settled grab hash. A settled grab is the gate's:
// canvas size holds 250 ms, a no-op STILL setStyle, 600 ms.
// Arms: before delete; after delete; after delete with the Presets panel shut;
// before delete with the panel shut (undo, then shut).
// FS_PORT=3139 FS_HEADED=0 node scripts/verify/_probe-customize-delete.mjs
//
// VERDICT (HARDEN-A3), five rows, exit 1 if any FAILs or the count is not 5.
// Sizes are compared only at one panel state, since opening the Presets panel
// shrinks the canvas on its own (890 shut, 449 open with Customize shown, read
// on :3139). With the panel open the delete DOES resize, on purpose: it leaves
// no active preset, Customize unmounts, the panel loses about 178 px and the
// canvas grows 755x449 -> 755x627 (RUN-QUEUE F118, "Delete keeps the picture").
// So the open row asks whether the canvas lands on the no-preset size, and the
// picture is graded with the panel shut.
//   PRESET GONE              the saved mine:* id is not in the DOM after the delete.
//   REFERENCE ARM            a fresh context, same window, dither p0 selected and
//                            then activePresetId cleared (no delete), Presets
//                            panel open: active null, family dither, Customize
//                            gone, the chip reads expanded, and the canvas holds
//                            one real size. Anything else and the open row has
//                            nothing to compare against, so it fails by name.
//   SETTLED TO NO-PRESET SIZE, open
//                            after delete, panel open: the held size is real
//                            (never "none" or "unsettled"), still the same after
//                            the grab's 600 ms, and equals the reference size.
//                            The 8-read trail after the click is printed, not
//                            graded: it is the resize in flight.
//   DID NOT RESIZE, shut     after delete and before delete (undo), panel shut,
//                            read one size.
//   PICTURE UNCHANGED        the same two panel-shut grabs have one hash.
// The panel-open hash pair is printed, not graded.
// MUST-FAIL ARMS, each has to exit 1 on a row the clean run passes:
// DELETE_MUTATE=resize sets the viewport to 1512x900 after the panel-shut
// after-delete grab; DELETE_MUTATE=picture sets ditherScale 3 after the undo;
// DELETE_MUTATE=reach puts back, after the delete, a test-only block as tall as
// the Customize section was, in the nearest ancestor of Customize still on the
// page, so the panel keeps its height and the open canvas cannot reach the
// reference. The block is removed before the panel is shut. Other values refused.
import { createJiti } from "jiti"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../..", import.meta.url).pathname } })
const S = await jiti.import("../../lib/style-system.ts")
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
const { hideDock } = await import("./lib/dock.mjs")

const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }
const sha = (x) => createHash("sha256").update(x).digest("hex").slice(0, 16)
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const p0 = S.PRESET_REGISTRY.dither.filter((p) => p.applies && "ditherScale" in p.applies && p.enabled)[0]
const ARMS = ["resize", "picture", "reach"]
const MUTATE = process.env.DELETE_MUTATE ?? ""
if (MUTATE && !ARMS.includes(MUTATE)) throw new Error(`DELETE_MUTATE=${MUTATE} is not an arm. Use one of: ${ARMS.join(", ")}.`)
if (MUTATE) console.log(`MUST-FAIL ARM DELETE_MUTATE=${MUTATE} is on. This run has to exit 1.`)
const rows = []
const row = (ok, name, why) => { rows.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}  :  ${why}`) }

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })).newPage()
const settle = async (ms, pg = page) => { await pg.waitForTimeout(ms); await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
const size = (pg = page) => pg.evaluate(() => { const i = window.__captureHarness.grabInfo(); return i ? `${i.width}x${i.height}` : "none" })
const held = async (pg = page) => { let a = await size(pg); for (let i = 0; i < 12; i++) { await settle(250, pg); const b = await size(pg); if (a === b) return b; a = b } return `unsettled ${a}` }
const grab = async () => {
  const s = await held()
  await page.evaluate((st) => { window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) }, STILL)
  await settle(600)
  const hash = sha(await page.evaluate(() => window.__captureHarness.grab()))
  return { size: s, hash, after: await size(), toString() { return `${this.size} ${this.hash}` } }
}
const look = (tag, pg = page) => pg.evaluate((tag) => {
  const c = document.querySelector("[data-preset-customize]")
  const panel = c?.closest("[role=dialog], [data-style-panel], aside, section:not([data-preset-customize])")
  const s = window.__styleHarness.get().styleState
  return `${tag}: customize ${c ? "shown" : "gone"}, mine group ${document.querySelector("[data-mine-group]") ? "shown" : "gone"}, active ${s.activePresetId ?? "null"}, family ${s.activePresetFamily}, last applied ${s.lastAppliedPresetId ?? "null"}, panel h ${panel ? Math.round(panel.getBoundingClientRect().height) : "?"}`
}, tag)
const boot = async (pg) => {
  await pg.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
  await hideDock(pg)
  await pg.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
  await pg.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
  await pg.waitForTimeout(1500)
  await pg.evaluate((id) => window.__styleHarness.selectPreset("dither", id), p0.id)
}
const presetChip = (pg) => pg.locator("button[aria-expanded]", { hasText: /^Preset/ }).first()
// REFERENCE ARM: the no-active-preset, panel-open size, measured on a page of
// its own. Reached by clearing activePresetId, not by a delete, so it does not
// share the path it grades. Validated before use, never assumed.
const reference = async () => {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })
  try {
    const rp = await ctx.newPage()
    await boot(rp)
    await rp.evaluate(() => window.__styleHarness.setStyle({ activePresetId: null }))
    await presetChip(rp).click(); await settle(600, rp)
    const s = await held(rp)
    const st = await rp.evaluate(() => { const s = window.__styleHarness.get().styleState; return { active: s.activePresetId ?? null, family: s.activePresetFamily, customize: !!document.querySelector("[data-preset-customize]") } })
    const expanded = await presetChip(rp).getAttribute("aria-expanded")
    console.log(await look("reference, no active preset, panel open", rp), "|", s)
    const why = [st.active !== null && `active ${st.active}`, st.family !== "dither" && `family ${st.family}`, st.customize && "Customize shown", expanded !== "true" && `chip aria-expanded ${expanded}`, !/^\d+x\d+$/.test(s) && `size ${s}`].filter(Boolean)
    return { size: s, ok: why.length === 0, why: why.length ? why.join(", ") : `active null, family dither, Customize gone, panel open, held ${s}` }
  } finally { await ctx.close() }
}
try {
  const ref = await reference()
  await boot(page)
  const chip = presetChip(page)
  await chip.click()
  await page.waitForSelector("[data-preset-customize]", { timeout: 20000 })
  const range = '[data-preset-customize] [data-field-keys="ditherScale"] input[type=range]'
  await page.focus(range); await page.keyboard.press("End")
  await page.click("[data-save-mine]"); await page.fill("[data-name-input]", "Grain mine"); await page.click("[data-name-save]")
  await page.waitForSelector('[data-mine-group] [data-preset-id^="mine:"]', { timeout: 10000 })
  const mineId = await page.getAttribute('[data-mine-group] [data-preset-id^="mine:"]', "data-preset-id")
  const g1 = await grab(); console.log(await look("before delete"), "|", `${g1}`)
  if (MUTATE === "reach") await page.evaluate(() => {
    const c = document.querySelector("[data-preset-customize]")
    window.__probeReach = { h: c.getBoundingClientRect().height, up: [] }
    for (let e = c.parentElement; e && e !== document.body; e = e.parentElement) window.__probeReach.up.push(e)
  })
  await page.click("[data-delete]")
  const trail = []; for (let i = 0; i < 8; i++) { trail.push(await size()); await page.waitForTimeout(60) }
  console.log("canvas size every 60 ms after the click (printed, not graded):", trail.join(" "))
  if (MUTATE === "reach") console.log("reach mutant:", await page.evaluate(() => {
    const r = window.__probeReach, host = r.up.find((e) => e.isConnected)
    if (!host) return "no ancestor of Customize is still on the page"
    const d = document.createElement("div"); d.id = "probe-reach"; d.style.cssText = `height:${r.h}px;flex:none`; host.prepend(d)
    return `put a ${Math.round(r.h)} px block in <${host.tagName.toLowerCase()} class="${String(host.className).slice(0, 60)}">`
  }))
  const kept = await page.locator(`[data-preset-id="${mineId}"]`).count()
  const g2 = await grab(); console.log(await look("after delete"), "|", `${g2}`, `| size after the grab ${g2.after}`)
  if (MUTATE === "reach") await page.evaluate(() => document.getElementById("probe-reach")?.remove())
  await chip.click(); await settle(300)
  const g3 = await grab(); console.log(await look("after delete, panel shut"), "|", `${g3}`)
  if (MUTATE === "resize") await page.setViewportSize({ width: 1512, height: 900 })
  await page.evaluate(() => window.__styleHarness.undo()); await settle(300)
  if (MUTATE === "picture") await page.evaluate(() => window.__styleHarness.setStyle({ ditherScale: 3 }))
  const g4 = await grab(); console.log(await look("undo, panel shut"), "|", `${g4}`)
  row(mineId && kept === 0, "PRESET GONE", `${mineId ?? "no mine:* id was saved"} on the page ${kept} times after the delete`)
  const real = (x) => /^\d+x\d+$/.test(x)
  row(ref.ok, "REFERENCE ARM", ref.why)
  row(ref.ok && real(g2.size) && g2.after === g2.size && g2.size === ref.size, "SETTLED TO NO-PRESET SIZE, open", `after delete held ${g2.size}, after the grab ${g2.after}, reference ${ref.ok ? ref.size : "unusable"}; before delete ${g1.size}`)
  row(real(g3.size) && g3.size === g4.size, "DID NOT RESIZE, shut", `after delete ${g3.size}, before delete (undo) ${g4.size}`)
  row(g3.hash === g4.hash, "PICTURE UNCHANGED", `panel shut: after delete ${g3.hash}, before delete (undo) ${g4.hash}; panel open, not graded: ${g1.hash} -> ${g2.hash}`)
} finally {
  await browser.close()
}
const failed = rows.filter((ok) => !ok).length
console.log(`${rows.length - failed} PASS  ${failed} FAIL`)
process.exitCode = failed || rows.length !== 5 ? 1 : 0
