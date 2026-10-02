// THE MOMENT GATES — one implementation, two consumers.
//
// `hero-beat-storyboard.md` §8 rewrites the hero beat's registration and
// continuity gates; §10.4 ran that rewrite against both films and four
// synthetic negative controls and found three defects in it. The corrected
// criteria live HERE, once, and are called by both:
//
//   scripts/verify/assert-hero-transition.mjs   judges the real capture
//   docs/storyboard/tools/assert-moment.mjs     judges films + synthetic controls
//
// The single implementation is the point, not tidiness. A ported copy of a
// criterion is a criterion nobody tested: the storyboard tool's four negative
// controls only prove the SHIPPED gate is sound if the shipped gate runs this
// exact code. This repo's most expensive recurring defect is a second
// implementation of one idea sitting beside the first.
//
// WHAT THE THREE AMENDMENTS ARE, and each was forced by a measurement:
//
//   1. SPLIT THE REGISTRATION AXES. §8 proposed tightening the bbox-centre jump
//      to < 2 px because "the original earns it". It does not — the original's
//      RETURN turn measures 2.55 px and would be rejected. `cx` never moves
//      (479.5 through the entire event); the 2.55 px is all `cy`, because at the
//      sliver the bbox loses letterform asymmetrically (y0 +8, y1 -3) while
//      nothing has actually moved. A collapsing silhouette's vertical midpoint
//      is not a registration signal. So: `cx` holds on EVERY frame; `cy` holds
//      only on frames that still have a silhouette to register.
//
//   1b. AMENDMENT 1 WAS RIGHT ABOUT THE DIAGNOSIS AND HALF-RIGHT ABOUT THE CURE
//      — the vertical midpoint had to go, not be scoped. (2026-08-01.)
//
//      Scoping `cy` to legible frames removes the COLLAPSE case, which is the
//      one 1 was looking at. It cannot remove the other case, and the shipped
//      beat contains it at full extent: a DILATION PINNED AT ONE EDGE. The
//      anticipation squash is a non-uniform scale pinned at the CONTACT — that
//      pinning is itself an asserted feature (`assert-hero-dead-channels.mjs`:
//      *"the squash is pinned at the CONTACT, not the centre — the baseline
//      holds"*) — and its release is authored to unwind INSIDE the turn
//      (`hero-motion.ts` `squashAt`: *"the tense is now computed from absolute
//      time, so it can outlive its own clip and unwind INSIDE the turn"*). So
//      across the release the silhouette's TOP edge walks while its BOTTOM edge
//      does not move at all, and a midpoint reports half of that walk as a
//      registration failure on a beat whose registration is exact.
//
//      MEASURED, on `k7final`'s 72 emerge frames:
//
//        f22 -> f23   y0 351 -> 347   y1 495 -> 495   w 608 -> 536
//                     -> cy 423.0 -> 421.0 = the 2.00 px the gate was reading
//
//        the contact edge y1 across ALL 72 frames: {495}. One value.
//
//      And it is a PREDICTION, not a story fitted afterwards: taking H0 and the
//      contact off the capture's own settled tail and nothing else, the model's
//      `squashY` predicts the whole measured cy series at **rms 0.149 px, worst
//      0.35 px, against a 1.568 px null** (`scripts/verify/_probe-cy-model.mjs`).
//
//      So the vertical clause now asks the two questions a midpoint conflates,
//      and asks them of quantities a dilation cannot move:
//
//        THE CONTACT HOLDS   — the silhouette's bottom edge. This is the beat's
//                              own fixed point: a form standing on a ground
//                              plane and yawing about a vertical axis IN that
//                              plane cannot move its contact. Reads 0.00 px on
//                              the shipped beat and 1.00 px on the original
//                              flip's two turns.
//        THE COMMON MODE     — the largest displacement both edges share. A
//                              rigid shift moves both edges the same way, so it
//                              is reported in full; a pure dilation moves them
//                              oppositely (or moves one and not the other), so
//                              it is reported as zero. Reads 0.00 on the shipped
//                              beat and 0.00 on both of the original's turns.
//
//      Neither is a loosening of what gate 4 exists to catch: on a rigid
//      vertical displacement — the two-canvas swap, which is the whole reason
//      the clause is here — the contact moves by the full amount and the common
//      mode equals it exactly. §10.4's own synthetic *"layer swap offset
//      VERTICALLY (+6 px)"* control still REJECTS, and so does
//      `assert-hero-transition.mjs --mutate=cy`. The midpoint quantity is kept
//      and printed beside them so the overturned number stays reproducible
//      rather than remembered.
//
//   2. A SLIVER IS NOT A BLANK. §8's moment gate asks only that the extent
//      collapse below 5% of settled, held >= 2 frames, with the centre still.
//      A frame with NOTHING IN IT satisfies all three, so a hard cut to black
//      passes — and "never a blank frame" is the first of the three numbers the
//      board says a rebuild must not lose (the `sx >= 0.035` clamp). So the
//      moment needs a floor (ink survives, extent >= 2 px) and a recovery (the
//      extent returns to >= 90% of settled), or a beat that collapses and stays
//      collapsed also passes.
//
//   3. STILLNESS IS ABOUT EXTENT, NOT THE CENTRE. §8 proposed per-frame centre
//      motion < 0.5 px. It catches the current beat at EXACTLY 0.50 px — one
//      quantisation step of a half-pixel bbox centre, i.e. a coin toss — and it
//      is aimed at the thing that already stopped: over the final 40 frames the
//      centre moves a net 0.0 px while width goes +4 px and ink +2.9%. The frame
//      is still GROWING when the film ends. So: net displacement over the whole
//      window, across all of extent.
//
// Row shape, for both consumers: { n, w, h, cx, cy } — ink pixel count, bbox
// width, bbox height, bbox centre. `n` must be the FULL silhouette count, not an
// eroded interior count: the floor in amendment 2 asks "is there anything on
// screen", and an interior statistic answers a different question and can read 0
// on a genuine sliver.

const median = (xs) => [...xs].sort((p, q) => p - q)[Math.floor(xs.length / 2)]

/** Fraction of the settled width under which a frame counts as the moment. */
export const MOMENT_MAX = 0.05
/** Fraction of the settled width above which `cy` is a trustworthy signal. */
export const LEGIBLE_MIN = 0.2
/** Fraction of the settled width the extent must return to afterwards. */
export const RECOVER_MIN = 0.9

/**
 * Every quantity the gates below read, measured once.
 *
 * `settled` is the median of the last five widths rather than the last width:
 * the final frame of a window can land mid-antialias, and a settled reference
 * that moves by a pixel moves every threshold derived from it.
 */
export function momentStats(win) {
  const settled = median(win.slice(-5).map((r) => r.w))

  // The prior gate's own quantities, kept so the parked arm can reproduce its
  // verdicts verbatim rather than being described in a comment.
  let maxCentreJump = 0
  let maxWidthJump = 0
  for (let i = 1; i < win.length; i++) {
    maxCentreJump = Math.max(
      maxCentreJump,
      Math.hypot(win[i].cx - win[i - 1].cx, win[i].cy - win[i - 1].cy),
    )
    maxWidthJump = Math.max(maxWidthJump, Math.abs(win[i].w - win[i - 1].w))
  }

  // AMENDMENT 1 — registration, split by axis.
  let maxCxJump = 0
  for (let i = 1; i < win.length; i++) {
    maxCxJump = Math.max(maxCxJump, Math.abs(win[i].cx - win[i - 1].cx))
  }
  const legible = win.filter((r) => r.w >= LEGIBLE_MIN * settled)
  let maxCyJump = 0
  for (let i = 1; i < legible.length; i++) {
    maxCyJump = Math.max(maxCyJump, Math.abs(legible[i].cy - legible[i - 1].cy))
  }

  // AMENDMENT 1b — the two quantities a midpoint conflates.
  //
  // The bbox's horizontal edges, recovered exactly from the row: `h` counts
  // pixels inclusively (h = y1 - y0 + 1) and `cy` is (y0 + y1) / 2, so
  // y0 = cy - (h - 1) / 2 and y1 = cy + (h - 1) / 2 with no rounding. No new
  // field is needed and no consumer has to change what it measures.
  const edges = (r) => ({ y0: r.cy - (r.h - 1) / 2, y1: r.cy + (r.h - 1) / 2 })
  let maxContactJump = 0
  let maxCyCommon = 0
  let worstCommon = null
  for (let i = 1; i < legible.length; i++) {
    const a = edges(legible[i - 1])
    const b = edges(legible[i])
    const d0 = b.y0 - a.y0
    const d1 = b.y1 - a.y1
    maxContactJump = Math.max(maxContactJump, Math.abs(d1))
    // The shared part of the two edges' motion. Same sign: the smaller
    // magnitude is what both edges did. Opposite signs, or one edge still: no
    // translation is consistent with the pair, so nothing is claimed.
    const common = d0 * d1 > 0 ? Math.min(Math.abs(d0), Math.abs(d1)) : 0
    if (common > maxCyCommon) {
      maxCyCommon = common
      worstCommon = { from: legible[i - 1].f, to: legible[i].f, d0, d1 }
    }
  }

  // THE MOMENT — the longest run of consecutive frames whose extent is under
  // MOMENT_MAX of settled, reported with everything the hardened gate needs.
  let best = null
  let i = 0
  while (i < win.length) {
    if (win[i].w > MOMENT_MAX * settled) {
      i++
      continue
    }
    let j = i
    while (j + 1 < win.length && win[j + 1].w <= MOMENT_MAX * settled) j++
    const run = win.slice(i, j + 1)
    const cand = {
      a: run[0].f ?? i,
      b: run[run.length - 1].f ?? j,
      frames: run.length,
      minW: Math.min(...run.map((r) => r.w)),
      minInk: Math.min(...run.map((r) => r.n)),
      centreDrift: Math.max(
        ...run.map((r) => Math.hypot(r.cx - run[0].cx, r.cy - run[0].cy)),
      ),
      recovers: win.slice(j + 1).some((r) => r.w >= RECOVER_MIN * settled),
    }
    if (!best || cand.frames > best.frames) best = cand
    i = j + 1
  }

  // SPACING — where half the total extent change has happened, as a share of the
  // move's own runtime. reference-film-mechanics §6.5 measured 22 transits and
  // found them bimodal: 9-37% is arrival, 79-93% is wind-up, and the 42-58%
  // middle is the crossfade dead band the current beat sits in.
  const w0 = win[0].w
  const wEnd = best ? best.minW : win[win.length - 1].w
  const wEndIdx = best ? win.findIndex((r) => (r.f ?? 0) === best.a) : win.length - 1
  let half = null
  if (Math.abs(wEnd - w0) > 1 && wEndIdx > 0) {
    const target = w0 + (wEnd - w0) * 0.5
    for (let k = 1; k <= wEndIdx; k++) {
      const prev = win[k - 1].w
      const cur = win[k].w
      if ((prev - target) * (cur - target) <= 0 && prev !== cur) {
        half = (k - 1 + (prev - target) / (prev - cur)) / wEndIdx
        break
      }
    }
  }

  return {
    settled,
    maxCentreJump,
    maxWidthJump,
    maxCxJump,
    maxCyJump,
    maxContactJump,
    maxCyCommon,
    worstCommon,
    moment: best,
    halfAt: half,
  }
}

/** The band a spacing figure falls in, per reference-film-mechanics §6.5. */
export const spacingBand = (halfAt) =>
  halfAt < 0.37 ? "ARRIVAL" : halfAt > 0.79 ? "WIND-UP" : "*** CROSSFADE DEAD BAND ***"

/**
 * PARKED — the gates exactly as shipped before this change, so the prior arm
 * stays runnable and reproduces its own verdicts rather than being remembered.
 * `maxWidthJump < 6` is the single clause §8 deletes: extent continuity is
 * precisely what a moment breaks, and this clause is the whole reason the
 * shipped set would reject the original flip.
 */
export const priorRegistrationGate = (s) => ({
  id: "4 ",
  name: "silhouette never jumps while the camera is parked  [PRIOR]",
  pass: s.maxCentreJump < 4 && s.maxWidthJump < 6,
  detail: `max centre shift ${s.maxCentreJump.toFixed(2)} px (< 4), max width step ${s.maxWidthJump.toFixed(2)} px (< 6)`,
})

/**
 * AMENDMENT 1, as corrected by 1b. Registration must hold; extent — including a
 * dilation pinned at one edge — is free to break.
 *
 * Three quantities, each of which a rigid displacement moves by its full amount
 * and a dilation cannot move at all. The vertical midpoint is computed and
 * printed beside them, labelled, and is NOT part of the verdict: it responds to
 * the authored squash release, which is what it read as a 2.00 px failure on a
 * beat whose contact edge is one value across every frame.
 */
export const registrationGate = (s) => ({
  id: "4x",
  name: "REGISTRATION holds — cx every frame; the contact and the common mode where there is a silhouette",
  pass: s.maxCxJump < 2 && s.maxContactJump < 2 && s.maxCyCommon < 2,
  detail:
    `max cx step ${s.maxCxJump.toFixed(2)} px (needs < 2), ` +
    `max CONTACT step ${s.maxContactJump.toFixed(2)} px (needs < 2), ` +
    `max COMMON-MODE step ${s.maxCyCommon.toFixed(2)} px (needs < 2)` +
    `, on frames >= ${(100 * LEGIBLE_MIN).toFixed(0)}% of settled` +
    (s.worstCommon
      ? ` [worst common f${s.worstCommon.from}->f${s.worstCommon.to}: top ${s.worstCommon.d0 > 0 ? "+" : ""}${s.worstCommon.d0}, bottom ${s.worstCommon.d1 > 0 ? "+" : ""}${s.worstCommon.d1}]`
      : "") +
    `\n      [parked, not the verdict] max cy MIDPOINT step ${s.maxCyJump.toFixed(2)} px` +
    ` — a midpoint cannot separate a shift from a dilation pinned at the contact; see amendment 1b`,
})

/** §8's moment gate, as written. Kept separate so the hardening is visibly the thing that closes the blank-frame hole. */
export const momentGate = (s) => {
  const m = s.moment
  return {
    id: "5'",
    name: "the beat contains a MOMENT",
    pass: !!m && m.frames >= 2 && m.centreDrift < 1,
    detail: m
      ? `extent falls to ${m.minW} px = ${((100 * m.minW) / s.settled).toFixed(1)}% of settled ${s.settled}, held ${m.frames} fr (needs >= 2), centre drift ${m.centreDrift.toFixed(2)} px (needs < 1)`
      : `extent never falls below ${(100 * MOMENT_MAX).toFixed(0)}% of settled ${s.settled} px — no instant with a before and an after`,
  }
}

/** AMENDMENT 2. The moment is a sliver, not a blank and not a blink. */
export const sliverGate = (s) => {
  const m = s.moment
  return {
    id: "5h",
    name: "...and the moment is a SLIVER, not a blank or a blink",
    pass:
      !!m && m.frames >= 2 && m.centreDrift < 1 && m.minInk > 0 && m.minW >= 2 && m.recovers,
    detail: m
      ? `floor ${m.minW} px / ${m.minInk} ink px (needs > 0 — the sx >= 0.035 clamp), held ${m.frames} fr (needs >= 2), recovers to >= ${(100 * RECOVER_MIN).toFixed(0)}% settled: ${m.recovers}`
      : "no moment to harden",
  }
}

/**
 * AMENDMENT 3. Does the final hold actually stop?
 *
 * Net displacement over the window, across ALL of extent. Per-frame centre
 * motion is the wrong quantity twice over: the centre is what already stopped,
 * and a per-frame threshold on a half-pixel-quantised bbox turns on the last
 * representable digit.
 */
export function stillnessGate(rows, n = 20) {
  const tail = rows.slice(-n)
  const last = tail[tail.length - 1]
  const first = tail[0]
  const netCentre = Math.hypot(last.cx - first.cx, last.cy - first.cy)
  const netW = Math.abs(last.w - first.w)
  const netH = Math.abs(last.h - first.h)
  const netInk = first.n ? (100 * Math.abs(last.n - first.n)) / first.n : 0
  return {
    id: "6n",
    name: "the final hold actually STOPS — net, across all of extent",
    pass: netCentre < 1 && netW < 2 && netH < 2 && netInk < 0.5,
    detail: `over the last ${tail.length} frames: net centre ${netCentre.toFixed(2)} px (< 1), net w ${netW.toFixed(0)} px (< 2), net h ${netH.toFixed(0)} px (< 2), net ink ${netInk.toFixed(2)}% (< 0.5)`,
  }
}

/** §8's stillness proposal, parked — it fires on the last representable digit. */
export function priorStillnessGate(rows, n = 20) {
  const tail = rows.slice(-n)
  let maxStep = 0
  for (let i = 1; i < tail.length; i++) {
    maxStep = Math.max(
      maxStep,
      Math.hypot(tail[i].cx - tail[i - 1].cx, tail[i].cy - tail[i - 1].cy),
    )
  }
  return {
    id: "6 ",
    name: "the final hold actually STOPS  [§8 as written: per-frame centre]",
    pass: maxStep < 0.5,
    detail: `largest per-frame centre step over the last ${tail.length} frames ${maxStep.toFixed(2)} px (needs < 0.5)`,
  }
}
