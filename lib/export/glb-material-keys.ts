/**
 * KEYED MATERIAL VALUES IN THE ANIMATED GLB (REVIEW 1 finding 1).
 *
 * The animated GLB carries the draw-in as morph weights. A keyed Custom
 * material value (`customMaterial.roughness` and the rest, `KEYABLE_PATHS` in
 * lib/keyframes.ts) changes the surface over the take in the 3D view and the
 * film, so the GLB carries it too: one channel per value per material, read
 * through `KHR_animation_pointer` on the clip the draw-in already uses, one
 * key per frame of the plan (the times the morph weights use), LINEAR.
 *
 * Which values glTF can hold, and where:
 *   roughness          /materials/i/pbrMetallicRoughness/roughnessFactor
 *   metalness          /materials/i/pbrMetallicRoughness/metallicFactor
 *   clearcoat          /materials/i/extensions/KHR_materials_clearcoat/clearcoatFactor
 *   emissiveIntensity  /materials/i/extensions/KHR_materials_emissive_strength/emissiveStrength
 * three's GLTFExporter writes the two extensions only when the value is not
 * their default (clearcoat 0, strength 1); a channel needs its target to
 * exist, so the extension is added with the file's own value when it is
 * missing. Sheen weight and environment strength have no glTF property, so a
 * keyed one is named in `dropped` with its reason, never written silently.
 *
 * Pure: bytes in, bytes out, no three, no DOM.
 */
import { readGlb, writeGlb, type GltfJson } from "./glb-sparse"

export type GlbMaterialField = "roughness" | "metalness" | "clearcoat" | "emissiveIntensity" | "sheen" | "envMapIntensity"

export interface GlbMaterialTrack {
  field: GlbMaterialField
  /** One value per time in `times`. */
  values: ArrayLike<number>
}

export interface GlbMaterialResult {
  glb: ArrayBuffer
  /** Fields written as channels. */
  carried: GlbMaterialField[]
  /** Fields glTF cannot hold, each with its reason. */
  dropped: { field: GlbMaterialField; reason: string }[]
  /** Channels added (fields carried times materials). */
  channels: number
}

const POINTER: Partial<Record<GlbMaterialField, { ext?: string; key: string; def: number }>> = {
  roughness: { key: "roughnessFactor", def: 1 },
  metalness: { key: "metallicFactor", def: 1 },
  clearcoat: { ext: "KHR_materials_clearcoat", key: "clearcoatFactor", def: 0 },
  emissiveIntensity: { ext: "KHR_materials_emissive_strength", key: "emissiveStrength", def: 1 },
}

const NOT_IN_GLTF: Partial<Record<GlbMaterialField, string>> = {
  sheen: "glTF has no sheen weight (KHR_materials_sheen holds only a sheen colour and roughness), so the file keeps the material's sheen at the last frame",
  envMapIntensity: "glTF has no environment strength on a material, so the file keeps the material's environment strength at the last frame",
}

const pad4 = (n: number) => (n + 3) & ~3

/** A track whose every value equals its first is not keyed motion and adds no channel. */
const varies = (v: ArrayLike<number>) => {
  for (let i = 1; i < v.length; i++) if (v[i] !== v[0]) return true
  return false
}

type Material = { pbrMetallicRoughness?: Record<string, unknown>; extensions?: Record<string, Record<string, unknown>> }
type Animation = { name?: string; samplers: { input: number; output: number; interpolation?: string }[]; channels: unknown[] }

export function addMaterialTracks(glb: ArrayBuffer, times: ArrayLike<number>, tracks: readonly GlbMaterialTrack[], clipName: string): GlbMaterialResult {
  const carried: GlbMaterialField[] = []
  const dropped: { field: GlbMaterialField; reason: string }[] = []
  const live = tracks.filter((t) => {
    if (t.values.length !== times.length) throw new Error(`glb-material-keys: ${t.field} has ${t.values.length} values for ${times.length} times`)
    if (!varies(t.values)) return false
    if (NOT_IN_GLTF[t.field]) {
      dropped.push({ field: t.field, reason: NOT_IN_GLTF[t.field]! })
      return false
    }
    return true
  })
  if (live.length === 0 || times.length === 0) return { glb, carried, dropped, channels: 0 }

  const { json, bin } = readGlb(glb)
  const j = json as GltfJson & { materials?: Material[]; animations?: Animation[]; extensionsUsed?: string[] }
  const materials = j.materials ?? []
  if (materials.length === 0) return { glb, carried, dropped, channels: 0 }

  // The new accessors go into one buffer view appended after the file's bytes.
  const floats: number[][] = []
  const accessorOf = (vals: ArrayLike<number>): number => {
    const accessors = (j.accessors ??= [])
    const off = floats.reduce((n, f) => n + f.length * 4, 0)
    const arr = Array.from(vals, (x) => Math.fround(x))
    floats.push(arr)
    accessors.push({
      bufferView: -1,
      byteOffset: off,
      componentType: 5126,
      count: arr.length,
      type: "SCALAR",
      min: [Math.min(...arr)],
      max: [Math.max(...arr)],
    })
    return accessors.length - 1
  }
  const timeAcc = accessorOf(times)
  const animations = (j.animations ??= [])
  let anim = animations.find((a) => a.name === clipName)
  if (!anim) {
    anim = { name: clipName, samplers: [], channels: [] }
    animations.push(anim)
  }
  const used = new Set(j.extensionsUsed ?? [])
  let channels = 0
  for (const t of live) {
    const p = POINTER[t.field]!
    const out = accessorOf(t.values)
    carried.push(t.field)
    materials.forEach((m, i) => {
      let pointer: string
      if (p.ext) {
        const exts = (m.extensions ??= {})
        const e = (exts[p.ext] ??= {})
        if (typeof e[p.key] !== "number") e[p.key] = p.def
        used.add(p.ext)
        pointer = `/materials/${i}/extensions/${p.ext}/${p.key}`
      } else {
        m.pbrMetallicRoughness ??= {}
        pointer = `/materials/${i}/pbrMetallicRoughness/${p.key}`
      }
      anim!.samplers.push({ input: timeAcc, output: out, interpolation: "LINEAR" })
      anim!.channels.push({
        sampler: anim!.samplers.length - 1,
        target: { path: "pointer", extensions: { KHR_animation_pointer: { pointer } } },
      })
      channels++
    })
  }
  used.add("KHR_animation_pointer")
  j.extensionsUsed = [...used]

  // Append the floats as one buffer view and point the new accessors at it.
  const start = pad4(bin.length)
  const total = floats.reduce((n, f) => n + f.length * 4, 0)
  const next = new Uint8Array(start + total)
  next.set(bin, 0)
  const dv = new DataView(next.buffer)
  let o = start
  for (const f of floats) for (const x of f) {
    dv.setFloat32(o, x, true)
    o += 4
  }
  const views = (j.bufferViews ??= [])
  views.push({ buffer: 0, byteOffset: start, byteLength: total })
  const view = views.length - 1
  for (const a of j.accessors ?? []) if (a.bufferView === -1) a.bufferView = view
  if (j.buffers && j.buffers[0]) j.buffers[0].byteLength = next.length
  else j.buffers = [{ byteLength: next.length }]
  return { glb: writeGlb(j, next), carried, dropped, channels }
}
