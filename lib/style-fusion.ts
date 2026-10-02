/**
 * style-fusion.ts — FUSION (PRD Layer 14) + its DRIVE SHAPE (PRD Layer 15).
 *
 * WHAT FUSION IS. The layer stack lets systems COEXIST (each with its own
 * settings); stack animation moves the GROUP uniformly. Fusion is the third
 * thing: systems INFLUENCE EACH OTHER — one layer's per-frame output value
 * becomes another layer's per-frame input. "ASCII glyph density drives dither
 * threshold" is a fusion relationship; "ASCII and dither are both on" is not.
 *
 * ARCHITECTURE. Fusion is a MODULATION LAYER computed once per frame on the
 * CPU, on top of the resolved style state. `evaluateFusion` returns a
 * `FusionFrame` of multipliers/offsets which viewport-3d.tsx applies to the
 * uniform writes and material-parameter writes it already performs. Nothing
 * here forks a renderer, adds a shader, or touches geometry — every existing
 * system stays honest and untouched, and each relationship is one readable
 * line of math instead of a shader special-case.
 *
 * WHY CPU-SIDE. A relationship like "glyph density drives dither threshold"
 * needs the DRIVER's current value. Both the driver signal and the driven
 * parameter are plain numbers that already cross the CPU→GPU boundary as
 * uniforms every frame, so the relationship is computed where both are visible
 * and cheap: right before the uniform write. The driven system renders with a
 * value that is *literally derived from* the driving system's value — that is
 * the honest version of "one layer's output is another layer's input".
 *
 * ============================================================================
 * THE TAXONOMY, AND THE ONE IT REPLACES
 * ============================================================================
 *
 * THE OLD AXIS WAS NOT AN AXIS. Fusion used to be presented as eight "fusion"
 * presets plus seven "animated fusion" presets, split by a boolean
 * (`fusionAnimationEnabled`). Measured on the real page at 120 Hz over 13-second
 * windows (`scripts/verify/assert-layer-flicker.mjs --fusion`), that split
 * described nothing a viewer could see:
 *
 *   - ALL EIGHT non-animated presets animate. Every one has a continuous
 *     ambient drive on scene time, and three of them (Signal Ink, ASCII Rubber,
 *     Glitch Ribbon) additionally switch on their own layer's animation. Late-
 *     window motion for the "static" set ran 11.9 to 769.8 path units — none of
 *     them anywhere near still. "Static fusion" was a name for a moving picture.
 *   - FIVE OF SEVEN "animated" presets were QUIETER than their non-animated
 *     sibling in the steady state, because they replaced a forever-loop with a
 *     one-shot that decayed to nothing: Terminal Gel 130.8 → 17.5, ASCII Rubber
 *     453.9 → 13.9, Signal Ink 76.5 → 44.2, Dither Bloom 11.9 → 1.5 (which is
 *     at the instrument's noise floor), and Code Bloom 65.1 → EXACTLY 0.00.
 *     Switching "animated fusion" on made four of them less animated and one of
 *     them completely still. A pill promising motion that delivers a frozen
 *     frame is the same defect class as a preset that is byte-identical to its
 *     sibling.
 *   - ONE PRESET HAD NO ANIMATED VARIANT AT ALL (Pixel Clay), so the matrix was
 *     8 × 2 with a hole in it, and nothing in the UI said so.
 *
 * WHAT ACTUALLY DIFFERED between a preset and its "animated" sibling was never
 * "does it move". It was the SHAPE OF THE DRIVE OVER TIME — and the seven
 * variants did not even agree on that with each other: five were one-shots keyed
 * to the draw (build, open, decelerate, swell) while two were simply louder,
 * more structured loops. Two different ideas were sharing one boolean, which is
 * exactly why the rail read as arbitrary.
 *
 * THE REAL AXIS: DRIVE SHAPE. One control, three values, the same meaning for
 * every preset on the rail, and every preset supports all three:
 *
 *   LOOP    The relationship runs continuously on its own rhythm. Never stops.
 *   ARC     It ARRIVES — plays its authored one-shot with the draw-in (and on
 *           selection, so it is reachable on a finished stroke) — and then
 *           SETTLES INTO A QUIET LOOP. An arc that ends in a frozen frame is
 *           the bug above; an arc that ends in a calmer version of itself is
 *           the thing the seven variants were all reaching for.
 *   BURST   It rests, and fires on discrete events. The coupling reads as
 *           impulses rather than as a breath.
 *
 * HOW THAT IS ONE MECHANISM AND NOT THREE. Every preset already computed a
 * scalar driver and then mapped it onto its driven parameters. The mapping IS
 * the preset's identity — those numbers are validated craft and none of them
 * changed here. Only the driver's GENERATION moved out into `driveOf`, so each
 * case now reads as:
 *
 *     const dr = driveOf({ ..., omega, arcSecs })
 *     let x = <this preset's ambient mapping of dr.osc>
 *     x += ARRIVE * (1 - dr.build)   // the arrival, one line
 *     x += dr.hit * BURST_AMP        // the events, one line
 *     x += pulse * <existing>        // the shared completion pulse
 *
 * Two extra lines per preset buy a complete 8 × 3 matrix with no holes and no
 * preset whose "more animated" setting is measurably less animated.
 *
 * TWO FORMS OF ARRIVAL, and which one a preset needs is decided by whether its
 * driver is clamped. A driver that lives in 0..1 (bloom, digitisation, breath)
 * has to INTERPOLATE from its starting extreme — `x = start + (osc - start) *
 * build` — because an additive `+1 * (1 - build)` pins it against the clamp for
 * the first half of the arrival and the picture sits frozen there. That was
 * measured: Pixel Clay's arc read path 0.00 over its first three seconds, an
 * arrival that visibly did not start moving until it was half over. Signed
 * drivers centred on zero (glyph density) can use the additive form, because
 * they have room on both sides and it preserves the exact amplitudes those
 * presets were tuned with.
 *
 * THE TWO DIALS, AND WHY THERE ARE TWO. `fusionIntensity` alone used to control
 * both how hard the driver reached the driven parameter AND how far the driver's
 * own signal travelled, so it was simultaneously a coupling dial and a motion
 * switch. Swept end to end on the real page, five of eight presets were
 * completely still at 0 (path 0.00, tone swing 0.00) and moving at 0.25 — i.e.
 * the dial's honest description was "animate / don't animate" — while the other
 * three still moved at 0 because their own layers were animated, so the same
 * number meant different things depending on which pill you were on. Those are
 * two separate questions and they now have two separate dials:
 *
 *   LINK  (`fusionIntensity`)  how strongly the driver reaches the driven
 *         parameter. 0 returns the identity frame: the systems are UNLINKED and
 *         the composition is untouched. This is a depth, not a speed.
 *   SWING (`fusionSwing`)      how far the driver's own signal travels. 0 pins
 *         every drive at its resting value, so the picture is still while the
 *         systems stay fully linked — the coupling is then visible only where it
 *         is driven from OUTSIDE style time (the reveal gate and the completion
 *         pulse), which is precisely what "linked but not breathing" should mean.
 *
 * TIMING. Everything time-driven ultimately rides the ONE shared StyleClock
 * (lib/style-clock.ts): `elapsed`, `reveal`, `sinceCompletion`. No second
 * clock. Three globally-shared behaviours from the PRD live here for every
 * preset:
 *   - REVEAL GATE:  reveal progress scales every relationship at once, so
 *     during a replay the systems visibly LOCK TOGETHER as the stroke draws.
 *   - COMPLETION PULSE: the moment the draw-in finishes, one shared decaying
 *     kick runs through every driven parameter simultaneously.
 *   - ARMING: choreographies measure from "when this preset was selected"
 *     (`sinceArmed`) as well as from the reveal, so selecting an Arc long after
 *     the stroke completed still PLAYS its arrival instead of showing a build
 *     that "had always already finished" (the documented scene-start-fade trap).
 *     Burst schedules are armed the same way — the event grid used to be keyed
 *     to SCENE time, so clicking Glitch Ribbon dropped you at an arbitrary point
 *     in a grid that had been running since page load and could leave you
 *     watching silence for a second and a half.
 */

import type { StyleState } from "./style-system"
import { completionTrigger, type StyleClock } from "./style-clock"
// THE ONE COPY of which way each travel direction points. `ditherTravelSensitivity`
// below needs the vectors themselves, not the names, and a second hand-written
// table here would be the duplicate `_fusion-signals.mjs` was extracted to end.
import { DITHER_DIRECTION_VEC } from "./dither-shader"

/* ==========================================================================
 * USER-AUTHORED FUSION — the same idea, as DATA instead of as a switch case.
 * ==========================================================================
 *
 * WHY THIS EXISTS. Everything above this line is eight relationships written
 * by hand in a switch statement. They are real fusion — each one couples a
 * driver to a driven parameter — but a user cannot make a ninth. The PRD's
 * definition of the layer is not "eight good looks", it is *"layers combine
 * into a new authored visual system with shared parameters and mutual
 * influence"* (PRD Layer 14), and *"fusion defines RELATIONSHIPS, not just a
 * saved slider state. A fusion preset needs a concept"* (PRD §4). A rail you
 * can only read from is a rail of looks, not an authoring surface.
 *
 * WHAT A USER AUTHORS. Not a saved slider state — a LIST OF LINKS. Each link
 * is one sentence: SOURCE drives TARGET by AMOUNT. The sources are the live
 * per-frame outputs of the running systems (the glyph grid's actual phase, the
 * threshold matrix's actual phase, the draw-in's progress) plus the shared
 * drive; the targets are the same parameters the eight built-ins reach. So a
 * user-made fusion is made of exactly the same material as Code Bloom, and
 * "ASCII density drives dither threshold" — the PRD's own worked example — is
 * two dropdowns and a slider.
 *
 * WHY THIS IS NOT A SECOND ENGINE. `evaluateCustomFusion` writes the SAME
 * `FusionFrame` the switch above writes, so it inherits, for free and without a
 * line of new plumbing: the reveal gate, the completion pulse, arming,
 * motion-mode/reduced-motion freezing, the Link and Swing dials, and all three
 * drive shapes. viewport-3d.tsx is untouched — it applies a FusionFrame and
 * does not care who computed it.
 *
 * AMPLITUDES ARE INHERITED, NOT INVENTED. Every per-target constant below is
 * lifted from the built-in that already proved that parameter reads at stroke
 * scale (cited per target). A user-authored link at amount 1.0 therefore moves
 * its parameter about as far as the strongest built-in moves it — which is the
 * difference between an authoring surface and a box of sliders that do nothing
 * visible.
 */

/* ==========================================================================
 * THE COMBINATION SPACE, AND THE GAPS THAT WERE IN IT
 * ==========================================================================
 *
 * Sebs, 2026-08-02: *"i htought fusions ment evrthing gets fused togtehr some
 * fusion options only use some which igeuss its fine but tha means fusion
 * shoudl be mor expanisve having evry psoissble ocmbos of stuff"*.
 *
 * A fusion link is `scalar SOURCE × amount → scalar TARGET`, so EVERY pair is
 * meaningful by construction — there is no source that cannot drive a given
 * target, only sources that are asleep and targets whose layer is off, and both
 * of those are states rather than impossibilities. The space is therefore the
 * full product, and the honest question is not "which pairs are legal" but
 * "which of the app's running systems can reach the rail at all".
 *
 * ENUMERATED 2026-08-03. The rail was 7 sources × 14 targets × 3 drives = 294.
 * Read against what the app actually runs each frame, five things could not
 * participate, and they were gaps rather than decisions:
 *
 *   1. THE LAYER STACK. `stackAnimation` moves the whole group on its own clock
 *      and publishes an amount and a time offset every frame
 *      (viewport-3d.tsx, `gAmt` / `gOff`). A whole shipped animated system, and
 *      no fusion could read it.       → SOURCE `stackField`
 *   2. THE VIEW. The camera's own azimuth around the mark is a live per-frame
 *      number, geometry-driven like `reveal`, so it keeps working with motion
 *      off. Nothing could couple the surface to LOOKING at the thing, which is
 *      the product's central gesture.  → SOURCE `orbit`
 *   3. EVERY AMBIENT LINK WAS IN PHASE. `breath` is one sine, so two links on it
 *      move as one body and a multi-link fusion reads mechanical. A slow
 *      non-repeating wander is a different signal, not a second copy of the
 *      same one.                       → SOURCE `drift`
 *   4. DITHER HAD NO FLOW. Texture and ASCII each had one; the dither matrix is
 *      the layer whose motion Glitch Ribbon is built on (`f.ditherTimeAdd`) and
 *      a user could not author it.     → TARGET `ditherFlow`
 *   5. NO LAYER HAD ITS CONTRAST, ASCII HAD NO CELL SIZE. Per layer the natural
 *      row is {amount, scale, flow, bite}; dither had no flow and no bite, ASCII
 *      had no cell and no bite, texture had no bite. Contrast is the single most
 *      legible dial on each screen layer (docs/research/screen-space-layer-
 *      quality.md), and it was the one none of them exposed.
 *                                      → TARGETS `ditherBite`, `asciiCell`,
 *                                        `asciiBite`, `textureBite`
 *   6. TWO LIVE MATERIAL LEVERS WERE UNREACHABLE. `iridescence` is a real
 *      three.js parameter this repo already ships on Oil Slick and pins every
 *      frame (viewport-3d.tsx:4804), and the albedo scale was only reachable
 *      bundled inside `wet` — a user could not simply make the ink heavier or
 *      lighter.                        → TARGETS `iridescence`, `ink`
 *
 * WHAT IS STILL OUT, STATED RATHER THAN GLOSSED. Geometry is not a target and
 * cannot be: fusion's architecture contract (top of this file) is that it writes
 * uniforms and material parameters and NEVER rebuilds a mesh, and every geometry
 * dial in this app is a rebuild. The reveal is a source and not a target for the
 * same reason — the playhead belongs to the beat, and a modulation layer that
 * could move it would be able to fight the transport. Both are architectural, so
 * they are named here instead of appearing as dropdown entries that do nothing.
 *
 * The rail is now 10 × 21 × 3 = 630.
 */

/** One end of a relationship: a live signal a user can drive FROM. */
export type FusionSourceId =
  | "breath"
  | "drift"
  | "asciiField"
  | "ditherField"
  | "textureField"
  | "stackField"
  | "orbit"
  | "reveal"
  | "completion"
  | "event"

/** The other end: a parameter a user can drive TO. */
export type FusionTargetId =
  | "ditherThreshold"
  | "ditherCell"
  | "ditherAmount"
  | "ditherFlow"
  | "ditherBite"
  | "asciiDensity"
  | "asciiFlow"
  | "asciiCell"
  | "asciiBite"
  | "textureAmount"
  | "textureScale"
  | "textureFlow"
  | "textureBite"
  | "gloss"
  | "glow"
  | "wet"
  | "sheen"
  | "metal"
  | "iridescence"
  | "ink"
  | "shineBand"

/** One authored relationship. `amount` is SIGNED: the sign is the polarity of
 *  the coupling ("denser glyphs mean MORE ink" vs "…mean LESS ink"). */
export interface FusionLink {
  id: string
  source: FusionSourceId
  target: FusionTargetId
  /** −1..1. 0 is a link that does nothing and is shown as such in the UI. */
  amount: number
}

/** A fusion a user made. The name is the concept; the links are the system. */
export interface CustomFusion {
  /** Stable id. The state field is `custom:<id>` so arming keys per fusion. */
  id: string
  name: string
  links: FusionLink[]
  /** Emissive colour used when a `glow` link fires on a black-emissive base. */
  glowColor: string
}

/** A system a link can depend on. `stack` is the layer-stack GROUP animation,
 *  which is a system in its own right and not one of the three screen layers. */
export type FusionLayerNeed = "texture" | "dither" | "ascii" | "stack"

/** Which layer a source reads from, so the UI can say "ASCII is off, this link
 *  is asleep" instead of leaving the user to wonder why nothing moved. */
export const FUSION_SOURCES: {
  id: FusionSourceId
  label: string
  /** The style-state flag that has to be on for this source to carry a signal.
   *  null = always live (it rides the shared clock or the draw). */
  needs: FusionLayerNeed | null
  /** A phase source reads a layer's LIVE phase, which only advances while that
   *  layer is animating. With the animation off the phase is pinned and the
   *  source rests at zero — see `phaseTriangle`. */
  needsAnim?: FusionLayerNeed
  blurb: string
}[] = [
  {
    id: "breath",
    label: "Breath",
    needs: null,
    blurb:
      "The shared drive. A slow swell on fusion's own clock. Shaped by Drive: a loop, an arrival, or events.",
  },
  /* NOT A SECOND BREATH. Two links on `breath` are the same sine, so they move
   * as one body no matter what they are wired to — which is why a fusion with
   * several ambient links reads as one throbbing organism rather than as several
   * systems influencing each other. `drift` is two detuned sines, so it never
   * repeats and never lines up with the breath; that is the difference between
   * "everything pulses" and "everything is alive". */
  {
    id: "drift",
    label: "Drift",
    needs: null,
    blurb:
      "A slow wander that never repeats and never lines up with Breath. Use it when two things should both move without moving together.",
  },
  {
    id: "asciiField",
    label: "ASCII field",
    needs: "ascii",
    needsAnim: "ascii",
    blurb:
      "The glyph grid's live phase. The exact value the characters are scrolling with this frame. Change the ASCII speed and this changes with it.",
  },
  {
    id: "ditherField",
    label: "Dither field",
    needs: "dither",
    needsAnim: "dither",
    blurb: "The threshold matrix's live phase. The value the dither pattern is crawling with.",
  },
  {
    id: "textureField",
    label: "Texture field",
    needs: "texture",
    needsAnim: "texture",
    blurb: "The pattern's live phase. The value the texture is drifting with.",
  },
  /* THE LAYER STACK, WHICH COULD NOT PARTICIPATE AT ALL. Stack animation moves
   * the whole group — `gAmt` and `gOff` in viewport-3d.tsx — and publishes both
   * every frame. It is the one animated system fusion had no way to hear. */
  {
    id: "stackField",
    label: "Stack",
    needs: "stack",
    needsAnim: "stack",
    blurb:
      "What the whole layer group is doing. Its drift and its fade, as one number. Ties the surface to the stack's own rhythm.",
  },
  /* GEOMETRY-DRIVEN LIKE `reveal`, so it survives motion mode being off. */
  {
    id: "orbit",
    label: "View",
    needs: null,
    blurb:
      "Where you are looking from, as you turn the mark. Works with motion off. The surface answers the camera, not the clock.",
  },
  {
    id: "reveal",
    label: "Draw progress",
    needs: null,
    blurb:
      "−1 before the stroke draws, +1 once it has. Geometry-driven, so it keeps working with motion off.",
  },
  {
    id: "completion",
    label: "Completion",
    needs: null,
    blurb: "A single decaying kick the moment the draw-in finishes. Rests at zero.",
  },
  {
    id: "event",
    label: "Event",
    needs: null,
    blurb: "Discrete impulses, alternating sign. Only fires on the Burst drive. It is silent on Loop and Arc.",
  },
]

/**
 * `needsAnim` marks the entries whose signal or effect lives in a layer's PHASE
 * uniform — and it means TWO DIFFERENT THINGS depending on which list it is in.
 * Getting that wrong shipped a false warning; see below.
 *
 * ── ON A SOURCE, it is about the CPU. ─────────────────────────────────────
 * `asciiField` / `ditherField` / `textureField` READ the phase the viewport
 * wrote this frame. With that layer's animation off, `evaluateLayerTime`
 * returns a RESTING phase (lib/style-clock.ts), so the value is parked and the
 * source genuinely rests at zero. True for all three, regardless of shaders.
 *
 * ── ON A TARGET, it is about the SHADER, and only ASCII qualifies. ────────
 * A flow target WRITES the phase. Whether that write is visible depends on
 * whether the shader reads the uniform on the code path the layer is actually
 * on:
 *
 *   ascii-shader.ts:412  `fsACo += fsDir * uFsAscTime;`
 *                        INSIDE `if (uFsAscAnim > 0.5 && uFsAscAnim < 1.5)`.
 *                        So with ASCII animation off the write is discarded and
 *                        `asciiFlow` really is asleep. Measured: an ASCII flow
 *                        link at full amount moved the render by EXACTLY 0.000.
 *
 *   texture-shader.ts:919 `float fsTravel = uFsTexTime * fsTexPeriod(...);`
 *                        inside `if (uFsTexType > 0.5)` — i.e. gated on the
 *                        texture being ON, not on it being ANIMATED. There is
 *                        no animation uniform in that file at all.
 *
 *   dither-shader.ts:236 `fsDCo += vec2(uFsDitDirX, uFsDitDirY) * uFsDitTime;`
 *                        unconditional. Same story.
 *
 * ⚠ WHAT THIS PARAGRAPH USED TO CLAIM, AND WHAT IT COST. It said all three
 * uniforms were "written and then not read … all inside the animated branch",
 * and cited `texture-shader.ts:453` — which is `vec2 fsTravelDir(vec2 d, float
 * type) {`, a function signature, not a read of anything. On the strength of
 * that, `textureFlow` carried `needsAnim: "texture"`, and
 * `components/style-panel-scaffold.tsx` rendered the row as asleep with the
 * copy *"Texture animation is off, and flow moves that layer's phase."* The
 * link works: `textureTimeAdd` reaches `uFsTexTime` unconditionally and the
 * pattern shears. So the panel was telling the user a working control was dead
 * — the worst direction for this class of error, because a dead-looking control
 * is one the user stops reaching for.
 *
 * `needsAnim` is therefore correct on all three SOURCES and on `asciiFlow`
 * only. Anything added here must name the shader line that gates it.
 */
export const FUSION_TARGETS: {
  id: FusionTargetId
  label: string
  needs: FusionLayerNeed | null
  needsAnim?: FusionLayerNeed
  /** Needs a body with a sheen colour — see the `sheen` case in the evaluator. */
  needsSheenMaterial?: boolean
  /** `dir * uFsDitTime` is the ZERO vector on the "static" direction, so a flow
   *  written into it is multiplied away. Measured on Glitch Ribbon: 8 frames
   *  pixel-flat until its patch set a diagonal (lib/style-system.ts). */
  needsDitherDirection?: boolean
  blurb: string
}[] = [
  { id: "ditherThreshold", label: "Dither · threshold", needs: "dither", blurb: "Positive floods ink in; negative opens the screen up." },
  { id: "ditherCell", label: "Dither · cell size", needs: "dither", blurb: "Chunky pixels at the top, fine at the bottom." },
  { id: "ditherAmount", label: "Dither · strength", needs: "dither", blurb: "How much of the threshold layer survives. The visible direction is negative. The layer is already at full strength." },
  /* THE FLOW THE DITHER LAYER NEVER HAD. Texture and ASCII each shipped one;
   * this is the same field Glitch Ribbon jolts (`f.ditherTimeAdd`), made
   * authorable. `dither-shader.ts:236` reads `uFsDitTime` UNCONDITIONALLY, so
   * unlike ASCII's flow it needs no layer animation — only a travel direction,
   * because the static direction is the zero vector. */
  { id: "ditherFlow", label: "Dither · flow", needs: "dither", needsDitherDirection: true, blurb: "Pushes the threshold matrix sideways. Needs the dither to have a direction. On Static there is nowhere to push it." },
  { id: "ditherBite", label: "Dither · bite", needs: "dither", blurb: "How hard the screen cuts between ink and paper. Soft grey wash at the bottom, hard two-tone at the top." },
  { id: "asciiDensity", label: "ASCII · density", needs: "ascii", blurb: "How thick the characters read." },
  { id: "asciiFlow", label: "ASCII · flow", needs: "ascii", needsAnim: "ascii", blurb: "Pushes the glyph field along its scroll axis." },
  { id: "asciiCell", label: "ASCII · cell size", needs: "ascii", blurb: "Big coarse characters, or a fine grid of small ones." },
  { id: "asciiBite", label: "ASCII · bite", needs: "ascii", blurb: "How sharply the characters separate from the surface under them." },
  { id: "textureAmount", label: "Texture · strength", needs: "texture", blurb: "How much of the pattern survives. The visible direction is negative." },
  { id: "textureScale", label: "Texture · scale", needs: "texture", blurb: "Spreads the pattern out, or packs it tight." },
  // NO `needsAnim` — `uFsTexTime` is read whenever the texture is ON
  // (texture-shader.ts:919, inside `if (uFsTexType > 0.5)`), so this shears the
  // pattern with texture animation off. It carried one, and the panel wrongly
  // reported the row asleep. See the block above `FUSION_TARGETS`.
  { id: "textureFlow", label: "Texture · flow", needs: "texture", blurb: "Shears the pattern along its own phase." },
  { id: "textureBite", label: "Texture · bite", needs: "texture", blurb: "How hard the pattern's own edges read. A soft wash, or a hard print." },
  { id: "gloss", label: "Surface · gloss", needs: null, blurb: "Clearcoat, smoothness and reflection together. Carries a faint inner lift so it reads at stroke scale." },
  { id: "glow", label: "Surface · glow", needs: null, blurb: "Emissive lift, in this fusion's own colour. Reads from every angle." },
  { id: "wet", label: "Surface · wetness", needs: null, blurb: "Ink that has not dried: darker, smoother and more reflective at once. Negative dries it out." },
  // The list here MUST match `SHEEN_CAPABLE_MATERIALS` below, which is what the
  // panel actually gates the asleep warning on. It omitted Chalk, so a user on
  // Chalk got a live row whose own copy told them their material could not do
  // it — a control contradicting itself in the same breath.
  { id: "sheen", label: "Surface · sheen", needs: null, needsSheenMaterial: true, blurb: "The soft fabric-like rim light. Needs a body that has a sheen colour: Soft Gel, Rubber, Chalk or Wax." },
  { id: "metal", label: "Surface · metal", needs: null, blurb: "Pushes the body toward a conductor." },
  /* A REAL THREE.JS PARAMETER THIS REPO ALREADY SHIPS AND PINS EVERY FRAME
   * (viewport-3d.tsx:4804, `liveMaterial.iridescence = baseParams.iridescence`),
   * reachable until now only by choosing the Oil Slick body. */
  { id: "iridescence", label: "Surface · oil sheen", needs: null, blurb: "The thin-film colour shift that slides as you turn the mark. Strongest on a dark glossy body." },
  /* The albedo scale on its own. It existed only bundled inside `wet`, which
   * also moves roughness, reflection and clearcoat — so a user who wanted the
   * ink heavier had to accept three other changes with it. */
  { id: "ink", label: "Surface · ink weight", needs: null, blurb: "Straight weight of the ink itself. Heavier and denser, or thinned out. No shine involved." },
  { id: "shineBand", label: "Surface · shine band", needs: null, blurb: "A travelling highlight whose POSITION is the source's value, the band rides whatever drives it." },
]

/** Materials whose `sheenColor` is not `#000000`, so a `sheen` link can be
 *  seen at all. READ OFF `MATERIAL_PARAMS`, not guessed — eleven of the FIFTEEN
 *  entries there carry a black sheen colour, including the default Ink. (It
 *  said sixteen. The four with colour are softGel #a9c3e8, rubber #8f7d68,
 *  chalk #fdf8ee and wax #e8c98f; `custom` is here because the user can give it
 *  one. 11 + 4 = 15, which is the arithmetic the old number failed.) */
export const SHEEN_CAPABLE_MATERIALS = ["softGel", "rubber", "chalk", "wax", "custom"]

/**
 * CAN THIS SCREEN SEE A PUSH ALONG THIS AXIS? — `needsDitherDirection`, one
 * level deeper, and the level a cell fell through.
 *
 * That flag exists because `dir * uFsDitTime` is the ZERO VECTOR on the static
 * direction, so a flow written into it is multiplied away. A direction that is
 * merely PARALLEL TO THE SCREEN'S OWN INVARIANT AXIS is multiplied away just as
 * exactly, and the flag cannot see it — it asks whether there is a direction,
 * not whether the screen reads that one. Two of the ten screens are
 * one-dimensional:
 *
 *   dither-shader.ts:171  `lines` returns `fract(co.y)` — Y ONLY, and the
 *                         horizontal direction is `[1, 0]`, so it moves `co.x`,
 *                         which that line never reads. The flow is exact zero.
 *   dither-shader.ts:192  `hatch` returns `fsTri(c2.y)`, one-dimensional in the
 *                         frame `uFsDitAngle` rotates into, so it is blind to a
 *                         push along its own strokes. Horizontal loses it only
 *                         at angle 0; at the default 45 deg it reads 0.707.
 *
 * The other eight read the WHOLE coordinate (`fsBayer`, `fsIGN`, and the four
 * clustered-dot maps), so any direction moves them.
 *
 * MEASURED, 2026-08-28. `Composing Stick` (`animation+dither+ascii+layers`) was
 * the one cell of 116 the pixel liveness probe could not see: net 0.899 against
 * a floor of 1.0. Its four links push `ditherTimeAdd` over a span of 7.08,
 * `ditherThresholdAdd` 0.39, `asciiCellMul` 0.23 and a constant
 * `asciiContrastAdd` 0.108 — so the flow is its LOUDEST link by eighteen times,
 * and on `lines` + horizontal it was writing exactly no pixels. Six sibling
 * cells carried the same dead push and were only carried by their other links.
 *
 * Anything added here must name the shader line, exactly as `needsAnim` does.
 */
export function ditherTravelSensitivity(
  type: StyleState["ditherType"],
  dir: StyleState["ditherDirection"],
  angleDeg: number,
): number {
  const [dx, dy] = DITHER_DIRECTION_VEC[dir] ?? [0, 0]
  if (type === "lines") return Math.abs(dy)
  if (type === "hatch") {
    const a = (angleDeg * Math.PI) / 180
    return Math.abs(dx * Math.sin(a) + dy * Math.cos(a))
  }
  return Math.hypot(dx, dy)
}

/**
 * The travel direction to give a screen that is about to be pushed.
 *
 * HORIZONTAL UNLESS THE SCREEN IS BLIND TO IT. Horizontal is what every
 * shipped wake already uses and what all seven built-in dither relationships
 * were tuned against, so a cell that already travels is left exactly where it
 * is; only a screen that reads nothing at all is moved, and it is moved to the
 * axis it reads LOUDEST rather than to the next thing on a list. On `lines`
 * that is vertical at full strength: the threshold ramps in y, so a vertical
 * push slides the lines ACROSS themselves, which is the slide the authored
 * concept promises ("the group slides the screen").
 */
export function ditherTravelDirection(
  type: StyleState["ditherType"],
  angleDeg: number,
): StyleState["ditherDirection"] {
  const live = (["horizontal", "vertical", "diagonal"] as const).filter(
    (d) => ditherTravelSensitivity(type, d, angleDeg) > 0,
  )
  if (live.includes("horizontal") || live.length === 0) return "horizontal"
  return live.reduce((best, d) =>
    ditherTravelSensitivity(type, d, angleDeg) > ditherTravelSensitivity(type, best, angleDeg) ? d : best,
  )
}

const SOURCE_LABEL = new Map(FUSION_SOURCES.map((s) => [s.id, s.label]))
const TARGET_LABEL = new Map(FUSION_TARGETS.map((t) => [t.id, t.label]))
const SOURCE_DEF = new Map(FUSION_SOURCES.map((s) => [s.id, s]))
const TARGET_DEF = new Map(FUSION_TARGETS.map((t) => [t.id, t]))

/* ==========================================================================
 * IS THIS LINK AWAKE, AND IF NOT WHAT IS THE ONE CLICK THAT FIXES IT?
 * ==========================================================================
 *
 * WHY THIS IS IN THE MODEL AND NOT IN THE PANEL, WHICH IS WHERE IT WAS.
 *
 * `components/style-panel-scaffold.tsx` computed this inline, which meant the
 * one question that decides whether the whole feature does anything — *is this
 * relationship carrying a signal right now* — had no answer outside React. A
 * gate could not ask it, so no gate did, and the defect that shipped is exactly
 * the one nobody could measure:
 *
 *   MEASURED 2026-08-03, model-side, on the state the panel's own "+ New fusion"
 *   button produces. The seed link `asciiField -> ditherThreshold @0.7`
 *   contributed EXACTLY 0.000000 to every field of the FusionFrame, because
 *   creating a fusion switched ASCII ON but not ANIMATING — and a phase source
 *   whose layer is still is pinned at `phaseTriangle(0) = 0` by design (see the
 *   quarter-period offset below, which is a defect fix in its own right).
 *   The other seed link moved only clearcoat/roughness/env plus 0.056 of
 *   emissive: the four levers this file already documents as "repeatedly
 *   measured near-invisible at stroke scale". Twelve of the sixteen frame fields
 *   were untouched. So the first thing a user ever made was, by construction, a
 *   no-op — the sixth bug pattern in docs/README.md, wearing a new coat: born
 *   unable to act, exactly as those three gates were born unable to fail.
 *
 * Living here, it is one definition shared by the panel that WARNS, the button
 * that FIXES, and the gate that CHECKS — so the three can never drift apart.
 */
export type FusionFixKey =
  | `layer:${FusionLayerNeed}`
  | `anim:${FusionLayerNeed}`
  | "material"
  | "ditherDirection"
  /* THE ONE FIX THAT IS NOT STYLE STATE. The camera belongs to the viewport, so
   * `fusionFixPatch` returns an empty patch for it and the caller that owns the
   * viewport API (app/page.tsx) turns the turntable on. It is a fix key rather
   * than a special case so the panel's row button, the wake, and the gate all
   * name the same thing — the property this file's own header calls out as the
   * reason `fusionLinkSleep` lives in the model at all. */
  | "view:spin"

export interface FusionSleepReason {
  why: string
  fix?: FusionFixKey
}

const LAYER_LABEL: Record<FusionLayerNeed, string> = {
  texture: "Texture",
  dither: "Dither",
  ascii: "ASCII",
  stack: "Layer stack",
}

/**
 * What a caller knows about the VIEW, which is not style state.
 *
 * `undefined` means "I do not know", and it is SILENT — a model-side gate with
 * no camera must not manufacture a sleep reason out of its own ignorance, and a
 * caller that does know (the panel, which reads the viewport's spin) passes the
 * number. Both arms are driven by `assert-fusion-combos.mjs` §5.
 */
export interface FusionViewState {
  /** Degrees per second the turntable is currently turning. 0 = held still. */
  cameraSpinDegPerSecond?: number
}

/** Minimal state shape these predicates read. `StyleState` satisfies it. */
type LinkStateView = Pick<
  StyleState,
  | "textureEnabled"
  | "textureMode"
  | "textureAnimated"
  | "ditherEnabled"
  | "ditherAnimated"
  | "ditherDirection"
  | "asciiEnabled"
  | "asciiAnimated"
  | "asciiAnimationType"
  | "layerStackEnabled"
  | "stackAnimationEnabled"
  | "stackAnimationType"
  | "materialPreset"
  | "motionMode"
>

export function fusionLayerIsOn(s: LinkStateView, needs: FusionLayerNeed | null): boolean {
  if (needs === null) return true
  if (needs === "texture") return s.textureEnabled && s.textureMode !== "none"
  if (needs === "dither") return s.ditherEnabled
  if (needs === "stack") return s.layerStackEnabled && s.stackAnimationEnabled
  return s.asciiEnabled
}

/** Everything that has to be true for a layer's PHASE to actually advance. */
export function fusionLayerAnimates(s: LinkStateView, layer: FusionLayerNeed): boolean {
  if (s.motionMode === "off") return false
  if (layer === "texture") return s.textureAnimated
  if (layer === "dither") return s.ditherAnimated
  if (layer === "stack")
    return s.layerStackEnabled && s.stackAnimationEnabled && s.stackAnimationType !== "none"
  return s.asciiAnimated && s.asciiAnimationType !== "none"
}

/**
 * Every reason THIS link might not move a pixel, named, with the one click that
 * cures each. An empty array means the link is awake.
 *
 * `drive` is passed rather than resolved so a caller can ask about a shape it is
 * about to switch to (the panel does, when it previews a Burst).
 */
export function fusionLinkSleep(
  link: FusionLink,
  s: LinkStateView & FusionViewState,
  drive: FusionDrive,
): FusionSleepReason[] {
  const srcDef = SOURCE_DEF.get(link?.source)
  const tgtDef = TARGET_DEF.get(link?.target)
  const out: FusionSleepReason[] = []
  if (!srcDef || !tgtDef) {
    out.push({ why: "this relationship names something this build does not have" })
    return out
  }
  if (srcDef.needs && !fusionLayerIsOn(s, srcDef.needs))
    out.push({
      why: `${LAYER_LABEL[srcDef.needs]} is off, so this source carries no signal`,
      fix: `layer:${srcDef.needs}`,
    })
  if (tgtDef.needs && !fusionLayerIsOn(s, tgtDef.needs))
    out.push({
      why: `${LAYER_LABEL[tgtDef.needs]} is off, so there is nothing to drive`,
      fix: `layer:${tgtDef.needs}`,
    })
  if (link.source === "event" && drive !== "burst")
    out.push({ why: "Event only fires on the Burst drive" })
  // A phase SOURCE rests at zero while its layer is still; a phase TARGET is
  // written to a uniform the shader only reads on its animated branch. Same
  // cause, both ends of the relationship — and BOTH are reported, because when
  // the two ends need different layers, waking one leaves the other asleep.
  if (srcDef.needsAnim && !fusionLayerAnimates(s, srcDef.needsAnim))
    out.push({
      why: `${LAYER_LABEL[srcDef.needsAnim]} is not animating, so its phase is standing still and this source rests at zero`,
      fix: `anim:${srcDef.needsAnim}`,
    })
  if (tgtDef.needsAnim && !fusionLayerAnimates(s, tgtDef.needsAnim))
    out.push({
      why: `${LAYER_LABEL[tgtDef.needsAnim]} animation is off, and flow moves that layer's phase`,
      fix: `anim:${tgtDef.needsAnim}`,
    })
  /* `dir * uFsDitTime` with the static direction is the ZERO vector, so a flow
   * link into it is multiplied away — the same arithmetic that made eight of
   * Glitch Ribbon's frames pixel-flat until its patch chose a diagonal. */
  if (tgtDef.needsDitherDirection && s.ditherDirection === "static")
    out.push({
      why: "the dither has no travel direction, so there is nowhere to push it",
      fix: "ditherDirection",
    })
  /* Sheen is black light on ELEVEN OF THE FIFTEEN bodies — see
   * SHEEN_CAPABLE_MATERIALS, which does that arithmetic in full. */
  if (tgtDef.needsSheenMaterial && !SHEEN_CAPABLE_MATERIALS.includes(s.materialPreset))
    out.push({ why: `the ${s.materialPreset} body has no sheen colour`, fix: "material" })
  /* THE VIEW SOURCE RESTS AT EXACTLY ZERO, HEAD ON.
   *
   * `orbit` is the camera's azimuth and `phaseTriangle` puts rest at 0, so at
   * the angle the page loads on, a View link contributes 0.000000 — the same
   * arithmetic that made the first shipped seed link a measured no-op. Turn
   * Table therefore looked broken on selection, which is what Sebs reported.
   * Reported only when the caller has actually told us the camera is still;
   * `undefined` means the caller has no view information and stays silent. */
  if (link.source === "orbit" && s.cameraSpinDegPerSecond === 0)
    out.push({
      why: "nothing is turning the mark, and this source IS the angle you are looking from. Head on, it rests at exactly zero",
      fix: "view:spin",
    })
  if (Math.abs(link.amount) < 0.005) out.push({ why: "Amount is zero" })
  return out
}

/* ==========================================================================
 * WAKING A FUSION — the composition its own links need
 * ==========================================================================
 *
 * A fusion is a statement that these systems are related. Selecting one should
 * therefore put those systems on, exactly as selecting any of the eight built-in
 * relationships does — every one of them ships an `applies` patch that turns its
 * layers on with numbers tuned to its body (lib/style-system.ts,
 * `FUSION_PRESET_DEFS`). A user-authored fusion had no such patch, so it was the
 * only member of the rail that landed on whatever composition happened to be
 * there. That is the whole of the "nothing actually applies" complaint.
 *
 * THE NUMBERS ARE INHERITED, NOT INVENTED, and the reason is measured. Switching
 * dither and ASCII on at their BARE defaults over the default `ink` body crushes
 * the mark: it goes from a modelled grey stroke to near-solid black with the
 * screen chewing white specks out of it, keeping 87.0% of its inked area
 * (docs/verification/fusion-newborn/wake-v3/SHEET-wake.png, arm `bare`). Code
 * Bloom's composition — the built-in that runs the SAME relationship on the SAME
 * default body — keeps 96.6% and reads as a stipple ON the mark rather than
 * instead of it. So these are Code Bloom's and Pixel Clay's numbers, cited per
 * block, not a fresh guess.
 *
 * IT IS ADDITIVE AND IT NEVER OVERWRITES. A layer that is already on keeps the
 * user's own settings untouched — only the layers that were OFF get the tuned
 * patch, and nothing is ever switched off. A wake that restyled a composition
 * the user had built would be a worse failure than the silence it is fixing.
 */

/** Code Bloom's dither: authored for the near-black default `ink` body, where a
 *  bare `ditherEnabled: true` sits below every threshold (lib/style-system.ts). */
const WAKE_DITHER: Partial<StyleState> = {
  ditherEnabled: true,
  ditherType: "blueNoise",
  ditherScale: 2,
  ditherLevels: 3,
  ditherIntensity: 0.7,
  ditherContrast: 0.45,
  ditherThreshold: 0.5,
  ditherExposure: 0.9,
  ditherLockMode: "screen",
}
/** Code Bloom's ASCII — mid ramp, 13px cells (the measured legibility floor). */
const WAKE_ASCII: Partial<StyleState> = {
  asciiEnabled: true,
  asciiCharset: "custom",
  asciiCellSize: 13,
  asciiDensity: 0.6,
  asciiContrast: 0.55,
  asciiLockMode: "screen",
}
/** Pixel Clay's grain. */
const WAKE_TEXTURE: Partial<StyleState> = {
  textureEnabled: true,
  textureMode: "grain",
  textureScale: 1.6,
  textureIntensity: 0.6,
  textureContrast: 0.6,
}
/** Code Bloom's stack, which is what keeps the mark readable under two screen
 *  layers rather than letting them stack to solid. */
const WAKE_STACK: Partial<StyleState> = {
  layerStackEnabled: true,
  stackDitherOpacity: 0.55,
  stackAsciiOpacity: 0.95,
  stackDitherBlend: "normal",
  stackAsciiBlend: "normal",
  stackOrder: "ditherFirst",
}
const WAKE_ANIM: Record<FusionLayerNeed, Partial<StyleState>> = {
  // ASCII Rubber's scroll speed and axis.
  ascii: { asciiAnimated: true, asciiAnimationType: "scroll", asciiScrollSpeed: 0.9, asciiDirection: "horizontal" },
  // Signal Ink's matrix crawl.
  dither: { ditherAnimated: true, ditherDirection: "horizontal", ditherSpeed: 0.5 },
  texture: { textureAnimated: true, textureSpeed: 1 },
  stack: { layerStackEnabled: true, stackAnimationEnabled: true, stackAnimationType: "loop", stackAnimationSpeed: 1 },
}

export interface FusionWake {
  /** The patch to merge into style state. Empty when nothing needs waking. */
  patch: Partial<StyleState>
  /** What it will switch on, in words, for the button that offers it. */
  turnsOn: string[]
  /**
   * Degrees per second the TURNTABLE has to run for this fusion's View links to
   * carry a signal, or 0 when it needs nothing. Not part of `patch` because the
   * camera is not style state — the caller that owns the viewport API applies
   * it. See FUSION_VIEW_SPIN_DEG.
   */
  spin: number
}

/**
 * The patch for ONE fix, and nothing else.
 *
 * SEPARATED FROM `fusionWakePatch` BECAUSE THE ROW BUTTONS LIE OTHERWISE. The
 * per-link buttons say "Turn on Dither" / "Animate ASCII" — three of them can
 * sit on one row — and if each applied the link's WHOLE wake they would all do
 * the same thing while claiming to do three different things. That is the
 * "names must match behaviour" defect this panel has already shipped once, in
 * the version where the warning named ASCII and the button fixed Texture.
 */
export function fusionFixPatch(fix: FusionFixKey, s: StyleState): Partial<StyleState> {
  if (fix === "material") return { materialPreset: "softGel", materialUserOverride: true }
  /* NOT ALWAYS HORIZONTAL. On a `lines` screen a horizontal push moves `co.x`
   * and the threshold is `fract(co.y)`, so this button would have handed back a
   * direction as dead as the static one it was curing — the same names-must-
   * match-behaviour defect this function was split out to prevent, in the one
   * arm nobody had measured. See `ditherTravelSensitivity`. */
  if (fix === "ditherDirection")
    return { ditherDirection: ditherTravelDirection(s.ditherType, s.ditherAngle ?? 45) }
  /* The camera is not style state. This returns nothing on purpose and the
   * caller applies `FusionWake.spin` / `FUSION_VIEW_SPIN_DEG` through the
   * viewport API — a patch that silently did nothing under a button labelled
   * "turn the view on" would be the names-must-match-behaviour defect this
   * function was split out of `fusionWakePatch` to prevent. */
  if (fix === "view:spin") return {}
  const [kind, layer] = fix.split(":") as ["layer" | "anim", FusionLayerNeed]
  // A running style clock, or an ambient drive is frozen whatever else is on.
  const clock: Partial<StyleState> = s.motionMode === "off" ? { motionMode: "independent" } : {}
  if (kind === "anim") {
    // Animating a layer implies HAVING it, and `WAKE_ANIM` carries only the
    // motion — so an "Animate X" on a layer that is off brings the layer's own
    // tuned settings with it rather than lighting a switch on nothing.
    const base = fusionLayerIsOn(s, layer) ? {} : layerWake(layer)
    return { ...clock, ...base, ...WAKE_ANIM[layer] }
  }
  return { ...clock, ...layerWake(layer) }
}

function layerWake(layer: FusionLayerNeed): Partial<StyleState> {
  if (layer === "dither") return WAKE_DITHER
  if (layer === "ascii") return WAKE_ASCII
  if (layer === "texture") return WAKE_TEXTURE
  return WAKE_ANIM.stack
}

/**
 * The composition this fusion's own links need, derived from the links.
 *
 * Reads `FUSION_SOURCES` / `FUSION_TARGETS` rather than a second hand-written
 * table, so a source or target added to those lists is woken automatically and
 * cannot be forgotten here — which is the failure mode this repo has hit five
 * times with hand-copied inventories (scripts/verify/lib/inventories.mjs).
 */
export function fusionWakePatch(
  f: CustomFusion,
  s: StyleState & FusionViewState,
  drive: FusionDrive,
): FusionWake {
  const patch: Partial<StyleState> = {}
  const turnsOn: string[] = []
  let spin = 0
  const say = (t: string) => {
    if (!turnsOn.includes(t)) turnsOn.push(t)
  }
  // A running style clock, or every ambient drive is frozen. Same line as
  // FUSION_BASE carries for the built-in rail.
  if (s.motionMode === "off") {
    patch.motionMode = "independent"
    say("Motion")
  }
  const view = () => ({ ...s, ...patch }) as StyleState
  /* Which layers ended up needing motion, so the copy can say "ASCII, moving"
   * instead of "ASCII, ASCII motion" — the same layer named twice reads as two
   * things and it is one. */
  const moving = new Set<FusionLayerNeed>()
  const woken = new Set<FusionLayerNeed>()
  for (const link of f.links ?? []) {
    if (Math.abs(link?.amount ?? 0) < 0.005) continue
    for (const r of fusionLinkSleep(link, view(), drive)) {
      if (!r.fix) continue
      Object.assign(patch, fusionFixPatch(r.fix, view()))
      if (r.fix === "material") {
        say("a Soft Gel body")
        continue
      }
      if (r.fix === "ditherDirection") {
        say("a travel direction for Dither")
        continue
      }
      if (r.fix === "view:spin") {
        spin = FUSION_VIEW_SPIN_DEG
        say("the turntable")
        continue
      }
      const [kind, layer] = r.fix.split(":") as ["layer" | "anim", FusionLayerNeed]
      if (kind === "anim") moving.add(layer)
      woken.add(layer)
    }
  }
  /* "(moving)" IN BRACKETS, NOT AFTER A COMMA. Joined into a comma list, "ASCII,
   * moving, Dither" reads as three things and it is two — the same layer named
   * twice was the first version of this and it was worse. */
  for (const layer of woken) {
    say(moving.has(layer) ? `${LAYER_LABEL[layer]} (moving)` : LAYER_LABEL[layer])
  }
  /* TWO SCREEN LAYERS ON ONE MARK NEED THE STACK, or they composite to solid.
   * Measured: dither + ASCII with no stack keeps 87.0% of the mark's inked area
   * and reads as a black bar; with Code Bloom's stack it keeps 96.6% and reads
   * as a stipple on a stroke that still has its form. */
  const st = view()
  const screenLayers =
    (st.textureEnabled && st.textureMode !== "none" ? 1 : 0) +
    (st.ditherEnabled ? 1 : 0) +
    (st.asciiEnabled ? 1 : 0)
  if (screenLayers >= 2 && !st.layerStackEnabled) {
    Object.assign(patch, WAKE_STACK)
    say("Layer stack")
  }
  return { patch, turnsOn, spin }
}

/** Plain-English read-back of an authored fusion — the CONCEPT, in words, so
 *  the panel can show what the user actually built rather than a row of ids. */
export function describeFusion(f: CustomFusion): string {
  const live = f.links.filter((l) => Math.abs(l.amount) > 0.001)
  if (live.length === 0) return "No relationships yet. Nothing is linked."
  return live
    .map((l) => {
      const strength =
        Math.abs(l.amount) > 0.66 ? "hard" : Math.abs(l.amount) > 0.33 ? "" : "gently"
      const dir = l.amount < 0 ? " inverted" : ""
      return `${SOURCE_LABEL.get(l.source)} drives ${TARGET_LABEL.get(l.target)}${dir}${
        strength ? `, ${strength}` : ""
      }`
    })
    .join(" · ")
}

/** `custom:<id>` is the fusionPreset value for a user-authored fusion. Encoding
 *  the id INTO the preset field is what makes arming work per fusion without
 *  viewport-3d.tsx knowing this feature exists: its arming key is already
 *  `${fusionPreset}:${drive}`, so switching between two custom fusions restarts
 *  the arrival exactly as switching between two built-ins does. */
export const CUSTOM_PREFIX = "custom:"
export const isCustomFusionId = (p: string): boolean => p.startsWith(CUSTOM_PREFIX)
/** Returns the template-literal type, not `string`, so assigning the result to
 *  `fusionPreset` typechecks without a cast anywhere in the UI. */
export const customFusionKey = (id: string): `custom:${string}` => `${CUSTOM_PREFIX}${id}` as const
export const customFusionIdOf = (p: string): string | null =>
  isCustomFusionId(p) ? p.slice(CUSTOM_PREFIX.length) : null

export function newFusionLink(): FusionLink {
  return {
    id: `l${Math.random().toString(36).slice(2, 9)}`,
    source: "breath",
    target: "gloss",
    amount: 0.6,
  }
}

/**
 * A new fusion starts with ONE working relationship, not an empty list.
 *
 * An empty authoring surface is the same defect as a preset that renders
 * nothing: the user clicks "new", sees no change on the canvas, and has no way
 * to tell an empty document from a broken feature. The seed is the PRD's own
 * worked example — *"ASCII density drives dither threshold"* (PRD Layer 15) —
 * so the first thing a new fusion does is the thing the document says fusion is.
 */
/**
 * The glow a new fusion starts with, and the fallback a RESTORED fusion gets
 * when its own is missing or is not a string (see `applyCustomLinks`). One
 * constant rather than two literals, so "the default glow" cannot come out as
 * two different colours depending on which path produced the fusion.
 */
export const DEFAULT_GLOW_COLOR = "#7ec8a0"

/**
 * The seed, and why the second link changed.
 *
 * Link 1 is the PRD's own worked example and stays: the glyph field opens and
 * closes the screen under it. It needs ASCII to be ANIMATING to carry a signal
 * at all, which `fusionWakePatch` now guarantees — before that it contributed a
 * measured 0.000000 and the whole feature's first impression was a no-op.
 *
 * Link 2 was `breath -> gloss @0.45` and is now `breath -> glow @0.5`. `gloss`
 * is the clearcoat/roughness/env trio, which this file's own FusionFrame comment
 * documents as "repeatedly measured near-invisible at stroke scale"; at 0.45 its
 * angle-independent partner reaches emissive 0.056, which is not a look, it is a
 * rounding error. `glow` is the angle-independent read at 1.8 — Signal Ink's own
 * lever, one notch below its loud end — so the body visibly breathes light.
 *
 * TWO SOURCES, NOT ONE, DELIBERATELY. On one driver both links die together the
 * moment that layer sleeps. Split across the glyph field and the breath, a new
 * fusion always has something moving, and the read-back sentence says two
 * different systems are involved — which is what fusion means.
 */
export function newCustomFusion(name: string): CustomFusion {
  return {
    id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    glowColor: DEFAULT_GLOW_COLOR,
    links: [
      { id: "l1", source: "asciiField", target: "ditherThreshold", amount: 0.7 },
      { id: "l2", source: "breath", target: "glow", amount: 0.5 },
    ],
  }
}

/* ==========================================================================
 * FUSE EVERYTHING — the thing Sebs assumed fusion already was
 * ==========================================================================
 *
 * *"i htought fusions ment evrthing gets fused togtehr"*. Every built-in couples
 * two or three systems; none couples all of them, and there was no way for a
 * user to ask for that in one move.
 *
 * WHAT MAKES IT COHERENT RATHER THAN A PERMUTATION DUMP, and this is the whole
 * design of it: EVERY LINK RUNS OFF A DIFFERENT DRIVER. Wire nine parameters to
 * one breath and you do not get nine systems fused, you get one throbbing
 * object — which is what "everything at once" looks like when it is done the
 * obvious way, and why an all-systems fusion has a reputation for being
 * incoherent. Spread across the breath, the drift, each layer's own phase, the
 * draw and the view, the systems move on their own rhythms and READ as coupled
 * because they never quite agree. That is the difference between a chord and a
 * unison.
 *
 * The amounts are deliberately below the amounts a two-link fusion would use:
 * nine simultaneous relationships each at full strength is nine clamps.
 */
export function fuseEverything(name = "Everything"): CustomFusion {
  return {
    id: `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    glowColor: DEFAULT_GLOW_COLOR,
    links: [
      // the three screen layers, each driven by ANOTHER layer's phase, so they
      // chase each other instead of pulsing together
      { id: "e1", source: "asciiField", target: "ditherThreshold", amount: 0.55 },
      { id: "e2", source: "ditherField", target: "textureScale", amount: 0.45 },
      { id: "e3", source: "textureField", target: "asciiDensity", amount: 0.4 },
      // the stack's own rhythm, into the layer nobody else is touching
      { id: "e4", source: "stackField", target: "ditherFlow", amount: 0.5 },
      // two independent ambients, one slow and repeating, one slow and not
      { id: "e5", source: "breath", target: "glow", amount: 0.35 },
      { id: "e6", source: "drift", target: "wet", amount: 0.4 },
      // the geometry-driven pair: the draw, and where you are looking from
      { id: "e7", source: "reveal", target: "ink", amount: 0.3 },
      { id: "e8", source: "orbit", target: "shineBand", amount: 0.6 },
      // and the impulse, which is silent until the Drive is set to Burst
      { id: "e9", source: "completion", target: "iridescence", amount: 0.5 },
    ],
  }
}

/* ==========================================================================
 * THE FOUR NEW BUILT-INS, WRITTEN AS LINKS RATHER THAN AS SWITCH CASES
 * ==========================================================================
 *
 * The eight originals are hand-written branches. They are real, they are tuned,
 * and they are also the reason the authoring surface felt like a lesser thing:
 * "ours" were code and "yours" were data, so a user had no way to see how one of
 * ours was made. These four are the same sentences a user writes — two dropdowns
 * and a slider each — evaluated through the SAME `applyCustomLinks` a custom
 * fusion goes through. That is not a shortcut; it is the claim at the top of this
 * file ("a user-made fusion is made of exactly the same material as Code Bloom")
 * finally being true in both directions, and it is what lets the panel offer
 * "Edit a copy" on them.
 *
 * WHY THESE FOUR. Each one covers a system that COULD NOT PARTICIPATE before —
 * they are the gaps, closed, rather than four more mixes of what was already
 * reachable:
 *
 *   Turn Table   the VIEW. Nothing in the app coupled the surface to where you
 *                are looking from, and this product is about turning a drawing
 *                into an object you turn.
 *   Slow Weather the DRIFT. Every ambient relationship shipped so far runs on one
 *                sine, so "several things moving" always meant "one thing moving
 *                several parameters". This one is deliberately never in phase.
 *   Formation    the STACK. The layer group animates on its own clock and no
 *                relationship could hear it.
 *   Whole Cloth  ALL OF IT. See `fuseEverything`.
 */
export const BUILTIN_LINK_FUSIONS: Record<string, CustomFusion> = {
  /* CONCEPT: the mark is an object, and turning it is what shows you the
   * material. RELATIONSHIP: the camera's own azimuth is the driver — the shine
   * band's POSITION, the thin-film shift and the pattern's scale all come off
   * it, so the surface answers your hand and not a clock. Keeps working with
   * motion mode off, which no other relationship on the rail does. */
  viewTurn: {
    id: "viewTurn",
    name: "Turn Table",
    glowColor: "#a9c3e8",
    links: [
      { id: "t1", source: "orbit", target: "shineBand", amount: 0.85 },
      { id: "t2", source: "orbit", target: "iridescence", amount: 0.7 },
      { id: "t3", source: "orbit", target: "textureScale", amount: -0.45 },
    ],
  },
  /* CONCEPT: weather. Nothing repeats and nothing arrives on the beat.
   * RELATIONSHIP: the drift drives the pattern's bite and the ink's weight while
   * the breath — a different clock entirely — drives the glow, so the two halves
   * of the surface are never quite in agreement. */
  slowWeather: {
    id: "slowWeather",
    name: "Slow Weather",
    glowColor: "#8f7d68",
    links: [
      { id: "w1", source: "drift", target: "textureBite", amount: 0.75 },
      // 0.8, not 0.45. Judged on the render: chalk's albedo is near-white, so at
      // 0.45 the whole weathering happened between two shades of bone and the
      // arm read as one still picture across a full drift period
      // (docs/verification/fusion-rail/v1). The point of Slow Weather is that
      // the mark visibly darkens and dries.
      { id: "w2", source: "drift", target: "ink", amount: 0.8 },
      { id: "w3", source: "breath", target: "glow", amount: 0.4 },
      { id: "w4", source: "drift", target: "textureAmount", amount: -0.35 },
    ],
  },
  /* CONCEPT: the layers are one body and the surface belongs to it.
   * RELATIONSHIP: the stack's own group animation is the driver, so the screen
   * layers and the material move on the STACK's rhythm rather than on fusion's —
   * change the stack's speed and every one of these changes with it. */
  formation: {
    id: "formation",
    name: "Formation",
    glowColor: "#7ec8a0",
    links: [
      { id: "f1", source: "stackField", target: "ditherFlow", amount: 0.8 },
      { id: "f2", source: "stackField", target: "asciiDensity", amount: 0.5 },
      { id: "f3", source: "stackField", target: "ditherBite", amount: 0.45 },
      { id: "f4", source: "stackField", target: "wet", amount: 0.35 },
    ],
  },
  /* Every system at once, each on its own driver. See `fuseEverything`. */
  wholeCloth: { ...fuseEverything("Whole Cloth"), id: "wholeCloth" },

  /* ======================================================================
   * THE TWO EMPTY CELLS — 2026-08-04
   * ----------------------------------------------------------------------
   * Sebs: "i asked to have at least one fusion for every possible combo of
   * styles." `scripts/verify/_probe-fusion-coverage.mjs` enumerates the eight
   * subsets of {texture, dither, ascii} and prints which have a shipped
   * relationship. Two did not. These are those two — not two more mixes, and
   * deliberately not one per cell of a 16-cell table, because a permutation
   * dump is the thing this rail was rebuilt to stop being.
   * ====================================================================== */

  /* CONCEPT: the ink has not dried. The SURFACE-ONLY cell — no texture, no
   * dither, no ASCII — and the only relationship on the rail whose driver is the
   * DRAWING rather than a clock.
   *
   * RELATIONSHIP: `reveal` runs -1 -> +1 across the draw, and the link is
   * NEGATIVE, so wetness is highest while the pen is still moving and falls away
   * behind it. `completion` is the one-shot at the instant the mark finishes —
   * the glow catches once and decays. `drift` is the only ambient term, and it
   * is on the ink's WEIGHT rather than on shine, so a finished mark keeps
   * breathing without turning into a pulsing light.
   *
   * WHY THESE THREE TARGETS AND NOT `gloss`: this file's own FusionFrame note
   * records clearcoat/roughness/env as "repeatedly measured near-invisible at
   * stroke scale". `wet` moves albedo, roughness AND reflection together, which
   * is what drying actually looks like; `ink` is the weight on its own; `glow`
   * is the angle-independent read that survives a dark body. */
  stillWet: {
    id: "stillWet",
    name: "Still Wet",
    glowColor: "#bfd4e8",
    links: [
      { id: "s1", source: "reveal", target: "wet", amount: -0.85 },
      { id: "s2", source: "completion", target: "glow", amount: 0.5 },
      { id: "s3", source: "drift", target: "ink", amount: 0.4 },
    ],
  },

  /* CONCEPT: wood type. The TEXTURE+ASCII cell, and the point of it is that the
   * two layers read EACH OTHER rather than merely sitting on the same mark.
   *
   * RELATIONSHIP: the grain's own phase drives the glyph density — the block
   * decides where the type takes ink — and the glyph field drives the pattern's
   * bite, so the letters press back into the grain. That is a two-way coupling
   * between exactly the two systems this cell is about, which is why it is an
   * answer to the cell and not a reskin of Code Bloom (whose pair is
   * dither+ascii and whose driver is a shared breath).
   *
   * Both source layers are ANIMATED in the preset's patch: `textureField` and
   * `asciiField` read a PHASE, and a phase that does not advance is pinned at
   * `phaseTriangle(0)` = 0 by design — the exact way the first shipped seed link
   * measured 0.000000. */
  letterpress: {
    id: "letterpress",
    name: "Letterpress",
    glowColor: "#c9b79a",
    links: [
      { id: "p1", source: "textureField", target: "asciiDensity", amount: 0.65 },
      { id: "p2", source: "asciiField", target: "textureBite", amount: 0.45 },
      { id: "p3", source: "drift", target: "ink", amount: 0.4 },
    ],
  },
}

/* ------------------------------ output frame ------------------------------ */

/**
 * Per-frame modulation of the already-resolved style values. Multipliers
 * default to 1, offsets to 0, so the identity frame changes nothing. Applied
 * by viewport-3d.tsx AFTER each system's own state/stack/timing resolution —
 * fusion modulates the final write, it never replaces a system's own logic.
 */
export interface FusionFrame {
  /* texture (pattern layer) */
  textureIntensityMul: number
  textureScaleMul: number
  textureTimeAdd: number
  textureContrastAdd: number
  /* dither (threshold layer) */
  ditherIntensityMul: number
  ditherThresholdAdd: number
  ditherScaleMul: number
  ditherTimeAdd: number
  ditherContrastAdd: number
  /* ascii (glyph layer) */
  asciiDensityAdd: number
  asciiTimeAdd: number
  asciiCellMul: number
  asciiContrastAdd: number
  /* material (surface response — applied after animated-material/base pinning).
   * Angle-dependent levers (clearcoat/env/roughness) are always paired with an
   * angle-INDEPENDENT one (emissive or wet-darkening) because the former were
   * repeatedly measured near-invisible at stroke scale in this codebase. */
  clearcoatAdd: number
  roughnessAdd: number
  envMapAdd: number
  sheenAdd: number
  metalnessAdd: number
  emissiveAdd: number
  /** Thin-film iridescence. A real three.js lever the material system already
   *  ships (Oil Slick) and pins every frame; fusion could not reach it. */
  iridescenceAdd: number
  /** Emissive colour to use when the base material's emissive is black. */
  emissiveColor: string | null
  /** Multiplies the albedo (1 = unchanged, <1 = wet-look darkening). */
  colorScale: number
  /** Shine band override — the travelling highlight LOCKED to a moving layer
   *  field ("material shine follows the moving ASCII field"). Null = no band. */
  sweep: { pos: number; amt: number; width: number; dirX: number; dirY: number } | null
}

const IDENTITY: Omit<FusionFrame, "sweep"> = {
  textureIntensityMul: 1,
  textureScaleMul: 1,
  textureTimeAdd: 0,
  textureContrastAdd: 0,
  ditherIntensityMul: 1,
  ditherThresholdAdd: 0,
  ditherScaleMul: 1,
  ditherTimeAdd: 0,
  ditherContrastAdd: 0,
  asciiDensityAdd: 0,
  asciiTimeAdd: 0,
  asciiCellMul: 1,
  asciiContrastAdd: 0,
  clearcoatAdd: 0,
  roughnessAdd: 0,
  envMapAdd: 0,
  sheenAdd: 0,
  metalnessAdd: 0,
  emissiveAdd: 0,
  iridescenceAdd: 0,
  emissiveColor: null,
  colorScale: 1,
}

function identityFrame(): FusionFrame {
  return { ...IDENTITY, sweep: null }
}

/* ------------------------------- inputs ----------------------------------- */

/**
 * Live per-frame values the layers are ACTUALLY rendering with, handed in by
 * viewport-3d.tsx after it computes them. This is what makes the cross-links
 * honest: e.g. the ASCII-Rubber shine band is positioned from the very
 * uniform value the glyph grid scrolls with, so changing the ASCII speed dial
 * provably changes the band's speed.
 */
export interface FusionSignals {
  /** Value written to uFsAscTime this frame (glyph-grid phase, in cells). */
  asciiTime: number
  /** Value written to uFsDitTime this frame (threshold-matrix phase). */
  ditherTime: number
  /** Value written to uFsTexTime this frame (pattern phase). */
  textureTime: number
  /** The layer-stack GROUP's own phase this frame — viewport-3d's `gOff`, the
   *  shared offset stack animation slides every layer by. Optional so a caller
   *  written before this source existed still typechecks and simply rests. */
  stackTime?: number
  /** The group's amplitude envelope (`gAmt`), 0..1+, folded in below so the
   *  Stack source hears a fade as well as a drift — a stack behaviour that only
   *  fades (freezeOnComplete, completionPulse) would otherwise be silent. */
  stackAmount?: number
  /** Camera azimuth around the mark, in RADIANS. Geometry-driven, so the View
   *  source keeps working with style motion off. */
  orbit?: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
/** Deterministic 0..1 hash for glitch-event scheduling (matches the shader's
 *  sin-fract family; good enough for event dice, cheap enough per frame). */
const hash01 = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453
  return s - Math.floor(s)
}

/* ---------------------------- the drive shape ------------------------------ */

/** The one real axis: how a fusion relationship moves through time. */
export type FusionDrive = "loop" | "arc" | "burst"

/**
 * How much of the ambient loop survives once an Arc has landed.
 *
 * NOT ZERO, AND THAT IS THE WHOLE POINT. Every Arc used to decay to a constant
 * and stay there: Code Bloom's animated variant measured path 0.00 / tone swing
 * 0.00 over the 7-13 s window, and ASCII Rubber's deceleration term cancelled
 * the glyph field's own advance exactly, leaving the shine band parked forever.
 * A one-shot on a canvas the user goes on looking at has to land somewhere
 * ALIVE, or the option reads as broken the moment its envelope expires.
 *
 * 0.35 was chosen to match what the two Arcs that already had a residual were
 * authored with (Terminal Gel kept 0.08 of a 0.25 breath = 32%; Dither Bloom
 * kept 0.25 of its full bloom), so the presets that were right keep the feel
 * they were tuned to and the ones that were dead inherit it.
 */
const ARC_SETTLE = 0.35

/**
 * How much ambient breath survives under Burst. Small, because "rests and
 * fires" is the point — but not zero, for the same reason ARC_SETTLE is not:
 * between events the picture should read as a live surface holding still, not
 * as a frozen screenshot.
 */
const BURST_AMBIENT = 0.2

/** Event slot length in seconds at 1x speed. */
const SLOT_SECONDS = 1.1
/** Slots whose dice beat this fire. */
const SLOT_THRESHOLD = 0.45
/**
 * Event envelope length. 0.16 s envelopes were measured near-invisible live (a
 * 700 ms sampling pass caught zero events); 0.3 s makes each break a readable
 * EVENT while still snapping off well inside its slot.
 */
const SLOT_ENVELOPE = 0.3
/**
 * Attack on the event envelope — THE PEAK MUST LAST LONGER THAN ONE FRAME.
 *
 * The envelope was `1 - inSlot / envLen`: a vertical attack and a linear decay,
 * so its maximum occupied exactly the frame the event fired and everything the
 * eye actually caught was the tail. lib/style-clock.ts already learned this on
 * `pulseEnvelope` and wrote it down — "a bare exp(-t/τ) peaks on the frame the
 * trigger fires ... which is why the mode read as 'something faded for no
 * reason' rather than as an event" — and the fix there was a short linear rise in
 * front of the settle. Same number here (90 ms, ~5 frames at 60 Hz) so the two
 * impact envelopes in this codebase are one idea: fast in, slower out, the
 * struck-bell shape the 12-principles/timing-mastery material calls for on an
 * impact accent, and asymmetric in the direction the review rubric requires.
 */
const SLOT_ATTACK = 0.09

/** 0 → 1 → 0 impact envelope for one event, `t` measured from the slot start. */
function slotEnvelope(t: number, attack: number, len: number): number {
  if (t < 0 || t >= len) return 0
  if (t < attack) return t / attack
  return 1 - (t - attack) / (len - attack)
}

/**
 * Ease-out on an arrival's progress.
 *
 * `build` was the raw linear ramp `min(reveal, sinceArmed / arcSecs)`, which
 * means every Arc travelled at a constant rate and then stopped dead at 1. The
 * review rubric's decision order is explicit — an ENTERING element uses ease-out,
 * because starting fast is what makes the arrival feel responsive and settling
 * slow is what makes it land rather than halt. Cubic ease-out is the closest
 * cheap match to the strong `cubic-bezier(0.23, 1, 0.32, 1)` the standards file
 * specifies for UI entrances.
 */
const easeOutArrival = (b: number) => 1 - (1 - b) * (1 - b) * (1 - b)

export interface DriveFrame {
  /**
   * The ambient oscillator, 0..1, already scaled by SWING and by the shape's
   * ambient allowance (full under Loop, ARC_SETTLE×build under Arc,
   * BURST_AMBIENT under Burst). Rests at exactly 0.5, so a preset that maps
   * `(osc - 0.5)` gets a true zero when the drive is pinned.
   */
  osc: number
  /**
   * Arrival progress, 0..1. 0 = the Arc has just been armed and the
   * relationship is at its starting extreme; 1 = it has landed. Always 1 for
   * Loop and Burst, so `(1 - build)` is the arrival ramp and it is identically
   * zero for the shapes that do not arrive.
   */
  build: number
  /** Sharp event envelope, 0..1. Non-zero only under Burst. */
  hit: number
  /** Sign for this event, so successive jolts do not all shear the same way. */
  hitSign: number
  /** True when style time is frozen (motion mode off / reduced motion). */
  frozen: boolean
  /**
   * How much ambient the shape allows this frame — 1 under Loop, ARC_SETTLE×build
   * under Arc, BURST_AMBIENT under Burst, 0 when frozen. Published because a
   * source that generates its OWN oscillator (Drift) has to be scaled by exactly
   * the same allowance as `osc`, or one entry on the dropdown would be the one
   * the Drive dial and the Swing dial did not reach.
   */
  allow: number
}

/**
 * Generates a preset's driver from the shared shape vocabulary.
 *
 * Every argument except `omega`/`arcSecs`/`raw` is shape-independent scene
 * state, so two presets given the same shape move on the same terms — which is
 * what makes "Loop", "Arc" and "Burst" mean one thing across the rail instead
 * of one thing per preset.
 *
 * `raw` lets a preset supply its own 0..1 oscillator when a plain sine is wrong
 * for it (Signal Ink's frequency-modulated burst signal reads as organic
 * surges, and a metronome does not). It is still swing- and settle-scaled here,
 * so the dials behave identically whichever oscillator is in use.
 */
function driveOf(o: {
  drive: FusionDrive
  /** Style time is frozen: motion mode off, or prefers-reduced-motion. */
  frozen: boolean
  /** Scene time × speed. */
  t: number
  /** Draw-in progress 0..1. */
  rv: number
  /** Seconds since this preset/shape was selected. */
  sinceArmed: number
  /** Seconds since the draw-in completed (Infinity sentinel = never). Part of
   *  the shared context every case passes in; the shapes generated here are
   *  arming- and reveal-keyed, so only the presets that own a completion-driven
   *  behaviour (ASCII Rubber's slowdown) read it directly. */
  since: number
  /** Fusion speed multiplier. */
  spd: number
  /** SWING dial 0..1 — how far the drive's own signal travels. */
  swing: number
  /** Ambient oscillator rate. */
  omega: number
  /** How long this preset's arrival takes at 1x speed. */
  arcSecs: number
  /** Optional custom 0..1 oscillator in place of `sin(t*omega)`. */
  raw?: number
}): DriveFrame {
  const { drive, frozen, t, rv, sinceArmed, spd, swing, omega, arcSecs } = o

  /* ARRIVAL. `min(reveal, arming)` so the arc plays WITH the draw when there is
   * one and plays on SELECTION when the stroke finished long ago — the two
   * honest origins, exactly as `completionTrigger` documents for the
   * completion-keyed case. Frozen parks it landed: motion mode off should show
   * the settled look, not hold a build at its starting extreme forever. */
  const build =
    drive === "arc" && !frozen
      ? easeOutArrival(Math.min(rv, clamp01(sinceArmed / (arcSecs / spd))))
      : 1

  /* AMBIENT ALLOWANCE. This single number is what makes an Arc end alive: it
   * fades the loop in as the arrival lands and holds it at ARC_SETTLE
   * afterwards, instead of leaving the relationship with nothing to do. */
  const allow = drive === "arc" ? ARC_SETTLE * build : drive === "burst" ? BURST_AMBIENT : 1
  const raw = frozen ? 0.5 : (o.raw ?? 0.5 + 0.5 * Math.sin(t * omega))
  const osc = 0.5 + (raw - 0.5) * swing * allow

  /* EVENTS. Fixed slots, dice per slot, sharp decaying envelope inside the
   * slot; deterministic (hash of slot index) so headless and headed runs agree.
   *
   * MEASURED FROM ARMING, NOT SCENE TIME. The grid used to run off
   * `clock.elapsed`, which means the schedule had been ticking since page load
   * and selecting the preset dropped the user at an arbitrary phase of it —
   * sometimes mid-silence, for up to a full slot. It also made the intensity
   * sweep non-monotonic in measurement (0.75 read the same as fusion-off,
   * because that six-second window happened to land between events). Arming the
   * grid means every selection starts with a slot boundary. */
  let hit = 0
  let hitSign = 1
  if (drive === "burst" && !frozen) {
    const armedT = Math.max(0, sinceArmed) * spd
    const slot = Math.floor(armedT / SLOT_SECONDS)
    const inSlot = armedT - slot * SLOT_SECONDS
    const env = slotEnvelope(inSlot, SLOT_ATTACK, SLOT_ENVELOPE)
    const fires = hash01(slot)
    const strength = 0.55 + 0.45 * hash01(slot + 7)
    if (fires > SLOT_THRESHOLD) hit = env * strength * swing
    hitSign = hash01(slot + 13) > 0.5 ? 1 : -1
  }
  return { osc, build, hit, hitSign, frozen, allow: frozen ? 0 : allow }
}

/**
 * Which drive shape is active.
 *
 * `fusionDrive` is the source of truth. `fusionAnimationEnabled` is the legacy
 * boolean the old two-family taxonomy was built on; it is still written (and
 * still shown in the debug readout) so the verification scripts that set it
 * directly keep working, and when a caller sets it true while the drive still
 * reads "loop" it is honoured as "arc" — the shape that boolean always meant.
 */
export function resolveFusionDrive(state: {
  fusionDrive?: FusionDrive
  fusionAnimationEnabled?: boolean
}): FusionDrive {
  const d = state.fusionDrive
  if (d === "arc" || d === "burst") return d
  return state.fusionAnimationEnabled ? "arc" : "loop"
}

/* ------------------------------ evaluation -------------------------------- */

/**
 * How much of a user-authored relationship exists before its Arc has landed.
 *
 * NOT ZERO, for the reason ARC_SETTLE is not zero, pointed the other way: an
 * Arc that starts at zero coupling shows the user an unlinked composition for
 * the first second of every arrival, which reads as "my fusion did not load".
 * Starting at a third and rising to full is an arrival of the RELATIONSHIP —
 * the systems find each other — which is what an authored Arc should mean when
 * the engine cannot know which of the user's parameters ought to start extreme.
 */
const CUSTOM_ARC_FLOOR = 0.35

/**
 * Maps an unbounded layer phase onto a signed −1..1 triangle so it can drive
 * something. The period is in the phase's own units (grid cells for ASCII and
 * dither, pattern units for texture) — one full traverse per period, and the
 * triangle (rather than a sine) keeps the traverse LINEAR, so a band riding it
 * crosses the stroke at a constant speed instead of easing at both ends.
 *
 * THE QUARTER-PERIOD OFFSET IS THE WHOLE POINT, and it is a defect fix.
 *
 * Without it, `phaseTriangle(0)` is +1 — full scale. A layer whose animation is
 * off holds its phase uniform at 0, so all three field sources sat pinned at
 * their maximum AND at the same value as each other: measured 2026-08-01, the
 * ASCII, dither, texture and draw-progress sources produced frames identical to
 * 0.00 across all six pairs. Four dropdown entries, one signal, none of them
 * saying so — the exact "names must match behaviour" failure, wearing a green
 * row (each one did "change the picture" relative to zero).
 *
 * Offsetting a quarter period puts REST AT ZERO, which is the honest answer: a
 * layer that is not moving has no phase signal to give, so its link contributes
 * nothing and the panel says why. The traverse is unchanged.
 */
function phaseTriangle(phase: number, period: number): number {
  const x = phase / period + 0.25
  const c = x - Math.floor(x)
  return Math.abs(c * 2 - 1) * 2 - 1
}

/* ==========================================================================
 * FUSION_READOUT — what each relationship is doing RIGHT NOW
 * ==========================================================================
 *
 * Published in the same family as `SWEEP_DEBUG` and `STYLE_CLOCK_DEBUG` in
 * components/viewport-3d.tsx, and for the same reason: so a claim about a
 * per-frame value can be READ rather than inferred.
 *
 * WHY THE PANEL NEEDS IT. Sebs: *"i aldo dont htink iy makes sesen or clrra hwo
 * to set i tup"*. The panel could say why a link was ASLEEP and had no way at
 * all to say a link was AWAKE — so a working relationship and a dead one looked
 * identical, and the only way to tell them apart was to stare at the mark and
 * guess. Silence in the positive direction is the same defect as silence in the
 * negative one; this is the value the row shows.
 *
 * `drive` is the number that matters: source × amount × coupling, i.e. exactly
 * how hard this link is pushing its parameter this frame. Signed, because the
 * polarity is half of what a relationship says.
 *
 * MUTATED IN PLACE, NEVER REALLOCATED. This is written every frame inside the
 * render loop; a fresh object per frame is the allocation pattern the 2026-08-02
 * performance pass measured React paying 3.3x the cost of three.js for.
 */
export const FUSION_READOUT: {
  /** Which fusion these numbers belong to. Consumers must check it. */
  id: string
  /** The live value of every source this frame, −1..1. */
  sources: Partial<Record<FusionSourceId, number>>
  /** Signed push per link id: source × amount × coupling. */
  drive: Record<string, number>
  /** The coupling strength itself (Link dial × the reveal gate). */
  k: number
  /** Frame counter, so a reader can tell a stale readout from a live one. */
  tick: number
} = { id: "", sources: {}, drive: {}, k: 0, tick: 0 }

/**
 * Evaluate a user-authored fusion into the same FusionFrame the eight built-in
 * relationships write.
 *
 * Every per-target amplitude is inherited from the built-in that proved that
 * parameter reads at stroke scale — the citation is on each line. This is the
 * difference between an authoring surface and a rack of sliders that move
 * numbers nobody can see.
 */
function applyCustomLinks(
  cf: CustomFusion,
  f: FusionFrame,
  ctx: {
    dr: DriveFrame
    drive: FusionDrive
    k: number
    swing: number
    pulse: number
    rv: number
    /** Scene time × fusion speed — Drift generates its own second oscillator. */
    t: number
    signals: FusionSignals
    asciiCellRate: number
  },
): FusionFrame {
  const { dr, drive, swing, pulse, rv, signals } = ctx
  // The coupling itself arrives under Arc (see CUSTOM_ARC_FLOOR).
  const k = ctx.k * (drive === "arc" ? CUSTOM_ARC_FLOOR + (1 - CUSTOM_ARC_FLOOR) * dr.build : 1)

  // SOURCES, each resolved once per frame rather than per link, so two links
  // reading the same source are guaranteed to see the same value — which is
  // what makes "everything breaks on the SAME impulse" authorable by a user.
  //
  // SWING applies to the drive's own signal and to the layer phases (which are
  // style-time motion), and NOT to reveal or completion — exactly the split the
  // built-ins document: at Swing 0 the systems stay linked and still respond to
  // the draw, because those two are driven by geometry playback, not style time.
  /* The same untrusted-input rule as the links below, for the one non-numeric
   * field that crosses the storage boundary. `glowColor` is handed to
   * `THREE.Color.set()` in viewport-3d.tsx; a restored fusion missing it (any
   * blob written before the field existed) or carrying a non-string reaches
   * `Color.setStyle` and gets a console warning plus an unpredictable colour.
   * Falling back to the editor's own default is the same answer the user would
   * get creating the fusion today. */
  const glow = typeof cf.glowColor === "string" && cf.glowColor ? cf.glowColor : DEFAULT_GLOW_COLOR

  const src: Record<FusionSourceId, number> = {
    breath: (dr.osc - 0.5) * 2,
    /* TWO DETUNED SINES, ratio 1 : 0.618 (the golden ratio, which is the least
     * rational number there is) so the sum has no period a viewer can learn. It
     * rides `dr.osc`'s own scaling for Swing and for the drive's ambient
     * allowance — take that from the drive frame rather than re-deriving it, or
     * Drift would be the one source the Swing dial did not govern. */
    drift: (dr.osc - 0.5) * 2 * 0.55 + Math.sin(ctx.t * 0.41 + 1.7) * 0.45 * swing * dr.allow,
    asciiField: phaseTriangle(signals.asciiTime, 7) * swing,
    ditherField: phaseTriangle(signals.ditherTime, 8) * swing,
    textureField: phaseTriangle(signals.textureTime, 6) * swing,
    /* THE GROUP'S DRIFT *AND* ITS FADE. A stack behaviour that only fades
     * (freezeOnComplete, completionPulse) leaves `gOff` at zero, so a source
     * reading the offset alone would be silent on half the behaviours it claims
     * to hear. `gAmt` rests at exactly 1, so `(amt - 1)` is a true zero. */
    stackField:
      phaseTriangle(signals.stackTime ?? 0, 5) * swing +
      ((signals.stackAmount ?? 1) - 1) * 2,
    /* THE VIEW. A full turn is one traverse, and it is NOT scaled by Swing:
     * this is geometry, like the draw — Swing governs style time, and turning
     * the mark is not style time. `phaseTriangle` puts rest at zero, so the
     * angle the page loads at is the neutral one. */
    orbit: phaseTriangle(signals.orbit ?? 0, Math.PI * 2),
    reveal: rv * 2 - 1,
    completion: pulse,
    event: dr.hit * dr.hitSign,
  }

  /* PUBLISH WHAT IS LIVE, BEFORE the loop can `continue` past a link.
   * Written here rather than inside the loop so a link that is skipped (amount
   * 0, unresolvable source, a value of exactly zero) still gets a row — those
   * are precisely the links whose reading of 0.00 the user most needs to see.
   * Keys are cleared only when the fusion changes, so the steady state does no
   * allocation at all. */
  if (FUSION_READOUT.id !== cf.id) {
    FUSION_READOUT.id = cf.id
    FUSION_READOUT.drive = {}
    FUSION_READOUT.sources = {}
  }
  FUSION_READOUT.k = ctx.k
  FUSION_READOUT.tick++
  for (const s of Object.keys(src) as FusionSourceId[]) FUSION_READOUT.sources[s] = src[s]
  for (const link of cf.links ?? []) {
    const rv0 = src[link?.source as FusionSourceId]
    FUSION_READOUT.drive[link?.id] =
      typeof rv0 === "number" && Number.isFinite(rv0) && Number.isFinite(link?.amount)
        ? rv0 * link.amount * k
        : 0
  }

  for (const link of cf.links ?? []) {
    /* EVERY LINK HERE IS UNTRUSTED INPUT, AND THAT IS NOT A HYPOTHETICAL.
     *
     * A `CustomFusion` reaches this loop straight out of `localStorage`
     * (`freestroke.fusions.v1`). That blob carries NO version field — the only
     * version is the `.v1` in the key — and the restore filter in app/page.tsx
     * checks three things: `id` is a string, `name` is a string, and `links`
     * IS AN ARRAY. It never inspects a single element. So the contents of a
     * link are whatever some build wrote, which includes: an older build with
     * a source we have since renamed, a NEWER build the user downgraded from,
     * a hand-edited devtools entry, or a fusion someone pasted in.
     *
     * `src[link.source]` on an unknown key is `undefined`, and `undefined * a`
     * is `NaN`. The guard below it (`if (v === 0 …) continue`) does not stop it,
     * because `NaN === 0` is false. From there `f.ditherScaleMul *= NaN` poisons
     * a MULTIPLICATIVE accumulator, so one unrecognised link silently voids
     * every other link the user authored against the same parameter, and the
     * result lands in a shader uniform — where a NaN is not a wrong picture but
     * an undefined one, with nothing logged anywhere.
     *
     * Measured before this guard (assert-style-contracts §4): six of eight
     * malformed shapes produced a non-finite frame, and a single bad link among
     * two good ones took `ditherScaleMul` with it.
     *
     * Skipping the link is the honest response and not a silent one: the panel
     * already renders an unresolvable source with no label, so a link this
     * rejects is a link the user can SEE is broken. Repairing it by guessing a
     * substitute source would be inventing a relationship they never authored.
     */
    const raw = src[link?.source as FusionSourceId]
    if (typeof raw !== "number" || !Number.isFinite(raw)) continue
    const a = typeof link.amount === "number" && Number.isFinite(link.amount) ? link.amount : 0
    /* THE SHINE BAND HAS TO BE WRITTEN EVEN WHEN IT IS SILENT.
     *
     * viewport-3d.tsx applies the band inside `if (fz.sweep)` and, on the else
     * branch, restores only the sweep's DIRECTION — `uFsSweepAmt` keeps
     * whatever the last frame that did emit a sweep left in it. So skipping the
     * link at amount 0 left a bright band parked on the mark, and the arm's own
     * reference measured a Δ24.9 spread against itself. Emitting the sweep with
     * `amt` 0 turns the band off honestly from this side. (The same stale-band
     * path exists when a user switches AWAY from a band-driving fusion — that
     * one needs the viewport's else branch to zero `uFsSweepAmt`, and is
     * reported rather than reached into from here.) */
    if (a === 0 && link.target !== "shineBand") continue
    const v = raw * a
    if (v === 0 && link.source !== "reveal" && link.target !== "shineBand") continue
    switch (link.target) {
      /* dither — amplitudes from Dither Bloom (0.65) and Pixel Clay (1.1). */
      case "ditherThreshold":
        f.ditherThresholdAdd += -v * 0.65 * k
        break
      case "ditherCell":
        f.ditherScaleMul *= 1 + v * 1.1 * k
        break
      case "ditherAmount":
        f.ditherIntensityMul *= Math.max(0, 1 + v * 0.85 * k) // Signal Ink's depth
        break
      /* Glitch Ribbon jolts this by `g * 40 * sign` at full impulse; that is an
       * IMPULSE amplitude and a sustained link at forty would be a matrix that
       * has left the building. 12 is one traverse of a `ditherScale: 2` cell
       * grid over a full source swing, which is a visible crawl rather than a
       * teleport. */
      case "ditherFlow":
        f.ditherTimeAdd += v * 12 * k
        break
      /* Contrast is 0..1 in the shader and the state default is 0.5, so ±0.45 is
       * very nearly the whole range without asking the clamp to do the work —
       * the Code Bloom lesson (a swing that clips is a dial that reverses). */
      case "ditherBite":
        f.ditherContrastAdd += v * 0.45 * k
        break
      /* ascii — density from Terminal Gel (0.5), flow from ASCII Rubber (6x). */
      case "asciiDensity":
        f.asciiDensityAdd += v * 0.5 * k
        break
      case "asciiFlow":
        f.asciiTimeAdd += v * 6 * ctx.asciiCellRate * k
        break
      /* MULTIPLICATIVE, and bounded well away from zero. The cell size is a
       * DIVISOR in the glyph shader; driving it to zero is a division by zero
       * and driving it small is a glyph grid finer than a device pixel, which
       * docs/research/screen-space-layer-quality.md measured as the thing that
       * put every ASCII preset under the legibility floor. 0.55x..1.45x keeps a
       * 13px cell inside 7..19px, i.e. inside the range that renders as
       * characters. */
      case "asciiCell":
        f.asciiCellMul *= 1 + v * 0.45 * k
        break
      case "asciiBite":
        f.asciiContrastAdd += v * 0.45 * k
        break
      /* texture — from Scanline Balloon (0.85 scale, 0.25 amount) and Glitch
       * Ribbon (10x phase shear). Amount uses 0.7 (Pixel Clay's dissolve). */
      case "textureAmount":
        f.textureIntensityMul *= Math.max(0, 1 + v * 0.7 * k)
        break
      case "textureScale":
        f.textureScaleMul *= 1 + v * 0.85 * k
        break
      case "textureFlow":
        f.textureTimeAdd += v * 10 * k
        break
      case "textureBite":
        f.textureContrastAdd += v * 0.45 * k
        break
      /* material. Gloss is the angle-DEPENDENT trio, and it ships with a small
       * emissive partner for the reason stated on FusionFrame: measured on this
       * codebase, clearcoat/env/roughness alone are near-invisible at stroke
       * scale, so every built-in pairs them with an angle-independent read.
       * Terminal Gel's numbers (0.9 / -0.5 / 1.6 / 0.6). */
      case "gloss":
        f.clearcoatAdd += v * 0.9 * k
        f.roughnessAdd += -v * 0.5 * k
        f.envMapAdd += v * 1.6 * k
        f.emissiveAdd += Math.max(0, v) * 0.25 * k
        if (!f.emissiveColor) f.emissiveColor = glow
        break
      case "glow":
        f.emissiveAdd += v * 1.8 * k // Signal Ink's 2.4 is the loud end
        f.emissiveColor = glow
        break
      /* WET IS NOT ONLY A DARKENING, AND IT COULD NOT BE.
       *
       * Measured 2026-08-01 by assert-fusion-authoring: at full amount on the
       * default Ink material this read Δ0.058 against a 0.12 floor — a control
       * that does not visibly act. The cause is arithmetic, not wiring: Ink's
       * albedo is `#26262b`, so multiplying it by 0.55 moves each channel by
       * about seventeen 8-bit steps on a body that is already almost black.
       * Dither Bloom gets away with the same lever because it pairs it with
       * clearcoat and a 2.0 env lift — which is also what wet actually IS.
       * A wet surface is darker AND smoother AND more reflective; shipping only
       * the darkening was both physically half a description and, on this
       * palette, invisible. Same numbers as Dither Bloom's wet branch. */
      case "wet":
        f.colorScale *= 1 - v * 0.45 * k
        f.roughnessAdd += -v * 0.45 * k
        f.envMapAdd += v * 1.4 * k
        f.clearcoatAdd += v * 0.5 * k
        break
      /* Sheen is REAL but MATERIAL-DEPENDENT: three.js renders it through
       * `sheenColor`, and Ink's is `#000000` with `sheen: 0`, so on the default
       * body this lever is black light. It reads on the bodies that have a
       * sheen colour (Soft Gel, Rubber, Wax) — which is why Scanline Balloon,
       * whose patch selects one, can use it. The panel says so on the row
       * rather than letting the user conclude the dropdown is broken. */
      case "sheen":
        f.sheenAdd += v * 0.8 * k
        break
      /* 0.25 is Glitch Ribbon's ACCENT, ridden on top of a glow spike. As the
       * whole content of a user's link it measured Δ0.063 — under the floor. A
       * user-authored link at full amount is the loudest this relationship is
       * ever asked to be, so it gets a full traverse of the parameter. */
      case "metal":
        f.metalnessAdd += v * 0.6 * k
        break
      /* IRIDESCENCE NEEDS THE WHOLE RANGE, because three.js treats it as a MIX
       * factor between the plain BRDF and the thin-film one — Oil Slick, the one
       * preset that uses it, sits at exactly 1.0 (lib/style-system.ts). Half a
       * mix is half an effect, so a user's link at full amount gets the full
       * traverse, the same call `metal` had to make for the same reason. It is
       * clamped to 0..1 at the write in viewport-3d.tsx, and it is honestly
       * quietest on a matte body: the thin film modulates a REFLECTION, so a
       * surface with nothing to reflect has little for it to tint. The panel's
       * blurb says so rather than letting the row look broken. */
      case "iridescence":
        f.iridescenceAdd += v * 1.0 * k
        break
      /* The albedo scale on its own — no roughness, no env, no clearcoat.
       *
       * 0.75 AND NOT `wet`'S 0.45, for a reason this file already measured and
       * wrote down: at 0.45 on the default Ink body (`#26262b`) the albedo moves
       * about seventeen 8-bit steps, which read Δ0.058 against a 0.12 floor when
       * `wet` shipped as a darkening alone. `wet` solved that by adding three
       * shine levers — which is right for wetness and wrong here, because
       * "heavier ink" that also gets glossier is not ink weight. So this one
       * takes the other road and uses the whole traverse the accumulator's own
       * clamp allows (0.25x..1.6x), the same call `metal` and `iridescence` made
       * for the same reason: a user's link at full amount is the loudest this
       * relationship is ever asked to be. */
      case "ink":
        f.colorScale *= 1 - v * 0.75 * k
        break
      /* The band's POSITION is the source's value — this is ASCII Rubber's
       * "material shine follows the moving ASCII field", made authorable
       * against any source. Amount sets how bright it is, not where it is:
       * a dial that moved the band would break the lock that IS the effect. */
      case "shineBand": {
        /* THE BAND MUST STAY ON THE MARK.
         *
         * ASCII Rubber sweeps `pos` across -1.15..1.15 because its driver is a
         * CYCLE — the band is meant to leave the frame at each end and come
         * back. A user's source can be PINNED at an extreme (draw progress on a
         * finished stroke is exactly +1), and at +1.15 with width 0.42 the band
         * sits entirely off the geometry: measured Δ0.037 against a 0.12 floor,
         * i.e. a target that renders nothing at its own maximum. Clamping to
         * ±0.95 keeps the band's travel almost intact while guaranteeing that
         * every position a user can select is a position they can SEE. */
        const p = raw * 1.15
        f.sweep = {
          pos: p < -0.95 ? -0.95 : p > 0.95 ? 0.95 : p,
          amt: Math.abs(a) * 0.8 * k,
          width: 0.42,
          dirX: 1,
          dirY: 0,
        }
        break
      }
    }
  }
  // The albedo scale is the one field where several links multiplying can run
  // away; the built-ins never exceed 0.45 of depth, so this is the same bound.
  f.colorScale = Math.min(1.6, Math.max(0.25, f.colorScale))
  return f
}

/**
 * Compute this frame's fusion modulation. Returns null when no fusion preset
 * is active, so the caller can skip all application work.
 *
 * @param sinceArmed seconds since the current fusion preset (or its drive
 *   shape) was last changed — supplied by the caller from the shared clock.
 */
export function evaluateFusion(
  state: StyleState,
  clock: StyleClock,
  signals: FusionSignals,
  sinceArmed: number,
): FusionFrame | null {
  const f = evaluateFusionCore(state, clock, signals, sinceArmed)
  if (!f) return f
  /* ROW 82 AND PHASE 23, AFTER THE RELATIONSHIP. Both read zero on every state
   * written before they existed (`?? 0`), and at zero neither runs a line: the
   * frame the core returned is the frame the caller gets, the same object. */
  /* Chaos is a drift in style time, so with style time stopped (Motion Off,
   * or reduced motion folded in by the caller) there is nothing to drift. */
  const chaos = state.motionMode === "off" ? 0 : clamp01(state.fusionChaos ?? 0)
  const drifted =
    chaos > 0 && clamp01(state.fusionIntensity) > 0
      ? driftFusionFrame(f, chaos, (lag) =>
          evaluateFusionCore(state, lagClock(clock, lag), signals, Math.max(0, sinceArmed - lag)),
        )
      : f
  const tip = clamp01(state.fusionTipShimmer ?? 0)
  return tip > 0 ? withTipShimmer(drifted, clock.reveal, tip) : drifted
}

/* ==========================================================================
 * ROW 82 AND THE PHASE 23 SYNC LIST (coverage item 12, 2026-10-02)
 * ==========================================================================
 *
 * PRD §4 lists the animated-fusion controls as "preset, speed, intensity,
 * sync, chaos/readability, reveal influence, completion behavior, relationship
 * strength". Preset, speed, intensity (Link) and strength (Swing) shipped;
 * these are the other three, plus the plan's Phase 23 list ("A user can
 * choreograph the object and its surface together"): shimmer riding the tip,
 * dither freezing on pause, a fusion bloom at completion. Every one of them is
 * a pure function of numbers here, gated in Node by
 * scripts/verify/assert-fusion-chaos.mjs, and every one is the identity at its
 * default, so a state that never touches them renders what it rendered before.
 */

/**
 * How far behind each fused system runs at chaos 1, in seconds of style time.
 * Texture is the reference and does not lag; the others are spread so no two
 * share a phase on any of the drive rates (omega 1.1 to 1.4 rad/s, a 4.5 to
 * 5.7 s breath): at chaos 1 the surface runs about half a breath behind.
 */
export const FUSION_CHAOS_LAG = { texture: 0, dither: 0.9, ascii: 1.7, material: 2.6 } as const

type ChaosSystem = keyof typeof FUSION_CHAOS_LAG

/** Which system each field of a FusionFrame belongs to. `sweep` is the surface's. */
const FRAME_SYSTEM: Readonly<Record<keyof FusionFrame, ChaosSystem>> = {
  textureIntensityMul: "texture",
  textureScaleMul: "texture",
  textureTimeAdd: "texture",
  textureContrastAdd: "texture",
  ditherIntensityMul: "dither",
  ditherThresholdAdd: "dither",
  ditherScaleMul: "dither",
  ditherTimeAdd: "dither",
  ditherContrastAdd: "dither",
  asciiDensityAdd: "ascii",
  asciiTimeAdd: "ascii",
  asciiCellMul: "ascii",
  asciiContrastAdd: "ascii",
  clearcoatAdd: "material",
  roughnessAdd: "material",
  envMapAdd: "material",
  sheenAdd: "material",
  metalnessAdd: "material",
  emissiveAdd: "material",
  iridescenceAdd: "material",
  emissiveColor: "material",
  colorScale: "material",
  sweep: "material",
}

/** The shared clock, `lag` seconds of style time ago. Reveal and completion
 *  are geometry's, not style time's, so they are left where they are. */
function lagClock(clock: StyleClock, lag: number): StyleClock {
  return lag === 0 ? clock : { ...clock, elapsed: clock.elapsed - lag }
}

/**
 * CHAOS: the fused systems drift apart. Each system takes its fields from the
 * same relationship evaluated `chaos * FUSION_CHAOS_LAG[system]` seconds behind
 * (`at(lag)`), so at chaos 0 they are the one frame, and as chaos rises they
 * breathe, arrive and fire out of step. It is the same relationship, never a
 * new random signal, which is the PRD's line between chaos and noise. A keyed
 * chaos moves each lag smoothly, so the lagged clocks never jump.
 */
export function driftFusionFrame(
  base: FusionFrame,
  chaos: number,
  at: (lag: number) => FusionFrame | null,
): FusionFrame {
  const c = clamp01(chaos)
  if (c <= 0) return base
  const out: FusionFrame = { ...base }
  const write = out as unknown as Record<string, unknown>
  for (const sys of Object.keys(FUSION_CHAOS_LAG) as ChaosSystem[]) {
    const lag = c * FUSION_CHAOS_LAG[sys]
    if (lag === 0) continue
    const lagged = at(lag) ?? base
    for (const [field, owner] of Object.entries(FRAME_SYSTEM)) {
      if (owner === sys) write[field] = (lagged as unknown as Record<string, unknown>)[field]
    }
  }
  return out
}

/**
 * REVEAL INFLUENCE: how much the draw gates the relationship. At 1 (and on a
 * state with no field) this is the smoothstep the gate has always been, the
 * same arithmetic, so the frame is unchanged; at 0 the gate is open from the
 * first frame and the draw no longer reaches the coupling.
 */
export function revealGate(reveal: number, influence: number | undefined): number {
  const rv = clamp01(reveal)
  const smooth = rv * rv * (3 - 2 * rv)
  const inf = influence === undefined ? 1 : clamp01(influence)
  if (inf >= 1) return smooth
  return 1 - inf * (1 - smooth)
}

/** Bloom's rise and settle, seconds. The rise is a smoothstep so the swell
 *  starts gently; the settle is three times the pulse's half-life. */
export const FUSION_BLOOM_RISE = 0.35
export const FUSION_BLOOM_SETTLE = 1.4

/**
 * COMPLETION: what the shared kick looks like after the draw completes (or the
 * fusion is armed on a finished stroke, `completionTrigger`). `pulse` is the
 * envelope every relationship has always used, the same expression; `bloom`
 * rises over FUSION_BLOOM_RISE and settles over FUSION_BLOOM_SETTLE to the
 * same peak, so every preset's clamps still hold; `off` is no accent.
 */
export function completionEnvelope(mode: string | undefined, trigger: number): number {
  if (trigger === Infinity) return 0
  if (mode === "off") return 0
  if (mode === "bloom") {
    if (trigger < 0) return 0
    if (trigger < FUSION_BLOOM_RISE) {
      const x = trigger / FUSION_BLOOM_RISE
      return x * x * (3 - 2 * x)
    }
    return Math.exp(-(trigger - FUSION_BLOOM_RISE) / FUSION_BLOOM_SETTLE)
  }
  return Math.exp(-trigger / 0.5)
}

/** The tip band's width and how far it travels (the shine band's own units:
 *  the drawing's bounds radius is 1, and ±0.95 keeps it on the mark, the
 *  bound `shineBand` measured). Fade in and out over the first and last 4% of
 *  the take so the band never pops on or off. */
const TIP_BAND_WIDTH = 0.28
const TIP_BAND_REACH = 0.95
const TIP_BAND_FADE = 0.04

/**
 * SHIMMER RIDES THE TIP. While the take plays, a shine band sits at the draw
 * front: its centre goes from one end of the mark to the other as the reveal
 * goes 0 to 1, along the drawing's x axis, the way a line of writing is laid
 * down. It is the draw's front, not the pen point itself: a stroke that runs
 * right to left still has its band travel left to right. Riding the exact
 * pen point needs the tip's position in the frame loop, which nothing
 * publishes there yet.
 *
 * A band the relationship already has (ASCII Rubber, a shineBand link) keeps
 * its place wherever it is the brighter of the two, so the tip never dims what
 * a fusion was already doing. Before and after the take there is no tip band.
 */
export function withTipShimmer(f: FusionFrame, reveal: number, amount: number): FusionFrame {
  const a = clamp01(amount)
  const rv = reveal
  if (a <= 0 || !(rv > 0 && rv < 1)) return f
  const env = Math.min(1, rv / TIP_BAND_FADE, (1 - rv) / TIP_BAND_FADE)
  const amt = a * 0.8 * env
  if (f.sweep && f.sweep.amt >= amt) return f
  return {
    ...f,
    sweep: { pos: -TIP_BAND_REACH + 2 * TIP_BAND_REACH * rv, amt, width: TIP_BAND_WIDTH, dirX: 1, dirY: 0 },
  }
}

/**
 * DITHER FREEZES ON PAUSE. The frame loop has no "paused" flag of its own, so
 * it reads the playhead: a take is paused when the playhead sits strictly
 * inside 0..1 and has not moved for PAUSE_SETTLE seconds of frames. The settle
 * keeps one frame where the playhead happens not to advance (two writers in
 * the same frame, a tiny delta) from reading as a pause; the end (1) and the
 * start (0) are rest, not pause, and never hold.
 */
export const PAUSE_SETTLE = 0.12

export interface PauseWatch {
  last: number
  still: number
}

export function createPauseWatch(): PauseWatch {
  return { last: NaN, still: 0 }
}

/** Advance the watch by one frame; true while the take is paused. */
export function watchPause(w: PauseWatch, playhead: number, delta: number): boolean {
  const inside = playhead > 0 && playhead < 1
  if (inside && playhead === w.last) w.still += Math.max(0, delta)
  else w.still = 0
  w.last = playhead
  return inside && w.still >= PAUSE_SETTLE
}

/** Which layers a pause holds, for a `fusionPauseHold` value. */
export function pauseHoldLayers(mode: string | undefined): { dither: boolean; texture: boolean; ascii: boolean; fusion: boolean } {
  const surface = mode === "surface"
  const dither = surface || mode === "dither"
  return { dither, texture: surface, ascii: surface, fusion: surface }
}

/**
 * Hold a value while `held`: the first held frame captures the live value and
 * every held frame after it returns the capture; the first free frame lets go.
 * One slot per layer, the same latch as the stack's freezeOnComplete.
 */
export function holdValue(slot: { v: number | null }, held: boolean, live: number): number {
  if (!held) {
    slot.v = null
    return live
  }
  if (slot.v === null) slot.v = live
  return slot.v
}

function evaluateFusionCore(
  state: StyleState,
  clock: StyleClock,
  signals: FusionSignals,
  sinceArmed: number,
): FusionFrame | null {
  const preset = state.fusionPreset
  if (preset === "none") return null

  const f = identityFrame()

  // LINK. How hard the driver reaches the driven parameter. Amplitudes below
  // are sized so the default 0.6 is CLEARLY visible (the "technically correct
  // but perceptually absent" trap); 1.0 is strong, 0 unlinks the systems
  // without disturbing the composition.
  const depth = clamp01(state.fusionIntensity)
  if (depth <= 0) return f

  // SWING. How far the drive's own signal travels. Defaulted rather than
  // required so a state object written before this dial existed still animates.
  const swing = clamp01(state.fusionSwing ?? 1)

  const spd = Math.max(state.fusionAnimationSpeed, 0.05)
  const drive = resolveFusionDrive(state)

  // Motion mode is the substrate-level "may style animate" switch, and
  // prefers-reduced-motion is folded into it by the caller. When it is off,
  // every drive freezes: the ambient oscillator parks at its midpoint, event
  // schedules go quiet, and arrivals show as LANDED. The relationship is still
  // SET (the systems stay linked), it just does not move. Reveal- and
  // completion-driven coupling still applies: those are driven by geometry
  // playback, not by style time.
  //
  // THIS USED TO BE HALF-TRUE. Only the ambient `t` was frozen; every
  // choreography was keyed to `sinceArmed`/`reveal` and went on playing, so
  // motion mode "Off" left six of the seven animated variants moving (Glitch
  // Ribbon most of all) and prefers-reduced-motion never reached fusion at all
  // — the one rail of four that ignored it.
  const frozen = state.motionMode === "off"
  const t = frozen ? 1.7 : clock.elapsed * spd

  // REVEAL GATE — "reveal progress controls all the relationships at once".
  // Smoothstep so the linkage eases in over the draw instead of snapping.
  const rv = clamp01(clock.reveal)
  const revGate = revealGate(rv, state.fusionRevealInfluence)

  /* COMPLETION PULSE — one shared decaying kick for every preset. Fast decay
   * (~0.5s to half) so it reads as an EVENT, not a lingering state.
   *
   * IT IS KEYED THROUGH `completionTrigger`, AND IT WAS NOT.
   *
   * This is the shared pulse: it feeds the user-facing "Completion" fusion
   * SOURCE and a dozen built-in branches (Terminal Gel's flare, Dither Bloom's
   * ink flood, Glitch Ribbon's impulse). It read `clock.sinceCompletion` raw —
   * and after any stroke is drawn that value grows without bound, so
   * `exp(-since/0.5)` is arithmetically zero within about six seconds and stays
   * there. The consequence, measured by assert-style-contracts §2 before this
   * change: selecting Terminal Gel on a finished mark produced emissive 0.27500
   * whether the preset had just been armed or had been sitting for thirty
   * seconds — bit-identical. The shared kick every fusion is built around fired
   * only if you happened to be watching the instant the draw ended.
   *
   * `completionTrigger`'s header states this exact trap and this exact fix, and
   * this file already IMPORTED it for one preset's private `sinceStop`. The
   * rule now applies where it was written to apply: take whichever origin —
   * the completion, or the moment the user armed this fusion — happened more
   * recently, and keep the Infinity sentinel so mid-draw stays silent. */
  const since = clock.sinceCompletion
  const trigger = completionTrigger(since, sinceArmed)
  const pulse = completionEnvelope(state.fusionCompletion, trigger)

  // Effective relationship strength this frame.
  const k = depth * revGate

  const shared = { drive, frozen, t, rv, sinceArmed, since, spd, swing }

  /* USER-AUTHORED FUSION. Resolved here rather than as a `case`, because the
   * id is not a literal — `custom:<id>` carries the fusion's identity through
   * the one state field viewport-3d.tsx already arms on. Everything above this
   * line (reveal gate, completion pulse, freeze, Link, Swing, Speed, the drive
   * shapes) has already been computed and applies unchanged: a user-made fusion
   * is a first-class citizen of the same engine, not a parallel path. */
  if (isCustomFusionId(preset)) {
    const cf = (state.customFusions ?? []).find((c) => customFusionKey(c.id) === preset)
    // A dangling id (a fusion deleted while selected) returns the identity
    // frame, never null: null would read to the caller as "no fusion active"
    // and silently drop the selection instead of showing an inert one.
    if (!cf) return f
    const dr = driveOf({ ...shared, omega: 1.2, arcSecs: 3.0 })
    return applyCustomLinks(cf, f, {
      dr,
      drive,
      k,
      swing,
      pulse,
      rv,
      t,
      signals,
      asciiCellRate: state.asciiScrollSpeed * 1.6,
    })
  }

  /* THE LINK-AUTHORED BUILT-INS, through the identical evaluator. Placed here
   * rather than as four more `case` blocks precisely because they are NOT more
   * cases: they are the same data path a user's fusion takes, which is what
   * makes "Edit a copy" on them an honest offer instead of an approximation. */
  /* THE COMBINATION CELLS, through the identical evaluator. `combo:<key>` is
   * looked up here rather than being merged into `BUILTIN_LINK_FUSIONS`,
   * because that map is also what lib/style-system.ts's `applyPresetToStyleState`
   * reads to decide whether a fusion PILL needs waking — and a cell is not on
   * that rail. Two registries, one evaluator, no second code path. */
  const builtinLinks = BUILTIN_LINK_FUSIONS[preset] ?? FUSION_COMBOS_BY_ID[preset]
  if (builtinLinks) {
    const dr = driveOf({ ...shared, omega: 1.1, arcSecs: 3.0 })
    return applyCustomLinks(builtinLinks, f, {
      dr,
      drive,
      k,
      swing,
      pulse,
      rv,
      t,
      signals,
      asciiCellRate: state.asciiScrollSpeed * 1.6,
    })
  }

  switch (preset) {
    /* --------------------------- Terminal Gel --------------------------- */
    // CONCEPT: a terminal readout suspended in soft gel — the characters and
    // the gel are ONE organism. RELATIONSHIP: glyph density is the driver;
    // the gel's shine/glow is computed from the same density signal, so the
    // surface glosses up and lights from within exactly as the characters
    // thicken, and dulls as they thin.
    case "terminalGel": {
      const dr = driveOf({ ...shared, omega: 1.4, arcSecs: 3.2 })
      // Driver: glyph density.
      //   Loop  — a slow breath around the layer's own density.
      //   Arc   — the characters build from sparse to full (Reveal Build), then
      //           keep the breath at ARC_SETTLE instead of stopping.
      //   Burst — the field holds, and each event flares the characters dense.
      // NOT FROM ZERO. -0.55 put the arrival's start 0.05 BELOW zero density,
      // where the uniform's clamp held it flat for the opening moment; -0.5 lands
      // it exactly at zero, which is this shader's `scale(0)` — a layer appearing
      // out of nothing, which the review rubric blocks. -0.42 leaves a faint
      // glyph field to grow FROM (density 0.08, the equivalent of starting at
      // scale(0.95) + opacity), and on a finished stroke — where the Arc is armed
      // by selection and there is no draw-in to justify an empty frame — that is
      // the difference between "the characters build" and "the characters blink
      // out and come back".
      let dens = (dr.osc - 0.5) * 0.5
      dens += -0.42 * (1 - dr.build)
      dens += dr.hit * 0.5
      dens += pulse * 0.3 // shared pulse: characters flare dense at completion
      f.asciiDensityAdd = dens * k
      // Driven: shine FROM the density signal (0 when glyphs thinned).
      const shine = clamp01(dens + 0.55) // recentre so breath spans 0.05..1
      f.clearcoatAdd = shine * 0.9 * k
      f.roughnessAdd = -shine * 0.5 * k
      f.envMapAdd = shine * 1.6 * k
      f.sheenAdd = shine * 0.6 * k
      // Angle-independent half of the shine: the gel glows faintly from
      // within as the characters thicken.
      f.emissiveAdd = (shine * 0.5 + pulse * 0.8) * k
      f.emissiveColor = "#a9c3e8"
      return f
    }

    /* --------------------------- Dither Bloom --------------------------- */
    // CONCEPT: a print whose ink is still WET — the halftone screen blooms
    // open and closed, and the surface wets/gloss-darkens with it.
    // RELATIONSHIP: the dither threshold is the driver; material shine (and
    // wet darkening) is computed from the same threshold signal.
    case "ditherBloom": {
      const dr = driveOf({ ...shared, omega: 1.1, arcSecs: 2.8 })
      // Driver: the bloom signal 0..1 — how much INK is flooding the screen.
      //   Loop  — a slow breath.
      //   Arc   — the print starts SOAKED (fully inked, wet-dark) and dries
      //           open over the arrival (Threshold Open), settling to a
      //           residual breath.
      //   Burst — the screen holds, and each event floods it.
      // Interpolated arrival (see the header): 1 = fully soaked at the start,
      // easing to the ambient breath as the arrival lands.
      let bloom = 1 + (dr.osc - 1) * dr.build
      bloom += dr.hit * 0.8
      bloom = clamp01(bloom + pulse * 0.5) // shared pulse: one ink flood
      // Driven 1: the threshold. Negative bias = tone pushed down = MORE ink —
      // the halftone dots grow and merge as the bloom rises.
      f.ditherThresholdAdd = -(bloom - 0.35) * 0.65 * k
      // Driven 2: shine from the SAME signal — flooding ink is WET ink.
      f.clearcoatAdd = bloom * 0.9 * k
      f.roughnessAdd = -bloom * 0.6 * k
      f.envMapAdd = (bloom * 2.0 + pulse * 1.0) * k
      // Angle-independent half: wet surfaces DARKEN (pores fill, light is
      // absorbed) — the readable wet-look at stroke scale.
      f.colorScale = 1 - bloom * 0.45 * k
      return f
    }

    /* ---------------------------- Signal Ink ---------------------------- */
    // CONCEPT: ink that carries a live signal — energy bursts travel the
    // stroke. RELATIONSHIP: one burst signal drives glow and pattern in
    // ANTI-PHASE: the surge of light washes the data marks out of the ink,
    // and as it decays the bitmap pattern floods back in. (In-phase was
    // judged live and read muddy: the brightened body starves the threshold
    // of dark tone at the exact moment the pattern is told to bite, so the
    // two fight. Anti-phase works WITH the tone physics — one wire, two
    // systems, visibly opposite ends of it.)
    case "signalInk": {
      // A frequency-modulated sine reads as organic surges rather than as a
      // metronome, so this preset supplies its own oscillator.
      const fm = Math.sin(t * 1.9 + Math.sin(t * 0.7) * 2.4)
      const dr = driveOf({ ...shared, omega: 1.9, arcSecs: 3.0, raw: 0.5 + 0.5 * fm })
      // Driver: the signal level.
      //   Loop  — continuous irregular surges.
      //   Arc   — the wire comes alive with the draw: silent at the start of the
      //           arrival, surging by the end, then a quieter live signal.
      //   Burst — discrete packets instead of a rolling surge.
      // Interpolated arrival: the wire is silent at the start of the arrival and
      // surging by the end of it.
      let burst = dr.osc * dr.build
      burst += dr.hit
      burst = clamp01(burst + pulse) // shared pulse = one full-strength burst
      // Driven 1: the pattern retreats as the burst rises, floods back after.
      f.ditherIntensityMul = 1 - k * (0.85 * burst)
      // Driven 2: the glow surges with the SAME signal (angle-independent).
      // 1.6 was measured as a ~7-point luminance lift on the already-emissive
      // signal body — technically present, perceptually a shrug. 2.4 makes the
      // surge flare toward white while the pattern is washed out.
      f.emissiveAdd = burst * 2.4 * k
      f.emissiveColor = "#39c1e8"
      f.metalnessAdd = (burst - 0.5) * 0.2 * k
      f.envMapAdd = burst * 0.8 * k
      // The matrix's TRAVEL SPEED itself surges with the signal — packets of
      // pattern visibly accelerate through the stroke (Data Flow). Phase warp =
      // integral-free speed surge: sin-warped time has a derivative that swells
      // and eases with the same rhythm as the driver. Scaled by SWING so the
      // dial governs this the same way it governs the rest of the drive, and
      // frozen when style time is.
      //
      // DELIBERATELY NOT ON LOOP. This is the whole difference between the two
      // shapes on this preset — under Loop the matrix crawls at its own constant
      // speed while the glow and the pattern trade places; under Arc/Burst the
      // travel itself surges. Turning it on for all three would have made Loop
      // and Arc the same picture, which is the byte-identical-sibling defect this
      // pass exists to remove, not to add.
      if (!frozen && drive !== "loop") {
        f.ditherTimeAdd = fm * 6 * k * swing + dr.hit * 12 * dr.hitSign * k
        f.textureTimeAdd = f.ditherTimeAdd * 0.4
      }
      return f
    }

    /* --------------------------- ASCII Rubber --------------------------- */
    // CONCEPT: a rubber skin with a current of characters running under it.
    // RELATIONSHIP: "material shine follows the moving ASCII field" — the
    // travelling highlight band's position is derived from the very uniform
    // the glyph grid scrolls with (signals.asciiTime), so the shine and the
    // characters move as one current. Change the ASCII speed dial and the
    // band provably changes speed with it.
    case "asciiRubber": {
      const dr = driveOf({ ...shared, omega: 0.9, arcSecs: 3.0 })
      // Driver: the glyph field's actual phase this frame (in grid cells).
      let phase = signals.asciiTime
      const cellRate = state.asciiScrollSpeed * 1.6 // viewport's ascii speed factor
      if (drive === "arc" && !frozen) {
        // ARRIVAL = the Slowdown. After completion (or after selecting the
        // preset) the current decelerates elastically. Stateless deceleration:
        // replace the linear post-completion phase advance (`sinceStop * rate`)
        // with an exponential approach — the field glides down instead of
        // cutting. The shine band rides the same corrected phase, so both slow
        // down TOGETHER.
        //
        // IT DECELERATES TO A FLOOR, NOT TO ZERO. `tau * (1 - e^-s/tau)` is
        // bounded, so its derivative goes to zero and the corrected phase became
        // a constant: the glyph current and the band it drives were parked
        // forever (measured: 453.9 path units static → 13.9 with the slowdown
        // armed, and the residual was the fusion term still ticking against a
        // stationary picture). Carrying ARC_SETTLE of the rate through means the
        // current comes to REST — a slow crawl — which is what "glides to a
        // stop" has to mean on a canvas that stays on screen.
        //
        // `completionTrigger` keeps the Infinity sentinel: mid-draw there has
        // been no completion, so the current runs at FULL speed and the
        // deceleration has not started. Written inline before as
        // `Math.min(since === Infinity ? Infinity : since, sinceArmed)`, which
        // is a tautology — `Math.min(Infinity, x)` is `x` — so the slowdown was
        // permanently spent from arming and could never replay.
        const sinceStop = completionTrigger(since, sinceArmed)
        if (sinceStop !== Infinity && sinceStop > 0) {
          const tau = 1.4 / spd
          const eased = tau * (1 - Math.exp(-sinceStop / tau))
          const travelled = ARC_SETTLE * sinceStop + (1 - ARC_SETTLE) * eased
          f.asciiTimeAdd = (travelled - sinceStop) * cellRate
          phase += f.asciiTimeAdd
        }
      }
      if (drive === "burst" && dr.hit > 0) {
        // The current JOLTS forward on each event — the skin is tugged.
        f.asciiTimeAdd += dr.hit * 6 * cellRate * k
        phase += f.asciiTimeAdd
      }
      // Driven: the shine band travels with the field. One band pass per 7
      // grid cells — at the default scroll speed the band crosses the stroke
      // every few seconds, clearly a moving light and clearly the same
      // current as the glyphs (judged live: at 14 cells a pass took ~10s and
      // the band read as a static bright patch).
      const cyc = phase / 7 - Math.floor(phase / 7)
      const dirX = state.asciiDirection === "vertical" ? 0 : 1
      const dirY = state.asciiDirection === "vertical" ? 1 : 0
      f.sweep = {
        pos: -1.15 + cyc * 2.3,
        // The band's brightness breathes with the shared oscillator, so SWING
        // has something to govern on this preset too — its POSITION is locked to
        // the glyph field by design and must not be scaled by a dial.
        amt: (0.7 + 0.25 * (dr.osc - 0.5) * 2 + 0.3 * pulse) * k,
        width: 0.42,
        dirX,
        dirY,
      }
      // Rubber warms faintly where the current runs (angle-independent read).
      f.sheenAdd = 0.4 * k
      f.emissiveAdd = (pulse * 0.6 + dr.hit * 0.5) * k
      f.emissiveColor = "#8f7d68"
      return f
    }

    /* ------------------------- Scanline Balloon ------------------------- */
    // CONCEPT: an inflated skin with scanlines printed on it — as the balloon
    // breathes, the lines RIDE the skin: they spread as it swells and pack
    // tight as it relaxes, while the stretched skin goes shinier.
    // RELATIONSHIP: one breath signal drives scanline spacing AND surface
    // tension (sheen/clearcoat/glow).
    case "scanlineBalloon": {
      const dr = driveOf({ ...shared, omega: 1.3, arcSecs: 3.0 })
      // Driver: the breath.
      //   Loop  — a steady in-out breath.
      //   Arc   — the skin INFLATES over the arrival (Soft Pulse) and then keeps
      //           breathing gently. The old version ran recurring swells under
      //           an exp(-s/14) envelope, i.e. it deflated to nothing after
      //           ~40 s, and its documented "breath follows the reveal" branch
      //           was dead code (the `Math.min` tautology `completionTrigger`
      //           exists to prevent).
      //   Burst — the balloon gets TAPPED: it rests taut and jumps per event.
      // Interpolated arrival: nearly slack at the start, inflating to the
      // ambient breath.
      let breath = 0.05 + (dr.osc - 0.05) * dr.build
      breath += dr.hit * 0.7
      breath = clamp01(breath + pulse * 0.5)
      // Driven 1: scanline spacing — the pattern's scale swells with the skin.
      f.textureScaleMul = 1 + (breath - 0.35) * 0.85 * k
      f.textureIntensityMul = 1 - breath * 0.25 * k // stretched print thins
      // Driven 2: surface tension from the SAME breath.
      f.sheenAdd = breath * 0.8 * k
      f.clearcoatAdd = breath * 0.5 * k
      f.envMapAdd = breath * 1.2 * k
      f.emissiveAdd = breath * 0.35 * k // inner glow = angle-independent half
      f.emissiveColor = "#a9c3e8"
      return f
    }

    /* ---------------------------- Pixel Clay ---------------------------- */
    // CONCEPT: clay mid-digitisation — the material keeps trying to resolve
    // into pixels and relaxing back. RELATIONSHIP: one digitise signal drives
    // dither pixel SIZE (chunky ↔ fine), the clay's grain (dissolves as the
    // pixels take over), and the surface (sinters wet-dark as it digitises).
    //
    // THIS PRESET HAD NO SECOND SHAPE AT ALL. Under the old taxonomy it was the
    // one fusion preset with no animated variant, so the rail was 8 × 2 with a
    // hole and nothing in the UI said which pill was missing its partner. Both
    // an Arc and a Burst read naturally out of the concept, which is a fair sign
    // the hole was an omission rather than a decision.
    case "pixelClay": {
      const dr = driveOf({ ...shared, omega: 0.9, arcSecs: 3.0 })
      // Driver: how digitised the clay is right now.
      //   Loop  — it keeps resolving and relaxing.
      //   Arc   — it arrives FULLY pixelated and relaxes back into clay, then
      //           keeps trying: the digitisation losing its grip.
      //   Burst — it stutters into pixels on each event and slumps back.
      // Interpolated arrival: fully pixelated at the start, easing back to the
      // ambient digitise/relax cycle. The additive form pinned this against the
      // clamp and measured path 0.00 for the arrival's whole first half.
      let dig = 1 + (dr.osc - 1) * dr.build
      dig += dr.hit * 0.9
      dig = clamp01(dig + pulse * 0.6)
      // Driven 1: threshold cells grow chunky with the signal.
      f.ditherScaleMul = 1 + dig * 1.1 * k
      // Driven 2: the organic grain dissolves as the digital pattern takes over.
      f.textureIntensityMul = 1 - dig * 0.7 * k
      // Driven 3: sintering — the clay glosses and darkens as it digitises.
      // 0.3 colour-scale was judged too faint next to the loud pixel chunking;
      // 0.45 matches Dither Bloom's proven wet-darkening depth.
      f.roughnessAdd = -dig * 0.6 * k
      f.clearcoatAdd = dig * 0.9 * k
      f.colorScale = 1 - dig * 0.45 * k // angle-independent read
      return f
    }

    /* ---------------------------- Code Bloom ----------------------------- */
    // CONCEPT: source code blooming on the surface — as the characters
    // thicken, the tone under them opens up. RELATIONSHIP: the PRD's first
    // fusion relationship, literally: ASCII glyph density DRIVES the dither
    // threshold. One density signal is written to the glyph ramp AND (negated)
    // to the threshold bias, so stipple densifies exactly as characters do.
    case "codeBloom": {
      const dr = driveOf({ ...shared, omega: 1.2, arcSecs: 3.0 })
      /* AMPLITUDE = THE LAYER'S OWN HEADROOM.
       *
       * ±0.25 was measured invisible live (the whole swing disappeared into the
       * ramp's top end). ±0.55 around the preset's 0.6 base fixed that but sent
       * the top of the swing to 1.15, and viewport-3d clamps uFsAscDensity to
       * 0..1 — so above LINK ≈ 0.73 the bloom clipped and the dial did LESS at
       * the top than in the middle. The intensity sweep caught it: Code Bloom
       * measured path 97.6 at 0.75 and 78.4 at 1.00, a dial that reverses.
       *
       * Swinging to `min(base, 1 - base)` is symmetric in the range that
       * actually renders, so the response is monotonic in LINK and the traverse
       * is WIDER than the old effective one (0.2..1.0 versus 0.05..1.0-clipped).
       */
      const head = Math.min(state.asciiDensity, 1 - state.asciiDensity)
      // Driver: glyph density.
      //   Loop  — an ambient bloom across the ramp's readable middle.
      //   Arc   — density strictly follows the draw-in (Character Reveal) and
      //           then keeps a quiet bloom. Its Arc used to decay to a constant:
      //           `dens = -0.6 * (1 - build)` is exactly 0 once built, with no
      //           residual term at all, which is why this was the one cell in
      //           the whole matrix that measured path 0.00 / tone 0.00.
      //   Burst — the code arrives in packets.
      let dens = (dr.osc - 0.5) * 2 * head
      // -0.52, not -0.6: against this preset's 0.6 density base, -0.6 is exactly
      // zero glyphs — the shader's `scale(0)`, an element arriving out of nothing,
      // which the rubric blocks and which reads as a blink rather than a build
      // when the Arc is armed on an already-finished stroke. 0.08 residual is the
      // `scale(0.95)` equivalent.
      dens += -0.52 * (1 - dr.build)
      dens += dr.hit * 0.5
      dens += pulse * 0.25
      // Driver value, written to the glyph layer…
      f.asciiDensityAdd = dens * k
      // …and the SAME value (negated: denser glyphs = lower threshold = more
      // ink) written to the dither layer. This line IS the fusion.
      f.ditherThresholdAdd = -dens * 0.9 * k
      // Phosphor warmth as the code blooms (angle-independent).
      f.emissiveAdd = clamp01(dens + 0.5) * 0.6 * k + pulse * 0.5 * k
      f.emissiveColor = "#7ec8a0"
      return f
    }

    /* --------------------------- Glitch Ribbon --------------------------- */
    // CONCEPT: a ribbon of signal that keeps BREAKING — and every system
    // breaks on the same event. RELATIONSHIP: one shared glitch impulse
    // simultaneously jolts the dither matrix, re-rolls the glyph field,
    // shears the texture phase and spikes the glow: proof of a single driver
    // is that the breaks are exactly simultaneous.
    //
    // THE ONE PRESET THAT IS EVENTS ALL THE WAY DOWN, so its three shapes are
    // three event regimes rather than a breath plus events:
    //   Loop  — an even cadence of breaks, the same uniform slot schedule this
    //           preset has always had, now armed on selection instead of riding
    //           a grid that started at page load.
    //   Arc   — ONE tear that arrives with the draw and resolves, leaving a
    //           residual stutter.
    //   Burst — the choreographed cycle: calm, escalating stutters, one big tear
    //           at the peak, recovery.
    case "glitchRibbon": {
      // Armed slot grid, shared by all three shapes. `sinceArmed` rather than
      // scene time: the schedule starts when the user selects the preset.
      const armedT = Math.max(0, sinceArmed) * spd
      const slot = Math.floor(armedT / SLOT_SECONDS)
      const inSlot = armedT - slot * SLOT_SECONDS
      let fires = hash01(slot) // 0..1 dice
      let strength = 0.55 + 0.45 * hash01(slot + 7)
      let threshold = SLOT_THRESHOLD // slots with dice above this fire
      let tearEnv = 0
      if (drive === "burst") {
        // Controlled Break: a ~7s cycle — calm, escalating stutters, one big
        // tear at the peak, recovery. Event rate and strength follow the
        // cycle position instead of being uniform.
        const cyc = (armedT / 7) % 1
        const escalation = cyc < 0.75 ? cyc / 0.75 : 1 - (cyc - 0.75) / 0.25
        threshold = 0.85 - escalation * 0.7 // calm: rare. peak: near-constant
        strength *= 0.4 + escalation * 0.9
        // The big tear: one long full-strength event at the cycle peak. Its
        // envelope is anchored to the WINDOW, not the slot — the slot-phase
        // envelope was usually already spent when the window arrived, so the
        // tear fired into a dead envelope and the peak read as calm
        // (measured: a 12s fast-cadence pass never caught it).
        if (cyc > 0.72 && cyc < 0.78) {
          fires = 1
          strength = 1.4
          tearEnv = Math.max(0, 1 - ((cyc - 0.72) * 7) / 0.45)
        }
      } else if (drive === "arc") {
        // ONE tear, arriving with the draw. `arcSecs` here is the run-up: the
        // ribbon holds nearly still, tears once as the arrival lands, then keeps
        // a residual stutter at ARC_SETTLE so it is a ribbon of signal rather
        // than a still frame.
        const build = clamp01(Math.min(rv, clamp01(sinceArmed / (3.0 / spd))))
        const tear =
          clamp01((build - 0.8) / 0.2) * Math.exp(-Math.max(0, armedT - 3.0) / 0.9)
        tearEnv = tear
        // Once the tear has passed, roughly one slot in five still fires — the
        // ARC_SETTLE residual, so the ribbon keeps reading as signal.
        threshold = 1 - ARC_SETTLE * (1 - SLOT_THRESHOLD) * build
        strength *= ARC_SETTLE + 0.6 * tear
        if (tear > 0.001) fires = 1
      }
      /* RESTING COUPLING.
       *
       * Every other preset couples at its driver's MIDPOINT, so at Swing 0 they
       * read as linked-and-still — a surface visibly wired to the pattern that
       * simply is not breathing. This preset's only output was the impulse, so
       * Swing 0 returned the identity frame and the panel's "0 holds it at rest,
       * fully linked" was false for exactly one pill: the ribbon was
       * indistinguishable from fusion being switched off. A small constant
       * tension — the signal is live and the matrix is held slightly coarse —
       * keeps the link visible with nothing firing, and the impulse below adds
       * on top of it rather than replacing it.
       */
      f.emissiveAdd = 0.3 * k
      f.emissiveColor = "#39c1e8"
      f.ditherScaleMul = 1 + 0.12 * k
      let env = slotEnvelope(inSlot, SLOT_ATTACK, SLOT_ENVELOPE)
      if (tearEnv > env) env = tearEnv
      // SWING scales the events, exactly as it scales every other drive: at 0
      // the ribbon is linked and still, and only the shared completion pulse
      // can break it.
      const g = frozen ? pulse * 0.8 : (fires > threshold ? env * strength : 0) * swing + pulse * 0.8
      if (g > 0.001) {
        const sign = hash01(slot + 13) > 0.5 ? 1 : -1
        // Everything breaks on the SAME impulse:
        f.ditherTimeAdd = g * 40 * sign // matrix jolts sideways
        f.asciiTimeAdd = g * 30 // glyph field re-rolls
        f.textureTimeAdd = g * 10 * sign // pattern shears
        f.ditherThresholdAdd = g * (hash01(slot + 29) - 0.5) * 0.5 * k // tone jumps
        f.ditherScaleMul += g * 0.9 * k // pixels chunk up while torn
        f.emissiveAdd += g * 2.0 * k // glow spikes
        f.metalnessAdd = g * 0.25 * k
        // Time jolts scale with depth too — at low LINK the breaks soften.
        f.ditherTimeAdd *= k
        f.asciiTimeAdd *= k
        f.textureTimeAdd *= k
      }
      return f
    }

    default:
      return f
  }
}

/* ==========================================================================
 * THE POWER SET — ONE FUSION FOR EVERY COMBINATION OF THE SEVEN SYSTEMS
 * ==========================================================================
 *
 * Sebs, 2026-08-04: *"there should be a fusion for every possible combo…
 * there's like 7 styles… combos of 2 3 4 5 6 7… so it would be like 2 to the
 * power of 7… for 2 there should be one fusion for every possible combo of two,
 * etc"*.
 *
 * THE SEVEN ARE THE PANEL'S OWN TABS — `material · animation · texture ·
 * dither · ascii · layers · fusion` (components/style-panel-scaffold.tsx,
 * `PANELS`). There are EIGHT ids in that array; the eighth is `presets`, which
 * is a picker for the other seven and not a style system of its own. Subsets of
 * size >= 2 is `2^7 - 1 - 7 = 120`.
 *
 * ── WHAT MAKES A SYSTEM A *MEMBER*, AND WHY IT IS MEASURED OFF THE LINKS ────
 *
 * Fusion is *systems influencing each other* (top of this file). So a system is
 * in a combination when it is AN END OF A RELATIONSHIP: it drives something, or
 * something drives it. That is a property of the link list, which means it can
 * be computed rather than declared — `systemsOfLinks` below is the one
 * definition, and `assert-fusion-combos.mjs` checks every cell against it. A
 * hand-written `systems: [...]` field that nothing recomputed would be the
 * hand-copied inventory this repo has been bitten by five times.
 *
 * Which system each end belongs to is read off the PANEL, not off intuition:
 *
 *   breath · drift · event      FUSION. These three are manufactured inside
 *                               this file by `driveOf`, and they are shaped by
 *                               the fusion panel's OWN dials (Drive, Swing,
 *                               Speed). Nothing else generates them.
 *   textureField/ditherField/   that LAYER, and ANIMATION. A phase source only
 *   asciiField                  advances while that layer is ANIMATING
 *                               (`needsAnim`), and a layer's own animation is
 *                               the Animation panel's subject —
 *                               `ANIMATION_CATEGORIES` lists texture, dither and
 *                               ascii by name.
 *   stackField                  LAYERS. Stack animation's controls live inside
 *                               `LayersControl` (style-panel-scaffold.tsx
 *                               :1449-1590), not in the Animation panel.
 *   reveal · completion         ANIMATION. `ANIMATION_CATEGORIES[0]` is
 *                               *"Geometry — the form draws itself in — play it
 *                               from the timeline under the 3D view"*, badged
 *                               `playback`. The draw-in is animation.
 *   orbit                       NOTHING — deliberately. The View is not one of
 *                               the seven panels (it is a preset FAMILY routed
 *                               through app/page.tsx). So a link driven by the
 *                               camera adds no member, which is what makes the
 *                               eleven "your hand on the object" cells possible
 *                               at all — see THE HAND FAMILY below.
 *   every target                its own layer, or MATERIAL for the eight
 *                               surface levers. `asciiFlow` additionally counts
 *                               as ANIMATION, because the shader only reads
 *                               `uFsAscTime` inside `if (uFsAscAnim > 0.5 …)`
 *                               (ascii-shader.ts:412) — the one target whose
 *                               effect requires its layer to be animating.
 *
 * ── SUBSTRATE IS NOT MEMBERSHIP, AND THE CODE ALREADY SAID SO ──────────────
 *
 * Two switches get turned on for reasons that have nothing to do with what the
 * relationship is ABOUT, and counting them as members would make almost every
 * cell claim systems it does not use:
 *
 *   `motionMode`      `evaluateFusion`'s own comment calls it *"the
 *                     substrate-level 'may style animate' switch"*. Every
 *                     shipped fusion preset sets it (`FUSION_BASE`), including
 *                     the ones that animate nothing. It is the clock, not a
 *                     relationship.
 *   `layerStackEnabled` `fusionWakePatch` switches it on for ANY composition
 *                     with two or more screen layers, on its own measurement:
 *                     87.0 % of the mark's inked area survives without a stack
 *                     against 96.6 % with one. That is legibility, not
 *                     authorship. `layers` is a member when the GROUP'S OWN
 *                     ANIMATION drives something — `stackField`.
 *
 * ── THE FOUR CELLS WITH NO PICTURE, AND THE PROOF ─────────────────────────
 *
 * `animation+layers`, `animation+fusion`, `layers+fusion` and
 * `animation+layers+fusion` are EMPTY, and this is arithmetic rather than an
 * opinion: every one of `FUSION_TARGETS`' 21 entries belongs to texture, dither,
 * ascii or material. Animation, layers and fusion are all SOURCES — clocks. A
 * combination made only of clocks has nothing to write to, so its FusionFrame is
 * the identity frame by construction and no authoring can change that. They ship
 * as named cells that say so, with the frame that proves it
 * (`assert-fusion-combos.mjs` §4 renders the identity claim as a row, and
 * `docs/verification/fusion-combos/` carries the render).
 *
 * The nearest coherent neighbour is one click away in the panel, because "add a
 * surface or a screen layer" is the actual answer and a dead pill is not.
 *
 * ── THE HAND FAMILY, AND WHY IT IS NOT A FALLBACK ─────────────────────────
 *
 * Eleven cells — every subset of {material, texture, dither, ascii} with no
 * animation, no layers and no fusion — have no CLOCK available at either end.
 * The only source left is `orbit`, and that is the product's own thesis rather
 * than a consolation: a drawing becomes an object you turn, and these are the
 * relationships that answer YOUR HAND instead of a timer. They keep working with
 * motion mode off, which nothing else on the rail does.
 *
 * They also inherit `viewTurn`'s defect and its fix. At the front-on camera the
 * azimuth is 0 and `phaseTriangle(0, 2*PI)` is EXACTLY 0 — so every orbit link
 * contributes exactly nothing until the mark moves. Selecting one therefore
 * turns the turntable on, for the same reason selecting any fusion switches on
 * the layers its links read: a fusion is a statement that these systems are
 * related, and a statement you cannot see is not one. See `FusionWake.spin`.
 *
 * ── WHY THE AMOUNTS FALL AS THE CELL GROWS ────────────────────────────────
 *
 * `fuseEverything`'s note: nine parameters on one breath is one throbbing
 * object, not nine systems fused. Two rules come out of it and both are enforced
 * by the gate rather than by memory: no two links in a cell share a source
 * unless the cell has only one source available, and the per-link amount falls
 * with the link count (`amountFor` below), so a seven-system cell is a chord
 * rather than seven clamps.
 */

/** One of the panel's seven style systems. */
export type FusionSystemId =
  | "material"
  | "animation"
  | "texture"
  | "dither"
  | "ascii"
  | "layers"
  | "fusion"

/** Canonical order — the order the tabs sit in, so a key reads like the panel. */
export const FUSION_SYSTEMS: { id: FusionSystemId; label: string; blurb: string }[] = [
  { id: "material", label: "Material", blurb: "The body the light answers: gloss, glow, wetness, weight." },
  { id: "animation", label: "Animation", blurb: "The clocks: the draw-in, and each layer's own motion." },
  { id: "texture", label: "Texture", blurb: "The pattern living on the surface." },
  { id: "dither", label: "Dither", blurb: "Shading broken into graphic marks, like print." },
  { id: "ascii", label: "ASCII", blurb: "The surface redrawn as a grid of characters." },
  { id: "layers", label: "Layers", blurb: "The stack: balance, blend, order, and the group's own rhythm." },
  { id: "fusion", label: "Fusion", blurb: "Fusion's own drive: the breath, the wander, the impulse." },
]

const SYSTEM_ORDER = FUSION_SYSTEMS.map((s) => s.id)

/** Which panel each SOURCE belongs to. `orbit` is the View, which is a preset
 *  family and not one of the seven — so it adds no member. */
export const SOURCE_SYSTEMS: Record<FusionSourceId, FusionSystemId[]> = {
  breath: ["fusion"],
  drift: ["fusion"],
  event: ["fusion"],
  asciiField: ["ascii", "animation"],
  ditherField: ["dither", "animation"],
  textureField: ["texture", "animation"],
  stackField: ["layers"],
  orbit: [],
  reveal: ["animation"],
  completion: ["animation"],
}

/** Which panel each TARGET belongs to. `asciiFlow` carries `animation` because
 *  its uniform is only read on the shader's animated branch. */
export const TARGET_SYSTEMS: Record<FusionTargetId, FusionSystemId[]> = {
  ditherThreshold: ["dither"],
  ditherCell: ["dither"],
  ditherAmount: ["dither"],
  ditherFlow: ["dither"],
  ditherBite: ["dither"],
  asciiDensity: ["ascii"],
  asciiFlow: ["ascii", "animation"],
  asciiCell: ["ascii"],
  asciiBite: ["ascii"],
  textureAmount: ["texture"],
  textureScale: ["texture"],
  textureFlow: ["texture"],
  textureBite: ["texture"],
  gloss: ["material"],
  glow: ["material"],
  wet: ["material"],
  sheen: ["material"],
  metal: ["material"],
  iridescence: ["material"],
  ink: ["material"],
  shineBand: ["material"],
}

/** The systems a link list actually touches, in panel order. THE definition of
 *  membership — everything else (the key, the picker, the gate) reads this. */
export function systemsOfLinks(links: FusionLink[]): FusionSystemId[] {
  const hit = new Set<FusionSystemId>()
  for (const l of links ?? []) {
    if (Math.abs(l?.amount ?? 0) < 0.005) continue
    for (const s of SOURCE_SYSTEMS[l.source] ?? []) hit.add(s)
    for (const s of TARGET_SYSTEMS[l.target] ?? []) hit.add(s)
  }
  return SYSTEM_ORDER.filter((s) => hit.has(s))
}

/** `material+texture` — canonical, panel-ordered, and the cell's identity. */
export const comboKeyOf = (systems: FusionSystemId[]): string =>
  SYSTEM_ORDER.filter((s) => systems.includes(s)).join("+")

/**
 * `combo:<key>` is the `fusionPreset` value for a combination cell.
 *
 * ✅ THE CAST IS GONE (2026-08-07). This used to read `as
 * StyleState["fusionPreset"]`, with a note that `FusionPreset` was a closed
 * union in lib/style-system.ts belonging to a different lane, and that adding
 * `| \`combo:${string}\`` beside the existing `| \`custom:${string}\`` arm was
 * the whole patch. One lane now owns both files, so the arm is declared and the
 * assertion is deleted rather than documented — **a cast with a note explaining
 * why it is safe is still a place the compiler has stopped checking.**
 *
 * `assert-fusion-combos.mjs` §1 still asserts every id this produces resolves
 * in `FUSION_COMBOS_BY_ID` and in NEITHER the `custom:` arm nor the built-in
 * rail: the type now says the shape is a `combo:` string, and it has never been
 * able to say the namespace does not collide.
 */
export const COMBO_PREFIX = "combo:"
export const comboFusionKey = (key: string): StyleState["fusionPreset"] =>
  `${COMBO_PREFIX}${key}`
export const isComboFusionId = (p: string): boolean => p.startsWith(COMBO_PREFIX)
export const comboKeyOfId = (p: string): string | null =>
  isComboFusionId(p) ? p.slice(COMBO_PREFIX.length) : null

/** A combination cell: a fusion, plus what it is a combination OF. */
export interface FusionCombo extends CustomFusion {
  /** Canonical `material+texture` key. Equals `comboKeyOf(systemsOfLinks(links))`
   *  for every cell that has links — asserted, not assumed. */
  key: string
  /** The systems this cell is the answer for. */
  systems: FusionSystemId[]
  /** One sentence: what the relationship IS, physically. */
  concept: string
  /** The shape this cell was authored on. */
  drive: FusionDrive
  /** Composition this cell authors beyond the derived layer wakes — the body,
   *  the pattern, the screen, the charset. This is where cells stop looking
   *  like one another. */
  compose?: Partial<StyleState>
  /** Set ONLY on the four cells that have no target-carrying member. The string
   *  is the reason, shown in the panel instead of a dead pill. */
  empty?: string
}

/* --------------------------------------------------------------------------
 * The table. One entry per cell, authored — name, concept, links, drive, and
 * the composition that stops the set looking like one idea 116 times.
 *
 * `L(source, target, amount)` gives the link a DERIVED id (`source>target`),
 * which is unique inside a cell by construction and means a link cannot be
 * mislabelled the way a hand-written id can.
 * ------------------------------------------------------------------------ */

const L = (source: FusionSourceId, target: FusionTargetId, amount: number): FusionLink => ({
  id: `${source}>${target}`,
  source,
  target,
  amount,
})

function combo(
  key: string,
  name: string,
  drive: FusionDrive,
  glowColor: string,
  concept: string,
  links: FusionLink[],
  compose?: Partial<StyleState>,
): FusionCombo {
  return {
    id: `combo-${key}`,
    key,
    name,
    drive,
    glowColor,
    concept,
    links,
    compose,
    systems: key.split("+") as FusionSystemId[],
  }
}

/** The four cells whose members are all clocks. See the header block. */
function emptyCombo(key: string, name: string, why: string): FusionCombo {
  return {
    id: `combo-${key}`,
    key,
    name,
    drive: "loop",
    glowColor: DEFAULT_GLOW_COLOR,
    concept: why,
    links: [],
    empty: why,
    systems: key.split("+") as FusionSystemId[],
  }
}

/* Palette used for `glow`/`gloss` links, per concept rather than per cell index:
 * ink-blue #a9c3e8 · signal-cyan #39c1e8 · phosphor #7ec8a0 · rubber-brown
 * #8f7d68 · wax #e8c98f · paper #bfd4e8 · type-warm #c9b79a. Every one is
 * already in this file on a shipped relationship. */

const COMBOS_2_TO_3: FusionCombo[] = [
  /* ================= TWO SYSTEMS (21) ================= */

  combo("material+animation", "Last Stroke", "loop", "#bfd4e8",
    "The body has no finish until the mark does: gloss climbs with the draw, and one highlight sweeps the whole stroke at the instant the last of it lands.",
    [L("reveal", "gloss", 0.75), L("completion", "shineBand", 0.9)],
    { materialPreset: "glossyPlastic", materialUserOverride: true }),

  combo("material+texture", "Brushed Round", "loop", "#8f7d68",
    "Turn the mark and the brushed grain tightens while the fabric light comes round it, pattern and body answering your hand instead of a clock.",
    [L("orbit", "textureScale", -0.6), L("orbit", "sheen", 0.75)],
    { textureMode: "brushed", textureScale: 1.4, materialPreset: "rubber", materialUserOverride: true }),

  combo("material+dither", "Oil On Newsprint", "loop", "#39c1e8",
    "The screen floods with ink down one side of the turn and opens up the other, while a thin-film shift slides across the body, a cheap print with oil on it.",
    [L("orbit", "ditherThreshold", 0.7), L("orbit", "iridescence", 0.85)],
    { ditherType: "newsprint", ditherAngle: 45, materialPreset: "iridescent", materialUserOverride: true }),

  combo("material+ascii", "Angle Of Read", "loop", "#39c1e8",
    "The characters thicken and the body lights where you are reading from, and thin out again as you turn away from them.",
    [L("orbit", "asciiDensity", 0.65), L("orbit", "glow", 0.6)],
    { asciiCharset: "boxes", materialPreset: "signal", materialUserOverride: true }),

  combo("material+layers", "Group Tension", "loop", "#a9c3e8",
    "The layer group is empty and still keeps a rhythm. This wires that rhythm straight into the body, so the gel tightens and the ink gains weight on the STACK's clock rather than fusion's.",
    [L("stackField", "sheen", 0.75), L("stackField", "ink", 0.5)],
    { materialPreset: "softGel", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+fusion", "Candle Wax", "loop", "#e8c98f",
    "Wax that has not set: the breath wets and darkens it while a slower wander moves the soft rim light, so the two halves of the surface are never quite in agreement.",
    [L("breath", "wet", 0.7), L("drift", "sheen", 0.55)],
    { materialPreset: "wax", materialUserOverride: true }),

  combo("animation+texture", "Grain Comes Up", "arc", "#c9b79a",
    "The woodgrain crawls, and the very phase it crawls with decides how hard it prints, so some passes bite and some wash. The draw brings it up from nothing behind the pen.",
    [L("textureField", "textureBite", 0.7), L("reveal", "textureAmount", 0.5)],
    { textureMode: "woodgrain", textureScale: 2.2, textureSpeed: 0.8 }),

  combo("animation+dither", "Hatching Up", "loop", "#c9b79a",
    "The hatch crawls sideways and its own phase decides how hard it cuts between ink and paper; the draw opens the screen behind the pen, so a finished mark sits lighter than one being made.",
    [L("ditherField", "ditherBite", 0.7), L("reveal", "ditherThreshold", -0.55)],
    { ditherType: "hatch", ditherAngle: 30 }),

  combo("animation+ascii", "Type Comes In", "arc", "#7ec8a0",
    "The glyph grid scrolls, and the phase it scrolls with decides how sharply the characters cut away from the surface under them; the draw thickens them from sparse to full.",
    [L("asciiField", "asciiBite", 0.65), L("reveal", "asciiDensity", 0.5)],
    { asciiCharset: "dots", asciiCellSize: 14 }),

  emptyCombo("animation+layers", "Clocks Only · Draw + Group",
    "Animation and Layers are both CLOCKS. Every one of fusion's 21 targets is a texture, dither, ASCII or material parameter, so a combination made only of clocks has nothing to write to. Its frame is the identity frame by construction. Add a surface or a screen layer and it becomes a relationship."),

  emptyCombo("animation+fusion", "Clocks Only · Draw + Breath",
    "Animation and Fusion are both CLOCKS, the draw-in and fusion's own breath. Neither owns a parameter: all 21 targets belong to texture, dither, ASCII or material. Nothing here can move a pixel until one of those joins."),

  combo("texture+dither", "Contour And Dot", "loop", "#a9c3e8",
    "Turning the mark shears the contour lines one way and grows the halftone dots the other, so the two prints slide against each other as you come round.",
    [L("orbit", "textureFlow", 0.7), L("orbit", "ditherCell", -0.6)],
    { textureMode: "contour", ditherType: "dotScreen" }),

  combo("texture+ascii", "Crackle And Type", "loop", "#c9b79a",
    "The crackle prints harder as you turn into it while the characters get finer, so the two layers trade places across a half turn.",
    [L("orbit", "textureBite", 0.65), L("orbit", "asciiCell", -0.55)],
    { textureMode: "craquelure", asciiCharset: "punct" }),

  combo("texture+layers", "Band Formation", "loop", "#a9c3e8",
    "The group's own loop shears the bands along their axis and thins them as it swells. The pattern moves on the STACK's clock, so changing the stack's speed changes the pattern.",
    [L("stackField", "textureFlow", 0.75), L("stackField", "textureAmount", -0.4)],
    { textureMode: "bands", stackAnimationType: "loop" }),

  combo("texture+fusion", "Cell Weather", "loop", "#7ec8a0",
    "Two clocks that never agree: the breath decides how hard the cell walls print while a slower wander spreads them out and packs them back in.",
    [L("breath", "textureBite", 0.7), L("drift", "textureScale", 0.5)],
    { textureMode: "cellular", textureScale: 1.9 }),

  combo("dither+ascii", "Trade Places", "loop", "#a9c3e8",
    "Come round one way and the diamond screen floods while the characters thin; come round the other and they swap, two screens sharing one turn.",
    [L("orbit", "ditherThreshold", 0.65), L("orbit", "asciiDensity", -0.55)],
    { ditherType: "diamond", asciiCharset: "blocks" }),

  combo("dither+layers", "Line Drift", "loop", "#a9c3e8",
    "The group's drift pushes the line screen sideways and chunks its cells up as the group swells. The screen belongs to the stack, not to fusion.",
    [L("stackField", "ditherFlow", 0.8), L("stackField", "ditherCell", 0.45)],
    { ditherType: "lines", stackAnimationType: "drift" }),

  combo("dither+fusion", "Struck Screen", "burst", "#39c1e8",
    "A print being struck rather than a print breathing: the breath holds the tone just off centre and every impulse kicks the whole matrix sideways.",
    [L("breath", "ditherThreshold", -0.7), L("event", "ditherFlow", 0.65)],
    { ditherType: "bayer8", ditherScale: 3 }),

  combo("ascii+layers", "Counter Roll", "loop", "#7ec8a0",
    "The group's loop thickens the digits and shrinks their cells at the same time, so the readout gets denser and finer together on the stack's own beat.",
    [L("stackField", "asciiDensity", 0.7), L("stackField", "asciiCell", -0.45)],
    { asciiCharset: "numeric", stackAnimationType: "loop" }),

  combo("ascii+fusion", "Arrow Weather", "loop", "#7ec8a0",
    "The arrows sharpen and blur on the breath while a slower wander thickens and thins them, one grid read twice, by two clocks that never line up.",
    [L("breath", "asciiBite", 0.7), L("drift", "asciiDensity", 0.5)],
    { asciiCharset: "arrows", asciiCellSize: 15 }),

  emptyCombo("layers+fusion", "Clocks Only · Group + Breath",
    "The layer group's rhythm and fusion's breath are both DRIVERS. Neither is a parameter. All 21 fusion targets belong to texture, dither, ASCII or material, and the group has nothing in it to compose. Two signals and nothing to write them to."),

  /* ================= THREE SYSTEMS (35) ================= */

  combo("material+animation+texture", "Glaze Ripple", "loop", "#bfd4e8",
    "A glaze still moving: the ripple comes up with the draw, its own phase decides how the ceramic catches the light, and the ink gains weight the moment the mark finishes.",
    [L("reveal", "textureAmount", 0.55), L("textureField", "gloss", 0.6), L("completion", "ink", 0.45)],
    { textureMode: "ripple", materialPreset: "ceramic", materialUserOverride: true }),

  combo("material+animation+dither", "Press Sheet", "loop", "#bfd4e8",
    "A sheet coming off the press: the halftone crawls and its phase wets the body, the draw opens the screen behind the pen, and the finish catches light once.",
    [L("ditherField", "wet", 0.6), L("reveal", "ditherThreshold", -0.55), L("completion", "glow", 0.5)],
    { ditherType: "halftone", materialPreset: "glossyPlastic", materialUserOverride: true }),

  /* `wet` and not `sheen`: matte clay's sheen colour is #000000 (see
   * SHEEN_CAPABLE_MATERIALS — eleven of the fifteen bodies carry black sheen),
   * so a sheen link here would be black light on a body the cell has already
   * chosen for its dryness. Wetting the clay is the read the concept wanted. */
  combo("material+texture+dither", "Clay Print", "loop", "#8f7d68",
    "Everything answers the turn: the dots pack tighter, the crosshatch cuts harder, and the clay darkens as though it had just been damped, one gesture running three systems.",
    [L("orbit", "textureScale", -0.5), L("orbit", "ditherBite", 0.55), L("orbit", "wet", 0.5)],
    { textureMode: "dots", ditherType: "crosshatch", materialPreset: "matteClay", materialUserOverride: true }),

  combo("material+animation+ascii", "Ticker", "loop", "#a9c3e8",
    "The characters scroll and a highlight rides the very phase they scroll with, so the shine and the type are one current; the chrome hardens at the finish.",
    [L("asciiField", "shineBand", 0.8), L("reveal", "asciiDensity", 0.5), L("completion", "metal", 0.45)],
    { asciiCharset: "classic", materialPreset: "chrome", materialUserOverride: true }),

  combo("material+texture+ascii", "Sign At Night", "loop", "#39c1e8",
    "Turn it and the scanlines shear, the characters sharpen, and the tube lights, a sign read from a moving car.",
    [L("orbit", "textureFlow", 0.6), L("orbit", "asciiBite", 0.55), L("orbit", "glow", 0.5)],
    { textureMode: "scanlines", asciiCharset: "minimal", materialPreset: "neon", materialUserOverride: true }),

  combo("material+dither+ascii", "Two Screens Wet", "loop", "#bfd4e8",
    "One turn, and the ordered screen chunks up while the dot characters thin and the ink darkens as though it were still wet.",
    [L("orbit", "ditherCell", 0.6), L("orbit", "asciiDensity", -0.5), L("orbit", "wet", 0.5)],
    { ditherType: "bayer4", asciiCharset: "dots" }),

  combo("material+animation+layers", "Sealed", "loop", "#e8c98f",
    "The group's envelope is keyed to the draw, so as the mark builds the wax wets, the gloss climbs, and the seal catches light once at the end.",
    [L("stackField", "wet", 0.6), L("reveal", "gloss", 0.5), L("completion", "glow", 0.45)],
    { materialPreset: "wax", materialUserOverride: true, stackAnimationType: "revealSynced" }),

  combo("material+texture+layers", "Loom", "loop", "#8f7d68",
    "The crosshatch runs on the group's clock while the rim light answers your hand, cloth being woven and looked at at the same time.",
    [L("stackField", "textureFlow", 0.7), L("orbit", "sheen", 0.6), L("stackField", "textureBite", 0.45)],
    { textureMode: "crosshatch", materialPreset: "rubber", materialUserOverride: true, stackAnimationType: "loop" }),

  combo("material+dither+layers", "Newsprint Drift", "loop", "#c9b79a",
    "The newsprint screen slides on the group's rhythm and the chalk gains weight with it, while turning the mark decides how hard the screen cuts.",
    [L("stackField", "ditherFlow", 0.75), L("stackField", "ink", 0.45), L("orbit", "ditherBite", 0.5)],
    { ditherType: "newsprint", materialPreset: "chalk", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+ascii+layers", "Board", "loop", "#39c1e8",
    "A departures board: the group's beat thickens the boxes and lifts the light, and the cells get finer as you come round to read them.",
    [L("stackField", "asciiDensity", 0.7), L("stackField", "glow", 0.45), L("orbit", "asciiCell", -0.5)],
    { asciiCharset: "boxes", materialPreset: "signal", materialUserOverride: true, stackAnimationType: "loop" }),

  combo("material+animation+fusion", "Leaf", "arc", "#e8c98f",
    "Gold leaf being laid: the breath moves the shine, the draw adds weight behind the pen, and the finish flares once and settles.",
    [L("breath", "gloss", 0.6), L("reveal", "ink", 0.5), L("completion", "glow", 0.55)],
    { materialPreset: "gold", materialUserOverride: true }),

  combo("material+texture+fusion", "Static Chrome", "burst", "#39c1e8",
    "Chrome with interference on it: each impulse shears the noise sideways, the breath swings the ink's weight, and a slow wander pushes the body toward a conductor.",
    [L("event", "textureFlow", 0.7), L("breath", "ink", 0.5), L("drift", "metal", 0.45)],
    { textureMode: "noise", materialPreset: "chrome", materialUserOverride: true }),

  combo("material+dither+fusion", "Slip Glaze", "loop", "#bfd4e8",
    "The breath floods and opens the dot screen while a slow wander wets the glaze; turning the mark grows the dots.",
    [L("breath", "ditherThreshold", -0.65), L("drift", "wet", 0.5), L("orbit", "ditherCell", 0.45)],
    { ditherType: "dotScreen", materialPreset: "ceramic", materialUserOverride: true }),

  combo("material+ascii+fusion", "Marquee", "loop", "#39c1e8",
    "The characters thicken on the breath, the tube's light wanders on a different clock, and the type sharpens as you turn to read it.",
    [L("breath", "asciiDensity", 0.6), L("drift", "glow", 0.5), L("orbit", "asciiBite", 0.45)],
    { asciiCharset: "custom", materialPreset: "neon", materialUserOverride: true }),

  combo("material+layers+fusion", "Three Clocks", "loop", "#a9c3e8",
    "Three clocks on one body and no two in step: the group's loop moves the ink's weight, the breath moves the shine, the wander moves the rim.",
    [L("stackField", "ink", 0.6), L("breath", "gloss", 0.5), L("drift", "sheen", 0.45)],
    { materialPreset: "softGel", materialUserOverride: true, stackAnimationType: "loop" }),

  combo("animation+texture+dither", "Cross Print", "loop", "#c9b79a",
    "Each layer reads the other: the grain's phase floods the line screen with ink and the screen's phase spreads the grain, two prints running each other.",
    [L("textureField", "ditherThreshold", 0.6), L("ditherField", "textureScale", 0.5), L("reveal", "ditherBite", 0.45)],
    { textureMode: "woodgrain", ditherType: "lines" }),

  combo("animation+texture+ascii", "Mesh And Type", "loop", "#7ec8a0",
    "The mesh decides how big the characters are; the characters shear the mesh. Neither is in charge, and the draw sharpens them both.",
    [L("textureField", "asciiCell", 0.6), L("asciiField", "textureFlow", 0.55), L("reveal", "asciiBite", 0.45)],
    { textureMode: "cellular", asciiCharset: "minimal" }),

  combo("animation+dither+ascii", "Two Way Print", "loop", "#7ec8a0",
    "Not one signal written to two layers, but two layers reading each other: the glyph field floods the screen, and the screen's own crawl decides how big the characters are.",
    [L("asciiField", "ditherThreshold", 0.6), L("ditherField", "asciiCell", 0.5), L("reveal", "asciiDensity", 0.45)],
    { ditherType: "bayer8", asciiCharset: "blocks" }),

  combo("animation+texture+layers", "Band Group", "loop", "#a9c3e8",
    "The group spreads the bands, the bands' own crawl thins them, and the draw decides how hard they print, one pattern with three owners.",
    [L("stackField", "textureScale", 0.6), L("textureField", "textureAmount", 0.5), L("reveal", "textureBite", 0.45)],
    { textureMode: "bands", stackAnimationType: "drift" }),

  /* ⚠ THE THIRD TIME ONE MECHANISM HAS KILLED A CELL IN THIS FILE, AND THE
   * FIRST TIME IT WAS CAUGHT BY THE FLOOR RATHER THAN BY AN EYE.
   *
   * Lockstep shipped on `diamond` and read **net 0.92** against a floor of 1.0
   * — L1 signal 11.74 against a control of 10.82, tone 0.116 against 0.050. It
   * is quiet on BOTH channels, which is the shape of a link writing into a
   * field that cannot show it.
   *
   * The comparison is the diagnosis, and it needs no new theory — every other
   * cell carrying this same link clears comfortably, and the only thing that
   * separates them is the screen family:
   *
   *     Line Drift      lines    stackField>ditherFlow 0.80    net 14.84
   *     Terminal Roll   lines    stackField>ditherFlow 0.60    net 41.43
   *     Press Run       lines    stackField>ditherFlow 0.55    net 17.60
   *     Lockstep        diamond  stackField>ditherFlow 0.70    net  0.92
   *
   * Press Run's own note already states the law: *sliding an isotropic dot
   * field only makes it shimmer, because a grid of dots looks the same one dot
   * along — travel reads on a DIRECTIONAL screen.* A diamond screen is a
   * rotated square lattice; translate it by a cell and it is the same picture.
   * And this cell has the fault twice over, because `animation` is a member, so
   * the screen is ALREADY crawling under its own animation — a second travel
   * source on a field that cannot show travel is invisible on top of invisible.
   * That is the control reading 10.82 against a signal of 11.74.
   *
   * ⚠ AND THE OTHER HALF, WHICH MATTERS MORE THAN THE FIX: **it measured 1.07
   * in the previous run and 0.92 in this one, against a floor of exactly 1.0.**
   * It was never clear of the bar — it was inside the instrument's own
   * run-to-run variation, and it passed by luck. A margin of 7 % on a
   * measurement that moves 14 % between runs is not a pass, and the honest read
   * of the earlier green row is that nobody had looked at the margin.
   *
   * ⚠ AND THE SCREEN FAMILY WAS NOT THE FIX. Moving `diamond` -> `hatch` and
   * rebalancing the amplitudes was tried, measured, and **did not work**: the
   * cell came back at **0.775**, and its L1 net was now EXACTLY 0.00 — signal
   * 15.779 against a control of 15.817. That zero is the useful number. It says
   * `stackField>ditherFlow` contributes *nothing at all* to where the ink is,
   * on any screen, because `animation` is a member: the screen is already
   * translating under its own crawl, and a second translation of a periodic
   * field is the same field at another phase. **A link measured at exactly zero
   * should be removed, not re-tuned**, so it is gone.
   *
   * The real diagnosis came from the cell one member down, which reads 174x
   * louder on tone with the SAME `ditherField>ditherBite` link on the SAME
   * screen:
   *
   *     Hatching Up  animation+dither         toneSignal 16.977   net 135.24
   *     Lockstep     animation+dither+layers  toneSignal  0.163   net   0.78
   *
   * Hatching Up's loud channel is not its oscillator, it is
   * `reveal>ditherThreshold` at -0.55 — and on a FINISHED mark `reveal` rests
   * at 1, so that is a large CONSTANT offset to the threshold. Its per-moment
   * nets are 131.7 / 139.7 / 133.4 / 136.2: flat, not swinging. Lockstep had no
   * constant lever at all — three links that were travel (invisible here), a
   * small oscillator, and a cell-size change that only moves ink sideways.
   *
   * So the group gets the threshold. `stackField>ditherThreshold` is *the group
   * opens and closes the screen*, which is both the loudest available lever and
   * the idea the `layers` member is actually for — and it is a different
   * sentence from Hatching Up's *the draw raises the bar*. `stackDitherOpacity`
   * goes to 1 for the reason Press Run's note already gives: `fusionWakePatch`
   * lands the stack at 0.55, so every one of this cell's links was being
   * attenuated by the stack that its own membership switched on. The angle
   * moves off Hatching Up's 30 so the two do not wear one picture. */
  combo("animation+dither+layers", "Lockstep", "loop", "#a9c3e8",
    "The group opens and closes the hatch while the screen's own crawl decides how hard it cuts, and the draw chunks the cells up as the mark builds.",
    [L("stackField", "ditherThreshold", 0.65), L("ditherField", "ditherBite", 0.55), L("reveal", "ditherCell", 0.45)],
    { ditherType: "hatch", ditherAngle: 75, stackAnimationType: "loop", stackDitherOpacity: 1 }),

  combo("animation+ascii+layers", "Flight Board", "loop", "#7ec8a0",
    "The group's drift thickens the arrows, their own scroll changes their size, and they snap sharp the moment the mark is finished.",
    [L("stackField", "asciiDensity", 0.6), L("asciiField", "asciiCell", 0.5), L("completion", "asciiBite", 0.55)],
    { asciiCharset: "arrows", stackAnimationType: "drift" }),

  /* THIS CELL WAS RE-AUTHORED OFF FINE GRAIN, and the reason is measured rather
   * than felt. It shipped as "Grain Breath" — three links on `textureMode:
   * "grain"` — and read DEAD on the liveness gate: net 0.00 over 5 moments, then
   * net 0.072 over 16 (`docs/verification/fusion-combos/diag-grain/`), against
   * its own sibling `animation+texture` at 8.526 in the SAME run. Two causes,
   * both stated in `lib/texture-shader.ts`'s own grain-lattice note:
   *
   *   1. `reveal -> textureScale` was DEAD BY CONSTRUCTION. *"grain is the one
   *      pattern whose period is NOT the authored constant — the LOD picks it
   *      from the footprint"* (`fsGrainCell` reads the pixel footprint, never
   *      `uFsTexScale`). A third of the cell's authorship wrote to a dial the
   *      mode ignores.
   *   2. Grain is INCOHERENT, so it cannot hold still enough to be modulated.
   *      A stochastic field translating under its own animation decorrelates
   *      every pixel, and the mark's sampled mean wanders with it: measured
   *      with the relationship SWITCHED OFF, this composition's own drift was
   *      L1 14.5 and tone 0.85 across a 90 ms gap. Anything the link contributes
   *      arrives underneath the pattern's own noise floor — which is why the
   *      same note grades it *"the weakest pattern on the board"*, one that
   *      *"does not reach the 5.0 'reads' line the other eleven presets now
   *      clear"*. Not measurable and not visible are the same sentence here.
   *
   * Crosshatch is the answer to both: a woven field KEEPS ITS MEAN under
   * translation, so its travel is a legible slide instead of a re-roll, and
   * every one of the three targets lands on something it can actually move —
   * intensity is how much of the weave survives, contrast is how hard it prints,
   * and a phase push slides it. It is also the least-carried pattern in the set
   * (2 cells of 120), so this spreads the palette rather than crowding it.
   * Grain keeps eight cells and is not removed from the rail. */
  combo("animation+texture+fusion", "Cross Weave", "loop", "#c9b79a",
    "The breath decides how much of the weave survives and its own phase how hard it prints, while the draw slides the whole hatch along behind the pen.",
    [L("breath", "textureAmount", 0.6), L("textureField", "textureBite", 0.5), L("reveal", "textureFlow", 0.45)],
    { textureMode: "crosshatch", textureScale: 0.7, textureSpeed: 0.6 }),

  combo("animation+dither+fusion", "Kicked Crosshatch", "burst", "#39c1e8",
    "The crosshatch crawls and its phase floods the tone; each impulse kicks the whole matrix sideways, and the draw thins the screen as the mark arrives.",
    [L("event", "ditherFlow", 0.7), L("ditherField", "ditherThreshold", 0.5), L("reveal", "ditherAmount", -0.4)],
    { ditherType: "crosshatch" }),

  combo("animation+ascii+fusion", "Counting Down", "loop", "#7ec8a0",
    "The breath pushes the digits along their scroll axis, their own phase sharpens them, and the finish thickens the whole readout once.",
    [L("breath", "asciiFlow", 0.6), L("asciiField", "asciiBite", 0.5), L("completion", "asciiDensity", 0.5)],
    { asciiCharset: "numeric" }),

  emptyCombo("animation+layers+fusion", "Clocks Only · All Three",
    "The draw, the layer group and fusion's breath: three drivers and not one parameter between them. Every fusion target belongs to texture, dither, ASCII or material, so this frame cannot leave the identity by construction. No authoring changes that."),

  combo("texture+dither+ascii", "Three Screens", "loop", "#a9c3e8",
    "Three screens on one mark and one gesture running all of them: turn it and the contour spreads, the hatch floods, and the characters thin.",
    [L("orbit", "textureScale", 0.55), L("orbit", "ditherThreshold", 0.5), L("orbit", "asciiDensity", -0.5)],
    { textureMode: "contour", ditherType: "hatch", asciiCharset: "punct" }),

  combo("texture+dither+layers", "Registration", "loop", "#a9c3e8",
    "Two screens sliding on the group's clock while your hand decides how coarse the halftone is, two plates trying to register and never quite doing it.",
    [L("stackField", "textureFlow", 0.6), L("orbit", "ditherCell", 0.55), L("stackField", "ditherBite", 0.45)],
    { textureMode: "dots", ditherType: "halftone", stackAnimationType: "drift" }),

  combo("texture+ascii+layers", "Tiles", "loop", "#c9b79a",
    "The group's beat thickens the boxes and spreads the crackle under them; turning the mark decides how hard the crackle prints.",
    [L("stackField", "asciiDensity", 0.6), L("orbit", "textureBite", 0.55), L("stackField", "textureScale", 0.45)],
    { textureMode: "craquelure", asciiCharset: "boxes", stackAnimationType: "loop" }),

  combo("texture+dither+fusion", "Two Weathers", "loop", "#7ec8a0",
    "The noise prints hard and soft on the breath while the screen opens and closes on a wander that never lines up with it.",
    [L("breath", "textureBite", 0.6), L("drift", "ditherThreshold", -0.55), L("orbit", "ditherCell", 0.45)],
    { textureMode: "noise", ditherType: "bayer4" }),

  combo("texture+ascii+fusion", "Rain On Glass", "loop", "#bfd4e8",
    "The ripple spreads on a slow wander while the dot characters thicken on the breath, two rhythms on one pane.",
    [L("drift", "textureScale", 0.6), L("breath", "asciiDensity", 0.55), L("orbit", "asciiCell", -0.45)],
    { textureMode: "ripple", asciiCharset: "dots" }),

  combo("texture+layers+fusion", "Roll Bar", "loop", "#39c1e8",
    "The group rolls the scanlines along, the breath decides how hard they print, and a slow wander thins them out. One pattern, three unrelated clocks.",
    [L("stackField", "textureFlow", 0.6), L("breath", "textureBite", 0.5), L("drift", "textureAmount", -0.45)],
    { textureMode: "scanlines", stackAnimationType: "loop" }),

  combo("dither+ascii+layers", "Terminal Roll", "loop", "#7ec8a0",
    "The group slides the line screen while the characters sharpen on its beat, and your hand decides how thick they read.",
    [L("stackField", "ditherFlow", 0.6), L("orbit", "asciiDensity", 0.5), L("stackField", "asciiBite", 0.45)],
    { ditherType: "lines", asciiCharset: "classic", stackAnimationType: "drift" }),

  combo("dither+ascii+fusion", "Two Screens Breathing", "loop", "#a9c3e8",
    "The screen opens on the breath and the characters thicken on a slower wander, so the two layers never bloom together.",
    [L("breath", "ditherThreshold", -0.6), L("drift", "asciiDensity", 0.55), L("orbit", "ditherCell", 0.45)],
    { ditherType: "diamond", asciiCharset: "custom" }),

  combo("dither+layers+fusion", "Press Room", "loop", "#c9b79a",
    "One screen and three clocks: the group pushes it sideways, the breath decides how hard it cuts, and a slow wander changes the size of the dots.",
    [L("stackField", "ditherFlow", 0.6), L("breath", "ditherBite", 0.5), L("drift", "ditherCell", 0.45)],
    { ditherType: "newsprint", stackAnimationType: "loop" }),

  combo("ascii+layers+fusion", "Shift Change", "loop", "#7ec8a0",
    "Three clocks on one grid: the group thickens the characters, the breath sharpens them, and a slow wander changes their size.",
    [L("stackField", "asciiDensity", 0.6), L("breath", "asciiBite", 0.5), L("drift", "asciiCell", 0.45)],
    { asciiCharset: "blocks", stackAnimationType: "drift" }),
]

const COMBOS_4_TO_7: FusionCombo[] = [
  /* ================= FOUR SYSTEMS (35) ================= */

  combo("material+animation+texture+dither", "Proof Sheet", "loop", "#bfd4e8",
    "The grain's phase floods the halftone, the halftone's phase glosses the body, the draw brings the grain up behind the pen, and the sheet wets once at the finish.",
    [L("textureField", "ditherThreshold", 0.55), L("ditherField", "gloss", 0.5), L("reveal", "textureAmount", 0.45), L("completion", "wet", 0.4)],
    { textureMode: "woodgrain", ditherType: "halftone", materialPreset: "glossyPlastic", materialUserOverride: true }),

  combo("material+animation+texture+ascii", "Live Wire", "loop", "#39c1e8",
    "The glyph field shears the mesh, the mesh's own phase lights the body, the draw thickens the type, and the ink gains weight when the mark lands.",
    [L("asciiField", "textureFlow", 0.55), L("textureField", "glow", 0.5), L("reveal", "asciiDensity", 0.45), L("completion", "ink", 0.4)],
    { textureMode: "cellular", asciiCharset: "minimal", materialPreset: "signal", materialUserOverride: true }),

  combo("material+animation+dither+ascii", "Read Out", "loop", "#a9c3e8",
    "The characters flood the screen, and a highlight rides the screen's own phase across the chrome; the draw sharpens the type and the finish hardens the body.",
    [L("asciiField", "ditherThreshold", 0.55), L("ditherField", "shineBand", 0.8), L("reveal", "asciiBite", 0.45), L("completion", "metal", 0.4)],
    { ditherType: "bayer8", asciiCharset: "classic", materialPreset: "chrome", materialUserOverride: true }),

  combo("material+texture+dither+ascii", "All On The Turn", "loop", "#8f7d68",
    "Four systems and one gesture: the cloth tightens, the dot screen cuts harder, the boxes thin, and the rubber picks up its rim, all of it off the angle you are holding.",
    [L("orbit", "textureScale", 0.5), L("orbit", "ditherBite", 0.5), L("orbit", "asciiDensity", -0.45), L("orbit", "sheen", 0.5)],
    { textureMode: "crosshatch", ditherType: "dotScreen", asciiCharset: "boxes", materialPreset: "rubber", materialUserOverride: true }),

  combo("material+animation+texture+layers", "Slipware", "loop", "#bfd4e8",
    "The group slides the bands, the bands' own phase wets the glaze, the draw decides how hard they print, and the finish catches once.",
    [L("stackField", "textureFlow", 0.55), L("textureField", "wet", 0.5), L("reveal", "textureBite", 0.45), L("completion", "glow", 0.4)],
    { textureMode: "bands", materialPreset: "ceramic", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+animation+dither+layers", "Print Shift", "loop", "#c9b79a",
    "The group pushes the hatch sideways while the hatch's own phase adds weight to the ink; the draw opens the tone and the finish glosses it.",
    [L("stackField", "ditherFlow", 0.55), L("ditherField", "ink", 0.5), L("reveal", "ditherThreshold", -0.45), L("completion", "gloss", 0.4)],
    { ditherType: "hatch", materialPreset: "matteClay", materialUserOverride: true, stackAnimationType: "loop" }),

  combo("material+texture+dither+layers", "Chalk Press", "loop", "#c9b79a",
    "Two screens on the group's clock and a body on yours: the dots shear and the newsprint chunks with the group, while turning the mark weights the chalk and sharpens the cut.",
    [L("stackField", "textureFlow", 0.55), L("stackField", "ditherCell", 0.5), L("orbit", "ink", 0.5), L("orbit", "ditherBite", 0.45)],
    { textureMode: "dots", ditherType: "newsprint", materialPreset: "chalk", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+animation+ascii+layers", "Signal Board", "loop", "#a9c3e8",
    "The group thickens the arrows, their own scroll moves the gel's rim, the draw shrinks their cells as the mark builds, and the finish lights it.",
    [L("stackField", "asciiDensity", 0.55), L("asciiField", "sheen", 0.5), L("reveal", "asciiCell", -0.45), L("completion", "glow", 0.4)],
    { asciiCharset: "arrows", materialPreset: "softGel", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+texture+ascii+layers", "Stencil", "loop", "#bfd4e8",
    "The group sharpens the punctuation and thins the brushed ground under it, while your hand spreads that ground and wets the ink.",
    [L("stackField", "asciiBite", 0.55), L("orbit", "textureScale", 0.5), L("stackField", "textureAmount", -0.45), L("orbit", "wet", 0.45)],
    { textureMode: "brushed", asciiCharset: "punct", stackAnimationType: "loop" }),

  combo("material+dither+ascii+layers", "Slick Readout", "loop", "#39c1e8",
    "The group slides the line screen and shrinks the dot characters; turning the mark thickens them and slides the oil film across the body.",
    [L("stackField", "ditherFlow", 0.55), L("orbit", "asciiDensity", 0.5), L("stackField", "asciiCell", -0.45), L("orbit", "iridescence", 0.55)],
    { ditherType: "lines", asciiCharset: "dots", materialPreset: "iridescent", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+animation+texture+fusion", "Wax Grain", "loop", "#e8c98f",
    "The breath decides how hard the grain prints, the grain's own phase adds weight to the wax, the draw spreads it, and a slow wander works the shine.",
    [L("breath", "textureBite", 0.55), L("textureField", "ink", 0.5), L("reveal", "textureScale", 0.45), L("drift", "gloss", 0.4)],
    { textureMode: "grain", materialPreset: "wax", materialUserOverride: true }),

  combo("material+animation+dither+fusion", "Gel Screen", "loop", "#a9c3e8",
    "The breath floods the blue-noise screen, the screen's own crawl wets the gel, the draw chunks the cells up, and a slow wander moves the rim.",
    [L("breath", "ditherThreshold", -0.55), L("ditherField", "wet", 0.5), L("reveal", "ditherCell", 0.45), L("drift", "sheen", 0.4)],
    { ditherType: "blueNoise", materialPreset: "softGel", materialUserOverride: true }),

  combo("material+texture+dither+fusion", "Dry Season", "loop", "#c9b79a",
    "The breath decides how much crackle survives while a slow wander opens the crosshatch; turning the mark weights the chalk and hardens the cut.",
    [L("breath", "textureAmount", 0.55), L("drift", "ditherThreshold", -0.5), L("orbit", "ink", 0.5), L("orbit", "ditherBite", 0.45)],
    { textureMode: "craquelure", ditherType: "crosshatch", materialPreset: "chalk", materialUserOverride: true }),

  combo("material+animation+ascii+fusion", "Night Shift", "loop", "#39c1e8",
    "The breath thickens the characters, their own scroll lights the tube, the draw sharpens them, and a slow wander pushes the body toward metal.",
    [L("breath", "asciiDensity", 0.55), L("asciiField", "glow", 0.5), L("reveal", "asciiBite", 0.45), L("drift", "metal", 0.4)],
    { asciiCharset: "custom", materialPreset: "neon", materialUserOverride: true }),

  combo("material+texture+ascii+fusion", "Gilt Type", "loop", "#e8c98f",
    "A slow wander decides how hard the grain prints and the breath thickens the type, while turning the leaf lights it and packs the grain tighter.",
    [L("drift", "textureBite", 0.55), L("breath", "asciiDensity", 0.5), L("orbit", "glow", 0.5), L("orbit", "textureScale", -0.45)],
    { textureMode: "woodgrain", asciiCharset: "classic", materialPreset: "gold", materialUserOverride: true }),

  combo("material+dither+ascii+fusion", "Wet Terminal", "loop", "#bfd4e8",
    "The breath floods the diamond screen and a slow wander resizes the boxes; turning the mark wets the ink and sharpens the characters.",
    [L("breath", "ditherThreshold", -0.55), L("drift", "asciiCell", 0.5), L("orbit", "wet", 0.5), L("orbit", "asciiBite", 0.45)],
    { ditherType: "diamond", asciiCharset: "boxes" }),

  combo("material+animation+layers+fusion", "Setting Wax", "loop", "#e8c98f",
    "Four clocks and one body: the group weights the ink, the breath moves the gloss, the draw dries the wax behind the pen, and a wander works the rim.",
    [L("stackField", "ink", 0.55), L("breath", "gloss", 0.5), L("reveal", "wet", -0.45), L("drift", "sheen", 0.4)],
    { materialPreset: "wax", materialUserOverride: true, stackAnimationType: "revealSynced" }),

  combo("material+texture+layers+fusion", "Rolling Skin", "loop", "#8f7d68",
    "The group rolls the scanlines, the breath decides how hard they print, a wander weights the rubber, and your hand moves its rim.",
    [L("stackField", "textureFlow", 0.55), L("breath", "textureBite", 0.5), L("drift", "ink", 0.45), L("orbit", "sheen", 0.45)],
    { textureMode: "scanlines", materialPreset: "rubber", materialUserOverride: true, stackAnimationType: "loop" }),

  /* THE SCREEN HAD TO BE GIVEN SOMETHING TO CUT. This was the weakest live cell
   * in the set — signal 3.204 against a drift of 1.498 — and at full res the eye
   * agreed with the meter: a clean stroke wearing a halftone you could not see.
   * The cause is the pairing, not the links. `ceramic` is *"white porcelain under
   * a hard glaze"* (`lib/style-system.ts`), and a halftone THRESHOLDS luminance —
   * on a body that bright, almost every sample sits above the default 0.5 and the
   * screen resolves to uniform white. Its own concept sentence ends "turning the
   * mark hardens the cut", and there was no cut to harden, so the loudest link in
   * the cell (`orbit -> ditherBite`) was modulating nothing.
   *
   * Same defect class as the note `DEFAULT_STYLE_STATE` already carries one line
   * above `ditherScale`: *"at the old default of 1 ... halftone was entirely
   * invisible"*. That one was resolved by giving the pattern enough PIXELS; this
   * one also needs enough BITE. The body is kept — the glaze is what
   * `drift -> wet` is about and what makes the cell its own idea.
   *
   * ⚠️ AND THE FIRST FIX WAS WRONG IN A WAY ONLY THE EYE CAUGHT, which is worth
   * leaving on the record. Raising `ditherThreshold` to 0.72 more than DOUBLED
   * the meter — net 1.7 -> 8.3 — because it gave the link a wider range to swing
   * through. It also made the picture EMPTIER: at full res the stroke came back
   * a featureless white, with less screen visible than before the fix. That is
   * the number improving while the read gets worse, and it is precisely the trap
   * this repo keeps naming — a meter is a flag, the eye is the gate.
   * The threshold is therefore left at its default and the range comes from
   * scale + contrast + the stack actually carrying the layer, which measures
   * more modestly (net 3.3) and is the version where you can SEE the halftone
   * dots. Both runs are on disk: `fusion-combos/diag-slip` (the meter-optimised
   * one, rejected) and `diag-slip2` (this one). */
  /* AND THEN IT WAS THE SAME CELL AS ITS NEIGHBOUR. Once the screen could be
   * seen, `assert-fusion-combo-distinct` put this cell and `material+dither+
   * fusion` — **"Slip Glaze"** — at 5.92, the closest pair in the whole set.
   * Reading the two side by side, the resemblance was never the tuning; it was
   * the authoring, and it had been hidden by the fact that neither screen was
   * legible: same body (`ceramic`), same `drift -> wet` link, both screens from
   * the dot family (`dotScreen` / `halftone`), and two names one word apart.
   * That is the padding failure this set is gated against — one idea twice —
   * and it does not stop being one because a meter cleared a floor.
   *
   * The two cells differ by exactly one member: **layers**. So this one's
   * picture has to be about the GROUP, and the fix follows from its own loudest
   * link rather than from a wish to be different. `stackField -> ditherFlow` is
   * "the group slides the screen" — and sliding an isotropic dot field just
   * makes it shimmer, because a grid of dots looks the same one dot along. A
   * DIRECTIONAL screen is where travel reads, so `lines`. `matteClay` gets it
   * off ceramic and gives the screen a mid-tone to actually cut into, and `wet`
   * survives the move because its `needs` is `null` — it works through
   * `colorScale`, roughness, env and clearcoat, so it darkens any body rather
   * than needing a glaze to sit on. Slip Glaze keeps ceramic, its dot screen
   * and its name; nothing was taken from it. */
  combo("material+dither+layers+fusion", "Press Run", "loop", "#bfd4e8",
    "The group drags the line screen across the mark like a plate pulling through a press, the breath opens its spacing, a slow wander wets the ink, and turning it hardens the cut.",
    [L("stackField", "ditherFlow", 0.55), L("breath", "ditherCell", 0.5), L("drift", "wet", 0.45), L("orbit", "ditherBite", 0.45)],
    { ditherType: "lines", materialPreset: "matteClay", materialUserOverride: true, stackAnimationType: "drift",
      ditherScale: 4.5, ditherContrast: 0.85, stackDitherOpacity: 1 }),

  combo("material+ascii+layers+fusion", "Departures", "loop", "#39c1e8",
    "The group thickens the digits, the breath resizes them, a slow wander lifts the light, and turning the board sharpens the read.",
    [L("stackField", "asciiDensity", 0.55), L("breath", "asciiCell", 0.5), L("drift", "glow", 0.45), L("orbit", "asciiBite", 0.45)],
    { asciiCharset: "numeric", materialPreset: "signal", materialUserOverride: true, stackAnimationType: "loop" }),

  combo("animation+texture+dither+ascii", "Round Robin", "loop", "#7ec8a0",
    "A ring rather than a chain: grain into screen, screen into type, type back into grain. Each layer drives the next and the last drives the first, so nothing is upstream of everything.",
    [L("textureField", "ditherThreshold", 0.5), L("ditherField", "asciiCell", 0.5), L("asciiField", "textureBite", 0.5), L("reveal", "asciiDensity", 0.4)],
    { textureMode: "grain", ditherType: "bayer4", asciiCharset: "classic" }),

  combo("animation+texture+dither+layers", "Press Group", "loop", "#a9c3e8",
    "The group shears the contour while the contour floods the dot screen and the screen spreads the contour back; the draw decides how hard the screen cuts.",
    [L("stackField", "textureFlow", 0.5), L("textureField", "ditherThreshold", 0.5), L("ditherField", "textureScale", 0.45), L("reveal", "ditherBite", 0.4)],
    { textureMode: "contour", ditherType: "dotScreen", stackAnimationType: "drift" }),

  combo("animation+texture+ascii+layers", "Woodblock", "loop", "#c9b79a",
    "The group thickens the type, the block decides how sharply it sits, the type shears the block back, and the finish thins the whole ground.",
    [L("stackField", "asciiDensity", 0.5), L("textureField", "asciiBite", 0.5), L("asciiField", "textureFlow", 0.45), L("completion", "textureAmount", 0.4)],
    { textureMode: "woodgrain", asciiCharset: "punct", stackAnimationType: "loop" }),

  combo("animation+dither+ascii+layers", "Composing Stick", "loop", "#7ec8a0",
    "The group slides the screen, the characters flood it, the screen resizes the characters, and the draw sharpens them as the line fills.",
    [L("stackField", "ditherFlow", 0.5), L("asciiField", "ditherThreshold", 0.5), L("ditherField", "asciiCell", 0.45), L("reveal", "asciiBite", 0.4)],
    { ditherType: "lines", asciiCharset: "blocks", stackAnimationType: "drift" }),

  combo("animation+texture+dither+fusion", "Weather Print", "loop", "#7ec8a0",
    "The breath decides how hard the noise prints, the noise floods the screen, the screen spreads the noise, and a slow wander chunks the cells.",
    [L("breath", "textureBite", 0.5), L("textureField", "ditherThreshold", 0.5), L("ditherField", "textureScale", 0.45), L("drift", "ditherCell", 0.4)],
    { textureMode: "noise", ditherType: "bayer8" }),

  combo("animation+texture+ascii+fusion", "Foundry", "loop", "#c9b79a",
    "The breath spreads the mesh, the mesh thickens the type, the type presses back into the mesh, and a slow wander resizes the characters.",
    [L("breath", "textureScale", 0.5), L("textureField", "asciiDensity", 0.5), L("asciiField", "textureBite", 0.45), L("drift", "asciiCell", 0.4)],
    { textureMode: "cellular", asciiCharset: "minimal" }),

  combo("animation+dither+ascii+fusion", "Wire Room", "loop", "#39c1e8",
    "The breath decides how hard the screen cuts, the characters flood it, the screen thickens them back, and a slow wander resizes the grid.",
    [L("breath", "ditherBite", 0.5), L("asciiField", "ditherThreshold", 0.5), L("ditherField", "asciiDensity", 0.45), L("drift", "asciiCell", 0.4)],
    { ditherType: "crosshatch", asciiCharset: "custom" }),

  combo("animation+texture+layers+fusion", "Tide Line", "loop", "#a9c3e8",
    "One pattern, four clocks: the group shears the ripple, the breath decides how hard it prints, its own phase thins it, and a slow wander spreads it.",
    [L("stackField", "textureFlow", 0.5), L("breath", "textureBite", 0.5), L("textureField", "textureAmount", -0.45), L("drift", "textureScale", 0.4)],
    { textureMode: "ripple", stackAnimationType: "loop" }),

  combo("animation+dither+layers+fusion", "Rota", "loop", "#c9b79a",
    "One screen, four clocks: the group slides it, the breath floods it, its own crawl chunks the cells, and a slow wander decides how hard it cuts.",
    [L("stackField", "ditherFlow", 0.5), L("breath", "ditherThreshold", -0.5), L("ditherField", "ditherCell", 0.45), L("drift", "ditherBite", 0.4)],
    { ditherType: "newsprint", stackAnimationType: "drift" }),

  combo("animation+ascii+layers+fusion", "Night Desk", "loop", "#7ec8a0",
    "One grid, four clocks: the group thickens it, the breath sharpens it, its own scroll resizes it, and a slow wander pushes it along.",
    [L("stackField", "asciiDensity", 0.5), L("breath", "asciiBite", 0.5), L("asciiField", "asciiCell", 0.45), L("drift", "asciiFlow", 0.4)],
    { asciiCharset: "classic", stackAnimationType: "loop" }),

  combo("texture+dither+ascii+layers", "Three Plates", "loop", "#a9c3e8",
    "Three screens, two hands: the group shears the grain and thickens the type while your turn floods the halftone and sharpens the characters.",
    [L("stackField", "textureFlow", 0.5), L("orbit", "ditherThreshold", 0.5), L("stackField", "asciiDensity", 0.45), L("orbit", "asciiBite", 0.4)],
    { textureMode: "grain", ditherType: "halftone", asciiCharset: "blocks", stackAnimationType: "drift" }),

  combo("texture+dither+ascii+fusion", "Overcast", "loop", "#7ec8a0",
    "Three screens under two weathers: the breath works the crackle, a slower wander opens the hatch, and your hand thickens the type and chunks the cells.",
    [L("breath", "textureBite", 0.5), L("drift", "ditherThreshold", -0.5), L("orbit", "asciiDensity", 0.45), L("orbit", "ditherCell", 0.4)],
    { textureMode: "craquelure", ditherType: "hatch", asciiCharset: "dots" }),

  combo("texture+dither+layers+fusion", "Bindery", "loop", "#c9b79a",
    "The group shears the bands, the breath floods the diamond screen, a slow wander decides how hard the bands print, and your hand chunks the screen.",
    [L("stackField", "textureFlow", 0.5), L("breath", "ditherThreshold", -0.5), L("drift", "textureBite", 0.45), L("orbit", "ditherCell", 0.4)],
    { textureMode: "bands", ditherType: "diamond", stackAnimationType: "loop" }),

  combo("texture+ascii+layers+fusion", "Case Room", "loop", "#c9b79a",
    "The group thickens the type, the breath decides how hard the block prints, a slow wander resizes the characters, and your hand spreads the block.",
    [L("stackField", "asciiDensity", 0.5), L("breath", "textureBite", 0.5), L("drift", "asciiCell", 0.45), L("orbit", "textureScale", 0.4)],
    { textureMode: "woodgrain", asciiCharset: "classic", stackAnimationType: "drift" }),

  combo("dither+ascii+layers+fusion", "Night Press", "loop", "#39c1e8",
    "The group slides the screen, the breath thickens the characters, a slow wander hardens the cut, and your hand resizes the grid.",
    [L("stackField", "ditherFlow", 0.5), L("breath", "asciiDensity", 0.5), L("drift", "ditherBite", 0.45), L("orbit", "asciiCell", 0.4)],
    { ditherType: "lines", asciiCharset: "boxes", stackAnimationType: "loop" }),

  /* ================= FIVE SYSTEMS (21) ================= */

  combo("material+animation+texture+dither+ascii", "Full Plate", "loop", "#bfd4e8",
    "The grain floods the screen, the screen resizes the type, the type glosses the body, the draw brings the grain up, and the finish lights it once.",
    [L("textureField", "ditherThreshold", 0.45), L("ditherField", "asciiCell", 0.45), L("asciiField", "gloss", 0.45), L("reveal", "textureAmount", 0.4), L("completion", "glow", 0.4)],
    { textureMode: "grain", ditherType: "bayer4", asciiCharset: "classic", materialPreset: "glossyPlastic", materialUserOverride: true }),

  combo("material+animation+texture+dither+layers", "Wet Proof", "loop", "#bfd4e8",
    "The group shears the contour, the contour floods the screen, the screen wets the body, the draw hardens the cut, and the finish adds weight.",
    [L("stackField", "textureFlow", 0.45), L("textureField", "ditherThreshold", 0.45), L("ditherField", "wet", 0.45), L("reveal", "ditherBite", 0.4), L("completion", "ink", 0.35)],
    { textureMode: "contour", ditherType: "halftone", materialPreset: "ceramic", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+animation+texture+ascii+layers", "Type Case", "loop", "#c9b79a",
    "The group thickens the type, the block sharpens it, the type moves the gel's rim, the draw spreads the block, and the finish lights it.",
    [L("stackField", "asciiDensity", 0.45), L("textureField", "asciiBite", 0.45), L("asciiField", "sheen", 0.45), L("reveal", "textureScale", 0.4), L("completion", "glow", 0.35)],
    { textureMode: "woodgrain", asciiCharset: "punct", materialPreset: "softGel", materialUserOverride: true, stackAnimationType: "loop" }),

  /* ⚠ THE SECOND DUPLICATE — and the one the pixel gate could not have found.
   *
   * This address shipped as **"Wire Desk"**, and it was "Read Out"
   * (`material+animation+dither+ascii`) with one more wire on an identical
   * picture:
   *
   *     Read Out    chrome · bayer8 · classic
   *                 asciiField>ditherThreshold · ditherField>shineBand
   *                 reveal>asciiBite · completion>metal
   *     Wire Desk   chrome · bayer8 · classic          <- the same three rails
   *                 stackField>ditherFlow                 <- the only new idea
   *                 asciiField>ditherThreshold · ditherField>shineBand
   *                 reveal>asciiDensity · completion>metal
   *
   * Three of Read Out's four links carried over VERBATIM, the fourth differing
   * only in which ASCII weight it drove, and the concept sentence was Read
   * Out's sentence with a clause bolted on the front. That is the padding this
   * whole set is gated against.
   *
   * **THE INSTRUMENTS BOTH SAID IT WAS FINE, AND HERE IS WHY.**
   * `assert-fusion-combo-distinct` scores the pair **38.30** apart on the v4
   * crops — nowhere near the floor, because the two cells genuinely DO render
   * differently: a drifting Bayer matrix is visible, and the closest pair in
   * that whole run was 10.46. Distance on pixels was never the question; and a
   * pair that far apart is proof the pixel gate is STRUCTURALLY unable to ask
   * this one. "One idea twice" is a
   * question about AUTHORING, and the pair shares no name word, which is the
   * one signal the earlier duplicate (Slip Glaze / Slip Screen) was caught by.
   * So §9 of `assert-fusion-combos.mjs` now asks the authoring question
   * directly — is a cell its one-member neighbour's composition and links, plus
   * a wire — and it carries this pair, as it shipped, as its known-bad.
   *
   * The re-authoring takes the member the two cells differ by (`layers`) and
   * makes the GROUP the whole idea rather than one more driver on Read Out's
   * body. The stack's own envelope — `stackAmount`, which `FusionSignals` folds
   * into the Stack source precisely so "a stack behaviour that only fades …
   * would otherwise be silent" — becomes an aperture, on `pulse`, the one stack
   * behaviour no cell in the set was using. Nothing is carried over: new body
   * (matteClay, a mid-tone for a screen to cut into — Press Run's lesson), new
   * screen (blueNoise at two cells, the least-carried type), new charset
   * (arrows at three, the least-carried), new drivers.
   * Read Out keeps its body, its screen, its charset and its name; nothing was
   * taken from it. */
  combo("material+animation+dither+ascii+layers", "Stop Down", "loop", "#7ec8a0",
    "The group is an aperture: its swell opens the screen and thins the characters together, the screen's own beat decides how big they are drawn, and the draw coarsens the screen's cells before the finish weights the ink.",
    [L("stackField", "ditherThreshold", 0.6), L("stackField", "asciiDensity", -0.5), L("ditherField", "asciiCell", 0.5), L("reveal", "ditherCell", 0.45), L("completion", "ink", 0.4)],
    { ditherType: "blueNoise", asciiCharset: "arrows", materialPreset: "matteClay", materialUserOverride: true, stackAnimationType: "pulse" }),

  combo("material+texture+dither+ascii+layers", "Handset", "loop", "#8f7d68",
    "Nothing crawls on its own: the group moves the grain and the type, and everything else is your hand on the object: the screen's flood, the ink's weight, the characters' edge.",
    [L("stackField", "textureFlow", 0.45), L("orbit", "ditherThreshold", 0.45), L("stackField", "asciiDensity", 0.4), L("orbit", "ink", 0.45), L("orbit", "asciiBite", 0.35)],
    { textureMode: "brushed", ditherType: "crosshatch", asciiCharset: "blocks", materialPreset: "rubber", materialUserOverride: true, stackAnimationType: "loop" }),

  combo("material+animation+texture+dither+fusion", "Damp Room", "loop", "#bfd4e8",
    "The breath decides how hard the grain prints, the grain floods the screen, the screen weights the ink, the draw spreads the grain, and a wander works the gloss.",
    [L("breath", "textureBite", 0.45), L("textureField", "ditherThreshold", 0.45), L("ditherField", "ink", 0.45), L("reveal", "textureScale", 0.4), L("drift", "gloss", 0.35)],
    { textureMode: "grain", ditherType: "blueNoise", materialPreset: "matteClay", materialUserOverride: true }),

  combo("material+animation+texture+ascii+fusion", "Second Impression", "loop", "#c9b79a",
    "The same two layers Letterpress couples, pulled the other way: the breath spreads the block, the block thickens the type, the type lights the body, the draw sharpens it, and a wander adds weight.",
    [L("breath", "textureScale", 0.45), L("textureField", "asciiDensity", 0.45), L("asciiField", "glow", 0.45), L("reveal", "asciiBite", 0.4), L("drift", "ink", 0.35)],
    { textureMode: "woodgrain", asciiCharset: "classic", materialPreset: "wax", materialUserOverride: true }),

  combo("material+animation+dither+ascii+fusion", "Cold Type", "loop", "#39c1e8",
    "The breath opens the screen, the characters harden its cut, the screen lights the body, the draw thickens the type, and a wander wets the ink.",
    [L("breath", "ditherThreshold", -0.45), L("asciiField", "ditherBite", 0.45), L("ditherField", "glow", 0.45), L("reveal", "asciiDensity", 0.4), L("drift", "wet", 0.35)],
    { ditherType: "lines", asciiCharset: "minimal", materialPreset: "signal", materialUserOverride: true }),

  combo("material+texture+dither+ascii+fusion", "Weather Deck", "loop", "#7ec8a0",
    "Two weathers over three screens and a body you turn: the breath works the crackle, a wander opens the screen, and your hand thickens the type and wets the ink.",
    [L("breath", "textureBite", 0.45), L("drift", "ditherThreshold", -0.45), L("orbit", "asciiDensity", 0.45), L("orbit", "wet", 0.4)],
    { textureMode: "craquelure", ditherType: "diamond", asciiCharset: "dots" }),

  combo("material+animation+texture+layers+fusion", "Long Grain", "loop", "#c9b79a",
    "One pattern and a body under five clocks: the group shears it, the breath bites it, its own phase weights the ink, the draw thins it, and a wander moves the rim.",
    [L("stackField", "textureFlow", 0.45), L("breath", "textureBite", 0.45), L("textureField", "ink", 0.45), L("reveal", "textureAmount", 0.4), L("drift", "sheen", 0.35)],
    { textureMode: "woodgrain", materialPreset: "rubber", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+animation+dither+layers+fusion", "Night Proof", "loop", "#bfd4e8",
    "The group slides the screen, the breath floods it, its own crawl wets the body, the draw chunks the cells, and a wander works the gloss.",
    [L("stackField", "ditherFlow", 0.45), L("breath", "ditherThreshold", -0.45), L("ditherField", "wet", 0.45), L("reveal", "ditherCell", 0.4), L("drift", "gloss", 0.35)],
    { ditherType: "newsprint", materialPreset: "glossyPlastic", materialUserOverride: true, stackAnimationType: "loop" }),

  combo("material+texture+dither+layers+fusion", "Two Plates Wet", "loop", "#bfd4e8",
    "The group shears the dots, the breath hardens the screen's cut, a wander spreads the dots, and your hand weights the ink and chunks the cells.",
    [L("stackField", "textureFlow", 0.45), L("breath", "ditherBite", 0.45), L("drift", "textureScale", 0.45), L("orbit", "ink", 0.4), L("orbit", "ditherCell", 0.35)],
    { textureMode: "dots", ditherType: "halftone", materialPreset: "ceramic", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+animation+ascii+layers+fusion", "Late Shift", "loop", "#39c1e8",
    "The group thickens the readout, the breath sharpens it, its own scroll lights the tube, the draw shrinks the cells, and a wander adds weight.",
    [L("stackField", "asciiDensity", 0.45), L("breath", "asciiBite", 0.45), L("asciiField", "glow", 0.45), L("reveal", "asciiCell", -0.4), L("drift", "ink", 0.35)],
    { asciiCharset: "numeric", materialPreset: "neon", materialUserOverride: true, stackAnimationType: "loop" }),

  combo("material+texture+ascii+layers+fusion", "Job Case", "loop", "#e8c98f",
    /* `gloss` and not `sheen`: gold's sheen colour is black (SHEEN_CAPABLE_MATERIALS
       does that arithmetic in full), and leaf is a specular material rather than
       a fabric one — the clearcoat/env trio IS what gold catching light means. */
    "The group thickens the type, the breath bites the block, a wander resizes the characters, and your hand spreads the block and lights the leaf.",
    [L("stackField", "asciiDensity", 0.45), L("breath", "textureBite", 0.45), L("drift", "asciiCell", 0.45), L("orbit", "textureScale", 0.4), L("orbit", "gloss", 0.35)],
    { textureMode: "craquelure", asciiCharset: "punct", materialPreset: "gold", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+dither+ascii+layers+fusion", "Composing Room", "loop", "#7ec8a0",
    "The group slides the screen, the breath thickens the type, a wander hardens the cut, and your hand wets the ink and resizes the grid.",
    [L("stackField", "ditherFlow", 0.45), L("breath", "asciiDensity", 0.45), L("drift", "ditherBite", 0.45), L("orbit", "wet", 0.4), L("orbit", "asciiCell", 0.35)],
    { ditherType: "hatch", asciiCharset: "blocks", stackAnimationType: "loop" }),

  combo("animation+texture+dither+ascii+layers", "Whole Press", "loop", "#a9c3e8",
    "Every screen system at once with the body left alone: the group shears the grain, the grain floods the screen, the screen resizes the type, the type bites the grain back, and the draw thickens it all.",
    [L("stackField", "textureFlow", 0.45), L("textureField", "ditherThreshold", 0.45), L("ditherField", "asciiCell", 0.45), L("asciiField", "textureBite", 0.4), L("reveal", "asciiDensity", 0.35)],
    { textureMode: "grain", ditherType: "bayer8", asciiCharset: "classic", stackAnimationType: "drift" }),

  combo("animation+texture+dither+ascii+fusion", "Weather In The Ring", "loop", "#7ec8a0",
    "Round Robin with weather in it: the ring still turns, grain to screen to type and back, and two clocks that belong to none of them push on the outside.",
    [L("breath", "textureBite", 0.45), L("textureField", "ditherThreshold", 0.45), L("ditherField", "asciiCell", 0.45), L("asciiField", "textureScale", 0.4), L("drift", "ditherBite", 0.35)],
    { textureMode: "cellular", ditherType: "bayer4", asciiCharset: "minimal" }),

  combo("animation+texture+dither+layers+fusion", "Damp Plates", "loop", "#a9c3e8",
    "Two plates and no type: the group shears one, the breath floods the other, each reads the other's phase, and a wander thins the ground.",
    [L("stackField", "textureFlow", 0.45), L("breath", "ditherThreshold", -0.45), L("textureField", "ditherBite", 0.45), L("ditherField", "textureScale", 0.4), L("drift", "textureAmount", -0.35)],
    { textureMode: "contour", ditherType: "dotScreen", stackAnimationType: "loop" }),

  combo("animation+texture+ascii+layers+fusion", "Block And Type", "loop", "#c9b79a",
    "The group thickens the type, the breath bites the block, the block resizes the characters, the characters shear the block, and a wander sharpens them.",
    [L("stackField", "asciiDensity", 0.45), L("breath", "textureBite", 0.45), L("textureField", "asciiCell", 0.45), L("asciiField", "textureFlow", 0.4), L("drift", "asciiBite", 0.35)],
    { textureMode: "woodgrain", asciiCharset: "boxes", stackAnimationType: "drift" }),

  combo("animation+dither+ascii+layers+fusion", "Wire And Screen", "loop", "#39c1e8",
    "The group slides the screen, the breath sharpens the type, the type floods the screen, the screen resizes the type, and a wander hardens the cut.",
    [L("stackField", "ditherFlow", 0.45), L("breath", "asciiBite", 0.45), L("asciiField", "ditherThreshold", 0.45), L("ditherField", "asciiCell", 0.4), L("drift", "ditherBite", 0.35)],
    { ditherType: "crosshatch", asciiCharset: "custom", stackAnimationType: "loop" }),

  combo("texture+dither+ascii+layers+fusion", "Weather Room", "loop", "#7ec8a0",
    "Everything but the body and the clocks that make a layer crawl: the group shears the pattern, two weathers work the screen and the type, and your hand finishes the job.",
    [L("stackField", "textureFlow", 0.45), L("breath", "ditherThreshold", -0.45), L("drift", "asciiDensity", 0.45), L("orbit", "textureBite", 0.4), L("orbit", "ditherCell", 0.35)],
    { textureMode: "bands", ditherType: "newsprint", asciiCharset: "dots", stackAnimationType: "drift" }),

  /* ================= SIX SYSTEMS (7) ================= */

  combo("material+animation+texture+dither+ascii+layers", "Full Press", "loop", "#bfd4e8",
    "Everything except fusion's own weather: the group shears the grain, the grain floods the screen, the screen resizes the type, the type glosses the body, and the draw and the finish bracket the whole thing.",
    [L("stackField", "textureFlow", 0.4), L("textureField", "ditherThreshold", 0.4), L("ditherField", "asciiCell", 0.4), L("asciiField", "gloss", 0.4), L("reveal", "asciiDensity", 0.35), L("completion", "glow", 0.35)],
    { textureMode: "grain", ditherType: "halftone", asciiCharset: "classic", materialPreset: "glossyPlastic", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+animation+texture+dither+ascii+fusion", "Loose Sheets", "loop", "#7ec8a0",
    /* NOT "read each other" — the links are a CHAIN, not a ring: grain into
       screen, screen into type, type into the ink. `Round Robin` and
       `Whole Press` are the rings; this one is deliberately not, and the copy has
       to say which. */
    "Every system but the layer group, and the three screens hand off in a CHAIN rather than a ring: the grain floods the screen, the screen resizes the type, the type weights the ink. The breath and a slower wander work the two ends, and no group animation holds the three to one rhythm.",
    [L("breath", "textureBite", 0.4), L("textureField", "ditherThreshold", 0.4), L("ditherField", "asciiCell", 0.4), L("asciiField", "ink", 0.4), L("reveal", "asciiDensity", 0.35), L("drift", "glow", 0.35)],
    { textureMode: "noise", ditherType: "bayer8", asciiCharset: "minimal", materialPreset: "matteClay", materialUserOverride: true }),

  /* ⚠ THE THIRD DUPLICATE — found by §9 of `assert-fusion-combos.mjs` on the
   * run that was written to catch the second one.
   *
   * This address shipped as **"Plates Only"**, and it was `Damp Plates`
   * (`animation+texture+dither+layers+fusion`) plus a body:
   *
   *     Damp Plates   contour · dotScreen
   *                   "Two plates and no type: the group shears one, the breath
   *                    floods the other, each reads the other's phase…"
   *                   stackField>textureFlow · breath>ditherThreshold
   *                   textureField>ditherBite · ditherField>textureScale
   *                   drift>textureAmount
   *     Plates Only   contour · dotScreen        <- the same two rails, exactly
   *                   "Two plates, no type: the group shears the grain, the
   *                    breath floods the screen…"
   *                   stackField>textureFlow · breath>ditherThreshold
   *                   textureField>ditherBite   <- three links, verbatim
   *                   ditherField>ink · reveal>textureScale · drift>gloss
   *
   * The concept sentences open with the same four words. Three of five links
   * are identical. Both composition rails Damp Plates sets are carried across
   * unchanged. The added member — material — bought a body and two links on it,
   * and nothing else about the cell was re-thought.
   *
   * AND THE BODY IT BOUGHT WAS THE ONE THIS SET HAS ALREADY BEEN BURNED BY.
   * `ceramic` is `#e2e6ea`, mean luminance 223, and a threshold screen on a body
   * that bright resolves to uniform white — which is the entire reason
   * `material+dither+layers+fusion` had to be re-authored off it into Press Run.
   * A dot screen was shipped onto ceramic twice.
   *
   * So the re-authoring moves the subject to the one thing Damp Plates cannot
   * have: **the ground itself**. Damp Plates is two plates reading each other.
   * This is the surface UNDER them changing while they hold — the group's clock
   * wets it, the breath weights it, your hand cuts the screen into it — on a
   * dielectric mid-tone (`wax`) a threshold screen can actually bite, with the
   * least-carried pattern in the set (`ripple`, 3 cells) and a line-family
   * screen (`hatch`, 5) instead of a second dot field. Not one link, not one
   * rail and not one word survives. Damp Plates is untouched. */
  combo("material+animation+texture+dither+layers+fusion", "Sizing", "loop", "#e8c98f",
    "The two plates hold still and the GROUND moves under them: the group's clock wets the surface, the breath puts weight in the ink, a wander opens the ripple, your hand cuts the hatch deeper, the draw coarsens the hatch's cells, and the finish sets the sheen.",
    [L("stackField", "wet", 0.6), L("breath", "ink", 0.5), L("drift", "textureScale", 0.45), L("orbit", "ditherThreshold", 0.5), L("reveal", "ditherCell", 0.4), L("completion", "sheen", 0.4)],
    { textureMode: "ripple", ditherType: "hatch", materialPreset: "wax", materialUserOverride: true, stackAnimationType: "loop" }),

  combo("material+animation+texture+ascii+layers+fusion", "Block And Case", "loop", "#c9b79a",
    "No screen at all: the group thickens the type, the breath bites the block, the block resizes the characters, the characters weight the ink, the draw spreads the block, and a wander moves the rim.",
    [L("stackField", "asciiDensity", 0.4), L("breath", "textureBite", 0.4), L("textureField", "asciiCell", 0.4), L("asciiField", "ink", 0.4), L("reveal", "textureScale", 0.35), L("drift", "sheen", 0.35)],
    { textureMode: "woodgrain", asciiCharset: "punct", materialPreset: "wax", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("material+animation+dither+ascii+layers+fusion", "Screen And Case", "loop", "#39c1e8",
    "No pattern at all: the group slides the screen, the breath sharpens the type, the type floods the screen, the screen wets the body, the draw thickens the read, and a wander lights it.",
    [L("stackField", "ditherFlow", 0.4), L("breath", "asciiBite", 0.4), L("asciiField", "ditherThreshold", 0.4), L("ditherField", "wet", 0.4), L("reveal", "asciiDensity", 0.35), L("drift", "glow", 0.35)],
    { ditherType: "lines", asciiCharset: "custom", materialPreset: "signal", materialUserOverride: true, stackAnimationType: "loop" }),

  /* NOT "held still", which the first name was and which was FALSE. The cell has
   * no `animation` member, so no layer has a clock of its OWN — but the group's
   * drift publishes a shared time offset (`gOff`), and viewport-3d.tsx drives an
   * un-animated dither and ASCII through their scroll branch while that offset
   * is sliding, precisely so the stack moves as one body. So the layers DO move;
   * every bit of that motion is borrowed from another system. Measured:
   * `evaluateStackAnimation({behaviour: "drift"})` returns timeOffset 0 -> 3.3
   * over three seconds. A name has to describe what renders. */
  combo("material+texture+dither+ascii+layers+fusion", "Borrowed Motion", "loop", "#8f7d68",
    "Every system except the clocks that make a layer crawl on its own. Nothing here has its own timing: the layers move because the GROUP slides them, the surface moves because two weathers work it, and the rest is your hand on the object.",
    [L("stackField", "textureFlow", 0.4), L("breath", "ditherThreshold", -0.4), L("drift", "asciiDensity", 0.4), L("orbit", "ink", 0.4), L("orbit", "textureBite", 0.35)],
    { textureMode: "brushed", ditherType: "diamond", asciiCharset: "boxes", materialPreset: "rubber", materialUserOverride: true, stackAnimationType: "drift" }),

  combo("animation+texture+dither+ascii+layers+fusion", "Screens Only", "loop", "#7ec8a0",
    "Every clock in the app on three screens, and the body deliberately untouched, so you can see the coupling as pattern rather than as shine.",
    [L("stackField", "textureFlow", 0.4), L("breath", "ditherThreshold", -0.4), L("textureField", "ditherBite", 0.4), L("ditherField", "asciiCell", 0.4), L("asciiField", "textureScale", 0.35), L("drift", "asciiDensity", 0.35)],
    { textureMode: "cellular", ditherType: "bayer4", asciiCharset: "blocks", stackAnimationType: "loop" }),

  /* ================= SEVEN SYSTEMS (1) ================= */

  combo("material+animation+texture+dither+ascii+layers+fusion", "Full Register", "loop", "#bfd4e8",
    "All seven, and every link on a different driver: the group, each layer's own phase, the breath, a slower wander, the draw, the finish and your hand. Nine relationships that never quite agree, which is the difference between a chord and a unison. (Whole Cloth is the other answer to this cell, and it makes the opposite choices.)",
    [
      L("stackField", "textureFlow", 0.4),
      L("textureField", "ditherThreshold", 0.4),
      L("ditherField", "asciiCell", 0.4),
      L("asciiField", "ink", 0.4),
      L("breath", "ditherBite", 0.35),
      L("drift", "textureScale", 0.35),
      L("reveal", "asciiDensity", 0.3),
      L("completion", "glow", 0.35),
      L("orbit", "shineBand", 0.55),
    ],
    { textureMode: "woodgrain", ditherType: "newsprint", asciiCharset: "classic", materialPreset: "softGel", materialUserOverride: true, stackAnimationType: "drift" }),
]

export const FUSION_COMBO_LIST: FusionCombo[] = [...COMBOS_2_TO_3, ...COMBOS_4_TO_7]

/** By `fusionPreset` value (`combo:<key>`) — what `evaluateFusion` looks up. */
export const FUSION_COMBOS_BY_ID: Record<string, FusionCombo> = Object.fromEntries(
  FUSION_COMBO_LIST.map((c) => [comboFusionKey(c.key) as string, c]),
)
/** By bare key (`material+texture`) — what the picker looks up. */
export const FUSION_COMBOS_BY_KEY: Record<string, FusionCombo> = Object.fromEntries(
  FUSION_COMBO_LIST.map((c) => [c.key, c]),
)

/**
 * Which cell a shipped LINK-AUTHORED relationship already answers.
 *
 * DERIVED, never declared — `systemsOfLinks` reads the same link lists the
 * evaluator does, so a link edited on a built-in moves its cell automatically.
 * The eight hand-written switch-case relationships (Terminal Gel … Glitch
 * Ribbon) are deliberately absent: they have no link list, so their membership
 * cannot be derived, and a hand-written table of them would be exactly the
 * inventory-that-drifts this file keeps naming.
 */
export const SHIPPED_BY_COMBO_KEY: Record<string, string[]> = (() => {
  const out: Record<string, string[]> = {}
  for (const [id, f] of Object.entries(BUILTIN_LINK_FUSIONS)) {
    const k = comboKeyOf(systemsOfLinks(f.links))
    ;(out[k] ??= []).push(id)
  }
  return out
})()

/* ==========================================================================
 * THE VIEW IS A SYSTEM A FUSION CAN NEED, AND NOTHING COULD SAY SO
 * ==========================================================================
 *
 * Sebs, 2026-08-04: *"slow weather and turntable dont animate"*.
 *
 * `viewTurn` (Turn Table) reads `orbit`, which is
 * `Math.atan2(camera.position.x, camera.position.z)` (viewport-3d.tsx:4954),
 * and `phaseTriangle` puts REST AT ZERO. The page loads head-on, where that
 * azimuth is 0, so `phaseTriangle(0, 2*PI)` is EXACTLY 0 and all three of Turn
 * Table's links contribute exactly nothing. It is not quiet, it is zero — and it
 * stays zero until something turns the mark.
 *
 * `_probe-fusion-sheet.mjs` already knew: its own comment says the preset
 * *"rests at the head-on angle by design, so a head-on capture of it is a
 * capture of its resting state"*, and it works around it by framing every arm at
 * 38 degrees. THE PROBE COMPENSATED AND THE PRODUCT DID NOT. What Sebs clicked
 * was a relationship that could not act in the state he clicked it in, and a
 * relationship that looks dead is dead.
 *
 * THE FIX IS THE ONE THIS FILE ALREADY MAKES EVERYWHERE ELSE: a fusion is a
 * statement that these systems are related, so selecting one puts the systems it
 * needs ON — that is `fusionWakePatch`'s whole job for layers, animation, the
 * dither's travel direction and the body. The VIEW is simply the one system the
 * wake could not reach, because the camera is not style state. So the wake now
 * reports it as well, as `FusionWake.spin`, and the caller (app/page.tsx, which
 * owns the viewport API) turns the turntable on exactly as `applyViewPresetById`
 * does for the Portfolio Spin view preset. 12 degrees per second, the same
 * number that preset ships (lib/style-system.ts:1741, filmed at delta-px 72.64).
 *
 * WHY IT IS REPORTED RATHER THAN ASSUMED. `fusionLinkSleep` is handed style
 * state, which cannot know whether the camera is moving; a caller that does know
 * passes `cameraSpinDegPerSecond`. UNDEFINED MEANS "I DO NOT KNOW" and is
 * silent — a model-side gate with no camera must not manufacture a sleep reason
 * out of its own ignorance. `assert-fusion-combos.mjs` §5 drives BOTH arms (0
 * and 12) and requires the reason to appear and disappear, so this is not a
 * check that cannot fail.
 */
export const FUSION_VIEW_SPIN_DEG = 12

/** Does any live link in this fusion read the camera? */
export function fusionUsesView(f: { links?: FusionLink[] }): boolean {
  return (f.links ?? []).some((l) => l?.source === "orbit" && Math.abs(l?.amount ?? 0) >= 0.005)
}

/* ==========================================================================
 * THE COMPOSITION A COMBINATION CELL LANDS ON
 * ==========================================================================
 *
 * A cell FULLY DETERMINES the composition, exactly as every other composition
 * preset does (`applyPresetToStyleState`'s rule: *"Selecting one resets every
 * composition rail to DEFAULT_STYLE_STATE first, then applies its patch"*).
 * Without that, a cell for {texture, dither} selected after a cell for
 * {texture, dither, ascii} would still be wearing the ASCII layer and would be
 * a lie about its own name.
 *
 * `defaults` IS PASSED IN RATHER THAN IMPORTED, and that is deliberate:
 * lib/style-system.ts already imports THIS file (for `BUILTIN_LINK_FUSIONS` and
 * `fusionWakePatch`), so a value import back the other way would close a module
 * cycle and put `DEFAULT_STYLE_STATE` in the temporal dead zone for whichever
 * module happened to be evaluated first. One argument avoids the whole class.
 *
 * The RAIL KEY SET is derived by prefix rather than copied from
 * `COMPOSITION_RAIL_KEYS`, for the reason this file gives twice already: a
 * hand-copied inventory is the failure mode, and the two must agree.
 * `assert-fusion-combos.mjs` §2 asserts they do, by diffing this reset against
 * what `applyPresetToStyleState` itself produces from a deliberately dirty
 * state — so a key added to one and not the other is caught by the gate rather
 * than by a user.
 */
const COMPOSITION_PREFIXES = ["texture", "dither", "ascii", "stack", "layerStack", "fusion"]
const COMPOSITION_EXTRA = ["motionMode", "styleLoopSeconds"]

export function isCompositionRailKey(k: string): boolean {
  if (k === "customFusions") return false // the LIBRARY is not a rail; it survives every preset
  return COMPOSITION_EXTRA.includes(k) || COMPOSITION_PREFIXES.some((p) => k.startsWith(p))
}

/** Every composition rail, back at its default. */
export function compositionReset(defaults: StyleState): Partial<StyleState> {
  const out: Record<string, unknown> = {}
  const src = defaults as unknown as Record<string, unknown>
  for (const k of Object.keys(src)) if (isCompositionRailKey(k)) out[k] = src[k]
  return out as Partial<StyleState>
}

/**
 * The full style patch for selecting a combination cell.
 *
 * Everything except `compose` is DERIVED FROM THE LINKS — which layers to switch
 * on, which of them have to be animating, whether the dither needs a travel
 * direction, whether the body needs a sheen colour, whether two screen layers
 * mean the stack. That is the same derivation `fusionWakePatch` performs, and it
 * is used here for the same reason: correctness that lives in 116 hand-written
 * patches holds only for as long as every author remembers.
 */
export function comboStylePatch(c: FusionCombo, defaults: StyleState): Partial<StyleState> {
  const sys = new Set(c.systems)
  const links = c.links ?? []
  const patch: Partial<StyleState> = {
    ...compositionReset(defaults),
    // Fusion's own dials — the same block `FUSION_BASE` gives every shipped
    // relationship, with this cell's authored shape instead of the default Loop.
    fusionDrive: c.drive,
    fusionAnimationEnabled: c.drive !== "loop",
    fusionAnimationSpeed: 1,
    fusionIntensity: 0.6,
    fusionSwing: 1,
    // The substrate. `evaluateFusion` calls motion mode "the substrate-level
    // 'may style animate' switch" and every shipped fusion preset sets it, so a
    // cell that animates nothing still lands with a running clock rather than a
    // frozen one that would silently kill a later dial move.
    motionMode: "independent",
  }
  // ---- the member layers, at the wakes the built-ins already proved -------
  if (sys.has("texture")) Object.assign(patch, WAKE_TEXTURE)
  if (sys.has("dither")) Object.assign(patch, WAKE_DITHER)
  if (sys.has("ascii")) Object.assign(patch, WAKE_ASCII)
  // ---- animation, derived: a phase source needs its layer MOVING ---------
  let needsTravel = false
  for (const l of links) {
    if (Math.abs(l.amount) < 0.005) continue
    const srcNeeds = SOURCE_DEF.get(l.source)?.needsAnim
    if (srcNeeds) Object.assign(patch, WAKE_ANIM[srcNeeds])
    const tgtNeeds = TARGET_DEF.get(l.target)?.needsAnim
    if (tgtNeeds) Object.assign(patch, WAKE_ANIM[tgtNeeds])
    if (l.source === "stackField") Object.assign(patch, WAKE_ANIM.stack)
    // `dir * uFsDitTime` is the ZERO vector on the static direction. WHICH
    // direction is settled after `compose`, below — the cell picks its own
    // screen there, and the screen is what decides which axis can see a push.
    if (TARGET_DEF.get(l.target)?.needsDitherDirection) needsTravel = true
    // Sheen is black light on eleven of the fifteen bodies.
    if (TARGET_DEF.get(l.target)?.needsSheenMaterial && !c.compose?.materialPreset) {
      patch.materialPreset = "softGel"
      patch.materialUserOverride = true
    }
  }
  // ---- the stack --------------------------------------------------------
  const screenLayers = (sys.has("texture") ? 1 : 0) + (sys.has("dither") ? 1 : 0) + (sys.has("ascii") ? 1 : 0)
  if (sys.has("layers") || screenLayers >= 2) {
    Object.assign(patch, WAKE_STACK)
    if (sys.has("layers")) Object.assign(patch, WAKE_ANIM.stack)
  }
  // ---- what this cell authors for itself --------------------------------
  Object.assign(patch, c.compose ?? {})
  /* THE TRAVEL AXIS IS SETTLED LAST, BECAUSE THE SCREEN ARRIVES LAST.
   *
   * `compose` is where a cell chooses its `ditherType`, and the type is what
   * decides which axis a push is visible on — so a direction picked in the loop
   * above is picked before the fact it depends on exists. Seven cells landed on
   * `lines` + horizontal that way and their flow links wrote no pixels at all;
   * one of them, `Composing Stick`, was the single cell of 116 the pixel probe
   * read as not changing the mark. A cell that authors its own direction keeps
   * it: that is a decision, not a default. */
  if (needsTravel && !c.compose?.ditherDirection) {
    const landed = { ...defaults, ...patch } as StyleState
    patch.ditherDirection = ditherTravelDirection(landed.ditherType, landed.ditherAngle ?? 45)
  }
  patch.fusionPreset = comboFusionKey(c.key)
  return patch
}
