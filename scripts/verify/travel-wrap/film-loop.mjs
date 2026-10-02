// F118 TRAVEL: a looping Travel on the hero word, filmed in real time across 3 seams.
//
// The mechanics are docs/verification/solid/film-solid-hero.mjs's, unchanged: the hero
// word (`scripts/capture/logo-strokes.json`) injected through `__styleHarness`, the
// page's own Geometry radio, the page's own Play button, CDP screencast frames (one per
// paint) and an rAF playhead trace. The one browser comes from scripts/verify/lib/browser.mjs.
// This file adds only the loop, the dials, and the measure.
//
// THE MEASURE is paired, never a threshold on absolute pixels: every frame is differenced
// against a clean frame of the same crop with nothing drawn (grow at 0), so the only thing
// that can differ is ink. `share` = that count over the finished word's count (grow at 1).
// At each seam (the playhead drops by more than half) it reports the share on the frame
// before and after, and the XOR between the two frames against the median XOR of the 40
// frame pairs around it.
//
// CORPUS: the 3D viewport crop MINUS the take panel. The panel is the card that holds
// `[data-take-timeline]` and the transport, and it sits over the bottom of the canvas. At
// every wrap its playhead jumps and its clock resets, and its backdrop blur shows the
// drawing behind it, so INSTR-2 measured 556 to 580 px of every seam's change coming from
// the panel against 15 to 60 px from the drawing. Its box is read from the DOM before the
// clean frame and again after the film, the union of both plus PANEL_PAD px is masked out
// of every measure (clean, full word, every frame), and a missing panel is an error, not
// an empty mask. So the measure cannot see ink drawn under the panel, the 2D pad, or a
// frame the screencast dropped (a dropped frame shows as a long `durMs`, listed).
// Shares are kept at full precision; rounding them to 4 decimals gave about 25%
// resolution at a median step of 0.0004.
//
// Usage: FS_PORT=3137 node scripts/verify/travel-wrap/film-loop.mjs <outdir> [--engine=rod]
//        [--overlap=1] [--length=0.25] [--seams=3] [--reverse=0]
//        node scripts/verify/travel-wrap/film-loop.mjs --selftest   (Node only, no browser)
//
// EXIT: 1 when a seam jumps over SEAM_K times the median in-pass step, when --stills'
// repeat control is not 0 px or its step control is 0 px, when --glb's two triangle
// counts differ, or when --compare finds a pixel difference or a still on one side only.
import { chromium } from "../lib/browser.mjs"
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { join } from "node:path"
import { createCanvas, loadImage } from "@napi-rs/canvas"

const require = createRequire(import.meta.url)
let FFMPEG = require("ffmpeg-static")
if (!FFMPEG || !existsSync(FFMPEG)) FFMPEG = "ffmpeg"
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) ?? `--${k}=${d}`).split("=").slice(1).join("=")

// ── THE ASSERTIONS, 2026-09-25 ───────────────────────────────────────────────────
// Each mode used to print its measure and exit 0. Each now ends in one of these,
// and `--selftest` runs all four on the recorded arms in docs/verification/travel/
// in Node, with no browser. Every function returns a list of problems; empty is
// the only pass.
//
// SEAM_K, the seam's share jump over the median CHANGED in-pass share step, both on the
// masked measure (take panel out). RE-DERIVED 2026-09-25 by INSTR-3 from arms filmed with
// this file, recorded in docs/verification/instruments/film-loop/:
//   after (HEAD d92d5a5eb):  inflate 1.8 to 2.5x, rod 8.0 to 8.5x, solid 1.3 to 12.4x
//   before (5050d7ea6 tree, bc9ae5c7b lib):  rod 169.0 to 169.6x, solid 341.7 to 344.1x,
//                                            inflate 1069.4 to 1069.7x
// K = 30 sits 2.4 times over the largest after seam (12.4x, solid seam 3) and 5.6 times
// under the smallest before seam (169.0x, rod seam 2). The unmasked K of 30 came from
// ratios that were mostly the panel; this one is the same number, measured on the drawing.
const SEAM_K = 30
function seamProblems(o, { K = SEAM_K, seams = 1 } = {}) {
  const p = []
  const st = o?.inPassShareStep ?? {}, med = st.medianChanged
  if (!Array.isArray(o?.seams) || o.seams.length < seams) p.push(`${o?.seams?.length ?? 0} seams found, want at least ${seams}`)
  if (!o?.mask?.maskedPx) p.push("no take-panel mask in the trace, so the seam counts the panel (a trace from before the masked measure)")
  if (!(st.changed >= st.n / 4)) p.push(`the drawing changed on ${st.changed} of ${st.n} in-pass frame pairs, under a quarter, so the film barely moved`)
  if (!Number.isFinite(med) || med <= 0) p.push(`in-pass median changed share step is ${med}, so the film did not move and no ratio exists`)
  else for (const [n, sm] of (o.seams ?? []).entries()) {
    const r = sm.shareJump / med
    if (!Number.isFinite(r)) p.push(`seam ${n + 1} share jump is ${sm.shareJump}`)
    else if (r > K) p.push(`seam ${n + 1} share jump ${sm.shareJump} is ${r.toFixed(1)}x the median changed in-pass step ${med}, over K ${K}`)
  }
  if (o?.errors?.length) p.push(`${o.errors.length} page errors: ${o.errors[0]}`)
  return p
}
// --stills: the repeat control must be 0 px from its twin, the step control above 0.
// A size mismatch is -1 and fails both, since nothing was compared.
function stillControlProblems(repeatPx, stepPx) {
  const p = []
  if (repeatPx !== 0) p.push(`grow 0.40 twice differs by ${repeatPx} px, want 0 (the noise floor)`)
  if (!(stepPx > 0)) p.push(`grow 0.40 vs 0.41 differs by ${stepPx} px, want above 0, or the diff cannot see a playhead step`)
  return p
}
// --glb: the mid-wrap GLB must carry the unwrapped GLB's triangles, both counted, and each
// pull must BE the state it is named for, read off the geometry before and after its export.
function glbProblems(glb) {
  const p = []
  const want = (tag, wrapped) => {
    const g = glb?.[tag]
    if (!g) return p.push(`no ${tag} pull`)
    for (const k of ["wrapBefore", "wrapAfter"]) {
      const w = g[k]
      if (!w || !(w.scenes > 0) || !(w.indexed > 0)) p.push(`${tag} ${k}: the geometry was not read (${JSON.stringify(w)})`)
      else if (wrapped ? !(w.doubled > 0 && w.drawPastHalf > 0) : w.doubled !== 0) p.push(`${tag} ${k}: ${w.doubled} meshes carry the doubled index (${w.drawPastHalf} draw past its half), so the pull is ${wrapped ? "not wrapped" : "wrapped"}`)
    }
    if (g.p !== g.pAfter) p.push(`${tag}: the playhead moved during the pull, ${g.p} to ${g.pAfter}`)
    if (!Number.isFinite(g.glbTriangles) || g.glbTriangles <= 0) p.push(`${tag} GLB has ${g.glbTriangles} triangles`)
  }
  want("midWrap", true); want("unwrapped", false)
  const a = glb?.midWrap?.glbTriangles, b = glb?.unwrapped?.glbTriangles
  if (Number.isFinite(a) && Number.isFinite(b) && a !== b) p.push(`mid-wrap ${a} triangles vs unwrapped ${b}`)
  return p
}
// --compare: both directions. A still only in B used to go unnoticed.
function setProblems(namesA, namesB) {
  const inB = new Set(namesB), inA = new Set(namesA)
  const p = []
  if (!namesA.length) p.push("A has no stills")
  if (!namesB.length) p.push("B has no stills")
  for (const n of namesA) if (!inB.has(n)) p.push(`${n} only in A`)
  for (const n of namesB) if (!inA.has(n)) p.push(`${n} only in B`)
  return p
}
const stillNames = async (dir) => (await import("node:fs")).readdirSync(dir).filter((n) => n.startsWith("still-") && n.endsWith(".png")).sort()
const px = async (f) => { const i = await loadImage(f); const c = createCanvas(i.width, i.height); const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height).data }
/** RGBA pixels that differ between two PNGs; -1 when their sizes differ. */
async function pixelDiff(fa, fb) {
  const a = await px(fa), b = await px(fb)
  if (a.length !== b.length) return -1
  let d = 0
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) d++
  return d
}

if (process.argv.includes("--selftest")) {
  const REC = new URL("../../../docs/verification/travel/", import.meta.url).pathname
  const rec = (d) => JSON.parse(readFileSync(join(REC, d, "trace.json"), "utf8"))
  let bad = 0, n = 0
  const want = (name, problems, pass) => {
    n++
    const good = (problems.length === 0) === pass
    if (!good) bad++
    console.log(`  ${good ? "PASS" : "FAIL"}  ${name} ${pass ? "passes" : "fails"}: ${problems.join(" · ") || "no problems"}`)
  }
  console.log(`SELFTEST: film-loop's assertions on the recorded arms in docs/verification/instruments/film-loop/ and travel/ (K ${SEAM_K})`)
  const ARM = new URL("../../../docs/verification/instruments/film-loop/", import.meta.url).pathname
  const arm = (d) => JSON.parse(readFileSync(join(ARM, d, "trace.json"), "utf8"))
  for (const e of ["rod", "inflate", "solid"]) {
    want(`seams, masked after-${e}`, seamProblems(arm(`after-${e}`), { seams: 3 }), true)
    want(`seams, masked before-${e}`, seamProblems(arm(`before-${e}`), { seams: 3 }), false)
    want(`seams, unmasked film-after-${e} (a trace that counted the panel)`, seamProblems(rec(`film-after-${e}`), { seams: 3 }), false)
  }
  const ar = arm("after-rod")
  want("seams, a frozen film (no in-pass pair changed)", seamProblems({ ...ar, inPassShareStep: { ...ar.inPassShareStep, median: 0, medianChanged: 0, changed: 0 } }, { seams: 3 }), false)
  want("seams, a film that changed on a tenth of its pairs", seamProblems({ ...ar, inPassShareStep: { ...ar.inPassShareStep, changed: Math.floor(ar.inPassShareStep.n / 10) } }, { seams: 3 }), false)
  want("seams, a film that found no seam", seamProblems({ ...ar, seams: [] }, { seams: 3 }), false)
  want("seams, after-rod with no mask recorded", seamProblems({ ...ar, mask: undefined }, { seams: 3 }), false)
  for (const e of ["rod", "inflate", "solid"]) {
    const d = join(REC, `stills-after-${e}`)
    const rep = await pixelDiff(join(d, "ctl-grow-0.4-repeat.png"), join(d, "still-grow-0.4.png"))
    const step = await pixelDiff(join(d, "ctl-grow-0.41.png"), join(d, "still-grow-0.4.png"))
    want(`stills controls, stills-after-${e} (repeat ${rep} px, step ${step} px)`, stillControlProblems(rep, step), true)
    want(`stills controls swapped, stills-after-${e}`, stillControlProblems(step, rep), false)
  }
  const g = arm("glb-rod").glb
  const mw = g.midWrap, uw = g.unwrapped
  want("glb, masked glb-rod", glbProblems(g), true)
  want("glb, the wrapped pull's triangles doubled", glbProblems({ ...g, midWrap: { ...mw, glbTriangles: mw.glbTriangles * 2 } }), false)
  want("glb, mid-wrap one triangle short", glbProblems({ ...g, midWrap: { ...mw, glbTriangles: mw.glbTriangles - 1 } }), false)
  want("glb, the 'wrapped' pull reads no doubled index", glbProblems({ ...g, midWrap: { ...mw, wrapBefore: { ...mw.wrapBefore, doubled: 0, drawPastHalf: 0 } } }), false)
  want("glb, the 'unwrapped' pull carries a doubled index", glbProblems({ ...g, unwrapped: { ...uw, wrapAfter: { ...uw.wrapAfter, doubled: 1, drawPastHalf: 1 } } }), false)
  want("glb, the playhead moved during a pull", glbProblems({ ...g, unwrapped: { ...uw, pAfter: uw.p + 0.01 } }), false)
  want("glb, no unwrapped pull", glbProblems({ midWrap: mw }), false)
  want("glb, the recorded travel/glb-rod (p 0.001, no wrap state read)", glbProblems(rec("glb-rod").glb), false)
  const A = await stillNames(join(REC, "stills-before-rod")), B = await stillNames(join(REC, "stills-after-rod"))
  want(`compare sets, stills-before-rod vs stills-after-rod (${A.length} and ${B.length})`, setProblems(A, B), true)
  want("compare sets, one still only in B", setProblems(A, [...B, "still-extra-0.5.png"]), false)
  want("compare sets, one still only in A", setProblems(A, B.slice(1)), false)
  console.log(bad ? `SELFTEST FAILED, ${bad} of ${n}` : `SELFTEST holds, ${n} of ${n}`)
  process.exit(bad ? 1 : 0)
}

if (process.argv.some((a) => a.startsWith("--compare="))) {
  const [A, B] = process.argv.find((a) => a.startsWith("--compare=")).slice(10).split(",")
  if (!A || !B || !existsSync(A) || !existsSync(B)) { console.log(`REFUSED: --compare=<dirA>,<dirB>, both must exist (${A}, ${B})`); process.exit(2) }
  const names = await stillNames(A), namesB = await stillNames(B)
  if (!names.length) { console.log(`REFUSED: no stills in ${A}`); process.exit(2) }
  const sp = setProblems(names, namesB)
  for (const x of sp) console.log(x)
  let bad = 0
  for (const n of names) {
    if (!namesB.includes(n)) continue
    const d = await pixelDiff(join(A, n), join(B, n))
    if (d !== 0) bad++
    console.log(`${n} ${d} px differ`)
  }
  console.log(`${names.length - bad - sp.filter((x) => x.endsWith("only in A")).length} of ${names.length} identical, ${sp.length} set problems`)
  process.exit(bad || sp.length ? 1 : 0)
}
const OUT = process.argv.slice(2).find((a) => !a.startsWith("--"))
if (!OUT) { console.log("usage: film-loop.mjs <outdir>"); process.exit(2) }
const ENGINE = arg("engine", "rod"), OVERLAP = Number(arg("overlap", "1")), LENGTH = Number(arg("length", "0.25"))
const SEAMS = Number(arg("seams", "3")), REVERSE = arg("reverse", "0") === "1"
// --stills=1: no film. Loop off, every window mode at fixed playheads, one PNG each, for the
// "non-looping paths are unchanged" check. --compare=<dirA>,<dirB> diffs two such sets pixel
// by pixel (RGBA, any channel) and exits 1 on any difference or any missing file.
const GLB = arg("glb", "0") === "1"
const STILLS = arg("stills", "0") === "1", COMPARE = arg("compare", "")
// --p=a,b,c overrides the playheads (a grow-start set, for one: --p=0.002,0.006,0.02).
const STILL_P = arg("p", "") ? arg("p", "").split(",").map(Number) : [0.15, 0.4, 0.6, 0.85]
const STILL_MODES = arg("modes", "") ? arg("modes", "").split(",") : ["grow", "vanish", "shrink", "travel"]
const GAP_MS = 400, MS_PER_POINT = 12, THR = 24
if (!process.env.FS_PORT) { console.log("REFUSED: set FS_PORT"); process.exit(2) }
const PAGE_URL = `http://localhost:${process.env.FS_PORT}/`
rmSync(join(OUT, "frames"), { recursive: true, force: true })
mkdirSync(join(OUT, "frames"), { recursive: true })

const raw = JSON.parse(readFileSync(new URL("../../capture/logo-strokes.json", import.meta.url), "utf8"))
const browser = await chromium.launch()
const out = { url: PAGE_URL, engine: ENGINE, overlap: OVERLAP, length: LENGTH, reverse: REVERSE, errors: [] }
const grey = async (buf, box) => {
  const img = await loadImage(buf)
  const c = createCanvas(box.w, box.h); const g = c.getContext("2d")
  g.drawImage(img, -box.x, -box.y)
  const d = g.getImageData(0, 0, box.w, box.h).data
  const a = new Uint8Array(box.w * box.h)
  for (let i = 0; i < a.length; i++) a[i] = (d[4 * i] * 77 + d[4 * i + 1] * 150 + d[4 * i + 2] * 29) >> 8
  return { a, png: c.toBuffer("image/png") }
}
// KEEP[i] is 1 for a pixel the measure reads, 0 for one under the take panel. Set once the
// panel box is read; every measure below goes through it.
let KEEP = null
const inkVs = (a, clean) => { let n = 0; for (let i = 0; i < a.length; i++) if (KEEP[i] && Math.abs(a[i] - clean[i]) > THR) n++; return n }
const xor = (a, b, clean) => { let n = 0; for (let i = 0; i < a.length; i++) if (KEEP[i] && (Math.abs(a[i] - clean[i]) > THR) !== (Math.abs(b[i] - clean[i]) > THR)) n++; return n }
const PANEL_PAD = 2
// The take panel's card, read from the DOM: the parent of `[data-take-timeline]`, which must
// also hold the Play/Pause button, or this is not the card and the read refuses.
const panelBox = (page) => page.evaluate(() => {
  const card = document.querySelector("[data-take-timeline]")?.parentElement
  if (!card) return null
  const r = card.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: r.height, holdsTransport: !!card.querySelector('button[aria-label="Pause"],button[aria-label="Play"]') }
})
const buildKeep = (box, panels) => {
  const keep = new Uint8Array(box.w * box.h).fill(1)
  let masked = 0
  for (const pb of panels) {
    const x0 = Math.max(0, Math.floor(pb.x - box.x - PANEL_PAD)), x1 = Math.min(box.w, Math.ceil(pb.x + pb.width - box.x + PANEL_PAD))
    const y0 = Math.max(0, Math.floor(pb.y - box.y - PANEL_PAD)), y1 = Math.min(box.h, Math.ceil(pb.y + pb.height - box.y + PANEL_PAD))
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = y * box.w + x; if (keep[i]) { keep[i] = 0; masked++ } }
  }
  return { keep, masked }
}
const median = (xs) => { const s = [...xs].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : 0 }
const setRange = (page, v) => page.evaluate((v) => {
  const el = document.querySelector('button[aria-label="Pause"],button[aria-label="Play"]').parentElement.querySelector('input[type="range"]')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v))
  el.dispatchEvent(new Event("input", { bubbles: true }))
}, v)
try {
  const context = await browser.newContext({ viewport: { width: 1512, height: 982 } })
  // three.js announces every Scene it constructs to `__THREE_DEVTOOLS__` when that global
  // exists. --glb=1 keeps them, so it can read the wrap state off the live geometry itself.
  if (GLB) await context.addInitScript(() => {
    const t = new EventTarget(); window.__filmScenes = []
    t.addEventListener("observe", (e) => { if (e.detail?.isScene) window.__filmScenes.push(e.detail) })
    window.__THREE_DEVTOOLS__ = t
  })
  const page = await context.newPage()
  page.on("pageerror", (e) => out.errors.push(String(e).slice(0, 200)))
  await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" })
  await page.waitForFunction(() => window.__styleHarness && window.__revealHarness, null, { timeout: 180000 })
  const cbox = await page.locator("canvas").first().boundingBox()
  const k = (cbox.width * 0.9) / raw.width
  const ox = (cbox.width - raw.width * k) / 2, oy = (cbox.height - raw.height * k) / 2
  const polys = raw.polylines.map((pl) => pl.map((p) => ({ x: ox + p.x * k, y: oy + p.y * k })))
  await page.evaluate(({ s, g, m }) => window.__styleHarness.injectStrokes(s, { msPerPoint: m, gapMs: g }), { s: polys, g: GAP_MS, m: MS_PER_POINT })
  await page.waitForTimeout(2500)
  const radio = page.getByRole("radio", { name: new RegExp(`^${ENGINE}$`, "i") }).first()
  if (!(await radio.count())) throw new Error(`no ${ENGINE} radio`)
  await radio.click()
  await page.waitForTimeout(6000)
  out.modeChecked = await radio.getAttribute("aria-checked")
  if (out.modeChecked !== "true") throw new Error(`${ENGINE} did not take: aria-checked=${out.modeChecked}`)
  const vb = await page.evaluate(() => { const r = [...document.querySelectorAll("canvas")].map((c) => c.getBoundingClientRect()).filter((b) => b.width > 200).sort((a, b) => b.x - a.x)[0]; return r ? { x: r.x, y: r.y, width: r.width, height: r.height } : null })
  if (!vb || vb.x < 300) throw new Error(`no 3D viewport canvas: ${JSON.stringify(vb)}`)
  const box = { x: Math.round(vb.x), y: Math.round(vb.y), w: Math.round(vb.width), h: Math.round(vb.height) }
  out.crop = box
  const P1 = await panelBox(page)
  if (!P1 || !P1.holdsTransport || !(P1.width > 0 && P1.height > 0)) throw new Error(`no take panel to mask: ${JSON.stringify(P1)}`)
  const setMask = (panels) => {
    const m = buildKeep(box, panels); KEEP = m.keep
    out.mask = { panels, pad: PANEL_PAD, maskedPx: m.masked, cropPx: box.w * box.h, fraction: m.masked / (box.w * box.h) }
    if (!(m.masked > 0)) throw new Error(`the take panel ${JSON.stringify(panels)} masks 0 px of the crop ${JSON.stringify(box)}: the panel is not over the canvas, so this is not the layout the mask was written for`)
    if (out.mask.fraction > 0.5) throw new Error(`the mask covers ${out.mask.fraction} of the crop, over half: the measure would see too little`)
  }
  setMask([P1])
  const setOk = await page.evaluate(({ o, L, rev }) => {
    const h = window.__revealHarness
    return [h.setDrawIn({ overlap: o }), h.setEase("linear"), h.setDelay(0), h.setReverse(rev), h.setWindow({ mode: "grow", length: L })]
  }, { o: OVERLAP, L: LENGTH, rev: REVERSE })
  out.setters = setOk
  await page.waitForTimeout(1500)
  // THE CLEAN CONTROL and the finished word, same crop, before any Travel.
  await setRange(page, 0); await page.waitForTimeout(2500)
  const clean = await grey(await page.screenshot({ clip: vb }), { x: 0, y: 0, w: box.w, h: box.h })
  writeFileSync(join(OUT, "clean.png"), clean.png)
  await setRange(page, 1); await page.waitForTimeout(2500)
  const fullG = await grey(await page.screenshot({ clip: vb }), { x: 0, y: 0, w: box.w, h: box.h })
  writeFileSync(join(OUT, "full.png"), fullG.png)
  let FULL = inkVs(fullG.a, clean.a)
  out.fullInk = FULL
  { // the mask, painted on the finished word, for eyes
    const c = createCanvas(box.w, box.h), g = c.getContext("2d"); g.drawImage(await loadImage(fullG.png), 0, 0)
    const im = g.getImageData(0, 0, box.w, box.h); for (let i = 0; i < KEEP.length; i++) if (!KEEP[i]) { im.data[4 * i] = 255; im.data[4 * i + 1] >>= 2; im.data[4 * i + 2] >>= 2 }
    g.putImageData(im, 0, 0); writeFileSync(join(OUT, "mask.png"), c.toBuffer("image/png"))
  }
  if (FULL < 1000) throw new Error(`the finished word measured ${FULL} px against the clean frame: the instrument cannot see the mark`)
  if (STILLS) {
    // Positive control inside the set: grow at 0.40 twice (must be 0 px apart, the noise floor)
    // and grow at 0.41 (must differ from 0.40, or the diff cannot see a playhead step).
    await page.evaluate(() => window.__revealHarness.setLoop(false))
    const shot = async (name, mode, p) => {
      await page.evaluate(({ mode, L, p }) => { const h = window.__revealHarness; h.setWindow({ mode, length: L }); h.setProgress(p) }, { mode, L: LENGTH, p })
      await page.waitForTimeout(2200)
      writeFileSync(join(OUT, name), await page.screenshot({ clip: vb }))
    }
    for (const m of STILL_MODES) for (const p of STILL_P) await shot(`still-${m}-${p}.png`, m, p)
    await shot("ctl-grow-0.4-repeat.png", "grow", 0.4)
    await shot("ctl-grow-0.41.png", "grow", 0.41)
    out.stills = STILL_MODES.length * STILL_P.length
    out.stillControls = {
      repeatPx: await pixelDiff(join(OUT, "ctl-grow-0.4-repeat.png"), join(OUT, "still-grow-0.4.png")),
      stepPx: await pixelDiff(join(OUT, "ctl-grow-0.41.png"), join(OUT, "still-grow-0.4.png")),
    }
    throw Object.assign(new Error("STILLS_DONE"), { done: true })
  }
  await page.evaluate((L) => { const h = window.__revealHarness; h.setWindow({ mode: "travel", length: L }); h.setLoop(true) }, LENGTH)
  await page.waitForTimeout(1000)
  out.window = await page.evaluate(() => window.__revealHarness.window())
  await setRange(page, REVERSE ? 1 : 0); await page.waitForTimeout(1500)
  const takeMs = await page.evaluate(() => window.__revealHarness.getTotalDuration())
  out.takeMs = takeMs
  if (GLB) {
    // --glb=1: a GLB pulled while the window wraps must carry the same triangles as one pulled
    // while it does not. WHICH state each pull is in is read off the live geometry, never
    // inferred from p: a wrapped Travel swaps a doubled index onto the geometry (both halves
    // the same list, `components/viewport-3d.tsx` "THE DOUBLED INDEX"), and puts the original
    // back on every other frame. `doubled` counts meshes carrying one. The mid-wrap pull must
    // read doubled > 0 and the unwrapped pull doubled 0, both read before AND after the
    // export on a paused playhead that did not move, or the pull is not the state it names.
    const tris = (b64) => { const b = Buffer.from(b64, "base64"); const j = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString()); let t = 0
      for (const m of j.meshes ?? []) for (const pr of m.primitives) t += (pr.indices !== undefined ? j.accessors[pr.indices].count : j.accessors[pr.attributes.POSITION].count) / 3
      return t }
    const wrapState = () => page.evaluate(() => {
      const r = { scenes: (window.__filmScenes ?? []).length, indexed: 0, doubled: 0, drawPastHalf: 0 }
      for (const sc of window.__filmScenes ?? []) sc.traverse((o) => {
        const ix = o.isMesh ? o.geometry?.index : null
        if (!ix || !ix.count) return
        r.indexed++
        const n = ix.count, a = ix.array, h = n >> 1
        let same = n % 2 === 0
        for (let i = 0; same && i < h; i++) if (a[i] !== a[h + i]) same = false
        if (!same) return
        r.doubled++
        const dr = o.geometry.drawRange
        if (dr.start + Math.min(dr.count, n) > h) r.drawPastHalf++
      })
      return r
    })
    const pull = async (tag) => {
      const pre = await page.evaluate(() => window.__revealHarness.getProgress()), wrapBefore = await wrapState()
      const b64 = (await page.evaluate(async () => window.__geomDebug.exportBase64())) ?? ""
      const post = await page.evaluate(() => window.__revealHarness.getProgress()), wrapAfter = await wrapState()
      const liveStats = await page.evaluate(() => window.__geomDebug.stats?.() ?? null), win = await page.evaluate(() => window.__revealHarness.window())
      out.glb[tag] = { p: pre, pAfter: post, win, wrapBefore, wrapAfter, liveStats, bytes: b64.length, glbTriangles: b64 ? tris(b64) : null }
    }
    // Play, and pause inside [lo, hi) on the second pass or later, so the loop has passed once.
    const pauseIn = async (lo, hi) => {
      await page.getByRole("button", { name: /^Play$/i }).first().click()
      const t0 = Date.now(); let passed = false, prev = 0
      while (Date.now() - t0 < takeMs * 4) { const p = await page.evaluate(() => window.__revealHarness.getProgress()); if (p < prev - 0.5) passed = true; prev = p; if (passed && p >= lo && p < hi) break; await page.waitForTimeout(20) }
      await page.getByRole("button", { name: /^Pause$/i }).first().click()
      await page.waitForTimeout(1500)
    }
    out.glb = {}
    await pauseIn(0.08, 0.2); await pull("midWrap")
    await pauseIn(0.45, 0.6); await pull("unwrapped")
    throw Object.assign(new Error("GLB_DONE"), { done: true })
  }
  await page.evaluate(() => {
    window.__filmTrace = []; window.__filmStop = false
    const tick = () => { window.__filmTrace.push([performance.now(), window.__revealHarness.getProgress()]); if (!window.__filmStop) requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
  })
  const client = await context.newCDPSession(page)
  const shots = []
  client.on("Page.screencastFrame", async (f) => {
    shots.push({ data: f.data, ts: f.metadata.timestamp })
    try { await client.send("Page.screencastFrameAck", { sessionId: f.sessionId }) } catch (e) { out.errors.push("ack: " + String(e).slice(0, 80)) }
  })
  await client.send("Page.startScreencast", { format: "png", everyNthFrame: 1, maxWidth: 1512, maxHeight: 982 })
  const play = page.getByRole("button", { name: /^Play$/i }).first()
  if (!(await play.count())) throw new Error("no Play button")
  await play.click()
  await page.waitForTimeout(Math.round(takeMs * (SEAMS + 0.4)))
  await client.send("Page.stopScreencast")
  const trace = await page.evaluate(() => { window.__filmStop = true; return window.__filmTrace })
  const pause = page.getByRole("button", { name: /^Pause$/i }).first()
  if (await pause.count()) await pause.click()
  const epochOffset = await page.evaluate(() => performance.timeOrigin)
  // The panel box again, after the film. If it moved or grew, mask the union of both and
  // re-measure the finished word through the wider mask.
  const P2 = await panelBox(page)
  if (!P2) throw new Error("the take panel is gone after the film")
  if (["x", "y", "width", "height"].some((q) => Math.abs(P2[q] - P1[q]) > 0.5)) { setMask([P1, P2]); FULL = inkVs(fullG.a, clean.a); out.fullInk = FULL }
  out.mask.panelAfter = P2
  out.frames = []
  const G = []
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]
    const perfMs = s.ts * 1000 - epochOffset
    let ph = null
    for (const [pt, p] of trace) { if (pt <= perfMs) ph = p; else break }
    const g = await grey(Buffer.from(s.data, "base64"), box)
    const name = String(i).padStart(4, "0") + ".png"
    writeFileSync(join(OUT, "frames", name), g.png)
    G.push(g.a)
    const ink = inkVs(g.a, clean.a)
    out.frames.push({ name, perfMs: +perfMs.toFixed(1), playhead: ph, share: ink / FULL, ink, durMs: i + 1 < shots.length ? +((shots[i + 1].ts - s.ts) * 1000).toFixed(1) : 500 })
  }
  // SEAMS: a frame whose playhead is more than half a pass from the frame before.
  // MEASURED on the first before-film: the screencast frame trails the rAF trace by
  // 2 paints, so the pixels change 2 frames after the playhead does. The seam pair is
  // therefore the largest share step and the largest XOR among the pairs from 3 before
  // to 5 after the playhead jump, not the pair at the jump itself.
  const F = out.frames
  out.seams = []
  const seamPairs = new Set()
  for (let i = 1; i < F.length; i++) {
    if (F[i].playhead === null || F[i - 1].playhead === null || Math.abs(F[i].playhead - F[i - 1].playhead) < 0.5) continue
    let best = i, bestStep = -1, bestXor = -1, bestXorAt = i
    for (let j = Math.max(1, i - 3); j <= Math.min(F.length - 1, i + 5); j++) {
      seamPairs.add(j)
      const st = Math.abs(F[j].share - F[j - 1].share)
      if (st > bestStep) { bestStep = st; best = j }
      const x = xor(G[j - 1], G[j], clean.a)
      if (x > bestXor) { bestXor = x; bestXorAt = j }
    }
    const around = []
    for (let j = Math.max(1, i - 23); j <= Math.min(F.length - 1, i + 25); j++) if (j < i - 3 || j > i + 5) around.push(xor(G[j - 1], G[j], clean.a))
    const med = median(around)
    const sharesAround = F.slice(Math.max(0, i - 20), i + 21).map((f) => f.share)
    out.seams.push({ playheadJumpAt: i, pBefore: F[i - 1].playhead, pAfter: F[i].playhead,
      pairBefore: F[best - 1].name, pairAfter: F[best].name, shareBefore: F[best - 1].share, shareAfter: F[best].share, shareJump: bestStep,
      seamXor: bestXor, seamXorAt: F[bestXorAt].name, medianXor: med, xorOverMedian: med ? +(bestXor / med).toFixed(2) : null,
      shareMin40: Math.min(...sharesAround), shareMax40: Math.max(...sharesAround) })
    for (const [tag, j] of [["before", best - 1], ["after", best]]) writeFileSync(join(OUT, `seam${out.seams.length}-${tag}.png`), readFileSync(join(OUT, "frames", F[j].name)))
  }
  const steps = []
  for (let i = 1; i < F.length; i++) if (!seamPairs.has(i)) steps.push(Math.abs(F[i].share - F[i - 1].share))
  // The seam's reference is the median step among in-pass pairs where the drawing CHANGED.
  // MEASURED 2026-09-25 on HEAD, masked: 42% (rod), 4% (inflate) and 50.3% (solid) of in-pass
  // pairs change 0 px, a repeated paint or a frame with no rebuild. That share is paint timing,
  // not the drawing, and when it crosses one half the median over ALL pairs is 0 and no ratio
  // exists (solid). `median` over all pairs stays in the trace for the record.
  const changed = steps.filter((d) => d > 0)
  out.inPassShareStep = { median: median(steps), medianChanged: median(changed), changed: changed.length, n: steps.length, max: Math.max(...steps) }
  const list = F.map((f) => `file 'frames/${f.name}'\nduration ${(f.durMs / 1000).toFixed(4)}`).join("\n") + `\nfile 'frames/${F.at(-1).name}'\n`
  writeFileSync(join(OUT, "concat.txt"), list)
  execFileSync(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", "concat.txt", "-vsync", "vfr", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "film.mp4"], { cwd: OUT })
  out.gapsOver50ms = F.filter((f) => f.durMs > 50).length
  out.maxGapMs = Math.max(...F.slice(0, -1).map((f) => f.durMs))
} catch (e) {
  if (!e.done) throw e
} finally {
  try { await browser.close() } catch (e) { out.errors.push("close: " + String(e).slice(0, 80)) }
  writeFileSync(join(OUT, "trace.json"), JSON.stringify(out, null, 1))
}
const report = (problems) => {
  for (const x of problems) console.log(`FAIL  ${x}`)
  console.log(problems.length ? `FAIL, ${problems.length} problems` : "PASS")
  process.exit(problems.length ? 1 : 0)
}
if (GLB) {
  console.log(JSON.stringify({ engine: ENGINE, glb: out.glb, errors: out.errors }, null, 1))
  report([...glbProblems(out.glb), ...out.errors.map((e) => `page error: ${e}`)])
}
if (STILLS) {
  console.log(JSON.stringify({ engine: ENGINE, stills: out.stills, stillControls: out.stillControls, fullInk: out.fullInk, errors: out.errors }))
  // The controls only exist when grow and 0.4 are in the set; without them there is nothing to compare, and that fails.
  if (!out.stillControls) report(["the stills run ended before its controls were compared"])
  report([...(out.stills ? [] : ["no stills taken"]), ...stillControlProblems(out.stillControls.repeatPx, out.stillControls.stepPx), ...out.errors.map((e) => `page error: ${e}`)])
}
console.log(JSON.stringify({ engine: ENGINE, frames: out.frames?.length, fullInk: out.fullInk, window: out.window, seams: out.seams, inPass: out.inPassShareStep, maxGapMs: out.maxGapMs, gapsOver50ms: out.gapsOver50ms, errors: out.errors }, null, 1))
report(seamProblems(out, { seams: SEAMS }))
