"use client"

/* ==================================================================
   TIMELINE PANEL · L3 of the layout rethink (BUILD-PLAN.md §2, "Timeline",
   "Transport" and "Draw-in"; §5 row L3).

   What the dock under the canvas held until L3, cut out of
   `components/viewport-3d.tsx` unchanged in what it renders and writes:

     · `TransportRow`   Play, time, scrubber, Natural / Authentic, the ±%
                        chip, 0.5x / 1x / 2x, Debug and its tools. Docked, it
                        is the dock group's header row, so Play shows while
                        the dock is collapsed.
     · `LiveTakeTimeline`  the strip, Perform, the keys and curves.
     · `TimingNote`     the folded line under them.
     · `DrawInBody`     the Draw-in controls, the Draw-in panel's content.

   The viewport still owns the state and the handlers and renders these into
   the dock's panels (`components/workspace/dock-hosts.tsx`). With no dock on
   the page (3-Up compare, capture mode) it composes them into the floating
   card it always had, and only there does the transport carry its own
   Draw-in toggle: docked, the Draw-in tab is that toggle.
   ================================================================== */

import type React from "react"
import TakeTimeline from "@/components/take-timeline"
import { DrawInTimingControls } from "@/components/draw-in-timing-controls"
import { useProgressValue, type ProgressStore } from "@/lib/take-transport"
import type { RevealMode } from "@/lib/pen-reveal"

/* ---- The transport's readout value, kept OUT of the host's React state ----
 *
 * Measured 2026-09-25, night R (`docs/verification/night-r/`): while a take
 * played, `progress` lived in `Viewport3D`'s `useState`, so each 66 ms readout
 * tick re-rendered the whole host and, through `<Canvas>`, about 50 components
 * of the R3F tree. Nothing in the scene reads that value; the scene reads
 * `playheadRef` inside `useFrame`. Only three readouts read it: the take bar,
 * the time label and the range input.
 *
 * So the value lives in a store and only those three subscribe. The host
 * subscribes to one boolean, "at the end", for the compare cycle, which flips
 * once a pass instead of fifteen times a second. Since L2 the store is the
 * page's transport's (`lib/take-transport.ts`, `createProgressStore`). */
export function LiveTakeTimeline({
  progressStore,
  ...rest
}: Omit<React.ComponentProps<typeof TakeTimeline>, "playhead"> & { progressStore: ProgressStore }) {
  return <TakeTimeline {...rest} playhead={useProgressValue(progressStore)} />
}
function ProgressTimeLabel({ progressStore, totalDuration }: { progressStore: ProgressStore; totalDuration: number }) {
  const p = useProgressValue(progressStore)
  return (
    <span className="w-10 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
      {((totalDuration * p) / 1000).toFixed(1) + "s"}
    </span>
  )
}
function ProgressScrubber({ progressStore, onScrub }: { progressStore: ProgressStore; onScrub: (v: number) => void }) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.001}
      value={useProgressValue(progressStore)}
      onChange={(e) => onScrub(Number(e.target.value))}
      aria-label="Playhead"
      className="h-1 min-w-16 flex-1 cursor-pointer appearance-none rounded-full bg-border accent-foreground"
    />
  )
}

export type TimingCharacter = { usable: boolean; present: boolean; maxDeviation: number }

export type TransportRowProps = {
  progressStore: ProgressStore
  totalDuration: number
  playing: boolean
  onPlayPause: () => void
  onScrub: (v: number) => void
  revealMode: RevealMode
  setRevealMode: (m: RevealMode) => void
  comparing: boolean
  timingCharacter: TimingCharacter
  speed: number
  setSpeed: (s: number) => void
  /** The floating card's own Draw-in toggle. Docked, the Draw-in tab is it. */
  drawIn?: { open: boolean; toggle: () => void; summary: string }
  debugSurfaceAllowed: boolean
  showDebug: boolean
  onToggleDebug: () => void
  hybridBlend: number
  setHybridBlend: (v: number) => void
  onSmooth: () => void
  compare3Up: boolean
  onCompareToggle: () => void
  onToggle3Up: () => void
  /** Docked: one row in the dock's header, no wrap, the scrubber gives. */
  docked?: boolean
}

/* THE TRANSPORT ROW. Every control is shrink-0, so the scrubber is the one
   that gives: `min-w-16` lets it drop below the range input's 129 px default,
   and the floating row wraps before any control can leave the card. At
   1280 x 800 PANEL's row ran 4 px past the dock's right edge and cut Debug in
   half. Docked it sits in the dock's 36 px header beside the tabs and does not
   wrap; the header gives it every pixel the tabs do not take. */
export function TransportRow(p: TransportRowProps) {
  const { revealMode, comparing, timingCharacter, speed } = p
  return (
    <div
      data-animation-transport
      className={
        p.docked
          ? "flex h-full min-w-0 flex-1 items-center gap-x-2 px-2"
          : "flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 px-3 py-2"
      }
    >
      {/* Play/Pause */}
      <button
        onClick={p.onPlayPause}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-foreground transition-colors hover:bg-accent"
        aria-label={p.playing ? "Pause" : "Play"}
      >
        {p.playing ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="2" y="1" width="3" height="10" rx="0.5" />
            <rect x="7" y="1" width="3" height="10" rx="0.5" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3 1.5v9l7.5-4.5L3 1.5z" />
          </svg>
        )}
      </button>

      {/* Time display */}
      <ProgressTimeLabel progressStore={p.progressStore} totalDuration={p.totalDuration} />

      {/* Scrubber */}
      <ProgressScrubber progressStore={p.progressStore} onScrub={p.onScrub} />

      {/* Main timing toggle: Natural (hybrid) / Authentic (raw) */}
      <div className={`flex shrink-0 items-center gap-0.5 ${comparing ? "pointer-events-none opacity-40" : ""}`}>
        <button
          type="button"
          onClick={() => p.setRevealMode("hybrid")}
          aria-pressed={revealMode === "hybrid"}
          className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
            revealMode === "hybrid"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Natural
        </button>
        <button
          type="button"
          onClick={() => p.setRevealMode("raw")}
          aria-pressed={revealMode === "raw"}
          className={`rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors ${
            revealMode === "raw"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Authentic
        </button>
        {/* Live state chip: how much speed variation the CURRENT strokes
            carry. This is the quantity the two buttons act on, so showing
            it turns "the toggle does nothing" into "there is nothing here
            for the toggle to do". */}
        <span
          title={
            timingCharacter.usable
              ? `Pen speed departs from constant by up to ${(timingCharacter.maxDeviation * 100).toFixed(1)}% of the stroke length`
              : "These strokes carry no usable timestamps"
          }
          className={`ml-1 shrink-0 rounded px-1 py-0.5 font-mono text-[9px] leading-none ${
            timingCharacter.present
              ? "bg-foreground/10 text-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {timingCharacter.usable
            ? `±${(timingCharacter.maxDeviation * 100).toFixed(1)}%`
            : "no timing"}
        </span>
      </div>

      <div className="h-4 w-px shrink-0 bg-border" />

      {/* Speed.
          `tabular-nums` because these three are NUMERALS in a segmented
          group and the selected one is a filled lozenge. Measured without
          it, same 6px padding on all three: 0.5x 33.36px, 1x 22.14px, 2x
          24.39px. Switching 1x to 2x grew the black pill by 2.25px and
          nudged its neighbour, for no reason but the width of a glyph.

          `type="button"` and `aria-pressed` bring these five transport
          buttons up to what the top strip already does: `app/page.tsx`
          carries `role="radiogroup"` + `aria-checked` on the mode and
          engine switchers, and its comment says the top-level selectors
          "had simply been missed". So had these. */}
      <div className="flex shrink-0 items-center gap-0.5">
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => p.setSpeed(s)}
            aria-pressed={speed === s}
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors ${speed === s
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {s}x
          </button>
        ))}
      </div>

      {/* ---- DRAW-IN, the floating card's own toggle -----------------------
          Order, overlap, the window, delay, ease, reverse and loop. The header
          copies Keyframes' (key-lanes.tsx): an 8 px chevron that turns 90
          degrees, the name in 10 px medium, and what is set in 10 px muted
          beside it, so a delay is never a mystery pause. Docked, the Draw-in
          tab of the dock does this job and carries the same summary. */}
      {p.drawIn && (
        <>
          <div className="h-4 w-px shrink-0 bg-border" />
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-animation-drawin
              data-open={p.drawIn.open ? "1" : "0"}
              aria-expanded={p.drawIn.open}
              aria-controls="animation-drawin-body"
              onClick={p.drawIn.toggle}
              title={p.drawIn.open ? "Hide the draw-in controls" : "Show the draw-in controls: order, overlap, delay, easing, reverse and loop"}
              className="fs-press flex shrink-0 items-center gap-1 text-[10px] font-medium text-foreground"
            >
              <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" className={`shrink-0 ${p.drawIn.open ? "rotate-90" : ""}`}>
                <path d="M2.5 1.5 5.5 4 2.5 6.5" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>
              Draw-in
            </button>
            {p.drawIn.summary && (
              <span data-animation-drawin-summary className="max-w-[12rem] truncate text-[10px] text-muted-foreground">
                {p.drawIn.summary}
              </span>
            )}
          </div>
        </>
      )}

      {/* Debug toggle, DEV ONLY. The door is guarded with the room it
          opens; see `debugSurfaceAllowed` where `showDebug` is derived. */}
      {p.debugSurfaceAllowed && (
        <>
          <div className="h-4 w-px shrink-0 bg-border" />
          <button
            onClick={p.onToggleDebug}
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              p.showDebug
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            Debug
          </button>
        </>
      )}

      {/* Debug-only tools */}
      {p.showDebug && (
        <>
          <div className="h-4 w-px shrink-0 bg-border" />

          {/* Smooth option (debug only) */}
          <button
            onClick={p.onSmooth}
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
              revealMode === "smooth"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Smooth
          </button>

          {/* Blend slider (debug only) */}
          {revealMode === "hybrid" && (
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={p.hybridBlend}
              onChange={(e) => p.setHybridBlend(Number(e.target.value))}
              title={`Blend: ${p.hybridBlend.toFixed(2)}`}
              disabled={comparing}
              className={`h-1 w-14 shrink-0 cursor-pointer appearance-none rounded-full bg-border accent-foreground ${comparing ? "opacity-40" : ""}`}
            />
          )}

          <div className="h-4 w-px shrink-0 bg-border" />

          {/* Compare toggle (debug only) */}
          <button
            onClick={p.onCompareToggle}
            disabled={p.compare3Up}
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              comparing
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            } ${p.compare3Up ? "pointer-events-none opacity-40" : ""}`}
          >
            {comparing ? "Stop" : "Compare"}
          </button>

          {/* 3-Up toggle (debug only) */}
          <button
            onClick={p.onToggle3Up}
            className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              p.compare3Up
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.compare3Up ? "Single" : "3-Up"}
          </button>
        </>
      )}
    </div>
  )
}

/* THE DRAW-IN SECTION, OPEN. The same component and the same props the
   popover passed, so every control writes the same host state. The scroll box
   and the column box are two elements on purpose: a height cap on a multi-
   column box adds columns to the right instead of scrolling. `columns-2xs` is
   the drawer's box (style-panel-scaffold), so the panel's width decides the
   column count. `px-3` and the `border-border/60` hairline are the strip's
   own. */
export function DrawInBody({ controls, docked }: { controls: React.ComponentProps<typeof DrawInTimingControls>; docked?: boolean }) {
  return (
    <div
      id="animation-drawin-body"
      data-animation-drawin-body
      role="region"
      aria-label="Draw-in timing"
      className={
        docked
          ? "h-full min-h-0 overflow-y-auto overscroll-contain px-3 pb-2 pt-2"
          : "min-h-0 shrink grow overflow-y-auto overscroll-contain border-t border-border/60 px-3 pb-2 pt-2"
      }
    >
      <div className="columns-2xs gap-3 [&>*]:break-inside-avoid">
        <DrawInTimingControls {...controls} />
      </div>
    </div>
  )
}

/* ---- Honest note about what the timing toggle depends on ----
   Natural and Authentic are the same reveal with one number changed, and the
   number is how far the recorded pen speed departs from constant. When it
   departs by nothing (a stroke laid out from the letter font stamps every
   point the same interval apart) the two settings produce identical frames,
   and without this line the only available conclusion is that the control is
   broken. The percentage is measured live off the strokes in the viewport
   with the SAME function the reveal uses, so it cannot describe something the
   renderer isn't doing.

   FOLDED TO ONE LINE (ANIM-3C). Folded, the line is the verdict, the one
   sentence that changes with the drawing and the reason the note exists:
   whether Natural and Authentic can differ here. Open, it is the whole
   paragraph, unchanged. The chevron is the Keyframes one. */
export function TimingNote({
  open,
  setOpen,
  timingCharacter,
  hybridBlend,
}: {
  open: boolean
  setOpen: (f: (v: boolean) => boolean) => void
  timingCharacter: TimingCharacter
  hybridBlend: number
}) {
  return (
    <div
      data-testid="timing-note"
      data-open={open ? "1" : "0"}
      className="flex shrink-0 items-start gap-1.5 border-t border-border/60 px-3 py-1.5 text-[10px] leading-snug text-muted-foreground"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls="timing-note-body"
        onClick={() => setOpen((v) => !v)}
        title={open ? "Fold the timing note" : "Read the whole timing note"}
        className={`fs-press flex items-start gap-1.5 text-left transition-colors hover:text-foreground ${open ? "shrink-0" : "min-w-0"}`}
      >
        <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" className={`mt-[3px] shrink-0 ${open ? "rotate-90" : ""}`}>
          <path d="M2.5 1.5 5.5 4 2.5 6.5" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
        {open ? (
          <span className="sr-only">Fold the timing note</span>
        ) : (
          <span id="timing-note-body" className="min-w-0 truncate">
            {!timingCharacter.usable
              ? "These strokes carry no usable timestamps, so both settings render the same reveal."
              : timingCharacter.present
                ? `This drawing’s pen speed departs from constant by up to ${(timingCharacter.maxDeviation * 100).toFixed(1)}% of its length, so the two settings differ.`
                : `This drawing was made at a near-constant speed, max departure ${(timingCharacter.maxDeviation * 100).toFixed(1)}%, so both settings render the same reveal.`}
          </span>
        )}
      </button>
      {open && (
        <div id="timing-note-body" className="min-w-0">
          <span className="text-foreground">Authentic</span> replays the speed the
          stroke was drawn at; <span className="text-foreground">Natural</span> blends
          that {Math.round(hybridBlend * 100)}% back toward constant speed.{" "}
          {!timingCharacter.usable ? (
            <>
              These strokes carry no usable timestamps, so both settings render the
              same reveal.
            </>
          ) : timingCharacter.present ? (
            <>
              This drawing&rsquo;s pen speed departs from constant by up to{" "}
              {(timingCharacter.maxDeviation * 100).toFixed(1)}% of its length, so
              the two settings differ.
            </>
          ) : (
            <>
              This drawing was made at a near-constant speed, max departure{" "}
              {(timingCharacter.maxDeviation * 100).toFixed(1)}%, so both settings
              render the same reveal. Strokes imported from the letter font are
              stamped at a fixed interval per point and have nothing to replay.
              Draw by hand, with pauses and flicks, to see the difference.
            </>
          )}{" "}
          {/* WAS FALSE ON SCREEN UNTIL 2026-08-28. It read "Speed only: pen
              pressure is recorded but no engine reads it yet." Inflate has read
              pressure since `INFLATE_PRESSURE_INFLUENCE` landed
              (`lib/geometry-engines.ts`, `inflateInkWidthProfile`): a constant
              0.5 against a 0.15 to 0.95 ramp moves 14,167 px and 4.7% of the
              ink. What is true is the SPLIT, so the caption says the split. */}
          Pressure shapes the mark&rsquo;s width, never its timing. A mouse or
          trackpad reports a flat 0.5, so pressure only shows up under a stylus.
        </div>
      )}
    </div>
  )
}
