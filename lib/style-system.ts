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
 * The fine-grained per-system flags (textureAnimated, ditherAnimated, …) and
 * the detailed `syncMode` remain in state for future panels; `motionMode` is
 * the single clear control the user sees today. No renderer reads it yet.
 */
export type MotionMode = "off" | "independent" | "syncToDraw"

/** Generic animation curve identifier reused by several style systems. */
export type StyleAnimationType =
  | "none"
  | "pulse"
  | "wave"
  | "flicker"
  | "drift"
  | "breathe"

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

export type FusionPreset =
  | "none"
  | "inkBleed"
  | "gelMelt"
  | "claySinter"
  | "signalGlitch"

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

// Stack types live in style-stack.ts (next to the blend GLSL they describe).
// Imported so StyleState can reference them, re-exported so consumers still get
// the whole style model from one module.
import type { StackBlendMode, StackOrder } from "./style-stack"
export type { StackBlendMode, StackOrder }

/* ------------------------------ style state ------------------------------ */

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
  textureType: string
  textureScale: number
  textureIntensity: number
  textureContrast: number
  textureSpeed: number
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
  stackAnimationSpeed: number
  stackAnimationPhase: number
  stackAnimationSyncMode: StyleSyncMode

  /* --- fusion --- */
  fusionPreset: FusionPreset
  fusionAnimationEnabled: boolean
  fusionAnimationType: StyleAnimationType
  fusionAnimationSpeed: number
  fusionIntensity: number

  /* --- global sync / clock --- */
  textureLockMode: TextureLockMode
  /** Coarse user-facing motion control (top bar). See MotionMode. */
  motionMode: MotionMode
  syncMode: StyleSyncMode
  syncToReveal: boolean
  globalStyleTime: number
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
  customMaterial: {
    color: "#2a2a2a",
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.4,
    sheen: 0.0,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 1.0,
  },

  textureMode: "none",
  textureEnabled: false,
  textureAnimated: false,
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
  stackAnimationSyncMode: "independent",

  fusionPreset: "none",
  fusionAnimationEnabled: false,
  fusionAnimationType: "none",
  fusionAnimationSpeed: 1,
  fusionIntensity: 0.5,

  textureLockMode: "object",
  motionMode: "off",
  syncMode: "independent",
  syncToReveal: false,
  globalStyleTime: 0,
  styleLoopSeconds: 4,

  activePresetFamily: "material",
  activePresetId: null,
  lastAppliedPresetId: null,
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
  /** Thin-film thickness range in nm. Wider range = the film sweeps through
   *  more interference orders across the form, i.e. MORE distinct rainbow
   *  hues visible at once. Absent = three.js default [100, 400]. */
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
    envMapIntensity: 0.12,
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
    envMapIntensity: 0.4,
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
  // White porcelain: the first LIGHT preset. COOL blue-white body under a
  // hard WET glaze — roughness low enough that the env rig's slats reflect as
  // crisp shapes head-on, which is the glaze read. Separation from chalk is
  // now double-coded so it survives a single head-on view: temperature (cool
  // vs warm-dusty) AND surface (tight mirror glaze vs zero specular + powder
  // bloom). Live-judged: at roughness 0.22 / env 1.3 the glaze only appeared
  // on orbit and the two pale presets collapsed head-on.
  ceramic: {
    color: "#e2e6ea",
    roughness: 0.12,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    reflectivity: 0.9,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 1.8,
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
    envMapIntensity: 0.05,
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
    emissiveIntensity: 2.4,
    envMapIntensity: 0.4,
  },
  // Oil-slick: thin-film iridescence over dark METAL gloss — the reflection
  // color shifts with view angle. Unique mechanism (iridescence), not a tint.
  // Three levers make the rainbow read at stroke scale (live-judged; the old
  // 0.15-rough / 0.3-metal / default-thickness version was a faint tint):
  //   1. thickness range widened to 120–800 nm — the film sweeps several
  //      interference ORDERS across one curved tube, so multiple distinct
  //      hues are visible simultaneously instead of one slow shift;
  //   2. metalness up — the colored film modulates a strong reflection
  //      instead of a weak dielectric one;
  //   3. roughness down — interference colors are coherent only on a smooth
  //      film; roughness smears them back to gray.
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
    iridescenceThicknessRange: [120, 800],
  },
  // Custom — the editable base. Starts as a neutral mid surface; the actual
  // values come from styleState.customMaterial (merged in resolveMaterialParams).
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
export function resolveMaterialParams(
  preset: MaterialPreset,
  custom?: CustomMaterial,
): MaterialParams {
  const base = { ...MATERIAL_PARAMS[preset] }
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
  { id: "inkBleed", label: "Ink Bleed" },
  { id: "gelMelt", label: "Gel Melt" },
  { id: "claySinter", label: "Clay Sinter" },
  { id: "signalGlitch", label: "Signal Glitch" },
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
}

/* --- material (IMPLEMENTED: maps to existing materialPreset state) --- */
export const MATERIAL_PRESET_DEFS: StylePreset[] = [
  { id: "ink", label: "Ink", family: "material", enabled: true, implemented: true, applies: { materialPreset: "ink" } },
  { id: "softGel", label: "Soft Gel", family: "material", enabled: true, implemented: true, applies: { materialPreset: "softGel" }, bestModes: ["inflate", "solid"] },
  { id: "matteClay", label: "Matte Clay", family: "material", enabled: true, implemented: true, applies: { materialPreset: "matteClay" }, bestModes: ["solid", "extrude"] },
  { id: "glossyPlastic", label: "Glossy Plastic", family: "material", enabled: true, implemented: true, applies: { materialPreset: "glossyPlastic" }, bestModes: ["inflate"] },
  { id: "rubber", label: "Rubber", family: "material", enabled: true, implemented: true, applies: { materialPreset: "rubber" }, bestModes: ["inflate", "rod"] },
  { id: "signal", label: "Signal", family: "material", enabled: true, implemented: true, applies: { materialPreset: "signal" }, bestModes: ["rod", "extrude"] },
  { id: "ceramic", label: "Ceramic", family: "material", enabled: true, implemented: true, description: "White porcelain under a hard glaze.", applies: { materialPreset: "ceramic" }, bestModes: ["solid", "inflate"] },
  { id: "chalk", label: "Chalk", family: "material", enabled: true, implemented: true, description: "Bone-dry plaster — warm, dusty, zero shine.", applies: { materialPreset: "chalk" }, bestModes: ["solid"] },
  { id: "chrome", label: "Chrome", family: "material", enabled: true, implemented: true, description: "Full-metal mirror — the surface is the room.", applies: { materialPreset: "chrome" }, bestModes: ["extrude", "inflate"] },
  { id: "gold", label: "Gold", family: "material", enabled: true, implemented: true, description: "Warm polished brass-gold metal.", applies: { materialPreset: "gold" }, bestModes: ["extrude", "solid"] },
  { id: "wax", label: "Wax", family: "material", enabled: true, implemented: true, description: "Amber honey-wax with a soft bloom.", applies: { materialPreset: "wax" }, bestModes: ["inflate", "solid"] },
  { id: "neon", label: "Neon", family: "material", enabled: true, implemented: true, description: "Self-lit hot-pink tube (glow, no post bloom).", applies: { materialPreset: "neon" }, bestModes: ["rod"] },
  { id: "iridescent", label: "Iridescent", family: "material", enabled: true, implemented: true, description: "Oil-slick thin film — swirling multi-hue shift.", applies: { materialPreset: "iridescent" }, bestModes: ["inflate", "extrude"] },
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
      ditherContrast: 0.5,
      ditherThreshold: 0.5,
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
      ditherLockMode: "screen",
    },
  },
  {
    id: "softDither",
    label: "Soft Dither",
    family: "dither",
    enabled: true,
    implemented: true,
    description: "Noise-threshold dither at more tone levels — least aggressive.",
    applies: {
      ditherEnabled: true,
      ditherType: "blueNoise",
      ditherScale: 2,
      ditherLevels: 4,
      ditherIntensity: 0.75,
      ditherContrast: 0.45,
      ditherThreshold: 0.5,
      ditherLockMode: "screen",
    },
  },
  {
    id: "pixelSignal",
    label: "Pixel Signal",
    family: "dither",
    enabled: true,
    implemented: true,
    description: "Chunky 8x8 Bayer, high contrast. Most digital.",
    bestModes: ["rod", "extrude"],
    applies: {
      ditherEnabled: true,
      ditherType: "bayer8",
      ditherScale: 5,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherContrast: 0.7,
      ditherThreshold: 0.5,
      ditherLockMode: "screen",
    },
  },
]

/* --- animated dither (IMPLEMENTED v1) ---
 * Animated dither = THRESHOLD MOTION (the matrix/threshold moves), which is a
 * different thing from animated texture (pattern motion) and animated ascii
 * (glyph motion). */
export const ANIMATED_DITHER_PRESET_DEFS: StylePreset[] = [
  {
    id: "ditherCrawl",
    label: "Dither Crawl",
    family: "animatedDither",
    enabled: true,
    implemented: true,
    description: "The threshold matrix drifts slowly across the frame.",
    applies: {
      ditherEnabled: true,
      ditherAnimated: true,
      ditherType: "bayer4",
      ditherScale: 3,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherSpeed: 0.5,
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
    description: "The threshold BIAS oscillates — tone opens and closes.",
    applies: {
      ditherEnabled: true,
      ditherAnimated: true,
      ditherType: "bayer8",
      ditherScale: 4,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherSpeed: 0.8,
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
    description: "Threshold follows the geometry draw-in progress.",
    applies: {
      ditherEnabled: true,
      ditherAnimated: true,
      ditherType: "bayer4",
      ditherScale: 3,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherSpeed: 1,
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
    description: "Halftone dots pulse open as the reveal completes.",
    applies: {
      ditherEnabled: true,
      ditherAnimated: true,
      ditherType: "halftone",
      ditherScale: 6,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherSpeed: 1.2,
      ditherDirection: "static",
      ditherLockMode: "screen",
      motionMode: "syncToDraw",
    },
  },
  {
    id: "diagonalMatrixDrift",
    label: "Diagonal Matrix Drift",
    family: "animatedDither",
    enabled: true,
    implemented: true,
    description: "8x8 Bayer matrix drifts diagonally at speed.",
    applies: {
      ditherEnabled: true,
      ditherAnimated: true,
      ditherType: "bayer8",
      ditherScale: 5,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherSpeed: 1.5,
      ditherDirection: "diagonal",
      ditherLockMode: "screen",
      motionMode: "independent",
    },
  },
]

/* --- ascii (IMPLEMENTED v1 — glyph renderer is live) ---
 * ASCII presets write only ascii* state. ASCII = GLYPHS, a third machine
 * distinct from texture (pattern) and dither (threshold). */
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
      asciiCellSize: 9,
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
    bestModes: ["rod", "extrude"],
    applies: {
      asciiEnabled: true,
      asciiCharset: "minimal",
      asciiCellSize: 10,
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
      asciiCellSize: 11,
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
      asciiCellSize: 9,
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
      asciiCellSize: 8,
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
      asciiCellSize: 9,
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
    description: "Each column falls at its own speed — glyphs stream downward.",
    applies: {
      asciiEnabled: true,
      asciiAnimated: true,
      asciiAnimationType: "rain",
      asciiCharset: "minimal",
      asciiCellSize: 9,
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
      asciiCellSize: 10,
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
      asciiCellSize: 9,
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
      asciiCellSize: 9,
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
      asciiCellSize: 10,
      asciiScrollSpeed: 0.35,
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
  // "one visible feature-cycle every ~1–1.5s at default settings" — at the
  // old speeds a band took ~4s to cross one stripe width and read as static.
  {
    id: "grainDrift",
    label: "Grain Boil",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "Film-grain speckle re-rolls and crawls — a constant boil.",
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureMode: "grain",
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
      textureMode: "scanlines",
      textureScale: 1.0,
      textureIntensity: 0.75,
      textureContrast: 0.7,
      textureSpeed: 2.2,
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
      textureMode: "contour",
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
      textureMode: "bands",
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
      textureMode: "noise",
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
      textureMode: "ripple",
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
      textureMode: "cellular",
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
      textureMode: "crosshatch",
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
      textureMode: "dots",
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
    description: "Ink with a visible tooth of grain. Nothing dominates — the form leads.",
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
    description: "All three layers, deliberately restrained — sparse glyphs lead, dither and scanlines whisper.",
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
]

/* --- fusion (definitions only) --- */
export const FUSION_PRESET_DEFS: StylePreset[] = [
  { id: "terminalGel", label: "Terminal Gel", family: "fusion", enabled: true, implemented: false },
  { id: "ditherBloom", label: "Dither Bloom", family: "fusion", enabled: true, implemented: false },
  { id: "signalInk", label: "Signal Ink", family: "fusion", enabled: true, implemented: false },
  { id: "asciiRubber", label: "ASCII Rubber", family: "fusion", enabled: true, implemented: false },
  { id: "scanlineBalloon", label: "Scanline Balloon", family: "fusion", enabled: true, implemented: false },
  { id: "pixelClay", label: "Pixel Clay", family: "fusion", enabled: true, implemented: false },
  { id: "codeBloom", label: "Code Bloom", family: "fusion", enabled: true, implemented: false },
  { id: "glitchRibbon", label: "Glitch Ribbon", family: "fusion", enabled: true, implemented: false },
]

/* --- animated fusion (definitions only) --- */
export const ANIMATED_FUSION_PRESET_DEFS: StylePreset[] = [
  { id: "terminalGelRevealBuild", label: "Terminal Gel Reveal Build", family: "animatedFusion", enabled: true, implemented: false },
  { id: "ditherBloomThresholdOpen", label: "Dither Bloom Threshold Open", family: "animatedFusion", enabled: true, implemented: false },
  { id: "signalInkDataFlow", label: "Signal Ink Data Flow", family: "animatedFusion", enabled: true, implemented: false },
  { id: "asciiRubberSlowdown", label: "ASCII Rubber Slowdown", family: "animatedFusion", enabled: true, implemented: false },
  { id: "scanlineBalloonSoftPulse", label: "Scanline Balloon Soft Pulse", family: "animatedFusion", enabled: true, implemented: false },
  { id: "glitchRibbonControlledBreak", label: "Glitch Ribbon Controlled Break", family: "animatedFusion", enabled: true, implemented: false },
  { id: "codeBloomCharacterReveal", label: "Code Bloom Character Reveal", family: "animatedFusion", enabled: true, implemented: false },
]

/* --- geometry animation (definitions only) --- */
export const GEOMETRY_ANIMATION_PRESET_DEFS: StylePreset[] = [
  { id: "authenticDraw", label: "Authentic Draw", family: "geometryAnimation", enabled: true, implemented: false },
  { id: "smoothReveal", label: "Smooth Reveal", family: "geometryAnimation", enabled: true, implemented: false },
  { id: "snappyDraw", label: "Snappy Draw", family: "geometryAnimation", enabled: true, implemented: false },
  { id: "slowGel", label: "Slow Gel", family: "geometryAnimation", enabled: true, implemented: false },
  { id: "loopingStroke", label: "Looping Stroke", family: "geometryAnimation", enabled: true, implemented: false },
  { id: "completionPulse", label: "Completion Pulse", family: "geometryAnimation", enabled: true, implemented: false },
]

/**
 * PRESET_REGISTRY — single source of truth grouping every family's presets.
 * The UI reads families/presets from here; the debug readout resolves the
 * active preset from here too.
 */
export const PRESET_REGISTRY: Record<PresetFamily, StylePreset[]> = {
  geometry: [],
  material: MATERIAL_PRESET_DEFS,
  animatedMaterial: [],
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

/** Families that actually have presets to show (non-empty), in UI order. */
export const PRESET_FAMILY_OPTIONS: { id: PresetFamily; label: string }[] = [
  { id: "material", label: "Material" },
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
]

/** Flat list of every preset across families (for data integrity checks). */
export const ALL_PRESETS: StylePreset[] = PRESET_FAMILY_OPTIONS.flatMap(
  (f) => PRESET_REGISTRY[f.id],
)

/** Resolve a preset by id (searches all families). */
export function findPreset(id: string | null): StylePreset | undefined {
  if (!id) return undefined
  return ALL_PRESETS.find((p) => p.id === id)
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
      const since = input.sinceCompletion ?? Infinity
      const ramp = clamp01((completion - 0.8) / 0.2) // 0 → 1 over the last 20%
      const decay = since === Infinity ? 1 : Math.exp(-since * 1.8)
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

