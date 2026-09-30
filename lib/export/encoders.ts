/**
 * THE TWO ENCODERS, behind one interface the recorder can drive.
 *
 *   WebCodecsWebmEncoder   VP9/VP8 in WebM. The thing you post.
 *   ApngEncoder            Lossless RGBA with alpha. The thing you composite.
 *
 *   WebCodecsWebmAlphaEncoder
 *                          VP9/VP8 WebM WITH alpha, two encodes in one track.
 *                          The thing you lay over footage. See `./webm-alpha`.
 *   GifEncoder             256 colours on paper. The thing that plays inline
 *                          everywhere else. See `./gif` for the palette.
 *
 * All take frames as "whatever the viewport handed us": a canvas, an
 * ImageBitmap, or a PNG blob — because the app's existing grab
 * (`STILL_EXPORT.grab`, `components/viewport-3d.tsx`) returns a Blob today and
 * a canvas would be one small change away. Accepting both is what lets this
 * module be wired with NO edit to a file another lane owns.
 *
 * ── WHAT WAS MEASURED ABOUT `VideoEncoder` AVAILABILITY ───────────────────
 * Probed first-hand in this repo's own browser (system Chrome, headless,
 * `--use-angle=metal`, 2026-08-01):
 *
 *   about:blank         isSecureContext true · VideoEncoder UNDEFINED
 *   https://example.com isSecureContext true · VideoEncoder defined ·
 *                       isConfigSupported: vp8 ✓ · vp09.00.10.08 ✓ · avc1.42001f ✓
 *
 * So the API is real here, and a feature-detect that runs on the wrong document
 * gets the wrong answer. `pickWebmCodec()` therefore ASKS the browser rather
 * than assuming, and the recorder falls back to APNG when it says no.
 */
import { WebmMuxer, type WebmCodec } from "./webm"
import { ApngWriter } from "./apng"
import { GifWriter, PaletteMapper, buildInkPalette, gifDelaysCs, type InkPalette } from "./gif"
import { rgbaToI420Pair, WEBM_ALPHA_COLOR_SPACE } from "./webm-alpha"

/* ------------------------------------------------------------------ */
/*  Frames, in whatever shape the host can cheaply produce            */
/* ------------------------------------------------------------------ */

export type FrameSource =
  | { kind: "canvas"; canvas: HTMLCanvasElement | OffscreenCanvas; width: number; height: number }
  | { kind: "bitmap"; bitmap: ImageBitmap; width: number; height: number }
  | { kind: "blob"; blob: Blob; width: number; height: number }

export interface EncoderFrame {
  source: FrameSource
  index: number
  /** Presentation time in microseconds. */
  timestampUs: number
  /** Nominal duration in microseconds. */
  durationUs: number
}

export interface AnimationEncoder {
  readonly id: "webm" | "apng" | "gif"
  readonly mimeType: string
  readonly extension: string
  /**
   * How many frames this encoder wants to SEE before the first `addFrame`, or
   * absent for none. GIF needs one palette for the whole film, and the only
   * honest source for it is the film itself, so the recorder renders this many
   * planned instants (always the first and the last among them) and hands each
   * to `sample` first. Nothing is encoded from them.
   */
  readonly samplesWanted?: number
  sample?(source: FrameSource): Promise<void>
  addFrame(frame: EncoderFrame): Promise<void>
  finish(): Promise<Blob>
  /** Release anything the encoder is holding, on cancel or on error. */
  dispose(): void
}

/** Anything `drawImage` / `new VideoFrame` will take. */
type Paintable = HTMLCanvasElement | OffscreenCanvas | ImageBitmap

async function toPaintable(src: FrameSource): Promise<Paintable> {
  if (src.kind === "canvas") return src.canvas
  if (src.kind === "bitmap") return src.bitmap
  return await createImageBitmap(src.blob)
}

function releasePaintable(p: Paintable, src: FrameSource) {
  // Only close bitmaps WE created, or the caller's own bitmap becomes unusable
  // for the next encoder in a two-format export.
  if (src.kind === "blob" && "close" in p && typeof p.close === "function") p.close()
}

/* ------------------------------------------------------------------ */
/*  Reading pixels back, shared by the two CPU encoders               */
/* ------------------------------------------------------------------ */

class PixelReader {
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null
  constructor(private readonly width: number, private readonly height: number) {}

  private ensure() {
    if (this.ctx) return this.ctx
    if (typeof OffscreenCanvas !== "undefined") {
      this.ctx = new OffscreenCanvas(this.width, this.height).getContext("2d", { willReadFrequently: true })
    } else {
      const c = document.createElement("canvas")
      c.width = this.width
      c.height = this.height
      this.ctx = c.getContext("2d", { willReadFrequently: true })
    }
    if (!this.ctx) throw new Error("export: no 2d context to read pixels")
    return this.ctx
  }

  /** Straight RGBA of one frame, cleared first so nothing accumulates. */
  async read(src: FrameSource): Promise<Uint8Array> {
    const ctx = this.ensure()
    const paintable = await toPaintable(src)
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.drawImage(paintable as CanvasImageSource, 0, 0, this.width, this.height)
    releasePaintable(paintable, src)
    const img = ctx.getImageData(0, 0, this.width, this.height)
    return new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength)
  }

  dispose() {
    this.ctx = null
  }
}

/* ------------------------------------------------------------------ */
/*  WebM via WebCodecs                                                */
/* ------------------------------------------------------------------ */

export interface WebmCodecChoice {
  /** The WebCodecs string, e.g. `vp09.00.10.08`. */
  codec: string
  /** The Matroska CodecID that goes in the container. */
  webmCodec: WebmCodec
  label: string
}

/**
 * VP9 first, VP8 second. Both are asked about rather than assumed, at the
 * exact dimensions the export will use — `isConfigSupported` can and does
 * answer differently for different sizes.
 */
export async function pickWebmCodec(width: number, height: number, fps: number): Promise<WebmCodecChoice | null> {
  const VE = (globalThis as { VideoEncoder?: typeof VideoEncoder }).VideoEncoder
  if (!VE || typeof VE.isConfigSupported !== "function") return null
  const candidates: WebmCodecChoice[] = [
    { codec: "vp09.00.10.08", webmCodec: "V_VP9", label: "VP9" },
    { codec: "vp8", webmCodec: "V_VP8", label: "VP8" },
  ]
  for (const c of candidates) {
    try {
      const res = await VE.isConfigSupported({
        codec: c.codec,
        width,
        height,
        bitrate: bitrateFor(width, height, fps),
        framerate: fps,
      })
      if (res.supported) return c
    } catch {
      /* an unsupported codec string throws rather than answering false */
    }
  }
  return null
}

/**
 * Bits per second. 0.12 bits per pixel per frame is a deliberately generous
 * rate for this subject: a stroke on a flat ground is mostly empty, but ASCII
 * and dither fill the frame with per-pixel high-frequency detail, which is the
 * worst case for a video codec and the one where a thrifty bitrate turns the
 * user's chosen style into mush.
 */
function bitrateFor(width: number, height: number, fps: number): number {
  return Math.round(Math.min(40e6, Math.max(2e6, width * height * fps * 0.12)))
}

export class WebCodecsWebmEncoder implements AnimationEncoder {
  readonly id = "webm" as const
  readonly mimeType = "video/webm"
  readonly extension = "webm"

  private encoder: VideoEncoder | null = null
  private muxer: WebmMuxer
  private pending: Promise<void> = Promise.resolve()
  private error: Error | null = null

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly fps: number,
    private readonly choice: WebmCodecChoice,
    /** A keyframe every N frames. Seeking granularity vs file size. */
    private readonly keyFrameInterval = 30,
  ) {
    this.muxer = new WebmMuxer({ width, height, codec: choice.webmCodec, fps })
  }

  private ensure() {
    if (this.encoder) return this.encoder
    const enc = new VideoEncoder({
      output: (chunk, meta) => {
        const data = new Uint8Array(chunk.byteLength)
        chunk.copyTo(data)
        this.muxer.addFrame({
          data,
          timestampUs: chunk.timestamp,
          durationUs: chunk.duration ?? Math.round(1e6 / this.fps),
          keyFrame: chunk.type === "key",
        })
        void meta
      },
      error: (e) => {
        this.error = e instanceof Error ? e : new Error(String(e))
      },
    })
    enc.configure({
      codec: this.choice.codec,
      width: this.width,
      height: this.height,
      bitrate: bitrateFor(this.width, this.height, this.fps),
      framerate: this.fps,
      latencyMode: "quality",
    })
    this.encoder = enc
    return enc
  }

  async addFrame(frame: EncoderFrame): Promise<void> {
    if (this.error) throw this.error
    const enc = this.ensure()
    const paintable = await toPaintable(frame.source)
    const vf = new VideoFrame(paintable as CanvasImageSource, {
      timestamp: frame.timestampUs,
      duration: frame.durationUs,
    })
    try {
      enc.encode(vf, { keyFrame: frame.index % this.keyFrameInterval === 0 })
    } finally {
      vf.close()
      releasePaintable(paintable, frame.source)
    }
    /* BACKPRESSURE, NOT A QUEUE THAT GROWS FOREVER. `encodeQueueSize` is the
     * only signal the API gives, and an export that ignores it will happily
     * hold three hundred decoded frames in GPU memory and then die. */
    if (enc.encodeQueueSize > 8) {
      await new Promise<void>((r) => {
        const tick = () => (enc.encodeQueueSize <= 4 ? r() : setTimeout(tick, 4))
        tick()
      })
    }
    await this.pending
  }

  async finish(): Promise<Blob> {
    if (this.error) throw this.error
    if (this.encoder) {
      await this.encoder.flush()
      this.encoder.close()
      this.encoder = null
    }
    if (this.error) throw this.error
    const bytes = this.muxer.finish()
    // `as BlobPart` — the Uint8Array is backed by a plain ArrayBuffer here, and
    // the lib.dom typings for BlobPart are narrower than the runtime.
    return new Blob([bytes as unknown as BlobPart], { type: this.mimeType })
  }

  dispose() {
    try {
      if (this.encoder && this.encoder.state !== "closed") this.encoder.close()
    } catch {
      /* closing an already-errored encoder throws; nothing to do about it */
    }
    this.encoder = null
  }
}

/* ------------------------------------------------------------------ */
/*  WebM WITH ALPHA via WebCodecs                                     */
/* ------------------------------------------------------------------ */

/**
 * Whether this browser can write a transparent WebM, asked rather than
 * assumed: it needs `VideoFrame` built from an I420 buffer and a VP9 or VP8
 * `VideoEncoder` at this size. `alpha: "keep"` is deliberately NOT asked for,
 * because the alpha is a second opaque encode (see `./webm-alpha`).
 */
export interface WebmAlphaChoice extends WebmCodecChoice {
  /**
   * The alpha stream is coded LOSSLESSLY (VP9, `bitrateMode: "quantizer"`,
   * quantizer 0). Measured in this repo's Chromium 141: at the colour stream's
   * bitrate the alpha of a mostly empty keyframe came back with 1261 pixels at
   * alpha 1 to 3 spread from the frame's top-left corner, far from any ink (VP9
   * intra prediction at the frame edge, quantised coarsely), a faint veil over
   * whatever the film is laid on. Quantizer 0 decodes exactly and was SMALLER
   * on the probe (198 bytes against 265). VP8 has no per-frame quantizer, so a
   * VP8 film keeps a bitrate-coded alpha and the export says so.
   */
  alphaLossless: boolean
}

export async function pickWebmAlphaCodec(width: number, height: number, fps: number): Promise<WebmAlphaChoice | null> {
  if (typeof (globalThis as { VideoFrame?: unknown }).VideoFrame !== "function") return null
  const choice = await pickWebmCodec(width, height, fps)
  if (!choice) return null
  let alphaLossless = false
  if (choice.webmCodec === "V_VP9") {
    try {
      const res = await VideoEncoder.isConfigSupported({ codec: choice.codec, width, height, framerate: fps, bitrateMode: "quantizer" })
      alphaLossless = !!res.supported
    } catch {
      alphaLossless = false
    }
  }
  return { ...choice, alphaLossless }
}

interface HalfFrame {
  data: Uint8Array
  key: boolean
}

/**
 * TWO ENCODERS, ONE TRACK. The colour frame goes to one `VideoEncoder`, the
 * alpha frame (luma = alpha) to another with the same configuration, and the
 * two chunks of each timestamp are paired into one Block: colour in the Block,
 * alpha in its `BlockAdditional`.
 *
 * A Block is marked a keyframe only when BOTH halves are keyframes. Keyframes
 * are requested on the same frames for both, but libvpx may add one of its own
 * to one stream; a Block whose alpha still depends on the previous frame is not
 * a place a player can start, so it is written as an ordinary frame and the
 * Cues never point at it.
 */
export class WebCodecsWebmAlphaEncoder implements AnimationEncoder {
  readonly id = "webm" as const
  readonly mimeType = "video/webm"
  readonly extension = "webm"
  readonly alpha = true

  private colorEnc: VideoEncoder | null = null
  private alphaEnc: VideoEncoder | null = null
  private muxer: WebmMuxer
  private reader: PixelReader
  private halves = new Map<number, { color?: HalfFrame; alpha?: HalfFrame; durationUs: number }>()
  private error: Error | null = null

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly fps: number,
    private readonly choice: WebmAlphaChoice,
    private readonly keyFrameInterval = 30,
  ) {
    this.muxer = new WebmMuxer({ width, height, codec: choice.webmCodec, fps, alpha: true })
    this.reader = new PixelReader(width, height)
  }

  private make(which: "color" | "alpha") {
    const enc = new VideoEncoder({
      output: (chunk) => {
        const data = new Uint8Array(chunk.byteLength)
        chunk.copyTo(data)
        const slot = this.halves.get(chunk.timestamp) ?? { durationUs: chunk.duration ?? Math.round(1e6 / this.fps) }
        slot[which] = { data, key: chunk.type === "key" }
        this.halves.set(chunk.timestamp, slot)
      },
      error: (e) => {
        this.error = e instanceof Error ? e : new Error(String(e))
      },
    })
    enc.configure(
      which === "alpha" && this.choice.alphaLossless
        ? { codec: this.choice.codec, width: this.width, height: this.height, framerate: this.fps, bitrateMode: "quantizer" }
        : {
            codec: this.choice.codec,
            width: this.width,
            height: this.height,
            bitrate: bitrateFor(this.width, this.height, this.fps),
            framerate: this.fps,
            latencyMode: "quality",
          },
    )
    return enc
  }

  async addFrame(frame: EncoderFrame): Promise<void> {
    if (this.error) throw this.error
    this.colorEnc ??= this.make("color")
    this.alphaEnc ??= this.make("alpha")
    const rgba = await this.reader.read(frame.source)
    const pair = rgbaToI420Pair(rgba, this.width, this.height)
    const init = {
      format: "I420" as const,
      codedWidth: this.width,
      codedHeight: this.height,
      timestamp: frame.timestampUs,
      duration: frame.durationUs,
    }
    const cf = new VideoFrame(pair.color, { ...init, colorSpace: WEBM_ALPHA_COLOR_SPACE })
    const af = new VideoFrame(pair.alpha, { ...init, colorSpace: { ...WEBM_ALPHA_COLOR_SPACE, fullRange: true } })
    const keyFrame = frame.index % this.keyFrameInterval === 0
    try {
      this.colorEnc.encode(cf, { keyFrame })
      /* `vp9.quantizer` is in the WebCodecs VP9 registration and in Chrome, not
       * yet in TypeScript's DOM typings. */
      this.alphaEnc.encode(af, (this.choice.alphaLossless ? { keyFrame, vp9: { quantizer: 0 } } : { keyFrame }) as VideoEncoderEncodeOptions)
    } finally {
      cf.close()
      af.close()
    }
    for (const enc of [this.colorEnc, this.alphaEnc]) {
      if (enc.encodeQueueSize > 8) {
        await new Promise<void>((r) => {
          const tick = () => (enc.encodeQueueSize <= 4 ? r() : setTimeout(tick, 4))
          tick()
        })
      }
    }
  }

  async finish(): Promise<Blob> {
    if (this.error) throw this.error
    for (const enc of [this.colorEnc, this.alphaEnc]) {
      if (enc) {
        await enc.flush()
        enc.close()
      }
    }
    this.colorEnc = null
    this.alphaEnc = null
    if (this.error) throw this.error
    const times = [...this.halves.keys()].sort((a, b) => a - b)
    for (const t of times) {
      const h = this.halves.get(t)!
      if (!h.color || !h.alpha) {
        throw new Error(`export: the ${h.color ? "alpha" : "colour"} stream lost the frame at ${(t / 1000).toFixed(1)} ms`)
      }
      this.muxer.addFrame({
        data: h.color.data,
        additional: h.alpha.data,
        keyFrame: h.color.key && h.alpha.key,
        timestampUs: t,
        durationUs: h.durationUs,
      })
    }
    this.halves.clear()
    const bytes = this.muxer.finish()
    return new Blob([bytes as unknown as BlobPart], { type: this.mimeType })
  }

  dispose() {
    for (const enc of [this.colorEnc, this.alphaEnc]) {
      try {
        if (enc && enc.state !== "closed") enc.close()
      } catch {
        /* closing an already-errored encoder throws; nothing to do about it */
      }
    }
    this.colorEnc = null
    this.alphaEnc = null
    this.reader.dispose()
    this.halves.clear()
  }
}

/* ------------------------------------------------------------------ */
/*  APNG                                                              */
/* ------------------------------------------------------------------ */

export class ApngEncoder implements AnimationEncoder {
  readonly id = "apng" as const
  readonly mimeType = "image/apng"
  readonly extension = "png"

  private writer: ApngWriter
  private scratch: HTMLCanvasElement | OffscreenCanvas | null = null
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly frameIntervalMs: number,
    loops = 0,
  ) {
    this.writer = new ApngWriter({ width, height, loops })
  }

  private ensureCtx() {
    if (this.ctx) return this.ctx
    if (typeof OffscreenCanvas !== "undefined") {
      const c = new OffscreenCanvas(this.width, this.height)
      this.scratch = c
      this.ctx = c.getContext("2d", { willReadFrequently: true })
    } else {
      const c = document.createElement("canvas")
      c.width = this.width
      c.height = this.height
      this.scratch = c
      this.ctx = c.getContext("2d", { willReadFrequently: true })
    }
    if (!this.ctx) throw new Error("apng: no 2d context")
    return this.ctx
  }

  async addFrame(frame: EncoderFrame): Promise<void> {
    const ctx = this.ensureCtx()
    const paintable = await toPaintable(frame.source)
    /* CLEARED, NOT PAINTED OVER. The scratch canvas is reused, and a
     * transparent mark drawn over the previous frame would accumulate — the
     * same trailing smear the APNG blend mode is set to SOURCE to avoid. */
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.drawImage(paintable as CanvasImageSource, 0, 0, this.width, this.height)
    releasePaintable(paintable, frame.source)
    const img = ctx.getImageData(0, 0, this.width, this.height)
    await this.writer.addFrame({
      rgba: new Uint8Array(img.data.buffer, img.data.byteOffset, img.data.byteLength),
      delayMs: frame.durationUs > 0 ? frame.durationUs / 1000 : this.frameIntervalMs,
    })
  }

  async finish(): Promise<Blob> {
    const bytes = this.writer.finish()
    return new Blob([bytes as unknown as BlobPart], { type: this.mimeType })
  }

  dispose() {
    this.scratch = null
    this.ctx = null
  }
}

/* ------------------------------------------------------------------ */
/*  GIF                                                               */
/* ------------------------------------------------------------------ */

/**
 * The browser half of `./gif`. Frames must already be OPAQUE on `ground`: the
 * recorder composites the paper in before anything reaches an encoder, and the
 * palette reserves that exact paper.
 *
 * ONE FRAME BEHIND ON PURPOSE. A GIF frame's delay is the gap to the NEXT
 * frame, and `gifDelaysCs` cuts it from the next frame's own timestamp so the
 * rounding never accumulates. So each frame is written when its successor
 * arrives, and the last one in `finish` from its own duration.
 */
export class GifEncoder implements AnimationEncoder {
  readonly id = "gif" as const
  readonly mimeType = "image/gif"
  readonly extension = "gif"
  readonly samplesWanted: number

  private reader: PixelReader
  private samples: Uint8Array[] = []
  private palette: InkPalette | null = null
  private mapper: PaletteMapper | null = null
  private writer: GifWriter | null = null
  private held: { indices: Uint8Array; timestampUs: number; durationUs: number } | null = null

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly ground: readonly [number, number, number] | null,
    samplesWanted = 12,
    private readonly loops = 0,
  ) {
    this.reader = new PixelReader(width, height)
    this.samplesWanted = Math.max(1, samplesWanted)
  }

  async sample(source: FrameSource): Promise<void> {
    this.samples.push(await this.reader.read(source))
  }

  /** The palette the file was written with; null before the first frame. */
  get inkPalette(): InkPalette | null {
    return this.palette
  }

  private ensureWriter() {
    if (this.writer) return this.writer
    this.palette = buildInkPalette(this.samples, { ground: this.ground })
    this.samples = []
    this.mapper = new PaletteMapper(this.palette)
    this.writer = new GifWriter({ width: this.width, height: this.height, palette: this.palette, loops: this.loops })
    return this.writer
  }

  async addFrame(frame: EncoderFrame): Promise<void> {
    const writer = this.ensureWriter()
    const rgba = await this.reader.read(frame.source)
    const indices = this.mapper!.mapFrame(rgba)
    if (this.held) {
      const [delay] = gifDelaysCs([this.held.timestampUs], frame.timestampUs)
      writer.addFrame({ indices: this.held.indices, delayCs: delay })
    }
    this.held = { indices, timestampUs: frame.timestampUs, durationUs: frame.durationUs }
  }

  async finish(): Promise<Blob> {
    const writer = this.ensureWriter()
    if (this.held) {
      const [delay] = gifDelaysCs([this.held.timestampUs], this.held.timestampUs + this.held.durationUs)
      writer.addFrame({ indices: this.held.indices, delayCs: delay })
      this.held = null
    }
    const bytes = writer.finish()
    return new Blob([bytes as unknown as BlobPart], { type: this.mimeType })
  }

  dispose() {
    this.reader.dispose()
    this.samples = []
    this.held = null
  }
}
