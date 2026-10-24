// AN INDEPENDENT GIF BLOCK WALKER for the export gates. It shares no code with
// `lib/export/gif.ts`: it reads the file the way a decoder's first pass does
// (header, tables, extensions, image descriptors, sub-block chains, trailer)
// and reports the frame count, size, delays, loop count and each frame's
// rectangle. Pixels are ffmpeg's job.

export /** Walks the GIF block structure. No LZW decode; ffmpeg does the pixels. */
function parseGif(b) {
  const sig = String.fromCharCode(...b.subarray(0, 6))
  if (sig !== "GIF89a" && sig !== "GIF87a") throw new Error(`not a GIF: ${sig}`)
  const width = b[6] | (b[7] << 8)
  const height = b[8] | (b[9] << 8)
  const packed = b[10]
  let p = 13
  if (packed & 0x80) p += 3 * (1 << ((packed & 7) + 1))
  const out = { width, height, frames: 0, delays: [], loops: null, trailer: false, rects: [] }
  let pendingDelay = null
  const skipSub = () => {
    while (b[p] !== 0) {
      if (p >= b.length) throw new Error("ran off the end in a sub-block chain")
      p += b[p] + 1
    }
    p++
  }
  while (p < b.length) {
    const t = b[p++]
    if (t === 0x3b) {
      out.trailer = true
      break
    }
    if (t === 0x21) {
      const label = b[p++]
      if (label === 0xf9) {
        pendingDelay = b[p + 2] | (b[p + 3] << 8)
        p += b[p] + 1
        skipSub()
      } else if (label === 0xff) {
        const id = String.fromCharCode(...b.subarray(p + 1, p + 12))
        p += b[p] + 1
        if (id === "NETSCAPE2.0" && b[p] === 3) out.loops = b[p + 2] | (b[p + 3] << 8)
        skipSub()
      } else {
        p += b[p] + 1
        skipSub()
      }
    } else if (t === 0x2c) {
      const x = b[p] | (b[p + 1] << 8), y = b[p + 2] | (b[p + 3] << 8)
      const w = b[p + 4] | (b[p + 5] << 8), h = b[p + 6] | (b[p + 7] << 8)
      const lp = b[p + 8]
      p += 9
      if (lp & 0x80) p += 3 * (1 << ((lp & 7) + 1))
      p++ // LZW minimum code size
      skipSub()
      out.frames++
      out.delays.push(pendingDelay ?? 0)
      out.rects.push([x, y, w, h])
      pendingDelay = null
    } else {
      throw new Error(`unknown block 0x${t.toString(16)} at ${p - 1}`)
    }
  }
  return out
}

