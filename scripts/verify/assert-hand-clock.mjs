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
// HAND-DRAW-P3: R11 drives the real Camera picker and reads the keys it writes
// (must-fails `lifts-slot-gaps`, the picker back on the slot gaps, and
// `clock-uniform`; a row naming two knockouts fires only when both turn it
// red). R12 is the export row: the film under Hand equals live at 8 clocks.
// R13 is Inflate's tip in the lifts under a timed take (plan section 4,
// "Inflate's shader holds"): it measured a creep, now held.
//
// Exit 0 all green and every must-fail fired, 1 otherwise, 2 nothing to check.
import { createJiti } from "jiti"
import { createHash } from "node:crypto"
import { mkdirSync, writeFileSync, readFileSync } from "node:fs"
import ts from "typescript"
import sharp from "sharp"
const jiti = createJiti(import.meta.url, { alias: { "@": new URL("../..", import.meta.url).pathname } })
const PR = await jiti.import("../../lib/pen-reveal.ts")
const ST = await jiti.import("../../lib/stroke-timing.ts")
const S = await jiti.import("../../lib/style-system.ts")
const GE = await jiti.import("../../lib/geometry-engines.ts")
const CM = await jiti.import("../../lib/camera-moves.ts")
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

// R12 films through the export module itself, served to the page the way
// assert-stroke-timing-browser does (lib/export transpiled, one route each).
const EXPORT_MODULES = ["frame-plan", "webm", "apng", "encoders", "recorder", "index"]
const ROOT = new URL("../..", import.meta.url).pathname
const transpiled = (name) =>
  ts.transpileModule(readFileSync(`${ROOT}lib/export/${name}.ts`, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: `${name}.ts` })
    .outputText.replace(/from\s+["']\.\/([a-z-]+)["']/g, 'from "./$1.js"')
const EXPORT_CLOCKS = 8

const hand = S.PRESET_REGISTRY.geometryAnimation.find((p) => p.id === "handDraw")
if (!hand) { console.log("NOTHING TO CHECK: no handDraw preset in Geometry Animation"); process.exit(2) }
const polys = JSON.parse(readFileSync(new URL("../capture/logo-strokes.json", import.meta.url), "utf8")).polylines

const ROWS = {
  off: "R1 off is main: clock recorded hands the viewport the SAME arrays, and the take, slots and frames are unchanged by a hand round trip",
  pen: "R2 hand is stampPenClock of the RAW trace: every stamped point's t,x,y and the reveal at 64 clock fractions, and the clocked points keep the recorded x,y, on the logo and on one stroke drawn with the mouse",
  strip: "R3 strip and stage agree under hand: the provider's penMs (the strip's seconds axis) equals the viewport's",
  save: "R4 save and reload keeps hand",
  custom: "R5 Customize under Hand Draw lists envelope.clock and envelope.rate, an edit marks each, Reset puts hand and Hand Draw's rate back",
  perform: "R6 PEN-7 perform wins: a performed stroke keeps its on-screen [t0, t1] within 1 ms and its performed pace across Hand -> Authentic -> Hand, while the other strokes follow the clock",
  parity: "R7 /'s stamp equals Desk Doodles' stampPenClock(logo, lognormal, nib, dropSubNibStubs) at every point and at 64 clock fractions, 1e-9",
  lift: "R8 the longest lift is the word space (the lift with the widest x gap), on / and on Desk Doodles, and every lift matches",
  take: "R9 Hand Draw's default logo take is 140/30 s within one frame, measured off the playing page and read off the take",
  authentic: "R10 Authentic's logo take is byte-identical to main (sha 47596359db80)",
  lifts: "R11 Turn in the lifts reads the Hand lifts: under Hand the picker offers the move and its keys turn in exactly stampPenClock's lifts / rate of 120 ms or more, each end within one frame",
  export: `R12 export under Hand equals live at ${EXPORT_CLOCKS} clocks, with no rows and with a timed take: the film's length is the take the page plays, and each frame is the live frame at its clock`,
  tip: "R13 Inflate under Hand with a timed take stands still in every pen lift of 50 ms or more (0 px change across the lift), while the same span inside the stroke before it moves",
}
const MUST_FAIL = { off: "clock-always-hand", pen: "clock-uniform", strip: "clock-strip-recorded", save: "clock-not-persisted", custom: "presetFields-applies-only", perform: "clock-no-rebase", lifts: ["lifts-slot-gaps", "clock-uniform"], export: "exportpen", tip: "tip-no-liftholds", parity: "clock-stamp-resampled", lift: "clock-stamp-resampled", take: "clock-rate-off", authentic: "clock-rate-leak" }
console.log(`DENOMINATOR: logo fixture ${polys.length} strokes, ${polys.reduce((a, p) => a + p.length, 0)} input points; ${N_SAMPLES} reveal samples per stroke set; ${Object.keys(ROWS).length} rows, each with its own must-fail pass`)

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
  for (const m of EXPORT_MODULES) await page.route(`${LAB_URL}/__fsexport/${m}.js`, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: transpiled(m) }))
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
    const perf = () => page.evaluate(() => { const t = window.__fsTake.get(); const pf = t.take?.strokes?.[2]?.performed ?? t.performed?.[2] ?? null; return { pf: pf ? Array.from(pf) : null, keys: Object.keys(t).join(",") } })
    const p0 = await take(), pc0 = (await clock()).clock, pfA = await perf()
    await pickPreset("authenticDraw"); await settle(600)
    const p1 = await take(), pc1 = (await clock()).clock, pfB = await perf()
    await pickPreset("handDraw"); await settle(600)
    const p2 = await take(), pc2 = (await clock()).clock, pfC = await perf()
    const sl = (p) => (p.slots ? [p.slots[4], p.slots[5]] : null)
    const s0 = sl(p0), s1 = sl(p1), s2 = sl(p2)
    const d = (a, b) => (a && b ? Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1])) : Infinity)
    let followed = 0
    for (let i = 0; p0.slots && p1.slots && i < p0.slots.length / 2; i++) if (i !== 2 && Math.abs(p0.slots[i * 2 + 1] - p1.slots[i * 2 + 1]) > FRAME_MS) followed++
    const pfSame = !!pfA.pf && J(pfA.pf) === J(pfB.pf) && J(pfA.pf) === J(pfC.pf)
    row("perform", setOk && pc0 === "hand" && pc1 === "recorded" && pc2 === "hand" && d(s0, s1) <= 1 && d(s0, s2) <= 1 && pfSame && followed > 0,
      `set ${setOk}, clock ${pc0} -> ${pc1} -> ${pc2}, stroke 2 slot [${s0?.map((v) => v.toFixed(1))}] -> [${s1?.map((v) => v.toFixed(1))}] -> [${s2?.map((v) => v.toFixed(1))}] ms, worst ${Math.max(d(s0, s1), d(s0, s2)).toFixed(4)} ms, performed ${pfSame ? "identical" : `differs (${pfA.pf ? "" : "unread: " + pfA.keys})`}, ${followed} other strokes moved with the clock`)

    // R11: a fresh logo under Hand, no rows, through the real picker. Under Hand
    // a slot runs to the next stroke's landing, so the lifts sit inside the slots
    // and the move has to read the pace's holds (HAND-DRAW-P3). The bar: the
    // move is offered, and its azimuth keys turn in exactly the stamped lifts of
    // 120 ms or more (stampPenClock's lifts / rate), each end within one frame.
    {
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys); await settle(1200)
    await pickPreset("handDraw"); await settle(600)
    await page.evaluate(() => window.__fsTake.clear()); await settle(400)
    const cl = await clock()
    const rate = cl.rate
    const st = PR.stampPenClock(cl.rawRecorded ?? [], "lognormal", { nibDiameter: DD_NIB })
    const gapsOf = (w) => { w = w.slice().sort((a, b) => a[0] - b[0]); const g = []; let e = w[0][1]; for (let i = 1; i < w.length; i++) { if (w[i][0] > e) g.push([e, w[i][0]]); e = Math.max(e, w[i][1]) } return g }
    const want = st.length ? gapsOf(st.map((q) => { const pts = q.points ?? q; return [pts[0].t / rate, pts[pts.length - 1].t / rate] })) : []
    const clear = want.filter(([a, b]) => b - a >= 120)
    if ((await page.evaluate(() => document.querySelector("[data-key-lanes]")?.getAttribute("data-open"))) !== "1") { await page.locator("[data-key-lanes]").first().click().catch(() => {}); await settle(400) }
    const k0 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__fsKeys?.() ?? {})))
    await page.locator("[data-camera-picker]").first().click().catch(() => {}); await settle(400)
    const opt = await page.evaluate(() => { const b = document.querySelector("[data-camera-move='orbit-lifts']"); return b ? { refused: b.getAttribute("data-refused") === "1", reason: b.querySelector("[data-camera-reason]")?.textContent ?? "" } : null })
    if (opt && !opt.refused) { await page.locator("[data-camera-move='orbit-lifts']").first().click().catch(() => {}); await settle(400) }
    const k1 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__fsKeys?.() ?? {})))
    const az = k1.azimuth ?? []
    const turns = []; for (let i = 0; i + 1 < az.length; i++) if (az[i + 1].value !== az[i].value) turns.push([az[i].tMs, az[i + 1].tMs])
    let worst = turns.length === clear.length && clear.length > 0 ? 0 : Infinity
    for (let i = 0; i < turns.length && i < clear.length; i++) worst = Math.max(worst, Math.abs(turns[i][0] - clear[i][0]), Math.abs(turns[i][1] - clear[i][1]))
    writeFileSync(`${OUT}lifts-under-hand${mutate ? "-" + mutate : ""}.json`, J({ rate, stampedLiftsMs: want.map(([a, b]) => [+a.toFixed(2), +b.toFixed(2)]), clear, turns, offered: opt, azimuthBefore: k0.azimuth ?? null }, null, 2))
    row("lifts", cl.clock === "hand" && !!opt && !opt.refused && worst <= FRAME_MS,
      `rate ${rate}, ${want.length} stamped lifts [${want.map(([a, b]) => (b - a).toFixed(0)).join(" ")}] ms, ${clear.length} of 120 ms or more; move ${opt ? (opt.refused ? `refused: ${opt.reason.slice(0, 90)}` : "offered") : "not found"}; ${turns.length} turns [${turns.map(([a, b]) => `${a.toFixed(1)}-${b.toFixed(1)}`).join(" ")}], worst end ${Number.isFinite(worst) ? worst.toFixed(3) : "n/a"} ms`)
    // The move's keys turn the camera in the lifts; R12 and R13 read frames there.
    await page.evaluate(() => window.__fsSetKeys?.(undefined)); await settle(300)
    }
    // R12: export under Hand against live, no rows and then a timed take
    // (the last stroke at half speed, so the take outruns the pen). The export plans
    // its film over `getTotalDuration()`, the length the page's own export
    // passes (`exportMs`), and grabs each frame from the live scene; the live
    // arm seeks each of EXPORT_CLOCKS plan frames at its time over the take the
    // page plays. Must-fail `exportpen`: the export is handed pen time.
    {
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys); await settle(1200)
    await pickPreset("handDraw"); await settle(600)
    const arm = async (rowsK) => {
      await page.evaluate((r) => { window.__fsTake.clear(); if (r) window.__fsTake.set(r) }, rowsK); await settle(800)
      if (mutate === "exportpen") { await page.evaluate(() => window.__fsTake.knockout("exportpen")); await settle(400) }
      const live = await page.evaluate(() => { const t = window.__fsTake.get(); return { takeMs: t.totalDuration, penMs: t.penMs, timed: !!t.timed } })
      const r = await page.evaluate(async ([takeMs, nClocks]) => {
        const mod = await import("/__fsexport/index.js")
        const rh = window.__revealHarness, ch = window.__captureHarness
        const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
        const h = async (s) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))).slice(0, 8).join(".")
        const D = rh.getTotalDuration()
        const film = []
        const host = {
          seek: async (p) => rh.setProgress(p),
          easePlayhead: (c) => rh.ease(c, "linear"),
          settle,
          async grabFrame() { const url = ch.grab(); film.push(await h(url)); const gi = ch.grabInfo(); return { kind: "blob", blob: await (await fetch(url)).blob(), width: gi.width, height: gi.height } },
        }
        const res = await mod.exportAnimation({ host, penDurationMs: D, timebase: "pen", fps: 8, scale: 1, transparent: false, format: "apng", holdMs: 250, markName: "hand" })
        const clocks = res.plan.frames.map((f) => f.clock)
        const f = film.slice(film.length - clocks.length)
        const pick = Array.from({ length: nClocks }, (_, k) => Math.round((k * (clocks.length - 1)) / (nClocks - 1)))
        const out = []
        for (const i of pick) {
          const ms = clocks[i] * D
          rh.setProgress(Math.min(1, Math.max(0, ms / takeMs)))
          await new Promise((r) => setTimeout(r, 120)); await settle()
          out.push({ i, ms: Math.round(ms), same: (await h(ch.grab())) === f[i] })
        }
        return { D, n: clocks.length, out }
      }, [live.takeMs, EXPORT_CLOCKS])
      if (mutate === "exportpen") { await page.evaluate(() => window.__fsTake.knockout(null)); await settle(200) }
      return { ...r, ...live, same: r.out.filter((o) => o.same).length }
    }
    const A = await arm(null)
    const B = await arm({ [polys.length - 1]: { delayMs: 0, speed: 0.5, ease: { kind: "preset", id: "linear" }, holdBack: false } })
    await page.evaluate(() => window.__fsTake.clear()); await settle(400)
    const ok = (x) => x.out.length === EXPORT_CLOCKS && x.same === EXPORT_CLOCKS && Math.abs(x.D - x.takeMs) < 1e-6
    const txt = (x, tag) => `${tag}: ${x.same}/${x.out.length} clocks equal live (of ${x.n} frames), film ${x.D.toFixed(1)} ms vs take ${x.takeMs.toFixed(1)} ms, pen ${x.penMs.toFixed(1)}, timed ${x.timed}${x.same < x.out.length ? `, differ at ${x.out.filter((o) => !o.same).map((o) => o.ms).join(" ")} ms` : ""}`
    row("export", ok(A) && ok(B) && !A.timed && B.timed && B.takeMs > B.penMs + 1 && Math.abs(A.D - TARGET_MS) <= FRAME_MS, `${txt(A, "no rows")}; ${txt(B, "last stroke at 0.5x")}`)
    }
    // R13: Inflate's tip in the lifts under a timed take (+1 ms on the last
    // stroke, which moves nothing else). With no rows the tip reads the beat,
    // which the pace holds flat in a lift; under a take it reads the take's
    // clock, which runs on, and the tip crept 5 to 61 px per lift until the
    // frame loop held it at each lift's start (HAND-DRAW-P3). Five frames from
    // 2 ms after the lift to 2 ms before the landing; the control is the same
    // span inside the stroke before it. Must-fail `tip-no-liftholds`.
    {
    await page.evaluate((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys); await settle(1200)
    await pickPreset("handDraw"); await settle(600)
    await page.evaluate(() => { window.__styleHarness.setMode("inflate"); window.__styleHarness.setInflate({ fusion: "auto" }) }); await settle(2500)
    const cl = await clock()
    await page.evaluate((i) => window.__fsTake.set({ [i]: { delayMs: 1, speed: 1, ease: { kind: "preset", id: "linear" }, holdBack: false } }), cl.clocked.length - 1); await settle(1500)
    const rect = await glRect()
    const grabPx = async (ms) => {
      const total = await page.evaluate(() => window.__revealHarness.getTotalDuration())
      await page.evaluate((p) => window.__revealHarness.setProgress(p), ms / total); await settle(200)
      return sharp(await page.screenshot({ clip: rect })).raw().toBuffer()
    }
    const diffPx = (A, B) => { let n = 0; for (let k = 0; k < A.length; k += 3) if (A[k] !== B[k] || A[k + 1] !== B[k + 1] || A[k + 2] !== B[k + 2]) n++; return n }
    const out = []
    for (let i = 0; i + 1 < cl.clocked.length; i++) {
      const a0 = cl.clocked[i], b0 = cl.clocked[i + 1], t0 = a0[a0.length - 1].t, t1 = b0[0].t
      if (t1 - t0 < 50) continue
      const a = t0 + 2, b = t1 - 2, ref = await grabPx(a)
      let creep = 0
      for (let k = 1; k <= 4; k++) creep = Math.max(creep, diffPx(ref, await grabPx(a + ((b - a) * k) / 4)))
      const c0 = Math.max(a0[0].t, t0 - (b - a) - 2)
      out.push({ after: i, ms: t1 - t0, creep, control: diffPx(await grabPx(c0), await grabPx(c0 + (b - a))) })
    }
    const timed = await page.evaluate(() => !!window.__fsTake.get().timed)
    await page.evaluate(() => { window.__fsTake.clear(); window.__styleHarness.setMode("rod") }); await settle(800)
    row("tip", timed && out.length > 0 && out.every((r) => r.creep === 0 && r.control > 0),
      `timed ${timed}, ${out.length} lifts of 50 ms or more; px changed across each lift [${out.map((r) => r.creep).join(" ")}], worst ${Math.max(0, ...out.map((r) => r.creep))}; controls [${out.map((r) => r.control).join(" ")}]`)
    }
    rows.errors = errors.slice(0, 3)
  } catch (e) {
    rows.crash = String(e).slice(0, 300); console.log(`CRASH ${mutate ?? "real"}: ${rows.crash}`)
  } finally { await ctx.close() }
  return rows
}

const real = await run(null)
const mf = {}
// A row may name more than one knockout; it counts as fired only when every one turns it red.
if (!FILM) for (const [k, ms] of Object.entries(MUST_FAIL)) {
  const each = []
  for (const m of [ms].flat()) { const r = await run(m); each.push({ mutate: m, fired: r[k] ? !r[k].ok : false, detail: r[k]?.detail ?? r.crash ?? "row not reached" }) }
  mf[k] = { mutate: each.map((e) => e.mutate).join(" + "), fired: each.every((e) => e.fired), detail: each.map((e) => `${e.mutate}: ${e.fired ? "red" : "GREEN"}, ${e.detail}`).join(" | ") }
}
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
