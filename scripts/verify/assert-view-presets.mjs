// PRD FAMILY 15 — the view / export presets, measured against the capabilities
// that actually exist.
//
// THE FAMILY IS WHOLE NOW, AND HOW IT GOT THERE IS THE FINDING
//
//   Camera and export both live in components/viewport-3d.tsx, which this lane
//   does not own — so, like the geometry family, the presets ship as data plus
//   a resolver and the button is routed separately. Two of the PRD's four
//   members used to be worse off than that: they named capabilities that did
//   not exist ANYWHERE in the app.
//
//     Portfolio Spin        wanted a turntable. CLOSED 2026-08-03 — `setSpin` /
//                           `getSpin` / `effectiveSpin`, filmed below at
//                           Δpx 72+ against a 0.00 OFF control.
//     Video Preview Export  wanted a clip. CLOSED 2026-08-03 — `lib/export/`
//                           ships the writer, `applyViewPresetById` got the
//                           `target === "video"` branch, and the pill's own
//                           route is driven below until a real file lands.
//
//   ⚠ BOTH WERE REPORTED BLOCKED FOR SOME TIME AFTER THEY WERE BUILT, and in
//   both cases a row in THIS FILE was green about it — because both rows asked a
//   harness for a method name instead of asking the app to do the thing. The
//   turntable row probed `setAutoRotate`, which has never existed in this repo;
//   the video row probed `__geomDebug`/`__captureHarness` for a video-shaped key
//   while `exportVideo` sat on the viewport API, which is neither object. The
//   standing correction is at the bottom of this file: judge an export member by
//   the FILE IT WRITES, exactly as the GLB and PNG members already were.
//
//   `viewPresetBlockers()` reports nothing for any member now. This gate proves
//   that rather than trusting it: every framing is driven through the real
//   camera, and every export intent is driven until an artefact exists. A family
//   that quietly downgraded its hard members into still framings would look
//   complete and would be a lie.
//
// THE CONTROL IS A SHARED FRAMING. `topDownMark` and `glbCleanExport` point the
// camera at exactly the same place on purpose — one is a view, the other is that
// view plus an export action. They therefore MUST render identically, and
// requiring that is what proves the distinctness matrix is measuring the camera
// rather than reporting noise.
//
// ⚠ AND THIS GATE ALREADY CORRECTED A PRESET, which is the reason to run it
// before the button exists rather than after. `topDownMark` first shipped at
// elevation 89 — literally straight down — with the description "the mark as a
// flat graphic". The mark lives in the XY plane (it is drawn on a canvas) and
// the depth runs along Z, so straight down is the EDGE view: 0.667% coverage
// against 1.617% dead-on. The name promised the flat read and the framing
// delivered its opposite, and nothing about the shot looked broken.
//
// Usage: node scripts/verify/assert-view-presets.mjs
//        node scripts/verify/assert-view-presets.mjs --save
import { chromium } from "./lib/browser.mjs"
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { writeFileSync, mkdirSync, readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { loadTs } from "./_ts-load.mjs"
// DISPATCH §3 — one knob, one name: FS_PORT, resolved once here. This gate
// used to hardcode :3000, so a lane battery on its own port graded the
// canonical tree and printed green about it (explainer 27 §1).
import { LAB_URL } from "./lib/dev-server.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const has = (k) => process.argv.includes(`--${k}`)
const SAVE = has("save")
const OUT = join(ROOT, "docs", "verification", "view-presets")

const S = loadTs("lib/style-system.ts")
const { PRESET_REGISTRY, resolveViewPreset, viewPresetBlockers } = S

let fails = 0
let checks = 0
const say = (ok, label, detail) => {
  checks++
  if (!ok) fails++
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? " — " + detail : ""}`)
}

async function decode(dataUrl) {
  const buf = Buffer.from(dataUrl.match(/base64,(.+)/)[1], "base64")
  const img = await loadImage(buf)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data, w: img.width, h: img.height, buf }
}
function diff(a, b) {
  let sum = 0
  let n = 0
  for (let i = 0; i < a.d.length; i += 4) {
    if (a.d[i + 3] < 20 && b.d[i + 3] < 20) continue
    sum += (Math.abs(a.d[i] - b.d[i]) + Math.abs(a.d[i + 1] - b.d[i + 1]) + Math.abs(a.d[i + 2] - b.d[i + 2])) / 3
    n++
  }
  return n ? sum / n : 0
}
function coverage(a) {
  let n = 0
  for (let i = 3; i < a.d.length; i += 4) if (a.d[i] >= 20) n++
  return n / (a.d.length / 4)
}
/* HOW FLAT IS THE INK — the second-moment (PCA) ratio of the alpha mask: the
 * spread along its minor principal axis over the spread along its major. A
 * drawing that has collapsed to a line reads near 0; a framing that still shows
 * two dimensions reads well clear of it. It is SCALE-FREE, which is the property
 * coverage does not have and the whole reason it can separate "collapsed" from
 * "small" — the calibration block below drives both and prints the proof.
 * An empty mask returns 0, which fails every floor here by construction. */
function formRatio(a) {
  let n = 0
  let sx = 0
  let sy = 0
  const xs = []
  const ys = []
  for (let i = 3, p = 0; i < a.d.length; i += 4, p++) {
    if (a.d[i] < 20) continue
    const x = p % a.w
    const y = (p / a.w) | 0
    xs.push(x)
    ys.push(y)
    sx += x
    sy += y
    n++
  }
  if (!n) return 0
  const mx = sx / n
  const my = sy / n
  let cxx = 0
  let cyy = 0
  let cxy = 0
  for (let k = 0; k < n; k++) {
    const dx = xs[k] - mx
    const dy = ys[k] - my
    cxx += dx * dx
    cyy += dy * dy
    cxy += dx * dy
  }
  cxx /= n
  cyy /= n
  cxy /= n
  const tr = cxx + cyy
  const det = cxx * cyy - cxy * cxy
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det))
  return Math.sqrt(Math.max(0, tr / 2 - disc)) / Math.sqrt(Math.max(1e-9, tr / 2 + disc))
}
function hasAlpha(a) {
  for (let i = 3; i < a.d.length; i += 4) if (a.d[i] > 0 && a.d[i] < 250) return true
  return false
}

function testStroke() {
  const pts = []
  for (let i = 0; i <= 110; i++) {
    const t = i / 110
    pts.push({ x: 150 + t * 560, y: 340 + Math.sin(t * Math.PI * 1.9) * 120 })
  }
  return [pts]
}

async function main() {
  if (SAVE) mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ headed: true })
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, reducedMotion: "no-preference" })
  const errors = []
  page.on("console", (m) => {
    if (m.type() === "error" && !m.text().includes("404")) errors.push(m.text().slice(0, 160))
  })
  page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)))
  await page.goto(LAB_URL, { waitUntil: "networkidle" })
  await page.waitForFunction(
    () => window.__styleHarness && window.__captureHarness && window.__revealHarness && window.__geomDebug,
    null,
    { timeout: 30000 },
  )
  await page.evaluate((p) => {
    window.__styleHarness.injectStrokes(p, { msPerPoint: 12 })
    window.__captureHarness.enable()
  }, testStroke())
  await page.waitForTimeout(1600)
  await page.evaluate(() => window.__styleHarness.setMode("extrude"))
  await page.waitForTimeout(1200)
  await page.evaluate((v) => window.__revealHarness.setProgress(v), 1)
  await page.waitForTimeout(400)

  const wait = (ms) => page.waitForTimeout(ms)
  const shot = async (name) => {
    const u = await page.evaluate(() => window.__captureHarness.grab())
    const f = await decode(u)
    if (SAVE && name) writeFileSync(join(OUT, `${name}.png`), f.buf)
    return f
  }

  const defs = PRESET_REGISTRY.view
  const R = {}
  console.log("\n=== every view preset's framing, driven through the real camera ===")
  console.log("preset               az    el   fill    coverage   minor/major   blockers")
  for (const p of defs) {
    const v = resolveViewPreset(p.id)
    const ok = await page.evaluate(
      (c) => window.__captureHarness.orbitView(c.azimuthDeg, c.elevationDeg, c.fill),
      v.camera,
    )
    await wait(320)
    const f = await shot(SAVE ? `view_${p.id}` : null)
    R[p.id] = { f, ok, cov: coverage(f), ratio: formRatio(f), blockers: viewPresetBlockers(p.id) }
    console.log(
      `${p.id.padEnd(20)} ${String(v.camera.azimuthDeg).padStart(3)} ${String(v.camera.elevationDeg).padStart(5)} ${String(v.camera.fill).padStart(6)} ${(R[p.id].cov * 100).toFixed(3).padStart(10)}%   ${R[p.id].ratio.toFixed(4).padStart(11)}   ${R[p.id].blockers.length || "-"}`,
    )
  }
  console.log("")

  say(defs.every((p) => R[p.id].ok === true), "the real camera accepted every framing", `${defs.length} framings`)

  /* ── THE FLOOR WAS DRIVEN AND THE INSTRUMENT WAS STILL WRONG (class 3) ───
   *
   * PARKED PRIOR, kept whole because the way it was wrong is the lesson:
   *
   *     const COV_FLOOR = edgeOn * 1.25
   *     const tooThin = defs.filter((p) => R[p.id].cov <= COV_FLOOR)
   *     say(tooThin.length === 0, "every framing shows the form — measured
   *         against the EDGE-ON framing the topDownMark defect shipped at", ...)
   *
   * And before THAT it read a typed `cov > 0.0005`, thirteen times under the
   * documented defect. Driving the known-bad instead of typing it was right and
   * it fixed the wrong half of the row. ⚠ ALPHA COVERAGE CANNOT SEE THE DEFECT
   * THIS ROW EXISTS FOR. Measured on this build, 2026-09-04, 1400x900:
   *
   *     az 0 / el 89 — the framing topDownMark shipped at   0.643%   ratio 0.0195
   *     rakingProfile — shipped, correct, legible           0.715%   ratio 0.3935
   *
   * Coverage separates the defect from the preset by 1.11x. So every floor that
   * catches the defect also condemns the one preset whose own description is
   * "almost edge-on", and every floor that spares the preset sits under the
   * defect. This row went red on `rakingProfile` and the ruler was wrong, not
   * the framing — open docs/verification/view-presets/view_rakingProfile.png
   * next to control_edge_on_defect.png. One is the whole sine curve with its
   * depth reading down the ridge. The other is a stick.
   *
   * Coverage counts INK. The defect is a collapse of FORM, and a long thin line
   * carries as much ink as a compact curve. So the two ways a framing can fail
   * to show the drawing are separated, and each is judged by an instrument that
   * can see it, against a known-bad DRIVEN in this run:
   *
   *   COLLAPSED — `formRatio`, the minor/major principal spread of the ink.
   *               Scale-free, which the too-far arm proves rather than claims:
   *               fill 1.5 -> 6.0 moves coverage 0.593% -> 0.041% (14x) and
   *               moves this ratio 0.3393 -> 0.3408 (1.004x).
   *   TOO FAR   — coverage, calibrated against fill 2.5, which is the value
   *               F82's own table records as "too far out". Judging distance
   *               with an EDGE view was the category error above.
   *
   * ⚠ TWO collapse arms, not one. az 90 / el 0 is the other edge view and it
   * reads 0.0421, more than double az 0 / el 89's 0.0195; a floor calibrated on
   * the friendlier of the two would sit under the harder one. The floor takes
   * the WORST arm.
   *
   * THE MULTIPLIERS, and where they come from. Measured 2026-09-04 the gap
   * between each known-bad and the tightest shipped preset is 0.0421 -> 0.2115
   * (5.0x) on the collapse axis and 0.219% -> 0.715% (3.3x) on the distance
   * axis. 2.5x and 1.8x put each floor near the log-midpoint of its own gap,
   * leaving no less than 1.8x of clearance on BOTH sides. Both margins are
   * printed every run, so the day one of them closes is the day it is visible
   * rather than the day a row flips. */
  const COLLAPSE_ARMS = [
    { label: "az 0 / el 89 — the framing topDownMark shipped at", cam: { azimuthDeg: 0, elevationDeg: 89, fill: 1 } },
    { label: "az 90 / el 0 — the other edge view", cam: { azimuthDeg: 90, elevationDeg: 0, fill: 1 } },
  ]
  const drive = async (cam, name) => {
    await page.evaluate(
      (c) => window.__captureHarness.orbitView(c.azimuthDeg, c.elevationDeg, c.fill),
      cam,
    )
    await wait(420)
    const f = await shot(SAVE ? name : null)
    return { cov: coverage(f), ratio: formRatio(f) }
  }
  for (const a of COLLAPSE_ARMS) a.read = await drive(a.cam, a.cam.elevationDeg === 89 ? "control_edge_on_defect" : "control_edge_on_side")
  /* THE DISTANCE KNOWN-BAD sits at a framing that is otherwise GOOD — the
   * three-quarter hero angle — so the only thing wrong with it is how far out
   * it is. Using a bad angle here would let the collapse show up in the
   * distance row and neither row would be measuring what it names. */
  const tooFarArm = await drive({ azimuthDeg: 38, elevationDeg: 22, fill: 2.5 }, "control_too_far_defect")

  const worstCollapse = Math.max(...COLLAPSE_ARMS.map((a) => a.read.ratio))
  const RATIO_FLOOR = worstCollapse * 2.5
  const COV_FLOOR = tooFarArm.cov * 1.8

  const flattened = defs.filter((p) => R[p.id].ratio <= RATIO_FLOOR)
  const tightest = defs.reduce((m, p) => (R[p.id].ratio < R[m].ratio ? p.id : m), defs[0].id)
  say(
    flattened.length === 0,
    "every framing still shows TWO dimensions of the form — against the two edge-on framings, driven",
    `known-bad ` +
      COLLAPSE_ARMS.map((a) => `${a.cam.azimuthDeg}/${a.cam.elevationDeg} ${a.read.ratio.toFixed(4)}`).join(" · ") +
      `; floor ${RATIO_FLOOR.toFixed(4)} (2.5x the worse arm); presets ` +
      defs.map((p) => `${p.id.slice(0, 12)} ${R[p.id].ratio.toFixed(3)}`).join(" · ") +
      `; clearance ${(R[tightest].ratio / RATIO_FLOOR).toFixed(2)}x at ${tightest}` +
      (flattened.length ? ` — UNDER THE FLOOR: ${flattened.map((p) => p.id).join(", ")}` : ""),
  )
  /* POSITIVE CONTROL — the known-bads are pushed through the ROW'S OWN
   * predicate, not through a looser sentence about them. A must-fail proves the
   * row can say no; this is that must-fail, run every time rather than once. */
  say(
    COLLAPSE_ARMS.every((a) => a.read.ratio <= RATIO_FLOOR),
    "CONTROL · both edge-on framings FAIL the row above's own predicate (or that row cannot say no)",
    COLLAPSE_ARMS.map((a) => `${a.label} → ${a.read.ratio.toFixed(4)} vs floor ${RATIO_FLOOR.toFixed(4)}`).join(" · "),
  )

  const tooSmall = defs.filter((p) => R[p.id].cov <= COV_FLOOR)
  const thinnest = defs.reduce((m, p) => (R[p.id].cov < R[m].cov ? p.id : m), defs[0].id)
  say(
    tooSmall.length === 0,
    "every framing puts enough of the drawing on screen to read — against fill 2.5, F82's 'too far out'",
    `known-bad reads ${(tooFarArm.cov * 100).toFixed(3)}%, floor ${(COV_FLOOR * 100).toFixed(3)}% (1.8x); presets ` +
      defs.map((p) => `${p.id.slice(0, 12)} ${(R[p.id].cov * 100).toFixed(2)}%`).join(" · ") +
      `; clearance ${(R[thinnest].cov / COV_FLOOR).toFixed(2)}x at ${thinnest}` +
      (tooSmall.length ? ` — UNDER THE FLOOR: ${tooSmall.map((p) => p.id).join(", ")}` : ""),
  )
  say(
    tooFarArm.cov <= COV_FLOOR && tooFarArm.ratio > RATIO_FLOOR,
    "CONTROL · the too-far framing FAILS the distance row and PASSES the collapse row — which is why there are two",
    `fill 2.5 → coverage ${(tooFarArm.cov * 100).toFixed(3)}% (floor ${(COV_FLOOR * 100).toFixed(3)}%, fails) · ` +
      `ratio ${tooFarArm.ratio.toFixed(4)} (floor ${RATIO_FLOOR.toFixed(4)}, passes). A single coverage floor could not have ` +
      `told this apart from rakingProfile at ${(R.rakingProfile.cov * 100).toFixed(3)}%.`,
  )

  /* POSITIVE CONTROL — CAN THE MASK SEE THE DRAWING AT ALL? Both instruments
   * read the alpha channel. If `grab()` ever returned an opaque frame, coverage
   * would be ~100% and the ratio would be the frame's own aspect, every row here
   * would pass, and nothing would be measuring the mark. So the reveal is wound
   * back to 0 — nothing drawn — and the mask must go to literally zero ink. */
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await wait(600)
  const blank = await drive({ azimuthDeg: 38, elevationDeg: 22, fill: 1.05 }, SAVE ? "control_blank_reveal0" : null)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await wait(600)
  say(
    blank.cov === 0 && blank.ratio === 0,
    "CONTROL · with the reveal wound to 0 the mask is EMPTY — both instruments are reading the drawing, not the canvas",
    `coverage ${(blank.cov * 100).toFixed(4)}% · ratio ${blank.ratio.toFixed(4)}`,
  )

  /* CONTROL — the deliberately shared framing must render IDENTICALLY. */
  const dShared = diff(R.topDownMark.f, R.glbCleanExport.f)
  say(
    dShared < 0.5,
    "CONTROL · the two presets that share a framing render identically",
    `Δpx ${dShared.toFixed(3)} — topDownMark vs glbCleanExport`,
  )

  const floor = Math.max(1.0, dShared * 5)
  const collapsed = []
  for (let i = 0; i < defs.length; i++) {
    for (let j = i + 1; j < defs.length; j++) {
      const a = defs[i].id
      const b = defs[j].id
      const va = resolveViewPreset(a).camera
      const vb = resolveViewPreset(b).camera
      // Skip the pair we have just proven is shared BY DESIGN.
      if (va.azimuthDeg === vb.azimuthDeg && va.elevationDeg === vb.elevationDeg && va.fill === vb.fill) continue
      if (diff(R[a].f, R[b].f) < floor) collapsed.push(`${a}=${b} (${diff(R[a].f, R[b].f).toFixed(2)})`)
    }
  }
  say(collapsed.length === 0, "every distinct framing renders a distinct shot", collapsed.join(" | ") || `floor ${floor.toFixed(2)} from the control`)

  /* NAMES MATCH BEHAVIOUR — the two claims a framing can make on its own. */
  say(
    R.topDownMark.cov > R.rakingProfile.cov * 1.3,
    "'Top-Down Mark' reads the mark flat; 'Raking Profile' is nearly edge-on",
    `coverage ${(R.topDownMark.cov * 100).toFixed(3)}% vs ${(R.rakingProfile.cov * 100).toFixed(3)}%`,
  )
  say(
    R.stillFrameExport.cov < R.threeQuarterHero.cov,
    "'Still Frame Export' is framed looser than 'Three-Quarter Hero' (fill 1.2 vs 1.05)",
    `coverage ${(R.stillFrameExport.cov * 100).toFixed(3)}% vs ${(R.threeQuarterHero.cov * 100).toFixed(3)}%`,
  )

  /* THE EXPORT HALF — the two targets that exist must work, from the framing
   * their preset asks for. */
  console.log("\n=== the export intents ===")
  const v = resolveViewPreset("glbCleanExport")
  await page.evaluate((c) => window.__captureHarness.orbitView(c.azimuthDeg, c.elevationDeg, c.fill), v.camera)
  await wait(300)
  const glbBytes = await page.evaluate(() => window.__geomDebug.exportBytes())
  say(
    typeof glbBytes === "number" && glbBytes > 1000,
    "'GLB Clean Export' — the GLB writer it names exists and produces a real file",
    `${glbBytes} bytes`,
  )
  const png = await shot(SAVE ? "export_still" : null)
  say(hasAlpha(png), "'Still Frame Export' — the PNG it names carries a real alpha channel", `${png.buf.length} bytes`)

  /* THE BLOCKED MEMBERS — the capability is probed for on the live object.
   * A blocker claimed in a comment is a claim; a blocker measured on the live
   * object is evidence.
   *
   * ⚠ THIS BLOCK PROBED A METHOD NAME THAT HAS NEVER EXISTED (class 1+3).
   *
   *   PARKED PRIOR, exactly as it stood:
   *
   *     const spin = await page.evaluate(() => ({
   *       autoRotateSeen: !!(window.__captureHarness && window.__captureHarness.setAutoRotate),
   *     }))
   *     say(!spin.autoRotateSeen && viewPresetBlockers("portfolioSpin").length === 1,
   *         "'Portfolio Spin' is BLOCKED, and the missing capability is absent on the live harness")
   *
   *   `setAutoRotate` appears NOWHERE in this repo — not in components/, not in
   *   lib/, not in app/. The only occurrence in the whole tree was the line
   *   above, in this file. So `autoRotateSeen` was permanently `false`, not
   *   because the turntable is missing but because nothing was ever named that.
   *   The row was green while asserting something FALSE about the app, and it
   *   would have stayed green if the turntable had been built ten times over.
   *   Probing for a name you invented is not a measurement.
   *
   *   THE TURNTABLE SHIPPED. It is `setSpin` / `getSpin` / `effectiveSpin` on
   *   `window.__captureHarness` (components/viewport-3d.tsx:8300-8308, whose own
   *   comment says it is exposed there "so an assertion can film the spin and
   *   its OFF control through the same setter the 'Portfolio Spin' pill uses"),
   *   driving `autoRotate={autoRotateDegPerSecond > 0}` at viewport-3d.tsx:7513.
   *   `app/page.tsx:1120` routes the preset's `spinDegPerSecond` into it.
   *
   *   So this gate and `assert-preset-routing.mjs` §F contradicted each other
   *   and both were green: §F:272-277 asserts "'Portfolio Spin' is now
   *   selectable — the turntable it needs was built in this change" and dismisses
   *   the blocker as "(stale, other lane's file)". §F is RIGHT. This file was
   *   wrong, and dismissing a disagreeing blocker in a detail string is not a
   *   resolution — so it is asserted here instead, and it is expected to fail
   *   until lib/style-system.ts:4442 is corrected. See the report row below. */
  const spin = await page.evaluate(async () => {
    const h = window.__captureHarness
    const api = {
      setSpin: typeof h?.setSpin === "function",
      getSpin: typeof h?.getSpin === "function",
      effectiveSpin: typeof h?.effectiveSpin === "function",
      // The name the parked assertion probed for, kept so the report can state
      // plainly that it is still absent and always was.
      setAutoRotate: typeof h?.setAutoRotate === "function",
    }
    return api
  })
  say(
    spin.setSpin && spin.getSpin && spin.effectiveSpin,
    "the turntable API EXISTS on the live harness (setSpin / getSpin / effectiveSpin)",
    `setSpin ${spin.setSpin} · getSpin ${spin.getSpin} · effectiveSpin ${spin.effectiveSpin} · setAutoRotate ${spin.setAutoRotate} (the name the parked assertion probed for — absent, and never present in this repo)`,
  )

  /* AND IT TURNS. A capability that answers `typeof === "function"` and moves
   * nothing is the same lie one layer down, so the spin is FILMED: two frames a
   * beat apart with the turntable on must differ, and the same two with it off
   * must not. The OFF arm is the control — without it "the frames differ" could
   * be the per-layer animation that never stopped. */
  const spinPatch = resolveViewPreset("portfolioSpin")
  await page.evaluate(
    (c) => window.__captureHarness.orbitView(c.azimuthDeg, c.elevationDeg, c.fill),
    spinPatch.camera,
  )
  await wait(300)
  await page.evaluate(() => window.__captureHarness.setSpin(0))
  await wait(500)
  const offA = await shot(null)
  await wait(900)
  const offB = await shot(null)
  const dOff = diff(offA, offB)

  await page.evaluate(() => window.__captureHarness.setSpin(90))
  await wait(500)
  const onA = await shot(SAVE ? "spin_on_a" : null)
  await wait(900)
  const onB = await shot(SAVE ? "spin_on_b" : null)
  const dOn = diff(onA, onB)
  const effective = await page.evaluate(() => window.__captureHarness.effectiveSpin())
  await page.evaluate(() => window.__captureHarness.setSpin(0))
  await wait(400)

  say(
    dOn > Math.max(1.0, dOff * 5),
    "…and the turntable actually TURNS THE CAMERA — filmed, against its own OFF control",
    `spin ON Δpx ${dOn.toFixed(2)} vs spin OFF Δpx ${dOff.toFixed(2)} (floor ${Math.max(1.0, dOff * 5).toFixed(2)}), effectiveSpin ${effective}`,
  )
  say(
    effective === 90,
    "CONTROL · the harness reports the spin it is ACTUALLY running, not the one it was asked for",
    `effectiveSpin() returned ${effective} for a requested 90 deg/s`,
  )

  /* THE CONSEQUENCE, ASSERTED RATHER THAN EXCUSED. The capability is present and
   * demonstrated above, so the model must stop calling this member blocked. It
   * still does — `viewPresetBlockers` (lib/style-system.ts:4442-4447) reports the
   * turntable as missing and cites components/viewport-3d.tsx:4768, a line that
   * no longer holds. This row is EXPECTED RED and it is a real source defect,
   * not an instrument fault. Do not soften it; fix the blocker. */
  const spinBlockers = viewPresetBlockers("portfolioSpin")
  say(
    spinBlockers.length === 0,
    "'Portfolio Spin' reports NO blocker, now that the turntable it named is built and filmed above",
    spinBlockers.length
      ? `STALE BLOCKER — viewPresetBlockers("portfolioSpin") still returns ${spinBlockers.length}: "${spinBlockers[0]}". ` +
        `The capability was measured PRESENT and TURNING in the two rows above. Fix lib/style-system.ts:4442 (and the preset's implemented:false at lib/style-system.ts:1562).`
      : "0 blockers",
  )
  /* ⚠ THE VIDEO MEMBER'S ROWS, RE-POINTED — 2026-08-03, and the parked prior is
   * kept verbatim because the way it was WRONG is the lesson.
   *
   *   PARKED PRIOR:
   *     const videoish = videoApi.filter((k) => /video|record|frames|clip|mp4|webm/i.test(k))
   *     say(videoish.length === 0 && viewPresetBlockers("videoPreviewExport").length === 1,
   *         "'Video Preview Export' is BLOCKED, and no video writer exists on either harness")
   *
   *   It probed `__geomDebug` and `__captureHarness` for a video-shaped key. The
   *   writer had shipped in `lib/export/` on 2026-08-01 and `exportVideo` was on
   *   the VIEWPORT API (`apiRef`), which is neither of those objects — so the row
   *   was green for the same reason the turntable row above was green: it was
   *   looking somewhere the capability was never going to be. Two members, one
   *   file, the same class of error, three days apart.
   *
   *   The lesson is in the fix: do not ask a harness whether a capability
   *   exists — ask the PILL to do the thing and look at what lands on disk. This
   *   is exactly how the GLB and PNG members are judged twenty lines up.
   *
   * WHAT MUST STILL HOLD, now that the `else if` is in `applyViewPresetById`:
   *   1 · the member reports no blocker AND the route writes a real file;
   *   2 · a second click while it is rendering starts NOTHING.
   * Both fail on a real defect: re-add the blocker and the pill stops routing;
   * delete the route and no download arrives; delete the re-entrancy guard in
   * `handleExportVideo` and the run counter reaches 2. That last mutation is run
   * for real by `scripts/verify/_probe-video-route.mjs --reentry=allow`, which
   * drives the parked `window.__fsExportReentry = "allow"` arm and requires this
   * row's condition to break. */
  console.log("\n=== the video member: the route, and the one-at-a-time guard ===")
  const videoBlockers = viewPresetBlockers("videoPreviewExport")
  await page.evaluate(() => {
    window.__fsVideoExportRuns = 0
  })
  const dlPromise = page.waitForEvent("download", { timeout: 180000 }).catch(() => null)
  const routed = await page.evaluate(() => window.__styleHarness.selectViewPreset("videoPreviewExport"))
  /* THE SECOND CLICK, WHILE THE FIRST IS STILL RENDERING. Waited for the run to
   * be genuinely in flight first — a second click that lands before the first
   * has started is not a re-entrancy test, it is a race this gate would win by
   * accident. */
  await page.waitForFunction(() => window.__fsVideoExportRuns === 1, null, { timeout: 30000 })
  const secondRouted = await page.evaluate(() => window.__styleHarness.selectViewPreset("videoPreviewExport"))
  await wait(600)
  const runsAfterSecond = await page.evaluate(() => window.__fsVideoExportRuns)
  const dl = await dlPromise
  const dlPath = dl ? await dl.path() : null
  const bytes = dlPath ? readFileSync(dlPath) : null
  /* WHAT KIND OF FILE. WebM opens with the EBML magic 0x1A45DFA3; the APNG
   * fallback is a PNG, magic 0x89 P N G. Anything else — an empty blob, an HTML
   * error page — fails, so "a download happened" cannot stand in for "a film was
   * written". ffmpeg-level decoding of the same file is assert-export-app's job
   * and is deliberately not duplicated here. */
  const isWebm = !!bytes && bytes.length > 4 && bytes.readUInt32BE(0) === 0x1a45dfa3
  const isPng = !!bytes && bytes.length > 8 && bytes.readUInt32BE(0) === 0x89504e47
  say(
    videoBlockers.length === 0 && routed === true && (isWebm || isPng) && bytes.length > 2000,
    "'Video Preview Export' reports NO blocker, and the pill's own route writes a real film",
    `blockers ${videoBlockers.length} · selectViewPreset → ${routed} · ${dl ? dl.suggestedFilename() : "NO DOWNLOAD"} · ${bytes ? bytes.length : 0} bytes · ${isWebm ? "EBML/WebM" : isPng ? "PNG/APNG" : "unrecognised container"}`,
  )
  say(
    runsAfterSecond === 1 && secondRouted === true,
    "…and a second click MID-RENDER starts nothing — one export at a time, guarded where both callers pass",
    `__fsVideoExportRuns after the second click: ${runsAfterSecond} (1 = refused) · the route itself still returned ${secondRouted}, because the refusal belongs to the export and it says so in its own toast`,
  )
  /* THE PLAYHEAD GOES BACK. An export walks the reveal 0→1 and restores it in a
   * `finally`; a view preset that silently moved the user's scrubber would be
   * the same class of defect as one that framed a still and wrote nothing. */
  const playheadAfter = await page.evaluate(() => window.__revealHarness.getProgress())
  say(
    Math.abs(playheadAfter - 1) < 0.02,
    "CONTROL · the export put the reveal back where it found it",
    `progress ${playheadAfter.toFixed(4)} (the injected stroke leaves it at 1)`,
  )
  say(
    viewPresetBlockers("overheadPlan").length === 0 && viewPresetBlockers("glbCleanExport").length === 0,
    "CONTROL · the members that ARE buildable report no blockers",
  )

  say(errors.length === 0, "no console or page errors across the whole run", errors.length ? errors[0] : "0")

  await browser.close()
  console.log(
    fails === 0 ? `\nALL ${checks} VIEW-PRESET ASSERTIONS PASS` : `\n${fails} of ${checks} VIEW-PRESET ASSERTIONS FAILED`,
  )
  process.exit(fails === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
