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

export type DitherType = "bayer4" | "bayer8" | "blueNoise" | "halftone" | "lines"
export type DitherDirection = "static" | "horizontal" | "vertical" | "diagonal"

export type AsciiCharset = "blocks" | "classic" | "minimal" | "dots" | "custom"
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

export type StackAnimationType = "none" | "offset" | "cascade" | "shuffle" | "pulse"

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
  ditherScale: 1,
  ditherThreshold: 0.5,
  ditherContrast: 0.5,
  ditherSpeed: 1,
  ditherDirection: "static",
  ditherIntensity: 1,
  ditherLevels: 2,
  ditherLockMode: "screen",
  ditherSyncMode: "independent",
  ditherDelay: 0,

  asciiEnabled: false,
  asciiAnimated: false,
  asciiCharset: "blocks",
  asciiCellSize: 8,
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
  // Softer, fuller balloon/gel feel: cool blue-gray, clearly lighter than ink so
  // the broad diffuse sheen reads as a soft glow. Best for Inflate / Solid.
  softGel: {
    color: "#454b57",
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.5,
    reflectivity: 0.4,
    sheen: 1.0,
    sheenRoughness: 0.65,
    sheenColor: "#8fa6bd",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 0.8,
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
  // highlight + strong env reflection pop hard against it. The "wet/glossy" end.
  glossyPlastic: {
    color: "#1b1d24",
    roughness: 0.06,
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
  // Soft rubber: warm mid-brown, high roughness, warm sheen → satin, no hard
  // highlight. Clearly a softer, warmer sibling of matteClay.
  rubber: {
    color: "#33312f",
    roughness: 0.92,
    metalness: 0.0,
    clearcoat: 0.04,
    clearcoatRoughness: 0.95,
    reflectivity: 0.15,
    sheen: 1.0,
    sheenRoughness: 0.8,
    sheenColor: "#9a8a78",
    emissive: "#000000",
    emissiveIntensity: 0,
    envMapIntensity: 0.3,
  },
  // Digital "signal": metallic teal with a clear cool emissive so it reads
  // screen-lit. The most chromatic preset while still restrained.
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
    emissiveIntensity: 0.7,
    envMapIntensity: 1.4,
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
  {
    id: "fineGrain",
    label: "Fine Grain",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Subtle per-cell speckle. Safe default on every mode.",
    applies: {
      textureEnabled: true,
      textureMode: "grain",
      textureScale: 1.6,
      textureIntensity: 0.35,
      textureContrast: 0.45,
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
      textureIntensity: 0.5,
      textureContrast: 0.6,
    },
  },
  {
    id: "contourBands",
    label: "Contour Bands",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Broad soft stripes wrapping the volume.",
    bestModes: ["solid", "inflate"],
    applies: {
      textureEnabled: true,
      textureMode: "bands",
      textureScale: 0.8,
      textureIntensity: 0.45,
      textureContrast: 0.4,
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
      textureIntensity: 0.55,
      textureContrast: 0.5,
    },
  },
  {
    id: "gelBubbles",
    label: "Gel Bubbles",
    family: "texture",
    enabled: true,
    implemented: true,
    description: "Soft blobby value-noise field, like bubbles under the skin.",
    bestModes: ["inflate"],
    applies: {
      textureEnabled: true,
      textureMode: "noise",
      textureScale: 0.7,
      textureIntensity: 0.4,
      textureContrast: 0.35,
    },
  },
]

/* --- animated texture (IMPLEMENTED v1) ---
 * Animated presets set the SAME texture* fields plus animation params. They
 * are pattern MOTION only — never threshold motion (dither) or glyph motion
 * (ascii). */
export const ANIMATED_TEXTURE_PRESET_DEFS: StylePreset[] = [
  {
    id: "grainDrift",
    label: "Grain Drift",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "Grain crawls slowly across the surface.",
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureMode: "grain",
      textureScale: 1.6,
      textureIntensity: 0.35,
      textureSpeed: 0.5,
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
      textureIntensity: 0.5,
      textureSpeed: 1.2,
      textureDirection: "vertical",
      motionMode: "independent",
    },
  },
  {
    id: "rippleFlow",
    label: "Ripple Flow",
    family: "animatedTexture",
    enabled: true,
    implemented: true,
    description: "Contour ripples travel across the form.",
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureMode: "contour",
      textureScale: 1.2,
      textureIntensity: 0.5,
      textureSpeed: 0.8,
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
    description: "Broad bands slide slowly along the stroke.",
    bestModes: ["solid", "inflate"],
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureMode: "bands",
      textureScale: 0.8,
      textureIntensity: 0.45,
      textureSpeed: 0.4,
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
    description: "Soft noise blobs drift under the surface.",
    bestModes: ["inflate"],
    applies: {
      textureEnabled: true,
      textureAnimated: true,
      textureMode: "noise",
      textureScale: 0.7,
      textureIntensity: 0.4,
      textureSpeed: 0.35,
      textureDirection: "diagonal",
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
    description: "Ink with a whisper of grain. Nothing dominates — the form leads.",
    applies: {
      layerStackEnabled: true,
      materialPreset: "ink",
      textureEnabled: true,
      textureMode: "grain",
      textureScale: 1.6,
      textureIntensity: 0.3,
      textureContrast: 0.45,
      ditherEnabled: false,
      asciiEnabled: false,
      stackTextureOpacity: 0.7,
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
      asciiCellSize: 11,
      asciiDensity: 0.55,
      asciiContrast: 0.5,
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
      textureIntensity: 0.4,
      ditherEnabled: true,
      ditherType: "bayer4",
      ditherScale: 3.5,
      ditherLevels: 2,
      ditherIntensity: 1,
      ditherContrast: 0.6,
      ditherLockMode: "screen",
      asciiEnabled: false,
      stackTextureOpacity: 0.45,
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
    description: "All three layers, deliberately restrained — binary glyphs lead, dither and scanlines whisper.",
    bestModes: ["rod", "inflate"],
    applies: {
      layerStackEnabled: true,
      materialPreset: "rubber",
      materialUserOverride: true,
      textureEnabled: true,
      textureMode: "scanlines",
      textureScale: 1.1,
      textureIntensity: 0.35,
      ditherEnabled: true,
      ditherType: "blueNoise",
      ditherScale: 2,
      ditherLevels: 5,
      ditherIntensity: 0.5,
      ditherContrast: 0.4,
      ditherLockMode: "screen",
      asciiEnabled: true,
      asciiCharset: "minimal",
      asciiCellSize: 10,
      asciiDensity: 0.5,
      asciiContrast: 0.5,
      asciiLockMode: "screen",
      // The taste rule in numbers: ASCII leads, the other two support.
      stackTextureOpacity: 0.3,
      stackDitherOpacity: 0.35,
      stackAsciiOpacity: 0.85,
      stackDitherBlend: "multiply",
      stackAsciiBlend: "normal",
      stackOrder: "asciiFirst",
    },
  },
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

    // Gloss wave: the clearcoat layer sharpens and the environment reflection
    // swells, so a wet specular "shine" rolls in and out. Pure reflectance —
    // clearcoat up, clearcoat roughness toward mirror, reflectivity + env up,
    // and the base roughness eased down so the reflection tightens.
    case "shineSweep": {
      const s = (Math.sin(t * 1.9) + 1) / 2 // 0..1
      p.clearcoat = clamp01(base.clearcoat + s * 0.85 * k)
      p.clearcoatRoughness = clamp01(
        base.clearcoatRoughness - (base.clearcoatRoughness - 0.02) * s * k,
      )
      p.reflectivity = clamp01(base.reflectivity + s * 0.5 * k)
      p.roughness = clamp01(base.roughness * (1 - s * 0.45 * k))
      p.envMapIntensity = base.envMapIntensity * (1 + s * 2.6 * k)
      return p
    }

    // Breathing sheen: the soft retroreflective sheen layer grows and tightens
    // while a touch of clearcoat fades in — the velvety rim glow swells and
    // recedes. Sheen + sheenRoughness + clearcoat + env, no color change.
    case "gelShimmer": {
      const s = (Math.sin(t * 2.4) + 1) / 2
      p.sheen = clamp01(Math.max(base.sheen, 0.4) + s * 0.6 * k)
      p.sheenRoughness = clamp01(base.sheenRoughness * (1 - s * 0.6 * k))
      p.clearcoat = clamp01(base.clearcoat + s * 0.45 * k)
      p.reflectivity = clamp01(base.reflectivity + s * 0.25 * k)
      p.envMapIntensity = base.envMapIntensity * (1 + s * 1.4 * k)
      return p
    }

    // Matte <-> glossy: roughness makes a big swing between dry/scattered and
    // smooth/reflective, with clearcoat and env reflection rising as it
    // smooths. This is the most purely "material property" animation.
    case "roughnessPulse": {
      const s = (Math.sin(t * 2.0) + 1) / 2
      p.roughness = clamp01(base.roughness - s * 0.85 * k)
      p.clearcoat = clamp01(base.clearcoat + s * 0.4 * k)
      p.clearcoatRoughness = clamp01(base.clearcoatRoughness * (1 - s * 0.6 * k))
      p.envMapIntensity = base.envMapIntensity * (1 + s * 2.0 * k)
      return p
    }

    // Accent that follows stroke completion: a brief emissive + clearcoat flash
    // as draw-in approaches 100%, then settles. Reads `completion` only.
    case "completionFlash": {
      const d = 1 - clamp01(Math.abs(completion - 0.92) / 0.18)
      const flash = d * d
      p.emissive = "#b9c6d2"
      p.emissiveIntensity = base.emissiveIntensity + flash * 1.4 * k
      p.clearcoat = clamp01(base.clearcoat + flash * 0.5 * k)
      p.clearcoatRoughness = clamp01(base.clearcoatRoughness * (1 - flash * 0.7 * k))
      p.envMapIntensity = base.envMapIntensity * (1 + flash * 1.5 * k)
      return p
    }

    // Digital flicker for Signal: the surface is screen-lit, so its own
    // emissive output jitters; metalness + reflectivity + env flicker alongside
    // it so the reflections strobe like an unstable display. No albedo change.
    case "signalFlicker": {
      const slow = (Math.sin(t * 3) + 1) / 2
      const fast = (Math.sin(t * 21.3) + Math.sin(t * 13.7)) / 2 // ~-1..1
      const flick = clamp01(0.5 + 0.5 * fast)
      const baseEm = Math.max(base.emissiveIntensity, 0.3)
      p.emissive = base.emissive === "#000000" ? "#1f6e8c" : base.emissive
      p.emissiveIntensity = baseEm + (slow * 0.5 + flick * 0.9) * k
      p.metalness = clamp01(base.metalness + (flick - 0.5) * 0.4 * k)
      p.reflectivity = clamp01(base.reflectivity + (flick - 0.5) * 0.4 * k)
      p.envMapIntensity = base.envMapIntensity * (1 + flick * 0.9 * k)
      return p
    }

    default:
      return p
  }
}

