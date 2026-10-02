// AN INDEPENDENT GLB READER for the export gates. Shares no code with three or
// `lib/export/drawin-glb*.ts`: it reads the container (header, JSON chunk, BIN
// chunk), resolves accessors, walks the node tree for world matrices, and
// evaluates a mesh's morphed positions at one keyframe of one animation, the
// way a viewer does on the CPU.

function mat4Identity() {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
}
function mat4Mul(a, b) {
  const o = new Array(16).fill(0)
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]
  return o
}
function trs(n) {
  if (n.matrix) return n.matrix.slice()
  const [tx, ty, tz] = n.translation ?? [0, 0, 0]
  const [qx, qy, qz, qw] = n.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = n.scale ?? [1, 1, 1]
  const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, wx = qw * qx, wy = qw * qy, wz = qw * qz
  return [
    (1 - 2 * (yy + zz)) * sx, 2 * (xy + wz) * sx, 2 * (xz - wy) * sx, 0,
    2 * (xy - wz) * sy, (1 - 2 * (xx + zz)) * sy, 2 * (yz + wx) * sy, 0,
    2 * (xz + wy) * sz, 2 * (yz - wx) * sz, (1 - 2 * (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]
}

export function readGlb(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  if (b.length < 20) throw new Error("GLB: too short")
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error("GLB: bad magic")
  const version = dv.getUint32(4, true)
  const length = dv.getUint32(8, true)
  if (length !== b.length) throw new Error(`GLB: header says ${length} bytes, file has ${b.length}`)
  let p = 12
  let json = null
  let bin = null
  while (p < b.length) {
    if (p + 8 > b.length) throw new Error("GLB: truncated chunk header")
    const len = dv.getUint32(p, true)
    const type = dv.getUint32(p + 4, true)
    if (p + 8 + len > b.length) throw new Error("GLB: chunk runs past the end")
    const body = b.subarray(p + 8, p + 8 + len)
    if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(body))
    else if (type === 0x004e4942) bin = body
    p += 8 + len
  }
  if (!json) throw new Error("GLB: no JSON chunk")

  const COMP = { 5120: [Int8Array, 1], 5121: [Uint8Array, 1], 5122: [Int16Array, 2], 5123: [Uint16Array, 2], 5125: [Uint32Array, 4], 5126: [Float32Array, 4] }
  const SIZE = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 }
  const accessor = (i) => {
    const a = json.accessors[i]
    const [T, bytes] = COMP[a.componentType]
    const n = SIZE[a.type]
    const out = new Float64Array(a.count * n)
    const view = bin ? new DataView(bin.buffer, bin.byteOffset, bin.byteLength) : null
    const readComp = (Tc, off) =>
      Tc === 5126 ? view.getFloat32(off, true) : Tc === 5123 ? view.getUint16(off, true) : Tc === 5125 ? view.getUint32(off, true) : Tc === 5121 ? view.getUint8(off) : Tc === 5122 ? view.getInt16(off, true) : view.getInt8(off)
    /* SPARSE (glTF 2.0 3.6.2.3): the base is the bufferView if there is one,
     * zeros if not, and `sparse` overwrites the listed elements. */
    const applySparse = () => {
      if (!a.sparse) return
      const sp = a.sparse
      const ib = json.bufferViews[sp.indices.bufferView]
      const vb = json.bufferViews[sp.values.bufferView]
      const ibase = (ib.byteOffset ?? 0) + (sp.indices.byteOffset ?? 0)
      const vbase = (vb.byteOffset ?? 0) + (sp.values.byteOffset ?? 0)
      const isz = COMP[sp.indices.componentType][1]
      if (ibase + sp.count * isz > bin.length || vbase + sp.count * n * bytes > bin.length) throw new Error(`GLB: sparse accessor ${i} runs past the BIN chunk`)
      for (let k = 0; k < sp.count; k++) {
        const at = readComp(sp.indices.componentType, ibase + k * isz)
        if (at >= a.count) throw new Error(`GLB: sparse index ${at} past accessor ${i}'s count ${a.count}`)
        for (let c = 0; c < n; c++) out[at * n + c] = readComp(a.componentType, vbase + (k * n + c) * bytes)
      }
    }
    if (a.bufferView === undefined) {
      applySparse()
      return { data: out, count: a.count, n, min: a.min, max: a.max, sparse: !!a.sparse }
    }
    const bv = json.bufferViews[a.bufferView]
    const stride = bv.byteStride ?? n * bytes
    const base = (bv.byteOffset ?? 0) + (a.byteOffset ?? 0)
    if (!bin || base + stride * (a.count - 1) + n * bytes > bin.length) throw new Error(`GLB: accessor ${i} runs past the BIN chunk`)
    for (let k = 0; k < a.count; k++) {
      for (let c = 0; c < n; c++) {
        const off = base + k * stride + c * bytes
        let v
        if (T === Float32Array) v = view.getFloat32(off, true)
        else if (T === Uint16Array) v = view.getUint16(off, true)
        else if (T === Uint32Array) v = view.getUint32(off, true)
        else if (T === Uint8Array) v = view.getUint8(off)
        else if (T === Int16Array) v = view.getInt16(off, true)
        else v = view.getInt8(off)
        out[k * n + c] = v
      }
    }
    applySparse()
    return { data: out, count: a.count, n, min: a.min, max: a.max, sparse: !!a.sparse }
  }

  // World matrices of every node reachable from the default scene.
  const world = new Map()
  const scene = json.scenes[json.scene ?? 0]
  const visit = (i, parent) => {
    const m = mat4Mul(parent, trs(json.nodes[i]))
    world.set(i, m)
    for (const c of json.nodes[i].children ?? []) visit(c, m)
  }
  for (const r of scene.nodes) visit(r, mat4Identity())

  // Every drawable primitive, with the node that draws it.
  const prims = []
  for (const [ni, m] of world) {
    const node = json.nodes[ni]
    if (node.mesh === undefined) continue
    const mesh = json.meshes[node.mesh]
    mesh.primitives.forEach((pr, pi) => {
      prims.push({
        node: ni,
        name: node.name ?? mesh.name ?? `node_${ni}`,
        matrix: m,
        position: accessor(pr.attributes.POSITION),
        indices: pr.indices !== undefined ? accessor(pr.indices) : null,
        targets: (pr.targets ?? []).map((t) => accessor(t.POSITION)),
        defaultWeights: mesh.weights ?? null,
        primitive: pi,
      })
    })
  }

  const animations = (json.animations ?? []).map((an) => ({
    name: an.name,
    channels: an.channels.map((ch) => {
      const s = an.samplers[ch.sampler]
      return { node: ch.target.node, path: ch.target.path, interpolation: s.interpolation ?? "LINEAR", input: accessor(s.input), output: accessor(s.output) }
    }),
  }))
  return { version, length, json, prims, animations }
}

/** Weights of `node` at keyframe `k` of `anim` (exact keyframes only). */
export function weightsAt(anim, node, k, count) {
  const ch = anim?.channels.find((c) => c.node === node && c.path === "weights")
  if (!ch) return null
  const out = new Float64Array(count)
  for (let j = 0; j < count; j++) out[j] = ch.output.data[k * count + j]
  return out
}

/** World-space positions of a primitive with morph weights applied. */
export function morphed(prim, weights) {
  const p = prim.position.data
  const n = prim.position.count
  const out = new Float64Array(n * 3)
  const m = prim.matrix
  for (let v = 0; v < n; v++) {
    let x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2]
    if (weights) {
      for (let t = 0; t < prim.targets.length; t++) {
        const w = weights[t]
        if (!w) continue
        const d = prim.targets[t].data
        x += w * d[v * 3]
        y += w * d[v * 3 + 1]
        z += w * d[v * 3 + 2]
      }
    }
    out[v * 3] = m[0] * x + m[4] * y + m[8] * z + m[12]
    out[v * 3 + 1] = m[1] * x + m[5] * y + m[9] * z + m[13]
    out[v * 3 + 2] = m[2] * x + m[6] * y + m[10] * z + m[14]
  }
  return out
}

/** Total triangle area of positions under a primitive's indices. */
export function areaOf(prim, pos) {
  const idx = prim.indices ? prim.indices.data : null
  const tri = idx ? idx.length / 3 : pos.length / 9
  let a = 0
  for (let t = 0; t < tri; t++) {
    const i0 = idx ? idx[t * 3] : t * 3
    const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1
    const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2
    const ax = pos[i1 * 3] - pos[i0 * 3], ay = pos[i1 * 3 + 1] - pos[i0 * 3 + 1], az = pos[i1 * 3 + 2] - pos[i0 * 3 + 2]
    const bx = pos[i2 * 3] - pos[i0 * 3], by = pos[i2 * 3 + 1] - pos[i0 * 3 + 1], bz = pos[i2 * 3 + 2] - pos[i0 * 3 + 2]
    const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx
    a += 0.5 * Math.hypot(cx, cy, cz)
  }
  return a
}

export function boundsOf(pos) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3) {
    for (let c = 0; c < 3; c++) {
      if (pos[i + c] < min[c]) min[c] = pos[i + c]
      if (pos[i + c] > max[c]) max[c] = pos[i + c]
    }
  }
  return { min, max }
}

/**
 * Positions expanded to triangle corners, in triangle order. Two files that
 * draw the same surface compare equal this way even when one is indexed and
 * the other a triangle soup (the animated GLB un-indexes fused meshes).
 */
export function cornersOf(prim, pos) {
  const idx = prim.indices ? prim.indices.data : null
  if (!idx) return pos
  const out = new Float64Array(idx.length * 3)
  for (let i = 0; i < idx.length; i++) {
    out[i * 3] = pos[idx[i] * 3]
    out[i * 3 + 1] = pos[idx[i] * 3 + 1]
    out[i * 3 + 2] = pos[idx[i] * 3 + 2]
  }
  return out
}
