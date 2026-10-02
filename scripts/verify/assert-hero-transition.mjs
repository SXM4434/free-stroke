// HERO TRANSITION — pass/fail on the beat's own signature.
//
// `verify-hero-transition.mjs` captures; this judges. The split matters here
// more than usual, because the thing being judged is easy to fake a pass on:
// "did the picture change between frame 1 and frame 90" is satisfied by the
// BROKEN version too — it changed, it just never started from a drawing.
//
// So every gate below asserts something only the real effect can produce.
//
//  1. FRAME ONE IS A DRAWING. The acceptance test, made measurable. A flat
//     drawn mark is ONE VALUE inside a hard silhouette: no shading gradient, no
//     specular highlight, no rim. So the standard deviation of ink luminance in
//     the flat beat must be near zero, and the brightest ink pixel must be
//     close to the darkest. A lit tube seen head-on fails both — that is the
//     defect this whole change exists to remove, and the BEFORE capture is kept
//     as the negative control that proves the gate can fail.
//
//  2. THE HOLD IS AN OBJECT. The mirror of gate 1. If flatness were achieved by
//     something dumb (killing the lights, dimming everything) the end of the
//     beat would be flat too. The held ¾ must have real tonal range.
//
//  3. NO VALUE WASH. Desk Doodles' brand law is that tonal range comes from
//     light and mark density, never from washing the ink out. No frame of the
//     handoff may be lighter than the settled form: a midpoint excursion is the
//     signature of a cross-dissolve, which is the read the beat must not have.
//
//  4. ONE OBJECT, NOT TWO. The camera is parked dead-on for the whole emerge,
//     so the only thing that can move the silhouette is the form itself. A
//     layer swap shows up here as a single-frame jump in POSITION — which is
//     exactly how the previous two-canvas attempt failed.
//
//  5. THE BEAT CONTAINS A MOMENT. The extent collapses to a sliver, holds two
//     frames, and comes back — with the registration never moving.
//
//  6. THE FINAL HOLD STOPS. Net displacement across all of extent, not just the
//     centre.
//
// ── GATES 4, 5 AND 6 CHANGED (hero-beat-storyboard.md §8, corrected by §10.4).
//
// Gate 4 used to assert one thing and mean two: registration, which must hold,
// AND continuity of extent, which a MOMENT MUST BREAK. Gate 5 used to be "the
// change is gradual, not a cut" — a formal upper bound on how much may happen
// in any one frame, i.e. a machine-enforced prohibition on having a moment. Run
// against the original Desk Doodles flip, the pair REJECT the only thing in this
// project that has a moment: its turn steps 241 px of extent in one frame while
// its centre moves half a pixel. That is the proof the fault was in the
// criterion, not in the film — hold the centre, break the extent.
//
// The criteria now live in `lib/hero-moment.mjs` and are shared with
// `docs/storyboard/tools/assert-moment.mjs`, which runs them against both films
// and four synthetic negative controls (mis-registered swap, vertically-offset
// swap, hard cut to blank, one-frame blink) and requires all four to FAIL. That
// file is this gate's mutation test; run it after touching either.
//
// THE PRIOR GATES ARE PARKED, NOT DELETED: `--gates=prior` reproduces the
// shipped 4/5 verbatim. Keep it working — it is the negative control that shows
// what the change actually changed.
//
// ── AND THE JUDGE IS MUTATION-TESTED ON THE REAL CAPTURE. `--mutate=<control>`
// perturbs the measured series and REQUIRES the matching gate to go red; it
// exits non-zero if the gate stays green. Three controls, one per claim that
// this file alone owns:
//
//   --mutate=cx      one frame of the turn displaced 6 px sideways
//   --mutate=cy      one frame of the turn displaced 6 px vertically
//   --mutate=wash    a mid-window frame faded toward paper — the cross-dissolve
//   --mutate=drift   the last frame of the film nudged, so the beat never stops
//
// It exists because the cy clause is now SCOPED (see the parked window below)
// and a scoped clause is one edit away from being a scoped-out clause. A green
// row that cannot fail is the lie; these three prove these three can.
//
// ── AND THREE MORE, AIMED AT GATE 1 ITSELF (2026-08-01) ────────────────────
// Gate 1's estimator changed when the pen carve landed — see `FLAT_TRIM` in
// `lib/flat-interior.mjs` for the input that forced it and the calibration that
// sizes it. An estimator that got more tolerant needs controls in BOTH
// directions or the tolerance is just a hole:
//
//   --mutate=shading  the negative control's OWN luminance distribution imposed
//                     on the flat frame as a smooth gradient. Gate 1 and gate 2
//                     MUST go red. This is the defect the whole beat exists to
//                     remove, put back.
//   --mutate=notch    coverage residue at 80 % of the tolerance, scattered deep
//                     inside the interior — the concave-gap artefact, synthetic
//                     and an order of magnitude larger than the real one. Gate 1
//                     MUST STAY GREEN. It is the only control here whose
//                     required verdict is a PASS, and it is named as such.
//   --mutate=speckle  the same residue at 3x the tolerance. Gate 1 MUST go red,
//                     which is what proves the tolerance is BOUNDED rather than
//                     unlimited.
//
// All three are applied to the LUMA FIELD before the mask and the erosion, not
// to the finished statistics — `lib/flat-interior.mjs` records why: *"A control
// that perturbs the pixels but skips the erosion is a control that cannot
// fire."*
//
// ── 2026-08-07 · ALL SEVEN NOW RUN ON THE DEFAULT INVOCATION ───────────────
//
// Everything above was true and none of it ran. Seven well-built controls sat
// behind `--mutate=`, and NEITHER BATTERY PASSES A FLAG — `run-browser-battery`
// says so on purpose: *"the bare invocation is the one the next person types."*
// So the nine green rows a sweep printed had never been shown a build they must
// reject, and the file's own sentence — *"A green row that cannot fail is the
// lie; these three prove these three can"* — was describing an invocation
// nobody made. Explainer 21 §7 is the standing law: *"the gate runs three kinds
// of control on the DEFAULT invocation, never behind a flag."*
//
// The bare run now spawns itself once per control (see the CONTROLS block near
// the end of `main`) and turns each child's verdict into a row. The mutation
// machinery is UNCHANGED and is not duplicated — the control is this gate, run
// against a deliberately broken input.
//
// Measured on `--label=carve`: 9 -> 16 battery-visible rows, 1 s -> 9 s. And
// proved by mutation rather than by reading: with the cx/cy injection changed
// from `+= 6` to `+= 0` so the control CANNOT fire, the nine subject rows are
// still 9 PASS / 0 FAIL — i.e. the pre-2026-08-07 gate exited 0 on it — while
// this one exits 1 with two red CONTROL rows. Reverted, the run is byte
// identical to the pre-mutation one.
//
// Usage: node scripts/verify/assert-hero-transition.mjs        # captures --label=bare, judges it, RUNS THE SEVEN CONTROLS
//        node scripts/verify/assert-hero-transition.mjs [--label=after] [--gates=prior] [--mutate=cx]
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { createRequire } from "node:module"
import {
  momentStats,
  spacingBand,
  priorRegistrationGate,
  registrationGate,
  momentGate,
  sliverGate,
  stillnessGate,
} from "./lib/hero-moment.mjs"
import { flatValueStats, FLAT_TRIM } from "./lib/flat-interior.mjs"
import { PORT } from "./lib/dev-server.mjs"

const require = createRequire(import.meta.url)
const { createCanvas, loadImage } = require("@napi-rs/canvas")

const __dirname = dirname(fileURLToPath(import.meta.url))
const THIS_FILE = fileURLToPath(import.meta.url)
const ROOT = join(__dirname, "..", "..")
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.split("=").slice(1).join("=") : d
}
const LABEL_WAS_DEFAULTED = !process.argv.some((a) => a.startsWith("--label="))
/* THE BARE INVOCATION CAPTURES ITS OWN EVIDENCE — see the block at the old
 * refusal site. `bare` is a scratch arm this gate rewrites every time it is
 * typed with no arguments; it is never one of the parked controls. */
/* battery: browser
 *
 * NOT decoration — it is how `run-battery.mjs` and `assert-gate-integrity`
 * classify this file. Both decide "does it drive a browser" by looking for
 * `chromium.launch` / `playwright` / `puppeteer` in the source, and this gate
 * drives one THROUGH A CHILD (`verify-hero-transition.mjs`) on its bare
 * invocation, so neither regex could see it. Without the marker it sits in the
 * model battery, which promises "no browser, no dev server, seconds each", and
 * would try to capture. The marker is declared rather than inferred, and a
 * missing one fails loudly (a capture with no dev server) rather than quietly. */
const BARE_LABEL = "bare"
/* No `"after"` fallback any more: `LABEL` is decided by the ternary, and leaving
 * a dead default in `arg()` is not harmless — `assert-gate-integrity` channel F
 * reads that literal to decide WHICH capture a bare run grades, and would have
 * gone on measuring the staleness of a directory this file no longer reads. */
const LABEL = LABEL_WAS_DEFAULTED ? BARE_LABEL : arg("label", BARE_LABEL)
/** `moment` = the corrected §8 set. `prior` = the gates exactly as shipped. */
const GATES = arg("gates", "moment")
/** `cx` | `cy` | `drift` — see the header. Inverts the run's meaning: the named
 *  gate MUST fail, and the run fails if it does not. */
const MUTATE = arg("mutate", null)
/** `skip` — see the NOT COVERED branch. Forces the no-emerge-window path on a
 *  capture that HAS one, which is the only way to reach that branch with gates
 *  1 and 2 both green: the three no-emerge directories on disk either fail them
 *  (`before/`) or are not captures at all. */
const CALIBRATE = arg("calibrate", null)
if (CALIBRATE && CALIBRATE !== "skip") {
  console.error(`unknown --calibrate=${CALIBRATE} (skip)`)
  process.exit(2)
}
const BASE = join(ROOT, "docs", "verification", "hero-transition", LABEL)

/* -------------------------------------------------------------------------- */

/**
 * Measure the INK only.
 *
 * The stage also carries a light grid, a ground plane and the viewport's own
 * chrome, all of which are pale. Gating on luminance keeps the measurement on
 * the mark. The threshold is generous on purpose: the whole question being
 * asked is how much the ink's value VARIES, so a gate tight enough to clip the
 * lit form's brighter shoulders would quietly answer it in advance.
 */
const INK_MAX_LUMA = 150

/**
 * THE INTERIOR, NOT THE OUTLINE — and this distinction is the whole
 * measurement.
 *
 * The first version of this gate read every pixel under the luminance
 * threshold, and it failed a render that is visibly, perfectly flat: sd 25.8,
 * spread 147. The cause was antialiasing. A hard-edged black silhouette on pale
 * paper has a one-pixel boundary ramp that takes EVERY value between ink and
 * paper, by construction — so the more perfectly flat and hard-edged the mark
 * is, the more spread that boundary contributes. The statistic was measuring
 * the edge and calling it shading.
 *
 * Eroding the mask by `ERODE` pixels drops the ramp and leaves the surface. A
 * flat fill then measures as the single value it is; a lit tube keeps its real
 * gradient, because the strokes here are tens of pixels across and losing three
 * from each side leaves the shading entirely intact.
 */
const ERODE = 3

/**
 * MEASURE ONE FRAME.
 *
 * `mutate(luma, W, H, firstPass)` — optional, and it is handed the interior mask
 * from a FIRST, unmutated pass so a control can inject a defect where the gate
 * actually looks. The mutated field then goes through the ENTIRE pipeline again,
 * mask and erosion included, because `lib/flat-interior.mjs` states the rule
 * this follows: *"A control that perturbs the pixels but skips the erosion is a
 * control that cannot fire."*
 */
async function measure(file, mutate = null) {
  const img = await loadImage(file)
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)

  const W = img.width
  // The viewport draws its own transport chrome into the lower part of the
  // stage; measuring it would mix UI text into the ink statistics.
  const H = Math.floor(img.height * 0.75)

  const luma = new Float32Array(W * H)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const p = y * W + x
      const i = p * 4
      luma[p] = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
    }
  }
  if (mutate) mutate(luma, W, H, interiorOf(luma, W, H))
  const mask = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) mask[p] = luma[p] <= INK_MAX_LUMA ? 1 : 0

  // Bounding box from the FULL mask — the silhouette is the outline, so the
  // registration gate has to read the un-eroded extent.
  //
  // `inkFull` is counted here for the same reason. The moment gate's floor asks
  // "is there ANYTHING on screen at the sliver" — that is the `sx >= 0.035`
  // clamp, made checkable. The eroded interior count below cannot answer it: a
  // genuine 14 px sliver has ~8 px left after a 3 px erosion and a thinner one
  // has none, so an interior statistic reads a real sliver as a blank frame and
  // the gate goes blind in exactly the regime it exists to judge.
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  let inkFull = 0
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!mask[y * W + x]) continue
      inkFull++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (!Number.isFinite(minX)) return null

  const cur = interiorOf(luma, W, H)

  const vals = []
  for (let p = 0; p < W * H; p++) if (cur[p]) vals.push(luma[p])
  if (vals.length === 0) return null
  const v = flatValueStats(vals)
  const sorted = vals.slice().sort((a, b) => a - b)
  const pc = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
  return {
    ...v,
    inkFull,
    /**
     * THE DARK CORE — the statistic §3 K3 already uses, and the one that
     * separates a wash from a rake. See gate 3.
     */
    darkCore: pc(0.05),
    /** The lit end, reported beside it so a rake is visible as a rake. */
    litEdge: pc(0.95),
    bbox: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
  }
}

/** The ERODE-radius interior of the ink mask, from a luminance field. Split out
 *  so a mutation control can be handed the SAME mask the gate will read. */
function interiorOf(luma, W, H) {
  let cur = new Uint8Array(W * H)
  for (let p = 0; p < W * H; p++) cur[p] = luma[p] <= INK_MAX_LUMA ? 1 : 0
  for (let pass = 0; pass < ERODE; pass++) {
    const next = new Uint8Array(W * H)
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const p = y * W + x
        if (!cur[p]) continue
        if (
          cur[p - 1] && cur[p + 1] && cur[p - W] && cur[p + W] &&
          cur[p - W - 1] && cur[p - W + 1] && cur[p + W - 1] && cur[p + W + 1]
        ) {
          next[p] = 1
        }
      }
    }
    cur = next
  }
  return cur
}

/** The row shape `lib/hero-moment.mjs` reads. `n` is the FULL silhouette count. */
const toRow = (m, i) => ({
  f: i,
  n: m.inkFull,
  w: m.bbox.w,
  h: m.bbox.h,
  cx: m.cx,
  cy: m.cy,
})

const results = []
const record = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}\n      ${detail}`)
}

/**
 * THE MUTATION CONTROLS — applied to the MEASURED rows, so what is being tested
 * is the shipped judge running on the shipped capture.
 *
 * A displacement of 6 px is the size §10.4's own synthetic layer-swap controls
 * use, and it is far below anything a viewer would call a different picture —
 * which is the point: the gate exists to catch a mis-registration the eye can
 * only just see, so the control has to be that small.
 *
 * `scope` names which window a mutation belongs to, because a cy nudge dropped
 * into the final-hold rows would prove nothing about the registration gate.
 */
/* ⚠ THE TARGET FRAME IS DERIVED FROM THE SERIES, NOT FROM A CONSTANT — and this
 * is instrument bug NINE of the family `hero-beat-storyboard.md` §11.8
 * catalogues, found the same way: by running it.
 *
 * Both controls used to land on a hardcoded fraction of the window — 25 % for
 * the registration nudge, 50 % for the wash. On the retimed beat the moment
 * MOVED, and 50 % of `k7final`'s emerge window is now inside the SLIVER, whose
 * eroded interior is a handful of dark pixels. Lifting that frame's core by 12
 * luma left it BELOW the reference, so `--mutate=wash` reported *"FAILED TO
 * FAIL"* — the wash row's green on that capture meant nothing at all, and the
 * only reason anybody knows is that the control refuses to pass quietly.
 *
 * §11.8's own conclusion, applied: *"every hardcoded time in this beat's tooling
 * has now been wrong at least once… derive it from the model's own data, and
 * print what was actually read."* So the target is chosen among frames that
 * still HAVE a silhouette — the same 20 % legibility notion the cy clause uses —
 * and the chosen frame is printed with the control's verdict.
 */
const extentOf = (r) => r.bbox?.w ?? r.w ?? 0
const MUTATED_AT = {}
function pickTarget(rows, scope, frac) {
  const settled = extentOf(rows[rows.length - 1]) || Math.max(...rows.map(extentOf))
  const floorPx = 0.2 * settled
  // Frames with a real silhouette, ranked by how close they sit to `frac` of
  // the window. A nudge inside the collapse proves nothing about a gate that
  // deliberately does not judge the collapse.
  const want = frac * (rows.length - 1)
  let best = -1
  let bestD = Infinity
  for (let i = 0; i < rows.length; i++) {
    if (extentOf(rows[i]) < floorPx) continue
    const d = Math.abs(i - want)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  const i = best >= 0 ? best : Math.floor(want)
  MUTATED_AT[scope] = `frame ${i} of ${rows.length} (extent ${extentOf(rows[i])} px, floor ${floorPx.toFixed(0)} px)`
  return i
}

function mutateRows(rows, scope = "turn") {
  if (!MUTATE || rows.length < 4) return rows
  const out = rows.map((r) => ({ ...r }))
  if (scope === "turn" && (MUTATE === "cx" || MUTATE === "cy")) {
    // Mid-turn, where the silhouette is still well above the cy clause's own
    // legibility floor, so the nudge cannot hide inside the collapse.
    out[pickTarget(out, scope, 0.25)][MUTATE] += 6
  }
  if (scope === "wash" && MUTATE === "wash") {
    /* A mid-window frame faded toward paper — the cross-dissolve, in one frame.
     *
     * THE LIFT IS SIZED AGAINST THE ROW'S OWN TOLERANCE, not fixed at 12 luma,
     * and that is the second half of instrument bug nine. §11.7.2 verified this
     * control at `+12` on `reg-affine`, where the flat end reads 20.6 and the
     * mid-turn core 16.4 — 12 clears the +4 band comfortably. On `turn3` the
     * settled end reads 23.4 against a mid-turn core near 12.6, so the same 12
     * lands 2.8 luma SHORT of the line and the control reported "FAILED TO
     * FAIL" on a gate that was working. Whether a control can fire must not
     * depend on which capture it is pointed at.
     *
     * So: at least 12 (the small, only-just-visible defect the control is meant
     * to be), and always at least enough to cross the row's stated +4 band by
     * half a luma. The lift actually used is printed with the verdict. */
    const i = pickTarget(out, scope, 0.5)
    const ends = [out[0], out[out.length - 1]].map((r) => r.darkCore)
    const ref = Math.max(...ends)
    const lift = Math.max(12, ref + 4.5 - out[i].darkCore)
    out[i].darkCore += lift
    out[i].mean += lift
    MUTATED_AT[scope] += `, core ${(out[i].darkCore - lift).toFixed(1)} +${lift.toFixed(1)} -> ${out[i].darkCore.toFixed(1)} against the brighter end ${ref.toFixed(1)}`
  }
  if (scope === "drift" && MUTATE === "drift") {
    // The film never settles: the last frame is still moving. The target is the
    // last frame by definition, so there is nothing to derive — but it is still
    // named, so every control reports where it struck.
    const last = out[out.length - 1]
    last.cx += 2
    last.w += 4
    last.n = Math.round(last.n * 1.02)
    MUTATED_AT[scope] = `the LAST frame (${out.length - 1} of ${out.length}) — cx +2, w +4, ink +2%`
  }
  return out
}
/** Which gate each control is aimed at, and what verdict it REQUIRES — checked
 *  by name at the end. `expect: "pass"` is used by exactly one control and is
 *  spelled out rather than implied; see `notch`. */
/* ⚠ `shading` TARGETED ONE ROW AND THE HEADER PROMISES TWO — DEFECT (class 4,
 * a control checking less than it claims). The header says of it: *"Gate 1 and
 * gate 2 MUST go red. This is the defect the whole beat exists to remove, put
 * back."* The two rows gate 1 produces are ONE VALUE (the trimmed sd) and NO
 * specular highlight (the trimmed spread), and the control only ever looked at
 * the first. The lit-tubes distribution it pours in measures 5.72 trimmed sd
 * AND 28.3 trimmed spread against bars of 1 and 8 — so the spread row is
 * genuinely part of what the control proves, and it was going unchecked. A
 * control that verifies a subset of its own claim is the same class as a gate
 * that grades a subset of its own panel.
 *
 * `target` is a list now. Every named row must reach the required verdict. */
const MUTATION_TARGET = {
  cx: { target: ["REGISTRATION"], expect: "fail" },
  cy: { target: ["REGISTRATION"], expect: "fail" },
  drift: { target: ["ARRIVES and STOPS"], expect: "fail" },
  wash: { target: ["washes past"], expect: "fail" },
  shading: { target: ["ONE VALUE", "NO specular highlight"], expect: "fail" },
  notch: { target: ["ONE VALUE", "NO specular highlight"], expect: "pass" },
  speckle: { target: ["ONE VALUE"], expect: "fail" },
}

/* -------------------------------------------------------------------------- */
/*  PIXEL-LEVEL CONTROLS FOR GATE 1 — see the header and `FLAT_TRIM`           */
/* -------------------------------------------------------------------------- */

/** These act on the luma FIELD of the flat frame, before the mask and erosion. */
const PIXEL_MUTATIONS = new Set(["shading", "notch", "speckle"])
/** What the control actually did, printed with the verdict. */
let PIXEL_NOTE = null

/**
 * THE SHADING CONTROL'S REFERENCE IS THE NEGATIVE CONTROL'S OWN DISTRIBUTION.
 *
 * Not an invented gradient. `before/` is the capture of lit inflate tubes seen
 * head-on — the exact defect this beat was built to remove, and the arm the
 * thresholds were calibrated against (sd 5.8, spread 65.6). Its interior
 * luminance values are read off disk, sorted, and laid across the target frame's
 * interior along a spatial ramp, so the mutant carries the DEFECT'S OWN value
 * distribution as a smooth gradient over the current mark's own shape.
 *
 * That is the strongest form this control can take: it cannot be accused of
 * being an invented difficulty, because it is a measurement of the thing gate 1
 * exists to reject.
 */
async function shadingReference() {
  const base = join(ROOT, "docs", "verification", "hero-transition", "before")
  const man = JSON.parse(readFileSync(join(base, "manifest.json"), "utf8"))
  const breath = man.manifest.filter((m) => m.phase === "breath")
  const i = breath.length ? breath[Math.floor(breath.length / 2)].i : 20
  const img = await loadImage(join(base, "scrub", String(i).padStart(4, "0") + ".png"))
  const c = createCanvas(img.width, img.height)
  const ctx = c.getContext("2d")
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, img.width, img.height)
  const W = img.width
  const H = Math.floor(img.height * 0.75)
  const luma = new Float32Array(W * H)
  for (let p = 0; p < W * H; p++) {
    const k = p * 4
    luma[p] = 0.2126 * data[k] + 0.7152 * data[k + 1] + 0.0722 * data[k + 2]
  }
  const inte = interiorOf(luma, W, H)
  const vals = []
  for (let p = 0; p < W * H; p++) if (inte[p]) vals.push(luma[p])
  vals.sort((a, b) => a - b)
  return vals
}

function makePixelMutator(kind, ref) {
  return (luma, W, H, interior) => {
    const idx = []
    for (let p = 0; p < W * H; p++) if (interior[p]) idx.push(p)
    if (idx.length === 0) return
    if (kind === "shading") {
      // Rank the interior along a 35-degree ramp, then pour the reference
      // distribution down it. Monotone in space => a gradient, not noise.
      const A = Math.cos((35 * Math.PI) / 180)
      const B = Math.sin((35 * Math.PI) / 180)
      const key = (p) => A * (p % W) + B * Math.floor(p / W)
      idx.sort((a, b) => key(a) - key(b))
      for (let r = 0; r < idx.length; r++) {
        luma[idx[r]] = ref[Math.min(ref.length - 1, Math.floor((r * ref.length) / idx.length))]
      }
      PIXEL_NOTE =
        `the BEFORE capture's own interior distribution (${ref.length} px, ` +
        `${ref[0].toFixed(1)}..${ref[ref.length - 1].toFixed(1)} luma) poured across ` +
        `${idx.length} interior px as a 35-degree ramp`
      return
    }
    /* THE COVERAGE ARTEFACT, SYNTHESISED — isolated blend pixels deep inside the
     * interior, exactly like the three real ones at the "D"'s hairline gap. The
     * values stay UNDER `INK_MAX_LUMA` on purpose: that is what makes them
     * survive the mask and the erosion, which is the entire reason the real ones
     * do. A value over the threshold would punch a hole and the erosion would
     * eat its neighbours — a different defect, and not this one. */
    const frac = kind === "notch" ? 0.8 * FLAT_TRIM : 3 * FLAT_TRIM
    const k = Math.max(1, Math.round(frac * idx.length))
    const stride = Math.max(1, Math.floor(idx.length / k))
    const blends = [30, 61, 100, 140]
    let hit = 0
    for (let r = 0; r < idx.length && hit < k; r += stride, hit++) {
      luma[idx[r]] = blends[hit % blends.length]
    }
    PIXEL_NOTE =
      `${hit} of ${idx.length} interior px (${((100 * hit) / idx.length).toFixed(3)} %) set to ` +
      `blend values ${blends.join("/")}, against a tolerance of ${(100 * FLAT_TRIM).toFixed(2)} % ` +
      `— the real artefact measures 0.072 %`
  }
}

/** Every capture on disk with a manifest, newest first. */
function captures() {
  const dir = dirname(BASE)
  return readdirSync(dir)
    .map((l) => {
      try {
        return { l, m: statSync(join(dir, l, "manifest.json")).mtimeMs }
      } catch {
        return null
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.m - a.m)
}

/** The newest thing the beat is BUILT from — the subject the capture is
 *  evidence about. Used only to print the age, never to score it; see the
 *  refusal below for why the ruling is the reader's on a chosen label. */
function newestSourceMtime() {
  let best = { path: null, m: 0 }
  const walk = (d) => {
    let entries
    try {
      entries = readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue
      const p = join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(ts|tsx|mjs|js)$/.test(e.name)) {
        const m = statSync(p).mtimeMs
        if (m > best.m) best = { path: p.slice(ROOT.length + 1), m }
      }
    }
  }
  for (const d of ["lib", "app", "components"]) walk(join(ROOT, d))
  return best
}

async function main() {
  /* ══ A BARE RUN IS REFUSED ═════════════════════════════════════════════════
   *
   * ⚠ DEFECT (class 6, stale input judged as current). `LABEL` defaulted to
   * `"after"`, and `after/` is a capture of a beat that no longer exists — on
   * 2026-08-02 it was 4.2 days old with 24 newer captures beside it. A bare run
   * therefore returned three confident RED rows (REGISTRATION, MOMENT, SLIVER)
   * about a build from before the turn and K7 landed, and nothing in the exit
   * code or the row text distinguished "this build is broken" from "you are
   * judging last week's film".
   *
   * The provenance block below this was the previous attempt at the same
   * problem, and it said of itself: *"This does not change any row, any verdict
   * or any exit code."* That is printing louder, and printing louder does not
   * stop a sweep table from recording the reds. A default that is wrong four
   * days out of five is not a default, it is a trap — so there is no default.
   *
   * NOT a staleness score on an EXPLICIT label, deliberately. Several arms on
   * disk (`before`, `carve-prior`, `e16-prior`, `reg-persp`…) are parked
   * controls that are SUPPOSED to be older than the source and SUPPOSED to be
   * red; failing them for their age would make the row noise. Choosing a label
   * is choosing a subject. The age is printed with the newest source file
   * beside it so the ruling is informed, and it is the reader's. */
  /* ── 2026-08-03 · THE BARE RUN NOW CAPTURES, RATHER THAN REFUSING ────────
   *
   * Everything above is right and none of it is undone: there is still no
   * stored default, because a stored default goes stale and a stale default is
   * a trap. What changed is that REFUSING was not a resting state either.
   *
   * Two channels of `assert-gate-integrity` pull in opposite directions on this
   * file. C requires a stored gate to exit non-zero on a label that does not
   * exist — this one does. I requires the argument-free invocation, "the one the
   * next person types", to mean something — and a refusal is exit 2, which every
   * sweep table records as red, indistinguishable from a regression. Printing
   * louder does not fix that; the previous note in this block says so about its
   * own predecessor.
   *
   * The way out is not a default. It is to stop grading STORED evidence when
   * nobody named an arm: a bare run captures `--label=bare` from the running dev
   * server and judges the frames it just took. That removes the staleness class
   * entirely rather than managing it — the evidence is this build by
   * construction — and it costs a capture, which is what a browser gate costs.
   * An explicit `--label=` still reads a parked arm exactly as before, so the 29
   * controls on disk and every `--gates=prior` comparison are untouched.
   *
   * If the capture cannot run (no dev server) it exits 2 with the parked arms
   * listed, which is the same refusal as before and is now about the
   * ENVIRONMENT, not about the input. */
  if (LABEL_WAS_DEFAULTED) {
    console.log(
      `\nNo --label= given: capturing --label=${BARE_LABEL} from the running dev server and judging THAT.\n` +
        `  This gate has no stored default on purpose — a default that is wrong four days out of\n` +
        `  five is a trap, and grading a build that no longer exists is how it once returned three\n` +
        `  confident reds belonging to a different beat. Name an arm to grade one of the parked\n` +
        `  captures instead (--label=k7final is the current shipped arm).\n`,
    )
    const cap = spawnSync(
      "node",
      [join(__dirname, "verify-hero-transition.mjs"), `--label=${BARE_LABEL}`],
      { cwd: ROOT, stdio: "inherit" },
    )
    if (cap.status !== 0) {
      const all = captures()
      console.error(
        `\nREFUSED — the fresh capture failed (exit ${cap.status}). Is \`pnpm dev\` up on ` +
          `${PORT}?\n\n` +
          `  ${all.length} parked captures on disk, newest first:\n` +
          all
            .slice(0, 8)
            .map(
              (c) =>
                `    --label=${c.l.padEnd(22)} ${new Date(c.m).toISOString().slice(0, 16).replace("T", " ")}`,
            )
            .join("\n") +
          (all.length > 8 ? `\n    …and ${all.length - 8} more in ${dirname(BASE)}` : "") +
          `\n\n  The current arm is --label=k7final unless a lane says otherwise.\n`,
      )
      process.exit(2)
    }
  }

  if (!existsSync(BASE)) {
    console.error(`no capture at ${BASE} — run verify-hero-transition.mjs first`)
    process.exit(1)
  }
  if (!existsSync(join(BASE, "manifest.json"))) {
    /* A DIRECTORY IS NOT A CAPTURE. `_registration-proof/` and
     * `reduced-motion/` are image-only folders that live beside the captures,
     * and pointing `--label=` at either used to throw a raw ENOENT stack out of
     * `statSync` in the provenance block. A stack trace is not a verdict and
     * cannot be attributed in a sweep table — the same reason the refusal above
     * exists. */
    console.error(
      `\n"${LABEL}" is a directory under ${dirname(BASE)} but not a capture — it has no ` +
        `manifest.json.\n  Image-only folders (_registration-proof, reduced-motion) live there ` +
        `too; they are evidence for other lanes, not subjects for this gate.\n`,
    )
    process.exit(2)
  }

  /* ── PROVENANCE: WHICH FILM IS THIS, AND HOW OLD (lane 23, 2026-08-02) ──────
   *
   * The default label is `after`, and on 2026-08-02 that capture was from
   * 07-29 20:38 while the current arm, `k7final`, was from 08-01 00:33. So the
   * DEFAULT invocation — the one `assert-gate-integrity.mjs` certifies, and the
   * one a bare sweep makes — read **6/9 on a three-day-old film of a beat that
   * no longer exists**, while `--label=k7final` read 9/9 on the same code.
   *
   * Neither number was wrong. What was missing is that nothing in the output
   * distinguished "this build is broken" from "you are judging last week's
   * film", and those two reds look identical in a sweep table. A red that
   * cannot be attributed is the same defect class as a green that cannot fail.
   *
   * This does not change any row, any verdict or any exit code — it only makes
   * the subject of the verdict legible. The staleness ruling stays with the
   * reader on purpose: this file cannot know which arm is current, only which
   * ones exist and when they were written. */
  const capturedAt = statSync(join(BASE, "manifest.json")).mtime
  const ageH = (Date.now() - capturedAt.getTime()) / 36e5
  const siblings = captures()
  const newest = siblings[0]
  const age = (h) => (h < 48 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`)
  console.log(
    `\n[capture] judging "${LABEL}" — captured ${capturedAt.toISOString().slice(0, 16).replace("T", " ")} ` +
      `(${age(ageH)} old)`,
  )
  if (newest && newest.l !== LABEL) {
    const newerBy = (newest.m - capturedAt.getTime()) / 36e5
    if (newerBy > 1)
      console.log(
        `[capture] ${siblings.length - 1} other capture(s) on disk, most recent "${newest.l}" ` +
          `(${age(newerBy)} newer than this one).`,
      )
  }
  /* THE SUBJECT'S OWN AGE, printed beside the capture's. A capture is evidence
   * about the code that produced it, so the number that decides whether it is
   * current is not its age in hours — it is whether the beat has been rebuilt
   * since. Named file and all, so the ruling is informed rather than a vibe.
   *
   * Printed, not scored, and the refusal at the top of `main` says why: an
   * explicit label is a chosen subject, and several arms here are parked
   * controls that are older than the source ON PURPOSE. */
  {
    const src = newestSourceMtime()
    if (src.path) {
      const behind = (src.m - capturedAt.getTime()) / 36e5
      console.log(
        behind > 1
          ? `[capture] ⚠️  the beat's source has moved since: newest is ${src.path}, ` +
              `${age(behind)} NEWER than this capture. This run judges the build as it was, not as it is.`
          : `[capture] current — nothing under lib/, app/ or components/ is newer than this capture ` +
              `(newest is ${src.path}).`,
      )
    }
  }

  const manifest = JSON.parse(readFileSync(join(BASE, "manifest.json"), "utf8"))
  const scrub = join(BASE, "scrub")
  const frameAt = (i) => join(scrub, String(i).padStart(4, "0") + ".png")

  /* ---- 1. Frame one is a drawing --------------------------------------- */
  // Sampled in the BREATH beat, not at t=0: at t=0 the draw-in has not put any
  // ink on the page yet, so "frame one" in the sense that matters — the first
  // frame that shows the finished mark — is the still one just before the beat.
  if (manifest.projection) {
    console.log(
      `projection: ${manifest.projection}` +
        (manifest.projectionForced ? "  (FORCED — this is the control arm)" : "  (page default)") +
        "\n",
    )
  }

  const breath = manifest.manifest.filter((m) => m.phase === "breath")
  const flatIdx = breath.length ? breath[Math.floor(breath.length / 2)].i : 20
  const pixelMutator = PIXEL_MUTATIONS.has(MUTATE)
    ? makePixelMutator(MUTATE, MUTATE === "shading" ? await shadingReference() : null)
    : null
  const flat = await measure(frameAt(flatIdx), pixelMutator)

  /* THE HELD ¾ IS `orbit`, NOT `hold` — and this changed because the BEAT
   * changed, not because the gate wanted a better number.
   *
   * Gate 2 is the mirror of gate 1: if flatness had been achieved by dimming
   * the rig rather than by flattening the form, the END of the beat would read
   * flat too. It has always sampled the phase named `hold`, which used to BE
   * the held three-quarter.
   *
   * K7 landed (`hero-beat-storyboard.md` §3 K7 — *"back to the opening state,
   * at K1's framing… the mark FLAT again"*), so the beat now closes the round
   * trip and its `hold` is a flat drawing BY DESIGN. Measured on `reg-affine`:
   * the `hold` sample reads sd 0.00 / spread 0.0 — identical to the flat beat,
   * to the digit — because it IS the flat beat coming back. Left pointed at
   * `hold`, gate 2 asks the settled DRAWING to have the tonal range of a lit
   * solid, which is the opposite of what the beat is now for.
   *
   * `orbit` is the held ¾ — camera parked at az 38 / el 10, form fully solid.
   * The fallback keeps every pre-K7 capture (`before`, `after`, `turn`…)
   * judged exactly as it was, and the phase actually read is printed in the row
   * so this can never quietly drift again. */
  const threeQuarter = manifest.manifest.filter((m) => m.phase === "orbit")
  const hold = manifest.manifest.filter((m) => m.phase === "hold")
  const holdSource = threeQuarter.length ? threeQuarter : hold
  const holdPhase = threeQuarter.length ? "orbit" : "hold"
  const holdIdx = holdSource.length
    ? holdSource[Math.floor(holdSource.length / 2)].i
    : manifest.frames - 2
  const solid = await measure(frameAt(holdIdx))

  if (!flat || !solid) {
    console.error("could not measure ink in the sampled frames")
    process.exit(1)
  }

  // THRESHOLDS CALIBRATED AGAINST THE NEGATIVE CONTROL, not guessed. Measured
  // on the same interior mask, same page, same beat position:
  //
  //   before/  (lit inflate tubes head-on — the defect)   sd 5.8   spread 65.6
  //   after/   (the flat state)                           sd 0.0   spread  0.0
  //   hold     (the settled lit ¾, identical in both)     sd 8.4   spread 102.4
  //
  // The flat state is not "nearly" uniform, it is EXACTLY uniform: every one of
  // 9,534 interior pixels carries the same value, because an emissive-only
  // surface with a black albedo has no term that varies with normal or light.
  // So the gate can sit far below the defect rather than splitting the
  // difference with it — 5.8 fails by six times over.
  //
  /* ⚠ THE STATISTIC IS TRIMMED NOW, AND THE CLAIM IS UNCHANGED. This is §17
   * rule 4 — *"if your change makes a check fail because the check is WRONG,
   * fix the check and prove the fix with its negative control"* — and the whole
   * calibration lives in `FLAT_TRIM` (lib/flat-interior.mjs) rather than here.
   *
   * The short version: the interior mask contains a bounded residue of COVERAGE
   * pixels that the isotropic erosion cannot reach — a sub-pixel CONCAVE gap has
   * no mask boundary for the erosion to work back from, so its antialiasing ramp
   * survives inside a black body. The pen carve opens exactly such a gap between
   * two strokes of the "D", correctly, and THREE pixels of 4151 then read
   * sd 1.256 while 4148 sit at exactly luma 21. Those three are coverage
   * samples, not surface samples, and they say nothing about shading.
   *
   * So the verdict is the TRIMMED pair plus an explicit bound on the residue,
   * and the raw values are printed beside it so nothing is hidden. The residue
   * clause is not a loosening — it is a second, stricter claim the gate never
   * made before: the exceptions must be a HAIRLINE (O(perimeter)) and not a
   * SHADING (O(area)). Measured, the two are 0.072 % against 84.37 %.
   *
   * Three controls keep it honest, all of them pixel-level:
   *   --mutate=shading  the negative control's own distribution, imposed  -> RED
   *   --mutate=notch    residue at 80 % of tolerance                      -> GREEN
   *   --mutate=speckle  residue at 3x tolerance                           -> RED */
  const residueOK = flat.residue <= flat.residueMax
  record(
    "flat beat renders as ONE VALUE (no shading)",
    flat.sdTrim < 1 && residueOK,
    `trimmed ink luminance sd ${flat.sdTrim.toFixed(3)} over ${flat.n} px ` +
      `(needs < 1; lit tubes head-on measure 5.72 trimmed, 5.81 raw)` +
      `\n      residue ${flat.offModal} px off the modal luma ${flat.modal} = ` +
      `${(100 * flat.residue).toFixed(4)} % (needs <= ${(100 * flat.residueMax).toFixed(2)} %; ` +
      `lit tubes head-on measure 84.37 %)` +
      (flat.outliers.length ? ` — e.g. ${flat.outliers.join(" ")}` : "") +
      `\n      [raw, not the verdict] sd ${flat.sd.toFixed(3)}, ` +
      `${flat.trimCut} px trimmed from each end`,
  )
  record(
    "flat beat has NO specular highlight",
    flat.spreadTrim < 8,
    `trimmed ink luminance spread ${flat.spreadTrim.toFixed(1)} ` +
      `(needs < 8; lit tubes head-on measure 28.3 trimmed, 65.6 raw)` +
      `\n      [raw, not the verdict] spread ${flat.spread.toFixed(1)}` +
      (PIXEL_NOTE ? `\n      [--mutate=${MUTATE}] ${PIXEL_NOTE}` : ""),
  )

  /* ---- 2. The hold is an object ---------------------------------------- */
  // The mirror gate, and it is not redundant: flatness achieved by dimming the
  // rig or by killing the material would leave the END of the beat flat too.
  // Spread carries this one — sd alone separates the lit ¾ from the lit-head-on
  // defect by only 8.4 vs 5.8, which is too thin a margin to be evidence.
  record(
    "held ¾ has real tonal range (not a flat cut-out)",
    solid.sd > 6 && solid.max - solid.min > 60,
    `ink luminance sd ${solid.sd.toFixed(1)} (needs > 6), spread ${(solid.max - solid.min).toFixed(1)} (needs > 60), over ${solid.n} px` +
      `  — sampled in "${holdPhase}" f${holdIdx}`,
  )

  /* ---- 3-5. The handoff ------------------------------------------------ */
  // Optional so the BEFORE capture — which predates this beat and has no
  // emerge window to sample — can still be run through gates 1 and 2. That
  // run is the negative control: it is what proves these gates can fail.
  /** The gates that only exist when there is an emerge window to read. Named,
   *  so a skip can be reported as the specific hole it is rather than as an
   *  absence nobody has to account for. */
  const HANDOFF_GATES = [
    "3 · ink never washes past the settled value",
    "4 · REGISTRATION holds across the parked window",
    "5 · the beat contains a MOMENT",
    "5b · the moment is a SLIVER",
    "6 · the beat ARRIVES and STOPS",
  ]
  if (CALIBRATE === "skip" || !existsSync(join(BASE, "emerge-manifest.json"))) {
    /* ⚠ DEFECT (class 7, a skip counted as a pass). This branch printed
     * "(no emerge window in this capture — handoff gates skipped)" and then
     * `2/2 gates passed`, exit 0. Three directories on disk are in that state —
     * `before/`, `reduced-motion/`, `_registration-proof/` — and nothing in the
     * output, the score or the exit code distinguished 2-of-2 from 2-of-6. A
     * sweep table recording "assert-hero-transition ✓" against such a run is
     * recording that five gates held when five gates never ran.
     *
     * A SKIP IS NOT A PASS. The five are named and the exit is a distinct
     * non-zero code (3 = not covered, as against 1 = a gate failed), so the two
     * are still tellable apart by a caller. The negative-control use this branch
     * was written for — running `before/` through gates 1 and 2 — is untouched
     * and still prints both rows; `before/` fails them anyway, which is the
     * whole reason it is kept. */
    const failedEarly = results.filter((r) => !r.pass)
    console.log(
      `\nNOT COVERED — "${LABEL}" has no emerge-manifest.json, so ${HANDOFF_GATES.length} of the ` +
        `${results.length + HANDOFF_GATES.length} gates could not run:\n` +
        HANDOFF_GATES.map((g) => `    skipped: ${g}`).join("\n"),
    )
    console.log(
      `\n${results.length - failedEarly.length}/${results.length} gates passed on "${LABEL}" — and ` +
        `${HANDOFF_GATES.length} more were SKIPPED, which is not passed.`,
    )
    console.log(
      `\nflat beat   mean ${flat.mean.toFixed(1)}  sd ${flat.sd.toFixed(1)}  spread ${(flat.max - flat.min).toFixed(1)}` +
        `\nheld \u00be      mean ${solid.mean.toFixed(1)}  sd ${solid.sd.toFixed(1)}  spread ${(solid.max - solid.min).toFixed(1)}`,
    )
    if (CALIBRATE === "skip") {
      /* THE KNOWN-BAD FOR THIS BRANCH, and its verdict is inverted. Gates 1 and
       * 2 are green here by construction (it is a real, current capture); five
       * gates did not run. Under the branch as it was written that state
       * printed `2/2 gates passed` and exited 0, and nothing anywhere
       * distinguished it from 6/6. The required verdict is a non-zero exit. */
      const ok = failedEarly.length === 0
      console.log(
        `\nCALIBRATION --calibrate=skip: ${results.length - failedEarly.length}/${results.length} ` +
          `gates green and ${HANDOFF_GATES.length} skipped on a capture that HAS an emerge window.` +
          `\n  ${ok ? "reproduced, correctly" : "PRECONDITION NOT MET"} — the old branch printed ` +
          `"${results.length}/${results.length} gates passed" and exited 0 on exactly this state.` +
          `\n  Required verdict: a non-zero exit. Got: 3.`,
      )
      process.exit(ok ? 3 : 2)
    }
    process.exit(failedEarly.length ? 1 : 3)
  }
  const emergeManifest = JSON.parse(readFileSync(join(BASE, "emerge-manifest.json"), "utf8"))
  const emergeDir = join(BASE, "emerge")
  const files = readdirSync(emergeDir).filter((f) => f.endsWith(".png")).sort()
  const series = []
  for (const f of files) {
    const m = await measure(join(emergeDir, f))
    if (m) series.push(m)
  }

  /* ---- 3. No value wash — MEASURED ON THE DARK CORE, AGAINST BOTH ENDS ----
   *
   * The craft rule is untouched and right: Desk Doodles' tonal range comes from
   * light and mark density, never from washing the ink out, and a midpoint
   * lighter than the ends is the signature of the cross-dissolve this beat must
   * not read as. Two things about how it was MEASURED were wrong, and both were
   * found by running it rather than by reading it. `hero-beat-storyboard.md`
   * §11.4.2 left the row red with the cause explicitly unresolved — *"I do not
   * know from this measurement whether the beat now violates the brand law or
   * the gate is reading a legitimately raked lit face against a reference that
   * moved."* This is that ruling, with the numbers that decide it.
   *
   * (a) THE STATISTIC WAS THE MEAN, AND THE MEAN CANNOT TELL A WASH FROM A
   *     RAKE. On `turn3` the row failed at peak mean 37.2 against settled 23.4.
   *     Percentiles of the same eroded interior, first frame out of the dwell
   *     against the settled solid:
   *
   *         frame       p05    p25    med    p95
   *         f40 (w153)  12.6   20.6   27.8   87.0
   *         settled     12.6   18.7   23.6   35.0
   *
   *     The dark core does not move — 12.6 against 12.6, to the digit. What
   *     rises is the lit end, 87.0 against 35.0. That is a face caught at a
   *     raking angle presenting more of its lit shoulder, which is the brand
   *     law WORKING, not breaking. A cross-dissolve cannot do that: fading a
   *     mark toward paper lifts every pixel, the darkest one included, so it
   *     shows up in the core immediately. The core is the discriminating
   *     statistic — and it is the statistic the board itself already uses
   *     (§3 K3 measures *"only the face's dark core (luma < 60) so the
   *     antialiased fringe cannot contaminate the statistic"*).
   *
   * (b) THE REFERENCE WAS ONE ENDPOINT. "No frame may be lighter than the
   *     SETTLED form" was written when the flat mark was the darker of the two
   *     ends (turn3: flat 3.2, settled 23.4). It is not any more — on
   *     `reg-affine` the flat mark reads 20.6 and the settled solid's core
   *     13.6, so the rule as written asks the beat to never be as light as the
   *     drawing it starts from. The defect is a MIDPOINT EXCURSION: a frame
   *     lighter than BOTH ends. Comparing against the brighter end is the
   *     correctly stated version of the same rule, not a loosening of it —
   *     a crossfade goes through paper and clears either end by two hundred
   *     luma.
   *
   * The prior statistic is computed and printed beside the verdict, so what
   * changed is visible rather than described, and `--mutate=wash` lifts a
   * mid-window frame's core and requires this row to go red.
   */
  const flatEnd = series[0]
  const settledEnd = series[series.length - 1]
  const washRef = Math.max(flatEnd.darkCore, settledEnd.darkCore)
  const washSeries = mutateRows(series.map((s) => ({ ...s })), "wash")
  const corePeak = washSeries.reduce((a, b) => (b.darkCore > a.darkCore ? b : a))
  const priorPeak = series.reduce((a, b) => (b.mean > a.mean ? b : a))
  if (GATES === "prior") {
    // PARKED ARM — the mean against the settled end, verbatim. `turn3` still
    // reads its own 37.2 / 23.4 here, so the row this ruling overturns stays
    // reproducible rather than remembered.
    record(
      "ink never washes past the settled value  [PRIOR]",
      priorPeak.mean <= settledEnd.mean + 4,
      `peak mean ${priorPeak.mean.toFixed(1)} vs settled ${settledEnd.mean.toFixed(1)} (needs <= +4)`,
    )
  } else {
    record(
      "ink never washes past the settled value",
      corePeak.darkCore <= washRef + 4,
      `peak dark core ${corePeak.darkCore.toFixed(1)} vs the brighter end ${washRef.toFixed(1)} ` +
        `(flat ${flatEnd.darkCore.toFixed(1)} / settled ${settledEnd.darkCore.toFixed(1)}, needs <= +4)` +
        `\n      [prior statistic, not the verdict] peak interior MEAN ${priorPeak.mean.toFixed(1)} vs settled ${settledEnd.mean.toFixed(1)}` +
        ` — its lit end reads ${priorPeak.litEdge.toFixed(1)} against ${settledEnd.litEdge.toFixed(1)}, i.e. rake`,
    )
  }

  // 4-5. Only the frames where the camera is parked can be judged this way —
  //      once the tilt starts, the silhouette is SUPPOSED to move.
  /* THE PARKED WINDOW IS THE WHOLE EMERGE, NOT A FIXED 0.55s.
   *
   * This used to cut the window at `+0.55s`, sized for the old 0.54s emerge.
   * The turn is 0.92s, so the cut landed mid-recovery — and `settled` is the
   * MEDIAN OF THE LAST FIVE WIDTHS, which then came from the dwell itself.
   * The gate computed `settled = 24 px`, i.e. the sliver, and every threshold
   * derived from it (the 5% moment band, the 90% recovery) was being measured
   * against the very frames it was supposed to be judging. It reported "no
   * moment" on a beat whose moment is plainly there in the frames.
   *
   * The capture already derives the window as exactly the emerge phase (w0 is
   * the frame before it, w1 the first frame after), and the camera is parked
   * for all of it, so the whole window is the parked window. Deriving it from
   * the data instead of a constant means a retimed beat cannot desync it. */
  /* …AND IT STARTS WHERE THE TURN STARTS, NOT ONE FRAME EARLIER.
   *
   * The capture deliberately opens the window at the scrub sample BEFORE the
   * emerge, so its leading frames belong to `anticipation`. That phase's squash
   * is not a registration signal and must not be read as one: it is a
   * non-uniform 2D scale PINNED AT THE CONTACT, so it moves the bbox's vertical
   * midpoint by design, at full extent, on exactly the frames the cy clause
   * trusts most. `assert-hero-dead-channels.mjs` asserts that pinning as a
   * FEATURE — *"the squash is pinned at the CONTACT, not the centre — the
   * baseline holds — cy 501.0 -> 505.0"* — and measured on `reg-affine` the
   * wind-up's release steps cy 424.0 -> 421.0, i.e. 3.00 px, which the gate
   * then reported as a failed registration on a beat whose registration is
   * exact.
   *
   * So the parked window is the TURN and its landing. This narrows what the
   * gate looks at; it does not soften what it asks, and `--mutate=cy` exists
   * precisely so that claim is checked rather than asserted: a 6 px vertical
   * displacement inside the turn still has to go red.
   *
   * Captures written before the phase was recorded per emerge frame keep the
   * whole window, so their verdicts are unchanged. */
  /* ⚠ AND AN UNLABELLED CAPTURE IS REFUSED, NOT SILENTLY JUDGED ON THE WRONG
   * WINDOW — DEFECT (class 6, stale input, compounding the default label).
   *
   * The fallback here used to be `labelled ? … : series` with the note *"the
   * whole captured window (no per-frame phase in this capture)"*, and the
   * comment above justified it as *"Captures written before the phase was
   * recorded per emerge frame keep the whole window, so their verdicts are
   * unchanged."* Their verdicts being unchanged was the problem, not the
   * reassurance: the paragraph directly above this one spends twenty lines
   * explaining that the whole window INCLUDES `anticipation`, whose squash is a
   * contact-pinned 2D scale that moves the bbox midpoint BY DESIGN, at full
   * extent, on exactly the frames the cy clause trusts most — and that reading
   * it as registration produces a false failure.
   *
   * So the fallback did the one thing the note said produces a false failure,
   * and then reported the result as a registration verdict. It duly did on
   * `after/`: `max CONTACT step 4.00 px (needs < 2)`, a red row about the
   * wind-up's release on a beat whose registration is exact. Six of the 27
   * captures on disk are unlabelled (`after`, `drawrange`, `turn`, `turn2`,
   * `turn3`, `turn4`) and every one of them was being judged this way.
   *
   * A window that cannot be identified is NOT COVERED, and not covered is not a
   * pass. `--mutate=cx`/`cy` are unaffected: they inject into the parked rows,
   * which on a labelled capture are the turn's. */
  const emergePhases = emergeManifest.map((m) => m?.phase ?? null)
  const labelled = emergePhases.some((p) => p != null)
  const turnStart = labelled ? emergePhases.findIndex((p) => p === "emerge") : -1
  const parked = turnStart > 0 ? series.slice(turnStart) : series
  const windowNote = labelled
    ? turnStart > 0
      ? `the turn and its landing — ${series.length - parked.length} leading "${emergePhases[0]}" frames excluded`
      : "the whole captured window"
    : "UNIDENTIFIABLE — this capture records no per-frame phase"
  const parkedRows = mutateRows(parked.map(toRow))
  const st = momentStats(parkedRows)

  if (GATES === "prior") {
    // PARKED ARM — the gates exactly as shipped, so what changed is visible
    // rather than described. These are the two that reject the original flip.
    const g = priorRegistrationGate(st)
    record(g.name, g.pass, `${g.detail} across ${parked.length} frames`)

    const sds = series.map((s) => s.sd)
    const span = Math.max(...sds) - Math.min(...sds)
    let biggestStep = 0
    for (let i = 1; i < sds.length; i++) {
      biggestStep = Math.max(biggestStep, Math.abs(sds[i] - sds[i - 1]))
    }
    record(
      "the change is gradual, not a cut  [PRIOR]",
      span > 4 && biggestStep < span * 0.45,
      `tonal-range span ${span.toFixed(1)}, largest single-frame step ${biggestStep.toFixed(1)} (needs < ${(span * 0.45).toFixed(1)})`,
    )
  } else {
    // 4. REGISTRATION holds — and only registration. The width clause is gone:
    //    extent continuity is exactly what a moment breaks, and that clause is
    //    the sole reason this set would reject the original flip.
    //
    /* ⚠ 🔴 THIS ROW IS RED ON A FRESH CAPTURE AS OF 2026-09-04, AND IT IS THE
     * BEAT THAT MOVED, NOT THE RULER. Written down because the obvious first
     * move — the one I made and backed out — is to blame the statistic, and the
     * numbers say otherwise.
     *
     * FRESH `bare`, shot today, reads max cx step 2.50 px against a bar of 2.
     * The step is f28 -> f29 of the emerge, and it decomposes as:
     *
     *     x0   293 -> 410   +117      the mark contracting into the moment
     *     x1   828 -> 706   -122
     *     w    536 -> 297             a 2.09 % asymmetry in a 239 px contraction
     *
     * Both edges move INWARD, so the common mode of the pair is ZERO — no rigid
     * translation is consistent with it — and the CONTACT holds at 1.00 px with
     * the vertical common mode at 0.00. On its face that reads like the
     * midpoint-versus-dilation problem amendment 1b already solved one axis over.
     *
     * ⭐ IT IS NOT, AND THE PARKED CAPTURES ARE HOW YOU KNOW. Same measurement,
     * same window, four labels:
     *
     *     capture    date          settled   max |dw|   max |dcx|
     *     k7final    2026-08-01       612       241       0.50
     *     e19        2026-08-02       612       242       0.00
     *     lane26     2026-08-02       612       242       0.00
     *     bare       2026-09-04       619       242       2.50   <- the bar is 2
     *
     * THE EXTENT DYNAMICS ARE IDENTICAL — 241, 242, 242, 242 — and the midpoint
     * step went from 0.00-0.50 to 2.50. Three captures cleared this bar by 4x on
     * the same turn. So the bar is not tight; the silhouette's extreme points
     * started behaving differently, and the settled extent moved 612 -> 619 with
     * them.
     *
     * WHAT I TRIED AND BACKED OUT, so nobody re-runs it: replacing the cx
     * midpoint with a HORIZONTAL COMMON MODE, exactly parallel to 1b. It turns
     * this row green — and it makes `docs/storyboard/tools/assert-moment.mjs` go
     * from SOUND to NOT SOUND, because the synthetic mis-registered layer swap
     * (+6 px at the collapse) puts its shift across a 135 -> 238 px dilation
     * whose two edge deltas are -45.5 and +57.5, opposite signs, common mode 0.
     * The replacement is blind to the one control this row exists for. Reverted
     * unshipped: a change that makes a known-bad pass is not a fix.
     *
     * WHAT IS NOT YET ISOLATED, and it is not this gate's file: WHICH of the
     * month's engine changes moved it. The suspects are the two that changed the
     * drawn word itself on 2026-08-28 — `dropSubNibStubs` (22 traced polylines
     * -> 13 drawn) and the broad nib — because both change which FEATURE is the
     * leftmost and rightmost pixel at a given yaw, and therefore how the bbox
     * behaves through the turn. Neither has a harness switch on this page, so
     * bisecting it needs `app/desk-doodles/page.tsx` or `lib/hero-motion.ts`. */
    const reg = registrationGate(st)
    if (!labelled) {
      // See the note on `emergePhases`. Judging this would mean judging the
      // anticipation squash as a registration signal, which the window note
      // twenty lines up says produces a false failure. Refused, and refusing is
      // a FAIL rather than a skip — same rule as the ARRIVES-AND-STOPS row's
      // own "NOT COVERED, which is not a pass".
      record(
        reg.name,
        false,
        `NOT COVERED, which is not a pass — "${LABEL}" records no per-frame phase, so the parked ` +
          `window cannot be separated from the anticipation that precedes it. The squash is a ` +
          `contact-pinned scale and moves the bbox midpoint by design, so judging the whole ` +
          `${series.length}-frame window reports a false registration failure. Re-capture with ` +
          `verify-hero-transition.mjs, which records the phase per emerge frame.` +
          `\n      [what it WOULD have said on the wrong window, not the verdict] ${reg.detail}`,
      )
    } else {
      record(reg.name, reg.pass, `${reg.detail}, across ${parked.length} parked frames — ${windowNote}`)
    }

    // 5. The beat contains a MOMENT, and the moment is a sliver.
    const mom = momentGate(st)
    record(mom.name, mom.pass, mom.detail)
    const sliv = sliverGate(st)
    record(sliv.name, sliv.pass, sliv.detail)

    if (st.halfAt !== null) {
      console.log(
        `      spacing: extent value-half at ${(100 * st.halfAt).toFixed(1)}% of the move — ${spacingBand(st.halfAt)}`,
      )
    }
  }

  /* ---- 6. The beat ARRIVES AND STOPS ------------------------------------ */
  /*
   * WHAT THIS USED TO MEASURE, AND WHY IT NO LONGER CAN.
   *
   * §8's stillness gate, as corrected by §10.4 amendment 3, is net displacement
   * across all of extent over a fixed 1.33s tail. That window was chosen to
   * reach PAST the phase named `hold` — during which `sampleHeroMotion` pins
   * az, el and fill to constants, so a gate scoped to it is parked by
   * construction — and INTO `driftEase`'s arrival, which was the thing that
   * never stopped: §10.2 C1 measured the centre netting 0.0 px while width went
   * +4 px and ink +2.9%.
   *
   * Two things have since moved out from under it, and both are visible in the
   * captures on disk rather than argued:
   *
   *   1. `cameraPark: "parked"` folds the orbit's az 30 -> 38 into the rise, so
   *      there is no drift left in the tail to catch. On `turn3` the fixed
   *      window read net 0.00 on every quantity — the row had already gone
   *      vacuous, it just happened to be green.
   *   2. K7 landed. The last 1.33s now straddles `returnTurn`, an AUTHORED
   *      extent change: on `reg-affine` it reads net ink 4.24%, all of it the
   *      mark recovering out of the return's own sliver. The row went red for
   *      doing its job on the wrong frames.
   *
   * A window that reaches back far enough to be non-vacuous now reaches into a
   * designed move, and one that avoids the move is pinned. So the QUANTITY has
   * to change, not the window: measure HOW LONG THE FILM IS STILL FOR at the
   * end, found backwards from the last frame and blind to phase.
   *
   * That is falsifiable in the direction that matters — a film still moving
   * when it ends has a trailing run of one frame — and it cannot be satisfied
   * by a sampler pinning a phase, because it never asks which phase it is in.
   * `--mutate=drift` nudges the final frame and requires this row to go red.
   *
   * The old fixed-window numbers are still computed and printed, labelled as a
   * diagnostic, so nothing is hidden by the change.
   */
  const MIN_HOLD_SEC = 0.3
  const STILL_SEC = 1.33
  if (GATES !== "prior") {
    const tailFrames = manifest.manifest.filter((m) => m.t >= manifest.total - STILL_SEC)
    const tailRows = []
    for (const h of tailFrames) {
      const m = await measure(frameAt(h.i))
      if (m) tailRows.push({ ...toRow(m, h.i), t: h.t, phase: h.phase })
    }
    const rows = mutateRows(tailRows, "drift")
    if (rows.length >= 6) {
      // The trailing run of frames that match the last one. Tolerances are one
      // quantisation step of a half-pixel bbox centre and a tenth of a percent
      // of ink — below that a difference is the antialiaser, not the beat.
      const last = rows[rows.length - 1]
      const same = (r) =>
        Math.abs(r.cx - last.cx) <= 0.5 &&
        Math.abs(r.cy - last.cy) <= 0.5 &&
        Math.abs(r.w - last.w) <= 1 &&
        Math.abs(r.h - last.h) <= 1 &&
        (last.n ? (100 * Math.abs(r.n - last.n)) / last.n : 0) <= 0.1
      let k = rows.length - 1
      while (k > 0 && same(rows[k - 1])) k--
      const run = rows.slice(k)
      const stillSec = run.length > 1 ? last.t - run[0].t : 0
      const lastChange = k > 0 ? rows[k - 1] : null
      const diag = stillnessGate(rows, rows.length)
      record(
        "the beat ARRIVES and STOPS — a real hold at the end, not a run-out clock",
        stillSec >= MIN_HOLD_SEC,
        `still for the last ${run.length} samples = ${stillSec.toFixed(2)}s (needs >= ${MIN_HOLD_SEC}s)` +
          (lastChange
            ? `; the last thing that moves is at t=${lastChange.t.toFixed(2)}s in "${lastChange.phase ?? "?"}"`
            : `; nothing moves anywhere in the last ${STILL_SEC}s`) +
          `\n      [diagnostic, not the verdict] §10.4 amendment 3 over the fixed ${STILL_SEC}s tail: ${diag.detail}`,
      )
    } else {
      record(
        "the beat ARRIVES and STOPS — a real hold at the end, not a run-out clock",
        false,
        `only ${rows.length} measurable frames in the last ${STILL_SEC}s — NOT COVERED, which is not a pass`,
      )
    }
  }

  /* ---- console ---------------------------------------------------------- */
  record(
    "console clean",
    (manifest.errors ?? []).length === 0,
    `${(manifest.errors ?? []).length} errors`,
  )

  /* ══ THE SEVEN CONTROLS, ON THE DEFAULT INVOCATION ════════════════════════
   *
   * ⚠ UNTIL 2026-08-07 EVERY ONE OF THEM WAS BEHIND `--mutate=`, AND NOTHING
   * PASSES IT. `run-browser-battery.mjs` passes no flags by design — *"the bare
   * invocation is the one the next person types"* — so the machinery that
   * proves this instrument can fail had never run in a sweep. Nine green rows
   * above, and not one of them had ever been shown a build it must reject.
   * Explainer 21 §7: *"the gate runs three kinds of control on the DEFAULT
   * invocation, never behind a flag."*
   *
   * THE CONTROL IS THIS GATE, RUN AGAINST A DELIBERATELY BROKEN INPUT. Each is
   * a child `node <this file> --label=<same capture> --mutate=<k>`, so the
   * perturbation, the injection site, the required verdict and the "FAILED TO
   * FAIL" refusal are the code that was already here. Re-implementing the seven
   * inline would have put two implementations of one idea in one file, which is
   * the defect explainer 27 names as this repo's most expensive recurring one —
   * and it would have put it in the one place where a divergence is invisible,
   * because the copy would be the thing certifying the original.
   *
   * The child is handed the label EXPLICITLY so it grades the frames this run
   * just judged and captures nothing. Measured: judging is ~1 s, so seven
   * controls cost ~7 s against a capture that costs a minute.
   *
   * ⚠ THE CHILD'S ROWS ARE NOT ECHOED, AND THAT IS NOT TIDINESS. A control run
   * makes rows go red ON PURPOSE. Both battery runners count rows with
   * `/^\s*(?:\*\*\* )?(?:PASS|FAIL)\b/gm` — and `^\s*` means an INDENTED `FAIL`
   * still counts — so echoing a control child's output would post its required
   * reds to the scoreboard as this gate's failures. Only the child's own
   * one-line verdict is quoted, and it is sanitised before it is printed.
   */
  const CONTROL_WHY = {
    cx: "one frame of the turn displaced 6 px sideways — REGISTRATION must go red",
    cy: "one frame of the turn displaced 6 px vertically — REGISTRATION must go red",
    wash: "a mid-window frame faded toward paper (the cross-dissolve) — the wash row must go red",
    drift: "the last frame nudged, so the beat never stops — ARRIVES and STOPS must go red",
    shading:
      "the `before/` capture's OWN interior luminance distribution poured across the flat frame — gate 1's BOTH rows must go red",
    notch:
      "coverage residue at 80 % of the trim tolerance — gate 1 must STAY GREEN (the one control whose required verdict is a pass)",
    speckle:
      "the same residue at 3x the tolerance — gate 1 must go red, which is what bounds the tolerance",
  }
  /** Never print a line a scoreboard would count. */
  const quiet = (s) =>
    String(s ?? "")
      .split("\n")
      .map((l) => l.replace(/^(\s*)(?:\*\*\* )?(PASS|FAIL)\b/, "$1[$2]"))
      .join("\n")

  if (!MUTATE && GATES === "moment" && !CALIBRATE) {
    console.log(
      `\n--- CONTROLS · ${Object.keys(CONTROL_WHY).length} deliberate defects, each required to reach its own verdict ---`,
    )
    for (const [k, why] of Object.entries(CONTROL_WHY)) {
      /* `shading` reads its distribution off the parked `before/` capture — the
       * lit-tubes-head-on arm gate 1's thresholds were calibrated against. A
       * tree without it cannot run this control, and that is reported as the
       * hole it is rather than passed over: a skip is not a pass. */
      if (k === "shading" && !existsSync(join(dirname(BASE), "before", "manifest.json"))) {
        record(
          `CONTROL · --mutate=shading`,
          false,
          `COULD NOT RUN — its known-bad is the parked "before" capture (lit inflate tubes seen head-on, ` +
            `the defect this whole beat exists to remove) and ${join(dirname(BASE), "before")} is not on disk. ` +
            `This control's reference cannot be re-made from current code; copy the arm in. A skip is not a pass.`,
        )
        continue
      }
      const r = spawnSync("node", [THIS_FILE, `--label=${LABEL}`, `--mutate=${k}`], {
        cwd: ROOT,
        encoding: "utf8",
      })
      const out = `${r.stdout ?? ""}\n${r.stderr ?? ""}`
      const verdict =
        out
          .split("\n")
          .find((l) => l.startsWith("MUTATION CONTROL"))
          ?.trim() ?? `(no verdict line; exit ${r.status})`
      record(
        `CONTROL · --mutate=${k}`,
        r.status === 0,
        `${why}\n      ${quiet(verdict)}` +
          (r.status === 0
            ? ""
            : `\n      exit ${r.status} — the control did not reach its required verdict, so the rows it aims at ` +
              `are green for a reason nobody has demonstrated.` +
              (r.status === 2
                ? ` (exit 2 = the targeted row did not run at all.)`
                : "")),
      )
    }
  } else if (!MUTATE) {
    /* NOT a skip that scores. No row is emitted, because these two invocations
     * are a different SUBJECT, not this one with a judgement withheld:
     * `--gates=prior` grades the parked criteria, whose row NAMES the controls
     * target do not exist, and `--calibrate=skip` forces the no-emerge path on
     * purpose. Neither is an invocation any sweep makes. */
    console.log(
      `\n--- CONTROLS · not run: this is the ${GATES === "prior" ? "--gates=prior parked" : "--calibrate=skip"} arm, ` +
        `a different subject. The seven controls run on the shipped gate set, which is what a sweep types. ---`,
    )
  }

  const failed = results.filter((r) => !r.pass)
  console.log(
    `\n${results.length - failed.length}/${results.length} gates passed on "${LABEL}"`,
  )
  console.log(
    `\nflat beat   mean ${flat.mean.toFixed(1)}  sd ${flat.sd.toFixed(1)}  spread ${(flat.max - flat.min).toFixed(1)}` +
      `\nheld ¾      mean ${solid.mean.toFixed(1)}  sd ${solid.sd.toFixed(1)}  spread ${(solid.max - solid.min).toFixed(1)}`,
  )

  /* ---- the mutation run's verdict is INVERTED ---------------------------- */
  if (MUTATE) {
    const spec = MUTATION_TARGET[MUTATE]
    if (!spec) {
      console.error(
        `\nunknown --mutate=${MUTATE} (${Object.keys(MUTATION_TARGET).join(" | ")})`,
      )
      process.exit(2)
    }
    const { target, expect } = spec
    const rows = target.map((t) => ({ t, row: results.find((r) => r.name.includes(t)) }))
    const absent = rows.filter((x) => !x.row)
    if (absent.length) {
      console.error(
        `\nMUTATION CONTROL --mutate=${MUTATE}: the ${absent.map((x) => `"${x.t}"`).join(" and ")} ` +
          `row(s) did not run at all`,
      )
      process.exit(2)
    }
    const label = target.map((t) => `"${t}"`).join(" and ")
    // WHERE the defect was injected, printed with the verdict either way. A
    // control that silently moves onto a frame the gate does not judge is the
    // failure this line exists to make visible; see `pickTarget`.
    const where =
      PIXEL_NOTE ??
      Object.entries(MUTATED_AT)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" · ")

    /* THE ONE CONTROL WHOSE REQUIRED VERDICT IS A PASS, and it is spelled out
     * because a "must stay green" control is a different kind of claim.
     * `--mutate=notch` injects the coverage artefact gate 1's trim exists to
     * absorb, at 80 % of the tolerance and an order of magnitude past the real
     * one. If it goes red the tolerance does not actually exist and the gate
     * would reject correct drawing again; `--mutate=speckle` is its partner and
     * proves the tolerance is BOUNDED. Neither is worth anything alone. */
    if (expect === "pass") {
      const red = rows.filter((x) => !x.row.pass)
      if (red.length) {
        console.error(
          `\nMUTATION CONTROL --mutate=${MUTATE}: the ${red.map((x) => `"${x.t}"`).join(" and ")} ` +
            `row(s) went RED and they must NOT.\n` +
            `This control injects the artefact the gate is calibrated to absorb (${where}). ` +
            `A red here means the tolerance does not reach the defect it was sized for.`,
        )
        process.exit(1)
      }
      console.log(
        `\nMUTATION CONTROL --mutate=${MUTATE}: the ${label} row(s) STAYED GREEN, as required. ` +
          `The tolerance reaches the artefact. Injected: ${where}. ` +
          `Its partner --mutate=speckle must go RED, or the tolerance is unbounded.`,
      )
      process.exit(0)
    }

    /* EVERY named row must go red, not merely one of them. A control that
     * accepted the first red would have let `--mutate=shading` certify the
     * spread row on the strength of the sd row's failure. */
    const green = rows.filter((x) => x.row.pass)
    if (green.length) {
      console.error(
        `\nMUTATION CONTROL --mutate=${MUTATE}: FAILED TO FAIL.\n` +
          `The ${green.map((x) => `"${x.t}"`).join(" and ")} row(s) stayed green under a deliberate ` +
          `defect injected at ${where || "(nowhere — the scope never ran)"}, so their green means nothing.` +
          (green.length < rows.length
            ? `\n(${rows.length - green.length} of ${rows.length} targeted rows DID go red — a partial ` +
              `control is not a control; the header claims all of them.)`
            : ""),
      )
      process.exit(1)
    }
    console.log(
      `\nMUTATION CONTROL --mutate=${MUTATE}: the ${label} row(s) went RED, as required. ` +
        `The gate can fail. Injected at ${where}.`,
    )
    process.exit(0)
  }

  process.exit(failed.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
