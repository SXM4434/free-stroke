/**
 * HERO MOTION — the 2D-ink → 3D-object beat, as a tunable model.
 *
 * WHY THIS FILE EXISTS
 * `scripts/capture/motion.mjs` owns this choreography for the OFFLINE capture:
 * it emits one camera pose per output frame, capture-run drives the real 3D
 * scene to each pose, and compose plays them back. That is the right shape for
 * producing a film, and a terrible shape for TUNING one — every adjustment
 * costs a full headed capture run.
 *
 * This is the same choreography expressed as a pure function of time, so a live
 * page can scrub it, play it, and re-tune it against the real WebGL scene at
 * interactive speed. Defaults below are byte-equal to motion.mjs, so the live
 * preview and the captured film start from the identical program.
 *
 * WHAT THE LIVE PAGE PROVED. This page's elevation arc is what showed that the
 * tilt has to be a real camera move: driven live to elevation 65° the word
 * genuinely reads as LYING on the ground plane, because the perspective
 * projection gives it a near edge larger than its far edge. The offline film
 * used to fake that beat with a 2D vertical scale of the flat raster, which has
 * no perspective in it at all and so read as CONDENSED rather than receding.
 * The capture now follows the live model: draw and breath are flat 2D, the
 * emerge happens dead-on, and everything from the tilt onward is captured
 * camera frames.
 *
 * THE FLAT HALF IS NOW LIVE, AND BY A DIFFERENT MECHANISM THAN THE FILM'S.
 * Offline, the draw and breath are a flat 2D raster and the handoff is a
 * darken-union composite of two layers. Live there is no compositor, and two
 * layers is precisely what could not be made to register — so the flat state is
 * the SAME MESH driven to zero depth and constant-value ink (`sampleEmerge`
 * below; see explainers/14-the-flat-to-solid-beat.md). The anticipation squash
 * is still compositor-side and still does not show live.
 *
 * THE SPEC THIS SERVES (desk-doodles/docs/submission/VIDEO-DIRECTION.md §2.4):
 *   "The flat ink doodle ANTICIPATES (tenses), then stands up off the page into
 *    its 3D form with ease-in → overshoot → settle, then a slow auto-orbit that
 *    HOLDS the best ¾ angle."
 */

import { clamp01, DEG, easeInOutCubic, ddFlipEase, turnPhase, turnPose, solidDepthAt, solidShade } from "./flip-pose"
export { easeInOutCubic, cubicBezierEase, ddFlipEase } from "./flip-pose"

export type HeroPhase =
  | "draw"
  | "breath"
  | "anticipation"
  | "emerge"
  | "land"
  | "solid"
  | "tilt"
  | "standup"
  | "orbit"
  | "descend"
  | "returnTurn"
  | "hold"

/**
 * WHERE THE CAMERA IS — AND, IN THREE OF THE FOUR, THE FACT THAT IT NEVER MOVES.
 *
 * ── THE DIAGNOSIS THIS TYPE EXISTS TO FIX ────────────────────────────────────
 * Sebs, twice: *"THE CAMERA ANGLES CHANGE ARE ABRUPT AND DONT HAVE ANY EASING
 * AND STILL DONT MAKE REAL SENSE"* and, after the easing was fixed, *"none of
 * the weird camera angles are fixed."* The second complaint is the real one and
 * it is not about easing at all. `docs/hero-animation-options-board.md` §2
 * states it in one line: **the camera performs the product's verb while the mark
 * never moves.** The claim is "flat ink STANDS UP off the page"; between t 7.85
 * and t 11.05 of the shipped film the mark does not move a pixel — `tilt`,
 * `standup`, `orbit` and `descend` are az/el/fill channels, every one of them.
 * A viewer parses a camera move as *I moved*, not *it moved*.
 *
 * ── AND THE REFERENCE SET IS UNANIMOUS ───────────────────────────────────────
 * `online-reference-mechanics.md` §6.1: *"**Nine of eleven park the camera**…
 * The three purpose-built extrude templates all rotate the **object** and hold
 * the camera."* The original set measures **0 px of camera drift in 114 s**
 * (`reference-film-mechanics.md` §2.1). Our own OG flip never moves it.
 * Thirteen measured films, and not one performs a dimensional reveal with a
 * camera move — we tried to perform ours with four.
 *
 * > **The camera watches. The mark performs.**
 *
 * ── THE THREE SHOTS THE BOARD CUT FROM LOGIC, AND WHY ────────────────────────
 * - **`tilt`** tells nothing. It exists only to reposition the camera so
 *   `standup` can start from "lying down" — 0.43 s of illegibility spent
 *   re-litigating the page from a wall into a floor, mid-film. **The geometry of
 *   a scene is established in frame 0 or never.**
 * - **`descend`** has nothing to descend from once the camera never leaves.
 * - **the push** goes with them: *"with nothing to be parallaxed against, a
 *   dolly is indistinguishable from a zoom"* (`storyboarding.md` §4). So
 *   `fill` is a constant under all three parked laws — the payoff arrives at
 *   the framing the film opened in, which is also what makes K1 ≡ K7 an
 *   identity rather than a resemblance.
 *
 * ⚠ CUT MEANS PARKED, NOT DELETED (§0.7). `prior` is the whole four-move camera
 * program, verbatim, and it is the DEFAULT — every camera assertion in
 * `scripts/verify/` is written against it, and `assert-hero-camera.mjs` reads
 * `DEFAULT_HERO_MOTION` directly. Changing which of these ships is Sebs's pick,
 * and it is one line.
 */
export type HeroCamera =
  /** The shipped program: tilt → stand-up → orbit → descend. Four camera moves. */
  | "prior"
  /**
   * C-A · DEAD-ON, PARKED, FOREVER. The page is a sheet facing you; head-on
   * identity is exact on both K1 and K7. Depth is *toward the viewer*, so the
   * only shadow that exists at this viewpoint is a page-plane drop shadow —
   * which the engine does not have (the pool is floor-projected and measures
   * **0.00** at el 0, storyboard §11.7.6). Options bound to it therefore CUT
   * their shadow beat rather than fake it.
   */
  | "deadOn"
  /**
   * C-B · DESK ¾, PARKED, FOREVER, FROM FRAME 0. A person looking at their own
   * notebook. Gravity is established before the first stroke, so nothing is
   * ever retconned; the floor shadow, the interior faces and the silhouette
   * change are all visible from the one chair. **Cost:** the dead-on "exactly
   * your drawing" frame never exists.
   */
  | "desk"
  /**
   * C-C · DEAD-ON, with ONE AUTHORED CUT to the desk ¾ and one back.
   *
   * The grammar allows a cut, and only under conditions this law meets by
   * construction: it is preceded by a hold and lands on stillness
   * (`reference-film-mechanics.md` §2.2 — the reveal cut leaves a 4.29 s frozen
   * frame), and the two framings sit **35.5° apart**, clearing the 30-degree
   * rule (`storyboarding.md` §4) so the cut is not a jump.
   *
   * ⚠ **THE BOARD SAYS "ONE CUT" AND THIS IS TWO. Named, not hidden.** §2 C-C
   * reads *"One cut, both ends held, never a glide between them"* — but the
   * round trip's whole claim is that K7 is K1's framing, and a single cut leaves
   * the film ending somewhere else. So the film cuts OUT at the top of `tilt`
   * and BACK at the top of `descend`: each replaces a camera move the board cut
   * for being a glide, each lands on a held frame, each is the same 35.5°.
   */
  | "cut"

/**
 * WHICH FILM THE BEAT IS.
 *
 * Sebs, on a board that described seven options and built none of them:
 * *"where tf are the toggles i had for the different type of animations —
 * remember i asked to come up with some of ur own as well"*. These are that
 * row. Each is a whole exposure sheet plus a whole form law, not a tweak — see
 * `HERO_SHEETS` for the frame budgets, which are the board's own.
 *
 * ⚠ THREE OF THE BOARD'S SEVEN ARE NOT HERE AND THE REASON IS THE SAME FOR ALL
 * THREE: they need a rendering capability that does not exist and that this lane
 * does not own. Named rather than half-wired, because a half-wired option is
 * worse than an absent one.
 *
 *   **O2 · the pop-up** wants the word to hinge up about its baseline. The
 *     renderer composes exactly one rotation for the mark —
 *     `M_ROT.makeRotationY(yaw)` (`components/viewport-3d.tsx`) — about a pivot
 *     whose Y is already `box.min.y`, the contact. A pitch hinge is a
 *     `makeRotationX` inserted in that same chain about that same pivot, plus a
 *     `pitch?: number` on `FlatState`. The carve and joint-break shaders invert
 *     that one matrix, so they follow for free. **Small diff, not mine.**
 *   **O3b · drawn in both** wants each stroke to pop solid at its own pen-up,
 *     which needs `flat`/`depth` PER STROKE. Today both are one uniform for the
 *     whole mark.
 *   **O5 · letter by letter** wants eleven independent yaws. The blocker is not
 *     the transform — it is that `applyPenCarve` and `applyJointBreak` both map
 *     a fragment back into field space through the inverse of the mark's ONE
 *     world matrix. Per-letter motion needs a per-letter transform index as a
 *     vertex attribute and an array of inverses in both shaders. **Real work.**
 *
 * ⚠ O5 IS BUILT AND THE PARAGRAPH ABOVE IT IS HALF WRONG — left standing rather
 * than rewritten, because the wrong half is the more useful record. The vertex
 * attribute is real and is there (`aFsLetter`). **The inverses are not needed at
 * all.** `applyJointBreak` captures the field position in the VERTEX shader,
 * before `<project_vertex>`:
 *
 *     vFsBreakWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
 *     #include <project_vertex>
 *
 * so a rotation applied to `transformed` after that line and before the
 * projection moves the letter while the varying still carries its ORIGINAL
 * position. All three field lookups keep working untouched, on ONE shared
 * material. See `applyLetterMotion` in `components/viewport-3d.tsx`.
 */
export type HeroShape =
  /** The beat exactly as it ships. The default, and the negative control. */
  | "shipped"
  /**
   * O1 · THE TURN THAT LANDS — *"your drawing has a body; watch it turn and
   * show you its side."* The minimum re-cut of what is built: the turn runs
   * flat → edge → and lands **short of head-on**, at `landYaw`, so the ¾ pose is
   * one the OBJECT reached. Four camera phases stop existing and their seconds
   * become holds. Every mechanism in it is already gated 8/8.
   */
  | "turnLands"
  /**
   * O4 · SOLID FIRST — *"this object was your drawing all along."* Sebs's idea
   * #2. The arc runs backwards: two frames of empty page, the solid pops in
   * already dimensional at `landYaw`, holds, then turns home THROUGH ITS OWN
   * EDGE — and what comes back from the sliver is the ink. The film ends on the
   * drawing, carrying its pen order. **Its price is structural and is not
   * tunable: there is no draw-in in this film.**
   */
  | "solidFirst"
  /**
   * O6 · THE CUTAWAY — *"look away for half a second; your doodle is standing."*
   * The transform is never shown. It is bought with **absence**, the single
   * strongest measured device in the reference set: Exquisite Corpse empties the
   * frame for 625 ms at a frame-to-frame difference of **exactly 0.000** before
   * its payoff, and `all4-idents` blanks two frames before every build and comes
   * back with the object already dimensional. Bound to C-B, because the standing
   * form has to cast the floor shadow for the absence to have paid for anything.
   */
  | "cutaway"
  /**
   * O2 · THE POP-UP — *"the drawing stands up off the page."* The product's own
   * sentence (VIDEO-DIRECTION §2.4), performed by the drawing rather than
   * narrated by the camera. The word hinges up about its baseline like a pop-up
   * book panel, on the one pivot edge a letterform genuinely has: its contact
   * with the page.
   *
   * ⚠ THIS WAS THE FIRST OF THE BOARD'S THREE UNBUILT OPTIONS, and the note
   * above this type said why: the renderer composed exactly one rotation for the
   * mark. It now composes two — see `FlatState.pitch` — so the blocker named
   * there is gone. The other two (O3b's per-stroke flat, O5's per-letter yaws)
   * are still real work and are still absent rather than half-wired.
   *
   * Bound to camera `desk` and, unlike every other film, bound from FRAME ZERO:
   * gravity may never be retconned. If the page is revealed to be a desk only
   * at the moment the mark stands, the stand reads as the camera moving. The
   * board's own words: *"established before the first stroke."*
   *
   * Its price, stated: the dead-on "this is exactly your drawing" frame does not
   * exist in this film. The ink is always seen at the desk angle — an affine of
   * the linework, never a substitute for it. That is a brand call, and it is
   * Sebs's.
   */
  | "popUp"
  /**
   * **STAND & TURN — mine, not the board's.** O2 answers *"the drawing stands
   * up off the page"* and the board names its price honestly: the pop-up never
   * shows the object turn, so it performs the product's verb and never makes
   * the identity claim that the thing standing there is a BODY.
   *
   * This film pays that price off by staging the two events in sequence instead
   * of choosing between them: the word stands off the desk, holds, and then —
   * with the camera still parked — turns on its own axis to its ¾, holds there,
   * and comes home. Stand, hold, turn, hold, return.
   *
   * ⚠ SEQUENTIAL IS THE WHOLE POINT, and it is the lesson the pop-up taught by
   * failing: the first cut of O2 ran its hinge and the shipped yaw turn in the
   * same 15 frames and the word collapsed to a sliver mid-stand. Two pieces of
   * news in one shot cancel; the same two, one after the other, compound. Every
   * moving passage here has exactly one claim, and a hold sits between them.
   */
  | "standTurn"
  /**
   * O5 · LETTER BY LETTER — *"every letter of your drawing has a body."*
   * Sebs's idea #3 and the board's flagship: **the single whole-word moment
   * becomes a cascade of small true ones.** Board §4 O5: *"This is the option
   * that deserves the most work, because it multiplies the beat's alive-ness
   * without inventing one new mechanism: each letter-flip is the BUILT turn,
   * scaled to a letter."*
   *
   * It is O5-A, the 2D-FIRST shape: draw → flat held → tense → **the cascade**
   * → the rank held → everything lies flat in one beat → K7's news → hold.
   *
   * ── THE THREE THINGS THE BOARD MADE THE BUILD DECIDE ──────────────────────
   *
   * 1 · **Who owns the shared ink.** *"The word's strokes fuse across letters —
   *     the `esk` cluster is the known shred zone. A letter cannot flip without
   *     deciding who owns the shared ink."* Decided by the ink itself, not by a
   *     table: `lib/hero-letters.ts` takes connected components of "these two
   *     centrelines are closer than one nib", which is exactly the board's
   *     sanctioned *"flip as a bound pair"*. **Measured on Sebs's traced word:
   *     eight units, not eleven** — the hand really did fuse `e-s-k` and `o-d`.
   *     The same law reproduces the FONT word's authored 11-letter map exactly,
   *     which is what makes it a law rather than a guess.
   *
   * 2 · **Where each letter turns.** Board: *"a mis-placed axis makes a letter
   *     sweep sideways instead of turning in place."* Each letter turns about
   *     its OWN measured centre — the renderer takes it from that letter's own
   *     geometry, so it cannot drift from what is on screen.
   *
   * 3 · **Where they land.** *"a letter that lands head-on lands invisible.
   *     Every letter lands at a shared small object-yaw (~15–18°) — the word
   *     ends as a rank of slightly-turned standing solids, side walls visible
   *     dead-on, like wooden type on a shelf."* That is `letterLandYaw`, and it
   *     is a dial because the board hands the pose call to Sebs by name.
   *
   * ── THE CADENCE IS MEASURED, NOT DESIGNED ─────────────────────────────────
   * Flip 1 alone, full ceremony, then a **20 fr / 667 ms** clean read (Exquisite
   * Corpse's own stagger, *"measured exactly, twice"*); every flip after it on a
   * **460 ms** interval (Babbu's cascade median) at **292 ms** each — the
   * shorter of the reference set's only two transition lengths, inside the
   * board's 240–330 ms band. Only flip 1 gets the dwell: *"eleven dwells would
   * turn the signature into a flicker."*
   *
   * Bound to camera `deadOn`. At the desk ¾ even a head-on landing shows, so
   * the shared-yaw rank is what makes the cascade legible dead-on — and dead-on
   * is the framing where K1 and K7 are the same picture, which is the identity
   * claim this film ends on.
   *
   * ⚠ ITS GLOBAL CHANNELS ARE PARKED AND THE PER-LETTER ONES CARRY EVERYTHING.
   * `flat`, `depth`, `yaw` and `shade` all read as the settled solid on every
   * frame of this film, because a value between two states applied to the WHOLE
   * mark is exactly what a cascade must not do. See `sampleLetters`.
   */
  | "letterByLetter"

/**
 * ORDER MATTERS, AND THIS ORDER CHANGED — TWICE.
 *
 * `anticipation` used to sit AFTER `tilt` — so the mark tensed 1.33s after it
 * had already gone solid, at el 65° where the word is a 47px-tall black bar.
 * Anticipation after the event is not anticipation, it is a hiccup, and the
 * storyboard calls K1→K2 "the single most broken adjacency" (§4). A wind-up
 * has to precede the thing it winds up for, so the tense now sits between the
 * held flat mark and the turn, dead-on, where it is legible.
 *
 * The second change is the ROUND TRIP. `land`, `solid`, `descend` and
 * `returnTurn` are new, and they exist because the beat used to stop rather
 * than end: it hung on a drifting three-quarter with the last shot of the board
 * — K7, the return — simply absent (§3 K7, *status: MISSING*). Going one way
 * asserts a conversion. Coming back asserts an IDENTITY, which is the pitch.
 *
 * The array is the single source of order: `phaseOffsets` lays phases out by
 * cumulative sum and `sampleHeroMotion`'s if-chain walks them in the same
 * sequence, so those three have to agree. `HeroBeats`'s field order is
 * declaration order only and does not affect layout.
 */
export const HERO_PHASES: readonly HeroPhase[] = [
  "draw",
  "breath",
  "anticipation",
  "emerge",
  "land",
  "solid",
  "tilt",
  "standup",
  "orbit",
  "descend",
  "returnTurn",
  "hold",
]

/**
 * THE PARKED PORTION — the phases that hold a still camera, and therefore the
 * phases that may run on TWOS.
 *
 * Mechanics §4.3 measured every authored graphic passage in Exquisite Corpse
 * and found all of them on twos — parity ratios 9.9× to 19.4× — with only the
 * live-action video on ones. The storyboard's own exposure sheet (§7) puts only
 * the turn on twos, and §10.2 C6 corrects that: *"K1, K2, the four turns, the
 * land, K4, K6 and K7 are all camera-parked and all eligible."*
 *
 * The exclusions are not an oversight, they are the same source's warning:
 * *"it is dangerous to animate on double frames during a table move or camera
 * track"* (Whitaker/Halas/Sito, quoted at §7). So `tilt`, `standup` and
 * `descend` — the three phases that fly the camera — stay on ones.
 *
 * `draw` is camera-parked and is NOT here, deliberately. C6's list does not
 * name it, and the draw-in is the one passage whose motion IS the pen's own
 * speed: quantising it quantises the handwriting. One line to add if that is
 * wanted; it is not assumed.
 */
export const PARKED_PHASES: readonly HeroPhase[] = [
  "breath",
  "anticipation",
  "emerge",
  "land",
  "solid",
  "orbit",
  "returnTurn",
  "hold",
]

export interface HeroBeats {
  /** Flat ink scratches itself in. */
  draw: number
  /**
   * THE HOLD THAT BUYS THE MOMENT.
   *
   * This used to read: *"Stillness before the move — cuts land on motion, never
   * on stillness."* That rule is FALSE, and it was measured false across 114
   * seconds of reference film (`docs/research/reference-film-mechanics.md`
   * §2.2, §9; reproduced in the storyboard §10.1). Of the hard cuts in the
   * reference set, the most important one — the cut into Exquisite Corpse's
   * payoff — leaves a near-still frame and arrives on FOURTEEN consecutive
   * frames at a frame-to-frame difference of exactly 0.000.
   *
   * The corrected rule points the other way: **an accent is bought with a hold,
   * not with a move**, and the reference set's two biggest accents are preceded
   * by 4292ms and 2586ms of completely frozen frame.
   *
   * That inverts what this dial is for. Under the false rule `breath` was a
   * throat-clear — something to cut out of — so half a second was plenty, and
   * the storyboard's first exposure sheet duly made it the beat's SHORTEST
   * hold, sitting immediately before its only moment. It should be the longest.
   */
  breath: number
  /**
   * THE BEAT THE WHOLE PRODUCT IS ABOUT: the flat mark becomes an object.
   *
   * This used to be called `crossfade`, and the name was the bug. A crossfade
   * is two images swapping — the one thing this beat must never read as. There
   * is only ONE object here: the same mesh, in the same place, through the same
   * camera, gaining depth and gaining light. Nothing appears and nothing
   * disappears, so there is nothing to register and nothing to mis-register.
   *
   * Duration is PORTED, not invented: Desk Doodles' own flip is
   * `FLIP_MS = 540` (DeskDoodlesHome.tsx:637). That is the one number in their
   * flip that was tuned by eye against this exact gesture, so it comes across
   * whole even though the mechanism underneath it is different.
   */
  emerge: number
  /**
   * K4's ARRIVAL. The contact shadow lands — and it is the ONLY thing that
   * happens here.
   *
   * §3 K4 gives this shot two arrivals: *"the crossings resolve into over/under,
   * and the contact shadow lands."* §10.5 call 1 takes one of them away, on the
   * most consistent finding in the reference set — **one thing moves at a
   * time** (100:1 band separation through Exquisite Corpse's shuffle;
   * simultaneity of exactly 1 across Babbu's whole eleven-event cascade). The
   * junction resolution moves to K7; the shadow stays here and gets its own
   * curve, ~4 frames behind the face, which is the 50–100ms secondary-action
   * offset §7 asks for.
   *
   * Sized so the shadow's whole landing fits inside it exactly:
   * `shadowLagSec + shadowSec`. The phase IS the landing.
   */
  land: number
  /**
   * K4 — SOLID, DEAD-ON, HELD. The A/B frame.
   *
   * K1 and K4 are the SAME framing, and the audience compares K4 against its
   * memory of K1. That comparison is the product's whole claim and it needs a
   * held frame to happen in. It had 0.33s and was never held (§3 K4, *status:
   * exists, never held*); the board gives it 18 frames.
   *
   * §10.2 C7 is the reason not to spend them: the sliver is our empty frame,
   * and *"K4's 18 frames is the payoff of the absence. Do not spend it."*
   */
  solid: number
  /** The page tips back; the finished mark is revealed LYING on it. */
  tilt: number
  /** Tense before the commit: compress, then hold the tension. */
  anticipation: number
  /** Ease-in → overshoot → settle. Lying rises to standing. */
  standup: number
  /** The held ¾ — K6. Parked, so nothing in it moves. */
  orbit: number
  /**
   * THE MARK LIES BACK DOWN — the camera squares up to K1's framing.
   *
   * NOT IN THE BOARD, AND FLAGGED AS SUCH. §7's exposure sheet has K6 at
   * az 38° / el 10° and then the return turns "parked" at K1's framing, with no
   * row in between that gets the camera from one to the other. K7 is defined as
   * *"back to the opening state, at K1's framing"*, so something has to fly
   * az 38 → 0 and el 10 → 0, and it costs frames the ledger never counted.
   *
   * Priced against the reference set rather than guessed: 433ms is one of the
   * only two transition lengths those films use — *"292 ms or 433–467 ms. Two
   * values, used consistently. Nothing in between"* (mechanics §6.3, transfer
   * #10). It is ease-out dominant, because every move in 114 seconds of
   * reference film is (§6.1) — but see `descendLaw`: it shipped on
   * `easeOutStrong`, which reaches its peak velocity in the FIRST frame, and
   * out of a 933ms dead hold that measured as a 0 → 375.9 deg/s step in 33ms.
   * §6.1's sentence has two halves and only the second one was built.
   */
  descend: number
  /**
   * THE RETURN TURN — the same moment, run backwards.
   *
   * The original flip is 3D → flat → 3D, not flat → 3D; *"that symmetry is much
   * of why the original reads as a finished gesture rather than a run-out
   * clock"* (§3 K7). Same width law, same shade term, same one centre, same
   * dwell — and the state change is hidden at the edge exactly as it is on the
   * way out.
   */
  returnTurn: number
  /**
   * K7 — HELD FLAT, AND CHANGED. The round trip closes.
   *
   * 11 frames is the §10.3 ledger's own allocation and it is not a rounding
   * error: this shot is the *payoff* of the return turn's absence, not the
   * event itself, and the nearest measured analogue in the reference set is
   * Doodle Fonts holding its resolved wordmark for **400ms** and then ending
   * the film (mechanics §3.3 shot 6). 11 frames at 30fps is 367ms.
   */
  hold: number
}

export interface HeroMotionParams {
  fps: number
  beats: HeroBeats
  /** Elevation of the lying pose, degrees. High = looking down at the page. */
  lieEl: number
  /** Where the stand-up overshoot settles. */
  standupAz: number
  standupEl: number
  /** The ¾ money angle the orbit drifts to and holds. */
  holdAz: number
  holdEl: number
  /**
   * Camera distance multipliers. SMALLER = closer = bigger on screen. These
   * descend across the move on purpose: the payoff has to arrive at its most
   * present, so the held frame is the closest frame of the sequence.
   */
  fillLie: number
  fillStand: number
  fillHold: number
  /**
   * Back-curve coefficient for the stand-up. Controls how far the move dips
   * before launching and overshoots before settling. The classic value is
   * 1.70158, which yields about ±10% — the bottom of the "keep bounce subtle"
   * band. Zero turns the curve into a plain ease-in-out with no anticipation.
   */
  backC1: number
  /**
   * HOW FAR THE STAND-UP SWINGS PAST ITS TARGET — its own number, at last.
   *
   * IT USED TO BE `emerge.overshoot`, WHICH IS A DIAL ABOUT INK. Under the
   * shipped `riseCurve: "riseOut"` the rise read `p.emerge.overshoot` for its
   * overshoot while `emerge.overshoot`'s panel row is labelled **"Swell"** and
   * hinted *"how far past full thickness the ink puffs before settling"* — and
   * under the shipped `emerge.mode: "turn"` that ink swell does not exist at
   * all (the turn's depth is `easeInOutCubic`, the swell is the parked ramp's).
   * Swept in `assert-hero-dials.mjs`: moving "Swell" changed **az 19.1° /
   * el 25.2° / fill 0.10 and depth by exactly nothing.** One control, wrong
   * name, the other end of the beat.
   *
   * Splitting it costs no behaviour — the default is the value the rise was
   * already reading — and it lets each dial say what it does. `emerge.overshoot`
   * goes back to being the ink's, on the one arm that has an ink swell.
   *
   * ⚠ REDUCED MOTION READS THIS. `app/desk-doodles/page.tsx` zeroes the
   * overshoot when the reader asks for less motion; it now zeroes this one too,
   * and `assert-hero-camera.mjs`'s reduced row is the check on that.
   */
  riseOvershoot: number
  /**
   * DOES THE WIND-UP RELEASE INTO THE TURN, OR SNAP BACK BEFORE IT?
   *
   * `overlap` — the tension unwinds across the turn's own silent leading
   *   frames, so the release and the turn's onset are one gesture. See
   *   `anticipation.releaseSec` for the measurement that sizes it.
   * `prior` — the whole prior wind-up law, verbatim: compress from the phase
   *   start, hold to the phase end, and then `squashX/Y` snap to 1 on the first
   *   frame of the turn. PARKED, not deleted; it is the negative control
   *   `assert-hero-windup.mjs` runs against and it is how the twitch can be
   *   FELT rather than argued about.
   */
  releaseLaw: "overlap" | "prior"
  /**
   * THE RISE'S SPACING. `riseOut` = the ease-out-dominant curve the reference
   * set measures on every one of its moves. `prior` = the symmetric
   * `easeInOutBack` this beat shipped with. PARKED, not deleted: it is the
   * negative control the rise assertions run against, and swapping it back is
   * how the 50:50 read can be felt rather than argued about.
   */
  riseCurve: "riseOut" | "prior"
  /** How much of the rise is spent gathering backwards before it commits. */
  riseGatherFrac: number
  /** How far below zero the gather dips, as a fraction of the travel. */
  riseGatherDepth: number
  /** Fraction of the orbit spent at constant velocity before decelerating. */
  driftCut: number
  /**
   * DOES THE CAMERA TRAVEL AFTER THE RISE?
   *
   * `parked` — it does not. The rise settles straight onto the held ¾, and
   *   everything after it is a dead hold.
   * `prior` — the drift this beat shipped with: az 30 -> 38 across 3.2s of
   *   "orbit", decelerating toward zero. PARKED, not deleted.
   *
   * The drift was built on the Ken-Burns claim — *"a slow continuous drift
   * under fast per-element pops; the frame is never static"* — and 114 seconds
   * of reference film contains no such thing (§10.2 C1). It is not a curve that
   * under-shoots its target, it is a device with no basis in the reference set,
   * so the correction is not "decelerate harder" but **do not travel**.
   *
   * A hold only reads as a hold if something stopped. This is the difference
   * between the beat's last four seconds being a held pose and being the
   * "it just dollies side-to" read.
   */
  cameraPark: "parked" | "prior"
  /**
   * DOES THE TILT ARRIVE, OR DOES IT HAND OVER?
   *
   * `handover` — the tilt takes the camera to `riseStartEl` and gets there
   *   still moving, at exactly the speed the rise's gather starts at. The lie
   *   down and the rise's wind-up are then ONE continuous descent onto the
   *   page, with the deepest look-down — exactly `lieEl` — reached once, at
   *   the instant the camera turns around.
   * `prior` — `easeInOutStrong` to `lieEl`, arriving at rest. PARKED, not
   *   deleted; it is the negative control the camera assertions run against.
   *
   * TWO MEASUREMENTS FORCE THIS, and neither is a matter of taste.
   *
   * 1 · THE HITCH. Sampled at 30fps the prior program's elevation steps read
   *   `… 2.55, 1.71, 1.04, 0.53, 0.20, 0.03 | 2.80, 2.02, 0.68, −0.86 …` across
   *   the tilt→standup seam. The camera glides to a near-stop over six frames
   *   and then, without changing direction, speeds back up by a factor of
   *   NINETY-THREE in one frame — 0.8 deg/s to 84.0 deg/s. That is not an
   *   anticipation, because an anticipation moves AGAINST what is about to
   *   happen and this moves with what just happened. It is the tilt not quite
   *   finishing. It is the second-largest discontinuity in the program.
   *
   * 2 · THE DIAL WAS LYING. `lieEl: 65` names the deepest the camera looks
   *   down, and under the prior program the camera reaches **70.3°**, because
   *   the gather is a fraction of the rise's TRAVEL and adds 5.5° on top of a
   *   destination the tilt had already arrived at. The mark lies in the page,
   *   so its on-screen height goes as `cos(el)`: 65° is 42% of full height and
   *   70.3° is 34%. **The least legible frame in the beat was not in the tilt
   *   at all — it was in the rise's anticipation, 5.3° past the pose anything
   *   was authored against.** §3 K5 calls K4→K5 *"a detour through
   *   unreadability"*; the detour went further than the board knew.
   *
   * Under `handover` the tilt ends at `riseStartEl` — 60.0° with the shipped
   * numbers — and the gather carries the last 5° onto 65° and turns around. The
   * pose is unchanged, reached once, and named correctly.
   */
  tiltLaw: "handover" | "prior"
  /**
   * DOES THE DESCEND ACCELERATE, OR DOES IT SNAP TO FULL SPEED?
   *
   * `accelerated` — `handoffEase`, so the move ramps to its velocity peak over
   *   `moveAccelFrac` of its own length and then decays to rest.
   * `prior` — `easeOutStrong`, whose velocity is maximum in its first frame.
   *   PARKED, not deleted.
   *
   * THE MEASUREMENT. `easeOutStrong` is `1 − (1−t)^5`, so `f'(0) = 5`: the
   * descend leaves at five times its own average speed. Over 38° of azimuth in
   * 433ms that is **375.9 deg/s in the first frame, out of 933ms in which the
   * camera did not move by one pixel.** Zero to 376 deg/s in 33ms is the
   * largest discontinuity in the camera program by a factor of three and it is
   * the single most likely source of "janky".
   *
   * It is also outside the reference set in the one place the set is explicit.
   * §6.2's per-frame dolly series accelerates for four frames before its peak
   * and decays for seventeen — 1:4. The prior descend's ratio is 1:12, with the
   * peak on frame one. Ease-out dominant is not the same claim as instant.
   */
  descendLaw: "accelerated" | "prior"
  /**
   * How much of a camera transit is spent accelerating to its velocity peak.
   *
   * 0.19 is Babbu's dolly, measured: four frames of acceleration inside a
   * 21-frame slide (§6.2). Expressed as a FRACTION rather than a frame count so
   * a retimed phase keeps the shape instead of keeping the frames — the same
   * reason `dwellSec` is a duration.
   */
  moveAccelFrac: number
  /**
   * THE EXPOSURE — how many distinct states per second the parked portion of
   * the beat is allowed to have.
   *
   * `twos` — the animation clock is quantised to `cadenceHz` wherever the
   *   camera is parked (`PARKED_PHASES`). Every state is held for a whole
   *   step, so a held instant is byte-identical BY CONSTRUCTION rather than by
   *   hoping two renders agree.
   * `ones` — a new state every frame: the continuous clock this beat shipped
   *   with. PARKED, not deleted; it is the negative control the cadence
   *   assertions run against.
   *
   * Mechanics §4.3 and transfer #4: twos is *"a deliberate hand-animation
   * cadence and it is a large part of why the film reads as drawn rather than
   * rendered. It costs nothing to reproduce: sample the animation clock at
   * 12 Hz."* Independently, `origami-crane-fold`'s maker states it outright —
   * *"This video was animated at 12fps (I normaly animate at 24fps). I just
   * think it gives the animation a special look"* — and the measurement found
   * strict alternation before the description was read
   * (`online-reference-mechanics.md` §1.1, §9.2).
   */
  cadence: "twos" | "ones"
  /** The twos rate. 12 Hz inside 30fps, matching Exquisite Corpse's 12-in-24. */
  cadenceHz: number
  /**
   * DOES THE CONTACT SHADOW LAND, OR DOES IT RIDE THE LIGHT?
   *
   * `lands` — its own curve (`easeOutStrong`), starting `shadowLagSec` after
   *   the face has arrived and running for `shadowSec`. It is K4's one piece
   *   of news.
   * `prior` — tied to the same scalar as everything else, which is what
   *   `viewport-3d.tsx:3243` does today (`opacityScale={1 - flatten.ink}`).
   *   PARKED, not deleted.
   *
   * §1.4 is the diagnosis and it is sharper than "there is no shadow": the
   * shadow is real and ported, but *"it exists but is tied to the same scalar
   * as the light, so it **fades up instead of landing**."* Under the turn that
   * is worse, not better — `flat` hard-flips at the edge, so the prior law
   * pops the shadow on in the same frame the ink changes state, and two things
   * arrive at once in a beat whose reference set never does that.
   */
  shadowLaw: "lands" | "prior"
  /** How long the shadow lags the face. The secondary-action offset. */
  shadowLagSec: number
  /** How long the shadow takes to land once it starts. */
  shadowSec: number
  /**
   * DOES THE FLAT MARK WEAR THE PEN'S OUTLINE, OR THE TUBE'S?
   *
   * `pen`   — the flat state's silhouette is carved back to the shape the nib
   *           actually drew (`FlatState.penCarve`, `buildPenField`). The
   *           drawing is a drawing in SHAPE as well as in value.
   * `prior` — PARKED, not deleted: the flat state keeps the tube's silhouette,
   *           which is what shipped. Reproduces this file's output byte for
   *           byte, because `penCarve` is then a constant 0 and the renderer's
   *           carve block is skipped entirely (`viewport-3d.tsx`, `carve > 0`).
   *
   * ── WHY THE CHANNEL EXISTS AT ALL, MEASURED ───────────────────────────────
   * Sebs, on the beat this whole page is about: *"THE 2D AND 3D TRANSFORMATION
   * IS WAY TOO SUBTLE — it's hard to tell it went from 2D to 3D."* He is right,
   * and the number is worse than it sounds. Across the whole beat the flat state
   * and the settled solid differ ON THE SILHOUETTE by 4.09 % of a stroke radius,
   * and a value-only control accounts for the WHOLE of that 4.09 %
   * (`scripts/verify/_probe-carve-preview.mjs`). The shipped beat's silhouette
   * change is ZERO: every visible difference is the luminance threshold moving
   * under the lighting. The "2D" state was never 2D — it was the 3D tube with
   * its shading switched off.
   *
   * Driven, on the real render at full carve: ink 25 062 -> 16 708 px, a 33.3 %
   * drop, 8 354 px ink -> paper and **0 px paper -> ink**
   * (`scripts/verify/assert-pen-carve.mjs` rows 2-3). A uniform fat tube becomes
   * a nib-drawn word.
   */
  carveLaw: "pen" | "prior"
  /**
   * HOW FAR TOWARD THE PEN'S OWN OUTLINE THE FLAT MARK GOES, 0..1.
   *
   * 0 is the tube — identical to `carveLaw: "prior"`. 1 is the outline
   * `makeFlatRenderer` draws with the same nib, which is the same law the film's
   * 2-D ink layer already uses. **THE PICK IS SEBS'S** and the sweep is rendered
   * at `docs/verification/pen-carve/sweep/`; the recommendation WAS 1, for a
   * reason that is not "more is better":
   *
   *   the pen field and the tube field are two REAL shapes and everything
   *   between them is neither. At 1 the flat state's silhouette is exactly what
   *   the hand drew; at 0.6 it is an interpolated envelope with no referent.
   *
   * ── ⚠ THE RECOMMENDATION IS NOW 0.70, AND THE REASON IS COUNTER-INTUITIVE ──
   * (2026-08-02, once the self-crossing junctions landed.)
   *
   * THE NEWS IS LARGEST AT 0.70, NOT AT 1.00. K7's whole content is the paper
   * the break opens, and a MORE-carved mark leaves the break LESS to remove:
   * every radius in `buildJointBreaks` is the nib's, so the band narrows with
   * the carve at the same time as the ink it has to take away does. Driven on
   * the live beat over the shipped junction set, `assert-hero-k7-news`'s own
   * ink→paper count runs the WRONG way against the amplitude:
   *
   *     carve 0.70   278 px      carve 0.85   263 px      carve 1.00   242 px
   *
   * against that gate's 200 px floor — so 1.00 keeps 42 px of headroom and 0.70
   * keeps 78, on a number the whole return shot exists to carry.
   *
   * AND AT 1.00 THE MARK GOES WIRY. Measured with `assert-flat-silhouette`'s own
   * medial-width instrument on the live flat mark
   * (`scripts/verify/_probe-lane31-weight.mjs`, which also writes the 3x sheet
   * `docs/verification/hero-k7/lane31/weight-x3.png`):
   *
   *     carve   ink px    half-width  p10 / median / p90
   *     0.70    20 159        4.47 / 5.83 / 7.00
   *     0.85    18 530        4.00 / 5.10 / 6.40
   *     1.00    16 801        3.16 / 5.00 / 6.00
   *
   * The median loses 14 % but the TENTH PERCENTILE loses 29 % — the thin places
   * thin fastest, which is what "wiry" is: at 3x the `D` of *Desk* runs to a
   * wire at its top-left and the `e` bowls close toward slivers, while at 0.70
   * the bowl is still a bowl. 0.70 still clears `assert-flat-silhouette` at
   * 5.58x its noise floor (EMD 23.61 % against a 4.23 % value-only floor), so
   * nothing about "the flat state is not the tube" is given up for it.
   *
   * BOTH ENDPOINTS STAY ON THE DIAL. This is the value Sebs flips FROM, not a
   * decision taken for him: 1.00 is one drag away and `carveLaw: "prior"` is the
   * uncarved read, parked and selectable as ever.
   *
   * The intermediate values are not wasted — they are what makes the channel
   * animatable at all, and the parked `emerge.mode: "prior"` arm uses the whole
   * range (see `sampleForm`).
   */
  carveAmount: number
  /**
   * WHERE THE CAMERA IS AND WHETHER IT MOVES. See `HeroCamera` for the
   * diagnosis, the reference evidence and the three shots it cuts.
   */
  camera: HeroCamera
  /**
   * THE DESK ¾ POSE — C-B's whole framing, and C-C's second one.
   *
   * az 20° / el 30° is *a person looking at their own notebook*, and it is
   * picked for one measurable property as well as that read: the angle between
   * this view direction and dead-on is **35.5°**, which clears the 30-degree
   * rule by 5.5° and makes C-C's cut legal rather than a jump
   * (`storyboarding.md` §4). `assert-hero-options.mjs` computes that separation
   * off these two numbers rather than trusting this comment, so moving either
   * dial below 30° of separation fails the gate instead of silently shipping a
   * jump cut.
   *
   * el 30° also buys the thing C-A cannot have: `sin 30° = 0.50` of the contact
   * pool is visible, against `sin 0° = 0.00` dead-on and `sin 10° = 0.17` at the
   * shipped money frame. The shadow is the one cue the reference set says
   * carries a standing form — *"What makes it read as standing is entirely the
   * shadow"* (`online-reference-mechanics.md` §6.2, paper-street f95→f110).
   */
  deskAz: number
  deskEl: number
  /** WHICH FILM THE BEAT IS. See `HeroShape`. */
  shape: HeroShape
  /**
   * WHERE THE TURN LANDS, in degrees of the mark's OWN yaw. 0 = head-on, which
   * is the shipped turn exactly.
   *
   * 38° is `holdAz` re-read as an OBJECT pose instead of a camera pose — the one
   * number the shipped beat had that was worth keeping, because it is the angle
   * somebody already tuned by eye for "the best ¾ of this word". What changes is
   * who reached it.
   *
   * It is also the difference between a shot that tells something and one that
   * does not. §1.1 of the board, measured: the head-on solid IS the drawing —
   * the flat state's medial-axis half-width is *identical to the solid's to
   * three decimals* (7.07 px / 0.493 both), so K4's A/B compares two frames a
   * viewer cannot tell apart. A landing at 38° arrives already showing side
   * walls and foreshortening: on-screen width goes to `cos 38° = 0.788` of full,
   * which is a silhouette change of 21 % against the shipped beat's **zero**.
   */
  landYaw: number
  /**
   * O2'S STANDING ANGLE, degrees of hinge from flat-on-the-page.
   *
   * 78 and not 90. A word stood to a dead 90° at the desk ¾ viewpoint presents
   * its own EDGE to the camera — the thinnest read of a mark whose whole claim
   * in this shot is thickness and stature. Leaning it back off vertical keeps
   * the face legible while the side walls and the cast shadow do the standing.
   * The reference corpus's cut-outs all stop short of vertical for the same
   * reason.
   *
   * A dial, not a constant: it and `popStandFH` are the two numbers this film
   * is actually judged on, so both are reachable in the panel.
   */
  popStandDeg: number
  /**
   * O2'S STAND SPACING — the fraction of the hinge's TRAVEL spent in the first
   * half of its TIME. See `backLoaded` for the curve and for why the share
   * rather than an easing name is the parameter.
   *
   * 0.67 is `paper-street`'s measured cut-out stand, the only
   * flat-thing-stands-up in either corpus. 0.50 is the reference-legal fallback
   * the board names if 0.67 reads as performed — three frames of commit apart.
   */
  popStandFH: number
  /**
   * THE POP-IN'S OPENING SCALE — Exquisite Corpse's own number.
   *
   * Its sheet pop-in enters at 86 % and settles ease-out over 750 ms, spaced at
   * a value-half of **19.5 %** — squarely inside the arrival band, 9–37 %
   * (`reference-film-mechanics.md` §6.5). Both `solidFirst` and `cutaway` open
   * on a form that is simply THERE, so both use it: the scale is the settle that
   * makes an appearance read as an arrival rather than as a frame drop.
   *
   * It rides `squashX`/`squashY`, which are already pinned to the mark's own
   * CONTACT rather than its centre (`viewport-3d.tsx`, `c.y = box.min.y`) — so
   * the form settles ONTO the page instead of growing about its own middle.
   */
  popScale: number
  /** How long the pop-in takes to settle. EC's 750 ms. */
  popSettleSec: number
  /**
   * HOW LONG THE FRAME IS EMPTY — `cutaway`'s one idea, and its whole defence.
   *
   * 0.5 s / 15 frames. **Not two frames:** between two near-identical framings a
   * short gap is a jump cut, *"a device of disorientation"* (`storyboarding.md`
   * §4). At 500 ms it is a held breath instead — and the frame is not empty, it
   * is the page the drawing just left. The band is narrow and the board names
   * both walls: under ~350 ms it reads as a glitch, over ~700 ms as a stall.
   * EC's own absence is 625 ms at mad exactly 0.000 (`reference-film-mechanics`
   * §4.2).
   */
  absenceSec: number
  /**
   * `solidFirst`'s opening blank. 2 frames — `all4-idents` blanks exactly two
   * before every build (§7 row 6, f1501–f1502). Enough that the pop-in is an
   * arrival and not the first frame of the film.
   */
  openEmptySec: number
  /* ---- O5 · LETTER BY LETTER -------------------------------------------- */
  /**
   * HOW MANY LETTERS THE WORD CAME OUT AS — a MEASUREMENT, carried here so the
   * sampler can lay out the cascade without knowing about strokes.
   *
   * **10**: `D · e · sk · D · o · o · d · l · e · s`. `lib/hero-letters.ts` takes
   * connected components of the overlapping ink over Sebs's traced word and finds
   * exactly one fused run — the `s-k`, which is the shred zone board §4 O5 names
   * and the bound pair it sanctions in advance: *"the s and k may have to flip as
   * a bound pair (a content-double)."* One content-double in ten beats is the
   * board's own design; it is not a concession.
   *
   * ⚠ IT SAID EIGHT HERE AND IT RENDERED SIX, AND BOTH NUMBERS WERE THE SAME
   * DEFECT. This constant was measured on the RAW trace while the page measured
   * the same law on the HAND-FEEL-PROCESSED strokes, so the model gate and the
   * screen disagreed and neither knew. On the processed ink the protruded tails
   * reach into their neighbours and the law fused `esk`, `odl` and `es` — six
   * pieces for eleven letters, three of them flipping at once, twice. Sebs
   * watched that: *"they dont go letter by letter — some go multiple at a time."*
   * The full reasoning is at `app/desk-doodles/page.tsx`'s `letterMap`; what
   * belongs here is that **a default describing a different word than the page
   * renders is worse than no default**, because every model row then passes on a
   * film nobody can see.
   *
   * The page still overwrites this from the live word, so switching the source to
   * the FONT (whose authored map is 11) relays out the cascade. This default is
   * now the same number the traced page computes, so the model-only gate reads
   * the film that actually ships — `assert-hero-options.mjs` asserts that
   * agreement against the real letter law rather than restating the integer.
   */
  letterCount: number
  /**
   * WHERE THE WORD GAP FALLS — the letter after which the cascade takes one
   * SILENT beat, or −1 for none.
   *
   * Board §4 O5: *"The word gap (Desk · Doodles) gets one silent beat — the
   * hand's own grouping, respected."* **3** on the traced word, because
   * `D · e · s · k` is the whole of "Desk". It was 2 while two sub-nib taps
   * bridged the `s` to the `k`; `dropSubNibStubs` removed them on 2026-08-28 and
   * the two letters came apart. Measured off the pen's own paths by
   * `letterGapAfter`, not typed in.
   *
   * ⚠ IT WAS 1, AND ON THE PAGE THE DETECTOR WAS RETURNING 3 — a rest in the
   * middle of "Doodles". Same law, same word, read off the hand-feel-protruded
   * ink instead of the pen path: the protrusion shrinks the real word space more
   * than it shrinks the letter spaces, so the largest gap stopped being the word
   * gap. A silent beat in the wrong place does not read as a rest, it reads as a
   * dropped frame. `assert-hero-options.mjs` now asserts the 2.
   */
  letterSilentAfter: number
  /**
   * FROM WHICH LETTER THE FLIPS DOUBLE UP — two letters on one beat — or −1 to
   * keep one letter per beat for the whole cascade.
   *
   * The board's own late-cascade device: *"later beats flip PAIRS (oo, dl, es)
   * — EC's third shuffle beat doubles head+legs while the interval holds: 'The
   * rhythm doesn't accelerate; the content does.'"*
   *
   * −1 by default, and the reason is now a different and better one than it was.
   * It used to be *"the hand already did the doubling — three of the eight units
   * are fused runs"*, which was true of a map that fused letters the hand had
   * kept apart. On the corrected map the hand doubles exactly ONE unit, the
   * `s-k`, so there is no longer an already-doubled cascade to protect. −1 stays
   * the default because Sebs's complaint was *"they dont go letter by letter —
   * some go multiple at a time"*, and pairing is the control that puts multiple
   * back. It is a dial because on the font word (11 single letters) the board's
   * grouping is exactly `5`, and that is one drag away rather than a decision
   * taken for him.
   */
  letterPairFrom: number
  /**
   * THE SHARED LANDING YAW, degrees — the pose the whole rank settles at.
   *
   * Board §4 O5, and it is the design decision the option turns on: *"a letter
   * that lands head-on lands invisible. So the landing pose is the design
   * decision: every letter lands at a shared small object-yaw (~15–18°) — the
   * word ends as a rank of slightly-turned standing solids, side walls visible
   * dead-on, like wooden type on a shelf."*
   *
   * **30, and the board's own next sentence is why.** *"If it reads as a mistake
   * rather than a shelf of hand-cut letters, the yaw is too small; push it until
   * the side walls read."* That is an instruction to measure, and 16° had never
   * been measured — it was taken as the middle of a band.
   *
   * Measured on the live page at the parked dead-on camera, the held rank at
   * seven settings (`_probe-lane-o5-yaw.mjs`, stage crop, darkest decile of the
   * mark = the ink core):
   *
   *     landYaw      0     16     30     50     60     70
   *     ink core  29.2   29.9   30.4   30.6   30.5   30.4
   *     median    50.0   51.0   51.2   53.0   55.0   57.2
   *     mark px  24967  24649  23872  22124  20922  19513
   *
   * **The tone does not move.** 0° and 70° are the same rank to within 1.4 luma,
   * which kills the assumption underneath the 15-18° band: this mark is a round
   * ROD, and a rod turned about its own vertical axis has no side wall to
   * reveal. What the yaw does buy is a SILHOUETTE — the width falls 24 967 →
   * 19 513 px — and legibility is what limits it: at 50° the two `o`s of
   * "Doodles" start to collapse into one another and by 60° the word is no
   * longer the word.
   *
   * So 30° is the largest setting at which the rank still reads as "Desk
   * Doodles" while every letter is visibly turned, which is the whole of what
   * the board asked for. 16° remains one drag away and is not deleted; the dial
   * now runs to 70 rather than 45, because a ceiling on a control nobody had
   * measured was a ceiling on nothing.
   *
   * ⚠ AND IT IS NOT THE ANSWER TO "MUDDY" — BUT NEITHER IS THE THING I FIRST
   * BLAMED, AND THE CONTROL IS WHY.
   *
   * The rank was warm milky brown, which is exactly what "muddy" describes, and
   * a luma-only instrument could not see it: 0° and 70° differ by 1.4 luma, so
   * the number said "the yaw does nothing" while the picture plainly changed
   * between two films. Luma cannot tell warm brown from neutral graphite — they
   * sit at the same brightness. Measured as CHROMA instead
   * (`_probe-lane-o5-chroma.mjs`, max−min over the mark's own pixels):
   *
   *                        mean luma   chroma
   *     rank, first film        59.1    17.63
   *     rank, after            61.2     1.88
   *     FLAT INK, first film    28.8     7.80
   *     FLAT INK, after         29.1     0.00
   *
   * **The flat ink is the control and it moved too.** Nothing in this file, in
   * `hero-letters.ts` or on the page can tint the drawing before the cascade
   * starts, so the warm cast was the MATERIAL, and it was neutralised by another
   * lane's edits to `lib/style-system.ts` and `components/viewport-3d.tsx`
   * partway through this session. It is not this lane's fix and is not claimed
   * as one. On the current build the mark measures chroma 0.00 at every landing
   * yaw — neutral graphite, no cast.
   *
   * What the yaw is for, then, is the SILHOUETTE and nothing else: 24 947 →
   * 22 109 mark pixels across 0-50°, with legibility the ceiling.
   */
  letterLandYaw: number
  /**
   * THE CLEAN READ AFTER FLIP 1, seconds — *"20 fr / 667 ms — EC's own stagger,
   * measured exactly, twice."* The audience learns what a flip is on one letter
   * before the rhythm starts.
   */
  letterLeadSec: number
  /**
   * THE CASCADE INTERVAL, seconds. **14 frames = 466.7 ms** — Babbu's cascade
   * median, on the frame grid. Board: *"Interval locked at 460 ms, hand-feel
   * irregularity ±80 ms welcome."*
   *
   * ⚠ IT WAS 0.46 EXACTLY, AND THAT IS 13.8 FRAMES.
   *
   * The cascade is ONE EVENT REPEATED. An interval that is not a whole number of
   * frames starts each repeat at a different point between two frames, so the
   * 30 fps grid samples each flip at a different phase and **the same event has a
   * different shape every time it happens.** Measured on the shipped numbers
   * (`_probe-letter-frames.mjs`), the yaw each letter was actually drawn at:
   *
   *     letter 1   0  0  2 12 42 [90] 83 42 23 17 16
   *     letter 2   0  0  4 21 61 [90] 64 33 19 16 16
   *     letter 3   0  0  6 27 72 [90] 56 29 18 16 16
   *     letter 4   0  1  9 34 85 [90] 49 25 17 16
   *
   * Four different flips. Letter 1 jumps 42°→90° and comes back 83°→42°; letter
   * 4 rises 34°→85° and comes back 49°→25°. Nothing in the model asked for that
   * — it is the sub-frame offset drifting 0.8 of a frame per beat. That is what
   * *"feels like artifacting happens"* is: an event that should be a rhythm,
   * jittering.
   *
   * At 14 frames every beat starts on a frame, `letterLeadSec` is already
   * 20 frames, and `letterQuickSec` is now 12 — so every letter's flip is
   * sampled at exactly the same phase and is drawn identically, by construction.
   * `assert-hero-options.mjs` asserts that identity rather than trusting it.
   */
  letterBeatSec: number
  /**
   * FLIP 1'S OWN LENGTH, seconds — the ceremony, and the only flip that carries
   * the edge dwell.
   *
   * 18 frames. It is the BUILT turn scaled to a letter, which is the board's
   * exact instruction: the same `easeInOutCubic` angle, the same `|cos|` width
   * law, the same authored dwell at 90°, all of it compressed from the word
   * turn's 27.5 frames so the flip finishes inside its own 20-frame read.
   */
  letterFlipSec: number
  /**
   * EVERY OTHER FLIP, seconds. **12 frames = 400 ms.** No dwell: *"eleven dwells
   * would turn the signature into a flicker."*
   *
   * ⚠ IT WAS 292 ms, AND SEBS'S WORD FOR WHAT THAT LOOKED LIKE WAS "ABRUPT".
   *
   * 292 ms is the shorter of the reference set's two transition lengths
   * (`reference-film-mechanics.md` §6.3, transfer #10) and it sits inside board
   * §4 O5's 240–330 ms band, so the citation was sound. What nobody measured is
   * what 292 ms BUYS at 30 fps: 8.75 frames, minus the one-frame edge pin, is
   * 7.75 frames to carry 180° of turn. The bar is in the same file — the
   * whole-word turn, which reads, spends **13 turn frames + a 2-frame dwell and
   * never moves more than 29.8° between two frames on its way out** (38.0° is
   * its largest step anywhere in the film, and that one is the return, which is
   * authored to be four times faster — `assert-hero-options.mjs` uses the film's
   * own largest step as the bar so the row cannot be tuned by choosing a
   * window). The letter flip was moving **50.9°**, past both. It was the same
   * gesture at 58 % of the out-turn's angular resolution, and
   * the board's instruction is *"each letter-flip is the BUILT turn, scaled to a
   * letter"* — scaled in duration, not in how coarsely it is drawn.
   *
   * Swept against that bar (`_probe-letter-budget.mjs`), worst single-frame step:
   *
   *     flip frames    9      10     11     12     13     14
   *     worst step   52.0°  36.5°  43.9°  33.0°  37.9°  29.8°
   *
   * The zig-zag is not noise and it is the reason this is 12 and not 11 or 13:
   * `turnPhase` splices the pin at the midpoint, so the TURN gets `flip − 1`
   * frames, and only an ODD turn puts the frame grid symmetrically either side
   * of the 90° edge. Even turns land one sample hard against it and the step on
   * the far side doubles. 12 frames is an 11-frame turn.
   *
   * So: 33.0°, within 3.2° of the whole-word turn, at 400 ms. That is 70 ms over
   * the board's band for a quick flip, and the board's band is the price — this
   * is the case its own §4 O5 names from the other side (*"at that cadence the
   * eye registers THAT something changed, never WHAT"*), reached from below.
   *
   * It is 86 % of the interval, so a flip still finishes two whole frames before
   * the next one starts — simultaneity exactly 1, which is the rule this beat
   * learned the hard way when the pop-up ran two events in 15 frames.
   */
  letterQuickSec: number
  /**
   * THE QUICK FLIPS' EDGE PIN — ONE FRAME, and it is the difference between the
   * sliver existing and not existing.
   *
   * ⚠ THIS IS A DEFECT THE GATE CAUGHT, AND THE BOARD DOES NOT ASK FOR IT.
   * Board §4 O5 is explicit that only flip 1 gets a dwell: *"Only flip 1 gets
   * the dwell ceremony. Flips 2–11 are arrival-spaced, 240–330 ms each, no
   * dwell — eleven dwells would turn the signature into a flicker."* Built
   * exactly that way and measured at 30 fps, three of the eight letters never
   * got anywhere near their own edge:
   *
   *     letter        0      1      2      3      4      5      6      7
   *     narrowest  0.000  0.362  0.022  0.188  0.334  0.362  0.181  0.022
   *
   * 0.362 of a letter's width is not a sliver, it is a third of the letter. The
   * option's whole defence against the head-on trap is board §4 O5's *"each
   * letter's flip still slivers at ~14–24 px, the same event at a smaller
   * width"* — and on three letters that event was simply absent, decided by
   * where the 30 fps grid happened to fall relative to that letter's beat.
   *
   * IT IS THE SAME DEFECT THE WHOLE-WORD TURN ALREADY PAID FOR, one scale down.
   * `sampleEmerge`'s own note: *"u = local / 0.85 never lands on 0.5 at 30fps —
   * the narrowest frame reached sx 0.0905 and the beat spent ZERO frames at the
   * edge. The moment silently did not exist. A hold that only appears when the
   * frame rate cooperates is not a hold."*
   *
   * SO IT IS PINNED, NOT DWELT ON, AND THE DISTINCTION IS THE BOARD'S POINT.
   * One frame is not a ceremony — it is the guarantee that the pose is SAMPLED.
   * A half-open window exactly one frame wide contains exactly one point of the
   * frame grid whatever the offset, so every letter reaches exactly 90° on
   * exactly one frame, by construction rather than by luck. The ceremony flip
   * keeps its own two-frame dwell (`emerge.dwellSec`) and is still the only one
   * that reads as a HELD instant.
   *
   * It comes OUT of `letterQuickSec` rather than being added to it, so the flip
   * stays exactly the reference set's 292 ms transition and the board's
   * 240–330 ms band is not quietly exceeded. 0 restores the board's literal
   * instruction and is the control.
   */
  letterEdgePinSec: number
  /**
   * THE BEAT BETWEEN THE LAST LETTER AND THE WORD, seconds, counted from the
   * end of the letters' cascade (`cascadeSec`), inside the cascade's own clip:
   * his three calls, 2026-09-26, moved the word's turn into the clip so the
   * payoff hold is still. His ruling, 2026-09-26: *"each letter lands dead on,
   * facing front, turning about its own centre; one at a time; then the word
   * turns as one."* The letters land at yaw 0, so the rank reads as the drawn
   * word for these frames before anything else moves. 14 fr, one letter beat.
   */
  letterWordHoldSec: number
  /**
   * THE WORD'S OWN TURN, seconds: the whole rank, one rigid body on the word's
   * axis, from yaw 0 to `letterLandYaw` on `easeOutStrong`. This is the only
   * place the rank reaches its shared yaw. It used to be reached letter by
   * letter, each one gliding its pivot to the word's axis while it turned, and
   * that glide is what slid landed letters up to 9 px into their neighbours
   * (LETTERS, 2026-09-26). 18 fr, the same length as flip 1.
   */
  letterWordTurnSec: number
  ret: HeroReturn
  anticipation: {
    /** How long the tense takes to reach full compression. */
    compressSec: number
    /**
     * HOW LONG THE TENSION IS HELD — and it is a real number again.
     *
     * It was declared, defaulted, documented, printed in the panel with the
     * hint *"a squash that releases immediately reads as a wobble; the hold is
     * what makes it read as intent"* — and **nothing read it**. The sampler
     * compressed over `compressSec` and then sat at full tension until the
     * phase ended, so the hold's length was `beats.anticipation − compressSec`
     * and this dial was decoration. Found by the sweep in
     * `scripts/verify/assert-hero-dials.mjs`; same class as the dead
     * `pushScaleEnd` (§10.2 C2) and the dead `squashX/Y` (§11.4.3).
     *
     * It is wired rather than deleted, because the phase now has three parts
     * and the third one has to come from somewhere:
     *
     *     [ wait ][ compress ][ hold tension ] -> release, into the turn
     *
     * `compress` and `hold` are authored; `wait` is the clip's remainder, so
     * the timeline still owns the total and lengthening the clip buys lead-in
     * stillness rather than silently lengthening the tension. At the shipped
     * numbers 0.2 + 0.1 = 0.3 = the clip exactly, so `wait` is zero and the
     * beat is unchanged — the dials are live, the render is not different.
     *
     * If the two overrun the clip they are scaled down together rather than
     * clipped, so the shape survives a retime instead of losing its tail.
     */
    holdSec: number
    /**
     * HOW LONG THE RELEASE TAKES — and it happens INSIDE the turn, not before it.
     *
     * THE DEFECT THIS EXISTS TO FIX, measured on the shipped model at 30fps:
     * `squashY` went **0.9550 → 1.0000 in ONE FRAME** at the anticipation→emerge
     * seam (t 3.500 → 3.533, +4.71%), and confirmed on the capture's own pixels
     * as h 143 → 149 with cy 424.0 → 421.0. The turn's yaw at that frame was
     * **0.00°**, and stayed 0.00° for two more frames. So the tense snapped back,
     * and then, two frames later, the turn started.
     *
     * A wind-up that releases into nothing is not a wind-up — it is a twitch,
     * and it undoes the one thing K2 exists for: *"the audience has to know
     * something is about to happen before it happens, or the event reads as a
     * glitch"*. The release has to be the FIRST PART OF THE TURN, not a
     * separate event before it.
     *
     * THE LENGTH IS 292 ms, WHICH IS NOT A ROUND NUMBER AND NOT A GUESS. It is
     * the shorter of the reference set's only two transition lengths — *"292 ms
     * or 433–467 ms. Two values, used consistently. Nothing in between"*
     * (`reference-film-mechanics.md` §6.3, transfer #10). The beat already
     * spends the longer one twice, on `tilt` and `descend`; this is a small
     * local move and it gets the small local value.
     *
     * The upper bound is measured: the turn-out is 0.425 s, so 292 ms ends the
     * release at **68 % of the way to the edge**, with four frames of pure turn
     * after it. Nothing is still unwinding when the mark reaches edge-on, which
     * is the one frame in the beat that has to be the only thing on screen.
     *
     * THE CURVE IS EASE-IN, AND THAT IS THE WHOLE READ. A release that starts
     * fast is the twitch again, just smeared across five frames. This one holds
     * the tension while the turn is under way and *not yet visible* — `|cos|` is
     * flat at the top, so the 648 px word does not narrow by even one pixel
     * until frame 5 — and then lets go as the narrowing arrives. The mark is
     * pulled out of its crouch BY the turn instead of springing back before it.
     * The original flip has the same silent leading run and the storyboard
     * measures it (§10.2 C5: `w 409` held f140–f146, *"the six frames
     * immediately before the whip are indistinguishable from a hold"*).
     *
     * And that spacing is not a preference either. `t³`'s value-half is at
     * **79.4 %** of its own duration, which lands inside §6.5's measured
     * **wind-up band, 79–93 %** — the mode the reference set uses for exactly
     * this shape of event, *"the move holds near its start and then goes"*. A
     * wind-up releasing, spaced like a wind-up.
     *
     * MEASURED, on the shipped twos exposure: the largest single-exposure step
     * in `squashY` falls from the prior law's **0.0450 out of a dead hold** to
     * **0.0192 inside an accelerating series** (0.0001 → 0.0095 → 0.0192), and
     * the first step is 0.5 % of the largest rather than 100 % of it. A step out
     * of stillness reads as a pop; the same size step inside a move that is
     * speeding up reads as speed.
     *
     * Clamped to the turn-out regardless of what this dial is set to, so it can
     * never outlive the half-turn it is released into.
     */
    releaseSec: number
    /** Tenses DOWN into the page. */
    scaleY: number
    /** Slight widen — volume preserved, like a real squash. */
    scaleX: number
  }
  /**
   * HOW MUCH OF THE DRAW-IN'S PLAYHEAD IS LINEAR — and it should now be ALL of
   * it, because the onset and the settle moved into the recording.
   *
   * `drawEase(t) = blend·t + (1−blend)·easeInOutSine(t)` warps the playhead
   * BEFORE `revealDistanceFraction` maps it onto the pen's own recorded timing
   * (`app/desk-doodles/page.tsx` -> `viewport-3d.tsx`'s reveal). At 0.45 that warp departs
   * from linear by **5.79%** at t = 0.78, measured off the curve.
   *
   * IT WAS CORRECT AND IT STOPPED BEING CORRECT. The trace's timestamps used to
   * be synthesised at a flat 12 ms per point on a 4 px arc-length grid — the
   * pen moved at exactly one speed for the whole word, `r(length, duration) =
   * 0.9986` where 1.0000 is a machine (`pen-reveal.ts`'s pen-clock block). With
   * a flat recording `penTimeDistanceFraction(t) == t`, the reveal map was a
   * no-op, and this sine WAS the beat's only touch-down and lift.
   *
   * The recording is real now. `measureTimingCharacter` over the strokes the
   * page builds reads **usable, maxDeviation 8.46%, present** — the pen's own
   * hesitations and flicks are in the data. So the sine is a SECOND cushion on
   * top of a first, and at 5.79% against 8.46% it is not a rounding correction:
   * it is 68% the size of the signal it sits on.
   *
   * That is the compounding trap this board already names once, on the turn —
   * B1: *"`|cos|` is already slow at the ends and fast in the middle. Easing
   * the angle on top of that stacks two cushions."* Same defect, different
   * channel. 1.0 hands the whole character to the recording.
   *
   * ⚠ ONE CAVEAT, AND IT IS WHY 0.45 STAYS REACHABLE RATHER THAN BEING DELETED.
   * `revealDistanceFraction` short-circuits on `revealMode: "smooth"` —
   * *"if (mode === 'smooth') return timeFrac"* — so on that pill the pen record
   * is bypassed entirely and 1.0 leaves the draw perfectly linear with no
   * touch-down at all. `"hybrid"` is the shipped default and `"smooth"` is a
   * reachable one, so the prior 0.45 is the read to type back if that pill is
   * ever made the default.
   */
  drawLinearBlend: number
  /*
   * `pushScaleEnd` USED TO LIVE HERE AND IS GONE — §10.2 C2, actioned.
   *
   * It was a dial named for a claim that is false. Its comment read *"Tiny push
   * over the hold so the frame is never static"*, which is the Ken-Burns claim,
   * and 114 seconds of reference film contains no such thing: of the six still
   * passages the mechanics doc names, three have per-frame translation columns
   * that are EXACTLY ZERO on every frame and the other three carry one or two
   * nonzero frames out of 104, 199 and 235 — isolated spikes, never a sustained
   * series (`reference-film-mechanics.md` §2.1).
   *
   * REMOVING IT PARKS NOTHING, WHICH IS WHY IT COULD GO. It had no consumer
   * that rendered — verified again by grep across `lib/`, `components/`,
   * `app/` and `scripts/` before deleting it — so there is no behaviour to
   * keep reachable and no read for Sebs to lose. What it had was reach: C2's
   * whole point is that *"a named, defaulted, documented dial whose stated
   * purpose is 'the frame is never static' is an instruction to the next
   * person, and the next person will wire it."*
   */
  emerge: HeroEmerge
}

/**
 * HOW A FLAT MARK BECOMES AN OBJECT.
 *
 * Two things have to change, and the whole quality of the beat is in the fact
 * that they do NOT change together.
 *
 *   DEPTH  — the mark stops being zero-thickness. Physical event.
 *   LIGHT  — the surface stops being a constant-value silhouette and starts
 *            being shaded. Optical consequence of the first.
 *
 * Firing them simultaneously reads as a switch being thrown. Letting the depth
 * lead by a stagger makes the light read as CAUSED by the volume rather than
 * co-incident with it — the same reason a group entrance is staggered by
 * 30–80ms instead of arriving as a block. `lightLagSec` sits in that band.
 *
 * The light also OUTLASTS its own beat, finishing about a third of the way into
 * the tilt. That is deliberate. Head-on, depth is nearly invisible — a tube
 * seen down its own axis has the same outline whether it is 1mm or 10mm thick.
 * The volume only becomes legible once the viewpoint rakes, so the surface is
 * still resolving as the camera starts to move and the emerging highlights are
 * something the tilt REVEALS rather than something it arrives to find finished.
 */
export interface HeroEmerge {
  /** How far past full depth the ink swells before settling, as a fraction. */
  overshoot: number
  /** How long the light lags the depth. The stagger that makes it read as caused. */
  lightLagSec: number
  /** How long the surface takes to go from constant ink to fully lit. */
  lightSec: number
  /**
   * How flat "flat" is: the form's depth multiplier at the start of the beat.
   * Exactly 0 collapses the mesh to a degenerate plane; a hair above it keeps
   * the winding valid while staying visually indistinguishable from zero.
   */
  flatDepth: number
  /**
   * WHICH BEAT THE EMERGE IS.
   *
   * `turn`  — the mark turns to edge-on and back, and the change of state
   *           happens AT the edge. The beat has a moment.
   * `prior` — the ramp this beat used to be: depth swells and the light comes
   *           up over 0.54s with the camera parked and the silhouette
   *           pixel-identical throughout. PARKED, not deleted: it is the arm
   *           the gates' negative control runs on, and it is what "not ugly,
   *           just lame" refers to.
   */
  mode: "turn" | "prior"
  /**
   * The shade term, ported from `compose.ORIGINAL-FLIP.mjs:200` —
   * `shade = 0.35 * (1 - sx)`. The face darkens as it turns away.
   *
   * It is not decoration. During the flat half the whole shading model is
   * collapsed by design (a drawing has no shading), so without this term a
   * turning flat face reads as a picture being SQUEEZED rather than a surface
   * catching light at an angle. Measured live against the original film it
   * tracks its own law to within about 1 luma across the readable part of the
   * turn, so it is already paid for and already correct.
   */
  turnShade: number
  /**
   * The edge-on floor, as a fraction of full width. The original clamps its
   * fake sliver here — `sx = Math.max(Math.abs(Math.cos(angle)), 0.035)` — so
   * an edge-on sliver always survives and the eye is never handed a blank frame
   * it can call a cut.
   *
   * IT IS A SAFETY NET HERE, NOT THE MECHANISM. In the original the sliver is a
   * squeezed raster of a flat image and the clamp is the only thing keeping it
   * on screen. Here the mark is the real form, really turned, so at edge-on
   * what shows is its actual thickness — the payload, not a hiding place. The
   * clamp stays because a degenerate projection is still possible at exactly
   * 90°, and "never a blank frame" is the first of the three numbers the
   * storyboard says a rebuild must not lose.
   */
  edgeFloor: number
  /**
   * How long the mark holds at edge-on. THE MOMENT ITSELF.
   *
   * Two frames at 30fps. One frame is 33ms and reads as a dropped frame; two
   * frames is 67ms and reads as a beat — "the dwell is what makes it an event
   * rather than a glitch". The original's two dwell frames are byte-identical
   * and this one is frozen for the same reason.
   *
   * It is a DURATION, not a frame count, because the beat runs on a continuous
   * clock: expressed in frames it would silently vanish at any other frame rate,
   * which is measurably what happened before this was split out.
   */
  dwellSec: number
}

/**
 * THE RETURN — and what "a CHANGED flat" is allowed to be.
 *
 * §10.5 call 1 recommends returning to a *changed* flat, and it attaches a hard
 * constraint that decides how the shot can be built at all:
 *
 *   *"the change must be **occlusion** — a break in the under-stroke, paper
 *    showing through — and **never shading**. A value difference at a crossing
 *    breaks gate 1 (flat ink SD < 1), which is non-negotiable. An occlusion gap
 *    leaves every remaining ink pixel at one value, so it passes."*
 *
 * That constraint is right, and `online-reference-mechanics.md` §9.1 found the
 * genre reaching the same answer independently: `origami-logo-fold` modifies a
 * settled flat state twice and both times the mechanism is an occluder
 * retracting, measured against BOTH a rotation control and a shift control on
 * 14 of 14 frames. *"The genre's own answer to 'how do you change a flat state
 * without shading it' is: put an occluder over it and take the occluder away.
 * The card never changes. What changes is how much of it you are allowed to
 * see."*
 *
 * WHAT THE CHANGE CANNOT BE, MEASURED ON OUR OWN MARK.
 * The board names the change as *"the crossings resolve into over/under"*.
 * Run over the real traced word (`scripts/capture/logo-strokes.json`, 22
 * strokes / 1078 points / 1099 units wide), a true centreline crossing test
 * finds **exactly one** intersection in the entire word — stroke 10 against
 * stroke 11 at (583, 75) — and stroke 11 is a three-point tick spanning four
 * units. There is no X-junction in this mark for an over/under to resolve at.
 * §9.1 independently reports the same absence from the other side: *"Not one
 * instance anywhere of a mark occluding itself at a crossing. The proposal that
 * K7's news be an over/under resolution has support for its mechanism and none
 * for its specific form."*
 *
 * WHAT IT IS INSTEAD, AND IT IS THE SAME MECHANISM.
 * The word is 22 pen strokes that the hero's implicit surface deliberately
 * FUSES into one watertight mass — that is what `HERO_INFLATE.fusion:
 * "implicit"` is for, so *"a crossing IS one merged mass with a fillet"*
 * (`app/desk-doodles/page.tsx`). Run over the PROCESSED strokes — the same arrays the geometry
 * is built from, through the same `processStroke` call — **22 pairs of strokes
 * come within one ink diameter of each other**, spread across the whole word
 * (`scripts/verify/_probe-hero-junctions.mjs`; 18 at half that distance, 29 at
 * one and a half, so the number is a property of the handwriting and not of the
 * threshold). At K1 they are invisible: the mark is one blob and the 22
 * separate acts of the hand are gone. At K7 each junction opens a hairline of
 * paper, with the LATER-drawn stroke in front — so the drawing comes back
 * carrying its own pen order.
 *
 * Same mechanism (an occluder, and paper where ink was), same one ink value
 * everywhere, no value difference anywhere — and the claim it makes is the
 * product's own: your hand came back legible.
 *
 * ⚠️ THE RENDERER MUST DO THE OTHER HALF. This file owns the CHANNEL and its
 * timing. Opening the break is a flat-ink render capability that lives in
 * `components/viewport-3d.tsx`, which this lane does not own. The contract is
 * in the return; nothing here reaches into it.
 */
export interface HeroReturn {
  /**
   * `changed`   — the return turn runs and the flat mark comes back with its
   *               junctions open. §10.5 call 1's recommendation.
   * `identical` — the return turn runs and the flat mark comes back
   *               pixel-identical, which is what the original flip does
   *               (`traced.tsv` f140–146 and f244–275 are the same numbers).
   *               Sebs's other branch, kept reachable rather than argued about.
   * `prior`     — there is no return: the beat ends hanging on the ¾, which is
   *               what shipped. PARKED, not deleted; it is the negative control
   *               the return assertions run against.
   */
  mode: "changed" | "identical" | "prior"
  /**
   * The paper break at each junction, as a fraction of the ink diameter.
   *
   * 0.35 is the drawing convention's own weight — enough to read as a lift, far
   * too little to read as a broken line. It is expressed as a RATIO because the
   * ink diameter is itself derived from stroke-coordinate space
   * (`flat-ink.ts:97`, `INK_DIAMETER_IN_STROKE_SPACE = 22`), so a pixel value
   * would drift the moment the word or the viewport changed size.
   */
  breakK: number
}

export const DEFAULT_HERO_MOTION: HeroMotionParams = {
  fps: 30,
  beats: {
    // 140 frames — 4.667s. SEBS'S OWN COMPLAINT, CLOSED: *"the fucking drawing
    // is fast and janky."*
    //
    // THE NUMBER IS NOT A THRESHOLD, IT IS THE RECORDING'S OWN CLOCK.
    // `measurePenRecord` over the strokes the page actually builds
    // (`stampPenClock(logo-strokes.json, "lognormal")`, app/desk-doodles/page.tsx) returns
    // `durationSec 16.805` — the Sigma-Lognormal reconstruction's own answer to
    // how long this word takes to write, 1.26s of it pen-up. At the prior 2.13s
    // the beat played that in a fifth of the time: **a 7.9x speed-up of a real
    // hand**, which needs no threshold argument at all.
    //
    // 4.667s IS DEFINED, NOT PICKED. It is the length at which the pen's own
    // median stroke lands exactly on the **100ms floor** that
    // `docs/research/handwriting-variability.md` §3 takes from Djioua &
    // Plamondon: *"Movement time is typically 100–500 ms, with the velocity peak
    // about 100 ms after t0."* The record's median stroke is 360.2ms, and
    // 4.667/16.805 x 360.2 = 100.0ms. Re-derivable:
    // `node scripts/verify/_probe-hero-drawspeed.mjs`.
    //
    // ⚠ TWO MEDIANS ARE IN CIRCULATION FOR THIS BEAT AND THEY ARE BOTH REAL.
    // Measured first-hand through the live chain — `drawEase` ->
    // `revealDistanceFraction` at the shipped `revealMode: "hybrid"` /
    // `hybridBlend 0.4` (viewport-3d.tsx:4187-4188):
    //
    //   beats.draw   ON SCREEN shortest / median   RECORDx shortest / median   beat     still
    //     2.133s          21.5ms /  76.0ms            30.6ms /  45.7ms       9.83s    44.1%
    //     4.667s          47.1ms / 166.3ms            66.9ms / 100.0ms      12.37s    34.8%
    //     6.970s          70.4ms / 248.3ms           100.0ms / 149.4ms      14.67s    29.3%
    //
    // ON SCREEN is what draws. RECORDx is the pen's own timing scaled by the
    // speed-up, which is the right unit for "how much faster than the real
    // hand" and the WRONG one for "what is on screen" — the shipped reveal
    // blends 40% toward constant speed, so it lengthens the strokes the hand
    // rushed. Quote whichever you mean, and say which.
    //
    // ✗ THREE NUMBERS THAT USED TO SIT HERE ARE FALSIFIED, and they are left
    // named rather than quietly overwritten. This comment claimed 6.97s leaves
    // the shortest stroke at **5.6ms** and that clearing the floor on it "needs
    // beats.draw near 124 SECONDS". Measured: at 6.97s the shortest stroke is
    // **100.0ms on the record scale** — 6.97s is precisely the length that puts
    // the SHORTEST stroke on the floor, the same construction 4.667s applies to
    // the median. The old figure was almost certainly an unrelated probe's
    // "worst 5.61 px" read as milliseconds. It also claimed 4.67s gives a
    // 160.9ms median and 37.2% stillness; the chain measures 166.3ms and the
    // ledger 36.1%.
    //
    // 6.97s IS STILL REJECTED — on the other constraint, not on that one. Read
    // stillness falls to **30.5%**, below the **36%** bar C8 takes from
    // Exquisite Corpse's own payoff unit, and that bar is the thing §10.3's
    // whole frame ledger was built to hold.
    //
    // ⚠ AND 4.667s CLEARS IT BY ONE THIRD OF A FRAME. 36.1% against 36%. Any
    // change that moves the frame count moves this, so re-run
    // `assert-hero-ledger.mjs` after touching any beat. Two things worth
    // knowing before anyone reaches for headroom: `draw` is deliberately NOT in
    // `PARKED_PHASES` (adding it reads 58.8%, but quantising the draw quantises
    // the handwriting, and that is a hand-feel call nobody has taken), and the
    // payoff unit C8's bar is actually about measures 58.0% still and does not
    // move by one frame however long the draw runs.
    draw: 140 / 30,
    // THE HOLD BEFORE THE MOMENT, and it is now the beat's LONGEST hold rather
    // than its shortest. It was 0.5s, sized against "cuts land on motion, never
    // on stillness" — a rule 114 seconds of reference film disproves outright
    // (reference-film-mechanics §2.2, §9). The corrected rule points the
    // opposite way: an accent is bought with a HOLD, and the two biggest
    // accents in the reference set are preceded by 4292ms and 2586ms of frozen
    // frame. This sits immediately before the beat's only moment, so it is the
    // one hold that has to be long. 33 frames at 30fps.
    breath: 1.1,
    // THE TURN, PLUS ITS DWELL. The turning portion is the ported `FLIP = 0.85`
    // (compose.ORIGINAL-FLIP.mjs:30) — 0.425s per half-turn, 13 frames at
    // 30fps, which is the number B1's 87% breakdown needs in order to be
    // expressible at all. At 5 frames the breakdown lands at frame 4.35, so the
    // whip gets 0.65 of a frame and what renders is four frames of narrowing
    // and then a jump.
    //
    // + 2/30s of dwell at edge-on = 0.9167. The dwell is added to the beat
    // rather than taken out of the turn, so the ported 0.85 stays whole.
    // The old 0.54 was the crossfade's duration and had no turn in it at all.
    emerge: 0.85 + 2 / 30,
    // 9 frames, and the phase IS the shadow's landing: 4 frames of lag + 5
    // frames of easeOutStrong = 0.30s exactly. §7's "land + settle" row.
    land: 9 / 30,
    // 18 frames — K4, the A/B frame, held. §7 f120-137.
    solid: 18 / 30,
    // 13 frames = 433ms. It was 0.70s, and 700ms was the ONE row in the whole
    // beat outside the reference set's transition band — *"292 ms or
    // 433–467 ms. Two values, used consistently. Nothing in between"*
    // (mechanics §6.3, transfer #10). It is now the same length as `descend`,
    // which is the move that undoes it: the beat's two camera transits are one
    // length, in and out, and that is authored rather than coincidental.
    //
    // The duration was never the tilt's main defect — `easeInOutStrong` was
    // (velocity peak at 52% of the move, rise/decay 0.91×, i.e. spaced 50:50,
    // the exact defect §10.5 call 3 removed from the rise and left here). But
    // shortening it is what makes the illegible pass short as well as fast:
    // measured on the model, frames at under 60% of full mark height fall from
    // 16 to 9, and 0.53s of the beat spent unreadable falls to 0.30s.
    tilt: 13 / 30,
    // 9 frames, matching §7 f90-98 exactly: compress over 6 (0.2s), hold 3
    // (0.1s). It was 0.36 (10.8 frames), which is 0.36 of a frame of hold more
    // than the sheet asks for and no reason on the board for it.
    anticipation: 9 / 30,
    standup: 1.4,
    // 28 frames — K6, and it is now a DEAD HOLD rather than 3.2s of drift.
    // §10.2 C1: the drift is *"a device with no basis in the reference set"*,
    // and §10.3's ledger prices K6 at 28 with the azimuth folded into the rise.
    // 0.93s also sits inside the online set's own payoff-hold band's floor
    // region; the money frame is the one shot this beat can afford to lengthen
    // if Sebs wants the 1.7-3.3s the template genre spends (§5 there).
    orbit: 28 / 30,
    // 13 frames = 433ms — one of the reference set's only two transition
    // lengths (mechanics §6.3). See `HeroBeats.descend`: NOT in the board.
    descend: 13 / 30,
    // The return turn is the emerge's own length, because it is the same turn.
    returnTurn: 0.85 + 2 / 30,
    // 11 frames — K7. §10.3's ledger. Was 0.9s of ¾ that nothing arrived into.
    hold: 11 / 30,
  },
  lieEl: 65,
  standupAz: 30,
  standupEl: 10,
  holdAz: 38,
  holdEl: 10,
  fillLie: 1.0,
  fillStand: 0.86,
  fillHold: 0.8,
  backC1: 1.70158,
  // The value the rise was already reading off `emerge.overshoot`, so the split
  // changes no frame. See `riseOvershoot`.
  riseOvershoot: 0.1,
  releaseLaw: "overlap",
  riseCurve: "riseOut",
  // 6 frames of 42 at 30fps. The reference set's acceleration is ~4 frames; the
  // gather has to go out AND back inside its own span, so it gets a little more.
  riseGatherFrac: 0.14,
  // Matches the counter-dip `easeInOutBack(c1 = 1.70158)` already produced, so
  // the anticipation reads the same depth it always did — only its SHARE of the
  // beat changes.
  riseGatherDepth: 0.1,
  driftCut: 0.7,
  cameraPark: "parked",
  tiltLaw: "handover",
  descendLaw: "accelerated",
  // Babbu's dolly: 4 frames of acceleration inside a 21-frame slide (§6.2).
  moveAccelFrac: 4 / 21,
  cadence: "twos",
  cadenceHz: 12,
  shadowLaw: "lands",
  // 4 frames at 30fps — §7's "~4 frames behind the face", which is the
  // 50-100ms secondary-action offset.
  shadowLagSec: 4 / 30,
  // 5 frames. Lag + landing = 9 frames = the `land` beat exactly.
  shadowSec: 5 / 30,
  carveLaw: "pen",
  // 0.70, not 1.00 — the news is LARGEST here and the mark keeps its pen
  // weight. See `carveAmount` for the measurement and for why more carve buys
  // less news. The pick is Sebs's; this is the value he flips from, 1.00 is one
  // drag away on the dial, and the prior read is `carveLaw: "prior"`.
  carveAmount: 0.7,
  // THE SHIPPED FOUR-MOVE CAMERA IS THE DEFAULT, DELIBERATELY. Every camera
  // assertion in scripts/verify/ reads DEFAULT_HERO_MOTION, so flipping this
  // default is a pick with a regression bill attached, not a tidy-up. The three
  // parked laws are one click away in the panel. See `HeroCamera`.
  camera: "prior",
  // A person looking at their own notebook — and 35.5 deg from dead-on, which
  // is what makes C-C's cut legal. See `deskAz`.
  deskAz: 20,
  deskEl: 30,
  shape: "shipped",
  // `holdAz` re-read as an object pose. 0 is the shipped turn, byte for byte.
  landYaw: 38,
  // O2's hinge. 78° keeps the face legible at the desk ¾ while the side walls
  // and the shadow carry the stature; 0.67 is paper-street's measured spacing.
  // Both are dials — see their docs on `HeroMotionParams`.
  popStandDeg: 78,
  popStandFH: 0.67,
  // Exquisite Corpse's sheet pop-in: 86%, 750ms, value-half 19.5%.
  popScale: 0.86,
  popSettleSec: 0.75,
  // 15 frames. Under ~350ms it is a glitch; over ~700ms it is a stall.
  absenceSec: 0.5,
  // 2 frames — all4-idents blanks exactly two before every build.
  openEmptySec: 2 / 30,
  /* O5. ELEVEN, and it was TEN until the stub filter landed on 2026-08-28.
   * `lib/pen-reveal.ts`'s `dropSubNibStubs` removes the nine accidental taps the
   * trace kept, and two of them were BRIDGING the `s` to the `k`: measured on the
   * pen's own paths, `assignLetters` returns
   * [0,1,2,3,3,4,5,6,7,8,9,10,10] over 13 strokes — D · e · s · k · D · o · o ·
   * d · l · e · s, every letter of "DeskDoodles" its own piece. The `s-k` bound
   * pair board §4 O5 sanctions is no longer needed; the hand did not fuse them,
   * two dots did. Still measured, never counted off the alphabet, and the page
   * still overwrites it from the live word. */
  letterCount: 11,
  /* "Desk" is now four pieces rather than three, so the word gap is after unit
   * 3. Same law, same measurement (`letterGapAfter` returns 3), moved by the
   * same filter. */
  letterSilentAfter: 3,
  // Only one unit is doubled and the hand did it; see `letterPairFrom`.
  letterPairFrom: -1,
  // 30, not the board's 16 — the board's own instruction, executed against a
  // measurement of what 16 actually bought. See `letterLandYaw`.
  letterLandYaw: 30,
  // 20 fr — Exquisite Corpse's own stagger, measured exactly, twice.
  letterLeadSec: 20 / 30,
  // 14 fr = 467 ms. Babbu's cascade median is 460; this is that number ON THE
  // FRAME GRID, which is the half of it that was missing. See `letterBeatSec`.
  letterBeatSec: 14 / 30,
  // 18 fr — the built turn scaled to a letter, dwell included.
  letterFlipSec: 18 / 30,
  // 12 fr. Was 292 ms = 8.75 frames, which is not a number of frames. See
  // `letterQuickSec` for the 50.9 deg single-frame step that bought.
  letterQuickSec: 12 / 30,
  // ONE FRAME, taken out of the 292 ms. Not a dwell — the guarantee that the
  // edge is sampled at all. See `letterEdgePinSec` for the three letters that
  // measured 0.36 of their own width without it.
  letterEdgePinSec: 1 / 30,
  // 14 fr, one letter beat: the word holds dead on before it turns as one.
  letterWordHoldSec: 14 / 30,
  // 18 fr, flip 1's length: the rank turns to `letterLandYaw` as one body.
  letterWordTurnSec: 18 / 30,
  ret: { mode: "identical", breakK: 0.35 },
  anticipation: {
    compressSec: 0.2,
    // 3 frames. §7 f96-98. Was 0.16. 0.2 + 0.1 is the anticipation clip exactly,
    // so the lead-in wait is zero and the tense is unchanged by being wired.
    holdSec: 0.1,
    // 292ms — the shorter of the reference set's only two transition lengths
    // (mechanics §6.3, transfer #10). Ends at 68% of the way to the edge.
    releaseSec: 0.2917,
    scaleY: 0.955,
    scaleX: 1.018,
  },
  // 1.0 — the playhead is not warped at all, so every hesitation and flick in
  // the draw comes from the pen recording rather than from a sine stacked on
  // top of it. Prior value 0.45, which departs 5.79% from linear; see
  // `drawLinearBlend` for the measurement and for the one pill that still wants
  // it.
  drawLinearBlend: 1.0,
  emerge: {
    overshoot: 0.1,
    lightLagSec: 0.08,
    lightSec: 0.7,
    flatDepth: 0.004,
    mode: "turn",
    turnShade: 0.35,
    edgeFloor: 0.035,
    dwellSec: 2 / 30,
  },
}

/* ---- the exposure sheets -------------------------------------------------- */

/** The ported half-turn plus its authored dwell — 0.85 s + 2 frames. */
const TURN_SEC = 0.85 + 2 / 30
/**
 * A phase that a shape CUT, expressed as one frame rather than as zero.
 *
 * §0.7 says a cut is a park, never a deletion, and on this page that has a
 * second, practical half: the timeline dock owns these durations and a clip of
 * width zero cannot be grabbed. A one-frame clip is still there, still
 * draggable, and still says on the sheet that the shot was considered and
 * spent. Three of them cost 0.1 s.
 */
const CUT = 1 / 30

/**
 * THE FOUR FILMS, AS FOUR EXPOSURE SHEETS.
 *
 * These are the board's own frame budgets (`hero-animation-options-board.md`
 * §4), not new numbers — each row below cites the line it comes from. They are
 * seconds rather than frames because the beat runs on a continuous clock and a
 * frame count silently changes meaning at another rate; the comments carry the
 * frame counts at 30 fps, which is what the board budgeted in.
 *
 * ⚠ THE TIMELINE OWNS DURATIONS AND THIS TABLE DOES NOT FIGHT IT. The page
 * WRITES a sheet into the dock when the film changes and then reads the dock,
 * exactly as it always has — so there is still one owner and one number per
 * beat. Picking `shipped` writes the shipped sheet back, so the row is
 * reversible and nothing about a retime is destroyed except by the next pick.
 */
export const HERO_SHEETS: Record<HeroShape, Readonly<Record<HeroPhase, number>>> = {
  /** The beat as it ships — derived from the defaults so there is one source. */
  shipped: { ...DEFAULT_HERO_MOTION.beats },
  /**
   * O1 — board §4 O1: *"140 + 33 + 9 + 15 + 13 + 8 + 60 + 28 + 33 ≈ 339 fr /
   * 11.3 s"*. The 15 + 13 is the turn-out-plus-dwell and the land, which is one
   * `emerge` clip here; `land` keeps the board's 8 frames as the settle after
   * the pose (its shadow beat is CUT, not faked — see `shadowAt`). The four
   * camera phases go to one frame each, which is the 3-frame difference between
   * this sheet's 342 and the board's 339.
   */
  turnLands: {
    draw: 140 / 30,
    breath: 33 / 30,
    anticipation: 9 / 30,
    emerge: TURN_SEC,
    land: 8 / 30,
    solid: CUT,
    tilt: CUT,
    standup: CUT,
    // 60 frames / 2.0 s — inside the online set's payoff-hold band, 1.7-3.3 s
    // (`online-reference-mechanics.md` §5). The shipped beat holds 0.93 s.
    orbit: 60 / 30,
    descend: CUT,
    returnTurn: TURN_SEC,
    hold: 33 / 30,
  },
  /**
   * O4 — board §4 O4: *"2 + 18 + 45 + 28 + 33 + 8 + 40 ≈ 174 fr / 5.8 s. Short,
   * and deliberately: nothing here has a draw."* The 2 + 18 is the empty page
   * and the pop-in settle, which live inside the `draw` clip; the trailing
   * 33 + 8 + 40 is one held flat with the breaks opening in it, which is `hold`.
   */
  solidFirst: {
    draw: 20 / 30,
    breath: 45 / 30,
    anticipation: CUT,
    emerge: CUT,
    land: CUT,
    solid: CUT,
    tilt: CUT,
    standup: CUT,
    orbit: CUT,
    descend: CUT,
    returnTurn: TURN_SEC,
    hold: 81 / 30,
  },
  /**
   * O6 — board §4 O6: *"≈ 336 fr / 11.2 s"*. `emerge` carries the absence
   * (15 fr) plus the pop-in settle (22 fr); `land` is the 333 ms clean read;
   * `solid` is the 2.0 s payoff hold; `descend` is the closing absence.
   */
  cutaway: {
    draw: 140 / 30,
    breath: 45 / 30,
    anticipation: CUT,
    emerge: 37 / 30,
    land: 10 / 30,
    solid: 60 / 30,
    tilt: CUT,
    standup: CUT,
    orbit: CUT,
    descend: 10 / 30,
    returnTurn: CUT,
    hold: 33 / 30,
  },
  /**
   * O2 — board §4 O2: *"10 + 140 + 33 + 9 + 3 + 15 + 66 + 13 + 30 ≈ 319 fr /
   * 10.6 s"*. The mapping onto the shared phase list:
   *
   *   `draw`   the 10-frame page establish + the 140-frame draw. They are one
   *            clip because the establish is simply the reveal at 0 — the desk
   *            angle is already set, which is the point.
   *   `breath` the flat held, 33.
   *   `anticipation` the press, 9 — and at this viewpoint it visibly flattens
   *            AGAINST the ground, which is the one shot the dead-on films
   *            cannot buy.
   *   `emerge` THE STAND, 15 fr / 500 ms. The board's 3-frame contact beat sits
   *            inside it rather than as its own phase, because a phase boundary
   *            there would put a quantisation edge in the middle of the hinge.
   *   `solid`  THE HOLD standing, 66 fr / 2.2 s — the money frame, inside the
   *            online set's 1.7-3.3 s payoff band.
   *   `returnTurn` the lie-back, 13 fr, arrival-spaced.
   *   `hold`   flat again with the joint breaks open, 30.
   *
   * `land`, `tilt`, `standup`, `orbit` and `descend` are CUT: four of them fly
   * the camera, and this film's whole claim is that the camera never moves.
   */
  popUp: {
    draw: 150 / 30,
    breath: 33 / 30,
    anticipation: 9 / 30,
    emerge: 15 / 30,
    land: CUT,
    solid: 66 / 30,
    tilt: CUT,
    standup: CUT,
    orbit: CUT,
    descend: CUT,
    returnTurn: 13 / 30,
    hold: 30 / 30,
  },
  /**
   * STAND & TURN — the pop-up's sheet with a turn spliced into its hold.
   *
   *   `emerge`  the stand, 15 fr, identical to O2's.
   *   `solid`   the first hold, 45 fr / 1.5 s — standing, dead still. Long
   *             enough to read as a held pose rather than as a pause between
   *             two moves, which is what makes the turn land as a SECOND
   *             piece of news instead of a continuation of the first.
   *   `orbit`   THE TURN, 20 fr, the object rotating on its own axis. Its
   *             seconds were the shipped film's camera orbit; here the camera
   *             is parked and the OBJECT spends them.
   *   `descend` the payoff hold at the ¾, 60 fr / 2.0 s — inside the online
   *             set's 1.7-3.3 s band, and the frame you are meant to leave
   *             with.
   *   `returnTurn` everything comes home at once, 16 fr.
   *
   * 375 fr / 12.5 s. `land`, `tilt` and `standup` are CUT: two of them fly a
   * camera that does not move in this film.
   */
  standTurn: {
    draw: 150 / 30,
    breath: 33 / 30,
    anticipation: 9 / 30,
    emerge: 15 / 30,
    land: CUT,
    solid: 45 / 30,
    tilt: CUT,
    standup: CUT,
    orbit: 20 / 30,
    descend: 60 / 30,
    returnTurn: 16 / 30,
    hold: 30 / 30,
  },
  /**
   * O5-A — board §4 O5: *"draw (140) → flat hold (33) → tense (9) → cascade
   * (~130) → THE RANK HELD, dead still, 66 fr / 2.2 s → return: all letters lie
   * flat in ONE beat → flat + breaks news → hold 33. ≈ 440 fr / 14.7 s. The
   * longest option on the board, and every second of it is accounted for; the
   * runtime is the honest cost of eleven moments."*
   *
   *   `emerge` THE CASCADE, and it is not a number any more. It is `cascadeSec`
   *            called on the defaults, which is the board's own arithmetic:
   *            `letterLeadSec + maxSlot · letterBeatSec`, plus the last beat's
   *            interval as its tail. At the eleven pieces the word measures it
   *            returns 174 fr / 5.800 s. `assert-hero-options.mjs` still asserts
   *            that every flip ENDS inside this clip rather than trusting the
   *            call, because `letterFlipSec` can still overrun a clip whose
   *            length is exactly right.
   *
   *            ⚠ IT WAS A LITERAL THREE TIMES AND WRONG ALL THREE TIMES.
   *            At 131 fr it was wrong in both directions at once. Against the
   *            cascade the page actually laid out, six pieces rather than the
   *            eight on record because the letter map was reading the hand-feel's
   *            protruded ink, 131 frames held a 103-frame cascade and left
   *            **28 frames of dead air** between the last flip and the rank hold,
   *            which reads as the film stalling before its own payoff. See
   *            `letterMap` in `app/desk-doodles/page.tsx`. Against the cascade
   *            the word really had, ten pieces, the same 131 frames were 29
   *            SHORT and the last two flips would have run inside the hold.
   *            Retyped to 160 it was right for ten and for nothing else, so it
   *            went stale again on 2026-08-28, the night `dropSubNibStubs`
   *            found two taps bridging the `s` to the `k` and the count became
   *            eleven: 160 frames against a 174-frame cascade. That cost more
   *            than lateness. `parkedPhases` excludes `emerge` from the twos
   *            cadence so the cascade is drawn on ONES, and `solid` keeps its
   *            twos because the payoff hold's claim is byte-identical frames. So
   *            the eleventh flip spent its last 14 frames being sampled at 12 Hz
   *            inside the hold while the other ten were drawn at 30, which is
   *            what the gate was reporting as *"2 DIFFERENT PICTURES of one
   *            event"* and as a 66.8° single-frame step against a 43.7° bar.
   *            One cause, three red rows, and the gate at 35/39. One number,
   *            wrong three times, because a table kept a copy of a function's
   *            output. The table calls the function now. See
   *            `docs/verification/clip-2026-08-28/`.
   *   `solid`  THE RANK HELD, 66 fr / 2.2 s, dead still — inside the online
   *            set's 1.7-3.3 s payoff band.
   *   `returnTurn` everything lies flat at once, 16 fr — EC's exit rule, and the
   *            same 16 frames `standTurn` brings its two channels home in.
   *   `hold`   K7: flat again, junctions open, 33 fr.
   *
   * 476 fr / 15.87 s as this sheet stands, measured with `totalDuration`, which
   * is also what the panel prints and what `assert-hero-option-panel.mjs` reads.
   * Board §4 O5-A estimated *"≈ 440 fr / 14.7 s… the longest option on the
   * board, and every second of it is accounted for; the runtime is the honest
   * cost of eleven moments."* It cascades eleven pieces now rather than the six
   * it was authored against, so it costs 36 frames more than the board budgeted,
   * 14 of them the eleventh beat.
   *
   * ⚠ This line said 457 fr, and that figure was wrong twice over: it left out
   * the 5 frames the five CUT phases still cost at 1/30 each, and it predates the
   * eleventh letter. A total in prose goes stale the same way the clip did, so
   * run `totalDuration` before quoting it. `land`, `tilt`, `standup`, `orbit` and
   * `descend` are CUT: four of them fly a camera that never moves in this film,
   * and there is no shadow beat to land dead-on. See `sampleForm`'s `shadowCut`.
   */
  letterByLetter: {
    draw: 140 / 30,
    breath: 33 / 30,
    anticipation: 9 / 30,
    /* THE SHEET'S SEED, and `cascadeClipSec` is where the length is decided.
     * This call passes the DEFAULTS; the labs box passes the live word to the
     * same function, so the two can never be written down differently. See the
     * note above and `motion` in `app/desk-doodles/page.tsx`. */
    emerge: cascadeClipSec(DEFAULT_HERO_MOTION),
    land: CUT,
    solid: 66 / 30,
    tilt: CUT,
    standup: CUT,
    orbit: CUT,
    descend: CUT,
    returnTurn: 16 / 30,
    hold: 33 / 30,
  },
}

/* ---- curves --------------------------------------------------------------- */

/**
 * The stand-up curve. Slow ease-in launch, fast middle, overshoot past the
 * target, settle back — the spec's shape in one closed-form curve. Its
 * symmetric counter-dip at the start doubles as camera-side anticipation: the
 * move gathers backwards before it commits.
 */
export function easeInOutBack(t: number, c1: number = DEFAULT_HERO_MOTION.backC1): number {
  const c2 = c1 * 1.525
  return t < 0.5
    ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
    : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
}

/**
 * THE RISE — ease-out dominant, with its anticipation dip intact.
 *
 * `easeInOutBack` is spaced 50:50, and that is the defect. Every move in 114
 * seconds of reference film is ease-out dominant: a short acceleration of
 * roughly four frames, an early velocity peak, and a decay three to four times
 * the rise. **Nothing in the set eases in symmetrically**
 * (`reference-film-mechanics.md` §6.1).
 *
 * The difference is not cosmetic and it is the same defect as B2's 42%, one
 * level up: **a symmetric move reads as TRAVELLING; an ease-out dominant move
 * reads as ARRIVING.** 1.4s of ease-out dominant motion is one arrival. 1.4s of
 * symmetric motion is a camera move — and the beat's largest gesture then
 * competes with the moment for what you remember.
 *
 * So the duration is kept and the spacing is fixed. Two segments:
 *
 *   1. GATHER — a brief dip below zero and back. This is the camera-side
 *      anticipation that `easeInOutBack`'s symmetric counter-dip was providing,
 *      preserved deliberately: B4 says "do not touch it" about the overshoot
 *      and about `backC1`, and that instruction stands. What B4 never examined
 *      is the 50:50 spacing, which is all that changes here.
 *   2. TRAVEL — `easeOutBack` from the bottom of the gather. Instant start,
 *      early velocity peak, long decay, overshoot preserved.
 *
 * Asserted numerically by `scripts/verify/assert-hero-rise.mjs`, against the
 * reference set's own three properties, with the prior symmetric curve as the
 * negative control.
 */
export function riseEase(
  u: number,
  gatherFrac: number,
  gatherDepth: number,
  overshoot: number,
): number {
  const g = gatherFrac <= 0 ? 0 : gatherFrac >= 1 ? 0.999 : gatherFrac
  if (u <= 0) return 0
  if (u < g) {
    // Out and back to zero, so the travel segment starts from rest at the
    // bottom of the gather rather than inheriting a velocity discontinuity.
    //
    // ITS TWO END SLOPES ARE NONZERO, AND THAT WAS TESTED RATHER THAN ASSUMED.
    // `-d*sin(pi*u/g)` leaves the starting line at `d*pi/g` — on AZIMUTH, which
    // is parked through the whole tilt, that is 0 -> 58 deg/s in one frame — and
    // it hands over at the same 2.24 into a travel segment whose own start slope
    // is 5.47, a 2.04x step visible in the exposure sheet as
    // `... -2.15, -3.35, -6.83 ...`.
    //
    // Both look like defects on paper, so a warped variant was built to close
    // them: `-d*sin(pi*(u/g)^q)` with q derived as exactly the ratio that makes
    // the exit slope equal `easeOutBack`'s start slope (2.44 with these
    // numbers), which is analytically C1 at both ends. **Measured at 30fps it is
    // worse on three of four counts** — the worst same-direction step ratio
    // across the tilt+rise goes 7.0x -> 11.6x, the tilt gains three frames of
    // visible stall at el 60, and the frames below 60% of full mark height go
    // 9 -> 14. Analytic C1 is not smoothness on an exposure sheet when the
    // curvature is high: the warp crams the gather's whole return into its last
    // two frames.
    //
    // So the half-sine stays, and the 2.04x release stays with it, because that
    // release is a wind-up RELEASING (§6.5's wind-up mode) rather than a hitch.
    // The variant was removed rather than parked: it was this lane's own scratch
    // and it measures worse, and a named, defaulted dial is an instruction to
    // the next person (§10.2 C2). The numbers above are the record of it.
    return -gatherDepth * Math.sin((Math.PI * u) / g)
  }
  return easeOutBack((u - g) / (1 - g), overshoot)
}

/**
 * The orbit drift. Constant slow velocity for the first `cut` of the beat, then
 * decelerating to ZERO into the hold. The camera genuinely stopping is what
 * makes the hold read as a held pose rather than a pause in a pan.
 */
export function driftEase(t: number, cut: number = DEFAULT_HERO_MOTION.driftCut): number {
  if (t <= cut) return t / 0.85
  const tail = 0.15 - Math.pow(1 - t, 2) / 0.6
  return (cut + tail) / 0.85
}

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2

/** Near-constant pen speed with a soft touch-down and lift. */
export function drawEase(
  t: number,
  blend: number = DEFAULT_HERO_MOTION.drawLinearBlend,
): number {
  return blend * t + (1 - blend) * easeInOutSine(t)
}

/** Instant start, long settle — the press-feedback character. */
export const easeOutStrong = (t: number) => 1 - Math.pow(1 - t, 5)

/**
 * MATTER ARRIVING. Fast off the mark, past the target, settle back.
 *
 * `easeOutBack` and not `easeInOutBack`: this is an ENTRANCE, and an entrance
 * that starts slow spends its most-watched moment doing nothing. The stand-up
 * later in the beat is the opposite case — a body gathering itself before a
 * committed move — and keeps its ease-in. Two different events, two different
 * curves, on purpose.
 *
 * `overshoot` is the dial, in fractions of the final value, rather than the
 * raw back coefficient: 0.1 ≈ swells 10% past full thickness and rocks back,
 * which is the "keep bounce subtle" floor. 0 removes the swell entirely and is
 * what the reduced-motion path uses.
 */
export function easeOutBack(t: number, overshoot: number): number {
  const c1 = overshoot * 17.0158 // 0.1 -> 1.70158, the classic coefficient
  const c3 = c1 + 1
  const u = clamp01(t) - 1
  return 1 + c3 * u * u * u + c1 * u * u
}

/** Strong symmetric ease for on-screen morphs. */
export const easeInOutStrong = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * A CAMERA MOVE THAT STARTS FROM REST AND CAN HAND OVER — the reference set's
 * own velocity profile, expressed as its two measured numbers.
 *
 * WHY THIS EXISTS. `easeOutStrong` is ease-out dominant, and this beat used it
 * for the descend — but it reaches its **maximum velocity in the first frame**.
 * Coming out of a 933ms dead hold that is a step from 0 to 376 deg/s in 33ms,
 * which is the largest single discontinuity in the whole camera program.
 *
 * The reference set does not do that. §6.1, measured across 114 seconds:
 * *"a short acceleration (≈ 4 frames), an early velocity peak, and a long decay
 * (3–4× the rise)"*. §6.2 has the only sustained camera move in the set and its
 * per-frame series is explicit — `+3, +5, +8, +21 PEAK, +12, +11, +10, …` —
 * **four frames of acceleration before the peak, then seventeen of decay: a
 * 1:4 asymmetry.** An instant start is not that curve; it is that curve with
 * its first four frames deleted.
 *
 * So the velocity profile is authored directly and the position is its
 * integral:
 *
 *   v(x) = (x / a)^m                              x <  a   the nose
 *        = (1 − r)·((1 − x)/(1 − a))^k  +  r      x >= a   the decay, to a floor
 *
 * `accelFrac` is Babbu's 4-of-21 = 0.19 by default, so rise:decay is 1:4.26 —
 * the measured asymmetry, not a chosen one. `endSlope` is `f'(1)` in units of
 * the move's own average speed: **0 arrives at rest, and anything above 0 hands
 * the next move a velocity instead of stopping in front of it.** That second
 * parameter is the whole reason this is not just an ease-out: the tilt does not
 * arrive anywhere, it hands the camera to the rise's gather, and a move that
 * decelerates to a stop in front of a move that starts at 84 deg/s is a hitch.
 *
 * `m = 1.6` — THE NOSE IS CONVEX, AND THAT IS READ OFF THE SAME FOUR FRAMES.
 * Normalise Babbu's rise against its own peak: `3, 5, 8, 21` → `0.143, 0.238,
 * 0.381, 1.000` at `x/a = 0.25, 0.5, 0.75, 1.0`. A LINEAR nose would give
 * `0.25, 0.5, 0.75, 1.0` — the real one is below it at every sample, so the
 * camera does not accelerate at a constant rate; it eases into its own
 * acceleration. Per-point exponents are 1.40, 2.07 and 3.36, so it is not a
 * clean power law; a least-squares fit of `ln v = m·ln(x/a)` over the four
 * points gives **m = 1.5976**. THAT IS A FIT TO FOUR POINTS AND IS LABELLED AS
 * ONE — the reference doc's own standard (§0, *"estimates are marked"*). It is
 * used because it sits between two metrics that disagree: a first frame as
 * small a share of the peak as Babbu's wants m high, and an even
 * frame-to-frame acceleration wants m low.
 *
 * It matters at 30fps because the first FRAME is what the eye sees: on a
 * 13-frame move a linear nose puts 2.3° into frame one and this one puts 1.1°.
 *
 * Closed form, so nothing is fitted. With
 *   P = a/(m+1) + (1−a)/(k+1)  the area under a decay-to-zero profile
 *   Q = (1−a)·k/(k+1)          how much area a unit of floor velocity adds
 * the normaliser is `A = P / (1 − endSlope·Q)` and the floor is `r = endSlope·A`,
 * which makes `f(1) = 1` and `f'(1) = endSlope` exactly. C¹ at the join by
 * construction: both branches have velocity `1/A` there.
 */
export function handoffEase(
  x: number,
  accelFrac: number,
  endSlope: number,
  k: number = 4,
  m: number = 1.5976,
): number {
  const t = clamp01(x)
  const a = accelFrac <= 0 ? 1e-6 : accelFrac >= 1 ? 0.999 : accelFrac
  const Q = ((1 - a) * k) / (k + 1)
  // A floor velocity above 1/Q would make the normaliser non-positive; clamp
  // well short of it so a mis-set dial degrades rather than inverts the move.
  const s = Math.max(0, Math.min(endSlope, 0.9 / Q))
  const nose = a / (m + 1)
  const P = nose + (1 - a) / (k + 1)
  const A = P / (1 - s * Q)
  const r = s * A
  if (t < a) return (nose * Math.pow(t / a, m + 1)) / A
  const w = (1 - t) / (1 - a)
  const tail =
    (((1 - r) * (1 - a)) / (k + 1)) * (1 - Math.pow(w, k + 1)) + r * (t - a)
  return (nose + tail) / A
}

/* ---- timeline ------------------------------------------------------------- */

export const secToFrames = (s: number, fps: number) => Math.round(s * fps)

/**
 * The end of the beat. Walks `HERO_PHASES` rather than naming the beats,
 * because the hand-written sum is exactly how a new phase gets added to the
 * timeline and silently left out of the transport's length.
 */
export function totalDuration(p: HeroMotionParams): number {
  let t = 0
  for (const phase of HERO_PHASES) t += p.beats[phase]
  return t
}

/**
 * Start time of each phase, in seconds.
 *
 * Derived by walking `HERO_PHASES` rather than by a hand-written chain of sums.
 * The hand-written version is how the order got out of step with the array in
 * the first place: reordering the const array alone silently changed nothing,
 * because the offsets were spelled out separately underneath it.
 */
export function phaseOffsets(p: HeroMotionParams): Record<HeroPhase, number> {
  const out = {} as Record<HeroPhase, number>
  let t = 0
  for (const phase of HERO_PHASES) {
    out[phase] = t
    t += p.beats[phase]
  }
  return out
}

/**
 * The flat→solid state at time `t`, independent of which phase owns it.
 *
 * Deliberately NOT computed per-phase. The depth finishes inside the emerge
 * beat but the light runs on into the tilt, so tying either to a phase boundary
 * would either truncate the light or stretch the beat to fit it. One continuous
 * function of time, sampled by everything, is also what makes scrubbing
 * backwards land on exactly the same state as playing forwards.
 */
export interface EmergeState {
  flat: number
  depth: number
  /**
   * The mark's own yaw, radians, about the vertical axis through its centre.
   * The CAMERA never participates in the turn — if it moved, the change would
   * belong to the viewpoint instead of to the object, which is the one thing
   * this beat cannot afford.
   */
  yaw: number
  /** `0.35 * (1 - sx)` — the face darkening as it turns away. 0 = face-on. */
  shade: number
  /** On-screen width as a fraction of full, i.e. the original's `sx`. */
  sx: number
}

/**
 * The mark's pose once a landing turn has settled — the state everything before
 * the return turn holds under `turnLands`, and everything before it under
 * `solidFirst`.
 *
 * `shade` is 0 and not `turnShade·(1 − sx)` on purpose. The shade term is the
 * FLAT face darkening as it turns away, and it exists because *"during the flat
 * half the whole shading model is collapsed by design"*. At the landing the mark
 * is `flat: 0` — a lit surface, at 38° to the light — so the renderer's own
 * shading is doing this job, and adding the term on top would darken it twice.
 */
function landedPose(p: HeroMotionParams): EmergeState {
  const yaw = landYawOf(p)
  return { flat: 0, depth: 1, yaw, shade: 0, sx: Math.abs(Math.cos(yaw)) }
}

/**
 * How far a shape asks the turn to land short of head-on, in radians — and ZERO
 * on every shape that did not ask.
 *
 * `landYaw` is 38 in the defaults because that is the pose O1 and O4 want, but
 * the shipped film lands head-on and must keep landing head-on: reading the
 * dial unconditionally would have re-posed the default beat, which is the exact
 * "improving a read in place" deletion §0.7 bans. So the dial is real, it is
 * live on the two shapes that consume it, and it is inert on the two that do
 * not — and `assert-hero-options.mjs` asserts the inertness rather than
 * assuming it.
 */
function landYawOf(p: HeroMotionParams): number {
  return p.shape === "turnLands" || p.shape === "solidFirst" ? Math.max(0, p.landYaw) * DEG : 0
}

/* ---- O5 · THE CASCADE ------------------------------------------------------
 *
 * Everything below is the board's §4 O5 cadence, and nothing below is a new
 * mechanism: a letter's flip runs `turnPhase` and `turnPose`, the same two
 * functions both whole-word turns run, at a shorter duration and with a shared
 * landing. *"Each letter-flip is the BUILT turn, scaled to a letter."*
 */

/** What one letter is doing at an instant. The word's own channels, per unit. */
export interface LetterState {
  /** Radians about this letter's OWN vertical axis. */
  yaw: number
  /** 1 = this letter is still ink; 0 = this letter is a lit object. */
  flat: number
  /** Multiplier on this letter's depth. */
  depth: number
  /** The turning face's darkening, `turnShade · (1 − sx)`. */
  shade: number
  /**
   * HOW FAR THIS LETTER HAS SETTLED INTO THE WORD'S OWN AXIS — 0 = it turns
   * about its own centre, 1 = about the word's.
   *
   * ── WHY A LETTER'S PIVOT CANNOT STAY ITS OWN, MEASURED ────────────────────
   *
   * Sebs, 2026-08-04, `letterByLetter` · FREE STROKE · SOLID 57 %: *"look how
   * the [mesh] gets fucked on letter by letter."* The first reading of that was
   * that boundary TRIANGLES were being stretched across the join, and whole-
   * triangle ownership (`ownTrianglesWhole`) removed those sheets. It did — and
   * the picture underneath was a **white crack straight through the `e|sk`, the
   * `d|l` and the `e|s` joins**, which is what the slabs had been covering.
   *
   * The crack is arithmetic, not a raster artefact. A letter's pose is
   *
   *     q = R(p − piv_L) + piv_L  =  R·p + (I − R)·piv_L
   *
   * so two letters at the SAME yaw but different pivots are two DIFFERENT rigid
   * motions, separated by `(I − R)·(piv_A − piv_B)`. The cascade settles every
   * letter at one shared yaw (`letterLandYaw`, 30°) and holds it there for the
   * whole 2.2 s SOLID beat, so at 30° each pair of neighbours is pulled apart by
   * `(1 − cos 30°) = 13.4 %` of their pivot separation in x and `sin 30° = 50 %`
   * in z. The word therefore never narrows the way a turned word must: each
   * letter narrows in place and the missing width opens up as gaps between them.
   *
   * The seam closes **iff every letter shares one pivot** — that is not a tuning
   * choice, it is the only solution: any translation that closes it algebraically
   * reduces to `R(p − piv_word) + piv_word`. So the pivot has to ARRIVE at the
   * word's axis, and this channel is that arrival.
   *
   * ── THE SCHEDULE, AND WHY THE SECOND HALF ────────────────────────────────
   *
   * 0 through the whole first half of the flip — the letter is still ink turning
   * on its own axis, which is the read the board asks for (*"a mis-placed axis
   * makes a letter sweep sideways instead of turning in place"*) — then eased to
   * 1 across the second half, landing exactly when the flip lands. At `u = 0`
   * the rotation is the identity, so the pivot is unobservable there and the
   * glide costs nothing at the start; at `u = 1` every landed letter shares the
   * word's axis, so the settled rank is ONE rigid turn and the seam is closed by
   * construction rather than by tolerance.
   *
   * On the RETURN it is pinned at 1: every letter unwinds on one shared yaw, so
   * holding the shared pivot keeps the seam closed through the entire unwind,
   * and at yaw 0 the pivot stops mattering again.
   *
   * ⚠ WHERE the axis is remains the RENDERER's to measure (see `FlatState.letters`
   * — "the model says when, this file says where"). This channel is a FRACTION,
   * never a coordinate, so no second copy of a pivot exists to drift.
   */
  settle: number
}

/**
 * WHICH BEAT EACH LETTER FLIPS ON.
 *
 * The board's grouping, generated rather than typed, so it survives a word
 * whose letter count is not eleven — which the hero word's own ink turns out to
 * be (`letterCount` is 8). Fed the FONT word's numbers (n 11, silent after 3,
 * pairs from 5) it reproduces board §4 O5 exactly:
 *
 *   D · e · s · k · [gap, silent] · D · o+o · d+l · e+s
 *   0   1   2   3        4          5    6      7     8
 *
 * A slot is a BEAT, not a letter: two letters sharing a slot flip together,
 * which is the board's *"later beats flip pairs while the interval holds"*.
 */
function letterSlotsOf(p: HeroMotionParams): number[] {
  const n = Math.max(0, Math.round(p.letterCount))
  const slots: number[] = []
  let slot = 0
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      slots.push(0)
      continue
    }
    // A word gap can never be crossed by a pair — the two halves of a doubled
    // beat are neighbours in one word, which is what makes them read as one.
    const atGap = p.letterSilentAfter >= 0 && i === Math.round(p.letterSilentAfter) + 1
    const paired =
      !atGap &&
      p.letterPairFrom >= 0 &&
      i > Math.round(p.letterPairFrom) &&
      (i - Math.round(p.letterPairFrom)) % 2 === 1
    if (!paired) slot++
    if (atGap) slot++ // the silent beat
    slots.push(slot)
  }
  return slots
}

/**
 * When beat `s` starts, in seconds from the top of the cascade.
 *
 * Beat 0 is flip 1 and it starts immediately; every beat after it is one
 * `letterLeadSec` plus however many `letterBeatSec` intervals — so the ceremony
 * read sits between the first flip and the rhythm, exactly where EC puts it.
 */
function slotStartSec(p: HeroMotionParams, slot: number): number {
  if (slot <= 0) return 0
  return Math.max(0, p.letterLeadSec) + (slot - 1) * Math.max(0, p.letterBeatSec)
}

/**
 * HOW LONG THE CASCADE IS, from the board's own arithmetic: *"≈ 1 × 667 ms +
 * 8 × 460 ms ≈ 4.3 s / 130 fr"* — the lead, plus one interval per beat after
 * the first, plus the last beat's own interval as its tail.
 *
 * Exported because the exposure sheet has to be able to hold it and because
 * `assert-hero-options.mjs` checks that it does. A cascade longer than its clip
 * does not error; it quietly runs its last flips inside the payoff hold, which
 * is precisely the class of defect a gate exists to make loud.
 */
export function cascadeSec(p: HeroMotionParams): number {
  const slots = letterSlotsOf(p)
  if (slots.length === 0) return 0
  const maxSlot = slots[slots.length - 1]
  return slotStartSec(p, maxSlot) + Math.max(0, p.letterBeatSec)
}

/**
 * THE WORD'S HOLD AND TURN, seconds: `letterWordHoldSec` dead on, then
 * `letterWordTurnSec` of the rank turning as one. It sits INSIDE the cascade's
 * clip, after the letters' own cascade: his three calls, 2026-09-26, *"the
 * word's turn moves inside the clip, so the hero film runs about 1.07 s
 * longer."* Left in `solid`, the turn ran on the twos `solid` keeps and ate
 * 32 fr of the payoff hold.
 */
function letterWordBeatSec(p: HeroMotionParams): number {
  return Math.max(0, p.letterWordHoldSec) + Math.max(0, p.letterWordTurnSec)
}

/**
 * THE CASCADE'S CLIP: `cascadeSec` plus the word's hold and turn
 * (`letterWordBeatSec`), put on the frame grid the exposure sheet is already
 * on. **This is the one place the cascade's length is decided.**
 *
 * The rounding is not tidiness. At eleven pieces the raw sum is
 * 160.00000000000002842 frames, two ULPs over, and the `emerge`/`land` boundary
 * sits exactly on a frame — so those two ULPs flipped one frame out of `land`
 * into `emerge` and shifted every phase after it. Every other clip in
 * `HERO_SHEETS` is `N / fps`, and an exposure sheet holds whole frames.
 *
 * It is a function, called twice, rather than a number written twice. The sheet
 * seeds itself from the defaults; the labs box relays the cascade from the word
 * on screen. Those two agree only on "Desk Doodles". Type anything else and a
 * frozen clip runs that word's last flips inside the payoff hold, at the twos
 * `solid` keeps, while every other letter is drawn on ones — 90 degrees dead
 * edge-on where 53 belongs. That is what the 160-frame literal was costing, and a
 * copy of this number in `app/desk-doodles/page.tsx` would cost it again. The other caller is
 * the `motion` memo in `app/desk-doodles/page.tsx`.
 */
export function cascadeClipSec(p: HeroMotionParams): number {
  return Math.round((cascadeSec(p) + letterWordBeatSec(p)) * p.fps) / p.fps
}

/** The pose a letter rests at before it has flipped: the drawing. */
const LETTER_INK = (p: HeroMotionParams): LetterState => ({
  yaw: 0,
  flat: 1,
  depth: p.emerge.flatDepth,
  shade: 0,
  // Yaw is 0 here, so the pivot is unobservable — but it is written rather than
  // defaulted, because a channel that is only set on some frames is the dead-
  // parameter class this beat has already shipped twice.
  settle: 0,
})

/** The pose a letter holds once it has landed: a standing solid, DEAD ON, on
 *  its own rest box. `shade` is 0 for `landedPose`'s reason: the letter is lit
 *  now, so the flat face's falloff would darken it twice. The rank's shared yaw
 *  is not reached here; it is the word's own turn, `letterWordYaw`. */
const LETTER_STOOD = (p: HeroMotionParams): LetterState => ({
  yaw: 0,
  flat: 0,
  depth: 1,
  shade: 0,
  // On the word's axis, and free: at yaw 0 the pivot moves nothing, so the
  // hand-over from the letter's own centre (0, the whole flip) to the word's
  // (1, the word turn) happens on a frame where nobody can see it.
  settle: 1,
})

/**
 * THE WORD'S TURN, radians: 0 through the letters' cascade and
 * `letterWordHoldSec` after it, then the whole rank to `letterLandYaw` on
 * `easeOutStrong` across `letterWordTurnSec`, all inside the cascade's clip. Every letter shares it and every letter's pivot is the
 * word's axis by then, so the rank turns as one rigid body.
 */
function letterWordYaw(p: HeroMotionParams, tSec: number): number {
  const start = phaseOffsets(p).emerge + cascadeSec(p) + Math.max(0, p.letterWordHoldSec)
  const u = clamp01((tSec - start) / Math.max(1e-6, p.letterWordTurnSec))
  return Math.max(0, p.letterLandYaw) * DEG * easeOutStrong(u)
}

/**
 * ONE LETTER'S FLIP — the built turn, scaled.
 *
 * `local` is time since this letter's own beat. Everything in it is the same
 * expression `sampleEmerge`'s turn branch evaluates: `turnPhase` splices the
 * authored dwell in at the midpoint, `turnPose` gives the `|cos|` width law and
 * the shade term, the depth arrives across the turn-OUT so the thickness
 * change is spent where nobody can see it, and the ink swaps AT the edge.
 *
 * The one difference is the DWELL, and it is the board's: only flip 1 gets the
 * ceremony. *"Eleven dwells would turn the signature into a flicker — DF's
 * 67 ms glyph churn is the measured warning."* The quick flips get a ONE-FRAME
 * pin instead, which is not the same thing and is not optional — see
 * `letterEdgePinSec` for the three letters that missed their own edge entirely
 * without it.
 */
function letterFlip(p: HeroMotionParams, local: number, ceremony: boolean): LetterState {
  const e = p.emerge
  const beat = Math.max(1e-6, ceremony ? p.letterFlipSec : p.letterQuickSec)
  if (local <= 0) return LETTER_INK(p)
  if (local >= beat) return LETTER_STOOD(p)
  const dwell = ceremony ? Math.max(0, e.dwellSec) : Math.max(0, p.letterEdgePinSec)
  const { u, inDwell } = turnPhase(local, beat, dwell)
  // The dwell shows the state the beat is ARRIVING at, `sampleReturn`'s rule,
  // and what the out-turn already does: the sliver is the SOLID's.
  if (inDwell) {
    return {
      yaw: Math.PI / 2,
      flat: 0,
      depth: 1,
      shade: e.turnShade * (1 - e.edgeFloor),
      // DEAD STILL on its own edge, on its own centre.
      settle: 0,
    }
  }
  // Out to the edge and back to HEAD-ON: landYaw 0 is the ported, symmetric
  // law. His ruling: each letter lands dead on, facing front.
  const { shade, yaw } = turnPose(u, e, 0)
  const dU = clamp01(u / 0.5)
  return {
    yaw,
    flat: u < 0.5 ? 1 : 0,
    depth: e.flatDepth + (1 - e.flatDepth) * easeInOutCubic(dU),
    shade,
    // ITS OWN CENTRE FOR THE WHOLE FLIP. The pivot used to glide to the word's
    // axis across the second half while the letter turned to 30 deg, and a
    // letter turned about a point off its own centre moves sideways: that is
    // the 9 px slide into the neighbour LETTERS measured on 209 of 246 frames.
    settle: 0,
  }
}

/**
 * EVERY LETTER'S STATE AT AN INSTANT — `undefined` on every film but O5, which
 * is what keeps the other six allocating nothing.
 *
 * Three passages, and the middle one is the film:
 *
 *   before `emerge`  every letter is ink lying on the page. The GLOBAL flat and
 *                    depth channels are parked at the solid on this film, so
 *                    this is the only thing making the draw look like a draw —
 *                    which is the point: one owner per channel.
 *   the cascade      each letter runs its own flip at its own beat.
 *   the return       *"all letters lie flat in ONE beat"* (board's O5-A exit,
 *                    EC's own rule: elements leave four times faster than they
 *                    arrived, all at once). One curve, no stagger — a second
 *                    cascade would repeat the trick the film just taught.
 */
export function sampleLetters(p: HeroMotionParams, tSec: number): LetterState[] | undefined {
  if (p.shape !== "letterByLetter") return undefined
  const n = Math.max(0, Math.round(p.letterCount))
  if (n === 0) return []
  const off = phaseOffsets(p)
  const slots = letterSlotsOf(p)

  // THE RETURN — everything comes home together, arrival-spaced, on the same
  // `easeOutStrong` the hinged films unwind on so the ink coming back and the
  // rank lying down are one settling rather than several.
  if (p.ret.mode !== "prior" && tSec >= off.returnTurn) {
    const beat = Math.max(1e-6, p.beats.returnTurn)
    const s = easeOutStrong(clamp01((tSec - off.returnTurn) / beat))
    // From wherever the WORD stood when the return began: `letterLandYaw` on
    // the shipped timings, and never a jump if `solid` is cut short.
    const from = letterWordYaw(p, off.returnTurn)
    const out: LetterState[] = []
    for (let i = 0; i < n; i++) {
      out.push({
        yaw: from * (1 - s),
        flat: s,
        depth: 1 + (p.emerge.flatDepth - 1) * s,
        shade: 0,
        // PINNED AT 1 FOR THE WHOLE UNWIND. Every letter shares one yaw here, so
        // sharing the word's axis keeps the rank one rigid body all the way home
        // — and at yaw 0 the pivot stops being observable anyway. Gliding it back
        // to the letters' own centres would re-open the seam it just closed, for
        // frames nobody asked to see move. See `LetterState.settle`.
        settle: 1,
      })
    }
    return out
  }

  const local = tSec - off.emerge
  // THE WORD TURNS AS ONE. Every landed letter takes the rank's yaw; a letter
  // still mid-flip keeps its own (only possible if `solid` is dialled shorter
  // than the cascade's tail), so nothing is snapped.
  const word = letterWordYaw(p, tSec)
  const out: LetterState[] = []
  for (let i = 0; i < n; i++) {
    const s = letterFlip(p, local - slotStartSec(p, slots[i]), slots[i] === 0)
    // `settle` 1 is LETTER_STOOD and nothing else: landed, on the word's axis.
    out.push(word > 0 && s.settle === 1 ? { ...s, yaw: word } : s)
  }
  return out
}

export function sampleEmerge(p: HeroMotionParams, tSec: number): EmergeState {
  const e = p.emerge
  const start = phaseOffsets(p).emerge
  const local = tSec - start

  if (e.mode === "prior") {
    // PARKED — the ramp, verbatim. No turn, no shade, silhouette untouched.
    if (local <= 0) return { flat: 1, depth: e.flatDepth, yaw: 0, shade: 0, sx: 1 }
    const dU = p.beats.emerge > 0 ? clamp01(local / p.beats.emerge) : 1
    const swell = easeOutBack(dU, e.overshoot)
    const depth = e.flatDepth + (1 - e.flatDepth) * swell
    const lU = e.lightSec > 0 ? clamp01((local - e.lightLagSec) / e.lightSec) : 1
    return { flat: 1 - ddFlipEase(lU), depth, yaw: 0, shade: 0, sx: 1 }
  }

  if (local <= 0) return { flat: 1, depth: e.flatDepth, yaw: 0, shade: 0, sx: 1 }

  /* ---- STAND & TURN · THE SECOND PIECE OF NEWS ----------------------------
   * The turn that O2 never makes, spliced into the standing hold — and it is a
   * separate branch rather than a longer `emerge` precisely so a HOLD sits
   * between the two moves. `solid` is dead still at the standing pose; only
   * then does the object start turning.
   *
   * It turns to `landYaw`, the pose "somebody already tuned by eye for the best
   * ¾ of this word", and it is the OBJECT turning — the camera is parked
   * through every frame of it, which is the claim the shipped film's own camera
   * orbit cannot make.
   *
   * Spaced `easeOutStrong`: most of the travel early, the last of it eased out.
   * An arrival, the same grammar every other landing in this beat uses. The
   * clamp carries it through `descend` at the settled pose, so the payoff hold
   * needs no branch of its own.
   *
   * `shade` is 0 for `landedPose`'s reason: the mark is `flat: 0` here, a lit
   * surface at an angle, so the renderer's own shading is already doing this
   * and the turn's flat-face falloff would darken it twice. */
  if (p.shape === "standTurn" && tSec >= phaseOffsets(p).orbit) {
    const off = phaseOffsets(p)
    const u = p.beats.orbit > 0 ? clamp01((tSec - off.orbit) / p.beats.orbit) : 1
    const yaw = Math.max(0, p.landYaw) * DEG * easeOutStrong(u)
    return { flat: 0, depth: 1, yaw, shade: 0, sx: Math.abs(Math.cos(yaw)) }
  }

  // The settled pose. Under `turnLands` the turn landed SHORT of head-on, so
  // this is the object's own ¾ — no camera anywhere in it. See `landedPose`.
  if (local >= p.beats.emerge) return landedPose(p)

  /* ---- O2 · THE CONVERSION RIDES THE HINGE, AND THERE IS NO TURN -----------
   *
   * Filmed before this branch existed, the pop-up ran BOTH events at once: the
   * hinge stood the word up while `turnPose` simultaneously yawed it out to
   * edge-on and back, so the word collapsed to a sliver in the middle of its
   * own stand (`opt-popup`, frames 660-667). Two conversions in one shot, which
   * is the board's own "one piece of news per shot" rule broken, and it read as
   * a glitch rather than as either move.
   *
   * The turn is how the DEAD-ON films earn their thickness — head-on, a flat
   * mark and a solid one have the same silhouette to three decimals (§1.1), so
   * something has to rotate or there is nothing to see. This film does not have
   * that problem: it is shot from the desk ¾ and the mark is RISING, so its
   * thickness, its side walls and its shadow all arrive with the stand. The
   * hinge IS the reveal, and a yaw on top of it is a second answer to a question
   * that has already been answered.
   *
   * So both channels ride `backLoaded` at the hinge's own `popStandFH` — the
   * mark gains its body exactly as fast as it rises, one event, one spacing.
   * No `easeOutBack` overshoot: a hinge is a hinge, and the board's spacing for
   * it is a late commit, not a spring. */
  if (p.shape === "popUp" || p.shape === "standTurn") {
    const u = p.beats.emerge > 0 ? clamp01(local / p.beats.emerge) : 1
    const s = backLoaded(u, p.popStandFH)
    return { flat: 1 - s, depth: e.flatDepth + (1 - e.flatDepth) * s, yaw: 0, shade: 0, sx: 1 }
  }

  /* ---- the dwell has to be AUTHORED, not inherited from frame quantisation --
   * The original's two-frame dwell is real but it is a property of its
   * SAMPLING: it composites `t = easeInOutCubic(i / flipN)` with flipN = 26, so
   * i = 13 lands on t = 0.5 exactly, angle = 90°, and the clamp holds the
   * sliver for the frames either side.
   *
   * This beat is not sampled that way. It runs on a continuous clock and is
   * scrubbable to arbitrary times, so u = local / 0.85 never lands on 0.5 at
   * 30fps — measured, before this was split out: the narrowest frame reached
   * sx 0.0905 (37px at the original's scale) and the beat spent ZERO frames at
   * the edge. The moment silently did not exist.
   *
   * A hold that only appears when the frame rate cooperates is not a hold. So
   * the turn is [turn-out | DWELL | turn-in], with the dwell an authored
   * duration that pins the angle at exactly 90°. The eased angle still runs
   * across the full 180° of the turning portion, so B1's breakdown is exactly
   * where it was measured — the dwell is inserted at the midpoint, not spliced
   * into the curve. */
  const { u, inDwell } = turnPhase(local, p.beats.emerge, e.dwellSec)
  const landRad = landYawOf(p)

  /* ---- the angle, and the width law it drives -----------------------------
   * Ported whole from compose.ORIGINAL-FLIP.mjs:195-200:
   *
   *   const t     = easeInOutCubic(i / flipN)
   *   const angle = t * Math.PI                                   // 0..180deg
   *   const sx    = Math.max(Math.abs(Math.cos(angle)), 0.035)
   *   const shade = 0.35 * (1 - sx)
   *
   * `angle` runs the full 180° because the original is drawing TWO front-facing
   * images and swapping which one it scales at the midpoint — it never actually
   * shows a reversed face. */
  const { sx, shade, yaw } = turnPose(u, e, landRad)

  /* ---- the mesh's yaw, which is NOT the angle ------------------------------
   * THE ONE PLACE THIS CANNOT BE A LITERAL PORT, and it would be a silent,
   * ugly bug. The original scales two flat images horizontally, so "180°" is a
   * figure of speech. Here the mark is a real mesh really rotating, and yawing
   * a real mesh through 180° shows its BACK — the word mirrored, reading
   * right-to-left, for the entire second half of the beat.
   *
   * So the mesh turns out to edge-on and back rather than through:
   *
   *   meshYaw = angle <= 90deg ? angle : 180deg - angle
   *
   * `cos(pi - a) === -cos(a)`, so `|cos(meshYaw)|` is EXACTLY `|cos(angle)|` on
   * every frame. The on-screen width law is byte-identical to the original's,
   * the breakdown stays where B1 measured it, and no frame ever shows a
   * reversed mark. (`turnPose` computes it; the derivation stays here.) */

  /* ---- ink: swaps AT the edge ---------------------------------------------
   * A hard swap, at the one frame nobody can resolve — exactly where the
   * original swaps its source image (`t < 0.5 ? full3d : logoFrame`). A drawing
   * goes in, an object comes out, and the instant of the change is hidden
   * inside the moment rather than smeared across half a second of ramp. */
  const flat = u < 0.5 ? 1 : 0

  /* ---- depth: ONLY THE LIT SOLID HAS ANY, and it grows as the solid faces --
   * F118, 2026-09-24. This used to arrive across the turn-OUT, on the claim that
   * "a tube seen down its own axis has the same outline whether it is 1mm or
   * 10mm thick". That is true at yaw 0 only. The arrival ran at 15 to 90 deg,
   * where depth shows at sin(yaw) of its full thickness: 0.64 of full depth at
   * 15 deg, 0.90 at 32, all while the ink was still flat and the pen carve was
   * cutting it back to the pen outline. A carve cutting a thick body is the
   * white sliver in the "l" at emerge frame 640.
   *
   * So the drawing half is a flat card at `flatDepth` the whole way out, the
   * dwell is that card edge-on (the empty frame §10.2 C7 names), and the depth
   * arrives on the turn-IN as the lit solid comes round, by `solidDepthAt`:
   * none at the edge, all of it at the landing. The carve rides `flat`, so it
   * never meets a body with thickness. */
  const depth = flat ? e.flatDepth : solidDepthAt(yaw, landRad, e.flatDepth)

  // Across the dwell the state is FROZEN, both frames identical. The original's
  // two dwell frames are byte-identical (f154/f155: ink 410, w 14, cx 479.5,
  // mean 99.4) and that is what makes the beat read as a held instant rather
  // than a dropped frame. A 1-2px feature that aliases differently across the
  // two frames converts the held beat into a two-frame shimmer.
  if (inDwell) {
    const edgeDepth = solidDepthAt(Math.PI / 2, landRad, e.flatDepth)
    return { flat: 0, depth: edgeDepth, yaw: Math.PI / 2, shade: solidShade(e.turnShade * (1 - e.edgeFloor), edgeDepth), sx: e.edgeFloor }
  }

  return { flat, depth, yaw, shade: flat ? shade : solidShade(shade, depth), sx }
}

/** The return turn's state, plus the one thing it carries that the out-turn
 *  does not: whether the drawing's junctions are open. */
export interface ReturnState extends EmergeState {
  /**
   * 0 — the mark is one fused mass and its 22 pen strokes are invisible as
   *     separate acts, which is what K1 is.
   * 1 — every stroke junction shows a hairline of PAPER, later stroke in
   *     front, so the pen order is legible in ink alone. See `HeroReturn`.
   */
  jointBreak: number
}

/**
 * The state the return turn starts FROM — the settled object, wherever the film
 * left it. Head-on on the shipped beat; at `landYaw` on the two shapes whose
 * turn landed short, so the return begins at the pose the previous shot ended
 * on rather than snapping home first.
 */
const solidBefore = (p: HeroMotionParams): ReturnState => ({ ...landedPose(p), jointBreak: 0 })

/**
 * THE RETURN TURN — the mirror of `sampleEmerge`, and deliberately not a
 * separate mechanic.
 *
 * Everything the out-turn proved stays proved: the same `|cos|` width law, the
 * same `easeInOutCubic` angle, the same shade term, the same authored dwell at
 * exactly 90°, the same single centre. Three things run backwards, and they
 * are the whole difference:
 *
 *   `flat`      0 → 1. An object goes in, a drawing comes out.
 *   `depth`     LEAVES on the turn-out as the lit solid turns away, where the
 *               out-turn's ARRIVES on its turn-in as the solid comes round
 *               (`solidDepthAt`, F118). Only the lit solid ever has depth; the
 *               drawing half is `flatDepth` on both turns, so the edge is an
 *               empty frame on both. The old doc said the outlines matched
 *               because "a tube seen down its own axis has the same outline
 *               whether it is 1mm or 10mm thick". That holds at yaw 0 only;
 *               the old departure ran at 66 to 12 deg, where depth shows at
 *               sin(yaw) of its full thickness.
 *   `jointBreak` 0 → 1, at the edge. The news.
 *
 * THE DWELL SHOWS THE STATE THE BEAT IS ARRIVING AT. That is one rule, stated
 * once, and it is what the out-turn already does: `sampleEmerge`'s dwell reads
 * `flat: 0` — the object — while the frame before it is still a drawing. So
 * this one reads `flat: 1`. The change is hidden inside the moment on both
 * turns rather than smeared across a ramp on either.
 */
export function sampleReturn(p: HeroMotionParams, tSec: number): ReturnState {
  const e = p.emerge
  const beat = p.beats.returnTurn

  // PARKED — the beat ends hanging on the ¾, which is what shipped. §3 K7:
  // "The film stops rather than ends."
  if (p.ret.mode === "prior") return solidBefore(p)

  const local = tSec - phaseOffsets(p).returnTurn
  if (local <= 0) return solidBefore(p)

  // `identical` returns to the flat mark UNCHANGED — the original's own
  // behaviour (`traced.tsv` f140-146 and f244-275 are the same numbers: ink
  // 11423, w 409, h 91, cx 479.0, mean 36.8). Sebs's other branch.
  const opened = p.ret.mode === "changed" ? 1 : 0

  if (local >= beat) {
    return { flat: 1, depth: e.flatDepth, yaw: 0, shade: 0, sx: 1, jointBreak: opened }
  }

  /* O2's LIE-BACK is the hinge running home, and it carries the same "one
   * conversion" rule the stand does — see the popUp branch in `sampleEmerge`.
   * Without this the return re-introduced the yaw the stand had just been
   * cleared of, and the gate caught it: 11 of 322 frames still turned.
   *
   * `easeOutStrong` is the same arrival spacing `pitchAt` gives the hinge, so
   * the ink coming back and the mark lying down are one motion rather than two
   * that happen to overlap. The breaks still open — K7's news is the point of
   * the return on every film. */
  if (p.shape === "popUp" || p.shape === "standTurn") {
    const u = beat > 0 ? clamp01(local / beat) : 1
    const s = easeOutStrong(u)
    /* EVERYTHING COMES HOME AT ONCE, and that is not the "one claim per shot"
     * rule being broken — a return is one gesture. `standTurn` unwinds its yaw
     * on the same curve the hinge and the ink use, so the object arrives back
     * on the page as a single settling rather than as three channels finishing
     * at their own times. On `popUp` there is no yaw to unwind and this term is
     * a constant 0. */
    const yawHome = p.shape === "standTurn" ? Math.max(0, p.landYaw) * DEG * (1 - s) : 0
    return {
      flat: s,
      depth: 1 + (e.flatDepth - 1) * s,
      yaw: yawHome,
      shade: 0,
      sx: Math.abs(Math.cos(yawHome)),
      jointBreak: opened * s,
    }
  }

  const { u, inDwell } = turnPhase(local, beat, e.dwellSec)
  // `reverse` — the return starts AT the landing and comes home, so its two
  // segments are the out-turn's in the other order. See `turnPose`.
  const { sx, shade, yaw } = turnPose(u, e, landYawOf(p), true)

  /* F118, 2026-09-25: the return's dwell is the SOLID, not the drawing. It
   * holds `SOLID_EDGE_DEPTH` so the edge is a sliver, and a sliver under the pen
   * carve is the white ghost outline, so the carve and the breaks stay off until
   * the first frame after the dwell. That breaks "the dwell shows the state the
   * beat is arriving at" on this turn only: the drawing now lands one dwell
   * (2 frames) after the edge instead of on it. Ruled by the controller: ghosts
   * are the worse defect. */
  if (inDwell) {
    const edgeDepth = solidDepthAt(Math.PI / 2, landYawOf(p), e.flatDepth)
    return {
      flat: 0,
      depth: edgeDepth,
      yaw: Math.PI / 2,
      shade: solidShade(e.turnShade * (1 - e.edgeFloor), edgeDepth),
      sx: e.edgeFloor,
      jointBreak: 0,
    }
  }

  /* F118, 2026-09-24. The depth LEAVES ON THE TURN-OUT, as the lit solid turns
   * away, by `solidDepthAt`. It used to hold at 1.0 all the way to the edge and
   * leave after it, on `easeInOutCubic`. Measured on that schedule: the word at
   * 75 deg was 26 % wide with every round stem still full width, so the eleven
   * letters stacked into one black sliver; and for about 4 frames after the edge
   * the pen carve (which rides `flat`) cut a body still 0.93 to 1.0 deep, which
   * is every white ghost at frame 1115. Now the drawing half is `flatDepth` from
   * the edge to K7, the way back is the flat card squeezing in x, and the carve
   * has nothing thick to cut. `flatDepth` is returned as the literal, never as
   * `floor + range * 0`, so the last frame and K7 agree to the bit. */
  const past = u >= 0.5
  const depth = past ? e.flatDepth : solidDepthAt(yaw, landYawOf(p), e.flatDepth)
  return { flat: past ? 1 : 0, depth, yaw, shade: past ? shade : solidShade(shade, depth), sx, jointBreak: past ? opened : 0 }
}

/** Everything the form is doing at an instant, across BOTH turns. */
export interface FormState extends ReturnState {
  /**
   * The contact shadow's own opacity, 0..1. Its own curve and its own timing —
   * see `HeroMotionParams.shadowLaw`. A drawing casts no contact shadow, so
   * this is pinned to zero wherever the mark is flat.
   */
  shadow: number
  /**
   * How far the silhouette is carved back to the pen's own outline, 0..1.
   * See `HeroMotionParams.carveLaw` for what it buys and `sampleForm` for why
   * its curve is `flat`'s and not one of its own.
   */
  penCarve: number
}

/**
 * O4 · SOLID FIRST — the form, which is *already there* for the whole first half
 * of the film.
 *
 * There is no emerge in this option. The solid is present from the pop-in and
 * held at its own ¾ until the return turn takes it home through its own edge, so
 * everything before `returnTurn` is one pose, and everything from `returnTurn`
 * on is the machinery the round trip already had — the same `|cos|` law, the
 * same dwell, the same breaks at the crossings.
 *
 * *"the de-extrude hidden at the one angle where depth is the whole image"* is
 * therefore free: `sampleReturn` already takes its depth away before the edge (F118), and
 * `flat` already flips inside the dwell. Running the arc backwards did not need
 * a new mechanism, it needed the existing one and nothing in front of it.
 */
function solidFirstForm(p: HeroMotionParams, tSec: number, off: Record<HeroPhase, number>): ReturnState {
  if (tSec >= off.returnTurn && p.ret.mode !== "prior") return sampleReturn(p, tSec)
  return solidBefore(p)
}

/**
 * O6 · THE CUTAWAY — the form, and the two holes in it.
 *
 * The transform is never on screen. What the model has to produce is a state
 * that is SOLID on the far side of an absence and FLAT on the far side of the
 * second one, with nothing in between to mis-space — *"its rhythm cannot fail;
 * it has no move to mis-space"*.
 *
 * The absences themselves are `reveal: 0` (see `revealAt`) rather than a state
 * here, for one reason: an absence has to be the mark GONE, not the mark at zero
 * thickness. `flat`/`depth` are what the mark IS; `reveal` is whether any of it
 * has been laid down. Driving the wrong one would leave a flat sliver on the
 * page through the frames whose whole job is to be the page.
 */
function cutawayForm(p: HeroMotionParams, tSec: number, off: Record<HeroPhase, number>): ReturnState {
  const opened = p.ret.mode === "changed" ? 1 : 0
  // The drawing is back. `descend` is the closing absence and the mark does not
  // exist during it, so the flat state resumes the instant the page is shown
  // again — a substitution, which is the genre's own answer (three instances in
  // two clips, `online-reference-mechanics.md` §7 row 8).
  if (tSec >= off.returnTurn) {
    return { flat: 1, depth: p.emerge.flatDepth, yaw: 0, shade: 0, sx: 1, jointBreak: opened }
  }
  // Standing, from the far side of the first absence to the near side of the
  // second. Head-on to the page — the camera is the desk ¾ and it is the camera
  // that is oblique, never the mark.
  if (tSec >= off.emerge + Math.max(0, p.absenceSec)) {
    return { flat: 0, depth: 1, yaw: 0, shade: 0, sx: 1, jointBreak: 0 }
  }
  // The draw, the long flat hold, and the absence — all one flat state.
  return { flat: 1, depth: p.emerge.flatDepth, yaw: 0, shade: 0, sx: 1, jointBreak: 0 }
}

/**
 * O5 · LETTER BY LETTER — the WHOLE-WORD form, which on this film does almost
 * nothing, and that is the design rather than an omission.
 *
 * `flat`, `depth`, `yaw` and `shade` are the mark's channels and they are all
 * ONE VALUE for the whole word. A cascade needs eleven — so on this film they
 * are parked at the settled solid on every frame and `sampleLetters` carries
 * the state instead. Two owners for one channel is how a rebuild loses one of
 * them, so there is exactly one: before the cascade the word looks like a
 * drawing because every LETTER is ink, not because the word is.
 *
 * Two things still belong to the whole mark and stay here:
 *
 *   `jointBreak` — K7's news is a property of the DRAWING, and the drawing is
 *                  whole again by the time it opens. It opens on the return,
 *                  on the same curve the rank lies down on.
 *   `penCarve`   — the carve is per letter in the SHADER (it multiplies by the
 *                  per-letter flat), so what belongs here is the AMPLITUDE, and
 *                  it is a constant across the film rather than `× flat`. Riding
 *                  the global `flat` would have switched the carve off for the
 *                  whole word at the top of the cascade — an eleven-letter
 *                  silhouette step in one frame, which is the pop it exists to
 *                  prevent. See `sampleForm`'s carve block for the law it is an
 *                  exception to, and `applyPenCarve` for the other half.
 */
function letterForm(p: HeroMotionParams, tSec: number, off: Record<HeroPhase, number>): ReturnState {
  const opened = p.ret.mode === "changed" ? 1 : 0
  const solid: ReturnState = { flat: 0, depth: 1, yaw: 0, shade: 0, sx: 1, jointBreak: 0 }
  if (p.ret.mode === "prior" || tSec < off.returnTurn) return solid
  const beat = Math.max(1e-6, p.beats.returnTurn)
  const s = easeOutStrong(clamp01((tSec - off.returnTurn) / beat))
  return { ...solid, jointBreak: opened * s }
}

export function sampleForm(p: HeroMotionParams, tSec: number): FormState {
  const off = phaseOffsets(p)
  const base: ReturnState =
    p.shape === "solidFirst"
      ? solidFirstForm(p, tSec, off)
      : p.shape === "cutaway"
        ? cutawayForm(p, tSec, off)
        : p.shape === "letterByLetter"
          ? letterForm(p, tSec, off)
          : p.ret.mode !== "prior" && tSec >= off.returnTurn
            ? sampleReturn(p, tSec)
            : { ...sampleEmerge(p, tSec), jointBreak: 0 }

  /* ---- the shadow LANDS, on its own clock ---------------------------------
   * `off.land` IS the instant the emerge ends and the face has arrived, so the
   * lag is measured from there. Lag + landing is sized to fill the `land` beat
   * exactly, which is why that beat exists and why it is named for it.
   *
   * A drawing casts no contact shadow, so `flat` gates it on both ends: it
   * cannot start before the edge on the way out, and it is gone the instant
   * the mark is a drawing again on the way back — inside the same dwell that
   * hides the ink swap, so the return still arrives as ONE event. */
  /* ⚠ TWO SHAPES CUT THE SHADOW BEAT RATHER THAN FAKE IT, AND THAT IS A
   * DELIBERATE SUBTRACTION, NOT AN OVERSIGHT.
   *
   * `turnLands` and `solidFirst` are both bound to C-A, dead-on. The contact
   * shadow is a HORIZONTAL POOL, so at el 0 it is edge-on and contributes
   * exactly **0.00** — storyboard §11.7.6, *"DEAD-ON THE POOL IS INVISIBLE —
   * reported, not asserted away"*. The shadow that WOULD exist at this viewpoint
   * is a page-plane drop shadow behind the form, and the engine does not have
   * one.
   *
   * So the model says zero instead of ramping a channel that renders nothing.
   * That matters beyond tidiness: a shot whose stated news is a shadow, playing
   * at a viewpoint where the shadow measures zero, is *"a held frame of an
   * invisible difference — dead air with a name"*, and it is precisely what §1.1
   * of the board convicted K4 of. The honest version cuts the beat and says so.
   *
   * `cutaway` keeps it, because it is bound to C-B where `sin 30 deg = 0.50` of
   * the pool is visible and the shadow is the only cue carrying "standing"
   * (`online-reference-mechanics.md` §6.2). One law, two answers, both from the
   * same fact about a horizontal plane.
   *
   * THE BUILD ITEM THIS LEAVES OPEN, named because it is somebody's next job: a
   * page-plane drop shadow, offset by the rake, would give the C-A options their
   * second piece of news. It is a renderer capability and this lane does not own
   * `components/viewport-3d.tsx`. */
  /* `letterByLetter` is the third, and for the identical reason: it is bound to
   * C-A, where `sin 0 deg = 0.00` of a horizontal pool is visible. Its second
   * piece of news is the RANK — eleven side walls at a shared yaw — not a
   * shadow, so cutting the beat costs the film nothing it was relying on. */
  const shadowCut =
    p.shape === "turnLands" || p.shape === "solidFirst" || p.shape === "letterByLetter"

  let shadow: number
  if (shadowCut) {
    shadow = 0
  } else if (p.shadowLaw === "prior") {
    shadow = 1 - base.flat
  } else if (base.flat >= 1) {
    shadow = 0
  } else {
    const start = off.land + p.shadowLagSec
    shadow =
      p.shadowSec > 0
        ? easeOutStrong(clamp01((tSec - start) / p.shadowSec))
        : tSec >= start
          ? 1
          : 0
  }

  /* ---- the pen's outline RIDES `flat`, and does not get its own clock ------
   *
   * THE LAW IS ONE LINE — `penCarve = amount x flat` — and every reason for it
   * is a reason already written down somewhere in this beat.
   *
   * 1 · THE CARVE *IS* THE FLAT STATE'S SHAPE, so it must last exactly as long
   *     as the flat state does. `flat` is already the channel that says "this is
   *     a drawing": albedo to black, emissive only, no rim, no specular, no
   *     contact shadow. Any instant where `flat` is 1 and the carve is 0 is a
   *     frame that is a drawing in VALUE and a tube in SHAPE — which is, exactly,
   *     the defect Sebs named. Tying them together makes that frame unreachable
   *     rather than merely unlikely.
   *
   * 2 · SO THE CHANGE IS HIDDEN AT THE EDGE, where every other state change in
   *     this beat is hidden. `sampleEmerge` on the ink swap: *"A hard swap, at
   *     the one frame nobody can resolve... A drawing goes in, an object comes
   *     out, and the instant of the change is hidden inside the moment rather
   *     than smeared across half a second of ramp."* A carve on its own clock
   *     would be a SECOND piece of news, on its own timing, in a beat whose rule
   *     is one piece of news per shot (§10.5 call 1).
   *
   * 3 · AND A RAMPED CARVE WOULD BE DRIFT, WHICH IS THE ONE THING THE BOARD
   *     MEASURED AS THIS BEAT'S DEFECT. The storyboard's §1.3 reading of the
   *     shipped film: *"0 moments... 45 % of its runtime is drift too slow to
   *     read as an event at all."* Easing the outline shut across the turn-out
   *     puts a slow monotone shrink on a camera that is parked and perfectly
   *     still — a sub-threshold silhouette creep, which is drift by that exact
   *     definition, and it would soften the moment gates rather than sharpen
   *     them.
   *
   * 4 · THE `easeOutBack` IN `flat-ink.ts`'S CONTRACT SKETCH IS NOT DROPPED —
   *     IT IS REACHED. That sketch says *"samples `penCarve` 1 -> 0 across the
   *     emerge, on `easeOutBack` — the same curve the depth swells on."* It was
   *     written against the parked `emerge.mode: "prior"` ramp, where there IS
   *     an ink swell. Under the shipped `mode: "turn"` there is none: the depth
   *     runs `easeInOutCubic` and the swell dial moves nothing (storyboard
   *     §11.9.2 found the same thing about that dial's label). So porting the
   *     sentence literally would tie the carve to a curve nothing else in the
   *     shipped beat runs on — while riding `flat` gives, on the PARKED arm,
   *     `1 - ddFlipEase(...)`: an eased ramp across the emerge, which is exactly
   *     what the contract asked for. One law, right on both arms.
   *
   * 5 · AND THE DWELLS COME OUT RIGHT FOR FREE. `sampleReturn`'s header states
   *     the rule — *"THE DWELL SHOWS THE STATE THE BEAT IS ARRIVING AT"* — and
   *     implements it by reading `flat: 0` at the out-turn's dwell and `flat: 1`
   *     at the return's. Riding `flat` means the edge-on sliver is the SOLID's
   *     on the way out and the DRAWING's on the way back, with no second rule
   *     that has to be kept in step with the first. */
  /* ⚠ ONE FILM IS AN EXCEPTION TO CLAUSE 1 AND IT PROVES IT RATHER THAN BREAKS
   * IT. On `letterByLetter` the global `flat` is parked at 0 for the whole film
   * (see `letterForm`), so `amount × flat` would be a carve of zero everywhere —
   * and the clause's own requirement, *"any instant where the mark is a drawing
   * in VALUE and a tube in SHAPE is unreachable"*, would be violated on every
   * un-flipped letter. The carve is gated PER LETTER in the shader by the same
   * per-letter `flat` this file computes, so the law is unchanged; what reaches
   * the renderer is the amplitude, and the gating happens one level down. */
  const penCarve =
    p.carveLaw === "prior"
      ? 0
      : p.shape === "letterByLetter"
        ? clamp01(p.carveAmount)
        : clamp01(p.carveAmount) * clamp01(base.flat)

  return { ...base, shadow, penCarve }
}

/* ---- the exposure sheet: twos ---------------------------------------------- */

/**
 * WHERE THE TWOS GRID IS ANCHORED, per phase.
 *
 * A hand animator does not quantise against a wall clock; the exposure sheet is
 * laid out around the KEYS, and the key is placed on a frame. So the grid is
 * anchored to each parked phase's start — except the two turns, where it is
 * anchored to the CENTRE OF THE DWELL, because the dwell is the accent and an
 * accent that falls between two samples does not exist.
 *
 * That is not a preference, it is measured. Anchored at the phase start
 * instead, the 12 Hz grid on a 0.9167s emerge lands at local 0.4167 and 0.5000
 * and steps straight over the dwell window [0.4250, 0.4917) — the moment
 * silently vanishes, which is the exact failure this beat already had once when
 * the dwell was inherited from frame quantisation rather than authored.
 * Anchored at the dwell's centre it lands ON it, the exposure comes out
 * symmetric about the edge (409 / 402 / 357 / 193 / **14** / 193 / 357 …), and
 * the two dwell frames are byte-identical BY CONSTRUCTION rather than by
 * hoping — which is `online-reference-mechanics.md` §9.2's own reading:
 * *"running the beat on twos through the dwell is the reference-backed way to
 * guarantee the two frames are identical rather than a two-frame shimmer."*
 *
 * The symmetry is B1's, restated as exposure: *"the cushion sits on the OUTSIDE
 * of the turn on both sides… Only the edge itself is whipped."*
 */
function twosAnchor(p: HeroMotionParams, phase: HeroPhase, start: number): number {
  if (phase === "emerge" || phase === "returnTurn") {
    const dwell = Math.max(0, p.emerge.dwellSec)
    const turnSec = Math.max(1e-6, p.beats[phase] - dwell)
    return start + turnSec / 2 + dwell / 2
  }
  return start
}

/**
 * Snap the animation clock to the twos grid, wherever the camera is parked.
 *
 * Quantising TIME rather than each channel is what makes the cadence honest:
 * every value the sampler produces at that instant — pose, ink, depth, shade,
 * shadow, junctions — comes from the same held step, so nothing can drift onto
 * ones behind the others. The grid never crosses a phase boundary, so a beat's
 * first frame is always its own first frame and a retimed clip cannot slide the
 * cadence of the clip before it.
 */
/**
 * WHICH PHASES MAY RUN ON TWOS — which is "the parked ones", and under a parked
 * camera that is nearly all of them.
 *
 * `PARKED_PHASES` excludes `tilt`, `standup` and `descend` for one stated
 * reason and it is Whitaker/Halas/Sito's: *"it is dangerous to animate on
 * double frames during a table move or camera track."* The exclusion is about
 * the CAMERA TRACK, not about those three phases — so the moment the camera
 * stops tracking, the reason evaporates and the whole beat becomes eligible.
 *
 * `draw` stays out on every arm, deliberately and for the reason
 * `PARKED_PHASES` already gives: quantising the draw quantises the handwriting,
 * and that is a hand-feel call nobody has taken.
 */
export function parkedPhases(p: HeroMotionParams): readonly HeroPhase[] {
  if (p.camera === "prior") return PARKED_PHASES
  // ...except on `solidFirst`, where the `draw` clip carries no pen at all — it
  // is two empty frames and a pop-in settle. There is no handwriting in it to
  // quantise, so the exclusion has nothing left to protect and the arrival gets
  // the same exposure as the rest of the film.
  const keepDrawOnOnes = p.shape !== "solidFirst"
  /* ⚠ O5 TAKES THE CASCADE OFF TWOS, and it is the same argument `draw` wins on
   * rather than a new one.
   *
   * The exclusion protects motion whose CHARACTER is the thing being watched. A
   * whole-word turn is 13 frames and reads fine at 12 Hz — six and a half
   * exposures across it. A letter's flip is 9 frames, which is FOUR exposures:
   * ink, part-turned, sliver, stood. At that count the eye reads the steps
   * rather than the turn, which is the board's own warning about this option
   * from the other side (*"at that cadence the eye registers THAT something
   * changed, never WHAT"*).
   *
   * The RANK HOLD keeps its twos, and that is where twos earns its keep here:
   * `solid` is the payoff and twos is what makes its frames byte-identical by
   * construction rather than by hoping. */
  const cascadeOnOnes = p.shape === "letterByLetter"
  return HERO_PHASES.filter(
    (ph) => !(keepDrawOnOnes && ph === "draw") && !(cascadeOnOnes && ph === "emerge"),
  )
}

export function quantiseHeroTime(p: HeroMotionParams, tSec: number): number {
  if (p.cadence !== "twos" || !(p.cadenceHz > 0)) return tSec
  const off = phaseOffsets(p)
  let phase: HeroPhase = HERO_PHASES[0]
  for (const ph of HERO_PHASES) if (tSec >= off[ph]) phase = ph
  if (!parkedPhases(p).includes(phase)) return tSec
  const start = off[phase]
  const anchor = twosAnchor(p, phase, start)
  const q = anchor + Math.floor((tSec - anchor) * p.cadenceHz) / p.cadenceHz
  return q < start ? start : q
}

/**
 * Where the rise starts its elevation from — and therefore where the tilt has
 * to hand the camera over.
 *
 * `lieEl` is the pose: the deepest the camera ever looks down at the page. The
 * rise gathers UP before it commits, by `riseGatherDepth` of its own travel, so
 * if the tilt delivered the camera to `lieEl` the gather would carry it PAST
 * the pose — 70.3° against a dial that says 65 (see `tiltLaw`). Solving
 *
 *   start + gatherDepth·(start − end) = lieEl
 *
 * for `start` puts the gather's turning point exactly on `lieEl` instead. With
 * the shipped numbers that is 60.0°, and the last 5° of the lie-down is the
 * rise's own wind-up rather than a second one stacked on the first.
 */
export function riseStartEl(p: HeroMotionParams): number {
  if (p.tiltLaw === "prior") return p.lieEl
  const end = p.cameraPark === "prior" ? p.standupEl : p.holdEl
  const d = Math.max(0, p.riseGatherDepth)
  return (p.lieEl + d * end) / (1 + d)
}

/**
 * The velocity the tilt must arrive at, as a multiple of its own average speed,
 * so that the seam into the rise's gather carries no step.
 *
 * Read straight off `riseEase`'s own gather term — `−d·sin(πu/g)`, whose slope
 * at `u = 0` is `−d·π/g` — rather than fitted, so retuning the gather retunes
 * the handover with it and the two cannot drift apart. If the gather is
 * disabled the tilt correctly arrives at rest, because there is nothing to hand
 * over to.
 */
export function tiltHandoverSlope(p: HeroMotionParams): number {
  if (p.tiltLaw === "prior") return 0
  const start = riseStartEl(p)
  const end = p.cameraPark === "prior" ? p.standupEl : p.holdEl
  const g = p.riseGatherFrac
  if (!(g > 0) || !(p.beats.standup > 0) || !(p.beats.tilt > 0) || !(start > 0)) return 0
  const gatherV0 = ((end - start) * ((-p.riseGatherDepth * Math.PI) / g)) / p.beats.standup
  const tiltAvgV = start / p.beats.tilt
  return tiltAvgV > 0 ? gatherV0 / tiltAvgV : 0
}

export interface HeroSample {
  phase: HeroPhase
  /** Progress within the current phase, 0..1. */
  phaseT: number
  /** Camera azimuth, degrees. */
  az: number
  /** Camera elevation, degrees. High = looking down at the lying form. */
  el: number
  /** Distance multiplier; smaller = closer. */
  fill: number
  /** Draw-in progress for the reveal harness, 0..1. */
  reveal: number
  /** Anticipation squash, applied to the flat face. 1 = no squash. */
  squashX: number
  squashY: number
  /**
   * 1 = flat ink on a page: the form renders as one constant-value silhouette
   * with no shading, no specular and no rim, which is what a drawing IS.
   * 0 = the lit three-dimensional object. Anything between is the same surface
   * part-way through catching the light — never two surfaces dissolving.
   */
  flat: number
  /** Multiplier on the form's own depth. Rises from ~0 with a swell. */
  depth: number
  /** The mark's yaw about its own vertical axis, radians. The camera is parked. */
  yaw: number
  /**
   * O2's HINGE — the mark's pitch about its own baseline, radians. 0 on every
   * film but `popUp`, where it is the whole event: the drawing stands up off
   * the page instead of the camera tilting down to look at it.
   *
   * A sibling of `yaw` and not of `el` on purpose. See `FlatState.pitch`.
   *
   * ⚠ OPTIONAL, AND THAT IS LOAD-BEARING RATHER THAN LAZY. `sampleHeroMotion`
   * has a documented fast path — *"on the shipped film with the shipped camera
   * nothing below runs, so the sample object is the one this file has always
   * produced, allocation for allocation"* — and every existing return site in
   * `samplePriorProgram` builds its object literally. A REQUIRED field would
   * force a spread onto that fast path and break exactly the guarantee it
   * exists to make. Absent means 0, and only `popUp` ever writes it.
   */
  pitch?: number
  /**
   * O5's CASCADE — one entry per letter, or absent on every other film.
   *
   * Optional for `pitch`'s reason, and it is the same guarantee: the fast path
   * must stay allocation-for-allocation what this file has always produced, and
   * a REQUIRED field would force an array onto six films that have no letters.
   * Absent means *"this film has one body, not eleven"*, which is true of every
   * film but this one.
   *
   * The RENDERER owns where a letter is; this owns when it moves. Each entry
   * carries no pivot, because a pivot measured here would be a second source of
   * truth for a number the geometry already knows — board §4 O5's *"a mis-placed
   * axis makes a letter sweep sideways instead of turning in place."*
   */
  letters?: readonly LetterState[]
  /** The turning face's darkening, 0..1. See `HeroEmerge.turnShade`. */
  shade: number
  /** The contact shadow's own opacity. Lands late; it is K4's one arrival. */
  shadow: number
  /** The drawing's junctions: 0 fused, 1 open. K7's one arrival. */
  jointBreak: number
  /**
   * How far the silhouette is carved back to the pen's own outline, 0 tube,
   * 1 the nib's. Rides `flat`; see `sampleForm` for why it has no clock of its
   * own, and `HeroMotionParams.carveLaw` for what it buys.
   */
  penCarve: number
}

/**
 * THE WIND-UP, AS ONE LAW SPANNING TWO PHASES — which is the whole fix.
 *
 * It used to live inside the `anticipation` branch, and that is exactly why the
 * release was a cliff: a branch that owns one phase can only ever return the
 * tension to rest by ending. The tense is now computed from absolute time, so
 * it can outlive its own clip and unwind INSIDE the turn.
 *
 *     [ wait ][ compress ][ hold ] | [ release ] .......... the turn
 *     |------ anticipation ------- | ---------- emerge ---------------
 *
 * `wait` is the clip's remainder, so both authored numbers are live and the
 * timeline still owns the total (see `anticipation.holdSec`). `release` runs on
 * `t³`, whose value-half at 79.4% sits inside the reference set's own wind-up
 * band (see `anticipation.releaseSec`).
 *
 * Returned as a fragment so every branch of the sampler spreads the SAME value.
 * The previous shape repeated `squashX: 1, squashY: 1` at eleven return sites
 * and computed it at a twelfth; twelve copies of one law is how a rebuild loses
 * one of them, and this file has already paid for that once with a dead channel.
 */
function squashAt(
  p: HeroMotionParams,
  t: number,
  off: Record<HeroPhase, number>,
): { squashX: number; squashY: number } {
  const REST = { squashX: 1, squashY: 1 }
  const a = p.anticipation

  /* ---- THE POP-IN, on the two shapes whose form ARRIVES rather than emerges --
   *
   * `solidFirst` and `cutaway` both open on a form that is simply there, and
   * both use the same settle: 86 % scale, 750 ms, ease-out — Exquisite Corpse's
   * sheet pop-in, number for number, spaced at a value-half of 19.5 % which is
   * inside the reference set's arrival band (9–37 %, `reference-film-mechanics`
   * §6.5). Without it an appearance is a frame drop; with it, it is an arrival.
   *
   * It rides the squash channel rather than a new one because the squash is
   * already pinned to the mark's own CONTACT (`viewport-3d.tsx` sets the pivot's
   * Y to `box.min.y`), so a uniform 0.86 settles the form ONTO the page instead
   * of growing it about its middle. Same channel, and the anticipation's tense
   * is unreachable on these two shapes anyway — neither has a wind-up, because
   * neither has a transform on screen to wind up for. */
  if (p.shape === "solidFirst" || p.shape === "cutaway") {
    const popAt =
      p.shape === "solidFirst"
        ? off.draw + Math.max(0, p.openEmptySec)
        : off.emerge + Math.max(0, p.absenceSec)
    // Before the pop and after the closing absence the mark is either absent or
    // a drawing, and a drawing does not settle onto anything.
    if (t < popAt || (p.shape === "cutaway" && t >= off.descend)) return REST
    const u = p.popSettleSec > 0 ? clamp01((t - popAt) / p.popSettleSec) : 1
    const s = p.popScale + (1 - p.popScale) * easeOutStrong(u)
    return { squashX: s, squashY: s }
  }

  if (t < off.anticipation) return REST

  const span = Math.max(0, p.beats.anticipation)
  const prior = p.releaseLaw === "prior"

  // The release is clamped to the turn-OUT, never past the edge: a tense still
  // unwinding at the sliver would be a second thing moving through the moment,
  // and the moment's whole claim is that it is the only thing on screen.
  const turnOut = Math.max(0, (p.beats.emerge - Math.max(0, p.emerge.dwellSec)) / 2)
  const release = prior ? 0 : Math.min(Math.max(0, a.releaseSec), turnOut)

  if (t >= off.emerge + release) return REST

  let k: number
  if (t >= off.emerge) {
    // THE RELEASE — inside the turn, spaced as a wind-up. `t³` leaves the hold
    // at zero velocity and accelerates away, so the tension is still nearly
    // whole through the turn's silent leading frames and lets go as the
    // narrowing arrives. See `anticipation.releaseSec` for the two measurements.
    const r = release > 0 ? clamp01((t - off.emerge) / release) : 1
    k = 1 - r * r * r
  } else {
    const local = t - off.anticipation
    const compress = Math.max(0, a.compressSec)
    if (prior) {
      // PARKED, verbatim: compress from the phase start, hold to the phase end.
      k = local < compress && compress > 0 ? easeOutStrong(clamp01(local / compress)) : 1
    } else {
      // Scaled together rather than clipped, so a retimed clip keeps the shape
      // of the tense instead of losing its tail.
      const hold = Math.max(0, a.holdSec)
      const need = compress + hold
      const s = need > span && need > 0 ? span / need : 1
      const c = compress * s
      const wait = Math.max(0, span - c - hold * s)
      k = local < wait ? 0 : c > 0 ? easeOutStrong(clamp01((local - wait) / c)) : 1
    }
  }

  return { squashX: 1 + (a.scaleX - 1) * k, squashY: 1 + (a.scaleY - 1) * k }
}

/**
 * WHERE A PARKED CAMERA IS AT TIME `t` — one of exactly two framings, and never
 * anything in between.
 *
 * Exported because the cut instants have to be checkable from outside:
 * `assert-hero-options.mjs` reads this to prove that the two framings sit
 * ≥ 30° apart, that every frame of a parked law is byte-identical to the last
 * one in az/el/fill, and that a cut lands where the mark is not moving.
 *
 * ⚠ `fill` IS CONSTANT ON ALL THREE, AND THAT IS THE PUSH BEING CUT. The
 * shipped beat descends 1.0 → 0.86 → 0.80 so *"the payoff arrives at its most
 * present"*, and the board cuts it with the rest of the camera: *"a push on a
 * lone object in an empty frame is a zoom, and with nothing to be parallaxed
 * against, a dolly is indistinguishable from a zoom"* (`storyboarding.md` §4).
 * It also buys something the shipped beat could not have — K1 and K7 at the
 * identical scale, which is what makes the round trip an identity claim rather
 * than a resemblance.
 */
export function parkedCamera(
  p: HeroMotionParams,
  tSec: number,
): { az: number; el: number; fill: number } {
  const dead = { az: 0, el: 0, fill: p.fillLie }
  const desk = { az: p.deskAz, el: p.deskEl, fill: p.fillLie }
  if (p.camera === "deadOn") return dead
  if (p.camera === "desk") return desk
  /* C-C. The cut lands at the top of `tilt` and cuts back at the top of
   * `descend` — the two phases the board cut for being glides, each replaced by
   * the cut it was covering for. Both are preceded by a hold (`solid` is K4 held
   * and `orbit` is the payoff hold), which is the grammar's own condition:
   * *"cuts are preceded by a hold and land on stillness"*. */
  const off = phaseOffsets(p)
  return tSec >= off.tilt && tSec < off.descend ? desk : dead
}

/**
 * The angular separation between C-C's two framings, in degrees — the number the
 * 30-degree rule is about.
 *
 * A framing is a view DIRECTION, so the separation is the angle between two unit
 * vectors and not the difference of two dial readings: at az 20 / el 30 against
 * dead-on it is **35.5°**, where naively subtracting azimuths would have said
 * 20° and failed the rule. Computed rather than asserted in prose so moving
 * either dial moves the verdict.
 */
export function cutSeparationDeg(p: HeroMotionParams): number {
  const dir = (azDeg: number, elDeg: number) => {
    const az = azDeg * DEG
    const el = elDeg * DEG
    return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)]
  }
  const a = dir(0, 0)
  const b = dir(p.deskAz, p.deskEl)
  const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))
  return Math.acos(dot) / DEG
}

/**
 * THE DRAW-IN PLAYHEAD, INCLUDING THE FRAMES WHERE THERE IS NO DRAWING.
 *
 * `reveal` is how much of the word has been laid down, and two of the four
 * shapes need it to go back to zero mid-film — which is a use the channel has
 * never had and is exactly what it is for.
 *
 * **The absence is `reveal`, not `flat` or an opacity.** A drawing driven to
 * zero thickness is still a drawing on the page; a drawing at zero reveal is the
 * page. `cutaway`'s whole idea is *the page your drawing just left*, and there
 * is no version of that where a sliver of ink is still lying in the frame. It is
 * also why the absence is a CUT at both ends and never a fade: the reference
 * set's absences are cuts, one frame each end, and *"a fade would be a third
 * device in a film whose one idea is that there is no device"*.
 */
function revealAt(
  p: HeroMotionParams,
  t: number,
  off: Record<HeroPhase, number>,
  shipped: number,
): number {
  if (p.shape === "solidFirst") {
    // Two frames of empty page, then the solid is there. all4-idents blanks
    // exactly two before every build.
    return t < off.draw + Math.max(0, p.openEmptySec) ? 0 : 1
  }
  if (p.shape === "cutaway") {
    const absenceEnd = off.emerge + Math.max(0, p.absenceSec)
    if (t >= off.emerge && t < absenceEnd) return 0 // the ink is gone
    if (t >= off.descend && t < off.returnTurn) return 0 // and again, on the way out
    return shipped
  }
  return shipped
}

/**
 * The whole beat as a pure function of elapsed seconds. This is what the live
 * tuner samples every frame, and it is deliberately total: any time outside the
 * timeline clamps to the first or last pose rather than throwing.
 *
 * TWO LAYERS, AND THE ORDER IS THE POINT. `samplePriorProgram` produces the
 * shipped four-move camera; `parkedCamera` overwrites az/el/fill when a parked
 * law is selected. The program is not deleted or branched into — it is
 * OVERRIDDEN, so the shipped camera stays exactly one dial away and every
 * assertion written against it keeps reading the same code path (§0.7).
 */
export function sampleHeroMotion(p: HeroMotionParams, tSec: number): HeroSample {
  // THE CLOCK IS QUANTISED ONCE, HERE, AND EVERYTHING DOWNSTREAM READS IT.
  // `sampleEmerge` and `sampleReturn` stay pure functions of raw time on
  // purpose — the turn's own assertions read them directly, so the ported
  // numbers are checked against the law and not against the exposure.
  const t = quantiseHeroTime(p, Math.max(0, Math.min(tSec, totalDuration(p))))
  const s = samplePriorProgram(p, t)
  // The fast path is also the byte-identity guarantee: on the shipped film with
  // the shipped camera nothing below runs, so the sample object is the one this
  // file has always produced, allocation for allocation.
  if (p.camera === "prior" && p.shape === "shipped") return s
  const reveal = revealAt(p, t, phaseOffsets(p), s.reveal)
  /* O2's hinge. Computed here rather than inside `samplePriorProgram` so the
   * fast path above stays byte-identical — see `HeroSample.pitch`. It is 0 on
   * every film but `popUp`, so the spread costs nothing anywhere else. */
  const pitch = pitchAt(p, t)
  /* O5's cascade. `undefined` on every other film, so the spread below costs
   * one property write and no allocation anywhere else — the same bargain
   * `pitch` makes. */
  const letters = sampleLetters(p, t)
  return p.camera === "prior"
    ? { ...s, reveal, pitch, letters }
    : { ...s, reveal, pitch, letters, ...parkedCamera(p, t) }
}

/**
 * O2'S HINGE LAW — how far the mark has stood up, radians, at time `t`.
 *
 * Zero on every film but `popUp`. On `popUp` it is the film's ONLY event, so it
 * carries the spacing the board specified and the reasoning is worth stating:
 *
 * **THE STAND IS BACK-LOADED (`popStandFH` = 0.67).** Not the 45-55 % a
 * mechanism gets. `paper-street`'s cut-out is the only measured
 * flat-thing-stands-up in either reference corpus and it spaces at 67 % — it
 * leans up slowly and commits late, which is a made thing standing rather than
 * a machine cycling. The board flags 50 % as the reference-legal fallback if
 * 67 % reads as performed; the difference is 3 frames of commit, and it is a
 * dial (`popStandFH`) rather than a constant for exactly that reason.
 *
 * **THE LIE-BACK IS ARRIVAL-SPACED**, 20-30 %, the same grammar every other
 * landing in this beat uses: most of the travel early, the last of it eased
 * out. A symmetric lie-back reads as the hinge being wound backwards.
 *
 * **IT HOLDS DEAD STILL THROUGH `solid`.** A hold only reads as a hold if
 * something stopped; a hinge that keeps creeping through the money frame is the
 * "it just dollies side to side" read the whole board is a reaction to.
 */
function pitchAt(p: HeroMotionParams, t: number): number {
  /* Both hinged films. `standTurn` is O2's stand with a turn spliced into its
   * hold, so the hinge law is the SAME law — the "hold standing" clause below
   * already spans `solid`, `orbit` and `descend`, which is exactly the window
   * the turn happens in. It stands, it stays stood while it turns, it lies
   * back. */
  if (p.shape !== "popUp" && p.shape !== "standTurn") return 0
  const b = p.beats
  const off = phaseOffsets(p)
  /* THE REST POSE IS LYING DOWN, AND GETTING THIS BACKWARDS IS THE FIRST
   * VERSION OF THIS FUNCTION — recorded because the render is what caught it
   * and the model could not have.
   *
   * The renderer's mark is a BILLBOARD: at pitch 0 it stands in the XY plane
   * facing the camera, which is why the shipped beat's turn is a yaw about Y
   * and why K2's squash presses it down about `box.min.y`. So 0 is already
   * upright. The first version ran 0 → +78°, i.e. it took a mark that was
   * standing and TIPPED IT OVER: filmed, the word swept across the frame like a
   * propeller and settled showing its own back (`opt-popup` frames 660-703).
   *
   * A pop-up has to START on the desk. So the film's rest pose is -90° — the
   * mark lying face-up on the ground, its top edge away from the camera, which
   * at the desk camera's 30° of elevation is a page seen at three-quarters —
   * and the stand RAISES it toward upright. `popStandDeg` is therefore the
   * TRAVEL, not the destination: 78° of travel lands at -12°, leaning 12° back
   * off vertical, which is what keeps the face legible instead of presenting
   * its edge. */
  const lie = -90 * DEG
  const travel = Math.max(0, p.popStandDeg) * DEG
  const standing = lie + travel
  // Lying on the desk for the draw, the breath and the press. The word is
  // written on the page it is lying on, which is the film's whole premise.
  if (t < off.emerge) return lie
  // THE STAND.
  if (t < off.emerge + b.emerge) {
    const u = b.emerge > 0 ? clamp01((t - off.emerge) / b.emerge) : 1
    return lie + travel * backLoaded(u, p.popStandFH)
  }
  // Standing, dead still, through `solid` — the money frame.
  if (t < off.returnTurn) return standing
  // THE LIE-BACK, arrival-spaced.
  if (t < off.returnTurn + b.returnTurn) {
    const u = b.returnTurn > 0 ? clamp01((t - off.returnTurn) / b.returnTurn) : 1
    return standing - travel * easeOutStrong(u)
  }
  return lie
}

/**
 * SPACING WITH A CHOSEN FIRST-HALF SHARE.
 *
 * `fh` is the fraction of the TRAVEL spent in the first half of the TIME, which
 * is how every spacing number in this repo's reference notes is quoted. 0.5 is
 * linear; below 0.5 is back-loaded (slow lean, late commit); above 0.5 is
 * front-loaded. Implemented as a power curve solved for that share, so the
 * quoted number and the rendered curve cannot drift:
 *
 *     f(t) = t^k   with   k = ln(fh) / ln(0.5)
 *
 * At fh = 0.67 → k ≈ 0.578 (front-loaded); at 0.33 → k ≈ 1.60. The board quotes
 * paper-street's stand as "FH 67 %, back-loaded: it leans up slowly and commits
 * late" — those two clauses describe the SAME curve read from opposite ends
 * (two thirds of the ANGLE is bought in the first half of the time, so the last
 * third is spread over the whole second half: it commits late). The share is
 * what is measurable off a film, so the share is the parameter.
 */
function backLoaded(t: number, fh: number): number {
  const s = fh <= 0 || fh >= 1 ? 0.5 : fh
  return Math.pow(clamp01(t), Math.log(s) / Math.log(0.5))
}

/** The shipped camera program. `t` arrives already quantised — see above. */
function samplePriorProgram(p: HeroMotionParams, t: number): HeroSample {
  const b = p.beats
  const off = phaseOffsets(p)

  // (The lying pose no longer needs naming: the tense happens dead-on now, and
  // it was the only branch that spread it.)
  // One continuous flat→solid→flat state, sampled once and attached to
  // whatever phase happens to own this instant. See `sampleForm`.
  const em = sampleForm(p, t)
  // ONE law, spread by every branch — see `squashAt`. Outside the tense and its
  // release it is `{1, 1}`, which is what every branch used to hardcode.
  const sq = squashAt(p, t, off)

  if (t < off.breath) {
    const u = b.draw > 0 ? clamp01((t - off.draw) / b.draw) : 1
    // Dead-on while the ink writes itself: the page IS the screen.
    return {
      phase: "draw",
      phaseT: u,
      az: 0,
      el: 0,
      fill: p.fillLie,
      reveal: drawEase(u, p.drawLinearBlend),
      ...sq,
      ...em,
    }
  }

  if (t < off.anticipation) {
    const u = b.breath > 0 ? clamp01((t - off.breath) / b.breath) : 1
    return { phase: "breath", phaseT: u, az: 0, el: 0, fill: p.fillLie, reveal: 1, ...sq, ...em }
  }

  if (t < off.emerge) {
    // THE TENSE — now DEAD-ON and BEFORE the moment it winds up for.
    //
    // It used to fire after the tilt, at el 65°, where the word is a 47px-tall
    // bar and the squash measured as 0.80s of ±3px jitter on an illegible
    // frame. A 2D squash is the only wind-up available to something with no
    // thickness, and it is the only shot that makes the moment EXPECTED —
    // without it the turn reads as a glitch rather than as a release.
    //
    // ⚠ AND IT NO LONGER OWNS THE SQUASH. The tense used to be computed here,
    // which is precisely why it could only end by the phase ending — a +4.71%
    // snap in one frame, two frames before the turn was visible at all. The law
    // is `squashAt` now and it spans this phase and the turn's opening.
    const local = t - off.anticipation
    return {
      phase: "anticipation",
      phaseT: b.anticipation > 0 ? clamp01(local / b.anticipation) : 1,
      az: 0,
      el: 0,
      fill: p.fillLie,
      reveal: 1,
      ...sq,
      ...em,
    }
  }

  if (t < off.land) {
    // THE MOMENT. Camera dead-on and perfectly still — every pixel that moves
    // here is the object itself changing, which is the only way the change can
    // be read as belonging to the object rather than to the viewpoint.
    const u = b.emerge > 0 ? clamp01((t - off.emerge) / b.emerge) : 1
    return { phase: "emerge", phaseT: u, az: 0, el: 0, fill: p.fillLie, reveal: 1, ...sq, ...em }
  }

  if (t < off.solid) {
    // THE SHADOW LANDS, and nothing else does. The camera has not moved since
    // the breath and does not move here; the only thing on screen that changes
    // is the contact shadow arriving under the form, four frames after the face
    // did. One piece of news (§10.5 call 1).
    //
    // 🔴 ON `/desk-doodles` NOTHING ON SCREEN CHANGES AT ALL, AND THE PRICE IS
    // 0.90 CONSECUTIVE SECONDS. Filmed 2026-09-05 at one frame of 30fps: 27
    // consecutive samples from t=6.997 to t=7.883 report `changed = 0` with ink
    // pinned at 35786, while the MODEL drives its shadow channel 0.00 -> 0.67 ->
    // 1.00 across exactly the `shadowLagSec` + `shadowSec` window this phase is
    // sized to (read live off the page's own "Live: shadow" line). So the
    // secondary action is computed, correctly timed, and drawn by nothing.
    //
    // The page already declares the half of this it knows: *"Not on screen yet:
    // the paper break and the shadow's own timing are drawn by the viewport,
    // which is a separate lane."* What no one had measured is that the gap
    // costs this phase's 0.30s PLUS `solid`'s 0.60s hold behind it, landing
    // immediately after the beat's only moment, which is the one place a beat
    // can least afford to stop. `solid` was sized as a held A/B frame on the
    // assumption that `land` had just delivered a move.
    //
    // ⚠ SO THE 0.30s IS NOT SPARE TIME. Shortening `land` would be reading this
    // note as "the phase does nothing" when what it says is "the phase's move
    // has no renderer". Filed as a row against the viewport rather than tuned
    // here. Sheet `docs/verification/anim-audit/hero/sheets/FINE-land.png`,
    // numbers `docs/verification/anim-audit/hero/fine.json`.
    const u = b.land > 0 ? clamp01((t - off.land) / b.land) : 1
    return { phase: "land", phaseT: u, az: 0, el: 0, fill: p.fillLie, reveal: 1, ...sq, ...em }
  }

  if (t < off.tilt) {
    // K4 — SOLID, DEAD-ON, HELD. K1's exact framing, everything stopped. This
    // is the frame the audience A/Bs against its memory of K1, and it is the
    // payoff of the sliver's absence (§10.2 C7). Nothing in it moves.
    const u = b.solid > 0 ? clamp01((t - off.solid) / b.solid) : 1
    return { phase: "solid", phaseT: u, az: 0, el: 0, fill: p.fillLie, reveal: 1, ...sq, ...em }
  }

  if (t < off.standup) {
    // The page tips back — the now-solid mark is revealed lying on it. This is
    // the ONE shot in the beat that does not arrive: the rise begins on the
    // very next frame and continues in the same direction, so the tilt hands
    // the camera over at the rise's own starting speed rather than stopping in
    // front of it. See `tiltLaw` for the two measurements that force it.
    const u = b.tilt > 0 ? clamp01((t - off.tilt) / b.tilt) : 1
    const e =
      p.tiltLaw === "prior"
        ? easeInOutStrong(u)
        : handoffEase(u, p.moveAccelFrac, tiltHandoverSlope(p))
    return {
      phase: "tilt",
      phaseT: u,
      az: 0,
      el: riseStartEl(p) * e,
      fill: p.fillLie,
      reveal: 1,
      ...sq,
      ...em,
    }
  }

  if (t < off.orbit) {
    const u = b.standup > 0 ? clamp01((t - off.standup) / b.standup) : 1
    /* `backC1` IS THE ANTICIPATION SWITCH, ON BOTH CURVES — and honouring that
     * here is a REGRESSION FIX, not a refinement.
     *
     * `backC1`'s own doc says *"Zero turns the curve into a plain ease-in-out
     * with no anticipation"*, and `app/desk-doodles/page.tsx:661` is built on
     * exactly that: under `prefers-reduced-motion` it plays
     * `{ ...motion, emerge: { overshoot: 0 }, backC1: 0 }`. That worked while
     * the rise ran on `easeInOutBack`, which reads `backC1`.
     *
     * `riseCurve: "riseOut"` does not read it. It takes its dip from
     * `riseGatherDepth` and its overshoot from `emerge.overshoot`, so when
     * `riseOut` became the default the reduced-motion switch silently stopped
     * reaching the counter-dip. Measured off this sampler over the `standup`
     * phase, no browser:
     *
     *     riseOut + reduced motion   el 0.00   az  -3.80 deg   fill +0.0200
     *     prior   + reduced motion   el 0.00   az   0.00 deg   fill  0.0000
     *
     * So a reader who asks for less motion still gets the camera swinging 3.8
     * degrees the wrong way and pushing 2% past its own framing. The rise
     * rebalance broke it and nothing re-ran the reduced-motion assertion after.
     *
     * Reading the switch here fixes it with NO edit to the page, which is the
     * point: the contract the consumer already relies on is honoured rather
     * than a second dial being invented for it to remember. */
    const gather = p.backC1 === 0 ? 0 : p.riseGatherDepth
    const e =
      p.riseCurve === "prior"
        ? easeInOutBack(u, p.backC1)
        // `riseOvershoot`, not `emerge.overshoot`: the rise's overshoot is the
        // rise's. See `riseOvershoot` for the mislabel this closes.
        : riseEase(u, p.riseGatherFrac, gather, p.riseOvershoot)
    // When the camera is parked the rise lands on the HELD pose directly, so
    // the az 30 -> 38 that used to be spent drifting is folded into the settle
    // and arrives with the move that earns it.
    const azEnd = p.cameraPark === "prior" ? p.standupAz : p.holdAz
    const elEnd = p.cameraPark === "prior" ? p.standupEl : p.holdEl
    const fillEnd = p.cameraPark === "prior" ? p.fillStand : p.fillHold
    // Elevation starts where the TILT left the camera, not at `lieEl`. Under
    // `tiltLaw: "handover"` those differ by exactly the gather's depth, so the
    // gather's turning point lands ON `lieEl` instead of 5.3° past it. Azimuth
    // and fill still start from the parked pose and gather from rest, and they
    // are the channels where the wind-up actually reads: nothing moved them
    // during the tilt, so their counter-move is against stillness rather than
    // against 60° of the same direction.
    const elStart = riseStartEl(p)
    return {
      phase: "standup",
      phaseT: u,
      az: azEnd * e,
      el: elStart + (elEnd - elStart) * e,
      fill: p.fillLie + (fillEnd - p.fillLie) * e,
      reveal: 1,
      ...sq,
      ...em,
    }
  }

  if (t < off.descend) {
    const u = b.orbit > 0 ? clamp01((t - off.orbit) / b.orbit) : 1
    // PARKED: the rise already arrived at the held pose, so this phase is a
    // dead hold and every value below is a constant. That is the point — the
    // beat's own measurement showed the frame still GROWING when the film
    // ended (width +4px, ink +2.9% over the final 1.33s), which is what "it
    // never stops" actually looked like in numbers.
    const e = p.cameraPark === "prior" ? driftEase(u, p.driftCut) : 1
    const azFrom = p.cameraPark === "prior" ? p.standupAz : p.holdAz
    const elFrom = p.cameraPark === "prior" ? p.standupEl : p.holdEl
    const fillFrom = p.cameraPark === "prior" ? p.fillStand : p.fillHold
    return {
      phase: "orbit",
      phaseT: u,
      az: azFrom + (p.holdAz - azFrom) * e,
      el: elFrom + (p.holdEl - elFrom) * e,
      fill: fillFrom + (p.fillHold - fillFrom) * e,
      reveal: 1,
      ...sq,
      ...em,
    }
  }

  /* ---- THE ROUND TRIP ------------------------------------------------------
   * Under `ret.mode: "prior"` these three beats are the ¾ hold continuing —
   * the beat ending by stopping, which is what shipped. Otherwise the camera
   * squares back up to K1's framing, the mark turns back through its own edge,
   * and the drawing comes back carrying its pen order. */
  const parkedThreeQuarter = p.ret.mode === "prior"

  if (t < off.returnTurn) {
    // THE MARK LIES BACK DOWN. The only camera move after the rise, and the
    // only one the board's exposure sheet does not have a row for — see
    // `HeroBeats.descend`. Ease-out dominant, like every move in the reference
    // set (§6.1), and it now has the acceleration that sentence also asks for:
    // no gather, because a return is an arrival and not a launch, but it leaves
    // the hold over ~2.5 frames rather than in one. `endSlope` is 0 because it
    // DOES arrive — `returnTurn` is parked, so anything left over would be a
    // camera still moving under a mark that has started to turn.
    const u = b.descend > 0 ? clamp01((t - off.descend) / b.descend) : 1
    const e = parkedThreeQuarter
      ? 0
      : p.descendLaw === "prior"
        ? easeOutStrong(u)
        : handoffEase(u, p.moveAccelFrac, 0)
    return {
      phase: "descend",
      phaseT: u,
      az: p.holdAz * (1 - e),
      el: p.holdEl * (1 - e),
      fill: p.fillHold + (p.fillLie - p.fillHold) * e,
      reveal: 1,
      ...sq,
      ...em,
    }
  }

  if (t < off.hold) {
    // THE RETURN TURN. Parked at K1's framing, exactly as the out-turn was —
    // the camera did not participate in the first moment and does not
    // participate in this one.
    const u = b.returnTurn > 0 ? clamp01((t - off.returnTurn) / b.returnTurn) : 1
    return {
      phase: "returnTurn",
      phaseT: u,
      az: parkedThreeQuarter ? p.holdAz : 0,
      el: parkedThreeQuarter ? p.holdEl : 0,
      fill: parkedThreeQuarter ? p.fillHold : p.fillLie,
      reveal: 1,
      ...sq,
      ...em,
    }
  }

  // K7 — HELD FLAT, at K1's framing, and changed. The round trip closes.
  const u = b.hold > 0 ? clamp01((t - off.hold) / b.hold) : 1
  return {
    phase: "hold",
    phaseT: u,
    az: parkedThreeQuarter ? p.holdAz : 0,
    el: parkedThreeQuarter ? p.holdEl : 0,
    fill: parkedThreeQuarter ? p.fillHold : p.fillLie,
    reveal: 1,
    ...sq,
    ...em,
  }
}

export interface CameraFrame {
  phase: HeroPhase
  az: number
  el: number
  fill: number
}

/**
 * The capture-side program: one entry per OUTPUT frame of every beat that shows
 * the 3D form — emerge, tilt, anticipation, stand-up, orbit — matching
 * `scripts/capture/motion.mjs.cameraProgram()`. The draw and breath beats are
 * flat-raster only, and the hold reuses the final orbit frame (the camera is
 * still there by construction, because the drift ends at zero velocity), so
 * neither needs an entry.
 *
 * The tilt is IN here, rather than faked in the compositor, because a 2D
 * vertical scale cannot produce perspective: no near-edge-larger-than-far-edge
 * means nothing in the image says "receding". The real projection says it for
 * free.
 */
export function cameraProgram(p: HeroMotionParams = DEFAULT_HERO_MOTION): CameraFrame[] {
  /* DERIVED, NOT RESTATED. This used to be a second copy of the choreography —
   * its own loop per phase, its own easing calls — and it had already fallen
   * out of step: it emitted `anticipation` AFTER `tilt`, months after
   * `HERO_PHASES` moved the tense before the turn, so the program and the
   * sampler disagreed about the order of the beat. A capture driven from it
   * would have filmed the beat this board exists to replace.
   *
   * Sampling `sampleHeroMotion` instead makes that class of drift
   * unrepresentable: there is one choreography, and this is a projection of
   * it onto output frames. */
  const frames: CameraFrame[] = []
  const total = totalDuration(p)
  const n = secToFrames(total, p.fps)
  for (let i = 0; i < n; i++) {
    const s = sampleHeroMotion(p, (i + 0.5) / p.fps)
    frames.push({ phase: s.phase, az: s.az, el: s.el, fill: s.fill })
  }
  return frames
}

/**
 * Emit the tuned values as a paste-able block for `scripts/capture/motion.mjs`.
 *
 * The two files cannot import each other — motion.mjs is plain ESM run by node
 * with no build step, this is TypeScript compiled by Next — so the honest way
 * to close the loop is to make the transfer explicit and mechanical rather than
 * pretend it is automatic. Tune live, paste, re-capture.
 */
export function toMotionMjsSource(p: HeroMotionParams): string {
  const n = (v: number) => (Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4))))
  const beats = HERO_PHASES.map((ph) => `  ${ph}: ${n(p.beats[ph])},`).join("\n")
  return `export const FPS = ${n(p.fps)}

// THE PHASE ORDER IS PART OF THE PROGRAM, not a formatting choice. It is
// \`HERO_PHASES\` in lib/hero-motion.ts and the sampler walks it in this
// sequence; a paste that reorders these keys is a paste that changes the beat.
export const PHASES = [${HERO_PHASES.map((ph) => `"${ph}"`).join(", ")}]

export const BEATS = {
${beats}
}

export const LIE_EL = ${n(p.lieEl)}
export const STANDUP_AZ = ${n(p.standupAz)}
export const STANDUP_EL = ${n(p.standupEl)}
export const HOLD_AZ = ${n(p.holdAz)}
export const HOLD_EL = ${n(p.holdEl)}

export const FILL_LIE = ${n(p.fillLie)}
export const FILL_STAND = ${n(p.fillStand)}
export const FILL_HOLD = ${n(p.fillHold)}

export const BACK_C1 = ${n(p.backC1)}
// The rise's overshoot is the RISE'S. It used to be read off the ink's swell
// dial, which under the turn does not exist at all — see \`riseOvershoot\`.
export const RISE_OVERSHOOT = ${n(p.riseOvershoot)}
export const RISE_CURVE = "${p.riseCurve}"
export const RISE_GATHER_FRAC = ${n(p.riseGatherFrac)}
export const RISE_GATHER_DEPTH = ${n(p.riseGatherDepth)}
export const CAMERA_PARK = "${p.cameraPark}"
export const DRIFT_CUT = ${n(p.driftCut)}

// THE TWO CAMERA TRANSITS. \`TILT_LAW\` decides whether the lie-down arrives at
// rest (prior, a 0.8 -> 84.0 deg/s hitch into the rise) or hands over at the
// gather's own speed; \`DESCEND_LAW\` whether the return move leaves the hold at
// full speed (prior, 0 -> 375.9 deg/s in one frame) or accelerates into it.
// \`MOVE_ACCEL_FRAC\` is Babbu's measured 4-of-21 (mechanics §6.2).
export const TILT_LAW = "${p.tiltLaw}"
export const DESCEND_LAW = "${p.descendLaw}"
export const MOVE_ACCEL_FRAC = ${n(p.moveAccelFrac)}

// The exposure sheet. 12 Hz inside 30fps, wherever the camera is parked.
export const CADENCE = "${p.cadence}"
export const CADENCE_HZ = ${n(p.cadenceHz)}

// The contact shadow's own clock — K4's one arrival.
export const SHADOW_LAW = "${p.shadowLaw}"
export const SHADOW_LAG_SEC = ${n(p.shadowLagSec)}
export const SHADOW_SEC = ${n(p.shadowSec)}

// \`carveLaw\` / \`carveAmount\` ARE DELIBERATELY NOT EMITTED, and this comment is
// the record of that decision rather than an omission somebody has to rediscover.
// The pen carve is a fragment \`discard\` that intersects the rendered TUBE with
// the nib's outline — a correction the live path needs because the live path
// renders the flat state as the 3-D form. The capture pipeline does not: it
// composites a 2-D ink layer drawn by \`makeFlatRenderer\` (explainer 14 §9), and
// that renderer already takes the same \`PenNib\`, so the film's flat state is the
// pen's outline by construction. There is no tube offline to carve. Emitting the
// constants would put an intent in this file that nothing here implements, which
// is the exact defect §11.9.7 caught the last time this block went stale.

// ⚠ THE OPTION SET IS NOT EMITTED, AND THAT IS A GAP RATHER THAN A DECISION.
// \`camera\` and \`shape\` (lib/hero-motion.ts) select one of three parked camera
// laws and one of four whole films — and \`scripts/capture/motion.mjs\` has its
// own copy of the choreography, which reads neither. So pasting this block
// after picking an option films the SHIPPED beat with the option's beat
// LENGTHS, which is the worst of both. Emitting the constants would not fix it;
// it would put an intent in this file that nothing downstream implements, which
// is the defect §11.9.7 caught the last time this block went stale. **The
// options live on the page until the capture pipeline is derived from
// \`cameraProgram()\` the way this page's own sampler is.** Named here so the
// next person reads it before they paste.
//
// The round trip. See HeroReturn in lib/hero-motion.ts for why the change is
// an occlusion and never a shading.
export const RETURN = { mode: "${p.ret.mode}", breakK: ${n(p.ret.breakK)} }

// The wind-up. \`releaseSec\` is the half of it that was missing: the tense
// unwinds INSIDE the turn's silent leading frames rather than snapping back on
// the frame before it. \`RELEASE_LAW = "prior"\` is the snap, parked.
export const RELEASE_LAW = "${p.releaseLaw}"
export const ANTICIPATION = {
  compressSec: ${n(p.anticipation.compressSec)},
  holdSec: ${n(p.anticipation.holdSec)},
  releaseSec: ${n(p.anticipation.releaseSec)},
  scaleY: ${n(p.anticipation.scaleY)},
  scaleX: ${n(p.anticipation.scaleX)},
}

// The turn — the beat's moment, and the return's.
export const EMERGE = {
  sec: BEATS.emerge,
  mode: "${p.emerge.mode}",
  overshoot: ${n(p.emerge.overshoot)},
  lightLagSec: ${n(p.emerge.lightLagSec)},
  lightSec: ${n(p.emerge.lightSec)},
  flatDepth: ${n(p.emerge.flatDepth)},
  turnShade: ${n(p.emerge.turnShade)},
  edgeFloor: ${n(p.emerge.edgeFloor)},
  dwellSec: ${n(p.emerge.dwellSec)},
}

export const DRAW_LINEAR_BLEND = ${n(p.drawLinearBlend)}
`
}
