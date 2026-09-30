/**
 * ANIMATED EXPORT — the public entry.
 *
 * PRD §12 lists this as v4, "animated preview export — video-first", and it is
 * the gap a buyer notices first: the app's entire subject is a mark that
 * ANIMATES, and until now the only things you could take away were a still PNG
 * and a GLB that carries no style at all. The precedent for why that matters is
 * not a guess — Procreate's own handbook page for Time-lapse leads with
 * *"Record your artistic process to a Time-lapse video, and share it with the
 * world"*, and the recording toggle in its screenshot is ON by default
 * (`docs/refs-competitive/ref-01-procreate-timelapse.png`). The recorded
 * process IS the shareable artefact.
 *
 * ── HOW TO USE IT ─────────────────────────────────────────────────────────
 *     const res = await exportAnimation({
 *       host,                       // see ExportHost in ./recorder
 *       penDurationMs,              // __revealHarness.getTotalDuration()
 *       timebase: "pen",            // or "fixed" + fixedDurationMs
 *       fps: 30, scale: 2, transparent: false,
 *       format: "auto",             // webm where WebCodecs exists, else apng
 *     })
 *     // res.blob, res.filename, res.warnings
 *
 * Nothing in `lib/export/` imports React, three, or any app module.
 *
 * ⚠ THE SENTENCE THAT USED TO FOLLOW THAT ONE — *"and nothing in the app
 * imports it yet… the host wires it when the host's lane is free"* — WAS STALE
 * AND IS CORRECTED RATHER THAN DELETED, because it is the reason the module
 * spent a pass unaware of the app. It IS wired: `components/viewport-3d.tsx`
 * imports `exportAnimation` at its :227 and calls it at its :11453, behind the
 * export bar's Video button and the "Video Preview Export" view preset. A
 * header that describes a pre-wiring world is how a module stops being read as
 * live code, and this one had already drifted past two features of the reveal
 * it exists to film (`docs/explainers/38-*`).
 *
 * The independence is still real and still load-bearing —
 * `assert-export-live.mjs` serves these six files to a page as standalone ES
 * modules with nothing but relative specifiers rewritten, so an `@/lib/...`
 * import here breaks that gate outright. Facts about the app that this module
 * needs therefore arrive as PARAMETERS (`revealEnds`) or as gated copies
 * (`EXPORT_PAPER`, `REVEAL_WINDOW_ENDS`), never as imports.
 */
import { planFrames, describePlan, type ExportTimebase, type FramePlan, type RevealEnds } from "./frame-plan"
import {
  ApngEncoder,
  GifEncoder,
  WebCodecsWebmAlphaEncoder,
  WebCodecsWebmEncoder,
  pickWebmAlphaCodec,
  pickWebmCodec,
  type AnimationEncoder,
} from "./encoders"
import { GIF_MAX_FPS, parseHexColor } from "./gif"
import { recordAnimation, exportFilename, type ExportHost, type RecordResult } from "./recorder"

export * from "./frame-plan"
export * from "./webm"
export * from "./apng"
export * from "./encoders"
export * from "./recorder"
export * from "./gif"
export * from "./webm-alpha"

/**
 * `webm-alpha` is a transparent WebM (VP9 or VP8 with an alpha stream) where
 * the browser can encode one, and an animated PNG with a warning saying so
 * where it cannot. It always implies `transparent`.
 */
export type ExportFormat = "webm" | "webm-alpha" | "apng" | "gif" | "auto"

/**
 * The studio ground an opaque export is composited onto.
 *
 * ⚠ THIS IS A COPY OF `STILL_PAPER` IN `components/viewport-3d.tsx`, and a
 * copied constant is exactly the failure this repo has caught twice (a pasted
 * `motion.mjs` constants block, found stale two days running). `lib/` may not
 * import a component, so the copy cannot be avoided — but it CAN be gated:
 * `scripts/verify/assert-export-plan.mjs` reads the literal out of that file
 * and fails if the two ever disagree.
 */
export const EXPORT_PAPER = "#fafafa"

export interface ExportAnimationOptions {
  host: ExportHost
  /** The strokes' own recorded duration in ms. */
  penDurationMs: number
  timebase: ExportTimebase
  fixedDurationMs?: number
  fps?: number
  /** Device pixels per CSS pixel, as the still export's scale picker. */
  scale?: number
  transparent?: boolean
  format?: ExportFormat
  speed?: number
  leadInMs?: number
  holdMs?: number
  /**
   * What the reveal SHOWS at clock 0 and clock 1 — see `frame-plan.ts` §W.
   * `revealEndsFor(revealWindow.mode)` is the one-liner a host wants; the app's
   * live mode is `__revealHarness.window().mode`. Omitted = `grow`, which is
   * what shipped, so an unwired caller gets exactly the previous behaviour.
   */
  revealEnds?: RevealEnds
  /**
   * How a `webm-alpha` film codes its alpha stream. `lossless` (the default) is
   * VP9 quantizer 0 where the browser offers it; `bitrate` is the parked prior,
   * the alpha coded at the colour stream's bitrate, kept so a gate can show the
   * veil it leaves (`assert-export-webm-alpha-app.mjs`).
   */
  alphaCoding?: "lossless" | "bitrate"
  /** Keep a hold that would be blank paper. See `FramePlanInput.holdOnEmpty`. */
  holdOnEmpty?: boolean
  reverse?: boolean
  maxFrames?: number
  /** The user's export name, for the filename. */
  markName?: string
  hasAnimatedStyleLayer?: boolean
  /**
   * Ground for a format with no alpha. Defaults to `EXPORT_PAPER`; pass `null`
   * only if the frames the host hands back are ALREADY opaque.
   */
  background?: string | null
  onProgress?: (done: number, total: number) => void
  signal?: AbortSignal
}

export interface ExportAnimationResult extends RecordResult {
  filename: string
  plan: FramePlan
  /** One sentence for a toast: what the file actually is. */
  summary: string
}

/**
 * TRANSPARENT MEANS APNG, UNLESS `webm-alpha` IS ASKED FOR BY NAME. VP9's
 * alpha rides a Matroska `BlockAdditions` side channel, which the muxer now
 * writes (`./webm`, `./webm-alpha`) when, and only when, the alpha encoder
 * feeds it; a plain `webm` request with `transparent` still gets APNG, because
 * a WebM whose alpha was never encoded would be an opaque file with a promise
 * on the label. The one thing an export may never be is a lie about what it
 * contains.
 */
function resolveFormat(requested: ExportFormat, transparent: boolean): ExportFormat {
  /* A GIF stays a GIF when alpha is asked for, on paper, and says so below:
   * its one-bit transparency would cut a fringe round every soft ink edge. */
  if (requested === "gif") return "gif"
  if (requested === "webm-alpha") return "webm-alpha"
  if (transparent) return "apng"
  return requested
}

export async function exportAnimation(opts: ExportAnimationOptions): Promise<ExportAnimationResult> {
  const requestedFps = opts.fps ?? 30
  const scale = opts.scale ?? 2
  const wanted = resolveFormat(opts.format ?? "auto", !!opts.transparent)
  /* A GIF is always opaque; see `resolveFormat`. The renderer is asked for the
   * paper frame, exactly the frame a WebM gets. */
  const transparent = wanted === "gif" ? false : wanted === "webm-alpha" ? true : !!opts.transparent
  /* GIF delays are centiseconds and browsers play anything under 2 cs as 10 cs,
   * so a 60 fps GIF would play at a sixth of its speed. The plan is made at the
   * ceiling instead, and the file's frame count is that plan's. */
  const fps = wanted === "gif" ? Math.min(requestedFps, GIF_MAX_FPS) : requestedFps

  const plan = planFrames({
    penDurationMs: opts.penDurationMs,
    fps,
    timebase: opts.timebase,
    fixedDurationMs: opts.fixedDurationMs,
    speed: opts.speed,
    leadInMs: opts.leadInMs,
    holdMs: opts.holdMs,
    revealEnds: opts.revealEnds,
    holdOnEmpty: opts.holdOnEmpty,
    reverse: opts.reverse,
    maxFrames: opts.maxFrames,
  })

  /* THE SIZE HAS TO BE KNOWN BEFORE THE ENCODER IS CONFIGURED, and the only
   * honest source for it is the renderer. So one probe frame is taken at the
   * real scale, at the reveal's first instant, and thrown away. */
  const probe = await opts.host.grabFrame({ scale, transparent })
  if (!probe) throw new Error("export: the renderer produced no frame. Is anything drawn?")
  const width = probe.width - (probe.width % 2)
  const height = probe.height - (probe.height % 2)
  if (probe.kind === "bitmap") probe.bitmap.close()

  let encoder: AnimationEncoder
  let fellBack = false
  let alphaFellBack = false
  let alphaLossy = false
  const gifGround = opts.background ?? EXPORT_PAPER
  if (wanted === "gif") {
    encoder = new GifEncoder(width, height, parseHexColor(gifGround))
  } else if (wanted === "webm-alpha") {
    const picked = await pickWebmAlphaCodec(width, height, fps)
    const choice = picked && opts.alphaCoding === "bitrate" ? { ...picked, alphaLossless: false } : picked
    if (choice) {
      encoder = new WebCodecsWebmAlphaEncoder(width, height, fps, choice)
      alphaLossy = !choice.alphaLossless
    } else {
      encoder = new ApngEncoder(width, height, 1000 / fps)
      alphaFellBack = true
    }
  } else if (wanted === "apng") {
    encoder = new ApngEncoder(width, height, 1000 / fps)
  } else {
    const choice = await pickWebmCodec(width, height, fps)
    if (choice) {
      encoder = new WebCodecsWebmEncoder(width, height, fps, choice)
    } else if (wanted === "auto") {
      encoder = new ApngEncoder(width, height, 1000 / fps)
      fellBack = true
    } else {
      throw new Error("export: this browser has no WebCodecs video encoder for VP9 or VP8")
    }
  }

  /* AN OPAQUE CONTAINER GETS AN EXPLICIT GROUND. `transparent` asks the
   * renderer to leave the paper out; only APNG can actually carry that, so a
   * video export composites the same paper back in rather than handing the
   * codec an alpha channel it will silently resolve to black. */
  const background =
    encoder.id === "gif"
      ? gifGround
      : wanted === "webm-alpha"
        ? null
        : opts.background !== undefined
        ? opts.background
        : encoder.id === "apng" && transparent
          ? null
          : EXPORT_PAPER

  const res = await recordAnimation({
    plan,
    host: opts.host,
    encoder,
    background,
    grab: { scale, transparent },
    onProgress: opts.onProgress,
    signal: opts.signal,
    hasAnimatedStyleLayer: opts.hasAnimatedStyleLayer,
  })

  if (alphaFellBack) {
    res.warnings.unshift(
      "This browser cannot encode WebM video, so the transparent export is an animated PNG instead. It keeps the same see-through ground.",
    )
  }
  if (alphaLossy && opts.alphaCoding !== "bitrate") {
    res.warnings.unshift(
      "This browser writes the transparent WebM as VP8, whose alpha is compressed like the picture, so the see-through ground may carry a faint grain. Pick APNG for exact alpha.",
    )
  }
  if (wanted === "gif" && opts.transparent) {
    res.warnings.unshift("A GIF has no soft transparency, so this one is on the paper ground. Pick Animated PNG to keep alpha.")
  }
  if (fps !== requestedFps) {
    res.warnings.unshift(`GIF plays at ${fps} fps at most (its frame delays are whole hundredths of a second), so this one is ${fps} fps, not ${requestedFps}.`)
  }
  if (fellBack) {
    res.warnings.unshift("This browser has no WebCodecs video encoder, so the export is an animated PNG instead of a video.")
  }

  const filename = exportFilename(opts.markName ?? "free-stroke", encoder.extension)
  return {
    ...res,
    filename,
    plan,
    summary: `${filename} · ${describePlan(plan)} · ${res.width}×${res.height}${transparent ? " · transparent" : ""}`,
  }
}
