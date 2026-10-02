/**
 * MORPH TARGETS AS SPARSE ACCESSORS: a GLB rewrite, after GLTFExporter.
 *
 * A draw-in morph target moves only the vertices hidden in its state, and
 * leaves every other one at zero. three's GLTFExporter writes every target
 * DENSE, one xyz per vertex, so a Solid export of two strokes came to 52.8 MB
 * (Inflate 25.6 MB) where its static GLB is well under one. glTF 2.0 has the
 * answer in core: an accessor with no `bufferView` and a `sparse` block reads
 * as zeros except at the listed indices (glTF 2.0 spec, 3.6.2.3 "Sparse
 * Accessors"; three's GLTFLoader, Blender and Babylon all read it).
 *
 * This walks the GLB's JSON, finds every accessor used as a morph target
 * POSITION, and when fewer than 3/4 of its vertices are non-zero rewrites it
 * as sparse (uint32 indices + the non-zero xyz values), then repacks the
 * binary chunk so the dense bytes are gone. Everything else (meshes, nodes,
 * animation, materials, the other accessors and buffer views) is copied as
 * it was, with byte offsets moved.
 *
 * Pure: bytes in, bytes out, no three, no DOM. `assert-export-glb-anim.mjs`
 * reads the result with its own reader AND with three's GLTFLoader and holds
 * the decoded targets equal to the dense ones.
 */

interface GltfAccessor {
  bufferView?: number
  byteOffset?: number
  componentType: number
  count: number
  type: string
  min?: number[]
  max?: number[]
  normalized?: boolean
  sparse?: {
    count: number
    indices: { bufferView: number; byteOffset?: number; componentType: number }
    values: { bufferView: number; byteOffset?: number }
  }
}

interface GltfBufferView {
  buffer: number
  byteOffset?: number
  byteLength: number
  byteStride?: number
  target?: number
}

export interface GltfJson {
  accessors?: GltfAccessor[]
  bufferViews?: GltfBufferView[]
  buffers?: { byteLength: number; uri?: string }[]
  meshes?: { primitives: { targets?: Record<string, number>[] }[] }[]
  [k: string]: unknown
}

export interface SparseReport {
  bytesBefore: number
  bytesAfter: number
  targetsSparse: number
  targetsKeptDense: number
}

const pad4 = (n: number) => (n + 3) & ~3

export function readGlb(buf: ArrayBuffer): { json: GltfJson; bin: Uint8Array } {
  const dv = new DataView(buf)
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("glb-sparse: not a GLB")
  let p = 12
  let json: GltfJson | null = null
  let bin = new Uint8Array(0)
  while (p < buf.byteLength) {
    const len = dv.getUint32(p, true)
    const type = dv.getUint32(p + 4, true)
    const body = new Uint8Array(buf, p + 8, len)
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body))
    else if (type === 0x004e4942) bin = body
    p += 8 + len
  }
  if (!json) throw new Error("glb-sparse: no JSON chunk")
  return { json, bin }
}

export function writeGlb(json: GltfJson, bin: Uint8Array): ArrayBuffer {
  let jsonBytes = new TextEncoder().encode(JSON.stringify(json))
  const jsonLen = pad4(jsonBytes.length)
  const binLen = pad4(bin.length)
  const total = 12 + 8 + jsonLen + (bin.length ? 8 + binLen : 0)
  const out = new ArrayBuffer(total)
  const dv = new DataView(out)
  const u8 = new Uint8Array(out)
  dv.setUint32(0, 0x46546c67, true)
  dv.setUint32(4, 2, true)
  dv.setUint32(8, total, true)
  dv.setUint32(12, jsonLen, true)
  dv.setUint32(16, 0x4e4f534a, true)
  u8.set(jsonBytes, 20)
  u8.fill(0x20, 20 + jsonBytes.length, 20 + jsonLen)
  if (bin.length) {
    const o = 20 + jsonLen
    dv.setUint32(o, binLen, true)
    dv.setUint32(o + 4, 0x004e4942, true)
    u8.set(bin, o + 8)
  }
  jsonBytes = new Uint8Array(0)
  return out
}

export function sparsifyMorphTargets(glb: ArrayBuffer): { glb: ArrayBuffer; report: SparseReport } {
  const { json, bin } = readGlb(glb)
  const accessors = json.accessors ?? []
  const views = json.bufferViews ?? []
  const targetAcc = new Set<number>()
  for (const m of json.meshes ?? []) for (const pr of m.primitives) for (const t of pr.targets ?? []) if (t.POSITION !== undefined) targetAcc.add(t.POSITION)

  /* New binary: every buffer view that is still referenced is copied, in
   * order; the sparse index/value views are appended after. */
  const chunks: Uint8Array[] = []
  let size = 0
  const put = (bytes: Uint8Array) => {
    const off = size
    chunks.push(bytes)
    size += bytes.length
    const padBy = pad4(size) - size
    if (padBy) {
      chunks.push(new Uint8Array(padBy))
      size += padBy
    }
    return off
  }
  const newViews: GltfBufferView[] = []
  const viewMap = new Map<number, number>()
  const binView = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)

  let targetsSparse = 0
  let targetsKeptDense = 0
  const sparseFor = new Map<number, { idx: Uint32Array; vals: Float32Array }>()
  targetAcc.forEach((ai) => {
    const a = accessors[ai]
    if (a.sparse || a.bufferView === undefined || a.componentType !== 5126 || a.type !== "VEC3") {
      targetsKeptDense++
      return
    }
    const bv = views[a.bufferView]
    const stride = bv.byteStride ?? 12
    const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
    const idx: number[] = []
    const vals: number[] = []
    for (let i = 0; i < a.count; i++) {
      const o = base + i * stride
      const x = binView.getFloat32(o, true)
      const y = binView.getFloat32(o + 4, true)
      const z = binView.getFloat32(o + 8, true)
      if (x !== 0 || y !== 0 || z !== 0) {
        idx.push(i)
        vals.push(x, y, z)
      }
    }
    /* Sparse costs 16 bytes a non-zero vertex against 12 a vertex dense, so
     * it only pays below three quarters full. An all-zero target stays dense:
     * the spec requires `sparse.count` of at least 1. */
    if (idx.length === 0 || idx.length * 16 >= a.count * 12) {
      targetsKeptDense++
      return
    }
    sparseFor.set(ai, { idx: Uint32Array.from(idx), vals: Float32Array.from(vals) })
    targetsSparse++
  })

  /* Which views stay: any referenced by an accessor that stays dense, or by
   * anything that is not an accessor (images, for instance). */
  const keep = new Set<number>()
  accessors.forEach((a, ai) => {
    if (a.bufferView !== undefined && !sparseFor.has(ai)) keep.add(a.bufferView)
    if (a.sparse) {
      keep.add(a.sparse.indices.bufferView)
      keep.add(a.sparse.values.bufferView)
    }
  })
  const walk = (o: unknown, inAccessors: boolean) => {
    if (!o || typeof o !== "object") return
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (k === "accessors" || k === "bufferViews") continue
      if (k === "bufferView" && typeof v === "number" && !inAccessors) keep.add(v)
      else walk(v, inAccessors)
    }
  }
  walk(json, false)

  views.forEach((v, vi) => {
    if (!keep.has(vi)) return
    const bytes = bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength)
    const off = put(bytes)
    viewMap.set(vi, newViews.length)
    newViews.push({ ...v, byteOffset: off })
  })
  const remap = (vi: number) => {
    const n = viewMap.get(vi)
    if (n === undefined) throw new Error(`glb-sparse: buffer view ${vi} was dropped but is still referenced`)
    return n
  }
  accessors.forEach((a, ai) => {
    const sp = sparseFor.get(ai)
    if (sp) {
      const iOff = put(new Uint8Array(sp.idx.buffer, sp.idx.byteOffset, sp.idx.byteLength))
      const iView = newViews.length
      newViews.push({ buffer: 0, byteOffset: iOff, byteLength: sp.idx.byteLength })
      const vOff = put(new Uint8Array(sp.vals.buffer, sp.vals.byteOffset, sp.vals.byteLength))
      const vView = newViews.length
      newViews.push({ buffer: 0, byteOffset: vOff, byteLength: sp.vals.byteLength })
      delete a.bufferView
      delete a.byteOffset
      a.sparse = { count: sp.idx.length, indices: { bufferView: iView, componentType: 5125 }, values: { bufferView: vView } }
      return
    }
    if (a.bufferView !== undefined) a.bufferView = remap(a.bufferView)
    if (a.sparse) {
      a.sparse.indices.bufferView = remap(a.sparse.indices.bufferView)
      a.sparse.values.bufferView = remap(a.sparse.values.bufferView)
    }
  })
  const fix = (o: unknown) => {
    if (!o || typeof o !== "object") return
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (k === "accessors" || k === "bufferViews") continue
      if (k === "bufferView" && typeof v === "number") (o as Record<string, unknown>)[k] = remap(v)
      else fix(v)
    }
  }
  fix(json)

  const newBin = new Uint8Array(size)
  let o = 0
  for (const c of chunks) {
    newBin.set(c, o)
    o += c.length
  }
  json.bufferViews = newViews
  if (json.buffers && json.buffers[0]) json.buffers[0].byteLength = newBin.length
  const out = writeGlb(json, newBin)
  return { glb: out, report: { bytesBefore: glb.byteLength, bytesAfter: out.byteLength, targetsSparse, targetsKeptDense } }
}
