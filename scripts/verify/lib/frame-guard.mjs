// REFUSE THE FRAME, NOT THE WINDOW.
//
// ── THE DEFECT THIS EXISTS FOR ─────────────────────────────────────────────
// Explainer 27 §5. A re-measurement of `dit_pulse` read a rest delta of 5.931,
// which is worse than the number it was checking, and it would have been very
// easy to report that as confirmation. The per-frame deltas said otherwise:
//
//     …  4.40  5.24  8.78  4.03  12.85  ||  65.24  0.00 ×10
//
// `65.241 / 11 = 5.931`, exactly the reported value. THE WHOLE STATISTIC WAS
// ONE FRAME, and that frame was blank paper — 140 KB of PNG became 17.6 KB and
// the mean luminance pinned at 252.171 and never moved again. The mark did not
// vanish; a headed Chrome that was not in front got its rAF throttled by macOS
// until it stopped compositing. A capture recorded nothing and the number that
// came out looked like a signal.
//
// Lane O then measured whether that reproduces, on 28 headed captures, and it
// did not: 3 arms x 8 s and 2 arms x 180 s, headed-vs-headless per-pixel median
// 0.050 against a headless-vs-headless noise floor of 0.065. Its recommendation
// is this file (explainer 37 §6): *"flip nothing wholesale; refuse the frame
// rather than the window — a blank/frozen guard on the capture path fails
// whether or not the throttle reproduces, restages no stored evidence, and
// would have caught the original defect at the time."*
//
// So this is not a fix for a live fire. It is the instrument that would have
// caught the one that already happened, so the next one is not found by
// accident three days later while investigating something else.
//
// ── THE WHOLE DESIGN PROBLEM IS THE FALSE POSITIVE ─────────────────────────
// A guard that reddens on a legitimately blank or legitimately still frame is
// WORSE than no guard, because it gets switched off inside a week and then the
// real one goes through. Three legitimate cases exist in this product today:
//
//   * `Vanish` and `Shrink` END ON A DELIBERATELY BLANK FRAME, and the PRD
//     ships final-frame matching, so that frame is the product.
//   * A draw-in at playhead 0 is legitimately empty.
//   * A held final frame in an export is legitimately identical to the one
//     before it.
//
// Measured on the real stored evidence rather than assumed — the healthy
// `dit_pulse` capture at `docs/verification/screen-layers/qualitypass/`:
//
//   BLANK   2 of 56 frames carry no mark, and both are frames 0-1 of the
//           reveal, which the caller already knows about.
//   FROZEN  19 of 55 pairs are delta EXACTLY 0 — 34.5% — in a capture with
//           nothing wrong with it, because the macro crop stops changing once
//           the pen has passed it and before the completion pulse fires.
//
// Those two base rates are opposite, and they decide the two defaults:
//
//   BLANK  is checked on EVERY frame. Exceptions are declared.
//   FROZEN is checked ONLY on frames the caller has DECLARED must be moving.
//
// A default-on frozen arm would be red on a third of a good run on day one.
// DISPATCH §2.6's companion is Lane F's control — *"a clean gate is NOT
// flagged"* — and a guard cannot satisfy it by guessing which stillness is the
// bad one. It has to be TOLD, and the caller is the only thing that knows:
// `verify-screen-layers.mjs`'s motion table literally declares `reveal: true`
// per cell and the loop computes `completionIndex`.
//
// ── AND BLANK IS RELATIVE TO THE RUN, NOT TO A CONSTANT ────────────────────
// The first version of the blank test was an absolute coverage floor, and the
// real frames killed it before it shipped. Two files that must land on OPPOSITE
// sides of any such floor land 4% apart:
//
//   verify-stack's 22 stored frames   markedFrac 0.016773   a real mark
//   qualitypass g0001 (blank paper)   markedFrac 0.017509   no mark at all
//
// The blank one reads HIGHER, because the stage carries a faint grid and a
// paper-relative ink test sees it — which `verify-screen-layers.mjs:330-333`
// already records for its own bounding box. No constant separates those two.
//
// What separates them is that 27 §5's blank is not "low coverage" in the
// abstract, it is a COLLAPSE: the frame lost the mark that every other frame in
// the same run has. So the test is relative to the run's own established
// coverage, and the absolute floor survives only for the degenerate case where
// nothing establishes a baseline (a fully transparent grab, an all-paper run).
//
// ── ALPHA-AWARE, BECAUSE A WEBGL GRAB HAS NO PAPER BEHIND IT ───────────────
// `toDataURL` on a WebGL canvas returns the drawing buffer, not the page.
// `verify-stack`'s 22 stored frames are 98.3% TRANSPARENT and every one of them
// carries a mark. A luminance-only test reads transparent as black, i.e. as
// heavy ink, and is exactly backwards. This is also where Lane O's first probe
// fooled itself — Δ came back exactly 0.000 in all three arms, including the
// headless control, because there was no mark on the page for the texture to
// animate, and *a control that comes back clean means the instrument is blind*.
//
// This file therefore establishes the frame's GROUND first (transparency or
// paper), measures the paper rather than assuming it, and only then asks what
// is marked.
//
// ── SHAPE, BEFORE ANY FRAME-TO-FRAME COMPARISON ────────────────────────────
// `sameShape()` is Lane M's, ported here with its reasoning rather than
// re-invented (explainer 35 §3, `assert-stroke-schedule.mjs:84-96`). Hand two
// comparison helpers frames of different sizes and NOTHING THROWS: the loop
// runs to the shorter buffer and reads a different pixel at every index past
// the first row, because the row stride changed. M measured 81 comparisons and
// 0 mismatches AFTER finding that a mismatched pair reads one-sided in silence.
// Here a shape mismatch does not answer the frozen question WRONG — it refuses
// to answer it, and says so.
//
// Usage:
//   import { createFrameGuard } from "./lib/frame-guard.mjs"
//   const guard = createFrameGuard({
//     label: "dit_pulse",
//     subject: "the macro crop of the 3D viewport",
//     mayBeBlank: { first: 2, why: "a reveal at playhead 0 is legitimately empty" },
//     mustMove:   { from: 26, why: "the completion pulse is live from here" },
//   })
//   await guard.frame(buf, { index: i, grabInfo })   // throws on refusal
//   const verdict = guard.finish()                   // resolves the deferred tail
//
// Self-test:  node scripts/verify/lib/frame-guard.mjs --selftest
import { createCanvas, loadImage } from "@napi-rs/canvas"
import { readFileSync, existsSync, readdirSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, "..", "..", "..")

/* WHERE THE REAL CONTROL FRAMES LIVE — derived, never spelled.
 *
 * The self-test below runs seven of its arms on frames the REPO supplies rather
 * than on fixtures invented for the test, which means it needs
 * `docs/verification/`. A lane tree is deliberately built WITHOUT that 6.7 GB
 * (explainer 27 §4: *"10 of the 39 model gates read stored evidence, so in a
 * stripped tree they are red on arrival. Not failing — BLIND."*).
 *
 * So the root is derived from this file's own location, and an operator with a
 * stripped tree may point it at a checkout that has the evidence. It is only
 * ever READ. Writing the path down instead would be `assert-one-knob`'s channel
 * F — the defect explainer 37 §1 opened and closed — and the variable is
 * deliberately not named `*URL|PORT|HOST|ORIGIN`, so it cannot trip channel C's
 * knob regex either. Same shape as `_probe-lane-patch.mjs`'s
 * `FS_SHARED_CHECKOUT`, for the same reason. */
const EVIDENCE =
  process.env.FS_EVIDENCE_ROOT && process.env.FS_EVIDENCE_ROOT.trim()
    ? process.env.FS_EVIDENCE_ROOT.trim()
    : join(ROOT, "docs", "verification")

/* ---- the constants, each with the line it came from ---------------------- */

/** Below this the pixel is transparent, not dark. 8/255 is a hair over PNG's
 *  own rounding and well under any deliberate alpha. */
export const ALPHA_FLOOR = 8

/** INK IS PAPER-RELATIVE. 5 on 0..255 is `verify-screen-layers.mjs:167`'s
 *  constant and its reasoning transfers unchanged: just above the renderer's
 *  frame-to-frame noise and comfortably below the faintest real material
 *  contrast measured in this repo. */
export const INK_DELTA = 5

/** A frame whose ground is transparency and which has essentially nothing
 *  opaque on it. `verify-stack`'s real stored frames sit at 0.016773 — 8.4x
 *  this — so the floor has real headroom against the tightest in-tree case. */
export const ABS_MARK_FLOOR = 0.002

/** THE COLLAPSE. Once the run has established what its frames normally cover,
 *  a frame at less than a tenth of that has lost its subject. 27 §5's incident
 *  is a 27x collapse on the numbers measured from the surviving healthy capture
 *  of the same cell (0.4768 -> 0.0175). */
export const COLLAPSE_RATIO = 0.10

/** How many frames must be seen above the absolute floor before the run has a
 *  baseline worth judging against. Frames captured before that are DEFERRED,
 *  never waved through. */
export const BASELINE_FRAMES = 3

/** 27 §5's exact signature, kept as a REPORTED note rather than as the test:
 *  *"mean luminance pins at 252.171 and never moves again."* A refusal that can
 *  say "this is the 2026-08-04 signature exactly" is worth more than one that
 *  says a frame is empty. */
export const INCIDENT_PAPER_LUM = 252.171
export const INCIDENT_LUM_TOL = 2
export const INCIDENT_SD_MAX = 1

/* ---- shape, ported from Lane M ------------------------------------------ */

/**
 * Lane M's guard, `assert-stroke-schedule.mjs:85-96`, ported rather than
 * re-invented (DISPATCH §1.7 — port, don't recreate). Returns false instead of
 * throwing so the caller can REFUSE THE QUESTION rather than answer it wrong.
 */
export function sameShape(a, b) {
  return a.w === b.w && a.h === b.h
}

/* ---- reading a frame ---------------------------------------------------- */

/**
 * Decode one PNG into the numbers this guard reasons about.
 *
 * `ground` is decided BEFORE anything else, because it decides what "marked"
 * even means. A WebGL grab has no paper behind it; a page screenshot does.
 */
export async function readFrame(buf) {
  const img = await loadImage(buf)
  const cv = createCanvas(img.width, img.height)
  const g = cv.getContext("2d")
  g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, img.width, img.height).data
  const n = d.length / 4

  let transparent = 0
  const hist = new Float64Array(256)
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_FLOOR) {
      transparent++
      continue
    }
    hist[
      Math.max(0, Math.min(255, Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])))
    ]++
  }
  const transparentFrac = transparent / n
  const ground = transparentFrac > 0.5 ? "transparent" : "paper"

  /* PAPER IS MEASURED, NEVER ASSUMED — the modal luminance of what is opaque.
   * `verify-screen-layers.mjs:317-325` measures it the same way and for the
   * same reason: the four per-mode default materials do not share a value
   * range, and a fixed cut-off classified an entire Inflate form as background. */
  let paper = 0
  for (let v = 1; v < 256; v++) if (hist[v] > hist[paper]) paper = v

  let marked = 0
  let s = 0
  let s2 = 0
  let seen = 0
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < ALPHA_FLOOR) continue
    const L = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]
    s += L
    s2 += L * L
    seen++
    if (ground === "transparent" || Math.abs(L - paper) > INK_DELTA) marked++
  }
  const mean = seen ? s / seen : 0
  const sd = seen ? Math.sqrt(Math.max(0, s2 / seen - mean * mean)) : 0

  return {
    w: img.width,
    h: img.height,
    bytes: buf.length,
    d,
    ground,
    transparentFrac: +transparentFrac.toFixed(5),
    paper,
    meanLum: +mean.toFixed(3),
    sdLum: +sd.toFixed(3),
    markedFrac: +(marked / n).toFixed(6),
    /* 27 §5's literal signature. A note on the refusal, never the test. */
    atIncidentSignature:
      ground === "paper" &&
      Math.abs(mean - INCIDENT_PAPER_LUM) <= INCIDENT_LUM_TOL &&
      sd < INCIDENT_SD_MAX,
  }
}

/** Byte identity. NOT `delta < eps`: 27 §5's signature is ten consecutive
 *  frames of EXACTLY 0.00, and a threshold is a bar somebody relaxes. */
function identical(a, b) {
  if (a.d.length !== b.d.length) return false
  for (let i = 0; i < a.d.length; i++) if (a.d[i] !== b.d[i]) return false
  return true
}

/** Mean |Δ| over luminance, for the run-level statistic only. */
function meanAbsDiff(a, b) {
  const n = Math.min(a.d.length, b.d.length)
  let s = 0
  let c = 0
  for (let i = 0; i < n; i += 4) {
    const la = 0.2126 * a.d[i] + 0.7152 * a.d[i + 1] + 0.0722 * a.d[i + 2]
    const lb = 0.2126 * b.d[i] + 0.7152 * b.d[i + 1] + 0.0722 * b.d[i + 2]
    s += Math.abs(la - lb)
    c++
  }
  return c ? s / c : 0
}

/* ---- the declaration ----------------------------------------------------- */

/**
 * AN ALLOWANCE CARRIES A WRITTEN REASON OR IT DOES NOT EXIST.
 *
 * `assert-one-knob.mjs`'s channel E requires every ALLOW entry to carry a
 * written reason AND to still actually violate something, and on 2026-08-07
 * three of its four such entries expired on schedule and were caught by exactly
 * that rule (explainer 37 §5). A boolean allowance is a switch; a reasoned one
 * is a claim somebody can check. So `{ first: 1 }` is refused and
 * `{ first: 1, why: "…" }` is not, and the reason is printed in the report.
 */
function compilePolicy(spec, name) {
  if (spec === undefined || spec === null || spec === "never") {
    return { kind: "never", why: null, tail: 0, fired: 0, spec: "never" }
  }
  if (spec === true || spec === false) {
    throw new Error(
      `frame-guard: \`${name}\` may not be a bare boolean. Every allowance carries a written ` +
        `reason — { first: 1, why: "…" } — so it can be audited and can expire. ` +
        `assert-one-knob channel E; explainer 37 §5.`,
    )
  }
  if (typeof spec !== "object") throw new Error(`frame-guard: \`${name}\` must be an object`)
  if (typeof spec.why !== "string" || spec.why.trim().length < 8) {
    throw new Error(
      `frame-guard: \`${name}\` needs a written \`why\` of at least 8 characters. ` +
        `An allowance nobody had to justify is an allowance nobody can retire.`,
    )
  }
  const keys = ["first", "last", "frames", "from", "when", "all"].filter((k) => k in spec)
  if (keys.length !== 1) {
    throw new Error(
      `frame-guard: \`${name}\` must carry exactly one of first / last / frames / from / when / all ` +
        `(got ${keys.length ? keys.join("+") : "none"})`,
    )
  }
  const kind = keys[0]
  return {
    kind,
    why: spec.why,
    n: spec[kind],
    /* `last` is the ONE shape that cannot be judged at write time: a streaming
     * capture does not know which frame is last until it stops. Those frames are
     * held and resolved in finish(). Named here so the deferral is a property of
     * the policy, not a surprise. */
    tail: kind === "last" ? spec.last : 0,
    fired: 0,
    spec: JSON.stringify(spec),
  }
}

function policyHits(policy, index, total) {
  switch (policy.kind) {
    case "never":
      return false
    case "all":
      return true
    case "first":
      return index < policy.n
    case "from":
      return index >= policy.n
    case "frames":
      return policy.n.includes(index)
    case "when":
      return !!policy.n(index, total)
    case "last":
      return total !== null && index >= total - policy.n
    default:
      return false
  }
}

/* ---- the guard ----------------------------------------------------------- */

export class FrameRefused extends Error {
  constructor(verdict) {
    super(verdict.message)
    this.name = "FrameRefused"
    this.verdict = verdict
  }
}

/**
 * @param {object} o
 * @param {string} o.label      what this run is called, printed on refusal
 * @param {string} [o.subject]  what is being photographed, in words
 * @param {object|string} [o.mayBeBlank]  frames that are ALLOWED to carry no mark
 * @param {object|string} [o.mustMove]    frames that MUST differ from their predecessor
 * @param {number} [o.maxDeltaShare]      refuse if one Δ carries more than this share of the run
 * @param {number} [o.maxStillRun=2]      how many CONSECUTIVE identical pairs a declared-moving
 *                                        stretch may contain before it is a stall. Default 2 (so a
 *                                        run of three identical frames is refused): measured 0
 *                                        identical pairs across two full clean runs of all eight
 *                                        non-reveal cells, one isolated repeat on `dit_sweep`
 *                                        whose quantised threshold map legitimately produces them,
 *                                        and 27 §5's real signature is TEN in a row.
 * @param {boolean} [o.throwOnRefusal=true]
 */
export function createFrameGuard({
  label,
  subject = "unnamed",
  mayBeBlank,
  mustMove,
  maxDeltaShare = null,
  maxStillRun = 2,
  throwOnRefusal = true,
} = {}) {
  if (!label) throw new Error("frame-guard: `label` is required — a refusal has to name its run")

  const blankPolicy = compilePolicy(mayBeBlank, "mayBeBlank")
  const movePolicy = compilePolicy(mustMove, "mustMove")

  const frames = [] // { index, stats, deferred }
  const refusals = []
  const notes = []
  const deltas = []
  const grabs = { n: 0, sizes: {}, wrongSubject: 0, multiCanvas: 0, last: null }
  const shapeGuard = { comparisons: 0, mismatches: [] }
  let prev = null
  let baseline = null // median markedFrac once established
  let finished = false

  const describe = (s) =>
    `${s.w}x${s.h} ${s.bytes}B ground=${s.ground} paper=${s.paper} ` +
    `meanLum=${s.meanLum} sd=${s.sdLum} marked=${(s.markedFrac * 100).toFixed(3)}%` +
    (s.atIncidentSignature ? " ⚠ AT THE 2026-08-04 BLANK SIGNATURE (252.171, sd<1)" : "")

  /* 🔴 THE FIRST VERSION OF THIS TOOK THE MEDIAN OF EVERY FRAME, AND THE REAL
   * FRAMES CAUGHT IT BEFORE IT SHIPPED.
   *
   * On the real `qualitypass` capture the first two frames are the reveal at
   * playhead 0 — blank, coverage 0.0175 — and the other fifty-four carry the
   * mark at 0.29-0.48. A plain median over the first three frames latched the
   * baseline at **0.017509**, i.e. AT THE BLANK, and from then on nothing could
   * ever read as a collapse. Every one of the three arms that failed failed for
   * that one reason: the estimator was contaminated by exactly the frames it
   * exists to judge.
   *
   * So it is a ROBUST estimate of "what a frame that HAS the subject covers":
   * the median of the frames within 4x of the best frame seen. A blank
   * contributes nothing to it because a blank is nowhere near the best frame.
   *
   * THE BOUNDARY, STATED RATHER THAN PAPERED OVER: this catches a frame that
   * LOST the mark. It cannot catch a run that NEVER HAD one — there, the blanks
   * are the baseline and there is nothing to collapse from. That case is
   * `reframe()`'s, and `verify-screen-layers.mjs:394-395` already refuses it by
   * two independent tests (`macro crop is off the form`, `macro crop is a flat
   * field`). Lane O's first probe is what that failure looks like when nobody
   * checks: Δ exactly 0.000 in all three arms INCLUDING the headless control,
   * because there was no mark on the page for the texture to animate. */
  function establishBaseline() {
    const cov = frames.map((f) => f.stats.markedFrac).filter((m) => m >= ABS_MARK_FLOOR)
    if (cov.length < BASELINE_FRAMES) return false
    const best = Math.max(...cov)
    const carrying = cov.filter((m) => m >= best / 4)
    const sorted = [...carrying].sort((a, b) => a - b)
    baseline = sorted[Math.floor(sorted.length / 2)]
    return true
  }

  const blankMatched = new Set()
  const moveMatched = new Set()

  function judgeBlank(rec, total) {
    const s = rec.stats
    if (policyHits(blankPolicy, rec.index, total)) {
      blankMatched.add(rec.index)
      return null
    }
    if (s.markedFrac < ABS_MARK_FLOOR) {
      return {
        kind: "BLANK",
        index: rec.index,
        message:
          `[${label}] frame ${rec.index} carries NO MARK — ${describe(s)}. ` +
          `Nothing opaque and off-ground is on it, against an absolute floor of ` +
          `${ABS_MARK_FLOOR}. Subject: ${subject}.`,
        stats: s,
      }
    }
    if (baseline !== null && s.markedFrac < baseline * COLLAPSE_RATIO) {
      return {
        kind: "BLANK",
        index: rec.index,
        message:
          `[${label}] frame ${rec.index} LOST ITS MARK — coverage ${(s.markedFrac * 100).toFixed(3)}% ` +
          `against this run's own ${(baseline * 100).toFixed(3)}% ` +
          `(a ${(baseline / s.markedFrac).toFixed(1)}x collapse, bar is ${1 / COLLAPSE_RATIO}x). ` +
          `${describe(s)}. Subject: ${subject}.`,
        stats: s,
      }
    }
    return null
  }

  const shapeSeen = new Set()

  function judgeFrozen(rec, total) {
    if (!rec.prevStats) return null
    if (!policyHits(movePolicy, rec.index, total)) return null
    moveMatched.add(rec.index)
    if (!shapeSeen.has(rec.index)) {
      shapeSeen.add(rec.index)
      shapeGuard.comparisons++
      if (!sameShape(rec.prevStats, rec.stats)) {
        const m = `${rec.prevStats.w}x${rec.prevStats.h} vs ${rec.stats.w}x${rec.stats.h} at frame ${rec.index}`
        shapeGuard.mismatches.push(m)
        notes.push(
          `frame ${rec.index}: the FROZEN question was REFUSED, not answered — the two frames are ` +
            `different rasters (${m}). Comparing across that reads one-sided in silence ` +
            `(explainer 35 §3).`,
        )
      }
    }
    if (!sameShape(rec.prevStats, rec.stats)) return null
    /* 🔴 ONE REPEATED FRAME IS NOT A STALL, AND THE REAL TOOL PROVED IT.
     *
     * The first version refused any byte-identical pair inside a declared-motion
     * region. It went red on `dit_sweep` frame 30 — a frame carrying 45.4% ink
     * coverage at sigma 113, i.e. a perfectly good picture — because Threshold
     * Sweep moves a tone bias on a 4.8 s period through a QUANTISED threshold
     * map, so two consecutive frames can land in the same bucket and come back
     * byte for byte the same. That is the repo's own finding one level up
     * (research/ascii-glyph-resolution-and-temporal-stability.md: *"animating a
     * quantised index instead of the value that gets quantised"*), and my own
     * two clean runs measuring 0 of 55 identical pairs on every non-reveal cell
     * were a SAMPLE, not a proof.
     *
     * 27 §5's signature was never one repeat. It was *"ten consecutive frames of
     * exactly 0.00"* that *"never moves again"* — a compositor that stopped, not
     * a quantiser that repeated. So the predicate is the RUN. */
    if (rec.stillRun > maxStillRun) {
      {
        return {
          kind: "FROZEN",
          index: rec.index,
          message:
            `[${label}] frames ${rec.index - rec.stillRun}..${rec.index} are BYTE-IDENTICAL — a run of ` +
            `${rec.stillRun + 1} frames that do not move, where this run DECLARED motion ` +
            `("${movePolicy.why}"), against a bar of ${maxStillRun + 1}. ` +
            `A stopped animation and a still one are the same picture; that is the SwiftShader / ` +
            `throttled-rAF failure and it has no error message. ${describe(rec.stats)}.`,
          stats: rec.stats,
        }
      }
    }
    return null
  }

  function commit(v) {
    if (!v) return
    refusals.push(v)
    if (throwOnRefusal) throw new FrameRefused(v)
  }

  return {
    /**
     * Judge one frame. Throws `FrameRefused` unless `throwOnRefusal: false`.
     * @param {Buffer} buf   the PNG bytes about to be written
     * @param {object} meta  { index, grabInfo }
     */
    async frame(buf, { index = frames.length, grabInfo = null } = {}) {
      if (finished) throw new Error(`frame-guard[${label}]: frame() after finish()`)
      const stats = await readFrame(buf)

      if (grabInfo) {
        grabs.n++
        const key = `${grabInfo.width}x${grabInfo.height}`
        grabs.sizes[key] = (grabs.sizes[key] ?? 0) + 1
        grabs.last = grabInfo
        if (grabInfo.firstUnderContainer === false) grabs.wrongSubject++
        if (grabInfo.canvasesUnderContainer > 1) grabs.multiCanvas++
      }

      const same = prev ? identical(prev, stats) : false
      const rec = {
        index,
        stats,
        prevStats: prev,
        identicalToPrev: same,
        /* HOW LONG THIS STILLNESS HAS BEEN GOING ON. Computed once, at write
         * time, when the frames are known to arrive in order — never in
         * `judgeFrozen`, which runs twice on every frame (once at write, once at
         * finish against the run's final baseline) and would double-count. */
        stillRun: same ? (frames.at(-1)?.stillRun ?? 0) + 1 : 0,
        deferred: false,
      }
      if (prev && sameShape(prev, stats)) deltas.push(meanAbsDiff(prev, stats))
      frames.push(rec)
      prev = stats

      /* TWO REASONS A VERDICT CANNOT BE TAKEN YET, and neither of them is
       * "wave it through": the run has not established what its frames normally
       * cover, or a `last`-shaped allowance means nobody knows yet whether this
       * frame is in the tail. Both are held and resolved in finish(). */
      const noBaselineYet = baseline === null && !establishBaseline()
      const tailUnknowable = blankPolicy.tail > 0 || movePolicy.tail > 0
      if (noBaselineYet || tailUnknowable) {
        rec.deferred = true
        return { deferred: true, stats }
      }

      commit(judgeBlank(rec, null))
      commit(judgeFrozen(rec, null))
      return { deferred: false, stats }
    },

    /** Resolve every deferred frame, then report. */
    finish() {
      if (finished) return this.report
      finished = true
      const total = frames.length
      /* THE FINAL BASELINE IS THE WHOLE RUN'S, and every frame is re-judged
       * against it — not only the deferred ones. A frame cleared at write time
       * against a baseline built from three frames is a frame judged against a
       * guess; the run's own evidence is better and it exists by now. Frames
       * already refused are not counted twice. */
      establishBaseline()
      const already = new Set(refusals.map((r) => `${r.kind}@${r.index}`))
      for (const rec of frames) {
        const b = judgeBlank(rec, total)
        if (b && !already.has(`BLANK@${b.index}`)) {
          refusals.push(b)
          already.add(`BLANK@${b.index}`)
          continue
        }
        const f = judgeFrozen(rec, total)
        if (f && !already.has(`FROZEN@${f.index}`)) {
          refusals.push(f)
          already.add(`FROZEN@${f.index}`)
        }
      }
      refusals.sort((a, b) => a.index - b.index)

      /* LANE O'S OWN BLIND PROBE, AS A ROW. *"Δ was exactly 0.000 on every frame
       * of all three arms, INCLUDING headless, because there was no mark on the
       * page… A control that comes back clean means the instrument is blind, and
       * this one was."* A run in which no frame has any structure at all is that.
       * 1.5 is `verify-screen-layers.mjs:395`'s own already-calibrated constant
       * for "the crop is a flat field". */
      if (frames.length >= BASELINE_FRAMES && frames.every((f) => f.stats.sdLum < 1.5)) {
        refusals.push({
          kind: "FLAT-RUN",
          index: 0,
          message:
            `[${label}] EVERY ONE of this run's ${frames.length} frames is a flat field ` +
            `(max σ ${Math.max(...frames.map((f) => f.stats.sdLum)).toFixed(3)} < 1.5). ` +
            `There is no subject here — whatever this run measured, it did not measure ${subject}.`,
          stats: null,
        })
      }

      /* LANE O'S SECOND SIGNATURE — *"a run whose motion statistic is carried by
       * one Δ"*. 27 §5's blank frame carried 1.000 of its run's total; the
       * healthy capture of the same cell carries 0.117. Reported always; a bar
       * only if the caller set one. */
      const total_ = deltas.reduce((a, b) => a + b, 0)
      const maxD = deltas.length ? Math.max(...deltas) : 0
      const share = total_ > 0 ? maxD / total_ : 0
      if (maxDeltaShare !== null && deltas.length >= 4 && share > maxDeltaShare) {
        refusals.push({
          kind: "ONE-DELTA-RUN",
          index: deltas.indexOf(maxD) + 1,
          message:
            `[${label}] one Δ carries ${(share * 100).toFixed(1)}% of this run's motion ` +
            `(${maxD.toFixed(3)} of ${total_.toFixed(3)} across ${deltas.length} pairs, bar ` +
            `${(maxDeltaShare * 100).toFixed(0)}%). That is 27 §5's shape: a mean over a window ` +
            `containing one step cannot distinguish a step from continuous motion.`,
          stats: null,
        })
      }

      /* THE GRAB'S SUBJECT, WHICH THIS FILE HAS BEEN COLLECTING AND NOT JUDGING.
       *
       * `grabs` has been written on every frame since it was added, published in
       * the report, and read by NOTHING — grepped 2026-08-28, zero consumers in
       * `scripts/verify/`. So a run whose frames changed size mid-capture still
       * came back `ok`, because `ok` is `refusals.length === 0` and nothing here
       * ever pushed one. A check that blocks nothing is a comment.
       *
       * The incident it was built from, explainer 35: SEVEN frames of 360, on one
       * take of three, came back 1584x1468 instead of 799x1468 — f113 through
       * f119 — with no page error, no GL warning, no exception and no red row. It
       * was found by somebody diffing a directory nobody diffs. Re-measured
       * 2026-08-28 across all 120 frames of that take: 113 at 799 wide, 7 at 1584.
       *
       * Two kinds, because they are two different lies. A SIZE change means the
       * frames are not comparable to each other, so every statistic above this
       * line was computed across two populations. A WRONG SUBJECT means the grab
       * resolved to a canvas that is not the one under test at all — explainer
       * 43's family, an instrument whose subject differs from its claim. */
      if (grabs.n > 0) {
        const sizeKeys = Object.keys(grabs.sizes)
        if (sizeKeys.length > 1) {
          const census = sizeKeys
            .sort((a, b) => grabs.sizes[b] - grabs.sizes[a])
            .map((k) => `${k}x${grabs.sizes[k]}`)
            .join(" ")
          refusals.push({
            kind: "GRAB-SIZE-CHANGED",
            index: 0,
            message:
              `[${label}] the capture changed size mid-run: ${census} across ${grabs.n} grabs. ` +
              `Frames of two different sizes are not comparable, so every statistic in this ` +
              `report was computed over two populations. This is explainer 35's incident ` +
              `(7 of 360 frames at 1584x1468 instead of 799x1468), which reached disk with no ` +
              `page error, no GL warning and no red row.`,
            stats: null,
          })
        }
        if (grabs.wrongSubject > 0) {
          refusals.push({
            kind: "GRAB-WRONG-SUBJECT",
            index: 0,
            message:
              `[${label}] ${grabs.wrongSubject} of ${grabs.n} grabs did not resolve to the ` +
              `canvas under test (\`firstUnderContainer: false\`). Whatever these frames show, ` +
              `it is not ${subject}. An instrument whose SUBJECT differs from its CLAIM does ` +
              `not throw — it returns a well-formed answer to a question nobody asked.`,
            stats: null,
          })
        }
      }

      blankPolicy.fired = blankMatched.size
      movePolicy.fired = moveMatched.size
      for (const [name, p] of [["mayBeBlank", blankPolicy], ["mustMove", movePolicy]]) {
        if (p.kind !== "never" && p.fired === 0) {
          notes.push(
            `\`${name}\` (${p.spec} — "${p.why}") never matched a frame in this run. ` +
              `Not a failure — but an allowance that stops applying is an allowance to delete ` +
              `(assert-one-knob channel E).`,
          )
        }
      }

      this.report = {
        label,
        subject,
        frames: total,
        refusals,
        notes,
        baselineMarkedFrac: baseline,
        blankPolicy: { spec: blankPolicy.spec, why: blankPolicy.why, matched: blankPolicy.fired },
        movePolicy: { spec: movePolicy.spec, why: movePolicy.why, matched: movePolicy.fired },
        deltas: deltas.map((d) => +d.toFixed(3)),
        maxDeltaShare: +share.toFixed(4),
        frozenPairs: frames.filter((f) => f.identicalToPrev).length,
        longestStillRun: frames.reduce((m, f) => Math.max(m, f.stillRun), 0),
        maxStillRun,
        blankFrames: frames.filter((f) => f.stats.markedFrac < ABS_MARK_FLOOR).length,
        atIncidentSignature: frames.filter((f) => f.stats.atIncidentSignature).length,
        rasterGuard: { ...shapeGuard },
        grabs,
        ok: refusals.length === 0,
      }
      return this.report
    },

    get refusals() {
      return refusals
    },
  }
}

/* ========================================================================== */
/* SELF-TEST — every rule with a MUST-FIRE and a MUST-NOT-FIRE arm.           */
/*                                                                            */
/* DISPATCH §2.6: *"Calibrate the instrument against a known-bad input and    */
/* require it to fail. Ten instruments in this repo have reported green while */
/* measuring nothing. A green row that cannot fail is the lie."* And its      */
/* other half, which is the harder one here: Lane F's control — *"a clean     */
/* gate is NOT flagged."*                                                     */
/*                                                                            */
/* SEVEN of the arms below run on REAL FRAMES supplied by the repo, not on    */
/* fixtures invented for the test.                                            */
/* ========================================================================== */

/**
 * A blank frame whose MEAN luminance is `lum`.
 *
 * 27 §5's 252.171 is a mean over a frame, not a pixel value — an 8-bit channel
 * cannot hold it — so the reconstruction dithers two adjacent integer levels in
 * the exact proportion that lands the mean on the number in the explainer.
 * Building it as `round(252.171)` would be a frame at 252, which is a different
 * (and easier) input than the one that actually happened.
 */
function synth({ w = 182, h = 150, lum = 252.171, alpha = 255 }) {
  const cv = createCanvas(w, h)
  const g = cv.getContext("2d")
  const img = g.createImageData(w, h)
  const lo = Math.floor(lum)
  const frac = lum - lo
  const n = w * h
  const hiCount = Math.round(frac * n)
  /* Deterministic interleave, so the frame is reproducible and its σ is the
   * smallest a two-level frame at this mean can have. */
  for (let i = 0; i < n; i++) {
    const v = alpha === 0 ? 0 : (i * hiCount) % n < hiCount ? lo + 1 : lo
    img.data[i * 4] = v
    img.data[i * 4 + 1] = v
    img.data[i * 4 + 2] = v
    img.data[i * 4 + 3] = alpha
  }
  g.putImageData(img, 0, 0)
  return cv.toBuffer("image/png")
}

/** A synthetic frame that plainly carries a mark: a dark bar over paper. */
function synthMarked({ w = 182, h = 150, phase = 0 }) {
  const cv = createCanvas(w, h)
  const g = cv.getContext("2d")
  g.fillStyle = "#f9f9f9"
  g.fillRect(0, 0, w, h)
  g.fillStyle = "#151515"
  g.fillRect(10 + phase, 10, w - 20, h - 20 - phase)
  return cv.toBuffer("image/png")
}

async function selftest() {
  const rows = []
  const ok = (name, cond, detail) => rows.push({ name, pass: !!cond, detail })

  /* -- REAL in-tree controls, located rather than invented ----------------- */
  const stackDir = join(EVIDENCE, "stack-v1")
  const qpVideo = join(EVIDENCE, "screen-layers", "qualitypass", "video", "dit_pulse_macro.mp4")
  const missing = (what) =>
    `NOT RUN — ${what} is absent. A lane tree is built without docs/verification/ ` +
    `(explainer 27 §4). Point FS_EVIDENCE_ROOT at a checkout that has it, or run this in one. ` +
    `Looked in: ${EVIDENCE}`

  /* 1 · MUST FIRE — the reconstructed 2026-08-04 incident. --------------- */
  {
    const g = createFrameGuard({ label: "known-bad/incident", throwOnRefusal: false })
    for (let i = 0; i < 6; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    const blank = synth({ lum: INCIDENT_PAPER_LUM, jitter: 0 })
    const r = await g.frame(blank, { index: 6 })
    const rep = g.finish()
    const fired = rep.refusals.find((x) => x.kind === "BLANK" && x.index === 6)
    ok(
      "MUST FIRE · a frame at the incident's 252.171 blank paper, after real frames, is REFUSED",
      !!fired,
      fired ? fired.message.slice(0, 150) : `no refusal — ${JSON.stringify(r.stats)}`,
    )
    ok(
      "…and the refusal NAMES the 2026-08-04 signature (252.171, sd<1)",
      rep.atIncidentSignature === 1,
      `atIncidentSignature=${rep.atIncidentSignature}`,
    )
  }

  /* 1b · MUST FIRE — the capture changes size mid-run. explainer 35's incident,
   * reconstructed at its measured proportions: 7 frames of a different width
   * arriving inside an otherwise healthy take. Before 2026-08-28 this returned
   * ok:true, because `grabs` was collected and never judged. ------------------ */
  {
    const g = createFrameGuard({ label: "known-bad/grab-size", throwOnRefusal: false })
    const gi = (w) => ({ width: w, height: 1468, cssWidth: w, cssHeight: 1468,
      canvasesUnderContainer: 1, canvasesInDocument: 1, firstUnderContainer: true })
    for (let i = 0; i < 8; i++) await g.frame(synthMarked({ phase: i }), { index: i, grabInfo: gi(799) })
    for (let i = 8; i < 11; i++) await g.frame(synthMarked({ phase: i }), { index: i, grabInfo: gi(1584) })
    const rep = g.finish()
    ok(
      "MUST FIRE · a capture that changes size mid-run is REFUSED (explainer 35, 7 of 360)",
      rep.refusals.some((x) => x.kind === "GRAB-SIZE-CHANGED"),
      JSON.stringify(rep.refusals.map((r) => r.kind)) + ` sizes=${JSON.stringify(rep.grabs.sizes)}`,
    )
    ok(
      "…and the report is NOT ok, which is the whole point — it used to be",
      rep.ok === false,
      `ok=${rep.ok}`,
    )
  }

  /* 1c · MUST FIRE — every grab the same size, but resolved to the WRONG canvas.
   * Separate arm because it is a separate lie: comparable frames, wrong subject. */
  {
    const g = createFrameGuard({ label: "known-bad/grab-subject", throwOnRefusal: false })
    const gi = (first) => ({ width: 799, height: 1468, cssWidth: 799, cssHeight: 1468,
      canvasesUnderContainer: 2, canvasesInDocument: 2, firstUnderContainer: first })
    for (let i = 0; i < 6; i++) await g.frame(synthMarked({ phase: i }), { index: i, grabInfo: gi(false) })
    const rep = g.finish()
    ok(
      "MUST FIRE · grabs that did not resolve to the canvas under test are REFUSED",
      rep.refusals.some((x) => x.kind === "GRAB-WRONG-SUBJECT"),
      JSON.stringify(rep.refusals.map((r) => r.kind)) + ` wrongSubject=${rep.grabs.wrongSubject}`,
    )
  }

  /* 1d · MUST NOT FIRE — the POSITIVE CONTROL. A healthy take: every grab the
   * same size, every one on the right canvas. Without this arm the two above
   * would pass on an instrument that refuses everything. ---------------------- */
  {
    const g = createFrameGuard({ label: "control/grab-clean", throwOnRefusal: false })
    const gi = { width: 799, height: 1468, cssWidth: 799, cssHeight: 1468,
      canvasesUnderContainer: 1, canvasesInDocument: 1, firstUnderContainer: true }
    for (let i = 0; i < 10; i++) await g.frame(synthMarked({ phase: i }), { index: i, grabInfo: gi })
    const rep = g.finish()
    ok(
      "MUST NOT FIRE · a take at one size on the right canvas raises NO grab refusal",
      !rep.refusals.some((x) => x.kind.startsWith("GRAB-")),
      JSON.stringify(rep.refusals.map((r) => r.kind)),
    )
  }

  /* 2 · MUST FIRE — a fully transparent WebGL grab (the empty drawing buffer) */
  {
    const g = createFrameGuard({ label: "known-bad/empty-gl", throwOnRefusal: false })
    for (let i = 0; i < 5; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    await g.frame(synth({ alpha: 0, lum: 0 }), { index: 5 })
    const rep = g.finish()
    ok(
      "MUST FIRE · a fully TRANSPARENT grab is REFUSED (a luminance-only test reads it as ink)",
      rep.refusals.some((x) => x.kind === "BLANK" && x.index === 5),
      JSON.stringify(rep.refusals.map((r) => `${r.kind}@${r.index}`)),
    )
  }

  /* 3 · MUST FIRE — a declared-moving stretch that STOPS. ------------------ */
  {
    const g = createFrameGuard({
      label: "known-bad/frozen",
      mustMove: { from: 3, why: "the texture animation is running from frame 3" },
      throwOnRefusal: false,
    })
    for (let i = 0; i < 4; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    for (let i = 4; i < 8; i++) await g.frame(synthMarked({ phase: 3 }), { index: i })
    const rep = g.finish()
    ok(
      "MUST FIRE · a RUN of byte-identical frames where the caller DECLARED motion is REFUSED",
      rep.refusals.some((x) => x.kind === "FROZEN"),
      rep.refusals.length ? rep.refusals.find((x) => x.kind === "FROZEN").message.replace(/\s+/g, " ").slice(0, 150) : "NOT REFUSED",
    )
  }

  /* 3b · MUST NOT FIRE — ONE isolated repeat, which a quantiser really does. */
  {
    const g = createFrameGuard({
      label: "legit/one-repeat",
      mustMove: { all: true, why: "an animated preset on a finished form" },
      throwOnRefusal: false,
    })
    for (let i = 0; i < 4; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    await g.frame(synthMarked({ phase: 3 }), { index: 4 }) // ONE repeat
    for (let i = 5; i < 9; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    const rep = g.finish()
    ok(
      "MUST NOT FIRE · ONE isolated repeated frame under declared motion — `dit_sweep`'s quantised threshold map really does this, measured on the real tool at frame 30 with 45.4% ink on it",
      rep.ok,
      `refusals=${rep.refusals.length} longestStillRun=${rep.longestStillRun}`,
    )
  }

  /* 4 · MUST NOT FIRE — Vanish/Shrink's deliberate final blank. ------------ */
  {
    const g = createFrameGuard({
      label: "legit/vanish-tail",
      mayBeBlank: { last: 1, why: "Vanish and Shrink END on a blank frame and the PRD ships final-frame matching" },
      throwOnRefusal: false,
    })
    for (let i = 0; i < 6; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    await g.frame(synth({ lum: 249, jitter: 0 }), { index: 6 })
    const rep = g.finish()
    ok(
      "MUST NOT FIRE · Vanish's deliberately blank FINAL frame, declared, is not flagged",
      rep.ok && rep.blankPolicy.matched === 1,
      `refusals=${rep.refusals.length} matched=${rep.blankPolicy.matched}`,
    )
  }

  /* 5 · MUST NOT FIRE — a held final frame in an export. ------------------- */
  {
    const g = createFrameGuard({ label: "legit/held-final", throwOnRefusal: false })
    for (let i = 0; i < 5; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    await g.frame(synthMarked({ phase: 4 }), { index: 5 }) // identical hold
    await g.frame(synthMarked({ phase: 4 }), { index: 6 })
    const rep = g.finish()
    ok(
      "MUST NOT FIRE · a HELD final frame identical to its predecessor, with no motion declared",
      rep.ok && rep.frozenPairs === 2,
      `refusals=${rep.refusals.length} frozenPairs=${rep.frozenPairs}`,
    )
  }

  /* 6 · MUST NOT FIRE — verify-stack's 22 REAL 98.3%-transparent frames. --- */
  if (existsSync(stackDir)) {
    const files = readdirSync(stackDir).filter((f) => f.endsWith(".png")).sort()
    const g = createFrameGuard({ label: "legit/verify-stack", throwOnRefusal: false })
    let minMark = 1
    for (let i = 0; i < files.length; i++) {
      const r = await g.frame(readFileSync(join(stackDir, files[i])), { index: i })
      minMark = Math.min(minMark, r.stats.markedFrac)
    }
    const rep = g.finish()
    ok(
      `MUST NOT FIRE · verify-stack's ${files.length} REAL stored frames — 98.3% transparent, every one carrying a mark`,
      rep.ok && files.length === 22,
      `refusals=${rep.refusals.length} minMarkedFrac=${minMark} (floor ${ABS_MARK_FLOOR}, ${(minMark / ABS_MARK_FLOOR).toFixed(1)}x headroom)`,
    )
  } else {
    ok("MUST NOT FIRE · verify-stack's real stored frames", false, missing("docs/verification/stack-v1"))
  }

  /* 7 · MUST NOT FIRE — the REAL healthy dit_pulse capture, end to end. ---- */
  if (existsSync(qpVideo)) {
    const { execFileSync } = await import("node:child_process")
    const { mkdtempSync, rmSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const ff = (await import("ffmpeg-static")).default
    const dir = mkdtempSync(join(tmpdir(), "fg-"))
    execFileSync(ff, ["-y", "-i", qpVideo, join(dir, "g%04d.png")], { stdio: "ignore" })
    const files = readdirSync(dir).filter((f) => f.endsWith(".png")).sort()
    const bufs = files.map((f) => readFileSync(join(dir, f)))
    rmSync(dir, { recursive: true, force: true })

    const g = createFrameGuard({
      label: "legit/qualitypass-dit_pulse",
      subject: "the macro crop, from the shipped healthy capture",
      mayBeBlank: { first: 2, why: "this cell replays the draw-in, and a reveal at playhead 0 is legitimately empty" },
      throwOnRefusal: false,
    })
    for (let i = 0; i < bufs.length; i++) await g.frame(bufs[i], { index: i })
    const rep = g.finish()
    ok(
      `MUST NOT FIRE · the REAL shipped dit_pulse capture (${bufs.length} frames), nothing wrong with it`,
      rep.ok,
      `refusals=${rep.refusals.length} frozenPairs=${rep.frozenPairs}/${bufs.length - 1} ` +
        `blankFrames=${rep.blankFrames} baseline=${rep.baselineMarkedFrac} maxDeltaShare=${rep.maxDeltaShare}`,
    )
    /* THE NUMBER THE FROZEN DEFAULT IS BUILT ON — read off the tool's OWN
     * stored report, not off this mp4.
     *
     * ⚠ AN mp4 IS THE WRONG PLACE TO ASK WHETHER TWO FRAMES ARE IDENTICAL. H.264
     * re-encodes, so pairs that were delta EXACTLY 0.000 in the capture come back
     * differing by a few LSBs: this same clip reads 1 byte-identical pair out of
     * 55 while the report it was rendered from records 19. Measured, and worth
     * keeping: a later lane "verifying" frozen-ness off a video would read the
     * codec, not the capture. */
    const rj = join(EVIDENCE, "screen-layers", "qualitypass", "motion-report.json")
    if (existsSync(rj)) {
      const row = JSON.parse(readFileSync(rj, "utf8")).find((r) => r.cell === "dit_pulse")
      const zeros = row.deltas.filter((d) => d === 0).length
      ok(
        "…and that same healthy capture carries a LOT of legitimate stillness — which is WHY frozen is opt-in",
        zeros >= 10,
        `${zeros} of ${row.deltas.length} pairs are Δ EXACTLY 0 in a capture with nothing wrong with it ` +
          `(${((zeros / row.deltas.length) * 100).toFixed(1)}%, from its own motion-report.json) — ` +
          `a default-on frozen arm would be red on a third of a good run on day one. ` +
          `(The re-encoded mp4 of the same clip reads only ${rep.frozenPairs}/${bufs.length - 1} byte-identical: a codec is not a capture.)`,
      )
    } else {
      ok("…and that same healthy capture carries a LOT of legitimate stillness", false, missing("screen-layers/qualitypass/motion-report.json"))
    }
    /* THE SAME REAL FRAMES, UNDECLARED, MUST REDDEN — otherwise the allowance
     * is decorative and this whole arm proves nothing. */
    const g2 = createFrameGuard({ label: "control/qualitypass-undeclared", throwOnRefusal: false })
    for (let i = 0; i < bufs.length; i++) await g2.frame(bufs[i], { index: i })
    const rep2 = g2.finish()
    ok(
      "CONTROL · the SAME real capture WITHOUT the reveal-at-0 declaration is REFUSED",
      rep2.refusals.some((x) => x.kind === "BLANK" && x.index < 2),
      `refusals=${JSON.stringify(rep2.refusals.map((r) => `${r.kind}@${r.index}`))}`,
    )
    /* AND THE INCIDENT, DROPPED INTO THE REAL RUN. A frame the real tool really
     * wrote, replaced by a blank one the real tool really wrote, which is what
     * the compositor stall did — same capture, same crop, one frame that lost
     * its mark. Not a synthetic PNG standing in for it. */
    const g3 = createFrameGuard({
      label: "known-bad/incident-in-the-real-run",
      mayBeBlank: { first: 2, why: "the reveal at playhead 0 is legitimately empty" },
      throwOnRefusal: false,
    })
    for (let i = 0; i < bufs.length; i++) {
      await g3.frame(i === 30 ? bufs[0] : bufs[i], { index: i })
    }
    const rep3 = g3.finish()
    ok(
      "MUST FIRE · 27 §5 RECONSTRUCTED FROM REAL FRAMES — one mid-run frame swapped for the run's own blank one",
      rep3.refusals.some((x) => x.kind === "BLANK" && x.index === 30),
      rep3.refusals.length
        ? rep3.refusals[0].message.replace(/\s+/g, " ").slice(0, 190)
        : "NOT REFUSED",
    )
  } else {
    /* EVERY ROW STILL EXISTS, RED. A row that disappears when its input does is
     * a row that cannot fail — which is the finding this whole family of gates
     * came out of (docs/README.md:357-359, and explainer 27 §3's `assert-moment`,
     * *"in no sweep because both runners scanned one directory"*). The count of
     * rows this self-test prints must not depend on which tree it is run in. */
    for (const name of [
      "MUST NOT FIRE · the REAL shipped dit_pulse capture",
      "…and that same healthy capture carries a LOT of legitimate stillness — which is WHY frozen is opt-in",
      "CONTROL · the SAME real capture WITHOUT the reveal-at-0 declaration is REFUSED",
      "MUST FIRE · 27 §5 RECONSTRUCTED FROM REAL FRAMES — one mid-run frame swapped for the run's own blank one",
    ]) {
      ok(name, false, missing("screen-layers/qualitypass/"))
    }
  }

  /* 8 · MUST NOT FIRE — a draw-in at playhead 0, declared. ----------------- */
  {
    const g = createFrameGuard({
      label: "legit/drawin-zero",
      mayBeBlank: { first: 1, why: "a draw-in at playhead 0 has nothing on the page yet" },
      throwOnRefusal: false,
    })
    await g.frame(synth({ lum: 249 }), { index: 0 })
    for (let i = 1; i < 6; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    const rep = g.finish()
    ok(
      "MUST NOT FIRE · a draw-in at playhead 0, declared, is not flagged",
      rep.ok && rep.blankPolicy.matched === 1,
      `refusals=${rep.refusals.length}`,
    )
  }

  /* 9 · THE ALLOWANCE MUST BE ABLE TO FAIL — undeclared, the same frame reddens */
  {
    const g = createFrameGuard({ label: "control/undeclared-zero", throwOnRefusal: false })
    await g.frame(synth({ lum: 249 }), { index: 0 })
    for (let i = 1; i < 6; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    const rep = g.finish()
    ok(
      "CONTROL · the SAME playhead-0 frame WITHOUT the declaration is REFUSED (the allowance is load-bearing, not decorative)",
      rep.refusals.some((x) => x.kind === "BLANK" && x.index === 0),
      JSON.stringify(rep.refusals.map((r) => `${r.kind}@${r.index}`)),
    )
  }

  /* 10 · SHAPE — the frozen question is refused, not answered one-sided. --- */
  {
    const g = createFrameGuard({
      label: "control/shape",
      mustMove: { all: true, why: "every frame of this run is supposed to be moving" },
      throwOnRefusal: false,
    })
    for (let i = 0; i < 4; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    await g.frame(synthMarked({ w: 200, h: 150, phase: 4 }), { index: 4 })
    const rep = g.finish()
    ok(
      "CONTROL · two DIFFERENT-SHAPED frames refuse the frozen question instead of answering it",
      rep.rasterGuard.mismatches.length === 1 && rep.notes.some((n) => n.includes("REFUSED")),
      `mismatches=${JSON.stringify(rep.rasterGuard.mismatches)}`,
    )
  }

  /* 11 · A BARE BOOLEAN ALLOWANCE IS REFUSED AT CONSTRUCTION. ------------- */
  {
    let threw = null
    try {
      createFrameGuard({ label: "x", mayBeBlank: true })
    } catch (e) {
      threw = e.message
    }
    ok("CONTROL · `mayBeBlank: true` is refused — every allowance carries a written reason", !!threw, threw ?? "constructed")
    let threw2 = null
    try {
      createFrameGuard({ label: "x", mayBeBlank: { first: 1 } })
    } catch (e) {
      threw2 = e.message
    }
    ok("CONTROL · an allowance with no `why` is refused", !!threw2, threw2 ?? "constructed")
  }

  /* 12 · THE ONE-DELTA RUN — 27 §5's other signature. -------------------- */
  {
    const g = createFrameGuard({
      label: "known-bad/one-delta",
      maxDeltaShare: 0.6,
      mayBeBlank: { from: 6, why: "this arm is testing the RUN statistic, not the blank arm" },
      throwOnRefusal: false,
    })
    for (let i = 0; i < 6; i++) await g.frame(synthMarked({ phase: 4 }), { index: i })
    for (let i = 6; i < 12; i++) await g.frame(synth({ lum: 252.171 }), { index: i })
    const rep = g.finish()
    ok(
      "MUST FIRE · a run whose motion statistic is carried by ONE Δ (27 §5: 65.241/11)",
      rep.refusals.some((x) => x.kind === "ONE-DELTA-RUN"),
      `maxDeltaShare=${rep.maxDeltaShare}`,
    )
  }

  /* 13 · LANE O'S BLIND PROBE — a run with no subject at all. -------------- */
  {
    const g = createFrameGuard({
      label: "known-bad/flat-run",
      subject: "an animated texture",
      mayBeBlank: { all: true, why: "this arm is testing the RUN check, not the per-frame blank arm" },
      throwOnRefusal: false,
    })
    for (let i = 0; i < 8; i++) await g.frame(synth({ lum: 247 }), { index: i })
    const rep = g.finish()
    ok(
      "MUST FIRE · a run where EVERY frame is a flat field — Lane O's first probe, which measured a still page",
      rep.refusals.some((x) => x.kind === "FLAT-RUN"),
      rep.refusals.length ? rep.refusals.at(-1).message.replace(/\s+/g, " ").slice(0, 170) : "NOT REFUSED",
    )
  }
  {
    const g = createFrameGuard({ label: "legit/not-flat", throwOnRefusal: false })
    for (let i = 0; i < 8; i++) await g.frame(synthMarked({ phase: i }), { index: i })
    const rep = g.finish()
    ok(
      "MUST NOT FIRE · a run with a real subject is not a flat run",
      rep.ok && !rep.refusals.some((x) => x.kind === "FLAT-RUN"),
      `refusals=${rep.refusals.length}`,
    )
  }

  const pass = rows.filter((r) => r.pass).length
  for (const r of rows) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.name}\n      ${r.detail}`)
  }
  console.log(`\nframe-guard --selftest: ${pass} PASS · ${rows.length - pass} FAIL`)
  return rows.length - pass === 0 ? 0 : 1
}

if (process.argv.includes("--selftest")) {
  process.exit(await selftest())
}
