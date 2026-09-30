#!/usr/bin/env node
// ANIM-4 gate. Model rows run lib/style-system.ts and lib/doc-store.ts
// through jiti; the browser rows below drive the page on
// FS_PORT. --model-only skips them. --phase=base records the untouched page on a
// main server for the byte-identity rows: `--phase=base --base=ea31c5b38` (the
// main ANIM-4 branched from, no take dock) and `--phase=base --base=5519dba0f`
// (main with the take dock and the Camera picker, so undocked like this tree).
// Each writes docs/verification/presets/base-<sha>.json.
// BASE PROVENANCE (HARDEN-B3). The server's commit comes from
// lib/server-commit.mjs serverCommit(FS_PORT), never from the --base label.
// Record mode exits 2 unless that server is clean under app, components, lib,
// hooks, styles AND its HEAD is the commit the label resolves to; the file then
// stores { sha, recordedFrom, at }. Compare mode exits 2 on a base file with no
// sha. A row against a base whose sha equals the server's HEAD, or has no code
// difference from it (codeDiffers), reads SELF: it compared the tree to itself,
// so it is not counted as passed, is named in the summary, and does not by
// itself fail the run.
// Corpus: every preset in PRESET_REGISTRY whose family is a style family and
// whose definition carries `applies`. Geometry, View and Geometry Animation are
// outside it (their patches are not style fields) and are counted as such.
import { createJiti } from "jiti"
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../..", import.meta.url).pathname } })
const S = await jiti.import("../../lib/style-system.ts")
const D = await jiti.import("../../lib/doc-store.ts")

let pass = 0, fail = 0
const selfRows = []
const row = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  " + detail : ""}`) }
// SELF: the base is this tree's own code, so the row cannot fail on a product
// change and proves nothing. Never PASS, never counted in pass or fail.
const selfRow = (name, detail = "") => { selfRows.push(name); console.log(`SELF  ${name}${detail ? "  " + detail : ""}`) }
const refuse = (msg) => { console.log(`REFUSED  ${msg}`); process.exit(2) }
const J = (x) => JSON.stringify(x)
const base = S.DEFAULT_STYLE_STATE

const all = Object.entries(S.PRESET_REGISTRY).flatMap(([f, ps]) => ps.map((p) => ({ f, p })))
const inCorpus = all.filter(({ f, p }) => !S.NON_STYLE_FAMILIES.has(f) && p.applies)
const outside = all.length - inCorpus.length
console.log(`corpus: ${inCorpus.length} of ${all.length} presets; ${outside} outside (no style fields)`)
row("positive control: corpus is not empty and reaches every style family",
  inCorpus.length > 0 && new Set(inCorpus.map((x) => x.f)).size === Object.keys(S.PRESET_REGISTRY).length - S.NON_STYLE_FAMILIES.size)

// 1. fields = the preset's own definition
let r1 = 0
for (const { p } of inCorpus) if (J(S.presetFields(p).sort()) === J(Object.keys(p.applies).sort())) r1++
row("fields shown = keys the preset's definition sets", r1 === inCorpus.length, `${r1}/${inCorpus.length}`)
const mf1 = inCorpus.find(({ p }) => Object.keys(p.applies).length > 1)
row("  must-fail: a list one field short is caught", J(S.presetFields(mf1.p).slice(1)) !== J(Object.keys(mf1.p.applies)))

// 2/3. edit marks edited; reset is byte-identical
let r2 = 0, r3 = 0, n = 0
for (const { f, p } of inCorpus) {
  const applied = S.applyPresetToStyleState(base, f, p.id)
  const k = S.presetFields(p).find((key) => typeof applied[key] === "number" || typeof applied[key] === "boolean")
  if (!k) continue
  n++
  const edited = { ...applied, [k]: typeof applied[k] === "number" ? applied[k] + 0.137 : !applied[k] }
  if (S.presetEditedFields(applied, p).length === 0 && J(S.presetEditedFields(edited, p)) === J([k])) r2++
  if (J(S.applyPresetToStyleState(edited, f, p.id)) === J(applied)) r3++
}
row("edit one field marks exactly that field edited; untouched marks none", r2 === n, `${r2}/${n}`)
row("reset re-applies byte-identical", r3 === n, `${r3}/${n}`)
row("  must-fail: an edited state is not byte-identical to the applied one",
  (() => { const { f, p } = inCorpus[0]; const a = S.applyPresetToStyleState(base, f, p.id); const k = S.presetFields(p)[0]; return J({ ...a, [k]: "x" }) !== J(a) })())

// 4. save as mine re-applies to the same state
let r4 = 0, n4 = 0
for (const { f, p } of inCorpus) {
  const applied = S.applyPresetToStyleState(base, f, p.id)
  const k = S.presetFields(p).find((key) => typeof applied[key] === "number")
  if (!k) continue
  n4++
  const edited = { ...applied, [k]: applied[k] + 0.137 }
  const saved = S.saveMinePreset(edited, p, "Mine", `t${n4}`)
  const mine = saved.customPresets.at(-1)
  const again = S.applyPresetToStyleState({ ...saved, [k]: applied[k] }, f, mine.id)
  const strip = (s) => J({ ...s, activePresetId: 0, lastAppliedPresetId: 0, customPresets: 0 })
  if (strip(again) === strip(edited) && mine.id.startsWith(S.MINE_PREFIX)) r4++
}
row("save as mine re-applies to the edited state", r4 === n4, `${r4}/${n4}`)
row("  must-fail: a save that stores the preset id instead of the fields does not re-apply the edit",
  (() => { const { f, p } = inCorpus.find(({ p }) => Object.values(p.applies).some((v) => typeof v === "number")); const a = S.applyPresetToStyleState(base, f, p.id); const k = S.presetFields(p).find((x) => typeof a[x] === "number"); const e = { ...a, [k]: a[k] + 0.137 }; return J(S.applyPresetToStyleState(e, f, p.id)[k]) !== J(e[k]) })())

// 5. rename and delete; the library survives other presets' rail resets
const { f: f0, p: p0 } = inCorpus.find(({ f }) => f === "dither") ?? inCorpus[0]
let st = S.saveMinePreset(S.applyPresetToStyleState(base, f0, p0.id), p0, "Grain one", "a")
const id = st.customPresets[0].id
st = S.renameMinePreset(st, id, "Grain two")
row("rename changes the label only", st.customPresets[0].label === "Grain two" && st.customPresets.length === 1)
row("  must-fail: an empty name is refused", S.renameMinePreset(st, id, "  ").customPresets[0].label === "Grain two")
const other = inCorpus.find(({ f }) => f !== f0 && f !== "material" && f !== "animatedMaterial")
row("applying another preset keeps the library", S.applyPresetToStyleState(st, other.f, other.p.id).customPresets.length === 1)
const del = S.deleteMinePreset(st, id)
row("delete removes it and stops naming it", del.customPresets.length === 0 && del.activePresetId === null)

// 6. doc round trip, through the load path doc-store actually exports: validateSession.
// The session goes through JSON the way localStorage stores it.
const sess = { ...D.defaultSession(), styleState: st }
const loaded = D.validateSession(JSON.parse(JSON.stringify(sess)))
row("doc round trip keeps the saved preset (validateSession)", !!loaded && J(loaded.session.styleState.customPresets) === J(st.customPresets), loaded ? `${loaded.session.styleState.customPresets.length} preset(s), ${loaded.repairs.length} repair(s)` : "validateSession returned null")
const lost = D.validateSession(JSON.parse(JSON.stringify({ ...sess, styleState: { ...st, customPresets: undefined } })))
row("  must-fail: a session saved without the list does not pass the round trip", !lost || J(lost.session.styleState.customPresets) !== J(st.customPresets))
const v = D.validateCustomPresets([{ ...st.customPresets[0], applies: { ...st.customPresets[0].applies, notAField: 1 } }, { id: "x", label: "bad" }])
row("validator drops a bad preset and a foreign field, and names both", v.presets.length === 1 && !("notAField" in v.presets[0].applies) && v.repairs.length === 2)

// 7. BROWSER ROWS. Pixels are __captureHarness.grab() hashed; the page shot is
// a 1512x982 screenshot hashed. Corpus: one dither preset, driven through the
// Presets tab's own controls. Every other family is outside these rows.
if (!process.argv.includes("--model-only")) {
  const { chromium } = await import("./lib/browser.mjs")
  const { LAB_URL } = await import("./lib/dev-server.mjs")
  const { createHash } = await import("node:crypto")
  const { readFileSync, writeFileSync, mkdirSync, existsSync } = await import("node:fs")
  const OUT = new URL("../../docs/verification/presets/", import.meta.url).pathname
  const phaseBase = process.argv.includes("--phase=base")
  // THE TWO MAINS. ea31c5b38 has no take dock; b2d3f2575 docks it, so its page
  // is undocked like this tree's. The screenshot row reads the rebased-on main
  // only: between the two, main itself added the Keyframes row to the take
  // panel and folded its note (ANIM-4E looked at the diff: every changed pixel
  // sits in the take panel, x 769-1499, y 618-917), so a shot against
  // ea31c5b38 measures main's work, not this lane's.
  // 347e22e6b replaced b2d3f2575 (HARDEN-B3): main gained the Camera picker at
  // c6c1024e1, so the b2d3f2575 shot no longer matched any main.
  // 5519dba0f replaced 347e22e6b (2026-09-26, the controller): PANEL made the dock show before the first
  // stroke, on purpose, so the untouched page's take panel changed and no older main matches it.
  const BASES = { ea31c5b38: { undock: false }, "5519dba0f": { undock: true } }
  const baseArg = (process.argv.find((a) => a.startsWith("--base=")) ?? "--base=ea31c5b38").slice(7)
  if (phaseBase && !BASES[baseArg]) refuse(`--base=${baseArg}: not one of ${Object.keys(BASES).join(", ")}`)
  const baseFile = (sha) => OUT + `base-${sha}.json`
  const readBase = (sha) => (existsSync(baseFile(sha)) ? JSON.parse(readFileSync(baseFile(sha), "utf8")) : null)
  const { serverCommit, codeDiffers } = await import("./lib/server-commit.mjs")
  const PORT = Number(new URL(LAB_URL).port || 80)
  const { execFileSync } = await import("node:child_process")
  // Compare mode: a base file without a stored sha is refused before any
  // server is read, so an unlabelled base can never grade a row.
  const baseInfo = {}
  if (!phaseBase) for (const label of Object.keys(BASES)) {
    const b = readBase(label)
    if (b && !(typeof b.sha === "string" && /^[0-9a-f]{40}$/.test(b.sha))) refuse(`${baseFile(label)} has no stored sha (got ${J(b.sha)}); record it again with --phase=base --base=${label}`)
    baseInfo[label] = b
  }
  let srv
  try { srv = serverCommit(PORT) } catch (e) { refuse(e.message) }
  console.log(`server :${PORT} pid ${srv.pid} cwd ${srv.cwd} head ${srv.head}${srv.dirty ? " DIRTY" : " clean"}`)
  let labelSha = null
  if (phaseBase) {
    try { labelSha = execFileSync("git", ["-C", srv.top, "rev-parse", "--verify", "--quiet", `${baseArg}^{commit}`], { encoding: "utf8" }).trim() } catch { refuse(`--base=${baseArg} does not name a commit in the server's repo ${srv.top}`) }
    if (srv.dirty) refuse(`the server on :${PORT} (${srv.cwd}) has uncommitted changes under app, components, lib, hooks or styles; a base is recorded from a clean tree only`)
    if (srv.head !== labelSha) refuse(`--base=${baseArg} is ${labelSha}, but the server on :${PORT} (${srv.cwd}) runs ${srv.head}`)
  }
  // SELF per base: true when the base's code is the served code.
  const isSelf = {}
  for (const [label, b] of Object.entries(baseInfo)) {
    if (!b) continue
    try { isSelf[label] = b.sha === srv.head || !codeDiffers(srv, b.sha) } catch (e) { refuse(e.message) }
  }
  const graded = (label, name, ok, detail) => (isSelf[label] ? selfRow(name, `${detail}; base ${label} has the served code (${srv.head.slice(0, 9)}), so this compares the tree to itself`) : row(name, ok, detail))
  const { undock } = await import("./lib/undock.mjs")
  mkdirSync(OUT, { recursive: true })
  const sha = (x) => createHash("sha256").update(x).digest("hex").slice(0, 16)
  const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })).newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  const settle = async (ms = 400) => { await page.waitForTimeout(ms); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
  // BEFORE EVERY GRAB (ANIM-4D): motion off and every animation flag false, and
  // the reveal clock pinned, since an undo or a preset click can restart the
  // draw-in and these rows measure style, not the clock. The STILL write is a
  // setStyle through the harness. When every flag is already off it holds
  // identical values, so page.tsx applies it without recording an undo step
  // ("A new object holding identical values"). It also makes Viewport3D render
  // once more, and that is load-bearing: ANIM-4D measured that after the GL
  // canvas resizes (opening the Presets panel takes it from 755x890 to
  // 755x449) the scene is drawn about a sub-pixel off from where it sits after
  // the next Viewport3D render, any render, for as long as nothing re-renders
  // (4.5 s sampled, one hash). setProgress, setPlaying and waiting do not
  // settle it; setStyle({}) and setLoop do. ANIM-4B's "again moved" was that:
  // `applied` was the first frame after the resize and every later grab
  // followed an edit. A flag that was NOT already off is written anyway and
  // counted in `forced`, which fails its own row, since that write is a real
  // undo step and would shift every undo row after it.
  const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }
  let grabs = 0, forced = 0
  // The canvas must have stopped resizing BEFORE the STILL write, or the write
  // lands ahead of the resize and the grab reads the stale frame anyway
  // (measured: the resize lands ~160 ms after the panel click).
  const canvasSize = () => page.evaluate(() => { const i = window.__captureHarness.grabInfo(); return i ? `${i.width}x${i.height}` : "none" })
  const sizeSettled = async () => { let a = await canvasSize(); for (let i = 0; i < 12; i++) { await settle(250); const b = await canvasSize(); if (a === b) return b; a = b } throw new Error(`GL canvas never stopped resizing: ${a}`) }
  const rawGrab = async () => {
    await sizeSettled()
    const wasOff = await page.evaluate((st) => { const s = window.__styleHarness.get().styleState; const off = Object.entries(st).every(([k, v]) => s[k] === v); window.__styleHarness.setStyle(st); window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1); return off }, STILL)
    grabs++; if (!wasOff) forced++
    await settle(600)
    const size = await canvasSize()
    const png = await page.evaluate(() => window.__captureHarness.grab())
    if (size !== await canvasSize()) throw new Error("GL canvas resized during a grab")
    return png
  }
  const grab = async () => sha(await rawGrab())
  const H = (fn, ...a) => page.evaluate(([fn, a]) => window.__styleHarness[fn](...a), [fn, a])
  const count = (sel) => page.locator(sel).count()
  try {
    await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
    // This tree docks the take panel under the canvas (755x533 at 1512x982);
    // ea31c5b38 floats it over a 755x890 canvas. Float it here the way the
    // other gates do, before any stroke lands, so the untouched rows compare
    // one canvas size. The base run is on main, which has no dock and must not
    // call it (undock throws there).
    if (!phaseBase || BASES[baseArg].undock) await undock(page)
    await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
    await page.waitForTimeout(1500)
    await page.evaluate(() => { window.__revealHarness.setPlaying(false); window.__revealHarness.setProgress(1) })
    const untouched = await grab()
    const untouchedSize = await canvasSize()
    const shotPng = await page.screenshot()
    const shotA = sha(shotPng), shotB = sha(await page.screenshot())
    // Evidence: the untouched page shot, so a hash mismatch can be looked at.
    writeFileSync(OUT + (phaseBase ? `untouched-base-${baseArg}.png` : "untouched-this-tree.png"), shotPng)
    if (phaseBase) {
      // The server must still be the one checked before the run: same pid,
      // same HEAD, still clean. Otherwise nothing is written.
      let after
      try { after = serverCommit(PORT) } catch (e) { await browser.close(); refuse(`after the run: ${e.message}`) }
      if (after.pid !== srv.pid || after.head !== srv.head || after.dirty) await browser.close(), refuse(`the server changed during the run: pid ${srv.pid} -> ${after.pid}, head ${srv.head} -> ${after.head}, dirty ${after.dirty}; nothing written`)
      writeFileSync(baseFile(baseArg), JSON.stringify({ base: baseArg, sha: srv.head, recordedFrom: srv.cwd, at: new Date().toISOString(), undocked: BASES[baseArg].undock, url: LAB_URL, untouched, untouchedSize, shot: shotA, shotStable: shotA === shotB }, null, 2))
      console.log(`base recorded: ${baseFile(baseArg)} sha ${srv.head} from ${srv.cwd}`)
    } else {
      const old = baseInfo["ea31c5b38"], now = baseInfo["5519dba0f"]
      const none = (sha) => `no base file: run --phase=base --base=${sha} on a ${sha} server first`
      graded("ea31c5b38", "untouched page: canvas byte-identical to main ea31c5b38", !!old && old.untouched === untouched, old ? `${untouched} vs ${old.untouched}` : none("ea31c5b38"))
      graded("5519dba0f", "untouched page: canvas byte-identical to main 5519dba0f", !!now && now.untouched === untouched, now ? `${untouched} vs ${now.untouched}` : none("5519dba0f"))
      graded("5519dba0f", "untouched page: screenshot byte-identical to main 5519dba0f", !!now && now.shotStable && shotA === shotB && now.shot === shotA, now ? `${shotA} vs ${now.shot}, stable here ${shotA === shotB}, on main ${now.shotStable}` : none("5519dba0f"))
      graded("ea31c5b38", "  must-fail: the shot sees main's own take-panel change (differs from ea31c5b38)", !!old && old.shot !== shotA, old ? `${shotA} vs ${old.shot}` : none("ea31c5b38"))

      const dither = S.PRESET_REGISTRY.dither.filter((p) => p.applies && "ditherScale" in p.applies && p.enabled)
      const [p0, p1] = dither
      await H("selectPreset", "dither", p0.id)
      await page.locator("button[aria-expanded]", { hasText: /^Preset/ }).first().click()
      await page.waitForSelector("[data-preset-customize]", { timeout: 20000 })
      // The first frame after the panel opened, before any re-render, for the
      // record: it is the stale frame named above, not a style result.
      const firstFrame = sha(await page.evaluate(() => window.__captureHarness.grab()))
      const applied = await grab()
      const appliedAgain = await grab()
      row("two grabs at one state, nothing edited, are byte-equal (motion off, every animation flag off)", applied === appliedAgain,
        `${applied} ${appliedAgain}; first frame after the panel opened ${firstFrame === applied ? "same" : "differs: " + firstFrame}`)
      const stNow = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__styleHarness.get())))
      const appliedSt = await stNow()
      const why = async () => { const n = await stNow(); const d = []; for (const g of Object.keys(n)) { if (g === "styleState") { for (const k of Object.keys(n.styleState)) if (J(n.styleState[k]) !== J(appliedSt.styleState[k])) d.push(k) } else if (J(n[g]) !== J(appliedSt[g])) d.push(g) } return `differs: ${d.join(",") || "no state"}; again ${await grab() === applied ? "same" : "moved"}` }
      row("positive control: the preset changes the picture", applied !== untouched)
      const scoped = await page.$$eval("[data-preset-customize] [data-field-keys]", (ns) => ns.map((n) => n.dataset.fieldKeys))
      const ro = await page.$$eval("[data-read-only-field]", (ns) => ns.map((n) => n.dataset.readOnlyField))
      const shown = [...scoped.join(" ").split(" "), ...ro].sort()
      row("Customize lists exactly presetFields", J(shown) === J(S.presetFields(p0).sort()), `${scoped.length} controls, ${ro.length} read-only: ${ro.join(",") || "none"}`)
      row("  must-fail: nothing edited shows no dot", (await count("[data-edited-dot]")) === 0)

      const range = '[data-preset-customize] [data-field-keys="ditherScale"] input[type=range]'
      const setRange = (v) => page.evaluate(([sel, v]) => {
        const el = document.querySelector(sel)
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v))
        el.dispatchEvent(new Event("input", { bubbles: true }))
        el.dispatchEvent(new Event("change", { bubbles: true }))
      }, [range, v])
      const [cur, lo, hi] = await page.$eval(range, (el) => [+el.value, +el.min, +el.max])
      await setRange(cur)
      row("  must-fail: a no-op edit moves no pixel and shows no dot", (await grab()) === applied && (await count("[data-edited-dot]")) === 0)
      const steps0 = (await H("undoLabels")).past.length
      const target = Math.abs(hi - cur) > Math.abs(cur - lo) ? hi : lo
      // A real key press on the focused slider (End or Home), the way he can edit it.
      // ANIM-4B's "again moved" after this edit was the stale frame named at
      // `grab`, not the edit.
      const clickEnd = async () => {
        await page.focus(range)
        await page.keyboard.press(target === hi ? "End" : "Home")
      }
      await clickEnd()
      const edited = await grab()
      const steps1 = (await H("undoLabels")).past.length
      row("editing one field in Customize changes the pixels", edited !== applied, `ditherScale ${cur} -> ${target}`)
      row("the edited field shows its dot", (await count('[data-field-keys="ditherScale"] [data-edited-dot]')) === 1 && (await count("[data-edited-dot]")) === 1)
      row("the edit is one undo step", steps1 - steps0 === 1, `${steps0} -> ${steps1}`)
      await H("undo")
      row("one undo restores the pixels byte-identical", (await grab()) === applied && (await count("[data-edited-dot]")) === 0, await why())
      row("  must-fail: before the undo the pixels differed", edited !== applied)
      await clickEnd()
      await page.click("[data-field-reset]")
      row("field reset restores byte-identical pixels", (await grab()) === applied && (await count("[data-edited-dot]")) === 0, await why())
      const afterReset = await grab()
      row("two grabs after one edit and a field Reset are byte-equal", afterReset === (await grab()), afterReset)
      await clickEnd()
      await page.click("[data-reset-all]")
      row("Reset all restores byte-identical pixels", (await grab()) === applied)
      row("  must-fail: Reset all is off with nothing edited", await page.$eval("[data-reset-all]", (b) => b.disabled))

      await clickEnd()
      const mineShot = await grab()
      await page.click("[data-save-mine]")
      await page.fill("[data-name-input]", "Grain mine")
      await page.click("[data-name-save]")
      await page.waitForSelector('[data-mine-group] [data-preset-id^="mine:"]', { timeout: 10000 })
      const mineId = await page.$eval('[data-mine-group] [data-preset-id^="mine:"]', (b) => b.dataset.presetId)
      row("Save as mine puts it in the Mine group at the top", (await page.$eval("[data-mine-group] [data-preset-id]", (b) => b.textContent)) === "Grain mine"
        && (await page.evaluate(() => { const g = document.querySelector("[data-mine-group]"), b = document.querySelector('[data-preset-id]:not([data-mine-group] *)'); return !!(g.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) })))
      await page.click(`[data-preset-id="${p1.id}"]`)
      const otherShot = await grab()
      row("  must-fail: another preset changes the pixels", otherShot !== mineShot, p1.id)
      await page.click(`[data-preset-id="${mineId}"]`)
      row("re-applying Mine gives the saved pixels", (await grab()) === mineShot)

      await page.click("[data-rename]")
      await page.fill("[data-name-input]", "Grain two")
      await page.click("[data-name-save]")
      const label = () => page.$eval(`[data-preset-id="${mineId}"]`, (b) => b.textContent)
      row("rename works on the page", (await label()) === "Grain two")
      await H("undo")
      row("rename is one undo step", (await label()) === "Grain mine")
      // DELETE RESIZES THE CANVAS, SO BOTH GRABS ARE TAKEN WITH THE PANEL SHUT
      // (ANIM-4E, `_probe-customize-delete.mjs`). Deleting the active Mine
      // preset leaves no active preset, so Customize unmounts, the panel loses
      // about 178 px and the GL canvas grows from 755x449 to 755x627 within
      // 60 ms. A grab before and after then compares two canvas sizes, which no
      // settle can make equal, and that was ANIM-4D's failing row. It is not
      // the F122 stale frame: each grab already settles (size held, a no-op
      // STILL setStyle, 600 ms). With the Presets panel shut the canvas is
      // 755x890 on both sides, so the row compares one size, and the STILL
      // write still forces the settle after each resize.
      const presetsChip = page.locator("button[aria-expanded]", { hasText: /^Preset/ }).first()
      const panelShut = async () => { if ((await presetsChip.getAttribute("aria-expanded")) === "true") await presetsChip.click(); await page.waitForSelector("[data-preset-customize]", { state: "detached", timeout: 10000 }) }
      await panelShut()
      const beforeDelete = await grab() // the size is read after the grab, once it holds
      const sizeBefore = await canvasSize()
      await presetsChip.click()
      await page.waitForSelector("[data-delete]", { timeout: 10000 })
      await page.click("[data-delete]")
      const deletedGone = (await count("[data-mine-group]")) === 0
      await panelShut()
      const afterDelete = await grab()
      const sizeAfter = await canvasSize()
      row("delete works on the page and keeps the picture (both grabs with the panel shut, one canvas size)", deletedGone && sizeBefore === sizeAfter && afterDelete === beforeDelete, `${sizeBefore} ${beforeDelete} vs ${sizeAfter} ${afterDelete}`)
      row("  must-fail: at that canvas size a different style gives different pixels (Mine vs the untouched page)", sizeBefore === untouchedSize && beforeDelete !== untouched, `${untouchedSize} ${untouched}`)
      await presetsChip.click()
      await H("undo")
      row("delete is one undo step", (await count(`[data-preset-id="${mineId}"]`)) === 1)

      // F124. A field's "• Reset" sits beside the label of the field it resets,
      // in both columns, at 1512x982 and 1280x800. Runs last: it edits several
      // fields and resizes the window, and no row after it grabs pixels.
      // The mark is the dot's parent (dot + Reset button), found the same way on
      // the old code and the new. The label is the first span in the field with
      // its own text, outside the mark and outside any button, select or option.
      // Per mark: inside its field's box (0.5 px slack), on a line of the label
      // (its vertical centre inside one of the label's text line boxes), and its
      // left edge 0 to 16 px right of that line's text. Corpus: the Dither
      // section of p0's Customize; one slider field per column is edited, more if
      // a column has none after the resize. Every other family is outside it.
      await H("selectPreset", "dither", p0.id)
      if ((await presetsChip.getAttribute("aria-expanded")) !== "true") await presetsChip.click()
      await page.waitForSelector("[data-preset-customize]", { timeout: 10000 })
      const SECTION = '[data-preset-customize] [data-customize-system="Dither"]'
      const colOf = () => page.$$eval(`${SECTION} [data-field-keys]`, (fs) => {
        const box = fs[0]?.closest("[data-customize-system]")?.querySelector(":scope > div")?.getBoundingClientRect()
        return fs.map((f) => ({ key: f.dataset.fieldKeys, col: f.getBoundingClientRect().left > box.left + box.width / 2 ? 1 : 0, slider: !!f.querySelector(":scope input[type=range]"), edited: f.hasAttribute("data-field-edited") }))
      })
      const editEachColumn = async () => {
        const fs = await colOf()
        for (const c of [...new Set(fs.map((f) => f.col))]) {
          if (fs.some((f) => f.col === c && f.edited)) continue
          const f = fs.find((x) => x.col === c && x.slider && !x.key.includes(" "))
          if (!f) continue
          const sel = `${SECTION} [data-field-keys="${f.key}"] input[type=range]`
          const atMax = await page.$eval(sel, (el) => +el.value === +el.max)
          await page.focus(sel)
          await page.keyboard.press(atMax ? "Home" : "End")
        }
        await page.mouse.move(2, 2)
        await settle(300)
        return [...new Set(fs.map((f) => f.col))].length
      }
      const measureResets = () => page.$$eval(`${SECTION} [data-edited-dot]`, (dots) => dots.map((dot) => {
        const mark = dot.parentElement, field = dot.closest("[data-field-keys]")
        const colBox = field.closest("[data-customize-system]").querySelector(":scope > div").getBoundingClientRect()
        const fb = field.getBoundingClientRect(), mb = mark.getBoundingClientRect(), bb = mark.querySelector("[data-field-reset]").getBoundingClientRect()
        const inside = (r) => r.left >= fb.left - 0.5 && r.right <= fb.right + 0.5 && r.top >= fb.top - 0.5 && r.bottom <= fb.bottom + 0.5
        const ownText = (s) => { const w = document.createTreeWalker(s, NodeFilter.SHOW_TEXT); const out = []; for (let t; (t = w.nextNode());) if (!mark.contains(t) && t.textContent.trim()) out.push(t); return out }
        const label = [...field.querySelectorAll("span")].find((s) => !mark.contains(s) && !s.closest("button, select, option") && ownText(s).length)
        const lines = label ? ownText(label).flatMap((t) => { const r = document.createRange(); r.selectNodeContents(t); return [...r.getClientRects()].filter((q) => q.width > 0) }) : []
        const cy = (mb.top + mb.bottom) / 2
        const sameLine = lines.filter((q) => cy >= q.top && cy <= q.bottom)
        const textRight = sameLine.length ? Math.max(...sameLine.map((q) => q.right)) : null
        const gap = textRight === null ? null : mb.left - textRight
        return {
          key: field.dataset.fieldKeys, col: fb.left > colBox.left + colBox.width / 2 ? 1 : 0,
          label: label ? ownText(label).map((t) => t.textContent).join("").replace(/\s+/g, " ").trim() : null,
          gap: gap === null ? null : Math.round(gap * 10) / 10, inside: inside(mb) && inside(bb),
          mark: `${Math.round(mb.left)},${Math.round(mb.top)} ${Math.round(mb.width)}x${Math.round(mb.height)}`, field: `${Math.round(fb.left)},${Math.round(fb.top)} ${Math.round(fb.width)}x${Math.round(fb.height)}`,
        }
      }))
      const besideOk = (m) => m.inside && m.gap !== null && m.gap >= 0 && m.gap < 16
      const say = (ms) => ms.map((m) => `${m.key} col ${m.col} gap ${m.gap ?? "not on a label line"} ${m.inside ? "inside" : "OUTSIDE"} (label "${m.label}", mark ${m.mark}, field ${m.field})`).join("; ")
      // HARDEN-B2, 2026-09-26: at least one mark in EACH of the two columns, then every mark beside
      // its label. The old test, `ms.length >= cols && new Set(cols).size === cols && ms.every(...)`,
      // passed with no fields found at all: 0 >= 0, a set of size 0, and [].every is true.
      const resetOk = (ms) => [0, 1].every((c) => ms.some((m) => m.col === c)) && ms.every(besideOk)
      // Must-fail on the real page: p0 just selected, nothing edited, so there are no marks. The
      // fields must be there in both columns, or the arm is reading an empty section, not the page.
      {
        const fs0 = await colOf()
        const ms0 = await measureResets()
        const cols0 = new Set(fs0.map((f) => f.col)).size
        row(`  must-fail F124: before any edit, with no marks, the Reset row fails`,
          fs0.length > 0 && cols0 === 2 && !resetOk(ms0),
          `${fs0.length} field(s) over ${cols0} column(s), ${ms0.length} mark(s); the Reset test reads ${resetOk(ms0)}${ms0.length ? `: ${say(ms0)}` : ""}`)
      }
      const resetSizes = [[1512, 982], [1280, 800]]
      const measured = {}
      for (const [w, h] of resetSizes) {
        await page.setViewportSize({ width: w, height: h })
        await settle(600)
        const cols = await editEachColumn()
        const ms = await measureResets()
        measured[`${w}x${h}`] = ms
        await page.$eval(SECTION, (n) => n.scrollIntoView({ block: "start" }))
        await settle(300)
        writeFileSync(OUT + `customize-dither-reset-${w}x${h}.png`, await page.screenshot())
        row(`F124 ${w}x${h}: each field's Reset sits inside its field and beside its label, under 16 px from it, in every column`,
          resetOk(ms),
          `${ms.length} Reset(s) over ${cols} column(s): ${say(ms)}`)
      }
      // Must-fail: the old placement, `absolute right-0 top-0` on the mark
      // against the field wrapper (the same box the pre-F124 EditedMark had),
      // put back by a test-only style, at both sizes.
      await page.addStyleTag({ content: "[data-field-keys] span:has(> [data-edited-dot]) { position: absolute !important; left: auto !important; right: 0 !important; top: 0 !important; margin: 0 !important }" })
      for (const [w, h] of [...resetSizes].reverse()) {
        await page.setViewportSize({ width: w, height: h })
        await settle(600)
        const ms = await measureResets()
        row(`  must-fail F124 ${w}x${h}: the old corner placement is caught`, ms.length > 0 && !ms.every(besideOk), say(ms))
      }
      await page.evaluate(() => document.querySelectorAll("style").forEach((s) => s.textContent.includes("span:has(> [data-edited-dot])") && s.remove()))
      row("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "))
      row("every grab ran with motion off and every animation flag already false", grabs > 0 && forced === 0, `${grabs} grabs, ${forced} had a flag on`)
    }
  } finally {
    await browser.close()
  }
}

console.log(`\n${pass} passed of ${pass + fail} graded, ${fail} failed; ${selfRows.length} SELF, not graded${selfRows.length ? ": " + selfRows.map((n) => n.trim()).join(" | ") : ""}`)
process.exit(fail ? 1 : 0)
