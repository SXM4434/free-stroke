"use client"

/* ==================================================================
   EXPORT PANEL · L3 of the layout rethink (BUILD-PLAN.md §2, "Export";
   §5 row L3).

   The name field, PNG and its settings, Video and its settings, and GLB, cut
   out of the bar that sat at the 3D view's bottom right. The handlers, the
   in-flight flags and the plan note stay in `components/viewport-3d.tsx`,
   which renders this into the dock's Export panel (and, with no dock on the
   page, into the old bar beside Top and Reset camera).

   Docked, the settings open under the bar inside the panel instead of as a
   card above it: a card above the first row of a panel would open over the
   3D view, outside the panel that owns it.
   ================================================================== */

import type React from "react"
import type { ExportTimebase } from "@/lib/export"

export type PngScale = { value: number; label: string; note: string }

export type ExportPanelProps = {
  /** The container the popovers' outside-click test reads. */
  containerRef: React.RefObject<HTMLDivElement | null>
  docked: boolean
  exportName: string
  setExportName: (v: string) => void
  strokeCount: number
  compare3Up: boolean
  // PNG
  onExportPNG: () => void
  exportingPng: boolean
  pngScale: number
  setPngScale: (v: number) => void
  pngScales: PngScale[]
  stillPixelNote: string
  pngTransparent: boolean
  setPngTransparent: (v: boolean) => void
  pngPanelOpen: boolean
  setPngPanelOpen: (f: (v: boolean) => boolean) => void
  // Video
  onExportVideo: () => void
  /** GIF shares Video's render path, guard, cancel and settings. */
  onExportGif: () => void
  /** Which of Video and GIF started the running export. */
  animKind: "video" | "gif"
  onAbortVideo: () => void
  exportingVideo: boolean
  videoDone: number
  videoTotal: number
  videoPlanNote: string
  videoTimebase: ExportTimebase
  setVideoTimebase: (t: ExportTimebase) => void
  videoFixedSeconds: number
  setVideoFixedSeconds: (s: number) => void
  videoFps: number
  setVideoFps: (f: number) => void
  videoScale: number
  setVideoScale: (s: number) => void
  videoTransparent: boolean
  setVideoTransparent: (v: boolean) => void
  /** What Transparent is written as: WebM with a VP9 alpha stream, or APNG. */
  videoAlphaFormat: "webm" | "apng"
  setVideoAlphaFormat: (f: "webm" | "apng") => void
  videoPanelOpen: boolean
  setVideoPanelOpen: (f: (v: boolean) => boolean) => void
  hasAnimatedStyleLayer: boolean
  // GLB
  onExportGLB: () => void
  exporting: boolean
}

const seg = (on: boolean) =>
  `fs-press flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
    on ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
  }`

export function ExportPanel(p: ExportPanelProps) {
  /* Floating: the card above the bar, as it always was. Docked: a block under
     the bar, in the panel's own flow. */
  const card = p.docked
    ? "rounded-xl border border-border bg-background p-2.5"
    : "absolute bottom-[calc(100%+6px)] right-0 rounded-xl border border-border bg-background p-2.5 shadow-lg"

  return (
    <div
      ref={p.containerRef}
      data-export-panel
      className={
        p.docked
          ? "flex flex-col items-start gap-2 p-3"
          : "relative flex items-center gap-1 rounded-xl border border-border bg-background/85 p-1 shadow-sm backdrop-blur-sm"
      }
    >
      <div className={p.docked ? "flex items-center gap-1 rounded-xl border border-border bg-background p-1" : "contents"}>
      <input
        type="text"
        value={p.exportName}
        onChange={(e) => p.setExportName(e.target.value)}
        placeholder="name"
        maxLength={32}
        aria-label="Filename prefix for exports"
        className="h-[30px] w-24 rounded-lg bg-transparent px-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-foreground/20"
      />
      {/* PNG and its settings chevron are ONE control and are spaced as
          one: at the shared gap the chevron read as belonging to GLB,
          which is the button it does not configure. */}
      <div className="flex items-center">
      <button
        type="button"
        onClick={p.onExportPNG}
        /* DISABLED IN 3-UP, WITH A REASON. The grab is registered by the
           single viewport's scene only (three racing scenes would fight
           over one hook), so in compare mode the button would raise "the
           viewport is not ready", a true sentence that explains nothing.
           A disabled control with a title that names the condition is the
           honest version. */
        disabled={p.strokeCount === 0 || p.exportingPng || p.compare3Up}
        title={
          p.compare3Up
            ? "Leave 3-Up compare to save a still. An export is one view, not three"
            : `Save the viewport as a PNG at ${p.pngScale}×. The only export that carries texture, dither and ASCII.`
        }
        className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {p.exportingPng ? "Saving…" : "PNG"}
      </button>
      {/* The PNG settings live behind their own affordance instead of
          spending four permanent controls on a choice most users make
          once. Its state is visible on the button's own title and inside
          the panel, so nothing is hidden, only folded. */}
      <button
        type="button"
        onClick={() => p.setPngPanelOpen((v) => !v)}
        aria-expanded={p.pngPanelOpen}
        aria-label="PNG export settings"
        title="PNG export settings"
        className={`fs-press flex h-[30px] w-7 items-center justify-center rounded-lg transition-colors hover:bg-accent ${
          p.pngPanelOpen ? "bg-accent text-foreground" : "text-muted-foreground"
        }`}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={p.pngPanelOpen ? "M1.5 6.5L5 3l3.5 3.5" : "M1.5 3.5L5 7l3.5-3.5"} />
        </svg>
      </button>
      </div>
      <div className="mx-0.5 h-5 w-px bg-border" />
      {/* ---- THE ANIMATED EXPORT ----------------------------------
          Same two-part shape as PNG (the action and its chevron are ONE
          control) because a third pattern in a bar of three would read as
          three unrelated buttons. It sits BETWEEN the still and the GLB on
          purpose: PNG, Video, GLB is picture, moving picture, geometry,
          which is the order of how much of the app each one carries. */}
      <div className="flex items-center">
      <button
        type="button"
        onClick={p.exportingVideo && p.animKind === "video" ? p.onAbortVideo : p.onExportVideo}
        /* THE PROGRESS IS THE LABEL, AND THE LABEL IS THE CANCEL. A
           hundred-and-forty-frame render is the one export long enough to
           look hung, so the button counts frames while it works, and the
           same press stops it, because a long job with no way out is the
           defect a spinner hides rather than solves. */
        disabled={p.strokeCount === 0 || (p.compare3Up && !p.exportingVideo)}
        title={
          p.exportingVideo && p.animKind === "video"
            ? "Stop the export"
            : p.compare3Up
              ? "Leave 3-Up compare to save a film. An export is one view, not three"
              : `Save the animation as ${
                  p.videoTransparent ? (p.videoAlphaFormat === "webm" ? "a transparent WebM video" : "an animated PNG") : "a video"
                }. ${p.videoPlanNote}`
        }
        className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium tabular-nums text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {p.exportingVideo && p.animKind === "video"
          ? p.videoTotal > 0
            ? `${Math.round((p.videoDone / p.videoTotal) * 100)}%`
            : "…"
          : "Video"}
      </button>
      <button
        type="button"
        onClick={() => p.setVideoPanelOpen((v) => !v)}
        aria-expanded={p.videoPanelOpen}
        aria-label="Video export settings"
        title="Video export settings"
        className={`fs-press flex h-[30px] w-7 items-center justify-center rounded-lg transition-colors hover:bg-accent ${
          p.videoPanelOpen ? "bg-accent text-foreground" : "text-muted-foreground"
        }`}
      >
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d={p.videoPanelOpen ? "M1.5 6.5L5 3l3.5 3.5" : "M1.5 3.5L5 7l3.5-3.5"} />
        </svg>
      </button>
      </div>
      {/* GIF: THE SAME FILM IN THE CONTAINER THAT PLAYS INLINE EVERYWHERE.
          It reads the Video settings' clock, frame rate and resolution (one
          set of film settings, not two), is always on paper, and counts and
          cancels exactly as Video does. */}
      <button
        type="button"
        onClick={p.exportingVideo && p.animKind === "gif" ? p.onAbortVideo : p.onExportGif}
        disabled={p.strokeCount === 0 || (p.compare3Up && !p.exportingVideo)}
        title={
          p.exportingVideo && p.animKind === "gif"
            ? "Stop the export"
            : p.compare3Up
              ? "Leave 3-Up compare to save a GIF. An export is one view, not three"
              : `Save a GIF of the animation, on paper, 256 colours, with the Video settings. ${p.videoPlanNote}`
        }
        className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium tabular-nums text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {p.exportingVideo && p.animKind === "gif"
          ? p.videoTotal > 0
            ? `${Math.round((p.videoDone / p.videoTotal) * 100)}%`
            : "…"
          : "GIF"}
      </button>
      <div className="mx-0.5 h-5 w-px bg-border" />
      <button
        type="button"
        onClick={p.onExportGLB}
        disabled={p.strokeCount === 0 || p.exporting}
        title="Save the geometry as a glTF binary. No style layers yet, see the roadmap."
        className="fs-press rounded-lg px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {p.exporting ? "Saving…" : "GLB"}
      </button>
      </div>

      {p.videoPanelOpen && (
        <div data-export-settings="video" className={`${card} w-72`}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Clock
          </div>
          {/* THE ONE SETTING NO COMPETITOR CAN COPY. `pen` makes the film
              exactly as long as the gesture was, because the strokes carry
              real timestamps; `fixed` is what every other tool offers. The
              note below prints the sentence out loud rather than leaving a
              duration to be inferred from a number. */}
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            {(["pen", "fixed"] as ExportTimebase[]).map((t) => (
              <button key={t} type="button" onClick={() => p.setVideoTimebase(t)} className={seg(p.videoTimebase === t)}>
                {t === "pen" ? "Your pace" : "Fixed"}
              </button>
            ))}
          </div>
          {p.videoTimebase === "fixed" && (
            <div className="mt-1.5 flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
              {[2, 3, 5].map((s) => (
                <button key={s} type="button" onClick={() => p.setVideoFixedSeconds(s)} className={seg(p.videoFixedSeconds === s)}>
                  {s}s
                </button>
              ))}
            </div>
          )}
          <div className="mb-2 mt-1.5 text-[10px] leading-snug text-muted-foreground/80">
            {p.videoPlanNote}
          </div>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Frame rate
          </div>
          <div className="mb-1.5 flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            {[24, 30, 60].map((f) => (
              <button key={f} type="button" onClick={() => p.setVideoFps(f)} className={seg(p.videoFps === f)}>
                {f}
              </button>
            ))}
          </div>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Resolution
          </div>
          <div className="mb-1.5 flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            {[1, 2].map((s) => (
              <button key={s} type="button" onClick={() => p.setVideoScale(s)} className={seg(p.videoScale === s)}>
                {s}×
              </button>
            ))}
          </div>

          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Background
          </div>
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            <button type="button" onClick={() => p.setVideoTransparent(false)} className={seg(!p.videoTransparent)}>
              Paper
            </button>
            <button type="button" onClick={() => p.setVideoTransparent(true)} className={seg(p.videoTransparent)}>
              Transparent
            </button>
          </div>
          {/* NAMES MUST MATCH BEHAVIOUR, so the format is stated rather
              than implied. "Transparent" is a WebM with a VP9 alpha stream
              (lib/export/webm-alpha.ts) or, one click away, a lossless
              animated PNG; each sentence says where it plays and what it
              costs. Saying so is the difference between a setting and a
              surprise. */}
          {p.videoTransparent && (
            <div className="mt-1.5 flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
              {(["webm", "apng"] as const).map((f) => (
                <button key={f} type="button" onClick={() => p.setVideoAlphaFormat(f)} className={seg(p.videoAlphaFormat === f)}>
                  {f === "webm" ? "WebM" : "APNG"}
                </button>
              ))}
            </div>
          )}
          <div className="mt-1.5 text-[10px] leading-snug text-muted-foreground/80">
            {p.videoTransparent
              ? p.videoAlphaFormat === "webm"
                ? "WebM video (.webm) with alpha, no contact shadow. Plays see-through in Chrome and Edge and in editors that read VP9 alpha; other players may show it without its alpha. A browser that cannot encode WebM gets an animated PNG instead, and is told."
                : "Animated PNG (.png), lossless, keeps alpha, no contact shadow. Larger than a video, and it plays see-through everywhere, Safari included."
              : "WebM video (.webm) on the studio ground, exactly as you see it."}
          </div>
          <div className="mt-1.5 text-[10px] leading-snug text-muted-foreground/80">
            GIF uses these settings too: always on paper, 256 colours picked
            from the film itself, at most 50 fps.
          </div>
          {p.hasAnimatedStyleLayer && (
            <div className="mt-1.5 text-[10px] leading-snug text-muted-foreground/80">
              Animated style layers are stepped on the export clock, not on
              wall time. The file plays at the speed you set it, however
              long each frame takes to render.
            </div>
          )}
        </div>
      )}

      {p.pngPanelOpen && (
        /* OPAQUE, not translucent. At 95 % the page's own timing note read
           through the panel's body text: two sentences occupying the same
           pixels. A settings surface has no reason to be see-through. */
        <div data-export-settings="png" className={`${card} w-60`}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            PNG
          </div>
          <div className="mb-1.5 flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            {p.pngScales.map((s) => (
              <button key={s.value} type="button" onClick={() => p.setPngScale(s.value)} className={seg(p.pngScale === s.value)}>
                {s.label}
              </button>
            ))}
          </div>
          <div className="mb-2 text-[10px] leading-snug text-muted-foreground/80">
            {p.stillPixelNote}
          </div>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Background
          </div>
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
            <button type="button" onClick={() => p.setPngTransparent(false)} className={seg(!p.pngTransparent)}>
              Paper
            </button>
            <button type="button" onClick={() => p.setPngTransparent(true)} className={seg(p.pngTransparent)}>
              Transparent
            </button>
          </div>
          <div className="mt-1.5 text-[10px] leading-snug text-muted-foreground/80">
            {p.pngTransparent
              ? "No ground and no contact shadow. A shadow patch on a see-through background reads as dirt."
              : "The studio ground, exactly as you see it, with the contact shadow."}
          </div>
        </div>
      )}
    </div>
  )
}
