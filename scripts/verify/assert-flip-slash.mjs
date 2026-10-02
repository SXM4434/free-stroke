#!/usr/bin/env node
// assert-flip-slash.mjs · FLIP-3 · the flip on `/`, gated in the real page.
//
// FS_HEADED=0 FS_PORT=3139 node scripts/verify/assert-flip-slash.mjs [--record-base] [--strip --lab-film=<mp4>]
//   --strip writes strip-12.png: `/` from 0.5 s before the flip to f+28, above the lab's film at the same clocks
//
// --record-base  records the Off baseline from a server whose app, components,
//                lib, hooks and styles are clean, then records it AGAIN and
//                refuses unless both passes are identical. That second pass is
//                the positive control: a grid that is not repeatable cannot
//                call anything byte-identical.
//
// ROWS, each with a must-fail shown firing (BLIND if it does not):
//   1 OFF      after Flat to solid and back to Off: the take, the length, the
//              clock and the GL frame hash at 9 playheads equal the base.
//   2 POSE     Flat to solid: the folded pose (ink, depth, yaw, shade) at 32
//              clocks equals flipPoseAt, Object.is, with opts rebuilt HERE from
//              the lab's DEFAULT_HERO_MOTION, landYaw 0 (the lab's "shipped").
//   3 LENGTH   the length is max(takeLen, flip end), and past the pen the whole
//              draw-in stays drawn while the flip plays.
//   4 TURN     a Turn key overrides the flip's yaw; the flip keeps the ink.
//   5 EXPORT   the real Video export: every exported frame's pose equals
//              flipPoseAt at its clock, and 8 exported clocks, 4 in the settle
//              and 4 in the flip, replayed live give the same pose AND camera.
//   6 REVERSE  3D first equals flipPoseAt(solidToFlat) at the same 32 clocks.
//   7 UNDO     Cmd-Z after choosing Flat to solid puts the flip back to Off.
//   8 SETTLE   FLIP-6, his call: under Flat to solid the camera is his framing
//              before the settle, on the smoothstep halfway through it, and on
//              the lab's shipped view (sampleHeroMotion across its emerge,
//              az/el) within 0.5 degrees from the flip's frame 0 to f+28.
//   9 EDGE     the word's ink is at most 2 px wide at f+13 and f+14, like the
//              lab, and still there (not a blank frame).
//  10 KEYS     a Turn key leaves the camera on his framing; a camera key during
//              the settle wins over it.
//  11 REVERSE  3D first settles to the lab's view too (row 6 grades its turn).
//
// CORPUS: `/` and the Flip pills of the page's DrawInTimingControls, and the
// camera `__fsKeySample().camera` reads back (orbit controls). NOT seen:
// the viewport's own copy of that panel (no pills there, PANEL-5's hunk), and
// the exported frames' PIXELS (row 5 compares poses and clocks, not bytes).
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import { undock } from "./lib/undock.mjs"
import { serverCommit } from "./lib/server-commit.mjs"
import { loadTs } from "./_ts-load.mjs"
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
const OUT = join(ROOT, "docs/verification/flip-slash")
const BASE_FILE = join(OUT, "off-base.json")
const RECORD = process.argv.includes("--record-base")
const STRIP = process.argv.includes("--strip")
const LAB_FILM = (process.argv.find((a) => a.startsWith("--lab-film=")) ?? "").slice(11)
mkdirSync(OUT, { recursive: true })
const refuse = (msg) => {
  console.error(`REFUSED: ${msg}`)
  process.exit(2)
}

const F = loadTs("lib/flip-pose.ts")
const H = loadTs("lib/hero-motion.ts")
const hm = H.DEFAULT_HERO_MOTION
const optsFor = (direction, takeLen) => ({
  on: true,
  direction,
  startSec: takeLen / 1000 + 10 / 30,
  beatSec: direction === "flatToSolid" ? hm.beats.emerge : hm.beats.returnTurn,
  dwellSec: hm.emerge.dwellSec,
  landYaw: 0,
  flatDepth: hm.emerge.flatDepth,
  turnShade: hm.emerge.turnShade,
  edgeFloor: hm.emerge.edgeFloor,
})
const endMs = (o) => (o.startSec + o.beatSec + 15 / 30) * 1000
const FOUR = ["ink", "depth", "yaw", "shade"]
const same4 = (a, b) => !!a && !!b && FOUR.every((k) => Object.is(a[k], b[k]))
const near4 = (a, b) => !!a && !!b && FOUR.every((k) => Math.abs(a[k] - b[k]) <= 1e-9)

const PORT = Number(new URL(LAB_URL).port || 80)
let srv
try {
  srv = serverCommit(PORT)
} catch (e) {
  refuse(e.message)
}
console.log(`server :${PORT} pid ${srv.pid} cwd ${srv.cwd} head ${srv.head}${srv.dirty ? " DIRTY" : " clean"}`)
if (RECORD && srv.dirty) refuse("a base is recorded from a clean tree only")

const rows = []
const row = (id, name, pass, number, mustFail) => {
  const blind = mustFail.fired !== true
  rows.push({ id, name, pass: pass && !blind, blind, number, mustFail })
  console.log(`${pass && !blind ? "PASS" : blind ? "BLIND" : "FAIL"} ${id} ${name} | ${number} | must-fail: ${mustFail.what} -> ${mustFail.fired ? "fired" : "DID NOT FIRE"} (${mustFail.number})`)
}

const polys = JSON.parse(readFileSync(join(ROOT, "scripts/capture/logo-strokes.json"), "utf8")).polylines
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1512, height: 982 }, deviceScaleFactor: 1, acceptDownloads: true })
const page = await context.newPage()
page.on("pageerror", (e) => console.log(`PAGEERROR ${e.message}`))
const ev = (fn, arg) => page.evaluate(fn, arg)
const settle = async (ms = 250) => {
  await page.waitForTimeout(ms)
  await ev(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
}
const setP = async (p) => {
  await ev((x) => window.__revealHarness.setProgress(x), p)
  await settle()
}
const sample = () => ev(() => window.__fsKeySample())
const drawn = () => ev(() => window.__fsTake.get().live.meshes.reduce((s, m) => s + (m.visible ? m.count : 0), 0))
const total = () => ev(() => window.__fsTake.get().live.meshes.reduce((s, m) => s + m.total, 0))
const takeJson = () =>
  ev(() => {
    const t = window.__fsTake.get()
    const o = {}
    for (const k of Object.keys(t).sort()) if (k !== "live") o[k] = t[k]
    return JSON.stringify(o)
  })
const frameHash = () =>
  ev(async () => {
    const img = new Image()
    await new Promise((r, j) => ((img.onload = r), (img.onerror = j), (img.src = window.__captureHarness.grab())))
    const cv = document.createElement("canvas")
    cv.width = img.width
    cv.height = img.height
    const g = cv.getContext("2d")
    g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, img.width, img.height).data
    let h1 = 0x811c9dc5
    let h2 = 0x9e3779b9
    for (let i = 0; i < d.length; i++) {
      h1 = Math.imul(h1 ^ d[i], 16777619)
      h2 = (Math.imul(h2 ^ d[i], 2246822519) + i) | 0
    }
    return `${img.width}x${img.height}:${(h1 >>> 0).toString(16)}.${(h2 >>> 0).toString(16)}`
  })
const setKeys = async (k) => {
  const refused = await ev((x) => window.__fsSetKeys(x), k)
  if (refused?.length) throw new Error(`keys refused: ${refused.join("; ")}`)
  await settle(400)
}

await page.goto(LAB_URL, { waitUntil: "domcontentloaded", timeout: 180000 })
await undock(page)
await page.waitForFunction(() => window.__styleHarness && window.__revealHarness && window.__captureHarness, null, { timeout: 240000 })
await ev((p) => window.__styleHarness.injectStrokes(p, { msPerPoint: 12, gapMs: 60 }), polys)
await page.waitForTimeout(1500)
await ev(() => {
  window.__revealHarness.setEase("linear")
  window.__revealHarness.setPlaying(false)
})
await page.waitForFunction(() => !!window.__fsTake && !!window.__fsKeySample && !!window.__fsSetKeys, null, { timeout: 60000 })
await settle(800)
for (const p of [0, 0.5, 1, 0]) await setP(p)

const PS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1]
const offState = async () => {
  const out = { take: await takeJson(), frames: [] }
  for (const p of PS) {
    await setP(p)
    const s = await sample()
    out.frames.push({ p, clockMs: s.clockMs, lengthMs: s.lengthMs, takeLen: s.takeLen, keyed: s.keyed, drawn: await drawn(), hash: await frameHash() })
  }
  return out
}
const cmpOff = (a, b) => {
  const bad = []
  if (a.take !== b.take) bad.push("take")
  a.frames.forEach((f, i) => {
    for (const k of ["clockMs", "lengthMs", "takeLen", "keyed", "drawn", "hash"]) if (!Object.is(f[k], b.frames[i]?.[k])) bad.push(`p${f.p}.${k}`)
  })
  return bad
}

if (RECORD) {
  const a = await offState()
  const b = await offState()
  const d = cmpOff(a, b)
  writeFileSync(BASE_FILE, JSON.stringify({ head: srv.head, ...a }, null, 1))
  console.log(`recorded ${a.frames.length} frames at ${srv.head}, lengthMs ${a.frames[0].lengthMs}; repeat pass: ${d.length ? "NOT IDENTICAL " + d.join(",") : "identical"}`)
  await browser.close()
  process.exit(d.length ? 1 : 0)
}

const base = JSON.parse(readFileSync(BASE_FILE, "utf8"))
const group = page.getByRole("group", { name: "Flip" }).first()
const pill = (label) => group.getByRole("button", { name: label, exact: true })
// FLIP-4: the pills are NOT on the undocked page. They live in the Animation
// drawer, which the "Edit Animation" button opens, and the drawer shrinks the
// canvas 890 -> 449 tall. The Off base was recorded with it shut, so each
// choice opens it, clicks, shuts it, and REFUSES unless the canvas is back at
// its pre-open size. Row 7 keeps it open, so Cmd-Z lands with focus on the pill.
// The toggle's title reads "Edit Animation" shut and "Close Animation" open
// (app/page.tsx, the Style summary strip), so it is found by either.
const DRAWER = 'button[title="Edit Animation"], button[title="Close Animation"]'
const drawerBtn = page.locator(DRAWER).first()
const canvasSize = () => ev(() => [...document.querySelectorAll("canvas")].map((c) => `${c.clientWidth}x${c.clientHeight}`).join(","))
const setDrawer = async (open) => {
  if (((await drawerBtn.getAttribute("aria-expanded", { timeout: 15000 })) === "true") !== open) await drawerBtn.click({ timeout: 15000 })
  await page.waitForFunction((o) => document.querySelector(o.sel)?.getAttribute("aria-expanded") === String(o.open), { sel: DRAWER, open }, { timeout: 15000 })
  await settle(500)
}
const choose = async (label, keepOpen = false) => {
  const size0 = await canvasSize()
  await setDrawer(true)
  await pill(label).click({ timeout: 15000 })
  await settle(700)
  if (!keepOpen) {
    await setDrawer(false)
    const back = await page
      .waitForFunction((s) => [...document.querySelectorAll("canvas")].map((c) => `${c.clientWidth}x${c.clientHeight}`).join(",") === s, size0, { timeout: 10000 })
      .then(() => true, () => false)
    if (!back) refuse(`the Animation drawer did not give the canvas back: ${size0} before, ${await canvasSize()} after`)
    await settle(500)
  }
  return (await sample()).flip
}
const walk = async (o, alt, L, T) => {
  const clocks = []
  for (let i = 0; i < 8; i++) clocks.push((T * i) / 8)
  const s = o.startSec * 1000 - 150
  const e = endMs(o)
  for (let i = 0; i < 23; i++) clocks.push(s + ((e - s) * i) / 22)
  clocks.push((o.startSec + o.beatSec / 2) * 1000)
  const res = []
  for (const c of clocks) {
    await setP(c / L)
    const x = await sample()
    res.push({ c: x.clockMs, pose: x.pose, exp: F.flipPoseAt(x.clockMs / 1000, o), alt: F.flipPoseAt(x.clockMs / 1000, alt), drawn: await drawn(), total: await total() })
  }
  return res
}
const optsEqual = (got, want) => !!got && Object.keys(want).every((k) => Object.is(got[k], want[k]))

// ---- FLIP-6: his framing, and the lab's shipped view across its emerge
const dAng = (a, b) => Math.abs(((((a - b) % 360) + 540) % 360) - 180)
const desk0 = (await sample()).camera
if (!desk0) refuse("no camera pose on / to read")
if (dAng(desk0.azimuth, 0) < 5 && Math.abs(desk0.elevation) < 5) refuse(`his camera is already head-on (az ${desk0.azimuth}, el ${desk0.elevation}): no row could tell a settle from none`)
const labView = (() => {
  const e0 = H.phaseOffsets(hm).emerge
  const v = Array.from({ length: 29 }, (_, f) => H.sampleHeroMotion(hm, e0 + f / 30))
  if (v.some((x) => x.az !== v[0].az || x.el !== v[0].el)) refuse(`the lab's camera moves during its emerge: ${v.map((x) => `${x.az}/${x.el}`).join(" ")}`)
  return { azimuth: v[0].az, elevation: v[0].el }
})()
const onLab = (c) => !!c && dAng(c.azimuth, labView.azimuth) <= 0.5 && Math.abs(c.elevation - labView.elevation) <= 0.5
const onDesk = (c) => !!c && dAng(c.azimuth, desk0.azimuth) <= 0.05 && Math.abs(c.elevation - desk0.elevation) <= 0.05 && Math.abs(c.distance - desk0.distance) <= 1e-3
const settleLaw = (f) => {
  const k = Math.min(1, Math.max(0, (f / 30 + 0.5) / 0.5))
  const e = k * k * (3 - 2 * k)
  return { azimuth: desk0.azimuth + ((((-desk0.azimuth % 360) + 540) % 360) - 180) * e, elevation: desk0.elevation * (1 - e) }
}
const camStr = (c) => (c ? `${c.azimuth.toFixed(2)}/${c.elevation.toFixed(2)}` : "none")
console.log(`his camera ${camStr(desk0)} d ${desk0.distance.toFixed(3)}; the lab's view across its emerge ${labView.azimuth}/${labView.elevation}`)

// ---- Flat to solid: rows 2 and 3, and row 1's must-fail grid
await choose("Flat to solid")
const onGrid = await offState()
const s0 = await sample()
const T = s0.takeLen
const L = s0.lengthMs
const oF = optsFor("flatToSolid", T)
const wF = await walk(oF, { ...oF, startSec: oF.startSec + 1 / 30 }, L, T)
const okF = wF.filter((r) => same4(r.pose, r.exp)).length
const dwellF = wF.filter((r) => r.exp.inDwell).length
const mf2 = wF.filter((r) => !same4(r.pose, r.alt)).length
const optsF = optsEqual(s0.flip, oF)
row(2, "Flat to solid: the pose at 32 clocks equals flipPoseAt", optsF && wF.length === 32 && okF === 32 && dwellF > 0,
  `${okF}/${wF.length} clocks exact, ${dwellF} on the edge-on hold, page opts ${optsF ? "equal the lab's" : "DIFFER " + JSON.stringify(s0.flip)}`,
  { what: "the same poses against flipPoseAt started 1 frame late", fired: mf2 > 0, number: `${mf2}/${wF.length} differ` })

const late = wF.filter((r) => r.c >= T)
const whole = late.filter((r) => r.total > 0 && r.drawn === r.total).length
const covers = (len) => len >= endMs(oF)
row(3, "the take length covers the flip; the draw-in stays whole", Object.is(L, Math.max(T, endMs(oF))) && covers(L) && late.length > 0 && whole === late.length,
  `length ${L.toFixed(1)} ms = max(takeLen ${T.toFixed(1)}, flip end ${endMs(oF).toFixed(1)}); ${whole}/${late.length} clocks past the pen show the whole draw-in`,
  { what: "the pre-flip length, max(takeLen, keysEnd) = takeLen", fired: !covers(T), number: `${T.toFixed(1)} < ${endMs(oF).toFixed(1)}` })

// ---- FLIP-6: rows 8 and 9 on one film of `/`, 12 clocks from 0.5 s before
// the flip to f+28 plus two camera-only clocks (f-20 before the settle, f-7
// halfway through it). Every frame's camera is read back with its grab.
const FRO = [-15, -10, -5, 0, 4, 8, 11, 13, 14, 17, 24, 28]
const atF = (o, len, f) => ((o.startSec + f / 30) * 1000) / len
const film = async (o, len, clocks) => {
  const out = new Map()
  for (const f of clocks) {
    await setP(atF(o, len, f))
    const img = await ev(() => window.__captureHarness.grab())
    out.set(f, { img, cam: (await sample()).camera })
  }
  return out
}
// Ink width: composite over white paper, a pixel is ink when it sits 120 or
// more in luminance below the paper (the grid does not), width = its x extent.
const inkW = (img) =>
  ev(async (src) => {
    const im = new Image()
    await new Promise((r, j) => ((im.onload = r), (im.onerror = j), (im.src = src)))
    const cv = document.createElement("canvas")
    cv.width = im.width
    cv.height = im.height
    const g = cv.getContext("2d")
    g.fillStyle = "#fff"
    g.fillRect(0, 0, cv.width, cv.height)
    g.drawImage(im, 0, 0)
    const d = g.getImageData(0, 0, cv.width, cv.height).data
    let x0 = 1e9
    let x1 = -1
    let n = 0
    for (let i = 0; i < d.length; i += 4) {
      if (255 - (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) < 120) continue
      const x = (i >> 2) % cv.width
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      n++
    }
    return { w: n ? x1 - x0 + 1 : 0, n }
  }, img)
const filmF = await film(oF, L, [-20, -7, ...FRO])
const camF = (f) => filmF.get(f).cam
const law7 = settleLaw(-7)
const mid7 = !!camF(-7) && dAng(camF(-7).azimuth, law7.azimuth) <= 0.05 && Math.abs(camF(-7).elevation - law7.elevation) <= 0.05
const headF = FRO.filter((f) => f >= 0)
const onF = headF.filter((f) => onLab(camF(f))).length
row(8, "Flat to solid: the camera settles to the lab's view by the flip's frame 0",
  onDesk(camF(-20)) && mid7 && onF === headF.length,
  `f-20 ${camStr(camF(-20))} (his ${camStr(desk0)}), f-7 ${camStr(camF(-7))} (law ${camStr(law7)}), f+0 ${camStr(camF(0))}, ${onF}/${headF.length} clocks f+0..f+28 within 0.5 deg of ${labView.azimuth}/${labView.elevation}`,
  { what: "the same 0.5 degree check on the f-20 camera", fired: !onLab(camF(-20)), number: camStr(camF(-20)) })

const wF0 = await inkW(filmF.get(0).img)
const w11 = await inkW(filmF.get(11).img)
const w13 = await inkW(filmF.get(13).img)
const w14 = await inkW(filmF.get(14).img)
const line = (m) => m.n > 0 && m.w <= 2
row(9, "the word collapses to at most 2 px at f+13 and f+14, like the lab",
  wF0.w >= 100 && line(w13) && line(w14),
  `ink width f+0 ${wF0.w} px, f+11 ${w11.w}, f+13 ${w13.w} (${w13.n} px of ink), f+14 ${w14.w} (${w14.n} px of ink)`,
  { what: "the same 2 px check on f+11", fired: !line(w11), number: `${w11.w} px` })

if (STRIP) {
  if (!LAB_FILM) refuse("--strip needs --lab-film=<the lab's film-30.mp4>")
  const FR = FRO

  // FLIP-4: film t is NOT the hero clock. The film's zero is read before the
  // play click, and its edge-on frames sit at 6.700 and 6.733 s while
  // phaseOffsets(hm).emerge + the law's edge (13/30 s) is 6.500 s: 6 frames
  // late. So the lab's flip start is found in the film's own pixels, as the
  // frame where the mark's width collapses minus the law's edge time, and the
  // strip REFUSES if the film shows no collapse.
  const guess = H.phaseOffsets(hm).emerge
  const lawEdge = (() => {
    for (let f = 0; f <= 60; f++) if (F.flipPoseAt(f / 30, { ...oF, startSec: 0 })?.yaw === Math.PI / 2) return f / 30
    refuse("the flip law never reaches edge-on in 60 frames")
  })()
  const W0 = Math.max(0, guess - 0.5)
  const dec = spawnSync("ffmpeg", ["-v", "error", "-ss", String(W0), "-t", "2", "-i", LAB_FILM, "-vf", "scale=360:270,format=gray", "-f", "rawvideo", "-"], { maxBuffer: 64 << 20 })
  if (dec.status !== 0 || !dec.stdout?.length) refuse(`ffmpeg could not decode the lab film around ${W0}s: ${dec.stderr}`)
  const widths = []
  for (let i = 0; i < dec.stdout.length / (360 * 270); i++) {
    const o0 = i * 360 * 270
    const bg = dec.stdout[o0 + 5 * 360 + 5]
    let x0 = 1e9, x1 = -1
    for (let y = 0; y < 270; y++) for (let x = 0; x < 360; x++) if (Math.abs(dec.stdout[o0 + y * 360 + x] - bg) > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x }
    widths.push(x1 - x0 + 1)
  }
  const med = [...widths].sort((a, b) => a - b)[widths.length >> 1]
  const iMin = widths.indexOf(Math.min(...widths))
  if (!(widths.length > 30 && widths[iMin] < 0.1 * med)) refuse(`no edge-on collapse in the lab film ${W0}-${W0 + 2}s: min width ${widths[iMin]} of median ${med}`)
  const labStart = W0 + iMin / 30 - lawEdge
  console.log(`lab film: edge-on at ${(W0 + iMin / 30).toFixed(4)} s (width ${widths[iMin]} of ${med}); law edge ${lawEdge.toFixed(4)} s after start; lab start ${labStart.toFixed(4)} s vs phaseOffsets ${guess.toFixed(4)} s (${Math.round((labStart - guess) * 30)} frames)`)
  const tmp = join(OUT, ".lab-tmp")
  mkdirSync(tmp, { recursive: true })
  const lab = []
  for (const [i, f] of FR.entries()) {
    const p = join(tmp, `lab-${i}.png`)
    const r = spawnSync("ffmpeg", ["-v", "error", "-ss", String(labStart + f / 30), "-i", LAB_FILM, "-frames:v", "1", "-y", p])
    if (r.status !== 0) refuse(`ffmpeg failed on the lab film at ${labStart + f / 30}s: ${r.stderr}`)
    lab.push(`data:image/png;base64,${readFileSync(p).toString("base64")}`)
  }
  rmSync(tmp, { recursive: true, force: true })

  // One sheet: a row per film, each row cropped to the union of its own ink,
  // and every cell carries its ink width in source px (w) and that width as a
  // share of the row's widest frame (the silhouette the edge-on moment breaks).
  const sheetOf = (rows, fr) =>
    ev(async ({ rows, labels }) => {
      const load = (u) => new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = u })
      // The ink's extent, read off its dark core: a pixel is ink when its
      // luminance is 120 or more from the paper's (the median of the four
      // corners), and the extent runs from the 1st to the 99th percentile of
      // ink pixels on each axis, so grid lines, grain and antialiasing cannot
      // stretch it. FLIP-5's first cut used the top-left pixel and any RGBA
      // difference, and read 100% on the lab's 6 px edge-on frame: blind.
      // At 60 the head-on grid still counted as ink and held every `/` frame
      // at the grid's width; the grid is light gray, the ink is near black.
      const ext = (im) => {
        const c = document.createElement("canvas")
        c.width = im.width
        c.height = im.height
        const g = c.getContext("2d")
        // `/` grabs are transparent where the paper is: composite over white
        // first, or the paper reads as black, the ink matches it, and the mask
        // measures the grid instead (FLIP-5's second cut: 533 px on all 12).
        g.fillStyle = "#fff"
        g.fillRect(0, 0, c.width, c.height)
        g.drawImage(im, 0, 0)
        const d = g.getImageData(0, 0, c.width, c.height).data
        const lum = (k) => 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]
        const W = c.width, Hh = c.height
        const corners = [0, (W - 1) * 4, (Hh - 1) * W * 4, ((Hh - 1) * W + W - 1) * 4].map(lum).sort((p, q) => p - q)
        const bgL = (corners[1] + corners[2]) / 2
        const hx = new Uint32Array(W), hy = new Uint32Array(Hh)
        let n = 0
        for (let y = 0; y < Hh; y++)
          for (let x = 0; x < W; x++)
            if (Math.abs(lum((y * W + x) * 4) - bgL) >= 120) { hx[x]++; hy[y]++; n++ }
        if (!n) return { x0: 0, y0: 0, x1: -1, y1: -1, n }
        const pct = (h, q) => { let acc = 0; for (let i = 0; i < h.length; i++) { acc += h[i]; if (acc >= q * n) return i } return h.length - 1 }
        return { x0: pct(hx, 0.01), x1: pct(hx, 0.99), y0: pct(hy, 0.01), y1: pct(hy, 0.99), n }
      }
      const R = await Promise.all(rows.map(async (row) => {
        const imgs = await Promise.all(row.imgs.map(load))
        const e = imgs.map(ext)
        const f = e.filter((q) => q.n > 0)
        const pad = 24
        const x0 = Math.min(...f.map((q) => q.x0)), y0 = Math.min(...f.map((q) => q.y0))
        const x1 = Math.max(...f.map((q) => q.x1)), y1 = Math.max(...f.map((q) => q.y1))
        const w = e.map((q) => (q.n > 0 ? q.x1 - q.x0 + 1 : 0))
        const cx = e.map((q) => (q.x0 + q.x1) / 2)
        return { name: row.name, imgs, w, cx, b: { x: Math.max(0, x0 - pad), y: Math.max(0, y0 - pad), w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad } }
      }))
      const CW = 200, CH = 170, top = 22, lh = 18, n = labels.length
      const cv = document.createElement("canvas")
      cv.width = CW * n
      cv.height = top + (CH + lh) * R.length
      const g = cv.getContext("2d")
      g.fillStyle = "#fff"
      g.fillRect(0, 0, cv.width, cv.height)
      g.fillStyle = "#111"
      g.font = "12px sans-serif"
      labels.forEach((t, i) => g.fillText(t, i * CW + 6, 15))
      R.forEach((row, ri) => {
        const y = top + ri * (CH + lh)
        const s = Math.min(CW / row.b.w, CH / row.b.h)
        const wmax = Math.max(...row.w)
        row.imgs.forEach((im, i) => {
          g.drawImage(im, row.b.x, row.b.y, row.b.w, row.b.h, i * CW + (CW - row.b.w * s) / 2, y + lh + (CH - row.b.h * s) / 2, row.b.w * s, row.b.h * s)
          g.fillStyle = "#666"
          g.fillText(`w ${row.w[i]} ${Math.round((100 * row.w[i]) / wmax)}%`, i * CW + CW - 78, y + lh + CH - 4)
        })
        g.fillStyle = "#111"
        g.fillText(row.name, 6, y + 13)
        g.strokeStyle = "#ddd"
        g.beginPath(); g.moveTo(0, y); g.lineTo(cv.width, y); g.stroke()
      })
      g.strokeStyle = "#ccc"
      for (let i = 1; i < n; i++) { g.beginPath(); g.moveTo(i * CW, 0); g.lineTo(i * CW, cv.height); g.stroke() }
      return { png: cv.toDataURL("image/png"), rows: R.map((r) => ({ name: r.name, w: r.w, cx: r.cx })) }
    }, { rows, labels: fr.map((f) => `f${f >= 0 ? "+" : ""}${f} ${Math.round((f * 1000) / 30)}ms`) })
  const pick = (m, fr) => fr.map((f) => m.get(f).img)
  const measured = {}
  const write = async (file, rows, fr) => {
    const { png, rows: m } = await sheetOf(rows, fr)
    const labRow = m.find((r) => r.name.startsWith("lab"))
    if (labRow) {
      const wmax = Math.max(...labRow.w)
      if (!(labRow.w[fr.indexOf(13)] < 0.1 * wmax && labRow.w[fr.indexOf(14)] < 0.1 * wmax && labRow.w[fr.indexOf(0)] > 0.8 * wmax))
        refuse(`width instrument blind: the lab row must be a line at f+13 and f+14 and full at f+0, read ${labRow.w.join(" ")}`)
    }
    writeFileSync(join(OUT, file), Buffer.from(png.split(",")[1], "base64"))
    measured[file] = { clocks: fr, rows: m }
    for (const r of m) {
      const wmax = Math.max(...r.w)
      const line = fr.filter((_, i) => r.w[i] < 0.1 * wmax)
      console.log(`${file} · ${r.name}: width % ${r.w.map((w) => Math.round((100 * w) / wmax)).join(" ")} · a line (<10%) at ${line.length ? line.map((f) => `f${f >= 0 ? "+" : ""}${f}`).join(" ") : "no frame"}`)
    }
  }
  await write("strip-12.png", [{ name: "/ Flat to solid, settles head-on", imgs: pick(filmF, FR) }, { name: "lab, shipped film", imgs: lab }], FR)
  writeFileSync(join(OUT, "strip.json"), JSON.stringify({ desk: desk0, labView, labStart, flipStartSec: oF.startSec, cameras: [-20, -7, ...FR].map((f) => ({ f, ...camF(f) })), measured }, null, 1))
  console.log(`strip-12.png in ${OUT} (lab emerge starts at ${labStart.toFixed(4)} s in its film; / flip starts at ${oF.startSec.toFixed(4)} s)`)
}

// ---- row 4: a Turn key over the flip
const cT = (oF.startSec + oF.beatSec * 0.3) * 1000
await setKeys({ turn: [{ tMs: 0, value: 30, easeOut: "linear", easeIn: "linear" }, { tMs: L, value: 30, easeOut: "linear", easeIn: "linear" }] })
await setP(cT / L)
const sT = await sample()
const eT = F.flipPoseAt(sT.clockMs / 1000, oF)
const yawK = (30 * Math.PI) / 180
row(4, "a Turn key overrides the flip's yaw; the flip keeps the ink",
  Object.is(sT.pose?.yaw, yawK) && Math.abs(sT.applied.yaw - yawK) < 1e-12 && Object.is(sT.pose?.ink, eT.ink) && Object.is(sT.pose?.depth, eT.depth),
  `at ${sT.clockMs.toFixed(0)} ms: yaw ${sT.pose?.yaw?.toFixed(6)} (key ${yawK.toFixed(6)}, flip ${eT.yaw.toFixed(6)}), applied ${sT.applied.yaw?.toFixed(6)}, ink ${sT.pose?.ink} = flip ${eT.ink}`,
  { what: "the same pose read as the flip's own yaw", fired: !Object.is(sT.pose?.yaw, eT.yaw), number: `${sT.pose?.yaw?.toFixed(6)} vs ${eT.yaw.toFixed(6)}` })

// ---- row 10: keys win over the settle. With the Turn key still on, the
// camera stays his at f+0; then a camera key (az 20, el 10) holds through the
// settle. The camera keys are walked back to his framing before they clear.
await setP(atF(oF, L, 0))
const turnCam = (await sample()).camera
const K = (v) => [{ tMs: 0, value: v, easeOut: "linear", easeIn: "linear" }, { tMs: L, value: v, easeOut: "linear", easeIn: "linear" }]
await setKeys({ azimuth: K(20), elevation: K(10) })
const keyCam = []
for (const f of [-7, 0]) {
  await setP(atF(oF, L, f))
  keyCam.push((await sample()).camera)
}
await setKeys({ azimuth: K(desk0.azimuth), elevation: K(desk0.elevation), distance: K(desk0.distance) })
await setKeys({})
await setP(atF(oF, L, -20))
const back10 = (await sample()).camera
if (!onDesk(back10)) refuse(`his camera not put back after row 10's keys: ${camStr(back10)} d ${back10?.distance}`)
const on2010 = (c) => !!c && dAng(c.azimuth, 20) <= 0.05 && Math.abs(c.elevation - 10) <= 0.05
const off7 = !!keyCam[0] && (dAng(keyCam[0].azimuth, law7.azimuth) > 0.5 || Math.abs(keyCam[0].elevation - law7.elevation) > 0.5)
row(10, "a Turn key leaves the camera his; a camera key during the settle wins",
  onDesk(turnCam) && keyCam.every(on2010),
  `Turn key, f+0: ${camStr(turnCam)} (his ${camStr(desk0)}); camera key 20/10: f-7 ${camStr(keyCam[0])}, f+0 ${camStr(keyCam[1])}`,
  { what: "the key's cameras graded against the settle (f-7 law, f+0 the lab's view)", fired: off7 && !onLab(keyCam[1]) && !onLab(turnCam), number: `f-7 law ${camStr(law7)}, f+0 lab ${labView.azimuth}/${labView.elevation}` })

// ---- row 5: the real Video export
await ev(() => {
  if (window.__fxWrapped) return
  window.__fxWrapped = true
  const rec = (src) => {
    if (window.__fxRec && src instanceof HTMLCanvasElement && src.getContext("webgl2")) {
      const s = window.__fsKeySample()
      window.__fxRec.push({ clockMs: s.clockMs, lengthMs: s.lengthMs, pose: s.pose, camera: s.camera })
    }
  }
  const oDI = CanvasRenderingContext2D.prototype.drawImage
  CanvasRenderingContext2D.prototype.drawImage = function (src, ...r) {
    rec(src)
    return oDI.call(this, src, ...r)
  }
  const OVF = window.VideoFrame
  if (OVF) {
    const W = function (src, init) {
      rec(src)
      return new OVF(src, init)
    }
    W.prototype = OVF.prototype
    window.VideoFrame = W
  }
})
await ev(() => (window.__fxRec = []))
await Promise.all([page.waitForEvent("download", { timeout: 300000 }), page.locator('button[title*="Save the animation"]').first().click()])
await settle(500)
const recRaw = await ev(() => {
  const r = window.__fxRec
  window.__fxRec = null
  return r
})
const rec = recRaw.filter((r, i) => i === 0 || r.clockMs !== recRaw[i - 1].clockMs)
const allEq = rec.filter((r) => same4(r.pose, F.flipPoseAt(r.clockMs / 1000, oF))).length
const maxC = rec.length ? Math.max(...rec.map((r) => r.clockMs)) : 0
const inFlip = rec.filter((r) => r.clockMs >= oF.startSec * 1000 && r.clockMs <= endMs(oF))
const inSettle = rec.filter((r) => r.clockMs >= (oF.startSec - 0.5) * 1000 && r.clockMs < oF.startSec * 1000)
const four = (xs) => (xs.length >= 4 ? Array.from({ length: 4 }, (_, i) => xs[Math.round((i * (xs.length - 1)) / 3)]) : [])
const pick = [...four(inSettle), ...four(inFlip)]
const camEq = (a, b) => !!a && !!b && dAng(a.azimuth, b.azimuth) <= 1e-6 && Math.abs(a.elevation - b.elevation) <= 1e-6 && Math.abs(a.distance - b.distance) <= 1e-9
let eq8 = 0
let mf5 = 0
let mfCam = 0
for (const [i, r] of pick.entries()) {
  await setP(r.clockMs / L)
  const a = await sample()
  if (Math.abs(a.clockMs - r.clockMs) < 1e-6 && near4(a.pose, r.pose) && camEq(a.camera, r.camera)) eq8++
  await setP((r.clockMs + 1000 / 30) / L)
  const b = await sample()
  if (!near4(b.pose, r.pose)) mf5++
  if (i < 4 && !camEq(b.camera, r.camera)) mfCam++
}
const expSettled = inFlip.filter((r) => onLab(r.camera)).length
const ink1 = rec.some((r) => r.pose?.ink === 1)
const ink0 = rec.some((r) => r.pose?.ink === 0)
const edge = rec.filter((r) => r.pose?.yaw === Math.PI / 2).length
row(5, "the export film has the flip, frame for frame against live",
  rec.length > 0 && allEq === rec.length && pick.length === 8 && eq8 === 8 && expSettled === inFlip.length && maxC >= endMs(oF) - 1000 / 30 - 1 && ink1 && ink0,
  `${rec.length} exported frames, ${allEq} equal flipPoseAt at their clock, last at ${maxC.toFixed(1)} of flip end ${endMs(oF).toFixed(1)} ms, ${inSettle.length} in the settle, ${inFlip.length} inside the flip (${expSettled} on the lab's view), ${edge} edge-on, ${eq8}/8 replayed live equal in pose and camera`,
  { what: "the 8 exported frames against live one frame later (pose; camera on the 4 settle clocks)", fired: mf5 > 0 && mfCam === 4, number: `${mf5}/8 poses differ, ${mfCam}/4 settle cameras differ` })

// ---- row 6: 3D first, the reverse
await choose("3D first")
const s6 = await sample()
const oR = optsFor("solidToFlat", T)
const wR = await walk(oR, { ...oR, direction: "flatToSolid" }, s6.lengthMs, T)
const okR = wR.filter((r) => same4(r.pose, r.exp)).length
const mf6 = wR.filter((r) => !same4(r.pose, r.alt)).length
const optsR = optsEqual(s6.flip, oR)
row(6, "3D first is the reverse: flipPoseAt(solidToFlat) at 32 clocks", optsR && okR === 32 && wR[0].pose?.ink === 0 && wR[wR.length - 2].pose?.ink === 1,
  `${okR}/${wR.length} clocks exact, starts ink ${wR[0].pose?.ink}, ends ink ${wR[wR.length - 2].pose?.ink}, page opts ${optsR ? "equal the lab's" : "DIFFER"}`,
  { what: "the same poses against the Flat to solid law", fired: mf6 > 0, number: `${mf6}/${wR.length} differ` })

// ---- row 11: 3D first settles too
const filmR = await film(oR, s6.lengthMs, [-20, 0, 13, 14, 28])
const camR = (f) => filmR.get(f).cam
const headR = [0, 13, 14, 28].filter((f) => onLab(camR(f))).length
row(11, "3D first settles to the lab's view before it turns in reverse", onDesk(camR(-20)) && headR === 4,
  `f-20 ${camStr(camR(-20))}, f+0 ${camStr(camR(0))}, f+13 ${camStr(camR(13))}, f+28 ${camStr(camR(28))}; ${headR}/4 within 0.5 deg`,
  { what: "the same 0.5 degree check on the f-20 camera", fired: !onLab(camR(-20)), number: camStr(camR(-20)) })

// ---- row 1: Off, after an On -> Off round trip
await choose("Off")
const offGrid = await offState()
const bad = cmpOff(base, offGrid)
const badOn = cmpOff(base, onGrid)
row(1, "Off is byte-identical to main: take, length, frames", bad.length === 0,
  `${base.frames.length} playheads + the take vs base ${base.head}: ${bad.length ? bad.join(",") : "identical"}`,
  { what: "Flat to solid on the same grid", fired: badOn.length > 0, number: `${badOn.length} fields differ` })

// ---- row 7: Cmd-Z
const before7 = await choose("Flat to solid", true)
const focus7 = await ev(() => {
  const a = document.activeElement
  return a?.closest?.('[role=group][aria-label="Flip"]') ? a.textContent.trim() : `${a?.tagName ?? "none"} ${a?.getAttribute?.("title") ?? a?.textContent?.trim().slice(0, 30) ?? ""}`
})
await page.keyboard.press("Meta+z")
await settle(700)
const after7 = (await sample()).flip
const pressed = await pill("Off").getAttribute("aria-pressed")
row(7, "Cmd-Z undoes the flip choice", !!before7 && focus7 === "Flat to solid" && after7 === null && pressed === "true",
  `chose ${before7?.direction ?? "off"}, focus on "${focus7}", after Cmd-Z ${after7?.direction ?? "off"}, Off pill pressed ${pressed}`,
  { what: "the same check read before the undo", fired: !!before7, number: `flip ${before7?.direction}` })

rows.sort((a, b) => a.id - b.id)
writeFileSync(join(OUT, "result.json"), JSON.stringify({ head: srv.head, dirty: srv.dirty, rows }, null, 1))
const passed = rows.filter((r) => r.pass).length
console.log(`${passed === rows.length ? "PASS" : "FAIL"} assert-flip-slash ${passed}/${rows.length}`)
await browser.close()
process.exit(passed === rows.length ? 0 : 1)
