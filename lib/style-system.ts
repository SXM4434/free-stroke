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

/** How a texture/effect is anchored as the camera or geometry moves. */
export type TextureLockMode = "screen" | "object" | "surface" | "stroke"

/** How style animation phase relates to the geometry reveal/animation clock. */
export type StyleSyncMode =
  | "independent"
  | "revealSynced"
  | "strokeTimeSynced"
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

export type DitherType = "bayer4" | "bayer8" | "blueNoise" | "halftone" | "lines"
export type DitherDirection = "static" | "horizontal" | "vertical" | "diagonal"

export type AsciiCharset = "blocks" | "classic" | "minimal" | "dots" | "custom"
export type AsciiDirection = "static" | "horizontal" | "vertical"

export type FusionPreset =
  | "none"
  | "inkBleed"
  | "gelMelt"
  | "claySinter"
  | "signalGlitch"

export type StackAnimationType = "none" | "offset" | "cascade" | "shuffle" | "pulse"

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

  /* --- dither --- */
  ditherEnabled: boolean
  ditherAnimated: boolean
  ditherType: DitherType
  ditherScale: number
  ditherThreshold: number
  ditherContrast: number
  ditherSpeed: number
  ditherDirection: DitherDirection

  /* --- ascii --- */
  asciiEnabled: boolean
  asciiAnimated: boolean
  asciiCharset: AsciiCharset
  asciiCellSize: number
  asciiDensity: number
  asciiContrast: number
  asciiScrollSpeed: number
  asciiDirection: AsciiDirection

  /* --- layer stack --- */
  layerStackEnabled: boolean
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

  ditherEnabled: false,
  ditherAnimated: false,
  ditherType: "bayer4",
  ditherScale: 1,
  ditherThreshold: 0.5,
  ditherContrast: 0.5,
  ditherSpeed: 1,
  ditherDirection: "static",

  asciiEnabled: false,
  asciiAnimated: false,
  asciiCharset: "blocks",
  asciiCellSize: 8,
  asciiDensity: 0.5,
  asciiContrast: 0.5,
  asciiScrollSpeed: 1,
  asciiDirection: "static",

  layerStackEnabled: false,
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
}

export const MATERIAL_PARAMS: Record<MaterialPreset, MaterialParams> = {
  // Dark glossy gel-ink: the original brand default (hard clearcoat, sharp spec).
  ink: {
    color: "#1a1a1a",
    roughness: 0.32,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.12,
    reflectivity: 0.6,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 1.0,
  },
  // Softer, fuller, balloon/gel feel: higher roughness + strong diffuse sheen,
  // gentle clearcoat, lighter so the sheen reads. Best for Inflate / Solid.
  softGel: {
    color: "#2a2a2e",
    roughness: 0.55,
    metalness: 0.0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.55,
    reflectivity: 0.35,
    sheen: 1.0,
    sheenRoughness: 0.7,
    sheenColor: "#6a7a8a",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 0.7,
  },
  // Matte, dry, low-spec clay: very high roughness, no clearcoat, no sheen, and
  // notably lighter so it reads as a soft dry surface (not just "dark").
  matteClay: {
    color: "#3a3a38",
    roughness: 1.0,
    metalness: 0.0,
    clearcoat: 0.0,
    clearcoatRoughness: 1.0,
    reflectivity: 0.1,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 0.15,
  },
  // Smooth shiny plastic: very low roughness, full clearcoat, crisp bright
  // highlight + strong env reflection. The "wet/glossy" extreme.
  glossyPlastic: {
    color: "#101013",
    roughness: 0.08,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.85,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 1.6,
  },
  // Soft rubber: high roughness, no hard clearcoat, warm sheen so it reads
  // softer/matte-satin and clearly different from ink.
  rubber: {
    color: "#22201e",
    roughness: 0.85,
    metalness: 0.0,
    clearcoat: 0.05,
    clearcoatRoughness: 0.9,
    reflectivity: 0.2,
    sheen: 0.6,
    sheenRoughness: 0.95,
    sheenColor: "#4a3f38",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 0.4,
  },
  // Digital "signal": metallic, smooth, with a clear cool emissive so it reads
  // screen-lit / digital. The most chromatic preset while still restrained.
  signal: {
    color: "#0f1418",
    roughness: 0.22,
    metalness: 0.55,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
    reflectivity: 0.8,
    sheen: 0.0,
    sheenRoughness: 0.5,
    sheenColor: "#000000",
    emissive: "#1f5e7a",
    emissiveIntensity: 0.55,
    envMapIntensity: 1.3,
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
]

export const DITHER_PRESETS: PresetShell<DitherType>[] = [
  { id: "bayer4", label: "Bayer 4x4" },
  { id: "bayer8", label: "Bayer 8x8" },
  { id: "blueNoise", label: "Blue Noise" },
  { id: "halftone", label: "Halftone" },
  { id: "lines", label: "Lines" },
]

export const ASCII_PRESETS: PresetShell<AsciiCharset>[] = [
  { id: "blocks", label: "Blocks" },
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "dots", label: "Dots" },
  { id: "custom", label: "Custom" },
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
]

/* --- dither (definitions only; applies set dither* state, never textureMode) --- */
export const DITHER_PRESET_DEFS: StylePreset[] = [
  { id: "bayerClassic", label: "Bayer Classic", family: "dither", enabled: true, implemented: false, applies: { ditherEnabled: true, ditherType: "bayer4" } },
  { id: "dotMatrix", label: "Dot Matrix", family: "dither", enabled: true, implemented: false, applies: { ditherEnabled: true, ditherType: "halftone" } },
  { id: "hardThreshold", label: "Hard Threshold", family: "dither", enabled: true, implemented: false, applies: { ditherEnabled: true, ditherType: "lines" } },
  { id: "softDither", label: "Soft Dither", family: "dither", enabled: true, implemented: false, applies: { ditherEnabled: true, ditherType: "blueNoise" } },
  { id: "pixelSignal", label: "Pixel Signal", family: "dither", enabled: true, implemented: false, applies: { ditherEnabled: true, ditherType: "bayer8" } },
]

/* --- animated dither (definitions only) --- */
export const ANIMATED_DITHER_PRESET_DEFS: StylePreset[] = [
  { id: "ditherCrawl", label: "Dither Crawl", family: "animatedDither", enabled: true, implemented: false },
  { id: "thresholdSweep", label: "Threshold Sweep", family: "animatedDither", enabled: true, implemented: false },
  { id: "revealDither", label: "Reveal Dither", family: "animatedDither", enabled: true, implemented: false },
  { id: "completionPulseDither", label: "Completion Pulse Dither", family: "animatedDither", enabled: true, implemented: false },
  { id: "diagonalMatrixDrift", label: "Diagonal Matrix Drift", family: "animatedDither", enabled: true, implemented: false },
]

/* --- ascii (definitions only; applies set ascii* state, never textureMode) --- */
export const ASCII_PRESET_DEFS: StylePreset[] = [
  { id: "terminalShade", label: "Terminal Shade", family: "ascii", enabled: true, implemented: false, applies: { asciiEnabled: true, asciiCharset: "classic" } },
  { id: "binarySkin", label: "Binary Skin", family: "ascii", enabled: true, implemented: false, applies: { asciiEnabled: true, asciiCharset: "minimal" } },
  { id: "blockGlyph", label: "Block Glyph", family: "ascii", enabled: true, implemented: false, applies: { asciiEnabled: true, asciiCharset: "blocks" } },
  { id: "codeMarks", label: "Code Marks", family: "ascii", enabled: true, implemented: false, applies: { asciiEnabled: true, asciiCharset: "custom" } },
  { id: "sparseGlyph", label: "Sparse Glyph", family: "ascii", enabled: true, implemented: false, applies: { asciiEnabled: true, asciiCharset: "dots" } },
]

/* --- animated ascii (definitions only) --- */
export const ANIMATED_ASCII_PRESET_DEFS: StylePreset[] = [
  { id: "glyphScroll", label: "Glyph Scroll", family: "animatedAscii", enabled: true, implemented: false },
  { id: "asciiRain", label: "ASCII Rain", family: "animatedAscii", enabled: true, implemented: false },
  { id: "characterCycle", label: "Character Cycle", family: "animatedAscii", enabled: true, implemented: false },
  { id: "revealGlyphs", label: "Reveal Glyphs", family: "animatedAscii", enabled: true, implemented: false },
  { id: "terminalFlicker", label: "Terminal Flicker", family: "animatedAscii", enabled: true, implemented: false },
  { id: "slowCodeCrawl", label: "Slow Code Crawl", family: "animatedAscii", enabled: true, implemented: false },
]

/* --- texture (definitions only) --- */
export const TEXTURE_PRESET_DEFS: StylePreset[] = [
  { id: "fineGrain", label: "Fine Grain", family: "texture", enabled: true, implemented: false },
  { id: "scanlines", label: "Scanlines", family: "texture", enabled: true, implemented: false },
  { id: "contourBands", label: "Contour Bands", family: "texture", enabled: true, implemented: false },
  { id: "scratchedInk", label: "Scratched Ink", family: "texture", enabled: true, implemented: false },
  { id: "gelBubbles", label: "Gel Bubbles", family: "texture", enabled: true, implemented: false },
]

/* --- animated texture (definitions only) --- */
export const ANIMATED_TEXTURE_PRESET_DEFS: StylePreset[] = [
  { id: "grainDrift", label: "Grain Drift", family: "animatedTexture", enabled: true, implemented: false },
  { id: "scanlineScroll", label: "Scanline Scroll", family: "animatedTexture", enabled: true, implemented: false },
  { id: "rippleFlow", label: "Ripple Flow", family: "animatedTexture", enabled: true, implemented: false },
  { id: "bandCrawl", label: "Band Crawl", family: "animatedTexture", enabled: true, implemented: false },
  { id: "bubbleDrift", label: "Bubble Drift", family: "animatedTexture", enabled: true, implemented: false },
]

/* --- layer stack (definitions only) --- */
export const LAYER_STACK_PRESET_DEFS: StylePreset[] = [
  { id: "cleanInkStack", label: "Clean Ink Stack", family: "layerStack", enabled: true, implemented: false },
  { id: "ditheredGelStack", label: "Dithered Gel Stack", family: "layerStack", enabled: true, implemented: false },
  { id: "terminalStack", label: "Terminal Stack", family: "layerStack", enabled: true, implemented: false },
  { id: "graphicSlabStack", label: "Graphic Slab Stack", family: "layerStack", enabled: true, implemented: false },
  { id: "softSignalStack", label: "Soft Signal Stack", family: "layerStack", enabled: true, implemented: false },
]

/* --- stack animation (definitions only) --- */
export const STACK_ANIMATION_PRESET_DEFS: StylePreset[] = [
  { id: "stackFadeIn", label: "Stack Fade In", family: "stackAnimation", enabled: true, implemented: false },
  { id: "stackCompletionPulse", label: "Stack Completion Pulse", family: "stackAnimation", enabled: true, implemented: false },
  { id: "stackDrift", label: "Stack Drift", family: "stackAnimation", enabled: true, implemented: false },
  { id: "stackFreezeOnComplete", label: "Stack Freeze On Complete", family: "stackAnimation", enabled: true, implemented: false },
  { id: "stackLoopCrawl", label: "Stack Loop Crawl", family: "stackAnimation", enabled: true, implemented: false },
  { id: "stackDelay", label: "Stack Delay", family: "stackAnimation", enabled: true, implemented: false },
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
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const TAU = Math.PI * 2

export function evaluateMaterialAnimation(input: MaterialAnimationInput): MaterialParams {
  const { base, type, intensity, completion } = input
  const t = input.time * input.speed
  const k = clamp01(intensity)
  const p: MaterialParams = { ...base }

  switch (type) {
    case "none":
      return p

    // Moving specular highlight: ramp clearcoat + reflectivity + env reflection
    // sinusoidally so a glossy "shine" visibly travels across the surface.
    case "shineSweep": {
      const s = (Math.sin(t * 1.6) + 1) / 2 // 0..1
      p.clearcoat = clamp01(base.clearcoat + s * 0.7 * k)
      p.clearcoatRoughness = Math.max(0.02, base.clearcoatRoughness * (1 - s * 0.7 * k))
      p.reflectivity = clamp01(base.reflectivity + s * 0.4 * k)
      p.envMapIntensity = base.envMapIntensity * (1 + s * 1.2 * k)
      return p
    }

    // Soft breathing sheen for gel/soft materials.
    case "gelShimmer": {
      const s = (Math.sin(t * 2.2) + 1) / 2
      p.sheen = clamp01(Math.max(base.sheen, 0.4) + s * 0.6 * k)
      p.sheenRoughness = clamp01(base.sheenRoughness * (1 - s * 0.4 * k))
      p.clearcoat = clamp01(base.clearcoat + s * 0.2 * k)
      p.envMapIntensity = base.envMapIntensity * (1 + s * 0.5 * k)
      return p
    }

    // Matte <-> glossy pulse via roughness + env reflection.
    case "roughnessPulse": {
      const s = (Math.sin(t * 1.8) + 1) / 2
      p.roughness = clamp01(base.roughness - s * 0.5 * k)
      p.envMapIntensity = base.envMapIntensity * (1 + s * 0.8 * k)
      return p
    }

    // Accent that follows stroke completion: a brief emissive/clearcoat flash
    // as draw-in approaches 100%, then settles. Reads `completion` only.
    case "completionFlash": {
      // Bell curve peaking near completion ~0.85..1.0.
      const d = 1 - clamp01(Math.abs(completion - 0.92) / 0.18)
      const flash = d * d
      p.emissive = "#9fb4c4"
      p.emissiveIntensity = base.emissiveIntensity + flash * 0.9 * k
      p.clearcoat = clamp01(base.clearcoat + flash * 0.4 * k)
      return p
    }

    // Digital flicker for the Signal material: small high-frequency emissive
    // jitter layered on a slow drift.
    case "signalFlicker": {
      const slow = (Math.sin(t * 3) + 1) / 2
      const fast = (Math.sin(t * 21.3) + Math.sin(t * 13.7)) / 2 // -1..1-ish
      const flick = clamp01(0.5 + 0.5 * fast)
      const baseEm = Math.max(base.emissiveIntensity, 0.2)
      p.emissive = base.emissive === "#000000" ? "#1d3a4a" : base.emissive
      p.emissiveIntensity = baseEm + (slow * 0.3 + flick * 0.5) * k
      return p
    }

    default:
      return p
  }
}
