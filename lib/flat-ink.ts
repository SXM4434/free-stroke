/**
 * FLAT INK — the 2D half of the hero beat.
 *
 * The beat is a *switch*: flat ink draws itself in, then becomes a 3D form. The
 * flat half is not decoration, it is half the claim — so the tuner has to render
 * it for real, from the SAME polylines the 3D scene inflates, or it cannot show
 * the one thing the beat exists to show.
 *
 * This is the browser port of `makeFlatRenderer` in `scripts/capture/compose.mjs`,
 * kept deliberately identical in method so the live preview and the captured
 * film draw the same marks: map the polylines onto a target footprint, then draw
 * the first `progress` fraction of total pen travel, arc-length parameterised
 * with stroke order preserved. A stroke half-drawn is cut mid-segment, not
 * snapped to the nearest anchor.
 */

import { revealDistanceFraction, type RevealMode } from "@/lib/pen-reveal"
import type { ProcessedStroke } from "@/lib/stroke-processing"

export interface FlatPoint {
  x: number
  y: number
}

/** Where on screen the flat word should sit, in CSS px of the host box. */
export interface FlatFootprint {
  /** Target width of the word's ink bbox. */
  w: number
  /** Target centre. */
  cx: number
  cy: number
}

interface PreparedStroke {
  pts: FlatPoint[]
  /** Cumulative arc length at each point. */
  cum: number[]
  len: number
}

export interface FlatRenderer {
  /** Total pen travel across every stroke, in screen px. */
  totalLen: number
  /** Ink diameter used, in screen px. */
  lineWidth: number
  /**
   * Draw the first `progress` (0..1) of the pen travel into `ctx`. Does not
   * clear — the caller owns the surface, because the tuner clears with its own
   * device-pixel-ratio transform already applied.
   *
   * ⚠ `progress` HERE IS A DISTANCE FRACTION, NOT A TIME FRACTION. Feeding it a
   * playhead gives a constant-speed sweep and silently discards every
   * hesitation in the recording — which is precisely the bug that was found and
   * fixed in three of the four 3D modes (`lib/pen-reveal.ts`'s header quotes
   * it: *"the Natural / Authentic toggle silently did NOTHING in Solid, Extrude
   * and Inflate"*). Use `drawAtTime` unless you genuinely mean arc length.
   */
  draw: (ctx: CanvasRenderingContext2D, progress: number, ink: string) => void
  /**
   * THE SAME MECHANISM, ON THE SHARED CLOCK.
   *
   * `timeFrac` is a playhead. This runs it through `revealDistanceFraction` —
   * the identical call the 3D reveal makes — and then draws the resulting
   * DISTANCE with the truncation above.
   *
   * That split is the answer to "does the Free Stroke reveal port to 2D". The
   * PROGRESS MODEL ports: it is arithmetic over recorded timestamps and knows
   * nothing about renderers. The MECHANISM does not: the 3D reveal is
   * `setDrawRange` over an index buffer counting-sorted by arc length at build
   * time, and a canvas path has no index buffer to sort. What 2D has instead is
   * already in this file — truncate the polyline at a cumulative arc length,
   * interpolating inside the segment that contains the cut — and it answers the
   * same question by different means. One clock, two mechanisms.
   *
   * Requires strokes carrying `t`. `makeFlatRenderer` accepts bare points for
   * every existing caller; pass `timedStrokes` to unlock this.
   */
  drawAtTime: (
    ctx: CanvasRenderingContext2D,
    timeFrac: number,
    ink: string,
    mode?: RevealMode,
    hybridBlend?: number,
    liftHolds?: boolean,
  ) => void
  /** False when no timing was supplied — `drawAtTime` then equals `draw`. */
  hasTiming: boolean
}

/**
 * Ink weight is expressed in STROKE-COORDINATE space and converted, not picked
 * in pixels. The polylines arrive in the trace's own coordinate space (~1100
 * units wide), and the 3D inflate engine's tube radius is likewise relative to
 * that space — so deriving the 2D line width the same way is what keeps the flat
 * ink and the inflated tube the same visual weight. Picking a pixel width
 * instead would drift the moment the word or the viewport changed size.
 */
const INK_DIAMETER_IN_STROKE_SPACE = 22
const STROKE_SPACE_W = 1100

/* -------------------------------------------------------------------------- */
/*  THE PEN'S OUTLINE — the width law this register never had                  */
/* -------------------------------------------------------------------------- */

/**
 * WHY THIS EXISTS, AND WHAT IT IS ANSWERING.
 *
 * Sebs: *"THE 2D AND 3D TRANSFORMATION IS WAY TOO SUBTLE LIKE IT'S HARD TO TELL
 * IT WENT FROM 2D TO 3D."*
 *
 * `components/viewport-3d.tsx:929-931` states the mechanism and calls it
 * unsolved: collapsing shading flattens a SURFACE and not a SHAPE, so head-on
 * the flat state still carries a tube's silhouette. (⚠ CITATION CORRECTED
 * 2026-08-07: this read `:579`, which is now `const paramSig = …`. The line
 * rotted at some point after it was written and nothing was watching, which is
 * the same class as item 6 below — a citation is not evidence, it is a claim
 * that evidence exists, and this one had stopped pointing at any.) `docs/hero-beat-storyboard.md` §3 K1
 * says the same from the storyboard side — *"blunt round terminals, constant
 * width, bulges at the joints ... A pen's outline tapers and varies. This one
 * cannot"* — and §11.9.9 records that the complaint *"has now survived three
 * passes unexamined."*
 *
 * It is examined now. `scripts/verify/assert-flat-silhouette.mjs` measures the
 * medial-axis half-width of both states on the live page, and on the shipped
 * build the two are 4.09 % of a stroke radius apart, which is a quarter of what
 * that instrument needs to separate a KNOWN pen from a KNOWN tube. The
 * transformation is not subtle. On the silhouette it is very nearly absent.
 *
 * ── THE FINDING THAT DECIDES WHICH LAW IT HAS TO BE ────────────────────────
 *
 * The obvious fix is the terminal: a tube ends in a round cap, ink ends by
 * tapering. Measured on the real word
 * (`scripts/verify/_probe-terminal-census.mjs`), that fix is unavailable:
 *
 *     terminal census on the shipped flat state
 *       spur filter 0.5 R    9 terminals
 *       spur filter 3.0 R    4 terminals
 *       1635 medial-axis samples in the word
 *
 * Twenty-two strokes, forty-four pen ends, and the fused mass has **four** free
 * medial terminals. A terminal device reaches four samples of sixteen hundred —
 * 0.2 % of the outline. It cannot be what makes the beat legible, and building
 * it first would have been three days spent on a quarter of a percent.
 *
 * `docs/2d-register-board.md` §2.2 reaches the same place from the other
 * direction: this word has *"one true centreline intersection in 22 strokes and
 * 1078 points"* and its structure is **22 fusion boundaries**, not crossings.
 * So the outline is almost entirely stroke BODY — which is where a WIDTH law
 * acts, and where a terminal law cannot.
 *
 * ── SO: WIDTH, AND WIDTH FROM DIRECTION ────────────────────────────────────
 *
 * `docs/research/stroke-width-models.md` is unambiguous about which channel,
 * and it arrives there by eliminating the two obvious ones first:
 *
 *   - pressure — §2.2: our channel *"caps stroke contrast at 2.077 : 1"* and
 *     the input has no pressure at all (`PointerEvent.pressure` reports 0.5 for
 *     a mouse; `app/page.tsx` bakes a constant 0.6; the capture font writes
 *     none).
 *   - velocity, and curvature standing in for it — §2.3, quoting Schomaker &
 *     Plamondon 1990: *"The coherence between dAPF and tangential velocity or
 *     between dAPF and angular velocity Vθ never reached a value above 0.3 in
 *     any condition ... pen force appears to be a separate control variable."*
 *     And our own pipeline destroys the signal anyway: the strokes are
 *     arc-length resampled twice, so *"every gap is equal by construction."*
 *
 *   > **"So what should drive width, given no pressure channel? DIRECTION. Not
 *   > speed, not curvature. ... it is not that direction is a better
 *   > approximation to pressure. It is that pressure was never the mechanism.
 *   > A broad nib produces its thicks and thins with a perfectly constant
 *   > force."**  — stroke-width-models.md §2.4
 *
 * ── AND THE REASON THE WHOLE REPO IS A MONOLINE, WHICH IS NOT OUR BUG ──────
 *
 * §3.4, and it reframes the complaint rather than answering it:
 *
 *   > "The PostScript / PDF / SVG / Canvas stroke model is defined as a nib held
 *   > permanently perpendicular to travel. It is a monoline by specification.
 *   > ... The standards nib ROTATES WITH THE PATH so as to stay perpendicular to
 *   > it. A real nib is clamped to the hand and does not rotate at all. That is
 *   > the entire difference between a stroked path and a written mark."
 *
 * Kilgard's own note that closes the identity: *"a circular brush generates
 * identical coverage to a path segment with round caps."* A round-cap
 * constant-width stroke and a swept circle are the same object — so the 2D half
 * of this beat was drawing the 3D half's silhouette all along. `draw()` below
 * is `ctx.lineWidth` with round caps; it always was.
 */

/**
 * THE NIB'S HALF-WIDTH AT A TRAVEL DIRECTION.
 *
 *     h(psi) = sqrt(a^2 sin^2 psi + b^2 cos^2 psi),   psi = theta - alpha
 *
 * — stroke-width-models.md §1.1, and its §1.1 note that *"the contrast ratio a
 * nib produces is exactly a/b"*, i.e. one aspect number IS the contrast.
 *
 * `alpha` is the direction along which travel draws the HAIRLINE. That sign
 * convention is the one the research doc's own census depends on: it warns that
 * *"only 90 degrees is actually forbidden: it erases the near-vertical stems,
 * which are 33.2 % of the word"* — true only if travelling AT alpha is the thin
 * direction.
 */
export function nibHalfWidth(theta: number, a: number, b: number, alpha: number): number {
  const psi = theta - alpha
  const s = Math.sin(psi)
  const c = Math.cos(psi)
  return Math.sqrt(a * a * s * s + b * b * c * c)
}

/**
 * THE NIB ANGLE. 30 degrees — stroke-width-models.md's ranked-#1 recommendation
 * (*"30 deg = the later teaching convention ... Default to 30 for the logo"*).
 * Expressed in radians against SCREEN coordinates, where y runs downward, so a
 * positive angle here is the pen edge rising to the right as it does on paper.
 */
export const NIB_ANGLE_RAD = (30 * Math.PI) / 180

/**
 * THE DEFAULT CONTRAST, and it is deliberately NOT the research doc's 5:1.
 *
 * §4's aspect sweep over this exact word puts the knee at 5:1 and calls it the
 * right number *for a calligraphic mark*. This mark is not calligraphic — it is
 * Sebs's marker-pen hand, and turning it into Chancery would answer "make the
 * change legible" by changing what the logo IS. `docs/2d-register-board.md`
 * §10 Call 6 flags exactly that: the nib *"is a call because it changes what
 * the mark IS, not how it moves."*
 *
 * 1.8:1 is the AUTHORED pick out of a rendered sweep, not a threshold: the
 * probe renders 1.0 -> 6.0 on this word and the sheet is at
 * `docs/verification/flat-silhouette/nib-sweep/SHEET-nib-sweep.png`. Above about
 * 2.4 the `e`s begin to break and the `o`s go lozenge — at 5.0 it is legibly
 * Chancery and legibly not his hand. At 1.8 the downstrokes thicken, the
 * counters open, and the mark reads as the same handwriting drawn with the pen
 * held at an angle, which is what it is. It clears the instrument's separation
 * floor with 2.9x of margin.
 *
 * The whole range stays reachable through `PenNib.aspect`, the pick is Sebs's
 * (`docs/2d-register-board.md` §10 Call 6), and 1.0 reproduces the monoline
 * exactly.
 */
export const NIB_ASPECT_DEFAULT = 1.8

/**
 * THE TERMINAL TAPER. Worth 0.2 % of this word's outline and included anyway,
 * because the four terminals it does reach are four places where the mark
 * currently ends in a manufactured cap, and because on a DIFFERENT word — the
 * generalisation this engine is for — the same law reaches all of them.
 *
 * The exponent is 1.0, i.e. the half-width is linear in arc through the taper.
 * Not the shipped Inflate profile's 0.8: stroke-width-models.md §3.2 measures
 * that exponent producing `|dr/ds| > 1` over the first 0.195 R of every stroke
 * end — a radius growing faster than the curve advances — and quotes the
 * existence condition it violates (Choi, Choi & Moon): *"the radius cannot grow
 * faster than the curve advances; a taper steeper than 45 degrees has no
 * envelope at all."* At exponent 1 the slope is exactly `(1 - tip)/taperRadii`,
 * which for the pair below is **0.50** — valid by construction rather than by
 * luck, and re-derivable from the two dials rather than trusted.
 *
 * ⚠ THE PAIR BELOW IS THE SECOND ONE. The first build used tip 0.10 over 3.0
 * radii, which is the textbook nib taper and is WRONG FOR THIS MARK: rendered,
 * it turned the `k` stem, the `l` and `d` ascenders and the `D`'s opening into
 * needle-sharp daggers. Only the eye caught it — every number improved. Both
 * causes are real and neither is tunable away: this word's strokes already carry
 * a PROTRUDING endpoint from the hand-feel stage, so a long taper sharpens an
 * extension rather than an end; and a felt-tip has no point to come to, it lifts
 * off a blunt nib. 0.60 over 0.8 R is a marker leaving paper. The spiked pair is
 * still reachable through the two dials, and the sheet showing it failing is at
 * `docs/verification/flat-silhouette/nib-sweep/SHEET-taper-tune.png`.
 */
export const PEN_TIP_FRACTION = 0.6
export const PEN_TAPER_RADII = 0.8
export const PEN_TAPER_EXP = 1.0

/** The taper's shape. `u` is 0 at the tip, 1 where the stroke is at full width. */
export function penTaperProfile(u: number, tip: number = PEN_TIP_FRACTION): number {
  const k = Math.max(0, Math.min(1, u))
  return tip + (1 - tip) * Math.pow(k, PEN_TAPER_EXP)
}

export interface PenNib {
  /** Contrast a/b. 1 is the monoline this register drew before. */
  aspect: number
  /** The hairline direction, radians. */
  angle: number
  /** Taper length in nominal RADII; 0 disables the terminal taper. */
  taperRadii: number
  /**
   * The fraction of full width the very tip keeps. A DIAL and not a constant
   * because the first build got it badly wrong and only the eye caught it: at
   * tip 0.10 over 3 radii the word's stroke ends came out as NEEDLE SPIKES —
   * the `k` stem, the `l` and `d` ascenders and the `D`'s opening all grew long
   * daggers. Two causes, both real: this word's strokes already carry a
   * PROTRUDING endpoint from the hand-feel stage (`_hero-word.mjs`,
   * `HERO_ENDPOINT = "protrude"`), so the taper was sharpening an extension
   * rather than an end; and a felt-tip does not come to a point at all — it
   * lifts off a blunt nib. Defaults below are the tuned pair.
   */
  tip?: number
}

export const PEN_NIB_DEFAULT: PenNib = {
  aspect: NIB_ASPECT_DEFAULT,
  angle: NIB_ANGLE_RAD,
  taperRadii: PEN_TAPER_RADII,
  tip: PEN_TIP_FRACTION,
}

/**
 * ⚠ THE SEMI-MAJOR AXIS IS PINNED TO THE TUBE'S RADIUS, AND THE WEIGHT IS NOT
 * RESTORED. This is a deliberate departure from the research doc and it is the
 * hinge of the whole design.
 *
 * §4 says *"ink weight must be restored — a nib's mean width over this word is
 * ~72-75 % of its maximum, so `a` has to be scaled up by about 1.37x or the
 * whole word gets lighter the moment the nib is switched on."* That is right for
 * a mark that has to keep its colour. It is WRONG here, twice over:
 *
 *  1. The beat needs the drawing to be LIGHTER than the object. The word gaining
 *     weight as it becomes solid is not a side effect to be cancelled — it is
 *     the news. Matter arriving.
 *
 *  2. It is what makes the renderer change implementable at all. With `a = R`
 *     the nib's ink is a strict SUBSET of the tube's, so the flat state can be
 *     carved out of the solid by a fragment `discard` — never a second draw,
 *     never a blend. That is the identical constraint `FlatState.jointBreak`
 *     already carries for K7's paper break: ink may only be REMOVED, so every
 *     surviving pixel is still at exactly the one value and gate 1
 *     (`flat ink SD < 1`) cannot be broken by it.
 *
 * Restoring the weight would put nib ink OUTSIDE the tube at `psi = 90 deg`, and
 * the beat would need to ADD material to go flat. There is no shader that can do
 * that by discarding, and a mark that has to grow to become a drawing is the
 * wrong story anyway.
 */
export function penHalfWidth(
  theta: number,
  arcFromEnd: number,
  nominalRadius: number,
  nib: PenNib = PEN_NIB_DEFAULT,
): number {
  const a = nominalRadius
  const b = nominalRadius / Math.max(1, nib.aspect)
  const h = nibHalfWidth(theta, a, b, nib.angle)
  if (nib.taperRadii <= 0) return h
  const L = nib.taperRadii * nominalRadius
  return h * penTaperProfile(arcFromEnd / L, nib.tip ?? PEN_TIP_FRACTION)
}

export function makeFlatRenderer(
  polylines: FlatPoint[][],
  footprint: FlatFootprint,
  /**
   * The SAME strokes, carrying their recorded timestamps, in the same order.
   *
   * Optional so every existing caller is unchanged. When supplied, `drawAtTime`
   * becomes real; when omitted it falls back to `draw` and `hasTiming` says so,
   * rather than pretending to replay a recording it does not have.
   */
  timedStrokes?: ProcessedStroke[],
  /**
   * THE NIB. Omitted or `null` reproduces the MONOLINE this register has always
   * drawn, byte for byte — `ctx.lineWidth` with round caps, which is a swept
   * circle and therefore the 3D form's own silhouette (see the block above).
   *
   * It is opt-in rather than the new default for one reason, and it is not
   * timidity: `scripts/verify/assert-drawin-2d-parity.mjs` is the register's
   * only live consumer and it is on this lane's must-not-regress list. Changing
   * the width law changes the ink-area-versus-time curve it reads. The pick
   * between monoline and nib is `docs/2d-register-board.md` §10 Call 6 and is
   * Sebs's — *"it changes what the mark IS, not how it moves"* — so it is
   * staged with a measured recommendation and left reachable, per §0.7.
   */
  nib?: PenNib | null,
  /**
   * THE INK DIAMETER IN SCREEN PIXELS, overriding the derivation below.
   *
   * Added for one job and it is worth naming: registering this renderer's output
   * to the 3-D form's. The derived weight and the form's are set by different
   * constants — `INK_DIAMETER_IN_STROKE_SPACE` here against
   * `computeSolidEffectiveThicknessPx` x `crossSectionBulge` x the per-sample ink
   * profile there — and they disagree by about 12 %, measured 6.325 px against
   * 7.211 px median half-width at the shipped stage. `docs/explainers/14-the-flat-to-solid-beat.md`
   * §3 already names this as one of the four independent registration failure
   * modes that killed the two-layer build: *"a stroke-weight mismatch of about
   * 11 % by construction."*
   *
   * It is a mismatch of one SCALAR, not of a coordinate system. Under the
   * orthographic camera the other three failure modes are gone, so making this
   * one an argument rather than a derivation is what closes the set.
   */
  inkDiameterPx?: number,
): FlatRenderer {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const pl of polylines) {
    for (const p of pl) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  }
  if (!Number.isFinite(minX)) {
    return {
      totalLen: 0,
      lineWidth: 1,
      draw: () => {},
      drawAtTime: () => {},
      hasTiming: false,
    }
  }

  const span = Math.max(maxX - minX, 1)
  const scale = footprint.w / span
  const dx = footprint.cx - ((minX + maxX) / 2) * scale
  const dy = footprint.cy - ((minY + maxY) / 2) * scale
  const toScreen = (p: FlatPoint): FlatPoint => ({ x: dx + p.x * scale, y: dy + p.y * scale })

  const strokes: PreparedStroke[] = polylines.map((pl) => {
    const pts = pl.map(toScreen)
    let len = 0
    const cum = [0]
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      cum.push(len)
    }
    return { pts, cum, len }
  })

  const totalLen = strokes.reduce((a, s) => a + s.len, 0)
  const lineWidth =
    inkDiameterPx !== undefined && inkDiameterPx > 0
      ? inkDiameterPx
      : Math.max(2, INK_DIAMETER_IN_STROKE_SPACE * (footprint.w / STROKE_SPACE_W))

  /**
   * THE NIB, AS A STAMP UNION — the construction the research doc specifies and
   * the only one that survives this word.
   *
   * `stroke-width-models.md` §4.5 gives the shape in closed form: for a nib held
   * at a fixed orientation in world space, which is what a hand does,
   *
   *     C (+) K  =  { c + k : c in C, k in K }
   *
   * the Minkowski sum of the centreline with the nib. *"There is no moving frame
   * in this expression."* So the renderer does not compute an outline at all —
   * it stamps the nib, unrotated, at every point of the path and fills nonzero.
   * The direction-dependent width `h(psi)` falls out; it is never applied.
   *
   * ⚠ AND THAT IS WHY IT IS A STAMP UNION AND NOT AN OFFSET CURVE. §1.2 measures
   * the trap: for a non-round nib the contact point also moves ALONG the tangent
   * (`x = h.n + h'.t`), so an implementation that varies the width and keeps
   * offsetting along the normal gets *"a directionally varying monoline, not a
   * nib"*, and at a direction reversal the outline jumps by `2(a - b)`. §1.3
   * measures this word turning **177.3 degrees within 11.58 units of arc — one
   * half-width** — so that jump is not hypothetical here, it is guaranteed. The
   * doc's own build note (ranked item 7) says it in advance: a filled-outline 2D
   * renderer must be *"a self-overlapping stamp union filled nonzero, never a
   * trimmed offset."* A union of stamps has no offset curve and therefore no
   * cusp to gap at.
   */
  const drawNib = (ctx: CanvasRenderingContext2D, progress: number, ink: string, pen: PenNib) => {
    const a = lineWidth / 2
    const b = a / Math.max(1, pen.aspect)
    const taperLen = Math.max(0, pen.taperRadii) * a
    ctx.fillStyle = ink
    ctx.beginPath()

    /* The stamp spacing. Half a pixel, so consecutive stamps overlap by at least
     * `2b - 0.5` even at the hairline direction and the union cannot bead. */
    const STEP = 0.5

    /* ⚠ EVERY STAMP OPENS ITS OWN SUBPATH. `CanvasRenderingContext2D.ellipse`
     * appends to the CURRENT subpath — it draws a line from the current point to
     * the ellipse's start before tracing it — so a run of bare `ellipse()` calls
     * is one enormous self-intersecting polygon, not a union of discs. Found by
     * running it: the first sweep came back with the nib laying down MORE ink
     * than the monoline (39 697 px against 26 492) and a median half-width of
     * 13.0 against 6.7, which is the opposite of a subset and was the connecting
     * lines being filled. */
    const stamp = (x: number, y: number, rx: number, ry: number) => {
      ctx.moveTo(x + rx * Math.cos(pen.angle), y + rx * Math.sin(pen.angle))
      ctx.ellipse(x, y, rx, ry, pen.angle, 0, Math.PI * 2)
    }

    let budget = totalLen * Math.max(0, Math.min(1, progress))
    for (const s of strokes) {
      if (budget <= 0) break
      const drawLen = Math.min(budget, s.len)
      budget -= drawLen
      const complete = drawLen >= s.len - 1e-6

      const at = (d: number) => {
        let i = 1
        while (i < s.cum.length - 1 && s.cum[i] < d) i++
        const seg = s.cum[i] - s.cum[i - 1]
        const f = seg > 0 ? (d - s.cum[i - 1]) / seg : 0
        return {
          x: s.pts[i - 1].x + (s.pts[i].x - s.pts[i - 1].x) * f,
          y: s.pts[i - 1].y + (s.pts[i].y - s.pts[i - 1].y) * f,
        }
      }

      if (s.pts.length === 1 || s.len === 0) {
        // A pen dot is the nib itself, set down once.
        stamp(s.pts[0].x, s.pts[0].y, a, b)
        continue
      }

      for (let d = 0; d <= drawLen + 1e-9; d = Math.min(d + STEP, drawLen + 1e-9)) {
        const p = at(d)
        /* THE EXIT TAPER ONLY EXISTS ONCE THE PEN HAS LIFTED. While a stroke is
         * still being drawn its leading edge is the nib itself, set down at full
         * size — so a partly-drawn stroke tapers at its entry and is blunt at the
         * front. Reading `s.len - d` unconditionally would taper an edge the pen
         * is still standing on. */
        const endArc = complete ? Math.min(d, s.len - d) : d
        const k = taperLen > 0 ? penTaperProfile(endArc / taperLen, pen.tip ?? PEN_TIP_FRACTION) : 1
        stamp(p.x, p.y, Math.max(a * k, 0.05), Math.max(b * k, 0.05))
        if (d >= drawLen) break
      }
    }
    ctx.fill("nonzero")
  }

  const draw = (ctx: CanvasRenderingContext2D, progress: number, ink: string) => {
    if (nib && (nib.aspect > 1.0001 || nib.taperRadii > 0)) return drawNib(ctx, progress, ink, nib)
    ctx.strokeStyle = ink
    ctx.lineWidth = lineWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    let budget = totalLen * Math.max(0, Math.min(1, progress))
    for (const s of strokes) {
      if (budget <= 0) break
      if (s.pts.length === 1) {
        // A single-point stroke is a pen dot, not a no-op.
        ctx.beginPath()
        ctx.arc(s.pts[0].x, s.pts[0].y, lineWidth / 2, 0, Math.PI * 2)
        ctx.fillStyle = ink
        ctx.fill()
        continue
      }
      ctx.beginPath()
      if (budget >= s.len) {
        s.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
        ctx.stroke()
        budget -= s.len
      } else {
        ctx.moveTo(s.pts[0].x, s.pts[0].y)
        for (let i = 1; i < s.pts.length; i++) {
          if (s.cum[i] <= budget) {
            ctx.lineTo(s.pts[i].x, s.pts[i].y)
          } else {
            const seg = s.cum[i] - s.cum[i - 1]
            const f = seg > 0 ? (budget - s.cum[i - 1]) / seg : 0
            ctx.lineTo(
              s.pts[i - 1].x + (s.pts[i].x - s.pts[i - 1].x) * f,
              s.pts[i - 1].y + (s.pts[i].y - s.pts[i - 1].y) * f,
            )
            break
          }
        }
        ctx.stroke()
        budget = 0
      }
    }
  }

  /* THE CLOCK. Only real when the caller handed over a recording, and the
   * strokes have to be the SAME ones — a timing table for a different word is
   * worse than no timing at all, so the count is checked rather than assumed. */
  const hasTiming = !!timedStrokes && timedStrokes.length === polylines.length

  const drawAtTime = (
    ctx: CanvasRenderingContext2D,
    timeFrac: number,
    ink: string,
    mode: RevealMode = "hybrid",
    hybridBlend = 0.4,
    // `draw` is a plain prefix, the one layout where a lift is always a gap on
    // screen, so Natural holds on lifts here unless a caller says otherwise.
    liftHolds = true,
  ) => {
    const d = hasTiming
      ? revealDistanceFraction(timedStrokes as ProcessedStroke[], timeFrac, mode, hybridBlend, liftHolds)
      : timeFrac
    draw(ctx, d, ink)
  }

  return { totalLen, lineWidth, draw, drawAtTime, hasTiming }
}

/**
 * Measure where the 3D form actually sits on screen, by reading the WebGL
 * canvas and finding the bounding box of everything non-transparent.
 *
 * This is the live equivalent of the capture's `opaqueBBox(front)`: the flat
 * word is fitted to the 3D form's real footprint rather than to a guess, so at
 * the handoff the two layers are the same size in the same place. Any offset
 * would read as a shift at the exact instant the beat is claiming the two
 * images are one object.
 *
 * Requires `preserveDrawingBuffer` on the WebGL context, which this app already
 * sets for its capture path. Returns null if the buffer is empty or unreadable
 * — the caller should keep its previous footprint rather than snapping to a
 * bad one.
 */
export function measureCanvasFootprint(
  source: HTMLCanvasElement,
  cssWidth: number,
  cssHeight: number,
): FlatFootprint | null {
  try {
    const probe = document.createElement("canvas")
    // Downsample hard: we only need a bounding box, and reading a full-res
    // WebGL buffer every time would cost more than the measurement is worth.
    const PROBE_W = 320
    const ratio = source.height / Math.max(source.width, 1)
    probe.width = PROBE_W
    probe.height = Math.max(1, Math.round(PROBE_W * ratio))
    const pctx = probe.getContext("2d", { willReadFrequently: true })
    if (!pctx) return null
    pctx.drawImage(source, 0, 0, probe.width, probe.height)
    const { data } = pctx.getImageData(0, 0, probe.width, probe.height)

    // MEASURE THE INK, NOT THE SCENE.
    //
    // The first version keyed on "any non-transparent pixel", which is wrong
    // here: the viewport also draws a grid helper and a ground plane, so the
    // bbox came back as most of the canvas and the flat word was fitted far too
    // wide and off-centre — visible as a ghost word sitting beside the form at
    // the handoff, which is the exact moment the beat is claiming the two are
    // one object.
    //
    // The form is near-black and everything else in the scene is light, so
    // gate on LUMINANCE as well as coverage. The threshold is generous because
    // the ink is lit and its rim is much lighter than its body.
    const INK_LUMA_MAX = 110
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    for (let y = 0; y < probe.height; y++) {
      for (let x = 0; x < probe.width; x++) {
        const i = (y * probe.width + x) * 4
        if (data[i + 3] <= 20) continue
        const luma = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]
        if (luma > INK_LUMA_MAX) continue
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
    if (!Number.isFinite(minX) || maxX <= minX) return null

    const sx = cssWidth / probe.width
    const sy = cssHeight / probe.height
    return {
      w: (maxX - minX + 1) * sx,
      cx: ((minX + maxX) / 2) * sx,
      cy: ((minY + maxY) / 2) * sy,
    }
  } catch {
    return null
  }
}

/**
 * Lerp the ink toward paper. This is how the flat layer RETIRES at the handoff.
 *
 * It must not be an alpha fade. The flat layer composites with `darken`, so
 * lightening its ink toward the paper colour means the 3D's darker pixels win
 * progressively — the union of the two inks stays fully ink-black at every
 * instant and only flat-only slivers drop out. Fading alpha instead would put
 * two partially-transparent black layers over a light ground, which can only
 * produce grey: it breaks the ink-black law and reads as two different images
 * dissolving rather than one object gaining volume. That bug already shipped
 * once in the film.
 */
export function retireInk(ink: string, paper: string, t: number): string {
  const k = Math.max(0, Math.min(1, t))
  const a = hexToRgb(ink)
  const b = hexToRgb(paper)
  if (!a || !b) return ink
  const mix = (u: number, v: number) => Math.round(u + (v - u) * k)
  return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/* -------------------------------------------------------------------------- */
/*  K7's NEWS — the paper break at a stroke junction                           */
/* -------------------------------------------------------------------------- */

/**
 * One junction, as `app/desk-doodles/page.tsx` publishes it on
 * `window.__heroJunctions`. Structural mirror of its `HeroJunction`, restated
 * here rather than imported because importing a React route module into a
 * renderer would pull the whole page into the viewport's bundle.
 *
 * ⚠ THE SET IS NOT DERIVED HERE. The page measures it (`findHeroJunctions`,
 * over the same processed strokes the geometry is built from) and this file
 * turns it into something a shader can consume. Two independent measurements
 * of "where does this word touch itself" is exactly the two-sources-of-truth
 * class this codebase keeps paying for.
 */
export interface HeroJunctionInput {
  /** Index of the EARLIER stroke — the one that gets broken. */
  under: number
  /** Index of the LATER stroke — the one that stays whole, in front. */
  over: number
  /** The junction point, in stroke coordinates. A point ON the under stroke. */
  x: number
  y: number
  /** Closest centreline approach, stroke coordinates. */
  gap: number
  /**
   * ── WHICH ARC, WHEN THE TWO STROKES ARE ONE STROKE (2026-08-02) ──────────
   *
   * A point index into `strokes[under].points` / `strokes[over].points`. Both
   * OPTIONAL and both a no-op on every junction that shipped: the page
   * publishes `x, y` as a point taken off the under stroke, so
   * `nearestIndex(A, x, y)` already returns `underAt` exactly and the fallback
   * below is the identity on the whole 22-contact set.
   *
   * THEY EXIST BECAUSE A STROKE CAN CROSS ITSELF, AND THIS INTERFACE COULD NOT
   * SAY SO. `findHeroJunctions` excluded same-stroke contacts on the stated
   * reason that a stroke passing near itself *"has no 'later' stroke to be in
   * front, so there is no pen order to show."* That reason is FALSE and
   * `scripts/verify/_probe-crossing-census.mjs` is the measurement that says so:
   * within one stroke the pen order is the ARC — the later arc was drawn later
   * and is in front, by exactly the record the whole mechanism rests on. Seven
   * places on this word are a stroke crossing itself (the cursive loops of
   * `D s D o o d e`, 54–88°), and they are the only steep crossings besides
   * 7→8.
   *
   * WITHOUT THESE TWO FIELDS THE CASE DEGRADES SILENTLY TO NOTHING, which is
   * the worst of the three possible failures. With `under === over` both
   * samples resolved through `nearestIndex` from ONE published point, so both
   * landed on the same index, `d(p, over)` was 0 everywhere, `cut` came out 0
   * and the junction was counted as dropped. It looked exactly like a junction
   * the law had considered and rejected.
   *
   * ⚠ AND THE TWO WALKS THEN HAVE TO BE BOUNDED, or the under sample walks
   * straight through the crossing and starts describing the over arc. See
   * `walkOut`'s `loBound`/`hiBound` and the `mid` split below.
   *
   * The SHADER needs neither field: `syncBreakTable` uploads the three-point
   * samples and the two radii, never the indices.
   */
  underAt?: number
  overAt?: number
}

/**
 * HOW FAR EITHER SIDE OF THE JUNCTION THE BREAK REACHES, in ink diameters.
 *
 * It bounds the cut along the under stroke, and it is load-bearing because the
 * cut length is a function of the CROSSING ANGLE, not of the reach: the under
 * stroke stays inside the band for an arc of roughly `2·outer / sin θ`, which
 * at this word's shallowest junction (0.4°, strokes 7 and 9) is unbounded.
 * Nine of the twenty-two junctions cross at under 20°
 * (`scripts/verify/_probe-hero-breaks.mjs`), so without this the beat would
 * delete whole letters at the return.
 *
 * 1.25 caps the worst case at 2·R = 2.5 ink diameters of missing centreline,
 * measured max 29.2 units against an ink diameter of 22.6.
 */
export const JOINT_BREAK_REACH_K = 1.25

/**
 * HOW FAR THE THREE-POINT SAMPLE MAY DEPART FROM THE REAL CENTRELINE, in stroke
 * units, before it is truncated — `walkOut`'s second stopping condition.
 *
 * One unit, and the number is not new: it is the accuracy `JointBreak`'s own
 * docstring has claimed since the sample was three points rather than two
 * (*"three points halve the chord and put the sagitta under a stroke unit"*).
 * It was a claim and not a constraint, and measured it was false at four of this
 * word's six junctions. Making it a constraint costs a shorter sample at a
 * corner, which is the correct trade: a break placed against a centreline that
 * is 8 units away from the stroke is worse than a break that reaches less far.
 *
 * One unit is ~0.53 screen px at the shipped stage — half the outline error the
 * pen field is already baked to (`PEN_FIELD_UNITS_PER_TEXEL`), so the sample
 * stops being the limiting approximation rather than becoming one.
 */
export const JOINT_BREAK_SAGITTA_MAX = 1

/**
 * HOW MUCH MORE PAPER A BREAK MAY OPEN THAN THE INK THAT HIDES IT, as a
 * multiple of the identity a real crossing satisfies exactly.
 *
 * The identity is `cut · keepOver = behind · gap` and it holds at every crossing
 * angle — see the drop rule in `buildJointBreaks` for the derivation and for the
 * three measured values on this word (0.51, 1.02, 12.8). 2 is a factor of two of
 * slack on a quantity whose true value is 1; the slack exists because a bent
 * stroke puts a genuine 81° crossing at 1.02 rather than 1.00.
 */
export const JOINT_BREAK_OCCLUSION_MAX = 2

/**
 * THE HALF-WIDTH THE STROKE IN FRONT KEEPS, as a multiple of the nominal ink
 * RADIUS — i.e. where the paper band starts.
 *
 * The nominal radius is exact: Inflate derives `inflateStrokeRadiusXY =
 * (effectiveThicknessPx · coordScale) / 2` from the same
 * `computeSolidEffectiveThicknessPx` the page publishes as `inkWidth`
 * (lib/geometry-engines.ts). What it is NOT is the radius the surface actually
 * has at a given sample: the implicit field uses
 * `radiusXY · bulgeScale · ink[i]`, where `bulgeScale = 1 + crossSectionBulge`
 * (1.07 at the hero's puff) and `ink[i]` is a per-sample profile of mean 1.
 *
 * 1.06 is that bulge, and the residual is the profile's own variation. Measured
 * rather than argued: the rendered mark's medial-axis half-width is
 * 7.07 px with a spread of 0.493 px (`FlatState`'s own note in
 * components/viewport-3d.tsx), i.e. ±7 %, so this constant is wrong by at most
 * **0.84 stroke units ≈ 0.5 px at the shipped stage scale** in either
 * direction. Too small either to notch the stroke in front or to leave an ink
 * collar around it, which are the two failure modes of getting it wrong.
 *
 * ⚠ THIS IS THE **TUBE'S** HALF-WIDTH, AND SINCE THE PEN CARVE LANDED IT IS
 * ONLY THE TUBE'S. `buildJointBreaks` now lerps away from it by `carve` — see
 * `carvedHalfWidth` and the `carve` parameter there. At `carve = 0` every
 * radius is still exactly this constant, so the parked `carveLaw: "prior"` arm
 * renders byte for byte as before; at `carve = 1` the ink is the nib's and this
 * number is 0.37 R too wide, which is the ink collar its own last paragraph
 * names. Measured on the shipped word (`scripts/verify/_probe-break-carve.mjs
 * --geom`): the six junctions' carved half-widths run **0.56 R to 1.00 R**
 * against this 1.06 R, so the error is not a rounding — at 4→5 the band started
 * 0.50 R outside the ink it was supposed to hide behind.
 */
export const JOINT_BREAK_KEEP_K = 1.06

/**
 * THE HALF-WIDTH THE CARVED MARK ACTUALLY HAS AT ONE CENTRELINE SAMPLE.
 *
 * The break's two radii are both "the ink half-width of a stroke" — on the
 * under clause the depth the cut may reach from the broken stroke's own
 * centreline, on the over clause where the stroke in front ends and the paper
 * begins. On the tube those are one constant. On a carved mark they are the
 * NIB's, and the nib's half-width is a function of travel DIRECTION
 * (`nibHalfWidth`), so they are neither constant nor equal to each other.
 *
 * ⚠ AND IT IS THE UNION'S HALF-WIDTH, WHICH IS NOT OBVIOUSLY THE LOCAL
 * SAMPLE'S. `buildPenField` bakes `min_j (|q − p_j| − w_j)`, a union of stamps,
 * so the outline on the perpendicular at sample `i` is `max_j sqrt(w_j² −
 * d_ij²)` — a neighbour with a fatter stamp can bulge past the local one, which
 * is the same one-sample mistake the field's own comment warns about one level
 * up. Measured rather than assumed (`_probe-break-carve.mjs --geom`, the `union`
 * column): on this word the neighbour never wins — the union half-width equals
 * the local `penHalfWidth` at all six junctions, to the printed 0.01 R. So the
 * local value is used, and the measurement is what says that is legitimate
 * rather than the assumption.
 *
 * `theta` and `endArc` are derived exactly as `buildPenField` derives them, from
 * the neighbouring points and the cumulative arc, because a second derivation of
 * the same two quantities is how the field and the break would drift apart.
 */
export function carvedHalfWidth(
  points: FlatPoint[],
  index: number,
  nominalRadius: number,
  nib: PenNib = PEN_NIB_DEFAULT,
): number {
  if (points.length === 0) return nominalRadius
  if (points.length === 1) return penHalfWidth(0, 0, nominalRadius, nib)
  const i = Math.max(0, Math.min(points.length - 1, index))
  const a = points[Math.max(0, i - 1)]
  const b = points[Math.min(points.length - 1, i + 1)]
  const theta = Math.atan2(b.y - a.y, b.x - a.x)
  let total = 0
  let atI = 0
  for (let k = 1; k < points.length; k++) {
    total += Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y)
    if (k === i) atI = total
  }
  return penHalfWidth(theta, Math.min(atI, total - atI), nominalRadius, nib)
}

/**
 * A junction the renderer can act on: two three-point centreline samples in
 * stroke coordinates, and the measured length of under-stroke centreline the
 * break removes.
 *
 * Three points and not two because the inner bound trims the stroke in front to
 * a fixed distance from its own centreline — approximating a curving stroke by
 * one chord over ±1.25 ink diameters would cut into it on the outside of the
 * bend. Three points halve the chord and put the sagitta under a stroke unit.
 *
 * ⚠ THAT LAST SENTENCE WAS A HOPE, NOT A BOUND, AND MEASURED IT WAS FALSE at
 * four of this word's six junctions — worst 8.46 units, 0.75 R, at the `s`'s
 * corner (`_probe-break-carve.mjs --geom`). It is now enforced: `walkOut` stops
 * the sample where its own chord stops tracking, at `JOINT_BREAK_SAGITTA_MAX`.
 * The enforcement is reachable only at `carve > 0`, because the parked
 * `carveLaw: "prior"` arm is a shipped picture that may not move.
 */
export interface JointBreak {
  underIndex: number
  overIndex: number
  /** The junction point — also the middle sample of `under`. */
  c: FlatPoint
  /** Under stroke, at arc-length −reach / 0 / +reach about the junction. */
  under: [FlatPoint, FlatPoint, FlatPoint]
  /** Over stroke, at arc-length −reach / 0 / +reach about its closest point. */
  over: [FlatPoint, FlatPoint, FlatPoint]
  /** Centreline length of the under stroke this break removes, stroke units. */
  cut: number
  /**
   * THE THREE RADII, PER JUNCTION, BECAUSE THE CARVED MARK HAS NO ONE WIDTH.
   *
   * `keepUnder` bounds the cut to the ink of the stroke being broken;
   * `keepOver` is where the stroke in front ends and the paper band starts;
   * `outer` is where the band ends. All three are `JOINT_BREAK_KEEP_K ·
   * inkDiameter / 2` at `carve = 0` — one number, the shipped one — and lerp to
   * the nib's own half-width at `carve = 1`. They are per-break rather than
   * global because `nibHalfWidth` is a function of travel direction and the six
   * junctions of this word travel in six directions: 0.56 R to 1.00 R.
   */
  keepUnder: number
  keepOver: number
  outer: number
  /**
   * Centreline length of the under stroke that is HIDDEN — inside the ink of
   * the stroke in front — in the same window and the same units as `cut`. The
   * two together are what says whether a break is an occlusion: see the drop
   * rule in `buildJointBreaks`.
   */
  behind: number
}

function segDist(
  qx: number,
  qy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax
  const vy = by - ay
  const L = vx * vx + vy * vy
  const t = L > 0 ? Math.max(0, Math.min(1, ((qx - ax) * vx + (qy - ay) * vy) / L)) : 0
  return Math.hypot(ax + t * vx - qx, ay + t * vy - qy)
}

function polyDist(qx: number, qy: number, p: [FlatPoint, FlatPoint, FlatPoint]): number {
  return Math.min(
    segDist(qx, qy, p[0].x, p[0].y, p[1].x, p[1].y),
    segDist(qx, qy, p[1].x, p[1].y, p[2].x, p[2].y),
  )
}

/**
 * The nearest point on a three-point centreline sample, its distance, and its
 * ARC DISTANCE from the sample's middle point.
 *
 * The arc term is what bounds a break to the junction. Without it the cut runs
 * for as far as the band does, and how far that is depends on the CROSSING
 * ANGLE — `2·gap / sin θ`, which at this word's shallowest junction (0.4°) is
 * the whole stroke.
 */
function polyNearest(
  qx: number,
  qy: number,
  p: [FlatPoint, FlatPoint, FlatPoint],
): { x: number; y: number; d: number; arc: number } {
  let best = { x: p[1].x, y: p[1].y, d: Infinity, arc: 0 }
  for (let s = 0; s < 2; s++) {
    const a = p[s]
    const b = p[s + 1]
    const vx = b.x - a.x
    const vy = b.y - a.y
    const L = vx * vx + vy * vy
    const t = L > 0 ? Math.max(0, Math.min(1, ((qx - a.x) * vx + (qy - a.y) * vy) / L)) : 0
    const px = a.x + t * vx
    const py = a.y + t * vy
    const d = Math.hypot(px - qx, py - qy)
    if (d < best.d) {
      const len = Math.sqrt(L)
      best = { x: px, y: py, d, arc: s === 0 ? (1 - t) * len : t * len }
    }
  }
  return best
}

/**
 * Walk out from `i` along `pts` until `dist` of arc length is covered — or
 * until the CHORD from `pts[i]` to where we have walked stops describing the
 * stroke, whichever comes first.
 *
 * ⚠ THE SECOND CONDITION IS NEW, AND IT IS ENFORCING A CLAIM THIS FILE ALREADY
 * MADE. `JointBreak`'s docstring says the three-point sample exists so that
 * *"three points halve the chord and put the sagitta under a stroke unit"*.
 * Measured on the shipped word (`_probe-break-carve.mjs --geom`, the SAGITTA
 * column) that is false at four of six junctions and badly false at two:
 *
 *     junction     sagitta, under / over stroke, stroke units
 *      0 -> 2      2.91 / 0.00
 *      4 -> 5      1.63 / 0.00
 *      7 -> 8      1.02 / 0.00
 *      7 -> 9      1.38 / 1.84
 *     13 -> 14     8.31 / 4.01
 *     18 -> 19     8.46 / 0.00      ← 0.75 R, at the `s`'s corner
 *
 * Every distance in the break's law is measured to that chord, so at 18→19 the
 * cut was being placed against a centreline displaced by three quarters of a
 * stroke radius. On the fat tube that was inside the ink either way; on a carved
 * mark it is most of the stroke.
 *
 * `sagittaMax` of `Infinity` reproduces the previous walk exactly, which is what
 * `carve = 0` passes — the parked `carveLaw: "prior"` arm is a shipped, gated
 * picture and this correction may not move it by a pixel.
 *
 * ── AND `loBound`/`hiBound` EXIST FOR THE SELF-CROSSING (2026-08-02) ────────
 * When the two strokes of a junction are ONE stroke, the two samples share a
 * polyline, and a ±reach walk from the under arc runs straight through the
 * crossing and into the over arc: `reach` is 1.25 ink diameters ≈ 28.3 units
 * and the census only admits a self-contact whose two arcs are more than
 * `2 · inkDiameter` ≈ 45.2 units apart, so the midpoint between them can sit as
 * close as 22.6 units — INSIDE the walk. A chord that spans the crossing does
 * not describe either arc, and every distance in the break's law is measured to
 * that chord. Defaulting to the whole polyline is the previous walk exactly.
 */
function walkOut(
  pts: FlatPoint[],
  i: number,
  dist: number,
  sign: 1 | -1,
  sagittaMax = Infinity,
  loBound = 0,
  hiBound = pts.length - 1,
): FlatPoint {
  let acc = 0
  let k = i
  let last = i
  for (;;) {
    const n = k + sign
    if (n < loBound || n > hiBound) break
    acc += Math.hypot(pts[n].x - pts[k].x, pts[n].y - pts[k].y)
    k = n
    if (Number.isFinite(sagittaMax)) {
      let dev = 0
      for (let m = i + sign; m !== k; m += sign) {
        const d = segDist(pts[m].x, pts[m].y, pts[i].x, pts[i].y, pts[k].x, pts[k].y)
        if (d > dev) dev = d
      }
      // Stop BEFORE the point that breaks the bound, so the returned chord is
      // one that still tracks.
      if (dev > sagittaMax) break
    }
    last = k
    if (acc >= dist) break
  }
  return pts[last]
}

function nearestIndex(pts: FlatPoint[], x: number, y: number): number {
  let bi = 0
  let bd = Infinity
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i].x - x) ** 2 + (pts[i].y - y) ** 2
    if (d < bd) {
      bd = d
      bi = i
    }
  }
  return bi
}

/**
 * TURN THE PAGE'S JUNCTION SET INTO THE BREAKS THE FLAT INK CAN OPEN.
 *
 * ── THE LAW, and it is the one the shader runs. ────────────────────────────
 * A fragment is PAPER when, letting `p` be the nearest point on the UNDER
 * stroke's centreline and `a` its arc distance from the junction,
 *
 *     d(q, p) <= keep     and     a <= reach     and
 *     keep < d(p, over) <= keep + gap
 *
 * with `keep = JOINT_BREAK_KEEP_K · inkDiameter / 2`, `gap = breakK ·
 * inkDiameter` and `reach = JOINT_BREAK_REACH_K · inkDiameter`.
 *
 *   • the over-distance is evaluated at `p` — ON THE UNDER STROKE'S CENTRELINE
 *     — not at the fragment. That one indirection is what makes every break a
 *     clean SLAB across the under stroke: either a whole cross-section goes or
 *     none of it does.
 *   • `d(p, over) <= keep` is the stroke in front, which is why it passes
 *     through unbroken. That clause is the difference between an over/under
 *     and a hole.
 *   • `d(q, p) <= keep` restricts the cut to ink that belongs to the stroke
 *     being broken. Without it the band also cut strokes drawn AFTER the one in
 *     front — measured on this word at 5 junctions of 22, one of them removing
 *     37.9 units of a later stroke, which would have asserted the reverse of
 *     the news.
 *   • `a <= reach` keeps the break AT the junction.
 *
 * ── WHY IT IS NOT A PERPENDICULAR BAND. ────────────────────────────────────
 * The first draft cut a band perpendicular to the stroke in front. It measured
 * **zero cut on 22 of 22 junctions** and the failure is structural, not a
 * tuning miss: at a crossing the two strokes occupy the same perpendicular
 * band, so nothing perpendicular can separate them. The separation is RADIAL —
 * distance to the centreline of the stroke in front.
 *
 * ── AND WHY THE OVER-DISTANCE MOVED ONTO THE CENTRELINE. ───────────────────
 * The second draft evaluated it at the fragment. It renders, and it is wrong to
 * LOOK AT, which only the eye pass found: where two strokes run alongside each
 * other the band catches the under stroke's FLANK and misses its middle, so the
 * break comes out as a long thin white scratch running ALONG the stroke instead
 * of across it. Photographed at
 * `docs/verification/hero-k7/zoom/` — a 9x33 px slash down a stem, and a
 * 34x49 px shredded cluster where four junctions overlap. Evaluating on the
 * centreline makes the cut a function of arc position alone, so the cross
 * section is all-or-nothing and a scratch is not expressible.
 *
 * ── WHAT IT DROPS, AND WHY THAT IS NOT A THRESHOLD. ────────────────────────
 * A junction whose two strokes run nearly collinear has the under stroke's
 * centreline INSIDE the front stroke's own tube for the whole reach, so the
 * band never reaches it and the law removes nothing. Those junctions are not
 * weak news, they are no news: there is no over and under to show when one
 * stroke is drawn along another. They are dropped rather than shipped as a
 * break that renders nothing, and the count is returned so the caller can say
 * so.
 */
export function buildJointBreaks(
  strokes: { points: FlatPoint[] }[],
  junctions: HeroJunctionInput[],
  inkDiameter: number,
  breakK: number,
  /**
   * ── THE BREAK HAS TO KNOW THE CARVE (2026-08-01) ─────────────────────────
   *
   * 0 is the tube and is the default, so every existing call site renders byte
   * for byte as it did — including the parked `carveLaw: "prior"` arm, which is
   * the one place the shipped beat still draws a break on an uncarved mark.
   *
   * WHY IT IS NEEDED. Every radius below is `k · inkDiameter`, and
   * `inkDiameter` is the TUBE's. `FlatState.penCarve` replaces the tube's
   * silhouette with the pen's, whose half-width on this word runs 0.56 R to
   * 1.00 R against the tube's 1.06 R — so at `penCarve = 1` the paper band
   * started as much as 0.50 R OUTSIDE the ink it exists to hide behind. That is
   * the ink collar `JOINT_BREAK_KEEP_K`'s own comment names, and it is what
   * `assert-hero-k7-intact.mjs` had been red on since the carve landed: K1 6
   * components against K7 9, the "shattered `sk`" the assert was written from.
   *
   * WHAT IT DOES, PER JUNCTION, on the shipped six at carve 1.00. The radii
   * come first; the two drop rules below then read the geometry the radii make
   * visible, which is why all three arrived together and none of them could have
   * been found on a tube:
   *
   *     junction   tube-sized break         carve-sized break
   *      7 -> 8    97 px, 463 px ADRIFT     92 px, assembled  ✓  the one clean
   *                                         over/under on this word: an 81°
   *                                         crossing, gaps hugging the tick
   *     13 -> 14   32 px                    dropped — the carved strokes do not
   *                                         touch at all (19.20 units apart
   *                                         against half-widths of 10.08 + 8.03)
   *     18 -> 19   68 px, 410 px adrift     dropped — the three-point sample was
   *                                         8.46 units off the `s`'s corner; with
   *                                         the sagitta bound the band no longer
   *                                         reaches the real centreline
   *      7 -> 9    170 px, 446 px adrift    dropped — 33.4 units of paper opened
   *                                         against 3.5 units of ink hiding it
   *      4 -> 5    3 px                     dropped — stroke 5 is a TICK lying
   *                                         along the `s` at 19°, a retrace; its
   *                                         break severed "De" from "sk"
   *
   * ── AND THE HONEST RESULT, LIVE, at carve 1.00 (the gates run against a
   * sandbox build carrying the renderer diff below, since this lane does not own
   * `components/viewport-3d.tsx`):
   *
   *     the shipped tube-sized break   K1 6 components, K7 9   336 px of news
   *     radii + sagitta + ratio        K1 6, K7 7              207 px  news 8/8
   *     all of it, as landed           K1 6, K7 6   ✓          97 px
   *
   * ⚠ SO THE TWO K7 GATES CANNOT BOTH HOLD ON THIS JUNCTION SET, and that is a
   * property of the SET, not of the law. Of the six junctions the shipped
   * `findHeroJunctions` publishes, exactly ONE is a real crossing — the census in
   * `app/desk-doodles/page.tsx` already says so from the other side: *"1 of 22
   * one stroke genuinely LAID ACROSS another"*. One crossing is 97 px of news
   * against `assert-hero-k7-news`'s 200 px floor. The mark is whole and the news
   * is thin; the alternative is the news and a mark that comes apart.
   *
   * THE LEVER THAT IS LEFT IS THE SET. `findHeroJunctions`'s terminals guard
   * drops a junction unless it is further than `JOINT_BREAK_REACH_K ·
   * inkDiameter` from either end of the UNDER stroke — which is backwards for
   * this failure: the further a junction is from the end, the BIGGER the stub the
   * break leaves floating. Run the law above over the 22-junction prior set with
   * that clause relaxed and six more junctions open cleanly — 0→1, 3→4, 4→6,
   * 6→7, 8→9, 16→17, worth 142 / 76 / 114 / 78 / 74 / 130 px each, every one of
   * them leaving the mark assembled. `_probe-break-carve.mjs --prior --guard
   * --noAEnd --perBreak` is that measurement. It is not this lane's file and it
   * is not this lane's call.
   */
  carve = 0,
  nib: PenNib = PEN_NIB_DEFAULT,
): { breaks: JointBreak[]; dropped: number; reach: number; keep: number; gap: number } {
  const reach = JOINT_BREAK_REACH_K * inkDiameter
  const keep = (JOINT_BREAK_KEEP_K * inkDiameter) / 2
  const gap = Math.max(0, breakK) * inkDiameter
  /**
   * ⚠ `c > 0` IS A STEP, NOT A RAMP, AND THAT IS DELIBERATE. The radii below
   * lerp continuously with the carve, but the sagitta bound and the two drop
   * rules switch ON the moment the carve leaves zero. The reason is §0.7: the
   * parked `carveLaw: "prior"` arm draws the break on an UNCARVED mark and is a
   * shipped, gated picture that may not move by a pixel, so `carve === 0` has to
   * be the old code path exactly — not a limit of the new one.
   *
   * The step is unreachable in the shipped beat. `hero-motion.ts` gives
   * `penCarve = carveAmount × flat` and the break only ever opens at K7, where
   * `flat` is 1 — so the carve the break sees is `carveAmount` itself, 1 by
   * default and 0 on the parked arm. A carveAmount of 0.01 would land on the
   * new arm with almost-tube radii, which is the honest reading of that dial and
   * not a defect.
   */
  const c = Math.max(0, Math.min(1, carve))
  const R = inkDiameter / 2
  /** The tube's radius at `carve = 0`, the nib's at 1. One law, both arms. */
  const sized = (pts: FlatPoint[], i: number) =>
    keep + (carvedHalfWidth(pts, i, R, nib) - keep) * c
  /**
   * EVERY SAMPLE'S CARVED HALF-WIDTH ON ONE STROKE, MEMOISED — and the
   * memoisation is not premature. `carvedHalfWidth` walks the whole polyline to
   * find its arc length, so it is O(n) per call; the self-crossing attachment
   * test below asks for every point of one stroke against every point of every
   * other, and calling it inside that loop would be O(n³) on a 1078-point word.
   * Computed lazily so a junction set with no self-crossings pays nothing.
   */
  const widthCache = new Map<number, number[]>()
  const widthsOf = (s: number): number[] => {
    let w = widthCache.get(s)
    if (!w) {
      const pts = strokes[s]?.points ?? []
      w = pts.map((_, i) => sized(pts, i))
      widthCache.set(s, w)
    }
    return w
  }
  /**
   * The sagitta the three-point sample is allowed — see `walkOut`. `Infinity` at
   * `carve = 0` is the shipped walk, byte for byte; one stroke unit at any carve
   * above zero is the bound this file's own `JointBreak` docstring already
   * claims. It is not lerped: an accuracy bound is either enforced or it is not,
   * and half of one is a third law nobody could reason about.
   */
  const sag = c > 0 ? JOINT_BREAK_SAGITTA_MAX : Infinity
  const breaks: JointBreak[] = []
  let dropped = 0

  for (const jn of junctions) {
    const A = strokes[jn.under]?.points
    const B = strokes[jn.over]?.points
    if (!A || !B || A.length < 2 || B.length < 2) {
      dropped++
      continue
    }
    /**
     * ── THE TWO SAMPLES ARE KEYED ON ARC, NOT ON STROKE INDEX (2026-08-02) ──
     *
     * `?? nearestIndex(...)` is the identity on every junction that shipped —
     * the page publishes `x, y` as a point taken off the under stroke — so the
     * distinct-pair set resolves exactly as it did. See `HeroJunctionInput`'s
     * `underAt`/`overAt` for why the fields exist at all.
     *
     * A SELF-CROSSING WITHOUT THEM IS NOT A JUNCTION, so it is dropped and
     * COUNTED rather than left to collapse: both samples would resolve to the
     * same index from one point, `d(p, over)` would be 0 for the whole walk,
     * `cut` would come out 0 and the `cut <= 0.5` rule below would report it as
     * a junction the law considered. It never reached the law.
     */
    const selfJn = jn.under === jn.over
    if (selfJn && (jn.underAt === undefined || jn.overAt === undefined)) {
      dropped++
      continue
    }
    const ai = jn.underAt ?? nearestIndex(A, jn.x, jn.y)
    const bi = jn.overAt ?? nearestIndex(B, jn.x, jn.y)
    if (selfJn && ai === bi) {
      dropped++
      continue
    }
    /**
     * THE SPLIT, and it is a device for the LAW and never for the mark. On a
     * self-crossing the under arc and the over arc are two halves of one
     * polyline, so each walk is bounded to its own half at the midpoint index
     * between the two contacts. Nothing about the drawing is cut in two: the
     * pen field the shader carves is still baked from the 22 real strokes, and
     * `carvedHalfWidth` below is still measured against the WHOLE stroke's arc,
     * so the taper at the split is the taper the mark actually has. The bound
     * exists so the three-point chord describes one arc — see `walkOut`.
     */
    const mid = (Math.min(ai, bi) + Math.max(ai, bi)) >> 1
    let uLo = selfJn && ai > bi ? mid : 0
    let uHi = selfJn && ai < bi ? mid : A.length - 1
    const oLo = selfJn && bi > ai ? mid : 0
    const oHi = selfJn && bi < ai ? mid : B.length - 1

    /**
     * ── A SELF-CROSSING MAY NOT OPEN ITS OWN LEAD-IN (2026-08-02) ───────────
     *
     * FOUND BY LOOKING, at 5x and 10x, at every self-crossing this word has
     * (`scripts/verify/_probe-self-cross.mjs --perBreak --png --diagAll`). The
     * arc-keyed set opens six breaks worth 635 px — three times the news floor —
     * and TWO of them take the mark apart: 3→3 detaches 849 px of the `e` of
     * *Desk* and 16→16 detaches 751 px of the `e` of *Doodles*, each leaving a
     * letter that reads as bitten rather than as crossed. A third, 0→0, sets the
     * `D`'s entry tick adrift as a sub-40-px CRUMB, which the component count
     * cannot see at all.
     *
     * ── AND IT IS STRUCTURAL, NOT A TUNING MISS ─────────────────────────────
     * A break cuts the under stroke in TWO places — one slab either side of the
     * stroke in front — so it leaves three pieces: the tail before the first
     * cut, the sliver between the cuts (which is `behind`, fused to the ink in
     * front and therefore safe), and the tail after the second cut.
     *
     * On a DISTINCT pair both tails are the under stroke's own ends, and both
     * were already reaching OTHER strokes — which is what `findHeroJunctions`'s
     * far-side clause tests, and why the pair case is already safe.
     *
     * ON A SELF-CROSSING THE ARC IN FRONT IS THE SAME STROKE, so joining it
     * joins nothing new. ⚠ THIS IS THE STEP THE FIRST DRAFT GOT WRONG, and only
     * the picture found it: the draft reasoned that the later side "reaches the
     * over arc itself, so it is attached by construction", closed only the
     * lead-in side, and 3→3 still detached 849 px. Coloured by connected body
     * (`_probe-self-cross.mjs --png`, and the palette had to be made separable
     * before the answer was visible at all) the floating piece is the WHOLE `e`
     * — its loop and its bar — while the piece that stayed was the tail running
     * into the `s`. The `e` of *Desk* touches the rest of the word at ONE end,
     * and the crossing sits between that end and everything else.
     *
     * SO THE FAR SLAB IS NOT CUT AT ALL, AND THAT IS PROVABLE RATHER THAN
     * TUNED. Cut ONLY the slab between the two arcs and the under stroke is
     * severed at one place, `ai + δ`. The piece `[0 … ai + δ]` still contains
     * the ink AT the crossing — `behind`, the ink the law deliberately keeps
     * because it is inside the arc in front — and that ink is FUSED to the arc
     * in front, which lies in the other piece. So the two pieces are joined
     * through the very stroke that is passing over them, for every stroke, on
     * every drawing, whatever else the letter touches. A one-sided break cannot
     * disconnect a mark.
     *
     * It costs NO SHADER CHANGE: pulling the under sample's own lower bound up
     * to the junction means the chord no longer reaches back past it, so nothing
     * back there is within `keepUnder` of the chord, so nothing back there is
     * cut. `uLo = ai` is the whole implementation.
     *
     * AND IT IS STILL AN OVER/UNDER. 10→10 on the `D` of *Doodles* is what it
     * looks like at 5x (`docs/verification/hero-k7/self-cross/self-10-10@.png`)
     * — the stem stops above the tail, the tail passes unbroken, the stem's foot
     * survives below it. The pen order is legible in ink alone, which is the
     * whole requirement.
     *
     * ── WHAT WAS TRIED FIRST, AND WHY IT IS NOT HERE ────────────────────────
     * The sharper law is per-piece: cut BOTH slabs when both resulting pieces
     * independently touch another stroke, since then neither can float. It was
     * built and measured, and it is not trustworthy yet. On 16→16 both pieces
     * report a touch on stroke 17 and stroke 20 — outside the break's own
     * window, so not the obvious mistake — and the mark still came apart, 769 px
     * of the `e` of *Doodles* adrift. The test asks `|p_i − p_j| ≤ w_i + w_j`,
     * i.e. it treats each stamp as a DISC, and the mark is a union of NIB
     * stamps, which are ellipses: a grazing contact can satisfy the disc test
     * and leave no fused pixels at all. Getting it right means asking the FIELD
     * (`samplePenField` at the midpoint) rather than the radii, and the field is
     * not built at this point in the pipeline. Left as the named next step
     * rather than shipped as a rule that disagrees with the picture — it is
     * worth roughly 60 px of extra news, against a floor this set already
     * clears.
     *
     * ⚠ IT IS SELF-ONLY, DELIBERATELY. `assert-hero-k7-intact
     * --control=nofarside` is calibrated against the DISTINCT-pair far-side
     * clause admitting 18→20 and 18→21, which set 621 px and 638 px adrift. A
     * rule here that also caught those would make that control unable to fail,
     * which is the green-that-cannot-fail this file's own comments keep naming.
     * Nothing on the distinct-pair path moves.
     */
    if (selfJn) uLo = ai
    const under: [FlatPoint, FlatPoint, FlatPoint] = [
      walkOut(A, ai, reach, -1, sag, uLo, uHi),
      A[ai],
      walkOut(A, ai, reach, 1, sag, uLo, uHi),
    ]
    const over: [FlatPoint, FlatPoint, FlatPoint] = [
      walkOut(B, bi, reach, -1, sag, oLo, oHi),
      B[bi],
      walkOut(B, bi, reach, 1, sag, oLo, oHi),
    ]

    /* THE THREE RADII FOR THIS JUNCTION, sized against the ink the mark
     * actually has there. `keepUnder` is the broken stroke's own half-width and
     * `keepOver` the half-width of the stroke that has to hide the cut — two
     * different quantities that only coincide on a tube. */
    const keepUnder = sized(A, ai)
    const keepOver = sized(B, bi)
    const outer = keepOver + gap

    /* DOES THIS BREAK OPEN ANYTHING? The same law, walked along the under
     * stroke's centreline at half a stroke unit — finer than the 4-unit point
     * spacing the strokes are resampled to, so a short crossing cannot be
     * missed between two points. Because the law is evaluated ON the centreline
     * this length IS the length of the gap the eye sees. */
    const c0 = A[ai]
    let cut = 0
    /* HOW MUCH OF THE UNDER STROKE ACTUALLY GOES BEHIND THE OTHER ONE. Same
     * walk, the other half of the question — see the drop rule below. */
    let behind = 0
    /* THE WALK IS BOUNDED TO THE UNDER ARC, for the same reason the chord is.
     * On a self-crossing the over arc is part of THIS polyline and sits within
     * one ink diameter of the under chord, so an unbounded walk would project
     * the stroke in front onto the stroke behind and count its length as
     * `behind` a second time — inflating the quantity BOTH drop rules are
     * measured against. `uLo`/`uHi` are the whole polyline on a distinct pair,
     * so the loop below is byte for byte the previous one there. */
    for (let i = uLo + 1; i <= uHi; i++) {
      const seg = Math.hypot(A[i].x - A[i - 1].x, A[i].y - A[i - 1].y)
      const n = Math.max(1, Math.ceil(seg / 0.5))
      for (let k = 0; k < n; k++) {
        const f = (k + 0.5) / n
        const qx = A[i - 1].x + (A[i].x - A[i - 1].x) * f
        const qy = A[i - 1].y + (A[i].y - A[i - 1].y) * f
        if (Math.hypot(qx - c0.x, qy - c0.y) >= reach + keepUnder) continue
        const near = polyNearest(qx, qy, under)
        if (near.d > keepUnder || near.arc > reach) continue
        const dOver = polyDist(near.x, near.y, over)
        if (dOver <= keepOver) {
          behind += seg / n
          continue
        }
        if (dOver > outer) continue
        cut += seg / n
      }
    }
    if (cut <= 0.5) {
      dropped++
      continue
    }
    /**
     * ── THE PAPER A BREAK OPENS MAY NOT EXCEED THE INK THAT HIDES IT ────────
     *
     * At a real crossing the two arcs are locked together. The under stroke is
     * inside the core for `2·keepOver / sin θ` of centreline and inside the band
     * for `2·gap / sin θ`, so
     *
     *     cut · keepOver  =  behind · gap
     *
     * exactly, at EVERY crossing angle and for every pair of radii — the angle
     * divides out. That is the whole content of "one stroke passes behind
     * another": the gap you open is paid for by the ink that covers it.
     *
     * Measured on this word at carve 1.00, as `cut·keepOver / (behind·gap)`:
     *
     *      4 -> 5    0.51     the strokes run together, so MORE is hidden than
     *                         a clean crossing would hide
     *      7 -> 8    1.02     an 81° crossing. The identity, to 2 %.
     *      7 -> 9   12.8      33.4 units of paper opened against 3.5 units of
     *                         ink hiding it
     *
     * 7→9 is the `k`'s stem against the vertex of the arm-and-leg. The stem
     * grazes the OUTSIDE EDGE of that vertex's ink — it is behind it for three
     * and a half units, a third of a radius — and the band, which wraps a corner
     * as a disc, then opens paper above and below for ten times that. Rendered
     * and looked at at 10x
     * (`docs/verification/hero-k7/break-carve/break-7-9.png`) it is not an
     * over/under at all: two square white blocks punched through the stem with a
     * one-pixel sliver of ink between them and the "stroke in front" sitting
     * BESIDE the cut rather than across it. It is also the last junction on this
     * word that sets a fragment adrift — 444 px of the stem below the arm.
     *
     * ⚠ THE BOUND IS 2 AND NOT 1, and the reason is that 7→8 measures 1.02: the
     * identity is exact only for two straight strokes and one bend puts a real
     * crossing a few percent over. Two is a factor of two of slack on a quantity
     * whose true value is one, and it separates this word's junctions by 6x on
     * the failing side and 2x on the passing side. It is not fitted to make a
     * gate pass — dropping 7→9 COSTS 181 px of the news `assert-hero-k7-news`
     * measures, which is the opposite of convenient.
     *
     * ⚠ AND IT IS ONLY REACHABLE ON A CARVED MARK. At `carve = 0` `keepOver` is
     * 1.06 R for every junction and the tube swallows this word's near-parallel
     * pairs whole, so the ratio cannot be computed against the ink the mark
     * actually has. Gated on `carve` for that reason and because the parked
     * `carveLaw: "prior"` arm is a shipped, gated picture.
     */
    if (c > 0 && cut * keepOver > JOINT_BREAK_OCCLUSION_MAX * behind * gap) {
      dropped++
      continue
    }
    /**
     * ── AND THE WHOLE CROSSING HAS TO FIT INSIDE THE WINDOW ─────────────────
     *
     * `behind + cut` is the arc of the under stroke from where it goes behind
     * the other stroke to where it comes back out past the far edge of the
     * paper — the entire event the break is drawing. `2 · reach` is the window
     * the law allows itself to act over, and `JOINT_BREAK_REACH_K`'s comment
     * says exactly why that window exists: at a shallow contact the arc is
     * *"unbounded"*, so it is CLIPPED. Clipping the ends off an over/under is
     * how you get a break that starts and stops in the middle of nothing.
     *
     * So: if the event does not fit, the break is not drawing an over/under, it
     * is drawing two ends of one. Measured at carve 1.00:
     *
     *      7 -> 8    15.5 + 16.1 = 31.6 of 56.4      an 81° crossing, fits
     *      4 -> 5    39.4 + 25.2 = 64.6 of 56.4      does not fit
     *
     * and 4→5 rendered at 10x
     * (`docs/verification/hero-k7/break-carve/diag-4-5.png`) is what "does not
     * fit" looks like: stroke 5 is a three-and-a-half-radius TICK lying along
     * the `s`'s diagonal at 19°, the pen going back over its own line. There is
     * no over and under — and the break puts a red bite at each END of the tick,
     * which on the live page severs the `s` and takes "De" away from "sk"
     * (K1 6 components, K7 7; the 4823 px body splits 2921 / 1695,
     * `docs/verification/hero-k7/split/split-fix-1.png`).
     *
     * ⚠ THIS IS THE THIRD DROP RULE AND THE RISK IS REAL: three rules fitted
     * against six junctions is a curve through six points. Two things keep it
     * honest. Every constant in it is one the law already had — `reach` and
     * `gap` and `keepOver`, nothing new — and the rule is checked against the
     * PRIOR 22-junction set, where it drops none of the eight junctions that
     * open cleanly and none of the four that damage. That last part matters
     * most: `assert-hero-k7-intact.mjs --control=prior` must still go RED, and
     * it does, because 18→20 and 18→21 fit the window, pass the ratio, and set
     * 621 px and 638 px adrift.
     */
    if (c > 0 && behind + cut > 2 * reach) {
      dropped++
      continue
    }
    breaks.push({
      underIndex: jn.under,
      overIndex: jn.over,
      c: c0,
      under,
      over,
      cut,
      keepUnder,
      keepOver,
      outer,
      behind,
    })
  }

  /* `keep` and `gap` are still returned as the TUBE's scalars, unchanged, and
   * that is not laziness: they are what a caller with one uniform per radius can
   * upload, and at `carve = 0` every per-break radius equals them exactly. A
   * caller that wants the carve has to upload the per-break triple — see the
   * note under `buildPenField` for the shape of that change. */
  return { breaks, dropped, reach, keep, gap }
}

/**
 * One place a stroke crosses ITSELF, keyed on ARC. Spread straight into a
 * `HeroJunctionInput` with `under` and `over` both set to the stroke's own
 * index — which is what `app/desk-doodles/page.tsx` does.
 */
export interface SelfCrossing {
  /** Point index of the EARLIER arc — the arc that gets broken. */
  underAt: number
  /** Point index of the LATER arc — the arc in front, by the pen's own record. */
  overAt: number
  /** The junction point, stroke coordinates. The under arc's own sample. */
  x: number
  y: number
  /** Closest centreline approach, stroke coordinates. */
  gap: number
}

/** Distance from a point to a polyline over the index window `[lo, hi]`. */
function windowDist(
  pts: FlatPoint[],
  qx: number,
  qy: number,
  lo: number,
  hi: number,
): number {
  let best = Infinity
  for (let i = lo; i + 1 <= hi; i++) {
    const d = segDist(qx, qy, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
    if (d < best) best = d
  }
  return best
}

/**
 * Does the arc behind leave the paper band around the arc in front, with a
 * stroke's worth of itself still to run? The self-crossing twin of
 * `findHeroJunctions`'s `comesOut`, and the same two failures it separates.
 *
 * ⚠ IT WALKS THE WHOLE STROKE, and that is the correction the census asked for.
 * `_probe-crossing-census.mjs` could only model a self-crossing by SPLITTING
 * the stroke in two, which gives each half a terminal AT the crossing that the
 * mark does not have — the walk then runs off a boundary that is a device of
 * the law rather than a feature of the drawing, and only 2 of 6 crossings
 * survived. The mark is never split here; only the polyline the DISTANCE is
 * measured against is windowed.
 */
function comesOutOfArc(
  pts: FlatPoint[],
  from: number,
  overLo: number,
  overHi: number,
  outer: number,
  need: number,
  sign: 1 | -1,
): boolean {
  let left: number | null = null
  let acc = 0
  let k = from
  for (;;) {
    const n = k + sign
    if (n < 0 || n >= pts.length) return false
    const seg = Math.hypot(pts[n].x - pts[k].x, pts[n].y - pts[k].y)
    const steps = Math.max(1, Math.ceil(seg / 0.5))
    for (let s = 1; s <= steps && left === null; s++) {
      const f = s / steps
      if (
        windowDist(
          pts,
          pts[k].x + (pts[n].x - pts[k].x) * f,
          pts[k].y + (pts[n].y - pts[k].y) * f,
          overLo,
          overHi,
        ) > outer
      )
        left = acc + seg * f
    }
    acc += seg
    k = n
    if (left !== null && acc - left >= need) return true
  }
}

/**
 * WHERE THE PEN LAID A STROKE ACROSS ITSELF — the news the junction set was
 * throwing away (2026-08-02).
 *
 * `findHeroJunctions` excluded same-stroke contacts, and its stated reason was
 * that *"a stroke passing near itself has no 'later' stroke to be in front, so
 * there is no pen order to show."* THAT REASON IS FALSE, and it was the
 * expensive half of that sentence. Within one stroke the pen order is the ARC:
 * the later arc was drawn later and is in front, by exactly the record — the
 * trace's own point order — that the entire mechanism rests on. Cursive is made
 * of loops, and every loop closes on itself.
 *
 * `scripts/verify/_probe-crossing-census.mjs` priced it. On this word at carve
 * 1.00 SEVEN places are a stroke crossing itself — the cursive loops of
 * `D s D o o d e` — and at 54° to 88° they are the only steep crossings on the
 * word besides 7→8, the single true crossing the distinct-pair census found.
 * Six survive `buildJointBreaks` and carry 85.5 units of centreline against
 * 7→8's 16.1.
 *
 * ── WHAT COUNTS AS ONE CROSSING ────────────────────────────────────────────
 * The contact test is the union-of-stamps the mark is actually made of
 * (`buildPenField`: `|p_i − p_k| ≤ w_i + w_k`) and not the tube's diameter,
 * because this is a question about the silhouette the return SHOWS. Two further
 * conditions make a crossing countable:
 *
 *   • `arc[k] − arc[i] > 2 · inkDiameter`, or the "crossing" is two neighbouring
 *     samples of one straight run seeing each other. A loop that closes in less
 *     than two ink diameters of travel is a blot, not a loop.
 *   • contacts within one ink diameter of an already-kept one ON BOTH ARCS are
 *     the same event seen twice and are folded into it — the same
 *     one-junction-per-event rule the distinct-pair pass states, applied along
 *     the arc instead of across the pair.
 *
 * ── AND THEY GET THE SAME CROSSING TEST, BECAUSE THEY ARE NOT A FREE WIN ───
 * Applied raw the six take the mark from 6 connected components to 8, which is
 * the same failure the distinct pairs had. Both clauses are the distinct-pair
 * law's own, and BOTH are measured against the WHOLE stroke:
 *
 *   • THE ARC IN FRONT MUST BE A STROKE WHERE IT PASSES — the contact is at
 *     least its own carved half-width from either end of the stroke, or the
 *     thing the mark passes behind is a terminal cap.
 *   • AND THE ARC BEHIND MUST BE A STROKE ON BOTH SIDES OF THE CROSSING, each
 *     side measured the way that side is actually drawn:
 *
 *       – the CUT side — the one running on toward the arc in front, and the
 *         only one `buildJointBreaks` opens (see its `uLo = ai`) — must COME OUT
 *         past the band with its own carved DIAMETER of centreline left. The
 *         existing far-side clause, verbatim.
 *       – the UNCUT side — the lead-in, which stays fused to the arc in front —
 *         must CARRY that same diameter of centreline. Not a new constant and
 *         not a new idea: it is `need` again, and the sentence behind it is the
 *         far-side clause's own — *"a piece of stroke shorter than the stroke is
 *         wide is a blob, not a stroke."*
 *
 *     ⚠ THE SECOND HALF WAS FOUND BY LOOKING AND BY NOTHING ELSE. All five
 *     one-sided breaks leave the mark at 6 connected components with zero
 *     crumbs — the gate is green on all of them — and at 5x two are not
 *     over/unders (`docs/verification/hero-k7/self-cross/self-*.png`):
 *
 *       0→0   a white RECTANGLE punched through the `D`'s top cluster, ink on
 *             every side of it. Its lead-in is 16.0 units against a 19-unit
 *             diameter, so the blob that stays fused sits right over the gap and
 *             there is no stroke to read as passing behind anything.
 *       12→12 the first `o` of *Doodles* opened at the top right, reading as a
 *             broken ring rather than as a crossing. Lead-in 12.0 units.
 *
 *     against the three that ARE over/unders — 10→10 (lead 31.9), 16→16 (87.9)
 *     and 3→3 (119.5). The clause separates them exactly, and it separates them
 *     on the quantity the pictures differ in.
 *
 * `farSide: false` drops the CUT side's clause and nothing else, which is what
 * `"nofarside"` needs to stay the one-clause relaxation of the shipped law
 * everywhere rather than only on the distinct pairs.
 *
 * `carve` is required rather than defaulted: every width here is the NIB's, and
 * a self-crossing is only expressible on a carved mark. The caller gates the
 * whole pass on `carve > 0` for the §0.7 reason `buildJointBreaks` states.
 */
export function findSelfCrossings(
  points: FlatPoint[],
  inkDiameter: number,
  carve: number,
  breakK: number,
  /**
   * `farSide: false` is the `"nofarside"` arm. `capTest: false` is for a PROBE
   * only — it reports the whole contact population so the admitted set can be
   * shown against what it rejected; no shipped law ever sets it.
   */
  opts: { farSide?: boolean; capTest?: boolean } = {},
  nib: PenNib = PEN_NIB_DEFAULT,
): SelfCrossing[] {
  if (points.length < 3) return []
  const c = Math.max(0, Math.min(1, carve))
  const R = inkDiameter / 2
  const keep = (JOINT_BREAK_KEEP_K * inkDiameter) / 2
  const band = Math.max(0, breakK) * inkDiameter
  const arc = [0]
  for (let i = 1; i < points.length; i++)
    arc.push(arc[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y))
  const total = arc[arc.length - 1]
  const w = points.map((_, i) => keep + (carvedHalfWidth(points, i, R, nib) - keep) * c)

  const hits: { i: number; k: number; sep: number; d: number }[] = []
  for (let i = 0; i < points.length; i++) {
    for (let k = i + 1; k < points.length; k++) {
      if (arc[k] - arc[i] <= 2 * inkDiameter) continue
      const d = Math.hypot(points[i].x - points[k].x, points[i].y - points[k].y)
      const sep = d - w[i] - w[k]
      if (sep <= 0) hits.push({ i, k, sep, d })
    }
  }
  hits.sort((p, q) => p.sep - q.sep)

  const out: SelfCrossing[] = []
  /**
   * ⚠ THE DEDUP RUNS BEFORE THE TESTS AND CLAIMS THE EVENT EITHER WAY.
   *
   * Deduping against the ADMITTED list alone made the guard porous, and it was
   * caught by reading the probe's own two columns against each other: the `D`'s
   * crossing was rejected at index 5 (lead 16.0 units, under the 19-unit bar)
   * and then re-admitted one sample later at index 6 (lead 20.0), which is the
   * same crossing wearing a different representative. One crossing is one
   * event, and its closest approach — `hits` is sorted by separation — is the
   * sample that decides it.
   */
  const claimed: { i: number; k: number }[] = []
  for (const h of hits) {
    if (
      claimed.some(
        (o) =>
          Math.abs(arc[o.i] - arc[h.i]) <= inkDiameter &&
          Math.abs(arc[o.k] - arc[h.k]) <= inkDiameter,
      )
    )
      continue
    claimed.push({ i: h.i, k: h.k })
    const keepOver = w[h.k]
    const keepUnder = w[h.i]
    const outer = keepOver + band
    const need = 2 * keepUnder
    // The whole stroke's arc, never the half's — see the header.
    if (opts.capTest !== false && !(Math.min(arc[h.k], total - arc[h.k]) > keepOver)) continue
    // The UNCUT side has to be a stroke and not a blob. Kept outside the
    // `farSide` switch on purpose: `"nofarside"` drops ONE clause, and this is
    // not that clause.
    if (opts.capTest !== false && !(arc[h.i] >= need)) continue
    if (opts.farSide !== false) {
      const mid = (h.i + h.k) >> 1
      if (!comesOutOfArc(points, h.i, mid, points.length - 1, outer, need, 1)) continue
    }
    out.push({ underAt: h.i, overAt: h.k, x: points[h.i].x, y: points[h.i].y, gap: h.d })
  }
  return out
}

/* -------------------------------------------------------------------------- */
/*  THE PEN CARVE — the field a fragment shader samples                        */
/* -------------------------------------------------------------------------- */

/**
 * HOW MUCH WIDER THAN THE TUBE THE "SOLID" FIELD SITS.
 *
 * The carve lerps between two signed-distance fields, and at `penCarve = 0` it
 * must remove NOTHING — the settled solid is a shipped, gated picture and this
 * channel may not move it by a pixel. The mesh's real silhouette is not exactly
 * `d - R`: the implicit field uses `radiusXY x bulgeScale x ink[i]` with
 * `bulgeScale = 1.07`, plus the fusion fillets at twenty-two boundaries, so a
 * field baked at exactly R would bite into the form the moment it was switched
 * on at zero strength.
 *
 * 1.35 clears the measured worst case with room: the rendered mark's medial
 * half-width runs to p99 13.0 px against a 7.21 px median
 * (`scripts/verify/_probe-terminal-census.mjs`), i.e. 1.80x at the fattest
 * fusion bulge — but those bulges are at junctions, where the nearest-centreline
 * distance is shared between two strokes and the field is correspondingly
 * generous already. Asserted rather than argued: the carve at strength 0 must
 * measure ZERO pixels removed, and that is a row in
 * `scripts/verify/assert-pen-field.mjs`.
 *
 * ⚠ THE SENTENCE AFTER THE DASH IS WRONG, AND IT COST DAYS. At a junction bulge
 * the surface is FURTHER from every centreline, not nearer, so `bestD` is
 * LARGER there — the field is less generous at a bulge, not more. The
 * conclusion it was used to defend (1.35 below its own stated 1.80 worst case)
 * happens to be nearly right anyway, but for none of the reasons given: measured
 * on a field that registers, 1.35 R removes 0.9-1.9 % of the ink at carve 0.001
 * and 1.90 R removes exactly zero across three page states
 * (`scripts/verify/_probe-carve-envelope-recal.mjs`).
 *
 * ⚠ AND THIS CONSTANT IS NOT THE ENVELOPE THE SHADER TESTS. The bake writes
 * `bestD - 1.35 R` into the tube channel; `PEN_CARVE_ENVELOPE_R` in
 * `components/viewport-3d.tsx` (1.90) is subtracted from it as a uniform, so
 * the number here is only the bake's OFFSET and the search cell it sizes. The
 * two were confused once already — a carve envelope was "fixed" by moving this
 * constant's justification rather than the shader's. Change the shader's, not
 * this one: rebaking grows `CELL` and the search is quadratic in it.
 */
export const PEN_FIELD_TUBE_SLACK = 1.35

/**
 * STROKE-SPACE UNITS PER TEXEL — 1, and the number was measured rather than
 * picked.
 *
 * The field is a MINIMUM over stamps, so its zero-crossing sits in a valley
 * floor, and bilinear interpolation across a valley reads systematically HIGH —
 * i.e. the sampled outline is a shade tighter than the true one. Measured
 * against an independent rasterisation of the same law (`assert-pen-field.mjs`
 * row 3) the bias is one-sided and resolution-bound:
 *
 *   units/texel   texels     bake     median |err|   IoU vs the raster
 *        4        23 976     19 ms      1.82 u
 *        2        95 904     57 ms      1.10 u       94.6 %
 *        1       382 432    209 ms      0.56 u
 *      0.5     1 527 360    819 ms      0.28 u
 *
 * 1 unit is ~0.53 screen px at the shipped stage — under half a pixel of
 * outline error — for 209 ms of one-time bake and a 1184x324 two-channel
 * texture. The page already pays 1.1 s for the implicit surface's first build
 * (explainer 14 §7), so this is not the cost that matters on this page.
 */
export const PEN_FIELD_UNITS_PER_TEXEL = 1

export interface PenField {
  /**
   * Two signed distances per texel, row-major, in STROKE UNITS:
   *   [0] the PEN outline   — negative inside the nib-drawn mark
   *   [1] the TUBE outline  — negative inside a generous envelope of the form
   * Both negative-inside so a shader can `mix()` them and test one sign.
   */
  data: Float32Array
  width: number
  height: number
  /** The field's box in stroke coordinates. */
  minX: number
  minY: number
  maxX: number
  maxY: number
  unitsPerTexel: number
  /** The nominal half-width the field was baked at, stroke units. */
  radius: number
}

/**
 * BAKE THE PEN'S OUTLINE AS A FIELD.
 *
 * ── WHY A FIELD AND NOT A LOOP ──────────────────────────────────────────────
 * `applyJointBreak` (components/viewport-3d.tsx) does its work by looping over
 * twenty-four junctions per fragment, which is affordable because twenty-four is
 * small. The pen's outline is a property of EVERY point of EVERY stroke — 22
 * polylines, 1078 points after the 4-unit resample — and a per-fragment loop
 * over those is not affordable, nor can GLSL ES 1.00 index a uniform array that
 * large. So the law is evaluated once on the CPU into a texture and the shader
 * does one fetch.
 *
 * It is also the only construction that keeps the two halves honest. The nib's
 * half-width depends on the local stroke DIRECTION (`nibHalfWidth`), and a
 * fragment does not know which stroke it belongs to or which way that stroke was
 * travelling. Baking resolves that question where the answer is actually known.
 *
 * ── WHY TWO CHANNELS ────────────────────────────────────────────────────────
 * So the animation is a `mix` of two shapes rather than a ramp on one threshold.
 * `mix(tube, pen, carve)` interpolates between two signed distance fields, which
 * gives a shape that morphs monotonically — and because the pen outline is a
 * strict SUBSET of the tube (the semi-major axis is pinned to R and the weight
 * is deliberately not restored, see `penHalfWidth`), the outline can only ever
 * shrink as the carve rises. Subtractive at every intermediate value, not just
 * at the ends, which is what keeps gate 1 safe throughout the beat rather than
 * only at its two poles.
 *
 * ── THE ACCELERATION IS A UNIFORM GRID, AND IT IS EXACT ────────────────────
 * Not an approximation: the search radius is bounded by the largest distance the
 * field needs to be correct at, so a texel further than that from every sample
 * is clamped rather than mis-measured. Clamped values are far outside both
 * outlines and can never flip a sign.
 */
export function buildPenField(
  strokes: { points: FlatPoint[] }[],
  inkDiameter: number,
  nib: PenNib = PEN_NIB_DEFAULT,
  unitsPerTexel: number = PEN_FIELD_UNITS_PER_TEXEL,
): PenField {
  const R = inkDiameter / 2
  const pad = R * (PEN_FIELD_TUBE_SLACK + 1)

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const s of strokes)
    for (const p of s.points) {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    }
  minX -= pad
  minY -= pad
  maxX += pad
  maxY += pad

  /* Every centreline sample, carrying what the law needs at it: the travel
   * direction (for the nib) and the arc distance to its own stroke's nearer end
   * (for the taper). Both are properties of the STROKE, so they are computed
   * once here and never re-derived per texel. */
  type Sample = { x: number; y: number; theta: number; endArc: number }
  const samples: Sample[] = []
  for (const s of strokes) {
    const pts = s.points
    if (pts.length < 2) {
      if (pts.length === 1) samples.push({ x: pts[0].x, y: pts[0].y, theta: 0, endArc: 0 })
      continue
    }
    const cum = [0]
    let L = 0
    for (let i = 1; i < pts.length; i++) {
      L += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      cum.push(L)
    }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)]
      const b = pts[Math.min(pts.length - 1, i + 1)]
      samples.push({
        x: pts[i].x,
        y: pts[i].y,
        theta: Math.atan2(b.y - a.y, b.x - a.x),
        endArc: Math.min(cum[i], L - cum[i]),
      })
    }
  }

  const W = Math.max(2, Math.ceil((maxX - minX) / unitsPerTexel))
  const H = Math.max(2, Math.ceil((maxY - minY) / unitsPerTexel))
  const data = new Float32Array(W * H * 2)

  /* The uniform grid. Cell size is the search radius, so a texel only ever
   * consults the 3x3 block around it. */
  const CELL = Math.max(unitsPerTexel * 2, R * PEN_FIELD_TUBE_SLACK * 2)
  const GW = Math.max(1, Math.ceil((maxX - minX) / CELL))
  const GH = Math.max(1, Math.ceil((maxY - minY) / CELL))
  const grid: number[][] = new Array(GW * GH)
  for (let i = 0; i < samples.length; i++) {
    const gx = Math.min(GW - 1, Math.max(0, Math.floor((samples[i].x - minX) / CELL)))
    const gy = Math.min(GH - 1, Math.max(0, Math.floor((samples[i].y - minY) / CELL)))
    const g = gy * GW + gx
    ;(grid[g] ||= []).push(i)
  }

  /* Anything beyond this is outside both outlines by a margin no lerp can
   * recover, so it is clamped rather than searched. Clamping cannot flip a sign;
   * a truncated search could. */
  const FAR = R * (PEN_FIELD_TUBE_SLACK + 1.5)

  for (let ty = 0; ty < H; ty++) {
    const qy = minY + (ty + 0.5) * unitsPerTexel
    const gy = Math.min(GH - 1, Math.max(0, Math.floor((qy - minY) / CELL)))
    for (let tx = 0; tx < W; tx++) {
      const qx = minX + (tx + 0.5) * unitsPerTexel
      const gx = Math.min(GW - 1, Math.max(0, Math.floor((qx - minX) / CELL)))

      let bestD = Infinity
      let bestPen = Infinity
      for (let cy = Math.max(0, gy - 1); cy <= Math.min(GH - 1, gy + 1); cy++) {
        for (let cx = Math.max(0, gx - 1); cx <= Math.min(GW - 1, gx + 1); cx++) {
          const bucket = grid[cy * GW + cx]
          if (!bucket) continue
          for (const si of bucket) {
            const s = samples[si]
            const d = Math.hypot(qx - s.x, qy - s.y)
            if (d < bestD) bestD = d
            /* THE PEN FIELD IS A MINIMUM OVER SAMPLES, NOT A LOOKUP AT THE
             * NEAREST ONE. The mark is a UNION of nib stamps
             * (stroke-width-models.md §4.5, `C (+) K`), so a texel is inside the
             * pen if it is inside ANY stamp — and the stamp that contains it is
             * not necessarily the one whose centre is closest, because the
             * stamps are not round. Taking the nearest sample's width would be
             * the offset-curve mistake §1.2 warns about, one level down. */
            const w = penHalfWidth(s.theta, s.endArc, R, nib)
            const e = d - w
            if (e < bestPen) bestPen = e
          }
        }
      }
      const i = (ty * W + tx) * 2
      data[i] = Math.min(bestPen, FAR)
      data[i + 1] = Math.min(bestD - R * PEN_FIELD_TUBE_SLACK, FAR)
    }
  }

  return { data, width: W, height: H, minX, minY, maxX, maxY, unitsPerTexel, radius: R }
}

/* ------------------------------------------------------------------ */
/*  §PF-W · THE PEN FIELD, OFF THE MAIN THREAD                        */
/* ------------------------------------------------------------------ */
/**
 * THE SEAM, AND WHY IT IS HERE RATHER THAN IN THE WORKER.
 *
 * `buildPenField` is a rasterisation: pure arithmetic in, one `Float32Array`
 * out. Nothing in it touches three, React or the DOM — which is the whole
 * precondition for moving it — and its output goes to the GPU through a
 * `DataTexture` whose image can be swapped between frames. So the split is the
 * same one `lib/implicit-surface.ts` §7 makes for the polygoniser, and for the
 * same stated reason: **the worker must not be a second implementation.**
 * `runPenFieldWorkerRequest` unpacks, calls `buildPenField` — the exact
 * function the main thread calls — and packs. One implementation, two threads.
 * Two implementations of one bake is how "faster" quietly becomes "different".
 *
 * ⚠ `lib/flat-ink.ts` MUST NEVER IMPORT `lib/pen-field-defer.ts`, and must
 * never name the worker URL. The worker imports THIS file; putting
 * `new Worker(new URL("./pen-field.worker.ts", import.meta.url))` here would
 * close a module cycle through a worker entry, and Turbopack DEADLOCKS on that
 * — `Ready in 186ms`, then `Compiling / ...` forever, every tokio worker parked
 * in `_pthread_cond_wait` at 0 % CPU, no error printed anywhere, and
 * `tsc --noEmit` green throughout. Bisected in both directions on the geometry
 * lane, 2026-08-01 (`docs/explainers/20-the-build-left-the-main-thread.md` §8).
 * The scheduler lives in its own module precisely so nothing points back.
 */
export interface PenFieldWorkerRequest {
  id: number
  /**
   * Every point of every stroke as x,y pairs, in order.
   *
   * `Float64Array` and NOT `Float32Array`. The field is baked in STROKE units
   * and the texel loop reads `s.x` as a double: rounding a coordinate to f32 in
   * transit moves `Math.hypot(qx − s.x, …)` by up to ~1e-7 units, which is
   * enough to flip `e < bestPen` at a texel sitting exactly on the outline and
   * therefore to change a byte of the "byte-identical" output. The geometry
   * lane hit the same trap and named it (`off-thread-geometry.md` §4.1).
   */
  pts: Float64Array
  /** How many points belong to each stroke, in order. Sums to `pts.length / 2`. */
  counts: Int32Array
  inkDiameter: number
  /** Passed EXPLICITLY, never defaulted here — see `runPenFieldWorkerRequest`. */
  nib: PenNib
  unitsPerTexel: number
}

export interface PenFieldWorkerReply {
  id: number
  data: Float32Array | null
  width: number
  height: number
  minX: number
  minY: number
  maxX: number
  maxY: number
  unitsPerTexel: number
  radius: number
  /** The worker's own stopwatch around the bake, same clock as the main thread. */
  msTotal: number
  error?: string
}

/** Strokes → two transferable typed arrays. Lossless: see `pts` above. */
export function packPenStrokes(strokes: { points: FlatPoint[] }[]): {
  pts: Float64Array
  counts: Int32Array
} {
  let n = 0
  for (const s of strokes) n += s.points.length
  const pts = new Float64Array(n * 2)
  const counts = new Int32Array(strokes.length)
  let k = 0
  for (let si = 0; si < strokes.length; si++) {
    const p = strokes[si].points
    counts[si] = p.length
    for (let i = 0; i < p.length; i++) {
      pts[k++] = p[i].x
      pts[k++] = p[i].y
    }
  }
  return { pts, counts }
}

/** The exact inverse. `buildPenField` reads only `x` and `y`, so this is total. */
export function unpackPenStrokes(pts: Float64Array, counts: Int32Array): { points: FlatPoint[] }[] {
  const out: { points: FlatPoint[] }[] = []
  let k = 0
  for (let si = 0; si < counts.length; si++) {
    const points: FlatPoint[] = new Array(counts[si])
    for (let i = 0; i < counts[si]; i++) {
      points[i] = { x: pts[k++], y: pts[k++] }
    }
    out.push({ points })
  }
  return out
}

/**
 * Run one request. The worker is a message pump around this and nothing else.
 *
 * `nib` is a required field of the request rather than a default here: a bake
 * that silently used `PEN_NIB_DEFAULT` while the caller had passed a custom nib
 * would produce a DIFFERENT field down the two paths and every byte-identity
 * assertion would be comparing two different questions. The scheduler always
 * sends the nib it was given.
 */
export function runPenFieldWorkerRequest(req: PenFieldWorkerRequest): {
  reply: PenFieldWorkerReply
  transfer: Transferable[]
} {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now()
  const f = buildPenField(
    unpackPenStrokes(req.pts, req.counts),
    req.inkDiameter,
    req.nib,
    req.unitsPerTexel,
  )
  const msTotal = (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0
  const reply: PenFieldWorkerReply = {
    id: req.id,
    data: f.data,
    width: f.width,
    height: f.height,
    minX: f.minX,
    minY: f.minY,
    maxX: f.maxX,
    maxY: f.maxY,
    unitsPerTexel: f.unitsPerTexel,
    radius: f.radius,
    msTotal,
  }
  return { reply, transfer: [f.data.buffer as ArrayBuffer] }
}

/**
 * ── WHAT `components/viewport-3d.tsx` HAS TO DO WITH THIS ────────────────────
 *
 * This file owns the LAW and the DATA; the renderer owns the uniforms and the
 * discard. That split is not new — it is exactly how `buildJointBreaks` and
 * `applyJointBreak` already divide K7's paper break — and it is why the change
 * on the renderer's side is small.
 *
 * 1 · A CHANNEL ON `FlatState`, beside `jointBreak`:
 *
 *       penCarve?: number
 *
 *     0 = the tube, i.e. today's picture, unchanged to the pixel.
 *     1 = the pen's outline.
 *     Omitted -> 0, so every existing call site renders exactly as before.
 *
 * 2 · A SECOND MATERIAL INJECTION, `applyPenCarve`, chained the same way
 *     `applyJointBreak` is. It needs FOUR uniforms and ONE texture fetch — no
 *     loop, so none of the `discard`-inside-a-dynamic-loop hazard that hangs
 *     Chrome's Metal backend and is documented at `applyJointBreak`'s own
 *     `⚠ THE discard IS OUTSIDE THE LOOP` note:
 *
 *       uniform float uFsPenCarve;   // the channel
 *       uniform sampler2D uFsPenField;
 *       uniform vec4  uFsPenBox;     // (minX, minY, 1/(maxX-minX), 1/(maxY-minY))
 *       uniform mat4  uFsPenInv;     // world -> stroke space
 *
 *     `uFsPenInv` is the SAME matrix `uFsBreakInv` already carries — the flatten
 *     group's inverse — so the carve turns WITH the mark exactly as the breaks
 *     do, and for the same reason: it is a property of the drawing, not of the
 *     screen.
 *
 * 3 · THE FRAGMENT TEST, immediately after `#include <clipping_planes_fragment>`
 *     and before any lighting work, reusing the `vFsBreakWorld` varying that is
 *     already there:
 *
 *       float fsPenCov = 1.0;
 *       if (uFsPenCarve > 0.0) {
 *         vec2 fsPq = (uFsPenInv * vec4(vFsBreakWorld, 1.0)).xy;
 *         vec2 fsPuv = (fsPq - uFsPenBox.xy) * uFsPenBox.zw;
 *         vec2 fsPf  = texture2D(uFsPenField, fsPuv).rg;   // r = pen, g = tube
 *         float fsSd = mix(fsPf.g, fsPf.r, uFsPenCarve);   // negative = keep
 *         float fsPx = max(length(dFdx(fsPq)), length(dFdy(fsPq)));
 *         fsPenCov = clamp(0.5 - fsSd / max(fsPx, 1e-9), 0.0, 1.0);
 *       }
 *       if (fsPenCov <= 0.0) discard;
 *
 *     and then `diffuseColor.a *= fsPenCov;` folded into the same
 *     `<alphatest_fragment>` replacement the break already uses.
 *
 *     COVERAGE AND NOT A BOOLEAN, for the identical reason `applyJointBreak`
 *     gives: a plain discard makes the carve's edges BINARY beside a silhouette
 *     that is multisampled, and an edge harder than the drawing's own edge reads
 *     as a cut. The material already runs `alphaToCoverage`, and coverage is a
 *     sample MASK rather than a blend — so an interior ink pixel is still
 *     exactly one value and GATE 1 IS UNTOUCHED. That is the whole reason this
 *     is expressible as an occlusion at all.
 *
 * 4 · THE TEXTURE. `buildPenField` returns RG floats in stroke units. Upload as
 *     `THREE.DataTexture(f.data, f.width, f.height, THREE.RGFormat, THREE.FloatType)`
 *     with `minFilter = magFilter = THREE.LinearFilter` — the linear filter is
 *     load-bearing, because the shader is interpolating a signed distance and a
 *     nearest fetch would quantise the outline to a texel. Build it once, in the
 *     same memo that already builds the break table from `window.__heroJunctions`,
 *     from the SAME processed strokes.
 *
 * 5 · WHAT DRIVES IT. `lib/hero-motion.ts` (NOT this lane's file) samples
 *     `penCarve` 1 -> 0 across the emerge.
 *
 *     ⚠ CORRECTED 2026-08-01. THIS LINE USED TO READ: *"samples `penCarve` 1 ->
 *     0 across the emerge, on `easeOutBack` — the same curve the depth swells
 *     on, so the outline's overshoot and the depth's are one event."* That was
 *     the sketch, and the landed law is not it. `hero-motion.ts` ships
 *     **`penCarve = carveAmount × flat`** — the carve rides `flat`, the beat's
 *     own flatness channel, not a curve of its own. It is one law and it is
 *     correct on BOTH `emerge.mode` arms, which is why it beat the sketch:
 *     riding `flat` REDUCES to the eased ramp on the parked arm, because there
 *     `flat` is that ramp — so nothing was lost and the second arm stopped
 *     needing a second rule. The consequence worth knowing here is that the
 *     carve is 1 wherever the mark is flat, which includes K7, which is why the
 *     joint break and the carve are open at the same instant and why
 *     `buildJointBreaks` had to be told the carve at all.
 *
 *     The light still lags the carve by the 80 ms explainer 14 §5 specifies,
 *     which is what makes it read as CAUSED BY the volume. Filmed at
 *     `docs/verification/flat-silhouette/carve-film/emerge-carve.mp4`.
 *
 * 6 · WHAT THE BREAK NEEDED FROM THE RENDERER — ⚠ CORRECTED 2026-08-07, IT IS
 *     WIRED. This item used to read: *"AND IT IS NOT YET WIRED …
 *     `components/viewport-3d.tsx` still uploads one scalar `uFsBreakKeep` and
 *     one `uFsBreakOuter` for every junction and calls the builder with four
 *     arguments, so at `carve > 0` the shipped shader is still running the
 *     tube's radii. The diff is three lines in `syncBreakTable` plus a fourth
 *     `vec4` of per-junction radii in `uFsBreakData`, and it belongs to that
 *     file's lane."* That lane landed it. `syncBreakTable` calls
 *     `buildJointBreaks(strokes, list, inkWidth, breakK, carve)` and writes
 *     `b.keepUnder` and `b.keepOver` into the fourth `vec4`
 *     (`components/viewport-3d.tsx:4886-4887`); the fragment shader reads them
 *     as `fsK.x` / `fsK.y` (:1878, :1887-1888). At `carve > 0` the shipped
 *     shader runs the CARVED radii, per junction.
 *
 *     ⚠ AND THE STALE SENTENCE COST A MISATTRIBUTION, WHICH IS WHY IT IS QUOTED
 *     RATHER THAN DELETED. `assert-hero-k7-intact`'s header carried the matching
 *     claim, and when the parked `terminals` arm was first run bare on
 *     2026-08-07 and came back red, the "ink collar" was read off that header
 *     and reported as the mechanism — in the gate's failure detail, in the lane
 *     state and in explainer 36 §5. It is not the mechanism. `crossings` and
 *     `terminals` run the same radii, the same carve and the same shader on the
 *     same frame, and differ only in which junctions are in the SET: `crossings`
 *     holds the mark at K1 5 -> K7 5 and `terminals` splits a 3232 px part into
 *     2330 + 777. A quantity identical across two arms cannot be what separates
 *     them.
 *
 *     THE CHAIN, because the chain is the finding: this sentence -> the gate's
 *     header -> the gate's failure detail -> that lane's LANE-STATE ->
 *     explainer 36 §5. FOUR documents downstream of one stale to-do, and every
 *     one of them cited the one above it. A to-do that outlives its fix is not
 *     clutter; it is a wrong answer with a citation attached, and citations are
 *     how this repo decides where to look.
 *
 * ── WHAT IT IS WORTH, MEASURED ─────────────────────────────────────────────
 * Applied offline to the real rendered frame — a discard intersects a mark with
 * a mask and does nothing else, so the offline result IS the shader's
 * (`scripts/verify/_probe-carve-preview.mjs`):
 *
 *   flat vs solid, on the silhouette      4.09 %  ->  23.10 %  of a stroke radius
 *   median half-width                     7.211   ->  6.000 px flat, +20.2 % at the emerge
 *   ink                                   24 424  ->  19 876 px, +22.9 % at the emerge
 *   ink the carve would have to ADD       357 px  (1.46 %, and 0 through the field)
 *
 * against a value-only control that measures the whole of today's 4.09 %, i.e.
 * the shipped beat's silhouette change is ZERO and the number is the luminance
 * threshold moving under the lighting.
 */
/**
 * Sample the baked field at a stroke-space point, bilinearly — the CPU twin of
 * the shader's `texture2D`, so an assertion can compare the two without a
 * browser and a probe can check the bake against the analytic law.
 */
export function samplePenField(f: PenField, x: number, y: number): { pen: number; tube: number } {
  const u = (x - f.minX) / f.unitsPerTexel - 0.5
  const v = (y - f.minY) / f.unitsPerTexel - 0.5
  const x0 = Math.max(0, Math.min(f.width - 1, Math.floor(u)))
  const y0 = Math.max(0, Math.min(f.height - 1, Math.floor(v)))
  const x1 = Math.min(f.width - 1, x0 + 1)
  const y1 = Math.min(f.height - 1, y0 + 1)
  const fx = Math.max(0, Math.min(1, u - x0))
  const fy = Math.max(0, Math.min(1, v - y0))
  const at = (px: number, py: number, c: number) => f.data[(py * f.width + px) * 2 + c]
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  return {
    pen: lerp(
      lerp(at(x0, y0, 0), at(x1, y0, 0), fx),
      lerp(at(x0, y1, 0), at(x1, y1, 0), fx),
      fy,
    ),
    tube: lerp(
      lerp(at(x0, y0, 1), at(x1, y0, 1), fx),
      lerp(at(x0, y1, 1), at(x1, y1, 1), fx),
      fy,
    ),
  }
}

/* ═══ HOW THE MARK PRESENTS: FLAT INK OR A LIT OBJECT ══════════════════════
 *
 * ⚠ THIS LIVED IN `components/viewport-3d.tsx` UNTIL 2026-09-04, and moving it
 * was not tidying. `lib/doc-store.ts` has to name the type to persist it, and a
 * lib file importing a .tsx drags JSX into every node-side TS load: the moment
 * doc-store imported the component, `assert-take-persists` died on
 * `SyntaxError: Unexpected token '<'` before its first row. The rule this file
 * already states for `EASE_VALUES` applies here too, and I broke it: lib must
 * not import a component. The component re-exports both names, so nothing that
 * referred to them had to change.
 */
export interface FlatState {
  /** 1 = a drawing (constant value, no shading). 0 = the lit form. */
  ink: number
  /** Multiplier on the form's depth along the view axis. */
  depth: number
  /** The flat ink colour, from the active register's own palette. */
  color: string
  /**
   * THE TURN. The mark's yaw about its own vertical axis, in radians.
   *
   * This is what answers the KNOWN LIMIT above. Collapsing shading flattens a
   * surface but not a SHAPE, so head-on the flat state still carries a tube's
   * silhouette and the depth arrives at the one angle where depth cannot be
   * seen. Turning the mark to edge-on puts its thickness at ninety degrees to
   * the viewer, where it is the entire image — the same physical event, staged
   * so it reads.
   *
   * The CAMERA does not participate. If it moved, the change would belong to
   * the viewpoint rather than to the object, and the beat is asserting that the
   * object changed.
   *
   * Optional: every call site that omits it renders face-on exactly as before.
   */
  yaw?: number
  /**
   * THE HINGE — the mark's pitch about its own BASELINE, in radians. O2's
   * mechanism, and the one that performs the product's actual sentence: *"the
   * drawing stands up off the page."*
   *
   * WHY IT IS A SIBLING OF `yaw` AND NOT A CAMERA MOVE. Same argument the yaw
   * doc makes, and it is the whole reason O2 is on the board: a camera that
   * tilts down to look at a page makes the VIEWPOINT the thing that changed. A
   * mark that hinges up off the page makes the MARK the thing that changed.
   * Only the second one is the pitch.
   *
   * THE AXIS IS THE PAGE'S, NOT THE MARK'S. The rotation composes OUTSIDE the
   * yaw (see the matrix chain in `AnimatedStrokes`), about a line running along
   * X through the contact — which is a pop-up book's hinge: glued to the page,
   * not to the thing standing up. Hinging about the mark's own axis after it had
   * yawed would swing the word out of the page plane sideways, which is a
   * different and much worse move.
   *
   * IT PIVOTS ON THE CONTACT, `box.min.y`, the same measured pivot K2's squash
   * uses. That is deliberate: the board's O2 note flags the descenders as the
   * option's *"one real geometry question"* — a hinge on the typographic
   * baseline would slice the `k`/`D` descender ink and rotate it underground.
   * `box.min.y` is the ink's true bottom extent, so the lowest ink is the hinge
   * and nothing goes below the page.
   *
   * The carve, joint-break and pen-tip shaders all invert `g.matrixWorld`, so
   * they follow this for free — no shader knows the hinge exists.
   *
   * Optional: every call site that omits it renders flat on the page exactly as
   * before, and `0` is a no-op that costs one matrix multiply.
   */
  pitch?: number
  /**
   * The turning face's darkening, 0..1 — `0.35 * (1 - sx)` ported from
   * `compose.ORIGINAL-FLIP.mjs:200`.
   *
   * APPLIED TO BOTH HALVES OF THE TURN, and it used to be applied to the flat
   * ink only. That reading — *"once the form is lit, real lighting does this
   * itself"* — is falsified by the source it was ported from: the storyboard's
   * §3 K3 table measures the ORIGINAL's own film across the turn and both
   * halves track `base × (1 − 0.35(1−sx))` to about one luma, the `3D face out`
   * rows at t 5.00–5.07 and the `logo face in` rows at t 5.20–5.33 alike.
   *
   * Measured here, on the affine capture, with the falloff on the flat half
   * only: the interior mean runs 3.2 flat → 24.1 at the sliver → **32.3** on
   * the first pose out of the dwell → 23.4 settled. Real lighting does NOT do
   * it itself — near edge-on the rig lights the extruded SIDE WALL, which is
   * brighter than the face is head-on, so the beat's own second half runs
   * lighter than where it lands. That is what `assert-hero-transition`'s
   * `ink never washes past the settled value` had been failing on, and it is a
   * genuine tonal excursion at the midpoint, not the artefact it was assumed
   * to be.
   */
  shade?: number
  /**
   * THE CONTACT SHADOW'S OWN CHANNEL, 0..1 — 0 no pool, 1 the rig's full
   * opacity.
   *
   * It used to be derived as `1 - ink`, which was defensible while `ink` was a
   * 0.54s ramp and is not now: under the turn `ink` HARD-FLIPS at the edge, so
   * a derived shadow pops on in the same frame the face swaps — two arrivals
   * in one frame, where the board's rule is that each shot carries one piece of
   * news. The model gives the shadow its own `easeOutStrong` landing about four
   * frames behind the face, which is the 50–100ms secondary-action offset.
   *
   * Omitted → `1 - ink`, so every existing call site is unchanged and the prior
   * law stays reachable (`shadowLaw: "prior"`).
   */
  shadow?: number
  /**
   * K2's ANTICIPATION, as a scale about the mark's own contact — `scaleX`
   * widening, `scaleY` compressing.
   *
   * These are new because the squash the model has always computed **rendered
   * nowhere**: all four anticipation frames measured identical to the digit
   * with the breath frames (w 648 · h 158 · ink 28371), and the only reference
   * to `squashX` anywhere was a readout printing it as text. Same class as the
   * dead `pushScaleEnd` dial the storyboard flags as C2 — declared, defaulted,
   * documented, and read by nothing that renders.
   *
   * It matters because a 2D squash is the only wind-up available to something
   * with no thickness, and it is the only shot that makes the moment EXPECTED
   * rather than a glitch. Omitted → 1, i.e. no squash.
   */
  squashX?: number
  squashY?: number
  /**
   * K7's NEWS — how far the drawing's stroke junctions are OPEN, 0..1.
   *
   * 0 is K1: one fused mass, in which the word's twenty-two separate acts of
   * the hand are invisible. 1 is K7: at every junction that has an over and an
   * under to show, a hairline of PAPER, with the LATER-drawn stroke passing
   * through unbroken in front — so the drawing comes back carrying its own pen
   * order. `lib/hero-motion.ts`'s `HeroReturn` owns the channel and its timing
   * and says in its own header that *"THE RENDERER MUST DO THE OTHER HALF"*.
   * This is that half.
   *
   * ── IT IS AN OCCLUSION AND IT MAY NEVER BE A SHADING. ────────────────────
   * The beat's first gate is that a flat drawn mark is ONE VALUE inside a hard
   * silhouette (`assert-hero-transition.mjs` gate 1, flat ink SD < 1). A
   * value difference at a junction breaks it; a GAP does not, because every
   * surviving ink pixel is still at exactly the one value. So the break is a
   * `discard` — real paper, whatever the paper happens to be — and never a
   * darkening, a lightening, an alpha fade or a drawn outline. An alpha ramp
   * would be the worst available answer: it puts intermediate values inside
   * the mark, which is a shading wearing an occlusion's name.
   *
   * The eleven online reference clips reach the same mechanism independently
   * (`docs/research/online-reference-mechanics.md` §9.1): the genre's answer to
   * changing a flat state without shading it is to put an occluder over it and
   * take the occluder away — verdict OCCLUSION on 7 of 7 frames of
   * `origami-logo-fold`'s uncover against two controls. What has no precedent
   * there is the specific FORM: *"not one instance anywhere of a mark occluding
   * itself at a crossing."* That is ours, and it is carried as ours.
   *
   * ── WHERE THE JUNCTIONS COME FROM. ───────────────────────────────────────
   * NOT from here. `app/desk-doodles/page.tsx` measures them over the same
   * processed strokes the geometry is built from and publishes them on
   * `window.__heroJunctions`; this file consumes that and turns it into the
   * break table (`buildJointBreaks`, lib/flat-ink.ts). A second measurement of
   * "where does this word touch itself" would be a second source of truth for
   * the one number the shot is about.
   *
   * Omitted → 0, so every existing call site renders exactly as before.
   */
  jointBreak?: number
  /**
   * THE PEN'S OUTLINE, 0..1 — how far the SILHOUETTE is carved back from the
   * tube envelope to the shape the nib actually drew.
   *
   * ── WHY THE BEAT NEEDED THIS. ────────────────────────────────────────────
   * Sebs: *"the 2D and 3D transformation is way too subtle."* Measured, he is
   * exactly right and the number is worse than it sounds: across the whole beat
   * the flat state and the settled solid differ ON THE SILHOUETTE by 4.09 % of
   * a stroke radius, and a value-only control accounts for the whole of that
   * 4.09 % (`scripts/verify/_probe-carve-preview.mjs`). The shipped beat's
   * silhouette change is ZERO — every visible difference is the luminance
   * threshold moving under the lighting. The mark was changing its VALUE and
   * never its SHAPE, which is why a conversion between two states of matter
   * read as a lighting change.
   *
   * With the carve: 23.10 %. Median half-width 7.211 → 6.000 px flat, +20.2 %
   * at the emerge; ink 24 424 → 19 876 px, +22.9 % at the emerge.
   *
   * 0 = the tube, i.e. the settled solid, unchanged to the pixel — asserted,
   * not argued (`assert-pen-field.mjs` row 5, and `assert-pen-carve.mjs`).
   * 1 = the pen's own outline.
   * Omitted → 0, so every existing call site renders exactly as before.
   *
   * ── IT IS AN OCCLUSION FOR THE SAME REASON `jointBreak` IS. ─────────────
   * Gate 1 says a flat drawn mark is one value inside a hard silhouette.
   * Removing coverage keeps every surviving pixel at that one value. The pen
   * outline is a strict SUBSET of the tube envelope by construction, so the
   * silhouette can only shrink — subtractive at every intermediate value, not
   * only at the ends. See `applyPenCarve` and `buildPenField`.
   */
  penCarve?: number
  /**
   * THE ARRIVAL, 0..1 — how far the OBJECT'S OWN LIGHT has arrived.
   *
   * ── WHY THIS EXISTS, MEASURED FIRST. ─────────────────────────────────────
   * Sebs, after the carve landed: *"MAYBE ITS MATERIAL LIGHTING IDK BUT ITS
   * STILL SUPER SUBTLE WHEN IT SWITCHES TO 3D AND I HAVE A HARD TIME NOTICING
   * AT TIMES ITS NOW 3D."*
   *
   * The SILHOUETTE half of that was already closed — flat-vs-solid went 4.09 %
   * → 39.12 % of a stroke radius when `penCarve` landed, so the SHAPE changes.
   * What was left is the TONAL half, and it is not a matter of taste. Measured
   * on the real page through the value-wash gate's own eroded-interior
   * statistic (`scripts/verify/_probe-switch-tone.mjs`, 96 samples across the
   * emerge window, real Chrome on `--use-angle=metal`):
   *
   *     interior       FLAT at rest      SETTLED solid      Δ
   *     median              20.6              23.6        +3.0
   *     mean                20.6              23.5        +2.9
   *     p05 (dark core)     20.6              13.6        -7.0
   *     p95 (lit end)       20.6              34.9       +14.3
   *     sd                   0.28              6.36
   *
   * **The whole tonal event is 3.0 luma of median, on a mark whose ink-to-paper
   * contrast is 229 luma.** That is 1.3 % of the contrast already on screen.
   * The object's centre of value does not move at all; what arrives is a ±10
   * luma gradient about an unchanged mean. A viewer is being asked to notice a
   * change between two things that measure the same darkness, which is exactly
   * *"I have a hard time noticing it's now 3D"* stated in numbers.
   *
   * And the reason is structural rather than accidental. The flat ink is
   * deliberately `MATERIAL_PARAMS[preset].color` — the lit surface's own albedo
   * — with the page's own comment claiming the benefit that *"the flat ink can
   * now only ever disagree with the lit surface by as much as the lighting
   * does."* Under this rig the lighting disagrees by three luma. The sentence
   * is true and it is the defect.
   *
   * ── WHY THE ANSWER IS LIGHT AND NOT A LIGHTER INK. ───────────────────────
   * The register's law is *"One pencil. Matte ink, value from light — never
   * hue, never gloss"*, and `assert-hero-transition`'s gate 4a enforces the
   * half of it that matters here: tonal range comes from light and mark
   * density, never from washing the ink out. So this channel may not touch the
   * ink and may not add gloss to a matte preset. It does the one thing the law
   * mandates instead: **it turns the light up on the form, and only on the
   * form.**
   *
   * ── WHAT IT MOVES, AND THE ONE THAT TURNED OUT TO MATTER. ────────────────
   * Two candidates were swept, one dial at a time, against the parked prior.
   * The full table and the reason each was tried are on `HERO_LIT`. In short:
   *
   * 1 · THE FRESNEL RIM — the obvious candidate, and it LOST. `applyRimGlow`
   *     exists in Desk Doodles for precisely this problem (*"an ink-black 3D
   *     form reads as a featureless silhouette/blob… so the FORM pops as a
   *     backlit inked sculpture"*), it is already ported, and it is already
   *     switched off while the mark is flat. It does not read, and the reason
   *     is measurable: at `uRimPower` 2.6 the term is confined to about two
   *     pixels of a twenty-two-pixel stroke, which is INSIDE the antialiasing
   *     ramp. A scanline across one stroke on the settled solid
   *     (`_probe-stroke-profile.mjs`) runs
   *     `… 45.1 · 49.3 · 57.2 · 119.1 · 226.3 · 250` — strictly monotonic into
   *     paper, no local maximum, **no rim halo anywhere.**
   *
   *     So the band was widened, and the statistic improved and the PICTURE got
   *     worse: at exponent 1.15 the interior median gains six luma while the
   *     stroke stops reading as round, because a fresnel term spread across a
   *     whole tube is a constant rather than an edge. Switching the rim off
   *     entirely costs half a luma. **The rim ships exactly as ported**, and
   *     both dials stay reachable so that result is re-runnable.
   *
   * 2 · THE ENVIRONMENT'S WEIGHT ON THE FORM — the one that works. At roughness
   *     1 and metalness 0 the baked studio environment is what puts a gradient
   *     across the tube at all; the direct lights are three distant
   *     directionals plus a near point light. Scaling `envMapIntensity` up on
   *     the LIT half widens the form's own range without touching the ink,
   *     which is the register's stated mechanism verbatim — *value from light*.
   *     At `envGain 3.6` the object's interior goes **median 23.6 → 46.3**
   *     against a drawing that has not moved by a digit, i.e. the tonal event
   *     goes from **+3.0 luma to +25.7**, and it lands at the bottom of the
   *     45–63 interior band `online-reference-mechanics.md` §9.1 measures for
   *     dimensional forms across eleven clips of this exact move.
   *
   * ── WHY IT IS ITS OWN CHANNEL AND NOT `1 - ink`. ─────────────────────────
   * Because `flatten` defaults to `SOLID_STATE` (`ink: 0`), so `1 - ink` is
   * **1 on every call site that never heard of the hero beat** — the drawing
   * lab, the style battery, the material battery, every capture in
   * `verify-gates`. Deriving it would have re-lit the whole app to fix one
   * beat. Omitted → 0, so every existing call site renders exactly as before,
   * which is the same contract `penCarve`, `jointBreak` and `squashX` carry.
   *
   * It rides `1 - ink` **at the hero's own call site**, which is one piece of
   * news and not two: the surface changing state IS the news, and the rim is
   * part of the surface. So it hard-flips at the edge exactly where the ink
   * swap already hides, and nothing new lands on a frame of its own.
   *
   * The prior read is `lit: 0`, reachable and rendered rather than remembered
   * — `window.__heroLitLaw = "prior"` parks it live, and
   * `assert-hero-switch.mjs` uses that arm as its negative control.
   */
  lit?: number
  /**
   * O5's CASCADE — the channels above, PER LETTER, in reading order.
   *
   * `lib/hero-motion.ts`'s `LetterState`, passed straight through: `yaw` about
   * that letter's own vertical axis, `flat` its own drawing-ness, `depth` its
   * own thickness, `shade` its own turning falloff. Board §4 O5: *"The single
   * whole-word moment becomes eleven small true moments... each letter-flip is
   * the BUILT turn, scaled to a letter."*
   *
   * ── THE MODEL SAYS WHEN, THIS FILE SAYS WHERE ────────────────────────────
   * There is no pivot in here and there must not be. A letter's turn axis is a
   * fact about the GEOMETRY, and a copy computed in the model would be a second
   * source of truth for the exact number the board warns about: *"a mis-placed
   * axis makes a letter sweep sideways instead of turning in place."* The
   * renderer measures each letter's own centre off the meshes that carry it
   * (`letterPivotsRef`) — the same way the whole-word turn's pivot is measured
   * off its children rather than taken from `bounds`.
   *
   * Which STROKE is which letter comes from `Viewport3DProps.letterMap`, stamped
   * onto the geometry as a per-vertex attribute because every stroke shares one
   * material. See `applyLetterMotion`.
   *
   * Omitted → no cascade, and the per-letter shader pass is inert at
   * `uFsLetterCount 0`. Every existing call site renders exactly as before.
   */
  letters?: readonly {
    yaw: number
    flat: number
    depth: number
    shade: number
    /**
     * HOW FAR THIS LETTER HAS SETTLED ONTO THE WORD'S AXIS — 0 = its own centre,
     * 1 = the word's. `lib/hero-motion.ts`'s `LetterState.settle`, which carries
     * the whole derivation: two letters at one yaw about two pivots are two
     * different rigid motions, so the settled rank tears unless they share one.
     *
     * OPTIONAL on purpose, and the omitted default is 0 — the pose that shipped
     * before 2026-08-04. A caller that does not carry the cascade (every non-hero
     * viewport, and the six other films) renders byte-identically.
     */
    settle?: number
  }[]
}

/**
 * WHICH LETTER EACH STROKE BELONGS TO — index-parallel to `processedStrokes`.
 *
 * Measured from the ink by `lib/hero-letters.ts` and handed down rather than
 * re-derived here: the host already has the processed strokes and the nib width,
 * and a second clustering in this file would be a second answer to the one
 * question the cascade turns on.
 */
export const SOLID_STATE: FlatState = { ink: 0, depth: 1, color: "#121110", yaw: 0, shade: 0 }
