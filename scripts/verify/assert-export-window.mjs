// assert-export-window.mjs — DOES THE FILM CARRY THE DRAW-IN THE USER AUTHORED?
//
// Lanes B and H made the draw-in an authored decision: a per-stroke SCHEDULE
// (`order` · `overlap` · `align` · `reverse`) and a reveal WINDOW (`Grow` ·
// `Travel` · `Vanish` · `Shrink`). `lib/export/` — the six files that turn the
// animation into a file a user can post — contains **zero** references to any of
// it (`grep -c "stroke-schedule\|scheduleArc\|revealWindow" lib/export/*.ts` is
// 0 on all six). This gate establishes what that costs and holds the fix.
//
//   node scripts/verify/assert-export-window.mjs            # model + browser
//   node scripts/verify/assert-export-window.mjs --model    # no browser
//   node scripts/verify/assert-export-window.mjs --keep     # keep the artefacts
//
// FS_PORT selects the server (DISPATCH §3, "one knob, one name").
//
// ── THE FOUR QUESTIONS, AND WHERE EACH IS SETTLED ─────────────────────────
//
//   1 · does an export of a NON-IDENTITY schedule contain the motion the
//       viewport shows?                                        §B, per frame
//   2 · does the frame plan's duration still match the beat?    §A4, 300 schedules
//   3 · Vanish and Shrink START FULL and END EMPTY. What does
//       the hold mean then?                                    §A3 + §B5
//   4 · does GLB carry any of it?                              §B6, sha256
//   5 · does the FIX REACH THE BUTTON?                          §D, downloaded files
//
// ── §D EXISTS BECAUSE THE MODEL LAYER PASSING PROVES NOTHING ABOUT THE APP ─
// Measured 2026-08-28. `holdSuppressed` was forced back to `false` in
// `frame-plan.ts` — the ends-full assumption, restored — and `assert-export-plan.mjs`
// still read 11 PASS · 0 FAIL while §A here went red on 2 rows. So the MODEL was
// gated and the CALL SITE was not: nothing under `scripts/` referenced
// `__fsExportRevealEnds`, the parked prior built for exactly this, and §A–§B
// compute `revealEnds` themselves before handing it to the module. Deleting
// `revealEnds:` from `components/viewport-3d.tsx` would have put 18 frames of
// blank paper back on every Travel / Vanish / Shrink film with every gate green.
// §D presses the real Video button and measures the file Chrome wrote.
//
// ── WHY THE COMPARISON IS DECOMPOSED RATHER THAN ASKED IN ONE ROW ─────────
//
// "The export matches the viewport" is two independent claims and a single row
// covering both can pass for the wrong reason. They are separated:
//
//   (a) THE EXPORT'S SEEK IS THE VIEWPORT'S SEEK. One film rendered by
//       `exportAnimation` walking its own plan, one rendered by this script
//       calling `__revealHarness.setProgress` at the plan's own playheads —
//       same host, same grab, same encoder, so the two are comparable BYTE FOR
//       BYTE and any difference is the export's.
//   (b) THE SCHEDULE REACHES THE EXPORT AT ALL. The scheduled film against the
//       identity film. If (a) passed and (b) came back identical, the export
//       would be faithfully filming a schedule that never rendered — which is
//       exactly the failure mode the architecture would disguise, because
//       everything rides one scalar and one scalar always looks fine.
//
//   (b) is (a)'s KNOWN-BAD: a row that cannot tell a reordered word from an
//   as-drawn one is measuring the encoder, not the feature.
//
// ── LOSSLESS, OPAQUE, ON PURPOSE ──────────────────────────────────────────
// `format: "apng", transparent: false`. APNG so the decode is exact (hashing a
// VP9 file asks whether libvpx is bit-reproducible, which is a question about a
// codec — `assert-export-app.mjs` failed exactly there on its first run), and
// OPAQUE so every pixel lands at alpha 255 and no premultiplied round trip sits
// between two frames that are supposed to be equal.
import { chromium } from "./lib/browser.mjs"
import { LAB_URL } from "./lib/dev-server.mjs"
import ts from "typescript"
import { execFileSync, spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { createRequire } from "node:module"
import { loadTs } from "./_ts-load.mjs"
import { makePaired } from "./lib/paired.mjs"

const require = createRequire(import.meta.url)
const FFMPEG = require("ffmpeg-static")
const { createCanvas, loadImage } = require("@napi-rs/canvas")
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..", "..")
const OUT = join(ROOT, "docs", "verification", "export-window")

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const MODEL_ONLY = process.argv.includes("--model")
const KEEP = process.argv.includes("--keep")
/* ⚠ THIS FILE USED TO READ `process.env.FS_PORT ?? "3000"` AND BUILD ITS OWN URL.
 * That HONOURED the one knob and was still wrong, and the reason is the whole
 * design of `lib/dev-server.mjs`: the module resolves the port AND THROWS on a
 * legacy name (`HERO_URL`/`LAB_URL`/`FS_URL`). A private copy of the port line
 * takes the first half and opts out of the second — set the name muscle memory
 * reaches for and this gate ignored it in silence and measured :3000.
 * "Reads FS_PORT" was never the bar; "imports the shared resolver" is.
 * Explainer 28 §3.2; `assert-one-knob.mjs` channel B, which was RED on this file
 * and this file alone once Lane Y paid the other six sites down. */
const BASE = LAB_URL
/** Where the page gets `lib/export/**` from. `--before=<dir>` serves a snapshot. */
const BEFORE_DIR = arg("before", null)

let pass = 0
let fail = 0
const row = (ok, name, detail) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  —  ${detail}` : ""}`)
  ok ? pass++ : fail++
}
/** A row with a control that MUST come back false, or the row proves nothing. */
/* ONE PLACE OF TRUTH, and it fixes a real defect. This file's own copy
 * swallowed a THROWING control into `b = false`, so `ok = a && !b`
 * collapsed to `a` and the row PASSED while its control was crashing.
 * See scripts/verify/lib/paired.mjs for the measurement. */
const paired = makePaired(row)

/* ==========================================================================
 * RASTER HELPERS — PORTED VERBATIM from `assert-stroke-schedule.mjs`.
 *
 * §0.7 and explainer 35 §3: the shape guard lives INSIDE the helpers, not
 * beside them, because the defect is that they answer a question they were not
 * asked. This viewport is a flex child whose height follows the geometry mode's
 * config strip, so a run that switches engines resizes the raster — measured at
 * 799×1508 -> 799×1468 — and every helper here walks the FIRST buffer's length.
 * ======================================================================== */
/* ==PURE-BEGIN== `_probe-crosscheck-export-window.mjs` slices from here to
 * ==PURE-END== and runs it in plain node, so nothing in between may touch the
 * page, the disk or a module-level binding declared outside it. */
const rasterGuard = { comparisons: 0, mismatches: [] }
function sameShape(a, b, where) {
  rasterGuard.comparisons++
  const aw = a.w ?? a.length
  const ah = a.h ?? 1
  const bw = b.w ?? b.length
  const bh = b.h ?? 1
  if (aw !== bw || ah !== bh) {
    rasterGuard.mismatches.push(`${where}: ${aw}x${ah} vs ${bw}x${bh}`)
    return false
  }
  return true
}
async function pixels(png) {
  const img = await loadImage(png)
  const c = createCanvas(img.width, img.height)
  c.getContext("2d").drawImage(img, 0, 0)
  return { w: img.width, h: img.height, d: c.getContext("2d").getImageData(0, 0, img.width, img.height).data }
}
function inkMask(a, empty, thresh = 12) {
  sameShape(a, empty, "inkMask")
  const n = a.d.length / 4
  const m = new Uint8Array(n)
  let count = 0
  for (let i = 0; i < n; i++) {
    const p = i * 4
    const dd = Math.max(
      Math.abs(a.d[p] - empty.d[p]),
      Math.abs(a.d[p + 1] - empty.d[p + 1]),
      Math.abs(a.d[p + 2] - empty.d[p + 2]),
      Math.abs(a.d[p + 3] - empty.d[p + 3]),
    )
    if (dd > thresh) {
      m[i] = 1
      count++
    }
  }
  return { m, count, w: a.w, h: a.h }
}
function iou(A, B) {
  sameShape(A, B, "iou")
  let inter = 0
  let uni = 0
  for (let i = 0; i < A.m.length; i++) {
    if (A.m[i] || B.m[i]) uni++
    if (A.m[i] && B.m[i]) inter++
  }
  return uni > 0 ? inter / uni : 1
}
function differingPixels(a, b, thresh = 0) {
  sameShape(a, b, "differingPixels")
  let n = 0
  for (let i = 0; i < a.d.length; i += 4) {
    const dd = Math.max(
      Math.abs(a.d[i] - b.d[i]),
      Math.abs(a.d[i + 1] - b.d[i + 1]),
      Math.abs(a.d[i + 2] - b.d[i + 2]),
      Math.abs(a.d[i + 3] - b.d[i + 3]),
    )
    if (dd > thresh) n++
  }
  return n
}
/** Mean x of the inked pixels, as a fraction of width. Direction, in one number. */
function inkCentroidX(mask) {
  let sum = 0
  let n = 0
  for (let i = 0; i < mask.m.length; i++) {
    if (mask.m[i]) {
      sum += i % mask.w
      n++
    }
  }
  return n > 0 ? sum / n / mask.w : NaN
}
/**
 * The inked pixels' horizontal EXTENT, as a fraction of the raster's width.
 *
 * 🔴 THE UNIT EVERY HORIZONTAL BAR IN THIS FILE HAS TO BE IN. `inkCentroidX`
 * divides by the RASTER width, so a centroid bar written as a fraction of the
 * frame is sized for a mark that FILLS the frame. Measured 2026-09-04 on this
 * fixture: the finished mark spans x 240..558 of a 798 px film — **319 px, 40.0
 * % of the width** — because the drawing canvas's 0.10..0.90 lands at 0.30..0.70
 * once the 3-D viewport frames it. A bar in frame units is off by 2.5x here, and
 * it moves again with the camera. Same class as `blank`'s `lastInk <= peak *
 * 0.10` a thousand lines down, which is relative and never needed touching.
 */
function inkSpanX(mask) {
  let lo = Infinity
  let hi = -Infinity
  for (let i = 0; i < mask.m.length; i++) {
    if (mask.m[i]) {
      const x = i % mask.w
      if (x < lo) lo = x
      if (x > hi) hi = x
    }
  }
  return lo === Infinity ? 0 : (hi - lo + 1) / mask.w
}

/* ── F113 FINDING 10, Codex 2026-09-18: THREE ROWS THAT PASSED ON NOTHING ──
 *
 * 1 · Q1's order control. An EMPTY harness film gives `inkCentroidX` NaN on
 *     every frame, `Math.abs(NaN) > maxD` is false, so `maxD` stayed 0 and the
 *     control "did not fire", which is what a healthy control does. Codex zeroed
 *     every harness mask and the pair passed. A side with no centroid on a
 *     drawing frame is now UNMEASURED, and an unmeasured control fails the pair.
 * 2 · Q4's GLB. `h("")` is "none", so three empty exports hashed equal, read as
 *     "stable", and the row passed on a census alone. Each export now has to be
 *     a real glTF 2.0 binary: magic, version, and a declared length that is the
 *     buffer's length.
 * 3 · §D's Vanish films. `blank` is `lastInk <= peak * 0.10`, and 0 <= 0, so an
 *     all-blank download passed the headline on its frame counts. Each Vanish
 *     film now has to reach ink, at the same 10% bar `blank` uses, of the
 *     finished mark the grow download from the same button ends on. */
const ORDER_CX_BAR = 0.15
const ORDER_IOU_FLOOR = 0.5
function measureOrder(mS, other, draw) {
  let minIoU = 2
  let minAt = -1
  let maxD = 0
  let maxAt = -1
  let rightward = 0
  let unmeasured = 0
  for (const i of draw) {
    const j = iou(mS[i], other[i])
    if (j < minIoU) { minIoU = j; minAt = i }
    const a = inkCentroidX(mS[i])
    const b = inkCentroidX(other[i])
    if (!Number.isFinite(a) || !Number.isFinite(b)) { unmeasured++; continue }
    const d = a - b
    if (Math.abs(d) > maxD) { maxD = Math.abs(d); maxAt = i }
    if (d > 0) rightward++
  }
  return { minIoU, minAt, maxD, maxAt, rightward, unmeasured }
}
const orderFires = (m, drawLen) =>
  m.unmeasured === 0 && m.minIoU < ORDER_IOU_FLOOR && m.maxD > ORDER_CX_BAR && m.rightward === drawLen
/** The control FAILS the pair when it looks reordered OR cannot be measured. */
const orderControlFires = (m, drawLen) => m.unmeasured > 0 || orderFires(m, drawLen)

function glbCheck(b64) {
  if (typeof b64 !== "string" || b64.length === 0) return { ok: false, why: "empty export" }
  const buf = Buffer.from(b64, "base64")
  if (buf.length < 20) return { ok: false, why: `${buf.length} bytes, shorter than a GLB header and one chunk` }
  const magic = buf.readUInt32LE(0) === 0x46546c67
  const version = buf.readUInt32LE(4)
  const declared = buf.readUInt32LE(8)
  if (!magic) return { ok: false, why: "no glTF magic" }
  if (version !== 2) return { ok: false, why: `glTF version ${version}` }
  if (declared !== buf.length) return { ok: false, why: `header says ${declared} bytes, buffer is ${buf.length}` }
  return { ok: true, why: `${buf.length} bytes, glTF 2` }
}

const vanishReachesInk = (c, growMark) => growMark > 0 && c.peak > 0 && c.peak >= growMark * 0.10
/* ==PURE-END== */

/* ==========================================================================
 * §A · THE MODEL — exact claims, in plain node, no browser.
 * ======================================================================== */
const { windowAt, buildStrokeSchedule, DRAW_IN_DEFAULTS } = loadTs("lib/stroke-schedule.ts")
const framePlan = loadTs("lib/export/frame-plan.ts")
const { planFrames } = framePlan

const MODES = ["grow", "travel", "vanish", "shrink"]
const PEN_MS = 4237
const HOLD_MS = 600 // viewport-3d.tsx:11479 — hard-coded on the shipped path.

console.log("\n──── §A · THE MODEL ────────────────────────────────────────────────\n")

/* A1 · What the reveal SHOWS at the plan's two clock endpoints. */
{
  const at = (mode, d) => windowAt({ mode, length: 0.25 }, d)
  const endsEmpty = MODES.filter((m) => at(m, 1).empty)
  const startsFull = MODES.filter((m) => at(m, 0).whole)
  paired(
    "three of the four window modes END on an EMPTY reveal, and two START full",
    () => endsEmpty.length === 3 && startsFull.length === 2 && !at("grow", 1).empty,
    "`grow` — the shipped default — must NOT be one of them",
    () => at("grow", 1).empty,
    `ends empty at d=1: [${endsEmpty}] · starts whole at d=0: [${startsFull}]`,
  )
}

/* A2 · The plan's phases, at the app's own shipped inputs. */
let holdFrames = 0
{
  const p = planFrames({ penDurationMs: PEN_MS, fps: 30, timebase: "pen", holdMs: HOLD_MS })
  holdFrames = p.frames.filter((f) => f.phase === "hold").length
  const drawFrames = p.frames.filter((f) => f.phase === "draw").length
  row(
    holdFrames === 18 && drawFrames === 128 && p.frames.length === 146,
    "the shipped plan is lead 0 · draw 128 · hold 18 at 30 fps with a 600 ms hold",
    `${p.frames.length} frames · draw ${drawFrames} · hold ${holdFrames} · ${p.durationMs.toFixed(1)}ms`,
  )
}

/* A3 · 🔴 THE DEFECT, COUNTED. Five of the eight (mode × reverse) states this
 * app can reach put every hold frame on BLANK PAPER — including `grow` under
 * the transport's own Reverse toggle, which has shipped since before the
 * schedule existed. `reverse` flips the CLOCK (frame-plan.ts:193) and not the
 * PHASE, so the frames labelled `hold` carry clock 0 there. */
let blankTail = []
let heldAnyway = []
{
  /* Stated on the PLAN'S OWN REPORT rather than reconstructed from `windowAt`
   * plus a clock, because the first draft did the reconstruction and then
   * crashed on its own fix: once a blank hold is dropped there ARE no hold
   * frames to read a clock off. A row that can only be evaluated in the world
   * it was written for is not a measurement, it is a snapshot. */
  for (const reverse of [false, true]) {
    for (const mode of MODES) {
      const ends = framePlan.revealEndsFor ? framePlan.revealEndsFor(mode) : undefined
      const p = planFrames({
        penDurationMs: PEN_MS, fps: 30, timebase: "pen", holdMs: HOLD_MS, reverse,
        ...(ends ? { revealEnds: ends } : {}),
      })
      const tag = `${mode}${reverse ? "+rev" : ""}`
      const shows =
        p.holdShows ??
        (windowAt({ mode, length: 0.25 }, p.frames.filter((f) => f.phase === "hold")[0].clock).empty ? "empty" : "full")
      if (shows === "empty") {
        blankTail.push(tag)
        /* THE PADDING, NOT THE CLOSING FRAME. A suppressed hold still leaves
         * ONE frame at the end instant — that is the clamp two rows down, and
         * it is a frame the film needs. What must be gone is the other 17. */
        const held = p.frames.filter((f) => f.phase === "hold").length
        if (p.holdMs !== 0 || held > 1) heldAnyway.push(`${tag}(${held})`)
      }
    }
  }
  paired(
    "🔴 the 600 ms hold would land on BLANK PAPER in five of the eight reachable states",
    () => blankTail.length === 5 && blankTail.includes("grow+rev") && blankTail.includes("vanish"),
    "the shipped default `grow` forward must NOT be one of them",
    () => blankTail.includes("grow"),
    `${blankTail.length}/8 would be blank-tailed: [${blankTail.join(", ")}] · ${holdFrames} frames each at 30 fps`,
  )
  paired(
    "🔴 …and in every one of those five the hold is actually DROPPED, not merely noticed",
    () => heldAnyway.length === 0,
    "…and the other three keep theirs, or the fix has deleted the hold outright",
    () => {
      const kept = MODES.filter((m) => {
        const p = planFrames({
          penDurationMs: PEN_MS, fps: 30, timebase: "pen", holdMs: HOLD_MS,
          ...(framePlan.revealEndsFor ? { revealEnds: framePlan.revealEndsFor(m) } : {}),
        })
        return p.frames.filter((f) => f.phase === "hold").length > 0
      })
      return kept.length === 0
    },
    heldAnyway.length ? `still holding on paper: [${heldAnyway.join(", ")}]` : "0 of the 5 still write a blank hold",
  )
}

/* A4 · Q2 · Does `T` move the beat's length in PLAYHEAD units? The dispatch's
 * premise was that it does. It does not, and the reason is one line of the
 * model: `S(a) = (u_i + (a − a_i)) / T` — the division BY `T` is the
 * normalisation, so `S` ranges over [0,1] whatever `T` is. Swept rather than
 * argued. */
{
  const LENS = [0.05, 0.3, 0.1, 0.4, 0.15]
  let acc = 0
  const spans = LENS.map((l) => {
    const from = acc
    acc += l
    return { from, to: acc }
  })
  let worst = 0
  let combos = 0
  let Tseen = new Set()
  for (const order of ["asDrawn", "reversed", "byLength", "byPosition", "random"])
    for (const overlap of [0, 0.25, 0.5, 0.75, 1])
      for (const align of ["start", "end"])
        for (const unit of ["group", "stroke"])
          for (const reverse of ["off", "all", "alternate"]) {
            const s = buildStrokeSchedule(
              { spans, unitOf: [0, 0, 1, 2, 2], positionOf: [1, 2, 3, 4, 5] },
              { ...DRAW_IN_DEFAULTS, order, overlap, align, unit, reverse },
            )
            combos++
            Tseen.add((1 / s.scale).toFixed(4))
            worst = Math.max(
              worst,
              Math.abs(Math.max(...s.tracks.map((t) => t.end)) - 1),
              Math.abs(Math.min(...s.tracks.map((t) => t.start))),
            )
          }
  paired(
    "Q2 · the beat's extent in PLAYHEAD units is [0,1] on every schedule — the plan is neither truncated nor padded",
    () => worst < 1e-12 && combos === 300,
    "…and T really did move, or this row is measuring one schedule 300 times",
    () => Tseen.size <= 1,
    `${combos} schedules · worst |edge − bound| = ${worst.toExponential(3)} · ${Tseen.size} distinct T in [${[...Tseen].sort()[0]}…${[...Tseen].sort().reverse()[0]}]`,
  )
}

/* A4b · 🔴 THE COPIED FACT, GATED — the same treatment `EXPORT_PAPER` gets.
 *
 * `lib/export/` may not import an app module, so `REVEAL_WINDOW_ENDS` is a hand
 * copy of what `windowAt` does at its two endpoints. A copied constant that
 * goes stale while the file still looks current is a failure this repo has
 * caught twice, so every cell is recomputed here from the REAL model and the
 * row fails if the two ever disagree. */
if (framePlan.REVEAL_WINDOW_ENDS) {
  const state = (w) => (w.empty ? "empty" : w.whole ? "full" : "partial")
  const wrong = []
  for (const mode of MODES) {
    const real = { at0: state(windowAt({ mode, length: 0.25 }, 0)), at1: state(windowAt({ mode, length: 0.25 }, 1)) }
    const copy = framePlan.revealEndsFor(mode)
    if (real.at0 !== copy.at0 || real.at1 !== copy.at1)
      wrong.push(`${mode}: model ${real.at0}/${real.at1} vs copy ${copy.at0}/${copy.at1}`)
  }
  paired(
    "the plan's copy of the window's endpoints agrees with `windowAt` itself, cell by cell",
    () => wrong.length === 0 && Object.keys(framePlan.REVEAL_WINDOW_ENDS).length === MODES.length,
    "…and an unknown mode falls back to `grow` rather than inventing an answer",
    () => framePlan.revealEndsFor("vanishh").at1 !== "full",
    wrong.length ? wrong.join(" · ") : `${MODES.length} modes checked against the real windowAt`,
  )
} else {
  row(false, "the plan's copy of the window's endpoints agrees with `windowAt` itself", "REVEAL_WINDOW_ENDS not implemented yet")
}

/* A5 · THE FIX, at the model layer. `revealEnds` tells the plan what the reveal
 * SHOWS at its two clock endpoints; the plan then knows whether its hold is a
 * held mark or held nothing. Absent, the default is `grow` — which is what
 * shipped, which is why the default stays byte-identical. */
{
  const has = typeof framePlan.describeRevealEnds === "function"
  if (!has) {
    row(false, "the plan can be TOLD what the reveal shows at its endpoints (`revealEnds`)", "not implemented yet")
    row(false, "🔴 …and it drops a hold that would be blank paper", "not implemented yet")
    row(false, "…while an explicit `holdOnEmpty` keeps it, so nothing is silently decided", "not implemented yet")
  } else {
    const vanish = planFrames({
      penDurationMs: PEN_MS, fps: 30, timebase: "pen", holdMs: HOLD_MS,
      revealEnds: { at0: "full", at1: "empty" },
    })
    const grow = planFrames({ penDurationMs: PEN_MS, fps: 30, timebase: "pen", holdMs: HOLD_MS })
    const forced = planFrames({
      penDurationMs: PEN_MS, fps: 30, timebase: "pen", holdMs: HOLD_MS,
      revealEnds: { at0: "full", at1: "empty" }, holdOnEmpty: true,
    })
    const growRev = planFrames({
      penDurationMs: PEN_MS, fps: 30, timebase: "pen", holdMs: HOLD_MS, reverse: true,
    })
    paired(
      "the plan reports what its own HOLD frames show, and gets `reverse` right",
      () => grow.holdShows === "full" && vanish.holdShows === "empty" && growRev.holdShows === "empty" && growRev.leadShows === "full",
      "…and it is not just echoing the input — `grow` forward must read `full`",
      () => grow.holdShows !== "full",
      `grow ${grow.leadShows}→${grow.holdShows} · vanish ${vanish.leadShows}→${vanish.holdShows} · grow+reverse ${growRev.leadShows}→${growRev.holdShows}`,
    )
    paired(
      "🔴 a hold that would be blank paper is DROPPED, and the drop is on the record",
      () =>
        vanish.holdMs === 0 &&
        vanish.holdSuppressed === true &&
        vanish.holdMsRequested === HOLD_MS &&
        grow.frames.length - vanish.frames.length === 18 &&
        vanish.frames.filter((f) => f.phase === "hold").length === 1,
      "…and the shipped default keeps its hold, or the fix has eaten the feature",
      () => grow.frames.filter((f) => f.phase === "hold").length !== 18 || grow.holdSuppressed === true,
      `vanish ${vanish.frames.length} frames — 18 fewer than grow's ${grow.frames.length} — holdMs ${vanish.holdMs} of ${vanish.holdMsRequested} requested, ` +
        `${vanish.frames.filter((f) => f.phase === "hold").length} closing frame · grow keeps its 18`,
    )
    paired(
      "…and `holdOnEmpty` keeps it, so this is a DEFAULT and not a decision taken away",
      () => forced.frames.filter((f) => f.phase === "hold").length === 18 && forced.holdSuppressed === false,
      "…and it is not simply ignoring `revealEnds`",
      () => forced.holdShows !== "empty",
      `holdOnEmpty:true → ${forced.frames.length} frames, hold ${forced.frames.filter((f) => f.phase === "hold").length}, holdShows=${forced.holdShows}`,
    )
    row(
      /ends on empty paper/.test(framePlan.describePlan(vanish)) && !/ends on empty paper/.test(framePlan.describePlan(grow)),
      "the panel SENTENCE says it, so a user is told before they press the button",
      JSON.stringify(framePlan.describePlan(vanish)),
    )

    /* 🔴 THE CLOSING FRAME, at the model layer. Found by the raster row below
     * and pinned here, because it is exact arithmetic and a raster could only
     * approximate it. `holdMs: 0` on a duration that is not a whole number of
     * frames used to leave the LAST frame at clock 0.986537 — the mark 1.35 %
     * unfinished on the frame that is supposed to be the end. */
    const noHold = planFrames({ penDurationMs: 1436, fps: 24, timebase: "pen", holdMs: 0 })
    const noHoldRev = planFrames({ penDurationMs: 1436, fps: 24, timebase: "pen", holdMs: 0, reverse: true })
    const exact = planFrames({ penDurationMs: 1000, fps: 30, timebase: "pen", holdMs: 0 })
    const lastOf = (p) => p.frames[p.frames.length - 1]
    paired(
      "🔴 with NO hold, the last frame still lands on the END instant — in both directions",
      () => lastOf(noHold).clock === 1 && lastOf(noHoldRev).clock === 0 && noHold.frames.length === 35 && noHold.closingFrameClamped === true,
      "…and it is a no-op on a duration that is a whole number of frames, or it is papering over the count",
      () => exact.closingFrameClamped === true,
      `1436ms@24fps holdMs 0: ${noHold.frames.length} frames, last clock ${lastOf(noHold).clock}` +
        ` (was 0.986537) · reversed last clock ${lastOf(noHoldRev).clock}` +
        ` · 1000ms@30fps: clamped=${exact.closingFrameClamped}, last clock ${lastOf(exact).clock}`,
    )
    paired(
      "…and the shipped default — which HAS a hold — is untouched by that clamp",
      () => grow.closingFrameClamped === false && grow.frames.length === 146 && lastOf(grow).clock === 1,
      "…and the clamp is reachable at all, or this row passes because nothing was built",
      () => noHold.closingFrameClamped === false,
      `grow with a 600ms hold: ${grow.frames.length} frames, clamped=${grow.closingFrameClamped}, last clock ${lastOf(grow).clock}`,
    )
  }
}

if (MODEL_ONLY) {
  console.log(`\nassert-export-window (model only): ${pass} PASS · ${fail} FAIL`)
  process.exit(fail === 0 ? 0 : 1)
}

/* ==========================================================================
 * §B · THE BROWSER — the real app, a real stroke, the real module.
 * ======================================================================== */
console.log("\n──── §B · THE REAL APP ─────────────────────────────────────────────\n")

const MODULES = ["frame-plan", "webm", "webm-alpha", "apng", "gif", "encoders", "recorder", "index"]
function transpiled(name, dir) {
  const src = readFileSync(join(dir, `${name}.ts`), "utf8")
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    fileName: `${name}.ts`,
  }).outputText
  return js.replace(/from\s+["']\.\/([a-z-]+)["']/g, 'from "./$1.js"')
}
/** Serve `lib/export/**` to the page as ES modules, from a NAMED directory.
 *  Two mounts, so one page session can run the shipped module and a snapshot of
 *  the module as it was before this lane touched it — which is the only way a
 *  byte-identity control is a comparison and not two sessions. */
async function serveModules(page, mount, dir) {
  for (const m of MODULES) {
    await page.route(`${BASE}${mount}/${m}.js`, (route) =>
      route.fulfill({ status: 200, contentType: "text/javascript", body: transpiled(m, dir) }),
    )
  }
}

mkdirSync(OUT, { recursive: true })
const TMP = join(OUT, "_tmp")
rmSync(TMP, { recursive: true, force: true })
mkdirSync(TMP, { recursive: true })

const browser = await chromium.launch()
/* `acceptDownloads` IS §D. The claim that section ends on is about the FILE THE
 * BUTTON WRITES, so the file has to survive the click; without this Playwright
 * cancels the download and the section could only ever assert about the page. */
const context = await browser.newContext({
  viewport: { width: 1600, height: 1500 },
  deviceScaleFactor: 1,
  acceptDownloads: true,
})
const page = await context.newPage()
const pageErrors = []
page.on("pageerror", (e) => pageErrors.push(String(e)))
const consoleErrors = []
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text())
})

await serveModules(page, "/__fsexport", join(ROOT, "lib", "export"))
if (BEFORE_DIR) await serveModules(page, "/__fsexport_before", BEFORE_DIR)

await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 })
await page.waitForFunction(() => !!window.__revealHarness && !!window.__captureHarness, null, { timeout: 240000 })

/* A REAL STROKE, WITH THE BROWSER'S OWN TIMESTAMPS. Two strokes, deliberately
 * unequal and at opposite ends of the page, because every claim below is about
 * WHICH part draws WHEN and a single stroke cannot be reordered. */
const box = await page.locator('canvas[aria-label*="Drawing canvas"]').boundingBox()
/**
 * ⚠ THE SETTLE USED TO RUN BETWEEN THE TWO STROKES, AND IT WENT INTO THE FILM.
 *
 * `getTotalDuration()` is the first recorded timestamp to the last, so every
 * millisecond the driver spends with the pen UP between stroke one and stroke
 * two is pen time in which nothing was drawn, and the export dutifully films it.
 * A fixed `waitForTimeout(400)` inside this helper put that pause in the middle
 * of every film §B measures, and `page.mouse.move` under load stretched it
 * further: four runs across two trees read 1342, 1356, 1897 and 2164 ms for the
 * same two strokes. That is what made §B3 flaky, and lane N3 measured it and
 * said so rather than moving the row's bar (row F19).
 *
 * So the settle is now the CALLER's, and the strokes are drawn back to back.
 * The last one still settles, because §B needs the recording committed before it
 * reads anything; that wait is after the final timestamp and is not in the film.
 * The gap that IS in the film is measured below and printed on every run, so the
 * next person to see a flaky §B row has the number rather than the suspicion.
 */
async function drawStroke(x0, y0, x1, y1, n, arc, settleMs) {
  await page.mouse.move(box.x + x0, box.y + y0)
  await page.mouse.down()
  const firstPoint = Date.now()
  for (let i = 1; i <= n; i++) {
    const t = i / n
    await page.mouse.move(box.x + x0 + t * (x1 - x0), box.y + y0 + t * (y1 - y0) - arc * Math.sin(t * Math.PI))
    await page.waitForTimeout(20)
  }
  const lastPoint = Date.now()
  await page.mouse.up()
  if (settleMs > 0) await page.waitForTimeout(settleMs)
  return { firstPoint, lastPoint }
}
const strokeA = await drawStroke(box.width * 0.10, box.height * 0.40, box.width * 0.42, box.height * 0.40, 18, box.height * 0.16, 0)
const strokeB = await drawStroke(box.width * 0.56, box.height * 0.66, box.width * 0.90, box.height * 0.66, 18, -box.height * 0.14, 400)
await page.waitForTimeout(2000)

/* The driver's own clock, not the page's: how long the pen was up between the
 * two strokes, against how long the whole gesture took. The page's
 * `getTotalDuration()` measures the same span from its own timestamps, so the
 * two are printed side by side and a disagreement is visible. */
const gapMs = strokeB.firstPoint - strokeA.lastPoint
const driverMs = strokeB.lastPoint - strokeA.firstPoint
const penMs = await page.evaluate(() => window.__revealHarness.getTotalDuration())
row(
  penMs > 400,
  "two real strokes were drawn BACK TO BACK and carry real pen timing",
  `totalDuration=${penMs.toFixed(1)}ms · driver ${driverMs}ms · pen-up gap between the strokes ${gapMs}ms = ${(
    (gapMs / driverMs) *
    100
  ).toFixed(1)}% of the gesture`,
)

/* 🔴 THE CAPTURE SAYS WHAT IT GRABBED — explainer 35. `firstUnderContainer`
 * false means the old position-based selector and the ref disagree, i.e. every
 * frame below would have been of something else. Asked BEFORE any measurement. */
const gi0 = await page.evaluate(() => window.__captureHarness.grabInfo())
row(
  !!gi0 && gi0.firstUnderContainer === true,
  "the grab resolves its subject by IDENTITY and position still agrees (explainer 35)",
  JSON.stringify(gi0),
)

await page.evaluate(() => {
  window.__revealHarness.setEase("linear")
  window.__revealHarness.setPlaying(false)
})

/* ---------------------------------------------------------------------- */
/*  ONE FILM = one `exportAnimation` run. Two drive modes, one host.       */
/* ---------------------------------------------------------------------- */
/**
 * `drive: "plan"`  — `exportAnimation` walks its own plan and seeks.
 * `drive: "harness"` — the host IGNORES the export's seek and calls
 *                    `__revealHarness.setProgress` at the SAME playheads.
 * Same host, same grab, same encoder, so the two films are comparable byte for
 * byte and any difference is the export's own seek.
 */
async function film(tag, { drive = "plan", mount = "/__fsexport", opts = {} } = {}) {
  const res = await page.evaluate(
    async ({ mount, drive, opts }) => {
      const mod = await import(`${mount}/index.js`)
      const rh = window.__revealHarness
      const ch = window.__captureHarness
      const info = ch.grabInfo()
      const sizes = {}
      const seen = []
      const settle = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      /* The playheads the plan will ask for, computed up front so the harness
       * arm can walk exactly the same list without the export telling it. */
      /* ── THE HANDOVER LINE, RUN RATHER THAN DESCRIBED ────────────────────
       * This is the entire diff `components/viewport-3d.tsx` needs (Lane M's
       * file, not this lane's): read the live window mode and hand the export
       * what the reveal shows at its two ends. `unwired: true` films the
       * behaviour WITHOUT it, which is the known-bad. */
      const ends =
        opts.unwired || !mod.revealEndsFor ? null : mod.revealEndsFor(rh.window().mode)
      const extra = {
        ...(ends ? { revealEnds: ends } : {}),
        ...(opts.holdOnEmpty ? { holdOnEmpty: true } : {}),
      }
      const plan = mod.planFrames({
        penDurationMs: rh.getTotalDuration(), fps: opts.fps ?? 24, timebase: "pen",
        holdMs: opts.holdMs ?? 600, reverse: !!opts.reverse, ...extra,
      })
      const wanted = plan.frames.map((f) => rh.ease(f.clock, "linear"))
      let i = 0
      /* ⚠ A SEPARATE COUNTER, AND THIS IS NOT TIDINESS — IT IS THE OFF-BY-ONE.
       * `exportAnimation` takes ONE PROBE grab before the loop to size the
       * encoder (`lib/export/index.ts:118`, "thrown away"), so a seek counter
       * that rode `grabFrame` would be one ahead from the first frame onwards.
       * Measured on the first run of this gate: 35 of 49 frames differed — and
       * 35 is exactly the 49 frames minus the 14 identical hold frames, i.e.
       * every frame where the picture was moving. A one-frame shift is the
       * single most plausible way for this comparison to be wrong while looking
       * like a finding, so the counter is its own. */
      let seekN = 0
      const host = {
        seek: async (p) => {
          /* THE SAME THREE WRITES EITHER WAY. On the harness arm the value comes
           * from the pre-computed list rather than from the export, which is the
           * whole isolation: if the export's plan+ease put the scene somewhere
           * else, these two films differ and nothing else can have caused it. */
          rh.setProgress(drive === "harness" ? wanted[Math.min(seekN, wanted.length - 1)] : p)
          seekN++
        },
        easePlayhead: (c) => rh.ease(c, "linear"),
        settle,
        async grabFrame() {
          const url = ch.grab()
          if (!url) return null
          const gi = ch.grabInfo()
          sizes[`${gi.width}x${gi.height}`] = (sizes[`${gi.width}x${gi.height}`] ?? 0) + 1
          if (gi.firstUnderContainer !== true) seen.push(`frame ${i}: firstUnderContainer=false`)
          const blob = await (await fetch(url)).blob()
          i++
          return { kind: "blob", blob, width: gi.width, height: gi.height }
        },
      }
      const r = await mod.exportAnimation({
        host,
        penDurationMs: rh.getTotalDuration(),
        timebase: "pen",
        fps: opts.fps ?? 24,
        scale: 1,
        /* LOSSLESS AND OPAQUE — see the header. */
        transparent: false,
        format: "apng",
        holdMs: opts.holdMs ?? 600,
        reverse: !!opts.reverse,
        ...extra,
        markName: "window",
      })
      const buf = new Uint8Array(await r.blob.arrayBuffer())
      let s = ""
      for (let k = 0; k < buf.length; k += 0x8000) s += String.fromCharCode(...buf.subarray(k, k + 0x8000))
      return {
        b64: btoa(s),
        frames: r.frames, width: r.width, height: r.height, durationMs: r.durationMs,
        encoderId: r.encoderId, warnings: r.warnings, summary: r.summary,
        planFrames: r.plan.frames.length,
        holdCount: r.plan.frames.filter((f) => f.phase === "hold").length,
        holdMs: r.plan.holdMs, holdMsRequested: r.plan.holdMsRequested ?? null,
        closingFrameClamped: r.plan.closingFrameClamped ?? null,
        holdShows: r.plan.holdShows ?? null,
        holdSuppressed: r.plan.holdSuppressed ?? null,
        playheads: wanted,
        grabInfo: info, sizes, anomalies: seen,
      }
    },
    { mount, drive, opts },
  )
  const path = join(TMP, `${tag}.png`)
  writeFileSync(path, Buffer.from(res.b64, "base64"))
  return { ...res, path, tag }
}

/** Every frame of an APNG as a PNG on disk, so the raster helpers can read it. */
function explode(file, tag) {
  const dir = join(TMP, `frames-${tag}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  spawnSync(FFMPEG, ["-y", "-v", "error", "-i", file, join(dir, "f%04d.png")], { maxBuffer: 1 << 28 })
  return readdirSync(dir).sort().map((f) => join(dir, f))
}
/**
 * sha256 of every decoded pixel of a whole film, STREAMED.
 *
 * 🔴 IT USED TO BUFFER, AND THE PRODUCT'S OWN DEFAULT CLEARED THE CEILING.
 * `execFileSync`'s `maxBuffer: 1 << 28` is 268 435 456 bytes = 59 frames of this
 * fixture at 798×1408 RGBA. §B films at 24 fps and lands at 47, so it squeaked
 * under; §D presses the real Video button, whose panel default is **30 fps**, and
 * a 65-frame film decodes to 292 131 840 B. Node answers that with `ENOBUFS`,
 * which is a THROW and not a FAIL: the run dies mid-section and every later row
 * is simply ABSENT — and "no rows" reads like "not run", not like "red". There is
 * no honest ceiling to raise it to, so there is no ceiling.
 */
function pixelHash(file) {
  return new Promise((resolve, reject) => {
    const p = spawn(FFMPEG, ["-v", "error", "-i", file, "-f", "rawvideo", "-pix_fmt", "rgba", "-"])
    const h = createHash("sha256")
    let bytes = 0
    let err = ""
    p.stdout.on("data", (d) => {
      h.update(d)
      bytes += d.length
    })
    p.stderr.on("data", (d) => (err += d))
    p.on("error", reject)
    p.on("close", (code) => {
      if (code !== 0 || bytes === 0) reject(new Error(`ffmpeg exit ${code} on ${file}, ${bytes} bytes decoded ${err.trim()}`))
      else resolve({ hash: h.digest("hex").slice(0, 16), bytes })
    })
  })
}

/**
 * Put the app in a named draw-in state and READ IT BACK IN A LATER TICK.
 *
 * ⚠ THE READBACK IS A SECOND `evaluate` ON PURPOSE, and the first draft of this
 * gate got it wrong in exactly the way explainer 26 §13.1 already records:
 * `setDrawIn` writes React state and `__revealHarness` is REINSTALLED on that
 * state, so `drawIn()` called in the same tick returns the PREVIOUS closure's
 * value. The setters returned `true`, the picture changed, and the row that
 * asserted the state had taken came back red while the feature worked. Same
 * lag `seekBeat` carries its own warning about, one control over.
 */
async function setState(drawIn, win) {
  const set = await page.evaluate(
    ([d, w]) => ({ a: window.__revealHarness.setDrawIn(d), b: window.__revealHarness.setWindow(w) }),
    [drawIn, win],
  )
  await page.waitForTimeout(1400)
  const read = await page.evaluate(() => ({
    drawIn: window.__revealHarness.drawIn(),
    window: window.__revealHarness.window(),
  }))
  return { ...set, ...read }
}

const EMPTY_STATE = { order: "asDrawn", overlap: 0, align: "start", unit: "group", seed: 1, reverse: "off" }
const GROW = { mode: "grow", length: 0.25 }

/* ---- B1 · the SCHEDULED films ------------------------------------------ */
const SCHEDULED = { ...EMPTY_STATE, order: "reversed", overlap: 1, align: "start" }
let s1 = await setState(SCHEDULED, GROW)
row(
  s1.a === true && s1.b === true && s1.drawIn.order === "reversed" && s1.drawIn.overlap === 1,
  "the app really is in the non-identity schedule the rows below are about",
  `drawIn=${JSON.stringify(s1.drawIn)} window=${JSON.stringify(s1.window)}`,
)

const schedPlan = await film("sched-plan", { drive: "plan" })
const schedHarness = await film("sched-harness", { drive: "harness" })
await setState(EMPTY_STATE, GROW)
const identPlan = await film("ident-plan", { drive: "plan" })

/* ---- B1b · THE ORDER, ON ITS OWN --------------------------------------
 *
 * 🔴 `SCHEDULED` ABOVE CANNOT SHOW A REORDER, AND §B3 SPENT MONTHS SAYING IT DID.
 *
 * It carries `overlap: 1` as well as `order: "reversed"`, and at full overlap
 * every stroke draws across the whole timeline, so there is no ordering left for
 * the order field to express. Measured 2026-09-04 by shooting the identity film
 * at overlap 1 as well, so the ONLY difference between the two was the order:
 *
 *     reversed + overlap 1  vs  asDrawn + overlap 1   0 of 45 frames differ,
 *                                                     IoU 1.0000 every frame
 *
 * Byte-identical films. So every difference §B3 was measuring was the OVERLAP,
 * under a row titled "the REORDER is IN the film", and its 0.15 centroid bar was
 * the bar for a reorder the fixture was never showing. That is why the bar looked
 * unreachable: `max |Δcx| 0.135` was the overlap's whole range.
 *
 * This pair is `EMPTY_STATE` in every field but `order`, so the difference below
 * is the reorder and nothing else. Measured on that pair: IoU min 0.0000, max
 * |Δcx| 0.230, both far past where the old bars sat. `SCHEDULED` keeps overlap 1
 * and keeps Q1(a) above, which is a claim about the PLAN and does not care which
 * schedule it is driven with. */
const ORDER_ONLY = { ...EMPTY_STATE, order: "reversed" }
const s2 = await setState(ORDER_ONLY, GROW)
row(
  s2.a === true && s2.drawIn.order === "reversed" && s2.drawIn.overlap === 0,
  "…and the ORDER-ONLY schedule §B3 is about differs from the identity in `order` and nothing else",
  `drawIn=${JSON.stringify(s2.drawIn)} vs identity ${JSON.stringify(EMPTY_STATE)}`,
)
const orderPlan = await film("order-plan", { drive: "plan" })
const orderHarness = await film("order-harness", { drive: "harness" })
await setState(EMPTY_STATE, GROW)

console.log(
  `\n  films: sched-plan ${schedPlan.frames}f ${schedPlan.width}×${schedPlan.height} · ` +
    `sched-harness ${schedHarness.frames}f · ident-plan ${identPlan.frames}f · sizes ${JSON.stringify(schedPlan.sizes)}\n`,
)

/* ---- B2 · Q1(a) · the export's seek IS the viewport's seek -------------- */
{
  const a = await pixelHash(schedPlan.path)
  const b = await pixelHash(schedHarness.path)
  const c = await pixelHash(identPlan.path)
  const fa = explode(schedPlan.path, "sched-plan")
  const fb = explode(schedHarness.path, "sched-harness")
  const fc = explode(identPlan.path, "ident-plan")
  let worstAB = 0
  let dirtyAB = 0
  let worstAC = 0
  let dirtyAC = 0
  const n = Math.min(fa.length, fb.length, fc.length)
  for (let i = 0; i < n; i++) {
    const pa = await pixels(fa[i])
    const pb = await pixels(fb[i])
    const pc = await pixels(fc[i])
    const dab = differingPixels(pa, pb)
    const dac = differingPixels(pa, pc)
    if (dab) dirtyAB++
    if (dac) dirtyAC++
    worstAB = Math.max(worstAB, dab)
    worstAC = Math.max(worstAC, dac)
  }
  const total = schedPlan.width * schedPlan.height
  paired(
    "🔴 Q1 · THE EXPORT'S OWN PLAN PUTS THE SCENE WHERE THE VIEWPORT PUTS IT — every frame",
    () => a.hash === b.hash && dirtyAB === 0,
    "…and the comparison can see a difference — the IDENTITY schedule must NOT match",
    () => a.hash === c.hash,
    `plan-driven vs harness-driven: ${dirtyAB}/${n} frames differ (worst ${worstAB} px of ${total}) · ` +
      `vs identity: ${dirtyAC}/${n} frames differ (worst ${worstAC} px = ${((worstAC / total) * 100).toFixed(1)}%)`,
  )
  globalThis.__q1 = { n, dirtyAB, worstAB, dirtyAC, worstAC, total }
}

/* ---- B3 · Q1(b) · the SCHEDULE reaches the film, and in the right direction */
/**
 * 🔴 THIS ROW WAS FLAKY, THEN THE FIXTURE WAS FIXED, AND THEN IT WAS UNREACHABLE.
 *
 * PARKED PRIOR, the whole block, because both halves of how it was wrong matter:
 *
 *     const at = Math.floor(fa.length * 0.28)
 *     const ms = inkMask(await pixels(fa[at]), empty)
 *     const mi = inkMask(await pixels(fc[at]), empty)
 *     paired("🔴 Q1 · the REORDER is IN the film — early ink sits at the other end of the page",
 *       () => Math.abs(cs - ci) > 0.15 && iou(ms, mi) < 0.35,
 *       "…measured against the identity film at the same frame, which must not agree",
 *       () => Math.abs(cs - ci) <= 0.15, ...)
 *
 * ROUND ONE was the fixture and lane N3 was right about it: a 400 ms settle sat
 * BETWEEN the two strokes, went into `getTotalDuration()`, and the export filmed
 * a pause the hand took. Four runs read 1342, 1356, 1897 and 2164 ms for the same
 * gesture. F19 moved the settle to the caller. The pen-up gap is now 16 ms, 1.3 %
 * of the gesture, printed on every run by the first row in this file.
 *
 * ROUND TWO is what was left, and nobody had re-derived the bars after the
 * fixture moved. Measured 2026-09-04 across ALL 45 frames of the two films:
 *
 *     max |Δcx| anywhere in the film   0.135   at frame 1
 *     the row's bar                    0.150
 *
 * The bar sat ABOVE the largest separation this fixture can produce, so the row
 * could not pass at any sample point. Its own header had already checked that
 * moving the sample point does not rescue it and concluded the bar was not the
 * problem; on the fixed fixture the bar IS the problem. And the control was
 * `!` of the real arm's first conjunct, so it passed automatically whenever that
 * conjunct failed — a control that is the negation of what it controls proves
 * nothing, and this file's own `paired` announced exactly that.
 *
 * ROUND THREE, and it is the one that mattered. §B1b above has the measurement:
 * the films this row compared differed by the OVERLAP, not the order, because
 * `SCHEDULED` carries `overlap: 1` and at full overlap the order field expresses
 * nothing. `max |Δcx| 0.135` was the overlap's whole range, and the 0.15 bar was
 * the bar for a reorder that was never in the picture.
 *
 * THE BAR WAS NEVER THE PROBLEM. On the order-only pair §B1b now shoots, which
 * is `EMPTY_STATE` in every field but `order`, the same fixture reads:
 *
 *     drawing frames (identity film between 2 % and 98 % of its own peak)   28
 *     IoU scheduled vs identity, minimum                        0.0000  frame 1
 *     IoU scheduled vs the SAME schedule through the harness    1.0000  every frame
 *     max |Δcx|                                                 0.231   frame 6
 *     frames where the reordered film's ink sits to the RIGHT     28 of 28
 *     the same count for the same-schedule pair                    0 of 28
 *
 * So the 0.15 centroid bar is KEPT, unchanged, and clears by 1.54x. What changed
 * around it: the sample is the whole drawing window rather than one frame at
 * 28 %, an IoU floor carries the "same ink, different places" half against a
 * measured 1.0000 zero, and the direction is asserted on every frame rather than
 * inferred from one. The control is a genuinely different pair of films — the
 * same schedule through the other driver — put through the same predicate, which
 * is what the old `!`-of-itself control was pretending to be.
 */
{
  const fa = explode(orderPlan.path, "order-plan")
  const fb = explode(orderHarness.path, "order-harness")
  const fc = explode(identPlan.path, "ident-plan")
  const fh = explode(schedHarness.path, "sched-harness")
  const empty = await pixels(fa[0])
  const nF = Math.min(fa.length, fb.length, fc.length)
  const mS = []
  const mH = []
  const mI = []
  for (let i = 0; i < nF; i++) {
    mS.push(inkMask(await pixels(fa[i]), empty))
    mH.push(inkMask(await pixels(fb[i]), empty))
    mI.push(inkMask(await pixels(fc[i]), empty))
  }
  /* THE WINDOW IS THE FILM'S OWN, not a fraction typed here. A frame before the
   * reveal has started or after it has finished carries no reordering to see,
   * and the hold at the end is 15 of these 45 frames. */
  const peakI = Math.max(...mI.map((m) => m.count))
  const draw = []
  for (let i = 0; i < nF; i++)
    if (peakI > 0 && mI[i].count > peakI * 0.02 && mI[i].count < peakI * 0.98) draw.push(i)

  const real = measureOrder(mS, mI, draw)
  const ctl = measureOrder(mS, mH, draw)
  /* CX_BAR is the parked prior's own 0.15, kept to the digit. IOU_FLOOR is half
   * of perfect overlap, and the two ends it sits between are measured every run:
   * the reordered pair reaches 0.0000 and the same-schedule pair holds 1.0000,
   * so it has the whole range either side. Both margins are printed, so the day
   * one of them closes is the day it is visible rather than the day a row flips.
   * `draw.length >= 8` is not decoration: without it an empty window would make
   * `rightward === draw.length` read 0 === 0 and the row would pass on nothing. */
  const CX_BAR = ORDER_CX_BAR
  const IOU_FLOOR = ORDER_IOU_FLOOR
  paired(
    "🔴 Q1 · the REORDER is IN the film — the same ink, in none of the same places, and it leads RIGHT",
    () => draw.length >= 8 && orderFires(real, draw.length),
    "…and the SAME schedule shot through the harness instead of the plan must NOT look reordered, and must carry ink to measure",
    () => orderControlFires(ctl, draw.length),
    `${draw.length} drawing frames of ${nF} (identity film 2–98% of its own ${peakI}px peak) · ` +
      `IoU min ${real.minIoU.toFixed(4)} at frame ${real.minAt} (floor ${IOU_FLOOR}) · ` +
      `max |Δcx| ${real.maxD.toFixed(3)} at frame ${real.maxAt} (bar ${CX_BAR}, ${(real.maxD / CX_BAR).toFixed(2)}x clear) · ` +
      `ink leads right on ${real.rightward}/${draw.length} · ` +
      `CONTROL same-schedule pair: IoU min ${ctl.minIoU.toFixed(4)} (${(ctl.minIoU / IOU_FLOOR).toFixed(2)}x above the floor), ` +
      `max |Δcx| ${ctl.maxD.toFixed(3)}, leads right on ${ctl.rightward}/${draw.length}, ` +
      `frames with no centroid: real ${real.unmeasured}, control ${ctl.unmeasured}`,
  )
}

/* ---- B4/B5 · 🔴 Q3 · THE TAIL ------------------------------------------ */
/**
 * WHAT A HELD TAIL IS, AND TWO WRONG ANSWERS THIS ROW GAVE FIRST.
 *
 * 1 · It counted "trailing frames under 1 % of the peak ink" and read **31 of
 *     49** on a Vanish film whose hold is 14 frames. Not wrong — answering the
 *     wrong question. A Vanish animation genuinely fades to nothing, so its
 *     last DRAW frames are legitimately near-empty and counting them inflates
 *     the defect with correct behaviour.
 * 2 · Worse: it measured ink against the film's OWN LAST FRAME, so `lastInk`
 *     was 0 by construction and a forward `grow` film — which ends on the
 *     finished mark — was reported as **"last frame 0 px of ink"**. The control
 *     row passed and said so. That is the whole reason the control is there.
 *
 * So the ink reference is the EMPTY 3-D VIEWPORT, captured once from the real
 * page at `grow` + playhead 0, and the padding claim is settled on the PLAN's
 * own integer (below) rather than on a pixel threshold. This census reports
 * context: how long the still run at the end is, and whether it is paper.
 */
let emptyRef = null
/**
 * @param {object} [opts]
 * @param {object} [opts.ref] an empty-page reference other than `emptyRef` — §D
 *   renders through a different path and may not borrow §B's page.
 * @param {number} [opts.tol] per-channel tolerance for the pixel-exact still
 *   run. Non-zero ONLY for a lossy container, and it moves no assertion.
 */
async function tailCensus(frames, tag, opts = {}) {
  const ref = opts.ref ?? emptyRef
  const tol = opts.tol ?? 0
  const inks = []
  let peak = 0
  for (const f of frames) {
    const m = inkMask(await pixels(f), ref)
    inks.push(m.count)
    if (m.count > peak) peak = m.count
  }
  const last = await pixels(frames[frames.length - 1])
  let held = 1
  for (let i = frames.length - 2; i >= 0; i--) {
    if (differingPixels(await pixels(frames[i]), last, tol) !== 0) break
    held++
  }
  const lastInk = inks[inks.length - 1]
  /* 🔴 `held` IS A FACT ABOUT THE CODEC, `blankRun` IS THE FACT ABOUT THE TAIL.
   * "Its final N frames are one still image of paper" is exact on APNG and
   * meaningless on VP9, which is what the real Video button writes: eighteen
   * identical bare-paper frames RE-QUANTISE, and the pixel-exact run reads 29
   * where the blank tail is 42. So the trailing-blank count is taken against the
   * same 10 % ink bar the verdict already uses, and no assertion rests on
   * `held` — it is printed as context beside the number that is load-bearing. */
  let blankRun = 0
  for (let i = inks.length - 1; i >= 0; i--) {
    if (peak > 0 && inks[i] > peak * 0.10) break
    blankRun++
  }
  /* ── WHERE THE BAR IS, AND WHY IT IS NOT 1 % ───────────────────────────
   * A frame at clock 0 is NOT bare paper: the pen tip's nose is carried
   * AHEAD of the playhead by the `setDrawRange` front margin — explainer 26
   * §2.2, *"the reveal starts showing ink the pen has not reached"* — so the
   * empty end of every film keeps a sliver. Measured on this fixture it is
   * ~1 390 px of a 44 227 px mark, i.e. 3.1 %, and it appears identically on
   * a forward film's FIRST frame and a reversed film's LAST frame, which is
   * what makes it the tip and not a defect in the reverse path (the row
   * below checks exactly that).
   * So the bar is 10 %: thirty times the Vanish residue, three times the
   * clock-0 residue, and ten times below a film that ends on the mark
   * (100 %). It is set from the measured gap rather than from the number
   * that would have made the first run green. */
  return {
    held, blankRun, peak, lastInk, firstInk: inks[0],
    blank: lastInk <= peak * 0.10,
    lastFrac: peak > 0 ? lastInk / peak : 0,
    n: frames.length, tag, inks,
  }
}
/**
 * THE TWO FILMS ON ONE SHARED TIME AXIS, AS ONE PNG.
 *
 * A frame count is not a picture, and this defect's whole subject is what the end
 * of the downloaded file SHOWS. DISPATCH §2.4: *"the visual loop is unskippable."*
 *
 * 🔴 AND THE FIRST VERSION OF THIS SHOWED THE WRONG THING. It cropped the last
 * twelve frames of each arm, which on a Vanish film is twelve blank cells above
 * twelve blank cells: both arms end on paper, that is what Vanish IS, and the
 * picture said nothing about the 18 frames between them. So both arms are now
 * sampled at ONE cadence, taken from the LONGER of them, and drawn from a common
 * left edge. The extra frames then read as what they are — a row that keeps going
 * after the other has stopped, every cell of it empty.
 */
async function filmStrip(arms, outPath, cells = 18) {
  const CELL = 150
  const PAD = 26
  const LABEL = 22
  const longest = Math.max(...arms.map((a) => a.frames.length))
  const step = Math.max(1, Math.ceil(longest / cells))
  const canvas = createCanvas(PAD * 2 + cells * (CELL + 4), arms.length * (CELL + LABEL + PAD) + PAD)
  const ctx = canvas.getContext("2d")
  ctx.fillStyle = "#111111"
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  for (let r = 0; r < arms.length; r++) {
    const { label, frames } = arms[r]
    const y = r * (CELL + LABEL + PAD) + PAD + LABEL
    ctx.fillStyle = "#e8e8e8"
    ctx.font = "15px sans-serif"
    ctx.fillText(`${label} — every ${step}${step === 1 ? "" : "th"} frame`, PAD, y - 8)
    for (let i = 0; i < cells; i++) {
      const idx = i * step
      const x = PAD + i * (CELL + 4)
      if (idx >= frames.length) {
        /* PAST THE END OF THIS ARM. Left as bare ground, so the shorter film is
         * visibly shorter rather than silently padded with its own last frame. */
        ctx.strokeStyle = "#333333"
        ctx.setLineDash([3, 4])
        ctx.strokeRect(x + 0.5, y + 0.5, CELL - 1, CELL - 1)
        ctx.setLineDash([])
        continue
      }
      const img = await loadImage(frames[idx])
      const sc = Math.min(CELL / img.width, CELL / img.height)
      const w = img.width * sc
      const h = img.height * sc
      ctx.fillStyle = "#2a2a2a"
      ctx.fillRect(x, y, CELL, CELL)
      ctx.drawImage(img, x + (CELL - w) / 2, y + (CELL - h) / 2, w, h)
      ctx.fillStyle = "#8eccbb"
      ctx.font = "11px sans-serif"
      ctx.fillText(`#${idx + 1}`, x + 3, y + CELL - 4)
    }
  }
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, canvas.toBuffer("image/png"))
  return outPath
}

/** The ink curve as a one-line sparkline, so a reader can SEE the shape. */
function sparkline(inks) {
  const peak = Math.max(...inks, 1)
  const bars = " ▁▂▃▄▅▆▇█"
  return inks.map((v) => bars[Math.min(8, Math.round((v / peak) * 8))]).join("")
}

/* THE EMPTY PAGE, from the real page: `grow` at playhead 0 is the 3-D viewport
 * with nothing revealed. Captured once and used as every ink reference below,
 * so "blank" means blank and not "the same as whatever this film ended on".
 *
 * 🔴 AND IT IS PUT THROUGH THE RECORDER'S OWN CROP AND GROUND, WHICH IS NOT A
 * DETAIL — it is explainer 35's defect, caught here by this file's own guard on
 * its first run. The live canvas is **799**×1408; `recorder.ts` `evenDown`s
 * every export to even dimensions, so the film is **798**×1408. Comparing the
 * two walks the first buffer's length and reads a different pixel at every
 * index past the first row: every ink count came back at 1 123 576 of 1 123 584
 * — the whole frame — and a Vanish film that ends on bare paper was reported as
 * ending on a full mark. Nothing threw. `sameShape` is what said so, and it said
 * so 170 times.
 *
 * So the reference is built the way `recordAnimation` builds a frame: a canvas
 * at the FILM's dimensions, filled with `EXPORT_PAPER`, with the grab drawn at
 * (0,0). Same two operations, same order. */
async function buildEmptyRef(w, h) {
  await setState(EMPTY_STATE, GROW)
  await page.evaluate(() => window.__revealHarness.setProgress(0))
  await page.waitForTimeout(600)
  const url = await page.evaluate(() => window.__captureHarness.grab())
  const raw = join(TMP, "empty-raw.png")
  writeFileSync(raw, Buffer.from(url.split(",")[1], "base64"))
  const img = await loadImage(raw)
  const c = createCanvas(w, h)
  const ctx = c.getContext("2d")
  ctx.fillStyle = "#fafafa" // EXPORT_PAPER, lib/export/index.ts
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0)
  const p = join(TMP, "empty-ref.png")
  writeFileSync(p, c.encodeSync("png"))
  return { ref: await pixels(p), rawW: img.width, rawH: img.height }
}
{
  const built = await buildEmptyRef(schedPlan.width, schedPlan.height)
  emptyRef = built.ref
  row(
    emptyRef.w === schedPlan.width && emptyRef.h === schedPlan.height,
    "the EMPTY-page reference is built at the FILM's dimensions, through the recorder's own crop and ground",
    `live canvas ${built.rawW}×${built.rawH} → film ${schedPlan.width}×${schedPlan.height} → reference ${emptyRef.w}×${emptyRef.h}`,
  )
}

let vanishFilm = null
let growFwd = null
let growRev = null
{
  await setState(EMPTY_STATE, { mode: "vanish", length: 0.25 })
  vanishFilm = await film("vanish", { drive: "plan" })
  const fv = explode(vanishFilm.path, "vanish")
  const cv = await tailCensus(fv, "vanish")

  /* 🔴 THE KNOWN-BAD, AND IT IS NOT A SYNTHETIC MUTANT — it is the code as it
   * stands in `components/viewport-3d.tsx` today, which calls `exportAnimation`
   * without telling it what the reveal shows. Filmed on the same page, on the
   * same stroke, in the same Vanish state. This arm MUST keep the blank hold,
   * or the wiring the fix needs is doing nothing and the row above is green for
   * a reason that has nothing to do with this lane. */
  const vanishUnwired = await film("vanish-unwired", { drive: "plan", opts: { unwired: true } })
  const fu = explode(vanishUnwired.path, "vanish-unwired")
  const cu = await tailCensus(fu, "vanish (unwired — today's call site)")

  await setState(EMPTY_STATE, GROW)
  growFwd = await film("grow-forward", { drive: "plan" })
  const ff = explode(growFwd.path, "grow-forward")
  const cf = await tailCensus(ff, "grow")

  /* UNWIRED ON PURPOSE. `reverse` is already passed by the shipped call site,
   * and the plan applies it to the ends itself — so this arm proves the
   * transport's Reverse is fixed with NO change at any call site at all. */
  growRev = await film("grow-reverse", { drive: "plan", opts: { reverse: true, unwired: true } })
  const fr = explode(growRev.path, "grow-reverse")
  const cr = await tailCensus(fr, "grow+reverse")

  const say = (c, f, label) =>
    `    ${label.padEnd(20)} ${String(c.n).padStart(3)}f · still run ${String(c.held).padStart(2)} · ` +
    `last ${String(c.lastInk).padStart(6)} px (peak ${c.peak}) ${c.blank ? "BLANK" : "mark "} · plan hold ${f.holdCount}\n` +
    `${" ".repeat(25)}${sparkline(c.inks)}`
  console.log(
    `\n  tail census — ink vs the empty page, ${emptyRef.w}×${emptyRef.h}, and the ink curve itself:\n` +
      `${say(cv, vanishFilm, "vanish (wired)")}\n` +
      `${say(cu, vanishUnwired, "vanish (UNWIRED)")}\n` +
      `${say(cf, growFwd, "grow forward")}\n` +
      `${say(cr, growRev, "grow + reverse")}\n`,
  )

  /* THE MODES ARE WHAT THEY SAY. Before any claim about the hold, the films
   * have to actually differ in the way the model says they do — a Vanish that
   * ended on the mark would make every row below vacuous. */
  /* ⚠ BOTH ARMS TURNED ON A TYPED 20 000 AND THE FIXTURE STOPPED REACHING IT.
   *
   * PARKED PRIOR:
   *     () => cv.blank && !cf.blank && cr.blank && cf.peak > 20000,
   *     "…and Vanish is not simply an empty film — it must START with the whole mark",
   *     () => cv.peak < 20000,
   *
   * `20000` is an absolute pixel count carried over from a larger fixture — the
   * B3 header two sections up records marks of 44 227 and 169 602 px. Since F19
   * drew the two strokes back to back the mark in this file is 4 963 px of a
   * 798×1408 frame, measured 2026-09-04 and identical across all four films. So
   * the real arm asked for four times more ink than the fixture contains and
   * could not pass, and the control was `!` of the same constant on the other
   * film, so it passed for exactly the reason the real arm failed. One number,
   * wrong in both directions, holding a row that had stopped saying anything.
   *
   * The constant is gone. What it was reaching for needs no threshold: the three
   * films are the SAME MARK seen from opposite ends, so their peaks must agree,
   * and they do at 4 963 / 4 963 / 4 963. And the control now asks the question
   * it is named after — does Vanish OPEN on the whole mark — instead of asking
   * how big the mark is. Measured: vanish opens at 100.0 % of its own peak. */
  paired(
    "the films really do end where the model says: Vanish on paper, forward Grow on the mark",
    () =>
      cv.blank &&
      !cf.blank &&
      cr.blank &&
      cf.peak > 0 &&
      Math.abs(cv.peak - cf.peak) <= cf.peak * 0.02 &&
      Math.abs(cr.peak - cf.peak) <= cf.peak * 0.02,
    "…and Vanish is not simply an empty film — it must START with the whole mark",
    () => cv.firstInk < cv.peak * 0.9,
    `last frame as a fraction of that film's own peak ink — vanish ${(cv.lastFrac * 100).toFixed(1)}% · ` +
      `grow+reverse ${(cr.lastFrac * 100).toFixed(1)}% · grow forward ${(cf.lastFrac * 100).toFixed(1)}%  (bar 10%) · ` +
      `one mark, three films: peaks ${cv.peak} / ${cr.peak} / ${cf.peak} px (bar: within 2% of grow's) · ` +
      `vanish opens at ${cv.peak > 0 ? ((cv.firstInk / cv.peak) * 100).toFixed(1) : "0.0"}% of its own peak`,
  )

  /* 🔴 THE CLOSING FRAME — and this row is here because it caught me out.
   *
   * It was first written asserting the sliver at the empty end was the PEN
   * TIP's nose carried ahead of the playhead (explainer 26 §2.2), on the
   * reasoning that a forward film's FIRST frame and a reversed film's LAST
   * frame are the same instant. **That hypothesis was wrong and the row said
   * so**: forward frame 0 measured **0 px** against the reversed film's
   * **1 577 px**. They are not the same instant, because with no hold
   * `planFrames` never emits a clock-1 frame at all unless the duration is an
   * exact multiple of the frame interval — the last frame sat at clock
   * 0.986537 and the mark was 1.35 % unfinished. The hold had been covering
   * that for every export this module has ever produced.
   *
   * So the row keeps its shape and changes its claim: the two clock-0 frames
   * must now agree, BECAUSE the closing frame is clamped to the end instant. */
  paired(
    "🔴 the film's FINAL frame is the END instant — the same picture a forward film opens on",
    () => Math.abs(cf.firstInk - cr.lastInk) <= Math.max(60, Math.max(cf.firstInk, cr.lastInk) * 0.05),
    "…and the two films are otherwise different, or this compares a film with itself",
    () => cf.n === cr.n,
    `forward film frame 0: ${cf.firstInk} px · reversed film FINAL frame: ${cr.lastInk} px · ` +
      `Δ ${Math.abs(cf.firstInk - cr.lastInk)} px of a ${cf.peak} px mark · ${cf.n}f vs ${cr.n}f`,
  )

  /* 🔴 THE DEFECT, ON AN INTEGER. `holdMs: 600` at 24 fps is 14 frames. On a
   * film that ends empty those 14 frames are padding — which is precisely what
   * this module's own doc says a hold is NOT ("The hold is not padding"). The
   * claim is the plan's hold count AND the decoded file's frame count, so it is
   * a statement about the file rather than about the plan object. */
  paired(
    "🔴 Q3 · a film that ENDS EMPTY carries no hold — and the file is shorter by exactly the hold",
    () => vanishFilm.holdMs === 0 && vanishFilm.holdCount === 1 && fv.length === vanishFilm.planFrames && cv.blank,
    "…and the SAME mechanism must NOT touch a forward `grow`, which still holds its finished mark",
    () => growFwd.holdMs === 0,
    `vanish: holdMs ${vanishFilm.holdMs} of ${vanishFilm.holdMsRequested} requested, ${vanishFilm.holdCount} closing frame, file ${fv.length} frames` +
      ` · grow forward: holdMs ${growFwd.holdMs}, ${growFwd.holdCount} hold frames, file ${ff.length} frames, ends on ${cf.lastInk} px of ink`,
  )

  paired(
    "🔴 KNOWN-BAD · the call site as it stands TODAY still writes the blank hold — so the wiring is load-bearing",
    /* DERIVED, NOT HARD-CODED. The pen duration is the browsers own and moves
     * run to run, so the hold is 14 frames one night and 15 the next — the exact
     * class explainer 26 §13.3 records ("testing a derived window at a hard-coded
     * playhead"). The invariant is that the unwired file is longer by exactly its
     * own hold, and the first draft of this row asserted 14 and went red on a run
     * where it was 15. */
    () => vanishUnwired.holdMs === 600 && vanishUnwired.holdCount > 1 && fu.length - fv.length === vanishUnwired.holdCount && cu.blank,
    "…and the wired arm must NOT also write it, or the two arms are the same film",
    () => vanishFilm.holdMs === vanishUnwired.holdMs,
    `unwired: holdMs ${vanishUnwired.holdMs}, ${vanishUnwired.holdCount} hold frames, file ${fu.length} frames (${fu.length - fv.length} more than wired = its own ${vanishUnwired.holdCount}-frame hold), ` +
      `last frame ${cu.lastInk} px of ink · its final ${cu.held} frames are one still image of paper`,
  )

  /* The control is read BEFORE the row, because `paired` takes sync thunks and
   * a promise is truthy — a control that returned one would pass every time and
   * silently turn this into an unpaired row. */
  const revIsForward = differingPixels(await pixels(fr[0]), await pixels(ff[0])) === 0
  paired(
    "🔴 …and it is NOT new — `grow` + the transport's shipped REVERSE ends empty too, and gets the same answer",
    () => growRev.holdMs === 0 && fr.length === growRev.planFrames && cr.blank,
    "…and the reverse arm really did run backwards, or it is the forward film under another name",
    () => revIsForward,
    `grow+reverse: holdMs ${growRev.holdMs} of ${growRev.holdMsRequested}, file ${fr.length} frames, ends on ${cr.lastInk} px of ink` +
      ` · its first frame differs from the forward film's: ${!revIsForward}`,
  )
  globalThis.__q3 = { cv, cf, cr }
}

/* ---- B6 · Q4 · does GLB carry ANY of it? --------------------------------
 *
 * NOT A DEFECT ROW — a SCOPE row. `buildGLBBuffer` (viewport-3d.tsx:10503)
 * builds a fresh scene from `processedStrokes` through `engine.buildExport` and
 * reads no playhead, no schedule and no window. PRD §12: GLB v1 is "static GLB
 * geometry per mode"; a TRUE ANIMATED GLB is v5, explicitly "later/harder". So
 * the expected answer is "the schedule cannot move it".
 *
 * ⚠ AND IT NEEDED ITS OWN ZERO FIRST. The first run of this row compared one
 * GLB at the identity against one under a schedule, read two different hashes,
 * and would have been reported as "the schedule leaks into the GLB". It does
 * not: a GLB exported TWICE from the same state also differs, so the byte
 * stream is not reproducible run to run and a hash comparison was never able to
 * answer this question. The row is therefore rebuilt on a quantity that IS
 * stable — the mesh census `__geomDebug.probeDihedral` reports — with the
 * hash's own instability printed rather than hidden.
 */
{
  /* 🔴 WAIT FOR THE SURFACE, DO NOT ASSUME IT. `__geomDebug` is installed on a
   * React effect and this block runs straight after §B5's four films, so on
   * 2026-08-28 one run in three found it `undefined` and the whole gate died on
   * a THROW — which prints no row at all, and "no rows" reads like "not run"
   * rather than like "red". Same lesson as `pixelHash`'s ceiling one section up:
   * an instrument that can crash is an instrument that can go quiet. */
  await page.waitForFunction(() => !!window.__geomDebug && !!window.__geomDebug.exportBase64, null, { timeout: 60000 })
  const glb = async () => await page.evaluate(async () => (await window.__geomDebug.exportBase64()) ?? "")
  const census = async () =>
    await page.evaluate(() =>
      (window.__geomDebug.probeDihedral() ?? []).map((m) => `${m.name}:${m.triangles}`).join("|"),
    )
  const h = (b) => (b ? createHash("sha256").update(Buffer.from(b, "base64")).digest("hex").slice(0, 16) : "none")

  await setState(EMPTY_STATE, GROW)
  await page.evaluate(() => window.__revealHarness.setProgress(1))
  await page.waitForTimeout(800)
  const g0 = await glb()
  const g0b = await glb()
  const c0 = await census()

  await setState({ ...EMPTY_STATE, order: "reversed", overlap: 1, reverse: "all" }, { mode: "vanish", length: 0.25 })
  await page.evaluate(() => window.__revealHarness.setProgress(0.5))
  await page.waitForTimeout(800)
  const g1 = await glb()
  const c1 = await census()

  const glbBytes = [g0, g0b, g1].map(glbCheck)
  row(
    glbBytes.every((c) => c.ok),
    "Q4 · every GLB export this block read is a real glTF binary, so the hashes below compare something",
    glbBytes.map((c, i) => `${["identity", "identity again", "scheduled"][i]}: ${c.why}`).join(" · "),
  )
  const glbStable = h(g0) === h(g0b)
  console.log(
    `\n  GLB self-consistency at ONE state: ${h(g0)} vs ${h(g0b)} → ${glbStable ? "reproducible" : "🔴 NOT reproducible run-to-run"}` +
      `  (${Math.round((g0.length * 3) / 4 / 1024)} KB)\n`,
  )
  paired(
    "Q4 · GLB is the finished mark — the schedule and the window cannot move it (PRD §12, animated GLB is v5)",
    () => c0.length > 0 && c0 === c1 && glbBytes.every((c) => c.ok) && (!glbStable || h(g0) === h(g1)),
    "…and the census really did read a mesh, or two empty strings would 'match'",
    () => c0.length === 0,
    `mesh census identity@1.0 vs reversed+overlap1+reverse-all+vanish@0.5: ${c0 === c1 ? "IDENTICAL" : `DIFFER (${c0} vs ${c1})`}` +
      ` · ${c0.split("|").length} meshes · GLB hash ${glbStable ? "stable and " + (h(g0) === h(g1) ? "identical" : "DIFFERENT") : "not usable (see above)"}`,
  )
}

/* ---- B7 · THE BYTE-IDENTITY CONTROL, with the instrument calibrated first */
if (BEFORE_DIR) {
  console.log("\n──── §C · THE DEFAULT IS BYTE-IDENTICAL ────────────────────────────\n")
  await setState(EMPTY_STATE, GROW)
  /* FOUR FILMS, ONE PAGE SESSION. `after` twice proves the comparison has a
   * real zero; `before` twice proves the same of the snapshot; before-vs-after
   * is the claim. A run where after/after already differed would make the claim
   * unmeasurable, and saying so is the point of measuring it first. */
  const afterA = await film("default-after-a", { drive: "plan", mount: "/__fsexport" })
  const afterB = await film("default-after-b", { drive: "plan", mount: "/__fsexport" })
  const beforeA = await film("default-before-a", { drive: "plan", mount: "/__fsexport_before" })
  const beforeB = await film("default-before-b", { drive: "plan", mount: "/__fsexport_before" })
  const H = (f) => pixelHash(f.path)
  const [ha, hb, hba, hbb] = [await H(afterA), await H(afterB), await H(beforeA), await H(beforeB)]
  /* READ BEFORE THE ROW — `paired` takes SYNC thunks and a pending promise is
   * truthy, so an un-awaited control would report "the control PASSED" every
   * run, i.e. would quietly turn the row below into one that cannot fail. */
  const vanishSameAsDefault = (await pixelHash(vanishFilm.path)).hash === ha.hash
  row(
    ha.hash === hb.hash && hba.hash === hbb.hash,
    "CALIBRATION — the same module filmed twice is the same film, so this comparison has a real zero",
    `after/after ${ha.hash === hb.hash ? "identical" : `DIFFER ${ha.hash} vs ${hb.hash}`} · before/before ${hba.hash === hbb.hash ? "identical" : "DIFFER"} · ${ha.bytes} bytes each`,
  )
  paired(
    "🔴 THE SHIPPED DEFAULT IS BYTE-IDENTICAL ACROSS THIS LANE'S CHANGE",
    () => ha.hash === hba.hash && afterA.frames === beforeA.frames,
    "…and the films are not all identical for a trivial reason — a VANISH film must differ from the default",
    () => vanishSameAsDefault,
    `before ${hba.hash} (${beforeA.frames}f) · after ${ha.hash} (${afterA.frames}f) · ${ha.bytes} decoded bytes`,
  )
}

/* ==========================================================================
 * §D · THE FILE THE VIDEO BUTTON DOWNLOADS
 *
 * Everything above drives `exportAnimation` from a host this script wrote, and
 * computes `revealEnds` itself before handing it over. That proves the MODULE.
 * It cannot prove the PRODUCT, and on 2026-08-28 the gap between the two was
 * measured rather than argued: with `holdSuppressed` forced back to `false` in
 * `frame-plan.ts` — the ends-full assumption, restored — `assert-export-plan.mjs`
 * still read **11 PASS · 0 FAIL**, and §A went red on 2 rows. The model layer was
 * gated. The CALL SITE was not: no file under `scripts/` referenced
 * `__fsExportRevealEnds` at all, so deleting `revealEnds:` from
 * `components/viewport-3d.tsx` would have put 18 frames of blank paper back on
 * the tail of every Travel / Vanish / Shrink film with every gate still green.
 *
 * The map's standing example of failure is `/desk-doodles` — *"a whole motion rig
 * your own drawing cannot reach"*. A fix that lives in `lib/export/` and never
 * reaches the button is that same failure at the other end of the pipe.
 *
 * So §D touches nothing but the real UI. The window mode is set by CLICKING the
 * transport's Timing popover and CLICKING the `Vanish` pill — because *"a whole
 * panel in this repo once rendered zero controls while harness assertions
 * passed"* — and the film is started by CLICKING the export bar's `Video` button.
 * The artefact measured is the file Chrome downloaded, on disk.
 *
 * THE KNOWN-BAD IS THE CALL SITE ITSELF, PARKED. `window.__fsExportRevealEnds =
 * "unwired"` makes `handleExportVideo` pass no `revealEnds` — literally the code
 * as it stood before that line landed — so the defect stays re-renderable through
 * the real button forever, the same shape as `__fsExportClock` and
 * `__fsExportGround` beside it. A fix whose absence cannot be re-rendered is a
 * fix nobody can fail.
 * ======================================================================== */
console.log("\n──── §D · THE FILE THE VIDEO BUTTON DOWNLOADS ──────────────────────\n")

const DL = join(TMP, "downloads")
mkdirSync(DL, { recursive: true })

/* 🔴 THE REFERENCE AND THE FILM HAVE TO BE IN THE SAME STATE.
 *
 * §B6 leaves the app on `{order: reversed, overlap: 1, reverse: all}` to prove
 * the GLB cannot see a schedule, and nothing puts it back. Filming §D from there
 * would difference every frame against a page whose pen-tip nose sits somewhere
 * else — explainer 26 §2.2, *"the reveal starts showing ink the pen has not
 * reached"*. §D is about the WINDOW reaching the real button, so the schedule is
 * returned to the shipped identity, which is also what a user pressing Video
 * actually has. Read back, not assumed. */
const dReset = await setState(EMPTY_STATE, GROW)
row(
  dReset.drawIn.order === "asDrawn" && dReset.drawIn.overlap === 0 && dReset.drawIn.reverse === "off" && dReset.window.mode === "grow",
  "§D · the app is back on the SHIPPED schedule, so these films and their reference are the same state",
  `drawIn=${JSON.stringify(dReset.drawIn)} window=${JSON.stringify(dReset.window)}`,
)

/** The parked prior, driven. `null` clears it back to the shipped read. */
async function setRevealEndsLaw(v) {
  await page.evaluate((law) => {
    if (law === null) delete window.__fsExportRevealEnds
    else window.__fsExportRevealEnds = law
  }, v)
}

/* PANEL-2: the Timing popover is the dock's Draw-in section now. */
const timingBtn = page.locator("[data-animation-drawin]")
const timingDialog = page.getByRole("region", { name: "Draw-in timing" })

/** Open the transport's Timing popover if it is not already open. */
async function openTiming() {
  if (!(await timingDialog.isVisible().catch(() => false))) {
    await timingBtn.click()
    await timingDialog.waitFor({ state: "visible", timeout: 15000 })
  }
}
/**
 * Set the reveal window BY CLICKING ITS PILL, and read the state back in a
 * LATER TICK — explainer 26 §13.1: `setWindow` writes React state and
 * `__revealHarness` is reinstalled on it, so a same-tick read returns the
 * previous closure and a working control reads as broken.
 */
async function clickWindow(label) {
  await openTiming()
  const pill = timingDialog.getByRole("button", { name: label, exact: true })
  await pill.click()
  await page.waitForTimeout(1200)
  const pressed = await pill.getAttribute("aria-pressed")
  const mode = await page.evaluate(() => window.__revealHarness.window().mode)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(300)
  return { pressed, mode }
}

/* D0 · THE CONTROL SET IS REALLY ON SCREEN, AND THE PILL REALLY ACTS. */
{
  await openTiming()
  const labels = await timingDialog
    .locator("button[aria-pressed]")
    .evaluateAll((els) => els.map((e) => e.textContent.trim()))
  const v = await clickWindow("Vanish")
  paired(
    "§D · the Window pills are ON SCREEN and clicking `Vanish` moves the app's real state",
    () => labels.includes("Vanish") && labels.includes("Grow") && v.pressed === "true" && v.mode === "vanish",
    "…and the row is reading a real control set, not an empty list that trivially satisfies it",
    () => labels.length === 0,
    `pills on screen: [${labels.join(", ")}] · after the click aria-pressed=${v.pressed} · __revealHarness.window().mode=${v.mode}`,
  )
}

/* D1 · THE SENTENCE THE USER READS BEFORE PRESSING. `videoPlanNote` is the
 * Video button's own `title`, and it is computed from the SAME `planFrames` call
 * the export runs — so a panel that still promised a hold on a film that has
 * none would be this module's own defect wearing a receipt. */
const titleOf = () => page.getByRole("button", { name: "Video", exact: true }).getAttribute("title")
{
  const vanishTitle = await titleOf()
  /* AND IT ENDS ON `Grow`, WHICH IS LOAD-BEARING RATHER THAN TIDY: §D2's four
   * films are the shipped-default arm and must be shot in the shipped default
   * state. Leaving the panel on Vanish here would make them Vanish films wearing
   * a `grow` label. */
  await clickWindow("Grow")
  const growTitle = await titleOf()
  paired(
    "§D · the panel SENTENCE on the real button says the film ends on empty paper — under Vanish and only there",
    () => /ends on empty paper, so there is no hold/.test(vanishTitle),
    "…and it does not say it under the shipped `Grow`, or the sentence is unconditional decoration",
    () => /ends on empty paper/.test(growTitle),
    `vanish title: ${JSON.stringify(vanishTitle)}\n      grow title:   ${JSON.stringify(growTitle)}`,
  )
}

/**
 * PRESS THE REAL BUTTON AND KEEP WHAT CHROME DOWNLOADS.
 *
 * The click is the product's own control (`onClick={handleExportVideo}`), the
 * blob is the product's own `download()`, and the file that lands here is the one
 * a user gets. Nothing in this function knows anything about `lib/export`.
 */
async function pressVideo(tag) {
  const btn = page.getByRole("button", { name: "Video", exact: true })
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 600000 }), btn.click()])
  const name = dl.suggestedFilename()
  const path = join(DL, `${tag}__${name}`)
  await dl.saveAs(path)
  /* The `finally` restores the playhead and clears `exportingVideo` AFTER the
   * download fires, and the button's label is the in-flight indicator — so the
   * next press waits for the label to come back rather than for a timer. */
  await page.waitForFunction(
    () => [...document.querySelectorAll("button")].some((b) => b.textContent.trim() === "Video"),
    null,
    { timeout: 120000 },
  )
  await page.waitForTimeout(400)
  /* WHAT THE USER IS TOLD. `res.warnings` is joined into the success toast, so
   * this is the only place the export's own account of what it dropped actually
   * reaches a person. Read here; asserted in D3. */
  const screen = await page.evaluate(() => document.body.innerText)
  return { path, name, tag, screen }
}

/**
 * WHAT THE PLAN WOULD MAKE OF THE APP'S OWN SHIPPED VIDEO SETTINGS.
 *
 * Read off `viewport-3d.tsx`'s own `useState` defaults — fps 30, `pen` timebase,
 * speed 1, `revealDelaySeconds` 0, `revealReverse` false — and `holdMs: 600`,
 * which is hard-coded at the call site. This is how §D asserts a FRAME COUNT
 * without hard-coding one: the pen duration is the browser's own and moves run
 * to run, so "the hold is 18 frames" is true one night and 19 the next.
 */
const realPlanFor = (mode, wired) =>
  planFrames({
    penDurationMs: penMs, fps: 30, timebase: "pen", speed: 1,
    reverse: false, leadInMs: 0, holdMs: 600,
    ...(wired ? { revealEnds: framePlan.revealEndsFor(mode) } : {}),
  })

/* D2 · 🔴 THE BYTE-IDENTITY CONTROL, AT THE BUTTON, INSTRUMENT CALIBRATED FIRST.
 *
 * `revealEndsFor("grow")` IS `REVEAL_ENDS_DEFAULT`, so the shipped default must
 * come out of this wiring bit for bit. Four films in ONE page session on ONE
 * stroke: wired twice and unwired twice give the comparison a real zero — and
 * because the button's container is VP9, that calibration is also the only honest
 * answer to "is this codec reproducible enough to hash at all". If it says no,
 * the claim row is unmeasurable and the calibration row is what says so, rather
 * than a red claim row implying a regression that was really a codec.
 *
 * IT RUNS FIRST BECAUSE IT ALSO BUILDS §D's EMPTY PAGE.
 */
let realRef = null
let growMark = 0
let d2 = null
{
  const w = await page.evaluate(() => window.__revealHarness.window().mode)
  row(w === "grow", "§D · the four default-arm films are shot in the SHIPPED window state", `window mode = ${w}`)
  await setRevealEndsLaw(null)
  const wiredA = await pressVideo("real-grow-wired-a")
  const wiredB = await pressVideo("real-grow-wired-b")
  await setRevealEndsLaw("unwired")
  const beforeA = await pressVideo("real-grow-unwired-a")
  const beforeB = await pressVideo("real-grow-unwired-b")
  await setRevealEndsLaw(null)

  const H = (f) => pixelHash(f.path)
  const [ha, hb, hba, hbb] = [await H(wiredA), await H(wiredB), await H(beforeA), await H(beforeB)]
  const fa = explode(wiredA.path, "real-grow-wired-a")
  const fb = explode(beforeA.path, "real-grow-unwired-a")
  row(
    ha.hash === hb.hash && hba.hash === hbb.hash,
    "§D · CALIBRATION — the same button pressed twice downloads the same film, so this comparison has a real zero",
    `wired/wired ${ha.hash === hb.hash ? "identical" : `DIFFER ${ha.hash} vs ${hb.hash}`} · ` +
      `unwired/unwired ${hba.hash === hbb.hash ? "identical" : `DIFFER ${hba.hash} vs ${hbb.hash}`} · ` +
      `${ha.bytes} decoded bytes each · VP9 is reproducible here, so a hash is usable`,
  )
  /* THE CLAIM IS DEFERRED TO D4, and that is the whole difficulty of proving a
   * no-op: at `grow` the two arms are SUPPOSED to be identical, so nothing inside
   * this block can show that the parked law is read at all. Its control has to
   * come from a state where the law DOES change the file — D3's Vanish pair. */
  d2 = { ha, hb, hba, hbb, nA: fa.length, nB: fb.length }

  /* 🔴 §D's EMPTY PAGE COMES OUT OF THE EXPORT PATH, NOT OUT OF THE HARNESS.
   *
   * §B builds its reference from `__captureHarness.grab()`; the real Video button
   * renders through `STILL_EXPORT.grabCanvas` at the panel's own scale. Reusing
   * §B's reference here makes every §D frame differ by a constant — a frame of
   * BARE PAPER reads ~4 500 px of "ink" — which puts a Vanish closing frame at
   * ~9 % against a 10 % bar. It passes. By one percent, measuring the gap between
   * two render paths rather than the presence of a mark. A green row a millimetre
   * from red for a reason that is not the subject is the same failure as a red one.
   *
   * A `grow` film's frame 0 IS the empty page as this button renders it. It is not
   * circular — the claim below is about a VANISH film, measured against a GROW
   * film's opening frame — and it carries its own zero: the unwired grow film's
   * frame 0 must be the same picture. */
  const r0 = await pixels(fa[0])
  const r0b = await pixels(fb[0])
  const refZero = differingPixels(r0, r0b)
  const vsHarness = emptyRef && r0.w === emptyRef.w && r0.h === emptyRef.h ? inkMask(r0, emptyRef).count : -1
  realRef = r0
  growMark = inkMask(await pixels(fa[fa.length - 1]), r0).count
  row(
    refZero === 0 && r0.w > 2 && r0.h > 2,
    "§D · the empty page is the EXPORT path's own — a `grow` download's frame 0, with its own zero",
    `${r0.w}×${r0.h} · the two grow films' frame 0 differ by ${refZero} px · ` +
      `against §B's harness-built reference it differs by ${vsHarness} px, which is why it is not reused`,
  )
}

/* D3 · 🔴 THE HEADLINE — the downloaded Vanish film, wired and unwired. */
let d3 = null
{
  await clickWindow("Vanish")
  await setRevealEndsLaw(null)
  const wired = await pressVideo("real-vanish-wired")
  const fw = explode(wired.path, "real-vanish-wired")

  await setRevealEndsLaw("unwired")
  const unwired = await pressVideo("real-vanish-unwired")
  const fu = explode(unwired.path, "real-vanish-unwired")
  await setRevealEndsLaw(null)

  /* VP9 IS LOSSY, SO THE STILL RUN IS READ WITH A TOLERANCE AND THE CLAIMS ARE
   * NOT. `tol: 2` is a decode-noise allowance on the `held` READOUT only; every
   * assertion below is a frame count or an ink count against the empty page. */
  const cw = await tailCensus(fw, "real vanish (wired)", { ref: realRef, tol: 2 })
  const cu = await tailCensus(fu, "real vanish (UNWIRED)", { ref: realRef, tol: 2 })

  const say = (c, label) =>
    `    ${label.padEnd(22)} ${String(c.n).padStart(3)}f · blank tail ${String(c.blankRun).padStart(2)} ` +
    `(pixel-exact run ${String(c.held).padStart(2)}) · last ${String(c.lastInk).padStart(5)} px ` +
    `(peak ${c.peak}) ${c.blank ? "BLANK" : "mark "}\n${" ".repeat(27)}${sparkline(c.inks)}`
  console.log(
    `\n  the REAL BUTTON's own tail census — ${realRef.w}×${realRef.h}, ink vs the export path's own empty page:\n` +
      `${say(cu, "vanish (UNWIRED)")}\n${say(cw, "vanish (wired)")}\n`,
  )

  const pw = realPlanFor("vanish", true)
  const pu = realPlanFor("vanish", false)
  const expectedGap = pu.frames.length - pw.frames.length
  paired(
    "🔴 §D · THE FILE THE VIDEO BUTTON DOWNLOADS CARRIES NO BLANK TAIL UNDER VANISH",
    /* NOT "the last frames are blank" — a Vanish animation genuinely fades to
     * nothing, so its closing DRAW frames are legitimately near-empty and counting
     * them would inflate the defect with correct behaviour. The claim is the
     * file's LENGTH against the plan's, and the known-bad's extra frames being
     * paper. */
    () =>
      vanishReachesInk(cw, growMark) && vanishReachesInk(cu, growMark) &&
      cw.n === pw.frames.length && cw.blank && cu.n - cw.n === expectedGap && expectedGap > 1 && cu.blankRun >= expectedGap,
    '🔴 KNOWN-BAD · …and the call site as it stood BEFORE that line still writes it — `__fsExportRevealEnds = "unwired"`',
    () => cu.n === cw.n,
    `wired ${cw.n} frames (plan says ${pw.frames.length}) — blank run ${cw.blankRun}, ` +
      `last ${cw.lastInk} px = ${(cw.lastFrac * 100).toFixed(1)}% of its own peak (bar 10%) · ` +
      `unwired ${cu.n} frames (plan says ${pu.frames.length}), ${cu.n - cw.n} more = its own ` +
      `${pu.frames.filter((f) => f.phase === "hold").length}-frame hold less the closing frame, ` +
      `and its final ${cu.blankRun} frames are bare paper (${cu.lastInk} px) · ` +
      `peak ink wired ${cw.peak} px, unwired ${cu.peak} px, against the grow download's finished mark ${growMark} px (each must reach 10%)`,
  )

  /* THE STRIP A PERSON LOOKS AT. Twelve frames off the tail of each arm, side by
   * side, because a frame count is not a picture and this defect's whole subject
   * is what the last second of the file shows. */
  await filmStrip([
    { label: `vanish UNWIRED — ${cu.n}f, blank tail ${cu.blankRun}`, frames: fu },
    { label: `vanish wired — ${cw.n}f, blank tail ${cw.blankRun}`, frames: fw },
  ], join(OUT, "real-button-films.png"))

  d3 = { nWired: cw.n, nUnwired: cu.n, vanishHash: (await pixelHash(wired.path)).hash }

  /* 🔴 THE EXPORT TELLS THE USER WHAT IT DROPPED — and names a control that does
   * not exist. `recordAnimation` raises the warning and `handleExportVideo` joins
   * it into the success toast. The sentence ends *'Turn on "hold on empty" to keep
   * it.'* and `holdOnEmpty` has NO pill in the export panel. That is a
   * names-match-behaviour defect (DISPATCH §2.7) whose fix is a product call
   * (§2.8), so it is MEASURED and REPORTED here, not quietly reworded and not
   * quietly built. */
  const told = /hold was dropped/.test(wired.screen)
  const sentence = (wired.screen.match(/The [\d.]+s hold was dropped[^\n]*/) ?? [""])[0]
  row(
    told,
    "§D · the export SAYS it dropped the hold, in the toast the user actually reads",
    told ? `toast: ${JSON.stringify(sentence)}` : "the success toast carried no dropped-hold warning",
  )

  /* 🔴 …AND IT DOES NOT SEND THE USER TO A CONTROL THAT IS NOT THERE.
   *
   * DISPATCH §2.7: *"Names must match behaviour. A dial whose label does not
   * describe what renders is a defect — wire it or remove it."* This toast used
   * to end *'Turn on "hold on empty" to keep it.'* and `holdOnEmpty` has never
   * had a pill: it is an input on `exportAnimation`, reachable by a caller and
   * by nobody reading a toast. It shipped latent for as long as the call site
   * never made the plan suppress anything, and reached a screen the first time
   * `revealEnds` was wired.
   *
   * DERIVED, NOT ENUMERATED. The row does not hard-code the phrase; it counts
   * `holdOnEmpty` in `components/` and only then requires the toast to be silent
   * about it. Build the pill and this row relaxes on its own — which is the
   * point, because the alternative is a gate that forbids the honest sentence
   * the day the control exists. */
  {
    const comp = join(ROOT, "components")
    const refs = readdirSync(comp)
      .filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"))
      .reduce((n, f) => n + (readFileSync(join(comp, f), "utf8").match(/holdOnEmpty/g) ?? []).length, 0)
    const namesIt = /hold on empty/i.test(sentence)
    /* The known-bad is the sentence this one replaced, run through the SAME
     * predicate with no control present. It has to come back false, or the row
     * is asserting nothing — the shape `EXPORT_PAPER`'s control uses one file
     * over. Written as a literal rather than as `refs`, so building the pill
     * cannot quietly turn the control green and take the row down with it. */
    const KNOWN_BAD = 'Turn on "hold on empty" to keep it.'
    paired(
      "🔴 §D · the dropped-hold toast names no control the panel does not have (DISPATCH §2.7)",
      () => refs > 0 || !namesIt,
      "…and the row can see the phrase — the sentence it replaced, with no pill built, must trip it",
      () => 0 > 0 || !/hold on empty/i.test(KNOWN_BAD),
      `holdOnEmpty in components/: ${refs} references · toast ${namesIt ? "NAMES IT" : "does not name it"} · ` +
        `sentence: ${JSON.stringify(sentence)}` +
        (refs === 0
          ? `\n      ⚠ OPEN PICK, SEBS'S — should the export panel grow a "hold on empty" pill? The message no longer` +
            ` promises one. Building it is a surface decision on a panel that has lost dials off its bottom before.`
          : ""),
    )
  }
}

/* D4 · 🔴 THE NO-OP, WITH THE ONLY CONTROL THAT CAN SEE IT.
 *
 * `revealEndsFor("grow")` IS `REVEAL_ENDS_DEFAULT`, so the shipped default has to
 * come out of this wiring bit for bit. The control cannot live in the `grow`
 * state, because there the two arms are supposed to agree; it is D3's Vanish
 * pair, where the SAME parked law moved the file by a whole hold. If that pair
 * had come back equal, this row would be proving that a law nobody read changes
 * nothing. */
{
  paired(
    "🔴 §D · A `grow` EXPORT IS BYTE-IDENTICAL WIRED AND UNWIRED, AT THE REAL BUTTON",
    () =>
      d2.ha.hash === d2.hba.hash &&
      d2.nA === d2.nB &&
      d2.nA === realPlanFor("grow", true).frames.length &&
      d3.vanishHash !== d2.ha.hash,
    "…and the parked law is not simply inert — under Vanish the SAME two arms must produce different files",
    () => d3.nWired === d3.nUnwired,
    `unwired ${d2.hba.hash} (${d2.nB}f) · wired ${d2.ha.hash} (${d2.nA}f, plan says ${realPlanFor("grow", true).frames.length}) · ` +
      `${d2.ha.bytes} decoded bytes · the law moved Vanish ${d3.nUnwired}f → ${d3.nWired}f · vanish film ${d3.vanishHash} ≠ grow ${d2.ha.hash}`,
  )
}

/* ---- B8 · the run's own honesty rows ------------------------------------ */
row(
  rasterGuard.mismatches.length === 0,
  "not one raster comparison in this run compared two DIFFERENT-SHAPED frames (explainer 35)",
  `${rasterGuard.comparisons} comparisons, ${rasterGuard.mismatches.length} mismatches` +
    ` · grabs ${JSON.stringify(schedPlan.sizes)}`,
)
row(pageErrors.length === 0, "no page errors across the run", pageErrors.slice(0, 2).join(" | ") || "0 errors")
{
  const real = consoleErrors.filter((m) => !/favicon|DevTools|Download the React/i.test(m))
  row(real.length === 0, "no console errors across the run", real.slice(0, 2).join(" | ") || "0 errors")
}

await browser.close()
if (!KEEP) rmSync(TMP, { recursive: true, force: true })
console.log(`\nartefacts → ${OUT}`)
console.log(`assert-export-window: ${pass} PASS · ${fail} FAIL`)
process.exit(fail === 0 ? 0 : 1)
