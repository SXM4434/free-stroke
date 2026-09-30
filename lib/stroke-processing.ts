import {
  applyHandFeel,
  deriveStrokeSeed,
  bboxMinOf,
  type Anchor,
} from "@/lib/wobble-field"
import {
  HAND_FEEL_BASE,
  DD_REFERENCE_INK_WIDTH,
  effectiveWobble,
  type EndpointBehavior,
} from "@/lib/hand-feel"
import {
  DEFAULT_HAND_SEED,
  drawHandState,
  reconstructPenKinematics,
  type HandState,
} from "@/lib/pen-kinematics"

export interface Point {
  x: number
  y: number
  t: number
  pressure?: number
}

export interface Stroke {
  points: Point[]
}

export interface ProcessedStroke {
  points: Point[]
  cornerCount: number
}

/* ------------------------------------------------------------------ */
/*  HAND-FEEL SETTINGS                                                */
/*                                                                    */
/*  The path axis, ported from Desk Doodles — see lib/hand-feel.ts    */
/*  and lib/wobble-field.ts for provenance and the full argument.     */
/*                                                                    */
/*  Free Stroke's marks read machine-made because they ARE machine-   */
/*  made: the hero word comes out of an exact vector font, and every  */
/*  stage below it (resample, Taubin smooth, resample) made it more   */
/*  exact rather than less. Desk Doodles' answer is a seeded wobble   */
/*  field on the path, and their locked invariant I-11 makes that the */
/*  master of trajectory: "Wobble defines WHERE the stroke's path     */
/*  goes in 2D space [...] Roughness does NOT move the path — only    */
/*  wobble does."                                                     */
/*                                                                    */
/*  DEFAULT IS OFF (wobble 0 = their `clean` preset), so every        */
/*  existing caller and the whole geometry baseline stay byte-        */
/*  identical until a surface opts in.                                */
/* ------------------------------------------------------------------ */
export interface HandFeelSettings {
  /** Master wobble on Desk Doodles' 0-2 scale (I-11). Their presets:
   *  clean 0 · rough-handdrawn 0.4 · sketchy 0.6 · charcoal 1.0.
   *  See WOBBLE_PRESETS in lib/hand-feel.ts. */
  wobble: number
  /** Endpoint treatment — a hand does not stop exactly on the mark. */
  endpoint?: EndpointBehavior
  /** Treat the stroke as a closed loop (endpoint pushes radially instead of
   *  extending the two ends). */
  closed?: boolean
  /**
   * The rendered ink DIAMETER, in the same coordinate space as the points.
   *
   * Wobble amplitude and endpoint overshoot are both absolute lengths that
   * Desk Doodles calibrated against a 1.2px line. Free Stroke's tube is many
   * times thicker in its own coordinate space, so ported verbatim they vanish
   * inside the tube — see DD_REFERENCE_INK_WIDTH in lib/hand-feel.ts for the
   * measured failure and Desk Doodles' own rule requiring the conversion.
   *
   * On /desk-doodles this is `computeSolidEffectiveThicknessPx(thickness)`,
   * which is exactly "stroke DIAMETER in canvas px"
   * (`lib/geometry-engines.ts:549`, `computeSolidEffectiveThicknessPx`).
   * Omit it and the pass runs at Desk Doodles' reference weight, i.e. verbatim.
   */
  inkWidth?: number
  /** The kinematic axis — see PenKinematicsSettings. */
  kinematics?: PenKinematicsSettings
}

/* ------------------------------------------------------------------ */
/*  THE KINEMATIC AXIS                                                */
/*                                                                    */
/*  Wobble owns WHERE the path goes. This owns HOW FAST the pen went  */
/*  along it, and therefore how wide the mark is at every point.      */
/*  Full argument and provenance: lib/pen-kinematics.ts.              */
/*                                                                    */
/*  Short version: the traced logo records position and nothing else. */
/*  `t` is synthesised at a flat 12 ms per point and there is no      */
/*  pressure channel at all, so Inflate falls back to deriving width  */
/*  from CURVATURE — a static geometric property that hands the two   */
/*  o's of "Doodles" byte-identical width. Reconstructing the pen's   */
/*  velocity with the Sigma-Lognormal model and mapping it through    */
/*  perfect-freehand's ported ink-flow law fills the channel that was */
/*  empty, which is the channel "constant-radius tube" is a complaint */
/*  about.                                                            */
/* ------------------------------------------------------------------ */
export interface PenKinematicsSettings {
  /**
   * Default: ON whenever hand-feel is engaged at all, OFF otherwise.
   *
   * That default is a judgement, not a dodge, and the line it draws is
   * between SYNTHETIC and LIVE input. Reconstructing a plausible velocity is
   * the right thing to do for a trace or a font, which never had one. It is
   * the WRONG thing to do for a stroke drawn live at
   * components/drawing-canvas.tsx, which carries the real hand's real timing
   * and real `e.pressure` — overwriting that with a synthesised hand would be
   * strictly destructive. Live input arrives through call sites that pass no
   * hand-feel at all, so keying off hand-feel separates the two exactly.
   */
  enabled?: boolean
  /**
   * ONE draw per rendered instance, shared by every stroke — the single
   * biggest finding in docs/research/handwriting-variability.md. Because
   * `drawHandState` is a pure function of this seed, every stroke that
   * receives the same seed receives the identical hand, which is the property
   * being asked for; the derivation is memoised so the shared draw is also
   * literally one computation.
   */
  handSeed?: number
  /** 0..1 blend of the co-articulated trajectory over the path as drawn. */
  coarticulation?: number
  /** Half-range of the width modulation about neutral. */
  inkModulation?: number
  /**
   * Rewrite `t` from the reconstruction, default ON.
   *
   * This costs nothing and fixes a control that is currently almost inert.
   * `penTimeDistanceFraction` (`lib/pen-reveal.ts:88`) already turns
   * the points' own timestamps into the reveal's distance fraction, and the
   * panel measures how far that departs from constant speed to decide whether
   * Natural and Authentic can differ at all. On the hero word it reports
   * 1.8%, barely over its own 1% threshold — because every point is stamped
   * the same 12 ms apart and the only departure comes from the gaps BETWEEN
   * strokes. Re-timing puts a real acceleration and deceleration inside each
   * stroke, so "Authentic replays the speed the stroke was drawn at" becomes
   * true.
   *
   * Each stroke's first and last timestamps are preserved exactly, so total
   * duration, stroke ordering and every beat in the hero timing are
   * untouched — only the distribution WITHIN a stroke changes.
   */
  retime?: boolean
}

/** Co-articulation default. Deliberately conservative: the /desk-doodles
 *  input is Sebs's own traced handwriting, so the path already carries a real
 *  hand and the model's job here is mostly to supply the width channel. The
 *  sweep at 0 / 0.35 / 0.7 / 1.0 is captured in docs/verification/pen-kinematics/
 *  for the judgement about raising it. */
export const DEFAULT_COARTICULATION = 0.35
/** Width modulation default: raw pressure 0..1 is mapped to 0.5 +- this, which
 *  the consumer's INFLATE_PRESSURE_INFLUENCE (0.35) turns into a radius
 *  multiplier of roughly 0.79 .. 1.21 at the extremes. */
export const DEFAULT_INK_MODULATION = 0.3

export const HAND_FEEL_OFF: HandFeelSettings = {
  wobble: 0,
  endpoint: "clean",
  kinematics: { enabled: false },
}

/** Memo for the shared draw — see PenKinematicsSettings.handSeed. */
const handStateCache = new Map<number, HandState>()
function handStateFor(seed: number): HandState {
  let s = handStateCache.get(seed)
  if (!s) {
    s = drawHandState(seed)
    handStateCache.set(seed, s)
  }
  return s
}

function handFeelEngaged(settings: HandFeelSettings): boolean {
  return settings.wobble > 0 || (settings.endpoint ?? "clean") !== "clean"
}

/**
 * Reconstruct the pen kinematics and write them into the point list.
 *
 * Returns the input unchanged whenever the model has nothing honest to say —
 * disabled, too few points, no ink-weight scale to calibrate against, or a
 * reconstruction that failed. Never substitutes a default, because a stroke
 * this model cannot describe must not be damaged by it.
 */
/**
 * VERIFICATION-ONLY parameter override.
 *
 * The kinematic axis has no dial, because the only surface that engages
 * hand-feel is app/desk-doodles/page.tsx and that file belongs to another
 * agent. Without a way to move the parameters, a sweep would have to be done
 * by editing constants and reloading, which cannot capture an A/B of the same
 * scene. This hook lets scripts/verify/verify-pen-kinematics.mjs drive the
 * parameters on the REAL page through the REAL pipeline — the geometry path is
 * untouched, only the numbers move.
 *
 * It is deliberately parameters-only: it cannot switch the pass on where a
 * caller has switched it off, and the shipped defaults are what the acceptance
 * frames are judged at. If the axis ever earns a dial it belongs in the
 * /desk-doodles config panel next to Wobble, and this can go.
 */
export interface PenKinematicsOverride {
  coarticulation?: number
  inkModulation?: number
  handSeed?: number
  retime?: boolean
  /** Force the whole pass off, to capture the A of an A/B. */
  off?: boolean
}
function readOverride(): PenKinematicsOverride | null {
  if (process.env.NODE_ENV === "production") return null
  const g = globalThis as unknown as { __penKinematicsOverride?: PenKinematicsOverride }
  return g.__penKinematicsOverride ?? null
}

function kinematicsPass(points: Point[], settings: HandFeelSettings): Point[] {
  const ov = readOverride()
  const k = ov ? { ...settings.kinematics, ...ov } : settings.kinematics
  if (ov?.off) return points
  if (!(k?.enabled ?? handFeelEngaged(settings))) return points
  if (points.length < 3) return points

  // The nib is the only scale the model needs, and there is no honest
  // substitute for it: the calibration that places a typical component at the
  // ink-flow law's neutral is expressed in nib diameters
  // (NOMINAL_AMPLITUDE_NIBS), so without a real ink width the whole word lands
  // at one end of the law and the modulation flattens against a clamp. Skip
  // rather than run it wrong. Every caller that engages hand-feel supplies it.
  const nib = settings.inkWidth
  if (!(typeof nib === "number" && nib > DD_REFERENCE_INK_WIDTH * 0.5)) return points

  const res = reconstructPenKinematics(
    points.map((p) => [p.x, p.y] as [number, number]),
    {
      hand: handStateFor(k?.handSeed ?? DEFAULT_HAND_SEED),
      nibDiameter: nib,
      coarticulation: k?.coarticulation ?? DEFAULT_COARTICULATION,
      inkModulation: k?.inkModulation ?? DEFAULT_INK_MODULATION,
    },
  )
  if (!res) return points

  const retime = k?.retime ?? true
  const tFirst = points[0].t
  const tSpan = points[points.length - 1].t - tFirst
  return points.map((p, i) => ({
    x: res.points[i][0],
    y: res.points[i][1],
    // Preserve the stroke's own first/last timestamps exactly — only the
    // distribution between them changes. See PenKinematicsSettings.retime.
    t: retime && tSpan > 0 ? tFirst + res.timeNorm[i] * tSpan : p.t,
    pressure: res.pressure[i],
  }))
}

/**
 * Run the ported hand-feel pass over an already-processed point list.
 *
 * Carries `t` and `pressure` across by ARC-LENGTH FRACTION. The hand-feel pass
 * changes the anchor count (RDP thins it, the endpoint pass may extend the
 * ends), so the channels cannot be indexed across 1:1. Arc-length fraction is
 * the same shared coordinate Desk Doodles' `samplePressure` uses
 * (strokeTo3d.ts:951) and keeps `t` monotonic, which the reveal animation and
 * the writing-order replay both depend on.
 */
function handFeelPass(points: Point[], settings: HandFeelSettings): Point[] {
  if (points.length < 2) return points
  const anchors: Anchor[] = points.map((p) => [p.x, p.y])

  // Amplitude, exactly as Desk Doodles composes it
  // (SvgStyleTransform.tsx:1873-1874, :1921):
  //     ROUGH     = HAND_FEEL_BASE.line * effectiveWobble(userWobble, bboxMin)
  //     wobbleAmp = max(0, ROUGH * 2)
  // `line` (1.4) is the right base: every Free Stroke mark is a freehand
  // polyline. effectiveWobble is the size-aware clamp that stops small marks
  // shredding.
  const bboxMin = bboxMinOf(anchors)
  const effW = effectiveWobble(settings.wobble, bboxMin)

  // ── INK-WEIGHT CONVERSION, and the tension it has to resolve ──
  //
  // Desk Doodles' wobble is BOTH ~93% of its ink width (1.12px excursion on a
  // 1.2px line) AND ~1.1% of its shape size (1.12px on a ~100px shape). Those
  // two ratios agree there because their ink is thin relative to their shapes.
  // Ours is not: the Inflate tube is ~6.7px in a coordinate space where a
  // glyph is ~120px tall, so our ink/shape ratio is ~5x theirs. Matching BOTH
  // of their ratios is therefore impossible — they are only compatible at
  // their ink weight.
  //
  // Both endpoints of that trade were captured and judged, not guessed:
  //   scale 1    (verbatim px)      — measurably present, visually invisible;
  //                                   the tube swallowed it. Frames identical
  //                                   at wobble 0 / 0.4 / 0.8 / 1.2.
  //   scale 5.6  (full ink-ratio)   — wobble AND endpoint overshoot blew the
  //                                   letterforms apart; the word stopped
  //                                   being readable as a word.
  // So the conversion is the GEOMETRIC MEAN of the two, sqrt(inkWidth ratio).
  // At our weight that is ~2.4x: the excursion becomes ~40% of the ink width
  // (clearly visible as line character) while staying ~2% of glyph height
  // (nowhere near legibility). This is a documented compromise, not a ported
  // constant — Desk Doodles never had to make it, because they never rendered
  // this calibration at this ink weight.
  const inkRatio = Math.max(
    0.25,
    (settings.inkWidth ?? DD_REFERENCE_INK_WIDTH) / DD_REFERENCE_INK_WIDTH,
  )
  const inkScale = Math.sqrt(inkRatio)
  const amplitude = Math.max(0, HAND_FEEL_BASE.line * effW * 2 * inkScale)

  const seed = deriveStrokeSeed(anchors)
  const out = applyHandFeel(anchors, {
    wobble: amplitude,
    endpoint: settings.endpoint ?? "clean",
    // Endpoint overshoot is a length relative to the GLYPH, not to the ink —
    // scaling it by the full ink ratio threw 22px tails off every stroke end
    // and was the single biggest destroyer in the over-scaled capture. Desk
    // Doodles scales protrude by SHAPE SIZE (f3HandFeel protrudeScale), never
    // by ink weight, so it gets the same gentler treatment.
    endpointScale: inkScale,
    seed,
    closed: settings.closed ?? false,
  })
  if (out.length < 2) return points

  // Cumulative arc length of the ORIGINAL, to read t/pressure from.
  const srcCum = cumulativeArcLength(points)
  const srcTotal = srcCum[srcCum.length - 1]
  // Cumulative arc length of the WOBBLED result, to place each new anchor.
  let dstTotal = 0
  const dstCum = [0]
  for (let i = 1; i < out.length; i++) {
    dstTotal += Math.hypot(out[i][0] - out[i - 1][0], out[i][1] - out[i - 1][1])
    dstCum.push(dstTotal)
  }
  if (!(srcTotal > 0) || !(dstTotal > 0)) {
    return out.map(([x, y], i) => ({
      x,
      y,
      t: points[Math.min(i, points.length - 1)].t,
      pressure: points[Math.min(i, points.length - 1)].pressure,
    }))
  }

  const sampleAt = (frac: number): { t: number; pressure?: number } => {
    const target = frac * srcTotal
    let hi = 1
    while (hi < srcCum.length - 1 && srcCum[hi] < target) hi++
    const lo = hi - 1
    const span = srcCum[hi] - srcCum[lo]
    const k = span > 1e-9 ? (target - srcCum[lo]) / span : 0
    const a = points[lo]
    const b = points[hi]
    return {
      t: a.t + (b.t - a.t) * k,
      pressure:
        a.pressure !== undefined && b.pressure !== undefined
          ? a.pressure + (b.pressure - a.pressure) * k
          : (a.pressure ?? b.pressure),
    }
  }

  return out.map(([x, y], i) => {
    const { t, pressure } = sampleAt(dstCum[i] / dstTotal)
    return { x, y, t, pressure }
  })
}

/**
 * RE-READ `t` (and `pressure`) FROM A DENSER SOURCE, BY ARC-LENGTH FRACTION.
 *
 * ── THE DEFECT THIS CLOSES, measured. ─────────────────────────────────────
 * `scripts/verify/measure-drawin-pacing.mjs`'s `velocity-bell` row asks whether
 * the pen accelerates and decelerates inside a stroke, and it read **10 of 22**
 * with the flattest strokes at peak/mean EXACTLY 1.000 — a pen crossing them at
 * one speed. The Sigma-Lognormal model had computed a bell for every one of
 * them; the pipeline then threw it away, in a specific place:
 *
 *   `kinematicsPass` writes the bell into `t`, one value per 4 px point.
 *   `handFeelPass` runs RDP, which THINS those points to a handful of anchors,
 *     and carries `t` onto them by arc-length fraction — correct at the anchors.
 *   the final `resampleStroke` then walks the wobbled polyline and interpolates
 *     `t` LINEARLY inside each anchor span.
 *
 * Linear-in-arc-length IS constant speed. On a stroke that reduces to two or
 * three anchors there is nothing of the lognormal left but its endpoints, so
 * peak/mean collapses to 1.000 by construction. The long strokes kept theirs
 * (0 -> 2.604, 10 -> 2.514, 4 -> 2.197), which is what made it a RESOLUTION
 * limit of the carry-over rather than a failure of the model.
 *
 * ── AND WHY THIS IS NOT A RE-DERIVATION. ──────────────────────────────────
 * `t` is REAL RECORDED INPUT on the live drawing canvas and must never be
 * invented. Nothing here invents one: this is the SAME arc-length-fraction rule
 * `handFeelPass` already applies, applied at the resample's resolution instead
 * of only at the anchors it happened to keep. Every value returned is read out
 * of the source list — the endpoints land on `src[0].t` and `src[last].t`
 * exactly, and monotonicity is preserved because arc-length fraction is
 * monotone, which the reveal animation and the writing-order replay depend on.
 * What changes is only that the samples BETWEEN two anchors stop being a
 * straight line through a curve that was measured.
 *
 * ── `t` ONLY, AND `pressure` IS LEFT ALONE ON PURPOSE. ────────────────────
 * `pressure` reaches the same resample through the same anchors and is
 * linearised the same way, so the same argument applies to it — but it is not
 * a timing channel, it is a GEOMETRY one: Inflate sizes every capsule as
 * `radiusXY x bulgeScale x ink[i]` off the pressure profile
 * (lib/geometry-engines.ts). Re-reading it here was tried and MEASURED: the
 * geometry baseline moved on exactly one of thirty-two cases,
 * `scribble/inflate`, `exportBytes 1 396 432 -> 1 396 448`, with every vertex
 * and triangle count on every fixture unchanged
 * (`docs/verification/geometry/k7lane-before` vs `-after`). Sixteen bytes is
 * not a defect, and it is also not this change's business: the velocity bell
 * is a timing claim. Left as a stated observation rather than as an
 * unrequested geometry edit.
 */
function restampTimeByArcLength(dst: Point[], src: Point[]): Point[] {
  if (dst.length < 2 || src.length < 2) return dst
  const srcCum = cumulativeArcLength(src)
  const srcTotal = srcCum[srcCum.length - 1]
  const dstCum = cumulativeArcLength(dst)
  const dstTotal = dstCum[dstCum.length - 1]
  if (!(srcTotal > 0) || !(dstTotal > 0)) return dst

  let hi = 1
  return dst.map((p, i) => {
    const target = (dstCum[i] / dstTotal) * srcTotal
    // The walk is monotone, so the cursor only ever moves forward — O(n+m).
    if (i === 0) hi = 1
    while (hi < srcCum.length - 1 && srcCum[hi] < target) hi++
    const lo = hi - 1
    const span = srcCum[hi] - srcCum[lo]
    const k = span > 1e-9 ? (target - srcCum[lo]) / span : 0
    const a = src[lo]
    const b = src[hi]
    return { ...p, t: a.t + (b.t - a.t) * k }
  })
}

/* ------------------------------------------------------------------ */
/*  Utility: arc-length between two indices                           */
/* ------------------------------------------------------------------ */
function arcLength(points: Point[], from: number, to: number): number {
  let len = 0
  for (let i = from + 1; i <= to; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    len += Math.sqrt(dx * dx + dy * dy)
  }
  return len
}

/* ------------------------------------------------------------------ */
/*  Utility: cumulative arc-length array                              */
/* ------------------------------------------------------------------ */
function cumulativeArcLength(points: Point[]): number[] {
  const cum = [0]
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    cum.push(cum[i - 1] + Math.sqrt(dx * dx + dy * dy))
  }
  return cum
}

/* ------------------------------------------------------------------ */
/*  Arc-length resample: walk the polyline and emit a point every     */
/*  `spacing` pixels.                                                 */
/*                                                                    */
/*  ⚠ THIS FUNCTION USED TO BE HANGABLE BY A SINGLE COORDINATE.       */
/*                                                                    */
/*  Its only guard was `if (segLen === 0) continue`, and the walk is  */
/*                                                                    */
/*      while (walked <= segLen) { out.push(…); walked += spacing }   */
/*                                                                    */
/*  which terminates only when BOTH `segLen` is finite AND `spacing`  */
/*  is a positive finite number. Neither was checked, and neither is  */
/*  a trusted channel:                                                */
/*                                                                    */
/*   · `segLen` is `sqrt(dx² + dy²)`, so it is +Infinity for a non-   */
/*     finite coordinate AND for two perfectly FINITE coordinates far */
/*     enough apart that the SQUARE overflows a double (|dx| >        */
/*     ~1.34e154). `walked <= Infinity` is true forever.              */
/*   · `spacing` arrives from a UI slider and from persisted          */
/*     documents (`lib/doc-store.ts`). 0, a negative and NaN all make */
/*     `walked += spacing` fail to advance.                           */
/*                                                                    */
/*  The failure is not an exception — `out` grows until the process   */
/*  dies. REPRODUCED, four ways, each in its own node with a 512 MB   */
/*  heap cap: all four exhausted it                                   */
/*  (`scripts/verify/_probe-resample-hang.mjs`, and the gate          */
/*  `scripts/verify/assert-stroke-guards.mjs`). A drawing app that    */
/*  can be hung by a coordinate is not sellable.                      */
/*                                                                    */
/*  The three guards below are stated rather than silent, and NONE of */
/*  them can fire for a well-formed stroke — proved by the geometry   */
/*  baseline coming back byte-identical on all 32 fixture/mode cases. */
/* ------------------------------------------------------------------ */

/**
 * Emission budget for one stroke.
 *
 * `spacing` can be positive, finite, and still absurd: 1e-9 px over a 1000 px
 * stroke asks for 1e12 points. That is not malformed input in the sense the
 * guards above catch — it is a legal number that no machine can honour — so it
 * degrades to a coarser grid rather than dying, and the degradation is a
 * documented rule instead of an OOM.
 *
 * 200,000 points is ~50 000× the shipped hero word's longest stroke and ~270×
 * the densest baseline fixture, so it cannot fire on real work. It is exercised
 * deliberately by the `tinySpacing` case in `_probe-resample-hang.mjs`, which is
 * what keeps it from being a guard nobody has ever run.
 */
const MAX_RESAMPLE_POINTS = 200_000

/**
 * Arc-length resample, with an optional set of vertices that MUST survive.
 *
 * ⚠ WHY `keep` HAD TO EXIST: `preserveCorners` PINNED A CORNER AND THEN THIS
 * FUNCTION THREW IT AWAY.
 *
 * `smoothPreservingCorners` splits the stroke at each corner and smooths the
 * segments independently, so the corner vertex comes out of the smoother
 * exactly where it went in. Then `processStroke` calls this to restore the even
 * grid the engines need — and an even grid laid along a polyline lands a sample
 * ON the corner only by luck. When it does not, the two samples straddling the
 * apex chord across it and the corner is cut, by up to half a step.
 *
 * MEASURED, on `square/inflate` through the real page
 * (`scripts/verify/_probe-elbow-arms.mjs`): the corner's outer reach ρ_out/r
 * moved by up to 0.105 r between two builds that differ ONLY in which sample
 * the grid happened to land on. That is not a shape difference; it is the phase
 * of a grid, deciding how sharp a drawn corner comes out. A dial called
 * `preserveCorners` whose corner survives on a coin flip is the same defect the
 * inverted predicate was — a control that does not do what its name says.
 *
 * With `keep`, each span between consecutive kept vertices is resampled on its
 * own, so every kept vertex appears in the output verbatim and the grid simply
 * restarts after it.
 *
 * `keep` EMPTY OR OMITTED IS THE OLD FUNCTION, EXACTLY. Every caller that does
 * not pass it — export, the non-preserving path, every hand-feel-off fixture —
 * takes the identical single-span walk and is byte-identical, which the geometry
 * baseline proves per fixture.
 */
function resampleStroke(points: Point[], spacing: number, keep?: number[]): Point[] {
  if (points.length < 2) return [...points]

  if (keep && keep.length > 0) {
    /* Sanitised here rather than trusted: an index outside (0, n-1), a
     * duplicate, or an out-of-order entry would silently produce an empty or
     * reversed span. The ends are already pinned by the walk itself. */
    const n = points.length
    const cuts = [...new Set(keep.filter((i) => Number.isInteger(i) && i > 0 && i < n - 1))].sort(
      (a, b) => a - b,
    )
    if (cuts.length === 0) return resampleStroke(points, spacing)
    const bounds = [0, ...cuts, n - 1]
    const out: Point[] = []
    for (let s = 0; s < bounds.length - 1; s++) {
      const span = points.slice(bounds[s], bounds[s + 1] + 1)
      const r = resampleStroke(span, spacing)
      /* The junction vertex is the previous span's last output point AND this
       * span's first, so it is emitted once. */
      out.push(...(s === 0 ? r : r.slice(1)))
    }
    return out
  }

  const guarded = RESAMPLE_TUNING.guards === "on"

  /* GUARD 1 · SPACING. A non-positive or non-finite step never advances the
   * walk. Pass the points through UNCHANGED rather than invent a grid at some
   * made-up fallback step: the caller asked for a resample this function
   * cannot perform, and handing back its own points is the only answer that
   * does not silently substitute a different stroke. */
  if (guarded && (!Number.isFinite(spacing) || spacing <= 0)) return [...points]

  /* GUARD 2 · THE BUDGET. Total arc length is computed with the IDENTICAL
   * expression the walk uses (`sqrt(dx² + dy²)`, not `Math.hypot`, which does
   * not overflow and would therefore disagree with the loop about which
   * segments are infinite). Non-finite segments are excluded here for the same
   * reason guard 3 skips them below. */
  let totalLen = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (Number.isFinite(d)) totalLen += d
  }
  /* For every real stroke `totalLen / MAX` is orders of magnitude below
   * `spacing`, so `Math.max` returns the caller's number bit-for-bit and the
   * emitted grid is unchanged. */
  const step = guarded
    ? Math.max(spacing, totalLen / MAX_RESAMPLE_POINTS)
    : spacing

  const first = points[0]
  const out: Point[] =
    !guarded || (Number.isFinite(first.x) && Number.isFinite(first.y))
      ? [first]
      : []
  let carry = 0

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    const segLen = Math.sqrt(dx * dx + dy * dy)

    /* GUARD 3 · THE SEGMENT. This replaces `segLen === 0` and is a strict
     * superset of it: `!(segLen > 0)` also rejects NaN and negatives, and the
     * finiteness test rejects the Infinity that both a non-finite coordinate
     * and a double overflow produce. A segment we cannot measure contributes
     * no samples — exactly what a zero-length segment already did. */
    if (guarded ? !Number.isFinite(segLen) || segLen <= 0 : segLen === 0) continue

    let walked = carry > 0 ? step - carry : 0

    if (carry > 0 && carry + segLen < step) {
      carry += segLen
      continue
    }

    while (walked <= segLen) {
      const ratio = walked / segLen
      out.push({
        x: prev.x + dx * ratio,
        y: prev.y + dy * ratio,
        t: prev.t + (curr.t - prev.t) * ratio,
        pressure:
          prev.pressure !== undefined && curr.pressure !== undefined
            ? prev.pressure + (curr.pressure - prev.pressure) * ratio
            : undefined,
      })
      walked += step
    }

    carry = segLen - (walked - step)
  }

  /* The endpoint pin, guarded the same way: a non-finite last point must not be
   * appended verbatim, which is how a NaN used to travel out of here and into
   * the mesh builders. */
  const last = points[points.length - 1]
  const tail = out.length > 0 ? out[out.length - 1] : null
  if (
    (!guarded || (Number.isFinite(last.x) && Number.isFinite(last.y))) &&
    (tail === null || tail.x !== last.x || tail.y !== last.y)
  ) {
    out.push(last)
  }

  return out
}

/* ------------------------------------------------------------------ */
/*  Corner detection (robust)                                         */
/*                                                                    */
/*  1. Window-based angle: look k points back and forward instead     */
/*     of immediate neighbors, so fast/coarse strokes aren't noisy.   */
/*  2. Minimum arm length: skip corners too close to stroke ends.     */
/*  3. Merge pass: if two corners are within MERGE_DISTANCE of each   */
/*     other (arc-length), keep only the strongest.                   */
/* ------------------------------------------------------------------ */

const MIN_CORNER_ARM_LENGTH = 16 // px arc-length from stroke ends
/** px arc-length between corners. Must stay above the largest `spacing` the UI
 *  can hand `resampleStroke` (the slider is 2–8 px,
 *  `components/drawing-canvas.tsx:571`, `min={2}`) or a single corner's run stops
 *  merging into one group and reports 3 corners where the mark has 1. */
const MERGE_DISTANCE = 12

/**
 * PARKED PRIOR BEHAVIOUR, kept selectable — the same pattern as
 * `SOLID_TUNING.capFit` (`lib/solid-mask.ts:38`) and `__rodTuning.loopEnds`.
 *
 * `"turn"` ships. `"interior"` is the inverted predicate this file carried
 * until 2026-08-02, preserved verbatim in behaviour so that (a) the geometry it
 * produced still renders and is still selectable, and (b) `assert-corner-split`
 * has a NEGATIVE CONTROL that must FAIL — a corner gate whose only evidence is
 * its own green row is a green row that cannot fail.
 *
 * The app never writes this. Nothing outside `scripts/verify/` should.
 */
export const CORNER_TUNING: { predicate: "turn" | "interior" } = {
  predicate: "turn",
}

/**
 * PARKED PRIOR BEHAVIOUR — the ungated resample walk.
 *
 * `"off"` restores `resampleStroke`'s pre-2026-08-02 guards exactly (`segLen
 * === 0` and nothing else), which is what makes the OOM reproducible on demand
 * as the negative control for `assert-stroke-guards`. It WILL hang the process
 * on malformed input; that is the point of it, and it is why every use runs in
 * a child node with a heap cap. Never set it in app code.
 */
export const RESAMPLE_TUNING: { guards: "on" | "off" } = { guards: "on" }

interface CornerCandidate {
  index: number
  /** The TURN in radians at this sample — 0 on a straight run, PI at a
   *  hairpin. Higher = sharper, which is what the merge pass sorts on. */
  strength: number
}

export function detectCorners(
  points: Point[],
  angleThresholdDeg: number = 45,
  spacing: number = 4
): number[] {
  if (points.length < 5) return []

  const threshold = (angleThresholdDeg * Math.PI) / 180
  const cum = cumulativeArcLength(points)
  const totalLen = cum[cum.length - 1]

  // Adaptive window: use at least 2, scale up with spacing so we look
  // across a meaningful arc (~12-20px worth of points)
  const k = Math.max(2, Math.min(Math.ceil(12 / Math.max(spacing, 1)), 5))

  const candidates: CornerCandidate[] = []

  for (let i = k; i < points.length - k; i++) {
    // Gate: must be at least MIN_CORNER_ARM_LENGTH from each end
    if (cum[i] < MIN_CORNER_ARM_LENGTH) continue
    if (totalLen - cum[i] < MIN_CORNER_ARM_LENGTH) continue

    const p = points[i - k]
    const c = points[i]
    const n = points[i + k]

    const ax = c.x - p.x
    const ay = c.y - p.y
    const bx = n.x - c.x
    const by = n.y - c.y

    const magA = Math.sqrt(ax * ax + ay * ay)
    const magB = Math.sqrt(bx * bx + by * by)

    if (magA < 0.5 || magB < 0.5) continue

    const dot = ax * bx + ay * by
    const cosAngle = Math.max(-1, Math.min(1, dot / (magA * magB)))

    /* THIS IS THE TURN, AND IT USED TO BE READ AS THE INTERIOR ANGLE.
     *
     * `(ax, ay)` is the vector INTO this sample and `(bx, by)` the vector OUT
     * of it, so the angle between them is the TURN: **0 on a straight run, PI
     * at a hairpin**. The line here used to be
     *
     *     const deviation = Math.PI - angle      // "0 = full reversal, PI = straight"
     *     if (deviation > threshold) …
     *
     * which is the complement — the INTERIOR angle — compared against a
     * threshold expressed as a turn. Exactly backwards, and measured so:
     * a perfectly straight 200 px line returned ONE corner (index 4), a real
     * 90-degree elbow had its corner DISCARDED and a straight-run sample
     * reported in its place, and a 1.15-degree-per-step arc fired.
     *
     * The discard is the merge pass doing its job on a poisoned input: a
     * straight run scores PI (the strongest possible reading) while the true
     * corner scores PI/2, so the corner loses its own group. And because every
     * surviving "corner" then sat inside a straight run — where a Taubin pass
     * moves nothing, L(p) = 0 on collinear points — splitting the stroke there
     * was a no-op. That is why `preserveCorners` on and off produced identical
     * geometry on the `square` fixture and differed by at most 0.035 px on the
     * shipped hero word: a user-facing control that did nothing.
     *
     * ⚠ THIS IS THE SAME INVERSION `detectJoints3D` DOCUMENTS HAVING ALREADY
     * FIXED ONCE, in the same repo, in `lib/geometry-engines.ts`:
     * *"the joint test computed the interior angle and compared it as the turn,
     * so it fired on straight runs and went silent at hairpins."* It was fixed
     * in one place and left in the other. Written up in
     * docs/explainers/16-the-rim-and-the-bead.md §1.
     *
     * Proof, both directions: `scripts/verify/_probe-corner-predicate.mjs`
     * (a straight line must report 0, a 90-degree turn must report 1 AT the
     * turn — the pre-fix code fails both) and the gate `assert-corner-split.mjs`.
     */
    const turn = Math.acos(cosAngle)
    const strength =
      CORNER_TUNING.predicate === "interior" ? Math.PI - turn : turn
    if (strength > threshold) {
      candidates.push({ index: i, strength })
    }
  }

  if (candidates.length === 0) return []

  // Merge pass: walk candidates, group those within MERGE_DISTANCE,
  // keep the one with the highest strength in each group
  const merged: CornerCandidate[] = []
  let group: CornerCandidate[] = [candidates[0]]

  for (let i = 1; i < candidates.length; i++) {
    const prev = group[group.length - 1]
    const curr = candidates[i]
    const dist = cum[curr.index] - cum[prev.index]

    if (dist <= MERGE_DISTANCE) {
      group.push(curr)
    } else {
      // Flush group: keep the strongest
      group.sort((a, b) => b.strength - a.strength)
      merged.push(group[0])
      group = [curr]
    }
  }
  // Flush last group
  group.sort((a, b) => b.strength - a.strength)
  merged.push(group[0])

  return merged.map((c) => c.index)
}

/* ------------------------------------------------------------------ */
/*  Taubin (lambda|mu) smoothing — smooths WITHOUT shrinking.         */
/*                                                                    */
/*  The previous kernel was c*0.5 + (p+n)*0.25, i.e. a plain          */
/*  Laplacian pass with lambda = 0.5. Laplacian smoothing always      */
/*  pulls each point toward the chord between its neighbours, so      */
/*  every iteration SHRINKS the curve: arcs flatten, loops close up,  */
/*  and a tight curl drawn by hand comes out visibly smaller than     */
/*  what the user drew. Two iterations of it were measurably eating   */
/*  the gesture.                                                      */
/*                                                                    */
/*  Taubin's fix is to alternate a positive smoothing pass with a     */
/*  slightly larger NEGATIVE one, which re-inflates the shape:        */
/*                                                                    */
/*      p += lambda * L(p)     (smooth, shrinks)                      */
/*      p += mu     * L(p)     (un-shrink, mu < -lambda)              */
/*                                                                    */
/*  where L(p) = (prev + next)/2 - p. High-frequency tremor is        */
/*  removed by both passes; low-frequency shape survives because the  */
/*  two passes cancel there. The stability condition is               */
/*  1/lambda + 1/mu > 0, which mu = -0.53 against lambda = 0.5        */
/*  satisfies.                                                        */
/*                                                                    */
/*  Endpoints are always preserved — a stroke must start and end      */
/*  exactly where the hand did.                                       */
/* ------------------------------------------------------------------ */
const TAUBIN_LAMBDA = 0.5
const TAUBIN_MU = -0.53

function laplacianPass(pts: Point[], factor: number): Point[] {
  const next: Point[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i - 1]
    const c = pts[i]
    const n = pts[i + 1]
    // L = midpoint of neighbours minus this point.
    const lx = (p.x + n.x) * 0.5 - c.x
    const ly = (p.y + n.y) * 0.5 - c.y
    const hasPressure =
      c.pressure !== undefined && p.pressure !== undefined && n.pressure !== undefined
    next.push({
      x: c.x + factor * lx,
      y: c.y + factor * ly,
      t: c.t,
      pressure: hasPressure
        ? c.pressure! + factor * ((p.pressure! + n.pressure!) * 0.5 - c.pressure!)
        : c.pressure,
    })
  }
  next.push(pts[pts.length - 1])
  return next
}

function smoothPoints(points: Point[], iterations: number = 2): Point[] {
  if (points.length < 3) return [...points]

  let pts = points
  for (let iter = 0; iter < iterations; iter++) {
    pts = laplacianPass(pts, TAUBIN_LAMBDA)
    pts = laplacianPass(pts, TAUBIN_MU)
  }
  return pts
}

/* ------------------------------------------------------------------ */
/*  Smooth while preserving corners: split at corner indices,         */
/*  smooth each segment independently, then rejoin.                   */
/* ------------------------------------------------------------------ */
function smoothPreservingCorners(
  points: Point[],
  iterations: number,
  angleThresholdDeg: number,
  spacing: number
): { smoothed: Point[]; cornerCount: number; corners: number[] } {
  if (points.length < 3) return { smoothed: [...points], cornerCount: 0, corners: [] }

  const corners = detectCorners(points, angleThresholdDeg, spacing)
  if (corners.length === 0) {
    return { smoothed: smoothPoints(points, iterations), cornerCount: 0, corners: [] }
  }

  // Build segments: [0..corner0], [corner0..corner1], ... [cornerN..end]
  const splitIndices = [0, ...corners, points.length - 1]
  const result: Point[] = []

  for (let s = 0; s < splitIndices.length - 1; s++) {
    const start = splitIndices[s]
    const end = splitIndices[s + 1]
    const segment = points.slice(start, end + 1)

    const smoothed = smoothPoints(segment, iterations)

    // Avoid duplicating junction points
    if (s === 0) {
      result.push(...smoothed)
    } else {
      result.push(...smoothed.slice(1))
    }
  }

  /* `corners` are indices into `points`, and `result` has the same length —
   * every segment contributes `end - start` points after the junction dedup —
   * so they index `result` too. `processStroke` carries them forward to the
   * final resample, which would otherwise grid straight over them. */
  return { smoothed: result, cornerCount: corners.length, corners }
}

/**
 * Re-locate kept vertices after a pass that CHANGES THE POINT COUNT.
 *
 * `kinematicsPass` maps 1:1, so indices survive it. `handFeelPass` does not —
 * RDP thins the anchors and the endpoint pass can extend the ends — so a corner
 * index taken before it means nothing after it.
 *
 * They are carried across by ARC-LENGTH FRACTION, which is not a new idea here:
 * it is the same shared coordinate `handFeelPass` already uses to carry `t` and
 * `pressure` across the same discontinuity, and which its own comment traces to
 * Desk Doodles' `samplePressure`. The nearest output vertex to each corner's
 * fraction is the one to pin.
 *
 * Returns [] when there is nothing to carry, so the caller's resample takes the
 * unchanged single-span path.
 */
function carryKeepIndices(src: Point[], keep: number[], dst: Point[]): number[] {
  if (keep.length === 0 || dst.length < 3) return []
  if (dst === src || dst.length === src.length) return keep
  const srcCum = cumulativeArcLength(src)
  const srcTotal = srcCum[srcCum.length - 1]
  const dstCum = cumulativeArcLength(dst)
  const dstTotal = dstCum[dstCum.length - 1]
  if (!(srcTotal > 0) || !(dstTotal > 0)) return []
  const out: number[] = []
  for (const i of keep) {
    const f = srcCum[i] / srcTotal
    let best = 1
    let bestErr = Infinity
    for (let j = 1; j < dst.length - 1; j++) {
      const e = Math.abs(dstCum[j] / dstTotal - f)
      if (e < bestErr) {
        bestErr = e
        best = j
      }
    }
    out.push(best)
  }
  return out
}

/* ------------------------------------------------------------------ */
/*  Combined pipeline                                                 */
/* ------------------------------------------------------------------ */
export function processStroke(
  stroke: Stroke,
  spacing: number,
  smooth: boolean,
  preserveCorners: boolean = true,
  angleThresholdDeg: number = 45,
  /** Path-axis hand-feel. Omit (or pass wobble 0) for the previous behaviour —
   *  this argument is additive and every existing call site is unchanged. */
  handFeel: HandFeelSettings = HAND_FEEL_OFF
): ProcessedStroke {
  if (stroke.points.length < 2)
    return { points: [...stroke.points], cornerCount: 0 }

  const resampled = resampleStroke(stroke.points, spacing)

  const handFeelOn = handFeelEngaged(handFeel)
  const kinematicsOn = handFeel.kinematics?.enabled ?? handFeelOn

  if (!smooth) {
    // Hand-feel still applies with smoothing off — the wobble field is what
    // makes the mark read authored, and it is orthogonal to whether we removed
    // capture tremor first. Re-resample after, for the same even-grid reason
    // documented below.
    if (!handFeelOn && !kinematicsOn) return { points: resampled, cornerCount: 0 }
    const kin = kinematicsPass(resampled, handFeel)
    const felt = handFeelOn ? handFeelPass(kin, handFeel) : kin
    return {
      points: restampTimeByArcLength(resampleStroke(felt, spacing), kin),
      cornerCount: 0,
    }
  }

  // Smoothing moves points off the arc-length grid the resample just built.
  // Every downstream engine assumes roughly even spacing — Rod's tube
  // cross-sections, Solid's rasteriser, and Inflate's loft all sample the
  // point list directly — so uneven spacing shows up as wobbling tube radius
  // and stair-stepped contours. Re-resampling AFTER smoothing restores the
  // even grid while keeping the smoothed shape.
  //
  // The hand-feel pass sits between the two, for exactly the same reason and
  // in the same place Desk Doodles puts it: smoothing kills capture tremor
  // (their comment: "remove input micro-jitter at gentle-curve segments so
  // wobble=0 reads clean"), and only THEN is a deliberate seeded wobble laid
  // on top. Doing it the other way round would smooth the wobble straight back
  // out. The final re-resample restores the even grid the engines require —
  // note that it does NOT flatten the wobble, because the wobble field has a
  // 35-90px wavelength while the resample grid is 4px.
  //
  // The KINEMATIC pass sits between the smoothing and the wobble, and the
  // order is forced by what each stage owns:
  //   · smoothing first, because the model reads virtual targets off the path
  //     and capture tremor would put spurious targets in the action plan;
  //   · kinematics before wobble, because the model must reconstruct the
  //     velocity of the path THE HAND DREW, not of a path a noise field has
  //     since displaced — and because the wobble deliberately moves anchors
  //     off the reconstructed trajectory, which the model would otherwise
  //     read back as curvature that was never executed.
  // The two axes stay orthogonal: kinematics owns width and timing, wobble
  // owns path (Desk Doodles' locked invariant I-11).
  if (preserveCorners) {
    const { smoothed, cornerCount, corners } = smoothPreservingCorners(
      resampled,
      2,
      angleThresholdDeg,
      spacing
    )
    const kin = kinematicsPass(smoothed, handFeel)
    const felt = handFeelOn ? handFeelPass(kin, handFeel) : kin
    /* THE CORNERS ARE CARRIED INTO THE RESAMPLE, not left behind in it. Pinning
     * a corner through the smoother and then laying an even grid over it makes
     * the corner's survival a matter of where the grid happens to land — see
     * `resampleStroke`'s note and the 0.105 r swing it measures. */
    const keep = carryKeepIndices(smoothed, corners, felt)
    /* `kin` and not `felt`: `felt` is what RDP left, and reading `t` off a
     * handful of anchors is the linearisation this is here to undo. See
     * `restampTimeByArcLength`. */
    return {
      points: restampTimeByArcLength(resampleStroke(felt, spacing, keep), kin),
      cornerCount,
    }
  }

  const plain = smoothPoints(resampled, 2)
  const kin = kinematicsPass(plain, handFeel)
  const felt = handFeelOn ? handFeelPass(kin, handFeel) : kin
  return { points: restampTimeByArcLength(resampleStroke(felt, spacing), kin), cornerCount: 0 }
}

export function processAllStrokes(
  strokes: Stroke[],
  spacing: number,
  smooth: boolean,
  preserveCorners: boolean = true,
  handFeel: HandFeelSettings = HAND_FEEL_OFF
): ProcessedStroke[] {
  return strokes.map((s) =>
    processStroke(s, spacing, smooth, preserveCorners, 45, handFeel)
  )
}

/**
 * PUBLISH THE PARKED PRIORS TO THE PAGE.
 *
 * Same channel and same reason as `__implicitDefer` (`lib/implicit-defer.ts`)
 * and `__rodTuning` (`lib/geometry-engines.ts`): a parked prior that can only be
 * selected by editing a file is not reachable from a harness, and a negative
 * control nobody can run is a comment claiming one exists.
 *
 * This is what lets a browser gate attribute a geometry move to the corner fix
 * rather than assume it — flip `predicate` to `"interior"`, re-inject the same
 * strokes, and read the same numbers back. `scripts/verify/_probe-elbow-arms.mjs`
 * does exactly that.
 *
 * `globalThis` is guarded rather than `window` so this is inert under node and
 * under SSR; the objects are attached once, on module evaluation, and are the
 * live references, so a reader sees current values rather than a snapshot.
 */
if (
  typeof globalThis !== "undefined" &&
  typeof (globalThis as Record<string, unknown>).window !== "undefined"
) {
  ;(globalThis as unknown as Record<string, unknown>).__strokeTuning = {
    corner: CORNER_TUNING,
    resample: RESAMPLE_TUNING,
  }
}
