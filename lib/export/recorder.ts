/**
 * THE RECORDER — walk the plan, ask the renderer for each instant, encode.
 *
 * The whole loop is four lines long on purpose:
 *
 *     for (const f of plan.frames) {
 *       host.seek(easePlayhead(f.clock))       // put the scene at that instant
 *       host.setSceneTimeMs?.(f.timeMs)        // and its style clock too
 *       const src = await host.grabFrame(...)  // render + read back
 *       await encoder.addFrame(...)            // encode with the PLAN's time
 *     }
 *
 * The important word is `await`. Nothing here is on a rAF, nothing measures
 * wall-clock, and a frame that takes 400 ms to render still occupies exactly
 * `1000/fps` ms of the output. That is the entire difference between this and
 * a screen recording, and it is why the export can honour the pen's own
 * recorded timing instead of the machine's.
 *
 * ── THE ONE THING THE HOST MUST PROVIDE AND CURRENTLY CANNOT ──────────────
 * `setSceneTimeMs`. The reveal is already deterministic — `__revealHarness`
 * exposes `setProgress`, and the geometry reads `playheadRef` directly. The
 * STYLE clock is not: `advanceStyleClock(clock, delta, …)` is called from the
 * R3F frame loop with the real frame delta (`components/viewport-3d.tsx`), so
 * texture drift, dither crawl, glyph scroll and the completion pulse all run on
 * wall time. Export without a deterministic style clock and the mark's geometry
 * is frame-exact while its SURFACE runs at whatever rate the encoder happened
 * to allow — which on a slow machine is a different film every time.
 *
 * This module refuses to paper over that: if any time-varying layer is on and
 * the host cannot step the style clock, the result carries a WARNING naming it.
 * The exact host-side change is specced in `docs/research/`.
 */
import type { FramePlan } from "./frame-plan"
import type { AnimationEncoder, FrameSource } from "./encoders"

/** `n` frame indices spread over `total`, always holding the first and last. */
export function sampleIndices(total: number, n: number): number[] {
  if (total <= 0) return []
  const k = Math.max(1, Math.min(total, Math.floor(n)))
  if (k === 1) return [total - 1]
  const out = new Set<number>()
  for (let j = 0; j < k; j++) out.add(Math.round((j * (total - 1)) / (k - 1)))
  return [...out].sort((a, b) => a - b)
}

export interface GrabOptions {
  /** Device pixels per CSS pixel, as the still export's `scale`. */
  scale: number
  /** Leave the ground out. */
  transparent: boolean
}

export interface ExportHost {
  /** Put the draw-in reveal at an exact playhead, 0..1. */
  seek(playhead: number): void | Promise<void>
  /**
   * Turn the plan's LINEAR clock into a playhead using the APP's easing.
   * Omitted = linear, which is the app's `linear` reveal ease.
   * Never re-implement the curve here — see the note in `frame-plan.ts`.
   */
  easePlayhead?(clock: number): number
  /** Put every non-reveal clock at an exact scene time. See the note above. */
  setSceneTimeMs?(ms: number): void
  /** Render one frame at the requested scale and read it back. */
  grabFrame(opts: GrabOptions): Promise<FrameSource | null>
  /** Optional: resolve once the renderer has presented the state just set. */
  settle?(): Promise<void>
}

export interface RecordOptions {
  plan: FramePlan
  host: ExportHost
  encoder: AnimationEncoder
  grab: GrabOptions
  /**
   * A CSS colour to composite every frame onto, or `null` to keep alpha.
   *
   * ⚠ NOT COSMETIC, AND IT WAS FOUND BY LOOKING AT THE OUTPUT. The first
   * exported WebM from this module decoded cleanly, had the right frame count
   * and the right duration — and the mark was nearly invisible, because a
   * video codec has no alpha channel and a transparent canvas composites onto
   * BLACK. A dark ink stroke on black is a black rectangle with a faint edge.
   * Every numeric row passed. The contact sheet is what caught it.
   *
   * So the recorder never trusts that the frames it is handed already match the
   * container it is writing: an opaque format gets an explicit ground.
   */
  background?: string | null
  /** 0..1, called after every frame. */
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
  /** True when a time-varying style layer is enabled — drives the warning. */
  hasAnimatedStyleLayer?: boolean
}

export interface RecordResult {
  blob: Blob
  width: number
  height: number
  frames: number
  durationMs: number
  encoderId: AnimationEncoder["id"]
  /** Things the user should be told, not things the code hid. */
  warnings: string[]
}

/** Even dimensions, because VP9/VP8 encoders reject odd ones on many builds. */
function evenDown(n: number) {
  return n - (n % 2)
}

export async function recordAnimation(opts: RecordOptions): Promise<RecordResult> {
  const { plan, host, encoder, grab, onProgress, signal } = opts
  if (plan.frames.length === 0) throw new Error("export: the plan has no frames")

  const warnings: string[] = []
  if (plan.truncated) {
    warnings.push(
      `Export truncated to ${plan.frames.length} frames of ${plan.requestedFrames}. The drawing is longer than the frame ceiling.`,
    )
  }
  if (opts.hasAnimatedStyleLayer && !host.setSceneTimeMs) {
    warnings.push(
      "Animated style layers were captured on wall-clock time, not on the export clock. Their speed in the file will not exactly match the preview.",
    )
  }
  /* ── §W · THE HOLD THAT WAS NOT WRITTEN, SAID OUT LOUD ───────────────────
   * A user who set a 0.6 s hold and gets a file without one has been quietly
   * overruled unless somebody tells them, and "the export silently dropped
   * something you asked for" is the exact class of failure this module's
   * `truncated` warning already exists for.
   *
   * 🔴 THE LAST SENTENCE USED TO READ *'Turn on "hold on empty" to keep it.'*
   * AND THAT CONTROL DOES NOT EXIST. `holdOnEmpty` is an input on
   * `exportAnimation`; it has ZERO references in `components/`, so there is no
   * pill, no dial and nothing for a reader of this toast to turn on. Measured
   * 2026-08-28, and it reached a real user's screen: `assert-export-window.mjs`
   * §D read the sentence verbatim out of the success toast the first time the
   * call site made the plan suppress anything.
   *
   * The rule it broke is DISPATCH §2.7 — *"names must match behaviour"* — and
   * the reason it was written is the sentence that used to close this comment:
   * *"a warning that does not say what to do instead is just an apology."* That
   * is true, and it is not a licence to invent the instruction. The lever the
   * user actually holds is the reveal itself: the hold survives on any reveal
   * whose end is the finished mark. `holdOnEmpty` stays the caller's override
   * and is documented where a caller reads, in `FramePlanInput`.
   *
   * WHETHER THE PANEL SHOULD GROW A PILL IS SEBS'S CALL and is on the queue. It
   * is deliberately not built here and not hinted at here. */
  if (plan.holdSuppressed) {
    warnings.push(
      `The ${(plan.holdMsRequested / 1000).toFixed(2)}s hold was dropped: this reveal ends on an empty page, so the hold would have been ${Math.round(plan.holdMsRequested / plan.frameIntervalMs)} frames of blank paper. A reveal that ends on the finished mark keeps it.`,
    )
  }
  if (plan.leadShows === "full" && plan.leadInMs > 0) {
    warnings.push(
      "This reveal starts with the whole mark already on the page, so the lead-in holds the finished mark rather than an empty page.",
    )
  }

  const ease = host.easePlayhead ?? ((c: number) => c)
  const frameIntervalUs = Math.round((1e6 / plan.fps) * 1000) / 1000

  let width = 0
  let height = 0
  let crop: { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D } | null = null

  /* THE ODD-PIXEL CROP AND THE GROUND, in one pass over one scratch canvas.
   * Done here rather than inside an encoder so every encoder sees identical
   * pixels. An APNG one pixel wider than its WebM sibling is the kind of
   * difference nobody notices until two exports of the same mark refuse to
   * line up. The sampling pass below goes through the same function, so a GIF
   * palette is built from exactly the pixels the GIF then encodes. */
  const normalize = async (src: FrameSource): Promise<FrameSource> => {
    const bg = opts.background ?? null
    if (bg === null && src.width === width && src.height === height) return src
    if (!crop) {
      const c =
        typeof OffscreenCanvas !== "undefined"
          ? new OffscreenCanvas(width, height)
          : Object.assign(document.createElement("canvas"), { width, height })
      const ctx = (c as HTMLCanvasElement | OffscreenCanvas).getContext("2d") as
        | CanvasRenderingContext2D
        | OffscreenCanvasRenderingContext2D
        | null
      if (!ctx) throw new Error("export: no 2d context for the size fix")
      crop = { canvas: c as HTMLCanvasElement | OffscreenCanvas, ctx }
    }
    const paintable =
      src.kind === "blob" ? await createImageBitmap(src.blob) : src.kind === "bitmap" ? src.bitmap : src.canvas
    crop.ctx.clearRect(0, 0, width, height)
    if (bg !== null) {
      crop.ctx.fillStyle = bg
      crop.ctx.fillRect(0, 0, width, height)
    }
    crop.ctx.drawImage(paintable as CanvasImageSource, 0, 0)
    if (src.kind === "blob" && "close" in paintable) (paintable as ImageBitmap).close()
    return { kind: "canvas", canvas: crop.canvas, width, height }
  }

  const renderAt = async (i: number): Promise<FrameSource> => {
    const f = plan.frames[i]
    await host.seek(ease(f.clock))
    host.setSceneTimeMs?.(f.timeMs)
    if (host.settle) await host.settle()
    const src = await host.grabFrame(grab)
    if (!src) throw new Error(`export: the renderer returned no frame at index ${i}`)
    if (width === 0) {
      width = evenDown(src.width)
      height = evenDown(src.height)
      if (width < 2 || height < 2) throw new Error(`export: frame is ${src.width}x${src.height}`)
      if (width !== src.width || height !== src.height) {
        warnings.push(`Output trimmed to ${width}×${height}. Video codecs need even dimensions.`)
      }
    }
    return src
  }

  try {
    /* ── THE SAMPLING PASS, only for an encoder that asks for one ─────────
     * A GIF's palette has to exist before its first frame and has to fit the
     * whole film, so the frames it is built from are rendered first: the
     * first and the last planned instant always, the rest spread evenly
     * between. Each is rendered through the same seek, clock and grab as the
     * frame it stands for, then rendered AGAIN in the main loop; the scene is
     * deterministic, so the second render is the same picture. */
    if (encoder.sample && encoder.samplesWanted) {
      for (const i of sampleIndices(plan.frames.length, encoder.samplesWanted)) {
        if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError")
        await encoder.sample(await normalize(await renderAt(i)))
      }
    }

    for (let i = 0; i < plan.frames.length; i++) {
      if (signal?.aborted) throw new DOMException("Export cancelled", "AbortError")
      const f = plan.frames[i]
      const source = await normalize(await renderAt(i))

      await encoder.addFrame({
        source,
        index: i,
        timestampUs: Math.round(f.timeMs * 1000),
        durationUs: Math.round(frameIntervalUs),
      })
      onProgress?.(i + 1, plan.frames.length)
    }

    const blob = await encoder.finish()
    return {
      blob,
      width,
      height,
      frames: plan.frames.length,
      durationMs: plan.durationMs,
      encoderId: encoder.id,
      warnings,
    }
  } catch (e) {
    encoder.dispose()
    throw e
  }
}

/**
 * A filename someone can find again. `mark` is the user's own export name when
 * they typed one — the same field the GLB uses — so a session's files sort
 * together instead of all being called `export`.
 */
export function exportFilename(mark: string, extension: string, date = new Date()): string {
  const safe = (mark || "free-stroke").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)
  const pad = (n: number) => String(n).padStart(2, "0")
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  return `${safe || "free-stroke"}-${stamp}.${extension}`
}
