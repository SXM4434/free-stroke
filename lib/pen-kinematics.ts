/* ============================================================================
 * PEN KINEMATICS — SIGMA-LOGNORMAL VELOCITY RECONSTRUCTION
 *
 * PROVENANCE — three sources, chained. NONE of this is invented here.
 *
 *   1. THE MODEL — docs/research/handwriting-variability.md §2, sourced to
 *      Berio/Fol Leymarie/Plamondon (IGS 2017, EG 2018), Djioua & Plamondon
 *      (EPM-RT-2008-04), Lai & Jin (SynSig2Vec, AAAI 2020) and Carmona-Duarte
 *      et al. Every equation, every parameter range and every perturbation
 *      magnitude below is quoted from that doc, which quotes the papers.
 *
 *   2. THE VELOCITY → PRESSURE LAW — perfect-freehand (Steve Ruiz), the
 *      `simulatePressure` half of `getStrokeOutlinePoints`. PORTED, not
 *      re-derived; the 0.275 relaxation constant and the `1 - r` target come
 *      across verbatim. Desk Doodles cites this library for exactly this
 *      mechanism in docs/design/mark-intent-boundary-spec.md:136 —
 *          "perfect-freehand (Ruiz) — pressure simulation from velocity;
 *           why recorded pressure != rendered width"
 *      — but never shipped it: their own backlog entry (RUNNING-TODO-ARCHIVE
 *      -pre-2026-06-19.md:111) proposes "synthesize pseudo-pressure
 *      (velocity/curvature taper)" and the code that landed does the CURVATURE
 *      half only (`synthPressures`, strokeTo3d.ts:987 — ported into Free
 *      Stroke as `inflateSynthPressures`). The velocity half is the piece
 *      neither codebase has.
 *
 *   3. THE CONSUMER — already here. `inflateInkWidthProfile`
 *      (geometry-engines.ts:4859) reads `Point.pressure`, and its ported
 *      flat-channel guard treats a channel that varies by <= 0.02 as no
 *      channel at all. So a real varying channel written from here drives the
 *      existing Inflate width profile with no change to that file.
 *
 * ── WHY THIS EXISTS: THE TRACE RECORDS *WHERE*, NEVER *HOW FAST* ──
 *
 * The complaint is that the Inflate render of "Desk Doodles" reads as extruded
 * pipe. The most literal reading of that is the true one: every tube is very
 * nearly one radius from end to end. Width is the channel that carries hand,
 * and ours is empty:
 *
 *   /desk-doodles  timeStrokes() builds bare {x, y, t} — no pressure at all,
 *                  and `t` is SYNTHESISED at a flat 12 ms per point
 *                  (app/desk-doodles/page.tsx:110-126). Evenly spaced in time
 *                  AND evenly spaced in space, because processStroke
 *                  arc-length resamples. Constant speed by construction.
 *   /              writes a constant `pressure: 0.6` (app/page.tsx:190).
 *
 * With no varying channel, Inflate falls back to `inflateSynthPressures`,
 * which derives width from CURVATURE ALONE. That is a static geometric
 * property: the same glyph shape always produces the same width profile, so
 * the two `o`s of "Doodles" get byte-identical width. The research doc names
 * this failure mode directly — "regularity is the tell, not irregularity".
 *
 * The missing quantity is TIME. Sebs's traced logo records where the pen went
 * and nothing about how fast it went there; the arc-length resample then
 * destroys even the weak proxy that raw point spacing would have been. So
 * this file RECONSTRUCTS the kinematics from the geometry using the model the
 * handwriting-synthesis literature is built on, and hands the result to the
 * width profile that is already wired up.
 *
 * That is also why the curvature synth is the right thing to REPLACE rather
 * than to add to: curvature was standing in for speed the whole time. The
 * 2/3 power law (v = K*k^(-1/3)) says exactly that the two are coupled, and
 * the research doc is explicit that the coupling comes free from Sigma-
 * Lognormal and must NOT be imposed on top of it ("Implementing it on top
 * would double-count"). Speed subsumes curvature and adds what curvature can
 * never have: the temporal asymmetry of a real ballistic movement — the
 * acceleration out of the start, the deceleration into the end, and the
 * velocity dip at every co-articulated corner.
 *
 * ── FINDING #1, WHICH IS STRUCTURAL AND FREE ──
 *
 * From SynSig2Vec, quoted in the research doc §1:
 *
 *     R_D, R_t0, R_mu, R_sigma, R_theta_s, R_theta_e are uniform random
 *     variables that decide the signature distortion level, and are FIXED FOR
 *     ALL STROKES ACROSS A COMPONENT.
 *
 * One draw per rendered instance, shared by every stroke — a hand is in ONE
 * state for a whole word. Independent per-stroke randomisation is what makes
 * synthetic handwriting read as noise, because the variation has no shared
 * cause. `HandState` below is that one draw. `mu` and `sigma` in particular
 * are neuromuscular parameters of the WRITER, and the research doc's "what not
 * to do" list forbids randomising them per stroke.
 *
 * Note this does NOT make every stroke identical. Two instances of the same
 * glyph sit at different coordinates, so the trace of each differs slightly,
 * so their virtual targets, amplitudes and therefore speeds differ — genuine
 * contextual variation of the kind Graves describes (research doc §5), on top
 * of one shared hand.
 *
 * ── WHAT IS DELIBERATELY *NOT* BUILT HERE ──
 *
 * Endpoint undershoot and hooks (the research doc: "ΣΛ gives them"; building
 * them separately "would read as a repeated tic"), and the speed-curvature
 * coupling (same reason). Both fall out of the overlap parameter. Per-vertex
 * Gaussian noise is forbidden outright — "the most common failure and it reads
 * as damage". Path wander is NOT this file's axis either: that is the ported
 * Desk Doodles wobble field (lib/wobble-field.ts), which owns the path per
 * their locked invariant I-11 and runs AFTER this pass.
 * ========================================================================== */

import { rdpPoints, RDP_EPSILON, type Anchor } from "@/lib/wobble-field"
import { seededRandom } from "@/lib/hand-feel"

/* ------------------------------------------------------------------ */
/*  erf — Abramowitz & Stegun 7.1.26                                  */
/*                                                                    */
/*  The angular part of the model needs erf and JS has no Math.erf.   */
/*  The research doc notes "erf is in every standard library" — it is */
/*  not in this one. A&S 7.1.26 is the standard rational-times-       */
/*  Gaussian approximation, max absolute error 1.5e-7, which is four  */
/*  orders below anything visible in a 1100px-wide word.              */
/* ------------------------------------------------------------------ */
const ERF_A = [0.254829592, -0.284496736, 1.421413741, -1.453152027, 1.061405429]
const ERF_P = 0.3275911

export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + ERF_P * ax)
  let poly = 0
  for (let i = ERF_A.length - 1; i >= 0; i--) poly = (poly + ERF_A[i]) * t
  return sign * (1 - poly * Math.exp(-ax * ax))
}

/* ------------------------------------------------------------------ */
/*  THE HUMAN ENVELOPE — research doc §3, Djioua & Plamondon Table 1  */
/*                                                                    */
/*  "ranges fixed from typical features of rapid movements":          */
/*      mu     -2.2 .. -1.6                                           */
/*      sigma   0.1 ..  0.45                                          */
/*  Outside these is not a hand. The doc's "what not to do" list ends */
/*  with exactly this clamp, so it is enforced rather than trusted.   */
/*                                                                    */
/*  mu and t0 trade off directly — "never port a mu value between     */
/*  papers without porting its t0 convention too" — so the convention */
/*  is stated here once and used everywhere below: t0 is the command  */
/*  time, the lognormal's support is t - t0 in [e^(mu-3s), e^(mu+3s)],*/
/*  and t1 (its ONSET, when the stroke becomes active) is             */
/*  t0 + e^(mu-3s).                                                   */
/* ------------------------------------------------------------------ */
export const MU_MIN = -2.2
export const MU_MAX = -1.6
export const SIGMA_MIN = 0.1
export const SIGMA_MAX = 0.45

/** The doc's own worked sanity check: "mu = -1.9, sigma = 0.25 gives onset
 *  71 ms, peak 141 ms, end 317 ms — a 246 ms stroke, squarely inside that
 *  envelope [100-500 ms]." Taking the values it validates rather than picking
 *  a fresh pair means the nominal hand is a checked point, not a guess. */
export const MU_NOMINAL = -1.9
export const SIGMA_NOMINAL = 0.25

/* ------------------------------------------------------------------ */
/*  G1 PERTURBATION MAGNITUDES — research doc §3                      */
/*                                                                    */
/*  "Concrete G1 values for redrawing the same glyph: D +-2.5%,       */
/*   t0 +-2.1%, mu +-6.7%, sigma +-7.5%, angles +-0.1 rad."           */
/*                                                                    */
/*  G1 is "the same person on another day" — about a quarter of the   */
/*  SynSig2Vec admissible ranges, which were themselves established   */
/*  by a visual Turing test measuring where a character stops being   */
/*  recognisable. G2 ("a different person") is half to two thirds.    */
/*  G1 is what we want: this is one hand rendering its own logo.      */
/*                                                                    */
/*  Applied MULTIPLICATIVELY for scalars and ADDITIVELY for angles,   */
/*  per the doc.                                                      */
/* ------------------------------------------------------------------ */
export const G1_D = 0.025
export const G1_T0 = 0.021
export const G1_MU = 0.067
export const G1_SIGMA = 0.075
export const G1_ANGLE = 0.1 // radians

/* ------------------------------------------------------------------ */
/*  OVERLAP — the most visually consequential parameter               */
/*                                                                    */
/*  Research doc §6 ranks it second only to the shared draw, and §3   */
/*  gives it a named breaking point (Carmona-Duarte et al.):          */
/*                                                                    */
/*    "if the values of K_t becomes bigger than the time the          */
/*     lognormal is active, the superposition of the strokes is lost  */
/*     and the complete movement becomes a sequence of straight,      */
/*     independent movements."                                        */
/*                                                                    */
/*  The doc's verdict on that sentence: "That is what our geometry    */
/*  currently is." Delta-t is the reparameterised form — the next     */
/*  command fires after Delta-t of the previous stroke's duration, so */
/*  Delta-t = 1 is the failure case (no superposition at all) and     */
/*  smaller means more co-articulation. 0.5 is the default in Berio   */
/*  et al. EG 2018, which the research doc cites specifically for its */
/*  "Delta-t defaults".                                               */
/* ------------------------------------------------------------------ */
export const DELTA_T_DEFAULT = 0.5

/* ------------------------------------------------------------------ */
/*  perfect-freehand's velocity -> pressure law — PORTED VERBATIM     */
/*                                                                    */
/*  From dist/cjs/index.js, the function the library calls when       */
/*  `simulatePressure` is on:                                         */
/*                                                                    */
/*      function o(e,t,n){ let r = min(1, t/n);                       */
/*        return min(1, e + (min(1,1-r) - e) * (r * .275)) }          */
/*                                                                    */
/*  i.e. o(previousPressure, distanceSinceLastSample, size). Two      */
/*  things in it are the reason to port rather than write a fresh     */
/*  curve:                                                            */
/*                                                                    */
/*    · the target is `1 - r` where r is the step length in NIB       */
/*      WIDTHS. Fast pen = long step = low pressure = thin. Scale-    */
/*      free: it is speed relative to the pen, not absolute speed.    */
/*    · it RELAXES toward that target at rate `r * 0.275` rather than */
/*      snapping to it. So pressure LAGS speed, and lags harder when  */
/*      the pen is slow. That lag is ink-flow inertia, and it is what */
/*      stops the width profile from being a mirror of the speed      */
/*      curve — a mirror would read as a machine following a rule.    */
/*                                                                    */
/*  `min(1, 1-r)` is redundant for r >= 0; it is kept because the     */
/*  point of a port is that it stays diffable against the original.   */
/* ------------------------------------------------------------------ */
export const PF_PRESSURE_RATE = 0.275

export function pfSimulatePressure(prev: number, distance: number, size: number): number {
  const r = Math.min(1, distance / size)
  return Math.min(1, prev + (Math.min(1, 1 - r) - prev) * (r * PF_PRESSURE_RATE))
}

/**
 * The same law advanced over `ticks` pointer samples instead of exactly one.
 *
 * THIS IS THE ONE PLACE THE PORT HAD TO BE ADAPTED, AND THE REASON IS THE
 * SAME DEFECT THAT MOTIVATES THE WHOLE FILE.
 *
 * `pfSimulatePressure` is a per-SAMPLE relaxation, and perfect-freehand's
 * samples arrive on the pointer's clock. Free Stroke's points are ARC-LENGTH
 * resampled at a fixed 4px, so one of our points is not one pointer tick — it
 * is however many ticks the pen needed to cross 4px, which is many where the
 * pen is slow and few where it is fast. Running the law once per point
 * therefore relaxes far too slowly on short strokes (measured: a 14-point
 * stroke of the hero word moved its raw pressure by 0.07 over its whole
 * length, giving a channel a hair above the 0.02 flatness threshold that
 * would discard it) AND, worse, it relaxes at the same rate in the slow parts
 * as in the fast parts, which throws away the very asymmetry being
 * reconstructed.
 *
 * The fix keeps the library's constant and changes only how many times it is
 * applied. For a constant target the relaxation is geometric, so k
 * applications collapse exactly:
 *
 *     p_k = target + (p_0 - target) * (1 - rate)^k
 *
 * which is the closed form used below and is EXACT for integer k, not an
 * approximation of it — and continuous, so a fractional tick count works
 * without special-casing. Ticks are derived from the reconstructed time
 * between points, which is the quantity the model exists to produce.
 */
export function pfSimulatePressureOverTicks(
  prev: number,
  distance: number,
  size: number,
  ticks: number,
): number {
  const r = Math.min(1, distance / size)
  const rate = r * PF_PRESSURE_RATE
  if (!(rate > 0) || !(ticks > 0)) return prev
  const target = Math.min(1, 1 - r)
  const decay = Math.pow(1 - rate, Math.min(ticks, 4096))
  return Math.min(1, target + (prev - target) * decay)
}

/**
 * perfect-freehand's seed for the relaxation — its `re()`, which averages the
 * first ten samples pairwise so the very first sample cannot dominate the
 * whole stroke:
 *
 *     e.slice(0,10).reduce((e,r)=>{ let i=r.pressure;
 *       t && (i=o(e,r.distance,n)); return (e+i)/2 }, e[0].pressure)
 */
function pfSeedPressure(
  distances: Float64Array,
  ticks: Float64Array,
  size: number,
  first: number,
): number {
  let acc = first
  const n = Math.min(10, distances.length)
  for (let i = 0; i < n; i++) {
    const p = pfSimulatePressureOverTicks(acc, distances[i], size, ticks[i])
    acc = (acc + p) / 2
  }
  return acc
}

/**
 * The sample interval the `distance` in that law implicitly means.
 *
 * perfect-freehand consumes raw PointerEvent samples, which arrive on a clock,
 * so "distance since the last sample" IS a velocity — in px per pointer tick.
 * Our points are ARC-LENGTH resampled, so their spacing is a constant 4px and
 * carries no velocity whatever; that is precisely why the channel was flat.
 * We therefore supply the distance the pen WOULD have covered in one pointer
 * tick at the reconstructed speed: `v * PF_SAMPLE_DT`.
 *
 * 120 Hz is the real sampling rate of the trackpads and pen displays this app
 * is used on, and is the rate perfect-freehand's own defaults were tuned
 * against. It is a physical constant of the input device, not a fudge factor.
 */
export const PF_SAMPLE_HZ = 120
export const PF_SAMPLE_DT = 1 / PF_SAMPLE_HZ

/* ------------------------------------------------------------------ */
/*  THE ONE SHARED DRAW — research doc §1                             */
/* ------------------------------------------------------------------ */

/**
 * One hand, in one state, for a whole rendered instance.
 *
 * Every field here is drawn ONCE and applied to EVERY stroke. That is the
 * single biggest finding in docs/research/handwriting-variability.md and it
 * costs nothing: "Implement it as one RNG seed per rendered instance -> one
 * draw of the perturbation tuple -> applied to every stroke in that instance."
 */
export interface HandState {
  /** Log time delay. Neuromuscular; belongs to the writer, never the stroke. */
  mu: number
  /** Log response time. Also the roundness axis (research doc §6, item 5). */
  sigma: number
  /** Multiplicative amplitude perturbation, G1 +-2.5%. */
  dScale: number
  /** Multiplicative perturbation on the inter-command interval, G1 +-2.1%. */
  t0Scale: number
  /** Co-articulation: next command fires after this fraction of the previous
   *  stroke's active duration. Smaller = more superposition. */
  overlap: number
  /** Additive bias on each component's arc central angle, G1 +-0.1 rad. The
   *  angle perturbation is applied to CURVATURE rather than to absolute
   *  direction on purpose: a shared additive bias on direction is a global
   *  rotation of the whole word, which the research doc files separately under
   *  "global affine" and caps at ~1.8deg, well under 0.1 rad. As a bias on the
   *  arc it is "this hand curves its strokes a little more today", which is
   *  what a shared hand-state parameter should mean. */
  deltaBias: number
  /** Ink-flow gain on the width channel for this instance. NOT from the
   *  kinematics papers, which model motion only; it is here because the 2025
   *  synthesis survey names "probable inconsistencies in inking" as a
   *  perceptual give-away alongside shape regularity, and because a pen's flow
   *  really is one state for one sitting. Centred on 1. */
  inkFlow: number
  /** The seed this state was drawn from. Carried so it can be reported. */
  seed: number
}

/** Default instance seed. Fixed, so the same text renders identically —
 *  required by the capture/verify frame-diff pipeline, and the property
 *  research doc §5 recommends keeping ("same text renders identically, which
 *  matters for diffing, caching and tests"). */
export const DEFAULT_HAND_SEED = 20260729

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v)

/**
 * Draw one hand state. ONE call per rendered instance, shared by every stroke.
 *
 * Uses the same seeded LCG as the ported Desk Doodles hand-feel so there is
 * one RNG in the codebase and their invariant I-7 ("all randomness derives
 * from a deterministic seed; no Math.random() outside the seeded RNG") holds
 * across both layers.
 */
export function drawHandState(seed: number = DEFAULT_HAND_SEED): HandState {
  const r = seededRandom(seed)
  const sym = (amount: number) => (r() - 0.5) * 2 * amount
  return {
    mu: clamp(MU_NOMINAL * (1 + sym(G1_MU)), MU_MIN, MU_MAX),
    sigma: clamp(SIGMA_NOMINAL * (1 + sym(G1_SIGMA)), SIGMA_MIN, SIGMA_MAX),
    dScale: 1 + sym(G1_D),
    t0Scale: 1 + sym(G1_T0),
    overlap: DELTA_T_DEFAULT,
    deltaBias: sym(G1_ANGLE),
    inkFlow: 1 + sym(G1_D),
    seed,
  }
}

/* ------------------------------------------------------------------ */
/*  THE ACTION PLAN                                                   */
/* ------------------------------------------------------------------ */

/** One lognormal command: a ballistic sub-movement toward a virtual target. */
interface Component {
  /** Amplitude — the distance the command intends to cover. */
  D: number
  /** Direction of the chord to the virtual target. */
  theta: number
  /** Central angle of the circular arc the command traces. The only shape
   *  knob in the model (research doc §2). Signed. */
  delta: number
  /** Command time. Support is t - t0 in [e^(mu-3s), e^(mu+3s)]. */
  t0: number
}

/**
 * Largest central angle a single component may carry.
 *
 * At exactly PI the component is a semicircle, which is the most any single
 * ballistic sub-movement is asked to do in the source literature. Past it the
 * chord/arc relation folds back on itself (the arc leaves and re-enters the
 * same side) and `2*sin(delta/2)` heads for zero, so the closed form below
 * blows up. Capped just under to keep the divisor honest.
 */
const DELTA_MAX = Math.PI * 0.92

/**
 * Central angle of the circular arc that best matches the source path between
 * two virtual targets, from the SAGITTA.
 *
 * For a circular arc of chord `c` and maximum perpendicular deviation `h`:
 *     c = 2R sin(delta/2)      h = R (1 - cos(delta/2))
 * Dividing kills R and gives, exactly,
 *     delta = 4 * atan(2h / c)
 * (Check: a semicircle has h = c/2, so delta = 4*atan(1) = PI.)
 *
 * This is what keeps round letters round. With `delta` left at 0 every
 * component is a straight chord between RDP anchors, and the `o`s of
 * "Doodles" come out as polygons. Measuring it off the source path means the
 * reconstruction reproduces the curvature the hand actually drew instead of
 * inventing its own.
 */
function deltaFromSagitta(pts: Anchor[], a: number, b: number): number {
  const ax = pts[a][0]
  const ay = pts[a][1]
  const cx = pts[b][0] - ax
  const cy = pts[b][1] - ay
  const chord = Math.hypot(cx, cy)
  if (!(chord > 1e-6) || b - a < 2) return 0
  const ux = cx / chord
  const uy = cy / chord
  let best = 0
  for (let k = a + 1; k < b; k++) {
    // Signed perpendicular offset from the chord (2D cross product).
    const h = ux * (pts[k][1] - ay) - uy * (pts[k][0] - ax)
    if (Math.abs(h) > Math.abs(best)) best = h
  }
  if (Math.abs(best) < 1e-6) return 0
  return clamp(4 * Math.atan((2 * best) / chord), -DELTA_MAX, DELTA_MAX)
}

/* ------------------------------------------------------------------ */
/*  THE RECONSTRUCTION                                                */
/* ------------------------------------------------------------------ */

export interface PenKinematicsOptions {
  /** The one shared draw. Same object for every stroke in the instance. */
  hand: HandState
  /**
   * Nib DIAMETER in the same coordinate space as the points. Two jobs: it is
   * perfect-freehand's `size` (the law is speed measured in nib widths), and
   * it sets the nominal amplitude that puts a typical component at the law's
   * neutral point — see NOMINAL_AMPLITUDE_NIBS.
   */
  nibDiameter: number
  /**
   * How much of the co-articulated Sigma-Lognormal trajectory to blend over
   * the source path, 0..1. 0 leaves the path exactly as drawn and takes only
   * the width channel.
   */
  coarticulation: number
  /** Half-range of the pressure excursion about the neutral 0.5. */
  inkModulation: number
}

export interface PenKinematics {
  /** One entry per input point. Positions after the co-articulation blend. */
  points: Anchor[]
  /** One entry per input point. 0..1, neutral 0.5 — the channel
   *  `inflateInkWidthProfile` consumes. */
  pressure: Float32Array
  /** One entry per input point. Reconstructed time, normalised 0..1 over the
   *  stroke, so a caller can re-time its own `t` channel without changing the
   *  stroke's total duration. */
  timeNorm: Float32Array
  /** Diagnostics, for the assertion script and the explainer. */
  stats: {
    components: number
    durationSec: number
    peakSpeed: number
    meanSpeed: number
    /** max - min of the emitted pressure channel. Must exceed
     *  INFLATE_PRESSURE_FLAT_EPS (0.02) or the consumer discards it. */
    pressureSpread: number
    /** Largest distance any point moved due to co-articulation, in px. */
    maxCoarticulationShift: number
  }
}

/**
 * Nominal component amplitude, in nib diameters — the amplitude that lands a
 * component at perfect-freehand's neutral pressure (r = 0.5, pressure 0.5).
 *
 * This is the one number in this file that is CALIBRATED here rather than
 * quoted, and it needs to be, because it is the bridge between two scales the
 * papers never had to relate: the model's amplitudes are in px and the
 * pressure law's are in nib widths.
 *
 * A per-stroke normalisation (divide each stroke's speed by its own median)
 * was written first and thrown away, because it is WRONG in a way that is
 * worth recording: for a single-component stroke the Sigma-Lognormal speed is
 * exactly `D * g(f)` where `g` depends only on mu and sigma, so dividing by
 * the stroke's own median cancels D and hands EVERY simple stroke the
 * identical width profile. That is the regularity the research doc names as
 * the tell. The reference has to be shared across the word for the width
 * channel to say anything about a stroke relative to its neighbours — short
 * strokes slower and fatter, long sweeps faster and thinner.
 *
 * MEASURED, not guessed. Run over the real traced "Desk Doodles" logo through
 * the real processStroke pipeline (scripts/verify/assert-pen-kinematics.mjs
 * reprints these), the 93 RDP components of the word are, in nib diameters:
 *
 *     p10 0.69 · p25 0.89 · MEDIAN 1.55 · p75 2.07 · p90 3.19
 *
 * so the median is 1.55 and the value below is that. It is startlingly small,
 * and it is not an error in this file — it is the finding the previous port
 * already recorded (docs/research/desk-doodles-handfeel-port.md, "the pen is
 * enormous"): the hero ink is ~22.6px against a ~120px cap height, roughly a
 * fifth of it, where Desk Doodles' reference line is ~1% of its shapes. A
 * component of a letter is barely longer than the pen is wide. That is worth
 * knowing on its own — it is most of why the marks read as pipe — but it does
 * not change what this constant has to be: whatever the pen's weight, the
 * neutral has to sit where the word actually is, or the whole word drifts to
 * one end of the law and the modulation flattens against a clamp.
 *
 * Being nib-RELATIVE rather than absolute is what makes it survive the
 * Thickness dial: move the dial and the neutral moves with it, so the width
 * modulation stays centred instead of the whole word going uniformly fatter.
 */
export const NOMINAL_AMPLITUDE_NIBS = 1.55

/** Samples per component on the time grid. The trajectory is evaluated on a
 *  uniform time grid and then re-read by arc length, so this only has to be
 *  fine enough that the arc-length inversion is smooth. */
const SAMPLES_PER_COMPONENT = 32
const MIN_SAMPLES = 128
const MAX_SAMPLES = 4096

/**
 * Reconstruct the pen kinematics of one already-processed stroke.
 *
 * Returns null when there is nothing honest to say — fewer than two virtual
 * targets, a degenerate path, or a trajectory that failed to advance. Callers
 * must leave the stroke alone in that case rather than substitute a default,
 * so a stroke this model cannot describe is never silently damaged by it.
 */
export function reconstructPenKinematics(
  points: Anchor[],
  opts: PenKinematicsOptions,
): PenKinematics | null {
  const n = points.length
  if (n < 3) return null

  const { hand } = opts
  const { mu, sigma } = hand

  /* --- 1. Virtual targets ------------------------------------------------
   * RDP at the canonical epsilon, the same stage and the same constant the
   * wobble field needs in front of it (lib/wobble-field.ts header). Here it
   * has a second, model-level meaning: the virtual targets of a Sigma-
   * Lognormal action plan ARE the corners of the intended movement, and RDP
   * is exactly "the points you cannot drop without changing the shape". */
  const targets = rdpPoints(points, RDP_EPSILON)
  if (targets.length < 2) return null

  // Map each target back to its index in the source, so the sagitta can be
  // measured over the sub-path it spans. rdpPoints returns the SAME array
  // elements it was given (it only slices), so identity holds; the coordinate
  // comparison is a belt-and-braces fallback.
  const idx: number[] = []
  let cursor = 0
  for (const t of targets) {
    let found = -1
    for (let i = cursor; i < n; i++) {
      if (points[i] === t || (points[i][0] === t[0] && points[i][1] === t[1])) {
        found = i
        break
      }
    }
    if (found < 0) return null
    idx.push(found)
    cursor = found
  }
  if (idx[idx.length - 1] !== n - 1) idx[idx.length - 1] = n - 1

  /* --- 2. The action plan ------------------------------------------------
   * Research doc §2, reparameterised form:
   *     sigma_i = sqrt(-ln(1 - Ac_i))      (we carry sigma directly)
   *     mu_i    = ln(T_i) - ln(2 sinh(3 sigma_i))
   *     t0_i    = t1_i - exp(mu_i - 3 sigma_i)
   *     t1_i    = t1_{i-1} + T_{i-1} * dt_i
   *
   * Reading the mu line the other way round gives the active duration of one
   * lognormal in closed form, T = 2 e^mu sinh(3 sigma). It depends only on the
   * WRITER's mu and sigma, not on the amplitude — which is the model saying
   * that a bigger stroke is executed faster rather than for longer. That is
   * where the cross-stroke width variation comes from, and it is why mu and
   * sigma had to be shared: if they were per-stroke, every stroke would take
   * its own time and the comparison between strokes would mean nothing. */
  const T = 2 * Math.exp(mu) * Math.sinh(3 * sigma)
  const onsetOffset = Math.exp(mu - 3 * sigma)
  const tailOffset = Math.exp(mu + 3 * sigma)
  const interOnset = T * hand.overlap * hand.t0Scale

  const comps: Component[] = []
  for (let i = 1; i < idx.length; i++) {
    const a = idx[i - 1]
    const b = idx[i]
    const dx = points[b][0] - points[a][0]
    const dy = points[b][1] - points[a][1]
    const D = Math.hypot(dx, dy) * hand.dScale
    if (!(D > 1e-6)) continue
    const raw = deltaFromSagitta(points, a, b)
    // The shared angle perturbation biases the arc rather than the direction —
    // see HandState.deltaBias. Scaled by the arc's own sign so a straight
    // component stays straight (a bias applied to a zero arc would bend every
    // straight stroke by the same amount, which reads as a tic).
    const delta = clamp(raw * (1 + hand.deltaBias), -DELTA_MAX, DELTA_MAX)
    const t1 = comps.length * interOnset
    comps.push({ D, theta: Math.atan2(dy, dx), delta, t0: t1 - onsetOffset })
  }
  if (comps.length === 0) return null

  /* --- 3. Evaluate the closed form on a uniform time grid ---------------
   * Research doc §2, verbatim:
   *     theta0_i = theta_i + (pi + delta_i) / 2
   *     |delta| > 1e-10:
   *       d_i(t) = D_i * [ (cos(theta0_i - delta_i w_i) - cos theta0_i)
   *                          / (2 sin(delta_i/2)),
   *                        (sin(theta0_i - delta_i w_i) - sin theta0_i)
   *                          / (2 sin(delta_i/2)) ]
   *     else:
   *       d_i(t) = D_i * [ cos(theta_i) w_i, sin(theta_i) w_i ]
   *     p(t) = p0 + SUM_i d_i(t)
   * with the weight w_i(t) the lognormal's own CDF:
   *     w_i(t) = 1/2 [ 1 + erf( (ln(t - t0_i) - mu) / (sigma sqrt 2) ) ]
   * No integration anywhere — that is the point of the closed form. */
  const tStart = 0
  const tEnd = comps[comps.length - 1].t0 + tailOffset
  const span = tEnd - tStart
  if (!(span > 0)) return null

  const S = clamp(comps.length * SAMPLES_PER_COMPONENT, MIN_SAMPLES, MAX_SAMPLES)
  const dt = span / (S - 1)
  const px = new Float64Array(S)
  const py = new Float64Array(S)
  const sqrt2 = Math.SQRT2

  const theta0s = comps.map((c) => c.theta + (Math.PI + c.delta) / 2)
  const halfSin = comps.map((c) => 2 * Math.sin(c.delta / 2))

  for (let k = 0; k < S; k++) {
    const t = tStart + k * dt
    let x = points[0][0]
    let y = points[0][1]
    for (let i = 0; i < comps.length; i++) {
      const c = comps[i]
      const dtt = t - c.t0
      if (dtt <= 1e-9) continue
      const w = 0.5 * (1 + erf((Math.log(dtt) - mu) / (sigma * sqrt2)))
      if (Math.abs(c.delta) > 1e-10) {
        const th0 = theta0s[i]
        const div = halfSin[i]
        x += (c.D * (Math.cos(th0 - c.delta * w) - Math.cos(th0))) / div
        y += (c.D * (Math.sin(th0 - c.delta * w) - Math.sin(th0))) / div
      } else {
        x += c.D * Math.cos(c.theta) * w
        y += c.D * Math.sin(c.theta) * w
      }
    }
    px[k] = x
    py[k] = y
  }

  /* --- 4. Speed and arc length along the reconstruction ------------------ */
  const speed = new Float64Array(S)
  const cum = new Float64Array(S)
  for (let k = 1; k < S; k++) {
    cum[k] = cum[k - 1] + Math.hypot(px[k] - px[k - 1], py[k] - py[k - 1])
  }
  for (let k = 0; k < S; k++) {
    // Central difference where it exists, one-sided at the ends.
    const lo = Math.max(0, k - 1)
    const hi = Math.min(S - 1, k + 1)
    speed[k] = (cum[hi] - cum[lo]) / ((hi - lo) * dt)
  }
  const totalArc = cum[S - 1]
  if (!(totalArc > 1e-6)) return null

  /* --- 5. Read the reconstruction back onto the SOURCE points ------------
   * Cumulative arc-length fraction is the shared coordinate between the two
   * point lists — the same coordinate the ported pressure resampler uses
   * (geometry-engines.ts inflateResampleScalar) and the same one Desk
   * Doodles' samplePressure uses (strokeTo3d.ts:951). It is the right one
   * here for a specific reason: with co-articulation on, the reconstructed
   * trajectory is SHORTER than the source (it cuts corners), so anything
   * index-based or absolute-length-based would drift along the stroke. */
  const srcCum = new Float64Array(n)
  for (let i = 1; i < n; i++) {
    srcCum[i] = srcCum[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1])
  }
  const srcTotal = srcCum[n - 1]
  if (!(srcTotal > 1e-6)) return null

  const outPts: Anchor[] = new Array(n)
  const outSpeed = new Float64Array(n)
  const timeNorm = new Float32Array(n)
  let maxShift = 0
  let walk = 0
  for (let i = 0; i < n; i++) {
    const target = (srcCum[i] / srcTotal) * totalArc
    while (walk < S - 2 && cum[walk + 1] < target) walk++
    const a = cum[walk]
    const b = cum[walk + 1]
    const f = b > a ? clamp((target - a) / (b - a), 0, 1) : 0
    const rx = px[walk] + (px[walk + 1] - px[walk]) * f
    const ry = py[walk] + (py[walk + 1] - py[walk]) * f
    outSpeed[i] = speed[walk] + (speed[walk + 1] - speed[walk]) * f
    timeNorm[i] = (walk + f) / (S - 1)

    const g = clamp(opts.coarticulation, 0, 1)
    const ox = points[i][0] + (rx - points[i][0]) * g
    const oy = points[i][1] + (ry - points[i][1]) * g
    const shift = Math.hypot(ox - points[i][0], oy - points[i][1])
    if (shift > maxShift) maxShift = shift
    outPts[i] = [ox, oy]
  }

  /* --- 6. Speed -> pressure, via the ported perfect-freehand law ---------
   * `distance` is what the pen covers in one pointer tick at the
   * reconstructed speed. `size` is the nib. Both in the same px space, so
   * `r = distance/size` is speed measured in nib widths per tick, exactly the
   * quantity the library's constant was tuned against.
   *
   * The neutral is set by NOMINAL_AMPLITUDE_NIBS rather than by the stroke's
   * own statistics — see that constant for why a per-stroke normalisation is
   * actively wrong here. */
  const nib = opts.nibDiameter > 1e-6 ? opts.nibDiameter : 1
  // Speed that a nominal component reaches; scaling the law's input so that
  // this speed lands at r = 0.5 puts a typical component of the word at the
  // law's neutral pressure. Peak speed of one lognormal of amplitude D is
  // D/(sigma sqrt(2pi)) * exp(sigma^2/2 - mu).
  const nominalD = NOMINAL_AMPLITUDE_NIBS * nib
  const peakFactor = Math.exp((sigma * sigma) / 2 - mu) / (sigma * Math.sqrt(2 * Math.PI))
  const nominalPeak = nominalD * peakFactor
  const distScale = nominalPeak > 1e-9 ? (0.5 * nib) / (nominalPeak * PF_SAMPLE_DT) : 1

  const dists = new Float64Array(n)
  const ticks = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    dists[i] = outSpeed[i] * PF_SAMPLE_DT * distScale
    // How many pointer ticks this point is worth — the reconstructed time
    // since the previous point, in units of one 120 Hz sample. See
    // pfSimulatePressureOverTicks for why this is not simply 1.
    const prev = i > 0 ? timeNorm[i - 1] : timeNorm[0]
    ticks[i] = Math.max(0, (timeNorm[i] - prev) * span) / PF_SAMPLE_DT
  }

  const raw = new Float64Array(n)
  let p = pfSeedPressure(dists, ticks, nib, 0.5)
  for (let i = 0; i < n; i++) {
    p = pfSimulatePressureOverTicks(p, dists[i], nib, ticks[i])
    raw[i] = p
  }

  /* --- 7. Re-centre to a MODULATION -------------------------------------
   * perfect-freehand's pressure sets the absolute radius; ours must not,
   * because Thickness is a user dial and stealing it would make the dial lie.
   * So the channel is re-expressed as a modulation about the consumer's
   * neutral 0.5, keeping the SHAPE of the curve (including the lag, which is
   * the character) and discarding only its absolute level.
   *
   * The half-range is fixed rather than normalised per stroke, for the same
   * reason the neutral is: normalising per stroke would give every stroke the
   * same swing and erase exactly the between-stroke difference this is for. */
  const pressure = new Float32Array(n)
  let pmin = Infinity
  let pmax = -Infinity
  const gain = opts.inkModulation * hand.inkFlow
  for (let i = 0; i < n; i++) {
    const v = clamp(0.5 + (raw[i] - 0.5) * 2 * gain, 0.02, 0.98)
    pressure[i] = v
    if (v < pmin) pmin = v
    if (v > pmax) pmax = v
  }

  let sum = 0
  let peak = 0
  for (let i = 0; i < n; i++) {
    sum += outSpeed[i]
    if (outSpeed[i] > peak) peak = outSpeed[i]
  }

  return {
    points: outPts,
    pressure,
    timeNorm,
    stats: {
      components: comps.length,
      durationSec: span,
      peakSpeed: peak,
      meanSpeed: sum / n,
      pressureSpread: pmax - pmin,
      maxCoarticulationShift: maxShift,
    },
  }
}
