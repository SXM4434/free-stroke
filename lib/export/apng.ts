/**
 * ANIMATED PNG — the transparent, lossless half of the export.
 *
 * ── WHY A SECOND FORMAT, AND WHY THIS ONE ─────────────────────────────────
 * Not because more formats is better. Because the two are answers to two
 * different questions, and the category prices them separately: on Jitter's
 * pricing page, captured 2026-08-01 (`docs/refs-competitive/ref-15-jitter-pricing.png`),
 * the free tier gets "Video, GIF, Lottie export · 720p, 30fps", Pro ($15) buys
 * "1080p, 60fps · ProRes, WebM", and **"Transparent export"** does not appear
 * until Max ($35). Rotato's export page leads with the same thing — "Export a
 * PNG image with a transparent background — Blend in nicely with other design
 * elements" (`ref-03-rotato-exporting.png`).
 *
 * A mark drawn by hand is exactly the asset someone wants to drop onto their
 * own background, and Free Stroke's still export already ships `transparent` as
 * a checkbox. An animated export that could not do the same would be a step
 * backwards from the still.
 *
 * APNG rather than transparent WebM because the alpha path in VP9/Matroska is a
 * per-block side-data channel (`BlockAdditions`), i.e. a second, more delicate
 * muxer — while APNG is deflate + a chunk layout, is lossless (a dithered or
 * ASCII mark is exactly the kind of high-frequency graphic that a video codec
 * smears), and needs no `VideoEncoder`, so it is also the fallback wherever
 * WebCodecs is missing.
 *
 * ── THE FORMAT, IN THE AMOUNT NEEDED ──────────────────────────────────────
 * A PNG plus three chunk types:
 *   acTL  once, before the first IDAT: frame count and loop count
 *   fcTL  before each frame: size, offset, delay as a RATIONAL, dispose/blend
 *   fdAT  the 2nd..nth frame's pixels — IDAT with a sequence number in front
 * Every frame here is full-size at (0,0) with dispose=NONE and blend=SOURCE,
 * i.e. each frame REPLACES the last. That is the only combination that is
 * correct without qualification for a transparent subject: `blend=OVER` would
 * composite a semi-transparent mark on top of its own previous frame and leave
 * a smear behind the moving pen tip.
 *
 * Delay is written as `num/1000` seconds, so a 30 fps frame is exactly 33/1000
 * and not a rounded hundredth — the unit most GIF-derived writers use, and the
 * reason so many exported loops run a hair slow.
 */

/** Zlib-format deflate, the wrapper PNG's IDAT actually wants (RFC 1950). */
async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const CS = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream
  if (!CS) throw new Error("apng: CompressionStream unavailable")
  // `deflate` is the zlib wrapper; `deflate-raw` is not what PNG wants.
  const cs = new CS("deflate")
  const writer = cs.writable.getWriter()
  void writer.write(data)
  void writer.close()
  const chunks: Uint8Array[] = []
  const reader = cs.readable.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value as Uint8Array)
  }
  let n = 0
  for (const c of chunks) n += c.length
  const out = new Uint8Array(n)
  let o = 0
  for (const c of chunks) {
    out.set(c, o)
    o += c.length
  }
  return out
}

/* ---- CRC-32, the one PNG uses ---------------------------------------- */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + payload.length)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, payload.length, false)
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i)
  out.set(payload, 8)
  // The CRC covers the TYPE as well as the payload — a CRC over the payload
  // alone produces a file that every decoder rejects, and it is the single
  // easiest thing to get wrong here.
  dv.setUint32(8 + payload.length, crc32(out.subarray(4, 8 + payload.length)), false)
  return out
}

const PNG_SIGNATURE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/**
 * Prefix each scanline with filter type 0 (None).
 *
 * Adaptive filtering (Paeth/Sub/Up) would compress better and is the obvious
 * next step; it is deliberately NOT here, because a wrong filter produces a
 * file that decodes to plausible-looking garbage rather than an error, and the
 * gate for this module is "ffmpeg decodes it to the pixels we put in".
 */
function rawWithFilters(rgba: Uint8Array, width: number, height: number): Uint8Array {
  const stride = width * 4
  const out = new Uint8Array((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    out[y * (stride + 1)] = 0
    out.set(rgba.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1)
  }
  return out
}

export interface ApngFrameInput {
  /** RGBA8, `width * height * 4` bytes, top row first. */
  rgba: Uint8Array
  /** How long this frame is shown, in ms. */
  delayMs: number
}

export interface ApngOptions {
  width: number
  height: number
  /** 0 = loop forever, which is what a shareable mark wants. */
  loops?: number
}

/**
 * Incremental writer: `addFrame` compresses as it goes so a long export does
 * not hold every uncompressed frame at once (1920×1080 RGBA is 8.3 MB each —
 * 300 of those is 2.5 GB, and that is how an export tab dies).
 */
export class ApngWriter {
  private readonly parts: Uint8Array[] = []
  private frameCount = 0
  private seq = 0
  private finished = false

  constructor(private readonly opts: ApngOptions) {}

  async addFrame(frame: ApngFrameInput): Promise<void> {
    if (this.finished) throw new Error("apng: writer already finished")
    const { width, height } = this.opts
    const expected = width * height * 4
    if (frame.rgba.length !== expected) {
      throw new Error(`apng: frame is ${frame.rgba.length} bytes, expected ${expected} (${width}x${height} RGBA)`)
    }
    const compressed = await deflate(rawWithFilters(frame.rgba, width, height))

    /* fcTL — 26 bytes. delay is a RATIONAL num/den in seconds. */
    const fctl = new Uint8Array(26)
    const dv = new DataView(fctl.buffer)
    dv.setUint32(0, this.seq++, false)
    dv.setUint32(4, width, false)
    dv.setUint32(8, height, false)
    dv.setUint32(12, 0, false) // x_offset
    dv.setUint32(16, 0, false) // y_offset
    dv.setUint16(20, Math.max(0, Math.round(frame.delayMs)), false) // delay_num
    dv.setUint16(22, 1000, false) // delay_den — ms, exactly
    fctl[24] = 0 // dispose_op = NONE
    fctl[25] = 0 // blend_op   = SOURCE
    this.parts.push(chunk("fcTL", fctl))

    if (this.frameCount === 0) {
      this.parts.push(chunk("IDAT", compressed))
    } else {
      const fdat = new Uint8Array(4 + compressed.length)
      new DataView(fdat.buffer).setUint32(0, this.seq++, false)
      fdat.set(compressed, 4)
      this.parts.push(chunk("fdAT", fdat))
    }
    this.frameCount++
  }

  finish(): Uint8Array {
    if (this.finished) throw new Error("apng: writer already finished")
    if (this.frameCount === 0) throw new Error("apng: no frames")
    this.finished = true
    const { width, height, loops } = this.opts

    const ihdr = new Uint8Array(13)
    const dv = new DataView(ihdr.buffer)
    dv.setUint32(0, width, false)
    dv.setUint32(4, height, false)
    ihdr[8] = 8 // bit depth
    ihdr[9] = 6 // colour type 6 = RGBA
    ihdr[10] = 0 // deflate
    ihdr[11] = 0 // adaptive filtering
    ihdr[12] = 0 // no interlace

    const actl = new Uint8Array(8)
    const adv = new DataView(actl.buffer)
    adv.setUint32(0, this.frameCount, false)
    adv.setUint32(4, Math.max(0, loops ?? 0), false)

    const head = [PNG_SIGNATURE, chunk("IHDR", ihdr), chunk("acTL", actl)]
    const tail = [chunk("IEND", new Uint8Array(0))]
    const all = [...head, ...this.parts, ...tail]

    let n = 0
    for (const p of all) n += p.length
    const out = new Uint8Array(n)
    let o = 0
    for (const p of all) {
      out.set(p, o)
      o += p.length
    }
    return out
  }
}

export { crc32 as apngCrc32 }
