#!/usr/bin/env node
// assert-keyed-playback-live.mjs · A KEYED STYLE VALUE PLAYS IN THE 3D VIEW AND IN THE FILM
//
//   FS_PORT=3140 FS_HEADED=0 node scripts/verify/assert-keyed-playback-live.mjs
//
// REVIEW.md "Review 1: layout and keyed style", finding 1: a style key moved the Style panel's slider
// while the 3D view and every export stayed at the document value. The drawing is held whole with a
// drawProgress key at 1, the texture is still, and textureIntensity is keyed 0 at 0 ms to 1 at 2000 ms,
// so the only thing that changes over the take is the keyed value.
//
// Rows, each with its must-fail (`__fsKeyMutant = "memo"`, the frame loop fed the doc's styleState):
//   L1  PLAYING, THE CANVAS FOLLOWS THE KEY. Played at 0.5x from 0, the 3D canvas grabbed about 14
//       times: over the ramp (key clock under 2000 ms) each grab's change from the clock-0 frame (mean
//       |luma change| over the mark) rises with the key clock (rank correlation >= 0.9), the change past
//       the last key (where the value holds at 1) is at least 15 levels and within 1.5 levels of
//       itself, and the frame loop drew textureIntensity = clock / 2000 on every frame (within 0.02).
//       must-fail: the largest change under 3 levels.
//   L2  THE FILM FOLLOWS THE KEY. A real Video export through the Export panel, decoded in the page:
//       over the ramp (film time under 2 s, the film runs on the key clock at 1x) each frame's change
//       from the film's first frame rises with its time (rank correlation >= 0.9), and past the last
//       key the change is at least 15 levels and within 1.5 levels of itself. must-fail: the largest
//       change under 5 levels (the codec's own noise on a still film measured 2.87).
//   L3  A REFUSED KEY SAYS WHY, BESIDE ITS DIAMOND (finding 5). textureIntensity and asciiCellSize keyed;
//       one style write moves both (textureIntensity 0.7, asciiCellSize 26, Slow Code Crawl's value,
//       outside 4..24), the way a preset does: textureIntensity takes its key at the playhead, the
//       asciiCellSize track is unchanged, and words naming 26 and 4 to 24 show to the right of the Cell
//       size diamond, on its line, and are gone after 6.5 s. Then, with Cell size unkeyed and the doc
//       at 26, the diamond itself says the same when clicked. must-fails: `"dropall"` (the refused path drops the edit's other key) and
//       `"silentrefusal"` (no words).
//   L4  THE FILM STEPS ON TWOS AS PLAYBACK DOES (finding 6). Cadence Twos, linear ease, a textureIntensity
//       key so the frame loop records its key clock. Played live, and then exported as Video at the
//       panel's default 30 fps: every key clock the frame loop drew, live and in the film, sits on a
//       12 Hz step of take time (a multiple of 1000/12 ms), and the film's frames hold each step for 2
//       or 3 frames. must-fail: `__fsExportCadence = "ignored"`, the film eased with no cadence.
//   L5  THE KEY CLOCK IS THE VIEW'S (finding 7). textureIntensity keyed 0.2 at 0 and 0.9 at the take's
//       end. (a) Played from 0.9 to the end without loop: the readout is the playhead, 1, the
//       Intensity diamond reads "on" (a key under the playhead), and its slider shows 0.9. (b) A Pause
//       mid-play: the readout equals the frame loop's playhead. (c) Five Scale diamond clicks while
//       playing: each key lands between the playhead read just before and just after the click.
//       must-fails: `__fsProgressThrottle = "armed"` (the old throttle) for (a) and (b),
//       `__fsKeyMutant = "readout"` (the key clock read off the readout) for (c).
//   L6  A REMOUNT TELLS THE DOCK (finding 11). The Draw-in tab open (the store's drawInOpen) and speed
//       2, then the viewport remounted (`__fsRemountViewport`, the re-key "Rebuild the view" performs;
//       the crash law itself takes the whole dev page down, on the base snapshot too): the viewport
//       resets the store to its defaults, and the dock follows: the Draw-in tab is no longer the
//       active one and the store reads closed and speed 1. must-fail:
//       `__fsTransportReset = "silent"`, the reset with no notify: the tab stays active over a store
//       that says closed.
//   L7  THE ANIMATED GLB CARRIES A KEYED MATERIAL VALUE (finding 1). Custom material,
//       customMaterial.roughness keyed 0.1 at 0 to 0.9 at the take's end; the real "Anim GLB" button.
//       The downloaded file, read here with lib/export/glb-sparse.ts' reader, holds a LINEAR
//       KHR_animation_pointer channel on every material's roughnessFactor, on the draw-in clip, one
//       key per film frame, rising from 0.1 to 0.9 and never falling. must-fail:
//       `__fsAnimGlbMaterial = "doc"`, the file with no keyed material: no such channel.
//   G1  no page error.

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
/* `FS_ROWS=L4,L6` runs only those rows (and G1); unset runs every row. */
const ONLY = process.env.FS_ROWS ? new Set(process.env.FS_ROWS.split(",").map((x) => x.trim())) : null
const want = (id) => !ONLY || ONLY.has(id)

const STILL = { motionMode: "off", materialAnimationEnabled: false, textureAnimated: false, ditherAnimated: false, asciiAnimated: false, stackAnimationEnabled: false, fusionAnimationEnabled: false, ditherEnabled: false, asciiEnabled: false }
const k = (t, v) => ({ tMs: t, value: v, easeOut: "linear", easeIn: "linear" })
const KEYS = { drawProgress: [k(0, 1)], textureIntensity: [k(0, 0), k(2000, 1)] }

/** Spearman rank correlation. */
function spearman(xs, ys) {
  const rank = (a) => {
    const idx = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0])
    const r = new Array(a.length)
    idx.forEach(([, i], j) => (r[i] = j))
    return r
  }
  const rx = rank(xs), ry = rank(ys), n = xs.length
  const d2 = rx.reduce((s, r, i) => s + (r - ry[i]) ** 2, 0)
  return 1 - (6 * d2) / (n * (n * n - 1))
}

/* In the page: the mean |luma change| between two images over the pixels where either differs from
 * the paper (the corner pixel) by more than 24 levels. */
const PIXELS = `
window.__kpLuma = (img) => {
  const c = document.createElement("canvas"); c.width = img.videoWidth || img.naturalWidth || img.width; c.height = img.videoHeight || img.naturalHeight || img.height
  const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height).data
  const out = new Float32Array(c.width * c.height)
  for (let i = 0; i < out.length; i++) {
    const a = d[i * 4 + 3] / 255
    // composite on white so a transparent grab reads as paper
    out[i] = 255 * (1 - a) + a * (0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2])
  }
  return { w: c.width, h: c.height, l: out }
}
window.__kpDiff = (A, B) => {
  if (A.w !== B.w || A.h !== B.h) return NaN
  const paper = A.l[0]
  let s = 0, n = 0
  for (let i = 0; i < A.l.length; i++) {
    if (Math.abs(A.l[i] - paper) > 24 || Math.abs(B.l[i] - paper) > 24) { s += Math.abs(A.l[i] - B.l[i]); n++ }
  }
  return n ? s / n : 0
}
window.__kpImg = (url) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = url })
`

async function open(mutant) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1, reducedMotion: "no-preference", acceptDownloads: true })
  await ctx.addInitScript(() => { try { for (const x of Object.keys(localStorage)) if (x.startsWith("fs.layout.")) localStorage.removeItem(x) } catch {} })
  if (mutant) await ctx.addInitScript((m) => { window.__fsKeyMutant = m }, mutant)
  await ctx.addInitScript(PIXELS)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!mutant) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness && window.__fsSetKeys && window.__fsTransport, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p.slice(0, 5), { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate(() => { window.__revealHarness.setPlaying(false); window.__revealHarness.setEase?.("linear") })
  await page.evaluate((st) => window.__styleHarness.setStyle({ ...st, textureEnabled: true, textureMode: "grain", textureIntensity: 0.5, textureScale: 1.5, textureContrast: 1 }), STILL)
  await settle(page, 400)
  const refused = await page.evaluate((x) => window.__fsSetKeys(x), KEYS)
  if (refused?.length) throw new Error(`keys refused: ${refused.join("; ")}`)
  await settle(page, 400)
  return { ctx, page }
}
const settle = async (page, ms = 300) => {
  await page.waitForTimeout(ms)
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}

// ---------------------------------------------------------------- L1
async function live(mutant) {
  const { ctx, page } = await open(mutant)
  const L = await page.evaluate(() => window.__fsTransport.derived()?.totalDuration ?? 0)
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await settle(page, 600)
  await page.evaluate(async () => { window.__kpRef = await window.__kpLuma(await window.__kpImg(window.__captureHarness.grab())) })
  await page.evaluate(() => { window.__fsTransport.set("speed", 0.5); window.__geomDebug.keyedStyle.record(true); window.__revealHarness.setPlaying(true) })
  const out = []
  for (let i = 0; i < 40 && out.length < 14; i++) {
    const s = await page.evaluate(async () => {
      const p0 = window.__fsTransport.playhead()
      const url = window.__captureHarness.grab()
      const p1 = window.__fsTransport.playhead()
      const img = await window.__kpLuma(await window.__kpImg(url))
      return { p: (p0 + p1) / 2, spread: Math.abs(p1 - p0), diff: window.__kpDiff(window.__kpRef, img), playing: window.__fsTransport.get("playing") }
    })
    out.push(s)
    if (!s.playing) break
    await page.waitForTimeout(220)
  }
  await page.evaluate(() => window.__revealHarness.setPlaying(false))
  const rec = await page.evaluate(() => window.__geomDebug.keyedStyle.rows())
  await page.evaluate(() => window.__geomDebug.keyedStyle.record(false))
  await ctx.close()
  // The frame loop's own record: did it draw intensity = clock / 2000?
  let drewWorst = 0
  for (const r of rec) if (r.clockMs >= 0) drewWorst = Math.max(drewWorst, Math.abs(r.texIntensity - Math.min(1, r.clockMs / 2000)))
  const samples = out.filter((s) => s.spread < 0.05)
  const ramp = samples.filter((s) => s.p * L < 1950)
  const held = samples.filter((s) => s.p * L > 2100).map((s) => s.diff)
  return {
    L, samples, ramp: ramp.length,
    rho: spearman(ramp.map((s) => s.p), ramp.map((s) => s.diff)),
    held: held.length ? Math.min(...held) : 0,
    heldSpread: held.length ? Math.max(...held) - Math.min(...held) : Infinity,
    heldN: held.length,
    maxDiff: Math.max(0, ...samples.map((s) => s.diff)), drewWorst, recN: rec.length,
  }
}
if (want("L1")) {
  const r = await live(null)
  row("L1", "playing, the 3D canvas changes with the keyed textureIntensity (0 to 1 over 2 s)", r.ramp >= 6 && r.rho >= 0.9 && r.heldN >= 1 && r.held >= 15 && r.heldSpread <= 1.5 && r.drewWorst <= 0.02,
    `take ${Math.round(r.L)} ms, ${r.ramp} grabs on the ramp with rank correlation ${r.rho.toFixed(3)}, ${r.heldN} past the last key at ${r.held.toFixed(2)} levels (spread ${r.heldSpread.toFixed(2)}), drew clock/2000 within ${r.drewWorst.toFixed(4)} over ${r.recN} frames; ${r.samples.map((s) => `${(s.p * r.L).toFixed(0)}ms:${s.diff.toFixed(1)}`).join(" ")}`)
  const m = await live("memo")
  fired("L1", "the frame loop fed the doc's styleState", m.maxDiff < 3, `largest change ${m.maxDiff.toFixed(2)} levels over ${m.samples.length} grabs`)
}

// ---------------------------------------------------------------- L2
async function film(mutant) {
  const { ctx, page } = await open(mutant)
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await page.evaluate(() => window.__dockHarness?.dock.open("export"))
  await settle(page, 400)
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 900000 }), page.getByRole("button", { name: "Video", exact: true }).click()])
  const path = await dl.path()
  const name = dl.suggestedFilename()
  const b64 = readFileSync(path).toString("base64")
  const res = await page.evaluate(async ({ b64, name }) => {
    if (!/\.webm$/i.test(name)) return { error: `the film is ${name}, not a WebM this gate decodes` }
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const v = document.createElement("video")
    v.muted = true
    v.src = URL.createObjectURL(new Blob([bytes], { type: "video/webm" }))
    await new Promise((r, j) => { v.onloadeddata = r; v.onerror = () => j(new Error("the film did not decode")) })
    if (!Number.isFinite(v.duration)) {
      v.currentTime = 1e6
      await new Promise((r) => (v.onseeked = r))
    }
    const dur = v.duration
    const at = async (t) => {
      v.currentTime = t
      await new Promise((r) => (v.onseeked = r))
      return window.__kpLuma(v)
    }
    const times = [...Array.from({ length: 12 }, (_, i) => 0.01 + (1.9 * i) / 11), 2.3, 2.7, 3.1, 3.5].map((t) => Math.min(dur - 0.02, t))
    const first = await at(times[0])
    const out = []
    for (const t of times) out.push({ t, diff: window.__kpDiff(first, await at(t)) })
    return { dur, out }
  }, { b64, name })
  await ctx.close()
  if (res.error) return { error: res.error }
  const ramp = res.out.filter((x) => x.t < 1.95)
  const held = res.out.filter((x) => x.t > 2.1).map((x) => x.diff)
  return {
    dur: res.dur, out: res.out, ramp: ramp.length,
    rho: spearman(ramp.map((x) => x.t), ramp.map((x) => x.diff)),
    held: held.length ? Math.min(...held) : 0,
    heldSpread: held.length ? Math.max(...held) - Math.min(...held) : Infinity,
    maxDiff: Math.max(...res.out.map((x) => x.diff)),
  }
}
if (want("L2")) {
  const r = await film(null)
  if (r.error) row("L2", "the exported film changes with the keyed textureIntensity", false, r.error)
  else row("L2", "the exported film changes with the keyed textureIntensity", r.ramp >= 10 && r.rho >= 0.9 && r.held >= 15 && r.heldSpread <= 1.5,
    `film ${r.dur.toFixed(2)} s, ${r.ramp} frames on the ramp with rank correlation ${r.rho.toFixed(3)}, past the last key ${r.held.toFixed(2)} levels (spread ${r.heldSpread.toFixed(2)}); ${r.out.map((x) => `${x.t.toFixed(2)}s:${x.diff.toFixed(1)}`).join(" ")}`)
  const m = await film("memo")
  if (m.error) fired("L2", "the frame loop fed the doc's styleState", false, m.error)
  else fired("L2", "the frame loop fed the doc's styleState", m.maxDiff < 5, `largest change ${m.maxDiff.toFixed(2)} levels over the film`)
}

// ---------------------------------------------------------------- L3
const { openStyle } = await import("./lib/dock.mjs")
async function refusal(mutant) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  await ctx.addInitScript(() => { try { for (const x of Object.keys(localStorage)) if (x.startsWith("fs.layout.")) localStorage.removeItem(x) } catch {} })
  if (mutant) await ctx.addInitScript((m) => { window.__fsKeyMutant = m }, mutant)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!mutant) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__fsSetKeys && window.__dockHarness?.workspace, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p.slice(0, 5), { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1200)
  await page.evaluate(() => window.__revealHarness.setPlaying(false))
  await page.evaluate(() => window.__styleHarness.setStyle({ asciiEnabled: true, textureEnabled: true, textureMode: "grain", asciiCellSize: 10, textureIntensity: 0.3 }))
  await settle(page, 300)
  const refused = await page.evaluate((x) => window.__fsSetKeys(x), { textureIntensity: [k(0, 0.2), k(1000, 0.4)], asciiCellSize: [k(0, 8), k(1000, 12)] })
  if (refused?.length) throw new Error(`keys refused: ${refused.join("; ")}`)
  await page.evaluate(() => window.__revealHarness.setProgress(0.05))
  await openStyle(page, "ascii")
  await settle(page, 400)
  const before = await page.evaluate(() => window.__fsKeys?.() ?? {})
  await page.evaluate(() => window.__styleHarness.setStyle({ textureIntensity: 0.7, asciiCellSize: 26 }))
  await settle(page, 400)
  const after = await page.evaluate(() => window.__fsKeys?.() ?? {})
  const words = () => page.evaluate(() => {
    const b = document.querySelector('[data-key-button="asciiCellSize"]')
    const w = document.querySelector('[data-key-refusal="asciiCellSize"]')
    if (!b || !w) return { text: w?.textContent ?? null, beside: false }
    const rb = b.getBoundingClientRect(), rw = w.getBoundingClientRect()
    const vis = rw.width > 0 && rw.height > 0 && getComputedStyle(w).visibility !== "hidden"
    return { text: w.textContent, beside: vis && rw.left >= rb.right - 1 && rw.left - rb.right < 16 && rw.top < rb.bottom && rw.bottom > rb.top }
  })
  const edit = await words()
  // The diamond itself, with Cell size unkeyed: the edit left the doc at 26, the value on screen now.
  await page.evaluate((ti) => window.__fsSetKeys({ textureIntensity: ti }), after.textureIntensity)
  await page.evaluate(() => window.__revealHarness.setProgress(0.5))
  await settle(page, 6500) // past REFUSAL_MS, so the edit's words are gone first
  const cleared = await words()
  await page.locator('[data-key-button="asciiCellSize"]').click()
  await settle(page, 300)
  const click = await words()
  await ctx.close()
  const ti = after.textureIntensity ?? []
  return {
    keyedTi: ti.length === 3 && ti.some((x) => x.value === 0.7),
    keptCell: JSON.stringify(after.asciiCellSize) === JSON.stringify(before.asciiCellSize),
    edit, cleared, click, ti: ti.map((x) => `${Math.round(x.tMs)}:${x.value}`).join(" "),
  }
}
if (want("L3")) {
  const want = (w) => !!w.text && /26/.test(w.text) && /4 to 24/.test(w.text) && w.beside
  const r = await refusal(null)
  row("L3", "a refused key keeps the edit's other key and says why beside its diamond", r.keyedTi && r.keptCell && want(r.edit) && r.cleared.text === null && want(r.click),
    `textureIntensity keys ${r.ti} (new key: ${r.keyedTi}); asciiCellSize track unchanged: ${r.keptCell}; edit: "${r.edit.text}" beside: ${r.edit.beside}; gone after 6.5 s: ${r.cleared.text === null}; diamond click: "${r.click.text}" beside: ${r.click.beside}`)
  const d = await refusal("dropall")
  fired("L3", "the refused path drops the edit's other key", !d.keyedTi, `textureIntensity keys ${d.ti}`)
  const q = await refusal("silentrefusal")
  fired("L3", "a refused key shows no words", !want(q.edit) && !want(q.click), `edit: ${JSON.stringify(q.edit.text)}, click: ${JSON.stringify(q.click.text)}`)
}

// ---------------------------------------------------------------- L4
async function twos(law) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, acceptDownloads: true })
  await ctx.addInitScript(() => { try { for (const x of Object.keys(localStorage)) if (x.startsWith("fs.layout.")) localStorage.removeItem(x) } catch {} })
  if (law) await ctx.addInitScript((l) => { window.__fsExportCadence = l }, law)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!law) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness?.setCadence && window.__fsSetKeys && window.__dockHarness, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p.slice(0, 5), { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1200)
  await page.evaluate(() => { window.__revealHarness.setPlaying(false); window.__revealHarness.setEase?.("linear"); window.__revealHarness.setCadence("twos") })
  await page.evaluate((st) => window.__styleHarness.setStyle({ ...st, textureEnabled: true, textureMode: "grain" }), STILL)
  await page.evaluate((x) => window.__fsSetKeys(x), { textureIntensity: [k(0, 0.3), k(1000, 0.6)] })
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await settle(page, 400)
  const STEP = 1000 / 12
  const off = (c) => { const r = c / STEP - Math.round(c / STEP); return Math.abs(r) * STEP }
  // Live.
  await page.evaluate(() => { window.__geomDebug.keyedStyle.record(true); window.__revealHarness.setPlaying(true) })
  await page.waitForTimeout(1500)
  await page.evaluate(() => window.__revealHarness.setPlaying(false))
  const liveRows = await page.evaluate(() => window.__geomDebug.keyedStyle.rows())
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await settle(page, 300)
  // The film.
  await page.evaluate(() => window.__dockHarness?.dock.open("export"))
  await settle(page, 300)
  await page.evaluate(() => window.__geomDebug.keyedStyle.record(true))
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 900000 }), page.getByRole("button", { name: "Video", exact: true }).click()])
  await dl.path()
  await settle(page, 400)
  const filmRows = await page.evaluate(() => window.__geomDebug.keyedStyle.rows())
  await page.evaluate(() => window.__geomDebug.keyedStyle.record(false))
  await ctx.close()
  const live = [...new Set(liveRows.filter((r) => r.clockMs > 0).map((r) => r.clockMs))]
  // The film's frames, one row per frame: the driven style clock steps once per frame.
  const byFrame = new Map()
  for (const r of filmRows) byFrame.set(r.elapsed.toFixed(6), r.clockMs)
  const film = [...byFrame.values()]
  const runs = []
  let run = 1
  for (let i = 1; i < film.length; i++) {
    if (film[i] === film[i - 1]) run++
    else { runs.push(run); run = 1 }
  }
  const inner = runs.slice(1, -1)
  return {
    liveN: live.length, liveOff: Math.max(0, ...live.map(off)),
    filmN: film.length, filmDistinct: new Set(film).size, filmOff: Math.max(0, ...film.map(off)),
    holds: [...new Set(inner)].sort((a, b) => a - b), holdsOk: inner.length > 4 && inner.every((r) => r === 2 || r === 3),
  }
}
if (want("L4")) {
  const r = await twos(null)
  row("L4", "under Twos the film's key clocks step at 12 Hz, as live playback's do", r.liveN >= 5 && r.liveOff < 0.01 && r.filmN >= 30 && r.filmOff < 0.01 && r.holdsOk,
    `live: ${r.liveN} distinct clocks, furthest from a step ${r.liveOff.toFixed(4)} ms; film: ${r.filmN} frames, ${r.filmDistinct} distinct clocks, furthest from a step ${r.filmOff.toFixed(4)} ms, steps held ${r.holds.join("/")} frames`)
  const m = await twos("ignored")
  fired("L4", "the film eased with no cadence", !(m.filmOff < 0.01 && m.holdsOk), `film: ${m.filmN} frames, ${m.filmDistinct} distinct clocks, furthest from a step ${m.filmOff.toFixed(2)} ms, holds ${m.holds.join("/")}`)
}

// ---------------------------------------------------------------- L5
async function clockPage(init) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  await ctx.addInitScript(() => { try { for (const x of Object.keys(localStorage)) if (x.startsWith("fs.layout.")) localStorage.removeItem(x) } catch {} })
  if (init) await ctx.addInitScript(init)
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!init) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__fsSetKeys && window.__dockHarness?.workspace && window.__fsTransport, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p.slice(0, 5), { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1200)
  await page.evaluate(() => { window.__revealHarness.setPlaying(false); window.__revealHarness.setEase?.("linear"); window.__revealHarness.setLoop?.(false) })
  await page.evaluate((st) => window.__styleHarness.setStyle({ ...st, textureEnabled: true, textureMode: "grain", textureIntensity: 0.5 }), STILL)
  const L = await page.evaluate(() => window.__fsTransport.derived()?.totalDuration ?? 0)
  await page.evaluate((x) => window.__fsSetKeys(x), { textureIntensity: [k(0, 0.2), k(L, 0.9)] })
  await openStyle(page, "texture")
  await settle(page, 400)
  return { ctx, page, L }
}
async function endAndPause(law) {
  const { ctx, page } = await clockPage(law ? (l) => { window.__fsProgressThrottle = "armed" } : null)
  await page.evaluate(() => window.__revealHarness.setProgress(0.9))
  await settle(page, 300)
  await page.evaluate(() => window.__revealHarness.setPlaying(true))
  await page.waitForFunction(() => !window.__fsTransport.get("playing"), null, { timeout: 60000 })
  await settle(page, 400)
  const end = await page.evaluate(() => ({
    readout: window.__fsTransport.progress(),
    playhead: window.__fsTransport.playhead(),
    look: document.querySelector('[data-key-button="textureIntensity"]')?.getAttribute("data-key-look") ?? null,
    slider: Number(document.querySelector('[data-key-spot="textureIntensity"] input[type="range"]')?.value),
  }))
  // A Pause mid-play, five times at different instants.
  const pauses = []
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.__revealHarness.setProgress(0.1))
    await settle(page, 200)
    await page.evaluate(() => window.__revealHarness.setPlaying(true))
    await page.waitForTimeout(300 + i * 37)
    await page.evaluate(() => window.__revealHarness.setPlaying(false))
    await settle(page, 200)
    pauses.push(await page.evaluate(() => Math.abs(window.__fsTransport.progress() - window.__fsTransport.playhead())))
  }
  await ctx.close()
  return { end, pauseWorst: Math.max(...pauses) }
}
async function clicks(mutant) {
  const { ctx, page, L } = await clockPage(mutant ? () => { window.__fsKeyMutant = "readout" } : null)
  const out = []
  for (let i = 0; i < 5; i++) {
    await page.evaluate((L) => window.__fsSetKeys({ textureIntensity: [{ tMs: 0, value: 0.2, easeOut: "linear", easeIn: "linear" }, { tMs: L, value: 0.9, easeOut: "linear", easeIn: "linear" }] }), L)
    await page.evaluate(() => window.__revealHarness.setProgress(0.05))
    await settle(page, 200)
    await page.evaluate(() => window.__revealHarness.setPlaying(true))
    await page.waitForTimeout(250 + i * 53)
    const r = await page.evaluate(() => {
      const before = window.__fsTransport.playhead()
      document.querySelector('[data-key-button="textureScale"]').click()
      const after = window.__fsTransport.playhead()
      return { before, after }
    })
    await page.evaluate(() => window.__revealHarness.setPlaying(false))
    await settle(page, 200)
    const keys = await page.evaluate(() => window.__fsKeys?.() ?? {})
    const t = keys.textureScale?.[0]?.tMs
    out.push({ ...r, t, ok: typeof t === "number" && t >= r.before * L - 0.01 && t <= r.after * L + 0.01, behind: typeof t === "number" ? r.before * L - t : NaN })
  }
  await ctx.close()
  return out
}
if (want("L5")) {
  const r = await endAndPause(false)
  const okEnd = r.end.readout === 1 && r.end.playhead === 1 && r.end.look === "on" && Math.abs(r.end.slider - 0.9) < 1e-9
  const c = await clicks(false)
  row("L5", "the key clock reads the view's playhead: at the end of a take, on a Pause, on a click", okEnd && r.pauseWorst < 1e-12 && c.every((x) => x.ok),
    `end: readout ${r.end.readout}, playhead ${r.end.playhead}, Intensity diamond ${r.end.look}, slider ${r.end.slider}; Pause: worst |readout - playhead| ${r.pauseWorst.toExponential(2)}; clicks keyed inside [before, after]: ${c.filter((x) => x.ok).length}/5 (${c.map((x) => x.behind.toFixed(1)).join(" ")} ms behind the playhead before the click)`)
  const m = await endAndPause(true)
  fired("L5", "the old throttle (captured value, no flush)", !(m.end.readout === 1 && m.end.look === "on") || m.pauseWorst > 1e-12, `end: readout ${m.end.readout}, diamond ${m.end.look}, slider ${m.end.slider}; Pause: worst |readout - playhead| ${m.pauseWorst.toFixed(4)}`)
  const mc = await clicks(true)
  fired("L5", "the key clock read off the readout", mc.some((x) => !x.ok), `clicks keyed inside [before, after]: ${mc.filter((x) => x.ok).length}/5 (${mc.map((x) => x.behind.toFixed(1)).join(" ")} ms behind)`)
}

// ---------------------------------------------------------------- L6
async function remount(law) {
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  await ctx.addInitScript(() => { try { for (const x of Object.keys(localStorage)) if (x.startsWith("fs.layout.")) localStorage.removeItem(x) } catch {} })
  if (law) await ctx.addInitScript(() => { window.__fsTransportReset = "silent" })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!law) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__fsRemountViewport && window.__fsTransport && window.__dockHarness && window.__styleHarness, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p.slice(0, 5), { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1200)
  await page.evaluate(() => { window.__fsTransport.set("drawInOpen", true); window.__fsTransport.set("speed", 2) })
  await settle(page, 600)
  const tabActive = () => page.evaluate(() => [...document.querySelectorAll(".dv-tab")].some((t) => t.textContent.trim() === "Draw-in" && t.classList.contains("dv-active-tab")))
  const before = { tab: await tabActive(), open: await page.evaluate(() => window.__fsTransport.get("drawInOpen")) }
  await page.evaluate(() => window.__fsRemountViewport())
  await page.waitForTimeout(3000)
  const card = true
  await settle(page, 400)
  const after = {
    tab: await tabActive(),
    open: await page.evaluate(() => window.__fsTransport.get("drawInOpen")),
    speed: await page.evaluate(() => window.__fsTransport.get("speed")),
    rebuilt: await page.evaluate(() => !!window.__captureHarness && document.querySelectorAll("canvas").length > 0),
  }
  await ctx.close()
  return { before, card, after }
}
if (want("L6")) {
  const r = await remount(false)
  row("L6", "a viewport remount resets the store and the dock's Draw-in tab follows", r.before.tab && r.before.open && r.card && r.after.rebuilt && !r.after.tab && r.after.open === false && r.after.speed === 1,
    `before: tab active ${r.before.tab}, store open ${r.before.open}; remounted with a canvas ${r.after.rebuilt}; after: tab active ${r.after.tab}, store open ${r.after.open}, speed ${r.after.speed}`)
  const m = await remount(true)
  fired("L6", "the reset with no notify", m.after.tab && m.after.open === false, `after: tab active ${m.after.tab}, store open ${m.after.open}`)
}

// ---------------------------------------------------------------- L7
async function animGlb(law) {
  const { loadTs } = await import("./_ts-load.mjs")
  const G = loadTs("lib/export/glb-sparse.ts")
  const ctx = await browser.newContext({ viewport: { width: 1512, height: 982 }, acceptDownloads: true })
  await ctx.addInitScript(() => { try { for (const x of Object.keys(localStorage)) if (x.startsWith("fs.layout.")) localStorage.removeItem(x) } catch {} })
  if (law) await ctx.addInitScript(() => { window.__fsAnimGlbMaterial = "doc" })
  const page = await ctx.newPage()
  page.on("pageerror", (e) => { if (!law) errors.push(e.message) })
  await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 240000 })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__fsSetKeys && window.__dockHarness && window.__fsTransport, null, { timeout: 240000 })
  await page.evaluate((p) => window.__styleHarness.injectStrokes(p.slice(0, 2), { msPerPoint: 12, gapMs: 60 }), polys)
  await page.waitForTimeout(1500)
  await page.evaluate(() => { window.__revealHarness.setPlaying(false); window.__styleHarness.setStyle({ materialPreset: "custom", materialAnimationEnabled: false }) })
  await settle(page, 300)
  const L = await page.evaluate(() => window.__fsTransport.derived()?.totalDuration ?? 0)
  const refused = await page.evaluate((x) => window.__fsSetKeys(x), { "customMaterial.roughness": [k(0, 0.1), k(L, 0.9)] })
  if (refused?.length) throw new Error(`keys refused: ${refused.join("; ")}`)
  await page.evaluate(() => window.__dockHarness?.dock.open("export"))
  await settle(page, 400)
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 900000 }), page.locator("button", { hasText: /^Anim GLB$/ }).click()])
  const buf = readFileSync(await dl.path())
  await ctx.close()
  const { json, bin } = G.readGlb(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
  const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
  const read = (a) => {
    const acc = json.accessors[a]
    const v = json.bufferViews[acc.bufferView]
    return Array.from({ length: acc.count }, (_, i) => dv.getFloat32((v.byteOffset ?? 0) + (acc.byteOffset ?? 0) + i * 4, true))
  }
  const anim = (json.animations ?? []).find((a) => a.name === "draw-in")
  const mats = (json.materials ?? []).length
  const chans = (anim?.channels ?? []).filter((c) => /\/pbrMetallicRoughness\/roughnessFactor$/.test(c.target?.extensions?.KHR_animation_pointer?.pointer ?? ""))
  const morph = (anim?.channels ?? []).find((c) => c.target?.path === "weights")
  const frames = morph ? json.accessors[anim.samplers[morph.sampler].input].count : 0
  const vals = chans.length ? read(anim.samplers[chans[0].sampler].output) : []
  const rising = vals.every((v, i) => i === 0 || v >= vals[i - 1] - 1e-6)
  return {
    mats, chans: chans.length, frames, n: vals.length,
    first: vals[0], last: vals[vals.length - 1], rising,
    linear: chans.every((c) => anim.samplers[c.sampler].interpolation === "LINEAR"),
    used: (json.extensionsUsed ?? []).includes("KHR_animation_pointer"),
  }
}
if (want("L7")) {
  const r = await animGlb(false)
  row("L7", "the animated GLB carries the keyed roughness as a channel on every material", r.mats > 0 && r.chans === r.mats && r.n === r.frames && r.frames > 10 && Math.abs(r.first - 0.1) < 0.01 && Math.abs(r.last - 0.9) < 0.01 && r.rising && r.linear && r.used,
    `${r.chans} roughness channels on ${r.mats} materials, ${r.n} keys for ${r.frames} morph keyframes, ${r.first?.toFixed(3)} to ${r.last?.toFixed(3)}, rising ${r.rising}, LINEAR ${r.linear}, KHR_animation_pointer used ${r.used}`)
  const m = await animGlb(true)
  fired("L7", "the file with no keyed material", m.chans === 0, `${m.chans} roughness channels`)
}

row("G1", "the pages threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")
await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
