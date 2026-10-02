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
{
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
{
  const r = await film(null)
  if (r.error) row("L2", "the exported film changes with the keyed textureIntensity", false, r.error)
  else row("L2", "the exported film changes with the keyed textureIntensity", r.ramp >= 10 && r.rho >= 0.9 && r.held >= 15 && r.heldSpread <= 1.5,
    `film ${r.dur.toFixed(2)} s, ${r.ramp} frames on the ramp with rank correlation ${r.rho.toFixed(3)}, past the last key ${r.held.toFixed(2)} levels (spread ${r.heldSpread.toFixed(2)}); ${r.out.map((x) => `${x.t.toFixed(2)}s:${x.diff.toFixed(1)}`).join(" ")}`)
  const m = await film("memo")
  if (m.error) fired("L2", "the frame loop fed the doc's styleState", false, m.error)
  else fired("L2", "the frame loop fed the doc's styleState", m.maxDiff < 5, `largest change ${m.maxDiff.toFixed(2)} levels over the film`)
}

row("G1", "the pages threw nothing", errors.length === 0, errors.length ? errors.slice(0, 3).join(" | ") : "0 pageerror events")
await browser.close()
console.log(`\n${pass} PASS · ${fail} FAIL`)
process.exit(fail ? 1 : 0)
