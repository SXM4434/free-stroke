/* ==================================================================
   THE KEYED STYLE VALUES, AS THE DOCK LISTS THEM · K3 of the layout rethink
   (docs/research-2026-09-26/layout-rethink/BUILD-PLAN.md §5 row K3; his
   ruling of 2026-09-26: only keyed values show as lanes).

   Each keyable style path (`KEYABLE_PATHS`, lib/keyframes.ts) belongs to the
   Style panel family that shows its slider, and carries that slider's label,
   so a lane reads "Texture · Speed" the way the panel does. The families come
   in the Style panel's own order. Pure data: the lanes, the key button and
   the gates all read it.
   ================================================================== */

import { KEYABLE_PATHS, KEY_DISABLED, type StyleKeyPath } from "@/lib/keyframes"

export interface KeyFamily {
  /** The Style panel family id (`data-style-family`). */
  id: "material" | "animation" | "texture" | "dither" | "ascii" | "layers" | "fusion"
  label: string
}

/** The Style panel's families, in its order. */
export const KEY_FAMILIES: readonly KeyFamily[] = [
  { id: "material", label: "Material" },
  { id: "animation", label: "Animation" },
  { id: "texture", label: "Texture" },
  { id: "dither", label: "Dither" },
  { id: "ascii", label: "ASCII" },
  { id: "layers", label: "Layers" },
  { id: "fusion", label: "Fusion" },
]

/** Each path's family and its slider's label in the Style panel. */
const META: Readonly<Record<string, { family: KeyFamily["id"]; label: string }>> = {
  "customMaterial.roughness": { family: "material", label: "Roughness" },
  "customMaterial.metalness": { family: "material", label: "Metalness" },
  "customMaterial.clearcoat": { family: "material", label: "Clearcoat" },
  "customMaterial.sheen": { family: "material", label: "Sheen" },
  "customMaterial.emissiveIntensity": { family: "material", label: "Emissive" },
  "customMaterial.envMapIntensity": { family: "material", label: "Reflection" },
  materialAnimationSpeed: { family: "material", label: "Motion speed" },
  materialAnimationIntensity: { family: "material", label: "Motion intensity" },
  styleLoopSeconds: { family: "animation", label: "Loop length" },
  textureScale: { family: "texture", label: "Scale" },
  textureIntensity: { family: "texture", label: "Intensity" },
  textureContrast: { family: "texture", label: "Contrast" },
  textureSpeed: { family: "texture", label: "Speed" },
  texturePhase: { family: "texture", label: "Pattern offset" },
  textureDelay: { family: "texture", label: "Delay" },
  ditherScale: { family: "dither", label: "Cell size" },
  ditherThreshold: { family: "dither", label: "Threshold bias" },
  ditherContrast: { family: "dither", label: "Contrast" },
  ditherSpeed: { family: "dither", label: "Speed" },
  ditherIntensity: { family: "dither", label: "Amount" },
  ditherLevels: { family: "dither", label: "Tone levels" },
  ditherExposure: { family: "dither", label: "Exposure" },
  ditherAngle: { family: "dither", label: "Screen angle" },
  ditherDelay: { family: "dither", label: "Delay" },
  asciiCellSize: { family: "ascii", label: "Cell size" },
  asciiDensity: { family: "ascii", label: "Density" },
  asciiContrast: { family: "ascii", label: "Contrast" },
  asciiScrollSpeed: { family: "ascii", label: "Speed" },
  asciiDelay: { family: "ascii", label: "Delay" },
  stackTextureOpacity: { family: "layers", label: "Texture opacity" },
  stackDitherOpacity: { family: "layers", label: "Dither opacity" },
  stackAsciiOpacity: { family: "layers", label: "ASCII opacity" },
  stackAnimationSpeed: { family: "layers", label: "Speed" },
  stackAnimationPhase: { family: "layers", label: "Phase offset" },
  stackAnimationOpacity: { family: "layers", label: "Group opacity" },
  fusionAnimationSpeed: { family: "fusion", label: "Speed" },
  fusionIntensity: { family: "fusion", label: "Link" },
  fusionSwing: { family: "fusion", label: "Swing" },
}

export interface StyleKeyMeta {
  path: StyleKeyPath
  family: KeyFamily
  label: string
  min: number
  max: number
  /** Shown value = stored value times this: 100 for a 0 to 1 amount, shown in %. */
  scale: number
  unit: string
  digits: number
  /** Why a key does not drive it, when it does not (`KEY_DISABLED`). */
  disabled?: string
}

const familyById = new Map(KEY_FAMILIES.map((f) => [f.id, f]))

function build(): Map<string, StyleKeyMeta> {
  const out = new Map<string, StyleKeyMeta>()
  for (const p of KEYABLE_PATHS) {
    const m = META[p.path]
    const family = familyById.get(m?.family ?? "animation")!
    const unitRange = p.min >= 0 && p.max <= 1
    const digits = unitRange ? 0 : p.step >= 1 ? 0 : p.step >= 0.1 ? 1 : 2
    out.set(p.path, {
      path: p.path,
      family,
      label: m?.label ?? p.path,
      min: p.min,
      max: p.max,
      scale: unitRange ? 100 : 1,
      unit: unitRange ? "%" : "",
      digits,
      disabled: KEY_DISABLED[p.path],
    })
  }
  return out
}

const ALL = build()

/** The lane meta of a keyable style path; undefined for anything else. */
export function styleKeyMeta(path: string): StyleKeyMeta | undefined {
  return ALL.get(path)
}

/** Every keyable style path's meta, in `KEYABLE_PATHS` order. */
export const STYLE_KEY_META: readonly StyleKeyMeta[] = [...ALL.values()]

/** Paths with no row above: a new style field needs one, or its lane reads its path. */
export const UNLABELLED_KEY_PATHS: readonly string[] = KEYABLE_PATHS.map((p) => p.path).filter((p) => !META[p])

/** The must-fail switch of scripts/verify/assert-key-buttons.mjs, read once and never in production:
 *  "dropfield" (one Field draws no key button), "alllanes" (the lanes list every keyable value, keyed or
 *  not), "noeditkey" (an edit on a keyed value writes the doc's value only). And of
 *  scripts/verify/assert-keyed-playback-live.mjs: "silentrefusal" (a refused key shows no words),
 *  "dropall" (a refused path in an edit drops every key of that edit, the old behaviour). */
export const KEY_UI_MUTANT: string | undefined =
  typeof window !== "undefined" && process.env.NODE_ENV !== "production"
    ? (window as unknown as { __fsKeyMutant?: string }).__fsKeyMutant
    : undefined

// The gates read the keyable paths, their families and K2's reasons from the page itself.
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  ;(window as unknown as { __fsKeyPaths?: unknown }).__fsKeyPaths = {
    paths: STYLE_KEY_META.map((m) => ({ path: m.path, family: m.family.id, disabled: m.disabled ?? null })),
  }
}
