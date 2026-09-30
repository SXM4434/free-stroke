/* ============================================================================
 * STROKE SCHEDULE — WHEN each piece of the mark gets drawn.
 *
 * WHAT THIS FILE IS FOR, IN ONE SENTENCE: `lib/pen-reveal.ts` answers "how much
 * of the word has the pen drawn at time t"; this file answers "and WHICH part of
 * it", which is the half the app never had.
 *
 * Sebs, 2026-08-04: *"we basically have not built the animation portion of this
 * tool… I have no way of keyframing, editing any of the motion of the strokes
 * outside of the textures… as if you were someone in control of the pen through
 * a motion tool."* `docs/animation-toolset-map.md` is the map he gated; this is
 * step 1 of the build order in its §8, and `DRAW IN` (§8's smallest first slice)
 * is step 2.
 *
 * ── THE MODEL, AND WHY IT IS THIS ONE ───────────────────────────────────────
 *
 * A schedule is a **per-stroke TRANSLATION of the arc axis at slope 1**, then
 * ONE global normalisation. Stroke `i` covers as-drawn global arc `[from, to]`
 * of length `L`; the schedule gives it an unnormalised start `u`, so it occupies
 * `[u, u + L]`; with `T = max(u + L)` the map is
 *
 *     S(a)  =  (u_i + (a − a_i)) / T          for a inside stroke i
 *
 * Three consequences, and every cheap thing below is one of them:
 *
 *   1. **`dS/da = 1/T` is a GLOBAL CONSTANT.** Every stroke keeps the pen's own
 *      speed inside itself and only its START moves. That is Sebs's own pick 4
 *      — *"ride it… the modifier reshapes WHEN each stroke's beat happens, not
 *      what happens inside it"* (map §9) — expressed as arithmetic rather than
 *      as a promise.
 *
 *      🔴 IT IS ALSO THE ANSWER TO THE ONE TRAP THE MAP FLAGS IN RED. The pen
 *      tip's boundary is a per-fragment test against the tip field's `arc`
 *      channel — `when = arc + (1 − nose)·√(1 − ρ²) + taper·ρ`
 *      (`lib/pen-reveal.ts:446`) — whose `nose` and `taper` are quoted in ARC
 *      FRACTION via `radiusArc`. Remap the keys and not the tip and the nose
 *      detaches from the stroke it is drawing. Because the slope is one number
 *      for the whole word, the tip needs the SAME remap on its `arc` channel and
 *      then two UNIFORM multiplications — `back`/`taper` by `scale`, `arcToLocal`
 *      by `1/scale` — instead of a third texture channel. A non-uniform slope
 *      (per-stroke SPEED, which is step 3+) does need that channel; see
 *      `uniformSlope` below, which is asserted rather than assumed.
 *
 *   2. **The drawn set stays a PREFIX of a sorted array.** `S` is increasing
 *      inside every stroke, so `{ triangle : S(arc) ≤ playhead }` is exactly the
 *      first `k` triangles once they are sorted by `S(arc)` — which is the
 *      mechanism explainer 18 already pays for (`setDrawRange` + one binary
 *      search). Zero shader work, zero geometry rebuild, no new render path.
 *      Map §6.2: *"a prefix of a sorted array is exactly the set of triangles
 *      whose key ≤ the playhead."*
 *
 *   3. **`order: asDrawn` + `overlap: 0` is the IDENTITY, exactly.** Not
 *      "close": `u_i = from_i` and `T = 1`, so `S(a) = a` for every `a`, and
 *      `identity` below is computed rather than declared. Every consumer skips
 *      itself when it is true, so at the shipped default **not one line of this
 *      feature executes** and today's render is reproduced byte for byte. That
 *      is the negative control the map §8 demands, and it is a property of the
 *      wiring rather than of a test.
 *
 * ── WHAT RIDES THE BEAT AND WHAT RIDES THE STROKE — stated, not glossed ─────
 *
 * The playhead handed to a scheduled reveal is unchanged: it is still
 * `revealDistanceFraction(strokes, t, mode, blend)`, the hand's own monotone
 * time→travel curve. The schedule decides WHICH ink sits at each position along
 * that travel. So under a reorder the word's pacing — the hesitations, the
 * flicks — stays attached to the BEAT and not to the stroke that happens to be
 * drawing.
 *
 * ⚠ THAT IS A REAL LIMIT AND IT IS NOT AN ACCIDENT. Making a stroke carry its
 * own recorded DURATION into a new position needs the pen record re-timed per
 * stroke, which is a different quantity from anything this file computes.
 * **Blender's Build modifier hits the same wall and says so in its own docs**:
 * *"Natural Drawing Speed: Use the recorded speed of the stylus when the strokes
 * were drawn"* is *"Only available in Sequential and Additive"* — never in
 * Concurrent (`docs/research/stroke-animation-toolsets.md` §1). Ours is the same
 * restriction one step earlier, and it is named in the panel copy rather than
 * left for a user to discover.
 *
 * ── UNITS: GROUPS ARE FIRST CLASS ──────────────────────────────────────────
 *
 * Sebs's pick 2, verbatim from the map §9: *"both — group by default, stroke on
 * request."* His traced word measures **8 groups, not 11 letters**, because his
 * hand fused `e-s-k` and `o-d`. So the schedulable unit is a GROUP of strokes
 * (`lib/hero-letters.ts` `assignLetters`, connected components under "each one's
 * centreline lies inside the other's ink"), and a group can be opened to its
 * strokes with one pill. A unit's members keep their relative offsets inside the
 * unit's slot, so opening a group never moves the ink, it only adds rows.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT DO ────────────────────────────────
 *
 * · No keyframes, no dock, no tracks UI. Step 4 of the map's build order; this
 *   is the model a dock would be a VIEW of (map §8: *"a timeline with nothing to
 *   show is a worse product than no timeline"*).
 * · The window LANDED, and this bullet used to deny it. It read "No window
 *   (`start`/`end`/`travel`/per-stroke reverse). Step 3." while sitting 117
 *   lines above `§1b · THE WINDOW` in this same file, and nobody struck it when
 *   the code arrived. What is still true is the SHAPE of what landed: four
 *   mutually exclusive modes, not two independent edges, because a prefix
 *   cannot express un-drawing (map §6.2) so `windowAt()` derives `lo` by rule
 *   instead of exposing it. Cavalry's `Start` is the one of its five we do not
 *   have yet. This bullet used to call that permanent because "two
 *   independently keyframed edges would be two clocks". STRUCK 2026-09-25 by
 *   his ruling (`docs/rulings/2026-09-25-animation-comes-back.md`): a keyed
 *   curve sampled from `clock` is still one clock, and export stays a pure
 *   function of it. Per-stroke delay, speed, ease and hold back now live in
 *   `lib/stroke-timing.ts`, which keys each triangle by its arrival time on the
 *   take's clock; keyed edges are phase 3 of
 *   `docs/research-2026-09-25/animation-tools/DESIGN.md`.
 * · No post-arrival motion (settle, wobble, secondary). Step 7, and it needs the
 *   per-stroke TRANSFORM machinery, which exists only for letters and is capped
 *   at **`FS_LETTER_MAX = 16`** (`components/viewport-3d.tsx`, find by name; this
 *   citation carried `:2678` until 2026-08-28, by which time it had drifted 361
 *   lines). Noted here
 *   so step 7 does not discover the cap late: a 40-stroke drawing does not fit a
 *   `uniform vec4[16]`, and the options are a data texture, per-owner draw calls,
 *   or grouping — for which the unit model above is already the law.
 * · Nothing is shaped around DialKit. Its own bundle says
 *   *"TODO(production): … then remove `useDialTimeline`"* (map §6.6), so it is a
 *   developer's tuning dock and the end-user surface is built, not bought.
 * ========================================================================== */

import type { Point, ProcessedStroke } from "@/lib/stroke-processing"
import { strokeArcSpans, type StrokeArcSpan } from "@/lib/pen-reveal"

/* ==========================================================================
 * §1 · THE DIALS
 * ======================================================================== */

/**
 * In what ORDER the units are laid down.
 *
 * `asDrawn` is the recording and is the default. The other four are the first
 * control every serious tool ships (map §4 ①) and the one the PRD's Layer 3
 * list calls *"stroke order controls"* (line 69-72).
 *
 * `byPosition` is Blender's *Object* ordering — *"use the distance to an object
 * to define the order in which strokes appear"* — with the object fixed at the
 * mark's left edge, because a tappable anchor is a step-3 control and a dial
 * whose anchor cannot be moved should not pretend it can.
 */
export type StrokeOrder = "asDrawn" | "reversed" | "byLength" | "byPosition" | "random"

/**
 * Blender's **Time Alignment**, verbatim: *"Align Start — All strokes start at
 * the same time (i.e. shorter strokes finish earlier)"* vs *"Align End — All
 * strokes end at the same time (i.e. shorter strokes start later)."*
 *
 * It is a separate control from `overlap` for the reason the research doc gives:
 * *"one makes the word land like a chord; the other makes it ravel out."* It has
 * no meaning at `overlap = 0`, where exactly one unit is ever drawing, and the
 * panel disables it there rather than leaving a control on screen that does
 * nothing — the same rule explainer 06 §3 applies to the stack's Direction dial.
 */
export type ScheduleAlign = "start" | "end"

/** See the UNITS block in the header. */
export type ScheduleUnitMode = "group" | "stroke"

/**
 * PER-UNIT REVERSE — Cavalry's *Reverse Path*, which is the fourth row of its
 * stroke-reveal API (`Trim ✓ · Start · End · Travel · Reverse Path`, read off
 * the live UI in `docs/verification/anim-map/vids/cavalry-strokes/`).
 *
 * ⚠ IT IS A SCHEDULE PROPERTY AND NOT A WINDOW ONE, and the distinction is the
 * whole reason it lives in this interface rather than in `RevealWindowParams`.
 * A window is an INTERVAL over `S`; a reverse changes `S` ITSELF — it flips the
 * direction the arc axis is traversed inside a track. So it belongs to the map,
 * with everything that follows from that (the keys, the tip field's bake, the
 * sort, the rebuild clip) rather than to the thing that reads the map.
 *
 *   `off`        the recording's own direction. **The shipped default.**
 *   `all`        every unit draws from its far end back to where the pen began.
 *   `alternate`  units alternate direction in the order they are laid down —
 *                the word snakes, which neither Cavalry nor Blender offers and
 *                which is free here because the flip is per track.
 *
 * ⚠ WHAT "REVERSING A GROUP" MEANS, STATED RATHER THAN LEFT TO BE DISCOVERED.
 * A unit's members are packed back to back inside its slot, so reversing a unit
 * flips BOTH the direction inside each stroke AND the order of the members in
 * the slot. At `order: asDrawn` there is no packed slot — every stroke keeps its
 * own recorded span, because *"a grouping cannot change what the recording
 * was"* — so there the flip is per STROKE and the member order is the
 * recording's. That is not an inconsistency to be tidied away: `asDrawn` means
 * the recording, and the recording has no group slots to reverse.
 */
export type ReverseMode = "off" | "all" | "alternate"

export interface DrawInParams {
  order: StrokeOrder
  /**
   * 0 = strictly one unit at a time (Blender *Sequential*, After Effects
   * *Individually*); 1 = every unit draws across the whole beat (Blender
   * *Concurrent*, AE *Simultaneously*). **The continuous blend between them is
   * ours** — neither reference offers it, both ship the binary.
   */
  overlap: number
  align: ScheduleAlign
  unit: ScheduleUnitMode
  /** Only read by `order: "random"`. A seed, so a shuffle is reproducible. */
  seed: number
  /** See `ReverseMode`. `off` is the recording and is the shipped default. */
  reverse: ReverseMode
}

/**
 * THE SHIPPED DEFAULT IS THE IDENTITY, AND THAT IS THE POINT.
 *
 * `unit: "group"` is Sebs's pick 2 and it is free here: with `asDrawn` +
 * `overlap 0` the unit mode cannot change a single number, because `asDrawn`
 * takes every stroke's own recorded span rather than re-packing it (see
 * `buildStrokeSchedule` step 3). So the default that ships is byte-identical to
 * the app before this feature existed, on every engine, and the group/stroke
 * pill only starts to matter once a second dial has been moved.
 */
export const DRAW_IN_DEFAULTS: DrawInParams = {
  order: "asDrawn",
  overlap: 0,
  align: "start",
  unit: "group",
  seed: 1,
  reverse: "off",
}

/* ==========================================================================
 * §1b · THE WINDOW — the reveal stops being a PREFIX
 *
 * ── WHAT IT IS, IN ONE SENTENCE ────────────────────────────────────────────
 *
 * The drawn set becomes `{ x : lo < S(x) <= hi }` — an INTERVAL in scheduled
 * space — where today it is `{ x : S(x) <= playhead }`, the interval whose `lo`
 * happens to be pinned at 0. That is the entire model change, and everything
 * cheap about it follows from the same fact the prefix rested on: **a
 * contiguous range of a sorted array is exactly the set whose key falls in an
 * interval**, so it is TWO binary searches where it was one
 * (`docs/animation-toolset-map.md` §8, naming this slice: *"it is two binary
 * searches instead of one on the `setDrawRange` path"*).
 *
 * ── THE BEAT DRIVES THE EDGES TODAY; KEYED EDGES ARE NOT RULED OUT ────────
 *
 * Cavalry exposes `Start` and `End` as two animatable properties. We do not
 * yet: the dial is which RULE the edges follow, and the beat moves them.
 * `lib/export/frame-plan.ts` still requires the whole animation to stay **a
 * pure function of one clock**, since the export *"decides up front exactly
 * which instants it wants"*.
 *
 * This block used to go further and say keyed edges would be "two clocks".
 * STRUCK 2026-09-25 by his ruling (`docs/rulings/2026-09-25-animation-comes-back.md`):
 * a keyed curve sampled from `clock` is one clock, and export stays a pure
 * function of it. The model that replaces the argument is `lib/stroke-timing.ts`:
 * each triangle's key is its ARRIVAL TIME on the take's clock, so per-stroke
 * delay, speed, ease and hold back are baked into the keys and the window still
 * reads a sorted array. Export samples it with `sampleTake(timed, clockMs)`.
 *
 * ── THE FOUR, AND WHAT EACH ONE IS ────────────────────────────────────────
 *
 *   grow     [0, d]                    the prefix. **THE IDENTITY.** Unchanged.
 *   travel   [d(1+L) − L, d(1+L)]      a segment of length L running the whole
 *                                      mark — the pen draws and the ink
 *                                      evaporates behind it. Cavalry's *Travel*
 *                                      with a length neither reference exposes
 *                                      as a continuous dial.
 *   vanish   [d, 1]                    Blender's *Vanish*, its own words:
 *                                      *"simulating ink fading or vanishing
 *                                      after getting drawn"* — the ink you laid
 *                                      FIRST goes first.
 *   shrink   [0, 1 − d]                Blender's *Shrink*, *"simulating lines
 *                                      being erased"* — the ink you laid LAST
 *                                      goes first.
 *
 * `length` is live only under `travel`, and the panel disables it elsewhere
 * rather than leaving a control on screen that cannot act — explainer 06 §3's
 * rule, the same one `align` already follows at `overlap 0`.
 *
 * ── ONE WINDOW FOR THE WORD, NOT ONE PER STROKE ───────────────────────────
 *
 * The interval lives in the BEAT's space, so `overlap` and the window compose
 * for free: at `overlap 1` every unit occupies the same stretch of `S`, so one
 * travelling window puts a travelling segment on every unit at once. A per-unit
 * window would be a second scheduling model beside this one, which is this
 * repo's most expensive recurring defect stated in its own words.
 * ======================================================================== */

export type RevealWindowMode = "grow" | "travel" | "vanish" | "shrink"

export interface RevealWindowParams {
  mode: RevealWindowMode
  /** The travelling window's width, as a fraction of the beat. `travel` only. */
  length: number
  /** RUNTIME ONLY, never persisted: set by the viewport when the take loops with
   *  no delay. See `windowAt`'s travel branch. Absent means false. */
  seamless?: boolean
}

/**
 * THE SHIPPED DEFAULT IS THE PREFIX, EXACTLY.
 *
 * `grow` puts `lo` at 0 for every playhead, and every consumer branches on
 * `full` (`lo <= 0`) rather than on the mode name — so at the default the
 * trailing binary search is not run, the trailing fragment test is not
 * compiled in (its uniform is 0), and `setDrawRange` is handed the same two
 * arguments it was handed before this file grew a window.
 */
export const REVEAL_WINDOW_DEFAULTS: RevealWindowParams = {
  mode: "grow",
  length: 0.25,
}

/* ═══ THE PLAYBACK ENVELOPE ════════════════════════════════════════════════
 *
 * The four dials that shape HOW the beat runs, as opposed to which ink is
 * where inside it. `DrawInParams` decides the schedule; this decides the clock
 * that reads it.
 *
 * ⚠ THESE LIVED INSIDE `components/viewport-3d.tsx` AS FOUR LOOSE `useState`
 * CALLS UNTIL 2026-08-28, and that is why they were the one part of the take a
 * reload threw away: `app/page.tsx` held `drawIn` and `revealWindow` and had no
 * name for these, so `lib/doc-store.ts` could not persist what the page could
 * not see. They are one object here for the same reason the other two are one
 * object each — a document field, a preset patch and a gate all need something
 * to point at.
 *
 * `ease` is the envelope over the WHOLE reveal and is not the pen's own speed;
 * Natural / Authentic shapes the pace within the beat and the two compose.
 * Every member's default is the behaviour that shipped before these controls
 * existed, so a fresh session renders byte-identically to before.
 */
export type RevealEasePreset = "linear" | "in" | "out" | "inOut"
/**
 * A curve he shapes himself (DRAWIN-CURVE), the handles of a CSS
 * `cubic-bezier(x1, y1, x2, y2)`. x stays in 0..1 so time runs forward; y is
 * free, so a handle can overshoot. `easeReveal` clamps the result to 0..1 and
 * never lets it run backwards, because a draw-in only ever adds ink.
 */
export interface RevealCurve {
  x1: number
  y1: number
  x2: number
  y2: number
}
export type RevealEase = RevealEasePreset | RevealCurve

/* ═══ THE CADENCE — ones or twos ═══════════════════════════════════════════
 *
 * `twos` samples the animation clock at a fixed rate instead of every frame, so
 * each state is HELD for a whole step. `hero-motion.ts` states why it matters:
 * it is *"a deliberate hand-animation cadence and it is a large part of why the
 * film reads as drawn rather than rendered. It costs nothing to reproduce:
 * sample the animation clock at 12 Hz."* The maker of `origami-crane-fold` says
 * the same thing in his own words, *"I normaly animate at 24fps. I just think it
 * gives the animation a special look"*, and the measurement found strict
 * alternation before that description was read.
 *
 * `ones` is a new state every frame and is the default, so a session that never
 * touches this renders exactly as it did before the dial existed. */
export type RevealCadence = "ones" | "twos"

/** Hand-animation standard. 12 steps a second, the value the hero beat ships. */
export const CADENCE_HZ = 12

/**
 * ⚠ THIS ARITHMETIC EXISTS TWICE ON PURPOSE, AND THE REASON IS WORTH READING.
 *
 * `quantiseHeroTime` in `lib/hero-motion.ts` is the same line wrapped in the
 * hero beat's phase logic. The obvious move is to have it call this one, and
 * that move is WRONG: `lib/hero-motion.ts` has ZERO imports, deliberately,
 * because it emits a paste-able block for `scripts/capture/motion.mjs` and
 * `assert-motion-paste.mjs` reconciles the two. An import would break a
 * contract that a gate is holding.
 *
 * So this is a knowing duplicate rather than an accidental one. If the law
 * changes, both change, and `assert-drawin-timing.mjs` and the cadence
 * assertions are the two places that would catch a half-step disagreement.
 *
 * Returns `tSec` unchanged when the rate is not positive, so a bad value cannot
 * silently freeze the clock at its anchor.
 */
export function quantiseToCadence(tSec: number, hz: number, anchor = 0): number {
  if (!(hz > 0)) return tSec
  return anchor + Math.floor((tSec - anchor) * hz) / hz
}

/* Natural / Authentic. The two the transport offers; `smooth` is a THIRD
 * `RevealMode` that exists only behind the Debug pill and inside the compare
 * harness, and it is deliberately not a member here. A diagnostic phase must
 * never be able to land in the document as the user's take, so the viewport
 * runs those through a transient override instead of through this field. */
export type RevealPace = "hybrid" | "raw"

/* WHICH CLOCK the pace reads (HAND-DRAW, 2026-09-26). `recorded` is the
 * timestamps he drew with, untouched, and it is main byte for byte. `hand` is
 * Desk Doodles' pen model, `stampPenClock(points, "lognormal")`, re-stamped on
 * the processed points in app/page.tsx: slower into corners, a short lift inside
 * a letter and a longer one between words. A separate axis from the pace, so
 * Natural over the hand stays a real combination. */
export type RevealClock = "recorded" | "hand"
export const REVEAL_CLOCK_LABELS: Record<RevealClock, string> = { recorded: "Recorded", hand: "Hand" }

/* THE PLAYBACK RATE (HAND-DRAW-3, 2026-09-26). The one global rate: every `t`
 * the viewport, the strip and the take read is divided by it, in the clock memo
 * in app/page.tsx, so 2 plays the same drawing in half the time. A RATE and not
 * a fixed length, because a fixed length would crush a long drawing and stretch
 * a short one. 1 hands back the same arrays, so every preset that leaves it
 * alone is main. The take's per-stroke `speed` is a different thing: it moves
 * one stroke inside the take and the rate moves the whole clock. */
export const REVEAL_RATE_MIN = 0.25
export const REVEAL_RATE_MAX = 8

export interface RevealEnvelopeParams {
  /** How the pen's own recorded pace is read. `hybrid` is Natural, the shipped
   *  default; `raw` is Authentic, the recording untouched. */
  mode: RevealPace
  /** Which timestamps the pace reads: his own, or the modelled hand's. */
  clock: RevealClock
  /** Playback rate over the whole clock. 1 is the clock as it is. */
  rate: number
  /** `twos` holds each state for a whole 12 Hz step. `ones` is every frame. */
  cadence: RevealCadence
  /** Envelope over the whole reveal. NOT the per-stroke pen speed. */
  ease: RevealEase
  /** Seconds of stillness before the reveal starts, and between loops. */
  delaySeconds: number
  /** Start again on reaching the end. */
  loop: boolean
  /** Play the draw backwards, so the mark un-draws. */
  reverse: boolean
  /** DRAWIN-EXTRAS · a glow on the pen's moving end, 0..1. 0 is off and mounts
   *  nothing, so it is main. `lib/tip-highlight.ts`. */
  tipHighlight: number
}

export const REVEAL_ENVELOPE_DEFAULTS: RevealEnvelopeParams = {
  mode: "hybrid",
  clock: "recorded",
  rate: 1,
  cadence: "ones",
  ease: "linear",
  delaySeconds: 0,
  loop: false,
  reverse: false,
  tipHighlight: 0,
}

export interface RevealWindow {
  /** Trailing edge, scheduled space. Ink at or below this is NOT drawn. */
  lo: number
  /** Leading edge, scheduled space. Ink above this is not drawn yet. */
  hi: number
  /** `lo <= 0` — there is no trailing edge, so every trailing cost is skipped. */
  openBack: boolean
  /** `lo <= 0 && hi >= 1` — the whole mark. */
  whole: boolean
  /** `hi <= lo` — nothing at all. */
  empty: boolean
  /** True only for `grow`: this window IS the prefix the app shipped. */
  identity: boolean
  /** THE SECOND PART. `1` means there is none. Below 1, the window ALSO holds
   *  `[wrapLo, 1]`: a looping Travel's tail still leaving the end of the word
   *  while its head enters the start. Only a seamless Travel past its opening
   *  pass sets it. Read it through `windowParts`, never `lo`/`hi` alone: a
   *  consumer that reads one interval draws the head and drops the tail. */
  wrapLo: number
}

/** The travelling window's width is clamped away from 0, because a
 *  zero-width window is a mark that never appears and a dial that renders
 *  nothing at one end is a dial nobody can use. */
export const WINDOW_MIN_LENGTH = 0.02

export function windowAt(p: RevealWindowParams, playhead: number, opening = false): RevealWindow {
  const d = playhead < 0 ? 0 : playhead > 1 ? 1 : playhead
  let lo = 0
  let hi = d
  let wrapLo = 1
  if (p.mode === "travel") {
    const L = Math.max(WINDOW_MIN_LENGTH, Math.min(1, p.length))
    /* F95 then F118, THE LOOP SEAM. The once-through head runs 0 to 1+L, so the
     * pass starts and ends on an empty page by construction. Looping with no
     * delay that put a near-empty page on every seam (13 rAF frames under 2% of
     * the word's ink at travel 25%, night-w/before). Lane W then ran the head L
     * to 1, which kept the segment full length but swapped it whole at the seam,
     * [1-L, 1] to [0, L]: 5.4% to 49.4% of the hero word's ink in one frame.
     *
     * THE TRUE WRAP. A seamless pass runs the head 0 to 1, one word length per
     * pass, and the tail `head - L` wraps round the end: `[0, h]` plus
     * `[1 + h - L, 1]` while `h < L`. The window at d = 0 and at d = 1 is the
     * same set, `[1-L, 1]`, so the seam frame moves exactly as far as any other.
     *
     * `opening` is the first forward pass of a Play from the start: it writes in
     * from an empty page, no tail, and ends on `[1-L, 1]`, which is where the
     * first wrapped pass begins. The caller knows the pass; this function does
     * not keep state. */
    if (p.seamless) {
      const tail = d - L
      hi = d
      lo = tail > 0 ? tail : 0
      if (tail < 0 && !opening) wrapLo = 1 + tail
    } else {
      const head = d * (1 + L)
      hi = Math.min(1, head)
      lo = Math.max(0, head - L)
    }
  } else if (p.mode === "vanish") {
    lo = d
    hi = 1
  } else if (p.mode === "shrink") {
    lo = 0
    hi = 1 - d
  }
  const openBack = !(lo > 0)
  return {
    lo,
    hi,
    openBack,
    whole: openBack && (hi >= 1 || wrapLo <= hi),
    empty: hi <= lo && wrapLo >= 1,
    identity: p.mode === "grow",
    wrapLo,
  }
}

/** THE ONE WAY TO READ A WINDOW. One part, two, or none, in beat space, each
 *  `[a, b]` with `a < b`. Every consumer that draws loops over this. */
export function windowParts(win: RevealWindow): [number, number][] {
  const out: [number, number][] = []
  if (win.hi > win.lo) out.push([win.lo, win.hi])
  if (win.wrapLo < 1) out.push([win.wrapLo, 1])
  return out
}

/** THE ONE PLACE `seamless` IS DECIDED. A looping Travel with no delay wraps;
 *  with a delay, the delay is the blank beat and the once-through mapping stays.
 *  Called once in `Viewport3D` and handed down, so the frame loop, the harness,
 *  the export ends and the rest playhead all read the same window. */
export function effectiveWindow(
  p: RevealWindowParams,
  play: { loop: boolean; delaySeconds: number },
): RevealWindowParams {
  return p.mode === "travel" && play.loop && !(play.delaySeconds > 0) ? { ...p, seamless: true } : p
}

/** Where "show it finished" sits for a window: the playhead whose window is as
 *  complete as the mode ever gets. A seamless Travel is `[1-L, 1]` at 1. */
export function restPlayheadFor(p: RevealWindowParams): number {
  if (p.mode === "vanish" || p.mode === "shrink") return 0
  if (p.mode === "travel") return p.seamless ? 1 : 1 / (1 + Math.max(WINDOW_MIN_LENGTH, Math.min(1, p.length)))
  return 1
}

export function windowSig(p: RevealWindowParams): string {
  return p.mode === "travel" ? `travel:${p.length.toFixed(4)}${p.seamless ? ":seamless" : ""}` : p.mode
}

export const WINDOW_LABELS: Record<RevealWindowMode, string> = {
  grow: "Grow",
  travel: "Travel",
  vanish: "Vanish",
  shrink: "Shrink",
}

export const WINDOW_NOTES: Record<RevealWindowMode, string> = {
  grow: "The pen draws and the ink stays. This is the shipped default and it renders exactly as before.",
  travel: "A segment of the mark runs the whole way through. Ink appears at the pen and evaporates behind it.",
  vanish: "The whole mark is there, then the ink you laid first disappears first.",
  shrink: "The whole mark is there, then it un-draws from the far end, back the way the pen came.",
}

/**
 * ⚠ THE LABELS NAME A PATH DIRECTION, NOT A TIME DIRECTION, AND THAT IS THE
 * WHOLE REASON THEY READ LIKE THIS.
 *
 * The first draft said `Forward` / `Backwards` / `Alternate`. Eight lines below
 * this control in the same popover sits the SHIPPED transport toggle labelled
 * **Reverse** — *"play the draw backwards, the mark un-draws"* — which is a
 * different thing entirely: it runs the CLOCK backwards over the whole word,
 * where this decides which END of each unit the pen starts from. Two controls
 * whose labels are near-synonyms, in one panel, doing different things, is the
 * mislabel defect this repo has a standing rule about: *a dial whose label does
 * not describe what renders is a defect.*
 *
 * `Start → end` and `End → start` cannot be read as a statement about time.
 */
export const REVERSE_LABELS: Record<ReverseMode, string> = {
  off: "Start → end",
  all: "End → start",
  alternate: "Alternating",
}

export const REVERSE_NOTES: Record<ReverseMode, string> = {
  off: "Every stroke draws the way your hand drew it. The shipped default.",
  all: "Every unit draws from its far end back to where the pen started.",
  alternate: "Units take turns. One forwards, the next backwards. The word snakes.",
}

/* ==========================================================================
 * §2 · THE SCHEDULE
 * ======================================================================== */

export interface ScheduleTrack {
  /** Index into the `ProcessedStroke[]` this track schedules. */
  stroke: number
  /** Which unit (group) it belongs to. Equal to `stroke` when unit = stroke. */
  unit: number
  /** The stroke's as-drawn global arc span — `strokeArcSpans`' own output. */
  from: number
  to: number
  /** Where the schedule puts it, in the SAME 0..1 playhead space. */
  start: number
  end: number
  /**
   * TRUE when this track is traversed BACKWARDS: `a = from` lands on `end` and
   * `a = to` lands on `start`.
   *
   * ⚠ `start < end` STILL, ALWAYS. The slot is an interval and it does not turn
   * inside out; only the direction the arc axis runs through it flips. Every
   * consumer that asks *"is this piece inside the window"* therefore keeps
   * comparing against an ordered pair, which is what leaves the drawn set a
   * contiguous range of a sorted array under a reverse.
   */
  reverse: boolean
}

export interface StrokeSchedule {
  /** One per stroke, in AS-DRAWN order. `tracks[i].stroke === i`, always. */
  tracks: ScheduleTrack[]
  /** How many distinct units the tracks fall into. */
  unitCount: number
  /**
   * `dS/da`. One number for the whole word — see consequence 1 in the header.
   * The tip field's `nose`/`taper` multiply by it and `arcToLocal` divides.
   */
  scale: number
  /**
   * `|dS/da| == scale` IN EVERY TRACK. False would mean a per-stroke SPEED is
   * in play and the tip needs a per-texel scale channel.
   *
   * ⚠ THE MAGNITUDE, AND THAT IS A REFINEMENT RATHER THAN A LOOSENING — read
   * this before trusting it. Step 2 computed `(end − start)/len`, which is
   * `+1/T` by construction and could not see a sign. Step 3's per-unit REVERSE
   * makes the real local slope `−1/T` inside a reversed track, and the old
   * expression would still have returned `+1/T` and reported "uniform" —
   * exactly the silent pass this field exists to prevent. So it is now sampled
   * off `scheduleArc` itself, signed, and the two facts are reported
   * separately: the magnitude here, the sign in `reversedCount`.
   *
   * The magnitude is what the pen tip's cheap fix actually rests on. `nose` and
   * `taper` are LENGTHS along the mark quoted in arc fraction, and a length
   * converts by `|dS/da|` whichever way the pen is running — which is why a
   * reverse costs the tip nothing once the field is baked through the schedule.
   */
  uniformSlope: boolean
  /** How many tracks are traversed backwards. 0 at the shipped default. */
  reversedCount: number
  /** `S(a) === a` for every `a`. Every consumer short-circuits on it. */
  identity: boolean
  params: DrawInParams
  /** Cache key. Changes whenever anything downstream would have to be redone. */
  sig: string
}

/* ==========================================================================
 * §3 · BUILDING ONE
 * ======================================================================== */

/**
 * Mulberry32 — 32 bits of state, uniform output, and deterministic from a seed.
 *
 * Written out rather than imported because a shuffle whose order changes
 * between a capture and its assertion is a gate that cannot fail honestly, and
 * `Math.random()` is exactly that. The same reason `handSeed` exists upstream.
 */
function seededRandom(seed: number): () => number {
  let a = (seed | 0) + 0x6d2b79f5
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The per-stroke anchor `byPosition` sorts on: the mean x of its points. */
export function strokePositions(strokes: readonly ProcessedStroke[]): number[] {
  return strokes.map((s) => {
    const pts = s.points
    if (pts.length === 0) return 0
    let sum = 0
    for (const p of pts) sum += p.x
    return sum / pts.length
  })
}

export interface ScheduleInput {
  /** `strokeArcSpans(strokes)`. */
  spans: readonly StrokeArcSpan[]
  /**
   * Group id per stroke — `assignLetters(...).of`. Null, or a length that does
   * not match, falls back to one unit per stroke. Guarded rather than trusted
   * for the reason `assignLetters` guards its own seed: *"a seed that does not
   * line up with the strokes is worse than none."*
   */
  unitOf: readonly number[] | null
  /** `strokePositions(strokes)`. Only read by `order: "byPosition"`. */
  positionOf: readonly number[] | null
}

const EPS = 1e-9

export function buildStrokeSchedule(input: ScheduleInput, params: DrawInParams): StrokeSchedule {
  const spans = input.spans
  const n = spans.length
  const p: DrawInParams = {
    order: params.order,
    overlap: Math.max(0, Math.min(1, params.overlap)),
    align: params.align,
    unit: params.unit,
    seed: params.seed | 0,
    reverse: params.reverse ?? "off",
  }

  if (n === 0) {
    return {
      tracks: [],
      unitCount: 0,
      scale: 1,
      uniformSlope: true,
      reversedCount: 0,
      identity: true,
      params: p,
      sig: `n0|${sigOf(p)}`,
    }
  }

  const len = new Float64Array(n)
  for (let i = 0; i < n; i++) len[i] = Math.max(0, spans[i].to - spans[i].from)

  /* ---- 1 · units -------------------------------------------------------- */
  const useGroups =
    p.unit === "group" && !!input.unitOf && input.unitOf.length === n
  const uidRaw = new Int32Array(n)
  for (let i = 0; i < n; i++) uidRaw[i] = useGroups ? input.unitOf![i] | 0 : i

  // Renumber to dense 0..U-1 in FIRST-APPEARANCE order. `assignLetters` numbers
  // its components left to right; the schedule must not inherit a reading order
  // it did not ask for, because `asDrawn` means the hand's order and nothing
  // else.
  const uidOf = new Int32Array(n)
  const seen = new Map<number, number>()
  for (let i = 0; i < n; i++) {
    let u = seen.get(uidRaw[i])
    if (u === undefined) {
      u = seen.size
      seen.set(uidRaw[i], u)
    }
    uidOf[i] = u
  }
  const unitCount = seen.size

  /** Members of each unit, in as-drawn order. */
  const members: number[][] = Array.from({ length: unitCount }, () => [])
  for (let i = 0; i < n; i++) members[uidOf[i]].push(i)

  const unitLen = new Float64Array(unitCount)
  /** Offset of each stroke INSIDE its unit — members packed back to back. */
  const offsetIn = new Float64Array(n)
  for (let u = 0; u < unitCount; u++) {
    let acc = 0
    for (const i of members[u]) {
      offsetIn[i] = acc
      acc += len[i]
    }
    unitLen[u] = acc
  }

  /* ---- 2 · the order the units are laid down in -------------------------- */
  const unitOrder = orderUnits(members, unitLen, spans, input.positionOf, p)

  /* ---- 2b · which units run BACKWARDS -----------------------------------
   * `alternate` is indexed by the unit's position in the ORDER it is laid down
   * in, not by its id — a snake is about the sequence, and indexing by id would
   * make the same dial mean two different pictures under two different orders.
   * `unitOrder` is the natural order at `asDrawn`, so the two agree there. */
  const unitRev = new Uint8Array(unitCount)
  if (p.reverse !== "off") {
    for (let k = 0; k < unitOrder.length; k++) {
      unitRev[unitOrder[k]] = p.reverse === "all" ? 1 : k % 2 === 1 ? 1 : 0
    }
  }
  /* Reversing a unit flips the ORDER of its members inside the slot as well as
   * the direction inside each one — a group drawn backwards draws its last
   * stroke first. This touches only the PACKED coordinate, so at `asDrawn`
   * (where every stroke keeps its own recorded span) it has no effect and the
   * flip is per stroke. See `ReverseMode`. */
  for (let u = 0; u < unitCount; u++) {
    if (!unitRev[u]) continue
    for (const i of members[u]) offsetIn[i] = unitLen[u] - offsetIn[i] - len[i]
  }

  /* ---- 3 · sequential starts -------------------------------------------- */
  /* `asDrawn` takes every stroke's OWN recorded span rather than re-packing it.
   * That is not an optimisation, it is the definition: "as drawn" means the
   * recording, and a grouping cannot change what the recording was. It is also
   * what makes the identity EXACT for both unit modes — see DRAW_IN_DEFAULTS. */
  const seqStart = new Float64Array(n)
  if (p.order === "asDrawn") {
    for (let i = 0; i < n; i++) seqStart[i] = spans[i].from
  } else {
    let cursor = 0
    for (const u of unitOrder) {
      for (const i of members[u]) seqStart[i] = cursor + offsetIn[i]
      cursor += unitLen[u]
    }
  }

  /* ---- 4 · concurrent starts, and the alignment -------------------------- */
  let maxUnitLen = 0
  for (let u = 0; u < unitCount; u++) if (unitLen[u] > maxUnitLen) maxUnitLen = unitLen[u]
  const concStart = new Float64Array(n)
  for (let u = 0; u < unitCount; u++) {
    // Align START: every unit begins together, so a short one finishes early.
    // Align END: every unit lands together, so a short one starts late.
    const base = p.align === "end" ? maxUnitLen - unitLen[u] : 0
    for (const i of members[u]) concStart[i] = base + offsetIn[i]
  }

  /* ---- 5 · blend, re-zero, normalise ------------------------------------ */
  const ov = p.overlap
  const u0 = new Float64Array(n)
  let minU = Infinity
  for (let i = 0; i < n; i++) {
    const v = seqStart[i] * (1 - ov) + concStart[i] * ov
    u0[i] = v
    if (v < minU) minU = v
  }
  // The beat must START. At a partial overlap with `align: end` the earliest
  // unit can sit above zero, which would be a silent lead-in of blank page —
  // a thing the Timing panel's Delay control already owns and which must not
  // arrive twice, from two dials, meaning different things.
  if (!(minU < Infinity)) minU = 0
  let T = 0
  for (let i = 0; i < n; i++) {
    const e = u0[i] - minU + len[i]
    if (e > T) T = e
  }
  if (!(T > 0)) T = 1
  const invT = 1 / T

  const tracks: ScheduleTrack[] = new Array(n)
  let identity = true
  let reversedCount = 0
  for (let i = 0; i < n; i++) {
    const start = (u0[i] - minU) * invT
    const end = start + len[i] * invT
    const rev = unitRev[uidOf[i]] === 1
    if (rev) reversedCount++
    tracks[i] = {
      stroke: i,
      unit: uidOf[i],
      from: spans[i].from,
      to: spans[i].to,
      start,
      end,
      reverse: rev,
    }
    /* A REVERSED TRACK IS NEVER THE IDENTITY even when its slot has not moved:
     * the SLOT is the same interval, the MAP through it is not, and `identity`
     * is a claim about `S(a) === a` rather than about where the ink sits. */
    if (rev || Math.abs(start - spans[i].from) > EPS || Math.abs(end - spans[i].to) > EPS)
      identity = false
  }

  /* THE SLOPE, SAMPLED OFF `scheduleArc` RATHER THAN INFERRED FROM THE SLOT.
   *
   * Step 2 computed `(end − start)/len`, which is `+1/T` by construction and
   * therefore could not see a reverse — it would have reported "uniform" for a
   * track whose real slope is `−1/T`, which is precisely the silent pass
   * `uniformSlope` was built to make impossible. So the map is asked directly,
   * twice inside each track, and the SIGNED slope is what gets compared. The
   * tip's cheap conversion needs the MAGNITUDE (`nose` and `taper` are lengths,
   * and a length converts by `|dS/da|` whichever way the pen runs), so that is
   * what this asserts, with the sign reported separately in `reversedCount`.
   *
   * A zero-length stroke would divide by zero and is skipped rather than
   * allowed to answer. */
  const probe = { tracks, unitCount, scale: invT, uniformSlope: true, reversedCount, identity, params: p, sig: "" } as StrokeSchedule
  let uniformSlope = true
  for (let i = 0; i < n; i++) {
    if (len[i] <= EPS) continue
    const t = tracks[i]
    const aA = t.from + len[i] * 0.25
    const aB = t.from + len[i] * 0.75
    const s = (scheduleArc(probe, aB) - scheduleArc(probe, aA)) / (aB - aA)
    if (Math.abs(Math.abs(s) - invT) > 1e-6 || s === 0) {
      uniformSlope = false
      break
    }
    if (s < 0 !== t.reverse) {
      // The sign disagrees with the flag the tracks carry, which would leave
      // every consumer that branches on `reverse` describing a map it is not
      // reading. Refusing to call it uniform is the honest answer.
      uniformSlope = false
      break
    }
  }

  return {
    tracks,
    unitCount,
    scale: invT,
    uniformSlope,
    reversedCount,
    identity,
    params: p,
    sig: `n${n}|u${unitCount}|T${T.toFixed(9)}|${sigOf(p)}|a${spans[0].from.toFixed(6)}-${spans[
      n - 1
    ].to.toFixed(6)}`,
  }
}

function sigOf(p: DrawInParams): string {
  return `${p.order}|${p.overlap.toFixed(4)}|${p.align}|${p.unit}|${p.seed}|r${p.reverse ?? "off"}`
}

function orderUnits(
  members: number[][],
  unitLen: Float64Array,
  spans: readonly StrokeArcSpan[],
  positionOf: readonly number[] | null,
  p: DrawInParams,
): number[] {
  const U = members.length
  const idx: number[] = []
  for (let u = 0; u < U; u++) idx.push(u)
  switch (p.order) {
    case "reversed":
      return idx.reverse()
    case "byLength":
      // Shortest first. Ties keep as-drawn order — a stable tiebreak, because
      // `Array.prototype.sort` is stable in every engine this ships to and a
      // random tiebreak would make the same dial render two ways.
      return idx.sort((a, b) => unitLen[a] - unitLen[b] || a - b)
    case "byPosition": {
      if (!positionOf) return idx
      const key = (u: number) => {
        let sum = 0
        let cnt = 0
        for (const i of members[u]) {
          const v = positionOf[i]
          if (Number.isFinite(v)) {
            sum += v
            cnt++
          }
        }
        return cnt > 0 ? sum / cnt : Number.POSITIVE_INFINITY
      }
      const k = idx.map(key)
      return idx.sort((a, b) => k[a] - k[b] || a - b)
    }
    case "random": {
      // Fisher–Yates on the seeded generator, so the same seed is the same word.
      const rnd = seededRandom(p.seed)
      for (let i = U - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1))
        const t = idx[i]
        idx[i] = idx[j]
        idx[j] = t
      }
      return idx
    }
    default:
      // `asDrawn` never reaches step 3's packing, but the unit order is still
      // read by nothing else and returning the natural one keeps this total.
      void spans
      return idx
  }
}

/* ==========================================================================
 * §4 · READING ONE — the map itself
 * ======================================================================== */

/**
 * `S(a)`. As-drawn global arc fraction in, scheduled playhead position out.
 *
 * ⚠ VALUES ABOVE 1 PASS THROUGH UNCHANGED, and that is load-bearing rather than
 * defensive: the tip field writes **2** into its `arc` channel for a texel no
 * nib ever reached (`lib/pen-reveal.ts` `TipField.data[0]`, *"2 where nothing
 * reaches it at all"*). Mapping that sentinel into the beat would ink the paper.
 */
export function scheduleArc(sched: StrokeSchedule, a: number): number {
  if (sched.identity) return a
  const tr = sched.tracks
  const n = tr.length
  if (n === 0) return a
  if (!(a > 1)) {
    // Tracks are in as-drawn order and their `[from, to]` are contiguous and
    // ascending, so this is a plain lower bound on `to`.
    let lo = 0
    let hi = n - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (tr[mid].to < a) lo = mid + 1
      else hi = mid
    }
    const t = tr[lo]
    const span = t.to - t.from
    if (span <= 0) return t.reverse ? t.end : t.start
    const raw = (a - t.from) / span
    const r = raw < 0 ? 0 : raw > 1 ? 1 : raw
    /* A REVERSED TRACK RUNS THE SLOT BACKWARDS and nothing else changes: the
     * slot is still `[start, end]` with `start < end`, so a window test on the
     * OUTPUT is still an ordered comparison and the drawn set is still a
     * contiguous range of the sorted key array. */
    return t.reverse ? t.end - (t.end - t.start) * r : t.start + (t.end - t.start) * r
  }
  return a
}

/**
 * THE SCHEDULE AS A PER-STROKE AFFINE MAP — `S = m0 + m1·a` inside stroke `i`,
 * as `[m0, m1]` pairs.
 *
 * 🔴 THIS EXISTS FOR THE TIP FIELD, AND IT CLOSES A REAL HOLE IN STEP 2.
 * `buildTipField` answers *"when did the pen FIRST ink this texel"* by taking
 * the **minimum over the samples that cover it** — *"at a crossing the nearest
 * centreline is often the LATER stroke, and keying on it would un-draw ink the
 * pen had already laid"* (`lib/pen-reveal.ts` §T). That minimum is taken in the
 * RECORDING's arc, and step 2 then remapped the answer afterwards
 * (`remapTipFieldArc`).
 *
 * **`min` and a remap only commute when the remap is increasing over the whole
 * word**, and step 3 breaks that twice over: a REVERSED track is decreasing, so
 * the first sample in beat time is the one with the LARGEST recording arc; and
 * `unit: stroke` with a reorder can put a crossing's later stroke first. Remap
 * the minimum and the texel is keyed to the wrong sample — measured worst case
 * one nib DIAMETER of lag, which is the nose sitting off the ink, which is the
 * exact defect the map flags in red.
 *
 * The fix is to take the minimum in SCHEDULED space, and this is what makes it
 * affordable: the map is affine INSIDE a stroke, so its two coefficients are
 * constant for every one of that stroke's segments and hoist clean out of the
 * texel loop. Two floating-point operations per candidate, against a bake
 * measured at ~35 ms that runs on a dial change and never per frame.
 *
 * Returns null at the identity, so the shipped path takes no branch at all.
 */
export function scheduleArcCoeffs(sched: StrokeSchedule): Float64Array | null {
  if (sched.identity) return null
  const tr = sched.tracks
  const out = new Float64Array(tr.length * 2)
  for (let i = 0; i < tr.length; i++) {
    const t = tr[i]
    const span = t.to - t.from
    if (!(span > 0)) {
      out[i * 2] = t.reverse ? t.end : t.start
      out[i * 2 + 1] = 0
      continue
    }
    const m1 = (t.end - t.start) / span
    if (t.reverse) {
      // S = end − m1·(a − from)
      out[i * 2] = t.end + m1 * t.from
      out[i * 2 + 1] = -m1
    } else {
      // S = start + m1·(a − from)
      out[i * 2] = t.start - m1 * t.from
      out[i * 2 + 1] = m1
    }
  }
  return out
}

/**
 * WHICH PART OF EACH STROKE THE WINDOW IS ASKING FOR, in the stroke's OWN 0..1
 * arc — `[f0, f1]` pairs, `f0 <= f1`, both 0 when the stroke is not in it.
 *
 * The one function the three rebuild engines and Rod all read, for the reason
 * `lib/pen-reveal.ts`'s header gives about `blendReveal`: the arithmetic that
 * turns a schedule plus a window into "which part of this stroke" had better
 * exist once, or a window means two things on two engines.
 *
 * At the identity schedule under `grow` this returns exactly
 * `[0, filterStrokesByProgress`'s own fraction]` for every stroke, which is why
 * the shipped clip is reproduced point for point rather than approximately.
 */
export function strokeSpansIn(
  sched: StrokeSchedule,
  lo: number,
  hi: number,
): Float64Array {
  const tr = sched.tracks
  const out = new Float64Array(tr.length * 2)
  for (let i = 0; i < tr.length; i++) {
    const t = tr[i]
    const span = t.end - t.start
    if (span <= 0) {
      // A zero-length stroke is present iff the window reaches its instant.
      const on = hi >= t.start && lo <= t.start
      out[i * 2] = 0
      out[i * 2 + 1] = on ? 1 : 0
      continue
    }
    let u0 = (lo - t.start) / span
    let u1 = (hi - t.start) / span
    if (u0 < 0) u0 = 0
    else if (u0 > 1) u0 = 1
    if (u1 < 0) u1 = 0
    else if (u1 > 1) u1 = 1
    if (u1 < u0) u1 = u0
    if (t.reverse) {
      out[i * 2] = 1 - u1
      out[i * 2 + 1] = 1 - u0
    } else {
      out[i * 2] = u0
      out[i * 2 + 1] = u1
    }
  }
  return out
}

/**
 * How far through ITS OWN span each stroke is at this playhead, 0..1.
 *
 * The per-stroke clip Solid, Extrude and the Inflate loft rebuild from, and the
 * per-stroke reveal Rod draws with. One function, so a schedule cannot mean two
 * things on two engines — the failure `lib/pen-reveal.ts`'s own header records
 * having already happened once with the Natural / Authentic toggle.
 */
/**
 * ⚠ `Float64Array`, AND THAT IS NOT A DETAIL. This number is a fraction of a
 * stroke's arc length that a GEOMETRY BUILDER then cuts at, so a float32 round
 * trip lands the cut point a few ten-thousandths of a pixel off — measured:
 * `x = 289.99999165` where the double is `290`, which was enough to make the
 * identity schedule's rebuild clip differ from `filterStrokesByProgress`'s and
 * to break the one row that proves the two are the same function. A reveal that
 * is "almost" the shipped one is exactly the drift this file exists to avoid.
 */
export function strokeProgressAt(sched: StrokeSchedule, playhead: number): Float64Array {
  const tr = sched.tracks
  const out = new Float64Array(tr.length)
  for (let i = 0; i < tr.length; i++) {
    const t = tr[i]
    const span = t.end - t.start
    if (span <= 0) {
      out[i] = playhead >= t.start ? 1 : 0
      continue
    }
    const f = (playhead - t.start) / span
    out[i] = f <= 0 ? 0 : f >= 1 ? 1 : f
  }
  return out
}

/* ==========================================================================
 * §5 · APPLYING IT — the three mechanisms, one remap each
 * ======================================================================== */

/**
 * The per-triangle reveal keys, rewritten into scheduled space.
 *
 * Allocates rather than mutating: `StrokeMeshData.revealKeys` is the array a
 * rebuild replaces, and its IDENTITY is how a consumer can tell that a rebuild
 * happened at all. Writing through it would destroy the only signal that the
 * off-thread refill leaves behind — the exact hole explainer 24 was written for.
 */
export function remapRevealKeys(
  base: Float32Array,
  sched: StrokeSchedule,
  out?: Float32Array,
): Float32Array {
  const dst = out && out.length === base.length ? out : new Float32Array(base.length)
  for (let t = 0; t < base.length; t++) dst[t] = scheduleArc(sched, base[t])
  return dst
}

export function isAscending(keys: Float32Array): boolean {
  for (let t = 1; t < keys.length; t++) if (keys[t] < keys[t - 1]) return false
  return true
}

export interface TriangleSort {
  /** `order[newPosition] = oldTriangleIndex`. */
  order: Uint32Array
  /** The keys, in the new order, clamped monotone. */
  keys: Float32Array
}

/**
 * COUNTING SORT, NOT `.sort(cmp)` — and it is the same sort, with the same
 * bucket count and the same reason, that `lib/implicit-surface.ts:1204-1208`
 * already pays for at build time:
 *
 *   *"keys are already bounded to 0..1, and a comparator sort of a few hundred
 *   thousand triangles costs more than the marching did. Bucket width here is
 *   1/4096 of the mark — about a fifth of a stroke width on the hero word, so
 *   ordering INSIDE a bucket is below the resolution the reveal can express."*
 *
 * Measured there at **39 ms once** on a build costing ~600 ms. This one runs on
 * a dial change, never per frame.
 *
 * The monotone clamp at the end is not tidiness either: `AnimatedStrokes`
 * binary-searches this array with a plain lower bound, and one float out of
 * order makes it return the wrong count. Clamping UPWARD is the conservative
 * direction — a triangle is never revealed early.
 */
export function sortTrianglesByKey(keys: Float32Array): TriangleSort {
  const n = keys.length
  const BUCKETS = 4096
  const bucketOf = new Int32Array(n)
  const counts = new Int32Array(BUCKETS + 1)
  for (let t = 0; t < n; t++) {
    let bi = (keys[t] * BUCKETS) | 0
    if (bi < 0) bi = 0
    else if (bi >= BUCKETS) bi = BUCKETS - 1
    bucketOf[t] = bi
    counts[bi + 1]++
  }
  for (let b = 0; b < BUCKETS; b++) counts[b + 1] += counts[b]
  const order = new Uint32Array(n)
  const outKeys = new Float32Array(n)
  const cursor = new Int32Array(BUCKETS)
  for (let t = 0; t < n; t++) {
    const bi = bucketOf[t]
    const dst = counts[bi] + cursor[bi]
    cursor[bi]++
    order[dst] = t
    outKeys[dst] = keys[t]
  }
  for (let t = 1; t < n; t++) if (outKeys[t] < outKeys[t - 1]) outKeys[t] = outKeys[t - 1]
  return { order, keys: outKeys }
}

/**
 * Re-order an index buffer's TRIANGLES without touching its vertex values.
 *
 * ⚠ `prev` IS WHY THIS TAKES TWO PERMUTATIONS AND NOT ONE. `ownTrianglesWhole`
 * (`components/viewport-3d.tsx:3481`) splits vertices at letter boundaries and
 * rewrites this same buffer IN PLACE — changing index VALUES while deliberately
 * preserving triangle ORDER, *"which is load-bearing: `revealKeys` is a
 * per-triangle array parallel to that order"*. So the buffer on screen may
 * already carry work that is not in any base copy. Un-permuting the CURRENT
 * buffer by the permutation last applied, then permuting by the new one, keeps
 * that work and needs no base copy at all.
 */
export function permuteTriangles(
  current: ArrayLike<number>,
  prev: Uint32Array | null,
  next: Uint32Array | null,
  scratch?: Uint32Array,
): Uint32Array {
  const tri = Math.floor(current.length / 3)
  const base =
    scratch && scratch.length === tri * 3 ? scratch : new Uint32Array(tri * 3)
  if (prev) {
    for (let t = 0; t < tri; t++) {
      const d = prev[t] * 3
      base[d] = current[t * 3]
      base[d + 1] = current[t * 3 + 1]
      base[d + 2] = current[t * 3 + 2]
    }
  } else {
    for (let k = 0; k < tri * 3; k++) base[k] = current[k]
  }
  if (!next) return base
  const out = new Uint32Array(tri * 3)
  for (let t = 0; t < tri; t++) {
    const s = next[t] * 3
    out[t * 3] = base[s]
    out[t * 3 + 1] = base[s + 1]
    out[t * 3 + 2] = base[s + 2]
  }
  return out
}

/**
 * The tip field's `arc` channel, rewritten into scheduled space.
 *
 * 🔴 THIS IS THE TRAP THE MAP FLAGS IN RED (§6.2, and the dispatch repeats it):
 * *"the tip field's `arc` channel must take the SAME remap, or the moving nose
 * detaches from the stroke it is drawing."* Two consumers of one schedule, and
 * the repo's most expensive recurring defect is one idea with two
 * implementations — so both go through `scheduleArc` and there is no second
 * copy of the arithmetic anywhere.
 *
 * Interleaved RG, two floats per texel; channel 1 (`rhoN`, the perpendicular
 * offset in nib half-widths) is a SPATIAL quantity and is copied untouched.
 */
export function remapTipFieldArc(
  base: Float32Array,
  sched: StrokeSchedule,
  out?: Float32Array,
): Float32Array {
  const dst = out && out.length === base.length ? out : new Float32Array(base.length)
  const n = base.length >> 1
  for (let p = 0; p < n; p++) {
    dst[p * 2] = scheduleArc(sched, base[p * 2])
    dst[p * 2 + 1] = base[p * 2 + 1]
  }
  return dst
}

/* ==========================================================================
 * §6 · THE REBUILD PATH — Solid, Extrude, and the Inflate loft
 * ======================================================================== */

/**
 * `filterStrokesByProgress`, generalised from ONE monotone global cut to a
 * per-stroke one.
 *
 * §0.7 — `filterStrokesByProgress` is untouched and stays the shipped path at
 * the identity schedule; `scripts/verify/assert-drawin-monotone.mjs` imports it
 * by name and it is that gate's own known-bad arm. This is a second function
 * beside it, not a rewrite of it.
 *
 * The cut inside a stroke is the same arithmetic as its ancestor's — walk the
 * segments, interpolate x/y/t/pressure inside the one that contains the target
 * — because a reveal that snapped to whole points *"removes the visible popping
 * and uneven pacing"* and re-deriving it here would be a second opinion about a
 * number that file already answers.
 *
 * ⚠ IT CARRIES THE SAME MODEL DEFECT ITS ANCESTOR DOES, and per-stroke does not
 * make it worse or better: a builder whose shape depends on the LENGTH of what
 * it is handed reshapes ink already on the page (explainer 22, measured at
 * *"36 of 40 steps, worst 16.07 %"*). That is why Inflate reveals by
 * `setDrawRange` and why this path is only reached on Solid and Extrude.
 */
export function filterStrokesBySchedule(
  strokes: readonly ProcessedStroke[],
  sched: StrokeSchedule,
  playhead: number,
  win?: RevealWindow,
): ProcessedStroke[] {
  /* THE WINDOW IS OPTIONAL AND ITS ABSENCE IS THE PREFIX, which is what keeps
   * step 2's row — *"at the identity the new rebuild clip is the OLD one, point
   * for point, to nine decimals"* — measuring the same thing it always did. */
  const lo = win ? win.lo : 0
  const hi = win ? win.hi : playhead
  /* F118, A WRAPPED TRAVEL IS TWO PARTS, and each stroke gets one piece per part,
   * the pieces of one stroke adjacent in the output. Every other window takes
   * the single `strokeSpansIn` call it always took. */
  if (win && win.wrapLo < 1) {
    return filterStrokesBySpans(strokes, windowParts(win).map(([a, b]) => strokeSpansIn(sched, a, b)))
  }
  return filterStrokesBySpans(strokes, [strokeSpansIn(sched, lo, hi)])
}

/**
 * ANIM-1C · THE TIMED VARIANT. The clip `filterStrokesBySchedule` runs, handed
 * the spans instead of computing them, one `[f0, f1]`-per-stroke array per
 * window part (`strokeSpansIn`'s layout). Under a timed take Extrude and Solid
 * pass `takeSpansIn` (`lib/stroke-timing.ts`), which reads each stroke's own
 * slot forward from the take's clock through `sampleTake`, the function Rod
 * and export already read. Without it they cut every stroke at the shared beat
 * and every row was ignored. `filterStrokesBySchedule` calls this too, with the
 * spans it always computed, so the untimed clip is the same loop as before.
 */
export function filterStrokesBySpans(
  strokes: readonly ProcessedStroke[],
  parts: readonly Float64Array[],
): ProcessedStroke[] {
  const out: ProcessedStroke[] = []
  for (let s = 0; s < strokes.length; s++) {
    for (const sp of parts) {
      const f0 = s * 2 < sp.length ? sp[s * 2] : 0
      const f1 = s * 2 + 1 < sp.length ? sp[s * 2 + 1] : 1
      if (f1 > f0) clipStrokeTo(strokes[s], f0, f1, out)
    }
  }
  return out
}

/** A piece the clip cut out of a longer stroke. `clipArc` is its true arc
 *  length in canvas px; the Solid raster reads it so a piece shorter than the
 *  line width is not stamped as a full capsule (F118, the seam pop). A whole
 *  stroke never carries it. */
export type ClippedPiece = ProcessedStroke & { clipArc?: number }

/** One stroke cut to its arc fractions `[f0, f1]`, pushed onto `out`, or
 *  nothing when the cut is empty. The body `filterStrokesBySchedule` always ran
 *  per stroke, lifted out whole so a two-part window reuses it. */
function clipStrokeTo(stroke: ProcessedStroke, f0: number, f1: number, out: ProcessedStroke[]): void {
  const pts = stroke.points
  if (pts.length === 0) return
  if (f0 <= 0 && f1 >= 1) {
    out.push(stroke)
    return
  }
  if (pts.length === 1) {
    out.push({ ...stroke, points: [pts[0]] })
    return
  }
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  }
  if (total <= 0) {
    out.push({ ...stroke, points: [pts[0]] })
    return
  }
  /* ⚠ THE FAR-END CUT IS THE PREFIX'S ARITHMETIC, UNCHANGED. Everything above
   * and this whole block are the shipped path when `f0 <= 0`, which is every
   * playhead of every `grow` window on every schedule step 2 could produce.
   * The near-end cut below is additive and only runs when the window has a
   * trailing edge. */
  let hiIdx = pts.length - 1
  let hiCut: Point | null = null
  let hiRanOff = false
  if (f1 < 1) {
    const target = total * f1
    let acc = 0
    let cutIdx = -1
    let segStart = 0
    for (let i = 1; i < pts.length; i++) {
      const segLen = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      if (acc + segLen >= target) {
        cutIdx = i
        segStart = acc
        break
      }
      acc += segLen
    }
    if (cutIdx < 0) {
      // Numerical edge — include all of the stroke, exactly as the shipped
      // clip does, and hand back the ORIGINAL object when nothing was cut so
      // the identity row compares the same reference it always did.
      hiIdx = pts.length - 1
      hiRanOff = true
    } else {
      hiIdx = cutIdx - 1
      hiCut = lerpPoint(pts[cutIdx - 1], pts[cutIdx], segStart, target)
    }
  }
  if (hiRanOff && f0 <= 0) {
    out.push(stroke)
    return
  }
  /* THE NEAR END — the trailing edge, and the half a prefix could never
   * express. Same closed form, same interpolation of x/y/t/pressure, because
   * *"a reveal that snapped to whole points removes the visible popping"* and
   * an edge that snapped at one end and not the other would put the popping
   * back on exactly the edge a viewer is watching under `travel`. */
  let loIdx = 0
  let loCut: Point | null = null
  if (f0 > 0) {
    const target = total * f0
    let acc = 0
    let cutIdx = -1
    let segStart = 0
    for (let i = 1; i < pts.length; i++) {
      const segLen = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      if (acc + segLen >= target) {
        cutIdx = i
        segStart = acc
        break
      }
      acc += segLen
    }
    if (cutIdx < 0) return
    loIdx = cutIdx
    loCut = lerpPoint(pts[cutIdx - 1], pts[cutIdx], segStart, target)
  }
  const partial: Point[] = []
  if (loCut) partial.push(loCut)
  for (let i = loIdx; i <= hiIdx; i++) partial.push(pts[i])
  if (hiCut) partial.push(hiCut)
  if (partial.length === 0) return
  const clipArc = total * (Math.min(1, f1) - Math.max(0, f0))
  const piece: ClippedPiece = { ...stroke, points: partial.length === 1 ? [partial[0]] : partial, clipArc }
  out.push(piece)
}

/** The one interpolation, so the two edges cannot disagree about what a cut
 *  point is. `segStart` is the arc length at `a`; `target` is where the cut
 *  falls. Lifted verbatim out of `filterStrokesByProgress`'s own body. */
function lerpPoint(a: Point, b: Point, segStart: number, target: number): Point {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const segLen = Math.hypot(dx, dy)
  const tF = segLen > 0 ? Math.max(0, Math.min(1, (target - segStart) / segLen)) : 0
  return {
    x: a.x + dx * tF,
    y: a.y + dy * tF,
    t: a.t + (b.t - a.t) * tF,
    pressure:
      a.pressure !== undefined && b.pressure !== undefined
        ? a.pressure + (b.pressure - a.pressure) * tF
        : a.pressure ?? b.pressure,
  }
}

/* ==========================================================================
 * §7 · CONVENIENCE — the one call a surface makes
 * ======================================================================== */

export function scheduleFromStrokes(
  strokes: readonly ProcessedStroke[],
  unitOf: readonly number[] | null,
  params: DrawInParams,
): StrokeSchedule {
  return buildStrokeSchedule(
    {
      spans: strokeArcSpans(strokes as ProcessedStroke[]),
      unitOf,
      positionOf: params.order === "byPosition" ? strokePositions(strokes) : null,
    },
    params,
  )
}

/** Human-readable, for the panel's own summary line. */
export function describeSchedule(sched: StrokeSchedule): string {
  return describeDrawIn(sched.params)
}

export function describeDrawIn(p: DrawInParams, win?: RevealWindowParams): string {
  const bits: string[] = []
  if (p.order !== "asDrawn") bits.push(ORDER_LABELS[p.order].toLowerCase())
  if (p.overlap > 0) {
    bits.push(`overlap ${Math.round(p.overlap * 100)}%`)
    bits.push(p.align === "end" ? "align end" : "align start")
  }
  if (p.reverse && p.reverse !== "off") bits.push(REVERSE_LABELS[p.reverse].toLowerCase())
  if (win && win.mode !== "grow") {
    bits.push(
      win.mode === "travel"
        ? `travel ${Math.round(Math.max(WINDOW_MIN_LENGTH, Math.min(1, win.length)) * 100)}%`
        : WINDOW_LABELS[win.mode].toLowerCase(),
    )
  }
  return bits.join(" · ")
}

export const ORDER_LABELS: Record<StrokeOrder, string> = {
  asDrawn: "As drawn",
  reversed: "Reversed",
  byLength: "Short first",
  byPosition: "Left to right",
  random: "Random",
}

export const ORDER_NOTES: Record<StrokeOrder, string> = {
  asDrawn: "The recording, untouched. This is the shipped default and it renders exactly as before.",
  reversed: "Last thing you drew lands first.",
  byLength: "Shortest unit first, longest last. The word grows into its big move.",
  byPosition: "Left edge to right edge, whatever order your hand used.",
  random: "Shuffled from a seed. The same seed is the same word every time.",
}
