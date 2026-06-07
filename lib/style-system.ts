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

export type TextureMode =
  | "none"
  | "procedural"
  | "dither"
  | "ascii"
  | "layered"
  | "fusion"

/** How a texture/effect is anchored as the camera or geometry moves. */
export type TextureLockMode = "screen" | "object" | "surface" | "stroke"

/** How style animation phase relates to the geometry reveal/animation clock. */
export type StyleSyncMode =
  | "independent"
  | "revealSynced"
  | "strokeTimeSynced"
  | "completionPulse"
  | "loopSynced"

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
  /* --- material --- */
  materialPreset: MaterialPreset
  materialAnimationEnabled: boolean
  materialAnimationType: StyleAnimationType
  materialAnimationSpeed: number
  materialAnimationIntensity: number

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
  syncMode: StyleSyncMode
  syncToReveal: boolean
  globalStyleTime: number
}

/**
 * DEFAULT_STYLE_STATE — conservative defaults.
 * Material is plain "ink", every visual layer is OFF, every animated system is
 * OFF, and sync is "independent". This guarantees the substrate is fully inert
 * until a later phase explicitly enables a system.
 */
export const DEFAULT_STYLE_STATE: StyleState = {
  materialPreset: "ink",
  materialAnimationEnabled: false,
  materialAnimationType: "none",
  materialAnimationSpeed: 1,
  materialAnimationIntensity: 0.5,

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
  syncMode: "independent",
  syncToReveal: false,
  globalStyleTime: 0,
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
]

export const TEXTURE_MODES: PresetShell<TextureMode>[] = [
  { id: "none", label: "None" },
  { id: "procedural", label: "Procedural" },
  { id: "dither", label: "Dither" },
  { id: "ascii", label: "ASCII" },
  { id: "layered", label: "Layered" },
  { id: "fusion", label: "Fusion" },
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
