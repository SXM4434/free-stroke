"use client"

/* THE DRAW-IN TIMING CONTROLS, ONE COPY, TWO DOORS.
 *
 * Order, overlap, align, unit, direction, the window, delay, the form, ease,
 * cadence, reverse and loop. Until 2026-09-25 these lived inline in the Timing
 * popover in `components/viewport-3d.tsx`, and the popover exists only once a
 * stroke is drawn. The Animation tab in the style drawer said "open Draw-in
 * timing" and held none of them. His words, 09-24: "there's like no animation
 * panel whatsoever". Ledger thread 1.2, nine times since 08-02.
 *
 * So the controls moved here and both doors render THIS component: the Draw-in
 * section of the Animation panel under the canvas (`viewport-3d.tsx`, a
 * popover until 2026-09-26) and the Animation tab
 * (`components/style-panel-scaffold.tsx`). Both write the same host state in
 * `app/page.tsx` (`drawIn`, `revealWindow`, `revealEnvelope`, `flatten`), so a
 * change in one shows in the other on the next render.
 *
 * It renders a fragment of blocks and no container. Each caller supplies its
 * own box (the dock section's columns, the drawer's columns), and the
 * dock's `[&>*]:break-inside-avoid` still reaches every block because a
 * fragment's children are the container's children in the DOM. */

import type React from "react"
import { useState } from "react"
import { CurveEditor, CURVE_FIT_H } from "@/components/key-lanes"
import type { EaseIn, EaseOut, Key, KeyProperty } from "@/lib/keyframes"
import {
  useStrokeTake,
  clampDelay,
  clampSpeed,
  SPEED_MIN,
  SPEED_MAX,
} from "@/components/stroke-strip"
import { rowOf, withRow, withoutRow, curveOfEase, curveProblem, type StrokeEase } from "@/lib/stroke-timing"
import {
  ORDER_LABELS,
  ORDER_NOTES,
  WINDOW_LABELS,
  WINDOW_NOTES,
  WINDOW_MIN_LENGTH,
  REVERSE_LABELS,
  REVERSE_NOTES,
  CADENCE_HZ,
  REVEAL_CLOCK_LABELS,
  type RevealClock,
  REVEAL_RATE_MIN,
  REVEAL_RATE_MAX,
  type DrawInParams,
  type StrokeOrder,
  type ReverseMode,
  type RevealWindowMode,
  type RevealWindowParams,
  type RevealCadence,
  type RevealEase,
  type RevealEasePreset,
  type RevealCurve,
  type RevealEnvelopeParams,
} from "@/lib/stroke-schedule"
import { HAND_DRAW_RATE } from "@/lib/style-system"
import type { FlatState } from "@/lib/flat-ink"
import type { FlipChoice } from "@/lib/style-system"

/* The Speed row's pills: slow, as timed, fast, and Hand Draw's own rate. */
const RATE_PILLS = [0.5, 1, 2, HAND_DRAW_RATE]

/** The drawer's Animation tab fires this to open the Draw-in section of the
 * Animation panel under the canvas (`viewport-3d.tsx` listens). A DOM event
 * because the drawer and the viewport are siblings in `app/page.tsx`. */
export const OPEN_ANIMATION_PANEL_EVENT = "fs:animation-panel"

export const REVEAL_EASES: { id: RevealEasePreset; label: string; note: string }[] = [
  { id: "linear", label: "Linear", note: "Constant rate from start to finish." },
  { id: "in", label: "Ease in", note: "Starts slowly, then runs away with it." },
  { id: "out", label: "Ease out", note: "Sets off at pace and settles onto the last stroke." },
  { id: "inOut", label: "Ease in-out", note: "Eases away and eases home. The film look." },
]

export function DrawInTimingControls({
  drawIn,
  patchDrawIn,
  drawInUnitCount,
  strokeCount,
  revealWindow,
  patchWindow,
  envelope,
  patchEnvelope,
  onEase,
  flatten,
  patchFlatten,
  flip,
  patchFlip,
  wrap,
  showPace,
}: {
  drawIn: DrawInParams
  patchDrawIn: (patch: Partial<DrawInParams>) => void
  /** Units the model made of the strokes on screen; 0 when nothing is drawn. */
  drawInUnitCount: number
  strokeCount: number
  revealWindow: RevealWindowParams
  patchWindow: (patch: Partial<RevealWindowParams>) => void
  envelope: RevealEnvelopeParams
  /** `gesture` names one drag of the curve, so the drag is one undo step. */
  patchEnvelope: (patch: Partial<RevealEnvelopeParams>, gesture?: string | null) => void
  /** The viewport passes its own, which also re-derives the clock so the mark
   *  does not jump. Without one, the ease is written to the envelope. */
  onEase?: (ease: RevealEase) => void
  flatten?: FlatState
  /** Absent means the host cannot change the form, and the block is hidden. */
  patchFlatten?: (patch: Partial<FlatState>) => void
  /** FLIP-3 · the flip after the draw-in. Absent `patchFlip` hides the pills. */
  flip?: FlipChoice
  patchFlip?: (flip: FlipChoice) => void
  /** Customize passes its <Field> here, so each block below shows under a
   *  preset that sets its keys, with the edited dot and Reset. Keys are the
   *  preset's flat names (`drawIn.overlap`). No wrap renders every block. */
  wrap?: (keys: string[], node: React.ReactNode) => React.ReactNode
  /** Adds the Natural / Authentic pace, which otherwise lives only on the
   *  transport under the 3D view. The Animation tab and Customize pass it. */
  showPace?: boolean
}) {
  const W = wrap ?? ((_keys: string[], node: React.ReactNode) => node)
  const revealDelaySeconds = envelope.delaySeconds
  const revealEase = envelope.ease
  const revealCadence = envelope.cadence
  const revealLoop = envelope.loop
  const revealReverse = envelope.reverse
  const setRevealDelaySeconds = (v: number) => patchEnvelope({ delaySeconds: v })
  const setRevealLoop = (f: (v: boolean) => boolean) => patchEnvelope({ loop: f(revealLoop) })
  const setRevealReverse = (f: (v: boolean) => boolean) => patchEnvelope({ reverse: f(revealReverse) })
  const handleEaseChange = onEase ?? ((e: RevealEase) => patchEnvelope({ ease: e }))
  /* Custom open with a preset still in force: nothing is written until he drags. */
  const [envCustomOpen, setEnvCustomOpen] = useState(false)
  const envCustom = typeof revealEase === "object" || envCustomOpen
  return (
    <>
    {W([], <SelectedStrokeBlock />)}
    {/* ═══ DRAW IN, order · overlap · align ═══════════════════════
        The first modifier. `docs/animation-toolset-map.md` §8: it is
        *"the first thing in this app's history that makes the
        draw-in an authored decision instead of a transcript."* */}
    <div className="mb-3 break-inside-avoid rounded-md border border-border/70 p-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
          Draw in
        </span>
        {strokeCount > 0 && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {drawInUnitCount} {drawIn.unit === "stroke" ? "strokes" : "groups"}
            {drawIn.unit === "group" && drawInUnitCount !== strokeCount
              ? ` of ${strokeCount}`
              : ""}
          </span>
        )}
      </div>

      {/* ORDER */}
      {W(["drawIn.order"], <>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Order
      </span>
      <div className="mb-1 mt-1 flex flex-wrap gap-1">
        {(Object.keys(ORDER_LABELS) as StrokeOrder[]).map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => patchDrawIn({ order: o })}
            aria-pressed={drawIn.order === o}
            title={ORDER_NOTES[o]}
            className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              drawIn.order === o
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {ORDER_LABELS[o]}
          </button>
        ))}
        {drawIn.order === "random" && (
          <button
            type="button"
            onClick={() => patchDrawIn({ seed: (drawIn.seed | 0) + 1 })}
            title="Another shuffle. The seed is shown so a take is repeatable."
            className="fs-press rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Shuffle · {drawIn.seed}
          </button>
        )}
      </div>
      <span className="mb-2 block text-[10px] leading-snug text-muted-foreground">
        {ORDER_NOTES[drawIn.order]}
      </span>
      {drawIn.order === "tapped" && strokeCount > 0 && (
        <TapOrderField taps={drawIn.taps ?? []} strokeCount={strokeCount} onTaps={(taps) => patchDrawIn({ taps })} />
      )}
      </>)}
      {/* OVERLAP */}
      {W(["drawIn.overlap"], <>
      <label className="mb-2 flex flex-col gap-1">
        <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>Overlap</span>
          <span className="tabular-nums text-foreground">
            {drawIn.overlap === 0
              ? "one at a time"
              : drawIn.overlap === 1
                ? "all at once"
                : `${Math.round(drawIn.overlap * 100)}%`}
          </span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          aria-label="Overlap"
          value={drawIn.overlap}
          onChange={(e) => patchDrawIn({ overlap: Number(e.target.value) })}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
        />
        <span className="text-[10px] leading-snug text-muted-foreground">
          0 draws one unit at a time; 1 draws every unit across the whole beat.
          Past 0 the pen&rsquo;s recorded pace rides the beat rather than the
          stroke.
        </span>
      </label>
      </>)}
      {W(["drawIn.align"], <>
      {/* ALIGN, dead at overlap 0, and DISABLED rather than left
          standing. Explainer 06 §3's rule for the stack's Direction
          dial: a control on screen that cannot act is a defect. */}
      <div className="mb-2 flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Align {drawIn.overlap === 0 && <span className="normal-case">(needs overlap)</span>}
        </span>
        <div className="flex flex-wrap gap-1">
          {(["start", "end"] as const).map((a) => (
            <button
              key={a}
              type="button"
              disabled={drawIn.overlap === 0}
              onClick={() => patchDrawIn({ align: a })}
              aria-pressed={drawIn.align === a}
              title={
                a === "start"
                  ? "Everything starts together, so short units finish early. The word ravels out."
                  : "Everything lands together, so short units start late. The word lands like a chord."
              }
              className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                drawIn.align === a
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {a === "start" ? "Start together" : "End together"}
            </button>
          ))}
        </div>
      </div>
      </>)}
      {W(["drawIn.unit"], <>
      {/* UNIT, Sebs's pick 2: group by default, stroke on request */}
      <div className="mb-2 flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Unit
        </span>
        <div className="flex flex-wrap gap-1">
          {(["group", "stroke"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => patchDrawIn({ unit: u })}
              aria-pressed={drawIn.unit === u}
              title={
                u === "group"
                  ? "Strokes whose ink overlaps move together, which is what a viewer reads as one thing."
                  : "Every stroke on its own, including ones your hand fused."
              }
              className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                drawIn.unit === u
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {u === "group" ? "Groups" : "Strokes"}
            </button>
          ))}
        </div>
      </div>
      </>)}
      {W(["drawIn.reverse"], <>
      {/* DIRECTION, Cavalry's *Reverse Path*, per unit. It sits in
          DRAW IN and not in WINDOW because it changes the MAP and
          not the interval over it: it is which end of a stroke the
          pen starts from, which is a scheduling fact. */}
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Direction
        </span>
        <div className="flex flex-wrap gap-1">
          {(["off", "all", "alternate"] as ReverseMode[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => patchDrawIn({ reverse: r })}
              aria-pressed={drawIn.reverse === r}
              title={REVERSE_NOTES[r]}
              className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                drawIn.reverse === r
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {REVERSE_LABELS[r]}
            </button>
          ))}
        </div>
        <span className="text-[10px] leading-snug text-muted-foreground">
          {REVERSE_NOTES[drawIn.reverse]}
        </span>
      </div>
      </>)}
    </div>

    {/* ═══ WINDOW, the reveal stops being a prefix ═══════════════
        `docs/animation-toolset-map.md` §8's second slice: *"make
        the reveal a WINDOW rather than a prefix, `start` and `end`
        instead of one `progress`, plus `travel`."* It is its own
        box below DRAW IN because it reads the schedule rather than
        building it: DRAW IN says which ink is where in the beat,
        this says which stretch of the beat is on the page. */}
    <div className="mb-3 break-inside-avoid rounded-md border border-border/70 p-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
          Window
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {revealWindow.mode === "grow" ? "prefix" : "interval"}
        </span>
      </div>

      {W(["revealWindow.mode"], <>
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Ends
      </span>
      <div className="mb-1 mt-1 flex flex-wrap gap-1">
        {(Object.keys(WINDOW_LABELS) as RevealWindowMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => patchWindow({ mode: m })}
            aria-pressed={revealWindow.mode === m}
            title={WINDOW_NOTES[m]}
            className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              revealWindow.mode === m
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {WINDOW_LABELS[m]}
          </button>
        ))}
      </div>
      <span className="mb-2 block text-[10px] leading-snug text-muted-foreground">
        {WINDOW_NOTES[revealWindow.mode]}
      </span>
      </>)}
      {W(["revealWindow.length"], <>
      {/* LENGTH, dead outside `travel`, and DISABLED rather than
          left standing, the same rule `align` follows at overlap 0.
          Explainer 06 §3: a control on screen that cannot act is a
          defect. */}
      <label className="flex flex-col gap-1">
        <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          <span>
            Length{" "}
            {revealWindow.mode !== "travel" && (
              <span className="normal-case">(travel only)</span>
            )}
          </span>
          <span className="tabular-nums text-foreground">
            {Math.round(revealWindow.length * 100)}%
          </span>
        </span>
        <input
          type="range"
          aria-label="Window length"
          min={WINDOW_MIN_LENGTH}
          max={1}
          step={0.01}
          disabled={revealWindow.mode !== "travel"}
          value={revealWindow.length}
          onChange={(e) => patchWindow({ length: Number(e.target.value) })}
          className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
        />
        <span className="text-[10px] leading-snug text-muted-foreground">
          How much of the mark is on the page at once. Small is a pen with no
          ink behind it; 100% is the whole word arriving and leaving together.
        </span>
      </label>
      </>)}
    </div>
    {/* ═══ THE FORM, flat ink, or a lit object ════════════════════
        The channel the hero beat animates, and the one this route
        never had a value for: `flatten` defaulted to SOLID_STATE on
        every render, so `/` could only ever draw the LAST frame of
        the beat. Two dials, because they are the two halves of the
        same event. `ink` collapses the shading; `yaw` turns the mark
        so its thickness faces you, which is the only angle where the
        depth can be seen at all. Explainer note on FlatState: "the
        CAMERA does not participate", because if it moved the change
        would belong to the viewpoint and not to the object. */}
    {W([], patchFlatten && flatten && (
      <div className="mb-3 break-inside-avoid rounded-md border border-border/70 p-2">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
            The form
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {flatten.ink >= 0.5 ? "flat ink" : "lit object"}
          </span>
        </div>

        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Shading
        </span>
        <div className="mb-1 mt-1 flex flex-wrap gap-1">
          {([[0, "Lit object"], [1, "Flat ink"]] as [number, string][]).map(([v, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => patchFlatten({ ink: v })}
              aria-pressed={flatten.ink === v}
              className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                flatten.ink === v
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="mb-2 block text-[10px] leading-snug text-muted-foreground">
          {flatten.ink >= 0.5
            ? "One flat value, no shading. The mark reads as a drawing."
            : "Lit, with depth. This is what the app has always shown."}
        </span>

        {patchFlip && (
          <>
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Flip
            </span>
            <div role="group" aria-label="Flip" className="mb-1 mt-1 flex flex-wrap gap-1">
              {(
                [
                  ["off", "Off"],
                  ["flatToSolid", "Flat to solid"],
                  ["solidToFlat", "3D first"],
                ] as [FlipChoice, string][]
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => patchFlip(v)}
                  aria-pressed={(flip ?? "off") === v}
                  className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    (flip ?? "off") === v
                      ? "border-foreground/20 bg-foreground text-background"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="mb-2 block text-[10px] leading-snug text-muted-foreground">
              {flip === "flatToSolid"
                ? "Draws flat, then turns edge-on and comes back as the lit object. The flip sets the shading for the whole take."
                : flip === "solidToFlat"
                  ? "Draws as the lit object, then turns edge-on and comes back flat. The flip sets the shading for the whole take."
                  : "No flip. The take ends when the pen lands."}
            </span>
          </>
        )}

        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Turn
          </span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {Math.round(((flatten.yaw ?? 0) * 180) / Math.PI)}&deg;
          </span>
        </div>
        <input
          type="range"
          min={-90}
          max={90}
          step={1}
          aria-label="Turn"
          value={Math.round(((flatten.yaw ?? 0) * 180) / Math.PI)}
          onChange={(e) => patchFlatten({ yaw: (Number(e.target.value) * Math.PI) / 180 })}
          className="mt-1 h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
        />
        <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">
          The mark turns on its own vertical axis. At 90 degrees its
          thickness faces you and is the whole picture. The camera
          does not move, so the change belongs to the object.
        </span>
      </div>
    ))}
    {/* ═══ WHOLE DRAW, delay · pace · ease · cadence · playback ═══
        The clock the whole take runs on, one box like DRAW IN and
        WINDOW. These rows sat loose under WINDOW until 2026-09-26, so
        in Customize they read as a fourth thing and a column could
        start halfway through them (MOTION-CUSTOM-2). */}
    <div className="mb-3 break-inside-avoid rounded-md border border-border/70 p-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
          Whole draw
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {revealLoop ? "loops" : "once"}
        </span>
      </div>
    {/* DELAY */}
    {W(["envelope.delaySeconds"], <>
    <label className="mb-2 flex flex-col gap-1">
      <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Delay before it starts</span>
        <span className="tabular-nums text-foreground">
          {revealDelaySeconds === 0 ? "none" : `${revealDelaySeconds.toFixed(1)}s`}
        </span>
      </span>
      <input
        type="range"
        min={0}
        max={3}
        step={0.1}
        aria-label="Delay before it starts"
        value={revealDelaySeconds}
        onChange={(e) => setRevealDelaySeconds(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
      />
      <span className="text-[10px] leading-snug text-muted-foreground">
        A beat of blank page before the pen lands. Re-runs between loops.
      </span>
    </label>
    </>)}
    {/* PACE, the transport's Natural / Authentic, here so a draw-in preset's
        pace can be edited where its other fields are (MOTION-CUSTOM). */}
    {showPace && W(["envelope.mode"], (
      <div className="mb-2 flex flex-col gap-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Pace
        </span>
        <div className="flex flex-wrap gap-1">
          {([["hybrid", "Natural"], ["raw", "Authentic"]] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => patchEnvelope({ mode: id })}
              aria-pressed={envelope.mode === id}
              className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                envelope.mode === id
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="text-[10px] leading-snug text-muted-foreground">
          {envelope.mode === "raw"
            ? "Authentic plays the pen at the speed you drew it."
            : "Natural is the default. The pills under the 3D view set the same thing."}
        </span>
      </div>
    ))}
    {/* CLOCK (HAND-DRAW). A row beside Pace, not a third pill in it: Pace says
        how a clock is read, Clock says which one, and Natural over the hand is
        a real pair a third pill would rule out. Held while a performed take
        exists, because a new clock would move what he performed. */}
    {showPace && W(["envelope.clock"], (
      <div className="mb-2 flex flex-col gap-1" data-clock-row>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Clock
        </span>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(REVEAL_CLOCK_LABELS) as RevealClock[]).map((id) => (
            <button
              key={id}
              type="button"
              data-clock={id}
              onClick={() => patchEnvelope({ clock: id })}
              aria-pressed={envelope.clock === id}
              className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors disabled:opacity-40 ${
                envelope.clock === id
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {REVEAL_CLOCK_LABELS[id]}
            </button>
          ))}
        </div>
        <span className="text-[10px] leading-snug text-muted-foreground" data-clock-note>
          {envelope.clock === "hand"
            ? "A modelled hand times your strokes: slower into corners, a short lift inside a letter, a longer one between words."
            : "Recorded plays the timing you drew with."}
        </span>
      </div>
    ))}
    {/* SPEED (HAND-DRAW-3). The one playback rate, over whichever clock is on.
        Beside Clock because both decide what the clock is, and held with it
        under a performed take for the same reason. */}
    {showPace && W(["envelope.rate"], (
      <div className="mb-2 flex flex-col gap-1" data-rate-row>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Speed
        </span>
        <div className="flex flex-wrap gap-1">
          {/* Pills like Pace and Clock beside it (HAND-DRAW-4). A stored rate
              off this list gets its own pressed pill, so a doc saved at 1.5x
              still shows what it plays at. */}
          {(RATE_PILLS.includes(envelope.rate) ? RATE_PILLS : [...RATE_PILLS, envelope.rate].sort((a, b) => a - b)).map((r) => (
            <button
              key={r}
              type="button"
              data-rate={r}
              onClick={() => { if (r >= REVEAL_RATE_MIN && r <= REVEAL_RATE_MAX) patchEnvelope({ rate: r }) }}
              aria-pressed={envelope.rate === r}
              className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium tabular-nums transition-colors disabled:opacity-40 ${
                envelope.rate === r
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {`${+r.toFixed(2)}x`}
            </button>
          ))}
        </div>
        <span className="text-[10px] leading-snug text-muted-foreground" data-rate-note>
          {envelope.rate === 1
            ? "The clock plays at the pace it was timed."
            : `The whole clock plays ${envelope.rate}x as fast, so a longer drawing still takes longer.`}
        </span>
      </div>
    ))}
    {/* EASE, and the note that keeps it distinct from Natural /
        Authentic, which is the only way either control stays
        honest about what it does. */}
    {W(["envelope.ease"], <>
    <div className="mb-2 flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Ease over the whole draw
      </span>
      <div className="flex flex-wrap gap-1">
        {REVEAL_EASES.map((e) => (
          <button
            key={e.id}
            type="button"
            data-envelope-ease={e.id}
            onClick={() => {
              setEnvCustomOpen(false)
              handleEaseChange(e.id)
            }}
            aria-pressed={!envCustom && revealEase === e.id}
            title={e.note}
            className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              !envCustom && revealEase === e.id
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {e.label}
          </button>
        ))}
        <CustomPill
          on={envCustom}
          tag="envelope"
          onOpen={() => {
            setEnvCustomOpen(true)
            if (curveKnock("seed-write")) patchEnvelope({ ease: curveOfEase(revealEase) })
          }}
        />
      </div>
      {envCustom && (
        <EaseCurveField
          tag="envelope"
          curve={curveOfEase(revealEase)}
          onCurve={(c, g) => patchEnvelope({ ease: c }, g)}
        />
      )}
      <span className="text-[10px] leading-snug text-muted-foreground">
        This shapes the clock for the whole reveal. Natural / Authentic above
        shapes the pen&rsquo;s speed WITHIN it, so they compose.
      </span>
    </div>
    </>)}
    {/* CADENCE, ones or twos.
        Not an easing and not a speed: it changes how OFTEN a new
        state is shown, not which state. `hero-motion.ts` calls twos
        "a deliberate hand-animation cadence and it is a large part
        of why the film reads as drawn rather than rendered", and
        the beat has shipped on it for months on the other route.
        Sits under Ease because both shape the clock. */}
    {W(["envelope.cadence"], <>
    <div className="mb-2 flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Cadence
      </span>
      <div className="flex flex-wrap gap-1">
        {([["ones", "Ones"], ["twos", "Twos"]] as [RevealCadence, string][]).map(
          ([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => patchEnvelope({ cadence: id })}
              aria-pressed={revealCadence === id}
              className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                revealCadence === id
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ),
        )}
      </div>
      <span className="text-[10px] leading-snug text-muted-foreground">
        {revealCadence === "twos"
          ? `Held for a whole step, ${CADENCE_HZ} a second. The hand-animation cadence, and what makes a beat read as drawn rather than rendered.`
          : "A new state every frame. Smooth, and the default."}
      </span>
    </div>
    </>)}
    {/* REVERSE + LOOP */}
    {W(["envelope.reverse", "envelope.loop"], <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Playback
      </span>
    <div className="flex flex-wrap gap-1">
      <button
        type="button"
        onClick={() => setRevealReverse((v) => !v)}
        aria-pressed={revealReverse}
        title="Play the draw backwards, so the mark un-draws"
        className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
          revealReverse
            ? "border-foreground/20 bg-foreground text-background"
            : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        Reverse
      </button>
      <button
        type="button"
        onClick={() => setRevealLoop((v) => !v)}
        aria-pressed={revealLoop}
        title="Start again when it reaches the end"
        className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
          revealLoop
            ? "border-foreground/20 bg-foreground text-background"
            : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        Loop
      </button>
    </div>
    </div>)}
    </div>
    </>
  )
}

/* ═══ TAP ORDER (coverage row 33) ════════════════════════════════════
 * One chip per stroke, numbered as drawn. A tap puts the stroke next in line
 * and shows its place on the chip; tapping a placed stroke takes it out, and
 * the ones after it move up. Each tap also selects the stroke, so its bar
 * lights in the strip and you can see which one you placed. */
function TapOrderField({ taps, strokeCount, onTaps }: { taps: number[]; strokeCount: number; onTaps: (taps: number[]) => void }) {
  const ctx = useStrokeTake()
  const placed = taps.filter((t) => t < strokeCount)
  return (
    <div data-tap-order className="mb-2 flex flex-col gap-1">
      <span className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>Tap the strokes in order</span>
        <button
          type="button"
          data-tap-clear
          disabled={placed.length === 0}
          onClick={() => onTaps([])}
          className="normal-case text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-40"
        >
          Clear
        </button>
      </span>
      <div className="flex flex-wrap gap-1">
        {Array.from({ length: strokeCount }, (_, i) => {
          const at = placed.indexOf(i)
          return (
            <button
              key={i}
              type="button"
              data-tap-stroke={i}
              aria-pressed={at >= 0}
              onClick={() => {
                onTaps(at >= 0 ? placed.filter((t) => t !== i) : [...placed, i])
                ctx?.select(i)
              }}
              title={at >= 0 ? `Stroke ${i + 1} draws ${at + 1}${at === 0 ? "st" : at === 1 ? "nd" : at === 2 ? "rd" : "th"}. Tap to take it out.` : `Stroke ${i + 1}: tap to draw it next`}
              className={`fs-press min-w-[28px] rounded-full border px-1.5 py-0.5 text-[10px] font-medium tabular-nums transition-colors ${
                at >= 0
                  ? "border-foreground/20 bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {i + 1}
              {at >= 0 && <span className="ml-1 opacity-70">#{at + 1}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ═══ THE SELECTED STROKE (ANIM-1B) ═══════════════════════════════════
 * The numbers behind the bar you picked in the strip: delay, speed, ease,
 * Hold back and Reverse. Both doors render this through `DrawInTimingControls`, and both
 * read the page's take through `useStrokeTake()`, so a drag in the strip and a
 * number typed here are the same write. No provider (a host with no take)
 * means no block, never a block whose inputs move nothing.
 *
 * Ease is the four presets, or Custom: a curve he shapes, overshoot included. */
function SelectedStrokeBlock() {
  /* Which stroke has Custom open with its preset still in force. Keyed by
   * stroke so picking another bar does not carry the editor over. */
  const [customFor, setCustomFor] = useState<number | null>(null)
  const ctx = useStrokeTake()
  if (!ctx || ctx.strokeCount === 0) return null
  const { take, commit, selected, select, strokeCount } = ctx
  if (selected === null) {
    return (
      <div data-stroke-block="none" className="mb-3 rounded-md border border-border/70 p-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">Stroke</span>
        <span className="mt-1 block text-[10px] leading-snug text-muted-foreground">
          Click a bar in the strip under the canvas to time that one stroke.
        </span>
      </div>
    )
  }
  const i = selected
  const row = rowOf(take, i)
  const easeId = row.ease.kind === "preset" ? row.ease.id : null
  const strokeCustom = row.ease.kind === "bezier" || customFor === i
  const put = (patch: Parameters<typeof withRow>[2], key: string | null) => {
    const cur = rowOf(take, i)
    if ((Object.keys(patch) as (keyof typeof cur)[]).every((k) => patch[k] === cur[k])) return
    commit(withRow(take, i, patch), key)
  }
  return (
    <div data-stroke-block={i} className="mb-3 rounded-md border border-border/70 p-2">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-foreground">
          Stroke {i + 1}
        </span>
        <span className="flex items-baseline gap-2 text-[10px] tabular-nums text-muted-foreground">
          of {strokeCount}
          <button
            type="button"
            onClick={() => select(null)}
            className="text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            Done
          </button>
        </span>
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Delay, ms</span>
          <input
            type="number"
            data-stroke-field="delay"
            step={10}
            value={row.delayMs}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!Number.isFinite(v)) return
              // A delay that would start before zero moves nothing, so it stops at zero.
              put({ delayMs: clampDelay(row, ctx.slotsRef.current?.[i * 2] ?? 0, v) }, `take:delay:${i}`)
            }}
            className="h-6 w-full rounded-md border border-border bg-transparent px-1.5 text-[11px] tabular-nums text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Speed, x</span>
          <input
            type="number"
            data-stroke-field="speed"
            step={0.1}
            min={SPEED_MIN}
            max={SPEED_MAX}
            value={row.speed}
            onChange={(e) => {
              const v = Number(e.target.value)
              if (!(Number.isFinite(v) && v > 0)) return
              put({ speed: clampSpeed(v) }, `take:speed:${i}`)
            }}
            className="h-6 w-full rounded-md border border-border bg-transparent px-1.5 text-[11px] tabular-nums text-foreground"
          />
        </label>
      </div>

      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Ease</span>
      <div className="mb-2 mt-1 flex flex-wrap gap-1">
        {REVEAL_EASES.map((o) => (
          <button
            key={o.id}
            type="button"
            data-stroke-ease={o.id}
            aria-pressed={!strokeCustom && easeId === o.id}
            title={o.note}
            onClick={() => {
              setCustomFor(null)
              put({ ease: { kind: "preset", id: o.id } as StrokeEase }, null)
            }}
            className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              !strokeCustom && easeId === o.id
                ? "border-foreground/20 bg-foreground text-background"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
        <CustomPill on={strokeCustom} tag="stroke" onOpen={() => setCustomFor(i)} />
      </div>
      {strokeCustom && (
        <div className="mb-2">
          <EaseCurveField
            tag="stroke"
            curve={curveOfEase(row.ease)}
            onCurve={(c, g) =>
              curveKnock("stroke-neighbour")
                ? commit(withRow(take, (i + 1) % strokeCount, { ease: { kind: "bezier", ...c } }), g)
                : put({ ease: { kind: "bezier", ...c } }, g)
            }
          />
        </div>
      )}

      <div className="flex gap-1">
        <button
          type="button"
          data-stroke-field="holdBack"
          aria-pressed={row.holdBack}
          onClick={() => put({ holdBack: !row.holdBack }, null)}
          title="Stroke lands last, after every other stroke has finished"
          className={`fs-press flex-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
            row.holdBack
              ? "border-foreground/20 bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Hold back
        </button>
        <button
          type="button"
          data-stroke-field="reverse"
          aria-pressed={!!row.reverse}
          onClick={() => put({ reverse: !row.reverse }, null)}
          title="Draw this stroke from its far end back to where the pen began, in the same slot"
          className={`fs-press flex-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors ${
            row.reverse
              ? "border-foreground/20 bg-foreground text-background"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Reverse
        </button>
        <button
          type="button"
          data-stroke-field="reset"
          disabled={!(i in take.strokes)}
          onClick={() => commit(withoutRow(take, i), null)}
          title="Put this stroke back where the pen drew it"
          className="fs-press flex-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  )
}

/* ==========================================================================
 * DRAWIN-CURVE · CUSTOM, THE FIFTH EASE
 *
 * The key lanes' own curve editor, imported, not copied: one editor, so the
 * two can never look or behave apart. The draw-in's clock is the span from
 * key 0 to key 1, the out handle is (x1, y1) and the in handle (x2, y2). The
 * editor lets y run past the box by its padding, which is the overshoot.
 * ======================================================================== */

/* Dev only: the gate's must-fails reach the shipped code through this knob and
 * nothing else. "seed-write" writes the seed on Custom, "gesture" drops the
 * drag's undo name, "stroke-neighbour" writes a stroke's curve to the next one,
 * "no-fit" renders the editor at the key lanes' width, past the column's edge. */
function curveKnock(name: string): boolean {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return false
  return (window as unknown as Record<string, unknown>).__fsCurveKnockout === name
}

const CUSTOM_NOTE = "Shape the curve yourself. Drag a handle past the top to overshoot."

function CustomPill({ on, tag, onOpen }: { on: boolean; tag: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      data-ease-custom={tag}
      aria-pressed={on}
      aria-expanded={on}
      title={CUSTOM_NOTE}
      onClick={onOpen}
      className={`fs-press rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
        on ? "border-foreground/20 bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground"
      }`}
    >
      Custom
    </button>
  )
}

const CURVE_LANE = {
  /* Not a key lane. The editor only reads `prop` to name its drag and its
   * `data-key-curve`, so a name no lane uses keeps the key-lane gates blind to it. */
  prop: "drawInEase" as KeyProperty,
  label: "Ease",
  unit: "",
  scale: 1,
  digits: 2,
  title: "The ease over the draw-in",
}

function EaseCurveField({
  tag,
  curve,
  onCurve,
}: {
  tag: string
  curve: RevealCurve
  onCurve: (c: RevealCurve, gesture: string | null) => void
}) {
  const [reason, setReason] = useState<string | null>(null)
  const k0: Key = { tMs: 0, value: 0, easeOut: { x: curve.x1, y: curve.y1 }, easeIn: "linear" }
  const k1: Key = { tMs: 1, value: 1, easeOut: "linear", easeIn: { x: curve.x2, y: curve.y2 } }
  const onEase = (out: EaseOut, inn: EaseIn, gesture: string | null): boolean => {
    /* The fit editor offers no Hold, so this only catches a typed or future path. */
    if (out === "hold") {
      setReason("Hold keeps the page blank, then draws it all at once. Flatten the handles instead.")
      return false
    }
    const o = out === "linear" ? { x: 1 / 3, y: 1 / 3 } : out
    const n = inn === "linear" ? { x: 2 / 3, y: 2 / 3 } : inn
    const c: RevealCurve = { x1: o.x, y1: o.y, x2: n.x, y2: n.y }
    const bad = curveProblem(c)
    if (bad) {
      setReason(bad)
      return false
    }
    setReason(null)
    onCurve(c, curveKnock("gesture") ? null : gesture)
    return true
  }
  return (
    <div data-ease-curve={tag} data-x1={curve.x1} data-y1={curve.y1} data-x2={curve.x2} data-y2={curve.y2} className="mt-1">
      <div className="relative" style={{ height: `${CURVE_FIT_H}px` }}>
        <CurveEditor m={CURVE_LANE} i={0} k0={k0} k1={k1} a={0} b={1} onEase={onEase} onReason={setReason} fit={!curveKnock("no-fit")} />
      </div>
      {reason && (
        <span role="status" className="block text-[10px] leading-snug text-muted-foreground">
          {reason}
        </span>
      )}
    </div>
  )
}
