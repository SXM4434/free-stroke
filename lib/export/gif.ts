/**
 * ANIMATED GIF: a GIF89a writer and the palette it is written with.
 *
 * Coverage row 94 (R2 N37): "GIF export", MISSING until this file. A GIF is the
 * one moving format every chat app, issue tracker and slide tool shows inline,
 * which is why it is asked for even though it is the worst codec on the list.
 *
 * ── WHAT A GIF CANNOT DO, AND WHAT THIS FILE DOES ABOUT EACH ──────────────
 *
 *   256 colours per frame.  A mark on paper is a small number of real colours
 *                           (the paper, the ink, the lit side of the ink) plus
 *                           the anti-aliased ramp between them. The palette is
 *                           built ONCE for the whole film from sampled frames,
 *                           so the paper cannot shimmer frame to frame the way a
 *                           per-frame palette makes it, and the paper and the
 *                           ink's core colour are RESERVED as exact entries so
 *                           neither is ever approximated. See `buildInkPalette`.
 *
 *   No dithering, on purpose. Error diffusion spends the palette's error as
 *                           noise, and on a flat paper ground that noise is a
 *                           field of specks around every stroke: the ink stops
 *                           looking clean, which is the one thing the owner
 *                           asked the palette to keep. Nearest colour, no
 *                           diffusion; the gate measures the paper staying
 *                           exactly paper and the ink error staying small.
 *
 *   Centisecond delays.     Frame delays are whole 1/100 s, and every major
 *                           browser plays a delay under 2 cs as 10 cs. So the
 *                           caller caps the frame rate at 50 (`GIF_MAX_FPS`),
 *                           and the delays are cut from the PLAN's timestamps
 *                           by rounding each instant, not each gap: at 30 fps
 *                           that gives 3, 3, 4, 3, 3, 4 cs and the film's total
 *                           length lands on the plan's to the centisecond
 *                           instead of drifting 3.3 ms per frame.
 *
 *   No alpha to speak of.   GIF transparency is one bit. A soft ink edge over a
 *                           one-bit mask is a fringe in the colour of whatever
 *                           ground it was cut from, so a GIF here is always on
 *                           paper and the caller says so when asked for alpha.
 *
 * ── SIZE ──────────────────────────────────────────────────────────────────
 * Every frame after the first writes only the rectangle that changed since the
 * previous one, with disposal "do not dispose", so the draw-in costs roughly
 * the stroke's own area per frame rather than the whole viewport. A frame that
 * changed nothing still writes a 1x1 frame: the frame COUNT is the plan's, one
 * GIF frame per planned frame, and the gate holds the file to that.
 *
 * Nothing here imports the DOM, React, three or an app module; the writer and
 * the palette run in plain node, which is how `assert-export-gif.mjs` checks
 * them. `GifEncoder` in `./encoders` is the browser half.
 */

/** Browsers play a delay under 2 cs as 10 cs, so 50 fps is the honest ceiling. */
export const GIF_MAX_FPS = 50

export interface InkPalette {
  /** `count` RGB triples, `r g b r g b ...`. */
  rgb: Uint8Array
  count: number
  /** Index of the reserved paper entry, or -1 when no ground was given. */
  groundIndex: number
  /** Index of the reserved ink-core entry, or -1 when the samples had no ink. */
  inkIndex: number
}

export interface InkPaletteOptions {
  /** The ground every frame was composited onto, `[r, g, b]`. Reserved exactly. */
  ground?: readonly [number, number, number] | null
  /** Palette size, 2..256. */
  maxColors?: number
}

/** `#rrggbb` to `[r, g, b]`; null for anything else. */
export function parseHexColor(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/* A box of histogram bins for median cut. Bins are 5 bits per channel. */
interface Box {
  bins: number[]
  weight: number
}

/**
 * THE PALETTE, BUILT FROM THE FILM AND NOT FROM ONE FRAME.
 *
 * 1. Every sampled pixel lands in a 5-bit-per-channel bin that also keeps the
 *    exact colour sum, so an entry is the true mean of the colours it stands
 *    for rather than a bin corner.
 * 2. The ground is reserved exactly and its pixels are taken out of the cut:
 *    paper is most of every frame, and a paper that came back one level off
 *    would be a visible seam against the page it is posted on.
 * 3. The ink core, the most frequent non-ground colour, is reserved exactly.
 * 4. Median cut over what is left, each bin weighted by the SQUARE ROOT of its
 *    count. A straight count would spend the palette on the stroke's interior
 *    and leave the thin anti-aliased ramp (few pixels, many colours) with a
 *    handful of steps, which is where banding on an edge comes from.
 */
export function buildInkPalette(samples: readonly Uint8Array[], opts: InkPaletteOptions = {}): InkPalette {
  const maxColors = Math.max(2, Math.min(256, Math.floor(opts.maxColors ?? 256)))
  const ground = opts.ground ?? null
  const count = new Float64Array(32768)
  const sr = new Float64Array(32768)
  const sg = new Float64Array(32768)
  const sb = new Float64Array(32768)
  let groundKey = -1
  if (ground) groundKey = (ground[0] << 16) | (ground[1] << 8) | ground[2]
  const exact = new Map<number, number>()

  for (const px of samples) {
    for (let i = 0; i + 3 < px.length; i += 4) {
      const r = px[i]
      const g = px[i + 1]
      const b = px[i + 2]
      const key = (r << 16) | (g << 8) | b
      if (key === groundKey) continue
      const bin = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      count[bin]++
      sr[bin] += r
      sg[bin] += g
      sb[bin] += b
      exact.set(key, (exact.get(key) ?? 0) + 1)
    }
  }

  const out: number[] = []
  let groundIndex = -1
  let inkIndex = -1
  if (ground) {
    groundIndex = out.length / 3
    out.push(ground[0], ground[1], ground[2])
  }
  let inkKey = -1
  let inkCount = 0
  for (const [k, n] of exact) {
    if (n > inkCount) {
      inkCount = n
      inkKey = k
    }
  }
  if (inkKey >= 0) {
    inkIndex = out.length / 3
    out.push((inkKey >> 16) & 255, (inkKey >> 8) & 255, inkKey & 255)
  }

  const used: number[] = []
  for (let b = 0; b < 32768; b++) if (count[b] > 0) used.push(b)
  const budget = maxColors - out.length / 3

  if (used.length <= budget) {
    /* FEW ENOUGH COLOURS TO KEEP EVERY ONE. A flat ink on paper with a short
     * ramp usually lands here, and then the palette is exact per bin. */
    for (const b of used) {
      const n = count[b]
      out.push(Math.round(sr[b] / n), Math.round(sg[b] / n), Math.round(sb[b] / n))
    }
  } else if (budget > 0) {
    const wOf = (b: number) => Math.sqrt(count[b])
    const boxes: Box[] = [{ bins: used, weight: used.reduce((a, b) => a + wOf(b), 0) }]
    const rangeOf = (box: Box) => {
      let r0 = 31, r1 = 0, g0 = 31, g1 = 0, b0 = 31, b1 = 0
      for (const b of box.bins) {
        const r = b >> 10, g = (b >> 5) & 31, bl = b & 31
        if (r < r0) r0 = r
        if (r > r1) r1 = r
        if (g < g0) g0 = g
        if (g > g1) g1 = g
        if (bl < b0) b0 = bl
        if (bl > b1) b1 = bl
      }
      return { r: r1 - r0, g: g1 - g0, b: b1 - b0 }
    }
    while (boxes.length < budget) {
      /* Split the box with the most weight times extent: a heavy box that is
       * already one colour has nothing to give. */
      let best = -1
      let bestScore = 0
      for (let i = 0; i < boxes.length; i++) {
        if (boxes[i].bins.length < 2) continue
        const rg = rangeOf(boxes[i])
        const score = boxes[i].weight * Math.max(rg.r, rg.g, rg.b)
        if (score > bestScore) {
          bestScore = score
          best = i
        }
      }
      if (best < 0) break
      const box = boxes[best]
      const rg = rangeOf(box)
      const axis = rg.r >= rg.g && rg.r >= rg.b ? 0 : rg.g >= rg.b ? 1 : 2
      const chan = (b: number) => (axis === 0 ? b >> 10 : axis === 1 ? (b >> 5) & 31 : b & 31)
      box.bins.sort((a, b) => chan(a) - chan(b))
      let acc = 0
      let cut = 1
      for (let i = 0; i < box.bins.length - 1; i++) {
        acc += wOf(box.bins[i])
        cut = i + 1
        if (acc >= box.weight / 2) break
      }
      const lo = box.bins.slice(0, cut)
      const hi = box.bins.slice(cut)
      boxes.splice(best, 1, { bins: lo, weight: lo.reduce((a, b) => a + wOf(b), 0) }, {
        bins: hi,
        weight: hi.reduce((a, b) => a + wOf(b), 0),
      })
    }
    for (const box of boxes) {
      let n = 0, r = 0, g = 0, b = 0
      for (const bin of box.bins) {
        n += count[bin]
        r += sr[bin]
        g += sg[bin]
        b += sb[bin]
      }
      if (n > 0) out.push(Math.round(r / n), Math.round(g / n), Math.round(b / n))
    }
  }
  if (out.length === 0) out.push(0, 0, 0)
  return { rgb: Uint8Array.from(out), count: out.length / 3, groundIndex, inkIndex }
}

/**
 * Nearest palette entry, remembered per exact colour. A draw-in frame holds a
 * few hundred distinct colours, so the cache turns a 256-way search per pixel
 * into a Map lookup almost everywhere.
 */
export class PaletteMapper {
  private cache = new Map<number, number>()
  constructor(readonly palette: InkPalette) {
    const { rgb, count } = palette
    /* Exact entries map to themselves first, so a reserved colour can never
     * lose a tie to a neighbour with the same distance. */
    for (let i = count - 1; i >= 0; i--) this.cache.set((rgb[i * 3] << 16) | (rgb[i * 3 + 1] << 8) | rgb[i * 3 + 2], i)
  }

  index(r: number, g: number, b: number): number {
    const key = (r << 16) | (g << 8) | b
    const hit = this.cache.get(key)
    if (hit !== undefined) return hit
    const { rgb, count } = this.palette
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < count; i++) {
      const dr = rgb[i * 3] - r
      const dg = rgb[i * 3 + 1] - g
      const db = rgb[i * 3 + 2] - b
      /* Luma-weighted, so a step along the ink-to-paper ramp (mostly a
       * lightness change) is judged the way an eye judges it. */
      const d = 3 * dr * dr + 6 * dg * dg + db * db
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    this.cache.set(key, best)
    return best
  }

  /** An opaque RGBA frame to palette indices. Alpha is ignored. */
  mapFrame(rgba: Uint8Array, out?: Uint8Array): Uint8Array {
    const n = rgba.length >> 2
    const dst = out && out.length === n ? out : new Uint8Array(n)
    for (let p = 0, i = 0; p < n; p++, i += 4) dst[p] = this.index(rgba[i], rgba[i + 1], rgba[i + 2])
    return dst
  }
}

/* ------------------------------------------------------------------ */
/*  LZW, the GIF flavour                                              */
/* ------------------------------------------------------------------ */

class ByteSink {
  private buf = new Uint8Array(1 << 16)
  length = 0
  push(b: number) {
    if (this.length === this.buf.length) {
      const next = new Uint8Array(this.buf.length * 2)
      next.set(this.buf)
      this.buf = next
    }
    this.buf[this.length++] = b
  }
  pushAll(bytes: ArrayLike<number>) {
    for (let i = 0; i < bytes.length; i++) this.push(bytes[i])
  }
  bytes(): Uint8Array {
    return this.buf.slice(0, this.length)
  }
}

/**
 * Variable-width LZW as GIF89a section 22 and appendix F specify it: codes
 * start at minCodeSize + 1 bits, grow to 12, and the table is reset with a
 * CLEAR code when it fills. Output is packed LSB first and cut into sub-blocks
 * of at most 255 bytes.
 */
export function lzwEncode(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const clear = 1 << minCodeSize
  const eoi = clear + 1
  const packed = new ByteSink()
  let bitBuf = 0
  let bitCount = 0
  let codeSize = minCodeSize + 1
  const emit = (code: number) => {
    bitBuf |= code << bitCount
    bitCount += codeSize
    while (bitCount >= 8) {
      packed.push(bitBuf & 255)
      bitBuf >>>= 8
      bitCount -= 8
    }
  }

  /* The table as a flat hash of (prefix code, next index) to code. Keys fit in
   * 20 bits (12-bit prefix, 8-bit index). */
  let dict = new Map<number, number>()
  let next = eoi + 1
  emit(clear)
  if (indices.length === 0) {
    emit(eoi)
  } else {
    let prefix = indices[0]
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i]
      const key = (prefix << 8) | k
      const hit = dict.get(key)
      if (hit !== undefined) {
        prefix = hit
        continue
      }
      emit(prefix)
      if (next < 4096) {
        dict.set(key, next++)
        /* The decoder widens one code LATER than the encoder adds the entry
         * that needs the width, so the encoder widens when `next` passes the
         * current limit, after the add. */
        if (next > 1 << codeSize && codeSize < 12) codeSize++
      } else {
        emit(clear)
        dict = new Map()
        next = eoi + 1
        codeSize = minCodeSize + 1
      }
      prefix = k
    }
    emit(prefix)
    emit(eoi)
  }
  if (bitCount > 0) packed.push(bitBuf & 255)

  const data = packed.bytes()
  const out = new ByteSink()
  for (let o = 0; o < data.length; o += 255) {
    const n = Math.min(255, data.length - o)
    out.push(n)
    out.pushAll(data.subarray(o, o + n))
  }
  out.push(0)
  return out.bytes()
}

/* ------------------------------------------------------------------ */
/*  The container                                                     */
/* ------------------------------------------------------------------ */

export interface GifWriterOptions {
  width: number
  height: number
  palette: InkPalette
  /** 0 = loop forever (the NETSCAPE2.0 extension). */
  loops?: number
}

export interface GifFrameInput {
  /** `width * height` palette indices. */
  indices: Uint8Array
  /** Delay in centiseconds, 0..65535. */
  delayCs: number
}

function u16(sink: ByteSink, v: number) {
  sink.push(v & 255)
  sink.push((v >> 8) & 255)
}

export class GifWriter {
  private sink = new ByteSink()
  private prev: Uint8Array | null = null
  private tableBits: number
  private frames = 0

  constructor(private readonly opts: GifWriterOptions) {
    const { width, height, palette } = opts
    if (width < 1 || height < 1 || width > 65535 || height > 65535) throw new Error(`gif: size ${width}x${height}`)
    let bits = 1
    while (1 << bits < palette.count) bits++
    this.tableBits = bits
    const s = this.sink
    s.pushAll([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]) // "GIF89a"
    u16(s, width)
    u16(s, height)
    s.push(0x80 | ((bits - 1) << 4) | (bits - 1)) // global table, colour resolution, table size
    s.push(palette.groundIndex >= 0 ? palette.groundIndex : 0) // background colour index
    s.push(0) // pixel aspect ratio: unspecified
    const table = new Uint8Array((1 << bits) * 3)
    table.set(palette.rgb.subarray(0, palette.count * 3))
    s.pushAll(table)
    // NETSCAPE2.0 application extension: loop count.
    s.pushAll([0x21, 0xff, 0x0b])
    s.pushAll([0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30])
    s.pushAll([0x03, 0x01])
    u16(s, opts.loops ?? 0)
    s.push(0)
  }

  get frameCount() {
    return this.frames
  }

  addFrame(frame: GifFrameInput) {
    const { width, height } = this.opts
    const { indices } = frame
    if (indices.length !== width * height) throw new Error(`gif: frame has ${indices.length} indices, want ${width * height}`)

    /* THE CHANGED RECTANGLE. Frame 0 is the whole screen; after that only the
     * box around what differs from the previous frame is written. */
    let x0 = 0, y0 = 0, x1 = width - 1, y1 = height - 1
    const prev = this.prev
    if (prev) {
      x0 = width; y0 = height; x1 = -1; y1 = -1
      for (let y = 0; y < height; y++) {
        const row = y * width
        for (let x = 0; x < width; x++) {
          if (indices[row + x] !== prev[row + x]) {
            if (x < x0) x0 = x
            if (x > x1) x1 = x
            if (y < y0) y0 = y
            if (y > y1) y1 = y
          }
        }
      }
      if (x1 < 0) {
        /* Nothing moved. Still one frame, so the count stays the plan's: a
         * 1x1 rewrite of a pixel with its own value. */
        x0 = 0; y0 = 0; x1 = 0; y1 = 0
      }
    }
    const w = x1 - x0 + 1
    const h = y1 - y0 + 1
    const sub = new Uint8Array(w * h)
    for (let y = 0; y < h; y++) sub.set(indices.subarray((y0 + y) * width + x0, (y0 + y) * width + x0 + w), y * w)

    const s = this.sink
    // Graphic control extension: disposal 1 (leave in place), no transparency.
    s.pushAll([0x21, 0xf9, 0x04, 0x04])
    u16(s, Math.max(0, Math.min(65535, Math.round(frame.delayCs))))
    s.push(0)
    s.push(0)
    // Image descriptor, no local table, not interlaced.
    s.push(0x2c)
    u16(s, x0)
    u16(s, y0)
    u16(s, w)
    u16(s, h)
    s.push(0)
    const minCode = Math.max(2, this.tableBits)
    s.push(minCode)
    s.pushAll(lzwEncode(sub, minCode))

    this.prev = indices.slice()
    this.frames++
  }

  finish(): Uint8Array {
    if (this.frames === 0) throw new Error("gif: no frames")
    this.sink.push(0x3b)
    return this.sink.bytes()
  }
}

/**
 * Centisecond delays cut from plan timestamps: each INSTANT is rounded, so the
 * gaps absorb the rounding and the sum is the film's length to the centisecond.
 * `endUs` is the end of the last frame (its timestamp plus its duration).
 */
export function gifDelaysCs(timestampsUs: readonly number[], endUs: number): number[] {
  const out: number[] = []
  for (let i = 0; i < timestampsUs.length; i++) {
    const a = Math.round(timestampsUs[i] / 10000)
    const b = Math.round((i + 1 < timestampsUs.length ? timestampsUs[i + 1] : endUs) / 10000)
    out.push(Math.max(0, b - a))
  }
  return out
}
