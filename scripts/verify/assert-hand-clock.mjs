// assert-hand-clock.mjs · HAND-DRAW, 2026-09-26
//
// The Hand Draw preset on /: `envelope.clock = "hand"` re-stamps the processed
// strokes' `t` with Desk Doodles' `stampPenClock` in ONE memo in app/page.tsx.
// Plan: docs/research-2026-09-26/pen-clock-on-slash-plan.md §3 and §5.
//
// Every row has a must-fail: a fresh browser context with one
// `window.__FS_GATE_MUTATE` knockout set before load. A must-fail pass is only
// counted when the row it targets goes red. A knockout that leaves its row green
// fails the gate, because then the row cannot see the thing it polices.
//
//   FS_HEADED=0 FS_PORT=3138 node scripts/verify/assert-hand-clock.mjs
//   ... --film   also writes frame strips at even clock steps (Authentic / Hand)
//
// HAND-DRAW-4: the memo now stamps the RAW trace and carries t through
// processStroke, so R2 grades `rawRecorded` -> `stamped` and checks that the
// clocked points kept the recorded x,y. R7 to R10 are new: parity with Desk
// Doodles' own call, the word space as the longest lift, the default logo take
// measured off the playing page, and Authentic's take against main's hash.
//
// Exit 0 all green and every must-fail fired, 1 otherwise, 2 nothing to check.
import { createJiti } from "jiti"
import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../..", import.meta.url).pathname } })
const PR = await jiti.import("../../lib/pen-reveal.ts")
const ST = await jiti.import("../../lib/stroke-timing.ts")
const S = await jiti.import("../../lib/style-system.ts")
const GE = await jiti.import("../../lib/geometry-engines.ts")
const { chromium } = await import("./lib/browser.mjs")
const { LAB_URL } = await import("./lib/dev-server.mjs")
const { openStyle } = await import("./lib/dock.mjs")
const OUT = new URL("../../docs/verification/hand-clock/", import.meta.url).pathname
mkdirSync(OUT, { recursive: true })
const J = JSON.stringify
const sha = (x) => createHash("sha256").update(typeof x === "string" || Buffer.isBuffer(x) ? x : J(x)).digest("hex").slice(0, 12)
const FILM = process.argv.includes("--film")
const N_SAMPLES = 64
// Desk Doodles' nib is /'s default Solid nib (HAND-DRAW-3, probe-rate.mjs).
const DD_NIB = GE.computeSolidEffectiveThicknessPx(GE.DEFAULT_SOLID_PARAMS.thickness)
// Main's Authentic take on the logo, from HAND-DRAW's committed gate-summary.json.
const MAIN_TAKE = "47596359db80"
const TARGET_MS = (140 / 30) * 1000, FRAME_MS = 1000 / 60

const hand = S.PRESET_REGISTRY.geometryAnimation.find((p) => p.id === "handDraw")
if (!hand) { console.log("NOTHING TO CHECK: no handDraw preset in Geometry Animation"); process.exit(2) }
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines
console.log(`DENOMINATOR: logo fixture ${polys.length} strokes, ${polys.reduce((a, p) => a + p.length, 0)} input points; ${N_SAMPLES} reveal samples per stroke set; 10 rows, each with its own must-fail pass`)

const ROWS = {
  off: "R1 off is main: clock recorded hands the viewport the SAME arrays, and the take, slots and frames are unchanged by a hand round trip",
  pen: "R2 hand is stampPenClock of the RAW trace: every stamped point's t,x,y and the reveal at 64 clock fractions, and the clocked points keep the recorded x,y, on the logo and on one stroke drawn with the mouse",
  strip: "R3 strip and stage agree under hand: the provider's penMs (the strip's seconds axis) equals the viewport's",
  save: "R4 save and reload keeps hand",
  custom: "R5 Customize under Hand Draw lists envelope.clock and envelope.rate, an edit marks each, Reset puts hand and Hand Draw's rate back",
  perform: "R6 a performed take holds the clock: asking for another clock leaves the performed slot where it was",
  parity: "R7 /'s stamp equals Desk Doodles' stampPenClock(logo, lognormal, nib, dropSubNibStubs) at every point and at 64 clock fractions, 1e-9",
  lift: "R8 the longest lift is the word space (the lift with the widest x gap), on / and on Desk Doodles, and every lift matches",
  take: "R9 Hand Draw's default logo take is 140/30 s within one frame, measured off the playing page and read off the take",
  authentic: "R10 Authentic's logo take is byte-identical to main (sha 47596359db80)",
}
const MUST_FAIL = { off: "clock-always-hand", pen: "clock-uniform", strip: "clock-strip-recorded", save: "clock-not-persisted", custom: "presetFields-applies-only", perform: "clock-no-yield", parity: "clock-stamp-resampled", lift: "clock-stamp-resampled", take: "clock-rate-off", authentic: "clock-rate-leak" }

const browser = await chromium.launch()
const asProcessed = (pts) => pts.map((points) => ({ points, cornerCount: 0 }))
// Two clocks, point by point (t, x, y) and by the reveal at N_SAMPLES clock
// fractions. A count mismatch is a FAIL with both counts, never a skip.
function compareClocks(A, B) {
  if (!A || !B) return { ok: false, n: 0, detail: `missing clock (${A ? A.length : "none"} vs ${B ? B.length : "none"} strokes)` }
  let n = 0, worst = 0, lenOk = A.length === B.length, bad = lenOk ? "" : `${A.length} vs ${B.length} strokes`
  for (let i = 0; i < A.length && lenOk; i++) {
    const a = A[i], b = B[i]
    if (a.length !== b.length) { lenOk = false; bad = `stroke ${i}: ${a.length} vs ${b.length} points`; break }
    for (let j = 0; j < a.length; j++) { n++; worst = Math.max(worst, Math.abs(a[j].t - b[j].t), Math.abs(a[j].x - b[j].x), Math.abs(a[j].y - b[j].y)) }
  }
  if (!lenOk) return { ok: false, n, detail: bad }
  let rWorst = 0
  const PA = asProcessed(A), PB = asProcessed(B)
  for (let k = 0; k < N_SAMPLES; k++) {
    const f = (k + 0.5) / N_SAMPLES
    rWorst = Math.max(rWorst, Math.abs(PR.revealDistanceFraction(PA, f, "raw", 0) - PR.revealDistanceFraction(PB, f, "raw", 0)))
  }
  return { ok: n > 0 && worst <= 1e-9 && rWorst <= 1e-9, n, detail: `${A.length} strokes, ${n} points, worst |dt,dx,dy| ${worst.toExponential(2)}, reveal worst ${rWorst.toExponential(2)} over ${N_SAMPLES}` }
}
function penCompare(c) {
  if (!c.stamped || !c.rawRecorded) return { ok: false, detail: "no stamped clock or raw trace on __fsClock", stampedPen: NaN }
  const ref = PR.stampPenClock(c.rawRecorded, "lognormal", { nibDiameter: c.nib }).map((s) => s.points)
  const k = compareClocks(ref, c.stamped)
  let gN = 0, gWorst = 0, gLen = c.clocked.length === c.recorded.length
  for (let i = 0; i < c.recorded.length && gLen; i++) {
    const a = c.recorded[i], b = c.clocked[i]
    if (a.length !== b.length) { gLen = false; break }
    for (let j = 0; j < a.length; j++) { gN++; gWorst = Math.max(gWorst, Math.abs(a[j].x - b[j].x), Math.abs(a[j].y - b[j].y)) }
  }
  return {
    ok: k.ok && gLen && gN > 0 && gWorst === 0,
    detail: `raw stamp: ${k.detail}; clocked x,y vs recorded: ${gLen ? `${gN} points, worst ${gWorst}` : "counts differ"}; drift ${c.drift}`,
    stampedPen: ST.penMsOf(ref.map((points) => ({ points }))),
  }
}
// Lifts in stroke order: the pause before stroke i+1, and the x gap between
// stroke i's ink and stroke i+1's. The word space is the widest gap.
function lifts(S) {
  const out = []
  for (let i = 0; i + 1 < (S?.length ?? 0); i++) {
    const a = S[i], b = S[i + 1]
    if (!a.length || !b.length) continue
    out.push({ i, ms: b[0].t - a[a.length - 1].t, gap: Math.min(...b.map((p) => p.x)) - Math.max(...a.map((p) => p.x)) })
  }
  return out
}
function wordSpace(S) {
  const L = lifts(S)
  if (L.length < 2) return { ok: false, L, detail: `${L.length} lifts` }
  const byMs = [...L].sort((x, y) => y.ms - x.ms), widest = L.reduce((m, l) => (l.gap > m.gap ? l : m))
  return { ok: byMs[0].i === widest.i && byMs[0].ms > byMs[1].ms, L, detail: `${L.length} lifts, longest after stroke ${byMs[0].i} ${byMs[0].ms.toFixed(0)} ms (next ${byMs[1].ms.toFixed(0)}), widest gap after stroke ${widest.i} (${widest.gap.toFixed(0)})` }
}

async function run(mutate) {
  const rows = {}
  const row = (k, ok, detail = "") => { rows[k] = { ok: !!ok, detail }; console.log(`${mutate ? `[${mutate}] ` : ""}${ok ? "PASS" : "FAIL"}  ${ROWS[k].slice(0, 40)}...  (${detail})`) }
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1 })
  if (mutate) await ctx.addInitScript((m) => { window.__FS_GATE_MUTATE = m }, mutate)
  const page = await ctx.newPage()
  const errors = []
  page.on("pageerror", (e) => errors.push(String(e)))
  const settle = async (ms = 400) => { await page.waitForTimeout(ms); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))) }
  const ready = () => page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__fsTake && window.__fsClock, null, { timeout: 240000 })
  const clock = () => page.evaluate(() => window.__fsClock.get())
  const take = () => page.evaluate(() => { const t = window.__fsTake.get(); return { slots: t.slots, baseSlots: t.baseSlots, takeMs: t.takeMs, penMs: t.penMs, sig: t.sig, totalDuration: t.totalDuration, exportMs: t.exportMs, schedule: window.__revealHarness.schedule() } })
  const glRect = () => page.evaluate(() => { const c = [...document.querySelectorAll("canvas")].filter((x) => x.getContext("2d") === null).sort((a, b) => b.width * b.height - a.width * a.height)[0]; if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height } })
  const frames = async (n, tag) => {
    const rect = await glRect(); if (!rect) return { hash: "no-canvas", files: [] }
    const bufs = [], files = []
    for (let k = 0; k <= n; k++) {
      await page.evaluate((p) => window.__revealHarness.setProgress(p), k / n); await settle(120)
      const b = await page.screenshot({ clip: rect }); bufs.push(b)
      if (tag) { const f = `${OUT}film-${tag}-${String(k).padStart(2, "0")}.png`; writeFileSync(f, b); files.push(f) }
    }
    return { hash: sha(Buffer.concat(bufs)), files }
  }
  const pickPreset = async (id) => { await page.evaluate((id) => window.__styleHarness.selectMotionPreset(id), id); await settle(500) }
  try {
    await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
    await ready()
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
    await page.waitForTimeout(1500)
    await page.evaluate(() => window.__revealHarness.setPlaying(false))
    await pickPreset("authenticDraw")

    // R1
    const c0 = await clock(), t0 = await take(), f0 = await frames(4)
    await pickPreset("handDraw"); const tH = await take()
    await pickPreset("authenticDraw"); const c1 = await clock(), t1 = await take(), f1 = await frames(4)
    row("off", c0.clock === "recorded" && c0.sameRef && c1.sameRef && sha(t0) === sha(t1) && f0.hash === f1.hash && sha(tH) !== sha(t0),
      `sameRef ${c0.sameRef}/${c1.sameRef}, take ${sha(t0)} -> hand ${sha(tH)} -> back ${sha(t1)}, frames ${f0.hash} vs ${f1.hash}`)
    rows.off.hashes = { take: sha(t0), frames: f0.hash }

    // R10
    row("authentic", sha(t0) === MAIN_TAKE, `Authentic take ${sha(t0)} vs main ${MAIN_TAKE}`)

    // R5
    // L4: the Style panel on Presets, from the rail (the style bar's Preset pill until L4).
    await openStyle(page, "presets").catch(() => {}); await settle(600)
    await page.locator("select").filter({ has: page.locator('option[value="geometryAnimation"]') }).first().selectOption("geometryAnimation").catch(() => {}); await settle(400)
    await page.locator('button[data-preset-id="handDraw"]').first().click().catch(() => {}); await settle(600)
    const cz = "[data-preset-customize]"
    const listed = await page.evaluate((cz) => [...document.querySelectorAll(`${cz} [data-field-keys]`)].flatMap((n) => n.dataset.fieldKeys.split(" ")).sort(), cz)
    const want = S.presetFields(hand).sort()
    const clockBtn = page.locator(`${cz} [data-field-keys="envelope.clock"] button[data-clock="recorded"]`)
    let afterEdit = null, marked = 0, afterReset = null
    if (await clockBtn.count()) {
      await clockBtn.click(); await settle(); afterEdit = (await clock()).clock
      marked = await page.locator(`${cz} [data-field-edited]`).count()
      await page.locator(`${cz} [data-field-keys="envelope.clock"] [data-field-reset]`).click().catch(() => {}); await settle()
      afterReset = (await clock()).clock
    }
    const rateBtn = page.locator(`${cz} [data-field-keys="envelope.rate"] button[data-rate="1"]`)
    let rEdit = null, rMarked = 0, rReset = null
    if (await rateBtn.count()) {
      await rateBtn.click(); await settle(); rEdit = (await clock()).rate
      rMarked = await page.locator(`${cz} [data-field-edited]`).count()
      await page.locator(`${cz} [data-field-keys="envelope.rate"] [data-field-reset]`).click().catch(() => {}); await settle()
      rReset = (await clock()).rate
    }
    const edited0 = await page.locator(`${cz} [data-field-edited]`).count()
    if (!FILM || mutate) await page.screenshot({ path: `${OUT}customize-handDraw${mutate ? "-" + mutate : ""}-1512x982.png` }).catch(() => {})
    row("custom", listed.includes("envelope.clock") && listed.includes("envelope.rate") && J(listed) === J(want) && afterEdit === "recorded" && marked === 1 && afterReset === "hand"
      && rEdit === 1 && rMarked === 1 && rReset === S.HAND_DRAW_RATE && edited0 === 0,
      `listed ${listed.length} of ${want.length} (clock ${listed.includes("envelope.clock")}, rate ${listed.includes("envelope.rate")}), clock edit -> ${afterEdit}, marked ${marked}, reset -> ${afterReset}; rate edit -> ${rEdit}, marked ${rMarked}, reset -> ${rReset}`)

    // R2 logo, R3
    await pickPreset("handDraw")
    const c2 = await clock(), pen = penCompare(c2), tk = await take()
    row("strip", c2.hand && Math.abs(c2.takePenMs - tk.penMs) <= 1 && Math.abs(tk.penMs - pen.stampedPen / c2.rate) <= 1,
      `provider penMs ${Math.round(c2.takePenMs)}, viewport penMs ${Math.round(tk.penMs)}, stampPenClock ${Math.round(pen.stampedPen)} / rate ${c2.rate}, recorded ${Math.round(ST.penMsOf(c0.recorded.map((points) => ({ points }))))}; memo ${c2.memoMs.toFixed(1)} ms`)
    if (FILM && !mutate) {
      await pickPreset("authenticDraw"); await frames(24, "authentic")
      await pickPreset("handDraw"); await frames(24, "hand")
      // The moments, off the reveal both clocks drive: holds (lifts), their
      // lengths, and how the pen lands (first 15% of a stroke's time vs its mean).
      const moments = (pts) => {
        const A = asProcessed(pts), all = pts.flat(), lo = Math.min(...all.map((q) => q.t)), hi = Math.max(...all.map((q) => q.t)), ms = hi - lo
        const n = 2000, holds = []; let run = 0, still = 0, prev = PR.revealDistanceFraction(A, 0, "raw", 0)
        for (let k = 1; k <= n; k++) { const v = PR.revealDistanceFraction(A, k / n, "raw", 0); if (v - prev < 1e-7) { run++; still++ } else { if (run >= 2) holds.push(Math.round((run * ms) / n)); run = 0 } prev = v }
        const land = pts.filter((q) => q.length > 8).map((q) => { const T = q[q.length - 1].t - q[0].t, cut = q[0].t + 0.15 * T; let d = 0, D = 0; for (let j = 1; j < q.length; j++) { const s = Math.hypot(q[j].x - q[j - 1].x, q[j].y - q[j - 1].y); D += s; if (q[j].t <= cut) d += s } return T > 0 ? d / 0.15 / D : 1 }).sort((x, y) => x - y)
        return { ms: Math.round(ms), stillPct: +((100 * still) / n).toFixed(1), holds: holds.length, holdMs: holds, landingSpeedVsMean: +land[Math.floor(land.length / 2)].toFixed(2) }
      }
      const m = { recorded: moments(c2.recorded), hand: moments(c2.clocked) }
      console.log(`MOMENTS ${J(m)}`)
      writeFileSync(`${OUT}film-moments.json`, J(m, null, 2))
    }

    // R7, R8
    await pickPreset("handDraw")
    const c7 = await clock()
    const dd = PR.stampPenClock(polys, "lognormal", { nibDiameter: DD_NIB, dropSubNibStubs: true }).map((s) => s.points)
    const par = compareClocks(dd, c7.stamped)
    row("parity", par.ok && c7.nib === DD_NIB, `/ nib ${c7.nib} vs Desk Doodles ${DD_NIB}; ${par.detail}`)
    const wsH = wordSpace(c7.stamped), wsD = wordSpace(dd)
    const liftWorst = wsH.L.length === wsD.L.length && wsH.L.length > 0 ? Math.max(...wsH.L.map((l, k) => Math.abs(l.ms - wsD.L[k].ms))) : Infinity
    row("lift", wsH.ok && wsD.ok && liftWorst <= 1e-6, `/: ${wsH.detail}; Desk Doodles: ${wsD.detail}; lifts worst |dms| ${liftWorst.toExponential(2)} over ${wsH.L.length}`)

    // R9, off the page as it plays: least squares of playhead on rAF time.
    const tk9 = await take()
    const play = await page.evaluate(async () => {
      const h = window.__revealHarness
      h.setProgress(0); await new Promise((r) => setTimeout(r, 300))
      const s = []; h.setPlaying(true); const t0 = performance.now()
      await new Promise((res) => { const f = (ts) => { const p = h.getProgress(); s.push([ts, p]); if (p >= 1 || ts - t0 > 20000) res(); else requestAnimationFrame(f) }; requestAnimationFrame(f) })
      h.setPlaying(false); return { s, exportMs: h.getTotalDuration() }
    })
    const mid = play.s.filter(([, p]) => p > 0.05 && p < 0.95)
    let measured = NaN
    if (mid.length >= 10) {
      const n = mid.length, mt = mid.reduce((a, [t]) => a + t, 0) / n, mp = mid.reduce((a, [, p]) => a + p, 0) / n
      const slope = mid.reduce((a, [t, p]) => a + (t - mt) * (p - mp), 0) / mid.reduce((a, [t]) => a + (t - mt) ** 2, 0)
      measured = 1 / slope
    }
    // The take has no takeMs field; its length is the export length the page
    // reports (getTotalDuration), and the pen length is the take's penMs.
    row("take", Math.abs(measured - TARGET_MS) <= FRAME_MS && Math.abs(play.exportMs - TARGET_MS) <= FRAME_MS && Math.abs(tk9.penMs - TARGET_MS) <= FRAME_MS,
      `played ${Number.isFinite(measured) ? measured.toFixed(1) : "no playhead motion"} ms over ${mid.length} of ${play.s.length} frames, export ${play.exportMs?.toFixed?.(1)} ms, take penMs ${tk9.penMs?.toFixed?.(1)} ms, target ${TARGET_MS.toFixed(1)} +/- ${FRAME_MS.toFixed(1)}`)
    await page.evaluate(() => window.__revealHarness.setProgress(1))

    // R4
    await page.waitForTimeout(2500)
    await page.reload({ waitUntil: "domcontentloaded" }); await ready(); await settle(1500)
    const c4 = await clock()
    row("save", c4.clock === "hand" && c4.hand && c4.recorded.length === polys.length, `after reload clock ${c4.clock}, ${c4.recorded.length} strokes`)

    // R2 drawn stroke
    await page.evaluate(() => window.__styleHarness.clearCanvas()); await settle(600)
    const dr = await page.evaluate(() => { const c = [...document.querySelectorAll("canvas")].filter((x) => x.getContext("2d") !== null).sort((a, b) => b.width * b.height - a.width * a.height)[0]; if (!c) return null; const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height } })
    let drawn = { ok: false, detail: "no drawing canvas" }
    if (dr) {
      const cx = dr.x + dr.w * 0.5, cy = dr.y + dr.h * 0.5
      await page.mouse.move(cx - 120, cy); await page.mouse.down()
      for (let k = 1; k <= 48; k++) { const a = (k / 48) * Math.PI * 1.5; await page.mouse.move(cx - 120 + k * 5, cy + Math.sin(a) * 60 * (k < 24 ? 1 : 0.6)); await page.waitForTimeout(k % 12 === 0 ? 60 : 8) }
      await page.mouse.up(); await settle(800)
      const c5 = await clock()
      drawn = c5.recorded.length === 1 ? penCompare(c5) : { ok: false, detail: `${c5.recorded.length} strokes after drawing one` }
    }
    row("pen", pen.ok && drawn.ok, `logo: ${pen.detail}; drawn: ${drawn.detail}`)

    // R6
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys); await settle(1200)
    await pickPreset("handDraw")
    const setOk = await page.evaluate(() => window.__fsTake.set({ 2: { delayMs: 0, speed: 1, ease: { kind: "preset", id: "linear" }, holdBack: false, performed: [0, 0.1, 0.3, 0.6, 0.85, 1] } }))
    await settle(600)
    const p0 = await take(), pc0 = (await clock()).clock
    await pickPreset("authenticDraw")
    const p1 = await take(), pc1 = (await clock()).clock
    const s0 = p0.slots ? [p0.slots[4], p0.slots[5]] : null, s1 = p1.slots ? [p1.slots[4], p1.slots[5]] : null
    row("perform", setOk && s0 && s1 && pc0 === "hand" && pc1 === "hand" && Math.abs(s0[0] - s1[0]) <= 1 && Math.abs(s0[1] - s1[1]) <= 1,
      `set ${setOk}, clock ${pc0} -> ${pc1}, stroke 2 slot [${s0?.map(Math.round)}] -> [${s1?.map(Math.round)}] ms`)
    rows.errors = errors.slice(0, 3)
  } catch (e) {
    rows.crash = String(e).slice(0, 300); console.log(`CRASH ${mutate ?? "real"}: ${rows.crash}`)
  } finally { await ctx.close() }
  return rows
}

const real = await run(null)
const mf = {}
if (!FILM) for (const [k, m] of Object.entries(MUST_FAIL)) { const r = await run(m); mf[k] = { mutate: m, fired: r[k] ? !r[k].ok : false, detail: r[k]?.detail ?? r.crash ?? "row not reached" } }
await browser.close()

const keys = Object.keys(ROWS)
const green = keys.filter((k) => real[k]?.ok)
const fired = keys.filter((k) => mf[k]?.fired)
console.log(`\nREAL: ${green.length} of ${keys.length} rows green`)
if (!FILM) {
  for (const k of keys) console.log(`MUST-FAIL ${mf[k].fired ? "FIRED" : "SILENT"}  ${k} <- ${mf[k].mutate}  (${mf[k].detail})`)
  console.log(`MUST-FAIL: ${fired.length} of ${keys.length} fired`)
}
console.log(`page errors: ${real.errors?.length ?? "n/a"}`)
if (!FILM) writeFileSync(`${OUT}gate-summary.json`, J({ date: "2026-09-26", rows: ROWS, real, mustFail: mf, green: green.length, fired: fired.length, of: keys.length }, null, 2))
process.exit(FILM ? 0 : green.length === keys.length && fired.length === keys.length && !real.crash ? 0 : 1)
