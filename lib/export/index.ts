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
 * `assert-export-live.mjs` serves these files to a page as standalone ES
 * modules with nothing but relative specifiers rewritten, so an `@/lib/...`
 * import here breaks that gate outright. Facts about the app that this module
 * needs therefore arrive as PARAMETERS (`revealEnds`) or as gated copies
 * (`EXPORT_PAPER`, `REVEAL_WINDOW_ENDS`), never as imports.
 */
import { planFrames, describePlan, type ExportTimebase, type FramePlan, type RevealEnds } from "./frame-plan"
import { ApngEncoder, GifEncoder, WebCodecsWebmEncoder, pickWebmCodec, type AnimationEncoder } from "./encoders"
import { GIF_MAX_FPS } from "./gif"
import { recordAnimation, exportFilename, type ExportHost, type RecordResult } from "./recorder"

export * from "./frame-plan"
export * from "./webm"
export * from "./apng"
export * from "./gif"
export * from "./encoders"
export * from "./recorder"

export type ExportFormat = "webm" | "apng" | "gif" | "auto"

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
 * TRANSPARENT MEANS APNG. Not a preference — VP9's alpha rides a Matroska
 * `BlockAdditions` side channel this muxer does not write, so a "transparent
 * WebM" from here would be an opaque file with a promise on the label. The
 * one thing an export may never be is a lie about what it contains.
 */
function resolveFormat(requested: ExportFormat, transparent: boolean): ExportFormat {
  /* GIF CARRIES ITS OWN TRANSPARENCY (one index, on or off), so it is the one
   * format a transparent request does not move. */
  if (requested === "gif") return "gif"
  if (transparent) return "apng"
  return requested
}

export async function exportAnimation(opts: ExportAnimationOptions): Promise<ExportAnimationResult> {
  const scale = opts.scale ?? 2
  const transparent = !!opts.transparent
  const wanted = resolveFormat(opts.format ?? "auto", transparent)
  /* A GIF DELAY IS WHOLE CENTISECONDS AND BROWSERS PLAY ANYTHING UNDER 2 AS 10,
   * so a 60 fps GIF would play at about a fifth of its speed. The plan is made
   * at GIF's ceiling instead, and the result says so. */
  const fpsAsked = opts.fps ?? 30
  const fps = wanted === "gif" ? Math.min(fpsAsked, GIF_MAX_FPS) : fpsAsked

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
  if (wanted === "gif") {
    encoder = new GifEncoder(width, height, 1000 / fps, {
      transparent,
      reserve: transparent ? [] : [opts.background ?? EXPORT_PAPER],
    })
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
    opts.background !== undefined
      ? opts.background
      : (encoder.id === "apng" || encoder.id === "gif") && transparent
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

  if (fps !== fpsAsked) {
    res.warnings.unshift(`GIF plays at ${fps} fps at most, so the GIF was made at ${fps} fps instead of ${fpsAsked}.`)
  }
  if (encoder instanceof GifEncoder && encoder.clampedDelays > 0) {
    res.warnings.push(`${encoder.clampedDelays} GIF frames were held for the 2 cs minimum a browser will play.`)
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
