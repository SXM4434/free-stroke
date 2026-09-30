/**
 * style-system.ts — POST-MVP visual style substrate (Phase 1: rails only)
 *
 * This is INFRASTRUCTURE ONLY. It defines the clean state model + preset id
 * shells that future visual systems (material, procedural texture, dither,
 * ASCII, layer stack, fusion, and geometry-synced style animation) will build
 * on. NONE of these effects are implemented yet — this file intentionally adds
 * no rendering, no shaders, no geometry, and no animation behavior.
 *
 * Hard rules for this phase:
 *  - Do NOT read these values in any geometry build path.
 *  - Do NOT use these values to rebuild meshes.
 *  - Style state is display/debug only for now.
 *
 * Keeping the full field set defined up front (even though most are inert)
 * lets later phases light up one system at a time without reshaping state or
 * re-threading props through the component tree.
 */

// The only runtime import here. `style-clock.ts` imports this module for TYPES
// only (`import type`), which is erased at compile time, so this does not
// create a runtime cycle.
import { completionTrigger } from "./style-clock"
/* Family 14's patch names the take's three objects. `stroke-schedule.ts`
 * imports nothing from here, so this direction is the only one and there is no
 * cycle. Types only. */
import type {
  DrawInParams,
  RevealWindowParams,
  RevealEnvelopeParams,
} from "./stroke-schedule"

/* ----------------------------- enums / unions ---------------------------- */

export type MaterialPreset =
  | "ink"
  | "softGel"
  | "matteClay"
  | "glossyPlastic"
  | "rubber"
  | "signal"
  | "ceramic"
  | "chalk"
  | "chrome"
  | "gold"
  | "wax"
  | "neon"
  | "iridescent"
  | "deskDoodles"
  | "custom"

/**
 * MaterialAnimationType — ANIMATED MATERIAL v1.
 * Preview-only surface-response animations. Each one modulates only highlight /
 * roughness / sheen / emissive (never geometry, the reveal clock, or export).
 * See `evaluateMaterialAnimation`.
 */
export type MaterialAnimationType =
  | "none"
  | "shineSweep"
  | "gelShimmer"
  | "roughnessPulse"
  | "completionFlash"
  | "signalFlicker"

/**
 * CustomMaterial — the user-editable surface used when materialPreset is
 * "custom". A subset of MaterialParams that the Custom Material UI exposes as
 * sliders / color pickers. Merged over the "custom" base in
 * `resolveMaterialParams`, so any field omitted falls back to the base.
 */
export interface CustomMaterial {
  color: string
  roughness: number
  metalness: number
  clearcoat: number
  sheen: number
  sheenColor: string
  emissive: string
  emissiveIntensity: number
  envMapIntensity: number
}

/**
 * TextureMode = procedural PATTERNING only. Dither and ASCII are deliberately
 * NOT texture modes — they are separate sibling systems with their own state
 * (`dither*` / `ascii*`). Never add "dither" or "ascii" here.
 */
export type TextureMode =
  | "none"
  | "procedural"
  | "grain"
  | "noise"
  | "scanlines"
  | "bands"
  | "contour"
  | "crosshatch"
  | "dots"
  | "woodgrain"
  | "cellular"
  | "brushed"
  | "craquelure"
  | "ripple"

/** How a texture/effect is anchored as the camera or geometry moves. */
export type TextureLockMode = "screen" | "object" | "surface" | "stroke"

/** Direction an animated texture pattern travels. */
export type TextureDirection = "horizontal" | "vertical" | "diagonal"
/* TEXTURE ANIMATION TYPES (TEXTURE-ANIM, 2026-09-26). Travel slides the pattern and
 * on a thin stroke it reads as the camo reshuffling (docs/verification/texture-anim/),
 * so the other three change something the eye catches on the whole logo at once:
 * contrast (Pulse), a band of light crossing it (Sheen), or the pattern jumping on
 * threes like hand-drawn line boil (Boil). The shader index is the array order. */
export type TextureAnimationType = "travel" | "pulse" | "sheen" | "boil"
export const TEXTURE_ANIMATION_TYPES: { id: TextureAnimationType; label: string; directional: boolean }[] = [
  { id: "travel", label: "Travel, the pattern slides one way", directional: true },
  { id: "pulse", label: "Pulse, the pattern fades in and out", directional: false },
  { id: "sheen", label: "Sheen, a band of light sweeps across", directional: true },
  { id: "boil", label: "Boil, the pattern jitters like hand-drawn lines", directional: false },
]

/** How style animation phase relates to the geometry reveal/animation clock. */
export type StyleSyncMode =
  | "independent"
  | "revealSynced"
  | "strokeTimeSynced"
  /** Starts only once the draw-in has finished (PRD: "delayed after reveal"). */
  | "delayedAfterReveal"
  | "completionPulse"
  | "loopSynced"

/**
 * MotionMode = the substrate-level "is style allowed to animate, and against
 * which clock" control. This is a USER-FACING summary of style motion (shown
 * in the top bar as "Motion"). It is intentionally coarse:
 *   - "off"        → style layers are static
 *   - "independent" → style layers animate on their own clock
 *   - "syncToDraw"  → style animation timing is driven by stroke draw-in progress
 * The fine-grained per-system flags (textureAnimated, ditherAnimated, …) and the
 * per-layer `*SyncMode` fields are the finer grain underneath; `motionMode` is
 * the single clear control the user sees today. Every renderer resolves the two
 * together through `resolveSyncMode` (lib/style-clock.ts).
 *
 * DELETED IN THE MATERIAL CRAFT PASS — five fields that were declared,
 * defaulted, and never read by anything: a scene-level `syncMode` (superseded
 * by the per-layer ones), `syncToReveal` and `globalStyleTime` (both only ever
 * printed into a debug readout — `globalStyleTime` was never even advanced, so
 * it read 0.00 forever), `stackAnimationSyncMode`, and `fusionAnimationType`
 * together with the `StyleAnimationType` union that existed only to type it.
 * Declared-but-unread state is worse than missing state: it looks like a knob.
 */
export type MotionMode = "off" | "independent" | "syncToDraw"

export type DitherType =
  | "bayer4"
  | "bayer8"
  | "blueNoise"
  | "halftone"
  | "lines"
  | "dotScreen"
  | "hatch"
  | "crosshatch"
  | "diamond"
  | "newsprint"
export type DitherDirection = "static" | "horizontal" | "vertical" | "diagonal"

export type AsciiCharset =
  | "blocks"
  | "classic"
  | "minimal"
  | "dots"
  | "custom"
  | "braille"
  | "boxes"
  | "arrows"
  | "punct"
  | "numeric"
export type AsciiDirection = "static" | "horizontal" | "vertical"

/**
 * AsciiAnimationType — each value moves a DIFFERENT thing, so the animated
 * presets are genuinely distinct rather than one effect at five speeds:
 *   scroll        the whole glyph grid travels
 *   rain          each column falls at its own speed
 *   cycle         glyphs change in place, walking the character ramp
 *   flicker       a few random cells jump to a random glyph each tick
 *   revealDensity characters thicken as the stroke draws in
 */
export type AsciiAnimationType =
  | "none"
  | "scroll"
  | "rain"
  | "cycle"
  | "flicker"
  | "revealDensity"

/**
 * FusionPreset — FUSION (IMPLEMENTED, PRD phases 20/21). Fusion is systems
 * INFLUENCING each other — one layer's per-frame output value becomes another
 * layer's input (glyph density driving dither threshold, a threshold signal
 * driving material shine). Distinct from the layer stack (coexistence) and
 * stack animation (the group moves uniformly). The relationships live in
 * lib/style-fusion.ts (`evaluateFusion`); each id below names ONE authored
 * relationship, not a bag of saved sliders.
 */
export type FusionPreset =
  | "none"
  | "terminalGel"
  | "ditherBloom"
  | "signalInk"
  | "asciiRubber"
  | "scanlineBalloon"
  | "pixelClay"
  | "codeBloom"
  | "glitchRibbon"
  /* The four added 2026-08-03, each closing a system that could not reach the
   * rail at all — the view, a non-repeating drift, the layer stack's own clock,
   * and all of it at once. They are written as LINK LISTS
   * (`BUILTIN_LINK_FUSIONS` in lib/style-fusion.ts) and evaluated through the
   * same path a user's fusion takes, which is what makes the panel's "Edit a
   * copy" on them a real copy rather than an approximation. */
  | "viewTurn"
  | "slowWeather"
  | "formation"
  | "wholeCloth"
  /* The two added 2026-08-04, and they are NOT two more mixes: they are the two
   * cells of the combination space that had no shipped relationship at all.
   * Sebs: *"i asked to have at least one fusion for every possible combo of
   * styles."* The space is the eight subsets of {texture, dither, ascii} —
   * enumerated and printed cell by cell by
   * `scripts/verify/_probe-fusion-coverage.mjs`, which is the thing that found
   * them rather than a hand count.
   *   Still Wet    the SURFACE-ONLY cell — no screen layer at all, the one
   *                relationship that is purely the body, driven by the DRAW.
   *   Letterpress  the TEXTURE+ASCII cell — a pattern and a glyph grid reading
   *                each other, with no dither anywhere near it. */
  | "stillWet"
  | "letterpress"
  /**
   * A fusion the USER authored, identified as `custom:<id>` (PRD Layer 14 —
   * "layers combine into a NEW AUTHORED visual system"; the eight above are
   * ours, this arm is theirs).
   *
   * WHY THE ID IS INSIDE THE STRING. viewport-3d.tsx arms fusion's arrival and
   * event schedules on `${fusionPreset}:${drive}`. A flat `"custom"` value
   * would make every user fusion share one arming key, so switching between two
   * of them would not restart the Arc — the documented "a build that had always
   * already finished" trap, one level up. Carrying the id in the field means
   * the existing arming logic is correct for user fusions with no change to it.
   * Resolution lives in lib/style-fusion.ts (`isCustomFusionId`).
   */
  | `custom:${string}`
  /**
   * A COMBINATION CELL, identified as `combo:<key>` where the key is the
   * canonical `material+texture+…` name of the subset it answers.
   *
   * ADDED 2026-08-07, and it DELETES A CAST rather than adding a feature.
   * `comboFusionKey` in lib/style-fusion.ts carried
   * `as StyleState["fusionPreset"]` with a comment explaining that this union
   * belonged to another lane, so the arm could not be declared and the cast was
   * confined to one function to keep the fix in one place. This lane owns both
   * files, so the arm is declared and the cast goes.
   *
   * The 120 cells are NOT entries in `FUSION_PRESET_DEFS` — a cell is not a
   * pill on the rail, and merging the two registries is what would make
   * `applyPresetToStyleState` treat a cell as something to wake. Two
   * registries, one evaluator: `evaluateFusion` resolves `BUILTIN_LINK_FUSIONS`
   * and `FUSION_COMBOS_BY_ID` through the identical code path a user's fusion
   * takes. Resolution lives in lib/style-fusion.ts (`isComboFusionId`), and
   * `assert-fusion-combos.mjs` §1 asserts the namespace collides with neither
   * the `custom:` arm nor the shipped rail.
   */
  | `combo:${string}`

/**
 * FusionDrive — the SHAPE of a fusion relationship over time, and the real axis
 * that "fusion presets vs animated fusion presets" was standing in for.
 *
 * The old split was a boolean, and it did not describe anything a viewer could
 * see: every one of the eight non-animated presets animates (measured 11.9-769.8
 * path units of late-window motion on the real page), and five of the seven
 * "animated" ones were QUIETER than their sibling because they replaced a
 * forever-loop with a one-shot that decayed to nothing — Code Bloom's measuring
 * exactly 0.00. See the taxonomy note at the top of lib/style-fusion.ts for the
 * full measurement.
 *
 *   loop   the relationship runs continuously on its own rhythm
 *   arc    it ARRIVES with the draw (and on selection), then settles into a
 *          quieter loop — never into a frozen frame
 *   burst  it rests, and fires on discrete events
 *
 * Every preset supports all three, so the matrix is 8 x 3 with no holes. It is a
 * DIAL in the fusion config, not a second row of pills.
 */
export type FusionDrive = "loop" | "arc" | "burst"

/**
 * StackAnimationType — how the WHOLE layer group animates as a container.
 * See lib/style-stack.ts. Distinct from per-layer animation (each layer moving
 * on its own) and from fusion animation (layers influencing each other).
 */
export type StackAnimationType =
  | "none"
  | "fadeIn"
  | "pulse"
  | "drift"
  | "delayAfterReveal"
  | "completionPulse"
  | "freezeOnComplete"
  | "loop"
  /**
   * The group's strength and phase ARE the draw-in playhead — the stack builds
   * with the stroke and un-builds when the playhead is scrubbed back.
   *
   * Added because PRD §4 names "reveal sync" as one of the eleven stack-level
   * controls and nothing here provided it: `delayAfterReveal` waits for the
   * draw to END and `freezeOnComplete` holds AFTER it, so the whole family had
   * a behaviour for after the reveal and none for DURING it.
   *
   * HONEST LIMIT, stated where the behaviour is defined rather than discovered
   * by a user: on a stroke that has already finished, the playhead rests at 1,
   * so this behaviour sits at full strength and looks static until the draw is
   * replayed. That is what "synced to the reveal" means and it is not a defect
   * — but it is the reason the panel copy for this option says "replay the
   * draw", and the reason it is the one behaviour whose evidence has to be
   * captured DURING a draw.
   */
  | "revealSynced"

// Stack types live in style-stack.ts (next to the blend GLSL they describe).
// Imported so StyleState can reference them, re-exported so consumers still get
// the whole style model from one module.
import type { StackBlendMode, StackOrder } from "./style-stack"
export type { StackBlendMode, StackOrder }

// The user-authored fusion model lives next to the engine that evaluates it,
// the same way the stack types live next to the blend GLSL they describe.
// TYPE-ONLY, so the pair of modules referring to each other costs nothing at
// runtime (style-fusion.ts already imports StyleState the same way).
import type { CustomFusion } from "./style-fusion"
/* A VALUE import, and the direction is safe: `lib/style-fusion.ts`'s only edge
 * back to this file is `import type { StyleState }` (:135), which the compiler
 * erases — so there is no runtime cycle in the bundle or under
 * `scripts/verify/_ts-load.mjs`'s CommonJS shim. Kept as a separate statement
 * from the type import above so that stays obvious to the next reader. */
import { BUILTIN_LINK_FUSIONS, fusionWakePatch, resolveFusionDrive } from "./style-fusion"
export type { CustomFusion }

/* ------------------------------ style state ------------------------------ */

/** FLIP-3 · the flip after the draw-in. Absent means Off. */
export type FlipChoice = "off" | "flatToSolid" | "solidToFlat"

export interface StyleState {
  /* --- material (IMPLEMENTED v1) ---
   * `materialPreset` drives the visible surface (color / roughness / metalness /
   * clearcoat / sheen / emissive) in the 3D preview. `materialAnimation*`
   * drives ANIMATED MATERIAL v1 — a preview-only, surface-response animation
   * that never touches geometry, the geometry reveal clock, or export. */
  materialPreset: MaterialPreset
  /** When true the user explicitly chose a material; mode switches must NOT
   *  overwrite it with the per-mode default. False = follow mode default. */
  materialUserOverride: boolean
  materialAnimationEnabled: boolean
  materialAnimationType: MaterialAnimationType
  materialAnimationSpeed: number
  materialAnimationIntensity: number
  /** Editable surface used when materialPreset === "custom". */
  customMaterial: CustomMaterial

  /* --- texture (umbrella) --- */
  textureMode: TextureMode
  textureEnabled: boolean
  textureAnimated: boolean
  /** Which motion Texture Animation plays, from TEXTURE_ANIMATION_TYPES. */
  textureAnimationType: TextureAnimationType
  /**
   * ⚠ VESTIGIAL — no writer and no reader, anywhere. `textureMode` is the real
   * field (six consumers). Kept rather than deleted only because it appears in
   * `COMPOSITION_RAIL_KEYS` and a preset patch on disk could still name it, so
   * removing it is a separate change with its own sweep; flagged here so nobody
   * wires a control to it by mistake, which is exactly how a dead field becomes
   * a dead dial. The debug readout's `textureTypeIndex`
   * (components/viewport-3d.tsx:5579) reads `textureMode`, not this.
   */
  textureType: string
  textureScale: number
  textureIntensity: number
  textureContrast: number
  textureSpeed: number
  /**
   * ⚠ NO WRITER ANYWHERE — permanently 0. Swept 2026-08-01: the only
   * occurrences in the repo are this declaration, the `0` in
   * `DEFAULT_STYLE_STATE`, its listing in `COMPOSITION_RAIL_KEYS`, the read at
   * `components/viewport-3d.tsx` (`phase: styleState.texturePhase`), and a `0`
   * in one verify fixture. No panel control writes it and not one of the
   * preset `applies` patches sets it.
   *
   * The PLUMBING is live and correct — it reaches `evaluateLayerTime`'s
   * `LayerTiming.phase`, which adds it to the layer's final phase — so this is
   * a control that was never built, not a control that is broken. Consequence
   * worth knowing: `LayerTiming.phase` is documented as "staggers
   * otherwise-identical layers" and is 0 on EVERY layer in the whole app,
   * because the dither and ASCII call sites do not pass one at all. That whole
   * capability is unexercised.
   *
   * Flagged rather than deleted (§0.7) and rather than silently wired: the
   * layer stack already ships a "Phase offset" slider, so the pattern to copy
   * exists and this is a small panel addition — but adding a control is an
   * authoring decision with a visual pass attached, not an audit fix. Do not
   * assume it works because the field exists; that assumption is exactly how a
   * dead field becomes a dead dial.
   */
  texturePhase: number
  textureDirection: TextureDirection
  /** Per-layer timing (see lib/style-clock.ts). */
  textureSyncMode: StyleSyncMode
  textureDelay: number

  /* --- dither --- */
  ditherEnabled: boolean
  ditherAnimated: boolean
  ditherType: DitherType
  ditherScale: number
  ditherThreshold: number
  ditherContrast: number
  ditherSpeed: number
  ditherDirection: DitherDirection
  /** How strongly the dithered result replaces the smooth shading. */
  ditherIntensity: number
  /** Output tone levels. 2 = pure two-tone; higher keeps more shading. */
  ditherLevels: number
  /** Tone exposure BEFORE quantization — rescales the subject's real tonal
   * range (which never spans 0..1) onto the threshold ramp. 0 = darkest,
   * 1 = hottest. Without this a mid-tone or near-black subject sits on one
   * side of every threshold and the pattern is uniform mush. */
  ditherExposure: number
  /** Screen angle in DEGREES for the print-style maps (dot screen, hatch,
   * crosshatch, diamond, newsprint). Classic print uses 45. */
  ditherAngle: number
  /** Per-layer timing (see lib/style-clock.ts). */
  ditherSyncMode: StyleSyncMode
  ditherDelay: number
  /** Dither has its OWN lock mode — screen-space is the classic graphic look. */
  ditherLockMode: TextureLockMode

  /* --- ascii --- */
  asciiEnabled: boolean
  asciiAnimated: boolean
  asciiCharset: AsciiCharset
  asciiCellSize: number
  asciiDensity: number
  asciiContrast: number
  asciiScrollSpeed: number
  asciiDirection: AsciiDirection
  asciiAnimationType: AsciiAnimationType
  /** ASCII has its OWN lock mode; screen space is the terminal look. */
  asciiLockMode: TextureLockMode
  /** Per-layer timing (see lib/style-clock.ts). */
  asciiSyncMode: StyleSyncMode
  asciiDelay: number

/* --- layer stack --- */
  layerStackEnabled: boolean
  /** Composition-level opacity per layer, multiplied with the layer's own control. */
  stackTextureOpacity: number
  stackDitherOpacity: number
  stackAsciiOpacity: number
  /** Blend mode per post-lighting layer. Texture is part of the surface. */
  stackDitherBlend: StackBlendMode
  stackAsciiBlend: StackBlendMode
  /** Which post-lighting layer runs first. Texture is ALWAYS the base. */
  stackOrder: StackOrder
  stackAnimationEnabled: boolean
  stackAnimationType: StackAnimationType
  /**
   * Group animation rate, SIGNED. The magnitude is the rate; the SIGN is PRD
   * §4's "direction" control, and it is one field rather than two because the
   * group's motion is a single scalar phase offset — a separate `direction`
   * enum would have been a second dial multiplying into the same number, which
   * is the "two dials, one lever" shape this repo has already had to split back
   * apart once (see `fusionIntensity` / `fusionSwing`).
   *
   * The three behaviours that PRODUCE an offset — `drift`, `loop` and
   * `revealSynced` — can run backwards. Every amplitude behaviour (`fadeIn`,
   * `delayAfterReveal`, `completionPulse`) takes the MAGNITUDE only, because a
   * negative fade is not a direction, it is a fade that never arrives. The
   * panel disables the Direction control on those rather than letting it sit
   * there doing nothing. See `evaluateStackAnimation`.
   *
   * ⚠ This list used to name `revealSynced` as magnitude-only. It is not — the
   * branch is `r * DEFAULT_REVEAL_SCALE * mag * dir + phase`, so it honours
   * both the sign and the phase. The panel was always right; three separate
   * comments were wrong. See the matching note in `lib/style-stack.ts`.
   */
  stackAnimationSpeed: number
  /** Constant offset added to the group phase — PRD §4's "phase". Read by
   *  evaluateStackAnimation (pulse / drift / loop / revealSynced); the panel
   *  exposes it as "Phase offset" and disables it on the behaviours that
   *  ignore it. */
  stackAnimationPhase: number
  /**
   * GROUP OPACITY — PRD §4's "opacity", the container's own level, applied to
   * every layer in the stack at once (the Photoshop layer-group / AE precomp
   * opacity, not a fourth per-layer slider).
   *
   * It is resolved in `resolveStack` rather than in `evaluateStackAnimation`
   * because it is NOT animation: it holds whether or not the group is moving,
   * and folding it into the animation would make it vanish the moment
   * `stackAnimationEnabled` went false. Gated on `layerStackEnabled` only —
   * there is no container to set the opacity of until the stack is on.
   */
  stackAnimationOpacity: number

  /* --- fusion --- */
  fusionPreset: FusionPreset
  /** The shape of the relationship over time. See FusionDrive. */
  fusionDrive: FusionDrive
  /**
   * LEGACY MIRROR of `fusionDrive !== "loop"`, kept because several verification
   * scripts set it directly and the debug readout prints it. `resolveFusionDrive`
   * in lib/style-fusion.ts reconciles the two: `fusionDrive` wins, and a bare
   * `fusionAnimationEnabled: true` is honoured as "arc" — the shape that boolean
   * always meant. Every writer in the app sets both together, so they cannot
   * drift; nothing new should read this field.
   */
  fusionAnimationEnabled: boolean
  fusionAnimationSpeed: number
  /**
   * LINK — how strongly the driver reaches the driven parameter. 0 returns the
   * identity frame (systems unlinked, composition untouched).
   *
   * This dial used to also be the amplitude of every drive, which made it a
   * motion switch as well as a coupling depth: swept end to end on the real
   * page, five of eight presets were dead still at 0 and moving at 0.25, while
   * the other three moved at 0 anyway because their own layers were animated. So
   * one number meant two things, and a different two things per preset. The
   * amplitude half now lives in `fusionSwing`.
   */
  fusionIntensity: number
  /**
   * SWING — how far the drive's own signal travels. 0 pins every drive at its
   * resting value: the systems stay fully LINKED and still respond to the draw
   * (reveal gate) and to the completion pulse, but nothing breathes on its own.
   */
  fusionSwing: number
  /**
   * THE USER'S OWN FUSIONS. Each is a named set of authored relationships (see
   * lib/style-fusion.ts). Deliberately NOT in COMPOSITION_RAIL_KEYS: selecting
   * any other preset resets the composition rails, and a rail reset that also
   * emptied the user's library would delete their work on a stray click. The
   * SELECTION (`fusionPreset`) is a rail key and resets; the LIBRARY is not.
   */
  customFusions: CustomFusion[]
  /**
   * HIS SAVED PRESETS ("Mine"). Each one is a `StylePreset`, the same shape as a
   * shipped one, so there is one preset system and one apply path
   * (`applyPresetToStyleState`). Like `customFusions` it is a LIBRARY, not a rail
   * key: applying any preset must never empty it.
   */
  customPresets: StylePreset[]

  /* --- global sync / clock --- */
  textureLockMode: TextureLockMode
  /** Coarse user-facing motion control (top bar). See MotionMode. */
  motionMode: MotionMode
  /** Loop length in seconds shared by every layer using loopSynced. */
  styleLoopSeconds: number

  /* --- preset rails (Phase 1) ---
   * Tracks which preset family/preset is currently selected in the UI. These
   * are metadata only: selecting a preset records the IDs here and applies the
   * preset's safe `applies` patch, but never rebuilds geometry or runs an
   * effect renderer (most renderers do not exist yet). */
  activePresetFamily: PresetFamily
  activePresetId: string | null
  lastAppliedPresetId: string | null

  /* --- the flip (FLIP-3) ---
   * After the draw-in lands, the mark turns edge-on and comes back as the
   * other form, on the lab's own law (`lib/flip-pose.ts`). Absent or "off"
   * leaves the take exactly as main plays it. */
  flip?: FlipChoice
}

/**
 * DEFAULT_STYLE_STATE — conservative defaults.
 * Material is plain "ink", every visual layer is OFF, every animated system is
 * OFF, and sync is "independent". This guarantees the substrate is fully inert
 * until a later phase explicitly enables a system.
 */
export const DEFAULT_STYLE_STATE: StyleState = {
  materialPreset: "ink",
  materialUserOverride: false,
  materialAnimationEnabled: false,
  materialAnimationType: "none",
  materialAnimationSpeed: 1,
  materialAnimationIntensity: 0.5,
  // Custom-material defaults. sheenColor and emissive are deliberately NOT
  // black. Both are multiplicative partners: `sheen` scales a lobe tinted by
  // `sheenColor`, `emissiveIntensity` scales `emissive`. With a black partner
  // the slider is arithmetically dead — measured on the shipped defaults,
  // dragging Sheen 0 → 1 moved inked-pixel luminance 62.2 → 62.2, and Emissive
  // 0 → 2 moved it 65.1 → 65.1. Two of the panel's six sliders did nothing
  // until the user guessed that a different, unlabelled control had to move
  // first. Seeding a neutral colour makes both live from the first drag; a user
  // who wants them off still has the colour picker and the value stays 0.
  customMaterial: {
    color: "#2a2a2a",
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.4,
    sheen: 0.0,
    sheenColor: "#b9c8dd",
    emissive: "#8fa2b8",
    emissiveIntensity: 0,
    envMapIntensity: 1.0,
  },

  textureMode: "none",
  textureEnabled: false,
  textureAnimated: false,
  textureAnimationType: "travel",
  textureType: "none",
  textureScale: 1,
  textureIntensity: 0.5,
  textureContrast: 0.5,
  textureSpeed: 1,
  texturePhase: 0,
  textureDirection: "horizontal",
  textureSyncMode: "independent",
  textureDelay: 0,

  ditherEnabled: false,
  ditherAnimated: false,
  ditherType: "bayer4",
  // 3px threshold cells: at the old default of 1 every map was subpixel —
  // bayer read as uniform 1px mush and halftone was entirely invisible
  // (verified live, 2026-07 craft pass).
  ditherScale: 3,
  ditherThreshold: 0.5,
  ditherContrast: 0.5,
  ditherSpeed: 1,
  ditherDirection: "static",
  ditherIntensity: 1,
  ditherLevels: 2,
  ditherExposure: 0.5,
  ditherAngle: 45,
  ditherLockMode: "screen",
  ditherSyncMode: "independent",
  ditherDelay: 0,

  asciiEnabled: false,
  asciiAnimated: false,
  asciiCharset: "blocks",
  // 13px cells: at 8px a 5x5 glyph gets ~1.6px per glyph pixel, which is
  // below legibility — every charset read as woven texture, never as
  // characters (verified live, 2026-07 craft pass).
  asciiCellSize: 13,
  asciiDensity: 0.5,
  asciiContrast: 0.5,
  asciiScrollSpeed: 1,
  asciiDirection: "vertical",
  asciiAnimationType: "none",
  asciiLockMode: "screen",
  asciiSyncMode: "independent",
  asciiDelay: 0,

  layerStackEnabled: false,
  stackTextureOpacity: 1,
  stackDitherOpacity: 1,
  stackAsciiOpacity: 1,
  stackDitherBlend: "normal",
  stackAsciiBlend: "normal",
  stackOrder: "ditherFirst",
  stackAnimationEnabled: false,
  stackAnimationType: "none",
  stackAnimationSpeed: 1,
  stackAnimationPhase: 0,
  stackAnimationOpacity: 1,

  fusionPreset: "none",
  fusionDrive: "loop",
  fusionAnimationEnabled: false,
  fusionAnimationSpeed: 1,
  fusionIntensity: 0.5,
  fusionSwing: 1,
  customFusions: [],
  customPresets: [],

  textureLockMode: "object",
  motionMode: "off",
  styleLoopSeconds: 4,

  activePresetFamily: "material",
  activePresetId: null,
  lastAppliedPresetId: null,
}

/* ---------------------------- style ranges ------------------------------- */
/**
 * Every numeric leaf of a state object, named the way preset fields are named:
 * `textureSpeed`, `customMaterial.roughness`. Lists, strings, booleans and
 * nulls are not leaves here, so a colour or a mode never reads as keyable.
 */
export type NumericLeafPath<T, P extends string = ""> = {
  [K in keyof T & string]-?: NonNullable<T[K]> extends number
    ? `${P}${K}`
    : NonNullable<T[K]> extends readonly unknown[]
      ? never
      : NonNullable<T[K]> extends object
        ? NumericLeafPath<NonNullable<T[K]>, `${P}${K}.`>
        : never
}[keyof T & string]

export type StyleNumericPath = NumericLeafPath<StyleState>

/** One numeric style value's range: the slider's `min`, `max` and `step`. */
export interface StyleRange {
  min: number
  max: number
  step: number
}

/**
 * THE RANGES TABLE (K1, keyframe anything, 2026-09-26). One row per numeric
 * style value, copied from the slider in `components/style-panel-scaffold.tsx`
 * that sets it. A key outside its row is refused by `lib/keyframes.ts`, never
 * clamped. The type is a full `Record`, so a new numeric field without a row
 * fails tsc, and `scripts/verify/assert-key-paths.mjs` fails when a slider's
 * bounds and its row disagree. The sliders still write their bounds inline;
 * reading them from here is the panel phase's job.
 */
export const STYLE_RANGES: Readonly<Record<StyleNumericPath, StyleRange>> = {
  materialAnimationSpeed: { min: 0.1, max: 3, step: 0.05 },
  materialAnimationIntensity: { min: 0, max: 1, step: 0.01 },
  "customMaterial.roughness": { min: 0, max: 1, step: 0.01 },
  "customMaterial.metalness": { min: 0, max: 1, step: 0.01 },
  "customMaterial.clearcoat": { min: 0, max: 1, step: 0.01 },
  "customMaterial.sheen": { min: 0, max: 1, step: 0.01 },
  "customMaterial.emissiveIntensity": { min: 0, max: 2, step: 0.01 },
  "customMaterial.envMapIntensity": { min: 0, max: 3, step: 0.05 },
  textureScale: { min: 0.2, max: 4, step: 0.05 },
  textureIntensity: { min: 0, max: 1, step: 0.01 },
  textureContrast: { min: 0, max: 1, step: 0.01 },
  textureSpeed: { min: 0.1, max: 3, step: 0.05 },
  texturePhase: { min: 0, max: 6.28, step: 0.02 },
  textureDelay: { min: 0, max: 4, step: 0.1 },
  ditherScale: { min: 1, max: 14, step: 0.5 },
  ditherThreshold: { min: 0.15, max: 0.85, step: 0.01 },
  ditherContrast: { min: 0, max: 1, step: 0.01 },
  ditherSpeed: { min: 0.1, max: 3, step: 0.05 },
  ditherIntensity: { min: 0, max: 1, step: 0.01 },
  ditherLevels: { min: 2, max: 8, step: 1 },
  ditherExposure: { min: 0, max: 1, step: 0.01 },
  ditherAngle: { min: 0, max: 90, step: 1 },
  ditherDelay: { min: 0, max: 4, step: 0.1 },
  asciiCellSize: { min: 4, max: 24, step: 1 },
  asciiDensity: { min: 0, max: 1, step: 0.01 },
  asciiContrast: { min: 0, max: 1, step: 0.01 },
  asciiScrollSpeed: { min: 0.1, max: 3, step: 0.05 },
  asciiDelay: { min: 0, max: 4, step: 0.1 },
  stackTextureOpacity: { min: 0, max: 1, step: 0.01 },
  stackDitherOpacity: { min: 0, max: 1, step: 0.01 },
  stackAsciiOpacity: { min: 0, max: 1, step: 0.01 },
  // Signed: the slider sets the size, 0.1..3, and the Reverse control the sign,
  // so the stored value runs -3..3. A key may cross 0 to reverse the loop.
  stackAnimationSpeed: { min: -3, max: 3, step: 0.05 },
  stackAnimationPhase: { min: 0, max: 6.28, step: 0.02 },
  stackAnimationOpacity: { min: 0, max: 1, step: 0.01 },
  fusionAnimationSpeed: { min: 0.1, max: 3, step: 0.05 },
  fusionIntensity: { min: 0, max: 1, step: 0.05 },
  fusionSwing: { min: 0, max: 1, step: 0.05 },
  styleLoopSeconds: { min: 0.5, max: 12, step: 0.5 },
}

/* --------------------------- preset id shells ---------------------------- */
/**
 * Preset DEFINITION shells. These declare the available preset IDs + labels so
 * the UI can list them, but they carry NO behavior yet. Later phases attach the
 * actual material params / shader configs / charset tables here.
 */

export interface PresetShell<TId extends string> {
  id: TId
  label: string
}

export const MATERIAL_PRESETS: PresetShell<MaterialPreset>[] = [
  { id: "ink", label: "Ink" },
  { id: "softGel", label: "Soft Gel" },
  { id: "matteClay", label: "Matte Clay" },
  { id: "glossyPlastic", label: "Glossy Plastic" },
  { id: "rubber", label: "Rubber" },
  { id: "signal", label: "Signal" },
  { id: "ceramic", label: "Ceramic" },
  { id: "chalk", label: "Chalk" },
  { id: "chrome", label: "Chrome" },
  { id: "gold", label: "Gold" },
  { id: "wax", label: "Wax" },
  { id: "neon", label: "Neon" },
  { id: "iridescent", label: "Iridescent" },
  { id: "deskDoodles", label: "Desk Doodles" },
  { id: "custom", label: "Custom…" },
]

/* ====================================================================== */
/* MATERIAL PARAMS (IMPLEMENTED v1) — real surface values per preset.      */
/* ---------------------------------------------------------------------- */
/* These are the actual numbers the 3D preview applies to a               */
/* MeshPhysicalMaterial. They are intentionally on-brand (dark family),   */
/* differentiated through highlight / roughness / sheen / emissive rather */
/* than loud color. The renderer (components/viewport-3d.tsx) reads these  */
/* through `resolveMaterialParams`. Geometry never reads them.            */
/* ====================================================================== */

export interface MaterialParams {
  /** Base albedo color (hex). */
  color: string
  roughness: number
  metalness: number
  /** Physical clearcoat layer (0 disables the second specular lobe). */
  clearcoat: number
  clearcoatRoughness: number
  /** Dielectric F0 (three.js maps this to IOR). Documented to have NO EFFECT at
   *  `metalness === 1` — a metal's reflectance comes from its albedo — so the
   *  two full-metal presets (`chrome`, `gold`) leave it at the 1.0 no-op and
   *  `signalFlicker`'s reflectivity jitter is proportionally muted on `signal`
   *  (metalness 0.6). Kept as a required field rather than optional so a new
   *  dielectric preset cannot forget it. */
  reflectivity: number
  /** Soft diffuse sheen (good for gel/rubber); 0 disables. */
  sheen: number
  sheenRoughness: number
  sheenColor: string
  /** Faint self-illumination for "Signal"; "#000000" disables. */
  emissive: string
  emissiveIntensity: number
  /** How strongly the environment map reflects on this surface. Higher =
   *  glossier / more mirror-like; drives the visible difference between
   *  matte (low) and glossy/signal (high) presets. */
  envMapIntensity: number
  /** Thin-film iridescence (oil-slick color shift). Optional — only the
   *  "iridescent" preset uses it; absent means 0. */
  iridescence?: number
  iridescenceIOR?: number
  /** Thin-film thickness in nm.
   *
   *  NOT A RANGE IN PRACTICE. three.js interpolates between the two ends only
   *  when an `iridescenceThicknessMap` is bound; with no map the shader takes
   *  the MAXIMUM as a constant and ignores the minimum entirely
   *  (`lights_physical_fragment.glsl`). We bind no map, so `[1]` is the film
   *  thickness and `[0]` is decoration. Absent = three.js default [100, 400],
   *  i.e. a constant 400 nm. */
  iridescenceThicknessRange?: [number, number]
}

export const MATERIAL_PARAMS: Record<MaterialPreset, MaterialParams> = {
  // Dark glossy gel-ink: the brand default. Charcoal (not pure black) so the
  // hard clearcoat highlight has a surface to sit on and read against.
  ink: {
    color: "#26262b",
    roughness: 0.3,
    metalness: 0.0,
    clearcoat: 0.9,
    clearcoatRoughness: 0.1,
    reflectivity: 0.6,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 1.1,
  },
  // Softer, fuller balloon/gel feel: cool blue-gray, clearly lighter than ink,
  // with a wet clearcoat over a strong blue sheen so it reads as translucent
  // gel rather than "gray plastic". Live-judged: the old 0.3 clearcoat /
  // 0.8 env version was indistinguishable from a plain gray tube.
  softGel: {
    color: "#4e5a6e",
    roughness: 0.42,
    metalness: 0.0,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
    reflectivity: 0.5,
    sheen: 1.0,
    sheenRoughness: 0.45,
    sheenColor: "#a9c3e8",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 1.1,
  },
  // Matte dry clay: warm, notably light, fully rough, zero clearcoat/sheen. Reads
  // as a soft chalky surface — the clear "no highlight" opposite of glossy.
  //
  // env 0.12 → 0.85 (material craft pass). Not a look change — a units change.
  // Every envMapIntensity in this file was authored while the renderer was
  // silently discarding it (three.js only honours it when `material.envMap` is
  // set; with a scene-level environment it substitutes `scene.environmentIntensity`
  // — see docs/research/material-fusion-stack-timing-craft.md §1a). So the clay
  // everyone approved was rendering at an effective 1.0, and switching the
  // parameter on dropped it to inked-pixel luminance 61 — a dark brown, not the
  // "notably light" clay this preset is. 0.85 restores the approved appearance
  // (measured 125 vs the 133 it used to sit at) while still reading matte,
  // because matte now comes from roughness 1.0 + zero clearcoat rather than from
  // a number that never reached the GPU.
  matteClay: {
    color: "#6f6457",
    roughness: 1.0,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 1.0,
    reflectivity: 0.08,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 0.85,
  },
  // Smooth shiny plastic: kept deliberately dark so the mirror-sharp clearcoat
  // highlight + strong env reflection pop hard against it. The "wet/glossy"
  // end. Live-judged against ink on Solid: at env 1.8 the two were
  // indistinguishable — 2.8 (with the brighter studio rig) is where the wet
  // streak reflections actually appear on a stroke-sized surface.
  glossyPlastic: {
    color: "#14161c",
    roughness: 0.05,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    reflectivity: 1.0,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 2.8,
  },
  // Soft rubber: dark warm charcoal with a satin sheen band — a tire, not
  // clay. Live-judged: the old #33312f/0.92 version collapsed into matteClay
  // at stroke size; darker base + tighter sheen separates them.
  rubber: {
    color: "#2c2927",
    roughness: 0.82,
    metalness: 0.0,
    clearcoat: 0.04,
    clearcoatRoughness: 0.95,
    reflectivity: 0.15,
    sheen: 1.0,
    sheenRoughness: 0.6,
    sheenColor: "#8f7d68",
    emissive: "#000000",
    emissiveIntensity: 0,
    // 0.4 → 0.7: restores the luminance rubber was approved at (58.5) once
    // envMapIntensity actually reached the GPU — see matteClay above.
    envMapIntensity: 0.7,
  },
  // Digital "signal": metallic teal with a clear cool emissive so it reads
  // screen-lit. The most chromatic of the original set.
  signal: {
    color: "#16242c",
    roughness: 0.2,
    metalness: 0.6,
    clearcoat: 0.6,
    clearcoatRoughness: 0.16,
    reflectivity: 0.8,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#1f6e8c",
    emissiveIntensity: 1.0,
    envMapIntensity: 1.6,
  },
  // Glazed porcelain: cool blue-grey body under a hard WET glaze.
  //
  // BODY VALUE IS THE GLAZE (material craft pass). This preset was the worst
  // collapse in the family — closest pair to `chalk` at every view and every
  // mode — and roughness 0.12 / clearcoat 1.0 could not save it, because the
  // problem was never the surface. Perceived gloss tracks the SKEWNESS of the
  // luminance histogram (Motoyoshi, Nishida, Sharan & Adelson, Nature 447,
  // 2007): glossy = mostly dark with a small very bright tail. A body already
  // at 226/255 has nothing below the highlight, so the histogram is clipped and
  // cannot skew, and "hard glaze" renders as flat paper-white.
  //
  // Measured, holding roughness/clearcoat/env fixed and moving ONLY the body:
  //   #e2e6ea  lum 238  specular headroom  5.0   skew -3.32   (the old value)
  //   #aab3bf  lum 226                    14.3   skew -2.54
  //   #8e99a8  lum 215                    24.5   skew -2.21
  //   #727e8e  lum 198                    41.8   skew -1.54
  //   #5a6675  lum 177                    64.0   skew -0.44
  // Eight times the specular headroom for 40 points of body value. #77828f sits
  // where the glaze reads hard and the preset still reads as a pale ceramic
  // rather than a grey one. Separation from chalk is now genuinely double-coded
  // — temperature (cool vs warm-dusty) AND specular structure — instead of
  // being two near-white strokes.
  ceramic: {
    color: "#77828f",
    roughness: 0.10,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 0.9,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 1.3,
  },
  // Bone-dry chalk/plaster: warm dusty white, ZERO specular — and a soft
  // powder sheen. Real chalk isn't just "no highlight": fine dust scatters
  // light back at grazing angles, a faint velvety rim bloom. That bloom (a
  // sheen lobe, nothing to do with gloss) is what makes chalk read as a
  // SUBSTANCE head-on instead of "ceramic minus the highlight".
  chalk: {
    color: "#e7e2d6",
    roughness: 1.0,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 1.0,
    reflectivity: 0.03,
    sheen: 0.4,
    sheenRoughness: 0.85,
    sheenColor: "#fdf8ee",
    emissive: "#000000",
    emissiveIntensity: 0,
    // 0.05 → 0.5: chalk is the family's pale WARM preset, and at a genuine 0.05
    // it fell to luminance 159 — a mid warm grey, not "dusty white". 0.5 keeps
    // it pale while ceramic moves the other way, so the two pale presets now
    // separate on value AND surface instead of both sitting at 225+.
    envMapIntensity: 0.5,
  },
  // Polished chrome: full metal, near-mirror. The surface IS the environment —
  // nothing else in the family behaves like this.
  chrome: {
    color: "#f4f5f7",
    roughness: 0.03,
    metalness: 1.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.5,
    reflectivity: 1.0,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 2.8,
  },
  // Brushed gold/brass: warm colored metal with a softer reflection than
  // chrome — reads as jewelry, not mirror.
  gold: {
    color: "#d4a437",
    roughness: 0.24,
    metalness: 1.0,
    clearcoat: 0.0,
    clearcoatRoughness: 0.5,
    reflectivity: 1.0,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 1.8,
  },
  // Amber wax: warm honey body, soft wet-ish coat, waxy bloom sheen. The
  // "organic soft" preset that is neither gel (cool) nor clay (dry).
  wax: {
    color: "#b8863f",
    roughness: 0.55,
    metalness: 0.0,
    clearcoat: 0.45,
    clearcoatRoughness: 0.35,
    reflectivity: 0.4,
    sheen: 0.5,
    sheenRoughness: 0.5,
    sheenColor: "#e8c98f",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 0.7,
  },
  // Neon tube: emissive-dominant hot pink over a near-black body — the stroke
  // reads as a light source. Honest label: this glows, it does not bloom
  // (no post-processing pass exists).
  //
  // emissive 2.4 → 1.1 (material craft pass). Emissive is added AFTER shading
  // and is not tone-mapped away, so past a point it stops adding glow and
  // starts erasing the tube: the whole form clips to one flat pink silhouette,
  // and clipping the red channel first also DESATURATES the hue. Measured
  // across the intensity sweep (specular headroom = form survival, chroma =
  // colour survival):
  //   2.4  lum 173  headroom  55.6  chroma 108   ← flat decal
  //   1.8  lum 157  headroom  70.4  chroma 128
  //   1.0  lum 124  headroom 101.2  chroma 159
  //   0.6  lum  96  headroom 127.8  chroma 159
  // Lower is better on BOTH axes until the glow itself goes. 1.1 keeps the
  // stroke unmistakably self-lit while the tube stays a tube.
  neon: {
    color: "#1a0b10",
    roughness: 0.4,
    metalness: 0.0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    reflectivity: 0.5,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#ff2d6f",
    emissiveIntensity: 1.1,
    envMapIntensity: 0.4,
  },
  // Oil-slick: thin-film iridescence over dark METAL gloss — the reflection
  // color shifts with view angle. Unique mechanism (iridescence), not a tint.
  // Two of the three levers are right and stay:
  //   - metalness up — the colored film modulates a strong reflection
  //     instead of a weak dielectric one;
  //   - roughness down — interference colors are coherent only on a smooth
  //     film; roughness smears them back to gray.
  //
  // THE THIRD LEVER WAS BACKWARDS. The previous note claimed the range was
  // "widened to 120–800 nm so the film sweeps several interference ORDERS
  // across one curved tube". It does not. three.js only interpolates the range
  // when an `iridescenceThicknessMap` is bound; with no map the shader uses the
  // MAXIMUM as a constant film thickness and discards the minimum. So that edit
  // did exactly one thing — moved a constant from 400 nm to 800 nm — and moved
  // it the wrong way. Hue comes from FIRST-order interference; past it the
  // fringes pack together until the spectral pre-integration averages them to
  // grey (Belcour & Barla 2017: "the effect eventually converges toward a thick
  // film look where the colours fade to gray"). Measured, sweeping the constant
  // and reporting mean per-pixel saturation % / mean-RGB spread:
  //   150 nm  13.3 /  5.3     350 nm  25.9 /  6.0
  //   200 nm  25.1 / 10.7     420 nm  27.2 /  2.4
  //   250 nm  36.0 / 20.2     550 nm  29.1 /  8.6
  //   300 nm  32.5 / 16.1     800 nm  26.7 /  3.2   ← the old value
  // 250 nm is the peak on both. In the frames it is the only setting that puts
  // a saturated blue-cyan across the body with warm pink/gold at the grazing
  // edges — an actual angle-dependent hue SHIFT. 800 nm renders a fine pastel
  // speckle that averages to milky grey, which is why this preset measured at
  // chroma 3.5 and read as "dark glossy" rather than oil-slick.
  iridescent: {
    color: "#101216",
    roughness: 0.06,
    metalness: 0.65,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.9,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 2.6,
    iridescence: 1.0,
    iridescenceIOR: 1.8,
    // [0] is inert without a thickness map; [1] IS the film thickness.
    iridescenceThicknessRange: [120, 250],
  },
  // Custom — the editable base. Starts as a neutral mid surface; the actual
  // values come from styleState.customMaterial (merged in resolveMaterialParams).
  // Desk Doodles' surface. Surface-identical to `matteClay` above — same
  // roughness 1.0, zero clearcoat, zero sheen, reflectivity 0.08 (near
  // index-matched, so there is almost no Fresnel to catch) and the same low
  // envMapIntensity. The ONLY difference is the colour: matteClay's clay-tan
  // #6f6457 becomes graphite — Desk Doodles' own `#2A2622` until 2026-08-04,
  // `#272727` since. The deviation and the four-arm measurement that forced it
  // are on `deskDoodles.color` below; the short version is that the second half
  // of the law in the next paragraph is the half that broke.
  //
  // That is not a coincidence. Desk Doodles forked this exact preset and
  // re-coloured it to its single ratified ink — its own source says so
  // ("FS matteClay #6f6457 → ratified single ink"). Its 3D law is that every
  // preset renders in ONE graphite ink and presets may differ only in
  // surface qualities, never in hue or value, because the whole aesthetic is
  // one pencil: value comes from light and mark density, never from a tint.
  //
  // Kept as its own entry rather than expressed through `custom` because
  // CustomMaterial cannot override `reflectivity`, and the custom base pins it
  // at 0.5 (ior ≈ 1.5). At 0.08 the ior is ≈ 1.07 — the difference is a visible
  // grazing-angle specular that would quietly make this read glossier than
  // Desk Doodles ever renders.
  deskDoodles: {
    /* THE INK WAS THE BROWN. Sebs 2026-08-04: *"the 3d version is also too
     * brown, should still feel black."*
     *
     * `#2A2622` — Desk Doodles' `INK_3D_DEFAULT` — is where 84% of it was, and
     * the reason is a mechanism rather than a mistake. Diffuse shading is
     * `albedo × irradiance`: a MULTIPLY. The ink's chromaticity is fixed
     * (linear R/B 1.447), so raising the form's VALUE raises its CHROMA in
     * lockstep. At a drawing's value that chroma is invisible — the flat mark
     * measures interior luma 20.6, Δr−b 8, CIELAB C* 3.1, and reads black. When
     * `HERO_LIT.envGain` went 1 → 3.6 to fix *"super subtle when it switches to
     * 3D"*, the lit form went to median 46.3 with its brightest decile at 80,
     * and the SAME chromaticity arrived as Δr−b 23.9 / C* 9.4 — brown. Nothing
     * turned warm; the exposure went up and dragged the hue into view.
     *
     * That is the register's own law being broken, verbatim: *"One pencil.
     * Matte ink, value from light — never hue, never gloss."* (lib/registers.ts).
     * You cannot raise value from light without raising chroma unless the
     * albedo is neutral. So the albedo is neutral.
     *
     * MEASURED, four arms on the real page at the beat's own `solid` playhead,
     * eroded interior, `_probe-brown-decile.mjs` (frames in
     * docs/verification/brown-hunt/):
     *
     *   arm                                        brightest decile Δr−b   p90 C*   median
     *   #2A2622, rig warm       (what he saw)              23.92            8.84     46.3
     *   #2A2622, rig neutral                               20.90            7.63     46.3
     *   #282623, rig neutral    (family axis, Δ5)          13.33            5.08     45.5
     *   #272727, rig neutral    <- SHIPPED                  0.63            0.69     47.0
     *
     * AND THE PICK IS THE EYE'S, NOT THE TABLE'S. At 1:1 on the real page
     * `#282623` — the linear midpoint of Desk Doodles' own ratified
     * `INK_3D_RANGE` (`#121110`–`#383632`), i.e. the most token-disciplined
     * warm option available — still reads as dark khaki, not graphite. Halving
     * a violation is not closing it. `#272727` reads as black graphite at every
     * pose measured.
     *
     * LUMINANCE-MATCHED, so this is a hue change and nothing else: `#2A2622`
     * carries linear luminance 0.01994 and `#272727` carries 0.02029 — the
     * nearest 8-bit neutral, 1.8% apart. The tonal arrival `assert-hero-switch`
     * row 1 protects is untouched (median 46.3 → 47.0, inside §9.1's 45–63).
     *
     * ⚠ TOKEN DISCIPLINE, stated rather than glossed. Invariant I-9 is *"never
     * invents tokens"*, and `#272727` is not in the W1 ramp. Two things make it
     * the right call anyway. First, the north star it defers to is *"the entire
     * aesthetic is MONOCHROME — black + grayscale"*, which `#272727` satisfies
     * and `#2A2622` does not. Second, the ratified ink was ratified as a DARK
     * token: `INK_3D_RANGE` tops out at `#383632`, luma 54. This form now runs
     * to luma 92. `#2A2622` was never ratified at the value it is being asked
     * to hold, and at that value it is not graphite.
     *
     * BOTH PRIORS ARE PARKED, not deleted — `DESK_DOODLES_INK_PRIOR` and
     * `DESK_DOODLES_INK_FAMILY_AXIS` below, the first live-switchable. */
    color: "#272727",
    roughness: 1.0,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 1.0,
    reflectivity: 0.08,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    // 0.12 → 0.45. Desk Doodles' LOOK is the fixed point here, not its number:
    // this preset is a port and its rendered value was ratified elsewhere. It
    // was approved at inked-pixel luminance ~29.5, which is what it produced
    // back when the renderer was substituting environmentIntensity 1.0 for
    // whatever this field said. Honouring 0.12 dropped it to 7 — a black smear
    // with no readable form at all (specular headroom 6.9, i.e. no highlight to
    // shape it). 0.9 reproduces the ratified appearance. The surface qualities
    // stay identical to matteClay as the port
    // requires; only the environment weight differs, because the two presets
    // sit at different body values and matte-ness is now carried by roughness.
    envMapIntensity: 0.9,
  },
  custom: {
    color: "#2a2a2a",
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.4,
    clearcoatRoughness: 0.3,
    reflectivity: 0.5,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 1.0,
  },
}

/**
 * MODE_MATERIAL_DEFAULTS — sensible per-mode default material. Applied only
 * when the user has NOT explicitly chosen a material (`materialUserOverride`
 * false). Switching modes uses these; a user override always wins. Geometry is
 * never touched by this map.
 */
export const MODE_MATERIAL_DEFAULTS: Record<GeometryModeId, MaterialPreset> = {
  rod: "ink",
  extrude: "glossyPlastic",
  solid: "matteClay",
  inflate: "softGel",
}

/** UI list of animated-material v1 types (POST_MVP_MATERIAL_AND_ANIMATION). */
export const MATERIAL_ANIMATION_TYPES: PresetShell<MaterialAnimationType>[] = [
  { id: "none", label: "None" },
  { id: "shineSweep", label: "Shine Sweep" },
  { id: "gelShimmer", label: "Gel Shimmer" },
  { id: "roughnessPulse", label: "Roughness Pulse" },
  { id: "completionFlash", label: "Completion Flash" },
  { id: "signalFlicker", label: "Signal Flicker" },
]

/**
 * Resolve the static base params for a preset (clone so callers can mutate).
 * When preset === "custom", the user's editable `customMaterial` is merged over
 * the custom base so the live surface reflects the sliders.
 */
/**
 * THE PRESET YOU JUST PICKED, AS THE STARTING POINT OF THE EDITOR.
 *
 * PRD §6, verbatim: a preset is *"understandable, visually distinct, EDITABLE
 * AFTER SELECTION, mode-aware, safe by default, not overloaded"*, and §16's
 * guardrail says presets *"never … replace editable controls"*. The material
 * rail failed both, and the audit found the exact shape of the failure: the
 * only editable material is `custom`, and `customMaterial` is a fixed default
 * block that has no relationship to whatever preset was on screen. So "edit
 * Soft Gel" meant "discard Soft Gel and start from an unrelated grey" — the
 * preset was not editable after selection, it was a dead end with a readout.
 *
 * This is the two lines that fix it: fork the RESOLVED params of the live
 * preset into the custom block, so the sliders open exactly where the preset
 * left off and the first drag is a nudge rather than a reset. The dropped
 * fields (clearcoatRoughness, reflectivity, sheenRoughness, iridescence) are
 * the ones `CustomMaterial` has no control for; they fall back to the custom
 * preset's own defaults, which is why this returns a patch rather than
 * pretending to be a lossless conversion.
 */
export function materialParamsToCustom(p: MaterialParams): CustomMaterial {
  return {
    color: p.color,
    roughness: p.roughness,
    metalness: p.metalness,
    clearcoat: p.clearcoat,
    sheen: p.sheen,
    sheenColor: p.sheenColor,
    emissive: p.emissive,
    emissiveIntensity: p.emissiveIntensity,
    envMapIntensity: p.envMapIntensity,
  }
}

/**
 * THE INK SEBS CALLED BROWN — parked, not deleted, and RENDERABLE.
 *
 * Desk Doodles' `INK_3D_DEFAULT`, which `deskDoodles.color` carried until
 * 2026-08-04. Reachable live in dev through the SAME switch that parks the
 * studio rig's pre-neutral palette — `window.__studioRigLaw = "prior"` — so one
 * flag reproduces the exact picture he was looking at, rig and ink together,
 * and a gate can be shown a build it must reject instead of only the build it
 * was written for.
 *
 * ⚠ ONE KNOB, TWO READERS, AND NO IMPORT BETWEEN THEM. `components/studio-rig.tsx`
 * reads the same global for its own tables. They are deliberately not coupled
 * through an import — a `lib/` module importing a `components/` one to read a
 * dev flag is a worse dependency than two files agreeing on one documented
 * name. If the name ever changes it must change in both, and both say so.
 *
 * ⚠ WHAT THE PRIOR ARM DOES NOT FLIP: the flat 2D mark. `app/desk-doodles/page.tsx`
 * reads `MATERIAL_PARAMS[preset].color` straight off the table for `flatInkColor`
 * rather than through this resolver, so the drawing keeps the shipped ink in
 * both arms. That is the right scope for the rows this arm exists to control —
 * they measure the LIT SOLID's chroma — and it is stated here so nobody reads
 * the arm as a whole-page time machine.
 */
export const DESK_DOODLES_INK_PRIOR = "#2A2622"

/**
 * THE MIDDLE OPTION, kept because it is a real one and Sebs's call, not mine.
 *
 * The linear-light midpoint of Desk Doodles' ratified `INK_3D_RANGE`
 * (`#121110`–`#383632`), luminance-matched to `#2A2622`: Δr−b 5, linear R/B
 * 1.262 against the shipped ink's 1.447. It is the most token-disciplined warm
 * ink available — it sits on the ratified family's OWN chromatic axis, which
 * `#2A2622` (R/B 1.447) never did, being warmer than either end of its own
 * range.
 *
 * It halves the violation and does not close it: brightest-decile Δr−b 13.33
 * against neutral's 0.63, and at 1:1 the form reads dark khaki rather than
 * graphite (docs/verification/brown-hunt/D-ink-familyaxis/). Recorded so the
 * warm-graphite identity is a choice on the board rather than a thing that was
 * quietly dropped — swap it into `deskDoodles.color` to take it.
 */
export const DESK_DOODLES_INK_FAMILY_AXIS = "#282623"

/** Dev-only: is the parked pre-2026-08-04 look being rendered? See
 *  `DESK_DOODLES_INK_PRIOR`. */
function priorInkLaw(): boolean {
  if (process.env.NODE_ENV === "production") return false
  return (globalThis as unknown as { __studioRigLaw?: unknown }).__studioRigLaw === "prior"
}

export function resolveMaterialParams(
  preset: MaterialPreset,
  custom?: CustomMaterial,
): MaterialParams {
  const base = { ...MATERIAL_PARAMS[preset] }
  if (preset === "deskDoodles" && priorInkLaw()) base.color = DESK_DOODLES_INK_PRIOR
  if (preset === "custom" && custom) {
    return {
      ...base,
      color: custom.color,
      roughness: custom.roughness,
      metalness: custom.metalness,
      clearcoat: custom.clearcoat,
      sheen: custom.sheen,
      sheenColor: custom.sheenColor,
      emissive: custom.emissive,
      emissiveIntensity: custom.emissiveIntensity,
      envMapIntensity: custom.envMapIntensity,
    }
  }
  return base
}

export const TEXTURE_MODES: PresetShell<TextureMode>[] = [
  { id: "none", label: "None" },
  { id: "procedural", label: "Procedural" },
  { id: "grain", label: "Grain" },
  { id: "noise", label: "Noise" },
  { id: "scanlines", label: "Scanlines" },
  { id: "bands", label: "Bands" },
  { id: "contour", label: "Contour" },
  { id: "crosshatch", label: "Crosshatch" },
  { id: "dots", label: "Ink Dots" },
  { id: "woodgrain", label: "Woodgrain" },
  { id: "cellular", label: "Cellular" },
  { id: "brushed", label: "Brushed" },
  { id: "craquelure", label: "Craquelure" },
  { id: "ripple", label: "Ripple" },
]

export const DITHER_PRESETS: PresetShell<DitherType>[] = [
  { id: "bayer4", label: "Bayer 4x4" },
  { id: "bayer8", label: "Bayer 8x8" },
  { id: "blueNoise", label: "Blue Noise" },
  { id: "halftone", label: "Halftone" },
  { id: "lines", label: "Lines" },
  { id: "dotScreen", label: "Dot Screen 45" },
  { id: "hatch", label: "Hatch" },
  { id: "crosshatch", label: "Crosshatch" },
  { id: "diamond", label: "Diamond" },
  { id: "newsprint", label: "Newsprint" },
]

export const ASCII_PRESETS: PresetShell<AsciiCharset>[] = [
  { id: "blocks", label: "Blocks" },
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "dots", label: "Dots" },
  { id: "custom", label: "Custom" },
  { id: "braille", label: "Braille" },
  { id: "boxes", label: "Box Lines" },
  { id: "arrows", label: "Arrows" },
  { id: "punct", label: "Punctuation" },
  { id: "numeric", label: "Numerals" },
]

export const FUSION_PRESETS: PresetShell<FusionPreset>[] = [
  { id: "none", label: "None" },
  { id: "terminalGel", label: "Terminal Gel" },
  { id: "ditherBloom", label: "Dither Bloom" },
  { id: "signalInk", label: "Signal Ink" },
  { id: "asciiRubber", label: "ASCII Rubber" },
  { id: "scanlineBalloon", label: "Scanline Balloon" },
  { id: "pixelClay", label: "Pixel Clay" },
  { id: "codeBloom", label: "Code Bloom" },
  { id: "glitchRibbon", label: "Glitch Ribbon" },
  { id: "viewTurn", label: "Turn Table" },
  { id: "slowWeather", label: "Slow Weather" },
  { id: "formation", label: "Formation" },
  { id: "wholeCloth", label: "Whole Cloth" },
  { id: "stillWet", label: "Still Wet" },
  { id: "letterpress", label: "Letterpress" },
]

/* ====================================================================== */
/* PRESET RAILS (Phase 1) — product structure for future style systems.   */
/* ---------------------------------------------------------------------- */
/* These declare the full preset catalog as DATA. Each preset says which   */
/* family it belongs to, whether it shows in the UI (`enabled`), and       */
/* whether its renderer actually exists yet (`implemented`). Right now only */
/* the material family is `implemented` — it maps to the existing          */
/* `materialPreset` state. Everything else is a definition shell so the     */
/* product surface is in place before the renderers land.                  */
/* ====================================================================== */

export type PresetFamily =
  | "geometry"
  | "material"
  | "animatedMaterial"
  /**
   * PRD Family 15 — view / export presets. NOT a style family: its patch names
   * a CAMERA framing and an EXPORT intent, neither of which lives in StyleState.
   * See `ViewPresetPatch` and `resolveViewPreset` for what a member carries and
   * `PRESET_FAMILY_OPTIONS` for why it is not yet on the rail.
   */
  | "view"
  | "texture"
  | "animatedTexture"
  | "dither"
  | "animatedDither"
  | "ascii"
  | "animatedAscii"
  | "layerStack"
  | "stackAnimation"
  | "fusion"
  | "animatedFusion"
  | "geometryAnimation"

export type GeometryModeId = "rod" | "extrude" | "solid" | "inflate"

/* ====================================================================== */
/* PRD FAMILY 1 — GEOMETRY PRESETS.                                        */
/* ---------------------------------------------------------------------- */
/* A geometry preset is the ONE preset family that does not live in        */
/* StyleState. It names a MODE and that mode's dials, and both of those    */
/* are React state in app/page.tsx (`geometryMode`, `extrudeParams`,       */
/* `solidParams`, `inflateParams`, `widthSlider`). So the family is data + */
/* a pure resolver here, and the four lines that apply it are app/page.tsx's.  */
/*                                                                          */
/* WHY IT IS SHAPED AS A PATCH AND NOT AS AN `applies` OBJECT. Every other  */
/* family's patch is `Partial<StyleState>` and is merged by                */
/* `applyPresetToStyleState`. A geometry patch cannot be, because a style   */
/* merge can never reach a different useState hook. Giving it its own type  */
/* means the compiler stops anyone from quietly listing `geometryMode` in a */
/* style patch and assuming it took effect — which is exactly how a preset  */
/* that does nothing gets shipped.                                          */
/* ====================================================================== */

/** Extrude dials a geometry preset may set. Mirrors `ExtrudeParams` minus
 *  `width`, which travels as `widthSlider` (a normalised t) because that is
 *  the control the user actually has; the raw half-width is derived from it by
 *  `mapExtrudeWidthSlider`. Fields omitted keep whatever the user had. */
export interface GeometryExtrudePatch {
  /** Normalised width slider t in [0,1] — NOT the raw half-width. */
  widthSlider?: number
  /** Depth-to-width MULTIPLIER, range [0.1, 4.0]. */
  depth?: number
  bevelEnabled?: boolean
  sideWall?: "straight" | "drafted"
}

/** Solid / Inflate share the thickness+depth pair (see app/page.tsx — the
 *  Inflate strip drives `solidParams` too). Raw slider units. */
export interface GeometrySolidPatch {
  /** Raw px, range [4, 64]. */
  thickness?: number
  /** World units, range [0.02, 0.5]. */
  depth?: number
}

export interface GeometryInflatePatch {
  fusion?: "auto" | "loft" | "implicit"
  /** Smooth-min blend radius, range [0, 1.5]. */
  blend?: number
  /** Marching-cubes cells per stroke radius, range [2, 8]. */
  resolution?: number
  loopEnds?: "wrapped" | "capped"
}

/**
 * The whole of what a geometry preset asks for. `mode` is mandatory: a
 * geometry preset that did not name a mode would be a set of dials whose
 * meaning depends on where the user happened to be standing, and "Solid
 * Cutout" has to mean Solid.
 */
export interface GeometryPresetPatch {
  mode: GeometryModeId
  extrude?: GeometryExtrudePatch
  solid?: GeometrySolidPatch
  inflate?: GeometryInflatePatch
}

/* ====================================================================== */
/* PRD FAMILY 14 — GEOMETRY ANIMATION PRESETS.                             */
/* ---------------------------------------------------------------------- */
/* Same separation as Family 1 and Family 15, and for the same reason: a    */
/* take is not style state. `drawIn`, `revealWindow` and `revealEnvelope`   */
/* live in `lib/stroke-schedule.ts` and are held by `app/page.tsx`, so      */
/* `applyPresetToStyleState` cannot reach them and refuses the family       */
/* outright rather than pretending. Read this with `resolveMotionPreset`.   */
/*                                                                          */
/* ⚠ WHY THESE SAT AS SHELLS FOR WEEKS. Two of the three objects below did  */
/* not exist in a form a preset could name: the playback envelope was four  */
/* loose `useState` calls inside components/viewport-3d.tsx until           */
/* 2026-08-28. A preset cannot patch what has no name.                      */
/* ====================================================================== */

export interface MotionPresetPatch {
  drawIn?: Partial<DrawInParams>
  revealWindow?: Partial<RevealWindowParams>
  envelope?: Partial<RevealEnvelopeParams>
}

/* ====================================================================== */
/* PRD FAMILY 15 — VIEW / EXPORT PRESETS.                                  */
/* ---------------------------------------------------------------------- */
/* Same shape of problem as Family 1, one storey further away: the camera   */
/* is `controlsRef` inside components/viewport-3d.tsx and the export is     */
/* `handleExportGLB` / `handleExportPNG` in the same file. Neither is       */
/* reachable from style state, and two of the PRD's four members name       */
/* capabilities that do not exist ANYWHERE in the app yet (a turntable, and */
/* a video/frame-sequence export). The resolver below is therefore the      */
/* honest half: it says exactly what each preset wants, in the units the    */
/* existing `__captureHarness.orbitView(az, el, fillK)` already speaks, so  */
/* the framings can be — and are — measured before the button exists.       */
/* ====================================================================== */

/** What a view preset asks the CAMERA for. Angles in degrees, matching
 *  `__captureHarness.orbitView(azimuthDeg, elevationDeg, fillK)`; `fill` is
 *  the same distance multiplier (smaller = closer). */
export interface ViewCameraPatch {
  azimuthDeg: number
  elevationDeg: number
  /** Distance multiplier on the bounds radius. 1.0 fits the form. */
  fill: number
  /**
   * Turntable rate in degrees per second. `0` = a still framing.
   *
   * ✅ BUILT — `components/viewport-3d.tsx` (`spinDegPerSecond` / `effectiveSpin`,
   * search "THE TURNTABLE") converts it to `OrbitControls.autoRotateSpeed`
   * (`2π/60 · speed` rad/s, i.e. 6°/s per unit) and vetoes it under
   * `prefers-reduced-motion`. It used to say "NOT IMPLEMENTED ANYWHERE ...
   * components/viewport-3d.tsx:4768", and that sentence outlived the defect by
   * long enough for `assert-view-presets` to go red naming it a STALE BLOCKER.
   */
  spinDegPerSecond?: number
}

/** What a view preset asks the EXPORT path for. */
export interface ViewExportPatch {
  /**
   * "glb"  — the existing `handleExportGLB` binary glTF.
   * "png"  — the existing `handleExportPNG` still.
   * "video" — ⚠ NOT IMPLEMENTED ANYWHERE. There is no frame-sequence or video
   *           export in this app; PRD §12 puts it at export v4. Reported by
   *           `viewPresetBlockers()`.
   */
  target: "glb" | "png" | "video"
  /** Ask the preview to sit at a clean state for the export (no style layers
   *  that the target cannot carry). GLB carries material metadata only —
   *  texture / dither / ASCII are screen-space and are export v3. */
  cleanPreview?: boolean
}

export interface ViewPresetPatch {
  camera: ViewCameraPatch
  export?: ViewExportPatch
}

export interface StylePreset {
  id: string
  label: string
  family: PresetFamily
  description?: string
  bestModes?: GeometryModeId[]
  /** Appears in the UI list. */
  enabled: boolean
  /** Actually changes rendered behavior. When false, selecting it only records
   *  metadata + applies safe state fields; it must NOT pretend to work. */
  implemented: boolean
  /** Reserved: preset that only affects preview, never export. */
  previewOnly?: boolean
  /** Safe partial StyleState patch applied on selection. Must never include
   *  fields that trigger geometry rebuilds (there are none of those here). */
  applies?: Partial<StyleState>
  /**
   * Family 1 only. The MODE + dials this preset asks for. Deliberately a
   * separate field from `applies`: it is not style state and cannot be applied
   * by `applyPresetToStyleState`, which refuses the family outright rather than
   * pretending. Read it with `resolveGeometryPreset`.
   */
  geometry?: GeometryPresetPatch
  /** Family 15 only. Camera framing + export intent. Read it with
   *  `resolveViewPreset`; same separation and same reason as `geometry`. */
  view?: ViewPresetPatch
  /** Family 14 only. The take: order, window and playback envelope. Read it
   *  with `resolveMotionPreset`; same separation and same reason again. */
  motion?: MotionPresetPatch
}

/* --- geometry (PRD Family 1) ---------------------------------------------
 *
 * THE ONE MEMBER OF THE PRD's SIX THAT IS NOT HERE, AND WHY.
 *
 *   "Bold Rod" is REFUSED, not deferred. Rod has no dials at all: its radius
 *   is the module constant `TUBE_RADIUS = 0.012` (lib/geometry-engines.ts:211),
 *   read directly at every call site (`:1437`, `:1500`, `:1523`), and the
 *   engine's own comment states it plainly — "Rod has no per-mode params"
 *   (lib/geometry-engines.ts:1220). `ROD_TUNING` publishes only `adaptive` and
 *   `loopEnds`, neither of which is a weight. So a "Bold Rod" preset could
 *   differ from "Clean Rod" in NOTHING: same mode, same constant, byte-identical
 *   render. Shipping it would be a pill whose name promises a heavier stroke and
 *   whose behaviour is a no-op — the exact defect this family was dispatched to
 *   fix, reintroduced by the fix. It ships when a rod weight dial exists; the
 *   three-file diff for that is in this lane's return.
 *
 * WHAT EVERY MEMBER BELOW HAD TO CLEAR: it names a mode, it moves at least one
 * dial that mode actually reads, and it is measurably distinct from every other
 * member in the same mode (scripts/verify/assert-geometry-presets.mjs drives
 * each patch through the real `__styleHarness` setters and reports the full
 * pairwise matrix, with a same-patch-twice control that has to come back
 * COLLAPSED or the instrument is blind).
 *
 * `enabled: false` on every one of them is deliberate and is the §0.7-safe
 * state, not an oversight: `PRESET_FAMILY_OPTIONS` does not list this family,
 * so nothing renders these pills, because the four lines that apply a geometry
 * patch live in app/page.tsx and this lane does not own that file. An enabled
 * pill that cannot reach the geometry state is precisely the landmine the six
 * geometry-ANIMATION pills already were. Flip `enabled` and add the family to
 * PRESET_FAMILY_OPTIONS in the same commit as the app/page.tsx routing, never before.
 */
export const GEOMETRY_PRESET_DEFS: StylePreset[] = [
  {
    id: "cleanRod",
    label: "Clean Rod",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "The plain 3D ink tube: gesture first, no dials in the way.",
    geometry: { mode: "rod" },
  },
  {
    id: "ribbonStrip",
    label: "Ribbon Strip",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "A shallow calligraphic strip: broad face, barely any depth.",
    // Depth is a MULTIPLIER of width (EXTRUDE_DEPTH_MULTIPLIER_*, default 1.0),
    // so 0.45 is a ribbon that is wider than it is deep: the broad face the PRD
    // wants dither and scanlines to land on.
    geometry: {
      mode: "extrude",
      extrude: { widthSlider: 0.62, depth: 0.45, bevelEnabled: true, sideWall: "straight" },
    },
  },
  {
    id: "deepRibbon",
    label: "Deep Ribbon",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "The same strip stood on edge. Depth well past its width.",
    geometry: {
      mode: "extrude",
      extrude: { widthSlider: 0.4, depth: 2.8, bevelEnabled: true, sideWall: "straight" },
    },
  },
  {
    id: "pressedRibbon",
    label: "Pressed Ribbon",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "Walls tapered toward the back face: the moulded, pressed read.",
    geometry: {
      mode: "extrude",
      extrude: { widthSlider: 0.74, depth: 1.15, bevelEnabled: true, sideWall: "drafted" },
    },
  },
  {
    id: "dieCutEdge",
    label: "Die-Cut Edge",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "Bevel off: a hard ninety-degree edge, stamped not moulded.",
    geometry: {
      mode: "extrude",
      extrude: { widthSlider: 0.55, depth: 1.0, bevelEnabled: false, sideWall: "straight" },
    },
  },
  {
    id: "hairlineRibbon",
    label: "Hairline Ribbon",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "Thin and tall. A drawn line that happens to have a side.",
    geometry: {
      mode: "extrude",
      extrude: { widthSlider: 0.1, depth: 2.2, bevelEnabled: false, sideWall: "straight" },
    },
  },
  {
    id: "solidCutout",
    label: "Solid Cutout",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "Filled silhouette with its counters cut out, on a shallow plate.",
    geometry: { mode: "solid", solid: { thickness: 34, depth: 0.12 } },
  },
  {
    id: "paperCut",
    label: "Paper Cut",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "Near-flat cutout: the silhouette reads, the depth barely does.",
    geometry: { mode: "solid", solid: { thickness: 20, depth: 0.04 } },
  },
  {
    id: "thickSlab",
    label: "Thick Slab",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "Heavy silhouette on a deep plate. The counters start to close.",
    geometry: { mode: "solid", solid: { thickness: 60, depth: 0.42 } },
  },
  {
    id: "softBalloonStroke",
    label: "Soft Balloon Stroke",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "Pressure-filled volume that merges where the stroke crosses itself.",
    // `implicit` is the strategy that actually MERGES crossings (the loft is
    // per-stroke), which is what makes this read as one inflated body rather
    // than as overlapping sausages — so the fusion choice is the preset, not a
    // performance setting.
    geometry: {
      mode: "inflate",
      solid: { thickness: 44, depth: 0.34 },
      inflate: { fusion: "implicit", blend: 0.75, resolution: 4.5 },
    },
  },
  {
    id: "pillowInflate",
    label: "Pillow",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "Over-inflated and softly welded. Air, not ink.",
    geometry: {
      mode: "inflate",
      solid: { thickness: 58, depth: 0.46 },
      inflate: { fusion: "implicit", blend: 1.15, resolution: 5 },
    },
  },
  {
    id: "loftBalloon",
    label: "Loft Balloon",
    family: "geometry",
    enabled: true,
    implemented: true,
    description: "The fast per-stroke loft. Each stroke keeps its own body.",
    geometry: {
      mode: "inflate",
      solid: { thickness: 40, depth: 0.26 },
      inflate: { fusion: "loft" },
    },
  },
]

/* --- view / export (PRD Family 15) ---------------------------------------
 * See `ViewPresetPatch`. Same `enabled: false` rule and the same reason as the
 * geometry family, one storey worse: the camera and the export live in
 * components/viewport-3d.tsx.
 *
 * TWO of the PRD's four members used to name capabilities that did not exist
 * anywhere in the app. NEITHER DOES NOW, and both closed the same way — the
 * capability was built by another lane and this table went on reporting it as
 * missing afterwards.
 *
 *   · THE TURNTABLE (2026-08-03). Built and filmed at Δpx 72.64 spin-ON against
 *     0.00 OFF while `viewPresetBlockers()` still said "OrbitControls is mounted
 *     without autoRotate". That is not a harmless stale sentence:
 *     `presetIsSelectable` reads the blocker list, so a preset that works was
 *     unclickable, and `components/style-panel-scaffold.tsx` had grown a
 *     string-prefix filter to undo it from the other side — a cross-module
 *     coupling that was literally a string.
 *   · VIDEO (2026-08-03, later the same day). Its blocker said "no writer
 *     exists"; `lib/export/` had carried a WebCodecs WebM encoder with a
 *     lossless APNG fallback for two days and the viewport had been exposing
 *     `exportVideo` beside `exportGLB`/`exportPNG` alongside it. The blocker was
 *     corrected to name the true gap — one missing `else if` in
 *     `applyViewPresetById` — and then that line was written, so the entry is
 *     `implemented` and the blocker is gone with it. Half-fixing it (correcting
 *     the sentence, leaving the route) is what the previous pass deliberately
 *     did and it is why this note exists twice.
 *
 * The pattern is the same both times and it is the one to watch for: a table
 * that describes the tree, kept by hand, in a repo where the tree moves. That is
 * why `assert-preset-registry` and `assert-style-contracts` now READ app/page.tsx
 * and components/viewport-3d.tsx for the closing capability instead of trusting
 * either field here — a stale claim in this file turns those rows red.
 *
 * A member that is still waiting on a capability carries its ask honestly in
 * the patch and is reported by `viewPresetBlockers()`; it is NOT dressed up as
 * a still framing so the rail can look complete. There are none left. */
export const VIEW_PRESET_DEFS: StylePreset[] = [
  {
    id: "portfolioSpin",
    label: "Portfolio Spin",
    family: "view",
    enabled: true,
    /* WAS `false`, ALONGSIDE A BLOCKER THAT WAS ALSO WRONG — and the pair is
     * why nothing caught it. `assert-preset-registry`'s row is
     * `implemented === has no blocker`; with BOTH halves stale it read green,
     * and correcting either one alone turns it red. Two wrongs holding a gate
     * up. The turntable is built (see `spinDegPerSecond`), filmed at Δpx 72.64
     * with spin ON against 0.00 with it OFF, so both halves move together. */
    implemented: true,
    description: "Three-quarter hold, turning slowly. The loop a portfolio plays.",
    view: {
      camera: { azimuthDeg: 35, elevationDeg: 18, fill: 1.05, spinDegPerSecond: 12 },
    },
  },
  {
    /* THE FRAMING WAS WRONG AND THE GATE CAUGHT IT — worth keeping, because the
     * mistake is one anybody would make from the name alone.
     *
     * This first shipped as azimuth 0 / elevation 89, i.e. literally straight
     * down the Y axis, and the description said "the mark as a flat graphic".
     * The mark is NOT in the XZ plane. The user draws on a canvas, so the mark
     * lives in XY and the depth runs along Z — which makes a down-the-Y-axis
     * shot the EDGE view. Measured on the real camera: 0.667% coverage against
     * 1.617% dead-on, i.e. the "flat graphic" framing showed the mark as a
     * thin line, the exact opposite of what its name promises, and it read as a
     * plausible shot rather than as a bug.
     *
     * "Top-down" in a drawing-to-3D tool means looking at the PAGE, and the
     * page is the screen plane. So the flat graphic read is 0/0. */
    id: "topDownMark",
    label: "Top-Down Mark",
    family: "view",
    enabled: true,
    implemented: true,
    description: "Straight onto the page. The mark read as the flat drawing it came from.",
    view: { camera: { azimuthDeg: 0, elevationDeg: 0, fill: 1.0 } },
  },
  {
    id: "glbCleanExport",
    label: "GLB Clean Export",
    family: "view",
    enabled: true,
    implemented: true,
    description: "Front-on, framed tight, style layers off. What the GLB carries.",
    view: {
      camera: { azimuthDeg: 0, elevationDeg: 0, fill: 1.0 },
      export: { target: "glb", cleanPreview: true },
    },
  },
  {
    id: "videoPreviewExport",
    label: "Video Preview Export",
    family: "view",
    enabled: true,
    implemented: true,
    /* THE DESCRIPTION IS THE WARNING, AND THAT IS DELIBERATE.
     *
     * `presetIsSelectable` puts this string in the pill's `title`, and the rail
     * prints it under the pills for the active member — so it is the only text a
     * user sees BEFORE clicking. Every other view preset moves a camera and is
     * instant; this one renders every frame of the draw-in and writes a file,
     * which takes seconds and puts something in the Downloads folder. A control
     * that does that has to say so first, in its own label, not in a toast
     * afterwards. The sibling export members say the same kind of thing
     * ("written out as a PNG with alpha"); this one has more to declare because
     * it costs more. */
    description:
      "Three-quarter framing, then the whole draw-in is rendered frame by frame and saved as a video file: a few seconds of work, and it downloads when it is done.",
    view: {
      camera: { azimuthDeg: 24, elevationDeg: 12, fill: 1.15 },
      export: { target: "video" },
    },
  },
  {
    /* Replaces a "Front Elevation" member this lane had drafted at 0/0/1.0.
     * Once `topDownMark`'s framing was corrected the two were the same shot,
     * and two pills pointing the camera at one place is the collapse the
     * distinctness matrix exists to catch. It never shipped and was never
     * reachable — this lane's own scratch, not a prior option §0.7 protects. */
    id: "overheadPlan",
    label: "Overhead Plan",
    family: "view",
    enabled: true,
    implemented: true,
    description: "Down onto the page from above. The mark plus the top faces of its depth.",
    view: { camera: { azimuthDeg: 0, elevationDeg: 42, fill: 1.05 } },
  },
  {
    id: "threeQuarterHero",
    label: "Three-Quarter Hero",
    family: "view",
    enabled: true,
    implemented: true,
    description: "The standard hero angle. Depth visible on both the face and the side.",
    view: { camera: { azimuthDeg: 38, elevationDeg: 22, fill: 1.05 } },
  },
  {
    id: "rakingProfile",
    label: "Raking Profile",
    family: "view",
    enabled: true,
    implemented: true,
    description: "Almost edge-on. The shot that shows how deep the form really is.",
    view: { camera: { azimuthDeg: 78, elevationDeg: 6, fill: 1.0 } },
  },
  {
    id: "stillFrameExport",
    label: "Still Frame Export",
    family: "view",
    enabled: true,
    implemented: true,
    description: "Three-quarter, framed loose, written out as a PNG with alpha.",
    view: {
      camera: { azimuthDeg: 32, elevationDeg: 16, fill: 1.2 },
      export: { target: "png" },
    },
  },
]

/* --- material (IMPLEMENTED: maps to existing materialPreset state) --- */
export const MATERIAL_PRESET_DEFS: StylePreset[] = [
  { id: "ink", label: "Ink", family: "material", enabled: true, implemented: true, applies: { materialPreset: "ink" } },
  { id: "softGel", label: "Soft Gel", family: "material", enabled: true, implemented: true, applies: { materialPreset: "softGel" }, bestModes: ["inflate", "solid"] },
  { id: "matteClay", label: "Matte Clay", family: "material", enabled: true, implemented: true, applies: { materialPreset: "matteClay" }, bestModes: ["solid", "extrude"] },
  { id: "glossyPlastic", label: "Glossy Plastic", family: "material", enabled: true, implemented: true, applies: { materialPreset: "glossyPlastic" }, bestModes: ["inflate"] },
  { id: "rubber", label: "Rubber", family: "material", enabled: true, implemented: true, applies: { materialPreset: "rubber" }, bestModes: ["inflate", "rod"] },
  { id: "signal", label: "Signal", family: "material", enabled: true, implemented: true, applies: { materialPreset: "signal" }, bestModes: ["rod", "extrude"] },
  { id: "ceramic", label: "Ceramic", family: "material", enabled: true, implemented: true, description: "White porcelain under a hard glaze.", applies: { materialPreset: "ceramic" }, bestModes: ["solid", "inflate"] },
  { id: "chalk", label: "Chalk", family: "material", enabled: true, implemented: true, description: "Bone-dry plaster. Warm, dusty, zero shine.", applies: { materialPreset: "chalk" }, bestModes: ["solid"] },
  { id: "chrome", label: "Chrome", family: "material", enabled: true, implemented: true, description: "Full-metal mirror. The surface is the room.", applies: { materialPreset: "chrome" }, bestModes: ["extrude", "inflate"] },
  { id: "gold", label: "Gold", family: "material", enabled: true, implemented: true, description: "Warm polished brass-gold metal.", applies: { materialPreset: "gold" }, bestModes: ["extrude", "solid"] },
  { id: "wax", label: "Wax", family: "material", enabled: true, implemented: true, description: "Amber honey-wax with a soft bloom.", applies: { materialPreset: "wax" }, bestModes: ["inflate", "solid"] },
  { id: "neon", label: "Neon", family: "material", enabled: true, implemented: true, description: "Self-lit hot-pink tube (glow, no post bloom).", applies: { materialPreset: "neon" }, bestModes: ["rod"] },
  { id: "iridescent", label: "Iridescent", family: "material", enabled: true, implemented: true, description: "Oil-slick thin film. Swirling multi-hue shift.", applies: { materialPreset: "iridescent" }, bestModes: ["inflate", "extrude"] },
]

/* --- animated material (PRD Family 3) ------------------------------------
 *
 * THE INVERSE FAILURE, and this family was the clearest case of it: the
 * renderer has been live since Phase 10 (`evaluateMaterialAnimation` below,
 * five behaviours), the panel has had type / speed / intensity for as long, and
 * `PRESET_REGISTRY.animatedMaterial` was `[]`. The PRD calls the family
 * "(built)" — the SYSTEM is; the PRESET RAIL never existed, so the good
 * combinations of three dials lived only in whoever had found them.
 *
 * WHAT MAKES A MEMBER HERE LEGITIMATE RATHER THAN A SPEED VARIANT. Each one
 * has to be measurably distinct from every other member (assert-preset-
 * families.mjs drives the real selection path and reports the pairwise matrix),
 * and it has to be distinct for a reason a viewer could name. Two presets that
 * differ only by a number that the renderer ignores are the worst kind: see the
 * note on `completionFlash` in `evaluateMaterialAnimation`, where `speed` was
 * genuinely unread until this pass wired it into the decay — which is why there
 * are two completionFlash members here at different SPEEDS and not one.
 *
 * THESE ARE MATERIAL-FAMILY PRESETS, so `applyPresetToStyleState` leaves the
 * whole composition (texture / dither / ASCII / stack / fusion) untouched. They
 * write the four `materialAnimation*` fields and nothing else — including the
 * ones they want at rest, so picking a second preset can never inherit the
 * first one's speed.
 */
export const ANIMATED_MATERIAL_PRESET_DEFS: StylePreset[] = [
  {
    id: "shineSweepAcross",
    label: "Shine Sweep",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    description: "A band of highlight travels along the form, once per pass.",
    bestModes: ["extrude", "rod"],
    applies: {
      materialAnimationEnabled: true,
      materialAnimationType: "shineSweep",
      materialAnimationSpeed: 1,
      materialAnimationIntensity: 0.55,
    },
  },
  {
    id: "slowGlassSweep",
    label: "Slow Glass",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    description: "The same travelling band, three times slower and far wetter.",
    bestModes: ["extrude", "solid"],
    applies: {
      materialAnimationEnabled: true,
      materialAnimationType: "shineSweep",
      materialAnimationSpeed: 0.3,
      materialAnimationIntensity: 0.95,
    },
  },
  {
    id: "gelShimmerBreath",
    label: "Gel Shimmer",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    description: "The velvet sheen swells and recedes, light passing through.",
    bestModes: ["inflate", "solid"],
    applies: {
      materialAnimationEnabled: true,
      materialAnimationType: "gelShimmer",
      materialAnimationSpeed: 1,
      materialAnimationIntensity: 0.5,
    },
  },
  {
    id: "deepGelBloom",
    label: "Deep Gel Bloom",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    description: "A long, full shimmer. The body glows from inside at the peak.",
    bestModes: ["inflate"],
    applies: {
      materialAnimationEnabled: true,
      materialAnimationType: "gelShimmer",
      materialAnimationSpeed: 0.4,
      materialAnimationIntensity: 1,
    },
  },
  {
    id: "roughnessPulseWet",
    label: "Roughness Pulse",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    description: "Dry matte to wet gloss and back. The surface gets rained on.",
    bestModes: ["solid", "extrude"],
    applies: {
      materialAnimationEnabled: true,
      materialAnimationType: "roughnessPulse",
      materialAnimationSpeed: 1,
      materialAnimationIntensity: 0.5,
    },
  },
  {
    id: "wetClayBreath",
    label: "Wet Clay Breath",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    description: "A slow, deep soak. Clay darkening almost to black at the trough.",
    bestModes: ["solid"],
    applies: {
      materialAnimationEnabled: true,
      materialAnimationType: "roughnessPulse",
      materialAnimationSpeed: 0.3,
      materialAnimationIntensity: 1,
    },
  },
  {
    id: "completionFlashOne",
    label: "Completion Flash",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    description: "One struck-bell flash the moment the stroke finishes drawing.",
    applies: {
      materialAnimationEnabled: true,
      materialAnimationType: "completionFlash",
      materialAnimationSpeed: 1,
      materialAnimationIntensity: 0.7,
    },
  },
  {
    id: "completionAfterglow",
    label: "Completion Afterglow",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    // Speed is what makes this a different EVENT and not a dimmer one: it
    // divides the decay clock, so the flash hangs on for seconds instead of
    // snapping shut. That dial was inert on this behaviour until this pass.
    description: "The same flash, held. It lingers instead of snapping shut.",
    applies: {
      materialAnimationEnabled: true,
      materialAnimationType: "completionFlash",
      materialAnimationSpeed: 0.18,
      materialAnimationIntensity: 1,
    },
  },
  {
    id: "signalFlickerFault",
    label: "Signal Flicker",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    description: "A screen-lit surface on a bad circuit. Jitter plus hard blinks.",
    bestModes: ["rod", "extrude"],
    applies: {
      materialAnimationEnabled: true,
      materialAnimationType: "signalFlicker",
      materialAnimationSpeed: 1,
      materialAnimationIntensity: 0.5,
    },
  },
  {
    id: "dyingTube",
    label: "Dying Tube",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    description: "Slower, deeper, closer to failing. The blinks land like drop-outs.",
    bestModes: ["rod"],
    applies: {
      materialAnimationEnabled: true,
      materialAnimationType: "signalFlicker",
      materialAnimationSpeed: 0.35,
      materialAnimationIntensity: 1,
    },
  },
  {
    // An explicit OFF belongs on a rail whose every other member turns
    // something on. Without it the only way back to a still surface is to know
    // that a dropdown two panels away has a "none" in it.
    id: "stillSurface",
    label: "Still Surface",
    family: "animatedMaterial",
    enabled: true,
    implemented: true,
    description: "No surface animation. The material sits still.",
    applies: {
      materialAnimationEnabled: false,
      materialAnimationType: "none",
      materialAnimationSpeed: 1,
      materialAnimationIntensity: 0.5,
    },
  },
]

/* --- dither (IMPLEMENTED v1 — threshold renderer is live) ---
 * Dither presets only ever write dither* state: never textureMode, never
 * ascii*. Dither = THRESHOLD/tonal reduction, a different machine from
 * texture (pattern) and ascii (glyphs). */
export const DITHER_PRESET_DEFS: StylePreset[] = [
  {
    id: "bayerClassic",
    label: "Bayer Classic",
    family: "dither",
    enabled: true,
    implemented: true,
    description: "Ordered 4x4 Bayer threshold. The clean computational look.",
    applies: {
      ditherEnabled: true,
      ditherType: "bayer4",
      ditherScale: 3,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherContrast: 0.55,
      ditherThreshold: 0.5,
      // EVERY PRESET ON BOTH DITHER RAILS NOW DECLARES ITS EXPOSURE.
      // None of them used to, so all ten silently inherited the state default
      // of 0.5 and the dial that decides where a screen's tone window sits was
      // never a design decision on this rail — while the same dither inside a
      // Layer Stack preset sets it deliberately (0.18 on ceramic, 0.9 on ink).
      // The rails cannot copy those numbers, because a rail preset writes only
      // its own family's fields and therefore does not know what material it
      // will land on. What it CAN do is state the tone it is composed for, so
      // the value is reviewable and the preset differs from its neighbour on
      // purpose. See the "what the rails still cannot do" note below.
      ditherExposure: 0.46,
      ditherLockMode: "screen",
    },
  },
  {
    id: "dotMatrix",
    label: "Dot Matrix",
    family: "dither",
    enabled: true,
    implemented: true,
    description: "Halftone dots that grow with tone, like print.",
    bestModes: ["solid", "extrude"],
    applies: {
      ditherEnabled: true,
      ditherType: "halftone",
      ditherScale: 6,
      ditherLevels: 2,
      ditherIntensity: 1,
      // Higher contrast than the rest of the rail because this is the one
      // preset whose whole point is DOT SIZE VARYING WITH TONE, and dot size
      // only starts varying across the form once the window is narrow
      // (sweep_solid_dotMatrix.png, bottom-right quadrant).
      ditherContrast: 0.72,
      ditherThreshold: 0.5,
      // Lighter than neutral: a print halftone should leave the paper visible
      // between dots so the dots have somewhere to grow into.
      ditherExposure: 0.48,
      ditherLockMode: "screen",
    },
  },
  {
    id: "hardThreshold",
    label: "Hard Threshold",
    family: "dither",
    enabled: true,
    implemented: true,
    description: "Line-growth threshold, high contrast two-tone.",
    applies: {
      ditherEnabled: true,
      ditherType: "lines",
      ditherScale: 4,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherContrast: 0.8,
      ditherThreshold: 0.5,
      // Slightly heavy: "hard threshold" should commit to ink.
      ditherExposure: 0.42,
      ditherLockMode: "screen",
    },
  },
  {
    id: "softDither",
    label: "Soft Dither",
    family: "dither",
    enabled: true,
    implemented: true,
    description: "Noise-threshold dither at more tone levels. Least aggressive.",
    applies: {
      ditherEnabled: true,
      ditherType: "blueNoise",
      ditherScale: 2,
      ditherLevels: 4,
      ditherIntensity: 0.75,
      // The widest window on the rail, deliberately: this is the "least
      // aggressive" preset, and a wide window is exactly what makes a screen
      // sit flat and quiet instead of modelling. Four tone levels then carry
      // what modelling there is.
      ditherContrast: 0.35,
      ditherThreshold: 0.5,
      ditherExposure: 0.52,
      ditherLockMode: "screen",
    },
  },
  {
    id: "pixelSignal",
    label: "Pixel Signal",
    family: "dither",
    enabled: true,
    implemented: true,
    description: "A coarse pixel grid, quantised to three steps: a low-res signal, not a two-tone cut.",
    bestModes: ["rod", "extrude"],
    applies: {
      ditherEnabled: true,
      ditherType: "bayer8",
      ditherScale: 8,
      ditherLevels: 3,
      ditherIntensity: 1,
      ditherContrast: 0.5,
      ditherThreshold: 0.5,
      ditherExposure: 0.5,
      ditherLockMode: "screen",
    },
  },
]

/* WHAT THE DITHER RAIL STILL CANNOT DO, stated so nobody re-derives it.
 *
 * A dither is a tone quantiser, so where its window belongs depends entirely
 * on the tone of the surface underneath it — and the surface is chosen
 * somewhere else. Selecting a geometry mode picks the material
 * (MODE_MATERIAL_DEFAULTS: rod -> ink, extrude -> glossyPlastic,
 * solid -> matteClay, inflate -> softGel), and those four do not render at the
 * same value. So one fixed `ditherExposure` per preset is a compromise across
 * four materials by construction, and no amount of tuning removes that.
 *
 * The Layer Stack and Fusion presets do not have the problem, because they pin
 * a material AND an exposure together as one composition — which is exactly why
 * their exposures range from 0.18 to 0.9 while everything on this rail sits
 * near 0.5. Same dither, same shader, different amount of information.
 *
 * The real fix is auto-exposure: derive the window centre from the material
 * actually in use rather than from a constant, so `ditherExposure` becomes a
 * relative offset. That needs a measured reference tone per material and is a
 * change to what the dial MEANS, so it is deliberately not smuggled in here.
 * See docs/research/screen-space-layer-quality.md. */

/* --- animated dither (IMPLEMENTED v1) ---
 * Animated dither = THRESHOLD MOTION (the matrix/threshold moves), which is a
 * different thing from animated texture (pattern motion) and animated ascii
 * (glyph motion).
 *
 * YOU CANNOT TRANSLATE AN ORDERED MATRIX AND CALL IT MOTION.
 *
 * This is a property of dithering, not a bug we can tune away, and it decides
 * which type each preset on this rail is allowed to use.
 *
 * `fsDitherThreshold` (lib/dither-shader.ts) splits into two families:
 *
 *   DISCONTINUOUS in the coordinate — bayer4/bayer8 (`fsBayer`, an ordered
 *   matrix indexed by integer cell) and blueNoise (`fsIGN(floor(co))`). What
 *   makes these good dithers is precisely that ADJACENT CELLS HOLD MAXIMALLY
 *   DIFFERENT THRESHOLDS. So translating one by a cell replaces every pixel's
 *   threshold with an uncorrelated value: the pattern does not move, it
 *   re-rolls. And because it is indexed by `floor`, nothing happens at all in
 *   between: the image is frozen, then inverts, then freezes again.
 *
 *   CONTINUOUS in the coordinate — halftone, lines, dotScreen, hatch,
 *   crosshatch, diamond. These are smooth functions of position, so translating
 *   them is genuine travel, at any speed, with sub-pixel increments.
 *
 * MEASURED, at the true 120Hz display rate over 300 frames, on the Solid engine
 * (docs/verification/layer-flicker/before/flicker-report.json, produced by
 * scripts/verify/assert-layer-flicker.mjs):
 *
 *   Dither Crawl (bayer4, translated)   frozen 94.6% of frames, p95 jump 45.1,
 *                                       6.4 updates/sec  -> STROBE
 *   Diagonal Matrix Drift (bayer8)      frozen 73.6%, p95 jump 15.1  -> JUDDER
 *   Threshold Sweep (bayer8, NOT        frozen 48.8%, p95 jump 1.04,
 *   translated — bias motion instead)   travel/jump 77   -> smooth
 *
 * Six full-amplitude pattern inversions per second is the worst band there is
 * for perceived flicker. The fix is not a slower crawl — the step size is a full
 * quantum regardless of rate — so the two translating presets moved to
 * continuous screens, and the ordered matrices stay where they work: STILL
 * (bayerClassic / pixelSignal on the static rail) or animated through the
 * tone bias with a static direction (Threshold Sweep). */
export const ANIMATED_DITHER_PRESET_DEFS: StylePreset[] = [
  {
    id: "ditherCrawl",
    label: "Dither Crawl",
    family: "animatedDither",
    enabled: true,
    implemented: true,
    description: "An angled dot screen crawls slowly across the frame.",
    applies: {
      ditherEnabled: true,
      ditherAnimated: true,
      // dotScreen, NOT bayer4 — see the note above this rail. The clustered
      // angled dot is continuous in the coordinate, so the same diagonal
      // translation that made bayer4 invert 6x/sec now reads as the lattice
      // sliding. New to both dither rails (static: bayer4 / halftone / lines /
      // blueNoise / bayer8), so this stays a distinct look, not a duplicate.
      ditherType: "dotScreen",
      ditherScale: 3,
      ditherLevels: 2,
      ditherIntensity: 1,
      // Halved (0.5 -> 0.25). Cell screens multiply scale by 2.4 in the shader,
      // so scale 3 is a 7.2px lattice; at speed 0.5 that travelled 3 lattice
      // periods a second, which is a shimmer, not the "drifts slowly" this
      // preset advertises. 0.25 gives 1.5 periods/sec (~11px/sec, 0.09px per
      // frame at 120Hz) — continuous, and slow enough to read as a drift.
      ditherSpeed: 0.25,
      // The animated rail declares its tone window too. Before this pass none
      // of the five did, so a crawling matrix and a static one could not be
      // compared: they were being judged at whatever window the last preset
      // left behind.
      ditherContrast: 0.55,
      ditherThreshold: 0.5,
      ditherExposure: 0.46,
      ditherDirection: "diagonal",
      ditherLockMode: "screen",
      motionMode: "independent",
    },
  },
  {
    id: "thresholdSweep",
    label: "Threshold Sweep",
    family: "animatedDither",
    enabled: true,
    implemented: true,
    description: "The threshold BIAS oscillates. Tone opens and closes.",
    applies: {
      ditherEnabled: true,
      ditherAnimated: true,
      ditherType: "bayer8",
      ditherScale: 4,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherSpeed: 0.8,
      ditherContrast: 0.6,
      ditherThreshold: 0.5,
      ditherExposure: 0.46,
      ditherDirection: "static",
      ditherLockMode: "screen",
      motionMode: "independent",
    },
  },
  {
    id: "revealDither",
    label: "Reveal Dither",
    family: "animatedDither",
    enabled: true,
    implemented: true,
    description: "A faceted diamond screen opens as the geometry draws in.",
    applies: {
      ditherEnabled: true,
      ditherAnimated: true,
      // diamond, NOT bayer4 — and this one is about the RESTING state, not the
      // motion. A reveal-driven layer is finished when the playhead is at 1, so
      // its threshold bias sweep, (1 - reveal) * 0.42, is legitimately zero at
      // rest. But it was a bayer4 at scale 3, which is bayerClassic's exact
      // configuration, so at rest it rendered PIXEL-IDENTICAL to a preset on the
      // static rail: cross-rail Δ 0.000 on both Solid and Extrude
      // (scripts/verify/assert-screen-layers.mjs). Two tiles in the UI, one
      // frame. Anyone browsing the rails at rest — which is how they are
      // browsed — sees a duplicate and correctly concludes the option does
      // nothing.
      //
      // A reveal preset has to be worth looking at after its reveal, because
      // that is where it spends almost all of its life. diamond is an L1
      // distance screen whose points touch first, so it is the only faceted
      // option on either rail and it is unused by all ten other presets
      // (bayer4 / halftone / lines / blueNoise / bayer8 static, dotScreen /
      // hatch / bayer8 / halftone animated).
      ditherType: "diamond",
      ditherScale: 4,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherSpeed: 1,
      ditherContrast: 0.62,
      ditherThreshold: 0.5,
      ditherExposure: 0.46,
      ditherDirection: "static",
      ditherLockMode: "screen",
      motionMode: "syncToDraw",
    },
  },
  {
    id: "completionPulseDither",
    label: "Completion Pulse Dither",
    family: "animatedDither",
    enabled: true,
    implemented: true,
    description: "Halftone dots pulse open as the reveal completes, then settle.",
    applies: {
      ditherEnabled: true,
      ditherAnimated: true,
      ditherType: "halftone",
      ditherScale: 6,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherSpeed: 1.2,
      // Higher contrast than Reveal Dither so the pulse has a visible tone
      // window to swing THROUGH; at the rail's usual 0.55 the burst moved the
      // bias inside a window wide enough to swallow it.
      ditherContrast: 0.72,
      ditherThreshold: 0.5,
      ditherExposure: 0.48,
      ditherDirection: "static",
      // THE PULSE LIVES HERE, not in motionMode. `motionMode` is the coarse
      // user control; `resolveSyncMode` maps "syncToDraw" onto `revealSynced`
      // for any layer that has not opted into a more specific reveal behaviour
      // (lib/style-clock.ts). This preset had not, so it resolved to exactly
      // the same mode as Reveal Dither above it and never pulsed at all —
      // measured across all four engines, it rendered byte-identical to the
      // STATIC Dot Matrix preset (docs/verification/screen-layers/before:
      // dOff 48.034 / 22.434 / 9.809 / 37.642, matching Dot Matrix's numbers
      // to three decimals on every one).
      ditherSyncMode: "completionPulse",
      ditherLockMode: "screen",
      motionMode: "syncToDraw",
    },
  },
  {
    id: "diagonalMatrixDrift",
    // Relabelled: it is no longer a matrix, and a label that names the mechanism
    // has to name the one actually running. The id is unchanged because the
    // verification harnesses select by id.
    label: "Diagonal Screen Drift",
    family: "animatedDither",
    enabled: true,
    implemented: true,
    description: "An angled hatch screen drifts diagonally across the form.",
    applies: {
      ditherEnabled: true,
      ditherAnimated: true,
      // hatch, NOT bayer8 — same reason as Dither Crawl (see the note above
      // this rail): translating an ordered matrix re-rolls it instead of moving
      // it. Measured at bayer8: frozen 73.6% of frames with 15.1-amplitude
      // jumps. A hatch is an angled line screen with a triangle profile, so it
      // is continuous along the travel direction and genuinely drifts. Distinct
      // from Dither Crawl's round dot lattice. Both types are new to THIS rail
      // (which ran bayer4 / bayer8 / halftone only); each also appears once in
      // the Layer Stack rail — hatch in gildedStack, dotScreen in
      // porcelainPrintStack — but STATIC and inside a whole composition, so
      // neither reads as a duplicate of a moving screen on its own.
      ditherType: "hatch",
      ditherScale: 5,
      ditherLevels: 2,
      ditherIntensity: 1,
      // 1.5 -> 0.3. Scale 5 is a 12px hatch period after the shader's x2.4 for
      // cell screens; at 1.5 the screen crossed 9 periods a second, which on a
      // regular line pattern is where travel turns into wagon-wheel shimmer.
      // 0.3 is 1.8 periods/sec — the drift the name promises.
      ditherSpeed: 0.3,
      ditherContrast: 0.7,
      ditherThreshold: 0.5,
      ditherExposure: 0.46,
      ditherDirection: "diagonal",
      ditherLockMode: "screen",
      motionMode: "independent",
    },
  },
]

/* --- ascii (IMPLEMENTED v1 — glyph renderer is live) ---
 * ASCII presets write only ascii* state. ASCII = GLYPHS, a third machine
 * distinct from texture (pattern) and dither (threshold).
 *
 * CELL SIZE IS IN DEVICE PIXELS, AND EVERY PRESET USED TO BE BELOW LEGIBILITY.
 *
 * `asciiCellSize` divides `gl_FragCoord`, which is in FRAMEBUFFER pixels, so
 * the number is device pixels — on a 2x display a 9px cell is 4.5 CSS px. The
 * glyph inside it is a 5x5 bitfield, so 9px gives 1.8 device pixels per glyph
 * pixel. Every one of the eleven presets on the two ASCII rails shipped at
 * 8-11px while the state default, three Layer Stack presets and four Fusion
 * presets all sat at 12-22 — the two rails whose entire purpose is showing
 * glyphs were the only place that never got the fix.
 *
 * What it actually looked like: docs/verification/screen-layers/before/sheets/
 * solid_ascii_macro.png — all five static presets render as one uniform woven
 * texture. Not "hard to read as characters": not characters at all.
 *
 * THE FLOOR, derived from this shader rather than from a source. A glyph pixel
 * is sampled with floor(), so it is a hard square of exactly cell/5 device
 * pixels. To render a 1-bit stroke as a stroke you need an on-off-on triple to
 * survive, which takes at least ~3 device pixels per glyph pixel, i.e. a cell
 * of ~15. The eleven presets were giving 1.6-2.2, which is under two device
 * pixels per glyph pixel: at that size neighbouring lit and unlit bits merge
 * and every alphabet converges on the same grey weave, which is precisely what
 * the before frames show. 16 is the family floor and the denser alphabets get
 * more room.
 *
 * Cross-check, and the reason to trust the frames over the number: the same
 * ~15px arithmetic says the DEFAULT of 13 was also under the floor, and the
 * default was itself the output of an earlier craft pass that measured 8px as
 * "1.6px per glyph pixel, below legibility". Two passes have now landed on the
 * same mechanism from different directions.
 *
 * NOT YET GROUNDED IN A SOURCE: whether a published acuity threshold (minimum
 * legible x-height in device pixels for bitmap type) agrees with ~15. That
 * question is open in docs/research/screen-space-layer-quality.md; nothing here
 * depends on the answer, since the failure was measured directly.
 *
 * The cost is honest and was weighed: a bigger cell means fewer cells across a
 * narrow limb of the stroke, and on Rod it means ASCII cannot work at all (see
 * binarySkin's bestModes below). Legibility wins, because a glyph layer that
 * does not render glyphs has no reason to exist. */
export const ASCII_PRESET_DEFS: StylePreset[] = [
  {
    id: "terminalShade",
    label: "Terminal Shade",
    family: "ascii",
    enabled: true,
    implemented: true,
    description: "Classic .:-=+*#%@ brightness ramp. Ten levels of character density.",
    applies: {
      asciiEnabled: true,
      asciiCharset: "classic",
      asciiCellSize: 18,
      asciiDensity: 0.55,
      asciiContrast: 0.55,
      asciiLockMode: "screen",
    },
  },
  {
    id: "binarySkin",
    label: "Binary Skin",
    family: "ascii",
    enabled: true,
    implemented: true,
    description: "Only 0 and 1. Digital / signal feel.",
    // NOT rod. A legible glyph needs a cell in the mid-teens of device pixels
    // (see the note above this rail) and a Rod limb is only about 25 device
    // pixels across at the default thickness, so the grid gets one and a half
    // cells to work with and the tube renders as a dark noodle with a few
    // marks on it (docs/verification/screen-layers/sweep/sheets/
    // sweep_rod_terminalShade.png — fifteen dial combinations, all of them
    // that). Recommending rod here was recommending the one mode where this
    // layer structurally cannot render.
    bestModes: ["extrude", "solid"],
    applies: {
      asciiEnabled: true,
      asciiCharset: "minimal",
      asciiCellSize: 16,
      asciiDensity: 0.6,
      asciiContrast: 0.6,
      asciiLockMode: "screen",
    },
  },
  {
    id: "blockGlyph",
    label: "Block Glyph",
    family: "ascii",
    enabled: true,
    implemented: true,
    description: "Shade blocks. Chunkiest, most graphic.",
    bestModes: ["solid", "inflate"],
    applies: {
      asciiEnabled: true,
      asciiCharset: "blocks",
      asciiCellSize: 20,
      asciiDensity: 0.5,
      asciiContrast: 0.5,
      asciiLockMode: "screen",
    },
  },
  {
    id: "codeMarks",
    label: "Code Marks",
    family: "ascii",
    enabled: true,
    implemented: true,
    description: "Bracket and slash marks. Reads like source code.",
    applies: {
      asciiEnabled: true,
      asciiCharset: "custom",
      asciiCellSize: 17,
      asciiDensity: 0.55,
      asciiContrast: 0.55,
      asciiLockMode: "screen",
    },
  },
  {
    id: "sparseGlyph",
    label: "Sparse Glyph",
    family: "ascii",
    enabled: true,
    implemented: true,
    description: "Dot field at low density. Subtle overlay.",
    applies: {
      asciiEnabled: true,
      asciiCharset: "dots",
      asciiCellSize: 16,
      asciiDensity: 0.34,
      asciiContrast: 0.45,
      asciiLockMode: "screen",
    },
  },
]

/* --- animated ascii (IMPLEMENTED v1) ---
 * Animated ASCII = GLYPH motion. Each preset drives a different
 * `asciiAnimationType`, so they are distinct behaviours, not one effect at
 * five speeds. */
export const ANIMATED_ASCII_PRESET_DEFS: StylePreset[] = [
  {
    id: "glyphScroll",
    label: "Glyph Scroll",
    family: "animatedAscii",
    enabled: true,
    implemented: true,
    description: "The whole character grid travels in one direction.",
    applies: {
      asciiEnabled: true,
      asciiAnimated: true,
      asciiAnimationType: "scroll",
      asciiCharset: "classic",
      asciiCellSize: 18,
      asciiScrollSpeed: 1,
      asciiDirection: "horizontal",
      asciiLockMode: "screen",
      motionMode: "independent",
    },
  },
  {
    id: "asciiRain",
    label: "ASCII Rain",
    family: "animatedAscii",
    enabled: true,
    implemented: true,
    description: "Each column falls at its own speed. Glyphs stream downward.",
    applies: {
      asciiEnabled: true,
      asciiAnimated: true,
      asciiAnimationType: "rain",
      asciiCharset: "minimal",
      asciiCellSize: 16,
      asciiScrollSpeed: 1.2,
      asciiDirection: "vertical",
      asciiLockMode: "screen",
      motionMode: "independent",
    },
  },
  {
    id: "characterCycle",
    label: "Character Cycle",
    family: "animatedAscii",
    enabled: true,
    implemented: true,
    description: "Glyphs change in place, walking up the character ramp.",
    applies: {
      asciiEnabled: true,
      asciiAnimated: true,
      asciiAnimationType: "cycle",
      asciiCharset: "classic",
      asciiCellSize: 18,
      asciiScrollSpeed: 0.8,
      asciiLockMode: "screen",
      motionMode: "independent",
    },
  },
  {
    id: "revealGlyphs",
    label: "Reveal Glyphs",
    family: "animatedAscii",
    enabled: true,
    implemented: true,
    description: "Character density grows with the geometry draw-in.",
    applies: {
      asciiEnabled: true,
      asciiAnimated: true,
      asciiAnimationType: "revealDensity",
      asciiCharset: "classic",
      asciiCellSize: 18,
      asciiScrollSpeed: 1,
      asciiLockMode: "screen",
      motionMode: "syncToDraw",
    },
  },
  {
    id: "terminalFlicker",
    label: "Terminal Flicker",
    family: "animatedAscii",
    enabled: true,
    implemented: true,
    description: "A few random cells jump to a random glyph each tick.",
    applies: {
      asciiEnabled: true,
      asciiAnimated: true,
      asciiAnimationType: "flicker",
      asciiCharset: "custom",
      asciiCellSize: 17,
      asciiScrollSpeed: 1,
      asciiLockMode: "screen",
      motionMode: "independent",
    },
  },
  {
    id: "slowCodeCrawl",
    label: "Slow Code Crawl",
    family: "animatedAscii",
    enabled: true,
    implemented: true,
    description: "Code marks drifting slowly sideways.",
    applies: {
      asciiEnabled: true,
      asciiAnimated: true,
      asciiAnimationType: "scroll",
      asciiCharset: "custom",
      // THE RATE FLOOR FOR GLYPH TRANSLATION, DERIVED AND THEN CONFIRMED.
      //
      // A glyph is sampled as fsGlyphPixel(idx, floor(fsCellUV * 5.0)), so
      // translating the grid moves it in 1/5-cell quanta. That quantisation is
      // CORRECT — a character's strokes have square ends, and softening them is
      // how you turn an alphabet into grey weave — so the remedy for stepping
      // here is rate, not a different motion axis
      // (docs/research/ascii-glyph-resolution-and-temporal-stability.md §4.4).
      // What that research did not give was a NUMBER, so here it is.
      //
      // Count the frames in which SOMETHING crosses a bit boundary. Each pixel
      // column of the crop sits at its own sub-bit offset, so a cell of C device
      // pixels presents C distinct crossing phases, and there are 5 bit rows per
      // cell. Per second:
      //
      //     crossings/s = C * 5 * (grid travel in cells/s)
      //                 = 5 * v          where v = travel in device px/s
      //
      // For motion to fuse instead of stepping, at least one crossing has to land
      // in every displayed frame:
      //
      //     v >= fps / 5      = 24 device px/s at 120 Hz
      //     asciiScrollSpeed >= fps / (5 * 1.6 * asciiCellSize)
      //
      // (1.6 is the base rate in viewport-3d.tsx: uFsAscTime = speed * 1.6 * t,
      // in cells.) The floor is a fixed SCREEN VELOCITY and does not depend on
      // cell size, which is why it was invisible to a per-preset speed tweak.
      //
      // Confirmed against the instrument before trusting it: this preset at
      // speed 0.35 / cell 17 is v = 9.5 px/s, so the model predicts 47.6
      // crossings/s and 60.4% frozen frames. Measured at 120 Hz over a
      // native-resolution crop: stepHz 47.64, frozenFrac 0.605
      // (docs/verification/layer-flicker/texpass-before/). Three significant
      // figures on both, from a model with no fitted constants.
      //
      // AND THE FLOOR IS WHY "SLOW" HAD TO MOVE TO A DIFFERENT DIAL. Meeting it
      // at cell 17 needs speed 0.883, which is Glyph Scroll's 1.0 — the two
      // presets would become one look under two names, the exact duplication the
      // dither pass had to unpick. But the floor is on PIXEL velocity while what
      // the eye tracks in a glyph field is the GLYPH pattern, and glyphs advance
      // at v / C cells per second. So a bigger cell crawls more slowly at the
      // same legal pixel velocity: 26 with speed 0.58 is v = 24.1 px/s (at the
      // floor) but 0.93 cells/s against Glyph Scroll's 1.6 — genuinely the slower
      // of the two, by 1.7x, without breaking the quantum.
      //
      // The cell size is a bonus rather than a cost: 26 gives 5.2 device pixels
      // per glyph pixel, the most legible on either ASCII rail (the family floor
      // is ~15, i.e. 3 per glyph pixel — see the note above the static rail), and
      // a preset whose whole subject is bracket-and-slash CODE MARKS is the one
      // that most needs its marks to be readable.
      asciiCellSize: 26,
      asciiScrollSpeed: 0.58,
      asciiDirection: "horizontal",
      asciiLockMode: "screen",
      motionMode: "independent",
    },
  },
]

/* --- texture (IMPLEMENTED v1 — procedural pattern renderer is live) ---
* Each preset enables the texture layer and picks a pattern + tuning. They
* only touch texture* state: never material, never dither, never ascii. */
export const TEXTURE_PRESET_DEFS: StylePreset[] = [
  // Intensities across this family were raised after LIVE judging (headed
  // window, all four modes): at the old 0.35–0.55 defaults most patterns were
  // invisible at real viewport stroke sizes. Texture presets exist to be SEEN.
  {
    id: "fineGrain",
    label: "Fine Grain",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Per-cell speckle, clearly present on every mode.",
    applies: {
      textureEnabled: true,
      textureMode: "grain",
      textureLockMode: "object",
      textureScale: 1.6,
      textureIntensity: 0.6,
      textureContrast: 0.6,
    },
  },
  {
    id: "scanlines",
    label: "Scanlines",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Directional line pattern. Reads best on broad faces.",
    bestModes: ["extrude", "solid"],
    applies: {
      textureEnabled: true,
      textureMode: "scanlines",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.75,
      textureContrast: 0.7,
    },
  },
  {
    id: "contourBands",
    label: "Contour Bands",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Broad stripes wrapping the volume.",
    bestModes: ["solid", "inflate"],
    applies: {
      textureEnabled: true,
      textureMode: "bands",
      textureLockMode: "object",
      textureScale: 1.1,
      textureIntensity: 0.75,
      textureContrast: 0.65,
    },
  },
  {
    id: "scratchedInk",
    label: "Scratched Ink",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Irregular topo-like contour marks across the surface.",
    bestModes: ["rod", "extrude"],
    applies: {
      textureEnabled: true,
      textureMode: "contour",
      textureLockMode: "object",
      textureScale: 1.4,
      textureIntensity: 0.75,
      textureContrast: 0.65,
    },
  },
  {
    id: "gelBubbles",
    label: "Gel Bubbles",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Blobby noise field, like bubbles under the skin.",
    bestModes: ["inflate"],
    applies: {
      textureEnabled: true,
      textureMode: "noise",
      textureLockMode: "object",
      textureScale: 0.9,
      textureIntensity: 0.7,
      textureContrast: 0.6,
    },
  },
  {
    id: "crosshatch",
    label: "Crosshatch",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Crossing diagonal pen-hatching, like ink shading.",
    bestModes: ["extrude", "solid"],
    applies: {
      textureEnabled: true,
      textureMode: "crosshatch",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.7,
      textureContrast: 0.65,
    },
  },
  {
    id: "inkDots",
    label: "Ink Dots",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Printed dot grid with size jitter. Texture, not dither.",
    bestModes: ["solid", "extrude"],
    applies: {
      textureEnabled: true,
      textureMode: "dots",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.75,
      textureContrast: 0.6,
    },
  },
  {
    id: "woodgrain",
    label: "Woodgrain",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Wandering parallel grain lines, like cut timber.",
    bestModes: ["solid", "extrude"],
    applies: {
      textureEnabled: true,
      textureMode: "woodgrain",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.7,
      textureContrast: 0.6,
    },
  },
  {
    id: "cellular",
    label: "Cellular",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Packed organic cells with visible walls, like foam.",
    bestModes: ["inflate", "solid"],
    applies: {
      textureEnabled: true,
      textureMode: "cellular",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.7,
      textureContrast: 0.6,
    },
  },
  {
    id: "brushedSteel",
    label: "Brushed",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Anisotropic streaks, like brushed metal. Pairs with Chrome/Gold.",
    bestModes: ["rod", "extrude"],
    applies: {
      textureEnabled: true,
      textureMode: "brushed",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.65,
      textureContrast: 0.6,
    },
  },
  {
    id: "craquelure",
    label: "Craquelure",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Connected crack web, like old varnish or dried glaze.",
    bestModes: ["solid", "inflate"],
    applies: {
      textureEnabled: true,
      textureMode: "craquelure",
      textureLockMode: "object",
      textureScale: 1.1,
      textureIntensity: 0.75,
      textureContrast: 0.7,
    },
  },
  {
    id: "interference",
    label: "Ripple",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Two radial wave sources interfering, like still water rings.",
    bestModes: ["solid", "inflate"],
    applies: {
      textureEnabled: true,
      textureMode: "ripple",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.65,
      textureContrast: 0.6,
    },
  },
]

/* --- animated texture (IMPLEMENTED v1) ---
 * Animated presets set the SAME texture* fields plus animation params. They
 * are pattern MOTION only — never threshold motion (dither) or glyph motion
 * (ascii). */
export const ANIMATED_TEXTURE_PRESET_DEFS: StylePreset[] = [
  // Speeds and intensities were retuned in a HEADED window. Per the animation
  // decision framework: this is decorative, expressive, rarely-toggled motion
  // on a canvas object — it is allowed to be PRESENT (unlike UI chrome
  // motion, which must stay under ~300ms and out of the way). Constant
  // travel uses a linear clock (already the case); the tuning target was
  // "one visible feature-cycle every 1 to 1.5s at default settings" — at the
  // old speeds a band took ~4s to cross one stripe width and read as static.
  {
    id: "grainDrift",
    label: "Grain Boil",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "Film-grain speckle re-rolls and crawls. A constant boil.",
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureAnimationType: "travel",
      textureMode: "grain",
      textureLockMode: "object",
      textureScale: 1.6,
      textureIntensity: 0.6,
      textureContrast: 0.6,
      textureSpeed: 1.2,
      textureDirection: "diagonal",
      motionMode: "independent",
    },
  },
  {
    id: "scanlineScroll",
    label: "Scanline Scroll",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "Scanlines travel in one direction.",
    bestModes: ["extrude", "solid"],
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureAnimationType: "travel",
      textureMode: "scanlines",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.75,
      textureContrast: 0.7,
      // 2.2 -> 1.3, and this is the ONLY speed on the rail that had to move.
      // Travel is now measured in the pattern's own feature periods
      // (fsTexPeriod in lib/texture-shader.ts), so speed x 1.2 is periods per
      // second for every pattern. The rail's other eight presets already sat at
      // 0.9-1.6, i.e. 1.08-1.92 periods/s, which is the 1.2-2.0 band Dither
      // Crawl and Diagonal Screen Drift were tuned into by eye. Scanlines was
      // the outlier at 2.64. That the other eight needed nothing is the evidence
      // that the speeds were always tuned by feel and the SHARED RATE was the
      // thing that was wrong.
      textureSpeed: 1.3,
      textureDirection: "vertical",
      motionMode: "independent",
    },
  },
  {
    id: "rippleFlow",
    label: "Contour Flow",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "Topo contour lines stream across the form.",
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureAnimationType: "travel",
      textureMode: "contour",
      textureLockMode: "object",
      textureScale: 1.2,
      textureIntensity: 0.75,
      textureContrast: 0.65,
      textureSpeed: 1.6,
      textureDirection: "horizontal",
      motionMode: "independent",
    },
  },
  {
    id: "bandCrawl",
    label: "Band Crawl",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "Broad bands slide deliberately along the stroke.",
    bestModes: ["solid", "inflate"],
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureAnimationType: "travel",
      textureMode: "bands",
      textureLockMode: "object",
      textureScale: 1.1,
      textureIntensity: 0.75,
      textureContrast: 0.65,
      textureSpeed: 1.0,
      textureDirection: "vertical",
      motionMode: "independent",
    },
  },
  {
    id: "bubbleDrift",
    label: "Bubble Drift",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "Noise blobs drift under the surface.",
    bestModes: ["inflate"],
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureAnimationType: "travel",
      textureMode: "noise",
      textureLockMode: "object",
      textureScale: 0.9,
      textureIntensity: 0.7,
      textureContrast: 0.6,
      textureSpeed: 0.9,
      textureDirection: "diagonal",
      motionMode: "independent",
    },
  },
  {
    id: "rippleRadiate",
    label: "Ripple Radiate",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "Water rings radiate outward from two sources.",
    bestModes: ["solid", "inflate"],
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureAnimationType: "travel",
      textureMode: "ripple",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.7,
      textureContrast: 0.6,
      textureSpeed: 1.4,
      textureDirection: "horizontal",
      motionMode: "independent",
    },
  },
  {
    id: "cellFlow",
    label: "Cell Flow",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "Foam cells migrate across the surface.",
    bestModes: ["inflate", "solid"],
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureAnimationType: "travel",
      textureMode: "cellular",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.7,
      textureContrast: 0.6,
      textureSpeed: 0.9,
      textureDirection: "diagonal",
      motionMode: "independent",
    },
  },
  {
    id: "hatchDrift",
    label: "Hatch Drift",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "The pen-hatching weave slides diagonally.",
    bestModes: ["extrude", "solid"],
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureAnimationType: "travel",
      textureMode: "crosshatch",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.7,
      textureContrast: 0.65,
      textureSpeed: 1.2,
      textureDirection: "diagonal",
      motionMode: "independent",
    },
  },
  {
    id: "dotStream",
    label: "Dot Stream",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "The printed dot grid streams along the stroke.",
    bestModes: ["solid", "extrude"],
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureAnimationType: "travel",
      textureMode: "dots",
      textureLockMode: "object",
      textureScale: 1.0,
      textureIntensity: 0.75,
      textureContrast: 0.6,
      textureSpeed: 1.6,
      textureDirection: "vertical",
      motionMode: "independent",
    },
  },
]


/* --- layer stack (IMPLEMENTED v1) ---
 * Each preset is a COMPOSITION, not a pile of switches. They follow the PRD's
 * taste rule: ONE dominant graphic layer, the others supporting at reduced
 * opacity. That is why the opacities differ so much within a preset — a stack
 * with three layers at full strength is the visual soup the PRD warns about
 * (see docs/verification/stack-v1/ for what that looks like). */
export const LAYER_STACK_PRESET_DEFS: StylePreset[] = [
  {
    id: "cleanInkStack",
    label: "Clean Ink Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "Ink with a visible tooth of grain. Nothing dominates. The form leads.",
    applies: {
      layerStackEnabled: true,
      materialPreset: "ink",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "grain",
      textureScale: 2.0,
      // Retuned after the texture strengthening pass: 0.3 x 0.7 = 0.21
      // effective was a whisper nobody could hear — the stroke read as plain
      // ink (verified live, stack craft pass). 0.5 x 0.85 keeps the form
      // leading but the paper tooth actually exists.
      textureIntensity: 0.5,
      textureContrast: 0.55,
      ditherEnabled: false,
      asciiEnabled: false,
      stackTextureOpacity: 0.85,
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "ditheredGelStack",
    label: "Dithered Gel Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "Soft gel body, dither doing the graphic work, texture barely there.",
    bestModes: ["inflate"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "softGel",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "noise",
      textureScale: 0.7,
      textureIntensity: 0.3,
      ditherEnabled: true,
      ditherType: "blueNoise",
      ditherScale: 2.5,
      ditherLevels: 4,
      ditherIntensity: 0.85,
      ditherContrast: 0.45,
      ditherLockMode: "screen",
      asciiEnabled: false,
      stackTextureOpacity: 0.35,
      stackDitherOpacity: 0.9,
      stackDitherBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "terminalStack",
    label: "Terminal Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "ASCII dominant, scanlines underneath, no dither competing.",
    bestModes: ["solid", "extrude"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "signal",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "scanlines",
      textureScale: 1.0,
      textureIntensity: 0.4,
      ditherEnabled: false,
      asciiEnabled: true,
      asciiCharset: "classic",
      // 11px cells sat below the 13px glyph-legibility floor found in the
      // ASCII craft pass — the terminal read as woven mesh, not characters.
      // Contrast up so the shading walks several characters instead of the
      // whole body resolving to one glyph (a uniform dot grid, not text).
      asciiCellSize: 13,
      asciiDensity: 0.55,
      asciiContrast: 0.65,
      asciiLockMode: "screen",
      stackTextureOpacity: 0.4,
      stackAsciiOpacity: 0.95,
      stackAsciiBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "graphicSlabStack",
    label: "Graphic Slab Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "Matte clay slab broken by hard Bayer dither. Contour bands support.",
    bestModes: ["solid"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "matteClay",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "bands",
      textureScale: 0.8,
      textureIntensity: 0.6,
      ditherEnabled: true,
      ditherType: "bayer4",
      ditherScale: 4,
      ditherLevels: 2,
      ditherIntensity: 1,
      // Retuned (stack craft pass): at contrast 0.6 / exposure default the
      // matte-clay body clamped below every threshold and only the pattern
      // FLOOR rendered — a flat uniform checker with zero tonal modelling
      // (and 0.85 overshot to a washed-out near-empty stroke). 0.65 puts the
      // clay's real range mid-ramp so the Bayer checker MODELS the form —
      // dense in shadow, open in light — instead of wallpapering it.
      ditherContrast: 0.45,
      ditherExposure: 0.58,
      ditherLockMode: "screen",
      asciiEnabled: false,
      stackTextureOpacity: 0.6,
      stackDitherOpacity: 1,
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "softSignalStack",
    label: "Soft Signal Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "All three layers, deliberately restrained. Sparse glyphs lead, dither and scanlines whisper.",
    bestModes: ["inflate", "solid"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "rubber",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "scanlines",
      textureScale: 1.1,
      textureIntensity: 0.5,
      ditherEnabled: true,
      ditherType: "blueNoise",
      ditherScale: 2,
      ditherLevels: 5,
      ditherIntensity: 0.6,
      ditherContrast: 0.4,
      // Dark rubber body: without exposure the whole form sits below every
      // threshold and the supporting dither never renders.
      ditherExposure: 0.9,
      ditherLockMode: "screen",
      asciiEnabled: true,
      asciiCharset: "minimal",
      // Retuned (stack craft pass): the original 10px cells / density 0.5 on
      // the post-strengthening (darker) rubber landed the body at ramp level
      // 0 — every cell drew the BLANK glyph and the preset collapsed into a
      // plain black stroke with all three layers invisible. Density 0.9 puts
      // the dark body mid-ramp so the sparse minimal glyphs actually appear.
      asciiCellSize: 12,
      asciiDensity: 0.9,
      asciiContrast: 0.55,
      asciiLockMode: "screen",
      // The taste rule in numbers: ASCII leads, the other two support.
      stackTextureOpacity: 0.45,
      stackDitherOpacity: 0.5,
      stackAsciiOpacity: 0.9,
      stackDitherBlend: "multiply",
      stackAsciiBlend: "normal",
      stackOrder: "asciiFirst",
    },
  },
  /* --- second wave (stack craft pass) ---
   * Authored AFTER the texture/dither/ASCII strengthening passes, composing
   * from the new print screens, charsets and materials. Same taste rule:
   * each is a CONCEPT with one dominant graphic layer. */
  {
    id: "newsprintStack",
    label: "Newsprint Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "A press photo: newsprint screen doing the tone work over warm paper, grain in the sheet.",
    bestModes: ["solid", "extrude"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "chalk",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "grain",
      textureScale: 1.8,
      textureIntensity: 0.4,
      textureContrast: 0.5,
      ditherEnabled: true,
      ditherType: "newsprint",
      ditherScale: 3.5,
      ditherLevels: 2,
      ditherIntensity: 0.95,
      ditherContrast: 0.5,
      // Bright chalk body: pull the ramp DOWN hard so the dot structure
      // spreads across the whole form instead of only pooling in the shadows
      // (0.35 still left the sheet nearly empty).
      ditherExposure: 0.22,
      ditherAngle: 45,
      ditherLockMode: "screen",
      asciiEnabled: false,
      stackTextureOpacity: 0.35,
      stackDitherOpacity: 0.95,
      stackDitherBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "woodcutStack",
    label: "Woodcut Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "An engraving: crosshatch screen carves the tone, woodgrain runs under it.",
    bestModes: ["solid", "extrude"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "wax",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "woodgrain",
      textureScale: 1.2,
      textureIntensity: 0.65,
      textureContrast: 0.55,
      ditherEnabled: true,
      ditherType: "crosshatch",
      ditherScale: 3.5,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherContrast: 0.4,
      // The tone-mapped wax body reads far brighter than its albedo suggests:
      // at exposure 0.8 the whole form sat above every threshold and ZERO
      // hatch rendered (pale lemon stroke, judged live). 0.38 lands it
      // mid-ramp so hatch density follows the shading like a real engraving.
      ditherExposure: 0.38,
      ditherAngle: 45,
      ditherLockMode: "screen",
      asciiEnabled: false,
      stackTextureOpacity: 0.6,
      stackDitherOpacity: 1,
      stackDitherBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "porcelainPrintStack",
    label: "Porcelain Print Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "Transferware: a 45-degree dot screen fired into white porcelain glaze.",
    bestModes: ["solid", "inflate"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "ceramic",
      materialUserOverride: true,
      textureEnabled: false,
      textureMode: "none",
      ditherEnabled: true,
      ditherType: "dotScreen",
      ditherScale: 4,
      ditherLevels: 2,
      ditherIntensity: 0.95,
      ditherContrast: 0.55,
      // Porcelain is the brightest body in the family — the ramp has to be
      // pulled down hardest of all or the glaze sits above every threshold
      // and the print vanishes (0.4 rendered a blank stroke, judged live).
      ditherExposure: 0.18,
      ditherAngle: 45,
      ditherLockMode: "screen",
      asciiEnabled: false,
      stackDitherOpacity: 0.9,
      stackDitherBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "marqueeStack",
    label: "Marquee Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "A bulb sign: braille dot-cells light up along the neon tube.",
    bestModes: ["solid", "inflate"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "neon",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "scanlines",
      textureScale: 1.0,
      textureIntensity: 0.3,
      textureContrast: 0.5,
      ditherEnabled: false,
      asciiEnabled: true,
      asciiCharset: "braille",
      // 22px cells: braille dots need ~4px each plus real gaps to read as
      // round BULBS — at 13-18px the dot rows merged into vertical stripes
      // (judged live, twice).
      asciiCellSize: 22,
      // Neon's emissive body is HOT (raw luminance ~1) and UNIFORM, so the
      // whole sign resolves to one glyph — the only lever on which glyph is
      // density, and only the sparse end reads as separate bulbs (judged
      // live at 0.65, 0.35 and 0.22).
      asciiDensity: 0.15,
      asciiContrast: 0.25,
      asciiLockMode: "screen",
      stackTextureOpacity: 0.35,
      stackAsciiOpacity: 1,
      stackAsciiBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "blueprintStack",
    label: "Blueprint Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "A drafting table: box-drawing lines trace the gel form, contour bands underneath.",
    bestModes: ["inflate", "solid"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "softGel",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "contour",
      textureScale: 1.0,
      textureIntensity: 0.45,
      textureContrast: 0.5,
      ditherEnabled: false,
      asciiEnabled: true,
      asciiCharset: "boxes",
      // 15px cells so the box-drawing strokes read as LINES, not weave.
      asciiCellSize: 15,
      // The post-strengthening gel is brighter than its albedo suggests: at
      // density 0.85 every cell saturated to the densest box glyph (judged
      // live — a uniform speck grid, no line work; 0.55 was still block-
      // heavy). 0.4 lands the body mid-ramp so lighter line glyphs appear.
      asciiDensity: 0.4,
      asciiContrast: 0.45,
      asciiLockMode: "screen",
      stackTextureOpacity: 0.4,
      stackAsciiOpacity: 0.9,
      stackAsciiBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "gildedStack",
    label: "Gilded Stack",
    family: "layerStack",
    enabled: true,
    implemented: true,
    description: "Aged gilt: craquelure cracks the gold leaf, a faint hatch plate darkens the recesses.",
    bestModes: ["extrude", "solid"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "gold",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "craquelure",
      textureScale: 1.4,
      textureIntensity: 0.85,
      textureContrast: 0.6,
      ditherEnabled: true,
      ditherType: "hatch",
      ditherScale: 3,
      ditherLevels: 3,
      ditherIntensity: 0.3,
      ditherContrast: 0.35,
      ditherExposure: 0.6,
      ditherAngle: 45,
      ditherLockMode: "screen",
      asciiEnabled: false,
      // Texture-dominant: the cracked leaf IS the composition; the hatch
      // plate only weights the shadows (multiply can only darken).
      stackTextureOpacity: 1,
      stackDitherOpacity: 0.35,
      stackDitherBlend: "multiply",
      stackOrder: "ditherFirst",
    },
  },
]

/* --- stack animation (IMPLEMENTED v1) ---
 * These animate the GROUP. They set stackAnimation* only; each layer's own
 * animation settings are untouched, which is the point — the group moves while
 * the layers keep whatever they were individually doing. */
export const STACK_ANIMATION_PRESET_DEFS: StylePreset[] = [
  {
    id: "stackFadeIn",
    label: "Stack Fade In",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "The whole visual stack arrives together.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "fadeIn",
      stackAnimationSpeed: 1,
    },
  },
  {
    id: "stackCompletionPulse",
    label: "Stack Completion Pulse",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "The stack swells when the draw-in finishes, then settles.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "completionPulse",
      stackAnimationSpeed: 1,
    },
  },
  {
    // The pulse behaviour existed in the engine and the behaviour dropdown but
    // had NO preset chip — the rail silently skipped one of the seven
    // behaviours (stack craft pass).
    id: "stackPulse",
    label: "Stack Pulse",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "The whole composition breathes together.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "pulse",
      stackAnimationSpeed: 1,
    },
  },
  {
    id: "stackDrift",
    label: "Stack Drift",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "Every layer slides together at one shared speed.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "drift",
      stackAnimationSpeed: 0.6,
    },
  },
  {
    id: "stackFreezeOnComplete",
    label: "Stack Freeze On Complete",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "Layers animate during the draw, then hold their final frame.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "freezeOnComplete",
      stackAnimationSpeed: 1,
    },
  },
  {
    id: "stackLoopCrawl",
    label: "Stack Loop Crawl",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "The whole stack slides out and back on the shared loop.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "loop",
      stackAnimationSpeed: 1,
    },
  },
  {
    id: "stackDelay",
    label: "Stack Delay",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "The style stack appears only after the geometry is fully drawn.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "delayAfterReveal",
      stackAnimationSpeed: 1,
    },
  },
  {
    // The eighth behaviour, and the one PRD §4 named ("reveal sync") that the
    // engine had no case for. See `StackAnimationType`.
    id: "stackRevealTrack",
    label: "Stack Reveal Track",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "The stack builds WITH the stroke. Replay the draw to see it.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "revealSynced",
      stackAnimationSpeed: 1,
    },
  },
  {
    // The first member on this rail to use the SIGN of the speed. Reverse is a
    // genuinely different read on a drifting composition — the pattern appears
    // to be pulled back into the stroke rather than off the end of it.
    id: "stackDriftBack",
    label: "Stack Drift Back",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "The same shared slide, running backwards.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "drift",
      stackAnimationSpeed: -0.6,
    },
  },
  {
    id: "stackWhisperDrift",
    label: "Stack Whisper",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "Held at low group opacity and drifting slowly. Presence, not pattern.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "drift",
      stackAnimationSpeed: 0.35,
      stackAnimationOpacity: 0.4,
    },
  },
  {
    id: "stackSlowBreath",
    label: "Stack Slow Breath",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "A long breath instead of a pulse. One full cycle every few seconds.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "pulse",
      stackAnimationSpeed: 0.3,
      // Half a cycle of phase, so it starts on the IN-breath rather than at the
      // same instant as Stack Pulse — two presets that share a behaviour must
      // not also share their frame-zero.
      stackAnimationPhase: 3.14,
    },
  },
  {
    id: "stackHardLoop",
    label: "Stack Hard Loop",
    family: "stackAnimation",
    enabled: true,
    implemented: true,
    description: "A fast there-and-back on the shared loop, offset off its home.",
    applies: {
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "loop",
      stackAnimationSpeed: 2.2,
      stackAnimationPhase: 1.5,
    },
  },
]

/* --- fusion (IMPLEMENTED — PRD phase 20) ---
 * Each preset is a CONCEPT: a base composition (reusing numbers validated in
 * the stack/dither/ascii craft passes — glyph cells >=13px, explicit
 * ditherExposure everywhere dither is on, densities matched to the body's
 * real brightness) PLUS one authored relationship evaluated per frame in
 * lib/style-fusion.ts. The `applies` patch sets the composition and selects
 * the relationship via `fusionPreset`; the engine does the linking. Every
 * patch also resets the systems the concept does NOT use, so a fusion preset
 * is a complete look, not an additive pile. */
const FUSION_BASE: Partial<StyleState> = {
  // Loop is the default shape because it is the only one that is unconditionally
  // alive: a preset lands breathing, and the Arc/Burst shapes are chosen from the
  // Drive dial in the fusion config.
  fusionDrive: "loop",
  fusionAnimationEnabled: false,
  fusionAnimationSpeed: 1,
  fusionIntensity: 0.6,
  fusionSwing: 1,
  // Fusion's ambient drives need a running style clock; "off" freezes them.
  motionMode: "independent",
  textureEnabled: false,
  textureMode: "none",
  textureAnimated: false,
  ditherEnabled: false,
  ditherAnimated: false,
  asciiEnabled: false,
  asciiAnimated: false,
  asciiAnimationType: "none",
  layerStackEnabled: false,
  stackAnimationEnabled: false,
}

export const FUSION_PRESET_DEFS: StylePreset[] = [
  {
    id: "terminalGel",
    label: "Terminal Gel",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "A terminal readout suspended in gel: glyph density drives the gel's shine. The surface glosses and glows exactly as the characters thicken.",
    bestModes: ["inflate"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "terminalGel",
      materialPreset: "softGel",
      materialUserOverride: true,
      asciiEnabled: true,
      asciiCharset: "classic",
      asciiCellSize: 13,
      asciiDensity: 0.5,
      asciiContrast: 0.6,
      asciiLockMode: "screen",
    },
  },
  {
    id: "ditherBloom",
    label: "Dither Bloom",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "Wet print: the halftone threshold blooms open and closed, and the surface wets and gloss-darkens from the same threshold signal.",
    bestModes: ["solid", "extrude"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "ditherBloom",
      materialPreset: "matteClay",
      materialUserOverride: true,
      ditherEnabled: true,
      ditherType: "halftone",
      ditherScale: 6,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherContrast: 0.5,
      ditherThreshold: 0.5,
      // The tone-mapped clay body reads far brighter than its albedo (the
      // Woodcut lesson): at 0.58 the dots pooled only in the shadows and the
      // bloom had nothing to flood. 0.42 spreads dot structure across the
      // whole form so the ink visibly floods and recedes (judged live).
      ditherExposure: 0.42,
      ditherAngle: 45,
      ditherLockMode: "screen",
    },
  },
  {
    id: "signalInk",
    label: "Signal Ink",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "Ink carrying a live signal: each energy burst washes the data pattern out of the ink, and the pattern floods back as the glow decays: one wire, two systems on opposite ends.",
    bestModes: ["rod", "extrude"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "signalInk",
      materialPreset: "signal",
      materialUserOverride: true,
      ditherEnabled: true,
      ditherAnimated: true,
      ditherType: "bayer8",
      ditherScale: 5,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherContrast: 0.6,
      ditherThreshold: 0.5,
      // Signal's emissive-lit teal body reads bright: keep the ramp high side.
      ditherExposure: 0.65,
      ditherSpeed: 0.5,
      ditherDirection: "horizontal",
      ditherLockMode: "screen",
    },
  },
  {
    id: "asciiRubber",
    label: "ASCII Rubber",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "A rubber skin with a current of characters under it: the shine band is positioned from the glyph grid's own scroll phase, so light travels WITH the characters.",
    bestModes: ["inflate", "rod"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "asciiRubber",
      materialPreset: "rubber",
      materialUserOverride: true,
      asciiEnabled: true,
      asciiAnimated: true,
      asciiAnimationType: "scroll",
      asciiCharset: "minimal",
      asciiCellSize: 13,
      // Dark rubber body needs the dense end of the ramp (Soft Signal pass).
      asciiDensity: 0.9,
      asciiContrast: 0.55,
      asciiScrollSpeed: 0.9,
      asciiDirection: "horizontal",
      asciiLockMode: "screen",
    },
  },
  {
    id: "scanlineBalloon",
    label: "Scanline Balloon",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "An inflated skin with scanlines printed on it: one breath signal spreads and packs the lines while the stretched skin shines and glows.",
    bestModes: ["inflate"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "scanlineBalloon",
      materialPreset: "softGel",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "scanlines",
      textureScale: 1.0,
      textureIntensity: 0.75,
      textureContrast: 0.7,
    },
  },
  {
    id: "pixelClay",
    label: "Pixel Clay",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "Clay mid-digitisation: one signal chunks the dither pixels, dissolves the grain, and sinters the surface wet-dark. Three systems on one driver.",
    bestModes: ["solid"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "pixelClay",
      materialPreset: "matteClay",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "grain",
      textureScale: 1.6,
      textureIntensity: 0.6,
      textureContrast: 0.6,
      ditherEnabled: true,
      ditherType: "blueNoise",
      // object units: 0.7 is ~2 px cells at the probe's filled 3/4 view (2 was ~6 px)
      ditherScale: 0.7,
      ditherLevels: 3,
      ditherIntensity: 0.9,
      ditherContrast: 0.45,
      ditherThreshold: 0.5,
      ditherExposure: 0.58,
      // LOOKS 2026-09-25: object lock turns on the shading dither (lib/dither-shader.ts):
      // 3 levels, ink end 0.4 of the body, pattern only off the lit face, solid rim.
      ditherLockMode: "object",
      layerStackEnabled: true,
      stackTextureOpacity: 0.6,
      stackDitherOpacity: 0.95,
      stackDitherBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "codeBloom",
    label: "Code Bloom",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "Source code blooming on the surface: glyph density DRIVES the dither threshold. The stipple under the characters densifies exactly as they thicken.",
    bestModes: ["extrude", "solid"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "codeBloom",
      materialPreset: "ink",
      materialUserOverride: true,
      asciiEnabled: true,
      asciiCharset: "custom",
      asciiCellSize: 13,
      // Mid ramp, NOT the dense end: at 0.85 the whole swing lived in the
      // saturated top of the ramp — 8 live frames measured pixel-flat. 0.6 puts
      // the swing across the ramp's readable middle so characters visibly
      // thicken and thin.
      //
      // THIS COMMENT USED TO SAY ±0.33 AND THE CODE COMPUTED ±0.55, which is the
      // sort of drift that makes the next person tune the wrong number. The
      // amplitude is no longer a constant to be transcribed at all: the Loop
      // drive swings to `min(base, 1 - base)` — this layer's own headroom, ±0.40
      // at 0.6 — so it is symmetric in the range that actually renders and cannot
      // clip against the 0..1 density clamp the way a hardcoded ±0.55 did.
      // See lib/style-fusion.ts, `case "codeBloom"`.
      asciiDensity: 0.6,
      asciiContrast: 0.55,
      asciiLockMode: "screen",
      ditherEnabled: true,
      ditherType: "blueNoise",
      ditherScale: 2,
      ditherLevels: 3,
      ditherIntensity: 0.7,
      ditherContrast: 0.45,
      ditherThreshold: 0.5,
      // Dark ink body sits below every threshold without a hard exposure lift.
      ditherExposure: 0.9,
      ditherLockMode: "screen",
      layerStackEnabled: true,
      stackDitherOpacity: 0.55,
      stackAsciiOpacity: 0.95,
      stackDitherBlend: "normal",
      stackAsciiBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "glitchRibbon",
    label: "Glitch Ribbon",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "A ribbon of signal that keeps breaking: one shared impulse jolts the dither matrix, re-rolls the glyphs, shears the pattern and spikes the glow. Simultaneously.",
    bestModes: ["extrude"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "glitchRibbon",
      materialPreset: "signal",
      materialUserOverride: true,
      ditherEnabled: true,
      ditherType: "bayer4",
      ditherScale: 4,
      ditherLevels: 2,
      ditherIntensity: 0.9,
      ditherContrast: 0.6,
      ditherThreshold: 0.5,
      ditherExposure: 0.65,
      // The glitch impulse moves the matrix via dir * uFsDitTime — the default
      // "static" direction is the ZERO vector, which silently multiplied every
      // jolt into nothing (measured: 8 frames pixel-flat). Diagonal reads most
      // broken and costs nothing while idle because the layer is not animated.
      ditherDirection: "diagonal",
      ditherLockMode: "screen",
      asciiEnabled: true,
      asciiAnimated: true,
      asciiAnimationType: "flicker",
      asciiCharset: "minimal",
      asciiCellSize: 13,
      asciiDensity: 0.6,
      asciiContrast: 0.5,
      asciiScrollSpeed: 1,
      asciiLockMode: "screen",
      layerStackEnabled: true,
      stackDitherOpacity: 0.85,
      stackAsciiOpacity: 0.6,
      stackDitherBlend: "normal",
      stackAsciiBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },

  /* ====================================================================== */
  /* THE FOUR ADDED 2026-08-03 — each one a system that could not reach the  */
  /* rail at all, rather than a fourth mix of what was already reachable.    */
  /* Their relationships are LINK LISTS (`BUILTIN_LINK_FUSIONS`), evaluated  */
  /* through the same path a user's fusion takes, so the panel can offer     */
  /* "Edit a copy" and hand back exactly what is running.                    */
  /* ====================================================================== */
  {
    id: "viewTurn",
    label: "Turn Table",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      /* ⚠ THE LAST CLAUSE IS NEW — 2026-08-04, Sebs: "some dont animate."
       * Measured (scripts/verify/_probe-fusion-animates.mjs): all fourteen
       * relationships move, and this one moves ONLY while the camera does,
       * which is its whole concept. But a user who selects it and does not
       * touch the viewport sees a still picture, and a control whose copy does
       * not say what it needs is the same defect as one that does nothing.
       * So the description now says the action out loud.
       * 2026-09-25, night E: the view wake (`FUSION_VIEW_SPIN_DEG`,
       * lib/style-fusion.ts) now starts the turntable when this is picked, so
       * "hold still and it holds still" was false: measured cameraSpin=12 and
       * 84,993 to 112,520 px moving over 4 s parked at p=1
       * (docs/verification/night-s/probe-turn.mjs). The copy says what it does. */
      "The mark as an object on a turntable: where you look from drives the travelling highlight, the oil-sheen shift and the pattern's scale. So the surface answers the view instead of a clock. Picking it starts the turntable at 12 degrees a second; drag to turn it by hand. The one relationship that keeps working with motion off.",
    bestModes: ["solid", "extrude"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "viewTurn",
      // A dark glossy body: the thin film modulates a REFLECTION, so it needs
      // something to reflect. Iridescent is the preset built for exactly that.
      materialPreset: "iridescent",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "brushed",
      textureScale: 1.2,
      textureIntensity: 0.55,
      textureContrast: 0.6,
      textureLockMode: "object",
    },
  },
  {
    id: "slowWeather",
    label: "Slow Weather",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "Weather, not a pulse: the pattern's bite and the ink's weight wander on a drift that never repeats, while the glow breathes on a different clock. So the two halves of the surface are never quite in agreement.",
    bestModes: ["solid", "inflate"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "slowWeather",
      materialPreset: "chalk",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "craquelure",
      textureScale: 1.4,
      textureIntensity: 0.7,
      textureContrast: 0.5,
      textureLockMode: "object",
    },
  },
  {
    id: "formation",
    label: "Formation",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "The layers are one body and the surface belongs to it: the stack's own group animation drives the matrix's travel, the glyph density, the screen's bite and the wetness. Change the stack's speed and every one of them changes with it.",
    bestModes: ["extrude", "solid"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "formation",
      materialPreset: "matteClay",
      materialUserOverride: true,
      ditherEnabled: true,
      ditherType: "halftone",
      ditherScale: 5,
      ditherLevels: 2,
      ditherIntensity: 0.9,
      ditherContrast: 0.5,
      ditherThreshold: 0.5,
      ditherExposure: 0.42, // the tone-mapped clay reads far brighter than its albedo
      ditherAngle: 45,
      // `dir * uFsDitTime` on "static" is the zero vector, which is what made
      // eight of Glitch Ribbon's frames pixel-flat. The stack drives this
      // layer's FLOW, so it must have somewhere to flow.
      ditherDirection: "horizontal",
      ditherLockMode: "screen",
      asciiEnabled: true,
      asciiCharset: "minimal",
      asciiCellSize: 13,
      asciiDensity: 0.55,
      asciiContrast: 0.5,
      asciiLockMode: "screen",
      // The SOURCE of this whole relationship. Without the group animation the
      // Stack source rests at zero and every link above it is silent.
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "drift",
      stackAnimationSpeed: 1.4,
      stackDitherOpacity: 0.7,
      stackAsciiOpacity: 0.75,
      stackDitherBlend: "normal",
      stackAsciiBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  {
    id: "wholeCloth",
    label: "Whole Cloth",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "Everything fused at once. Nine relationships across every system, and every one of them on a DIFFERENT driver, so the picture reads as several things alive together rather than one thing throbbing.",
    bestModes: ["solid", "extrude"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "wholeCloth",
      materialPreset: "ink",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "grain",
      textureScale: 1.6,
      textureIntensity: 0.6,
      textureContrast: 0.6,
      textureAnimated: true,
      textureSpeed: 0.8,
      ditherEnabled: true,
      ditherType: "blueNoise",
      ditherScale: 2,
      ditherLevels: 3,
      ditherIntensity: 0.7,
      ditherContrast: 0.45,
      ditherThreshold: 0.5,
      ditherExposure: 0.9, // the dark ink body sits below every threshold without it
      ditherAnimated: true,
      ditherDirection: "horizontal",
      ditherSpeed: 0.5,
      ditherLockMode: "screen",
      asciiEnabled: true,
      asciiCharset: "custom",
      asciiCellSize: 13,
      asciiDensity: 0.6,
      asciiContrast: 0.55,
      asciiAnimated: true,
      asciiAnimationType: "scroll",
      asciiScrollSpeed: 0.9,
      asciiDirection: "horizontal",
      asciiLockMode: "screen",
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "drift",
      stackAnimationSpeed: 1,
      // THREE screen layers on one mark composite to solid at full opacity —
      // the same arithmetic measured on the newborn fusion
      // (docs/verification/fusion-newborn/wake-v3). Pulled back so the MARK is
      // still the subject and the layers are what is happening to it.
      stackTextureOpacity: 0.5,
      stackDitherOpacity: 0.5,
      stackAsciiOpacity: 0.7,
      stackDitherBlend: "normal",
      stackAsciiBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
  /* ====================================================================== */
  /*  THE TWO EMPTY CELLS — 2026-08-04                                      */
  /* ---------------------------------------------------------------------- */
  /*  Sebs: "i asked to have at least one fusion for every possible combo of */
  /*  styles." The combination space is the eight subsets of {texture,       */
  /*  dither, ascii}; `scripts/verify/_probe-fusion-coverage.mjs` prints all */
  /*  eight and found exactly two with nothing in them. These are those two, */
  /*  and there are deliberately not twelve — a permutation of a permutation */
  /*  is what this repo bans, and every other cell already had an answer.    */
  /* ====================================================================== */
  {
    /* CONCEPT: the ink has not dried. This is the only relationship on the rail
     * with NO screen layer at all — the other twelve put something OVER the
     * mark, and none of them is about the mark itself. It is also the only one
     * driven by the DRAW rather than by a clock: the stroke arrives wet, heavy
     * and reflective, and dries behind the pen. `drift` keeps the body alive at
     * rest so the pill is not a still picture on a finished mark, and the
     * completion pulse is the one moment the whole thing catches the light. */
    id: "stillWet",
    label: "Still Wet",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "The ink has not dried yet. No pattern, no screen. Just the body: the stroke arrives wet, heavy and reflective, and dries behind the pen. The one relationship driven by your drawing rather than by a clock.",
    bestModes: ["rod", "inflate"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "stillWet",
      /* Ink, because the subject IS the ink. Every screen layer stays off —
       * that is the cell this preset exists to answer, and switching one on to
       * make it "richer" would move it into a cell that already has answers. */
      materialPreset: "ink",
      materialUserOverride: true,
    },
  },
  {
    /* CONCEPT: wood type. Every ASCII relationship shipped so far reads as a
     * SCREEN — Terminal Gel, ASCII Rubber, Code Bloom and Glitch Ribbon are all
     * lit glass. Type has an older life than that: cut into a block, inked, and
     * pressed into paper. So the pattern is the block's own grain and the glyphs
     * are the impression, and the two READ EACH OTHER — the grain decides where
     * the type takes ink, and the type bites back into the grain. No dither
     * anywhere near it, which is what makes this the texture+ascii cell rather
     * than a second Code Bloom.
     *
     * THE STACK IS ON, AND THAT IS NOT AN EXTRA. Two screen layers on one mark
     * composite toward solid at full opacity: measured at 87.0 % of the inked
     * area surviving without a stack against 96.6 % with one (`fusionWakePatch`,
     * lib/style-fusion.ts). The wake would switch it on here anyway now that the
     * built-in path runs it; it is written out so the opacities and the order
     * are AUTHORED rather than defaulted. */
    id: "letterpress",
    label: "Letterpress",
    family: "fusion",
    enabled: true,
    implemented: true,
    description:
      "Wood type, not a screen: the block's own grain decides where the letters take ink, and the letters bite back into the grain. The only relationship that pairs a pattern with a glyph grid and keeps the dither out of it.",
    bestModes: ["solid", "extrude"],
    applies: {
      ...FUSION_BASE,
      fusionPreset: "letterpress",
      /* Chalk: bone-dry, matte, papery, and one of the four bodies with a real
       * sheen colour. A glossy body would read as a screen again. */
      materialPreset: "chalk",
      materialUserOverride: true,
      textureEnabled: true,
      /* The re-authored woodgrain (2026-08-04): narrow hard latewood bands,
       * cathedral arches, fibre along the grain. It is the block. */
      textureMode: "woodgrain",
      textureScale: 1.15,
      textureIntensity: 0.68,
      textureContrast: 0.6,
      textureLockMode: "object",
      /* ANIMATED, because the `textureField` source reads the pattern's PHASE
       * and a pinned phase is the exact defect the newborn fusion shipped with.
       * Slow: the block is not supposed to look like it is sliding. */
      textureAnimated: true,
      textureSpeed: 0.35,
      asciiEnabled: true,
      asciiCharset: "minimal",
      /* >= 13 device px per cell is the legibility floor the screen-layer craft
       * pass derived; 15 because these glyphs are the subject here rather than a
       * texture over one. */
      asciiCellSize: 15,
      asciiDensity: 0.52,
      asciiContrast: 0.5,
      asciiLockMode: "screen",
      /* The other half of the two-way read: `asciiField` needs the glyph field
       * to be advancing or it contributes exactly zero. */
      asciiAnimated: true,
      asciiAnimationType: "scroll",
      asciiScrollSpeed: 0.4,
      asciiDirection: "horizontal",
      layerStackEnabled: true,
      stackAnimationEnabled: true,
      stackAnimationType: "drift",
      stackAnimationSpeed: 0.7,
      stackTextureOpacity: 0.75,
      stackAsciiOpacity: 0.7,
      stackAsciiBlend: "normal",
      stackOrder: "ditherFirst",
    },
  },
]

/* --- fusion drive shapes (IMPLEMENTED — PRD phase 21) ---
 *
 * WHAT THIS FAMILY IS NOW. It used to be "animated fusion": seven presets that
 * were the same eight compositions with a boolean flipped. That boolean was not
 * an axis — every non-animated preset already animated, and five of the seven
 * "animated" ones were measurably QUIETER than their sibling (one of them dead
 * still). See the taxonomy note at the top of lib/style-fusion.ts.
 *
 * So the family is no longer a second row of pills. It is the NAME AND
 * DESCRIPTION for each (preset x drive shape) combination: the Fusion panel
 * shows eight preset pills plus a Drive dial, and looks the active combination
 * up here to caption it. `selectPreset("animatedFusion", id)` still works and
 * every id that existed before still exists with its original label and
 * description, so nothing that referenced one has been taken away.
 *
 * The seven original ids keep their meaning. What is new is the coverage: Pixel
 * Clay finally has a second shape (it was the hole in the old 8 x 2 matrix), and
 * every preset has a Burst. Glitch Ribbon's "Controlled Break" is a BURST rather
 * than an arc, because that is what it always was — a schedule of events, not an
 * arrival — and its arc is a new one-tear arrival. */
function fusionShapeVariant(
  baseId: string,
  id: string,
  label: string,
  description: string,
  drive: FusionDrive,
): StylePreset {
  const base = FUSION_PRESET_DEFS.find((p) => p.id === baseId)!
  return {
    id,
    label,
    family: "animatedFusion",
    enabled: true,
    implemented: true,
    description,
    bestModes: base.bestModes,
    applies: {
      ...base.applies,
      fusionDrive: drive,
      // Legacy mirror, written here so the two can never disagree.
      fusionAnimationEnabled: drive !== "loop",
    },
  }
}

export const ANIMATED_FUSION_PRESET_DEFS: StylePreset[] = [
  /* ---- ARC: the relationship arrives with the draw, then settles ---- */
  fusionShapeVariant(
    "terminalGel",
    "terminalGelRevealBuild",
    "Terminal Gel Reveal Build",
    "The characters build from sparse to full with the draw-in, the gel's glow building with them, then hold a quiet breath; completion fires the shared pulse.",
    "arc",
  ),
  fusionShapeVariant(
    "ditherBloom",
    "ditherBloomThresholdOpen",
    "Dither Bloom Threshold Open",
    "The screen starts fully closed and OPENS once. Over the reveal, wetting the surface as it opens, then settling into a residual breath.",
    "arc",
  ),
  fusionShapeVariant(
    "signalInk",
    "signalInkDataFlow",
    "Signal Ink Data Flow",
    "The wire comes alive with the draw and the matrix's travel speed itself surges with the burst signal. Packets of pattern accelerate through the stroke as the glow spikes.",
    "arc",
  ),
  fusionShapeVariant(
    "asciiRubber",
    "asciiRubberSlowdown",
    "ASCII Rubber Slowdown",
    "When the draw completes, the character current decelerates elastically down to a slow crawl. And the shine band glides down with it.",
    "arc",
  ),
  fusionShapeVariant(
    "scanlineBalloon",
    "scanlineBalloonSoftPulse",
    "Scanline Balloon Soft Pulse",
    "The skin inflates over the draw. Lines spreading, surface tightening, then it keeps breathing gently instead of deflating to nothing.",
    "arc",
  ),
  fusionShapeVariant(
    "pixelClay",
    "pixelClayResolve",
    "Pixel Clay Resolve",
    "The clay arrives fully pixelated and relaxes back into clay as the draw lands, the grain returning and the sinter dulling. Then keeps trying.",
    "arc",
  ),
  fusionShapeVariant(
    "codeBloom",
    "codeBloomCharacterReveal",
    "Code Bloom Character Reveal",
    "Character density strictly follows the draw-in, the threshold opening beneath the characters as they arrive; completion flares the phosphor, and a quiet bloom stays.",
    "arc",
  ),
  fusionShapeVariant(
    "glitchRibbon",
    "glitchRibbonOneTear",
    "Glitch Ribbon One Tear",
    "The ribbon holds nearly still, tears ONCE as the draw lands. Every system breaks on that one impulse, then keeps a residual stutter.",
    "arc",
  ),
  fusionShapeVariant(
    "viewTurn",
    "viewTurnFirstLook",
    "Turn Table First Look",
    "The coupling arrives with the draw. The band and the oil sheen find the camera as the mark lands, and then stay locked to the view for good.",
    "arc",
  ),
  fusionShapeVariant(
    "slowWeather",
    "slowWeatherFrontMoves",
    "Slow Weather Front",
    "The weather rolls in over the draw and then keeps wandering: the pattern settles into its bite instead of arriving at it.",
    "arc",
  ),
  fusionShapeVariant(
    "formation",
    "formationFallIn",
    "Formation Fall In",
    "The layers find their formation as the stroke draws, the matrix's travel and the glyph density converging on the stack's rhythm, then hold it.",
    "arc",
  ),
  fusionShapeVariant(
    "wholeCloth",
    "wholeClothWeave",
    "Whole Cloth Weave",
    "All nine relationships arrive together over the draw. Every system comes into the weave at once, and then they stay woven at a quieter amplitude.",
    "arc",
  ),
  /* ⚠ A NEW RELATIONSHIP NEEDS THREE ENTRIES, NOT ONE, AND assert-fusion-ui IS
   * WHAT SAID SO — 2026-08-04.
   *
   * `findFusionShapeDef` resolves the caption from FUSION_PRESET_DEFS on Loop
   * and from THIS table on Arc and Burst. Still Wet and Letterpress shipped with
   * only their Loop definitions, so two thirds of each one's drive combinations
   * had no caption block at all — the panel rendered nothing there, and the gate
   * timed out reading it rather than reporting a wrong caption. Two rows of the
   * rail with no words on them, and only a gate looking at every combination
   * could see it: the pills were present, the state was correct, and the copy
   * was missing.
   *
   * They are authored, not templated. Each says what the SHAPE does to that
   * particular relationship, which is the only reason a per-drive caption is
   * worth having. */
  fusionShapeVariant(
    "stillWet",
    "stillWetSetting",
    "Still Wet Setting",
    "The wetness arrives with the stroke and sets behind it: the ink heavy and reflective under the pen, drying to a matte weight once the draw lands, and holding there.",
    "arc",
  ),
  fusionShapeVariant(
    "letterpress",
    "letterpressPull",
    "Letterpress Pull",
    "One pull of the press over the draw: the grain takes the type as the stroke arrives, biting hardest at the moment the impression lands, then easing to a held print.",
    "arc",
  ),

  /* ---- BURST: the relationship rests, and fires on discrete events ---- */
  fusionShapeVariant(
    "terminalGel",
    "terminalGelCharacterFlare",
    "Terminal Gel Character Flare",
    "The field holds, and every impulse flares the characters dense while the gel lights from within on the same event.",
    "burst",
  ),
  fusionShapeVariant(
    "ditherBloom",
    "ditherBloomInkFlood",
    "Dither Bloom Ink Flood",
    "The screen rests nearly dry, and each impulse floods it with ink. Dots merging and the surface going wet-dark together.",
    "burst",
  ),
  fusionShapeVariant(
    "signalInk",
    "signalInkPacketBurst",
    "Signal Ink Packet Burst",
    "Discrete packets instead of a rolling surge: each one washes the pattern out, spikes the glow and kicks the matrix sideways.",
    "burst",
  ),
  fusionShapeVariant(
    "asciiRubber",
    "asciiRubberTug",
    "ASCII Rubber Tug",
    "The current runs steady until it is TUGGED: each impulse jolts the glyph field forward and snaps the shine band along with it.",
    "burst",
  ),
  fusionShapeVariant(
    "scanlineBalloon",
    "scanlineBalloonTap",
    "Scanline Balloon Tap",
    "The skin rests taut and jumps on each tap. Lines springing apart and the surface flashing tight, then settling back.",
    "burst",
  ),
  fusionShapeVariant(
    "pixelClay",
    "pixelClayStutter",
    "Pixel Clay Stutter",
    "The clay stutters into pixels on each impulse and slumps back. Chunking, grain dissolving and sinter darkening on the same event.",
    "burst",
  ),
  fusionShapeVariant(
    "codeBloom",
    "codeBloomPacket",
    "Code Bloom Packet",
    "The code arrives in packets: each impulse thickens the characters and opens the stipple beneath them at exactly the same instant.",
    "burst",
  ),
  fusionShapeVariant(
    "glitchRibbon",
    "glitchRibbonControlledBreak",
    "Glitch Ribbon Controlled Break",
    "A choreographed cycle: calm, escalating stutters, one big tear at the peak, recovery. Every system breaking on the same impulse.",
    "burst",
  ),
  fusionShapeVariant(
    "viewTurn",
    "viewTurnCatchLight",
    "Turn Table Catch Light",
    "The view still owns the band, but the surface now CATCHES: each impulse snaps the oil sheen and the pattern, so turning the mark reads as facets rather than as a glide.",
    "burst",
  ),
  fusionShapeVariant(
    "slowWeather",
    "slowWeatherSquall",
    "Slow Weather Squall",
    "The wander rests and arrives in squalls: the pattern bites and the ink thickens in gusts instead of drifting.",
    "burst",
  ),
  fusionShapeVariant(
    "formation",
    "formationBreakStep",
    "Formation Break Step",
    "The formation holds and breaks step on each impulse: the whole group jolting together, which is the point of driving four systems from one clock.",
    "burst",
  ),
  fusionShapeVariant(
    "wholeCloth",
    "wholeClothShakeOut",
    "Whole Cloth Shake Out",
    "Everything rests, and every impulse shakes the whole cloth at once. Nine systems on nine drivers, all struck on the same beat.",
    "burst",
  ),
  fusionShapeVariant(
    "stillWet",
    "stillWetDropped",
    "Still Wet Dropped",
    "The mark sits dry, and each impulse is a fresh drop landing on it: a sudden dark, wet, glossy hit that soaks in and flattens back out.",
    "burst",
  ),
  fusionShapeVariant(
    "letterpress",
    "letterpressStrike",
    "Letterpress Strike",
    "The bed rests and the platen strikes: every impulse is one impression, the type biting into the grain and the ink jumping, then lifting away.",
    "burst",
  ),
]

/**
 * The definition that names a (preset, drive) combination, for captioning the
 * Fusion panel. Reads out of the registry above rather than duplicating the
 * mapping, so a combination can never be captioned with the wrong description.
 */
export function findFusionShapeDef(
  preset: FusionPreset,
  drive: FusionDrive,
): StylePreset | undefined {
  if (preset === "none") return undefined
  if (drive === "loop") return FUSION_PRESET_DEFS.find((p) => p.id === preset)
  return ANIMATED_FUSION_PRESET_DEFS.find(
    (p) => p.applies?.fusionPreset === preset && p.applies?.fusionDrive === drive,
  )
}

/* --- geometry animation ---
 *
 * EVERY PATCH IS COMPLETE, and that is the same law the composition families
 * follow: a preset FULLY DETERMINES what it owns. A partial take would mean
 * clicking two presets in a row left you with half of each, which is the
 * defect `railDefaults` exists to prevent one storey down.
 *
 * `completionPulse` is the one that is still a shell, and its reason is in its
 * own description rather than in a comment nobody reads: it needs the mark to
 * move AFTER it has arrived, and nothing in the engine does that. The whole
 * reveal is a prefix of a sorted key array, and a prefix cannot express a
 * settle. Building it is `docs/animation-toolset-map.md` §6.3, the per-stroke
 * transform work, which is capped at `FS_LETTER_MAX = 16`. */
/* HAND DRAW'S RATE (HAND-DRAW-3). Desk Doodles plays the logo's 15.55 s hand
 * record inside its 140/30 s draw beat (lib/hero-motion.ts, the draw beat), so
 * the word lands 3.333x faster than the pen model times it. A rate and not a
 * length, so a longer drawing takes longer, the way a longer word would.
 * assert-hand-clock.mjs holds the logo's take to 140/30 s within one frame, so
 * a change to the pen model that moves the record fails there, not quietly. */
export const HAND_DRAW_RATE = 3.333

/* DRAWIN-EXTRAS (2026-09-30). The draw-in extras every preset sets, each at
 * off, so Customize lists them under every draw-in preset and a preset still
 * fully determines the take. Off is main: nothing mounts and no clock moves. */
export const DRAW_IN_EXTRAS_OFF = {
  tipHighlight: 0,
  pressureReveal: 0,
  durationSeconds: 0,
} as const satisfies Partial<RevealEnvelopeParams>

export const GEOMETRY_ANIMATION_PRESET_DEFS: StylePreset[] = [
  {
    id: "authenticDraw",
    label: "Authentic Draw",
    family: "geometryAnimation",
    enabled: true,
    implemented: true,
    description: "Your hand's own pace and order, nothing shaped. The recording, played back.",
    motion: {
      drawIn: { order: "asDrawn", overlap: 0, align: "start", unit: "group", reverse: "off" },
      revealWindow: { mode: "grow", length: 0.25 },
      envelope: { mode: "raw", ease: "linear", delaySeconds: 0, loop: false, reverse: false, ...DRAW_IN_EXTRAS_OFF },
    },
  },
  {
    /* HAND-DRAW, 2026-09-26. Desk Doodles' pen model on his own strokes, see
     * docs/research-2026-09-26/pen-clock-on-slash-plan.md. HAND-DRAW-3 matched
     * it to Desk Doodles' playback: Natural, because the draw beat there reads
     * the hand through `REVEAL_ENVELOPE_DEFAULTS` (hybrid, blend 0.4,
     * components/viewport-3d.tsx), and `HAND_DRAW_RATE`, below. Every other
     * preset leaves `clock` and `rate` to the defaults spread in app/page.tsx,
     * so picking one after this goes back to `recorded` at 1x. */
    id: "handDraw",
    label: "Hand Draw",
    family: "geometryAnimation",
    enabled: true,
    implemented: true,
    description: "A modelled hand writes it: slower into corners, quicker through curves, a short lift inside a letter and a longer one between words.",
    motion: {
      drawIn: { order: "asDrawn", overlap: 0, align: "start", unit: "stroke", reverse: "off" },
      revealWindow: { mode: "grow", length: 0.25 },
      envelope: { mode: "hybrid", clock: "hand", rate: HAND_DRAW_RATE, ease: "linear", delaySeconds: 0, loop: false, reverse: false, ...DRAW_IN_EXTRAS_OFF },
    },
  },
  {
    id: "smoothReveal",
    label: "Smooth Reveal",
    family: "geometryAnimation",
    enabled: true,
    implemented: true,
    description: "Units overlap and the whole beat eases both ways, so the word arrives as one movement.",
    motion: {
      drawIn: { order: "asDrawn", overlap: 0.45, align: "start", unit: "group", reverse: "off" },
      revealWindow: { mode: "grow", length: 0.25 },
      envelope: { mode: "hybrid", ease: "inOut", delaySeconds: 0, loop: false, reverse: false, ...DRAW_IN_EXTRAS_OFF },
    },
  },
  {
    /* DRAWIN-EXTRAS, 2026-09-30. The one reveal style PRD Phase 22 names that
     * was never built: "authentic/smooth/presentation/snappy/slow gel"
     * (coverage row 15). Presentation is the take made to be watched: a fixed
     * length however long he drew, so a long signature and a short word play
     * the same in a deck, eased at both ends, units overlapping a little so
     * nothing sits still, and the tip lit so the eye follows the pen. The
     * values are this lane's reading of one word in the plan, not his; LOG.md
     * asks him. */
    id: "presentationDraw",
    label: "Presentation",
    family: "geometryAnimation",
    enabled: true,
    implemented: true,
    description: "Made to be watched: four seconds however long you drew it, eased at both ends, with a light riding the pen.",
    motion: {
      drawIn: { order: "asDrawn", overlap: 0.2, align: "start", unit: "group", reverse: "off" },
      revealWindow: { mode: "grow", length: 0.25 },
      envelope: { mode: "hybrid", ease: "inOut", delaySeconds: 0.4, loop: false, reverse: false, ...DRAW_IN_EXTRAS_OFF, durationSeconds: 4, tipHighlight: 0.6 },
    },
  },
  {
    id: "snappyDraw",
    label: "Snappy Draw",
    family: "geometryAnimation",
    enabled: true,
    implemented: true,
    description: "One stroke at a time, hard off the mark and slowing toward the last.",
    motion: {
      drawIn: { order: "asDrawn", overlap: 0, align: "start", unit: "stroke", reverse: "off" },
      revealWindow: { mode: "grow", length: 0.25 },
      envelope: { mode: "hybrid", ease: "out", delaySeconds: 0, loop: false, reverse: false, ...DRAW_IN_EXTRAS_OFF },
    },
  },
  {
    id: "slowGel",
    label: "Slow Gel",
    family: "geometryAnimation",
    enabled: true,
    implemented: true,
    description: "A beat of blank page, then every unit eases in and lands together. Slow at both ends.",
    motion: {
      drawIn: { order: "asDrawn", overlap: 0.85, align: "end", unit: "group", reverse: "off" },
      revealWindow: { mode: "grow", length: 0.25 },
      envelope: { mode: "hybrid", ease: "inOut", delaySeconds: 0.6, loop: false, reverse: false, ...DRAW_IN_EXTRAS_OFF },
    },
  },
  {
    id: "loopingStroke",
    label: "Looping Stroke",
    family: "geometryAnimation",
    enabled: true,
    implemented: true,
    description: "A window of ink runs the length of the mark, then starts again.",
    motion: {
      drawIn: { order: "asDrawn", overlap: 0.2, align: "start", unit: "group", reverse: "off" },
      revealWindow: { mode: "travel", length: 0.3 },
      envelope: { mode: "hybrid", ease: "linear", delaySeconds: 0.4, loop: true, reverse: false, ...DRAW_IN_EXTRAS_OFF },
    },
  },
  {
    id: "completionPulse",
    label: "Completion Pulse",
    family: "geometryAnimation",
    enabled: true,
    implemented: false,
    description: "Needs the mark to move after it has arrived. Nothing in the engine does that yet.",
  },
]

/** Family 14 only. The take a motion preset asks for, or undefined for the one
 *  that is still a shell. Same separation and same reason as
 *  `resolveGeometryPreset` and `resolveViewPreset`. */
export function resolveMotionPreset(
  id: string | null,
  state?: Pick<StyleState, "customPresets">,
): MotionPresetPatch | undefined {
  if (!id) return undefined
  /* With `state`, his saved ones resolve too (MOTION-CUSTOM): a Mine draw-in
   * preset carries `motion` like the shipped five. */
  const p = state ? findPresetIn(state, id) : ALL_PRESETS.find((x) => x.id === id)
  return p?.family === "geometryAnimation" ? p.motion : undefined
}

/**
 * PRESET_REGISTRY — single source of truth grouping every family's presets.
 * The UI reads families/presets from here; the debug readout resolves the
 * active preset from here too.
 */
export const PRESET_REGISTRY: Record<PresetFamily, StylePreset[]> = {
  geometry: GEOMETRY_PRESET_DEFS,
  view: VIEW_PRESET_DEFS,
  material: MATERIAL_PRESET_DEFS,
  animatedMaterial: ANIMATED_MATERIAL_PRESET_DEFS,
  texture: TEXTURE_PRESET_DEFS,
  animatedTexture: ANIMATED_TEXTURE_PRESET_DEFS,
  dither: DITHER_PRESET_DEFS,
  animatedDither: ANIMATED_DITHER_PRESET_DEFS,
  ascii: ASCII_PRESET_DEFS,
  animatedAscii: ANIMATED_ASCII_PRESET_DEFS,
  layerStack: LAYER_STACK_PRESET_DEFS,
  stackAnimation: STACK_ANIMATION_PRESET_DEFS,
  fusion: FUSION_PRESET_DEFS,
  animatedFusion: ANIMATED_FUSION_PRESET_DEFS,
  geometryAnimation: GEOMETRY_ANIMATION_PRESET_DEFS,
}

/**
 * Families the preset rail SHOWS, in UI order.
 *
 * ⚠ THIS LIST IS A SHIPPING GATE, NOT A LABEL TABLE. A family appears here only
 * when selecting one of its members actually does the thing the member's name
 * says. The alternative — listing a family early — is a rail of pills that reset
 * nothing, apply nothing, and leave the summary chip naming a preset that never
 * ran. That exact shape shipped once already as the six geometry-ANIMATION pills
 * and is the reason `applyPresetToStyleState` carries an inertness guard.
 *
 * GEOMETRY AND VIEW ARE NOW ON IT, AND THE SECOND LIST IS GONE.
 *
 * They were held off because their patches are a MODE + dials (five useState
 * hooks in app/page.tsx) and imperative camera/export calls — neither reachable
 * by `applyPresetToStyleState`, which refuses both families outright. That
 * routing has since landed (`applyGeometryPresetById` / `applyViewPresetById`),
 * so the gate's own condition was met; but the opt-in was declared in the
 * CONSUMER, as `ROUTED_FAMILIES` + `RAIL_FAMILY_OPTIONS` in
 * components/style-panel-scaffold.tsx, because this module belonged to another
 * live lane. That was the correct concurrency move and it left a real cost: the
 * question "which families does the rail show" had two answers, in two files,
 * and only one of them was what the user saw.
 *
 * The consumer wrote down how to collapse it and it is followed here verbatim —
 * the two rows appended LAST, in `ROUTED_FAMILIES`' own order, with its own
 * labels, so `RAIL_FAMILY_OPTIONS` now dedupes to exactly this array and the
 * rendered rail is unchanged. `enabled` is `true` on both families' members for
 * the same reason: it means "appears in the UI list", they do appear, and a
 * field whose documented meaning is false for 20 of 139 presets is a field the
 * next reader will trust and be wrong about.
 *
 * Membership here does NOT imply the patch flows through
 * `applyPresetToStyleState` — that is what `NON_STYLE_FAMILIES` says, and the
 * two must not be conflated again. `assert-style-contracts.mjs` §7 holds the
 * line.
 */
export const PRESET_FAMILY_OPTIONS: { id: PresetFamily; label: string }[] = [
  { id: "material", label: "Material" },
  { id: "animatedMaterial", label: "Animated Material" },
  { id: "texture", label: "Texture" },
  { id: "animatedTexture", label: "Animated Texture" },
  { id: "dither", label: "Dither" },
  { id: "animatedDither", label: "Animated Dither" },
  { id: "ascii", label: "ASCII" },
  { id: "animatedAscii", label: "Animated ASCII" },
  { id: "layerStack", label: "Layer Stack" },
  { id: "stackAnimation", label: "Stack Animation" },
  { id: "fusion", label: "Fusion" },
  { id: "animatedFusion", label: "Animated Fusion" },
  { id: "geometryAnimation", label: "Geometry Animation" },
  /* Routed by app/page.tsx, not by applyPresetToStyleState. Appended LAST, in
   * this order, with these labels, because that is exactly what the consumer's
   * `RAIL_FAMILY_OPTIONS` union produced — the collapse must not move a pill. */
  { id: "geometry", label: "Geometry" },
  { id: "view", label: "View / Export" },
]

/**
 * Flat list of every preset across families (for data integrity checks).
 *
 * IT ENUMERATES THE REGISTRY, NOT THE UI LIST — that was a real drop, not a
 * style preference. Built from `PRESET_FAMILY_OPTIONS`, this array silently
 * omitted every family the rail did not happen to show, so `findPreset` could
 * not resolve a preset that existed, and any integrity check written on top of
 * it was checking a subset it had no way to notice was a subset. With the
 * geometry, view and animatedMaterial families populated that would have been
 * 31 presets invisible to `findPreset`. The registry is the source of truth;
 * the UI list is a view of it.
 */
export const ALL_PRESETS: StylePreset[] = (
  Object.keys(PRESET_REGISTRY) as PresetFamily[]
).flatMap((f) => PRESET_REGISTRY[f])

/** Resolve a preset by id (searches all families). */
export function findPreset(id: string | null): StylePreset | undefined {
  if (!id) return undefined
  return ALL_PRESETS.find((p) => p.id === id)
}

/* ---------------------------- applying a preset --------------------------- */
/**
 * SELECTING A PRESET IS NOT A SHALLOW MERGE.
 *
 * It used to be — `{ ...state, ...preset.applies }` — and a shallow merge over
 * a shared state object means every preset inherits whatever the last one left
 * behind in fields it does not happen to mention. Measured consequences, both
 * of which read to a user as "these options are broken":
 *
 *   - Pick an animated texture preset (`textureAnimated: true`), then a static
 *     one. The static preset never mentions `textureAnimated`, so the pattern
 *     keeps crawling. Every static preset in the rail is contaminated for the
 *     rest of the session by one click on an animated one.
 *   - Pick any Layer Stack preset (`layerStackEnabled: true`,
 *     `stackTextureOpacity: 0.35`), then a Texture preset. The stack stays on
 *     and silently multiplies the new texture down to a third of the strength
 *     the preset was tuned at — so the texture rail's presets all look weak,
 *     and only after visiting the stack rail.
 *
 * THE RULE, in two parts.
 *
 *   1. A preset from any COMPOSITION family (texture / dither / ascii / stack /
 *      stack animation / fusion, and their animated variants) fully determines
 *      the layer composition. Selecting one resets every composition rail to
 *      DEFAULT_STYLE_STATE first, then applies its patch. What you see is what
 *      the preset says, every time, from any starting point.
 *   2. MATERIAL IS ORTHOGONAL. A material preset changes only the material
 *      rail and leaves the layers alone; a composition preset leaves the
 *      material alone unless its own patch names one (the Layer Stack presets
 *      do — a stack is a whole look, body included).
 *
 * Anything outside the style rails — geometry mode, engine, camera, the reveal
 * clock, the custom-material editor's contents — is never touched.
 */
const COMPOSITION_RAIL_KEYS = [
  // texture
  "textureMode", "textureEnabled", "textureAnimated", "textureType",
  "textureScale", "textureIntensity", "textureContrast", "textureSpeed",
  "texturePhase", "textureDirection", "textureSyncMode", "textureDelay",
  "textureLockMode",
  // dither
  "ditherEnabled", "ditherAnimated", "ditherType", "ditherScale",
  "ditherThreshold", "ditherContrast", "ditherSpeed", "ditherDirection",
  "ditherIntensity", "ditherLevels", "ditherExposure", "ditherAngle",
  "ditherSyncMode", "ditherDelay", "ditherLockMode",
  // ascii
  "asciiEnabled", "asciiAnimated", "asciiCharset", "asciiCellSize",
  "asciiDensity", "asciiContrast", "asciiScrollSpeed", "asciiDirection",
  "asciiAnimationType", "asciiLockMode", "asciiSyncMode", "asciiDelay",
  // stack + stack animation
  "layerStackEnabled", "stackTextureOpacity", "stackDitherOpacity",
  "stackAsciiOpacity", "stackDitherBlend", "stackAsciiBlend", "stackOrder",
  "stackAnimationEnabled", "stackAnimationType", "stackAnimationSpeed",
  "stackAnimationPhase", "stackAnimationOpacity",
  // fusion
  "fusionPreset", "fusionDrive", "fusionAnimationEnabled", "fusionAnimationSpeed",
  "fusionIntensity", "fusionSwing",
  // shared motion clock
  "motionMode", "styleLoopSeconds",
] as const satisfies readonly (keyof StyleState)[]

/**
 * THE STACK-ANIMATION RAIL — the group's own fields, and ONLY those.
 *
 * WHY IT EXISTS, measured on the shipped build. Every stack-animation preset
 * was classed as a COMPOSITION preset, so selecting one ran
 * `railDefaults(COMPOSITION_RAIL_KEYS)` first — and that sets `textureEnabled`,
 * `ditherEnabled` and `asciiEnabled` to false. Those pills sit in the Layers
 * panel directly underneath the layer sliders, so the gesture "I have built a
 * composition, now make the group drift" DELETED the composition and left an
 * animated stack with nothing in it. The preset then reported itself active on
 * the summary chip. It is the same shape as the geometry-animation landmine —
 * a control that does the opposite of nothing — arriving through the rule that
 * was written to prevent contamination.
 *
 * The rule was right for its own family and wrong here. A composition preset
 * FULLY DETERMINES the composition; a stack-animation preset fully determines
 * the GROUP'S MOTION and must leave the group's contents alone. So it resets
 * exactly its own five fields and nothing else, which still gives the
 * no-inheritance guarantee (pick Drift after Whisper and the opacity returns to
 * 1) without reaching outside its scope.
 */
const STACK_ANIMATION_RAIL_KEYS = [
  "stackAnimationEnabled",
  "stackAnimationType",
  "stackAnimationSpeed",
  "stackAnimationPhase",
  "stackAnimationOpacity",
] as const satisfies readonly (keyof StyleState)[]

const MATERIAL_FAMILIES: ReadonlySet<PresetFamily> = new Set([
  "material",
  "animatedMaterial",
])

/** Modifies the GROUP without replacing what is in it. See the block above. */
const GROUP_FAMILIES: ReadonlySet<PresetFamily> = new Set(["stackAnimation"])

/**
 * Families that own NO style state at all — their patch is geometry or camera.
 * `applyPresetToStyleState` refuses them: it returns the state UNCHANGED, does
 * not record the selection, and leaves the caller to route the real patch.
 *
 * Refusing rather than recording is the point. If this function recorded
 * `activePresetId` for a geometry preset it had no way to apply, the summary
 * chip would name a preset that never ran — which is the exact lie the
 * inertness guard below was added to stop, re-entering through a different
 * door. A no-op that is visibly a no-op is safe; a no-op that leaves a receipt
 * is not.
 */
export const NON_STYLE_FAMILIES: ReadonlySet<PresetFamily> = new Set<PresetFamily>([
  "geometry",
  "view",
  /* Family 14. Its patch is the take, which lives in `lib/stroke-schedule.ts`
   * and is held by `app/page.tsx`. `applyPresetToStyleState` refusing it here
   * is what keeps the `inert` guard below from being the thing that catches it:
   * a family with a real patch this function cannot apply is not inert, it is
   * misrouted, and those are different bugs. */
  "geometryAnimation",
])

function railDefaults(keys: readonly (keyof StyleState)[]): Partial<StyleState> {
  const out: Record<string, unknown> = {}
  for (const k of keys) out[k] = DEFAULT_STYLE_STATE[k]
  return out as Partial<StyleState>
}

/**
 * Produces the next style state for a preset selection. Pure — the caller owns
 * the setState. Exported so the UI and the verification harness exercise ONE
 * implementation of the rule rather than two that can drift.
 *
 * Note what a material preset does NOT reset: `materialAnimation*`. Those are a
 * separate control surface with no preset rail of their own, so resetting them
 * here would silently switch off an animation the user set up elsewhere. The
 * material rail a material preset owns is exactly the surface identity.
 */
export function applyPresetToStyleState(
  state: StyleState,
  family: PresetFamily,
  id: string,
): StyleState {
  const preset = findPresetIn(state, id)
  const isMaterial = MATERIAL_FAMILIES.has(family)

  /* NOT STYLE STATE AT ALL — refuse, and leave no receipt. See
   * NON_STYLE_FAMILIES. The caller routes `preset.geometry` / `preset.view`
   * itself (resolveGeometryPreset / resolveViewPreset) and owns the selection
   * bookkeeping, because it is the only layer that knows whether the patch
   * actually landed. */
  if (NON_STYLE_FAMILIES.has(family)) return state

  /* A PRESET WITH NO RENDERER MUST NOT DESTROY THE COMPOSITION.
   *
   * Found 2026-08-01 by the product audit, and it is the worst class of defect
   * in this repo: a control that does the OPPOSITE of nothing. The six
   * `geometryAnimation` presets are `enabled: true, implemented: false` and
   * carry no `applies` patch at all. Clicking one therefore ran the composition
   * reset below and applied nothing on top of it — so "Slow Gel" silently wiped
   * the user's texture, dither, ASCII, stack, fusion and motion mode back to
   * defaults, and then set `activePresetId` so the summary chip proudly read
   * "Preset · Slow Gel" while the screen had just been emptied.
   *
   * The reset exists so that a preset FULLY DETERMINES the composition. A
   * preset that determines nothing has no business resetting anything, so the
   * guard is on exactly that: no patch and no renderer means the selection is
   * recorded and the composition is left alone. The pill is also disabled in
   * the UI (style-panel-scaffold.tsx) — this is the second line of defence,
   * because the dev harness reaches this function directly.
   */
  const inert = !preset?.implemented && !preset?.applies
  if (inert) {
    return { ...state, activePresetFamily: family, activePresetId: id }
  }

  /* WHICH RAIL THIS FAMILY OWNS. Material owns the surface and resets nothing
   * else; a GROUP preset owns the group's motion and must not empty the group
   * (see STACK_ANIMATION_RAIL_KEYS for the defect that rule fixes); everything
   * else is a composition and owns the whole composition. */
  const reset = isMaterial
    ? null
    : GROUP_FAMILIES.has(family)
      ? railDefaults(STACK_ANIMATION_RAIL_KEYS)
      : railDefaults(COMPOSITION_RAIL_KEYS)

  const merged = {
    ...state,
    ...reset,
    ...(preset?.applies ?? {}),
    // Choosing a material from the rail IS an explicit choice, so it must
    // survive a geometry-mode switch. Without this the mode's default material
    // silently overwrote the preset the user had just clicked.
    ...(isMaterial && preset?.applies?.materialPreset
      ? { materialUserOverride: true }
      : null),
    activePresetFamily: family,
    activePresetId: id,
    lastAppliedPresetId: preset?.implemented ? id : state.lastAppliedPresetId,
  }

  /* ── WAKE WHAT THE RELATIONSHIP READS — ON EVERY PATH, NOT JUST THE EDITOR ──
   *
   * Sebs, 2026-08-04: *"few issues with fusion. Some dont animate."*
   *
   * `fusionWakePatch` derives, from a fusion's OWN links, the composition those
   * links need in order to carry a signal — the fix for "a brand-new custom
   * fusion is born unable to act". It was wired in exactly two places, both in
   * the custom-fusion editor (components/style-panel-scaffold.tsx :2229 on
   * select, :2252 on create). `grep -c fusionWakePatch lib/style-system.ts` was
   * **0**, so the twelve BUILT-IN pills — which route
   * `onSelectPreset("fusion", id)` -> `handleSelectPreset` -> here — never ran
   * it. Two doors into one feature, one of them with the wake behind it.
   *
   * ⚠ AND IT IS NOT WHAT IS WRONG TODAY, WHICH IS WORTH SAYING PLAINLY RATHER
   * THAN LETTING THE FIX IMPLY A BUG IT DID NOT FIND. Measured before this edit
   * (`scripts/verify/_probe-fusion-builtin-sleep.mjs`, which drives THIS
   * function): all four link-authored built-ins already landed with **0 links
   * asleep**, because each one's `applies` patch was hand-authored to switch on
   * exactly what its links read. The gap is a LATENT one: the correctness lived
   * in twelve hand-written patches instead of in the derivation, so it held only
   * for as long as every author remembered. A thirteenth preset, or a link added
   * to an existing one, would ship asleep with nothing to catch it.
   *
   * So this is the derivation taking over from the memory. It is applied AFTER
   * the preset's own patch, so it can only ADD what the composition is missing —
   * on today's rail it adds nothing at all, and `assert-fusion-newborn`'s new
   * built-in rows assert exactly that, calibrated against a preset with its wake
   * deliberately stripped so the row has an arm it must go red on. */
  if (family === "fusion" && merged.fusionPreset && merged.fusionPreset !== "none") {
    const links = BUILTIN_LINK_FUSIONS[merged.fusionPreset]
    if (links) {
      Object.assign(merged, fusionWakePatch(links, merged, resolveFusionDrive(merged)).patch)
    }
  }

  /* A PRESET THAT TURNS MATERIAL ANIMATION ON WAKES THE CLOCK.
   *
   * The renderer gates Material animation on Motion Off (viewport-3d.tsx,
   * `animOn`), and none of the ten Animated Material rail presets writes
   * `motionMode`. The default is "off", so without this line every one of them
   * would do nothing on a fresh page. Derived here rather than written into
   * ten patches, for the same reason as the fusion wake above. Only Off moves:
   * a user who chose Sync to Draw keeps it. The Material Animation switch in
   * style-panel-scaffold.tsx carries the same rule for the manual door. */
  if (preset?.applies?.materialAnimationEnabled === true && merged.motionMode === "off") {
    merged.motionMode = "independent"
  }

  /* THE SAME TRAP ON THE STACK RAIL. The renderer gates the group on Motion Off
   * (viewport-3d.tsx, `stackAnimOn`), the Stack Animation switch already moves
   * Off to Independent, and none of the twelve stack presets wrote `motionMode`.
   * Night S, 2026-09-25, measured on a composed stack (grain + Bayer + ASCII,
   * all static) from a fresh `/`: 0 of 12 moved with Motion left at Off, 10 of 12
   * moved 9,546 to 16,007 px with Independent written first. Only Off moves. */
  if (preset?.applies?.stackAnimationEnabled === true && merged.motionMode === "off") {
    merged.motionMode = "independent"
  }

  return merged
}

/* ---------------------- geometry presets: resolving ---------------------- */

/**
 * The complete geometry control surface, flattened into one plain object.
 *
 * This mirrors, field for field, the five useState hooks in app/page.tsx:
 * `geometryMode`, `widthSlider`, `extrudeParams`, `solidParams`,
 * `inflateParams`. It exists so that applying a geometry preset — and, just as
 * importantly, UNDOING one — is a pure function that can be tested in node,
 * rather than five setState calls sprinkled through a component.
 *
 * `extrudeWidthSlider` is the normalised t, not the raw half-width: t is the
 * control the user has, and `mapExtrudeWidthSlider` (lib/geometry-engines.ts)
 * is the only thing that should ever convert it. Keeping the raw width out of
 * this type is what stops the two from drifting.
 */
/* ── CUSTOM UNDER EVERY PRESET (ANIM-4, 2026-09-26) ─────────────────────────
 *
 * His phase 4 ruling: every preset opens into the fields it sets, and he can
 * save his own. A saved preset is a `StylePreset` whose `applies` holds the
 * current values of exactly the fields the preset it came from sets. It lives in
 * `StyleState.customPresets`, so it persists with the document and every save,
 * rename and delete goes through the one recorded setter as one undo step.
 */
export const MINE_PREFIX = "mine:"

export function isMinePreset(p: StylePreset | undefined): boolean {
  return !!p && p.id.startsWith(MINE_PREFIX)
}

/** Shipped presets first, then his. The one lookup every apply goes through. */
export function findPresetIn(state: Pick<StyleState, "customPresets">, id: string | null): StylePreset | undefined {
  if (!id) return undefined
  return findPreset(id) ?? (state.customPresets ?? []).find((p) => p.id === id)
}

/* A PRESET'S FIELDS, ONE MODEL FOR BOTH HALVES (MOTION-CUSTOM, 2026-09-26).
 * Most families set style state through `applies`. Family 14 sets the take
 * through `motion`, and page.tsx holds the take, not StyleState. Customize,
 * Reset and Save as mine read both through the functions below, keyed flat: a
 * style field by its own name, a take field as `drawIn.overlap`,
 * `revealWindow.mode` or `envelope.ease`. Before this, `presetFields` read only
 * `applies`, so a draw-in preset had no fields and Customize never rendered. */
export type MotionFieldKey =
  | `drawIn.${keyof DrawInParams & string}`
  | `revealWindow.${keyof RevealWindowParams & string}`
  | `envelope.${keyof RevealEnvelopeParams & string}`
export type PresetFieldKey = keyof StyleState | MotionFieldKey

/** The take a motion field reads: the three objects page.tsx holds. */
export interface TakeState {
  drawIn: DrawInParams
  revealWindow: RevealWindowParams
  revealEnvelope: RevealEnvelopeParams
}
const MOTION_PARTS = ["drawIn", "revealWindow", "envelope"] as const
type MotionPart = (typeof MOTION_PARTS)[number]
const TAKE_KEY: Record<MotionPart, keyof TakeState> = {
  drawIn: "drawIn",
  revealWindow: "revealWindow",
  envelope: "revealEnvelope",
}

export function isMotionField(k: string): k is MotionFieldKey {
  const i = k.indexOf(".")
  return i > 0 && (MOTION_PARTS as readonly string[]).includes(k.slice(0, i))
}
function splitMotion(k: MotionFieldKey): [MotionPart, string] {
  const i = k.indexOf(".")
  return [k.slice(0, i) as MotionPart, k.slice(i + 1)]
}

/** Every value a preset sets, keyed flat. `applies` first, then `motion`. */
function presetValues(p: StylePreset | undefined): Record<string, unknown> {
  const out: Record<string, unknown> = { ...(p?.applies ?? {}) }
  for (const part of MOTION_PARTS) {
    for (const [k, v] of Object.entries((p?.motion?.[part] ?? {}) as Record<string, unknown>)) out[`${part}.${k}`] = v
  }
  return out
}

/** The live value of one field: style state, or the take for a motion field. */
function liveValue(state: StyleState, take: TakeState | undefined, k: PresetFieldKey): unknown {
  if (!isMotionField(k)) return state[k]
  const [part, sub] = splitMotion(k)
  return (take?.[TAKE_KEY[part]] as unknown as Record<string, unknown> | undefined)?.[sub]
}

/** Exported for Customize's read-only list, which shows a field's live value. */
export const presetLiveValue = liveValue

/** The fields a preset sets, read off its own definition and nothing else. */
export function presetFields(p: StylePreset | undefined): PresetFieldKey[] {
  /* GATE ONLY. assert-motion-customize.mjs sets this in its must-fail pass to
   * put back the applies-only read, so every Customize row can be seen to fail.
   * A production build reads it as false: Next inlines NODE_ENV there, so the
   * window flag is never looked at, the same rule as `__fsViewBlocker`. */
  const appliesOnly =
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    (window as unknown as { __FS_GATE_MUTATE?: string }).__FS_GATE_MUTATE === "presetFields-applies-only"
  return Object.keys(appliesOnly ? { ...(p?.applies ?? {}) } : presetValues(p)) as PresetFieldKey[]
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Fields whose current value is not the value the preset sets. Empty = untouched.
 *  A motion field is compared against `take`; with no take it cannot be read,
 *  so it is left out rather than guessed. */
export function presetEditedFields(state: StyleState, p: StylePreset | undefined, take?: TakeState): PresetFieldKey[] {
  const values = presetValues(p)
  return presetFields(p).filter((k) => (isMotionField(k) && !take ? false : !sameValue(liveValue(state, take, k), values[k])))
}

/** Put one style field back to the value the preset sets. A motion field lives
 *  in the take, so it is `presetTakeReset`'s job and this leaves state alone. */
export function resetPresetField(state: StyleState, p: StylePreset, key: PresetFieldKey): StyleState {
  if (isMotionField(key)) return state
  const applies = (p.applies ?? {}) as Record<string, unknown>
  if (!(key in applies)) return state
  return { ...state, [key]: structuredClone(applies[key]) }
}

/** The take patch that puts these motion fields back to the preset's values,
 *  one part per object the caller writes. Style keys are skipped. */
export function presetTakeReset(p: StylePreset, keys: readonly PresetFieldKey[]): MotionPresetPatch {
  const values = presetValues(p)
  const out: Record<string, Record<string, unknown>> = {}
  for (const k of keys) {
    if (!isMotionField(k) || !(k in values)) continue
    const [part, sub] = splitMotion(k)
    ;(out[part] ??= {})[sub] = structuredClone(values[k])
  }
  return out as MotionPresetPatch
}

/** Store the current values of every field `base` sets as a new preset of his.
 *  A motion preset stores the live take, so it needs `take`. */
export function saveMinePreset(state: StyleState, base: StylePreset, label: string, id: string, take?: TakeState): StyleState {
  const applies: Record<string, unknown> = {}
  const motion: Record<string, Record<string, unknown>> = {}
  for (const k of presetFields(base)) {
    if (!isMotionField(k)) {
      applies[k] = structuredClone(state[k])
      continue
    }
    if (!take) throw new Error(`saveMinePreset: ${base.label} sets the take, and no take was passed`)
    const [part, sub] = splitMotion(k)
    ;(motion[part] ??= {})[sub] = structuredClone(liveValue(state, take, k))
  }
  const mine: StylePreset = {
    id: id.startsWith(MINE_PREFIX) ? id : MINE_PREFIX + id,
    label: label.trim() || base.label,
    family: base.family,
    description: `Saved from ${isMinePreset(base) ? base.label : `${base.label}, edited`}.`,
    enabled: true,
    implemented: base.implemented,
    applies: applies as Partial<StyleState>,
    ...(base.motion ? { motion: motion as MotionPresetPatch } : {}),
  }
  return {
    ...state,
    customPresets: [...(state.customPresets ?? []), mine],
    activePresetFamily: base.family,
    activePresetId: mine.id,
    lastAppliedPresetId: mine.implemented ? mine.id : state.lastAppliedPresetId,
  }
}

export function renameMinePreset(state: StyleState, id: string, label: string): StyleState {
  const name = label.trim()
  if (!name) return state
  return {
    ...state,
    customPresets: (state.customPresets ?? []).map((p) => (p.id === id ? { ...p, label: name } : p)),
  }
}

/** Deleting his preset keeps the picture as it is; it only stops naming it. */
export function deleteMinePreset(state: StyleState, id: string): StyleState {
  return {
    ...state,
    customPresets: (state.customPresets ?? []).filter((p) => p.id !== id),
    activePresetId: state.activePresetId === id ? null : state.activePresetId,
    lastAppliedPresetId: state.lastAppliedPresetId === id ? null : state.lastAppliedPresetId,
  }
}

export interface GeometrySettings {
  mode: GeometryModeId
  extrudeWidthSlider: number
  extrudeDepth: number
  extrudeBevelEnabled: boolean
  extrudeSideWall: "straight" | "drafted"
  solidThickness: number
  solidDepth: number
  inflateFusion: "auto" | "loft" | "implicit"
  inflateBlend: number
  inflateResolution: number
  inflateLoopEnds: "wrapped" | "capped"
}

/** The geometry patch a preset asks for, or undefined if `id` is not one. */
export function resolveGeometryPreset(id: string | null): GeometryPresetPatch | undefined {
  if (!id) return undefined
  const p = ALL_PRESETS.find((x) => x.id === id && x.family === "geometry")
  return p?.geometry
}

/** True when selecting this preset would move the user out of the mode they
 *  are standing in. The panel uses it to say so before the click, because a
 *  preset that silently changes mode is a preset that appears to have broken
 *  the app. */
export function geometryPresetChangesMode(
  currentMode: GeometryModeId,
  id: string,
): boolean {
  const patch = resolveGeometryPreset(id)
  return !!patch && patch.mode !== currentMode
}

/**
 * Applies a geometry preset to a full settings object and returns the next one.
 * Pure, total, and REVERSIBLE by construction: the caller keeps the object it
 * passed in, and restoring it restores the mode and every dial exactly, so
 * "undo the preset" is one assignment rather than a per-mode special case.
 *
 * DOES SELECTING A GEOMETRY PRESET SWITCH MODE? Yes, and it has to — PRD §6
 * names "Solid Cutout" and "Soft Balloon Stroke" in the same family as
 * "Ribbon Strip", so the family only means anything if a member can move you.
 * The rule is that it changes MODE plus that mode's own dials and NOTHING else:
 * a preset naming Extrude leaves the Solid and Inflate dials exactly where the
 * user left them, so switching away and back is lossless. That is why every
 * field below is written from `current` unless the patch names it.
 */
export function applyGeometryPreset(
  current: GeometrySettings,
  id: string,
): GeometrySettings | undefined {
  const patch = resolveGeometryPreset(id)
  if (!patch) return undefined
  const e = patch.extrude
  const s = patch.solid
  const i = patch.inflate
  return {
    mode: patch.mode,
    extrudeWidthSlider: e?.widthSlider ?? current.extrudeWidthSlider,
    extrudeDepth: e?.depth ?? current.extrudeDepth,
    extrudeBevelEnabled: e?.bevelEnabled ?? current.extrudeBevelEnabled,
    extrudeSideWall: e?.sideWall ?? current.extrudeSideWall,
    solidThickness: s?.thickness ?? current.solidThickness,
    solidDepth: s?.depth ?? current.solidDepth,
    inflateFusion: i?.fusion ?? current.inflateFusion,
    inflateBlend: i?.blend ?? current.inflateBlend,
    inflateResolution: i?.resolution ?? current.inflateResolution,
    inflateLoopEnds: i?.loopEnds ?? current.inflateLoopEnds,
  }
}

/* ------------------------ view presets: resolving ------------------------ */

/** The camera/export patch a preset asks for, or undefined if `id` is not one. */
export function resolveViewPreset(id: string | null): ViewPresetPatch | undefined {
  if (!id) return undefined
  const p = ALL_PRESETS.find((x) => x.id === id && x.family === "view")
  return p?.view
}

/**
 * What each view preset is still WAITING ON, named in code rather than in a
 * doc that rots. A member with an empty list is fully expressible with the
 * capabilities that exist today (`__captureHarness.orbitView` for the framing,
 * `handleExportGLB` / `handleExportPNG` for the write); a member with entries
 * is not, and the entries say exactly what is missing.
 *
 * This is the difference between "Family 15 is missing" and "Family 15 is
 * half-buildable and here is which half" — and it is what stops the two
 * unbuildable members from being quietly downgraded into still framings so the
 * rail can look full.
 */
/**
 * What a view preset is still waiting on. Empty = it can be selected.
 *
 * ⚠ IT IS EMPTY FOR EVERY MEMBER AS OF 2026-08-03, and both entries that used to
 * be here were removed for the same reason: they had stopped being true, and
 * neither the table nor any gate noticed on its own.
 *
 * THE TURNTABLE ENTRY read:
 *
 *     "camera turntable: OrbitControls is mounted without autoRotate
 *      (components/viewport-3d.tsx:4768) and nothing else spins the camera"
 *
 * By then the turntable was built and filmed (spin ON Δpx 72.64 against OFF
 * 0.00), the cited line had moved, and three separate things were holding the
 * error in place: `portfolioSpin.implemented` was `false`, so the registry's
 * `implemented === has no blocker` row was green on two mistakes at once;
 * `components/style-panel-scaffold.tsx` filtered this exact string by prefix to
 * make the pill clickable anyway, coupling two modules through a sentence; and
 * `assert-view-presets` was left printing STALE BLOCKER at it. All three were
 * fixed together, because fixing any one alone turns the registry row red.
 *
 * THE VIDEO ENTRY went the same way, in two steps on the same day. It first read
 * "no writer exists — the app has handleExportGLB and handleExportPNG only (PRD
 * §12 puts video at export v4)", and every clause of that was false:
 * `lib/export/encoders.ts` ships a WebCodecs VP9/VP8 WebM encoder with a
 * lossless APNG fallback, `lib/export/` plans and locks the frames, and
 * `components/viewport-3d.tsx` exposes `exportVideo` on the viewport API beside
 * `exportGLB` and `exportPNG`. Corrected, it named the real gap — one missing
 * `else if (patch.export?.target === "video")` in `applyViewPresetById` — and
 * was left standing because a one-click multi-second render that writes a file
 * to disk is a product call. Sebs made it ("yes ofc wire video export"), the
 * `else if` is in app/page.tsx, and the entry goes with it.
 *
 * ── WHY THIS FUNCTION STAYS, RETURNING NOTHING ──────────────────────────────
 * Not as a stub. `presetIsSelectable` (components/style-panel-scaffold.tsx) and
 * `applyViewPresetById` (app/page.tsx) both call it, and it is the ONE place a
 * member that outruns the app again gets to say so — the alternative is the
 * string-prefix filter that was just removed, or a preset that half-runs. The
 * shape is what makes the next blocker a two-line change instead of a
 * re-architecture.
 *
 * A blocker here is a claim about the tree, so the gates check it AGAINST the
 * tree rather than trusting it: `assert-preset-registry` §4 and
 * `assert-style-contracts` §5 read app/page.tsx for the video route and
 * components/viewport-3d.tsx for `autoRotate`, and go red if this table and
 * those files ever disagree — in either direction.
 */
/**
 * WHAT THE COMPOSITION IS MISSING FOR THIS FAMILY TO SHOW, or null.
 *
 * Distinct from `viewPresetBlockers`, and the difference is the whole reason
 * this is a second function rather than an arm of that one: that names a
 * CAPABILITY the build does not have yet, and it is answered by shipping code.
 * This names a STATE the document is not in, and it is answered by one click.
 *
 * MEASURED 2026-09-05, all twelve stack-animation presets driven through the
 * pill's own router: from the app default **0 of 12 moved a pixel**, and
 * against grain + Bayer 4x4 + Classic ASCII **11 of 12 moved**, 2,449 to
 * 13,337 px. The presets were never the suspect and are not broken. Each one
 * already sets `layerStackEnabled` and `stackAnimationEnabled` itself.
 *
 * What a preset cannot set is CONTENT. The app opens with `textureEnabled`,
 * `ditherEnabled` and `asciiEnabled` all false, so the preset arms an EMPTY
 * stack, and animating nothing moves nothing. Choosing a texture on the user's
 * behalf would be picking an aesthetic they did not ask for, so the preset
 * correctly does not, and the panel says so instead.
 *
 * ⚠ THE PILL STAYS CLICKABLE ON PURPOSE. Arming the animation and then adding
 * the layer is a real order to work in, and a disabled pill would forbid it.
 * The note is the honest half: the click DID land, and here is why nothing
 * changed on screen.
 */
export function presetStateGap(family: PresetFamily, s: StyleState): string | null {
  if (family !== "stackAnimation") return null
  if (s.textureEnabled || s.ditherEnabled || s.asciiEnabled) return null
  return "The layer stack is empty, so there is nothing here to animate. Turn on Texture, Dither or ASCII and this will show."
}

export function viewPresetBlockers(id: string): string[] {
  const patch = resolveViewPreset(id)
  if (!patch) return []
  const out: string[] = []
  /* Nothing left to declare. Every member's capability — orbit framing, the
   * turntable, GLB, PNG and now video — is in the tree and reachable from
   * `applyViewPresetById`. Add a member that needs something new and push the
   * ask here, naming the capability and the file it is missing from; do NOT
   * name a symptom, and do not name a file you have not opened. Both prior
   * entries cited a line number, and both line numbers were wrong by the time
   * anyone read them. */

  /* ⚠ …WHICH MADE A REAL UI STATE UNREACHABLE, AND THAT IS ITS OWN DEFECT.
   *
   * `applyViewPresetById` raises "<preset> is not buildable yet" when this
   * function returns anything, and `presetIsSelectable` greys the pill and puts
   * the reason in its tooltip. With the last real blocker gone, NOTHING IN THE
   * REPO CAN MAKE EITHER APPEAR — the exact category app/page.tsx's own CRASH
   * LAW block was written about ("code that reads correct and has never
   * presented a frame"), and `assert-shell-states` had been filming that toast
   * through `videoPreviewExport` until this pass.
   *
   * The repo already has an answer for a real recovery surface with no way in,
   * and it is not to delete the surface: a `window.__fs*` law that is inert in
   * production and inert unless explicitly set (`__fsCrashViewport`,
   * `__fsSweepLaw`, `__fsExportGround`, `__fsExportReentry`). This is that,
   * for the refusal path. It injects a blocker for ONE named preset id so the
   * shell state stays reachable and filmable, and it says in its own text that
   * it is synthetic — a blocker that lied about being real would be worse than
   * no blocker at all. */
  if (
    process.env.NODE_ENV !== "production" &&
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__fsViewBlocker === id
  ) {
    out.push(
      "dev law __fsViewBlocker: a SYNTHETIC blocker, not a real gap. It exists so the" +
        '"not buildable yet" refusal (app/page.tsx) and the greyed pill with its reason ' +
        "(components/style-panel-scaffold.tsx) stay reachable now that every member is built.",
    )
  }
  return out
}

/* ====================================================================== */
/* ANIMATED MATERIAL v1 — surface-response evaluation.                     */
/* ---------------------------------------------------------------------- */
/* `evaluateMaterialAnimation` takes the static base params plus a clock   */
/* and returns the params to apply THIS FRAME. It only ever modulates      */
/* surface response (emissive / clearcoat / roughness / sheen). It never   */
/* returns geometry, reveal-clock, or export-affecting values.             */
/*                                                                          */
/* `completion` is the stroke draw-in progress (0..1). It is read ONLY to  */
/* drive "completionFlash" as an accent; the geometry reveal itself is     */
/* unaffected — Animated Material is preview decoration on top.            */
/* ====================================================================== */

export interface MaterialAnimationInput {
  base: MaterialParams
  type: MaterialAnimationType
  /** Seconds (already scaled by the caller's clock; speed applied here). */
  time: number
  speed: number
  /** 0..1 intensity from the panel. */
  intensity: number
  /** Stroke draw-in progress 0..1 (for completionFlash). */
  completion: number
  /** Seconds since the draw-in reached 100% (Infinity if it never has, 0 while
   *  drawing). Lets completionFlash actually DECAY — with only `completion`
   *  the flash froze at its completion-1.0 value forever. */
  sinceCompletion?: number
  /** Seconds since this animation TYPE was selected. Paired with
   *  `sinceCompletion` through `completionTrigger` so a one-shot keyed to the
   *  draw finishing is still reachable when the user picks it on a stroke that
   *  finished a minute ago. Omitted = arming is ignored (old behaviour). */
  sinceArmed?: number
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Scale a #rrggbb hex toward black (k=1 → unchanged, k=0 → black). Used by
 *  the wet-look darkening in roughnessPulse; cheap enough for per-frame use. */
function scaleHex(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.round(((n >> 16) & 0xff) * k)
  const g = Math.round(((n >> 8) & 0xff) * k)
  const b = Math.round((n & 0xff) * k)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`
}

/* All animations below modulate ONLY physical material properties (clearcoat,
 * roughness, clearcoatRoughness, reflectivity, envMapIntensity, sheen,
 * metalness) — never the albedo color. The scene's studio Environment +
 * Lightformers give those properties something to reflect, so changing how the
 * surface interacts with light reads clearly without faking it by lightening
 * the base color. Emissive is only used where it is the material's own behavior
 * (the Signal preset is screen-lit) or as an explicit accent (completionFlash). */
export function evaluateMaterialAnimation(input: MaterialAnimationInput): MaterialParams {
  const { base, type, intensity, completion } = input
  const t = input.time * input.speed
  const k = clamp01(intensity)
  const p: MaterialParams = { ...base }

  switch (type) {
    case "none":
      return p

    // Shine sweep: the visible effect is a POSITIONAL band of highlight that
    // travels across the form — that is per-fragment work and lives in the
    // shader (lib/texture-shader.ts SWEEP_* injections, band center driven
    // from viewport-3d's frame loop). The old version here was a global gloss
    // wave — the whole surface brightening and dimming together — which never
    // read as a "sweep" at all. This case now only holds the surface in a
    // CONSTANT, slightly receptive state (a touch more coat + reflection) so
    // the band has a live specular field to roll over; nothing oscillates
    // globally anymore.
    case "shineSweep": {
      p.clearcoat = clamp01(base.clearcoat + 0.25 * k)
      p.reflectivity = clamp01(base.reflectivity + 0.2 * k)
      p.envMapIntensity = base.envMapIntensity + 0.4 * k
      return p
    }

    // Breathing sheen: the soft retroreflective sheen layer grows and tightens
    // while a touch of clearcoat fades in — the velvety rim glow swells and
    // recedes. Forces a visible sheen color on bases that have none (sheen
    // with a black sheenColor is arithmetic, not light).
    case "gelShimmer": {
      const s = (Math.sin(t * 2.4) + 1) / 2
      p.sheen = clamp01(Math.max(base.sheen, 0.5) + s * 0.5 * k)
      p.sheenRoughness = clamp01(base.sheenRoughness * (1 - s * 0.65 * k))
      const shimmerColor = base.sheenColor === "#000000" ? "#b9c8dd" : base.sheenColor
      p.sheenColor = shimmerColor
      p.clearcoat = clamp01(base.clearcoat + s * 1.0 * k)
      p.clearcoatRoughness = clamp01(base.clearcoatRoughness * (1 - s * 0.8 * k))
      p.reflectivity = clamp01(base.reflectivity + s * 0.5 * k)
      p.roughness = clamp01(base.roughness * (1 - s * 0.5 * k))
      p.envMapIntensity = base.envMapIntensity * (1 + s * 2.2 * k) + s * 1.6 * k
      // Inner glow: sheen/clearcoat/env are all VIEW-ANGLE dependent — at the
      // scale a stroke occupies they were measured near-invisible live (mean
      // frame delta ~0.02). A soft emissive breath in the sheen's own color is
      // angle-independent: a gel genuinely reads as glowing faintly from
      // within when light passes through it, so this is the material's own
      // behavior, not a fake accent.
      if (base.emissive === "#000000") {
        p.emissive = shimmerColor
        p.emissiveIntensity = s * 0.55 * k
      }
      return p
    }

    // Matte <-> glossy: roughness makes a big swing between dry/scattered and
    // smooth/reflective, with clearcoat and env reflection rising as it
    // smooths. The additive env floor is what makes this land on the matte
    // presets it exists for (clay/chalk sit at envMapIntensity ≤ 0.15, so a
    // multiplier alone kept them matte — confirmed invisible in the live
    // check at every frame of the cycle).
    case "roughnessPulse": {
      const s = (Math.sin(t * 2.0) + 1) / 2
      // At default 50% intensity the peak must still land near-mirror
      // (roughness ~0.2, glazed clearcoat), otherwise the pulse dies on the
      // matte presets it exists for — measured invisible at the 0.95 swing.
      p.roughness = clamp01(base.roughness - s * 1.6 * k)
      p.clearcoat = clamp01(base.clearcoat + s * 1.2 * k)
      p.clearcoatRoughness = clamp01(
        base.clearcoatRoughness - (base.clearcoatRoughness - 0.03) * s * Math.min(1, 1.6 * k),
      )
      p.envMapIntensity = base.envMapIntensity * (1 + s * 2.0 * k) + s * 2.6 * k
      // WET-LOOK darkening. All the reflectance levers above are view-angle
      // dependent and were measured near-invisible at stroke scale in the
      // live window (mean frame delta ≤0.03 across a full cycle). What is
      // angle-independent — and what a matte surface genuinely does when it
      // gets wet — is DARKEN: water fills the micro-pores and absorbs light.
      // Dry clay ↔ dark wet gloss is the readable version of this pulse.
      p.color = scaleHex(base.color, 1 - s * 0.45 * k)
      return p
    }

    // Accent when the stroke completes: emissive + clearcoat flash that ramps
    // in over the last stretch of the draw and then DECAYS on a real clock.
    // The old version froze at its completion=1.0 value forever (the "flash"
    // was a permanent gray glow — visible in the live frames as a stroke that
    // stayed lit seconds after the draw ended). One-shot accent: fast decay
    // (~0.4s to half) so it reads as an event, per the "exits should be
    // snappy" rule.
    case "completionFlash": {
      // REACHABILITY. `sinceCompletion` alone made this the clearest example of
      // an option that "just doesn't do anything": the playhead rests at 1
      // after any draw, so by the time the user selects Completion Flash the
      // decay has been running for tens of seconds and `flash` is 0 on the
      // first frame and every frame after. Pairing completion with arming
      // (`completionTrigger`) means selecting it on a finished stroke plays the
      // flash once, which is the only way a user can ever see what it does.
      const since = completionTrigger(
        input.sinceCompletion ?? Infinity,
        input.sinceArmed ?? Infinity,
      )
      const ramp = clamp01((completion - 0.8) / 0.2) // 0 → 1 over the last 20%
      // Struck-bell envelope, matching the pulses in style-clock / style-stack:
      // a ~90 ms attack so the peak is actually seen, then the fast settle.
      // A bare decay peaked on frame one and only its tail was ever visible.
      //
      // SPEED SCALES THE CLOCK, AND UNTIL THIS PASS IT DID NOT. Every other
      // behaviour in this switch reads `t = time * speed`; completionFlash read
      // neither, so the panel's Speed slider was arithmetically dead for the
      // whole time this type was selected — a dial that moves and changes
      // nothing, on the one behaviour whose entire character is its LENGTH.
      // Running the envelope on `since * speed` makes Speed mean what it says
      // here (below 1 the flash hangs on, above 1 it snaps), and leaves the
      // default speed of 1 byte-identical to the shipped behaviour.
      const fs = since === Infinity ? Infinity : since * (input.speed || 1)
      const decay =
        fs === Infinity ? 1 : fs < 0.09 ? fs / 0.09 : Math.exp(-(fs - 0.09) * 1.8)
      const flash = ramp * ramp * decay
      p.emissive = "#b9c6d2"
      p.emissiveIntensity = base.emissiveIntensity + flash * 2.2 * k
      p.clearcoat = clamp01(base.clearcoat + flash * 0.6 * k)
      p.clearcoatRoughness = clamp01(base.clearcoatRoughness * (1 - flash * 0.7 * k))
      p.envMapIntensity = base.envMapIntensity * (1 + flash * 1.8 * k) + flash * 0.8 * k
      return p
    }

    // Digital flicker for Signal: the surface is screen-lit, so its own
    // emissive output jitters; metalness + reflectivity + env flicker
    // alongside it so the reflections strobe like an unstable display. The
    // hard dropout (brief near-black blink a couple of times per cycle) is
    // what makes it read as a FAULTY sign rather than a gentle shimmer.
    case "signalFlicker": {
      const slow = (Math.sin(t * 3) + 1) / 2
      const fast = (Math.sin(t * 21.3) + Math.sin(t * 13.7)) / 2 // ~-1..1
      const flick = clamp01(0.5 + 0.5 * fast)
      const drop = (t * 0.9) % 1 < 0.06 ? 0.12 : 1 // hard blink
      const baseEm = Math.max(base.emissiveIntensity, 0.4)
      p.emissive = base.emissive === "#000000" ? "#1f6e8c" : base.emissive
      p.emissiveIntensity = (baseEm + (slow * 0.6 + flick * 1.4) * k) * drop
      p.metalness = clamp01(base.metalness + (flick - 0.5) * 0.4 * k)
      p.reflectivity = clamp01(base.reflectivity + (flick - 0.5) * 0.4 * k)
      p.envMapIntensity = base.envMapIntensity * (1 + flick * 1.2 * k) * drop
      return p
    }

    default:
      return p
  }
}

