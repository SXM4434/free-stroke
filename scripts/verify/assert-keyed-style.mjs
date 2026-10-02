#!/usr/bin/env node
// assert-keyed-style.mjs · THE FRAME DRAWS THE KEYED STYLE, AND A KEYED LOOP SPEED NEVER JUMPS THE LOOP
//
//   FS_PORT=3140 FS_HEADED=0 node scripts/verify/assert-keyed-style.mjs [--ref=http://localhost:3139]
//
// Keyframe phase K2 (`docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md` §4 "How sampling feeds the
// style" and "Procedural loops, keyed through their settings", §5 row K2; his ruling of 2026-09-26: a
// looping motion is keyable through its settings, and its phase is the running sum of its speed).
// `components/viewport-3d.tsx` reads `styleAt(styleState, keys, clockMs)` at the top of the frame, and a
// keyed texture, dither, ASCII or material speed runs as a sum (`lib/style-clock.ts` runningLayerTime,
// runningSum). The paths no key drives (`KEY_DISABLED`, lib/keyframes.ts) are left out of the sample.
//
// Rows, each with its must-fail:
//   K1  PHASE CONTINUOUS. Texture animated, free-running; textureSpeed keyed 1, held, then 3 from 2 s.
//       Played through the step: every frame's phase change is the mean keyed speed over its key-clock
//       step (the area under the speed, `loopSpeedOver` through `loopPhaseAt`) times its style-clock
//       change (within 2%), before, at and after the step. must-fails: `__fsKeyMutant = "speedxtime"`,
//       the keyed speed multiplying time: the step frame jumps; `"endspeed"`, the speed at the frame's
//       end for the whole frame: the frame that holds the step overshoots.
//   K1m THE SAME FOR THE MATERIAL LOOP. roughnessPulse animated; materialAnimationSpeed keyed 1, held,
//       then 3 from 2 s: each frame's material phase change is its speed times its clock change. Same
//       must-fail.
//   K2  A KEYED VALUE MOVES THE PIXELS. textureIntensity keyed 0 to 1 from the take's end to twice its
//       length, texture still: the frame at the take's end and at the keys' end differ (the mark is whole
//       at both, so only the keyed value can tell them apart), and the frame loop drew the keyed value at
//       each. must-fail: `"memo"`, the frame reading the doc's value: the two frames are the same.
//   K3  EXPORT FRAME N IS LIVE FRAME N. A real Video export (fixed 2 s, 24 fps) records the keyed value
//       the frame loop drew at every exported frame; the live page, seeked to each of those clocks,
//       draws the same value. must-fail: the live value read one export frame later differs.
//   K4  UNKEYED IS UNCHANGED (with --ref): with no keys, the lane's frames at playheads 0.5 and 1 are
//       byte-identical to the reference tree's. Positive control: a textureIntensity key 0.05 over the
//       doc's value changes the lane's frame.
//   K5  A DISABLED PATH DRAWS NOTHING. texturePhase keyed 0 to 1 (a loop's phase, never keyed): the frame
//       at playhead 1 equals the unkeyed frame. must-fail: `"nodisable"`, the frame sampling it: differs.
//   G1  no page error on the lane pages.

const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"

const REF = process.argv.find((a) => a.startsWith("--ref="))?.slice(6) ?? null
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
const sha = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16)
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

const TEX = { motionMode: "independent", textureEnabled: true, textureMode: "grain", textureAnimated: true, textureSyncMode: "independent", textureSpeed: 1, textureIntensity: 0.6 }
const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false }
const k = (t, v, out = "linear") => ({ tMs: Math.round(t), value: v, easeOut: out, easeIn: "linear" })

async function open(url, mutant = null) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1, reducedMotion: "no-preference", acceptDownloads: true })
  await ctx.addInitScript(() => { try { for (const x of Object.keys(localStorage)) if (x.startsWith("fs.layout.")) localStorage.removeItem(x) } catch {} })
  if (mutant) await ctx.addInitScript((m) => { window.__fsKeyMutant = m }, mutant)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!mutant && url === LAB_URL) errors.push(e.message) })
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness && window.__fsSetKeys, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p.slice(0, 5), { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate(() => { window.__revealHarness.setPlaying(false); window.__revealHarness.setEase?.("linear") })
  await settle(page, 400)
  return { ctx, page }
}
const settle = async (page, ms = 300) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const setKeys = async (page, keys) => {
  const refused = await page.evaluate((x) => window.__fsSetKeys(x), keys)
  if (refused?.length) throw new Error(`keys refused: ${refused.join("; ")}`)
  await settle(page, 400)
}
const len = (page) => page.evaluate(() => window.__fsTransport?.derived()?.totalDuration ?? window.__fsTake?.get()?.totalDuration ?? 0)
const grab = (page) => page.evaluate(() => window.__captureHarness.grab()).then((u) => (typeof u === "string" && u.startsWith("data:") ? sha(u) : `none (${u})`))
const rec = (page, on) => page.evaluate((on) => window.__geomDebug.keyedStyle.record(on), on)
const rows = (page) => page.evaluate(() => window.__geomDebug.keyedStyle.rows())

// ---------------------------------------------------------------- K1
const LOOPS = {
  texture: { path: "textureSpeed", style: {}, t: "texTime", v: "texSpeed", rate: 1.2 },
  material: { path: "materialAnimationSpeed", style: { materialAnimationEnabled: true, materialAnimationType: "roughnessPulse", materialAnimationSpeed: 1 }, t: "matTime", v: "matSpeed", rate: 1 },
}
async function phase(mutant, loop = LOOPS.texture) {
  const { ctx, page } = await open(LAB_URL, mutant)
  await page.evaluate((st) => window.__styleHarness.setStyle(st), { ...TEX, ...loop.style })
  await settle(page, 300)
  await setKeys(page, { [loop.path]: [k(0, 1, "hold"), k(2000, 3)] })
  const L = await len(page)
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await rec(page, true)
  await page.evaluate(() => window.__revealHarness.setPlaying(true))
  await page.waitForFunction((L) => (window.__fsTransport?.playhead() ?? 0) * L > 3200 || !window.__fsTransport?.get("playing"), L, { timeout: 60000 }).catch(() => {})
  await page.evaluate(() => window.__revealHarness.setPlaying(false))
  const r = await rows(page)
  await rec(page, false)
  await ctx.close()
  let worst = 0, worstAt = null, steps = 0, spanMs = [Infinity, -Infinity]
  for (let i = 1; i < r.length; i++) {
    const a = r[i - 1], b = r[i]
    const dt = b.elapsed - a.elapsed
    if (!(dt > 0) || b.keyed === 0 || typeof b[loop.t] !== "number" || typeof a[loop.t] !== "number") continue
    // The speed the frame ran at is the mean of the keyed speed (1 held, then 3 from 2000 ms) over the
    // key clock's step from the last frame to this one, computed here from the keys and not read from
    // the page, times the loop's base rate (the texture layer's 1.2; the material's 1). A step that is
    // not forward, or longer than a frame can be (250 ms), reads the speed at its end.
    const speedAt = (c) => (c < 2000 ? 1 : 3)
    const c0 = a.clockMs, c1 = b.clockMs
    const mean = c1 > c0 && c1 - c0 <= 250 ? (Math.max(0, Math.min(c1, 2000) - c0) * 1 + Math.max(0, c1 - Math.max(c0, 2000)) * 3) / (c1 - c0) : speedAt(c1)
    const expect = mean * loop.rate * dt
    const got = b[loop.t] - a[loop.t]
    const err = Math.abs(got - expect) / Math.max(1e-6, 3 * loop.rate * dt)
    if (err > worst) { worst = err; worstAt = { clockMs: Math.round(b.clockMs), got: +got.toFixed(4), expect: +expect.toFixed(4) } }
    steps++
    spanMs = [Math.min(spanMs[0], b.clockMs), Math.max(spanMs[1], b.clockMs)]
  }
  return { worst, worstAt, steps, spanMs, crossed: spanMs[0] < 2000 && spanMs[1] > 2000 }
}
{
  const r = await phase(null)
  row("K1", "a keyed speed step 1 to 3 at 2 s: each frame's phase change is speed times its clock change", r.crossed && r.steps > 20 && r.worst <= 0.02, `${r.steps} frames over ${Math.round(r.spanMs[0])} to ${Math.round(r.spanMs[1])} ms, worst error ${(r.worst * 100).toFixed(2)}% of a speed-3 frame ${JSON.stringify(r.worstAt)}`)
  const m = await phase("speedxtime")
  fired("K1", "phase as speed times time", m.worst > 0.02, `worst error ${(m.worst * 100).toFixed(0)}% of a speed-3 frame ${JSON.stringify(m.worstAt)}`)
  const me = await phase("endspeed")
  fired("K1", "the speed at the frame's end for the whole frame", me.worst > 0.02, `worst error ${(me.worst * 100).toFixed(1)}% of a speed-3 frame ${JSON.stringify(me.worstAt)}`)
  const rm = await phase(null, LOOPS.material)
  row("K1m", "a keyed material speed step 1 to 3 at 2 s: each frame's phase change is speed times its clock change", rm.crossed && rm.steps > 20 && rm.worst <= 0.02, `${rm.steps} frames over ${Math.round(rm.spanMs[0])} to ${Math.round(rm.spanMs[1])} ms, worst error ${(rm.worst * 100).toFixed(2)}% of a speed-3 frame ${JSON.stringify(rm.worstAt)}`)
  const mm = await phase("speedxtime", LOOPS.material)
  fired("K1m", "material phase as speed times time", mm.worst > 0.02, `worst error ${(mm.worst * 100).toFixed(0)}% of a speed-3 frame ${JSON.stringify(mm.worstAt)}`)
  const mme = await phase("endspeed", LOOPS.material)
  fired("K1m", "the material speed at the frame's end for the whole frame", mme.worst > 0.02, `worst error ${(mme.worst * 100).toFixed(1)}% of a speed-3 frame ${JSON.stringify(mme.worstAt)}`)
}

// ---------------------------------------------------------------- K2
async function ramp(mutant) {
  const { ctx, page } = await open(LAB_URL, mutant)
  await page.evaluate((st) => window.__styleHarness.setStyle({ ...st, textureEnabled: true, textureMode: "grain", textureIntensity: 0.5 }), STILL)
  await settle(page, 300)
  const L = await len(page)
  // Past the take, so the reveal is whole at both sample points: the axis becomes 2L long.
  await setKeys(page, { textureIntensity: [k(L, 0), k(2 * L, 1)] })
  const at = async (p) => {
    await page.evaluate((p) => window.__revealHarness.setProgress(p), p)
    await rec(page, true)
    await settle(page, 700)
    const r = await rows(page)
    await rec(page, false)
    return { hash: await grab(page), drew: r.length ? r[r.length - 1].texIntensity : null }
  }
  const a = await at(0.5)
  const b = await at(1)
  await ctx.close()
  return { a, b }
}
{
  const r = await ramp(null)
  row("K2", "textureIntensity keyed 0 to 1 after the take: the frames at its two keys differ, and each drew its keyed value", r.a.hash !== r.b.hash && Math.abs(r.a.drew - 0) < 1e-9 && Math.abs(r.b.drew - 1) < 1e-9, `frames ${r.a.hash} vs ${r.b.hash}, drew ${r.a.drew} and ${r.b.drew}`)
  const m = await ramp("memo")
  fired("K2", "the frame reading the doc's value", m.a.hash === m.b.hash, `frames ${m.a.hash} vs ${m.b.hash}, drew ${m.a.drew} and ${m.b.drew}`)
}

// ---------------------------------------------------------------- K3
{
  const { ctx, page } = await open(LAB_URL)
  await page.evaluate((st) => window.__styleHarness.setStyle({ ...st, textureEnabled: true, textureMode: "grain" }), STILL)
  const L = await len(page)
  await setKeys(page, { textureIntensity: [k(0, 0.1), k(L * 0.5, 0.9), k(L, 0.3)] })
  // The Export tab: fixed 2 s, 24 fps, then Video.
  await page.evaluate(() => window.__dockHarness?.dock.open("export"))
  await settle(page, 300)
  await page.getByRole("button", { name: "Video export settings" }).click()
  await page.getByRole("button", { name: "Fixed", exact: true }).click()
  await page.getByRole("button", { name: "2s", exact: true }).click()
  await page.getByRole("button", { name: "24", exact: true }).click()
  await page.getByRole("button", { name: "Video export settings" }).click()
  await rec(page, true)
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 900000 }), page.getByRole("button", { name: "Video", exact: true }).click()])
  await dl.path()
  await settle(page, 600)
  const all = await rows(page)
  await rec(page, false)
  // The export's frames are the ones drawn on the driven clock: the key clock steps in whole frames.
  const exp = []
  const seen = new Set()
  for (const x of all) {
    const key = x.clockMs.toFixed(3)
    if (x.clockMs < 0 || seen.has(key)) continue
    seen.add(key)
    exp.push(x)
  }
  const pick = exp.filter((_, i) => i % Math.max(1, Math.floor(exp.length / 12)) === 0).slice(0, 12)
  const live = []
  for (const x of pick) {
    await page.evaluate((p) => window.__revealHarness.setProgress(p), x.clockMs / L)
    await rec(page, true)
    await settle(page, 300)
    const r = await rows(page)
    await rec(page, false)
    live.push(r.length ? r[r.length - 1] : null)
  }
  await ctx.close()
  const same = pick.filter((x, i) => live[i] && Math.abs(live[i].texIntensity - x.texIntensity) < 1e-9).length
  const shifted = pick.slice(0, -1).filter((x, i) => live[i + 1] && Math.abs(live[i + 1].texIntensity - x.texIntensity) < 1e-9).length
  row("K3", "export frame N draws what live frame N draws (the keyed value, per frame)", pick.length >= 8 && same === pick.length, `${same}/${pick.length} sampled export frames equal live (of ${exp.length} distinct key clocks recorded)`)
  fired("K3", "live read one sampled frame later", shifted < pick.length - 1, `${shifted}/${pick.length - 1} equal when shifted`)
}

// ---------------------------------------------------------------- K4
if (REF) {
  const frames = async (url, keys) => {
    const { ctx, page } = await open(url)
    await page.evaluate((st) => window.__styleHarness.setStyle({ ...st, textureEnabled: true, textureMode: "grain", textureIntensity: 0.5 }), STILL)
    if (keys) await setKeys(page, keys(await len(page)))
    const out = []
    for (const p of [0.5, 1]) {
      await page.evaluate((p) => window.__revealHarness.setProgress(p), p)
      await settle(page, 700)
      out.push(await grab(page))
    }
    await ctx.close()
    return out
  }
  const lane = await frames(LAB_URL, null)
  const ref = await frames(REF, null)
  row("K4", "no keys: the lane's frames equal the reference tree's", lane.every((h, i) => h === ref[i]), `lane ${lane.join(" ")} vs ref ${ref.join(" ")}`)
  const ctl = await frames(LAB_URL, (L) => ({ textureIntensity: [k(0, 0.55), k(L, 0.55)] }))
  fired("K4", "a textureIntensity key 0.05 over the doc's value changes the frame", ctl.some((h, i) => h !== lane[i]), `keyed ${ctl.join(" ")}`)
} else {
  console.log("NOT RUN K4   no --ref given: the unkeyed identity needs a reference server")
}

// ---------------------------------------------------------------- K5
async function disabledPath(mutant) {
  const { ctx, page } = await open(LAB_URL, mutant)
  await page.evaluate((st) => window.__styleHarness.setStyle({ ...st, textureEnabled: true, textureMode: "grain", textureIntensity: 0.8 }), STILL)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await settle(page, 700)
  const plain = await grab(page)
  const L = await len(page)
  await setKeys(page, { texturePhase: [k(0, 0), k(L, 1)] })
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await settle(page, 700)
  const keyed = await grab(page)
  await ctx.close()
  return { plain, keyed }
}
{
  const r = await disabledPath(null)
  row("K5", "texturePhase keyed (a disabled path): the frame equals the unkeyed frame", r.plain === r.keyed && !r.plain.startsWith("none"), `unkeyed ${r.plain}, keyed ${r.keyed}`)
  const m = await disabledPath("nodisable")
  fired("K5", "the frame sampling a disabled path", m.plain !== m.keyed, `unkeyed ${m.plain}, keyed ${m.keyed}`)
}

row("G1", "the lane pages threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")
await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
