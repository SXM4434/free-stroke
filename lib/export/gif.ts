/**
 * ANIMATED GIF, the format that plays everywhere a video does not.
 *
 * Coverage row 94. A GIF is 256 colours per frame and no partial alpha, and
 * the two ways a GIF exporter usually goes wrong on this app's subject are both
 * about the PAPER:
 *
 *   1. Error-diffusion dithering. Floyd-Steinberg spreads each pixel's
 *      quantisation error onto its neighbours, so a flat #fafafa ground whose
 *      nearest palette entry is a hair off becomes a field of single-pixel
 *      speckle, and the speckle crawls from frame to frame because the error
 *      pattern depends on the ink. This writer NEVER dithers: every pixel goes
 *      to its nearest palette entry and nothing else.
 *   2. A palette that has no exact paper entry. Median cut averages the colours
 *      in a box, so the paper comes out as a near-paper mean and the whole
 *      ground shifts. Here the paper (passed as `reserve`) and any colour that
 *      covers at least 1% of a frame keep an EXACT entry, so a flat ground and a
 *      flat ink fill come back byte for byte. Only the anti-aliased edge, which
 *      is where the extra colours live, is quantised.
 *
 * Each frame carries its OWN local palette rather than one global palette:
 * the frames arrive one at a time from the recorder and a 2x film does not fit
 * in memory as raw RGBA, so a global palette would need a second render pass.
 * The exact entries make the paper and the flat ink identical across frames
 * anyway, which is what a local palette would otherwise put at risk.
 *
 * Timing is in centiseconds, which is GIF's unit. Delays are rounded on the
 * RUNNING time (frame i ends at round(t_i / 10)), not frame by frame, so 30 fps
 * reads 3, 4, 3, 3, 4, 3 and the film is as long as the plan instead of 10%
 * short. Browsers play a delay under 2 cs at 10 cs, so the caller keeps GIF at
 * 50 fps or less (`GIF_MAX_FPS`) and this writer counts any delay it had to
 * raise.
 *
 * No DOM, no imports: `scripts/verify/assert-export-formats.mjs` runs it in
 * Node and decodes the result with ffmpeg.
 */

/** The fastest frame rate a GIF can carry without browsers slowing it down. */
export const GIF_MAX_FPS = 50

export interface GifWriterOptions {
  width: number
  height: number
  /** 0 = loop forever. */
  loops?: number
  /** Pixels with alpha under 128 become the transparent index. */
  transparent?: boolean
  /** Colours that must keep an exact palette entry when present, "#rrggbb". */
  reserve?: string[]
}

export interface GifFrameInput {
  /** width * height * 4 bytes, straight (not premultiplied) RGBA. */
  rgba: Uint8Array | Uint8ClampedArray
  delayMs: number
}

export interface GifPalette {
  /** r, g, b triples. Length is 3 * size, size a power of two from 4 to 256. */
  colors: Uint8Array
  /** Entries actually used (the rest is padding). */
  used: number
  /** The index reserved for transparency, or -1. */
  transparentIndex: number
  /** Colour key (r << 16 | g << 8 | b) to index, for the colours kept exact. */
  exact: Map<number, number>
}

/** A colour covering at least this share of a frame keeps an exact entry. */
const EXACT_SHARE = 0.01
/** At most this many colours are kept exact by frequency, beyond `reserve`. */
const EXACT_MAX = 16
/** The exact-colour census stops adding new colours past this many. */
const CENSUS_CAP = 1 << 16

function parseHex(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  return m ? parseInt(m[1], 16) : null
}

const bin15 = (r: number, g: number, b: number) => ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)

interface Box {
  bins: number[]
  count: number
}

/**
 * Median cut over a 15-bit histogram. Each box is split on its widest channel
 * at the pixel-weighted median until there are `slots` boxes or nothing left
 * to split; each box's colour is the weighted mean of the pixels in it.
 */
function medianCut(hist: Uint32Array, sums: Float64Array, slots: number): number[][] {
  if (slots <= 0) return []
  const all: number[] = []
  let total = 0
  for (let i = 0; i < hist.length; i++) if (hist[i] > 0) { all.push(i); total += hist[i] }
  if (all.length === 0) return []
  const boxes: Box[] = [{ bins: all, count: total }]
  const ch = (bin: number, c: number) => (c === 0 ? bin >> 10 : c === 1 ? (bin >> 5) & 31 : bin & 31)
  while (boxes.length < slots) {
    let pick = -1
    let best = -1
    let bestCh = 0
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]
      if (b.bins.length < 2) continue
      for (let c = 0; c < 3; c++) {
        let lo = 31
        let hi = 0
        for (const bin of b.bins) {
          const v = ch(bin, c)
          if (v < lo) lo = v
          if (v > hi) hi = v
        }
        /* Range weighted by population, so a wide box of three stray pixels
         * does not win a split over the anti-aliased edge the eye reads. */
        const score = (hi - lo) * Math.sqrt(b.count)
        if (score > best) { best = score; pick = i; bestCh = c }
      }
    }
    if (pick < 0 || best <= 0) break
    const b = boxes[pick]
    b.bins.sort((x, y) => ch(x, bestCh) - ch(y, bestCh))
    let acc = 0
    let cut = 1
    for (let i = 0; i < b.bins.length - 1; i++) {
      acc += hist[b.bins[i]]
      cut = i + 1
      if (acc * 2 >= b.count) break
    }
    const left = b.bins.slice(0, cut)
    const right = b.bins.slice(cut)
    const cnt = (bins: number[]) => bins.reduce((s, x) => s + hist[x], 0)
    boxes.splice(pick, 1, { bins: left, count: cnt(left) }, { bins: right, count: cnt(right) })
  }
  return boxes.map((b) => {
    let r = 0
    let g = 0
    let bl = 0
    for (const bin of b.bins) {
      r += sums[bin * 3]
      g += sums[bin * 3 + 1]
      bl += sums[bin * 3 + 2]
    }
    const n = Math.max(1, b.count)
    return [Math.round(r / n), Math.round(g / n), Math.round(bl / n)]
  })
}

/**
 * The palette for one frame. Exact when the frame has few enough colours;
 * otherwise `reserve`, then the frequent colours, exact, then median cut for
 * the rest.
 */
export function buildGifPalette(
  rgba: Uint8Array | Uint8ClampedArray,
  opts: { transparent?: boolean; reserve?: string[] } = {},
): GifPalette {
  const transparent = !!opts.transparent
  const maxColors = transparent ? 255 : 256
  const census = new Map<number, number>()
  const hist = new Uint32Array(32768)
  const sums = new Float64Array(32768 * 3)
  let opaque = 0
  for (let o = 0; o < rgba.length; o += 4) {
    if (transparent && rgba[o + 3] < 128) continue
    const r = rgba[o]
    const g = rgba[o + 1]
    const b = rgba[o + 2]
    opaque++
    const key = (r << 16) | (g << 8) | b
    const had = census.get(key)
    if (had !== undefined) census.set(key, had + 1)
    else if (census.size < CENSUS_CAP) census.set(key, 1)
    const bin = bin15(r, g, b)
    hist[bin]++
    sums[bin * 3] += r
    sums[bin * 3 + 1] += g
    sums[bin * 3 + 2] += b
  }

  const entries: number[][] = []
  const exact = new Map<number, number>()
  const keep = (key: number) => {
    if (exact.has(key) || entries.length >= maxColors) return
    exact.set(key, entries.length)
    entries.push([(key >> 16) & 255, (key >> 8) & 255, key & 255])
  }

  if (census.size <= maxColors && census.size < CENSUS_CAP) {
    for (const key of census.keys()) keep(key)
  } else {
    for (const hex of opts.reserve ?? []) {
      const key = parseHex(hex)
      if (key !== null && census.has(key)) keep(key)
    }
    const frequent = [...census.entries()].filter(([, n]) => n >= opaque * EXACT_SHARE).sort((a, b) => b[1] - a[1])
    for (const [key] of frequent.slice(0, EXACT_MAX)) keep(key)
    /* The exact colours' pixels leave the histogram, so median cut spends its
     * slots on the edge colours that are actually left to approximate. */
    for (const key of exact.keys()) {
      const n = census.get(key) ?? 0
      const r = (key >> 16) & 255
      const g = (key >> 8) & 255
      const b = key & 255
      const bin = bin15(r, g, b)
      hist[bin] -= n
      sums[bin * 3] -= r * n
      sums[bin * 3 + 1] -= g * n
      sums[bin * 3 + 2] -= b * n
    }
    for (const c of medianCut(hist, sums, maxColors - entries.length)) entries.push(c)
  }

  const used = entries.length + (transparent ? 1 : 0)
  let size = 4
  while (size < used) size *= 2
  const colors = new Uint8Array(size * 3)
  entries.forEach((c, i) => colors.set(c, i * 3))
  return { colors, used, transparentIndex: transparent ? entries.length : -1, exact }
}

/**
 * Pixels to palette indices. Exact colours by lookup; every other colour to
 * its NEAREST entry, cached per 15-bit bin. No error diffusion, ever.
 */
export function indexGifFrame(rgba: Uint8Array | Uint8ClampedArray, pal: GifPalette): Uint8Array {
  const n = rgba.length >> 2
  const out = new Uint8Array(n)
  const cache = new Int16Array(32768).fill(-1)
  const solid = pal.transparentIndex >= 0 ? pal.transparentIndex : pal.used
  const nearest = (r: number, g: number, b: number) => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < solid; i++) {
      const dr = pal.colors[i * 3] - r
      const dg = pal.colors[i * 3 + 1] - g
      const db = pal.colors[i * 3 + 2] - b
      const d = dr * dr * 3 + dg * dg * 4 + db * db * 2
      if (d < bestD) { bestD = d; best = i }
    }
    return best
  }
  let lastKey = -1
  let lastIdx = 0
  for (let p = 0, o = 0; p < n; p++, o += 4) {
    if (pal.transparentIndex >= 0 && rgba[o + 3] < 128) {
      out[p] = pal.transparentIndex
      continue
    }
    const r = rgba[o]
    const g = rgba[o + 1]
    const b = rgba[o + 2]
    const key = (r << 16) | (g << 8) | b
    if (key === lastKey) {
      out[p] = lastIdx
      continue
    }
    let idx = pal.exact.get(key)
    if (idx === undefined) {
      const bin = bin15(r, g, b)
      let c = cache[bin]
      if (c < 0) {
        c = nearest(((r >> 3) << 3) | 4, ((g >> 3) << 3) | 4, ((b >> 3) << 3) | 4)
        cache[bin] = c
      }
      idx = c
    }
    lastKey = key
    lastIdx = idx
    out[p] = idx
  }
  return out
}

/* ---- LZW, the GIF variant (variable code width, LSB-first) ------------- */

function lzw(indices: Uint8Array, minCodeSize: number): Uint8Array {
  const out: number[] = []
  let cur = 0
  let curBits = 0
  const emit = (code: number, width: number) => {
    cur |= code << curBits
    curBits += width
    while (curBits >= 8) {
      out.push(cur & 255)
      cur >>>= 8
      curBits -= 8
    }
  }
  const clear = 1 << minCodeSize
  const eoi = clear + 1
  let width = minCodeSize + 1
  let next = eoi + 1
  let dict = new Map<number, number>()
  emit(clear, width)
  if (indices.length === 0) {
    emit(eoi, width)
    if (curBits > 0) out.push(cur & 255)
    return Uint8Array.from(out)
  }
  let prefix = indices[0]
  for (let i = 1; i < indices.length; i++) {
    const k = indices[i]
    const key = (prefix << 8) | k
    const hit = dict.get(key)
    if (hit !== undefined) {
      prefix = hit
      continue
    }
    emit(prefix, width)
    if (next < 4096) {
      dict.set(key, next++)
      if (next > 1 << width && width < 12) width++
    } else {
      emit(clear, width)
      dict = new Map()
      width = minCodeSize + 1
      next = eoi + 1
    }
    prefix = k
  }
  emit(prefix, width)
  emit(eoi, width)
  if (curBits > 0) out.push(cur & 255)
  return Uint8Array.from(out)
}

function subBlocks(data: Uint8Array): Uint8Array {
  const n = Math.ceil(data.length / 255)
  const out = new Uint8Array(data.length + n + 1)
  let o = 0
  for (let i = 0; i < data.length; i += 255) {
    const len = Math.min(255, data.length - i)
    out[o++] = len
    out.set(data.subarray(i, i + len), o)
    o += len
  }
  out[o] = 0
  return out
}

const u16 = (v: number) => [v & 255, (v >> 8) & 255]

/**
 * Buffers each frame's ENCODED bytes (not its pixels) and writes the file on
 * `finish()`.
 */
export class GifWriter {
  private parts: Uint8Array[] = []
  private elapsedMs = 0
  private frames = 0
  /** Frames whose delay had to be raised to GIF's 2 cs floor. */
  clampedDelays = 0
  /** Centisecond delays written, in order. */
  readonly delaysCs: number[] = []

  constructor(private readonly opts: GifWriterOptions) {
    if (opts.width < 1 || opts.height < 1 || opts.width > 65535 || opts.height > 65535) {
      throw new Error(`gif: ${opts.width}x${opts.height} is not a GIF size`)
    }
  }

  get frameCount() {
    return this.frames
  }

  addFrame(frame: GifFrameInput): void {
    const { width, height, transparent } = this.opts
    if (frame.rgba.length !== width * height * 4) {
      throw new Error(`gif: frame is ${frame.rgba.length} bytes, expected ${width * height * 4}`)
    }
    const pal = buildGifPalette(frame.rgba, { transparent, reserve: this.opts.reserve })
    const idx = indexGifFrame(frame.rgba, pal)

    /* ROUNDED ON THE RUNNING CLOCK. Each frame ends where the plan says the
     * running time is, so rounding error never accumulates. */
    const start = Math.round(this.elapsedMs / 10)
    this.elapsedMs += Math.max(0, frame.delayMs)
    let cs = Math.round(this.elapsedMs / 10) - start
    if (cs < 2) {
      cs = 2
      this.clampedDelays++
    }
    this.delaysCs.push(cs)

    const size = pal.colors.length / 3
    const sizeBits = Math.log2(size) - 1
    /* Graphic Control Extension. Disposal 2 (restore to background) under
     * transparency, so a see-through pixel shows the page and not the previous
     * frame; disposal 1 (leave in place) otherwise, since every frame is full
     * size and opaque. */
    const disposal = transparent ? 2 : 1
    const gce = Uint8Array.from([
      0x21, 0xf9, 4,
      (disposal << 2) | (pal.transparentIndex >= 0 ? 1 : 0),
      ...u16(cs),
      pal.transparentIndex >= 0 ? pal.transparentIndex : 0,
      0,
    ])
    const desc = Uint8Array.from([0x2c, 0, 0, 0, 0, ...u16(width), ...u16(height), 0x80 | sizeBits])
    const minCode = Math.max(2, Math.log2(size))
    const data = subBlocks(lzw(idx, minCode))
    const part = new Uint8Array(gce.length + desc.length + pal.colors.length + 1 + data.length)
    let o = 0
    part.set(gce, o); o += gce.length
    part.set(desc, o); o += desc.length
    part.set(pal.colors, o); o += pal.colors.length
    part[o++] = minCode
    part.set(data, o)
    this.parts.push(part)
    this.frames++
  }

  finish(): Uint8Array {
    if (this.frames === 0) throw new Error("gif: no frames")
    const { width, height } = this.opts
    const head = Uint8Array.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
      ...u16(width), ...u16(height),
      0x00, // no global colour table; every frame carries its own
      0, 0,
      // NETSCAPE2.0 loop extension
      0x21, 0xff, 11, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30,
      3, 1, ...u16(Math.max(0, this.opts.loops ?? 0)), 0,
    ])
    let n = head.length + 1
    for (const p of this.parts) n += p.length
    const out = new Uint8Array(n)
    out.set(head, 0)
    let o = head.length
    for (const p of this.parts) {
      out.set(p, o)
      o += p.length
    }
    out[o] = 0x3b
    return out
  }
}
