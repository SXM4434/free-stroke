// AN INDEPENDENT WEBM (EBML) WALKER for the export gates. Shares no code with
// `lib/export/webm.ts`: it reads IDs and sizes off the bytes the way a demuxer
// does, and reports what a gate needs to hold a file to. Frame payloads are
// handed back so a gate can re-mux ffmpeg's own frames through our muxer and
// compare the decodes byte for byte.
//
// Returns { width, height, codec, alphaMode, durationMs, timecodeScale,
//           frames: [{ timeMs, key, data, additional }] }.

const MASTER = new Set([
  0x1a45dfa3, // EBML
  0x18538067, // Segment
  0x1654ae6b, // Tracks
  0xae, // TrackEntry
  0xe0, // Video
  0x1f43b675, // Cluster
  0xa0, // BlockGroup
  0x75a1, // BlockAdditions
  0xa6, // BlockMore
  0x1549a966, // Info
])

function readId(b, p) {
  const first = b[p]
  let len = 1
  while (len <= 4 && !(first & (0x80 >> (len - 1)))) len++
  if (len > 4) throw new Error(`bad EBML id at ${p}`)
  let id = 0
  for (let i = 0; i < len; i++) id = id * 256 + b[p + i]
  return { id, len }
}

function readSize(b, p) {
  const first = b[p]
  let len = 1
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++
  if (len > 8) throw new Error(`bad EBML size at ${p}`)
  let v = first & (0xff >> len)
  let allOnes = v === 0xff >> len
  for (let i = 1; i < len; i++) {
    v = v * 256 + b[p + i]
    if (b[p + i] !== 0xff) allOnes = false
  }
  return { size: allOnes ? -1 : v, len }
}

function uintOf(b, p, n) {
  let v = 0
  for (let i = 0; i < n; i++) v = v * 256 + b[p + i]
  return v
}

export function walkWebm(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  const out = { width: 0, height: 0, codec: "", alphaMode: 0, durationMs: NaN, timecodeScale: 1e6, frames: [] }
  let clusterTime = 0
  let group = null

  const walk = (p, end) => {
    while (p < end) {
      const { id, len: il } = readId(b, p)
      const { size, len: sl } = readSize(b, p + il)
      const body = p + il + sl
      const stop = size < 0 ? end : body + size
      if (id === 0xa0) {
        group = { key: true, block: null, additional: null }
        walk(body, stop)
        if (group.block) out.frames.push({ ...group.block, key: group.key, additional: group.additional })
        group = null
      } else if (MASTER.has(id)) {
        walk(body, stop)
      } else if (id === 0xe7) {
        clusterTime = uintOf(b, body, size)
      } else if (id === 0x2ad7b1) {
        out.timecodeScale = uintOf(b, body, size)
      } else if (id === 0x4489) {
        const dv = new DataView(b.buffer, b.byteOffset + body, size)
        out.durationMs = size === 8 ? dv.getFloat64(0) : dv.getFloat32(0)
      } else if (id === 0xb0) {
        out.width = uintOf(b, body, size)
      } else if (id === 0xba) {
        out.height = uintOf(b, body, size)
      } else if (id === 0x86) {
        out.codec = String.fromCharCode(...b.subarray(body, stop))
      } else if (id === 0x53c0) {
        out.alphaMode = uintOf(b, body, size)
      } else if (id === 0xa3 || id === 0xa1) {
        // SimpleBlock or Block: track vint, int16 relative time, flags, payload.
        const tl = readSize(b, body).len
        const rel = new DataView(b.buffer, b.byteOffset + body + tl, 2).getInt16(0)
        const flags = b[body + tl + 2]
        const data = b.slice(body + tl + 3, stop)
        const frame = { timeMs: clusterTime + rel, data }
        if (id === 0xa3) out.frames.push({ ...frame, key: !!(flags & 0x80), additional: null })
        else if (group) group.block = frame
      } else if (id === 0xfb) {
        if (group) group.key = false // ReferenceBlock: this frame depends on another
      } else if (id === 0xa5) {
        if (group) group.additional = b.slice(body, stop)
      } else if (id === 0xee) {
        if (group) group.addId = uintOf(b, body, size)
      }
      p = stop
    }
  }
  walk(0, b.length)
  return out
}
