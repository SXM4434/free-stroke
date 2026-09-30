// assert-motion-customize.mjs (MOTION-CUSTOM, 2026-09-26)
//
// Customize under every Geometry Animation preset, on the real page at 1512x982
// with real clicks. For EVERY enabled preset in the family that carries `motion`
// (never a sample), in one loop:
//   pick shows Customize listing exactly presetFields(p) (its 12 motion keys);
//   one Overlap step changes the played take: the page's own timed schedule
//     (__revealHarness.schedule()) and total duration, read before and after;
//   Reset on that field puts the take back; Reset all puts two edits back;
//   Save as mine stores the edited motion and reapplies it after switching away
//     and back; Rename changes only the label; Delete removes it.
// MUST-FAIL: the whole loop runs a second time with window.__FS_GATE_MUTATE set
// to "presetFields-applies-only", which puts back main's applies-only read. Every
// Customize row must go red there, or the gate cannot see the defect it polices.
//
// Run: FS_PORT=3139 FS_HEADED=0 node scripts/verify/assert-motion-customize.mjs
// Exit 0 only when every row passes and every must-fail row fires.
import { createJiti } from "jiti"
import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync } from "node:fs"
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../..", import.meta.url).pathname } })
const S = await jiti.import("../../lib/style-system.ts")
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
const OUT = new URL("../../docs/verification/motion-customize/", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const sha = (x) => createHash("sha256").update(x).digest("hex").slice(0, 12)
const J = JSON.stringify

const family = S.PRESET_REGISTRY.geometryAnimation
const corpus = family.filter((p) => p.enabled && p.motion)
const left = family.filter((p) => !corpus.includes(p)).map((p) => `${p.label} (enabled ${p.enabled}, motion ${!!p.motion})`)
console.log(`DENOMINATOR: ${corpus.length} presets of ${family.length} in Geometry Animation. Not in the loop: ${left.join(", ") || "none"}`)
if (!corpus.length) { console.log("NOTHING TO CHECK"); process.exit(2) }

const polys = JSON.parse((await import("node:fs")).readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const browser = await chromium.launch()
const results = { real: [], mutated: [] }

async function pass(mode) {
  const rows = results[mode]
  const row = (name, ok, detail = "") => { rows.push({ name, ok: !!ok, detail }); console.log(`${mode === "real" ? "" : "[must-fail] "}${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`) }
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })
  if (mode === "mutated") await ctx.addInitScript(() => { window.__FS_GATE_MUTATE = "presetFields-applies-only" })
  const page = await ctx.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  const settle = async (ms = 350) => { await page.waitForTimeout(ms); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
  const snap = async () => page.evaluate(() => { const r = window.__revealHarness; return { d: r.drawIn(), w: r.window(), s: JSON.stringify(r.schedule()), t: r.getTotalDuration() } })
  const take = (x) => sha(J([x.d, x.w, x.s, x.t]))
  const sched = (x) => sha(x.s + x.t)
  const cz = "[data-preset-customize]"
  const listed = () => page.evaluate((cz) => [...document.querySelectorAll(`${cz} [data-field-keys]`)].flatMap((n) => n.dataset.fieldKeys.split(" ")).sort(), cz)
  const editedN = () => page.locator(`${cz} [data-field-edited]`).count()
  const has = async (sel) => (await page.locator(sel).count()) > 0
  const pick = async (id) => { await page.locator(`button[data-preset-id="${id}"]`).first().click(); await settle(500) }
  const overlapStep = async () => {
    const box = page.locator(`${cz} [data-field-keys="drawIn.overlap"] input[type=range]`)
    if (!(await box.count())) return false
    const v = Number(await box.inputValue())
    await box.focus(); await page.keyboard.press(v >= 1 ? "ArrowLeft" : "ArrowRight"); await settle()
    return true
  }
  const style = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__styleHarness.get().styleState)))
  try {
    await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
    await page.waitForFunction(() => window.__styleHarness && window.__revealHarness, null, { timeout: 240000 })
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
    await page.waitForTimeout(1500)
    await page.evaluate(() => window.__revealHarness.setPlaying(false))
    await page.locator("button[aria-expanded]", { hasText: /^Preset/ }).first().click()
    await settle(600)
    await page.locator("select").filter({ has: page.locator('option[value="geometryAnimation"]') }).first().selectOption("geometryAnimation")
    await settle(500)
    for (const [i, p] of corpus.entries()) {
      const L = p.label
      const want = S.presetFields(p).sort()
      await pick(p.id)
      const shown = (await has(cz)) ? await listed() : []
      row(`${L}: picking it shows Customize listing exactly its ${want.length} motion fields`, J(shown) === J(want), `${shown.length} listed`)
      // The whole section in one image. The drawer's scroll box is unclamped for
      // this shot only and put back after: an element shot inside it caught the
      // drawer's 40 px bottom fade and read as rows cut off (MOTION-CUSTOM-2).
      if (mode === "real" && (i === 0 || p.id === "loopingStroke")) {
        const unclamp = (on) => page.$eval(cz, (n, on) => { for (let e = n.parentElement; e; e = e.parentElement) if (on ? /(auto|scroll)/.test(getComputedStyle(e).overflowY) : e.dataset.gateUnclamped) { if (on) { e.dataset.gateUnclamped = "1"; e.style.maxHeight = "none"; e.style.overflow = "visible"; e.style.maskImage = "none" } else { delete e.dataset.gateUnclamped; e.style.maxHeight = e.style.overflow = e.style.maskImage = "" } } }, on)
        await unclamp(true)
        await settle(300)
        await page.locator(cz).screenshot({ path: `${OUT}customize-${p.id}-1512x982.png` }).catch((e) => console.log(`screenshot failed: ${e.message.split("\n")[0]}`))
        await unclamp(false)
        await settle(300)
      }
      const before = await snap()
      const stepped = await overlapStep()
      const after = await snap()
      row(`${L}: one Overlap step changes the played take (schedule and duration)`, stepped && sched(after) !== sched(before) && after.d.overlap !== before.d.overlap,
        `overlap ${before.d.overlap} -> ${after.d.overlap}, duration ${Math.round(before.t)} -> ${Math.round(after.t)} ms, schedule ${sched(before)} -> ${sched(after)}`)
      const markOne = stepped ? await editedN() : 0
      if (stepped && (await has(`${cz} [data-field-keys="drawIn.overlap"] [data-field-reset]`))) { await page.locator(`${cz} [data-field-keys="drawIn.overlap"] [data-field-reset]`).click(); await settle() }
      const afterReset = await snap()
      row(`${L}: the edit marks one field, and its Reset puts the take back`, markOne === 1 && take(afterReset) === take(before) && (await editedN()) === 0, `marked ${markOne}, take ${take(before)} vs ${take(afterReset)}`)
      await overlapStep()
      const unit = before.d.unit === "group" ? "Strokes" : "Groups"
      if (await has(`${cz} [data-field-keys="drawIn.unit"]`)) { await page.locator(`${cz} [data-field-keys="drawIn.unit"] button`, { hasText: unit }).click(); await settle() }
      const markTwo = await editedN()
      if (await has(`${cz} [data-reset-all]`)) { await page.locator(`${cz} [data-reset-all]`).click(); await settle() }
      const afterAll = await snap()
      row(`${L}: two edits (Overlap, Unit), Reset all puts everything back`, markTwo === 2 && take(afterAll) === take(before) && (await editedN()) === 0, `marked ${markTwo}, take ${take(before)} vs ${take(afterAll)}`)
      // Save as mine
      await overlapStep()
      const edited = await snap()
      const name = `Mine ${i}`
      if (await has(`${cz} [data-save-mine]`)) { await page.locator(`${cz} [data-save-mine]`).click(); await page.locator(`${cz} [data-name-input]`).fill(name); await page.locator(`${cz} [data-name-save]`).click(); await settle(500) }
      const st1 = await style()
      const mine = (st1.customPresets ?? []).find((x) => x.label === name)
      row(`${L}: Save as mine stores the edited motion`, !!mine && mine.motion?.drawIn?.overlap === edited.d.overlap && st1.activePresetId === mine.id, mine ? `saved overlap ${mine.motion?.drawIn?.overlap}, live ${edited.d.overlap}` : "no preset saved")
      const other = corpus[(i + 1) % corpus.length]
      await pick(other.id)
      const away = await snap()
      if (mine) await pick(mine.id)
      const back = await snap()
      row(`${L}: the saved preset reapplies the edited take after switching away and back`, !!mine && take(away) !== take(edited) && take(back) === take(edited), `edited ${take(edited)}, away ${take(away)}, back ${take(back)}`)
      // Rename
      if (mine && (await has(`${cz} [data-rename]`))) { await page.locator(`${cz} [data-rename]`).click(); await page.locator(`${cz} [data-name-input]`).fill(`${name} renamed`); await page.locator(`${cz} [data-name-save]`).click(); await settle() }
      const st2 = await style()
      const renamed = (st2.customPresets ?? []).find((x) => x.id === mine?.id)
      const rest = (x) => J({ ...x, label: 0 })
      row(`${L}: Rename changes only the label`, !!renamed && renamed.label === `${name} renamed` && rest(renamed) === rest(mine), renamed ? `label "${renamed.label}"` : "not found")
      if (mine && (await has(`${cz} [data-delete]`))) { await page.locator(`${cz} [data-delete]`).click(); await settle() }
      const st3 = await style()
      row(`${L}: Delete removes it`, !!mine && !(st3.customPresets ?? []).some((x) => x.id === mine.id), `${(st3.customPresets ?? []).length} saved left`)
    }
    row("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "))
  } finally {
    await ctx.close()
  }
}

let code = 0
try {
  await pass("real")
  await pass("mutated")
} catch (e) { console.log(`CRASH: ${e.stack}`); code = 3 } finally { await browser.close() }
const real = results.real, mut = results.mutated.filter((r) => r.name !== "no page errors")
const realOk = real.filter((r) => r.ok).length
const fired = mut.filter((r) => !r.ok).length
const customizeRows = mut.filter((r) => !/Delete removes it/.test(r.name))
const allFired = customizeRows.every((r) => !r.ok)
console.log(`\nREAL: ${realOk} of ${real.length} pass. MUST-FAIL (applies-only presetFields): ${fired} of ${mut.length} rows red; every Customize row red: ${allFired}. Corpus ${corpus.length} of ${family.length}.`)
if (!code && (realOk !== real.length || !allFired || !real.length)) code = 1
writeFileSync(OUT + "gate-summary.json", J({ corpus: corpus.map((p) => p.id), family: family.length, real, mutated: results.mutated }, null, 2))
process.exit(code)
