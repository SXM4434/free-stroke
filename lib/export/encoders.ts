/**
 * THE TWO ENCODERS, behind one interface the recorder can drive.
 *
 *   WebCodecsWebmEncoder   VP9/VP8 in WebM. The thing you post.
 *   ApngEncoder            Lossless RGBA with alpha. The thing you composite.
 *   GifEncoder             256 colours a frame, plays anywhere. The thing you paste.
 *
 * Both take frames as "whatever the viewport handed us" — a canvas, an
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
import { GifWriter } from "./gif"

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
 * Same scratch-canvas readback as APNG, into `GifWriter`. `reserve` is the
 * ground the recorder composites onto, so the paper keeps an exact palette
 * entry in every frame (see `gif.ts`).
 */
export class GifEncoder implements AnimationEncoder {
  readonly id = "gif" as const
  readonly mimeType = "image/gif"
  readonly extension = "gif"

  private writer: GifWriter
  private scratch: HTMLCanvasElement | OffscreenCanvas | null = null
  private ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly frameIntervalMs: number,
    opts: { transparent?: boolean; reserve?: string[]; loops?: number } = {},
  ) {
    this.writer = new GifWriter({ width, height, loops: opts.loops ?? 0, transparent: opts.transparent, reserve: opts.reserve })
  }

  /** Frames whose delay was raised to GIF's 2 cs floor. */
  get clampedDelays() {
    return this.writer.clampedDelays
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
    if (!this.ctx) throw new Error("gif: no 2d context")
    return this.ctx
  }

  async addFrame(frame: EncoderFrame): Promise<void> {
    const ctx = this.ensureCtx()
    const paintable = await toPaintable(frame.source)
    ctx.clearRect(0, 0, this.width, this.height)
    ctx.drawImage(paintable as CanvasImageSource, 0, 0, this.width, this.height)
    releasePaintable(paintable, frame.source)
    const img = ctx.getImageData(0, 0, this.width, this.height)
    this.writer.addFrame({
      rgba: img.data,
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
