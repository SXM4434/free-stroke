"use client"

/**
 * THE HERO BEAT TUNER.
 *
 * Desk Doodles' whole pitch is one motion beat: a flat ink doodle tenses, then
 * stands up off the page into its 3D form, overshoots, settles, and holds the
 * best ¾ angle. Until now that beat could only be adjusted by editing constants
 * in `scripts/capture/motion.mjs` and re-running a full headed capture — minutes
 * per tweak, which is not a rate at which anyone tunes timing by feel.
 *
 * This page drives the SAME choreography (`lib/hero-motion.ts`, whose defaults
 * are byte-equal to the capture's) against the live WebGL scene, with every
 * beat, angle and curve on a dial. Scrub it, play it, feel it, then copy the
 * tuned constants back into the capture.
 *
 * THE REGISTER TOGGLE. The same engine can wear two looks. Desk Doodles is one
 * warm-graphite ink, matte, where tonal range is earned from light and mark
 * density and never from hue — its own docs put it as "it's ALL ONE PENCIL".
 * Free Stroke is the opposite instinct: gloss, metals, and the screen-space
 * style stack. Both are real, so both are here, switchable, rather than one
 * being hardcoded. Nothing is removed in either direction.
 *
 * A register carries its LIGHT as well as its surface. Desk Doodles' matte
 * graphite only reads as matte graphite under Desk Doodles' studio rig, so
 * that rig was ported across whole (components/studio-rig.tsx) and the
 * register selects it. Switching the toggle re-lights the scene; it does not
 * merely re-colour the material.
 */

import { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore } from "react"
import { useDialTimeline, DialTimeline, DialStore } from "dialkit"
import "dialkit/styles.css"
import Viewport3DWrapper from "@/components/viewport-3d-wrapper"
import type { ExportSettings } from "@/components/drawing-canvas"
import {
  processStroke,
  type Stroke,
  type ProcessedStroke,
  type Point,
} from "@/lib/stroke-processing"
import { DEFAULT_STYLE_STATE, MATERIAL_PARAMS, type StyleState } from "@/lib/style-system"
import { WOBBLE_PRESETS, type EndpointBehavior } from "@/lib/hand-feel"
import {
  stampPenClock,
  measurePenRecord,
  measureTimingCharacter,
  /* THE MOVING END OF THE LINE. The store lives in pen-reveal.ts and not in the
   * viewport for a bundle reason the viewport's own note gives — importing it
   * from there as a VALUE would drag three.js into this page's static graph.
   * The harness (`window.__captureHarness.setPenTip`) drives this same setter,
   * so the pill below and the verification sweep cannot disagree. */
  setPenTipMode,
  readPenTipMode,
  subscribePenTip,
  type PenClock,
  type PenTipMode,
} from "@/lib/pen-reveal"
import {
  ENGINE_FAMILIES,
  DEFAULT_ENGINE_FAMILY,
  isEngineFamily,
  type EngineFamily,
} from "@/lib/engine-registry"
/* A VALUE IMPORT, AND IT COSTS THIS PAGE NOTHING. `@/lib/engine-registry` two
 * lines up already value-imports `@/lib/dd-engine/adapter`, which value-imports
 * this module — so `strokeTo3d` is in this page's static graph either way. It
 * is named here rather than reached through the adapter because the adapter's
 * own copy runs AFTER the hand-feel pass, on a centreline whose ends have
 * already been pulled apart, and this one has to run before. */
import { closureStateOf } from "@/lib/dd-engine/strokeTo3d"
import {
  computeSolidEffectiveThicknessPx,
  DEFAULT_SOLID_PARAMS,
  type GeometryMode,
  type InflateParams,
} from "@/lib/geometry-engines"

/**
 * The hero word is handwriting, and handwriting CROSSES ITSELF — the bowl of
 * the D meets its stem, the k's arms meet its stem, the l's loop closes on
 * itself. Inflate's default surface strategy is a per-stroke swept loft, which
 * at every one of those junctions leaves two complete tubes passing THROUGH
 * each other: a seam line, an internal surface showing, and a cross-section
 * that hits four sheets. On a page whose entire pitch is "this is a drawn
 * mark given volume", that reads as pipework.
 *
 * So the hero runs the IMPLICIT strategy: one signed-distance field for the
 * whole word, polygonised as a single watertight surface, so a crossing IS one
 * merged mass with a fillet. It costs a few hundred ms once per stroke change
 * (the beat itself only moves the reveal playhead and the camera, which do not
 * rebuild geometry), which is the right trade on a page that holds one word.
 * The app's own Inflate default stays on the fast loft.
 */
const HERO_INFLATE: InflateParams = {
  fusion: "implicit",
  // Enough fillet to read as a fused junction, not so much that it starts
  // eating the letterform's own silhouette.
  blend: 0.45,
  // Cells per stroke radius. 5 resolves the fillet and the taper without the
  // staircase that 2-3 leaves on a mark this size.
  resolution: 5,
}
import {
  REGISTERS,
  REGISTER_ORDER,
  registerCssVars,
  type RegisterId,
} from "@/lib/registers"
import {
  DEFAULT_HERO_MOTION,
  cascadeClipSec,
  sampleHeroMotion,
  totalDuration,
  toMotionMjsSource,
  HERO_PHASES,
  HERO_SHEETS,
  type HeroBeats,
  type HeroCamera,
  type HeroMotionParams,
  type HeroPhase,
  type HeroShape,
} from "@/lib/hero-motion"
/* O5's letter law. A pure lib with no React and no three, so importing it here
 * is free — see `lib/hero-letters.ts` for why the map is measured from the ink
 * rather than written down. */
import { assignLetters, letterGapAfter, LETTER_REACH_FRAC } from "@/lib/hero-letters"
import logoStrokesJson from "@/scripts/capture/logo-strokes.json"
import { layoutWord, measureWord, fold, SUPPORTED } from "@/scripts/capture/letters.mjs"
import type { FlatState } from "@/components/viewport-3d"
// The break's own geometry, imported rather than re-typed: `findHeroJunctions`
// drops any contact the slab would run off the end of, and "the end of what"
// is the law's constants. Two copies of one number is how this repo's
// most expensive defect class starts.
import {
  JOINT_BREAK_REACH_K,
  JOINT_BREAK_KEEP_K,
  carvedHalfWidth,
  findSelfCrossings,
} from "@/lib/flat-ink"

/* -------------------------------------------------------------------------- */
/*  The word                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * THE PEN'S CLOCK — how long the trace says each stroke took.
 *
 * ⚠ THE COMMENT THAT USED TO STAND HERE IS THE DEFECT, AND IT IS QUOTED IN FULL
 * AT `lib/pen-reveal.ts`'s pen-clock block, together with the measurement that
 * closed it. Short version: the trace's timestamps were synthesised at a flat
 * 12 ms per point on a 4 px arc-length grid, so the recording the draw-in
 * replays said the pen moved at exactly one speed for the entire word —
 * r(stroke length, stroke duration) = 0.9986, where 1.0000 is a machine. The
 * Sigma-Lognormal reconstruction that has been in this repo since the hand-feel
 * port computes a real per-stroke duration and the pipeline was discarding it.
 *
 * The builders moved to `lib/pen-reveal.ts` so the probes run the real code
 * rather than a hand-copy, and so the 2D flat-ink register gets the same
 * recording as the 3D one. Both clocks are reachable; `"uniform"` is the parked
 * prior and the negative control every pen-timing assertion needs.
 */

/** Sebs's traced handwriting — the logo as actually drawn.
 *
 * ⚠ `dropSubNibStubs` IS ON HERE AND OFF IN `buildFontStrokes`, and the
 * difference is provenance rather than geometry. A trace kept every place the
 * pen touched down and went nowhere — nine of these twenty-two, 2.03 % of the
 * travel and 13.6 % of the record's clock, each one popping in whole in clear
 * air. A font's short strokes are authored tittles. See the block above
 * `subNibStubCensus` in lib/pen-reveal.ts for the measurement and for what
 * "drop" costs. */
function buildTracedStrokes(clock: PenClock): Stroke[] {
  const { polylines } = logoStrokesJson as { polylines: { x: number; y: number }[][] }
  return stampPenClock(polylines, clock, {
    nibDiameter: HERO_INK_WIDTH_PX,
    dropSubNibStubs: true,
  })
}

/**
 * The same single-stroke font the capture uses, so arbitrary text lands in the
 * same letterforms the film would draw.
 *
 * ── THE SCALE LAW, AND THE DEFECT IT REPLACES ───────────────────────────────
 *
 * Sebs, 2026-08-02: *"the 3d text is fully distorted worse when u type ur own
 * text."* Two mechanisms, both real, both fixed:
 *
 *  1. **The font had seven glyphs.** `D e s k o d l` and a space. Twenty of the
 *     twenty-five characters in "the quick brown fox jumps" drew NOTHING, which
 *     is why the capture on disk
 *     (`docs/verification/drawin-holes/sweep-long/carve-0.png`) is five discs:
 *     they are the `e`, the `k`, the two `o`s and the `s`, each alone in its own
 *     dead space. Fixed in `scripts/capture/letters.mjs`, which now draws the
 *     whole keyboard.
 *
 *  2. **The nib did not scale with the glyph** — the mechanism the previous lane
 *     named. The old law was `k = FONT_TARGET_W / laid.width`: fit the word to a
 *     fixed span, whatever its length. The nib stayed at `HERO_INK_WIDTH_PX`, so
 *     the longer the text the smaller every glyph got underneath a pen that
 *     never shrank. The quantity that decides whether a letterform survives is
 *
 *         R = nib diameter / cap height
 *
 *     and under the old law R ran from **0.029** on `"ok"` to **0.336** on
 *     `"the quick brown fox jumps"` and **0.378** on a 29-character line — a 13x
 *     swing on the one number that decides whether an `e` has an eye. The hero
 *     itself sits at 0.175. (Those two figures are with the font's full
 *     coverage; before it, the same strings measured lower only because most of
 *     their characters were drawing nothing at all.)
 *
 * ── WHERE THE FLOOR COMES FROM ──────────────────────────────────────────────
 *
 * `scripts/verify/_probe-font-legibility.mjs` sweeps R against every glyph,
 * rasterising the nib as the disc it actually is and counting enclosed paper.
 * The font departs from the shipped picture at **R = 0.2176**, and the glyph
 * that sets it is Sebs's own `e` — its eye closes there. Every glyph added for
 * this fix clears that, deliberately, so the font's limit is an authored
 * letterform and not something this lane drew.
 *
 * ── THE LAW ─────────────────────────────────────────────────────────────────
 *
 * So: **hold the cap height, do not hold the span.** `FONT_SCALE` is exactly the
 * scale "Desk Doodles" already renders at, applied to every word, which makes R
 * invariant at 0.1749 for any text of any length — 1.24x of margin to the `e`.
 * This is what a hand does: you do not shrink your writing to fit the line, you
 * keep writing at your size and take another line.
 *
 * And that is the second half — long text WRAPS (`FONT_TARGET_W` is now a page
 * width rather than a target span) instead of growing into a ribbon. The camera
 * needs nothing: `useStableStrokesBounds` measures the real geometry and
 * `orbitView` frames `bounds.radius`, so a taller, wider block is framed to fit
 * on its own.
 *
 * `"fit"` is the parked prior law, reachable on the Scale pill, and it is the
 * negative control `assert-hero-word-legible.mjs` requires to FAIL.
 */
const FONT_TARGET_W = 1100
const FONT_BASELINE_Y = 400

/** Which law turns a laid-out word into stroke coordinates. */
type FontScaleLaw = "fixed" | "fit"

/**
 * THE HERO WORD'S OWN SCALE, and the reason `"Desk Doodles"` is byte-identical
 * under the new law.
 *
 * `FONT_TARGET_W / measureWord("Desk Doodles")` is the SAME EXPRESSION on the
 * same two doubles that the old law evaluated for that text, so `k` is bit-for-
 * bit what it was; the film, the letter map and the carve register cannot move.
 * Every other word now simply gets that same `k` instead of its own.
 */
const FONT_DD_WIDTH = measureWord("Desk Doodles", { x: 0, y: 0, size: 120, tracking: 12 })
const FONT_SCALE = FONT_TARGET_W / FONT_DD_WIDTH

/** Filled by `buildFontStrokes`; see the note inside it. */
const FONT_LETTER_MAP: { of: number[]; count: number } = { of: [], count: 0 }

/**
 * HOW MANY LETTERS THE TRACED WORD HAS — a fact about `logo-strokes.json`, which
 * is Sebs's hand writing "Desk Doodles" and will never be anything else. Written
 * here rather than read off the `text` box, which belongs to the FONT source and
 * would report a typed word's length for a trace that does not follow it.
 */
const TRACED_WORD_LETTERS = "DeskDoodles".length

/** What the last `buildFontStrokes` actually did, for the panel and the gate. */
export interface FontWordMetrics {
  /** Cap height in stroke px — the number the whole legibility argument is about. */
  capPx: number
  /** `HERO_INK_WIDTH_PX / capPx`. Must stay under `FONT_R_CEILING`. */
  ratio: number
  lineCount: number
  letterCount: number
  /** Laid-out width in stroke px, after the law. */
  widthPx: number
  /** Characters in the text the font cannot draw even after folding. */
  unsupported: string[]
}
const FONT_METRICS: FontWordMetrics = {
  capPx: 0,
  ratio: 0,
  lineCount: 0,
  letterCount: 0,
  widthPx: 0,
  unsupported: [],
}

/**
 * THE NIB-TO-CAP RATIO AT WHICH THIS FONT STOPS BEING LETTERS.
 *
 * Measured, not chosen: `_probe-font-legibility.mjs` bisects each glyph's
 * departure from how it renders at the hero's own weight and the minimum over
 * the font is 0.2176, set by the `e`'s eye. Restated here as the one number the
 * page has to respect, with the probe as its provenance — and asserted against
 * the live probe by `assert-hero-word-legible.mjs`, so the two cannot drift.
 */
const FONT_R_CEILING = 0.2176

/**
 * WHICH CHARACTERS THE FONT WILL SILENTLY SWALLOW.
 *
 * The old font advanced the pen past anything it could not draw and said
 * nothing, which is precisely why a seven-glyph font read as a rendering bug
 * rather than as missing coverage: a hole in a word looks identical to a fused
 * one once the mark is a row of dots. Duplicates collapse, and the order is the
 * order they were typed in.
 */
function unsupportedIn(text: string): string[] {
  const out: string[] = []
  for (const ch of text) {
    if (fold(ch) !== null) continue
    if (!out.includes(ch)) out.push(ch)
  }
  return out
}

function buildFontStrokes(
  text: string,
  clock: PenClock,
  law: FontScaleLaw = "fixed",
  wrap = true,
): Stroke[] {
  /* Under `"fixed"` the page width is a real page width — the widest line the
   * word may occupy before it takes another one — so it converts out of stroke
   * px into the font's own laid units by the scale that is about to be applied.
   * Under the parked `"fit"` law there is no page: the word is squeezed onto one
   * line whatever that costs, which is the defect. */
  const maxWidth = law === "fixed" && wrap ? FONT_TARGET_W / FONT_SCALE : 0
  // The font is plain ESM (node runs it directly for the capture, with no build
  // step), so TypeScript infers its return as loosely typed rather than reading
  // the sibling declaration. Narrowing here keeps the rest of the file honest.
  const laid = layoutWord(text, { x: 0, y: 0, size: 120, tracking: 12, maxWidth }) as {
    polylines: { x: number; y: number }[][]
    letterOf: number[]
    letterCount: number
    width: number
    lineCount: number
    lineHeight: number
  }
  if (!laid.polylines.length || !laid.width) {
    FONT_METRICS.capPx = 0
    FONT_METRICS.ratio = 0
    FONT_METRICS.lineCount = 0
    FONT_METRICS.letterCount = 0
    FONT_METRICS.widthPx = 0
    FONT_METRICS.unsupported = unsupportedIn(text)
    return []
  }
  /* WHICH LETTER EACH STROKE BELONGS TO, published for the renderer.
   *
   * `buildFontStrokes` returns `Stroke[]` and a stroke has no letter field —
   * adding one would ripple through processing, the engines and the export for
   * a fact only the hero needs. The map is index-parallel to the strokes it
   * returns (one stroke per polyline, order preserved end to end), so a sibling
   * array is the whole answer. Stashed rather than returned so the function's
   * signature stays what every other caller expects. */
  FONT_LETTER_MAP.of = laid.letterOf
  FONT_LETTER_MAP.count = laid.letterCount
  const k = law === "fit" ? FONT_TARGET_W / laid.width : FONT_SCALE
  /* Lift the block so its MIDDLE line sits on the baseline the single-line word
   * has always sat on, rather than its first. Written as an offset folded into
   * the constant instead of a subtraction inside the map, so a one-line word
   * evaluates `FONT_BASELINE_Y + p.y * k` — character for character the
   * expression that shipped. */
  const baseY = FONT_BASELINE_Y - (((laid.lineCount - 1) * laid.lineHeight) / 2) * k
  const scaled = laid.polylines.map((pl) =>
    pl.map((p) => ({ x: p.x * k, y: baseY + p.y * k })),
  )
  FONT_METRICS.capPx = 120 * k
  FONT_METRICS.ratio = HERO_INK_WIDTH_PX / (120 * k)
  FONT_METRICS.lineCount = laid.lineCount
  FONT_METRICS.letterCount = laid.letterCount
  FONT_METRICS.widthPx = laid.width * k
  FONT_METRICS.unsupported = unsupportedIn(text)
  // A FONT has even less claim to a metronome than a trace does: its points are
  // authored, not sampled, so 12 ms apart is not even a recording of anything.
  // The model gives it the same hand the traced word gets.
  return stampPenClock(scaled, clock, { nibDiameter: HERO_INK_WIDTH_PX })
}

/**
 * The rendered ink DIAMETER in stroke-coordinate px, which is what the
 * hand-feel amplitude has to be measured against (see DD_REFERENCE_INK_WIDTH
 * in lib/hand-feel.ts — a wobble calibrated for a 1.2px line is invisible on a
 * tube this thick). This page never overrides solidParams, so the viewport
 * builds at the default thickness; `computeSolidEffectiveThicknessPx` is the
 * same mapping the Inflate builder applies (geometry-engines.ts:5436-5443),
 * so this tracks the engine rather than restating a number that could drift.
 */
const HERO_INK_WIDTH_PX = computeSolidEffectiveThicknessPx(DEFAULT_SOLID_PARAMS.thickness)

/** Matches the capture's stroke-processing settings. */
const PROCESS_SETTINGS: ExportSettings = {
  spacing: 4,
  smoothing: true,
  preserveCorners: true,
}

/* -------------------------------------------------------------------------- */
/*  The junctions — what K7's return has to say                                */
/* -------------------------------------------------------------------------- */

/**
 * WHERE THE PEN LAID ONE STROKE ACROSS ANOTHER.
 *
 * K7 returns to a CHANGED flat, and §10.5 call 1's hard constraint is that the
 * change must be an OCCLUSION and never a shading — a value difference inside
 * the ink breaks gate 1 (flat ink SD < 1), an occlusion gap leaves every
 * surviving ink pixel at one value. So the change has to be *paper where ink
 * was*, which means it has to happen somewhere two strokes meet.
 *
 * THE BOARD NAMES A PLACE THAT DOES NOT EXIST ON THIS MARK, AND THIS IS THE
 * MEASUREMENT THAT SAYS SO. §3 K4 calls the change *"the crossings resolve into
 * over/under"*. A true centreline-crossing test over the real traced word finds
 * **one** intersection in 22 strokes and 1078 points — stroke 10 against stroke
 * 11, and stroke 11 is a three-point tick four units wide. There is no
 * X-junction here for an over/under to resolve at, and
 * `online-reference-mechanics.md` §9.1 reports the same absence from the other
 * side across eleven clips: *"Not one instance anywhere of a mark occluding
 * itself at a crossing."*
 *
 * WHAT IS ACTUALLY THERE IS BETTER. The word is 22 separate acts of the hand,
 * and the hero deliberately FUSES them: `HERO_INFLATE.fusion: "implicit"`
 * exists so *"a crossing IS one merged mass with a fillet"*. That fusion is
 * what makes K1 one blob and the hand's 22 decisions invisible. This finds
 * every place the fusion is hiding a junction — where two strokes come within
 * one ink diameter of each other — and marks the LATER-drawn one as the one in
 * front, because the pen order is not an interpretation, it is the record.
 *
 * On the traced word that is **22 junctions**, checked in and reproducible at
 * `scripts/verify/_probe-hero-junctions.mjs`, which runs this same measurement
 * outside the browser and reports its sensitivity (18 at half the ink diameter,
 * 29 at one and a half — so the count is the handwriting's, not the
 * threshold's).
 *
 * At K7 those junctions open a hairline of paper and the drawing comes back
 * carrying its own order. Same mechanism the genre uses (an occluder, and
 * paper where ink was, `origami-logo-fold` measured 14 frames out of 14 against
 * both a rotation and a shift control), same single ink value everywhere.
 */
/**
 * WHICH LAW DECIDED THE SET — all five reachable, none of them overwritten.
 *
 * - `selfcross`  the shipped law (2026-08-02): `crossings`, plus the places a
 *                stroke crosses ITSELF, where the pen order is the ARC.
 * - `crossings`  PARKED. `selfcross` with the self-crossing pass removed and
 *                nothing else changed — the set that shipped 97 px of news
 *                against a 200 px floor, still selectable.
 * - `terminals`  PARKED. The margin `crossings` replaced (`aEnd > reach`), and
 *                the set that shipped. `carve === 0` also lands here, because
 *                the uncarved picture is gated and may not move.
 * - `nofarside`  the NEGATIVE CONTROL for the new clause: `crossings` with the
 *                come-out-the-far-side test removed and nothing else changed.
 *                It is the naive relaxation, and it takes the mark apart.
 * - `prior`      PARKED. No guard at all — the 22 contacts that shipped the
 *                decapitated `l` and the severed `s`.
 */
export type JunctionLaw = "selfcross" | "crossings" | "terminals" | "nofarside" | "prior"

export interface HeroJunction {
  /** Stroke index the pen drew FIRST — the one that goes under. */
  under: number
  /** Stroke index the pen drew LATER — the one that stays whole. */
  over: number
  /** Where, in stroke-coordinate space. */
  x: number
  y: number
  /** Closest centreline approach, in stroke-coordinate px. */
  gap: number
  /**
   * WHICH ARC — the point indices the two samples are keyed on. Only written on
   * a SELF-crossing, where `under === over` and the stroke index alone cannot
   * say which part of the stroke is in front. `lib/flat-ink.ts`'s
   * `HeroJunctionInput` carries the same two fields and documents why; on a
   * distinct pair they are omitted and `buildJointBreaks` resolves both by
   * nearest point exactly as it always has.
   */
  underAt?: number
  overAt?: number
}

function pointToSegment(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const vx = bx - ax
  const vy = by - ay
  const L = vx * vx + vy * vy
  const t = L > 0 ? Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / L)) : 0
  return Math.hypot(ax + t * vx - px, ay + t * vy - py)
}

/** Arc length along a polyline, cumulative, in stroke coordinates. */
function arcLengths(pts: { x: number; y: number }[]): number[] {
  const a = [0]
  for (let i = 1; i < pts.length; i++)
    a.push(a[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  return a
}

/** Distance from a point to a whole polyline, in stroke coordinates. */
function polylineDistance(pts: { x: number; y: number }[], qx: number, qy: number): number {
  if (pts.length === 1) return Math.hypot(pts[0].x - qx, pts[0].y - qy)
  let best = Infinity
  for (let i = 0; i + 1 < pts.length; i++) {
    const d = pointToSegment(qx, qy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
    if (d < best) best = d
  }
  return best
}

/**
 * DOES THE UNDER STROKE COME OUT THE FAR SIDE — with a stroke's worth of itself
 * still to run?
 *
 * Walks `A` away from the contact at `i`, half a stroke unit at a time (finer
 * than the 4-unit spacing `PROCESS_SETTINGS` resamples to, so a short exit
 * cannot fall between two points), and asks two things in order: does it ever
 * leave the paper band around `B` (`outer`), and once it has, does `need` more
 * of it survive before the pen lifted.
 *
 * Both halves matter and they fail differently. No exit at all is the pen
 * LIFTING at another stroke — 18 of this word's 22 contacts, the whole
 * "decapitated" class. An exit with nothing behind it is the `D`'s stem clearing
 * its own bar by 13 units against a 22.6-unit diameter, which renders as a
 * floating triangle (`docs/verification/hero-k7/break-carve/break-0-1.png`).
 *
 * ── AND THE EXIT HAS TO HAPPEN INSIDE THE BREAK'S OWN WINDOW (2026-08-02) ───
 *
 * FOUND BY LOOKING, at 5x, at the one junction still taking the mark apart once
 * the self-crossings landed: 18→19 chops the top-right terminal off the final
 * `s` of *Doodles* and leaves it floating —
 * `docs/verification/hero-k7/lane31/s1819-x5.png`, clean · broken · without-it,
 * and in the middle pane NOTHING passes through the gap. Measured on the live
 * page one junction at a time (`_probe-lane31-ofat.mjs`) it is the only one of
 * the five open breaks that splits the drawing: 7 components with it, 6 without,
 * a 112 px lozenge adrift, at 0.70 and at 1.00 alike.
 *
 * IT PASSES EVERY EXISTING CLAUSE HONESTLY. The stroke in front is a stroke
 * where it passes (21.3 units from its nearer end against a `keepOver` of 11.0);
 * both of `buildJointBreaks`'s drop rules clear (ratio 0.54 of 2, window 44.8 of
 * 56.5); and the tail the break leaves behind is 23.0 units against a `need` of
 * 20.9. Twenty-three units IS "a stroke's worth" by the sentence above, and the
 * picture is still a blob — so the miss is not the bar, it is the QUESTION.
 *
 * THE QUESTION THE BAND ANSWERS PER DIRECTION. `left` is the arc at which the
 * under stroke finally leaves the paper band. `JOINT_BREAK_REACH_K`'s own
 * comment says the arc a stroke spends inside the band is `2·outer / sin θ` and
 * that at a shallow contact it is *"unbounded"* — so the break CLIPS it at
 * `reach`. If the stroke has not come out of the band within `reach`, the far
 * edge of the cut on that side is not the crossing's edge, it is the window's:
 * the break stops in the middle of the band, which is `buildJointBreaks`'s own
 * *"a break that starts and stops in the middle of nothing."*
 *
 * ⚠ AND THAT RULE ALREADY EXISTS — AS A TOTAL, WHICH CANNOT SEE THIS. The third
 * drop rule asks `behind + cut <= 2 · reach`, and 18→19's total fits because the
 * event is LOPSIDED: forward it leaves the band at 24.8, backward at 29.0. One
 * side is clipped and the sum never says so. It is the same correction the far
 * side clause's own docstring already made about the law's three regions —
 * *"The law reads them as TOTALS. Read them PER DIRECTION instead and they
 * answer the question exactly."*
 *
 * NO NEW CONSTANT: `window` is `reach`, the break's own. Measured over all 22
 * contacts at carve 1.00 and 0.70 (`_probe-lane31-farside.mjs`, which refuses to
 * print unless it reproduces the page's set pair-for-pair), the exits separate
 *
 *     kept     7→8  16.7 / 15.6      7→9  13.6 / 20.4     13→14   0.0 / 1.0
 *     dropped 18→19 24.8 / 29.0      0→2  47.3 / 37.3      4→5   34.0 / 29.7
 *                                                         10→11  27.0 / 35.5
 *
 * and the three it drops besides 18→19 are the ones this file and
 * `lib/flat-ink.ts` already describe as no news: 4→5 is *"a TICK lying along the
 * `s` at 19°, a retrace… There is no over and under"*, and 0→2 (10°) and 10→11
 * (17°) are the *"two strokes running ALONGSIDE each other"* class. None of them
 * opens a break at any amplitude, so the rendered mark changes by 18→19 alone.
 *
 * §0.7: PARKED AS `"crossings"`, WHICH PASSES `Infinity` — the clause without
 * this term, byte for byte, still selectable. `"nofarside"` drops the whole
 * clause and therefore this term with it, so it stays the ONE-clause relaxation
 * and keeps admitting 18→20 and 18→21 (621 px and 638 px adrift) — a control
 * that could no longer fail would be worse than no control.
 */
function comesOut(
  A: { x: number; y: number }[],
  i: number,
  B: { x: number; y: number }[],
  outer: number,
  need: number,
  sign: 1 | -1,
  /**
   * How far the exit may be from the contact, in stroke units. `Infinity` is
   * the parked arm. Named `windowArc` and not `window` on purpose — this module
   * runs in a browser and shadowing the global there is how a later edit
   * reaches for `window.__hero…` inside this function and silently gets a
   * number.
   */
  windowArc = Infinity,
): boolean {
  let left: number | null = null
  let acc = 0
  let k = i
  for (;;) {
    const n = k + sign
    if (n < 0 || n >= A.length) return false
    const seg = Math.hypot(A[n].x - A[k].x, A[n].y - A[k].y)
    const steps = Math.max(1, Math.ceil(seg / 0.5))
    for (let s = 1; s <= steps && left === null; s++) {
      const f = s / steps
      if (
        polylineDistance(
          B,
          A[k].x + (A[n].x - A[k].x) * f,
          A[k].y + (A[n].y - A[k].y) * f,
        ) > outer
      )
        left = acc + seg * f
    }
    /* THE EXIT DID NOT HAPPEN INSIDE THE BREAK'S OWN WINDOW — see the header.
     * Tested against the sub-segment arc `left` rather than against `acc`, so
     * the answer does not depend on where the 4-unit resampling grid happens to
     * put a point. `Infinity` never fires, which is the parked arm exactly. */
    if (left !== null && left > windowArc) return false
    if (left === null && acc + seg >= windowArc) return false
    acc += seg
    k = n
    if (left !== null && acc - left >= need) return true
  }
}

/**
 * One junction per pair of strokes that touch, at their closest approach.
 *
 * Deliberately NOT one per contact point: two strokes that run together for a
 * while are one junction the eye reads once, and reporting forty of them would
 * turn a countable piece of news into a number nobody can check.
 *
 * ⚠ THE SENTENCE THAT STOOD HERE WAS THE DEFECT, and it is quoted rather than
 * deleted because it is the whole finding: *"Same-stroke self-contacts are
 * excluded — a stroke passing near itself has no 'later' stroke to be in front,
 * so there is no pen order to show."* THAT REASON IS FALSE. Within one stroke
 * the pen order is the ARC — the later arc was drawn later and is in front, by
 * exactly the record (the trace's own point order) the entire mechanism rests
 * on. Cursive is made of loops and every loop closes on itself; seven places on
 * this word are a stroke crossing itself, at 54° to 88°, and they are the only
 * steep crossings besides 7→8. The law that finds them is
 * `lib/flat-ink.ts`'s `findSelfCrossings`, beside the break it feeds, and the
 * pass that calls it is at the bottom of this function.
 *
 * ── A BREAK MAY NOT CUT OFF A TERMINAL (2026-08-01). ───────────────────────
 *
 * FOUND BY WATCHING THE BEAT, not by a gate. At full res the returned mark has
 * a DECAPITATED `l` — the ascender's tip left floating, detached from its own
 * stem — a severed `s`, and four white bars across the `sk` that read as
 * shattered rather than as over/under. `assert-hero-k7-news.mjs` is 8/8 green
 * over those exact frames and is right about everything it measures (1544 px
 * ink→paper, 0 px paper→ink, interior sd 0.000, break area within 5 % of the
 * model). **None of those quantities can see a letter come apart.**
 *
 * The cause is in this set, not in the law that opens it.
 * `scripts/verify/_probe-junction-kind.mjs` classifies all 22 by where the
 * contact sits along each stroke and by the angle between the two tangents:
 *
 *     1 of 22   one stroke genuinely LAID ACROSS another (18/20, 71°)
 *    18 of 22   a contact at a stroke END — the pen lifting and carrying on
 *     3 of 22   two strokes running ALONGSIDE each other (13-25°)
 *
 * which agrees exactly with the docstring above: a true centreline-crossing
 * test finds ONE intersection in 22 strokes. A hand lifts and re-places the pen
 * constantly, and two strokes that CONTINUE each other are within one ink
 * diameter at their shared end. Opening a break there does not reveal an
 * over/under, because nothing is over anything — it cuts a terminal off.
 *
 * THE GUARD IS THE LAW'S OWN GEOMETRY, not a fitted threshold. `buildJointBreaks`
 * removes a slab of the under stroke's centreline reaching `JOINT_BREAK_REACH_K
 * · inkDiameter` either side of the junction, and protects the stroke in front
 * out to `JOINT_BREAK_KEEP_K · inkDiameter / 2`. So:
 *
 *   • the junction must be further than `reach` from either end of the UNDER
 *     stroke, or the slab runs off the end and there is no ink left on one side
 *     of the cut. That is the floating `l` tip, exactly;
 *   • it must be further than `keep` from either end of the OVER stroke, or the
 *     thing that is supposed to pass through unbroken is a terminal cap rather
 *     than a stroke.
 *
 * Both constants are IMPORTED from the law rather than re-typed, so a change to
 * the break's geometry cannot leave this set describing the previous one.
 *
 * The prior set stays reachable: `window.__heroJunctionLaw = "prior"` (dev only,
 * same pattern as `__heroRevealChannel`) restores it, so the defect is
 * reproducible on demand rather than remembered.
 *
 * ── THE FIRST CLAUSE WAS BACKWARDS, AND `"crossings"` REPLACES IT (2026-08-01).
 *
 * `aEnd > reach` is a MARGIN, and the failure it names is not a margin's shape:
 * the further from the end a junction is, the BIGGER the piece the break leaves
 * floating, so the clause pushes the wrong way. Measured over the prior
 * 22-contact set at carve 1.00, with the clause simply dropped
 * (`_probe-break-carve.mjs --prior --perBreak`), the law opens nine breaks and
 * the margin's verdict and the damage disagree in BOTH directions:
 *
 *     it dropped   0->1   142 px      it kept   18->20   621 px ADRIFT
 *                  3->4    76 px                18->21   638 px ADRIFT
 *                  4->6   114 px
 *                  6->7    78 px
 *                  8->9    74 px
 *                 16->17  130 px
 *
 * ⚠ AND THE SIX IT DROPPED ARE NOT SIX PIECES OF NEWS. Every one of them leaves
 * `assert-hero-k7-intact`'s component count alone — it is a SUM, and a sum
 * cannot see what a letter looks like. Rendered at 5x and looked at
 * (`docs/verification/hero-k7/break-carve/break-*.png`, one crop per junction,
 * clean left / broken right):
 *
 *     0->1    the `D`'s stem crossing its own bar at 81.5° — and the stem only
 *             clears the bar by 13 units against an ink DIAMETER of 22.6, so the
 *             tip comes off as a floating triangle and the stem below is severed
 *             from the bar. It survives the component count because the tip is a
 *             35 px crumb and the stem rejoins the bowl further down.
 *     3->4    a white SQUARE punched through the middle of a stroke
 *     8->9    the same square, in the `k`'s cluster
 *     4->6    the junction is 13 units from the tick's own END — a white wedge
 *             bitten out of the top of the `s`
 *     6->7    a notch chipped out of the `k`'s vertex
 *    16->17   a nick at the `e`'s lower left
 *
 * against the one that is the real thing — 7->8, the `k`'s stem passing behind
 * the horizontal at 81°, ink above and ink below, the front stroke unbroken
 * across (`diag-7-8.png` at 10x). That is what an over/under looks like, and it
 * is the only one on this word, which is exactly what the census at the top of
 * this comment says from the other side.
 *
 * ── SO THE TEST IS ABOUT THE CUT, AND IT IS THE LAW'S OWN THREE REGIONS ─────
 * Walking the UNDER stroke away from the contact, `buildJointBreaks` puts every
 * sample in one of three regions — inside the front stroke's ink (`behind`), in
 * the paper band (`cut`), or past it. The law reads them as TOTALS. Read them
 * PER DIRECTION instead and they answer the question exactly:
 *
 *   • THE STROKE IN FRONT MUST BE A STROKE WHERE IT PASSES. The contact is at
 *     least that stroke's own half-width from either of its ends, or the thing
 *     the mark is supposed to pass behind is a terminal cap. This is the old
 *     OVER clause, resized from the TUBE's constant to the ink the carved mark
 *     actually has — 0.56 R to 1.00 R against 1.06 R.
 *
 *   • AND THE STROKE BEHIND MUST COME OUT THE FAR SIDE, on both sides. It has to
 *     leave the band with at least its own ink DIAMETER of centreline still to
 *     run. Not a fitted length: the mark's own width is the only intrinsic scale
 *     in the problem, and a piece of stroke shorter than the stroke is wide is a
 *     blob, not a stroke. It is the clause that catches every picture above —
 *     0->1 leaves 9 units where it needs 19; 3->4, 6->7, 8->9, 18->20 and 18->21
 *     have no far side at all, because the pen LIFTED there.
 *
 * Over the prior 22 that admits six — 0-2, 4-5, 7-8, 7-9, 10-11, 13-14 — and the
 * law's own drop rules then take all but 7->8, which is the honest answer and
 * not a happy one: see `lib/flat-ink.ts`'s `carve` parameter for the 200 px floor
 * this leaves K7's news under, and `scripts/verify/_probe-crossing-census.mjs`
 * for where the missing news actually is.
 *
 * ⚠ IT IS GATED ON THE CARVE, AND THAT IS THE SAME STEP `buildJointBreaks` TAKES
 * for the same reason: at `carve === 0` the parked arm draws the break on an
 * UNCARVED mark and is a shipped, gated picture that may not move by a pixel, so
 * zero has to be the old code path exactly rather than a limit of the new one.
 * The step is unreachable in the shipped beat — `penCarve = carveAmount × flat`
 * and `flat` is 1 at K7, so the carve this guard sees is `carveAmount` itself.
 *
 * §0.7: `"terminals"` is PARKED, not rewritten — `window.__heroJunctionLaw =
 * "terminals"` still renders the exact set that shipped, and `"prior"` still
 * renders the unguarded 22.
 *
 * ── ⚠ AND THE PARKED MARGIN IS NOW KNOWN TO TAKE THE MARK APART (2026-08-07) ─
 *
 * `assert-hero-k7-intact.mjs` graded that arm as an expected PASS for six days
 * and no sweep ever ran it. Run bare for the first time it does not pass, and
 * the reason is one junction and this clause:
 *
 *     18->20   aEnd 30.7 against reach 28.23 — ADMITTED by the margin
 *              forward from the contact, stroke 18 never leaves stroke 20's
 *              paper band before the pen lifts (`comesOut(+1)` runs off the
 *              end), so `"crossings"` REJECTS it
 *
 * The break then removes an 8.72-unit slab there and the 30.7 units of stroke 18
 * forward of it — the upper half of the final `s` of *Doodles*, 777 px — are cut
 * free: K1 5 components, K7 6, at the shipped carve of 0.70; K1 6 -> K7 8 at
 * 1.00. Which is the paragraph below, arriving as a measurement: the margin
 * admits this contact BECAUSE the piece it strands is big.
 *
 * IT STAYS EXACTLY AS IT IS. §0.7 forbids reworking a parked option in place,
 * and there would be nothing left to park: the margin admitting 18->20 IS
 * `"terminals"`. The arm is graded as a third KNOWN-BAD in that gate instead,
 * required to go red, and 18->20 is also the single junction that reddens
 * `"nofarside"` and `"prior"` at the shipped carve (`_probe-lane31-ofat.mjs
 * --carve=0.70`: removing it alone takes either arm from K7 6 back to K7 5) —
 * so a break-law change that closed it would blind all three controls at once.
 *
 * ⚠ NOT `export`ed, and it may not become one. **An App Router page module may
 * carry only the exports Next allows** — `default`, `metadata`, `revalidate`
 * and the rest of the segment config — and Next generates a route-type
 * validator that rejects anything else:
 *
 *     .next/types/app/desk-doodles/page.ts(14,13): error TS2344
 *     OmitWithTag<typeof import(".../app/desk-doodles/page"), …>
 *       does not satisfy the constraint '{ [x: string]: never; }'
 *
 * `tsconfig.json` includes BOTH `.next/types/**` and `.next/dev/types/**`, so
 * once either a production build or a webpack-mode dev server has run, that
 * error is in the count and `scripts/verify/assert-tsc-baseline.mjs` reads 7 or
 * 8 against a baseline of 6. It stayed invisible only because the canonical
 * tree had run neither. Measured 2026-08-07: `next build --webpack` SUCCEEDS
 * anyway — but only because `next.user-config.mjs` sets
 * `typescript.ignoreBuildErrors: true` ("Skipping validation of types" in the
 * build log), which is a v0 scaffold default, not a decision. Remove that flag
 * and this export fails the build.
 *
 * The only caller is `useMemo` at the bottom of this file, so the keyword bought
 * nothing. If this function is ever genuinely needed elsewhere, MOVE IT to
 * `lib/` — do not re-export it from here. The gate that catches a re-export is
 * `assert-tsc-baseline.mjs`, which fails on any count that is not exactly 6.
 */
function findHeroJunctions(
  strokes: ProcessedStroke[],
  inkDiameter: number,
  law: JunctionLaw = "selfcross",
  /** `HeroMotionParams.carveAmount` — see the step note above. */
  carve = 0,
  /** `HeroMotionParams.ret.breakK` — the band is `breakK · inkDiameter` wide. */
  breakK = DEFAULT_HERO_MOTION.ret.breakK,
): HeroJunction[] {
  const reach = JOINT_BREAK_REACH_K * inkDiameter
  const keep = (JOINT_BREAK_KEEP_K * inkDiameter) / 2
  /* THE SAME THREE LINES `buildJointBreaks` OPENS WITH, so the guard and the law
   * cannot be describing two different marks. `carvedHalfWidth` is imported from
   * the law rather than re-derived for exactly that reason. */
  const c = Math.max(0, Math.min(1, carve))
  const R = inkDiameter / 2
  const band = Math.max(0, breakK) * inkDiameter
  const sized = (pts: { x: number; y: number }[], i: number) =>
    keep + (carvedHalfWidth(pts, i, R) - keep) * c
  const out: HeroJunction[] = []
  for (let a = 0; a < strokes.length; a++) {
    for (let b = a + 1; b < strokes.length; b++) {
      const A = strokes[a].points
      const B = strokes[b].points
      if (A.length < 2 || B.length < 2) {
        // A one- or two-point stroke is a dot or a tick; measure it point-wise
        // rather than skipping it, because those ARE junctions on this word.
      }
      let best = Infinity
      let bx = 0
      let by = 0
      let ai = 0
      let bk = 0
      let bt = 0
      for (let i = 0; i < A.length; i++) {
        for (let k = 0; k + 1 < B.length || (B.length === 1 && k === 0); k++) {
          let d: number
          let t = 0
          if (B.length === 1) {
            d = Math.hypot(A[i].x - B[0].x, A[i].y - B[0].y)
          } else {
            const vx = B[k + 1].x - B[k].x
            const vy = B[k + 1].y - B[k].y
            const L = vx * vx + vy * vy
            t = L > 0 ? Math.max(0, Math.min(1, ((A[i].x - B[k].x) * vx + (A[i].y - B[k].y) * vy) / L)) : 0
            d = Math.hypot(B[k].x + t * vx - A[i].x, B[k].y + t * vy - A[i].y)
          }
          if (d < best) {
            best = d
            bx = A[i].x
            by = A[i].y
            ai = i
            bk = k
            bt = t
          }
          if (B.length === 1) break
        }
      }
      if (!(best < inkDiameter)) continue

      if (law !== "prior") {
        const aa = arcLengths(A)
        const ba = arcLengths(B)
        const aLen = aa[aa.length - 1]
        const bLen = ba[ba.length - 1]
        const aAt = aa[ai]
        const bAt = B.length > 1 ? ba[bk] + bt * (ba[bk + 1] - ba[bk]) : 0
        // Distance from the contact to the NEARER end of each stroke.
        const aEnd = Math.min(aAt, aLen - aAt)
        const bEnd = Math.min(bAt, bLen - bAt)
        /* THE PARKED ARM, byte for byte — and `carve === 0` lands on it, because
         * the uncarved picture is gated and may not move. See the step note in
         * the docstring.
         *
         * ⚠ THIS IS THE LINE THAT ADMITS 18->20 (aEnd 30.7 > reach 28.23) and
         * therefore the line the parked arm comes apart on at every carve above
         * zero — see the ⚠ block in this function's docstring for the numbers and
         * for why it is graded as a known-bad rather than repaired. At `c === 0`
         * every law arrives here, which is why `assert-hero-k7-intact --carve=0`
         * reports two of its three controls as the shipped arm and exits 1. */
        if (law === "terminals" || c === 0) {
          if (!(aEnd > reach) || !(bEnd > keep)) continue
        } else {
          /* THE OVER STROKE'S OWN INDEX, resolved the way `buildJointBreaks`
           * resolves it — `nearestIndex(B, jn.x, jn.y)` on the SAME published
           * point — so `keepOver` here is the number the law will size the band
           * with, not a second opinion about it. */
          let bi = 0
          let bd = Infinity
          for (let i = 0; i < B.length; i++) {
            const d = (B[i].x - bx) ** 2 + (B[i].y - by) ** 2
            if (d < bd) {
              bd = d
              bi = i
            }
          }
          const keepOver = sized(B, bi)
          const outer = keepOver + band
          // The thing that passes in front has to BE a stroke where it passes.
          if (!(bEnd > keepOver)) continue
          // …and the mark behind it has to come out the far side, both sides,
          // with a stroke's worth of itself left. `need` is the under stroke's
          // own carved DIAMETER — the mark's only intrinsic length.
          //
          // `"nofarside"` DROPS EXACTLY THIS CLAUSE AND NOTHING ELSE. It is the
          // known-bad input the intactness gate is calibrated against: it is the
          // naive relaxation — the old margin simply deleted — and it admits
          // 18->20 and 18->21, which set 621 px and 638 px of the final `s`
          // adrift. A guard whose control cannot fail is not a guard.
          if (law !== "nofarside") {
            const need = 2 * sized(A, ai)
            /* …AND IT HAS TO COME OUT INSIDE THE WINDOW THE BREAK ACTS OVER.
             * `reach` is the break's own; `"crossings"` is PARKED at `Infinity`,
             * which is the clause without this term, byte for byte. See
             * `comesOut`'s header for the 5x picture that found it and for the
             * exits at all 22 contacts. */
            const win = law === "crossings" ? Infinity : reach
            if (
              !(
                comesOut(A, ai, B, outer, need, 1, win) &&
                comesOut(A, ai, B, outer, need, -1, win)
              )
            )
              continue
          }
        }
      }

      out.push({ under: a, over: b, x: bx, y: by, gap: best })
    }
  }

  /* ── AND THE PLACES A STROKE CROSSES ITSELF (2026-08-02) ──────────────────
   *
   * APPENDED, NEVER SUBSTITUTED: every junction the distinct-pair pass above
   * produced is still in `out`, and `"crossings"` renders that set alone.
   *
   * The law — the enumeration, the cap test and the two side clauses — lives in
   * `lib/flat-ink.ts`'s `findSelfCrossings`, beside the break it feeds, so this
   * file cannot hold a second opinion about which crossings are real.
   * `"nofarside"` drops the same one clause here that it drops on the distinct
   * pairs, so it stays the one-clause relaxation of the shipped law everywhere.
   *
   * §0.7 + the same step `buildJointBreaks` takes: gated on `c > 0`, because at
   * carve 0 the parked arm draws the break on an UNCARVED mark and is a
   * shipped, gated picture that may not move by a pixel.
   */
  if ((law === "selfcross" || law === "nofarside") && c > 0) {
    for (let s = 0; s < strokes.length; s++)
      for (const j of findSelfCrossings(strokes[s].points, inkDiameter, c, breakK, {
        farSide: law !== "nofarside",
      }))
        out.push({ under: s, over: s, ...j })
  }
  return out
}

/* -------------------------------------------------------------------------- */
/*  The timeline — DialKit owns the beat                                       */
/* -------------------------------------------------------------------------- */

/**
 * THE TWELVE PHASES, AS TWELVE CLIPS.
 *
 * Choreography is not tuned by typing numbers into sliders. It is tuned by
 * dragging the edge of a bar until the beat feels right, which is what DialKit's
 * timeline dock is for: play/pause, scrub, drag a clip to move it, drag its edge
 * to retime it, Copy to export.
 *
 * THE ONE RULE THIS WIRING EXISTS TO KEEP. The timeline is the SINGLE OWNER of
 * beat durations and of the playhead. `tl.<phase>.duration` is the live value;
 * the page derives `HeroBeats` from it and holds no copy of its own, and there
 * is no beat slider running in parallel. This codebase's dominant bug class is
 * two sources of truth drifting apart — the two mirrored register/engine pills,
 * the two transports, the phase readout that disagreed with the pose — so the
 * beat is deliberately not allowed to become another one.
 *
 * `at` is DERIVED, not authored. The phases are strictly sequential and
 * `lib/hero-motion.ts` lays them out by cumulative sum, so a clip's start is a
 * consequence of the durations before it and never an independent value.
 * DialKit stores `at` as its own dial, so the page writes the cumulative sum
 * back into the store (see `useContiguousClips`) rather than letting the dock
 * and the sampler hold two different opinions about where a beat starts.
 */
const HERO_TIMELINE_ID = "hero-beat"

const HERO_TIMELINE = (() => {
  const cfg: Record<string, { at: number; duration: number }> = {}
  let at = 0
  for (const ph of HERO_PHASES) {
    const d = DEFAULT_HERO_MOTION.beats[ph]
    cfg[ph] = { at, duration: d }
    at += d
  }
  return cfg as { [K in HeroPhase]: { at: number; duration: number } }
})()

/**
 * WHAT EACH BEAT IS FOR — AND WHY IT IS SHOT FROM WHERE IT IS SHOT.
 *
 * These used to be the `hint` strings on a row of sliders; the sliders are gone
 * (the dock owns the durations) but the reasoning is not disposable, so it moves
 * to the readout's tooltips.
 *
 * ⚠ AND THEY NOW CARRY THE CAMERA'S REASONING, WHICH IS THE POINT. Sebs, on the
 * beat as it stood: *"what the point of these camera angles we get randomly — I
 * had use[d] Sills' storyboard, part of this was to create logic and reason
 * behind everything."* Every angle in this beat HAS a reason and every one of
 * them was measured; they were just written up where he never reads them — in
 * doc comments inside `lib/hero-motion.ts` and in an assertion's header. A
 * reason nobody can see while they drive the thing is not a reason, it is a
 * private note.
 *
 * COPY LAW, same as the pills below: short, human, and about the picture. What
 * the shot is, and what the camera being there buys. No parameter names, no
 * degrees, no curve names — those live in the model, next to the numbers they
 * describe.
 */
const BEAT_NOTES: Record<HeroPhase, string> = {
  draw:
    "The ink scratches itself in, straight on. The camera is square to the page because the page IS the screen here. Nothing is being looked at yet, it is being written.",
  breath:
    "The hold that buys the moment. An accent is bought with stillness, not with a move: the two biggest accents in the reference films are each preceded by seconds of a completely frozen frame.",
  anticipation:
    "The wind-up. It tenses straight on, where you can read it, and it is what makes the turn EXPECTED instead of a glitch. The tension does not snap back. It unwinds into the turn, so the crouch and the turn are one gesture.",
  emerge:
    "THE MOMENT. The mark turns to its own edge, holds two frames on nothing but its thickness, and comes back an object. The camera does not move a pixel through it. If it moved, the change would belong to the viewpoint instead of to the mark, and that is the one thing this beat cannot afford.",
  land:
    "The shadow arrives under the form, a few frames behind it, and nothing else happens. One piece of news per shot.",
  solid:
    "The mark, solid, from exactly where it opened. Held, because this is the frame you compare against your memory of the drawing, and it only works if it is the same picture.",
  tilt:
    "The page tips back and the mark is revealed lying on it. A real camera move, not a squash. Only a real one gives you a near edge bigger than a far edge, which is what reads as LYING DOWN. It does not stop at the bottom; it hands straight over to the rise, so the lie-down and the wind-up are one descent instead of a glide, a stall and a lurch.",
  standup:
    "The money move: it launches, sails past, and settles. Fast off the mark and a long settle. That reads as ARRIVING. Even at both ends reads as a camera travelling, which is the one thing the biggest gesture in the beat must not do.",
  orbit:
    "The three-quarter, held. The best angle on the form, and the frame you are meant to leave with. Nothing moves in it. A hold only reads as a hold if something stopped; a camera that keeps creeping here is the 'it just dollies side to side' read.",
  descend:
    "The mark lies back down and the camera squares up, ready to close where it opened. It eases OUT of the hold rather than leaving at full speed. A camera that goes from dead still to full tilt in one frame is most of what 'janky' actually is.",
  returnTurn:
    "The same moment, run backwards, from the same square-on framing as the first one. An object goes in, a drawing comes out.",
  hold:
    "The drawing is back, carrying its own pen order, at the framing it started in. Going one way asserts a conversion; coming back asserts an identity, and the identity is the pitch.",
}

/** Everything in the motion model EXCEPT the beats, which the timeline owns. */
type HeroMotionRest = Omit<HeroMotionParams, "beats">
const DEFAULT_MOTION_REST: HeroMotionRest = (() => {
  const { beats: _beats, ...rest } = DEFAULT_HERO_MOTION
  return rest
})()

/* -------------------------------------------------------------------------- */
/*  Small register-styled controls                                             */
/* -------------------------------------------------------------------------- */

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        letterSpacing: "var(--reg-caps-tracking)",
        textTransform: "uppercase",
        color: "var(--reg-secondary)",
      }}
    >
      {children}
    </span>
  )
}

function Dial({
  label,
  value,
  min,
  max,
  step,
  unit = "",
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
  hint?: string
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <Label>{label}</Label>
        <span
          style={{
            fontSize: 11,
            fontVariantNumeric: "tabular-nums",
            color: "var(--reg-detail)",
          }}
        >
          {Number.isInteger(value) ? value : value.toFixed(step < 0.01 ? 3 : 2)}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: "100%", accentColor: "var(--reg-accent)" }}
      />
      {hint ? (
        <span style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.4 }}>
          {hint}
        </span>
      ) : null}
    </div>
  )
}

/**
 * A NAMED segmented control. The name is not decoration here — see the header.
 * Two anonymous pills offering the same two words are indistinguishable, and this
 * page shipped exactly that.
 */
function PillGroup({
  label,
  ariaLabel,
  hint,
  children,
}: {
  label: string
  ariaLabel: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }} title={hint}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "var(--reg-caps-tracking)",
          textTransform: "uppercase",
          color: "var(--reg-body-soft)",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      <div
        role="group"
        aria-label={ariaLabel}
        // The label and the option ORDER are the fix for the two mirrored
        // unlabelled pills, so they are what the verification asserts on.
        data-pill-group={label}
        style={{
          display: "flex",
          gap: 2,
          padding: 3,
          borderRadius: "var(--reg-pill)",
          background: "var(--reg-muted)",
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * THE SAME CONTROL, STACKED — label on its own line, pills allowed to wrap.
 *
 * `PillGroup` puts its label beside the group, which is right for a two-option
 * read and wrong the moment there are four: the panel's control column is 320 px
 * and four uppercase pills plus an inline label overflow it. That is not a
 * hypothetical — the note on the "Coming back" row records the last time it
 * happened, where a longer word pair *"overflowed the 320px control column and
 * clipped the second pill at the panel's right edge."*
 *
 * So this is a variant and not a rewrite: same `Pill`, same rounded well, same
 * `data-pill-group` hook the verification asserts on. Only the axis changes.
 */
function PillRow({
  label,
  ariaLabel,
  hint,
  children,
}: {
  label: string
  ariaLabel: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }} title={hint}>
      <span
        style={{
          fontSize: 10,
          letterSpacing: "var(--reg-caps-tracking)",
          textTransform: "uppercase",
          color: "var(--reg-body-soft)",
        }}
      >
        {label}
      </span>
      <div
        role="group"
        aria-label={ariaLabel}
        data-pill-group={label}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          padding: 3,
          borderRadius: "var(--reg-pill)",
          background: "var(--reg-muted)",
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Pill({
  active,
  onClick,
  title,
  children,
  ...rest
}: {
  active: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
} & React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      style={{
        padding: "6px 14px",
        fontSize: 11,
        letterSpacing: "var(--reg-caps-tracking)",
        textTransform: "uppercase",
        borderRadius: "var(--reg-pill)",
        border: "none",
        cursor: "pointer",
        background: active ? "var(--reg-accent)" : "transparent",
        color: active ? "var(--reg-on-accent)" : "var(--reg-secondary)",
        transition: "background var(--reg-popover-ms) var(--reg-ease)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        borderTop: "1px solid var(--reg-border)",
        paddingTop: 16,
        marginTop: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <Label>{title}</Label>
        {note ? (
          <span style={{ fontSize: 10, fontStyle: "italic", color: "var(--reg-body-soft)" }}>
            {note}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A SUBTREE THAT IS ONLY REBUILT WHEN ITS INPUTS CHANGE.
 *
 * `useMemo` has to be called before the `return`, so memoising a subtree
 * normally means HOISTING it out of the JSX it lives in. That would mean moving
 * the twelve-hundred-line control panel to another part of the file — a diff
 * nobody can review, in a file several lanes land in. Taking the children as a
 * THUNK keeps the JSX exactly where it reads best: the closure is re-created
 * every render (one allocation) but its body is not evaluated unless `deps`
 * changed, which is the whole cost being avoided.
 *
 * It is deliberately not `React.memo`. `React.memo` skips a child's re-render
 * but the PARENT still builds the element tree, and element construction —
 * `jsxDEV` + `ReactElement`, 1966 ms across one 12.37 s beat — is exactly the
 * cost being removed here.
 */
function StableSubtree({
  deps,
  children,
}: {
  deps: readonly unknown[]
  children: () => React.ReactNode
}) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return <>{useMemo(children, deps)}</>
}

export default function DeskDoodlesHeroPage() {
  const [registerId, setRegisterId] = useState<RegisterId>("desk-doodles")
  const register = REGISTERS[registerId]

  /**
   * THE BEAT AND THE PLAYHEAD, BOTH OWNED BY THE TIMELINE.
   *
   * `tl.time` is the playhead — there is no second clock and no rAF loop on
   * this page any more. `tl.<phase>.duration` is that phase's length; the page
   * reads it and never stores it.
   */
  const tl = useDialTimeline("Hero beat", HERO_TIMELINE, {
    id: HERO_TIMELINE_ID,
    autoplay: false,
  })

  const beats = useMemo<HeroBeats>(
    () => ({
      draw: tl.draw.duration,
      breath: tl.breath.duration,
      anticipation: tl.anticipation.duration,
      emerge: tl.emerge.duration,
      land: tl.land.duration,
      solid: tl.solid.duration,
      tilt: tl.tilt.duration,
      standup: tl.standup.duration,
      orbit: tl.orbit.duration,
      descend: tl.descend.duration,
      returnTurn: tl.returnTurn.duration,
      hold: tl.hold.duration,
    }),
    [
      tl.draw.duration,
      tl.breath.duration,
      tl.anticipation.duration,
      tl.emerge.duration,
      tl.land.duration,
      tl.solid.duration,
      tl.tilt.duration,
      tl.standup.duration,
      tl.orbit.duration,
      tl.descend.duration,
      tl.returnTurn.duration,
      tl.hold.duration,
    ],
  )

  /**
   * KEEP THE DOCK AND THE SAMPLER TELLING THE SAME STORY.
   *
   * `sampleHeroMotion` lays the phases out end to end by cumulative sum;
   * DialKit lets a clip's `at` be dragged independently of its neighbours'
   * durations. Left alone, retiming the emerge would move where the emerge
   * happens in the render while the dock still drew it in the old place — the
   * exact drift this wiring exists to prevent.
   *
   * So the cumulative sum is written back into the store whenever it disagrees.
   * Dragging any clip's edge ripples the ones after it, which is the behaviour a
   * sequential beat should have anyway.
   *
   * ⚠ AND FOR MONTHS IT REACHED EIGHT OF THE TWELVE. The loop below walked
   * `HERO_PHASES`, but the map it compared against was written out by hand and
   * listed `draw, breath, emerge, tilt, anticipation, standup, orbit, hold`.
   * `live.land` was `undefined`, `undefined - at` is `NaN`, and **`NaN > 1e-4`
   * is false**, so `land`, `solid`, `descend` and `returnTurn` were never
   * patched and nothing said so: a comparison that cannot see its operand reads
   * exactly like a comparison that agreed. The dep array named the same eight,
   * so dragging one of those four clips did not even re-run the effect.
   *
   * Both halves are derived from `HERO_PHASES` now. A thirteenth phase joins the
   * comparison and the dep array at once, because neither spells a phase out.
   * `docs/verification/leftovers-2026-08-28/_probe-clip-writeback.mjs` replays
   * this body against a timeline whose every `at` is wrong and names any phase
   * it fails to correct; `--rev=<commit>` runs the same replay on the pre-fix
   * file, which reports 7 of 11 and exits 1. (Lane N20, row F49.)
   */
  /** The twelve starts as one value. A dep array cannot hold a loop, so this is
   *  what the effect below watches instead of a hand-written list of clips. */
  const clipStarts = HERO_PHASES.map((ph) => tl[ph].at).join(",")

  useEffect(() => {
    const patch: Record<string, number> = {}
    let at = 0
    for (const ph of HERO_PHASES) {
      if (Math.abs(tl[ph].at - at) > 1e-4) patch[`${ph}.at`] = at
      at += beats[ph]
    }
    if (Object.keys(patch).length > 0) DialStore.updateValues(HERO_TIMELINE_ID, patch)
    /* `tl` is a fresh object every render, so listing it here would write the
     * store on every render forever. `clipStarts` is its twelve `at`s and
     * changes exactly when one of them does. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beats, clipStarts])

  const [rest, setRest] = useState<HeroMotionRest>(DEFAULT_MOTION_REST)
  /**
   * THE PEN CARVE'S PARKED ARM, REACHABLE WITHOUT A HUMAN AT THE PANEL.
   *
   * `window.__heroCarveLaw = "prior"` before the page mounts restores the
   * shipped silhouette — the flat mark wearing the tube's outline — so a script
   * can capture both arms and diff them. The same shape as `__heroJunctionLaw`
   * above it, and for the same reason that one exists: *"a fix that cannot be
   * reproduced is a fix nobody can check."*
   *
   * It is not a second source of truth for the law. It writes the SAME state the
   * panel writes, once, on mount; everything downstream reads `motion.carveLaw`.
   * Dev only, like every other harness hook on this page — the carve itself is a
   * PRODUCT channel and is on by default in production.
   */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as { __heroCarveLaw?: string; __heroCarveAmount?: number }
    const law = w.__heroCarveLaw === "prior" ? "prior" : null
    // `__heroCarveAmount` is the AMPLITUDE arm. It exists because the amplitude
    // is Sebs's pick and a pick nobody can sweep is a pick made by whoever wrote
    // the default: `scripts/verify/_probe-carve-amplitude.mjs` drives it to
    // render the sheet he chooses from, and `assert-hero-carve.mjs` drives it to
    // prove the shipped value is inside the range K7 survives.
    const amt = typeof w.__heroCarveAmount === "number" ? w.__heroCarveAmount : null
    if (law === null && amt === null) return
    setRest((m) => ({
      ...m,
      ...(law ? { carveLaw: law } : null),
      ...(amt === null ? null : { carveAmount: Math.max(0, Math.min(1, amt)) }),
    }))
  }, [])
  /* ⚠ `motion` AND ITS SAMPLE NOW SIT BELOW THE WORD, not here.
   *
   * The cascade's layout is a MEASUREMENT of the live strokes (see the block
   * after `letterGap`), so the params can only be assembled once the strokes
   * exist. Moving them was the alternative to pushing the measurement into
   * `rest` through an effect — which would leave one render where the sampler
   * laid out eight beats for eleven letters, and that render is a frame on the
   * tape. */
  const [harnessReady, setHarnessReady] = useState(false)
  const stageRef = useRef<HTMLDivElement | null>(null)
  const [copied, setCopied] = useState(false)
  /**
   * REDUCED MOTION. The beat is user-initiated (nothing autoplays), so it is
   * not suppressed outright — that would delete the one thing the page exists
   * to show. What goes is the MOVEMENT character: the ink's swell past full
   * thickness, which is the only springy, non-essential motion in the emerge.
   * The state change itself — flat value to lit surface — is a colour change
   * and stays, which is exactly the "gentler, not zero" rule.
   */
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const sync = () => setReduceMotion(mq.matches)
    sync()
    mq.addEventListener("change", sync)
    return () => mq.removeEventListener("change", sync)
  }, [])

  const [source, setSource] = useState<"traced" | "font">("traced")
  const [text, setText] = useState("Desk Doodles")
  /**
   * HOW A TYPED WORD IS SCALED, and the parked prior.
   *
   * `"fixed"` holds the cap height at the hero's own, so the nib-to-cap ratio —
   * the number that decides whether an `e` keeps its eye — is the same 0.1749
   * for a two-letter word and a two-line sentence. `"fit"` is the law that
   * shipped: squeeze the word to `FONT_TARGET_W` whatever its length, which is
   * the defect Sebs reported and which `assert-hero-word-legible.mjs` uses as
   * its negative control. Kept rather than deleted, per the standing rule that a
   * replaced behaviour becomes a dial.
   */
  const [fontScaleLaw, setFontScaleLaw] = useState<FontScaleLaw>("fixed")
  /** Whether a word wider than the page takes another line or runs on. */
  const [fontWrap, setFontWrap] = useState(true)

  // ── Hand-feel (the path axis, ported from Desk Doodles) ──
  // Defaults to their `rough-handdrawn` calibration: wobble 0.4 with a
  // `protrude` endpoint. 0.4 is not a guess — it is the value Sebs settled on
  // in Desk Doodles after it had been 1.0 ("wobble 1.0→0.4 [...] per Sebs
  // 2026-06-11 ('start at these values') — calmer default line; full range
  // still reachable on the sliders", SvgStyleTransform.tsx:76-78).
  const [wobble, setWobble] = useState<number>(WOBBLE_PRESETS.roughHanddrawn)
  const [endpoint, setEndpoint] = useState<EndpointBehavior>("protrude")

  /**
   * WHICH INK THE LETTER MAP IS READ OFF — see `letterMap` for the measurement.
   *
   * `"hand"` is the pen's own paths. `"ink"` is the hand-feel-decorated ink that
   * renders, which is what shipped and which fused five letters into their
   * neighbours via the protruded tails. Parked, not deleted.
   */
  const [letterFrom, setLetterFrom] = useState<"hand" | "ink">("hand")
  /** See `LETTER_REACH_FRAC`. Both authored words calibrate EXACT across 0.2–0.7. */
  const [letterReach, setLetterReach] = useState<number>(LETTER_REACH_FRAC)

  /** WHICH CLOCK STAMPS THE TRACE — see `PenClock` and the block above it. */
  const [penClock, setPenClock] = useState<PenClock>("lognormal")

  /**
   * WHICH TIP THE PEN LEAVES — read from the shared store, NOT from local state.
   *
   * It is deliberately not `useState`. The tip has two drivers: this panel and
   * `window.__captureHarness.setPenTip`, which the verification sweep uses. A
   * local copy would make the pill lie the moment a probe drove the other one —
   * the same "two sources of truth" shape this page already paid for once with
   * the two mirrored engine pills. `useSyncExternalStore` subscribes to the one
   * store, so whoever writes it, the pill shows what the shader is actually
   * doing.
   *
   * The server snapshot is the same reader: the module initialises to `quill`
   * on both sides, so the first client render matches the HTML.
   */
  const penTip = useSyncExternalStore(subscribePenTip, readPenTipMode, readPenTipMode)

  const rawStrokes = useMemo(
    () =>
      source === "traced"
        ? buildTracedStrokes(penClock)
        : buildFontStrokes(text, penClock, fontScaleLaw, fontWrap),
    [source, text, penClock, fontScaleLaw, fontWrap],
  )
  /**
   * WHAT THE LAW ACTUALLY DID, read after the build rather than predicted.
   *
   * `FONT_METRICS` is written by `buildFontStrokes`, so this has to be keyed on
   * `rawStrokes` — the memo that produced it — or the panel would report the
   * previous word's cap height. Cloned, because the module object is mutated in
   * place and React would see the same reference every time.
   */
  const fontMetrics = useMemo<FontWordMetrics>(
    () => (source === "font" ? { ...FONT_METRICS } : { ...FONT_METRICS, capPx: 0, ratio: 0 }),
    [rawStrokes, source],
  )
  /**
   * WHICH STROKES THE PEN BROUGHT BACK TO ITS OWN START.
   *
   * ── THE DEFECT, MEASURED BEFORE THIS EXISTED ──────────────────────────────
   *
   * The `D` of "Desk" is ONE stroke: down the stem, round the bowl, back up,
   * and off to the left along the top bar, finishing 6.58 px from where it
   * began. `endpoint: "protrude"` extends the first anchor BACKWARD along its
   * outgoing segment — and that segment points straight up the stem, so the
   * tail came out ABOVE the top bar. Measured on the render, desk-doodles:
   * **10 rows of ink standing over the top of the letter, 1 px to 4 px wide,
   * against a 12 px stem.** A needle at 8 % to 33 % of the stem it grows out
   * of. Both `o`s of "Doodles" carry the same beak, for the same reason.
   *
   * It is older than the stub filter and older than the nib. An independent
   * Codex read of `docs/verification/mark-2026-08-28/AB-stubs-Dstem.png` named
   * it — *"a short spike still rises above the top stroke"* — and the shipped
   * AB's own BEFORE panel measures the same 10 rows. The almond blob was
   * sitting on top of it, which is why nobody here had flagged it.
   *
   * ── AND THE FIX WAS ALREADY IN THE ENGINE, WIRED TO NOTHING ───────────────
   *
   * `applyEndpointBehavior` (lib/wobble-field.ts) has carried the correct
   * closed-loop branch since the port: on a closed stroke it pushes every
   * anchor RADIALLY OUTWARD from the centroid instead of extending the two
   * ends along their tangents, so the loop stays a loop and nothing sticks
   * out. `HandFeelSettings.closed` is declared, documented and READ
   * (lib/stroke-processing.ts) — and was written by nothing in the repo. The
   * engines computed closure; the pass that opened the loop never asked them.
   *
   * ── THE PREDICATE IS THE ENGINE'S, NOT A NEW ONE ──────────────────────────
   *
   * `closureStateOf` is the three-state closure the Desk Doodles engine
   * already runs on these very strokes (`lib/dd-engine/adapter.ts`), and
   * `'closed'` is its UNAMBIGUOUS state: gap < max(8 px, 2.5 % of the stroke's
   * own bbox diagonal). Nothing is restated here and no letter is named.
   * Measured over the 13 kept strokes it fires on exactly three — the `D` at
   * 6.58 px and the two `o`s at 6.11 and 1.73 — and its 8 px threshold lands
   * within half a pixel of Inflate's own `inflateChainIsClosed` bound
   * (0.75 × 11.29 px radius = 8.47 px), so hand-feel and the sweep agree about
   * what a loop is. The `D` of "Doodles" sits at 11.60 px, outside both, and
   * is deliberately left alone: an end the sweep will taper anyway is an end
   * the hand is still allowed to overshoot.
   *
   * It is derived from the RAW pen paths, never the processed ones — a loop is
   * a fact about the hand, the same argument the letter map below is built on.
   */
  const closedLoops = useMemo(
    () =>
      rawStrokes.map(
        (s) => closureStateOf(s.points.map((p) => [p.x, p.y] as [number, number])) === "closed",
      ),
    [rawStrokes],
  )
  const processedStrokes = useMemo<ProcessedStroke[]>(
    () =>
      rawStrokes.map((s, i) =>
        processStroke(
          s,
          PROCESS_SETTINGS.spacing,
          PROCESS_SETTINGS.smoothing,
          PROCESS_SETTINGS.preserveCorners,
          45,
          { wobble, endpoint, inkWidth: HERO_INK_WIDTH_PX, closed: closedLoops[i] },
        ),
      ),
    [rawStrokes, closedLoops, wobble, endpoint],
  )

  /**
   * WHAT THE PEN'S RECORDING ACTUALLY SAYS, ON THE STROKES THAT RENDER.
   *
   * Measured with the same two functions the reveal calls, so the panel can
   * never drift from the toggle — the failure `measureTimingCharacter`'s own
   * comment was written against. It is a readout rather than a claim in a
   * tooltip, because "the clock changed" is exactly the sort of thing that
   * silently stops being true.
   */
  /**
   * O5'S LETTER MAP — measured off the pen's own paths, never a table.
   *
   * `lib/hero-letters.ts` groups strokes into letters by whether their INK
   * OVERLAPS, at the same nib width the geometry is built at.
   *
   * ── ⚠ IT USED TO READ `processedStrokes`, AND THAT COST FIVE LETTERS ───────
   *
   * The argument for the processed strokes was written down here and it sounds
   * right: *"measured so the map cannot disagree with what is on screen — the
   * wobble dial moves points, and a map computed from the raw word would put a
   * letter boundary through ink the hand-feel had since fused."* What it missed
   * is that hand-feel does not only WOBBLE the ink, it PROTRUDES it: `endpoint:
   * "protrude"` runs every stroke past its own end, and a tail run past its end
   * lands in the next letter. Measured (`_probe-letter-contact.mjs`), the `e`
   * of "Desk" and the `s` beside it:
   *
   *     raw pen paths     nearest approach 21.3 px   shared contact  0.0 px
   *     after hand-feel   nearest approach  2.2 px   shared contact 36.0 px
   *
   * So the decoration welded them, the map read the decoration, and the two
   * letters were declared one. Over the whole word that is **six pieces, not
   * the eight on record** — `D · esk · D · o · odl · es` — and Sebs watched it:
   * *"they dont go letter by letter — some go multiple at a time."* Three at a
   * time, twice.
   *
   * It also put the word's SILENT BEAT in the wrong place. `letterGapAfter` on
   * the processed strokes returns 3 — a rest in the middle of "Doodles" —
   * because the protrusion shrinks the real word space more than it shrinks the
   * letter spaces. On the pen's own paths it returns 2, which is `D · e · sk`,
   * i.e. after "Desk", which is the answer board §4 O5 asks for.
   *
   * **A letter is a fact about the hand, not about the ink's decoration.** So
   * the map is measured on `rawStrokes` and the prior is a pill rather than a
   * deletion — the ink IS fused on screen at those welds, and whether the
   * boundary tears is a picture question, kept answerable.
   */
  const letterSourceStrokes = letterFrom === "hand" ? rawStrokes : processedStrokes
  const letterMap = useMemo(
    () =>
      assignLetters(
        letterSourceStrokes,
        HERO_INK_WIDTH_PX,
        /* SEED WITH THE FONT'S OWN GROUPING when there is one. The ink law
         * alone promotes every tittle to a letter — `"the quick brown fox
         * jumps"` measured 24 letters against 21 authored — because an `i`'s
         * dot genuinely does not touch its stem. The trace has no authored
         * answer and passes none, so it keeps the pure ink law it has always
         * had. See `lib/hero-letters.ts`. */
        source === "font" ? FONT_LETTER_MAP.of : undefined,
        letterReach,
      ),
    [letterSourceStrokes, source, letterReach],
  )
  /** Where the word gap falls, for the cascade's one silent beat. */
  const letterGap = useMemo(
    () => letterGapAfter(letterSourceStrokes, letterMap),
    [letterSourceStrokes, letterMap],
  )
  /**
   * HOW MANY PIECES ARE MORE THAN ONE LETTER — for the panel's own sentence,
   * subtracted rather than written down.
   *
   * A readout, not a law: nothing in the film consumes it. But the sentence it
   * feeds used to name `e-s-k` and `o-d` in hard-coded prose while the map was
   * actually returning `esk`, `odl` and `es` — panel copy describing a previous
   * measurement, which is the same defect class as a dial whose label does not
   * match what renders. `letters − pieces` is exact whenever the letter count is
   * known, and it is: the traced word IS "Desk Doodles", and the font word is
   * whatever is in the box.
   */
  const letterWordLength = source === "traced" ? TRACED_WORD_LETTERS : text.replace(/\s/g, "").length
  const letterFusedCount = Math.max(0, letterWordLength - letterMap.count)

  /**
   * THE CASCADE'S LAYOUT FOLLOWS THE LIVE WORD — AND SO DOES ITS CLIP.
   *
   * `letterCount` and `letterSilentAfter` are model parameters that describe a
   * MEASUREMENT, so they are written from the measurement rather than left as
   * state a user can drag out of agreement with the ink. Typing a new word or
   * dragging the wobble relays the cascade; nothing else does — and this is why
   * the params are assembled here, after the word, instead of beside `rest`.
   *
   * ⚠ THE LAYOUT FOLLOWED THE WORD AND THE BUDGET DID NOT, which is the same
   * defect the 160-frame `emerge` literal was. `HERO_SHEETS.letterByLetter.emerge` seeds
   * itself from the DEFAULTS, so it is the right length for "Desk Doodles" and
   * for no other word. Every longer word ran its last flips past the clip, into
   * the payoff hold, where `solid` keeps the twos the cascade is excluded from:
   * sampled at 12 Hz while the other letters are drawn at 30, pinned dead
   * edge-on instead of arriving. The labs box is the surface a word gets tried
   * on, so it was reachable by typing.
   *
   * The fix is the sheet's own arithmetic, called on the live params instead of
   * the defaults. `cascadeClipSec` is the one place the length is decided; this
   * is its second caller, not a second copy of its answer.
   */
  const motion = useMemo<HeroMotionParams>(() => {
    const p: HeroMotionParams = {
      ...rest,
      beats,
      letterCount: letterMap.count,
      letterSilentAfter: letterGap,
    }
    // Only O5 cascades — `sampleLetters` returns nothing on the other six — so
    // only O5's `emerge` is a cascade budget. On every other film it is an
    // ordinary clip and the word has no business retiming it.
    if (p.shape !== "letterByLetter") return p
    return { ...p, beats: { ...beats, emerge: cascadeClipSec(p) } }
  }, [rest, beats, letterMap.count, letterGap])

  /**
   * AND THE DOCK IS TOLD, because a clip that DRAWS one length while the film
   * RENDERS another is exactly the drift the write-back above `rest` exists to
   * prevent — it would only have moved the lie from the render to the ruler.
   *
   * The render never waits for this. `motion` already carries the derived clip,
   * so frame 0 is right on the first commit and this only catches the dial up;
   * the note above `motion` is why the derivation is not itself an effect. It
   * settles in one pass: writing the duration feeds `beats`, and `cascadeClipSec`
   * does not read `beats`, so the second pass finds them equal and stops. It
   * also means the cascade's clip cannot be dragged out of agreement with the
   * word, which is the point — the length is decided in one place.
   */
  useEffect(() => {
    if (motion.shape !== "letterByLetter") return
    if (Math.abs(tl.emerge.duration - motion.beats.emerge) < 1e-4) return
    DialStore.updateValues(HERO_TIMELINE_ID, { "emerge.duration": motion.beats.emerge })
  }, [motion.shape, motion.beats.emerge, tl.emerge.duration])

  // Reduced motion removes the swell past full thickness and nothing else —
  // the flat→solid change itself is a value change and survives.
  const played = useMemo<HeroMotionParams>(
    () =>
      reduceMotion
        ? {
            ...motion,
            emerge: { ...motion.emerge, overshoot: 0 },
            // The rise's overshoot is its OWN number now. It used to be read off
            // `emerge.overshoot` — an ink dial — so zeroing the ink quieted the
            // camera by accident, and the accident was load-bearing. Zeroing both
            // is the same behaviour, stated. `assert-hero-camera.mjs`'s reduced
            // row fails if either is dropped.
            riseOvershoot: 0,
            backC1: 0,
          }
        : motion,
    [motion, reduceMotion],
  )
  /**
   * THE END OF THE BEAT, which is the sum of every clip.
   *
   * Not `tl.duration`: DialKit sizes its ruler to `max(the config's own total,
   * the furthest clip end)`, so shortening the beat below the captured 10.2s
   * leaves the dock's ruler with a dead tail. The BEAT ends where the last clip
   * ends, so the transport is clamped to that and the tail is unreachable.
   */
  const total = useMemo(() => totalDuration(played), [played])
  const timeSec = Math.min(tl.time, total)
  const playing = tl.playing
  useEffect(() => {
    if (tl.playing && tl.time >= total) {
      tl.pause()
      tl.seek(total)
    }
  }, [tl, total])
  const sample = useMemo(() => sampleHeroMotion(played, timeSec), [played, timeSec])

  const penReadout = useMemo(() => {
    const rec = measurePenRecord(processedStrokes)
    const tc = measureTimingCharacter(processedStrokes)
    return { rec, tc }
  }, [processedStrokes])
  const timingReadout = penReadout.rec
    ? `${penReadout.rec.durationSec.toFixed(2)} s recorded · character ${(penReadout.tc.maxDeviation * 100).toFixed(2)} %` +
      (penReadout.tc.present ? "" : "  ⚠ below the 1 % floor, so Natural and Authentic render identically")
    : "no usable timing"

  // Hand-feel assertion hook. `scripts/verify/assert-handfeel.mjs` reads the
  // REAL processed strokes off the live page — the same arrays the geometry is
  // built from — so the assertions test what actually renders rather than a
  // re-derivation of it. Dev-surface only; costs one ref write per rebuild.
  useEffect(() => {
    ;(window as unknown as { __handFeelHarness?: unknown }).__handFeelHarness = {
      raw: rawStrokes.map((s) => s.points.map((p) => [p.x, p.y])),
      processed: processedStrokes.map((s) => s.points.map((p) => [p.x, p.y])),
      wobble,
      endpoint,
      inkWidth: HERO_INK_WIDTH_PX,
      // …and WHICH STROKES THE CLOSURE PREDICATE FIRED ON, beside the paths it
      // shaped. A flag that silently stopped reaching the pass is the
      // green-that-cannot-fail this repo keeps shipping, so the reader never
      // has to infer it from a gap that could have moved for other reasons.
      closed: closedLoops,
    }
  }, [rawStrokes, processedStrokes, closedLoops, wobble, endpoint])

  /**
   * K7's payload, measured off the REAL processed strokes rather than asserted.
   *
   * This is the set the renderer needs in order to open the return's paper
   * breaks, and it is also the honest answer to "is there any news in K7 at
   * all" — if the word had no junctions the changed-flat branch would be
   * unbuildable on this mark and that would be a finding, not a nuisance.
   * Recomputed only when the strokes themselves change; the beat's playhead
   * never touches it.
   */
  /* THE PARKED PRIOR SET, and the reason it is reachable at all.
   *
   * The terminal guard was added because the shipped return had a decapitated
   * `l` and a severed `s` — see `findHeroJunctions`. A fix whose defect cannot
   * be reproduced is a fix nobody can check, so `window.__heroJunctionLaw =
   * "prior"` puts the old set back. Dev only, read once per strokes rebuild,
   * same shape as `__heroRevealChannel` below. */
  /* READ IN AN EFFECT, NOT DURING RENDER — and this was caught by the control
   * rather than reasoned about. Reading `window` during render makes the server
   * and the client disagree on the very first pass, and the prior arm's own run
   * reported `Hydration failed because the server rendered text didn't match the
   * client`. The shipped arm was clean only because both sides happened to
   * resolve to "terminals", which is exactly the shape of a latent defect that
   * waits for someone to set the flag. First render is always the shipped law;
   * the override arrives on the next commit and the junction memo recomputes. */
  /* FOUR ARMS, and the three older ones are PARKED rather than replaced (§0.7).
   * `"selfcross"` is the shipped law; `"crossings"` is that law with the
   * self-crossing pass removed and nothing else changed, still selectable and
   * still rendering the 97-px-of-news set it shipped; `"terminals"` is the
   * margin `"crossings"` replaced, still rendering the exact set that shipped
   * before it; `"prior"` is the unguarded 22 that shipped the decapitated `l`.
   * Every defect stays reproducible on demand rather than remembered. */
  const [junctionLaw, setJunctionLaw] = useState<JunctionLaw>("selfcross")
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return
    const w = window as unknown as { __heroJunctionLaw?: string }
    const want = w.__heroJunctionLaw
    if (
      want === "prior" ||
      want === "terminals" ||
      want === "nofarside" ||
      want === "crossings"
    )
      setJunctionLaw(want)
  }, [])
  /* THE AMPLITUDE THE GUARD IS SIZED AGAINST, and it is deliberately the dial
   * rather than `sample.penCarve`. `hero-motion.ts` ships
   * `penCarve = carveAmount × flat`; the break only ever opens at K7, where
   * `flat` is 1, so the carve the law sees there IS `carveAmount`. Keying the
   * memo on the per-frame sample instead would rebuild the junction set on every
   * tick of the beat to reach the same answer. */
  const junctionCarve = motion.carveLaw === "prior" ? 0 : motion.carveAmount
  const junctions = useMemo(
    () =>
      findHeroJunctions(
        processedStrokes,
        HERO_INK_WIDTH_PX,
        junctionLaw,
        junctionCarve,
        motion.ret.breakK,
      ),
    [processedStrokes, junctionLaw, junctionCarve, motion.ret.breakK],
  )
  useEffect(() => {
    ;(window as unknown as { __heroJunctions?: unknown }).__heroJunctions = {
      inkWidth: HERO_INK_WIDTH_PX,
      breakK: motion.ret.breakK,
      // The law that produced this set, published beside it — an arm that
      // silently did not switch is the green-that-cannot-fail this repo keeps
      // shipping, so the reader never has to infer which one ran.
      law: junctionLaw,
      // …and the amplitude it was sized at, for the same reason: `"crossings"`
      // falls back to the parked margin at zero, and a set published without the
      // carve that produced it cannot be told apart from the arm it fell back to.
      carve: junctionCarve,
      list: junctions,
    }
  }, [junctions, motion.ret.breakK, junctionLaw, junctionCarve])

  const settingsRef = useRef<ExportSettings>(PROCESS_SETTINGS)

  // The register drives the 3D surface; `register.lighting` (passed to the
  // viewport below) drives the rig that surface is lit by. Everything else in
  // style state stays at its inert default — the toggle is surface, light and
  // chrome, not a silent switch-on of a pile of screen-space layers.
  const styleState = useMemo<StyleState>(
    () => ({
      ...DEFAULT_STYLE_STATE,
      materialPreset: register.materialPreset,
    }),
    [register.materialPreset],
  )

  const geometryMode: GeometryMode = register.defaultMode

  // WHICH ENGINE BUILDS THE FORM. The acceptance test for the Desk Doodles
  // port is the word "Desk Doodles" reading as ink laid down by a hand rather
  // than extruded pipe, and this is the surface it is judged on — so the
  // engine switch lives here as well as on the lab route, and both flip the
  // same lib/engine-registry.ts axis.
  // THE HERO OPENS ON THE DESK DOODLES ENGINE (F118 lane pen, 2026-09-25). The 08-01
  // draw-in he praised was recorded on it. Measured on the finished word: stroke width
  // p90/p10 2.44 here against the reference's 2.56 and Free Stroke's 1.50; median width
  // 1.73 % of the word against 1.68 % and 2.17 %. `/` keeps DEFAULT_ENGINE_FAMILY.
  const [engineFamily, setEngineFamily] = useState<EngineFamily>("desk-doodles")

  // Engine A/B harness. Lets a capture script hold the register, the lights,
  // the material and the hand-feel dials still and change ONLY whose geometry
  // builds the word — which is the whole point of the comparison.
  useEffect(() => {
    const w = window as unknown as Record<string, unknown>
    w.__engineHarness = {
      setEngine: (family: string) => {
        if (isEngineFamily(family)) setEngineFamily(family)
      },
      get: () => ({ engineFamily, geometryMode }),
    }
    return () => {
      delete w.__engineHarness
    }
  }, [engineFamily, geometryMode])

  /* -- harness wiring ----------------------------------------------------- */

  // The viewport attaches its dev harnesses on mount; poll until they exist
  // rather than assuming an ordering between two independent effects.
  useEffect(() => {
    let raf = 0
    const check = () => {
      const w = window as unknown as Record<string, unknown>
      if (w.__captureHarness && w.__revealHarness) {
        setHarnessReady(true)
        return
      }
      raf = requestAnimationFrame(check)
    }
    raf = requestAnimationFrame(check)
    return () => cancelAnimationFrame(raf)
  }, [])

  /**
   * THE BEAT.
   *
   *   draw     flat ink writes itself in, dead-on
   *   breath   flat, still
   *   emerge   the SAME mark gains depth, then catches the light  <- the beat
   *   tilt on  the volume it just gained is what the camera reveals
   *
   * `flat` and `depth` are two dials on the one form; the reveal playhead keeps
   * drawing it in.
   *
   * KNOWN, AND BEING REPLACED. Sebs on this beat: *"the animation just shows the
   * 3D letter head-on — which yeah will look flat, but it's still 3D. What we had
   * before was it changes between an actual flat lettering, like flat 2D SVG, to
   * 3D rubber."* He is right, and the flat state's own gates cannot see it: they
   * measure the ink INTERIOR, and the whole difference between a pen's outline and
   * a tube's outline is on the BOUNDARY. Measured on medial-axis half-width, this
   * flat state and the settled solid are identical to three decimals (7.07px /
   * spread 0.493 both). See `FlatState` in components/viewport-3d.tsx.
   *
   * The replacement is being storyboarded from the original eased card flip
   * (docs/reference-original/compose.ORIGINAL-FLIP.mjs). Nothing here is worth
   * tuning until that lands.
   */
  /**
   * THE FLAT INK'S COLOUR IS THE MARK'S OWN, NOT THE UI'S TEXT COLOUR.
   *
   * ⚠ THIS USED TO READ `register.palette.textPrimary`, AND IN ONE OF THE TWO
   * REGISTERS THAT MADE THE ENTIRE DRAW-IN INVISIBLE. `FREE_STROKE.palette
   * .textPrimary` is `#f4f4f6` (lib/registers.ts) — a near-white, correct for
   * that register's near-black CHROME (`bg: #0b0b0d`) and catastrophic on the
   * stage, whose paper and grid the register does not control and does not
   * flip. Captured on the real page at 1600×1600, look Free Stroke, engine Desk
   * Doodles: the word is there and reads as pale grey on white
   * (`docs/verification/drawin-parity/before/look-free-stroke__engine-desk-doodles_08.png`);
   * a modal-luma ink count over the whole stage found 2 241 px, which is the
   * grid, against 36 482 px for the same word in the other register.
   *
   * A UI text colour was never the right source. `FlatState` says what the flat
   * state IS: *"not a second layer. It is the SAME MESH, through the SAME
   * camera, driven to render as a drawing"* — so the value that survives the
   * shading collapse has to be the value the MESH is, which is its material's
   * own albedo. `MATERIAL_PARAMS[register.materialPreset].color` is
   * `#26262b` for Free Stroke's `ink` and `#2A2622` for Desk Doodles'
   * `deskDoodles`: the same mark, in each register's own graphite.
   *
   * It also removes a whole class of future version of this bug, because the
   * flat ink can now only ever disagree with the lit surface by as much as the
   * lighting does.
   */
  const flatInkColor = MATERIAL_PARAMS[register.materialPreset].color

  const flatten = useMemo<FlatState>(
    () => ({
      ink: sample.flat,
      depth: sample.depth,
      color: flatInkColor,
      yaw: sample.yaw,
      /* O2's hinge. Optional on the sample for the fast-path reason its own doc
       * gives, so the `?? 0` here is the film-agnostic default and not a guard
       * against a missing value. */
      pitch: sample.pitch ?? 0,
      shade: sample.shade,
      /* THE THREE CHANNELS THE MODEL COMPUTED AND NOTHING RENDERED.
       *
       * `squashX`/`squashY` are K2's anticipation. The storyboard §11.4.3
       * measured all four anticipation frames as identical TO THE DIGIT with
       * the twelve breath frames before them (w 648 · h 158 · ink 28371), and
       * found the cause by grep: the sample reached the render through the
       * material memo, `setProgress` and `orbitView`, and squash was in none of
       * them. `components/viewport-3d.tsx` grew the render consumer; this is
       * the other half, and without both it is still a number in a panel.
       *
       * `shadow` was derived as `1 - ink`, which pops the contact shadow on in
       * the SAME FRAME the face swaps at the edge — two arrivals in one frame,
       * where the board's rule is one piece of news per shot. The model gives
       * it its own `easeOutStrong` landing four frames behind the face. */
      shadow: sample.shadow,
      squashX: sample.squashX,
      squashY: sample.squashY,
      /* K7'S NEWS — the fourth channel, and the same story as the three above.
       *
       * The return shot comes back CHANGED: every junction the fusion hides
       * opens a hairline of paper, with the later-drawn stroke unbroken in
       * front, so the drawing returns carrying its own pen order. The break
       * table and its render consumer both landed; this line is what connects
       * them, and without it the live beat renders K7 identical to K1 and the
       * round trip says nothing.
       *
       * The change is OCCLUSION, never shading — a value difference at a
       * junction would break gate 1 (flat ink SD < 1), which is non-negotiable.
       * Measured on the returned flat: interior sd 0.000, spread 0.0, 1544 px
       * ink→paper, 0 px paper→ink, and every surviving ink pixel keeping its
       * exact value. */
      jointBreak: sample.jointBreak,
      /* THE PEN'S OUTLINE — the fifth channel, and the one Sebs actually
       * complained about.
       *
       * *"THE 2D AND 3D TRANSFORMATION IS WAY TOO SUBTLE LIKE IT'S HARD TO TELL
       * IT WENT FROM 2D TO 3D."* Measured, he is exactly right and the reason is
       * worse than "subtle": the flat state was never 2D. It was the 3D tube
       * with its shading switched off, so across the whole beat the flat state
       * and the settled solid differed ON THE SILHOUETTE by 4.09 % of a stroke
       * radius — and a value-only control accounted for the whole of it. The
       * shipped beat's silhouette change was ZERO.
       *
       * `lib/flat-ink.ts` bakes the nib's own outline into a two-channel signed
       * distance field and `applyPenCarve` carves it out of the tube with one
       * texture fetch and a `discard`. Both landed. Neither was reachable except
       * through the dev-only `setFlatten` override, which is the same
       * dead-channel shape the four lines above this one exist to close: a value
       * the model computes, a consumer that renders it, and no line joining
       * them. This is that line — and the dependency entry below is the other
       * half of it, because a value threaded into a memo whose deps do not
       * mention it renders once and then freezes.
       *
       * It is an OCCLUSION and never a shading, for the identical reason
       * `jointBreak` is: gate 1 (flat ink SD < 1) says a flat drawn mark is one
       * value inside a hard silhouette, and removing coverage leaves every
       * surviving pixel at exactly that one value. The pen outline is a strict
       * subset of the tube envelope by construction (`penHalfWidth` pins the
       * semi-major axis to R and deliberately does not restore the weight), so
       * the silhouette can only ever SHRINK. Driven, on the real render:
       * 8 354 px ink -> paper, **0 px paper -> ink**. */
      penCarve: sample.penCarve,
      /* THE ARRIVAL — the sixth channel, and the one that answers the half of
       * Sebs's complaint the carve did not.
       *
       * *"MAYBE ITS MATERIAL LIGHTING IDK BUT ITS STILL SUPER SUBTLE WHEN IT
       * SWITCHES TO 3D AND I HAVE A HARD TIME NOTICING AT TIMES ITS NOW 3D."*
       * The carve closed the SILHOUETTE half (4.09 % → 39.12 % of a stroke
       * radius). Measured on this page through the value-wash gate's own
       * eroded-interior statistic, the TONAL half was **3.0 luma of median**
       * — flat 20.6, settled solid 23.6 — on a mark whose ink-to-paper
       * contrast is 229 luma. The shape changed and nothing confirmed it.
       *
       * IT IS `1 - flat` AND NOT A CURVE OF ITS OWN. The surface changing state
       * is ONE piece of news, and the rim and the environment are both the
       * surface. So the arrival hard-flips at exactly the frame the ink swap
       * already hides inside the dwell, and nothing new lands on a frame of its
       * own — which is the board's own rule and the same reason the contact
       * shadow, which is a SEPARATE claim about the ground, does get its own
       * beat.
       *
       * `FlatState.lit` is omitted-defaults-0, so this line is the only thing
       * in the repo that turns it on; every other viewport renders byte for
       * byte as before. See `HERO_LIT` / `HERO_LIT_PRIOR` for the numbers and
       * the parked arm. */
      lit: 1 - sample.flat,
      /* O5'S CASCADE — the sixth channel, and the same story as the five above:
       * the model computes it, the renderer consumes it, and this line is what
       * joins them. `undefined` on every other film, which is what keeps the
       * per-letter shader pass at `count 0` on all of them. */
      letters: sample.letters,
    }),
    [
      sample.flat,
      sample.depth,
      sample.yaw,
      sample.shade,
      sample.shadow,
      sample.squashX,
      sample.squashY,
      sample.jointBreak,
      sample.penCarve,
      sample.letters,
      flatInkColor,
    ],
  )

  /**
   * THE DRAW-IN PLAYHEAD — written to a ref, read inside the render loop.
   *
   * ⚠ WHAT THIS REPLACES, AND WHY IT IS HALF OF "FAST AND JANKY".
   * The line here used to be `w.__revealHarness?.setProgress(sample.reveal)`.
   * `__revealHarness` is a DEV-ONLY capture hook — its effect in
   * `components/viewport-3d.tsx` returns early when
   * `NODE_ENV === "production"` — so **in a production build the optional call
   * hit `undefined` and the hero had no draw-in at all.** In development it
   * called a `useState` setter on the viewport once per beat sample, i.e. a
   * full React commit of the entire viewport tree per drawn frame, to move one
   * number that `AnimatedStrokes` reads out of a ref inside `useFrame` anyway.
   *
   * The ref is written during render rather than in an effect on purpose: it is
   * not state, nothing reads it during render, and the frame loop wants the
   * newest value it can get. The effect below still exists for `orbitView`,
   * which is a real imperative camera call.
   */
  const revealRef = useRef<number | null>(null)
  revealRef.current = sample.reveal

  /**
   * THE PARKED PRIOR CHANNEL, AND THE ONLY WAY THE JANK CLAIM CAN BE MEASURED.
   *
   * A claim that the old channel was the jank is worth nothing if the old
   * channel cannot be run. `window.__heroRevealChannel = "state"` puts the beat
   * back on `__revealHarness.setProgress` — a React commit per drawn frame —
   * so `scripts/verify/measure-drawin-frames.mjs` can film both and compare
   * frame-time distributions on the same machine in the same session. Dev only,
   * default `"ref"`, and it is read per frame rather than latched so the harness
   * can flip it between takes without a reload.
   */
  useEffect(() => {
    if (!harnessReady) return
    const w = window as unknown as {
      __captureHarness?: { orbitView: (az: number, el: number, fill: number) => boolean }
      __revealHarness?: { setProgress: (v: number) => void }
      __heroRevealChannel?: string
    }
    if (process.env.NODE_ENV !== "production" && w.__heroRevealChannel === "state") {
      revealRef.current = null
      w.__revealHarness?.setProgress(sample.reveal)
    }
    w.__captureHarness?.orbitView(sample.az, sample.el, sample.fill)
  }, [harnessReady, sample])

  /**
   * RE-FRAME WHEN THE WORD CHANGES — and why a dependency alone is not enough.
   *
   * ⚠ THIS WAS A LATENT BUG THE OLD SCALE LAW WAS HIDING. `orbitView` frames
   * `bounds.radius`, and the bounds come from the WORD. Typing a new word does
   * not move the playhead, so `sample` above is the same object, that effect
   * does not re-run, and the camera stays framed on the PREVIOUS word. Nobody
   * ever saw it, because the old law squeezed every word to the same
   * `FONT_TARGET_W` span — a fixed span is a fixed bounding radius, so a stale
   * framing and a fresh one were the same picture.
   *
   * Holding the cap height makes the extent follow the text and the stale
   * camera became visible on the first ladder run:
   * `docs/verification/word-ladder/v1/fixed/02-hero.png` is "Desk" alone at
   * 2.5x, framed for the two-letter word typed before it, and `05-medium.png`
   * is an empty grid. Neither is a geometry defect. Measured with
   * `_probe-word-frame.mjs`: the published bounds were CORRECT for every rung
   * (r 0.4596 for "ok", 1.2604 for "Desk Doodles"), so only the camera was
   * wrong.
   *
   * ⚠ AND ADDING `processedStrokes` TO THE EFFECT ABOVE DOES NOT FIX IT. The
   * viewport writes `boundsRef` from an effect **inside the R3F tree**, which
   * react-three-fiber commits through its OWN reconciler — those effects are
   * not interleaved with this DOM tree's, so a page effect firing on the same
   * change reads the bounds of the word before. Proven by jiggling the
   * playhead one frame later: the framing corrects itself, on geometry that had
   * not changed.
   *
   * So this WATCHES rather than fires once: for a bounded window after the word
   * changes, re-issue the framing whenever the published bounds differ from the
   * ones the camera was last placed from.
   *
   * ⚠ IT WATCHES ON A CLOCK AND NOT A FRAME COUNT, and that distinction is
   * measured. The first version stopped after 12 frames — ~200ms — on the
   * reasoning that the bounds settle immediately. Single-line words framed
   * correctly and every MULTI-LINE one came back an empty grid
   * (`word-ladder/v3/fixed/05-medium.png`), because more lines is more strokes
   * is a slower implicit-surface build, and the loop gave up before the real
   * bounds existed. The same block framed perfectly under a manual
   * `frontView(1.0)` a second later, which is what named the cause.
   *
   * The comparison is what makes the window cheap: `orbitView` is called only
   * on a frame where the bounds actually moved, so the rest are a float compare
   * and nothing else. The sample is read from a ref, so the beat's own camera
   * parameters are used without making them a dependency and re-arming this on
   * every scrub tick.
   */
  const cameraSampleRef = useRef({ az: sample.az, el: sample.el, fill: sample.fill })
  cameraSampleRef.current = { az: sample.az, el: sample.el, fill: sample.fill }
  useEffect(() => {
    if (!harnessReady) return
    const w = window as unknown as {
      __captureHarness?: {
        orbitView: (az: number, el: number, fill: number) => boolean
        bounds?: () => { radius: number; center: { x: number; y: number } } | null
      }
    }
    let raf = 0
    let framedR = Number.NaN
    let framedX = Number.NaN
    let framedY = Number.NaN
    const started = performance.now()
    /** How long a geometry rebuild is given to produce its bounds. A three-line
     *  block is the slowest case measured and lands well inside this. */
    const WINDOW_MS = 2500
    const tick = () => {
      const h = w.__captureHarness
      if (!h) return
      const b = h.bounds?.()
      if (b && (b.radius !== framedR || b.center.x !== framedX || b.center.y !== framedY)) {
        const c = cameraSampleRef.current
        h.orbitView(c.az, c.el, c.fill)
        framedR = b.radius
        framedX = b.center.x
        framedY = b.center.y
      }
      if (performance.now() - started < WINDOW_MS) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [harnessReady, processedStrokes])

  /**
   * PLAYBACK — the timeline's clock, and only the timeline's clock.
   *
   * The page used to run its own rAF loop here, on an accumulated clock with a
   * 0.25s per-frame clamp. The clamp existed because the page STALLED for about
   * 1.1 seconds at the instant the draw-in completed — the hero word's
   * implicit-fusion surface being rebuilt at full complexity — and an unclamped
   * wall-clock would simply read a timestamp 1.1s later and render THAT pose,
   * skipping the 0.54s emerge entirely. The clamp turned a skipped beat into a
   * slow-motion one: damage control, not a fix, and it could never be more than
   * that while the geometry was being rebuilt inside the beat.
   *
   * The stall is gone at its source. Inflate's implicit surface is now built
   * ONCE and revealed by `setDrawRange` over a build-time arc-length table
   * (lib/implicit-surface.ts §6), so a draw-in frame does no geometry work at
   * all. With nothing left to stall on there is nothing to clamp, which is what
   * makes it safe to hand the clock to DialKit — `TimelineStore.tick` takes a
   * raw, unclamped `now - lastTick`, and would have re-introduced the skipped
   * emerge on the first frame that ran long.
   *
   * Measured before this change (scripts/verify/measure-implicit-cost.mjs, hero
   * word, resolution 5): a rebuild costs 24ms at 5% of the word and 531ms at
   * 100% of it, and one draw-in asks for about 120 of them inside 2.6 seconds.
   */
  const play = useCallback(() => {
    if (tl.time >= total - 0.01) tl.seek(0)
    tl.play()
  }, [tl, total])

  /* The transport's own callbacks are stable across ticks (`useCallback` on
   * `[panelId]` inside dialkit) but the `tl` object they hang off is NOT — it is
   * rebuilt on every rAF, because `TimelineStore.tick` writes a new transport
   * object each frame (`dialkit/dist/index.js:892`). Naming them separately is
   * what keeps the control panel, and `pickFilm`, off `tl`'s per-frame identity. */
  const tlPause = tl.pause
  const tlSeek = tl.seek

  /* THESE ARE `useCallback` FOR A MEASURED REASON, NOT AS A HABIT.
   * They are dependencies of the control panel's `StableSubtree`, and every one
   * of them is a plain arrow closing over nothing but `setRest` — a state setter
   * React already guarantees stable. Left as bare arrows they were new objects
   * on every one of the ~120 renders a second a playing beat causes, so the
   * panel's memo could never hit and the subtree rebuilt anyway: net JS moved
   * only 4.88 -> 4.41 ms/frame and `Pill` still burned 60 ms a beat. With them
   * stable the panel stops rebuilding entirely while the beat plays. */
  const setNum = useCallback(
    (k: keyof HeroMotionRest, v: number) => setRest((m) => ({ ...m, [k]: v }) as HeroMotionRest),
    [],
  )
  const setAnticip = useCallback(
    (k: keyof HeroMotionParams["anticipation"], v: number) =>
      setRest((m) => ({ ...m, anticipation: { ...m.anticipation, [k]: v } })),
    [],
  )
  const setEmerge = useCallback(
    (k: keyof HeroMotionParams["emerge"], v: number) =>
      setRest((m) => ({ ...m, emerge: { ...m.emerge, [k]: v } })),
    [],
  )
  /**
   * The reads — the choices that change what the beat IS rather than how much
   * of it there is. Every one of them has a PARKED prior on the other side, and
   * until now none of them was reachable from this panel: the parameters
   * existed and the page offered no way to feel either arm, which is the same
   * as not having built the option.
   */
  const setRead = useCallback(
    (patch: Partial<HeroMotionRest>) => setRest((m) => ({ ...m, ...patch })),
    [],
  )
  const setReturnMode = useCallback(
    (mode: HeroMotionParams["ret"]["mode"]) => setRest((m) => ({ ...m, ret: { ...m.ret, mode } })),
    [],
  )

  /**
   * PICK A FILM — which writes an exposure sheet into the dock and picks the
   * camera the option is staged for.
   *
   * ⚠ IT WRITES THE TIMELINE, AND THAT IS THE ONLY HONEST WAY TO DO IT. Each of
   * these options is a different EXPOSURE SHEET, not a different setting on one
   * sheet — the cutaway spends 45 frames on a flat hold and 15 on an empty page,
   * the solid-first film has no draw at all. A row of pills that changed the law
   * and left the durations behind would be four films with one film's timing,
   * which is the half-wired shape this page has already paid for.
   *
   * The dock stays the single owner of a duration: this hands it a set of
   * numbers and then reads them straight back, exactly as retiming a clip by
   * hand does. Picking `shipped` writes the shipped sheet, so the row is
   * reversible and no pick is a one-way door.
   *
   * THE CAMERA COMES WITH IT because the board binds one to each film — the
   * cutaway needs the desk ¾ or its standing form casts no shadow and the
   * absence buys nothing. But the camera row underneath stays live afterwards,
   * so crossing a film with a camera it was not staged for is one click and not
   * a rebuild. That is the recommendation living as a default rather than as a
   * lock.
   */
  const filmCamera: Record<HeroShape, HeroCamera> = useMemo(() => ({
    shipped: "prior",
    turnLands: "deadOn",
    solidFirst: "deadOn",
    cutaway: "desk",
    /* O2 BINDS TO THE DESK ¾ AND THE BINDING IS NOT A PREFERENCE. A hinge is
     * invisible dead-on — a mark standing up about its baseline, viewed square
     * to the page, is a mark getting shorter. The desk angle is what makes it a
     * stand, and the board requires it set from frame 0 so gravity is never
     * retconned. */
    popUp: "desk",
    /* STAND & TURN — the desk ¾ for the same reason the pop-up needs it (a
     * hinge is invisible dead-on), and it keeps that camera through the turn so
     * the rotation is unambiguously the OBJECT's. */
    standTurn: "desk",
    /* O5 BINDS DEAD-ON, and the board's own §1.1 is why. At the desk ¾ a
     * letter's flip is already half-legible from the viewpoint, which is fine
     * and is also the option's whole claim being given away by the camera. At
     * C-A nothing is oblique but the LETTERS, so the rank of side walls at the
     * end is unambiguously the objects' — and K1 and K7 are the same picture,
     * which is what makes the closing frame an identity claim. */
    letterByLetter: "deadOn",
  }), [])
  const pickFilm = useCallback(
    (shape: HeroShape) => {
      const sheet = HERO_SHEETS[shape]
      const patch: Record<string, number> = {}
      let at = 0
      for (const ph of HERO_PHASES) {
        patch[`${ph}.duration`] = sheet[ph]
        patch[`${ph}.at`] = at
        at += sheet[ph]
      }
      DialStore.updateValues(HERO_TIMELINE_ID, patch)
      setRest((m) => ({ ...m, shape, camera: filmCamera[shape] }))
      tlSeek(0)
    },
    [filmCamera, tlSeek],
  )

  const copyConstants = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(toMotionMjsSource(motion))
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }, [motion])

  /**
   * How tall the timeline dock currently is, so the page can hold its own
   * transport clear of it. Measured, not assumed — see the spacer below.
   */
  const [dockHeight, setDockHeight] = useState(0)
  useEffect(() => {
    let ro: ResizeObserver | null = null
    let raf = 0
    const attach = () => {
      // The portal root, not the inner scroller: the root also carries the
      // drag-to-resize handle, so measuring the scroller alone leaves the
      // handle sitting over the transport.
      const dock = document.querySelector(".dialkit-root.dialkit-timeline")
      if (!dock) {
        raf = requestAnimationFrame(attach)
        return
      }
      ro = new ResizeObserver(() => setDockHeight(dock.getBoundingClientRect().height))
      ro.observe(dock)
      setDockHeight(dock.getBoundingClientRect().height)
    }
    raf = requestAnimationFrame(attach)
    return () => {
      cancelAnimationFrame(raf)
      ro?.disconnect()
    }
  }, [])

  const cssVars = registerCssVars(register) as React.CSSProperties

  /**
   * THE CONTROL PANEL'S LIVE READOUTS, PRE-FORMATTED — and why this exists.
   *
   * MEASURED, on the real page, dpr 2, real Chrome + Metal, the whole 12.37 s
   * beat through the page's own Play button (`_probe-dial-cpu.mjs
   * --gesture=playback`): the beat spent **4.88 ms of NET JS per rendered
   * frame**, of which **half was the control panel re-rendering** — proved by
   * removing the panel from the tree during playback, which took net JS to
   * 2.39 ms/frame and took frames delivered in a fixed window from **1458 to
   * 1545**. The attribution is React element construction, not our code:
   * `jsxDEV` 1450 ms, `ReactElement` 516 ms, react-dom internals 1499 ms,
   * against three.js + R3F at 1362 ms for the whole beat. React was costing
   * 3.3x what the actual 3D rendering cost.
   *
   * WHY THE PANEL RE-RENDERS AT ALL. `useDialTimeline` subscribes through
   * `useSyncExternalStore`, and `TimelineStore.tick` writes a NEW transport
   * object every rAF (`dialkit/dist/index.js:892`), so the page re-renders on
   * every animation frame and rebuilds the whole panel each time. The panel's
   * *contents* almost never change while the beat plays: the only per-frame
   * things in it are these eleven readouts.
   *
   * SO THE READOUTS ARE HOISTED OUT AS THE STRINGS THEY ACTUALLY DISPLAY. That
   * is what makes the memo below correct BY CONSTRUCTION rather than by taste:
   * the panel is rebuilt exactly when a character of it would differ. Holding
   * `sample` itself would defeat it (a new object every frame), and holding the
   * raw floats would rebuild on changes too small to render — `toFixed` is the
   * same rounding the JSX was already doing, moved one line earlier.
   *
   * The win is largest exactly where the beat is longest: through `draw` (4.6 s
   * of 12.37 s) the camera is parked and every one of these is constant, and
   * `quantiseHeroTime` holds parked phases on twos at 12 Hz
   * (`lib/hero-motion.ts`), so ten of every twelve frames are identical.
   */
  const readAz = sample.az.toFixed(1)
  const readEl = sample.el.toFixed(1)
  const readFill = sample.fill.toFixed(2)
  const readShadow = sample.shadow.toFixed(2)
  const readJointBreak = sample.jointBreak.toFixed(0)
  const readPhase = sample.phase
  const readFlat = sample.flat.toFixed(2)
  const readDepth = sample.depth.toFixed(2)
  const readPenCarve = sample.penCarve.toFixed(2)
  const readSquashX = sample.squashX.toFixed(3)
  const readSquashY = sample.squashY.toFixed(3)
  const liveRead = useMemo(
    () => ({
      az: readAz,
      el: readEl,
      fill: readFill,
      shadow: readShadow,
      jointBreak: readJointBreak,
      phase: readPhase,
      flat: readFlat,
      depth: readDepth,
      penCarve: readPenCarve,
      squashX: readSquashX,
      squashY: readSquashY,
    }),
    [
      readAz,
      readEl,
      readFill,
      readShadow,
      readJointBreak,
      readPhase,
      readFlat,
      readDepth,
      readPenCarve,
      readSquashX,
      readSquashY,
    ],
  )

  return (
    <div
      style={{
        ...cssVars,
        // HEIGHT-BOUNDED, not min-height. With `minHeight` the row below is free
        // to grow to its tallest child — the control column — which made the
        // WebGL canvas ~1000 CSS px tall and framed the word off-screen. The
        // stage has to be sized by the window, and the control column has to
        // scroll inside its own box.
        height: "100vh",
        overflow: "hidden",
        background: "var(--reg-bg)",
        color: "var(--reg-body)",
        fontFamily: "var(--reg-body-font)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ---- header ---- */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "16px 24px",
          borderBottom: "1px solid var(--reg-border)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span
            style={{
              fontFamily: "var(--reg-display)",
              fontSize: 22,
              color: "var(--reg-text)",
            }}
          >
            Hero beat
          </span>
          <span style={{ fontSize: 11, color: "var(--reg-body-soft)" }}>
            flat ink stands up off the page
          </span>
        </div>

        {/* TWO AXES, TWO LABELS, ONE OPTION ORDER.
            This header used to carry two unlabelled segmented pills with
            identical styling, adjacent, whose options were the SAME TWO WORDS in
            OPPOSITE ORDER — "Desk Doodles | Free Stroke" immediately followed by
            "Free Stroke | Desk Doodles". Sebs: *"these toggles switching between
            the two make no sense."* Nothing on screen said which pill was the
            look and which was the geometry engine, and the mirrored order made
            the two active states read as a contradiction.
            The lab route already had this right (`ENGINE  Free Stroke | Desk
            Doodles`, with the word ENGINE beside it), so this is the page that was
            inconsistent. Both pills are now named, and both list Desk Doodles
            first so a glance compares like with like. */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <PillGroup label="Look" ariaLabel="Visual register" hint="Which register's surface, light and chrome the page wears">
            {REGISTER_ORDER.map((id) => (
              <Pill
                key={id}
                active={id === registerId}
                onClick={() => setRegisterId(id)}
                title={REGISTERS[id].note}
                data-register-option={id}
              >
                {REGISTERS[id].label}
              </Pill>
            ))}
          </PillGroup>

          <div data-engine-family={engineFamily}>
            <PillGroup label="Engine" ariaLabel="Geometry engine" hint="Which codebase's geometry builds the form">
              {ENGINE_FAMILIES.map((fam) => (
                <Pill
                  key={fam.value}
                  active={fam.value === engineFamily}
                  onClick={() => setEngineFamily(fam.value)}
                  title={fam.tooltip}
                  data-engine-option={fam.value}
                >
                  {fam.label}
                </Pill>
              ))}
            </PillGroup>
          </div>

          <a
            href="/"
            style={{ fontSize: 11, color: "var(--reg-secondary)", textDecoration: "none" }}
          >
            ← Lab
          </a>
        </div>
      </header>

      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* ---- stage ---- */}
        <main
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div data-hero-stage ref={stageRef} style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <Viewport3DWrapper
              processedStrokes={processedStrokes}
              rawStrokes={rawStrokes}
              geometryMode={geometryMode}
              inflateParams={HERO_INFLATE}
              styleState={styleState}
              lighting={register.lighting}
              engineFamily={engineFamily}
              flatten={flatten}
              /* O5. Passed on every film, not only on the cascade: the map is a
                 fact about the WORD, and handing it over conditionally would
                 re-stamp every geometry each time the film pill moved. It is
                 inert until a film asks for it. */
              letterMap={letterMap}
              // This page owns the clock. Without it the viewport draws its own
              // play button, its own scrub bar and its own seconds readout of the
              // STROKE timeline (~14s) directly under the beat transport's 10.2s —
              // two playheads, two scrub bars, one frame.
              chromeless
              revealRef={revealRef}
              settingsRef={settingsRef}
            />
          </div>

          {/* ---- transport ---- */}
          <div
            style={{
              borderTop: "1px solid var(--reg-border)",
              padding: "12px 24px 20px",
              background: "var(--reg-raised)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <button
                data-hero-play
                onClick={() => (playing ? tl.pause() : play())}
                style={{
                  padding: "8px 20px",
                  fontSize: 11,
                  letterSpacing: "var(--reg-caps-tracking)",
                  textTransform: "uppercase",
                  borderRadius: "var(--reg-pill)",
                  border: "none",
                  cursor: "pointer",
                  background: "var(--reg-accent)",
                  color: "var(--reg-on-accent)",
                }}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                onClick={() => {
                  tl.pause()
                  tl.seek(0)
                }}
                style={{
                  padding: "8px 16px",
                  fontSize: 11,
                  letterSpacing: "var(--reg-caps-tracking)",
                  textTransform: "uppercase",
                  borderRadius: "var(--reg-pill)",
                  border: "1px solid var(--reg-border)",
                  cursor: "pointer",
                  background: "transparent",
                  color: "var(--reg-secondary)",
                }}
              >
                Reset
              </button>
              {/* PHASE, WITH ITS OWN PROGRESS.
                  The bare phase name reads as a lie at every boundary. At 0.01
                  into `standup` the readout said STANDUP while the pose showed
                  `el 65.1° · fill 1.000` — the LYING elevation and the lying
                  distance — which looks like the label and the sampler
                  disagreeing. They do not: the stand-up BEGINS at the lying pose,
                  and `easeInOutBack`'s anticipation dip goes very slightly
                  negative first, which is exactly why 65.0 reads as 65.1 and
                  1.000 as a hair over 1. Showing how far into the phase the
                  playhead is turns an apparent contradiction back into the
                  information it always was. */}
              <span
                data-hero-phase={sample.phase}
                data-hero-phase-t={sample.phaseT.toFixed(3)}
                /* THE DRAW PHASE'S OWN WINDOW, published for the harnesses.
                   `assert-drawin-parity` has to scrub INSIDE the draw and
                   nowhere else; hard-coding 2.13s there would silently measure
                   the wrong window the moment a clip edge is dragged in the
                   dock, which is the one thing the timeline-owns-the-durations
                   rule exists to prevent. Read off the TIMELINE, which is the
                   single owner of both numbers, so it cannot disagree with the
                   pose the sampler produces. */
                data-hero-draw-span={JSON.stringify({
                  at: tl.draw.at,
                  duration: beats.draw,
                })}
                /* THE CARVE, PER FRAME, BESIDE THE PHASE — so a capture can
                   scrape what the model actually published rather than infer it
                   from the flag that asked for it. The projection arm's own
                   comment in `verify-hero-transition.mjs` states the rule this
                   follows: *"A control that silently fails to take produces a
                   capture identical to the shipped arm — which would then be
                   reported as 'the control passed too'."* `--carve=prior` is
                   exactly such a control, so it is asserted off this attribute
                   at capture time and recorded per frame in the manifest. */
                data-hero-carve={sample.penCarve.toFixed(3)}
                data-hero-carve-law={motion.carveLaw}
                /* THE FORM CHANNELS, PER FRAME, FOR THE SAME REASON THE CARVE
                   IS HERE. The 2D→3D switch is a TONAL event stacked on a
                   silhouette event, and judging it means knowing exactly which
                   captured frame is the last drawing and which is the first
                   object. Inferring that from the phase percentage is inference;
                   `flat` flips inside the DWELL, which is a sub-phase the phase
                   readout does not name. Sebs: *"IT'S STILL SUPER SUBTLE WHEN IT
                   SWITCHES TO 3D."* A measurement of how subtle needs the switch
                   frame identified by the model rather than by eye, so this
                   publishes what the model actually handed the renderer. */
                /* THE CASCADE'S OWN THREE NUMBERS, published for exactly the
                   reason `data-hero-draw-span` above is published: a harness
                   that wants to know whether the clip followed the word CANNOT
                   read it off `HERO_SHEETS`, which only ever knows the default
                   word's answer, and re-deriving it out here would be a second
                   copy of the thing being checked. So the page states what it
                   actually laid out. `assert-hero-options` can reach the model
                   and grep this file; only a browser can reach this. Undefined
                   on the six films that do not cascade — an attribute that is
                   present and meaningless is worse than one that is absent. */
                data-hero-cascade={
                  motion.shape === "letterByLetter"
                    ? JSON.stringify({
                        pieces: motion.letterCount,
                        silentAfter: motion.letterSilentAfter,
                        clip: motion.beats.emerge,
                      })
                    : undefined
                }
                data-hero-flat={sample.flat.toFixed(4)}
                data-hero-depth={sample.depth.toFixed(4)}
                data-hero-shade={sample.shade.toFixed(4)}
                data-hero-yaw={sample.yaw.toFixed(4)}
                style={{
                  fontSize: 11,
                  letterSpacing: "var(--reg-caps-tracking)",
                  textTransform: "uppercase",
                  color: "var(--reg-text)",
                }}
              >
                {sample.phase}{" "}
                <span style={{ color: "var(--reg-body-soft)", fontVariantNumeric: "tabular-nums" }}>
                  {Math.round(sample.phaseT * 100)}%
                </span>
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: "var(--reg-detail)",
                  fontVariantNumeric: "tabular-nums",
                  marginLeft: "auto",
                }}
              >
                {timeSec.toFixed(2)}s / {total.toFixed(2)}s · az {sample.az.toFixed(1)}° · el{" "}
                {sample.el.toFixed(1)}° · fill {sample.fill.toFixed(3)}
              </span>
            </div>

            <input
              data-hero-scrub
              type="range"
              min={0}
              max={total}
              step={0.01}
              value={timeSec}
              onChange={(e) => {
                tl.pause()
                tl.seek(parseFloat(e.target.value))
              }}
              style={{ width: "100%", accentColor: "var(--reg-accent)" }}
            />

            {/* phase ruler — proportional, so re-timing a beat is visible */}
            <div style={{ display: "flex", marginTop: 6, gap: 2 }}>
              {HERO_PHASES.map((ph) => {
                const w = (beats[ph] / total) * 100
                const active = sample.phase === ph
                return (
                  <div
                    key={ph}
                    title={`${ph}, ${beats[ph].toFixed(2)}s · drag its bar in the timeline dock to retime it`}
                    style={{
                      width: `${w}%`,
                      height: 3,
                      borderRadius: 2,
                      background: active ? "var(--reg-accent)" : "var(--reg-muted)",
                      transition: "background 120ms linear",
                    }}
                  />
                )
              })}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--reg-body-soft)" }}>
              {harnessReady
                ? "Live: the camera and the draw-in are being driven in the real 3D scene."
                : "Waiting for the 3D scene to attach…"}
            </div>
          </div>
        </main>

        {/* ---- controls ---- */}
        {/* THE DEPENDENCY LIST IS DERIVED, NOT WRITTEN.
            It is the exact set of free variables of the subtree below, computed
            from the TypeScript AST — identifiers referenced inside, minus what
            the block binds itself, minus module scope. A regex cannot do this
            job: JSX text content is not quoted, so prose leaks in as
            identifiers, and the first attempt returned 459 "dependencies"
            including `the` and `paper`.
            A MISSING dep here is a stale panel — the dead-control defect this
            repo has shipped three times. An UNSTABLE dep is merely a missed
            optimisation, never a wrong pixel, so the failure is one-sided and it
            fails safe. RE-DERIVE AFTER EDITING THIS SUBTREE. */}
        <StableSubtree
          deps={[
            beats,
            copied,
            copyConstants,
            endpoint,
            fontMetrics,
            fontScaleLaw,
            fontWrap,
            junctions,
            letterMap,
            liveRead,
            motion,
            penClock,
            penTip,
            pickFilm,
            rawStrokes,
            reduceMotion,
            register,
            setAnticip,
            setEmerge,
            setEndpoint,
            setFontScaleLaw,
            setFontWrap,
            setNum,
            setPenClock,
            setRead,
            setRest,
            setReturnMode,
            setSource,
            setText,
            setWobble,
            source,
            text,
            timingReadout,
            tlPause,
            tlSeek,
            total,
            wobble,
          ]}
        >
          {() => (
        <aside
          // Named so a verification pass can photograph the CONTROL COLUMN
          // rather than the whole window: `verify-hero-windup.mjs` shoots this
          // on four reads to show which dials are present on each.
          data-hero-panel
          style={{
            flex: "0 0 320px",
            minWidth: 280,
            minHeight: 0,
            borderLeft: "1px solid var(--reg-border)",
            background: "var(--reg-raised)",
            padding: "20px 20px 48px",
            overflowY: "auto",
          }}
        >
          <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
            {register.note}
          </div>

          <Section title="Word" note={source === "font" ? "single-stroke font" : "traced by hand"}>
            <div
              style={{
                display: "flex",
                gap: 2,
                padding: 3,
                borderRadius: "var(--reg-pill)",
                background: "var(--reg-muted)",
                marginBottom: 12,
              }}
            >
              {(["traced", "font"] as const).map((s) => {
                const active = s === source
                return (
                  <button
                    key={s}
                    data-word-source={s}
                    aria-pressed={active}
                    onClick={() => setSource(s)}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      fontSize: 11,
                      letterSpacing: "var(--reg-caps-tracking)",
                      textTransform: "uppercase",
                      borderRadius: "var(--reg-pill)",
                      border: "none",
                      cursor: "pointer",
                      background: active ? "var(--reg-accent)" : "transparent",
                      color: active ? "var(--reg-on-accent)" : "var(--reg-secondary)",
                    }}
                  >
                    {s === "traced" ? "Traced" : "Any text"}
                  </button>
                )
              })}
            </div>
            {source === "font" ? (
              <>
                <input
                  data-word-input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Type anything"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    fontSize: 13,
                    fontFamily: "var(--reg-body-font)",
                    color: "var(--reg-text)",
                    background: "var(--reg-bg)",
                    border: "1px solid var(--reg-border)",
                    borderRadius: "var(--reg-pill)",
                    outline: "none",
                  }}
                />

                {/* ---- the scale law, and its parked prior ---------------- */}
                <div
                  style={{
                    display: "flex",
                    gap: 2,
                    padding: 3,
                    marginTop: 8,
                    borderRadius: "var(--reg-pill)",
                    background: "var(--reg-muted)",
                  }}
                >
                  {(
                    [
                      ["fixed", "Hold size"],
                      ["fit", "Fit width"],
                    ] as const
                  ).map(([id, label]) => {
                    const active = id === fontScaleLaw
                    return (
                      <button
                        key={id}
                        data-word-scale={id}
                        aria-pressed={active}
                        onClick={() => setFontScaleLaw(id)}
                        style={{
                          flex: 1,
                          padding: "5px 8px",
                          fontSize: 10,
                          letterSpacing: "var(--reg-caps-tracking)",
                          textTransform: "uppercase",
                          borderRadius: "var(--reg-pill)",
                          border: "none",
                          cursor: "pointer",
                          background: active ? "var(--reg-accent)" : "transparent",
                          color: active ? "var(--reg-on-accent)" : "var(--reg-secondary)",
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                <button
                  data-word-wrap
                  aria-pressed={fontWrap}
                  onClick={() => setFontWrap((v) => !v)}
                  disabled={fontScaleLaw === "fit"}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: "5px 8px",
                    fontSize: 10,
                    letterSpacing: "var(--reg-caps-tracking)",
                    textTransform: "uppercase",
                    borderRadius: "var(--reg-pill)",
                    border: "1px solid var(--reg-border)",
                    cursor: fontScaleLaw === "fit" ? "not-allowed" : "pointer",
                    opacity: fontScaleLaw === "fit" ? 0.4 : 1,
                    background: fontWrap ? "var(--reg-muted)" : "transparent",
                    color: "var(--reg-secondary)",
                  }}
                >
                  {fontWrap ? "Wrap onto lines" : "One line, runs on"}
                </button>

                {/* ---- WHAT THE LAW DID, measured off the built strokes.
                        A readout and not a promise: the ratio below is the one
                        number the whole legibility argument turns on, so it is
                        shown rather than asserted in a tooltip. ------------- */}
                <div
                  data-word-metrics={JSON.stringify(fontMetrics)}
                  style={{
                    marginTop: 8,
                    fontSize: 10,
                    color: "var(--reg-body-soft)",
                    lineHeight: 1.6,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {rawStrokes.length === 0 ? (
                    <span>Nothing drawable in that text yet.</span>
                  ) : (
                    <>
                      cap {fontMetrics.capPx.toFixed(0)} px · nib/cap{" "}
                      <strong style={{ color: fontMetrics.ratio > FONT_R_CEILING ? "var(--reg-accent)" : "inherit" }}>
                        {fontMetrics.ratio.toFixed(3)}
                      </strong>{" "}
                      / {FONT_R_CEILING} · {fontMetrics.letterCount} letters ·{" "}
                      {fontMetrics.lineCount} line{fontMetrics.lineCount === 1 ? "" : "s"}
                      {fontMetrics.ratio > FONT_R_CEILING
                        ? ". The nib is wider than the letterforms can carry; counters will close."
                        : ""}
                    </>
                  )}
                  {fontMetrics.unsupported.length > 0 ? (
                    <div style={{ marginTop: 4 }}>
                      Not in this font, drawn as space:{" "}
                      <strong>{fontMetrics.unsupported.join(" ")}</strong>
                    </div>
                  ) : null}
                </div>

                <div style={{ marginTop: 6, fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
                  {fontScaleLaw === "fixed"
                    ? `Every word is drawn at the hero's own cap height, so the pen stays the same
                       fraction of a letter however long the text is, which is what a hand does. Longer text
                       takes another line rather than shrinking. ${SUPPORTED.trim().length} characters; accents fold onto
                       their base letter.`
                    : `The parked prior law: squeeze the word to a fixed span whatever its length.
                       The pen does not shrink with it, so past about twenty characters the counters
                       close and the letters fuse. This is the setting that produced the five discs.`}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
                The logo as actually drawn. The traced handwriting the film uses.
              </div>
            )}
          </Section>

          <Section title="Hand" note="ported from Desk Doodles">
            <Dial
              label="Wobble"
              value={wobble}
              min={0}
              max={1.4}
              step={0.05}
              onChange={setWobble}
              hint="Where the path GOES, not how it's shaded. A seeded noise field sampled by arc length, one cycle per 35-90px, displacing the anchors, so the line wanders like a hand instead of tracing the font exactly. Each stroke seeds off its own coordinates, so the two D's in the word wobble differently. 0 = the exact font. 0.4 = Desk Doodles' rough-handdrawn default. Past 1.4 it enters Excalidraw's signature zone."
            />
            <div style={{ display: "flex", gap: 2, padding: 3, borderRadius: "var(--reg-pill)", background: "var(--reg-muted)", marginBottom: 8 }}>
              {(["clean", "protrude", "long-overshoot", "kink"] as const).map((e) => {
                const active = e === endpoint
                return (
                  <button
                    key={e}
                    onClick={() => setEndpoint(e)}
                    style={{
                      flex: 1,
                      padding: "6px 4px",
                      fontSize: 9,
                      letterSpacing: "var(--reg-caps-tracking)",
                      textTransform: "uppercase",
                      borderRadius: "var(--reg-pill)",
                      border: "none",
                      cursor: "pointer",
                      background: active ? "var(--reg-accent)" : "transparent",
                      color: active ? "var(--reg-on-accent)" : "var(--reg-secondary)",
                    }}
                  >
                    {e === "long-overshoot" ? "long" : e}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
              A hand doesn&apos;t stop exactly on the mark. Protrude overshoots each
              stroke end by 4px, long by 9px; kink pushes every anchor at a random
              angle instead. Clean is the machine.
            </div>
          </Section>

          {/* ── THE FILM, AND WHERE THE CAMERA IS ───────────────────────────
              Sebs: *"none of the weird camera angles are fixed. where tf are
              the toggles i had for the different type of animations — remember
              i asked to come up with some of ur own as well"*. Both rows are
              that, and they are the biggest choice on this panel, so they sit
              above the reads rather than inside them.

              COPY LAW, same as everything below: what the film IS and what the
              camera being there buys. No parameter names, no degrees. */}
          <Section title="The film" note="the whole beat, seven ways">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <PillRow
                label="Film"
                ariaLabel="Which animation the beat is"
                hint="Seven whole films, each with its own timing sheet. As shipped is the beat as it stands. Turn lands is the same turn, but it stops short of head-on so the mark ends showing you its side. Solid first runs the arc backwards. It opens on the object and ends on your drawing. Cutaway never shows the change at all: the ink goes, the page is empty for half a second, and it comes back standing. Pop-up is the only one that performs the sentence: the drawing hinges up off the page about its own baseline, seen from the desk the whole time. Stand &amp; turn is that stand plus the thing it leaves out. Once it is up it holds, then turns on its own axis to show you it has a body, and the camera never moves for any of it. Letter by letter is the long one: instead of the whole word turning once, each letter turns on its own beat, so one moment becomes a run of them and the word ends as a row of standing letters."
              >
                {(
                  [
                    ["shipped", "as shipped"],
                    ["turnLands", "turn lands"],
                    ["solidFirst", "solid first"],
                    ["cutaway", "cutaway"],
                    ["popUp", "pop-up"],
                    ["standTurn", "stand & turn"],
                    ["letterByLetter", "letter by letter"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-film={id}
                    active={motion.shape === id}
                    onClick={() => pickFilm(id)}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillRow>

              <PillRow
                label="Camera"
                ariaLabel="Where the camera is and whether it moves"
                hint="Four moves is what ships: the camera dives, rises, holds and comes back, and the mark never moves while it does. The other three park it. Dead-on is square to the page for the whole film, so the last frame is the same picture as the first. Desk ¾ is you looking at your own notebook, set before the first stroke, and it is the only one where the shadow on the page is worth anything. One cut opens dead-on and cuts once to the desk on a held frame, then cuts back."
              >
                {(
                  [
                    ["prior", "four moves"],
                    ["deadOn", "dead-on"],
                    ["desk", "desk ¾"],
                    ["cut", "one cut"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-camera={id}
                    active={motion.camera === id}
                    onClick={() => setRead({ camera: id })}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillRow>
            </div>

            {/* THE POP-UP'S TWO NUMBERS, and they only exist while it is the
                active film — a dial that does nothing on four films out of five
                is the dead-dial class this beat has shipped three times.

                These are the two the board hands to Sebs by name: how far it
                stands, and whether the stand commits early or late. Both were
                constants until now, which is the same as not having built the
                choice. */}
            {motion.shape === "popUp" && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                <Dial
                  label="Stands up"
                  value={motion.popStandDeg}
                  min={0}
                  max={90}
                  step={1}
                  unit="°"
                  onChange={(v) => setNum("popStandDeg", v)}
                  hint="How far the word rises off the page. It starts flat on the desk, so this is the TRAVEL, not the angle it ends at. 90° stands it dead upright, which at this camera presents its own edge, the thinnest read of the one shot whose whole claim is thickness. 78° leans it back enough to keep the face while the side walls and the shadow do the standing. 0 is the control: the word never leaves the page."
                />
                <Dial
                  label="Commit"
                  value={motion.popStandFH}
                  min={0.35}
                  max={0.75}
                  step={0.01}
                  onChange={(v) => setNum("popStandFH", v)}
                  hint="How the stand is spaced. The share of the rise bought in the first half of its time. 0.67 is paper-street's cut-out, the only measured flat-thing-stands-up in either reference film set: it leans up quickly and takes its time committing. 0.50 is the even, mechanical read the board names as the fallback if 0.67 feels performed. Three frames apart, and the difference is whether it reads as a made thing or a machine."
                />
              </div>
            )}

            {/* O5's FOUR NUMBERS, and the same rule the pop-up's two follow:
                they render only while the cascade is the active film. Every one
                of them is a choice the board hands over by name — how far the
                letters end up turned, how long the first one is left alone, how
                often the rest arrive, and whether the late beats double up. */}
            {motion.shape === "letterByLetter" && (
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5, marginBottom: 6 }}>
                  This word flips as <strong>{letterMap.count} pieces</strong>, not{" "}
                  {letterWordLength} letters. {letterFusedCount === 0
                    ? "Every piece is one letter."
                    : letterFusedCount === 1
                      ? "One of them is a run your hand drew without lifting the pen, so it turns as a pair."
                      : `${letterFusedCount} of them are runs your hand drew without lifting the pen, so they turn as bound groups.`}{" "}
                  Each piece flips on its own beat.
                </div>
                <PillRow
                  label="Letters read from"
                  ariaLabel="letter map source"
                  hint="Which ink decides where one letter ends and the next begins. THE HAND is the pen's own paths, what you actually wrote. THE INK is those paths after the hand-feel pass has wobbled and protruded them, which is what shipped, and it is why the word used to flip as six pieces instead of ten: a protruded tail runs past its own end into the next letter, and the map counted that as one mass of graphite. The ink really is joined there, so this pill is how you check whether splitting it tears anything."
                >
                  {(
                    [
                      ["hand", "the hand"],
                      ["ink", "the ink (prior)"],
                    ] as const
                  ).map(([v, l]) => (
                    <Pill
                      key={v}
                      active={letterFrom === v}
                      onClick={() => setLetterFrom(v)}
                      title={l}
                      data-letter-from={v}
                    >
                      {l}
                    </Pill>
                  ))}
                </PillRow>
                <Dial
                  label="Fused when closer than"
                  value={letterReach}
                  min={0.1}
                  max={1}
                  step={0.05}
                  unit=" nib"
                  onChange={setLetterReach}
                  hint="How close two strokes have to run before they count as one mass of graphite rather than two letters. It is a fraction of the nib: 1.0 means the two edges merely graze and share no area at all, 0.5 means each stroke's centre line is buried inside the other's ink. It shipped at 1.0, and at 1.0 an authored 21-letter word came back as 10, half the alphabet swallowed by its neighbours. Both test words come out exactly right anywhere between 0.2 and 0.7."
                />
                <Dial
                  label="Ends turned"
                  value={motion.letterLandYaw}
                  min={0}
                  /* 70, not 45. Board §4 O5: *"push it until the side walls
                   * read."* Measured at the parked dead-on camera, the rank's
                   * ink core moves 29.2 -> 30.6 luma across 0-42 deg — i.e. not
                   * at all — so a ceiling of 45 was a ceiling on a control that
                   * had not been shown to do anything yet. See the hint. */
                  max={70}
                  step={1}
                  unit="°"
                  onChange={(v) => setNum("letterLandYaw", v)}
                  hint="How far each letter is left turned once it lands. This is the whole reason the film works square-on: a letter that finishes facing you finishes looking exactly like the drawing it was, so the word has to end as a row of turned letters rather than the drawing again. The reference band said 16° and 16° turned out to do almost nothing. The rank is the same picture at 0° and at 16°, because these marks are round rods and a rod turned about its own axis has no flat side to show. What does change is the width: the word loses about a tenth of its ink between 0 and 50. 30° is as far as it goes while still reading as Desk Doodles; past 50 the two o's swallow each other. 0 is the control. Every letter turns and lands invisible."
                />
                <Dial
                  label="First letter alone"
                  value={motion.letterLeadSec}
                  min={0.2}
                  max={1.4}
                  step={0.033}
                  unit="s"
                  onChange={(v) => setNum("letterLeadSec", v)}
                  hint="How long the first flip is left on its own before the rest start. It is the only one that gets the full ceremony, the pause at the edge included, because the audience has to learn what a flip IS on one letter before a rhythm of them can mean anything. 0.667s is the gap the reference set uses for exactly this, measured twice. Shorten it and the first letter stops being a teacher; lengthen it and the film stalls before it starts."
                />
                <Dial
                  label="Beat"
                  value={motion.letterBeatSec}
                  min={0.2}
                  max={0.9}
                  step={0.02}
                  unit="s"
                  onChange={(v) => setNum("letterBeatSec", v)}
                  hint="How often a letter flips after that. 0.467s, the reference set's 0.46 rounded to a whole 14 frames, which matters more than the third decimal: a cascade is one event repeated, and an interval that falls between two frames catches every repeat at a different point, so the same flip is drawn a different way each time it happens. That is what made it feel like something was glitching. Faster than about 0.3 and the eye registers that something changed but never what. Slower than about 0.6 and the run stops reading as one gesture."
                />
                <Dial
                  label="Doubling from"
                  value={motion.letterPairFrom}
                  min={-1}
                  max={Math.max(0, letterMap.count - 1)}
                  step={1}
                  onChange={(v) => setNum("letterPairFrom", v)}
                  hint="Whether the later beats flip TWO pieces at once instead of one. The reference trick is that the rhythm holds steady while the content thickens, same interval, more happening per beat. −1 is off, and off is the default because you asked for letter by letter and this is the control that puts multiple-at-a-time back. Worth seeing once, on the late beats only, where the reference set actually does it."
                />
                <Dial
                  label="Edge held"
                  value={motion.letterEdgePinSec}
                  min={0}
                  max={0.1}
                  step={1 / 30}
                  unit="s"
                  onChange={(v) => setNum("letterEdgePinSec", v)}
                  hint="Whether each letter stops for a single frame at the exact moment it is edge-on. The board says not to, because eleven pauses in a row read as a flicker. Built that way, three of the eight letters never actually got near their edge: the narrowest frame of each was a third of the letter still showing, decided by where the frame grid happened to fall. The thin edge is the whole reason this film works square-on, so one frame pins it there for every letter. That is not a pause you can see; it is the guarantee the moment exists. 0 is the board's literal instruction, and it is the control."
                />
              </div>
            )}

            {/* WHY THE PARKED CAMERAS EXIST, in the one place he will read it —
                beside the control, not in a doc comment. */}
            <div style={{ marginTop: 10, fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
              {motion.camera === "prior" ? (
                <>
                  The shipped camera dives to look down at the page, rises, holds
                  and comes back. Four moves. The claim is that the drawing stands
                  up; between the turn and the hold the drawing does not move at
                  all, so it is the <em>camera</em> that stands up, and a camera
                  move reads as <em>I moved</em>, not <em>it moved</em>. Nine of
                  eleven reference clips park the camera and turn the object
                  instead; the original set has zero pixels of camera drift in 114
                  seconds.
                </>
              ) : (
                <>
                  Parked. The camera watches and the mark performs. The tip-back,
                  the rise, the orbit and the square-up are all held frames now,
                  and the push is gone with them (a push on one object in an empty
                  frame is a zoom, and a zoom says magnification, not depth). The
                  film opens and closes at the same size, which is what makes the
                  last frame an <em>identity</em> rather than a resemblance.
                </>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--reg-detail)", lineHeight: 1.5, fontVariantNumeric: "tabular-nums" }}>
              <span data-hero-film={motion.shape}>{motion.shape}</span> ·{" "}
              <span data-hero-camera={motion.camera}>{motion.camera}</span> · {total.toFixed(2)}s ·
              az {liveRead.az}° el {liveRead.el}° fill {liveRead.fill}
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
              Not built, and named rather than half-wired: the pop-up (the word
              hinges up about its baseline), drawn-in-both (each stroke pops solid
              at its own pen-lift) and letter-by-letter (eleven flips on the
              hand&apos;s own cadence). All three need the mark to move in a way the
              renderer cannot do yet. A hinge is one rotation it does not compose,
              and the other two need per-stroke and per-letter state where there is
              one value for the whole word.
            </div>
          </Section>

          <Section title="Reads" note="what the beat is">
            {/* OPTION-FACING COPY ONLY. Each row is a choice you can feel, named
                for what it does to the picture — never for the parameter behind
                it. Every alternative here is a real parked read, not a debug
                switch: the prior behaviour of each is one click away. */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <PillGroup
                label="Ending"
                ariaLabel="How the beat ends"
                hint="Changed: the drawing comes back showing which stroke went over which. Same: it comes back exactly as it left, the way the original flip does. None: it never comes back. The film stops on the three-quarter."
              >
                {(
                  [
                    ["changed", "changed"],
                    ["identical", "same"],
                    ["prior", "none"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-ending={id}
                    active={motion.ret.mode === id}
                    onClick={() => setReturnMode(id)}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillGroup>

              <PillGroup
                label="Exposure"
                ariaLabel="How many states per second"
                hint="Twos holds every state for two frames wherever the camera is parked, which is what a hand-drawn film does and a large part of why one reads as drawn. Ones gives every frame its own state."
              >
                {(
                  [
                    ["twos", "twos"],
                    ["ones", "ones"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-exposure={id}
                    active={motion.cadence === id}
                    onClick={() => setRead({ cadence: id })}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillGroup>

              <PillGroup
                label="Shadow"
                ariaLabel="When the contact shadow arrives"
                hint="Lands: the shadow arrives on its own clock, four frames after the mark does, so something happens in the shot after the turn. Rides: it comes up with the light, so it fades in and never lands."
              >
                {(
                  [
                    ["lands", "lands"],
                    ["prior", "rides"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-shadow={id}
                    active={motion.shadowLaw === id}
                    onClick={() => setRead({ shadowLaw: id })}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillGroup>

              <PillGroup
                label="The turn"
                ariaLabel="What the flat mark does to become an object"
                hint="Turns: the mark rotates to edge-on, holds two frames on its own thickness, and comes back an object. Fades: it just gets thicker and lighter head-on, where neither can be seen."
              >
                {(
                  [
                    ["turn", "turns"],
                    ["prior", "fades"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-turn={id}
                    active={motion.emerge.mode === id}
                    onClick={() => setRest((m) => ({ ...m, emerge: { ...m.emerge, mode: id } }))}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillGroup>

              <PillGroup
                label="The drawing"
                ariaLabel="What shape the flat mark is"
                hint="Pen: the flat mark is the shape the nib drew, thin where the pen ran with its edge, thick where it ran across. Tube: it keeps the 3D form's own fat outline, so the only thing that changes when it becomes an object is the light. That was the shipped read, and it is why the change was hard to see."
              >
                {(
                  [
                    ["pen", "pen"],
                    ["prior", "tube"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-carve={id}
                    active={motion.carveLaw === id}
                    onClick={() => setRead({ carveLaw: id })}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillGroup>

              {/* ── THE FOUR CAMERA READS, SHOWN ONLY WHILE THERE IS A CAMERA
                  MOVE TO READ ───────────────────────────────────────────────
                  Same law as the dials below: a control that renders and
                  changes nothing is a defect. The rise's spacing, the drift,
                  the tip-back's handover and the square-up's acceleration are
                  every one of them properties of a MOVING camera. Park it and
                  all four are inert — so they go, with a line saying where, and
                  one click on Camera brings them back. */}
              {motion.camera !== "prior" ? (
                <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
                  Four reads are hidden: how the rise is spaced, whether the
                  camera drifts after it, how the tip-back ends and how it leaves
                  the held angle. With the camera parked none of the four happens,
                  so none of them has anything to set. Switch{" "}
                  <strong>Camera</strong> back to <em>four moves</em> to get them
                  back.
                </div>
              ) : null}

              {motion.camera !== "prior" ? null : (
                <>
              <PillGroup
                label="The rise"
                ariaLabel="How the rise is spaced"
                hint="Arrives: fast off the mark, then a long settle. Travels: even at both ends, which reads as a camera move rather than as the mark standing up."
              >
                {(
                  [
                    ["riseOut", "arrives"],
                    ["prior", "travels"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-rise={id}
                    active={motion.riseCurve === id}
                    onClick={() => setRead({ riseCurve: id })}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillGroup>

              <PillGroup
                label="After the rise"
                ariaLabel="Whether the camera keeps moving"
                hint="Stops: the rise lands on the held angle and nothing moves again. Drifts: the camera keeps travelling for another three seconds, which is the 'it just dollies side-to' read."
              >
                {(
                  [
                    ["parked", "stops"],
                    ["prior", "drifts"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-park={id}
                    active={motion.cameraPark === id}
                    onClick={() => setRead({ cameraPark: id })}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillGroup>
                </>
              )}

              {/* THE WIND-UP'S RELEASE. The defect this parks: the tense sprang
                  back on the frame BEFORE the turn was visible at all, so the
                  beat spent two frames doing nothing between the wind-up and the
                  thing it was winding up for. Both arms are real reads and the
                  difference is felt, not argued. */}
              <PillGroup
                label="The wind-up"
                ariaLabel="How the tense lets go"
                hint="Uncoils: the mark stays crouched while the turn starts and lets go as the turn takes hold, one gesture. Snaps: it springs back to full height first, and the turn starts two frames later, which reads as a twitch rather than a release."
              >
                {(
                  [
                    ["overlap", "uncoils"],
                    ["prior", "snaps"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-release={id}
                    active={motion.releaseLaw === id}
                    onClick={() => setRead({ releaseLaw: id })}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillGroup>

              {/* THE TWO CAMERA TRANSITS. Both were measured, both were changed,
                  and neither was reachable from the panel — so the beat had two
                  authored camera decisions Sebs could not feel. Gated for the
                  same reason as the two rows above: park the camera and there is
                  no transit left to shape. */}
              {motion.camera !== "prior" ? null : (
                <>
              <PillGroup
                label="Lying down"
                ariaLabel="How the tip-back ends"
                hint="Continues: the tip-back runs straight on into the stand-up, so the two are one descent and the lowest look-down happens once. Stops: it glides to a near-halt and then the rise lurches back up to speed without changing direction, the hitch you can feel at the bottom."
              >
                {(
                  [
                    ["handover", "continues"],
                    ["prior", "stops"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-tilt={id}
                    active={motion.tiltLaw === id}
                    onClick={() => setRead({ tiltLaw: id })}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillGroup>

              <PillGroup
                label="Coming back"
                ariaLabel="How the camera leaves the held angle"
                hint="Eases out: the camera takes a few frames to get going when it leaves the held three-quarter. Snaps out: it goes from dead still to full speed in one frame, the single biggest jolt in the whole camera move."
              >
                {/* "eases" / "jumps", not "eases out" / "snaps out": the longer
                    pair overflowed the 320px control column and clipped the
                    second pill at the panel's right edge. */}
                {(
                  [
                    ["accelerated", "eases"],
                    ["prior", "jumps"],
                  ] as const
                ).map(([id, copy]) => (
                  <Pill
                    key={id}
                    data-read-descend={id}
                    active={motion.descendLaw === id}
                    onClick={() => setRead({ descendLaw: id })}
                  >
                    {copy}
                  </Pill>
                ))}
              </PillGroup>
                </>
              )}
            </div>

            <div
              data-hero-junctions={junctions.length}
              style={{ marginTop: 10, fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}
            >
              {junctions.length} places in this word where the pen laid one stroke
              across another. On the CHANGED ending each one shows a hairline of
              paper, later stroke in front, so the drawing comes back carrying its
              own order. Same ink, everywhere; nothing is shaded.
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
              Not on screen yet: the paper break and the shadow&apos;s own timing are
              drawn by the viewport, which is a separate lane. The beat, the timing
              and the choice are live here and the numbers below move with them.
            </div>
            <div style={{ marginTop: 6, fontSize: 10, color: "var(--reg-detail)", lineHeight: 1.5, fontVariantNumeric: "tabular-nums" }}>
              Live: shadow {liveRead.shadow} · junctions{" "}
              {liveRead.jointBreak}
            </div>
          </Section>

          <Section title="Beats" note="owned by the timeline dock">
            {/* NO SLIDERS HERE, DELIBERATELY.
                A beat slider next to a draggable clip bar is two controls over
                one number, and this codebase's dominant failure is exactly that:
                two things that hold the same value until they quietly stop
                agreeing. The timeline owns the durations; this panel reports
                them. Retiming happens by dragging the bar, which is how
                choreography is tuned anyway — by feel against the moving
                picture, not by typing seconds. */}
            {HERO_PHASES.map((ph) => {
              const active = liveRead.phase === ph
              return (
                <div
                  key={ph}
                  data-beat={ph}
                  data-beat-sec={beats[ph].toFixed(3)}
                  title={BEAT_NOTES[ph]}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                    padding: "4px 0",
                    fontSize: 11,
                    color: active ? "var(--reg-text)" : "var(--reg-secondary)",
                  }}
                >
                  <span style={{ textTransform: "uppercase", letterSpacing: "var(--reg-caps-tracking)" }}>
                    {ph}
                  </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {beats[ph].toFixed(2)}s
                  </span>
                </div>
              )
            })}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginTop: 6,
                paddingTop: 6,
                borderTop: "1px solid var(--reg-border)",
                fontSize: 11,
                color: "var(--reg-text)",
              }}
            >
              <span style={{ textTransform: "uppercase", letterSpacing: "var(--reg-caps-tracking)" }}>
                Total
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums" }}>{total.toFixed(2)}s</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
              Drag a clip&apos;s edge in the timeline dock at the bottom of the screen
              to retime a beat; drag its body to move it. These are the live values it
              is reporting, not a second copy. There is one number per beat and the
              dock owns it.
            </div>
          </Section>

          {/* ── DIALS ONLY SHOW WHERE THEY ACT ──────────────────────────────
              A control that renders and changes nothing is a defect, and this
              panel had EIGHT of them — swept, listed and fixed by
              `scripts/verify/assert-hero-dials.mjs`. Most were not broken
              wiring: they belong to a PARKED read and are simply inert while the
              shipped read is selected, which is worse than broken because
              nothing about a live-looking slider says so.

              So each one is gated on the read that consumes it, with a line
              saying where it went. Nothing is deleted and nothing is
              unreachable: flip the pill above and the dial is back. */}
          <Section title="Emerge" note="flat mark → object">
            {motion.emerge.mode === "prior" ? (
              <>
                <Dial label="Swell" value={motion.emerge.overshoot} min={0} max={0.4} step={0.01}
                  onChange={(v) => setEmerge("overshoot", v)}
                  hint="How far past full thickness the ink puffs before settling. Matter arriving has weight; a depth that eases straight to its final value reads as a value being set. 0 removes it, which is what reduced motion does." />
                <Dial label="Light lag" value={motion.emerge.lightLagSec} min={0} max={0.3} step={0.01} unit="s"
                  onChange={(v) => setEmerge("lightLagSec", v)}
                  hint="How long the shading waits after the depth starts. Firing them together reads as a switch; letting the depth lead makes the light read as CAUSED by the volume." />
                <Dial label="Light" value={motion.emerge.lightSec} min={0.1} max={1.6} step={0.02} unit="s"
                  onChange={(v) => setEmerge("lightSec", v)}
                  hint="How long the surface takes to go from flat ink to fully lit. Deliberately outlasts its own beat: head-on, depth is nearly invisible, so the volume wants a raking camera to be legible against." />
                {/* The kept criticism of this arm, carried WITH the arm rather
                    than left standing over the shipped one. It described the
                    fade when the fade was the default; it is still true of the
                    fade and no longer true of what ships. */}
                <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
                  What this arm gets wrong, kept on the record: it collapses the
                  solid&apos;s SHADING, which does not collapse its silhouette. Head
                  on it is still a tube, not a drawing. Measured identical to the
                  settled solid on medial-axis half-width. The turn was built from
                  the original card flip to answer exactly that.
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
                Nothing to set here on the turn. The three dials in this section, the ink&apos;s swell and the two that time the light coming up, belong to the <em>fades</em> version of the moment, where the mark
                gets thicker and lighter head-on. The turn hides the whole change
                at the edge instead, in one frame nobody can resolve, so there is
                no ramp to time. Switch <strong>The turn</strong> above to
                <em> fades</em> to get them back.
              </div>
            )}
            {motion.carveLaw === "prior" ? null : (
              <Dial label="Pen carve" value={motion.carveAmount} min={0} max={1} step={0.05}
                onChange={(v) => setRead({ carveAmount: v })}
                hint="How far the flat mark's OUTLINE is carved back to the shape the nib drew, rather than the 3D form's fat tube. This is the one that answers 'it&rsquo;s hard to tell it went from 2D to 3D'. At 0 the flat state and the object have the same silhouette and only the light changes; at 1 the drawing is thin where the pen ran with its edge and the object is 33% more ink. Everything between is a shape neither the pen nor the tube ever drew, which is why 1 is the recommendation and not just the maximum." />
            )}
            <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5, marginTop: 6 }}>
              Live: flat {liveRead.flat} · depth {liveRead.depth} · carve{" "}
              {liveRead.penCarve}.
              {reduceMotion ? " Reduced motion is on: the swell is off." : ""}
            </div>
          </Section>

          <Section title="Camera arc" note="degrees">
            {/* THE ARC ONLY EXISTS WHILE THE CAMERA MOVES. Under a parked law
                every dial in this section sets a pose the camera never visits,
                which is the same defect the eight dead dials were — a live-
                looking slider that moves nothing. The desk pose replaces them
                because it is the ONE pose those laws actually use. */}
            {motion.camera === "prior" ? null : (
              <>
                {motion.camera === "deadOn" ? (
                  <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
                    Dead-on has no arc to set: the camera is square to the page on
                    every frame of the film, which is what makes the last frame
                    the same picture as the first. Five dials are hidden.
                  </div>
                ) : (
                  <>
                    <Dial label="Desk azimuth" value={motion.deskAz} min={0} max={70} step={1} unit="°"
                      onChange={(v) => setNum("deskAz", v)}
                      hint="How far round the desk you are sitting. Together with the elevation this is the whole framing. It is set before the first stroke and never changes, so gravity is established once instead of being re-declared mid-film." />
                    <Dial label="Desk elevation" value={motion.deskEl} min={0} max={70} step={1} unit="°"
                      onChange={(v) => setNum("deskEl", v)}
                      hint="How far above the page you are looking down. This is the dial that decides whether the shadow is worth anything: the contact pool is a flat puddle, so square-on you see none of it and at 30° you see half. It also has to keep the two framings far enough apart for the cut to read as a cut and not as a nudge." />
                  </>
                )}
              </>
            )}
            {motion.camera !== "prior" ? null : (
              <>
            <Dial label="Lying elevation" value={motion.lieEl} min={0} max={89} step={1} unit="°"
              onChange={(v) => setNum("lieEl", v)}
              hint="How far above the page the move starts. High = strongly foreshortened, reads as lying flat. This is what makes it a stand-up rather than a lean." />
            {motion.cameraPark === "prior" ? (
              <>
                <Dial label="Stand azimuth" value={motion.standupAz} min={0} max={90} step={1} unit="°"
                  onChange={(v) => setNum("standupAz", v)}
                  hint="Where the rise settles before the drift takes over." />
                <Dial label="Stand elevation" value={motion.standupEl} min={-20} max={60} step={1} unit="°"
                  onChange={(v) => setNum("standupEl", v)} />
              </>
            ) : null}
            <Dial label="Hold azimuth" value={motion.holdAz} min={0} max={90} step={1} unit="°"
              onChange={(v) => setNum("holdAz", v)}
              hint="The money angle, where the form is held and the frame you leave with. With the camera stopping after the rise, this is also where the rise lands: there is no separate standing pose." />
            <Dial label="Hold elevation" value={motion.holdEl} min={-20} max={60} step={1} unit="°"
              onChange={(v) => setNum("holdEl", v)} />
            {motion.cameraPark === "prior" ? null : (
              <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
                Two dials are hidden. With the camera stopping after the rise there
                is no second pose to fly between. The rise settles straight onto
                the held angle above. So a standing azimuth and elevation would
                set nothing. Switch <strong>After the rise</strong> to
                <em> drifts</em> to get them back.
              </div>
            )}
              </>
            )}
          </Section>

          <Section title="Push" note="smaller = closer">
            <Dial label="Lying" value={motion.fillLie} min={0.5} max={1.6} step={0.01}
              onChange={(v) => setNum("fillLie", v)}
              hint="How big the mark sits in frame. On a parked camera this is the only one of the three that acts, because it is the whole film's framing. There is no push to arrive at." />
            {motion.cameraPark === "prior" && motion.camera === "prior" ? (
              <Dial label="Standing" value={motion.fillStand} min={0.5} max={1.6} step={0.01}
                onChange={(v) => setNum("fillStand", v)}
                hint="Where the push sits when the rise settles, before the drift closes in on the held value." />
            ) : null}
            {motion.camera !== "prior" ? (
              <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
                The push is cut with the camera. A dolly on one object in an empty
                frame is a zoom, and a zoom says magnification, not depth. So the
                film opens and closes at one size, and that is what makes the last
                frame the same picture as the first rather than a smaller one.
              </div>
            ) : (
              <Dial label="Held" value={motion.fillHold} min={0.5} max={1.6} step={0.01}
                onChange={(v) => setNum("fillHold", v)}
                hint="Keep this the smallest of the three so the payoff arrives at its most present, not its smallest." />
            )}
          </Section>

          <Section title="Curve">
            {/* Every dial in here but the last one shapes the RISE, which is a
                camera move. Park the camera and there is no rise. */}
            {motion.camera !== "prior" ? (
              <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
                The rise&apos;s wind-up, its overshoot and the drift are hidden. The
                camera is parked, so there is no rise to shape. The one curve still
                live below is the pen&apos;s.
              </div>
            ) : motion.riseCurve === "prior" ? (
              <Dial label="Overshoot" value={motion.backC1} min={0} max={4} step={0.01}
                onChange={(v) => setNum("backC1", v)}
                hint="Back-curve coefficient for the even-at-both-ends rise. 1.70 ≈ ±10%, dips before launching, swings past the target, rocks back. Zero removes the wind-up and the overshoot entirely." />
            ) : (
              <>
                <Dial label="Wind-up depth" value={motion.riseGatherDepth} min={0} max={0.3} step={0.005}
                  onChange={(v) => setNum("riseGatherDepth", v)}
                  hint="How far the camera gathers BACKWARDS before it launches the mark upright. This is the dip you feel just before the rise; zero removes it. It is also the last few degrees of the lie-down, so the lowest look-down lands exactly on the lying angle rather than past it." />
                <Dial label="Wind-up length" value={motion.riseGatherFrac} min={0} max={0.4} step={0.01}
                  onChange={(v) => setNum("riseGatherFrac", v)}
                  hint="How much of the rise is spent gathering before it commits. The reference films accelerate for about four frames; the gather has to go out AND back inside its own span, so it gets a little more." />
                <Dial label="Rise overshoot" value={motion.riseOvershoot} min={0} max={0.4} step={0.01}
                  onChange={(v) => setNum("riseOvershoot", v)}
                  hint="How far past upright the mark sails before it rocks back. This used to be read off the ink's swell dial, which is a different end of the beat entirely. Moving Swell moved the camera. Now each says what it does. Zero removes it, which is what reduced motion does." />
              </>
            )}
            {motion.cameraPark === "prior" && motion.camera === "prior" ? (
              <Dial label="Drift cut" value={motion.driftCut} min={0.1} max={0.95} step={0.01}
                onChange={(v) => setNum("driftCut", v)}
                hint="How much of the drift runs at constant speed before it decelerates. The camera reaching zero velocity is what makes the hold read as held." />
            ) : null}
            <Dial label="Draw linearity" value={motion.drawLinearBlend} min={0} max={1} step={0.01}
              onChange={(v) => setNum("drawLinearBlend", v)}
              hint="A SECOND easing of the same axis the pen map already drives. It blends the playhead toward constant speed BEFORE the recording is consulted, so at 0.45 it is quietly cancelling part of what Authentic replays. With a real pen record the onset and the settle are already in the recording; 1 is fully linear time and lets the recording speak alone." />
          </Section>

          {/* ── THE PEN'S CLOCK ──────────────────────────────────────────────
              A READ, not a slider: it changes what the drawing IS, not how much
              of it there is. Both arms stay reachable, which is the rule this
              page already follows for every other read — and here it is also
              the negative control, because a pen-timing assertion that cannot be
              run against a metronome is an assertion that cannot fail. */}
          <Section title="The pen's clock">
            <div style={{ display: "flex", gap: 6 }}>
              {(
                [
                  ["lognormal", "Sigma-Lognormal"],
                  ["uniform", "Uniform (prior)"],
                ] as [PenClock, string][]
              ).map(([id, label]) => (
                <Pill
                  key={id}
                  active={penClock === id}
                  onClick={() => setPenClock(id)}
                  data-pen-clock-option={id}
                  title={
                    id === "lognormal"
                      ? "Each stroke's duration comes from its own Sigma-Lognormal action plan. A bigger stroke is executed FASTER, not for longer (research/handwriting-variability.md §2)."
                      : "The parked prior: a flat 12 ms per point on a 4 px arc-length grid, i.e. one speed for the whole word."
                  }
                >
                  {label}
                </Pill>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
              What the draw-in REPLAYS. The trace records where the pen went and
              nothing about how fast, so the clock is reconstructed, and the prior
              one reconstructed a metronome: stroke duration tracked stroke length at
              r = 0.9986, where 1.0000 is a machine. The model puts that at 0.8412 and
              takes the word&rsquo;s measurable timing character from 2.23 % to 7.59 %.
              Live: {timingReadout}
            </div>
          </Section>

          {/* ── WHICH END THE PEN LEAVES ──────────────────────────────────────
              Sebs, 2026-08-01: *"WHEN THE ENGINE IS FREE STROKE THE 2D DRAW-IN
              IT STILL JANK, IT'S LIKE ITS USING SOME STUPID SWEEP REVEAL"* —
              and the shape of the moving end is where "sweep" was literally
              true. All four shapes have been live since that pass, but only
              from the console (`window.__captureHarness.setPenTip`), so the one
              thing he could not do was FLIP THEM AND LOOK. That is the whole
              reason this row exists.

              It sits under the clock because the pair is WHEN the pen moves and
              WHAT it leaves; and above the squash because it belongs to the
              drawing, not to the beat.

              COPY LAW, same as the film and camera rows: what the picture IS.
              No nib half-widths, no uniform names — those are in
              `lib/pen-reveal.ts` §T where the shapes are defined. */}
          <Section title="The pen's tip" note="the moving end of the line">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(
                [
                  ["quill", "Quill"],
                  /* THE MEASURED MIDDLE — see `PEN_TIP_SHAPES.reed`. It was a
                   * capture arm and not a shape, so the option he was told
                   * existed could not be clicked. */
                  ["reed", "Reed"],
                  /* THE PARKED PRIOR SHAPE, and it needs a pill because the whole
                   * point of this row is flipping shapes BY EYE. `chisel` is the
                   * 0.85 taper that shipped until the long taper replaced it —
                   * reachable from `PEN_TIP_SHAPES` and the console, but until now
                   * not from the panel, which made the comparison a code edit. */
                  ["chisel", "Chisel (prior)"],
                  ["nib", "Nib"],
                  ["cut", "Cut"],
                  ["off", "Off (prior)"],
                ] as [PenTipMode, string][]
              ).map(([id, label]) => (
                <Pill
                  key={id}
                  active={penTip === id}
                  onClick={() => setPenTipMode(id)}
                  data-pen-tip-option={id}
                  title={
                    id === "quill"
                      ? "The long tapered almond. The edges lag the centre so far that the line comes to a point rather than a nose. Taper 2.70, chosen by solving a closed form for Desk Doodles' own measured end. Scores 5.578 where a straight chop is 0."
                      : id === "reed"
                        ? "The middle, and it is measured: taper 1.60, two thirds of the way from Chisel to Quill in reach. On fresh evidence it costs nothing on the channel Quill costs on: 6 blank px at the pen against Quill's 12, and detached pieces 1.39 against 2.92. If Quill reads too wispy, this is the one to try."
                        : id === "chisel"
                        ? "The taper that shipped before this one, 0.85. Parked and reachable so the long taper can be judged against something rather than against memory. Scores 2.434."
                        : id === "nib"
                          ? "A ballpoint: the union of the discs the nib has stamped. A round nose, no taper, blunter, and an honest pen. Scores 0.989."
                          : id === "cut"
                            ? "The straight chop across the mark, drawn per fragment, a wipe's ending, cleanly rendered. This is the facet removal WITHOUT the nose, so it separates the two."
                            : "The parked prior, byte for byte: the raw per-triangle boundary that shipped. Faceted, because a triangle either is drawn or is not. Scores 0.264. It reads as a CUT, which is the control."
                  }
                >
                  {label}
                </Pill>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
              A wipe ends in a straight cut across the mark; a pen ends in a nib.
              The reveal&rsquo;s ORDER was never the problem. It already scored
              0.86&ndash;0.90 where 1 is a pen and 0 is a sweep. This is the shape of
              the end that moves, and it is the half that read as janky.{" "}
              <strong>Quill</strong> now matches the Desk Doodles engine you called
              better: <strong>5.578 against its 5.796</strong>, 0.6&nbsp;% apart. It
              did not before. The old copy here claimed we beat it at 2.400 against
              2.142, and both of those numbers came from an instrument whose
              measuring disc was scooping ink from neighbouring strokes. You were
              right about Desk Doodles for days while the gate said otherwise.{" "}
              <em>
                Also switchable from the console, and the verification sweep drives
                that same setter. So this row can never disagree with a captured
                frame.
              </em>
            </div>
          </Section>

          <Section title="Anticipation squash">
            <Dial label="Compress" value={motion.anticipation.compressSec} min={0} max={0.6} step={0.01} unit="s"
              onChange={(v) => setAnticip("compressSec", v)}
              hint="How long the mark takes to crouch. Fast in. A squash is an impact, and an impact that eases in has no weight." />
            <Dial label="Hold tension" value={motion.anticipation.holdSec} min={0} max={0.6} step={0.01} unit="s"
              onChange={(v) => setAnticip("holdSec", v)}
              hint="How long it stays crouched before letting go. A squash that releases immediately reads as a wobble; the hold is what makes it read as intent. Anything left over in the clip becomes stillness BEFORE the crouch, so lengthening the clip buys a longer lead-in rather than a longer tension." />
            {motion.releaseLaw === "prior" ? null : (
              <Dial label="Release" value={motion.anticipation.releaseSec} min={0} max={0.45} step={0.01} unit="s"
                onChange={(v) => setAnticip("releaseSec", v)}
                hint="How long the mark takes to uncoil, and it happens INSIDE the turn, not before it. It holds its crouch through the frames where the turn is under way but not yet visible, then lets go as the turn takes hold. Long enough and it is still unwinding at the edge, which puts a second thing inside the moment; it is capped at the half-turn so it cannot." />
            )}
            <Dial label="Scale Y" value={motion.anticipation.scaleY} min={0.85} max={1} step={0.005}
              onChange={(v) => setAnticip("scaleY", v)} />
            <Dial label="Scale X" value={motion.anticipation.scaleX} min={1} max={1.1} step={0.002}
              onChange={(v) => setAnticip("scaleX", v)} />
            <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
              The squash is applied to the mark itself, about its own CONTACT, a
              bottom-pinned compression, so it reads as weight rather than as a scale.
              Live value: {liveRead.squashX} × {liveRead.squashY}.
            </div>
            <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5, marginTop: 6 }}>
              {motion.releaseLaw === "prior"
                ? "On snaps, the tense ends when its own clip does, full height again on the frame before the turn, and nothing to set."
                : `Crouch ${motion.anticipation.compressSec.toFixed(2)}s · hold ${motion.anticipation.holdSec.toFixed(2)}s · lead-in ${Math.max(0, beats.anticipation - motion.anticipation.compressSec - motion.anticipation.holdSec).toFixed(2)}s, the clip's own remainder.`}
            </div>
          </Section>

          <Section title="Transfer">
            <button
              onClick={copyConstants}
              style={{
                width: "100%",
                padding: "10px 16px",
                fontSize: 11,
                letterSpacing: "var(--reg-caps-tracking)",
                textTransform: "uppercase",
                borderRadius: "var(--reg-pill)",
                border: "1px solid var(--reg-border)",
                cursor: "pointer",
                background: copied ? "var(--reg-accent)" : "transparent",
                color: copied ? "var(--reg-on-accent)" : "var(--reg-text)",
              }}
            >
              {copied ? "Copied" : "Copy motion.mjs constants"}
            </button>
            <div style={{ marginTop: 8, fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
              The capture script is plain ESM run by node and cannot import this
              TypeScript, so the transfer is deliberately explicit rather than
              pretend-automatic: tune here, paste into{" "}
              <code style={{ fontSize: 10 }}>scripts/capture/motion.mjs</code>, re-capture.
            </div>
            <button
              onClick={() => {
                setRest(DEFAULT_MOTION_REST)
                // The beats live in the timeline, so reverting them means
                // writing the captured values back into ITS store — not into a
                // second copy here. Same reason the panel has no beat sliders.
                const patch: Record<string, number> = {}
                let at = 0
                for (const ph of HERO_PHASES) {
                  patch[`${ph}.at`] = at
                  patch[`${ph}.duration`] = DEFAULT_HERO_MOTION.beats[ph]
                  at += DEFAULT_HERO_MOTION.beats[ph]
                }
                DialStore.updateValues(HERO_TIMELINE_ID, patch)
                tlPause()
                tlSeek(0)
              }}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "8px 16px",
                fontSize: 11,
                letterSpacing: "var(--reg-caps-tracking)",
                textTransform: "uppercase",
                borderRadius: "var(--reg-pill)",
                border: "1px solid var(--reg-border)",
                cursor: "pointer",
                background: "transparent",
                color: "var(--reg-secondary)",
              }}
            >
              Revert to captured values
            </button>
          </Section>

          {register.lightingRigged ? (
            <Section title="Light" note={register.id === "desk-doodles" ? "ported rig" : "this app's rig"}>
              <div style={{ fontSize: 10, color: "var(--reg-body-soft)", lineHeight: 1.5 }}>
                {register.id === "desk-doodles" ? (
                  <>
                    Desk Doodles&apos; own studio rig, ported whole rather than rebuilt. A warm key, a cool fill, a hemisphere standing in for paper bounce,
                    and a near point light with physical decay so a flat camera-facing
                    face gets a real gradient instead of the featureless-blob read a
                    directional gives it. It bakes a dark ink-family environment (warm
                    hues there return through the specular channel at full strength no
                    matter how black the base is, which is what once produced a
                    measurable tan flood). A fresnel rim lifts the silhouette; a contact
                    shadow puts the form on the paper rather than in it.
                  </>
                ) : (
                  <>
                    Free Stroke&apos;s own rig: a hotter nine-panel environment with hard
                    slat structure, built so clearcoat and metal have edges to mirror.
                    No rim and no contact shadow. The gloss separates its own edge, and
                    this is a lab viewport rather than a product shot.
                  </>
                )}{" "}
                Switching registers changes the LIGHT as well as the surface.
              </div>
            </Section>
          ) : null}
        </aside>
          )}
        </StableSubtree>
      </div>

      {/* THE DOCK'S OWN FOOTPRINT.
          DialTimeline portals a fixed-position dock to the bottom of the
          screen. This page is height-bounded (100vh, overflow hidden) so a
          fixed overlay would sit ON TOP of the transport and the phase ruler —
          the two readouts you need WHILE dragging a clip. The spacer is
          measured from the dock rather than guessed at a constant, because the
          dock is resizable by its own top edge and any constant would be wrong
          the moment it is dragged. */}
      <div style={{ flex: "0 0 auto", height: dockHeight }} />

      <DialTimeline />
    </div>
  )
}
